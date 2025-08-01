// =============================================================================
// COSMETICS.JS - Cosmetic Management & Features (Birds, Pipes, Backdrops)
// =============================================================================

// --- Bird Skin Definitions ---
const DEFAULT_BIRDS = [
  { id: "default", name: "Classic", price: 0, img: "assets/skins/default.png" },
];

const BIRDS = [
  ...DEFAULT_BIRDS,
  { id: "red", name: "Red Bird", price: 5, img: "assets/skins/red.png" },
  { id: "poop", name: "Poop Bird", price: 5, img: "assets/skins/poop.png" },
  { id: "rainbow", name: "Rainbow Bird", price: 10, img: "assets/skins/rainbow.png" },
  { id: "diamond", name: "Diamond Bird", price: 20, img: "assets/skins/diamond.png" },
  { id: "retro", name: "Retro Bird", price: 20, img: "assets/skins/retro.png" },
  { id: "mustard", name: "Mustard", price: 30, img: "assets/skins/mustard.png" },
  { id: "mango", name: "Mango", price: 30, img: "assets/skins/mango.png" }
];

// --- Pipe Definitions ---
const DEFAULT_PIPES = [
  { id: "default", name: "Classic", price: 0, img: "assets/pipes/default.png" },
];

const PIPES = [
  ...DEFAULT_PIPES,
  { id: "red", name: "Red Pipes", price: 15, img: "assets/pipes/red.png" },
  { id: "rainbow", name: "Rainbow Pipes", price: 15, img: "assets/pipes/rainbow.png" }
];

// --- Backdrop Definitions ---
const DEFAULT_BACKDROPS = [
  { id: "default", name: "Day", price: 0, img: "assets/walls/default.png" },
];

const BACKDROPS = [
  ...DEFAULT_BACKDROPS,
  { id: "night", name: "Night", price: 25, img: "assets/walls/night.png" },
  { id: "fall", name: "Fall", price: 25, img: "assets/walls/fall.png" },
  { id: "winter", name: "Winter", price: 25, img: "assets/walls/winter.png" }
];

// Current active cosmetics tab
let activeTab = "birds";

// --- Cosmetic Utility Functions ---

// Get cosmetic arrays by type
function getCosmeticArray(type) {
  switch(type) {
    case "birds": return BIRDS;
    case "pipes": return PIPES;
    case "backdrops": return BACKDROPS;
    default: return BIRDS;
  }
}

// Get cosmetic object by type and id
function getCosmetic(type, id) {
  const array = getCosmeticArray(type);
  return array.find(c => c.id === id) || array[0];
}

// Get owned cosmetics for a type
function getOwnedCosmetics(type) {
  if (!save) return ["default"];
  switch(type) {
    case "birds": return save.ownedSkins || ["default"];
    case "pipes": return save.ownedPipes || ["default"];
    case "backdrops": return save.ownedBackdrops || ["default"];
    default: return ["default"];
  }
}

// Get equipped cosmetic for a type
function getEquippedCosmetic(type) {
  if (!save) return "default";
  switch(type) {
    case "birds": return save.equippedSkin || "default";
    case "pipes": return save.equippedPipe || "default";
    case "backdrops": return save.equippedBackdrop || "default";
    default: return "default";
  }
}

// Unlock a cosmetic for the player
function unlockCosmetic(type, cosmeticId) {
  if (!save) return; // Guard against undefined save
  const owned = getOwnedCosmetics(type);
  if (!owned.includes(cosmeticId)) {
    switch(type) {
      case "birds":
        if (!save.ownedSkins) save.ownedSkins = ["default"];
        save.ownedSkins.push(cosmeticId);
        break;
      case "pipes":
        if (!save.ownedPipes) save.ownedPipes = ["default"];
        save.ownedPipes.push(cosmeticId);
        break;
      case "backdrops":
        if (!save.ownedBackdrops) save.ownedBackdrops = ["default"];
        save.ownedBackdrops.push(cosmeticId);
        break;
    }
    saveData();
  }
}

// Equip a cosmetic if the player owns it
function equipCosmetic(type, cosmeticId) {
  if (!save) return; // Guard against undefined save
  const owned = getOwnedCosmetics(type);
  if (owned.includes(cosmeticId)) {
    switch(type) {
      case "birds":
        save.equippedSkin = cosmeticId;
        updateBirdImage(); // Update bird image immediately
        break;
      case "pipes":
        save.equippedPipe = cosmeticId;
        updatePipeImage(); // Update pipe image immediately
        break;
      case "backdrops":
        save.equippedBackdrop = cosmeticId;
        updateBackdropImage(); // This will also update main menu background
        break;
    }
    saveData();
  }
}

// Update images based on equipped cosmetics
function updateCosmeticImages() {
  updateBirdImage();
  updatePipeImage();
  updateBackdropImage();
  updateMainMenuBackground(); // Update main menu background immediately
}

// Update the bird image based on equipped skin
function updateBirdImage() {
  if (typeof birdImg === 'undefined') return; // Wait for game.js to load
  if (!save) return; // Wait for save to be loaded
  const bird = getCosmetic("birds", save.equippedSkin || "default");
  birdImg.src = bird.img;
}

// Update the pipe image based on equipped pipe
function updatePipeImage() {
  if (typeof pipeImg === 'undefined') return; // Wait for game.js to load
  if (!save) return; // Wait for save to be loaded
  const pipe = getCosmetic("pipes", save.equippedPipe || "default");
  pipeImg.src = pipe.img;
}

// Update the backdrop image based on equipped backdrop
function updateBackdropImage() {
  if (typeof bgImg === 'undefined') return; // Wait for game.js to load
  if (!save) return; // Wait for save to be loaded
  const backdrop = getCosmetic("backdrops", save.equippedBackdrop || "default");
  bgImg.src = backdrop.img;
  
  // Also update the main menu background immediately
  updateMainMenuBackground();
}

// Update the main menu background to match the equipped backdrop
function updateMainMenuBackground() {
  // Remove any existing overlay
  const existingOverlay = document.getElementById("canvasOverlay");
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  if (!save) return;
  const backdrop = getCosmetic("backdrops", save.equippedBackdrop || "default");
  if (!backdrop || !backdrop.img) return;
  
  // Apply backdrop directly to body element
  document.body.style.backgroundImage = `url(${backdrop.img})`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundRepeat = 'no-repeat';
  document.body.style.backgroundAttachment = 'fixed';
  
  // Create overlay that covers everything except the canvas area
  const overlay = document.createElement("div");
  overlay.id = "canvasOverlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.zIndex = "5"; // Below menu (z-index 10) but above backdrop
  overlay.style.pointerEvents = "none";
  overlay.style.background = "rgba(255, 255, 255, 0.48)";
  
  // Create a cutout for the canvas area using clip-path
  if (window.innerWidth > window.innerHeight) {
    // Landscape: canvas is 480px wide, centered
    const canvasLeft = (window.innerWidth - 480) / 2;
    const canvasRight = canvasLeft + 480;
    overlay.style.clipPath = `polygon(0 0, ${canvasLeft}px 0, ${canvasLeft}px 100%, 0 100%, 0 0, ${canvasRight}px 0, ${canvasRight}px 100%, 100% 100%, 100% 0)`;
  } else {
    // Portrait: canvas fills entire screen, so no overlay needed
    overlay.style.display = "none";
  }
  
  document.body.appendChild(overlay);
}

// Clear the main menu background when starting the game
function clearMainMenuBackground() {
  // Remove backdrop from body
  document.body.style.backgroundImage = '';
  document.body.style.backgroundSize = '';
  document.body.style.backgroundPosition = '';
  document.body.style.backgroundRepeat = '';
  document.body.style.backgroundAttachment = '';
  
  // Remove canvas overlay
  const existingOverlay = document.getElementById("canvasOverlay");
  if (existingOverlay) {
    existingOverlay.remove();
  }
}

// --- Cosmetics Popup Management ---

// Show the cosmetics selection popup
function showSkinsPopup() {
  activeTab = "birds"; // Always start with birds tab
  updateTabButtons();
  renderCosmeticsGrid();
  skinsPopup.classList.remove("hidden");
}

// Hide the cosmetics selection popup
function hideSkinsPopup() {
  skinsPopup.classList.add("hidden");
  updateMenuInfo();
}

// Switch to a specific cosmetics tab
function switchTab(tabName) {
  activeTab = tabName;
  updateTabButtons();
  renderCosmeticsGrid();
}

// Update tab button appearances
function updateTabButtons() {
  const birdsTab = document.getElementById("birdsTab");
  const pipesTab = document.getElementById("pipesTab");
  const backdropsTab = document.getElementById("backdropsTab");
  
  // Remove active class from all tabs
  [birdsTab, pipesTab, backdropsTab].forEach(tab => {
    if (tab) tab.classList.remove("active");
  });
  
  // Add active class to current tab
  switch(activeTab) {
    case "birds":
      if (birdsTab) birdsTab.classList.add("active");
      break;
    case "pipes":
      if (pipesTab) pipesTab.classList.add("active");
      break;
    case "backdrops":
      if (backdropsTab) backdropsTab.classList.add("active");
      break;
  }
}

// Render the grid of available cosmetics for the active tab
function renderCosmeticsGrid() {
  const cosmeticsGrid = document.getElementById("cosmeticsGrid");
  if (!cosmeticsGrid) return;
  
  cosmeticsGrid.innerHTML = "";
  
  // Apply appropriate CSS class based on active tab
  cosmeticsGrid.className = "cosmetics-grid";
  if (activeTab === "pipes") {
    cosmeticsGrid.classList.add("pipes-grid");
  } else if (activeTab === "backdrops") {
    cosmeticsGrid.classList.add("backdrops-grid");
  }
  
  const cosmetics = getCosmeticArray(activeTab);
  const owned = getOwnedCosmetics(activeTab);
  const equipped = getEquippedCosmetic(activeTab);
  
  for (const cosmetic of cosmetics) {
    const isOwned = owned.includes(cosmetic.id);
    const isEquipped = equipped === cosmetic.id;
    
    // Create cosmetic box element
    const box = document.createElement("div");
    box.className = "skin-box" + (isEquipped ? " equipped" : "") + (isOwned ? "" : " locked");
    box.title = cosmetic.name;
    
    // Add cosmetic sprite image
    const img = document.createElement("img");
    img.src = cosmetic.img;
    img.className = "skin-sprite";
    box.appendChild(img);
    
    // Add overlay for locked cosmetics showing price
    if (!isOwned) {
      const overlay = document.createElement("div");
      overlay.className = "skin-overlay";
      overlay.innerHTML = `<div class="skin-cost">${cosmetic.price} pt</div>`;
      box.appendChild(overlay);
    }
    
    // Handle cosmetic selection/purchase
    box.addEventListener("click", () => {
      if (isOwned) {
        // Equip the cosmetic if already owned
        equipCosmetic(activeTab, cosmetic.id);
        updateCosmeticImages();
        renderCosmeticsGrid();
        // Sync equipment change to database
        if (typeof syncUserDataToDb === 'function') {
          syncUserDataToDb();
        }
      } else if (save.points >= cosmetic.price) {
        // Purchase and equip the cosmetic if player has enough points
        save.points -= cosmetic.price;
        unlockCosmetic(activeTab, cosmetic.id);
        equipCosmetic(activeTab, cosmetic.id);
        updateCosmeticImages();
        renderCosmeticsGrid();
        updateMenuInfo();
        // Sync user data (purchase and points) to database
        if (typeof syncUserDataToDb === 'function') {
          syncUserDataToDb();
        }
      }
    });
    
    cosmeticsGrid.appendChild(box);
  }
}

// Legacy function name for compatibility
function renderSkinsGrid() {
  renderCosmeticsGrid();
}

// Handle window resize to update canvas overlay
function handleCanvasOverlayResize() {
  const overlay = document.getElementById("canvasOverlay");
  if (!overlay) return;
  
  if (window.innerWidth > window.innerHeight) {
    // Landscape: canvas is 480px wide, centered
    const canvasLeft = (window.innerWidth - 480) / 2;
    const canvasRight = canvasLeft + 480;
    overlay.style.clipPath = `polygon(0 0, ${canvasLeft}px 0, ${canvasLeft}px 100%, 0 100%, 0 0, ${canvasRight}px 0, ${canvasRight}px 100%, 100% 100%, 100% 0)`;
    overlay.style.display = "block";
  } else {
    // Portrait: canvas fills entire screen, so no overlay needed
    overlay.style.display = "none";
  }
}

// Add window resize listener for canvas overlay
window.addEventListener('resize', handleCanvasOverlayResize);
