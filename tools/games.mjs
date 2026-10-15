// The game this repo builds: where its source lives, what gets copied, and its ports.
export const GAMES = {
  'minecraft-survivor': {
    src: 'minecraft-survivor',
    out: 'minecraft-survivor/dist',
    port: 4320, testPort: 4321,
    copy: ['assets', 'css', 'js', 'dev.html', 'favicon.ico', 'manifest.webmanifest', 'sw.js', 'LICENSE'],
    generateIndex: true
  }
};

export function game(name) {
  const g = GAMES[name];
  if (!g) throw new Error(`Unknown game "${name}". Known: ${Object.keys(GAMES).join(', ')}`);
  return { name, ...g };
}
