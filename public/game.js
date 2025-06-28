// =============================================================================
// GAME.JS - Game Logic, Physics, Rendering & Audio
// =============================================================================

// --- Game State Variables ---
let pitch = null;
let birdY = 300;
let smoothing = 0.8;
let birdVelocity = 0; // Bird's vertical speed
const GRAVITY = 0.7;  // Gravity constant for physics

// Audio context and pitch detection
let audioContext, mic, pitchDetector, micStream;
let pitchModel = null; // Store the loaded model
let pitchLoopActive = false;

// Game state flags
let running = false;
let paused = false;
let gameOver = false;
let score = 0;

// Animation frame management
let animationFrameId = null;

// --- Game Constants ---
const BIRD_WIDTH = 40;
const BIRD_HEIGHT = 32;
const PIPE_WIDTH = 60;
const PIPE_CAP_HEIGHT = 24; // Height of the pipe cap in pixels
const PIPE_INTERVAL = 120; // frames (deprecated, now using dynamic calculation)

// --- Pipe & Break System Variables ---
const REST_BREAK_DURATION = 3; // seconds
let pipes = [];
let pipeTimer = 0;
let pipesPerBreak = 5; // Default value
let pipesPassedSinceBreak = 0;
let inRestBreak = false;
let restBreakTimer = 0;
let pendingRest = false;
let skipNextPipe = false;
let lastPipeBeforeBreak = null;

// Pipe speed system
let pipeSpeed = 2; // Default value (will be set by slider)
let pipeSpeedSliderValue = 50; // Default slider value

// --- Pitch Range Variables ---
let bottomMidi = 48; // C3
let topMidi = 60;   // C5
let PITCH_MIN = midiToFreq(bottomMidi);
let PITCH_MAX = midiToFreq(topMidi);

// Note names for MIDI conversion
const NOTE_NAMES = [
  "C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"
];

// --- Image Assets ---
const bgImg = new Image();
bgImg.src = "assets/walls/default.png";
const splashImg = new Image();
splashImg.src = "assets/splash.png";
const birdImg = new Image();
birdImg.src = "assets/skins/default.png"; // Default skin
const pipeImg = new Image();
pipeImg.src = "assets/pipes/default.png";
const gameoverImg = new Image();
gameoverImg.src = "assets/gameover.png";
const restImg = new Image();
restImg.src = "assets/rest.png";

// Load digit images for score display
const digitImgs = [];
for (let i = 0; i <= 9; i++) {
  digitImgs[i] = new Image();
  digitImgs[i].src = `assets/nums/${i}.png`;
}

// --- Utility Functions ---

// Clamp a value between min and max
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Check if two rectangles overlap (collision detection)
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// Convert MIDI note number to frequency
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Convert MIDI note number to note name
function midiToNoteName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return name + octave;
}

// Convert note name to MIDI number
function noteNameToMidi(note) {
  // Accepts e.g. "C3", "F#4", "G♯2"
  let match = note.match(/^([A-G])([#♯]?)(\d)$/);
  if (!match) return 60; // default C4
  let [_, n, sharp, oct] = match;
  let idx = NOTE_NAMES.findIndex(x => x[0] === n && (sharp ? x.includes(sharp) : x.length === 1));
  return idx + (parseInt(oct) + 1) * 12;
}

// --- Game Physics & Logic ---

// Calculate pipe gap based on canvas height
function getPipeGap() {
  // 18% of the canvas height, but clamp between 120 and 260 pixels
  return clamp(Math.floor(canvas.height * 0.18), 120, 260);
}

// Calculate dynamic pipe interval based on speed
function getPipeIntervalFrames() {
  // Desired distance between pipes in pixels
  const desiredDistance = 320;
  return Math.round(desiredDistance / pipeSpeed);
}

// Map slider value to actual pipe speed
function getPipeSpeedFromSlider(val) {
  // Map 1 (slowest) to 100 (fastest) to a reasonable speed range, e.g. 1.5 to 4
  return 1.5 + ((val - 1) / 99) * (4 - 1.5);
}

// Update game pitch mapping
function updatePitchRange() {
  PITCH_MIN = midiToFreq(bottomMidi);
  PITCH_MAX = midiToFreq(topMidi);
  savePitchRange();
}

// --- Game State Management ---

// Reset game to initial state
function resetGame() {
  birdY = 300;
  birdVelocity = 0;
  pitch = null;
  pipes = [];
  pipeTimer = 0;
  gameOver = false;
  score = 0;
  pipesPassedSinceBreak = 0;
  inRestBreak = false;
  restBreakTimer = 0;
  pendingRest = false;
  skipNextPipe = false;
  lastPipeBeforeBreak = null;

  // Cancel animation frame and restart pitch loop
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  pitchLoopActive = true;
  getPitch();
}

// Stop the game and clean up
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
  stopAudio();
  draw();
}

// Stop audio and clean up audio context
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

// --- Audio Setup & Pitch Detection ---

// Preload the pitch detection model
async function preloadPitchModel() {
  if (!pitchModel) {
    pitchModel = await ml5.pitchDetection(
      "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/",
      null, // No audioContext yet
      null, // No stream yet
      () => {}
    );
  }
}

// Set up audio context and microphone
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

// Called when pitch detection model is loaded
function modelLoaded() {
  getPitch();
}

// Continuous pitch detection loop
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

// Ensure microphone access and start game
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

// Resume audio context if suspended
async function resumeAudioContext() {
  if (audioContext && audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

// Ensure audio context is running
async function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } else if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

// --- Canvas Rendering ---

// Responsive canvas sizing
function resizeCanvas() {
  // Check iOS orientation first
  if (!checkIOSOrientation()) {
    return; // Exit early if iOS device is in landscape
  }
  
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
  
  // Use the natural dimensions of the first digit image as reference
  // All digit images should have the same dimensions
  const firstDigitImg = digitImgs[0];
  if (!firstDigitImg || !firstDigitImg.complete) {
    // If images aren't loaded yet, skip drawing
    return;
  }
  
  // Use natural image dimensions and scale appropriately for screen size
  const baseDigitWidth = firstDigitImg.naturalWidth;
  const baseDigitHeight = firstDigitImg.naturalHeight;
  
  // Scale digits based on canvas size, but maintain aspect ratio
  const scale = Math.min(canvas.width / 800, canvas.height / 600); // Base scale on 800x600 reference
  const scaledWidth = baseDigitWidth * scale;
  const scaledHeight = baseDigitHeight * scale;
  
  const totalWidth = scoreStr.length * scaledWidth;
  let drawX = x - totalWidth / 2;
  
  for (let char of scoreStr) {
    const digit = parseInt(char);
    if (digitImgs[digit] && digitImgs[digit].complete) {
      // Draw scaled but maintaining aspect ratio
      ctx.drawImage(digitImgs[digit], drawX, y, scaledWidth, scaledHeight);
    }
    drawX += scaledWidth;
  }
}

// Draw in-canvas buttons (quit button in top right)
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

// Draw animated "rest" text during break
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

// Check if exit button was clicked
function exitButtonClicked(x, y) {
  const btnSize = 48;
  const padding = 20;
  const btnX = canvas.width - btnSize - padding;
  const btnY = padding;
  return x >= btnX && x <= btnX + btnSize && y >= btnY && y <= btnY + btnSize;
}

// --- iOS Portrait Mode Enforcement --

// Detect iOS devices
function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Create and show iOS landscape warning overlay
function showIOSLandscapeWarning() {
  // Remove existing overlay if present
  const existingOverlay = document.getElementById('iosLandscapeOverlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'iosLandscapeOverlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.color = 'white';
  overlay.style.fontFamily = 'Comic Neue, sans-serif';
  overlay.style.textAlign = 'center';
  overlay.style.padding = '20px';
  
  // Add rotation icon and text
  overlay.innerHTML = `
    <div style="font-size: 4em; margin-bottom: 20px;">📱</div>
    <h1 style="font-size: 2em; margin-bottom: 20px;">Rotate Your Device</h1>
    <p style="font-size: 1.2em; line-height: 1.5;">
      Please rotate your device to portrait mode<br>
      to play Pitch Bird on iOS devices.
    </p>
  `;
  
  document.body.appendChild(overlay);
}

// Hide iOS landscape warning overlay
function hideIOSLandscapeWarning() {
  const overlay = document.getElementById('iosLandscapeOverlay');
  if (overlay) {
    overlay.remove();
  }
}

// Check if iOS device is in landscape and show/hide warning
function checkIOSOrientation() {
  if (isIOSDevice()) {
    if (window.innerWidth > window.innerHeight) {
      // iOS device in landscape - show warning
      showIOSLandscapeWarning();
      return false; // Block normal functionality
    } else {
      // iOS device in portrait - hide warning
      hideIOSLandscapeWarning();
      return true; // Allow normal functionality
    }
  }
  return true; // Non-iOS device - allow normal functionality
}

// --- Main Draw Function ---
function draw() {
  const yPadding = 20;

  // Use PITCH_MIN and PITCH_MAX for pitch mapping
  const minPitch = PITCH_MIN;
  const maxPitch = PITCH_MAX;

  // Bird physics: pitch detection or gravity
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

  // Draw bird with proper aspect ratio
  {
    const drawHeight = BIRD_HEIGHT;
    const aspect = birdImg.naturalWidth && birdImg.naturalHeight
      ? birdImg.naturalWidth / birdImg.naturalHeight
      : BIRD_WIDTH / BIRD_HEIGHT; // fallback if not loaded
    const drawWidth = drawHeight * aspect;
    ctx.drawImage(birdImg, 100, birdY, drawWidth, drawHeight);
  }

  // Score logic - only count pipes when not in rest break
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
    // Position score at top with proper spacing based on scaled digit height
    const scoreY = 20; // Top margin
    drawScore(canvas.width / 2, scoreY, score);
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
    
    // Position score below game over image with proper spacing
    const scoreY = canvas.height / 2 + goDrawHeight / 2 + 30; // Add more spacing
    drawScore(canvas.width / 2, scoreY, score);
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

// Full system refresh/cleanup function
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

  // Remove any other intervals/timeouts
  let id = window.setTimeout(() => {}, 0);
  while (id--) {
    window.clearTimeout(id);
    window.clearInterval(id);
  }

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
  lastPipeBeforeBreak = null;
  birdY = 300;
  birdVelocity = 0;
  pitch = null;

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Show main menu or splash
  showMainMenu();
}
