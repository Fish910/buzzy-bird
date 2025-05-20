let pitch = null;
let birdY = 300;
let smoothing = 0.8;

let audioContext, mic, pitchDetector, micStream;
let running = false;
let paused = false;
let gameOver = false;
let score = 0;
let showSplash = true; // Show splash screen on load

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
const PIPE_GAP = 160;
const PIPE_SPEED = 2;
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

  // Splash screen
  if (showSplash) {
    // Draw splash image centered
    const splashW = Math.min(canvas.width * 0.8, splashImg.naturalWidth || 400);
    const splashH = splashW * ((splashImg.naturalHeight || 200) / (splashImg.naturalWidth || 400));
    ctx.save();
    ctx.globalAlpha = 0.97;
    ctx.drawImage(
      splashImg,
      canvas.width / 2 - splashW / 2,
      canvas.height / 2 - splashH / 2,
      splashW,
      splashH
    );
    ctx.restore();

    // Always draw buttons last so they appear on top
    drawGameButtons();
    return;
  }

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
        yPadding + Math.random() * (canvas.height - 2 * yPadding - PIPE_GAP)
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
    // Draw cap (stretch 56px to 60px to match body)
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
    const bottomPipeHeight = canvas.height - (pipe.gapY + PIPE_GAP);
    const bottomPipeY = pipe.gapY + PIPE_GAP;
    if (bottomPipeHeight > 0) {
      // Draw cap (stretch 56px to 60px to match body)
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
      const bottomRect = { x: pipe.x, y: pipe.gapY + PIPE_GAP, w: PIPE_WIDTH, h: canvas.height - (pipe.gapY + PIPE_GAP) };
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
  showSplash = true;
  draw();
}

// Pitch detection
async function setupAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
    if (!running || showSplash) {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      stopAudio(); // <--- Add this line

      // START GAME logic
      running = true;
      paused = false;
      gameOver = false;
      showSplash = false;
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
    if (running || showSplash) stopGame();
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