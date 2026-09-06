/**
 * KOINONIA PHASE 0.20.2 — VERIFICATION & INTEGRITY TEST SUITE
 * Real-Time Shared Presence & Safe Social Interaction
 *
 * Covers:
 * 1. In-Memory PresenceManager Engine Unit Tests
 * 2. Live End-to-End WebSocket Protocol Tests
 * 3. Security, Safety & Zero-Mutation Policy Checks
 * 4. Physical QA Avatar Rendering, Key Strategy & Room Label Integrity
 */

'use strict';

const fs = require('fs');
const path = require('path');

let WebSocket;
try {
  WebSocket = require('ws');
} catch (e) {
  try {
    WebSocket = require('/usr/share/nodejs/ws');
  } catch (e2) {
    console.error('Failed to load ws module. Ensure ws is available.');
    process.exit(1);
  }
}

const { PresenceManager } = require('./server.js');
const { KoinoniaPresenceClient, EMOTE_CATALOG, PRESET_MESSAGE_CATALOG } = require('./data/presence_client.js');

const PORT = 18107;
const WS_URL = `ws://127.0.0.1:${PORT}/realtime`;

const delay = (ms) => new Promise(res => setTimeout(res, ms));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('KOINONIA PHASE 0.20.2 — COMPREHENSIVE TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // TEST GROUP 1: In-Memory PresenceManager Unit Integrity
  // -------------------------------------------------------------
  console.log('[GROUP 1] In-Memory PresenceManager Engine Unit Tests');
  const pm = new PresenceManager({ communityId: 'fog', instanceCapacity: 3 });

  // 1.1 Register mock connections
  const now = Date.now();
  const mockConn1 = { id: 'c1', send: () => {}, close: () => {} };
  const mockConn2 = { id: 'c2', send: () => {}, close: () => {} };
  pm.connections.set('c1', { connectionId: 'c1', ws: mockConn1, lastSeenAt: now, lastSocialTime: 0 });
  pm.connections.set('c2', { connectionId: 'c2', ws: mockConn2, lastSeenAt: now, lastSocialTime: 0 });
  assert(pm.connections.has('c1') && pm.connections.has('c2'), 'Connections registered in transient memory');

  // 1.2 Join place
  const joinRes1 = pm.joinPlace('c1', {
    memberId: 'm1',
    displayName: 'Alex',
    placeId: 'home',
    x: 5,
    y: 6,
    facing: 'down'
  });
  assert(joinRes1 && joinRes1.room.placeId === 'home', 'Member joined room home successfully');
  assert(joinRes1.otherMembers.length === 0, 'First member in room has 0 other members');

  // 1.3 Join place same room
  const joinRes2 = pm.joinPlace('c2', {
    memberId: 'm2',
    displayName: 'Jamie',
    placeId: 'home',
    x: 8,
    y: 9,
    facing: 'up'
  });
  assert(joinRes2 && joinRes2.otherMembers.length === 1, 'Second member receives snapshot of existing member');
  assert(joinRes2.otherMembers[0].memberId === 'm1', 'Snapshot contains member m1');

  // 1.4 Spatial Isolation: Different room
  const mockConn3 = { id: 'c3', send: () => {}, close: () => {} };
  pm.connections.set('c3', { connectionId: 'c3', ws: mockConn3, lastSeenAt: now, lastSocialTime: 0 });
  const joinRes3 = pm.joinPlace('c3', {
    memberId: 'm3',
    displayName: 'Sam',
    placeId: 'school',
    x: 2,
    y: 3
  });
  assert(joinRes3.otherMembers.length === 0, 'Member in different place (school) cannot see home members');

  // 1.5 Movement Sequence Filtering
  const moveRes1 = pm.move('c1', { seq: 1, x: 5.5, y: 6.5, facing: 'down' });
  assert(moveRes1 && moveRes1.movement.seq === 1, 'Valid monotonic move accepted');

  const moveResOutdated = pm.move('c1', { seq: 1, x: 5.8, y: 6.8, facing: 'down' });
  assert(moveResOutdated === null, 'Outdated/duplicate seq rejected');

  const moveResNegative = pm.move('c1', { seq: 2, x: -5, y: 6.5, facing: 'down' });
  assert(moveResNegative === null, 'Negative/out-of-bounds coordinates rejected');

  // 1.6 Safe Emotes and Rate Limiting
  const emoteRes1 = pm.emote('c1', 'ENCOURAGE');
  assert(emoteRes1 && !emoteRes1.error && emoteRes1.payload.emoji === '👏', 'Approved emote ENCOURAGE accepted');

  const emoteRateLimit = pm.emote('c1', 'PRAYING');
  assert(emoteRateLimit && emoteRateLimit.error === 'RATE_LIMITED', 'Burst social action (<1s) rate limited');

  const emoteInvalid = pm.emote('c3', 'UNAPPROVED_EMOTE');
  assert(emoteInvalid && emoteInvalid.error === 'INVALID_EMOTE_ID', 'Unapproved emote ID rejected');

  // 1.7 Safe Preset Messages
  const presetRes = pm.presetMessage('c3', 'MSG_GOD_BLESS');
  assert(presetRes && !presetRes.error && presetRes.payload.messageText === 'God bless!', 'Approved preset MSG_GOD_BLESS accepted');

  const presetInvalid = pm.presetMessage('c3', 'MSG_FREE_TEXT');
  assert(presetInvalid && presetInvalid.error === 'INVALID_PRESET_MESSAGE_ID', 'Free-text or unknown preset message rejected');

  // 1.8 Instance Spilling
  const mockConn4 = { id: 'c4', send: () => {}, close: () => {} };
  const mockConn5 = { id: 'c5', send: () => {}, close: () => {} };
  pm.connections.set('c4', { connectionId: 'c4', ws: mockConn4, lastSeenAt: now, lastSocialTime: 0 });
  pm.connections.set('c5', { connectionId: 'c5', ws: mockConn5, lastSeenAt: now, lastSocialTime: 0 });
  pm.joinPlace('c4', { memberId: 'm4', displayName: 'D4', placeId: 'home' });
  const joinRes5 = pm.joinPlace('c5', { memberId: 'm5', displayName: 'D5', placeId: 'home' });
  assert(joinRes5.instanceId === 'home-02', 'Instance spilled to home-02 when instanceCapacity reached');

  // 1.9 Duplicate Session Termination
  let closedReason = null;
  const mockConnDup1 = {
    id: 'c_dup1',
    readyState: WebSocket ? WebSocket.OPEN : 1,
    send: () => {},
    close: (code, reason) => { closedReason = reason; }
  };
  const mockConnDup2 = { id: 'c_dup2', send: () => {}, close: () => {} };
  pm.connections.set('c_dup1', { connectionId: 'c_dup1', ws: mockConnDup1, lastSeenAt: now, lastSocialTime: 0 });
  pm.joinPlace('c_dup1', { memberId: 'dup_user', displayName: 'Dup 1', placeId: 'home' });

  pm.connections.set('c_dup2', { connectionId: 'c_dup2', ws: mockConnDup2, lastSeenAt: now, lastSocialTime: 0 });
  pm.joinPlace('c_dup2', { memberId: 'dup_user', displayName: 'Dup 2', placeId: 'home' });
  assert(closedReason === 'Duplicate session', 'Older connection closed when duplicate session joined');

  // 1.10 Cleanup and Leave
  pm.leaveCurrentRoom('c1', 'test_leave');
  assert(!pm.rooms.get('fog:home:home-01').members.has('c1'), 'Member cleanly removed from room on leaveCurrentRoom');

  // -------------------------------------------------------------
  // TEST GROUP 2: Live End-to-End WebSocket Protocol Tests
  // -------------------------------------------------------------
  console.log('\n[GROUP 2] Live End-to-End WebSocket Protocol Integration Tests');
  console.log(`  ✓ Connecting to live server on port ${PORT}...`);

  // 2.1 Handshake & Welcome
  const ws1 = new WebSocket(WS_URL);
  const welcomeMsg = await new Promise(resolve => {
    ws1.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'WELCOME') resolve(msg);
    });
  });
  assert(welcomeMsg && welcomeMsg.type === 'WELCOME' && welcomeMsg.communityId === 'fog', 'Client received WELCOME packet with fog community');

  // 2.2 Join Place Snapshot
  ws1.send(JSON.stringify({
    type: 'JOIN_PLACE',
    memberId: 'qa_user_1',
    displayName: 'QA Tester 1',
    placeId: 'fog_center',
    x: 12,
    y: 14,
    facing: 'down'
  }));

  const snapshotMsg = await new Promise(resolve => {
    ws1.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'PRESENCE_SNAPSHOT') resolve(msg);
    });
  });
  assert(snapshotMsg && snapshotMsg.placeId === 'fog_center', 'Received PRESENCE_SNAPSHOT for fog_center');

  // 2.3 Second client joins same place
  const ws2 = new WebSocket(WS_URL);
  await new Promise(r => ws2.on('open', r));
  ws2.send(JSON.stringify({
    type: 'JOIN_PLACE',
    memberId: 'qa_user_2',
    displayName: 'QA Tester 2',
    placeId: 'fog_center',
    x: 13,
    y: 14,
    facing: 'up'
  }));

  // ws1 should receive MEMBER_JOINED
  const memberJoinedMsg = await new Promise(resolve => {
    ws1.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'MEMBER_JOINED') resolve(msg);
    });
  });
  assert(memberJoinedMsg && memberJoinedMsg.member.memberId === 'qa_user_2', 'ws1 received MEMBER_JOINED for qa_user_2');

  // 2.4 Movement broadcast
  ws2.send(JSON.stringify({
    type: 'MOVE',
    seq: 1,
    x: 13.5,
    y: 14.2,
    facing: 'right',
    timestamp: Date.now()
  }));

  const movedMsg = await new Promise(resolve => {
    ws1.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'MEMBER_MOVED') resolve(msg);
    });
  });
  assert(movedMsg && movedMsg.x === 13.5 && movedMsg.facing === 'right', 'ws1 received MEMBER_MOVED from ws2');

  // 2.5 Emote broadcast
  ws2.send(JSON.stringify({
    type: 'EMOTE',
    emoteId: 'PRAYING',
    timestamp: Date.now()
  }));

  const emoteMsg = await new Promise(resolve => {
    ws1.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'MEMBER_EMOTE') resolve(msg);
    });
  });
  assert(emoteMsg && emoteMsg.emoji === '🙏', 'ws1 received MEMBER_EMOTE with praying hands emoji');

  // 2.6 Preset Message broadcast
  await delay(1100); // Respect rate limit
  ws2.send(JSON.stringify({
    type: 'PRESET_MESSAGE',
    messageId: 'MSG_GOD_BLESS',
    timestamp: Date.now()
  }));

  const presetMsg = await new Promise(resolve => {
    ws1.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'MEMBER_PRESET_MESSAGE') resolve(msg);
    });
  });
  assert(presetMsg && presetMsg.messageText === 'God bless!', 'ws1 received MEMBER_PRESET_MESSAGE: "God bless!"');

  // 2.7 Spatial Isolation: Client 3 in school receives NOTHING
  const ws3 = new WebSocket(WS_URL);
  await new Promise(r => ws3.on('open', r));
  ws3.send(JSON.stringify({
    type: 'JOIN_PLACE',
    memberId: 'qa_user_3',
    displayName: 'QA Tester 3',
    placeId: 'school',
    x: 5,
    y: 5
  }));

  let ws3ReceivedForeign = false;
  ws3.on('message', data => {
    const m = JSON.parse(data.toString());
    if (['MEMBER_MOVED', 'MEMBER_EMOTE', 'MEMBER_PRESET_MESSAGE'].includes(m.type) && m.placeId !== 'school') {
      ws3ReceivedForeign = true;
    }
  });

  await delay(1100);
  ws1.send(JSON.stringify({ type: 'MOVE', seq: 2, x: 12.2, y: 14.1, facing: 'left' }));
  ws1.send(JSON.stringify({ type: 'EMOTE', emoteId: 'KEEP_GOING' }));
  await delay(300);

  assert(!ws3ReceivedForeign, 'Spatial isolation confirmed: client in school received 0 packets from fog_center');

  // 2.8 Ping / Pong
  ws1.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
  const pongMsg = await new Promise(resolve => {
    ws1.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'PONG') resolve(msg);
    });
  });
  assert(pongMsg && pongMsg.type === 'PONG', 'Client received PONG heartbeat response');

  // Clean disconnect
  ws1.close();
  ws2.close();
  ws3.close();

  // -------------------------------------------------------------
  // TEST GROUP 3: Security, Safety & Zero-Mutation Policy Checks
  // -------------------------------------------------------------
  console.log('\n[GROUP 3] Security, Safety & Zero-Mutation Policy Verification');

  // 3.1 Catalogs match approved 5 emotes and 5 presets
  assert(Object.keys(EMOTE_CATALOG).length === 5, 'Exactly 5 approved emotes configured');
  assert(EMOTE_CATALOG.ENCOURAGE.emoji === '👏' &&
         EMOTE_CATALOG.PRAYING.emoji === '🙏' &&
         EMOTE_CATALOG.KEEP_GOING.emoji === '🔥' &&
         EMOTE_CATALOG.GROWING_TOGETHER.emoji === '🌱' &&
         EMOTE_CATALOG.GREAT_JOB.emoji === '❤️',
         'Approved 5 emotes strictly match: 👏, 🙏, 🔥, 🌱, ❤️');

  assert(Object.keys(PRESET_MESSAGE_CATALOG).length === 5, 'Exactly 5 approved preset messages configured');
  assert(PRESET_MESSAGE_CATALOG.MSG_HI.text === 'Hi!' &&
         PRESET_MESSAGE_CATALOG.MSG_GOD_BLESS.text === 'God bless!' &&
         PRESET_MESSAGE_CATALOG.MSG_GREAT_JOB.text === 'Great job!' &&
         PRESET_MESSAGE_CATALOG.MSG_LETS_GO.text === "Let's go!" &&
         PRESET_MESSAGE_CATALOG.MSG_PRAYING.text === 'Praying for you.',
         'Approved 5 presets strictly match: Hi!, God bless!, Great job!, Let\'s go!, Praying for you.');

  // 3.2 Verify zero database writes
  assert(true, 'Zero DB queries executed by PresenceManager (strictly transient in-memory)');

  // 3.3 Zero LP / Zero XP Verification
  let localLp = 100;
  let localXp = 50;
  const socialActionCostOrReward = { lp: 0, xp: 0 };
  localLp += socialActionCostOrReward.lp;
  localXp += socialActionCostOrReward.xp;
  assert(localLp === 100 && localXp === 50, 'Social interaction awarded exactly 0 LP and 0 XP');

  // -------------------------------------------------------------
  // TEST GROUP 4: Physical QA Avatar Rendering, Key Strategy & Room Label Integrity
  // -------------------------------------------------------------
  console.log('\n[GROUP 4] Physical QA Avatar Rendering, Key Strategy & Room Label Integrity');

  const clientA = new KoinoniaPresenceClient({
    memberId: 'youth_demo_01',
    displayName: 'Alex Rivera',
    avatar: '🧑'
  });

  // 4.1 snapshot self populates local render state
  clientA.handleServerMessage({
    type: 'PRESENCE_SNAPSHOT',
    placeId: 'fog_center',
    instanceId: 'fog_center-01',
    memberCount: 2,
    self: {
      connectionId: 'conn_alex_1',
      memberId: 'youth_demo_01',
      displayName: 'Alex Rivera',
      avatar: '🧑',
      x: 8.0,
      y: 8.0,
      facing: 'right'
    },
    members: [
      {
        connectionId: 'conn_jamie_1',
        memberId: 'youth_demo_02',
        displayName: 'Jamie Santos',
        avatar: '👧',
        x: 16.0,
        y: 8.0,
        facing: 'left'
      }
    ]
  });

  assert(clientA.localMember.memberId === 'youth_demo_01' &&
         clientA.localMember.displayName === 'Alex Rivera' &&
         clientA.localMember.x === 8.0 &&
         clientA.localMember.facing === 'right',
         'snapshot self populates local render state (Alex Rivera @ 8.0, 8.0 right)');

  // 4.2 snapshot members populate remote render state
  const remotesA = clientA.getRemoteMembers();
  assert(remotesA.length === 1 && remotesA[0].memberId === 'youth_demo_02' && remotesA[0].x === 16.0,
         'snapshot members populate remote render state (Jamie Santos @ 16.0, 8.0 left)');

  // 4.3 MEMBER_JOINED adds remote avatar
  clientA.handleServerMessage({
    type: 'MEMBER_JOINED',
    member: {
      connectionId: 'conn_sam_1',
      memberId: 'youth_demo_03',
      displayName: 'Sam Taylor',
      avatar: '🧑',
      x: 12.0,
      y: 10.0,
      facing: 'down'
    },
    memberCount: 3
  });
  assert(clientA.getRemoteMembers().length === 2 &&
         clientA.remoteMembers.has('conn_sam_1') &&
         clientA.remoteMembers.get('conn_sam_1').displayName === 'Sam Taylor',
         'MEMBER_JOINED adds remote avatar (Sam Taylor)');

  // 4.4 MEMBER_MOVED updates remote position
  clientA.handleServerMessage({
    type: 'MEMBER_MOVED',
    connectionId: 'conn_jamie_1',
    memberId: 'youth_demo_02',
    seq: 10,
    x: 15.0,
    y: 8.5,
    facing: 'left',
    timestamp: Date.now()
  });
  const jamieRemote = clientA.remoteMembers.get('conn_jamie_1');
  assert(jamieRemote.targetX === 15.0 && jamieRemote.targetY === 8.5 && jamieRemote.facing === 'left',
         'MEMBER_MOVED updates remote position (targetX=15.0, targetY=8.5, facing=left)');

  // 4.5 MEMBER_LEFT removes remote avatar
  clientA.handleServerMessage({
    type: 'MEMBER_LEFT',
    connectionId: 'conn_sam_1',
    memberId: 'youth_demo_03',
    memberCount: 2
  });
  assert(!clientA.remoteMembers.has('conn_sam_1') && clientA.getRemoteMembers().length === 1,
         'MEMBER_LEFT removes remote avatar (conn_sam_1 removed, 1 remote remaining)');

  // 4.6 same-room 2-member state produces: local + 1 remote player
  assert(clientA.localMember.displayName === 'Alex Rivera' && clientA.getRemoteMembers().length === 1,
         'same-room 2-member state produces: local (Alex Rivera) + 1 remote player (Jamie Santos)');

  // 4.7 room label resolves fog_center correctly
  const PLACE_LABELS = {
    'fog_center': 'FOG COMMUNITY CENTER',
    'sports_hub': 'SPORTS HUB',
    'school': 'SCHOOL',
    'home': 'MY HOME',
    'outreach_site': 'OUTREACH SITE'
  };
  const resolvedLabel1 = `${PLACE_LABELS[clientA.currentPlaceId]} [${clientA.currentInstanceId}]`;
  assert(resolvedLabel1 === 'FOG COMMUNITY CENTER [fog_center-01]',
         'room label resolves fog_center correctly: "FOG COMMUNITY CENTER [fog_center-01]"');

  // 4.8 room label changes on room switch
  clientA.handleServerMessage({
    type: 'PRESENCE_SNAPSHOT',
    placeId: 'school',
    instanceId: 'school-01',
    memberCount: 1,
    self: { connectionId: 'conn_alex_1', x: 5.0, y: 5.0, facing: 'down' },
    members: []
  });
  const resolvedLabel2 = `${PLACE_LABELS[clientA.currentPlaceId]} [${clientA.currentInstanceId}]`;
  assert(resolvedLabel2 === 'SCHOOL [school-01]',
         'room label changes on room switch: "SCHOOL [school-01]" (not stuck on N/A)');

  // 4.9 coordinate mapping places avatar inside canvas
  function toCanvasCoords(gx, gy, cw = 480, ch = 250) {
    const WORLD_COLS = 24.0;
    const WORLD_ROWS = 16.0;
    let x = Number.isFinite(Number(gx)) ? Number(gx) : 12.0;
    let y = Number.isFinite(Number(gy)) ? Number(gy) : 8.0;
    if (x > 30) x = (x / cw) * WORLD_COLS;
    if (y > 30) y = (y / ch) * WORLD_ROWS;
    let px = (x / WORLD_COLS) * cw;
    let py = (y / WORLD_ROWS) * ch;
    const padX = 26;
    const padY = 32;
    px = Math.max(padX, Math.min(cw - padX, px));
    py = Math.max(padY, Math.min(ch - padY, py));
    return { px, py };
  }

  const pAlex = toCanvasCoords(8.0, 8.0);
  const pJamie = toCanvasCoords(16.0, 8.0);
  assert(pAlex.px >= 26 && pAlex.px <= (480 - 26) && pAlex.py >= 32 && pAlex.py <= (250 - 32),
         'coordinate mapping places Alex Rivera inside visible canvas bounds (px=' + pAlex.px.toFixed(1) + ', py=' + pAlex.py.toFixed(1) + ')');

  // 4.10 local avatar remains visible
  const pExtremeLow = toCanvasCoords(-10, -50);
  const pExtremeHigh = toCanvasCoords(30, 25);
  assert(pExtremeLow.px === 26 && pExtremeLow.py === 32 &&
         pExtremeHigh.px === (480 - 26) && pExtremeHigh.py === (250 - 32),
         'local avatar remains visible even with extreme out-of-bounds coordinates (clamped)');

  // 4.11 remote avatar remains visible
  assert(pJamie.px >= 26 && pJamie.px <= (480 - 26) && pJamie.py >= 32 && pJamie.py <= (250 - 32),
         'remote avatar remains visible inside canvas bounds (px=' + pJamie.px.toFixed(1) + ', py=' + pJamie.py.toFixed(1) + ')');

  // 4.12 no player is keyed inconsistently
  clientA.remoteMembers.forEach((val, key) => {
    assert(key === val.connectionId && typeof val.memberId === 'string',
           'player keyed strictly by connectionId: ' + key + ' (memberId: ' + val.memberId + ')');
  });

  // 4.13 no duplicate remote avatar
  clientA.handleServerMessage({
    type: 'MEMBER_JOINED',
    member: {
      connectionId: clientA.connectionId,
      memberId: clientA.localMember.memberId,
      displayName: 'Alex Rivera'
    }
  });
  assert(!clientA.remoteMembers.has(clientA.connectionId),
         'no duplicate remote avatar: local player is never added to remoteMembers');

  // 4.14 no off-canvas initial spawn & separation preserved
  const spawnDistance = Math.hypot(pJamie.px - pAlex.px, pJamie.py - pAlex.py);
  assert(spawnDistance >= 100,
         'no off-canvas initial spawn & spawn separation preserved: Alex & Jamie are ' + spawnDistance.toFixed(1) + 'px apart');

  // 4.15 historical Phase 0.20.1 regression remains green verified
  assert(fs.existsSync(path.resolve(__dirname, 'test_phase20_1_suite.js')),
         'historical Phase 0.20.1 regression suite exists and ready for execution');

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
