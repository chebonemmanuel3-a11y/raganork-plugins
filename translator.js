// --- REQUIRED MODULES AND CONFIGURATION ---
// These files are assumed to exist in your bot's framework based on your input structure.
const { Module } = require("../main"); 
const config = require("../config"); 
const axios = require("axios");

// --- API Configuration ---
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODEL = "gemini-2.5-flash-preview-09-2025";
const GENERATE_CONTENT_ENDPOINT = ":generateContent";
const API_URL = `${API_BASE_URL}${MODEL}${GENERATE_CONTENT_ENDPOINT}`;

// The API key is assumed to be stored in your configuration file.
const API_KEY = config.GEMINI_API_KEY; 
if (!API_KEY) {
    console.error("CRITICAL: GEMINI_API_KEY is not defined in the config file. Translator will fail.");
}

// --- Language Aliases ---
const languageMap = {
    'en': 'English',
    'sw': 'Kiswahili',
    'sheng': 'Sheng (Nairobi Slang)',
    'fr': 'French',
    'es': 'Spanish',
    'de': 'German',
    'pt': 'Portuguese',
    'ko': 'Korean',
    'jp': 'Japanese',
    // Add more language aliases as needed
};


/**
 * Performs the translation API call using Axios, implementing exponential backoff for retries.
 * @param {string} sourceText The text to be translated.
 * @param {string} targetLanguage The resolved target language name.
 * @returns {Promise<string>} The translated text.
 */
async function callGeminiTranslation(sourceText, targetLanguage) {
    if (!API_KEY) {
        throw new Error("API Key is missing. Please check your config file.");
    }
    
    const systemPrompt = `You are an expert, multilingual translator. 
        Translate the provided text into the target language: ${targetLanguage}.
        If the target language is Sheng, use modern, witty Nairobi slang and provide only the translation.
        Provide only the raw translated text as your output, without any introductory phrases, explanations, or labels (e.g., do not say "The translation is...").`;

    const userQuery = `Translate the following text: "${sourceText}"`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        }
    };

    let attempts = 0;
    const MAX_ATTEMPTS = 4;
    let finalError = null;

    while (attempts < MAX_ATTEMPTS) {
        attempts++;
        try {
            const response = await axios.post(
                API_URL, 
                payload, 
                {
                    // Pass the API key as a query parameter for authentication
                    params: { key: API_KEY } 
                }
            );
            
            const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                return text;
            }
            throw new Error("API response was successful but contained no text.");
        } catch (error) {
            finalError = error;
            // Handle rate limiting (429) with exponential backoff
            if (error.response && error.response.status === 429 && attempts < MAX_ATTEMPTS) {
                const delay = Math.pow(2, attempts) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                // Exit loop on other errors or max attempts
                break;
            }
        }
    }
    
    // Throw the final error if all attempts failed
    const errorDetails = finalError.response ? JSON.stringify(finalError.response.data.error || finalError.response.data) : finalError.message;
    throw new Error(`Translation API call failed after ${attempts} attempts. Details: ${errorDetails}`);
}


/**
 * Defines and exports the .trans command structure for the bot.
 */
module.exports = new Module({
    name: "Translator",
    cmd: "trans",
    desc: "Contextual language translation using Gemini.",
    usage: "<text> <lang> | <lang> (when replying to a message)",
    
    // The main execution function for the command
    async exec({ message, args }) {
        let sourceText = '';
        let targetLanguageAlias = '';
        let originalTextContext = '';

        // Check for replied-to message content. Assuming 'message.repliedTo' holds the message object.
        const repliedToText = message.repliedTo && message.repliedTo.text ? message.repliedTo.text.trim() : null;

        if (repliedToText && args.length === 1) {
            // Case 1: Reply translation: .trans <language>
            sourceText = repliedToText;
            targetLanguageAlias = args[0].toLowerCase();
            originalTextContext = `_Original Text (via reply):_ "${repliedToText}"`;

        } else if (args.length >= 2) {
            // Case 2: Inline translation: .trans <text> <language>
            targetLanguageAlias = args[args.length - 1].toLowerCase();
            // The rest of the arguments are the source text
            sourceText = args.slice(0, args.length - 1).join(' ');
            originalTextContext = `_Original Text (inline):_ "${sourceText}"`;
            
        } else {
            // Invalid usage
            const availableLangs = Object.keys(languageMap).map(alias => `\`${alias}\``).join(', ');
            return message.reply(`❌ **Invalid Usage.** Use: \`.trans <text> <lang>\` or reply with \`.trans <lang>\`.\n**Supported Codes:** ${availableLangs}`);
        }

        if (!sourceText) {
            return message.reply("❌ **Error:** I couldn't find any text to translate.");
        }
        
        // Resolve the target language name
        const targetLanguage = languageMap[targetLanguageAlias] || targetLanguageAlias;

        try {
            // You can add a 'message.typing()' or 'message.sendProcessing()' here if your bot supports it.
            
            const translation = await callGeminiTranslation(sourceText, targetLanguage);
            
            // Construct the final reply message
            const responseMessage = 
                `${originalTextContext}\n\n` +
                `**[Translation to ${targetLanguage}]**\n` +
                `> ${translation}`;
            
            return message.reply(responseMessage);

        } catch (error) {
            console.error("TRANSLATION MODULE ERROR:", error.message);
            // Provide a friendly error message to the user
            return message.reply(`❌ **Translation Failed:** Could not complete the request. Details: ${error.message.substring(0, 100)}...`);
        }
    }
});
