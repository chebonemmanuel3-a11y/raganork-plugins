const { Module } = require("../main");
const axios = require("axios");

let autoBioEnabled = false;
let intervalId = null;

async function fetchBio() {
  // Example: get bios from a static list or an API
  const bios = [
    "Good vibes only ✨",
    "Stay hungry, stay foolish 🚀",
    "Living my best life 🌍",
    "Dream big, hustle harder 💪",
    "Coffee + Code = Me ☕💻"
  ];
  return bios[Math.floor(Math.random() * bios.length)];
}

async function updateBio(client) {
  const newBio = await fetchBio();
  await client.updateProfileStatus(newBio); // Baileys method
}

Module(
  { pattern: "autobio on", isPrivate: false, desc: "Enable auto bio", type: "utility" },
  async (message) => {
    if (autoBioEnabled) return await message.reply("⚡ Auto bio already running.");
    autoBioEnabled = true;
    intervalId = setInterval(() => updateBio(message.client), 10 * 60 * 1000);
    await updateBio(message.client);
    await message.reply("✅ Auto bio ENABLED. Updates every 10 minutes.");
  }
);

Module(
  { pattern: "autobio off", isPrivate: false, desc: "Disable auto bio", type: "utility" },
  async (message) => {
    autoBioEnabled = false;
    clearInterval(intervalId);
    await message.reply("🔇 Auto bio DISABLED.");
  }
);
