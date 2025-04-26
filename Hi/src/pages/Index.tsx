
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { PanelRightOpen, Video, Brain, MessageSquare } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      <header className="w-full py-6 px-4 md:px-8 border-b border-blue-100">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Video className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-blue-900">InterviewFlow</h1>
          </div>
          <nav className="hidden md:flex space-x-6">
            <a href="#features" className="text-gray-600 hover:text-blue-700 transition-colors">Features</a>
            <a href="#how-it-works" className="text-gray-600 hover:text-blue-700 transition-colors">How it Works</a>
          </nav>
          <Button
            onClick={() => navigate("/interview")}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Start Practice
          </Button>
        </div>
      </header>

      <main className="flex-grow">
        <section className="py-16 px-4 md:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-blue-900 mb-6">
              Ace Your Next Interview with AI Coaching
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Practice interviews with our AI-powered coach. Get real-time feedback, 
              improve your responses, and build confidence for the real thing.
            </p>
            <div className="mt-10">
              <Button 
                onClick={() => navigate("/interview")} 
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-md mr-4"
              >
                Start Practice Interview
              </Button>
            </div>
          </div>

          <div id="features" className="grid md:grid-cols-3 gap-8 mt-16">
            {[
              {
                icon: <Brain className="h-10 w-10 text-blue-500" />,
                title: "AI-Powered Questions",
                description: "Our system generates realistic interview questions tailored to your target role and experience level."
              },
              {
                icon: <Video className="h-10 w-10 text-blue-500" />,
                title: "Video Recording",
                description: "Record your interview sessions to review your body language, tone, and delivery."
              },
              {
                icon: <MessageSquare className="h-10 w-10 text-blue-500" />,
                title: "Detailed Feedback",
                description: "Receive instant analysis on your answers with actionable tips for improvement."
              }
            ].map((feature, index) => (
              <Card key={index} className="border border-blue-100">
                <CardHeader>
                  <div className="mb-4">{feature.icon}</div>
                  <CardTitle className="text-xl text-blue-900">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="py-16 px-4 md:px-8 bg-blue-50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-blue-900 mb-12 text-center">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: "Start a Session",
                  description: "Begin a new interview practice session with role-specific questions."
                },
                {
                  step: "2",
                  title: "Answer Questions",
                  description: "Respond naturally to questions posed by our AI interviewer."
                },
                {
                  step: "3",
                  title: "Get Feedback",
                  description: "Review your performance with AI-powered analysis and improvement tips."
                }
              ].map((step, index) => (
                <div key={index} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white text-xl flex items-center justify-center mx-auto mb-4">
                    {step.step}
                  </div>
                  <h3 className="text-xl font-semibold text-blue-900 mb-2">{step.title}</h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-50 py-8 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center text-gray-500">
          <p>© 2023 InterviewFlow AI Coach. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
