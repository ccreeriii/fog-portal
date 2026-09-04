# Koinonia Quest — The First 30 Quests Library

**Document Version:** 1.1.0 (Amended per Product Owner Decisions)  
**Phase:** Phase 0.5 (Game Design & Technical Specification)  
**Status:** SPECIFICATION ONLY — ZERO RUNTIME CODE MODIFICATIONS  
**Target Environment:** Koinonia v3 Community Portal  

---

## 1. Overview & Calibrated Economy Principles

Every quest in Koinonia Quest bridges the virtual and real worlds. Per Product Owner decisions, **Character XP and Skill XP carry the primary weight of game progression** rather than inflating global Koinonia Life Points.

### 1.1 Approved Life Point Reward Bands
- **Simple Everyday Task:** **+3 to +5 Life Points** (e.g., watering plants, room tidying, stretching)
- **Moderate Real-World Quest:** **+5 to +10 Life Points** (e.g., dishwashing, meal assistance, aerobic exercise)
- **Community / Service Quest:** **+10 to +15 Life Points** (e.g., welcoming newcomer, neighborhood cleanup, care package)
- **Major Team / Event Quest:** **+15 to +25 Life Points** (e.g., Sunday chair brigade, tech booth setup, leading a station)
- **Exceptional Milestones:** Achievement bonuses (+25 to +50 Life Points)

### 1.2 Family Verification in Phase 1
For quests requiring family verification:
- Low-value everyday habits continue to use **TRUST** (self-certification).
- Domestic chores requiring confirmation use a simple **"Hand device to parent/guardian"** button.
- **No 4-digit PIN is implemented in Phase 1.**
- Long-term progression will transition to an asynchronous notification sent to a registered parent Koinonia account.

---

## 2. In-Depth Feature Quest: Quest #001

### Quest ID: `Q-001`
### Name: **Steward of the Garden**
- **Category:** HOME / STEWARDSHIP
- **Difficulty:** Simple (5–10 minutes)
- **Suggested Age Suitability:** 11–21 (All youth)
- **Repeatability:** Daily Quest (24-Hour Cooldown)
- **Verification Type:** `TRUST` or `FAMILY` (Direct Handover)
- **Rewards:**
  - **Life Points:** **+5 Global Life Points** (Calibrated Simple Tier; awarded via `awardPoints(youthId, 'growth', 5, 'Koinonia Quest', 'Steward of the Garden')`)
  - **Character XP:** **+5 XP**
  - **Skill XP:** **+15 Stewardship XP**, **+5 Responsibility XP**
  - **Community Project Contribution:** **+15 Points** to *Project #001: Community Garden Restoration*
  - **Virtual World Consequence:** Unlocks the seedling patch in the Home Garden; waters the first community bed at the FOG Center.

---

### Quest #001 Narrative & Interaction Walkthrough

#### Step 1: NPC Dialogue (Uncle Barnaby at the Home Garden Gate)
> *(Uncle Barnaby is gently trimming a potted fern by the wooden garden gate. He notices your avatar approaching and wipes his brow with a worn linen handkerchief, smiling warmly.)*
>
> **Uncle Barnaby:**  
> "Peace be with you, anak! Look around our garden patch here. The sun has been bright today, and the soil is looking a bit dry and parched.  
>  
> You know, people often think stewardship means doing something massive—like saving an entire forest or leading a giant campaign. But Jesus reminded us that the person who is faithful with very little is faithful with much.  
>  
> Before we go off building great things at the Community Center, we start right here at home. Real stewardship begins with small, quiet things that cannot say 'thank you' back—like the plants outside your window."

#### Step 2: Quest Description Card
```
┌────────────────────────────────────────────────────────────────────────┐
│                        QUEST #001: STEWARD OF THE GARDEN               │
├────────────────────────────────────────────────────────────────────────┤
│ Type: Real-World Action Quest              Category: Home / Stewardship│
│                                                                        │
│ Summary:                                                               │
│ Put down your device and inspect the potted plants, garden, or indoor  │
│ greenery at your home. Give them fresh, clean water. Notice the dry    │
│ earth soak in the moisture.                                            │
│                                                                        │
│ Stewardship Fallback (If No Plants at Home):                           │
│ If your household has no plants, perform an equivalent home            │
│ stewardship task: refill a household pet's water dish with clean water,│
│ wipe down a shared family dining table, or tidy a shared family space. │
│                                                                        │
│ Rewards:                                                               │
│   ⭐ +5 Koinonia Life Points (Calibrated Simple Band)                   │
│   🛡️ +5 Character XP                                                  │
│   🌱 +15 Stewardship XP  •  📋 +5 Responsibility XP                    │
│   🤝 +15 Shared Community Garden Progress                              │
│                                                                        │
│ Verification: TRUST (Self-Confirm) or FAMILY (Parent Device Handover)  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Step 3: Acceptance Screen
> *(The player taps the glowing green button: `[ ACCEPT QUEST ]`)*
>
> **Uncle Barnaby:**  
> "Splendid! Now, don't just stare at the screen, anak. The water won't pour itself through your glass display!  
>  
> Go find a cup, a watering can, or an old pitcher. Step outside or check your living room. Give those thirsty green leaves a drink. If you don't have plants, care for your pet's bowl or our shared household space. I'll be right here waiting when you return."

#### Step 4: Real-World Instruction Modal
> *(The screen displays a gentle countdown timer and an exit ramp)*
>
> **[ GO OUT INTO THE REAL WORLD ]**  
> 1. Step away from your phone or computer.  
> 2. Primary Action: Fill a container with clean water and water the potted plants or garden at home gently at their root base.  
> 3. Equivalent Stewardship Fallback: If you have no plants at home, refill a household pet's water dish with fresh water, or clean and wipe down a shared family table or porch area.  
> 4. Come back when you're done!

#### Step 5: Completion & Submission Screen
> *(Player returns to the app and clicks `[ I COMPLETED THIS IN REAL LIFE ]`)*
>
> Verification Selection:
> - `[•] Self-Certification (TRUST) — "I certify on my word of honor that I completed this."`
> - `[ ] Family Confirmation (FAMILY) — Hand device to a parent/guardian to tap confirmation.`

#### Step 6: Reflection Prompt
> *(A brief, beautiful reflection input appears before rewards are finalized)*
>
> **Reflection Prompt:**  
> *"What did it feel like to nurture something living or care for your home environment today? What is one other small thing in your home you can care for this week?"*  
> *(Player enters 1–2 thoughtful sentences into the private journal box)*

#### Step 7: Reward Sequence & World Consequence
> *(Celebratory chime plays. A glowing golden banner appears:)*
>
> **QUEST COMPLETED: STEWARD OF THE GARDEN!**  
> - **+5 Life Points** synced to your Koinonia profile!  
> - **+5 Character XP** (Level 1: 5/70 XP)  
> - **+15 Stewardship XP** | **+5 Responsibility XP**  
> - **Community Garden:** 15/500 Stewardship XP contributed to the FOG Youth Center!
>
> *(The camera smoothly pans over the player's virtual Home Garden: The dry brown dirt turns a rich dark loam, and a tiny green sprout uncurls from the soil, sparkling with morning dew. Uncle Barnaby gives a satisfied nod.)*
>
> **Uncle Barnaby:**  
> "Look at that soil breathe! You've taken your first step as a true steward. The path to the FOG Community Center is now open to you. Go meet Ate Joy and the others!"

---

## 3. The 30 Core Quests Catalog (Calibrated Economy)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CALIBRATED QUEST DIRECTORY (30 QUESTS)               │
├───────────────────┬─────────────────────┬───────────────────────────────┤
│ Category          │ Quest IDs           │ Calibrated Life Points        │
├───────────────────┼─────────────────────┼───────────────────────────────┤
│ 1. HOME           │ Q-001 to Q-004      │ +5 to +8 LP (Simple/Moderate) │
│ 2. FAMILY         │ Q-005 to Q-007      │ +8 to +10 LP (Moderate)       │
│ 3. PERSONAL       │ Q-008 to Q-010      │ +5 to +10 LP (Habit/Moderate) │
│ 4. COMMUNITY      │ Q-011 to Q-013      │ +10 to +15 LP (Community)     │
│ 5. TEAMWORK       │ Q-014 to Q-016      │ +8 to +12 LP (Teamwork)       │
│ 6. SERVICE        │ Q-017 to Q-019      │ +12 to +15 LP (Service/Event) │
│ 7. FITNESS        │ Q-020 to Q-022      │ +5 to +8 LP (Discipline)      │
│ 8. CREATIVITY     │ Q-023 to Q-025      │ +10 to +12 LP (Creative)      │
│ 9. LEADERSHIP     │ Q-026 to Q-028      │ +15 to +20 LP (Leadership)    │
│ 10. REFLECTION    │ Q-029 to Q-030      │ +3 to +5 LP (Reflection)      │
└───────────────────┴─────────────────────┴───────────────────────────────┘
```

---

### Category 1: HOME

#### `Q-002`: Feast Preparation Assistant
- **Name:** Feast Preparation Assistant
- **Category:** HOME / SERVICE
- **Description:** Help prepare a family meal by washing vegetables, setting the table, or peeling ingredients.
- **Real-World Action:** Spend at least 15 minutes helping whoever is cooking dinner or lunch in your household.
- **Difficulty:** Moderate
- **Verification Type:** `FAMILY` (Direct device handover to parent)
- **Life Points:** **+8 Life Points** (Moderate Band)
- **Character XP:** +8
- **Skill XP:** +15 Service, +10 Responsibility
- **Community Contribution:** +10 to Project #005 (Equip Community Kitchen)
- **Repeatability:** Weekly Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"What did you learn while helping in the kitchen? How did the person preparing the meal respond?"*
- **Story Hook:** Ate Joy shares how preparing food for fellowship gatherings is an ancient biblical act of holy hospitality.

#### `Q-003`: Sanctuary of Order
- **Name:** Sanctuary of Order
- **Category:** HOME / DISCIPLINE
- **Description:** Clean and organize your personal sleeping area or study desk without being asked.
- **Real-World Action:** Make your bed, clear clutter off your study desk, and organize your clothes/shoes neatly.
- **Difficulty:** Simple
- **Verification Type:** `TRUST` or `FAMILY` (Handover)
- **Life Points:** **+5 Life Points** (Simple Band)
- **Character XP:** +5
- **Skill XP:** +15 Discipline, +10 Responsibility
- **Community Contribution:** None
- **Repeatability:** Daily Quest (24-Hour Cooldown)
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"How does having an orderly physical space affect your focus and peace of mind?"*
- **Story Hook:** Kuya David notes that before a builder can construct a bridge, they must keep their workbench clean.

#### `Q-004`: The Hearth of Fellowship
- **Name:** The Hearth of Fellowship
- **Category:** HOME / FAMILY
- **Description:** Clear and wash the family dinner dishes after an evening meal.
- **Real-World Action:** Clear the dinner table, wash, dry, and put away dishes, and wipe the countertop clean.
- **Difficulty:** Moderate
- **Verification Type:** `FAMILY` (Direct device handover to parent)
- **Life Points:** **+8 Life Points** (Moderate Band)
- **Character XP:** +8
- **Skill XP:** +20 Service, +10 Compassion
- **Community Contribution:** +15 to Project #005 (Equip Community Kitchen)
- **Repeatability:** Daily Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Doing dishes can feel repetitive. How can doing ordinary chores become an expression of love?"*
- **Story Hook:** Marcus admits he used to run away from the kitchen after eating, until he realized his mother was exhausted.

---

### Category 2: FAMILY

#### `Q-005`: Sibling Armor Bearer
- **Name:** Sibling Armor Bearer
- **Category:** FAMILY / COMPASSION
- **Description:** Assist a younger or older sibling with their homework, chore, or encourage them through a tough moment.
- **Real-World Action:** Spend 20 minutes helping a brother, sister, or younger cousin with schoolwork or domestic tasks without teasing or complaining.
- **Difficulty:** Moderate
- **Verification Type:** `FAMILY` (Direct device handover)
- **Life Points:** **+8 Life Points** (Moderate Band)
- **Character XP:** +10
- **Skill XP:** +20 Compassion, +15 Teamwork
- **Community Contribution:** None
- **Repeatability:** Weekly Quest
- **Suggested Age Suitability:** 11–21 (If only child: help a cousin or parent with a personal task)
- **Reflection Prompt:** *"Where is your sibling struggling right now, and how can you pray for them this week?"*
- **Story Hook:** Kuya David shares how protecting his younger brothers taught him what it truly means to lead.

#### `Q-006`: Words of Honor
- **Name:** Words of Honor
- **Category:** FAMILY / COMMUNICATION
- **Description:** Write or speak a sincere message of gratitude to a parent, grandparent, or guardian.
- **Real-World Action:** Give a handwritten note, card, or heartfelt spoken message thanking them for a specific sacrifice they made for you.
- **Difficulty:** Moderate (Emotional courage required)
- **Verification Type:** `TRUST`
- **Life Points:** **+10 Life Points** (Moderate Band)
- **Character XP:** +10
- **Skill XP:** +20 Communication, +15 Wisdom
- **Community Contribution:** None
- **Repeatability:** One-Time / Monthly
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"How did your parent or guardian react? Why is it sometimes hard to say thank you to family?"*
- **Story Hook:** Uncle Barnaby speaks on the Fifth Commandment: honoring parents brings life and health to a home.

#### `Q-007`: Elder Wisdom Interview
- **Name:** Elder Wisdom Interview
- **Category:** FAMILY / WISDOM
- **Description:** Sit down with an elder family member or church mentor and ask them about their youth.
- **Real-World Action:** Spend 20 minutes asking an older relative: *"What is one lesson God taught you when you were my age?"* Listen attentively without checking your phone.
- **Difficulty:** Moderate
- **Verification Type:** `TRUST`
- **Life Points:** **+10 Life Points** (Moderate Band)
- **Character XP:** +12
- **Skill XP:** +25 Wisdom, +15 Communication
- **Community Contribution:** None
- **Repeatability:** Monthly Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Write one sentence of advice your elder shared that you want to remember five years from now."*
- **Story Hook:** Leo explains how listening to his grandfather's stories helped him feel less lonely when moving to a new city.

---

### Category 3: PERSONAL GROWTH

#### `Q-008`: Morning Stillness
- **Name:** Morning Stillness
- **Category:** PERSONAL / DISCIPLINE
- **Description:** Spend 10 uninterrupted minutes reading scripture and sitting in quiet reflection before opening social media.
- **Real-World Action:** Read a chapter of Proverbs or the Gospels in a physical Bible or Koinonia app, followed by quiet prayer.
- **Difficulty:** Simple
- **Verification Type:** `SYSTEM` (Linked to Koinonia Daily Journal/Prayer) or `TRUST`
- **Life Points:** **+5 Life Points** (Simple Band)
- **Character XP:** +8
- **Skill XP:** +20 Discipline, +15 Wisdom
- **Community Contribution:** None
- **Repeatability:** Daily Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"What word or verse stood out to your heart this morning?"*
- **Story Hook:** Chloe shares how starting the day with silence rather than social media notifications cured her morning anxiety.

#### `Q-009`: Digital Sabbath Hour
- **Name:** Digital Sabbath Hour
- **Category:** PERSONAL / DISCIPLINE
- **Description:** Intentionally disconnect from all smartphones, screens, and gaming devices for two consecutive hours.
- **Real-World Action:** Turn off your phone and computer. Spend the two hours reading a book, walking outdoors, drawing, or talking face-to-face.
- **Difficulty:** Challenging
- **Verification Type:** `FAMILY` (Handover) or `TRUST`
- **Life Points:** **+10 Life Points** (Moderate Band)
- **Character XP:** +15
- **Skill XP:** +25 Discipline, +10 Stewardship
- **Community Contribution:** None
- **Repeatability:** Weekly Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"What did you notice about yourself during the screen silence? Did you feel restless or peaceful?"*
- **Story Hook:** Sam (the tech helper) explains that even the most powerful computers need a hard reboot to clear cache and stay fast.

#### `Q-010`: The Courage of Confession
- **Name:** The Courage of Confession
- **Category:** PERSONAL / WISDOM
- **Description:** Acknowledge a personal mistake or apologize to someone you spoke harshly to.
- **Real-World Action:** Go to a person you wronged or were impatient with, look them in the eye (or send a direct sincere message), and say: *"I was wrong, please forgive me."*
- **Difficulty:** Challenging
- **Verification Type:** `TRUST`
- **Life Points:** **+10 Life Points** (Moderate Band)
- **Character XP:** +15
- **Skill XP:** +25 Wisdom, +20 Responsibility
- **Community Contribution:** None
- **Repeatability:** Habit / Situational
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"How did it feel before you apologized, and what felt different after you took responsibility?"*
- **Story Hook:** Marcus recalls a basketball game where he blamed a teammate, and how apologizing afterward restored their friendship.

---

### Category 4: COMMUNITY

#### `Q-011`: Welcoming the Stranger
- **Name:** Welcoming the Stranger
- **Category:** COMMUNITY / COMPASSION
- **Description:** Introduce yourself to someone standing alone at youth fellowship, church, or school.
- **Real-World Action:** Walk up to a newcomer or shy peer, introduce yourself, ask their name, and help them find a seat or snack.
- **Difficulty:** Moderate
- **Verification Type:** `LEADER` or `TRUST`
- **Life Points:** **+12 Life Points** (Community Band)
- **Character XP:** +12
- **Skill XP:** +25 Compassion, +15 Communication
- **Community Contribution:** +15 to Project #002 (Youth Hall Upgrade)
- **Repeatability:** Weekly Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Remember what it felt like when you were new somewhere. How did welcoming this person reflect Christ?"*
- **Story Hook:** Leo's eyes light up as he tells how one person saying 'sit with us' changed his entire year.

#### `Q-012`: Neighborhood Sweep
- **Name:** Neighborhood Sweep
- **Category:** COMMUNITY / STEWARDSHIP
- **Description:** Pick up trash and litter along your street, local park, or church grounds.
- **Real-World Action:** Take a garbage bag and gloves, spend 20 minutes collecting plastic waste and trash, and dispose of it properly.
- **Difficulty:** Simple
- **Verification Type:** `TRUST` or `FAMILY`
- **Life Points:** **+10 Life Points** (Community Band)
- **Character XP:** +10
- **Skill XP:** +20 Stewardship, +15 Service
- **Community Contribution:** +20 to Project #001 (Community Garden)
- **Repeatability:** Weekly Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Why should Christians care about cleaning public spaces that others dirtied?"*
- **Story Hook:** Uncle Barnaby shows a dry patch of earth and reminds you that beauty begins when we remove what doesn't belong.

#### `Q-013`: Sunshine Care Package
- **Name:** Sunshine Care Package
- **Category:** COMMUNITY / COMPASSION
- **Description:** Prepare a small gift or snack package with an encouraging note for a sick friend or elderly neighbor.
- **Real-World Action:** Assemble fruit, baked treats, or tea with a handwritten Bible verse card, and deliver it with parent permission.
- **Difficulty:** Moderate
- **Verification Type:** `FAMILY` or `LEADER`
- **Life Points:** **+15 Life Points** (Community Band)
- **Character XP:** +15
- **Skill XP:** +25 Compassion, +15 Service
- **Community Contribution:** +20 to Project #006 (Outreach & Care Center)
- **Repeatability:** Monthly Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Who in your community is often forgotten? How can small acts of generosity bring hope?"*
- **Story Hook:** Maya designs a vibrant card and shows how a simple drawing can bring tears of joy to a homebound elder.

---

### Category 5: TEAMWORK

#### `Q-014`: Synchronized Fellowship
- **Name:** Synchronized Fellowship
- **Category:** TEAMWORK / TEAMWORK
- **Description:** Actively participate in a group game or team sport with a joyful, encouraging attitude.
- **Real-World Action:** Play a team sport or group board game with peers. Prioritize passing the ball, cheering teammates, and losing/winning gracefully.
- **Difficulty:** Simple
- **Verification Type:** `LEADER` or `TRUST`
- **Life Points:** **+8 Life Points** (Moderate Band)
- **Character XP:** +10
- **Skill XP:** +25 Teamwork, +10 Discipline
- **Community Contribution:** None
- **Repeatability:** Weekly Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Did you catch yourself getting competitive or impatient? How did you steer your attitude back to kindness?"*
- **Story Hook:** Marcus talks about the difference between playing to look good versus playing to make your whole squad shine.

#### `Q-015`: The Bridge Builders
- **Name:** The Bridge Builders
- **Category:** TEAMWORK / COMMUNICATION
- **Description:** Intervene constructively to defuse a small disagreement or gossip circle among friends.
- **Real-World Action:** When you hear peers arguing or gossiping, gently redirect the conversation toward understanding, or encourage the two parties to speak directly and kindly.
- **Difficulty:** Challenging
- **Verification Type:** `TRUST` or `LEADER`
- **Life Points:** **+12 Life Points** (Moderate/Team Band)
- **Character XP:** +15
- **Skill XP:** +25 Communication, +20 Wisdom, +15 Leadership
- **Community Contribution:** None
- **Repeatability:** Situational
- **Suggested Age Suitability:** 13–21
- **Reflection Prompt:** *"Blessed are the peacemakers. What courage did it take to speak up for peace?"*
- **Story Hook:** Chloe recounts how a small misunderstanding nearly split their worship band until someone dared to ask for an honest conversation.

#### `Q-016`: The Shared Load
- **Name:** The Shared Load
- **Category:** TEAMWORK / SERVICE
- **Description:** Notice a teammate or classmate struggling to finish their chore or assignment, and stay late to help them finish.
- **Real-World Action:** Without being asked, pick up a broom, carry half the books, or help an overburdened friend finish their duty before leaving.
- **Difficulty:** Moderate
- **Verification Type:** `LEADER` or `TRUST`
- **Life Points:** **+10 Life Points** (Moderate Band)
- **Character XP:** +12
- **Skill XP:** +25 Teamwork, +20 Service
- **Community Contribution:** +15 to Project #002 (Youth Hall Upgrade)
- **Repeatability:** Weekly Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Galatians 6:2 says: 'Bear one another's burdens.' What burden did you help lighten today?"*
- **Story Hook:** Kuya David smiles: *"Nobody leaves until everyone can leave together. That's how a real family operates."*

---

### Category 6: SERVICE

#### `Q-017`: The Chair Brigade
- **Name:** The Chair Brigade
- **Category:** SERVICE / RESPONSIBILITY
- **Description:** Help set up or stack chairs and tables for Sunday service or a youth event.
- **Real-World Action:** Carry, align, or stack at least 20 chairs before or after an in-person church gathering.
- **Difficulty:** Moderate
- **Verification Type:** `LEADER` or `EVENT`
- **Life Points:** **+15 Life Points** (Community/Service Band)
- **Character XP:** +12
- **Skill XP:** +25 Service, +15 Responsibility
- **Community Contribution:** +25 to Project #002 (Youth Hall Upgrade)
- **Repeatability:** Weekly Event-Linked Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Who sat in the chairs you placed today? How does manual work serve their worship experience?"*
- **Story Hook:** Marcus wipes sweat from his brow and laughs: *"You want muscles for the Kingdom? Join the Chair Brigade!"*

#### `Q-018`: Cup of Cold Water
- **Name:** Cup of Cold Water
- **Category:** SERVICE / COMPASSION
- **Description:** Serve drinks, snacks, or refreshments to the church congregation or youth fellowship.
- **Real-World Action:** Volunteer at the hospitality table, pour water or juice, hand out snacks with a warm smile, and clean the serving area afterward.
- **Difficulty:** Simple
- **Verification Type:** `LEADER`
- **Life Points:** **+10 Life Points** (Community/Service Band)
- **Character XP:** +10
- **Skill XP:** +20 Service, +15 Compassion
- **Community Contribution:** +15 to Project #005 (Equip Community Kitchen)
- **Repeatability:** Weekly Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Jesus said whoever gives even a cup of cold water in His name will not lose their reward. How did serving feel today?"*
- **Story Hook:** Ate Joy prepares the tea station and reminds you that hospitality makes strangers feel like beloved family.

#### `Q-019`: Sound, Cables & Sanctuary
- **Name:** Sound, Cables & Sanctuary
- **Category:** SERVICE / RESPONSIBILITY
- **Description:** Assist the church tech/audio team with wrapping cables, setting microphones, or running presentation slides.
- **Real-World Action:** Spend 30 minutes in the tech booth or stage helping neatly wrap XLR cables 'over-under', test microphones, or run lyrics.
- **Difficulty:** Moderate
- **Verification Type:** `LEADER`
- **Life Points:** **+15 Life Points** (Service Band)
- **Character XP:** +15
- **Skill XP:** +25 Responsibility, +20 Service, +15 Teamwork
- **Community Contribution:** +20 to Project #004 (Restore Music & Rehearsal Room)
- **Repeatability:** Weekly Quest
- **Suggested Age Suitability:** 13–21
- **Reflection Prompt:** *"When technology works seamlessly, people don't notice it—they notice God. What did you learn about hidden service?"*
- **Story Hook:** Sam carefully demonstrates the 'over-under' cable coil: *"Treat this cable well, and it won't crackle during Sunday worship."*

---

### Category 7: FITNESS

#### `Q-020`: Temple Care: 30-Minute Stride
- **Name:** Temple Care: 30-Minute Stride
- **Category:** FITNESS / DISCIPLINE
- **Description:** Engage in 30 minutes of intentional cardiovascular exercise (brisk walking, jogging, cycling, or swimming).
- **Real-World Action:** Complete 30 continuous minutes of outdoor aerobic activity.
- **Difficulty:** Moderate
- **Verification Type:** `TRUST` or `FAMILY`
- **Life Points:** **+8 Life Points** (Moderate Band)
- **Character XP:** +10
- **Skill XP:** +25 Discipline, +15 Responsibility
- **Community Contribution:** None
- **Repeatability:** Daily Quest (3x per week max)
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"1 Corinthians 6:19 calls our bodies temples of the Holy Spirit. How does physical health honor God?"*
- **Story Hook:** Kuya David laces up his running sneakers: *"A healthy body gives you energy to serve when others are tired."*

#### `Q-021`: Reflex of Faith
- **Name:** Reflex of Faith
- **Category:** FITNESS / DISCIPLINE
- **Description:** Train mental focus and physical reflexes through Koinonia's Fit Quest Reflex Tap or Narrow Gate mini-game.
- **Real-World Action:** Play the integrated Fit Quest Reflex training and achieve a clean focus score.
- **Difficulty:** Simple
- **Verification Type:** `SYSTEM` (Verified via `brain_user_logs` or `fq_daily_scores`)
- **Life Points:** **+5 Life Points** (Simple Band)
- **Character XP:** +8
- **Skill XP:** +20 Discipline, +10 Wisdom
- **Community Contribution:** None
- **Repeatability:** Daily Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Discipline is training yourself to respond to truth before impulse. Where do you need fast reflexes against temptation?"*
- **Story Hook:** Marcus tests his reaction times and talks about keeping his guard up in spiritual battles.

#### `Q-022`: Morning Mobility & Breath
- **Name:** Morning Mobility & Breath
- **Category:** FITNESS / DISCIPLINE
- **Description:** Complete 15 minutes of full-body stretching, posture exercises, and deep prayerful breathing.
- **Real-World Action:** Perform stretching routines targeting neck, back, hamstrings, and shoulders, thanking God for every breath.
- **Difficulty:** Simple
- **Verification Type:** `TRUST`
- **Life Points:** **+3 Life Points** (Simple Band)
- **Character XP:** +5
- **Skill XP:** +15 Discipline, +10 Stewardship
- **Community Contribution:** None
- **Repeatability:** Daily Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Did you release physical tension during your stretching? How does God's peace touch your physical body?"*
- **Story Hook:** Uncle Barnaby stretches his back with a chuckle: *"Even trees bend in the wind so their branches don't snap."*

---

### Category 8: CREATIVITY

#### `Q-023`: Visual Testimony
- **Name:** Visual Testimony
- **Category:** CREATIVITY / CREATIVITY
- **Description:** Create a drawing, digital graphic, calligraphy verse, or painting inspired by a scripture passage.
- **Real-World Action:** Spend 45 minutes creating an original artistic work illustrating a Bible verse, and share it with your Circle or family.
- **Difficulty:** Moderate
- **Verification Type:** `LEADER` or `TRUST`
- **Life Points:** **+12 Life Points** (Moderate/Creative Band)
- **Character XP:** +15
- **Skill XP:** +30 Creativity, +15 Communication
- **Community Contribution:** +15 to Project #003 (Reflection Garden)
- **Repeatability:** Weekly Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"What inspired your visual design? How can art reveal God's beauty to people who don't read books?"*
- **Story Hook:** Maya holds up her sketchbook: *"Colors are words that heart can understand even without reading."*

#### `Q-024`: Song of Ascent
- **Name:** Song of Ascent
- **Category:** CREATIVITY / CREATIVITY
- **Description:** Practice an instrument or vocal piece for 30 focused minutes for worship or community blessing.
- **Real-World Action:** Practice guitar, piano, drums, violin, or singing with dedication and excellence.
- **Difficulty:** Moderate
- **Verification Type:** `FAMILY` or `LEADER`
- **Life Points:** **+10 Life Points** (Moderate Band)
- **Character XP:** +12
- **Skill XP:** +25 Creativity, +20 Discipline
- **Community Contribution:** +20 to Project #004 (Restore Music Rehearsal Room)
- **Repeatability:** Weekly Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Psalm 33:3 commands us to 'play skillfully with a loud noise.' How does disciplined practice honor the Lord?"*
- **Story Hook:** Chloe tunes her violin carefully: *"Excellence isn't about impressing people; it's about giving God our best craft."*

#### `Q-025`: Story Weaver
- **Name:** Story Weaver
- **Category:** CREATIVITY / COMMUNICATION
- **Description:** Write a creative story, poem, or personal testimony reflecting on God's faithfulness during a storm.
- **Real-World Action:** Write at least 250 words capturing a personal spiritual journey, struggle, or reflection in poetic or narrative form.
- **Difficulty:** Moderate
- **Verification Type:** `TRUST` or `LEADER`
- **Life Points:** **+10 Life Points** (Moderate Band)
- **Character XP:** +12
- **Skill XP:** +25 Creativity, +20 Communication, +15 Wisdom
- **Community Contribution:** None
- **Repeatability:** Monthly Quest
- **Suggested Age Suitability:** 13–21
- **Reflection Prompt:** *"Stories help us remember what God did in the dark. What did writing this help you remember?"*
- **Story Hook:** Uncle Barnaby shows an old leather journal filled with decades of hand-written testimonies of answered prayers.

---

### Category 9: LEADERSHIP

#### `Q-026`: Small Circle Encourager
- **Name:** Small Circle Encourager
- **Category:** LEADERSHIP / COMMUNICATION
- **Description:** Intentionally encourage every member of your small group or youth circle this week.
- **Real-World Action:** Send individual private messages or speak one-on-one with 4 different peers, pointing out a specific gift or virtue you admire in them.
- **Difficulty:** Moderate
- **Verification Type:** `LEADER` or `TRUST`
- **Life Points:** **+15 Life Points** (Leadership Band)
- **Character XP:** +15
- **Skill XP:** +25 Leadership, +20 Communication, +15 Compassion
- **Community Contribution:** None
- **Repeatability:** Bi-Weekly Quest
- **Suggested Age Suitability:** 13–21
- **Reflection Prompt:** *"Proverbs 18:21 says words have power over life and death. How did your words bring life to your friends?"*
- **Story Hook:** Ate Joy shares how a single encouraging sentence from an elder kept her from giving up when she felt inadequate.

#### `Q-027`: Station Coordinator
- **Name:** Station Coordinator
- **Category:** LEADERSHIP / RESPONSIBILITY
- **Description:** Take responsibility for coordinating one specific station or task during a community project or youth event.
- **Real-World Action:** Lead 2–3 other youth in completing a chore (e.g., cleaning the kitchen, organizing the craft supplies, setting up chairs). Delegate kindly and work alongside them.
- **Difficulty:** Challenging
- **Verification Type:** `LEADER`
- **Life Points:** **+20 Life Points** (Major Leadership Band)
- **Character XP:** +20
- **Skill XP:** +30 Leadership, +20 Teamwork, +15 Responsibility
- **Community Contribution:** +25 to Project #002 (Youth Hall Upgrade)
- **Repeatability:** Monthly Quest
- **Suggested Age Suitability:** 14–21
- **Reflection Prompt:** *"What was challenging about delegating? Did you lead by bossing people around, or by working harder than anyone else?"*
- **Story Hook:** Marcus wipes his brow: *"The best captains are the first ones on the field and the last ones to leave the locker room."*

#### `Q-028`: The Mentorship Walk
- **Name:** The Mentorship Walk
- **Category:** LEADERSHIP / COMPASSION
- **Description:** Take a younger youth or new believer out for an iced tea or snack and listen to how their week went.
- **Real-World Action:** Spend 30 minutes with a younger peer with leader knowledge. Ask about their school, hobbies, and faith, and pray for them before leaving.
- **Difficulty:** Challenging
- **Verification Type:** `LEADER`
- **Life Points:** **+20 Life Points** (Major Leadership Band)
- **Character XP:** +20
- **Skill XP:** +30 Leadership, +25 Compassion, +20 Wisdom
- **Community Contribution:** None
- **Repeatability:** Monthly Quest
- **Suggested Age Suitability:** 16–21 (For apprentice/servant leaders)
- **Reflection Prompt:** *"Mentoring isn't having all the answers; it's caring enough to walk beside someone. What did you learn from them?"*
- **Story Hook:** Kuya David recalls how older mentors invested in him when he was a rebellious 14-year-old.

---

### Category 10: REFLECTION

#### `Q-029`: The Evening Examen
- **Name:** The Evening Examen
- **Category:** REFLECTION / WISDOM
- **Description:** Review your day before sleep through three guided questions: Where did I see God's grace? Where did I falter? How will I grow tomorrow?
- **Real-World Action:** Spend 10 minutes in your bedroom before sleep recording your responses in the private Quest Reflection Journal.
- **Difficulty:** Simple
- **Verification Type:** `TRUST` (Private by design)
- **Life Points:** **+5 Life Points** (Simple Band)
- **Character XP:** +5
- **Skill XP:** +20 Wisdom, +15 Discipline
- **Community Contribution:** None
- **Repeatability:** Daily Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Log your three answers into your private ledger."*
- **Story Hook:** Uncle Barnaby sits on the porch watching the sunset: *"Don't let the sun go down on unexamined thoughts. Rest with a clean heart."*

#### `Q-030`: The Gratitude Ledger
- **Name:** The Gratitude Ledger
- **Category:** REFLECTION / WISDOM
- **Description:** Record five specific blessings or provisions from God that occurred in the past 24 hours.
- **Real-World Action:** Write down five concrete blessings (e.g., a warm meal, a friend's smile, safe travel, an encouraging text, a sunset) in your journal.
- **Difficulty:** Simple
- **Verification Type:** `TRUST`
- **Life Points:** **+5 Life Points** (Simple Band)
- **Character XP:** +8
- **Skill XP:** +20 Wisdom, +15 Compassion
- **Community Contribution:** None
- **Repeatability:** Weekly Quest
- **Suggested Age Suitability:** 11–21
- **Reflection Prompt:** *"Gratitude turns what we have into enough. Which of the five surprised you the most?"*
- **Story Hook:** Leo opens his worn notebook and shows pages filled with small things he thanked God for each week.
