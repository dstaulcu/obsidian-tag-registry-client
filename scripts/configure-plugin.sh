#!/usr/bin/env bash
# Write the plugin's user settings (data.json) into an Obsidian vault.
#   scripts/configure-plugin.sh [vault-path] [--dry-run]
# Edit the variables below; they map 1:1 onto the settings tab (src/settings.ts).
# Close Obsidian first, or it may overwrite data.json when settings are next saved.
# Existing data.json is backed up to data.json.bak. knownTeams is preserved.
set -euo pipefail

# ---- implementation values (user config settings) ---------------------------
VAULT_PATH=""                       # e.g. "C:/Users/david/Documents/Obsidian Vault"

# Registries to merge; order is precedence. One entry per source: "repoUrl|ref|authMethod|token"
#   ref         branch or tag (default main)
#   authMethod  https | git | token
#   token       optional; stored in PLAIN TEXT in data.json (leave empty to use Obsidian secret storage)
SOURCES=(
  "|main|https|"                    # <- set the registry repo URL, e.g. "https://github.com/org/tag-registry|main|https|"
)

TEAMS=()                            # selected team ids, e.g. (platform data); the core is always included
ALL_TEAMS=false                     # true = subscribe to every team
DEST_FOLDER="Tags"                  # vault folder imported notes land in
STARTUP_MODE="notify"               # off | notify | auto
# ----------------------------------------------------------------------------

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY=0; ARG_VAULT=""
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    -*) echo "Usage: configure-plugin.sh [vault-path] [--dry-run]" >&2; exit 2 ;;
    *) [ -z "$ARG_VAULT" ] || { echo "Only one vault path allowed." >&2; exit 2; }; ARG_VAULT="$a" ;;
  esac
done

VAULT="${ARG_VAULT:-${OBSIDIAN_VAULT:-$VAULT_PATH}}"
[ -n "$VAULT" ] || { echo "No vault set. Pass a path, set \$OBSIDIAN_VAULT, or edit VAULT_PATH in this script." >&2; exit 2; }
[ -d "$VAULT/.obsidian" ] || { echo "Not an Obsidian vault (no .obsidian folder): $VAULT" >&2; exit 1; }

case "$STARTUP_MODE" in off|notify|auto) ;; *) echo "STARTUP_MODE must be off|notify|auto" >&2; exit 2 ;; esac
case "$ALL_TEAMS" in true|false) ;; *) echo "ALL_TEAMS must be true|false" >&2; exit 2 ;; esac
for s in "${SOURCES[@]}"; do
  IFS='|' read -r url _ method _ <<<"$s"
  [ -n "$url" ] || { echo "A SOURCES entry has no repo URL; edit SOURCES in this script." >&2; exit 2; }
  case "${method:-https}" in https|git|token) ;; *) echo "authMethod must be https|git|token (got '$method')" >&2; exit 2 ;; esac
done

ID="$(cd "$ROOT" && node -p "require('./manifest.json').id")"
DIR="$VAULT/.obsidian/plugins/$ID"
FILE="$DIR/data.json"

# Build the JSON in node (merges over any existing file; no jq dependency).
JSON="$(
  SOURCES_RAW="$(printf '%s\n' "${SOURCES[@]}")" \
  TEAMS_RAW="$(printf '%s\n' "${TEAMS[@]+"${TEAMS[@]}"}")" \
  ALL_TEAMS="$ALL_TEAMS" DEST_FOLDER="$DEST_FOLDER" STARTUP_MODE="$STARTUP_MODE" EXISTING="$FILE" \
  node -e '
    const fs = require("fs"), e = process.env
    let old = {}
    try { old = JSON.parse(fs.readFileSync(e.EXISTING, "utf8")) } catch {}
    const prev = Array.isArray(old.sources) ? old.sources : []
    const sources = e.SOURCES_RAW.split("\n").filter(Boolean).map((line, i) => {
      const [repoUrl, ref, authMethod, token] = line.split("|")
      // keep the id of an existing source with the same URL so stored secrets stay linked
      const match = prev.find((p) => p && p.repoUrl === repoUrl)
      return { id: (match && match.id) || "src-cfg" + (i + 1), repoUrl, ref: ref || "main", authMethod: authMethod || "https", token: token || "" }
    })
    process.stdout.write(JSON.stringify({
      schemaVersion: 1,
      sources,
      teams: e.TEAMS_RAW.split("\n").filter(Boolean),
      allTeams: e.ALL_TEAMS === "true",
      knownTeams: Array.isArray(old.knownTeams) ? old.knownTeams : [],
      destFolder: e.DEST_FOLDER,
      startupMode: e.STARTUP_MODE,
    }, null, 2) + "\n")
  '
)"

if [ "$DRY" = 1 ]; then
  echo "Would write $FILE (tokens masked):"
  printf '%s\n' "$JSON" | sed -E 's/("token": ")[^"]+/\1***/'
  exit 0
fi

mkdir -p "$DIR"
[ -f "$FILE" ] && cp "$FILE" "$FILE.bak"
printf '%s\n' "$JSON" > "$FILE"
echo "Wrote settings -> $FILE"
echo "Restart Obsidian (or toggle the plugin) to load them."
