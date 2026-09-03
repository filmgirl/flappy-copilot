import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { cabinetRoot, cabinetSha, verifyCabinet } from './cabinet.mjs';

let ready = false;
if (existsSync(cabinetRoot)) {
  try {
    verifyCabinet();
    ready = true;
  } catch {
    rmSync(cabinetRoot, { recursive: true, force: true });
  }
}

if (!ready) {
  mkdirSync(cabinetRoot, { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', cabinetRoot, ...args], { stdio: 'inherit' });
  git('init');
  git('remote', 'add', 'origin', 'https://github.com/filmgirl/arcade.git');
  git('fetch', '--depth=1', 'origin', cabinetSha);
  git('checkout', '--detach', 'FETCH_HEAD');
}
verifyCabinet();
console.log(`Cabinet ready at ${cabinetRoot} (${cabinetSha})`);
