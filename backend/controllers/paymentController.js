/**
 * paymentController.js
 * Handles Razorpay payment flow with email confirmation via nodemailer.
 *
 * Install: npm install razorpay
 * .env:
 *   RAZORPAY_KEY_ID=rzp_test_xxxxx
 *   RAZORPAY_KEY_SECRET=xxxxxxxx
 *   RAZORPAY_WEBHOOK_SECRET=xxxxxxxx (optional)
 */

const Razorpay = require('razorpay');
const crypto   = require('crypto');
const User     = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError     = require('../utils/ApiError');
const ApiResponse  = require('../utils/ApiResponse');
const { createNotification }          = require('../utils/notificationService');
const { sendPaymentConfirmationEmail } = require('../utils/emailService'); // 🔹 NEW

// ── Plan config ───────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  ten_day: { name: '10-Day Sprint', amountPaise: 9900,  durationDays: 10 },
  monthly: { name: 'Monthly Pro',   amountPaise: 19900, durationDays: 30 },
};

let _razorpay = null;
function getRazorpay() {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env');
    }
    _razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment/create-order
// ─────────────────────────────────────────────────────────────────────────────
exports.createOrder = asyncHandler(async (req, res) => {
  const { plan } = req.body;

  if (!plan || !PLAN_CONFIG[plan]) {
    throw new ApiError(400, 'plan must be "ten_day" or "monthly"');
  }

  const config    = PLAN_CONFIG[plan];
  const razorpay  = getRazorpay();
  const receipt   = `rcpt_${req.user._id.toString().slice(-8)}_${Date.now().toString().slice(-8)}`;

  const order = await razorpay.orders.create({
    amount:   config.amountPaise,
    currency: 'INR',
    receipt,
    notes: {
      userId:    req.user._id.toString(),
      plan,
      userName:  req.user.name,
      userEmail: req.user.email,
    },
  });

  res.json(new ApiResponse(200, {
    orderId:  order.id,
    amount:   order.amount,
    currency: order.currency,
    plan,
    planName: config.name,
    key:      process.env.RAZORPAY_KEY_ID,
    user:     { name: req.user.name, email: req.user.email },
  }));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment/verify
// 🔹 UPDATED — sends payment confirmation email after successful verification
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    plan,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
    throw new ApiError(400, 'razorpay_order_id, razorpay_payment_id, razorpay_signature and plan are required');
  }

  if (!PLAN_CONFIG[plan]) throw new ApiError(400, 'Invalid plan');

  // ── Verify HMAC-SHA256 signature ──────────────────────────────────────────
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(400, 'Payment verification failed: invalid signature');
  }

  // ── Activate plan ─────────────────────────────────────────────────────────
  const config = PLAN_CONFIG[plan];
  const expiry = new Date(Date.now() + config.durationDays * 24 * 60 * 60 * 1000);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { plan, planExpiresAt: expiry },
    { new: true }
  );
  if (!user) throw new ApiError(404, 'User not found');

  res.json(new ApiResponse(200, {
    user:      user.toPublicJSON(),
    plan,
    planName:  config.name,
    expiresAt: expiry,
  }, `${config.name} plan activated successfully! 🎉`));

  // 🔹 Fire-and-forget after response — notification + email
  createNotification(req.app, user._id, {
    type:    'submission_published',
    message: `🎉 Your ${config.name} plan is now active! Expires ${expiry.toDateString()}.`,
    link:    '/pricing',
    metadata: { plan, expiresAt: expiry, razorpay_order_id, razorpay_payment_id },
  });

  sendPaymentConfirmationEmail(user, {
    planName:  config.name,
    expiresAt: expiry,
    paymentId: razorpay_payment_id,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment/webhook
// ─────────────────────────────────────────────────────────────────────────────
exports.webhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret) {
      const receivedSig = req.headers['x-razorpay-signature'];
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (receivedSig !== expectedSig) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = req.body;

    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      const notes   = payment?.notes || {};
      const userId  = notes.userId;
      const plan    = notes.plan;

      if (userId && plan && PLAN_CONFIG[plan]) {
        const config = PLAN_CONFIG[plan];
        const expiry = new Date(Date.now() + config.durationDays * 24 * 60 * 60 * 1000);

        await User.findByIdAndUpdate(userId, { plan, planExpiresAt: expiry });
        console.log(`[Webhook] Plan ${plan} activated for user ${userId}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Webhook] Error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};