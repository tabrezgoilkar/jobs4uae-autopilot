import { createCloudApp } from '../server/cloudApp.js';

// Vercel serverless entry: every /api/* request is handled by the cloud Express
// app. (The full app with the browser features runs locally / in the companion.)
const app = createCloudApp();

export default function handler(req, res) {
  return app(req, res);
}
