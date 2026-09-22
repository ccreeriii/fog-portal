'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const sqlite3 = require('sqlite3').verbose();
const { run, effectiveGrowthMappingsForEvent } = require('../lib/growth-journey');

function execute(database, sql) {
    return new Promise((resolve, reject) => {
        database.exec(sql, error => error ? reject(error) : resolve());
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => {
        database.close(error => error ? reject(error) : resolve());
    });
}

test('effective event Growth mappings use explicit series and event configuration', async t => {
    const database = new sqlite3.Database(':memory:');
    t.after(() => closeDatabase(database));
    await execute(database, `
        PRAGMA foreign_keys = ON;
        CREATE TABLE events (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE growth_journey_phases (
            id INTEGER PRIMARY KEY, phase_key TEXT NOT NULL, title TEXT NOT NULL,
            phase_order INTEGER NOT NULL, journey_segment TEXT NOT NULL, is_active INTEGER NOT NULL
        );
        CREATE TABLE growth_tasks (
            id INTEGER PRIMARY KEY, phase_id INTEGER NOT NULL, task_key TEXT NOT NULL,
            title TEXT NOT NULL, evidence_type TEXT NOT NULL, is_active INTEGER NOT NULL
        );
        CREATE TABLE growth_event_series (
            id INTEGER PRIMARY KEY, series_key TEXT NOT NULL, name TEXT NOT NULL, is_active INTEGER NOT NULL
        );
        CREATE TABLE growth_event_series_events (
            id INTEGER PRIMARY KEY, series_id INTEGER NOT NULL, event_id INTEGER NOT NULL
        );
        CREATE TABLE growth_event_task_map (
            id INTEGER PRIMARY KEY, task_id INTEGER NOT NULL,
            event_id INTEGER NOT NULL DEFAULT 0, series_id INTEGER NOT NULL DEFAULT 0,
            evidence_mode TEXT NOT NULL, formation_area TEXT NOT NULL DEFAULT '',
            credit_value REAL NOT NULL DEFAULT 1, is_active INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO events VALUES (1, 'Alpha Youth Series Test Event');
        INSERT INTO growth_journey_phases VALUES (1, 'encounter', 'Encounter', 1, 'membership', 1);
        INSERT INTO growth_tasks VALUES (1, 1, 'encounter-community-event', 'Come and See', 'event_participation', 1);
        INSERT INTO growth_tasks VALUES (2, 1, 'belong-community-orientation', 'Community Orientation', 'event_attendance', 1);
        INSERT INTO growth_event_series VALUES (1, 'fixture-series', 'Fixture Series', 1);
    `);

    await t.test('an event name alone produces no mapping', async () => {
        assert.deepEqual(await effectiveGrowthMappingsForEvent(database, 1), []);
    });

    await t.test('series-only and direct mappings resolve as a union', async () => {
        await run(database, 'INSERT INTO growth_event_series_events (series_id, event_id) VALUES (1, 1)');
        await run(database, `INSERT INTO growth_event_task_map
            (task_id, series_id, evidence_mode) VALUES (1, 1, 'attendance')`);
        await run(database, `INSERT INTO growth_event_task_map
            (task_id, event_id, evidence_mode) VALUES (2, 1, 'attendance')`);
        const resolved = await effectiveGrowthMappingsForEvent(database, 1);
        assert.deepEqual(resolved.map(item => item.task_id), [1, 2]);
        assert.deepEqual(resolved.map(item => item.source_type), ['series', 'event']);
    });

    await t.test('the same task from both sources is deduplicated with direct metadata', async () => {
        await run(database, `INSERT INTO growth_event_task_map
            (task_id, event_id, evidence_mode, credit_value) VALUES (1, 1, 'completion', 2)`);
        const resolved = await effectiveGrowthMappingsForEvent(database, 1);
        assert.equal(resolved.length, 2);
        const deduplicated = resolved.find(item => item.task_id === 1);
        assert.equal(deduplicated.source_type, 'event');
        assert.equal(deduplicated.evidence_mode, 'completion');
        assert.equal(deduplicated.credit_value, 2);
    });

    await t.test('inactive configuration does not contribute', async () => {
        await run(database, 'UPDATE growth_event_task_map SET is_active = 0 WHERE event_id = 1');
        await run(database, 'UPDATE growth_event_series SET is_active = 0 WHERE id = 1');
        assert.deepEqual(await effectiveGrowthMappingsForEvent(database, 1), []);
    });
});
