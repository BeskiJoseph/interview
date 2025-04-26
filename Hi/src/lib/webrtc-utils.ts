// Function to request user media (camera and microphone)
export const requestUserMedia = async (): Promise<MediaStream> => {
  try {
    const constraints = {
      audio: true,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user"
      }
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (error) {
    console.error("Error accessing media devices:", error);
    throw new Error("Could not access camera or microphone. Please check permissions.");
  }
};

// Class to handle MediaRecorder operations
export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  
  constructor() {
    this.recordedChunks = [];
  }
  
  // Initialize with a media stream
  initialize(stream: MediaStream) {
    this.stream = stream;
    this.recordedChunks = [];
    
    try {
      const options = { mimeType: "video/webm;codecs=vp9,opus" };
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      try {
        // Fallback for browsers that don't support vp9
        const options = { mimeType: "video/webm;codecs=vp8,opus" };
        this.mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        try {
          // Fallback to basic webm
          const options = { mimeType: "video/webm" };
          this.mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
          console.error("MediaRecorder error:", e);
          throw new Error("Your browser doesn't support the required codecs for recording.");
        }
      }
    }
    
    // Set up event handlers
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };
  }
  
  // Start recording
  start() {
    if (!this.mediaRecorder || this.mediaRecorder.state === "recording") {
      return;
    }
    
    this.recordedChunks = [];
    this.mediaRecorder.start(1000); // Collect data every second
  }
  
  // Stop recording
  stop(): Promise<Blob[]> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") {
        resolve(this.recordedChunks);
        return;
      }
      
      this.mediaRecorder.onstop = () => {
        resolve(this.recordedChunks);
      };
      
      this.mediaRecorder.stop();
    });
  }
  
  // Get recorded chunks
  getRecordedChunks(): Blob[] {
    return this.recordedChunks;
  }
  
  // Create a video blob from the recorded chunks
  createVideoBlob(): Blob | null {
    if (this.recordedChunks.length === 0) {
      return null;
    }
    
    return new Blob(this.recordedChunks, { type: "video/webm" });
  }
  
  // Cleanup resources
  cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }
}

// Speech recognition utility (using Web Speech API)
export class SpeechRecognitionUtil {
  private recognition: any = null;
  private isListening: boolean = false;
  private transcript: string = '';
  private onResultCallback: ((result: string) => void) | null = null;
  
  constructor() {
    // Check if browser supports SpeechRecognition
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      // Use any type to handle different browser implementations
      // @ts-ignore - TypeScript doesn't recognize webkitSpeechRecognition
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionAPI();
      this.setupRecognition();
    } else {
      console.error("Speech recognition not supported in this browser");
    }
  }
  
  private setupRecognition() {
    if (!this.recognition) return;
    
    this.recognition.continuous = false; // Changed to false to stop after each result
    this.recognition.interimResults = false; // Changed to false to avoid partial results
    this.recognition.lang = 'en-US';
    
    this.recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      
      // Update the full transcript
      this.transcript = currentTranscript;
      
      // Call the callback with the current result
      if (this.onResultCallback) {
        this.onResultCallback(this.transcript);
      }

      // Stop listening after a result is received
      this.stop();
    };
    
    this.recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      this.isListening = false;
    };
    
    this.recognition.onend = () => {
      this.isListening = false; // Ensure state is updated when recognition ends
    };
  }
  
  // Start listening
  start() {
    if (!this.recognition) {
      console.error("Speech recognition not supported");
      return;
    }
    
    if (this.isListening) {
      console.warn("Speech recognition already active");
      return;
    }
    
    try {
      this.isListening = true;
      this.transcript = ''; // Reset transcript on new start
      this.recognition.start();
    } catch (e) {
      console.error("Error starting speech recognition:", e);
      this.isListening = false;
    }
  }
  
  // Stop listening
  stop() {
    if (!this.recognition) return;
    
    this.isListening = false;
    this.recognition.stop();
  }
  
  // Get the current transcript
  getTranscript(): string {
    return this.transcript;
  }
  
  // Reset the transcript
  resetTranscript() {
    this.transcript = '';
  }
  
  // Set callback for when result is available
  onResult(callback: (result: string) => void) {
    this.onResultCallback = callback;
  }
  
  // Check if speech recognition is supported
  isSupported(): boolean {
    return this.recognition !== null;
  }

  // Check if recognition is currently active
  isActive(): boolean {
    return this.isListening;
  }
}