
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { GarmentCategory, ShoppingResult } from "../types";
import { db } from "../lib/db";

const fileToPart = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    return { mimeType: mimeMatch[1], data: arr[1] };
}

const dataUrlToPart = (dataUrl: string) => {
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

const handleApiResponse = (response: GenerateContentResponse): string => {
    if (response.promptFeedback?.blockReason) {
        throw new Error(`Request blocked: ${response.promptFeedback.blockReason}`);
    }

    // Find the first image part
    for (const candidate of response.candidates ?? []) {
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            return `data:${mimeType};base64,${data}`;
        }
    }
    
    // Fallback text error
    const text = response.text?.trim();
    if (text) throw new Error(text);
    
    throw new Error("No image returned from AI");
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const REASONING_MODEL = 'gemini-3.1-pro-preview'; // Used for Search

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export const generateModelImage = async (userImage: File): Promise<string> => {
    const userImagePart = await fileToPart(userImage);
    const prompt = "You are an expert fashion photographer AI. Transform the person in this image into a full-body fashion model photo suitable for an e-commerce website. The background must be a clean, neutral studio backdrop (light gray, #f0f0f0). The person should have a neutral, professional model expression. Preserve the person's identity, unique features, and body type, but place them in a standard, relaxed standing model pose. The final image must be photorealistic. Return ONLY the final image.";
    const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: { parts: [userImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
            safetySettings,
        },
    });
    return handleApiResponse(response);
};

export const generateVirtualTryOnImage = async (modelImageUrl: string, garmentImage: File, cacheKey?: string): Promise<string> => {
    // Check Cache First
    if (cacheKey) {
        const cached = await db.getGeneration(cacheKey);
        if (cached) return cached;
    }

    const modelImagePart = dataUrlToPart(modelImageUrl);
    const garmentImagePart = await fileToPart(garmentImage);
    const prompt = `You are an expert virtual try-on AI. You will be given a 'model image' and a 'garment image'. Your task is to create a new photorealistic image where the person from the 'model image' is wearing the clothing from the 'garment image'.

**Crucial Rules:**
1.  **Complete Garment Replacement:** You MUST completely REMOVE and REPLACE the clothing item worn by the person in the 'model image' with the new garment. No part of the original clothing (e.g., collars, sleeves, patterns) should be visible in the final image.
2.  **Preserve the Model:** The person's face, hair, body shape, and pose from the 'model image' MUST remain unchanged.
3.  **Preserve the Background:** The entire background from the 'model image' MUST be preserved perfectly.
4.  **Apply the Garment:** Realistically fit the new garment onto the person. It should adapt to their pose with natural folds, shadows, and lighting consistent with the original scene.
5.  **Output:** Return ONLY the final, edited image. Do not include any text.`;
    
    const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: { parts: [modelImagePart, garmentImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
            safetySettings,
        },
    });
    
    const result = handleApiResponse(response);
    
    // Save to Cache
    if (cacheKey && result) {
        await db.saveGeneration(cacheKey, result);
    }
    
    return result;
};

export const generatePoseVariation = async (tryOnImageUrl: string, poseInstruction: string, cacheKey?: string): Promise<string> => {
    // Check Cache
    if (cacheKey) {
        const cached = await db.getGeneration(cacheKey);
        if (cached) return cached;
    }

    const tryOnImagePart = dataUrlToPart(tryOnImageUrl);
    const prompt = `You are an expert fashion photographer AI. Take this image and regenerate it from a different perspective. The person, clothing, and background style must remain identical. The new perspective should be: "${poseInstruction}". Return ONLY the final image.`;
    
    const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: { parts: [tryOnImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
            safetySettings,
        },
    });
    
    const result = handleApiResponse(response);
    
    // Save Cache
    if (cacheKey && result) {
        await db.saveGeneration(cacheKey, result);
    }

    return result;
};

export const categorizeGarment = async (garmentImage: File): Promise<{ category: GarmentCategory; name: string }> => {
    // Note: Caching categorization is tricky without a file hash. 
    // Given it's fast (Flash model) and infrequent (upload only), we skip caching for complexity reasons here.
    const garmentImagePart = await fileToPart(garmentImage);
    // Request JSON schema for strict structure
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { 
            parts: [
                garmentImagePart, 
                { text: "Analyze this clothing item. 1. Classify it into exactly ONE of these categories: 'tops', 'bottoms', 'outerwear', 'dresses', 'accessories'. 2. Generate a short, creative, descriptive name for it (e.g., 'Sunset Orange Silk Blouse')." }
            ] 
        },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    category: { type: Type.STRING, enum: ['tops', 'bottoms', 'outerwear', 'dresses', 'accessories'] },
                    name: { type: Type.STRING }
                },
                required: ['category', 'name']
            },
            safetySettings,
        }
    });

    try {
        const json = JSON.parse(response.text || '{}');
        return {
            category: json.category || 'tops',
            name: json.name || 'New Item'
        };
    } catch (e) {
        return { category: 'tops', name: 'New Item' };
    }
};

export const generateColorway = async (garmentImageUrl: string, colorDescription: string = "a different color"): Promise<string> => {
    const garmentImagePart = dataUrlToPart(garmentImageUrl);
    const prompt = `Create a color variant of this clothing item. Keep the design, texture, and shape exactly the same, but change the color to: ${colorDescription}. Return ONLY the image.`;
    
    const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: { parts: [garmentImagePart, { text: prompt }] },
        config: { 
            responseModalities: [Modality.IMAGE],
            safetySettings,
        }
    });
    return handleApiResponse(response);
};

export const findSimilarItems = async (garmentImageUrl: string): Promise<ShoppingResult[]> => {
    const garmentImagePart = dataUrlToPart(garmentImageUrl);
    const prompt = "Find similar items to this piece of clothing available for sale online. Provide links.";
    
    const response = await ai.models.generateContent({
        model: REASONING_MODEL,
        contents: { parts: [garmentImagePart, { text: prompt }] },
        config: {
            tools: [{ googleSearch: {} }],
            safetySettings,
        }
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const results: ShoppingResult[] = [];

    // Extract URLs from grounding metadata
    chunks.forEach(chunk => {
        if (chunk.web?.uri && chunk.web?.title) {
            results.push({
                title: chunk.web.title,
                uri: chunk.web.uri,
                source: new URL(chunk.web.uri).hostname.replace('www.', '')
            });
        }
    });

    // Deduplicate by URI
    return Array.from(new Map(results.map(item => [item.uri, item])).values()).slice(0, 5);
};
