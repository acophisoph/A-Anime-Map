import fs from 'node:fs';

import { repoPath } from '../util/paths';

const src = repoPath('data');
const dst = repoPath('app','public','data');
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
fs.cpSync(src, dst, { recursive: true });
console.log('synced data -> app/public/data');
