const { Module } = require("../main");

let currentStory = [];
let storyActive = false;

const openings = [
  "Once upon a time in a small village,",
  "Deep in the forest, a strange sound echoed,",
  "Long ago, in a forgotten kingdom,",
  "On a stormy night, a traveler knocked on the door,",
  "In the middle of the desert, something unexpected happened,"
];

const twists = [
  "Suddenly, the lights went out.",
  "A mysterious stranger appeared.",
  "Everything changed when the dragon arrived.",
  "The ground shook beneath their feet.",
  "Out of nowhere, a secret was revealed."
];

// Start story
Module(
  {
    pattern: "startstory",
    isPrivate: false,
    desc: "Start a collaborative story",
    type: "fun",
  },
  async (message) => {
    if (storyActive) {
      return await message.reply("📖 A story is already in progress!");
    }
    storyActive = true;
    currentStory = [];
    const opening = openings[Math.floor(Math.random() * openings.length)];
    currentStory.push(opening);
    await message.reply("✨ Story started!\n" + opening + "\n\nNow just type your lines — no command needed!");
  }
);

// Capture any message while story is active
Module(
  {
    onMessage: true, // listens to all messages
  },
  async (message) => {
    if (storyActive && !message.text.startsWith(".")) {
      currentStory.push(message.text);

      // Occasionally add a twist
      if (Math.random() < 0.15) {
        const twist = twists[Math.floor(Math.random() * twists.length)];
        currentStory.push(twist);
        await message.reply("🌀 Twist added: " + twist);
      }
    }
  }
);

// End story
Module(
  {
    pattern: "endstory",
    isPrivate: false,
    desc: "End the story and show it",
    type: "fun",
  },
  async (message) => {
    if (!storyActive) {
      return await message.reply("❌ No story in progress.");
    }
    storyActive = false;
    const storyText = currentStory.join(" ");
    currentStory = [];
    await message.reply("📚 Here’s the story you created:\n\n" + storyText);
  }
);
