/**
 * A small QR code encoder, written here because the app adds no dependency for it.
 * Byte mode, error correction level M, versions 1-6 (up to 106 bytes), which covers the Play Store link.
 * Returns a square matrix: true = dark module. No quiet zone; the caller adds 4 modules of white around it.
 */

// per version (index = version): data codewords per block, number of blocks, EC codewords per block (level M)
const SPEC: readonly (readonly [number, number, number])[] = [[0, 0, 0], [16, 1, 10], [28, 1, 16], [44, 1, 26], [32, 2, 18], [43, 2, 24], [27, 4, 16]];

const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** Reed-Solomon remainder of `data` for `n` error-correction codewords. */
function rsRemainder(data: readonly number[], n: number): number[] {
  let gen = [1];
  for (let i = 0; i < n; i++) { // multiply by (x - a^i)
    const next = new Array<number>(gen.length + 1).fill(0);
    gen.forEach((g, j) => { next[j] ^= g; next[j + 1] ^= mul(g, EXP[i]); });
    gen = next;
  }
  const rem = new Array<number>(n).fill(0);
  for (const d of data) {
    const f = d ^ rem.shift()!;
    rem.push(0);
    for (let j = 0; j < n; j++) rem[j] ^= mul(gen[j + 1], f);
  }
  return rem;
}

/** Largest text (in UTF-8 bytes) this encoder can hold. */
export const QR_MAX_BYTES = 106;

export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 0;
  for (let v = 1; v < SPEC.length; v++) if (bytes.length <= SPEC[v][0] * SPEC[v][1] - 2) { version = v; break; }
  if (!version) throw new Error("Text is too long for the QR code.");
  const [perBlock, blocks, ecLen] = SPEC[version];
  const dataLen = perBlock * blocks;

  // bit stream: mode 0100, 8-bit length, data, terminator, pad bytes
  const bits: number[] = [];
  const put = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, 8); bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, dataLen * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xec; bits.length < dataLen * 8; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // split into blocks, add error correction, interleave
  const dBlocks: number[][] = [], eBlocks: number[][] = [];
  for (let b = 0; b < blocks; b++) { const d = data.slice(b * perBlock, (b + 1) * perBlock); dBlocks.push(d); eBlocks.push(rsRemainder(d, ecLen)); }
  const stream: number[] = [];
  for (let i = 0; i < perBlock; i++) dBlocks.forEach(d => stream.push(d[i]));
  for (let i = 0; i < ecLen; i++) eBlocks.forEach(e => stream.push(e[i]));

  const size = version * 4 + 17;
  const m: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => { if (x >= 0 && y >= 0 && x < size && y < size) { m[y][x] = dark; fixed[y][x] = true; } };

  // finder patterns with their white separators
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(cx + dx, cy + dy, d !== 2 && d !== 4);
    }
  }
  // timing patterns
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  // one alignment pattern (versions 2-6)
  if (version >= 2) {
    const c = size - 7;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  // format information (level M = 00, then the mask number), drawn again once the mask is chosen
  const drawFormat = (mask: number) => {
    const d = mask; // (0b00 << 3) | mask
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((d << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true); // always dark
  };
  drawFormat(0);

  // data: two-column zigzag from the bottom right, skipping the vertical timing column
  let k = 0;
  const total = stream.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? size - 1 - vert : vert;
        if (fixed[y][x]) continue;
        m[y][x] = k < total ? ((stream[k >>> 3] >>> (7 - (k & 7))) & 1) === 1 : false; // remainder bits stay light
        k++;
      }
    }
  }

  const MASKS: ((x: number, y: number) => boolean)[] = [
    (x, y) => (x + y) % 2 === 0, (_x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = (mask: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x]; };

  // pick the mask a scanner will find easiest (standard penalty score)
  const penalty = (): number => {
    let p = 0, dark = 0;
    const line = (get: (i: number) => boolean) => {
      let run = 1, hist = "";
      for (let i = 0; i < size; i++) hist += get(i) ? "1" : "0";
      for (let i = 1; i <= size; i++) {
        if (i < size && get(i) === get(i - 1)) run++;
        else { if (run >= 5) p += run - 2; run = 1; }
      }
      for (let i = 0; i + 11 <= size; i++) { const s = hist.substr(i, 11); if (s === "10111010000" || s === "00001011101") p += 40; }
    };
    for (let y = 0; y < size; y++) { line(x => m[y][x]); for (let x = 0; x < size; x++) if (m[y][x]) dark++; }
    for (let x = 0; x < size; x++) line(y => m[y][x]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
    p += Math.floor(Math.abs((dark * 20) / (size * size) - 10)) * 10;
    return p;
  };
  let best = 0, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask); drawFormat(mask);
    const s = penalty();
    if (s < bestScore) { bestScore = s; best = mask; }
    applyMask(mask); // undo (XOR)
  }
  applyMask(best); drawFormat(best);
  return m;
}
