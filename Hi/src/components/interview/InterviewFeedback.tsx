
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Star, Download, Share2, Video } from "lucide-react";
import type { SessionType } from "@/pages/Interview";

interface InterviewFeedbackProps {
  session: SessionType | null;
}

const InterviewFeedback: React.FC<InterviewFeedbackProps> = ({ session }) => {
  const [activeTab, setActiveTab] = useState<string>("summary");
  
  if (!session || !session.feedback) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No feedback available. Please complete an interview session first.</p>
      </div>
    );
  }
  
  const { strengths, improvements, overallScore } = session.feedback;
  
  const downloadTranscript = () => {
    if (!session.transcript) return;
    
    const transcriptText = session.transcript
      .map((item, index) => `Q${index + 1}: ${item.question}\n\nA: ${item.answer}\n\n`)
      .join('---\n\n');
    
    const feedbackText = `
INTERVIEW FEEDBACK
=================

Overall Score: ${overallScore}/10

Strengths:
${strengths.map(s => `- ${s}`).join('\n')}

Areas for Improvement:
${improvements.map(i => `- ${i}`).join('\n')}
`;
    
    const fullText = `INTERVIEW TRANSCRIPT\n===================\n\n${transcriptText}\n\n${feedbackText}`;
    
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-feedback-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-900">Interview Feedback</h2>
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            className="flex items-center"
            onClick={downloadTranscript}
          >
            <Download className="h-4 w-4 mr-2" />
            Save Transcript
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white border border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Overall Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end space-x-2">
              <span className="text-4xl font-bold">{overallScore}</span>
              <span className="text-xl text-gray-500">/10</span>
            </div>
            <Progress 
              value={overallScore * 10} 
              className="h-2 mt-2" 
            />
          </CardContent>
        </Card>
        
        <Card className="bg-white border border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Questions Answered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {session.transcript?.length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {session.role || "General Interview"}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="summary">Feedback Summary</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="recording">Recording</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-green-50 border border-green-100">
              <CardHeader>
                <CardTitle className="flex items-center text-green-800">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {strengths.map((strength, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle2 className="h-5 w-5 mr-2 text-green-600 shrink-0 mt-0.5" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            <Card className="bg-amber-50 border border-amber-100">
              <CardHeader>
                <CardTitle className="flex items-center text-amber-800">
                  <Star className="h-5 w-5 mr-2 text-amber-600" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {improvements.map((improvement, index) => (
                    <li key={index} className="flex items-start">
                      <Star className="h-5 w-5 mr-2 text-amber-600 shrink-0 mt-0.5" />
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="transcript" className="pt-6">
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              {session.transcript && session.transcript.length > 0 ? (
                <div className="space-y-6">
                  {session.transcript.map((item, index) => (
                    <div key={index} className="pb-6 border-b border-gray-100 last:border-0">
                      <div className="mb-3">
                        <h3 className="text-sm font-medium text-gray-500">Question {index + 1}</h3>
                        <p className="text-lg font-medium mt-1">{item.question}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Your Answer</h3>
                        <p className="mt-1 text-gray-800">{item.answer}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500">No transcript available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="recording" className="pt-6">
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              {session.recordingUrl ? (
                <div className="aspect-video bg-gray-100 rounded-md overflow-hidden">
                  <video 
                    src={session.recordingUrl} 
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <Video className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No recording available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InterviewFeedback;
