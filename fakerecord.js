const { Module } = require("../main");

let fakeRecordingEnabled = true;

Module(
  {
    pattern: "fakerecord on",
    isPrivate: false,
    desc: "Enable fake recording",
    type: "fun",
  },
  async (message) => {
    fakeRecordingEnabled = true;
    await message.reply("🎤 Fake recording ENABLED.");
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
    await message.reply("🔇 Fake recording DISABLED.");
  }
);

Module(
  { onMessage: true },
  async (message) => {
    if (!fakeRecordingEnabled) return;
    if (message.text && !message.text.startsWith(".")) {
      // Trigger fake recording indicator
      await message.client.sendPresenceUpdate("recording", message.jid);

      // Hold for 10 seconds
      setTimeout(async () => {
        await message.client.sendPresenceUpdate("paused", message.jid);
      }, 10000);
    }
  }
);
