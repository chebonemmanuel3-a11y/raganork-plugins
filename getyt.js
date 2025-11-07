const { Module } = require('../main');
const axios = require('axios');
const botConfig = require("../config");
const isFromMe = botConfig.MODE === "public" ? false : true;

Module({
    pattern: 'getyt ?(.*)',
    fromMe: isFromMe,
    desc: 'Download YouTube songs in high quality',
    type: 'downloader'
}, async (message, match) => {
    let query = match[1]?.trim();

    if (!query && message.reply_message) {
        query = message.reply_message.text?.trim();
    }

    if (!query) return await message.sendReply('_Give me a YouTube link or song name!_');

    try {
        const waitMsg = await message.sendReply('⬇️ Fetching YouTube audio...');

        // Example API endpoint for YouTube audio (replace with your preferred backend)
        const res = await axios.get(
            `https://jerrycoder.oggyapi.workers.dev/ytdl?search=${encodeURIComponent(query)}&quality=high`
        );

        if (!res.data.status || !res.data.download_link) {
            return await message.edit('_Failed to get YouTube audio!_', message.jid, waitMsg.key);
        }

        const track = res.data;
        await message.edit(`⬇️ Downloading HQ: *${track.title}*`, message.jid, waitMsg.key);

        const response = await axios.get(track.download_link, { responseType: 'stream' });

        await message.sendMessage(
            { stream: response.data },
            "document",
            {
                mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                quoted: message.data,
                fileName: `${track.title} (YT HQ).xlsx`
            }
        );

        await message.edit(`✅ HQ Success: *${track.title}*`, message.jid, waitMsg.key);

    } catch (err) {
        console.error(err);
        return await message.sendReply('_Error downloading YouTube track!_');
    }
});
