const { Module } = require("../main");
const axios = require("axios");

let autoDpEnabled = false;
let intervalId = null;
let currentCategory = "nature";

async function fetchImage(category) {
  const res = await axios.get(`https://source.unsplash.com/random/512x512/?${category}`, {
    responseType: "arraybuffer"
  });
  return Buffer.from(res.data, "binary");
}

async function setDp(client, category) {
  try {
    const imgBuffer = await fetchImage(category);
    await client.updateProfilePicture(client.user.id, imgBuffer);
  } catch (e) {
    console.error("DP update failed:", e);
  }
}

Module(
  { pattern: "autodp ?(.*)", isPrivate: false, desc: "Set auto DP by category", type: "utility" },
  async (message, match) => {
    const category = match[1] || "nature";
    currentCategory = category;

    if (!autoDpEnabled) {
      await setDp(message.client, category);
      await message.reply(`✅ DP updated with random ${category} image.`);
    } else {
      await message.reply(`⚡ Auto DP already running with category: ${currentCategory}`);
    }
  }
);

Module(
  { pattern: "autodp on ?(.*)", isPrivate: false, desc: "Enable scheduled auto DP", type: "utility" },
  async (message, match) => {
    currentCategory = match[1] || "nature";
    if (autoDpEnabled) return await message.reply("⚡ Auto DP already running.");
    autoDpEnabled = true;
    intervalId = setInterval(() => setDp(message.client, currentCategory), 2 * 60 * 1000);
    await setDp(message.client, currentCategory);
    await message.reply(`✅ Auto DP ENABLED. Rotating ${currentCategory} images every 2 minutes.`);
  }
);

Module(
  { pattern: "autodp off", isPrivate: false, desc: "Disable auto DP", type: "utility" },
  async (message) => {
    autoDpEnabled = false;
    clearInterval(intervalId);
    await message.reply("🔇 Auto DP DISABLED.");
  }
);
