const { Module } = require("../main");
const axios = require("axios");

// --- Configuration (Hardcoded Key) ---
// Using the key you provided, as we can't reliably load '../config'
const GEMINI_API_KEY = "AIzaSyCQjQ-Ln7UlAcqs6Ok5uJcsX2-R2YeRkWc"; 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

// --- System Instruction for Gemini ---
const SYSTEM_PROMPT = "You are a brief, helpful, and conversational AI assistant. Respond to the user's message with a single, short sentence. Do not use markdown (like bold or italics).";

// We are defining a module that listens for the 'text' event, just like the previous one,
// but with a cleaner, more robust implementation patterned after your command structure.
Module({
    on: 'text',
    fromMe: false // Only reply to messages from others
}, async (message) => {
    
    // 1. Check if the API Key is set
    if (!GEMINI_API_KEY) {
        return console.warn("[Gemini Auto-Reply] API key is not configured.");
    }

    // 2. CHECK: Only run in private chats (DMs)
    if (message.isGroup) {
        return; 
    }

    const msgText = (message.body || message.text || '').trim();
    if (!msgText) return; 

    // 3. CHECK: Skip if the message starts with a command prefix (e.g., .)
    const prefix = '.'; 
    if (msgText.startsWith(prefix)) {
        return; 
    }

    // 4. Construct the parts array for the API call
    const parts = [{ text: msgText }];

    try {
        const payload = { 
            contents: [{ parts }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: {
                maxOutputTokens: 50 // Keep the response short
            }
        };
        
        // --- API Call with Error Handling and Retries ---
        let response;
        for (let i = 0; i < 3; i++) { // Max 3 Retries (0, 1, 2)
            try {
                response = await axios.post(API_URL, payload, {
                    headers: { "Content-Type": "application/json" }
                });
                break; // Break loop on success
            } catch (error) {
                if (i === 2) throw error; // Re-throw if last attempt
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }

        const geminiReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (geminiReply) {
            await message.sendReply(geminiReply.trim());
        } else {
            console.warn("[Gemini Auto-Reply] Received an empty response from Gemini.");
        }

    } catch (error) {
        console.error(
            "[Gemini Auto-Reply] API Error:",
            error.response ? error.response.data : error.message
        );
        // Do not send an error reply to the user.
    }
});
