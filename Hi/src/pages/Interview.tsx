import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InterviewSetup from "@/components/interview/InterviewSetup";
import InterviewSession from "@/components/interview/InterviewSession";
import InterviewFeedback from "@/components/interview/InterviewFeedback";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { createSessionId } from "@/lib/session-utils";
import { useToast } from "@/components/ui/use-toast";
import { saveSession, storeRecording } from "@/lib/db-service";
import { isFirebaseConfigured } from "@/lib/firebase-config";

export type SessionType = {
  sessionId: string;
  role?: string;
  skillLevel?: string;
  jobDescription?: string;
  recording?: Blob[];
  recordingUrl?: string;
  transcript?: { question: string; answer: string }[];
  feedback?: {
    strengths: string[];
    improvements: string[];
    overallScore?: number;
  };
  isCompleted?: boolean;
};

const Interview = () => {
  const [activeTab, setActiveTab] = useState<string>("setup");
  const [session, setSession] = useState<SessionType | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!session) {
      setSession({
        sessionId: createSessionId(),
        transcript: [],
        recording: [],
      });
    }
  }, []);

  const startInterview = (role: string, skillLevel: string, jobDescription: string) => {
    if (session) {
      setSession({
        ...session,
        role,
        skillLevel,
        jobDescription,
        isCompleted: false,
      });
      setActiveTab("session");
      toast({
        title: "Interview Started",
        description: `Starting ${skillLevel} level interview for ${role} role`,
      });

      saveSession({
        sessionId: session.sessionId,
        role,
        skillLevel,
        jobDescription,
        transcript: [],
        isCompleted: false,
      }).catch((err) => {
        console.error("Error saving initial session:", err);
      });
    }
  };

  const completeInterview = async (feedback: SessionType["feedback"]) => {
    if (session) {
      setIsProcessing(true);

      try {
        let recordingUrl = "";
        if (session.recording && session.recording.length > 0) {
          try {
            recordingUrl = await storeRecording(session.sessionId, session.recording);
            console.log("Successfully stored recording, URL:", recordingUrl);
          } catch (storageError) {
            console.error("Error storing recording:", storageError);
            toast({
              title: "Storage Note",
              description: "Your recording is saved locally for this session.",
            });
          }
        }

        const updatedSession = {
          ...session,
          feedback,
          recordingUrl,
          isCompleted: true,
        };

        setSession(updatedSession);

        await saveSession({
          sessionId: updatedSession.sessionId,
          role: updatedSession.role,
          skillLevel: updatedSession.skillLevel,
          jobDescription: updatedSession.jobDescription,
          recordingUrl: updatedSession.recordingUrl,
          transcript: updatedSession.transcript,
          feedback: updatedSession.feedback,
          isCompleted: true,
        }).catch((saveError) => {
          console.error("Error saving completed session:", saveError);
          toast({
            title: "Save Warning",
            description: "Your session couldn't be saved to the cloud. It remains available for this browser session.",
            variant: "destructive",
          });
        });

        setActiveTab("feedback");
        toast({
          title: "Interview Completed",
          description: "Your interview session has been analyzed and feedback is ready.",
        });
      } catch (error) {
        console.error("Error completing interview:", error);
        toast({
          title: "Error",
          description: "There was a problem processing your interview data.",
          variant: "destructive",
        });

        if (feedback) {
          setSession({
            ...session,
            feedback,
            isCompleted: true,
          });
          setActiveTab("feedback");
        }
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="w-full py-4 px-4 md:px-8 border-b border-blue-100">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <Button variant="ghost" onClick={() => navigate("/")} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-bold text-blue-900">InterviewFlow</h1>
          </div>

          {activeTab === "session" && (
            <div className="flex items-center">
              {isRecording ? (
                <div className="flex items-center">
                  <span className="h-3 w-3 bg-red-500 rounded-full animate-pulse mr-2"></span>
                  <span className="text-sm text-red-500">Recording</span>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Not Recording</span>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="py-8 px-4 md:px-8 max-w-7xl mx-auto">
        {isProcessing && (
          <div className="mb-4 p-4 bg-blue-50 rounded-md text-center">
            <p className="text-blue-700">Processing your interview data...</p>
          </div>
        )}

        <Card className="border border-blue-100 shadow-sm">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="setup" disabled={activeTab === "session" && isRecording}>
                  Setup
                </TabsTrigger>
                <TabsTrigger value="session" disabled={!session?.role || (activeTab === "session" && isRecording)}>
                  Interview
                </TabsTrigger>
                <TabsTrigger value="feedback" disabled={!session?.isCompleted}>
                  Feedback
                </TabsTrigger>
              </TabsList>

              <TabsContent value="setup" className="p-6">
                <InterviewSetup onStart={startInterview} session={session} />
              </TabsContent>

              <TabsContent value="session" className="p-0">
                <InterviewSession
                  session={session}
                  setSession={setSession}
                  isRecording={isRecording}
                  setIsRecording={setIsRecording}
                  onComplete={completeInterview}
                />
              </TabsContent>

              <TabsContent value="feedback" className="p-6">
                <InterviewFeedback session={session} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Interview;