const { Module } = require("../main");
const config = require("../config");
const { setVar } = require("./manage");
const axios = require("axios");

// --- API Configuration ---
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
// Models listed in fallback order.
const models = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemma-3-12b-it",
];

// --- State Management ---
// Maps to store chat settings and context, indexed by JID (chat ID)
const chatbotStates = new Map(); // Stores if chatbot is enabled/disabled in a specific chat
const chatContexts = new Map(); // Stores conversation history (context)
const modelStates = new Map();  // Stores the current model index for fallback purposes

// *** MODIFIED SYSTEM PROMPT START ***
// Changed to enforce extreme brevity and remove the 'Raganork' name from the AI's persona.
let globalSystemPrompt =
  "You are a brief, helpful, and conversational AI assistant. Respond to the user's message with a single, short sentence. Do not use markdown (like bold or italics).";
// *** MODIFIED SYSTEM PROMPT END ***

// --- Helper Functions ---

/**
 * Initializes chatbot state from environment variables (config.js).
 */
async function initChatbotData() {
  try {
    // Load enabled chats (JIDs)
    const chatbotData = config.CHATBOT || "";
    if (chatbotData) {
      const enabledChats = chatbotData.split(",").filter((jid) => jid.trim());
      enabledChats.forEach((jid) => {
        chatbotStates.set(jid.trim(), true);
        modelStates.set(jid.trim(), 0); // Start with the first model
      });
    }

    // Load global system prompt
    const systemPrompt = config.CHATBOT_SYSTEM_PROMPT;
    if (systemPrompt) {
      globalSystemPrompt = systemPrompt;
    }
  } catch (error) {
    console.error("Error initializing chatbot data:", error);
  }
}

/**
 * Saves the current enabled/disabled chats list back to the configuration file.
 */
async function saveChatbotData() {
  try {
    const enabledChats = [];
    for (const [jid, enabled] of chatbotStates.entries()) {
      if (enabled) {
        enabledChats.push(jid);
      }
    }
    // Assumes 'setVar' is a utility that writes back to a configuration system.
    await setVar("CHATBOT", enabledChats.join(","));
  } catch (error) {
    console.error("Error saving chatbot data:", error);
  }
}

/**
 * Saves the global system prompt.
 */
async function saveSystemPrompt(prompt) {
  try {
    globalSystemPrompt = prompt;
    await setVar("CHATBOT_SYSTEM_PROMPT", prompt);
  } catch (error) {
    console.error("Error saving system prompt:", error);
  }
}

/**
 * Converts an image buffer to the Gemini API's inlineData part format.
 * @param {Buffer} imageBuffer - Buffer containing the image data.
 * @returns {object|null} The inline data part for the API or null on error.
 */
async function imageToGenerativePart(imageBuffer) {
  try {
    const data = imageBuffer.toString("base64");
    // NOTE: Hardcoded mimeType to image/jpeg for simplicity, though it should be dynamic
    return {
      inlineData: {
        mimeType: "image/jpeg",
        data: data,
      },
    };
  } catch (error) {
    console.error("Error processing image:", error.message);
    return null;
  }
}

/**
 * Fetches the AI response from Gemini, handling context, image input, and model fallback.
 * @param {string} message - The user's text message.
 * @param {string} chatJid - The chat ID (JID).
 * @param {Buffer|null} imageBuffer - Optional image buffer if replying to an image.
 * @returns {string} The AI response text or an error message.
 */
async function getAIResponse(message, chatJid, imageBuffer = null) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) {
    return "_❌ GEMINI_API_KEY not configured. Please set it using `.setvar GEMINI_API_KEY your_api_key`_";
  }

  const currentModelIndex = modelStates.get(chatJid) || 0;
  const currentModel = models[currentModelIndex];

  try {
    const apiUrl = `${API_BASE_URL}${currentModel}:generateContent?key=${apiKey}`;

    const context = chatContexts.get(chatJid) || [];

    // 1. Construct contents array for the API call
    const contents = [
        // System prompt is sent as the first user message for context setup
        { role: "user", parts: [{ text: `System: ${globalSystemPrompt}` }] },
    ];
    
    // 2. Add recent conversation history (last 10 messages)
    const recentContext = context.slice(-10);
    recentContext.forEach((msg) => {
        contents.push({
            role: msg.role,
            parts: [{ text: msg.text }],
        });
    });

    // 3. Add the current user message (text + optional image)
    const parts = [{ text: message }];
    if (imageBuffer) {
      const imagePart = await imageToGenerativePart(imageBuffer);
      if (imagePart) {
        parts.push(imagePart);
      }
    }

    contents.push({
      role: "user",
      parts: parts,
    });

    // 4. Build the final payload
    const payload = {
      contents: contents,
      generationConfig: {
        // *** MODIFIED OUTPUT TOKENS START ***
        // Reduced from 1000 to 50 to enforce very short, single-sentence replies.
        maxOutputTokens: 50, 
        // *** MODIFIED OUTPUT TOKENS END ***
        temperature: 0.7,
      },
    };

    // 5. Send API Request
    const response = await axios.post(apiUrl, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    // 6. Process response and update context
    if (
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text
    ) {
      const aiResponse = response.data.candidates[0].content.parts[0].text;

      // Update context state
      if (!chatContexts.has(chatJid)) {
        chatContexts.set(chatJid, []);
      }
      const contextArray = chatContexts.get(chatJid);
      
      // Log user message to context
      const contextMessage = imageBuffer
        ? `${message} [Image included]`
        : message;
      contextArray.push({ role: "user", text: contextMessage });
      
      // Log model response to context
      contextArray.push({ role: "model", text: aiResponse });

      // Prune old context to maintain size (max 20 entries)
      if (contextArray.length > 20) {
        contextArray.splice(0, contextArray.length - 20);
      }

      return aiResponse;
    } else {
      return "_❌ Received unexpected response from AI. Please try again._";
    }
  } catch (error) {
    console.error("Error getting AI response:", error.message);

    // --- Rate Limit and Model Fallback Handling ---
    if (error.response && error.response.status === 429) {
      const nextModelIndex = currentModelIndex + 1;
      if (nextModelIndex < models.length) {
        modelStates.set(chatJid, nextModelIndex);
        console.log(
          `Switching to model: ${models[nextModelIndex]} for chat: ${chatJid}`
        );
        return "_⚠️ Rate limit reached. Switched to backup model. Please try again._";
      } else {
        return "_❌ All models have reached their rate limits. Please try again later._";
      }
    }

    // General API Error
    if (error.response) {
      return `_❌ API Error: ${
        error.response.data?.error?.message || "Unknown error"
      }_`;
    }

    return "_❌ Network error. Please check your connection and try again._";
  }
}

/**
 * Checks if the chatbot is enabled for a given JID, considering global settings.
 */
function isChatbotEnabled(jid) {
  // Check individual chat setting
  if (chatbotStates.get(jid) === true) {
    return true;
  }

  const isGroup = jid.includes("@g.us");
  
  // Check global settings
  if (isGroup && config.CHATBOT_ALL_GROUPS === "true") {
    return true;
  }

  if (!isGroup && config.CHATBOT_ALL_DMS === "true") {
    return true;
  }

  return false;
}

/**
 * Enables the chatbot for a specific JID and saves the state.
 */
async function enableChatbot(jid) {
  chatbotStates.set(jid, true);
  if (!modelStates.has(jid)) {
    modelStates.set(jid, 0);
  }
  await saveChatbotData();
}

/**
 * Disables the chatbot for a specific JID, clears context, and saves the state.
 */
async function disableChatbot(jid) {
  chatbotStates.set(jid, false);
  chatContexts.delete(jid);
  await saveChatbotData();
}

/**
 * Clears the conversation context for a specific JID.
 */
function clearContext(jid) {
  chatContexts.delete(jid);
  // Reset model back to the first one for a fresh start
  modelStates.set(jid, 0); 
}

/**
 * Clears contexts globally for groups or DMs.
 */
async function clearAllContexts(target) {
  if (target === "groups") {
    for (const [jid] of chatbotStates.entries()) {
      if (jid.includes("@g.us")) {
        clearContext(jid);
      }
    }
  } else if (target === "dms") {
    for (const [jid] of chatbotStates.entries()) {
      if (!jid.includes("@g.us")) {
        clearContext(jid);
      }
    }
  }
}

// Initialize data once on bot startup
initChatbotData();

// -----------------------------------------------------------------------------
// --- COMMAND MODULE (.chatbot) ---
// -----------------------------------------------------------------------------

Module(
  {
    pattern: "chatbot ?(.*)",
    fromMe: true, // Only you can run management commands
    desc: "AI Chatbot management with Gemini API - supports text and image analysis",
    usage:
      '.chatbot - _Show help menu_\n.chatbot on/off - _Enable/disable in current chat_\n.chatbot on/off groups - _Enable/disable in all groups_\n.chatbot on/off dms - _Enable/disable in all DMs_\n.chatbot set "prompt" - _Set system prompt_\n.chatbot clear - _Clear conversation context_\n_Reply to images for AI image analysis_',
  },
  async (message, match) => {
    const input = match[1]?.trim();
    const chatJid = message.jid;

    // --- Display Help/Status if no input ---
    if (!input || input.toLowerCase() === "status") {
      const isEnabled = isChatbotEnabled(chatJid);
      const isEnabledIndividually = chatbotStates.get(chatJid) === true;
      const globalGroups = config.CHATBOT_ALL_GROUPS === "true";
      const globalDMs = config.CHATBOT_ALL_DMS === "true";
      const currentModel = models[modelStates.get(chatJid) || 0];
      const contextSize = chatContexts.get(chatJid)?.length || 0;
      const modelIndex = modelStates.get(chatJid) || 0;
      const hasApiKey = !!config.GEMINI_API_KEY;

      // Determine reason for enablement for detailed status
      let enabledReason = "";
      if (isEnabledIndividually) {
        enabledReason = "Individual chat setting";
      } else if (chatJid.includes("@g.us") && globalGroups) {
        enabledReason = "Global groups setting";
      } else if (!chatJid.includes("@g.us") && globalDMs) {
        enabledReason = "Global DMs setting";
      }
      
      const helpText =
        `*_🤖 AI Chatbot Management_*\n\n` +
        `📊 _Status:_ \`${isEnabled ? "Enabled ✅" : "Disabled ❌"}\`\n` +
        (isEnabled && enabledReason ? `📋 _Enabled via:_ \`${enabledReason}\`\n` : "") +
        `🔑 _API Key:_ \`${hasApiKey ? "Configured ✅" : "Missing ❌"}\`\n` +
        `🌐 _Global Groups:_ \`${globalGroups ? "Enabled ✅" : "Disabled ❌"}\`\n` +
        `💬 _Global DMs:_ \`${globalDMs ? "Enabled ✅" : "Disabled ❌"}\`\n` +
        `🤖 _Current Model:_ \`${currentModel}\`\n` +
        `📈 _Model Fallback Level:_ \`${modelIndex + 1}/${models.length}\`\n` +
        `💭 _Context Messages:_ \`${contextSize}\`\n` +
        `🎯 _System Prompt:_ \`${globalSystemPrompt.substring(0, 100)}${
          globalSystemPrompt.length > 100 ? "..." : ""
        }\`\n\n` +
        (hasApiKey
          ? `*_Commands:_*\n` +
            `- \`.chatbot on/off\` - _Toggle in this chat_\n` +
            `- \`.chatbot on/off groups/dms\` - _Toggle globally_\n` +
            `- \`.chatbot set "prompt"\` - _Set system prompt_\n` +
            `- \`.chatbot clear [groups/dms]\` - _Clear conversation context_\n\n` +
            `*_How it works:_*\n` +
            `- _Bot responds in DMs, or when @mentioned or replied to in groups._\n` +
            `- _Reply to an image with a question for AI vision._`
          : `*_⚠️ Setup Required:_*\n` +
            `_You must set the API key to use the chatbot._\n\n` +
            `*_Set your API key:_*\n` +
            `\`.setvar GEMINI_API_KEY=your_api_key_here\`\n\n` +
            `_After setting the key, use \`.chatbot on\` to enable._`);

      return await message.sendReply(helpText);
    }

    const args = input.split(" ");
    const command = args[0].toLowerCase();
    const target = args[1]?.toLowerCase();

    // --- Command Handling ---
    switch (command) {
      case "on":
        if (!config.GEMINI_API_KEY) {
          return await message.sendReply(
            `*_❌ GEMINI_API_KEY Not Configured_*\n\n` +
              `_Cannot enable chatbot without Gemini API key._\n\n` +
              `*_Set your API key:_*\n` +
              `\`.setvar GEMINI_API_KEY=your_api_key_here\`\n\n` +
              `_After setting the key, use \`.chatbot on\`._`
          );
        }

        if (target === "groups") {
          await setVar("CHATBOT_ALL_GROUPS", "true");
          return await message.sendReply(
            `*_🤖 Chatbot Enabled for All Groups_*\n\n` +
              `✅ _Chatbot will now respond in all groups (via mentions/replies)_\n` +
              `_Use \`.chatbot off groups\` to disable._`
          );
        } else if (target === "dms") {
          await setVar("CHATBOT_ALL_DMS", "true");
          return await message.sendReply(
            `*_🤖 Chatbot Enabled for All DMs_*\n\n` +
              `✅ _Chatbot will now respond in all direct messages_\n` +
              `_Use \`.chatbot off dms\` to disable._`
          );
        } else {
          await enableChatbot(chatJid);
          return await message.sendReply(
            `*_🤖 Chatbot Enabled in this Chat_*\n\n` +
              `📍 _Chat:_ \`${chatJid.includes("@g.us") ? "Group" : "DM"}\`\n` +
              `_Next message will start a conversation with context._`
          );
        }

      case "off":
        if (target === "groups") {
          await setVar("CHATBOT_ALL_GROUPS", "false");
          return await message.sendReply(
            `*_🤖 Chatbot Disabled for All Groups_*\n\n` +
              `❌ _Chatbot will no longer respond in groups globally_\n` +
              `_Use \`.chatbot on groups\` to re-enable._`
          );
        } else if (target === "dms") {
          await setVar("CHATBOT_ALL_DMS", "false");
          return await message.sendReply(
            `*_🤖 Chatbot Disabled for All DMs_*\n\n` +
              `❌ _Chatbot will no longer respond in DMs globally_\n` +
              `_Use \`.chatbot on dms\` to re-enable._`
          );
        } else {
          await disableChatbot(chatJid);
          return await message.sendReply(
            `*_🤖 Chatbot Disabled in this Chat_*\n\n` +
              `_Conversation context has been cleared._`
          );
        }

      case "set":
        const promptMatch = input.match(/set\s+"([^"]+)"/);
        if (!promptMatch) {
          return await message.sendReply(
            `_Please provide the system prompt in quotes._\n\n` +
              `*_Example:_*\n` +
              `\`.chatbot set "You are a helpful assistant."\``
          );
        }
        const newPrompt = promptMatch[1];
        await saveSystemPrompt(newPrompt);
        return await message.sendReply(
          `*_🎯 System Prompt Updated_*\n\n` +
            `📝 _New Prompt:_ \`${newPrompt}\`\n\n` +
            `_This will apply to all new and cleared conversations._`
        );

      case "clear":
        if (target === "groups" || target === "dms") {
          await clearAllContexts(target);
          return await message.sendReply(
            `*_💭 Contexts Cleared for All ${
              target === "groups" ? "Groups" : "DMs"
            }_*\n\n` +
              `_Conversation histories have been reset._`
          );
        } else {
          clearContext(chatJid);
          return await message.sendReply(
            `*_💭 Context Cleared_*\n\n` +
              `_Conversation history has been reset for this chat._`
          );
        }
      case "status":
          // Status is handled by the default/no input case above
          return;

      default:
        return await message.sendReply(
          `_Unknown command: \`${command}\`_\n\n_Use \`.chatbot\` to see available commands._`
        );
    }
  }
);

// -----------------------------------------------------------------------------
// --- AUTO-REPLY MODULE (The actual listening logic) ---
// -----------------------------------------------------------------------------

Module(
  {
    on: "text", // Listen to all incoming text
    fromMe: false, // Don't reply to self messages
  },
  async (message) => {
    try {
      const chatJid = message.jid;
      const isGroup = message.isGroup;
      const messageText = message.text;

      // 1. Check if Chatbot is globally or individually enabled for this chat
      if (!isChatbotEnabled(chatJid)) {
        return;
      }

      // 2. Critical: Check for API Key
      if (!config.GEMINI_API_KEY) {
        return;
      }

      // 3. Determine if the bot should respond based on chat type
      let shouldRespond = false;
      
      if (!isGroup) { // Direct Message (DM)
        shouldRespond = true;
      } else { // Group Chat
        const botJid = message.client.user?.lid; 

        // Check for Mentions
        if (message.mention && message.mention.length > 0) {
          const botMentioned = message.mention.some((jid) => {
             // Simple check if any mentioned JID contains the bot's JID number
            return jid.startsWith(botJid?.split(":")[0]);
          });
          if (botMentioned) shouldRespond = true;
        }

        // Check for Reply to Bot
        if (message.reply_message && message.reply_message.jid) {
            // Check if the message is a reply to the bot's JID
          if (message.reply_message.jid.startsWith(botJid?.split(":")[0])) shouldRespond = true;
        }
      }

      if (!shouldRespond) {
        return;
      }

      // 4. Handle Image Reply (Multi-modal)
      let imageBuffer = null;
      let responseText = messageText;

      if (message.reply_message && message.reply_message.image) {
        try {
          // Download the image buffer
          imageBuffer = await message.reply_message.download("buffer"); 

          // If the user only replied to the image without text, use a default prompt
          if (!messageText || messageText.length < 2) {
            responseText = "What do you see in this image?";
          }
        } catch (error) {
          console.error("Error downloading image:", error);
          return await message.sendReply(
            "_❌ Failed to download image. Please try again._"
          );
        }
      } else if (messageText.length < 2) {
        // Ignore very short messages if no image is involved
        return;
      }

      // 5. Ignore Command Prefixes
      let commandPrefixes = [];
      const handlers = config.HANDLERS || ".,";
      if (typeof handlers === "string" && config.HANDLERS !== "false") {
          commandPrefixes = handlers.split("").filter((char) => char.trim());
      }
      
      // Check if the message starts with any configured command prefix
      if (
        commandPrefixes.length > 0 &&
        commandPrefixes.some((prefix) => responseText.startsWith(prefix))
      ) {
        return;
      }

      // 6. Get AI Response and Reply
      const aiResponse = await getAIResponse(
        responseText,
        chatJid,
        imageBuffer
      );

      if (aiResponse) {
        await message.sendReply(aiResponse);
      }
    } catch (error) {
      console.error("Error in message handler:", error);
    }
  }
);
