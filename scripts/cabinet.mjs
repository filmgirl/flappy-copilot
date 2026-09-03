import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export const cabinetSha = '18b9d013a9591c9d97348f21023f875eb2a7630b';
export const cabinetRoot = resolve('.cache/cabinet');
export const port = Number(process.env.CABINET_PORT || 4262);
export const origin = `http://127.0.0.1:${port}`;

export function verifyCabinet() {
  const git = (...args) => execFileSync('git', ['-C', cabinetRoot, ...args], { encoding: 'utf8' }).trim();
  if (git('rev-parse', 'HEAD') !== cabinetSha || git('status', '--porcelain')) {
    throw new Error(`Cabinet must be a clean checkout of ${cabinetSha}. Remove ${cabinetRoot} and run npm run cabinet:setup.`);
  }
}
