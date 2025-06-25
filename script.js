let pitch = null;
let birdY = 300;
let smoothing = 0.8;

let audioContext, mic, pitchDetector, micStream;
let running = false;
let paused = false;
let gameOver = false;
let score = 0;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Load images
const bgImg = new Image();
bgImg.src = "assets/background.png";
const splashImg = new Image();
splashImg.src = "assets/splash.png";
const birdImg = new Image();
birdImg.src = "assets/bird.png";
const pipeImg = new Image();
pipeImg.src = "assets/pipe.png";
const gameoverImg = new Image();
gameoverImg.src = "assets/gameover.png";

// Load digit images for score display
const digitImgs = [];
for (let i = 0; i <= 9; i++) {
  digitImgs[i] = new Image();
  digitImgs[i].src = `assets/${i}.png`;
}

// Pipe settings
const PIPE_WIDTH = 60;
const PIPE_SPEED = 2;
let pipes = [];
let pipeTimer = 0;
const PIPE_INTERVAL = 120; // frames
const PIPE_CAP_HEIGHT = 24; // Height of the pipe cap in pixels (now 24)

function getPipeGap() {
  // 28% of the canvas height, but clamp between 120 and 260 pixels
  return clamp(Math.floor(canvas.height * 0.28), 120, 260);
}

// Bird settings
const BIRD_WIDTH = 40;
const BIRD_HEIGHT = 32;

// Animation and pitch loop
let animationFrameId = null;
let pitchLoopActive = false;

// Pitch range for mapping to screen height (easy to adjust)
const PITCH_MIN = 130;  // Lowest pitch (Hz) maps to bottom of screen
const PITCH_MAX = 523;  // Highest pitch (Hz) maps to top of screen

// Responsive canvas
function resizeCanvas() {
  if (window.innerWidth > window.innerHeight) {
    // Landscape: fixed width, full height, horizontally centered
    canvas.height = window.innerHeight;
    canvas.width = 480;
    canvas.style.left = `${(window.innerWidth - canvas.width) / 2}px`;
    canvas.style.top = `0px`;
    canvas.style.position = 'absolute';
  } else {
    // Portrait: fill the screen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.left = `0px`;
    canvas.style.top = `0px`;
    canvas.style.position = 'absolute';
  }
  // Only redraw if not running (so splash/buttons show up)
  if (!running) draw();
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
resizeCanvas();

// Draw score using digit images
function drawScore(x, y, score) {
  const scoreStr = score.toString();
  const digitWidth = 32;
  const digitHeight = 48;
  const totalWidth = scoreStr.length * digitWidth;
  let drawX = x - totalWidth / 2;
  for (let char of scoreStr) {
    const digit = parseInt(char);
    ctx.drawImage(digitImgs[digit], drawX, y, digitWidth, digitHeight);
    drawX += digitWidth;
  }
}

// Draw in-canvas buttons (always in top right)
function drawGameButtons() {
  const btnSize = 48;
  const padding = 20;
  const pauseX = canvas.width - btnSize * 2 - padding * 1.5;
  const quitX = canvas.width - btnSize - padding;
  const btnY = padding;

  // Start/Pause button
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#1976d2";
  ctx.fillRect(pauseX, btnY, btnSize, btnSize);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (!running) {
    ctx.fillText("▶", pauseX + btnSize / 2, btnY + btnSize / 2 + 2);
  } else {
    ctx.fillText("II", pauseX + btnSize / 2, btnY + btnSize / 2);
  }
  ctx.restore();

  // Quit button
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#d32f2f";
  ctx.fillRect(quitX, btnY, btnSize, btnSize);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✖", quitX + btnSize / 2, btnY + btnSize / 2 + 1);
  ctx.restore();
}

// Main draw function
function draw() {
  if (animationFrameId) {
    animationFrameId = null;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

  if (!running) return;

  let yPadding = 30;
  let targetY;

  if (pitch) {
    let clampedPitch = clamp(pitch, PITCH_MIN, PITCH_MAX);
    let availableHeight = canvas.height - 2 * yPadding;
    let targetY =
      canvas.height -
      yPadding -
      ((clampedPitch - PITCH_MIN) / (PITCH_MAX - PITCH_MIN)) * availableHeight;
    birdY = birdY * smoothing + targetY * (1 - smoothing);
  } else {
    // Smooth, consistent slow fall when no pitch is detected
    const gravity = 8; // Lower value for slower, smoother fall
    birdY += gravity;
  }

  // Prevent bird from falling below the bottom of the screen
  if (birdY > canvas.height - BIRD_HEIGHT) {
    birdY = canvas.height - BIRD_HEIGHT;
  }

  // Pipes logic
  if (!paused && !gameOver) {
    pipeTimer++;
    if (pipeTimer >= PIPE_INTERVAL) {
      pipeTimer = 0;
      const gapY = Math.floor(
        yPadding + Math.random() * (canvas.height - 2 * yPadding - getPipeGap())
      );
      pipes.push({
        x: canvas.width,
        gapY: gapY,
        passed: false,
      });
    }
    for (let pipe of pipes) {
      pipe.x -= PIPE_SPEED;
    }
    pipes = pipes.filter((pipe) => pipe.x + PIPE_WIDTH > 0);
  }

  // Draw pipes
  for (let pipe of pipes) {
    // Top pipe (rotated 180°)
    ctx.save();
    ctx.translate(pipe.x + PIPE_WIDTH / 2, pipe.gapY);
    ctx.rotate(Math.PI);
    // Draw cap (stretch 56px to 60px, centered)
    ctx.drawImage(
      pipeImg,
      2, 0, 56, PIPE_CAP_HEIGHT,         // source: skip 2px transparent border
      -PIPE_WIDTH / 2, 0, PIPE_WIDTH, PIPE_CAP_HEIGHT // dest: center 60px over body
    );
    // Draw body (aligned with cap)
    if (pipe.gapY - PIPE_CAP_HEIGHT > 0) {
      ctx.drawImage(
        pipeImg,
        0, PIPE_CAP_HEIGHT, PIPE_WIDTH, pipeImg.height - PIPE_CAP_HEIGHT,
        -PIPE_WIDTH / 2, PIPE_CAP_HEIGHT, PIPE_WIDTH, pipe.gapY - PIPE_CAP_HEIGHT
      );
    }
    ctx.restore();

    // Bottom pipe
    const bottomPipeHeight = canvas.height - (pipe.gapY + getPipeGap());
    const bottomPipeY = pipe.gapY + getPipeGap();
    if (bottomPipeHeight > 0) {
      // Draw cap (stretch 56px to 60px, centered)
      ctx.drawImage(
        pipeImg,
        2, 0, 56, PIPE_CAP_HEIGHT,
        pipe.x, bottomPipeY, PIPE_WIDTH, PIPE_CAP_HEIGHT
      );
      // Draw body (aligned with cap)
      if (bottomPipeHeight - PIPE_CAP_HEIGHT > 0) {
        ctx.drawImage(
          pipeImg,
          0, PIPE_CAP_HEIGHT, PIPE_WIDTH, pipeImg.height - PIPE_CAP_HEIGHT,
          pipe.x, bottomPipeY + PIPE_CAP_HEIGHT, PIPE_WIDTH, bottomPipeHeight - PIPE_CAP_HEIGHT
        );
      }
    }
  }

  // Draw bird
  ctx.drawImage(birdImg, 100, birdY, BIRD_WIDTH, BIRD_HEIGHT);

  // Score logic
  if (!gameOver) {
    for (let pipe of pipes) {
      if (!pipe.passed && pipe.x + PIPE_WIDTH / 2 < 100 + BIRD_WIDTH / 2) {
        pipe.passed = true;
        score++;
      }
    }
  }

  // Draw score
  if (!gameOver) {
    drawScore(canvas.width / 2, 20, score);
  }

  // Collision detection
  if (!gameOver) {
    for (let pipe of pipes) {
      const birdRect = { x: 100, y: birdY, w: BIRD_WIDTH, h: BIRD_HEIGHT };
      const topRect = { x: pipe.x, y: 0, w: PIPE_WIDTH, h: pipe.gapY };
      const bottomRect = { x: pipe.x, y: pipe.gapY + getPipeGap(), w: PIPE_WIDTH, h: canvas.height - (pipe.gapY + getPipeGap()) };
      if (
        rectsOverlap(birdRect, topRect) ||
        rectsOverlap(birdRect, bottomRect)
      ) {
        gameOver = true;
        break;
      }
    }
  }

  // Game over screen
  if (gameOver) {
    // Award points and update high score
    addPoints(score);
    setHighScoreIfNeeded(score);

    ctx.fillStyle = "rgba(80,80,80,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const goNaturalWidth = gameoverImg.naturalWidth || 300;
    const goNaturalHeight = gameoverImg.naturalHeight || 80;
    const goDrawWidth = 300;
    const goDrawHeight = goDrawWidth * (goNaturalHeight / goNaturalWidth);
    ctx.drawImage(
      gameoverImg,
      canvas.width / 2 - goDrawWidth / 2,
      canvas.height / 2 - goDrawHeight / 2,
      goDrawWidth,
      goDrawHeight
    );
    drawScore(canvas.width / 2, canvas.height / 2 + goDrawHeight / 2 + 20, score);
    running = false;
    pitchLoopActive = false;
    drawGameButtons();
    return;
  }

  // Pause overlay
  if (paused) {
    ctx.fillStyle = "rgba(80, 80, 80, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const iconWidth = 40;
    const iconHeight = 60;
    const barWidth = 12;
    const gap = 12;
    const x = canvas.width / 2 - iconWidth / 2;
    const y = canvas.height / 2 - iconHeight / 2;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, barWidth, iconHeight);
    ctx.fillRect(x + barWidth + gap, y, barWidth, iconHeight);
  }

  if (!paused && !gameOver) {
    animationFrameId = requestAnimationFrame(draw);
  }

  // Always draw buttons last so they appear on top
  drawGameButtons();
}

// Utility
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
function resetGame() {
  birdY = 300;
  pitch = null;
  pipes = [];
  pipeTimer = 0;
  gameOver = false;
  score = 0;
}
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
function stopAudio() {
  pitchLoopActive = false;
  pitch = null;
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  mic = null;
  pitchDetector = null;
}
function stopGame() {
  running = false;
  paused = false;
  pitch = null;
  birdY = 300;
  pipes = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  stopAudio(); // <--- Add this line
  draw();
}

// Pitch detection
async function setupAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (!micStream) {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  mic = audioContext.createMediaStreamSource(micStream);

  pitchDetector = await ml5.pitchDetection(
    "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/",
    audioContext,
    micStream,
    modelLoaded
  );
}
function modelLoaded() {
  getPitch();
}
function getPitch() {
  if (!running || !pitchLoopActive || paused) return;
  pitchDetector.getPitch((err, frequency) => {
    if (err) {
      console.error("Pitch detection error:", err);
    }
    if (frequency) {
      pitch = frequency;
    } else {
      pitch = null;
    }
    // Only continue if pitchLoopActive is still true
    if (pitchLoopActive) getPitch();
  });
}

// --- Persistent Storage Manager ---
const STORAGE_KEY = "buzzyBirdSave";
const DEFAULT_SKINS = [
  { id: "default", name: "Classic", price: 0, img: "assets/bird.png" },
  // Example: { id: "red", name: "Red Bird", price: 100, img: "assets/skins/red.png" },
  // Add more skins as needed
];

// Load or initialize save data
function loadSave() {
  let save = localStorage.getItem(STORAGE_KEY);
  if (save) {
    try {
      save = JSON.parse(save);
      // Ensure all fields exist
      if (!save.points) save.points = 0;
      if (!save.highScore) save.highScore = 0;
      if (!save.ownedSkins) save.ownedSkins = ["default"];
      if (!save.equippedSkin) save.equippedSkin = "default";
      return save;
    } catch {
      // Corrupt data, reset
      return createDefaultSave();
    }
  }
  return createDefaultSave();
}
function createDefaultSave() {
  return {
    points: 0,
    highScore: 0,
    ownedSkins: ["default"],
    equippedSkin: "default",
  };
}
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

// Global save object
let save = loadSave();

// --- Skin Management ---
const SKINS = [
  ...DEFAULT_SKINS,
  // Add more skins here, e.g.:
  // { id: "red", name: "Red Bird", price: 100, img: "assets/skins/red.png" },
];

// Utility to get skin object by id
function getSkin(id) {
  return SKINS.find(s => s.id === id) || SKINS[0];
}

// --- Points & High Score Logic ---
function addPoints(amount) {
  save.points += amount;
  saveData();
}
function setHighScoreIfNeeded(newScore) {
  if (newScore > save.highScore) {
    save.highScore = newScore;
    saveData();
  }
}
function unlockSkin(skinId) {
  if (!save.ownedSkins.includes(skinId)) {
    save.ownedSkins.push(skinId);
    saveData();
  }
}
function equipSkin(skinId) {
  if (save.ownedSkins.includes(skinId)) {
    save.equippedSkin = skinId;
    saveData();
  }
}

// --- Use equipped skin for bird ---
function updateBirdImage() {
  const skin = getSkin(save.equippedSkin);
  birdImg.src = skin.img;
}
updateBirdImage();

// Handle in-canvas button clicks
canvas.addEventListener("click", function (e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const btnSize = 48;
  const padding = 20;
  const pauseX = canvas.width - btnSize * 2 - padding * 1.5;
  const quitX = canvas.width - btnSize - padding;
  const btnY = padding;

  // Start/Pause button area
  if (
    mouseX >= pauseX &&
    mouseX <= pauseX + btnSize &&
    mouseY >= btnY &&
    mouseY <= btnY + btnSize
  ) {
    // STOP any previous loops before starting a new game
    if (!running) {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      stopAudio(); // <--- Add this line

      // START GAME logic
      running = true;
      paused = false;
      gameOver = false;
      resetGame();
      pitchLoopActive = true;
      draw();
      setupAudio();
    } else {
      // Pause/unpause
      paused = !paused;
      if (!paused && !animationFrameId) {
        animationFrameId = requestAnimationFrame(draw);
      }
    }
    return;
  }

  // Quit button area
  if (
    mouseX >= quitX &&
    mouseX <= quitX + btnSize &&
    mouseY >= btnY &&
    mouseY <= btnY + btnSize
  ) {
    if (running) stopGame();
    return;
  }
});

// Microphone access on load
window.addEventListener("DOMContentLoaded", async () => {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("Microphone access granted.");
  } catch (err) {
    alert("Microphone access is required to play the game.");
  }
});

// Draw initial splash/background/buttons as soon as possible
function tryDrawInitial() {
  if (bgImg.complete && splashImg.complete) {
    draw();
  } else {
    let loaded = 0;
    function check() {
      loaded++;
      if (bgImg.complete && splashImg.complete) draw();
    }
    bgImg.onload = check;
    splashImg.onload = check;
  }
}
tryDrawInitial();

// --- MENU & SKINS POPUP LOGIC ---

// 20 skins, all using assets/bird.png for now
/*
for (let i = 1; i < 20; i++) {
  SKINS.push({
    id: "skin" + i,
    name: "Skin " + (i + 1),
    price: 1,
    img: "assets/bird.png"
  });
}
*/

// DOM elements
const mainMenu = document.getElementById("mainMenu");
const skinsPopup = document.getElementById("skinsPopup");
const skinsGrid = document.getElementById("skinsGrid");
const pointsDisplay = document.getElementById("pointsDisplay");
const highScoreDisplay = document.getElementById("highScoreDisplay");
const skinsBtn = document.getElementById("skinsBtn");
const closeSkinsBtn = document.getElementById("closeSkinsBtn");

// DOM elements for new popups
const howToBtn = document.getElementById("howToBtn");
const creditsBtn = document.getElementById("creditsBtn");
const howToPopup = document.getElementById("howToPopup");
const creditsPopup = document.getElementById("creditsPopup");
const closeHowToBtn = document.getElementById("closeHowToBtn");
const closeCreditsBtn = document.getElementById("closeCreditsBtn");

// --- SETTINGS POPUP LOGIC ---

const settingsBtn = document.getElementById("settingsBtn");
const settingsPopup = document.getElementById("settingsPopup");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const bottomNoteBox = document.getElementById("bottomNoteBox");
const topNoteBox = document.getElementById("topNoteBox");

const noteSliderPopup = document.getElementById("noteSliderPopup");
const noteSlider = document.getElementById("noteSlider");
const sliderNoteDisplay = document.getElementById("sliderNoteDisplay");
const closeNoteSliderBtn = document.getElementById("closeNoteSliderBtn");
const sliderLabel = document.getElementById("sliderLabel");

// Chromatic notes C1–C6 (MIDI 24–83)
const NOTE_NAMES = [
  "C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"
];
function midiToNoteName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return name + octave;
}
function noteNameToMidi(note) {
  // Accepts e.g. "C3", "F#4", "G♯2"
  let match = note.match(/^([A-G])([#♯]?)(\d)$/);
  if (!match) return 60; // default C4
  let [_, n, sharp, oct] = match;
  let idx = NOTE_NAMES.findIndex(x => x[0] === n && (sharp ? x.includes(sharp) : x.length === 1));
  return idx + (parseInt(oct) + 1) * 12;
}

// Default: C3 (MIDI 48), C4 (MIDI 60)
let bottomMidi = 48;
let topMidi = 60;

// Load from localStorage if available
if (localStorage.getItem("buzzyBirdPitchRange")) {
  try {
    const obj = JSON.parse(localStorage.getItem("buzzyBirdPitchRange"));
    if (typeof obj.bottom === "number" && typeof obj.top === "number") {
      bottomMidi = obj.bottom;
      topMidi = obj.top;
    }
  } catch {}
}
bottomNoteBox.textContent = midiToNoteName(bottomMidi);
topNoteBox.textContent = midiToNoteName(topMidi);

// Save to localStorage
function savePitchRange() {
  localStorage.setItem("buzzyBirdPitchRange", JSON.stringify({ bottom: bottomMidi, top: topMidi }));
}

// Update game pitch mapping
function updatePitchRange() {
  window.PITCH_MIN = midiToFreq(bottomMidi);
  window.PITCH_MAX = midiToFreq(topMidi);
  savePitchRange();
}

// MIDI to frequency
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Open/close settings popup
settingsBtn.addEventListener("click", (e) => {
  settingsPopup.classList.remove("hidden");
  e.stopPropagation();
});
closeSettingsBtn.addEventListener("click", () => {
  settingsPopup.classList.add("hidden");
});
settingsPopup.addEventListener("mousedown", (e) => {
  if (e.target === settingsPopup) settingsPopup.classList.add("hidden");
});

// Note slider logic
let sliderTarget = null; // "bottom" or "top"
function openNoteSlider(target) {
  sliderTarget = target;
  noteSliderPopup.classList.remove("hidden");
  // Set slider range: C1 (MIDI 24) to C6 (MIDI 84)
  noteSlider.min = 24;
  noteSlider.max = 84;
  if (target === "bottom") {
    noteSlider.value = bottomMidi;
    sliderLabel.textContent = "Select Bottom Note";
  } else {
    noteSlider.value = topMidi;
    sliderLabel.textContent = "Select Top Note";
  }
  sliderNoteDisplay.textContent = midiToNoteName(Number(noteSlider.value));
}
bottomNoteBox.addEventListener("click", () => openNoteSlider("bottom"));
topNoteBox.addEventListener("click", () => openNoteSlider("top"));

noteSlider.addEventListener("input", () => {
  sliderNoteDisplay.textContent = midiToNoteName(Number(noteSlider.value));
});

closeNoteSliderBtn.addEventListener("click", () => {
  const midiVal = Number(noteSlider.value);
  if (sliderTarget === "bottom") {
    bottomMidi = midiVal;
    bottomNoteBox.textContent = midiToNoteName(bottomMidi);
    // Prevent overlap
    if (bottomMidi >= topMidi) {
      topMidi = bottomMidi + 1;
      topNoteBox.textContent = midiToNoteName(topMidi);
    }
  } else if (sliderTarget === "top") {
    topMidi = midiVal;
    topNoteBox.textContent = midiToNoteName(topMidi);
    // Prevent overlap
    if (topMidi <= bottomMidi) {
      bottomMidi = topMidi - 1;
      bottomNoteBox.textContent = midiToNoteName(bottomMidi);
    }
  }
  updatePitchRange();
  noteSliderPopup.classList.add("hidden");
});
noteSliderPopup.addEventListener("mousedown", (e) => {
  if (e.target === noteSliderPopup) noteSliderPopup.classList.add("hidden");
});

// Initialize pitch range on load
updatePitchRange();

// Show menu on load and after game over
function showMainMenu() {
  updateMenuInfo();
  mainMenu.style.display = "flex";
  running = false;
  paused = false;
  gameOver = false;
  tryDrawInitial();
}
function hideMainMenu() {
  mainMenu.style.display = "none";
}

// Update points and high score in menu
function updateMenuInfo() {
  pointsDisplay.textContent = "Points: " + save.points;
  highScoreDisplay.textContent = "High Score: " + save.highScore;
}

// Start game on tap/click anywhere on menu
mainMenu.addEventListener("mousedown", startGameFromMenu);
mainMenu.addEventListener("touchstart", startGameFromMenu, { passive: false });
async function startGameFromMenu(e) {
  if (e.target.closest("button")) return; // Ignore if clicking a button
  hideMainMenu();
  resetGame();
  running = true;
  paused = false;
  gameOver = false;
  pitchLoopActive = true;
  await ensureMicAndStart();
}

async function ensureMicAndStart() {
  try {
    if (!micStream) {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    await setupAudio();
    draw();
  } catch (err) {
    alert("Microphone access is required to play!");
    showMainMenu();
  }
}

// --- Skins Popup ---
function showSkinsPopup() {
  renderSkinsGrid();
  skinsPopup.classList.remove("hidden");
}
function hideSkinsPopup() {
  skinsPopup.classList.add("hidden");
  updateMenuInfo();
}

// Render skins grid
function renderSkinsGrid() {
  skinsGrid.innerHTML = "";
  for (const skin of SKINS) {
    const owned = save.ownedSkins.includes(skin.id);
    const equipped = save.equippedSkin === skin.id;
    const box = document.createElement("div");
    box.className = "skin-box" + (equipped ? " equipped" : "") + (owned ? "" : " locked");
    box.title = skin.name;
    // Sprite
    const img = document.createElement("img");
    img.src = skin.img;
    img.className = "skin-sprite";
    box.appendChild(img);
    // Overlay for locked
    if (!owned) {
      const overlay = document.createElement("div");
      overlay.className = "skin-overlay";
      overlay.innerHTML = `<div class="skin-cost">${skin.price} pt</div>`;
      box.appendChild(overlay);
    }
    // Click logic
    box.addEventListener("click", () => {
      if (owned) {
        equipSkin(skin.id);
        updateBirdImage();
        renderSkinsGrid();
      } else if (save.points >= skin.price) {
        save.points -= skin.price;
        unlockSkin(skin.id);
        equipSkin(skin.id);
        updateBirdImage();
        renderSkinsGrid();
        updateMenuInfo();
      }
    });
    skinsGrid.appendChild(box);
  }
}

// Button events
skinsBtn.addEventListener("click", (e) => {
  showSkinsPopup();
  e.stopPropagation();
});
closeSkinsBtn.addEventListener("click", hideSkinsPopup);

// Hide popup on outside click
skinsPopup.addEventListener("mousedown", (e) => {
  if (e.target === skinsPopup) hideSkinsPopup();
});

// Show menu after game over
function onGameOverMenu() {
  showMainMenu(); // Remove setTimeout, show immediately
}

// Patch game over logic to show menu
const origStopGame = stopGame;
stopGame = function() {
  origStopGame();
  onGameOverMenu();
};

// Show menu on load
window.addEventListener("DOMContentLoaded", showMainMenu);

// Example: inside your canvas click/tap handler
canvas.addEventListener("mousedown", function(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Always check for exit button, even if gameOver
  if (exitButtonClicked(x, y)) {
    showMainMenu();
    return;
  }

  // ...other game logic...
});

// Example exit button hit test
function exitButtonClicked(x, y) {
  // Replace these with your actual exit button coordinates and size
  const btnX = canvas.width - 60;
  const btnY = 20;
  const btnW = 40;
  const btnH = 40;
  return x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH;
}

// Show/hide logic for How To Play
howToBtn.addEventListener("click", (e) => {
  howToPopup.classList.remove("hidden");
  e.stopPropagation();
});
closeHowToBtn.addEventListener("click", () => {
  howToPopup.classList.add("hidden");
});
howToPopup.addEventListener("mousedown", (e) => {
  if (e.target === howToPopup) howToPopup.classList.add("hidden");
});

// Show/hide logic for Credits
creditsBtn.addEventListener("click", (e) => {
  creditsPopup.classList.remove("hidden");
  e.stopPropagation();
});
closeCreditsBtn.addEventListener("click", () => {
  creditsPopup.classList.add("hidden");
});
creditsPopup.addEventListener("mousedown", (e) => {
  if (e.target === creditsPopup) creditsPopup.classList.add("hidden");
});