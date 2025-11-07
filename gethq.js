const { Module } = require('../main');
const axios = require('axios');
const botConfig = require("../config");
const isFromMe = botConfig.MODE === "public" ? false : true;

let pendingHQ = {};

Module({
    pattern: 'gethq ?(.*)',
    fromMe: isFromMe,
    desc: 'Fetch Spotify songs in high quality (if available)',
    type: 'downloader'
}, async (message, match) => {
    let query = match[1]?.trim();

    if (!query && message.reply_message) {
        query = message.reply_message.text?.trim();
    }

    if (!query) return await message.sendReply('_Give me a song name or Spotify URL!_');

    // Handle direct Spotify track link
    if (query.startsWith('http') && query.includes('spotify.com/track/')) {
        try {
            const waitMsg = await message.sendReply('⬇️ Fetching HQ track info...');
            const res = await axios.get(
                `https://jerrycoder.oggyapi.workers.dev/dspotify?url=${encodeURIComponent(query)}&quality=high`
            );

            if (!res.data.status || !res.data.download_link) {
                return await message.edit('_HQ link not available!_', message.jid, waitMsg.key);
            }

            const track = res.data;
            await message.edit(`⬇️ Downloading HQ: *${track.title}* - ${track.artist}`, message.jid, waitMsg.key);

            const response = await axios.get(track.download_link, { responseType: 'stream' });

            await message.sendMessage(
                { stream: response.data },
                "document",
                {
                    mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    quoted: message.data,
                    fileName: `${track.title} - ${track.artist} (HQ).xlsx`
                }
            );

            await message.edit(`✅ HQ Success: *${track.title}* - ${track.artist}`, message.jid, waitMsg.key);

        } catch (err) {
            console.error(err);
            return await message.sendReply('_Error downloading HQ track!_');
        }
        return;
    }

    // Handle search queries
    try {
        const waitMsg = await message.sendReply(`_Searching HQ for:_ *${query}*`);

        const res = await axios.get(`https://jerrycoder.oggyapi.workers.dev/spotify?search=${encodeURIComponent(query)}`);
        if (!res.data.tracks || res.data.tracks.length === 0) {
            return await message.edit('_No HQ tracks found!_', message.jid, waitMsg.key);
        }

        const results = res.data.tracks.slice(0, 8);
        let list = results.map((t, i) =>
            `*${i + 1}. ${t.trackName}*\n_by ${t.artist} • ${t.durationMs}_`
        ).join("\n\n");

        await message.edit(
            `🎵 *HQ search results for:* _"${query}"_\n\n${list}\n\n_Reply with a number (1–${results.length}) to download in HQ_`,
            message.jid,
            waitMsg.key
        );

        pendingHQ[message.sender] = { key: waitMsg.key, results };

    } catch (err) {
        console.error(err);
        return await message.sendReply('_Error fetching HQ search results!_');
    }
});

Module({
    on: 'text',
    fromMe: false
}, async (message) => {
    const userState = pendingHQ[message.sender];
    if (!userState) return;

    const selected = parseInt(message.message.trim());
    if (isNaN(selected) || selected < 1 || selected > userState.results.length) return;

    const track = userState.results[selected - 1];
    delete pendingHQ[message.sender];

    try {
        await message.edit(`⬇️ Downloading HQ: *${track.trackName}* - ${track.artist}`, message.jid, userState.key);

        const res = await axios.get(
            `https://jerrycoder.oggyapi.workers.dev/dspotify?url=${encodeURIComponent(track.spotifyUrl)}&quality=high`
        );

        if (!res.data.status || !res.data.download_link) {
            return await message.edit('_HQ link not available!_', message.jid, userState.key);
        }

        const dl = res.data;
        const response = await axios.get(dl.download_link, { responseType: 'stream' });

        await message.sendMessage(
            { stream: response.data },
            "document",
            {
                mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                quoted: message.data,
                fileName: `${dl.title} - ${dl.artist} (HQ).xlsx`
            }
        );

        await message.edit(`✅ HQ Success: *${dl.title}* - ${dl.artist}`, message.jid, userState.key);

    } catch (err) {
        console.error(err);
        await message.edit('_Error downloading HQ track!_', message.jid, userState.key);
    }
});
