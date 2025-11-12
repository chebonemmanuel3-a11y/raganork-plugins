// autobio.js — Auto Bio plugin for Raganork-MD
// Fetches random cool bios/quotes from the internet and updates WhatsApp "About" automatically.

let { Module } = require('../main')
const axios = require('axios')

const INTERVAL_MS = 1000 * 60 * 10 // change every 10 minutes
const QUOTE_API = 'https://api.quotable.io/random' // free quote API

let enabled = false
let interval = null

Module({ on: "text", fromMe: false }, async (m) => {
  const body = (m.message || "").toLowerCase().trim()

  // ✅ Turn ON
  if (body === ".autobio on") {
    if (enabled) return await m.send("_Auto Bio already running._")
    enabled = true

    const updateBio = async () => {
      try {
        const res = await axios.get(QUOTE_API)
        const { content, author } = res.data
        const newBio = `${content} — ${author}`.slice(0, 139) // WhatsApp bio limit: 139 chars

        // Update WhatsApp "About"
        if (m.client && typeof m.client.updateProfileStatus === "function") {
          await m.client.updateProfileStatus(newBio)
          console.log(`[autobio] Updated bio -> ${newBio}`)
        } else {
          console.warn("[autobio] updateProfileStatus not available")
        }
      } catch (err) {
        console.error("[autobio] Error fetching bio:", err.message)
      }
    }

    // Run once immediately, then repeat
    await updateBio()
    interval = setInterval(updateBio, INTERVAL_MS)
    await m.send("_✅ Auto Bio started — fetching new cool bios every 10 min._")
    return
  }

  // 🛑 Turn OFF
  if (body === ".autobio off") {
    if (!enabled) return await m.send("_Auto Bio not active._")
    enabled = false
    clearInterval(interval)
    await m.send("_🛑 Auto Bio stopped._")
    return
  }
})    await updateBio(message.client);
    await message.reply("✅ Auto bio ENABLED. Updates every 10 minutes.");
  }
);

Module(
  { pattern: "autobio off", isPrivate: false, desc: "Disable auto bio", type: "utility" },
  async (message) => {
    autoBioEnabled = false;
    clearInterval(intervalId);
    await message.reply("🔇 Auto bio DISABLED.");
  }
);
