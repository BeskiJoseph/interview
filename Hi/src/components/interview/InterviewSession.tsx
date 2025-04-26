import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { requestUserMedia, VideoRecorder, SpeechRecognitionUtil } from "@/lib/webrtc-utils";
import { useToast } from "@/components/ui/use-toast";
import { generateInterviewQuestion } from "@/lib/gemini-utils";
import type { SessionType } from "@/pages/Interview";
import { debounce } from "lodash";

interface InterviewSessionProps {
  session: SessionType | null;
  setSession: React.Dispatch<React.SetStateAction<SessionType | null>>;
  isRecording: boolean;
  setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
  onComplete: (feedback: SessionType["feedback"]) => void;
}

const InterviewSession: React.FC<InterviewSessionProps> = ({
  session,
  setSession,
  isRecording,
  setIsRecording,
  onComplete,
}) => {
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean>(false);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [userResponse, setUserResponse] = useState<string>("");
  const [micEnabled, setMicEnabled] = useState<boolean>(true);
  const [videoEnabled, setVideoEnabled] = useState<boolean>(true);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [waitingForResponse, setWaitingForResponse] = useState<boolean>(false);
  const [conversation, setConversation] = useState<Array<{ role: string; content: string }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<VideoRecorder>(new VideoRecorder());
  const speechRecognitionRef = useRef<SpeechRecognitionUtil>(new SpeechRecognitionUtil());
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechRef = useRef<string>("");
  const { toast } = useToast();

  useEffect(() => {
    const setupMedia = async () => {
      try {
        const stream = await requestUserMedia();
        setMediaStream(stream);
        setHasMediaPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        recorderRef.current.initialize(stream);

        if (speechRecognitionRef.current.isSupported()) {
          speechRecognitionRef.current.onResult(debouncedHandleUserSpeech);
        } else {
          toast({
            title: "Speech Recognition Not Available",
            description: "Your browser doesn't support speech recognition.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error setting up media:", error);
        setHasMediaPermission(false);
      }
    };

    setupMedia();
    initializeSpeechSynthesis();
    startInterview();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      speechRecognitionRef.current.stop();
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
      }
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
      }
    };
  }, []);

  const initializeSpeechSynthesis = () => {
    if ("speechSynthesis" in window) {
      speechSynthesisRef.current = new SpeechSynthesisUtterance();
      speechSynthesisRef.current.onend = () => {
        setIsProcessing(false);
        setWaitingForResponse(true);
        startResponseTimeout();
      };
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (voice) =>
          voice.name.includes("Samantha") ||
          voice.name.includes("Google") ||
          voice.name.includes("Female")
      );

      if (preferredVoice) {
        speechSynthesisRef.current.voice = preferredVoice;
      }

      speechSynthesisRef.current.rate = 1.0;
      speechSynthesisRef.current.pitch = 1.0;
    }
  };

  const startInterview = async () => {
    const greeting = session?.role
      ? `Hi! I'm your AI interviewer for the ${session.role} position. How are you today?`
      : "Hi! I'm your AI interviewer. How are you today?";

    setCurrentQuestion(greeting);
    setConversation([{ role: "assistant", content: greeting }]);
    speakText(greeting);
  };

  const startResponseTimeout = () => {
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
    }
    responseTimeoutRef.current = setTimeout(() => {
      if (waitingForResponse && !isListening) {
        handleNoResponse();
      }
    }, 15000);
  };

  const debouncedHandleUserSpeech = debounce((text: string) => {
    if (text === lastSpeechRef.current) return; // Skip if same as last processed
    lastSpeechRef.current = text;
    handleUserSpeech(text);
  }, 500);

  const handleUserSpeech = async (text: string) => {
    setUserResponse(text);
    setIsListening(false);
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
    }

    const updatedConversation = [...conversation, { role: "user", content: text }];
    setConversation(updatedConversation);
    setWaitingForResponse(false);

    setIsProcessing(true);

    try {
      const aiResponseText = await generateAIResponse(text, updatedConversation);
      setAiResponse(aiResponseText);
      setConversation((prev) => [...prev, { role: "assistant", content: aiResponseText }]);
      setCurrentQuestion(aiResponseText);

      setTimeout(() => {
        speakText(aiResponseText);
      }, 100);
    } catch (error) {
      console.error("Error generating AI response:", error);
      if (!conversation.some((msg) => msg.content === "I didn't quite catch that. Could you please rephrase or share more details?")) {
        const fallbackResponse = text.toLowerCase().includes("done")
          ? "Thank you for the interview! I'll provide feedback shortly."
          : "I didn't quite catch that. Could you please rephrase or share more details?";
        setAiResponse(fallbackResponse);
        setConversation((prev) => [...prev, { role: "assistant", content: fallbackResponse }]);
        setCurrentQuestion(fallbackResponse);
        setTimeout(() => {
          speakText(fallbackResponse);
        }, 100);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNoResponse = async () => {
    setWaitingForResponse(false);
    setIsProcessing(true);
    try {
      const aiResponseText = await generateAIResponse("", conversation);
      setAiResponse(aiResponseText);
      setConversation((prev) => [...prev, { role: "assistant", content: aiResponseText }]);
      setCurrentQuestion(aiResponseText);
      setTimeout(() => {
        speakText(aiResponseText);
      }, 100);
    } catch (error) {
      console.error("Error generating follow-up:", error);
      if (!conversation.some((msg) => msg.content === "It seems you need more time. Here's another question: Can you share an example of a project you're proud of?")) {
        const fallbackResponse = "It seems you need more time. Here's another question: Can you share an example of a project you're proud of?";
        setAiResponse(fallbackResponse);
        setConversation((prev) => [...prev, { role: "assistant", content: fallbackResponse }]);
        setCurrentQuestion(fallbackResponse);
        setTimeout(() => {
          speakText(fallbackResponse);
        }, 100);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const generateAIResponse = async (userInput: string, conversation: Array<{ role: string; content: string }>): Promise<string> => {
    const prompt = `
As a friendly AI interviewer for a ${session?.role || "professional"} position, respond naturally to:
"${userInput || "No response"}"

Conversation history:
${conversation.map((msg) => `${msg.role}: ${msg.content}`).join('\n')}

Keep the conversation flowing naturally. If the candidate has answered a question, acknowledge their response and ask a relevant follow-up question.
If they ask a question, provide a helpful response.
If no response is provided, ask a new relevant question.
Keep responses conversational and engaging, like Siri or Alexa would respond.
If they indicate they're ready to finish (e.g., 'done'), thank them and provide a summary of the conversation.
Avoid repeating previous questions or responses.
`;

    const response = await generateInterviewQuestion("", conversation.map((msg) => msg.content), []);
    if (!response || response.trim() === "") {
      throw new Error("Empty response from API");
    }
    return response;
  };

  const toggleMic = () => {
    if (mediaStream) {
      mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !micEnabled;
      });
      setMicEnabled(!micEnabled);
    }
  };

  const toggleVideo = () => {
    if (mediaStream) {
      mediaStream.getVideoTracks().forEach((track) => {
        track.enabled = !videoEnabled;
      });
      setVideoEnabled(!videoEnabled);
    }
  };

  const toggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
    if (voiceEnabled) {
      window.speechSynthesis.cancel();
    }
  };

  const speakText = (text: string) => {
    if (voiceEnabled && speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
      speechSynthesisRef.current.text = text;
      window.speechSynthesis.speak(speechSynthesisRef.current);
    }
  };

  const startListening = () => {
    if (isProcessing || !waitingForResponse) {
      toast({
        title: "Please Wait",
        description: "The AI is still processing or waiting for the right moment to listen.",
        variant: "default",
      });
      return;
    }

    if (speechRecognitionRef.current.isActive()) {
      toast({
        title: "Already Listening",
        description: "Speech recognition is already active. Please wait for the current session to complete.",
        variant: "default",
      });
      return;
    }

    setIsListening(true);
    speechRecognitionRef.current.start();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
      <div className="md:col-span-2 bg-gray-900 aspect-video relative">
        {hasMediaPermission ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white">
            <p>Camera access required</p>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
          <Button
            variant="outline"
            size="icon"
            className={`rounded-full ${
              micEnabled ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-red-600 text-white hover:bg-red-700"
            }`}
            onClick={toggleMic}
          >
            {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className={`rounded-full ${
              videoEnabled ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-red-600 text-white hover:bg-red-700"
            }`}
            onClick={toggleVideo}
          >
            {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
    size="icon"
            className={`rounded-full ${
              voiceEnabled ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-600 text-white hover:bg-gray-700"
            }`}
            onClick={toggleVoice}
          >
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="p-6 bg-white border-l border-gray-200 flex flex-col h-full">
        <div className="flex-grow space-y-4 overflow-y-auto">
          {conversation.map((message, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${
                message.role === "assistant"
                  ? "bg-blue-50 border border-blue-100"
                  : "bg-gray-50 border border-gray-100"
              }`}
            >
              <p className="text-sm">
                {message.role === "assistant" ? "AI: " : "You: "}
                {message.content}
              </p>
            </div>
          ))}

          {isProcessing && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm animate-pulse">AI is thinking...</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={startListening}
            disabled={isListening || isProcessing || !waitingForResponse}
          >
            {isListening ? "Listening..." : "Hold to Speak"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InterviewSession;