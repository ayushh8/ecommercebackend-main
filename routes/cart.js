const express = require('express'); 
const router = express.Router();
const mongoose = require('mongoose');
const Cart = require('../models/cartmodel');
const Order = require('../models/complaintmodel'); // Replace with correct path
const User = require('../models/user'); // Replace with correct path
const Product = require('../models/product'); // Replace with correct path
const nodemailer = require('nodemailer');
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

// Add to Cart Route
router.post('/addtocart', async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;

    let cart = await Cart.findOne({ userId });
    const productQty = parseInt(quantity);

    if (cart) {
      cart.productsInCart.push({ productId, productQty });
      await cart.save();
    } else {
      cart = new Cart({ userId, productsInCart: [{ productId, quantity }] });
      await cart.save();
    }

    res.status(200).json({ success: true, message: 'Product added to cart successfully', cart });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding product to cart', error: error.message });
  }
});

// Get Cart by User ID Route
router.post('/get-cart', async (req, res) => {
  try {
    const { userId } = req.body;
    const cart = await Cart.findOne({ userId });

    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found for this user' });

    res.status(200).json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching cart', error: error.message });
  }
});

router.put('/update-quantity', async (req, res) => {
  const { userId, productId, productQty } = req.body;

  if (!userId || !productId || typeof productQty !== 'number') {
    return res.status(400).json({ message: 'userId, productId, and a valid productQty are required.' });
  }

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found.' });
    }

    const product = cart.productsInCart.find(item => item.productId === productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found in the cart.' });
    }

    product.productQty = productQty;
    await cart.save();

    res.status(200).json({ message: 'Quantity updated successfully.' });
  } catch (error) {
    console.error('Error updating quantity:', error);
    res.status(500).json({ message: 'An error occurred while updating the quantity.' });
  }
});
// Delete Item from Cart Route
router.post('/delete-items', async (req, res) => {
  const { userId, productId } = req.body;

  if (!userId || !productId) {
    return res.status(400).json({ message: 'userId and productId are required.' });
  }

  try {
    const result = await Cart.updateOne(
      { userId },
      { $pull: { productsInCart: { productId } } }
    );

    if (result.modifiedCount > 0) {
      res.status(200).json({ message: 'Item deleted successfully.' });
    } else {
      res.status(404).json({ message: 'Item not found in the cart.' });
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'An error occurred while deleting the item.' });
  }
});

// Place Order Route with Free Delivery and Discount Logic
router.post('/place-order', async (req, res) => {
  try {
    const { userId, date, time, address, price, productsOrdered } = req.body;

    if (!userId || !price || !productsOrdered) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const orderId = Math.floor(100000 + Math.random() * 900000).toString();
    const trackingId = Math.random().toString(36).substring(2, 14).toUpperCase();

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const productIds = productsOrdered.map(item => item.productId);

    const productDetails = await Product.find({ productId: { $in: productIds } });

    // Calculate free delivery and discount
    let deliveryCharges = 50; // Default delivery charge
    let discount = 0;
    let finalTotal = price;

    if (price > 499) {
      deliveryCharges = 0; // Free delivery
      discount = (price * 10) / 100; // 10% off
      finalTotal = price - discount;
    }

    finalTotal += deliveryCharges;

    const order = new Order({
      userId,
      orderId,
      date,
      time,
      address,
      email: user.email,
      name: user.name,
      productIds,
      trackingId,
      price,
      discount,
      deliveryCharges,
      finalTotal
    });

    await order.save();

    const emailHtml = `<div>
      <h1>Order Confirmation</h1>
      <p>Thank you for your order, ${user.name}!</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Total Amount:</strong> ₹${price}</p>
      <p><strong>Discount:</strong> ₹${discount}</p>
      <p><strong>Delivery Charges:</strong> ₹${deliveryCharges}</p>
      <p><strong>Final Amount:</strong> ₹${finalTotal}</p>
    </div>`;

    await transporter.sendMail({
      from: `pecommerce8@gmail.com`,
      to: user.email,
      subject: 'Order Confirmation',
      html: emailHtml
    });

    res.status(200).json({ success: true, message: 'Order placed successfully', orderId, trackingId, finalTotal });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error placing order', error: error.message });
  }
});

// Add Product Description Feature
router.post('/add-product-description', async (req, res) => {
  try {
    const { productId, description } = req.body;

    if (!productId || !description) {
      return res.status(400).json({ message: 'Product ID and description are required.' });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    product.description = description;
    await product.save();

    res.status(200).json({ success: true, message: 'Product description added successfully.', product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding product description.', error: error.message });
  }
});

module.exports = router;
