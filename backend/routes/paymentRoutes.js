/**
 * routes/paymentRoutes.js  — with Zod validation
 */
const express = require('express');
const router  = express.Router();

const { createOrder, verifyPayment, webhook } = require('../controllers/paymentController');
const authMiddleware   = require('../middleware/authMiddleware');
const validate         = require('../validators/validate');
const paymentSchemas   = require('../validators/paymentValidators');

router.post('/create-order', authMiddleware, validate(paymentSchemas.createOrder), createOrder);
router.post('/verify',       authMiddleware, validate(paymentSchemas.verifyPayment), verifyPayment);

// Webhook — no auth, raw body for signature check
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    if (Buffer.isBuffer(req.body)) req.body = JSON.parse(req.body.toString());
    next();
  },
  webhook
);

module.exports = router;