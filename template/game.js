const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// `keys` (Set of held keys) comes from ../../shared/input.js

const state = {};

function update(dt) {
  // game logic goes here
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // drawing goes here
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
