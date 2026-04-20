const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
// Updated to the stable Gemini 2.5 Flash ID to fix the 404 error
const MODEL = "gemini-2.5-flash"; 
const GENERATE_CONTENT_ENDPOINT = ":generateContent";

/**
 * Calls the Gemini API to generate a story.
 * @param {string} prompt - The theme or start of the story.
 * @returns {Promise<string>} The generated story text.
 */
async function generateStory(prompt) {
    const apiKey = config.GEMINI_API_KEY;
    
    if (!apiKey) {
        return "_❌ GEMINI_API_KEY not configured. Please set it up in your config file._";
    }

    const apiUrl = `${API_BASE_URL}${MODEL}${GENERATE_CONTENT_ENDPOINT}?key=${apiKey}`;

    // System instruction to ensure a high-quality story structure
    const systemPrompt = "You are a creative and engaging storyteller. Write a short, complete story based on the user's prompt. Ensure the story has a clear beginning, middle, and end, and uses descriptive language. Keep the story concise, around 3-5 paragraphs.";

    const userQuery = `Write a creative short story based on the following theme or prompt: "${prompt}"`;

    const payload = {
        contents: [{ 
            parts: [{ text: userQuery }] 
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

        // Extracts the text response from the Gemini API data structure
        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            return text;
        } else {
             return "_❌ Story generation failed. The model did not return any text. Try a different prompt._";
        }

    } catch (error) {
        console.error("Story generation API error:", error.message);
        // Extracts the specific error message from the API if available
        const errorMessage = error.response?.data?.error?.message || error.message;
        return `_❌ Error during story generation: ${errorMessage}_`;
    }
}


// --- Command Module Definition (.stry) ---

Module(
    {
        pattern: "stry ?(.*)",
        fromMe: false, // Set to true if you only want the bot to respond to your own messages
        desc: "Generates a short, creative story based on your prompt.",
        usage: '.stry [your theme or prompt]',
        type: 'ai'
    },
    async (message, match) => {
        const prompt = match[1]?.trim();

        // 1. Handle missing prompt
        if (!prompt) {
            return await message.sendReply(
                `📖 *Story Generator:*\n\n` +
                `To generate a story, use the command followed by a theme.\n\n` +
                `*Example:* \`.stry a boy and his dragon exploring an abandoned castle\``
            );
        }

        // 2. Initial feedback (Loading state)
        await message.sendReply(`✍️ _Crafting a story for: *${prompt}*..._`);

        try {
            const generatedStory = await generateStory(prompt);

            // 3. Final story delivery
            await message.sendReply(`*📖 Generated Story:*\n\n${generatedStory}`);
            
        } catch (error) {
            await message.sendReply(`_❌ An unexpected error occurred: ${error.message}_`);
        }
    }
);
