// plugins/freeram.js
const { Module } = require('../main');
const botConfig = require("../config");
const isFromMe = botConfig.MODE === "public" ? false : true;

// Cleanup function
function cleanup() {
  try {
    Object.keys(require.cache).forEach(key => delete require.cache[key]);
    if (global.gc) global.gc();
  } catch (err) {
    // ignore errors silently
  }
}

// Schedule auto cleanup every 10 minutes (600000 ms)
setInterval(() => {
  cleanup(); // silent run, no message
}, 600000);

Module({
  pattern: 'free',
  fromMe: isFromMe,
  desc: 'Force garbage collection and clear caches',
  type: 'system'
}, async (message) => {
  try {
    const before = process.memoryUsage().heapUsed / 1024 / 1024;
    cleanup();
    const after = process.memoryUsage().heapUsed / 1024 / 1024;

    await message.sendReply(
      `🧹 RAM cleanup done!\nBefore: ${before.toFixed(2)} MB\nAfter: ${after.toFixed(2)} MB`
    );
  } catch (err) {
    await message.sendReply('⚠️ Could not free memory. Start Node.js with --expose-gc.');
  }
});
