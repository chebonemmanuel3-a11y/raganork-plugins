const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODEL = "gemini-2.5-flash-preview-09-2025"; 

// --- Recipe Generation Function ---

/**
 * Generates a structured JSON recipe based on user input (ingredients and optional style).
 * @param {string} ingredients - The list of ingredients and optional cooking style.
 * @returns {object|string} The parsed recipe object or an error message.
 */
async function generateRecipe(ingredients) {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
        return "_❌ GEMINI_API_KEY not configured. Please set it using `.setvar GEMINI_API_KEY your_api_key`_";
    }

    const apiUrl = `${API_BASE_URL}${MODEL}:generateContent?key=${apiKey}`;

    const userQuery = `Create a detailed recipe using the following core ingredients and notes: ${ingredients}. The recipe must be in JSON format conforming strictly to the provided schema.`;

    // Define the exact JSON structure we want the model to return
    const responseSchema = {
        type: "OBJECT",
        properties: {
            "recipeName": { "type": "STRING", "description": "The creative name of the dish." },
            "description": { "type": "STRING", "description": "A short, appetizing description of the recipe." },
            "servings": { "type": "STRING", "description": "The number of people the recipe serves." },
            "prepTime": { "type": "STRING", "description": "The preparation time." },
            "cookTime": { "type": "STRING", "description": "The cooking time." },
            "ingredients": {
                "type": "ARRAY",
                "items": { "type": "STRING" },
                "description": "A list of all ingredients with specific quantities."
            },
            "instructions": {
                "type": "ARRAY",
                "items": { "type": "STRING" },
                "description": "A step-by-step list of instructions."
            }
        },
        // Ensure the order of properties in the output JSON
        "propertyOrdering": ["recipeName", "description", "servings", "prepTime", "cookTime", "ingredients", "instructions"]
    };

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        generationConfig: {
            // Mandate JSON output
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            maxOutputTokens: 2048, // Increased token limit for detailed recipe output
            temperature: 0.8,
        },
        // Optional system instruction to guide the persona/style of the recipe
        systemInstruction: {
            parts: [{ text: "You are a professional, helpful chef. Generate delicious and practical recipes in the requested JSON format." }]
        },
    };

    try {
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 20000, // Increased timeout for potentially complex generation
        });

        // Extract the JSON string from the response
        const jsonString = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (jsonString) {
            // Attempt to parse the JSON
            const recipe = JSON.parse(jsonString);
            return recipe;
        } else {
            return "_❌ AI could not generate a valid JSON recipe. Try a simpler request._";
        }
    } catch (error) {
        console.error("Recipe generation error:", error.message);
        // Handle common errors like network issues or parsing failures
        if (error.response) {
            return `_❌ API Error: ${error.response.data?.error?.message || "Unknown API error"}_`;
        }
        return "_❌ Network or Parsing error. Please check your API key and retry._";
    }
}

// --- Command Module Definition (.recipe) ---

Module(
  {
    pattern: "recipe ?(.*)",
    fromMe: true, // Only you can run management commands
    desc: "Generates a structured cooking recipe based on ingredients using Gemini AI.",
    usage: '.recipe chicken, rice, soy sauce, ginger (optional: make it fried rice)',
  },
  async (message, match) => {
    const ingredients = match[1]?.trim();

    if (!ingredients) {
      return await message.sendReply(
        `_Please provide a list of ingredients or a theme!_\n\n` +
        `*Usage:* \`.recipe chicken, rice, soy sauce, ginger (optional: make it fried rice)\``
      );
    }

    await message.sendReply(`_Searching for a recipe using "${ingredients}"... this may take a moment._`);

    const recipeResult = await generateRecipe(ingredients);

    // If the result is a string, it's an error message
    if (typeof recipeResult === 'string') {
        return await message.sendReply(recipeResult);
    }

    // Format the successful JSON recipe into a readable WhatsApp message
    const recipeMessage = 
        `*🍽️ ${recipeResult.recipeName} 🍽️*\n` +
        `_"${recipeResult.description}"_\n\n` +
        `*⏱️ Details:*\n` +
        `• Servings: ${recipeResult.servings}\n` +
        `• Prep Time: ${recipeResult.prepTime}\n` +
        `• Cook Time: ${recipeResult.cookTime}\n\n` +
        `*🛒 Ingredients:*\n` +
        recipeResult.ingredients.map((ing, index) => `• ${ing}`).join('\n') + 
        `\n\n*👨‍🍳 Instructions:*\n` +
        recipeResult.instructions.map((step, index) => `*${index + 1}.* ${step}`).join('\n');

    return await message.sendReply(recipeMessage);
  }
);
