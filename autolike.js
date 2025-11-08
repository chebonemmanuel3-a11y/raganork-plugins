// plugins/autolike.js
const { Module } = require('../main');
const botConfig = require("../config");
const isFromMe = botConfig.MODE === "public" ? false : true;

// Auto-like function
async function autoLikeStatus(sock, statusId, jid) {
  try {
    // Mark status as viewed
    await sock.readMessages([statusId]);

    // Send heart like (WhatsApp beta feature)
    await sock.sendMessage(jid, { react: { text: '🖤', key: statusId } });
  } catch (err) {
    console.error("Auto-like failed:", err);
  }
}

// Listen for new statuses
Module({
  pattern: 'autolike',
  fromMe: isFromMe,
  desc: 'Automatically like viewed statuses',
  type: 'social'
}, async (message) => {
  await message.sendReply("✅ Auto-like enabled. All new statuses will be liked with 🖤.");
  // Hook into Baileys event
  message.sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key && msg.key.remoteJid === 'status@broadcast') {
        await autoLikeStatus(message.sock, msg.key, msg.key.participant);
      }
    }
  });
});
