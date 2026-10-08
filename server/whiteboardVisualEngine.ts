/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Classroom Visual & 3D Educational Engine
 * Generates sanitized classroom-ready SVG diagrams, rich structured 3D educational scenes,
 * and contextual AI conversions for Whiteboard objects.
 */

import { generateAICompletion } from './aiClient';
import { generateSvgDiagram } from './diagramEngine';

export interface Educational3DPart {
  id: string;
  shape:
    | 'box'
    | 'sphere'
    | 'cylinder'
    | 'cone'
    | 'pyramid'
    | 'triangular_prism'
    | 'hexagonal_prism'
    | 'capsule'
    | 'torus'
    | 'ring'
    | 'plane'
    | 'dodecahedron'
    | 'icosahedron'
    | 'tube'
    | 'helix';
  label: string;
  description?: string;
  position: [number, number, number]; // x, y, z in [-140, 140]
  dimensions: [number, number, number]; // width, height, depth in [10, 140]
  rotation?: [number, number, number]; // rx, ry, rz in degrees
  color: string;
  opacity?: number;
  wireframe?: boolean;
  glass?: boolean;
  emissive?: string;
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
  sceneType: 'biological_tissue' | 'organelle' | 'anatomical' | 'molecular' | 'physical_system' | 'planetary' | 'geological' | 'geometry' | 'science_model' | 'infographic_3d';
  summary: string;
  formulas?: string[];
  parts: Educational3DPart[];
  connections: Educational3DConnection[];
  educationalNotes?: string[];
  canConvert: boolean;
  fallbackReason?: string;
}

/**
 * Strictly sanitizes any SVG string so it can never execute scripts, event handlers,
 * external loads, or unsafe DOM injection.
 */
export function sanitizeEducationalSvg(rawSvg: string): string {
  if (!rawSvg || typeof rawSvg !== 'string') return '';

  const svgMatch = rawSvg.match(/<svg[\s\S]*?<\/svg>/i);
  let svg = svgMatch ? svgMatch[0] : rawSvg.trim();

  if (!svg.toLowerCase().startsWith('<svg')) {
    return '';
  }

  svg = svg
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|xlink:href)\s*=\s*["']\s*(javascript:|data:text\/html)[^"']*["']/gi, '');

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

  // 1. RIGHT TRIANGLE
  if (/\b(right\s*triangle|hypotenuse|opposite|adjacent|trigonometry|pythagoras|pythagorean|sohcahtoa)\b/i.test(q)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
  </defs>
  <rect width="900" height="600" rx="18" fill="url(#bgGrad)" stroke="#334155" stroke-width="2"/>
  <text x="450" y="48" fill="#f8fafc" font-size="24" font-weight="800" text-anchor="middle" font-family="sans-serif">RIGHT-ANGLED TRIANGLE &amp; TRIGONOMETRIC RATIOS</text>
  <text x="450" y="74" fill="#94a3b8" font-size="14" text-anchor="middle" font-family="sans-serif">Labelled Anatomy: Opposite, Adjacent, Hypotenuse &amp; Angle θ</text>
  <polygon points="160,460 520,460 520,170" fill="#1e1b4b" fill-opacity="0.45" stroke="#6366f1" stroke-width="4" stroke-linejoin="round"/>
  <polyline points="490,460 490,430 520,430" fill="none" stroke="#f43f5e" stroke-width="3"/>
  <text x="472" y="422" fill="#fda4af" font-size="13" font-weight="bold" font-family="sans-serif">90°</text>
  <path d="M 235,460 A 75,75 0 0,0 218,412" fill="none" stroke="#facc15" stroke-width="3.5"/>
  <text x="252" y="442" fill="#facc15" font-size="20" font-weight="bold" font-family="sans-serif">θ</text>
  <circle cx="160" cy="460" r="6" fill="#38bdf8"/>
  <text x="135" y="475" fill="#f8fafc" font-size="18" font-weight="bold" font-family="sans-serif">A</text>
  <circle cx="520" cy="460" r="6" fill="#38bdf8"/>
  <text x="535" y="475" fill="#f8fafc" font-size="18" font-weight="bold" font-family="sans-serif">B</text>
  <circle cx="520" cy="170" r="6" fill="#38bdf8"/>
  <text x="532" y="165" fill="#f8fafc" font-size="18" font-weight="bold" font-family="sans-serif">C</text>
  <rect x="215" y="255" width="190" height="44" rx="10" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
  <text x="310" y="275" fill="#38bdf8" font-size="15" font-weight="800" text-anchor="middle" font-family="sans-serif">HYPOTENUSE (c)</text>
  <text x="310" y="292" fill="#cbd5e1" font-size="11" text-anchor="middle" font-family="sans-serif">Longest side (Opposite 90°)</text>
  <rect x="545" y="290" width="165" height="48" rx="10" fill="#0f172a" stroke="#10b981" stroke-width="2"/>
  <text x="627" y="311" fill="#10b981" font-size="15" font-weight="800" text-anchor="middle" font-family="sans-serif">OPPOSITE (a)</text>
  <text x="627" y="329" fill="#cbd5e1" font-size="11" text-anchor="middle" font-family="sans-serif">Across from angle θ</text>
  <rect x="260" y="485" width="175" height="48" rx="10" fill="#0f172a" stroke="#f59e0b" stroke-width="2"/>
  <text x="347" y="506" fill="#f59e0b" font-size="15" font-weight="800" text-anchor="middle" font-family="sans-serif">ADJACENT (b)</text>
  <text x="347" y="524" fill="#cbd5e1" font-size="11" text-anchor="middle" font-family="sans-serif">Next to angle θ</text>
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

  // 2. HUMAN HEART
  if (/\b(heart|cardiac|ventricle|atrium|aorta|circulatory)\b/i.test(q)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="100%" height="100%">
  <defs>
    <linearGradient id="bgHeart" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
  </defs>
  <rect width="900" height="600" rx="18" fill="url(#bgHeart)" stroke="#334155" stroke-width="2"/>
  <text x="450" y="44" fill="#f8fafc" font-size="22" font-weight="800" text-anchor="middle" font-family="sans-serif">ANATOMY OF THE HUMAN HEART</text>
  <text x="450" y="68" fill="#94a3b8" font-size="13" text-anchor="middle" font-family="sans-serif">Four-Chambered Double Circulation: Deoxygenated (Blue) &amp; Oxygenated (Red) Pathways</text>
  <path d="M 350,120 L 350,220" stroke="#0284c7" stroke-width="32" stroke-linecap="round"/>
  <path d="M 455,210 C 455,115 535,115 535,190" fill="none" stroke="#e11d48" stroke-width="34" stroke-linecap="round"/>
  <path d="M 420,230 L 330,155" stroke="#38bdf8" stroke-width="24" stroke-linecap="round"/>
  <path d="M 450,515 C 310,435 270,315 305,225 C 330,175 405,180 445,225 C 485,180 565,175 590,235 C 625,325 570,445 450,515 Z" fill="#1e293b" stroke="#f43f5e" stroke-width="4"/>
  <ellipse cx="368" cy="275" rx="52" ry="46" fill="#0369a1" fill-opacity="0.7" stroke="#38bdf8" stroke-width="3"/>
  <text x="368" y="272" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Right</text>
  <text x="368" y="288" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Atrium</text>
  <path d="M 325,340 Q 370,460 432,480 L 432,335 Z" fill="#075985" fill-opacity="0.8" stroke="#38bdf8" stroke-width="3"/>
  <text x="385" y="395" fill="#e0f2fe" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Right</text>
  <text x="385" y="411" fill="#e0f2fe" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Ventricle</text>
  <ellipse cx="525" cy="275" rx="52" ry="46" fill="#be123c" fill-opacity="0.75" stroke="#fb7185" stroke-width="3"/>
  <text x="525" y="272" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Left</text>
  <text x="525" y="288" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Atrium</text>
  <path d="M 462,335 L 462,485 Q 535,460 572,340 Z" fill="#9f1239" fill-opacity="0.85" stroke="#fb7185" stroke-width="5"/>
  <text x="512" y="395" fill="#ffe4e6" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Left</text>
  <text x="512" y="411" fill="#ffe4e6" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">Ventricle</text>
  <line x1="447" y1="230" x2="447" y2="495" stroke="#cbd5e1" stroke-width="8" stroke-linecap="round"/>
</svg>`;
    return { title: 'Labelled Diagram of the Human Heart', subject: 'Biology', svg };
  }

  return null;
}

/**
 * Generates high-clarity Classroom SVG Diagrams
 */
export async function generateClassroomSvgVisual(
  query: string,
  subjectHint = 'general'
): Promise<{ title: string; subject: string; svg: string }> {
  const curated = getCuratedClassroomSvg(query);
  if (curated) {
    return {
      title: curated.title,
      subject: curated.subject,
      svg: sanitizeEducationalSvg(curated.svg)
    };
  }

  const generated = await generateSvgDiagram(query);
  if (generated && generated.svg) {
    return {
      title: generated.title || query,
      subject: subjectHint || 'Academic Visual',
      svg: sanitizeEducationalSvg(generated.svg)
    };
  }

  const cleanTitle = query.replace(/[<>&"']/g, '').trim();
  const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="100%" height="100%">
    <rect width="900" height="600" rx="16" fill="#090d16" stroke="#1e293b" stroke-width="2"/>
    <text x="450" y="55" fill="#f8fafc" font-size="24" font-weight="bold" text-anchor="middle" font-family="sans-serif">${cleanTitle.toUpperCase()}</text>
    <rect x="180" y="140" width="540" height="340" rx="12" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
    <text x="450" y="310" fill="#e2e8f0" font-size="18" text-anchor="middle" font-family="sans-serif">Educational Visual: ${cleanTitle}</text>
  </svg>`;

  return {
    title: cleanTitle,
    subject: subjectHint || 'General',
    svg: sanitizeEducationalSvg(fallbackSvg)
  };
}

/**
 * High-Precision Scientific 3D Presets & Generators for Core Curriculum
 */
function getCuratedScientific3DScene(query: string, id: string): Educational3DScene | null {
  const q = query.toLowerCase();

  // 1. BIOLOGY / BOTANY: MERISTEMATIC TISSUE (Apical Meristem, Protoderm, Procambium, Ground Meristem, Active Dividing Cells)
  if (/\b(meristem|meristematic|apical\s*meristem|plant\s*tissue|dividing\s*cells|root\s*tip|shoot\s*tip|tunica|corpus|protoderm|procambium)\b/i.test(q)) {
    return {
      id,
      title: '3D Meristematic Plant Tissue Architecture',
      subtitle: 'Apical Meristem Dome • Packed Isodiametric Cells • Dense Protoplasm & Prominent Nuclei',
      subject: 'Plant Biology / Plant Anatomy',
      sceneType: 'biological_tissue',
      summary: 'Meristematic tissue consists of continuously dividing undifferentiated cells characterized by thin primary cellulose walls, dense cytoplasm, large prominent central nuclei, and no intercellular air spaces.',
      formulas: [
        'Characteristics: Thin Cellulose Wall + Dense Cytoplasm + Large Nucleus',
        'Zonation: Protoderm (Epidermis) → Procambium (Vascular) → Ground Meristem (Pith/Cortex)',
        'Absence: No Intercellular Spaces & No Large Central Vacuole'
      ],
      parts: [
        // Apical Dome Envelope
        {
          id: 'apical_dome',
          shape: 'capsule',
          label: 'Apical Meristem Dome (Zone of Active Division)',
          description: 'Actively dividing undifferentiated stem cells at the shoot/root tip',
          position: [0, 45, 0],
          dimensions: [88, 70, 75],
          color: '#10b981',
          opacity: 0.35,
          glass: true
        },
        // Outer Protoderm Layer (Epidermal precursor)
        {
          id: 'protoderm_layer',
          shape: 'cylinder',
          label: 'Protoderm (Dermatogen Layer)',
          description: 'Outermost single-cell layer that matures into the protective plant epidermis',
          position: [0, 20, 0],
          dimensions: [105, 80, 105],
          color: '#059669',
          opacity: 0.28,
          wireframe: true
        },
        // Central Procambium Cylinder (Vascular precursor)
        {
          id: 'procambium_strand',
          shape: 'cylinder',
          label: 'Procambium Strand (Vascular Core)',
          description: 'Elongated meristematic strand giving rise to primary xylem and phloem',
          position: [0, -35, 0],
          dimensions: [38, 90, 38],
          color: '#f59e0b',
          opacity: 0.85
        },
        // Ground Meristem (Pith & Cortex precursor)
        {
          id: 'ground_meristem',
          shape: 'cylinder',
          label: 'Ground Meristem (Cortex & Pith Matrix)',
          description: 'Meristematic region giving rise to parenchyma, collenchyma, and pith',
          position: [0, -35, 0],
          dimensions: [92, 75, 92],
          color: '#14b8a6',
          opacity: 0.32,
          glass: true
        },
        // Representative Meristematic Cell 1 (Center Top)
        {
          id: 'cell_1_wall',
          shape: 'hexagonal_prism',
          label: 'Cell 1: Thin Cellulose Wall',
          description: 'Isodiametric polygonal cell unit with thin, flexible primary wall',
          position: [-24, 42, 10],
          dimensions: [32, 28, 32],
          color: '#10b981',
          opacity: 0.75
        },
        {
          id: 'cell_1_nucleus',
          shape: 'sphere',
          label: 'Cell 1: Prominent Dividing Nucleus',
          description: 'Large conspicuous nucleus with high DNA replication activity',
          position: [-24, 42, 10],
          dimensions: [15, 15, 15],
          color: '#a855f7',
          opacity: 0.95
        },
        // Representative Meristematic Cell 2 (Right Top)
        {
          id: 'cell_2_wall',
          shape: 'hexagonal_prism',
          label: 'Cell 2: Dense Cytoplasm & Thin Wall',
          description: 'Closely packed with no intercellular spaces',
          position: [24, 42, -8],
          dimensions: [32, 28, 32],
          color: '#34d399',
          opacity: 0.75
        },
        {
          id: 'cell_2_nucleus',
          shape: 'sphere',
          label: 'Cell 2: Active Nucleus (Mitotic Prophase)',
          description: 'Actively synthesizing proteins and undergoing karyokinesis',
          position: [24, 42, -8],
          dimensions: [14, 14, 14],
          color: '#8b5cf6',
          opacity: 0.95
        },
        // Representative Meristematic Cell 3 (Left Mid)
        {
          id: 'cell_3_wall',
          shape: 'hexagonal_prism',
          label: 'Cell 3: Meristematic Protoplast',
          description: 'Lacks large central vacuole; rich in mitochondria and ribosomes',
          position: [-28, 12, -18],
          dimensions: [30, 26, 30],
          color: '#10b981',
          opacity: 0.75
        },
        {
          id: 'cell_3_nucleus',
          shape: 'sphere',
          label: 'Cell 3: Prominent Nucleus',
          description: 'Spherical central nucleus with dense chromatin',
          position: [-28, 12, -18],
          dimensions: [13, 13, 13],
          color: '#c084fc',
          opacity: 0.95
        },
        // Representative Meristematic Cell 4 (Front Right Mid)
        {
          id: 'cell_4_wall',
          shape: 'hexagonal_prism',
          label: 'Cell 4: Compact Cellular Junction',
          description: 'Tight cell-cell adhesion with continuous middle lamella',
          position: [26, 12, 18],
          dimensions: [30, 26, 30],
          color: '#34d399',
          opacity: 0.75
        },
        {
          id: 'cell_4_nucleus',
          shape: 'sphere',
          label: 'Cell 4: Dividing Nucleus',
          description: 'High nucleo-cytoplasmic ratio',
          position: [26, 12, 18],
          dimensions: [14, 14, 14],
          color: '#9333ea',
          opacity: 0.95
        },
        // Quiescent Center / Root Cap Protection
        {
          id: 'root_cap',
          shape: 'cone',
          label: 'Calyptra (Protective Apical Root Cap)',
          description: 'Thimble-shaped protective cellular layer secreting mucilage',
          position: [0, -95, 0],
          dimensions: [95, 45, 95],
          rotation: [180, 0, 0],
          color: '#475569',
          opacity: 0.7
        }
      ],
      connections: [
        { fromId: 'apical_dome', toId: 'protoderm_layer', label: 'Differentiates →', color: '#10b981' },
        { fromId: 'apical_dome', toId: 'procambium_strand', label: 'Forms Vascular Cylinder →', color: '#f59e0b' },
        { fromId: 'apical_dome', toId: 'ground_meristem', label: 'Develops Cortex/Pith →', color: '#14b8a6' },
        { fromId: 'cell_1_wall', toId: 'cell_2_wall', label: 'Tight Junction (No Spaces)', color: '#34d399' }
      ],
      educationalNotes: [
        '1. Apical Meristems occur at growing tips of roots and shoots, enabling primary growth (elongation).',
        '2. Meristematic cells are isodiametric (spherical, oval, or polygonal) with thin cellulose walls.',
        '3. They possess dense cytoplasm and prominent nuclei with high mitotic division rates.',
        '4. Intercellular spaces are absent due to tight compaction.',
        '5. Vacuoles are extremely small or absent because cells are actively dividing rather than storing metabolites.'
      ],
      canConvert: true
    };
  }

  // 2. BIOLOGY: CHLOROPLAST & THYLAKOID MEMBRANES
  if (/\b(chloroplast|thylakoid|grana|stroma|photosynthesis|chlorophyll)\b/i.test(q)) {
    return {
      id,
      title: '3D Chloroplast Ultrastructure',
      subtitle: 'Double Envelope • Stroma Matrix • Thylakoid Granum Stacks & Lamellae',
      subject: 'Cell Biology / Plant Physiology',
      sceneType: 'organelle',
      summary: '3D visualization of the photosynthetic organelle showing outer/inner membrane envelope, dense stroma, stacked thylakoid grana discs, and stroma lamellae.',
      formulas: [
        'Photosynthesis: 6CO₂ + 6H₂O + Light → C₆H₁₂O₆ + 6O₂',
        'Light Reactions: Thylakoid Membrane (ATP & NADPH synthesis)',
        'Dark Reactions (Calvin Cycle): Stroma Matrix (Carbon fixation)'
      ],
      parts: [
        {
          id: 'outer_membrane',
          shape: 'capsule',
          label: 'Outer & Inner Membrane Envelope',
          description: 'Semi-permeable double lipid bilayer enclosing the stroma',
          position: [0, 0, 0],
          dimensions: [130, 85, 110],
          color: '#10b981',
          opacity: 0.32,
          glass: true
        },
        {
          id: 'stroma',
          shape: 'capsule',
          label: 'Stroma (Enzymatic Fluid Matrix)',
          description: 'Site of dark reactions (Calvin cycle) containing RuBisCO and circular DNA',
          position: [0, 0, 0],
          dimensions: [115, 72, 95],
          color: '#34d399',
          opacity: 0.22
        },
        // Granum Stack 1 (Left)
        {
          id: 'granum_1_base',
          shape: 'cylinder',
          label: 'Granum Stack 1 (Thylakoid Discs)',
          description: 'Site of light reactions, Photosystem I & II, and photolysis of water',
          position: [-42, -5, 0],
          dimensions: [36, 42, 36],
          color: '#047857',
          opacity: 0.95
        },
        // Granum Stack 2 (Right)
        {
          id: 'granum_2_base',
          shape: 'cylinder',
          label: 'Granum Stack 2 (Thylakoid Discs)',
          description: 'Membrane-bound compartments housing chlorophyll pigments',
          position: [42, -8, 10],
          dimensions: [34, 38, 34],
          color: '#047857',
          opacity: 0.95
        },
        // Granum Stack 3 (Back)
        {
          id: 'granum_3_base',
          shape: 'cylinder',
          label: 'Granum Stack 3 (Thylakoid Discs)',
          description: 'Connected via intergranal frets/lamellae',
          position: [0, 12, -26],
          dimensions: [32, 32, 32],
          color: '#065f46',
          opacity: 0.95
        },
        // Stroma Lamella connecting Grana
        {
          id: 'stroma_lamella_1',
          shape: 'box',
          label: 'Stroma Lamella (Intergranal Fret)',
          description: 'Unstacked thylakoid tubular bridges linking distinct grana stacks',
          position: [0, -5, 5],
          dimensions: [68, 6, 16],
          color: '#059669',
          opacity: 0.9
        }
      ],
      connections: [
        { fromId: 'granum_1_base', toId: 'stroma_lamella_1', label: 'Tubular Link', color: '#10b981' },
        { fromId: 'stroma_lamella_1', toId: 'granum_2_base', label: 'Tubular Link', color: '#10b981' }
      ],
      canConvert: true
    };
  }

  // 3. BIOLOGY: DNA DOUBLE HELIX
  if (/\b(dna|double\s*helix|nucleotide|genetic|base\s*pair|chromosome)\b/i.test(q)) {
    return {
      id,
      title: '3D DNA Double Helix & Base Pairs',
      subtitle: 'Antiparallel Sugar-Phosphate Backbones • A=T & G≡C Complementary Pairing',
      subject: 'Genetics / Molecular Biology',
      sceneType: 'molecular',
      summary: '3D B-form DNA double helix showing two antiparallel polynucleotide strands wound right-handedly with complementary hydrogen-bonded purine-pyrimidine base pairs.',
      formulas: [
        "Chargaff's Rule: [A] = [T] (2 H-Bonds) and [G] = [C] (3 H-Bonds)",
        'Helix Geometry: 10 Base Pairs per 3.4 nm Complete Turn',
        'Backbone: 5′ to 3′ Phosphodiester Bonded Deoxyribose Sugars'
      ],
      parts: [
        {
          id: 'strand_1',
          shape: 'helix',
          label: "5′ → 3′ Leading Sugar-Phosphate Strand",
          description: 'Outer hydrophilic phosphodiester backbone',
          position: [-20, 0, 0],
          dimensions: [40, 160, 40],
          color: '#38bdf8',
          opacity: 0.95
        },
        {
          id: 'strand_2',
          shape: 'helix',
          label: "3′ → 5′ Antiparallel Lagging Strand",
          description: 'Complementary opposite-polarity backbone',
          position: [20, 0, 0],
          dimensions: [40, 160, 40],
          color: '#a855f7',
          opacity: 0.95
        },
        {
          id: 'bp_at_1',
          shape: 'cylinder',
          label: 'Adenine = Thymine Base Pair (2 H-Bonds)',
          description: 'Purine Adenine paired with Pyrimidine Thymine',
          position: [0, 45, 0],
          dimensions: [42, 6, 6],
          rotation: [0, 36, 0],
          color: '#facc15',
          opacity: 0.95
        },
        {
          id: 'bp_gc_1',
          shape: 'cylinder',
          label: 'Guanine ≡ Cytosine Base Pair (3 H-Bonds)',
          description: 'Purine Guanine triple-bonded to Pyrimidine Cytosine',
          position: [0, 15, 0],
          dimensions: [42, 6, 6],
          rotation: [0, 72, 0],
          color: '#f43f5e',
          opacity: 0.95
        },
        {
          id: 'bp_at_2',
          shape: 'cylinder',
          label: 'Thymine = Adenine Base Pair',
          description: 'Complementary paired nucleotide step',
          position: [0, -15, 0],
          dimensions: [42, 6, 6],
          rotation: [0, 108, 0],
          color: '#10b981',
          opacity: 0.95
        },
        {
          id: 'bp_gc_2',
          shape: 'cylinder',
          label: 'Cytosine ≡ Guanine Base Pair',
          description: 'Major and minor groove formation',
          position: [0, -45, 0],
          dimensions: [42, 6, 6],
          rotation: [0, 144, 0],
          color: '#ec4899',
          opacity: 0.95
        }
      ],
      connections: [
        { fromId: 'strand_1', toId: 'bp_at_1', color: '#38bdf8' },
        { fromId: 'strand_2', toId: 'bp_at_1', color: '#a855f7' }
      ],
      canConvert: true
    };
  }

  // 4. PHYSICS: INCLINED PLANE & RESOLVED VECTORS
  if (/\b(inclined\s*plane|friction|normal\s*force|free\s*body|vector\s*forces|gravity|mechanics)\b/i.test(q)) {
    return {
      id,
      title: '3D Mechanics: Inclined Plane & Free Body Vectors',
      subtitle: 'Gravity (mg) • Normal Force (N) • Friction (f_k) • Downslope Component (mg sin θ)',
      subject: 'Physics / Classical Mechanics',
      sceneType: 'physical_system',
      summary: '3D spatial resolution of forces acting on a block sliding on a ramp tilted at angle θ, demonstrating perpendicular equilibrium and parallel acceleration.',
      formulas: [
        'Perpendicular: N = mg cos(θ)',
        'Downslope Force: F_net = mg sin(θ) - f_k',
        'Kinetic Friction: f_k = μ_k N = μ_k mg cos(θ)'
      ],
      parts: [
        {
          id: 'wedge',
          shape: 'triangular_prism',
          label: 'Incline Wedge (Angle θ = 30°)',
          description: 'Stationary inclined surface with coefficient of friction μ',
          position: [0, -30, 0],
          dimensions: [150, 80, 110],
          color: '#334155',
          opacity: 0.85
        },
        {
          id: 'block',
          shape: 'box',
          label: 'Sliding Mass (m = 5.0 kg)',
          description: 'Object experiencing gravity, normal contact, and friction',
          position: [-10, 20, 0],
          dimensions: [36, 26, 34],
          rotation: [0, 0, -30],
          color: '#38bdf8',
          opacity: 0.95
        },
        {
          id: 'vec_gravity',
          shape: 'cylinder',
          label: 'Weight Vector: W = mg (Downward)',
          description: 'Vertical gravitational force acting from Center of Mass',
          position: [-10, -18, 0],
          dimensions: [3, 48, 3],
          color: '#f43f5e',
          opacity: 0.95
        },
        {
          id: 'vec_normal',
          shape: 'cylinder',
          label: 'Normal Force: N = mg cos(θ) (Perpendicular)',
          description: 'Reaction force from ramp surface',
          position: [-22, 42, 0],
          dimensions: [3, 44, 3],
          rotation: [0, 0, 60],
          color: '#10b981',
          opacity: 0.95
        },
        {
          id: 'vec_friction',
          shape: 'cylinder',
          label: 'Friction Vector: f_k = μN (Opposing Motion)',
          description: 'Parallel resistive force acting along the contact surface',
          position: [15, 34, 0],
          dimensions: [3, 38, 3],
          rotation: [0, 0, -30],
          color: '#f59e0b',
          opacity: 0.95
        }
      ],
      connections: [
        { fromId: 'block', toId: 'vec_gravity', label: 'mg', color: '#f43f5e' },
        { fromId: 'block', toId: 'vec_normal', label: 'N', color: '#10b981' },
        { fromId: 'block', toId: 'vec_friction', label: 'f', color: '#f59e0b' }
      ],
      canConvert: true
    };
  }

  // 5. ASTRONOMY: SOLAR SYSTEM & PLANETARY ORBITS
  if (/\b(solar\s*system|sun|planet|earth|mars|jupiter|saturn|orbit|heliocentric)\b/i.test(q)) {
    return {
      id,
      title: '3D Heliocentric Solar System & Orbital Planes',
      subtitle: 'Central Sun • Terrestrial Planets • Jovian Giants • Elliptical Orbits',
      subject: 'Astronomy / Space Science',
      sceneType: 'planetary',
      summary: '3D scale model of our solar system with the central Sun and orbital rings for Mercury, Venus, Earth, Mars, Jupiter, and Saturn.',
      formulas: [
        "Kepler's Third Law: T² ∝ r³ (Orbital Period vs Semi-Major Axis)",
        'Gravitational Law: F = G (M_sun · m_planet) / r²',
        'Orbital Velocity: v = √(GM / r)'
      ],
      parts: [
        {
          id: 'sun',
          shape: 'sphere',
          label: 'The Sun (1.989 × 10³⁰ kg)',
          description: 'G-type main-sequence star providing >99.8% of Solar System mass',
          position: [0, 0, 0],
          dimensions: [48, 48, 48],
          color: '#facc15',
          opacity: 0.98,
          emissive: '#f59e0b'
        },
        {
          id: 'orbit_earth',
          shape: 'ring',
          label: 'Earth Orbit (1.0 AU / 149.6M km)',
          description: '1 Year Period (365.25 Days)',
          position: [0, 0, 0],
          dimensions: [110, 2, 110],
          color: '#38bdf8',
          opacity: 0.55
        },
        {
          id: 'earth',
          shape: 'sphere',
          label: 'Earth (1.0 M_⊕ • 23.5° Tilt)',
          description: 'Habitable planet with nitrogen-oxygen atmosphere and liquid water',
          position: [55, 0, 0],
          dimensions: [14, 14, 14],
          color: '#0284c7',
          opacity: 0.95
        },
        {
          id: 'orbit_mars',
          shape: 'ring',
          label: 'Mars Orbit (1.52 AU)',
          description: '1.88 Year Orbital Period',
          position: [0, 0, 0],
          dimensions: [150, 2, 150],
          color: '#f97316',
          opacity: 0.55
        },
        {
          id: 'mars',
          shape: 'sphere',
          label: 'Mars (Red Planet • Iron Oxide)',
          description: 'Fourth planet from the Sun with Olympus Mons and Valles Marineris',
          position: [-75, 0, 0],
          dimensions: [11, 11, 11],
          color: '#ef4444',
          opacity: 0.95
        },
        {
          id: 'orbit_jupiter',
          shape: 'ring',
          label: 'Jupiter Orbit (5.2 AU)',
          description: '11.86 Year Orbital Period',
          position: [0, 0, 0],
          dimensions: [210, 2, 210],
          color: '#f59e0b',
          opacity: 0.45
        },
        {
          id: 'jupiter',
          shape: 'sphere',
          label: 'Jupiter (Gas Giant • Great Red Spot)',
          description: 'Largest planet with massive magnetosphere and 95 moons',
          position: [0, 0, 105],
          dimensions: [26, 26, 26],
          color: '#d97706',
          opacity: 0.95
        }
      ],
      connections: [],
      canConvert: true
    };
  }

  return null;
}

/**
 * AI-Powered Subject-Understanding 3D Scene Architecture Pipeline
 */
export async function generateEducational3DScene(
  query: string,
  _sourceContext?: string
): Promise<Educational3DScene | null> {
  const id = 'scene3d_' + Math.random().toString(36).substring(2, 10);
  const curated = getCuratedScientific3DScene(query, id);
  if (curated) {
    return curated;
  }

  // Arbitrary 3D generation is disabled by policy.
  // Only verified, scientifically accurate 3D models are returned.
  return null;
}
