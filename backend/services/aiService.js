import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const analyzeMeetingTranscript = async (transcript) => {
  const prompt = `
You are an AI meeting assistant.

Analyze the meeting transcript and extract:

1. A concise meeting summary.
2. All action items.
3. The person assigned to each task.
4. The deadline for each task.
5. Important decisions made during the meeting.

Return ONLY valid JSON in exactly this structure:

{
  "summary": "string",
  "actionItems": [
    {
      "task": "string",
      "assignedTo": "string",
      "deadline": "string",
      "status": "pending"
    }
  ],
  "decisions": [
    "string"
  ]
}

Rules:
- Do not include markdown.
- Do not use code fences.
- Do not add explanations outside the JSON.
- If an assignee is not mentioned, use "Unassigned".
- If a deadline is not mentioned, use "No deadline".
- Every action item must have status "pending".

Meeting transcript:

${transcript}
`;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.2,
    response_format: {
      type: "json_object",
    },
  });

  const content = response.choices[0].message.content;

  return JSON.parse(content);
};