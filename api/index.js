import { createCloudApp } from '../server/cloudApp.js';

// Vercel serverless entry. vercel.json rewrites every /api/* request here while
// preserving the original path, so the Express app routes it normally. (The full
// app with the browser features runs locally / in the Phase B companion.)
const app = createCloudApp();

export default function handler(req, res) {
  return app(req, res);
}
