# 404 Café | MERN Stack Digital Menu Website

A premium, highly interactive, and responsive digital menu web application designed for **404 Café** (Muthoor, Thiruvalla). This project replicates the beautiful cardboard/kraft paper and dark chalkboard aesthetics of the physical menu, providing an immersive, tactile digital dining experience.

---

## 🎨 Visual Design Features
* **Kraft Cardboard Simulation**: Individual cards are styled with warm beige gradients and layered with custom SVG noise filters to emulate organic paper grain.
* **Hand-Drawn Sketch Borders**: Inside card borders are processed through an SVG displacement filter (`feTurbulence` + `feDisplacementMap`) to create realistic, shaky, hand-drawn sketch outlines.
* **Chalkboard Background Doodles**: The slate-colored chalkboard backdrop contains animated floating chalk steam rising from cups, stars, and chalk writing.
* **Watercolor Food Illustrations**: Features custom generated watercolor food illustrations (Double Smashed Burger, Mojito Ultra, and Japanese Fruit Sando) that blend seamlessly onto the cardboard using the CSS `mix-blend-mode: multiply` property.

---

## 🛠️ Tech Stack & Architecture

This application is built as a unified **MERN Stack** (MongoDB, Express, React, Node.js) application.

### Folder Structure
```
Website/
├── client/                     # Frontend React (Vite) Application
│   ├── public/images/          # Transparent watercolor food sketches
│   ├── src/
│   │   ├── App.jsx             # Main layout, State managers, and API calls
│   │   ├── index.css           # Premium paper & chalkboard stylesheets
│   │   └── main.jsx            # React mounting entrypoint
│   └── index.html              # HTML shell & Google Fonts imports
├── config/
│   └── db.js                   # Mongoose connection client
├── data/
│   ├── menu.json               # Local filesystem fallback for menu items
│   └── orders.json             # Local filesystem fallback for submitted orders
├── models/
│   ├── MenuItem.js             # Mongoose schema for food items & customizations
│   └── Order.js                # Mongoose schema for submitted table orders
├── server.js                   # Express REST API server & static hoster
├── seed.js                     # Seed script to load menu items into DB/Files
├── .env                        # Port and MongoDB configurations
└── package.json                # Root workspaces scripts & dependencies coordinator
```

---

## 💾 Resilient Hybrid Database Design
To make development and review frictionless, this application implements a **Hybrid Database Fallback Mode**:
1. On start, the server [server.js](server.js) attempts to connect to MongoDB using connection parameters in `.env`.
2. If MongoDB is offline or unavailable, the server automatically falls back to **Local JSON File System database mode** (reading and writing to `data/menu.json` and `data/orders.json`).
3. If MongoDB is online, it connects and queries MongoDB.
4. *Seeding* (`npm run seed`) automatically updates the local `data/menu.json` file **and** the MongoDB collection (if online), guaranteeing that menu items are ready to load immediately in either mode.

---

## 🚀 Installation and Run Guide

### 1. Prerequisites
* **Node.js** installed (version 18+ recommended)
* **MongoDB** (optional, recommended for production database features)

### 2. Install Dependencies
Run the following command at the root directory to install both the root backend and the client React dependencies:
```bash
npm install && npm run client-install
```

### 3. Seed Database / Fallback Files
Seed the application data to populate the menu items database:
```bash
npm run seed
```

### 4. Start Development Server
Launch both the Express backend server and the Vite React development server concurrently:
```bash
npm run dev
```
* **React Frontend URL**: `http://localhost:5173`
* **Express Backend URL**: `http://localhost:5000`

---

## 🔌 API Endpoints (Express Backend)

* **`GET /api/menu`**
  * Fetches the complete list of menu items from the active database.
* **`POST /api/orders`**
  * Submits a new table order to the kitchen.
  * Generates a unique transaction code (e.g. `#404-981042`), computes local CGST (2.5%) and SGST (2.5%), saves the record to the database, and returns the confirmed order.
* **`GET /api/orders`**
  * Fetches the history of all submitted orders in the kitchen queue (sorted by date descending).

---

## 🔧 Environment Variables (`.env`)
Configure your backend parameters by editing the `.env` file at the root:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/404cafe
```

---

## 📜 Typography Credits
All custom fonts are dynamically loaded from Google Fonts:
* Condense Headers: **Bebas Neue**
* Slate/Chalk Quotes & Diner Checks: **Special Elite** (Monospaced retro typewriter font)
* Core Brand Logo: **Permanent Marker** (Hand-drawn brush script)
* Body Texts & Descriptions: **Outfit** (Modern readable sans-serif)
