// =============================================================================
// STORAGE.JS - Firebase & Local Storage Management
// =============================================================================

// --- Firebase Configuration & Initialization ---
// Config is loaded from firebase-config.js
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

async function setHighScoreIfNeeded(newScore) {
  if (newScore > save.highScore) {
    const oldHighScore = save.highScore;
    save.highScore = newScore;
    saveData();
    
    // Immediately sync to Firebase if user is logged in
    const user = JSON.parse(localStorage.getItem('buzzyBirdUser') || 'null');
    if (user && user.userId) {
      
      // Set sync flag
      if (typeof window !== 'undefined') {
        window.highScoreSyncInProgress = true;
      }
      
      try {
        // Wait for sync to complete
        await syncUserDataToDb();
        
        // Force a fresh leaderboard fetch after successful sync
        if (typeof renderLeaderboard === 'function') {
          await renderLeaderboard();
        }
      } catch (err) {
        // Even if sync fails, try to refresh leaderboard with local data
        if (typeof renderLeaderboard === 'function') {
          renderLeaderboard();
        }
      } finally {
        // Clear sync flag
        if (typeof window !== 'undefined') {
          window.highScoreSyncInProgress = false;
        }
      }
    }
  }
}

// --- Firebase Database Operations ---

// Generate a unique user ID
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Check if a display name is available
async function isNameAvailable(name) {
  const displayName = name.trim();
  
  // Check if name is available (case-insensitive)
  const allUsersSnapshot = await db.ref('users').once('value');
  if (allUsersSnapshot.exists()) {
    let nameExists = false;
    allUsersSnapshot.forEach(child => {
      const user = child.val();
      if (user.name && user.name.toLowerCase() === displayName.toLowerCase()) {
        nameExists = true;
        return true; // Break out of forEach
      }
    });
    return !nameExists;
  }
  return true;
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
  
  // Find user by name (case-insensitive search)
  const allUsersSnapshot = await db.ref('users').once('value');
  let userData = null;
  let userId = null;
  
  if (allUsersSnapshot.exists()) {
    allUsersSnapshot.forEach(child => {
      const user = child.val();
      if (user.name && user.name.toLowerCase() === displayName.toLowerCase()) {
        userData = user;
        userId = child.key;
        return true; // Break out of forEach
      }
    });
  }
  
  if (!userData) throw new Error("Account not found.");
  
  const passcodeHash = await hashPasscode(passcode);
  if (userData.passcodeHash !== passcodeHash) throw new Error("Incorrect passcode.");

  // --- Complete overwrite: use account data, ignore local data ---
  const accountData = {
    ...userData,
    userId: userId, // Ensure userId is set
    // Use account data completely, ignore local data
    highScore: userData.highScore || 0,
    points: userData.points || 0,
    ownedSkins: (userData.ownedSkins || ["default"]).filter(item => item !== undefined && item !== null),
    ownedPipes: (userData.ownedPipes || ["default"]).filter(item => item !== undefined && item !== null),
    ownedBackdrops: (userData.ownedBackdrops || ["default"]).filter(item => item !== undefined && item !== null),
    equippedSkin: userData.equippedSkin || "default",
    equippedPipe: userData.equippedPipe || "default",
    equippedBackdrop: userData.equippedBackdrop || "default"
  };
  
  // Update last synced points to the account points value
  localStorage.setItem('buzzyBirdLastSyncedPoints', accountData.points);

  return accountData;
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
  
  // Find user by current name (case-insensitive)
  const allUsersSnapshot = await db.ref('users').once('value');
  let userData = null;
  let userId = null;
  
  if (allUsersSnapshot.exists()) {
    allUsersSnapshot.forEach(child => {
      const user = child.val();
      if (user.name && user.name.toLowerCase() === oldDisplayName.toLowerCase()) {
        userData = user;
        userId = child.key;
        return true; // Break out of forEach
      }
    });
  }
  
  if (!userData) throw new Error("Current account not found.");
  
  const passcodeHash = await hashPasscode(passcode);
  if (userData.passcodeHash !== passcodeHash) throw new Error("Incorrect passcode.");

  // Update the name (user ID stays the same)
  await db.ref('users/' + userId + '/name').set(newDisplayName);
  
  // Return the updated user data
  return {
    name: newDisplayName,
    userId: userId,
    points: userData.points,
    passcodeHash: userData.passcodeHash
  };
}

// Delete user account from Firebase
async function deleteAccount(name, passcode) {
  const displayName = name.trim();
  
  // Find user by name (case-insensitive)
  const allUsersSnapshot = await db.ref('users').once('value');
  let userData = null;
  let userId = null;
  
  if (allUsersSnapshot.exists()) {
    allUsersSnapshot.forEach(child => {
      const user = child.val();
      if (user.name && user.name.toLowerCase() === displayName.toLowerCase()) {
        userData = user;
        userId = child.key;
        return true; // Break out of forEach
      }
    });
  }
  
  if (!userData) throw new Error("Account not found.");
  
  const passcodeHash = await hashPasscode(passcode);
  if (userData.passcodeHash !== passcodeHash) throw new Error("Incorrect passcode.");
  
  // Delete the user account from Firebase
  await db.ref('users/' + userId).remove();
  
  return true;
}

// Update user's high score in Firebase
async function updateHighScore(name, newScore) {
  const displayName = name.trim();
  
  // Find user by name (case-insensitive)
  const allUsersSnapshot = await db.ref('users').once('value');
  let userId = null;
  
  if (allUsersSnapshot.exists()) {
    allUsersSnapshot.forEach(child => {
      const user = child.val();
      if (user.name && user.name.toLowerCase() === displayName.toLowerCase()) {
        userId = child.key;
        return true; // Break out of forEach
      }
    });
  }
  
  if (!userId) return; // User not found
  
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
      
      // Merge data intelligently - take the maximum values where appropriate
      const currentLocalData = save || getDefaultSave();
      
      // Only update high score if DB version is higher (prevent overwriting recent achievements)
      const finalHighScore = Math.max(dbUser.highScore || 0, currentLocalData.highScore || 0);
      
      save = {
        points: Math.max(dbUser.points || 0, currentLocalData.points || 0),
        highScore: finalHighScore,
        ownedSkins: dbUser.ownedSkins || ["default"],
        equippedSkin: dbUser.equippedSkin || "default",
        ownedPipes: dbUser.ownedPipes || ["default"],
        equippedPipe: dbUser.equippedPipe || "default",
        ownedBackdrops: dbUser.ownedBackdrops || ["default"],
        equippedBackdrop: dbUser.equippedBackdrop || "default"
      };
      
      // If we merged higher local values, sync them back to the database
      if (save.points > (dbUser.points || 0) || save.highScore > (dbUser.highScore || 0)) {
        await syncUserDataToDb();
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      localStorage.setItem('buzzyBirdUser', JSON.stringify({
        ...dbUser,
        points: save.points,
        highScore: save.highScore
      }));
      updateMenuInfo && updateMenuInfo();
      renderCosmeticsGrid && renderCosmeticsGrid();
      updateAuthUI && updateAuthUI();
    }
  } catch (e) {
    // If fetch fails, do nothing (keep local data)
  }
}

// --- Sync all local user data to Firebase ---
async function syncUserDataToDb() {
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
    const updateData = {
      points: save.points || 0,
      highScore: save.highScore || 0,
      ownedSkins: cleanOwnedSkins,
      equippedSkin: save.equippedSkin || "default",
      ownedPipes: cleanOwnedPipes,
      equippedPipe: save.equippedPipe || "default",
      ownedBackdrops: cleanOwnedBackdrops,
      equippedBackdrop: save.equippedBackdrop || "default"
    };
    
    await userRef.update(updateData);
    
    // Verify the update was successful by reading it back
    const verifySnapshot = await userRef.once('value');
    const verifiedData = verifySnapshot.val();
    
    if (verifiedData.highScore !== updateData.highScore) {
      throw new Error('Firebase sync verification failed');
    }
    
    // Update local user data to match
    const updatedUser = {
      ...user,
      points: save.points || 0,
      highScore: save.highScore || 0,
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
  }
}

// Validate login credentials without logging in
async function validateLoginCredentials(name, passcode) {
  const displayName = name.trim();
  
  // Find user by name (case-insensitive search)
  const allUsersSnapshot = await db.ref('users').once('value');
  let userData = null;
  
  if (allUsersSnapshot.exists()) {
    allUsersSnapshot.forEach(child => {
      const user = child.val();
      if (user.name && user.name.toLowerCase() === displayName.toLowerCase()) {
        userData = user;
        return true; // Break out of forEach
      }
    });
  }
  
  if (!userData) throw new Error("Account not found.");
  
  const passcodeHash = await hashPasscode(passcode);
  if (userData.passcodeHash !== passcodeHash) throw new Error("Incorrect passcode.");
  
  return true; // Credentials are valid
}
