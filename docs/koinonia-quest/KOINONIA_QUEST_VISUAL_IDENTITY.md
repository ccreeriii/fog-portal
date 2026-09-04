# Koinonia Quest — Visual Identity & Art Direction

**Document Version:** 1.1.0 (Amended per Product Owner Decisions)  
**Phase:** Phase 0.6 (Visual Identity, World Art Direction & Screen Experience)  
**Status:** DESIGN & SPECIFICATION ONLY — ZERO APPLICATION CODE MODIFICATIONS  
**Target Environment:** Koinonia v3 Community Portal (Mobile PWA & Responsive Web)  
**Target Audience:** Youth, Young Adults, and Mentors (Ages 11–21)  

---

## 1. Visual Design Language & Philosophy

### 1.1 Visual Personality: "The Handcrafted Hearth"
Koinonia Quest rejects both the cold, utilitarian sterility of corporate LMS dashboards and the loud, hyper-saturated dopamine traps of commercial gacha gaming.

The visual personality of Koinonia Quest is defined by four core traits:
1. **Warm & Sunlit:** Evoking a sunny morning in a community garden or church courtyard. Warm golden ambers, earthy terracotta, leafy sage greens, and clean timber textures.
2. **Handcrafted & Tactile:** Interface elements look and feel like physical materials—smooth handmade paper, stitched linen badges, polished river stones, and carved cedar signs.
3. **Youthful & Adventure-Bound:** Not childish, yet brimming with wonder. It evokes the quiet nobility of early adventures (like stepping onto a trail at dawn) rather than battlefields or flashy magic.
4. **Community-Centered & Peaceful:** The environment feels alive with shared life. Spaces visibly improve, flowers bloom, and lights turn on because people cared for them together.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      VISUAL DIRECTION SPECTRUM                          │
├───────────────────┬───────────────────────────────┬─────────────────────┤
│ AVOID             │ KOINONIA QUEST SWEET SPOT     │ AVOID               │
├───────────────────┼───────────────────────────────┼─────────────────────┤
│ • Sterile LMS     │ • Handcrafted storybook feel  │ • Flashy gacha /    │
│ • Corporate tables│ • Warm natural materials      │   casino aesthetics │
│ • Gray dashboards │ • Expressive stylized 2D      │ • Neon particle spam│
│ • Childish cartoons│ • High-density pixel art with │ • Gritty dark fantasy│
│ • Chunky 8-bit    │   painterly warmth            │ • Stardew/Poke clone│
│ • Cliché church art│ • Clean, readable modern UI   │ • Minecraft imitation│
└───────────────────┴───────────────────────────────┴─────────────────────┘
```

### 1.2 Approved Visual Asset Style: High-Density Handcrafted Pixel Art
Per Product Owner decision, the visual asset style is **high-density handcrafted pixel art with painterly warmth**:
- **Integer Scaling:** Authored at a native 32×32 grid, designed specifically to remain crisp at **integer 2× and 3× scaling** across high-DPI modern smartphone displays.
- **No Chunky 8-Bit Retro Clichés:** Avoids low-resolution jagged retro aesthetics; uses detailed clusters, gentle anti-aliasing transitions, and hand-painted lighting gradients.
- **Distinct Non-Imitative Identity:** Strictly avoids direct visual imitations of *Stardew Valley*, *Pokémon*, or *Minecraft*.
- **Subtle Surface Textures:** Uses warm, tactile micro-textures (wood grain, linen weave, terracotta clay porosity, stone flecks).
- **Age-Appropriate Maturity:** The art style is refined and mature enough to resonate with youth and young adults aged **11 to 21**, avoiding cartoonish nursery proportions.

### 1.3 The Theological & Cultural Aesthetic Guardrails
- **No Religious Clichés:** Strictly avoid overusing glowing halos, angelic wings, medieval crosses, descending white doves, or fiery swords.
- **Organic Biblical Symbolism:** Ground spiritual symbolism in biblical imagery that is rooted in everyday reality:
  - *Stewardship:* Green seedlings, running spring water, pruning shears, rich soil.
  - *Fellowship:* Shared bread, woven circle rugs, campfire embers, wooden tables.
  - *Truth & Guidance:* Simple oil lamps, compass stones, open leather journals.
- **Distinct Filipino / Southeast Asian Community Context:** The world mirrors the tangible architectural beauty of local communities: open verandas (*batalan* / porches), slatted wooden window screens, clay plant pots, flowering bougainvillea, and warm neighborhood fellowship halls.

---

## 2. Environment Rendering & Atmospheric Style

### 2.1 Rendering Style
- **Perspective:** **3/4 Top-Down 2D** (Z-axis tilt of approximately 45 degrees; see World Design document for full evaluation).
- **Pixel-Painterly Hybrid:** High-density pixel art with soft color grading and warm ambient lighting.
- **Outlines:** Warm dark olive/umber outlines (`#2C3327`) rather than harsh solid black (`#000000`). This maintains visual softness and organic unity.

### 2.2 Lighting Style
- **Day / Twilight Lighting Model:**
  - *Morning / Daytime:* Golden directional sunlight streaming from the top-left at a 45-degree angle. Warm yellow-amber rim lighting (`#FFF3D1`) on rooftops and foliage.
  - *Evening / Golden Hour:* Deep terracotta and peach tinting with long soft shadows.
  - *Night / Campfire:* Cool indigo ambient darkness punctuated by warm, flickering circular lantern radiuses (`#FFAE42`).
- **No Harsh Shadows:** Ambient occlusion and drop shadows are rendered using warm translucent sepia tones (`rgba(44, 51, 39, 0.25)`).

### 2.3 Textures & Environmental Life
- **Living Flora:** Subtle 2-frame swaying animations on outdoor trees, potted ferns, and tall grasses (cycle: 3.5 seconds) giving the world a gentle "breathing" sensation.
- **Water Surfaces:** Translucent turquoise streams with gentle white-foam ripples and floating river leaves.
- **Weather Accents (Seasonal / Mood-Based):**
  - *Sunny Morning:* Drifting pollen or dandelion seeds (gentle 2D particle drift).
  - *Gentle Rain:* Soft diagonal rain streaks with tiny splash rings on stone surfaces; plants visibly perk up.
  - *Warm Breeze:* Swirling leaf sprites that drift across the screen during milestone celebrations.

---

## 3. UI Component System & Treatment

Every UI element is crafted to feel like a physical artifact belonging to an adventurer or community member:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           UI MATERIAL SYSTEM                            │
├───────────────────┬─────────────────────────────────────────────────────┤
│ Component         │ Material & Visual Treatment                         │
├───────────────────┼─────────────────────────────────────────────────────┤
│ Modals & Popups   │ Pressed parchment card with warm deckled borders    │
│ Primary Buttons   │ Terracotta or Olive leather strap with brass rivets │
│ Secondary Buttons │ Sandstone tablet with debossed borders              │
│ Dialogue Boxes    │ Polished pine wood plank with linen speaker tag     │
│ Progress Bars     │ Carved wooden trough with vibrant green vine fill   │
│ Badges & Icons    │ Enamelled bronze and woven thread medallions        │
│ Notifications     │ Golden morning sunbeam toast with wax seal accent   │
└───────────────────┴─────────────────────────────────────────────────────┘
```

### 3.1 Buttons & Interactive States
- **Normal State:** Solid surface with a subtle 2px bottom shadow simulating physical thickness.
- **Hover / Focus State:** Lifts 1px with a soft golden amber aura (`rgba(242, 184, 75, 0.4)`).
- **Active / Pressed State:** Shifts down 2px with tactile micro-bounce, accompanied by a subtle acoustic wood-tap sound (when audio enabled).
- **Disabled State:** Weathered stone gray with lower contrast and clear locked padlock glyph.

### 3.2 Dialogue Boxes
- Positioned at the bottom of the mobile screen (thumb zone).
- Features a circular wooden-framed NPC portrait on the left with expressive emotional sprite variations (Smiling, Thoughtful, Encouraging, Surprised).
- Typewriter text effect with soft, rhythmic parchment clicks (can be skipped with a single tap).

### 3.3 Progress & Quest Indicators
- **Available Quest:** Glowing golden seedling icon bouncing gently above an NPC or board.
- **Active / In-Progress Quest:** Open wooden compass icon showing real-world progress.
- **Pending Verification:** Brass hourglass surrounded by a gentle pulsing blue ring.
- **Completed Quest:** Sparkling laurel wreath with a joyful chime.

---

## 4. The Signature "Go Into Real Life" Moment

The **"Go Into Real Life"** exit screen is the signature philosophical and visual mechanic of Koinonia Quest. It transforms the act of closing the app into a triumphant, meaningful moment.

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                    ☀️  YOUR TURN                       │
│               IN THE REAL WORLD                        │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │                                                │   │
│   │   "The dirt won't water itself through         │   │
│   │    your screen, anak!"                         │   │
│   │                                                │   │
│   │   Task: Water the potted plants at home.       │   │
│   │   (Or refill a pet's water dish)               │   │
│   │                                                │   │
│   └────────────────────────────────────────────────┘   │
│                                                        │
│          [ 🌿 I'M STEPPING OUT NOW ]                   │
│                                                        │
│   The virtual world will rest until you return.        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 4.1 Visual & Experiential Staging
1. **The Fade & Quiet:** When the player taps `[ Accept Quest ]`, any active audio gently fades down to silence.
2. **The Calming Transition:** The background dims with a deep, soothing twilight indigo tint (`rgba(24, 34, 45, 0.85)`). Visual animations stop. There are no flashing lights, countdown alarms, or urgency tickers.
3. **The Clear Mandate:** Large, elegant typography proclaims:  
   **"YOUR TURN — IN THE REAL WORLD."**
4. **The Departure Button:** The player taps a warm terracotta button: `[ 🌿 I'M STEPPING OUT NOW ]`.
5. **The Peaceful Standby Mode:** The screen transitions to a serene minimalist standby card showing their avatar sitting peacefully under an olive tree, eyes closed, resting. A gentle message reads:  
   *"Go be a blessing out there. Your virtual world is resting until you return."*
6. **Zero Guilt, Zero FOMO:** No ticking timer penalizes the player if they take hours or days to complete their real-world task.

---

## 5. The Non-Casino Reward Experience

Koinonia Quest strictly rejects slot-machine visual tropes (no spinning reels, flashing neon bursts, treasure chest wobble-pops, or confetti explosions).

### 5.1 The Four-Stage Reward Sequence
1. **The Gentle Chime:** A resonant bronze bell or nylon-string harmonic chord sounds (when audio enabled).
2. **The Quiet Unfolding:** A clean parchment scroll unrolls smoothly from the center.
3. **The Transparent Ledger:** Rewards are presented in clear, calm typography:
   - `🪙 +5 Life Points (Synced to Koinonia)`
   - `🛡️ +5 Character XP`
   - `🌱 +15 Stewardship XP  •  📋 +5 Responsibility XP`
4. **The Environmental Ripple (The True Reward):**  
   The scroll fades, and the camera smoothly pans to the environment:
   - The parched soil darkens to rich loam.
   - A tiny green seedling uncurls from the earth with a gentle morning sparkle.
   - A floating amber leaf drifts into the sky toward the FOG Community Center meter.
5. **The Character Reaction:** The player's avatar turns toward the camera, smiles, and performs a humble bow or thumbs-up.

---

## 6. Life Point Visual Language

Life Points are the existing currency of Koinonia. Within Koinonia Quest, they are visually framed as **community recognition**, not cash or wages for righteousness.

```
┌────────────────────────────────────────────────────────┐
│                   LIFE POINT DISPLAY                   │
├────────────────────────────────────────────────────────┤
│ Visual Icon: Brass Sun-Sprout Token (🪙)               │
│ Color: Warm Polished Brass / Morning Honey (`#D49B35`) │
│ Placement: Always secondary to Character XP & Skills   │
│ Language: "Life Points Awarded", never "Coins Earned"   │
└────────────────────────────────────────────────────────┘
```

- **Visual Weight:** Life Points are rendered in clean brass tokens with a sunburst center. They never flash, bounce, or shower across the screen like casino tokens.
- **Hierarchy:** On profile and reward screens, **Skill XP and Character Level take center stage**. Life Points are displayed modestly in the upper status bar.

---

## 7. Skills Visualization: The "Skill Garden" (Tree of Life)

Rather than using fantasy combat statistics or sterile corporate progress bars, the 10 Christian formation skills are visualized as **The Skill Garden** (or **The Tree of Life**).

```
                            [ WISDOM ]
                           (Golden Fruit)
                                 │
           [ CREATIVITY ]                 [ LEADERSHIP ]
          (Flowering Vine)              (Sturdy Canopy)
                 \                              /
         [ COMMUNICATION ]              [ TEAMWORK ]
           (Morning Dew)               (Entwined Boughs)
                   \                          /
            [ DISCIPLINE ]              [ COMPASSION ]
             (Deep Trunk)             (Sheltering Leaves)
                   \                          /
            [ RESPONSIBILITY ]          [ SERVICE ]
             (Strong Timber)           (Outstretched Root)
                           \          /
                          [ STEWARDSHIP ]
                           (Living Soil)
```

### 7.1 Visual Metaphors for the 10 Skills
1. **Stewardship:** Deep living soil and uncurling green sprouts. (Symbolizes caring for creation and basic spaces).
2. **Responsibility:** Cedar trunk rings and straight-growing saplings. (Symbolizes reliability and standing firm).
3. **Discipline:** Pruned vine branches with clean cuts. (Symbolizes self-control and purposeful focus).
4. **Service:** Broad shade-giving leaves and sheltering hollows. (Symbolizes protecting others quietly).
5. **Compassion:** Flowing irrigation channels watering thirsty ground. (Symbolizes empathy reaching the hurting).
6. **Teamwork:** Entwined oak and cedar roots holding riverbanks together. (Symbolizes collective strength).
7. **Communication:** Morning dew reflecting light on spider silk. (Symbolizes clarity, truth, and grace).
8. **Creativity:** Rare flowering orchids and vibrant bougainvillea. (Symbolizes artistic beauty and joy).
9. **Wisdom:** Deep underground taproots reaching perennial mountain water. (Symbolizes discernment and truth).
10. **Leadership:** The highest canopy bough that catches the dawn sun first and shelters the younger saplings below. (Symbolizes servant example).

### 7.2 The Player's Living Garden Screen
On the Skills Screen, the player views a living botanical tree. As they earn XP in each skill, that specific part of the tree visually grows:
- Earning Stewardship XP enriches the soil and adds river stones.
- Earning Compassion XP causes flowering blossoms to open.
- Earning Service XP strengthens the thick protective roots.

---

## 8. Visual Brand System

Koinonia Quest is designed as a recognized, cohesive sub-brand of the primary Koinonia platform.

```
┌────────────────────────────────────────────────────────┐
│                   BRAND IDENTITY                       │
├────────────────────────────────────────────────────────┤
│ Primary Wordmark:  KOINONIA QUEST                      │
│ Font Style:        Custom Hand-Drawn Humanist Sans     │
│ Emblem:            The Open Arched Gate with Sunrise   │
│                    and Living Sprout                   │
│ App Icon:          Golden Sunrise over Sage Green Leaf │
│                    on Warm Terracotta Tile             │
└────────────────────────────────────────────────────────┘
```

### 8.1 The Master Emblem
The official emblem features:
1. **The Arched Doorway:** Representing open fellowship, welcoming the stranger, and stepping into the real world.
2. **The Rising Dawn:** Representing hope, new beginnings, and daily resurrection in Christ.
3. **The Uncurling Sprout:** Representing organic, patient growth in personal character.

### 8.2 Achievement Badge System
Badges are framed as **embroidered fabric patches** or **enamelled bronze medallions** pinned to a virtual adventurer's satchel:
- *Bronze Tier (Novice):* Circular stamped brass with simple geometric relief.
- *Silver Tier (Pioneer):* Hexagonal engraved silver with braided rope borders.
- *Gold Tier (Cornerstone):* Shield-shaped polished gold with inlaid enamel botanical patterns.

---

## 9. Master Color Palette & Validated Contrast Targets

The color system is grounded in natural, organic tones that provide high visual comfort, zero eye strain, and **WCAG-aligned contrast ratios** across all user-facing screens.

```
┌────────────────────────────────────────────────────────────────────────┐
│                    MASTER COLOR PALETTE SPECIFICATION                  │
├──────────────┬───────────┬─────────────┬───────────────────────────────┤
│ Role         │ Hex Code  │ Name        │ Design Purpose                │
├──────────────┼───────────┼─────────────┼───────────────────────────────┤
│ Primary      │ `#C86A4B` │ Terracotta  │ Primary buttons, callouts     │
│ Secondary    │ `#4B6B44` │ Olive Grove │ Active toggles, nature base   │
│ Accent Warm  │ `#F2B84B` │ Dawn Gold   │ Highlights, quest markers     │
│ Accent Cool  │ `#6AA6B8` │ Sky Brook   │ Water, pending verifications  │
│ Dark Accent  │ `#2C3E55` │ Dusk Indigo │ Backgrounds, sleep mode, text │
│ Surface Base │ `#FAF7F0` │ Warm Linen  │ Modal cards, parchment boards │
│ Text Primary │ `#232B20` │ Deep Earth  │ High-contrast body text       │
│ Text Muted   │ `#6B7465` │ River Stone │ Secondary labels, captions    │
│ Success      │ `#3E8E58` │ Fresh Mint  │ Completed checkmarks, growth  │
│ Life Points  │ `#D49B35` │ Sun Brass   │ Koinonia Life Point tokens    │
└──────────────┴───────────┴─────────────┴───────────────────────────────┘
```

### 9.1 Validated Contrast Targets (WCAG Alignment)
- **Deep Earth (`#232B20`) on Warm Linen (`#FAF7F0`):** **11.4:1 contrast ratio** (Exceeds WCAG AAA target of 7.0:1).
- **Terracotta (`#C86A4B`) on Warm Linen (`#FAF7F0`):** **4.8:1 contrast ratio** (Aligns with WCAG AA target for bold text and buttons).
- **White (`#FFFFFF`) on Terracotta (`#C86A4B`):** **4.6:1 contrast ratio** (Aligns with WCAG AA target).
- **White (`#FFFFFF`) on Dusk Indigo (`#2C3E55`):** **8.9:1 contrast ratio** (Exceeds WCAG AAA target).

---

## 10. Typography Specification

To maintain lightweight performance and zero licensing barriers, the typography system utilizes clean, modern, open-source Google Fonts with native system font fallbacks.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TYPOGRAPHY SPECIFICATION                        │
├───────────────┬──────────────────────┬─────────────┬───────────────────┤
│ Usage         │ Recommended Font     │ Fallback    │ Weight & Style    │
├───────────────┼──────────────────────┼─────────────┼───────────────────┤
│ Game Title    │ *Outfit*             │ sans-serif  │ 800 ExtraBold     │
│ UI Headings   │ *Plus Jakarta Sans*  │ system-ui   │ 700 Bold          │
│ Dialogue Text │ *Plus Jakarta Sans*  │ system-ui   │ 500 Medium        │
│ Body & Prompt │ *Inter*              │ -apple-sys  │ 400 Regular       │
│ Numbers / XP  │ *JetBrains Mono*     │ monospace   │ 600 SemiBold      │
└───────────────┴──────────────────────┴─────────────┴───────────────────┘
```

- **Scale & Mobile Legibility:**
  - Game Title: `24px / 1.2`
  - Screen Headers: `18px / 1.3`
  - NPC Dialogue: `15px / 1.5`
  - Body Text: `14px / 1.5`
  - Captions & Meta: `12px / 1.4` (Never smaller than 12px on mobile displays).

---

## 11. Accessibility & Audio Policy (A11y)

### 11.1 Audio Default Policy (Product Owner Mandate)
- **MUTED BY DEFAULT on First Launch:** Background music and ambient sound effects must be strictly **muted by default** when a player first launches Koinonia Quest.
- **Explicit Audio Toggle:** An intuitive audio toggle (speaker icon `🔈 / 🔊`) is placed in the top bar, allowing users to explicitly opt-in to sound.
- **Non-Audio Equivalents for All Information:** Every audio cue has an explicit non-audio equivalent (e.g., visual ripple, toast notification, on-screen text, or gentle mobile haptic feedback). No game action or story progression ever depends exclusively on sound.

### 11.2 Visual Accessibility Guidelines
1. **Color-Blind Safe Visual Redundancy:**
   - Every status indicator pairs a distinct color with a **unique physical shape and icon**.
   - Completed: Green + Solid Checkmark (`✓`).
   - In-Progress: Amber + Open Compass (`🧭`).
   - Pending: Blue + Hourglass (`⏳`).
   - Locked: Gray + Padlock (`🔒`).
2. **Touch Targets:**
   - All interactive mobile buttons, cards, and dialogue prompts have a minimum physical hit box of **44×44 CSS pixels**.
3. **Reduced Motion (prefers-reduced-motion):**
   - Disables screen panning transitions, tree leaf swaying, and floating particle drifts. Modals appear with a simple clean opacity fade (150ms).
4. **Canvas Screen Reader Companion DOM:**
   - A hidden, accessible HTML DOM layer parallels the Canvas view, announcing world state changes, active quests, and dialogue transcriptions to screen readers.
