const { Module } = require("../main");
const axios = require("axios");

Module(
  {
    pattern: "img ?(.*)",
    isPrivate: false,
    desc: "Generate an AI image from text",
    type: "utility",
  },
  async (message, match) => {
    if (!match) return await message.reply("❌ Please provide a prompt, e.g., `.img a dragon flying over Nairobi`");

    try {
      const response = await axios.post("https://api.openai.com/v1/images/generations", {
        prompt: match,
        n: 1,
        size: "512x512"
      }, {
        headers: { Authorization: `Bearer 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` }
      });

      const imageUrl = response.data.data[0].url;
      await message.reply("🖼️ Here’s your image:\n" + imageUrl);
    } catch (e) {
      await message.reply("❌ Failed to generate image.");
    }
  }
);
