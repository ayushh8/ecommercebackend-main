// User Model (user.js)
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  userId: { type: String, unique: true, required: true },
  accountStatus: { type: String, default: 'open' },
  phone: { type: String, default: 'not available' },
  isAdmin: { type: Boolean, default: false } // Flag to indicate admin rights
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', UserSchema);

// Seller Dashboard Management Routes (adminauth.js)
const express = require('express');
const Seller = require('../models/seller');
const User = require('../models/user');
const router = express.Router();

// Middleware to verify admin rights
function verifyAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  next();
}

// Route to list all sellers
router.get('/admin/sellers', verifyAdmin, async (req, res) => {
  try {
    const sellers = await Seller.find({}, { password: 0 }); // Exclude sensitive fields
    res.status(200).json({ success: true, sellers });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching sellers', message: error.message });
  }
});

// Route to block/unblock a seller
router.post('/admin/seller/:sellerId/block', verifyAdmin, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const seller = await Seller.findOne({ sellerId });
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    seller.accountStatus = seller.accountStatus === 'blocked' ? 'active' : 'blocked';
    await seller.save();

    res.status(200).json({ success: true, message: `Seller ${seller.accountStatus}` });
  } catch (error) {
    res.status(500).json({ error: 'Error updating seller status', message: error.message });
  }
});

// Route to delete a seller
router.delete('/admin/seller/:sellerId', verifyAdmin, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const seller = await Seller.findOneAndDelete({ sellerId });
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    res.status(200).json({ success: true, message: 'Seller account deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting seller', message: error.message });
  }
});

module.exports = router;