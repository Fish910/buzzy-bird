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
  // Always update leaderboard when menu opens
  if (typeof renderLeaderboard === 'function') {
    renderLeaderboard();
  }
  
  // Sync user data between games (smart merge, don't force DB priority)
  if (typeof syncLoggedInUserFromDb === 'function') {
    syncLoggedInUserFromDb(false).catch(err => console.log('Menu sync failed:', err));
  }
  
  mainMenu.style.display = "flex";
  running = false;
  paused = false;
  gameOver = false;
  
  // Reset background scrolling when showing main menu
  if (typeof backgroundOffsetX !== 'undefined') {
    backgroundOffsetX = 0;
  }
  
  // Warm up pitch detection on first menu display
  if (typeof warmupPitchDetection === 'function') {
    warmupPitchDetection().catch(err => console.log('Warmup failed:', err));
  }
  
  // Update main menu background to match equipped backdrop
  if (typeof updateMainMenuBackground === 'function') {
    updateMainMenuBackground();
    // Add a delayed call to ensure it works on Firebase hosting
    setTimeout(() => {
      updateMainMenuBackground();
    }, 100);
  }
  
  tryDrawInitial();
}

// Hide the main menu
function hideMainMenu() {
  mainMenu.style.display = "none";
  
  // Clear the main menu backdrop when starting the game
  if (typeof clearMainMenuBackground === 'function') {
    clearMainMenuBackground();
  }
}

// Update points and high score display in menu
function updateMenuInfo() {
  pointsDisplay.textContent = "Points: " + save.points;
  highScoreDisplay.textContent = "High Score: " + save.highScore;
}

// Start game from menu (on tap/click)
async function startGameFromMenu(e) {
  if (e.target.closest("button")) return; // Ignore if clicking a button
  
  // Check if iOS device is in landscape mode
  if (typeof isIOSDevice === 'function' && isIOSDevice() && window.innerWidth > window.innerHeight) {
    // Show the iOS orientation warning instead of starting game
    if (typeof showIOSLandscapeWarning === 'function') {
      showIOSLandscapeWarning();
    }
    return;
  }
  
  hideMainMenu();
  resetGame(); // This already handles animation frame cleanup
  running = true;
  paused = false;
  gameOver = false;
  pitchLoopActive = true;
  
  // Refresh canvas dimensions for mobile devices
  if (typeof refreshCanvasDimensions === 'function') {
    refreshCanvasDimensions();
  }
  
  // Let ensureMicAndStart handle the animation loop via modelLoaded
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
  // Set slider range: C1 (MIDI 24) to C7 (MIDI 96)
  noteSlider.min = 24;
  noteSlider.max = 96;
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
  if (pipesPerBreakBox) {
    pipesPerBreakBox.textContent = pipesPerBreak;
    pipesPerBreakBox.style.background = getPipesPerBreakGradient(pipesPerBreak);
    pipesPerBreakBox.style.border = `2px solid ${getBoxBorderColor(pipesPerBreak, 3, 10)}`;
  }
  if (pipesSlider) {
    pipesSlider.value = pipesPerBreak;
  }
  if (pipesSliderDisplay) {
    pipesSliderDisplay.textContent = pipesPerBreak;
  }

  if (pipeSpeedBox) {
    pipeSpeedBox.textContent = pipeSpeedSliderValue;
    pipeSpeedBox.style.background = getPipeSpeedGradient(pipeSpeedSliderValue);
    pipeSpeedBox.style.border = `2px solid ${getBoxBorderColor(pipeSpeedSliderValue, 1, 100)}`;
  }
  if (pipeSpeedSlider) {
    pipeSpeedSlider.value = pipeSpeedSliderValue;
  }
  if (pipeSpeedSliderDisplay) {
    pipeSpeedSliderDisplay.textContent = pipeSpeedSliderValue;
  }

  // Save to localStorage
  localStorage.setItem("buzzyBirdPipesPerBreak", pipesPerBreak);
  localStorage.setItem("buzzyBirdPipeSpeed", pipeSpeedSliderValue);

  updateDifficultyBtn();
}

// Handle changes to advanced settings (sliders)
function onAdvancedSettingChanged() {
  // Update pipesPerBreak and pipeSpeedSliderValue from sliders
  pipesPerBreak = parseInt(pipesSlider.value);
  if (pipesPerBreakBox) {
    pipesPerBreakBox.textContent = pipesPerBreak;
    pipesPerBreakBox.style.background = getPipesPerBreakGradient(pipesPerBreak);
    pipesPerBreakBox.style.border = `2px solid ${getBoxBorderColor(pipesPerBreak, 3, 10)}`;
  }

  pipeSpeedSliderValue = parseInt(pipeSpeedSlider.value);
  pipeSpeed = getPipeSpeedFromSlider(pipeSpeedSliderValue);
  if (pipeSpeedBox) {
    pipeSpeedBox.textContent = pipeSpeedSliderValue;
    pipeSpeedBox.style.background = getPipeSpeedGradient(pipeSpeedSliderValue);
    pipeSpeedBox.style.border = `2px solid ${getBoxBorderColor(pipeSpeedSliderValue, 1, 100)}`;
  }

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
  signedInText.textContent = `Signed in as: ${name}`;
  signedInContainer.classList.remove('hidden');
  
  const leaderboard = document.getElementById('leaderboardContainer');
  if (leaderboard && !leaderboard.contains(logoutBtn)) {
    leaderboard.appendChild(logoutBtn);
  }
  if (leaderboard && !leaderboard.contains(deleteAccountBtn)) {
    leaderboard.appendChild(deleteAccountBtn);
  }
  logoutBtn.style.display = '';
  deleteAccountBtn.style.display = '';
  
  // Add class to leaderboard to apply responsive bottom margin
  if (leaderboard) {
    leaderboard.classList.add('logged-in');
  }
}

// Hide username and logout button
function hideUsername() {
  signedInContainer.classList.add('hidden');
  if (logoutBtn.parentNode) logoutBtn.parentNode.removeChild(logoutBtn);
  if (deleteAccountBtn.parentNode) deleteAccountBtn.parentNode.removeChild(deleteAccountBtn);
  
  // Remove class from leaderboard to reset margin
  const leaderboard = document.getElementById('leaderboardContainer');
  if (leaderboard) {
    leaderboard.classList.remove('logged-in');
  }
}

// Update authentication UI based on login status
function updateAuthUI() {
  const user = JSON.parse(localStorage.getItem('buzzyBirdUser') || 'null');
  if (user && user.name && user.userId) { // Check for both name and userId
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
    
    // If current user is logged in, ensure their local high score is reflected
    if (currentUser && currentUser.userId && save && save.highScore) {
      const userIndex = users.findIndex(user => user.userId === currentUser.userId);
      if (userIndex !== -1 && save.highScore > (users[userIndex].highScore || 0)) {
        users[userIndex].highScore = save.highScore;
        // Re-sort after updating the high score
        users.sort((a, b) => (b.highScore || 0) - (a.highScore || 0));
      }
    }
    
    users.forEach((user, idx) => {
      const entry = document.createElement('div');
      entry.className = 'entry';
      if (idx === 0) entry.classList.add('gold');
      else if (idx === 1) entry.classList.add('silver');
      else if (idx === 2) entry.classList.add('bronze');
      // Compare by userId instead of name
      if (currentUser && user.userId === currentUser.userId) entry.classList.add('me');
      entry.innerHTML = `<span style="min-width:2em;display:inline-block;">${idx+1}.</span> <span style="font-weight:bold;">${user.name}</span> <span style="flex:1 1 auto;"></span> <span style="font-family:monospace;">${user.highScore || 0}</span>`;
      leaderboardList.appendChild(entry);
    });
    if (users.length === 0) {
      leaderboardList.innerHTML = '<div style="color:#aaa;text-align:center;">No scores yet.</div>';
    }
  } catch (e) {
    console.error('Leaderboard fetch failed:', e);
    leaderboardList.innerHTML = '<div style="color:#f66;text-align:center;">Failed to load leaderboard.</div>';
  }
}


