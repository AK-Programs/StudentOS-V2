import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Stage as StageComp, Layer as LayerComp, Line as LineComp, Rect as RectComp, 
  Circle as CircleComp, RegularPolygon as RegularPolygonComp, Arrow as ArrowComp, 
  Group as GroupComp, Text as TextComp, Ellipse as EllipseComp, Star as StarComp, 
  Transformer as TransformerComp, Image as KonvaImageComp 
} from 'react-konva';
import { 
  Download, Eraser, MousePointer2, Pen, PenTool, Square, Circle as CircleIcon, 
  Triangle, Minus, ChevronDown, Trash2, Sliders, Settings2, Plus, Copy,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, ArrowUp, ArrowDown, Type, Sparkles,
  Undo2, Redo2, Image as ImageIcon, StickyNote, FileText, Box, Layers, Hand, RotateCcw, Eye, Tag, HelpCircle,
  Play, Rotate3d
} from 'lucide-react';
import { InteractiveThreeDViewer, Educational3DScene } from './InteractiveThreeDViewer';
import { ThreeDLibraryAndRequestModal } from './ThreeDLibraryAndRequestModal';

const Stage = StageComp as any;
const Layer = LayerComp as any;
const Line = LineComp as any;
const Rect = RectComp as any;
const Circle = CircleComp as any;
const RegularPolygon = RegularPolygonComp as any;
const Arrow = ArrowComp as any;
const Group = GroupComp as any;
const Text = TextComp as any;
const Ellipse = EllipseComp as any;
const Star = StarComp as any;
const Transformer = TransformerComp as any;
const KonvaImage = KonvaImageComp as any;

export interface Part3D {
  id: string;
  label: string;
  shape?: 'box' | 'sphere' | 'cylinder' | 'pyramid' | 'prism' | 'triangular_prism' | 'torus' | 'ring' | 'cone' | 'plane';
  primitive?: 'box' | 'sphere' | 'cylinder' | 'pyramid' | 'prism' | 'torus' | 'cone' | 'plane';
  position: [number, number, number];
  dimensions: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  opacity?: number;
  description?: string;
  wireframe?: boolean;
}

export interface Scene3DData {
  id: string;
  title: string;
  category?: string;
  subject?: string;
  subtitle?: string;
  description?: string;
  summary?: string;
  educationalNotes?: string[];
  formulas?: string[];
  parts: Part3D[];
  connections?: Array<{
    fromId?: string;
    toId?: string;
    from?: [number, number, number];
    to?: [number, number, number];
    color?: string;
    label?: string;
  }>;
}

interface ShapeObj {
  id: string;
  type: 'rect' | 'square' | 'circle' | 'ellipse' | 'triangle' | 'line' | 'arrow' | 'pentagon' | 'polygon' | 'star' | 'ruler-15' | 'ruler-30' | 'protractor' | 'compass' | 'setsquare-45' | 'setsquare-30-60' | 'geometry' | 'text' | 'ruler' | 'setsquare' | 'divider' | 'angle-meter' | 'svg_node' | 'mermaid' | 'model_3d';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[];
  fill?: string;
  stroke: string;
  strokeWidth: number;
  text?: string;
  fontSize?: number;
  imageObj?: HTMLImageElement;
  svgRaw?: string;
  groupId?: string;
  isLocked?: boolean;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  scene3D?: Scene3DData;
  rotX?: number;
  rotY?: number;
  zoom3D?: number;
  explode3D?: number;
  showLabels3D?: boolean;
}

interface LineObj {
  id: string;
  points: number[];
  color: string;
  brushSize: number;
  tool: 'pen' | 'pencil' | 'marker' | 'highlighter' | 'eraser';
  groupId?: string;
  isLocked?: boolean;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
}

interface Slide {
  id: string;
  shapes: ShapeObj[];
  lines: LineObj[];
  stickies: any[];
}

declare const mermaid: any;

/**
 * Client-side SVG Sanitizer — strips scripts, event handlers, foreignObject, and unsafe URIs
 */
function sanitizeSvgClient(rawSvg: string): string {
  if (!rawSvg || typeof rawSvg !== 'string') return '';
  let s = rawSvg.trim();
  const match = s.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) return '';
  s = match[0];
  s = s
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(?:href|xlink:href)\s*=\s*["']\s*(?:javascript|data:text\/html|vbscript):[^"']*["']/gi, '');
  if (!/xmlns\s*=/i.test(s)) {
    s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return s;
}

/**
 * Renders a structured 3D educational scene to a crisp SVG string using 3D rotation matrices and depth sorting.
 * Strictly checks every property with full defensive null guards to prevent any undefined runtime crashes.
 */
function renderScene3DToSvg(
  scene?: Scene3DData | null,
  rotXDeg: number = 22,
  rotYDeg: number = -32,
  zoom: number = 1,
  explode: number = 0,
  showLabels: boolean = true
): string {
  if (!scene || typeof scene !== 'object') {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 480" width="680" height="480"><rect width="680" height="480" fill="#090d16" rx="18"/><text x="340" y="240" fill="#94a3b8" font-family="sans-serif" font-size="16" text-anchor="middle">3D Educational Model</text></svg>';
  }

  const W = 680;
  const H = 480;
  const cx = W / 2;
  const cy = H / 2 + 10;

  const safeParts = Array.isArray(scene.parts) ? scene.parts : [];
  const coords = safeParts.flatMap((p: any) => [
    Math.abs(p?.position?.[0] || 0) + (p?.dimensions?.[0] || 0) * 0.5,
    Math.abs(p?.position?.[1] || 0) + (p?.dimensions?.[1] || 0) * 0.5,
    Math.abs(p?.position?.[2] || 0) + (p?.dimensions?.[2] || 0) * 0.5,
  ]);
  const maxExtent = Math.max(1, ...coords);
  const baseScale = maxExtent > 12 ? 145 / maxExtent : 68;
  const scale = baseScale * Math.max(0.4, Math.min(3, zoom || 1));

  const radX = ((rotXDeg || 22) * Math.PI) / 180;
  const radY = ((rotYDeg || -32) * Math.PI) / 180;
  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosY = Math.cos(radY), sinY = Math.sin(radY);

  const project = (pt: [number, number, number]): { x: number; y: number; z: number } => {
    const px = Array.isArray(pt) && typeof pt[0] === 'number' ? pt[0] : 0;
    const py = Array.isArray(pt) && typeof pt[1] === 'number' ? pt[1] : 0;
    const pz = Array.isArray(pt) && typeof pt[2] === 'number' ? pt[2] : 0;
    // Rotate around Y
    const x1 = px * cosY + pz * sinY;
    const z1 = -px * sinY + pz * cosY;
    const y1 = py;
    // Rotate around X
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;
    const perspective = 6.5 / Math.max(2.5, 6.5 - z2 * 0.0035);
    return {
      x: Number((cx + x1 * scale * perspective).toFixed(1)),
      y: Number((cy - y2 * scale * perspective).toFixed(1)),
      z: z2
    };
  };

  const escapeXml = (str: any) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const elements: { z: number; svg: string }[] = [];

  // Reference 3D floor grid
  const gridRange = maxExtent > 12 ? 120 : 2;
  const gridStep = gridRange / 2;
  for (let g = -gridRange; g <= gridRange; g += gridStep) {
    const p1 = project([g, -gridRange * 0.75, -gridRange]);
    const p2 = project([g, -gridRange * 0.75, gridRange]);
    const p3 = project([-gridRange, -gridRange * 0.75, g]);
    const p4 = project([gridRange, -gridRange * 0.75, g]);
    elements.push({
      z: -999,
      svg: `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3" />
            <line x1="${p3.x}" y1="${p3.y}" x2="${p4.x}" y2="${p4.y}" stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3" />`
    });
  }

  // Build part lookup map
  const partMap = new Map<string, any>();
  safeParts.forEach((p: any, idx: number) => {
    if (p) partMap.set(p.id || `part_${idx}`, p);
  });

  // Connections / bonds / flow vectors
  if (Array.isArray(scene.connections)) {
    for (const conn of scene.connections) {
      if (!conn) continue;
      let fCoord: [number, number, number] | null = null;
      let tCoord: [number, number, number] | null = null;

      if (Array.isArray(conn.from) && conn.from.length >= 3) {
        fCoord = conn.from;
      } else if (conn.fromId && partMap.has(conn.fromId)) {
        const fp = partMap.get(conn.fromId)!;
        fCoord = Array.isArray(fp.position) ? fp.position : [0, 0, 0];
      }

      if (Array.isArray(conn.to) && conn.to.length >= 3) {
        tCoord = conn.to;
      } else if (conn.toId && partMap.has(conn.toId)) {
        const tp = partMap.get(conn.toId)!;
        tCoord = Array.isArray(tp.position) ? tp.position : [0, 0, 0];
      }

      if (!fCoord || !tCoord) continue;

      const f: [number, number, number] = [
        (fCoord[0] || 0) * (1 + (explode || 0) * 0.4),
        (fCoord[1] || 0) * (1 + (explode || 0) * 0.4),
        (fCoord[2] || 0) * (1 + (explode || 0) * 0.4)
      ];
      const t: [number, number, number] = [
        (tCoord[0] || 0) * (1 + (explode || 0) * 0.4),
        (tCoord[1] || 0) * (1 + (explode || 0) * 0.4),
        (tCoord[2] || 0) * (1 + (explode || 0) * 0.4)
      ];

      const p1 = project(f);
      const p2 = project(t);
      const avgZ = (p1.z + p2.z) / 2 - 0.1;
      const mx = ((p1.x + p2.x) / 2).toFixed(1);
      const my = ((p1.y + p2.y) / 2 - 8).toFixed(1);
      elements.push({
        z: avgZ,
        svg: `<g>
          <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${conn.color || '#38bdf8'}" stroke-width="3" stroke-linecap="round" />
          ${showLabels && conn.label ? `<text x="${mx}" y="${my}" fill="${conn.color || '#e2e8f0'}" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">${escapeXml(conn.label)}</text>` : ''}
        </g>`
      });
    }
  }

  // Render each 3D part
  for (const part of safeParts) {
    if (!part) continue;
    const partPos = Array.isArray(part.position) ? part.position : [0, 0, 0];
    const pos: [number, number, number] = [
      (partPos[0] || 0) * (1 + (explode || 0) * 0.5),
      (partPos[1] || 0) * (1 + (explode || 0) * 0.5),
      (partPos[2] || 0) * (1 + (explode || 0) * 0.5)
    ];
    const dims = Array.isArray(part.dimensions) ? part.dimensions : [30, 30, 30];
    const dx = dims[0] || 30, dy = dims[1] || 30, dz = dims[2] || 30;
    const center = project(pos);
    const col = part.color || '#6366f1';
    const op = typeof part.opacity === 'number' ? part.opacity : 0.88;
    const shapeType = part.shape || part.primitive || 'box';

    let shapeMarkup = '';

    if (shapeType === 'sphere') {
      const r = Math.max(8, (dx * 0.5) * scale * 0.88);
      shapeMarkup = `
        <circle cx="${center.x}" cy="${center.y}" r="${r.toFixed(1)}" fill="${col}" fill-opacity="${op}" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.75" />
        <ellipse cx="${center.x}" cy="${center.y}" rx="${r.toFixed(1)}" ry="${(r * 0.36).toFixed(1)}" fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="4,3" stroke-opacity="0.55" />
        <circle cx="${(center.x - r * 0.3).toFixed(1)}" cy="${(center.y - r * 0.3).toFixed(1)}" r="${(r * 0.22).toFixed(1)}" fill="#ffffff" fill-opacity="0.4" />
      `;
    } else if (shapeType === 'torus' || shapeType === 'ring') {
      const rx = Math.max(14, (dx * 0.5) * scale * 0.88);
      const ry = Math.max(6, rx * 0.35);
      shapeMarkup = `
        <ellipse cx="${center.x}" cy="${center.y}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="${col}" stroke-width="2.5" stroke-opacity="${op}" stroke-dasharray="6,4" />
      `;
    } else if (shapeType === 'hexagonal_prism') {
      const hw = dx * 0.5, hh = dy * 0.5;
      const topPts: { x: number; y: number }[] = [];
      const botPts: { x: number; y: number }[] = [];
      for (let a = 0; a < 6; a++) {
        const rad = (a * 60 * Math.PI) / 180;
        topPts.push(project([pos[0] + Math.cos(rad) * hw, pos[1] + hh, pos[2] + Math.sin(rad) * hw]));
        botPts.push(project([pos[0] + Math.cos(rad) * hw, pos[1] - hh, pos[2] + Math.sin(rad) * hw]));
      }
      const topStr = topPts.map(p => `${p.x},${p.y}`).join(' ');
      const botStr = botPts.map(p => `${p.x},${p.y}`).join(' ');
      shapeMarkup = `
        <polygon points="${botStr}" fill="${col}" fill-opacity="${op * 0.6}" stroke="#ffffff" stroke-width="1.2" />
        ${topPts.map((p, i) => {
          const next = (i + 1) % 6;
          return `<polygon points="${p.x},${p.y} ${topPts[next].x},${topPts[next].y} ${botPts[next].x},${botPts[next].y} ${botPts[i].x},${botPts[i].y}" fill="${col}" fill-opacity="${op * (0.7 + (i % 3) * 0.1)}" stroke="#ffffff" stroke-width="1.2" />`;
        }).join('')}
        <polygon points="${topStr}" fill="${col}" fill-opacity="${op * 0.95}" stroke="#ffffff" stroke-width="1.6" />
      `;
    } else if (shapeType === 'capsule') {
      const r = Math.max(8, (dx * 0.4) * scale * 0.88);
      const topC = project([pos[0], pos[1] + dy * 0.35, pos[2]]);
      const botC = project([pos[0], pos[1] - dy * 0.35, pos[2]]);
      shapeMarkup = `
        <rect x="${(topC.x - r).toFixed(1)}" y="${topC.y}" width="${(r * 2).toFixed(1)}" height="${Math.max(1, botC.y - topC.y)}" rx="${r.toFixed(1)}" fill="${col}" fill-opacity="${op}" stroke="#ffffff" stroke-width="1.4" />
        <circle cx="${topC.x}" cy="${topC.y}" r="${r.toFixed(1)}" fill="${col}" fill-opacity="${op * 0.9}" stroke="#ffffff" stroke-width="1.2" />
        <circle cx="${botC.x}" cy="${botC.y}" r="${r.toFixed(1)}" fill="${col}" fill-opacity="${op * 0.7}" stroke="#ffffff" stroke-width="1.2" />
      `;
    } else if (shapeType === 'cylinder') {
      const rx = Math.max(10, (dx * 0.5) * scale * 0.85);
      const ry = Math.max(5, rx * 0.32);
      const topC = project([pos[0], pos[1] + dy * 0.5, pos[2]]);
      const botC = project([pos[0], pos[1] - dy * 0.5, pos[2]]);
      shapeMarkup = `
        <ellipse cx="${botC.x}" cy="${botC.y}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${col}" fill-opacity="${op * 0.65}" stroke="#e2e8f0" stroke-width="1.4" />
        <path d="M ${(topC.x - rx).toFixed(1)} ${topC.y} L ${(botC.x - rx).toFixed(1)} ${botC.y} A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 0 ${(botC.x + rx).toFixed(1)} ${botC.y} L ${(topC.x + rx).toFixed(1)} ${topC.y} Z" fill="${col}" fill-opacity="${op * 0.8}" stroke="#ffffff" stroke-width="1.4" />
        <ellipse cx="${topC.x}" cy="${topC.y}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${col}" fill-opacity="${op}" stroke="#ffffff" stroke-width="1.6" />
      `;
    } else if (shapeType === 'pyramid' || shapeType === 'cone') {
      const hw = dx * 0.5, hh = dy * 0.5, hd = dz * 0.5;
      const apex = project([pos[0], pos[1] + hh, pos[2]]);
      const b1 = project([pos[0] - hw, pos[1] - hh, pos[2] - hd]);
      const b2 = project([pos[0] + hw, pos[1] - hh, pos[2] - hd]);
      const b3 = project([pos[0] + hw, pos[1] - hh, pos[2] + hd]);
      const b4 = project([pos[0] - hw, pos[1] - hh, pos[2] + hd]);
      shapeMarkup = `
        <polygon points="${b1.x},${b1.y} ${b2.x},${b2.y} ${b3.x},${b3.y} ${b4.x},${b4.y}" fill="${col}" fill-opacity="${op * 0.5}" stroke="#e2e8f0" stroke-width="1.2" />
        <polygon points="${apex.x},${apex.y} ${b1.x},${b1.y} ${b2.x},${b2.y}" fill="${col}" fill-opacity="${op * 0.7}" stroke="#ffffff" stroke-width="1.5" />
        <polygon points="${apex.x},${apex.y} ${b2.x},${b2.y} ${b3.x},${b3.y}" fill="${col}" fill-opacity="${op * 0.85}" stroke="#ffffff" stroke-width="1.5" />
        <polygon points="${apex.x},${apex.y} ${b3.x},${b3.y} ${b4.x},${b4.y}" fill="${col}" fill-opacity="${op}" stroke="#ffffff" stroke-width="1.5" />
        <polygon points="${apex.x},${apex.y} ${b4.x},${b4.y} ${b1.x},${b1.y}" fill="${col}" fill-opacity="${op * 0.65}" stroke="#ffffff" stroke-width="1.5" />
      `;
    } else if (shapeType === 'prism' || shapeType === 'triangular_prism') {
      const hw = dx * 0.5, hh = dy * 0.5, hd = dz * 0.5;
      const f1 = project([pos[0], pos[1] + hh, pos[2] + hd]);
      const f2 = project([pos[0] - hw, pos[1] - hh, pos[2] + hd]);
      const f3 = project([pos[0] + hw, pos[1] - hh, pos[2] + hd]);
      const b1 = project([pos[0], pos[1] + hh, pos[2] - hd]);
      const b2 = project([pos[0] - hw, pos[1] - hh, pos[2] - hd]);
      const b3 = project([pos[0] + hw, pos[1] - hh, pos[2] - hd]);
      shapeMarkup = `
        <polygon points="${b1.x},${b1.y} ${b2.x},${b2.y} ${b3.x},${b3.y}" fill="${col}" fill-opacity="${op * 0.45}" stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="4,3" />
        <polygon points="${f1.x},${f1.y} ${f3.x},${f3.y} ${b3.x},${b3.y} ${b1.x},${b1.y}" fill="${col}" fill-opacity="${op * 0.75}" stroke="#ffffff" stroke-width="1.5" />
        <polygon points="${f1.x},${f1.y} ${f2.x},${f2.y} ${b2.x},${b2.y} ${b1.x},${b1.y}" fill="${col}" fill-opacity="${op * 0.6}" stroke="#ffffff" stroke-width="1.5" />
        <polygon points="${f1.x},${f1.y} ${f2.x},${f2.y} ${f3.x},${f3.y}" fill="${col}" fill-opacity="${op * 0.9}" stroke="#ffffff" stroke-width="1.8" />
      `;
    } else {
      // 3D Box / Cuboid / Polyhedron
      const hw = dx * 0.5, hh = dy * 0.5, hd = dz * 0.5;
      const v = [
        project([pos[0] - hw, pos[1] - hh, pos[2] - hd]),
        project([pos[0] + hw, pos[1] - hh, pos[2] - hd]),
        project([pos[0] + hw, pos[1] + hh, pos[2] - hd]),
        project([pos[0] - hw, pos[1] + hh, pos[2] - hd]),
        project([pos[0] - hw, pos[1] - hh, pos[2] + hd]),
        project([pos[0] + hw, pos[1] - hh, pos[2] + hd]),
        project([pos[0] + hw, pos[1] + hh, pos[2] + hd]),
        project([pos[0] - hw, pos[1] + hh, pos[2] + hd]),
      ];
      const faces = [
        { idx: [0, 1, 2, 3], mult: 0.55 }, // back
        { idx: [0, 4, 7, 3], mult: 0.68 }, // left
        { idx: [1, 5, 6, 2], mult: 0.78 }, // right
        { idx: [0, 1, 5, 4], mult: 0.60 }, // bottom
        { idx: [3, 2, 6, 7], mult: 0.95 }, // top
        { idx: [4, 5, 6, 7], mult: 0.88 }, // front
      ].map(f => ({
        ...f,
        z: f.idx.reduce((acc, i) => acc + (v[i]?.z || 0), 0) / 4
      })).sort((a, b) => a.z - b.z);

      shapeMarkup = faces.map(f => {
        const pts = f.idx.map(i => `${v[i]?.x || 0},${v[i]?.y || 0}`).join(' ');
        return `<polygon points="${pts}" fill="${col}" fill-opacity="${(op * f.mult).toFixed(2)}" stroke="#ffffff" stroke-width="1.3" stroke-opacity="0.75" />`;
      }).join('\n');
    }

    const labelMarkup = showLabels && part.label
      ? `<g>
          <rect x="${(center.x - (part.label.length * 3.4 + 10)).toFixed(1)}" y="${(center.y - 11).toFixed(1)}" width="${(part.label.length * 6.8 + 20).toFixed(1)}" height="20" rx="6" fill="#0f172a" fill-opacity="0.86" stroke="${col}" stroke-width="1.2" />
          <text x="${center.x}" y="${(center.y + 3).toFixed(1)}" fill="#f8fafc" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">${escapeXml(part.label)}</text>
        </g>`
      : '';

    elements.push({
      z: center.z,
      svg: `<g>${shapeMarkup}${labelMarkup}</g>`
    });
  }

  elements.sort((a, b) => a.z - b.z);

  const notesList = Array.isArray(scene.educationalNotes) ? scene.educationalNotes : Array.isArray(scene.formulas) ? scene.formulas : [];
  const notesFooter = notesList.slice(0, 2).map((n, i) =>
    `<text x="24" y="${438 + i * 18}" fill="#94a3b8" font-family="sans-serif" font-size="11">• ${escapeXml(n)}</text>`
  ).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" rx="18" fill="#090d16" stroke="#334155" stroke-width="2" />
    <rect x="16" y="14" width="${W - 32}" height="42" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
    <text x="30" y="34" fill="#f8fafc" font-family="sans-serif" font-size="15" font-weight="bold">🧊 ${escapeXml(scene.title || '3D Educational Model')}</text>
    <text x="30" y="49" fill="#38bdf8" font-family="monospace" font-size="10">${escapeXml(scene.description || scene.subtitle || '')}</text>
    <text x="${W - 28}" y="38" fill="#818cf8" font-family="monospace" font-size="10" text-anchor="end">Pitch ${Math.round(rotXDeg)}° · Yaw ${Math.round(rotYDeg)}°</text>
    ${elements.map(e => e.svg).join('\n')}
    ${notesFooter}
  </svg>`;
}


export const Whiteboard2 = ({ onClose, currentUser }: any) => {
  // 1. All Component State & Refs Declared First
  const [slides, setSlides] = useState<Slide[]>(() => {
    try {
      const saved = localStorage.getItem('studentos_smartboard_slides_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}
    return [{ id: 'slide_1', shapes: [], lines: [], stickies: [] }];
  });
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [undoStack, setUndoStack] = useState<Slide[][]>([]);
  const [redoStack, setRedoStack] = useState<Slide[][]>([]);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Selection state: supports single and multi-object selection + rectangular marquee
  const [selectedIds, setSelectedIds] = useState<{ id: string; type: 'shape' | 'line' }[]>([]);
  const selectedObj = selectedIds.length > 0 ? selectedIds[0] : null;
  const setSelectedObj = (item: { id: string; type: 'shape' | 'line' } | null) => {
    setSelectedIds(item ? [item] : []);
  };
  const [selectionMode, setSelectionMode] = useState<'intersect' | 'contain'>('intersect');
  const [marqueeRect, setMarqueeRect] = useState<{
    visible: boolean;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>({ visible: false, x1: 0, y1: 0, x2: 0, y2: 0 });
  const isMarqueeSelecting = useRef(false);

  // Interactive Three.js 3D WebGL Scene Studio Modal
  const [interactive3DScene, setInteractive3DScene] = useState<Educational3DScene | null>(null);
  const [active3DShapeId, setActive3DShapeId] = useState<string | null>(null);

  // Contextual AI Visual / Educational Insight Panel state
  const [aiInsightCard, setAiInsightCard] = useState<{
    title: string;
    mode: string;
    content: string;
  } | null>(null);
  const [isRunningSelectionAI, setIsRunningSelectionAI] = useState(false);
  
  const [tool, setTool] = useState<'pen' | 'pencil' | 'marker' | 'highlighter' | 'eraser' | 'object_eraser' | 'select' | 'pan' | 'shape'>('pen');
  const [shapeType, setShapeType] = useState<'rect' | 'square' | 'circle' | 'ellipse' | 'triangle' | 'line' | 'arrow' | 'pentagon' | 'polygon' | 'star' | 'ruler-15' | 'ruler-30' | 'protractor' | 'compass' | 'setsquare-45' | 'setsquare-30-60' | 'geometry' | 'text' | 'ruler' | 'setsquare'>('rect');
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(4);
  
  const [backgroundColor, setBackgroundColor] = useState<string>('#0f172a');
  const [backgroundPattern, setBackgroundPattern] = useState<'plain' | 'grid' | 'dot' | 'graph' | 'ruled'>('plain');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [gridOpacity, setGridOpacity] = useState<number>(0.05);
  const [aiShapeAssistant, setAiShapeAssistant] = useState<boolean>(false);
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);
  const [eraserMenuOpen, setEraserMenuOpen] = useState(false);
  
  const [eraserHoverPos, setEraserHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiPromptQuery, setAiPromptQuery] = useState('');
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [aiToolType, setAiToolType] = useState<'auto' | 'svg' | '3d' | 'mermaid' | 'diagram' | 'mindmap' | 'assistant'>('auto');

  // Verified 3D Library & Request Hub State
  const [threeDHubOpen, setThreeDHubOpen] = useState(false);
  const [threeDHubUnavailableAlert, setThreeDHubUnavailableAlert] = useState(false);
  const [threeDQueryTopic, setThreeDQueryTopic] = useState('');

  // 3D Model Request & Urgent Notification Modal State
  const [modelRequestOpen, setModelRequestOpen] = useState(false);
  const [modelRequestTopic, setModelRequestTopic] = useState('');
  const [modelRequestType, setModelRequestType] = useState<'normal' | 'urgent'>('normal');
  const [modelRequestPurpose, setModelRequestPurpose] = useState('');
  const [modelRequestDeadline, setModelRequestDeadline] = useState('');
  const [modelRequestSubmitting, setModelRequestSubmitting] = useState(false);
  const [modelRequestFeedback, setModelRequestFeedback] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight - 120 });
  
  const [textModal, setTextModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    x?: number;
    y?: number;
    shapeId?: string;
    value: string;
  }>({ open: false, mode: 'create', value: '' });

  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);

  const handle3DModelRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelRequestTopic.trim()) return;
    setModelRequestSubmitting(true);
    setModelRequestFeedback(null);
    try {
      const resp = await fetch('/api/3d-model-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: modelRequestType,
          subject: modelRequestTopic,
          requesterName: currentUser?.name || 'StudentOS User',
          userRole: currentUser?.role || 'student',
          schoolId: currentUser?.school_id || 'default_school',
          urgencyDeadline: modelRequestDeadline,
          educationalPurpose: modelRequestPurpose
        })
      });
      const data = await resp.json();
      if (data?.success) {
        setModelRequestFeedback(data.message || 'Request submitted successfully.');
        setTimeout(() => {
          setModelRequestOpen(false);
          setModelRequestFeedback(null);
        }, 2200);
      } else {
        setModelRequestFeedback('⚠️ Request submission failed. Please try again.');
      }
    } catch {
      setModelRequestFeedback('⚠️ Request submission failed. Please try again.');
    } finally {
      setModelRequestSubmitting(false);
    }
  };

  // Rehydrate SVG & 3D shapes from svgRaw/scene3D when loading slides
  useEffect(() => {
    const activeSlide = slides[activeSlideIdx];
    if (!activeSlide) return;
    activeSlide.shapes.forEach((sh) => {
      if ((sh.type === 'svg_node' || sh.type === 'model_3d') && !sh.imageObj) {
        let raw = sh.svgRaw || '';
        if (sh.type === 'model_3d' && sh.scene3D) {
          raw = renderScene3DToSvg(
            sh.scene3D,
            sh.rotX ?? 22,
            sh.rotY ?? -32,
            sh.zoom3D ?? 1,
            sh.explode3D ?? 0,
            sh.showLabels3D ?? true
          );
        }
        const safeSvg = sanitizeSvgClient(raw);
        if (safeSvg) {
          const img = new Image();
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(safeSvg);
          img.onload = () => {
            setSlides(prev => {
              const next = [...prev];
              const sl = next[activeSlideIdx];
              if (!sl) return prev;
              const target = sl.shapes.find(item => item.id === sh.id);
              if (target) target.imageObj = img;
              return next;
            });
          };
        }
      }
    });
  }, [activeSlideIdx, slides.length]);

  // 2. Helper Functions
  const cloneSlides = (src: Slide[]): Slide[] =>
    src.map(sl => ({
      ...sl,
      shapes: sl.shapes.map(sh => ({ ...sh, points: sh.points ? [...sh.points] : undefined })),
      lines: sl.lines.map(ln => ({ ...ln, points: [...ln.points] })),
      stickies: [...(sl.stickies || [])]
    }));

  const pushHistory = () => {
    setUndoStack(prev => [...prev.slice(-29), cloneSlides(slides)]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, cloneSlides(slides)]);
    setUndoStack(prev => prev.slice(0, -1));
    setSlides(previous);
    setSelectedIds([]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, cloneSlides(slides)]);
    setRedoStack(prev => prev.slice(0, -1));
    setSlides(next);
    setSelectedIds([]);
  };

  useEffect(() => {
    setSaveState('saving');
    const timer = setTimeout(() => {
      try {
        const serializable = slides.map(s => ({
          ...s,
          shapes: s.shapes.map(({ imageObj, ...rest }) => rest)
        }));
        localStorage.setItem('studentos_smartboard_slides_v3', JSON.stringify(serializable));
      } catch (_) {}
      setSaveState('saved');
    }, 350);
    return () => clearTimeout(timer);
  }, [slides]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedIds.length > 0) {
        e.preventDefault();
        handleDuplicateSelectedObject();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g' && selectedIds.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          handleUngroupSelectedObjects();
        } else {
          handleGroupSelectedObjects();
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        handleDeleteSelectedObject();
      } else if (e.key === 'Escape') {
        setSelectedIds([]);
        setMarqueeRect(prev => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [slides, undoStack, redoStack, selectedIds, activeSlideIdx]);

  useEffect(() => {
    if (aiTip) {
      const timer = setTimeout(() => setAiTip(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [aiTip]);

  // Helper to insert a 3D Educational Object onto the Whiteboard
  const insert3DModelOnBoard = useCallback((scene: Scene3DData, xPos: number = 140, yPos: number = 95) => {
    const rotX = 22;
    const rotY = -32;
    const zoom3D = 1;
    const explode3D = 0;
    const showLabels3D = true;
    const svgStr = sanitizeSvgClient(renderScene3DToSvg(scene, rotX, rotY, zoom3D, explode3D, showLabels3D));
    if (!svgStr) return;

    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    img.onload = () => {
      const new3DShape: ShapeObj = {
        id: `model3d_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'model_3d',
        x: xPos,
        y: yPos,
        width: 580,
        height: 410,
        stroke: '#38bdf8',
        strokeWidth: 0,
        text: scene.title,
        imageObj: img,
        svgRaw: svgStr,
        scene3D: scene,
        rotX,
        rotY,
        zoom3D,
        explode3D,
        showLabels3D
      };
      pushHistory();
      setSlides(prev => {
        const updated = cloneSlides(prev);
        updated[activeSlideIdx].shapes.push(new3DShape);
        return updated;
      });
      setTool('select');
      setSelectedIds([{ id: new3DShape.id, type: 'shape' }]);
    };
  }, [activeSlideIdx, slides]);

  // Helper to update 3D parameters (pitch, yaw, zoom, explode, labels) on a selected 3D object
  const updateSelected3DModel = (patch: Partial<Pick<ShapeObj, 'rotX' | 'rotY' | 'zoom3D' | 'explode3D' | 'showLabels3D'>>) => {
    if (!selectedObj || selectedObj.type !== 'shape') return;
    const currentSlide = slides[activeSlideIdx];
    const targetShape = currentSlide?.shapes.find(s => s.id === selectedObj.id);
    if (!targetShape || targetShape.type !== 'model_3d' || !targetShape.scene3D) return;

    const nextRotX = patch.rotX ?? targetShape.rotX ?? 22;
    const nextRotY = patch.rotY ?? targetShape.rotY ?? -32;
    const nextZoom = patch.zoom3D ?? targetShape.zoom3D ?? 1;
    const nextExplode = patch.explode3D ?? targetShape.explode3D ?? 0;
    const nextLabels = patch.showLabels3D ?? targetShape.showLabels3D ?? true;

    const svgStr = sanitizeSvgClient(
      renderScene3DToSvg(targetShape.scene3D, nextRotX, nextRotY, nextZoom, nextExplode, nextLabels)
    );
    if (!svgStr) return;

    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    img.onload = () => {
      setSlides(prev => {
        const updated = [...prev];
        const sh = updated[activeSlideIdx]?.shapes.find(s => s.id === targetShape.id);
        if (sh) {
          sh.rotX = nextRotX;
          sh.rotY = nextRotY;
          sh.zoom3D = nextZoom;
          sh.explode3D = nextExplode;
          sh.showLabels3D = nextLabels;
          sh.svgRaw = svgStr;
          sh.imageObj = img;
        }
        return updated;
      });
    };
  };

  // Extract descriptive context from currently selected Whiteboard objects
  const getSelectedObjectsDescription = (): string => {
    const slide = slides[activeSlideIdx];
    if (!slide || selectedIds.length === 0) return '';
    const parts: string[] = [];
    selectedIds.forEach(sel => {
      if (sel.type === 'shape') {
        const sh = slide.shapes.find(s => s.id === sel.id);
        if (sh) {
          if (sh.type === 'model_3d' && sh.scene3D) {
            parts.push(`3D Model "${sh.scene3D.title}" (${sh.scene3D.description}) with parts: ${sh.scene3D.parts.map(p => p.label).join(', ')}`);
          } else if (sh.text) {
            parts.push(`${sh.type} labeled "${sh.text}"`);
          } else {
            parts.push(`${sh.type} shape`);
          }
        }
      } else {
        parts.push('freehand sketched stroke');
      }
    });
    return parts.join('; ');
  };

  // Selected Object → 3D Infographic / Visual / Explain / Quiz / Label workflow
  const handleSelectedObjectAIAction = async (action: 'to_3d' | 'to_svg' | 'explain' | 'label_parts' | 'quiz') => {
    const slide = slides[activeSlideIdx];
    if (!slide || !Array.isArray(selectedIds) || selectedIds.length === 0) {
      setAiTip('⚠️ Please select at least one object on the Whiteboard first.');
      return;
    }

    const contextDesc = getSelectedObjectsDescription();
    if (!contextDesc || !contextDesc.trim()) {
      setAiTip('⚠️ Please select at least one valid object on the Whiteboard.');
      return;
    }

    setIsRunningSelectionAI(true);
    try {
      const selectedShapes = (slide.shapes || []).filter(s => s && selectedIds.some(sel => sel.id === s.id));
      const selectedLines = (slide.lines || []).filter(l => l && selectedIds.some(sel => sel.id === l.id));

      const firstShapeWithText = selectedShapes.find(s => s.text && s.text.trim());
      const first3DShape = selectedShapes.find(s => s.type === 'model_3d' && s.scene3D);
      const cleanTopic = firstShapeWithText?.text?.trim() || first3DShape?.scene3D?.title?.trim() || contextDesc || 'Educational Topic';

      const primaryObj = selectedShapes[0] || (selectedLines[0] ? { x: selectedLines[0].points?.[0] || 160, y: selectedLines[0].points?.[1] || 110 } : null);
      const anchorX = primaryObj ? Math.min(Math.max(60, canvasSize.width - 620), Math.max(60, (primaryObj.x || 160) + 60)) : 160;
      const anchorY = primaryObj ? Math.min(Math.max(60, canvasSize.height - 440), Math.max(60, (primaryObj.y || 110) + 40)) : 110;

      if (action === 'to_3d') {
        setAiTip(`🧊 Converting "${cleanTopic}" into an interactive 3D educational model...`);
        const res = await fetch('/api/ai/whiteboard-3d', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: cleanTopic, sourceContext: contextDesc })
        });
        if (!res.ok) throw new Error('3D generation service unavailable');
        const data = await res.json();
        if (data?.scene && Array.isArray(data.scene.parts) && data.scene.parts.length > 0) {
          insert3DModelOnBoard(data.scene, anchorX, anchorY);
          setAiTip(`🧊 3D Educational Model created for "${data.scene.title}"! Click "Orbit 3D Studio" to explore.`);
        } else {
          setAiTip('⚠️ Could not generate a 3D model for this selection.');
        }
      } else if (action === 'to_svg') {
        setAiTip(`🎨 Generating classroom SVG visual for "${cleanTopic}"...`);
        const res = await fetch('/api/ai/svg-diagram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: cleanTopic })
        });
        if (!res.ok) throw new Error('SVG generation service unavailable');
        const data = await res.json();
        const safeSvg = sanitizeSvgClient(data?.svg || '');
        if (safeSvg) {
          const img = new Image();
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(safeSvg);
          img.onload = () => {
            const svgShape: ShapeObj = {
              id: `svg_${Date.now()}`,
              type: 'svg_node',
              x: anchorX,
              y: anchorY,
              width: 540,
              height: 390,
              stroke: '#10b981',
              strokeWidth: 0,
              text: data?.title || cleanTopic,
              imageObj: img,
              svgRaw: safeSvg
            };
            pushHistory();
            setSlides(prev => {
              const updated = cloneSlides(prev);
              updated[activeSlideIdx].shapes.push(svgShape);
              return updated;
            });
            setSelectedIds([{ id: svgShape.id, type: 'shape' }]);
          };
          setAiTip(`🎨 Clean educational SVG visual added for "${cleanTopic}"`);
        } else {
          setAiTip('⚠️ Could not generate a clean SVG diagram.');
        }
      } else {
        const promptMap: Record<string, string> = {
          explain: `Explain this selected classroom whiteboard concept clearly for students in 4 concise bullet points with key formulas or mechanisms: ${contextDesc}`,
          label_parts: `Identify and list the 5 most important anatomical/structural labels and their functions for: ${contextDesc}`,
          quiz: `Create 3 quick classroom check-for-understanding questions (with short answers) based on this whiteboard visual: ${contextDesc}`
        };
        setAiTip(`✨ Analyzing selected object with NVIDIA AI...`);
        const res = await fetch('/api/ai/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: contextDesc,
            action: 'custom',
            instruction: 'You are an expert classroom teacher assistant on StudentOS SmartBoard. Be concise, accurate, and classroom-ready. Format with clean bullet points.'
          })
        });
        const data = await res.json();
        if (data?.text) {
          setAiInsightCard({
            title: action === 'explain' ? `Explanation: ${cleanTopic}` : action === 'label_parts' ? `Key Labels: ${cleanTopic}` : `Quick Quiz: ${cleanTopic}`,
            mode: action,
            content: data.text
          });
        } else {
          setAiInsightCard({
            title: `Classroom Insight: ${cleanTopic}`,
            mode: action,
            content: promptMap[action] || `Analysis for ${cleanTopic}`
          });
        }
      }
    } catch (err: any) {
      console.error('Selection AI action error:', err);
      setAiTip('❌ Could not complete AI visual action right now.');
    } finally {
      setIsRunningSelectionAI(false);
    }
  };

  const handleGenerateDiagram = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiPromptQuery.trim()) return;
    setIsGeneratingDiagram(true);
    setAiPromptOpen(false);

    const queryLower = aiPromptQuery.toLowerCase();
    let effectiveTool: 'mermaid' | 'svg' | '3d' | 'diagram' = 'svg';

    if (aiToolType === 'auto') {
      const is3DSubject = /\b(3d|cube|cuboid|prism|pyramid|sphere|cylinder|cone|solid|polyhedron|molecular\s*geometry|3d\s*model)\b/.test(queryLower);
      const isFlowSubject = /\b(flowchart|timeline|sequence|algorithm|decision\s*tree|workflow|hierarchy)\b/.test(queryLower);
      if (is3DSubject) effectiveTool = '3d';
      else if (isFlowSubject) effectiveTool = 'mermaid';
      else effectiveTool = 'svg';
    } else if (aiToolType === '3d') {
      effectiveTool = '3d';
    } else if (aiToolType === 'svg') {
      effectiveTool = 'svg';
    } else if (aiToolType === 'mermaid' || aiToolType === 'mindmap') {
      effectiveTool = 'mermaid';
    } else {
      effectiveTool = 'diagram';
    }

    try {
      if (effectiveTool === '3d') {
        const response = await fetch('/api/ai/whiteboard-3d', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: aiPromptQuery })
        });
        const data = await response.json();
        if (data?.scene && data.scene.parts && data.scene.parts.length > 0) {
          insert3DModelOnBoard(data.scene, 120, 90);
          setAiTip(`🧊 Interactive 3D model generated for "${data.scene.title}"`);
        } else {
          setThreeDQueryTopic(aiPromptQuery);
          setThreeDHubUnavailableAlert(true);
          setThreeDHubOpen(true);
        }
      } else if (effectiveTool === 'mermaid') {
        const response = await fetch('/api/ai/mermaid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: aiPromptQuery })
        });
        let data: any = {};
        try {
          data = await response.json();
        } catch (_) {
          const text = await response.text().catch(() => '');
          data = { code: text || `graph TD\n  Start[${aiPromptQuery}] --> Concept1[Primary Mechanism]` };
        }
        const mermaidCode = data.mermaid || data.code;
        if (mermaidCode) {
          try {
            const mermaidModule = await import('mermaid');
            const mermaid: any = mermaidModule.default || mermaidModule;
            mermaid.initialize({ startOnLoad: false, theme: 'dark' });
            const id = `mermaid_render_${Date.now()}`;
            const { svg } = await mermaid.render(id, mermaidCode);
            const safeSvg = sanitizeSvgClient(svg);
            
            const img = new Image();
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(safeSvg || svg);
            img.onload = () => {
              const svgShape: ShapeObj = {
                id: `mermaid-${Date.now()}`,
                type: 'svg_node',
                x: 100,
                y: 100,
                width: 520,
                height: 380,
                stroke: '#818cf8',
                strokeWidth: 0,
                text: aiPromptQuery,
                imageObj: img,
                svgRaw: safeSvg || svg
              };
              pushHistory();
              setSlides(prev => {
                const updated = [...prev];
                updated[activeSlideIdx].shapes = [...(updated[activeSlideIdx].shapes || []), svgShape];
                return updated;
              });
              setTool('select');
              setSelectedIds([{ id: svgShape.id, type: 'shape' }]);
            };
            setAiTip(`🧜‍♂️ Educational Mermaid diagram inserted for "${aiPromptQuery}"`);
          } catch(mErr) {
            console.error("Mermaid generation or render error:", mErr);
            setAiTip(`❌ Mermaid could not render diagram. Check console.`);
          }
        }
      } else if (effectiveTool === 'svg') {
        try {
          const response = await fetch('/api/ai/svg-diagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: aiPromptQuery })
          });
          if (!response.ok) throw new Error('SVG API unavailable');
          const data = await response.json();
          const svgContent = sanitizeSvgClient(data.svg || '');
          if (svgContent) {
            const img = new Image();
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
            img.onload = () => {
              const svgShape: ShapeObj = {
                id: `svg-${Date.now()}`,
                type: 'svg_node',
                x: 100,
                y: 95,
                width: 560,
                height: 400,
                stroke: '#10b981',
                strokeWidth: 0,
                text: data.title || aiPromptQuery,
                imageObj: img,
                svgRaw: svgContent
              };
              pushHistory();
              setSlides(prev => {
                const updated = [...prev];
                updated[activeSlideIdx].shapes = [...(updated[activeSlideIdx].shapes || []), svgShape];
                return updated;
              });
              setTool('select');
              setSelectedIds([{ id: svgShape.id, type: 'shape' }]);
            };
            setAiTip(`🎨 Sanitized classroom SVG diagram inserted for "${aiPromptQuery}"`);
          } else {
            throw new Error('No valid sanitized SVG returned');
          }
        } catch (err) {
          console.error('SVG Generation Error:', err);
          setAiTip(`❌ AI engine could not generate SVG diagram.`);
        }
      } else {
        try {
          const response = await fetch('/api/ai/diagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: aiPromptQuery, type: aiToolType })
          });
          if (!response.ok) throw new Error('Diagram API unavailable');
          const data = await response.json();
          
          const newShapes: ShapeObj[] = [];
          if (data.elements) {
            data.elements.forEach((el: any, index: number) => {
              if (el.type === 'rect') {
                newShapes.push({ id: `rect-${Date.now()}-${index}`, type: 'rect', x: el.x || 100, y: el.y || 100, width: el.width || 100, height: el.height || 100, fill: el.fill || 'transparent', stroke: el.fill || '#fff', strokeWidth: 2, text: el.text });
              } else if (el.type === 'circle') {
                newShapes.push({ id: `circle-${Date.now()}-${index}`, type: 'circle', x: el.x || 100, y: el.y || 100, radius: el.radius || 50, stroke: el.fill || '#fff', strokeWidth: 2, text: el.text });
              } else if (el.type === 'text') {
                newShapes.push({ id: `text-${Date.now()}-${index}`, type: 'text', x: el.x || 100, y: el.y || 100, text: el.text, stroke: el.fill || '#ffffff', strokeWidth: 1, fontSize: el.fontSize || 16 });
              } else if (el.type === 'arrow') {
                newShapes.push({ id: `arrow-${Date.now()}-${index}`, type: 'arrow', x: 0, y: 0, points: el.points || [100,100,200,200], stroke: el.stroke || '#fff', strokeWidth: 2 });
              }
            });
          }
          
          if (newShapes.length === 0) {
            throw new Error('No valid diagram elements returned');
          }
          
          pushHistory();
          setSlides(prev => {
            const updated = [...prev];
            updated[activeSlideIdx].shapes = [...(updated[activeSlideIdx].shapes || []), ...newShapes];
            return updated;
          });
          setAiTip(`🪄 AI Assistant generated a diagram for "${aiPromptQuery}"`);
        } catch (err) {
          console.error('Canvas Diagram Error:', err);
          setAiTip(`❌ AI engine could not generate diagram.`);
        }
      }
    } catch (e) {
      console.error("Diagram generation error:", e);
      setAiTip("❌ Diagram generation failed. Please try again.");
    } finally {
      setIsGeneratingDiagram(false);
      setAiPromptQuery('');
    }
  };

  // Sync Konva Transformer with all currently selected nodes (supports multi-select!)
  useEffect(() => {
    if (trRef.current && stageRef.current) {
      if (selectedIds.length > 0 && tool === 'select') {
        const nodes = selectedIds
          .map(sel => stageRef.current.findOne('#' + sel.id))
          .filter(Boolean);
        trRef.current.nodes(nodes);
        trRef.current.getLayer()?.batchDraw();
      } else {
        trRef.current.nodes([]);
        trRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedIds, activeSlideIdx, tool, slides]);

  // Adapt brush color depending on the background paper shade
  useEffect(() => {
    if (backgroundColor === '#ffffff' && (brushColor === '#ffffff' || brushColor === '#fff')) {
      setBrushColor('#0f172a');
    } else if (backgroundColor !== '#ffffff' && brushColor === '#0f172a') {
      setBrushColor('#ffffff');
    }
  }, [backgroundColor]);

  // Tablet & Device Responsive Canvas Handling using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ 
          width: width || window.innerWidth, 
          height: height || (window.innerHeight - 120) 
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Generous tolerances for comfortable erasing
  const isCloseToLine = (linePoints: number[], px: number, py: number) => {
    for (let i = 0; i < linePoints.length; i += 2) {
      const lx = linePoints[i];
      const ly = linePoints[i+1];
      const dist = Math.sqrt(Math.pow(lx - px, 2) + Math.pow(ly - py, 2));
      if (dist < 45) return true; // Generous circular hit stroke
    }
    return false;
  };

  const isCloseToShape = (shape: ShapeObj, px: number, py: number) => {
    if (shape.type === 'rect' || shape.type === 'square') {
      const minX = Math.min(shape.x, shape.x + (shape.width || 0));
      const maxX = Math.max(shape.x, shape.x + (shape.width || 0));
      const minY = Math.min(shape.y, shape.y + (shape.height || 0));
      const maxY = Math.max(shape.y, shape.y + (shape.height || 0));
      return px >= minX - 30 && px <= maxX + 30 && py >= minY - 30 && py <= maxY + 30; // Expanded bounding box hit zone
    }
    if (shape.type === 'circle' || shape.type === 'ellipse' || shape.type === 'triangle' || shape.type === 'polygon' || shape.type === 'pentagon' || shape.type === 'star' || shape.type === 'geometry') {
      const dist = Math.sqrt(Math.pow(shape.x - px, 2) + Math.pow(shape.y - py, 2));
      return dist <= (shape.radius || 20) + 35; // Generous circular radius hit zone
    }
    if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'ruler-15' || shape.type === 'ruler-30' || shape.type === 'protractor' || shape.type === 'compass' || shape.type === 'setsquare-45' || shape.type === 'setsquare-30-60') {
      if (shape.points) {
        for (let i = 0; i < shape.points.length; i += 2) {
          const lx = shape.x + shape.points[i];
          const ly = shape.y + shape.points[i+1];
          const dist = Math.sqrt(Math.pow(lx - px, 2) + Math.pow(ly - py, 2));
          if (dist < 50) return true;
        }
      } else {
        // Fallback for tools without standard path points: check distance to shape origin
        const dist = Math.sqrt(Math.pow(shape.x - px, 2) + Math.pow(shape.y - py, 2));
        return dist < 60;
      }
    }
    return false;
  };

  const eraseAt = (px: number, py: number) => {
    setSlides(prev => {
      const updated = [...prev];
      const current = updated[activeSlideIdx];
      current.lines = current.lines.filter(line => !isCloseToLine(line.points, px, py));
      current.shapes = current.shapes.filter(shape => !isCloseToShape(shape, px, py));
      return updated;
    });
  };

  // Convert client pointer coordinate relative to current zoom stage position & scale factor
  const getRelativePointerPosition = (stage: any) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const x = (pointer.x - stage.x()) / stage.scaleX();
    const y = (pointer.y - stage.y()) / stage.scaleY();
    if (snapToGrid) {
      return {
        x: Math.round(x / 20) * 20,
        y: Math.round(y / 20) * 20,
      };
    }
    return { x, y };
  };

  // Helper: Compute bounding box of a shape or line in canvas coordinates
  const getElementBoundingBox = (item: ShapeObj | LineObj, itemType: 'shape' | 'line') => {
    if (itemType === 'line') {
      const ln = item as LineObj;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < ln.points.length; i += 2) {
        const px = ln.points[i];
        const py = ln.points[i + 1];
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
      return { x: minX, y: minY, width: Math.max(4, maxX - minX), height: Math.max(4, maxY - minY) };
    }
    const sh = item as ShapeObj;
    const sx = sh.scaleX || 1;
    const sy = sh.scaleY || 1;
    if (sh.type === 'circle' || sh.type === 'triangle' || sh.type === 'pentagon' || sh.type === 'polygon' || sh.type === 'star' || sh.type === 'geometry') {
      const r = (sh.radius || 30) * Math.max(Math.abs(sx), Math.abs(sy));
      return { x: sh.x - r, y: sh.y - r, width: r * 2, height: r * 2 };
    }
    if (sh.type === 'line' || sh.type === 'arrow') {
      const pts = sh.points || [0, 0, 0, 0];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        const px = sh.x + pts[i] * sx;
        const py = sh.y + pts[i + 1] * sy;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      return { x: minX, y: minY, width: Math.max(6, maxX - minX), height: Math.max(6, maxY - minY) };
    }
    if (sh.type === 'text') {
      const approxW = Math.max(60, (sh.text?.length || 5) * ((sh.fontSize || 24) * 0.6)) * Math.abs(sx);
      const approxH = (sh.fontSize || 24) * 1.3 * Math.abs(sy);
      return { x: sh.x, y: sh.y, width: approxW, height: approxH };
    }
    const rawW = (sh.width ?? (sh.type === 'model_3d' ? 580 : sh.type === 'svg_node' ? 500 : 120)) * sx;
    const rawH = (sh.height ?? (sh.type === 'model_3d' ? 410 : sh.type === 'svg_node' ? 360 : 90)) * sy;
    const bx = rawW < 0 ? sh.x + rawW : sh.x;
    const by = rawH < 0 ? sh.y + rawH : sh.y;
    return { x: bx, y: by, width: Math.abs(rawW), height: Math.abs(rawH) };
  };

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const pos = getRelativePointerPosition(stage);
    if (!pos) return;

    if (tool === 'pan') {
      return;
    }

    if (tool === 'object_eraser') {
      pushHistory();
      isDrawing.current = true;
      eraseAt(pos.x, pos.y);
      return;
    }
    
    if (tool === 'select') {
      // Rectangular Marquee Selection when clicking and holding on empty canvas
      if (e.target === stage) {
        isMarqueeSelecting.current = true;
        setMarqueeRect({
          visible: true,
          x1: pos.x,
          y1: pos.y,
          x2: pos.x,
          y2: pos.y
        });
        if (!e.evt?.shiftKey && !e.evt?.ctrlKey && !e.evt?.metaKey) {
          setSelectedIds([]);
        }
      }
      return;
    }
    
    if (tool === 'shape' && shapeType === 'text') {
      isDrawing.current = false;
      setTextModal({
        open: true,
        mode: 'create',
        x: pos.x,
        y: pos.y,
        value: ''
      });
      return;
    }

    pushHistory();
    isDrawing.current = true;
    
    if (tool === 'pen' || tool === 'pencil' || tool === 'marker' || tool === 'highlighter' || tool === 'eraser') {
      let colorStr = brushColor;
      let sizeVal = brushSize;
      
      if (tool === 'pencil') {
        colorStr = brushColor + 'a0'; 
        sizeVal = Math.max(1, Math.round(brushSize * 0.5));
      } else if (tool === 'marker') {
        colorStr = brushColor;
        sizeVal = brushSize * 2.2;
      } else if (tool === 'highlighter') {
        colorStr = brushColor + '40'; 
        sizeVal = brushSize * 4.0;
      } else if (tool === 'eraser') {
        colorStr = '#000000';
        sizeVal = brushSize * 3.0;
      }
      
      const newLine: LineObj = {
        id: Date.now().toString(),
        tool,
        color: colorStr,
        brushSize: sizeVal,
        points: [pos.x, pos.y, pos.x, pos.y],
      };
      
      setSlides(prev => {
        const updated = [...prev];
        updated[activeSlideIdx].lines.push(newLine);
        return updated;
      });
    } else if (tool === 'shape') {
      const newShape: ShapeObj = {
        id: Date.now().toString(),
        type: shapeType,
        x: pos.x,
        y: pos.y,
        stroke: brushColor,
        strokeWidth: brushSize,
        fill: 'transparent',
        width: 0,
        height: 0,
        radius: 0,
        points: [0, 0, 0, 0]
      };
      
      setSlides(prev => {
        const updated = [...prev];
        updated[activeSlideIdx].shapes.push(newShape);
        return updated;
      });
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const point = getRelativePointerPosition(stage);
    
    // Eraser hover state tracking for circular outline
    if (point && (tool === 'eraser' || tool === 'object_eraser')) {
      setEraserHoverPos(point);
    } else {
      setEraserHoverPos(null);
    }

    // Update rectangular marquee selection box while dragging on empty canvas
    if (tool === 'select' && isMarqueeSelecting.current && point) {
      setMarqueeRect(prev => ({
        ...prev,
        visible: true,
        x2: point.x,
        y2: point.y
      }));
      return;
    }

    if (!isDrawing.current) return;
    if (!point) return;
    
    if (tool === 'object_eraser') {
      eraseAt(point.x, point.y);
      return;
    }

    if (tool === 'select' || tool === 'pan') return;

    setSlides(prev => {
      const updated = [...prev];
      const currentSlide = updated[activeSlideIdx];

      if (tool === 'pen' || tool === 'pencil' || tool === 'marker' || tool === 'highlighter' || tool === 'eraser') {
        const lastLine = currentSlide.lines[currentSlide.lines.length - 1];
        if (lastLine) {
          lastLine.points = lastLine.points.concat([point.x, point.y]);
        }
      } else if (tool === 'shape') {
        const lastShape = currentSlide.shapes[currentSlide.shapes.length - 1];
        if (lastShape) {
          if (lastShape.type === 'rect') {
            lastShape.width = point.x - lastShape.x;
            lastShape.height = point.y - lastShape.y;
          } else if (lastShape.type === 'square') {
            const size = Math.max(Math.abs(point.x - lastShape.x), Math.abs(point.y - lastShape.y));
            lastShape.width = (point.x < lastShape.x ? -1 : 1) * size;
            lastShape.height = (point.y < lastShape.y ? -1 : 1) * size;
          } else if (lastShape.type === 'ellipse') {
            lastShape.width = point.x - lastShape.x;
            lastShape.height = point.y - lastShape.y;
          } else if (lastShape.type === 'circle') {
            lastShape.radius = Math.sqrt(Math.pow(point.x - lastShape.x, 2) + Math.pow(point.y - lastShape.y, 2));
          } else if (lastShape.type === 'line' || lastShape.type === 'arrow') {
            lastShape.points = [0, 0, point.x - lastShape.x, point.y - lastShape.y];
          } else if (
            lastShape.type === 'triangle' || 
            lastShape.type === 'polygon' || 
            lastShape.type === 'pentagon' || 
            lastShape.type === 'star' || 
            lastShape.type === 'geometry' ||
            lastShape.type === 'ruler-15' ||
            lastShape.type === 'ruler-30' ||
            lastShape.type === 'protractor' ||
            lastShape.type === 'compass' ||
            lastShape.type === 'setsquare-45' ||
            lastShape.type === 'setsquare-30-60' ||
            lastShape.type === 'ruler' ||
            lastShape.type === 'setsquare'
          ) {
            lastShape.radius = Math.sqrt(Math.pow(point.x - lastShape.x, 2) + Math.pow(point.y - lastShape.y, 2));
          }
        }
      }
      return updated;
    });
  };

  const handleMouseUp = (e?: any) => {
    // Complete rectangular marquee selection
    if (tool === 'select' && isMarqueeSelecting.current) {
      isMarqueeSelecting.current = false;
      const rx = Math.min(marqueeRect.x1, marqueeRect.x2);
      const ry = Math.min(marqueeRect.y1, marqueeRect.y2);
      const rw = Math.abs(marqueeRect.x2 - marqueeRect.x1);
      const rh = Math.abs(marqueeRect.y2 - marqueeRect.y1);
      setMarqueeRect(prev => ({ ...prev, visible: false }));

      if (rw > 4 || rh > 4) {
        const current = slides[activeSlideIdx];
        if (current) {
          const matches: { id: string; type: 'shape' | 'line' }[] = [];
          const checkBox = (box: { x: number; y: number; width: number; height: number }) => {
            if (selectionMode === 'contain') {
              return (
                box.x >= rx &&
                box.y >= ry &&
                box.x + box.width <= rx + rw &&
                box.y + box.height <= ry + rh
              );
            }
            // Intersect mode (default desktop graphics selection behavior)
            return (
              box.x <= rx + rw &&
              box.x + box.width >= rx &&
              box.y <= ry + rh &&
              box.y + box.height >= ry
            );
          };

          current.shapes.forEach(sh => {
            if (checkBox(getElementBoundingBox(sh, 'shape'))) {
              matches.push({ id: sh.id, type: 'shape' });
            }
          });
          current.lines.forEach(ln => {
            if (ln.tool !== 'eraser' && checkBox(getElementBoundingBox(ln, 'line'))) {
              matches.push({ id: ln.id, type: 'line' });
            }
          });

          if (e?.evt?.shiftKey || e?.evt?.ctrlKey || e?.evt?.metaKey) {
            setSelectedIds(prev => {
              const map = new Map(prev.map(i => [i.id, i]));
              matches.forEach(m => map.set(m.id, m));
              return Array.from(map.values());
            });
          } else {
            setSelectedIds(matches);
          }
        }
      }
      return;
    }

    isDrawing.current = false;

    // AI Predictive Shape Assistant Engine
    if (aiShapeAssistant && (tool === 'pen' || tool === 'pencil' || tool === 'marker' || tool === 'highlighter')) {
      const currentSlide = slides[activeSlideIdx];
      const lastLine = currentSlide.lines[currentSlide.lines.length - 1];
      
      if (lastLine && lastLine.points.length >= 10) {
        const pts = lastLine.points;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0;
        const count = pts.length / 2;
        
        for (let i = 0; i < pts.length; i += 2) {
          const px = pts[i];
          const py = pts[i + 1];
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
          sumX += px;
          sumY += py;
        }

        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = sumX / count;
        const centerY = sumY / count;

        const startX = pts[0];
        const startY = pts[1];
        const endX = pts[pts.length - 2];
        const endY = pts[pts.length - 1];
        
        const startEndDist = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        const diag = Math.sqrt(width * width + height * height);
        const isClosed = startEndDist < diag * 0.45; // Generous closure threshold

        let recognized: 'circle' | 'square' | 'rect' | 'triangle' | 'line' | null = null;

        if (isClosed && diag > 25) {
          // Circularity metrics
          let sumRadius = 0;
          for (let i = 0; i < pts.length; i += 2) {
            sumRadius += Math.sqrt(Math.pow(pts[i] - centerX, 2) + Math.pow(pts[i + 1] - centerY, 2));
          }
          const avgRadius = sumRadius / count;
          
          let variance = 0;
          for (let i = 0; i < pts.length; i += 2) {
            const r = Math.sqrt(Math.pow(pts[i] - centerX, 2) + Math.pow(pts[i + 1] - centerY, 2));
            variance += Math.pow(r - avgRadius, 2);
          }
          const stdDev = Math.sqrt(variance / count);
          const circularity = stdDev / avgRadius;

          if (circularity < 0.22) {
            recognized = 'circle';
          } else {
            // Check aspect ratio for square vs rectangle
            const ratioDiff = Math.abs(width - height) / Math.max(width, height);
            if (ratioDiff < 0.2) {
              recognized = 'square';
            } else {
              recognized = 'rect';
            }
          }
        } else if (diag > 40) {
          // Straight line check
          let pathLen = 0;
          for (let i = 2; i < pts.length; i += 2) {
            pathLen += Math.sqrt(Math.pow(pts[i] - pts[i - 2], 2) + Math.pow(pts[i + 1] - pts[i - 1], 2));
          }
          const straightLen = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
          if (straightLen / pathLen > 0.82) {
            recognized = 'line';
          }
        }

        if (recognized) {
          // Replace rough line with a beautiful vector shape
          setSlides(prev => {
            const updated = [...prev];
            const slide = updated[activeSlideIdx];
            // Remove the hand stroke
            slide.lines = slide.lines.filter(l => l.id !== lastLine.id);

            // Add the perfect geometry
            const cleanStroke = lastLine.color.substring(0, 7);
            if (recognized === 'circle') {
              const radius = Math.max(width, height) / 2;
              slide.shapes.push({
                id: `ai_${Date.now()}`,
                type: 'circle',
                x: centerX,
                y: centerY,
                radius,
                stroke: cleanStroke,
                strokeWidth: Math.max(2, lastLine.brushSize)
              });
            } else if (recognized === 'square') {
              const size = Math.max(width, height);
              slide.shapes.push({
                id: `ai_${Date.now()}`,
                type: 'square',
                x: centerX - size / 2,
                y: centerY - size / 2,
                width: size,
                height: size,
                stroke: cleanStroke,
                strokeWidth: Math.max(2, lastLine.brushSize)
              });
            } else if (recognized === 'rect') {
              slide.shapes.push({
                id: `ai_${Date.now()}`,
                type: 'rect',
                x: minX,
                y: minY,
                width,
                height,
                stroke: cleanStroke,
                strokeWidth: Math.max(2, lastLine.brushSize)
              });
            } else if (recognized === 'line') {
              slide.shapes.push({
                id: `ai_${Date.now()}`,
                type: 'line',
                x: startX,
                y: startY,
                points: [0, 0, endX - startX, endY - startY],
                stroke: cleanStroke,
                strokeWidth: Math.max(2, lastLine.brushSize)
              });
            }

            return updated;
          });
          setAiTip(`🪄 AI Assistant: Sketched path converted to a perfect ${recognized}!`);
        }
      }
    }
  };
  
  const handleObjectClick = (e: any, id: string, type: 'line' | 'shape') => {
    if (tool === 'object_eraser') {
      pushHistory();
      setSlides(prev => {
        const updated = [...prev];
        if (type === 'line') {
          updated[activeSlideIdx].lines = updated[activeSlideIdx].lines.filter(l => l.id !== id);
        } else {
          updated[activeSlideIdx].shapes = updated[activeSlideIdx].shapes.filter(s => s.id !== id);
        }
        return updated;
      });
      setSelectedIds(prev => prev.filter(item => item.id !== id));
    } else if (tool === 'select') {
      e.cancelBubble = true;
      const slide = slides[activeSlideIdx];
      const clickedObj = type === 'shape'
        ? slide?.shapes.find(s => s.id === id)
        : slide?.lines.find(l => l.id === id);
      const groupId = clickedObj?.groupId;

      // Collect all members if object belongs to a group
      const groupMembers: { id: string; type: 'shape' | 'line' }[] = [];
      if (groupId && slide) {
        slide.shapes.filter(s => s.groupId === groupId).forEach(s => groupMembers.push({ id: s.id, type: 'shape' }));
        slide.lines.filter(l => l.groupId === groupId).forEach(l => groupMembers.push({ id: l.id, type: 'line' }));
      } else {
        groupMembers.push({ id, type });
      }

      const isMultiModifier = e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey;
      if (isMultiModifier) {
        setSelectedIds(prev => {
          const exists = prev.some(item => item.id === id);
          if (exists) {
            const removeIds = new Set(groupMembers.map(g => g.id));
            return prev.filter(item => !removeIds.has(item.id));
          }
          const next = [...prev];
          groupMembers.forEach(gm => {
            if (!next.some(n => n.id === gm.id)) next.push(gm);
          });
          return next;
        });
      } else {
        setSelectedIds(groupMembers);
      }
    }
  };

  const handleClearCanvas = () => {
    pushHistory();
    setSlides(prev => {
      const updated = cloneSlides(prev);
      updated[activeSlideIdx].lines = [];
      updated[activeSlideIdx].shapes = [];
      return updated;
    });
    setSelectedIds([]);
    setConfirmClearOpen(false);
    setAiTip('🧹 Slide canvas cleared (use Undo to restore)');
  };

  // Slide Manager Actions
  const handleAddSlide = () => {
    pushHistory();
    setSlides(prev => [...prev, { id: `slide_${Date.now()}`, shapes: [], lines: [], stickies: [] }]);
    setActiveSlideIdx(slides.length);
    setSelectedIds([]);
  };

  const handleDuplicateSlide = () => {
    pushHistory();
    const current = slides[activeSlideIdx];
    const duplicated: Slide = {
      id: `slide_${Date.now()}`,
      shapes: current.shapes.map(s => ({ ...s, id: `shape_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` })),
      lines: current.lines.map(l => ({ ...l, id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` })),
      stickies: []
    };
    setSlides(prev => {
      const updated = [...prev];
      updated.splice(activeSlideIdx + 1, 0, duplicated);
      return updated;
    });
    setActiveSlideIdx(activeSlideIdx + 1);
    setSelectedIds([]);
  };

  const handleDeleteSlide = () => {
    if (slides.length <= 1) {
      setAiTip('⚠️ Cannot delete the only remaining slide.');
      return;
    }
    pushHistory();
    const newIdx = Math.max(0, activeSlideIdx - 1);
    setSlides(prev => prev.filter((_, idx) => idx !== activeSlideIdx));
    setActiveSlideIdx(newIdx);
    setSelectedIds([]);
    setAiTip('🗑️ Slide removed (use Undo to restore)');
  };

  // Zoom viewport controls
  const handleZoomIn = () => setStageScale(prev => Math.min(4, prev + 0.15));
  const handleZoomOut = () => setStageScale(prev => Math.max(0.4, prev - 0.15));
  const handleResetZoom = () => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  // Selection Object Modifiers (supports both single and multi-selection)
  const handleModifyObjectColor = (color: string) => {
    if (selectedIds.length === 0) return;
    pushHistory();
    const idSet = new Set(selectedIds.map(s => s.id));
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      slide.shapes.forEach(shape => {
        if (idSet.has(shape.id)) {
          shape.stroke = color;
          if (shape.type === 'text') shape.fill = color;
        }
      });
      slide.lines.forEach(line => {
        if (idSet.has(line.id)) line.color = color;
      });
      return updated;
    });
  };

  const handleModifyObjectFill = (color: string) => {
    if (selectedIds.length === 0) return;
    pushHistory();
    const idSet = new Set(selectedIds.filter(s => s.type === 'shape').map(s => s.id));
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      slide.shapes.forEach(shape => {
        if (idSet.has(shape.id)) shape.fill = color;
      });
      return updated;
    });
  };

  const handleModifyObjectThickness = (size: number) => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds.map(s => s.id));
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      slide.shapes.forEach(shape => {
        if (idSet.has(shape.id)) shape.strokeWidth = size;
      });
      slide.lines.forEach(line => {
        if (idSet.has(line.id)) line.brushSize = size;
      });
      return updated;
    });
  };

  const handleModifyObjectLayer = (order: 'front' | 'back') => {
    if (selectedIds.length === 0) return;
    pushHistory();
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      selectedIds.forEach(sel => {
        if (sel.type === 'shape') {
          const shapeIdx = slide.shapes.findIndex(s => s.id === sel.id);
          if (shapeIdx > -1) {
            const [shape] = slide.shapes.splice(shapeIdx, 1);
            if (order === 'front') slide.shapes.push(shape);
            else slide.shapes.unshift(shape);
          }
        } else {
          const lineIdx = slide.lines.findIndex(l => l.id === sel.id);
          if (lineIdx > -1) {
            const [line] = slide.lines.splice(lineIdx, 1);
            if (order === 'front') slide.lines.push(line);
            else slide.lines.unshift(line);
          }
        }
      });
      return updated;
    });
  };

  const handleDeleteSelectedObject = () => {
    if (selectedIds.length === 0) return;
    pushHistory();
    const idSet = new Set(selectedIds.map(s => s.id));
    setSlides(prev => {
      const updated = cloneSlides(prev);
      const slide = updated[activeSlideIdx];
      slide.shapes = slide.shapes.filter(s => !idSet.has(s.id));
      slide.lines = slide.lines.filter(l => !idSet.has(l.id));
      return updated;
    });
    setSelectedIds([]);
  };

  const handleDuplicateSelectedObject = () => {
    if (selectedIds.length === 0) return;
    pushHistory();
    const newSelection: { id: string; type: 'shape' | 'line' }[] = [];
    const newGroupId = selectedIds.length > 1 ? `grp_${Date.now()}` : undefined;
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      selectedIds.forEach(sel => {
        if (sel.type === 'shape') {
          const shape = slide.shapes.find(s => s.id === sel.id);
          if (shape) {
            const dup: ShapeObj = {
              ...shape,
              id: `shape_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              x: shape.x + 28,
              y: shape.y + 28,
              groupId: newGroupId || shape.groupId
            };
            slide.shapes.push(dup);
            newSelection.push({ id: dup.id, type: 'shape' });
          }
        } else {
          const line = slide.lines.find(l => l.id === sel.id);
          if (line) {
            const dup: LineObj = {
              ...line,
              id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              points: line.points.map(p => p + 28),
              groupId: newGroupId || line.groupId
            };
            slide.lines.push(dup);
            newSelection.push({ id: dup.id, type: 'line' });
          }
        }
      });
      return updated;
    });
    setTimeout(() => setSelectedIds(newSelection), 40);
    setAiTip(`📋 Duplicated ${selectedIds.length} object${selectedIds.length > 1 ? 's' : ''}`);
  };

  const handleGroupSelectedObjects = () => {
    if (selectedIds.length < 2) {
      setAiTip('ℹ️ Select 2 or more objects (drag marquee box or Shift+Click) to group.');
      return;
    }
    pushHistory();
    const gid = `group_${Date.now()}`;
    const idSet = new Set(selectedIds.map(s => s.id));
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      slide.shapes.forEach(s => { if (idSet.has(s.id)) s.groupId = gid; });
      slide.lines.forEach(l => { if (idSet.has(l.id)) l.groupId = gid; });
      return updated;
    });
    setAiTip(`🔗 Grouped ${selectedIds.length} objects together`);
  };

  const handleUngroupSelectedObjects = () => {
    if (selectedIds.length === 0) return;
    pushHistory();
    const idSet = new Set(selectedIds.map(s => s.id));
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      slide.shapes.forEach(s => { if (idSet.has(s.id)) delete s.groupId; });
      slide.lines.forEach(l => { if (idSet.has(l.id)) delete l.groupId; });
      return updated;
    });
    setAiTip(`🔓 Ungrouped selected objects`);
  };

  const handleEditSelectedObjectLabel = () => {
    if (!selectedObj || selectedObj.type !== 'shape') return;
    const slide = slides[activeSlideIdx];
    const shape = slide?.shapes.find(s => s.id === selectedObj.id);
    if (!shape) return;

    setTextModal({
      open: true,
      mode: 'edit',
      shapeId: shape.id,
      value: shape.text || ''
    });
  };

  const handleCommitTextModal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = textModal.value.trim();
    if (textModal.mode === 'create' && val) {
      pushHistory();
      const newShape: ShapeObj = {
        id: Date.now().toString(),
        type: 'text',
        x: textModal.x ?? 180,
        y: textModal.y ?? 160,
        stroke: brushColor,
        strokeWidth: brushSize,
        fill: brushColor,
        width: 0,
        height: 0,
        radius: 0,
        points: [0, 0, 0, 0],
        text: val,
        fontSize: Math.max(18, brushSize * 4)
      };
      setSlides(prev => {
        const updated = cloneSlides(prev);
        updated[activeSlideIdx].shapes.push(newShape);
        return updated;
      });
    } else if (textModal.mode === 'edit' && textModal.shapeId) {
      pushHistory();
      setSlides(prev => {
        const updated = cloneSlides(prev);
        const target = updated[activeSlideIdx].shapes.find(s => s.id === textModal.shapeId);
        if (target) {
          target.text = textModal.value;
        }
        return updated;
      });
    }
    setTextModal({ open: false, mode: 'create', value: '' });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportPNG = () => {
    if (!stageRef.current) return;
    if (trRef.current) trRef.current.nodes([]);
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `smartboard_slide_${activeSlideIdx + 1}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setAiTip(`🖼️ Exported Slide ${activeSlideIdx + 1} as PNG`);
  };

  const handleExportPDF = () => {
    if (!stageRef.current) return;
    if (trRef.current) trRef.current.nodes([]);
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>SmartBoard Slide ${activeSlideIdx + 1} Export</title>
            <style>
              body { margin: 0; display: flex; align-items: center; justify-content: center; background: #0f172a; height: 100vh; font-family: sans-serif; }
              img { max-width: 95%; max-height: 95vh; object-fit: contain; box-shadow: 0 10px 30px rgba(0,0,0,0.6); border-radius: 12px; }
              @media print {
                body { background: #fff; }
                img { max-width: 100%; height: auto; box-shadow: none; border-radius: 0; }
              }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" onload="window.print();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
    setAiTip(`📄 PDF export ready for Slide ${activeSlideIdx + 1}`);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const src = evt.target?.result as string;
      if (!src) return;
      const img = new Image();
      img.src = src;
      img.onload = () => {
        const imgShape: ShapeObj = {
          id: `img_${Date.now()}`,
          type: 'svg_node',
          x: 120,
          y: 120,
          width: Math.min(img.width, 500) || 400,
          height: Math.min(img.height, 350) || 300,
          stroke: '#818cf8',
          strokeWidth: 0,
          imageObj: img
        };
        setSlides(prev => {
          const updated = [...prev];
          updated[activeSlideIdx].shapes.push(imgShape);
          return updated;
        });
        setAiTip(`🖼️ Inserted image onto whiteboard`);
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleInsertStickyNote = (color: string = '#fef08a') => {
    const stickyShape: ShapeObj = {
      id: `sticky_${Date.now()}`,
      type: 'rect',
      x: 180 + Math.random() * 60,
      y: 150 + Math.random() * 60,
      width: 220,
      height: 190,
      stroke: '#eab308',
      strokeWidth: 2,
      fill: color,
      text: 'Double-click to edit note'
    };
    setSlides(prev => {
      const updated = [...prev];
      updated[activeSlideIdx].shapes.push(stickyShape);
      return updated;
    });
    setAiTip(`📝 Sticky note inserted!`);
  };

  const currentSlide = slides[activeSlideIdx] || { id: 'default', shapes: [], lines: [] };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col font-sans select-none overflow-hidden">
      
      {/* 1. MAIN HEADER / BRAND BAR */}
      <div className="min-h-[3.25rem] py-1.5 bg-slate-900 border-b border-white/10 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-2 sm:px-4 z-20 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button 
            onClick={onClose} 
            className="px-2.5 sm:px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all border border-white/5 shadow-md flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span>Exit</span>
          </button>
          <div className="text-white font-black text-xs sm:text-sm tracking-widest uppercase hidden md:flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-glow shadow-emerald-500/55" />
            Class SmartBoard 3.0
            <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] font-mono border ${saveState === 'saving' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'}`}>
              {saveState === 'saving' ? 'Saving...' : 'Saved'}
            </span>
          </div>
        </div>
        
        {/* Dynamic Tool Selector */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 bg-slate-950 border border-white/10 p-1 sm:p-1.5 rounded-2xl shadow-inner max-w-full">
          <button 
            onClick={() => { setTool('select'); setShapesMenuOpen(false); }} 
            className={`p-1.5 sm:p-2 rounded-xl transition-all flex items-center gap-1 ${tool === 'select' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title="Select & Marquee Box Select (Drag on empty canvas)"
          >
            <MousePointer2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden lg:inline text-[10px] font-black uppercase">Select</span>
          </button>

          {tool === 'select' && (
            <button
              onClick={() => setSelectionMode(prev => prev === 'intersect' ? 'contain' : 'intersect')}
              className="px-2 py-1 rounded-lg bg-slate-900 border border-indigo-500/30 text-[9px] font-mono font-bold text-indigo-300 hover:bg-indigo-500/20 transition-all"
              title="Toggle Marquee Selection Mode: Intersect (touch) vs Contain (fully inside)"
            >
              Box: {selectionMode === 'intersect' ? 'Touch' : 'Inside'}
            </button>
          )}

          <button 
            onClick={() => { setTool('pan'); setShapesMenuOpen(false); }} 
            className={`p-1.5 sm:p-2 rounded-xl transition-all ${tool === 'pan' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title="Pan / Move Canvas Viewport"
          >
            <Hand className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          
          <button 
            onClick={() => { setTool('pen'); setShapesMenuOpen(false); }} 
            className={`p-1.5 sm:p-2 rounded-xl transition-all ${tool === 'pen' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title="Academic Ink Pen"
          >
            <Pen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          
          <button 
            onClick={() => { setTool('pencil'); setShapesMenuOpen(false); }} 
            className={`p-1.5 sm:p-2 rounded-xl transition-all ${tool === 'pencil' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title="Fine Graphite Pencil"
          >
            <span className="text-xs font-extrabold font-mono">✏️</span>
          </button>
          
          <button 
            onClick={() => { setTool('marker'); setShapesMenuOpen(false); }} 
            className={`p-1.5 sm:p-2 rounded-xl transition-all ${tool === 'marker' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title="Bold Dry-Erase Marker"
          >
            <span className="text-xs font-extrabold font-mono">🖍️</span>
          </button>
          
          <button 
            onClick={() => { setTool('highlighter'); setShapesMenuOpen(false); }} 
            className={`p-1.5 sm:p-2 rounded-xl transition-all ${tool === 'highlighter' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title="Translucent Text Highlighter"
          >
            <PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button 
            onClick={() => { setTool('shape'); setShapeType('text'); setShapesMenuOpen(false); }} 
            className={`p-1.5 sm:p-2 rounded-xl transition-all ${tool === 'shape' && shapeType === 'text' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title="Click Canvas to Add Text"
          >
            <Type className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          
          {/* Shapes Dropdown Selector Menu */}
          <div className="relative">
            <button 
              onClick={() => { setShapesMenuOpen(!shapesMenuOpen); setTool('shape'); }} 
              className={`p-1.5 sm:p-2 sm:px-3 rounded-xl transition-all flex items-center gap-1 border border-transparent ${tool === 'shape' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              title="Interactive Shapes Menu"
            >
              <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider hidden md:inline">{shapeType}</span>
              <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
            
            {shapesMenuOpen && (
              <div className="fixed sm:absolute top-24 sm:top-full left-2 sm:left-0 mt-0 sm:mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2.5 flex flex-col gap-1 w-44 max-w-[calc(100vw-1rem)] z-50 animate-fadeIn max-h-64 overflow-y-auto">
                 <div className="px-2.5 py-1 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1">Vector Geometries</div>
                 <button onClick={() => { setTool('shape'); setShapeType('line'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'line' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Minus className="w-3.5 h-3.5" /> Simple Line</button>
                 <button onClick={() => { setTool('shape'); setShapeType('arrow'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'arrow' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>↗ Directed Arrow</button>
                 <button onClick={() => { setTool('shape'); setShapeType('rect'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'rect' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Square className="w-3.5 h-3.5" /> Rectangle</button>
                 <button onClick={() => { setTool('shape'); setShapeType('square'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'square' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Square className="w-3.5 h-3.5 text-indigo-400" /> Square Node</button>
                 <button onClick={() => { setTool('shape'); setShapeType('circle'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'circle' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><CircleIcon className="w-3.5 h-3.5" /> Circular Node</button>
                 <button onClick={() => { setTool('shape'); setShapeType('triangle'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'triangle' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Triangle className="w-3.5 h-3.5" /> Equilateral Triangle</button>
                 <button onClick={() => { setTool('shape'); setShapeType('polygon'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'polygon' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><span className="text-xs font-extrabold font-mono">⬡</span> Hexagonal Hex</button>
                 <button onClick={() => { setTool('shape'); setShapeType('geometry'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'geometry' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><span className="text-xs font-extrabold font-mono">📐</span> Graph Axis Grid</button>
                <div className="px-2.5 py-1 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1 mt-1">Geometry Tools</div>
                 <button onClick={() => { setTool('shape'); setShapeType('ruler'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'ruler' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><span className="text-xs font-extrabold font-mono">📏</span> Ruler</button>
                 <button onClick={() => { setTool('shape'); setShapeType('protractor'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'protractor' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><span className="text-xs font-extrabold font-mono">🪶</span> Protractor</button>
                 <button onClick={() => { setTool('shape'); setShapeType('compass'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'compass' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><span className="text-xs font-extrabold font-mono">🧭</span> Compass</button>
                 <button onClick={() => { setTool('shape'); setShapeType('setsquare'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'setsquare' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Triangle className="w-3.5 h-3.5" /> Set Square</button>
              </div>
            )}
          </div>
          
          <div className="relative">
            <button 
              onClick={() => { setEraserMenuOpen(!eraserMenuOpen); if(!eraserMenuOpen) setTool('eraser'); setShapesMenuOpen(false); }} 
              className={`p-1.5 sm:p-2 rounded-xl transition-all flex items-center gap-1 ${tool === 'eraser' || tool === 'object_eraser' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              title="Erase Lines & Shapes"
            >
              <Eraser className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {eraserMenuOpen && (
              <div className="fixed sm:absolute top-24 sm:top-full left-2 sm:left-0 mt-0 sm:mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2.5 flex flex-col gap-1 w-40 max-w-[calc(100vw-1rem)] z-50 animate-fadeIn max-h-64 overflow-y-auto">
                  <button onClick={() => { setTool('eraser'); setEraserMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${tool === 'eraser' ? 'bg-red-500/20 text-red-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>Stroke Eraser</button>
                  <button onClick={() => { setTool('object_eraser'); setEraserMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${tool === 'object_eraser' ? 'bg-red-500/20 text-red-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>Object Eraser</button>
               </div>
             )}
           </div>

           <div className="h-4 w-px bg-white/10 mx-0.5" />

           <button
             onClick={handleUndo}
             disabled={undoStack.length === 0}
             className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
             title="Undo (Ctrl+Z)"
           >
             <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
           </button>
           <button
             onClick={handleRedo}
             disabled={redoStack.length === 0}
             className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
             title="Redo (Ctrl+Y)"
           >
             <Redo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
           </button>
         </div>

         {/* Global Action Handlers */}
         <div className="flex flex-wrap items-center gap-1 sm:gap-2">
           
           <button 
             onClick={() => setAiPromptOpen(true)}
             className={`p-1.5 sm:p-2 border rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${isGeneratingDiagram ? 'bg-indigo-600 text-white border-indigo-400 animate-pulse' : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20'}`}
             title="AI Whiteboard & Shape Recognition"
           >
             <Sparkles className="w-3.5 h-3.5" />
             <span className="hidden sm:inline">{isGeneratingDiagram ? 'Generating...' : 'AI Board'}</span>
           </button>
           {/* Sticky Notes & Media Tools */}
           <button 
             onClick={() => { pushHistory(); handleInsertStickyNote('#fef08a'); }}
             className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
             title="Insert Sticky Note"
           >
             <StickyNote className="w-4 h-4" />
             <span className="hidden lg:inline text-[10px] uppercase font-black">Sticky</span>
           </button>

           <button 
             onClick={() => fileInputRef.current?.click()}
             className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
             title="Upload Image File"
           >
             <ImageIcon className="w-4 h-4 text-indigo-400" />
             <span className="hidden lg:inline text-[10px] uppercase font-black">Image</span>
           </button>
           <input 
             type="file" 
             ref={fileInputRef} 
             onChange={handleImageUpload} 
             accept="image/*" 
             className="hidden" 
           />

           <button
             onClick={() => setIsPresentationMode(prev => !prev)}
             className={`p-2 rounded-xl border transition-all text-xs font-bold flex items-center gap-1 ${isPresentationMode ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'}`}
             title={isPresentationMode ? 'Exit Presentation View' : 'Presentation Mode (Hide Secondary HUD)'}
           >
             <Maximize2 className="w-4 h-4" />
           </button>

           <div className="h-5 w-px bg-white/10 mx-0.5" />

           {/* Export PNG / PDF */}
           <button 
             onClick={handleExportPNG}
             className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-1 text-xs font-bold"
             title="Export Board as PNG Image"
           >
             <Download className="w-4 h-4" />
             <span className="hidden xl:inline text-[10px] uppercase font-black">PNG</span>
           </button>

           {confirmClearOpen ? (
             <div className="flex items-center gap-1 bg-rose-950/90 border border-rose-500/40 px-2 py-1 rounded-xl">
               <span className="text-[10px] font-bold text-rose-200">Clear slide?</span>
               <button
                 onClick={handleClearCanvas}
                 className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black rounded-lg"
               >
                 Yes
               </button>
               <button
                 onClick={() => setConfirmClearOpen(false)}
                 className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-bold rounded-lg"
               >
                 No
               </button>
             </div>
           ) : (
             <button 
               onClick={() => setConfirmClearOpen(true)}
               className="p-2 bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-400 hover:border-red-500/35 rounded-xl transition-all border border-white/5"
               title="Clear Slide Elements"
             >
               <Trash2 className="w-4 h-4" />
             </button>
           )}
         </div>
       </div>

       {/* 2. SECONDARY CONTROLS HUD (ZOOM + SLIDES + ACTIVE OBJECT CONFIG) */}
       {!isPresentationMode && (
       <div className="bg-slate-900/90 border-b border-white/5 py-1.5 sm:py-2 px-2 sm:px-4 flex flex-wrap items-center justify-between gap-1.5 sm:gap-3 shrink-0 z-10 backdrop-blur-md">
        
        {/* Dynamic Multi-Slide Manager */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 bg-slate-950 px-2 sm:px-3 py-1 sm:py-1.5 rounded-2xl border border-white/5 shadow-md">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mr-1 hidden sm:inline">Slides</span>
          <button 
            disabled={activeSlideIdx <= 0}
            onClick={() => { setActiveSlideIdx(prev => prev - 1); setSelectedObj(null); }}
            className="p-1 text-slate-400 hover:text-white disabled:text-slate-700 transition-colors"
            title="Previous Slide"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-slate-200 font-mono px-1">
            {activeSlideIdx + 1}/{slides.length}
          </span>
          <button 
            disabled={activeSlideIdx >= slides.length - 1}
            onClick={() => { setActiveSlideIdx(prev => prev + 1); setSelectedObj(null); }}
            className="p-1 text-slate-400 hover:text-white disabled:text-slate-700 transition-colors"
            title="Next Slide"
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          
          <div className="h-4 w-px bg-white/10 mx-0.5 sm:mx-1" />
          
          <button 
            onClick={handleAddSlide}
            className="p-1 sm:px-2.5 bg-indigo-500/10 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1 border border-indigo-500/20"
            title="Add New Blank Slide"
          >
            <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">New</span>
          </button>
          <button 
            onClick={handleDuplicateSlide}
            className="p-1 sm:px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1 border border-white/5"
            title="Duplicate Current Elements to New Slide"
          >
            <Copy className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Duplicate</span>
          </button>
          <button 
            disabled={slides.length <= 1}
            onClick={handleDeleteSlide}
            className="p-1 text-red-400 hover:text-red-300 disabled:text-slate-700 transition-colors"
            title="Delete Current Slide"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View Zoom & Navigation Controls */}
        <div className="flex items-center gap-1 sm:gap-2 bg-slate-950 px-2 sm:px-3 py-1 sm:py-1.5 rounded-2xl border border-white/5 shadow-md font-mono">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest mr-1 hidden sm:inline">Viewport</span>
          <button onClick={handleZoomOut} className="p-1 text-slate-400 hover:text-white transition-colors" title="Zoom Out"><ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
          <span className="text-[11px] sm:text-xs text-slate-300 font-bold w-10 sm:w-12 text-center">{Math.round(stageScale * 100)}%</span>
          <button onClick={handleZoomIn} className="p-1 text-slate-400 hover:text-white transition-colors" title="Zoom In"><ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
          <button onClick={handleResetZoom} className="p-1 text-indigo-400 hover:text-indigo-300 transition-colors" title="Fit to Canvas (100%)"><Maximize2 className="w-3.5 h-3.5" /></button>
        </div>

        {/* Board Background Config */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-2xl border border-white/5 shadow-md font-mono hidden md:flex">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest mr-1">Paper</span>
          <select 
            value={backgroundPattern} 
            onChange={(e) => setBackgroundPattern(e.target.value as any)}
            className="bg-slate-900 border border-white/10 rounded-xl text-xs text-white px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="plain">Plain</option>
            <option value="grid">Grid</option>
            <option value="dot">Dot Grid</option>
            <option value="graph">Graph Paper</option>
            <option value="ruled">Ruled Paper</option>
          </select>
        </div>

        {/* Selected Object Advanced Properties Config Panel */}
        {selectedObj ? (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-indigo-500/10 border border-indigo-500/30 px-2.5 sm:px-4 py-1.5 rounded-2xl animate-fadeIn max-h-64 overflow-y-auto">
            <span className="text-[10px] text-indigo-300 uppercase tracking-widest font-black font-mono">
              {selectedIds.length > 1 ? `Selected (${selectedIds.length})` : `Selected: ${selectedObj.type}`}
            </span>

            {/* Interactive 3D Object Controls when a 3D Educational Model is selected */}
            {selectedObj.type === 'shape' && currentSlide.shapes.find(s => s.id === selectedObj.id)?.type === 'model_3d' && (() => {
              const mShape = currentSlide.shapes.find(s => s.id === selectedObj.id)!;
              return (
                <div className="flex flex-wrap items-center gap-2 border-l border-indigo-500/30 pl-3 bg-slate-950/80 px-2.5 py-1 rounded-xl">
                  <span className="text-[9px] font-black uppercase text-sky-400 flex items-center gap-1">
                    <Box className="w-3 h-3" /> 3D View
                  </span>
                  <label className="flex items-center gap-1 text-[9px] text-slate-300 font-mono">
                    Pitch
                    <input
                      type="range"
                      min="-75"
                      max="75"
                      value={mShape.rotX ?? 22}
                      onChange={(e) => updateSelected3DModel({ rotX: parseInt(e.target.value) })}
                      className="w-14 accent-sky-400 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[9px] text-slate-300 font-mono">
                    Yaw
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={mShape.rotY ?? -32}
                      onChange={(e) => updateSelected3DModel({ rotY: parseInt(e.target.value) })}
                      className="w-16 accent-sky-400 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[9px] text-slate-300 font-mono">
                    Explode
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round((mShape.explode3D ?? 0) * 100)}
                      onChange={(e) => updateSelected3DModel({ explode3D: parseInt(e.target.value) / 100 })}
                      className="w-12 accent-amber-400 cursor-pointer"
                      title="Explode / Separate 3D Parts"
                    />
                  </label>
                  <button
                    onClick={() => updateSelected3DModel({ showLabels3D: !(mShape.showLabels3D ?? true) })}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border ${mShape.showLabels3D !== false ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-slate-900 text-slate-400 border-white/10'}`}
                    title="Toggle 3D Part Labels"
                  >
                    Labels
                  </button>
                  <button
                    onClick={() => updateSelected3DModel({ rotX: 22, rotY: -32, zoom3D: 1, explode3D: 0, showLabels3D: true })}
                    className="p-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-white/10"
                    title="Reset 3D Orientation"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              );
            })()}
            
            {/* Color modifier */}
            <div className="flex items-center gap-1">
              {[ '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#eab308' ].map(col => (
                <button 
                  key={col}
                  onClick={() => handleModifyObjectColor(col)}
                  className="w-4.5 h-4.5 rounded-full border border-white/20 hover:scale-110 transition-transform shadow-sm"
                  style={{ backgroundColor: col }}
                  title="Change Stroke Color"
                />
              ))}
            </div>

            {/* Fill modifier (Shapes only) */}
            {selectedIds.some(s => s.type === 'shape') && (
              <div className="flex items-center gap-1 border-l border-white/10 pl-3">
                <span className="text-[8px] text-slate-400 mr-1 uppercase font-mono">Fill</span>
                <button 
                  onClick={() => handleModifyObjectFill('transparent')}
                  className="w-4.5 h-4.5 rounded-full border border-white/20 text-slate-400 text-[8px] font-bold hover:scale-110 transition-transform bg-slate-900"
                  title="Transparent Fill"
                >
                  ∅
                </button>
                {[ '#ef444430', '#3b82f630', '#10b98130', '#eab30830', '#ffffff20' ].map(fillCol => (
                  <button 
                    key={fillCol}
                    onClick={() => handleModifyObjectFill(fillCol)}
                    className="w-4.5 h-4.5 rounded-full border border-white/20 hover:scale-110 transition-transform shadow-sm"
                    style={{ backgroundColor: fillCol }}
                    title="Soft Translucent Fill"
                  />
                ))}
              </div>
            )}

            {/* Thickness Modifier */}
            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <input 
                type="range"
                min="1"
                max="24"
                onChange={(e) => handleModifyObjectThickness(parseInt(e.target.value))}
                className="w-16 accent-indigo-500 cursor-pointer"
                title="Change Border Thickness"
              />
            </div>

            {/* Order/Layering & Group modifiers */}
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
              <button 
                onClick={() => handleModifyObjectLayer('front')} 
                className="p-1 bg-slate-850 hover:bg-slate-700 text-slate-200 rounded-lg border border-white/5" 
                title="Bring Layer to Front"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => handleModifyObjectLayer('back')} 
                className="p-1 bg-slate-850 hover:bg-slate-700 text-slate-200 rounded-lg border border-white/5" 
                title="Send Layer to Back"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              {selectedIds.length >= 2 && (
                <button
                  onClick={handleGroupSelectedObjects}
                  className="p-1 px-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 rounded-lg border border-indigo-500/30 text-[10px] font-bold flex items-center gap-1"
                  title="Group Selected Objects (Ctrl+G)"
                >
                  <Layers className="w-3 h-3" /> Group
                </button>
              )}
              {selectedIds.some(sel => {
                const sh = currentSlide.shapes.find(s => s.id === sel.id);
                const ln = currentSlide.lines.find(l => l.id === sel.id);
                return Boolean(sh?.groupId || ln?.groupId);
              }) && (
                <button
                  onClick={handleUngroupSelectedObjects}
                  className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-amber-500/30 text-[10px] font-bold"
                  title="Ungroup Objects (Ctrl+Shift+G)"
                >
                  Ungroup
                </button>
              )}
            </div>

            {/* Duplicate & Edit Label controls */}
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
              {selectedObj.type === 'shape' && (
                <button 
                  onClick={handleEditSelectedObjectLabel} 
                  className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg border border-white/10 text-[10px] font-bold flex items-center gap-1" 
                  title="Edit Label / Text"
                >
                  <Type className="w-3 h-3" /> Label
                </button>
              )}
              <button 
                onClick={handleDuplicateSelectedObject} 
                className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-white/10 text-[10px] font-bold flex items-center gap-1" 
                title="Duplicate Selected (Ctrl+D)"
              >
                <Copy className="w-3 h-3" /> Duplicate
              </button>
            </div>

            {/* Selected Object → 3D Infographic & Classroom Visual Actions */}
            <div className="flex items-center gap-1.5 border-l border-indigo-500/30 pl-3">
              {selectedObj.type === 'shape' && (() => {
                const targetSh = currentSlide.shapes.find(s => s.id === selectedObj.id);
                if (targetSh?.type === 'model_3d' && targetSh.scene3D) {
                  return (
                    <button
                      onClick={() => {
                        setInteractive3DScene(targetSh.scene3D as any);
                        setActive3DShapeId(targetSh.id);
                      }}
                      className="p-1 px-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg transition-all flex items-center gap-1.5 cursor-pointer animate-pulse"
                      title="Open Interactive Three.js WebGL 3D Studio (Orbit, Explode, Inspect)"
                    >
                      <Rotate3d className="w-3.5 h-3.5 text-cyan-300" /> Orbit 3D Studio
                    </button>
                  );
                }
                return null;
              })()}

              <button
                onClick={() => handleSelectedObjectAIAction('to_3d')}
                disabled={isRunningSelectionAI}
                className="p-1 px-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase rounded-lg shadow-md transition-all flex items-center gap-1 disabled:opacity-50"
                title="Convert Selected Object/Text into an Interactive 3D Educational Model"
              >
                <Box className="w-3 h-3" /> Convert to 3D
              </button>
              <button
                onClick={() => handleSelectedObjectAIAction('to_svg')}
                disabled={isRunningSelectionAI}
                className="p-1 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                title="Generate Sanitized Classroom SVG Diagram from Selection"
              >
                <Sparkles className="w-3 h-3" /> Make Visual
              </button>
              <button
                onClick={() => handleSelectedObjectAIAction('explain')}
                disabled={isRunningSelectionAI}
                className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-indigo-200 border border-white/10 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                title="Explain Selected Concept for Students"
              >
                <Eye className="w-3 h-3" /> Explain
              </button>
              <button
                onClick={() => handleSelectedObjectAIAction('label_parts')}
                disabled={isRunningSelectionAI}
                className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-amber-200 border border-white/10 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                title="Identify & Label Key Parts"
              >
                <Tag className="w-3 h-3" /> Labels
              </button>
              <button
                onClick={() => handleSelectedObjectAIAction('quiz')}
                disabled={isRunningSelectionAI}
                className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-purple-200 border border-white/10 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                title="Generate Quick Classroom Quiz from Selection"
              >
                <HelpCircle className="w-3 h-3" /> Quiz
              </button>
            </div>

            {/* Action buttons */}
            <button 
              onClick={handleDeleteSelectedObject} 
              className="p-1 px-2.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase rounded-lg border border-red-500/30 shadow-md transition-all flex items-center gap-1"
              title="Delete Selected (Del)"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>
        ) : (
          /* General Stroke Thickness Controls */
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-white/5 p-1 rounded-full">
              {[ '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#eab308', '#a855f7', '#f97316', '#ec4899' ].map(c => (
                <button 
                  key={c} 
                  onClick={() => setBrushColor(c)} 
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 transition-all ${brushColor === c ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'}`} 
                  style={{ backgroundColor: c }} 
                />
              ))}
              <input
                type="color"
                value={brushColor.slice(0, 7)}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-5 h-5 rounded-full bg-transparent border-0 cursor-pointer"
                title="Custom Ink Color"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-slate-950 border border-white/5 px-2.5 py-1 rounded-xl">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <input 
                type="range" 
                min="1" 
                max="24" 
                value={brushSize} 
                onChange={(e) => setBrushSize(parseInt(e.target.value))} 
                className="w-16 sm:w-20 accent-indigo-500 cursor-pointer" 
                title="Brush Thickness"
              />
              <span className="text-[10px] font-mono text-slate-400 w-6 text-center">{brushSize}px</span>
            </div>
          </div>
        )}
      </div>
      )}
      
      {/* 3. DYNAMIC CANVAS DRAWING CONTAINER STAGE */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden select-none touch-none" 
        style={{ 
          touchAction: 'none',
          cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : (tool === 'eraser' || tool === 'object_eraser') ? 'cell' : 'crosshair',
          backgroundColor,
          backgroundImage: 
             backgroundPattern === 'grid' ? 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)' :
             backgroundPattern === 'dot' ? 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)' :
             backgroundPattern === 'graph' ? 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)' :
             backgroundPattern === 'ruled' ? 'linear-gradient(to bottom, transparent 24px, rgba(255,255,255,0.05) 25px)' : 'none',
          backgroundSize: 
             backgroundPattern === 'grid' ? '20px 20px' :
             backgroundPattern === 'dot' ? '20px 20px' :
             backgroundPattern === 'graph' ? '10px 10px, 10px 10px, 50px 50px, 50px 50px' :
             backgroundPattern === 'ruled' ? '100% 25px' : 'auto',
          backgroundPosition: `${stagePos.x}px ${stagePos.y}px`
        }}
      >
        <Stage
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          ref={stageRef}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          draggable={tool === 'pan'}
          onDragEnd={(e) => {
            if (tool === 'pan' && e.target === e.target.getStage()) {
              setStagePos({ x: e.target.x(), y: e.target.y() });
            }
          }}
        >
          <Layer>
            {/* Vector Shapes rendering */}
            {currentSlide.shapes.map((shape) => (
              <Group 
                key={shape.id}
                id={shape.id}
                name="object"
                x={shape.x} 
                y={shape.y} 
                draggable={tool === 'select' && !(shape as any).isLocked}
                onDragEnd={(e) => {
                  shape.x = e.target.x();
                  shape.y = e.target.y();
                }}
                onTransformEnd={(e) => {
                  const node = e.target;
                  shape.x = node.x();
                  shape.y = node.y();
                  // For shapes we should scale their properties or just store scaleX/scaleY on the shape object.
                  // Since the shape doesn't have scale property explicitly, we can add it or just let konva keep it 
                  // as long as the component doesn't remount without it. Wait, React Konva will lose scale on remount 
                  // if not tied to state. But wait, `shape.scaleX` works if we map it!
                  (shape as any).scaleX = node.scaleX();
                  (shape as any).scaleY = node.scaleY();
                  (shape as any).rotation = node.rotation();
                }}
                scaleX={(shape as any).scaleX || 1}
                scaleY={(shape as any).scaleY || 1}
                rotation={(shape as any).rotation || 0}
                onMouseEnter={(e) => { 
                  if (tool === 'object_eraser') {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'cell';
                  }
                }}
                onClick={(e) => handleObjectClick(e, shape.id, 'shape')}
                onTap={(e) => handleObjectClick(e, shape.id, 'shape')}
                onDblClick={() => {
                  setSelectedIds([{ id: shape.id, type: 'shape' }]);
                  setTimeout(() => handleEditSelectedObjectLabel(), 50);
                }}
              >
                {/* Visual Highlight indicator if selected */}
                {selectedIds.some(item => item.id === shape.id) && (
                  <Rect 
                    x={shape.type === 'circle' ? -(shape.radius || 20) - 4 : -4}
                    y={shape.type === 'circle' ? -(shape.radius || 20) - 4 : -4}
                    width={shape.type === 'circle' ? ((shape.radius || 20) * 2) + 8 : (shape.width || 40) + 8}
                    height={shape.type === 'circle' ? ((shape.radius || 20) * 2) + 8 : (shape.height || 40) + 8}
                    stroke={shape.groupId ? "#10b981" : "#4f46e5"}
                    strokeWidth={1.5}
                    dash={[4, 2]}
                  />
                )}

                {shape.type === 'rect' && (
                  <Rect 
                    width={shape.width || 0} 
                    height={shape.height || 0} 
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'square' && (
                  <Rect 
                    width={shape.width || 0} 
                    height={shape.height || 0} 
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'circle' && (
                  <Circle 
                    radius={shape.radius || 0} 
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'ellipse' && (
                  <Ellipse 
                    radiusX={shape.width ? Math.abs(shape.width) / 2 : 30}
                    radiusY={shape.height ? Math.abs(shape.height) / 2 : 20}
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'triangle' && (
                  <RegularPolygon 
                    sides={3} 
                    radius={shape.radius || 0} 
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'pentagon' && (
                  <RegularPolygon 
                    sides={5} 
                    radius={shape.radius || 0} 
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'polygon' && (
                  <RegularPolygon 
                    sides={6} 
                    radius={shape.radius || 0} 
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'star' && (
                  <Star 
                    numPoints={5}
                    innerRadius={(shape.radius || 30) / 2}
                    outerRadius={shape.radius || 30}
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'geometry' && (
                  <Group>
                    <RegularPolygon 
                      sides={4} 
                      radius={shape.radius || 0} 
                      fill={shape.fill} 
                      stroke={shape.stroke} 
                      strokeWidth={shape.strokeWidth} 
                    />
                    <Line 
                      points={[0, -(shape.radius || 0), 0, (shape.radius || 0)]} 
                      stroke={shape.stroke} 
                      strokeWidth={1} 
                      dash={[4, 4]} 
                    />
                    <Line 
                      points={[-(shape.radius || 0), 0, (shape.radius || 0), 0]} 
                      stroke={shape.stroke} 
                      strokeWidth={1} 
                      dash={[4, 4]} 
                    />
                  </Group>
                )}
                {shape.type === 'line' && (
                  <Line 
                    points={shape.points || [0,0,0,0]}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                  />
                )}
                {(shape.type === 'ruler' || shape.type === 'ruler-15') && (
                  <Group>
                    <Rect width={240} height={40} fill="#f1f5f9" stroke="#475569" strokeWidth={2} opacity={0.9} cornerRadius={4} />
                    {Array.from({ length: 16 }).map((_, i) => (
                      <Group key={i}>
                        <Line points={[i * 15, 0, i * 15, i % 5 === 0 ? 18 : 10]} stroke="#475569" strokeWidth={1.5} />
                        {i % 5 === 0 && (
                          <Text text={String(i)} x={i * 15 - 4} y={22} fontSize={9} fontStyle="bold" fill="#334155" />
                        )}
                      </Group>
                    ))}
                    <Text text="15 cm Ruler" x={90} y={6} fontSize={8} fontStyle="bold" fill="#94a3b8" />
                  </Group>
                )}
                {shape.type === 'ruler-30' && (
                  <Group>
                    <Rect width={400} height={40} fill="#f1f5f9" stroke="#475569" strokeWidth={2} opacity={0.9} cornerRadius={4} />
                    {Array.from({ length: 31 }).map((_, i) => (
                      <Group key={i}>
                        <Line points={[i * 12.5, 0, i * 12.5, i % 5 === 0 ? 18 : 10]} stroke="#475569" strokeWidth={1.5} />
                        {i % 5 === 0 && (
                          <Text text={String(i)} x={i * 12.5 - 4} y={22} fontSize={9} fontStyle="bold" fill="#334155" />
                        )}
                      </Group>
                    ))}
                    <Text text="30 cm Ruler" x={160} y={6} fontSize={8} fontStyle="bold" fill="#94a3b8" />
                  </Group>
                )}
                {shape.type === 'protractor' && (
                  <Group>
                    <Circle radius={120} angle={180} rotation={180} fill="#f1f5f9" stroke="#475569" strokeWidth={2.5} opacity={0.9} />
                    <Line points={[-120, 0, 120, 0]} stroke="#475569" strokeWidth={2.5} />
                    {Array.from({ length: 19 }).map((_, i) => {
                      const angle = i * 10;
                      const rad = angle * Math.PI / 180;
                      const x1 = -120 * Math.cos(rad);
                      const y1 = -120 * Math.sin(rad);
                      const x2 = -(120 - (i % 3 === 0 ? 16 : 8)) * Math.cos(rad);
                      const y2 = -(120 - (i % 3 === 0 ? 16 : 8)) * Math.sin(rad);
                      return (
                        <Group key={i}>
                          <Line points={[x1, y1, x2, y2]} stroke="#475569" strokeWidth={1.5} />
                          {i % 3 === 0 && (
                            <Text text={String(angle)} x={-95 * Math.cos(rad) - 7} y={-95 * Math.sin(rad) - 4} fontSize={8} fontStyle="bold" fill="#334155" />
                          )}
                        </Group>
                      );
                    })}
                    <Circle radius={6} x={0} y={0} fill="#475569" />
                    <Text text="Protractor" x={-25} y={-45} fontSize={10} fontStyle="bold" fill="#64748b" />
                  </Group>
                )}
                {shape.type === 'compass' && (
                  <Group>
                    {/* Metal leg with sharp point */}
                    <Line points={[0, 0, -25, 90]} stroke="#64748b" strokeWidth={4} lineCap="round" />
                    <Line points={[-25, 90, -28, 100]} stroke="#334155" strokeWidth={1.5} />
                    {/* Pencil leg */}
                    <Line points={[0, 0, 25, 80]} stroke="#cbd5e1" strokeWidth={4} lineCap="round" />
                    <Rect x={22} y={80} width={6} height={15} fill="#f59e0b" stroke="#334155" strokeWidth={1} />
                    <Line points={[25, 95, 25, 102]} stroke="#0f172a" strokeWidth={2} />
                    {/* Adjustment wheel arc */}
                    <Line points={[-15, 40, 15, 40]} stroke="#475569" strokeWidth={2} />
                    <Circle radius={4} x={0} y={40} fill="#94a3b8" />
                    {/* Hinge join */}
                    <Circle radius={8} x={0} y={0} fill="#334155" stroke="#cbd5e1" strokeWidth={2} />
                    <Text text="Compass" x={-22} y={110} fontSize={10} fontStyle="bold" fill="#94a3b8" />
                  </Group>
                )}
                {(shape.type === 'setsquare' || shape.type === 'setsquare-45') && (
                  <Group>
                    <Line points={[0, 0, 0, 150, 150, 150]} closed={true} fill="#f1f5f9" stroke="#475569" strokeWidth={2.5} opacity={0.9} />
                    <Line points={[15, 35, 15, 135, 115, 135]} closed={true} stroke="#94a3b8" strokeWidth={1.5} opacity={0.6} />
                    <Text text="45° Set Square" x={20} y={100} fontSize={9} fontStyle="bold" fill="#475569" />
                  </Group>
                )}
                {shape.type === 'setsquare-30-60' && (
                  <Group>
                    <Line points={[0, 0, 0, 160, 92, 160]} closed={true} fill="#f1f5f9" stroke="#475569" strokeWidth={2.5} opacity={0.9} />
                    <Line points={[15, 30, 15, 145, 70, 145]} closed={true} stroke="#94a3b8" strokeWidth={1.5} opacity={0.6} />
                    <Text text="30°/60° Set Square" x={18} y={110} fontSize={8} fontStyle="bold" fill="#475569" />
                  </Group>
                )}
                {shape.type === 'arrow' && (
                  <Arrow 
                    points={shape.points || [0,0,0,0]} 
                    stroke={shape.stroke} 
                    fill={shape.stroke} 
                    strokeWidth={shape.strokeWidth}
                    pointerLength={shape.strokeWidth * 3}
                    pointerWidth={shape.strokeWidth * 3}
                  />
                )}
                {shape.type === 'text' && (
                  <Text
                    text={shape.text || ''}
                    fontSize={shape.fontSize || 24}
                    fill={shape.fill || '#fff'}
                    fontFamily="mono"
                  />
                )}
                {shape.type === 'divider' && (
                  <Group>
                    <Line points={[0, 0, -30, 110]} stroke="#94a3b8" strokeWidth={5} lineCap="round" />
                    <Line points={[-30, 110, -32, 122]} stroke="#334155" strokeWidth={2} />
                    <Line points={[0, 0, 30, 110]} stroke="#94a3b8" strokeWidth={5} lineCap="round" />
                    <Line points={[30, 110, 32, 122]} stroke="#334155" strokeWidth={2} />
                    <Circle radius={10} x={0} y={0} fill="#334155" stroke="#cbd5e1" strokeWidth={2.5} />
                    <Line points={[-20, 50, 20, 50]} stroke="#64748b" strokeWidth={2} />
                    <Text text="Divider" x={-18} y={130} fontSize={10} fontStyle="bold" fill="#94a3b8" />
                  </Group>
                )}
                {shape.type === 'angle-meter' && (
                  <Group>
                    <Arrow points={[0, 0, 120, 0]} stroke="#818cf8" strokeWidth={3} pointerLength={8} pointerWidth={8} />
                    <Arrow points={[0, 0, 85, -85]} stroke="#818cf8" strokeWidth={3} pointerLength={8} pointerWidth={8} />
                    <Circle radius={35} angle={45} rotation={-45} stroke="#f59e0b" strokeWidth={2} dash={[3, 3]} />
                    <Text text="45° Angle" x={42} y={-25} fontSize={14} fontStyle="bold" fill="#f59e0b" />
                    <Circle radius={5} x={0} y={0} fill="#818cf8" />
                  </Group>
                )}
                {(shape.type === 'svg_node' || shape.type === 'mermaid' || shape.type === 'model_3d') && shape.imageObj && (
                  <KonvaImage
                    image={shape.imageObj}
                    width={shape.width || 450}
                    height={shape.height || 300}
                  />
                )}
                {shape.text && shape.type !== 'text' && shape.type !== 'svg_node' && shape.type !== 'mermaid' && shape.type !== 'model_3d' && (
                  <Text
                    text={shape.text}
                    x={shape.type === 'rect' || shape.type === 'square' ? (shape.width || 0) / 2 - 40 : -40}
                    y={shape.type === 'rect' || shape.type === 'square' ? (shape.height || 0) / 2 - 8 : -8}
                    width={80}
                    align="center"
                    fontSize={13}
                    fontStyle="bold"
                    fill={shape.stroke || '#ffffff'}
                  />
                )}
              </Group>
            ))}
            
            {/* Fine Inks Rendering */}
            {currentSlide.lines.map((line) => (
              <Line
                key={line.id}
                id={line.id}
                name="object"
                points={line.points}
                stroke={line.color}
                strokeWidth={line.brushSize}
                tension={0.4}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : 'source-over'}
                draggable={tool === 'select' && !(line as any).isLocked}
                onDragEnd={(e) => {
                  line.points = line.points.map((p, idx) => {
                    const deltaX = e.target.x();
                    const deltaY = e.target.y();
                    return idx % 2 === 0 ? p + deltaX : p + deltaY;
                  });
                  e.target.position({ x: 0, y: 0 });
                }}
                onTransformEnd={(e) => {
                  const node = e.target;
                  (line as any).scaleX = node.scaleX();
                  (line as any).scaleY = node.scaleY();
                  (line as any).rotation = node.rotation();
                }}
                scaleX={(line as any).scaleX || 1}
                scaleY={(line as any).scaleY || 1}
                rotation={(line as any).rotation || 0}
                onMouseEnter={(e) => { 
                  if (tool === 'object_eraser') {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'cell';
                  }
                }}
                onClick={(e) => handleObjectClick(e, line.id, 'line')}
                onTap={(e) => handleObjectClick(e, line.id, 'line')}
              />
            ))}
            {/* Transparent Circular Eraser hover brush outline with outer border */}
            {eraserHoverPos && (tool === 'eraser' || tool === 'object_eraser') && (
              <Circle 
                x={eraserHoverPos.x}
                y={eraserHoverPos.y}
                radius={30}
                fill="rgba(148, 163, 184, 0.25)"
                stroke="#64748b"
                strokeWidth={1.5}
                listening={false}
              />
            )}

            {/* Rectangular Marquee Selection Box */}
            {marqueeRect && marqueeRect.visible && (
              <Rect
                x={Math.min(marqueeRect.x1, marqueeRect.x2)}
                y={Math.min(marqueeRect.y1, marqueeRect.y2)}
                width={Math.abs(marqueeRect.x2 - marqueeRect.x1)}
                height={Math.abs(marqueeRect.y2 - marqueeRect.y1)}
                fill={selectionMode === 'intersect' ? 'rgba(99, 102, 241, 0.14)' : 'rgba(16, 185, 129, 0.14)'}
                stroke={selectionMode === 'intersect' ? '#6366f1' : '#10b981'}
                strokeWidth={1.5 / stageScale}
                dash={[6 / stageScale, 4 / stageScale]}
                listening={false}
              />
            )}
            
            {/* Transformer for Single & Multi-Object Selection */}
            {selectedIds.length > 0 && tool === 'select' && (
              <Transformer 
                ref={trRef} 
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 5 || newBox.height < 5) {
                    return oldBox;
                  }
                  return newBox;
                }}
                padding={8}
                borderStroke="#6366f1"
                anchorStroke="#6366f1"
                anchorFill="#fff"
                anchorSize={8}
                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              />
            )}
          </Layer>
        </Stage>

        {/* AI Shape Predictive Toast Notification */}
        {aiTip && (
          <div className="absolute top-4 right-4 bg-slate-900/95 border border-indigo-500/30 text-indigo-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-medium z-50 backdrop-blur-md">
            <span className="text-indigo-400">✨</span>
            <span>{aiTip}</span>
          </div>
        )}

        {/* Contextual Selected Object AI Insight Card (Explain / Quiz / Notes) */}
        {aiInsightCard && (
          <div className="absolute bottom-14 right-4 w-80 sm:w-96 max-h-[55vh] overflow-y-auto bg-slate-900/95 border border-indigo-500/40 rounded-2xl p-4 shadow-2xl z-50 backdrop-blur-md animate-fadeIn">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">{aiInsightCard.title}</h4>
              </div>
              <button
                onClick={() => setAiInsightCard(null)}
                className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-white/5"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
              {aiInsightCard.content}
            </div>
          </div>
        )}

        {/* Subtle Empty State Hint */}
        {currentSlide.lines.length === 0 && currentSlide.shapes.length === 0 && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-white/10 text-[11px] text-slate-400 backdrop-blur-md flex items-center gap-2">
            <span>✏️ Ready to draw on Slide {activeSlideIdx + 1}</span>
            <span className="hidden sm:inline text-slate-500">• Select Marquee, Pen, Shapes, AI SVG & 3D Models</span>
          </div>
        )}

        {/* Inline Non-Blocking Text / Label Modal */}
        {textModal.open && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <form
              onSubmit={handleCommitTextModal}
              className="w-full max-w-sm bg-slate-900 border border-indigo-500/40 rounded-2xl p-4 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                  {textModal.mode === 'create' ? 'Insert Canvas Text' : 'Edit Shape Label / Text'}
                </h4>
                <button
                  type="button"
                  onClick={() => setTextModal({ open: false, mode: 'create', value: '' })}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                autoFocus
                value={textModal.value}
                onChange={(e) => setTextModal(prev => ({ ...prev, value: e.target.value }))}
                placeholder="Type text or formula..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTextModal({ open: false, mode: 'create', value: '' })}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Apply
                </button>
              </div>
            </form>
          </div>
        )}
        {/* Centered, Fully-Responsive AI Classroom Assistant Modal */}
        {aiPromptOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAiPromptOpen(false);
            }}
          >
            <div 
              className="w-full max-w-lg bg-slate-900 border border-indigo-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider font-display">AI Classroom Assistant</h4>
                    <p className="text-[10px] text-slate-400 font-mono">Generate educational SVGs, interactive 3D models & structured diagrams</p>
                  </div>
                </div>
                <button 
                  onClick={() => setAiPromptOpen(false)} 
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm cursor-pointer"
                  title="Close Dialog"
                >
                  ✕
                </button>
              </div>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-white/10 hover:border-indigo-500/30 transition-all cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>✨ Auto Shape Predictive Recognition</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Automatically converts hand-drawn rough circles, squares, rectangles & lines</div>
                </div>
                <input
                  type="checkbox"
                  checked={aiShapeAssistant}
                  onChange={(e) => setAiShapeAssistant(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </label>

              <form onSubmit={handleGenerateDiagram} className="space-y-3.5 pt-2">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-indigo-300 font-mono">Visual Format Mode</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(['auto', 'svg', '3d', 'mermaid', 'diagram'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAiToolType(mode)}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                          aiToolType === mode 
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md scale-[1.02]' 
                            : 'bg-slate-950 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {mode === '3d' ? '🧊 3D' : mode === 'svg' ? '🎨 SVG' : mode === 'mermaid' ? '🧜 Flow' : mode === 'auto' ? '⚡ Auto' : '📐 Diagram'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Educational Concept / Prompt</label>
                  <input
                    type="text"
                    value={aiPromptQuery}
                    onChange={(e) => setAiPromptQuery(e.target.value)}
                    placeholder="e.g., Labelled diagram of the human heart, Right triangle geometry, Water cycle, 3D Prism..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">Curriculum Quick-Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '❤️ Human Heart SVG', q: 'Labelled diagram of the human heart', m: 'svg' as const },
                      { label: '📐 Right Triangle Trigonometry', q: 'Labelled right triangle showing opposite, adjacent and hypotenuse', m: 'svg' as const },
                      { label: '💧 Water Cycle Diagram', q: 'Simple water cycle diagram', m: 'svg' as const },
                      { label: '🧊 3D Water Cycle Model', q: 'Water Cycle', m: '3d' as const },
                      { label: '⚛️ 3D Bohr Atom Model', q: '3D Atom Model', m: '3d' as const },
                      { label: '🧬 DNA Helix Structure', q: 'DNA Double Helix', m: '3d' as const },
                      { label: '🔋 Electric Circuit SVG', q: 'Simple electrical circuit with battery, bulb and switch', m: 'svg' as const },
                      { label: '🌿 Plant Cell Anatomy', q: 'Diagram of a plant cell with chloroplast and cell wall', m: 'svg' as const }
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setAiToolType(preset.m);
                          setAiPromptQuery(preset.q);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-indigo-950/80 text-slate-300 hover:text-indigo-200 border border-white/10 text-[10px] font-medium transition-all cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setAiPromptOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!aiPromptQuery.trim() || isGeneratingDiagram}
                    className="px-5 py-2 text-xs bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 text-white rounded-xl font-black uppercase tracking-wider transition-all shadow-lg hover:shadow-indigo-500/25 cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isGeneratingDiagram ? 'Generating visual...' : 'Insert on Whiteboard'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Real Interactive Three.js WebGL 3D Studio Modal */}
        {interactive3DScene && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setInteractive3DScene(null);
                setActive3DShapeId(null);
              }
            }}
          >
            <div
              className="w-full max-w-4xl bg-slate-900 border border-indigo-500/50 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-scaleUp"
              onClick={(e) => e.stopPropagation()}
            >
              <InteractiveThreeDViewer
                scene={interactive3DScene}
                height="560px"
                interactive={true}
                autoSpinDefault={false}
                onClose={() => {
                  setInteractive3DScene(null);
                  setActive3DShapeId(null);
                }}
                onSnapshot={(dataUrl) => {
                  if (!active3DShapeId) return;
                  const img = new Image();
                  img.src = dataUrl;
                  img.onload = () => {
                    pushHistory();
                    setSlides(prev => {
                      const updated = cloneSlides(prev);
                      const target = updated[activeSlideIdx]?.shapes.find(s => s.id === active3DShapeId);
                      if (target) {
                        target.imageObj = img;
                        target.svgRaw = undefined;
                      }
                      return updated;
                    });
                    setAiTip('📸 Updated 3D Whiteboard model preview snapshot!');
                    setInteractive3DScene(null);
                    setActive3DShapeId(null);
                  };
                }}
              />
            </div>
          </div>
        )}
        {/* Verified 3D Model Library & Request Hub Modal */}
        <ThreeDLibraryAndRequestModal
          isOpen={threeDHubOpen}
          onClose={() => {
            setThreeDHubOpen(false);
            setThreeDHubUnavailableAlert(false);
          }}
          onSelectVerifiedModel={(scene) => {
            insert3DModelOnBoard(scene, 120, 90);
            setAiTip(`🧊 Verified 3D model loaded: "${scene.title}"`);
          }}
          onFallbackTo2DSvg={async (query) => {
            setAiTip(`🎨 Generating 2D SVG diagram for "${query}"...`);
            try {
              const res = await fetch('/api/ai/svg-diagram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
              });
              const data = await res.json();
              if (data?.svg) {
                const img = new Image();
                img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data.svg);
                img.onload = () => {
                  pushHistory();
                  setSlides(prev => {
                    const updated = cloneSlides(prev);
                    updated[activeSlideIdx].shapes.push({
                      id: `svg_${Date.now()}`,
                      type: 'svg_node',
                      x: 140,
                      y: 100,
                      width: 500,
                      height: 360,
                      imageObj: img,
                      svgRaw: data.svg
                    });
                    return updated;
                  });
                  setAiTip(`🎨 2D SVG diagram created for "${data.title || query}"!`);
                };
              }
            } catch {
              setAiTip('⚠️ Could not generate 2D SVG diagram.');
            }
          }}
          currentUser={currentUser as any}
          initialTopicQuery={threeDQueryTopic}
          isUnavailableAlert={threeDHubUnavailableAlert}
        />
      </div>
    </div>
  );
};
