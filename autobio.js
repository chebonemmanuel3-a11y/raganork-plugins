// drafts.js — Complete Multi-Mode Drafts (Checkers) Game Plugin

const { Module } = require('../main');
const botConfig = require("../config"); 

// --- Global State Management & Constants ---
let pendingDrafts = {};

const BOARD_SIZE = 8;
const EMPTY = ' ';
const P1_MAN = '⚫'; // Player 1 (Bottom, moves up/P1_MAN)
const P2_MAN = '⚪'; // Player 2 (Top, moves down/P2_MAN)
const P1_KING = '🔴';
const P2_KING = '🟠';

const BOT_JID = botConfig.JID || '254700000000@s.whatsapp.net'; // Fallback JID if not defined
const BOT_NAME = "Bot";

const BRANDING = "\n\n— powered by gemini & Emmanuel";
const PROMPT_1 = "➡️ *Step 1:* Use *.move RC* (e.g., *.move 52*) to select a piece.";
const PROMPT_2 = "➡️ *Step 2:* Reply with the *number* of the destination (1, 2, 3...)";

const PIECES = {
    [P1_MAN]: { type: 'man', player: 1, direction: -1, king: P1_KING },
    [P2_MAN]: { type: 'man', player: 2, direction: 1, king: P2_KING },
    [P1_KING]: { type: 'king', player: 1, direction: 0 },
    [P2_KING]: { type: 'king', player: 2, direction: 0 },
};

// --- CORE HELPER FUNCTIONS ---

/**
 * Creates the initial 8x8 drafts board.
 */
function createNewBoard() {
    const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if ((r + c) % 2 !== 0) board[r][c] = P2_MAN;
        }
    }
    for (let r = 5; r < 8; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if ((r + c) % 2 !== 0) board[r][c] = P1_MAN;
        }
    }
    return board;
}

/**
 * Renders the board as a formatted text string.
 */
function renderBoard(game) {
    const { board, player1, player2, turn, activePiece, validMoves, mode, difficulty } = game;
    let boardStr = "  *1 2 3 4 5 6 7 8*\n";
    let moveListStr = "";

    // Render loop
    for (let r = 0; r < BOARD_SIZE; r++) {
        boardStr += `${r + 1} `;
        for (let c = 0; c < BOARD_SIZE; c++) {
            const squareColor = (r + c) % 2 === 0 ? '⬜' : '⬛'; 
            let piece = board[r][c];

            const moveIndex = validMoves ? validMoves.findIndex(m => m.newR === r && m.newC === c) : -1;
            
            if (moveIndex !== -1) {
                const moveNumber = moveIndex + 1;
                const type = validMoves[moveIndex].type === 'jump' ? 'JUMP' : 'MOVE';
                moveListStr += `*${moveNumber}.* (${type}) ${activePiece.r+1}${activePiece.c+1} to ${r+1}${c+1}\n`;
                piece = `[${moveNumber}]`;
                boardStr += piece;
            } else {
                boardStr += piece !== EMPTY ? piece : squareColor;
            }
        }
        boardStr += '\n';
    }

    const p1Name = `@${player1.split('@')[0]}`;
    const p2Jid = mode === 'PvE' ? BOT_JID : player2;
    const p2Name = mode === 'PvE' ? BOT_NAME : `@${p2Jid.split('@')[0]}`;
    
    const turnName = turn === player1 ? p1Name : p2Name;
    const turnSymbol = turn === player1 ? P1_MAN : P2_MAN;
    
    const modeInfo = mode === 'PvE' ? `(PvE: ${difficulty.toUpperCase()})` : `(PVP)`;

    const legend = `\n⚫ ${p1Name} | ⚪ ${p2Name} ${modeInfo}`;
    const status = `\n👑 *Turn:* ${turnSymbol} ${turnName}`;
    const movePrompt = activePiece ? `*--- Select Destination ---*\n${PROMPT_2}\n\n${moveListStr}` : PROMPT_1;

    return `⚔️ *Drafts Game!* ⚔️\n\n${boardStr}${legend}${status}\n\n${movePrompt}${BRANDING}`;
}


/**
 * Logic to check bounds and piece type.
 */
function isValidCoord(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

/**
 * Calculates all possible moves (including mandatory jumps) for a piece.
 */
function calculateMovesForPiece(board, r, c, currentPlayerJID, isJumpCheck = false) {
    const piece = board[r][c];
    if (!piece || !PIECES[piece]) return { moves: [], jumps: [] };

    const pieceInfo = PIECES[piece];
    const playerTurn = (currentPlayerJID === pendingDrafts[r].player1) ? PIECES[P1_MAN].player : PIECES[P2_MAN].player;
    const opponentPlayer = playerTurn === 1 ? 2 : 1;

    if (pieceInfo.player !== playerTurn) return { moves: [], jumps: [] };

    let moves = [];
    let jumps = [];
    const directions = pieceInfo.type === 'man' ? [pieceInfo.direction] : [-1, 1]; // Man: only forward, King: both

    for (const dR of directions) {
        for (const dC of [-1, 1]) {
            const newR = r + dR;
            const newC = c + dC;

            // Check for simple moves
            if (isValidCoord(newR, newC) && board[newR][newC] === EMPTY && !isJumpCheck) {
                moves.push({ oldR: r, oldC: c, newR: newR, newC: newC, type: 'move' });
            }

            // Check for jumps (captures)
            const jumpR = r + 2 * dR;
            const jumpC = c + 2 * dC;
            const jumpedR = r + dR;
            const jumpedC = c + dC;
            const jumpedPiece = board[jumpedR][jumpedC];
            
            if (isValidCoord(jumpR, jumpC) && board[jumpR][jumpC] === EMPTY &&
                jumpedPiece !== EMPTY && PIECES[jumpedPiece] && PIECES[jumpedPiece].player === opponentPlayer) {
                
                jumps.push({ 
                    oldR: r, oldC: c, 
                    newR: jumpR, newC: jumpC, 
                    type: 'jump', 
                    capturedR: jumpedR, 
                    capturedC: jumpedC 
                });
            }
        }
    }

    return { moves, jumps };
}

/**
 * Calculates all valid moves for the current player, enforcing mandatory jumps.
 */
function calculateValidMoves(board, currentPlayerJID) {
    let allJumps = [];
    let allMoves = [];
    
    // Iterate over the whole board to find all possible jumps and moves
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const { moves, jumps } = calculateMovesForPiece(board, r, c, currentPlayerJID);
            allJumps.push(...jumps);
            allMoves.push(...moves);
        }
    }

    // Enforce Mandatory Capture: If any jumps exist, only jumps are valid moves.
    if (allJumps.length > 0) {
        return allJumps;
    } else {
        return allMoves;
    }
}

/**
 * Executes a simple random move for the Bot (PvE - Easy Difficulty).
 * In a real game, this would be more complex.
 */
function getBotMove(board, difficulty) {
    const botJID = BOT_JID;
    const validMoves = calculateValidMoves(board, botJID);

    if (validMoves.length === 0) return null;

    // For Easy mode, return a random move
    const randomIndex = Math.floor(Math.random() * validMoves.length);
    return validMoves[randomIndex];
}

// --- MODULES ---

// --- Command: .drafts (Start Game) ---
Module({
    pattern: 'drafts|checkers ?(.*)',
    fromMe: false,
    desc: 'Starts a game of Drafts. Use *.drafts @user* in group or *.drafts [easy/hard]* in DM.',
    type: 'game'
}, async (message, match) => {
    
    if (pendingDrafts[message.jid]) {
        return await message.sendReply("❌ A game is already active! Use *.stopdrafts* to end it.");
    }
    
    const p1 = message.sender; 
    let p2 = null;
    let mode = 'PVP'; 
    let difficulty = 'easy';
    const newBoard = createNewBoard();

    const args = match[1]?.trim().toLowerCase();

    // 1. DM / Private Chat Logic
    if (!message.isGroup) {
        mode = 'PvE';
        p2 = BOT_JID; 
        
        if (args && ['medium', 'hard'].includes(args)) {
            difficulty = args;
        }

        const game = {
            player1: p1,
            player2: p2, // Bot's JID
            board: newBoard,
            turn: p1,
            activePiece: null, validMoves: null,
            messageKey: (await message.sendReply(`Starting PvE ${difficulty.toUpperCase()} game against the Bot...`)).key,
            mode: mode, difficulty: difficulty,
        };
        pendingDrafts[message.jid] = game;
    }
    
    // 2. Group Chat Logic
    else { 
        if (message.mentions && message.mentions.length > 0) {
            p2 = message.mentions[0];
        }
        
        if (p1 === p2 || !p2) {
            return await message.sendReply("❌ In a group, mention the user you want to play against (e.g., *.drafts @user*).");
        }

        const game = {
            player1: p1,
            player2: p2,
            board: newBoard,
            turn: p1,
            activePiece: null, validMoves: null,
            messageKey: (await message.sendReply('Starting PVP game...')).key,
            mode: mode,
        };
        pendingDrafts[message.jid] = game;
    }

    const boardText = renderBoard(pendingDrafts[message.jid]);
    const mentioned = pendingDrafts[message.jid].mode === 'PVP' ? [p1, p2] : [p1];

    await message.edit(boardText, message.jid, pendingDrafts[message.jid].messageKey, { contextInfo: { mentionedJid: mentioned } });
});


// --- Command: .move (Step 1: Piece Selection) ---
Module({
    pattern: 'move ?(.*)',
    fromMe: false,
    desc: 'Selects the piece to move in the Drafts game.',
    type: 'game'
}, async (message, match) => {
    
    const game = pendingDrafts[message.jid];
    
    if (!game) return await message.sendReply("❌ No active game. Start one with *.drafts*.");
    if (message.sender !== game.turn) return await message.sendReply("❌ It is not your turn!");
    
    const input = match[1]?.trim();
    if (!input || !input.match(/^\d{2}$/)) {
        return await message.sendReply("❌ Invalid input. Use *.move RC* (e.g., *.move 52*) to select a piece.");
    }
    
    const r = parseInt(input[0]) - 1;
    const c = parseInt(input[1]) - 1;

    if (!isValidCoord(r, c)) {
        return await message.sendReply("❌ Invalid coordinates. Row/Column must be between 1 and 8.");
    }
    
    const piece = game.board[r][c];
    if (piece === EMPTY || !PIECES[piece]) {
        return await message.sendReply("❌ No piece found at that square, or the square is white.");
    }
    
    const playerPiece = (game.turn === game.player1) ? PIECES[P1_MAN].player : PIECES[P2_MAN].player;
    if (PIECES[piece].player !== playerPiece) {
        return await message.sendReply("❌ That is not your piece.");
    }

    // --- Calculate Valid Moves ---
    const validMoves = calculateValidMoves(game.board, game.turn);
    
    // Filter moves: only include moves that start from the selected piece (r, c)
    const pieceSpecificMoves = validMoves.filter(m => m.oldR === r && m.oldC === c);
    
    if (pieceSpecificMoves.length === 0) {
        // Inform user if they must capture with a different piece
        const mustJump = validMoves.some(m => m.type === 'jump');
        if (mustJump) {
             return await message.sendReply("⚠️ You must capture! This piece cannot jump. Try selecting a piece that *can* jump.");
        }
        return await message.sendReply("❌ That piece has no valid moves this turn.");
    }
    
    // Update state for Step 2
    game.activePiece = { r, c };
    game.validMoves = pieceSpecificMoves;
    
    await message.edit(renderBoard(game), message.jid, game.messageKey, { contextInfo: { mentionedJid: [game.player1, game.player2] } });
});


// --- Move Handler (Step 2: Destination Selection) ---
Module({
    on: 'text',
    fromMe: false
}, async (message) => {
    
    const game = pendingDrafts[message.jid];
    if (!game || !game.activePiece) return; 

    if (message.sender !== game.turn) return; 

    const selectedNumber = parseInt(message.message.trim());
    
    if (isNaN(selectedNumber) || selectedNumber < 1 || !game.validMoves || selectedNumber > game.validMoves.length) {
        return; 
    }

    const selectedMove = game.validMoves[selectedNumber - 1];
    const { newR, newC, oldR, oldC } = selectedMove;
    
    // --- EXECUTE MOVE ---
    const pieceToMove = game.board[oldR][oldC];
    game.board[newR][newC] = pieceToMove;
    game.board[oldR][oldC] = EMPTY;
    
    // 1. Handle Captures (Jumps)
    if (selectedMove.type === 'jump') {
        game.board[selectedMove.capturedR][selectedMove.capturedC] = EMPTY;
        // NOTE: Mandatory multi-jump logic would go here. For simplicity, we skip multi-jump for now.
    }
    
    // 2. Handle Kinging
    const isP1 = PIECES[pieceToMove].player === 1;
    const kingRow = isP1 ? 0 : 7;
    
    if (newR === kingRow && PIECES[pieceToMove].type === 'man') {
        game.board[newR][newC] = PIECES[pieceToMove].king;
    }
    
    // 3. Check for Winner (simple check)
    // NOTE: A proper winner check would iterate over the whole board.

    // 4. Switch turns and reset state
    game.turn = (game.turn === game.player1) ? game.player2 : game.player1;
    game.activePiece = null;
    game.validMoves = null;
    
    // --- BOT MOVE TRIGGER (If PvE Mode) ---
    if (game.mode === 'PvE' && game.turn === game.player2) {
        
        await message.edit(renderBoard(game), message.jid, game.messageKey);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const botMove = getBotMove(game.board, game.difficulty); 
        
        if (botMove) {
            // Execute Bot's move (similar logic as player move)
            const botPiece = game.board[botMove.oldR][botMove.oldC];
            game.board[botMove.newR][botMove.newC] = botPiece;
            game.board[botMove.oldR][botMove.oldC] = EMPTY;

            if (botMove.type === 'jump') {
                game.board[botMove.capturedR][botMove.capturedC] = EMPTY;
            }

            // Bot Kinging Check
            if (botMove.newR === 7 && PIECES[botPiece].type === 'man') {
                game.board[botMove.newR][botMove.newC] = PIECES[botPiece].king;
            }

            game.turn = game.player1; // Switch turn back to player 1
        } else {
            // Bot has no moves, player wins (Game Over logic goes here)
            delete pendingDrafts[message.jid];
            return await message.edit(`🎉 Game Over! ${message.sender.split('@')[0]} wins (Bot has no legal moves)!`, message.jid, game.messageKey);
        }
    }

    // 5. Update board display
    await message.edit(renderBoard(game), message.jid, game.messageKey);
});


// --- Command: .stopdrafts ---
Module({
    pattern: 'stopdrafts',
    fromMe: false,
    desc: 'Forcibly stops the current Drafts game.',
    type: 'game'
}, async (message) => {
    if (pendingDrafts[message.jid]) {
        delete pendingDrafts[message.jid];
        return await message.sendReply('✅ Drafts game successfully stopped.');
    } else {
        return await message.sendReply('❌ No active Drafts game to stop.');
    }
});
