const { Module } = require("../main");

let fakeRecordingEnabled = true; // default ON

Module(
  {
    pattern: "fakerecord on",
    isPrivate: false,
    desc: "Enable fake recording",
    type: "fun",
  },
  async (message) => {
    fakeRecordingEnabled = true;
    await message.reply("🎤 Fake recording is now ENABLED.");
  }
);

Module(
  {
    pattern: "fakerecord off",
    isPrivate: false,
    desc: "Disable fake recording",
    type: "fun",
  },
  async (message) => {
    fakeRecordingEnabled = false;
    await message.reply("🔇 Fake recording is now DISABLED.");
  }
);

Module(
  {
    onMessage: true, // listens to all messages
  },
  async (message) => {
    if (!fakeRecordingEnabled) return;

    // Ignore commands (starting with .)
    if (message.text && !message.text.startsWith(".")) {
      // Simulate recording indicator
      const fake = await message.reply("🎤 Recording voice note...");

      setTimeout(async () => {
        await message.reply("✅ Finished recording (fake)");
      }, 10000);
    }
  }
);
