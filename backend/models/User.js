const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 8, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    refreshToken: { type: String, select: false },

    // 🔹 NEW — email verification status
    // OAuth users are auto-verified; email/password users must verify via OTP
    isEmailVerified: {
      type:    Boolean,
      default: false,
    },

    // ── Profile fields ────────────────────────────────────────────────────
    bio:            { type: String, default: '', maxlength: [300, 'Bio cannot exceed 300 characters'], trim: true },
    profileImage:   { type: String, default: '', trim: true },
    githubUsername: { type: String, default: '', trim: true },
    skills:         { type: [String], default: [] },
    socialLinks: {
      twitter:  { type: String, default: '', trim: true },
      linkedin: { type: String, default: '', trim: true },
      website:  { type: String, default: '', trim: true },
    },

    // ── Plan fields ───────────────────────────────────────────────────────
    plan:          { type: String, enum: ['free', 'ten_day', 'monthly'], default: 'free' },
    planExpiresAt: { type: Date, default: null },

    // ── OAuth fields ──────────────────────────────────────────────────────
    googleId:      { type: String, default: null, sparse: true },
    githubId:      { type: String, default: null, sparse: true },
    oauthProvider: { type: String, enum: ['email', 'google', 'github'], default: 'email' },
  },
  { timestamps: true }
);

// 🔐 Hash password — skip for OAuth users
userSchema.pre('save', async function (next) {
  if (!this.password)                    return next();
  if (!this.isModified('password'))      return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// 🔐 Compare password
userSchema.methods.comparePassword = function (password) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(password, this.password);
};

// 👤 Safe public response — 🔹 includes isEmailVerified
userSchema.methods.toPublicJSON = function () {
  return {
    _id:             this._id,
    name:            this.name,
    email:           this.email,
    username:        this.username,
    role:            this.role,
    isEmailVerified: this.isEmailVerified, // 🔹
    bio:             this.bio,
    profileImage:    this.profileImage,
    githubUsername:  this.githubUsername,
    skills:          this.skills,
    socialLinks:     this.socialLinks,
    plan:            this.plan,
    planExpiresAt:   this.planExpiresAt,
    oauthProvider:   this.oauthProvider,
    createdAt:       this.createdAt,
  };
};

// 👤 Active plan resolver
userSchema.methods.getActivePlan = function () {
  if (!this.plan || this.plan === 'free') return { name: 'free', isActive: true };
  if (this.planExpiresAt && new Date() > this.planExpiresAt) return { name: 'free', isActive: false };
  return { name: this.plan, isActive: true, expiresAt: this.planExpiresAt };
};

module.exports = mongoose.model('User', userSchema);