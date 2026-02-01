import {
    board,
    currentTurn,
    movePiece,
    isValidMove,
    WHITE,
    BLACK,
    isKingInDanger
} from "./chessLogic.js";

/* ================= CONFIG ================= */

let AI_DEPTH = 3;

export function setAIDifficulty(level) {
    if (level === "easy") AI_DEPTH = 3;
    else if (level === "medium") AI_DEPTH = 4;
    else if (level === "hard") AI_DEPTH = 5;
    else AI_DEPTH = 6; // extreme (future)
}

/* ================= PIECE VALUES ================= */

const PIECE_VALUES = {
    pawn: 10,
    knight: 35,
    bishop: 35,
    rook: 55,
    queen: 100,
    king: 10000
};

/* ================= POSITION WEIGHTS ================= */

const positionWeights = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2, 2, 2, 2],
    [2, 3, 4, 4, 4, 4, 3, 2],
    [3, 4, 6, 6, 6, 6, 4, 3],
    [3, 4, 6, 6, 6, 6, 4, 3],
    [2, 3, 4, 4, 4, 4, 3, 2],
    [2, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 0, 0, 0]
];

/* ================= BOARD EVALUATION ================= */

function evaluateBoard() {
    let score = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) continue;

            let value =
                PIECE_VALUES[p.type] +
                positionWeights[r][c];

            // Bonus: checking opponent
            if (isKingInDanger(p.color === WHITE ? BLACK : WHITE)) {
                value += 15;
            }

            score += p.color === WHITE ? value : -value;
        }
    }

    return score;
}

/* ================= MOVE GENERATION ================= */

function getAvailableMoves(color) {
    const moves = [];

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece || piece.color !== color) continue;

            for (let tr = 0; tr < 8; tr++) {
                for (let tc = 0; tc < 8; tc++) {
                    if (!isValidMove({ r, c }, { r: tr, c: tc })) continue;

                    const target = board[tr][tc];
                    let bonus = 0;

                    // 🔥 CAPTURE PRIORITY
                    if (target) {
                        bonus += PIECE_VALUES[target.type] * 2;
                    }

                    moves.push({
                        from: { r, c },
                        to: { r: tr, c: tc },
                        bonus
                    });
                }
            }
        }
    }

    // 🔥 Sort moves: captures first
    moves.sort((a, b) => b.bonus - a.bonus);

    return moves;
}

/* ================= MINIMAX ================= */

function minimax(depth, isMax, alpha, beta) {
    if (depth === 0) return evaluateBoard();

    const color = isMax ? WHITE : BLACK;
    const moves = getAvailableMoves(color);

    if (isMax) {
        let best = -Infinity;
        for (const m of moves) {
            const temp = board[m.to.r][m.to.c];
            board[m.to.r][m.to.c] = board[m.from.r][m.from.c];
            board[m.from.r][m.from.c] = null;

            best = Math.max(best, minimax(depth - 1, false, alpha, beta));

            board[m.from.r][m.from.c] = board[m.to.r][m.to.c];
            board[m.to.r][m.to.c] = temp;

            alpha = Math.max(alpha, best);
            if (beta <= alpha) break;
        }
        return best;
    } else {
        let best = Infinity;
        for (const m of moves) {
            const temp = board[m.to.r][m.to.c];
            board[m.to.r][m.to.c] = board[m.from.r][m.from.c];
            board[m.from.r][m.from.c] = null;

            best = Math.min(best, minimax(depth - 1, true, alpha, beta));

            board[m.from.r][m.from.c] = board[m.to.r][m.to.c];
            board[m.to.r][m.to.c] = temp;

            beta = Math.min(beta, best);
            if (beta <= alpha) break;
        }
        return best;
    }
}

/* ================= AI MOVE ================= */

export function aiMove() {
    const moves = getAvailableMoves(currentTurn);
    let bestMove = null;
    let bestValue = currentTurn === WHITE ? -Infinity : Infinity;

    for (const m of moves) {
        const temp = board[m.to.r][m.to.c];
        board[m.to.r][m.to.c] = board[m.from.r][m.from.c];
        board[m.from.r][m.from.c] = null;

        const value = minimax(
            AI_DEPTH - 1,
            currentTurn === BLACK,
            -Infinity,
            Infinity
        );

        board[m.from.r][m.from.c] = board[m.to.r][m.to.c];
        board[m.to.r][m.to.c] = temp;

        const finalValue = value + m.bonus;

        if (
            (currentTurn === WHITE && finalValue > bestValue) ||
            (currentTurn === BLACK && finalValue < bestValue)
        ) {
            bestValue = finalValue;
            bestMove = m;
        }
    }

    if (bestMove) {
        return movePiece(bestMove.from, bestMove.to);
    }
    return null;
}
