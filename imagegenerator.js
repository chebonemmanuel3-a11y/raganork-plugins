const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
// Imagen 4.0 is preferred for high-quality text-to-image generation.
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODEL = "imagen-4.0-generate-001"; 

// --- Image Generation Function ---

/**
 * Calls the Imagen API to generate an image based on the prompt.
 * @param {string} prompt - The user's description of the desired image.
 * @returns {string|null} The base64-encoded image data, or null on error.
 */
async function generateImage(prompt) {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
        return "_❌ GEMINI_API_KEY not configured. Please set it using `.setvar GEMINI_API_KEY your_api_key`_";
    }

    const apiUrl = `${API_BASE_URL}${MODEL}:predict?key=${apiKey}`;

    // Payload structure for the Imagen 4.0 predict endpoint
    const payload = {
        instances: [{ 
            prompt: prompt,
            // You can add more parameters here like 'aspectRatio' (e.g., '1:1', '16:9') 
        }],
        parameters: {
            "sampleCount": 1, // Requesting one image
            "outputMimeType": "image/jpeg", // Default output format
        }
    };

    try {
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000, // Image generation can take up to 60 seconds
        });

        const predictions = response.data?.predictions;
        
        if (predictions && predictions.length > 0 && predictions[0].bytesBase64Encoded) {
            // Returns the base64 string of the image
            return predictions[0].bytesBase64Encoded;
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
    desc: "Generates an image from a text prompt using Imagen AI.",
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
        caption: `*✨ Generated Image:*\n_${prompt}_\n\n_Powered by Gemini & Emmanuel_` 
    }, 'image');
  }
);
