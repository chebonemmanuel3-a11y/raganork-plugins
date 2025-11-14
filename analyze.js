const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODEL = "gemini-2.5-flash-preview-09-2025"; 

// --- Analysis Schema Definition ---
// This schema forces the Gemini model to return a structured analysis object.
const ANALYSIS_SCHEMA = {
    type: "OBJECT",
    properties: {
        "sentiment": { "type": "STRING", "description": "The primary sentiment or tone of the message (e.g., Positive, Negative, Neutral, Confused, Urgent)." },
        "intention": { "type": "STRING", "description": "The core purpose of the message (e.g., Information Request, Statement, Command, Social Greeting, Complaint)." },
        "keyTopics": {
            "type": "ARRAY",
            "items": { "type": "STRING" },
            "description": "A list of 2-4 primary subjects or topics mentioned in the message."
        },
        "summary": { "type": "STRING", "description": "A concise, single-sentence summary of the message content." }
    },
    // Ensure all these fields are present in the final JSON object
    required: ["sentiment", "intention", "keyTopics", "summary"]
};


// --- Message Analysis Function ---

/**
 * Analyzes a given message text using the Gemini API to provide structured analysis.
 * @param {string} messageText - The text content of the message to analyze.
 * @returns {object|string} The parsed analysis object or an error message.
 */
async function analyzeMessage(messageText) {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
        return "_❌ GEMINI_API_KEY not configured. Please set it using `.setvar GEMINI_API_KEY your_api_key`_";
    }

    const apiUrl = `${API_BASE_URL}${MODEL}:generateContent?key=${apiKey}`;

    const userQuery = `Analyze the following user message: "${messageText}". Provide the analysis strictly in the requested JSON format.`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        generationConfig: {
            // Mandate JSON output
            responseMimeType: "application/json",
            responseSchema: ANALYSIS_SCHEMA,
            maxOutputTokens: 1024,
            temperature: 0.2, // Lower temperature for more objective analysis
        },
        // System instruction to guide the model's persona
        systemInstruction: {
            parts: [{ text: "You are a sophisticated text analyzer specializing in chat communication. Your analysis must be objective and strictly follow the JSON schema." }]
        },
    };

    try {
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
        });

        // Extract the JSON string from the response
        const jsonString = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (jsonString) {
            // Attempt to parse the JSON
            const analysis = JSON.parse(jsonString);
            // Basic validation to ensure the schema was respected
            if (analysis.sentiment && analysis.keyTopics && Array.isArray(analysis.keyTopics)) {
                return analysis;
            } else {
                return "_❌ AI generated incomplete data. Try refining the analysis request._";
            }
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
    pattern: "analyze ?(.*)",
    fromMe: true,
    desc: "Analyzes the sentiment, intention, and key topics of a message using Gemini AI.",
    usage: '.analyze Can you believe how fast the markets are moving today? I need to check my crypto portfolio ASAP.',
  },
  async (message, match) => {
    // We expect the text to analyze to be either the text after the command (.analyze text) 
    // or the text of a replied message.
    const textToAnalyze = match[1]?.trim() || message.quoted?.text;

    if (!textToAnalyze) {
      return await message.sendReply(
        `_Please provide a message to analyze or reply to a message!_\n\n` +
        `*Usage:* \`.analyze This is some text to analyze.\``
      );
    }

    await message.sendReply(`_Analyzing message: "${textToAnalyze.substring(0, 50)}..."_`);

    const analysisResult = await analyzeMessage(textToAnalyze);

    // If the result is a string, it's an error message
    if (typeof analysisResult === 'string') {
        return await message.sendReply(analysisResult);
    }

    // Format the successful JSON analysis into a readable message
    const analysisMessage = 
        `*🧠 Message Analysis Results 💬*\n\n` +
        `*📝 Original Message Summary:*\n${analysisResult.summary}\n\n` +
        `*📊 Data Points:*\n` +
        `• *Sentiment:* ${analysisResult.sentiment}\n` +
        `• *Intention:* ${analysisResult.intention}\n\n` +
        `*🏷️ Key Topics:*\n` +
        analysisResult.keyTopics.map((topic, index) => `• ${topic}`).join('\n');

    return await message.sendReply(analysisMessage);
  }
);
