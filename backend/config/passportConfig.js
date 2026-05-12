/**
 * config/passport.js
 *
 * Configures Passport.js with Google and GitHub OAuth2 strategies.
 *
 * Install:
 *   npm install passport passport-google-oauth20 passport-github2
 *
 * .env keys required:
 *   GOOGLE_CLIENT_ID=xxxxxx
 *   GOOGLE_CLIENT_SECRET=xxxxxx
 *   GITHUB_CLIENT_ID=xxxxxx
 *   GITHUB_CLIENT_SECRET=xxxxxx
 *   CLIENT_URL=http://localhost:5173
 *
 * OAuth App setup:
 *   Google:  https://console.cloud.google.com → APIs & Services → Credentials
 *     Authorized redirect URI: http://localhost:5000/api/auth/google/callback
 *
 *   GitHub:  https://github.com/settings/applications/new
 *     Authorization callback URL: http://localhost:5000/api/auth/github/callback
 */

const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User           = require('../models/User');

// ── Helper: generate a unique username from name + provider ──────────────────
async function generateUsername(baseName, providerId) {
  // Sanitise: lowercase, replace spaces/special chars with underscore
  const base = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 18);

  let candidate = base;
  let attempts  = 0;

  while (await User.exists({ username: candidate })) {
    attempts++;
    // Append a short suffix derived from providerId for determinism
    const suffix = providerId.toString().slice(-4) + (attempts > 1 ? attempts : '');
    candidate = `${base}_${suffix}`.slice(0, 24);
  }

  return candidate;
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE STRATEGY
// ─────────────────────────────────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/google/callback`,
      scope:        ['profile', 'email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email       = profile.emails?.[0]?.value?.toLowerCase();
        const googleId    = profile.id;
        const name        = profile.displayName || profile.name?.givenName || 'Google User';
        const profileImage = profile.photos?.[0]?.value || '';

        if (!email) return done(new Error('No email returned from Google'), null);

        // 1. Try to find by googleId (returning user)
        let user = await User.findOne({ googleId });

        // 2. Try to find by email (user may have registered with email before)
        if (!user) user = await User.findOne({ email });

        if (user) {
          // Link Google ID if not already linked
          if (!user.googleId) {
            user.googleId      = googleId;
            user.oauthProvider = 'google';
            if (!user.profileImage) user.profileImage = profileImage;
            await user.save({ validateBeforeSave: false });
          }
          return done(null, user);
        }

        // 3. Create new user
        const username = await generateUsername(name, googleId);

        user = await User.create({
          name,
          email,
          username,
          googleId,
          profileImage,
          oauthProvider: 'google',
          // No password — OAuth users authenticate via Google
        });

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// GITHUB STRATEGY
// ─────────────────────────────────────────────────────────────────────────────
passport.use(
  new GitHubStrategy(
    {
      clientID:     process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL:  `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/github/callback`,
      scope:        ['user:email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const githubId     = profile.id.toString();
        const name         = profile.displayName || profile.username || 'GitHub User';
        const githubLogin  = profile.username || '';
        const profileImage = profile.photos?.[0]?.value || '';

        // GitHub may not expose email unless user has a public email or user:email scope granted
        const email = (profile.emails?.[0]?.value || '').toLowerCase();

        if (!email) {
          return done(new Error('No email returned from GitHub. Please ensure your GitHub email is public or grant email access.'), null);
        }

        // 1. Try by githubId
        let user = await User.findOne({ githubId });

        // 2. Try by email
        if (!user) user = await User.findOne({ email });

        if (user) {
          if (!user.githubId) {
            user.githubId      = githubId;
            user.oauthProvider = 'github';
            if (!user.profileImage) user.profileImage = profileImage;
            if (!user.githubUsername) user.githubUsername = githubLogin;
            await user.save({ validateBeforeSave: false });
          }
          return done(null, user);
        }

        // 3. Create new user
        const username = await generateUsername(githubLogin || name, githubId);

        user = await User.create({
          name,
          email,
          username,
          githubId,
          githubUsername: githubLogin,
          profileImage,
          oauthProvider:  'github',
        });

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Passport does NOT use sessions — we use JWTs.
// These are required by Passport internally but effectively no-ops here.
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;