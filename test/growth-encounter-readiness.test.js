const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const sqlite3 =
    require('sqlite3');

const migration =
    fs.readFileSync(
        path.join(
            __dirname,
            '..',
            'migrations',
            '20260914_growth_encounter_readiness_v1.sql'
        ),
        'utf8'
    );

function exec(db, sql) {
    return new Promise(
        (resolve, reject) => {
            db.exec(
                sql,
                err => err
                    ? reject(err)
                    : resolve()
            );
        }
    );
}

function all(db, sql) {
    return new Promise(
        (resolve, reject) => {
            db.all(
                sql,
                [],
                (err, rows) => err
                    ? reject(err)
                    : resolve(rows || [])
            );
        }
    );
}

function close(db) {
    return new Promise(
        (resolve, reject) => {
            db.close(
                err => err
                    ? reject(err)
                    : resolve()
            );
        }
    );
}

test(
    'Encounter readiness makes Come and See Essential without gating Growth or Enrichment',
    async () => {
        const db =
            new sqlite3.Database(':memory:');

        try {
            await exec(
                db,
                `
                CREATE TABLE growth_tasks (
                    id INTEGER PRIMARY KEY,
                    task_key TEXT NOT NULL UNIQUE,
                    classification TEXT NOT NULL
                );

                INSERT INTO growth_tasks
                    (id, task_key, classification)
                VALUES
                    (1, 'encounter-account-start', 'growth'),
                    (2, 'encounter-prayer-covenant-21', 'growth'),
                    (3, 'encounter-community-event', 'growth'),
                    (4, 'encounter-faith-learning', 'enrichment'),
                    (5, 'belong-membership-intent', 'essential');
                `
            );

            await exec(
                db,
                migration
            );

            let rows =
                await all(
                    db,
                    `
                    SELECT
                        task_key,
                        classification
                    FROM growth_tasks
                    ORDER BY id
                    `
                );

            assert.deepEqual(
                rows,
                [
                    {
                        task_key:
                            'encounter-account-start',
                        classification:
                            'growth'
                    },
                    {
                        task_key:
                            'encounter-prayer-covenant-21',
                        classification:
                            'growth'
                    },
                    {
                        task_key:
                            'encounter-community-event',
                        classification:
                            'essential'
                    },
                    {
                        task_key:
                            'encounter-faith-learning',
                        classification:
                            'enrichment'
                    },
                    {
                        task_key:
                            'belong-membership-intent',
                        classification:
                            'essential'
                    }
                ]
            );

            /*
             * Migration replay must be harmless.
             */
            await exec(
                db,
                migration
            );

            rows =
                await all(
                    db,
                    `
                    SELECT COUNT(*) AS count
                    FROM growth_tasks
                    WHERE task_key =
                        'encounter-community-event'
                      AND classification =
                        'essential'
                    `
                );

            assert.equal(
                rows[0].count,
                1
            );
        } finally {
            await close(db);
        }
    }
);
