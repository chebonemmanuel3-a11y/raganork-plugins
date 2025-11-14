const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODEL = "gemini-2.5-flash-preview-09-2025";


/**
 * Calls the Gemini API to rewrite a message based on a provided style/instruction.
 * @param {string} text - The text content to rewrite.
 * @param {string} instruction - The instruction for rewriting (e.g., "in a pirate voice", "make it formal").
 * @returns {string} The rewritten text.
 */
async function rewriteText(text, instruction) {
    const apiKey = config.GEMINI_API_KEY;
    
    if (!apiKey) {
        return "_❌ GEMINI_API_KEY not configured. Please set it using `.setvar GEMINI_API_KEY your_api_key`_";
    }

    const apiUrl = `${API_BASE_URL}${MODEL}:generateContent?key=${apiKey}`;

    const systemPrompt = `You are a professional text rewriter and editor. Your sole task is to take the provided text and rewrite it exactly according to the user's specific instruction. Your output must contain ONLY the rewritten text, with no preamble, explanation, or conversational filler.`;

    const userQuery = `Original Text: "${text}"\n\nInstruction for Rewriting: ${instruction}`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            temperature: 0.7, // Higher temperature for more creative rewriting
            maxOutputTokens: 1024,
        }
    };

    try {
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
        });

        const resultText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
             return "_❌ Error: Could not generate the rewritten text._";
        }
        
        return `✍️ *Rewritten Content:*\n\n${resultText.trim()}`;

    } catch (error) {
        console.error("Rewrite retrieval error:", error.message);
        if (error.response) {
            return `_❌ API Error (${error.response.status}): ${error.response.data?.error?.message || "Unknown API error"}_`;
        }
        return "_❌ Network error. Please confirm your API key is valid._";
    }
}


// --- Command Module Definition (.rewrite) ---

Module(
    {
        pattern: "rewrite (.+?)\\|(.+)",
        fromMe: true,
        desc: "Rewrites text based on a specified style, tone, or instruction.",
        usage: '.rewrite [instruction] | [text to rewrite]',
    },
    async (message, match) => {
        // match[1] is the instruction, match[2] is the text
        const instruction = match[1]?.trim();
        const textToRewrite = match[2]?.trim();

        if (!instruction || !textToRewrite) {
            return await message.sendReply(
                `_Please provide both the instruction and the text, separated by a pipe (|) character._\n\n` +
                `*Usage:* \`.rewrite make it sound extremely excited | The meeting is cancelled.\``
            );
        }

        await message.sendReply(`_Rewriting text with instruction: *${instruction}*..._`);

        const rewrittenResult = await rewriteText(textToRewrite, instruction);

        return await message.sendReply(rewrittenResult);
    }
);
