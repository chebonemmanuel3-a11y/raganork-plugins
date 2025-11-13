// dp_manager_light.js — Two-step Profile Picture Management (NO JIMP)

const { Module } = require('../main');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createReadStream } = require('fs');
const { fetchBuffer } = require('../lib/functions'); // Utility to fetch media buffer

// --- Constants & Configuration ---
// We'll save the raw downloaded file here
const DP_FILE_PATH = path.join(__dirname, 'pending_dp_image.jpg'); 
const BRANDING = "\n\n— powered by gemini & Emmanuel";

// --- 1. Command: .getdp (Download & Save Image) ---
Module({
    pattern: 'getdp ?(.*)',
    fromMe: true,
    desc: 'Downloads an image (from reply or URL) and saves it locally for DP update.',
    type: 'utility'
}, async (message, match) => {
    
    let imageUrl = match[1]?.trim();
    let mediaBuffer = null;

    // --- 1. Find Image Source ---
    if (message.quoted && (message.quoted.image || message.quoted.mimetype?.startsWith('image'))) {
        mediaBuffer = await fetchBuffer(message.quoted);
    } else if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('https'))) {
        try {
            // Download the image buffer directly
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            mediaBuffer = Buffer.from(response.data);
        } catch (e) {
            return await message.sendReply("❌ Failed to download image from the provided URL.");
        }
    } else {
        return await message.sendReply("❌ Please reply to an image or provide a valid image URL to download.");
    }

    if (!mediaBuffer) {
        return await message.sendReply("❌ Could not retrieve image data.");
    }

    try {
        await message.sendReply("⬇️ Image downloaded. Saving file locally...");

        // --- 2. Save the Image ---
        await fs.promises.writeFile(DP_FILE_PATH, mediaBuffer);
        
        // Send success message with next step
        return await message.sendReply(`✅ Image prepared and saved successfully on the server.\n\n*Next Step:* Use the command *.setdp* to set it as the profile picture.`);

    } catch (e) {
        console.error("Error saving DP file:", e);
        return await message.sendReply("❌ Error saving the image file locally.");
    }
});


// --- 2. Command: .setdp (Set the Prepared Image as DP and CLEAN UP) ---
Module({
    pattern: 'setdp',
    fromMe: true,
    desc: 'Sets the locally saved image (from *.getdp*) as the bot DP and deletes the file.',
    type: 'utility'
}, async (message) => {

    if (!fs.existsSync(DP_FILE_PATH)) {
        return await message.sendReply(`❌ No prepared image found. Please use *.getdp* first.`);
    }

    try {
        await message.sendReply("🔄 Reading saved file and updating profile picture...");
        
        const botJID = message.client.user.id || message.client.user.jid; 
        
        if (!botJID) {
            return await message.sendReply("❌ Could not determine bot's JID for profile update.");
        }

        // Use the stable ReadStream method for file upload
        await message.client.updateProfilePicture(botJID, createReadStream(DP_FILE_PATH)); 
        
        // --- CRITICAL: AUTOMATIC CLEANUP ---
        try {
            await fs.promises.unlink(DP_FILE_PATH);
            console.log(`[dp_manager] Successfully deleted used image file: ${path.basename(DP_FILE_PATH)}`);
        } catch (cleanupError) {
            console.error("[dp_manager] FAILED to delete file:", cleanupError);
            // We continue, as the DP update was successful
        }

        return await message.sendReply("🎉 Profile picture successfully updated and used image file deleted!" + BRANDING);

    } catch (e) {
        console.error("Error setting DP:", e);
        
        // Do NOT delete the file if the update failed, in case the user wants to inspect it.
        return await message.sendReply(`❌ Fatal error during profile picture update. Check bot console for details. ${BRANDING}`);
    }
});
