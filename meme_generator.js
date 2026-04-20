const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
// Updated to your confirmed working model
const MODEL = "gemini-2.5-flash-lite"; 
const GENERATE_CONTENT_ENDPOINT = ":generateContent";

/**
 * Calls the Gemini API to generate meme captions in English, Swahili, and Sheng.
 * @param {string} prompt - The theme or scenario for the meme.
 */
async function generateMemeCaption(prompt) {
    const apiKey = config.GEMINI_API_KEY;
    
    if (!apiKey) {
        return "_❌ GEMINI_API_KEY not configured. Set it up to use this feature._";
    }

    const apiUrl = `${API_BASE_URL}${MODEL}${GENERATE_CONTENT_ENDPOINT}?key=${apiKey}`;

    // System instruction to guide the model's persona (Sheng/Swahili focus)
    const systemPrompt = "You are a hilarious, culturally aware meme generator specializing in East African humor, especially Kenyan. The user will provide a scenario. Your response must be three distinct, funny, and short meme captions. Use a mix of English, Kiswahili, and Sheng (e.g., 'Kimeumana!', 'Wueh!', 'Aki si umenichoma!'). Ensure the humor is relatable and current.";

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
             return "_❌ Meme generation failed. The model did not return any text._";
        }

    } catch (error) {
        console.error("Meme generation API error:", error.message);
        const errorMessage = error.response?.data?.error?.message || error.message;
        return `_❌ Error: ${errorMessage}_`;
    }
}


// --- Command Module Definition (.meme) ---

Module(
    {
        pattern: "meme ?(.*)",
        fromMe: false, // Set to false so your group members can also laugh
        desc: "Generates hilarious meme captions in English, Kiswahili, and Sheng.",
        usage: '.meme [your scenario]',
        type: 'fun'
    },
    async (message, match) => {
        const prompt = match[1]?.trim();

        if (!prompt) {
            return await message.sendReply(
                `😂 *Meme Generator: Jibebe!* 😂\n\n` +
                `Provide a relatable scenario.\n\n` +
                `*Example:* \`.meme when salary lands then vanishes in 2 minutes\``
            );
        }

        await message.sendReply(`😂 _Leta maneno... Generating captions for: *${prompt}*..._`);

        try {
            const generatedCaptions = await generateMemeCaption(prompt);
            await message.sendReply(`*😂 Hapa ni meme zako:*\n\n${generatedCaptions}`);
        } catch (error) {
            await message.sendReply(`_❌ Error: ${error.message}_`);
        }
    }
);
