'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const sqlite3 =
    require('sqlite3');

const Safeguarding =
    require(
        '../lib/private-journal-safeguarding'
    );


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
                    } else {
                        resolve(this);
                    }
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
                    } else {
                        resolve(
                            row || null
                        );
                    }
                }
            );
        }
    );
}


async function createDb() {
    const db =
        new sqlite3.Database(
            ':memory:'
        );

    await run(
        db,
        `
        CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            name TEXT,
            age INTEGER,
            birthday TEXT,
            email TEXT
        )
        `
    );

    await Safeguarding
        .ensurePrivateJournalSafeguardingSchema(
            db
        );

    return db;
}


function fixedNow() {
    return new Date(
        '2026-09-21T04:00:00.000Z'
    );
}


test(
    'birthday is the canonical Journal age basis',
    () => {
        const now =
            fixedNow();

        assert.equal(
            Safeguarding
                .calculateAgeFromBirthday(
                    '2008-09-21',
                    now
                ),
            18
        );

        assert.equal(
            Safeguarding
                .calculateAgeFromBirthday(
                    '2008-09-22',
                    now
                ),
            17
        );

        assert.equal(
            Safeguarding
                .calculateAgeFromBirthday(
                    '',
                    now
                ),
            null
        );

        assert.equal(
            Safeguarding
                .resolveJournalAgeProfile(
                    {
                        age:
                            99,
                        birthday:
                            null
                    },
                    now
                )
                .age_bracket,
            'UNKNOWN'
        );
    }
);


test(
    'adult Journal access does not require guardian authorization',
    () => {
        const ageProfile =
            Safeguarding
                .resolveJournalAgeProfile(
                    {
                        birthday:
                            '2000-01-01'
                    },
                    fixedNow()
                );

        const access =
            Safeguarding
                .evaluateJournalAccess({
                    ageProfile,
                    authorization:
                        null
                });

        assert.equal(
            access.allowed,
            true
        );

        assert.equal(
            access.guardian_required,
            false
        );
    }
);


test(
    'ages 13-17 remain blocked until current guardian authorization exists',
    () => {
        const ageProfile =
            Safeguarding
                .resolveJournalAgeProfile(
                    {
                        birthday:
                            '2011-01-01'
                    },
                    fixedNow()
                );

        const blocked =
            Safeguarding
                .evaluateJournalAccess({
                    ageProfile,
                    authorization:
                        null
                });

        assert.equal(
            blocked.allowed,
            false
        );

        const allowed =
            Safeguarding
                .evaluateJournalAccess({
                    ageProfile,

                    authorization: {
                        status:
                            'approved',

                        policy_version:
                            Safeguarding
                                .JOURNAL_GUARDIAN_POLICY_VERSION,

                        youth_acknowledged_at:
                            '2026-09-21T00:00:00.000Z',

                        guardian_approved_at:
                            '2026-09-21T01:00:00.000Z',

                        revoked_at:
                            null
                    }
                });

        assert.equal(
            allowed.allowed,
            true
        );

        assert.equal(
            allowed.experience_mode,
            'private_journal'
        );
    }
);


test(
    'ages 10-12 use Youth Reflection after authorization',
    () => {
        const ageProfile =
            Safeguarding
                .resolveJournalAgeProfile(
                    {
                        birthday:
                            '2015-01-01'
                    },
                    fixedNow()
                );

        const allowed =
            Safeguarding
                .evaluateJournalAccess({
                    ageProfile,

                    authorization: {
                        status:
                            'approved',

                        policy_version:
                            Safeguarding
                                .JOURNAL_GUARDIAN_POLICY_VERSION,

                        youth_acknowledged_at:
                            '2026-09-21T00:00:00.000Z',

                        guardian_approved_at:
                            '2026-09-21T01:00:00.000Z',

                        revoked_at:
                            null
                    }
                });

        assert.equal(
            allowed.allowed,
            true
        );

        assert.equal(
            allowed.experience_mode,
            'youth_reflection'
        );
    }
);


test(
    'under-10 and missing-birthday accounts fail closed',
    () => {
        const under10 =
            Safeguarding
                .evaluateJournalAccess({
                    ageProfile:
                        Safeguarding
                            .resolveJournalAgeProfile(
                                {
                                    birthday:
                                        '2018-01-01'
                                },
                                fixedNow()
                            ),

                    authorization:
                        null
                });

        assert.equal(
            under10.allowed,
            false
        );

        assert.equal(
            under10.reason,
            'under_10'
        );

        const unknown =
            Safeguarding
                .evaluateJournalAccess({
                    ageProfile:
                        Safeguarding
                            .resolveJournalAgeProfile(
                                {
                                    age:
                                        30,
                                    birthday:
                                        null
                                },
                                fixedNow()
                            ),

                    authorization:
                        null
                });

        assert.equal(
            unknown.allowed,
            false
        );

        assert.equal(
            unknown.reason,
            'birthday_required'
        );
    }
);


test(
    'guardian request stores token hash rather than raw token',
    async () => {
        const db =
            await createDb();

        try {
            await run(
                db,
                `
                INSERT INTO youth (
                    id,
                    name,
                    age,
                    birthday
                )
                VALUES (
                    10,
                    'Youth Test',
                    15,
                    '2011-01-01'
                )
                `
            );

            const request =
                await Safeguarding
                    .requestGuardianAuthorization(
                        db,
                        {
                            youthId:
                                10,

                            youthAcknowledged:
                                true,

                            now:
                                fixedNow()
                        }
                    );

            assert.ok(
                request
                    .approval_token
            );

            const row =
                await get(
                    db,
                    `
                    SELECT
                        token_hash,
                        status
                    FROM
                        private_journal_guardian_authorizations
                    WHERE id = ?
                    `,
                    [
                        request
                            .request_id
                    ]
                );

            assert.equal(
                row.status,
                'pending'
            );

            assert.notEqual(
                row.token_hash,
                request
                    .approval_token
            );

            assert.equal(
                row.token_hash,
                Safeguarding
                    .hashGuardianApprovalToken(
                        request
                            .approval_token
                    )
            );

        } finally {
            db.close();
        }
    }
);


test(
    'guardian approval requires authenticated adult birthday profile',
    async () => {
        const db =
            await createDb();

        try {
            await run(
                db,
                `
                INSERT INTO youth
                    (id, name, age, birthday)
                VALUES
                    (10, 'Youth Test', 15, '2011-01-01'),
                    (20, 'Adult Test', 35, '1991-01-01'),
                    (30, 'Minor Guardian', 17, '2009-01-01')
                `
            );

            const request =
                await Safeguarding
                    .requestGuardianAuthorization(
                        db,
                        {
                            youthId:
                                10,

                            youthAcknowledged:
                                true,

                            now:
                                fixedNow()
                        }
                    );

            await assert.rejects(
                Safeguarding
                    .approveGuardianAuthorization(
                        db,
                        {
                            token:
                                request
                                    .approval_token,

                            guardianYouthId:
                                30,

                            relationship:
                                'parent',

                            guardianAttested:
                                true,

                            now:
                                fixedNow()
                        }
                    ),
                /adult/i
            );

            const approval =
                await Safeguarding
                    .approveGuardianAuthorization(
                        db,
                        {
                            token:
                                request
                                    .approval_token,

                            guardianYouthId:
                                20,

                            relationship:
                                'parent',

                            guardianAttested:
                                true,

                            now:
                                fixedNow()
                        }
                    );

            assert.equal(
                approval.success,
                true
            );

            const access =
                await Safeguarding
                    .getPrivateJournalAccessState(
                        db,
                        10,
                        fixedNow()
                    );

            assert.equal(
                access
                    .access_allowed,
                true
            );

        } finally {
            db.close();
        }
    }
);


test(
    'young person cannot approve own request',
    async () => {
        const db =
            await createDb();

        try {
            await run(
                db,
                `
                INSERT INTO youth
                    (id, name, age, birthday)
                VALUES
                    (10, 'Youth Test', 15, '2011-01-01')
                `
            );

            const request =
                await Safeguarding
                    .requestGuardianAuthorization(
                        db,
                        {
                            youthId:
                                10,

                            youthAcknowledged:
                                true,

                            now:
                                fixedNow()
                        }
                    );

            await assert.rejects(
                Safeguarding
                    .previewGuardianAuthorization(
                        db,
                        {
                            token:
                                request
                                    .approval_token,

                            guardianYouthId:
                                10,

                            now:
                                fixedNow()
                        }
                    ),
                /cannot approve their own/i
            );

        } finally {
            db.close();
        }
    }
);


test(
    'expired guardian request cannot be approved',
    async () => {
        const db =
            await createDb();

        try {
            await run(
                db,
                `
                INSERT INTO youth
                    (id, name, age, birthday)
                VALUES
                    (10, 'Youth Test', 15, '2011-01-01'),
                    (20, 'Adult Test', 35, '1991-01-01')
                `
            );

            const createdAt =
                fixedNow();

            const request =
                await Safeguarding
                    .requestGuardianAuthorization(
                        db,
                        {
                            youthId:
                                10,

                            youthAcknowledged:
                                true,

                            now:
                                createdAt
                        }
                    );

            const afterExpiry =
                new Date(
                    createdAt
                        .getTime() +
                    Safeguarding
                        .GUARDIAN_REQUEST_TTL_MS +
                    1000
                );

            await assert.rejects(
                Safeguarding
                    .approveGuardianAuthorization(
                        db,
                        {
                            token:
                                request
                                    .approval_token,

                            guardianYouthId:
                                20,

                            relationship:
                                'legal_guardian',

                            guardianAttested:
                                true,

                            now:
                                afterExpiry
                        }
                    ),
                /expired/i
            );

        } finally {
            db.close();
        }
    }
);
