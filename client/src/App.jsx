import React, { useState, useEffect, useRef } from 'react';

// --- API Configuration ---
// Automatically detect development mode vs production serving
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000' 
  : '';

// --- Local Backup Data (Defensive Fallback) ---
const BACKUP_MENU = [
  { itemId: "veg-burger", name: "Classic Veg Burger", price: 89, desc: "Veg Patty, Lettuce, Pickles, Onion, Secret Sauce", veg: true, category: "burgers", image: "images/burger.png", customizations: [{ name: "Extra Cheese", price: 19 }, { name: "Extra Veg Patty", price: 50 }, { name: "Make it Spicy", price: 0 }] },
  { itemId: "chicken-burger", name: "Classic Chicken Burger", price: 99, desc: "Chicken Patty, Egg, Lettuce, Pickles, Onion, Secret Sauce", veg: false, category: "burgers", image: "images/burger.png", customizations: [{ name: "Extra Cheese", price: 19 }, { name: "Double Chicken Patty", price: 60 }, { name: "Extra Egg", price: 15 }] },
  { itemId: "beef-burger", name: "Classic Beef Burger", price: 149, desc: "Beef Patty, Egg, Lettuce, Pickles, Onion, Secret Sauce", veg: false, category: "burgers", image: "images/burger.png", customizations: [{ name: "Extra Cheese", price: 19 }, { name: "Double Beef Patty", price: 69 }, { name: "Extra Egg", price: 15 }] },
  { itemId: "smashed-beef", name: "Smashed Beef Burger", price: 189, desc: "Smashed Beef Patty, Cheese, Egg, Pickles, Caramelized Onion, Secret Sauce", veg: false, category: "burgers", image: "images/burger.png", customizations: [{ name: "Extra Cheese", price: 19 }, { name: "Double Smashed Patty", price: 69 }, { name: "Jalapenos", price: 10 }] },
  { itemId: "double-smashed", name: "Double Smashed Beef", price: 219, desc: "Double Smashed Beef Patties, Cheese, Egg, Pickles, Caramelized Onion, Secret Sauce", veg: false, category: "burgers", image: "images/burger.png", customizations: [{ name: "Extra Cheese Slice", price: 19 }, { name: "Bacon Strips", price: 49 }, { name: "Extra Egg", price: 15 }] },
  { itemId: "oklahoma-smashed", name: "Oklahoma Smashed", price: 249, desc: "Smashed Beef Patty, Cheese, Egg, Pickles, Smashed Onion, Secret Sauce", veg: false, category: "burgers", image: "images/burger.png", customizations: [{ name: "Double Beef Patty", price: 69 }, { name: "Extra Cheese", price: 19 }, { name: "Spicy Mayo", price: 0 }] },
  { itemId: "mojito-ultra", name: "Mojito Ultra", price: 99, desc: "Mint, Lime, Blue Curacao, Soda", veg: true, category: "drinks", image: "images/mojito.png", customizations: [{ name: "Extra Mint & Lime", price: 0 }, { name: "Less Sweet", price: 0 }, { name: "Double Curacao Syrup", price: 15 }] },
  { itemId: "iced-latte", name: "Iced Latte", price: 129, desc: "Milk, Espresso, Ice", veg: true, category: "drinks", image: "images/mojito.png", customizations: [{ name: "Extra Espresso Shot", price: 30 }, { name: "Almond Milk Substitute", price: 40 }, { name: "Vanilla Syrup", price: 15 }] },
  { itemId: "iced-chocolate", name: "Iced Chocolate", price: 139, desc: "Chocolate, Milk, Ice", veg: true, category: "drinks", image: "images/mojito.png", customizations: [{ name: "Vanilla Ice Cream Scoop", price: 30 }, { name: "Whipped Cream", price: 20 }, { name: "Oat Milk Substitute", price: 40 }] },
  { itemId: "classical-sando", name: "Classical Sando", price: 79, desc: "Soft milk bread, whipped cream, classic filling", veg: true, category: "desserts", image: "images/sando.png", customizations: [{ name: "Extra Whipped Cream", price: 15 }, { name: "Honey Drizzle", price: 10 }] },
  { itemId: "fruit-sando", name: "Classical Fruit Sando", price: 109, desc: "Soft milk bread, whipped cream, fresh fruits", veg: true, category: "desserts", image: "images/sando.png", customizations: [{ name: "Extra Strawberries", price: 25 }, { name: "Mixed Fruits (Kiwi & Mango)", price: 20 }] },
  { itemId: "extra-cheese", name: "Cheese", price: 19, desc: "Cheese slice addon", veg: true, category: "extras", customizations: [] },
  { itemId: "extra-patty", name: "Patty", price: 69, desc: "Burger patty addon", veg: false, category: "extras", customizations: [] }
];

function App() {
  // --- States ---
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [tableNo, setTableNo] = useState('04');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalQty, setModalQty] = useState(1);

  const [cartOpen, setCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [liveTime, setLiveTime] = useState('TIME: TIME UNKNOWN !');

  // Ref for typewriter audio sound
  const audioRef = useRef(null);

  // --- Live Clock ---
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      let minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      minutes = minutes < 10 ? '0' + minutes : minutes;
      setLiveTime(`TIME: ${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // --- Fetch Menu Database ---
  useEffect(() => {
    fetch(`${API_BASE}/api/menu`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load DB menu");
        return res.json();
      })
      .then(data => {
        if (data && data.length > 0) {
          setMenuItems(data);
        } else {
          setMenuItems(BACKUP_MENU);
        }
      })
      .catch(err => {
        console.warn("API loading failed. Using local mockup fallback.", err);
        setMenuItems(BACKUP_MENU);
      });
  }, []);

  // --- Toast Trigger Helper ---
  const triggerToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // --- Direct Add-on (Extras) ---
  const handleDirectExtraAdd = (extraItem) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === extraItem.itemId && item.customizations.length === 0);
      if (existing) {
        return prev.map(item => 
          item.id === extraItem.itemId && item.customizations.length === 0
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, {
          id: extraItem.itemId,
          name: extraItem.name,
          price: extraItem.price,
          basePrice: extraItem.price,
          quantity: 1,
          customizations: []
        }];
      }
    });
    triggerToast(`Added ${extraItem.name} to Waiter Pad`);
  };

  // --- Modal Quantity controls ---
  const adjustModalQty = (val) => {
    setModalQty(prev => Math.max(1, prev + val));
  };

  const handleOpenItemModal = (item) => {
    setSelectedItem(item);
    setModalQty(1);
  };

  // --- Add item from modal into Cart ---
  const handleAddItemFromModal = () => {
    if (!selectedItem) return;

    const unitPrice = selectedItem.price;
    const customsList = [];

    setCart(prev => {
      const existingIdx = prev.findIndex(item => 
        item.id === selectedItem.itemId &&
        item.customizations.length === 0
      );

      if (existingIdx > -1) {
        return prev.map((item, idx) => 
          idx === existingIdx
            ? { ...item, quantity: item.quantity + modalQty }
            : item
        );
      } else {
        return [...prev, {
          id: selectedItem.itemId,
          name: selectedItem.name,
          price: unitPrice,
          basePrice: selectedItem.price,
          quantity: modalQty,
          customizations: customsList
        }];
      }
    });

    setSelectedItem(null);
    setCartOpen(true); // show cart right away
  };

  // --- Cart Drawer Item Updates ---
  const handleUpdateCartQty = (index, change) => {
    setCart(prev => {
      const updated = prev.map((item, idx) => 
        idx === index ? { ...item, quantity: item.quantity + change } : item
      );
      return updated.filter(item => item.quantity > 0);
    });
  };

  const handleRemoveCartItem = (index) => {
    setCart(prev => prev.filter((_, idx) => idx !== index));
  };

  // --- Cart Math Computations ---
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCgst = Math.round(cartSubtotal * 0.025);
  const cartSgst = Math.round(cartSubtotal * 0.025);
  const cartTotal = cartSubtotal + cartCgst + cartSgst;
  const cartBadgeCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // --- Submit Order to Express + Mongo DB ---
  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      triggerToast("Please add items to your table order pad first!");
      return;
    }

    // Play retro typewriter audio
    if (audioRef.current) {
      try {
        audioRef.current.volume = 0.5;
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      } catch (e) {
        console.log("Audio play blocked by browser context");
      }
    }

    const orderBody = {
      tableNo,
      time: liveTime.replace('TIME: ', ''),
      items: cart,
      subtotal: cartSubtotal,
      cgst: cartCgst,
      sgst: cartSgst,
      total: cartTotal
    };

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderBody)
      });
      if (!res.ok) throw new Error("Order creation failed");
      const savedOrder = await res.json();
      
      // Save order state, clear cart, open success modal
      setOrderSuccess(savedOrder);
      setCart([]);
      setCartOpen(false);
    } catch (err) {
      console.error("Order submission failed:", err);
      // Fallback local mockup order creation on error
      const mockSavedOrder = {
        orderId: '#404-' + Math.floor(100000 + Math.random() * 900000),
        tableNo,
        time: liveTime.replace('TIME: ', ''),
        items: cart,
        total: cartTotal
      };
      setOrderSuccess(mockSavedOrder);
      setCart([]);
      setCartOpen(false);
      triggerToast("Server offline. Mock order printed!");
    }
  };

  // --- Filter and Category management ---
  const activeItems = menuItems.filter(item => {
    if (activeCategory === 'all') return true;
    return item.category === activeCategory;
  });

  const getCategoryItems = (cat) => menuItems.filter(item => item.category === cat);

  return (
    <>
      {/* Audio Sound Component */}
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2453/2453-84.wav" preload="auto"></audio>

      {/* SVG Warp / distortion and Paper texture filters */}
      <svg width="0" height="0" className="svg-filters" aria-hidden="true">
        <defs>
          <filter id="rough-edge">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* Chalkboard Slate background and animated doodles */}
      <div className="chalkboard-bg">
        <div className="chalk-doodles">
          <svg className="doodle cup" viewBox="0 0 100 100">
            <path d="M30 40 h40 v30 c0 10 -10 15 -20 15 s-20 -5 -20 -15 z" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="3 3"/>
            <path d="M70 45 c5 0 10 3 10 8 s-5 8 -10 8" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="2 2"/>
            <path className="steam steam-1" d="M40 30 c-2 -5 2 -10 0 -15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/>
            <path className="steam steam-2" d="M50 32 c1 -5 -2 -10 1 -15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/>
            <path className="steam steam-3" d="M60 30 c-1 -5 1 -10 -1 -15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/>
          </svg>
          <svg className="doodle stars" viewBox="0 0 100 100">
            <path d="M10 20 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="rgba(255,255,255,0.15)"/>
            <path d="M80 50 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 l3 -1 z" fill="rgba(255,255,255,0.1)"/>
            <path d="M50 85 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 z" fill="rgba(255,255,255,0.15)"/>
          </svg>
        </div>
      </div>

      <div className="app-container">
        
        {/* Navigation Categories Header */}
        <nav className="quick-nav">
          <button 
            className={`nav-btn ${activeCategory === 'all' ? 'active' : ''}`} 
            onClick={() => setActiveCategory('all')}
          >
            All
          </button>
          <button 
            className={`nav-btn ${activeCategory === 'burgers' ? 'active' : ''}`} 
            onClick={() => setActiveCategory('burgers')}
          >
            Burgers
          </button>
          <button 
            className={`nav-btn ${activeCategory === 'drinks' ? 'active' : ''}`} 
            onClick={() => setActiveCategory('drinks')}
          >
            Drinks
          </button>
          <button 
            className={`nav-btn ${activeCategory === 'desserts' ? 'active' : ''}`} 
            onClick={() => setActiveCategory('desserts')}
          >
            Desserts
          </button>
          
          <button className="nav-btn btn-cart-trigger" onClick={() => setCartOpen(true)}>
            Order List <span className="cart-badge">{cartBadgeCount}</span>
          </button>
        </nav>

        {/* Dynamic Masonry-like Grid Layout */}
        <main className="grid-layout">
          
          {/* COLUMN 1: Burgers */}
          {(activeCategory === 'all' || activeCategory === 'burgers') && (
            <section className="grid-card card-burgers menu-category">
              <div className="card-inner paper-texture">
                
                {/* Stamp */}
                <div className="stamp-badge badge-fresh">
                  <svg viewBox="0 0 100 100">
                    <path id="badge-text-path" d="M 15 50 A 35 35 0 1 1 85 50 A 35 35 0 1 1 15 50" fill="none"/>
                    <text fill="#C27129" fontFamily="'Bebas Neue'" fontSize="12" letterSpacing="2">
                      <textPath href="#badge-text-path" startOffset="0%">• FRESH • TO • ORDER • FRESH • TO • ORDER </textPath>
                    </text>
                  </svg>
                  <div className="stamp-inner"><span>NOW</span></div>
                </div>

                <h2 className="category-title">BURGERS</h2>
                <span className="category-subtitle">FOR HUNGER</span>

                <div className="menu-items">
                  {getCategoryItems('burgers').map(item => (
                    <div 
                      key={item.itemId} 
                      className="menu-item" 
                      onClick={() => handleOpenItemModal(item)}
                    >
                      <div className="item-header">
                        <span className="item-name">
                          {item.name}
                          <span className={`food-symbol ${item.veg ? 'veg' : 'nonveg'}`} title={item.veg ? 'Vegetarian' : 'Non-Vegetarian'}></span>
                        </span>
                        <span className="item-dots"></span>
                        <span className="item-price">{item.price}</span>
                      </div>
                      <p className="item-desc">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="illustration-container burger-ill">
                  <img src="/images/burger.png" alt="Double Smashed Burger watercolor sketch" className="food-ill" />
                </div>
              </div>
            </section>
          )}

          {/* COLUMN 2 TOP: Good Food Blackboard Quote */}
          {activeCategory === 'all' && (
            <section className="grid-card chalkboard-panel panel-quote-top">
              <div className="chalkboard-inner">
                <p className="quote-text">GOOD FOOD.</p>
                <p className="quote-text">GOOD MOOD.</p>
                <p className="quote-text">BETTER PEOPLE.</p>
                <p className="quote-text highlighted">THAT'S THE RECIPE. <span className="dot-orange"></span></p>
              </div>
            </section>
          )}

          {/* COLUMN 2 MIDDLE: Logo Card */}
          <section className="grid-card card-brand-center">
            <div className="card-inner paper-texture text-center">
              <h1 className="brand-logo">404</h1>
              <h2 className="brand-sublogo">C A F É <span className="dot-orange"></span></h2>
              <div className="divider-line"></div>
              <p className="brand-quote">LOST? YOU FOUND THE RIGHT PLACE.</p>
            </div>
          </section>

          {/* COLUMN 2 SKETCH: Blackboard Star Window */}
          {activeCategory === 'all' && (
            <section className="grid-card chalkboard-panel panel-sketch-window">
              <div className="chalkboard-inner flex-center">
                <svg className="sketch-window-svg" viewBox="0 0 100 120" width="80" height="96">
                  <path d="M20 100 V40 A30 30 0 0 1 80 40 V100 Z" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/>
                  <path d="M20 70 H80" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="2 2"/>
                  <path d="M50 40 V100" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="2 2"/>
                  <path d="M35 25 A 6 6 0 0 1 45 31 A 8 8 0 0 0 35 25" fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                  <circle cx="65" cy="20" r="1" fill="#fff" opacity="0.6"/>
                  <circle cx="58" cy="28" r="1.5" fill="#fff" opacity="0.8"/>
                  <rect x="42" y="90" width="16" height="10" rx="2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)"/>
                  <path d="M58 92 c2 0 4 1 4 3 s-2 3 -4 3" fill="none" stroke="rgba(255,255,255,0.3)"/>
                  <path d="M47 85 q2 -4 -1 -8" fill="none" stroke="rgba(255,255,255,0.2)"/>
                  <path d="M52 86 q-1 -4 2 -8" fill="none" stroke="rgba(255,255,255,0.2)"/>
                </svg>
              </div>
            </section>
          )}

          {/* COLUMN 2 BOTTOM: Desserts */}
          {(activeCategory === 'all' || activeCategory === 'desserts') && (
            <section className="grid-card card-desserts menu-category">
              <div className="card-inner paper-texture">
                <div className="stamp-badge badge-sweet">
                  <span>SWEET<br/>ENDINGS</span>
                </div>

                <h2 className="category-title">DESSERTS</h2>
                <span className="category-subtitle">FOR A LITTLE COMFORT</span>

                <div className="menu-items">
                  {getCategoryItems('desserts').map(item => (
                    <div 
                      key={item.itemId} 
                      className="menu-item" 
                      onClick={() => handleOpenItemModal(item)}
                    >
                      <div className="item-header">
                        <span className="item-name">
                          {item.name}
                          <span className="food-symbol veg" title="Vegetarian"></span>
                        </span>
                        <span className="item-dots"></span>
                        <span className="item-price">{item.price}</span>
                      </div>
                      <p className="item-desc">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="illustration-container sando-ill">
                  <img src="/images/sando.png" alt="Strawberry fruit sando sketch" className="food-ill" />
                </div>
              </div>
            </section>
          )}

          {/* COLUMN 3 TOP: Diner Receipt Table Selector */}
          <section className="grid-card card-receipt">
            <div className="card-inner paper-texture receipt-style">
              <div className="receipt-header">
                <div className="receipt-row font-special">
                  <span>
                    TABLE NO.&nbsp;
                    <input 
                      type="text" 
                      value={tableNo} 
                      onChange={(e) => setTableNo(e.target.value)}
                      className="receipt-input" 
                      maxLength="4" 
                      aria-label="Table Number"
                    />
                  </span>
                  <span className="time-stamp">{liveTime}</span>
                </div>
                <div className="receipt-title-block">
                  <h3 className="receipt-brand">404 CAFÉ <span className="dot-orange"></span></h3>
                  <p className="receipt-tagline">YOUR PLACE. ANYTIME. NO RUSH. JUST REAL.</p>
                </div>
                <div className="receipt-location font-special">
                  <p className="loc-pin"><span className="pin-icon">📍</span> MUTHOOR, THIRUVALLA <span className="dot-orange-small"></span></p>
                  <p className="address-details">Opp to Bajaj Showroom, Kaduvettoor Building, SH 1</p>
                </div>
              </div>
            </div>
          </section>

          {/* COLUMN 3 MIDDLE: Drinks */}
          {(activeCategory === 'all' || activeCategory === 'drinks') && (
            <section className="grid-card card-drinks menu-category">
              <div className="card-inner paper-texture">
                <h2 className="category-title">DRINKS</h2>
                <span className="category-subtitle">FOR LONG CONVERSATIONS</span>

                <div className="menu-items">
                  {getCategoryItems('drinks').map(item => (
                    <div 
                      key={item.itemId} 
                      className="menu-item" 
                      onClick={() => handleOpenItemModal(item)}
                    >
                      <div className="item-header">
                        <span className="item-name">
                          {item.name}
                          {item.veg && <span className="food-symbol veg" title="Vegetarian"></span>}
                        </span>
                        <span className="item-dots"></span>
                        <span className="item-price">{item.price}</span>
                      </div>
                      <p className="item-desc">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="illustration-container mojito-ill">
                  <img src="/images/mojito.png" alt="Mojito glass sketch" className="food-ill" />
                </div>
              </div>
            </section>
          )}

          {/* COLUMN 3 EXTRAS */}
          {activeCategory === 'all' && (
            <section className="grid-card card-extras">
              <div className="card-inner paper-texture">
                <h2 className="category-title-small">EXTRAS</h2>
                <div className="extras-list">
                  {getCategoryItems('extras').map(item => (
                    <div key={item.itemId} className="extra-item">
                      <span className="extra-name">{item.name}</span>
                      <span className="extra-dots"></span>
                      <span className="extra-price">{item.price}</span>
                      <button 
                        className="btn-extra-add" 
                        onClick={() => handleDirectExtraAdd(item)}
                        aria-label={`Add ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* COLUMN 3 BOTTOM: Blackboard Quote */}
          {activeCategory === 'all' && (
            <section className="grid-card chalkboard-panel panel-quote-bottom">
              <div className="chalkboard-inner quote-bottom">
                <p className="quote-symbol">“</p>
                <p className="quote-line">THE BEST NIGHTS</p>
                <p className="quote-line">AREN'T PLANNED.</p>
                <p className="quote-line">THEY JUST HAPPEN</p>
                <p className="quote-line highlighted">OVER GOOD FOOD.</p>
                <p className="quote-line">AND REAL CONVERSATIONS.</p>
                <p className="quote-symbol quote-end">”</p>
              </div>
            </section>
          )}

        </main>

        <footer className="site-footer">
          <p>&copy; 2026 404 Café. All rights reserved. Configured with MERN Stack database engines.</p>
        </footer>
      </div>

      {/* --- CART PAD DRAWER --- */}
      <div 
        className={`cart-drawer-overlay ${cartOpen ? 'active' : ''}`} 
        onClick={() => setCartOpen(false)}
      ></div>
      <aside className={`cart-drawer paper-texture ${cartOpen ? 'active' : ''}`}>
        <div className="drawer-header">
          <h3 className="drawer-title font-special">WAITER'S PAD</h3>
          <button className="btn-close-drawer" onClick={() => setCartOpen(false)}>&times;</button>
        </div>

        <div className="drawer-table-sync font-special">
          <span>TABLE NO:</span>
          <select 
            value={tableNo} 
            onChange={(e) => setTableNo(e.target.value)}
            className="table-select"
            aria-label="Select Table"
          >
            <option value="01">01</option>
            <option value="02">02</option>
            <option value="03">03</option>
            <option value="04">04</option>
            <option value="05">05</option>
            <option value="06">06</option>
            <option value="07">07</option>
            <option value="08">08</option>
            <option value="Takeaway">Takeaway</option>
          </select>
        </div>

        <div className="order-sheet">
          <div className="sheet-lines">
            {cart.length === 0 ? (
              <p className="empty-cart-msg">No items added to the table order pad yet. Click on any menu item above to add!</p>
            ) : (
              cart.map((item, index) => (
                <div key={`${item.id}-${index}`} className="cart-item-row">
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.name}</span>
                    {item.customizations.length > 0 && (
                      <span className="cart-item-customs">+ {item.customizations.join(', ')}</span>
                    )}
                  </div>
                  <div className="cart-item-actions">
                    <div className="cart-qty-ctrl">
                      <button className="btn-qty-mini" onClick={() => handleUpdateCartQty(index, -1)}>-</button>
                      <span>{item.quantity}</span>
                      <button className="btn-qty-mini" onClick={() => handleUpdateCartQty(index, 1)}>+</button>
                    </div>
                    <span className="cart-item-price">₹{item.price * item.quantity}</span>
                    <button className="btn-remove-item" onClick={() => handleRemoveCartItem(index)}>&times;</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="drawer-footer">
          <div className="price-summary font-special">
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>₹{cartSubtotal}</span>
            </div>
            <div className="summary-row">
              <span>CGST (2.5%):</span>
              <span>₹{cartCgst}</span>
            </div>
            <div className="summary-row">
              <span>SGST (2.5%):</span>
              <span>₹{cartSgst}</span>
            </div>
            <div className="summary-row total-row">
              <span>TOTAL:</span>
              <span>₹{cartTotal}</span>
            </div>
          </div>
          
          <button className="btn-submit-order" onClick={handleSubmitOrder}>
            <span>SEND TO KITCHEN</span>
            <svg className="icon-chef" viewBox="0 0 24 24" width="18" height="18">
              <path d="M12 2c1.1 0 2 .9 2 2v2h-4V4c0-1.1.9-2 2-2zm6.2 8.3c-.6-.4-1.2-.7-2-1V7H7.8v2.3c-.8.3-1.4.6-2 1C4.3 11 3.5 12.4 3.5 14c0 3.3 2.7 6 6 6h5c3.3 0 6-2.7 6-6 0-1.6-.8-3-2.3-3.7zM10 18H8v-2h2v2zm3 0h-2v-2h2v2zm3 0h-2v-2h2v2z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* --- ITEM CUSTOMIZE MODAL --- */}
      {selectedItem && (
        <div className="modal-overlay active" onClick={() => setSelectedItem(null)}>
          <div className="modal-content paper-texture" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close-modal" onClick={() => setSelectedItem(null)}>&times;</button>
            
            <div className="modal-layout">
              <div className="modal-visual">
                {selectedItem.image ? (
                  <img src={`/${selectedItem.image}`} alt={selectedItem.name} className="modal-img" />
                ) : (
                  <div style={{ height: '100px' }} />
                )}
                <span className={`modal-veg-badge food-symbol ${selectedItem.veg ? 'veg' : 'nonveg'}`}></span>
              </div>
              
              <div className="modal-info">
                <h3 className="modal-item-title">{selectedItem.name}</h3>
                <span className="modal-item-price">₹{selectedItem.price}</span>
                <p className="modal-item-description">{selectedItem.desc}</p>
                
                <div className="divider-line"></div>
                


                <div className="modal-actions">
                  <div className="quantity-selector">
                    <button className="qty-btn" onClick={() => adjustModalQty(-1)}>-</button>
                    <span className="qty-val">{modalQty}</span>
                    <button className="qty-btn" onClick={() => adjustModalQty(1)}>+</button>
                  </div>
                  <button className="btn-add-to-order" onClick={handleAddItemFromModal}>
                    ADD TO TABLE ORDER
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ORDER PRINT SUCCESS RECEIPT --- */}
      {orderSuccess && (
        <div className="modal-overlay active" onClick={() => setOrderSuccess(null)}>
          <div className="modal-content receipt-success paper-texture" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close-modal" onClick={() => setOrderSuccess(null)}>&times;</button>
            
            <div className="success-header">
              <div className="success-checkmark">
                <svg viewBox="0 0 52 52">
                  <circle className="success-circle" cx="26" cy="26" r="25" fill="none"/>
                  <path className="success-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
              </div>
              <h3 className="success-title font-special">ORDER SENT TO KITCHEN!</h3>
              <p className="success-subtitle">A waiter will bring your items shortly.</p>
            </div>

            <div className="divider-line dashed"></div>

            <div className="printed-receipt font-special">
              <div className="receipt-print-row">
                <span>RECEIPT ID:</span>
                <span>{orderSuccess.orderId}</span>
              </div>
              <div className="receipt-print-row">
                <span>TABLE:</span>
                <span>{orderSuccess.tableNo}</span>
              </div>
              <div className="receipt-print-row">
                <span>TIME:</span>
                <span>{orderSuccess.time}</span>
              </div>

              <div className="divider-line dashed text-center">ITEMS</div>
              
              <div className="printed-items">
                {orderSuccess.items.map((item, idx) => (
                  <div key={idx} className="printed-item-line">
                    <span>
                      {item.quantity}x {item.name}
                      {item.customizations.length > 0 && ` (${item.customizations.join(', ')})`}
                    </span>
                    <span>₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="divider-line dashed"></div>

              <div className="receipt-print-row receipt-grand-total">
                <span>GRAND TOTAL:</span>
                <span>₹{orderSuccess.total}</span>
              </div>
            </div>

            <div className="divider-line dashed"></div>

            <div className="qr-code-section text-center">
              <p className="qr-text">Scan to pay or add more items</p>
              <div className="qr-placeholder">
                <svg viewBox="0 0 100 100" className="qr-svg">
                  <rect x="10" y="10" width="25" height="25" fill="none" stroke="#1D1D1C" stroke-width="6"/>
                  <rect x="15" y="15" width="15" height="15" fill="#1D1D1C"/>
                  <rect x="65" y="10" width="25" height="25" fill="none" stroke="#1D1D1C" stroke-width="6"/>
                  <rect x="70" y="15" width="15" height="15" fill="#1D1D1C"/>
                  <rect x="10" y="65" width="25" height="25" fill="none" stroke="#1D1D1C" stroke-width="6"/>
                  <rect x="15" y="70" width="15" height="15" fill="#1D1D1C"/>
                  <rect x="45" y="15" width="8" height="8" fill="#1D1D1C"/>
                  <rect x="53" y="23" width="8" height="8" fill="#1D1D1C"/>
                  <rect x="45" y="38" width="15" height="8" fill="#1D1D1C"/>
                  <rect x="75" y="45" width="15" height="8" fill="#1D1D1C"/>
                  <rect x="45" y="65" width="8" height="20" fill="#1D1D1C"/>
                  <rect x="58" y="75" width="15" height="8" fill="#1D1D1C"/>
                  <rect x="78" y="65" width="8" height="18" fill="#1D1D1C"/>
                  <rect x="15" y="45" width="12" height="8" fill="#1D1D1C"/>
                </svg>
              </div>
              <p className="qr-footer">Thank you for dining at 404 Café!</p>
            </div>
          </div>
        </div>
      )}

      {/* --- Live Toast popup --- */}
      {toastMsg && (
        <div className="toast-msg paper-texture">
          {toastMsg}
        </div>
      )}
    </>
  );
}

export default App;
