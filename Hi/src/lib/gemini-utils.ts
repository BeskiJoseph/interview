import { toast } from "@/components/ui/use-toast";

const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";

// Rate limiting and quota tracking
const RATE_LIMIT = {
  requestsPerMinute: 12,
  requestQueue: [] as { resolve: Function; reject: Function; fn: Function; retries: number }[],
  inProgress: 0,
  lastRequestTime: 0,
  maxRetries: 1,
  baseRetryDelay: 2000,
  dailyQuota: 1500,
  usageKey: 'gemini_api_usage',
  queueLock: false,
  maxQueueSize: 3, // Reduced to lower pressure
};

// API key management
let apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

const initApiKey = () => {
  if (import.meta.env.VITE_GEMINI_API_KEY) {
    apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    console.log("Gemini API key loaded from environment variable");
    return true;
  }
  const storedKey = sessionStorage.getItem('gemini_api_key');
  if (storedKey) {
    apiKey = storedKey;
    console.log("Gemini API key loaded from sessionStorage");
    return true;
  }
  console.warn("No Gemini API key found");
  return false;
};

initApiKey();

export const setGeminiApiKey = (key: string) => {
  if (key && key.trim()) {
    apiKey = key.trim();
    sessionStorage.setItem('gemini_api_key', apiKey);
    console.log("Gemini API key set and stored in session");
    return true;
  }
  return false;
};

export const getGeminiApiKey = () => {
  return apiKey || sessionStorage.getItem('gemini_api_key') || '';
};

export const hasGeminiApiKey = () => {
  return !!getGeminiApiKey();
};

// Track API usage
const trackApiUsage = () => {
  const usage = JSON.parse(localStorage.getItem(RATE_LIMIT.usageKey) || '{}');
  const today = new Date().toISOString().split('T')[0];
  usage[today] = (usage[today] || 0) + 1;
  localStorage.setItem(RATE_LIMIT.usageKey, JSON.stringify(usage));
  if (usage[today] >= RATE_LIMIT.dailyQuota * 0.9) {
    toast({
      title: "API Quota Warning",
      description: "Approaching daily API limit. Please provide a new API key or wait for quota reset.",
      variant: "warning",
    });
  }
  return usage[today];
};

// Validate API key
export const validateApiKey = async (key: string): Promise<boolean> => {
  try {
    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Test request to validate API key" }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.log("API key validation response:", response.status, errorData);
      if (response.status === 429) {
        toast({
          title: "API Quota Exhausted",
          description: "The provided Gemini API key has no remaining quota. Please use a new key or enable billing.",
          variant: "destructive",
        });
        return false;
      }
      if (response.status === 401) {
        toast({
          title: "Invalid API Key",
          description: "The provided Gemini API key is invalid. Please check and try again.",
          variant: "destructive",
        });
        return false;
      }
      return false;
    }
    return true;
  } catch (error) {
    console.error("API key validation failed:", error);
    toast({
      title: "Validation Error",
      description: "Failed to validate the API key. Please try again or use a different key.",
      variant: "destructive",
    });
    return false;
  }
};

// Process the request queue
const processQueue = () => {
  if (RATE_LIMIT.queueLock || RATE_LIMIT.requestQueue.length === 0 || RATE_LIMIT.inProgress >= RATE_LIMIT.requestsPerMinute) {
    return;
  }

  RATE_LIMIT.queueLock = true;

  const now = Date.now();
  const elapsed = now - RATE_LIMIT.lastRequestTime;
  const minInterval = 5000;

  if (elapsed < minInterval && RATE_LIMIT.inProgress > 0) {
    const delay = minInterval - elapsed;
    console.log(`Throttling requests, waiting ${delay}ms before next request. Queue size: ${RATE_LIMIT.requestQueue.length}`);
    setTimeout(() => {
      RATE_LIMIT.queueLock = false;
      processQueue();
    }, delay);
    return;
  }

  const request = RATE_LIMIT.requestQueue.shift();
  if (!request) {
    RATE_LIMIT.queueLock = false;
    return;
  }

  RATE_LIMIT.inProgress++;
  RATE_LIMIT.lastRequestTime = now;

  request
    .fn()
    .then((result: any) => {
      request.resolve(result);
    })
    .catch((error: any) => {
      request.reject(error);
    })
    .finally(() => {
      RATE_LIMIT.inProgress--;
      RATE_LIMIT.queueLock = false;
      setTimeout(processQueue, 2000); // Increased to 2 seconds to reduce pressure
    });
};

// Queue a request
const queueRequest = <T>(fn: () => Promise<T>, retries: number = 0): Promise<T> => {
  if (RATE_LIMIT.requestQueue.length >= RATE_LIMIT.maxQueueSize) {
    console.warn("Request queue full, dropping request");
    return Promise.reject(new Error("Request queue overloaded"));
  }
  return new Promise((resolve, reject) => {
    RATE_LIMIT.requestQueue.push({ resolve, reject, fn, retries });
    processQueue();
  });
};

interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
}

export const generateInterviewQuestion = async (
  jobDescription: string,
  previousQuestions: string[] = [],
  previousAnswers: string[] = [],
  options?: GeminiOptions
) => {
  if (!apiKey) {
    initApiKey();
  }

  if (!apiKey) {
    console.warn("Gemini API key not set, using default questions");
    toast({
      title: "API Key Missing",
      description: "Please provide a valid Gemini API key to generate tailored questions",
      variant: "destructive",
    });
    throw new Error("Gemini API key not set");
  }

  const defaultOptions = {
    temperature: 0.7,
    maxOutputTokens: 800,
    topK: 40,
    topP: 0.95,
    ...options,
  };

  const prompt = `
You are an expert technical interviewer. Generate a relevant, challenging interview question based on this job description:

${jobDescription}

Previous questions asked:
${previousQuestions.join('\n')}

Previous answers given:
${previousAnswers.join('\n')}

Focus on technical skills and problem-solving abilities. Make the question specific and detailed.
Generate only ONE question without any preamble or explanation.`;

  const makeRequest = async (retries: number = 0): Promise<string> => {
    if (trackApiUsage() >= RATE_LIMIT.dailyQuota) {
      toast({
        title: "API Quota Exhausted",
        description: "Daily API limit reached. Please provide a new API key or wait for quota reset.",
        variant: "destructive",
      });
      return getDefaultQuestion(jobDescription, previousQuestions);
    }

    try {
      console.log(
        "Calling Gemini API with key:",
        apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4)
      );

      const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: defaultOptions,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", response.status, errorText);

        if (response.status === 429) {
          toast({
            title: "Rate Limit Reached",
            description: "API quota exceeded. Waiting 33s before retrying or using fallback.",
            variant: "destructive",
          });
          if (retries < RATE_LIMIT.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 33000)); // 33 seconds retry delay
            return makeRequest(retries + 1);
          }
          return getDefaultQuestion(jobDescription, previousQuestions);
        }

        if (retries < RATE_LIMIT.maxRetries) {
          const retryDelay = RATE_LIMIT.baseRetryDelay * Math.pow(2, retries);
          console.log(`Rate limit (non-429) hit, retrying in ${retryDelay}ms (attempt ${retries + 1})`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return makeRequest(retries + 1);
        }

        toast({
          title: "Error Generating Question",
          description: "Failed to generate question. Using fallback.",
          variant: "destructive",
        });
        return getDefaultQuestion(jobDescription, previousQuestions);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
      console.error("Error generating question:", error);
      return getDefaultQuestion(jobDescription, previousQuestions);
    }
  };

  return queueRequest(() => makeRequest());
};

const getDefaultQuestion = (jobDescription: string, previousQuestions: string[]): string => {
  const role = jobDescription.toLowerCase().includes("software") ? "software engineering" : "general";
  const defaultQuestions = [
    `Can you describe a challenging ${role} problem you've solved recently?`,
    `What is your approach to debugging complex issues in ${role}?`,
    `How do you ensure quality in your ${role} projects?`,
    `Tell me about a time you had to learn a new technology quickly for ${role}.`,
    `How do you handle disagreements in a ${role} team?`,
    `Describe your experience with responsive design in ${role}.`,
    `How do you approach compatibility issues in your ${role} projects?`,
    `Explain your process for optimizing performance in ${role}.`,
    `What strategies do you use for testing in ${role}?`,
    `How do you stay updated with the latest trends in ${role}?`,
  ];

  const availableQuestions = defaultQuestions.filter((q) => !previousQuestions.includes(q));
  return (
    availableQuestions[Math.floor(Math.random() * availableQuestions.length)] ||
    "Can you share an example of a project you're proud of?"
  );
};

export const generateInterviewFeedback = async (
  jobDescription: string,
  transcript: { question: string; answer: string }[],
  options?: GeminiOptions
) => {
  if (!apiKey) {
    initApiKey();
  }

  if (!apiKey) {
    console.warn("Gemini API key not set, using default feedback");
    toast({
      title: "API Key Missing",
      description: "Please provide a valid Gemini API key to generate tailored feedback",
      variant: "destructive",
    });
    return getDefaultFeedback();
  }

  const hasValidAnswers = transcript.some((item) => item.answer.trim().length > 0);
  if (!hasValidAnswers) {
    return {
      strengths: ["No answers provided"],
      improvements: ["Please provide answers to the interview questions"],
      overallScore: 0,
    };
  }

  const defaultOptions = {
    temperature: 0.2,
    maxOutputTokens: 1500,
    topK: 40,
    topP: 0.95,
    ...options,
  };

  const transcriptText = transcript
    .map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`)
    .join('\n\n');

  const prompt = `
As an expert technical interviewer, analyze this interview for the following job:

${jobDescription}

INTERVIEW TRANSCRIPT:
${transcriptText}

Provide a detailed evaluation in JSON format:
{
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["improvement1", "improvement2", "improvement3"],
  "overallScore": X
}

The strengths should be specific positive aspects from the answers.
The improvements should be actionable suggestions.
The overallScore (1-10) should reflect:
- Depth and relevance of answers
- Technical accuracy
- Communication clarity
- Problem-solving approach

If answers are missing or very short, the score should be lower.
Return only valid JSON.`;

  const makeRequest = async (retries: number = 0): Promise<any> => {
    if (trackApiUsage() >= RATE_LIMIT.dailyQuota) {
      toast({
        title: "API Quota Exhausted",
        description: "Daily API limit reached. Please provide a new API key or wait for quota reset.",
        variant: "destructive",
      });
      return getDefaultFeedback();
    }

    try {
      console.log(
        "Calling Gemini API for feedback with key:",
        apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4)
      );

      const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: defaultOptions,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", response.status, errorText);

        if (response.status === 429) {
          toast({
            title: "Rate Limit Reached",
            description: "API quota exceeded. Using default feedback.",
            variant: "destructive",
          });
          return getDefaultFeedback();
        }

        if (retries < RATE_LIMIT.maxRetries) {
          const retryDelay = RATE_LIMIT.baseRetryDelay * Math.pow(2, retries);
          console.log(`Rate limit (non-429) hit, retrying in ${retryDelay}ms (attempt ${retries + 1})`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return makeRequest(retries + 1);
        }

        toast({
          title: "Error Generating Feedback",
          description: "Failed to generate feedback. Using default.",
          variant: "destructive",
        });
        return getDefaultFeedback();
      }

      const data = await response.json();
      const feedbackText = data.candidates[0].content.parts[0].text.trim();

      try {
        const cleanedText = feedbackText.replace(/```json|```/g, '').trim();
        const parsedFeedback = JSON.parse(cleanedText);
        return {
          strengths: parsedFeedback.strengths || ["Response unclear"],
          improvements: parsedFeedback.improvements || ["Please provide more detailed answers"],
          overallScore: parsedFeedback.overallScore || 0,
        };
      } catch (e) {
        console.error("Error parsing feedback:", e);
        return getDefaultFeedback();
      }
    } catch (error) {
      console.error("Error generating feedback:", error);
      return getDefaultFeedback();
    }
  };

  return queueRequest(() => makeRequest());
};

const getDefaultFeedback = () => ({
  strengths: ["Unable to generate detailed feedback"],
  improvements: ["Please try again with more detailed answers"],
  overallScore: 0,
});