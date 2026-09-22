'use strict';

const crypto = require('crypto');

const MANILA_TIME_ZONE = 'Asia/Manila';
const ARCADE_DAILY_CAP = 20;
const GROWTH_GAME_DAILY_CAP = 25;
const MAX_GAME_SCORE = 10_000_000;

const GAME_DEFINITIONS = Object.freeze([
    Object.freeze({ id: 'davids-slingshot', name: "David's Slingshot", category: 'arcade', maxLifePoints: 5 }),
    Object.freeze({ id: 'noahs-ark-rescue', name: "Noah's Ark: Rescue", category: 'arcade', maxLifePoints: 5 }),
    Object.freeze({ id: 'moses-red-sea-dash', name: "Moses' Red Sea Dash", category: 'arcade', maxLifePoints: 5 }),
    Object.freeze({ id: 'peters-leap-of-faith', name: "Peter's Leap of Faith", category: 'arcade', maxLifePoints: 5 }),
    Object.freeze({ id: 'jonahs-deep-sea-dive', name: "Jonah's Deep Sea Dive", category: 'arcade', maxLifePoints: 5 }),
    Object.freeze({ id: 'jericho-walls-fall', name: 'Jericho: Walls Fall', category: 'arcade', maxLifePoints: 5 }),
    Object.freeze({ id: 'fishers-of-men-perfect-cast', name: 'Fishers of Men: Perfect Cast', category: 'arcade', maxLifePoints: 5 }),
    Object.freeze({ id: 'zacchaeus-tree-climb', name: 'Zacchaeus: Tree Climb', category: 'arcade', maxLifePoints: 5 }),
    Object.freeze({ id: 'lost-sheep-shepherds-search', name: "Lost Sheep: Shepherd's Search", category: 'arcade', maxLifePoints: 5 }),
    Object.freeze({ id: 'declaration-quest', name: 'Declaration Quest', category: 'growth', maxLifePoints: 10 }),
    Object.freeze({ id: 'catechism-clash', name: 'Catechism Clash', category: 'growth', maxLifePoints: 25 }),
    Object.freeze({ id: 'daily-manna-scramble', name: 'Daily Manna Scramble', category: 'growth', maxLifePoints: 15 }),
    Object.freeze({ id: 'emoji-sermon-translator', name: 'Emoji Sermon Translator', category: 'growth', maxLifePoints: 10 }),
    Object.freeze({ id: 'the-narrow-gate', name: 'The Narrow Gate', category: 'growth', maxLifePoints: 25 }),
    Object.freeze({ id: 'shield-of-faith-reflex-tap', name: 'Shield of Faith: Reflex Tap', category: 'growth', maxLifePoints: 15 }),
    Object.freeze({ id: 'fruits-of-the-spirit', name: 'Fruits of the Spirit', category: 'growth', maxLifePoints: 5 }),
    Object.freeze({ id: 'who-am-i', name: 'Who Am I?', category: 'growth', maxLifePoints: 15 }),
    Object.freeze({ id: 'would-you-rather', name: 'Would You Rather', category: 'growth', maxLifePoints: 5 }),
    Object.freeze({ id: 'word-matrix', name: 'Word Matrix', category: 'growth', maxLifePoints: 25 }),
    Object.freeze({ id: 'verse-chain', name: 'Verse Chain', category: 'growth', maxLifePoints: 10 })
]);

const GAME_BY_ID = new Map(GAME_DEFINITIONS.map(game => [game.id, game]));
const GAME_BY_NAME = new Map(GAME_DEFINITIONS.map(game => [game.name, game]));

const PUBLIC_FAITH_QUEST_GAMES = Object.freeze(new Map([
    ['Catechism Clash', Object.freeze({ maxScore: 5 })],
    ['The Narrow Gate', Object.freeze({ maxScore: 5 })],
    ['Daily Manna Scramble', Object.freeze({ maxScore: 5 })],
    ['Emoji Sermon', Object.freeze({ maxScore: 5 })],
    ['Shield of Faith', Object.freeze({ maxScore: 5 })],
    ['Fruits of the Spirit', Object.freeze({ maxScore: 5 })]
]));

class GameEconomyError extends Error {
    constructor(message, code = 'GAME_ECONOMY_ERROR', statusCode = 500) {
        super(message);
        this.name = 'GameEconomyError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

function getGameDefinition(identifier) {
    if (typeof identifier !== 'string') return null;
    const normalized = identifier.trim();
    return GAME_BY_ID.get(normalized) || GAME_BY_NAME.get(normalized) || null;
}

function normalizePositiveInteger(value) {
    const number = typeof value === 'number'
        ? value
        : typeof value === 'string' && /^[1-9]\d*$/.test(value)
            ? Number(value)
            : NaN;
    return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function validateAuthenticatedMemberSubmission(authenticatedYouthId, suppliedYouthId, hasSuppliedYouthId) {
    const youthId = normalizePositiveInteger(authenticatedYouthId);
    if (!youthId) return { error: 'Authentication does not identify a member.', statusCode: 403 };
    if (hasSuppliedYouthId) {
        const supplied = normalizePositiveInteger(suppliedYouthId);
        if (supplied !== youthId) {
            return {
                error: 'Game rewards may only be submitted for the authenticated member.',
                statusCode: 403
            };
        }
    }
    return { youthId };
}

function normalizeScore(value, maximum = MAX_GAME_SCORE) {
    const score = typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim() !== ''
            ? Number(value)
            : NaN;
    if (!Number.isFinite(score) || score < 0 || score > maximum) return null;
    return score;
}

function normalizeLifePoints(value, maximum) {
    const amount = typeof value === 'number'
        ? value
        : typeof value === 'string' && /^\d+$/.test(value)
            ? Number(value)
            : NaN;
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > maximum) return null;
    return amount;
}

function normalizeSubmissionId(value) {
    if (value === undefined || value === null || value === '') return crypto.randomUUID();
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(normalized)) return null;
    return normalized;
}

function getManilaDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: MANILA_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
        date: `${values.year}-${values.month}-${values.day}`
    };
}

function getManilaDayRange(date = new Date()) {
    const current = getManilaDateParts(date);
    const nextUtc = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
    const nextYear = String(nextUtc.getUTCFullYear()).padStart(4, '0');
    const nextMonth = String(nextUtc.getUTCMonth() + 1).padStart(2, '0');
    const nextDay = String(nextUtc.getUTCDate()).padStart(2, '0');
    return Object.freeze({
        date: current.date,
        start: `${current.date} 00:00:00`,
        end: `${nextYear}-${nextMonth}-${nextDay} 00:00:00`
    });
}

function getManilaTimestamp(date = new Date()) {
    const dateParts = getManilaDateParts(date);
    const timeParts = new Intl.DateTimeFormat('en-GB', {
        timeZone: MANILA_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        hourCycle: 'h23'
    }).formatToParts(date);
    const values = Object.fromEntries(timeParts.map(part => [part.type, part.value]));
    return `${dateParts.date} ${values.hour}:${values.minute}:${values.second}`;
}

function run(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.run(sql, params, function callback(error) {
            if (error) return reject(error);
            resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

function get(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.get(sql, params, (error, row) => {
            if (error) return reject(error);
            resolve(row || null);
        });
    });
}

function all(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.all(sql, params, (error, rows) => {
            if (error) return reject(error);
            resolve(rows || []);
        });
    });
}

async function ensureGameEconomySchema(database) {
    await run(database, `CREATE TABLE IF NOT EXISTS game_score_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        youth_id INTEGER NOT NULL,
        game_id TEXT NOT NULL,
        game_name TEXT NOT NULL,
        category TEXT NOT NULL,
        score REAL NOT NULL,
        played_at TEXT NOT NULL,
        submission_id TEXT,
        legacy_source TEXT,
        legacy_id INTEGER,
        UNIQUE(youth_id, submission_id),
        UNIQUE(legacy_source, legacy_id)
    )`);
    await run(database, `CREATE INDEX IF NOT EXISTS idx_game_score_member_game
        ON game_score_logs (youth_id, game_id, score DESC)`);
    await run(database, `CREATE INDEX IF NOT EXISTS idx_game_score_game_rank
        ON game_score_logs (game_id, score DESC, played_at ASC)`);
    await run(database, `CREATE TABLE IF NOT EXISTS game_reward_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        youth_id INTEGER NOT NULL,
        submission_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        category TEXT NOT NULL,
        score REAL NOT NULL,
        requested_life_points INTEGER NOT NULL,
        life_points_awarded INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(youth_id, submission_id)
    )`);
    await run(database, `CREATE INDEX IF NOT EXISTS idx_game_reward_member_day
        ON game_reward_claims (youth_id, category, created_at)`);

    const arcadeDefinitions = GAME_DEFINITIONS.filter(game => game.category === 'arcade');
    for (const game of arcadeDefinitions) {
        await run(database, `INSERT OR IGNORE INTO game_score_logs (
                youth_id, game_id, game_name, category, score, played_at,
                legacy_source, legacy_id
            )
            SELECT youth_id, ?, game_name, 'arcade', score, played_at,
                   'arcade_score_logs', id
            FROM arcade_score_logs
            WHERE game_name = ?`, [game.id, game.name]);
    }
}

function buildPlaceholders(values) {
    return values.map(() => '?').join(', ');
}

function getCategoryConfig(category) {
    if (category === 'arcade') return { type: 'arcade', cap: ARCADE_DAILY_CAP };
    if (category === 'growth') return { type: 'growth', cap: GROWTH_GAME_DAILY_CAP };
    return null;
}

function createGameEconomyService({ database, now = () => new Date() }) {
    if (!database) throw new TypeError('A SQLite database is required');
    let queue = Promise.resolve();

    const serialize = task => {
        const result = queue.then(task, task);
        queue = result.catch(() => {});
        return result;
    };

    async function getDailyLifePoints(youthId, category, referenceDate = now()) {
        const config = getCategoryConfig(category);
        if (!config) throw new GameEconomyError('Invalid game category.', 'INVALID_GAME_CATEGORY', 400);
        const gameNames = GAME_DEFINITIONS
            .filter(game => game.category === category)
            .map(game => game.name);
        const range = getManilaDayRange(referenceDate);
        const row = await get(database, `SELECT COALESCE(SUM(amount), 0) AS total
            FROM point_transactions
            WHERE youth_id = ?
              AND type = ?
              AND game_name IN (${buildPlaceholders(gameNames)})
              AND created_at >= ?
              AND created_at < ?`, [youthId, config.type, ...gameNames, range.start, range.end]);
        const total = Number(row && row.total) || 0;
        return Math.max(0, Math.min(config.cap, total));
    }

    async function getDailyArcadeGameLifePoints(
        youthId,
        game,
        referenceDate = now()
    ) {
        if (!game || game.category !== 'arcade') return 0;

        const range = getManilaDayRange(referenceDate);
        const row = await get(database, `SELECT COALESCE(SUM(amount), 0) AS total
            FROM point_transactions
            WHERE youth_id = ?
              AND type = 'arcade'
              AND game_name = ?
              AND created_at >= ?
              AND created_at < ?`, [
            youthId,
            game.name,
            range.start,
            range.end
        ]);

        const total = Number(row && row.total) || 0;

        return Math.max(
            0,
            Math.min(Number(game.maxLifePoints) || 0, total)
        );
    }

    async function updateAggregatePoints(youthId, timestamp) {
        const totals = await get(database, `SELECT
            COALESCE(SUM(CASE WHEN type = 'arcade' THEN amount ELSE 0 END), 0) AS arcade,
            COALESCE(SUM(CASE WHEN type = 'growth' THEN amount ELSE 0 END), 0) AS growth,
            COALESCE(SUM(CASE WHEN type = 'event' THEN amount ELSE 0 END), 0) AS event
            FROM point_transactions WHERE youth_id = ?`, [youthId]);
        const arcade = Number(totals && totals.arcade) || 0;
        const growth = Number(totals && totals.growth) || 0;
        const event = Number(totals && totals.event) || 0;
        await run(database, `INSERT INTO gamification_points (
                youth_id, arcade_xp, growth_xp, event_xp, points, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(youth_id) DO UPDATE SET
                arcade_xp = excluded.arcade_xp,
                growth_xp = excluded.growth_xp,
                event_xp = excluded.event_xp,
                points = excluded.points`, [youthId, arcade, growth, event, arcade + growth + event, timestamp]);
    }

    async function getPlayerStanding(identifier, youthIdValue) {
        const game = getGameDefinition(identifier);
        if (!game) throw new GameEconomyError('Unknown game.', 'INVALID_GAME', 400);
        const youthId = normalizePositiveInteger(youthIdValue);
        if (!youthId) throw new GameEconomyError('Invalid member.', 'INVALID_MEMBER', 400);
        const row = await get(database, `WITH personal_bests AS (
                SELECT logs.youth_id, MAX(logs.score) AS score
                FROM game_score_logs logs
                JOIN youth ON youth.id = logs.youth_id
                WHERE logs.game_id = ?
                  AND lower(trim(youth.name)) <> 'fire of god ministries'
                GROUP BY logs.youth_id
            ), ranked AS (
                SELECT youth_id, score,
                       DENSE_RANK() OVER (ORDER BY score DESC) AS rank
                FROM personal_bests
            )
            SELECT score AS personal_best, rank,
                   (SELECT COUNT(*) FROM personal_bests tied WHERE tied.score = ranked.score) AS tied_count
            FROM ranked
            WHERE youth_id = ?`, [game.id, youthId]);
        return row ? {
            personalBest: Number(row.personal_best),
            rank: Number(row.rank),
            rankTied: Number(row.tied_count) > 1
        } : {
            personalBest: null,
            rank: null,
            rankTied: false
        };
    }

    async function submit(input = {}) {
        const youthId = normalizePositiveInteger(input.youthId);
        if (!youthId) throw new GameEconomyError('Invalid authenticated member.', 'INVALID_MEMBER', 400);
        const game = getGameDefinition(input.gameId || input.gameName);
        if (!game) throw new GameEconomyError('Unknown game.', 'INVALID_GAME', 400);
        if (input.category && input.category !== game.category) {
            throw new GameEconomyError('Game category does not match the registered game.', 'GAME_CATEGORY_MISMATCH', 400);
        }
        const score = normalizeScore(input.score);
        if (score === null) throw new GameEconomyError('Invalid game score.', 'INVALID_SCORE', 400);
        const requestedLifePoints = normalizeLifePoints(input.requestedLifePoints, game.maxLifePoints);
        if (requestedLifePoints === null) {
            throw new GameEconomyError('Invalid Life Point reward.', 'INVALID_LIFE_POINTS', 400);
        }
        const submissionId = normalizeSubmissionId(input.submissionId);
        if (!submissionId) throw new GameEconomyError('Invalid submission identifier.', 'INVALID_SUBMISSION_ID', 400);
        const config = getCategoryConfig(game.category);
        if (input.beforeRecord !== undefined && typeof input.beforeRecord !== 'function') {
            throw new GameEconomyError('Invalid game completion handler.', 'INVALID_GAME_COMPLETION', 500);
        }

        return serialize(async () => {
            await run(database, 'BEGIN IMMEDIATE');
            try {
                const existing = await get(database, `SELECT game_id, score, life_points_awarded
                    FROM game_reward_claims
                    WHERE youth_id = ? AND submission_id = ?`, [youthId, submissionId]);
                if (existing) {
                    if (existing.game_id !== game.id) {
                        throw new GameEconomyError(
                            'Submission identifier was already used for another game.',
                            'SUBMISSION_ID_CONFLICT',
                            409
                        );
                    }
                    const standing = await getPlayerStanding(game.id, youthId);
                    const dailyLifePoints = await getDailyLifePoints(
                        youthId,
                        game.category,
                        now()
                    );
                    const gameDailyLifePoints =
                        game.category === 'arcade'
                            ? await getDailyArcadeGameLifePoints(
                                youthId,
                                game,
                                now()
                            )
                            : null;
                    await run(database, 'COMMIT');
                    return {
                        success: true,
                        duplicate: true,
                        submissionId,
                        gameId: game.id,
                        gameName: game.name,
                        category: game.category,
                        score: Number(existing.score),
                        personalBest: standing.personalBest,
                        previousPersonalBest: standing.personalBest,
                        isNewPersonalBest: false,
                        rank: standing.rank,
                        rankTied: standing.rankTied,
                        lifePointsAwarded: Number(existing.life_points_awarded),
                        dailyLifePoints,
                        dailyCap: config.cap,
                        dailyRemaining: Math.max(0, config.cap - dailyLifePoints),
                        capReached: dailyLifePoints >= config.cap,
                        gameDailyLifePoints,
                        gameDailyCap:
                            game.category === 'arcade'
                                ? game.maxLifePoints
                                : null,
                        gameDailyRemaining:
                            game.category === 'arcade'
                                ? Math.max(
                                    0,
                                    game.maxLifePoints - gameDailyLifePoints
                                )
                                : null,
                        gameCapReached:
                            game.category === 'arcade'
                                ? gameDailyLifePoints >= game.maxLifePoints
                                : false
                    };
                }

                const referenceDate = now();
                const timestamp = getManilaTimestamp(referenceDate);
                const previousBestRow = await get(database, `SELECT MAX(score) AS personal_best
                    FROM game_score_logs WHERE youth_id = ? AND game_id = ?`, [youthId, game.id]);
                const previousPersonalBest = previousBestRow && previousBestRow.personal_best !== null
                    ? Number(previousBestRow.personal_best)
                    : null;
                if (input.beforeRecord) {
                    await input.beforeRecord({
                        database,
                        youthId,
                        game,
                        score,
                        timestamp,
                        submissionId
                    });
                }
                await run(database, `INSERT INTO game_score_logs (
                    youth_id, game_id, game_name, category, score, played_at, submission_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                    youthId, game.id, game.name, game.category, score, timestamp, submissionId
                ]);

                const currentDaily = await getDailyLifePoints(
                    youthId,
                    game.category,
                    referenceDate
                );

                const currentGameDaily =
                    game.category === 'arcade'
                        ? await getDailyArcadeGameLifePoints(
                            youthId,
                            game,
                            referenceDate
                        )
                        : null;

                const remainingBeforeAward =
                    Math.max(0, config.cap - currentDaily);

                const remainingGameBeforeAward =
                    game.category === 'arcade'
                        ? Math.max(
                            0,
                            game.maxLifePoints - currentGameDaily
                        )
                        : requestedLifePoints;

                const lifePointsAwarded = Math.min(
                    requestedLifePoints,
                    remainingBeforeAward,
                    remainingGameBeforeAward
                );
                if (lifePointsAwarded > 0) {
                    await run(database, `INSERT INTO point_transactions (
                        youth_id, type, game_name, amount, created_at
                    ) VALUES (?, ?, ?, ?, ?)`, [
                        youthId, config.type, game.name, lifePointsAwarded, timestamp
                    ]);
                    await updateAggregatePoints(youthId, timestamp);
                }

                await run(database, `INSERT INTO game_reward_claims (
                    youth_id, submission_id, game_id, category, score,
                    requested_life_points, life_points_awarded, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                    youthId, submissionId, game.id, game.category, score,
                    requestedLifePoints, lifePointsAwarded, timestamp
                ]);

                const standing = await getPlayerStanding(game.id, youthId);
                const dailyLifePoints = currentDaily + lifePointsAwarded;
                const gameDailyLifePoints =
                    game.category === 'arcade'
                        ? currentGameDaily + lifePointsAwarded
                        : null;

                await run(database, 'COMMIT');
                return {
                    success: true,
                    duplicate: false,
                    submissionId,
                    gameId: game.id,
                    gameName: game.name,
                    category: game.category,
                    score,
                    personalBest: standing.personalBest,
                    previousPersonalBest,
                    isNewPersonalBest: previousPersonalBest === null || score > previousPersonalBest,
                    rank: standing.rank,
                    rankTied: standing.rankTied,
                    lifePointsAwarded,
                    dailyLifePoints,
                    dailyCap: config.cap,
                    dailyRemaining: Math.max(0, config.cap - dailyLifePoints),
                    capReached: dailyLifePoints >= config.cap,
                    gameDailyLifePoints,
                    gameDailyCap:
                        game.category === 'arcade'
                            ? game.maxLifePoints
                            : null,
                    gameDailyRemaining:
                        game.category === 'arcade'
                            ? Math.max(
                                0,
                                game.maxLifePoints - gameDailyLifePoints
                            )
                            : null,
                    gameCapReached:
                        game.category === 'arcade'
                            ? gameDailyLifePoints >= game.maxLifePoints
                            : false
                };
            } catch (error) {
                await run(database, 'ROLLBACK').catch(() => {});
                throw error;
            }
        });
    }

    async function getLeaderboard(identifier, limit = 10) {
        const game = getGameDefinition(identifier);
        if (!game) throw new GameEconomyError('Unknown game.', 'INVALID_GAME', 400);
        const safeLimit = Number.isSafeInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 10;
        return all(database, `WITH personal_bests AS (
                SELECT logs.youth_id, logs.score, MIN(logs.played_at) AS achieved_at
                FROM game_score_logs logs
                JOIN (
                    SELECT youth_id, MAX(score) AS score
                    FROM game_score_logs
                    WHERE game_id = ?
                    GROUP BY youth_id
                ) best
                  ON best.youth_id = logs.youth_id
                 AND best.score = logs.score
                WHERE logs.game_id = ?
                GROUP BY logs.youth_id, logs.score
            ), ranked AS (
                SELECT youth_id, score, achieved_at,
                       DENSE_RANK() OVER (ORDER BY score DESC) AS rank
                FROM personal_bests
            )
            SELECT
                ranked.youth_id,
                youth.name,
                youth.profile_picture,
                ranked.score,
                ranked.achieved_at,
                ranked.rank
            FROM ranked
            JOIN youth ON youth.id = ranked.youth_id
            WHERE lower(trim(youth.name)) <> 'fire of god ministries'
            ORDER BY ranked.rank ASC, ranked.achieved_at ASC, ranked.youth_id ASC
            LIMIT ?`, [game.id, game.id, safeLimit]);
    }

    return Object.freeze({ submit, getDailyLifePoints, getLeaderboard, getPlayerStanding });
}

function validatePublicLeaderboardSubmission(input = {}) {
    const playerName = typeof input.player_name === 'string' ? input.player_name.trim() : '';
    const gameName = typeof input.game_name === 'string' ? input.game_name.trim() : '';
    const game = PUBLIC_FAITH_QUEST_GAMES.get(gameName);
    const score = normalizeScore(input.score, game ? game.maxScore : 0);
    if (!game) return { error: 'Unknown Faith Quest game.' };
    if (!playerName || playerName.length > 80 || /[<>\u0000-\u001F\u007F]/.test(playerName)) {
        return { error: 'Invalid player name.' };
    }
    if (score === null || Math.round(score * 2) !== score * 2) {
        return { error: 'Invalid Faith Quest score.' };
    }

    let avatar = '';
    if (input.avatar !== undefined && input.avatar !== null && input.avatar !== '') {
        if (typeof input.avatar !== 'string' || input.avatar.length > 2048) {
            return { error: 'Invalid avatar URL.' };
        }
        try {
            const parsed = new URL(input.avatar, 'https://fogmin.site');
            if (!['http:', 'https:'].includes(parsed.protocol)) return { error: 'Invalid avatar URL.' };
            avatar = input.avatar.trim();
        } catch (error) {
            return { error: 'Invalid avatar URL.' };
        }
    }

    return { value: { playerName, gameName, score, avatar } };
}

module.exports = Object.freeze({
    MANILA_TIME_ZONE,
    ARCADE_DAILY_CAP,
    GROWTH_GAME_DAILY_CAP,
    MAX_GAME_SCORE,
    GAME_DEFINITIONS,
    PUBLIC_FAITH_QUEST_GAMES,
    GameEconomyError,
    getGameDefinition,
    normalizePositiveInteger,
    validateAuthenticatedMemberSubmission,
    normalizeScore,
    normalizeSubmissionId,
    getManilaDayRange,
    getManilaTimestamp,
    ensureGameEconomySchema,
    createGameEconomyService,
    validatePublicLeaderboardSubmission
});
