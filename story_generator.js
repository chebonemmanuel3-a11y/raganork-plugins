const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
/** * UPDATED: Using the exact model ID from your bot's installed list.
 * Based on your screenshot, 'gemini-2.5-flash-lite' is your current active model.
 */
const MODEL = "gemini-2.5-flash-lite"; 
const GENERATE_CONTENT_ENDPOINT = ":generateContent";

/**
 * Calls the Gemini API to generate a story.
 */
async function generateStory(prompt) {
    const apiKey = config.GEMINI_API_KEY;
    
    if (!apiKey) {
        return "_❌ GEMINI_API_KEY not configured. Please check your config file._";
    }

    const apiUrl = `${API_BASE_URL}${MODEL}${GENERATE_CONTENT_ENDPOINT}?key=${apiKey}`;

    const systemPrompt = "You are a creative storyteller. Write a short, complete story (3-5 paragraphs) based on the user's prompt with a clear beginning, middle, and end.";

    const payload = {
        contents: [{ 
            parts: [{ text: `Write a creative short story about: "${prompt}"` }] 
        }],
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
             return "_❌ No text returned. The model might have filtered the prompt. Try something else._";
        }

    } catch (error) {
        console.error("API Error:", error.message);
        const errorMessage = error.response?.data?.error?.message || error.message;
        return `_❌ API Error: ${errorMessage}_`;
    }
}

// --- Command Module ---

Module(
    {
        pattern: "stry ?(.*)",
        fromMe: false, 
        desc: "Generates a short story using AI.",
        usage: '.stry [theme]',
        type: 'ai'
    },
    async (message, match) => {
        const prompt = match[1]?.trim();

        if (!prompt) {
            return await message.sendReply("📖 *Usage:* `.stry [theme]`\n*Example:* `.stry a lonely robot on Mars`.");
        }

        await message.sendReply(`✍️ _Processing with ${MODEL}..._`);

        try {
            const story = await generateStory(prompt);
            await message.sendReply(`*📖 Generated Story:*\n\n${story}`);
        } catch (error) {
            await message.sendReply(`_❌ Critical Error: ${error.message}_`);
        }
    }
);
