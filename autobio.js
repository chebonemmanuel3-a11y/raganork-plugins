// autobio.js — Auto Bio plugin for Raganork-MD

let { Module } = require('../main')
const axios = require('axios')

// --- Configuration and State ---
const INTERVAL_MS = 1000 * 60 * 10 // Update every 10 minutes
const QUOTE_API = 'https://zenquotes.io/api/random' // New, working API

let autoBioEnabled = false 
let intervalId = null     

// --- Core Logic Function ---
// Fetches a new quote, cleans it, and updates the WhatsApp status.
const updateBio = async (client) => {
    try {
        if (!client) {
            console.warn("[autobio] updateBio called without client object. Skipping update.");
            return;
        }

        const res = await axios.get(QUOTE_API)
        
        // ZenQuotes returns an array of one object: [{q: quote, a: author}]
        const data = res.data[0]; 
        
        if (!data || !data.q || !data.a) {
            console.warn("[autobio] API returned empty or invalid data.");
            return;
        }

        // Clean HTML tags and common entities (like &quot;)
        const cleanText = (text) => {
            return text.replace(/<[^>]*>/g, '') // Strip HTML tags
                       .replace(/&quot;/g, '"') // Replace HTML entity for double quote
                       .replace(/&dash;/g, '—')  // Replace HTML entity for dash
                       .trim();
        };

        const quote = cleanText(data.q);
        const author = cleanText(data.a);
        
        const newBio = `${quote} — ${author}`.slice(0, 139) // WhatsApp bio limit is 139 chars

        if (typeof client.updateProfileStatus === "function") {
            await client.updateProfileStatus(newBio)
            console.log(`[autobio] Updated bio -> ${newBio}`)
        } else {
            console.warn("[autobio] updateProfileStatus not available on client.")
        }
    } catch (err) {
        console.error("[autobio] Error fetching or setting bio:", err.message)
    }
}


// --- 1. Start Command (.autobio on) ---
Module({ 
    pattern: "autobio on", 
    fromMe: true,
    desc: "Enable auto bio updates (every 10 min)", 
    type: "utility" 
}, async (message) => {
    if (autoBioEnabled) {
        return await message.sendReply("_Auto Bio already running._")
    }
    
    // Set the state
    autoBioEnabled = true

    // 1. Run once immediately
    await updateBio(message.client)

    // 2. Set the interval. 
    intervalId = setInterval(() => {
        if (autoBioEnabled) {
            updateBio(message.client) 
        } else {
            // Self-cleanup
            clearInterval(intervalId)
            intervalId = null;
        }
    }, INTERVAL_MS)
    
    await message.sendReply("✅ Auto bio ENABLED. Updates every 10 minutes.")
});


// --- 2. Stop Command (.autobio off) ---
Module({
    pattern: "autobio off",
    fromMe: true,
    desc: "Disable auto bio",
    type: "utility"
}, async (message) => {
    if (!autoBioEnabled) {
        return await message.sendReply("_Auto Bio not active._")
    }
    
    autoBioEnabled = false
    clearInterval(intervalId)
    intervalId = null
    
    await message.sendReply("🛑 Auto bio DISABLED.")
});
