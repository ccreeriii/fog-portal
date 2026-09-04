# Koinonia Quest — Quest #001 Visual Storyboard

**Document Version:** 1.1.0 (Amended per Product Owner Decisions)  
**Phase:** Phase 0.6 (Visual Identity, World Art Direction & Screen Experience)  
**Quest Title:** Quest #001 — Steward of the Garden  
**Primary Action:** Water potted plants at home (or equivalent household stewardship fallback)  
**Calibrated Rewards:** +5 Life Points, +5 Character XP, +15 Stewardship XP, +5 Responsibility XP  
**Art & Staging Format:** 16-Scene Sequential Storyboard with Camera, Audio, and UX Choreography  
**Audio Policy:** Background music is **MUTED BY DEFAULT** on first launch. Audio descriptions below activate only when explicitly unmuted by the user. All scenes feature full non-audio visual and haptic equivalents.  

---

## 1. Cinematographic & Direction Principles

- **Pacing:** Unhurried, contemplative, and warm. Avoid rapid jump cuts or jarring screen shakes.
- **Camera Philosophy:** The virtual camera is an affectionate, grounded observer (smooth ease-in-out panning, gentle 2.5D elevation tilts), targeting 60 FPS on typical supported mobile devices.
- **Soundscape (When Unmuted):** Soft morning ambient bird songs, distant church bells, nylon-string acoustic guitar swells, and tactile wooden clicks.
- **Non-Audio Redundancy:** Every audio cue has an on-screen visual ripple, toast notification, and subtle haptic vibration.
- **The "Fourth Wall" Moment:** When Uncle Barnaby commands the player to step away from their phone, the presentation shifts from virtual gameplay to calm, minimalist real-world focus.

---

## 2. The 16-Scene Sequential Storyboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      QUEST #001 STORYBOARD OVERVIEW                     │
├─────────────────┬─────────────────┬──────────────────┬──────────────────┤
│ ACT I: WAKING   │ ACT II: MEETING │ ACT III: MISSION │ ACT IV: GROWTH   │
│ Scenes 01 to 04 │ Scenes 05 to 07 │ Scenes 08 to 10  │ Scenes 11 to 16  │
└─────────────────┴─────────────────┴──────────────────┴──────────────────┘
```

---

### ACT I: AWAKENING & EXPLORATION (Scenes 01–04)

#### Scene 01: Awakening in the Bedroom
- **Visual Composition:** 
  Close camera framing centered on the player's avatar lying on the wooden platform bed. Soft morning sunlight streams through a high slatted window, casting angled amber dust-mote beams across the floor.
- **Action:** 
  The avatar rubs their eyes, sits up, and stands beside the bed. A subtle floating prompt: *"Tap anywhere to walk."*
- **Camera Framing:** 
  Tight 1.5× zoom on bedroom (centered).
- **Audio (If Unmuted):** 
  Gentle acoustic guitar arpeggio in D Major; soft chirp of morning sparrows. (Muted by default).
- **Visual Non-Audio Equivalent:** 
  Soft morning lightbeam pulse; floating text greeting.
- **Haptic:** 
  Single light haptic tap upon stepping out of bed.

#### Scene 02: Exploring the Personal Space
- **Visual Composition:** 
  The player taps to navigate across the bedroom. They pass the study desk (holding a Bible and open notebook) and the unmade sheets.
- **Action:** 
  A small sparkling interaction prompt appears above the doorway leading to the Living Area.
- **Camera Framing:** 
  Camera smoothly tracks the player avatar with soft horizontal damping (lerp: 0.08).
- **Audio (If Unmuted):** 
  Subtle wooden floorboard footstep sound.

#### Scene 03: The Open Veranda
- **Visual Composition:** 
  The avatar walks through the living room and steps onto the open-air wooden veranda (*batalan*). The lighting transitions from warm indoor lamplight to bright morning sunshine.
- **Action:** 
  Through the slatted railing, a dry outdoor garden plot is visible. Clay pots with drooping, thirsty ferns sit on the deck.
- **Camera Framing:** 
  Camera pulls back to a wider 1.0× establishing view showing the garden gate and fencing.
- **Audio (If Unmuted):** 
  Gentle gust of morning wind rustling dry leaves.

#### Scene 04: The Elder by the Gate
- **Visual Composition:** 
  Standing beside a weathered wooden fence gate is **Uncle Barnaby**, wearing his signature straw sun hat and denim overalls. He is gently touching a parched fern leaf.
- **Action:** 
  Uncle Barnaby turns his head, notices the player's avatar, and offers a warm, two-hand wave. A golden speech bubble (`💬`) pulses gently above his head.
- **Camera Framing:** 
  Medium two-shot framing Uncle Barnaby and the approaching avatar.
- **Audio (If Unmuted):** 
  Warm acoustic bass note accompanying Uncle Barnaby's greeting gesture.

---

### ACT II: THE CALLING & THE REVELATION (Scenes 05–07)

#### Scene 05: The Conversation
- **Visual Composition:** 
  A polished pine wood dialogue box slides up from the bottom of the screen. A hand-painted circular portrait of Uncle Barnaby smiling appears on the left.
- **Dialogue:**
  > **Uncle Barnaby:**  
  > "Peace be with you, anak! Look at our garden patch here. The sun has been bright today, and the soil is looking quite dry.  
  > Real stewardship doesn't start with grand speeches; it begins with small, quiet things that cannot say 'thank you' back—like the plants right outside your window."
- **Camera Framing:** 
  Slight zoom-in on the dialogue interaction (1.2×).
- **Audio (If Unmuted):** 
  Soft rhythmic typewriter parchment clicks for dialogue text; skips on tap.

#### Scene 06: The Quest Scroll Reveal
- **Visual Composition:** 
  The dialogue box transitions smoothly into an unrolling deckled parchment scroll:  
  `QUEST #001: STEWARD OF THE GARDEN`.
- **Details Displayed:** 
  Real-world task, +5 Life Points, +5 Character XP, +15 Stewardship XP, +5 Responsibility XP, and +15 to the shared Community Garden project.
- **Camera Framing:** 
  Modal card centered on screen; background world softly blurs (`backdrop-filter: blur(4px)`).
- **Audio (If Unmuted):** 
  Subtle parchment unrolling sound followed by a soft chime.

#### Scene 07: The Real-World Revelation
- **Visual Composition:** 
  Uncle Barnaby's portrait reappears with an affectionate, conspiratorial smile.
- **Dialogue:**
  > **Uncle Barnaby:**  
  > "Now don't just stare at your screen! The water won't pour itself through glass, anak. Put down your phone, step out into your home, and give real plants real water. If you don't have plants, care for your pet's bowl or wipe down your shared table. I'll wait right here."
- **Camera Framing:** 
  Full screen focus on the glowing green button: `[ ACCEPT & STEP INTO REALITY ]`.
- **Audio (If Unmuted):** 
  Low, resonant guitar tone signifying intentional departure.

---

### ACT III: STEPPING INTO REALITY (Scenes 08–10)

#### Scene 08: The Signature "Go Into Real Life" Screen
- **Visual Composition:** 
  The vibrant game world gently fades into a calming, deep twilight indigo background (`#18222D`). All background animations stop.
- **Interface Elements:**
  - Golden dawn sun emblem at top center.
  - Bold, dignified typography: **"YOUR TURN — IN THE REAL WORLD."**
  - Minimalist mission reminder card: *"Water the plants at home (or equivalent household care)."*
  - Warm terracotta button: `[ 🌿 I'M STEPPING OUT NOW ]`.
- **Action:** 
  When tapped, the screen transitions to a peaceful standby mode showing the avatar resting quietly under an olive tree with eyes closed. Text reads: *"Your virtual world is resting. Go be a blessing out there."*
- **Audio:** 
  Complete silence. Zero distracting background music.
- **Haptic:** 
  Gentle, calming double-pulse vibration.

#### Scene 09: The Real-World Action & Return
- **Real-World Experience:** 
  The player sets down their phone. They walk to their real kitchen, fill a watering can or cup, and water their home's potted plants (or care for their pet/table).
- **Return Action:** 
  Player re-opens the app. The standby card gently dissolves back into the warm afternoon light of the veranda.
- **Interface:** 
  A prompt appears: `[ I Completed This in Real Life ]`.

#### Scene 10: Submission & Verification Selection
- **Visual Composition:** 
  A clean parchment submission modal appears.
- **Interactive Choices:**
  - `(•) Self-Certification (TRUST): "I certify on my word of honor."`
  - `( ) Parent Confirmation (FAMILY): Hand phone to parent to tap single confirmation.`
- **Reflection Box:** 
  Player types one or two heartfelt sentences: *"Watered the veranda ferns. The soil drank it right up."*
- **Action:** 
  Player taps `[ COMPLETE QUEST & RECEIVE REWARDS ]`.

---

### ACT IV: CELEBRATION & WORLD TRANSFORMATION (Scenes 11–16)

#### Scene 11: The Non-Casino Reward Fanfare
- **Visual Composition:** 
  A clean golden banner drops down:  
  **✨ QUEST COMPLETE: STEWARD OF THE GARDEN! ✨**
- **Reward Badges Animate:**
  - `🪙 +5 Life Points (Synced to Koinonia Core)`
  - `🛡️ +5 Character XP (Level 1 Progress)`
  - `🌱 +15 Stewardship XP  •  📋 +5 Responsibility XP`
- **Audio (If Unmuted):** 
  A joyful acoustic guitar flourish and hand-bell chime (pure acoustic instruments, zero digital casino chimes).
- **Visual Non-Audio Equivalent:** 
  Expanding golden sunburst ripple on screen.
- **Haptic:** 
  Satisfying crisp single celebration haptic pulse.

#### Scene 12: The Soil Transformation (Real-World Impact Visible)
- **Visual Composition:** 
  The camera smoothly pans down from the UI directly to the player's virtual garden bed.
- **Environmental Animation:** 
  The cracked, dusty brown dirt tiles smoothly cross-fade (400ms) into dark, moist, fertile loam. Water droplets sparkle on the ground.
- **Audio (If Unmuted):** 
  Soft sound of soaking earth and gentle trickling water.

#### Scene 13: The Green Seedling Sprouts
- **Visual Composition:** 
  At the center of the dark soil, a tiny bright green seedling uncurls from the earth in a 4-frame blooming animation (240ms).
- **Visual Flare:** 
  A brief, delicate golden sparkle ring floats upward from the leaves and dissolves into the morning air.
- **Audio (If Unmuted):** 
  Light glockenspiel note (C6).

#### Scene 14: The Community Contribution Toast
- **Visual Composition:** 
  A glowing amber leaf floats upward from the seedling toward the top of the screen.
- **Toast Notification:** 
  A warm sunlit notification pill slides in from the top:  
  `🤝 +15 Stewardship contributed to FOG Community Garden! Total: 15/500`.
- **Psychological Message:** 
  The player immediately understands: *"My private chore at home helped our whole youth community."*

#### Scene 15: The Garden Gate Unlocks
- **Visual Composition:** 
  The camera pans 3 tiles north to the wooden perimeter gate.
- **Animation:** 
  The heavy wooden latch lifts smoothly with a satisfying *click*. The gate swings wide open on iron hinges, revealing a stone-lined country road winding through sunny hills toward church spires in the distance.
- **Uncle Barnaby Dialogue:** 
  *"Look at that soil breathe! You've taken your first step as a true steward. The path to the FOG Community Center is now open!"*
- **Audio (If Unmuted):** 
  Tactile wooden gate-creak and iron latch sound.

#### Scene 16: The Journey Unfolds
- **Visual Composition:** 
  The avatar turns toward the open gate, arms raised in a cheerful stretch.
- **Final UI Prompt:** 
  A floating golden wooden directional sign appears:  
  `[ ⛪ TRAVEL TO FOG COMMUNITY CENTER ]`.
- **Audio (If Unmuted):** 
  Full acoustic theme resumes with warm cello and uplifting nylon-string rhythm.
- **Result:** 
  The player has transitioned seamlessly from a domestic chore at home to being an active, connected pilgrim in the broader community.
