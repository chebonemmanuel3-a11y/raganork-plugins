const { Module } = require("../main");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// File to store the key persistently
const keyFile = path.join(__dirname, "copilot_key.json");

// Helper to read the saved key
function getApiKey() {
  try {
    const data = fs.readFileSync(keyFile, "utf8");
    return JSON.parse(data).apiKey;
  } catch {
    return null;
  }
}

// Helper to save the key
function saveApiKey(key) {
  fs.writeFileSync(keyFile, JSON.stringify({ apiKey: key }));
}

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
    saveApiKey(key);
    await message.reply("✅ Copilot API key has been saved successfully.");
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

    const apiKey = getApiKey();
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
      await message.reply("❌.");
    }
  }
);
