import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, access, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('desktop packaging excludes Notes, including stale bundles, and retains flashcards', async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'lint-package-'));
  try {
    execFileSync(process.execPath, ['macos/scripts/prepare-site.mjs', output]);
    await writeFile(path.join(output, 'site/notes-native.js'), 'stale');
    execFileSync(process.execPath, ['macos/scripts/prepare-site.mjs', output]);
    const html = await readFile(path.join(output, 'site/index.html'), 'utf8');
    assert.doesNotMatch(html, /notes\/(?:app.js|style.css)|notes-native.js/);
    assert.match(html, /src="app.js"/);
    await access(path.join(output, 'site/app.js'));
    await assert.rejects(access(path.join(output, 'site/notes')), {code:'ENOENT'});
    await assert.rejects(access(path.join(output, 'site/notes-native.js')), {code:'ENOENT'});
  } finally {
    await rm(output, {recursive:true, force:true});
  }
});
