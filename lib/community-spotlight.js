'use strict';

const TEMPLATE_TYPES = Object.freeze([
    'invitation',
    'event',
    'celebration',
    'important_notice',
    'challenge',
    'simple_announcement'
]);

const AUDIENCE_TYPES = Object.freeze([
    'all',
    'selected_members',
    'age_range'
]);

const DISPLAY_FREQUENCIES = Object.freeze([
    'every_login',
    'daily',
    'once',
    'until_action'
]);

const ACTION_TYPES = Object.freeze([
    'none',
    'internal_route',
    'external_url',
    'prayer_covenant_join'
]);

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS community_spotlight_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_key TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    internal_name TEXT NOT NULL,
    template_type TEXT NOT NULL,
    eyebrow TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    image_url TEXT,
    primary_label TEXT,
    primary_action_type TEXT NOT NULL DEFAULT 'none',
    primary_action_value TEXT,
    secondary_label TEXT,
    audience_type TEXT NOT NULL DEFAULT 'all',
    audience_json TEXT NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 0,
    display_frequency TEXT NOT NULL DEFAULT 'once',
    allow_dont_show_again INTEGER NOT NULL DEFAULT 1 CHECK (allow_dont_show_again IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
    is_paused INTEGER NOT NULL DEFAULT 0 CHECK (is_paused IN (0, 1)),
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
    start_at TEXT,
    end_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(campaign_key, version)
);

CREATE INDEX IF NOT EXISTS community_spotlight_campaign_active_idx
    ON community_spotlight_campaigns(
        is_enabled, is_paused, is_archived, priority, start_at, end_at
    );

CREATE TABLE IF NOT EXISTS community_spotlight_member_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    youth_id INTEGER NOT NULL,
    first_seen_at TEXT,
    last_seen_at TEXT,
    view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    clicked_at TEXT,
    dismissed_at TEXT,
    completed_at TEXT,
    last_action_at TEXT,
    UNIQUE(campaign_id, youth_id),
    FOREIGN KEY (campaign_id) REFERENCES community_spotlight_campaigns(id),
    FOREIGN KEY (youth_id) REFERENCES youth(id)
);

CREATE INDEX IF NOT EXISTS community_spotlight_member_state_member_idx
    ON community_spotlight_member_state(youth_id, campaign_id);
`;

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
            if (error) return reject(error);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => error ? reject(error) : resolve(row || null));
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows || []));
    });
}

function exec(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, error => error ? reject(error) : resolve());
    });
}

async function initializeSchema(db) {
    await exec(db, SCHEMA_SQL);
}

function positiveInteger(value, label) {
    const normalized = Number(value);
    if (!Number.isSafeInteger(normalized) || normalized <= 0) {
        throw new TypeError(`${label} must be a positive integer`);
    }
    return normalized;
}

function text(value, label, { required = false, max = 4000 } = {}) {
    if (value == null) {
        if (required) throw new TypeError(`${label} is required`);
        return null;
    }
    if (typeof value !== 'string') throw new TypeError(`${label} must be text`);
    const normalized = value.trim();
    if (required && !normalized) throw new TypeError(`${label} is required`);
    if (normalized.length > max) throw new RangeError(`${label} is too long`);
    return normalized || null;
}

function boolInt(value, fallback = 0) {
    if (value === undefined) return fallback ? 1 : 0;
    if (value === true || value === 1 || value === '1') return 1;
    if (value === false || value === 0 || value === '0') return 0;
    throw new TypeError('Boolean field must be true or false');
}

function enumValue(value, allowed, label, fallback = null) {
    const normalized = value == null ? fallback : String(value).trim();
    if (!allowed.includes(normalized)) {
        throw new TypeError(`${label} is invalid`);
    }
    return normalized;
}

function normalizeCampaignKey(value) {
    const normalized = text(value, 'campaign_key', { required: true, max: 64 }).toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(normalized)) {
        throw new TypeError('campaign_key must use lowercase letters, numbers, hyphen, or underscore');
    }
    return normalized;
}

function normalizeDateTime(value, label) {
    if (value == null || value === '') return null;
    const normalized = text(value, label, { required: true, max: 32 });
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
        throw new TypeError(`${label} must use YYYY-MM-DD HH:MM:SS`);
    }
    return normalized;
}

function normalizePriority(value, fallback = 0) {
    const normalized = value === undefined ? fallback : Number(value);
    if (!Number.isSafeInteger(normalized) || normalized < -1000 || normalized > 1000) {
        throw new RangeError('priority must be an integer from -1000 to 1000');
    }
    return normalized;
}

function normalizeImageUrl(value) {
    const normalized = text(value, 'image_url', { max: 2048 });
    if (!normalized) return null;
    if (normalized.startsWith('/') && !normalized.startsWith('//')) return normalized;
    let parsed;
    try {
        parsed = new URL(normalized);
    } catch (_) {
        throw new TypeError('image_url must be an internal path or HTTPS URL');
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
        throw new TypeError('image_url must be an internal path or HTTPS URL');
    }
    return parsed.toString();
}

function normalizeActionValue(type, value) {
    if (type === 'none' || type === 'prayer_covenant_join') return null;
    const normalized = text(value, 'primary_action_value', { required: true, max: 2048 });
    if (type === 'internal_route') {
        if (!normalized.startsWith('/') || normalized.startsWith('//')) {
            throw new TypeError('Internal action must use an application route');
        }
        return normalized;
    }
    let parsed;
    try {
        parsed = new URL(normalized);
    } catch (_) {
        throw new TypeError('External action must use an HTTPS URL');
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
        throw new TypeError('External action must use an HTTPS URL');
    }
    return parsed.toString();
}

function normalizeAudience(type, value) {
    let parsed = value;
    if (typeof parsed === 'string') {
        try {
            parsed = JSON.parse(parsed);
        } catch (_) {
            throw new TypeError('audience_json must be valid JSON');
        }
    }
    if (parsed == null) parsed = {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new TypeError('audience_json must be an object');
    }

    if (type === 'all') return {};

    if (type === 'selected_members') {
        if (!Array.isArray(parsed.youth_ids) || parsed.youth_ids.length === 0) {
            throw new TypeError('selected_members requires youth_ids');
        }
        const youthIds = [...new Set(parsed.youth_ids.map(value => positiveInteger(value, 'youth_id')))];
        if (youthIds.length > 5000) throw new RangeError('Too many selected members');
        return { youth_ids: youthIds };
    }

    const minAge = parsed.min_age == null || parsed.min_age === ''
        ? null
        : Number(parsed.min_age);
    const maxAge = parsed.max_age == null || parsed.max_age === ''
        ? null
        : Number(parsed.max_age);
    for (const [label, age] of [['min_age', minAge], ['max_age', maxAge]]) {
        if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) {
            throw new RangeError(`${label} must be an integer from 0 to 120`);
        }
    }
    if (minAge === null && maxAge === null) {
        throw new TypeError('age_range requires min_age or max_age');
    }
    if (minAge !== null && maxAge !== null && minAge > maxAge) {
        throw new RangeError('min_age cannot exceed max_age');
    }
    return { min_age: minAge, max_age: maxAge };
}

function normalizeCampaign(input, { existing = null, actor = null, now = null } = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('Campaign input is required');
    }
    const source = existing ? { ...existing, ...input } : { ...input };
    const campaignKey = existing
        ? normalizeCampaignKey(existing.campaign_key)
        : normalizeCampaignKey(source.campaign_key);
    const version = existing
        ? positiveInteger(existing.version, 'version')
        : positiveInteger(source.version == null ? 1 : source.version, 'version');
    const templateType = enumValue(
        source.template_type,
        TEMPLATE_TYPES,
        'template_type',
        'simple_announcement'
    );
    const audienceType = enumValue(
        source.audience_type,
        AUDIENCE_TYPES,
        'audience_type',
        'all'
    );
    const displayFrequency = enumValue(
        source.display_frequency,
        DISPLAY_FREQUENCIES,
        'display_frequency',
        'once'
    );
    const actionType = enumValue(
        source.primary_action_type,
        ACTION_TYPES,
        'primary_action_type',
        'none'
    );
    const startAt = normalizeDateTime(source.start_at, 'start_at');
    const endAt = normalizeDateTime(source.end_at, 'end_at');
    if (startAt && endAt && startAt >= endAt) {
        throw new RangeError('end_at must be later than start_at');
    }
    const normalizedNow = normalizeDateTime(now, 'now');
    const canonicalActor = text(
        actor || source.created_by || (existing && existing.created_by),
        'actor',
        { required: true, max: 160 }
    );
    return {
        campaign_key: campaignKey,
        version,
        internal_name: text(source.internal_name, 'internal_name', { required: true, max: 160 }),
        template_type: templateType,
        eyebrow: text(source.eyebrow, 'eyebrow', { max: 100 }),
        title: text(source.title, 'title', { required: true, max: 200 }),
        message: text(source.message, 'message', { required: true, max: 6000 }),
        image_url: normalizeImageUrl(source.image_url),
        primary_label: text(source.primary_label, 'primary_label', { max: 100 }),
        primary_action_type: actionType,
        primary_action_value: normalizeActionValue(actionType, source.primary_action_value),
        secondary_label: text(source.secondary_label, 'secondary_label', { max: 100 }),
        audience_type: audienceType,
        audience_json: JSON.stringify(normalizeAudience(audienceType, source.audience_json)),
        priority: normalizePriority(source.priority, existing ? Number(existing.priority) : 0),
        display_frequency: displayFrequency,
        allow_dont_show_again: boolInt(
            source.allow_dont_show_again,
            existing ? Number(existing.allow_dont_show_again) : 1
        ),
        is_enabled: boolInt(source.is_enabled, existing ? Number(existing.is_enabled) : 0),
        is_paused: boolInt(source.is_paused, existing ? Number(existing.is_paused) : 0),
        is_archived: boolInt(source.is_archived, existing ? Number(existing.is_archived) : 0),
        start_at: startAt,
        end_at: endAt,
        created_by: existing ? existing.created_by : canonicalActor,
        created_at: existing ? existing.created_at : normalizedNow,
        updated_at: normalizedNow
    };
}

async function createCampaign(db, input, { actor, now } = {}) {
    const campaign = normalizeCampaign(input, { actor, now });
    const result = await run(
        db,
        `INSERT INTO community_spotlight_campaigns (
            campaign_key, version, internal_name, template_type, eyebrow,
            title, message, image_url, primary_label, primary_action_type,
            primary_action_value, secondary_label, audience_type, audience_json,
            priority, display_frequency, allow_dont_show_again, is_enabled,
            is_paused, is_archived, start_at, end_at, created_by, created_at, updated_at
         ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         )`,
        [
            campaign.campaign_key, campaign.version, campaign.internal_name,
            campaign.template_type, campaign.eyebrow, campaign.title,
            campaign.message, campaign.image_url, campaign.primary_label,
            campaign.primary_action_type, campaign.primary_action_value,
            campaign.secondary_label, campaign.audience_type,
            campaign.audience_json, campaign.priority, campaign.display_frequency,
            campaign.allow_dont_show_again, campaign.is_enabled,
            campaign.is_paused, campaign.is_archived, campaign.start_at,
            campaign.end_at, campaign.created_by, campaign.created_at,
            campaign.updated_at
        ]
    );
    return getCampaign(db, result.lastID);
}

async function getCampaign(db, campaignId) {
    return get(
        db,
        'SELECT * FROM community_spotlight_campaigns WHERE id = ?',
        [positiveInteger(campaignId, 'campaignId')]
    );
}

async function listCampaigns(db) {
    return all(
        db,
        `SELECT *
         FROM community_spotlight_campaigns
         ORDER BY campaign_key ASC, version DESC, id DESC`
    );
}

async function updateCampaign(db, campaignId, input, { actor, now } = {}) {
    const existing = await getCampaign(db, campaignId);
    if (!existing) return null;
    if (
        Object.prototype.hasOwnProperty.call(input || {}, 'campaign_key') &&
        normalizeCampaignKey(input.campaign_key) !== existing.campaign_key
    ) {
        throw new TypeError('campaign_key cannot be changed');
    }
    if (
        Object.prototype.hasOwnProperty.call(input || {}, 'version') &&
        Number(input.version) !== Number(existing.version)
    ) {
        throw new TypeError('version cannot be changed');
    }
    const campaign = normalizeCampaign(input, { existing, actor, now });
    if (campaign.is_archived) {
        campaign.is_enabled = 0;
        campaign.is_paused = 0;
    }
    await run(
        db,
        `UPDATE community_spotlight_campaigns
         SET internal_name = ?, template_type = ?, eyebrow = ?, title = ?,
             message = ?, image_url = ?, primary_label = ?,
             primary_action_type = ?, primary_action_value = ?,
             secondary_label = ?, audience_type = ?, audience_json = ?,
             priority = ?, display_frequency = ?, allow_dont_show_again = ?,
             is_enabled = ?, is_paused = ?, is_archived = ?, start_at = ?,
             end_at = ?, updated_at = ?
         WHERE id = ?`,
        [
            campaign.internal_name, campaign.template_type, campaign.eyebrow,
            campaign.title, campaign.message, campaign.image_url,
            campaign.primary_label, campaign.primary_action_type,
            campaign.primary_action_value, campaign.secondary_label,
            campaign.audience_type, campaign.audience_json, campaign.priority,
            campaign.display_frequency, campaign.allow_dont_show_again,
            campaign.is_enabled, campaign.is_paused, campaign.is_archived,
            campaign.start_at, campaign.end_at, campaign.updated_at,
            existing.id
        ]
    );
    return getCampaign(db, existing.id);
}

async function relaunchCampaign(db, campaignId, overrides = {}, { actor, now } = {}) {
    const existing = await getCampaign(db, campaignId);
    if (!existing) return null;
    const normalizedNow = normalizeDateTime(now, 'now');
    await run(db, 'BEGIN IMMEDIATE');
    try {
        const maxVersion = await get(
            db,
            `SELECT MAX(version) AS version
             FROM community_spotlight_campaigns
             WHERE campaign_key = ?`,
            [existing.campaign_key]
        );
        const version = Number(maxVersion && maxVersion.version || 0) + 1;
        await run(
            db,
            `UPDATE community_spotlight_campaigns
             SET is_enabled = 0, is_paused = 0, updated_at = ?
             WHERE id = ?`,
            [normalizedNow, existing.id]
        );
        const base = {
            ...existing,
            ...overrides,
            campaign_key: existing.campaign_key,
            version,
            is_enabled: Object.prototype.hasOwnProperty.call(overrides, 'is_enabled')
                ? overrides.is_enabled
                : 0,
            is_archived: 0,
            created_by: actor,
            created_at: normalizedNow,
            updated_at: normalizedNow
        };
        const campaign = normalizeCampaign(base, { actor, now: normalizedNow });
        const result = await run(
            db,
            `INSERT INTO community_spotlight_campaigns (
                campaign_key, version, internal_name, template_type, eyebrow,
                title, message, image_url, primary_label, primary_action_type,
                primary_action_value, secondary_label, audience_type, audience_json,
                priority, display_frequency, allow_dont_show_again, is_enabled,
                is_paused, is_archived, start_at, end_at, created_by, created_at, updated_at
             ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
             )`,
            [
                campaign.campaign_key, campaign.version, campaign.internal_name,
                campaign.template_type, campaign.eyebrow, campaign.title,
                campaign.message, campaign.image_url, campaign.primary_label,
                campaign.primary_action_type, campaign.primary_action_value,
                campaign.secondary_label, campaign.audience_type,
                campaign.audience_json, campaign.priority, campaign.display_frequency,
                campaign.allow_dont_show_again, campaign.is_enabled,
                campaign.is_paused, campaign.is_archived, campaign.start_at,
                campaign.end_at, campaign.created_by, campaign.created_at,
                campaign.updated_at
            ]
        );
        await run(db, 'COMMIT');
        return getCampaign(db, result.lastID);
    } catch (error) {
        try {
            await run(db, 'ROLLBACK');
        } catch (_) {}
        throw error;
    }
}

function parseAudienceJson(campaign) {
    try {
        return JSON.parse(campaign.audience_json || '{}');
    } catch (_) {
        return {};
    }
}

function audienceEligible(campaign, member) {
    if (!campaign || !member) return false;
    const audience = parseAudienceJson(campaign);
    if (campaign.audience_type === 'all') return true;
    if (campaign.audience_type === 'selected_members') {
        return Array.isArray(audience.youth_ids) &&
            audience.youth_ids.map(Number).includes(Number(member.id));
    }
    const age = Number(member.age);
    if (!Number.isFinite(age)) return false;
    if (audience.min_age != null && age < Number(audience.min_age)) return false;
    if (audience.max_age != null && age > Number(audience.max_age)) return false;
    return true;
}

function frequencyEligible(campaign, state, now) {
    if (!state) return true;
    if (state.dismissed_at || state.completed_at) return false;
    switch (campaign.display_frequency) {
    case 'every_login':
        return true;
    case 'daily':
        return !state.last_seen_at ||
            String(state.last_seen_at).slice(0, 10) !== String(now).slice(0, 10);
    case 'once':
        return Number(state.view_count || 0) === 0;
    case 'until_action':
        return !state.clicked_at;
    default:
        return false;
    }
}

async function getNextEligibleCampaign(db, youthId, { now } = {}) {
    const memberId = positiveInteger(youthId, 'youthId');
    const normalizedNow = normalizeDateTime(now, 'now');
    const member = await get(db, 'SELECT id, age FROM youth WHERE id = ?', [memberId]);
    if (!member) return null;
    const campaigns = await all(
        db,
        `SELECT *
         FROM community_spotlight_campaigns
         WHERE is_enabled = 1
           AND is_paused = 0
           AND is_archived = 0
           AND (start_at IS NULL OR start_at <= ?)
           AND (end_at IS NULL OR end_at > ?)
         ORDER BY priority DESC, version DESC, id DESC`,
        [normalizedNow, normalizedNow]
    );
    for (const campaign of campaigns) {
        if (!audienceEligible(campaign, member)) continue;
        const state = await get(
            db,
            `SELECT *
             FROM community_spotlight_member_state
             WHERE campaign_id = ? AND youth_id = ?`,
            [campaign.id, memberId]
        );
        if (frequencyEligible(campaign, state, normalizedNow)) {
            return { campaign, state };
        }
    }
    return null;
}

async function recordImpression(db, campaignId, youthId, { now } = {}) {
    const campaign = await getCampaign(db, campaignId);
    if (!campaign) return null;
    const memberId = positiveInteger(youthId, 'youthId');
    const normalizedNow = normalizeDateTime(now, 'now');
    await run(
        db,
        `INSERT INTO community_spotlight_member_state (
            campaign_id, youth_id, first_seen_at, last_seen_at, view_count
         ) VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(campaign_id, youth_id) DO UPDATE SET
            first_seen_at = COALESCE(community_spotlight_member_state.first_seen_at, excluded.first_seen_at),
            last_seen_at = excluded.last_seen_at,
            view_count = community_spotlight_member_state.view_count + 1`,
        [campaign.id, memberId, normalizedNow, normalizedNow]
    );
    return get(
        db,
        `SELECT * FROM community_spotlight_member_state
         WHERE campaign_id = ? AND youth_id = ?`,
        [campaign.id, memberId]
    );
}

async function recordDismissal(db, campaignId, youthId, {
    permanent = false,
    now
} = {}) {
    const campaign = await getCampaign(db, campaignId);
    if (!campaign) return null;
    const memberId = positiveInteger(youthId, 'youthId');
    const normalizedNow = normalizeDateTime(now, 'now');
    if (permanent && Number(campaign.allow_dont_show_again) !== 1) {
        throw new Error('Permanent dismissal is not allowed for this campaign');
    }
    await run(
        db,
        `INSERT INTO community_spotlight_member_state (
            campaign_id, youth_id, dismissed_at, last_action_at
         ) VALUES (?, ?, ?, ?)
         ON CONFLICT(campaign_id, youth_id) DO UPDATE SET
            dismissed_at = CASE
                WHEN excluded.dismissed_at IS NOT NULL THEN excluded.dismissed_at
                ELSE community_spotlight_member_state.dismissed_at
            END,
            last_action_at = excluded.last_action_at`,
        [
            campaign.id,
            memberId,
            permanent ? normalizedNow : null,
            normalizedNow
        ]
    );
    return get(
        db,
        `SELECT * FROM community_spotlight_member_state
         WHERE campaign_id = ? AND youth_id = ?`,
        [campaign.id, memberId]
    );
}

async function recordAction(db, campaignId, youthId, { now } = {}) {
    const campaign = await getCampaign(db, campaignId);
    if (!campaign) return null;
    const memberId = positiveInteger(youthId, 'youthId');
    const normalizedNow = normalizeDateTime(now, 'now');
    await run(
        db,
        `INSERT INTO community_spotlight_member_state (
            campaign_id, youth_id, clicked_at, last_action_at
         ) VALUES (?, ?, ?, ?)
         ON CONFLICT(campaign_id, youth_id) DO UPDATE SET
            clicked_at = COALESCE(community_spotlight_member_state.clicked_at, excluded.clicked_at),
            last_action_at = excluded.last_action_at`,
        [campaign.id, memberId, normalizedNow, normalizedNow]
    );
    return {
        campaign,
        state: await get(
            db,
            `SELECT * FROM community_spotlight_member_state
             WHERE campaign_id = ? AND youth_id = ?`,
            [campaign.id, memberId]
        )
    };
}

async function recordCompletion(db, campaignId, youthId, { now } = {}) {
    const campaign = await getCampaign(db, campaignId);
    if (!campaign) return null;
    const memberId = positiveInteger(youthId, 'youthId');
    const normalizedNow = normalizeDateTime(now, 'now');
    await run(
        db,
        `INSERT INTO community_spotlight_member_state (
            campaign_id, youth_id, completed_at, last_action_at
         ) VALUES (?, ?, ?, ?)
         ON CONFLICT(campaign_id, youth_id) DO UPDATE SET
            completed_at = COALESCE(community_spotlight_member_state.completed_at, excluded.completed_at),
            last_action_at = excluded.last_action_at`,
        [campaign.id, memberId, normalizedNow, normalizedNow]
    );
    return get(
        db,
        `SELECT * FROM community_spotlight_member_state
         WHERE campaign_id = ? AND youth_id = ?`,
        [campaign.id, memberId]
    );
}

async function getAnalytics(db, campaignId) {
    const campaign = await getCampaign(db, campaignId);
    if (!campaign) return null;
    const members = await all(db, 'SELECT id, age FROM youth ORDER BY id');
    const eligibleMembers = members.filter(member => audienceEligible(campaign, member)).length;
    const row = await get(
        db,
        `SELECT
            COUNT(CASE WHEN view_count > 0 THEN 1 END) AS shown_members,
            COALESCE(SUM(view_count), 0) AS total_views,
            COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS clicked_members,
            COUNT(CASE WHEN dismissed_at IS NOT NULL THEN 1 END) AS dismissed_members,
            COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) AS completed_members
         FROM community_spotlight_member_state
         WHERE campaign_id = ?`,
        [campaign.id]
    );
    return {
        campaign_id: campaign.id,
        campaign_key: campaign.campaign_key,
        version: campaign.version,
        eligible_members: eligibleMembers,
        shown_members: Number(row && row.shown_members || 0),
        total_views: Number(row && row.total_views || 0),
        clicked_members: Number(row && row.clicked_members || 0),
        dismissed_members: Number(row && row.dismissed_members || 0),
        completed_members: Number(row && row.completed_members || 0)
    };
}

module.exports = {
    TEMPLATE_TYPES,
    AUDIENCE_TYPES,
    DISPLAY_FREQUENCIES,
    ACTION_TYPES,
    SCHEMA_SQL,
    initializeSchema,
    createCampaign,
    getCampaign,
    listCampaigns,
    updateCampaign,
    relaunchCampaign,
    getNextEligibleCampaign,
    recordImpression,
    recordDismissal,
    recordAction,
    recordCompletion,
    getAnalytics,
    audienceEligible,
    frequencyEligible
};
