const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: String,
  img: [String], // Updated to store multiple image paths
  category: String,
  rating: Number,
  productId: { type: String, unique: true },
  inStockValue: Number,
  soldStockValue: Number,
  visibility: { type: String, default: 'on' },
  description: String // Field for detailed descriptions
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;

// Product Image Upload Route (adminauth.js or relevant route file)
const express = require('express');
const multer = require('multer');
const Product = require('../models/product');
const router = express.Router();

// Multer configuration for multiple image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Route to add a new product with multiple images
router.post('/add-product', upload.array('images', 5), async (req, res) => {
  try {
    const { name, price, category, description, inStockValue } = req.body;
    const images = req.files.map(file => file.path); // Store file paths in the img field

    const product = new Product({
      name,
      price,
      category,
      description,
      inStockValue,
      img: images
    });

    await product.save();
    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;