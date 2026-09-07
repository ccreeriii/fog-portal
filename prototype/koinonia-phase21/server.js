/**
 * KOINONIA — PHASE 0.21 SERVER & STUDIO API
 * Transient Presence & Safe Social Interaction Server
 *
 * Capabilities:
 * 1. HTTP static file serving for Phase 0.20.2 prototype.
 * 2. WebSocket real-time presence endpoint on ws://<host>:18107/realtime
 * 3. In-memory presence management scoped by community ('fog') and place/room.
 * 4. Safe structured social actions (5 emotes, 5 preset messages, zero free text).
 * 5. Rate limiting, heartbeat, stale client cleanup, duplicate session handling.
 * 6. Auto-instancing (default 30 members/instance, max 50).
 *
 * NOTE: Presence is strictly TRANSIENT in memory. Zero persistent DB writes.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const WebSocket = require('ws');
const studioEngine = require('./data/studio_engine.js');

// ============================================================
// 1. CONFIGURATION & CONSTANTS
// ============================================================
const DEFAULT_PORT = 18108;
const DEFAULT_HOST = '0.0.0.0';
const STATIC_DIR = __dirname;
const PROTOCOL_VERSION = 1;
const MAX_PAYLOAD_BYTES = 8192; // 8KB
const DEFAULT_INSTANCE_CAPACITY = 30;
const MAX_INSTANCE_CAPACITY = 50;
const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
const STALE_TIMEOUT_MS = 45000;       // 45 seconds
const SOCIAL_RATE_LIMIT_MS = 1000;    // 1 action / second max

// Canonical Places (support both kebab and snake case)
const CANONICAL_PLACE_MAP = {
  'home': 'home',
  'my-home': 'home',
  'my_home': 'home',
  'school': 'school',
  'fog_center': 'fog_center',
  'fog-community-center': 'fog_center',
  'fog_community_center': 'fog_center',
  'sports_hub': 'sports_hub',
  'sports-hub': 'sports_hub',
  'outreach_site': 'outreach_site',
  'outreach-site': 'outreach_site'
};

const CANONICAL_PLACES = ['home', 'school', 'fog_center', 'sports_hub', 'outreach_site'];

// Safe Structured Emotes (Zero LP/XP, purely encouraging)
const EMOTE_CATALOG = {
  ENCOURAGE: { id: 'ENCOURAGE', emoji: '👏', text: 'Encourage' },
  PRAYING: { id: 'PRAYING', emoji: '🙏', text: 'Praying' },
  KEEP_GOING: { id: 'KEEP_GOING', emoji: '🔥', text: 'Keep Going' },
  GROWING_TOGETHER: { id: 'GROWING_TOGETHER', emoji: '🌱', text: 'Growing Together' },
  GREAT_JOB: { id: 'GREAT_JOB', emoji: '❤️', text: 'Great Job' }
};

// Approved Preset Messages (Strictly fixed catalog, zero free-text)
const PRESET_MESSAGE_CATALOG = {
  MSG_HI: { id: 'MSG_HI', text: 'Hi!' },
  MSG_GOD_BLESS: { id: 'MSG_GOD_BLESS', text: 'God bless!' },
  MSG_GREAT_JOB: { id: 'MSG_GREAT_JOB', text: 'Great job!' },
  MSG_LETS_GO: { id: 'MSG_LETS_GO', text: "Let's go!" },
  MSG_PRAYING: { id: 'MSG_PRAYING', text: 'Praying for you.' }
};

// MIME Types for Static Server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

// ============================================================
// 2. PRESENCE STATE (TRANSIENT IN-MEMORY ONLY)
// ============================================================
class PresenceManager {
  constructor(options = {}) {
    this.communityId = options.communityId || 'fog';
    this.instanceCapacity = options.instanceCapacity || DEFAULT_INSTANCE_CAPACITY;
    // Map of roomKey -> Room object
    // roomKey = `${communityId}:${placeId}:${instanceId}`
    this.rooms = new Map();
    // Map of connectionId -> ConnectionData
    this.connections = new Map();
    // Map of memberId -> connectionId (for duplicate session detection)
    this.memberToConnection = new Map();
  }

  // Get or allocate instance for place
  resolveInstance(placeId) {
    const canonicalPlace = CANONICAL_PLACE_MAP[placeId] || placeId;
    let index = 1;
    while (true) {
      const instanceId = `${canonicalPlace}-${String(index).padStart(2, '0')}`;
      const roomKey = `${this.communityId}:${canonicalPlace}:${instanceId}`;
      const room = this.rooms.get(roomKey);
      if (!room || room.members.size < this.instanceCapacity) {
        return { canonicalPlace, instanceId, roomKey };
      }
      index++;
      if (index > 99) { // Safety ceiling
        return { canonicalPlace, instanceId, roomKey };
      }
    }
  }

  getRoom(roomKey) {
    return this.rooms.get(roomKey) || null;
  }

  ensureRoom(roomKey, canonicalPlace, instanceId) {
    if (!this.rooms.has(roomKey)) {
      this.rooms.set(roomKey, {
        roomKey,
        communityId: this.communityId,
        placeId: canonicalPlace,
        instanceId,
        createdAt: Date.now(),
        members: new Map() // connectionId -> PresenceMember
      });
    }
    return this.rooms.get(roomKey);
  }

  joinPlace(connectionId, { memberId, displayName, avatar, placeId, x = 12.0, y = 8.0, facing = 'down' }) {
    const conn = this.connections.get(connectionId);
    if (!conn) return { error: 'UNKNOWN_CONNECTION' };

    // Validate inputs
    const canonicalPlace = CANONICAL_PLACE_MAP[placeId];
    if (!canonicalPlace || !CANONICAL_PLACES.includes(canonicalPlace)) {
      return { error: 'INVALID_PLACE_ID' };
    }

    if (!memberId || typeof memberId !== 'string' || memberId.length > 64) {
      return { error: 'INVALID_MEMBER_ID' };
    }

    const cleanName = String(displayName || memberId).trim().slice(0, 32);
    const cleanAvatar = String(avatar || '🧑').slice(0, 16);
    const numX = Number.isFinite(Number(x)) ? Math.max(0, Math.min(2000, Number(x))) : 12.0;
    const numY = Number.isFinite(Number(y)) ? Math.max(0, Math.min(2000, Number(y))) : 8.0;
    const validFacing = ['up', 'down', 'left', 'right'].includes(facing) ? facing : 'down';

    // Handle existing duplicate session for this member
    const existingConnId = this.memberToConnection.get(memberId);
    if (existingConnId && existingConnId !== connectionId) {
      const oldConn = this.connections.get(existingConnId);
      if (oldConn && oldConn.ws && oldConn.ws.readyState === WebSocket.OPEN) {
        try {
          oldConn.ws.send(JSON.stringify({
            type: 'ERROR',
            code: 'DUPLICATE_SESSION',
            message: 'Signed in from another device or window.'
          }));
          oldConn.ws.close(1000, 'Duplicate session');
        } catch (_) {}
      }
      this.leaveCurrentRoom(existingConnId, 'duplicate_session');
    }

    // Leave any current room on this connection
    if (conn.roomKey) {
      this.leaveCurrentRoom(connectionId, 'switch_place');
    }

    // Allocate instance
    const { instanceId, roomKey } = this.resolveInstance(canonicalPlace);
    const room = this.ensureRoom(roomKey, canonicalPlace, instanceId);

    const now = Date.now();
    const presenceMember = {
      connectionId,
      communityId: this.communityId,
      memberId,
      displayName: cleanName,
      avatar: cleanAvatar,
      placeId: canonicalPlace,
      instanceId,
      x: numX,
      y: numY,
      facing: validFacing,
      lastSequence: 0,
      connectedAt: now,
      lastSeenAt: now
    };

    room.members.set(connectionId, presenceMember);
    conn.memberId = memberId;
    conn.displayName = cleanName;
    conn.avatar = cleanAvatar;
    conn.roomKey = roomKey;
    conn.placeId = canonicalPlace;
    conn.instanceId = instanceId;
    conn.lastSeenAt = now;
    this.memberToConnection.set(memberId, connectionId);

    // Build snapshot of OTHER members in room
    const otherMembers = [];
    room.members.forEach((m, cId) => {
      if (cId !== connectionId) {
        otherMembers.push({
          connectionId: m.connectionId,
          memberId: m.memberId,
          displayName: m.displayName,
          avatar: m.avatar,
          placeId: m.placeId,
          instanceId: m.instanceId,
          x: m.x,
          y: m.y,
          facing: m.facing,
          lastSeenAt: m.lastSeenAt
        });
      }
    });

    return {
      member: presenceMember,
      room,
      otherMembers,
      instanceId,
      placeId: canonicalPlace
    };
  }

  move(connectionId, { seq = 0, x, y, facing, timestamp }) {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.roomKey) return null;

    const room = this.rooms.get(conn.roomKey);
    if (!room) return null;

    const member = room.members.get(connectionId);
    if (!member) return null;

    // Sequence check (must be monotonically increasing)
    const numSeq = Number(seq);
    if (!Number.isInteger(numSeq) || numSeq <= member.lastSequence) {
      // Ignore out-of-order or duplicate packets
      return null;
    }

    const numX = Number(x);
    const numY = Number(y);
    if (!Number.isFinite(numX) || !Number.isFinite(numY) || numX < 0 || numX > 2000 || numY < 0 || numY > 2000) {
      return null;
    }

    const validFacing = ['up', 'down', 'left', 'right'].includes(facing) ? facing : member.facing;
    const now = Date.now();

    member.x = numX;
    member.y = numY;
    member.facing = validFacing;
    member.lastSequence = numSeq;
    member.lastSeenAt = now;
    conn.lastSeenAt = now;

    return {
      room,
      movement: {
        connectionId,
        memberId: member.memberId,
        seq: numSeq,
        x: numX,
        y: numY,
        facing: validFacing,
        timestamp: Number(timestamp) || now
      }
    };
  }

  emote(connectionId, emoteId) {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.roomKey) return { error: 'NOT_IN_ROOM' };

    const room = this.rooms.get(conn.roomKey);
    if (!room) return { error: 'ROOM_NOT_FOUND' };

    const member = room.members.get(connectionId);
    if (!member) return { error: 'MEMBER_NOT_IN_ROOM' };

    const catalogEntry = EMOTE_CATALOG[emoteId];
    if (!catalogEntry) return { error: 'INVALID_EMOTE_ID' };

    const now = Date.now();
    if (conn.lastSocialTime && (now - conn.lastSocialTime) < SOCIAL_RATE_LIMIT_MS) {
      return { error: 'RATE_LIMITED' };
    }
    conn.lastSocialTime = now;
    member.lastSeenAt = now;
    conn.lastSeenAt = now;

    return {
      room,
      payload: {
        connectionId,
        memberId: member.memberId,
        emoteId: catalogEntry.id,
        emoji: catalogEntry.emoji,
        emoteText: catalogEntry.text,
        timestamp: now
      }
    };
  }

  presetMessage(connectionId, messageId) {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.roomKey) return { error: 'NOT_IN_ROOM' };

    const room = this.rooms.get(conn.roomKey);
    if (!room) return { error: 'ROOM_NOT_FOUND' };

    const member = room.members.get(connectionId);
    if (!member) return { error: 'MEMBER_NOT_IN_ROOM' };

    const catalogEntry = PRESET_MESSAGE_CATALOG[messageId];
    if (!catalogEntry) return { error: 'INVALID_PRESET_MESSAGE_ID' };

    const now = Date.now();
    if (conn.lastSocialTime && (now - conn.lastSocialTime) < SOCIAL_RATE_LIMIT_MS) {
      return { error: 'RATE_LIMITED' };
    }
    conn.lastSocialTime = now;
    member.lastSeenAt = now;
    conn.lastSeenAt = now;

    return {
      room,
      payload: {
        connectionId,
        memberId: member.memberId,
        messageId: catalogEntry.id,
        messageText: catalogEntry.text,
        timestamp: now
      }
    };
  }

  leaveCurrentRoom(connectionId, reason = 'leave') {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.roomKey) return null;

    const roomKey = conn.roomKey;
    const room = this.rooms.get(roomKey);
    const memberId = conn.memberId;

    if (room) {
      room.members.delete(connectionId);
      // Clean up empty room
      if (room.members.size === 0) {
        this.rooms.delete(roomKey);
      }
    }

    if (memberId && this.memberToConnection.get(memberId) === connectionId) {
      this.memberToConnection.delete(memberId);
    }

    conn.roomKey = null;
    conn.placeId = null;
    conn.instanceId = null;

    return {
      room,
      roomKey,
      memberId,
      connectionId,
      reason
    };
  }

  removeConnection(connectionId) {
    const leaveResult = this.leaveCurrentRoom(connectionId, 'disconnect');
    this.connections.delete(connectionId);
    return leaveResult;
  }

  cleanStaleConnections(now = Date.now()) {
    const staleList = [];
    this.connections.forEach((conn, cId) => {
      if (now - conn.lastSeenAt > STALE_TIMEOUT_MS) {
        staleList.push(cId);
      }
    });
    return staleList;
  }

  getStatus() {
    const instanceList = [];
    this.rooms.forEach((room) => {
      instanceList.push({
        roomKey: room.roomKey,
        placeId: room.placeId,
        instanceId: room.instanceId,
        memberCount: room.members.size
      });
    });

    return {
      ok: true,
      communityId: this.communityId,
      activeConnections: this.connections.size,
      activeRooms: this.rooms.size,
      instances: instanceList,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: process.memoryUsage()
    };
  }
}

// ============================================================
// 3. HTTP & WEBSOCKET SERVER CREATION
// ============================================================
function createPresenceServer(options = {}) {
  const port = options.port || DEFAULT_PORT;
  const host = options.host || DEFAULT_HOST;
  const presence = new PresenceManager(options);

  // HTTP Request Handler
  const httpServer = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS & JSON Headers for API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Studio API Endpoints (Phase 0.21)
    if (pathname === '/api/studio/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        phase: '0.21.0',
        environment: 'prototype-local',
        draftsCount: studioEngine.store.listDrafts().length,
        publishedCount: studioEngine.store.listPublished().length,
        auditCount: studioEngine.store.getAuditLogs().length,
        canonicalTimezone: studioEngine.CANONICAL_TIMEZONE,
        limits: studioEngine.LIMITS,
        allowedMimeTypes: studioEngine.ALLOWED_MIME_TYPES,
        zeroMutationGuarantee: 'Zero writes to production/staging database or Main FOG App.'
      }, null, 2));
      return;
    }

    if (pathname === '/api/studio/templates') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        templates: studioEngine.TEMPLATES,
        places: studioEngine.CANONICAL_PLACES,
        audiences: studioEngine.CANONICAL_AUDIENCES,
        ministries: studioEngine.CANONICAL_MINISTRIES,
        campfires: studioEngine.CANONICAL_CAMPFIRES,
        targets: studioEngine.PRESENTATION_TARGETS
      }, null, 2));
      return;
    }

    if (pathname === '/api/studio/media') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        media: studioEngine.DEMO_MEDIA_LIBRARY,
        allowedMimeTypes: studioEngine.ALLOWED_MIME_TYPES
      }, null, 2));
      return;
    }

    if (pathname === '/api/studio/audit' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        logs: studioEngine.store.getAuditLogs()
      }, null, 2));
      return;
    }

    if (pathname === '/api/studio/validate' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = studioEngine.validateTemplateData(payload.templateType, payload.data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valid: false, errors: { _general: 'Invalid JSON payload.' } }));
        }
      });
      return;
    }

    if (pathname === '/api/studio/publish' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = studioEngine.store.publishDraft(payload.draftId, payload.actor || { role: 'SUPERADMIN' });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Health / Status API
    if (pathname === '/api/presence/status' || pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(presence.getStatus(), null, 2));
      return;
    }

    // Static File Serving
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '') {
      safePath = '/index.html';
    }

    const filePath = path.join(STATIC_DIR, safePath);
    // Boundary check to stay within STATIC_DIR
    if (!filePath.startsWith(STATIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  });

  // WebSocket Server Setup
  const wss = new WebSocket.Server({
    noServer: true,
    maxPayload: MAX_PAYLOAD_BYTES
  });

  // Handle Upgrade
  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    // Accept /realtime, /ws, or /
    if (pathname === '/realtime' || pathname === '/ws' || pathname === '/') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  let connectionCounter = 0;

  // Broadcast Helper
  function broadcastToRoom(room, messageObj, excludeConnectionId = null) {
    if (!room || !room.members) return;
    const data = JSON.stringify(messageObj);
    room.members.forEach((_, cId) => {
      if (excludeConnectionId && cId === excludeConnectionId) return;
      const conn = presence.connections.get(cId);
      if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        try {
          conn.ws.send(data);
        } catch (_) {}
      }
    });
  }

  wss.on('connection', (ws, req) => {
    const connectionId = `conn_${Date.now()}_${++connectionCounter}`;
    const now = Date.now();

    presence.connections.set(connectionId, {
      connectionId,
      ws,
      memberId: null,
      displayName: null,
      avatar: null,
      roomKey: null,
      placeId: null,
      instanceId: null,
      lastSeenAt: now,
      lastPing: now,
      lastSocialTime: 0,
      isAlive: true
    });

    // Send initial welcome message
    try {
      ws.send(JSON.stringify({
        type: 'WELCOME',
        connectionId,
        communityId: presence.communityId,
        serverTime: now,
        protocolVersion: PROTOCOL_VERSION,
        config: {
          instanceCapacity: presence.instanceCapacity,
          socialRateLimitMs: SOCIAL_RATE_LIMIT_MS,
          emotes: Object.keys(EMOTE_CATALOG),
          presetMessages: Object.keys(PRESET_MESSAGE_CATALOG)
        }
      }));
    } catch (_) {}

    ws.on('pong', () => {
      const conn = presence.connections.get(connectionId);
      if (conn) {
        conn.isAlive = true;
        conn.lastSeenAt = Date.now();
      }
    });

    ws.on('message', (rawMessage) => {
      const conn = presence.connections.get(connectionId);
      if (!conn) return;

      conn.lastSeenAt = Date.now();
      let msg = null;

      try {
        const text = typeof rawMessage === 'string' ? rawMessage : rawMessage.toString('utf8');
        msg = JSON.parse(text);
      } catch (err) {
        try {
          ws.send(JSON.stringify({ type: 'ERROR', code: 'MALFORMED_JSON', message: 'Invalid JSON frame.' }));
        } catch (_) {}
        return;
      }

      if (!msg || typeof msg !== 'object' || !msg.type || typeof msg.type !== 'string') {
        try {
          ws.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_SCHEMA', message: 'Message must have a valid type string.' }));
        } catch (_) {}
        return;
      }

      switch (msg.type) {
        case 'JOIN_PLACE': {
          const res = presence.joinPlace(connectionId, msg);
          if (res.error) {
            ws.send(JSON.stringify({ type: 'ERROR', code: res.error, message: `Failed to join place: ${res.error}` }));
            return;
          }

          // 1. Send snapshot to joiner
          ws.send(JSON.stringify({
            type: 'PRESENCE_SNAPSHOT',
            placeId: res.placeId,
            instanceId: res.instanceId,
            self: {
              connectionId,
              memberId: res.member.memberId,
              displayName: res.member.displayName,
              avatar: res.member.avatar,
              x: res.member.x,
              y: res.member.y,
              facing: res.member.facing
            },
            members: res.otherMembers,
            memberCount: res.room.members.size
          }));

          // 2. Broadcast MEMBER_JOINED to existing members
          broadcastToRoom(res.room, {
            type: 'MEMBER_JOINED',
            member: {
              connectionId,
              memberId: res.member.memberId,
              displayName: res.member.displayName,
              avatar: res.member.avatar,
              placeId: res.placeId,
              instanceId: res.instanceId,
              x: res.member.x,
              y: res.member.y,
              facing: res.member.facing,
              lastSeenAt: res.member.lastSeenAt
            },
            memberCount: res.room.members.size
          }, connectionId);

          // 3. Broadcast ROOM_STATE update
          broadcastToRoom(res.room, {
            type: 'ROOM_STATE',
            placeId: res.placeId,
            instanceId: res.instanceId,
            memberCount: res.room.members.size
          });
          break;
        }

        case 'MOVE': {
          const res = presence.move(connectionId, msg);
          if (res && res.movement) {
            broadcastToRoom(res.room, {
              type: 'MEMBER_MOVED',
              ...res.movement
            }, connectionId);
          }
          break;
        }

        case 'EMOTE': {
          const res = presence.emote(connectionId, msg.emoteId);
          if (res.error) {
            ws.send(JSON.stringify({ type: 'ERROR', code: res.error, message: `Emote rejected: ${res.error}` }));
            return;
          }
          broadcastToRoom(res.room, {
            type: 'MEMBER_EMOTE',
            ...res.payload
          });
          break;
        }

        case 'PRESET_MESSAGE': {
          // Reject any custom free-text property!
          if (msg.text !== undefined || msg.customText !== undefined || msg.body !== undefined) {
            ws.send(JSON.stringify({ type: 'ERROR', code: 'FREE_TEXT_NOT_ALLOWED', message: 'Free text chat is not permitted.' }));
            return;
          }
          const res = presence.presetMessage(connectionId, msg.messageId);
          if (res.error) {
            ws.send(JSON.stringify({ type: 'ERROR', code: res.error, message: `Preset message rejected: ${res.error}` }));
            return;
          }
          broadcastToRoom(res.room, {
            type: 'MEMBER_PRESET_MESSAGE',
            ...res.payload
          });
          break;
        }

        case 'LEAVE_PLACE': {
          const leaveResult = presence.leaveCurrentRoom(connectionId, 'leave');
          if (leaveResult && leaveResult.room) {
            broadcastToRoom(leaveResult.room, {
              type: 'MEMBER_LEFT',
              connectionId,
              memberId: leaveResult.memberId,
              reason: 'leave',
              memberCount: leaveResult.room.members.size
            });
            broadcastToRoom(leaveResult.room, {
              type: 'ROOM_STATE',
              placeId: leaveResult.room.placeId,
              instanceId: leaveResult.room.instanceId,
              memberCount: leaveResult.room.members.size
            });
          }
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({
            type: 'PONG',
            clientTimestamp: msg.timestamp,
            serverTimestamp: Date.now()
          }));
          break;
        }

        default: {
          ws.send(JSON.stringify({
            type: 'ERROR',
            code: 'UNKNOWN_MESSAGE_TYPE',
            message: `Message type '${msg.type}' is unrecognized.`
          }));
          break;
        }
      }
    });

    ws.on('close', () => {
      const leaveResult = presence.removeConnection(connectionId);
      if (leaveResult && leaveResult.room) {
        broadcastToRoom(leaveResult.room, {
          type: 'MEMBER_LEFT',
          connectionId,
          memberId: leaveResult.memberId,
          reason: leaveResult.reason || 'disconnect',
          memberCount: leaveResult.room.members.size
        });
        broadcastToRoom(leaveResult.room, {
          type: 'ROOM_STATE',
          placeId: leaveResult.room.placeId,
          instanceId: leaveResult.room.instanceId,
          memberCount: leaveResult.room.members.size
        });
      }
    });

    ws.on('error', () => {
      ws.close();
    });
  });

  // Heartbeat & Stale Connection Sweeper
  const heartbeatTimer = setInterval(() => {
    const now = Date.now();
    presence.connections.forEach((conn, cId) => {
      if (!conn.isAlive) {
        // Did not pong in time, terminate
        if (conn.ws) {
          try { conn.ws.terminate(); } catch (_) {}
        }
        const leaveResult = presence.removeConnection(cId);
        if (leaveResult && leaveResult.room) {
          broadcastToRoom(leaveResult.room, {
            type: 'MEMBER_LEFT',
            connectionId: cId,
            memberId: leaveResult.memberId,
            reason: 'timeout',
            memberCount: leaveResult.room.members.size
          });
        }
        return;
      }

      conn.isAlive = false;
      if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        try { conn.ws.ping(); } catch (_) {}
      }
    });
  }, HEARTBEAT_INTERVAL_MS);

  // Clean shutdown helper
  function close(callback) {
    clearInterval(heartbeatTimer);
    wss.close(() => {
      httpServer.close(callback);
    });
  }

  function listen(cb) {
    httpServer.listen(port, host, () => {
      if (cb) cb(port, host);
    });
  }

  return {
    httpServer,
    wss,
    presence,
    listen,
    close,
    port,
    host
  };
}

// ============================================================
// 4. STANDALONE EXECUTION
// ============================================================
if (require.main === module) {
  const port = parseInt(process.env.PORT || DEFAULT_PORT, 10);
  const host = process.env.HOST || DEFAULT_HOST;

  const server = createPresenceServer({ port, host });
  server.listen((p, h) => {
    console.log('========================================================');
    console.log(`KOINONIA Phase 0.20.2 Real-Time Presence Server RUNNING`);
    console.log(`HTTP URL:       http://${h === '0.0.0.0' ? '127.0.0.1' : h}:${p}/`);
    console.log(`WebSocket URL:  ws://${h === '0.0.0.0' ? '127.0.0.1' : h}:${p}/realtime`);
    console.log(`Status API:     http://${h === '0.0.0.0' ? '127.0.0.1' : h}:${p}/api/presence/status`);
    console.log(`Static Root:    ${STATIC_DIR}`);
    console.log('========================================================');
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down Koinonia Real-Time Presence Server...');
    server.close(() => {
      console.log('Server terminated cleanly.');
      process.exit(0);
    });
  });
}

module.exports = {
  createPresenceServer,
  PresenceManager,
  CANONICAL_PLACES,
  CANONICAL_PLACE_MAP,
  EMOTE_CATALOG,
  PRESET_MESSAGE_CATALOG,
  DEFAULT_PORT,
  DEFAULT_HOST,
  PROTOCOL_VERSION
};
