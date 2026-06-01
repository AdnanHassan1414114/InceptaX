/**
 * utils/chatPubSub.js
 *
 * Redis Pub/Sub adapter for real-time team chat.
 *
 * WHY THIS EXISTS:
 *   Socket.io rooms only work within a single Node.js process.
 *   If the app ever runs on multiple instances (horizontal scaling, PM2 cluster,
 *   Docker replicas, etc.), a message sent on instance A would never reach
 *   clients connected to instance B.
 *
 *   Solution: every instance PUBLISHES outgoing messages to a shared Redis channel.
 *   Every instance SUBSCRIBES to that channel and re-emits the message locally
 *   via Socket.io — so all connected clients receive it regardless of which
 *   instance they're connected to.
 *
 * CHANNEL DESIGN:
 *   ix:chat:team:<teamId>   — one channel per team room
 *
 * SINGLE-INSTANCE NOTE:
 *   This still works perfectly on a single instance — it's just a tiny
 *   publish → subscribe loop on localhost Redis. Zero downside.
 *
 * SETUP (called once in server.js):
 *   const { initChatPubSub } = require('./utils/chatPubSub');
 *   initChatPubSub(io);
 *
 * USAGE (in teamController.sendTeamMessage):
 *   const { publishTeamMessage } = require('./utils/chatPubSub');
 *   await publishTeamMessage(teamId, messageObject);
 */

const Redis = require('ioredis');

// ── Channel key builder ───────────────────────────────────────────────────────
const teamChatChannel = (teamId) => `ix:chat:team:${teamId}`;

// ── Dedicated pub/sub clients ─────────────────────────────────────────────────
// ioredis requires SEPARATE clients for subscribe mode vs regular commands.
// A client in subscribe mode can ONLY run subscribe/unsubscribe commands.
// We create two lazy singletons: one for publishing, one for subscribing.

let _publisher  = null;
let _subscriber = null;

function createRedisClient(name) {
  const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null, // required for pub/sub clients
    enableReadyCheck:     true,
    lazyConnect:          false,
  });
  client.on('connect', () => console.log(`✅ Redis ${name} connected`));
  client.on('error',   (err) => console.error(`❌ Redis ${name} error:`, err.message));
  return client;
}

function getPublisher() {
  if (!_publisher) _publisher = createRedisClient('publisher');
  return _publisher;
}

function getSubscriber() {
  if (!_subscriber) _subscriber = createRedisClient('subscriber');
  return _subscriber;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize the subscriber.
 * Must be called once at server startup with the Socket.io instance.
 * Listens on ALL team chat channels (pattern subscribe) and re-emits
 * the message to the correct Socket.io room on THIS instance.
 *
 * @param {import('socket.io').Server} io
 */
function initChatPubSub(io) {
  const subscriber = getSubscriber();

  // psubscribe = pattern subscribe — matches ix:chat:team:*
  subscriber.psubscribe('ix:chat:team:*', (err) => {
    if (err) {
      console.error('[ChatPubSub] psubscribe error:', err.message);
    } else {
      console.log('[ChatPubSub] Subscribed to ix:chat:team:* pattern');
    }
  });

  // pmessage fires for every message matching the pattern
  subscriber.on('pmessage', (pattern, channel, rawPayload) => {
    try {
      // Extract teamId from the channel name: ix:chat:team:<teamId>
      const teamId = channel.split(':').pop();
      const msg    = JSON.parse(rawPayload);

      // Emit to the Socket.io room on THIS server instance
      // Clients in the `team:<teamId>` room receive the `team_message` event
      io.to(`team:${teamId}`).emit('team_message', msg);
    } catch (err) {
      console.error('[ChatPubSub] pmessage parse error:', err.message);
    }
  });
}

/**
 * Publish a team message to Redis so ALL server instances emit it.
 * Call this instead of io.to().emit() in teamController.
 *
 * @param {string} teamId
 * @param {object} messageObject  — the populated TeamMessage document (plain object)
 * @returns {Promise<void>}
 */
async function publishTeamMessage(teamId, messageObject) {
  try {
    const publisher = getPublisher();
    const channel   = teamChatChannel(teamId);
    const payload   = JSON.stringify(messageObject);
    await publisher.publish(channel, payload);
  } catch (err) {
    console.error('[ChatPubSub] publish error:', err.message);
    // Non-fatal — the HTTP response has already been sent.
    // In the worst case (Redis down), this message just won't appear in real-time.
    // The client can re-fetch on reconnect.
  }
}

/**
 * Gracefully close both Redis pub/sub clients.
 * Call on process SIGTERM/SIGINT.
 */
async function closeChatPubSub() {
  try {
    if (_subscriber) await _subscriber.quit();
    if (_publisher)  await _publisher.quit();
    console.log('[ChatPubSub] Connections closed');
  } catch (err) {
    console.error('[ChatPubSub] Close error:', err.message);
  }
}

module.exports = {
  initChatPubSub,
  publishTeamMessage,
  closeChatPubSub,
};