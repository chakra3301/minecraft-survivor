# Minecraft Survivor

A free, open-source survivor game you play in the browser. Pick a mob, fight the hordes and climb eight
floors (the Overworld, the Ocean, the Underworld, the Nether, the Stronghold, the End, the Ancient City and
Herobrine's World), then survive Herobrine to reach the Aether. Play alone or with up to three friends.

**Play it at [minersurvivor.com](https://minersurvivor.com).**

> Unofficial fan game. Not affiliated with Mojang or Microsoft. Minecraft assets © Mojang.
> This repository holds only the code. No Mojang textures, models or music are in it:
> you generate them locally from Mojang's public samples and your own Minecraft install.

## Features
- 200+ mobs rendered from Mojang's Bedrock models, each with its own skills, and a Spawner with themed packs
- Eight floors with their own goals and bosses: the Raid, three Elder Guardians, the Wither, the End Portal room,
  the End Crystals and the Ender Dragon, the Warden, Herobrine, and the Aether
- Enchanting: beat the Ender Dragon with a character to unlock it, then put books from bosses on its weapons
- Online: accounts and cloud saves, a leaderboard (deepest floor, then time), friends and co-op for 2–4 players

## Run it locally
Needs Node 22+ and git.

```sh
npm install
npx playwright install chromium   # renders the mob sprites and runs the tests
npm run mc:vendor                 # Mojang's bedrock-samples (models and textures) into vendor/
npm run mc:assets                 # sprites, block textures and icons from them
npm run mc:music                  # optional: the soundtrack from YOUR Minecraft Java install
npm run build && npm start        # http://127.0.0.1:4320/
```

Without `mc:music` the game plays its own synthesized music. `npm run dev` serves the source without a
build (open `/dev.html`). `npm test` builds, verifies and runs the browser tests.

The local build is offline: saves stay in your browser. The online site needs a Firebase project of your own;
see [`minecraft-survivor/ONLINE.md`](minecraft-survivor/ONLINE.md) for the rules, the public build and the
emulator tests (`npm run online:test`).

## Where things are
- `minecraft-survivor/js/`: the game (vanilla JavaScript on Canvas 2D)
- `minecraft-survivor/tools/mc/`: the asset pipeline (mob roster, renderer, data generator)
- `minecraft-survivor/server/`: Firebase rules and emulator tests; `tools/web/`: the public build
- `minecraft-survivor/CONTENT.md`: the content bible (floors, mobs, skills, items)

## Credits and license
The engine is a fork of [PokéSurvivor](https://github.com/JPTER78/pokesurvivor) by JPTER78 (MIT).
The code is MIT licensed (see [LICENSE](LICENSE)). The Pixelify Sans font is under the SIL Open Font License.
Minecraft and its textures, models and music belong to Mojang and Microsoft and are not included.

If you enjoy it, you can [buy me a coffee](https://buymeacoffee.com/nokiademon).
