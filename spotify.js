const { Module } = require("../main");
const axios = require("axios");

Module(
  { pattern: "get ?(.*)", isPrivate: false, desc: "Fetch Spotify track by link", type: "utility" },
  async (message, match) => {
    const query = match[1];
    if (!query) return await message.reply("❌ Please provide a Spotify track link.");

    try {
      // If input looks like a Spotify track link
      if (query.includes("spotify.com/track")) {
        const res = await axios.get(
          `https://jerrycoder.oggyapi.workers.dev/dspotify?url=${encodeURIComponent(query)}`
        );

        if (!res.data || !res.data.downloadUrl) {
          return await message.reply("❌ Failed to get download link from Spotify.");
        }

        const title = res.data.title || "spotify_track";
        const downloadUrl = res.data.downloadUrl;

        // Download MP3
        const audioRes = await axios.get(downloadUrl, { responseType: "arraybuffer" });
        const audioBuffer = Buffer.from(audioRes.data, "binary");

        // Send as document with .xlsx extension
        await message.client.sendMessage(message.jid, {
          document: audioBuffer,
          mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileName: `${title}.xlsx`
        });

        return await message.reply(`✅ Sent ${title} as .xlsx (rename to .mp3 to play).`);
      }

      // If not a link, fallback
      return await message.reply("⚡ Please send a valid Spotify track link.");
    } catch (e) {
      console.error("Get command failed:", e);
      await message.reply("❌ Error fetching song.");
    }
  }
);
