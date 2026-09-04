# Koinonia Quest — Avatar & NPC Visual Design

**Document Version:** 1.1.0 (Amended per Product Owner Decisions)  
**Phase:** Phase 0.6 (Visual Identity, World Art Direction & Screen Experience)  
**Status:** DESIGN & SPECIFICATION ONLY — ZERO APPLICATION CODE MODIFICATIONS  
**Target Engine:** Lightweight HTML5 2D Canvas (Phase 1 Approved Architecture)  
**Art Style:** High-Density Handcrafted Pixel Art with Painterly Warmth (1:3.5 Semi-Chibi Proportions)  

---

## 1. Avatar Customization System

### 1.1 Proportions & Age Suitability (Ages 11–21)
Traditional RPG avatars often swing between two extremes: hyper-chibi "toddler" sprites (head-to-body ratio 1:2), or hyper-realistic adult proportions (1:7). 

**Koinonia Quest establishes a balanced 1:3.5 proportion in high-density handcrafted pixel art:**
- **Height & Grid:** 48 pixels tall within a 32×48 pixel bounding box (1.5 vertical tiles in 3/4 perspective).
- **Integer Scaling:** Designed specifically to scale crisply at integer 2× and 3× factors on modern high-DPI smartphone displays.
- **Mature & Expressive:** Avoids chunky retro/8-bit jaggies; features detailed pixel clustering and soft lighting gradients suitable for youth and young adults aged **11 to 21**.
- **Body & Limbs:** Torso, arms, and legs have realistic posture and joints, allowing expressive walking, lifting, watering, and sweeping animations without appearing childish.

```
┌────────────────────────────────────────────────────────┐
│               AVATAR PROPORTION SCHEMATIC              │
├────────────────────────────────────────────────────────┤
│     [  HEAD: 14px  ]  --> Expressive eyes, eyebrows,   │
│                           distinct hairstyles          │
│     [ TORSO: 14px  ]  --> Hoodies, aprons, vests,      │
│                           backpack straps              │
│     [  LEGS: 20px  ]  --> Clean stride, denim, boots,  │
│                           shoes                        │
│     Total: 48px height on a 32px wide base             │
└────────────────────────────────────────────────────────┘
```

---

### 1.2 Customization Layers (Gender-Inclusive & Modest)
To prevent gender stereotyping and ensure modesty, all clothing and hair options are available to every player without rigid gender locks:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AVATAR CUSTOMIZATION LAYERS                     │
├───────────────────┬────────────────────────────────────────────────────┤
│ Customization Tier│ Options & Palette Choices                          │
├───────────────────┼────────────────────────────────────────────────────┤
│ 1. Skin Tones     │ 8 Natural Tones (Alabaster, Warm Sand, Honey,      │
│                   │ Olive, Golden Tan, Rich Chestnut, Espresso, Deep)  │
├───────────────────┼────────────────────────────────────────────────────┤
│ 2. Hairstyles     │ Short Neat, Curly Fade, Long Waves, Braids, Ponytail│
│                   │ Messy Bun, Side-Part, Natural Afro, Tapered Cut    │
├───────────────────┼────────────────────────────────────────────────────┤
│ 3. Hair Colors    │ Raven Black, Dark Brown, Chestnut, Auburn,         │
│                   │ Golden Honey, Silver Gray                          │
├───────────────────┼────────────────────────────────────────────────────┤
│ 4. Face & Eyes    │ Warm Smile, Gentle Contemplative, Bright Eager,    │
│                   │ Soft Almond Eyes, Round Sparkle Eyes               │
├───────────────────┼────────────────────────────────────────────────────┤
│ 5. Base Outfits   │ Casual Youth Hoodie, Linen Pilgrim Tunic, Denim    │
│                   │ Jacket over Tee, Modest Polo, School Uniform Vest  │
├───────────────────┼────────────────────────────────────────────────────┤
│ 6. Footwear       │ White Canvas Sneakers, Sturdy Trail Boots, Slip-on │
│                   │ Deck Shoes, Simple Leather Sandals                 │
├───────────────────┼────────────────────────────────────────────────────┤
│ 7. Headwear       │ Straw Sun Hat, Knit Beanie, Artist's Beret,        │
│                   │ Pilgrim's Headband, Student Visor                  │
├───────────────────┼────────────────────────────────────────────────────┤
│ 8. Accessories    │ Canvas Backpack, Leather Satchel, Wire Glasses,    │
│                   │ Acoustic Guitar Case, Potted Seedling Pocket       │
├───────────────────┼────────────────────────────────────────────────────┤
│ 9. Ministry Items │ Gardener's Denim Apron, Sound Tech Tool Belt,      │
│ (Earned)          │ Hospitality Welcoming Sash, Scribe's Journal Strap │
└───────────────────┴────────────────────────────────────────────────────┘
```

### 1.3 Minor Privacy Guardrails
- Custom avatar names default strictly to the player's **First Name and Last Initial** (e.g., *Gabriel M.*).
- No free-form text entry on avatar clothing, t-shirts, or banners to prevent personal contact leaks or inappropriate language.

---

## 2. Avatar Animation State Machine & Approved Phase 1 Emotes

To run smoothly on the lightweight HTML5 Canvas engine, the animation system uses an optimized **sprite frame economy**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                       AVATAR ANIMATION BUDGET                          │
├──────────────┬────────┬──────────────┬─────────────────────────────────┤
│ Animation    │ Frames │ Frame Timing │ Visual Personality              │
├──────────────┼────────┼──────────────┼─────────────────────────────────┤
│ Idle         │ 2      │ 800ms / loop │ Subtle chest breathing, eye blink│
│ Walk (4-Way) │ 4      │ 150ms / step │ Energetic bounce, natural swing │
│ Interact     │ 2      │ 250ms / pose │ Reaching forward, slight bend   │
│ Celebration  │ 4      │ 120ms / loop │ Joyful jump, fist pump, smile   │
│ Thinking     │ 2      │ 600ms / loop │ Hand on chin, thoughtful look   │
│ Teamwork     │ 3      │ 200ms / loop │ Carrying a shared crate or tool │
│ Emotes       │ 3      │ 180ms / loop │ Floating speech bubble glyph    │
└──────────────┴────────┴──────────────┴─────────────────────────────────┘
```

### 2.1 Approved Phase 1 Emote Library
Per Product Owner decision, player non-verbal expression in Phase 1 is strictly confined to the following **six approved emotes**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      APPROVED PHASE 1 EMOTES                           │
├────────────────────┬───────────────────────────────────────────────────┤
│ Emote Glyph        │ Meaning & Community Fellowship Purpose            │
├────────────────────┼───────────────────────────────────────────────────┤
│ 1. Wave (👋)       │ Welcoming greeting to peers and newcomers         │
│ 2. Heart (❤️)      │ Expressing genuine gratitude, love, and care      │
│ 3. Prayer /        │ Reverent gratitude, quiet devotion, amen          │
│    Gratitude (🙏)  │                                                   │
│ 4. Lightbulb (💡)  │ Shared insight, understanding, ideas              │
│ 5. Thumbs-Up (👍)  │ Affirming a teammate's service, task completed    │
│ 6. Sprout (🌱)     │ Celebrating growth, stewardship, and creation     │
└────────────────────┴───────────────────────────────────────────────────┘
```

> **CRITICAL POLICY DIRECTIVE:**  
> **No unrestricted text chat is implied by this approval.**  
> Unrestricted real-time player-to-player text messaging is strictly prohibited in Phase 1 to ensure complete minor safety and eliminate unmoderated communication channels.

---

## 3. Original NPC Visual Profiles

The eight NPCs are designed with distinct silhouettes, signature color palettes, and clear visual identifiers so players can recognize them instantly from a distance.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NPC SILHOUETTE GALLERY                          │
├───────────────┬────────────┬────────────────────┬──────────────────────┤
│ Name          │ Age / Role │ Signature Outfit   │ Key Visual Prop      │
├───────────────┼────────────┼────────────────────┼──────────────────────┤
│ Uncle Barnaby │ ~62 Elder  │ Denim Overalls     │ Tin Watering Can     │
│ Ate Joy       │ ~24 Coord  │ Yellow Cardigan    │ Golden Clipboard     │
│ Leo           │ ~13 Seeker │ Oversized Teal Hood│ Worn Sketchbook      │
│ Chloe         │ ~17 Musician Navy Blazer & Skirt│ Velvet Violin Case   │
│ Marcus        │ ~16 Leader │ Burgundy Warmup    │ Silver Whistle       │
│ Maya          │ ~15 Artist │ Splattered Smock   │ Wooden Palette       │
│ Sam           │ ~14 Tech   │ Multi-Pocket Vest  │ Headset & Cable Coil │
│ Kuya David    │ ~20 Mentor │ Flannel & Field Jkt│ Leather Work Gloves  │
└───────────────┴────────────┴────────────────────┴──────────────────────┘
```

---

### Detailed NPC Dossiers

#### 1. Uncle Barnaby (The Wise Elder & Community Mentor)
- **Approximate Age:** 62 years old.
- **Visual Silhouette:** Broad, slightly rounded grandfatherly frame with a warm, patient posture.
- **Clothing Style:** Sturdy denim work overalls over a faded cream linen shirt; rolled-up sleeves; worn leather gardening boots.
- **Key Visual Identifier:** A wide-brimmed straw sun hat with an olive band; gentle silver-streaked gray beard.
- **Body Language:** Hands resting comfortably on his watering can or tucked into overall pockets; slow, approving nod.
- **Color Family:** Warm Earth & Foliage (`#7B4E34` Teak, `#4B6B44` Olive, `#D49B35` Brass).
- **Animation Personality:** Slow, rhythmic, deliberate movements; leans down to inspect seedlings.
- **Visual Role in World:** Anchors the Home Garden and Community Garden plots; represents quiet faithfulness.

#### 2. Ate Joy (The Community Coordinator & Welcomer)
- **Approximate Age:** 24 years old.
- **Visual Silhouette:** Upright, lively, approachable posture; quick and energetic stride.
- **Clothing Style:** Sunny honey-yellow knit cardigan over a crisp white button-up; comfortable denim culottes; canvas espadrilles.
- **Key Visual Identifier:** A warm wooden clipboard holding colorful pastel task cards; hair tied in a neat high bun with a wooden hair stick.
- **Body Language:** Open arms, frequent friendly hand waves, tilt of the head when actively listening.
- **Color Family:** Morning Sunlight (`#F2B84B` Dawn Gold, `#FAF7F0` Linen, `#C86A4B` Terracotta).
- **Animation Personality:** Bouncy walk cycle; writes notes with a wooden pencil when idle.
- **Visual Role in World:** Stationed at the FOG Center Entrance Desk; the friendly face welcoming all pilgrims.

#### 3. Leo (The Shy Newcomer)
- **Approximate Age:** 13 years old.
- **Visual Silhouette:** Slim, slightly guarded posture; shoulders curved slightly forward in gentle shyness.
- **Clothing Style:** Oversized teal-blue pullover hoodie with the sleeves pulled down over his palms; dark gray relaxed trousers; worn white sneakers.
- **Key Visual Identifier:** A thick, frayed-edge hardcover sketchbook tucked securely under his left arm.
- **Body Language:** Hesitant look-up; scuffs his sneaker toe when greeted, but eyes light up when shown kindness.
- **Color Family:** Cool Mist & Slate (`#6AA6B8` Brook Cyan, `#4A5568` Slate, `#FAF7F0` White).
- **Animation Personality:** Steps backward before stepping forward; glances down at his sketchbook while idle.
- **Visual Role in World:** Found sitting near the quiet edges of the Youth Hall or under courtyard shade trees.

#### 4. Chloe (The High-Achieving Musician)
- **Approximate Age:** 17 years old.
- **Visual Silhouette:** Poised, immaculate posture; confident and articulate stride.
- **Clothing Style:** Tailored navy blue structured jacket over a lavender collared blouse; pleated dark skirt with tights; polished black loafers.
- **Key Visual Identifier:** A burgundy velvet violin case strapped diagonally across her back; small silver treble clef pin on her collar.
- **Body Language:** Arms crossed thoughtfully; sharp, attentive eyes; slight tilt of chin when setting high standards.
- **Color Family:** Deep Dawn Indigo & Twilight (`#2C3E55` Indigo, `#9F7AEA` Lavender, `#CBD5E0` Silver).
- **Animation Personality:** Rhythmic finger-tapping (as if counting beats) when standing idle.
- **Visual Role in World:** Stationed near the FOG Center piano and worship music rehearsal area.

#### 5. Marcus (The Charismatic Aspiring Leader)
- **Approximate Age:** 16 years old.
- **Visual Silhouette:** Broad-shouldered athletic build; naturally stands front and center with chest out.
- **Clothing Style:** Burgundy and white varsity-style track jacket; comfortable sports joggers; bright athletic court shoes.
- **Key Visual Identifier:** A silver referee whistle on a braided red lanyard around his neck; white athletic wrist sweatbands.
- **Body Language:** Hands firmly planted on his hips; broad, energetic grin; quick to give a vigorous high-five or fist pump.
- **Color Family:** Crimson & Terracotta (`#C53030` Crimson, `#C86A4B` Terracotta, `#FFFFFF` White).
- **Animation Personality:** Restless energy—jumps lightly on the balls of his feet; checks his stopwatch during idle pauses.
- **Visual Role in World:** Found in the Activity Area or coordinating the Sunday Chair Brigade.

#### 6. Maya (The Expressive Creative Artist)
- **Approximate Age:** 15 years old.
- **Visual Silhouette:** Light, breezy, imaginative stance; walks with an expressive, lilting stride.
- **Clothing Style:** Oversized denim painter's smock covered in colorful, dried watercolor paint smudges; striped cotton shirt; rolled-up khaki trousers.
- **Key Visual Identifier:** A classic forest-green felt beret angled over her curls; wooden paintbrush tucked behind her right ear.
- **Body Language:** Tilts head back to look at light filtering through leaves; frames compositions with her fingers.
- **Color Family:** Botanical Garden & Pigment (`#805AD5` Violet, `#D69E2E` Ochre, `#38A169` Forest).
- **Animation Personality:** Doodles in the air with her brush; pauses to examine flowers closely.
- **Visual Role in World:** Stationed near the Reflection Garden and Creative Studio bulletin boards.

#### 7. Sam (The Audio-Visual Tech Helper)
- **Approximate Age:** 14 years old.
- **Visual Silhouette:** Lean, purposeful, focused; always looking at equipment cables and connections.
- **Clothing Style:** Dark charcoal multi-pocket utility vest over a graphic tee; cargo shorts with heavy tool loops; rubber-soled work sneakers.
- **Key Visual Identifier:** Large black studio monitor headphones resting around his neck; a neat coil of black microphone cable looped at his belt.
- **Body Language:** Hands busy adjusting dials or coiling cables; nods with quiet, dependable confidence.
- **Color Family:** Hardware Charcoal & Signal (`#2D3748` Charcoal, `#319795` Teal, `#ECC94B` Signal Amber).
- **Animation Personality:** Checks cables; gives a swift "mic check" tap to a virtual microphone when interacted with.
- **Visual Role in World:** Stationed behind the FOG Center audio mixing console and media slide desk.

#### 8. Kuya David (The Grounded Big Brother & Mentor)
- **Approximate Age:** 20 years old.
- **Visual Silhouette:** Sturdy, tall, protective frame; comfortable and unshakeable grounded posture.
- **Clothing Style:** Heavy-knit olive field jacket worn open over a warm flannel shirt; durable work jeans; rugged leather work boots.
- **Key Visual Identifier:** Worn leather work gloves tucked into his jacket pocket; wooden cross pendant carved from olive wood.
- **Body Language:** Warm, gentle eye contact; places a reassuring hand on younger peers' shoulders; stands near doorway entrances.
- **Color Family:** Forest & Timber (`#276749` Deep Forest, `#744210` Cedar, `#D69E2E` Brass).
- **Animation Personality:** Crosses arms warmly; chuckles with a deep shoulder shake.
- **Visual Role in World:** Co-leads Quest Circles and serves as bridge mentor between youth and senior pastors.
