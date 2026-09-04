# Koinonia Quest — UX Flow & UI Specification

**Document Version:** 1.1.0 (Amended per Product Owner Decisions)  
**Phase:** Phase 0.5 (Game Design & Technical Specification)  
**Status:** DRAFT UX/UI SPECIFICATION ONLY — ZERO RUNTIME CODE MODIFICATIONS  
**Target Platform:** Mobile-First Responsive PWA (iOS Safari & Android Chrome)  
**Design Aesthetic:** Tactile Life-Simulation RPG (Cozy, Warm, Paper & Wood Textures, Gentle Haptics)  

---

## 1. UX Philosophy & Design Language

### 1.1 Anti-Corporate, Anti-LMS Aesthetic
Most modern educational or church platforms inadvertently adopt the visual language of enterprise corporate dashboards: cold gray tables, sterile progress bars, analytics cards, and notification bells that induce anxiety.

**Koinonia Quest decisively rejects the LMS (Learning Management System) aesthetic:**
- **Tactile & Natural Materials:** Warm parchment paper textures, weathered wood notice boards, woven cloth banners, and golden brass buttons.
- **Storybook Framing:** UI modals appear as journal notebooks, leather-bound quest scrolls, or wooden town placards rather than floating flat web divs.
- **Playful, Heartfelt Micro-Interactions:** Gentle bounce physics on button presses, soft leaf-flutter transitions, warm acoustic guitar chimes upon level-up.
- **Intentional Exit Ramps:** The UI celebrates when the player **closes the app** to engage the real world: *"Go shine out there! Your quest awaits in the real world."*

---

## 2. First-Time User Experience (FTUE): The 10–15 Minute Tutorial

Instead of forcing new players through a tedious software onboarding form or multi-page tutorial carousel, Koinonia Quest introduces mechanics naturally through an **interactive narrative prologue**.

```
[ Step 1: Entry from Koinonia Portal ]
                  │
                  ▼
[ Step 2: Atmospheric Welcome & Invitation ]
                  │
                  ▼
[ Step 3: Avatar Customization Workshop ]
                  │
                  ▼
[ Step 4: Awaken in Your Virtual Home ]
                  │
                  ▼
[ Step 5: Meet Uncle Barnaby by the Garden ]
                  │
                  ▼
[ Step 6: Learn Touch / Tap Movement & Interaction ]
                  │
                  ▼
[ Step 7: Inspect the Home Wooden Quest Board ]
                  │
                  ▼
[ Step 8: Receive Quest #001: Steward of the Garden (+5 LP) ]
                  │
                  ▼
[ Step 9: Real-World Revelation & Stewardship Fallback ]
                  │
                  ▼
[ Step 10: Real-World Action & Self / Parent Handover Submission ]
                  │
                  ▼
[ Step 11: Celebrate XP & Formation Skill Growth (+5 LP, +5 Char XP, +15 Stew, +5 Resp) ]
                  │
                  ▼
[ Step 12: Watch the Community Garden Sprout (Collective Impact) ]
                  │
                  ▼
[ Step 13: Learn How Life Points Feed into Koinonia ]
                  │
                  ▼
[ Step 14: The Garden Gate Opens → Journey to the FOG Center! ]
```

### 2.1 Detailed Prologue Walkthrough

#### Step 1: Entry from Koinonia
The player taps a vibrant, illustrated card on the Koinonia main dashboard:  
`[ 🌿 ENTER KOINONIA QUEST — A World That Grows With You ]`.  
A gentle transition dims the portal and displays a warm sunrise over the FOG community hills.

#### Step 2: The Warm Welcome
Text fades in over acoustic nylon strings:  
*"Welcome, pilgrim. This is not a world to escape into. It is a mirror of the world God placed you in. When you grow in kindness, service, and courage out there... this world will blossom in here."*

#### Step 3: The Avatar Dressing Room
The player customizes their in-game avatar:
- Skin tone, hairstyle, hair color.
- Starting outfit: *Novice Pilgrim's Tunic* or *Casual Youth Hoodie*.
- Initial accessory: *Gardener's Gloves* or *Scrip Satchel*.
- Name automatically defaults to their verified Koinonia first name (e.g., "Gabriel").

#### Step 4: Awaken in the Virtual Home
The screen fades in to a cozy 2D bedroom. Sunlight streams through a small window. A gentle speech bubble floats above an open door leading to the garden: *"Someone is calling from outside..."*

#### Step 5: Meet Uncle Barnaby
Tapping outside leads to the Home Garden. Standing near dry potted plants is **Uncle Barnaby**, wearing gardening overalls and holding a watering can. He greets the player by name with a friendly wave.

#### Step 6: Learning Movement & Touch
A floating guide prompts: *"Tap anywhere on the ground to walk. Tap the speech bubble to speak."* Moving the avatar feels responsive, smooth, and tactile.

#### Step 7: The Home Notice Board
Uncle Barnaby points to a small wooden signpost: *"We keep our family duties and daily tasks right here on the Notice Board. Take a look."*

#### Step 8: Receive Quest #001 ("Steward of the Garden")
The quest card opens smoothly like a scroll. It describes the dry potted plants and asks the player to water them.
- Rewards: **+5 Life Points**, **+5 Character XP**, **+15 Stewardship XP**, **+5 Responsibility XP**.

#### Step 9: The Real-World Revelation & Stewardship Fallback
Uncle Barnaby looks at the screen with a knowing smile:  
*"Now here's the secret of Koinonia Quest: You can't water these plants by tapping your phone screen! The real dirt is outside your window. Go into your kitchen or backyard, find real water, and care for real plants.*  
*If your home doesn't have plants, care for your household environment: refill a pet's water dish with clean water, or wipe down a shared family dining table. That is true stewardship too!"*

#### Step 10: Completing the Quest
A full-screen modal prompts: *"Put down your phone! Go care for something in your home."* The player returns 5 minutes later, taps `[ I Completed This in Real Life ]`, enters a 1-sentence reflection, and confirms via:
- `Self-Certification (TRUST)`
- OR `Parent Handover (FAMILY)`: Simply passes device to parent to tap `[ Confirm as Parent/Guardian ]` (no PIN required).

#### Step 11: Reward Chimes & Level Progression
A golden fanfare sounds:  
`+5 Life Points | +5 Character XP | +15 Stewardship XP | +5 Responsibility XP`.  
The player's Character XP bar fills, reaching Level 1 completion.

#### Step 12: Collective Community Contribution
The camera pans: The dry soil in the player's garden turns dark and rich. A small green sprout bursts forth. A toast notification slides in: *"Your +15 Stewardship XP was deposited into the FOG Youth Community Garden Project! Total: 15/500."*

#### Step 13: The Life Points Connection
A dialogue box shows how the +5 Life Points immediately reflected on their global Koinonia account: *"Your faithful service here earns Life Points across the entire community portal!"*

#### Step 14: The Gate Unlocks
Uncle Barnaby unlatches the wooden garden gate: *"Well done, good and faithful steward. The path to the FOG Community Center is now unlocked. Ate Joy and your friends are waiting for you!"*

---

## 3. Screen-by-Screen UI Specifications & Wireframes

Below are ASCII mobile wireframes (designed for 390×844 viewport standards) for all 16 core views.

---

### Screen 1: Quest Home Screen / Hub

```
┌────────────────────────────────────────┐
│ [≡] KOINONIA QUEST             [🔔 2]  │
├────────────────────────────────────────┤
│ 👤 Gabriel M.     ⭐ Lv. 3 Helper      │
│ [==================       ] 285/390 XP │
│ 🪙 340 Life Points  🌿 Garden: Stage 2 │
├────────────────────────────────────────┤
│                                        │
│         [ 2D VIRTUAL WORLD VIEW ]      │
│                                        │
│      ┌───────────────────────────┐     │
│      │        (My Home)          │     │
│      │    [Avatar Standing]      │     │
│      │    🌱 Garden Patch        │     │
│      │    🚪 Gate to FOG Center  │     │
│      └───────────────────────────┘     │
│                                        │
│  [ Tap Screen to Move / Interact ]     │
├────────────────────────────────────────┤
│ 📜 TODAY'S CALLING                     │
│ ┌────────────────────────────────────┐ │
│ │ 🌿 Steward of the Garden    [READY]│ │
│ │ +5 LP • +15 Stewardship XP         │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ 🍽️ Feast Assistant         [ACTIVE]│ │
│ │ +8 LP • +15 Service XP             │ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ [🏠 Home] [📜 Quests] [🤝 Circle] [👤] │
└────────────────────────────────────────┘
```

---

### Screen 2: Avatar Profile & Customizer

```
┌────────────────────────────────────────┐
│ [< Back]        AVATAR WORKSHOP        │
├────────────────────────────────────────┤
│                                        │
│               O                        │
│              /|\   [Avatar Preview]    │
│              / \                       │
│                                        │
│   "Novice Pilgrim" • Level 3           │
├────────────────────────────────────────┤
│ [Skin]   [Hair]   [Outfit]   [Accessory│
├────────────────────────────────────────┤
│ Hair Style:                            │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │Short │ │Waves │ │Braid │ │Curls*│    │
│ └──────┘ └──────┘ └──────┘ └──────┘    │
│                                        │
│ Outfit Color Palette:                  │
│ [🟢 Olive]  [🟤 Earth]  [🔵 Indigo]     │
│                                        │
│ Current Equipped:                      │
│ • Outfit: Gardener's Denim Apron       │
│ • Headwear: Straw Sun Hat              │
│ • Hand: Wooden Watering Can            │
├────────────────────────────────────────┤
│ [ SAVE AVATAR ]                        │
└────────────────────────────────────────┘
```

---

### Screen 3: Character Level & XP Progression

```
┌────────────────────────────────────────┐
│ [< Back]      CHARACTER PROGRESSION    │
├────────────────────────────────────────┤
│               LEVEL 3                  │
│          "FAITHFUL HELPER"             │
│                                        │
│ [=========================    ] 73%    │
│        285 XP / 390 XP to Level 4      │
├────────────────────────────────────────┤
│ UNLOCKS AT NEXT LEVEL (Lv. 4):         │
│ 🔓 Unlock FOG Music Rehearsal Room     │
│ 🎨 New Outfit: Apprentice Musician Robe│
│ 📜 Access to Intermediate Circle Quests│
├────────────────────────────────────────┤
│ SERVANT LEADERSHIP PATH:               │
│ [Explorer]─►[Contributor]─►[*Helper*]  │
│ ─►[Team Steward]─►[Apprentice*]─►[Lead*│
│                                        │
│ *Apprentice & Servant Leader require   │
│ explicit Pastor / Mentor sign-off.     │
└────────────────────────────────────────┘
```

---

### Screen 4: Life Points Sync & Ledger View

```
┌────────────────────────────────────────┐
│ [< Back]      KOINONIA LIFE POINTS     │
├────────────────────────────────────────┤
│          TOTAL LIFE POINTS             │
│               🪙 340                   │
│   "Synced with Church Member Portal"   │
├────────────────────────────────────────┤
│ APPROVED REWARD TIERS:                 │
│ • Simple Tasks:       +3 to +5 LP      │
│ • Moderate Quests:    +5 to +10 LP     │
│ • Community/Service: +10 to +15 LP     │
│ • Major Team/Events: +15 to +25 LP     │
├────────────────────────────────────────┤
│ RECENT QUEST POINT AWARDS:             │
│ ┌────────────────────────────────────┐ │
│ │ +5 LP — Steward of the Garden      │ │
│ │ Today, 10:30 AM • Verified: Trust  │ │
│ ├────────────────────────────────────┤ │
│ │ +15 LP — Sunday Chair Brigade      │ │
│ │ Sep 01, 12:15 PM • Verified: Leader│ │
│ ├────────────────────────────────────┤ │
│ │ +5 LP — Evening Examen Reflection  │ │
│ │ Aug 31, 09:45 PM • Verified: Trust │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

---

### Screen 5: Skills Radar & Matrix (10 Life Skills)

```
┌────────────────────────────────────────┐
│ [< Back]       FORMATION SKILLS        │
├────────────────────────────────────────┤
│                                        │
│           Stewardship (45)             │
│             /         \                │
│    Service(60)       Responsibility(50)│
│       |                     |          │
│  Compassion(30)          Wisdom(35)    │
│       \                     /          │
│            Discipline(40)              │
│                                        │
│    [ Interactive 10-Skill Radar ]      │
├────────────────────────────────────────┤
│ 🌿 Stewardship:    Lv. 2  [45/100 XP]  │
│ 🤝 Teamwork:       Lv. 1  [20/50 XP]   │
│ 📋 Responsibility: Lv. 2  [50/100 XP]  │
│ 🧹 Service:        Lv. 2  [60/100 XP]  │
│ 💡 Wisdom:         Lv. 1  [35/50 XP]   │
│ 🛡️ Discipline:     Lv. 2  [40/100 XP]  │
│ ❤️ Compassion:     Lv. 1  [30/50 XP]   │
│ 🎨 Creativity:     Lv. 1  [15/50 XP]   │
│ 💬 Communication:  Lv. 1  [25/50 XP]   │
│ 👑 Leadership:     Lv. 1  [10/50 XP]   │
└────────────────────────────────────────┘
```

---

### Screen 6: Today's Quests & Filter Hub

```
┌────────────────────────────────────────┐
│ TODAY'S QUESTS                 [Filter]│
├────────────────────────────────────────┤
│ [All (4)] [Home] [Church] [Team] [Daily│
├────────────────────────────────────────┤
│ AVAILABLE NOW:                         │
│ ┌────────────────────────────────────┐ │
│ │ 🌱 Q-001: Steward of the Garden    │ │
│ │ Category: Home • Mode: TRUST       │ │
│ │ +5 LP • +15 Stewardship XP         │ │
│ │ [ ACCEPT QUEST ]                   │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ 🧹 Q-017: The Chair Brigade        │ │
│ │ Category: Service • Mode: LEADER   │ │
│ │ +15 LP • +25 Service XP            │ │
│ │ [ ACCEPT QUEST ]                   │ │
│ └────────────────────────────────────┘ │
│                                        │
│ IN PROGRESS:                           │
│ ┌────────────────────────────────────┐ │
│ │ 🍽️ Q-004: Hearth of Fellowship     │ │
│ │ Category: Home • Mode: FAMILY      │ │
│ │ Action: Wash family dinner dishes  │ │
│ │ [ SUBMIT COMPLETION ]              │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

---

### Screen 7: Quest Detail & Acceptance Screen

```
┌────────────────────────────────────────┐
│ [< Back]                 QUEST DETAIL  │
├────────────────────────────────────────┤
│ QUEST #001: STEWARD OF THE GARDEN      │
│ Category: Home / Stewardship           │
│ Difficulty: Simple (5–10 Mins)         │
├────────────────────────────────────────┤
│ 🏃 REAL-WORLD ASSIGNMENT:              │
│ Put down your phone. Water the potted  │
│ plants or garden greenery at home.     │
│                                        │
│ Fallback (If No Plants):               │
│ Refill a household pet's water dish or │
│ wipe down a shared dining table.       │
├────────────────────────────────────────┤
│ 🎁 REWARDS:                            │
│ • +5 Koinonia Life Points              │
│ • +5 Character XP                      │
│ • +15 Stewardship XP • +5 Resp. XP     │
│ • +15 to Shared Community Garden       │
├────────────────────────────────────────┤
│ [ ACCEPT THIS QUEST & STEP OUTDOORS ]  │
└────────────────────────────────────────┘
```

---

### Screen 8: Quest Submission Screen (Phase 1 Family Handover)

```
┌────────────────────────────────────────┐
│ [< Back]           SUBMIT COMPLETION   │
├────────────────────────────────────────┤
│ QUEST #001: STEWARD OF THE GARDEN      │
├────────────────────────────────────────┤
│ 1. HOW DID YOU COMPLETE THIS?          │
│ [•] Self-Certification (TRUST)         │
│     "I certify on my word of honor."   │
│                                        │
│ [ ] Family Handover (FAMILY)           │
│     ┌────────────────────────────────┐ │
│     │ Hand phone to Parent/Guardian: │ │
│     │ [ CONFIRM AS PARENT/GUARDIAN ] │ │
│     │ (No PIN required in Phase 1)   │ │
│     └────────────────────────────────┘ │
├────────────────────────────────────────┤
│ 2. YOUR REFLECTION JOURNAL:            │
│ ┌────────────────────────────────────┐ │
│ │ Watered the potted ferns on our    │ │
│ │ veranda. The soil drank it up fast.│ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ [ COMPLETE QUEST & RECEIVE REWARDS ]   │
└────────────────────────────────────────┘
```

---

### Screen 9: Verification Pending Status Card

```
┌────────────────────────────────────────┐
│ [< Back]         VERIFICATION PENDING  │
├────────────────────────────────────────┤
│                                        │
│               ⏳                       │
│     SUBMISSION UNDER REVIEW            │
│                                        │
│ Quest: Q-017 The Chair Brigade         │
│ Submitted: Today at 12:45 PM           │
│ Verification Mode: LEADER SIGN-OFF     │
├────────────────────────────────────────┤
│ STATUS:                                │
│ Waiting for Small Group Leader or      │
│ Youth Pastor confirmation.             │
│                                        │
│ Assigned Approver:                     │
│ Ate Joy (Community Coordinator)        │
├────────────────────────────────────────┤
│ [ RETURN TO QUEST HUB ]                │
└────────────────────────────────────────┘
```

---

### Screen 10: Reward & Level-Up Sequence Modal

```
┌────────────────────────────────────────┐
│                                        │
│           ✨ QUEST COMPLETE! ✨         │
│                                        │
│      "STEWARD OF THE GARDEN"           │
│                                        │
│             🪙 +5 LIFE POINTS          │
│             🛡️ +5 CHARACTER XP         │
│             🌱 +15 STEWARDSHIP XP      │
│             📋 +5 RESPONSIBILITY XP    │
│                                        │
│   🤝 COMMUNITY GARDEN PROGRESS: +15    │
│   [===================     ] 255/500   │
│                                        │
│ ────────────────────────────────────── │
│                                        │
│          🎉 LEVEL UP! 🎉               │
│        You reached LEVEL 3!            │
│     New Title: "Faithful Helper"       │
│                                        │
│ [ CONTINUE ADVENTURE ]                 │
└────────────────────────────────────────┘
```

---

### Screen 11: Community Project Screen

```
┌────────────────────────────────────────┐
│ [< Back]       COMMUNITY PROJECTS      │
├────────────────────────────────────────┤
│ PROJECT #001:                          │
│ 🌿 RESTORE THE COMMUNITY GARDEN        │
│                                        │
│ CURRENT STATE: STAGE 2 of 5            │
│ "Prepared Soil & Compost Beds"         │
│                                        │
│ Overall Completion: 48%                │
│ [====================         ]        │
├────────────────────────────────────────┤
│ SKILL REQUIREMENTS POOL:               │
│ • 🌱 Stewardship: [240/500 XP] (48%)   │
│ • 🤝 Teamwork:    [150/300 XP] (50%)   │
│ • 🧹 Service:     [135/300 XP] (45%)   │
├────────────────────────────────────────┤
│ [ VIEW GARDEN IN VIRTUAL WORLD ]       │
└────────────────────────────────────────┘
```

---

### Screen 12: Achievements Gallery

```
┌────────────────────────────────────────┐
│ [< Back]          ACHIEVEMENTS         │
├────────────────────────────────────────┤
│ BADGES EARNED: 6 / 20                  │
├────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │ 🌱   │ │ 🧹   │ │ 🛡️   │ │ 📖   │    │
│ │First │ │Helper│ │Digital│ │Quiet │    │
│ │Step  │ │Hand  │ │Sabbath│ │Time  │    │
│ └──────┘ └──────┘ └──────┘ └──────┘    │
├────────────────────────────────────────┤
│ SELECTED BADGE:                        │
│ 🌱 "First Step"                        │
│ Completed your first real-world quest. │
│ Reward: Title "Green Sprout", +5 LP    │
└────────────────────────────────────────┘
```

---

### Screen 13: Inventory & Cosmetics Dressing Room

```
┌────────────────────────────────────────┐
│ [< Back]       PILGRIM'S WARDROBE      │
├────────────────────────────────────────┤
│ [Outfits]  [Headwear]  [Tools]  [Rooms]│
├────────────────────────────────────────┤
│ OWNED ITEMS:                           │
│ ┌────────────────────────────────────┐ │
│ │ 👒 Straw Sun Hat         [EQUIPPED]│ │
│ │ Earned from Stewardship quests     │ │
│ ├────────────────────────────────────┤ │
│ │ 🧣 Linen Pilgrim Scarf   [EQUIP]   │ │
│ │ Earned from 7-day quiet time streak│ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ CURRENT TITLE:                         │
│ [ "Faithful Helper"              ▼ ]   │
└────────────────────────────────────────┘
```

---

### Screen 14: Continue Adventure / World Map

```
┌────────────────────────────────────────┐
│ [< Back]            MAP OF FELLOWSHIP  │
├────────────────────────────────────────┤
│                                        │
│          [ 2. FOG CENTER ]             │
│            (Youth Hall)                │
│                 ▲                      │
│                 │ (Unlocked!)          │
│                 ▼                      │
│          [ 1. MY HOME ]                │
│       (Bedroom & Garden)               │
│                                        │
├────────────────────────────────────────┤
│ SELECT DESTINATION:                    │
│ [ GO TO MY HOME ]  [ VISIT FOG CENTER ]│
└────────────────────────────────────────┘
```

---

### Screen 15: Quest Circle Page (Leader-Governed Cohort)

```
┌────────────────────────────────────────┐
│ [< Back]        QUEST CIRCLES          │
├────────────────────────────────────────┤
│ 🤝 BEREAN CIRCLE (6 / 8 Youth)         │
│ Formed by: Kuya David (Youth Leader)   │
│ Cohort: Sunday Youth Fellowship        │
│ [Linked to Small Group #3: Optional]   │
├────────────────────────────────────────┤
│ SHARED CIRCLE GOAL (THIS WEEK):        │
│ 🎯 Sunday Fellowship Preparation       │
│ [====================     ] 75% Done   │
├────────────────────────────────────────┤
│ CIRCLE ROSTER:                         │
│ • Kuya David  (Leader / Active)        │
│ • Gabriel M.  (Water Bearer Role)      │
│ • Marcus T.   (Chair Brigade Role)     │
│ • Chloe S.    (Music Steward Role)     │
│ • Leo D.      (Hospitality Role)       │
│ • Maya K.     (Story Scribe Role)      │
├────────────────────────────────────────┤
│ [ CIRCLE NOTICE BOARD & MESSAGES ]     │
└────────────────────────────────────────┘
```

---

### Screen 16: Reflection Journal View

```
┌────────────────────────────────────────┐
│ [< Back]       REFLECTION JOURNAL      │
├────────────────────────────────────────┤
│ 🔒 PRIVATE TO YOU (Encrypted)          │
│ Policy: Private by Default             │
│ Status: Separate Safeguarding Review   │
├────────────────────────────────────────┤
│ 📅 TODAY, 10:30 AM                     │
│ Attached Quest: Q-001 Steward of Garden│
│ "Watered the potted ferns on the front │
│ veranda. Notice how dry the earth was. │
│ Taking care of things takes patience." │
├────────────────────────────────────────┤
│ 📅 YESTERDAY, 09:15 PM                 │
│ Attached Quest: Q-029 Evening Examen   │
│ "Saw God's grace when my friend apologized│
│ after school. Want to be less reactive │
│ with my brother tomorrow."             │
├────────────────────────────────────────┤
│ [ ✍️ WRITE NEW PRIVATE ENTRY ]         │
└────────────────────────────────────────┘
```
