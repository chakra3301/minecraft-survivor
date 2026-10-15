#!/bin/sh
# One command for the online tests (see ../ONLINE.md):
#   minecraft-survivor/server/test-online.sh [extra playwright args, e.g. -g "friends"]
# 1. rules for the emulators (moderator uid "test-moderator"), 2. the emulator build of the site
# (dist-emulator), 3. the Firebase emulators (auth 9099, firestore 8080, database 9000), 4. the
# Playwright spec against the site served on 127.0.0.1:4385. Nothing leaves this machine except
# the one-time download of the emulator jars by firebase-tools.
set -e
cd "$(dirname "$0")"
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
command -v java >/dev/null || { echo "Java is needed for the Firebase emulators (brew install openjdk)"; exit 1; }
[ -x node_modules/.bin/firebase ] || npm install --no-fund --no-audit
mkdir -p .test
cp firebase.json database.rules.json firestore.indexes.json .test/
node make-rules.mjs --admins test-moderator --out .test/firestore.rules
node ../tools/web/build-public.mjs --emulator --admins test-moderator --google
# Screenshots land in artifacts/online/ (gitignored).
mkdir -p ../../artifacts/online
exec npx firebase emulators:exec --config .test/firebase.json --project demo-minecraft-survivor --only auth,firestore,database \
  "cd ../.. && MCS_ONLINE=1 npx playwright test -c minecraft-survivor/server/playwright.online.config.mjs $*"
