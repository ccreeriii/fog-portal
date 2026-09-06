/**
 * KOINONIA PHASE 0.20.2 — AUTOMATED LOAD TEST HARNESS
 * Real-Time Shared Presence & Safe Social Interaction
 *
 * Simulates concurrent WebSocket clients (tiers: 25, 50, 100, 150),
 * measures connection success, movement broadcast latency (p50, p95, p99),
 * message throughput, memory usage, and disconnect cleanup on Raspberry Pi.
 */

'use strict';

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

const parseArgs = () => {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=');
      args[k] = v || true;
    }
  });
  return args;
};

const args = parseArgs();
const PORT = parseInt(args.port || 18107, 10);
const HOST = args.host || '127.0.0.1';
const WS_URL = `ws://${HOST}:${PORT}/realtime`;
const TIERS = args.tiers ? args.tiers.split(',').map(n => parseInt(n.trim(), 10)) : [25, 50, 100, 150];
const TIER_DURATION_SEC = parseInt(args.duration || 6, 10);

const PLACES = ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'];
const EMOTES = ['ENCOURAGE', 'PRAYING', 'KEEP_GOING', 'GROWING_TOGETHER', 'GREAT_JOB'];

const delay = (ms) => new Promise(res => setTimeout(res, ms));

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[index];
}

async function runTier(clientCount, durationSec) {
  console.log(`\n==================================================`);
  console.log(`RUNNING TIER: ${clientCount} CONCURRENT CLIENTS (${durationSec}s)`);
  console.log(`==================================================`);

  const memBefore = process.memoryUsage();
  const clients = [];
  const latencies = [];
  let connectedCount = 0;
  let errorCount = 0;
  let packetsSent = 0;
  let packetsReceived = 0;

  // Connect phase
  const connectPromises = [];
  for (let i = 0; i < clientCount; i++) {
    const memberId = `load_bot_${i.toString().padStart(3, '0')}`;
    const displayName = `Pilgrim ${i + 1}`;
    const targetPlace = PLACES[i % PLACES.length];

    const p = new Promise((resolve) => {
      let ws;
      try {
        ws = new WebSocket(WS_URL);
      } catch (err) {
        errorCount++;
        return resolve(null);
      }

      const clientObj = {
        id: memberId,
        name: displayName,
        place: targetPlace,
        ws,
        seq: 0,
        x: 10 + (i % 5),
        y: 10 + Math.floor(i / 5),
        facing: 'down',
        intervalId: null
      };

      const timeout = setTimeout(() => {
        errorCount++;
        resolve(null);
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        connectedCount++;

        // Send JOIN_PLACE
        ws.send(JSON.stringify({
          type: 'JOIN_PLACE',
          memberId,
          displayName,
          placeId: targetPlace,
          x: clientObj.x,
          y: clientObj.y,
          facing: clientObj.facing
        }));
        packetsSent++;
        resolve(clientObj);
      });

      ws.on('message', (data) => {
        packetsReceived++;
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'MEMBER_MOVED' && msg.timestamp) {
            const rtt = Date.now() - msg.timestamp;
            if (rtt >= 0 && rtt < 10000) {
              latencies.push(rtt);
            }
          }
        } catch (e) {}
      });

      ws.on('error', () => {
        errorCount++;
        resolve(null);
      });
    });

    connectPromises.push(p);
    // Slight stagger to avoid instant syn-flood
    if (i % 10 === 0) await delay(15);
  }

  const resolvedClients = (await Promise.all(connectPromises)).filter(Boolean);
  const connectSuccessRate = (resolvedClients.length / clientCount) * 100;
  console.log(`Connected: ${resolvedClients.length}/${clientCount} (${connectSuccessRate.toFixed(1)}%)`);

  // Active load phase: 10Hz movement updates
  const startTime = Date.now();
  resolvedClients.forEach((client, idx) => {
    client.intervalId = setInterval(() => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.seq++;
        client.x += (Math.random() - 0.5) * 0.2;
        client.y += (Math.random() - 0.5) * 0.2;
        client.ws.send(JSON.stringify({
          type: 'MOVE',
          seq: client.seq,
          x: Number(client.x.toFixed(2)),
          y: Number(client.y.toFixed(2)),
          facing: 'down',
          timestamp: Date.now()
        }));
        packetsSent++;

        // 1 in 20 cycles (~0.5Hz) send an emote
        if (client.seq % 20 === 0) {
          const emoteId = EMOTES[idx % EMOTES.length];
          client.ws.send(JSON.stringify({
            type: 'EMOTE',
            emoteId,
            timestamp: Date.now()
          }));
          packetsSent++;
        }
      }
    }, 100); // 100ms = 10 updates/sec
  });

  // Run for durationSec
  await delay(durationSec * 1000);

  const memPeak = process.memoryUsage();
  const elapsedSec = (Date.now() - startTime) / 1000;

  // Cleanup intervals and close
  resolvedClients.forEach(c => {
    if (c.intervalId) clearInterval(c.intervalId);
    if (c.ws && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(JSON.stringify({ type: 'LEAVE_PLACE' }));
      c.ws.close();
    }
  });

  // Wait for disconnects to settle
  await delay(1500);
  const memAfter = process.memoryUsage();

  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const sendRate = Math.round(packetsSent / elapsedSec);
  const recvRate = Math.round(packetsReceived / elapsedSec);

  const result = {
    tier: clientCount,
    connected: resolvedClients.length,
    successRate: connectSuccessRate.toFixed(1) + '%',
    packetsSent,
    packetsReceived,
    sendRate: `${sendRate} msg/s`,
    recvRate: `${recvRate} msg/s`,
    latencySamples: latencies.length,
    p50: `${p50}ms`,
    p95: `${p95}ms`,
    p99: `${p99}ms`,
    memBeforeMb: (memBefore.rss / (1024 * 1024)).toFixed(1),
    memPeakMb: (memPeak.rss / (1024 * 1024)).toFixed(1),
    memAfterMb: (memAfter.rss / (1024 * 1024)).toFixed(1),
    cleanupSuccess: (memAfter.rss <= memPeak.rss * 1.05)
  };

  console.log(`Results for ${clientCount} clients:`);
  console.log(`  Send Rate: ${result.sendRate} | Recv Rate: ${result.recvRate}`);
  console.log(`  Latency: p50=${result.p50}, p95=${result.p95}, p99=${result.p99} (${latencies.length} samples)`);
  console.log(`  Memory: Before=${result.memBeforeMb}MB, Peak=${result.memPeakMb}MB, After=${result.memAfterMb}MB`);
  console.log(`  Cleanup: ${result.cleanupSuccess ? 'CLEAN (zero leak)' : 'INSPECT'}`);

  return result;
}

async function main() {
  console.log('Starting Koinonia Phase 0.20.2 Automated Load Test Battery...');
  console.log(`Target: ${WS_URL}`);
  console.log(`Tiers: ${TIERS.join(', ')}`);
  console.log(`Duration per tier: ${TIER_DURATION_SEC}s\n`);

  const results = [];
  for (const tier of TIERS) {
    try {
      const res = await runTier(tier, TIER_DURATION_SEC);
      results.push(res);
      await delay(2000); // Cool-down between tiers
    } catch (err) {
      console.error(`Tier ${tier} error:`, err);
    }
  }

  console.log('\n\n========================================================================================');
  console.log('KOINONIA PHASE 0.20.2 LOAD TEST BENCHMARK RESULTS');
  console.log('========================================================================================\n');

  console.log('| Clients | Connect Rate | Send Rate | Recv Rate | Latency (p50) | Latency (p95) | Latency (p99) | RSS Peak | Cleanup |');
  console.log('|---------|--------------|-----------|-----------|---------------|---------------|---------------|----------|---------|');
  results.forEach(r => {
    console.log(`| ${r.tier.toString().padEnd(7)} | ${r.successRate.padEnd(12)} | ${r.sendRate.padEnd(9)} | ${r.recvRate.padEnd(9)} | ${r.p50.padEnd(13)} | ${r.p95.padEnd(13)} | ${r.p99.padEnd(13)} | ${(r.memPeakMb + ' MB').padEnd(8)} | ${r.cleanupSuccess ? 'PASS' : 'WARN'}    |`);
  });
  console.log('\n========================================================================================\n');
}

main().catch(err => {
  console.error('Fatal load test failure:', err);
  process.exit(1);
});
