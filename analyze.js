const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
// Using the model you specified.
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODEL = "gemini-2.5-flash";

// --- JSON Schema Definition (Ensures structured analysis) ---
const analysisSchema = {
    type: "OBJECT",
    properties: {
        "topicSummary": { "type": "STRING", "description": "A concise summary of the message's main topic or intent." },
        "sentiment": { "type": "STRING", "description": "The overall sentiment, strictly categorized as 'Positive', 'Negative', 'Neutral', or 'Mixed'." },
        "responseSuggestion": { "type": "STRING", "description": "A brief, appropriate suggestion for a human response." },
        "keywords": {
            "type": "ARRAY",
            "items": { "type": "STRING" },
            "description": "3 to 5 key terms from the message."
        }
    },
    "propertyOrdering": ["topicSummary", "sentiment", "responseSuggestion", "keywords"]
};


/**
 * Analyzes the text content using the Gemini API and returns structured JSON.
 * @param {string} textToAnalyze - The message text to be analyzed.
 * @returns {object|string} The parsed analysis object or an error message.
 */
async function analyzeMessage(textToAnalyze) {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
        return "_❌ GEMINI_API_KEY not configured. Please set it using `.setvar GEMINI_API_KEY your_api_key`_";
    }

    const apiUrl = `${API_BASE_URL}${MODEL}:generateContent?key=${apiKey}`;

    const userQuery = `Analyze the following WhatsApp message strictly according to the provided JSON schema.`;

    const payload = {
        contents: [{
            parts: [
                { text: userQuery },
                { text: `\n\n--- Message to Analyze ---\n${textToAnalyze}` }
            ]
        }],
        generationConfig: {
            // Mandate JSON output
            responseMimeType: "application/json",
            responseSchema: analysisSchema,
            maxOutputTokens: 512,
            temperature: 0.2,
        },
        systemInstruction: {
            parts: [{ text: "You are a professional message sentiment and topic analyst. Your analysis must be purely in the requested JSON format." }]
        },
    };

    try {
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
        });

        const jsonString = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (jsonString) {
            // Attempt to clean and parse the JSON, handling common errors like extra markdown wrappers
            let cleanJsonString = jsonString.trim();
            if (cleanJsonString.startsWith('```json')) {
                cleanJsonString = cleanJsonString.substring(7);
            }
            if (cleanJsonString.endsWith('```')) {
                cleanJsonString = cleanJsonString.substring(0, cleanJsonString.length - 3);
            }

            const analysis = JSON.parse(cleanJsonString);
            return analysis;
        } else {
            return "_❌ AI could not generate a valid JSON analysis. Try a different message._";
        }
    } catch (error) {
        console.error("Message analysis error:", error.message);
        if (error.response) {
            return `_❌ API Error: ${error.response.data?.error?.message || "Unknown API error"}_`;
        }
        return "_❌ Network or Parsing error. Please check your API key and retry._";
    }
}

// --- Command Module Definition (.analyze) ---

Module(
    {
        // CHANGE 1: Allow optional text after the command using ?(.*)
        pattern: "analyze ?(.*)",
        fromMe: true,
        desc: "Analyzes the sentiment and topic of a message using Gemini AI. Works via reply or direct text.",
        usage: 'Reply to any message with `.analyze` OR type `.analyze [your text here]`',
    },
    async (message, match) => {
        // Text provided directly after the command
        const commandText = match[1]?.trim();

        // Text from the replied message (using the property you confirmed works)
        const replyText = message.reply_message?.text;

        // CHANGE 2: Prioritize the reply text, then fallback to the command text
        const textToAnalyze = replyText || commandText;

        if (!textToAnalyze) {
            // Updated error message to reflect dual usage
            return await message.sendReply(
                `_Please provide a message to analyze or reply to a message!_\n\n` +
                `*Usage:* \`.analyze This is some text to analyze.\` or *reply* to a message with \`.analyze\``
            );
        }

        // Shorten the message for the loading indicator
        const previewText = textToAnalyze.length > 50 ? textToAnalyze.substring(0, 50) + "..." : textToAnalyze;
        await message.sendReply(`_Analyzing: "${previewText}" using structured output..._`);

        const analysisResult = await analyzeMessage(textToAnalyze);

        // If the result is a string, it's an error message
        if (typeof analysisResult === 'string') {
            return await message.sendReply(analysisResult);
        }

        // Format the successful JSON analysis into a readable WhatsApp message
        const formattedResult =
            `*💬 Message Analysis (Gemini AI) 📊*\n\n` +
            `*📈 Sentiment:* ${analysisResult.sentiment}\n` +
            `*💡 Topic Summary:* ${analysisResult.topicSummary}\n\n` +
            `*🔑 Keywords:* ${analysisResult.keywords.join(', ')}\n\n` +
            `*✍️ Suggested Response:* _${analysisResult.responseSuggestion}_`;

        return await message.sendReply(formattedResult);
    }
);
