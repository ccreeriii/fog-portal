#!/usr/bin/env node
'use strict';

const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const LegacyTransition = require('../lib/growth-journey-legacy-transition');

function parseArguments(values) {
    if (values.includes('--preview') && values.includes('--apply')) {
        throw new Error('Choose preview or apply, not both.');
    }

    const options = {
        mode: 'preview',
        all: false,
        youthId: null,
        confirmationToken: null,
        operator: null,
        databasePath: path.resolve(process.cwd(), 'fog_community.db')
    };

    for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (value === '--preview') {
            options.mode = 'preview';
        } else if (value === '--apply') {
            options.mode = 'apply';
        } else if (value === '--all') {
            options.all = true;
        } else if (value === '--youth-id') {
            options.youthId = Number(values[++index]);
        } else if (value === '--confirm') {
            options.confirmationToken = values[++index] || null;
        } else if (value === '--operator') {
            options.operator = values[++index] || null;
        } else if (value === '--database') {
            options.databasePath = path.resolve(values[++index] || '');
        } else {
            throw new Error(`Unknown argument: ${value}`);
        }
    }

    if (options.all && options.youthId) {
        throw new Error('Choose --all or --youth-id, not both.');
    }
    if (options.mode === 'apply' && !options.all && !options.youthId) {
        throw new Error('Apply requires --youth-id or --all.');
    }
    if (options.mode === 'apply' && !options.operator) {
        throw new Error('Apply requires --operator.');
    }
    if (
        options.mode === 'apply' &&
        options.all &&
        options.confirmationToken !== LegacyTransition.BULK_CONFIRMATION_TOKEN
    ) {
        throw new Error(
            `Bulk apply requires --confirm ${LegacyTransition.BULK_CONFIRMATION_TOKEN}.`
        );
    }
    return options;
}

function openDatabase(databasePath, readOnly) {
    const mode = readOnly
        ? sqlite3.OPEN_READONLY
        : sqlite3.OPEN_READWRITE;
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database(databasePath, mode, error => {
            if (error) reject(error);
            else resolve(database);
        });
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => {
        database.close(error => error ? reject(error) : resolve());
    });
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const database = await openDatabase(
        options.databasePath,
        options.mode === 'preview'
    );
    try {
        let result;
        if (options.mode === 'preview') {
            result = options.youthId
                ? await LegacyTransition.previewMemberTransition(database, options.youthId)
                : await LegacyTransition.previewAllTransitions(database);
        } else if (options.all) {
            result = await LegacyTransition.applyAllTransitions(database, {
                operator: options.operator,
                confirmationToken: options.confirmationToken
            });
        } else {
            result = await LegacyTransition.applyMemberTransition(
                database,
                options.youthId,
                { operator: options.operator }
            );
        }
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        if (result && Array.isArray(result.errors) && result.errors.length > 0) {
            process.exitCode = 1;
        }
    } finally {
        await closeDatabase(database);
    }
}

if (require.main === module) {
    main().catch(error => {
        process.stderr.write(`${error.code || 'LEGACY_TRANSITION_ERROR'}: ${error.message}\n`);
        process.exitCode = 1;
    });
}

module.exports = Object.freeze({
    parseArguments,
    openDatabase,
    closeDatabase,
    main
});
