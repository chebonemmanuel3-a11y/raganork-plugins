const { Module } = require("../main");
const axios = require("axios");

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
      return await message.reply("Please provide a fuckin question question.");
    }

    try {
      const response = await axios.post(
        "https://api.copilotkit.ai/v1/chat",
        { prompt },
        {
          headers: {
            Authorization: "Bearer ck_pub_fe68525d4b4d0ddd9579e39c34e4a9e3", // pasted directly
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
