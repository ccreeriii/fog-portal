/**
 * KOINONIA PHASE 0.22.1 — INTERNET BETA AUTOMATED TEST SUITE
 *
 * Verifies:
 * - Group 1: PM2 Process & Host Architecture Isolation
 * - Group 2: Health Endpoints & Non-Disclosure Verification
 * - Group 3: Security Headers & Defense in Depth
 * - Group 4: Public Beta Route Gating & QA Test Isolation
 * - Group 5: PWA Compliance & Asset Verification
 * - Group 6: Realtime WebSocket Protocol (/realtime) & Safe Social Interaction
 * - Group 7: Dynamic WSS Resolution & Network Edge Compatibility
 * - Group 8: Staging Database Non-Mutation Verification
 * - Group 9: Physical Beta Landing Hero & Entry CTA Wire Verification
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');
const WebSocket = require('ws');

const BETA_PORT = 3005;
const BASE_URL = `http://127.0.0.1:${BETA_PORT}`;
const STAGING_DB = '/home/raspi4/fog-portal-staging/fog_community.db';
const EXPECTED_DB_SHA256 = 'f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function httpRequest(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: BETA_PORT,
      path: urlPath,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 5000
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function getDbSha256() {
  const buf = fs.readFileSync(STAGING_DB);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBetaTestSuite() {
  console.log('================================================================');
  console.log('  KOINONIA PHASE 0.22.1 — INTERNET BETA TEST SUITE');
  console.log('================================================================\n');

  // ============================================================
  // GROUP 1: PM2 PROCESS & HOST ARCHITECTURE ISOLATION
  // ============================================================
  console.log('[GROUP 1] PM2 Process & Host Architecture Isolation');

  let pm2ListOutput = '';
  try {
    pm2ListOutput = execSync('pm2 jlist', { encoding: 'utf8' });
  } catch (err) {
    pm2ListOutput = '[]';
  }

  const pm2Processes = JSON.parse(pm2ListOutput);
  const betaProc = pm2Processes.find(p => p.name === 'koinonia-beta');
  assert(betaProc !== undefined, 'PM2 process "koinonia-beta" exists in process list');
  assert(betaProc && betaProc.pm2_env.status === 'online', 'PM2 process "koinonia-beta" is online');

  // Phase 0.22.1 final hardening: reboot persistence must include Koinonia Beta.
  const pm2DumpPath = path.join(process.env.HOME || '/home/raspi4', '.pm2', 'dump.pm2');
  let savedPm2Processes = [];
  try {
    savedPm2Processes = JSON.parse(fs.readFileSync(pm2DumpPath, 'utf8'));
  } catch (_) {
    savedPm2Processes = [];
  }

  const savedBetaProc = savedPm2Processes.find(p => p.name === 'koinonia-beta');
  assert(savedBetaProc !== undefined, 'PM2 saved dump persists "koinonia-beta" for reboot recovery');

  const isPhase221 = savedBetaProc && savedBetaProc.pm_cwd.includes('koinonia-phase22_1');
  assert(
    savedBetaProc &&
    (savedBetaProc.pm_cwd === __dirname || isPhase221),
    'PM2 saved Koinonia config points to canonical Phase 0.22.1 server and working directory'
  );

  const portalProc = pm2Processes.find(p => p.name === 'fog-portal');
  assert(portalProc && portalProc.pm2_env.status === 'online', 'Protected PM2 process "fog-portal" (port 3000) is online');

  const stagingProc = pm2Processes.find(p => p.name === 'fog-staging');
  assert(stagingProc && stagingProc.pm2_env.status === 'online', 'Protected PM2 process "fog-staging" (port 3001) is online');

  const v3Proc = pm2Processes.find(p => p.name === 'fog-v3');
  assert(v3Proc && v3Proc.pm2_env.status === 'online', 'Protected PM2 process "fog-v3" (port 3003) is online');

  // Verify server.js contains zero SQLite or database write imports
  const serverJsContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert(!serverJsContent.includes("require('better-sqlite3')"), 'server.js does not import better-sqlite3');
  assert(!serverJsContent.includes("require('sqlite3')"), 'server.js does not import sqlite3');
  assert(!serverJsContent.includes('fog_community.db'), 'server.js contains zero references to fog_community.db');

  // ============================================================
  // GROUP 2: HEALTH ENDPOINTS & NON-DISCLOSURE VERIFICATION
  // ============================================================
  console.log('\n[GROUP 2] Health Endpoints & Non-Disclosure Verification');

  const healthRes = await httpRequest('/health');
  assert(healthRes.statusCode === 200, 'GET /health returns HTTP 200 OK');
  assert(healthRes.headers['content-type'].includes('application/json'), 'GET /health returns Content-Type application/json');

  const healthJson = JSON.parse(healthRes.body);
  assert(healthJson.status === 'healthy', 'Health payload status is "healthy"');
  assert(healthJson.service === 'koinonia-beta', 'Health payload service is "koinonia-beta"');
  assert(healthJson.phase === '0.22.1', 'Health payload phase is "0.22.1"');
  assert(healthJson.version === '0.22.1', 'Health payload version is "0.22.1"');
  assert(typeof healthJson.uptimeSeconds === 'number' && healthJson.uptimeSeconds >= 0, 'Health payload uptimeSeconds is valid');
  assert(healthJson.timestamp !== undefined, 'Health payload contains ISO timestamp');

  // Verify /api/health alias
  const apiHealthRes = await httpRequest('/api/health');
  assert(apiHealthRes.statusCode === 200, 'GET /api/health returns HTTP 200 OK');
  const apiHealthJson = JSON.parse(apiHealthRes.body);
  assert(apiHealthJson.service === 'koinonia-beta', 'API health payload service matches');

  // Non-disclosure verification
  assert(!healthRes.body.includes('/home/raspi4'), 'Health payload discloses no internal filesystem paths');
  assert(!healthRes.body.includes('token'), 'Health payload discloses no tokens');
  assert(!healthRes.body.includes('password') && !healthRes.body.includes('secret'), 'Health payload discloses no secrets');

  // ============================================================
  // GROUP 3: SECURITY HEADERS & DEFENSE IN DEPTH
  // ============================================================
  console.log('\n[GROUP 3] Security Headers & Defense in Depth');

  assert(healthRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff header present');
  assert(healthRes.headers['x-frame-options'] === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN header present');
  assert(healthRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy header present');
  assert(healthRes.headers['permissions-policy'] !== undefined, 'Permissions-Policy header present');
  assert(healthRes.headers['content-security-policy'] !== undefined, 'Content-Security-Policy header present');
  assert(healthRes.headers['content-security-policy'].includes("connect-src 'self' wss: ws:"), 'CSP allows wss: and ws: for realtime connection');

  // Traversal attack
  const traversalRes = await httpRequest('/../../../etc/passwd');
  assert(traversalRes.statusCode === 403 || traversalRes.statusCode === 404, `Path traversal attempt returns ${traversalRes.statusCode} (forbidden/not found)`);

  // Sensitive dotfiles
  const envRes = await httpRequest('/.env');
  assert(envRes.statusCode === 404, 'GET /.env returns HTTP 404');

  const gitRes = await httpRequest('/.git');
  assert(gitRes.statusCode === 404, 'GET /.git returns HTTP 404');

  const dbRes = await httpRequest('/test.db');
  assert(dbRes.statusCode === 404, 'GET /test.db returns HTTP 404');

  const tokenRes = await httpRequest('/.token');
  assert(tokenRes.statusCode === 404, 'GET /.token returns HTTP 404');

  // ============================================================
  // GROUP 4: PUBLIC BETA ROUTE GATING & QA TEST ISOLATION
  // ============================================================
  console.log('\n[GROUP 4] Public Beta Route Gating & QA Test Isolation');

  // QA test harnesses must be strictly 404
  const studioTestRes = await httpRequest('/studio_test.html');
  assert(studioTestRes.statusCode === 404, 'GET /studio_test.html is blocked (HTTP 404)');

  const presenceTestRes = await httpRequest('/presence_test.html');
  assert(presenceTestRes.statusCode === 404, 'GET /presence_test.html is blocked (HTTP 404)');

  const arbitraryTestRes = await httpRequest('/anything_test.html');
  assert(arbitraryTestRes.statusCode === 404, 'GET /*_test.html pattern is blocked (HTTP 404)');

  const loadTestRes = await httpRequest('/load_test.js');
  assert(loadTestRes.statusCode === 404, 'GET /load_test.js is blocked (HTTP 404)');

  // Member index check
  const indexRes = await httpRequest('/');
  assert(indexRes.statusCode === 200, 'GET / returns HTTP 200 OK');
  assert(indexRes.body.includes('<!DOCTYPE html>'), 'GET / serves HTML document');
  assert(!indexRes.body.includes('studio_test.html'), 'Member UI contains zero links to studio_test.html');
  assert(!indexRes.body.includes('presence_test.html'), 'Member UI contains zero links to presence_test.html');

  // Game.js reset parameter check
  const gameJsContent = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  assert(gameJsContent.includes("['localhost', '127.0.0.1'].includes(window.location.hostname)"), 'game.js restricts ?reset=1 query parameter to localhost only');

  // ============================================================
  // GROUP 5: PWA COMPLIANCE & ASSET VERIFICATION
  // ============================================================
  console.log('\n[GROUP 5] PWA Compliance & Asset Verification');

  const manifestRes = await httpRequest('/manifest.json');
  assert(manifestRes.statusCode === 200, 'GET /manifest.json returns HTTP 200 OK');
  const manifest = JSON.parse(manifestRes.body);
  assert(manifest.name.startsWith('Koinonia'), 'PWA manifest name begins with "Koinonia"');
  assert(manifest.short_name === 'Koinonia', 'PWA manifest short_name is "Koinonia"');
  assert(manifest.display === 'standalone', 'PWA manifest display is "standalone"');
  assert(manifest.theme_color === '#6A0E04', 'PWA manifest theme_color is "#6A0E04"');
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'PWA manifest contains valid icon definitions');

  const swRes = await httpRequest('/sw.js');
  assert(swRes.statusCode === 200, 'GET /sw.js returns HTTP 200 OK');
  assert(swRes.body.includes('CACHE_NAME'), 'sw.js defines cache container');
  assert(swRes.body.includes('koinonia-v0.22.1-r5'), 'sw.js specifies updated cache version koinonia-v0.22.1-r5');
  assert(swRes.body.includes('/realtime'), 'sw.js bypasses /realtime WebSocket from caching');
  assert(swRes.body.includes('/health'), 'sw.js bypasses /health monitoring from caching');

  // Phase 0.22.1 final hardening: update-critical PWA resources must
  // explicitly prevent stale browser/CDN copies.
  const swCacheControl = String(swRes.headers['cache-control'] || '').toLowerCase();
  assert(
    swCacheControl.includes('no-cache') && swCacheControl.includes('no-store'),
    'GET /sw.js explicitly disables stale browser caching'
  );

  assert(
    String(swRes.headers['cdn-cache-control'] || '').toLowerCase() === 'no-store' &&
    String(swRes.headers['cloudflare-cdn-cache-control'] || '').toLowerCase() === 'no-store',
    'GET /sw.js explicitly disables CDN/Cloudflare storage'
  );

  const shellCacheControl = String(indexRes.headers['cache-control'] || '').toLowerCase();
  assert(
    shellCacheControl.includes('no-cache') && shellCacheControl.includes('no-store'),
    'GET / HTML shell explicitly disables stale browser caching'
  );

  assert(
    String(indexRes.headers['cdn-cache-control'] || '').toLowerCase() === 'no-store' &&
    String(indexRes.headers['cloudflare-cdn-cache-control'] || '').toLowerCase() === 'no-store',
    'GET / HTML shell explicitly disables CDN/Cloudflare storage'
  );

  // Branding assets
  const logoRes = await httpRequest('/assets/logo.png');
  assert(logoRes.statusCode === 200, 'GET /assets/logo.png returns HTTP 200 OK');

  const faviconRes = await httpRequest('/favicon.ico');
  assert(faviconRes.statusCode === 200, 'GET /favicon.ico returns HTTP 200 OK (aliased)');

  const brandingFaviconRes = await httpRequest('/assets/branding/favicon.ico');
  assert(brandingFaviconRes.statusCode === 200, 'GET /assets/branding/favicon.ico returns HTTP 200 OK');

  const icon192Res = await httpRequest('/assets/branding/icon-192.png');
  assert(icon192Res.statusCode === 200, 'GET /assets/branding/icon-192.png returns HTTP 200 OK');

  const icon512Res = await httpRequest('/assets/branding/icon-512.png');
  assert(icon512Res.statusCode === 200, 'GET /assets/branding/icon-512.png returns HTTP 200 OK');

  const bannerRes = await httpRequest('/assets/branding/koinonia-logo-banner.png');
  assert(bannerRes.statusCode === 200, 'GET /assets/branding/koinonia-logo-banner.png returns HTTP 200 OK');

  const cssRes = await httpRequest('/styles.css');
  assert(cssRes.statusCode === 200, 'GET /styles.css returns HTTP 200 OK');

  const jsRes = await httpRequest('/game.js');
  assert(jsRes.statusCode === 200, 'GET /game.js returns HTTP 200 OK');

  // ============================================================
  // GROUP 6: REALTIME WEBSOCKET PROTOCOL & SAFE SOCIAL INTERACTION
  // ============================================================
  console.log('\n[GROUP 6] Realtime WebSocket Protocol & Safe Social Interaction');

  await new Promise(async (resolve, reject) => {
    const wsUrl = `ws://127.0.0.1:${BETA_PORT}/realtime`;
    const wsA = new WebSocket(wsUrl);
    let clientAId = null;
    let clientBId = null;
    let wsB = null;
    let timer = setTimeout(() => {
      reject(new Error('Realtime WebSocket test timed out'));
    }, 15000);

    wsA.on('message', async (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'WELCOME') {
        clientAId = msg.connectionId;
        assert(msg.version === 1, 'WebSocket handshake returns protocol version 1');
        assert(typeof clientAId === 'string' && clientAId.length > 0, 'Connection ID assigned');

        // Client A joins place 'home'
        wsA.send(JSON.stringify({
          type: 'JOIN_PLACE',
          placeId: 'home',
          memberId: 'mbr_client_a',
          displayName: 'Youth Member A',
          avatar: { head: 'round', color: '#4A90E2' }
        }));
      } else if (msg.type === 'PRESENCE_SNAPSHOT') {
        assert(msg.placeId === 'home', 'PRESENCE_SNAPSHOT matches requested placeId "home"');
        assert(msg.self && msg.self.connectionId === clientAId, 'Snapshot self connectionId matches Client A');

        // Connect Client B now
        if (!wsB) {
          wsB = new WebSocket(wsUrl);

          wsB.on('message', async (rawB) => {
            const msgB = JSON.parse(rawB.toString());

            if (msgB.type === 'WELCOME') {
              clientBId = msgB.connectionId;
              // Client B joins place 'home'
              wsB.send(JSON.stringify({
                type: 'JOIN_PLACE',
                placeId: 'home',
                memberId: 'mbr_client_b',
                displayName: 'Youth Member B',
                avatar: { head: 'square', color: '#E94E77' }
              }));
            } else if (msgB.type === 'PRESENCE_SNAPSHOT') {
              // Client B is in room, now send movement
              wsB.send(JSON.stringify({
                type: 'MOVE',
                seq: 1,
                x: 220,
                y: 180,
                facing: 'right',
                timestamp: Date.now()
              }));
            } else if (msgB.type === 'ERROR') {
              if (msgB.code === 'RATE_LIMITED') {
                assert(true, 'Server correctly enforces social rate limit with code RATE_LIMITED');

                // Wait 1100ms for rate limit window to expire, then test invalid emote
                await sleep(1100);
                wsB.send(JSON.stringify({
                  type: 'EMOTE',
                  emoteId: 'UNAPPROVED_EMOTE_XYZ'
                }));
              } else if (msgB.code === 'INVALID_EMOTE_ID') {
                assert(true, 'Server correctly rejected unapproved emote with code INVALID_EMOTE_ID');

                // Wait 1100ms then test approved preset message
                await sleep(1100);
                wsB.send(JSON.stringify({
                  type: 'PRESET_MESSAGE',
                  messageId: 'MSG_GOD_BLESS'
                }));
              } else if (msgB.code === 'FREE_TEXT_NOT_ALLOWED') {
                assert(true, 'Server correctly rejected free-text message with code FREE_TEXT_NOT_ALLOWED');

                // Test heartbeat PING
                wsB.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
              }
            } else if (msgB.type === 'PONG') {
              assert(true, 'WebSocket heartbeat PING -> PONG validated');
              // Close Client B
              wsB.close();
            }
          });
        }
      } else if (msg.type === 'MEMBER_JOINED') {
        assert(msg.member.connectionId === clientBId, 'Client A received MEMBER_JOINED for Client B');
      } else if (msg.type === 'MEMBER_MOVED') {
        assert(msg.connectionId === clientBId && msg.x === 220 && msg.y === 180, 'Client A received MEMBER_MOVED with matching coordinates');

        // Client B sends valid approved emote
        wsB.send(JSON.stringify({
          type: 'EMOTE',
          emoteId: 'PRAYING'
        }));
      } else if (msg.type === 'MEMBER_EMOTE') {
        assert(msg.emoteId === 'PRAYING', 'Client A received approved emote PRAYING');
        assert(msg.emoji === '🙏', 'Emote includes canonical emoji');
        assert(msg.emoteText === 'Praying', 'Emote includes canonical text');

        // Immediately send another emote from Client B to test RATE_LIMITED error
        wsB.send(JSON.stringify({
          type: 'EMOTE',
          emoteId: 'GREAT_JOB'
        }));
      } else if (msg.type === 'MEMBER_PRESET_MESSAGE') {
        assert(msg.messageId === 'MSG_GOD_BLESS', 'Client A received approved preset message MSG_GOD_BLESS');
        assert(msg.messageText === 'God bless!', 'Preset message resolves canonical approved text');

        // Test free-text chat rejection on Client B
        wsB.send(JSON.stringify({
          type: 'PRESET_MESSAGE',
          messageId: 'MSG_GOD_BLESS',
          text: 'This is unauthorized free text chat attempt'
        }));
      } else if (msg.type === 'MEMBER_LEFT') {
        assert(msg.connectionId === clientBId, 'Client A received MEMBER_LEFT when Client B disconnected');
        clearTimeout(timer);
        wsA.close();
        resolve();
      }
    });
  });

  // ============================================================
  // GROUP 7: DYNAMIC WSS RESOLUTION & NETWORK EDGE COMPATIBILITY
  // ============================================================
  console.log('\n[GROUP 7] Dynamic WSS Resolution & Network Edge Compatibility');

  const presenceClientContent = fs.readFileSync(path.join(__dirname, 'data/presence_client.js'), 'utf8');
  assert(!presenceClientContent.includes('192.168.1.139'), 'presence_client.js does NOT contain hardcoded local LAN IP (192.168.1.139)');
  assert(presenceClientContent.includes("window.location.protocol === 'https:' ? 'wss:' : 'ws:'"), 'presence_client.js dynamically determines wss: on HTTPS');
  assert(presenceClientContent.includes("window.location.host"), 'presence_client.js uses window.location.host for edge proxying');

  // ============================================================
  // GROUP 8: STAGING DATABASE NON-MUTATION VERIFICATION
  // ============================================================
  console.log('\n[GROUP 8] Staging Database Non-Mutation Verification');

  const finalHash = getDbSha256();
  assert(finalHash === EXPECTED_DB_SHA256, `Staging DB SHA256 remains bit-for-bit identical (${finalHash})`);

  // ============================================================
  // GROUP 9: PHYSICAL BETA LANDING HERO & ENTRY CTA WIRE VERIFICATION
  // ============================================================
  console.log('\n[GROUP 9] Physical Beta Landing Hero & Entry CTA Wire Verification');

  // 1. Syntax Check on game.js
  let syntaxOk = false;
  try {
    execSync(`node -c "${path.join(__dirname, 'game.js')}"`);
    syntaxOk = true;
  } catch (_) {
    syntaxOk = false;
  }
  assert(syntaxOk, 'game.js passes strict syntax check (node -c) with 0 errors');

  // 2. Inspect index.html markup for intro modal
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const titleScreenMatch = indexHtml.match(/<div id="title-screen"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  assert(titleScreenMatch !== null, 'Intro modal #title-screen element found in index.html');
  const titleScreenHtml = titleScreenMatch ? titleScreenMatch[0] : '';

  // 3. Official branding banner exists in intro modal
  assert(titleScreenHtml.includes('id="intro-hero-banner"'), 'Intro modal contains #intro-hero-banner image');
  assert(titleScreenHtml.includes('assets/branding/koinonia-logo-banner.png'), 'Intro modal banner references official artwork koinonia-logo-banner.png');
  assert(titleScreenHtml.includes('alt="Koinonia — Fire of God Ministries"'), 'Intro modal banner has accessible alt text');
  assert(titleScreenHtml.includes('srcset="assets/branding/koinonia-header-logo.png 640w, assets/branding/koinonia-logo-banner.png 1920w"'), 'Intro modal banner includes Retina 1920w srcset');

  // 4. Old standalone "K" hero presentation and duplicate text removed from intro modal
  assert(!titleScreenHtml.includes('class="koinonia-mark"'), 'Old standalone "K" mark is removed from intro modal');
  assert(!titleScreenHtml.includes('Fire of God Ministries Virtual Community</div>'), 'Duplicated subtitle text block is removed where banner replaces it');

  // 5. Canonical tagline remains present
  assert(titleScreenHtml.includes('"A virtual world that grows when you grow in real life."'), 'Canonical tagline remains present in intro modal');

  // 6. CTA text is EXACTLY "BEGIN YOUR JOURNEY"
  assert(titleScreenHtml.includes('<span>BEGIN YOUR JOURNEY</span>'), 'Entry CTA text is EXACTLY "BEGIN YOUR JOURNEY"');
  assert(!titleScreenHtml.includes('ENTER THE WORLD'), 'Old label "ENTER THE WORLD" is completely removed');
  assert(!titleScreenHtml.includes('disabled'), 'Entry CTA button is not disabled');

  // 7. Styling & Pointer Interception Defense
  const cssContent = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
  assert(cssContent.includes('#title-screen') && cssContent.includes('z-index: 1000'), '#title-screen has explicit high z-index (1000)');
  assert(cssContent.includes('.intro-cta-btn') && cssContent.includes('touch-action: manipulation'), '.intro-cta-btn specifies touch-action: manipulation for mobile Safari');
  assert(cssContent.includes('.intro-cta-btn') && cssContent.includes('min-height: 52px'), '.intro-cta-btn enforces Apple HIG touch target >= 44px (52px)');

  // 8. Event wiring in game.js and index.html
  assert(titleScreenHtml.includes('onclick="window.KOINONIA_GAME && window.KOINONIA_GAME.enterWorld'), 'Entry CTA has inline onclick wiring fallback');
  assert(gameJsContent.includes('enterWorld: enterKoinoniaWorld'), 'game.js exports enterWorld method on KOINONIA_GAME API');
  assert(gameJsContent.includes("btnBegin.addEventListener('click', enterKoinoniaWorld)"), 'game.js attaches click listener to #btn-begin-adventure');
  assert(gameJsContent.includes("btnBegin.addEventListener('touchend', enterKoinoniaWorld)"), 'game.js attaches touchend listener to #btn-begin-adventure');
  assert(gameJsContent.includes("btnBegin.addEventListener('pointerup', enterKoinoniaWorld)"), 'game.js attaches pointerup listener to #btn-begin-adventure');

  // 9. Modal transition execution logic test
  assert(gameJsContent.includes("titleScreen.classList.remove('active')") && gameJsContent.includes("titleScreen.classList.add('hidden')"), 'enterKoinoniaWorld removes active class and adds hidden class to #title-screen');

  // 10. Service worker cache version updated
  const swContent = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
  assert(swContent.includes('const CACHE_NAME = "koinonia-v0.22.1-r5"'), 'Service worker specifies updated cache version koinonia-v0.22.1-r5');
  assert(swContent.includes('assets/branding/koinonia-logo-banner.png'), 'Service worker caches koinonia-logo-banner.png');
  assert(indexHtml.includes('reg.update()'), 'index.html invokes reg.update() on service worker load');


  // ============================================================
  // GROUP 10: MOBILE TOP HEADER & RESPONSIVE LAYOUT (REVISION 1)
  // ============================================================
  console.log('\n[GROUP 10] Mobile Top Header & Responsive Layout (Revision 1)');

  assert(indexHtml.includes('id="header-account-btn"'), 'Account/Profile button #header-account-btn exists in header');
  assert(indexHtml.includes('id="header-account-avatar"'), 'Header account button displays avatar element #header-account-avatar');
  assert(indexHtml.includes('id="header-account-role-chip"'), 'Header account button displays role chip #header-account-role-chip');
  assert(indexHtml.includes('id="header-level-pill"'), 'Character level pill #header-level-pill remains in header');
  assert(indexHtml.includes('id="header-lp-pill"'), 'Life points pill #header-lp-pill remains in header');
  assert(cssContent.includes('.header-account-btn'), 'styles.css defines .header-account-btn styling');
  assert(cssContent.includes('.device-phone.orientation-portrait.active-game .header-btn-exit-world'), 'Phone portrait active game exit rule exists');
  assert(cssContent.includes('display: none !important'), 'Exit button is hidden on phone portrait to prevent crowding');
  assert(cssContent.includes('env(safe-area-inset-top'), 'Header enforces safe-area-inset-top padding');

  // ============================================================
  // GROUP 11: CONSOLIDATED ONE-ROW WORLD UTILITY HUD (HEADER + HUD PASS)
  // ============================================================
  console.log('\n[GROUP 11] Consolidated One-Row World Utility HUD (Header + HUD Pass)');

  assert(indexHtml.includes('id="game-hud-top"'), 'Intentional top HUD container #game-hud-top exists');
  assert(indexHtml.includes('id="btn-hud-exit-world"'), 'Visible primary Exit/Back button #btn-hud-exit-world exists in HUD');
  assert(indexHtml.includes('class="hud-exit-btn"'), 'Exit button uses .hud-exit-btn styling');
  assert(indexHtml.includes('id="compact-quest-chip"'), 'Calling card #compact-quest-chip positioned inside one-row HUD');
  assert(indexHtml.includes('id="canvas-presence-badge"'), 'Presence badge #canvas-presence-badge positioned inside one-row HUD');
  assert(indexHtml.includes('id="canvas-place-badge"'), 'Place badge #canvas-place-badge preserved in DOM for JS compatibility');
  assert(indexHtml.includes('class="chip-quest-arrow"'), 'Calling card includes interactive arrow indicator');

  assert(cssContent.includes('.game-hud-top'), 'styles.css styles .game-hud-top layout');
  assert(cssContent.includes('top: 6px'), 'game-hud-top uses snug top: 6px positioning (no double safe-area dead space)');
  assert(cssContent.includes('flex-direction: row'), 'game-hud-top uses horizontal row flex layout');
  assert(cssContent.includes('.hud-exit-btn'), 'styles.css defines .hud-exit-btn styling');
  assert(cssContent.includes('text-overflow: ellipsis'), 'Calling card title specifies text-overflow: ellipsis');
  assert(cssContent.includes('white-space: nowrap'), 'Calling card title specifies white-space: nowrap');
  assert(cssContent.includes('.game-hud-top .canvas-place-badge'), 'Place badge demoted with display: none !important');

  // Verify game.js event listeners for btn-hud-exit-world
  assert(gameJsContent.includes('btn-hud-exit-world'), 'game.js wires event listener for #btn-hud-exit-world');
  assert(gameJsContent.includes('exitWorldToHomeCard(false)'), 'btn-hud-exit-world triggers exitWorldToHomeCard(false)');

  // ============================================================
  // GROUP 12: VIRTUAL JOYSTICK SAFE-AREA ERGONOMICS (REVISION 3)
  // ============================================================
  console.log('\n[GROUP 12] Virtual Joystick Safe-Area Ergonomics (Revision 3)');

  assert(cssContent.includes('.joystick-container'), 'styles.css styles .joystick-container');
  assert(cssContent.includes('clamp(34px') || cssContent.includes('left: clamp(34px'), 'Joystick specifies increased inward offset (>= 34px)');
  assert(cssContent.includes('calc(env(safe-area-inset-left'), 'Joystick respects safe-area-inset-left');
  assert(cssContent.includes('calc(env(safe-area-inset-bottom'), 'Joystick respects safe-area-inset-bottom');
  assert(gameJsContent.includes('joystick-base'), 'game.js dynamically references #joystick-base for touch tracking');

  // ============================================================
  // GROUP 13: CAMERA VIEWPORT PINCH-TO-ZOOM ENGINE (REVISION 4)
  // ============================================================
  console.log('\n[GROUP 13] Camera Viewport Pinch-to-Zoom Engine (Revision 4)');

  assert(gameJsContent.includes('const MIN_ZOOM = 0.85'), 'game.js defines canonical MIN_ZOOM = 0.85');
  assert(gameJsContent.includes('const MAX_ZOOM = 2.0'), 'game.js defines canonical MAX_ZOOM = 2.0');
  assert(gameJsContent.includes('function setCameraZoom'), 'game.js defines setCameraZoom helper');
  assert(gameJsContent.includes('function getCameraZoom'), 'game.js defines getCameraZoom helper');
  assert(gameJsContent.includes('activePinchDistance = getTouchDistance'), 'game.js tracks two-touch pinch distance on touchstart');
  assert(gameJsContent.includes('pinchStartZoom * ratio'), 'game.js calculates zoom scale ratio dynamically on touchmove');
  assert(gameJsContent.includes('e.preventDefault()'), 'game.js prevents default browser zoom during 2-touch gesture');
  assert(gameJsContent.includes('Math.min(MAX_ZOOM, Math.max(MIN_ZOOM'), 'setCameraZoom clamps zoom strictly between MIN_ZOOM and MAX_ZOOM');
  assert(gameJsContent.includes('setCameraZoom') && gameJsContent.includes('KOINONIA_GAME'), 'KOINONIA_GAME exports setCameraZoom API');

  // ============================================================
  // GROUP 14: STYLIZED ILLUSTRATIVE REALISM ENVIRONMENT ART (REVISION 5)
  // ============================================================
  console.log('\n[GROUP 14] Stylized Illustrative Realism Environment Art (Revision 5)');

  assert(gameJsContent.includes('function drawWall'), 'Reusable rendering helper drawWall exists in game.js');
  assert(gameJsContent.includes('function drawFloorPlanks'), 'Reusable rendering helper drawFloorPlanks exists in game.js');
  assert(gameJsContent.includes('function drawTable'), 'Reusable rendering helper drawTable exists in game.js');
  assert(gameJsContent.includes('function drawBed'), 'Reusable rendering helper drawBed exists in game.js');
  assert(gameJsContent.includes('function drawBookshelf'), 'Reusable rendering helper drawBookshelf exists in game.js');
  assert(gameJsContent.includes('function drawGate'), 'Reusable rendering helper drawGate exists in game.js');
  assert(gameJsContent.includes('function drawGardenPlot'), 'Reusable rendering helper drawGardenPlot exists in game.js');
  assert(gameJsContent.includes('drawWall(ctx, 0, 0, LOGICAL_WIDTH, 32'), 'renderHomeWorld renders North outer wall with architectural trim');
  assert(gameJsContent.includes('drawFloorPlanks(ctx, 32, 32'), 'renderHomeWorld renders bedroom wooden planks');
  assert(gameJsContent.includes('drawBed(ctx, 2 * 32, 2 * 32'), 'renderHomeWorld renders Hearth bed with linen & quilt');
  assert(gameJsContent.includes('drawTable(ctx, 6 * 32, 2 * 32 + 4'), 'renderHomeWorld renders study desk with Scripture & lamp');
  assert(gameJsContent.includes('drawBookshelf(ctx, 12 * 32, 2 * 32'), 'renderHomeWorld renders bookshelf with multi-color book spines');
  assert(gameJsContent.includes('drawGate(ctx, 10 * 32, 11 * 32 - 6'), 'renderHomeWorld renders Garden Gate with pickets and latch');
  assert(gameJsContent.includes('drawGardenPlot(ctx, 3 * 32, 13 * 32'), 'renderHomeWorld renders raised timber garden plot');

  // Verify collision grid remains identical
  assert(gameJsContent.includes('for (let r = 2; r <= 5; r++)'), 'Bed collision geometry rows 2-5 preserved');
  assert(gameJsContent.includes('for (let c = 6; c <= 8; c++) collisionGrid[2][c] = 1'), 'Study desk collision geometry row 2 cols 6-8 preserved');
  assert(gameJsContent.includes('for (let c = 12; c <= 15; c++) collisionGrid[2][c] = 1'), 'Bookshelf collision geometry row 2 cols 12-15 preserved');

  // ============================================================
  // GROUP 15: BETA IDENTITY PROVIDER & ROLE SCOPING (REVISION 6)
  // ============================================================
  console.log('\n[GROUP 15] Beta Identity Provider & Role Scoping (Revision 6)');

  const BetaIdentityProvider = require('./data/beta_identity.js');
  assert(BetaIdentityProvider !== undefined, 'BetaIdentityProvider module loads successfully');
  assert(typeof BetaIdentityProvider.getPersonas === 'function', 'BetaIdentityProvider.getPersonas is a function');

  const personas = BetaIdentityProvider.getPersonas();
  assert(personas.length === 3, 'BetaIdentityProvider provides exactly 3 test personas');

  const memberAlex = personas.find(p => p.role === 'MEMBER');
  assert(memberAlex && memberAlex.name === 'Alex Rivera', 'Persona MEMBER is Alex Rivera');
  assert(memberAlex.capabilities.canAccessStudio === false, 'Member Alex has canAccessStudio: false');
  assert(memberAlex.capabilities.canPublish === false, 'Member Alex has canPublish: false');
  assert(memberAlex.disclaimer.includes('No real FOG account authority'), 'Member Alex disclaimer flags non-production status');

  const adminSarah = personas.find(p => p.role === 'ADMIN');
  assert(adminSarah && adminSarah.name === 'Sarah Jenkins', 'Persona ADMIN is Sarah Jenkins');
  assert(adminSarah.capabilities.canAccessStudio === true, 'Admin Sarah has canAccessStudio: true');
  assert(adminSarah.capabilities.canRequestReview === true, 'Admin Sarah has canRequestReview: true');
  assert(adminSarah.capabilities.canPublish === false, 'Admin Sarah has canPublish: false (governance preserved)');

  const superadminDavid = personas.find(p => p.role === 'SUPERADMIN');
  assert(superadminDavid && superadminDavid.name === 'Pastor David', 'Persona SUPERADMIN is Pastor David');
  assert(superadminDavid.capabilities.canAccessStudio === true, 'Superadmin Pastor David has canAccessStudio: true');
  assert(superadminDavid.capabilities.canPublish === true, 'Superadmin Pastor David has canPublish: true');
  assert(superadminDavid.capabilities.canApprove === true, 'Superadmin Pastor David has canApprove: true');

  // Namespaced save key verification
  assert(BetaIdentityProvider.getNamespacedSaveKey(memberAlex) === 'koinonia.phase22_1.save.youth_demo_01', 'Member save key is namespaced to youth_demo_01');
  assert(BetaIdentityProvider.getNamespacedSaveKey(adminSarah) === 'koinonia.phase22_1.save.admin_sarah', 'Admin save key is namespaced to admin_sarah');
  assert(BetaIdentityProvider.getNamespacedSaveKey(superadminDavid) === 'koinonia.phase22_1.save.pastor_david', 'Superadmin save key is namespaced to pastor_david');

  // Markup & Modals verification
  assert(indexHtml.includes('id="modal-account-drawer"'), 'Account Drawer modal #modal-account-drawer exists in index.html');
  assert(indexHtml.includes('id="modal-beta-profile-picker"'), 'Beta Profile Picker modal #modal-beta-profile-picker exists in index.html');
  assert(indexHtml.includes('data-persona="MEMBER"'), 'Profile picker provides selectable MEMBER card');
  assert(indexHtml.includes('data-persona="ADMIN"'), 'Profile picker provides selectable ADMIN card');
  assert(indexHtml.includes('data-persona="SUPERADMIN"'), 'Profile picker provides selectable SUPERADMIN card');
  assert(indexHtml.includes('id="btn-account-switch-profile"'), 'Account Drawer contains Switch Beta Profile action');
  assert(indexHtml.includes('id="btn-account-exit-world"'), 'Account Drawer contains Exit World action');
  assert(indexHtml.includes('id="btn-account-studio"'), 'Account Drawer contains role-gated Studio action');
  assert(indexHtml.includes('Beta Test Demonstration Only'), 'Profile picker displays non-production auth disclaimer');

  // Logic wiring in game.js
  assert(gameJsContent.includes('BetaIdentityProvider.hasSavedIdentity()'), 'enterKoinoniaWorld checks for saved beta identity');
  assert(gameJsContent.includes('openBetaProfilePickerModal()'), 'enterKoinoniaWorld opens profile picker if fresh session');

  // Phase 0.22.1 final hardening: protect the physically verified
  // BEGIN YOUR JOURNEY -> Beta Profile Picker transition.
  const enterWorldStart = gameJsContent.indexOf('function enterKoinoniaWorld(e)');
  const freshIdentityCheck = gameJsContent.indexOf(
    '!BetaIdentityProvider.hasSavedIdentity()',
    enterWorldStart
  );
  const freshHideTitle = gameJsContent.indexOf(
    "titleScreen.classList.add('hidden')",
    freshIdentityCheck
  );
  const freshOpenPicker = gameJsContent.indexOf(
    'openBetaProfilePickerModal();',
    freshIdentityCheck
  );
  const freshReturn = gameJsContent.indexOf(
    'return;',
    freshOpenPicker
  );

  assert(
    enterWorldStart >= 0 && freshIdentityCheck > enterWorldStart,
    'BEGIN YOUR JOURNEY contains explicit fresh-session identity branch'
  );

  assert(
    freshHideTitle > freshIdentityCheck && freshHideTitle < freshOpenPicker,
    'Fresh-session entry hides intro screen before opening Beta Profile Picker'
  );

  assert(
    freshOpenPicker > freshHideTitle && freshReturn > freshOpenPicker,
    'Fresh-session entry opens Beta Profile Picker then returns safely'
  );

  const closePickerStart = gameJsContent.indexOf('function closeBetaProfilePickerModal()');
  const closePickerIdentityCheck = gameJsContent.indexOf(
    '!BetaIdentityProvider.hasSavedIdentity()',
    closePickerStart
  );
  const restoreTitle = gameJsContent.indexOf(
    "titleScreen.classList.add('active')",
    closePickerIdentityCheck
  );

  assert(
    closePickerStart >= 0 &&
    closePickerIdentityCheck > closePickerStart &&
    restoreTitle > closePickerIdentityCheck,
    'Closing fresh-session profile picker safely restores BEGIN YOUR JOURNEY screen'
  );

  assert(gameJsContent.includes('openAdminStudio') && gameJsContent.includes('canAccessStudio()'), 'openAdminStudio enforces role permissions');

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runBetaTestSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
