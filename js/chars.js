// Character definitions. Both are stylised satirical caricatures built from the same skeleton layout,
// but each has its own proportions, stance (Trump orthodox, Putin southpaw) and independent animation timing.
export const CHARS = [
  {
    id: 'trump', name: 'TRUMP', face: { src: 'assets/faces/trump.jpg', crop: { cx: 0.5, cy: 0.5, w: 1, h: 1 } }, lead: 'L', scale: 1.03, bulk: 1.12, belly: 0.02,
    skin: 0xe9a57a, suit: 0x24418c, trousers: 0x1d3475, glove: 0xd4172e, tie: 0xc8102e, tieLen: 0.36, hair: 0xe3b95a, brow: 0xc99a46,
    hairStyle: 'swoop', head: { rx: 0.105, ry: 0.125, rz: 0.1 },
    anim: {
      tempo: 1.1, headYawSign: 1,
      jab: { shoulder: 106.84, elbow: 6, lunge: 0.054, yaw: 25.571, armX: 7.791, drop: -0.109, lean: 9.18 },
      hook: { wind: 0.25, windYaw: -34, contact: 0.46, lunge: 0.172, hipYaw: 16, spineYaw: 10, chestYaw: 18, armYaw: 39.617, armX: -105, drop: -0.012, lean: 8.059, elbow: 72.573, end: 0.95 },
      impact: { snap: 24, step: 0.08 },
      ko: { slide: 0.45 },
    },
  },
  {
    id: 'putin', name: 'PUTIN', face: { src: 'assets/faces/putin.jpg', crop: { cx: 0.5, cy: 0.5, w: 1, h: 1 } }, lead: 'R', scale: 0.97, bulk: 0.96, belly: 0,
    skin: 0xe8c3a8, suit: 0x646d82, trousers: 0x4a5266, glove: 0x2468e6, tie: 0x18407f, tieLen: 0.3, hair: 0xb8a487, brow: 0x9a8668,
    hairStyle: 'short', head: { rx: 0.092, ry: 0.112, rz: 0.086 },
    anim: {
      tempo: 0.92, headYawSign: 1,
      jab: { shoulder: 120.93, elbow: 4, lunge: 0.166, yaw: 22.628, armX: 5.833, drop: -0.034, lean: 10 },
      hook: { wind: 0.2, windYaw: -30, contact: 0.38, lunge: 0.25, hipYaw: 20, spineYaw: 12, chestYaw: 20, armYaw: 49.207, armX: -105, drop: 0, lean: 10, elbow: 60, end: 0.82 },
      impact: { snap: 20, step: 0.1 },
      ko: { slide: 0.45 },
    },
  },
];
