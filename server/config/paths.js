import path from 'node:path';
import fs from 'node:fs';

export function dataDir() {
  const override = process.env.JOBS4UAE_DATA_DIR;
  const dir = override || path.resolve(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function configPath() {
  return path.join(dataDir(), 'config.json');
}
