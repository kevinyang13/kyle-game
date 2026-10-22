// Antarctica Survival — hunt with a bow, pull ice to build walls, stay warm in the log cabin,
// and dodge polar bears and narwhals (they only hurt you when they JUMP on you).
// `keys` (Set of held keys) comes from ../../shared/input.js

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const light = document.createElement('canvas');
const lctx = light.getContext('2d');
function resize() {
  canvas.width = light.width = innerWidth;
  canvas.height = light.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// ---------- helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const held = (...ks) => ks.some(k => keys.has(k) || keys.has(k.toUpperCase()));
const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
function ellipse(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); }
function circle(x, y, r) { ellipse(x, y, r, r); }

// ---------- world ----------
const TS = 32, MW = 96, MH = 72;
const T = { SNOW: 0, WATER: 1, ICE: 2, WALL: 3, FLOOR: 4, FIRE: 5, COUNTER: 6, DISH: 7, TABLE: 8 };
const PLAYER_BLOCK = new Set([T.WATER, T.ICE, T.WALL, T.FIRE, T.COUNTER, T.DISH, T.TABLE]);
const ARROW_BLOCK = new Set([T.ICE, T.WALL, T.FIRE, T.COUNTER, T.DISH, T.TABLE]);
const CAB = { x: 42, y: 30, w: 12, h: 9 };
const CAB_CENTER = { x: (CAB.x + CAB.w / 2) * TS, y: (CAB.y + CAB.h / 2) * TS };
const FIRE_POS = { x: (CAB.x + 6) * TS, y: (CAB.y + 1) * TS };
const STOVE_POS = { x: (CAB.x + 9.5) * TS, y: (CAB.y + 1.5) * TS };
const DISH_POS = { x: (CAB.x + 10.5) * TS, y: (CAB.y + 1.5) * TS };
const CHIMNEY = { x: (CAB.x + 6) * TS, y: CAB.y * TS + 6 };
const DAY = 150; // seconds per day

let map;
const getTile = (tx, ty) => (tx < 0 || ty < 0 || tx >= MW || ty >= MH) ? T.WATER : map[ty * MW + tx];
const setTile = (tx, ty, v) => { map[ty * MW + tx] = v; };
const tileAt = (x, y) => getTile(Math.floor(x / TS), Math.floor(y / TS));
const center = (tx, ty) => ({ x: tx * TS + TS / 2, y: ty * TS + TS / 2 });
function hasNear(tx, ty, r, type) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (getTile(tx + dx, ty + dy) === type) return true;
  return false;
}

const CHAIRS = [
  { tx: 2, ty: 5, back: 'left' }, { tx: 5, ty: 5, back: 'right' },
  { tx: 3, ty: 6, back: 'down' }, { tx: 4, ty: 6, back: 'down' },
  { tx: 4, ty: 2, arm: true }, { tx: 7, ty: 2, arm: true },
].map(c => ({ ...c, ...center(CAB.x + c.tx, CAB.y + c.ty) }));

function genMap() {
  map = new Uint8Array(MW * MH);
  const p = Array.from({ length: 6 }, () => rand(0, Math.PI * 2));
  const coast = (x, y) => (Math.sin(x * 0.21 + p[0]) * Math.sin(y * 0.17 + p[1]) + Math.sin(x * 0.07 + y * 0.05 + p[2]) + 0.5 * Math.sin(y * 0.31 + p[3])) / 2.5;
  const lake = (x, y) => Math.sin(x * 0.13 + p[4]) * Math.sin(y * 0.15 + p[5]);
  const cabDist = (x, y) => Math.hypot(x - (CAB.x + 6), y - (CAB.y + 4));

  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const edge = Math.min(x, y, MW - 1 - x, MH - 1 - y);
    let t = T.SNOW;
    if (edge < 5 + coast(x, y) * 3) t = T.WATER;
    else if (cabDist(x, y) > 16 && lake(x, y) > 0.8) t = T.WATER;
    map[y * MW + x] = t;
  }
  // ice blocks along the shore and in clusters
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (getTile(x, y) === T.SNOW && cabDist(x, y) > 10 && hasNear(x, y, 1, T.WATER) && Math.random() < 0.25) setTile(x, y, T.ICE);
  }
  for (let i = 0; i < 40; i++) {
    const cx = Math.floor(rand(6, MW - 6)), cy = Math.floor(rand(6, MH - 6));
    if (cabDist(cx, cy) < 12) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.hypot(dx, dy) < 2.3 && Math.random() < 0.55 && getTile(cx + dx, cy + dy) === T.SNOW) setTile(cx + dx, cy + dy, T.ICE);
    }
  }
  // wooden log cabin
  for (let dy = 0; dy < CAB.h; dy++) for (let dx = 0; dx < CAB.w; dx++) {
    const edge = dx === 0 || dy === 0 || dx === CAB.w - 1 || dy === CAB.h - 1;
    setTile(CAB.x + dx, CAB.y + dy, edge ? T.WALL : T.FLOOR);
  }
  setTile(CAB.x + 5, CAB.y + CAB.h - 1, T.FLOOR); // door
  setTile(CAB.x + 6, CAB.y + CAB.h - 1, T.FLOOR);
  setTile(CAB.x + 5, CAB.y, T.FIRE); // fireplace
  setTile(CAB.x + 6, CAB.y, T.FIRE);
  setTile(CAB.x + 8, CAB.y + 1, T.COUNTER); // sink
  setTile(CAB.x + 9, CAB.y + 1, T.COUNTER); // stove
  setTile(CAB.x + 10, CAB.y + 1, T.DISH);
  setTile(CAB.x + 10, CAB.y + 2, T.COUNTER); // cutting board
  setTile(CAB.x + 3, CAB.y + 5, T.TABLE);
  setTile(CAB.x + 4, CAB.y + 5, T.TABLE);
  for (let dy = 0; dy < 4; dy++) for (let dx = 3; dx < 9; dx++) setTile(CAB.x + dx, CAB.y + CAB.h + dy, T.SNOW);
}

// ---------- animals ----------
const STATS = {
  penguin: { hp: 1, r: 10, speed: 35, run: 90, meat: 1 },
  seal: { hp: 2, r: 15, speed: 18, run: 40, meat: 3 },
  petrel: { hp: 1, r: 9, speed: 60, run: 170, meat: 1 },
  bear: { hp: 5, r: 22, speed: 45, run: 110, meat: 6 },
  narwhal: { hp: 3, r: 18, speed: 45, run: 0, meat: 4 },
};
const NAMES = { penguin: 'penguin', seal: 'seal', petrel: 'snow petrel', bear: 'polar bear', narwhal: 'narwhal' };
const landOk = t => t === T.SNOW;
const waterOk = t => t === T.WATER;
const SPOT = {
  penguin: (tx, ty) => getTile(tx, ty) === T.SNOW,
  seal: (tx, ty) => getTile(tx, ty) === T.SNOW && hasNear(tx, ty, 2, T.WATER),
  petrel: (tx, ty) => getTile(tx, ty) === T.SNOW,
  bear: (tx, ty) => getTile(tx, ty) === T.SNOW,
  narwhal: (tx, ty) => getTile(tx, ty) === T.WATER && hasNear(tx, ty, 3, T.SNOW),
};
const count = type => game.ents.filter(e => e.type === type).length;
const target = type => ({ penguin: 18, seal: 7, petrel: 6, narwhal: 8, bear: 3 + Math.min(day() - 1, 4) })[type];

function spawn(type, opts = {}) {
  const minCab = opts.minCab ?? (type === 'bear' ? 22 : 9);
  for (let i = 0; i < 2000; i++) {
    const tx = Math.floor(Math.random() * MW), ty = Math.floor(Math.random() * MH);
    if (!SPOT[type](tx, ty)) continue;
    const cd = Math.hypot(tx - (CAB.x + 6), ty - (CAB.y + 4));
    if (cd < minCab || cd > (opts.maxCab ?? 1e9)) continue;
    const pos = center(tx, ty);
    if (opts.awayFrom && dist(pos, opts.awayFrom) < 650) continue;
    game.ents.push({
      type, ...STATS[type], ...pos, dir: rand(0, 6.28), t: 0, cd: 2, timer: 0, z: 0, hit: 0, face: 1,
      state: type === 'narwhal' ? 'swim' : 'wander', moving: false, anim: rand(0, 10),
    });
    return;
  }
}

function blocked(x, y, r, ok) {
  const k = r * 0.7;
  return !ok(tileAt(x - k, y - k)) || !ok(tileAt(x + k, y - k)) || !ok(tileAt(x - k, y + k)) || !ok(tileAt(x + k, y + k)) || !ok(tileAt(x, y));
}
function moveBy(e, dx, dy, ok) {
  let moved = true;
  if (!blocked(e.x + dx, e.y, e.r, ok)) e.x += dx; else moved = false;
  if (!blocked(e.x, e.y + dy, e.r, ok)) e.y += dy; else moved = false;
  return moved;
}
// Move toward an angle, trying slight detours around obstacles.
function steer(e, ang, sp, dt, ok) {
  for (const off of [0, 0.7, -0.7, 1.4, -1.4]) {
    const a = ang + off, dx = Math.cos(a) * sp * dt, dy = Math.sin(a) * sp * dt;
    if (!blocked(e.x + dx, e.y + dy, e.r, ok)) { e.x += dx; e.y += dy; e.dir = a; return true; }
  }
  return false;
}
function wander(e, dt, sp, ok) {
  if (e.t <= 0) { e.t = rand(1, 3); e.dir = rand(0, Math.PI * 2); e.moving = Math.random() < 0.7; }
  if (e.moving && !steer(e, e.dir, sp, dt, ok)) e.dir += Math.PI;
}

function updatePrey(e, dt, d, toP) {
  if (d < 160) { e.moving = true; steer(e, toP + Math.PI, e.run, dt, landOk); }
  else wander(e, dt, e.speed, landOk);
  e.face = Math.cos(e.dir) >= 0 ? 1 : -1;
}

function updatePetrel(e, dt, d, toP) {
  let sp = e.speed;
  if (d < 150) { e.dir = toP + Math.PI + Math.sin(game.time * 3) * 0.4; sp = e.run; }
  else if (e.t <= 0) { e.t = rand(1, 3); e.dir += rand(-1, 1); }
  e.x += Math.cos(e.dir) * sp * dt;
  e.y += Math.sin(e.dir) * sp * dt;
  if (e.x < TS || e.y < TS || e.x > (MW - 1) * TS || e.y > (MH - 1) * TS) {
    e.x = clamp(e.x, TS, (MW - 1) * TS); e.y = clamp(e.y, TS, (MH - 1) * TS); e.dir += Math.PI;
  }
}

function updateBear(e, dt, d, toP, inside) {
  switch (e.state) {
    case 'wander':
      wander(e, dt, e.speed, landOk);
      if (!inside && (d < 280 || e.angry)) e.state = 'chase';
      break;
    case 'chase':
      if (inside || d > 500) { e.state = 'wander'; e.angry = false; break; }
      steer(e, toP, e.run, dt, landOk);
      if (d < 120) { e.state = 'windup'; e.timer = 0.5; }
      break;
    case 'windup': // crouch and wiggle — this is your warning to dodge!
      e.dir = toP;
      e.timer -= dt;
      if (e.timer <= 0) { e.state = 'jump'; e.timer = 0.4; e.didHit = false; }
      break;
    case 'jump':
      e.timer -= dt;
      e.z = Math.sin((1 - e.timer / 0.4) * Math.PI) * 22;
      moveBy(e, Math.cos(e.dir) * 340 * dt, Math.sin(e.dir) * 340 * dt, landOk);
      if (!e.didHit && !inside && dist(e, player) < e.r + player.r + 4) {
        e.didHit = true;
        hurt(35, 'A polar bear jumped on you!');
      }
      if (e.timer <= 0) { e.z = 0; e.state = 'rest'; e.timer = 1.4; }
      break;
    case 'rest':
      e.timer -= dt;
      if (e.timer <= 0) e.state = 'chase';
      break;
  }
}

function updateNarwhal(e, dt, d, toP, inside) {
  const playerOnLand = tileAt(player.x, player.y) === T.SNOW;
  switch (e.state) {
    case 'swim':
      wander(e, dt, e.speed, waterOk);
      if (playerOnLand && d < 180 && e.cd <= 0) { e.state = 'windup'; e.timer = 0.7; }
      break;
    case 'windup':
      e.dir = toP;
      e.timer -= dt;
      if (e.timer <= 0) {
        const L = Math.min(d, 190);
        Object.assign(e, { sx: e.x, sy: e.y, tx: e.x + Math.cos(toP) * L, ty: e.y + Math.sin(toP) * L, state: 'leap', lt: 0 });
        puff(e.x, e.y, '#bfe6ff', 10);
      }
      break;
    case 'leap': {
      e.lt += dt / 0.75;
      const k = Math.min(e.lt, 1);
      e.x = e.sx + (e.tx - e.sx) * k;
      e.y = e.sy + (e.ty - e.sy) * k;
      e.z = Math.sin(k * Math.PI) * 50;
      if (e.lt >= 1) {
        e.z = 0;
        if (!inside && dist(e, player) < e.r + player.r + 4) hurt(45, 'A narwhal jumped on you!');
        if (tileAt(e.x, e.y) === T.WATER) { e.state = 'swim'; e.cd = 4; puff(e.x, e.y, '#bfe6ff', 10); }
        else e.state = 'flop';
      }
      break;
    }
    case 'flop': // stuck on land, wiggling back to the water — easy target!
      e.dir = Math.atan2(e.sy - e.y, e.sx - e.x);
      e.x += Math.cos(e.dir) * 30 * dt;
      e.y += Math.sin(e.dir) * 30 * dt;
      if (Math.hypot(e.sx - e.x, e.sy - e.y) < 4) { e.state = 'swim'; e.cd = 4; puff(e.x, e.y, '#bfe6ff', 10); }
      break;
  }
}

function updateEnts(dt) {
  const inside = isInside();
  for (const e of game.ents) {
    e.hit -= dt; e.t -= dt; e.cd -= dt; e.anim += dt * 8;
    const d = dist(e, player), toP = Math.atan2(player.y - e.y, player.x - e.x);
    if (e.type === 'bear') updateBear(e, dt, d, toP, inside);
    else if (e.type === 'narwhal') updateNarwhal(e, dt, d, toP, inside);
    else if (e.type === 'petrel') updatePetrel(e, dt, d, toP);
    else updatePrey(e, dt, d, toP);
  }
}

function kill(e) {
  e.dead = true;
  game.hunted++;
  puff(e.x, e.y - e.z, '#ffffff', 16);
  if (tileAt(e.x, e.y) === T.WATER) { inv.raw += e.meat; floatText(player.x, player.y - 20, `+${e.meat} 🥩`); }
  else game.items.push({ x: e.x, y: e.y, n: e.meat, bob: rand(0, 6) });
  toast(`You got a ${NAMES[e.type]}!`);
}

// ---------- game state ----------
const game = { mode: 'title', time: 0, ents: [], arrows: [], items: [], parts: [], flyIce: [], nets: [], toasts: [], smoke: [], shake: 0, dishTimer: 0, spawnT: 0, smokeT: 0, hunted: 0, cause: '', deadT: 0 };
let player, inv;
const cam = { x: 0, y: 0 };
const mouse = { x: 0, y: 0, down: false };
const flakes = Array.from({ length: 140 }, () => ({ x: rand(0, 2400), y: rand(0, 1400), s: rand(1, 3), v: rand(20, 60), w: rand(0, 6) }));
const day = () => Math.floor(game.time / DAY) + 1;
const isInside = () => tileAt(player.x, player.y) === T.FLOOR;
const toWorld = m => ({ x: m.x + cam.x, y: m.y + cam.y });

function darkness() {
  const ph = (game.time % DAY) / DAY;
  if (ph < 0.55) return 0;
  if (ph < 0.65) return (ph - 0.55) / 0.1 * 0.75;
  if (ph < 0.9) return 0.75;
  return (1 - ph) / 0.1 * 0.75;
}

function newGame() {
  genMap();
  Object.assign(game, { time: DAY * 0.05, ents: [], arrows: [], items: [], parts: [], flyIce: [], nets: [], toasts: [], smoke: [], shake: 0, dishTimer: 0, spawnT: 5, hunted: 0, cause: '' });
  player = { ...center(CAB.x + 6, CAB.y + 4), r: 12, hp: 100, hunger: 100, warmth: 100, aim: 0, cool: 0, invuln: 0, sitting: null, walk: 0 };
  inv = { raw: 3, cooked: 0, ice: 0, fish: 0 }; // start with a few penguins for food
  for (let i = 0; i < 4; i++) spawn('penguin', { minCab: 8, maxCab: 14 });
  for (const type in STATS) for (let i = 0; i < 40 && count(type) < target(type); i++) spawn(type);
  game.mode = 'play';
  toast('You have 3 penguins of food. Cook them at the fire!');
}

function toast(text) { game.toasts.push({ text, t: 3 }); if (game.toasts.length > 4) game.toasts.shift(); }
function floatText(x, y, text) { game.parts.push({ x, y, vx: 0, vy: -30, life: 1.2, max: 1.2, text }); }
function puff(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(20, 90);
    game.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), max: 0.7, color, size: rand(2, 4) });
  }
}

function damage(n, cause) {
  player.hp -= n;
  if (player.hp <= 0 && game.mode === 'play') { player.hp = 0; game.mode = 'dead'; game.cause = cause; game.deadT = 0; }
}
function hurt(n, cause) {
  if (player.invuln > 0) return;
  player.invuln = 1;
  player.sitting = null;
  game.shake = 0.4;
  puff(player.x, player.y, '#ff6b5b', 12);
  toast(cause);
  damage(n, cause);
}

// ---------- player actions ----------
function shoot() {
  const p = player;
  p.sitting = null;
  p.cool = 0.45;
  game.arrows.push({ x: p.x + Math.cos(p.aim) * 14, y: p.y + Math.sin(p.aim) * 14, vx: Math.cos(p.aim) * 650, vy: Math.sin(p.aim) * 650, life: 0.9 });
}

function eat() {
  if (inv.cooked > 0) { inv.cooked--; player.hunger = Math.min(100, player.hunger + 35); player.hp = Math.min(100, player.hp + 5); toast('Yum! Cooked meat 🍖'); }
  else if (inv.raw > 0) { inv.raw--; player.hunger = Math.min(100, player.hunger + 15); damage(3, 'You got sick from raw meat.'); toast('Raw meat... yuck! Cook it next time.'); }
  else toast('No food! Go hunt with your bow.');
}

function findIce() {
  const p = player, m = toWorld(mouse);
  const mtx = Math.floor(m.x / TS), mty = Math.floor(m.y / TS);
  if (getTile(mtx, mty) === T.ICE && dist(p, center(mtx, mty)) < 80) return { tx: mtx, ty: mty };
  let best = null, bd = 1e9;
  const ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const tx = ptx + dx, ty = pty + dy, c = center(tx, ty);
    if (getTile(tx, ty) === T.ICE && dist(p, c) < 56 && dist(c, m) < bd) { bd = dist(c, m); best = { tx, ty }; }
  }
  return best;
}
function pullIce({ tx, ty }) {
  setTile(tx, ty, T.SNOW);
  const c = center(tx, ty);
  game.flyIce.push({ ...c, t: 0 });
  puff(c.x, c.y, '#d5f2ff', 10);
}

function placeTarget() {
  const m = toWorld(mouse), tx = Math.floor(m.x / TS), ty = Math.floor(m.y / TS), c = center(tx, ty);
  if (inv.ice <= 0 || getTile(tx, ty) !== T.SNOW || dist(player, c) > 100 || dist(player, c) < 36) return null;
  if (game.ents.some(e => e.type !== 'petrel' && dist(e, c) < e.r + 20)) return null;
  return { tx, ty };
}
function placeIce() {
  const t = placeTarget();
  if (!t) { if (inv.ice <= 0) toast('No ice! Pull out ice blocks with E.'); return; }
  setTile(t.tx, t.ty, T.ICE);
  inv.ice--;
  const c = center(t.tx, t.ty);
  puff(c.x, c.y, '#d5f2ff', 8);
}

// ---------- fishing nets ----------
const MAX_NETS = 3;
const netOk = (tx, ty) => {
  const t = getTile(tx, ty);
  return (t === T.SNOW || t === T.WATER) && hasNear(tx, ty, 2, T.WATER) && !game.nets.some(n => n.tx === tx && n.ty === ty);
};
const nearLake = () => hasNear(Math.floor(player.x / TS), Math.floor(player.y / TS), 2, T.WATER);

// Tile ahead of you first, then the one you stand on, then the ones around you.
function netSpot() {
  const p = player, ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
  const aheadX = Math.floor((p.x + Math.cos(p.aim) * TS) / TS), aheadY = Math.floor((p.y + Math.sin(p.aim) * TS) / TS);
  const spots = [[aheadX, aheadY], [ptx, pty]];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) spots.push([ptx + dx, pty + dy]);
  for (const [tx, ty] of spots) if (netOk(tx, ty)) return { tx, ty };
  return null;
}

function placeNet() {
  if (game.nets.length >= MAX_NETS) return toast(`You can only have ${MAX_NETS} nets out. Grab one with G.`);
  const spot = netSpot();
  if (!spot) return toast('No place for a net here. Stand next to the water!');
  const c = center(spot.tx, spot.ty);
  const fish = Array.from({ length: 5 }, () => ({ a: rand(0, 6.28), r: rand(40, 110), s: rand(0.4, 1) * (Math.random() < 0.5 ? 1 : -1) }));
  game.nets.push({ ...c, ...spot, fish, caught: 0, t: rand(5, 9) });
  puff(c.x, c.y, '#d5f2ff', 8);
  toast('Net is out! More fish will swim by. R = check, G = grab it.');
}

function nearestNet(r) {
  let best = null;
  for (const n of game.nets) if (dist(player, n) < r && (!best || dist(player, n) < dist(player, best))) best = n;
  return best;
}
function checkNet() {
  const n = nearestNet(130);
  if (!n) return toast('No net nearby. Press F at the water to put one down.');
  toast(n.caught > 0 ? `🐟 ${n.caught} fish on the stick! Press G to grab it.` : 'No fish yet… wait a little. 🎣');
}
function grabNet() {
  const n = nearestNet(110);
  if (!n) return toast('No net close enough to grab.');
  game.nets.splice(game.nets.indexOf(n), 1);
  inv.fish += n.caught;
  puff(n.x, n.y, '#d5f2ff', 10);
  if (n.caught > 0) { floatText(player.x, player.y - 20, `+${n.caught} 🐟`); toast(`Got ${n.caught} fish! Cook them at the fire (E).`); }
  else toast('Pulled the net in. It was empty.');
}

function updateNets(dt) {
  for (const n of game.nets) {
    for (const f of n.fish) f.a += f.s * dt;
    n.t -= dt;
    if (n.t <= 0) { n.t = rand(8, 14); if (n.caught < 4) { n.caught++; puff(n.x, n.y, '#bfe6ff', 8); } }
  }
}

function cook() {
  const n = inv.raw + inv.fish;
  inv.raw = 0;
  inv.fish = 0;
  inv.cooked += n;
  puff(player.x, player.y - 10, '#ffb347', 12);
  toast(`Cooked ${n} food 🍖  (press T to eat)`);
}

function findAction() {
  const p = player;
  if (p.sitting) return { label: 'Stand up', run() { p.sitting = null; } };
  if (inv.raw + inv.fish > 0 && (dist(p, FIRE_POS) < 95 || dist(p, STOVE_POS) < 55)) return { label: `Cook ${inv.raw + inv.fish} raw food`, run: cook };
  if (dist(p, DISH_POS) < 60) return {
    label: game.dishTimer > 0 ? 'Dishwasher is running…' : 'Run the dishwasher',
    run() {
      if (game.dishTimer > 0) return toast('Still washing… 🫧');
      game.dishTimer = 15;
      p.hp = Math.min(100, p.hp + 10);
      toast('Dishes sparkling clean! ✨ (+10 health)');
    },
  };
  for (const c of CHAIRS) if (dist(p, c) < 26) return {
    label: c.arm ? 'Sit in the armchair' : 'Sit on the chair',
    run() { p.sitting = c; p.x = c.x; p.y = c.y; toast('Resting… you heal faster sitting down.'); },
  };
  const ice = findIce();
  if (ice) return { label: 'Pull out the ice block', run() { pullIce(ice); } };
  return null;
}

// ---------- input ----------
addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (game.mode !== 'play') { if (k === ' ' || k === 'enter') startGame(); return; }
  if (k === 'e') findAction()?.run();
  else if (k === 'f') { if (nearLake()) placeNet(); else eat(); }
  else if (k === 't') eat();
  else if (k === 'r') checkNet();
  else if (k === 'g') grabNet();
  else if (k === 'q') placeIce();
});
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => {
  if (game.mode !== 'play') return startGame();
  if (e.button === 0) mouse.down = true;
  if (e.button === 2) placeIce();
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function startGame() {
  if (game.mode === 'title') game.mode = 'play';
  else if (game.mode === 'dead' && game.deadT > 1) newGame();
}

// ---------- update ----------
function updatePlayer(dt) {
  const p = player;
  const mx = (held('d', 'ArrowRight') ? 1 : 0) - (held('a', 'ArrowLeft') ? 1 : 0);
  const my = (held('s', 'ArrowDown') ? 1 : 0) - (held('w', 'ArrowUp') ? 1 : 0);
  if ((mx || my) && p.sitting) p.sitting = null;
  if (mx || my) {
    const l = Math.hypot(mx, my);
    moveBy(p, mx / l * 150 * dt, my / l * 150 * dt, t => !PLAYER_BLOCK.has(t));
    p.walk += dt * 10;
  }
  const m = toWorld(mouse);
  p.aim = Math.atan2(m.y - p.y, m.x - p.x);
  p.cool -= dt;
  p.invuln -= dt;
  if (mouse.down && p.cool <= 0) shoot();
}

function updateSurvival(dt) {
  const p = player, inside = isInside(), nearFire = dist(p, FIRE_POS) < 110, night = darkness() > 0.3;
  p.hunger = clamp(p.hunger - dt * 0.4, 0, 100);
  if (inside) p.warmth += dt * (nearFire ? 14 : 5);
  else p.warmth -= dt * (night ? 1.5 : 0.85);
  p.warmth = clamp(p.warmth, 0, 100);
  if (p.hunger <= 0) damage(dt * 2, 'You starved. Hunt more animals!');
  if (p.warmth <= 0) damage(dt * 3, 'You froze in the cold. Warm up by the fire!');
  if (p.hunger > 40 && p.warmth > 40) p.hp = Math.min(100, p.hp + dt * (p.sitting ? 5 : 0.6));
  game.dishTimer -= dt;
}

function updateArrows(dt) {
  for (const a of game.arrows) {
    a.life -= dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (a.life <= 0) { a.dead = true; continue; }
    if (ARROW_BLOCK.has(tileAt(a.x, a.y))) { a.dead = true; puff(a.x, a.y, '#e8f6ff', 4); continue; }
    for (const e of game.ents) {
      if (e.dead || Math.hypot(e.x - a.x, e.y - e.z - a.y) > e.r + 4) continue;
      a.dead = true;
      e.hp--;
      e.hit = 0.2;
      e.angry = true;
      puff(a.x, a.y, '#ffffff', 5);
      if (e.hp <= 0) kill(e);
      break;
    }
  }
  game.arrows = game.arrows.filter(a => !a.dead);
  game.ents = game.ents.filter(e => !e.dead);
}

function updateWorld(dt) {
  for (const it of game.items) {
    if (dist(it, player) < 26) { it.dead = true; inv.raw += it.n; floatText(it.x, it.y - 10, `+${it.n} 🥩`); }
  }
  game.items = game.items.filter(it => !it.dead);

  for (const f of game.flyIce) {
    f.t += dt / 0.35;
    f.x += (player.x - f.x) * Math.min(1, dt * 10);
    f.y += (player.y - f.y) * Math.min(1, dt * 10);
    if (f.t >= 1) { f.dead = true; inv.ice++; floatText(player.x, player.y - 20, '+1 🧊'); }
  }
  game.flyIce = game.flyIce.filter(f => !f.dead);

  game.spawnT -= dt;
  if (game.spawnT <= 0) {
    game.spawnT = 5;
    for (const type in STATS) if (count(type) < target(type)) spawn(type, { awayFrom: player });
  }
}

function updateFx(dt) {
  for (const pt of game.parts) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (!pt.text) { pt.vx *= 0.92; pt.vy *= 0.92; }
  }
  game.parts = game.parts.filter(pt => pt.life > 0);

  game.smokeT -= dt;
  if (game.smokeT <= 0) {
    game.smokeT = 0.15;
    game.smoke.push({ x: CHIMNEY.x + rand(-4, 4), y: CHIMNEY.y, vx: rand(5, 15), vy: -rand(20, 35), life: 3, size: 5 });
  }
  for (const s of game.smoke) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.size += dt * 6; }
  game.smoke = game.smoke.filter(s => s.life > 0);

  if (game.mode !== 'title') for (const t of game.toasts) t.t -= dt;
  game.toasts = game.toasts.filter(t => t.t > 0);

  for (const f of flakes) {
    f.y += f.v * dt;
    f.x += Math.sin(game.time + f.w) * 15 * dt;
    if (f.y > canvas.height) { f.y = -5; f.x = rand(0, canvas.width); }
  }
  game.shake = Math.max(0, game.shake - dt);
}

function update(dt) {
  if (game.mode === 'play') {
    game.time += dt;
    updatePlayer(dt);
    updateEnts(dt);
    updateArrows(dt);
    updateNets(dt);
    updateWorld(dt);
    updateSurvival(dt);
  } else if (game.mode === 'dead') game.deadT += dt;
  updateFx(dt);
}

// ---------- drawing: tiles & cabin ----------
function drawIceBlock(x, y) {
  ctx.fillStyle = '#7fc3e0';
  ctx.fillRect(x + 2, y + 4, TS - 4, TS - 5);
  ctx.fillStyle = '#b5e6f7';
  ctx.fillRect(x + 2, y + 2, TS - 4, TS - 9);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.fillRect(x + 5, y + 5, 10, 3);
  ctx.fillRect(x + 5, y + 5, 3, 8);
  ctx.strokeStyle = '#86c9e6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 8); ctx.lineTo(x + 22, y + 15); ctx.lineTo(x + 19, y + 21);
  ctx.stroke();
}

function drawFloor(x, y, tx) {
  ctx.fillStyle = '#b9824b';
  ctx.fillRect(x, y, TS, TS);
  ctx.fillStyle = '#9c6a38';
  for (let i = 0; i < 4; i++) ctx.fillRect(x, y + i * 8, TS, 1);
  ctx.fillRect(x + ((tx * 13) % 24) + 4, y, 1, 8);
  ctx.fillRect(x + ((tx * 7) % 24) + 4, y + 16, 1, 8);
}

function drawTile(tx, ty) {
  const t = getTile(tx, ty), x = tx * TS, y = ty * TS, h = hash(tx, ty);
  switch (t) {
    case T.SNOW:
    case T.ICE:
      ctx.fillStyle = h % 7 === 0 ? '#e7eef5' : '#eef4f9';
      ctx.fillRect(x, y, TS, TS);
      if (h % 5 === 0) { ctx.fillStyle = '#dbe5ee'; ctx.fillRect(x + (h % 23), y + ((h >> 5) % 23), 4, 2); }
      if (t === T.ICE) drawIceBlock(x, y);
      break;
    case T.WATER: {
      ctx.fillStyle = '#1d5a86';
      ctx.fillRect(x, y, TS, TS);
      const w = Math.sin(game.time * 2 + tx * 0.9 + ty * 0.6);
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.08 * w})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 14 + w * 3);
      ctx.quadraticCurveTo(x + 16, y + 8 + w * 3, x + 28, y + 14 + w * 3);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      if (getTile(tx, ty - 1) !== T.WATER) ctx.fillRect(x, y, TS, 3);
      if (getTile(tx, ty + 1) !== T.WATER) ctx.fillRect(x, y + TS - 3, TS, 3);
      if (getTile(tx - 1, ty) !== T.WATER) ctx.fillRect(x, y, 3, TS);
      if (getTile(tx + 1, ty) !== T.WATER) ctx.fillRect(x + TS - 3, y, 3, TS);
      break;
    }
    case T.WALL:
      ctx.fillStyle = '#7b4a25';
      ctx.fillRect(x, y, TS, TS);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#8f5a2f'; ctx.fillRect(x, y + i * 8 + 1, TS, 3);
        ctx.fillStyle = '#5e3618'; ctx.fillRect(x, y + i * 8 + 6, TS, 2);
      }
      break;
    case T.FLOOR:
      drawFloor(x, y, tx);
      break;
    case T.FIRE: {
      ctx.fillStyle = '#868686';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#9a9a9a';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) ctx.fillRect(x + c * 11 + (r % 2) * 5, y + r * 8 + 1, 9, 6);
      ctx.fillStyle = '#2b1a10';
      const left = tx === CAB.x + 5;
      ctx.fillRect(left ? x + 8 : x, y + 10, TS - 8, TS - 10);
      break;
    }
    case T.COUNTER:
    case T.DISH:
      drawFloor(x, y, tx);
      if (t === T.DISH) {
        ctx.fillStyle = '#eceff1'; ctx.fillRect(x + 2, y + 2, TS - 4, TS - 4);
        ctx.fillStyle = '#b0bec5'; ctx.fillRect(x + 2, y + 8, TS - 4, 2);
        ctx.fillStyle = '#78909c'; ctx.fillRect(x + 8, y + 14, 16, 3);
        ctx.fillStyle = game.dishTimer > 0 ? '#4caf50' : '#90a4ae';
        circle(x + 8, y + 5, 1.5); circle(x + 13, y + 5, 1.5);
        if (game.dishTimer > 0) {
          ctx.fillStyle = 'rgba(200,235,255,.8)';
          for (let i = 0; i < 4; i++) circle(x + 6 + i * 6, y - 4 - ((game.time * 20 + i * 7) % 14), 2.5);
        }
        break;
      }
      ctx.fillStyle = '#d9d4cc'; ctx.fillRect(x + 1, y + 2, TS - 2, TS - 4);
      ctx.strokeStyle = '#a39a8c'; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 2.5, TS - 3, TS - 5);
      if (tx === CAB.x + 8) { // sink
        ctx.fillStyle = '#9fb3c0'; ctx.fillRect(x + 7, y + 9, 18, 14);
        ctx.fillStyle = '#607d8b'; ctx.fillRect(x + 15, y + 4, 3, 7);
      } else if (tx === CAB.x + 9) { // stove
        ctx.fillStyle = '#37474f'; ctx.fillRect(x + 4, y + 5, 24, 22);
        ctx.strokeStyle = '#e57373';
        for (const [bx, by] of [[10, 11], [22, 11], [10, 21], [22, 21]]) { ctx.beginPath(); ctx.arc(x + bx, y + by, 3.5, 0, 7); ctx.stroke(); }
      } else { // cutting board
        ctx.fillStyle = '#c69c6d'; ctx.fillRect(x + 6, y + 8, 20, 14);
      }
      break;
    case T.TABLE:
      drawFloor(x, y, tx);
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x, y + 3, TS, TS - 6);
      ctx.fillStyle = '#a06a35'; ctx.fillRect(x, y + 6, TS, 2); ctx.fillRect(x, y + 18, TS, 2);
      if (tx === CAB.x + 3) { ctx.fillStyle = '#fff'; circle(x + 20, y + 16, 6); ctx.fillStyle = '#ddd'; circle(x + 20, y + 16, 3.5); }
      break;
  }
}

function drawChair(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  if (c.arm) {
    ctx.fillStyle = '#7a2e3b'; ctx.fillRect(-12, -12, 24, 24);
    ctx.fillStyle = '#9c3d4d'; ctx.fillRect(-8, -6, 16, 16);
    ctx.fillStyle = '#5e2330'; ctx.fillRect(-12, 6, 24, 6); // back faces away from the fire
  } else {
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = '#6b4220';
    if (c.back === 'left') ctx.fillRect(-11, -10, 4, 20);
    if (c.back === 'right') ctx.fillRect(7, -10, 4, 20);
    if (c.back === 'down') ctx.fillRect(-10, 7, 20, 4);
  }
  ctx.restore();
}

function drawCabinProps() {
  // rug in front of the fireplace
  ctx.fillStyle = '#a8323a';
  ellipse(FIRE_POS.x, FIRE_POS.y + 30, 44, 22);
  ctx.strokeStyle = '#e0b84c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(FIRE_POS.x, FIRE_POS.y + 30, 38, 17, 0, 0, 7); ctx.stroke();
  for (const c of CHAIRS) drawChair(c);
  // logs and flames
  const fx = FIRE_POS.x, fy = CAB.y * TS + 24;
  ctx.fillStyle = '#5a3418'; ctx.fillRect(fx - 16, fy + 2, 32, 5);
  for (let i = 0; i < 5; i++) {
    const fl = Math.sin(game.time * 12 + i * 2) * 3;
    ctx.fillStyle = i % 2 ? '#ffb02e' : '#ff6a1a';
    ellipse(fx - 12 + i * 6, fy - 2 - fl / 2, 4, 8 + fl);
  }
  ctx.fillStyle = '#ffe26a';
  ellipse(fx, fy, 5, 5 + Math.sin(game.time * 15) * 1.5);
}

function drawRoof() {
  const x = CAB.x * TS - 8, y = CAB.y * TS - 14, w = CAB.w * TS + 16, h = CAB.h * TS + 18;
  for (let r = 0; r < h; r += 12) {
    ctx.fillStyle = (r / 12) % 2 ? '#6b3d1f' : '#61371b';
    ctx.fillRect(x, y + r, w, Math.min(12, h - r));
  }
  // snow on both halves of the roof
  ctx.fillStyle = '#f3f7fb';
  ctx.fillRect(x, y, w, h * 0.22);
  ctx.fillRect(x, y + h / 2 + 3, w, h * 0.16);
  for (let i = 0; i < w; i += 24) {
    ellipse(x + i + 12, y + h * 0.22, 12, 6);
    ellipse(x + i + 12, y + h / 2 + 3 + h * 0.16, 12, 5);
  }
  ctx.fillStyle = '#3f2210';
  ctx.fillRect(x, y + h / 2 - 3, w, 6);
  // chimney
  ctx.fillStyle = '#7d7d7d'; ctx.fillRect(CHIMNEY.x - 13, CHIMNEY.y - 13, 26, 26);
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(CHIMNEY.x - 8, CHIMNEY.y - 8, 16, 16);
  // door
  const dx = (CAB.x + 5) * TS + 4, dy = (CAB.y + CAB.h) * TS - 6;
  ctx.fillStyle = '#3b2412'; ctx.fillRect(dx, dy, TS * 2 - 8, 10);
  ctx.fillStyle = '#d4a017'; circle(dx + TS * 2 - 16, dy + 5, 2);
  ctx.fillStyle = '#8d6e63'; ctx.fillRect(dx + 4, dy + 12, TS * 2 - 16, 8); // doormat
}

// ---------- drawing: creatures ----------
function shadow(x, y, rx, ry) { ctx.fillStyle = 'rgba(0,0,0,.15)'; ellipse(x, y, rx, ry); }
function warn(e, y) {
  ctx.fillStyle = '#e53935';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', e.x, e.y + y);
}

function drawPenguin(e) {
  shadow(e.x, e.y + 10, 9, 4);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.moving ? Math.sin(e.anim * 1.5) * 0.15 : 0);
  ctx.scale(e.face, 1);
  ctx.fillStyle = '#1d1f24'; ellipse(0, 0, 9, 12);
  ellipse(-8, 1, 2.5, 6, 0.3);
  ctx.fillStyle = '#fff'; ellipse(2, 2, 6, 9);
  ctx.fillStyle = '#f39c12';
  ctx.beginPath(); ctx.moveTo(5, -7); ctx.lineTo(12, -5); ctx.lineTo(5, -3); ctx.fill();
  ellipse(-3, 11, 3, 1.5); ellipse(3, 11, 3, 1.5);
  ctx.fillStyle = '#fff'; circle(3, -7, 2.2);
  ctx.fillStyle = '#000'; circle(3.7, -7, 1.1);
  ctx.restore();
}

function drawSeal(e) {
  shadow(e.x, e.y + 8, 18, 5);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(e.face, 1);
  ctx.rotate(e.moving ? Math.sin(e.anim) * 0.05 : 0);
  ctx.fillStyle = '#8a96a3';
  ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-25, -5); ctx.lineTo(-25, 5); ctx.fill(); // tail
  ellipse(0, 0, 18, 9);
  ctx.fillStyle = '#a7b2bd'; ellipse(2, 3, 13, 5);
  ctx.fillStyle = '#6f7b88'; circle(-6, -4, 2); circle(-1, -5, 1.5); ellipse(4, 7, 4, 2, 0.5);
  ctx.fillStyle = '#8a96a3'; circle(15, -4, 8);
  ctx.fillStyle = '#000'; circle(18, -6, 1.5); circle(22, -3, 1.6);
  ctx.strokeStyle = '#444'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(21, -2); ctx.lineTo(27, -4); ctx.moveTo(21, -1); ctx.lineTo(27, 0); ctx.stroke();
  ctx.restore();
}

function drawPetrel(e) {
  shadow(e.x, e.y + 18, 6, 2.5);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.dir);
  const span = 12 * (0.55 + 0.45 * Math.sin(e.anim * 2));
  ctx.fillStyle = '#e8eef3';
  ellipse(0, -span / 2 - 2, 4, span / 2 + 1);
  ellipse(0, span / 2 + 2, 4, span / 2 + 1);
  ctx.fillStyle = '#9aa7b2'; circle(0, -span - 2, 2); circle(0, span + 2, 2);
  ctx.fillStyle = '#fff'; ellipse(0, 0, 7, 4);
  ctx.fillStyle = '#222'; circle(5, -1.2, 1); circle(5, 1.2, 1);
  ctx.restore();
}

function drawBear(e) {
  const jumping = e.state === 'jump';
  shadow(e.x, e.y + 6, 26 + e.z * 0.3, 14);
  ctx.save();
  let sx = 0;
  if (e.state === 'windup') sx = Math.sin(game.time * 60) * 2;
  ctx.translate(e.x + sx, e.y - e.z);
  const s = 1 + e.z / 60;
  ctx.scale(s, s);
  ctx.rotate(e.dir);
  ctx.fillStyle = '#f4f1e6'; ctx.strokeStyle = '#cfc8b4'; ctx.lineWidth = 2;
  const step = e.state === 'chase' || e.moving ? Math.sin(e.anim * 1.2) * 4 : 0;
  for (const [lx, ly, ph] of [[12, -15, 1], [12, 15, -1], [-12, -15, -1], [-12, 15, 1]]) ellipse(lx + step * ph, ly, 7, 5);
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 17, 0, 0, 7); ctx.fill(); ctx.stroke();
  circle(21, -9, 4.5); circle(21, 9, 4.5);
  ctx.beginPath(); ctx.arc(24, 0, 11, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ebe5d2'; ellipse(33, 0, 6, 5);
  ctx.fillStyle = '#111'; circle(37, 0, 2.5); circle(26, -5, 1.7); circle(26, 5, 1.7);
  if (jumping || e.state === 'windup') { ctx.fillStyle = '#c62828'; ellipse(35, 0, 2, 3.5); } // roar!
  ctx.restore();
  if (e.state === 'windup') warn(e, -32);
}

function drawNarwhal(e) {
  const swimming = e.state === 'swim' || e.state === 'windup';
  if (!swimming) shadow(e.x, e.y + 6, 20, 8);
  if (e.state === 'leap') { // landing target marker
    ctx.strokeStyle = 'rgba(229,57,53,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.tx, e.ty, 22, 0, 7); ctx.stroke();
  }
  if (swimming) {
    const rr = 22 + Math.sin(game.time * 3 + e.anim) * 3;
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(e.x, e.y, rr + 6, rr * 0.6, e.dir, 0, 7); ctx.stroke();
  }
  ctx.save();
  ctx.globalAlpha = swimming ? 0.6 : 1;
  ctx.translate(e.x + (e.state === 'windup' ? Math.sin(game.time * 50) * 2 : 0), e.y - e.z);
  const s = 1 + e.z / 80;
  ctx.scale(s, s);
  ctx.rotate(e.dir + (e.state === 'flop' ? Math.sin(game.time * 14) * 0.3 : 0));
  ctx.fillStyle = '#5b7489';
  ellipse(-24, -6, 7, 4, -0.5); ellipse(-24, 6, 7, 4, 0.5);
  ctx.fillStyle = '#7590a6'; ellipse(0, 0, 22, 10);
  ctx.fillStyle = '#5b7489'; circle(-8, -3, 2.5); circle(-2, 4, 2); circle(6, -4, 1.8); circle(-14, 2, 1.8);
  ctx.fillStyle = '#111'; circle(14, -5, 1.4); circle(14, 5, 1.4);
  ctx.strokeStyle = '#efe6c8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(52, 0); ctx.stroke();
  ctx.strokeStyle = '#c9bd98'; ctx.lineWidth = 1;
  for (let i = 24; i < 50; i += 5) { ctx.beginPath(); ctx.moveTo(i, -1.5); ctx.lineTo(i + 2, 1.5); ctx.stroke(); }
  ctx.restore();
  if (e.state === 'windup') warn(e, -24);
}

function drawPlayer() {
  const p = player;
  if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2) return;
  shadow(p.x, p.y + 10, 11, 4);
  ctx.save();
  ctx.translate(p.x, p.y);
  const bob = p.sitting ? 0 : Math.sin(p.walk) * 1.2;
  // boots
  ctx.fillStyle = '#3e2723';
  ellipse(-5, 10 + bob, 4, 3); ellipse(5, 10 - bob, 4, 3);
  // parka
  ctx.fillStyle = '#d84a35'; circle(0, 0, 12);
  ctx.fillStyle = '#f2e8d6'; circle(0, -2, 9);
  ctx.fillStyle = '#f3c9a0'; circle(0, -2, 6.5);
  ctx.fillStyle = '#222';
  const ex = Math.cos(p.aim) * 2, ey = Math.sin(p.aim) * 2;
  circle(-2.2 + ex, -3 + ey, 1.2); circle(2.2 + ex, -3 + ey, 1.2);
  // bow
  ctx.rotate(p.aim);
  ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(8, 0, 14, -1.1, 1.1); ctx.stroke();
  const pull = p.cool > 0.2 ? 0 : 5;
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8 + Math.cos(-1.1) * 14, Math.sin(-1.1) * 14);
  ctx.lineTo(14 - pull, 0);
  ctx.lineTo(8 + Math.cos(1.1) * 14, Math.sin(1.1) * 14);
  ctx.stroke();
  if (p.cool <= 0.2) { // arrow nocked and ready
    ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(30, 0); ctx.stroke();
    ctx.fillStyle = '#9e9e9e';
    ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(29, -3); ctx.lineTo(29, 3); ctx.fill();
  }
  ctx.restore();
}

function drawArrow(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(Math.atan2(a.vy, a.vx));
  ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(10, 0); ctx.stroke();
  ctx.fillStyle = '#9e9e9e';
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(9, -3); ctx.lineTo(9, 3); ctx.fill();
  ctx.fillStyle = '#e53935';
  ctx.fillRect(-13, -3, 5, 2); ctx.fillRect(-13, 1, 5, 2);
  ctx.restore();
}

function drawFish(x, y, ang, sz) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffa94d';
  ellipse(0, 0, sz, sz * 0.5);
  ctx.beginPath(); ctx.moveTo(-sz * 0.8, 0); ctx.lineTo(-sz * 1.5, -sz * 0.5); ctx.lineTo(-sz * 1.5, sz * 0.5); ctx.fill();
  ctx.fillStyle = '#000'; circle(sz * 0.5, -sz * 0.1, sz * 0.12);
  ctx.restore();
}

function drawNet(n) {
  // fish swimming around the net, only over water
  ctx.globalAlpha = 0.85;
  for (const f of n.fish) {
    const fx = n.x + Math.cos(f.a) * f.r, fy = n.y + Math.sin(f.a) * f.r * 0.7;
    if (tileAt(fx, fy) !== T.WATER) continue;
    drawFish(fx, fy, f.a + (f.s > 0 ? Math.PI / 2 : -Math.PI / 2), 7);
  }
  ctx.globalAlpha = 1;
  const bob = Math.sin(game.time * 3 + n.x) * 1.5;
  ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 3; // the stick
  ctx.beginPath(); ctx.moveTo(n.x, n.y + 14); ctx.lineTo(n.x, n.y - 20 + bob); ctx.stroke();
  ctx.fillStyle = 'rgba(210,225,235,.25)'; // the net
  ctx.fillRect(n.x - 12, n.y - 12 + bob, 24, 24);
  ctx.strokeStyle = '#e8eef3'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -12; i <= 12; i += 6) { ctx.moveTo(n.x + i, n.y - 12 + bob); ctx.lineTo(n.x + i, n.y + 12 + bob); ctx.moveTo(n.x - 12, n.y + i + bob); ctx.lineTo(n.x + 12, n.y + i + bob); }
  ctx.stroke();
  ctx.strokeRect(n.x - 12, n.y - 12 + bob, 24, 24);
  for (let i = 0; i < n.caught; i++) drawFish(n.x - 8 + i * 6, n.y - 4 + bob, Math.sin(game.time * 12 + i) * 0.5 - Math.PI / 2, 6);
  if (n.caught > 0) { ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', n.x, n.y - 26 + bob); }
}

const DRAW = { penguin: drawPenguin, seal: drawSeal, petrel: drawPetrel, bear: drawBear, narwhal: drawNarwhal };

// ---------- drawing: lighting & UI ----------
function lightHole(x, y, r) {
  const g = lctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  lctx.fillStyle = g;
  lctx.beginPath(); lctx.arc(x, y, r, 0, 7); lctx.fill();
}
function drawLight(dk) {
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, light.width, light.height);
  lctx.fillStyle = `rgba(8,14,40,${dk})`;
  lctx.fillRect(0, 0, light.width, light.height);
  lctx.globalCompositeOperation = 'destination-out';
  lightHole(player.x - cam.x, player.y - cam.y, 170);
  lightHole(FIRE_POS.x - cam.x, FIRE_POS.y + 40 - cam.y, 280 + Math.sin(game.time * 13) * 10);
  ctx.drawImage(light, 0, 0);
}

function bar(x, y, val, color, icon) {
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath(); ctx.roundRect(x, y, 190, 20, 6); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x + 28, y + 4, 156 * clamp(val / 100, 0, 1), 12, 4); ctx.fill();
  ctx.font = '15px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  ctx.fillText(icon, x + 6, y + 15);
}

function drawUI() {
  const W = canvas.width, H = canvas.height, p = player;
  bar(12, 40, p.hp, '#e53935', '❤️');
  bar(12, 64, p.hunger, '#fb8c00', '🍗');
  bar(12, 88, p.warmth, '#ffca28', '🔥');
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath(); ctx.roundRect(12, 112, 190, 28, 6); ctx.fill();
  ctx.font = '16px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  ctx.fillText(`🥩 ${inv.raw}  🐟 ${inv.fish}  🍖 ${inv.cooked}  🧊 ${inv.ice}`, 20, 132);

  const night = darkness() > 0.3;
  ctx.textAlign = 'right'; ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3;
  const dayText = `${night ? '🌙' : '☀️'} Day ${day()}`;
  ctx.strokeText(dayText, W - 16, 32); ctx.fillText(dayText, W - 16, 32);
  ctx.font = '15px sans-serif';
  ctx.strokeText(`Hunted: ${game.hunted}`, W - 16, 54); ctx.fillText(`Hunted: ${game.hunted}`, W - 16, 54);

  // toasts
  ctx.textAlign = 'center'; ctx.font = 'bold 17px sans-serif';
  if (game.mode !== 'title') game.toasts.forEach((t, i) => {
    ctx.globalAlpha = Math.min(1, t.t);
    const y = H - 130 - (game.toasts.length - 1 - i) * 24;
    ctx.strokeText(t.text, W / 2, y); ctx.fillText(t.text, W / 2, y);
  });
  ctx.globalAlpha = 1;

  // action hints
  const hints = [];
  const action = findAction();
  if (action) hints.push(`[E] ${action.label}`);
  if (placeTarget()) hints.push('[Right-click / Q] Place ice block');
  if (p.warmth < 25) hints.push('🥶 You\'re freezing! Get to the cabin fire!');
  if (p.hunger < 20) hints.push('😫 You\'re starving! Press T to eat.');
  if (nearLake() && game.nets.length < MAX_NETS && netSpot()) hints.push('[F] Put down a fishing net');
  const hn = nearestNet(110);
  if (hn) hints.push(hn.caught > 0 ? `[G] Grab the net — ${hn.caught} 🐟!` : '[R] Check the net');
  ctx.font = 'bold 18px sans-serif';
  hints.forEach((h, i) => {
    const y = H - 70 - i * 28;
    ctx.strokeText(h, W / 2, y); ctx.fillText(h, W / 2, y);
  });

  ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.strokeText('WASD move · Click shoot · E use/pull ice · Right-click place ice · T eat · F net · R check · G grab', 12, H - 14);
  ctx.fillText('WASD move · Click shoot · E use/pull ice · Right-click place ice · T eat · F net · R check · G grab', 12, H - 14);

  // arrow pointing home when the cabin is off-screen
  const cx = CAB_CENTER.x - cam.x, cy = CAB_CENTER.y - cam.y;
  if (cx < 0 || cy < 0 || cx > W || cy > H) {
    const a = Math.atan2(cy - H / 2, cx - W / 2);
    const k = Math.min((W / 2 - 40) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - 40) / Math.abs(Math.sin(a) || 1e-6));
    const ax = W / 2 + Math.cos(a) * k, ay = H / 2 + Math.sin(a) * k;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; circle(ax, ay, 20);
    ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🏠', ax, ay + 7);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(22, -6); ctx.lineTo(22, 6); ctx.fill();
    ctx.restore();
  }
}

function drawPanel(lines, title) {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(10,20,40,.6)';
  ctx.fillRect(0, 0, W, H);
  const bw = 620, bh = 120 + lines.length * 28;
  const s = Math.min(1, (W - 24) / bw, (H - 24) / bh); // shrink to fit small screens
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 16); ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1d5a86'; ctx.font = 'bold 34px sans-serif';
  ctx.fillText(title, 0, -bh / 2 + 56);
  ctx.fillStyle = '#263238'; ctx.font = '17px sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, 0, -bh / 2 + 100 + i * 28));
  ctx.restore();
}

function draw() {
  const W = canvas.width, H = canvas.height, p = player;
  cam.x = clamp(p.x - W / 2, 0, Math.max(0, MW * TS - W));
  cam.y = clamp(p.y - H / 2, 0, Math.max(0, MH * TS - H));
  const sx = game.shake > 0 ? rand(-6, 6) : 0, sy = game.shake > 0 ? rand(-6, 6) : 0;
  ctx.fillStyle = '#1d5a86';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(-cam.x + sx, -cam.y + sy);
  const x0 = Math.floor(cam.x / TS) - 1, y0 = Math.floor(cam.y / TS) - 1;
  const x1 = Math.ceil((cam.x + W) / TS) + 1, y1 = Math.ceil((cam.y + H) / TS) + 1;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) drawTile(tx, ty);
  drawCabinProps();

  if (game.mode === 'play') {
    const ice = findIce();
    if (ice) {
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2;
      ctx.strokeRect(ice.tx * TS + 1, ice.ty * TS + 1, TS - 2, TS - 2);
    }
    const pt = placeTarget();
    if (pt) { ctx.globalAlpha = 0.45; drawIceBlock(pt.tx * TS, pt.ty * TS); ctx.globalAlpha = 1; }
  }

  for (const n of game.nets) drawNet(n);
  for (const it of game.items) {
    ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🥩', it.x, it.y + 7 + Math.sin(game.time * 4 + it.bob) * 2);
  }
  const all = [...game.ents, { type: 'player', x: p.x, y: p.y }].sort((a, b) => a.y - b.y);
  for (const e of all) {
    if (e.type === 'player') { drawPlayer(); continue; }
    ctx.globalAlpha = e.hit > 0 ? 0.5 : 1;
    DRAW[e.type](e);
    ctx.globalAlpha = 1;
  }
  for (const a of game.arrows) drawArrow(a);
  for (const f of game.flyIce) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(1 - f.t * 0.6, 1 - f.t * 0.6);
    drawIceBlock(-TS / 2, -TS / 2);
    ctx.restore();
  }
  if (!isInside()) {
    drawRoof();
    for (const s of game.smoke) { ctx.fillStyle = `rgba(200,200,200,${s.life / 6})`; circle(s.x, s.y, s.size); }
  }
  for (const pt of game.parts) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    if (pt.text) {
      ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3;
      ctx.strokeText(pt.text, pt.x, pt.y); ctx.fillText(pt.text, pt.x, pt.y);
    } else { ctx.fillStyle = pt.color; circle(pt.x, pt.y, pt.size); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  const dk = darkness();
  if (dk > 0.01) drawLight(dk);

  ctx.fillStyle = 'rgba(255,255,255,.8)';
  for (const f of flakes) if (f.x < W && f.y < H) circle(f.x, f.y, f.s);

  drawUI();

  if (game.mode === 'title') {
    drawPanel([
      'Survive in Antarctica as long as you can!',
      'WASD / arrows — move      Mouse — aim      Click — shoot bow',
      'E — pull ice, cook at the fire, sit, run dishwasher',
      'Right-click or Q — place an ice block (build walls!)',
      'T — eat food. Stay warm inside the log cabin.',
      'F at the lake — fishing net · R check it · G grab it, then cook the fish',
      '⚠️ Polar bears & narwhals hurt you only when they JUMP. Dodge!',
      '',
      'Click to start',
    ], '🐧 Antarctica Survival 🐻‍❄️');
  } else if (game.mode === 'dead') {
    drawPanel([
      game.cause,
      `You survived ${day()} day${day() > 1 ? 's' : ''} and hunted ${game.hunted} animals.`,
      '',
      game.deadT > 1 ? 'Click to play again' : '',
    ], 'Game Over');
  }
}

// ---------- main loop ----------
newGame();
game.mode = 'title';

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
