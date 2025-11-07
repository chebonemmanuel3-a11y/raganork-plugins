const { Module } = require("../main");
const axios = require("axios");

let autoBioEnabled = false;
let intervalId = null;

async function fetchBio() {
  // Example: cycle through multiple sources
  const sources = [
    "https://picsart.com/blog/whatsapp-bio-ideas/",
    "https://www.wikihow.com/WhatsApp-Bio-Ideas",
    "https://www.fotor.com/blog/whatsapp-bio-ideas/",
    "https://simplified.com/blog/ai-writing/whatsapp-bio-ideas",
    "https://www.haulpack.com/blog/top-150-whatsapp-bio-ideas-caption"
  ];

  const randomSource = sources[Math.floor(Math.random() * sources.length)];
  const res = await axios.get(randomSource);
  const text = res.data;

  // Simple regex to extract lines (you can refine this)
  const bios = text.match(/.{20,80}/g); 
  return bios[Math.floor(Math.random() * bios.length)];
}

async function updateBio(client) {
  const newBio = await fetchBio();
  await client.updateProfileStatus(newBio);
}

Module(
  { pattern: "autobio on", isPrivate: false, desc: "Enable auto bio", type: "utility" },
  async (message) => {
    if (autoBioEnabled) return await message.reply("⚡ Auto bio already running.");
    autoBioEnabled = true;
    intervalId = setInterval(() => updateBio(message.client), 1 * 60 * 1000);
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
