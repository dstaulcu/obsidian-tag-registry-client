#!/usr/bin/env bash
# Deploy the built plugin into an Obsidian vault.
#   scripts/deploy-plugin.sh [vault-path] [--build] [--hot-reload]
# Vault path resolves from: the argument, $OBSIDIAN_VAULT, then VAULT_PATH below.
# Does not touch data.json (settings); use scripts/configure-plugin.sh for that.
set -euo pipefail

# ---- implementation values -------------------------------------------------
VAULT_PATH=""                       # e.g. "C:/Users/david/Documents/Obsidian Vault"
PLUGIN_FILES=(main.js manifest.json styles.css)
# ----------------------------------------------------------------------------

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD=0; HOT=0; ARG_VAULT=""
for a in "$@"; do
  case "$a" in
    --build) BUILD=1 ;;
    --hot-reload) HOT=1 ;;
    -*) echo "Usage: deploy-plugin.sh [vault-path] [--build] [--hot-reload]" >&2; exit 2 ;;
    *) [ -z "$ARG_VAULT" ] || { echo "Only one vault path allowed." >&2; exit 2; }; ARG_VAULT="$a" ;;
  esac
done

VAULT="${ARG_VAULT:-${OBSIDIAN_VAULT:-$VAULT_PATH}}"
[ -n "$VAULT" ] || { echo "No vault set. Pass a path, set \$OBSIDIAN_VAULT, or edit VAULT_PATH in this script." >&2; exit 2; }
[ -d "$VAULT/.obsidian" ] || { echo "Not an Obsidian vault (no .obsidian folder): $VAULT" >&2; exit 1; }

if [ "$BUILD" = 1 ]; then (cd "$ROOT" && npm run build); fi

for f in "${PLUGIN_FILES[@]}"; do
  [ -f "$ROOT/$f" ] || { echo "Missing build output: $f. Run with --build." >&2; exit 1; }
done

ID="$(cd "$ROOT" && node -p "require('./manifest.json').id")"
VERSION="$(cd "$ROOT" && node -p "require('./manifest.json').version")"
DEST="$VAULT/.obsidian/plugins/$ID"
mkdir -p "$DEST"
for f in "${PLUGIN_FILES[@]}"; do cp "$ROOT/$f" "$DEST/$f"; done
[ "$HOT" = 1 ] && : > "$DEST/.hotreload"

echo "Deployed $ID $VERSION -> $DEST"
echo "Reload Obsidian (or toggle the plugin) to pick it up. data.json was not touched."
