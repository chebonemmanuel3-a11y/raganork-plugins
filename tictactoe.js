const { Module } = require('../main');
const botConfig = require("../config");
const isFromMe = botConfig.MODE === "public" ? false : true;

const games = {}; // key: user id, value: game state

function renderBoard(board) {
  return (
    `${board[0]} | ${board[1]} | ${board[2]}\n` +
    `---------\n` +
    `${board[3]} | ${board[4]} | ${board[5]}\n` +
    `---------\n` +
    `${board[6]} | ${board[7]} | ${board[8]}`
  );
}

Module({
  pattern: 'ttt ?(.*)',
  fromMe: isFromMe,
  desc: 'Play Tic-Tac-Toe with emojis',
  type: 'games'
}, async (message, match) => {
  const cmd = (match[1] || '').trim().toLowerCase();
  const userId = message.sender;

  if (cmd === 'start' || cmd === '') {
    games[userId] = {
      board: ['1','2','3','4','5','6','7','8','9'],
      turn: '❌', // user is ❌, bot is ⭕
      inProgress: true
    };
    return await message.sendReply(
      `🎮 Emoji Tic‑Tac‑Toe started!\nYou are ❌. Reply with a number (1–9).\n\n${renderBoard(games[userId].board)}`
    );
  }

  if (cmd === 'end') {
    delete games[userId];
    return await message.sendReply('🛑 Game ended.');
  }
});
