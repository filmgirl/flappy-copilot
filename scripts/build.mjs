import { copyFile, mkdir, rm } from 'node:fs/promises';

// Publish only the standalone game, never the test cabinet or dev dependencies.
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await copyFile('index.html', 'dist/index.html');
