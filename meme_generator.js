const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODEL = "gemini-2.5-flash-preview-09-2025";
const GENERATE_CONTENT_ENDPOINT = ":generateContent";

/**
 * Calls the Gemini API to generate meme captions in English, Swahili, and Sheng.
 * @param {string} prompt - The theme or scenario for the meme.
 * @returns {Promise<string>} The generated list of meme captions.
 */
async function generateMemeCaption(prompt) {
    const apiKey = config.GEMINI_API_KEY;
    
    if (!apiKey) {
        return "_❌ GEMINI_API_KEY not configured. Please set it up to use this feature._";
    }

    const apiUrl = `${API_BASE_URL}${MODEL}${GENERATE_CONTENT_ENDPOINT}?key=${apiKey}`;

    // System instruction to guide the model's persona and output style
    const systemPrompt = "You are a hilarious, culturally aware meme generator specializing in East African humor, especially Kenyan (using Sheng, Kiswahili, and English). The user will provide a scenario or topic. Your response must be a single, raw text block containing three distinct, funny, and short meme captions related to the prompt. Each caption should be numbered and can use a mix of English, Kiswahili, and Sheng (e.g., 'Aki si umenichoma!'). Ensure the humor is relatable and current.";

    const userQuery = `Generate three funny meme captions for the following scenario: "${prompt}"`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };

    try {
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 20000,
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            return text;
        } else {
             console.error("Meme generation failed to return text:", response.data);
             return "_❌ Meme generation failed. The model did not return any text. Try a different prompt._";
        }

    } catch (error) {
        console.error("Meme generation API error:", error.message);
        const errorMessage = error.response?.data?.error?.message || error.message;
        return `_❌ Error during meme generation: ${errorMessage}_`;
    }
}


// --- Command Module Definition (.meme) ---

Module(
    {
        pattern: "meme(.*)",
        fromMe: true,
        desc: "Generates hilarious meme captions in English, Kiswahili, and Sheng.",
        usage: '.meme [your scenario or topic]',
    },
    async (message, match) => {
        const prompt = match[1]?.trim();

        // 1. Handle case where no prompt is given (show instructions)
        if (!prompt) {
            return await message.sendReply(
                `😂 *Meme Generator: Jibebe!* 😂\n\n` +
                `To generate captions, provide a relatable scenario.\n\n` +
                `*Usage Example 1:* \`.meme when you see a notification from your bank on the 25th of the month\`` +
                `\n*Usage Example 2:* \`.meme trying to explain Sheng to my mother\``
            );
        }

        // 2. Handle caption generation
        const loadingMessage = await message.sendReply(`😂 _Leta maneno... Generating local captions for: *${prompt}*..._`);

        try {
            const generatedCaptions = await generateMemeCaption(prompt);

            await message.sendReply(`*😂 Hapa ni meme zako:*\n\n${generatedCaptions}`);
            
        } catch (error) {
            await message.sendReply(`_❌ An unexpected critical error occurred: ${error.message}_`);
        }
    }
);
