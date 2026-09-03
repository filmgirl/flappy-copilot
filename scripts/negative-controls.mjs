import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const original = await readFile('dist/index.html', 'utf8');
const cases = [
  {
    name: 'startup',
    marker: 'negative-control-startup',
    html: original.replace("'use strict';", "'use strict'; throw new Error('negative-control-startup');"),
  },
  {
    name: 'asset',
    marker: 'missing-required-asset.js',
    html: original.replace('</head>', '<script src="./missing-required-asset.js"></script></head>'),
  },
];
await mkdir('.cache/negative-controls', { recursive: true });
try {
  for (const control of cases) {
    await writeFile('dist/index.html', control.html);
    const result = spawnSync(process.execPath, [
      'node_modules/@playwright/test/cli.js', 'test',
      '--project=desktop-chromium', '--grep=mouse launch', '--timeout=10000',
      '--reporter=line', `--output=.cache/negative-controls/${control.name}`,
    ], { encoding: 'utf8' });
    if (result.error) throw result.error;
    const log = result.stdout + result.stderr;
    await writeFile(`.cache/negative-controls/${control.name}.log`, log);
    if (result.status !== 1 || !log.includes(control.marker) || !log.includes('1 failed')) {
      throw new Error(`Negative control ${control.name} did not fail as expected:\n${log}`);
    }
    console.log(`PASS: broken candidate ${control.name} rejected (${control.marker}).`);
  }
} finally {
  await writeFile('dist/index.html', original);
}
