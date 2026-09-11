/**
 * KOINONIA — PHASE 0.20.1
 * FOG ARCADE DATA & INTEGRATION MODULE
 *
 * Consolidation Shell:
 * Audited from FOG Staging (/home/raspi4/fog-portal-staging):
 * - public/seeker-arcade.html
 * - public/js/v8-slingshot.js, v8-noahs-ark.js, v8-red-sea.js, v8-peters-leap.js, v8-jonahs-dive.js
 * - public/js/v9-growth-games.js
 * - Backend: POST /api/arcade/submit, POST /api/growth-games/:game/submit
 * - Ledger & Points: gamification_points, point_transactions
 *
 * Koinonia Consolidation:
 * - FOG Arcade is presented as a first-class Koinonia experience destination.
 * - Unified Life Points economy (+5 LP per daily completion, non-gambling).
 * - Idempotent completion transactions via SharedCore.
 */

(function(root) {
  'use strict';

  const BIBLICAL_PHYSICS_GAMES = [
    {
      id: 'arcade_slingshot',
      title: "David's Slingshot",
      category: 'PHYSICS',
      icon: '🏹',
      scripture: '1 Samuel 17:49',
      tagline: 'Faith, Focus, and Trajectory',
      description: 'Calibrate angle and tension to launch smooth river stones with trust in the Lord against Goliath’s shield.',
      stagingSource: 'public/js/v8-slingshot.js',
      playableDemo: true,
      rewards: { lp: 5, charXp: 5, disciplineXp: 15 }
    },
    {
      id: 'arcade_noahs_ark',
      title: "Noah's Ark Balance",
      category: 'PHYSICS',
      icon: '🚢',
      scripture: 'Genesis 7:8-9',
      tagline: 'Center of Gravity on Rising Tides',
      description: 'Distribute pairs of creatures and food stores symmetrically to keep the ark level amidst turbulent waves.',
      stagingSource: 'public/js/v8-noahs-ark.js',
      playableDemo: false,
      rewards: { lp: 5, charXp: 5, stewardshipXp: 15 }
    },
    {
      id: 'arcade_red_sea',
      title: "Moses' Red Sea Crossing",
      category: 'PHYSICS',
      icon: '🌊',
      scripture: 'Exodus 14:21-22',
      tagline: 'Dry Seabed Navigation',
      description: 'Guide the pilgrim caravan through deep seabed ravines before the towering water walls collapse.',
      stagingSource: 'public/js/v8-red-sea.js',
      playableDemo: false,
      rewards: { lp: 5, charXp: 5, faithXp: 15 }
    },
    {
      id: 'arcade_peters_leap',
      title: "Peter's Leap of Faith",
      category: 'PHYSICS',
      icon: '🚶‍♂️',
      scripture: 'Matthew 14:29-30',
      tagline: 'Fixed Gaze Across the Waves',
      description: 'Step out onto churning sea foam, balancing composure and trust by keeping your view steadfastly on Christ.',
      stagingSource: 'public/js/v8-peters-leap.js',
      playableDemo: false,
      rewards: { lp: 5, charXp: 5, reflectionXp: 15 }
    },
    {
      id: 'arcade_jonahs_dive',
      title: "Jonah's Deep Dive",
      category: 'PHYSICS',
      icon: '🐋',
      scripture: 'Jonah 2:1-2',
      tagline: 'Subsurface Buoyancy & Repentance',
      description: 'Navigate subterranean sea currents and deep water pressure towards Nineveh shoreline deliverance.',
      stagingSource: 'public/js/v8-jonahs-dive.js',
      playableDemo: false,
      rewards: { lp: 5, charXp: 5, responsibilityXp: 15 }
    }
  ];

  const GROWTH_GAMES = [
    {
      id: 'growth_catechism_clash',
      title: 'Catechism Clash',
      category: 'GROWTH',
      icon: '⚡',
      description: 'Speed recall of Catholic doctrine, Sacraments, and Creed principles with gentle hints.',
      stagingSource: 'public/js/v9-growth-games.js',
      rewards: { lp: 5, charXp: 5, disciplineXp: 10 }
    },
    {
      id: 'growth_daily_manna',
      title: 'Daily Manna Word Puzzle',
      category: 'GROWTH',
      icon: '🥖',
      description: 'Unscramble daily Gospel verses and collect golden grain for your Pilgrim table.',
      stagingSource: 'public/js/v9-growth-games.js',
      rewards: { lp: 5, charXp: 5, stewardshipXp: 10 }
    },
    {
      id: 'growth_emoji_sermon',
      title: 'Emoji Sermon Pictionary',
      category: 'GROWTH',
      icon: '🎨',
      description: 'Identify famous parables and biblical scenes composed entirely of modern emoji symbols.',
      stagingSource: 'public/js/v9-growth-games.js',
      rewards: { lp: 5, charXp: 5, reflectionXp: 10 }
    },
    {
      id: 'growth_narrow_gate',
      title: 'The Narrow Gate Maze',
      category: 'GROWTH',
      icon: '🚪',
      description: 'Navigate maze pathways choosing virtues over worldly shortcuts to find the narrow gate.',
      stagingSource: 'public/js/v9-growth-games.js',
      rewards: { lp: 5, charXp: 5, disciplineXp: 10 }
    },
    {
      id: 'growth_shield_of_faith',
      title: 'Shield of Faith Defense',
      category: 'GROWTH',
      icon: '🛡️',
      description: 'Deflect fiery darts of temptation, despair, and cynicism using truth and prayer.',
      stagingSource: 'public/js/v9-growth-games.js',
      rewards: { lp: 5, charXp: 5, reflectionXp: 10 }
    },
    {
      id: 'growth_who_am_i',
      title: 'Who Am I? Biblical Persona',
      category: 'GROWTH',
      icon: '❓',
      description: 'Guess the prophet, apostle, martyr, or saint from progressive scripture clues.',
      stagingSource: 'public/js/v9-growth-games.js',
      rewards: { lp: 5, charXp: 5, reflectionXp: 10 }
    },
    {
      id: 'growth_would_you_rather',
      title: 'Would You Rather: Disciple Edition',
      category: 'GROWTH',
      icon: '⚖️',
      description: 'Thought-provoking ethical dilemmas and ministry choices for youth discussion.',
      stagingSource: 'public/js/v9-growth-games.js',
      rewards: { lp: 5, charXp: 5, responsibilityXp: 10 }
    },
    {
      id: 'growth_verse_chain',
      title: 'Verse Chain Memory Sprint',
      category: 'GROWTH',
      icon: '🔗',
      description: 'Chain scripture passages end-to-end by matching shared theological keywords.',
      stagingSource: 'public/js/v9-growth-games.js',
      rewards: { lp: 5, charXp: 5, disciplineXp: 10 }
    },
    {
      id: 'growth_group_clash',
      title: 'Group Clash Live Trivia',
      category: 'GROWTH',
      icon: '🏆',
      description: 'Real-time campfire fellowship trivia challenge for small-group team bonding.',
      stagingSource: 'public/js/v9-growth-games.js',
      rewards: { lp: 5, charXp: 5, teamworkXp: 10 }
    }
  ];

  const FAITH_QUEST_CHALLENGES = [
    {
      id: 'fq_catechism_clash',
      title: 'Catechism Clash',
      category: 'FAITH_QUEST',
      icon: '⚔️',
      tagline: 'Speed Doctrine & Bible Trivia',
      description: 'Rapid-fire questions on Scripture, Sacraments, and Christian doctrine with time-bonus multipliers.',
      stagingSource: 'public/seeker-arcade.html',
      rewards: { lp: 5, charXp: 5, faithXp: 15 }
    },
    {
      id: 'fq_narrow_gate',
      title: 'The Narrow Gate',
      category: 'FAITH_QUEST',
      icon: '🚪',
      tagline: 'Ethical Discernment & Virtue Decisions',
      description: 'Choose the narrow path when confronted with modern moral dilemmas and spiritual crossroads.',
      stagingSource: 'public/seeker-arcade.html',
      rewards: { lp: 5, charXp: 5, disciplineXp: 15 }
    },
    {
      id: 'fq_daily_manna',
      title: 'Daily Manna Scramble',
      category: 'FAITH_QUEST',
      icon: '🍞',
      tagline: 'Scripture Memory Word Puzzle',
      description: 'Unscramble daily Gospel verses and collect spiritual nourishment for your daily pilgrim walk.',
      stagingSource: 'public/seeker-arcade.html',
      rewards: { lp: 5, charXp: 5, stewardshipXp: 15 }
    },
    {
      id: 'fq_emoji_sermon',
      title: 'Emoji Sermon',
      category: 'FAITH_QUEST',
      icon: '😀',
      tagline: 'Visual Bible Decipher Challenge',
      description: 'Decode biblical parables and wisdom sayings expressed entirely in sequential emoji glyphs.',
      stagingSource: 'public/seeker-arcade.html',
      rewards: { lp: 5, charXp: 5, reflectionXp: 15 }
    },
    {
      id: 'fq_shield_of_faith',
      title: 'Shield of Faith',
      category: 'FAITH_QUEST',
      icon: '🛡️',
      tagline: 'Spiritual Armor Defense',
      description: 'Raise the shield of faith to deflect doubts, cynicism, and negative temptations.',
      stagingSource: 'public/seeker-arcade.html',
      rewards: { lp: 5, charXp: 5, faithXp: 15 }
    },
    {
      id: 'fq_fruits_of_spirit',
      title: 'Fruits of the Spirit',
      category: 'FAITH_QUEST',
      icon: '🍇',
      tagline: 'Virtue Pairing & Reflection',
      description: 'Match Galatians 5:22-23 virtues (love, joy, peace, patience...) to real-life challenges.',
      stagingSource: 'public/seeker-arcade.html',
      rewards: { lp: 5, charXp: 5, stewardshipXp: 15 }
    }
  ];

  const arcadeModule = {
    BIBLICAL_PHYSICS_GAMES,
    GROWTH_GAMES,
    FAITH_QUEST_CHALLENGES,
    getAllGames: function() {
      return [...BIBLICAL_PHYSICS_GAMES, ...GROWTH_GAMES, ...FAITH_QUEST_CHALLENGES];
    },
    getFaithQuestChallenges: function() {
      return [...FAITH_QUEST_CHALLENGES];
    },
    getGameById: function(id) {
      return this.getAllGames().find(g => g.id === id) || null;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = arcadeModule;
  }

  if (typeof root !== 'undefined') {
    root.KOINONIA_ARCADE = arcadeModule;
  }

})(typeof window !== 'undefined' ? window : global);
