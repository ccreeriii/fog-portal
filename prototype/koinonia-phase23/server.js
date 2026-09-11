/**
 * KOINONIA — PHASE 0.22.1 INTERNET BETA SERVER
 * Secure Public Beta Server with Real-Time Presence & PWA Support
 *
 * Capabilities:
 * 1. Dedicated standalone HTTP & WSS server for koinonia-beta.fogmin.site.
 * 2. Static file serving with strict security headers & traversal protection.
 * 3. Health & Status endpoints (/health, /api/health).
 * 4. Gated/protected QA endpoints (no public exposure of internal test harnesses).
 * 5. Real-time WebSocket presence endpoint on /realtime (supporting WSS over Cloudflare Tunnel).
 * 6. In-memory presence management scoped by community ("fog") and place/room.
 * 7. Safe structured social actions (5 emotes, 5 preset messages, zero free text).
 * 8. Rate limiting, heartbeat, stale client cleanup, duplicate session handling.
 * 9. Auto-instancing (default 30 members/instance, max 50).
 * 10. Zero database mutations (transient memory only; isolated from Main App DBs).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const WebSocket = require("ws");
const studioEngine = require("./data/studio_engine.js");

// ============================================================
// 1. CONFIGURATION & CONSTANTS
// ============================================================
const DEFAULT_PORT = 3005;
const DEFAULT_HOST = "0.0.0.0";
const STATIC_DIR = __dirname;
const PROTOCOL_VERSION = 1;
const MAX_PAYLOAD_BYTES = 8192; // 8KB
const DEFAULT_INSTANCE_CAPACITY = 30;
const MAX_INSTANCE_CAPACITY = 50;
const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
const STALE_TIMEOUT_MS = 45000;       // 45 seconds
const SOCIAL_RATE_LIMIT_MS = 1000;    // 1 action / second max
const MAX_HTTP_BODY_BYTES = 102400;   // 100KB

// Standard Security Headers
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' wss: ws:; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';"
};

// Canonical Places (support both kebab and snake case)
const CANONICAL_PLACE_MAP = {
  "home": "home",
  "my-home": "home",
  "my_home": "home",
  "school": "school",
  "fog_center": "fog_center",
  "fog-community-center": "fog_center",
  "fog_community_center": "fog_center",
  "sports_hub": "sports_hub",
  "sports-hub": "sports_hub",
  "outreach_site": "outreach_site",
  "outreach-site": "outreach_site"
};

const CANONICAL_PLACES = ["home", "school", "fog_center", "sports_hub", "outreach_site"];

// Safe Structured Emotes (Zero LP/XP, purely encouraging)
const EMOTE_CATALOG = {
  ENCOURAGE: { id: "ENCOURAGE", emoji: "👏", text: "Encourage" },
  PRAYING: { id: "PRAYING", emoji: "🙏", text: "Praying" },
  KEEP_GOING: { id: "KEEP_GOING", emoji: "🔥", text: "Keep Going" },
  GROWING_TOGETHER: { id: "GROWING_TOGETHER", emoji: "🌱", text: "Growing Together" },
  GREAT_JOB: { id: "GREAT_JOB", emoji: "❤️", text: "Great Job" }
};

// Approved Preset Messages (Strictly fixed catalog, zero free-text)
const PRESET_MESSAGE_CATALOG = {
  MSG_HI: { id: "MSG_HI", text: "Hi!" },
  MSG_GOD_BLESS: { id: "MSG_GOD_BLESS", text: "God bless!" },
  MSG_GREAT_JOB: { id: "MSG_GREAT_JOB", text: "Great job!" },
  MSG_LETS_GO: { id: "MSG_LETS_GO", text: "Let's go!" },
  MSG_PRAYING: { id: "MSG_PRAYING", text: "Praying for you." }
};

// MIME Types for Static Server
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

// Sensitive file patterns strictly rejected
const SENSITIVE_EXTENSIONS = new Set([
  ".db", ".sqlite", ".sqlite3", ".wal", ".shm", ".bak", ".old",
  ".env", ".token", ".pem", ".key", ".jsonl", ".log"
]);

// ============================================================
// 2. PRESENCE STATE (TRANSIENT IN-MEMORY ONLY)
// ============================================================
class PresenceManager {
  constructor(options = {}) {
    this.communityId = options.communityId || "fog";
    this.instanceCapacity = options.instanceCapacity || DEFAULT_INSTANCE_CAPACITY;
    this.rooms = new Map();
    this.connections = new Map();
    this.memberToConnection = new Map();
  }

  resolveInstance(placeId) {
    const canonicalPlace = CANONICAL_PLACE_MAP[placeId] || placeId;
    let index = 1;
    while (true) {
      const instanceId = `${canonicalPlace}-${String(index).padStart(2, "0")}`;
      const roomKey = `${this.communityId}:${canonicalPlace}:${instanceId}`;
      const room = this.rooms.get(roomKey);
      if (!room || room.members.size < this.instanceCapacity) {
        return { canonicalPlace, instanceId, roomKey };
      }
      index++;
      if (index > 99) {
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
        members: new Map()
      });
    }
    return this.rooms.get(roomKey);
  }

  joinPlace(connectionId, { memberId, displayName, avatar, placeId, x = 12.0, y = 8.0, facing = "down" }) {
    const conn = this.connections.get(connectionId);
    if (!conn) return { error: "UNKNOWN_CONNECTION" };

    const canonicalPlace = CANONICAL_PLACE_MAP[placeId];
    if (!canonicalPlace || !CANONICAL_PLACES.includes(canonicalPlace)) {
      return { error: "INVALID_PLACE_ID" };
    }

    if (!memberId || typeof memberId !== "string" || memberId.length > 64) {
      return { error: "INVALID_MEMBER_ID" };
    }

    const cleanName = String(displayName || memberId).trim().slice(0, 32);
    const cleanAvatar = String(avatar || "🧑").slice(0, 16);
    const numX = Number.isFinite(Number(x)) ? Math.max(0, Math.min(2000, Number(x))) : 12.0;
    const numY = Number.isFinite(Number(y)) ? Math.max(0, Math.min(2000, Number(y))) : 8.0;
    const validFacing = ["up", "down", "left", "right"].includes(facing) ? facing : "down";

    // Handle existing duplicate session for this member
    const existingConnId = this.memberToConnection.get(memberId);
    if (existingConnId && existingConnId !== connectionId) {
      const oldConn = this.connections.get(existingConnId);
      if (oldConn && oldConn.ws && oldConn.ws.readyState === WebSocket.OPEN) {
        try {
          oldConn.ws.send(JSON.stringify({
            type: "ERROR",
            code: "DUPLICATE_SESSION",
            message: "Signed in from another device or window."
          }));
          oldConn.ws.close(1000, "Duplicate session");
        } catch (_) {}
      }
      this.leaveCurrentRoom(existingConnId, "duplicate_session");
    }

    if (conn.roomKey) {
      this.leaveCurrentRoom(connectionId, "switch_place");
    }

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

    const numSeq = Number(seq);
    if (!Number.isInteger(numSeq) || numSeq <= member.lastSequence) {
      return null;
    }

    const numX = Number(x);
    const numY = Number(y);
    if (!Number.isFinite(numX) || !Number.isFinite(numY) || numX < 0 || numX > 2000 || numY < 0 || numY > 2000) {
      return null;
    }

    const validFacing = ["up", "down", "left", "right"].includes(facing) ? facing : member.facing;
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
    if (!conn || !conn.roomKey) return { error: "NOT_IN_ROOM" };

    const room = this.rooms.get(conn.roomKey);
    if (!room) return { error: "ROOM_NOT_FOUND" };

    const member = room.members.get(connectionId);
    if (!member) return { error: "MEMBER_NOT_IN_ROOM" };

    const catalogEntry = EMOTE_CATALOG[emoteId];
    if (!catalogEntry) return { error: "INVALID_EMOTE_ID" };

    const now = Date.now();
    if (conn.lastSocialTime && (now - conn.lastSocialTime) < SOCIAL_RATE_LIMIT_MS) {
      return { error: "RATE_LIMITED" };
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
    if (!conn || !conn.roomKey) return { error: "NOT_IN_ROOM" };

    const room = this.rooms.get(conn.roomKey);
    if (!room) return { error: "ROOM_NOT_FOUND" };

    const member = room.members.get(connectionId);
    if (!member) return { error: "MEMBER_NOT_IN_ROOM" };

    const catalogEntry = PRESET_MESSAGE_CATALOG[messageId];
    if (!catalogEntry) return { error: "INVALID_PRESET_MESSAGE_ID" };

    const now = Date.now();
    if (conn.lastSocialTime && (now - conn.lastSocialTime) < SOCIAL_RATE_LIMIT_MS) {
      return { error: "RATE_LIMITED" };
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

  leaveCurrentRoom(connectionId, reason = "leave") {
    const conn = this.connections.get(connectionId);
    if (!conn || !conn.roomKey) return null;

    const room = this.rooms.get(conn.roomKey);
    const memberId = conn.memberId;
    if (room) {
      room.members.delete(connectionId);
      if (room.members.size === 0) {
        this.rooms.delete(conn.roomKey);
      }
    }

    conn.roomKey = null;
    conn.placeId = null;
    conn.instanceId = null;

    return { room, memberId, reason };
  }

  removeConnection(connectionId) {
    const leaveResult = this.leaveCurrentRoom(connectionId, "disconnect");
    const conn = this.connections.get(connectionId);
    if (conn && conn.memberId) {
      if (this.memberToConnection.get(conn.memberId) === connectionId) {
        this.memberToConnection.delete(conn.memberId);
      }
    }
    this.connections.delete(connectionId);
    return leaveResult;
  }

  getStatus() {
    let totalMembers = 0;
    const roomSummaries = [];
    this.rooms.forEach(r => {
      totalMembers += r.members.size;
      roomSummaries.push({
        roomKey: r.roomKey,
        placeId: r.placeId,
        instanceId: r.instanceId,
        memberCount: r.members.size
      });
    });

    return {
      status: "online",
      service: "koinonia-beta",
      communityId: this.communityId,
      totalConnections: this.connections.size,
      activeMembers: totalMembers,
      activeRoomsCount: this.rooms.size,
      rooms: roomSummaries
    };
  }
}

// ============================================================
// 3. SERVER FACTORY
// ============================================================
function createBetaServer(options = {}) {
  const port = options.port || DEFAULT_PORT;
  const host = options.host || DEFAULT_HOST;
  const presence = new PresenceManager({
    communityId: "fog",
    instanceCapacity: DEFAULT_INSTANCE_CAPACITY
  });

  let connectionSeq = 0;

  // Helper to send to a room
  function broadcastToRoom(room, messageObj, excludeConnectionId = null) {
    if (!room) return;
    const msgString = JSON.stringify(messageObj);
    room.members.forEach((_, cId) => {
      if (cId !== excludeConnectionId) {
        const c = presence.connections.get(cId);
        if (c && c.ws && c.ws.readyState === WebSocket.OPEN) {
          try { c.ws.send(msgString); } catch (_) {}
        }
      }
    });
  }

  // HTTP Request Handler
  const httpServer = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname || "/";

    // 1. Health Endpoints (Lightweight, non-sensitive, for monitoring and ingress checks)
    if (pathname === "/health" || pathname === "/api/health") {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify({
        status: "healthy",
        service: "koinonia-beta",
        phase: "0.22.1",
        version: "0.22.1",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      }, null, 2));
      return;
    }

    // 2. Presence Status API
    if (pathname === "/api/presence/status" || pathname === "/status") {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify(presence.getStatus(), null, 2));
      return;
    }

    // 3. Studio Engine APIs (Prototype-local, zero DB writes)
    if (pathname === "/api/studio/status") {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify({
        ok: true,
        phase: "0.22.1",
        environment: "internet-beta-isolated",
        draftsCount: studioEngine.store.listDrafts().length,
        publishedCount: studioEngine.store.listPublished().length,
        auditCount: studioEngine.store.getAuditLogs().length,
        canonicalTimezone: studioEngine.CANONICAL_TIMEZONE,
        limits: studioEngine.LIMITS,
        allowedMimeTypes: studioEngine.ALLOWED_MIME_TYPES,
        zeroMutationGuarantee: "Zero writes to production/staging database or Main FOG App."
      }, null, 2));
      return;
    }

    if (pathname === "/api/studio/templates") {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        ...SECURITY_HEADERS
      });
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

    if (pathname === "/api/studio/media") {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        ...SECURITY_HEADERS
      });
      res.end(JSON.stringify({
        ok: true,
        media: studioEngine.DEMO_MEDIA_LIBRARY,
        allowedMimeTypes: studioEngine.ALLOWED_MIME_TYPES
      }, null, 2));
      return;
    }

    if (pathname === "/api/studio/validate" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => {
        body += chunk;
        if (body.length > MAX_HTTP_BODY_BYTES) {
          res.writeHead(413, { "Content-Type": "application/json", ...SECURITY_HEADERS });
          res.end(JSON.stringify({ valid: false, error: "Payload Too Large" }));
          req.destroy();
        }
      });
      req.on("end", () => {
        try {
          const payload = JSON.parse(body || "{}");
          const result = studioEngine.validateTemplateData(payload.templateType, payload.data);
          res.writeHead(200, { "Content-Type": "application/json", ...SECURITY_HEADERS });
          res.end(JSON.stringify(result));
        } catch (_) {
          res.writeHead(400, { "Content-Type": "application/json", ...SECURITY_HEADERS });
          res.end(JSON.stringify({ valid: false, errors: { _general: "Invalid JSON payload." } }));
        }
      });
      return;
    }

    // 4. Security & QA Route Protection
    // Block internal test harnesses from being discoverable publicly
    if (pathname.includes("_test.html") || pathname.endsWith("load_test.js") || pathname.includes("/test_")) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
      res.end("Not Found");
      return;
    }

    // Block hidden files (.git, .env, etc.)
    if (pathname.startsWith("/.") || pathname.includes("/.")) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
      res.end("Not Found");
      return;
    }

    // Path traversal protection
    const decodedPathname = decodeURIComponent(pathname);
    let safePath = path.normalize(decodedPathname).replace(/^(..[\/])+/, "");
    if (safePath === "/" || safePath === "") {
      safePath = "/index.html";
    } else if (safePath === "/favicon.ico") {
      safePath = "/assets/branding/favicon.ico";
    }

    const filePath = path.join(STATIC_DIR, safePath);
    if (!filePath.startsWith(STATIC_DIR)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
      res.end("Forbidden");
      return;
    }

    // Check extension against sensitive patterns
    const ext = path.extname(filePath).toLowerCase();
    if (SENSITIVE_EXTENSIONS.has(ext)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
      res.end("Not Found");
      return;
    }

    // Static file serving
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
        res.end("Not Found");
        return;
      }

      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      // Phase 0.22.1: PWA update-critical resources must never become
      // trapped behind a long browser/CDN cache. The service worker and
      // HTML shell must always revalidate against the origin.
      const cacheHeaders =
        safePath === "/sw.js" || safePath === "/index.html"
          ? {
              "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
              "CDN-Cache-Control": "no-store",
              "Cloudflare-CDN-Cache-Control": "no-store",
              "Pragma": "no-cache",
              "Expires": "0"
            }
          : {};

      res.writeHead(200, {
        "Content-Type": contentType,
        ...SECURITY_HEADERS,
        ...cacheHeaders
      });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  });

  // WebSocket Server Setup
  const wss = new WebSocket.Server({
    noServer: true,
    maxPayload: MAX_PAYLOAD_BYTES
  });

  // Upgrade handler (accepts /realtime, /ws, or /)
  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    if (pathname === "/realtime" || pathname === "/ws" || pathname === "/") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws, request) => {
    const connectionId = `conn_${Date.now()}_${++connectionSeq}`;
    presence.connections.set(connectionId, {
      connectionId,
      ws,
      memberId: null,
      displayName: null,
      avatar: null,
      roomKey: null,
      placeId: null,
      instanceId: null,
      lastSeenAt: Date.now(),
      lastSocialTime: 0,
      isAlive: true
    });

    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
      const c = presence.connections.get(connectionId);
      if (c) {
        c.isAlive = true;
        c.lastSeenAt = Date.now();
      }
    });

    // Send Welcome
    ws.send(JSON.stringify({
      type: "WELCOME",
      connectionId,
      version: PROTOCOL_VERSION,
      communityId: presence.communityId,
      timestamp: Date.now()
    }));

    ws.on("message", (raw) => {
      if (raw.length > MAX_PAYLOAD_BYTES) {
        ws.send(JSON.stringify({ type: "ERROR", code: "PAYLOAD_TOO_LARGE", message: "Packet exceeds 8KB limit." }));
        return;
      }

      let msg;
      try {
        msg = JSON.parse(raw.toString("utf8"));
      } catch (_) {
        ws.send(JSON.stringify({ type: "ERROR", code: "INVALID_JSON", message: "Malformed JSON packet." }));
        return;
      }

      if (!msg || typeof msg !== "object" || !msg.type) {
        ws.send(JSON.stringify({ type: "ERROR", code: "MISSING_TYPE", message: "Packet missing type field." }));
        return;
      }

      const conn = presence.connections.get(connectionId);
      if (!conn) return;
      conn.lastSeenAt = Date.now();

      switch (msg.type) {
        case "JOIN_PLACE": {
          const res = presence.joinPlace(connectionId, {
            memberId: msg.memberId,
            displayName: msg.displayName,
            avatar: msg.avatar,
            placeId: msg.placeId,
            x: msg.x,
            y: msg.y,
            facing: msg.facing
          });

          if (res.error) {
            ws.send(JSON.stringify({ type: "ERROR", code: res.error, message: `Join failed: ${res.error}` }));
            return;
          }

          ws.send(JSON.stringify({
            type: "PRESENCE_SNAPSHOT",
            communityId: presence.communityId,
            placeId: res.placeId,
            instanceId: res.instanceId,
            members: res.otherMembers,
            self: {
              connectionId,
              memberId: res.member.memberId,
              displayName: res.member.displayName,
              avatar: res.member.avatar,
              x: res.member.x,
              y: res.member.y,
              facing: res.member.facing
            },
            timestamp: Date.now()
          }));

          broadcastToRoom(res.room, {
            type: "MEMBER_JOINED",
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

          broadcastToRoom(res.room, {
            type: "ROOM_STATE",
            placeId: res.room.placeId,
            instanceId: res.room.instanceId,
            memberCount: res.room.members.size
          });
          break;
        }

        case "MOVE": {
          const res = presence.move(connectionId, {
            seq: msg.seq,
            x: msg.x,
            y: msg.y,
            facing: msg.facing,
            timestamp: msg.timestamp
          });

          if (res) {
            broadcastToRoom(res.room, {
              type: "MEMBER_MOVED",
              ...res.movement
            }, connectionId);
          }
          break;
        }

        case "EMOTE": {
          const res = presence.emote(connectionId, msg.emoteId);
          if (res.error) {
            ws.send(JSON.stringify({ type: "ERROR", code: res.error, message: `Emote rejected: ${res.error}` }));
            return;
          }
          broadcastToRoom(res.room, {
            type: "MEMBER_EMOTE",
            ...res.payload
          });
          break;
        }

        case "PRESET_MESSAGE": {
          if (msg.text !== undefined || msg.customText !== undefined || msg.body !== undefined) {
            ws.send(JSON.stringify({ type: "ERROR", code: "FREE_TEXT_NOT_ALLOWED", message: "Free text chat is not permitted." }));
            return;
          }
          const res = presence.presetMessage(connectionId, msg.messageId);
          if (res.error) {
            ws.send(JSON.stringify({ type: "ERROR", code: res.error, message: `Preset message rejected: ${res.error}` }));
            return;
          }
          broadcastToRoom(res.room, {
            type: "MEMBER_PRESET_MESSAGE",
            ...res.payload
          });
          break;
        }

        case "LEAVE_PLACE": {
          const leaveResult = presence.leaveCurrentRoom(connectionId, "leave");
          if (leaveResult && leaveResult.room) {
            broadcastToRoom(leaveResult.room, {
              type: "MEMBER_LEFT",
              connectionId,
              memberId: leaveResult.memberId,
              reason: "leave",
              memberCount: leaveResult.room.members.size
            });
            broadcastToRoom(leaveResult.room, {
              type: "ROOM_STATE",
              placeId: leaveResult.room.placeId,
              instanceId: leaveResult.room.instanceId,
              memberCount: leaveResult.room.members.size
            });
          }
          break;
        }

        case "PING": {
          ws.send(JSON.stringify({
            type: "PONG",
            clientTimestamp: msg.timestamp,
            serverTimestamp: Date.now()
          }));
          break;
        }

        default: {
          ws.send(JSON.stringify({
            type: "ERROR",
            code: "UNKNOWN_MESSAGE_TYPE",
            message: `Message type "${msg.type}" is unrecognized.`
          }));
          break;
        }
      }
    });

    ws.on("close", () => {
      const leaveResult = presence.removeConnection(connectionId);
      if (leaveResult && leaveResult.room) {
        broadcastToRoom(leaveResult.room, {
          type: "MEMBER_LEFT",
          connectionId,
          memberId: leaveResult.memberId,
          reason: leaveResult.reason || "disconnect",
          memberCount: leaveResult.room.members.size
        });
        broadcastToRoom(leaveResult.room, {
          type: "ROOM_STATE",
          placeId: leaveResult.room.placeId,
          instanceId: leaveResult.room.instanceId,
          memberCount: leaveResult.room.members.size
        });
      }
    });

    ws.on("error", () => {
      ws.close();
    });
  });

  // Heartbeat & Stale Connection Sweeper
  const heartbeatTimer = setInterval(() => {
    presence.connections.forEach((conn, cId) => {
      if (!conn.isAlive) {
        if (conn.ws) {
          try { conn.ws.terminate(); } catch (_) {}
        }
        const leaveResult = presence.removeConnection(cId);
        if (leaveResult && leaveResult.room) {
          broadcastToRoom(leaveResult.room, {
            type: "MEMBER_LEFT",
            connectionId: cId,
            memberId: leaveResult.memberId,
            reason: "timeout",
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

  const server = createBetaServer({ port, host });
  server.listen((p, h) => {
    console.log("========================================================");
    console.log(`KOINONIA Phase 0.22.1 Internet Beta Server RUNNING`);
    console.log(`HTTP URL:       http://${h === "0.0.0.0" ? "127.0.0.1" : h}:${p}/`);
    console.log(`Health API:     http://${h === "0.0.0.0" ? "127.0.0.1" : h}:${p}/health`);
    console.log(`WebSocket URL:  ws://${h === "0.0.0.0" ? "127.0.0.1" : h}:${p}/realtime`);
    console.log(`Public Domain:  https://koinonia-beta.fogmin.site/`);
    console.log(`Static Root:    ${STATIC_DIR}`);
    console.log("========================================================");
  });

  const shutdown = () => {
    console.log("\nShutting down Koinonia Internet Beta Server...");
    server.close(() => {
      console.log("Server terminated cleanly.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

module.exports = {
  createBetaServer,
  PresenceManager,
  CANONICAL_PLACES,
  CANONICAL_PLACE_MAP,
  EMOTE_CATALOG,
  PRESET_MESSAGE_CATALOG,
  DEFAULT_PORT,
  DEFAULT_HOST,
  PROTOCOL_VERSION
};
