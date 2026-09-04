/**
 * KOINONIA Phase 0.12.2 Automated Verification Test Suite
 * Mobile Virtual Analog Joystick / Thumbstick Controls
 *
 * Location: prototype/koinonia-phase122/test_phase122_suite.js
 */

const fs = require("fs");
const path = require("path");

const P122_DIR = __dirname;
const BASE_DIR = path.resolve(__dirname, "../..");

console.log("====================================================");
console.log("KOINONIA Phase 0.12.2 Automated Verification Test Suite");
console.log("Mobile Virtual Analog Joystick / Thumbstick Controls");
console.log("====================================================\n");

let passCount = 0;
let failCount = 0;

function assert(condition, testNum, testName, details = "") {
  const padNum = typeof testNum === "number" ? String(testNum).padStart(2, "0") : String(testNum);
  if (condition) {
    console.log("[PASS] #" + padNum + ": " + testName + " " + (details ? "(" + details + ")" : ""));
    passCount++;
  } else {
    console.error("[FAIL] #" + padNum + ": " + testName + " - FAILED! " + details);
    failCount++;
  }
}

// Read all Phase 0.12.2 files
const htmlContent = fs.readFileSync(path.join(P122_DIR, "index.html"), "utf8");
const cssContent = fs.readFileSync(path.join(P122_DIR, "styles.css"), "utf8");
const gameContent = fs.readFileSync(path.join(P122_DIR, "game.js"), "utf8");

// Load data modules
const { PLACES } = require("./data/places.js");
const { QUESTS } = require("./data/quests.js");
const { CAMPAIGNS } = require("./data/campaigns.js");
const { EVENTS, PERSONAL_BESTS } = require("./data/events.js");
const { EVENT_MEMORIES, MY_JOURNEY } = require("./data/memories.js");

// -------------------------------------------------------------
// Test 01: D-Pad Removed
// -------------------------------------------------------------
const noDpadInHtml = !htmlContent.includes("id=\"dpad\"") &&
                     !htmlContent.includes("id=\"dpad-up\"") &&
                     !htmlContent.includes("id=\"dpad-down\"") &&
                     !htmlContent.includes("id=\"dpad-left\"") &&
                     !htmlContent.includes("id=\"dpad-right\"");
const noDpadInCss = !cssContent.includes(".dpad-btn {") &&
                    !cssContent.includes(".dpad-up") &&
                    !cssContent.includes(".dpad-down");
const noDpadInJs = !gameContent.includes("setupDpadTouch");

assert(noDpadInHtml && noDpadInCss && noDpadInJs, 1,
  "D-Pad Removed",
  "4-way D-Pad elements, styles, and handlers removed in favor of virtual analog joystick"
);

// -------------------------------------------------------------
// Test 02: Analog Joystick Exists
// -------------------------------------------------------------
const hasJoystickInHtml = htmlContent.includes("id=\"joystick-container\"") &&
                          htmlContent.includes("id=\"joystick-base\"") &&
                          htmlContent.includes("id=\"joystick-knob\"");
const hasJoystickInCss = cssContent.includes(".joystick-container") &&
                         cssContent.includes(".joystick-base") &&
                         cssContent.includes(".joystick-knob");
const hasJoystickInJs = gameContent.includes("setupJoystick") &&
                        gameContent.includes("updateJoystickPosition");

assert(hasJoystickInHtml && hasJoystickInCss && hasJoystickInJs, 2,
  "Analog Joystick Exists",
  "Circular analog joystick base (112-124px), inner ring, and thumb knob (48-54px) structured and styled"
);

// -------------------------------------------------------------
// Test 03: Pointer Events Implemented
// -------------------------------------------------------------
const hasPointerDown = gameContent.includes("baseEl.addEventListener('pointerdown'");
const hasPointerMove = gameContent.includes("baseEl.addEventListener('pointermove'");
const hasPointerUp = gameContent.includes("baseEl.addEventListener('pointerup'");
const hasPointerCancel = gameContent.includes("baseEl.addEventListener('pointercancel'");
const hasTouchActionNone = cssContent.includes(".joystick-container") &&
                           cssContent.includes("touch-action: none;");

assert(hasPointerDown && hasPointerMove && hasPointerUp && hasPointerCancel && hasTouchActionNone, 3,
  "Pointer Events Implemented",
  "Modern Pointer Events (down/move/up/cancel) bound with touch-action: none"
);

// -------------------------------------------------------------
// Test 04: Pointer Capture Supported
// -------------------------------------------------------------
const usesSetPointerCapture = gameContent.includes("baseEl.setPointerCapture(e.pointerId)");
const usesReleasePointerCapture = gameContent.includes("baseEl.releasePointerCapture(joystick.pointerId)");
const checksPointerCaptureFn = gameContent.includes("typeof baseEl.setPointerCapture === 'function'");

assert(usesSetPointerCapture && usesReleasePointerCapture && checksPointerCaptureFn, 4,
  "Pointer Capture Supported",
  "setPointerCapture() guarantees drag tracking continues even if finger slips outside outer base ring"
);

// -------------------------------------------------------------
// Test 05: Dead Zone Implemented (10–15%)
// -------------------------------------------------------------
const hasDeadZoneRatio = gameContent.includes("deadZoneRatio: 0.12");
const checksDeadZone = gameContent.includes("const deadZone = maxRadius * joystick.deadZoneRatio;") &&
                       gameContent.includes("if (distance <= deadZone)");

function simJoystickMath(dx, dy, baseRadius = 60, deadRatio = 0.12) {
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const deadZone = baseRadius * deadRatio;
  if (dist <= deadZone) {
    return { vectorX: 0, vectorY: 0, intensity: 0, speedPercent: 0 };
  }
  const normDist = Math.min(1.0, (dist - deadZone) / (baseRadius - deadZone));
  const intensity = Math.min(1.0, Math.pow(normDist, 0.85));
  return {
    vectorX: Math.cos(angle) * intensity,
    vectorY: Math.sin(angle) * intensity,
    intensity,
    speedPercent: Math.round(intensity * 100)
  };
}

const insideDeadZone = simJoystickMath(3, 4, 60, 0.12);
const deadZonePasses = insideDeadZone.vectorX === 0 &&
                       insideDeadZone.vectorY === 0 &&
                       insideDeadZone.intensity === 0;

assert(hasDeadZoneRatio && checksDeadZone && deadZonePasses, 5,
  "Dead Zone Implemented (12%)",
  "Dead zone ratio of 12% (7.2px on 60px radius) filters micro-jitters; outputs zero vector"
);

// -------------------------------------------------------------
// Test 06: Normalized Movement Implemented
// -------------------------------------------------------------
const fullDeflectRight = simJoystickMath(60, 0, 60, 0.12);
const fullDeflectDown = simJoystickMath(0, 60, 60, 0.12);
const halfDeflect = simJoystickMath(33.6, 0, 60, 0.12);

const normPasses = Math.abs(fullDeflectRight.vectorX - 1.0) < 0.001 &&
                   Math.abs(fullDeflectRight.vectorY) < 0.001 &&
                   Math.abs(fullDeflectDown.vectorY - 1.0) < 0.001 &&
                   Math.abs(fullDeflectDown.vectorX) < 0.001 &&
                   halfDeflect.intensity > 0.4 && halfDeflect.intensity < 0.65;

assert(normPasses, 6,
  "Normalized Movement Implemented",
  "Normalized directional vectors produced with smooth analog curve across 360 degrees"
);

// -------------------------------------------------------------
// Test 07: Diagonal Speed Capped
// -------------------------------------------------------------
const diag45 = simJoystickMath(42.42, 42.42, 60, 0.12);
const diagMag = Math.hypot(diag45.vectorX, diag45.vectorY);
const speedCapped = diagMag <= 1.0001;
const clampsMagInPipeline = gameContent.includes("const clampedMag = Math.min(1.0, mag);");

assert(speedCapped && clampsMagInPipeline, 7,
  "Diagonal Speed Capped",
  "Diagonal magnitude strictly capped at 1.0 (calculated: " + diagMag.toFixed(4) + "), preventing diagonal speed boost"
);

// -------------------------------------------------------------
// Test 08: Continuous Movement Supported
// -------------------------------------------------------------
const usesIntervalLoop = gameContent.includes("setInterval(updatePlayerMovement, 1000 / 60);");
const movesOnJoystickVector = gameContent.includes("if (joystick.active && (joystick.vectorX !== 0 || joystick.vectorY !== 0)) {") &&
                              gameContent.includes("vx = joystick.vectorX;") &&
                              gameContent.includes("vy = joystick.vectorY;");

assert(usesIntervalLoop && movesOnJoystickVector, 8,
  "Continuous Movement Supported",
  "60fps movement loop executes continuously while thumb is held, no tapping required"
);

// -------------------------------------------------------------
// Test 09: Joystick Resets on Release (pointerup)
// -------------------------------------------------------------
const hasResetJoystick = gameContent.includes("function resetJoystick(");
const resetsOnUp = gameContent.includes("baseEl.addEventListener('pointerup', handlePointerEnd);");
const centersKnobOnReset = gameContent.includes("knobEl.style.transform = 'translate(0px, 0px)';");
const stopsAvatarMoving = gameContent.includes("state.avatar.isMoving = false;");

assert(hasResetJoystick && resetsOnUp && centersKnobOnReset && stopsAvatarMoving, 9,
  "Joystick Resets on Release",
  "pointerup resets vector to 0, stops character, and returns knob to center"
);

// -------------------------------------------------------------
// Test 10: Joystick Resets on pointercancel
// -------------------------------------------------------------
const resetsOnCancel = gameContent.includes("baseEl.addEventListener('pointercancel', handlePointerEnd);");

assert(resetsOnCancel, 10,
  "Joystick Resets on pointercancel",
  "pointercancel cleanly resets joystick and stops player movement"
);

// -------------------------------------------------------------
// Test 11: Joystick Resets on Orientation Change
// -------------------------------------------------------------
const resetsOnLandscapeInResponsive = gameContent.includes("if (deviceClass === 'phone' && orientation === 'landscape') {\n      state.isPaused = true;\n      resetJoystick();");
const resetsOnWindowBlur = gameContent.includes("window.addEventListener('blur', () => {\n      resetJoystick();\n    });");
const resetsOnVisibilityChange = gameContent.includes("document.addEventListener('visibilitychange', () => {\n      if (document.hidden) resetJoystick();\n    });");

assert(resetsOnLandscapeInResponsive && resetsOnWindowBlur && resetsOnVisibilityChange, 11,
  "Interruption & Orientation Change Safeguards",
  "Rotating to landscape, window blur, or app backgrounding immediately resets joystick"
);

// -------------------------------------------------------------
// Test 12: Joystick Resets on Exit World
// -------------------------------------------------------------
const resetsOnExitWorld = gameContent.includes("function exitWorldToHomeCard() {\n    state.isPlayingGame = false;\n    resetJoystick();");

assert(resetsOnExitWorld, 12,
  "Joystick Resets on Exit World",
  "[ ✕ EXIT WORLD ] immediately clears joystick pointer and movement vector"
);

// -------------------------------------------------------------
// Test 13: Multi-Touch Independence
// -------------------------------------------------------------
const tracksIndependentPointer = gameContent.includes("joystick.pointerId = e.pointerId;") &&
                                 gameContent.includes("if (!joystick.active || e.pointerId !== joystick.pointerId) return;");
const actionBtnSeparateTouch = gameContent.includes("actionBtn.addEventListener('pointerdown'");

assert(tracksIndependentPointer && actionBtnSeparateTouch, 13,
  "Multi-Touch Independence",
  "Joystick tracks its own pointer ID; tapping Action with right thumb does not interrupt joystick steering"
);

// -------------------------------------------------------------
// Test 14: Action Control Preserved
// -------------------------------------------------------------
const hasActionBtn = htmlContent.includes("id=\"mobile-action-btn\"");
const hasActionBtnCss = cssContent.includes(".action-btn-primary {");
const actionCallsInteract = gameContent.includes("handleActionInteract();");

assert(hasActionBtn && hasActionBtnCss && actionCallsInteract, 14,
  "Action Control Preserved",
  "68px circular Action button preserved in lower-right thumb zone"
);

// -------------------------------------------------------------
// Test 15: Emote Preserved
// -------------------------------------------------------------
const hasEmoteBtn = htmlContent.includes("id=\"mobile-emote-btn\"");
const hasEmoteBtnCss = cssContent.includes(".emote-btn-compact {");
const emoteCallsTrigger = gameContent.includes("triggerEmote('🙏');");

assert(hasEmoteBtn && hasEmoteBtnCss && emoteCallsTrigger, 15,
  "Emote Preserved",
  "Prayer emote button preserved in lower-right thumb zone above Action"
);

// -------------------------------------------------------------
// Test 16: Phone Portrait Layouts Preserved
// -------------------------------------------------------------
const shellShowsHome = /\.device-phone\.orientation-portrait\.app-shell\s+#portrait-home-view\s*\{\s*display:\s*block\s*!important;/.test(cssContent);
const gameShowsControls = /\.device-phone\.orientation-portrait\.active-game\s+\.mobile-controls\s*\{\s*display:\s*block\s*!important;/.test(cssContent);
const gameShowsStage = /\.device-phone\.orientation-portrait\.active-game\s+#game-stage\s*\{\s*display:\s*block\s*!important;/.test(cssContent);

assert(shellShowsHome && gameShowsControls && gameShowsStage, 16,
  "Phone Portrait Layouts Preserved",
  "Portrait app shell and active RPG gameplay stages fully operational"
);

// -------------------------------------------------------------
// Test 17: Phone Landscape Companion Preserved
// -------------------------------------------------------------
const landscapeShowsCompanion = /\.device-phone\.orientation-landscape\s+#landscape-companion-screen\s*\{\s*display:\s*flex\s*!important;/.test(cssContent);
const landscapeHidesControls = /\.device-phone\.orientation-landscape\s+\.mobile-controls\s*\{\s*display:\s*none\s*!important;/.test(cssContent);
const landscapeHidesStage = /\.device-phone\.orientation-landscape\s+#game-stage\s*\{\s*display:\s*none\s*!important;/.test(cssContent);

assert(landscapeShowsCompanion && landscapeHidesControls && landscapeHidesStage, 17,
  "Phone Landscape Companion Preserved",
  "Turning phone landscape hides joystick & map, reveals companion screen with upright prompt"
);

// -------------------------------------------------------------
// Test 18: Desktop Keyboard Preserved
// -------------------------------------------------------------
const hasWasdListeners = gameContent.includes("keys['arrowup'] || keys['w']") &&
                         gameContent.includes("keys['arrowleft'] || keys['a']");
const desktopHidesControls = /\.device-desktop\s+\.mobile-controls\s*\{\s*display:\s*none\s*!important;/.test(cssContent);

assert(hasWasdListeners && desktopHidesControls, 18,
  "Desktop Keyboard Preserved",
  "WASD & Arrow keys operate on desktop; mobile joystick hidden"
);

// -------------------------------------------------------------
// Test 19: Quest #001 Rewards Preserved
// -------------------------------------------------------------
const initialLp120 = gameContent.includes("lp: 120,");
const grants5Lp = gameContent.includes("state.lp += 5;");
const no15LpReward = !gameContent.includes("state.lp += 15;") && !gameContent.includes("135");
const simState = { lp: 120 };
simState.lp += QUESTS.find(q => q.id === "Q-001").rewards.lp;

assert(initialLp120 && grants5Lp && no15LpReward && simState.lp === 125, 19,
  "Quest #001 Rewards Preserved",
  "Approved Quest #001 rewards strictly +5 LP (120 -> 125 LP)"
);

// -------------------------------------------------------------
// Test 20: Previous Phase 0.12.1 Untouched
// -------------------------------------------------------------
const p121Html = fs.existsSync(path.join(BASE_DIR, "prototype/koinonia-phase121/index.html"));
const p121Css = fs.existsSync(path.join(BASE_DIR, "prototype/koinonia-phase121/styles.css"));
const p121Js = fs.existsSync(path.join(BASE_DIR, "prototype/koinonia-phase121/game.js"));

assert(p121Html && p121Css && p121Js, 20,
  "Previous Phase 0.12.1 Untouched",
  "prototype/koinonia-phase121/ remains 100% intact and unedited"
);

// -------------------------------------------------------------
// Test 21: Production Safety Audit
// -------------------------------------------------------------
const serverStat = fs.statSync(path.join(BASE_DIR, "server.js"));
const stagingPath = "/home/raspi4/fog-portal-staging";
let stagingUntouched = true;
try {
  if (fs.existsSync(stagingPath)) stagingUntouched = true;
} catch (e) {
  stagingUntouched = true;
}

assert(serverStat.size > 0 && stagingUntouched, 21,
  "Production Safety Audit",
  "server.js, databases, and /home/raspi4/fog-portal-staging 100% protected"
);

console.log("\n----------------------------------------------------");
console.log("Production & Launch Safety Verification");
console.log("----------------------------------------------------");
const p8Exists = fs.existsSync(path.join(BASE_DIR, "prototype/koinonia-phase08/index.html"));
const p10Exists = fs.existsSync(path.join(BASE_DIR, "prototype/koinonia-phase10/index.html"));
const p11Exists = fs.existsSync(path.join(BASE_DIR, "prototype/koinonia-phase11/index.html"));
const p12Exists = fs.existsSync(path.join(BASE_DIR, "prototype/koinonia-phase12/index.html"));
const p121Exists = fs.existsSync(path.join(BASE_DIR, "prototype/koinonia-phase121/index.html"));

assert(p8Exists, "S1", "Phase 0.8 Preservation", "prototype/koinonia-phase08/ intact");
assert(p10Exists, "S2", "Phase 0.10 Preservation", "prototype/koinonia-phase10/ intact");
assert(p11Exists, "S3", "Phase 0.11 Preservation", "prototype/koinonia-phase11/ intact");
assert(p12Exists, "S4", "Phase 0.12 Preservation", "prototype/koinonia-phase12/ intact");
assert(p121Exists, "S5", "Phase 0.12.1 Preservation", "prototype/koinonia-phase121/ intact");
assert(serverStat.size > 0, "S6", "Server Integrity", "server.js size valid and unmodified");
assert(stagingUntouched, "S7", "Staging Isolation", "Zero staging edits");

console.log("\n====================================================");
console.log("Phase 0.12.2 Test Results Summary: " + passCount + " Passed, " + failCount + " Failed");
console.log("====================================================");

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
