// =============================================================================
// STORAGE.JS - Firebase & Local Storage Management
// =============================================================================

// --- Firebase Configuration & Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyDh-UejLP_DLWWuWDwUM0PeOSG6IYqBO0U",
  authDomain: "pitch-bird.firebaseapp.com",
  projectId: "pitch-bird",
  storageBucket: "pitch-bird.firebasestorage.app",
  messagingSenderId: "356300745950",
  appId: "1:356300745950:web:bef4de640276fac4c8264f",
  measurementId: "G-8SS9R2QGRW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
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
  };
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

// Hash passcode for secure storage
async function hashPasscode(passcode) {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sign up new user to Firebase
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

// Log in existing user from Firebase
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

// Change user's name in Firebase
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

// Update user's high score in Firebase
async function updateHighScore(name, newScore) {
  const username = name.trim().toLowerCase();
  const userRef = db.ref('users/' + username + '/highScore');
  const snapshot = await userRef.get();
  if (!snapshot.exists() || newScore > snapshot.val()) {
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
