import { createApp } from './app.js';
import open from 'open';

const PORT = process.env.PORT || 5123;
const app = createApp();

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Jobs4UAE Autopilot server running at ${url}`);
  if (process.env.NODE_ENV !== 'test' && process.env.NO_OPEN !== '1') {
    open(url).catch(() => {});
  }
});
