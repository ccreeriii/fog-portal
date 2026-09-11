/**
 * KOINONIA — PHASE 0.23C
 * ISOLATED LOCAL MOCK SHARED CORE SERVER
 *
 * Requirements:
 * - Built using Node.js standard library (http).
 * - Zero Express / third-party server dependencies.
 * - Zero database access or persistent disk mutation.
 * - Binds STRICTLY to 127.0.0.1 (localhost only).
 * - Binds to port 0 (OS-assigned dynamic ephemeral port).
 * - Records all incoming requests in-memory for assertion verification.
 * - Full support for canonical /api/v1/shared/* endpoints.
 * - In-memory idempotency ledger for deduplication/replay verification.
 * - In-memory fault injection (HTTP status codes, timeouts, malformed JSON).
 * - Clean teardown via server.close().
 */

'use strict';

const http = require('http');

class MockSharedCoreServer {
  constructor() {
    this.server = null;
    this.port = 0;
    this.baseUrl = '';
    this.recordedRequests = [];
    this.nextFault = null;
    this.routeFaults = new Map();
    this.sockets = new Set();

    this.state = this._createInitialState();
  }

  _createInitialState() {
    return {
      member: {
        id: 'member_demo_01',
        name: 'Alex Rivera',
        role: 'MEMBER',
        tier: 'Apprentice'
      },
      lifePoints: {
        balance: 120,
        totalEarned: 120,
        tier: 'Apprentice'
      },
      quests: [
        { id: 'Q-001', title: 'Welcome to Hearth', rewardLp: 20, completed: false },
        { id: 'Q-002', title: 'The Living Word', rewardLp: 30, completed: false }
      ],
      questCompletions: new Map(),
      events: [
        { id: 'EVT-001', title: 'Sunday Worship', date: '2026-09-13', type: 'WORSHIP' },
        { id: 'EVT-002', title: 'Youth Fellowship', date: '2026-09-15', type: 'YOUTH' }
      ],
      attendance: new Map(),
      campfires: [
        { id: 'CF-001', name: 'Valley Campfire', capacity: 12, maxCapacity: 20 }
      ],
      campfireMembers: [
        { id: 'member_demo_01', name: 'Alex Rivera', role: 'MEMBER' }
      ],
      campfireLeaders: [
        { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'LEADER' }
      ],
      campfireGameState: {
        activeStoryId: 'prologue',
        roomCount: 1
      },
      campfireSettings: {
        communityMax: 20,
        allowReactions: true
      },
      ministries: [
        { id: 'MIN-001', name: 'Youth Outreach', role: 'MEMBER' }
      ],
      ministryMissions: [
        { id: 'MIS-001', ministryId: 'MIN-001', title: 'Sunday Welcome Team', lp: 15 }
      ],
      milestones: [
        { id: 'MLS-001', title: 'First Fellowship', completed: true, timestamp: Date.now() - 86400000 }
      ],
      growthProgress: {
        level: 2,
        currentXp: 85,
        nextLevelXp: 100,
        milestonesCount: 1
      },
      activityEvents: [],
      idempotencyLedger: new Map()
    };
  }

  reset() {
    this.recordedRequests = [];
    this.nextFault = null;
    this.routeFaults.clear();
    this.state = this._createInitialState();
  }

  setNextFault(fault) {
    this.nextFault = fault;
  }

  setRouteFault(routePattern, fault) {
    this.routeFaults.set(routePattern, fault);
  }

  clearFaults() {
    this.nextFault = null;
    this.routeFaults.clear();
  }

  getRecordedRequests() {
    return [...this.recordedRequests];
  }

  async start() {
    if (this.server) {
      return { port: this.port, baseUrl: this.baseUrl };
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this._handleRequest(req, res);
      });

      this.server.on('connection', (socket) => {
        this.sockets.add(socket);
        socket.on('close', () => {
          this.sockets.delete(socket);
        });
      });

      // Bind STRICTLY to 127.0.0.1 and OS-assigned dynamic port 0
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server.address();
        this.port = addr.port;
        this.baseUrl = `http://127.0.0.1:${this.port}`;
        resolve({ port: this.port, baseUrl: this.baseUrl, url: this.baseUrl });
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  async stop() {
    if (!this.server) return;

    return new Promise((resolve) => {
      for (const socket of this.sockets) {
        socket.destroy();
      }
      this.sockets.clear();

      this.server.close(() => {
        this.server = null;
        this.port = 0;
        this.baseUrl = '';
        resolve();
      });
    });
  }

  async _readRequestBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let bytesRead = 0;
      const MAX_BYTES = 1024 * 1024; // 1 MB limit

      req.on('data', (chunk) => {
        bytesRead += chunk.length;
        if (bytesRead > MAX_BYTES) {
          req.destroy(new Error('Request payload too large'));
          return reject(new Error('Payload too large'));
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw.trim()) {
          return resolve({ raw: '', json: null });
        }
        try {
          const json = JSON.parse(raw);
          resolve({ raw, json });
        } catch (_) {
          resolve({ raw, json: null, parseError: true });
        }
      });

      req.on('error', (err) => {
        reject(err);
      });
    });
  }

  async _handleRequest(req, res) {
    const urlObj = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = urlObj.pathname;
    const method = req.method.toUpperCase();

    // Read payload
    let bodyInfo = { raw: '', json: null };
    try {
      bodyInfo = await this._readRequestBody(req);
    } catch (_) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'BAD_REQUEST', message: 'Payload read error' }));
      return;
    }

    const idempotencyKey = req.headers['idempotency-key'] || null;

    // Record request for test assertions
    const recorded = {
      method,
      pathname,
      url: req.url,
      headers: Object.assign({}, req.headers),
      idempotencyKey,
      rawBody: bodyInfo.raw,
      body: bodyInfo.json,
      timestamp: Date.now()
    };
    this.recordedRequests.push(recorded);

    // Check fault injection
    let fault = this.nextFault;
    if (fault) {
      this.nextFault = null; // one-shot fault consumed
    } else {
      for (const [pattern, routeFault] of this.routeFaults.entries()) {
        if (typeof pattern === 'string' && pathname.includes(pattern)) {
          fault = routeFault;
          break;
        } else if (pattern instanceof RegExp && pattern.test(pathname)) {
          fault = routeFault;
          break;
        }
      }
    }

    if (fault) {
      if (fault.delayMs) {
        await new Promise((r) => setTimeout(r, fault.delayMs));
      }

      if (fault.disconnect) {
        req.socket.destroy();
        return;
      }

      if (fault.malformedJson) {
        res.writeHead(fault.status || 200, { 'Content-Type': 'application/json' });
        res.end('{ "malformed_json": true, incomplete: ');
        return;
      }

      if (fault.nonJson) {
        res.writeHead(fault.status || 200, { 'Content-Type': 'text/plain' });
        res.end(fault.body || 'Plain text response');
        return;
      }

      const status = fault.status || 500;
      const headers = Object.assign({ 'Content-Type': 'application/json' }, fault.headers || {});
      const body = fault.body !== undefined
        ? (typeof fault.body === 'string' ? fault.body : JSON.stringify(fault.body))
        : JSON.stringify({ success: false, error: fault.error || 'FAULT_INJECTED', message: fault.message || 'Fault injected' });

      res.writeHead(status, headers);
      res.end(body);
      return;
    }

    // Standard JSON Response Helper
    const sendJson = (status, payload) => {
      const bodyStr = JSON.stringify(payload);
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Mock-Shared-Core': '0.23C'
      });
      res.end(bodyStr);
    };

    // ==========================================
    // ROUTE HANDLERS
    // ==========================================

    // 1. MEMBER / PROFILE
    if (method === 'GET' && pathname === '/api/v1/shared/me') {
      return sendJson(200, { success: true, member: this.state.member });
    }

    if (method === 'GET' && pathname === '/api/v1/shared/member/profile') {
      return sendJson(200, { success: true, profile: this.state.member });
    }

    // 2. LIFE POINTS & XP LEDGER
    if (method === 'GET' && pathname === '/api/v1/shared/points') {
      return sendJson(200, {
        success: true,
        lifePoints: this.state.lifePoints.balance,
        balance: this.state.lifePoints.balance,
        totalEarned: this.state.lifePoints.totalEarned,
        tier: this.state.lifePoints.tier
      });
    }

    if (method === 'POST' && pathname === '/api/v1/shared/points/award') {
      const key = idempotencyKey || (bodyInfo.json && bodyInfo.json.idempotencyKey);
      if (!key) {
        return sendJson(422, {
          success: false,
          error: 'MISSING_IDEMPOTENCY_KEY',
          message: 'Idempotency key required'
        });
      }

      // Check idempotency replay
      if (this.state.idempotencyLedger.has(key)) {
        const recordedEntry = this.state.idempotencyLedger.get(key);
        return sendJson(200, Object.assign({}, recordedEntry, {
          replayed: true,
          duplicate: true,
          awarded: 0 // 0 additional LP awarded on replay!
        }));
      }

      const amount = Number(bodyInfo.json && bodyInfo.json.amount) || 0;
      this.state.lifePoints.balance += amount;
      this.state.lifePoints.totalEarned += amount;

      const responsePayload = {
        success: true,
        replayed: false,
        duplicate: false,
        awarded: amount,
        balance: this.state.lifePoints.balance,
        totalEarned: this.state.lifePoints.totalEarned,
        idempotencyKey: key
      };

      this.state.idempotencyLedger.set(key, responsePayload);
      return sendJson(200, responsePayload);
    }

    // 3. QUESTS
    if (method === 'GET' && pathname === '/api/v1/shared/content/quests') {
      return sendJson(200, { success: true, quests: this.state.quests });
    }

    const questDetailMatch = pathname.match(/^\/api\/v1\/shared\/content\/quests\/([^/]+)$/);
    if (method === 'GET' && questDetailMatch) {
      const qId = decodeURIComponent(questDetailMatch[1]);
      const quest = this.state.quests.find((q) => q.id === qId);
      if (!quest) {
        return sendJson(404, { success: false, error: 'NOT_FOUND', message: 'Quest not found' });
      }
      return sendJson(200, { success: true, quest });
    }

    const questCompletionMatch = pathname.match(/^\/api\/v1\/shared\/quests\/([^/]+)\/completion$/);
    if (method === 'GET' && questCompletionMatch) {
      const qId = decodeURIComponent(questCompletionMatch[1]);
      const completion = this.state.questCompletions.get(qId) || null;
      return sendJson(200, { success: true, completed: Boolean(completion), completion });
    }

    const questCompleteMatch = pathname.match(/^\/api\/v1\/shared\/quests\/([^/]+)\/complete$/);
    if (method === 'POST' && questCompleteMatch) {
      const qId = decodeURIComponent(questCompleteMatch[1]);
      const key = idempotencyKey || (bodyInfo.json && bodyInfo.json.idempotencyKey);
      if (!key) {
        return sendJson(422, { success: false, error: 'MISSING_IDEMPOTENCY_KEY', message: 'Key required' });
      }

      if (this.state.idempotencyLedger.has(key)) {
        return sendJson(200, {
          success: true,
          replayed: true,
          duplicate: true,
          questId: qId,
          completed: true
        });
      }

      const completionRecord = {
        questId: qId,
        completedAt: Date.now(),
        memberId: this.state.member.id
      };
      this.state.questCompletions.set(qId, completionRecord);

      const resp = {
        success: true,
        replayed: false,
        duplicate: false,
        questId: qId,
        completed: true,
        completion: completionRecord
      };
      this.state.idempotencyLedger.set(key, resp);
      return sendJson(200, resp);
    }

    // 4. EVENTS & ATTENDANCE
    if (method === 'GET' && pathname === '/api/v1/shared/events') {
      return sendJson(200, { success: true, events: this.state.events });
    }

    const eventDetailMatch = pathname.match(/^\/api\/v1\/shared\/events\/([^/]+)$/);
    if (method === 'GET' && eventDetailMatch) {
      const eId = decodeURIComponent(eventDetailMatch[1]);
      const event = this.state.events.find((e) => e.id === eId);
      if (!event) {
        return sendJson(404, { success: false, error: 'NOT_FOUND', message: 'Event not found' });
      }
      return sendJson(200, { success: true, event });
    }

    if (method === 'GET' && pathname === '/api/v1/shared/attendance') {
      const records = Array.from(this.state.attendance.values());
      return sendJson(200, { success: true, attendance: records });
    }

    const attendanceDetailMatch = pathname.match(/^\/api\/v1\/shared\/attendance\/([^/]+)$/);
    if (method === 'GET' && attendanceDetailMatch) {
      const instanceId = decodeURIComponent(attendanceDetailMatch[1]);
      const record = this.state.attendance.get(instanceId) || null;
      return sendJson(200, { success: true, record, records: record ? [record] : [] });
    }

    if (method === 'POST' && pathname === '/api/v1/shared/attendance/check-in') {
      const key = idempotencyKey || (bodyInfo.json && bodyInfo.json.idempotencyKey);
      if (!key) {
        return sendJson(422, { success: false, error: 'MISSING_IDEMPOTENCY_KEY', message: 'Key required' });
      }

      if (this.state.idempotencyLedger.has(key)) {
        return sendJson(200, {
          success: true,
          replayed: true,
          duplicate: true,
          status: 'already_checked_in'
        });
      }

      const instanceId = (bodyInfo.json && bodyInfo.json.eventInstanceId) || 'evt_001';
      const record = {
        eventInstanceId: instanceId,
        memberId: this.state.member.id,
        checkedInAt: Date.now()
      };
      this.state.attendance.set(instanceId, record);

      const resp = {
        success: true,
        replayed: false,
        duplicate: false,
        status: 'checked_in',
        record
      };
      this.state.idempotencyLedger.set(key, resp);
      return sendJson(200, resp);
    }

    // 5. CAMPFIRES
    if (method === 'GET' && pathname === '/api/v1/shared/campfires') {
      return sendJson(200, { success: true, campfires: this.state.campfires });
    }

    const cfDetailMatch = pathname.match(/^\/api\/v1\/shared\/campfires\/([^/]+)$/);
    if (method === 'GET' && cfDetailMatch) {
      const cfId = decodeURIComponent(cfDetailMatch[1]);
      const campfire = this.state.campfires.find((c) => c.id === cfId);
      if (!campfire) {
        return sendJson(404, { success: false, error: 'NOT_FOUND', message: 'Campfire not found' });
      }
      return sendJson(200, { success: true, campfire });
    }

    const cfMembersMatch = pathname.match(/^\/api\/v1\/shared\/campfires\/([^/]+)\/members$/);
    if (method === 'GET' && cfMembersMatch) {
      return sendJson(200, { success: true, members: this.state.campfireMembers });
    }

    const cfLeadersMatch = pathname.match(/^\/api\/v1\/shared\/campfires\/([^/]+)\/leaders$/);
    if (method === 'GET' && cfLeadersMatch) {
      return sendJson(200, { success: true, leaders: this.state.campfireLeaders });
    }

    const cfGameStateMatch = pathname.match(/^\/api\/v1\/shared\/campfires\/([^/]+)\/gamestate$/);
    if (method === 'GET' && cfGameStateMatch) {
      return sendJson(200, { success: true, gamestate: this.state.campfireGameState });
    }

    if (method === 'GET' && pathname === '/api/v1/shared/campfires/settings') {
      return sendJson(200, { success: true, settings: this.state.campfireSettings });
    }

    if (method === 'POST' && pathname === '/api/v1/shared/campfires/settings/community-max') {
      const adminMax = Number(bodyInfo.json && bodyInfo.json.adminMax) || 20;
      this.state.campfireSettings.communityMax = adminMax;
      return sendJson(200, { success: true, communityMax: adminMax });
    }

    const cfCapacityMatch = pathname.match(/^\/api\/v1\/shared\/campfires\/([^/]+)\/capacity$/);
    if (method === 'POST' && cfCapacityMatch) {
      const cfId = decodeURIComponent(cfCapacityMatch[1]);
      const requestedMax = Number(bodyInfo.json && bodyInfo.json.requestedMax) || 12;
      return sendJson(200, { success: true, campfireId: cfId, capacity: requestedMax });
    }

    const cfReactionsMatch = pathname.match(/^\/api\/v1\/shared\/campfires\/([^/]+)\/reactions$/);
    if (method === 'POST' && cfReactionsMatch) {
      const cfId = decodeURIComponent(cfReactionsMatch[1]);
      const emoji = (bodyInfo.json && bodyInfo.json.emoji) || '🔥';
      return sendJson(200, { success: true, campfireId: cfId, emoji });
    }

    // 6. MINISTRIES
    if (method === 'GET' && (pathname === '/api/v1/shared/ministries' || pathname === '/api/v1/shared/ministries/mine')) {
      return sendJson(200, { success: true, ministries: this.state.ministries });
    }

    const ministryMissionsMatch = pathname.match(/^\/api\/v1\/shared\/ministries\/([^/]+)\/missions$/);
    if (method === 'GET' && ministryMissionsMatch) {
      return sendJson(200, { success: true, missions: this.state.ministryMissions });
    }

    if (method === 'GET' && pathname === '/api/v1/shared/ministries/missions/mine') {
      return sendJson(200, { success: true, missions: this.state.ministryMissions });
    }

    // 7. MILESTONES & GROWTH
    if (method === 'GET' && pathname === '/api/v1/shared/milestones') {
      return sendJson(200, { success: true, milestones: this.state.milestones });
    }

    if (method === 'GET' && pathname === '/api/v1/shared/growth/progress') {
      return sendJson(200, { success: true, progress: this.state.growthProgress });
    }

    // 8. ACTIVITY EVENTS
    if (method === 'GET' && pathname === '/api/v1/shared/activity/events') {
      return sendJson(200, { success: true, events: this.state.activityEvents });
    }

    if (method === 'POST' && pathname === '/api/v1/shared/activity/events') {
      const key = idempotencyKey || (bodyInfo.json && bodyInfo.json.idempotencyKey);
      if (!key) {
        return sendJson(422, { success: false, error: 'MISSING_IDEMPOTENCY_KEY', message: 'Key required' });
      }

      if (this.state.idempotencyLedger.has(key)) {
        return sendJson(200, { success: true, replayed: true, duplicate: true });
      }

      const evt = Object.assign({ id: 'act_' + Date.now() }, bodyInfo.json);
      this.state.activityEvents.push(evt);
      const resp = { success: true, replayed: false, duplicate: false, event: evt };
      this.state.idempotencyLedger.set(key, resp);
      return sendJson(200, resp);
    }

    // Default 404 for unknown endpoints under /api/v1/shared/* or outside
    return sendJson(404, {
      success: false,
      error: 'NOT_FOUND',
      message: `Mock Shared Core route not found: ${method} ${pathname}`
    });
  }
}

module.exports = { MockSharedCoreServer };
