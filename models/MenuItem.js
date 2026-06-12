const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
  itemId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  desc: {
    type: String
  },
  veg: {
    type: Boolean,
    default: true
  },
  category: {
    type: String,
    required: true,
    enum: ['burgers', 'drinks', 'desserts', 'extras']
  },
  image: {
    type: String
  },
  customizations: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true }
    }
  ]
});

module.exports = mongoose.model('MenuItem', MenuItemSchema);
