// =============================================================================
// COSMETICS.JS - Skin Management & Cosmetic Features
// =============================================================================

// --- Skin Definitions ---
const DEFAULT_SKINS = [
  { id: "default", name: "Classic", price: 0, img: "assets/skins/default.png" },
];

const SKINS = [
  ...DEFAULT_SKINS,
  { id: "red", name: "Red Bird", price: 5, img: "assets/skins/red.png" },
  { id: "poop", name: "Poop Bird", price: 5, img: "assets/skins/poop.png" },
  { id: "rainbow", name: "Rainbow Bird", price: 10, img: "assets/skins/rainbow.png" },
  { id: "diamond", name: "Diamond Bird", price: 20, img: "assets/skins/diamond.png" },
  { id: "retro", name: "Retro Bird", price: 20, img: "assets/skins/retro.png" },
  { id: "mustard", name: "Mustard", price: 30, img: "assets/skins/mustard.png" },
  { id: "mango", name: "Mango", price: 30, img: "assets/skins/mango.png" }
];

// --- Skin Utility Functions ---

// Get skin object by id
function getSkin(id) {
  return SKINS.find(s => s.id === id) || SKINS[0];
}

// Unlock a skin for the player
function unlockSkin(skinId) {
  if (!save.ownedSkins.includes(skinId)) {
    save.ownedSkins.push(skinId);
    saveData();
  }
}

// Equip a skin if the player owns it
function equipSkin(skinId) {
  if (save.ownedSkins.includes(skinId)) {
    save.equippedSkin = skinId;
    saveData();
  }
}

// Update the bird image based on equipped skin
function updateBirdImage() {
  const skin = getSkin(save.equippedSkin);
  birdImg.src = skin.img;
}

// --- Skins Popup Management ---

// Show the skins selection popup
function showSkinsPopup() {
  renderSkinsGrid();
  skinsPopup.classList.remove("hidden");
}

// Hide the skins selection popup
function hideSkinsPopup() {
  skinsPopup.classList.add("hidden");
  updateMenuInfo();
}

// Render the grid of available skins
function renderSkinsGrid() {
  skinsGrid.innerHTML = "";
  for (const skin of SKINS) {
    const owned = save.ownedSkins.includes(skin.id);
    const equipped = save.equippedSkin === skin.id;
    
    // Create skin box element
    const box = document.createElement("div");
    box.className = "skin-box" + (equipped ? " equipped" : "") + (owned ? "" : " locked");
    box.title = skin.name;
    
    // Add skin sprite image
    const img = document.createElement("img");
    img.src = skin.img;
    img.className = "skin-sprite";
    box.appendChild(img);
    
    // Add overlay for locked skins showing price
    if (!owned) {
      const overlay = document.createElement("div");
      overlay.className = "skin-overlay";
      overlay.innerHTML = `<div class="skin-cost">${skin.price} pt</div>`;
      box.appendChild(overlay);
    }
    
    // Handle skin selection/purchase
    box.addEventListener("click", () => {
      if (owned) {
        // Equip the skin if already owned
        equipSkin(skin.id);
        updateBirdImage();
        renderSkinsGrid();
      } else if (save.points >= skin.price) {
        // Purchase and equip the skin if player has enough points
        save.points -= skin.price;
        unlockSkin(skin.id);
        equipSkin(skin.id);
        updateBirdImage();
        renderSkinsGrid();
        updateMenuInfo();
      }
    });
    
    skinsGrid.appendChild(box);
  }
}
