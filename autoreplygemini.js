const { Module } = require('../main');
const axios = require('axios'); // This will be auto-installed by your index.js

// --- Configuration ---
const apiKey = "AIzaSyCQjQ-Ln7UlAcqs6Ok5uJcsX2-R2YeRkWc"; // Your hardcoded key
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// --- System Instruction for Gemini ---
const SYSTEM_PROMPT = "You are a brief, helpful, and highly conversational AI assistant. Respond to the user's message with a single, short sentence. Do not use markdown (like bold or italics) and keep your tone friendly and direct. Respond in the same language as the user's message.";

// This is the global listener module, structured like the old Gist plugin
Module({
    on: 'text', // Listen for all text messages
    fromMe: false // Trigger on messages from others
}, async (message) => {
    
    // 1. CHECK: Only run in private chats (DMs)
    if (message.isGroup) {
        return; 
    }

    // 2. Extract the message text
    const msgText = (message.body || message.text || '').trim();
    if (!msgText) return; // Skip empty messages

    // 3. CHECK: Skip if the message starts with the command prefix (e.g., .)
    const prefix = '.'; // Adjust if your prefix is different
    if (msgText.startsWith(prefix)) {
        return; 
    }

    try {
        // Prepare the API payload
        const payload = {
            contents: [{ parts: [{ text: msgText }] }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: { // Use generationConfig
                maxOutputTokens: 50 
            }
        };

        // --- Exponential Backoff Fetch Logic ---
        const maxRetries = 3;
        let response;

        for (let i = 0; i < maxRetries; i++) {
            try {
                response = await axios.post(apiUrl, payload, {
                    headers: { 'Content-Type': 'application/json' }
                });
                break; // Success!
            } catch (error) {
                if (i < maxRetries - 1) {
                    const delay = Math.pow(2, i) * 1000; // 1s, 2s
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error; // All retries failed
                }
            }
        }
        
        const result = response.data;
        const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText) {
            // Send the short, precise reply
            await message.sendReply(generatedText.trim());
        } else {
            console.warn("[Gemini Auto-Reply] API returned no text content.");
        }

    } catch (e) {
        console.error("[Gemini Auto-Reply] Fatal error:", e.message);
        // We won't send an error reply to keep the chat clean
    }
});
