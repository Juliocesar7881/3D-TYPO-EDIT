// RNG determinístico: toda escolha "aleatória" do motor sai daqui,
// então a mesma cena + seed sempre gera exatamente o mesmo vídeo
// (necessário para renderizar em pedaços paralelos).

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1) {
    this.seed = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.next = mulberry32(this.seed);
  }
  fork(label) {
    return new RNG((this.seed ^ hashString(String(label))) >>> 0);
  }
  float() { return this.next(); }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; }
  // escolhe evitando os últimos itens usados (variedade entre shots)
  pickFresh(arr, recent = [], memory = 2) {
    const avoid = new Set(recent.slice(-memory));
    const pool = arr.filter((x) => !avoid.has(x));
    return this.pick(pool.length ? pool : arr);
  }
  weighted(entries) {
    // entries: [[valor, peso], ...] ou {valor: peso}
    const list = Array.isArray(entries) ? entries : Object.entries(entries);
    const total = list.reduce((s, [, w]) => s + Math.max(0, w), 0);
    let r = this.next() * total;
    for (const [v, w] of list) {
      r -= Math.max(0, w);
      if (r <= 0) return v;
    }
    return list[list.length - 1][0];
  }
  gauss() {
    const u = 1 - this.next();
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  onSphere() {
    const u = this.range(-1, 1);
    const th = this.range(0, Math.PI * 2);
    const r = Math.sqrt(1 - u * u);
    return [r * Math.cos(th), r * Math.sin(th), u];
  }
}
