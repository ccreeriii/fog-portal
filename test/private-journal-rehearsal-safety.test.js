'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');


const source =
    fs.readFileSync(
        path.join(
            __dirname,
            '..',
            'scripts',
            'private-journal-disposable-rehearsal.js'
        ),
        'utf8'
    );


test(
    'disposable rehearsal contains only explicitly synthetic member identifiers',
    () => {
        assert.match(
            source,
            /Synthetic Adult/
        );

        assert.match(
            source,
            /Synthetic Guardian/
        );

        assert.match(
            source,
            /FOG_REHEARSAL_ADULT_CONTENT/
        );

        assert.doesNotMatch(
            source,
            /\/home\/raspi4\/fogmin-portal-v3/
        );
    }
);


test(
    'disposable rehearsal exercises safeguarding age groups',
    () => {
        assert.match(
            source,
            /guardian_authorization_required/
        );

        assert.match(
            source,
            /youth_reflection/
        );

        assert.match(
            source,
            /under_10/
        );

        assert.match(
            source,
            /birthday_required/
        );
    }
);


test(
    'disposable rehearsal exercises encryption recovery tamper and migration',
    () => {
        assert.match(
            source,
            /encryptEntry/
        );

        assert.match(
            source,
            /decryptEntry/
        );

        assert.match(
            source,
            /recoverMasterKey/
        );

        assert.match(
            source,
            /tamperCiphertext/
        );

        assert.match(
            source,
            /title = NULL/
        );

        assert.match(
            source,
            /content = NULL/
        );

        assert.match(
            source,
            /mood = NULL/
        );
    }
);


test(
    'disposable rehearsal performs WAL cleanup and forensic sentinel scan',
    () => {
        assert.match(
            source,
            /truncatePrivateJournalWal/
        );

        assert.match(
            source,
            /bytes\.includes/
        );

        assert.match(
            source,
            /ciphertext-only/
        );
    }
);



test(
    'rehearsal normalizes structured Recovery Key result before decryption',
    () => {
        assert.match(
            source,
            /recovered\.masterKey/
        );

        assert.match(
            source,
            /recovered\.key/
        );

        assert.match(
            source,
            /masterKey\.type/
        );

        assert.match(
            source,
            /type !==\s*'secret'/
        );
    }
);
