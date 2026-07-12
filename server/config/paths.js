import path from 'node:path';

// Where the app persists JSON stores (config, evaluations, tracker, documents…).
//
// Priority:
//   1. JOBS4UAE_DATA_DIR       — explicit override (set this for a custom path).
//   2. Postgres (DATABASE_URL) — used by storage/kv.js when set; dataDir is only
//      used as a filesystem fallback / local dev.
//   3. Serverless writable dir — on Vercel/AWS Lambda the function cwd (/var/task)
//      is READ-ONLY, so writing there throws ENOENT. Use /tmp instead.
//   4. Local dev              — ./data next to the process (writable).
export function dataDir() {
  if (process.env.JOBS4UAE_DATA_DIR) return process.env.JOBS4UAE_DATA_DIR;
  const isServerless =
    !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.LAMBDA_TASK_ROOT;
  if (isServerless) return path.join('/tmp', 'jobs4uae-data');
  return path.resolve(process.cwd(), 'data');
}

export function configPath() {
  return path.join(dataDir(), 'config.json');
}
