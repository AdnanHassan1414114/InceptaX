const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: true,
      trim:     true,
    },
    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    username: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    // 🔹 password is optional for OAuth users (they never set one)
    password: {
      type:     String,
      minlength: 8,
      select:   false,
    },
    role: {
      type:    String,
      enum:    ['user', 'admin'],
      default: 'user',
    },
    refreshToken: {
      type:   String,
      select: false,
    },

    // ── Profile fields ─────────────────────────────────────────────────────
    bio: {
      type:      String,
      default:   '',
      maxlength: [300, 'Bio cannot exceed 300 characters'],
      trim:      true,
    },
    profileImage: {
      type:  String,
      default: '',
      trim:  true,
    },
    githubUsername: {
      type:  String,
      default: '',
      trim:  true,
    },
    skills: {
      type:    [String],
      default: [],
    },
    socialLinks: {
      twitter:  { type: String, default: '', trim: true },
      linkedin: { type: String, default: '', trim: true },
      website:  { type: String, default: '', trim: true },
    },

    // ── Plan fields ────────────────────────────────────────────────────────
    plan: {
      type:    String,
      enum:    ['free', 'ten_day', 'monthly'],
      default: 'free',
    },
    planExpiresAt: {
      type:    Date,
      default: null,
    },

    // 🔹 NEW — OAuth provider fields
    // Stored so we can find/link accounts by provider ID
    googleId: {
      type:    String,
      default: null,
      sparse:  true, // allows multiple null values (unique: true would break for non-OAuth users)
    },
    githubId: {
      type:    String,
      default: null,
      sparse:  true,
    },
    // Which provider was used to create this account (email | google | github)
    oauthProvider: {
      type:    String,
      enum:    ['email', 'google', 'github'],
      default: 'email',
    },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ githubId: 1 }, { sparse: true });

// 🔐 Hash password — only if set (OAuth users skip this)
userSchema.pre('save', async function (next) {
  if (!this.password) return next();          // 🔹 skip for OAuth users
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// 🔐 Compare password
userSchema.methods.comparePassword = function (password) {
  if (!this.password) return Promise.resolve(false); // 🔹 OAuth users have no password
  return bcrypt.compare(password, this.password);
};

// 👤 Safe public response — includes all profile + OAuth info
userSchema.methods.toPublicJSON = function () {
  return {
    _id:           this._id,
    name:          this.name,
    email:         this.email,
    username:      this.username,
    role:          this.role,
    bio:           this.bio,
    profileImage:  this.profileImage,
    githubUsername: this.githubUsername,
    skills:        this.skills,
    socialLinks:   this.socialLinks,
    plan:          this.plan,
    planExpiresAt: this.planExpiresAt,
    oauthProvider: this.oauthProvider,  // 🔹 so frontend knows how user signed up
    createdAt:     this.createdAt,
  };
};

// 👤 Active plan resolver
userSchema.methods.getActivePlan = function () {
  if (!this.plan || this.plan === 'free') {
    return { name: 'free', isActive: true };
  }
  if (this.planExpiresAt && new Date() > this.planExpiresAt) {
    return { name: 'free', isActive: false };
  }
  return {
    name:      this.plan,
    isActive:  true,
    expiresAt: this.planExpiresAt,
  };
};

module.exports = mongoose.model('User', userSchema);