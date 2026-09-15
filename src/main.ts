import './styles/base.css';
import './styles/a11y.css';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing #app mount point in index.html');
}

root.dataset.scene = 'boot';
root.innerHTML = `
  <div class="scene" style="display:grid;place-items:center;text-align:center;padding:2rem">
    <div>
      <h1>Four Nations Tactics</h1>
      <p class="muted">Booting…</p>
    </div>
  </div>
`;
