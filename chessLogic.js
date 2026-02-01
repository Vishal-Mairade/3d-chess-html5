export const EMPTY = null;
export const WHITE = "white";
export const BLACK = "black";

export let board = [];
export let currentTurn = WHITE;

export function initBoard(startTurn = "white") {
    board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    currentTurn = startTurn === "white" ? WHITE : BLACK;

    const layout = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

    for (let i = 0; i < 8; i++) {
        board[0][i] = { type: layout[i], color: BLACK };
        board[1][i] = { type: "pawn", color: BLACK };
        board[6][i] = { type: "pawn", color: WHITE };
        board[7][i] = { type: layout[i], color: WHITE };
    }
}

export function switchTurn() {
    currentTurn = currentTurn === WHITE ? BLACK : WHITE;
}

export function isValidMove(from, to, simulate = false) {
    const piece = board[from.r][from.c];
    const target = board[to.r][to.c];
    if (!piece) return false;
    if (!simulate && piece.color !== currentTurn) return false;
    if (target && target.color === piece.color) return false;

    const dr = to.r - from.r;
    const dc = to.c - from.c;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);

    const isPathClear = (rs, cs) => {
        let r = from.r + rs;
        let c = from.c + cs;
        while (r !== to.r || c !== to.c) {
            if (board[r][c] !== EMPTY) return false;
            r += rs;
            c += cs;
        }
        return true;
    };

    let possible = false;

    if (piece.type === "pawn") {
        const dir = piece.color === WHITE ? -1 : 1;
        const startRow = piece.color === WHITE ? 6 : 1;

        if (dc === 0 && dr === dir && !target) possible = true;
        else if (
            dc === 0 &&
            dr === 2 * dir &&
            from.r === startRow &&
            !target &&
            board[from.r + dir][from.c] === EMPTY
        ) possible = true;
        else if (absDc === 1 && dr === dir && target) possible = true;
    }
    else if (piece.type === "rook") {
        if (dr === 0 || dc === 0) possible = isPathClear(Math.sign(dr), Math.sign(dc));
    }
    else if (piece.type === "bishop") {
        if (absDr === absDc) possible = isPathClear(Math.sign(dr), Math.sign(dc));
    }
    else if (piece.type === "queen") {
        if (dr === 0 || dc === 0 || absDr === absDc)
            possible = isPathClear(Math.sign(dr), Math.sign(dc));
    }
    else if (piece.type === "king") {
        if (absDr <= 1 && absDc <= 1) possible = true;
    }
    else if (piece.type === "knight") {
        if ((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2)) possible = true;
    }

    if (possible && !simulate) {
        return !wouldBeInCheck(from, to, piece.color);
    }
    return possible;
}

function wouldBeInCheck(from, to, color) {
    const save = board[to.r][to.c];
    board[to.r][to.c] = board[from.r][from.c];
    board[from.r][from.c] = EMPTY;

    const danger = isKingInDanger(color);

    board[from.r][from.c] = board[to.r][to.c];
    board[to.r][to.c] = save;

    return danger;
}

export function isKingInDanger(color) {
    const king = getKingPos(color);
    if (!king) return false;
    const enemy = color === WHITE ? BLACK : WHITE;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c]?.color === enemy) {
                if (isValidMove({ r, c }, king, true)) return true;
            }
        }
    }
    return false;
}

export function getKingPos(color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c]?.type === "king" && board[r][c].color === color)
                return { r, c };
        }
    }
    return null;
}

/* ✅ MOVE + PROMOTION FLAG */
export function movePiece(from, to) {
    const movingPiece = board[from.r][from.c];
    const targetPiece = board[to.r][to.c];

    let captured = null;
    let promoted = false;

    if (targetPiece) captured = { ...targetPiece };

    board[to.r][to.c] = movingPiece;
    board[from.r][from.c] = EMPTY;

    if (
        movingPiece.type === "pawn" &&
        ((movingPiece.color === WHITE && to.r === 0) ||
            (movingPiece.color === BLACK && to.r === 7))
    ) {
        promoted = true; // 👑 UI decide karegi
    }

    switchTurn();
    return { captured, promoted };
}

export function hasAnyLegalMove(color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c]?.color === color) {
                for (let tr = 0; tr < 8; tr++) {
                    for (let tc = 0; tc < 8; tc++) {
                        if (isValidMove({ r, c }, { r: tr, c: tc })) return true;
                    }
                }
            }
        }
    }
    return false;
}

export function isCheckmate(color) {
    return isKingInDanger(color) && !hasAnyLegalMove(color);
}
