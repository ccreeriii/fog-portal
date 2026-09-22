'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(repositoryRoot, 'public', 'index.html'), 'utf8');
const appJavaScript = fs.readFileSync(path.join(repositoryRoot, 'public', 'js', 'app.js'), 'utf8');

test('Prayer Partner UI reflects gender-neutral weekly assignments', () => {
    assert.doesNotMatch(indexHtml, /Please update your profile with your gender/i);
    assert.doesNotMatch(indexHtml, /spiritual brother or sister/i);
    assert.doesNotMatch(indexHtml, /Force Daily Pairing Now/i);
    assert.doesNotMatch(indexHtml, /assign new prayer partners every day/i);
    assert.doesNotMatch(indexHtml, /Prayer Partners? (?:are )?assigned every day/i);

    assert.match(indexHtml, /Admin: Force Weekly Pairing Now/);
    assert.match(indexHtml, /Weekly assignments refresh on Mondays\./);
    assert.match(indexHtml, /Your Prayer Partner for this week is/);
    assert.match(indexHtml, /Daily Prayer Covenant/i);
});

test('ordinary member profile gender remains available', () => {
    assert.match(appJavaScript, /id="myEditGender"/);
});
