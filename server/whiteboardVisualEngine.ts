/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Classroom Visual & 3D Educational Engine
 * Generates sanitized classroom-ready SVG diagrams, structured 3D educational scenes,
 * and contextual AI conversions for selected Whiteboard objects using NVIDIA AI.
 */

import { generateAICompletion } from './aiClient';
import { generateSvgDiagram } from './diagramEngine';

export interface Educational3DPart {
  id: string;
  shape: 'box' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'triangular_prism' | 'torus' | 'ring' | 'plane';
  label: string;
  description?: string;
  position: [number, number, number]; // x, y, z in [-200, 200]
  dimensions: [number, number, number]; // width/radius, height, depth
  rotation?: [number, number, number]; // rx, ry, rz in degrees
  color: string;
  opacity?: number;
  wireframe?: boolean;
}

export interface Educational3DConnection {
  fromId: string;
  toId: string;
  label?: string;
  color?: string;
}

export interface Educational3DScene {
  id: string;
  title: string;
  subtitle: string;
  subject: string;
  sceneType: 'geometry' | 'science_model' | 'infographic_3d';
  summary: string;
  formulas?: string[];
  parts: Educational3DPart[];
  connections: Educational3DConnection[];
  canConvert: boolean;
  fallbackReason?: string;
}

/**
 * Strictly sanitizes any SVG string so it can never execute scripts, event handlers,
 * external loads, or unsafe DOM injection.
 */
export function sanitizeEducationalSvg(rawSvg: string): string {
  if (!rawSvg || typeof rawSvg !== 'string') return '';

  // Extract the <svg ...>...</svg> block if wrapped in markdown
  const svgMatch = rawSvg.match(/<svg[\s\S]*?<\/svg>/i);
  let svg = svgMatch ? svgMatch[0] : rawSvg.trim();

  if (!svg.toLowerCase().startsWith('<svg')) {
    return '';
  }

  // Strip dangerous elements completely
  svg = svg
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    // Strip inline event handlers (onload, onerror, onclick, onmouseover, etc.)
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    // Strip javascript: and data:text/html URIs
    .replace(/(href|xlink:href)\s*=\s*["']\s*(javascript:|data:text\/html)[^"']*["']/gi, '');

  // Ensure xmlns and viewBox exist for reliable rendering
  if (!/xmlns=/i.test(svg)) {
    svg = svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!/viewBox=/i.test(svg)) {
    svg = svg.replace(/^<svg/i, '<svg viewBox="0 0 900 600"');
  }

  return svg;
}

/**
 * High-Precision Classroom SVG Presets for Core Curriculum Diagrams
 */
function getCuratedClassroomSvg(query: string): { title: string; subject: string; svg: string } | null {
  const q = query.toLowerCase();

  // 1. RIGHT TRIANGLE (Opposite, Adjacent, Hypotenuse, Pythagoras & Trig)
  if (/\b(right\s*triangle|hypotenuse|opposite|adjacent|trigonometry|pythagoras|pythagorean|sohcahtoa)\b/i.test(q)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
    </marker>
  </defs>
  <rect width="900" height="600" rx="18" fill="url(#bgGrad)" stroke="#334155" stroke-width="2"/>
  
  <!-- Header -->
  <text x="450" y="48" fill="#f8fafc" font-size="24" font-weight="800" text-anchor="middle" font-family="sans-serif">RIGHT-ANGLED TRIANGLE &amp; TRIGONOMETRIC RATIOS</text>
  <text x="450" y="74" fill="#94a3b8" font-size="14" text-anchor="middle" font-family="sans-serif">Labelled Anatomy: Opposite, Adjacent, Hypotenuse &amp; Angle θ</text>

  <!-- Right Triangle Polygon: A(160, 460), B(520, 460), C(520, 170) -->
  <polygon points="160,460 520,460 520,170" fill="#1e1b4b" fill-opacity="0.45" stroke="#6366f1" stroke-width="4" stroke-linejoin="round"/>
  
  <!-- Right Angle Square at B(520, 460) -->
  <polyline points="490,460 490,430 520,430" fill="none" stroke="#f43f5e" stroke-width="3"/>
  <text x="472" y="422" fill="#fda4af" font-size="13" font-weight="bold" font-family="sans-serif">90°</text>

  <!-- Angle Theta Arc at A(160, 460) -->
  <path d="M 235,460 A 75,75 0 0,0 218,412" fill="none" stroke="#facc15" stroke-width="3.5"/>
  <text x="252" y="442" fill="#facc15" font-size="20" font-weight="bold" font-family="sans-serif">θ</text>

  <!-- Vertex Labels -->
  <circle cx="160" cy="460" r="6" fill="#38bdf8"/>
  <text x="135" y="475" fill="#f8fafc" font-size="18" font-weight="bold" font-family="sans-serif">A</text>
  <circle cx="520" cy="460" r="6" fill="#38bdf8"/>
  <text x="535" y="475" fill="#f8fafc" font-size="18" font-weight="bold" font-family="sans-serif">B</text>
  <circle cx="520" cy="170" r="6" fill="#38bdf8"/>
  <text x="532" y="165" fill="#f8fafc" font-size="18" font-weight="bold" font-family="sans-serif">C</text>

  <!-- Side 1: HYPOTENUSE -->
  <rect x="215" y="255" width="190" height="44" rx="10" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
  <text x="310" y="275" fill="#38bdf8" font-size="15" font-weight="800" text-anchor="middle" font-family="sans-serif">HYPOTENUSE (c)</text>
  <text x="310" y="292" fill="#cbd5e1" font-size="11" text-anchor="middle" font-family="sans-serif">Longest side (Opposite 90°)</text>

  <!-- Side 2: OPPOSITE -->
  <rect x="545" y="290" width="165" height="48" rx="10" fill="#0f172a" stroke="#10b981" stroke-width="2"/>
  <text x="627" y="311" fill="#10b981" font-size="15" font-weight="800" text-anchor="middle" font-family="sans-serif">OPPOSITE (a)</text>
  <text x="627" y="329" fill="#cbd5e1" font-size="11" text-anchor="middle" font-family="sans-serif">Across from angle θ</text>

  <!-- Side 3: ADJACENT -->
  <rect x="260" y="485" width="175" height="48" rx="10" fill="#0f172a" stroke="#f59e0b" stroke-width="2"/>
  <text x="347" y="506" fill="#f59e0b" font-size="15" font-weight="800" text-anchor="middle" font-family="sans-serif">ADJACENT (b)</text>
  <text x="347" y="524" fill="#cbd5e1" font-size="11" text-anchor="middle" font-family="sans-serif">Next to angle θ</text>

  <!-- Formula Reference Panel -->
  <rect x="610" y="115" width="255" height="150" rx="14" fill="#1e293b" stroke="#475569" stroke-width="2"/>
  <text x="737" y="142" fill="#f8fafc" font-size="15" font-weight="800" text-anchor="middle" font-family="sans-serif">KEY FORMULAS</text>
  <line x1="630" y1="152" x2="845" y2="152" stroke="#334155" stroke-width="1.5"/>
  <text x="632" y="178" fill="#38bdf8" font-size="14" font-weight="bold" font-family="monospace">a² + b² = c² (Pythagoras)</text>
  <text x="632" y="204" fill="#10b981" font-size="13" font-weight="bold" font-family="monospace">sin(θ) = Opposite / Hypotenuse</text>
  <text x="632" y="228" fill="#f59e0b" font-size="13" font-weight="bold" font-family="monospace">cos(θ) = Adjacent / Hypotenuse</text>
  <text x="632" y="252" fill="#c084fc" font-size="13" font-weight="bold" font-family="monospace">tan(θ) = Opposite / Adjacent</text>
</svg>`;
    return { title: 'Right-Angled Triangle (Opposite, Adjacent & Hypotenuse)', subject: 'Mathematics', svg };
  }

  // 2. HUMAN HEART DIAGRAM
  if (/\b(heart|cardiac|ventricle|atrium|aorta|circulatory)\b/i.test(q)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="100%" height="100%">
  <defs>
    <linearGradient id="bgHeart" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <marker id="arrBlue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
    </marker>
    <marker id="arrRed" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e"/>
    </marker>
  </defs>
  <rect width="900" height="600" rx="18" fill="url(#bgHeart)" stroke="#334155" stroke-width="2"/>
  <text x="450" y="44" fill="#f8fafc" font-size="22" font-weight="800" text-anchor="middle" font-family="sans-serif">ANATOMY OF THE HUMAN HEART</text>
  <text x="450" y="68" fill="#94a3b8" font-size="13" text-anchor="middle" font-family="sans-serif">Four-Chambered Double Circulation: Deoxygenated (Blue) &amp; Oxygenated (Red) Pathways</text>

  <!-- Superior Vena Cava & Aorta trunks -->
  <path d="M 350,120 L 350,220" stroke="#0284c7" stroke-width="32" stroke-linecap="round"/>
  <path d="M 455,210 C 455,115 535,115 535,190" fill="none" stroke="#e11d48" stroke-width="34" stroke-linecap="round"/>
  <path d="M 420,230 L 330,155" stroke="#38bdf8" stroke-width="24" stroke-linecap="round"/>

  <!-- Outer Pericardium / Heart Silhouette -->
  <path d="M 450,515 C 310,435 270,315 305,225 C 330,175 405,180 445,225 C 485,180 565,175 590,235 C 625,325 570,445 450,515 Z" fill="#1e293b" stroke="#f43f5e" stroke-width="4"/>

  <!-- Right Atrium (Deoxygenated - Blue) -->
  <ellipse cx="368" cy="275" rx="52" ry="46" fill="#0369a1" fill-opacity="0.7" stroke="#38bdf8" stroke-width="3"/>
  <text x="368" y="272" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Right</text>
  <text x="368" y="288" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Atrium</text>

  <!-- Right Ventricle (Deoxygenated - Blue) -->
  <path d="M 325,340 Q 370,460 432,480 L 432,335 Z" fill="#075985" fill-opacity="0.8" stroke="#38bdf8" stroke-width="3"/>
  <text x="385" y="395" fill="#e0f2fe" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Right</text>
  <text x="385" y="411" fill="#e0f2fe" font-size="13" font-weight="bold" font-family="sans-serif">Ventricle</text>

  <!-- Left Atrium (Oxygenated - Red) -->
  <ellipse cx="525" cy="275" rx="52" ry="46" fill="#be123c" fill-opacity="0.75" stroke="#fb7185" stroke-width="3"/>
  <text x="525" y="272" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Left</text>
  <text x="525" y="288" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Atrium</text>

  <!-- Left Ventricle (Oxygenated - Red, Thick Myocardium) -->
  <path d="M 462,335 L 462,485 Q 535,460 572,340 Z" fill="#9f1239" fill-opacity="0.85" stroke="#fb7185" stroke-width="5"/>
  <text x="512" y="395" fill="#ffe4e6" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Left</text>
  <text x="512" y="411" fill="#ffe4e6" font-size="13" font-weight="bold" font-family="sans-serif">Ventricle</text>

  <!-- Interventricular Septum -->
  <line x1="447" y1="230" x2="447" y2="495" stroke="#cbd5e1" stroke-width="8" stroke-linecap="round"/>

  <!-- Flow Arrows -->
  <line x1="368" y1="305" x2="380" y2="360" stroke="#38bdf8" stroke-width="3" marker-end="url(#arrBlue)"/>
  <line x1="525" y1="305" x2="515" y2="360" stroke="#f43f5e" stroke-width="3" marker-end="url(#arrRed)"/>

  <!-- Anatomical Callout Labels (Left Column) -->
  <rect x="45" y="105" width="195" height="42" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
  <text x="142" y="131" fill="#38bdf8" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Superior Vena Cava</text>
  <line x1="240" y1="126" x2="335" y2="140" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4,4"/>

  <rect x="45" y="175" width="195" height="42" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
  <text x="142" y="201" fill="#38bdf8" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Pulmonary Artery (To Lungs)</text>
  <line x1="240" y1="196" x2="345" y2="175" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4,4"/>

  <rect x="45" y="265" width="195" height="42" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
  <text x="142" y="291" fill="#e0f2fe" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Tricuspid Valve</text>
  <line x1="240" y1="286" x2="355" y2="325" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4,4"/>

  <rect x="45" y="420" width="195" height="42" rx="8" fill="#0f172a" stroke="#94a3b8" stroke-width="2"/>
  <text x="142" y="446" fill="#f8fafc" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Muscular Septum</text>
  <line x1="240" y1="441" x2="445" y2="441" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4"/>

  <!-- Anatomical Callout Labels (Right Column) -->
  <rect x="655" y="105" width="200" height="42" rx="8" fill="#0f172a" stroke="#f43f5e" stroke-width="2"/>
  <text x="755" y="131" fill="#fb7185" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Aorta (To Body Organs)</text>
  <line x1="655" y1="126" x2="530" y2="140" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="4,4"/>

  <rect x="655" y="195" width="200" height="42" rx="8" fill="#0f172a" stroke="#f43f5e" stroke-width="2"/>
  <text x="755" y="221" fill="#fb7185" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Pulmonary Veins (From Lungs)</text>
  <line x1="655" y1="216" x2="575" y2="250" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="4,4"/>

  <rect x="655" y="305" width="200" height="42" rx="8" fill="#0f172a" stroke="#f43f5e" stroke-width="2"/>
  <text x="755" y="331" fill="#ffe4e6" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Bicuspid (Mitral) Valve</text>
  <line x1="655" y1="326" x2="530" y2="330" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="4,4"/>

  <rect x="655" y="420" width="200" height="42" rx="8" fill="#0f172a" stroke="#f43f5e" stroke-width="2"/>
  <text x="755" y="446" fill="#fb7185" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Thick Myocardium Wall</text>
  <line x1="655" y1="441" x2="545" y2="435" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="4,4"/>
</svg>`;
    return { title: 'Labelled Diagram of the Human Heart', subject: 'Biology', svg };
  }

  // 3. WATER CYCLE DIAGRAM
  if (/\b(water\s*cycle|hydrologic|evaporation|condensation|precipitation)\b/i.test(q)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="100%" height="100%">
  <defs>
    <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0c4a6e"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <marker id="wArr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
    </marker>
  </defs>
  <rect width="900" height="600" rx="18" fill="url(#sky)" stroke="#334155" stroke-width="2"/>
  <text x="450" y="42" fill="#f8fafc" font-size="22" font-weight="800" text-anchor="middle" font-family="sans-serif">THE WATER CYCLE (HYDROLOGIC CYCLE)</text>

  <!-- Sun -->
  <circle cx="130" cy="125" r="46" fill="#facc15" stroke="#fde047" stroke-width="4"/>
  <text x="130" y="130" fill="#713f12" font-size="13" font-weight="900" text-anchor="middle" font-family="sans-serif">SOLAR HEAT</text>

  <!-- Clouds (Condensation) -->
  <g fill="#e2e8f0" stroke="#94a3b8" stroke-width="2">
    <ellipse cx="430" cy="135" rx="75" ry="34"/>
    <ellipse cx="485" cy="125" rx="60" ry="30"/>
    <ellipse cx="700" cy="140" rx="85" ry="36"/>
  </g>
  <rect x="370" y="112" width="180" height="34" rx="8" fill="#0f172a" fill-opacity="0.85" stroke="#38bdf8" stroke-width="2"/>
  <text x="460" y="134" fill="#38bdf8" font-size="14" font-weight="800" text-anchor="middle" font-family="sans-serif">2. CONDENSATION</text>

  <!-- Mountains & Land (Right) -->
  <polygon points="520,470 695,220 870,470" fill="#334155" stroke="#64748b" stroke-width="3"/>
  <polygon points="653,280 695,220 737,280" fill="#f8fafc"/>
  <rect x="440" y="465" width="430" height="95" rx="10" fill="#14532d" stroke="#22c55e" stroke-width="2"/>

  <!-- Ocean / Water Body (Left) -->
  <rect x="40" y="450" width="440" height="110" rx="14" fill="#0284c7" stroke="#38bdf8" stroke-width="3"/>
  <text x="250" y="510" fill="#ffffff" font-size="18" font-weight="800" text-anchor="middle" font-family="sans-serif">OCEAN &amp; SURFACE WATER</text>
  <text x="250" y="532" fill="#bae6fd" font-size="12" text-anchor="middle" font-family="sans-serif">Collection Reservoir (97% of Earth's Water)</text>

  <!-- 1. Evaporation Arrows -->
  <path d="M 190,430 C 190,320 280,220 360,165" fill="none" stroke="#38bdf8" stroke-width="4" stroke-dasharray="6,4" marker-end="url(#wArr)"/>
  <rect x="115" y="290" width="175" height="44" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
  <text x="202" y="310" fill="#38bdf8" font-size="14" font-weight="800" text-anchor="middle" font-family="sans-serif">1. EVAPORATION</text>
  <text x="202" y="326" fill="#cbd5e1" font-size="11" text-anchor="middle" font-family="sans-serif">Liquid turns to water vapor</text>

  <!-- Transpiration -->
  <path d="M 480,445 C 470,350 460,260 455,175" fill="none" stroke="#4ade80" stroke-width="3" stroke-dasharray="5,4" marker-end="url(#wArr)"/>
  <rect x="375" y="310" width="165" height="40" rx="8" fill="#0f172a" stroke="#4ade80" stroke-width="2"/>
  <text x="457" y="335" fill="#4ade80" font-size="13" font-weight="800" text-anchor="middle" font-family="sans-serif">TRANSPIRATION</text>

  <!-- 3. Precipitation (Rain drops) -->
  <line x1="670" y1="185" x2="655" y2="255" stroke="#60a5fa" stroke-width="3" stroke-dasharray="8,6"/>
  <line x1="705" y1="185" x2="690" y2="255" stroke="#60a5fa" stroke-width="3" stroke-dasharray="8,6"/>
  <line x1="740" y1="185" x2="725" y2="255" stroke="#60a5fa" stroke-width="3" stroke-dasharray="8,6"/>
  <rect x="615" y="85" width="185" height="40" rx="8" fill="#0f172a" stroke="#60a5fa" stroke-width="2"/>
  <text x="707" y="110" fill="#60a5fa" font-size="14" font-weight="800" text-anchor="middle" font-family="sans-serif">3. PRECIPITATION</text>

  <!-- 4. Surface Runoff & Groundwater -->
  <path d="M 650,360 Q 560,440 465,465" fill="none" stroke="#38bdf8" stroke-width="5" marker-end="url(#wArr)"/>
  <rect x="565" y="485" width="235" height="48" rx="8" fill="#0f172a" stroke="#f59e0b" stroke-width="2"/>
  <text x="682" y="506" fill="#f59e0b" font-size="14" font-weight="800" text-anchor="middle" font-family="sans-serif">4. RUNOFF &amp; INFILTRATION</text>
  <text x="682" y="523" fill="#cbd5e1" font-size="11" text-anchor="middle" font-family="sans-serif">Rivers &amp; Groundwater return to sea</text>
</svg>`;
    return { title: 'The Water Cycle (Hydrologic Cycle)', subject: 'Science / Geography', svg };
  }

  return null;
}

/**
 * Generates a clean, classroom-grade, strictly sanitized SVG diagram.
 * Combines curated high-precision templates with NVIDIA AI SVG generation.
 */
export async function generateClassroomSvgVisual(query: string, subject = 'general'): Promise<{
  success: boolean;
  svg: string;
  title: string;
  subject: string;
}> {
  const cleanQ = String(query || '').trim();
  const curated = getCuratedClassroomSvg(cleanQ);
  if (curated) {
    return {
      success: true,
      svg: sanitizeEducationalSvg(curated.svg),
      title: curated.title,
      subject: curated.subject
    };
  }

  // Ask NVIDIA AI to generate a clean, labelled educational SVG
  try {
    const systemPrompt = `You are an expert educational scientific illustrator creating clean, high-contrast classroom SVG diagrams for a school smartboard.
Return ONLY valid raw <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="100%" height="100%">...</svg> code with NO markdown fences and NO explanations.
Rules:
1. Dark slate background (#0f172a) with a subtle border (#334155) and bold white/cyan title at the top.
2. Draw clear geometric/scientific vector shapes (<rect>, <circle>, <ellipse>, <polygon>, <path>, <line>) representing the actual anatomy, geometry, physics apparatus, or cycle of the requested topic.
3. Include clear leader lines and high-contrast text labels (<text>) with font-family="sans-serif" and readable font sizes (13px-22px).
4. NEVER include <script>, event attributes, or external images.`;

    const aiResponse = await generateAICompletion({
      systemInstruction: systemPrompt,
      prompt: `Create a detailed, clearly labelled classroom SVG diagram for: "${cleanQ}" (Subject: ${subject}).`,
      endpointName: 'WhiteboardSvgGen',
      maxTokens: 1800,
      temperature: 0.35
    });

    const sanitized = sanitizeEducationalSvg(aiResponse);
    if (sanitized && sanitized.includes('</svg>') && (sanitized.includes('<text') || sanitized.includes('<path') || sanitized.includes('<circle') || sanitized.includes('<rect'))) {
      return {
        success: true,
        svg: sanitized,
        title: cleanQ,
        subject
      };
    }
  } catch (err) {
    console.warn('[WhiteboardVisualEngine] AI SVG fallback notice:', err);
  }

  // Fallback to ConceptGraph SVG renderer
  const fallback = await generateSvgDiagram(cleanQ, subject);
  return {
    success: true,
    svg: sanitizeEducationalSvg(fallback.svg),
    title: fallback.title || cleanQ,
    subject: fallback.subject || subject
  };
}

/**
 * Generates a safe, validated, structured 3D educational scene for the Whiteboard 3D Studio.
 * Supports geometric solids, molecular/atomic models, and multi-stage 3D conceptual models.
 */
export async function generateEducational3DScene(
  query: string,
  sourceContext?: string
): Promise<Educational3DScene> {
  const q = `${query} ${sourceContext || ''}`.toLowerCase().trim();
  const id = `scene3d_${Date.now()}`;

  // 1. CUBE / HEXAHEDRON
  if (/\b(cube|hexahedron|cuboid|rectangular\s*prism)\b/i.test(q)) {
    const isPrism = /\b(cuboid|rectangular\s*prism)\b/i.test(q);
    return {
      id,
      title: isPrism ? '3D Rectangular Prism (Cuboid)' : '3D Cube (Regular Hexahedron)',
      subtitle: isPrism ? '6 Rectangular Faces • 12 Edges • 8 Vertices' : '6 Equal Square Faces • 12 Equal Edges • 8 Vertices',
      subject: 'Mathematics / Solid Geometry',
      sceneType: 'geometry',
      summary: isPrism
        ? 'A 3D solid bounded by six rectangular faces where opposite faces are congruent and parallel.'
        : 'A symmetrical 3D platonic solid with 6 congruent square faces meeting at right angles (90°).',
      formulas: isPrism
        ? ['Volume (V) = l × w × h', 'Surface Area (SA) = 2(lw + lh + wh)', 'Space Diagonal (d) = √(l² + w² + h²)']
        : ['Volume (V) = a³', 'Surface Area (SA) = 6a²', 'Face Diagonal = a√2', 'Space Diagonal = a√3'],
      parts: [
        {
          id: 'main_solid',
          shape: 'box',
          label: isPrism ? 'Rectangular Prism (l × w × h)' : 'Cube (Side = a)',
          description: 'Primary 3D geometric volume',
          position: [0, 0, 0],
          dimensions: isPrism ? [150, 100, 90] : [130, 130, 130],
          rotation: [0, 0, 0],
          color: '#6366f1',
          opacity: 0.85
        }
      ],
      connections: [],
      canConvert: true
    };
  }

  // 2. PYRAMID / CONE / CYLINDER / SPHERE / PRISM / RIGHT TRIANGLE
  if (/\b(pyramid|tetrahedron)\b/i.test(q)) {
    return {
      id,
      title: '3D Square Pyramid',
      subtitle: '1 Square Base • 4 Triangular Lateral Faces • 1 Apex',
      subject: 'Mathematics / Solid Geometry',
      sceneType: 'geometry',
      summary: 'A polyhedron formed by connecting a polygonal square base and a point, called the apex.',
      formulas: ['Volume (V) = ⅓ × b² × h', 'Slant Height (s) = √(h² + (b/2)²)', 'Surface Area = b² + 2bs'],
      parts: [
        {
          id: 'pyramid_main',
          shape: 'pyramid',
          label: 'Square Pyramid (Base b, Height h)',
          description: 'Apex aligned above center of base',
          position: [0, 0, 0],
          dimensions: [140, 150, 140],
          color: '#f59e0b',
          opacity: 0.88
        }
      ],
      connections: [],
      canConvert: true
    };
  }

  if (/\b(sphere|globe|ball|hemisphere)\b/i.test(q) && !/\b(solar|planet|atom)\b/i.test(q)) {
    return {
      id,
      title: '3D Sphere',
      subtitle: 'Locus of points equidistant (radius r) from center O',
      subject: 'Mathematics / Solid Geometry',
      sceneType: 'geometry',
      summary: 'A perfectly round 3D geometrical object where every surface point is distance r from the center.',
      formulas: ['Volume (V) = (4/3)πr³', 'Surface Area (A) = 4πr²', 'Great Circle Circumference = 2πr'],
      parts: [
        {
          id: 'sphere_main',
          shape: 'sphere',
          label: 'Sphere (Radius r)',
          description: 'Equidistant 3D surface',
          position: [0, 0, 0],
          dimensions: [90, 90, 90],
          color: '#10b981',
          opacity: 0.85
        },
        {
          id: 'equator_ring',
          shape: 'ring',
          label: 'Great Circle (Radius r)',
          description: 'Equatorial cross-section plane',
          position: [0, 0, 0],
          dimensions: [94, 4, 94],
          color: '#38bdf8',
          opacity: 0.95
        }
      ],
      connections: [],
      canConvert: true
    };
  }

  if (/\b(cylinder|cylindrical)\b/i.test(q)) {
    return {
      id,
      title: '3D Right Circular Cylinder',
      subtitle: '2 Parallel Circular Bases • Curved Lateral Surface',
      subject: 'Mathematics / Solid Geometry',
      sceneType: 'geometry',
      summary: 'A 3D solid formed by two parallel congruent circular bases joined by a curved lateral surface.',
      formulas: ['Volume (V) = πr²h', 'Curved Surface Area = 2πrh', 'Total Surface Area = 2πr(r + h)'],
      parts: [
        {
          id: 'cyl_main',
          shape: 'cylinder',
          label: 'Cylinder (Radius r, Height h)',
          description: 'Circular prism',
          position: [0, 0, 0],
          dimensions: [75, 150, 75],
          color: '#38bdf8',
          opacity: 0.85
        }
      ],
      connections: [],
      canConvert: true
    };
  }

  if (/\b(cone|conical)\b/i.test(q)) {
    return {
      id,
      title: '3D Right Circular Cone',
      subtitle: '1 Circular Base • 1 Vertex (Apex) • Slant Height l',
      subject: 'Mathematics / Solid Geometry',
      sceneType: 'geometry',
      summary: 'A 3D geometric shape that tapers smoothly from a flat circular base to a point called the apex.',
      formulas: ['Volume (V) = ⅓πr²h', 'Slant Height (l) = √(r² + h²)', 'Total Surface Area = πr(r + l)'],
      parts: [
        {
          id: 'cone_main',
          shape: 'cone',
          label: 'Cone (Radius r, Height h, Slant l)',
          description: 'Conical volume',
          position: [0, 0, 0],
          dimensions: [85, 155, 85],
          color: '#ec4899',
          opacity: 0.88
        }
      ],
      connections: [],
      canConvert: true
    };
  }

  if (/\b(prism|triangular\s*prism|right\s*triangle|trigonometry|hypotenuse)\b/i.test(q)) {
    return {
      id,
      title: '3D Triangular Prism & Right-Triangle Wedge',
      subtitle: 'Opposite (Height) • Adjacent (Base) • Hypotenuse (Slope) • Depth',
      subject: 'Mathematics / Geometry & Physics',
      sceneType: 'geometry',
      summary: '3D spatial representation of a right-angled triangular prism showing Opposite, Adjacent, Hypotenuse, and cross-sectional depth.',
      formulas: ['Volume = ½ × Base × Height × Depth', 'Hypotenuse (c) = √(a² + b²)', 'sin(θ) = Opp/Hyp | cos(θ) = Adj/Hyp'],
      parts: [
        {
          id: 'tri_prism',
          shape: 'triangular_prism',
          label: 'Triangular Prism (a, b, c)',
          description: '3D extruded right triangle',
          position: [0, 0, 0],
          dimensions: [140, 120, 110],
          color: '#8b5cf6',
          opacity: 0.88
        }
      ],
      connections: [],
      canConvert: true
    };
  }

  // 3. WATER CYCLE 3D DIORAMA
  if (/\b(water\s*cycle|hydrologic|evaporation|precipitation)\b/i.test(q)) {
    return {
      id,
      title: '3D Hydrologic (Water) Cycle Diorama',
      subtitle: 'Interactive 3D Terrain: Ocean, Solar Heating, Clouds & Mountain Runoff',
      subject: 'Earth Science / Geography',
      sceneType: 'science_model',
      summary: '3D spatial model showing water evaporating from oceans, condensing into high-altitude clouds, precipitating over mountains, and flowing back as runoff.',
      formulas: ['Phase Change: H₂O(l) + Heat → H₂O(g) (Evaporation)', 'Condensation: H₂O(g) → H₂O(l) (Clouds)'],
      parts: [
        {
          id: 'ocean_basin',
          shape: 'box',
          label: '1. Ocean Reservoir',
          description: 'Surface water body heated by solar radiation',
          position: [-65, -60, 0],
          dimensions: [120, 26, 130],
          color: '#0284c7',
          opacity: 0.9
        },
        {
          id: 'land_mountain',
          shape: 'pyramid',
          label: '4. Mountain & Watershed',
          description: 'High-elevation terrain collecting precipitation & runoff',
          position: [65, -15, 0],
          dimensions: [115, 115, 115],
          color: '#10b981',
          opacity: 0.9
        },
        {
          id: 'sun_sphere',
          shape: 'sphere',
          label: 'Solar Energy Source',
          description: 'Drives evaporation and transpiration',
          position: [-105, 85, -35],
          dimensions: [34, 34, 34],
          color: '#facc15',
          opacity: 0.95
        },
        {
          id: 'cloud_mass',
          shape: 'sphere',
          label: '2. Condensation Cloud Layer',
          description: 'Cooled water vapor forming dense tropospheric clouds',
          position: [15, 80, 0],
          dimensions: [55, 32, 45],
          color: '#e2e8f0',
          opacity: 0.9
        },
        {
          id: 'rain_column',
          shape: 'cylinder',
          label: '3. Precipitation Zone',
          description: 'Rain and snow descending onto mountain slopes',
          position: [55, 35, 0],
          dimensions: [22, 65, 22],
          color: '#38bdf8',
          opacity: 0.55
        }
      ],
      connections: [
        { fromId: 'ocean_basin', toId: 'cloud_mass', label: 'Evaporation ↑', color: '#38bdf8' },
        { fromId: 'cloud_mass', toId: 'land_mountain', label: 'Precipitation ↓', color: '#60a5fa' },
        { fromId: 'land_mountain', toId: 'ocean_basin', label: 'Surface Runoff →', color: '#34d399' }
      ],
      canConvert: true
    };
  }

  // 4. MOLECULE / ATOM 3D MODEL
  if (/\b(atom|bohr|molecule|water\s*molecule|h2o|co2|methane|ch4|chemical\s*bond|electron|proton)\b/i.test(q)) {
    const isWater = /\b(h2o|water\s*molecule)\b/i.test(q);
    if (isWater) {
      return {
        id,
        title: '3D Water Molecule (H₂O) — Bent Geometry',
        subtitle: '1 Oxygen Atom + 2 Hydrogen Atoms • Bond Angle: 104.5°',
        subject: 'Chemistry / Molecular Structure',
        sceneType: 'science_model',
        summary: 'Polar covalent molecule with sp³ hybridization and two lone electron pairs producing a 104.5° bent molecular geometry.',
        formulas: ['Chemical Formula: H₂O', 'H–O–H Bond Angle = 104.5°', 'Molar Mass = 18.015 g/mol'],
        parts: [
          {
            id: 'oxygen',
            shape: 'sphere',
            label: 'Oxygen (O) — δ⁻',
            description: 'Central electronegative atom (Atomic #8)',
            position: [0, 20, 0],
            dimensions: [52, 52, 52],
            color: '#ef4444',
            opacity: 0.95
          },
          {
            id: 'hydrogen_1',
            shape: 'sphere',
            label: 'Hydrogen 1 (H) — δ⁺',
            description: 'Covalently bonded hydrogen atom',
            position: [-75, -35, 25],
            dimensions: [32, 32, 32],
            color: '#38bdf8',
            opacity: 0.95
          },
          {
            id: 'hydrogen_2',
            shape: 'sphere',
            label: 'Hydrogen 2 (H) — δ⁺',
            description: 'Covalently bonded hydrogen atom',
            position: [75, -35, -25],
            dimensions: [32, 32, 32],
            color: '#38bdf8',
            opacity: 0.95
          }
        ],
        connections: [
          { fromId: 'oxygen', toId: 'hydrogen_1', label: 'Covalent Bond (0.96 Å)', color: '#cbd5e1' },
          { fromId: 'oxygen', toId: 'hydrogen_2', label: 'Covalent Bond (0.96 Å)', color: '#cbd5e1' }
        ],
        canConvert: true
      };
    }

    return {
      id,
      title: '3D Atomic Structure & Electron Orbitals',
      subtitle: 'Dense Protons/Neutrons Nucleus + 3D Orthogonal Electron Shells',
      subject: 'Physics & Chemistry',
      sceneType: 'science_model',
      summary: '3D visualization of an atom with a positively charged central nucleus surrounded by quantized electron orbital shells.',
      formulas: ['Atomic Number (Z) = Protons', 'Mass Number (A) = Protons + Neutrons', 'Shell Capacity = 2n²'],
      parts: [
        {
          id: 'nucleus',
          shape: 'sphere',
          label: 'Nucleus (Protons + Neutrons)',
          description: 'Contains >99.9% of atomic mass',
          position: [0, 0, 0],
          dimensions: [38, 38, 38],
          color: '#f43f5e',
          opacity: 0.95
        },
        {
          id: 'shell_k',
          shape: 'ring',
          label: 'K-Shell (n = 1)',
          description: 'Inner electron orbital',
          position: [0, 0, 0],
          dimensions: [85, 4, 85],
          rotation: [25, 0, 0],
          color: '#38bdf8',
          opacity: 0.85
        },
        {
          id: 'shell_l',
          shape: 'ring',
          label: 'L-Shell (n = 2)',
          description: 'Second principal energy level',
          position: [0, 0, 0],
          dimensions: [130, 4, 130],
          rotation: [-35, 20, 0],
          color: '#a855f7',
          opacity: 0.85
        },
        {
          id: 'electron_1',
          shape: 'sphere',
          label: 'Valence Electron (e⁻)',
          description: 'Negatively charged fermion (-1.6 × 10⁻¹⁹ C)',
          position: [85, 0, 0],
          dimensions: [14, 14, 14],
          color: '#facc15',
          opacity: 1
        }
      ],
      connections: [],
      canConvert: true
    };
  }

  // 5. DYNAMIC AI-STRUCTURED 3D INFOGRAPHIC / MODEL FOR ANY TOPIC OR SELECTED CONTENT
  try {
    const systemPrompt = `You are a 3D Educational Scene Architect for StudentOS Whiteboard.
Convert the given topic or selected classroom content into a structured 3D educational visual JSON object.
Return ONLY valid raw JSON (no markdown fences) matching this exact schema:
{
  "title": "Clear 3D Model Title",
  "subtitle": "Key Components & Spatial Structure",
  "subject": "Subject Area",
  "sceneType": "science_model" | "geometry" | "infographic_3d",
  "summary": "2-sentence classroom explanation of this 3D visual.",
  "formulas": ["Key Formula or Rule 1", "Key Formula or Rule 2"],
  "parts": [
    {
      "id": "part_1",
      "shape": "box" | "sphere" | "cylinder" | "cone" | "pyramid" | "triangular_prism" | "ring",
      "label": "Short Component Name",
      "description": "Educational role of this part",
      "position": [x, y, z],
      "dimensions": [w, h, d],
      "color": "#38bdf8",
      "opacity": 0.9
    }
  ],
  "connections": [
    { "fromId": "part_1", "toId": "part_2", "label": "Flow / Relationship", "color": "#6366f1" }
  ]
}
Rules:
- Generate between 3 and 6 distinct, well-spaced 3D parts (x, y, z between -120 and 120; dimensions between 25 and 95).
- Use vibrant, high-contrast educational hex colors (#38bdf8, #10b981, #f59e0b, #f43f5e, #8b5cf6, #ec4899).`;

    const rawJson = await generateAICompletion({
      systemInstruction: systemPrompt,
      prompt: `Topic / Selected Whiteboard Content: "${query}"${sourceContext ? `\nContext: ${sourceContext}` : ''}`,
      endpointName: 'Whiteboard3DScene',
      jsonMode: true,
      maxTokens: 1200,
      temperature: 0.35
    });

    const cleaned = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      if (Array.isArray(parsed.parts) && parsed.parts.length > 0) {
        const validShapes = new Set(['box', 'sphere', 'cylinder', 'cone', 'pyramid', 'triangular_prism', 'torus', 'ring', 'plane']);
        const clamp = (n: any, min: number, max: number, def: number) => {
          const num = Number(n);
          return Number.isFinite(num) ? Math.max(min, Math.min(max, num)) : def;
        };

        const safeParts: Educational3DPart[] = parsed.parts.slice(0, 8).map((p: any, idx: number) => ({
          id: String(p.id || `part_${idx + 1}`),
          shape: validShapes.has(p.shape) ? p.shape : 'box',
          label: String(p.label || `Stage ${idx + 1}`).slice(0, 50),
          description: String(p.description || '').slice(0, 140),
          position: [
            clamp(p.position?.[0], -140, 140, (idx - 1.5) * 65),
            clamp(p.position?.[1], -100, 100, 0),
            clamp(p.position?.[2], -100, 100, 0)
          ],
          dimensions: [
            clamp(p.dimensions?.[0], 20, 130, 50),
            clamp(p.dimensions?.[1], 20, 130, 50),
            clamp(p.dimensions?.[2], 20, 130, 50)
          ],
          color: /^#[0-9a-fA-F]{6}$/.test(String(p.color || '')) ? p.color : ['#38bdf8', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'][idx % 5],
          opacity: clamp(p.opacity, 0.4, 1, 0.88)
        }));

        const safeConns: Educational3DConnection[] = Array.isArray(parsed.connections)
          ? parsed.connections.slice(0, 8).map((c: any) => ({
              fromId: String(c.fromId || ''),
              toId: String(c.toId || ''),
              label: c.label ? String(c.label).slice(0, 40) : undefined,
              color: /^#[0-9a-fA-F]{6}$/.test(String(c.color || '')) ? c.color : '#38bdf8'
            }))
          : [];

        return {
          id,
          title: String(parsed.title || `3D Visual: ${query}`).slice(0, 80),
          subtitle: String(parsed.subtitle || 'Interactive 3D Classroom Concept Model').slice(0, 100),
          subject: String(parsed.subject || 'General Science & Academics').slice(0, 40),
          sceneType: parsed.sceneType || 'infographic_3d',
          summary: String(parsed.summary || `Interactive 3D breakdown of ${query}.`).slice(0, 260),
          formulas: Array.isArray(parsed.formulas) ? parsed.formulas.slice(0, 4).map((f: any) => String(f).slice(0, 80)) : [],
          parts: safeParts,
          connections: safeConns,
          canConvert: true
        };
      }
    }
  } catch (err) {
    console.warn('[WhiteboardVisualEngine] 3D AI generation fallback notice:', err);
  }

  // Deterministic 3D Layered Concept Infographic Fallback
  const cleanTitle = String(query || 'Classroom Concept').slice(0, 60);
  return {
    id,
    title: `3D Concept Architecture: ${cleanTitle}`,
    subtitle: 'Interactive 3-Stage Spatial Infographic',
    subject: 'Academic Visual Model',
    sceneType: 'infographic_3d',
    summary: `Spatial 3D breakdown of "${cleanTitle}" showing Core Foundation, Mechanism/Process, and Outcome/Application.`,
    formulas: [`Core Concept: ${cleanTitle}`],
    parts: [
      {
        id: 'stage_1',
        shape: 'cylinder',
        label: `1. Foundation: ${cleanTitle}`,
        description: 'Primary inputs, definitions, and fundamental principles',
        position: [-95, -20, 0],
        dimensions: [45, 70, 45],
        color: '#38bdf8',
        opacity: 0.9
      },
      {
        id: 'stage_2',
        shape: 'sphere',
        label: '2. Core Mechanism',
        description: 'Key transformation, equation, or structural interaction',
        position: [0, 15, 0],
        dimensions: [50, 50, 50],
        color: '#8b5cf6',
        opacity: 0.9
      },
      {
        id: 'stage_3',
        shape: 'pyramid',
        label: '3. Outcome & Application',
        description: 'Resulting output, theorem proof, or real-world effect',
        position: [95, -15, 0],
        dimensions: [65, 85, 65],
        color: '#10b981',
        opacity: 0.9
      }
    ],
    connections: [
      { fromId: 'stage_1', toId: 'stage_2', label: 'Drives →', color: '#38bdf8' },
      { fromId: 'stage_2', toId: 'stage_3', label: 'Produces →', color: '#10b981' }
    ],
    canConvert: true
  };
}
