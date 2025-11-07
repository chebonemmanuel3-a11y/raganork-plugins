const { Module } = require("../main");
const axios = require("axios");

async function fetchImage(category) {
  const res = await axios.get(
    `https://source.unsplash.com/random/512x512/?${category}`,
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data, "binary");
}

async function setDp(client, category) {
  try {
    const imgBuffer = await fetchImage(category);
    // Correct Baileys call
    await client.updateProfilePicture(client.user.id, imgBuffer);
  } catch (e) {
    console.error("DP update failed:", e);
  }
}

Module(
  { pattern: "autodp ?(.*)", isPrivate: false, desc: "Set auto DP by category", type: "utility" },
  async (message, match) => {
    const category = match[1] || "nature";
    await setDp(message.client, category);
    await message.reply(`✅ DP updated with random ${category} image.`);
  }
);
