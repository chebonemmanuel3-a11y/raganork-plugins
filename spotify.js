const { Module } = require("../main");
const axios = require("axios");
const NodeID3 = require("node-id3");

Module(
  { pattern: "get ?(.*)", isPrivate: false, desc: "Fetch Spotify song as .xlsx", type: "utility" },
  async (message, match) => {
    const query = match[1];
    if (!query) return await message.reply("❌ Please provide a song name or Spotify link.");

    try {
      // Call your Spotify API (search or link)
      const res = await axios.get(
        `https://jerrycoder.oggyapi.workers.dev/spotify?search=${encodeURIComponent(query)}`
      );

      if (!res.data.result || res.data.result.length === 0) {
        return await message.reply("❌ No songs found.");
      }

      const track = res.data.result[0];
      const downloadUrl = track.downloadUrl;
      const coverUrl = track.image; // album art
      const title = track.title;
      const artist = track.artist;

      // Download MP3
      const audioRes = await axios.get(downloadUrl, { responseType: "arraybuffer" });
      let audioBuffer = Buffer.from(audioRes.data, "binary");

      // Download cover art
      const coverRes = await axios.get(coverUrl, { responseType: "arraybuffer" });
      const coverBuffer = Buffer.from(coverRes.data, "binary");

      // Embed ID3 tags with cover art
      const tags = {
        title,
        artist,
        APIC: {
          mime: "image/jpeg",
          type: { id: 3, name: "front cover" },
          description: "Cover",
          imageBuffer: coverBuffer
        }
      };
      audioBuffer = NodeID3.update(tags, audioBuffer);

      // Send as document with .xlsx extension
      await message.client.sendMessage(message.jid, {
        document: audioBuffer,
        mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileName: `${title}.xlsx`
      });

      await message.reply(`✅ Sent ${title} as .xlsx (rename to .mp3 to play with thumbnail).`);
    } catch (e) {
      console.error("Get command failed:", e);
      await message.reply("❌ Error fetching song.");
    }
  }
);
