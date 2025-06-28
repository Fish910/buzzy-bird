// =============================================================================
// STORAGE.JS - Firebase & Local Storage Management
// =============================================================================

// --- Firebase Configuration & Initialization ---
// Config is loaded from firebase-config.js
console.log("Initializing Firebase with config:", window.firebaseConfig);
if (!window.firebaseConfig) {
  console.error("Firebase configuration not found! Make sure firebase-config.js loaded properly.");
}
firebase.initializeApp(window.firebaseConfig);
const db = firebase.database();

// --- Local Storage Management ---
const STORAGE_KEY = "buzzyBirdSave";

// Load or initialize save data from localStorage
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
      if (!save.ownedPipes) save.ownedPipes = ["default"];
      if (!save.equippedPipe) save.equippedPipe = "default";
      if (!save.ownedBackdrops) save.ownedBackdrops = ["default"];
      if (!save.equippedBackdrop) save.equippedBackdrop = "default";
      
      // Clean arrays to remove undefined values
      save.ownedSkins = save.ownedSkins.filter(item => item !== undefined && item !== null);
      save.ownedPipes = save.ownedPipes.filter(item => item !== undefined && item !== null);
      save.ownedBackdrops = save.ownedBackdrops.filter(item => item !== undefined && item !== null);
      
      // Ensure defaults are present
      if (!save.ownedSkins.includes("default")) save.ownedSkins.unshift("default");
      if (!save.ownedPipes.includes("default")) save.ownedPipes.unshift("default");
      if (!save.ownedBackdrops.includes("default")) save.ownedBackdrops.unshift("default");
      
      return save;
    } catch {
      // Corrupt data, reset
      return createDefaultSave();
    }
  }
  return createDefaultSave();
}

// Create default save structure
function createDefaultSave() {
  return {
    points: 0,
    highScore: 0,
    ownedSkins: ["default"],
    equippedSkin: "default",
    ownedPipes: ["default"],
    equippedPipe: "default",
    ownedBackdrops: ["default"],
    equippedBackdrop: "default",
  };
}

// Clean save data to remove undefined values
function cleanSaveData() {
  if (save.ownedSkins) {
    save.ownedSkins = save.ownedSkins.filter(item => item !== undefined && item !== null);
    if (!save.ownedSkins.includes("default")) save.ownedSkins.unshift("default");
  }
  if (save.ownedPipes) {
    save.ownedPipes = save.ownedPipes.filter(item => item !== undefined && item !== null);
    if (!save.ownedPipes.includes("default")) save.ownedPipes.unshift("default");
  }
  if (save.ownedBackdrops) {
    save.ownedBackdrops = save.ownedBackdrops.filter(item => item !== undefined && item !== null);
    if (!save.ownedBackdrops.includes("default")) save.ownedBackdrops.unshift("default");
  }
  saveData();
}

// Save data to localStorage
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

// Save pitch range settings to localStorage
function savePitchRange() {
  localStorage.setItem("buzzyBirdPitchRange", JSON.stringify({ bottom: bottomMidi, top: topMidi }));
}

// --- Points & High Score Management ---
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

// --- Firebase Database Operations ---

// Generate a unique user ID
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Check if a display name is available
async function isNameAvailable(name) {
  const snapshot = await db.ref('users').orderByChild('name').equalTo(name.trim()).once('value');
  return !snapshot.exists();
}

// Hash passcode for secure storage
async function hashPasscode(passcode) {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sign up new user to Firebase
async function signUp(name, passcode, localData) {
  const displayName = name.trim();
  
  // Check if name is available
  if (!(await isNameAvailable(displayName))) {
    throw new Error("Name is already taken.");
  }
  
  const userId = generateUserId();
  const userRef = db.ref('users/' + userId);
  const passcodeHash = await hashPasscode(passcode);
  
  // Create user data with unique ID
  const userData = {
    userId: userId,
    name: displayName,
    passcodeHash,
    highScore: localData.highScore || 0,
    points: localData.points || 0,
    ownedSkins: (localData.ownedSkins || ["default"]).filter(item => item !== undefined && item !== null),
    ownedPipes: (localData.ownedPipes || ["default"]).filter(item => item !== undefined && item !== null),
    ownedBackdrops: (localData.ownedBackdrops || ["default"]).filter(item => item !== undefined && item !== null),
    equippedSkin: localData.equippedSkin || "default",
    equippedPipe: localData.equippedPipe || "default",
    equippedBackdrop: localData.equippedBackdrop || "default",
    createdAt: Date.now()
  };
  
  await userRef.set(userData);
  return userData;
}

// Log in existing user from Firebase
async function logIn(name, passcode, localData) {
  const displayName = name.trim();
  
  // Find user by name
  const snapshot = await db.ref('users').orderByChild('name').equalTo(displayName).once('value');
  if (!snapshot.exists()) throw new Error("Account not found.");
  
  // Get the user data (should be only one match)
  let userData = null;
  let userId = null;
  snapshot.forEach(child => {
    userData = child.val();
    userId = child.key;
  });
  
  const passcodeHash = await hashPasscode(passcode);
  if (userData.passcodeHash !== passcodeHash) throw new Error("Incorrect passcode.");

  // --- Only add new local progress since last sync ---
  // Get last synced points from localStorage (or 0 if not set)
  const lastSyncedPoints = Number(localStorage.getItem('buzzyBirdLastSyncedPoints') || 0);
  const newLocalPoints = Math.max(0, (localData.points || 0) - lastSyncedPoints);

  const merged = {
    ...userData,
    userId: userId, // Ensure userId is set
    highScore: Math.max(userData.highScore || 0, localData.highScore || 0),
    points: (userData.points || 0) + newLocalPoints,
    ownedSkins: Array.from(new Set([...(userData.ownedSkins || []), ...(localData.ownedSkins || [])])).filter(item => item !== undefined && item !== null),
    ownedPipes: Array.from(new Set([...(userData.ownedPipes || ["default"]), ...(localData.ownedPipes || ["default"])])).filter(item => item !== undefined && item !== null),
    ownedBackdrops: Array.from(new Set([...(userData.ownedBackdrops || ["default"]), ...(localData.ownedBackdrops || ["default"])])).filter(item => item !== undefined && item !== null),
    equippedSkin: localData.equippedSkin || userData.equippedSkin || "default",
    equippedPipe: localData.equippedPipe || userData.equippedPipe || "default",
    equippedBackdrop: localData.equippedBackdrop || userData.equippedBackdrop || "default"
  };
  
  // Update user data in Firebase
  await db.ref('users/' + userId).update(merged);

  // Update last synced points
  localStorage.setItem('buzzyBirdLastSyncedPoints', merged.points);

  return merged;
}

// Change user's name in Firebase
async function changeName(oldName, passcode, newName) {
  const oldDisplayName = oldName.trim();
  const newDisplayName = newName.trim();
  if (oldDisplayName === newDisplayName) throw new Error("New name must be different.");
  
  // Check if new name is available
  if (!(await isNameAvailable(newDisplayName))) {
    throw new Error("New name is already taken.");
  }
  
  // Find user by current name
  const snapshot = await db.ref('users').orderByChild('name').equalTo(oldDisplayName).once('value');
  if (!snapshot.exists()) throw new Error("Current account not found.");
  
  // Get the user data
  let userData = null;
  let userId = null;
  snapshot.forEach(child => {
    userData = child.val();
    userId = child.key;
  });
  
  const passcodeHash = await hashPasscode(passcode);
  if (userData.passcodeHash !== passcodeHash) throw new Error("Incorrect passcode.");

  // Update the name (user ID stays the same)
  await db.ref('users/' + userId + '/name').set(newDisplayName);
}

// Update user's high score in Firebase
async function updateHighScore(name, newScore) {
  const displayName = name.trim();
  
  // Find user by name
  const snapshot = await db.ref('users').orderByChild('name').equalTo(displayName).once('value');
  if (!snapshot.exists()) return; // User not found
  
  // Get the user ID
  let userId = null;
  snapshot.forEach(child => {
    userId = child.key;
  });
  
  const userRef = db.ref('users/' + userId + '/highScore');
  const scoreSnapshot = await userRef.get();
  if (!scoreSnapshot.exists() || newScore > scoreSnapshot.val()) {
    await userRef.set(newScore);
  }
}

// Fetch leaderboard from Firebase
async function fetchLeaderboard() {
  const snapshot = await db.ref('users').orderByChild('highScore').once('value');
  const users = [];
  snapshot.forEach(child => {
    users.push(child.val());
  });
  // Sort descending by highScore
  users.sort((a, b) => (b.highScore || 0) - (a.highScore || 0));
  return users;
}

// --- Fetch and overwrite local user data from DB on main menu open ---
async function syncLoggedInUserFromDb() {
  const user = JSON.parse(localStorage.getItem('buzzyBirdUser') || 'null');
  if (!user || !user.userId) return; // Need userId to sync
  
  try {
    const userRef = db.ref('users/' + user.userId);
    const snapshot = await userRef.get();
    if (snapshot.exists()) {
      const dbUser = snapshot.val();
      // Overwrite all local data with DB data
      save = {
        points: dbUser.points || 0,
        highScore: dbUser.highScore || 0,
        ownedSkins: dbUser.ownedSkins || ["default"],
        equippedSkin: dbUser.equippedSkin || "default",
        ownedPipes: dbUser.ownedPipes || ["default"],
        equippedPipe: dbUser.equippedPipe || "default",
        ownedBackdrops: dbUser.ownedBackdrops || ["default"],
        equippedBackdrop: dbUser.equippedBackdrop || "default"
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      localStorage.setItem('buzzyBirdUser', JSON.stringify(dbUser));
      updateMenuInfo && updateMenuInfo();
      renderCosmeticsGrid && renderCosmeticsGrid();
      updateAuthUI && updateAuthUI();
    }
  } catch (e) {
    // If fetch fails, do nothing (keep local data)
  }
}

// --- Sync local purchases to Firebase ---
async function syncPurchaseToDb() {
  const user = JSON.parse(localStorage.getItem('buzzyBirdUser') || 'null');
  if (!user || !user.userId) return; // Only sync if user is logged in
  
  try {
    // Clean arrays to remove any undefined values
    const cleanOwnedSkins = (save.ownedSkins || ["default"]).filter(item => item !== undefined && item !== null);
    const cleanOwnedPipes = (save.ownedPipes || ["default"]).filter(item => item !== undefined && item !== null);
    const cleanOwnedBackdrops = (save.ownedBackdrops || ["default"]).filter(item => item !== undefined && item !== null);
    
    // Ensure default items are always included
    if (!cleanOwnedSkins.includes("default")) cleanOwnedSkins.unshift("default");
    if (!cleanOwnedPipes.includes("default")) cleanOwnedPipes.unshift("default");
    if (!cleanOwnedBackdrops.includes("default")) cleanOwnedBackdrops.unshift("default");
    
    const userRef = db.ref('users/' + user.userId);
    await userRef.update({
      points: save.points || 0,
      ownedSkins: cleanOwnedSkins,
      equippedSkin: save.equippedSkin || "default",
      ownedPipes: cleanOwnedPipes,
      equippedPipe: save.equippedPipe || "default",
      ownedBackdrops: cleanOwnedBackdrops,
      equippedBackdrop: save.equippedBackdrop || "default"
    });
    
    // Update local user data to match
    const updatedUser = {
      ...user,
      points: save.points || 0,
      ownedSkins: cleanOwnedSkins,
      equippedSkin: save.equippedSkin || "default",
      ownedPipes: cleanOwnedPipes,
      equippedPipe: save.equippedPipe || "default",
      ownedBackdrops: cleanOwnedBackdrops,
      equippedBackdrop: save.equippedBackdrop || "default"
    };
    localStorage.setItem('buzzyBirdUser', JSON.stringify(updatedUser));
  } catch (e) {
    // If sync fails, keep local data
    console.warn('Failed to sync purchase to database:', e);
  }
}
