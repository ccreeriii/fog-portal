/**
 * KOINONIA — PHASE 0.14 MODULAR QUEST ENGINE DATA STORE
 * Architecture: Data-driven Quest schema with requirements, steps, verifications,
 *               world effects, and state dialogue.
 * Canonical Community: Fire of God Ministries ('fog')
 */

(function () {
  'use strict';

  const QUEST_CATEGORIES = {
    STEWARDSHIP: { id: 'STEWARDSHIP', name: 'Domestic Stewardship', icon: '🌱', color: '#10B981' },
    FAMILY: { id: 'FAMILY', name: 'Family & Honor', icon: '🏡', color: '#EB5F12' },
    PRAYER: { id: 'PRAYER', name: 'Prayer & Gratitude', icon: '🙏', color: '#881337' },
    SERVICE: { id: 'SERVICE', name: 'Loving Service', icon: '🤝', color: '#D97706' },
    COMMUNITY: { id: 'COMMUNITY', name: 'Community Fellowship', icon: '⛪', color: '#2563EB' },
    SCHOOL: { id: 'SCHOOL', name: 'School Diligence', icon: '📚', color: '#7C3AED' },
    FITNESS: { id: 'FITNESS', name: 'Health & Vitality', icon: '🏃', color: '#059669' },
    MINISTRY: { id: 'MINISTRY', name: 'Church Ministry', icon: '✨', color: '#DC2626' },
    OUTREACH: { id: 'OUTREACH', name: 'Compassion & Outreach', icon: '🍞', color: '#EA580C' },
    PERSONAL_GROWTH: { id: 'PERSONAL_GROWTH', name: 'Personal Reflection', icon: '📖', color: '#4B5563' }
  };

  const VERIFICATION_TYPES = {
    TRUST: {
      id: 'TRUST',
      name: 'Trust Self-Certification',
      description: 'Player self-certifies completion in honesty before God and family.',
      requiresReflection: false
    },
    REFLECTION: {
      id: 'REFLECTION',
      name: 'Personal Reflection',
      description: 'Player writes a short personal reflection on what they learned.',
      requiresReflection: true
    },
    TRUST_PLUS_REFLECTION: {
      id: 'TRUST_PLUS_REFLECTION',
      name: 'Trust + Reflection',
      description: 'Self-certification accompanied by a written reflection note.',
      requiresReflection: true
    },
    FAMILY_CONFIRM: {
      id: 'FAMILY_CONFIRM',
      name: 'Family Confirmation',
      description: 'A household member or parent verbally confirms the chore was completed.',
      requiresReflection: false
    },
    LEADER_CONFIRM: {
      id: 'LEADER_CONFIRM',
      name: 'Ministry Leader Confirmation',
      description: 'A ministry mentor or youth leader confirms community service.',
      requiresReflection: false
    },
    EVENT_ATTENDANCE: {
      id: 'EVENT_ATTENDANCE',
      name: 'Event Attendance',
      description: 'Participation in physical worship gathering or community event.',
      requiresReflection: false
    }
  };

  const QUESTS = [
    // ============================================================
    // QUEST 001: STEWARD OF THE GARDEN (Canonical Migration)
    // ============================================================
    {
      id: 'Q-001',
      communityId: 'fog',
      title: 'Steward of the Garden',
      subtitle: 'Domestic Stewardship • Veranda & Garden',
      description: 'Water the potted plants at home to care for living creation right outside your window.',
      category: 'STEWARDSHIP',
      placeId: 'home',
      giverNpcId: 'barnaby',

      requirements: [],

      steps: [
        {
          id: 'step_1',
          type: 'TALK_TO_NPC',
          title: 'Consult Uncle Barnaby',
          description: 'Talk to Uncle Barnaby at the veranda to receive your garden calling.',
          npcId: 'barnaby'
        },
        {
          id: 'step_2',
          type: 'REAL_WORLD_ACTION',
          title: 'Care for Living Creation',
          description: 'Water potted plants or refill pet water in the physical world.',
          actionPrompt: 'Water the potted plants at home to nurture living creation right outside your window.',
          choices: [
            'Water potted plants on your veranda, balcony, or windowsill',
            'Tend a small houseplant, seedling, or garden plot',
            'Refill clean drinking water for a family pet or bird bath'
          ]
        },
        {
          id: 'step_3',
          type: 'REFLECTION',
          title: 'Faithful Reflection',
          description: 'Reflect on quiet stewardship and receive the garden blessing.',
          prompt: 'One small thing I noticed while doing this was...',
          verification: {
            type: 'TRUST_PLUS_REFLECTION',
            requiresReflection: true
          }
        }
      ],

      verification: {
        type: 'TRUST_PLUS_REFLECTION',
        label: 'Trust + Reflection',
        prompt: 'One small thing I noticed while doing this was...',
        requiresReflection: true
      },

      rewards: {
        lifePoints: 5,
        characterXp: 5,
        skills: {
          stewardship: 15,
          responsibility: 5
        }
      },

      unlocks: ['fog_center'],
      repeatable: false,
      cooldown: null,

      stateDialogue: {
        available: '"Peace be with you, Alex! The plants on our veranda are looking thirsty today. Faithful stewardship begins at home in small, quiet chores."',
        active: "\"Remember, Alex: real stewardship isn't finished on this screen. Step outside, water those living plants, and come back when you're done!\"",
        completed: '"Glory to God! Look how lush and vibrant our garden is now. Because you were faithful in this small duty, the perimeter gate is unlocked. Walk south to visit the FOG Community Center!"'
      },

      worldEffects: [
        { type: 'SET_FLAG', flag: 'gardenState', value: 'lush' },
        { type: 'SET_FLAG', flag: 'gateOpen', value: true },
        { type: 'UNLOCK_PLACE', placeId: 'fog_center' }
      ],

      tags: ['stewardship', 'garden', 'home', 'creation_care']
    },

    // ============================================================
    // QUEST 002: LIGHT AT HOME
    // ============================================================
    {
      id: 'Q-002',
      communityId: 'fog',
      title: 'Light at Home',
      subtitle: 'Family Service • Living Area & Kitchen',
      description: 'Perform one small act of helpfulness for someone in your household without waiting to be asked.',
      category: 'FAMILY',
      placeId: 'home',
      giverNpcId: 'barnaby',

      requirements: [
        { type: 'QUEST_COMPLETED', questId: 'Q-001' }
      ],

      steps: [
        {
          id: 'step_1',
          type: 'TALK_TO_NPC',
          title: 'Speak with Uncle Barnaby',
          description: 'Receive the household blessing from Uncle Barnaby.',
          npcId: 'barnaby'
        },
        {
          id: 'step_2',
          type: 'REAL_WORLD_ACTION',
          title: 'Household Act of Service',
          description: 'Perform one helpful chore or assist someone in your home.',
          actionPrompt: 'Look around your home and perform one unprompted act of kindness or service.',
          choices: [
            'Clear and wipe down the dining table after a family meal',
            'Organize shoes, bags, or books in a shared family space',
            'Help wash, dry, or put away kitchen dishes',
            'Help a parent, sibling, or guardian with a household chore'
          ]
        },
        {
          id: 'step_3',
          type: 'REFLECTION',
          title: 'Quiet Reflection',
          description: 'Share who your action blessed today.',
          prompt: 'Who did your action help, and how did it bring peace to your home?',
          verification: {
            type: 'TRUST',
            optionalPrompt: 'Who did your action help, and how did it bring peace to your home?',
            requiresReflection: false
          }
        }
      ],

      verification: {
        type: 'TRUST',
        label: 'Trust Self-Certification',
        optionalPrompt: 'Who did your action help, and how did it bring peace to your home?',
        requiresReflection: false
      },

      rewards: {
        lifePoints: 5,
        characterXp: 5,
        skills: {
          responsibility: 10,
          service: 10
        }
      },

      unlocks: [],
      repeatable: false,
      cooldown: null,

      stateDialogue: {
        available: '"Alex, Christ teaches us to let our light shine right at home. In our fellowship, serving our family quietly is as sacred as ministry on a stage. Will you be a light at home today?"',
        active: '"Look around your house with open eyes, Alex. Find one small way to help your family without waiting to be asked, then return and share with me."',
        completed: '"The Lord bless your servant heart, Alex! Small acts of loving service at home build foundations that last a lifetime."'
      },

      worldEffects: [
        { type: 'ADD_MEMORY', title: 'Light at Home', description: 'Served household quietly in Christian love.' }
      ],

      tags: ['family', 'service', 'home', 'honor']
    },

    // ============================================================
    // QUEST 003: A QUIET MOMENT
    // ============================================================
    {
      id: 'Q-003',
      communityId: 'fog',
      title: 'A Quiet Moment',
      subtitle: 'Prayer & Gratitude • FOG Center Prayer Cross',
      description: 'Spend a short intentional moment in quiet prayer, gratitude, Scripture reflection, or peaceful silence.',
      category: 'PRAYER',
      placeId: 'fog_center',
      giverNpcId: 'sister_grace',

      requirements: [
        { type: 'QUEST_COMPLETED', questId: 'Q-001' },
        { type: 'PLACE_VISITED', placeId: 'fog_center' }
      ],

      steps: [
        {
          id: 'step_1',
          type: 'TALK_TO_NPC',
          title: 'Greet Sister Grace',
          description: 'Talk to Sister Grace near the FOG Community Center welcome station.',
          npcId: 'sister_grace'
        },
        {
          id: 'step_2',
          type: 'REAL_WORLD_ACTION',
          title: 'Step into Peaceful Stillness',
          description: 'Spend 2-3 quiet intentional minutes away from phone notifications.',
          actionPrompt: 'Step away from your screen for a short moment of quiet gratitude or prayer.',
          choices: [
            'Pray silently, thanking God for 3 concrete blessings today',
            'Read a peaceful Scripture passage slowly (e.g. Psalm 23 or Colossians 3:12)',
            'Spend 2 minutes in peaceful, grateful silence breathing deeply'
          ]
        },
        {
          id: 'step_3',
          type: 'REFLECTION',
          title: 'Heart of Gratitude',
          description: 'Reflect on one blessing that brought peace to your heart.',
          prompt: 'What are you grateful for today?',
          verification: {
            type: 'TRUST',
            optionalPrompt: 'What are you grateful for today?',
            requiresReflection: false
          }
        }
      ],

      verification: {
        type: 'TRUST',
        label: 'Trust Self-Certification',
        optionalPrompt: 'What are you grateful for today?',
        requiresReflection: false
      },

      rewards: {
        lifePoints: 5,
        characterXp: 5,
        skills: {
          reflection: 10
        }
      },

      unlocks: [],
      repeatable: false,
      cooldown: null,

      stateDialogue: {
        available: "\"Welcome to our church home, Alex! In our busy schedules, Jesus often withdrew to quiet places to pray. Would you like to take a quiet moment today to rest in God's peace?\"",
        active: '"Set aside your phone for just two minutes. Rest quietly in gratitude, and return whenever your heart feels still."',
        completed: '"Glory to God, Alex! Even two minutes of quiet gratitude can anchor your spirit for the whole week. Walk with that peace."'
      },

      worldEffects: [
        { type: 'ADD_MEMORY', title: 'A Quiet Moment', description: 'Paused for intentional gratitude and quiet prayer.' }
      ],

      tags: ['prayer', 'gratitude', 'reflection', 'stillness']
    },

    // ============================================================
    // QUEST 004: NOTICE BOARD FELLOWSHIP (Future Library Proof)
    // ============================================================
    {
      id: 'Q-004',
      communityId: 'fog',
      title: 'Notice Board Fellowship',
      subtitle: 'Community Service • Fellowship Hall',
      description: 'Check the youth notice board and write a brief note of encouragement for a friend.',
      category: 'COMMUNITY',
      placeId: 'fog_center',
      giverNpcId: 'sister_grace',
      requirements: [
        { type: 'QUEST_COMPLETED', questId: 'Q-003' }
      ],
      steps: [
        { id: 's1', type: 'INTERACT_OBJECT', objectId: 'center_board', description: 'Inspect the community notice board' },
        { id: 's2', type: 'REAL_WORLD_ACTION', actionPrompt: 'Send or write a kind message of encouragement to someone who needs uplift today.' },
        { id: 's3', type: 'REFLECTION', prompt: 'How did encouraging someone brighten their day?' }
      ],
      verification: { type: 'TRUST', label: 'Trust Self-Certification', requiresReflection: false },
      rewards: { lifePoints: 5, characterXp: 5, skills: { teamwork: 10, service: 10 } },
      unlocks: [],
      repeatable: false,
      cooldown: null,
      stateDialogue: {
        available: '"Alex, encouraging our peers is one of the highest forms of Christian fellowship. Check the notice board!"',
        active: '"Write a sincere word of encouragement to a brother or sister."',
        completed: '"A word fitly spoken is like apples of gold in settings of silver!"'
      },
      worldEffects: [],
      tags: ['community', 'fellowship', 'encouragement']
    },

    // ============================================================
    // QUEST 005: FOCUSED STUDY HAVEN (School Category Proof)
    // ============================================================
    {
      id: 'Q-005',
      communityId: 'fog',
      title: 'Orderly Homework Haven',
      subtitle: 'School Diligence • Study Desk',
      description: 'Organize your study desk and complete 25 minutes of focused study without phone distraction.',
      category: 'SCHOOL',
      placeId: 'home',
      giverNpcId: 'barnaby',
      requirements: [
        { type: 'QUEST_COMPLETED', questId: 'Q-002' }
      ],
      steps: [
        { id: 's1', type: 'TALK_TO_NPC', npcId: 'barnaby', description: 'Talk to Uncle Barnaby' },
        { id: 's2', type: 'REAL_WORLD_ACTION', actionPrompt: 'Clear your desk and study with full attention for 25 minutes.' },
        { id: 's3', type: 'REFLECTION', prompt: 'What helped you stay focused?' }
      ],
      verification: { type: 'TRUST', label: 'Trust Self-Certification', requiresReflection: false },
      rewards: { lifePoints: 5, characterXp: 5, skills: { discipline: 10, responsibility: 5 } },
      unlocks: [],
      repeatable: false,
      cooldown: null,
      stateDialogue: {
        available: '"Diligence in your studies honors God, Alex! Let us set up a focused study haven today."',
        active: '"Tidy your desk, put away distractions, and study faithfully."',
        completed: '"Well done! Whatever your hand finds to do, do it with all your might."'
      },
      worldEffects: [],
      tags: ['school', 'discipline', 'study']
    }
  ];

  // Ensure normalized fields and aliases for engine flexibility
  QUESTS.forEach(q => {
    q.prerequisites = q.requirements || [];
    q.giverId = q.giverNpcId;
    if (q.giverNpcId === 'sister_grace') {
      q.giverName = 'Sister Grace';
    } else if (q.giverNpcId === 'barnaby') {
      q.giverName = 'Uncle Barnaby';
    } else if (q.giverNpcId === 'teacher_mia') {
      q.giverName = 'Teacher Mia';
    } else if (q.giverNpcId === 'coach_daniel') {
      q.giverName = 'Coach Daniel';
    } else if (q.giverNpcId === 'ate_maria') {
      q.giverName = 'Ate Maria';
    }
    const cat = QUEST_CATEGORIES[q.category];
    if (cat) {
      q.icon = cat.icon;
      q.categoryTitle = cat.name;
    }
    if (q.steps && q.steps[1] && q.steps[1].actionPrompt) {
      q.realWorldAction = q.steps[1].actionPrompt;
    } else {
      q.realWorldAction = q.description;
    }
    if (q.steps && q.steps[1] && q.steps[1].choices) {
      q.realWorldFallbacks = q.steps[1].choices;
    }
    if (q.rewards) {
      if (typeof q.rewards.lifePoints === 'number' && typeof q.rewards.lp !== 'number') {
        q.rewards.lp = q.rewards.lifePoints;
      }
      if (typeof q.rewards.characterXp === 'number' && typeof q.rewards.charXp !== 'number') {
        q.rewards.charXp = q.rewards.characterXp;
      }
      if (q.rewards.skills) {
        if (typeof q.rewards.skills.stewardship === 'number') q.rewards.stewardshipXp = q.rewards.skills.stewardship;
        if (typeof q.rewards.skills.responsibility === 'number') q.rewards.responsibilityXp = q.rewards.skills.responsibility;
        if (typeof q.rewards.skills.service === 'number') q.rewards.serviceXp = q.rewards.skills.service;
        if (typeof q.rewards.skills.reflection === 'number') q.rewards.reflectionXp = q.rewards.skills.reflection;
      }
    }
    if (Array.isArray(q.worldEffects)) {
      for (const eff of q.worldEffects) {
        if (eff.flag === 'gardenState' && eff.value === 'lush') q.worldEffects.gardenLush = true;
        if (eff.flag === 'gateOpen' && eff.value === true) q.worldEffects.gateOpen = true;
        if (eff.type === 'UNLOCK_PLACE' && eff.placeId === 'fog_center') q.worldEffects.fogCenterUnlocked = true;
      }
    }
    if (q.verification) {
      if (q.verification.type === 'TRUST_PLUS_REFLECTION' || q.verification.type === 'REFLECTION') {
        if (q.verification.requiresReflection === undefined) q.verification.requiresReflection = true;
      } else if (q.verification.type === 'TRUST') {
        if (q.verification.requiresReflection === undefined) q.verification.requiresReflection = false;
      }
    }
  });

  const QUEST_STATUS = {
    LOCKED: 'LOCKED',
    AVAILABLE: 'AVAILABLE',
    ACCEPTED: 'ACCEPTED',
    REAL_WORLD: 'REAL_WORLD',
    RETURNED: 'RETURNED',
    VERIFYING: 'VERIFYING',
    COMPLETED: 'COMPLETED'
  };

  const QUEST_VERIFICATION_TYPES = VERIFICATION_TYPES;
  const QUEST_DEFINITIONS = QUESTS;

  // Helper utility functions
  function getQuestById(id) {
    if (!id) return null;
    const search = String(id).toUpperCase();
    return QUESTS.find(q => q.id.toUpperCase() === search) || null;
  }

  function getQuestsByGiver(npcId) {
    if (!npcId) return [];
    const search = String(npcId).toLowerCase();
    return QUESTS.filter(q => {
      const g = (q.giverNpcId || q.giverId || '').toLowerCase();
      return g === search || (search === 'grace' && g === 'sister_grace');
    });
  }

  function getQuestsByCategory(category) {
    if (!category) return [];
    const search = String(category).toUpperCase();
    return QUESTS.filter(q => String(q.category).toUpperCase() === search);
  }

  // Node module exports for unit testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      QUESTS,
      QUEST_DEFINITIONS,
      QUEST_CATEGORIES,
      VERIFICATION_TYPES,
      QUEST_VERIFICATION_TYPES,
      QUEST_STATUS,
      getQuestById,
      getQuestsByGiver,
      getQuestsByCategory
    };
  }

  // Browser global exports
  const root = typeof window !== 'undefined' ? window : global;
  if (!root.KOINONIA_DATA) root.KOINONIA_DATA = {};
  root.KOINONIA_DATA.quests = QUESTS;
  root.KOINONIA_DATA.questDefinitions = QUEST_DEFINITIONS;
  root.KOINONIA_DATA.questCategories = QUEST_CATEGORIES;
  root.KOINONIA_DATA.verificationTypes = VERIFICATION_TYPES;
  root.KOINONIA_DATA.questVerificationTypes = QUEST_VERIFICATION_TYPES;
  root.KOINONIA_DATA.questStatus = QUEST_STATUS;
  root.KOINONIA_DATA.getQuestById = getQuestById;
  root.KOINONIA_DATA.getQuestsByGiver = getQuestsByGiver;
  root.KOINONIA_DATA.getQuestsByCategory = getQuestsByCategory;

})();
