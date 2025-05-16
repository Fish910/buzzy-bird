let pitch = null;
let birdY = 300;
let smoothing = 0.8;

let audioContext, mic, pitchDetector, micStream;
let running = false;
let paused = false;
let gameOver = false;
let score = 0; // Add this at the top with your other variables

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");

// Load images
const bgImg = new Image();
bgImg.src = "assets/background.png";
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
const PIPE_CAP_HEIGHT = 32; // Height of the pipe cap in pixels (adjust if needed)

// Bird settings
const BIRD_WIDTH = 40;
const BIRD_HEIGHT = 32;

// Request microphone access as soon as the page loads
window.addEventListener("DOMContentLoaded", async () => {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("Microphone access granted.");
  } catch (err) {
    alert("Microphone access is required to play the game.");
    startBtn.disabled = true;
  }
});

startBtn.onclick = async () => {
  if (!running) {
    // START GAME
    startBtn.textContent = "Quit Game";
    pauseBtn.textContent = "Pause";
    pauseBtn.disabled = false;
    running = true;
    paused = false;
    gameOver = false;
    resetGame();
    draw();
    await setupAudio();
  } else {
    // QUIT GAME
    stopGame();
  }
};

pauseBtn.onclick = () => {
  if (!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  if (!paused) {
    draw(); // Restart the animation loop when unpausing
  }
};

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (running) pauseBtn.onclick();
  }
});

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
  console.log("Pitch model loaded.");
  getPitch();
}

function getPitch() {
  if (!running) return;
  pitchDetector.getPitch((err, frequency) => {
    if (err) {
      console.error("Pitch detection error:", err);
    }
    if (frequency) {
      pitch = frequency;
    }
    getPitch();
  });
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function resetGame() {
  birdY = 300;
  pitch = null;
  pipes = [];
  pipeTimer = 0;
  gameOver = false;
  score = 0; // Reset score
}

function drawScore(x, y, score) {
  const scoreStr = score.toString();
  const digitWidth = 32;   // Adjust to your digit image width
  const digitHeight = 48;  // Adjust to your digit image height
  const totalWidth = scoreStr.length * digitWidth;
  let drawX = x - totalWidth / 2;
  for (let char of scoreStr) {
    const digit = parseInt(char);
    ctx.drawImage(digitImgs[digit], drawX, y, digitWidth, digitHeight);
    drawX += digitWidth;
  }
}

function draw() {
  if (!running) return;

  // Draw background
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

  let minPitch = 500;
  let maxPitch = 1000;
  let yPadding = 30; // pixels from top and bottom
  let targetY;

  if (pitch) {
    let clampedPitch = clamp(pitch, minPitch, maxPitch);
    let availableHeight = canvas.height - 2 * yPadding;
    targetY =
      canvas.height -
      yPadding -
      ((clampedPitch - minPitch) / (maxPitch - minPitch)) * availableHeight;
  } else {
    targetY = birdY;
  }

  birdY = birdY * smoothing + targetY * (1 - smoothing);

  // Pipes logic
  if (!paused && !gameOver) {
    pipeTimer++;
    if (pipeTimer >= PIPE_INTERVAL) {
      pipeTimer = 0;
      // Random gap position
      const gapY = Math.floor(
        yPadding + Math.random() * (canvas.height - 2 * yPadding - PIPE_GAP)
      );
      pipes.push({
        x: canvas.width,
        gapY: gapY,
        passed: false, // Track if the bird has passed this pipe
      });
    }
    // Move pipes
    for (let pipe of pipes) {
      pipe.x -= PIPE_SPEED;
    }
    // Remove off-screen pipes
    pipes = pipes.filter((pipe) => pipe.x + PIPE_WIDTH > 0);
  }

  // Draw pipes with cap and body (no cropping)
  for (let pipe of pipes) {
    // --- TOP PIPE (rotated 180°) ---
    ctx.save();
    ctx.translate(pipe.x + PIPE_WIDTH / 2, pipe.gapY); // Move to bottom center of top pipe
    ctx.rotate(Math.PI);

    // Draw cap
    ctx.drawImage(
      pipeImg,
      0, 0, PIPE_WIDTH, PIPE_CAP_HEIGHT, // src
      -PIPE_WIDTH / 2, 0, PIPE_WIDTH, PIPE_CAP_HEIGHT // dest
    );
    // Draw body
    if (pipe.gapY - PIPE_CAP_HEIGHT > 0) {
      ctx.drawImage(
        pipeImg,
        0, PIPE_CAP_HEIGHT, PIPE_WIDTH, pipeImg.height - PIPE_CAP_HEIGHT, // src
        -PIPE_WIDTH / 2, PIPE_CAP_HEIGHT, PIPE_WIDTH, pipe.gapY - PIPE_CAP_HEIGHT // dest
      );
    }
    ctx.restore();

    // --- BOTTOM PIPE ---
    const bottomPipeHeight = canvas.height - (pipe.gapY + PIPE_GAP);
    const bottomPipeY = pipe.gapY + PIPE_GAP;

    // Draw cap
    ctx.drawImage(
      pipeImg,
      0, 0, PIPE_WIDTH, PIPE_CAP_HEIGHT, // src
      pipe.x, bottomPipeY, PIPE_WIDTH, PIPE_CAP_HEIGHT // dest
    );
    // Draw body
    if (bottomPipeHeight - PIPE_CAP_HEIGHT > 0) {
      ctx.drawImage(
        pipeImg,
        0, PIPE_CAP_HEIGHT, PIPE_WIDTH, pipeImg.height - PIPE_CAP_HEIGHT, // src
        pipe.x, bottomPipeY + PIPE_CAP_HEIGHT, PIPE_WIDTH, bottomPipeHeight - PIPE_CAP_HEIGHT // dest
      );
    }
  }

  // Draw bird
  ctx.drawImage(birdImg, 100, birdY, BIRD_WIDTH, BIRD_HEIGHT);

  // Score logic: increment when bird passes a pipe
  for (let pipe of pipes) {
    if (!pipe.passed && pipe.x + PIPE_WIDTH < 100) {
      pipe.passed = true;
      score++;
    }
  }

  // Draw score using digit images at the top
  if (!gameOver) {
    drawScore(canvas.width / 2, 20, score);
  }

  // Collision detection
  if (!gameOver) {
    for (let pipe of pipes) {
      // Bird rectangle
      const birdRect = {
        x: 100,
        y: birdY,
        w: BIRD_WIDTH,
        h: BIRD_HEIGHT,
      };
      // Top pipe rectangle
      const topRect = {
        x: pipe.x,
        y: 0,
        w: PIPE_WIDTH,
        h: pipe.gapY,
      };
      // Bottom pipe rectangle
      const bottomRect = {
        x: pipe.x,
        y: pipe.gapY + PIPE_GAP,
        w: PIPE_WIDTH,
        h: canvas.height - (pipe.gapY + PIPE_GAP),
      };
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
    ctx.drawImage(
      gameoverImg,
      canvas.width / 2 - 150,
      canvas.height / 2 - 60,
      300,
      120
    );
    // Draw score using digit images on game over screen
    drawScore(canvas.width / 2, canvas.height / 2 + 70, score);
    running = false;
    pauseBtn.disabled = true;
    startBtn.textContent = "Start Game";
    return;
  }

  // Draw overlay and pause icon if paused
  if (paused) {
    ctx.fillStyle = "rgba(80, 80, 80, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw pause icon (two vertical bars)
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

  // Only continue animation if not paused or game over
  if (!paused && !gameOver) {
    requestAnimationFrame(draw);
  }
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function stopGame() {
  running = false;
  paused = false;
  pitch = null;
  birdY = 300;
  pipes = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

