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
let pitchLoopActive = false;

// Game state flags
let running = false;
let paused = false;
let gameOver = false;
let score = 0;

// Animation frame management
let animationFrameId = null;

// Delta time for frame-rate independent movement
let lastFrameTime = 0;
let deltaTime = 0;
const TARGET_FPS = 60; // Target frame rate for consistent movement
const FIXED_DELTA = 1000 / TARGET_FPS; // Fixed delta time in milliseconds

// --- Game Constants ---
const BIRD_WIDTH = 40;
const BIRD_HEIGHT = 32;
const PIPE_WIDTH = 60;
const PIPE_CAP_HEIGHT = 24; // Height of the pipe cap in pixels
const PIPE_INTERVAL = 120; // frames (deprecated, now using dynamic calculation)

// --- Pipe & Break System Variables ---
const REST_BREAK_DURATION = 3; // seconds
let pipes = [];
let pipeTimer = 0; // Time in milliseconds since last pipe
let pipesPerBreak = 5; // Default value
let pipesPassedSinceBreak = 0;
let inRestBreak = false;
let restBreakTimer = 0; // Time in milliseconds for rest break
let pendingRest = false;
let skipNextPipe = false;
let lastPipeBeforeBreak = null;

// Pipe speed system
let pipeSpeed = 2; // Default value (will be set by slider)
let pipeSpeedSliderValue = 50; // Default slider value

// Timer system - now time-based instead of frame-based

// Background scrolling system
let backgroundOffsetX = 0; // Track horizontal scrolling position

// --- Pitch Range Variables ---
let bottomMidi = 48; // C3
let topMidi = 60;   // C5
let PITCH_MIN = midiToFreq(bottomMidi);
let PITCH_MAX = midiToFreq(topMidi);

// Note names for MIDI conversion
const NOTE_NAMES = [
  "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"
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

// Helper function to detect iPad consistently
function isIPadDevice() {
  return /ipad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

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
  // Accepts e.g. "C3", "F#4", "Eb2", "Ab5"
  let match = note.match(/^([A-G])([#b]?)(\d)$/);
  if (!match) return 60; // default C4
  let [_, n, accidental, oct] = match;
  let idx = NOTE_NAMES.findIndex(x => x[0] === n && (accidental ? x.includes(accidental) : x.length === 1));
  return idx + (parseInt(oct) + 1) * 12;
}

// --- Game Physics & Logic ---

// Calculate pipe gap based on display height
function getPipeGap() {
  const displayHeight = window.displayHeight || canvas.height;
  // 18% of the display height, but clamp between 120 and 260 pixels
  return clamp(Math.floor(displayHeight * 0.18), 120, 260);
}

// Calculate dynamic pipe interval based on speed (now returns milliseconds)
function getPipeIntervalMs() {
  // Desired distance between pipes in pixels
  const desiredDistance = 320;
  // Convert to time: distance / speed * (1000ms/targetFPS) for consistent timing
  return (desiredDistance / pipeSpeed) * (1000 / TARGET_FPS);
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
  // Stop any existing animation loops immediately
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  // Clean up any emergency timeouts
  if (window.ipadFrameTimeout) {
    clearTimeout(window.ipadFrameTimeout);
    window.ipadFrameTimeout = null;
  }
  if (window.ipadEmergencyTimeout) {
    clearTimeout(window.ipadEmergencyTimeout);
    window.ipadEmergencyTimeout = null;
  }
  
  // Reset all game state
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
  backgroundOffsetX = 0; // Reset background scroll position
  lastFrameTime = 0; // Reset delta time tracking
  deltaTime = 0; // Also reset delta time itself

  // Ensure pitch loop will be active for new game
  pitchLoopActive = true;
}

// Stop the game and clean up
async function stopGame() {
  running = false;
  paused = false;
  pitch = null;
  birdY = 300;
  pipes = [];
  backgroundOffsetX = 0; // Reset background scroll position
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  // Clear any emergency timeouts
  if (window.ipadEmergencyTimeout) {
    clearTimeout(window.ipadEmergencyTimeout);
    window.ipadEmergencyTimeout = null;
  }
  await cleanupAudioResources();
  draw();
}

// --- Browser Polyfills and Fixes ---

// --- Audio Setup & Pitch Detection ---

// Warm up pitch detection - call this on first user interaction to prepare everything
async function warmupPitchDetection() {
  // Prepare audio context early if possible
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      // Immediately suspend it to save resources until game starts
      if (audioContext.state === 'running') {
        await audioContext.suspend();
      }
      console.log('Audio context prepared early');
    } catch (err) {
      console.log('Could not create audio context early:', err);
    }
  }
}

// Called when pitch detection model is loaded
function modelLoaded() {
  console.log('Pitch detection model loaded and ready');
  
  // Ensure pitch loop is active before starting
  pitchLoopActive = true;
  
  // Start pitch detection only if not already running
  if (pitchDetector && !pitch) {
    getPitch();
  }
  
  // Only start the animation loop if the game is actually running and no animation is already active
  if (running && !animationFrameId) {
    animationFrameId = requestAnimationFrame(draw);
  }
}

// Continuous pitch detection loop
function getPitch() {
  // Allow pitch detection during initial setup (when !running but pitchLoopActive)
  if (!pitchLoopActive || paused) {
    return;
  }
  if (!pitchDetector) {
    return;
  }
  
  pitchDetector.getPitch((err, frequency) => {
    if (err) {
      console.log('getPitch error:', err);
    }
    if (frequency) {
      pitch = frequency;
    } else {
      pitch = null;
    }
    // Only continue if pitchLoopActive is still true and we're not in a cleanup state
    if (pitchLoopActive && pitchDetector) {
      // Use requestAnimationFrame to prevent callback stacking
      requestAnimationFrame(() => {
        if (pitchLoopActive && pitchDetector) {
          getPitch();
        }
      });
    }
  });
}

// Ensure microphone access and start game
async function ensureMicAndStart() {
  showLoading("Setting up microphone...");
  try {
    // Clean up any existing resources first - wait for complete cleanup
    await cleanupAudioResources();
    
    // Wait a bit to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Always request a fresh mic stream for each game session
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Always create a fresh audio context for better performance
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Always create a new MediaStreamSource from the new micStream
    mic = audioContext.createMediaStreamSource(micStream);

    // Always use the URL - ml5.pitchDetection expects a URL string
    showLoading("Loading pitch model...");
    console.log('Initializing pitch detection model');
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
    // Don't call draw() here - let modelLoaded() handle starting the animation loop
  } catch (err) {
    console.error('Error setting up microphone:', err);
    hideLoading();
    alert("Microphone access is required to play!");
    showMainMenu();
  }
}

// Clean up audio resources thoroughly
async function cleanupAudioResources() {
  // Stop pitch detection immediately
  pitchLoopActive = false;
  
  // Wait a frame to ensure any pending pitch callbacks are cancelled
  await new Promise(resolve => requestAnimationFrame(resolve));
  
  // Clean up pitch detector
  if (pitchDetector) {
    try {
      if (pitchDetector.dispose) pitchDetector.dispose();
    } catch {}
    pitchDetector = null;
  }
  
  // Clean up microphone stream
  if (micStream) {
    try {
      micStream.getTracks().forEach(track => track.stop());
    } catch {}
    micStream = null;
  }
  
  // Clean up mic reference
  if (mic) {
    try {
      mic.disconnect();
    } catch {}
    mic = null;
  }
  
  // Clean up audio context more aggressively on restart
  if (audioContext) {
    try {
      if (audioContext.state === 'running') {
        await audioContext.suspend(); // Suspend instead of closing for reuse
      }
      // For multiple restarts, close the context completely to prevent accumulation
      if (audioContext.state !== 'closed') {
        await audioContext.close();
      }
    } catch {}
    audioContext = null; // Always reset to null to force recreation
  }
  
  // Force garbage collection if available (mainly for testing)
  if (window.gc) {
    window.gc();
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

// Responsive canvas sizing with proper high-DPI support
function resizeCanvas() {
  // Check iOS orientation first
  if (!checkIOSOrientation()) {
    return; // Exit early if iOS device is in landscape
  }
  
  // Detect mobile devices - be very aggressive for iPad Safari
  const userAgent = navigator.userAgent.toLowerCase();
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isTabletSize = window.innerWidth <= 1024 || window.innerHeight <= 1024;
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(navigator.userAgent);
  const isAppleDevice = /ipad|iphone|ipod|macintosh/i.test(navigator.userAgent) && hasTouch;
  
  // FORCE MOBILE MODE FOR TESTING - this will force mobile scaling
  const forceMobile = window.innerWidth <= 1200; // Force mobile for most tablet/mobile sizes
  
  // Force mobile detection for iPad and touch devices
  const isMobile = forceMobile || isMobileUA || isAppleDevice || isTabletSize || hasTouch;
  
  // Get device pixel ratio for high-DPI displays (iPad, Retina, etc.)
  const dpr = window.devicePixelRatio || 1;
  
  // Optimize for performance - cap DPR for better frame rates
  // High DPR can cause performance issues, so limit it
  let effectiveDpr;
  
  if (isMobile) {
    // Mobile devices: Cap at 1.5x for better performance
    effectiveDpr = Math.min(dpr, 1.5);
  } else {
    // Desktop: Use actual DPR but cap at 2x
    effectiveDpr = Math.min(dpr, 2.0);
  }
  
  // Get the display size in CSS pixels
  let displayWidth, displayHeight;
  let canvasLeft = 0;
  let canvasTop = 0;
  
  if (window.innerWidth > window.innerHeight) {
    // Landscape: fixed width, full height, horizontally centered
    // Make canvas wider on PC/desktop, keep mobile the same
    const canvasWidth = isMobile ? 480 : 600;
    displayWidth = canvasWidth;
    displayHeight = window.innerHeight;
    canvasLeft = (window.innerWidth - canvasWidth) / 2;
    canvasTop = 0;
  } else {
    // Portrait: full screen
    displayWidth = window.innerWidth;
    displayHeight = window.innerHeight;
    canvasLeft = 0;
    canvasTop = 0;
  }
  
  // Set the canvas CSS size (what the user sees)
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  canvas.style.left = canvasLeft + 'px';
  canvas.style.top = canvasTop + 'px';
  canvas.style.position = 'absolute';
  
  // Set the canvas internal resolution (accounting for device pixel ratio)
  canvas.width = Math.floor(displayWidth * effectiveDpr);
  canvas.height = Math.floor(displayHeight * effectiveDpr);
  
  // Reset the context and scale it to match the device pixel ratio
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset any previous transforms
  ctx.scale(effectiveDpr, effectiveDpr);
  
  // Disable image smoothing after resize for pixel-perfect rendering
  ctx.imageSmoothingEnabled = false;
  
  // Store the scale factor globally for use in drawing functions
  window.canvasScale = effectiveDpr;
  window.displayWidth = displayWidth;
  window.displayHeight = displayHeight;
  window.isMobile = isMobile;
  window.isIPad = isIPadDevice();
  
  // Debug: Log device information
  if (window.isIPad) {
    console.log("iPad detected - using enhanced scaling and speed");
  }
  
  // Calculate base game scale factor for sprites and UI - simplified scaling
  // iPad gets additional scaling for bigger birds and pipes
  if (window.isIPad) {
    window.gameScale = Math.max(1.2, displayWidth / 600); // Larger scaling factor for iPad
  } else {
    window.gameScale = isMobile ? Math.max(0.8, displayWidth / 800) : Math.max(0.7, displayWidth / 1000);
  }
  
  // Only redraw if not running (so splash/buttons show up)
  if (!running) draw();
}

// Draw score using digit images with proper DPI scaling
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
  
  // Use display dimensions for consistent scaling across devices
  const displayWidth = window.displayWidth || canvas.width;
  const displayHeight = window.displayHeight || canvas.height;
  
  // Scale digits based on display size with moderate scaling
  const minScale = Math.min(displayWidth / 480, displayHeight / 800); // Base scale
  const scale = Math.max(0.8, Math.min(1.4, minScale * 0.9)); // Much smaller scaling to match sprites
  
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
  const displayWidth = window.displayWidth || canvas.width;
  const gameScale = window.gameScale || 1;
  const btnSize = Math.max(48, 36 * Math.min(gameScale, 1.3)); // Smaller button size, cap the scaling
  const padding = 20 * Math.max(1, gameScale * 0.5); // Less padding scaling
  const quitX = displayWidth - btnSize - padding;
  const btnY = padding;

  // Quit button only
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#d32f2f";
  ctx.fillRect(quitX, btnY, btnSize, btnSize);
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.max(24, 18 * Math.min(gameScale, 1.3))}px sans-serif`; // Smaller font, cap the scaling
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✖", quitX + btnSize / 2, btnY + btnSize / 2 + 1);
  ctx.restore();
}

// Draw animated "rest" text during break
function drawRestAnimation() {
  const displayWidth = window.displayWidth || canvas.width;
  const displayHeight = window.displayHeight || canvas.height;
  
  // Draw animated "rest" in the center of the screen, scaled appropriately
  const letterCount = 4;
  const baseScale = Math.min(displayWidth / 480, displayHeight / 800); // Scale based on display size
  const scale = Math.max(1, Math.min(3, baseScale * 2)); // Clamp scale between 1x and 3x
  const letterWidth = 20 * scale;
  const letterHeight = 32 * scale;
  const imgY = displayHeight / 2 - letterHeight / 2;
  const baseX = displayWidth / 2 - (letterCount * letterWidth) / 2;
  const t = restBreakTimer / 1000; // Convert milliseconds to seconds for animation
  for (let i = 0; i < letterCount; i++) {
    // Sine wave: amplitude scaled with size, period 1s, staggered by 0.7 per letter
    const phase = t * 2 * Math.PI + i * 0.7;
    const yOffset = Math.sin(phase) * (32 * scale / 2); // Scale the wave amplitude too
    // Crop 1px from left and right of each letter
    ctx.drawImage(
      restImg,
      i * 20 + 1, 0, 18, 32, // src: crop 1px from each side
      baseX + i * letterWidth, imgY + yOffset, letterWidth, letterHeight // dest (scaled)
    );
  }
}

// Check if exit button was clicked
function exitButtonClicked(x, y) {
  const displayWidth = window.displayWidth || canvas.width;
  const gameScale = window.gameScale || 1;
  const btnSize = Math.max(48, 36 * Math.min(gameScale, 1.3)); // Match the new button size
  const padding = 20 * Math.max(1, gameScale * 0.5); // Match the new padding
  const btnX = displayWidth - btnSize - padding;
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

// --- Canvas Rendering ---

// Draw sidescrolling tiled background
function drawScrollingBackground() {
  const displayWidth = window.displayWidth || canvas.width;
  const displayHeight = window.displayHeight || canvas.height;
  
  if (!bgImg.complete) {
    // If background image isn't loaded yet, fill with a solid color
    ctx.fillStyle = "#70c5ce";
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    return;
  }
  
  // Calculate how many tiles we need to cover the canvas width
  const bgWidth = bgImg.naturalWidth || bgImg.width;
  const bgHeight = bgImg.naturalHeight || bgImg.height;
  
  // Scale the background to fit display height while maintaining aspect ratio
  const scale = displayHeight / bgHeight;
  const scaledBgWidth = Math.floor(bgWidth * scale); // Floor to ensure integer width
  const scaledBgHeight = displayHeight;
  
  // Calculate the starting x position based on the offset
  // Use modulo to create seamless tiling and floor to ensure pixel alignment
  const startX = Math.floor(-(backgroundOffsetX % scaledBgWidth));
  
  // Draw tiles from left to right to cover the entire canvas
  const tilesNeeded = Math.ceil(displayWidth / scaledBgWidth) + 2; // +2 for extra coverage
  
  for (let i = 0; i < tilesNeeded; i++) {
    const x = Math.floor(startX + (i * scaledBgWidth));
    // Add slight overlap to prevent gaps on some platforms
    const drawWidth = scaledBgWidth + 1;
    ctx.drawImage(bgImg, x, 0, drawWidth, scaledBgHeight);
  }
}

// Draw DPI indicator in top-left corner for debugging
function drawDPIIndicator() {
  // Debug display removed - game is working properly now
}

// Draw debug information panel
function drawDebugPanel() {
  if (!window.debugMode) return; // Only show when debug mode is enabled
  
  const displayWidth = window.displayWidth || canvas.width;
  const displayHeight = window.displayHeight || canvas.height;
  
  // Create semi-transparent background for debug panel
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(10, 10, 300, 200);
  
  // Set text style
  ctx.fillStyle = "#00ff00";
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  
  let y = 25;
  const lineHeight = 15;
  
  // Display debug information
  ctx.fillText(`Pitch: ${pitch ? pitch.toFixed(2) + ' Hz' : 'None'}`, 20, y);
  y += lineHeight;
  
  ctx.fillText(`Bird Y: ${birdY.toFixed(2)}`, 20, y);
  y += lineHeight;
  
  ctx.fillText(`Bird Velocity: ${birdVelocity.toFixed(2)}`, 20, y);
  y += lineHeight;
  
  ctx.fillText(`Pitch Range: ${PITCH_MIN.toFixed(1)} - ${PITCH_MAX.toFixed(1)} Hz`, 20, y);
  y += lineHeight;
  
  ctx.fillText(`Audio Context: ${audioContext ? audioContext.state : 'None'}`, 20, y);
  y += lineHeight;
  
  ctx.fillText(`Microphone: ${micStream ? (micStream.active ? 'Active' : 'Inactive') : 'None'}`, 20, y);
  y += lineHeight;
  
  ctx.fillText(`Pitch Detector: ${pitchDetector ? 'Ready' : 'None'}`, 20, y);
  y += lineHeight;
  
  ctx.fillText(`Pitch Loop: ${pitchLoopActive ? 'Active' : 'Inactive'}`, 20, y);
  y += lineHeight;
  
  ctx.fillText(`Running: ${running}`, 20, y);
  y += lineHeight;
  
  ctx.fillText(`Game Over: ${gameOver}`, 20, y);
  y += lineHeight;
  
  ctx.fillText(`Paused: ${paused}`, 20, y);
  y += lineHeight;
  
  // Freeze delta time and FPS display when game is over or paused
  if (gameOver || paused) {
    ctx.fillText(`Delta Time: FROZEN`, 20, y);
    y += lineHeight;
    ctx.fillText(`FPS: FROZEN`, 20, y);
  } else {
    ctx.fillText(`Delta Time: ${deltaTime.toFixed(2)} ms`, 20, y);
    y += lineHeight;
    ctx.fillText(`FPS: ${deltaTime > 0 ? (1000 / deltaTime).toFixed(1) : 'N/A'}`, 20, y);
  }
  
  ctx.restore();
}

// --- Main Draw Function ---
function draw(currentTime = 0) {
  // Reset frame tracking on first frame or after reset
  if (lastFrameTime === 0 || !running) {
    lastFrameTime = currentTime;
    deltaTime = FIXED_DELTA; // Use fixed delta for first frame
  }
  
  // Calculate raw delta time
  let rawDeltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;
  
  // Use device-specific delta timing for better performance
  const targetDelta = FIXED_DELTA;
  
  // Cap delta time more aggressively to prevent timing spikes
  const maxDelta = targetDelta * 2; // Allow some variance but prevent huge spikes
  rawDeltaTime = Math.min(rawDeltaTime, maxDelta);
  
  // Smooth out delta time to prevent jitter - simplified for better performance
  if (deltaTime > 0) {
    // Light smoothing only to prevent major spikes
    deltaTime = deltaTime * 0.9 + rawDeltaTime * 0.1;
  } else {
    deltaTime = rawDeltaTime;
  }
  
  // Use a normalized delta multiplier for consistent movement across frame rates
  const deltaMultiplier = deltaTime / targetDelta;
  
  const yPadding = 20;
  
  // Use display dimensions for consistent behavior across devices
  const displayWidth = window.displayWidth || canvas.width;
  const displayHeight = window.displayHeight || canvas.height;

  // Use PITCH_MIN and PITCH_MAX for pitch mapping
  const minPitch = PITCH_MIN;
  const maxPitch = PITCH_MAX;

  // Bird physics: pitch detection or gravity
  if (pitch !== null) {
    // Clamp pitch to range
    let clampedPitch = clamp(pitch, minPitch, maxPitch);

    // Map pitch to vertical position
    let availableHeight = displayHeight - yPadding * 2;
    let targetY =
      displayHeight -
      yPadding -
      ((clampedPitch - minPitch) / (maxPitch - minPitch)) * availableHeight;

    birdY = smoothing * birdY + (1 - smoothing) * targetY;
    birdVelocity = 0; // Reset velocity when pitch is detected
  } else {
    // No pitch detected: apply gravity for smooth fall (frame-rate independent)
    birdVelocity += GRAVITY * deltaMultiplier;
    birdY += birdVelocity * deltaMultiplier;
  }

  if (animationFrameId) animationFrameId = null;
  
  // Only clear and redraw if something has actually changed
  ctx.clearRect(0, 0, displayWidth, displayHeight);
  
  // Draw sidescrolling tiled background
  drawScrollingBackground();

  // Only return early if we're truly not in a game state and not detecting pitch
  // Allow bird physics to run when pitch detection is active, even if not fully "running"
  if (!running && !gameOver && !pitchLoopActive) return;

  // If we're not running but pitch detection is active, only show the bird if we're still in game transition
  // Don't show pipes, scoring, or other game elements when returning to menu
  const showGameElements = running || gameOver;

  // Prevent bird from falling below the bottom of the screen
  const gameScale = window.gameScale || 1;
  const scaledBirdHeight = BIRD_HEIGHT * gameScale;
  if (birdY > displayHeight - scaledBirdHeight) {
    birdY = displayHeight - scaledBirdHeight;
    birdVelocity = 0;
  }

  // --- Rest Break Logic --- (only when game is running)
  if (showGameElements && inRestBreak) {
    if (!paused) restBreakTimer += deltaTime; // Time-based rest break timer
    drawRestAnimation();
    if (restBreakTimer >= REST_BREAK_DURATION * 1000) { // Convert to milliseconds
      inRestBreak = false;
      restBreakTimer = 0;
      pipesPassedSinceBreak = 0;
      pendingRest = false;
      skipNextPipe = true; // Skip the next pipe spawn after break
    }
  } else {
    if (showGameElements && !paused && !gameOver) {
      pipeTimer += deltaTime;
      // Only add a pipe if we are not about to enter a break
      if (!pendingRest && pipesPassedSinceBreak < pipesPerBreak) {
        if (pipeTimer >= getPipeIntervalMs()) {
          pipeTimer = 0;
          if (skipNextPipe) {
            // Skip this spawn to create the gap, then reset the flag
            skipNextPipe = false;
          } else {
            const gapY = Math.floor(
              yPadding + Math.random() * (displayHeight - 2 * yPadding - getPipeGap())
            );
            pipes.push({
              x: displayWidth,
              gapY: gapY,
              passed: false,
            });
          }
        }
      }
      // Move pipes (frame-rate independent with scaling compensation)
      const gameScale = window.gameScale || 1;
      // iPad gets faster pipe speed for increased difficulty
      const ipadSpeedMultiplier = window.isIPad ? 1.4 : 1.0;
      const scaledPipeSpeed = pipeSpeed * gameScale * ipadSpeedMultiplier; // Scale pipe speed with sprite size and iPad multiplier
      
      for (let pipe of pipes) {
        pipe.x -= scaledPipeSpeed * deltaMultiplier;
      }
      
      pipes = pipes.filter((pipe) => {
        const gameScale = window.gameScale || 1;
        const scaledPipeWidth = PIPE_WIDTH * gameScale;
        return pipe.x + scaledPipeWidth > -100;
      }); // Remove pipes 100px after they leave the screen

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
  
  // Update background scrolling continuously when game is running and not paused
  if (showGameElements && running && !paused && !gameOver) {
    const gameScale = window.gameScale || 1;
    // iPad gets faster background scrolling to match faster pipes
    const ipadSpeedMultiplier = window.isIPad ? 1.4 : 1.0;
    const scaledPipeSpeed = pipeSpeed * gameScale * ipadSpeedMultiplier; // Use same scaled speed as pipes
    backgroundOffsetX += scaledPipeSpeed * 0.5 * deltaMultiplier;
  }

  // Draw pipes with proper scaling (only when game is running)
  if (showGameElements) {
    for (let pipe of pipes) {
    const gameScale = window.gameScale || 1;
    const scaledPipeWidth = PIPE_WIDTH * gameScale;
    const scaledPipeCapHeight = PIPE_CAP_HEIGHT * gameScale;
    
    // Top pipe (rotated 180°)
    ctx.save();
    ctx.translate(pipe.x + scaledPipeWidth / 2, pipe.gapY);
    ctx.rotate(Math.PI);
    ctx.drawImage(
      pipeImg,
      2, 0, 56, PIPE_CAP_HEIGHT,
      -scaledPipeWidth / 2, 0, scaledPipeWidth, scaledPipeCapHeight
    );
    // Draw body (aligned with cap)
    if (pipe.gapY - scaledPipeCapHeight > 0) {
      ctx.drawImage(
        pipeImg,
        0, PIPE_CAP_HEIGHT, PIPE_WIDTH, pipeImg.height - PIPE_CAP_HEIGHT,
        -scaledPipeWidth / 2, scaledPipeCapHeight, scaledPipeWidth, pipe.gapY - scaledPipeCapHeight
      );
    }
    ctx.restore();

    // Bottom pipe
    const bottomPipeHeight = displayHeight - (pipe.gapY + getPipeGap());
    const bottomPipeY = pipe.gapY + getPipeGap();
    if (bottomPipeHeight > 0) {
      // Draw cap (stretch 56px to 60px, centered)
      ctx.drawImage(
        pipeImg,
        2, 0, 56, PIPE_CAP_HEIGHT,
        pipe.x, bottomPipeY, scaledPipeWidth, scaledPipeCapHeight
      );
      // Draw body (aligned with cap)
      if (bottomPipeHeight - scaledPipeCapHeight > 0) {
        ctx.drawImage(
          pipeImg,
          0, PIPE_CAP_HEIGHT, PIPE_WIDTH, pipeImg.height - PIPE_CAP_HEIGHT,
          pipe.x, bottomPipeY + scaledPipeCapHeight, scaledPipeWidth, bottomPipeHeight - scaledPipeCapHeight
        );
      }
      }
    }
  }

  // Draw bird with proper scaling and aspect ratio (only when game is running)
  if (showGameElements) {
    const gameScale = window.gameScale || 1;
    const drawHeight = BIRD_HEIGHT * gameScale;
    const aspect = birdImg.naturalWidth && birdImg.naturalHeight
      ? birdImg.naturalWidth / birdImg.naturalHeight
      : BIRD_WIDTH / BIRD_HEIGHT; // fallback if not loaded
    const drawWidth = drawHeight * aspect;
    const birdX = 100 * gameScale;
    ctx.drawImage(birdImg, birdX, birdY, drawWidth, drawHeight);
  }

  // Score logic - only count pipes when not in rest break and game is running
  if (showGameElements && !gameOver && !inRestBreak) {
    for (let pipe of pipes) {
      const gameScale = window.gameScale || 1;
      const scaledPipeWidth = PIPE_WIDTH * gameScale;
      const scaledBirdWidth = BIRD_WIDTH * gameScale;
      const scaledBirdX = 100 * gameScale;
      
      if (!pipe.passed && pipe.x + scaledPipeWidth / 2 < scaledBirdX + scaledBirdWidth / 2) {
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
  if (showGameElements && !gameOver) {
    // Position score at top with proper spacing based on scaled digit height
    const scoreY = 20; // Top margin
    drawScore(displayWidth / 2, scoreY, score);
  }

  // Collision detection
  if (showGameElements && !gameOver) {
    for (let pipe of pipes) {
      const gameScale = window.gameScale || 1;
      const scaledPipeWidth = PIPE_WIDTH * gameScale;
      const scaledPipeCapHeight = PIPE_CAP_HEIGHT * gameScale;
      const scaledBirdWidth = BIRD_WIDTH * gameScale;
      const scaledBirdHeight = BIRD_HEIGHT * gameScale;
      const scaledBirdX = 100 * gameScale;
      
      const birdRect = { x: scaledBirdX, y: birdY, w: scaledBirdWidth, h: scaledBirdHeight };
      // Top pipe body (exclude cap)
      const topRect = { 
        x: pipe.x, 
        y: 0, 
        w: scaledPipeWidth, 
        h: Math.max(0, pipe.gapY - scaledPipeCapHeight) 
      };
      // Top pipe cap
      const topCapRect = { 
        x: pipe.x, 
        y: Math.max(0, pipe.gapY - scaledPipeCapHeight), 
        w: scaledPipeWidth, 
        h: scaledPipeCapHeight 
      };
      // Bottom pipe cap
      const bottomPipeY = pipe.gapY + getPipeGap();
      const bottomCapRect = { 
        x: pipe.x, 
        y: bottomPipeY, 
        w: scaledPipeWidth, 
        h: scaledPipeCapHeight 
      };
      // Bottom pipe body (exclude cap)
      const bottomRect = { 
        x: pipe.x, 
        y: bottomPipeY + scaledPipeCapHeight, 
        w: scaledPipeWidth, 
        h: Math.max(0, displayHeight - (bottomPipeY + scaledPipeCapHeight)) 
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
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    const goNaturalWidth = gameoverImg.naturalWidth || 300;
    const goNaturalHeight = gameoverImg.naturalHeight || 80;
    const goDrawWidth = Math.min(600, displayWidth * 0.9); // Much larger for testing
    const goDrawHeight = goDrawWidth * (goNaturalHeight / goNaturalWidth);
    ctx.drawImage(
      gameoverImg,
      displayWidth / 2 - goDrawWidth / 2,
      displayHeight / 2 - goDrawHeight / 2,
      goDrawWidth,
      goDrawHeight
    );
    
    // Position score below game over image with proper spacing
    const scoreY = displayHeight / 2 + goDrawHeight / 2 + 30; // Add more spacing
    drawScore(displayWidth / 2, scoreY, score);
    running = false;
    pitchLoopActive = false;
    // Don't return early - let the animation loop continue for game over screen
    // Buttons will be drawn at the end of the draw function
  }

  // Pause overlay
  if (paused) {
    ctx.fillStyle = "rgba(80, 80, 80, 0.5)";
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    const gameScale = window.gameScale || 1;
    const iconWidth = 40 * Math.max(1, gameScale * 0.8);
    const iconHeight = 60 * Math.max(1, gameScale * 0.8);
    const barWidth = 12 * Math.max(1, gameScale * 0.8);
    const gap = 12 * Math.max(1, gameScale * 0.8);
    const x = displayWidth / 2 - iconWidth / 2;
    const y = displayHeight / 2 - iconHeight / 2;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, barWidth, iconHeight);
    ctx.fillRect(x + barWidth + gap, y, barWidth, iconHeight);
  }

  // Continue animation loop even during game over (but not when paused)
  if (!paused) {
    // Prevent multiple animation frames from stacking
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    // Simplified animation loop - use requestAnimationFrame for all devices
    // The iPad dual system was causing timing conflicts and performance issues
    animationFrameId = requestAnimationFrame(draw);
  }

  // Always draw buttons last so they appear on top (only during game)
  if (showGameElements) {
    drawGameButtons();
  }
  
  // Draw DPI debug info
  drawDPIIndicator();
  
  // Draw debug panel
  drawDebugPanel();
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
async function fullRefresh() {
  // Cancel animation frame
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  // Clean up any emergency timeouts
  if (window.ipadEmergencyTimeout) {
    clearTimeout(window.ipadEmergencyTimeout);
    window.ipadEmergencyTimeout = null;
  }

  // Stop pitch detection loop
  pitchLoopActive = false;

  // Use the comprehensive cleanup function
  await cleanupAudioResources();

  // Reset all game state variables more efficiently
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
  backgroundOffsetX = 0; // Reset background scroll position
  lastFrameTime = 0; // Reset timing
  deltaTime = 0; // Reset delta time

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Show main menu or splash
  showMainMenu();
}

// Force canvas refresh - call this from browser console if needed
function forceCanvasRefresh() {
  resizeCanvas();
  if (!running) {
    draw();
  }
}

// Make it globally available
window.forceCanvasRefresh = forceCanvasRefresh;

// Debug mode functions - accessible from browser console
window.enableDebug = function() {
  window.debugMode = true;
  console.log('Debug mode enabled - debug panel will be visible');
};

window.disableDebug = function() {
  window.debugMode = false;
  console.log('Debug mode disabled');
};

window.checkPitchStatus = function() {
  console.log('=== PITCH STATUS CHECK ===');
  console.log('audioContext:', audioContext ? `${audioContext.state} (sampleRate: ${audioContext.sampleRate})` : 'null');
  console.log('micStream:', micStream ? `active: ${micStream.active}, tracks: ${micStream.getTracks().length}` : 'null');
  console.log('mic (MediaStreamSource):', mic ? 'created' : 'null');
  console.log('pitchDetector:', pitchDetector ? 'initialized' : 'null');
  console.log('pitchLoopActive:', pitchLoopActive);
  console.log('current pitch:', pitch);
  console.log('pitch range:', `${PITCH_MIN.toFixed(2)} - ${PITCH_MAX.toFixed(2)} Hz`);
  console.log('bird Y:', birdY);
  console.log('bird velocity:', birdVelocity);
  console.log('running:', running);
  console.log('paused:', paused);
  console.log('gameOver:', gameOver);
  console.log('========================');
};

// Add a function to manually restart pitch detection
window.restartPitchDetection = function() {
  if (pitchDetector && !pitchLoopActive) {
    pitchLoopActive = true;
    getPitch();
  } else if (!pitchDetector) {
    console.log('No pitch detector available - ensure microphone is set up first');
  } else {
    console.log('Pitch loop is already active');
  }
};

// Warm up pitch detection - call this on first user interaction to prepare everything
async function warmupPitchDetection() {
  // Prepare audio context early if possible
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      // Immediately suspend it to save resources until game starts
      if (audioContext.state === 'running') {
        await audioContext.suspend();
      }
      console.log('Audio context prepared early');
    } catch (err) {
      console.log('Could not create audio context early:', err);
    }
  }
}

// Called when pitch detection model is loaded
function modelLoaded() {
  // Ensure pitch loop is active before starting
  pitchLoopActive = true;
  
  getPitch();
  
  // Immediately start the animation loop when the model is ready
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(draw);
  }
}
