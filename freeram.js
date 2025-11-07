// plugins/freeram.js
const { Module } = require('../main');
const botConfig = require("../config");
const isFromMe = botConfig.MODE === "public" ? false : true;

// Cleanup function
function cleanup() {
  try {
    // Clear require cache
    Object.keys(require.cache).forEach(key => delete require.cache[key]);
    // Reset global caches if you use them
    if (global.myCache) global.myCache = {};
    if (global.tempStore) global.tempStore = {};
    // Trigger garbage collection
    if (global.gc) global.gc();
  } catch (err) {
    // ignore silently
  }
}

// Auto cleanup every 10 minutes (silent)
setInterval(() => {
  cleanup();
}, 600000);

Module({
  pattern: 'free',
  fromMe: isFromMe,
  desc: 'Force garbage collection and clear caches',
  type: 'system'
}, async (message) => {
  try {
    const before = process.memoryUsage();
    cleanup();
    const after = process.memoryUsage();

    const format = (mem) => (mem / 1024 / 1024).toFixed(2);

    await message.sendReply(
      `🧹 RAM cleanup done!\n` +
      `Heap: ${format(before.heapUsed)} MB → ${format(after.heapUsed)} MB\n` +
      `RSS: ${format(before.rss)} MB → ${format(after.rss)} MB\n` +
      `External: ${format(before.external)} MB → ${format(after.external)} MB`
    );
  } catch (err) {
    await message.sendReply('⚠️ Could not free memory. Start Node.js with --expose-gc.');
  }
});
