const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODEL = "gemini-2.5-flash-preview-09-2025";


/**
 * Fetches lyrics for a given song query using the Gemini API with Google Search grounding.
 * @param {string} songQuery - The song title and artist (e.g., "Bohemian Rhapsody by Queen").
 * @returns {string} The formatted lyrics with sources, or an error message.
 */
async function getSongLyrics(songQuery) {
    const apiKey = config.GEMINI_API_KEY;

    // --- API Setup for Google Search Grounding ---
    const apiUrl = `${API_BASE_URL}${MODEL}:generateContent?key=${apiKey}`;

    const userQuery = `Find the complete, accurate lyrics for the song: "${songQuery}". Format the lyrics clearly with stanza breaks. Do not include any introductory or concluding text, only the lyrics themselves, followed by the source citations.`;

    const systemPrompt = "You are a specialized lyrics retrieval assistant. Your primary function is to extract and present song lyrics based on the user's query and the grounded search results.";

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],

        // Enable Google Search grounding
        tools: [{ "google_search": {} }],

        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
        }
    };

    try {
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 20000,
        });

        const candidate = response.data?.candidates?.[0];

        if (!candidate) {
             return "_❌ Error: Could not retrieve a response from the API. The song might be too obscure or the query format is invalid._";
        }

        let text = candidate.content?.parts?.[0]?.text;

        if (!text) {
             // This is the error from your original screenshot
             return "_❌ Error: Could not extract lyrics text._";
        }

        // --- Source Extraction ---
        let sources = [];
        const groundingMetadata = candidate.groundingMetadata;
        if (groundingMetadata && groundingMetadata.groundingAttributions) {
            sources = groundingMetadata.groundingAttributions
                .map(attribution => ({
                    uri: attribution.web?.uri,
                    title: attribution.web?.title,
                }))
                .filter(source => source.uri && source.title); // Ensure sources are valid
        }

        let formattedSources = "";
        if (sources.length > 0) {
            formattedSources = "\n\n--- 🎼 Sources ---\n" +
                sources.map((s, index) => `[${index + 1}] ${s.title} (${s.uri})`).join('\n');
        }

        return `*🎶 Lyrics for: ${songQuery} 🎶*\n\n${text}${formattedSources}`;

    } catch (error) {
        console.error("Lyrics retrieval error:", error.message);
        if (error.response) {
            return `_❌ API Error: ${error.response.data?.error?.message || "Unknown API error"}_`;
        }
        // This is the error you are currently seeing
        return "_❌ Network error. Please check your API key and retry._";
    }
}


// --- Command Module Definition (.lyrics) ---

Module(
    {
        pattern: "lyrics (.*)",
        fromMe: true,
        desc: "Retrieves song lyrics using Gemini AI with Google Search grounding.",
        usage: '.lyrics [Song Title] by [Artist]',
    },
    async (message, match) => {
        const songQuery = match[1]?.trim();

        if (!songQuery) {
            return await message.sendReply(
                `_Please provide the song title and artist to search for lyrics._\n\n` +
                `*Usage:* \`.lyrics Purple Haze by Jimi Hendrix\``
            );
        }

        await message.sendReply(`_Searching for lyrics for: *${songQuery}*... This may take a moment._`);

        const lyricsResult = await getSongLyrics(songQuery);

        return await message.sendReply(lyricsResult);
    }
);
