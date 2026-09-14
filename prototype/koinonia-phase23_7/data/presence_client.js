/**
 * KOINONIA — PHASE 0.20.2 REAL-TIME PRESENCE CLIENT
 * Real-Time Shared Presence & Safe Social Interaction Client SDK
 *
 * Core Principles:
 * 1. Scoped strictly by place/room (No cross-place leakage).
 * 2. Transient in-memory representation.
 * 3. Rate-limited movement transmission (8-12 updates/sec).
 * 4. Client-side linear interpolation (lerp) for smooth remote movement.
 * 5. Safe structured social actions (5 emotes, 5 preset messages, zero free-text).
 * 6. Heartbeat, reconnect support, room resynchronization.
 */

(function () {
  'use strict';

  // Catalogs
  const EMOTE_CATALOG = {
    ENCOURAGE: { id: 'ENCOURAGE', emoji: '👏', text: 'Encourage' },
    PRAYING: { id: 'PRAYING', emoji: '🙏', text: 'Praying' },
    KEEP_GOING: { id: 'KEEP_GOING', emoji: '🔥', text: 'Keep Going' },
    GROWING_TOGETHER: { id: 'GROWING_TOGETHER', emoji: '🌱', text: 'Growing Together' },
    GREAT_JOB: { id: 'GREAT_JOB', emoji: '❤️', text: 'Great Job' }
  };

  const PRESET_MESSAGE_CATALOG = {
    MSG_HI: { id: 'MSG_HI', text: 'Hi!' },
    MSG_GOD_BLESS: { id: 'MSG_GOD_BLESS', text: 'God bless!' },
    MSG_GREAT_JOB: { id: 'MSG_GREAT_JOB', text: 'Great job!' },
    MSG_LETS_GO: { id: 'MSG_LETS_GO', text: "Let's go!" },
    MSG_PRAYING: { id: 'MSG_PRAYING', text: 'Praying for you.' }
  };

  class KoinoniaPresenceClient {
    constructor(options = {}) {
      this.host = options.host || (typeof window !== 'undefined' && window.location ? window.location.hostname : '127.0.0.1');
      this.port = options.port || (typeof window !== 'undefined' && window.location && window.location.port ? window.location.port : 3005);
      this.path = options.path || '/realtime';
      this.wsUrl = options.wsUrl || null;
      this.autoReconnect = options.autoReconnect !== false;

      this.ws = null;
      this.connectionStatus = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, CONNECTED
      this.connectionId = null;
      this.communityId = 'fog';
      this.currentPlaceId = null;
      this.currentInstanceId = null;
      this.memberCount = 1;

      // Local Identity & Movement State
      this.localMember = {
        memberId: options.memberId || 'youth_demo_01',
        displayName: options.displayName || 'Alex Rivera',
        avatar: options.avatar || '🧑',
        x: 12.0,
        y: 8.0,
        facing: 'down'
      };

      this.sequenceNumber = 0;
      this.lastSentMove = { x: null, y: null, facing: null, time: 0 };
      this.moveThrottleMs = 100; // ~10 updates/second

      // Remote Members Map (connectionId -> member)
      this.remoteMembers = new Map();

      // Event Listeners
      this.listeners = new Map();

      // Timers
      this.pingInterval = null;
      this.reconnectTimer = null;
      this.reconnectAttempts = 0;
    }

    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event).add(callback);
      return () => this.off(event, callback);
    }

    off(event, callback) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).delete(callback);
      }
    }

    emit(event, data) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).forEach(cb => {
          try { cb(data); } catch (e) { console.error('PresenceClient listener error:', e); }
        });
      }
    }

    getWebSocketUrl() {
      if (this.wsUrl) return this.wsUrl;
      if (typeof window !== 'undefined' && window.location && window.location.host) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}${this.path}`;
      }
      const host = this.host === '0.0.0.0' ? '127.0.0.1' : this.host;
      return `ws://${host}:${this.port}${this.path}`;
    }

    connect() {
      if (this.connectionStatus === 'CONNECTING' || this.connectionStatus === 'CONNECTED') {
        return;
      }

      this.connectionStatus = 'CONNECTING';
      this.emit('status_change', { status: this.connectionStatus });

      const targetUrl = this.getWebSocketUrl();
      try {
        const WebSocketClass = (typeof WebSocket !== 'undefined') ? WebSocket : require('ws');
        this.ws = new WebSocketClass(targetUrl);
      } catch (err) {
        this.connectionStatus = 'DISCONNECTED';
        this.emit('status_change', { status: this.connectionStatus, error: err.message });
        this.scheduleReconnect();
        return;
      }

      this.ws.onopen = () => {
        this.connectionStatus = 'CONNECTED';
        this.reconnectAttempts = 0;
        this.emit('status_change', { status: this.connectionStatus });

        // Start ping heartbeat
        this.startHeartbeat();

        // If we were already in a place before reconnect, re-join
        if (this.currentPlaceId) {
          this.joinPlace(this.currentPlaceId, {
            x: this.localMember.x,
            y: this.localMember.y,
            facing: this.localMember.facing
          });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : event.data.toString('utf8');
          const msg = JSON.parse(raw);
          this.handleServerMessage(msg);
        } catch (err) {
          console.warn('PresenceClient: Failed to parse incoming packet:', err);
        }
      };

      this.ws.onclose = (event) => {
        this.connectionStatus = 'DISCONNECTED';
        this.stopHeartbeat();
        this.remoteMembers.clear();
        this.emit('status_change', { status: this.connectionStatus, code: event.code, reason: event.reason });
        if (this.autoReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        this.emit('error', { error: err });
      };
    }

    disconnect() {
      this.autoReconnect = false;
      this.stopHeartbeat();
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      if (this.ws) {
        try { this.ws.close(); } catch (_) {}
        this.ws = null;
      }
      this.connectionStatus = 'DISCONNECTED';
      this.remoteMembers.clear();
      this.emit('status_change', { status: this.connectionStatus });
    }

    scheduleReconnect() {
      if (this.reconnectTimer) return;
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), 10000);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this.autoReconnect && this.connectionStatus === 'DISCONNECTED') {
          this.connect();
        }
      }, delay);
    }

    startHeartbeat() {
      this.stopHeartbeat();
      this.pingInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === 1) { // OPEN
          try {
            this.ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
          } catch (_) {}
        }
      }, 20000);
    }

    stopHeartbeat() {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    }

    sendPacket(obj) {
      if (this.ws && this.ws.readyState === 1) {
        try {
          this.ws.send(JSON.stringify(obj));
          return true;
        } catch (e) {
          console.warn('PresenceClient send failed:', e);
          return false;
        }
      }
      return false;
    }

    setIdentity({ memberId, displayName, avatar }) {
      if (memberId) this.localMember.memberId = memberId;
      if (displayName) this.localMember.displayName = displayName;
      if (avatar) this.localMember.avatar = avatar;
    }

    joinPlace(placeId, coords = {}) {
      this.currentPlaceId = placeId;
      if (coords.x !== undefined) this.localMember.x = coords.x;
      if (coords.y !== undefined) this.localMember.y = coords.y;
      if (coords.facing !== undefined) this.localMember.facing = coords.facing;

      // Clear remote members for old place
      this.remoteMembers.clear();

      if (this.connectionStatus !== 'CONNECTED') {
        this.connect();
        return;
      }

      this.sendPacket({
        type: 'JOIN_PLACE',
        memberId: this.localMember.memberId,
        displayName: this.localMember.displayName,
        avatar: this.localMember.avatar,
        placeId: this.currentPlaceId,
        x: this.localMember.x,
        y: this.localMember.y,
        facing: this.localMember.facing
      });
    }

    leavePlace() {
      if (this.currentPlaceId) {
        this.sendPacket({ type: 'LEAVE_PLACE' });
        this.currentPlaceId = null;
        this.currentInstanceId = null;
        this.remoteMembers.clear();
        this.emit('room_state', { memberCount: 1 });
      }
    }

    sendMove(x, y, facing) {
      const now = Date.now();
      const numX = Number(x);
      const numY = Number(y);
      const validFacing = facing || this.localMember.facing;

      this.localMember.x = numX;
      this.localMember.y = numY;
      this.localMember.facing = validFacing;

      // Rate limit check: at least moveThrottleMs between sends unless facing changed
      if (now - this.lastSentMove.time < this.moveThrottleMs &&
          Math.abs(numX - this.lastSentMove.x) < 0.05 &&
          Math.abs(numY - this.lastSentMove.y) < 0.05 &&
          validFacing === this.lastSentMove.facing) {
        return;
      }

      this.sequenceNumber++;
      this.lastSentMove = { x: numX, y: numY, facing: validFacing, time: now };

      this.sendPacket({
        type: 'MOVE',
        seq: this.sequenceNumber,
        x: numX,
        y: numY,
        facing: validFacing,
        timestamp: now
      });
    }

    sendEmote(emoteIdOrEmoji) {
      let resolvedId = emoteIdOrEmoji;
      if (!EMOTE_CATALOG[resolvedId]) {
        const entry = Object.values(EMOTE_CATALOG).find(e => e.emoji === emoteIdOrEmoji || e.id.toLowerCase() === String(emoteIdOrEmoji).toLowerCase());
        if (entry) resolvedId = entry.id;
      }
      if (!EMOTE_CATALOG[resolvedId]) {
        console.warn('Unknown emoteId:', emoteIdOrEmoji);
        return false;
      }
      return this.sendPacket({
        type: 'EMOTE',
        emoteId: resolvedId,
        timestamp: Date.now()
      });
    }

    sendPresetMessage(messageIdOrText) {
      let resolvedId = messageIdOrText;
      if (!PRESET_MESSAGE_CATALOG[resolvedId]) {
        const entry = Object.values(PRESET_MESSAGE_CATALOG).find(m => m.text.toLowerCase() === String(messageIdOrText).toLowerCase() || m.id.toLowerCase() === String(messageIdOrText).toLowerCase());
        if (entry) resolvedId = entry.id;
      }
      if (!PRESET_MESSAGE_CATALOG[resolvedId]) {
        console.warn('Unknown preset messageId:', messageIdOrText);
        return false;
      }
      return this.sendPacket({
        type: 'PRESET_MESSAGE',
        messageId: resolvedId,
        timestamp: Date.now()
      });
    }

    // Message Dispatcher
    handleServerMessage(msg) {
      switch (msg.type) {
        case 'WELCOME': {
          this.connectionId = msg.connectionId;
          this.communityId = msg.communityId;
          this.emit('welcome', msg);
          break;
        }

        case 'PRESENCE_SNAPSHOT': {
          this.currentPlaceId = msg.placeId;
          this.currentInstanceId = msg.instanceId;
          this.memberCount = msg.memberCount || 1;
          this.remoteMembers.clear();

          if (msg.self) {
            if (msg.self.connectionId) this.connectionId = msg.self.connectionId;
            if (msg.self.x !== undefined) this.localMember.x = Number(msg.self.x);
            if (msg.self.y !== undefined) this.localMember.y = Number(msg.self.y);
            if (msg.self.facing !== undefined) this.localMember.facing = msg.self.facing;
            if (msg.self.displayName) this.localMember.displayName = msg.self.displayName;
            if (msg.self.memberId) this.localMember.memberId = msg.self.memberId;
            if (msg.self.avatar) this.localMember.avatar = msg.self.avatar;
          }

          if (Array.isArray(msg.members)) {
            msg.members.forEach(m => {
              const isSelf = (m.connectionId && m.connectionId === this.connectionId) || (m.memberId && m.memberId === this.localMember.memberId);
              if (!isSelf && m.connectionId) {
                this.remoteMembers.set(m.connectionId, {
                  connectionId: m.connectionId,
                  memberId: m.memberId,
                  displayName: m.displayName,
                  avatar: m.avatar,
                  x: Number(m.x),
                  y: Number(m.y),
                  targetX: Number(m.x),
                  targetY: Number(m.y),
                  facing: m.facing || 'down',
                  emote: null,
                  presetMsg: null,
                  lastSeenAt: m.lastSeenAt || Date.now()
                });
              }
            });
          }
          this.emit('snapshot', {
            placeId: msg.placeId,
            instanceId: msg.instanceId,
            self: this.localMember,
            members: Array.from(this.remoteMembers.values()),
            memberCount: this.memberCount
          });
          break;
        }

        case 'MEMBER_JOINED': {
          const m = msg.member;
          const isSelf = m && ((m.connectionId && m.connectionId === this.connectionId) || (m.memberId && m.memberId === this.localMember.memberId));
          if (m && !isSelf && m.connectionId) {
            this.remoteMembers.set(m.connectionId, {
              connectionId: m.connectionId,
              memberId: m.memberId,
              displayName: m.displayName,
              avatar: m.avatar,
              x: Number(m.x),
              y: Number(m.y),
              targetX: Number(m.x),
              targetY: Number(m.y),
              facing: m.facing || 'down',
              emote: null,
              presetMsg: null,
              lastSeenAt: Date.now()
            });
          }
          if (msg.memberCount) this.memberCount = msg.memberCount;
          this.emit('member_joined', { member: m, memberCount: this.memberCount });
          break;
        }

        case 'MEMBER_MOVED': {
          const remote = this.remoteMembers.get(msg.connectionId);
          if (remote) {
            remote.targetX = msg.x;
            remote.targetY = msg.y;
            remote.facing = msg.facing;
            remote.lastSeenAt = Date.now();
            this.emit('member_moved', msg);
          }
          break;
        }

        case 'MEMBER_EMOTE': {
          const remote = this.remoteMembers.get(msg.connectionId);
          if (remote) {
            remote.emote = {
              id: msg.emoteId,
              emoji: msg.emoji,
              text: msg.emoteText,
              timestamp: msg.timestamp
            };
            if (remote.emoteTimer) clearTimeout(remote.emoteTimer);
            remote.emoteTimer = setTimeout(() => {
              remote.emote = null;
              this.emit('member_emote_cleared', { connectionId: msg.connectionId });
            }, 3500);
          }
          this.emit('member_emote', msg);
          break;
        }

        case 'MEMBER_PRESET_MESSAGE': {
          const remote = this.remoteMembers.get(msg.connectionId);
          if (remote) {
            remote.presetMsg = {
              id: msg.messageId,
              text: msg.messageText,
              timestamp: msg.timestamp
            };
            if (remote.presetTimer) clearTimeout(remote.presetTimer);
            remote.presetTimer = setTimeout(() => {
              remote.presetMsg = null;
              this.emit('member_preset_cleared', { connectionId: msg.connectionId });
            }, 4000);
          }
          this.emit('member_preset_message', msg);
          break;
        }

        case 'MEMBER_LEFT': {
          this.remoteMembers.delete(msg.connectionId);
          if (msg.memberCount) this.memberCount = msg.memberCount;
          this.emit('member_left', msg);
          break;
        }

        case 'ROOM_STATE': {
          if (msg.memberCount) this.memberCount = msg.memberCount;
          if (msg.instanceId) this.currentInstanceId = msg.instanceId;
          this.emit('room_state', msg);
          break;
        }

        case 'PONG': {
          this.emit('pong', msg);
          break;
        }

        case 'ERROR': {
          this.emit('error', msg);
          break;
        }
      }
    }

    // Smooth movement interpolation for remote avatars
    // Called each frame in the rendering loop
    updateInterpolation(dt = 0.016) {
      // Lerp factor based on frame delta
      const factor = Math.min(1.0, dt * 12.0); // smooth responsive slide
      this.remoteMembers.forEach(member => {
        if (member.targetX !== undefined && member.targetY !== undefined) {
          member.x += (member.targetX - member.x) * factor;
          member.y += (member.targetY - member.y) * factor;
        }
      });
    }

    getRemoteMembers() {
      return Array.from(this.remoteMembers.values());
    }

    getEmoteCatalog() {
      return EMOTE_CATALOG;
    }

    getPresetMessageCatalog() {
      return PRESET_MESSAGE_CATALOG;
    }
  }

  // Export to global environment
  if (typeof window !== 'undefined') {
    window.KoinoniaPresenceClient = KoinoniaPresenceClient;
    window.EMOTE_CATALOG = EMOTE_CATALOG;
    window.PRESET_MESSAGE_CATALOG = PRESET_MESSAGE_CATALOG;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      KoinoniaPresenceClient,
      EMOTE_CATALOG,
      PRESET_MESSAGE_CATALOG
    };
  }
})();
