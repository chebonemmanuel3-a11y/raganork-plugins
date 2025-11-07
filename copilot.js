const { Module } = require("../main");
const axios = require("axios");

// Temporary in-memory storage (better to use a database or config file)
let apiKey = null;

Module(
  {
    pattern: "setkey ?(.*)",
    isPrivate: true,
    desc: "Set your Copilot API key",
    type: "config",
  },
  async (message, match) => {
    const key = match[1]?.trim();
    if (!key) {
      return await message.reply("Please provide an API key after the command.");
    }
    apiKey = key;
    await message.reply("✅ Copilot API key has been set successfully.");
  }
);

Module(
  {
    pattern: "copilot ?(.*)",
    isPrivate: false,
    desc: "Ask CopilotKit AI a question",
    type: "ai",
  },
  async (message, match) => {
    const prompt = match[1]?.trim();
    if (!prompt) {
      return await message.reply("Please provide a question.");
    }
    if (!apiKey) {
      return await message.reply("❌ No API key set. Use `.setkey YOUR_KEY` first.");
    }

    try {
      const response = await axios.post(
        "https://api.copilotkit.ai/v1/chat",
        { prompt },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const reply = response.data?.reply || "No response from CopilotKit.";
      await message.reply(reply);
    } catch (error) {
      console.error("CopilotKit API Error:", error.message);
      await message.reply("❌ An error occurred with CopilotKit API.");
    }
  }
);
