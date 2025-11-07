const { Module } = require("../main");
const axios = require("axios");

// Using LibreTranslate (free API) — you can swap with Google Translate API if you prefer
const API_URL = "https://libretranslate.de/translate";

Module(
  {
    pattern: "trtr ?(.*)",
    isPrivate: false,
    desc: "Translate text into any language",
    type: "utility",
  },
  async (message, match) => {
    let textToTranslate = "";
    let targetLang = "";

    // Case 1: Reply mode
    if (message.reply_message && match) {
      textToTranslate = message.reply_message.text;
      targetLang = match.trim().toLowerCase();
    }
    // Case 2: Direct mode
    else if (match) {
      const parts = match.split(" ");
      targetLang = parts.pop().toLowerCase(); // last word = language
      textToTranslate = parts.join(" ");
    } else {
      return await message.reply("❌ Usage:\nReply with `.trtr <language>` OR `.trtr <text> <language>`");
    }

    try {
      const response = await axios.post(API_URL, {
        q: textToTranslate,
        source: "auto",
        target: targetLang,
        format: "text"
      });

      const translated = response.data.translatedText;
      await message.reply("🌐 Translation (" + targetLang + "):\n" + translated);
    } catch (e) {
      await message.reply("❌ Translation failed. Make sure the language code is valid (e.g., `en`, `fr`, `sw`).");
    }
  }
);
