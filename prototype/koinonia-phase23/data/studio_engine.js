/**
 * KOINONIA — PHASE 0.21
 * KOINONIA STUDIO ENGINE
 * Safe, Template-Driven, No-Code Content Creation
 *
 * Core Capabilities:
 * 1. Role-based access control (MEMBER denied; ADMIN create/edit; SUPERADMIN approve/publish).
 * 2. Predefined structured template schemas (Quest, Event, Campaign, Campfire Activity, Ministry Mission).
 * 3. Strict schema validation & bounded ranges (LP: 0-50, Char XP: 0-100, Skill XP: 0-100).
 * 4. Security sanitization: Zero arbitrary HTML, Zero CSS, Zero JS, Zero iframes, Zero embeds.
 * 5. Safe draft storage with autosave (localStorage key: 'koinonia_phase21_studio_drafts').
 * 6. Multi-step publishing workflow (DRAFT -> READY_FOR_REVIEW -> APPROVED -> PUBLISHED).
 * 7. Safe media reference library (PNG, JPG, WEBP only; metadata references only; no binary blobs in DB).
 * 8. Prototype audit logging (actor, action, draftId, timestamp).
 * 9. Reflection privacy protection (prompts authored, responses private by default).
 * 10. Shared Core boundary protection (authoring layer only; zero mutation of members, LP, attendance).
 *
 * Compatibility: Universal module export (Node.js CommonJS & Browser window.KoinoniaStudio).
 */

(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KoinoniaStudio = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // ============================================================
  // 1. CONSTANTS & BOUNDS
  // ============================================================
  const COMMUNITY_ID = 'fog';
  const CANONICAL_TIMEZONE = 'Asia/Manila';

  const STORAGE_KEYS = {
    DRAFTS: 'koinonia_phase21_studio_drafts',
    PUBLISHED: 'koinonia_phase21_studio_published',
    AUDIT: 'koinonia_phase21_studio_audit_log',
    CUSTOM_PLACES: 'koinonia_phase21_custom_places'
  };

  const ROLES = {
    MEMBER: 'MEMBER',
    ADMIN: 'ADMIN',
    SUPERADMIN: 'SUPERADMIN'
  };

  const DRAFT_STATUS = {
    DRAFT: 'DRAFT',
    READY_FOR_REVIEW: 'READY_FOR_REVIEW',
    APPROVED: 'APPROVED',
    PUBLISHED: 'PUBLISHED',
    ARCHIVED: 'ARCHIVED'
  };

  const AUDIT_ACTIONS = {
    DRAFT_CREATED: 'DRAFT_CREATED',
    DRAFT_UPDATED: 'DRAFT_UPDATED',
    REVIEW_REQUESTED: 'REVIEW_REQUESTED',
    APPROVED: 'APPROVED',
    PUBLISHED: 'PUBLISHED',
    ARCHIVED: 'ARCHIVED',
    DRAFT_DELETED: 'DRAFT_DELETED'
  };

  const LIMITS = {
    MAX_TITLE_LENGTH: 80,
    MAX_SHORT_DESC_LENGTH: 160,
    MAX_LONG_DESC_LENGTH: 2000,
    MAX_REFLECTION_LENGTH: 500,
    MIN_LP: 0,
    MAX_LP: 50,
    MIN_XP: 0,
    MAX_CHAR_XP: 100,
    MAX_SKILL_XP: 100
  };

  const PLACE_TYPES = [
    'Home',
    'Church / Community Center',
    'School',
    'Sports / Recreation',
    'Outreach / Service',
    'Ministry Venue',
    'Other'
  ];

  const PLACE_TYPE_ICONS = {
    'Home': '🏡',
    'Church / Community Center': '⛪',
    'School': '🏫',
    'Sports / Recreation': '⚽',
    'Outreach / Service': '🌿',
    'Ministry Venue': '🏛️',
    'Other': '📍'
  };

  const CANONICAL_PLACES = [
    { id: 'home', name: 'Pilgrim Home', icon: '🏡', type: 'Home' },
    { id: 'fog_center', name: 'FOG Center', altName: 'FOG Community Center', icon: '🏛️', type: 'Church / Community Center' },
    { id: 'school', name: 'School Campus', altName: 'St. Timothy Academy', icon: '🏫', type: 'School' },
    { id: 'sports_hub', name: 'Sports Hub', altName: 'Faith & Athletics Hub', icon: '⚽', type: 'Sports / Recreation' },
    { id: 'outreach_site', name: 'Outreach Site', altName: 'Mission Outreach Field', icon: '🌿', type: 'Outreach / Service' }
  ];

  const CANONICAL_PLACE_NAME_ALIASES = [
    'pilgrim home', 'home', 'my home',
    'fog center', 'fog community center', 'fog',
    'school campus', 'st. timothy academy', 'school',
    'sports hub', 'faith & athletics hub', 'sports',
    'outreach site', 'mission outreach field', 'outreach'
  ];

  const CANONICAL_AUDIENCES = [
    { id: 'all', label: 'All Community Members' },
    { id: 'youth', label: 'Youth Pilgrims (Ages 12-18)' },
    { id: 'young_adults', label: 'Young Adults' },
    { id: 'leaders', label: 'Ministry Leaders & Servants' }
  ];

  const CANONICAL_MINISTRIES = [
    { id: 'worship', name: 'Worship & Music Ministry', icon: '🎵' },
    { id: 'multimedia', name: 'Media & Production Ministry', icon: '🎥' },
    { id: 'hospitality', name: 'Agape Hospitality Ministry', icon: '🤝' },
    { id: 'intercession', name: 'Armor of Prayer Intercession', icon: '🙏' },
    { id: 'outreach', name: 'Mission & Compassion Outreach', icon: '🌾' }
  ];

  const CANONICAL_CAMPFIRES = [
    { id: 'cf_alpha_seed', name: 'Fire of God Alpha Seed', icon: '🔥' },
    { id: 'cf_shepherds', name: 'Good Shepherd Circle', icon: '🐑' },
    { id: 'cf_living_water', name: 'Living Water Fellowship', icon: '💧' }
  ];

  const PRESENTATION_TARGETS = [
    { id: 'KOINONIA', label: 'Koinonia In-World Only' },
    { id: 'MAIN_APP', label: 'Main FOG Portal Only' },
    { id: 'BOTH', label: 'Both Koinonia & Main Portal' }
  ];

  const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  // ============================================================
  // 2. SAFE DEMO MEDIA LIBRARY (METADATA-ONLY)
  // ============================================================
  const DEMO_MEDIA_LIBRARY = [
    {
      id: 'media_logo_header',
      communityId: COMMUNITY_ID,
      title: 'Official Koinonia Header Logo',
      filename: 'koinonia-header-logo.png',
      mimeType: 'image/png',
      storageKey: 'assets/branding/koinonia-header-logo.png',
      url: 'assets/branding/koinonia-header-logo.png',
      category: 'branding',
      aspectRatio: 'banner'
    },
    {
      id: 'media_app_icon',
      communityId: COMMUNITY_ID,
      title: 'Koinonia Official Shield Icon',
      filename: 'koinonia-app-icon.png',
      mimeType: 'image/png',
      storageKey: 'assets/branding/koinonia-app-icon.png',
      url: 'assets/branding/koinonia-app-icon.png',
      category: 'branding',
      aspectRatio: 'square'
    },
    {
      id: 'media_place_fog_center',
      communityId: COMMUNITY_ID,
      title: 'FOG Community Center Banner',
      filename: 'place-fog-center.png',
      mimeType: 'image/png',
      storageKey: 'assets/places/fog_center.png',
      url: 'assets/branding/koinonia-header-logo.png', // fallback
      category: 'places',
      aspectRatio: 'landscape'
    },
    {
      id: 'media_place_sports_hub',
      communityId: COMMUNITY_ID,
      title: 'Faith & Athletics Hub Banner',
      filename: 'place-sports-hub.png',
      mimeType: 'image/png',
      storageKey: 'assets/places/sports_hub.png',
      url: 'assets/branding/koinonia-header-logo.png',
      category: 'places',
      aspectRatio: 'landscape'
    }
  ];

  // ============================================================
  // 3. SECURITY SANITIZER & CODE INJECTION DEFENSE
  // ============================================================
  /**
   * Strictly inspects any input string for malicious markup, scripts,
   * style tags, iframes, eval, javascript: or event handlers.
   * Returns { safe: boolean, reason?: string }
   */
  function inspectSafety(input) {
    if (typeof input !== 'string') return { safe: true };
    const str = input.toLowerCase();

    // 1. Script tags
    if (/<script\b/i.test(input) || str.includes('<script')) {
      return { safe: false, reason: 'Script execution tags (<script>) are strictly forbidden.' };
    }
    // 2. Iframes
    if (/<iframe\b/i.test(input) || str.includes('<iframe')) {
      return { safe: false, reason: 'Iframe embedding (<iframe>) is strictly forbidden.' };
    }
    // 3. CSS Style/Link injection
    if (str.includes('<style') || str.includes('<link') || str.includes('@import')) {
      return { safe: false, reason: 'Arbitrary CSS/stylesheet injection is strictly forbidden.' };
    }
    // 4. Inline DOM event handlers (onclick=, onload=, onerror=, etc.)
    if (/\bon\w+\s*=/i.test(input)) {
      return { safe: false, reason: 'Inline DOM event handlers (e.g. onclick, onload) are strictly forbidden.' };
    }
    // 5. Executable protocol URIs
    if (str.includes('javascript:') || str.includes('vbscript:') || str.includes('data:text/html')) {
      return { safe: false, reason: 'Executable protocol URIs (javascript:, data:text/html) are forbidden.' };
    }
    // 6. Eval or dynamic code execution
    if (/\b(?:eval|document\.cookie|window\.location)\b/i.test(input) || str.includes('eval(')) {
      return { safe: false, reason: 'Dynamic code execution patterns (eval, cookie access) are forbidden.' };
    }
    // 7. Any other raw HTML markup
    if (/<[a-z][\s\S]*>/i.test(input)) {
      return { safe: false, reason: 'Raw HTML markup is not permitted. Please use plain text.' };
    }

    return { safe: true };
  }

  function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function decodeLegacyHtmlEntities(str) {
    if (typeof str !== 'string') return str;
    let decoded = str;
    // Handle double-encoded entities first
    decoded = decoded.replace(/&amp;#039;/g, "'")
                     .replace(/&amp;apos;/g, "'")
                     .replace(/&amp;quot;/g, '"')
                     .replace(/&amp;amp;/g, '&')
                     .replace(/&amp;lt;/g, '<')
                     .replace(/&amp;gt;/g, '>');
    // Handle single-encoded entities
    decoded = decoded.replace(/&#039;/g, "'")
                     .replace(/&apos;/g, "'")
                     .replace(/&quot;/g, '"')
                     .replace(/&lt;/g, '<')
                     .replace(/&gt;/g, '>')
                     .replace(/&amp;/g, '&');
    return decoded;
  }

  function cleanLegacyObject(obj) {
    if (!obj || typeof obj !== 'object') {
      return typeof obj === 'string' ? decodeLegacyHtmlEntities(obj) : obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => cleanLegacyObject(item));
    }
    const cleaned = {};
    for (const [key, val] of Object.entries(obj)) {
      cleaned[key] = cleanLegacyObject(val);
    }
    return cleaned;
  }

  // ============================================================
  // 4. TEMPLATE DEFINITIONS & SCHEMAS
  // ============================================================
  const TEMPLATES = {
    QUEST: {
      id: 'QUEST',
      label: '📜 QUEST',
      icon: '📜',
      version: '1.0',
      description: 'Create a real-world Koinonia quest',
      fields: [
        { key: 'title', type: 'text', label: 'Quest Title', required: true, maxLength: LIMITS.MAX_TITLE_LENGTH, placeholder: 'e.g. Morning Prayer Walk' },
        { key: 'shortDesc', type: 'text', label: 'Short Summary', required: true, maxLength: LIMITS.MAX_SHORT_DESC_LENGTH, placeholder: 'Brief one-line summary for cards and notifications' },
        { key: 'longDesc', type: 'textarea', label: 'Full Description & Context', required: true, maxLength: LIMITS.MAX_LONG_DESC_LENGTH, placeholder: 'Detailed spiritual background and purpose' },
        { key: 'placeId', type: 'select', label: 'Koinonia Place', required: true, get options() { return getPlaceOptions(); } },
        { key: 'category', type: 'select', label: 'Ministry Category', required: true, options: [
          { value: 'Faith & Stewardship', label: '🌱 Faith & Stewardship' },
          { value: 'Community Fellowship', label: '🤝 Community Fellowship' },
          { value: 'Scripture & Prayer', label: '📖 Scripture & Prayer' },
          { value: 'Sports & Fitness', label: '⚽ Sports & Athletics' },
          { value: 'Service & Outreach', label: '🌾 Service & Outreach' }
        ]},
        { key: 'audience', type: 'select', label: 'Target Audience', required: true, options: CANONICAL_AUDIENCES.map(a => ({ value: a.id, label: a.label })) },
        { key: 'difficulty', type: 'select', label: 'Difficulty', required: true, options: [
          { value: 'easy', label: '🟢 Gentle / Accessible' },
          { value: 'medium', label: '🟡 Balanced' },
          { value: 'challenging', label: '🔴 Dedicated Effort' }
        ]},
        { key: 'estimatedMinutes', type: 'number', label: 'Estimated Time (Minutes)', required: true, min: 5, max: 180, default: 30 },
        { key: 'realWorldAction', type: 'textarea', label: 'Real-World Stewardship Action', required: true, maxLength: 500, placeholder: 'Describe what the member must physically do in the real world' },
        { key: 'reflectionPrompt', type: 'textarea', label: 'Reflection Prompt', required: true, maxLength: LIMITS.MAX_REFLECTION_LENGTH, placeholder: 'Prompt for member personal prayer or reflection (responses remain private)' },
        { key: 'verificationMethod', type: 'select', label: 'Verification Method', required: true, options: [
          { value: 'self_reflection', label: 'Personal Reflection (Honesty-based)' },
          { value: 'leader_checkin', label: 'Leader Confirmation' },
          { value: 'family_affirmation', label: 'Family / Parent Confirmation' }
        ]},
        { key: 'lifePoints', type: 'number', label: 'Life Points Reward (0-50 LP)', required: true, min: LIMITS.MIN_LP, max: LIMITS.MAX_LP, default: 15 },
        { key: 'characterXp', type: 'number', label: 'Character XP (0-100)', required: true, min: LIMITS.MIN_XP, max: LIMITS.MAX_CHAR_XP, default: 25 },
        { key: 'skillXp', type: 'number', label: 'Skill XP (0-100)', required: true, min: LIMITS.MIN_XP, max: LIMITS.MAX_SKILL_XP, default: 20 },
        { key: 'completionMessage', type: 'text', label: 'Completion Blessing', required: true, maxLength: 160, placeholder: 'e.g. Well done, faithful pilgrim! Your small action bears eternal fruit.' },
        { key: 'startDate', type: 'date', label: 'Start Date', required: true },
        { key: 'endDate', type: 'date', label: 'End Date (Optional)', required: false },
        { key: 'presentationTarget', type: 'select', label: 'Presentation Target', required: true, options: PRESENTATION_TARGETS.map(t => ({ value: t.id, label: t.label })), default: 'KOINONIA' }
      ]
    },

    EVENT: {
      id: 'EVENT',
      label: 'Community Event / Gathering',
      icon: '📅',
      version: '1.0',
      description: 'Create a church service, youth night, sports tournament, or fellowship gathering.',
      fields: [
        { key: 'title', type: 'text', label: 'Event Title', required: true, maxLength: LIMITS.MAX_TITLE_LENGTH, placeholder: 'e.g. Fire of God Youth Night' },
        { key: 'description', type: 'textarea', label: 'Description & Invitation', required: true, maxLength: LIMITS.MAX_LONG_DESC_LENGTH, placeholder: 'Explain what will happen and why members should attend' },
        { key: 'placeId', type: 'select', label: 'Koinonia In-World Venue', required: true, get options() { return getPlaceOptions(); } },
        { key: 'realWorldVenue', type: 'text', label: 'Physical Venue Address / Label', required: true, maxLength: 120, placeholder: 'e.g. FOG Main Sanctuary, 2nd Floor Fellowship Hall' },
        { key: 'date', type: 'date', label: 'Event Date', required: true },
        { key: 'startTime', type: 'time', label: 'Start Time', required: true },
        { key: 'endTime', type: 'time', label: 'End Time (Optional)', required: false },
        { key: 'timezone', type: 'text', label: 'Timezone', required: true, default: CANONICAL_TIMEZONE, readonly: true },
        { key: 'audience', type: 'select', label: 'Audience', required: true, options: CANONICAL_AUDIENCES.map(a => ({ value: a.id, label: a.label })) },
        { key: 'registrationNote', type: 'text', label: 'Registration / RSVP Note', required: false, maxLength: 140, placeholder: 'e.g. Free admission. Please RSVP by Friday.' },
        { key: 'foodNote', type: 'text', label: 'Hospitality / Food Note', required: false, maxLength: 140, placeholder: 'e.g. Light refreshments provided after fellowship.' },
        { key: 'checkInEnabled', type: 'toggle', label: 'Enable In-Person QR Check-In', required: true, default: true },
        { key: 'memoryCaptureEnabled', type: 'toggle', label: 'Enable Event Memory Wall', required: true, default: true },
        { key: 'relatedCampaignId', type: 'text', label: 'Related Campaign ID (Optional)', required: false, maxLength: 60, placeholder: 'e.g. camp_fruit_2026' },
        { key: 'relatedCampfireId', type: 'select', label: 'Related Campfire (Optional)', required: false, options: [
          { value: '', label: '(None - Open to All)' },
          ...CANONICAL_CAMPFIRES.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))
        ]},
        { key: 'presentationTarget', type: 'select', label: 'Presentation Target', required: true, options: PRESENTATION_TARGETS.map(t => ({ value: t.id, label: t.label })), default: 'BOTH' }
      ]
    },

    CAMPAIGN: {
      id: 'CAMPAIGN',
      label: 'Ministry Campaign',
      icon: '🏆',
      version: '1.0',
      description: 'Organize a multi-week thematic campaign coordinating quests and gatherings.',
      fields: [
        { key: 'title', type: 'text', label: 'Campaign Title', required: true, maxLength: LIMITS.MAX_TITLE_LENGTH, placeholder: 'e.g. 40 Days of Living Faith' },
        { key: 'description', type: 'textarea', label: 'Campaign Overview & Vision', required: true, maxLength: LIMITS.MAX_LONG_DESC_LENGTH, placeholder: 'The heart and vision behind this community campaign' },
        { key: 'theme', type: 'text', label: 'Spiritual Theme Scripture', required: true, maxLength: 100, placeholder: 'e.g. Galatians 5:22 - Walk by the Spirit' },
        { key: 'startDate', type: 'date', label: 'Start Date', required: true },
        { key: 'endDate', type: 'date', label: 'End Date', required: true },
        { key: 'audience', type: 'select', label: 'Target Audience', required: true, options: CANONICAL_AUDIENCES.map(a => ({ value: a.id, label: a.label })) },
        { key: 'heroMessage', type: 'text', label: 'Banner Call-to-Action', required: true, maxLength: 140, placeholder: 'e.g. Join the pilgrimage together across all 5 places!' },
        { key: 'relatedQuests', type: 'text', label: 'Linked Quest IDs (Comma-separated)', required: false, placeholder: 'e.g. quest_water_01, quest_serve_02' },
        { key: 'relatedEvents', type: 'text', label: 'Linked Event IDs (Comma-separated)', required: false, placeholder: 'e.g. event_youth_rally, event_easter' },
        { key: 'progressMessage', type: 'text', label: 'Midway Encouragement Message', required: true, maxLength: 160, placeholder: 'e.g. Keep pressing on! Every small prayer builds up our community.' },
        { key: 'completionMessage', type: 'text', label: 'Campaign Completion Blessing', required: true, maxLength: 160, placeholder: 'e.g. Glory to God! We ran the race together in unity.' },
        { key: 'presentationTarget', type: 'select', label: 'Presentation Target', required: true, options: PRESENTATION_TARGETS.map(t => ({ value: t.id, label: t.label })), default: 'BOTH' }
      ]
    },

    CAMPFIRE_ACTIVITY: {
      id: 'CAMPFIRE_ACTIVITY',
      label: 'Campfire Activity',
      icon: '🔥',
      version: '1.0',
      description: 'Author small-group circle discussions and reflections attached to canonical Campfires.',
      fields: [
        { key: 'title', type: 'text', label: 'Activity Title', required: true, maxLength: LIMITS.MAX_TITLE_LENGTH, placeholder: 'e.g. Circle of Encouragement & Prayer' },
        { key: 'description', type: 'textarea', label: 'Activity Instructions', required: true, maxLength: LIMITS.MAX_LONG_DESC_LENGTH, placeholder: 'Guide for leaders and participants around the fire' },
        { key: 'campfireId', type: 'select', label: 'Target Campfire', required: true, options: CANONICAL_CAMPFIRES.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` })) },
        { key: 'activityType', type: 'select', label: 'Activity Type', required: true, options: [
          { value: 'discussion', label: '💬 Heart-to-Heart Discussion' },
          { value: 'prayer_circle', label: '🙏 United Prayer Circle' },
          { value: 'scripture_study', label: '📖 Group Word Reflection' },
          { value: 'fellowship_game', label: '🎲 Fellowship Activity' }
        ]},
        { key: 'relatedQuestId', type: 'text', label: 'Related Quest ID (Optional)', required: false, maxLength: 60, placeholder: 'e.g. quest_water_01' },
        { key: 'reflectionPrompt', type: 'textarea', label: 'Reflection / Discussion Prompt', required: true, maxLength: LIMITS.MAX_REFLECTION_LENGTH, placeholder: 'What was a moment this week where you saw God moving?' },
        { key: 'structuredReactionsEnabled', type: 'toggle', label: 'Enable Structured Reactions (👏, 🙏, 🔥, 🌱, ❤️)', required: true, default: true },
        { key: 'startDate', type: 'date', label: 'Start Date', required: true },
        { key: 'endDate', type: 'date', label: 'End Date (Optional)', required: false },
        { key: 'presentationTarget', type: 'select', label: 'Presentation Target', required: true, options: PRESENTATION_TARGETS.map(t => ({ value: t.id, label: t.label })), default: 'KOINONIA' }
      ]
    },

    MINISTRY_MISSION: {
      id: 'MINISTRY_MISSION',
      label: 'Ministry Mission',
      icon: '⛪',
      version: '1.0',
      description: 'Author practical volunteer service tasks with mandatory leader verification.',
      fields: [
        { key: 'title', type: 'text', label: 'Mission Title', required: true, maxLength: LIMITS.MAX_TITLE_LENGTH, placeholder: 'e.g. Sanctuary Sound & Setup Team' },
        { key: 'description', type: 'textarea', label: 'Mission Scope & Requirements', required: true, maxLength: LIMITS.MAX_LONG_DESC_LENGTH, placeholder: 'What preparation and service tasks are required' },
        { key: 'ministryId', type: 'select', label: 'Assigned Ministry', required: true, options: CANONICAL_MINISTRIES.map(m => ({ value: m.id, label: `${m.icon} ${m.name}` })) },
        { key: 'placeId', type: 'select', label: 'Koinonia Place', required: true, get options() { return getPlaceOptions(); } },
        { key: 'serviceType', type: 'select', label: 'Service Type', required: true, options: [
          { value: 'liturgical_service', label: '🎵 Liturgical / Worship Support' },
          { value: 'community_outreach', label: '🌾 Community Compassion & Food' },
          { value: 'facilities_stewardship', label: '🧹 Facilities Care & Cleanliness' },
          { value: 'youth_mentoring', label: '🤝 Youth Mentoring / Tutoring' }
        ]},
        { key: 'instructions', type: 'textarea', label: 'Step-by-Step Instructions', required: true, maxLength: 1000, placeholder: '1. Arrive 30 mins early\n2. Meet ministry lead at front gate\n3. Check cables' },
        { key: 'reflectionPrompt', type: 'textarea', label: 'Post-Service Reflection Prompt', required: true, maxLength: LIMITS.MAX_REFLECTION_LENGTH, placeholder: 'How did serving others help you grow closer to Christ today?' },
        { key: 'leaderVerificationRequired', type: 'toggle', label: 'Require Ministry Leader Verification (Mandatory)', required: true, default: true },
        { key: 'lifePoints', type: 'number', label: 'Service Life Points (0-50 LP)', required: true, min: LIMITS.MIN_LP, max: LIMITS.MAX_LP, default: 25 },
        { key: 'characterXp', type: 'number', label: 'Character XP (0-100)', required: true, min: LIMITS.MIN_XP, max: LIMITS.MAX_CHAR_XP, default: 50 },
        { key: 'startDate', type: 'date', label: 'Service Date', required: true },
        { key: 'endDate', type: 'date', label: 'End Date (Optional)', required: false },
        { key: 'presentationTarget', type: 'select', label: 'Presentation Target', required: true, options: PRESENTATION_TARGETS.map(t => ({ value: t.id, label: t.label })), default: 'BOTH' }
      ]
    }
  };

  // ============================================================
  // 5. VALIDATION ENGINE
  // ============================================================
  let placeStoreInstance = null;

  function validateTemplateData(templateType, data) {
    const template = TEMPLATES[templateType];
    const errors = {};

    if (!template) {
      errors._general = `Template type '${templateType}' is not supported.`;
      return { valid: false, errors };
    }

    if (!data || typeof data !== 'object') {
      errors._general = 'Form data must be a valid object.';
      return { valid: false, errors };
    }

    template.fields.forEach(field => {
      const val = data[field.key];

      // 1. Required Check
      if (field.required && (val === undefined || val === null || val === '')) {
        errors[field.key] = `${field.label} is required.`;
        return;
      }

      // If empty and not required, skip further checks
      if (val === undefined || val === null || val === '') {
        return;
      }

      // 2. String Fields Safety & Length
      if (field.type === 'text' || field.type === 'textarea') {
        const safetyCheck = inspectSafety(String(val));
        if (!safetyCheck.safe) {
          errors[field.key] = `Security Alert: ${safetyCheck.reason}`;
          return;
        }
        if (field.maxLength && String(val).length > field.maxLength) {
          errors[field.key] = `${field.label} must not exceed ${field.maxLength} characters (currently ${String(val).length}).`;
          return;
        }
      }

      // 3. Numeric Ranges
      if (field.type === 'number') {
        const num = Number(val);
        if (isNaN(num)) {
          errors[field.key] = `${field.label} must be a valid number.`;
          return;
        }
        if (field.min !== undefined && num < field.min) {
          errors[field.key] = `${field.label} must be at least ${field.min}.`;
          return;
        }
        if (field.max !== undefined && num > field.max) {
          errors[field.key] = `${field.label} cannot exceed ${field.max}.`;
          return;
        }
      }

      // 4. Select Options Check
      if (field.type === 'select') {
        if (field.key === 'placeId') {
          const place = placeStoreInstance ? placeStoreInstance.getPlaceById(String(val)) : null;
          const isCanonical = CANONICAL_PLACES.some(p => p.id === String(val));
          const isValidCustom = place && place.status === 'ACTIVE' && place.communityId === COMMUNITY_ID;
          if (!isCanonical && !isValidCustom) {
            errors[field.key] = 'Please select a valid active Koinonia Place.';
            return;
          }
        } else {
          const rawOpts = typeof field.options === 'function' ? field.options() : field.options;
          if (rawOpts && Array.isArray(rawOpts)) {
            const allowed = rawOpts
              .filter(o => !o.disabled && o.value !== 'CREATE_NEW_PLACE' && o.value !== '__SEPARATOR__' && o.value !== '')
              .map(o => String(o.value));
            if (!allowed.includes(String(val))) {
              errors[field.key] = `Please select a valid option for ${field.label}.`;
              return;
            }
          }
        }
      }
    });

    // 5. Cross-field Date/Time Consistency
    if (data.startDate && data.endDate) {
      if (new Date(data.endDate) < new Date(data.startDate)) {
        errors.endDate = 'End Date cannot precede Start Date.';
      }
    }

    if (data.startTime && data.endTime) {
      // Compare HH:MM
      if (data.endTime <= data.startTime) {
        errors.endTime = 'End Time must be after Start Time.';
      }
    }

    // 6. Campaign LP Safety: Campaigns must NOT award direct LP
    if (templateType === 'CAMPAIGN') {
      if (data.lifePoints !== undefined && Number(data.lifePoints) > 0) {
        errors.lifePoints = 'Campaigns organize content and cannot award direct LP upon view or join.';
      }
    }

    // 7. Ministry Verification: Ministry missions must require verification
    if (templateType === 'MINISTRY_MISSION') {
      if (data.leaderVerificationRequired === false) {
        errors.leaderVerificationRequired = 'Ministry missions require leader verification to award service rewards.';
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }

  // ============================================================
  // 6B. PROTOTYPE PLACE REGISTRY & STORE
  // ============================================================
  class StudioPlaceStore {
    constructor() {
      this.inMemoryPlaces = new Map();
      this.loadFromStorage();
    }

    loadFromStorage() {
      try {
        let raw = null;
        if (typeof localStorage !== 'undefined') {
          raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_PLACES);
        } else if (typeof global !== 'undefined' && global.localStorage) {
          raw = global.localStorage.getItem(STORAGE_KEYS.CUSTOM_PLACES);
        }
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.inMemoryPlaces.clear();
            parsed.forEach(p => {
              if (p && p.id && p.status === 'ACTIVE') {
                const cleaned = cleanLegacyObject(p);
                this.inMemoryPlaces.set(cleaned.id, cleaned);
              }
            });
          }
        }
      } catch (err) {
        console.warn('[StudioPlaceStore] Failed to load custom places:', err);
      }
    }

    persist() {
      try {
        const arr = Array.from(this.inMemoryPlaces.values());
        const json = JSON.stringify(arr);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_PLACES, json);
        } else if (typeof global !== 'undefined' && global.localStorage) {
          global.localStorage.setItem(STORAGE_KEYS.CUSTOM_PLACES, json);
        }
      } catch (err) {
        console.warn('[StudioPlaceStore] Failed to persist custom places:', err);
      }
    }

    listCustomPlaces() {
      return Array.from(this.inMemoryPlaces.values())
        .filter(p => p.communityId === COMMUNITY_ID && p.status === 'ACTIVE');
    }

    getPlaceById(id) {
      const canonical = CANONICAL_PLACES.find(p => p.id === id);
      if (canonical) return canonical;
      return this.inMemoryPlaces.get(id) || null;
    }

    createPlace(data = {}, actor = {}) {
      const role = String(actor.role || ROLES.MEMBER).toUpperCase();
      if (role === ROLES.MEMBER || (role !== ROLES.ADMIN && role !== ROLES.SUPERADMIN)) {
        throw new Error(`Unauthorized: Role '${role}' cannot create Koinonia places.`);
      }

      // Validate Place Name
      const name = String(data.name || '').trim();
      if (!name) {
        throw new Error('Place Name is required.');
      }
      if (name.length > 80) {
        throw new Error('Place Name must not exceed 80 characters.');
      }

      // Validate Place Type
      const type = String(data.type || '').trim();
      if (!type) {
        throw new Error('Place Type is required.');
      }
      if (!PLACE_TYPES.includes(type)) {
        throw new Error(`Invalid Place Type. Must be one of: ${PLACE_TYPES.join(', ')}`);
      }

      // Optional fields
      const description = String(data.description || '').trim();
      if (description.length > 160) {
        throw new Error('Short Description must not exceed 160 characters.');
      }

      const location = String(data.location || '').trim();
      if (location.length > 200) {
        throw new Error('Location / Address must not exceed 200 characters.');
      }

      // Content Safety / Security Sanitization
      const securityCheck = (fieldVal, fieldName) => {
        if (!fieldVal) return;
        if (/<[a-z][\s\S]*>/i.test(fieldVal)) {
          throw new Error(`Security Error: HTML markup is not permitted in ${fieldName}.`);
        }
        if (/<\/?script/i.test(fieldVal)) {
          throw new Error(`Security Error: Script tags are strictly prohibited in ${fieldName}.`);
        }
        if (/<\/?iframe/i.test(fieldVal)) {
          throw new Error(`Security Error: Iframes are strictly prohibited in ${fieldName}.`);
        }
        if (/javascript:/i.test(fieldVal)) {
          throw new Error(`Security Error: Executable javascript: URI protocol is strictly prohibited in ${fieldName}.`);
        }
        if (/on\w+\s*=/i.test(fieldVal)) {
          throw new Error(`Security Error: Inline event handlers are strictly prohibited in ${fieldName}.`);
        }
        if (/<style/i.test(fieldVal) || /@import/i.test(fieldVal)) {
          throw new Error(`Security Error: Inline CSS styling is strictly prohibited in ${fieldName}.`);
        }
      };

      securityCheck(name, 'Place Name');
      securityCheck(type, 'Place Type');
      securityCheck(description, 'Short Description');
      securityCheck(location, 'Location / Address');

      // Duplicate Name Protection (case-insensitive)
      const normName = name.toLowerCase();

      // Check against canonical places and aliases
      const isCanonicalDup = CANONICAL_PLACES.some(p => p.name.toLowerCase() === normName || (p.altName && p.altName.toLowerCase() === normName))
        || CANONICAL_PLACE_NAME_ALIASES.includes(normName);

      if (isCanonicalDup) {
        throw new Error('A place with this name already exists.');
      }

      // Check against active custom places
      for (const existing of this.inMemoryPlaces.values()) {
        if (existing.status === 'ACTIVE' && existing.name.toLowerCase() === normName) {
          throw new Error('A place with this name already exists.');
        }
      }

      // Stable generated ID: place_<timestamp>_<safe-slug>
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24) || 'custom';
      const id = `place_${Date.now()}_${slug}`;

      const newPlace = {
        id,
        communityId: COMMUNITY_ID, // 'fog'
        name,
        type,
        icon: PLACE_TYPE_ICONS[type] || '📍',
        description,
        location,
        source: 'STUDIO',
        status: 'ACTIVE',
        createdBy: {
          id: actor.id || 'unknown_user',
          name: actor.name || 'Anonymous Leader',
          role
        },
        createdAt: Date.now()
      };

      this.inMemoryPlaces.set(id, newPlace);
      this.persist();

      return newPlace;
    }

    reset() {
      this.inMemoryPlaces.clear();
      this.persist();
    }
  }

  placeStoreInstance = new StudioPlaceStore();

  function getAllPlaces() {
    return [...CANONICAL_PLACES, ...placeStoreInstance.listCustomPlaces()];
  }

  function getPlaceOptions() {
    const options = [
      { value: 'CREATE_NEW_PLACE', label: '➕ CREATE NEW PLACE' },
      { value: '__SEPARATOR__', label: '────────────────────', disabled: true }
    ];
    CANONICAL_PLACES.forEach(p => {
      options.push({ value: p.id, label: p.name });
    });
    placeStoreInstance.listCustomPlaces().forEach(p => {
      options.push({ value: p.id, label: p.name });
    });
    return options;
  }

  // ============================================================
  // 6. DRAFT STORE & AUTOSAVE (LOCAL STORAGE + FALLBACK)
  // ============================================================
  class StudioStore {
    constructor() {
      this.inMemoryDrafts = new Map();
      this.inMemoryPublished = [];
      this.inMemoryAudit = [];
      this.loadFromStorage();
    }

    getStorage() {
      if (typeof localStorage !== 'undefined') return localStorage;
      if (typeof global !== 'undefined' && global.localStorage) return global.localStorage;
      return null;
    }

    loadFromStorage() {
      const storage = this.getStorage();
      if (!storage) return;
      try {
        const raw = storage.getItem(STORAGE_KEYS.DRAFTS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.inMemoryDrafts.clear();
            parsed.forEach(d => {
              if (d && d.id) {
                const cleaned = cleanLegacyObject(d);
                this.inMemoryDrafts.set(cleaned.id, cleaned);
              }
            });
          }
        }
      } catch (err) {
        console.warn('[StudioStore] Failed to load drafts from storage:', err);
      }

      try {
        const rawPub = storage.getItem(STORAGE_KEYS.PUBLISHED);
        if (rawPub) {
          const parsed = JSON.parse(rawPub);
          if (Array.isArray(parsed)) this.inMemoryPublished = parsed.map(cleanLegacyObject);
        }
      } catch (_) {}

      try {
        const rawAud = storage.getItem(STORAGE_KEYS.AUDIT);
        if (rawAud) {
          const parsed = JSON.parse(rawAud);
          if (Array.isArray(parsed)) this.inMemoryAudit = parsed.map(cleanLegacyObject);
        }
      } catch (_) {}
    }

    persist() {
      const storage = this.getStorage();
      if (!storage) return;
      try {
        const arr = Array.from(this.inMemoryDrafts.values());
        storage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(arr));
        storage.setItem(STORAGE_KEYS.PUBLISHED, JSON.stringify(this.inMemoryPublished));
        storage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(this.inMemoryAudit.slice(-100)));
      } catch (err) {
        console.warn('[StudioStore] Failed to persist to storage:', err);
      }
    }

    // Role-permission gate
    canPerform(role, action) {
      const r = String(role || '').toUpperCase();
      if (r === ROLES.MEMBER) return false;
      if (r === ROLES.ADMIN) {
        // Admin can create, edit, save draft, duplicate, archive, delete, request review
        const adminAllowed = [
          'VIEW_STUDIO', 'CREATE_DRAFT', 'UPDATE_DRAFT', 'REQUEST_REVIEW',
          'DUPLICATE_DRAFT', 'ARCHIVE_DRAFT', 'DELETE_DRAFT', 'PREVIEW',
          'CREATE_PLACE'
        ];
        return adminAllowed.includes(action);
      }
      if (r === ROLES.SUPERADMIN) {
        // Superadmin has all permissions including APPROVE and PUBLISH
        return true;
      }
      return false;
    }

    // Audit Event Recorder
    logAudit(actor, action, draftId, title, details = {}) {
      const entry = {
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        actor: {
          id: actor.id || 'unknown_user',
          name: actor.name || 'Anonymous Leader',
          role: (actor.role || ROLES.MEMBER).toUpperCase()
        },
        action,
        draftId: draftId || null,
        title: title || 'Untitled',
        details
      };
      this.inMemoryAudit.unshift(entry);
      if (this.inMemoryAudit.length > 200) this.inMemoryAudit.pop();
      this.persist();
      return entry;
    }

    getAuditLogs() {
      return [...this.inMemoryAudit];
    }

    // Draft Operations
    createDraft(templateType, initialData = {}, actor = {}) {
      if (!this.canPerform(actor.role, 'CREATE_DRAFT')) {
        throw new Error(`Unauthorized: Role '${actor.role}' cannot create Studio drafts.`);
      }

      const template = TEMPLATES[templateType];
      if (!template) {
        throw new Error(`Invalid template type: ${templateType}`);
      }

      const now = Date.now();
      const draftId = `draft_${templateType.toLowerCase()}_${now}_${Math.random().toString(36).slice(2, 6)}`;

      const newDraft = {
        id: draftId,
        communityId: COMMUNITY_ID,
        templateType,
        templateVersion: template.version,
        title: initialData.title ? String(initialData.title).trim() : `New ${template.label}`,
        data: { ...initialData },
        status: DRAFT_STATUS.DRAFT,
        createdBy: {
          id: actor.id || 'admin_user',
          name: actor.name || 'Admin Leader',
          role: (actor.role || ROLES.ADMIN).toUpperCase()
        },
        createdAt: now,
        updatedAt: now,
        publishedAt: null
      };

      this.inMemoryDrafts.set(draftId, newDraft);
      this.persist();
      this.logAudit(actor, AUDIT_ACTIONS.DRAFT_CREATED, draftId, newDraft.title, { templateType });
      return newDraft;
    }

    updateDraft(draftId, updatedData, actor = {}) {
      if (!this.canPerform(actor.role, 'UPDATE_DRAFT')) {
        throw new Error(`Unauthorized: Role '${actor.role}' cannot update Studio drafts.`);
      }

      const draft = this.inMemoryDrafts.get(draftId);
      if (!draft) {
        throw new Error(`Draft '${draftId}' not found.`);
      }

      if (draft.status === DRAFT_STATUS.PUBLISHED) {
        throw new Error(`Published content cannot be directly updated in draft mode. Duplicate to create a new draft.`);
      }

      // Deep clone data to avoid accidental shared mutation
      draft.data = { ...draft.data, ...updatedData };
      if (updatedData.title !== undefined) {
        draft.title = String(updatedData.title).trim();
      }
      draft.updatedAt = Date.now();

      // If in review and edited, optionally revert to DRAFT
      if (draft.status === DRAFT_STATUS.READY_FOR_REVIEW) {
        draft.status = DRAFT_STATUS.DRAFT;
      }

      this.inMemoryDrafts.set(draftId, draft);
      this.persist();
      this.logAudit(actor, AUDIT_ACTIONS.DRAFT_UPDATED, draftId, draft.title);
      return draft;
    }

    getDraft(draftId) {
      return this.inMemoryDrafts.get(draftId) || null;
    }

    listDrafts(filter = {}) {
      const list = Array.from(this.inMemoryDrafts.values());
      return list.filter(d => {
        if (filter.templateType && d.templateType !== filter.templateType) return false;
        if (filter.status && d.status !== filter.status) return false;
        return true;
      }).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    duplicateDraft(draftId, actor = {}) {
      if (!this.canPerform(actor.role, 'DUPLICATE_DRAFT')) {
        throw new Error(`Unauthorized: Role '${actor.role}' cannot duplicate drafts.`);
      }

      const original = this.inMemoryDrafts.get(draftId);
      if (!original) throw new Error(`Draft '${draftId}' not found.`);

      const now = Date.now();
      const newId = `draft_${original.templateType.toLowerCase()}_${now}_copy`;
      const duplicate = {
        ...original,
        id: newId,
        title: `${original.title} (Copy)`,
        status: DRAFT_STATUS.DRAFT,
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
        createdBy: {
          id: actor.id || 'admin_user',
          name: actor.name || 'Admin Leader',
          role: (actor.role || ROLES.ADMIN).toUpperCase()
        },
        data: JSON.parse(JSON.stringify(original.data))
      };

      duplicate.data.title = duplicate.title;
      this.inMemoryDrafts.set(newId, duplicate);
      this.persist();
      this.logAudit(actor, AUDIT_ACTIONS.DRAFT_CREATED, newId, duplicate.title, { clonedFrom: draftId });
      return duplicate;
    }

    archiveDraft(draftId, actor = {}) {
      if (!this.canPerform(actor.role, 'ARCHIVE_DRAFT')) {
        throw new Error(`Unauthorized: Role '${actor.role}' cannot archive drafts.`);
      }

      const draft = this.inMemoryDrafts.get(draftId);
      if (!draft) throw new Error(`Draft '${draftId}' not found.`);

      draft.status = DRAFT_STATUS.ARCHIVED;
      draft.updatedAt = Date.now();
      this.inMemoryDrafts.set(draftId, draft);
      this.persist();
      this.logAudit(actor, AUDIT_ACTIONS.ARCHIVED, draftId, draft.title);
      return draft;
    }

    deleteDraft(draftId, actor = {}, confirm = false) {
      if (!this.canPerform(actor.role, 'DELETE_DRAFT')) {
        throw new Error(`Unauthorized: Role '${actor.role}' cannot delete drafts.`);
      }
      if (!confirm) {
        throw new Error('Explicit confirmation is required to delete a draft.');
      }

      const draft = this.inMemoryDrafts.get(draftId);
      if (!draft) throw new Error(`Draft '${draftId}' not found.`);

      this.inMemoryDrafts.delete(draftId);
      this.persist();
      this.logAudit(actor, AUDIT_ACTIONS.DRAFT_DELETED, draftId, draft.title);
      return { success: true, deletedId: draftId };
    }

    // Publishing Workflow Transitions
    requestReview(draftId, actor = {}) {
      if (!this.canPerform(actor.role, 'REQUEST_REVIEW')) {
        throw new Error(`Unauthorized: Role '${actor.role}' cannot submit drafts for review.`);
      }

      const draft = this.inMemoryDrafts.get(draftId);
      if (!draft) throw new Error(`Draft '${draftId}' not found.`);

      const validation = validateTemplateData(draft.templateType, draft.data);
      if (!validation.valid) {
        throw new Error(`Cannot submit for review: Draft has validation errors: ${JSON.stringify(validation.errors)}`);
      }

      draft.status = DRAFT_STATUS.READY_FOR_REVIEW;
      draft.updatedAt = Date.now();
      this.inMemoryDrafts.set(draftId, draft);
      this.persist();
      this.logAudit(actor, AUDIT_ACTIONS.REVIEW_REQUESTED, draftId, draft.title);
      return draft;
    }

    approveDraft(draftId, actor = {}) {
      if (!this.canPerform(actor.role, 'APPROVE')) {
        throw new Error(`Unauthorized: Only SUPERADMIN leaders can approve Studio drafts.`);
      }

      const draft = this.inMemoryDrafts.get(draftId);
      if (!draft) throw new Error(`Draft '${draftId}' not found.`);

      if (draft.status !== DRAFT_STATUS.READY_FOR_REVIEW && draft.status !== DRAFT_STATUS.DRAFT) {
        throw new Error(`Cannot approve draft in '${draft.status}' state.`);
      }

      const validation = validateTemplateData(draft.templateType, draft.data);
      if (!validation.valid) {
        throw new Error(`Cannot approve: Draft has validation errors.`);
      }

      draft.status = DRAFT_STATUS.APPROVED;
      draft.updatedAt = Date.now();
      this.inMemoryDrafts.set(draftId, draft);
      this.persist();
      this.logAudit(actor, AUDIT_ACTIONS.APPROVED, draftId, draft.title);
      return draft;
    }

    publishDraft(draftId, actor = {}) {
      if (!this.canPerform(actor.role, 'PUBLISH')) {
        throw new Error(`Unauthorized: Only SUPERADMIN leaders can publish Studio experiences.`);
      }

      const draft = this.inMemoryDrafts.get(draftId);
      if (!draft) throw new Error(`Draft '${draftId}' not found.`);

      // Must be approved first
      if (draft.status !== DRAFT_STATUS.APPROVED) {
        throw new Error(`Draft must be APPROVED before publishing (current status: ${draft.status}).`);
      }

      const now = Date.now();
      draft.status = DRAFT_STATUS.PUBLISHED;
      draft.publishedAt = now;
      draft.updatedAt = now;

      // Transform to prototype published record
      const publishedRecord = {
        publishedId: `pub_${draft.templateType.toLowerCase()}_${now}`,
        draftId: draft.id,
        communityId: COMMUNITY_ID,
        templateType: draft.templateType,
        title: draft.title,
        data: JSON.parse(JSON.stringify(draft.data)),
        publishedBy: {
          id: actor.id || 'superadmin_user',
          name: actor.name || 'Pastor David',
          role: ROLES.SUPERADMIN
        },
        publishedAt: now,
        presentationTarget: draft.data.presentationTarget || 'KOINONIA'
      };

      this.inMemoryDrafts.set(draftId, draft);
      this.inMemoryPublished.unshift(publishedRecord);
      this.persist();
      this.logAudit(actor, AUDIT_ACTIONS.PUBLISHED, draftId, draft.title, { publishedId: publishedRecord.publishedId });

      return {
        success: true,
        draft,
        publishedRecord,
        safetyNotice: 'PUBLISHED PROTOTYPE-LOCAL ONLY. Zero changes made to Main FOG App, database, or production.'
      };
    }

    listPublished() {
      return [...this.inMemoryPublished];
    }
  }

  // ============================================================
  // 7. PREVIEW RENDERERS (ZERO-MUTATION GUARANTEE)
  // ============================================================
  /**
   * Generates a safe, zero-side-effect preview model of authored content.
   * Prominently flags 'PREVIEW MODE' and guarantees 0 LP, 0 XP, 0 attendance mutations.
   */
  function generatePreviewModel(templateType, data) {
    const template = TEMPLATES[templateType];
    if (!template) throw new Error(`Invalid template: ${templateType}`);

    const safeData = {};
    for (const [k, v] of Object.entries(data || {})) {
      safeData[k] = v;
    }

    const preview = {
      templateType,
      templateLabel: template.label,
      title: safeData.title ? String(safeData.title).trim() : `Untitled ${template.label}`,
      place: getAllPlaces().find(p => p.id === safeData.placeId) || getAllPlaces()[0],
      data: safeData,
      isLive: false,
      banner: {
        text: 'PREVIEW MODE • NOT PUBLISHED',
        warning: '🤝 Koinonia Care Promise: This is only a preview. No Life Points or XP are awarded, no attendance is recorded, and no notifications are sent.'
      },
      zeroMutationPolicy: {
        lpAwarded: 0,
        xpAwarded: 0,
        attendanceRecorded: false,
        notificationsDispatched: 0
      }
    };

    return preview;
  }

  // Singleton store instance
  const storeInstance = new StudioStore();

  // ============================================================
  // 8. PUBLIC API EXPORT
  // ============================================================
  return {
    STORAGE_KEYS,
    COMMUNITY_ID,
    CANONICAL_TIMEZONE,
    ROLES,
    DRAFT_STATUS,
    AUDIT_ACTIONS,
    LIMITS,
    CANONICAL_PLACES,
    CANONICAL_AUDIENCES,
    CANONICAL_MINISTRIES,
    CANONICAL_CAMPFIRES,
    PRESENTATION_TARGETS,
    ALLOWED_MIME_TYPES,
    DEMO_MEDIA_LIBRARY,
    TEMPLATES,
    inspectSafety,
    sanitizeString,
    decodeLegacyHtmlEntities,
    validateTemplateData,
    generatePreviewModel,
    PLACE_TYPES,
    PLACE_TYPE_ICONS,
    CANONICAL_PLACES,
    StudioPlaceStore,
    placeStore: placeStoreInstance,
    getAllPlaces,
    getPlaceOptions,
    PLACE_TYPES,
    PLACE_TYPE_ICONS,
    CANONICAL_PLACES,
    StudioPlaceStore,
    placeStore: placeStoreInstance,
    getAllPlaces,
    getPlaceOptions,
    StudioStore,
    store: storeInstance
  };
});
