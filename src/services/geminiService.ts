import { GoogleGenAI, Type } from "@google/genai";
import { AIParseResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseTransactionText(text: string): Promise<AIParseResult | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following financial transaction text into structured data: "${text}". 
      If it's an expense (like "spent", "bought", "cost"), set type to 'expense'. 
      If it's income (like "received", "earned", "salary"), set type to 'income'.
      Extract the amount as a number. 
      Identify a suitable category name (e.g., Food, Transport, Salary, Entertainment).
      Extract any additional note.
      Return the result in JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            type: { type: Type.STRING, enum: ["income", "expense"] },
            categoryName: { type: Type.STRING },
            note: { type: Type.STRING },
          },
          required: ["amount", "type", "categoryName"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text.trim()) as AIParseResult;
    }
    return null;
  } catch (error) {
    console.error("Gemini parsing error:", error);
    return null;
  }
}
