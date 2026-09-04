# Koinonia Quest — World Design & Spatial Experience

**Document Version:** 1.1.0 (Amended per Product Owner Decisions)  
**Phase:** Phase 0.6 (Visual Identity, World Art Direction & Screen Experience)  
**Status:** DESIGN & SPECIFICATION ONLY — ZERO APPLICATION CODE MODIFICATIONS  
**Target Engine:** Lightweight HTML5 2D Canvas (Phase 1 Approved Architecture)  

---

## 1. World Perspective Evaluation & Recommendation

To select the ideal spatial perspective for Koinonia Quest, we evaluated four primary 2D rendering architectures against the project's technical, operational, and artistic requirements.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PERSPECTIVE ARCHITECTURE MATRIX                   │
├────────────────────┬─────────────┬─────────────┬───────────┬───────────┤
│ Evaluation Factor  │ A. Top-Down │ B. 3/4 Top  │ C. Isomet.│ D. Side-  │
│                    │    (90°)    │    Down     │   (2:1)   │    View   │
├────────────────────┼─────────────┼─────────────┼───────────┼───────────┤
│ Mobile Touch Nav   │ Good        │ Excellent   │ Fair      │ Good      │
│ Asset Workload     │ Low         │ Moderate    │ Very High │ Moderate  │
│ Canvas Performance │ Best        │ Target 60fps│ Moderate  │ Target 60 │
│ Raspberry Pi Load  │ Minimal     │ Minimal     │ Low       │ Minimal   │
│ Character Express. │ Poor        │ High        │ High      │ High      │
│ Environmental Story│ Fair        │ Excellent   │ Excellent │ Fair      │
│ Spatial Freedom    │ Omnidirect. │ 4/8-Way     │ Diagonal  │ 2-Way (LR)│
│ Future Multiplayer │ Good        │ Seamless    │ Complex   │ Moderate  │
└────────────────────┴─────────────┴─────────────┴───────────┴───────────┘
```

### 1.1 Detailed Evaluation of Options

#### Option A: Traditional Top-Down (90-Degree Bird's Eye)
- *Pros:* Simple math; easiest collision detection; lowest sprite overhead.
- *Cons:* Characters appear only as the tops of heads and shoulders; severely cripples facial expression, emotional storytelling, and avatar fashion/accessories.

#### Option B: 3/4 Top-Down (Classic 45-Degree Elevation) — APPROVED
- *Visual Style:* Familiar from classic storybook RPGs (e.g., *The Minish Cap*, *Earthbound*, modern cozy indie titles), executed in **high-density handcrafted pixel art with painterly warmth**.
- *Pros:*
  - **Optimal Character Readability:** Faces, clothing, and emotional expressions are fully visible to players on small mobile screens.
  - **Natural Environmental Storytelling:** Walls, notice boards, kitchen stoves, and plant pots show their front elevation while preserving floor walkability.
  - **Touchscreen Friendly:** Intuitive 4-directional and 8-directional touch navigation without the awkward diagonal finger drift inherent to isometric grids.
  - **Asset Efficiency:** Uses standard rectangular 32×32 pixel tiles that pack cleanly into lightweight sprite sheets and scale cleanly at integer 2× and 3× factors.
  - **Measured Resource Profile:** Minimal Raspberry Pi server-side game-loop load (all rendering is client-side REST), targeting 60 FPS on typical supported mobile devices with a graceful 30 FPS fallback on constrained hardware. Actual performance to be measured during prototype testing.

#### Option C: Lightweight Isometric (2:1 Dimetric Projection)
- *Visual Style:* SimCity, Habbo Hotel, or Tactics RPGs.
- *Cons:* Extremely high asset production workload (every wall and corner requires 4 diagonal angles); touchscreen pathfinding requires complex diamond coordinate math; touch hit-testing on small screens is notoriously error-prone.

#### Option D: Side-View Life Simulator (Platformer / Terraria Style)
- *Cons:* Lacks community depth; restricts player navigation to a single horizontal slice; prevents feeling like you are exploring a real neighborhood or community courtyard.

### 1.2 Final Recommendation & Product Owner Approval
**Option B (3/4 Top-Down)** is the approved perspective for Koinonia Quest. It provides the ideal synthesis of expressive character storytelling, low asset friction, natural mobile touch controls, and lightweight Canvas rendering.

---

## 2. First World — My Home (Personal Stewardship Space)

Every player begins their adventure in their own virtual **Home**. The Home is an intimate, cozy indoor-outdoor map (30×24 tiles) that visually reflects domestic responsibility, family honor, and personal stewardship.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MAP 1: MY HOME (3/4 VIEW)                       │
├────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────┐    ┌───────────────────────────────────┐ │
│ │        THE BEDROOM        │    │         LIVING AREA               │ │
│ │  • Study Desk & Lamp      │────│  • Shared Woven Sofa              │ │
│ │  • Wardrobe & Chalkboard  │    │  • Family Photo Shelf             │ │
│ │  • Unmade/Tidy Bed        │    │  • Notice Board (Family Chores)   │ │
│ └─────────────┬─────────────┘    └─────────────────┬─────────────────┘ │
│               │                                    │                   │
│ ┌─────────────┴─────────────┐    ┌─────────────────┴─────────────────┐ │
│ │        THE KITCHEN        │    │        GARDEN & VERANDA           │ │
│ │  • Dish Sink & Counter    │────│  • Potted Ferns & Plants          │ │
│ │  • Cooking Stove & Kettle │    │  • Wooden Watering Can            │ │
│ │  • Shared Dining Table    │    │  • Garden Gate (To FOG Center)    │ │
│ └───────────────────────────┘    └───────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 The Four Domestic Spaces

#### 1. The Bedroom (Discipline & Personal Order)
- **Visual Narrative:** The personal haven. Initially cluttered: sheets askew on the wooden platform bed, books piled haphazardly on the desk, a backpack resting on the floor.
- **Interactive Objects:**
  - *The Bed:* Triggers room tidying quests (`Q-003`).
  - *The Study Desk:* Holds an open notebook, brass desk lamp, and Bible.
  - *The Wardrobe:* Opens the Avatar Workshop dressing room.
  - *The Journal Desk:* Triggers the private Evening Examen reflection (`Q-029`).

#### 2. The Living Area (Family Connection)
- **Visual Narrative:** Shows that a family shares this space. A comfortable rattan/woven sofa with colorful cushions, a wall shelf displaying framed family silhouettes and milestone certificates, and a calendar on the wall.
- **Interactive Objects:**
  - *The Family Bookshelf:* Triggers the Elder Wisdom interview quest (`Q-007`).
  - *The Communal Table:* Triggers device-free family hour (`Q-009`).

#### 3. The Kitchen (Family Service & Hospitality)
- **Visual Narrative:** Visibly active and lived-in. A porcelain sink, an aluminum drying rack, a stainless steel stove with a tea kettle, and a wooden spice rack.
- **Interactive Objects:**
  - *The Dish Sink:* Triggers dinner dishwashing quest (`Q-004`).
  - *The Cutting Board / Prep Table:* Triggers meal prep assistant quest (`Q-002`).

#### 4. The Garden & Veranda (Stewardship & Creation Care)
- **Visual Narrative:** A sunlit wooden veranda (*batalan*) leading out to a small enclosed garden patch. Initially parched: clay pots with wilted ferns, dry dusty soil beds, and a latched timber gate.
- **Interactive Objects:**
  - *The Seedling Bed:* Triggers Quest #001 (*"Steward of the Garden"*).
  - *The Water Pump / Tap:* Used to fill the watering can.
  - *The Garden Gate:* Leads to the country trail toward the FOG Community Center (unlocked upon completing Quest #001).

---

### 2.2 Home Visual Progression (The Stewardship Evolution)

The visual state of the Home dynamically evolves as the player completes real-world domestic quests:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HOME VISUAL PROGRESSION                         │
├─────────┬──────────────────────┬───────────────────────────────────────┤
│ State   │ Trigger Milestone    │ Visual Environmental Changes          │
├─────────┼──────────────────────┼───────────────────────────────────────┤
│ State 0 │ New Player Start     │ Bed unmade; kitchen sink holds dishes;│
│ (Tired) │                      │ garden soil dusty brown; plants droop │
├─────────┼──────────────────────┼───────────────────────────────────────┤
│ State 1 │ Completed Quest #001 │ Garden soil darkens; first bright     │
│ (Awake) │ & Room Tidying       │ green sprout appears; bed made neatly │
├─────────┼──────────────────────┼───────────────────────────────────────┤
│ State 2 │ Completed 5 Home /   │ Kitchen sink clean & dry; desk neatly │
│ (Tended)│ Family Quests        │ organized; potted plants in full leaf │
├─────────┼──────────────────────┼───────────────────────────────────────┤
│ State 3 │ Completed 15 Home    │ Warm rug appears in living room;      │
│ (Lush)  │ Quests (Stewardship) │ flowering bougainvillea climbs porch; │
│         │                      │ garden beds full of healthy greens    │
└─────────┴──────────────────────┴───────────────────────────────────────┘
```

---

## 3. FOG Community Center (The Living Hub)

The FOG Community Center is the shared social, ministry, and fellowship hub of Koinonia Quest. It is modeled as a welcoming, open-air church campus featuring contemporary tropical timber-and-stucco architecture.

```
┌────────────────────────────────────────────────────────────────────────┐
│                     FOG COMMUNITY CENTER (CAMPUS MAP)                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│     ┌────────────────────────────────────────────────────────────┐     │
│     │               1. ENTRANCE PLAZA & VERANDA                  │     │
│     │   • Ate Joy's Welcome Desk    • Directional Cedar Signs    │     │
│     │   • Open Arched Gateway       • Shaded Benches             │     │
│     └─────────────────────────────┬──────────────────────────────┘     │
│                                   │                                    │
│         ┌─────────────────────────┴─────────────────────────┐          │
│         │                                                   │          │
│  ┌──────┴────────────────────┐             ┌────────────────┴───────┐  │
│  │     2. YOUTH HALL         │             │   3. COMMUNITY GARDEN  │  │
│  │  • Couches & Cafe Station │             │  • Collective XP Beds  │  │
│  │  • Main Quest Notice Board│             │  • Uncle Barnaby's Shed│  │
│  │  • Circle Fellowship Banners            │  • Stone Fountain      │  │
│  └──────┬────────────────────┘             └────────────────┬───────┘  │
│         │                                                   │          │
│  ┌──────┴────────────────────┐             ┌────────────────┴───────┐  │
│  │     4. ACTIVITY AREA      │             │  5. REFLECTION CORNER  │  │
│  │  • Ping-pong & Board Games│             │  • Quiet Jasmine Arbor │  │
│  │  • Marcus' Sports Station │             │  • Prayer Stone Cross  │  │
│  └───────────────────────────┘             └────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Campus Zones & Purpose
1. **The Entrance Plaza:** The threshold where newcomer avatars arrive. Ate Joy greets players from behind an open wooden reception counter draped with welcoming banners.
2. **The Youth Hall:** The social beating heart. Contains cozy modular seating, a coffee and tea hospitality station, and the **Grand Community Quest Board**.
3. **The Community Garden:** An expansive outdoor farming plot where the shared *Restore the Community Garden* project takes physical form.
4. **The Activity Area:** Outdoor covered pavilion with recreation tables and space for team fellowship activities.
5. **The Reflection Corner:** A serene, quiet arbor surrounded by bamboo screens, stone benches, and a rustic timber cross monument.

---

### 3.2 The 6-Stage Community Evolution

The entire FOG Community Center visually transforms for **all players** as the collective youth community logs real-world service and stewardship:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   6 STAGES OF COMMUNITY TRANSFORMATION                 │
├───────┬──────────────┬─────────────────────────────────────────────────┤
│ Stage │ Status Name  │ Visual Campus State                             │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│ St. 0 │ Basic /      │ Bare concrete floor; unpainted plywood walls;   │
│       │ Unfinished   │ empty dusty garden plot; folding metal chairs.  │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│ St. 1 │ Cleaned      │ Debris cleared; floors swept; garden soil tilled│
│       │              │ and composted; neat trash and recycling bins.   │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│ St. 2 │ Improved     │ Warm terracotta paint on walls; solid cedar     │
│       │              │ Quest Board installed; seedling rows in garden. │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│ St. 3 │ Active       │ Woven rugs in Youth Hall; cafe tea urn active;  │
│       │              │ climbing vines on arbor; small circle banners.  │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│ St. 4 │ Beautiful    │ Hanging woven string lights; flowering garden in│
│       │              │ harvest; acoustic wood panels in Youth Hall.    │
├───────┼──────────────┼─────────────────────────────────────────────────┤
│ St. 5 │ Thriving     │ Lush oasis garden with bubbling birdbath; full  │
│       │ Community Hub│ outdoor pavilion active; vibrant campus life!   │
└───────┴──────────────┴─────────────────────────────────────────────────┘
```

---

## 4. Community Project #001: The Community Garden Mosaic

### 4.1 Environmental Transformation (Visual Stages)
Project #001 (*"Restore the Community Garden"*) requires 500 Stewardship, 300 Teamwork, and 300 Service XP. The physical tilemap changes dynamically at each threshold:
- **0% (Neglected):** Dry brown earth, cracked clay tiles, broken fence slats, a dry watering trough.
- **20% (Cleared):** Debris and weeds removed, wooden perimeter fence repaired with new golden pine posts.
- **40% (Prepared):** Dark composted soil beds tilled into neat rows; stone irrigation channels laid.
- **60% (Planted):** Vibrant green seedling sprouts in all raised beds; wooden plant tags identifying herbs and vegetables.
- **80% (Growing):** Climbing tomato trellises, leafy spinach, and flowering marigolds that deter pests.
- **100% (Thriving):** Lush harvest ready for picking; a stone fountain with running water; wooden shade benches where avatars can sit together.

### 4.2 Non-Competitive Contributor Recognition: "The Garden Mosaic"
Rather than a competitive 1st/2nd/3rd place leaderboard, contributors are celebrated on **The Community Garden Mosaic Board**:
- The board features a beautifully painted tile mosaic of a garden tree.
- Every youth who contributes to the project has a carved wooden leaf inscribed with their first name (e.g., *Gabriel M.*, *Chloe S.*, *Marcus T.*) placed upon the mosaic.
- **Equal Honor:** All leaves share the same size and golden luster. The header reads:  
  **"We Built This Together — To God Be The Glory."**

---

## 5. Future World Expansions (Phases 3–5 Roadmap)

The world expands organically into a cohesive regional neighborhood:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        REGIONAL WORLD EXPANSION                        │
├───────────────────┬────────────────────────────────────────────────────┤
│ Location          │ Visual Theme & Narrative Purpose                   │
├───────────────────┼────────────────────────────────────────────────────┤
│ The Neighborhood  │ Residential streets, crosswalks, elder homes for   │
│                   │ visitation, community cleanup quests (`Q-012`).    │
├───────────────────┼────────────────────────────────────────────────────┤
│ Riverside Park    │ Natural stream, running trails, wellness paths,    │
│                   │ outdoor fitness and reflection zones (`Q-020`).    │
├───────────────────┼────────────────────────────────────────────────────┤
│ The School Quad   │ Campus lockers, library study tables, peer         │
│                   │ encouragement and academic integrity quests.       │
├───────────────────┼────────────────────────────────────────────────────┤
│ Creative Studio   │ Art easels, graphic tablets, printing press for    │
│                   │ worship slides and greeting cards (`Q-023`).       │
├───────────────────┼────────────────────────────────────────────────────┤
│ Music Room        │ Soundproofed cedar walls, upright piano, acoustic  │
│                   │ guitar stands, drum isolation booth (`Q-024`).     │
├───────────────────┼────────────────────────────────────────────────────┤
│ Tech & Sound Booth│ Mixing consoles, neatly coiled XLR cables, slide   │
│                   │ monitors, projector control hub (`Q-019`).         │
├───────────────────┼────────────────────────────────────────────────────┤
│ Community Kitchen │ Commercial stainless tables, soup kettles, bread   │
│                   │ ovens for fellowship feasts (`Q-002`, `Q-018`).    │
├───────────────────┼────────────────────────────────────────────────────┤
│ AYS Pavilion      │ Outdoor campfire ring and open-air gazebo for the  │
│                   │ Alpha Youth Series story campaign.                 │
├───────────────────┼────────────────────────────────────────────────────┤
│ Outreach Center   │ Food pantry shelving, clothing donation bins, and  │
│                   │ care package packing assembly tables (`Q-013`).    │
└───────────────────┴────────────────────────────────────────────────────┘
```
