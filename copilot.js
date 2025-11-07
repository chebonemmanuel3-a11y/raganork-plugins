const { Module } = require("../main");
const axios = require("axios");

Module(
  {
    pattern: "copilot ?(.*)",
    isPrivate: false,
    desc: "Ask Copilot AI a question",
    type: "ai",
  },
  async (message, match) => {
    const prompt = match[1]?.trim();
    if (!prompt) {
      return await message.reply("Please provide a question.");
    }

    try {
      const response = await axios.post(
        "https://api.example.com/copilot", // replace with actual endpoint
        { prompt },
        {
          headers: {
            Authorization: `Bearer ${process.env.COPILOT_API_KEY}`,
          },
        }
      );

      const reply = response.data?.reply || "No response from Copilot.";
      await message.reply(reply);
    } catch (error) {
      console.error("Copilot API Error:", error.message);
      await message.reply("❌ An error occurred with Copilot API.");
    }
  }
);
