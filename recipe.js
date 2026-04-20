const { Module } = require("../main");
const config = require("../config");
const axios = require("axios");

// --- API Configuration ---
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
// Fixed: Using your confirmed active model ID
const MODEL = "gemini-2.5-flash-lite"; 

/**
 * Generates a structured JSON recipe based on user input.
 */
async function generateRecipe(ingredients) {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
        return "_❌ GEMINI_API_KEY not configured._";
    }

    const apiUrl = `${API_BASE_URL}${MODEL}:generateContent?key=${apiKey}`;

    const userQuery = `Create a detailed recipe using: ${ingredients}. Return the recipe strictly in JSON format.`;

    // Strict JSON Schema for Gemini
    const responseSchema = {
        type: "object",
        properties: {
            recipeName: { type: "string" },
            description: { type: "string" },
            servings: { type: "string" },
            prepTime: { type: "string" },
            cookTime: { type: "string" },
            ingredients: {
                type: "array",
                items: { type: "string" }
            },
            instructions: {
                type: "array",
                items: { type: "string" }
            }
        },
        required: ["recipeName", "description", "servings", "prepTime", "cookTime", "ingredients", "instructions"]
    };

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            maxOutputTokens: 2048,
            temperature: 0.7,
        },
        systemInstruction: {
            parts: [{ text: "You are a professional chef. Always respond with valid JSON following the schema provided." }]
        },
    };

    try {
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 25000, 
        });

        const jsonString = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (jsonString) {
            return JSON.parse(jsonString);
        } else {
            return "_❌ AI could not generate the recipe data._";
        }
    } catch (error) {
        console.error("Recipe generation error:", error.message);
        if (error.response) {
            return `_❌ API Error: ${error.response.data?.error?.message || "Check your API quota"}_`;
        }
        return "_❌ Connection error. Please try again._";
    }
}

// --- Command Module Definition ---

Module(
    {
        pattern: "recipe ?(.*)",
        fromMe: false, // Set to false so everyone can get cooking!
        desc: "Generates a structured cooking recipe.",
        usage: '.recipe chicken, rice, ginger',
        type: 'ai'
    },
    async (message, match) => {
        const ingredients = match[1]?.trim();

        if (!ingredients) {
            return await message.sendReply("🍳 *Please provide ingredients!*\nExample: `.recipe eggs, avocado, toast`.");
        }

        await message.sendReply(`👨‍🍳 _Chef is thinking... creating a recipe for "${ingredients}"..._`);

        const recipeResult = await generateRecipe(ingredients);

        if (typeof recipeResult === 'string') {
            return await message.sendReply(recipeResult);
        }

        // Formatting the JSON into a beautiful WhatsApp message
        const recipeMessage = 
            `*🍽️ ${recipeResult.recipeName.toUpperCase()} 🍽️*\n` +
            `_"${recipeResult.description}"_\n\n` +
            `*⏱️ DETAILS:*\n` +
            `• Servings: ${recipeResult.servings}\n` +
            `• Prep: ${recipeResult.prepTime}\n` +
            `• Cook: ${recipeResult.cookTime}\n\n` +
            `*🛒 INGREDIENTS:*\n` +
            recipeResult.ingredients.map(ing => `• ${ing}`).join('\n') + 
            `\n\n*👨‍🍳 INSTRUCTIONS:*\n` +
            recipeResult.instructions.map((step, i) => `*${i + 1}.* ${step}`).join('\n');

        return await message.sendReply(recipeMessage);
    }
);
