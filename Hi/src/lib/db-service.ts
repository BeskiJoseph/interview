
// Database service to handle storage of videos and interview data
import type { SessionType } from "@/pages/Interview";
import { db, storage, isFirebaseConfigured } from "./firebase-config";
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  doc, 
  query, 
  orderBy, 
  setDoc 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { toast } from "@/components/ui/use-toast";

// Define types for interview session storage
export interface StoredSession extends Omit<SessionType, 'recording'> {
  recordingUrl?: string;
  jobDescription?: string;
  timestamp: number;
}

// Function to store video blob and get a URL
export const storeRecording = async (sessionId: string, recordingBlobs: Blob[]): Promise<string> => {
  try {
    if (!recordingBlobs.length) {
      throw new Error("No recording data provided");
    }
    
    // Combine blobs into a single video file
    const videoBlob = new Blob(recordingBlobs, { type: "video/webm" });
    
    // If Firebase isn't properly configured, use object URL immediately
    if (!isFirebaseConfigured || !storage) {
      console.log("Firebase not configured, using object URL for video storage");
      const videoUrl = URL.createObjectURL(videoBlob);
      return videoUrl;
    }
    
    // For development environments, try to detect if we're in localhost
    const isLocalhost = window.location.hostname === "localhost" || 
                         window.location.hostname === "127.0.0.1";
    
    // If we're in localhost, we'll try Firebase but have a quick fallback for CORS errors
    if (isLocalhost) {
      try {
        console.log("Attempting to upload video to Firebase Storage (may have CORS issues in development)");
        
        // Set a short timeout to detect potential CORS issues quicker
        const uploadPromise = new Promise(async (resolve, reject) => {
          try {
            const storageRef = ref(storage, `recordings/${sessionId}.webm`);
            await uploadBytes(storageRef, videoBlob);
            const downloadURL = await getDownloadURL(storageRef);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        });
        
        // Race between upload and timeout
        const result = await Promise.race([
          uploadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("Upload timeout - possible CORS issue")), 5000))
        ]);
        
        return result as string;
      } catch (error) {
        console.error("Local development Firebase Storage error (likely CORS):", error);
        toast({
          title: "Local Development",
          description: "Using local storage for video due to CORS limitations in development.",
          variant: "default"
        });
        
        const videoUrl = URL.createObjectURL(videoBlob);
        return videoUrl;
      }
    }
    
    // Production environment flow - attempt upload with more patience
    try {
      const storageRef = ref(storage, `recordings/${sessionId}.webm`);
      await uploadBytes(storageRef, videoBlob);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      // Update the session with the recording URL
      const sessionRef = doc(db, "sessions", sessionId);
      const sessionSnapshot = await getDoc(sessionRef);
      
      if (sessionSnapshot.exists()) {
        await setDoc(sessionRef, {
          ...sessionSnapshot.data(),
          recordingUrl: downloadURL
        }, { merge: true });
      }
      
      console.log(`Recording stored for session ${sessionId}`);
      return downloadURL;
    } catch (storageError) {
      console.error("Firebase Storage error:", storageError);
      toast({
        title: "Storage Error",
        description: "Could not upload recording to cloud. Using local storage instead.",
        variant: "destructive"
      });
      
      // Create a fallback local URL
      const videoUrl = URL.createObjectURL(videoBlob);
      return videoUrl;
    }
  } catch (error) {
    console.error("Error storing recording:", error);
    
    // Always ensure we return a usable URL
    const videoBlob = new Blob(recordingBlobs, { type: "video/webm" });
    const videoUrl = URL.createObjectURL(videoBlob);
    console.log("Fallback to object URL");
    
    toast({
      title: "Recording Saved Locally",
      description: "Your recording is available for this session only."
    });
    
    return videoUrl;
  }
};

// Function to save session data
export const saveSession = async (session: Omit<StoredSession, 'timestamp'>): Promise<void> => {
  try {
    const timestamp = Date.now();
    const sessionId = session.sessionId || uuidv4(); // Ensure we have a sessionId
    
    const sessionData = {
      ...session,
      sessionId,
      timestamp
    };
    
    // Use localStorage if Firebase isn't properly configured
    if (!isFirebaseConfigured || !db) {
      const localSessions = JSON.parse(localStorage.getItem('interviewSessions') || '{}');
      localSessions[sessionId] = sessionData;
      localStorage.setItem('interviewSessions', JSON.stringify(localSessions));
      console.log(`Session ${sessionId} saved locally (Firebase not configured)`);
      return;
    }
    
    // Add or update the session in Firestore
    const sessionRef = doc(db, "sessions", sessionId);
    await setDoc(sessionRef, sessionData);
    
    console.log(`Session ${sessionId} saved to Firestore`);
  } catch (error) {
    console.error("Error saving session to Firestore:", error);
    
    // Fallback to local storage for development/testing
    const timestamp = Date.now();
    const localSessions = JSON.parse(localStorage.getItem('interviewSessions') || '{}');
    const sessionId = session.sessionId || uuidv4();
    
    localSessions[sessionId] = {
      ...session,
      sessionId,
      timestamp
    };
    
    localStorage.setItem('interviewSessions', JSON.stringify(localSessions));
    console.log(`Session ${sessionId} saved locally`);
  }
};

// Function to get a session
export const getSession = async (sessionId: string): Promise<StoredSession | null> => {
  try {
    // Use localStorage if Firebase isn't properly configured
    if (!isFirebaseConfigured || !db) {
      const localSessions = JSON.parse(localStorage.getItem('interviewSessions') || '{}');
      return localSessions[sessionId] || null;
    }
    
    const sessionRef = doc(db, "sessions", sessionId);
    const sessionSnapshot = await getDoc(sessionRef);
    
    if (sessionSnapshot.exists()) {
      return sessionSnapshot.data() as StoredSession;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting session from Firestore:", error);
    
    // Fallback to local storage
    const localSessions = JSON.parse(localStorage.getItem('interviewSessions') || '{}');
    return localSessions[sessionId] || null;
  }
};

// Function to get all sessions
export const getAllSessions = async (): Promise<StoredSession[]> => {
  try {
    // Use localStorage if Firebase isn't properly configured
    if (!isFirebaseConfigured || !db) {
      const localSessions = JSON.parse(localStorage.getItem('interviewSessions') || '{}');
      const typedSessions: StoredSession[] = Object.values(localSessions)
        .filter((session): session is StoredSession => 
          typeof session === 'object' && 
          session !== null &&
          'sessionId' in session &&
          'timestamp' in session
        )
        .sort((a, b) => b.timestamp - a.timestamp);
      
      return typedSessions;
    }
    
    const sessionsQuery = query(collection(db, "sessions"), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(sessionsQuery);
    
    const sessions: StoredSession[] = [];
    querySnapshot.forEach((doc) => {
      sessions.push(doc.data() as StoredSession);
    });
    
    return sessions;
  } catch (error) {
    console.error("Error getting all sessions from Firestore:", error);
    
    // Fallback to local storage
    const localSessions = JSON.parse(localStorage.getItem('interviewSessions') || '{}');
    // Ensure we properly type-cast and validate the local storage objects
    const typedSessions: StoredSession[] = Object.values(localSessions)
      .filter((session): session is StoredSession => 
        typeof session === 'object' && 
        session !== null &&
        'sessionId' in session &&
        'timestamp' in session
      )
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return typedSessions;
  }
};

// For clearing test data or during development
export const clearSessions = async (): Promise<void> => {
  try {
    // Clear from localStorage if Firebase isn't properly configured
    if (!isFirebaseConfigured || !db) {
      localStorage.removeItem('interviewSessions');
      console.log("All local sessions cleared");
      return;
    }
    
    const sessionsQuery = query(collection(db, "sessions"));
    const querySnapshot = await getDocs(sessionsQuery);
    
    const deletePromises = querySnapshot.docs.map(async (doc) => {
      await setDoc(doc.ref, { deleted: true }, { merge: true });
    });
    
    await Promise.all(deletePromises);
    console.log("All sessions marked as deleted");
  } catch (error) {
    console.error("Error clearing sessions from Firestore:", error);
    
    // Fallback to clearing local storage
    localStorage.removeItem('interviewSessions');
  }
};
