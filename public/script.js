// --- Firebase Initialization ---
// (Config from your index.html, update if needed)
const firebaseConfig = {
  apiKey: "AIzaSyDh-UejLP_DLWWuWDwUM0PeOSG6IYqBO0U",
  authDomain: "pitch-bird.firebaseapp.com",
  projectId: "pitch-bird",
  storageBucket: "pitch-bird.firebasestorage.app",
  messagingSenderId: "356300745950",
  appId: "1:356300745950:web:bef4de640276fac4c8264f",
  measurementId: "G-8SS9R2QGRW"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function getPipeGap() {
  // 28% of the canvas height, but clamp between 120 and 260 pixels
  return clamp(Math.floor(canvas.height * 0.18), 120, 260);
}

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
  const quitX = canvas.width - btnSize - padding;
  const btnY = padding;

  // Quit button only
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
  const yPadding = 20;

  // Use PITCH_MIN and PITCH_MAX for pitch mapping
  const minPitch = PITCH_MIN;
  const maxPitch = PITCH_MAX;

  // Example usage in mapping pitch to birdY:
  if (pitch !== null) {
    // Clamp pitch to range
    let clampedPitch = clamp(pitch, minPitch, maxPitch);

    // Map pitch to vertical position
    let availableHeight = canvas.height - yPadding * 2;
    let targetY =
      canvas.height -
      yPadding -
      ((clampedPitch - minPitch) / (maxPitch - minPitch)) * availableHeight;

    birdY = smoothing * birdY + (1 - smoothing) * targetY;
    birdVelocity = 0; // Reset velocity when pitch is detected
  } else {
    // No pitch detected: apply gravity for smooth fall
    birdVelocity += GRAVITY;
    birdY += birdVelocity;
  }

  if (animationFrameId) animationFrameId = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

  if (!running) return;

  // Prevent bird from falling below the bottom of the screen
  if (birdY > canvas.height - BIRD_HEIGHT) {
    birdY = canvas.height - BIRD_HEIGHT;
    birdVelocity = 0;
  }

  // --- Rest Break Logic ---
  if (inRestBreak) {
    if (!paused) restBreakTimer += 1 / 60; // assuming 60fps
    drawRestAnimation();
    if (restBreakTimer >= REST_BREAK_DURATION) {
      inRestBreak = false;
      restBreakTimer = 0;
      pipesPassedSinceBreak = 0;
      pendingRest = false;
      skipNextPipe = true; // Skip the next pipe spawn after break
    }
  } else {
    if (!paused && !gameOver) {
      pipeTimer++;
      // Only add a pipe if we are not about to enter a break
      if (!pendingRest && pipesPassedSinceBreak < pipesPerBreak) {
        if (pipeTimer >= getPipeIntervalFrames()) {
          pipeTimer = 0;
          if (skipNextPipe) {
            // Skip this spawn to create the gap, then reset the flag
            skipNextPipe = false;
          } else {
            const gapY = Math.floor(
              yPadding + Math.random() * (canvas.height - 2 * yPadding - getPipeGap())
            );
            pipes.push({
              x: canvas.width,
              gapY: gapY,
              passed: false,
            });
          }
        }
      }
      // Move pipes
      for (let pipe of pipes) {
        pipe.x -= pipeSpeed;
      }
      pipes = pipes.filter((pipe) => pipe.x + PIPE_WIDTH > -100); // Remove pipes 100px after they leave the screen

      // If a rest is pending, wait for the last pipe to move off by canvas.width before starting break
      if (pendingRest && lastPipeBeforeBreak) {
        if (lastPipeBeforeBreak.x <= -60) { // Start break when last pipe is just off the left edge
          inRestBreak = true;
          restBreakTimer = 0;
          lastPipeBeforeBreak = null; // Reset for next break
        }
      }
    }
  }

  // Draw pipes
  for (let pipe of pipes) {
    // Top pipe (rotated 180°)
    ctx.save();
    ctx.translate(pipe.x + PIPE_WIDTH / 2, pipe.gapY);
    ctx.rotate(Math.PI);
    ctx.drawImage(
      pipeImg,
      2, 0, 56, PIPE_CAP_HEIGHT,
      -PIPE_WIDTH / 2, 0, PIPE_WIDTH, PIPE_CAP_HEIGHT
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
  {
    // Maintain constant height, scale width to preserve aspect ratio
    const drawHeight = BIRD_HEIGHT;
    const aspect = birdImg.naturalWidth && birdImg.naturalHeight
      ? birdImg.naturalWidth / birdImg.naturalHeight
      : BIRD_WIDTH / BIRD_HEIGHT; // fallback if not loaded
    const drawWidth = drawHeight * aspect;
    ctx.drawImage(birdImg, 100, birdY, drawWidth, drawHeight);
  }

  // Score logic
  if (!gameOver && !inRestBreak) {
    for (let pipe of pipes) {
      if (!pipe.passed && pipe.x + PIPE_WIDTH / 2 < 100 + BIRD_WIDTH / 2) {
        pipe.passed = true;
        score++;
        pipesPassedSinceBreak++;
        // Set skipNextPipe one pipe earlier
        if (pipesPassedSinceBreak === pipesPerBreak - 1) {
          skipNextPipe = true;
        }
        if (pipesPassedSinceBreak >= pipesPerBreak) {
          pendingRest = true;
          lastPipeBeforeBreak = pipe; // Track the last pipe that triggers the break
        }
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
      // Top pipe body (exclude cap)
      const topRect = { 
        x: pipe.x, 
        y: 0, 
        w: PIPE_WIDTH, 
        h: Math.max(0, pipe.gapY - PIPE_CAP_HEIGHT) 
      };
      // Top pipe cap
      const topCapRect = { 
        x: pipe.x, 
        y: Math.max(0, pipe.gapY - PIPE_CAP_HEIGHT), 
        w: PIPE_WIDTH, 
        h: PIPE_CAP_HEIGHT 
      };
      // Bottom pipe cap
      const bottomPipeY = pipe.gapY + getPipeGap();
      const bottomCapRect = { 
        x: pipe.x, 
        y: bottomPipeY, 
        w: PIPE_WIDTH, 
        h: PIPE_CAP_HEIGHT 
      };
      // Bottom pipe body (exclude cap)
      const bottomRect = { 
        x: pipe.x, 
        y: bottomPipeY + PIPE_CAP_HEIGHT, 
        w: PIPE_WIDTH, 
        h: Math.max(0, canvas.height - (bottomPipeY + PIPE_CAP_HEIGHT)) 
      };
      if (
        rectsOverlap(birdRect, topRect) ||
        rectsOverlap(birdRect, topCapRect) ||
        rectsOverlap(birdRect, bottomRect) ||
        rectsOverlap(birdRect, bottomCapRect)
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
  birdVelocity = 0; // Reset velocity
  pitch = null;
  pipes = [];
  pipeTimer = 0;
  gameOver = false;
  score = 0;
  pipesPassedSinceBreak = 0;
  inRestBreak = false;
  restBreakTimer = 0;

  // --- Fix: Cancel animation frame and pitch loop ---
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  pitchLoopActive = true;
  getPitch();
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
  if (!mic) mic = audioContext.createMediaStreamSource(micStream);
  if (!pitchDetector) {
    pitchDetector = await ml5.pitchDetection(
      "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/",
      audioContext,
      micStream,
      modelLoaded
    );
  }
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

// Draw initial splash/background/buttons as soon as possible
function tryDrawInitial() {
  showLoading("Loading...");
  if (bgImg.complete && splashImg.complete) {
    hideLoading();
    draw();
  } else {
    let loaded = 0;
    function check() {
      loaded++;
      if (bgImg.complete && splashImg.complete) {
        hideLoading();
        draw();
      }
    }
    bgImg.onload = check;
    splashImg.onload = check;
  }
}

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

// Save to localStorage
function savePitchRange() {
  localStorage.setItem("buzzyBirdPitchRange", JSON.stringify({ bottom: bottomMidi, top: topMidi }));
}

// Update game pitch mapping
function updatePitchRange() {
  PITCH_MIN = midiToFreq(bottomMidi);
  PITCH_MAX = midiToFreq(topMidi);
  savePitchRange();
}

// MIDI to frequency
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

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

// Show menu on load and after game over
function showMainMenu() {
  hideLoading();
  updateMenuInfo();
  mainMenu.style.display = "flex";
  running = false;
  paused = false;
  gameOver = false;
  tryDrawInitial();
}

// --- Fetch and overwrite local user data from DB on main menu open ---
async function syncLoggedInUserFromDb() {
  const user = JSON.parse(localStorage.getItem('buzzyBirdUser') || 'null');
  if (!user || !user.name) return;
  try {
    const username = user.name.trim().toLowerCase();
    const userRef = db.ref('users/' + username);
    const snapshot = await userRef.get();
    if (snapshot.exists()) {
      const dbUser = snapshot.val();
      // Overwrite all local data with DB data
      save = {
        points: dbUser.points || 0,
        highScore: dbUser.highScore || 0,
        ownedSkins: dbUser.ownedSkins || ["default"],
        equippedSkin: dbUser.equippedSkin || "default"
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      localStorage.setItem('buzzyBirdUser', JSON.stringify(dbUser));
      updateMenuInfo && updateMenuInfo();
      renderSkinsGrid && renderSkinsGrid();
      updateAuthUI && updateAuthUI();
    }
  } catch (e) {
    // If fetch fails, do nothing (keep local data)
  }
}

// Patch showMainMenu to sync user from DB before showing menu
const origShowMainMenu = showMainMenu;
showMainMenu = async function() {
  await syncLoggedInUserFromDb();
  origShowMainMenu();
};

// On site load, also sync user before showing menu
window.addEventListener('DOMContentLoaded', async () => {
  await syncLoggedInUserFromDb();
  updateAuthUI();
  renderLeaderboard();
});

function hideMainMenu() {
  mainMenu.style.display = "none";
}

// Update points and high score in menu
function updateMenuInfo() {
  pointsDisplay.textContent = "Points: " + save.points;
  highScoreDisplay.textContent = "High Score: " + save.highScore;
}

// Start game on tap/click anywhere on menu
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

async function preloadPitchModel() {
  // Load the model once and store it
  if (!pitchModel) {
    pitchModel = await ml5.pitchDetection(
      "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/",
      null, // No audioContext yet
      null, // No stream yet
      () => {}
    );
  }
}

async function ensureMicAndStart() {
  showLoading("Setting up microphone...");
  try {
    // Always stop and request a new mic stream for each game
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      micStream = null;
    }
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    showLoading("Loading pitch model...");
    // Always close and create a new AudioContext for each game
    if (audioContext) {
      try { await audioContext.close(); } catch {}
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Always create a new MediaStreamSource from the new micStream
    mic = audioContext.createMediaStreamSource(micStream);

    // Use the preloaded model, but set up with the new context and stream
    pitchDetector = await ml5.pitchDetection(
      "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/",
      audioContext,
      micStream,
      () => {
        hideLoading();
        modelLoaded();
      }
    );
    // If modelLoaded is not called, hideLoading() after a timeout as fallback
    setTimeout(hideLoading, 4000);
    draw();
  } catch (err) {
    hideLoading();
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

// Show menu after game over
function onGameOverMenu() {
  showMainMenu(); // Remove setTimeout, show immediately
}

// Example exit button hit test
function exitButtonClicked(x, y) {
  // Replace these with your actual exit button coordinates and size
  const btnX = canvas.width - 60;
  const btnY = 20;
  const btnW = 40;
  const btnH = 40;
  return x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH;
}

// Helper for green-to-red gradient
function getPipesPerBreakGradient(val) {
  // 3 = green (hue 120), 10 = red (hue 0)
  const percent = (val - 3) / (10 - 3);
  const hue = 120 - percent * 120; // 120 (green) to 0 (red)
  // Use lightness and saturation similar to your light green
  return `linear-gradient(90deg, hsl(${hue}, 80%, 90%) 0%, hsl(${hue}, 80%, 90%) 100%)`;
}

// --- Rest Animation ---
function drawRestAnimation() {
  // Draw animated "rest" in the center of the screen, 2x larger for crispness
  const letterCount = 4;
  const scale = 2; // 2x instead of 4x
  const letterWidth = 20 * scale; // 40
  const letterHeight = 32 * scale; // 64
  const imgY = canvas.height / 2 - letterHeight / 2;
  const baseX = canvas.width / 2 - (letterCount * letterWidth) / 2;
  const t = restBreakTimer;
  for (let i = 0; i < letterCount; i++) {
    // Sine wave: amplitude 32px, period 1s, staggered by 0.7 per letter
    const phase = t * 2 * Math.PI + i * 0.7;
    const yOffset = Math.sin(phase) * 32;
    // Crop 1px from left and right of each letter
    ctx.drawImage(
      restImg,
      i * 20 + 1, 0, 18, 32, // src: crop 1px from each side
      baseX + i * letterWidth, imgY + yOffset, letterWidth, letterHeight // dest (2x)
    );
  }
}

// Helper for pipe speed gradient (green=slow, red=fast)
function getPipeSpeedGradient(val) {
  // 1 = green (hue 120), 100 = red (hue 0)
  const percent = (val - 1) / (100 - 1);
  const hue = 120 - percent * 120;
  return `linear-gradient(90deg, hsl(${hue}, 80%, 90%) 0%, hsl(${hue}, 80%, 90%) 100%)`;
}

// Helper to map slider value to pipe speed (1=slowest, 100=fastest)
function getPipeSpeedFromSlider(val) {
  // Map 1 (slowest) to 100 (fastest) to a reasonable speed range, e.g. 1.5 to 4
  return 1.5 + ((val - 1) / 99) * (4 - 1.5);
}

// --- Pipe Interval Calculation ---
function getPipeIntervalFrames() {
  // Desired distance between pipes in pixels
  const desiredDistance = 320;
  return Math.round(desiredDistance / pipeSpeed);
}

// Helper for green-to-red border color (darker, more saturated than background)
function getBoxBorderColor(val, min, max) {
  const percent = (val - min) / (max - min);
  const hue = 120 - percent * 120;
  return `hsl(${hue}, 90%, 45%)`;
}

// Full refresh function
function fullRefresh() {
  // Cancel animation frame
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Stop pitch detection loop
  pitchLoopActive = false;

  // Stop and close audio context and mic stream
  if (audioContext) {
    try { audioContext.close(); } catch {}
    audioContext = null;
  }
  if (micStream) {
    try {
      if (micStream.getTracks) {
        micStream.getTracks().forEach(track => track.stop());
      }
    } catch {}
    micStream = null;
  }
  mic = null;
  pitchDetector = null;

  // Remove any other intervals/timeouts (if any)
  let id = window.setTimeout(() => {}, 0);
  while (id--) {
    window.clearTimeout(id);
    window.clearInterval(id);
  }

  // Remove any event listeners added dynamically (if any were)
  // (If you add listeners dynamically elsewhere, remove them here)

  // Reset all game state variables
  running = false;
  paused = false;
  gameOver = false;
  score = 0;
  pipes = [];
  pipeTimer = 0;
  pipesPassedSinceBreak = 0;
  inRestBreak = false;
  restBreakTimer = 0;
  pendingRest = false;
  skipNextPipe = false;
  lastPipeBeforeBreak = null; // <-- Track the last pipe before break
  birdY = 300;
  birdVelocity = 0;
  pitch = null;

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Show main menu or splash
  showMainMenu();
}

// Resume audio context if suspended
async function resumeAudioContext() {
  if (audioContext && audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

// Call this function to ensure audio context is running
async function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } else if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

// Loading overlay functions
function showLoading(msg = "Loading...") {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.classList.add("active");
    overlay.textContent = msg;
  }
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.remove("active");
}

// --- Helper: Find difficulty index for current settings ---
function getMatchingDifficultyIndex(pipes, speedSlider) {
  for (let i = 0; i < difficulties.length; i++) {
    if (
      pipes === difficulties[i].pipesPerBreak &&
      speedSlider === difficulties[i].pipeSpeedSlider
    ) {
      return i;
    }
  }
  return -1;
}

// --- Update Difficulty Button UI ---
function updateDifficultyBtn() {
  let pipes = pipesPerBreak;
  let speedSlider = pipeSpeedSliderValue;
  let idx = getMatchingDifficultyIndex(pipes, speedSlider);
  isCustom = idx === -1;
  if (isCustom) {
    difficultyBtn.textContent = customDifficulty.name;
    difficultyBtn.style.background = customDifficulty.bg;
    difficultyBtn.style.border = `2.5px solid ${customDifficulty.border}`;
    difficultyBtn.style.color = customDifficulty.color;
  } else {
    difficultyIndex = idx;
    const d = difficulties[difficultyIndex];
    difficultyBtn.textContent = d.name;
    difficultyBtn.style.background = d.bg;
    difficultyBtn.style.border = `2.5px solid ${d.border}`;
    difficultyBtn.style.color = d.color;
  }
}

// --- Set sliders and game values from difficulty ---
function setDifficulty(idx) {
  const d = difficulties[idx];
  difficultyIndex = idx;
  isCustom = false;
  // Update pipesPerBreak and pipeSpeedSliderValue
  pipesPerBreak = d.pipesPerBreak;
  pipeSpeedSliderValue = d.pipeSpeedSlider;
  pipeSpeed = getPipeSpeedFromSlider(pipeSpeedSliderValue);

  // Update UI for settings popup
  pipesPerBreakBox.textContent = pipesPerBreak;
  pipesPerBreakBox.style.background = getPipesPerBreakGradient(pipesPerBreak);
  pipesPerBreakBox.style.border = `2px solid ${getBoxBorderColor(pipesPerBreak, 3, 10)}`;
  pipesSlider.value = pipesPerBreak;
  pipesSliderDisplay.textContent = pipesPerBreak;

  pipeSpeedBox.textContent = pipeSpeedSliderValue;
  pipeSpeedBox.style.background = getPipeSpeedGradient(pipeSpeedSliderValue);
  pipeSpeedBox.style.border = `2px solid ${getBoxBorderColor(pipeSpeedSliderValue, 1, 100)}`;
  pipeSpeedSlider.value = pipeSpeedSliderValue;
  pipeSpeedSliderDisplay.textContent = pipeSpeedSliderValue;

  // Save to localStorage
  localStorage.setItem("buzzyBirdPipesPerBreak", pipesPerBreak);
  localStorage.setItem("buzzyBirdPipeSpeed", pipeSpeedSliderValue);

  updateDifficultyBtn();
}

// --- When sliders change, update difficulty button ---
function onAdvancedSettingChanged() {
  // Update pipesPerBreak and pipeSpeedSliderValue from sliders
  pipesPerBreak = parseInt(pipesSlider.value);
  pipesPerBreakBox.textContent = pipesPerBreak;
  pipesPerBreakBox.style.background = getPipesPerBreakGradient(pipesPerBreak);
  pipesPerBreakBox.style.border = `2px solid ${getBoxBorderColor(pipesPerBreak, 3, 10)}`;

  pipeSpeedSliderValue = parseInt(pipeSpeedSlider.value);
  pipeSpeed = getPipeSpeedFromSlider(pipeSpeedSliderValue);
  pipeSpeedBox.textContent = pipeSpeedSliderValue;
  pipeSpeedBox.style.background = getPipeSpeedGradient(pipeSpeedSliderValue);
  pipeSpeedBox.style.border = `2px solid ${getBoxBorderColor(pipeSpeedSliderValue, 1, 100)}`;

  // Save to localStorage
  localStorage.setItem("buzzyBirdPipesPerBreak", pipesPerBreak);
  localStorage.setItem("buzzyBirdPipeSpeed", pipeSpeedSliderValue);

  updateDifficultyBtn();
}

async function hashPasscode(passcode) {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signUp(name, passcode, localData) {
  const username = name.trim().toLowerCase();
  const userRef = db.ref('users/' + username);
  const snapshot = await userRef.get();
  if (snapshot.exists()) {
    throw new Error("Name is already taken.");
  }
  const passcodeHash = await hashPasscode(passcode);
  // Merge local data
  const userData = {
    name: name.trim(),
    passcodeHash,
    highScore: localData.highScore || 0,
    points: localData.points || 0,
    ownedSkins: localData.ownedSkins || ["default"]
  };
  await userRef.set(userData);
  return userData;
}

async function logIn(name, passcode, localData) {
  const username = name.trim().toLowerCase();
  const userRef = db.ref('users/' + username);
  const snapshot = await userRef.get();
  if (!snapshot.exists()) throw new Error("Account not found.");
  const userData = snapshot.val();
  const passcodeHash = await hashPasscode(passcode);
  if (userData.passcodeHash !== passcodeHash) throw new Error("Incorrect passcode.");

  // --- Only add new local progress since last sync ---
  // Get last synced points from localStorage (or 0 if not set)
  const lastSyncedPoints = Number(localStorage.getItem('buzzyBirdLastSyncedPoints') || 0);
  const newLocalPoints = Math.max(0, (localData.points || 0) - lastSyncedPoints);

  const merged = {
    ...userData,
    highScore: Math.max(userData.highScore || 0, localData.highScore || 0),
    points: (userData.points || 0) + newLocalPoints,
    ownedSkins: Array.from(new Set([...(userData.ownedSkins || []), ...(localData.ownedSkins || [])]))
  };
  await userRef.update(merged);

  // Update last synced points
  localStorage.setItem('buzzyBirdLastSyncedPoints', merged.points);

  return merged;
}

async function changeName(oldName, passcode, newName) {
  const oldUsername = oldName.trim().toLowerCase();
  const newUsername = newName.trim().toLowerCase();
  if (oldUsername === newUsername) throw new Error("New name must be different.");
  const oldRef = db.ref('users/' + oldUsername);
  const newRef = db.ref('users/' + newUsername);

  const [oldSnap, newSnap] = await Promise.all([oldRef.get(), newRef.get()]);
  if (!oldSnap.exists()) throw new Error("Current account not found.");
  if (newSnap.exists()) throw new Error("New name is already taken.");

  const userData = oldSnap.val();
  const passcodeHash = await hashPasscode(passcode);
  if (userData.passcodeHash !== passcodeHash) throw new Error("Incorrect passcode.");

  // Copy data to new name and delete old
  await newRef.set({ ...userData, name: newName.trim() });
  await oldRef.remove();
}

async function updateHighScore(name, newScore) {
  const username = name.trim().toLowerCase();
  const userRef = db.ref('users/' + username + '/highScore');
  const snapshot = await userRef.get();
  if (!snapshot.exists() || newScore > snapshot.val()) {
    await userRef.set(newScore);
  }
}

async function fetchLeaderboard() {
  const snapshot = await db.ref('users').orderByChild('highScore').once('value');
  const users = [];
  snapshot.forEach(child => {
    //console.log('Child:', child.key, child.val());
    users.push(child.val());
  });
  //console.log('LEADERBOARD USERS ARRAY:', users); // Debug: see processed array
  // Sort descending by highScore
  users.sort((a, b) => (b.highScore || 0) - (a.highScore || 0));
  return users;
}



// -------------------------------------------------
// ---------------- FUNCTIONAL CODE ----------------
// -------------------------------------------------

let pitch = null;
let birdY = 300;
let smoothing = 0.8;

let birdVelocity = 0; // Bird's vertical speed
const GRAVITY = 0.7;  // Adjust as needed for smoothness

let audioContext, mic, pitchDetector, micStream;
let running = false;
let paused = false;
let gameOver = false;
let score = 0;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false; // Disable image smoothing

// Load images
const bgImg = new Image();
bgImg.src = "assets/background.png";
const splashImg = new Image();
splashImg.src = "assets/splash.png";
const birdImg = new Image();
birdImg.src = "assets/skins/default.png"; // Default skin
const pipeImg = new Image();
pipeImg.src = "assets/pipe.png";
const gameoverImg = new Image();
gameoverImg.src = "assets/gameover.png";

// Load digit images for score display
const digitImgs = [];
for (let i = 0; i <= 9; i++) {
  digitImgs[i] = new Image();
  digitImgs[i].src = `assets/nums/${i}.png`; // <-- updated path
}

// Pipe settings
const PIPE_WIDTH = 60;
let pipes = [];
let pipeTimer = 0;
const PIPE_INTERVAL = 120; // frames
const PIPE_CAP_HEIGHT = 24; // Height of the pipe cap in pixels (now 24)

// Bird settings
const BIRD_WIDTH = 40;
const BIRD_HEIGHT = 32;

// Animation and pitch loop
let animationFrameId = null;
let pitchLoopActive = false;

// Pitch range for mapping to screen height (easy to adjust)
let bottomMidi = 48; // C3
let topMidi = 60;   // C5
let PITCH_MIN = midiToFreq(bottomMidi);  // Initialize with current bottomMidi
let PITCH_MAX = midiToFreq(topMidi);     // Initialize with current topMidi

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
resizeCanvas();

// --- Persistent Storage Manager ---
const STORAGE_KEY = "buzzyBirdSave";
const DEFAULT_SKINS = [
  { id: "default", name: "Classic", price: 0, img: "assets/skins/default.png" },
  // Example: { id: "red", name: "Red Bird", price: 100, img: "assets/skins/red.png" },
  // Add more skins as needed
];

// Global save object
let save = loadSave();

// --- Skin Management ---
const SKINS = [
  ...DEFAULT_SKINS,
  { id: "red", name: "Red Bird", price: 5, img: "assets/skins/red.png" },
  { id: "poop", name: "Poop Bird", price: 5, img: "assets/skins/poop.png" },
  { id: "rainbow", name: "Rainbow Bird", price: 10, img: "assets/skins/rainbow.png" },
  { id: "diamond", name: "Diamond Bird", price: 20, img: "assets/skins/diamond.png" },
  { id: "retro", name: "Retro Bird", price: 20, img: "assets/skins/retro.png" },
  { id: "mustard", name: "Mustard", price: 30, img: "assets/skins/mustard.png" },
  { id: "mango", name: "Mango", price: 30, img: "assets/skins/mango.png" }
];

updateBirdImage();

// Handle in-canvas button clicks
canvas.addEventListener("click", function (e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Always check for exit button, even if gameOver
  if (exitButtonClicked(mouseX, mouseY)) {
    showMainMenu();
    return;
  }

  // If game over, start a new game
  if (gameOver) {
    resetGame();
    running = true;
    paused = false;
    gameOver = false;
    pitchLoopActive = true;
    ensureMicAndStart();
    return;
  }

  // If running and not paused, pause on tap
  if (running && !paused) {
    paused = true;
    draw();
    return;
  }

  // If paused, unpause on tap
  if (running && paused) {
    paused = false;
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(draw);
    }
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

tryDrawInitial();

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

mainMenu.addEventListener("mousedown", startGameFromMenu);
mainMenu.addEventListener("touchstart", startGameFromMenu, { passive: false });

let pitchModel = null; // Store the loaded model


// Call this once at startup
preloadPitchModel();

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

// --- Rest Break Feature Variables ---
let pipesPerBreak = 5; // Default value
let pipesPassedSinceBreak = 0;
let inRestBreak = false;
let restBreakTimer = 0;
let pendingRest = false;
let skipNextPipe = false;
let lastPipeBeforeBreak = null; // <-- Track the last pipe before break
const REST_BREAK_DURATION = 3; // seconds
const restImg = new Image();
restImg.src = "assets/rest.png";

// Load pipesPerBreak from localStorage if available
const storedPipesPerBreak = localStorage.getItem("buzzyBirdPipesPerBreak");
if (storedPipesPerBreak !== null) {
  pipesPerBreak = parseInt(storedPipesPerBreak) || 5;
}

const pipesPerBreakBox = document.getElementById("pipesPerBreakBox");
// Ensure the box displays the correct value and gradient on load
pipesPerBreakBox.textContent = pipesPerBreak;
pipesPerBreakBox.style.background = getPipesPerBreakGradient(pipesPerBreak);
pipesPerBreakBox.style.border = `2px solid ${getBoxBorderColor(pipesPerBreak, 3, 10)}`;

// Slider popup for pipes per break
const pipesSliderPopup = document.createElement("div");
pipesSliderPopup.className = "popup hidden";
pipesSliderPopup.id = "pipesSliderPopup";
pipesSliderPopup.innerHTML = `
  <div class="popup-content">
    <h3>Pipes per Break</h3>
    <input type="range" id="pipesSlider" min="3" max="10" value="${pipesPerBreak}" style="width: 220px;">
    <div id="pipesSliderDisplay" style="margin-top: 12px; font-size: 1.2em;">${pipesPerBreak}</div>
    <button id="closePipesSliderBtn">OK</button>
  </div>
`;
document.body.appendChild(pipesSliderPopup);

const pipesSlider = pipesSliderPopup.querySelector("#pipesSlider");
const pipesSliderDisplay = pipesSliderPopup.querySelector("#pipesSliderDisplay");
const closePipesSliderBtn = pipesSliderPopup.querySelector("#closePipesSliderBtn");

// Open slider on box click
pipesPerBreakBox.addEventListener("click", () => {
  pipesSlider.value = pipesPerBreak;
  pipesSliderDisplay.textContent = pipesPerBreak;
  pipesSliderPopup.classList.remove("hidden");
});

// Update display, background, and border on slider input
pipesSlider.addEventListener("input", () => {
  pipesSliderDisplay.textContent = pipesSlider.value;
  pipesPerBreakBox.style.background = getPipesPerBreakGradient(pipesSlider.value);
  pipesPerBreakBox.style.border = `2px solid ${getBoxBorderColor(pipesSlider.value, 3, 10)}`;
});

// Save value and close popup
closePipesSliderBtn.addEventListener("click", () => {
  pipesPerBreak = parseInt(pipesSlider.value);
  pipesPerBreakBox.textContent = pipesPerBreak;
  pipesPerBreakBox.style.background = getPipesPerBreakGradient(pipesPerBreak);
  pipesPerBreakBox.style.border = `2px solid ${getBoxBorderColor(pipesPerBreak, 3, 10)}`;
  localStorage.setItem("buzzyBirdPipesPerBreak", pipesPerBreak);
  pipesSliderPopup.classList.add("hidden");
});

const bugBtn = document.getElementById("bugBtn");
if (bugBtn) {
  bugBtn.addEventListener("click", () => {
    window.open("https://docs.google.com/forms/d/e/1FAIpQLScwbnly5GXgHmD5vIp9LcuWeZexq_y9r00n8ozvSEInXcCyQA/viewform?usp=dialog", "_blank"); // Replace with your actual link
  });
}

// --- Pipe Speed Feature Variables ---
let pipeSpeed = 2; // Default value (will be set by slider)
const storedPipeSpeed = localStorage.getItem("buzzyBirdPipeSpeed");
if (storedPipeSpeed !== null) {
  pipeSpeed = getPipeSpeedFromSlider(parseInt(storedPipeSpeed));
}

const pipeSpeedBox = document.getElementById("pipeSpeedBox");
// Ensure the box displays the correct value and gradient on load
let pipeSpeedSliderValue = storedPipeSpeed !== null ? parseInt(storedPipeSpeed) : 50;
pipeSpeedBox.textContent = pipeSpeedSliderValue;
pipeSpeedBox.style.background = getPipeSpeedGradient(pipeSpeedSliderValue);
pipeSpeedBox.style.border = `2px solid ${getBoxBorderColor(pipeSpeedSliderValue, 1, 100)}`;

// Slider popup for pipe speed
const pipeSpeedSliderPopup = document.createElement("div");
pipeSpeedSliderPopup.className = "popup hidden";
pipeSpeedSliderPopup.id = "pipeSpeedSliderPopup";
pipeSpeedSliderPopup.innerHTML = `
  <div class="popup-content">
    <h3>Pipe Speed</h3>
    <input type="range" id="pipeSpeedSlider" min="1" max="100" value="${pipeSpeedSliderValue}" style="width: 220px;">
    <div id="pipeSpeedSliderDisplay" style="margin-top: 12px; font-size: 1.2em;">${pipeSpeedSliderValue}</div>
    <button id="closePipeSpeedSliderBtn">OK</button>
  </div>
`;
document.body.appendChild(pipeSpeedSliderPopup);

const pipeSpeedSlider = pipeSpeedSliderPopup.querySelector("#pipeSpeedSlider");
const pipeSpeedSliderDisplay = pipeSpeedSliderPopup.querySelector("#pipeSpeedSliderDisplay");
const closePipeSpeedSliderBtn = pipeSpeedSliderPopup.querySelector("#closePipeSpeedSliderBtn");

// Open slider on box click
pipeSpeedBox.addEventListener("click", () => {
  pipeSpeedSlider.value = pipeSpeedSliderValue;
  pipeSpeedSliderDisplay.textContent = pipeSpeedSlider.value;
  pipeSpeedSliderPopup.classList.remove("hidden");
});

// Update display, background, and border on slider input
pipeSpeedSlider.addEventListener("input", () => {
  pipeSpeedSliderDisplay.textContent = pipeSpeedSlider.value;
  pipeSpeedBox.textContent = pipeSpeedSlider.value;
  pipeSpeedBox.style.background = getPipeSpeedGradient(pipeSpeedSlider.value);
  pipeSpeedBox.style.border = `2px solid ${getBoxBorderColor(pipeSpeedSlider.value, 1, 100)}`;
});

// Save value and close popup
closePipeSpeedSliderBtn.addEventListener("click", () => {
  const sliderVal = parseInt(pipeSpeedSlider.value);
  pipeSpeed = getPipeSpeedFromSlider(sliderVal);
  pipeSpeedSliderValue = sliderVal; // <-- update the stored value!
  pipeSpeedBox.textContent = sliderVal;
  pipeSpeedBox.style.background = getPipeSpeedGradient(sliderVal);
  pipeSpeedBox.style.border = `2px solid ${getBoxBorderColor(sliderVal, 1, 100)}`;
  localStorage.setItem("buzzyBirdPipeSpeed", sliderVal);
  pipeSpeedSliderPopup.classList.add("hidden");
});
pipeSpeedSliderPopup.addEventListener("mousedown", (e) => {
  if (e.target === pipeSpeedSliderPopup) pipeSpeedSliderPopup.classList.add("hidden");
});

// --- Difficulty Button Logic ---
const difficultyBtn = document.getElementById("difficultyBtn");
const difficulties = [
  {
    name: "Easy",
    pipesPerBreak: 3,
    pipeSpeedSlider: 25,
    bg: "#b6ffb6",
    border: "#32cd32",
    color: "#197d19"
  },
  {
    name: "Normal",
    pipesPerBreak: 5,
    pipeSpeedSlider: 50,
    bg: "#fff59d",
    border: "#ffd600",
    color: "#bfa600"
  },
  {
    name: "Hard",
    pipesPerBreak: 7,
    pipeSpeedSlider: 75,
    bg: "#ffb6b6",
    border: "#e53935",
    color: "#a31515"
  },
  {
    name: "Insane",
    pipesPerBreak: 10,
    pipeSpeedSlider: 100,
    bg: "#e1b6ff",
    border: "#8e24aa",
    color: "#5e1670"
  }
];
const customDifficulty = {
  name: "Custom",
  bg: "#eeeeee",
  border: "#444444",
  color: "#444444"
};

let difficultyIndex = 1; // Start at "Normal" (index in difficulties)
let isCustom = false;

// --- Difficulty Button Click Handler ---
difficultyBtn.addEventListener("click", () => {
  let idx;
  if (isCustom) {
    idx = 0; // Snap to Easy if currently custom
  } else {
    idx = (difficultyIndex + 1) % difficulties.length;
  }
  setDifficulty(idx);
});

// --- Patch slider event listeners to use onAdvancedSettingChanged ---
pipesSlider.addEventListener("input", onAdvancedSettingChanged);
closePipesSliderBtn.addEventListener("click", () => {
  pipesSliderPopup.classList.add("hidden");
});

pipeSpeedSlider.addEventListener("input", onAdvancedSettingChanged);
closePipeSpeedSliderBtn.addEventListener("click", () => {
  pipeSpeedSliderPopup.classList.add("hidden");
});

// --- On load, sync difficulty button to current settings ---
updateDifficultyBtn();

// --- On settings popup open, sync sliders to current settings ---
settingsBtn.addEventListener("click", () => {
  // Ensure sliders reflect current pipesPerBreak and pipeSpeedSliderValue
  pipesSlider.value = pipesPerBreak;
  pipesSliderDisplay.textContent = pipesPerBreak;
  pipeSpeedSlider.value = pipeSpeedSliderValue;
  pipeSpeedSliderDisplay.textContent = pipeSpeedSliderValue;
  pipesPerBreakBox.style.background = getPipesPerBreakGradient(pipesPerBreak);
  pipesPerBreakBox.style.border = `2px solid ${getBoxBorderColor(pipesPerBreak, 3, 10)}`;
  updateDifficultyBtn();
});

// --- Leaderboard Auth Buttons and Modals ---
const signUpBtn = document.getElementById('signUpBtn');
const logInBtn = document.getElementById('logInBtn');
const changeNameBtn = document.getElementById('changeNameBtn');
const signUpModal = document.getElementById('signUpModal');
const logInModal = document.getElementById('logInModal');
const changeNameModal = document.getElementById('changeNameModal');
const signUpCancelBtn = document.getElementById('signUpCancelBtn');
const logInCancelBtn = document.getElementById('logInCancelBtn');
const changeNameCancelBtn = document.getElementById('changeNameCancelBtn');
const signUpSubmitBtn = document.getElementById('signUpSubmitBtn');
const logInSubmitBtn = document.getElementById('logInSubmitBtn');
const changeNameSubmitBtn = document.getElementById('changeNameSubmitBtn');
const signUpName = document.getElementById('signUpName');
const signUpPasscode = document.getElementById('signUpPasscode');
const signUpError = document.getElementById('signUpError');
const logInName = document.getElementById('logInName');
const logInPasscode = document.getElementById('logInPasscode');
const logInError = document.getElementById('logInError');
const changeNameNew = document.getElementById('changeNameNew');
const changeNamePasscode = document.getElementById('changeNamePasscode');
const changeNameError = document.getElementById('changeNameError');
const usernameDisplay = document.createElement('span');
usernameDisplay.id = 'usernameDisplay';
usernameDisplay.style.position = 'absolute';
usernameDisplay.style.right = '120px';
usernameDisplay.style.bottom = '18px';
usernameDisplay.style.color = '#fff';
usernameDisplay.style.fontWeight = 'bold';
usernameDisplay.style.fontSize = '1.1em';
usernameDisplay.style.pointerEvents = 'none';

// Create logout button
const logoutBtn = document.createElement('button');
logoutBtn.id = 'logoutBtn';
logoutBtn.textContent = 'Log Out';
logoutBtn.style.position = 'absolute';
logoutBtn.style.right = '18px';
logoutBtn.style.bottom = '14px';
logoutBtn.style.zIndex = '2';
logoutBtn.style.pointerEvents = 'auto';
logoutBtn.style.background = '#000';
logoutBtn.style.color = '#fff';
logoutBtn.style.border = 'none';
logoutBtn.style.borderRadius = '8px';
logoutBtn.style.padding = '8px 18px';
logoutBtn.style.fontSize = '1em';
logoutBtn.style.cursor = 'pointer';
logoutBtn.style.transition = 'background 0.2s';
logoutBtn.addEventListener('mouseenter', () => logoutBtn.style.background = '#14a625');
logoutBtn.addEventListener('mouseleave', () => logoutBtn.style.background = '#000');
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('buzzyBirdUser');
  updateAuthUI();
  renderLeaderboard();
});

function showUsername(name) {
  usernameDisplay.textContent = `Signed in as: ${name}`;
  const leaderboard = document.getElementById('leaderboardContainer');
  if (leaderboard && !leaderboard.contains(usernameDisplay)) {
    leaderboard.appendChild(usernameDisplay);
  }
  if (leaderboard && !leaderboard.contains(logoutBtn)) {
    leaderboard.appendChild(logoutBtn);
  }
  usernameDisplay.style.display = '';
  logoutBtn.style.display = '';
}
function hideUsername() {
  if (usernameDisplay.parentNode) usernameDisplay.parentNode.removeChild(usernameDisplay);
  if (logoutBtn.parentNode) logoutBtn.parentNode.removeChild(logoutBtn);
}

function updateAuthUI() {
  const user = JSON.parse(localStorage.getItem('buzzyBirdUser') || 'null');
  if (user && user.name) {
    // Hide sign up/log in, show change name, show username and logout
    signUpBtn.style.display = 'none';
    logInBtn.style.display = 'none';
    changeNameBtn.style.display = '';
    changeNameBtn.classList.remove('hidden');
    showUsername(user.name);
  } else {
    // Show sign up/log in, hide change name, hide username and logout
    signUpBtn.style.display = '';
    logInBtn.style.display = '';
    changeNameBtn.style.display = 'none';
    changeNameBtn.classList.add('hidden');
    hideUsername();
  }
}

// --- Sign Up Logic ---
if (signUpSubmitBtn) {
  signUpSubmitBtn.addEventListener('click', async () => {
    const name = signUpName.value.trim();
    const passcode = signUpPasscode.value.trim();
    signUpError.textContent = '';
    if (!name || name.length > 20) {
      signUpError.textContent = 'Name required (max 20 chars).';
      return;
    }
    if (!/^\d{4}$/.test(passcode)) {
      signUpError.textContent = 'Passcode must be 4 digits.';
      return;
    }
    try {
      const userData = await signUp(name, passcode, save);
      localStorage.setItem('buzzyBirdUser', JSON.stringify(userData));
      // Update local save and persist
      save = {
        points: userData.points || 0,
        highScore: userData.highScore || 0,
        ownedSkins: userData.ownedSkins || ["default"],
        equippedSkin: save.equippedSkin || "default"
      };
      saveData();
      signUpModal.classList.add('hidden');
      updateAuthUI();
      renderLeaderboard();
    } catch (err) {
      signUpError.textContent = err.message || 'Sign up failed.';
    }
  });
}
// --- Log In Logic ---
if (logInSubmitBtn) {
  logInSubmitBtn.addEventListener('click', async () => {
    const name = logInName.value.trim();
    const passcode = logInPasscode.value.trim();
    logInError.textContent = '';
    if (!name) {
      logInError.textContent = 'Name required.';
      return;
    }
    if (!/^\d{4}$/.test(passcode)) {
      logInError.textContent = 'Passcode must be 4 digits.';
      return;
    }
    try {
      const userData = await logIn(name, passcode, save);
      localStorage.setItem('buzzyBirdUser', JSON.stringify(userData));
      // Update local save and persist
      save = {
        points: userData.points || 0,
        highScore: userData.highScore || 0,
        ownedSkins: userData.ownedSkins || ["default"],
        equippedSkin: save.equippedSkin || "default"
      };
      saveData();
      logInModal.classList.add('hidden');
      updateAuthUI();
      renderLeaderboard();
      // After successful login:
      updateMenuInfo();
      renderSkinsGrid();
      // ...add any other UI update functions if needed...
    } catch (err) {
      logInError.textContent = err.message || 'Log in failed.';
    }
  });
}
// --- Change Name Logic ---
if (changeNameSubmitBtn) {
  changeNameSubmitBtn.addEventListener('click', async () => {
    const user = JSON.parse(localStorage.getItem('buzzyBirdUser') || 'null');
    if (!user) {
      changeNameError.textContent = 'You must be logged in.';
      return;
    }
    const oldName = user.name;
    const newName = changeNameNew.value.trim();
    const passcode = changeNamePasscode.value.trim();
    changeNameError.textContent = '';
    if (!newName || newName.length > 20) {
      changeNameError.textContent = 'New name required (max 20 chars).';
      return;
    }
    if (!/^\d{4}$/.test(passcode)) {
      changeNameError.textContent = 'Passcode must be 4 digits.';
      return;
    }
    try {
      await changeName(oldName, passcode, newName);
      // Update localStorage
      const updatedUser = { ...user, name: newName };
      localStorage.setItem('buzzyBirdUser', JSON.stringify(updatedUser));
      changeNameModal.classList.add('hidden');
      updateAuthUI();
      renderLeaderboard(); // Refresh leaderboard after name change
    } catch (err) {
      changeNameError.textContent = err.message || 'Change name failed.';
    }
  });
}
// --- Auto-login on page load ---
window.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  renderLeaderboard();
});

// --- Leaderboard Rendering ---
async function renderLeaderboard() {
  const leaderboardList = document.getElementById('leaderboardList');
  if (!leaderboardList) return;
  leaderboardList.innerHTML = '<div style="color:#aaa;text-align:center;">Loading...</div>';
  try {
    const users = await fetchLeaderboard();
    leaderboardList.innerHTML = '';
    const currentUser = JSON.parse(localStorage.getItem('buzzyBirdUser') || 'null');
    users.forEach((user, idx) => {
      const entry = document.createElement('div');
      entry.className = 'entry';
      if (idx === 0) entry.classList.add('gold');
      else if (idx === 1) entry.classList.add('silver');
      else if (idx === 2) entry.classList.add('bronze');
      if (currentUser && user.name === currentUser.name) entry.classList.add('me');
      entry.innerHTML = `<span style="min-width:2em;display:inline-block;">${idx+1}.</span> <span style="font-weight:bold;">${user.name}</span> <span style="flex:1 1 auto;"></span> <span style="font-family:monospace;">${user.highScore || 0}</span>`;
      leaderboardList.appendChild(entry);
    });
    if (users.length === 0) {
      leaderboardList.innerHTML = '<div style="color:#aaa;text-align:center;">No scores yet.</div>';
    }
  } catch (e) {
    leaderboardList.innerHTML = '<div style="color:#f66;text-align:center;">Failed to load leaderboard.</div>';
  }
}

// Prevent leaderboard clicks from starting the game
const leaderboardContainer = document.getElementById("leaderboardContainer");
if (leaderboardContainer) {
  leaderboardContainer.addEventListener("mousedown", (e) => e.stopPropagation());
  leaderboardContainer.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: false });
}

// Restore the event listeners for the sign up and log in buttons
if (signUpBtn && signUpModal) {
  signUpBtn.addEventListener('click', (e) => {
    signUpModal.classList.remove('hidden');
    signUpError.textContent = '';
    signUpName.value = '';
    signUpPasscode.value = '';
    e.stopPropagation();
  });
}
if (logInBtn && logInModal) {
  logInBtn.addEventListener('click', (e) => {
    logInModal.classList.remove('hidden');
    logInError.textContent = '';
    logInName.value = '';
    logInPasscode.value = '';
    e.stopPropagation();
  });
}
if (logInCancelBtn && logInModal) {
  logInCancelBtn.addEventListener('click', () => {
    logInModal.classList.add('hidden');
  });
}
if (signUpCancelBtn && signUpModal) {
  signUpCancelBtn.addEventListener('click', () => {
    signUpModal.classList.add('hidden');
  });
}
if (changeNameBtn && changeNameModal) {
  changeNameBtn.addEventListener('click', (e) => {
    changeNameModal.classList.remove('hidden');
    changeNameError.textContent = '';
    changeNameNew.value = '';
    changeNamePasscode.value = '';
    e.stopPropagation();
  });
}

if (changeNameCancelBtn && changeNameModal) {
  changeNameCancelBtn.addEventListener('click', () => {
    changeNameModal.classList.add('hidden');
  });
}
