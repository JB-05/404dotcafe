require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const MenuItem = require('./models/MenuItem');

const seedData = [
  // Burgers
  {
    itemId: "veg-burger",
    name: "Classic Veg Burger",
    price: 89,
    desc: "Veg Patty, Lettuce, Pickles, Onion, Secret Sauce",
    veg: true,
    category: "burgers",
    image: "images/burger.png",
    customizations: [
      { name: "Extra Cheese", price: 19 },
      { name: "Extra Veg Patty", price: 50 },
      { name: "Make it Spicy", price: 0 }
    ]
  },
  {
    itemId: "chicken-burger",
    name: "Classic Chicken Burger",
    price: 99,
    desc: "Chicken Patty, Egg, Lettuce, Pickles, Onion, Secret Sauce",
    veg: false,
    category: "burgers",
    image: "images/burger.png",
    customizations: [
      { name: "Extra Cheese", price: 19 },
      { name: "Double Chicken Patty", price: 60 },
      { name: "Extra Egg", price: 15 }
    ]
  },
  {
    itemId: "beef-burger",
    name: "Classic Beef Burger",
    price: 149,
    desc: "Beef Patty, Egg, Lettuce, Pickles, Onion, Secret Sauce",
    veg: false,
    category: "burgers",
    image: "images/burger.png",
    customizations: [
      { name: "Extra Cheese", price: 19 },
      { name: "Double Beef Patty", price: 69 },
      { name: "Extra Egg", price: 15 }
    ]
  },
  {
    itemId: "smashed-beef",
    name: "Smashed Beef Burger",
    price: 189,
    desc: "Smashed Beef Patty, Cheese, Egg, Pickles, Caramelized Onion, Secret Sauce",
    veg: false,
    category: "burgers",
    image: "images/burger.png",
    customizations: [
      { name: "Extra Cheese", price: 19 },
      { name: "Double Smashed Patty", price: 69 },
      { name: "Jalapenos", price: 10 }
    ]
  },
  {
    itemId: "double-smashed",
    name: "Double Smashed Beef",
    price: 219,
    desc: "Double Smashed Beef Patties, Cheese, Egg, Pickles, Caramelized Onion, Secret Sauce",
    veg: false,
    category: "burgers",
    image: "images/burger.png",
    customizations: [
      { name: "Extra Cheese Slice", price: 19 },
      { name: "Bacon Strips", price: 49 },
      { name: "Extra Egg", price: 15 }
    ]
  },
  {
    itemId: "oklahoma-smashed",
    name: "Oklahoma Smashed",
    price: 249,
    desc: "Smashed Beef Patty, Cheese, Egg, Pickles, Smashed Onion, Secret Sauce",
    veg: false,
    category: "burgers",
    image: "images/burger.png",
    customizations: [
      { name: "Double Beef Patty", price: 69 },
      { name: "Extra Cheese", price: 19 },
      { name: "Spicy Mayo", price: 0 }
    ]
  },

  // Drinks
  {
    itemId: "mojito-ultra",
    name: "Mojito Ultra",
    price: 99,
    desc: "Mint, Lime, Blue Curacao, Soda",
    veg: true,
    category: "drinks",
    image: "images/mojito.png",
    customizations: [
      { name: "Extra Mint & Lime", price: 0 },
      { name: "Less Sweet", price: 0 },
      { name: "Double Curacao Syrup", price: 15 }
    ]
  },
  {
    itemId: "iced-latte",
    name: "Iced Latte",
    price: 129,
    desc: "Milk, Espresso, Ice",
    veg: true,
    category: "drinks",
    image: "images/mojito.png",
    customizations: [
      { name: "Extra Espresso Shot", price: 30 },
      { name: "Almond Milk Substitute", price: 40 },
      { name: "Vanilla Syrup", price: 15 }
    ]
  },
  {
    itemId: "iced-chocolate",
    name: "Iced Chocolate",
    price: 139,
    desc: "Chocolate, Milk, Ice",
    veg: true,
    category: "drinks",
    image: "images/mojito.png",
    customizations: [
      { name: "Vanilla Ice Cream Scoop", price: 30 },
      { name: "Whipped Cream", price: 20 },
      { name: "Oat Milk Substitute", price: 40 }
    ]
  },

  // Desserts
  {
    itemId: "classical-sando",
    name: "Classical Sando",
    price: 79,
    desc: "Soft milk bread, whipped cream, classic filling",
    veg: true,
    category: "desserts",
    image: "images/sando.png",
    customizations: [
      { name: "Extra Whipped Cream", price: 15 },
      { name: "Honey Drizzle", price: 10 }
    ]
  },
  {
    itemId: "fruit-sando",
    name: "Classical Fruit Sando",
    price: 109,
    desc: "Soft milk bread, whipped cream, fresh fruits",
    veg: true,
    category: "desserts",
    image: "images/sando.png",
    customizations: [
      { name: "Extra Strawberries", price: 25 },
      { name: "Mixed Fruits (Kiwi & Mango)", price: 20 }
    ]
  },

  // Extras
  {
    itemId: "extra-cheese",
    name: "Cheese",
    price: 19,
    desc: "Cheese slice addon",
    veg: true,
    category: "extras",
    image: "",
    customizations: []
  },
  {
    itemId: "extra-patty",
    name: "Patty",
    price: 69,
    desc: "Burger patty addon",
    veg: false,
    category: "extras",
    image: "",
    customizations: []
  }
];

const seedDB = async () => {
  console.log('Starting 404 Café Database Seeding Process...');

  // 1. Update Fallback JSON file
  try {
    const dataFolder = path.join(__dirname, 'data');
    if (!fs.existsSync(dataFolder)) {
      fs.mkdirSync(dataFolder);
    }
    const menuFilePath = path.join(dataFolder, 'menu.json');
    fs.writeFileSync(menuFilePath, JSON.stringify(seedData, null, 2), 'utf8');
    console.log('✓ Seeding complete: Local fallback JSON file written successfully!');
  } catch (error) {
    console.error(`Local file system seeding failed: ${error.message}`);
  }

  // 2. Try MongoDB Seeding
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    console.log('MongoDB connection successful. Seeding collection...');
    
    // Clear existing
    await MenuItem.deleteMany({});
    console.log('MongoDB collection cleared!');

    // Insert seeding data
    await MenuItem.insertMany(seedData);
    console.log('✓ Seeding complete: MongoDB menu collection updated!');

    mongoose.connection.close();
  } catch (error) {
    console.warn(`MongoDB offline or unreachable: ${error.message}. MongoDB seeding skipped.`);
  }

  console.log('Seeding process complete! You are ready to start the server.');
  process.exit(0);
};

seedDB();
