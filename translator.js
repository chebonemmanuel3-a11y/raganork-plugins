// --- REQUIRED MODULES AND CONFIGURATION ---
const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODEL = "gemini-2.5-flash-preview-09-2025";
const GENERATE_CONTENT_ENDPOINT = ":generateContent";

// --- Language Aliases ---
const languageMap = {
    'en': 'English',
    'sw': 'Kiswahili',
    'sheng': 'Sheng (Nairobi Slang)',
    'fr': 'French',
    'es': 'Spanish',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ko': 'Korean',
    'jp': 'Japanese',
    'zh': 'Chinese (Mandarin)',
    'hi': 'Hindi',
};
const SUPPORTED_LANGS = Object.keys(languageMap).map(alias => `\`${alias}\``).join(', ');


/**
 * Performs the translation API call using Axios, implementing exponential backoff for retries.
 */
async function callGeminiTranslation(sourceText, targetLanguage) {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing in config. Cannot proceed with translation.");
    }

    const apiUrl = `${API_BASE_URL}${MODEL}${GENERATE_CONTENT_ENDPOINT}?key=${apiKey}`;

    const systemPrompt = `You are an expert, multilingual translator. 
        Translate the provided text into the target language: ${targetLanguage}.
        If the target language is a specific dialect or slang (like Sheng), use modern, appropriate, and witty expressions for that language.
        Provide only the raw translated text as your output, without any introductory phrases, explanations, or labels.`;

    const userQuery = `Translate the following text: "${sourceText}"`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };

    let attempts = 0;
    const MAX_ATTEMPTS = 4;
    let finalError = null;

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        try {
            const response = await axios.post(apiUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 20000, 
            });

            const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                return text.trim();
            }
            throw new Error("API response was successful but contained no text in the expected format.");
        } catch (error) {
            finalError = error;
            if (((error.response && error.response.status === 429) || error.code === 'ECONNABORTED') && attempts < MAX_ATTEMPTS) {
                const delay = Math.pow(2, attempts) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                break;
            }
        }
    }

    const errorDetails = finalError.response ? JSON.stringify(finalError.response.data.error || finalError.response.data) : finalError.message;
    throw new Error(`Translation API call failed after ${attempts} attempts. Details: ${errorDetails}`);
}


// --- Command Module Definition (.trans) ---
Module(
    {
        pattern: "trans(.*)",
        fromMe: true, 
        desc: "Contextual language translation using Gemini.",
        usage: '.trans <text> <lang> | (reply) .trans <lang>',
    },
    async (message, match) => {
        let sourceText = '';
        let targetLanguageAlias = '';
        let originalTextContext = '';

        const fullInput = match[1]?.trim() || '';
        const args = fullInput.split(/\s+/).filter(a => a.length > 0);

        // --- IMPROVED FIX: Ensure repliedTo exists and has text, and simplify argument parsing ---
        // This explicitly checks that message.repliedTo.text is a string before accessing it, 
        // which prevents the JID object from being processed as a string, fixing the error.
        const repliedToText = (message.repliedTo && typeof message.repliedTo.text === 'string' && message.repliedTo.text.trim().length > 0) 
            ? message.repliedTo.text.trim() 
            : null;

        // Case 1: Reply translation: .trans <language> (e.g., .trans sw)
        if (repliedToText && args.length === 1) {
            sourceText = repliedToText;
            targetLanguageAlias = args[0].toLowerCase();
            originalTextContext = `_Original Text (via reply):_ "${repliedToText.substring(0, Math.min(repliedToText.length, 50))}..."`;

        } 
        // Case 2: Inline translation: .trans <text> <language> (e.g., .trans my mother sw)
        else if (args.length >= 2) {
            targetLanguageAlias = args[args.length - 1].toLowerCase();
            sourceText = args.slice(0, args.length - 1).join(' ');
            originalTextContext = `_Original Text (inline):_ "${sourceText.substring(0, Math.min(sourceText.length, 50))}..."`;

        } 
        // Invalid usage or only one word provided without reply
        else {
            return await message.sendReply(
                `❌ **Invalid Usage.** Use: \`.trans <text> <lang>\` or reply to a message with \`.trans <lang>\`.\n\n` +
                `**Supported Language Codes:** ${SUPPORTED_LANGS}\n` +
                `_Example: .trans hello world sw_`
            );
        }

        if (!sourceText) {
            return await message.sendReply("❌ **Error:** I couldn't find any text to translate.");
        }

        const targetLanguage = languageMap[targetLanguageAlias] || targetLanguageAlias;
        const waitingMessage = await message.sendReply(`🌍 _Translating to *${targetLanguage}*..._`);

        try {
            const translation = await callGeminiTranslation(sourceText, targetLanguage);

            const responseMessage =
                `${originalTextContext}\n\n` +
                `*✅ Translation to ${targetLanguage}*\n` +
                `> ${translation}`;

            return await message.edit(responseMessage, waitingMessage.key);

        } catch (error) {
            console.error("TRANSLATION MODULE ERROR:", error.message);
            return await message.edit(`❌ **Translation Failed:** ${error.message.substring(0, Math.min(error.message.length, 100))}...`, waitingMessage.key);
        }
    }
);
