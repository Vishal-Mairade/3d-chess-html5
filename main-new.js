import * as THREE from "three";
import { OrbitControls } from "./OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/loaders/GLTFLoader.js";

import {
    initBoard,
    board,
    currentTurn,
    WHITE,
    isValidMove,
    movePiece
} from "./chessLogic.js";

import { aiMove } from "./ai.js";

/* ================= GLOBAL ================= */
let scene, camera, renderer, controls;
let chessModel;
let isInitialized = false;

let playerColor = WHITE;
let vsAI = false;
let pendingAIMode = false;

// Adjust this to match your GLB board scale
const SQUARE_SIZE = 2.5;

// 🖱️ Interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedPiece = null;
let selectedCoords = null;

// 🟢 Move Indicators
let moveIndicators = [];

/* ================= UI ================= */
const canvas = document.getElementById("gameCanvas");
const ui = document.getElementById("ui");

document.getElementById("aiBtn").onclick = () => { pendingAIMode = true; showSidePopup(); };
document.getElementById("friendBtn").onclick = () => { pendingAIMode = false; showSidePopup(); };
document.getElementById("chooseWhite").onclick = () => startGame("white");
document.getElementById("chooseBlack").onclick = () => startGame("black");

function showSidePopup() {
    document.getElementById("startScreen").style.display = "none";
    document.getElementById("sidePopup").classList.remove("hidden");
}

/* ================= START GAME ================= */
function startGame(color) {
    document.getElementById("sidePopup").classList.add("hidden");
    ui.classList.remove("hidden");
    canvas.style.display = "block";

    playerColor = color;
    vsAI = pendingAIMode;

    if (!isInitialized) {
        initThree();
        loadChessModel();
        isInitialized = true;
        window.addEventListener("mousedown", onMouseDown);
    } else {
        resetCameraView();
    }

    initBoard(playerColor);
    updateTurnText();
}

/* ================= PIECE MAPPING ================= */
function get3DPos(r, c) {
    return {
        x: (c - 3.5) * SQUARE_SIZE,
        z: (r - 3.5) * SQUARE_SIZE
    };
}

function clearMoveIndicators() {
    moveIndicators.forEach(marker => scene.remove(marker));
    moveIndicators = [];
}

function showPossibleMoves(fromCoords) {
    clearMoveIndicators();
    const geometry = new THREE.CircleGeometry(0.6, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.4 });

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (isValidMove(fromCoords, { r, c })) {
                const marker = new THREE.Mesh(geometry, material);
                const pos = get3DPos(r, c);
                marker.position.set(pos.x, 0.15, pos.z); // Slightly above board
                marker.rotation.x = -Math.PI / 2;
                scene.add(marker);
                moveIndicators.push(marker);
            }
        }
    }
}

/* ================= CLICK HANDLING ================= */
function onMouseDown(event) {
    if (vsAI && currentTurn !== playerColor) return;

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        let obj = intersects[0].object;

        // Traverse up to find the root piece object that has userData
        let pieceRoot = null;
        let temp = obj;
        while (temp && temp !== scene) {
            if (temp.userData && temp.userData.isPiece) {
                pieceRoot = temp;
                break;
            }
            temp = temp.parent;
        }

        handleSelection(pieceRoot, intersects[0].point);
    }
}

function handleSelection(clickedPiece, clickPoint) {
    if (!selectedPiece) {
        // Step 1: Selecting your piece
        if (clickedPiece && clickedPiece.userData.color === currentTurn) {
            selectedPiece = clickedPiece;
            selectedCoords = { r: clickedPiece.userData.r, c: clickedPiece.userData.c };
            selectedPiece.position.y += 0.5; // Visual lift
            showPossibleMoves(selectedCoords);
        }
    } else {
        // Step 2: Choosing a target square
        const targetC = Math.round(clickPoint.x / SQUARE_SIZE + 3.5);
        const targetR = Math.round(clickPoint.z / SQUARE_SIZE + 3.5);
        const targetCoords = { r: targetR, c: targetC };

        if (isValidMove(selectedCoords, targetCoords)) {
            executeMove(selectedPiece, selectedCoords, targetCoords);
        } else {
            selectedPiece.position.y -= 0.5; // Reset position on invalid click
        }

        selectedPiece = null;
        selectedCoords = null;
        clearMoveIndicators();
    }
}

function executeMove(pieceMesh, from, to) {
    // 1. Remove captured piece from 3D
    scene.traverse((child) => {
        if (child.userData.isPiece && child.userData.r === to.r && child.userData.c === to.c) {
            scene.remove(child);
        }
    });

    // 2. Update logic
    movePiece(from, to);

    // 3. Update Mesh
    const pos = get3DPos(to.r, to.c);
    pieceMesh.position.set(pos.x, 0, pos.z);
    pieceMesh.userData.r = to.r;
    pieceMesh.userData.c = to.c;

    updateTurnText();

    // 4. Handle AI
    if (vsAI && currentTurn !== playerColor) {
        setTimeout(() => {
            aiMove();
            sync3DWithBoard();
            updateTurnText();
        }, 600);
    }
}

function sync3DWithBoard() {
    let piecesToMove = [];
    scene.traverse((child) => { if (child.userData.isPiece) piecesToMove.push(child); });

    piecesToMove.forEach(child => {
        const r = child.userData.r;
        const c = child.userData.c;
        const cell = board[r][c];

        // Check if piece is gone or changed
        if (!cell || cell.color !== child.userData.color || cell.type !== child.userData.type) {
            let found = false;
            for (let nr = 0; nr < 8; nr++) {
                for (let nc = 0; nc < 8; nc++) {
                    const target = board[nr][nc];
                    if (target && target.color === child.userData.color && target.type === child.userData.type) {
                        const pos = get3DPos(nr, nc);
                        child.position.set(pos.x, 0, pos.z);
                        child.userData.r = nr;
                        child.userData.c = nc;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (!found) scene.remove(child);
        }
    });
}

/* ================= THREE.JS SETUP ================= */
function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(20, 40, 20);
    scene.add(light);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    animate();
}

function loadChessModel() {
    const loader = new GLTFLoader();
    loader.load("./assets/models/chess.glb", (gltf) => {
        chessModel = gltf.scene;

        chessModel.traverse((node) => {
            if (node.isMesh) {
                const name = node.name.toLowerCase();
                if (name.includes("white") || name.includes("black")) {
                    node.userData.isPiece = true;
                    node.userData.color = name.includes("white") ? "white" : "black";
                    node.userData.c = Math.round(node.position.x / SQUARE_SIZE + 3.5);
                    node.userData.r = Math.round(node.position.z / SQUARE_SIZE + 3.5);
                }
            }
        });

        scene.add(chessModel);
        resetCameraView();
    });
}

function resetCameraView() {
    if (!chessModel) return;
    const box = new THREE.Box3().setFromObject(chessModel);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z);

    // Stable Camera Angle Logic
    const height = maxDim * 0.8;
    const dist = maxDim * 1.5;

    if (playerColor === "black") camera.position.set(0, height, -dist);
    else camera.position.set(0, height, dist);

    controls.target.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    controls.update();
}

function updateTurnText() {
    document.getElementById("turnText").innerText = "Turn: " + currentTurn.toUpperCase();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}