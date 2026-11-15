// Original illustrated scenes drawn in code: the battle board, the menu background (Ararat), the campaign
// map and small decorative pieces. Everything is plain SVG markup; nothing is loaded from files.
import { makeRng } from '../src/engine/rng.js';

const O = '#2a1a17';

/** Battle board: textured ground (warm player half, cooler enemy half), animated river, plank bridges. */
export function boardSvg(cfg) {
  const { cols, rows, riverRow, bridgeCols } = cfg.board;
  const W = cols * 100, H = rows * 100, ry = (riverRow - 1) * 100;
  const rnd = makeRng(7);
  let deco = '';
  for (let i = 0, n = Math.round(90 * cols * rows / 35); i < n; i++) {
    const x = Math.round(rnd() * W), y = Math.round(rnd() * H);
    if (y > ry - 12 && y < ry + 112) continue;
    const top = y < ry;
    const k = rnd();
    if (k < 0.55) { // grass tuft
      const col = top ? '#8fa37a' : '#a7ad62';
      deco += `<path d="M${x} ${y}l-4-9M${x} ${y}l0-12M${x} ${y}l5-8" stroke="${col}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".75"/>`;
    } else if (k < 0.85) { // pebble
      deco += `<ellipse cx="${x}" cy="${y}" rx="${5 + rnd() * 5}" ry="${3 + rnd() * 2}" fill="${top ? '#b9b3ad' : '#d2b79a'}" stroke="${O}" stroke-opacity=".25" stroke-width="1.5"/>`;
    } else { // small flower
      deco += `<circle cx="${x}" cy="${y}" r="3" fill="${top ? '#d9c2e0' : '#f3d27a'}" opacity=".9"/>`;
    }
  }
  let grid = '';
  for (let c = 1; c < cols; c++) grid += `M${c * 100} 0V${ry}M${c * 100} ${ry + 100}V${H}`;
  for (let r = 1; r < rows; r++) if (r !== riverRow - 1 && r !== riverRow) grid += `M0 ${r * 100}H${W}`;
  let waves = '';
  for (let k = 0; k < 4; k++) {
    const y = ry + 18 + k * 21;
    let d = `M-200 ${y}`;
    for (let x = -200; x < W + 200; x += 50) d += `q12.5 -7 25 0t25 0`;
    waves += `<path class="wave w${k % 2}" d="${d}" stroke="#d9eef6" stroke-width="3" fill="none" stroke-linecap="round" opacity="${0.5 + 0.12 * (k % 2)}"/>`;
  }
  let bridges = '';
  for (const bc of bridgeCols) {
    const x = (bc - 1) * 100 + 14;
    let planks = '';
    for (let k = 0; k < 6; k++) planks += `<rect x="${x}" y="${ry - 6 + k * 18.7}" width="72" height="18.7" fill="${k % 2 ? '#b9844e' : '#a8733f'}" stroke="${O}" stroke-width="2"/>`;
    bridges += `<g><rect x="${x - 3}" y="${ry - 2}" width="78" height="112" fill="rgba(0,0,0,.18)"/>${planks}` +
      `<rect x="${x - 6}" y="${ry - 10}" width="9" height="120" rx="3" fill="#6e4a26" stroke="${O}" stroke-width="2.5"/>` +
      `<rect x="${x + 69}" y="${ry - 10}" width="9" height="120" rx="3" fill="#6e4a26" stroke="${O}" stroke-width="2.5"/></g>`;
  }
  return `<svg class="board-bg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="gTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3cdb4"/><stop offset="1" stop-color="#d3d6b6"/></linearGradient>
      <linearGradient id="gBot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6d7a4"/><stop offset="1" stop-color="#eccf9a"/></linearGradient>
      <linearGradient id="gWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fb0cc"/><stop offset=".5" stop-color="#8cc6de"/><stop offset="1" stop-color="#6aa9c6"/></linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${ry}" fill="url(#gTop)"/>
    <rect x="0" y="${ry + 100}" width="${W}" height="${H - ry - 100}" fill="url(#gBot)"/>
    ${deco}
    <path d="${grid}" stroke="${O}" stroke-opacity=".13" stroke-width="2" stroke-dasharray="6 8" fill="none"/>
    <rect x="0" y="${ry - 6}" width="${W}" height="112" fill="#b89a6a"/>
    <rect x="0" y="${ry}" width="${W}" height="100" fill="url(#gWater)"/>
    <g class="waves">${waves}</g>
    <path d="M0 ${ry}H${W}M0 ${ry + 100}H${W}" stroke="${O}" stroke-opacity=".45" stroke-width="3"/>
    ${bridges}
  </svg>`;
}

/** Mount Ararat scene (menu background, intro, banners). `id` keeps gradient ids unique per instance. */
export function araratScene(id = 'a') {
  return `<svg class="scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c98f"/><stop offset=".45" stop-color="#f8dcb8"/><stop offset="1" stop-color="#fbeedd"/></linearGradient>
      <linearGradient id="mt${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fa3b8"/><stop offset="1" stop-color="#c9b7b4"/></linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#sky${id})"/>
    <g class="par p1"><circle cx="1180" cy="210" r="90" fill="#fff3cf" opacity=".9"/><circle cx="1180" cy="210" r="140" fill="#fff3cf" opacity=".25"/>
      <path d="M150 200q40-30 90 0q50-26 90 6q-70 14-180-6zM980 120q50-34 110 0q40-16 70 8q-90 12-180-8z" fill="#fff" opacity=".7"/></g>
    <g class="par p2">
      <path d="M260 700L720 190q40-36 80 0L1010 470l110-140q30-26 60 0L1500 700z" fill="url(#mt${id})"/>
      <path d="M640 280l80-90q40-36 80 0l70 92-50-22-36 46-44-40-40 44zM1076 384l44-54q30-26 60 0l44 56-36-14-26 30-30-28-24 26z" fill="#fff" opacity=".95"/>
    </g>
    <g class="par p3">
      <path d="M0 720q260-110 520-40t520-20t560 40V900H0z" fill="#d9a777"/>
      <path d="M0 780q300-80 620-30t980-20V900H0z" fill="#c98a5c"/>
      <g stroke="${O}" stroke-width="5" stroke-linejoin="round">
        <path d="M250 742V640h150v102z" fill="#e9b89c"/><path d="M236 648V616h26v14h26v-14h48v14h26v-14h26v32z" fill="#cf9273"/>
        <path d="M296 640v-60h58v60z" fill="#e9b89c"/><path d="M284 584l41-64 41 64z" fill="#a3242f"/>
        <path d="M312 742v-46q13-20 26 0v46z" fill="#4a2f27"/>
        <path d="M210 742V660h40v82zM400 742V660h40v82z" fill="#cf9273"/><path d="M204 664v-22h14v10h12v-10h14v22zM394 664v-22h14v10h12v-10h14v22z" fill="#cf9273"/>
      </g>
      <path d="M325 520v-34" stroke="${O}" stroke-width="5"/><path d="M327 486l44 13-44 13z" fill="#e08a2e" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
    </g>
    <g class="par p4"><path d="M0 850q400-70 800-20t800-30V900H0z" fill="#a86c50"/>
      <g fill="#7d1a23" stroke="${O}" stroke-width="4"><circle cx="1320" cy="812" r="20"/><circle cx="1352" cy="826" r="16"/><path d="M1314 792l6-12 6 12zM1348 810l4-9 5 9z" fill="#5c8a3c"/></g>
    </g>
  </svg>`;
}

/**
 * Decorative campaign path: 7 nodes on a winding road (not a geographic map).
 * Returns { svg, nodes: [{ x, y }] } in a 1000 x 560 coordinate system.
 */
export function campaignMap() {
  const nodes = [[90, 440], [240, 300], [400, 420], [540, 250], [690, 380], [810, 200], [925, 390]].map(([x, y]) => ({ x, y }));
  let d = `M${nodes[0].x} ${nodes[0].y}`;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1], b = nodes[i], mx = (a.x + b.x) / 2;
    d += `C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
  }
  const hills = `<path d="M0 560V470q120-60 250-20t260-30t250 20t240-40V560z" fill="#d9a777" opacity=".55"/>` +
    `<path d="M560 150l90-110q16-14 32 0l60 76 34-40q12-10 24 0l80 96z" fill="#9fb0c2" opacity=".7"/>` +
    `<path d="M632 76l18-36q16-14 32 0l22 36-20-8-12 14-14-12-12 12zM770 96l14-20q12-10 24 0l16 22-14-6-10 10-10-10-10 8z" fill="#fff" opacity=".9"/>` +
    `<g fill="#7fae6b" opacity=".8"><circle cx="150" cy="170" r="26"/><circle cx="182" cy="182" r="20"/><circle cx="330" cy="150" r="22"/><circle cx="470" cy="500" r="24"/><circle cx="880" cy="480" r="26"/><circle cx="60" cy="300" r="18"/></g>`;
  const svg = `<svg class="map-bg" viewBox="0 0 1000 560" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="1000" height="560" rx="18" fill="#f4e3c3"/>${hills}
    <path d="${d}" fill="none" stroke="#fff8ea" stroke-width="26" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#a86c50" stroke-width="5" stroke-dasharray="4 14" stroke-linecap="round"/>
  </svg>`;
  return { svg, nodes };
}

/** Eternity-sign style rosette (decoration). */
export function rosette(color = '#a3242f') {
  let arms = '';
  for (let i = 0; i < 8; i++) arms += `<path d="M50 50Q62 34 50 14Q44 34 50 50z" fill="${color}" transform="rotate(${i * 45} 50 50)"/>`;
  return `<svg class="rosette" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="${color}" stroke-width="4"/>${arms}<circle cx="50" cy="50" r="6" fill="#f0c044"/></svg>`;
}

/** App emblem: a crown over a tower on a pomegranate shield (also rendered to build/icon.ico). */
export function emblemSvg(size = 256) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256">
    <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c0343f"/><stop offset="1" stop-color="#7d1a23"/></linearGradient></defs>
    <rect x="10" y="10" width="236" height="236" rx="52" fill="url(#eg)" stroke="${O}" stroke-width="10"/>
    <rect x="26" y="26" width="204" height="204" rx="38" fill="none" stroke="#f0c044" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/>
    <g stroke="${O}" stroke-width="9" stroke-linejoin="round">
      <path d="M86 214V122h84v92z" fill="#e9b89c"/>
      <path d="M74 126V96h22v12h20V96h24v12h20V96h22v30z" fill="#f3cdb5"/>
      <path d="M112 214v-38q16-24 32 0v38z" fill="${O}"/>
      <path d="M84 84L72 40l32 20 24-32 24 32 32-20-12 44z" fill="#f0c044"/>
    </g>
    <circle cx="128" cy="66" r="8" fill="#e08a2e" stroke="${O}" stroke-width="5"/>
  </svg>`;
}
