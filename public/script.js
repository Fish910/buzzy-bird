// =============================================================================
// SCRIPT.JS - Main Initialization, Global State & Event Handlers
// =============================================================================

// --- Global Canvas & Context ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
// Enable image smoothing for better sprite rendering
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

// --- Global Save Object ---
let save;

// --- High Score Sync Tracking ---
let highScoreSyncInProgress = false;
window.highScoreSyncInProgress = false;

// Handle exit to menu with high score sync waiting
async function handleExitToMenu() {
  
  // Wait for any pending high score sync to complete
  if (window.highScoreSyncInProgress) {
    // Poll for sync completion with timeout
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    while (window.highScoreSyncInProgress && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }
  
  // Stop the game properly if it's running
  if (typeof running !== 'undefined' && running) {
    await stopGame();
  } else {
    // Reset background scrolling when returning to menu (if not already done by stopGame)
    if (typeof backgroundOffsetX !== 'undefined') {
      backgroundOffsetX = 0;
    }
  }
  
  showMainMenu();
}

// --- DOM Element References ---
const mainMenu = document.getElementById("mainMenu");
const skinsPopup = document.getElementById("skinsPopup");
const cosmeticsGrid = document.getElementById("cosmeticsGrid");
const pointsDisplay = document.getElementById("pointsDisplay");
const highScoreDisplay = document.getElementById("highScoreDisplay");
const skinsBtn = document.getElementById("skinsBtn");
const closeSkinsBtn = document.getElementById("closeSkinsBtn");

// Settings popup elements
const settingsBtn = document.getElementById("settingsBtn");
const settingsPopup = document.getElementById("settingsPopup");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const bottomNoteBox = document.getElementById("bottomNoteBox");
const topNoteBox = document.getElementById("topNoteBox");

// Note slider elements
const noteSliderPopup = document.getElementById("noteSliderPopup");
const noteSlider = document.getElementById("noteSlider");
const sliderNoteDisplay = document.getElementById("sliderNoteDisplay");
const closeNoteSliderBtn = document.getElementById("closeNoteSliderBtn");
const sliderLabel = document.getElementById("sliderLabel");
let sliderTarget = null; // "bottom" or "top"

// Other popup elements
const howToBtn = document.getElementById("howToBtn");
const creditsBtn = document.getElementById("creditsBtn");
const howToPopup = document.getElementById("howToPopup");
const creditsPopup = document.getElementById("creditsPopup");
const closeHowToBtn = document.getElementById("closeHowToBtn");
const closeCreditsBtn = document.getElementById("closeCreditsBtn");

// Difficulty button
const difficultyBtn = document.getElementById("difficultyBtn");

// Bug report button
const bugBtn = document.getElementById("bugBtn");

// Authentication elements
const signUpBtn = document.getElementById('signUpBtn');
const logInBtn = document.getElementById('logInBtn');
const changeNameBtn = document.getElementById('changeNameBtn');
const signUpModal = document.getElementById('signUpModal');
const logInModal = document.getElementById('logInModal');
const changeNameModal = document.getElementById('changeNameModal');
const loginWarningModal = document.getElementById('loginWarningModal');
const deleteAccountModal = document.getElementById('deleteAccountModal');
const signUpCancelBtn = document.getElementById('signUpCancelBtn');
const logInCancelBtn = document.getElementById('logInCancelBtn');
const changeNameCancelBtn = document.getElementById('changeNameCancelBtn');
const loginWarningProceedBtn = document.getElementById('loginWarningProceedBtn');
const loginWarningCancelBtn = document.getElementById('loginWarningCancelBtn');
const deleteAccountCancelBtn = document.getElementById('deleteAccountCancelBtn');
const signUpSubmitBtn = document.getElementById('signUpSubmitBtn');
const logInSubmitBtn = document.getElementById('logInSubmitBtn');
const changeNameSubmitBtn = document.getElementById('changeNameSubmitBtn');
const deleteAccountSubmitBtn = document.getElementById('deleteAccountSubmitBtn');
const signUpName = document.getElementById('signUpName');
const signUpPasscode = document.getElementById('signUpPasscode');
const signUpError = document.getElementById('signUpError');
const logInName = document.getElementById('logInName');
const logInPasscode = document.getElementById('logInPasscode');
const logInError = document.getElementById('logInError');
const changeNameNew = document.getElementById('changeNameNew');
const changeNamePasscode = document.getElementById('changeNamePasscode');
const changeNameError = document.getElementById('changeNameError');
const deleteAccountPasscode = document.getElementById('deleteAccountPasscode');
const deleteAccountError = document.getElementById('deleteAccountError');
const dontAskAgainCheckbox = document.getElementById('dontAskAgainCheckbox');

// Get the signed-in container and text elements
const signedInContainer = document.getElementById('signedInContainer');
const signedInText = document.getElementById('signedInText');

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

const deleteAccountBtn = document.createElement('button');
deleteAccountBtn.id = 'deleteAccountBtn';
deleteAccountBtn.textContent = 'Delete Account';
deleteAccountBtn.style.position = 'absolute';
deleteAccountBtn.style.right = '120px';
deleteAccountBtn.style.bottom = '14px';
deleteAccountBtn.style.zIndex = '2';
deleteAccountBtn.style.pointerEvents = 'auto';
deleteAccountBtn.style.background = '#dc3545';
deleteAccountBtn.style.color = '#fff';
deleteAccountBtn.style.border = 'none';
deleteAccountBtn.style.borderRadius = '8px';
deleteAccountBtn.style.padding = '8px 18px';
deleteAccountBtn.style.fontSize = '1em';
deleteAccountBtn.style.cursor = 'pointer';
deleteAccountBtn.style.transition = 'background 0.2s';
deleteAccountBtn.style.display = 'none';

// --- Settings Tab Management ---

let activeSettingsTab = "pitchRange";

// Switch settings tab
function switchSettingsTab(tabName) {
  activeSettingsTab = tabName;
  updateSettingsTabButtons();
  showSettingsTabContent();
}

// Update settings tab button appearances
function updateSettingsTabButtons() {
  const pitchRangeTab = document.getElementById("pitchRangeTab");
  const advancedTab = document.getElementById("advancedTab");
  
  // Remove active class from all tabs
  [pitchRangeTab, advancedTab].forEach(tab => {
    if (tab) tab.classList.remove("active");
  });
  
  // Add active class to current tab
  switch(activeSettingsTab) {
    case "pitchRange":
      if (pitchRangeTab) pitchRangeTab.classList.add("active");
      break;
    case "advanced":
      if (advancedTab) advancedTab.classList.add("active");
      break;
  }
}

// Show the content for the active settings tab
function showSettingsTabContent() {
  const pitchRangeContent = document.getElementById("pitchRangeContent");
  const advancedContent = document.getElementById("advancedContent");
  
  // Hide all content
  [pitchRangeContent, advancedContent].forEach(content => {
    if (content) content.classList.add("hidden");
  });
  
  // Show active content
  switch(activeSettingsTab) {
    case "pitchRange":
      if (pitchRangeContent) pitchRangeContent.classList.remove("hidden");
      break;
    case "advanced":
      if (advancedContent) advancedContent.classList.remove("hidden");
      break;
  }
}

// --- Initialization & Settings Loading ---

// Load pitch range from localStorage if available
if (localStorage.getItem("buzzyBirdPitchRange")) {
  try {
    const obj = JSON.parse(localStorage.getItem("buzzyBirdPitchRange"));
    if (typeof obj.bottom === "number" && typeof obj.top === "number") {
      bottomMidi = obj.bottom;
      topMidi = obj.top;
    }
  } catch {}
}

// Load pipes per break setting
const storedPipesPerBreak = localStorage.getItem("buzzyBirdPipesPerBreak");
if (storedPipesPerBreak !== null) {
  pipesPerBreak = parseInt(storedPipesPerBreak) || 5;
}

// Load pipe speed setting
const storedPipeSpeed = localStorage.getItem("buzzyBirdPipeSpeed");
if (storedPipeSpeed !== null) {
  pipeSpeed = getPipeSpeedFromSlider(parseInt(storedPipeSpeed));
  pipeSpeedSliderValue = parseInt(storedPipeSpeed);
} else {
  pipeSpeedSliderValue = 50; // Default
}

// Initialize display elements
if (bottomNoteBox) bottomNoteBox.textContent = midiToNoteName(bottomMidi);
if (topNoteBox) topNoteBox.textContent = midiToNoteName(topMidi);

// --- Event Listeners ---

// Store initial screen dimensions and orientation for change detection
let initialScreenWidth = window.screen.width;
let initialScreenHeight = window.screen.height;
let initialOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';

// Function to detect significant screen/orientation changes
function detectScreenChange() {
  const currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  const orientationChanged = currentOrientation !== initialOrientation;
  const resolutionChanged = window.screen.width !== initialScreenWidth || window.screen.height !== initialScreenHeight;
  
  if (orientationChanged || resolutionChanged) {
    // Reload page on significant screen/orientation changes
    setTimeout(() => {
      window.location.reload();
    }, 100);
    
    // Update the stored values for next time
    initialScreenWidth = window.screen.width;
    initialScreenHeight = window.screen.height;
    initialOrientation = currentOrientation;
  }
}

// Window resize events
window.addEventListener('resize', () => {
  detectScreenChange();
  resizeCanvas();
  // Also update main menu backdrop sizing when window is resized
  if (typeof updateMainMenuBackground === 'function') {
    updateMainMenuBackground();
  }
});

window.addEventListener('orientationchange', () => {
  detectScreenChange();
  // Small delay for orientation change to complete
  setTimeout(() => {
    resizeCanvas();
    // Also update main menu backdrop sizing on orientation change
    if (typeof updateMainMenuBackground === 'function') {
      updateMainMenuBackground();
    }
  }, 100);
});

// Add additional screen change detection for more comprehensive coverage
if (screen && screen.orientation) {
  screen.orientation.addEventListener('change', () => {
    detectScreenChange();
  });
}

// Also listen for fullscreen changes which can affect screen dimensions
document.addEventListener('fullscreenchange', () => {
  setTimeout(detectScreenChange, 100);
});

// Monitor for window focus events that might indicate a screen change
window.addEventListener('focus', () => {
  setTimeout(detectScreenChange, 200);
});

// Initialize global canvas scale variables
window.canvasScale = window.devicePixelRatio || 1;
window.displayWidth = window.innerWidth;
window.displayHeight = window.innerHeight;

resizeCanvas();

// Check iOS orientation on initial load
if (typeof checkIOSOrientation === 'function') {
  checkIOSOrientation();
}

// Main menu click/touch to start game
mainMenu.addEventListener("mousedown", startGameFromMenu);
mainMenu.addEventListener("touchstart", startGameFromMenu, { passive: false });

// Prevent leaderboard clicks from starting the game
const leaderboardContainer = document.getElementById("leaderboardContainer");
if (leaderboardContainer) {
  leaderboardContainer.addEventListener("mousedown", (e) => e.stopPropagation());
  leaderboardContainer.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: false });
}

// --- Canvas Event Handlers ---
canvas.addEventListener("click", function (e) {
  const rect = canvas.getBoundingClientRect();
  // Convert to display coordinates (CSS pixels)
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Always check for exit button, even if gameOver
  if (exitButtonClicked(mouseX, mouseY)) {
    handleExitToMenu();
    return;
  }

  // If game over, start a new game
  if (gameOver) {
    resetGame();
    running = true;
    paused = false;
    gameOver = false;
    pitchLoopActive = true;
    
    // Refresh canvas dimensions for mobile devices
    if (typeof refreshCanvasDimensions === 'function') {
      refreshCanvasDimensions();
    }
    
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
    // Reset timing to prevent delta time spike after pause
    lastFrameTime = 0;
    deltaTime = 0;
    // Restart pitch detection loop
    if (pitchLoopActive && pitchDetector) {
      getPitch();
    }
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(draw);
    }
    return;
  }
});

canvas.addEventListener("mousedown", function(e) {
  const rect = canvas.getBoundingClientRect();
  // Convert to display coordinates (CSS pixels)  
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Always check for exit button
  if (exitButtonClicked(x, y)) {
    handleExitToMenu();
    return;
  }
});

// --- Popup Event Handlers ---

// Skins popup
if (skinsBtn) {
  skinsBtn.addEventListener("click", (e) => {
    // Check if iOS device is in landscape mode
    if (shouldBlockIOSAction()) {
      handleBlockedIOSAction();
      return;
    }
    
    showSkinsPopup();
    e.stopPropagation();
  });
}
if (closeSkinsBtn) closeSkinsBtn.addEventListener("click", hideSkinsPopup);
if (skinsPopup) {
  skinsPopup.addEventListener("mousedown", (e) => {
    if (e.target === skinsPopup) hideSkinsPopup();
  });
}

// Cosmetics tab buttons
const birdsTab = document.getElementById("birdsTab");
const pipesTab = document.getElementById("pipesTab");
const backdropsTab = document.getElementById("backdropsTab");

if (birdsTab) {
  birdsTab.addEventListener("click", (e) => {
    switchTab("birds");
    e.stopPropagation();
  });
}

if (pipesTab) {
  pipesTab.addEventListener("click", (e) => {
    switchTab("pipes");
    e.stopPropagation();
  });
}

if (backdropsTab) {
  backdropsTab.addEventListener("click", (e) => {
    switchTab("backdrops");
    e.stopPropagation();
  });
}

// Settings popup
if (settingsBtn) {
  settingsBtn.addEventListener("click", (e) => {
    // Check if iOS device is in landscape mode
    if (shouldBlockIOSAction()) {
      handleBlockedIOSAction();
      return;
    }
    
    // Initialize settings tabs
    activeSettingsTab = "pitchRange"; // Default to pitch range tab
    updateSettingsTabButtons();
    showSettingsTabContent();
    
    settingsPopup.classList.remove("hidden");
    
    // Sync sliders to current settings
    if (pipesSlider) {
      pipesSlider.value = pipesPerBreak;
      pipesSliderDisplay.textContent = pipesPerBreak;
    }
    if (pipeSpeedSlider) {
      pipeSpeedSlider.value = pipeSpeedSliderValue;
      pipeSpeedSliderDisplay.textContent = pipeSpeedSliderValue;
    }
    if (pipesPerBreakBox) {
      pipesPerBreakBox.style.background = getPipesPerBreakGradient(pipesPerBreak);
      pipesPerBreakBox.style.border = `2px solid ${getBoxBorderColor(pipesPerBreak, 3, 10)}`;
    }
    updateDifficultyBtn();
    e.stopPropagation();
  });
}
if (closeSettingsBtn) {
  closeSettingsBtn.addEventListener("click", () => {
    settingsPopup.classList.add("hidden");
  });
}
if (settingsPopup) {
  settingsPopup.addEventListener("mousedown", (e) => {
    if (e.target === settingsPopup) settingsPopup.classList.add("hidden");
  });
}

// Note selector boxes
if (bottomNoteBox) bottomNoteBox.addEventListener("click", (e) => {
  if (shouldBlockIOSAction()) {
    e.preventDefault();
    handleBlockedIOSAction();
    return;
  }
  openNoteSlider("bottom");
});
if (topNoteBox) topNoteBox.addEventListener("click", (e) => {
  if (shouldBlockIOSAction()) {
    e.preventDefault();
    handleBlockedIOSAction();
    return;
  }
  openNoteSlider("top");
});

// Note slider
if (noteSlider) {
  noteSlider.addEventListener("input", () => {
    sliderNoteDisplay.textContent = midiToNoteName(Number(noteSlider.value));
  });
}

if (closeNoteSliderBtn) {
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
}

if (noteSliderPopup) {
  noteSliderPopup.addEventListener("mousedown", (e) => {
    if (e.target === noteSliderPopup) noteSliderPopup.classList.add("hidden");
  });
}

// How to play popup
if (howToBtn) {
  howToBtn.addEventListener("click", (e) => {
    // Check if iOS device is in landscape mode
    if (shouldBlockIOSAction()) {
      handleBlockedIOSAction();
      return;
    }
    
    howToPopup.classList.remove("hidden");
    e.stopPropagation();
  });
}
if (closeHowToBtn) {
  closeHowToBtn.addEventListener("click", () => {
    howToPopup.classList.add("hidden");
  });
}
if (howToPopup) {
  howToPopup.addEventListener("mousedown", (e) => {
    if (e.target === howToPopup) howToPopup.classList.add("hidden");
  });
}

// Credits popup
if (creditsBtn) {
  creditsBtn.addEventListener("click", (e) => {
    // Check if iOS device is in landscape mode
    if (shouldBlockIOSAction()) {
      handleBlockedIOSAction();
      return;
    }
    
    creditsPopup.classList.remove("hidden");
    e.stopPropagation();
  });
}
if (closeCreditsBtn) {
  closeCreditsBtn.addEventListener("click", () => {
    creditsPopup.classList.add("hidden");
  });
}
if (creditsPopup) {
  creditsPopup.addEventListener("mousedown", (e) => {
    if (e.target === creditsPopup) creditsPopup.classList.add("hidden");
  });
}

// Difficulty button
if (difficultyBtn) {
  difficultyBtn.addEventListener("click", (e) => {
    if (shouldBlockIOSAction()) {
      handleBlockedIOSAction();
      return;
    }
    let idx;
    if (isCustom) {
      idx = 0; // Snap to Easy if currently custom
    } else {
      idx = (difficultyIndex + 1) % difficulties.length;
    }
    setDifficulty(idx);
    e.stopPropagation();
  });
}

// Bug report button
if (bugBtn) {
  bugBtn.addEventListener("click", (e) => {
    if (shouldBlockIOSAction()) {
      handleBlockedIOSAction();
      return;
    }
    window.open("https://docs.google.com/forms/d/e/1FAIpQLScwbnly5GXgHmD5vIp9LcuWeZexq_y9r00n8ozvSEInXcCyQA/viewform?usp=dialog", "_blank");
    e.stopPropagation();
  });
}

// --- Dynamic Slider Creation & Event Handlers ---
// These will be initialized in DOMContentLoaded to ensure DOM elements are available

let pipesSliderPopup, pipesSlider, pipesSliderDisplay, closePipesSliderBtn, pipesPerBreakBox;
let pipeSpeedSliderPopup, pipeSpeedSlider, pipeSpeedSliderDisplay, closePipeSpeedSliderBtn, pipeSpeedBox;

function initializeSettingsSliders() {
  // Create pipes per break slider popup
  pipesSliderPopup = document.createElement("div");
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

  pipesSlider = pipesSliderPopup.querySelector("#pipesSlider");
  pipesSliderDisplay = pipesSliderPopup.querySelector("#pipesSliderDisplay");
  closePipesSliderBtn = pipesSliderPopup.querySelector("#closePipesSliderBtn");
  pipesPerBreakBox = document.getElementById("pipesPerBreakBox");

  // Pipes per break box and slider events
  if (pipesPerBreakBox) {
    pipesPerBreakBox.textContent = pipesPerBreak;
    pipesPerBreakBox.style.background = getPipesPerBreakGradient(pipesPerBreak);
    pipesPerBreakBox.style.border = `2px solid ${getBoxBorderColor(pipesPerBreak, 3, 10)}`;

    pipesPerBreakBox.addEventListener("click", (e) => {
      if (shouldBlockIOSAction()) {
        e.preventDefault();
        handleBlockedIOSAction();
        return;
      }
      pipesSlider.value = pipesPerBreak;
      pipesSliderDisplay.textContent = pipesPerBreak;
      pipesSliderPopup.classList.remove("hidden");
    });
  }

  pipesSlider.addEventListener("input", () => {
    pipesSliderDisplay.textContent = pipesSlider.value;
    if (pipesPerBreakBox) {
      pipesPerBreakBox.style.background = getPipesPerBreakGradient(pipesSlider.value);
      pipesPerBreakBox.style.border = `2px solid ${getBoxBorderColor(pipesSlider.value, 3, 10)}`;
    }
    onAdvancedSettingChanged();
  });

  closePipesSliderBtn.addEventListener("click", () => {
    pipesSliderPopup.classList.add("hidden");
  });

  // Create pipe speed slider popup
  pipeSpeedSliderPopup = document.createElement("div");
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

  pipeSpeedSlider = pipeSpeedSliderPopup.querySelector("#pipeSpeedSlider");
  pipeSpeedSliderDisplay = pipeSpeedSliderPopup.querySelector("#pipeSpeedSliderDisplay");
  closePipeSpeedSliderBtn = pipeSpeedSliderPopup.querySelector("#closePipeSpeedSliderBtn");
  pipeSpeedBox = document.getElementById("pipeSpeedBox");

  // Pipe speed box and slider events
  if (pipeSpeedBox) {
    pipeSpeedBox.textContent = pipeSpeedSliderValue;
    pipeSpeedBox.style.background = getPipeSpeedGradient(pipeSpeedSliderValue);
    pipeSpeedBox.style.border = `2px solid ${getBoxBorderColor(pipeSpeedSliderValue, 1, 100)}`;

    pipeSpeedBox.addEventListener("click", (e) => {
      if (shouldBlockIOSAction()) {
        e.preventDefault();
        handleBlockedIOSAction();
        return;
      }
      pipeSpeedSlider.value = pipeSpeedSliderValue;
      pipeSpeedSliderDisplay.textContent = pipeSpeedSlider.value;
      pipeSpeedSliderPopup.classList.remove("hidden");
    });
  }

  pipeSpeedSlider.addEventListener("input", () => {
    pipeSpeedSliderDisplay.textContent = pipeSpeedSlider.value;
    if (pipeSpeedBox) {
      pipeSpeedBox.textContent = pipeSpeedSlider.value;
      pipeSpeedBox.style.background = getPipeSpeedGradient(pipeSpeedSlider.value);
      pipeSpeedBox.style.border = `2px solid ${getBoxBorderColor(pipeSpeedSlider.value, 1, 100)}`;
    }
    onAdvancedSettingChanged();
  });

  closePipeSpeedSliderBtn.addEventListener("click", () => {
    pipeSpeedSliderPopup.classList.add("hidden");
  });

  pipeSpeedSliderPopup.addEventListener("mousedown", (e) => {
    if (e.target === pipeSpeedSliderPopup) pipeSpeedSliderPopup.classList.add("hidden");
  });
}

// --- Authentication Event Handlers ---

// Temporary storage for login data during warning process
let pendingLoginData = null;

// Login warning flow
logInBtn.addEventListener('click', () => {
  logInModal.classList.remove('hidden');
});

// When user submits login form, validate credentials first
logInSubmitBtn.addEventListener('click', async () => {
  const name = logInName.value.trim();
  const passcode = logInPasscode.value.trim();
  
  if (!name || !passcode) {
    logInError.textContent = 'Please fill in all fields.';
    return;
  }
  
  if (passcode.length !== 4 || !/^\d{4}$/.test(passcode)) {
    logInError.textContent = 'Passcode must be exactly 4 digits.';
    return;
  }
  
  showLoading('Validating credentials...');
  
  try {
    // First validate the credentials
    await validateLoginCredentials(name, passcode);
    
    hideLoading();
    
    // Check if user has opted out of the warning
    const skipWarning = localStorage.getItem('buzzyBirdSkipLoginWarning') === 'true';
    
    if (skipWarning) {
      // Proceed directly with login
      await proceedWithLogin(name, passcode);
    } else {
      // Store login data and show warning
      pendingLoginData = { name, passcode };
      logInModal.classList.add('hidden');
      loginWarningModal.classList.remove('hidden');
    }
  } catch (error) {
    hideLoading();
    logInError.textContent = error.message;
  }
});

// Function to proceed with actual login
async function proceedWithLogin(name, passcode) {
  showLoading('Logging in...');
  
  try {
    const userData = await logIn(name, passcode, save);
    
    // Completely overwrite local data with account data
    save = userData;
    saveData();
    
    // Store user info
    localStorage.setItem('buzzyBirdUser', JSON.stringify({
      name: userData.name,
      userId: userData.userId
    }));
    
    // Update UI
    updateCosmeticImages();
    updateMenuInfo();
    updateAuthUI();
    renderLeaderboard();
    
    // Clear form and hide modal
    logInName.value = '';
    logInPasscode.value = '';
    logInError.textContent = '';
    logInModal.classList.add('hidden'); // Hide the login modal on successful login
    
    hideLoading();
  } catch (error) {
    hideLoading();
    // Show login modal again with error
    logInModal.classList.remove('hidden');
    logInError.textContent = error.message;
  }
}

// Handle login warning proceed
loginWarningProceedBtn.addEventListener('click', async () => {
  if (!pendingLoginData) return;
  
  // Check if user checked "don't ask again"
  if (dontAskAgainCheckbox && dontAskAgainCheckbox.checked) {
    localStorage.setItem('buzzyBirdSkipLoginWarning', 'true');
  }
  
  loginWarningModal.classList.add('hidden');
  await proceedWithLogin(pendingLoginData.name, pendingLoginData.passcode);
  pendingLoginData = null;
  
  // Reset the checkbox for next time
  if (dontAskAgainCheckbox) {
    dontAskAgainCheckbox.checked = false;
  }
});

// Handle login warning cancel
loginWarningCancelBtn.addEventListener('click', () => {
  loginWarningModal.classList.add('hidden');
  logInModal.classList.remove('hidden');
  pendingLoginData = null;
});

// Login modal cancel
logInCancelBtn.addEventListener('click', () => {
  logInModal.classList.add('hidden');
  logInName.value = '';
  logInPasscode.value = '';
  logInError.textContent = '';
});

// Sign up
signUpBtn.addEventListener('click', () => {
  signUpModal.classList.remove('hidden');
});

signUpSubmitBtn.addEventListener('click', async () => {
  const name = signUpName.value.trim();
  const passcode = signUpPasscode.value.trim();
  
  if (!name || !passcode) {
    signUpError.textContent = 'Please fill in all fields.';
    return;
  }
  
  if (name.length > 20) {
    signUpError.textContent = 'Name must be 20 characters or less.';
    return;
  }
  
  if (passcode.length !== 4 || !/^\d{4}$/.test(passcode)) {
    signUpError.textContent = 'Passcode must be exactly 4 digits.';
    return;
  }
  
  showLoading('Creating account...');
  
  try {
    const userData = await signUp(name, passcode, save);
    
    // Store user info
    localStorage.setItem('buzzyBirdUser', JSON.stringify({
      name: userData.name,
      userId: userData.userId
    }));
    
    // Update UI
    updateAuthUI();
    renderLeaderboard();
    
    signUpModal.classList.add('hidden');
    signUpName.value = '';
    signUpPasscode.value = '';
    signUpError.textContent = '';
    
    hideLoading();
  } catch (error) {
    hideLoading();
    signUpError.textContent = error.message;
  }
});

signUpCancelBtn.addEventListener('click', () => {
  signUpModal.classList.add('hidden');
  signUpName.value = '';
  signUpPasscode.value = '';
  signUpError.textContent = '';
});

// Change name
changeNameBtn.addEventListener('click', () => {
  changeNameModal.classList.remove('hidden');
});

changeNameSubmitBtn.addEventListener('click', async () => {
  const newName = changeNameNew.value.trim();
  const passcode = changeNamePasscode.value.trim();
  const user = JSON.parse(localStorage.getItem('buzzyBirdUser') || 'null');
  
  if (!user || !user.name) {
    changeNameError.textContent = 'No logged in user found.';
    return;
  }
  
  if (!newName || !passcode) {
    changeNameError.textContent = 'Please fill in all fields.';
    return;
  }
  
  if (newName.length > 20) {
    changeNameError.textContent = 'Name must be 20 characters or less.';
    return;
  }
  
  if (passcode.length !== 4 || !/^\d{4}$/.test(passcode)) {
    changeNameError.textContent = 'Passcode must be exactly 4 digits.';
    return;
  }
  
  showLoading('Changing name...');
  
  try {
    const userData = await changeName(user.name, passcode, newName);
    
    // Update user info with new name
    localStorage.setItem('buzzyBirdUser', JSON.stringify({
      name: userData.name,
      userId: userData.userId
    }));
    
    // Update UI
    updateAuthUI();
    renderLeaderboard();
    
    changeNameModal.classList.add('hidden');
    changeNameNew.value = '';
    changeNamePasscode.value = '';
    changeNameError.textContent = '';
    
    hideLoading();
  } catch (error) {
    hideLoading();
    changeNameError.textContent = error.message;
  }
});

changeNameCancelBtn.addEventListener('click', () => {
  changeNameModal.classList.add('hidden');
  changeNameNew.value = '';
  changeNamePasscode.value = '';
  changeNameError.textContent = '';
});

// Delete account
deleteAccountBtn.addEventListener('click', () => {
  deleteAccountModal.classList.remove('hidden');
});

deleteAccountSubmitBtn.addEventListener('click', async () => {
  const passcode = deleteAccountPasscode.value.trim();
  const user = JSON.parse(localStorage.getItem('buzzyBirdUser') || 'null');
  
  if (!user || !user.name) {
    deleteAccountError.textContent = 'No logged in user found.';
    return;
  }
  
  if (!passcode) {
    deleteAccountError.textContent = 'Please enter your passcode.';
    return;
  }
  
  if (passcode.length !== 4 || !/^\d{4}$/.test(passcode)) {
    deleteAccountError.textContent = 'Passcode must be exactly 4 digits.';
    return;
  }
  
  showLoading('Deleting account...');
  
  try {
    await deleteAccount(user.name, passcode);
    
    // Remove user info and log out
    localStorage.removeItem('buzzyBirdUser');
    
    // Update UI
    updateAuthUI();
    renderLeaderboard();
    
    deleteAccountModal.classList.add('hidden');
    deleteAccountPasscode.value = '';
    deleteAccountError.textContent = '';
    
    hideLoading();
  } catch (error) {
    hideLoading();
    deleteAccountError.textContent = error.message;
  }
});

deleteAccountCancelBtn.addEventListener('click', () => {
  deleteAccountModal.classList.add('hidden');
  deleteAccountPasscode.value = '';
  deleteAccountError.textContent = '';
});

// Logout
logoutBtn.addEventListener('click', () => {
  // Remove user info but keep local data
  localStorage.removeItem('buzzyBirdUser');
  
  // Update UI
  updateAuthUI();
  renderLeaderboard();
});

// Initialize authentication UI on load

// --- Initialization Functions ---

// Initialize pitch range
updatePitchRange();

// Update difficulty button on load
updateDifficultyBtn();

// --- Window Load Events ---

// Microphone access on load
window.addEventListener("DOMContentLoaded", async () => {
  // Initialize save data first
  save = loadSave();
  
  // Initialize cosmetics after save is loaded
  updateCosmeticImages();
  
  // Initialize settings sliders after DOM is loaded
  initializeSettingsSliders();
  
  // Don't request microphone access on page load - wait for user to start game
  
  // Sync user and show UI (prioritize database values on page load)
  await syncLoggedInUserFromDb(true);
  updateAuthUI();
  renderLeaderboard();
  
  // Ensure backdrop is properly sized after everything is loaded (helps with Firebase hosting)
  setTimeout(() => {
    if (typeof updateMainMenuBackground === 'function') {
      updateMainMenuBackground();
    }
  }, 500);
});

// Show menu on load
window.addEventListener("DOMContentLoaded", showMainMenu);

// --- Initialize Game ---

// Try to draw initial screen
tryDrawInitial();

// Settings tab buttons
const pitchRangeTab = document.getElementById("pitchRangeTab");
const advancedTab = document.getElementById("advancedTab");

if (pitchRangeTab) {
  pitchRangeTab.addEventListener("click", (e) => {
    switchSettingsTab("pitchRange");
    e.stopPropagation();
  });
}

if (advancedTab) {
  advancedTab.addEventListener("click", (e) => {
    switchSettingsTab("advanced");
    e.stopPropagation();
  });
}

// Early user interaction handler to warm up pitch detection
let warmupTriggered = false;
function triggerEarlyWarmup() {
  if (!warmupTriggered) {
    warmupTriggered = true;
    console.log('User interaction detected - warming up pitch detection');
    if (typeof warmupPitchDetection === 'function') {
      warmupPitchDetection().catch(err => console.log('Early warmup failed:', err));
    }
  }
}

// Add early interaction listeners
['click', 'touchstart', 'keydown'].forEach(eventType => {
  document.addEventListener(eventType, triggerEarlyWarmup, { once: true, passive: true });
});

// Helper function to check if iOS actions should be blocked
function shouldBlockIOSAction() {
  return typeof isIOSDevice === 'function' && isIOSDevice() && window.innerWidth > window.innerHeight;
}

// Helper function to handle blocked iOS actions
function handleBlockedIOSAction() {
  if (typeof showIOSLandscapeWarning === 'function') {
    showIOSLandscapeWarning();
  }
}