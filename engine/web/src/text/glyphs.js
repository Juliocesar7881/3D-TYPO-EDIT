// Geometria de glifos: extrusão com bevel, contorno (stroke) e chapa plana.
// Tudo construído em size = 1 (cap height = 1) e reaproveitado por cache.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const geoCache = new Map();

function centerOf(bbox) {
  return [(bbox.x1 + bbox.x2) / 2, (bbox.y1 + bbox.y2) / 2];
}

function contourPoints(shape, divisions) {
  const out = [shape.getPoints(divisions)];
  for (const h of shape.holes) out.push(h.getPoints(divisions));
  return out;
}

/**
 * opts: { depth, bevel, bevelSegments, curveSegments, strokeWidth, plate }
 * retorna { face, stroke, plate, center:[cx,cy], bbox }
 */
export function glyphGeometry(font, ch, opts = {}) {
  const depth = opts.depth ?? 0.22;
  const bevel = opts.bevel ?? 0.025;
  const curveSegments = opts.curveSegments ?? 8;
  const bevelSegments = opts.bevelSegments ?? 3;
  const strokeWidth = opts.strokeWidth ?? 0;
  const strokeWidth2 = opts.strokeWidth2 ?? 0;
  const key = [font.name, ch, depth, bevel, curveSegments, bevelSegments, strokeWidth, strokeWidth2, opts.plate ? 1 : 0].join('|');
  if (geoCache.has(key)) return geoCache.get(key);

  const g = font.shapes(ch, curveSegments);
  const res = { face: null, stroke: null, plate: null, center: [0, 0], bbox: g.bbox, empty: g.empty };
  if (g.empty) {
    geoCache.set(key, res);
    return res;
  }
  const [cx, cy] = centerOf(g.bbox);
  res.center = [cx, cy];

  if (depth > 0) {
    const bt = Math.min(bevel, depth * 0.45);
    const geo = new THREE.ExtrudeGeometry(g.shapes, {
      depth,
      curveSegments,
      bevelEnabled: bevel > 0,
      bevelThickness: bt,
      bevelSize: bevel * 0.8,
      bevelOffset: -bevel * 0.35,
      bevelSegments,
    });
    geo.translate(-cx, -cy, -depth / 2);
    geo.computeVertexNormals();
    res.face = geo;
  } else {
    const geo = new THREE.ShapeGeometry(g.shapes, curveSegments);
    geo.translate(-cx, -cy, 0);
    res.face = geo;
  }

  const makeStroke = (w) => {
    const style = SVGLoader.getStrokeStyle(w, '#fff', 'round', 'round', 4);
    const parts = [];
    for (const s of g.shapes) {
      for (const pts of contourPoints(s, curveSegments)) {
        if (pts.length < 2) continue;
        const closed = pts.slice();
        if (!closed[0].equals(closed[closed.length - 1])) closed.push(closed[0].clone());
        const sg = SVGLoader.pointsToStroke(closed, style);
        if (sg) parts.push(sg);
      }
    }
    if (!parts.length) return null;
    const merged = mergeSimple(parts);
    merged.translate(-cx, -cy, 0);
    return merged;
  };
  if (strokeWidth > 0) res.stroke = makeStroke(strokeWidth);
  if (strokeWidth2 > 0) res.stroke2 = makeStroke(strokeWidth2);

  if (opts.plate) {
    // chapa plana do formato da letra (usada como sombra / fundo do contorno)
    const pg = new THREE.ShapeGeometry(g.shapes, Math.max(4, curveSegments >> 1));
    pg.translate(-cx, -cy, 0);
    res.plate = pg;
  }

  geoCache.set(key, res);
  return res;
}

// merge simples de geometrias não indexadas (só position/normal/uv)
export function mergeSimple(geos) {
  let count = 0;
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flat) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  let o = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array, o);
    o += g.attributes.position.array.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const n = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) n[i * 3 + 2] = 1;
  out.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return out;
}
