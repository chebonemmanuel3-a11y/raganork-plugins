const { Module } = require("../main");

const truths = [
  "What is your biggest fear?",
  "Have you ever lied to get out of trouble?",
  "What is the most embarrassing thing you’ve done?",
  "Who was your first crush?",
  // add more here
];

const dares = [
  "Send a funny selfie to the group.",
  "Speak in emojis for the next 5 messages.",
  "Change your WhatsApp status to 'I love Raganork Bot' for 1 hour.",
  "Sing a song and send a voice note.",
  // add more here
];

Module(
  {
    pattern: "truth",
    isPrivate: false,
    desc: "Play Truth",
    type: "fun",
  },
  async (message) => {
    const challenge = truths[Math.floor(Math.random() * truths.length)];
    await message.reply(`🟢 Truth:\n${challenge}`);
  }
);

Module(
  {
    pattern: "dare",
    isPrivate: false,
    desc: "Play Dare",
    type: "fun",
  },
  async (message) => {
    const challenge = dares[Math.floor(Math.random() * dares.length)];
    await message.reply(`🔴 Dare:\n${challenge}`);
  }
);
