/* ==========================================================================
   404 CAFÉ DIGITAL MENU - INTERACTIVE LOGIC
   ========================================================================== */

// --- Menu Database ---
const MENU_DATA = {
  // Burgers
  "veg-burger": {
    name: "Classic Veg Burger",
    price: 89,
    desc: "Crispy vegetable patty, fresh lettuce, pickles, sliced onion, and our house secret sauce.",
    veg: true,
    image: "images/burger.png",
    customizations: [
      { name: "Extra Cheese", price: 19 },
      { name: "Extra Veg Patty", price: 50 },
      { name: "Make it Spicy", price: 0 }
    ]
  },
  "chicken-burger": {
    name: "Classic Chicken Burger",
    price: 99,
    desc: "Seared chicken patty, sunny-side egg, fresh lettuce, pickles, onion, and secret sauce.",
    veg: false,
    image: "images/burger.png",
    customizations: [
      { name: "Extra Cheese", price: 19 },
      { name: "Double Chicken Patty", price: 60 },
      { name: "Extra Egg", price: 15 }
    ]
  },
  "beef-burger": {
    name: "Classic Beef Burger",
    price: 149,
    desc: "Premium beef patty, egg, lettuce, pickles, onion, and house secret sauce.",
    veg: false,
    image: "images/burger.png",
    customizations: [
      { name: "Extra Cheese", price: 19 },
      { name: "Double Beef Patty", price: 69 },
      { name: "Extra Egg", price: 15 }
    ]
  },
  "smashed-beef": {
    name: "Smashed Beef Burger",
    price: 189,
    desc: "Smashed beef patty, melted cheese, egg, pickles, caramelized onion, and secret sauce.",
    veg: false,
    image: "images/burger.png",
    customizations: [
      { name: "Extra Cheese", price: 19 },
      { name: "Double Smashed Patty", price: 69 },
      { name: "Jalapenos", price: 10 }
    ]
  },
  "double-smashed": {
    name: "Double Smashed Beef",
    price: 219,
    desc: "Two double smashed beef patties, double melted cheese, egg, pickles, caramelized onion, and secret sauce.",
    veg: false,
    image: "images/burger.png",
    customizations: [
      { name: "Extra Cheese Slice", price: 19 },
      { name: "Bacon Strips", price: 49 },
      { name: "Extra Egg", price: 15 }
    ]
  },
  "oklahoma-smashed": {
    name: "Oklahoma Smashed",
    price: 249,
    desc: "Smashed beef patty pressed with thin sweet onions, melted cheese, egg, pickles, and secret sauce.",
    veg: false,
    image: "images/burger.png",
    customizations: [
      { name: "Double Beef Patty", price: 69 },
      { name: "Extra Cheese", price: 19 },
      { name: "Spicy Mayo", price: 0 }
    ]
  },

  // Drinks
  "mojito-ultra": {
    name: "Mojito Ultra",
    price: 99,
    desc: "Muddled fresh mint leaves, zesty lime wedges, premium blue curacao syrup, and sparkling soda over crushed ice.",
    veg: true,
    image: "images/mojito.png",
    customizations: [
      { name: "Extra Mint & Lime", price: 0 },
      { name: "Less Sweet", price: 0 },
      { name: "Double Curacao Syrup", price: 15 }
    ]
  },
  "iced-latte": {
    name: "Iced Latte",
    price: 129,
    desc: "Freshly pulled espresso shots poured over cold milk and ice cubes. Perfectly balanced.",
    veg: true,
    image: "images/mojito.png", // reusing drink container
    customizations: [
      { name: "Extra Espresso Shot", price: 30 },
      { name: "Almond Milk Substitute", price: 40 },
      { name: "Vanilla Syrup", price: 15 }
    ]
  },
  "iced-chocolate": {
    name: "Iced Chocolate",
    price: 139,
    desc: "Rich dark chocolate sauce mixed with chilled milk and ice, topped with cocoa powder dusting.",
    veg: true,
    image: "images/mojito.png",
    customizations: [
      { name: "Vanilla Ice Cream Scoop", price: 30 },
      { name: "Whipped Cream", price: 20 },
      { name: "Oat Milk Substitute", price: 40 }
    ]
  },

  // Desserts
  "classical-sando": {
    name: "Classical Sando",
    price: 79,
    desc: "Fluffy Japanese milk bread (shokupan) filled with sweet, pillowy whipped dairy cream.",
    veg: true,
    image: "images/sando.png",
    customizations: [
      { name: "Extra Whipped Cream", price: 15 },
      { name: "Honey Drizzle", price: 10 }
    ]
  },
  "fruit-sando": {
    name: "Classical Fruit Sando",
    price: 109,
    desc: "Japanese milk bread loaded with thick whipped cream and embedded with fresh strawberries and sweet fruits.",
    veg: true,
    image: "images/sando.png",
    customizations: [
      { name: "Extra Strawberries", price: 25 },
      { name: "Mixed Fruits (Kiwi & Mango)", price: 20 }
    ]
  },

  // Extras
  "extra-cheese": {
    name: "Extra Cheese Addon",
    price: 19,
    desc: "Single slice of processed cheddar cheese.",
    veg: true,
    image: "",
    customizations: []
  },
  "extra-patty": {
    name: "Extra Patty Addon",
    price: 69,
    desc: "Extra seared burger patty of choice (veg/chicken/beef).",
    veg: false,
    image: "",
    customizations: []
  }
};

// --- State Variables ---
let tableOrderCart = [];
let currentSelectedItem = null;
let currentModalQty = 1;

// --- DOM Elements ---
const cartOverlay = document.getElementById('cart-overlay');
const cartDrawer = document.getElementById('cart-drawer');
const cartCounterBtn = document.getElementById('cart-counter-btn');
const closeCartBtn = document.getElementById('close-cart-btn');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartSubtotalEl = document.getElementById('cart-subtotal');
const cartCgstEl = document.getElementById('cart-cgst');
const cartSgstEl = document.getElementById('cart-sgst');
const cartTotalEl = document.getElementById('cart-total');
const btnSubmitOrder = document.getElementById('btn-submit-order');

// Modals
const detailModal = document.getElementById('detail-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalItemName = document.getElementById('modal-item-name');
const modalItemPrice = document.getElementById('modal-item-price');
const modalItemDesc = document.getElementById('modal-item-desc');
const modalItemImage = document.getElementById('modal-item-image');
const modalItemVeg = document.getElementById('modal-item-veg');
const modalOptionsContainer = document.getElementById('modal-options-container');
const modalQtyValue = document.getElementById('modal-qty-value');
const btnQtyMinus = document.getElementById('btn-qty-minus');
const btnQtyPlus = document.getElementById('btn-qty-plus');
const btnModalAdd = document.getElementById('btn-modal-add');

// Success Modal
const orderSuccessModal = document.getElementById('order-success-modal');
const closeSuccessBtn = document.getElementById('close-success-btn');
const printedReceiptId = document.getElementById('printed-receipt-id');
const printedTableNo = document.getElementById('printed-table-no');
const printedTime = document.getElementById('printed-time');
const printedItemsList = document.getElementById('printed-items-list');
const printedTotal = document.getElementById('printed-total');

// Table Sync
const receiptTableInput = document.getElementById('receipt-table-input');
const cartTableSelect = document.getElementById('cart-table-select');
const timeStampEl = document.querySelector('.time-stamp');

// Sound
const typewriterSound = document.getElementById('sound-typewriter');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateLiveClock();
  setInterval(updateLiveClock, 60000); // Update every minute
  animateCardsOnLoad();
});

// --- Dynamic Event Listeners ---
function setupEventListeners() {
  // Navigation Category Filtering and Smooth Scroll
  const navBtns = document.querySelectorAll('.nav-btn:not(.btn-cart-trigger)');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const target = btn.dataset.target;
      filterMenuCategories(target);
    });
  });

  // Open Item Detail Modal on Menu Item click
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const itemId = item.dataset.id;
      openItemModal(itemId);
    });
  });

  // Direct add-ons for Extras
  const btnExtraAdds = document.querySelectorAll('.btn-extra-add');
  btnExtraAdds.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Stop opening the modal
      const extraItemEl = btn.closest('.extra-item');
      const extraId = extraItemEl.dataset.id;
      addDirectExtraToCart(extraId);
    });
  });

  // Cart Drawer open/close
  cartCounterBtn.addEventListener('click', openCartDrawer);
  closeCartBtn.addEventListener('click', closeCartDrawer);
  cartOverlay.addEventListener('click', () => {
    closeCartDrawer();
    closeModal();
    closeSuccessModal();
  });

  // Modal quantity adjustments
  btnQtyPlus.addEventListener('click', () => {
    currentModalQty++;
    modalQtyValue.textContent = currentModalQty;
  });
  
  btnQtyMinus.addEventListener('click', () => {
    if (currentModalQty > 1) {
      currentModalQty--;
      modalQtyValue.textContent = currentModalQty;
    }
  });

  // Close Modals
  closeModalBtn.addEventListener('click', closeModal);
  closeSuccessBtn.addEventListener('click', closeSuccessModal);

  // Add Item to Order from Modal
  btnModalAdd.addEventListener('click', addItemToOrderFromModal);

  // Submit Order / Print Receipt
  btnSubmitOrder.addEventListener('click', submitOrderToKitchen);

  // Table Sync: Receipt card Input updates Drawer Select
  receiptTableInput.addEventListener('input', () => {
    const val = receiptTableInput.value.trim().padStart(2, '0');
    // See if value matches any options
    let found = false;
    for (let i = 0; i < cartTableSelect.options.length; i++) {
      if (cartTableSelect.options[i].value === val) {
        cartTableSelect.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found && val !== '') {
      // If table is a custom number, we can add a temporary option
      const newOpt = new Option(val, val, true, true);
      cartTableSelect.add(newOpt);
    }
  });

  // Table Sync: Drawer Select updates Receipt Card Input
  cartTableSelect.addEventListener('change', () => {
    receiptTableInput.value = cartTableSelect.value;
  });
}

// --- Cardboard Cards Entrance Animations ---
function animateCardsOnLoad() {
  const cards = document.querySelectorAll('.grid-card');
  cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px) scale(0.98)';
    card.style.transition = 'opacity 0.6s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)';
    
    setTimeout(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0) scale(1)';
    }, 100 + index * 60);
  });
}

// --- Menu Navigation Filter ---
function filterMenuCategories(category) {
  const categories = document.querySelectorAll('.menu-category');
  const otherPanels = document.querySelectorAll('.grid-card:not(.menu-category)');
  
  if (category === 'all') {
    // Show everything
    categories.forEach(cat => {
      cat.style.display = 'block';
      cat.style.opacity = '0';
      setTimeout(() => cat.style.opacity = '1', 50);
    });
    otherPanels.forEach(panel => {
      panel.style.display = 'block';
      panel.style.opacity = '0';
      setTimeout(() => panel.style.opacity = '1', 50);
    });
  } else {
    // Hide other categories, keep brand & receipt visible for styling structure, hide doodles
    categories.forEach(cat => {
      if (cat.id === `sec-${category}`) {
        cat.style.display = 'block';
        cat.style.opacity = '1';
        // Smooth scroll to it
        cat.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        cat.style.display = 'none';
      }
    });

    otherPanels.forEach(panel => {
      // Keep brand card and receipt card visible for visual consistency, hide others
      if (panel.classList.contains('card-brand-center') || panel.classList.contains('card-receipt')) {
        panel.style.display = 'block';
        panel.style.opacity = '1';
      } else {
        panel.style.display = 'none';
      }
    });
  }
}

// --- Time Clock Sync ---
function updateLiveClock() {
  const now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0' + minutes : minutes;
  const timeStr = `TIME: ${hours}:${minutes} ${ampm}`;
  timeStampEl.textContent = timeStr;
}

// --- Modal Logic ---
function openItemModal(itemId) {
  const item = MENU_DATA[itemId];
  if (!item) return;

  currentSelectedItem = { id: itemId, ...item };
  currentModalQty = 1;
  modalQtyValue.textContent = currentModalQty;

  // Set Content
  modalItemName.textContent = item.name;
  modalItemPrice.textContent = `₹${item.price}`;
  modalItemDesc.textContent = item.desc;
  
  if (item.image) {
    modalItemImage.src = item.image;
    modalItemImage.alt = `${item.name} watercolor sketch`;
    modalItemImage.style.display = 'block';
  } else {
    modalItemImage.style.display = 'none';
  }

  // Veg Badge
  modalItemVeg.className = `modal-veg-badge food-symbol ${item.veg ? 'veg' : 'nonveg'}`;
  modalItemVeg.title = item.veg ? 'Vegetarian' : 'Non-Vegetarian';

  // Customize Options
  modalOptionsContainer.innerHTML = '';
  if (item.customizations && item.customizations.length > 0) {
    item.customizations.forEach(opt => {
      const label = document.createElement('label');
      label.className = 'custom-checkbox';
      label.innerHTML = `
        <input type="checkbox" value="${opt.name}" data-price="${opt.price}">
        <span>${opt.name} (+₹${opt.price})</span>
      `;
      modalOptionsContainer.appendChild(label);
    });
    document.querySelector('.modal-customizations').style.display = 'block';
  } else {
    document.querySelector('.modal-customizations').style.display = 'none';
  }

  // Show Modal
  detailModal.classList.add('active');
  cartOverlay.classList.add('active');
}

function closeModal() {
  detailModal.classList.remove('active');
  if (!cartDrawer.classList.contains('active') && !orderSuccessModal.classList.contains('active')) {
    cartOverlay.classList.remove('active');
  }
}

// --- Waiter Cart & Order pad drawer Logic ---
function openCartDrawer() {
  cartDrawer.classList.add('active');
  cartOverlay.classList.add('active');
  renderCart();
}

function closeCartDrawer() {
  cartDrawer.classList.remove('active');
  if (!detailModal.classList.contains('active') && !orderSuccessModal.classList.contains('active')) {
    cartOverlay.classList.remove('active');
  }
}

function addDirectExtraToCart(extraId) {
  const extra = MENU_DATA[extraId];
  if (!extra) return;

  const existing = tableOrderCart.find(i => i.id === extraId && i.customizations.length === 0);
  if (existing) {
    existing.quantity++;
  } else {
    tableOrderCart.push({
      id: extraId,
      name: extra.name,
      basePrice: extra.price,
      price: extra.price,
      quantity: 1,
      customizations: []
    });
  }
  
  updateCartBadge();
  animateCartButton();
  showToast(`Added ${extra.name} to Waiter Pad`);
}

function addItemToOrderFromModal() {
  if (!currentSelectedItem) return;

  // Gather customizations
  const checkedBoxes = modalOptionsContainer.querySelectorAll('input[type="checkbox"]:checked');
  const customs = [];
  let extraCost = 0;
  
  checkedBoxes.forEach(cb => {
    customs.push(cb.value);
    extraCost += parseFloat(cb.dataset.price);
  });

  const unitPrice = currentSelectedItem.price + extraCost;

  // Check if identical item with identical customizations already exists in cart
  const existingIndex = tableOrderCart.findIndex(item => {
    if (item.id !== currentSelectedItem.id) return false;
    if (item.customizations.length !== customs.length) return false;
    return customs.every(c => item.customizations.includes(c));
  });

  if (existingIndex > -1) {
    tableOrderCart[existingIndex].quantity += currentModalQty;
  } else {
    tableOrderCart.push({
      id: currentSelectedItem.id,
      name: currentSelectedItem.name,
      basePrice: currentSelectedItem.price,
      price: unitPrice,
      quantity: currentModalQty,
      customizations: customs
    });
  }

  updateCartBadge();
  closeModal();
  animateCartButton();
  
  // Show drawer immediately to let them see their waiter pad addition
  setTimeout(openCartDrawer, 300);
}

function updateCartQty(index, change) {
  tableOrderCart[index].quantity += change;
  if (tableOrderCart[index].quantity <= 0) {
    tableOrderCart.splice(index, 1);
  }
  updateCartBadge();
  renderCart();
}

function removeCartItem(index) {
  tableOrderCart.splice(index, 1);
  updateCartBadge();
  renderCart();
}

function updateCartBadge() {
  const totalQty = tableOrderCart.reduce((sum, item) => sum + item.quantity, 0);
  const badges = document.querySelectorAll('.cart-badge');
  badges.forEach(b => {
    b.textContent = totalQty;
    if (totalQty > 0) {
      b.style.display = 'flex';
    } else {
      b.style.display = 'none';
    }
  });
}

function renderCart() {
  cartItemsContainer.innerHTML = '';
  
  if (tableOrderCart.length === 0) {
    cartItemsContainer.innerHTML = '<p class="empty-cart-msg">No items added to the table order pad yet. Click on any menu item above to add!</p>';
    cartSubtotalEl.textContent = '0';
    cartCgstEl.textContent = '0';
    cartSgstEl.textContent = '0';
    cartTotalEl.textContent = '0';
    return;
  }

  let subtotal = 0;
  
  tableOrderCart.forEach((item, index) => {
    const itemCost = item.price * item.quantity;
    subtotal += itemCost;

    const row = document.createElement('div');
    row.className = 'cart-item-row';
    
    let customsHtml = '';
    if (item.customizations.length > 0) {
      customsHtml = `<span class="cart-item-customs">+ ${item.customizations.join(', ')}</span>`;
    }

    row.innerHTML = `
      <div class="cart-item-info">
        <span class="cart-item-name">${item.name}</span>
        ${customsHtml}
      </div>
      <div class="cart-item-actions">
        <div class="cart-qty-ctrl">
          <button class="btn-qty-mini" onclick="updateCartQty(${index}, -1)">-</button>
          <span>${item.quantity}</span>
          <button class="btn-qty-mini" onclick="updateCartQty(${index}, 1)">+</button>
        </div>
        <span class="cart-item-price">₹${itemCost}</span>
        <button class="btn-remove-item" onclick="removeCartItem(${index})" aria-label="Remove item">&times;</button>
      </div>
    `;
    cartItemsContainer.appendChild(row);
  });

  const cgst = Math.round(subtotal * 0.025);
  const sgst = Math.round(subtotal * 0.025);
  const total = subtotal + cgst + sgst;

  cartSubtotalEl.textContent = subtotal;
  cartCgstEl.textContent = cgst;
  cartSgstEl.textContent = sgst;
  cartTotalEl.textContent = total;
}

// --- Micro-animations ---
function animateCartButton() {
  cartCounterBtn.style.transform = 'scale(1.2)';
  setTimeout(() => {
    cartCounterBtn.style.transform = 'translateY(-2px)';
  }, 200);
}

// --- Simple Toast Notifications ---
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'paper-texture toast-msg';
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%) translateY(100px)';
  toast.style.padding = '10px 24px';
  toast.style.fontFamily = "var(--font-special)";
  toast.style.fontSize = '0.9rem';
  toast.style.zIndex = '9999';
  toast.style.border = '2px solid var(--color-ink-dark)';
  toast.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
  toast.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
  
  // Custom paper styling
  toast.style.background = 'var(--color-paper-light)';
  toast.style.color = 'var(--color-ink-dark)';
  
  document.body.appendChild(toast);
  
  // Slide up
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
  }, 50);

  // Fade and slide down out
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(100px)';
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 2500);
}

// --- Order Submission ---
function submitOrderToKitchen() {
  if (tableOrderCart.length === 0) {
    showToast("Please add items to your table order pad first!");
    return;
  }

  // Play retro typewriter sound
  try {
    typewriterSound.volume = 0.5;
    typewriterSound.currentTime = 0;
    typewriterSound.play();
  } catch(e) {
    console.log("Audio play blocked by browser sandbox");
  }

  // Generate Receipt Data
  const tableNo = receiptTableInput.value || "04";
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const randomReceiptId = "#404-" + Math.floor(100000 + Math.random() * 900000);

  // Set text fields in receipt modal
  printedReceiptId.textContent = randomReceiptId;
  printedTableNo.textContent = tableNo;
  printedTime.textContent = timeStr;

  // List items
  printedItemsList.innerHTML = '';
  let subtotal = 0;
  tableOrderCart.forEach(item => {
    const cost = item.price * item.quantity;
    subtotal += cost;
    const itemLine = document.createElement('div');
    itemLine.className = 'printed-item-line';
    
    let subInfo = '';
    if (item.customizations.length > 0) {
      subInfo = ` (${item.customizations.join(', ')})`;
    }
    
    itemLine.innerHTML = `
      <span>${item.quantity}x ${item.name}${subInfo}</span>
      <span>₹${cost}</span>
    `;
    printedItemsList.appendChild(itemLine);
  });

  const cgst = Math.round(subtotal * 0.025);
  const sgst = Math.round(subtotal * 0.025);
  const total = subtotal + cgst + sgst;
  printedTotal.textContent = total;

  // Clean state
  tableOrderCart = [];
  updateCartBadge();
  closeCartDrawer();

  // Show success receipt
  orderSuccessModal.classList.add('active');
  cartOverlay.classList.add('active');
}

function closeSuccessModal() {
  orderSuccessModal.classList.remove('active');
  cartOverlay.classList.remove('active');
}

// Expose functions to global window scope for inline HTML onclick handlers
window.updateCartQty = updateCartQty;
window.removeCartItem = removeCartItem;

