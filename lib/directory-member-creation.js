'use strict';

const writeQueues =
    new WeakMap();

function domainError(
    code,
    message
) {
    return Object.assign(
        new Error(message),
        { code }
    );
}

function run(
    db,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            db.run(
                sql,
                params,
                function callback(error) {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve({
                        lastID:
                            this.lastID,
                        changes:
                            this.changes
                    });
                }
            );
        }
    );
}

function get(
    db,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            db.get(
                sql,
                params,
                (error, row) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(
                        row || null
                    );
                }
            );
        }
    );
}

function enqueueWrite(
    db,
    operation
) {
    const previous =
        writeQueues.get(db) ||
        Promise.resolve();

    const current =
        previous
            .catch(() => {})
            .then(operation);

    writeQueues.set(
        db,
        current
    );

    return current.finally(
        () => {
            if (
                writeQueues.get(db) ===
                current
            ) {
                writeQueues.delete(db);
            }
        }
    );
}

async function withImmediateTransaction(
    db,
    operation
) {
    await run(
        db,
        'BEGIN IMMEDIATE'
    );

    try {
        const result =
            await operation();

        await run(
            db,
            'COMMIT'
        );

        return result;
    } catch (error) {
        try {
            await run(
                db,
                'ROLLBACK'
            );
        } catch (_) {
            // Preserve the original failure.
        }

        throw error;
    }
}

function optionalText(
    value,
    maxLength
) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const text =
        String(value).trim();

    if (!text) {
        return null;
    }

    if (
        text.length >
        maxLength
    ) {
        throw domainError(
            'DIRECTORY_MEMBER_FIELD_TOO_LONG',
            'One of the member fields is too long.'
        );
    }

    return text;
}

function requiredName(value) {
    const name =
        optionalText(
            value,
            200
        );

    if (!name) {
        throw domainError(
            'DIRECTORY_MEMBER_NAME_REQUIRED',
            'Member name is required.'
        );
    }

    return name;
}

function normalizeAge(value) {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return null;
    }

    const age =
        Number(value);

    if (
        !Number.isSafeInteger(age) ||
        age < 0 ||
        age > 120
    ) {
        throw domainError(
            'DIRECTORY_MEMBER_INVALID_AGE',
            'Enter a valid age.'
        );
    }

    return age;
}

function normalizeBirthday(value) {
    const birthday =
        optionalText(
            value,
            20
        );

    if (!birthday) {
        return null;
    }

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
            birthday
        )
    ) {
        throw domainError(
            'DIRECTORY_MEMBER_INVALID_BIRTHDAY',
            'Birthday must use YYYY-MM-DD.'
        );
    }

    return birthday;
}

function normalizeMemberInput(
    member,
    normalizeEmail
) {
    const source =
        member &&
        typeof member === 'object'
            ? member
            : {};

    const name =
        requiredName(
            source.name
        );

    const rawEmail =
        optionalText(
            source.email,
            320
        );

    let email = null;

    if (rawEmail) {
        if (
            typeof normalizeEmail !==
            'function'
        ) {
            throw domainError(
                'DIRECTORY_CONFIGURATION_ERROR',
                'Email normalization is unavailable.'
            );
        }

        email =
            normalizeEmail(
                rawEmail
            );

        if (!email) {
            throw domainError(
                'DIRECTORY_MEMBER_INVALID_EMAIL',
                'Enter a valid email address.'
            );
        }
    }

    return Object.freeze({
        name,

        age:
            normalizeAge(
                source.age
            ),

        email,

        mobile:
            optionalText(
                source.mobile,
                100
            ),

        socialMedia:
            optionalText(
                source.social_media,
                500
            ),

        birthday:
            normalizeBirthday(
                source.birthday
            ),

        parentsName:
            optionalText(
                source.parents_name,
                250
            ),

        profilePicture:
            optionalText(
                source.profile_picture,
                2_000_000
            ),

        gender:
            optionalText(
                source.gender,
                50
            ),

        address:
            optionalText(
                source.address,
                1000
            )
    });
}

async function createDirectoryMember(
    db,
    {
        member,
        actorName,
        normalizeEmail,
        formatMemberCode,
        now
    } = {}
) {
    if (
        !db ||
        typeof db.run !== 'function' ||
        typeof db.get !== 'function'
    ) {
        throw new TypeError(
            'SQLite database is required.'
        );
    }

    if (
        typeof formatMemberCode !==
        'function'
    ) {
        throw domainError(
            'DIRECTORY_CONFIGURATION_ERROR',
            'Member code formatter is unavailable.'
        );
    }

    const actor =
        optionalText(
            actorName,
            250
        );

    if (!actor) {
        throw domainError(
            'DIRECTORY_ACTOR_REQUIRED',
            'Authenticated leadership identity is required.'
        );
    }

    const timestampFactory =
        typeof now === 'function'
            ? now
            : () =>
                new Date()
                    .toISOString();

    const input =
        normalizeMemberInput(
            member,
            normalizeEmail
        );

    return enqueueWrite(
        db,
        () =>
            withImmediateTransaction(
                db,
                async () => {
                    if (input.email) {
                        const duplicate =
                            await get(
                                db,
                                `
                                SELECT id
                                FROM youth
                                WHERE LOWER(TRIM(email)) =
                                      LOWER(TRIM(?))
                                LIMIT 1
                                `,
                                [input.email]
                            );

                        if (duplicate) {
                            throw domainError(
                                'DIRECTORY_MEMBER_EMAIL_EXISTS',
                                'A member with this email already exists.'
                            );
                        }
                    }

                    const createdAt =
                        timestampFactory();

                    const inserted =
                        await run(
                            db,
                            `
                            INSERT INTO youth (
                                name,
                                age,
                                email,
                                mobile,
                                social_media,
                                birthday,
                                parents_name,
                                qr_code,
                                profile_picture,
                                gender,
                                address,
                                email_verified,
                                email_verified_at,
                                created_at
                            )
                            VALUES (
                                ?, ?, ?, ?, ?, ?, ?,
                                NULL,
                                ?, ?, ?,
                                0,
                                NULL,
                                ?
                            )
                            `,
                            [
                                input.name,
                                input.age,
                                input.email,
                                input.mobile,
                                input.socialMedia,
                                input.birthday,
                                input.parentsName,
                                input.profilePicture,
                                input.gender,
                                input.address,
                                createdAt
                            ]
                        );

                    const youthId =
                        Number(
                            inserted.lastID
                        );

                    if (
                        !Number.isSafeInteger(
                            youthId
                        ) ||
                        youthId <= 0
                    ) {
                        throw domainError(
                            'DIRECTORY_MEMBER_CREATE_FAILED',
                            'Member record could not be created.'
                        );
                    }

                    const memberCode =
                        formatMemberCode(
                            youthId
                        );

                    if (
                        typeof memberCode !==
                            'string' ||
                        !memberCode.trim()
                    ) {
                        throw domainError(
                            'DIRECTORY_MEMBER_CODE_INVALID',
                            'Member code could not be generated.'
                        );
                    }

                    const canonicalCode =
                        memberCode.trim();

                    const codeUpdate =
                        await run(
                            db,
                            `
                            UPDATE youth
                            SET qr_code = ?
                            WHERE id = ?
                              AND qr_code IS NULL
                            `,
                            [
                                canonicalCode,
                                youthId
                            ]
                        );

                    if (
                        Number(
                            codeUpdate.changes
                        ) !== 1
                    ) {
                        throw domainError(
                            'DIRECTORY_MEMBER_CODE_CONFLICT',
                            'Member code could not be assigned.'
                        );
                    }

                    const userInsert =
                        await run(
                            db,
                            `
                            INSERT INTO users (
                                username,
                                password,
                                permissions,
                                youth_id,
                                created_at
                            )
                            VALUES (
                                ?,
                                NULL,
                                '[]',
                                ?,
                                ?
                            )
                            `,
                            [
                                canonicalCode,
                                youthId,
                                createdAt
                            ]
                        );

                    const userId =
                        Number(
                            userInsert.lastID
                        );

                    if (
                        !Number.isSafeInteger(
                            userId
                        ) ||
                        userId <= 0
                    ) {
                        throw domainError(
                            'DIRECTORY_ACCOUNT_CREATE_FAILED',
                            'Claimable account could not be created.'
                        );
                    }

                    /*
                     * Audit creation is inside the same transaction.
                     * Browser/member payload cannot choose actorName.
                     */
                    await run(
                        db,
                        `
                        INSERT INTO activity_logs (
                            username,
                            action,
                            details,
                            created_at
                        )
                        VALUES (?, ?, ?, ?)
                        `,
                        [
                            actor,
                            'DIRECTORY_MEMBER_CREATED',
                            JSON.stringify({
                                youth_id:
                                    youthId,
                                user_id:
                                    userId,
                                member_code:
                                    canonicalCode,
                                source:
                                    'leadership_directory'
                            }),
                            createdAt
                        ]
                    );

                    return Object.freeze({
                        id:
                            youthId,

                        youth_id:
                            youthId,

                        user_id:
                            userId,

                        name:
                            input.name,

                        email:
                            input.email,

                        qr_code:
                            canonicalCode,

                        permissions:
                            Object.freeze([]),

                        account_status:
                            'claimable',

                        legal_acceptance_recorded:
                            false,

                        growth_started:
                            false,

                        email_verification_queued:
                            false
                    });
                }
            )
    );
}

module.exports = Object.freeze({
    createDirectoryMember
});
