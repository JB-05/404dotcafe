require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const MenuItem = require('./models/MenuItem');
const Order = require('./models/Order');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection state
let useMongo = false;
const MENU_FILE = path.join(__dirname, 'data', 'menu.json');
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');

// Connect to MongoDB
connectDB()
  .then(() => {
    useMongo = true;
    console.log("MongoDB is active and will be used as the primary database.");
  })
  .catch(err => {
    console.warn("MongoDB offline. Server is falling back to Local JSON Files (FS Database mode).");
    useMongo = false;
  });

// API Routes

// 1. Fetch Menu Items (from MongoDB or fallback JSON file)
app.get('/api/menu', async (req, res) => {
  if (useMongo) {
    try {
      const menuItems = await MenuItem.find({});
      return res.json(menuItems);
    } catch (error) {
      console.error(`MongoDB error fetching menu: ${error.message}. Checking file fallback...`);
    }
  }

  // Local JSON File Fallback
  try {
    const data = await fs.promises.readFile(MENU_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error(`Local file system error fetching menu: ${error.message}`);
    res.status(500).json({ error: 'Database and local file fallback failed' });
  }
});

// 2. Submit Order to Kitchen (to MongoDB or fallback JSON file)
app.post('/api/orders', async (req, res) => {
  try {
    const { tableNo, time, items, subtotal, cgst, sgst, total } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cannot submit an empty order' });
    }

    const randomReceiptId = '#404-' + Math.floor(100000 + Math.random() * 900000);

    const orderData = {
      orderId: randomReceiptId,
      tableNo: tableNo || '04',
      time: time || 'TIME UNKNOWN',
      items,
      subtotal,
      cgst,
      sgst,
      total,
      status: 'pending',
      createdAt: new Date()
    };

    if (useMongo) {
      try {
        const newOrder = new Order(orderData);
        const savedOrder = await newOrder.save();
        return res.status(201).json(savedOrder);
      } catch (error) {
        console.error(`MongoDB error saving order: ${error.message}. Saving to local file instead...`);
      }
    }

    // Local JSON File Fallback
    let ordersList = [];
    try {
      if (fs.existsSync(ORDERS_FILE)) {
        const fileContent = await fs.promises.readFile(ORDERS_FILE, 'utf8');
        ordersList = JSON.parse(fileContent);
      }
    } catch (e) {
      console.warn("Could not read orders file, initializing new list.", e);
    }

    ordersList.push(orderData);
    await fs.promises.writeFile(ORDERS_FILE, JSON.stringify(ordersList, null, 2), 'utf8');
    
    console.log(`Order ${randomReceiptId} successfully saved to local file: ${ORDERS_FILE}`);
    res.status(201).json(orderData);

  } catch (error) {
    console.error(`Error saving order: ${error.message}`);
    res.status(500).json({ error: 'Server Error: Failed to submit order to kitchen' });
  }
});

// 3. Fetch All Orders (Kitchen View)
app.get('/api/orders', async (req, res) => {
  if (useMongo) {
    try {
      const orders = await Order.find({}).sort({ createdAt: -1 });
      return res.json(orders);
    } catch (error) {
      console.error(`MongoDB error fetching orders: ${error.message}. Checking file fallback...`);
    }
  }

  // Local JSON File Fallback
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const data = await fs.promises.readFile(ORDERS_FILE, 'utf8');
      const orders = JSON.parse(data);
      // Sort by date descending
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.json(orders);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error(`Local file system error fetching orders: ${error.message}`);
    res.status(500).json({ error: 'Database and local file fallback failed' });
  }
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'dist', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('404 Café Express API is running (Hybrid MongoDB/JSON Mode)...');
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Express Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
