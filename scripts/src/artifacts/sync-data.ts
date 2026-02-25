import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('data');
const dst = path.resolve('app/public/data');
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
fs.cpSync(src, dst, { recursive: true });
console.log('synced data -> app/public/data');
