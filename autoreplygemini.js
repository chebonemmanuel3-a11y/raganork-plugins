const { Module } = require('../main');
const axios = require('axios');

// --- Configuration ---
// The API key has been hardcoded as requested.
const apiKey = "AIzaSyCQjQ-Ln7UlAcqs6Ok5uJcsX2-R2YeRkWc"; 
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// --- System Instruction for Gemini ---
// This tells the model exactly how to respond: short, direct, and conversational.
const SYSTEM_PROMPT = "You are a brief, helpful, and highly conversational AI assistant. Respond to the user's message with a single, short sentence. Do not use markdown (like bold or italics) and keep your tone friendly and direct. Respond in the same language as the user's message.";

// --- Command Listener (Runs on all non-command messages) ---
Module({
    desc: 'Uses the Gemini API to generate short, precise, non-command responses. Only works in private chats.',
    type: 'ai'
}, async (message) => {
    
    // 1. Skip if the message is from me or is empty
    if (message.fromMe) return;
    
    // 2. CHECK: Only run in private chats (message.isGroup is a common property in these frameworks)
    if (message.isGroup) {
        return; 
    }

    // 3. Extract the message text
    const msgText = (message.body || message.text || '').trim();
    if (!msgText) return;

    // 4. CHECK: Skip if the message starts with the command prefix (e.g., .) 
    // This allows users to still use commands like .menu without triggering the AI reply.
    const prefix = '.'; 
    if (msgText.startsWith(prefix)) {
        return; 
    }

    try {
        // Prepare the API payload
        const payload = {
            contents: [{ parts: [{ text: msgText }] }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }],
            // Adding a max token limit helps ensure the response is short
            config: {
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
                break; // Success! Break the retry loop
            } catch (error) {
                if (i < maxRetries - 1) {
                    const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
                    // console.warn(`API call failed, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error; // Throw the error if all retries fail
                }
            }
        }
        
        const result = response.data;
        const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText) {
            // Trim and send the response
            await message.sendReply(generatedText.trim());
        } else {
            // console.warn("Gemini API returned no text content.");
        }

    } catch (e) {
        // console.error("Fatal error during Gemini auto-reply:", e.message);
        // Optionally, send a silent fallback reply to the user if the API fails often
        // await message.sendReply("I'm having a brief connection issue, try again in a moment!");
    }
});
```eof

**Action:** After saving this, **restart your bot** one last time to make the new API key active.
