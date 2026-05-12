const express = require('express');
const router  = express.Router();
const {
  createOrder,
  verifyPayment,
  webhook,
} = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/payment/create-order — authenticated user initiates payment
router.post('/create-order', authMiddleware, createOrder);

// POST /api/payment/verify — frontend calls after Razorpay checkout succeeds
router.post('/verify', authMiddleware, verifyPayment);

// POST /api/payment/webhook — Razorpay server-to-server webhook (no auth)
// Raw body needed for signature verification — use express.raw middleware here
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    // Parse raw body back to JSON for our handler (after signature check uses raw)
    if (Buffer.isBuffer(req.body)) {
      req.body = JSON.parse(req.body.toString());
    }
    next();
  },
  webhook
);

module.exports = router;