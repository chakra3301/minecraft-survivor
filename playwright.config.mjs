import { defineConfig } from '@playwright/test';
import { GAMES } from './tools/games.mjs';

// A private test server on its own port (never the dev port, so tests don't touch your saves).
// The online spec skips itself unless run through minecraft-survivor/server/test-online.sh.
const g = GAMES['minecraft-survivor'];
export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  outputDir: 'test-results',
  use: { viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', baseURL: `http://127.0.0.1:${g.testPort}` },
  webServer: { command: `PORT=${g.testPort} node tools/serve.mjs minecraft-survivor`, url: `http://127.0.0.1:${g.testPort}/`, reuseExistingServer: false }
});
