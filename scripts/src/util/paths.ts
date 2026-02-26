import fs from 'node:fs';
import path from 'node:path';

function hasRepoMarkers(dir: string) {
  return fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'app')) && fs.existsSync(path.join(dir, 'scripts'));
}

export function findRepoRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  while (true) {
    if (hasRepoMarkers(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Unable to locate repository root from ${start}`);
}

export function repoPath(...parts: string[]) {
  return path.join(findRepoRoot(), ...parts);
}
