// Carrega fontes TTF/OTF com opentype.js e converte glifos em THREE.Shape.
// Tamanho normalizado: size = 1 significa altura de caixa-alta (cap height) = 1
// unidade de mundo, então trocar de fonte não muda o tamanho visual.
import * as THREE from 'three';
import opentype from 'opentype';

// nome amigável -> arquivo em /fonts
export const FONT_FILES = {
  anton: 'Anton-Regular.ttf',
  bebas: 'BebasNeue-Regular.ttf',
  archivo: 'ArchivoBlack-Regular.ttf',
  titan: 'TitanOne-Regular.ttf',
  lilita: 'LilitaOne-Regular.ttf',
  luckiest: 'LuckiestGuy-Regular.ttf',
  bungee: 'Bungee-Regular.ttf',
  monoton: 'Monoton-Regular.ttf',
  righteous: 'Righteous-Regular.ttf',
  abril: 'AbrilFatface-Regular.ttf',
  dmserif: 'DMSerifDisplay-Regular.ttf',
  pacifico: 'Pacifico-Regular.ttf',
  sixcaps: 'SixCaps.ttf',
  audiowide: 'Audiowide-Regular.ttf',
  russo: 'RussoOne-Regular.ttf',
  chewy: 'Chewy-Regular.ttf',
  bowlby: 'BowlbyOneSC-Regular.ttf',
  rubikmono: 'RubikMonoOne-Regular.ttf',
  blackops: 'BlackOpsOne-Regular.ttf',
  italiana: 'Italiana-Regular.ttf',
  julius: 'JuliusSansOne-Regular.ttf',
  marcellus: 'Marcellus-Regular.ttf',
  cinzel: 'CinzelDecorative-Bold.ttf',
  cinzellight: 'CinzelDecorative-Regular.ttf',
  poiret: 'PoiretOne-Regular.ttf',
  michroma: 'Michroma-Regular.ttf',
  poppins: 'Poppins-Black.ttf',
  poppinsxb: 'Poppins-ExtraBold.ttf',
  poppinssb: 'Poppins-SemiBold.ttf',
};

const fontCache = new Map();

export class LoadedFont {
  constructor(name, otFont) {
    this.name = name;
    this.ot = otFont;
    this.upm = otFont.unitsPerEm;
    let cap = otFont.tables.os2 && otFont.tables.os2.sCapHeight;
    if (!cap || cap < this.upm * 0.3) {
      const g = otFont.charToGlyph('H');
      const bb = g.getBoundingBox();
      cap = bb.y2 - bb.y1 || this.upm * 0.7;
    }
    this.capUnits = cap;
    this.glyphCache = new Map();
    // métrica de x-height para alinhar minúsculas
    const xg = otFont.charToGlyph('x').getBoundingBox();
    this.xHeight = (xg.y2 - xg.y1) / cap || 0.7;
    const asc = otFont.ascender / cap, desc = otFont.descender / cap;
    this.ascender = asc;
    this.descender = desc;
  }

  // escala unidades da fonte -> mundo para size=1 (cap height = 1)
  get k() { return 1 / this.capUnits; }

  advance(ch) {
    const g = this.ot.charToGlyph(ch);
    return (g.advanceWidth || this.upm * 0.5) * this.k;
  }

  kerning(a, b) {
    if (!a || !b) return 0;
    try {
      return this.ot.getKerningValue(this.ot.charToGlyph(a), this.ot.charToGlyph(b)) * this.k;
    } catch {
      return 0;
    }
  }

  // Shapes do glifo em size=1, origem na baseline/esquerda
  shapes(ch, curveSegments = 8) {
    const key = ch + '|' + curveSegments;
    if (this.glyphCache.has(key)) return this.glyphCache.get(key);
    const g = this.ot.charToGlyph(ch);
    const path = g.getPath(0, 0, this.upm); // y para baixo em unidades
    const sp = new THREE.ShapePath();
    const k = this.k;
    for (const c of path.commands) {
      switch (c.type) {
        case 'M': sp.moveTo(c.x * k, -c.y * k); break;
        case 'L': sp.lineTo(c.x * k, -c.y * k); break;
        case 'Q': sp.quadraticCurveTo(c.x1 * k, -c.y1 * k, c.x * k, -c.y * k); break;
        case 'C': sp.bezierCurveTo(c.x1 * k, -c.y1 * k, c.x2 * k, -c.y2 * k, c.x * k, -c.y * k); break;
        case 'Z': if (sp.currentPath) sp.currentPath.autoClose = true; break;
      }
    }
    // TrueType: contorno externo horário; deixa o three detectar furos
    let shapes = sp.toShapes(true);
    if (!shapes.length) shapes = sp.toShapes(false);
    const bb = g.getBoundingBox();
    const res = {
      shapes,
      bbox: { x1: bb.x1 * k, y1: bb.y1 * k, x2: bb.x2 * k, y2: bb.y2 * k },
      empty: shapes.length === 0,
    };
    this.glyphCache.set(key, res);
    return res;
  }

  // largura total de uma string com tracking (em size=1)
  measure(text, tracking = 0) {
    let w = 0;
    const chars = [...text];
    chars.forEach((ch, i) => {
      w += this.advance(ch) + (i < chars.length - 1 ? this.kerning(ch, chars[i + 1]) + tracking : 0);
    });
    return w;
  }
}

export async function loadFont(nameOrFile) {
  const key = String(nameOrFile || 'anton');
  if (fontCache.has(key)) return fontCache.get(key);
  const p = (async () => {
    let url;
    const lower = key.toLowerCase().replace(/[\s_-]/g, '');
    if (FONT_FILES[lower]) url = '/fonts/' + FONT_FILES[lower];
    else if (/\.(ttf|otf|woff)$/i.test(key)) url = key.startsWith('/') ? key : '/project/' + key;
    else {
      console.warn('[fonts] fonte desconhecida', key, '-> usando anton');
      url = '/fonts/' + FONT_FILES.anton;
    }
    const buf = await (await fetch(url)).arrayBuffer();
    return new LoadedFont(key, opentype.parse(buf));
  })();
  fontCache.set(key, p);
  return p;
}
