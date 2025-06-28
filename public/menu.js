// =============================================================================
// MENU.JS - Menu System, Popups, UI & Settings Management
// =============================================================================

// --- Loading Overlay Management ---

// Show loading overlay with message
function showLoading(msg = "Loading...") {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.classList.add("active");
    overlay.textContent = msg;
  }
}

// Hide loading overlay
function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.remove("active");
}

// --- Main Menu Management ---

// Show the main menu
function showMainMenu() {
  hideLoading();
  updateMenuInfo();
  mainMenu.style.display = "flex";
  running = false;
  paused = false;
  gameOver = false;
  tryDrawInitial();
}

// Hide the main menu
function hideMainMenu() {
  mainMenu.style.display = "none";
}

// Update points and high score display in menu
function updateMenuInfo() {
  pointsDisplay.textContent = "Points: " + save.points;
  highScoreDisplay.textContent = "High Score: " + save.highScore;
}

// Start game from menu (on tap/click)
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

// Show menu after game over
function onGameOverMenu() {
  showMainMenu();
}

// --- Settings Popup & Pitch Range Management ---

// Open note slider for pitch range selection
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

// --- Difficulty System ---

// Difficulty presets
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

let difficultyIndex = 1; // Start at "Normal"
let isCustom = false;

// Find difficulty index for current settings
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

// Update difficulty button appearance
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

// Set difficulty and update all related settings
function setDifficulty(idx) {
  const d = difficulties[idx];
  difficultyIndex = idx;
  isCustom = false;
  
  // Update game values
  pipesPerBreak = d.pipesPerBreak;
  pipeSpeedSliderValue = d.pipeSpeedSlider;
  pipeSpeed = getPipeSpeedFromSlider(pipeSpeedSliderValue);

  // Update UI elements
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

// Handle changes to advanced settings (sliders)
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

// --- UI Styling Helpers ---

// Helper for green-to-red gradient (pipes per break)
function getPipesPerBreakGradient(val) {
  // 3 = green (hue 120), 10 = red (hue 0)
  const percent = (val - 3) / (10 - 3);
  const hue = 120 - percent * 120; // 120 (green) to 0 (red)
  return `linear-gradient(90deg, hsl(${hue}, 80%, 90%) 0%, hsl(${hue}, 80%, 90%) 100%)`;
}

// Helper for pipe speed gradient (green=slow, red=fast)
function getPipeSpeedGradient(val) {
  // 1 = green (hue 120), 100 = red (hue 0)
  const percent = (val - 1) / (100 - 1);
  const hue = 120 - percent * 120;
  return `linear-gradient(90deg, hsl(${hue}, 80%, 90%) 0%, hsl(${hue}, 80%, 90%) 100%)`;
}

// Helper for border colors (darker, more saturated than background)
function getBoxBorderColor(val, min, max) {
  const percent = (val - min) / (max - min);
  const hue = 120 - percent * 120;
  return `hsl(${hue}, 90%, 45%)`;
}

// --- Authentication UI Management ---

// Show username and logout button
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

// Hide username and logout button
function hideUsername() {
  if (usernameDisplay.parentNode) usernameDisplay.parentNode.removeChild(usernameDisplay);
  if (logoutBtn.parentNode) logoutBtn.parentNode.removeChild(logoutBtn);
}

// Update authentication UI based on login status
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

// --- Leaderboard Management ---

// Render the leaderboard from Firebase data
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
