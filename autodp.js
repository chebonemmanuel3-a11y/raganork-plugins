const { Module } = require("../main");
const axios = require("axios");

// Replace with your Pexels API key (get one free at https://www.pexels.com/api/)
const PEXELS_API_KEY = "8ThxsNY77ksUID32bMuFYSiZOMK3GEE7mukzeMgTA5cgvNO20ERZCHOx";

let autoDpEnabled = false;
let intervalId = null;
let currentCategory = "nature";

async function fetchImage(category) {
  try {
    // Search Pexels for category images
    const res = await axios.get(`https://api.pexels.com/v1/search?query=${category}&per_page=1&page=${Math.floor(Math.random() * 100)}`, {
      headers: { Authorization: PEXELS_API_KEY }
    });

    if (!res.data.photos || res.data.photos.length === 0) {
      throw new Error("No images found for category: " + category);
    }

    const imgUrl = res.data.photos[0].src.medium;
    const imgRes = await axios.get(imgUrl, { responseType: "arraybuffer" });
    return Buffer.from(imgRes.data, "binary");
  } catch (e) {
    console.error("Image fetch failed:", e);
    throw e;
  }
}

async function setDp(client, category) {
  try {
    const imgBuffer = await fetchImage(category);
    await client.updateProfilePicture(client.user.id, imgBuffer);
    console.log(`DP updated with ${category} image`);
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
    intervalId = setInterval(() => setDp(message.client, currentCategory), 2 * 60 * 1000); // every 2 minutes
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
