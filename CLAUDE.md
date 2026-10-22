# Kyle's Games

- Every new game goes in its own folder `games/<id>/`. Never put game code in the repo root.
- Create with `./new-game.sh <id> "<Title>"` (copies `template/`, registers in `games/games.json`).
- Each game self-contained: own index.html, style.css, game.js. Shared code only in `shared/`.
- Plain HTML/JS canvas, no build step. Run: `python3 -m http.server 8000`.
