import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { hasGeminiApiKey, setGeminiApiKey, validateApiKey } from "@/lib/gemini-utils";
import type { SessionType } from "@/pages/Interview";

interface InterviewSetupProps {
  onStart: (role: string, skillLevel: string, jobDescription: string) => void;
  session: SessionType | null;
}

const InterviewSetup: React.FC<InterviewSetupProps> = ({ onStart, session }) => {
  const [selectedRole, setSelectedRole] = useState<string>(session?.role || "Software Engineer");
  const [customRole, setCustomRole] = useState<string>("");
  const [skillLevel, setSkillLevel] = useState<string>(session?.skillLevel || "Intermediate");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [geminiApiKey, setGeminiApiKeyState] = useState<string>("");
  const [needsApiKey, setNeedsApiKey] = useState<boolean>(!hasGeminiApiKey());
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    setNeedsApiKey(!hasGeminiApiKey());
  }, []);

  const handleStart = async () => {
    if (needsApiKey && geminiApiKey.trim()) {
      setIsValidating(true);
      const isValid = await validateApiKey(geminiApiKey.trim());
      setIsValidating(false);

      if (!isValid) {
        return;
      }

      const success = setGeminiApiKey(geminiApiKey.trim());
      if (success) {
        setNeedsApiKey(false);
        toast({
          title: "API Key Saved",
          description: "Your Gemini API key has been saved for this session.",
        });
      } else {
        toast({
          title: "Error Saving API Key",
          description: "Failed to save the API key. Please try again.",
          variant: "destructive",
        });
        return;
      }
    } else if (needsApiKey) {
      toast({
        title: "API Key Required",
        description: "Please provide a Gemini API key or add it to your environment variables.",
        variant: "destructive",
      });
      return;
    }

    const role = selectedRole === "Other" ? customRole : selectedRole;
    if (!role.trim()) {
      toast({
        title: "Role Required",
        description: "Please select or specify a role for the interview.",
        variant: "destructive",
      });
      return;
    }

    onStart(role, skillLevel, jobDescription);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-blue-900 mb-6">Interview Setup</h2>

      <div className="space-y-8">
        <div>
          <Label className="text-lg font-medium mb-3 block">Select your target role</Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Software Engineer">Software Engineer</SelectItem>
              <SelectItem value="Product Manager">Product Manager</SelectItem>
              <SelectItem value="Data Scientist">Data Scientist</SelectItem>
              <SelectItem value="Designer">Designer</SelectItem>
              <SelectItem value="Other">Other (Custom)</SelectItem>
            </SelectContent>
          </Select>

          {selectedRole === "Other" && (
            <div className="mt-4">
              <Label htmlFor="custom-role" className="text-sm">Specify your role</Label>
              <Input
                id="custom-role"
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                className="mt-1 w-full"
                placeholder="e.g. Marketing Manager"
              />
            </div>
          )}
        </div>

        <div>
          <Label className="text-lg font-medium mb-3 block">Experience level</Label>
          <RadioGroup value={skillLevel} onValueChange={setSkillLevel} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { value: "Beginner", label: "Beginner", description: "0-2 years experience" },
              { value: "Intermediate", label: "Intermediate", description: "3-5 years experience" },
              { value: "Advanced", label: "Advanced", description: "6+ years experience" },
            ].map((level) => (
              <div key={level.value} className="relative">
                <RadioGroupItem value={level.value} id={level.value} className="peer sr-only" />
                <Label
                  htmlFor={level.value}
                  className="flex flex-col h-full p-4 border border-gray-200 rounded-md cursor-pointer hover:border-blue-400 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50"
                >
                  <span className="text-lg font-medium">{level.label}</span>
                  <span className="text-sm text-gray-500">{level.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div>
          <Label htmlFor="job-description" className="text-lg font-medium mb-3 block">
            Job Description (for tailored questions)
          </Label>
          <Textarea
            id="job-description"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here to get tailored interview questions..."
            className="min-h-[150px] resize-none"
          />
        </div>

        {needsApiKey && (
          <div className="border-t pt-6">
            <Label htmlFor="gemini-api-key" className="text-lg font-medium mb-3 block text-amber-700">
              Gemini API Key Required
            </Label>
            <div className="text-sm text-gray-600 mb-4">
              <p>Enter a valid Gemini API key to enable AI-generated questions and feedback.</p>
              <p className="mt-1">Your key will be stored in this browser session only.</p>
              <p className="mt-1">Get a key from <a href="https://ai.google.dev" target="_blank" className="text-blue-600">Google AI Studio</a>.</p>
            </div>
            <Input
              id="gemini-api-key"
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKeyState(e.target.value)}
              placeholder="Enter your Gemini API key..."
              className="w-full"
            />
          </div>
        )}

        <div className="pt-4 text-right">
          <Button
            onClick={handleStart}
            disabled={(selectedRole === "Other" && !customRole.trim()) || isValidating}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isValidating ? "Validating API Key..." : "Start Interview"}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InterviewSetup;