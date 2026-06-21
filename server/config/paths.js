import path from 'node:path';

export function dataDir() {
  return process.env.JOBS4UAE_DATA_DIR || path.resolve(process.cwd(), 'data');
}

export function configPath() {
  return path.join(dataDir(), 'config.json');
}
