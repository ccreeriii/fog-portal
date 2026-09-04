# Koinonia Quest — Screen Mockups & UI Layout Specifications

**Document Version:** 1.1.0 (Amended per Product Owner Decisions)  
**Phase:** Phase 0.6 (Visual Identity, World Art Direction & Screen Experience)  
**Status:** DESIGN & SPECIFICATION ONLY — ZERO APPLICATION CODE MODIFICATIONS  
**Target Viewport (Mobile):** 360px – 430px (Primary Design Target)  
**Target Viewport (Desktop/Tablet):** 1024px – 1440px (Responsive Multi-Pane Studio Layout)  
**Aesthetic:** Warm Storybook RPG (Handcrafted Parchment, Wood Planks, Brass Accents)  

---

## 1. Responsive Architecture: Desktop Multi-Pane Studio Layout

Per Product Owner approval, desktop and tablet viewports utilize an expansive **Responsive Multi-Pane Studio Layout** with the following structural rules:
1. **Dominant 2D Game Canvas:** The interactive 2D Canvas world remains the **primary visual center** (occupying 60%–75% of screen width).
2. **Collapsible Secondary Side Panels:** The companion side panels (Left Profile Companion and Right Pilgrim's Ledger) are strictly secondary and can be collapsed via quick toggle buttons (`[◀]` and `[▶]`) to grant maximum space to the world map.
3. **Mobile Remains Primary Target:** Every layout decision, touch target, and visual hierarchy is optimized primarily for 360–430px mobile screens first.

```
┌────────────────────────────────────────────────────────────────────────┐
│            APPROVED RESPONSIVE MULTI-PANE STUDIO LAYOUT (>= 1024px)    │
├──────────────┬──────────────────────────────────────────┬──────────────┤
│ LEFT PANEL   │           DOMINANT 2D GAME CANVAS        │ RIGHT PANEL  │
│ [◀ Collapse] │           (Primary Visual Center)        │ [Collapse ▶] │
│ (240px)      │           (Dynamic Flex Viewport)        │ (300px)      │
├──────────────┼──────────────────────────────────────────┼──────────────┤
│ 👤 Gabriel M.│  ┌────────────────────────────────────┐  │ 📜 ACTIVE    │
│ Lv. 3 Helper │  │                                    │  │    QUESTS    │
│ 🪙 340 LP    │  │                                    │  │ • Q-001      │
│ [🔈 Muted]   │  │   [ 2D TILEMAP RENDERING PASS ]    │  │   Steward    │
│              │  │   Home / Garden / FOG Center       │  │   of Garden  │
│ 🌿 10 Skills │  │                                    │  │   (+5 LP)    │
│ Radar Matrix │  │                                    │  │              │
│              │  │                                    │  │ ✍️ REFLECTION│
│ 🤝 Berean    │  │                                    │  │   JOURNAL    │
│ Circle       │  └────────────────────────────────────┘  │              │
│ (6 Youth)    │  [ WASD / Arrow Keys or Click to Move ]  │ 🤝 COMM. POOL│
└──────────────┴──────────────────────────────────────────┴──────────────┘
```

---

## 2. Comprehensive Mobile Wireframe Mockups (360–430px)

---

### Screen 01: Title & Atmospheric Splash Screen (Audio Muted by Default)

```
┌────────────────────────────────────────┐
│ [🔋 98%]                      10:00 AM │
├────────────────────────────────────────┤
│ [🔈 Audio: Muted (Tap to unmute)]      │
│                                        │
│                 ☀️                     │
│               / | \                    │
│            ┌─────────┐                 │
│            │  /   \  │                 │
│            │ |  🌱 | │                 │
│            └─────────┘                 │
│                                        │
│           KOINONIA QUEST               │
│     "A virtual world that grows        │
│      when you grow in real life."      │
│                                        │
│                                        │
│   ┌────────────────────────────────┐   │
│   │ [ 🌿 ENTER THE ADVENTURE ]     │   │
│   └────────────────────────────────┘   │
│                                        │
│     Fellowship of God Youth Ministry   │
│      Authenticated as: Gabriel M.      │
│                                        │
└────────────────────────────────────────┘
```

---

### Screen 02: Koinonia Quest Home (Personal Veranda)

```
┌────────────────────────────────────────┐
│ [≡] KOINONIA QUEST      [🔈]   [🔔 1]  │
├────────────────────────────────────────┤
│ 👤 Gabriel M.     ⭐ Lv. 3 Helper      │
│ [==================       ] 285/390 XP │
│ 🪙 340 Life Points  🌿 Garden: Stage 2 │
├────────────────────────────────────────┤
│                                        │
│      ┌───────────────────────────┐     │
│      │                           │     │
│      │    [AVATAR IN GARDEN]     │     │
│      │    Uncle Barnaby waving   │     │
│      │    🌱 Green Sprout Bed    │     │
│      │    🚪 Garden Gate [Open]  │     │
│      │                           │     │
│      └───────────────────────────┘     │
│                                        │
│  [ Emotes: 👋 ❤️ 🙏 💡 👍 🌱 ]        │
│  [ Tap anywhere on ground to walk ]    │
├────────────────────────────────────────┤
│ 📜 CALLING FOR TODAY                   │
│ ┌────────────────────────────────────┐ │
│ │ 🌱 Steward of the Garden    [READY]│ │
│ │ +5 LP • +15 Stewardship XP         │ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ [🏠 Home] [📜 Quests] [🤝 Circle] [👤] │
└────────────────────────────────────────┘
```

---

### Screen 03: Continue Adventure / World Map

```
┌────────────────────────────────────────┐
│ [< Back]             MAP OF FELLOWSHIP │
├────────────────────────────────────────┤
│                                        │
│                 ⛪                     │
│         [ 2. FOG COMMUNITY ]           │
│           (Center Plaza)               │
│                 ▲                      │
│                 │ (Unlocked)           │
│                 │ Country Path         │
│                 ▼                      │
│         [ 1. MY HOME ]                 │
│           (Veranda & Garden)           │
│                 ░                      │
│                 ░ (Future Expansion)   │
│                 ▼                      │
│         [ 3. RIVERSIDE PARK ]          │
│                                        │
├────────────────────────────────────────┤
│ SELECT YOUR DESTINATION:               │
│ ┌────────────────────────────────────┐ │
│ │ [🏠 VISIT MY HOME]                 │ │
│ ├────────────────────────────────────┤ │
│ │ [⛪ TRAVEL TO FOG CENTER]           │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

---

### Screen 04: Avatar Workshop (Customizer)

```
┌────────────────────────────────────────┐
│ [< Back]        AVATAR WORKSHOP        │
├────────────────────────────────────────┤
│                                        │
│               O                        │
│              /|\   [AVATAR PREVIEW]    │
│              / \                       │
│                                        │
│   "Novice Pilgrim" • Level 3           │
├────────────────────────────────────────┤
│ [Skin]   [Hair]   [Outfit]   [Prop]    │
├────────────────────────────────────────┤
│ SELECT HAIRSTYLE:                      │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │Short │ │Waves │ │Braid │ │Curls*│    │
│ └──────┘ └──────┘ └──────┘ └──────┘    │
│                                        │
│ COLOR PALETTE:                         │
│ [⚫ Raven]  [🟤 Chestnut]  [🟡 Honey]   │
│                                        │
│ EQUIPPED OUTFIT:                       │
│ • Gardener's Denim Apron               │
│ • Straw Sun Hat                        │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ [ SAVE PILGRIM APPEARANCE ]        │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

---

### Screen 05: The Notice Board (Quest Board)

```
┌────────────────────────────────────────┐
│ [< Back]      FOG MAIN QUEST BOARD     │
├────────────────────────────────────────┤
│ [All (5)] [Home] [Church] [Team] [Daily│
├────────────────────────────────────────┤
│ AVAILABLE CALLINGS:                    │
│ ┌────────────────────────────────────┐ │
│ │ 🌱 Q-001: Steward of the Garden    │ │
│ │ Category: Home • Mode: TRUST       │ │
│ │ +5 LP • +15 Stewardship XP         │ │
│ │ [ ACCEPT CALLING ]                 │ │
│ ├────────────────────────────────────┤ │
│ │ 🧹 Q-017: The Chair Brigade        │ │
│ │ Category: Service • Mode: LEADER   │ │
│ │ +15 LP • +25 Service XP            │ │
│ │ [ ACCEPT CALLING ]                 │ │
│ ├────────────────────────────────────┤ │
│ │ 🍽️ Q-002: Feast Prep Assistant     │ │
│ │ Category: Home • Mode: FAMILY      │ │
│ │ +8 LP • +15 Service XP             │ │
│ │ [ ACCEPT CALLING ]                 │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

---

### Screen 06: Quest Detail Screen (Tactile Scroll)

```
┌────────────────────────────────────────┐
│ [< Back]                  QUEST SCROLL │
├────────────────────────────────────────┤
│ 📜 QUEST #001: STEWARD OF THE GARDEN   │
│ Category: Home Stewardship             │
│ Time Needed: 5–10 Minutes              │
├────────────────────────────────────────┤
│ 📖 WORDS OF UNCLE BARNABY:             │
│ "Real stewardship begins with small,   │
│ quiet things that cannot say 'thank    │
│ you' back—like the plants outside."    │
├────────────────────────────────────────┤
│ 🏃 YOUR REAL-WORLD ASSIGNMENT:         │
│ Put down your phone. Water the potted  │
│ plants or garden greenery at home.     │
│                                        │
│ Fallback (If No Plants):               │
│ Refill a household pet's water dish or │
│ wipe down a shared family dining table.│
├────────────────────────────────────────┤
│ 🎁 REWARDS UPON COMPLETION:            │
│ • 🪙 +5 Koinonia Life Points           │
│ • 🛡️ +5 Character XP                   │
│ • 🌱 +15 Stewardship XP • +5 Resp. XP  │
│ • 🤝 +15 to Shared Community Garden    │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ [ 🌿 ACCEPT & STEP INTO REALITY ]  │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

---

### Screen 07: The Signature "Go Into Real Life" Screen

```
┌────────────────────────────────────────┐
│                                        │
│                    ☀️                  │
│                YOUR TURN               │
│            IN THE REAL WORLD           │
│                                        │
│   ┌────────────────────────────────┐   │
│   │                                │   │
│   │   "The dirt won't water itself │   │
│   │    through your phone screen,  │   │
│   │    anak!"                      │   │
│   │                                │   │
│   │   Mission:                     │   │
│   │   Water the potted plants.     │   │
│   │   (Or refill a pet's water)    │   │
│   │                                │   │
│   └────────────────────────────────┘   │
│                                        │
│   ┌────────────────────────────────┐   │
│   │ [ 🌿 I'M STEPPING OUT NOW ]    │   │
│   └────────────────────────────────┘   │
│                                        │
│     Your virtual world is resting.     │
│      Come back when you're done!       │
│                                        │
└────────────────────────────────────────┘
```

---

### Screen 08: Quest Submission Screen

```
┌────────────────────────────────────────┐
│ [< Back]             SUBMIT COMPLETION │
├────────────────────────────────────────┤
│ QUEST #001: STEWARD OF THE GARDEN      │
├────────────────────────────────────────┤
│ 1. HOW DID YOU COMPLETE THIS?          │
│ (•) Self-Certification (TRUST)         │
│     "I certify on my honor as a pilgrim│
│      that I completed this action."    │
│                                        │
│ ( ) Parent Confirmation (FAMILY)       │
│     Hand phone to parent/guardian.     │
├────────────────────────────────────────┤
│ 2. REFLECTION JOURNAL:                 │
│ Prompt: How did it feel to care for    │
│ something living or your home today?   │
│ ┌────────────────────────────────────┐ │
│ │ Watered the potted ferns on our    │ │
│ │ front veranda. It felt peaceful to │ │
│ │ step away from screens.            │ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ [ COMPLETE QUEST & RECEIVE REWARD ]│ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

---

### Screen 09: Parent / Guardian Confirmation Modal (Phase 1)

```
┌────────────────────────────────────────┐
│                                        │
│       👨‍👩‍👦 FAMILY CONFIRMATION          │
│                                        │
│   Please hand this phone to your       │
│   parent or guardian.                  │
│                                        │
│   ┌────────────────────────────────┐   │
│   │ Quest: Steward of the Garden   │   │
│   │ Youth: Gabriel M.              │   │
│   │ Action: Watered plants / tidied│   │
│   └────────────────────────────────┘   │
│                                        │
│   "As a parent/guardian, I confirm     │
│    that Gabriel completed this home    │
│    stewardship chore."                 │
│                                        │
│   ┌────────────────────────────────┐   │
│   │ [ ✓ CONFIRM AS PARENT/GUARDIAN]│   │
│   └────────────────────────────────┘   │
│                                        │
│   [ Return to Self-Verification ]      │
│                                        │
└────────────────────────────────────────┘
```

---

### Screen 10: The Non-Casino Reward Screen

```
┌────────────────────────────────────────┐
│                                        │
│           ✨ QUEST COMPLETE! ✨         │
│                                        │
│         "Steward of the Garden"        │
│                                        │
│   🪙 +5 KOINONIA LIFE POINTS           │
│   🛡️ +5 CHARACTER XP                   │
│   🌱 +15 STEWARDSHIP XP                │
│   📋 +5 RESPONSIBILITY XP              │
│                                        │
│   ──────────────────────────────────   │
│                                        │
│   🤝 COMMUNITY GARDEN PROGRESS         │
│   [===================     ] 255/500   │
│   (+15 Stewardship contributed!)       │
│                                        │
│   ──────────────────────────────────   │
│                                        │
│          🎉 LEVEL UP! 🎉               │
│        You reached LEVEL 3!            │
│     New Title: "Faithful Helper"       │
│                                        │
│   ┌────────────────────────────────┐   │
│   │ [ CONTINUE THE JOURNEY ]       │   │
│   └────────────────────────────────┘   │
│                                        │
└────────────────────────────────────────┘
```

---

### Screen 11: The Skill Garden (Formation Skills)

```
┌────────────────────────────────────────┐
│ [< Back]             THE SKILL GARDEN  │
├────────────────────────────────────────┤
│                                        │
│                 [WISDOM]               │
│                 (Fruit)                │
│                 /      \               │
│       [CREATIVITY]    [LEADERSHIP]     │
│            \               /           │
│        [COMMUNICATION] [TEAMWORK]      │
│               \         /              │
│          [DISCIPLINE] [COMPASSION]     │
│                 \     /                │
│            [RESPONSIBILITY]            │
│                   |                    │
│             [STEWARDSHIP]              │
│             (Living Soil)              │
│                                        │
├────────────────────────────────────────┤
│ SKILL PROGRESSION MATRIX:              │
│ 🌱 Stewardship:    Lv. 2  [45/100 XP]  │
│ 📋 Responsibility: Lv. 2  [50/100 XP]  │
│ 🧹 Service:        Lv. 2  [60/100 XP]  │
│ 🛡️ Discipline:     Lv. 2  [40/100 XP]  │
│ 💡 Wisdom:         Lv. 1  [35/50 XP]   │
└────────────────────────────────────────┘
```

---

### Screen 12: Character Profile & Servant Leadership

```
┌────────────────────────────────────────┐
│ [< Back]            PILGRIM PROFILE    │
├────────────────────────────────────────┤
│ 👤 Gabriel M.     Member ID: FOG-42    │
│ Level 3: "Faithful Helper"             │
│ [========================     ] 73%    │
├────────────────────────────────────────┤
│ SERVANT LEADERSHIP PATH:               │
│                                        │
│ [Explorer]  -> Completed               │
│ [Contributor] -> Completed             │
│ [*Helper*]  -> CURRENT STAGE           │
│ [Team Steward] -> Eligible             │
│ [Apprentice Leader]*                   │
│ [Servant Leader]*                      │
│                                        │
│ *Higher stages require human mentor /  │
│  pastoral endorsement.                 │
├────────────────────────────────────────┤
│ [ EDIT AVATAR ]  [ VIEW BADGES (6) ]   │
└────────────────────────────────────────┘
```

---

### Screen 13: Life Points Balance & Ledger

```
┌────────────────────────────────────────┐
│ [< Back]          KOINONIA LIFE POINTS │
├────────────────────────────────────────┤
│          GLOBAL ACCOUNT BALANCE        │
│                 🪙 340                 │
│      "Controlled by Koinonia Core"     │
├────────────────────────────────────────┤
│ APPROVED REWARD TIERS:                 │
│ • Simple Task:       +3 to +5 LP       │
│ • Moderate Quest:    +5 to +10 LP      │
│ • Community Quest:  +10 to +15 LP      │
│ • Major Team/Event: +15 to +25 LP      │
├────────────────────────────────────────┤
│ RECENT QUEST TRANSACTIONS:             │
│ • +5 LP: Q-001 Steward of Garden (10am)│
│ • +15 LP: Q-017 Chair Brigade (Sun)    │
│ • +5 LP: Q-029 Evening Examen (Sat)    │
└────────────────────────────────────────┘
```

---

### Screen 14: Community Project: Community Garden

```
┌────────────────────────────────────────┐
│ [< Back]            COMMUNITY PROJECTS │
├────────────────────────────────────────┤
│ 🌿 PROJECT #001: COMMUNITY GARDEN      │
│ Status: STAGE 2 OF 5 (Prepared Soil)   │
│ Overall Completion: 48%                │
│ [====================         ]        │
├────────────────────────────────────────┤
│ COLLECTIVE REQUIREMENTS:               │
│ • 🌱 Stewardship: [240/500 XP] (48%)   │
│ • 🤝 Teamwork:    [150/300 XP] (50%)   │
│ • 🧹 Service:     [135/300 XP] (45%)   │
├────────────────────────────────────────┤
│ THE GARDEN MOSAIC:                     │
│ "We Built This Together"               │
│ 🍃 Gabriel M.  🍃 Chloe S.  🍃 Marcus T│
│ 🍃 Leo D.      🍃 Maya K.   🍃 Sam R.  │
├────────────────────────────────────────┤
│ [ INSPECT GARDEN IN VIRTUAL WORLD ]    │
└────────────────────────────────────────┘
```

---

### Screen 15: Quest Circle Page (Small Group Hub)

```
┌────────────────────────────────────────┐
│ [< Back]                 QUEST CIRCLES │
├────────────────────────────────────────┤
│ 🤝 BEREAN CIRCLE (6 / 8 Youth)         │
│ Created by: Kuya David (Youth Leader)  │
│ Cohort: Sunday Fellowship Group        │
│ [Linked to Small Group #3]             │
├────────────────────────────────────────┤
│ THIS WEEK'S CIRCLE GOAL:               │
│ 🎯 Fellowship Setup & Welcome          │
│ Progress: [==================== ] 80%  │
├────────────────────────────────────────┤
│ CIRCLE ROSTER & ROLES:                 │
│ • Kuya David  (Circle Leader)          │
│ • Gabriel M.  (Water Bearer Role)      │
│ • Marcus T.   (Chair Brigade Role)     │
│ • Chloe S.    (Music Steward Role)     │
│ • Leo D.      (Hospitality Welcomer)   │
│ • Maya K.     (Story Scribe Role)      │
├────────────────────────────────────────┤
│ EMOTES: [ 👋  ❤️  🙏  💡  👍  🌱 ]     │
│ (No unrestricted text chat)            │
└────────────────────────────────────────┘
```

---

### Screen 16: Achievements Gallery

```
┌────────────────────────────────────────┐
│ [< Back]          PILGRIM ACHIEVEMENTS │
├────────────────────────────────────────┤
│ BADGES UNLOCKED: 6 / 20                │
├────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │ 🌱   │ │ 🧹   │ │ 🛡️   │ │ 📖   │    │
│ │First │ │Helper│ │Digital│ │Quiet │    │
│ │Step  │ │Hand  │ │Sabbath│ │Time  │    │
│ └──────┘ └──────┘ └──────┘ └──────┘    │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │ 🔒   │ │ 🔒   │ │ 🔒   │ │ 🔒   │    │
│ │Chair │ │Peace-│ │Earth │ │Honor │    │
│ │Master│ │maker │ │Keeper│ │Parent│    │
│ └──────┘ └──────┘ └──────┘ └──────┘    │
├────────────────────────────────────────┤
│ SELECTED: 🌱 "First Step"              │
│ Awarded for completing Quest #001.     │
│ Unlocks Title: "Green Sprout", +5 LP   │
└────────────────────────────────────────┘
```

---

### Screen 17: Inventory & Wardrobe

```
┌────────────────────────────────────────┐
│ [< Back]            PILGRIM WARDROBE   │
├────────────────────────────────────────┤
│ [Outfits]   [Hats]   [Props]   [Rooms] │
├────────────────────────────────────────┤
│ OWNED COSMETICS:                       │
│ ┌────────────────────────────────────┐ │
│ │ 👒 Straw Sun Hat         [EQUIPPED]│ │
│ │ Earned from Stewardship quests     │ │
│ ├────────────────────────────────────┤ │
│ │ 🧣 Linen Pilgrim Scarf   [EQUIP]   │ │
│ │ Earned from 7-day devotion streak  │ │
│ ├────────────────────────────────────┤ │
│ │ 🛠️ Audio Tool Belt       [EQUIP]   │ │
│ │ Earned from Tech volunteering      │ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ ACTIVE TITLE:                          │
│ [ "Faithful Helper"              ▼ ]   │
└────────────────────────────────────────┘
```

---

### Screen 18: Reflection Journal (Private by Default)

```
┌────────────────────────────────────────┐
│ [< Back]            REFLECTION JOURNAL │
├────────────────────────────────────────┤
│ 🔒 PRIVATE TO YOU (Encrypted)          │
│ Policy: Private by Default             │
│ Status: Separate Safeguarding Review   │
├────────────────────────────────────────┤
│ 📅 TODAY, 10:30 AM                     │
│ Attached Quest: Q-001 Steward of Garden│
│ "Watered the potted ferns on our front │
│ veranda. Notice how dry the earth was. │
│ Taking care of things takes patience." │
├────────────────────────────────────────┤
│ 📅 YESTERDAY, 09:15 PM                 │
│ Attached Quest: Q-029 Evening Examen   │
│ "Saw God's grace when my friend apologized│
│ after school. Want to be less reactive │
│ with my brother tomorrow."             │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │ [ ✍️ WRITE NEW PRIVATE ENTRY ]     │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```
