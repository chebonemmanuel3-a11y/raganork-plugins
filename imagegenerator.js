const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
// Using gemini-2.5-flash-image-preview for wider availability and to avoid Imagen billing issues.
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODEL = "gemini-2.5-flash-image-preview"; 

// --- Image Generation Function ---

/**
 * Calls the Gemini Flash Image Preview API to generate an image based on the prompt.
 * @param {string} prompt - The user's description of the desired image.
 * @returns {string|null} The base64-encoded image data, or an error message string.
 */
async function generateImage(prompt) {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
        return "_❌ GEMINI_API_KEY not configured. Please set it using `.setvar GEMINI_API_KEY your_api_key`_";
    }

    const apiUrl = `${API_BASE_URL}${MODEL}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            // Request both text (optional) and image modalities
            responseModalities: ['TEXT', 'IMAGE']
        },
    };

    try {
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000, // Image generation can take up to 60 seconds
        });

        // The image data is nested differently in this model's response structure
        const base64Data = response.data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

        if (base64Data) {
            // Returns the base64 string of the image
            return base64Data;
        } else {
            return "_❌ AI could not generate an image or the response was empty._";
        }
    } catch (error) {
        console.error("Image generation error:", error.message);
        if (error.response) {
            return `_❌ API Error: ${error.response.data?.error?.message || "Unknown API error"}_`;
        }
        return "_❌ Network error. Please check your connection and retry._";
    }
}

// --- Command Module Definition (.image) ---

Module(
  {
    pattern: "image ?(.*)",
    fromMe: true, 
    desc: "Generates an image from a text prompt using Gemini AI.",
    usage: '.image A majestic robot chef baking a loaf of bread, digital art',
  },
  async (message, match) => {
    const prompt = match[1]?.trim();

    if (!prompt || prompt.length < 5) {
      return await message.sendReply(
        `_Please provide a detailed prompt (at least 5 characters) for the image you want to create!_\n\n` +
        `*Usage:* \`.image A majestic robot chef baking a loaf of bread, digital art\``
      );
    }

    await message.sendReply(`_🎨 Generating image for: "${prompt}"... this may take up to a minute._`);

    const result = await generateImage(prompt);

    // If the result is a string, it's an error message
    if (typeof result === 'string') {
        return await message.sendReply(result);
    }

    // Convert the base64 string to a buffer for sending
    const imageBuffer = Buffer.from(result, 'base64');
    
    // Send the image buffer back to the chat
    await message.sendReply(imageBuffer, { 
        caption: `*✨ Generated Image:*\n_${prompt}_\n\n_Powered by Gemini_` 
    }, 'image');
  }
);
