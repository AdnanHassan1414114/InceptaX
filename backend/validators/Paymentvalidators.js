/**
 * validators/paymentValidators.js
 *
 * Zod schemas for /api/payment routes.
 *
 * Regex patterns used:
 *  RAZORPAY_ORDER_REGEX   — Razorpay order IDs start with "order_"
 *  RAZORPAY_PAYMENT_REGEX — Razorpay payment IDs start with "pay_"
 *  RAZORPAY_SIG_REGEX     — HMAC-SHA256 hex string, exactly 64 hex chars
 */

const { z } = require('zod');

// ── Regex constants ───────────────────────────────────────────────────────────
const RAZORPAY_ORDER_REGEX   = /^order_[a-zA-Z0-9]{14,}$/;
const RAZORPAY_PAYMENT_REGEX = /^pay_[a-zA-Z0-9]{14,}$/;
const RAZORPAY_SIG_REGEX     = /^[a-f0-9]{64}$/;

const VALID_PLANS = ['ten_day', 'monthly'];

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * POST /api/payment/create-order
 */
const createOrder = z.object({
  plan: z.enum(VALID_PLANS, {
    required_error: 'plan is required',
    invalid_type_error: 'plan must be "ten_day" or "monthly"',
  }),
});

/**
 * POST /api/payment/verify
 */
const verifyPayment = z.object({
  razorpay_order_id: z
    .string({ required_error: 'razorpay_order_id is required' })
    .regex(RAZORPAY_ORDER_REGEX, 'Invalid Razorpay order ID format'),

  razorpay_payment_id: z
    .string({ required_error: 'razorpay_payment_id is required' })
    .regex(RAZORPAY_PAYMENT_REGEX, 'Invalid Razorpay payment ID format'),

  razorpay_signature: z
    .string({ required_error: 'razorpay_signature is required' })
    .regex(RAZORPAY_SIG_REGEX, 'razorpay_signature must be a 64-character hex string'),

  plan: z.enum(VALID_PLANS, {
    required_error: 'plan is required',
    invalid_type_error: 'plan must be "ten_day" or "monthly"',
  }),
});

module.exports = {
  createOrder,
  verifyPayment,
};