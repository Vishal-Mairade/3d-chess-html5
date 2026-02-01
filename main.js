import * as THREE from "three";
import { OrbitControls } from "./OrbitControls.js";
import { initBoard, board, currentTurn, isValidMove, movePiece, WHITE, getKingPos, isKingInDanger, isCheckmate } from "./chessLogic.js";
import { aiMove, setAIDifficulty } from "./ai.js";

let pendingPromotion = null;
let scene, camera, renderer, controls;
let tiles = [];
let pieceMeshes = {};
let selectedTile = null;
let gameStarted = false;
let vsAI = false;
let playerColor = WHITE;
let pendingAIMode = false;

/* ================= SOUNDS ================= */
const sounds = {
    select: new Audio("./assets/sounds/select.wav"),
    click: new Audio("./assets/sounds/click.wav"),
    move: new Audio("./assets/sounds/move.wav"),
    capture: new Audio("./assets/sounds/capture.mp3"),
    checkmate: new Audio("./assets/sounds/checkmate.mp3"),
    promotion: new Audio("./assets/sounds/promotion.wav"),
};

function playSound(name) {
    const s = sounds[name];
    if (!s) return;
    s.currentTime = 0;
    s.volume = 0.8; // adjust if needed
    s.play().catch(() => { });
}


/* ================= BUTTONS ================= */
document.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => playSound("click"));
});

document.getElementById("aiBtn").onclick = () => {
    pendingAIMode = true;
    document.getElementById("startScreen").style.display = "none";
    document.getElementById("aiPopup").style.display = "flex";
};
document.getElementById("friendBtn").onclick = () => { pendingAIMode = false; showSidePopup(); };
document.getElementById("chooseWhite").onclick = () => startWithSide("white");
document.getElementById("chooseBlack").onclick = () => startWithSide("black");
document.getElementById("restartBtn").onclick = restartGame;
document.getElementById("menuBtn").onclick = goToMainMenu;
document.getElementById("aiEasy").onclick = () => rememberAIDifficulty("easy");
document.getElementById("aiMedium").onclick = () => rememberAIDifficulty("medium");
document.getElementById("aiHard").onclick = () => rememberAIDifficulty("hard");
// ✅ CHECKMATE POPUP BUTTONS
document.getElementById("checkmateRestart").onclick = () => {
    document.getElementById("checkmatePopup").style.display = "none";
    restartGame();
};

document.getElementById("checkmateMenu").onclick = () => {
    document.getElementById("checkmatePopup").style.display = "none";
    goToMainMenu();
};

document.querySelectorAll("#promotionPopup button").forEach(btn => {
    btn.addEventListener("click", () => {
        const piece = btn.dataset.piece;
        const { r, c, color } = pendingPromotion;

        board[r][c] = { type: piece, color };

        pendingPromotion = null;
        document.getElementById("promotionPopup").style.display = "none";

        updatePieces();
        updateTurnText();
        checkForCheckmate();
    });
});

function rememberAIDifficulty(level) {
    setAIDifficulty(level);
    document.getElementById("aiPopup").style.display = "none";
    showSidePopup(); // now choose white / black
}


function showSidePopup() {
    document.getElementById("startScreen").style.display = "none";
    document.getElementById("sidePopup").style.display = "flex";
}

function startWithSide(color) {
    document.getElementById("sidePopup").style.display = "none";
    document.getElementById("ui").style.display = "block";
    document.getElementById("gameCanvas").style.display = "block";
    playerColor = color;
    vsAI = pendingAIMode;
    gameStarted = true;
    initThree();
    initBoard(playerColor);
    createBoard();
    createPieces();
    updateTurnText();
    if (playerColor === "black") {
        camera.position.set(6, 9, -6);
        camera.lookAt(0, 0, 0);
    }
    if (vsAI && playerColor === "black") {
        setTimeout(() => { aiMove(); updatePieces(); updateTurnText(); }, 500);
    }
}

/* ================= THREE & BOARD ================= */
function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b);
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(6, 9, 6);
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("gameCanvas"), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));

    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(6, 12, 6);
    sun.castShadow = true;
    scene.add(sun);

    controls = new OrbitControls(camera, renderer.domElement);
    window.addEventListener("resize", onResize);
    window.addEventListener("click", onClick);
    animate();
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function createBoard() {
    const base = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 9), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    base.position.y = -0.3;
    scene.add(base);
    for (let r = 0; r < 8; r++) {
        tiles[r] = [];
        for (let c = 0; c < 8; c++) {
            const tile = new THREE.Mesh(
                new THREE.BoxGeometry(1, 0.1, 1),
                new THREE.MeshStandardMaterial({ color: (r + c) % 2 === 0 ? 0xf1f5f9 : 0x475569 })
            );
            tile.position.set(c - 3.5, -0.05, r - 3.5);
            tile.userData = { r, c };
            scene.add(tile);
            tiles[r][c] = tile;
        }
    }
}

function resetTileColors() {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const isDark = (r + c) % 2 !== 0;
            tiles[r][c].material.color.setHex(isDark ? 0x475569 : 0x94a3b8);
        }
    }
    highlightCheck(); // Call this here
}

/* ================= ATTRACTIVE PIECES ================= */
function createPieceMesh(type, color) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: color === "white"
            ? 0xe5e7eb        // light white
            : 0x334155,       // 🔥 dark slate (visible on black bg)

        roughness: 0.35,
        metalness: 0.35,

        emissive: color === "white"
            ? 0x000000
            : 0x111827,      // 🔥 slight glow for black pieces

        emissiveIntensity: 0.35
    });


    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.15, 20), mat);
    group.add(base);

    if (type === "pawn") {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.25, 0.5, 20), mat);
        body.position.y = 0.3;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 20), mat);
        head.position.y = 0.6;
        group.add(body, head);
    } else if (type === "rook") {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.7, 20), mat);
        body.position.y = 0.4;
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 20), mat);
        top.position.y = 0.8;
        group.add(body, top);
    } else if (type === "knight") {
        // Strong base
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.30, 0.55, 24),
            mat
        );
        body.position.y = 0.3;

        // Aggressive forward neck
        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.24, 0.45, 20),
            mat
        );
        neck.position.set(0, 0.72, -0.12);
        neck.rotation.x = -0.55;   // 🔥 forward lean

        // Sharp horse head
        const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.30, 0.35, 0.20),
            mat
        );
        head.position.set(0, 0.98, 0.12);
        head.rotation.x = -0.25;

        // Snout (attack feel)
        const snout = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.14, 0.18),
            mat
        );
        snout.position.set(0, 0.88, 0.32);
        snout.rotation.x = -0.15;

        // Sharp ear / horn
        const ear = new THREE.Mesh(
            new THREE.ConeGeometry(0.06, 0.18, 12),
            mat
        );
        ear.position.set(0, 1.18, 0.10);

        group.add(body, neck, head, snout, ear);
    } else if (type === "bishop") {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.25, 0.8, 20), mat);
        body.position.y = 0.45;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 20), mat);
        head.scale.set(1, 1.3, 1);
        head.position.y = 0.9;
        group.add(body, head);
    } else if (type === "queen") {
        // Elegant body
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.32, 1.15, 32),
            mat
        );
        body.position.y = 0.6;

        // Crown base
        const crownBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 0.12, 32),
            mat
        );
        crownBase.position.y = 1.2;

        // Crown spikes
        const spikes = [];
        for (let i = 0; i < 6; i++) {
            const spike = new THREE.Mesh(
                new THREE.ConeGeometry(0.05, 0.18, 16),
                mat
            );
            const angle = (i / 6) * Math.PI * 2;
            spike.position.set(
                Math.cos(angle) * 0.18,
                1.32,
                Math.sin(angle) * 0.18
            );
            spikes.push(spike);
        }

        // Top jewel
        const jewel = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 20, 20),
            mat
        );
        jewel.position.y = 1.45;

        group.add(body, crownBase, jewel, ...spikes);
    } else if (type === "king") {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 1.2, 20), mat);
        body.position.y = 0.65;
        const cross = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), mat);
        cross.position.y = 1.4;
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.1), mat);
        crossH.position.y = 1.45;
        group.add(body, cross, crossH);
    }
    return group;
}

function createPieces() {
    pieceMeshes = {};
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) continue;
            const mesh = createPieceMesh(p.type, p.color);
            mesh.position.set(c - 3.5, 0, r - 3.5);
            // 🔁 Rotate knight based on color (FIX DIRECTION)
            if (p.type === "knight") {
                if (p.color === "white") {
                    mesh.rotation.y = Math.PI;
                }
            }
            scene.add(mesh);
            pieceMeshes[`${r}-${c}`] = mesh;
        }
    }
}

function updatePieces() {
    Object.values(pieceMeshes).forEach(m => scene.remove(m));
    createPieces();
}

/* ================= CLICK & HIGHLIGHT ================= */
function onClick(e) {
    if (!gameStarted) return;
    const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(scene.children).find(h => h.object.userData?.r !== undefined);
    if (hit) handleTileClick(hit.object.userData.r, hit.object.userData.c);
}

function handleTileClick(r, c) {
    if (vsAI && currentTurn !== playerColor) return;

    // 🟢 CASE 1: nothing selected yet
    if (!selectedTile) {
        if (board[r][c]?.color === currentTurn) {
            playSound("select"); // 🔊
            selectedTile = { r, c };
            resetTileColors();
            tiles[r][c].material.color.setHex(0x22c55e);

            for (let tr = 0; tr < 8; tr++) {
                for (let tc = 0; tc < 8; tc++) {
                    if (isValidMove(selectedTile, { r: tr, c: tc })) {
                        tiles[tr][tc].material.color.setHex(0x38bdf8);
                    }
                }
            }
        }
        return;
    }

    // 🟡 CASE 2: already selected & clicked on ANOTHER OWN PIECE
    if (board[r][c]?.color === currentTurn) {
        selectedTile = { r, c };
        resetTileColors();
        tiles[r][c].material.color.setHex(0x22c55e);

        for (let tr = 0; tr < 8; tr++) {
            for (let tc = 0; tc < 8; tc++) {
                if (isValidMove(selectedTile, { r: tr, c: tc })) {
                    tiles[tr][tc].material.color.setHex(0x38bdf8);
                }
            }
        }
        return;
    }

    // 🔵 CASE 3: try to move selected piece
    if (isValidMove(selectedTile, { r, c })) {
        const captured = board[r][c];
        const result = movePiece(selectedTile, { r, c });

        if (result.promoted) {
            pendingPromotion = {
                r,
                c,
                color: currentTurn === "white" ? "black" : "white"
            };
            document.getElementById("promotionPopup").style.display = "flex";
            playSound("promotion");
            updatePieces();
            return;
        }

        if (result.captured) {
            playSound("capture");
            addCapturedPiece(result.captured);
        } else {
            playSound("move");
        }


        updatePieces();
        resetTileColors();
        selectedTile = null;
        updateTurnText();
        checkForCheckmate();

        if (vsAI) {
            setTimeout(() => {
                const aiResult = aiMove();
                if (aiResult?.captured) {
                    playSound("capture");
                    addCapturedPiece(aiResult.captured);
                } else {
                    playSound("move");
                }
                updatePieces();
                updateTurnText();
                checkForCheckmate();
            }, 600);
        }
    }
}

function updateTurnText() {
    document.getElementById("turnText").innerText = "Turn: " + currentTurn.toUpperCase();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}


function highlightCheck() {
    ["white", "black"].forEach(color => {
        if (isKingInDanger(color)) {
            const pos = getKingPos(color);
            if (pos) tiles[pos.r][pos.c].material.color.setHex(0xff0000); // RED
        }
    });
}

function addCapturedPiece(piece) {
    const zoneId =
        piece.color === "white"
            ? "captured-white"
            : "captured-black";

    const zone = document.getElementById(zoneId);

    const icon = document.createElement("div");
    icon.className = "captured-icon";
    icon.innerText = getPieceSymbol(piece.type);

    zone.appendChild(icon);
}


function getPieceSymbol(type) {
    switch (type) {
        case "pawn": return "♟";
        case "rook": return "♜";
        case "knight": return "♞";
        case "bishop": return "♝";
        case "queen": return "♛";
        case "king": return "♚";
        default: return "♟";
    }
}

function restartGame() {
    // Remove old pieces
    Object.values(pieceMeshes).forEach(m => scene.remove(m));
    pieceMeshes = {};
    selectedTile = null;

    // ✅ CLEAR CAPTURED PIECES UI
    document.getElementById("captured-white").innerHTML = "";
    document.getElementById("captured-black").innerHTML = "";

    // Reset board logic
    initBoard(playerColor);
    createPieces();
    resetTileColors();
    updateTurnText();

    // AI first move if needed
    if (vsAI && playerColor === "black") {
        setTimeout(() => {
            aiMove();
            updatePieces();
            updateTurnText();
        }, 500);
    }
}


function goToMainMenu() {
    // Stop game
    gameStarted = false;
    selectedTile = null;

    // Clear scene
    if (scene) {
        scene.traverse(obj => {
            if (obj.isMesh) obj.geometry.dispose();
        });
    }

    // Hide game UI
    document.getElementById("ui").style.display = "none";
    document.getElementById("gameCanvas").style.display = "none";

    // Clear captured zones
    document.getElementById("captured-white").innerHTML = "";
    document.getElementById("captured-black").innerHTML = "";

    // Show start screen
    document.getElementById("startScreen").style.display = "flex";
}

// ✅ CLOSE POPUPS WHEN CLICKING OUTSIDE
["aiPopup", "sidePopup"].forEach(id => {
    const popup = document.getElementById(id);
    if (!popup) return;

    popup.addEventListener("click", (e) => {
        // agar background pe click hua (popup box ke bahar)
        if (e.target === popup) {
            popup.style.display = "none";

            // agar AI popup band hua, start screen wapas dikhao
            if (id === "aiPopup") {
                document.getElementById("startScreen").style.display = "flex";
            }

            if (id === "sidePopup") {
                document.getElementById("startScreen").style.display = "flex";
            }
        }
    });
});

function checkForCheckmate() {
    if (isCheckmate(currentTurn)) {
        playSound("checkmate");
        gameStarted = false;

        const winner = currentTurn === "white" ? "Black" : "White";
        document.getElementById("winnerText").innerText =
            `🏆 ${winner} wins the game`;

        document.getElementById("checkmatePopup").style.display = "flex";
    }
}
