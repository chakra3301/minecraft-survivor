#!/bin/sh
# Sparse-clones Mojang's bedrock-samples (models, entity defs, textures) at a pinned commit into vendor/.
# Everything in minecraft-survivor/assets/{mobs,mc} is generated from it.
set -e
cd "$(dirname "$0")/../../.."
REV=46ba6ea985fb5a92d79a9419198f10dda14c199d
DIR=vendor/bedrock-samples
if [ ! -d "$DIR/.git" ]; then
  mkdir -p vendor
  git clone --filter=blob:none --sparse --no-checkout https://github.com/Mojang/bedrock-samples.git "$DIR"
fi
git -C "$DIR" sparse-checkout set resource_pack/models/entity resource_pack/textures/entity resource_pack/textures/blocks \
  resource_pack/textures/items resource_pack/animations resource_pack/entity resource_pack/textures/particle \
  resource_pack/textures/environment resource_pack/textures/ui resource_pack/texts \
  resource_pack/textures/models
git -C "$DIR" fetch --depth 1 origin "$REV"
git -C "$DIR" checkout -q "$REV"
echo "bedrock-samples at $REV"
