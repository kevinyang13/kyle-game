// Shared keyboard helper. Include with <script src="../../shared/input.js"></script>
const keys = new Set();
addEventListener('keydown', e => keys.add(e.key));
addEventListener('keyup', e => keys.delete(e.key));
