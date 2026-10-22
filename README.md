# Kyle's Games

Plain HTML/JS canvas games. No build step.

- `index.html` – launcher, lists games from `games/games.json`
- `games/<id>/` – one folder per game (index.html, style.css, game.js)
- `shared/` – code reused across games
- `template/` – starter copied for each new game

New game: `./new-game.sh bug-walk "Bug Walk"`

Run: `python3 -m http.server 8000` then open http://localhost:8000
