# Koinonia v3 Repository Rules

## Project

- Koinonia v3 staging.
- Project path: `/home/raspi4/fog-portal-staging`.
- Production must never be modified unless the user explicitly authorizes a production deployment task.

## Core Priorities

1. Do not lose data.
2. Do not break working features.
3. Fix security problems safely.
4. Preserve launch readiness.
5. Prefer targeted changes over large refactors.

## General Workflow

- Inspect the existing implementation before editing.
- Make the smallest safe change that solves the assigned task.
- Do not refactor unrelated code.
- Preserve current APIs and behavior unless the task explicitly requires changing them.
- After edits, run appropriate syntax, tests, and checks.
- Show a concise summary of files changed and verification performed.
- Do not claim success unless verification actually passed.

## Git Safety

Never run the following without explicit approval:

- `git reset`
- `git checkout` when it changes working state
- `git clean`
- `git pull`
- `git merge`
- `git rebase`
- `git push`
- Force push
- Delete tags or branches

Do not commit automatically unless explicitly requested.

## Database Safety

- Treat `fog_community.db` and all SQLite data as sensitive.
- Never delete, restore, migrate, alter schema, run `REINDEX` or `VACUUM`, or perform destructive or data-changing SQL without explicit approval.
- Read-only database inspection may be performed only when necessary for an assigned task.
- Before any approved database-changing operation, preserve a verified backup and state the risk.

## Process and Deployment Safety

- Do not stop, restart, or modify PM2 processes unless explicitly required by the assigned task.
- Never touch production processes unless explicitly authorized.
- The staging process is `fog-staging`.
- The staging project path is `/home/raspi4/fog-portal-staging`.

## Secrets

- Never display, commit, or expose secrets, passwords, private keys, tokens, VAPID private keys, `.env` contents, or credentials.
- Do not add secrets to this file.

## Known Repository State

- Detached HEAD is currently intentional.
- Runtime SQLite WAL and SHM files may appear modified.
- `koinonia-codebase-20260903-0921.zip` may appear untracked.
- Do not reset or delete these merely to make Git status clean.

## Pre-Launch Change Policy

Avoid the following unless required to fix a concrete bug:

- Framework migration
- Replacing SQLite
- Large `server.js` or `app.js` refactor
- Router consolidation
- Mass duplicate-route cleanup
- Database normalization
- Broad CSS or HTML cleanup

## Quality

- Prefer stability and regression prevention over cleverness.
- Verify actual terminal or test results before reporting success.
- If a task is ambiguous or potentially destructive, stop and ask for approval.
