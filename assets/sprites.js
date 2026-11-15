// Original vector art for every card, unit, tower and UI icon. Everything is drawn in code (no image files).
// A sprite is an SVG string with a 100x100 viewBox. The side colour comes from CSS variables, so the same drawing
// is apricot for the player and pomegranate for the enemy:  --sc (main), --sd (dark), --sl (light).
const O = '#2a1a17', SKIN = '#f0c49a', SKIN2 = '#d9a273', STEEL = '#c9cfd5', STEEL2 = '#8d969e', WOOD = '#a8733f', WOOD2 = '#6e4a26',
  GOLD = '#f0c044', GOLD2 = '#b98a1c', LEATH = '#7a4a2a', WHITE = '#fbf4ee', HAIR = '#3b2a26', TUFF = '#e9b89c', TUFF2 = '#cf9273',
  TUFF3 = '#a86c50', PURPLE = '#7b4a9e', SC = 'var(--sc,#e08a2e)', SD = 'var(--sd,#a85c14)', SL = 'var(--sl,#f8cf94)';

const p = (d, fill = 'none', extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const c = (cx, cy, r, fill = 'none', extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const el = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
/** Outlined thick line (a limb, a shaft): dark stroke below, coloured stroke on top. */
const ln = (d, col, w = 4) => `<path d="${d}" fill="none" stroke="${O}" stroke-width="${w + 4.5}"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
const thin = (d, col = O, w = 1.6) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
const dot = (cx, cy, r = 1.9, fill = O) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="none"/>`;
const shadow = (rx = 24, cy = 93) => `<ellipse cx="50" cy="${cy}" rx="${rx}" ry="4.5" fill="rgba(42,26,23,.22)" stroke="none"/>`;
const halo = (col = GOLD, cy = 36) => `<circle cx="50" cy="${cy}" r="27" fill="${col}" opacity=".45" stroke="none"/>` +
  `<path d="M50 ${cy - 34}v8M50 ${cy + 26}v8M${50 - 34} ${cy}h8M${50 + 26} ${cy}h8M26 ${cy - 24}l6 6M74 ${cy - 24}l-6 6M26 ${cy + 24}l6-6M74 ${cy + 24}l-6-6" stroke="${col}" stroke-width="3" fill="none" opacity=".8"/>`;

// ---- humanoid parts ----
const HAND_L = [27, 66], HAND_R = [73, 66];
const armL = (col = SC, x = HAND_L[0], y = HAND_L[1]) => ln(`M36 55Q29 58 ${x} ${y}`, col, 5) + c(x, y, 4.2, SKIN);
const armR = (col = SC, x = HAND_R[0], y = HAND_R[1]) => ln(`M64 55Q71 58 ${x} ${y}`, col, 5) + c(x, y, 4.2, SKIN);
const cape = (col) => p('M31 49q19-9 38 0l9 36q-28 8-56 0z', col);
const beard = (col, d = 'M37 38q13 22 26 0q-2 16-13 18q-11-2-13-18z') => p(d, col);
const moustache = (col = HAIR) => p('M42 42q8 5 16 0q-3 6-8 3q-5 3-8-3z', col, 'stroke-width="1.5"');
const helmet = (col = STEEL) => p('M35 31q-1-19 15-22q16 3 15 22q-15-6-30 0z', col) + p('M50 9v-5', 'none') + p('M48 27h4v9h-4z', col, 'stroke-width="2"');
const cap = (col, feather = false) => p('M35 30q1-17 15-18q14 1 15 18q-15-7-30 0z', col) + (feather ? p('M62 20q10-12 14-8q-4 10-12 12z', WHITE, 'stroke-width="2"') : '');
const hair = (col = HAIR) => p('M36 31q0-16 14-17q14 1 14 17q-14-9-28 0z', col);
const crown = (col = GOLD) => p('M36 27l-3-15 9 7 8-11 8 11 9-7-3 15q-14-5-28 0z', col) + dot(50, 21, 2.2, '#b02a36') + dot(41, 23, 1.6, '#3a7ad9') + dot(59, 23, 1.6, '#3a7ad9');
const spear = (x = 76, top = 6, bottom = 92) => ln(`M${x} ${bottom}V${top + 14}`, WOOD, 2.6) + p(`M${x} ${top}l5 14h-10z`, STEEL, 'stroke-width="2.5"');
const sword = (x = 73, y = 64, len = 40, col = STEEL) => p(`M${x - 3.2} ${y - 6}l1.2-${len}l2-5l2 5l1.2 ${len}z`, col, 'stroke-width="2.5"') + p(`M${x - 8} ${y - 6}h16v4h-16z`, GOLD, 'stroke-width="2.5"') + ln(`M${x} ${y - 2}v6`, LEATH, 2);
const roundShield = (x = 29, y = 66, r = 14, col = SC) => c(x, y, r, col) + c(x, y, r - 5, 'none', `stroke="${SL}" stroke-width="2.5"`) + c(x, y, 3.4, GOLD, 'stroke-width="2"');

function man(o = {}) {
  const { tunic = SC, trim = SD, skin = SKIN, legs = LEATH, back = '', left = '', right = '', chin = '', hat = '', front = '', face = true, sh = 24 } = o;
  return shadow(sh) + back +
    p('M40 74v15h-5v4h12V74zM60 74v15h5v4H53V74z', legs) +
    p('M33 52q17-9 34 0l4 26q-21 7-42 0z', tunic) +
    p('M31.8 65q18.2 6 36.4 0l.9 6q-19 6.5-38.2 0z', trim) +
    left + right +
    c(50, 34, 14, skin) + chin +
    (face ? dot(44.5, 35) + dot(55.5, 35) : '') + hat + front;
}
const big = (inner, s = 1.06) => `<g transform="translate(50 96) scale(${s}) translate(-50 -96)">${inner}</g>`;

// ---- horse (side view, facing right) ----
function horse({ coat = '#9a6537', dark = '#5e3b20', armour = '', blanket = SC } = {}) {
  return shadow(34) +
    p('M22 58q-13 3-10 24q7-8 12-15z', dark) +
    p('M28 70l-2 22h7l2-18zM40 72v20h7V72zM58 72v20h7V72zM68 70l3 22h7l-4-24z', coat) +
    p('M24 92h10M39 92h9M57 92h9M70 92h9', 'none', `stroke="${O}" stroke-width="4"`) +
    p('M20 60q0-15 22-14h20l10-22q12-4 18 8l5 12q-1 6-8 4l-8-7l-5 21q0 16-18 18H36q-16-2-16-20z', coat) +
    p('M63 46l9-22q4-2 7-1l-9 25z', dark, 'stroke-width="2"') +
    dot(84, 31, 1.8) + armour +
    p('M36 46h22v20q-11 5-22 0z', blanket) + thin('M36 61q11 5 22 0', SL, 2.2);
}
function rider({ tunic = SC, hat = helmet(), extra = '', lance = true } = {}) {
  return (lance ? ln('M30 62L78 4', WOOD, 2.4) + p('M78 4l-2 12 9-7z', STEEL, 'stroke-width="2.5"') : '') +
    p('M38 34q9-6 18 0l3 18q-12 5-24 0z', tunic) +
    `<g transform="translate(22.5 4.5) scale(.5)">${c(50, 34, 14, SKIN)}${dot(46, 35, 2.6)}${dot(57, 35, 2.6)}${hat}</g>` + extra;
}

// ---- towers (with damage layers toggled by CSS: .dmg1 shows .crack, .dmg2 shows .fire) ----
const cracks = (d) => `<g class="crack">${thin(d, O, 2.4)}</g>`;
const fire = (x, y, s = 1) => `<g class="fire" transform="translate(${x} ${y}) scale(${s})">` +
  `<circle cx="6" cy="-20" r="7" fill="#6b5b57" opacity=".7" stroke="none"/><circle cx="-2" cy="-30" r="5" fill="#6b5b57" opacity=".5" stroke="none"/>` +
  p('M0 0q-10-6-5-16q2 5 5 4q-2-9 3-14q1 8 6 12q4 6-1 12q-3 3-8 2z', '#f2742b', 'stroke-width="2"') + p('M1-2q-4-4-1-9q3 3 4 6q1 3-3 3z', '#ffd35a', 'stroke="none"') + '</g>';
const bricks = (d) => thin(d, TUFF3, 1.6);

const towerSmall = shadow(30) +
  p('M27 92V40h46v52z', TUFF) +
  p('M22 42V25h10v7h9v-7h18v7h9v-7h10v17z', TUFF2) +
  bricks('M27 54h46M27 68h46M27 82h46M40 42v12M60 42v12M50 54v14M34 68v14M66 68v14M50 82v10') +
  p('M43 92V74q7-10 14 0v18z', '#4a2f27') + p('M47 50h6v10h-6z', '#4a2f27', 'stroke-width="2"') +
  ln('M50 25V6', WOOD2, 1.8) + p('M51 6l17 5.5-17 5.5z', SC, 'stroke-width="2.5"') +
  cracks('M32 44l5 8-4 7 6 9M66 60l-5 7 4 6-3 8') + fire(62, 30, .9) + fire(36, 34, .7);

const towerKing = shadow(40) +
  p('M10 92V46h14v46zM76 92V46h14v46z', TUFF2) + p('M7 48V36h6v5h8v-5h6v12zM73 48V36h6v5h8v-5h6v12z', TUFF2) +
  p('M22 92V54h56v38z', TUFF) + p('M20 56V46h8v5h9v-5h26v5h9v-5h8v10z', TUFF2) +
  bricks('M22 66h56M22 79h56M34 56v10M66 56v10M28 66v13M72 66v13M34 79v13M66 79v13') +
  p('M38 46V32h24v14z', TUFF) + p('M34 33L50 6l16 27z', SC) + thin('M42 20q8 5 16 0M38 27q12 6 24 0', SD, 2) +
  p('M47 36q3-4 6 0v8h-6z', '#4a2f27', 'stroke-width="2"') + ln('M50 6V1', GOLD2, 1.5) + c(50, 2.5, 2.4, GOLD, 'stroke-width="1.6"') +
  p('M41 92V72q9-13 18 0v20z', '#4a2f27') + thin('M50 66v26', TUFF3, 2) +
  p('M12 36V26l9 3.5-9 3.5M88 36V26l-9 3.5 9 3.5', SC, 'stroke-width="2.2"') +
  cracks('M26 58l6 9-4 8 5 10M72 60l-5 8 5 7-4 9M44 34l4 6') + fire(70, 44) + fire(28, 46, .8) + fire(52, 30, .7);

// ---- the sprite table ----
const S = {
  // player soldiers
  spearman: man({ hat: helmet(), left: armL() + roundShield(), right: armR() + spear() }),
  archer: man({ back: p('M60 44l10-6 4 22-8 6z', WOOD2) + thin('M66 38l-3-8M70 37l1-8M73 39l5-7', WOOD, 2), hat: cap(SD, true),
    left: armL(SC, 30, 62), right: armR(SC, 71, 60) + p('M72 36q18 24 0 48', 'none', `stroke="${O}" stroke-width="7.5"`) + p('M72 36q18 24 0 48', 'none', `stroke="${WOOD}" stroke-width="3.2"`) + thin('M72 36v48', WHITE, 1.4) }),
  slinger: man({ hat: hair() + p('M36 29q14-6 28 0', 'none', `stroke="${SC}" stroke-width="4"`), tunic: SL, trim: SC,
    left: armL(SL), right: ln('M64 55Q74 50 76 40', SL, 5) + c(76, 40, 4.2, SKIN) + thin('M76 40Q92 30 84 16Q78 8 70 16', LEATH, 2) + c(70, 17, 5, '#9aa0a6', 'stroke-width="2.5"'),
    front: p('M36 70h9v9h-9z', LEATH, 'stroke-width="2"') }),
  cavalry: horse() + rider(),
  cataphract: horse({ coat: '#4a3a34', dark: '#2d221f', blanket: SD,
    armour: p('M21 60q0-14 20-14h22l8-18q9-2 14 3l-9 26q-1 15-17 17H36q-15-2-15-14z', STEEL, 'opacity=".96"') +
      thin('M28 54h34M26 61h36M28 68h32M70 34l8 4M67 41l8 4', STEEL2, 1.8) + dot(84, 31, 1.8) }) +
    rider({ tunic: STEEL, hat: p('M34 38q-2-28 16-30q18 2 16 30q-16-6-32 0z', STEEL) + p('M40 32h20v6H40z', O) + p('M50 8q10-10 18-4q-8 2-12 10z', SC, 'stroke-width="3"') }),
  shieldbearer: man({ hat: helmet(), left: armL(), right: armR(SC, 70, 62),
    front: p('M30 46h40v28q-20 20-40 0z', SC) + p('M35 51h30v21q-15 14-30 0z', 'none', `stroke="${SL}" stroke-width="2.5"`) + c(50, 62, 6, GOLD, 'stroke-width="2.2"') + thin('M50 56v12M44 62h12', GOLD2, 1.6) }),
  militia: man({ tunic: '#8c8a5c', trim: LEATH, hat: p('M35 28q1-13 15-14q14 1 15 14z', '#6f6d47') + p('M34 28h34l6 3H34z', '#55533a', 'stroke-width="2.2"'),
    chin: moustache(), back: ln('M30 86L72 14', WOOD2, 3) + p('M72 14l5-10 1.5 1-4 10z', STEEL, 'stroke-width="2"'),
    left: armL('#8c8a5c', 36, 76), right: armR('#8c8a5c', 62, 40), front: thin('M36 52L64 76', LEATH, 4.5) + c(40, 59, 4.5, SC, 'stroke-width="2"') }),

  // heroes
  hayk: man({ back: halo(), tunic: WHITE, trim: GOLD, hat: hair('#e9e4dc') + p('M36 28q14-6 28 0', 'none', `stroke="${GOLD}" stroke-width="4"`),
    chin: beard('#e9e4dc', 'M37 38q13 16 26 0q0 26-13 30q-13-4-13-30z'), left: armL(WHITE, 30, 62),
    right: armR(WHITE, 72, 58) + p('M73 20q26 38 0 76', 'none', `stroke="${O}" stroke-width="9"`) + p('M73 20q26 38 0 76', 'none', `stroke="${GOLD2}" stroke-width="4.4"`) + thin('M73 20v76', WHITE, 1.6) + ln('M56 58h32', WOOD, 1.6) + p('M88 58l-7-4v8z', STEEL, 'stroke-width="2"') }),
  artashes: man({ back: halo() + cape(PURPLE), tunic: WHITE, trim: GOLD, hat: crown(), chin: beard(HAIR),
    left: armL(WHITE, 28, 64) + c(27, 72, 7.5, GOLD, 'stroke-width="2.5"') + thin('M24 72h6M27 69v6', GOLD2, 1.8),
    right: armR(WHITE) + ln('M75 82V26', GOLD2, 2.4) + c(75, 22, 6, GOLD, 'stroke-width="2.5"') }),
  tigran: man({ back: halo() + cape('#8a2233'), tunic: '#8a2233', trim: GOLD,
    hat: p('M35 30l-1-18 6 5 4-10 6 8 6-8 4 10 6-5-1 18q-15-6-30 0z', '#8a2233') + p('M35 27q15-6 30 0v4q-15-6-30 0z', GOLD, 'stroke-width="2"') +
      p('M50 12l1.8 4 4.2.4-3.2 2.8 1 4.2-3.8-2.3-3.8 2.3 1-4.2-3.2-2.8 4.2-.4z', GOLD, 'stroke-width="1.2"'),
    chin: beard(HAIR), left: armL('#8a2233') + roundShield(28, 68, 12, GOLD), right: armR('#8a2233') + sword(74, 64, 46) }),
  vardan: man({ back: halo() + cape('#b02a36') + ln('M22 92V10', WOOD2, 2) + p('M23 10h20l-5 8 5 8H23z', '#b02a36', 'stroke-width="2.5"') + thin('M28 18h8M32 14v8', GOLD, 2),
    tunic: STEEL, trim: '#b02a36', hat: helmet() + p('M50 6q9-9 16-3q-7 2-10 10z', '#b02a36', 'stroke-width="2.5"'), chin: beard(HAIR, 'M38 39q12 16 24 0q-2 13-12 14q-10-1-12-14z'),
    left: armL(STEEL, 24, 62), right: armR(STEEL) + sword(74, 64, 42) }),
  ashot: man({ back: halo(), tunic: '#7f8a94', trim: '#4f5860', legs: '#4f5860',
    hat: p('M34 40q-3-30 16-32q19 2 16 32q-4-6-9-7h-14q-5 1-9 7z', '#7f8a94') + p('M48 27h4v12h-4z', '#7f8a94', 'stroke-width="2"') + p('M50 8v-5', 'none'),
    left: armL('#7f8a94') + p('M16 54h24v18q-12 14-24 0z', '#7f8a94') + thin('M28 56v24M19 64h18', '#4f5860', 2.4),
    right: armR('#7f8a94') + sword(74, 64, 44, '#dfe4e8'), front: thin('M38 56h24M37 61h26', '#4f5860', 1.8) }),
  davitbek: man({ back: halo() + p('M8 90L30 52l14 20 10-12 38 30z', '#b7c3cc', 'opacity=".7"'), tunic: '#3d4a6b', trim: GOLD,
    hat: p('M33 30q-1-20 17-21q18 1 17 21q-17-7-34 0z', '#3b2a26') + thin('M38 22q3-5 6-1M48 20q3-5 6-1M57 23q2-4 5-1', '#6b534c', 2),
    chin: moustache(), left: armL('#3d4a6b'), right: armR('#3d4a6b') + p('M71 62Q70 30 88 14Q84 36 77 62z', STEEL, 'stroke-width="2.5"') + p('M67 60h14v4H67z', GOLD, 'stroke-width="2.2"'),
    front: thin('M38 54l24 20M62 54L38 74', GOLD, 2.4) }),
  sardarapat: shadow(30) + halo(GOLD, 44) + ln('M22 26h56', WOOD2, 4) + ln('M50 26v8', WOOD2, 3) +
    p('M36 70q2-34 14-36q12 2 14 36l6 8H30z', '#c98f2e') + thin('M36 62h28M41 44q9-5 18 0', '#8a5d14', 2.4) + c(50, 81, 5, '#8a5d14') +
    p('M22 86l10-10 8 8M60 84l8-8 10 10', SC, 'stroke-width="3"'),

  // spells
  vahagn: shadow(20) + p('M50 92q-28-4-24-32q3 8 9 9q-8-26 14-46q-2 16 10 26q4-6 3-14q18 20 12 40q-4 16-24 17z', '#ef5b25') +
    p('M50 88q-15-3-12-19q3 6 8 5q-3-14 8-24q0 10 7 16q7 8 2 16q-4 6-13 6z', '#ffb238', 'stroke-width="2"') +
    p('M50 86q-7-2-5-9q3 2 4-2q6 4 5 8q-1 3-4 3z', '#fff1a8', 'stroke="none"'),
  ararat: `<circle cx="64" cy="28" r="15" fill="${GOLD}" opacity=".9"/>` + thin('M64 6v-4M84 14l4-4M90 30h5M42 14l-4-4', GOLD, 3) +
    p('M4 88L36 30l14 22 14-14 32 50z', '#7f95a8') + p('M26 48l10-18 9 14-6-3-5 6-4-4zM56 46l8-8 9 14-6-3-5 5z', WHITE, 'stroke-width="2.5"') +
    p('M4 88q46-12 92 0v6H4z', '#7fae6b'),
  horn: shadow(28) + p('M14 34q-4 40 34 46q30 4 40-18l-14-10q-6 12-22 10q-22-3-20-28z', '#e9dcc3') + p('M14 34q0-8 9-8t9 8q-9 4-18 0z', GOLD) +
    thin('M30 60q6 9 16 11M66 60l10 6', '#b9a580', 2) + p('M74 52l14 10 6-12-12-8z', GOLD) + thin('M92 30q6 6 4 14M84 24q10 2 14 10', SC, 3),
  anahit: halo(GOLD, 50) + p('M22 22q28 10 56 0q4 44-28 68q-32-24-28-68z', SL) + p('M30 31q20 6 40 0q2 30-20 48q-22-18-20-48z', 'none', `stroke="${GOLD2}" stroke-width="2.5"`) +
    p('M50 36l4 9 10 1-7.5 6.5 2.5 10-9-5.5-9 5.5 2.5-10-7.5-6.5 10-1z', GOLD, 'stroke-width="2.2"'),

  // buildings
  archertower: shadow(28) + p('M32 92l4-46h28l4 46z', WOOD) + thin('M35 60h30M34 74h32M44 46v46M56 46v46', WOOD2, 2) +
    p('M26 48V30h48v18z', TUFF2) + p('M24 32V20h9v6h9v-6h16v6h9v-6h9v12z', TUFF) + p('M46 34h8v10h-8z', '#4a2f27', 'stroke-width="2"') +
    ln('M50 20V5', WOOD2, 1.6) + p('M51 5l15 5-15 5z', SC, 'stroke-width="2.4"') + thin('M30 40h10M60 40h10', TUFF3, 1.6),
  wall: shadow(38) + p('M8 92V44h84v48z', TUFF) + p('M6 46V32h12v6h12v-6h14v6h12v-6h14v6h12v-6h12v14z', TUFF2) +
    bricks('M8 58h84M8 70h84M8 82h84M22 46v12M50 46v12M78 46v12M36 58v12M64 58v12M22 70v12M50 70v12M78 70v12M36 82v10M64 82v10') +
    p('M40 60h20v8H40z', SC, 'stroke-width="2.4"'),

  // enemy-only units
  giant: big(man({ tunic: '#8a6a4a', trim: SC, skin: SKIN2, hat: thin('M40 24q10-6 20 0', HAIR, 3), chin: p('M43 42h14v4H43z', WHITE, 'stroke-width="1.6"'),
    left: armL(SKIN2), right: armR(SKIN2, 74, 60) + p('M70 62L80 14q9-4 13 5l-15 45z', WOOD) + dot(84, 24, 2, WOOD2) + dot(87, 34, 2, WOOD2), sh: 28 }), 1.1),
  elephant: shadow(38) + p('M14 50q-8 6-6 20', 'none', `stroke="${O}" stroke-width="5"`) +
    p('M22 68v24h11V72zM42 74v18h11V74zM60 72v20h11V70z', '#8f9499') +
    p('M12 54q0-24 30-24h20q24 0 26 24q2 10-3 22q-2 6 1 12q-4 4-9 1q-4-10-1-22q-4 6-12 6H26Q12 72 12 54z', '#a4a9ae') +
    p('M62 36q14-4 20 8q-2 12-12 14q-8-8-8-22z', '#8f9499', 'stroke-width="2.5"') + dot(80, 46, 2) +
    p('M78 60q8 4 12-2', 'none', `stroke="${WHITE}" stroke-width="4"`) + thin('M78 60q8 4 12-2', O, 1) +
    p('M28 30h30v24q-15 6-30 0z', SC) + thin('M28 48q15 6 30 0', SL, 2.5) + p('M30 30V18h26v12', SD, 'stroke-width="2.6"') + c(43, 14, 6, SKIN) ,
  legionary: man({ hat: p('M35 31q-1-19 15-21q16 2 15 21q-15-6-30 0z', STEEL) + p('M38 12q12-12 24 0q-12-4-24 0z', SC) + p('M36 30v10h5v-8zM64 30v10h-5v-8z', STEEL, 'stroke-width="2"'),
    left: armL(), right: armR(SC, 72, 60) + p('M70 62l1-30 2.5-5 2.5 5 1 30z', STEEL, 'stroke-width="2.4"') + p('M67 60h13v4H67z', GOLD, 'stroke-width="2"'),
    front: p('M22 46h30v40H22z', SC) + thin('M26 50h22v32H26z', SL, 2) + c(37, 66, 5, GOLD, 'stroke-width="2"') }),
  immortal: man({ tunic: '#d9c27a', trim: SC, hat: p('M34 31q-2-20 16-21q18 1 16 21q-3 8-1 14h-5q-2-12-10-13q-8 1-10 13h-5q2-6-1-14z', SC), chin: beard(HAIR, 'M40 40q10 14 20 0q-1 10-10 11q-9-1-10-11z'),
    left: armL('#d9c27a') + p('M17 52q11-6 22 0v24q-11 6-22 0z', '#c9a15a') + thin('M17 60h22M17 68h22M28 50v28', LEATH, 1.8),
    right: armR('#d9c27a') + spear(76, 10, 92) + c(76, 90, 3.6, GOLD, 'stroke-width="2"') }),
  camelrider: shadow(34) + p('M26 66l-3 26h7l4-22zM40 70v22h7V70zM58 70v22h7V70zM68 66l4 26h7l-5-28z', '#c9a36b') +
    p('M20 62q-2-12 14-14q4-16 14-16q10 0 13 16h7l8-28q8-6 16-2l3 10q-2 5-8 3l-5-2l-6 26q-2 16-18 16H36q-16 0-16-9z', '#d9b47a') +
    dot(86, 24, 1.8) + p('M20 60q-9 6-7 18', 'none', `stroke="${O}" stroke-width="4"`) +
    p('M36 40h24v14q-12 5-24 0z', SC) + thin('M36 50q12 5 24 0', SL, 2.2) +
    `<g transform="translate(0 -12)">${rider({ lance: true, hat: p('M35 30q0-18 15-19q15 1 15 19q-15-6-30 0z', WHITE) + thin('M36 26q14-5 28 0', SD, 3) })}</g>`,
  cannon: shadow(34) + p('M20 60L78 38l8 16-58 22z', '#4b4f55') + p('M76 36l10-4 9 20-10 4z', '#33363b') + thin('M40 54l5 13M58 47l5 13', '#7b8087', 2.4) +
    p('M12 76l30-14 8 8-30 18z', WOOD) + c(40, 74, 16, WOOD) + c(40, 74, 9.5, 'none', `stroke="${WOOD2}" stroke-width="2.5"`) + c(40, 74, 3.2, GOLD, 'stroke-width="2"') +
    thin('M40 58v32M24 74h32M29 63l22 22M51 63L29 85', WOOD2, 2) + p('M56 30h14v8H56z', SC, 'stroke-width="2.4"'),

  // bosses (purple halo, larger body)
  boss_bel: big(man({ back: halo(PURPLE), tunic: '#5b3a2e', trim: GOLD, skin: SKIN2,
    hat: p('M35 30q0-18 15-19q15 1 15 19q-15-6-30 0z', '#6f5a2c') + p('M36 20Q24 16 24 4q8 6 14 8zM64 20q12-4 12-16q-8 6-14 8z', WHITE, 'stroke-width="2.5"'),
    chin: beard(HAIR, 'M37 38q13 18 26 0q0 22-13 26q-13-4-13-26z'), left: armL(SKIN2), right: armR(SKIN2, 74, 60) + p('M70 62L79 14q10-4 14 6l-15 44z', '#4a4a4a') + dot(84, 24, 2.2, STEEL) + dot(88, 34, 2.2, STEEL), sh: 28 })),
  boss_seleucid: big(man({ back: halo(PURPLE) + cape(PURPLE), tunic: WHITE, trim: SC,
    hat: p('M34 36q-3-26 16-28q19 2 16 28l-5 6v-10q-11-5-22 0v10z', '#c9a15a') + p('M38 10Q50-6 66 6q-10 0-14 8z', SC, 'stroke-width="2.6"'),
    left: armL(WHITE) + roundShield(27, 67, 13, SC), right: armR(WHITE) + spear(76, 2, 94) })),
  boss_lucullus: big(man({ back: halo(PURPLE) + cape('#a3242f'), tunic: WHITE, trim: GOLD,
    hat: hair('#8a8078') + thin('M36 27q4-6 9-5M64 27q-4-6-9-5M43 21q7-4 14 0', '#5c8a3c', 3.4),
    left: armL(WHITE, 28, 60) + p('M20 50h14v18q-7 6-14 0z', '#e9dcc3', 'stroke-width="2.4"'), right: armR(WHITE) + sword(74, 64, 34), front: thin('M36 54q14 8 28 0', GOLD, 2.6) })),
  boss_persian: big(man({ back: halo(PURPLE) + cape('#2f5c6e'), tunic: '#2f5c6e', trim: GOLD,
    hat: p('M36 30l-2-20q16-8 32 0l-2 20q-14-6-28 0z', GOLD) + thin('M36 18h28', GOLD2, 2), chin: beard(HAIR, 'M38 38q12 12 24 0v14q-12 8-24 0z') + thin('M42 44h16M42 49h16', '#5a463f', 1.4),
    left: armL('#2f5c6e'), right: armR('#2f5c6e') + p('M71 62Q68 30 86 16Q86 40 77 62z', STEEL, 'stroke-width="2.5"') + p('M67 60h14v4H67z', GOLD, 'stroke-width="2.2"') })),
  boss_ostikan: big(man({ back: halo(PURPLE) + cape('#2d5a3a'), tunic: '#2d5a3a', trim: GOLD,
    hat: p('M33 30q-4-20 17-21q21 1 17 21q-17-8-34 0z', WHITE) + thin('M36 22q14 6 28-4M38 14q12 6 24-1', '#cfc4b8', 2) + c(50, 14, 3, '#b02a36', 'stroke-width="1.6"'),
    chin: beard(HAIR, 'M39 40q11 14 22 0q-1 12-11 14q-10-2-11-14z'), left: armL('#2d5a3a') + roundShield(27, 67, 12, '#2d5a3a'),
    right: armR('#2d5a3a') + p('M71 62Q66 32 84 14Q88 40 77 62z', STEEL, 'stroke-width="2.5"') + p('M67 60h14v4H67z', GOLD, 'stroke-width="2.2"') })),
  boss_warlord6: big(man({ back: halo(PURPLE) + cape('#5a3a2a'), tunic: '#7a2a3a', trim: GOLD,
    hat: p('M34 30q-1-20 16-21q17 1 16 21q-16-7-32 0z', STEEL) + p('M50 9q-2-10 8-8q-6 2-4 8z', '#b02a36', 'stroke-width="2.4"') + thin('M36 27q14-6 28 0', GOLD, 2.6), chin: moustache(),
    left: armL('#7a2a3a'), right: armR('#7a2a3a') + ln('M74 68V30', WOOD2, 2.4) + c(74, 24, 8, '#4a4a4a') + dot(74, 15, 2, STEEL) + dot(66, 24, 2, STEEL) + dot(82, 24, 2, STEEL) })),
  boss_warlord7: big(man({ back: halo(PURPLE), tunic: '#59624a', trim: LEATH,
    hat: p('M35 27q1-14 15-15q14 1 15 15z', '#59624a') + p('M33 27h34l5 4H33z', '#2f3327', 'stroke-width="2.2"') + c(50, 20, 2.6, GOLD, 'stroke-width="1.4"'), chin: moustache(),
    left: armL('#59624a') + p('M18 58l14-4 3 6-14 5z', '#33363b', 'stroke-width="2.2"'), right: armR('#59624a') + p('M71 62Q70 32 84 18Q84 40 77 62z', STEEL, 'stroke-width="2.5"') + p('M67 60h14v4H67z', GOLD, 'stroke-width="2.2"'),
    front: p('M34 52h8v5h-8zM58 52h8v5h-8z', GOLD, 'stroke-width="1.8"') + thin('M40 54l22 20', LEATH, 3.4) })),

  tower_small: towerSmall,
  tower_king: towerKing,
  gold: c(50, 50, 38, GOLD, 'stroke-width="5"') + c(50, 50, 27, 'none', `stroke="${GOLD2}" stroke-width="4"`) +
    p('M50 30l5.5 12.5 13.5 1.5-10 9 3 13.5-12-7-12 7 3-13.5-10-9 13.5-1.5z', '#fff1a8', `stroke="${GOLD2}" stroke-width="3"`),
};

// ---- small UI icons (24x24 viewBox, single colour = currentColor) ----
const UI = {
  hp: '<path d="M12 21C4 15 2 11 2 7.5A5 5 0 0 1 12 6a5 5 0 0 1 10 1.5C22 11 20 15 12 21z" fill="currentColor"/>',
  atk: '<path d="M20 2l2 0 0 2L11 15l-2-2zM7 13l4 4-1.5 1.5-1.5-1.5-3.5 3.5L3 19l3.5-3.5L5 14z" fill="currentColor"/>',
  spd: '<path d="M4 4l8 8-8 8h5l8-8-8-8zM13 4l8 8-8 8h-3l8-8-8-8z" fill="currentColor"/>',
  rng: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
  lock: '<path d="M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10zm3 0h4V7a2 2 0 0 0-4 0z" fill="currentColor"/>',
  swords: '<path d="M3 3h3l7 7-2 2-8-6zM21 3h-3L6 15l-2-1-1 2 2 1-2 3 1 1 3-2 1 2 2-1-1-2L21 6zM15 13l5 5-1 2-2-1-4-4z" fill="currentColor"/>',
  brain: '<path d="M9 3a4 4 0 0 0-4 4 4 4 0 0 0-1 7 4 4 0 0 0 5 5h2V3zM15 3a4 4 0 0 1 4 4 4 4 0 0 1 1 7 4 4 0 0 1-5 5h-2V3z" fill="currentColor"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="currentColor"/>',
  star: '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.5 5.700 21.100l1.500-7L2 9.300l7-.8z" fill="currentColor"/>',
  hourglass: '<path d="M6 2h12v4l-4 6 4 6v4H6v-4l4-6-4-6z" fill="currentColor"/>',
  sound: '<path d="M3 9h4l5-4v14l-5-4H3zM15 8a5 5 0 0 1 0 8M17.500 5a9 9 0 0 1 0 14" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  scroll: '<path d="M6 3h11a3 3 0 0 1 3 3v2h-4v10a3 3 0 0 1-3 3H5a3 3 0 0 1-2-5h3zM9 8h4M9 12h4" fill="currentColor" stroke="#fff" stroke-width="1.2"/>',
  gift: '<path d="M3 9h18v4H3zM5 13h14v8H5zM11 9h2v12h-2zM12 9C9 9 7 7 8 5s4 0 4 4c0-4 3-6 4-4s-1 4-4 4z" fill="currentColor"/>',
  check: '<path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>',
  hand: '<path d="M9 11V4a1.500 1.500 0 0 1 3 0v6-7a1.500 1.500 0 0 1 3 0v7-5a1.500 1.500 0 0 1 3 0v10c0 4-2 7-6 7s-6-2-8-7l-1-3a1.500 1.500 0 0 1 3-1z" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 10v7M12 6.500v.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
};

export const SPRITE_IDS = Object.keys(S);
export function hasSprite(id) { return Object.prototype.hasOwnProperty.call(S, id); }

/** Full SVG markup of a sprite. */
export function spriteSvg(id) {
  if (!hasSprite(id)) return '';
  return `<svg class="sprite" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<g stroke="${O}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">${S[id]}</g></svg>`;
}
/** Stand-alone SVG (fixed colours, for files and the app icon). side: 0 = apricot, 1 = pomegranate. */
export function spriteFile(id, side = 0) {
  const col = side ? ['#b02a36', '#7d1a23', '#ee9aa1'] : ['#e08a2e', '#a85c14', '#f8cf94'];
  return spriteSvg(id).replace(/var\(--sc,[^)]*\)/g, col[0]).replace(/var\(--sd,[^)]*\)/g, col[1]).replace(/var\(--sl,[^)]*\)/g, col[2]);
}
export function uiSvg(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${UI[name] || ''}</svg>`;
}
export const UI_ICON_NAMES = Object.keys(UI);
