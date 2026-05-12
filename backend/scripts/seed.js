require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Assignment.deleteMany({}),
    Submission.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // ── Create admin ────────────────────────────────────────────────────────────
  const admin = await User.create({
    name: 'InceptaX Admin',
    email: process.env.ADMIN_EMAIL,
    username: 'inceptax_admin',
    password: process.env.ADMIN_PASSWORD,
    role: 'admin',
    plan: 'monthly',
    planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    bio: 'Platform administrator',
  });
  console.log(`✅ Admin created: ${admin.email}`);

  // ── Create test users ───────────────────────────────────────────────────────
  const usersData = [
    { name: 'Alice Chen', email: 'alice@test.com', username: 'alice_dev', plan: 'monthly', planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), githubUsername: 'alice-chen' },
    { name: 'Bob Kumar', email: 'bob@test.com', username: 'bob_codes', plan: 'ten_day', planExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), githubUsername: 'bobkumar' },
    { name: 'Carol Smith', email: 'carol@test.com', username: 'carol_builds', plan: 'free', githubUsername: 'carolsmith' },
    { name: 'Dan Patel', email: 'dan@test.com', username: 'dan_hacks', plan: 'monthly', planExpiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), githubUsername: 'danpatel' },
  ];

  const users = await User.insertMany(
    usersData.map((u) => ({ ...u, password: 'Test@12345', bio: `Developer and challenger at InceptaX` }))
  );
  // Re-fetch because insertMany bypasses pre-save hooks for password hashing
  // Instead, create individually to trigger hashing:
  await User.deleteMany({ email: { $in: usersData.map((u) => u.email) } });
  const createdUsers = await Promise.all(usersData.map((u) => User.create({ ...u, password: 'Test@12345', bio: 'Developer and challenger at InceptaX' })));
  console.log(`✅ ${createdUsers.length} users created`);

  // ── Create assignments ──────────────────────────────────────────────────────
  const assignmentsData = [
    {
      title: 'Build a REST API with Authentication',
      description: 'Create a production-ready REST API with JWT authentication, rate limiting, and proper error handling. Must include user registration, login, and CRUD operations.',
      difficulty: 'medium',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      tags: ['nodejs', 'api', 'backend', 'jwt'],
      isPremium: false,
      requiredPlan: 'free',
      prize: '$200 + Certificate',
      createdBy: admin._id,
    },
    {
      title: 'Real-time Chat Application',
      description: 'Build a real-time chat application using Socket.io with private rooms, message history, and user presence indicators.',
      difficulty: 'hard',
      deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      tags: ['nodejs', 'socket.io', 'mongodb', 'react'],
      isPremium: true,
      requiredPlan: 'ten_day',
      prize: '$500 + Premium Badge',
      createdBy: admin._id,
    },
    {
      title: 'Responsive Portfolio Website',
      description: 'Design and build a modern, responsive portfolio website with dark mode, animations, and performance score above 90 on Lighthouse.',
      difficulty: 'easy',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      tags: ['html', 'css', 'javascript', 'design'],
      isPremium: false,
      requiredPlan: 'free',
      prize: '$100 + Shoutout',
      createdBy: admin._id,
    },
    {
      title: 'Fullstack SaaS Dashboard',
      description: 'Build a complete SaaS analytics dashboard with Next.js, Prisma, and a real-time data visualization layer. Include role-based access control.',
      difficulty: 'hard',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      tags: ['nextjs', 'prisma', 'typescript', 'saas'],
      isPremium: true,
      requiredPlan: 'monthly',
      prize: '$1000 + Internship Opportunity',
      createdBy: admin._id,
    },
  ];

  const assignments = await Assignment.insertMany(assignmentsData);
  console.log(`✅ ${assignments.length} assignments created`);

  // ── Create submissions ──────────────────────────────────────────────────────
  const submissionsData = [
    {
      userId: createdUsers[0]._id,
      assignmentId: assignments[0]._id,
      repoLink: 'https://github.com/alice-chen/rest-api-challenge',
      liveLink: 'https://alice-api.railway.app',
      description: 'Built with Node.js + Express, full JWT auth, rate limiting with express-rate-limit.',
      status: 'published',
      aiScore: 82,
      adminScore: 88,
      finalScore: 86,
      rank: 1,
      aiFeedback: {
        strengths: ['Well-structured code', 'Good error handling', 'Comprehensive README'],
        weaknesses: ['No test coverage', 'Missing input sanitization'],
        suggestions: ['Add Jest tests', 'Use Joi for validation'],
      },
    },
    {
      userId: createdUsers[1]._id,
      assignmentId: assignments[0]._id,
      repoLink: 'https://github.com/bobkumar/api-challenge',
      liveLink: '',
      description: 'Express REST API with refresh token rotation and Redis caching.',
      status: 'ai_evaluated',
      aiScore: 75,
      aiFeedback: {
        strengths: ['Good architecture', 'Redis integration'],
        weaknesses: ['Documentation sparse', 'Some endpoints unimplemented'],
        suggestions: ['Complete all CRUD endpoints', 'Add Swagger docs'],
      },
    },
    {
      userId: createdUsers[2]._id,
      assignmentId: assignments[2]._id,
      repoLink: 'https://github.com/carolsmith/portfolio',
      liveLink: 'https://carolsmith.vercel.app',
      description: 'Minimalist portfolio with CSS animations and perfect Lighthouse score.',
      status: 'pending',
    },
  ];

  await Submission.insertMany(submissionsData);
  console.log(`✅ ${submissionsData.length} submissions created`);

 
  createdUsers.forEach((u) => console.log(`  ${u.email} (plan: ${u.plan})`));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
