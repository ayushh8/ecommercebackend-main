const express = require('express');
const router = express.Router();
const Coupon = require('../models/couponmodel');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const User = require('../models/user'); // Adjust the path to your actual User model file
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', // Convert string to boolean
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Helper function to send emails to all users
async function sendEmailToAllUsers(subject, message) {
  try {
    const users = await User.find({}, 'email'); // Fetch user emails
    for (const user of users) {
      try {
        await transporter.sendMail({
          from: 'pecommerce8@gmail.com',
          to: user.email,
          subject: subject,
          text: message
        });
      } catch (emailError) {
        console.error(`Error sending email to ${user.email}:`, emailError);
      }
    }
  } catch (error) {
    console.error('Error fetching users or sending emails:', error);
  }
}

// Middleware for Admin Verification
function verifyAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  next();
}

// Get all coupons
router.get('/get-coupon', async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.status(200).json({
      success: true,
      coupons
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching coupons',
      error: error.message
    });
  }
});

// Create a new coupon
router.post('/save-coupon', verifyAdmin, async (req, res) => {
  try {
    const { code, discountPercentage, expiryDate } = req.body;

    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    const coupon = new Coupon({
      code,
      discountPercentage,
      expiryDate: new Date(expiryDate)
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: 'Coupon saved successfully',
      coupon
    });

    // Notify all users about the new coupon
    const subject = 'New Coupon Available!';
    const message = `A new coupon ${code} is now available with ${discountPercentage}% discount. Use it before ${expiryDate}!`;
    await sendEmailToAllUsers(subject, message);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error saving coupon',
      error: error.message
    });
  }
});

// Apply a coupon
router.post('/apply-coupon', async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    const coupon = await Coupon.findOne({ code });
    if (!coupon) {
      return res.status(404).json({ error: 'Invalid coupon code' });
    }

    // Check if the coupon has expired
    if (new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({ error: 'Coupon has expired' });
    }

    // Calculate the discount
    const discount = (cartTotal * coupon.discountPercentage) / 100;
    const finalTotal = cartTotal - discount;

    res.status(200).json({ success: true, discount, finalTotal });
  } catch (error) {
    res.status(500).json({ error: 'Error applying coupon', message: error.message });
  }
});

// Verify a coupon
router.post('/verify-coupon', async (req, res) => {
  try {
    const { code } = req.body;

    const coupon = await Coupon.findOne({ code });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    res.status(200).json({
      success: true,
      coupon
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying coupon',
      error: error.message
    });
  }
});

// Delete a coupon
router.delete('/delete-coupon', verifyAdmin, async (req, res) => {
  try {
    const { code } = req.body;

    const deletedCoupon = await Coupon.findOneAndDelete({ code });
    if (!deletedCoupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    // Notify users about the deleted coupon
    const subject = 'Coupon Expired';
    const message = `The coupon ${code} has expired and is no longer valid.`;
    await sendEmailToAllUsers(subject, message);

    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting coupon', error: error.message });
  }
});

module.exports = router;