// autodp.js — Auto Display Picture (Profile Picture) Updater

const { Module } = require('../main');
const axios = require('axios');
const Jimp = require('Jimp'); // Ensure JIMP is correctly capitalized or lowercase based on your npm install
const fs = require('fs').promises;

// --- Configuration and State ---
const INTERVAL_MS = 1000 * 60 * 2; // Fixed to 2 minutes (1000ms * 60s * 2min)
const IMAGE_API = 'https://picsum.photos/720/720'; 

let autoDpEnabled = false;
let intervalId = null;
const BRANDING = "\n\n— powered by gemini & Emmanuel"; 

// --- Core Logic Function ---
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
        image.cover(720, 720); // Resize and crop to 720x720 square
        const processedImageBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

        // 3. Update WhatsApp Profile Picture
        if (typeof client.updateProfilePicture === "function") {
            // CRITICAL FIX: The error is caused by missing the JID. 
            // We pass the bot's JID and the processed image buffer.
            const botJID = client.user.id || client.user.jid; 
            
            if (!botJID) {
                console.error("[autodp] Could not find bot's JID to set profile picture.");
                return;
            }

            await client.updateProfilePicture(botJID, processedImageBuffer); 
            
            console.log(`[autodp] Successfully updated DP for ${botJID.split('@')[0]}`);
        } else {
            console.warn("[autodp] updateProfilePicture not available on client.");
        }

    } catch (err) {
        // Log the full error, but suppress the 'stream' error if it's the JID issue
        if (err.message && err.message.includes("'stream' in undefined")) {
            console.error("[autodp] Error updating DP: JID or image buffer format likely incorrect. Retrying on next interval.");
        } else {
            console.error("[autodp] General Error in updating DP:", err);
        }
    }
};


// --- 1. Start Command (.autodp on) ---
Module({ 
    pattern: "autodp on", 
    fromMe: true, 
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
