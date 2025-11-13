// autodp.js — Auto Display Picture (Profile Picture) Updater

const { Module } = require('../main');
const axios = require('axios');
const Jimp = require('jimp'); // Make sure you have installed: npm install jimp
const fs = require('fs').promises; // For temporary file handling (optional, but safer)

// --- Configuration and State ---
const INTERVAL_MS = 1000 * 60 * 2; // Update every 2 minutes (adjust as needed)
const IMAGE_API = 'https://picsum.photos/720/720'; // A reliable source for random images
// Alternative API examples:
// 'https://source.unsplash.com/random/720x720' // Good but might have rate limits
// 'https://loremflickr.com/720/720' // Another random image source

let autoDpEnabled = false;
let intervalId = null;
const BRANDING = "\n\n— powered by gemini & Emmanuel"; // Including branding as requested

// --- Core Logic Function ---
// Fetches a new image, processes it to 720x720, and updates the DP.
const updateDP = async (client) => {
    try {
        if (!client) {
            console.warn("[autodp] updateDP called without client object. Skipping update.");
            return;
        }

        console.log("[autodp] Attempting to fetch new DP...");

        // 1. Fetch a random image
        const imageResponse = await axios.get(IMAGE_API, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data);

        // 2. Process the image with Jimp
        const image = await Jimp.read(imageBuffer);

        // Ensure the image is square and resize to 720x720
        // Jimp.cover will resize and crop to fill the dimensions
        image.cover(720, 720); 

        // Convert the processed image back to a buffer (JPEG for smaller size, or PNG)
        const processedImageBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

        // 3. Update WhatsApp Profile Picture
        if (typeof client.updateProfilePicture === "function") {
            await client.updateProfilePicture(processedImageBuffer);
            console.log(`[autodp] Successfully updated DP.`);
        } else {
            console.warn("[autodp] updateProfilePicture not available on client. WhatsApp client may not support this API version or method.");
        }

    } catch (err) {
        console.error("[autodp] Error in updating DP:", err);
        // Optionally, send a message to the owner about the failure
        // if (client && botConfig.OWNER_JID) {
        //     await client.sendMessage(botConfig.OWNER_JID, { text: `❌ Auto DP update failed: ${err.message}` });
        // }
    }
};


// --- 1. Start Command (.autodp on) ---
Module({ 
    pattern: "autodp on", 
    fromMe: true, // Only bot owner should enable this for the bot itself
    desc: "Enable auto DP updates (every 2 min)", 
    type: "utility" 
}, async (message) => {
    if (autoDpEnabled) {
        return await message.sendReply("_Auto DP already running._")
    }
    
    autoDpEnabled = true

    // 1. Run once immediately
    await updateDP(message.client)

    // 2. Set the interval
    intervalId = setInterval(() => {
        if (autoDpEnabled) {
            updateDP(message.client) 
        } else {
            // Self-cleanup for the interval
            clearInterval(intervalId)
            intervalId = null;
        }
    }, INTERVAL_MS)
    
    await message.sendReply("✅ Auto DP ENABLED. Updates every 2 minutes." + BRANDING)
});


// --- 2. Stop Command (.autodp off) ---
Module({
    pattern: "autodp off",
    fromMe: true,
    desc: "Disable auto DP",
    type: "utility"
}, async (message) => {
    if (!autoDpEnabled) {
        return await message.sendReply("_Auto DP not active._")
    }
    
    autoDpEnabled = false
    clearInterval(intervalId)
    intervalId = null
    
    await message.sendReply("🛑 Auto DP DISABLED." + BRANDING)
});
