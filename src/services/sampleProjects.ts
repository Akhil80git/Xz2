import { GitHubRepo, RepoTreeItem, VirtualFile } from '../types';

export const SAMPLE_REPOS: GitHubRepo[] = [
  {
    id: 101,
    name: 'react-vite-counter',
    full_name: 'demo/react-vite-counter',
    owner: {
      login: 'demo',
      avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
    },
    description: 'A modern interactive React + Vite counter with styled components',
    html_url: 'https://github.com/vitejs/vite',
    default_branch: 'main',
    stargazers_count: 68420,
    forks_count: 5910,
    language: 'TypeScript',
    updated_at: new Date().toISOString(),
    size: 120,
  },
  {
    id: 102,
    name: 'html-canvas-game',
    full_name: 'demo/html-canvas-game',
    owner: {
      login: 'demo',
      avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
    },
    description: 'Vanilla HTML5 / CSS3 / JavaScript interactive particle canvas app',
    html_url: 'https://github.com/mrdoob/three.js',
    default_branch: 'main',
    stargazers_count: 99120,
    forks_count: 34500,
    language: 'JavaScript',
    updated_at: new Date().toISOString(),
    size: 85,
  },
];

export const SAMPLE_REACT_FILES: Record<string, string> = {
  'package.json': JSON.stringify(
    {
      name: 'react-vite-counter',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
        'lucide-react': '^0.546.0',
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.3.1',
        vite: '^5.4.2',
      },
    },
    null,
    2
  ),
  'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React + Vite Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
  'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);`,
  'src/App.tsx': `import React, { useState } from 'react';
import { Sparkles, Plus, Minus, RotateCcw } from 'lucide-react';

export default function App() {
  const [count, setCount] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);

  const colors = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans select-none">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 p-8 rounded-2xl shadow-2xl backdrop-blur text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>React + Vite In-Browser Runner</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">
          Interactive Counter
        </h1>
        <p className="text-slate-400 text-sm mb-8">
          Compiled, transpiled & executed completely inside your browser with zero Node/npm setup!
        </p>

        {/* Counter Display */}
        <div className={\`w-36 h-36 mx-auto rounded-3xl bg-gradient-to-tr \${colors[colorIndex]} flex items-center justify-center text-5xl font-black text-white shadow-xl transition-all duration-300 transform hover:scale-105 mb-8\`}>
          {count}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={() => setCount((c) => c - 1)}
            className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white flex items-center justify-center transition-all border border-slate-700 shadow"
          >
            <Minus className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              setCount(0);
              setColorIndex((idx) => (idx + 1) % colors.length);
            }}
            className="px-4 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-700 shadow"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>

          <button
            onClick={() => {
              setCount((c) => c + 1);
              setColorIndex((idx) => (idx + 1) % colors.length);
            }}
            className="w-12 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center transition-all shadow-lg shadow-blue-500/30"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Try editing <code className="text-blue-400 font-mono">src/App.tsx</code> in the Monaco Editor and hit <strong>Run</strong>!
        </p>
      </div>
    </div>
  );
}`,
  'src/index.css': `@import "tailwindcss";
body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}`,
};

export const SAMPLE_HTML_FILES: Record<string, string> = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Canvas Particle Flow</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="hud">
    <h1>Particle Wave Visualizer</h1>
    <p>Pure HTML5 Canvas + Vanilla JavaScript. Move your cursor over the canvas!</p>
    <div class="stats">Particles: <span id="particle-count">120</span></div>
  </div>
  <canvas id="canvas"></canvas>
  <script src="script.js"></script>
</body>
</html>`,
  'style.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  background: #090d16;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
  height: 100vh;
  width: 100vw;
}
.hud {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 10;
  pointer-events: none;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
h1 {
  font-size: 1.1rem;
  font-weight: 700;
  color: #38bdf8;
  margin-bottom: 4px;
}
p {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-bottom: 8px;
}
.stats {
  font-size: 0.75rem;
  font-family: monospace;
  color: #34d399;
}
canvas {
  display: block;
  width: 100vw;
  height: 100vh;
}`,
  'script.js': `const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
});

const particles = [];
const particleCount = 100;
const mouse = { x: width / 2, y: height / 2, radius: 120 };

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

class Particle {
  constructor() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = (Math.random() - 0.5) * 1.5;
    this.size = Math.random() * 3 + 1.5;
    this.color = \`hsl(\${Math.random() * 60 + 190}, 85%, 60%)\`;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0 || this.x > width) this.vx *= -1;
    if (this.y < 0 || this.y > height) this.vy *= -1;

    // Repel from mouse
    const dx = mouse.x - this.x;
    const dy = mouse.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < mouse.radius) {
      const angle = Math.atan2(dy, dx);
      this.x -= Math.cos(angle) * 3;
      this.y -= Math.sin(angle) * 3;
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fill();
  }
}

for (let i = 0; i < particleCount; i++) {
  particles.push(new Particle());
}

function animate() {
  ctx.fillStyle = 'rgba(9, 13, 22, 0.2)';
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < particles.length; i++) {
    particles[i].update();
    particles[i].draw();

    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 80) {
        ctx.beginPath();
        ctx.strokeStyle = \`rgba(56, 189, 248, \${1 - dist / 80})\`;
        ctx.lineWidth = 0.5;
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  requestAnimationFrame(animate);
}

console.log("Canvas particle simulation initialized smoothly!");
animate();`,
};

export function getSampleTreeItems(files: Record<string, string>): RepoTreeItem[] {
  return Object.keys(files).map((path) => ({
    path,
    mode: '100644',
    type: 'blob',
    sha: 'sample-sha-' + path,
    size: files[path].length,
    url: '',
  }));
}
