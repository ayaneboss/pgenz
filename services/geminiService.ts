

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ProductIdea, FullProduct } from '../types';
import { 
  GEMINI_TEXT_MODEL, 
  IDEA_GENERATION_SYSTEM_INSTRUCTION,
  IDEA_GENERATION_USER_PROMPT, 
  FULL_PRODUCT_SYSTEM_INSTRUCTION,
  FULL_PRODUCT_CREATION_PROMPT_TEMPLATE 
} from '../constants';

const parseGeminiJsonResponse = <T,>(responseText: string, requestDescription: string): T | null => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(?:json|JSON)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    console.error(`Failed to parse JSON response for ${requestDescription}:`, error);
    console.error("Raw text received:", responseText);
    const jsonRegex = /\{[\s\S]*\}|\[[\s\S]*\]/;
    const foundJson = jsonStr.match(jsonRegex);
    if (foundJson && foundJson[0]) {
      try {
        console.warn(`Attempting fallback JSON parsing for ${requestDescription}.`);
        return JSON.parse(foundJson[0]) as T;
      } catch (e) {
        console.error(`Fallback JSON parsing also failed for ${requestDescription}:`, e);
        return null;
      }
    }
    return null;
  }
};

export const generateProductIdea = async (): Promise<ProductIdea | null> => {
  if (!process.env.API_KEY) {
    console.error("API Key is missing in environment variables.");
    // This specific error should ideally be caught before calling, 
    // but as a safeguard within the service:
    throw new Error("API Key is not configured in the environment.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: IDEA_GENERATION_USER_PROMPT,
      config: {
        systemInstruction: IDEA_GENERATION_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      }
    });
    
    const idea = parseGeminiJsonResponse<ProductIdea>(response.text, "Product Idea Generation");
    if (!idea || !idea.niche || !idea.productIdeaName) {
        console.error("Generated idea is invalid or incomplete:", idea);
        console.error("Raw response text:", response.text);
        throw new Error("Failed to generate a valid product idea. The AI's response was not in the expected format.");
    }
    return idea;

  } catch (error) {
    console.error("Error generating product idea:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error (Idea Generation): ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating product idea.");
  }
};

export const buildFullProduct = async (idea: ProductIdea): Promise<FullProduct | null> => {
  if (!process.env.API_KEY) {
    console.error("API Key is missing in environment variables.");
    throw new Error("API Key is not configured in the environment.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const promptText = FULL_PRODUCT_CREATION_PROMPT_TEMPLATE(idea);
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: promptText,
      config: {
        systemInstruction: FULL_PRODUCT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      }
    });
    
    const product = parseGeminiJsonResponse<FullProduct>(response.text, "Full Product Creation");
     if (!product || !product.productName || !product.programStructure || product.programStructure.length === 0) {
        console.error("Generated product is invalid or incomplete:", product);
        console.error("Raw response text:", response.text);
        throw new Error("Failed to generate a valid full product. The AI's response was not in the expected format or was incomplete.");
    }
    return product;

  } catch (error) {
    console.error("Error building full product:", error);
     if (error instanceof Error) {
        throw new Error(`Gemini API Error (Product Build): ${error.message}`);
    }
    throw new Error("An unknown error occurred while building the full product.");
  }
};
