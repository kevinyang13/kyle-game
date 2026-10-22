#!/usr/bin/env bash
# Usage: ./new-game.sh <id> "<Title>"   e.g. ./new-game.sh bug-walk "Bug Walk"
set -euo pipefail
cd "$(dirname "$0")"
id="${1:?id required}"; title="${2:-$1}"
[ -e "games/$id" ] && { echo "games/$id exists"; exit 1; }
cp -R template "games/$id"
sed -i '' "s#NEW GAME#$title#" "games/$id/index.html"
python3 - "$id" "$title" <<'PY'
import json, sys
p = 'games/games.json'
g = json.load(open(p)); g.append({'id': sys.argv[1], 'title': sys.argv[2]})
json.dump(g, open(p, 'w'), indent=2)
PY
echo "Created games/$id"
