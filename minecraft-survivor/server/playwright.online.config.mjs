import { defineConfig } from '@playwright/test';

// Minecraft Survivor's online tests: the emulator build (dist-emulator) on 127.0.0.1:4385 against the
// Firebase emulators. Run with ./test-online.sh (it starts the emulators and builds the site).
// Its own config: the root one serves the private builds and skips this spec (MCS_ONLINE unset).
export default defineConfig({
  testDir: '../../tests',
  testMatch: 'minecraft-survivor-online.spec.mjs',
  timeout: 240_000,
  workers: 1,                       // one shared set of emulators
  outputDir: '../../test-results/online',
  use: {
    viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', baseURL: 'http://127.0.0.1:4385',
    // Co-op peers in two browser contexts on this machine connect over plain host candidates.
    launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] }
  },
  webServer: {
    command: 'node minecraft-survivor/tools/web/serve-public.mjs minecraft-survivor/dist-emulator --port 4385',
    cwd: '../..',
    url: 'http://127.0.0.1:4385/online-build.json',
    reuseExistingServer: !!process.env.MCS_REUSE
  }
});
