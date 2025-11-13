const { Module } = require('../main');

// --- Game State Storage ---
// In a real bot, you'd use a database, but for simplicity, we use in-memory state.
const gameSessions = {}; // Stores { chatId: { word: '...', guessedLetters: Set(), attempts: 6 } }

const MAX_ATTEMPTS = 6;
const WORD_LIST = [
    "python", "javascript", "program", "gemini", "developer", "module",
    "terminal", "container", "coding", "algorithm", "function", "bot"
];

// --- Helper Functions ---

/**
 * Returns the current state of the word with unguessed letters replaced by blanks.
 * @param {string} word 
 * @param {Set<string>} guessedLetters 
 * @returns {string} The displayed word (e.g., P _ T H _ N)
 */
function getDisplayWord(word, guessedLetters) {
    return word.split('').map(letter => guessedLetters.has(letter) ? letter.toUpperCase() : '_').join(' ');
}

/**
 * Generates the Hangman ASCII Art
 * @param {number} attemptsLeft 
 * @returns {string} ASCII art
 */
function getHangmanArt(attemptsLeft) {
    const art = [
        `
  +---+
  |   |
      |
      |
      |
      |
=========\n`, // 6 attempts
        `
  +---+
  |   |
  O   |
      |
      |
      |
=========\n`, // 5 attempts
        `
  +---+
  |   |
  O   |
  |   |
      |
      |
=========\n`, // 4 attempts
        `
  +---+
  |   |
  O   |
 /|   |
      |
      |
=========\n`, // 3 attempts
        `
  +---+
  |   |
  O   |
 /|\\  |
      |
      |
=========\n`, // 2 attempts
        `
  +---+
  |   |
  O   |
 /|\\  |
 /    |
      |
=========\n`, // 1 attempt
        `
  +---+
  |   |
  O/|\\
 / \\ 
      |
      |
=========\n` // 0 attempts (DEAD)
    ];
    return art[MAX_ATTEMPTS - attemptsLeft];
}


// --- 1. START Command (.hangman) ---
Module({
    pattern: 'hangman',
    fromMe: false, // Allow anyone to start the game
    desc: 'Starts a new Hangman game.',
    type: 'game'
}, async (message) => {
    const chatId = message.jid;

    if (gameSessions[chatId]) {
        return await message.sendReply("⚠️ A Hangman game is already in progress in this chat. Guess a letter or use *.hangabort* to end it.");
    }

    const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    
    gameSessions[chatId] = {
        word: word,
        guessedLetters: new Set(),
        attempts: MAX_ATTEMPTS
    };

    const displayWord = getDisplayWord(word, gameSessions[chatId].guessedLetters);
    const art = getHangmanArt(MAX_ATTEMPTS);

    let reply = `
*--- 🪢 HANGMAN GAME STARTED 🪢 ---*
The mystery word has ${word.length} letters.

${art}
Word: ${displayWord}
Attempts Left: ${MAX_ATTEMPTS}
Guessed Letters: None

To guess, simply send the letter (or the full word) starting with your command prefix, like *.g a* or *.guess word*.
Use *.hangabort* to quit.
`;
    await message.sendReply(reply.trim());
});

// --- 2. GUESS Command (.g or .guess) ---
Module({
    pattern: '(g|guess) ?(.*)',
    fromMe: false,
    desc: 'Guesses a letter or the full word in Hangman.',
    type: 'game'
}, async (message, match) => {
    const chatId = message.jid;
    const session = gameSessions[chatId];
    const guess = match[2]?.toLowerCase().trim();

    if (!session) {
        return await message.sendReply("❌ No Hangman game is active. Start a new one with *.hangman*.");
    }
    if (!guess) {
        return await message.sendReply("Please provide a letter or the full word to guess, e.g., *.g a*");
    }

    let statusMessage = "";
    let isGameEnd = false;

    // --- A. Full Word Guess ---
    if (guess.length > 1) {
        if (guess === session.word) {
            statusMessage = `🎉 *CONGRATULATIONS!* 🎉\nYou guessed the word: *${session.word.toUpperCase()}*`;
            isGameEnd = true;
        } else {
            session.attempts--;
            statusMessage = `❌ Wrong word guess! The word was NOT *${guess.toUpperCase()}*.`;
        }
    } 
    // --- B. Single Letter Guess ---
    else if (guess.length === 1) {
        const letter = guess[0];

        if (session.guessedLetters.has(letter)) {
            statusMessage = `☝️ You already guessed the letter *${letter.toUpperCase()}*. Try another one!`;
        } else {
            session.guessedLetters.add(letter);

            if (session.word.includes(letter)) {
                statusMessage = `✅ Correct guess! Letter *${letter.toUpperCase()}* found.`;
                
                // Check for win condition after correct guess
                const display = getDisplayWord(session.word, session.guessedLetters);
                if (!display.includes('_')) {
                    statusMessage = `🥳 *VICTORY!* You correctly guessed the word: *${session.word.toUpperCase()}*`;
                    isGameEnd = true;
                }
            } else {
                session.attempts--;
                statusMessage = `❌ Incorrect guess. Letter *${letter.toUpperCase()}* is not in the word.`;
            }
        }
    } else {
        return await message.sendReply("Invalid guess. Guess a single letter or the full word.");
    }
    
    // --- C. Check Game End Conditions ---
    if (session.attempts <= 0 && !isGameEnd) {
        statusMessage += `\n\n💀 *GAME OVER!* You ran out of attempts.\nThe word was: *${session.word.toUpperCase()}*`;
        isGameEnd = true;
    }

    let reply = "";
    if (isGameEnd) {
        delete gameSessions[chatId];
        reply = statusMessage;
    } else {
        const displayWord = getDisplayWord(session.word, session.guessedLetters);
        const art = getHangmanArt(session.attempts);
        const guessedList = Array.from(session.guessedLetters).map(l => l.toUpperCase()).join(', ') || 'None';

        reply = `
*--- 🪢 HANGMAN STATUS 🪢 ---*
${statusMessage}

${art}
Word: ${displayWord}
Attempts Left: ${session.attempts}
Guessed Letters: ${guessedList}
`;
    }
    
    await message.sendReply(reply.trim());
});

// --- 3. ABORT Command (.hangabort) ---
Module({
    pattern: 'hangabort',
    fromMe: false,
    desc: 'Aborts the current Hangman game.',
    type: 'game'
}, async (message) => {
    const chatId = message.jid;

    if (gameSessions[chatId]) {
        const word = gameSessions[chatId].word.toUpperCase();
        delete gameSessions[chatId];
        await message.sendReply(`👋 Game aborted. The word was: *${word}*.`);
    } else {
        await message.sendReply("❌ No Hangman game is currently active in this chat.");
    }
});
