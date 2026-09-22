'use strict';

const crypto =
    require('node:crypto');

const {
    getJournalAgeBracket
} =
    require(
        './private-journal-security'
    );

const JOURNAL_GUARDIAN_POLICY_VERSION =
    'journal-youth-2026-09-21-v1';

const JOURNAL_RESPONSIBLE_USE_POLICY_VERSION =
    'journal-responsible-use-2026-09-21-v1';

const TEEN_GUARDIAN_SETTING_KEY =
    'private_journal_guardian_required_13_17';

const GUARDIAN_REQUEST_TTL_MS =
    7 * 24 * 60 * 60 * 1000;

const APPROVAL_TOKEN_BYTES =
    32;

const GUARDIAN_VERIFICATION_TTL_MS =
    15 * 60 * 1000;

const GUARDIAN_VERIFICATION_MAX_ATTEMPTS =
    5;

const ALLOWED_RELATIONSHIPS =
    new Set([
        'parent',
        'legal_guardian',
        'other_guardian'
    ]);


function databaseRun(
    database,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            database.run(
                sql,
                params,
                function callback(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(this);
                    }
                }
            );
        }
    );
}


function databaseGet(
    database,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            database.get(
                sql,
                params,
                (error, row) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(row || null);
                    }
                }
            );
        }
    );
}


function databaseAll(
    database,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            database.all(
                sql,
                params,
                (error, rows) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        }
    );
}


async function ensureColumn(
    database,
    table,
    column,
    definition
) {
    const columns =
        await databaseAll(
            database,
            `PRAGMA table_info(${table})`
        );

    if (
        columns.some(
            current =>
                current.name ===
                column
        )
    ) {
        return false;
    }

    await databaseRun(
        database,
        `ALTER TABLE ${table} ADD COLUMN ${definition}`
    );

    return true;
}


function canonicalPositiveId(
    value
) {
    const parsed =
        Number(value);

    return (
        Number.isInteger(parsed) &&
        parsed > 0
    )
        ? parsed
        : null;
}


function manilaDateParts(
    now = new Date()
) {
    const formatter =
        new Intl.DateTimeFormat(
            'en-US',
            {
                timeZone:
                    'Asia/Manila',
                year:
                    'numeric',
                month:
                    '2-digit',
                day:
                    '2-digit'
            }
        );

    const parts =
        Object.fromEntries(
            formatter
                .formatToParts(now)
                .filter(
                    part =>
                        part.type !==
                        'literal'
                )
                .map(
                    part => [
                        part.type,
                        part.value
                    ]
                )
        );

    return {
        year:
            Number(parts.year),
        month:
            Number(parts.month),
        day:
            Number(parts.day)
    };
}


function parseBirthday(
    birthday
) {
    if (
        typeof birthday !==
            'string'
    ) {
        return null;
    }

    const match =
        birthday
            .trim()
            .match(
                /^(\d{4})-(\d{2})-(\d{2})$/
            );

    if (!match) {
        return null;
    }

    const year =
        Number(match[1]);

    const month =
        Number(match[2]);

    const day =
        Number(match[3]);

    const check =
        new Date(
            Date.UTC(
                year,
                month - 1,
                day
            )
        );

    if (
        check.getUTCFullYear() !==
            year ||
        check.getUTCMonth() !==
            month - 1 ||
        check.getUTCDate() !==
            day
    ) {
        return null;
    }

    return {
        year,
        month,
        day
    };
}


function calculateAgeFromBirthday(
    birthday,
    now = new Date()
) {
    const birth =
        parseBirthday(
            birthday
        );

    if (!birth) {
        return null;
    }

    const today =
        manilaDateParts(
            now
        );

    let age =
        today.year -
        birth.year;

    if (
        today.month <
            birth.month ||
        (
            today.month ===
                birth.month &&
            today.day <
                birth.day
        )
    ) {
        age -= 1;
    }

    if (
        age < 0 ||
        age > 130
    ) {
        return null;
    }

    return age;
}


function resolveJournalAgeProfile(
    member,
    now = new Date()
) {
    const age =
        calculateAgeFromBirthday(
            member &&
            member.birthday,
            now
        );

    if (
        !Number.isInteger(age)
    ) {
        return Object.freeze({
            age:
                null,
            age_bracket:
                'UNKNOWN',
            age_basis:
                'birthday_required'
        });
    }

    return Object.freeze({
        age,
        age_bracket:
            getJournalAgeBracket(
                age
            ),
        age_basis:
            'birthday'
    });
}


function normalizeRelationship(
    relationship
) {
    const normalized =
        String(
            relationship || ''
        )
            .trim()
            .toLowerCase();

    if (
        !ALLOWED_RELATIONSHIPS
            .has(normalized)
    ) {
        throw new TypeError(
            'Guardian relationship must be parent, legal guardian, or other authorized guardian.'
        );
    }

    return normalized;
}


function normalizeGuardianEmail(
    value
) {
    const normalized =
        String(value || '')
            .trim()
            .toLowerCase();

    if (
        normalized.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            normalized
        )
    ) {
        throw new TypeError(
            'A valid guardian email address is required.'
        );
    }

    return normalized;
}


function hashGuardianEmail(
    value
) {
    return crypto
        .createHash('sha256')
        .update(
            'fog-private-journal-guardian-email-v1\0'
        )
        .update(
            normalizeGuardianEmail(value)
        )
        .digest('hex');
}


function maskGuardianEmail(
    value
) {
    const normalized =
        normalizeGuardianEmail(value);

    const [local, domain] =
        normalized.split('@');

    return `${local.slice(0, 1)}***@${domain}`;
}


function createGuardianVerificationCode() {
    return String(
        crypto.randomInt(
            0,
            1000000
        )
    ).padStart(6, '0');
}


function hashGuardianVerificationCode({
    requestId,
    guardianEmail,
    code
}) {
    const canonicalRequestId =
        canonicalPositiveId(requestId);

    const normalizedCode =
        String(code || '').trim();

    if (
        !canonicalRequestId ||
        !/^\d{6}$/.test(normalizedCode)
    ) {
        throw new TypeError(
            'Invalid guardian verification code.'
        );
    }

    return crypto
        .createHash('sha256')
        .update(
            'fog-private-journal-guardian-verification-v1\0'
        )
        .update(String(canonicalRequestId))
        .update('\0')
        .update(
            normalizeGuardianEmail(
                guardianEmail
            )
        )
        .update('\0')
        .update(normalizedCode)
        .digest('hex');
}


function parseTeenGuardianSetting(
    value
) {
    if (value === 'true') {
        return Object.freeze({
            guardian_required:
                true,
            configured:
                true,
            valid:
                true
        });
    }

    if (value === 'false') {
        return Object.freeze({
            guardian_required:
                false,
            configured:
                true,
            valid:
                true
        });
    }

    return Object.freeze({
        guardian_required:
            true,
        configured:
            false,
        valid:
            false
    });
}


function createGuardianApprovalToken() {
    return crypto
        .randomBytes(
            APPROVAL_TOKEN_BYTES
        )
        .toString(
            'base64url'
        );
}


function hashGuardianApprovalToken(
    token
) {
    if (
        typeof token !==
            'string' ||
        token.length < 32 ||
        token.length > 256
    ) {
        throw new TypeError(
            'Invalid guardian authorization token.'
        );
    }

    return crypto
        .createHash(
            'sha256'
        )
        .update(
            'fog-private-journal-guardian-v1\0'
        )
        .update(token)
        .digest(
            'hex'
        );
}


function validAuthorization(
    authorization
) {
    return Boolean(
        authorization &&
        authorization.status ===
            'approved' &&
        authorization.policy_version ===
            JOURNAL_GUARDIAN_POLICY_VERSION &&
        authorization
            .youth_acknowledged_at &&
        authorization
            .guardian_approved_at &&
        !authorization.revoked_at
    );
}


function evaluateJournalAccess({
    ageProfile,
    authorization,
    guardianRequired13To17 = true,
    responsibleUseAcknowledgement = null
}) {
    const bracket =
        ageProfile &&
        ageProfile.age_bracket
            ? ageProfile
                .age_bracket
            : 'UNKNOWN';

    switch (bracket) {
    case 'AGE_18_PLUS':
        return Object.freeze({
            allowed:
                true,
            experience_mode:
                'private_journal',
            guardian_required:
                false,
            reason:
                'adult'
        });

    case 'AGE_13_17':
        if (
            guardianRequired13To17 ===
            false
        ) {
            const acknowledged =
                Boolean(
                    responsibleUseAcknowledgement &&
                    responsibleUseAcknowledgement
                        .policy_version ===
                        JOURNAL_RESPONSIBLE_USE_POLICY_VERSION &&
                    responsibleUseAcknowledgement
                        .acknowledged_at
                );

            return Object.freeze({
                allowed:
                    acknowledged,
                experience_mode:
                    'private_journal',
                guardian_required:
                    false,
                reason:
                    acknowledged
                        ? 'responsible_use_acknowledged'
                        : 'responsible_use_acknowledgement_required'
            });
        }

        if (
            validAuthorization(
                authorization
            )
        ) {
            return Object.freeze({
                allowed:
                    true,
                experience_mode:
                    'private_journal',
                guardian_required:
                    true,
                reason:
                    'guardian_authorized'
            });
        }

        return Object.freeze({
            allowed:
                false,
            experience_mode:
                'private_journal',
            guardian_required:
                true,
            reason:
                'guardian_authorization_required'
        });

    case 'AGE_10_12':
        if (
            validAuthorization(
                authorization
            )
        ) {
            return Object.freeze({
                allowed:
                    true,
                experience_mode:
                    'youth_reflection',
                guardian_required:
                    true,
                reason:
                    'guardian_authorized'
            });
        }

        return Object.freeze({
            allowed:
                false,
            experience_mode:
                'youth_reflection',
            guardian_required:
                true,
            reason:
                'guardian_authorization_required'
        });

    case 'UNDER_10':
        return Object.freeze({
            allowed:
                false,
            experience_mode:
                'unavailable',
            guardian_required:
                false,
            reason:
                'under_10'
        });

    default:
        return Object.freeze({
            allowed:
                false,
            experience_mode:
                'unavailable',
            guardian_required:
                false,
            reason:
                'birthday_required'
        });
    }
}


async function ensurePrivateJournalSafeguardingSchema(
    database
) {
    await databaseRun(
        database,
        `
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
        `
    );

    await databaseRun(
        database,
        `
        CREATE TABLE IF NOT EXISTS
        private_journal_guardian_authorizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            youth_id INTEGER NOT NULL,

            token_hash TEXT NOT NULL UNIQUE,

            policy_version TEXT NOT NULL,

            status TEXT NOT NULL,

            youth_acknowledged_at TEXT NOT NULL,

            requested_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,

            guardian_youth_id INTEGER,
            relationship TEXT,

            guardian_attested_at TEXT,
            guardian_approved_at TEXT,

            revoked_at TEXT,
            updated_at TEXT NOT NULL
        )
        `
    );

    await databaseRun(
        database,
        `
        CREATE INDEX IF NOT EXISTS
        private_journal_guardian_youth_idx
        ON private_journal_guardian_authorizations(
            youth_id,
            status,
            policy_version,
            id DESC
        )
        `
    );

    await databaseRun(
        database,
        `
        CREATE INDEX IF NOT EXISTS
        private_journal_guardian_approver_idx
        ON private_journal_guardian_authorizations(
            guardian_youth_id,
            status,
            id DESC
        )
        `
    );

    await ensureColumn(
        database,
        'private_journal_guardian_authorizations',
        'guardian_email_hash',
        'guardian_email_hash TEXT'
    );

    await ensureColumn(
        database,
        'private_journal_guardian_authorizations',
        'guardian_email_mask',
        'guardian_email_mask TEXT'
    );

    await ensureColumn(
        database,
        'private_journal_guardian_authorizations',
        'guardian_verified_at',
        'guardian_verified_at TEXT'
    );

    await ensureColumn(
        database,
        'private_journal_guardian_authorizations',
        'management_token_hash',
        'management_token_hash TEXT'
    );

    await databaseRun(
        database,
        `
        CREATE TABLE IF NOT EXISTS
        private_journal_responsible_acknowledgements (
            youth_id INTEGER NOT NULL,
            policy_version TEXT NOT NULL,
            acknowledged_at TEXT NOT NULL,
            PRIMARY KEY (
                youth_id,
                policy_version
            )
        )
        `
    );

    await databaseRun(
        database,
        `
        CREATE TABLE IF NOT EXISTS
        private_journal_guardian_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            authorization_id INTEGER NOT NULL,
            email_hash TEXT NOT NULL,
            code_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            verified_at TEXT,
            cancelled_at TEXT,
            created_at TEXT NOT NULL
        )
        `
    );

    await databaseRun(
        database,
        `
        CREATE INDEX IF NOT EXISTS
        private_journal_guardian_verification_idx
        ON private_journal_guardian_verifications(
            authorization_id,
            id DESC
        )
        `
    );

    await databaseRun(
        database,
        `
        CREATE TABLE IF NOT EXISTS
        private_journal_policy_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key TEXT NOT NULL,
            previous_value TEXT NOT NULL,
            new_value TEXT NOT NULL,
            admin_user_id INTEGER NOT NULL,
            admin_identity TEXT NOT NULL,
            policy_version TEXT NOT NULL,
            changed_at TEXT NOT NULL
        )
        `
    );
}


async function getCurrentGuardianAuthorization(
    database,
    youthId
) {
    const canonicalYouthId =
        canonicalPositiveId(
            youthId
        );

    if (!canonicalYouthId) {
        return null;
    }

    return databaseGet(
        database,
        `
        SELECT
            id,
            youth_id,
            policy_version,
            status,
            youth_acknowledged_at,
            requested_at,
            expires_at,
            guardian_youth_id,
            relationship,
            guardian_attested_at,
            guardian_approved_at,
            revoked_at,
            updated_at
        FROM
            private_journal_guardian_authorizations
        WHERE
            youth_id = ?
            AND policy_version = ?
            AND status = 'approved'
            AND revoked_at IS NULL
        ORDER BY
            guardian_approved_at DESC,
            id DESC
        LIMIT 1
        `,
        [
            canonicalYouthId,
            JOURNAL_GUARDIAN_POLICY_VERSION
        ]
    );
}


async function getTeenGuardianPolicy(
    database
) {
    const row =
        await databaseGet(
            database,
            `SELECT value
             FROM app_settings
             WHERE key = ?`,
            [
                TEEN_GUARDIAN_SETTING_KEY
            ]
        );

    return parseTeenGuardianSetting(
        row && row.value
    );
}


async function setTeenGuardianPolicy(
    database,
    {
        guardianRequired,
        adminUserId,
        adminIdentity,
        now = new Date()
    }
) {
    if (
        typeof guardianRequired !==
        'boolean'
    ) {
        throw new TypeError(
            'Guardian-required setting must be true or false.'
        );
    }

    const canonicalAdminId =
        canonicalPositiveId(
            adminUserId
        );

    const identity =
        String(adminIdentity || '')
            .trim();

    if (
        !canonicalAdminId ||
        !identity ||
        identity.length > 256
    ) {
        throw new TypeError(
            'A verified Super Admin identity is required.'
        );
    }

    const previous =
        await getTeenGuardianPolicy(
            database
        );

    const previousValue =
        previous.guardian_required
            ? 'true'
            : 'false';

    const nextValue =
        guardianRequired
            ? 'true'
            : 'false';

    await databaseRun(
        database,
        'BEGIN IMMEDIATE'
    );

    try {
        await databaseRun(
            database,
            `INSERT INTO app_settings (
                key,
                value
             ) VALUES (?, ?)
             ON CONFLICT(key)
             DO UPDATE SET value = excluded.value`,
            [
                TEEN_GUARDIAN_SETTING_KEY,
                nextValue
            ]
        );

        await databaseRun(
            database,
            `INSERT INTO private_journal_policy_audit (
                setting_key,
                previous_value,
                new_value,
                admin_user_id,
                admin_identity,
                policy_version,
                changed_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                TEEN_GUARDIAN_SETTING_KEY,
                previousValue,
                nextValue,
                canonicalAdminId,
                identity,
                JOURNAL_GUARDIAN_POLICY_VERSION,
                now.toISOString()
            ]
        );

        await databaseRun(
            database,
            'COMMIT'
        );
    } catch (error) {
        await databaseRun(
            database,
            'ROLLBACK'
        );

        throw error;
    }

    return Object.freeze({
        setting_key:
            TEEN_GUARDIAN_SETTING_KEY,
        previous_value:
            previousValue,
        guardian_required:
            guardianRequired,
        configured:
            true,
        policy_version:
            JOURNAL_GUARDIAN_POLICY_VERSION,
        changed_at:
            now.toISOString()
    });
}


async function getResponsibleUseAcknowledgement(
    database,
    youthId
) {
    const canonicalYouthId =
        canonicalPositiveId(youthId);

    if (!canonicalYouthId) {
        return null;
    }

    return databaseGet(
        database,
        `SELECT
            youth_id,
            policy_version,
            acknowledged_at
         FROM private_journal_responsible_acknowledgements
         WHERE youth_id = ?
           AND policy_version = ?`,
        [
            canonicalYouthId,
            JOURNAL_RESPONSIBLE_USE_POLICY_VERSION
        ]
    );
}


async function acknowledgeResponsibleUse(
    database,
    {
        youthId,
        policyVersion,
        acknowledged,
        now = new Date()
    }
) {
    const canonicalYouthId =
        canonicalPositiveId(youthId);

    if (
        !canonicalYouthId ||
        acknowledged !== true ||
        policyVersion !==
            JOURNAL_RESPONSIBLE_USE_POLICY_VERSION
    ) {
        const error =
            new Error(
                'The current responsible-journaling acknowledgement is required.'
            );

        error.code =
            'RESPONSIBLE_USE_ACKNOWLEDGEMENT_INVALID';

        throw error;
    }

    const state =
        await getPrivateJournalAccessState(
            database,
            canonicalYouthId,
            now
        );

    if (
        state.age_bracket !==
            'AGE_13_17' ||
        state.guardian_required !==
            false
    ) {
        const error =
            new Error(
                'This acknowledgement is not available for the current Journal policy.'
            );

        error.code =
            'RESPONSIBLE_USE_ACKNOWLEDGEMENT_NOT_ELIGIBLE';

        throw error;
    }

    const acknowledgedAt =
        now.toISOString();

    await databaseRun(
        database,
        `INSERT INTO private_journal_responsible_acknowledgements (
            youth_id,
            policy_version,
            acknowledged_at
         ) VALUES (?, ?, ?)
         ON CONFLICT(youth_id, policy_version)
         DO UPDATE SET acknowledged_at = excluded.acknowledged_at`,
        [
            canonicalYouthId,
            JOURNAL_RESPONSIBLE_USE_POLICY_VERSION,
            acknowledgedAt
        ]
    );

    return Object.freeze({
        youth_id:
            canonicalYouthId,
        policy_version:
            JOURNAL_RESPONSIBLE_USE_POLICY_VERSION,
        acknowledged_at:
            acknowledgedAt
    });
}


async function getPrivateJournalAccessState(
    database,
    youthId,
    now = new Date()
) {
    const canonicalYouthId =
        canonicalPositiveId(
            youthId
        );

    if (!canonicalYouthId) {
        throw new TypeError(
            'A valid Journal member is required.'
        );
    }

    const member =
        await databaseGet(
            database,
            `
            SELECT
                id,
                name,
                age,
                birthday
            FROM youth
            WHERE id = ?
            `,
            [
                canonicalYouthId
            ]
        );

    if (!member) {
        const error =
            new Error(
                'Journal member was not found.'
            );

        error.code =
            'JOURNAL_MEMBER_NOT_FOUND';

        throw error;
    }

    const ageProfile =
        resolveJournalAgeProfile(
            member,
            now
        );

    const authorization =
        await getCurrentGuardianAuthorization(
            database,
            canonicalYouthId
        );

    const teenPolicy =
        await getTeenGuardianPolicy(
            database
        );

    const responsibleUseAcknowledgement =
        await getResponsibleUseAcknowledgement(
            database,
            canonicalYouthId
        );

    const access =
        evaluateJournalAccess({
            ageProfile,
            authorization,
            guardianRequired13To17:
                teenPolicy
                    .guardian_required,
            responsibleUseAcknowledgement
        });

    return Object.freeze({
        youth_id:
            canonicalYouthId,

        age:
            ageProfile.age,

        age_bracket:
            ageProfile
                .age_bracket,

        age_basis:
            ageProfile
                .age_basis,

        access_allowed:
            access.allowed,

        experience_mode:
            access
                .experience_mode,

        guardian_required:
            access
                .guardian_required,

        responsible_use_policy_version:
            JOURNAL_RESPONSIBLE_USE_POLICY_VERSION,

        responsible_use_acknowledgement:
            responsibleUseAcknowledgement
                ? Object.freeze({
                    policy_version:
                        responsibleUseAcknowledgement
                            .policy_version,
                    acknowledged_at:
                        responsibleUseAcknowledgement
                            .acknowledged_at
                })
                : null,

        reason:
            access.reason,

        guardian_authorization:
            authorization
                ? Object.freeze({
                    status:
                        authorization
                            .status,
                    policy_version:
                        authorization
                            .policy_version,
                    relationship:
                        authorization
                            .relationship,
                    guardian_approved_at:
                        authorization
                            .guardian_approved_at
                })
                : null
    });
}


async function requestGuardianAuthorization(
    database,
    {
        youthId,
        youthAcknowledged,
        now = new Date()
    }
) {
    const canonicalYouthId =
        canonicalPositiveId(
            youthId
        );

    if (!canonicalYouthId) {
        throw new TypeError(
            'A valid youth member is required.'
        );
    }

    if (
        youthAcknowledged !==
        true
    ) {
        const error =
            new Error(
                'The young person must acknowledge the Journal privacy explanation first.'
            );

        error.code =
            'YOUTH_ACK_REQUIRED';

        throw error;
    }

    const accessState =
        await getPrivateJournalAccessState(
            database,
            canonicalYouthId,
            now
        );

    if (
        ![
            'AGE_10_12',
            'AGE_13_17'
        ].includes(
            accessState
                .age_bracket
        )
    ) {
        const error =
            new Error(
                'Guardian authorization is available only for eligible youth Journal access.'
            );

        error.code =
            'GUARDIAN_REQUEST_NOT_ELIGIBLE';

        throw error;
    }

    if (
        accessState.age_bracket ===
            'AGE_13_17' &&
        accessState.guardian_required !==
            true
    ) {
        const error =
            new Error(
                'Guardian authorization is not required for this age group under the current Journal policy.'
            );

        error.code =
            'GUARDIAN_REQUEST_NOT_REQUIRED';

        throw error;
    }

    if (
        accessState
            .access_allowed
    ) {
        const error =
            new Error(
                'Guardian authorization is already active.'
            );

        error.code =
            'GUARDIAN_ALREADY_APPROVED';

        throw error;
    }

    const requestedAt =
        now.toISOString();

    const expiresAt =
        new Date(
            now.getTime() +
            GUARDIAN_REQUEST_TTL_MS
        ).toISOString();

    const rawToken =
        createGuardianApprovalToken();

    const tokenHash =
        hashGuardianApprovalToken(
            rawToken
        );

    await databaseRun(
        database,
        `
        UPDATE
            private_journal_guardian_authorizations
        SET
            status =
                'superseded',
            updated_at = ?
        WHERE
            youth_id = ?
            AND policy_version = ?
            AND status =
                'pending'
        `,
        [
            requestedAt,
            canonicalYouthId,
            JOURNAL_GUARDIAN_POLICY_VERSION
        ]
    );

    const inserted =
        await databaseRun(
            database,
            `
            INSERT INTO
                private_journal_guardian_authorizations (
                    youth_id,
                    token_hash,
                    policy_version,
                    status,
                    youth_acknowledged_at,
                    requested_at,
                    expires_at,
                    updated_at
                )
            VALUES (
                ?,
                ?,
                ?,
                'pending',
                ?,
                ?,
                ?,
                ?
            )
            `,
            [
                canonicalYouthId,
                tokenHash,
                JOURNAL_GUARDIAN_POLICY_VERSION,
                requestedAt,
                requestedAt,
                expiresAt,
                requestedAt
            ]
        );

    return Object.freeze({
        request_id:
            inserted.lastID,

        approval_token:
            rawToken,

        expires_at:
            expiresAt,

        policy_version:
            JOURNAL_GUARDIAN_POLICY_VERSION,

        age_bracket:
            accessState
                .age_bracket,

        experience_mode:
            accessState
                .experience_mode
    });
}


async function lookupPendingGuardianRequest(
    database,
    token,
    now = new Date()
) {
    const tokenHash =
        hashGuardianApprovalToken(
            token
        );

    const row =
        await databaseGet(
            database,
            `
            SELECT
                a.id,
                a.youth_id,
                a.policy_version,
                a.status,
                a.youth_acknowledged_at,
                a.requested_at,
                a.expires_at,
                a.guardian_youth_id,
                a.relationship,
                a.guardian_attested_at,
                a.guardian_approved_at,
                a.revoked_at,
                a.updated_at,

                y.name AS youth_name,
                y.age AS youth_age,
                y.birthday AS youth_birthday,
                y.email AS youth_email

            FROM
                private_journal_guardian_authorizations a

            JOIN youth y
              ON y.id =
                 a.youth_id

            WHERE
                a.token_hash = ?
                AND a.policy_version = ?

            LIMIT 1
            `,
            [
                tokenHash,
                JOURNAL_GUARDIAN_POLICY_VERSION
            ]
        );

    if (
        !row ||
        row.status !==
            'pending'
    ) {
        const error =
            new Error(
                'This guardian authorization request is invalid or no longer active.'
            );

        error.code =
            'GUARDIAN_REQUEST_INVALID';

        throw error;
    }

    if (
        Date.parse(
            row.expires_at
        ) <= now.getTime()
    ) {
        await databaseRun(
            database,
            `
            UPDATE
                private_journal_guardian_authorizations
            SET
                status =
                    'expired',
                updated_at = ?
            WHERE
                id = ?
                AND status =
                    'pending'
            `,
            [
                now.toISOString(),
                row.id
            ]
        );

        const error =
            new Error(
                'This guardian authorization request has expired.'
            );

        error.code =
            'GUARDIAN_REQUEST_EXPIRED';

        throw error;
    }

    const ageProfile =
        resolveJournalAgeProfile(
            {
                birthday:
                    row.youth_birthday
            },
            now
        );

    if (
        ![
            'AGE_10_12',
            'AGE_13_17'
        ].includes(
            ageProfile
                .age_bracket
        )
    ) {
        const error =
            new Error(
                'This guardian authorization request is no longer eligible.'
            );

        error.code =
            'GUARDIAN_REQUEST_NOT_ELIGIBLE';

        throw error;
    }

    return {
        ...row,

        age:
            ageProfile.age,

        age_bracket:
            ageProfile
                .age_bracket
    };
}


async function previewGuestGuardianAuthorization(
    database,
    {
        token,
        now = new Date()
    }
) {
    const request =
        await lookupPendingGuardianRequest(
            database,
            token,
            now
        );

    return Object.freeze({
        request_id:
            request.id,
        youth_name:
            request.youth_name,
        age_bracket:
            request.age_bracket,
        policy_version:
            request.policy_version,
        requested_at:
            request.requested_at,
        expires_at:
            request.expires_at
    });
}


async function beginGuardianEmailVerification(
    database,
    {
        token,
        guardianEmail,
        relationship,
        adultConfirmed,
        authorizedConfirmed,
        permissionAttested,
        now = new Date()
    }
) {
    if (
        adultConfirmed !== true ||
        authorizedConfirmed !== true ||
        permissionAttested !== true
    ) {
        const error =
            new Error(
                'All guardian confirmations are required.'
            );

        error.code =
            'GUARDIAN_ATTESTATION_REQUIRED';

        throw error;
    }

    const request =
        await lookupPendingGuardianRequest(
            database,
            token,
            now
        );

    const email =
        normalizeGuardianEmail(
            guardianEmail
        );

    const relationshipValue =
        normalizeRelationship(
            relationship
        );

    const youthEmailHash =
        request.youth_email
            ? hashGuardianEmail(
                request.youth_email
            )
            : null;

    const emailHash =
        hashGuardianEmail(email);

    if (
        youthEmailHash &&
        crypto.timingSafeEqual(
            Buffer.from(
                youthEmailHash,
                'hex'
            ),
            Buffer.from(
                emailHash,
                'hex'
            )
        )
    ) {
        const error =
            new Error(
                'The young person cannot approve their own request.'
            );

        error.code =
            'SELF_GUARDIAN_FORBIDDEN';

        throw error;
    }

    const code =
        createGuardianVerificationCode();

    const createdAt =
        now.toISOString();

    const expiresAt =
        new Date(
            now.getTime() +
            GUARDIAN_VERIFICATION_TTL_MS
        ).toISOString();

    const codeHash =
        hashGuardianVerificationCode({
            requestId:
                request.id,
            guardianEmail:
                email,
            code
        });

    await databaseRun(
        database,
        `UPDATE private_journal_guardian_verifications
         SET cancelled_at = ?
         WHERE authorization_id = ?
           AND verified_at IS NULL
           AND cancelled_at IS NULL`,
        [
            createdAt,
            request.id
        ]
    );

    await databaseRun(
        database,
        `INSERT INTO private_journal_guardian_verifications (
            authorization_id,
            email_hash,
            code_hash,
            expires_at,
            created_at
         ) VALUES (?, ?, ?, ?, ?)`,
        [
            request.id,
            emailHash,
            codeHash,
            expiresAt,
            createdAt
        ]
    );

    await databaseRun(
        database,
        `UPDATE private_journal_guardian_authorizations
         SET guardian_email_hash = ?,
             guardian_email_mask = ?,
             relationship = ?,
             guardian_attested_at = ?,
             updated_at = ?
         WHERE id = ?
           AND status = 'pending'`,
        [
            emailHash,
            maskGuardianEmail(email),
            relationshipValue,
            createdAt,
            createdAt,
            request.id
        ]
    );

    return Object.freeze({
        request_id:
            request.id,
        guardian_email:
            email,
        guardian_email_mask:
            maskGuardianEmail(email),
        verification_code:
            code,
        verification_expires_at:
            expiresAt,
        youth_name:
            request.youth_name
    });
}


async function cancelGuardianEmailVerification(
    database,
    requestId,
    now = new Date()
) {
    const canonicalRequestId =
        canonicalPositiveId(requestId);

    if (!canonicalRequestId) {
        return false;
    }

    const result =
        await databaseRun(
            database,
            `UPDATE private_journal_guardian_verifications
             SET cancelled_at = ?
             WHERE authorization_id = ?
               AND verified_at IS NULL
               AND cancelled_at IS NULL`,
            [
                now.toISOString(),
                canonicalRequestId
            ]
        );

    return result.changes > 0;
}


async function verifyGuardianEmailAndApprove(
    database,
    {
        token,
        guardianEmail,
        verificationCode,
        now = new Date()
    }
) {
    const request =
        await lookupPendingGuardianRequest(
            database,
            token,
            now
        );

    const email =
        normalizeGuardianEmail(
            guardianEmail
        );

    const emailHash =
        hashGuardianEmail(email);

    const verification =
        await databaseGet(
            database,
            `SELECT *
             FROM private_journal_guardian_verifications
             WHERE authorization_id = ?
               AND email_hash = ?
               AND verified_at IS NULL
               AND cancelled_at IS NULL
             ORDER BY id DESC
             LIMIT 1`,
            [
                request.id,
                emailHash
            ]
        );

    if (
        !verification ||
        Date.parse(
            verification.expires_at
        ) <= now.getTime()
    ) {
        const error =
            new Error(
                'The verification code is invalid or expired.'
            );

        error.code =
            'GUARDIAN_VERIFICATION_INVALID';

        throw error;
    }

    if (
        verification.attempts >=
        GUARDIAN_VERIFICATION_MAX_ATTEMPTS
    ) {
        const error =
            new Error(
                'Too many verification attempts were made. Request a new code.'
            );

        error.code =
            'GUARDIAN_VERIFICATION_ATTEMPTS_EXCEEDED';

        throw error;
    }

    const candidateHash =
        hashGuardianVerificationCode({
            requestId:
                request.id,
            guardianEmail:
                email,
            code:
                verificationCode
        });

    const matches =
        crypto.timingSafeEqual(
            Buffer.from(
                verification.code_hash,
                'hex'
            ),
            Buffer.from(
                candidateHash,
                'hex'
            )
        );

    if (!matches) {
        await databaseRun(
            database,
            `UPDATE private_journal_guardian_verifications
             SET attempts = attempts + 1
             WHERE id = ?`,
            [verification.id]
        );

        const error =
            new Error(
                'The verification code is invalid or expired.'
            );

        error.code =
            'GUARDIAN_VERIFICATION_INVALID';

        throw error;
    }

    const approvedAt =
        now.toISOString();

    const managementToken =
        createGuardianApprovalToken();

    const managementTokenHash =
        hashGuardianApprovalToken(
            managementToken
        );

    await databaseRun(
        database,
        'BEGIN IMMEDIATE'
    );

    try {
        await databaseRun(
            database,
            `UPDATE private_journal_guardian_verifications
             SET verified_at = ?
             WHERE id = ?
               AND verified_at IS NULL`,
            [
                approvedAt,
                verification.id
            ]
        );

        const result =
            await databaseRun(
                database,
                `UPDATE private_journal_guardian_authorizations
                 SET status = 'approved',
                     guardian_verified_at = ?,
                     guardian_approved_at = ?,
                     management_token_hash = ?,
                     updated_at = ?
                 WHERE id = ?
                   AND status = 'pending'
                   AND guardian_email_hash = ?`,
                [
                    approvedAt,
                    approvedAt,
                    managementTokenHash,
                    approvedAt,
                    request.id,
                    emailHash
                ]
            );

        if (
            result.changes !== 1
        ) {
            const error =
                new Error(
                    'Guardian authorization could not be completed safely.'
                );

            error.code =
                'GUARDIAN_APPROVAL_CONFLICT';

            throw error;
        }

        await databaseRun(
            database,
            'COMMIT'
        );
    } catch (error) {
        await databaseRun(
            database,
            'ROLLBACK'
        );

        throw error;
    }

    return Object.freeze({
        success:
            true,
        youth_name:
            request.youth_name,
        policy_version:
            JOURNAL_GUARDIAN_POLICY_VERSION,
        approved_at:
            approvedAt,
        management_token:
            managementToken
    });
}


async function declineGuardianAuthorization(
    database,
    {
        token,
        now = new Date()
    }
) {
    const request =
        await lookupPendingGuardianRequest(
            database,
            token,
            now
        );

    const declinedAt =
        now.toISOString();

    await databaseRun(
        database,
        `UPDATE private_journal_guardian_authorizations
         SET status = 'declined',
             updated_at = ?
         WHERE id = ?
           AND status = 'pending'`,
        [
            declinedAt,
            request.id
        ]
    );

    return Object.freeze({
        success:
            true,
        declined_at:
            declinedAt
    });
}


async function revokeGuardianAuthorization(
    database,
    {
        managementToken,
        now = new Date()
    }
) {
    const tokenHash =
        hashGuardianApprovalToken(
            managementToken
        );

    const revokedAt =
        now.toISOString();

    const result =
        await databaseRun(
            database,
            `UPDATE private_journal_guardian_authorizations
             SET status = 'revoked',
                 revoked_at = ?,
                 updated_at = ?
             WHERE management_token_hash = ?
               AND status = 'approved'
               AND revoked_at IS NULL`,
            [
                revokedAt,
                revokedAt,
                tokenHash
            ]
        );

    if (
        result.changes !== 1
    ) {
        const error =
            new Error(
                'This guardian authorization management link is invalid or no longer active.'
            );

        error.code =
            'GUARDIAN_MANAGEMENT_TOKEN_INVALID';

        throw error;
    }

    return Object.freeze({
        success:
            true,
        revoked_at:
            revokedAt
    });
}


async function previewGuardianRevocation(
    database,
    {
        managementToken
    }
) {
    const tokenHash =
        hashGuardianApprovalToken(
            managementToken
        );

    const row =
        await databaseGet(
            database,
            `SELECT
                a.relationship,
                a.guardian_approved_at,
                a.policy_version,
                y.name AS youth_name
             FROM private_journal_guardian_authorizations a
             JOIN youth y
               ON y.id = a.youth_id
             WHERE a.management_token_hash = ?
               AND a.status = 'approved'
               AND a.revoked_at IS NULL
             LIMIT 1`,
            [tokenHash]
        );

    if (!row) {
        const error =
            new Error(
                'This guardian authorization management link is invalid or no longer active.'
            );

        error.code =
            'GUARDIAN_MANAGEMENT_TOKEN_INVALID';

        throw error;
    }

    return Object.freeze({
        youth_name:
            row.youth_name,
        relationship:
            row.relationship,
        approved_at:
            row.guardian_approved_at,
        policy_version:
            row.policy_version
    });
}


async function previewGuardianAuthorization(
    database,
    {
        token,
        guardianYouthId,
        now = new Date()
    }
) {
    const guardianId =
        canonicalPositiveId(
            guardianYouthId
        );

    if (!guardianId) {
        const error =
            new Error(
                'A signed-in adult guardian account is required.'
            );

        error.code =
            'GUARDIAN_ACCOUNT_REQUIRED';

        throw error;
    }

    const request =
        await lookupPendingGuardianRequest(
            database,
            token,
            now
        );

    if (
        request.youth_id ===
        guardianId
    ) {
        const error =
            new Error(
                'A young person cannot approve their own guardian authorization.'
            );

        error.code =
            'SELF_GUARDIAN_FORBIDDEN';

        throw error;
    }

    const guardian =
        await databaseGet(
            database,
            `
            SELECT
                id,
                name,
                birthday
            FROM youth
            WHERE id = ?
            `,
            [
                guardianId
            ]
        );

    if (!guardian) {
        const error =
            new Error(
                'Guardian member account was not found.'
            );

        error.code =
            'GUARDIAN_ACCOUNT_REQUIRED';

        throw error;
    }

    const guardianAge =
        resolveJournalAgeProfile(
            guardian,
            now
        );

    if (
        guardianAge
            .age_bracket !==
        'AGE_18_PLUS'
    ) {
        const error =
            new Error(
                'Guardian authorization requires a verified adult Portal profile with a recorded birthday.'
            );

        error.code =
            'ADULT_GUARDIAN_REQUIRED';

        throw error;
    }

    return Object.freeze({
        request_id:
            request.id,

        youth_id:
            request.youth_id,

        youth_name:
            request.youth_name,

        age_bracket:
            request.age_bracket,

        policy_version:
            request.policy_version,

        requested_at:
            request.requested_at,

        expires_at:
            request.expires_at
    });
}


async function approveGuardianAuthorization(
    database,
    {
        token,
        guardianYouthId,
        relationship,
        guardianAttested,
        now = new Date()
    }
) {
    if (
        guardianAttested !==
        true
    ) {
        const error =
            new Error(
                'Guardian confirmation is required.'
            );

        error.code =
            'GUARDIAN_ATTESTATION_REQUIRED';

        throw error;
    }

    const normalizedRelationship =
        normalizeRelationship(
            relationship
        );

    const preview =
        await previewGuardianAuthorization(
            database,
            {
                token,
                guardianYouthId,
                now
            }
        );

    const approvedAt =
        now.toISOString();

    const result =
        await databaseRun(
            database,
            `
            UPDATE
                private_journal_guardian_authorizations
            SET
                status =
                    'approved',

                guardian_youth_id = ?,

                relationship = ?,

                guardian_attested_at = ?,

                guardian_approved_at = ?,

                updated_at = ?

            WHERE
                id = ?
                AND status =
                    'pending'
                AND policy_version = ?
            `,
            [
                canonicalPositiveId(
                    guardianYouthId
                ),

                normalizedRelationship,

                approvedAt,

                approvedAt,

                approvedAt,

                preview.request_id,

                JOURNAL_GUARDIAN_POLICY_VERSION
            ]
        );

    if (
        result.changes !== 1
    ) {
        const error =
            new Error(
                'Guardian authorization could not be completed safely.'
            );

        error.code =
            'GUARDIAN_APPROVAL_CONFLICT';

        throw error;
    }

    return Object.freeze({
        success:
            true,

        youth_id:
            preview.youth_id,

        age_bracket:
            preview.age_bracket,

        policy_version:
            JOURNAL_GUARDIAN_POLICY_VERSION,

        relationship:
            normalizedRelationship,

        approved_at:
            approvedAt
    });
}


module.exports = Object.freeze({
    JOURNAL_GUARDIAN_POLICY_VERSION,
    JOURNAL_RESPONSIBLE_USE_POLICY_VERSION,
    TEEN_GUARDIAN_SETTING_KEY,
    GUARDIAN_REQUEST_TTL_MS,
    GUARDIAN_VERIFICATION_TTL_MS,
    GUARDIAN_VERIFICATION_MAX_ATTEMPTS,

    calculateAgeFromBirthday,
    resolveJournalAgeProfile,

    normalizeRelationship,
    normalizeGuardianEmail,
    hashGuardianEmail,
    maskGuardianEmail,

    createGuardianApprovalToken,
    hashGuardianApprovalToken,
    createGuardianVerificationCode,
    hashGuardianVerificationCode,

    parseTeenGuardianSetting,

    evaluateJournalAccess,

    ensurePrivateJournalSafeguardingSchema,

    getCurrentGuardianAuthorization,
    getTeenGuardianPolicy,
    setTeenGuardianPolicy,
    getResponsibleUseAcknowledgement,
    acknowledgeResponsibleUse,
    getPrivateJournalAccessState,

    requestGuardianAuthorization,
    previewGuardianAuthorization,
    approveGuardianAuthorization,
    previewGuestGuardianAuthorization,
    beginGuardianEmailVerification,
    cancelGuardianEmailVerification,
    verifyGuardianEmailAndApprove,
    declineGuardianAuthorization,
    previewGuardianRevocation,
    revokeGuardianAuthorization
});
