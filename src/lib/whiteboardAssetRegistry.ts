/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Whiteboard Verified Asset Registry
 * Pure verified educational assets (3D models and 2D SVGs).
 * Zero arbitrary AI 3D generation.
 */

import { Scene3DData } from '../components/Whiteboard2';

export interface VerifiedAssetItem {
  id: string;
  type: '3d' | 'svg';
  title: string;
  subtitle?: string;
  description: string;
  subject: 'Biology' | 'Chemistry' | 'Physics' | 'Mathematics' | 'Geography' | 'Astronomy' | 'General';
  category: string;
  tags: string[];
  thumbnailSvg: string;
  scene3D?: Scene3DData;
  svgContent?: string;
}

// ---------------------------------------------------------------------------
// 1. VERIFIED 3D MODELS REGISTRY
// ---------------------------------------------------------------------------

export const VERIFIED_3D_MODELS: VerifiedAssetItem[] = [
  {
    id: 'model_heart',
    type: '3d',
    title: 'Human Heart 3D Model',
    subtitle: 'Atria, Ventricles, Aorta & Pulmonary Circulation',
    description: 'Anatomically accurate 4-chambered mammalian heart showing left/right atria, thick muscular ventricles, aorta arch, and vena cava.',
    subject: 'Biology',
    category: 'Anatomy',
    tags: ['heart', 'cardiovascular', 'blood', 'circulation', 'atrium', 'ventricle', 'anatomy', 'biology', 'human body'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <path d="M50 82C50 82 18 62 18 36C18 22 29 16 39 16C45 16 50 20 50 20C50 20 55 16 61 16C71 16 82 22 82 36C82 62 50 82 50 82Z" fill="#ef4444" stroke="#b91c1c" stroke-width="3"/>
      <path d="M42 16V8C42 6 45 4 48 4H52C55 4 58 6 58 8V16" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
      <path d="M50 25V75" stroke="#fca5a5" stroke-width="2" stroke-dasharray="3 3"/>
    </svg>`,
    scene3D: {
      id: 'scene_heart',
      title: 'Human Heart (Cardiovascular Anatomy)',
      subtitle: '4 Chambers • Aorta • Vena Cava • Pulmonary Arteries',
      parts: [
        { id: 'left_ventricle', label: 'Left Ventricle (Thick Myocardium)', shape: 'sphere', position: [-14, -22, 0], dimensions: [42, 54, 42], color: '#dc2626', opacity: 0.95 },
        { id: 'right_ventricle', label: 'Right Ventricle (Pulmonary Pump)', shape: 'sphere', position: [14, -20, 0], dimensions: [38, 48, 38], color: '#ef4444', opacity: 0.95 },
        { id: 'left_atrium', label: 'Left Atrium (Oxygenated Inflow)', shape: 'sphere', position: [-18, 18, -4], dimensions: [28, 28, 28], color: '#b91c1c', opacity: 0.92 },
        { id: 'right_atrium', label: 'Right Atrium (Deoxygenated Inflow)', shape: 'sphere', position: [20, 16, 2], dimensions: [30, 30, 30], color: '#f87171', opacity: 0.92 },
        { id: 'aorta_arch', label: 'Ascending Aorta & Arch', shape: 'torus', position: [0, 36, 0], dimensions: [36, 12, 36], rotation: [90, 0, 0], color: '#f43f5e', opacity: 0.98 },
        { id: 'pulmonary_trunk', label: 'Pulmonary Trunk & Arteries', shape: 'cylinder', position: [6, 28, 10], dimensions: [14, 32, 14], rotation: [20, 0, -25], color: '#38bdf8', opacity: 0.95 },
        { id: 'superior_vena_cava', label: 'Superior Vena Cava', shape: 'cylinder', position: [26, 32, -6], dimensions: [12, 34, 12], color: '#0284c7', opacity: 0.95 },
        { id: 'inferior_vena_cava', label: 'Inferior Vena Cava', shape: 'cylinder', position: [24, -36, -6], dimensions: [12, 30, 12], color: '#0284c7', opacity: 0.9 }
      ],
      connections: [
        { fromId: 'right_atrium', toId: 'right_ventricle', label: 'Tricuspid Valve', color: '#f87171' },
        { fromId: 'left_atrium', toId: 'left_ventricle', label: 'Bicuspid (Mitral) Valve', color: '#ef4444' },
        { fromId: 'left_ventricle', toId: 'aorta_arch', label: 'Systemic Output', color: '#f43f5e' }
      ]
    }
  },
  {
    id: 'model_dna',
    type: '3d',
    title: 'DNA Double Helix',
    subtitle: 'Antiparallel Strands & Complementary Base Pairs',
    description: 'B-form right-handed DNA double helix with antiparallel sugar-phosphate backbones and hydrogen-bonded A=T and G≡C nucleotide pairs.',
    subject: 'Biology',
    category: 'Genetics',
    tags: ['dna', 'helix', 'genetics', 'genes', 'chromosome', 'nucleotide', 'adenine', 'thymine', 'biology', 'molecule'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <path d="M25 15C40 35 60 35 75 15M25 50C40 70 60 70 75 50M25 85C40 105 60 105 75 85" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
      <path d="M75 15C60 35 40 35 25 15M75 50C60 70 40 70 25 50M75 85C60 105 40 105 25 85" stroke="#a855f7" stroke-width="4" stroke-linecap="round"/>
      <line x1="30" y1="25" x2="70" y2="25" stroke="#facc15" stroke-width="3"/>
      <line x1="35" y1="42" x2="65" y2="42" stroke="#f43f5e" stroke-width="3"/>
      <line x1="32" y1="62" x2="68" y2="62" stroke="#10b981" stroke-width="3"/>
      <line x1="30" y1="78" x2="70" y2="78" stroke="#facc15" stroke-width="3"/>
    </svg>`,
    scene3D: {
      id: 'scene_dna',
      title: 'DNA Double Helix & Base Pairs',
      subtitle: 'Antiparallel Backbones • Complementary Hydrogen Bonds',
      parts: [
        { id: 'backbone_1', label: "5' → 3' Leading Strand", shape: 'helix', position: [-18, 0, 0], dimensions: [36, 150, 36], color: '#38bdf8', opacity: 0.95 },
        { id: 'backbone_2', label: "3' → 5' Lagging Strand", shape: 'helix', position: [18, 0, 0], dimensions: [36, 150, 36], color: '#a855f7', opacity: 0.95 },
        { id: 'bp_1', label: 'Adenine = Thymine (2 H-Bonds)', shape: 'cylinder', position: [0, 48, 0], dimensions: [38, 5, 5], rotation: [0, 20, 0], color: '#facc15', opacity: 0.95 },
        { id: 'bp_2', label: 'Guanine ≡ Cytosine (3 H-Bonds)', shape: 'cylinder', position: [0, 24, 0], dimensions: [38, 5, 5], rotation: [0, 60, 0], color: '#f43f5e', opacity: 0.95 },
        { id: 'bp_3', label: 'Thymine = Adenine (2 H-Bonds)', shape: 'cylinder', position: [0, 0, 0], dimensions: [38, 5, 5], rotation: [0, 100, 0], color: '#10b981', opacity: 0.95 },
        { id: 'bp_4', label: 'Cytosine ≡ Guanine (3 H-Bonds)', shape: 'cylinder', position: [0, -24, 0], dimensions: [38, 5, 5], rotation: [0, 140, 0], color: '#ec4899', opacity: 0.95 },
        { id: 'bp_5', label: 'Adenine = Thymine', shape: 'cylinder', position: [0, -48, 0], dimensions: [38, 5, 5], rotation: [0, 180, 0], color: '#facc15', opacity: 0.95 }
      ],
      connections: []
    }
  },
  {
    id: 'model_chloroplast',
    type: '3d',
    title: 'Chloroplast Ultrastructure',
    subtitle: 'Thylakoid Grana Stacks, Stroma & Double Membrane',
    description: '3D model of the photosynthetic plant organelle detailing outer and inner membranes, stroma matrix, stacked thylakoid grana discs, and stroma lamellae.',
    subject: 'Biology',
    category: 'Cell Biology',
    tags: ['chloroplast', 'plant', 'cell', 'photosynthesis', 'thylakoid', 'grana', 'stroma', 'biology', 'botany'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <ellipse cx="50" cy="50" rx="42" ry="28" fill="#065f46" stroke="#10b981" stroke-width="3"/>
      <ellipse cx="50" cy="50" rx="36" ry="22" fill="#047857" opacity="0.6"/>
      <rect x="30" y="38" width="12" height="24" rx="3" fill="#34d399"/>
      <rect x="46" y="34" width="12" height="30" rx="3" fill="#34d399"/>
      <rect x="62" y="40" width="12" height="20" rx="3" fill="#34d399"/>
      <line x1="38" y1="50" x2="66" y2="50" stroke="#a7f3d0" stroke-width="2"/>
    </svg>`,
    scene3D: {
      id: 'scene_chloroplast',
      title: 'Chloroplast Ultrastructure',
      subtitle: 'Double Envelope • Thylakoid Grana • Stroma Lamellae',
      parts: [
        { id: 'outer_envelope', label: 'Outer & Inner Membrane Envelope', shape: 'capsule', position: [0, 0, 0], dimensions: [120, 80, 100], color: '#10b981', opacity: 0.35, glass: true },
        { id: 'stroma_fluid', label: 'Stroma Matrix (Calvin Cycle)', shape: 'capsule', position: [0, 0, 0], dimensions: [105, 68, 86], color: '#34d399', opacity: 0.25 },
        { id: 'grana_stack_1', label: 'Granum Stack 1 (Light Reactions)', shape: 'cylinder', position: [-36, -4, 0], dimensions: [32, 38, 32], color: '#047857', opacity: 0.95 },
        { id: 'grana_stack_2', label: 'Granum Stack 2 (Photosystems I & II)', shape: 'cylinder', position: [36, -6, 8], dimensions: [30, 36, 30], color: '#047857', opacity: 0.95 },
        { id: 'grana_stack_3', label: 'Granum Stack 3', shape: 'cylinder', position: [0, 10, -22], dimensions: [28, 30, 28], color: '#065f46', opacity: 0.95 },
        { id: 'lamella_bridge', label: 'Stroma Lamella (Intergranal Fret)', shape: 'box', position: [0, -5, 4], dimensions: [64, 6, 14], color: '#059669', opacity: 0.9 }
      ],
      connections: [
        { fromId: 'grana_stack_1', toId: 'lamella_bridge', label: 'Link', color: '#10b981' },
        { fromId: 'lamella_bridge', toId: 'grana_stack_2', label: 'Link', color: '#10b981' }
      ]
    }
  },
  {
    id: 'model_meristem',
    type: '3d',
    title: 'Meristematic Plant Tissue',
    subtitle: 'Apical Meristem Dome, Procambium & Dividing Cells',
    description: '3D spatial visualization of the shoot/root apical meristem, protoderm epidermal layer, central procambium cylinder, and isodiametric mitotic cells.',
    subject: 'Biology',
    category: 'Botany',
    tags: ['meristem', 'tissue', 'plant', 'botany', 'cells', 'mitosis', 'root tip', 'biology'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <path d="M20 75C20 40 40 20 50 20C60 20 80 40 80 75Z" fill="#10b981" stroke="#059669" stroke-width="3"/>
      <rect x="42" y="45" width="16" height="35" fill="#f59e0b" opacity="0.8"/>
      <circle cx="36" cy="40" r="5" fill="#a855f7"/>
      <circle cx="64" cy="40" r="5" fill="#a855f7"/>
      <circle cx="50" cy="30" r="5" fill="#a855f7"/>
    </svg>`,
    scene3D: {
      id: 'scene_meristem',
      title: 'Meristematic Plant Tissue Architecture',
      subtitle: 'Apical Dome • Protoderm • Procambium • Mitotic Protoplasts',
      parts: [
        { id: 'apical_dome', label: 'Apical Meristem Dome', shape: 'capsule', position: [0, 42, 0], dimensions: [80, 65, 70], color: '#10b981', opacity: 0.35, glass: true },
        { id: 'protoderm', label: 'Protoderm Layer (Epidermis)', shape: 'cylinder', position: [0, 20, 0], dimensions: [95, 75, 95], color: '#059669', opacity: 0.28, wireframe: true },
        { id: 'procambium', label: 'Procambium Vascular Core', shape: 'cylinder', position: [0, -32, 0], dimensions: [34, 85, 34], color: '#f59e0b', opacity: 0.88 },
        { id: 'ground_meristem', label: 'Ground Meristem Matrix', shape: 'cylinder', position: [0, -32, 0], dimensions: [86, 70, 86], color: '#14b8a6', opacity: 0.32, glass: true },
        { id: 'cell_nucleus_1', label: 'Dividing Nucleus (Cell 1)', shape: 'sphere', position: [-22, 40, 8], dimensions: [14, 14, 14], color: '#a855f7', opacity: 0.95 },
        { id: 'cell_nucleus_2', label: 'Dividing Nucleus (Cell 2)', shape: 'sphere', position: [22, 40, -6], dimensions: [13, 13, 13], color: '#8b5cf6', opacity: 0.95 },
        { id: 'root_cap', label: 'Protective Root Cap (Calyptra)', shape: 'cone', position: [0, -88, 0], dimensions: [88, 42, 88], rotation: [180, 0, 0], color: '#475569', opacity: 0.7 }
      ],
      connections: []
    }
  },
  {
    id: 'model_solar',
    type: '3d',
    title: 'Heliocentric Solar System',
    subtitle: 'Sun, Planetary Orbits & Scale Terrestrial/Jovian Bodies',
    description: 'Interactive scale 3D heliocentric model featuring the central Sun, orbital planes, inner rocky planets (Mercury, Venus, Earth, Mars) and gas giants (Jupiter, Saturn).',
    subject: 'Astronomy',
    category: 'Space Science',
    tags: ['solar system', 'sun', 'earth', 'mars', 'jupiter', 'space', 'astronomy', 'orbits', 'planets'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="14" fill="#facc15" stroke="#f59e0b" stroke-width="2"/>
      <ellipse cx="50" cy="50" rx="28" ry="12" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3 3"/>
      <ellipse cx="50" cy="50" rx="42" ry="20" stroke="#f97316" stroke-width="1.5" stroke-dasharray="3 3"/>
      <circle cx="70" cy="54" r="5" fill="#0284c7"/>
      <circle cx="20" cy="42" r="4" fill="#ef4444"/>
    </svg>`,
    scene3D: {
      id: 'scene_solar',
      title: 'Heliocentric Solar System',
      subtitle: 'Central Star • Keplerian Orbital Rings • Planetary Scale',
      parts: [
        { id: 'sun_core', label: 'The Sun (1.989 × 10³⁰ kg)', shape: 'sphere', position: [0, 0, 0], dimensions: [46, 46, 46], color: '#facc15', opacity: 0.98, emissive: '#f59e0b' },
        { id: 'orbit_earth', label: 'Earth Orbit (1.0 AU / 149.6M km)', shape: 'ring', position: [0, 0, 0], dimensions: [110, 2, 110], color: '#38bdf8', opacity: 0.55 },
        { id: 'earth_globe', label: 'Earth (1.0 M_⊕ • Liquid Water)', shape: 'sphere', position: [55, 0, 0], dimensions: [13, 13, 13], color: '#0284c7', opacity: 0.95 },
        { id: 'orbit_mars', label: 'Mars Orbit (1.52 AU)', shape: 'ring', position: [0, 0, 0], dimensions: [150, 2, 150], color: '#f97316', opacity: 0.55 },
        { id: 'mars_globe', label: 'Mars (Iron Oxide Crust)', shape: 'sphere', position: [-75, 0, 0], dimensions: [10, 10, 10], color: '#ef4444', opacity: 0.95 },
        { id: 'orbit_jupiter', label: 'Jupiter Orbit (5.2 AU)', shape: 'ring', position: [0, 0, 0], dimensions: [205, 2, 205], color: '#f59e0b', opacity: 0.45 },
        { id: 'jupiter_globe', label: 'Jupiter (Gas Giant)', shape: 'sphere', position: [0, 0, 102], dimensions: [25, 25, 25], color: '#d97706', opacity: 0.95 }
      ],
      connections: []
    }
  },
  {
    id: 'model_mechanics',
    type: '3d',
    title: 'Inclined Plane Vector Forces',
    subtitle: 'Gravity (mg), Normal (N), Friction (f) & Acceleration',
    description: '3D mechanics apparatus illustrating force decomposition on a mass sliding on a ramp tilted at angle θ, resolving normal and downslope force vectors.',
    subject: 'Physics',
    category: 'Mechanics',
    tags: ['physics', 'mechanics', 'forces', 'vectors', 'gravity', 'friction', 'incline', 'slope', 'ramp'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <path d="M15 75L85 75L85 35Z" fill="#334155" stroke="#64748b" stroke-width="2"/>
      <rect x="42" y="44" width="20" height="14" rx="2" transform="rotate(-30 42 44)" fill="#38bdf8" stroke="#0284c7" stroke-width="2"/>
      <line x1="52" y1="46" x2="52" y2="70" stroke="#f43f5e" stroke-width="2.5" marker-end="url(#arrow)"/>
      <line x1="52" y1="46" x2="40" y2="28" stroke="#10b981" stroke-width="2.5"/>
    </svg>`,
    scene3D: {
      id: 'scene_mechanics',
      title: 'Inclined Plane Vector Forces',
      subtitle: 'Free Body Diagram • Orthogonal Force Decomposition',
      parts: [
        { id: 'wedge_ramp', label: 'Incline Wedge (Angle θ = 30°)', shape: 'triangular_prism', position: [0, -28, 0], dimensions: [140, 75, 100], color: '#334155', opacity: 0.85 },
        { id: 'block_mass', label: 'Sliding Mass (m = 5.0 kg)', shape: 'box', position: [-8, 20, 0], dimensions: [34, 24, 32], rotation: [0, 0, -30], color: '#38bdf8', opacity: 0.95 },
        { id: 'gravity_vec', label: 'Weight Vector: W = mg (Downward)', shape: 'cylinder', position: [-8, -16, 0], dimensions: [3, 46, 3], color: '#f43f5e', opacity: 0.95 },
        { id: 'normal_vec', label: 'Normal Force: N = mg cos(θ)', shape: 'cylinder', position: [-20, 40, 0], dimensions: [3, 42, 3], rotation: [0, 0, 60], color: '#10b981', opacity: 0.95 },
        { id: 'friction_vec', label: 'Friction Vector: f_k = μN', shape: 'cylinder', position: [14, 32, 0], dimensions: [3, 36, 3], rotation: [0, 0, -30], color: '#f59e0b', opacity: 0.95 }
      ],
      connections: [
        { fromId: 'block_mass', toId: 'gravity_vec', label: 'mg', color: '#f43f5e' },
        { fromId: 'block_mass', toId: 'normal_vec', label: 'N', color: '#10b981' },
        { fromId: 'block_mass', toId: 'friction_vec', label: 'f', color: '#f59e0b' }
      ]
    }
  },
  {
    id: 'model_atom',
    type: '3d',
    title: 'Bohr Atom Model',
    subtitle: 'Protons, Neutrons, and Electron Energy Shells',
    description: 'Classical planetary Bohr model representing a Carbon atom with nucleus (6 protons + 6 neutrons) and quantized K & L electron shells.',
    subject: 'Chemistry',
    category: 'Atomic Physics',
    tags: ['atom', 'bohr', 'electrons', 'protons', 'neutrons', 'chemistry', 'physics', 'orbitals', 'carbon'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="10" fill="#f43f5e"/>
      <circle cx="50" cy="50" r="22" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3 3"/>
      <circle cx="50" cy="50" r="36" stroke="#818cf8" stroke-width="1.5" stroke-dasharray="3 3"/>
      <circle cx="72" cy="50" r="4" fill="#38bdf8"/>
      <circle cx="36" cy="19" r="4" fill="#818cf8"/>
      <circle cx="64" cy="81" r="4" fill="#818cf8"/>
    </svg>`,
    scene3D: {
      id: 'scene_atom',
      title: 'Bohr Model of the Atom',
      subtitle: 'Dense Nucleus • Quantized Electron Orbitals',
      parts: [
        { id: 'nucleus_proton', label: 'Nucleus: 6 Protons (Positive Charge)', shape: 'sphere', position: [0, 0, 0], dimensions: [24, 24, 24], color: '#f43f5e', opacity: 0.95 },
        { id: 'nucleus_neutron', label: 'Nucleus: 6 Neutrons (Neutral)', shape: 'sphere', position: [4, 4, 4], dimensions: [20, 20, 20], color: '#94a3b8', opacity: 0.9 },
        { id: 'shell_k', label: 'K Shell (n = 1 • Max 2 Electrons)', shape: 'ring', position: [0, 0, 0], dimensions: [65, 1.5, 65], color: '#38bdf8', opacity: 0.7 },
        { id: 'electron_k1', label: 'Electron K-1 (e⁻)', shape: 'sphere', position: [32, 0, 0], dimensions: [7, 7, 7], color: '#38bdf8', opacity: 0.98 },
        { id: 'electron_k2', label: 'Electron K-2 (e⁻)', shape: 'sphere', position: [-32, 0, 0], dimensions: [7, 7, 7], color: '#38bdf8', opacity: 0.98 },
        { id: 'shell_l', label: 'L Shell (n = 2 • Valence)', shape: 'ring', position: [0, 0, 0], dimensions: [120, 1.5, 120], rotation: [25, 0, 0], color: '#818cf8', opacity: 0.65 },
        { id: 'electron_l1', label: 'Valence Electron L-1 (e⁻)', shape: 'sphere', position: [0, 0, 60], dimensions: [7, 7, 7], color: '#818cf8', opacity: 0.98 },
        { id: 'electron_l2', label: 'Valence Electron L-2 (e⁻)', shape: 'sphere', position: [0, 0, -60], dimensions: [7, 7, 7], color: '#818cf8', opacity: 0.98 }
      ],
      connections: []
    }
  },
  {
    id: 'model_water',
    type: '3d',
    title: 'Water Molecule (H₂O) Molecular Geometry',
    subtitle: 'Bent 104.5° Dipole Bond Angle & Hydrogen Bonding',
    description: '3D Ball-and-Stick spatial model of water displaying the central Oxygen atom with partial negative charge (δ⁻) and two Hydrogen atoms with partial positive charge (δ⁺).',
    subject: 'Chemistry',
    category: 'Molecular Structure',
    tags: ['water', 'h2o', 'molecule', 'chemistry', 'bonds', 'dipole', 'hydrogen', 'oxygen', 'geometry'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="40" r="16" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>
      <circle cx="28" cy="70" r="11" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
      <circle cx="72" cy="70" r="11" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
      <line x1="42" y1="48" x2="33" y2="62" stroke="#64748b" stroke-width="4"/>
      <line x1="58" y1="48" x2="67" y2="62" stroke="#64748b" stroke-width="4"/>
    </svg>`,
    scene3D: {
      id: 'scene_water',
      title: 'Water Molecule (H₂O) 3D Dipole',
      subtitle: 'sp³ Hybridization • Bent Geometry (104.5° Angle)',
      parts: [
        { id: 'oxygen_atom', label: 'Oxygen Atom (δ⁻ High Electronegativity)', shape: 'sphere', position: [0, 15, 0], dimensions: [42, 42, 42], color: '#ef4444', opacity: 0.95 },
        { id: 'hydrogen_atom_1', label: 'Hydrogen Atom 1 (δ⁺)', shape: 'sphere', position: [-38, -25, 0], dimensions: [26, 26, 26], color: '#f8fafc', opacity: 0.95 },
        { id: 'hydrogen_atom_2', label: 'Hydrogen Atom 2 (δ⁺)', shape: 'sphere', position: [38, -25, 0], dimensions: [26, 26, 26], color: '#f8fafc', opacity: 0.95 },
        { id: 'covalent_bond_1', label: 'Polar Covalent O-H Bond (460 kJ/mol)', shape: 'cylinder', position: [-19, -5, 0], dimensions: [8, 45, 8], rotation: [0, 0, 52], color: '#94a3b8', opacity: 0.9 },
        { id: 'covalent_bond_2', label: 'Polar Covalent O-H Bond', shape: 'cylinder', position: [19, -5, 0], dimensions: [8, 45, 8], rotation: [0, 0, -52], color: '#94a3b8', opacity: 0.9 }
      ],
      connections: [
        { fromId: 'oxygen_atom', toId: 'hydrogen_atom_1', label: 'O-H Bond', color: '#94a3b8' },
        { fromId: 'oxygen_atom', toId: 'hydrogen_atom_2', label: 'O-H Bond', color: '#94a3b8' }
      ]
    }
  }
];

// ---------------------------------------------------------------------------
// 2. VERIFIED 2D SVG DIAGRAMS REGISTRY
// ---------------------------------------------------------------------------

export const VERIFIED_SVG_DIAGRAMS: VerifiedAssetItem[] = [
  {
    id: 'svg_heart_diagram',
    type: 'svg',
    title: 'Human Heart Circulation Diagram',
    subtitle: 'Labelled Chambers, Valves & Systemic Flow',
    description: 'High-clarity vector diagram illustrating deoxygenated (blue) and oxygenated (red) blood pathways through all 4 cardiac chambers.',
    subject: 'Biology',
    category: 'Anatomy',
    tags: ['heart', 'diagram', 'circulation', 'atrium', 'ventricle', 'aorta', 'biology', 'svg'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <path d="M50 82C50 82 20 60 20 38C20 22 30 16 40 16C46 16 50 20 50 20C50 20 54 16 60 16C70 16 80 22 80 38C80 60 50 82 50 82Z" fill="#b91c1c" stroke="#f87171" stroke-width="2"/>
      <path d="M40 38H60M50 28V60" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="100%" height="100%">
      <rect width="800" height="520" rx="16" fill="#090d16" stroke="#1e293b" stroke-width="2"/>
      <text x="400" y="44" fill="#f8fafc" font-size="22" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">HUMAN HEART ANATOMY &amp; CIRCULATION</text>
      <text x="400" y="70" fill="#94a3b8" font-size="13" text-anchor="middle" font-family="system-ui, sans-serif">Double Circulation: Pulmonary Loop (Lungs) &amp; Systemic Loop (Body)</text>
      <!-- Heart Wall Outline -->
      <path d="M400 450 C400 450 200 350 200 220 C200 140 270 110 340 110 C380 110 400 140 400 140 C400 140 420 110 460 110 C530 110 600 140 600 220 C600 350 400 450 400 450 Z" fill="#881337" stroke="#e11d48" stroke-width="4"/>
      <!-- Internal Septum -->
      <line x1="400" y1="160" x2="400" y2="430" stroke="#be123c" stroke-width="8"/>
      <!-- Left & Right Chambers -->
      <rect x="250" y="160" width="120" height="80" rx="12" fill="#0369a1" opacity="0.85"/>
      <text x="310" y="195" fill="#f0f9ff" font-size="13" font-weight="bold" text-anchor="middle">RIGHT ATRIUM</text>
      <text x="310" y="215" fill="#bae6fd" font-size="10" text-anchor="middle">(Deoxygenated Inflow)</text>

      <rect x="430" y="160" width="120" height="80" rx="12" fill="#be123c" opacity="0.85"/>
      <text x="490" y="195" fill="#fff1f2" font-size="13" font-weight="bold" text-anchor="middle">LEFT ATRIUM</text>
      <text x="490" y="215" fill="#fecdd3" font-size="10" text-anchor="middle">(Oxygenated Inflow)</text>

      <rect x="240" y="270" width="130" height="110" rx="12" fill="#0284c7" opacity="0.85"/>
      <text x="305" y="315" fill="#f0f9ff" font-size="13" font-weight="bold" text-anchor="middle">RIGHT VENTRICLE</text>
      <text x="305" y="335" fill="#bae6fd" font-size="10" text-anchor="middle">Pumps to Lungs via</text>
      <text x="305" y="350" fill="#bae6fd" font-size="10" text-anchor="middle">Pulmonary Artery</text>

      <rect x="430" y="270" width="130" height="110" rx="12" fill="#e11d48" opacity="0.85"/>
      <text x="495" y="315" fill="#fff1f2" font-size="13" font-weight="bold" text-anchor="middle">LEFT VENTRICLE</text>
      <text x="495" y="335" fill="#fecdd3" font-size="10" text-anchor="middle">Thick Myocardium Wall</text>
      <text x="495" y="350" fill="#fecdd3" font-size="10" text-anchor="middle">Pumps to Aorta</text>

      <!-- Key Callouts -->
      <path d="M120 180 L240 200" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4 4"/>
      <text x="110" y="180" fill="#38bdf8" font-size="12" font-weight="bold" text-anchor="end">Vena Cava Inflow</text>

      <path d="M680 180 L560 200" stroke="#f43f5e" stroke-width="2" stroke-dasharray="4 4"/>
      <text x="690" y="180" fill="#f43f5e" font-size="12" font-weight="bold" text-anchor="start">Pulmonary Veins</text>

      <path d="M400 120 L400 85" stroke="#facc15" stroke-width="3"/>
      <text x="400" y="105" fill="#facc15" font-size="12" font-weight="bold" text-anchor="middle">AORTA ARCH</text>
    </svg>`
  },
  {
    id: 'svg_plant_cell',
    type: 'svg',
    title: 'Plant Cell Microscopic Anatomy',
    subtitle: 'Cell Wall, Chloroplasts, Central Vacuole & Nucleus',
    description: 'Detailed microscopic structure of an autotrophic plant cell showing rigid cellulose cell wall, large central sap vacuole, chloroplasts, and cytoplasm.',
    subject: 'Biology',
    category: 'Cell Biology',
    tags: ['plant cell', 'cell', 'chloroplast', 'vacuole', 'cell wall', 'biology', 'botany', 'diagram'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <rect x="15" y="15" width="70" height="70" rx="10" fill="#064e3b" stroke="#10b981" stroke-width="3"/>
      <rect x="22" y="22" width="56" height="56" rx="8" fill="#022c22"/>
      <ellipse cx="50" cy="50" rx="18" ry="14" fill="#0284c7" opacity="0.7"/>
      <circle cx="34" cy="34" r="7" fill="#a855f7"/>
      <ellipse cx="64" cy="36" rx="6" ry="4" fill="#10b981"/>
    </svg>`,
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="100%" height="100%">
      <rect width="800" height="520" rx="16" fill="#090d16" stroke="#1e293b" stroke-width="2"/>
      <text x="400" y="44" fill="#f8fafc" font-size="22" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">PLANT CELL ANATOMY</text>
      <!-- Outer Cell Wall -->
      <polygon points="180,100 620,100 660,420 140,420" fill="#064e3b" stroke="#10b981" stroke-width="8"/>
      <!-- Inner Plasma Membrane -->
      <polygon points="190,115 610,115 645,405 155,405" fill="#022c22" stroke="#34d399" stroke-width="2"/>
      <!-- Central Vacuole -->
      <ellipse cx="440" cy="270" rx="140" ry="90" fill="#0284c7" fill-opacity="0.5" stroke="#38bdf8" stroke-width="3"/>
      <text x="440" y="275" fill="#e0f2fe" font-size="14" font-weight="bold" text-anchor="middle">Large Central Vacuole (Turgor Pressure)</text>
      <!-- Nucleus -->
      <circle cx="260" cy="210" r="42" fill="#6b21a8" stroke="#c084fc" stroke-width="3"/>
      <circle cx="260" cy="210" r="16" fill="#a855f7"/>
      <text x="260" y="270" fill="#f3e8ff" font-size="12" font-weight="bold" text-anchor="middle">Nucleus &amp; Nucleolus</text>
      <!-- Chloroplasts -->
      <ellipse cx="270" cy="340" rx="26" ry="16" fill="#047857" stroke="#10b981" stroke-width="2"/>
      <text x="270" y="344" fill="#a7f3d0" font-size="9" font-weight="bold" text-anchor="middle">Chloroplast</text>
      <ellipse cx="560" cy="180" rx="26" ry="16" fill="#047857" stroke="#10b981" stroke-width="2"/>
      <text x="560" y="184" fill="#a7f3d0" font-size="9" font-weight="bold" text-anchor="middle">Chloroplast</text>
      <!-- Mitochondria -->
      <ellipse cx="550" cy="360" rx="22" ry="14" fill="#991b1b" stroke="#f87171" stroke-width="2"/>
      <text x="550" y="364" fill="#fecaca" font-size="9" font-weight="bold" text-anchor="middle">Mitochondrion</text>
      <!-- Labels -->
      <text x="635" y="80" fill="#10b981" font-size="12" font-weight="bold">Rigid Cellulose Cell Wall</text>
      <path d="M630 85 L590 105" stroke="#10b981" stroke-width="1.5"/>
    </svg>`
  },
  {
    id: 'svg_water_cycle',
    type: 'svg',
    title: 'Water Cycle (Hydrological Cycle)',
    subtitle: 'Evaporation, Transpiration, Condensation & Precipitation',
    description: 'Comprehensive earth science diagram showing global continuous water circulation through solar heating, clouds, precipitation, and groundwater runoff.',
    subject: 'Geography',
    category: 'Earth Science',
    tags: ['water cycle', 'geography', 'clouds', 'rain', 'precipitation', 'evaporation', 'nature', 'earth science'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <circle cx="25" cy="25" r="10" fill="#facc15"/>
      <path d="M45 35C45 30 52 26 60 26C66 26 72 30 74 35C78 35 82 38 82 43C82 48 78 51 74 51H45C40 51 36 47 36 43C36 38 40 35 45 35Z" fill="#94a3b8"/>
      <path d="M50 58L46 68M60 58L56 68M70 58L66 68" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
      <path d="M10 85Q50 75 90 85V100H10Z" fill="#0284c7"/>
    </svg>`,
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="100%" height="100%">
      <rect width="800" height="520" rx="16" fill="#090d16" stroke="#1e293b" stroke-width="2"/>
      <text x="400" y="44" fill="#f8fafc" font-size="22" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">THE HYDROLOGICAL (WATER) CYCLE</text>
      <!-- Sun -->
      <circle cx="120" cy="110" r="45" fill="#facc15" stroke="#f59e0b" stroke-width="3"/>
      <text x="120" y="115" fill="#78350f" font-size="12" font-weight="bold" text-anchor="middle">Solar Energy</text>
      <!-- Clouds -->
      <path d="M380 120 C380 95 410 80 440 80 C465 80 490 95 495 115 C515 115 535 130 535 150 C535 170 515 185 495 185 H380 C355 185 335 165 335 145 C335 125 355 120 380 120 Z" fill="#64748b" stroke="#94a3b8" stroke-width="3"/>
      <text x="440" y="145" fill="#f1f5f9" font-size="13" font-weight="bold" text-anchor="middle">CONDENSATION (Clouds)</text>
      <!-- Rain Precipitation -->
      <g stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round">
        <line x1="400" y1="210" x2="385" y2="250"/>
        <line x1="430" y1="210" x2="415" y2="250"/>
        <line x1="460" y1="210" x2="445" y2="250"/>
        <line x1="490" y1="210" x2="475" y2="250"/>
      </g>
      <text x="500" y="240" fill="#38bdf8" font-size="13" font-weight="bold">PRECIPITATION (Rain / Snow)</text>
      <!-- Mountains & Land -->
      <path d="M300 460 L500 280 L650 360 L800 290 L800 460 Z" fill="#1e293b"/>
      <path d="M500 280 L540 330 L460 330 Z" fill="#f8fafc"/>
      <!-- Ocean Reservoir -->
      <rect x="0" y="420" width="800" height="100" fill="#0369a1"/>
      <text x="200" y="465" fill="#e0f2fe" font-size="16" font-weight="bold" text-anchor="middle">OCEAN RESERVOIR</text>
      <!-- Evaporation Arrows -->
      <path d="M180 390 C180 320 220 280 260 220" stroke="#facc15" stroke-width="4" stroke-dasharray="6 4" fill="none"/>
      <text x="230" y="320" fill="#facc15" font-size="13" font-weight="bold">EVAPORATION</text>
      <!-- Transpiration -->
      <text x="640" y="370" fill="#10b981" font-size="12" font-weight="bold">TRANSPIRATION (Forests)</text>
      <!-- Runoff -->
      <path d="M550 380 L350 430" stroke="#38bdf8" stroke-width="3" stroke-dasharray="4 4" fill="none"/>
      <text x="470" y="415" fill="#7dd3fc" font-size="11" font-weight="bold">Surface Runoff &amp; Infiltration</text>
    </svg>`
  },
  {
    id: 'svg_right_triangle',
    type: 'svg',
    title: 'Right Triangle Trigonometric Ratios',
    subtitle: 'Hypotenuse, Opposite, Adjacent & Pythagoras Theorem',
    description: 'Clean geometric diagram showing right angle (90°), reference angle θ, side relations, and definitions for Sin(θ), Cos(θ), Tan(θ), and a² + b² = c².',
    subject: 'Mathematics',
    category: 'Geometry',
    tags: ['triangle', 'geometry', 'math', 'pythagoras', 'trigonometry', 'sine', 'cosine', 'tangent'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <path d="M20 80L80 80L20 20Z" fill="#1e1b4b" stroke="#818cf8" stroke-width="3"/>
      <rect x="20" y="68" width="12" height="12" stroke="#818cf8" stroke-width="2"/>
      <path d="M68 80A12 12 0 0 0 72 73" stroke="#f43f5e" stroke-width="2"/>
    </svg>`,
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="100%" height="100%">
      <rect width="800" height="520" rx="16" fill="#090d16" stroke="#1e293b" stroke-width="2"/>
      <text x="400" y="44" fill="#f8fafc" font-size="22" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">RIGHT-ANGLED TRIANGLE TRIGONOMETRY</text>
      <!-- Triangle Shape -->
      <polygon points="160,390 560,390 160,110" fill="#1e1b4b" stroke="#818cf8" stroke-width="4"/>
      <!-- Right angle marker -->
      <rect x="160" y="360" width="30" height="30" fill="none" stroke="#a5b4fc" stroke-width="2"/>
      <text x="175" y="380" fill="#a5b4fc" font-size="11" text-anchor="middle">90°</text>
      <!-- Angle Theta -->
      <path d="M510,390 A50,50 0 0,0 528,368" fill="none" stroke="#f43f5e" stroke-width="3"/>
      <text x="495" y="375" fill="#f43f5e" font-size="16" font-weight="bold">θ</text>
      <!-- Sides Labels -->
      <text x="140" y="250" fill="#38bdf8" font-size="15" font-weight="bold" text-anchor="end">Opposite Side (a)</text>
      <text x="360" y="420" fill="#34d399" font-size="15" font-weight="bold" text-anchor="middle">Adjacent Side (b)</text>
      <text x="380" y="235" fill="#facc15" font-size="15" font-weight="bold">Hypotenuse (c)</text>
      <!-- Formulas Box -->
      <rect x="580" y="110" width="180" height="280" rx="12" fill="#0f172a" stroke="#334155" stroke-width="2"/>
      <text x="670" y="145" fill="#f8fafc" font-size="14" font-weight="bold" text-anchor="middle">Trig Definitions</text>
      <line x1="600" y1="160" x2="740" y2="160" stroke="#334155"/>
      <text x="600" y="190" fill="#38bdf8" font-size="13" font-family="monospace">sin(θ) = Opp / Hyp</text>
      <text x="600" y="225" fill="#34d399" font-size="13" font-family="monospace">cos(θ) = Adj / Hyp</text>
      <text x="600" y="260" fill="#f43f5e" font-size="13" font-family="monospace">tan(θ) = Opp / Adj</text>
      <line x1="600" y1="285" x2="740" y2="285" stroke="#334155"/>
      <text x="670" y="315" fill="#facc15" font-size="13" font-weight="bold" text-anchor="middle">Pythagoras</text>
      <text x="670" y="345" fill="#facc15" font-size="16" font-weight="black" text-anchor="middle">a² + b² = c²</text>
    </svg>`
  },
  {
    id: 'svg_electric_circuit',
    type: 'svg',
    title: 'DC Electric Circuit Schematic',
    subtitle: 'Battery, Switch, Resistor, Ammeter & Current Flow',
    description: 'Standard physics schematic diagram illustrating conventional current flow (+ to -), electromotive source (DC cell), resistor load, and circuit switch.',
    subject: 'Physics',
    category: 'Electricity',
    tags: ['circuit', 'electric', 'physics', 'battery', 'current', 'resistor', 'switch', 'ohm law'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <rect x="20" y="20" width="60" height="60" rx="4" stroke="#f59e0b" stroke-width="3" fill="none"/>
      <line x1="44" y1="20" x2="44" y2="14" stroke="#f59e0b" stroke-width="3"/>
      <line x1="56" y1="20" x2="56" y2="8" stroke="#f59e0b" stroke-width="4"/>
      <circle cx="50" cy="80" r="8" fill="#f59e0b"/>
    </svg>`,
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="100%" height="100%">
      <rect width="800" height="520" rx="16" fill="#090d16" stroke="#1e293b" stroke-width="2"/>
      <text x="400" y="44" fill="#f8fafc" font-size="22" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">SERIES DC ELECTRIC CIRCUIT</text>
      <!-- Wire Loop -->
      <rect x="180" y="110" width="440" height="300" rx="12" fill="none" stroke="#f59e0b" stroke-width="4"/>
      <!-- DC Battery on Top -->
      <rect x="360" y="100" width="80" height="20" fill="#090d16"/>
      <line x1="385" y1="90" x2="385" y2="130" stroke="#f87171" stroke-width="4"/>
      <line x1="415" y1="100" x2="415" y2="120" stroke="#38bdf8" stroke-width="7"/>
      <text x="375" y="80" fill="#f87171" font-size="14" font-weight="bold">+</text>
      <text x="425" y="80" fill="#38bdf8" font-size="14" font-weight="bold">-</text>
      <text x="400" y="70" fill="#f8fafc" font-size="12" font-weight="bold" text-anchor="middle">DC Battery Source (V)</text>
      <!-- Resistor on Bottom -->
      <rect x="350" y="400" width="100" height="20" fill="#090d16"/>
      <path d="M350 410 L365 395 L380 425 L395 395 L410 425 L425 395 L440 425 L450 410" fill="none" stroke="#a855f7" stroke-width="4"/>
      <text x="400" y="450" fill="#c084fc" font-size="13" font-weight="bold" text-anchor="middle">Resistor (R = 10 Ω)</text>
      <!-- Light Bulb on Right -->
      <rect x="610" y="230" width="20" height="60" fill="#090d16"/>
      <circle cx="620" cy="260" r="22" fill="#fef08a" stroke="#ca8a04" stroke-width="3"/>
      <path d="M610 250 L630 270 M630 250 L610 270" stroke="#ca8a04" stroke-width="2"/>
      <text x="670" y="265" fill="#facc15" font-size="13" font-weight="bold">Lamp Load</text>
      <!-- Switch on Left -->
      <rect x="170" y="230" width="20" height="60" fill="#090d16"/>
      <circle cx="180" cy="235" r="5" fill="#f8fafc"/>
      <circle cx="180" cy="285" r="5" fill="#f8fafc"/>
      <line x1="180" y1="285" x2="160" y2="245" stroke="#f8fafc" stroke-width="3"/>
      <text x="120" y="265" fill="#94a3b8" font-size="13" font-weight="bold">Open Switch</text>
      <!-- Conventional Current Indicator -->
      <text x="280" y="140" fill="#f59e0b" font-size="12" font-weight="bold">→ Conventional Current I (Amperes)</text>
    </svg>`
  },
  {
    id: 'svg_optical_prism',
    type: 'svg',
    title: 'Optical Prism White Light Dispersion',
    subtitle: 'Refraction, Snell’s Law & Rainbow Spectrum (ROYGBIV)',
    description: 'Classic optics experiment showing incident polychromatic white light splitting into the visible light spectrum due to wavelength-dependent refractive indices.',
    subject: 'Physics',
    category: 'Optics',
    tags: ['prism', 'optics', 'physics', 'refraction', 'light', 'rainbow', 'dispersion', 'spectrum'],
    thumbnailSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <polygon points="50,15 85,85 15,85" stroke="#38bdf8" stroke-width="3" fill="#0ea5e9" fill-opacity="0.2"/>
      <line x1="5" y1="60" x2="38" y2="52" stroke="#ffffff" stroke-width="3"/>
      <line x1="62" y1="52" x2="95" y2="40" stroke="#ef4444" stroke-width="2"/>
      <line x1="62" y1="52" x2="95" y2="55" stroke="#3b82f6" stroke-width="2"/>
    </svg>`,
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="100%" height="100%">
      <rect width="800" height="520" rx="16" fill="#090d16" stroke="#1e293b" stroke-width="2"/>
      <text x="400" y="44" fill="#f8fafc" font-size="22" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">PRISM DISPERSION OF WHITE LIGHT</text>
      <!-- Triangular Glass Prism -->
      <polygon points="400,100 600,430 200,430" fill="#0284c7" fill-opacity="0.15" stroke="#38bdf8" stroke-width="4"/>
      <text x="400" y="350" fill="#7dd3fc" font-size="16" font-weight="bold" text-anchor="middle">Glass Prism (n &gt; 1)</text>
      <!-- Incident White Beam -->
      <line x1="60" y1="310" x2="280" y2="260" stroke="#ffffff" stroke-width="6"/>
      <text x="140" y="270" fill="#ffffff" font-size="14" font-weight="bold">White Incident Light</text>
      <!-- Dispersion Rays Inside -->
      <line x1="280" y1="260" x2="480" y2="245" stroke="#ef4444" stroke-width="2"/>
      <line x1="280" y1="260" x2="495" y2="275" stroke="#8b5cf6" stroke-width="2"/>
      <!-- Emergent Rainbow Fan -->
      <line x1="480" y1="245" x2="740" y2="180" stroke="#ef4444" stroke-width="3"/>
      <text x="750" y="185" fill="#ef4444" font-size="13" font-weight="bold">Red (Longest λ, Least Refraction)</text>
      <line x1="483" y1="251" x2="740" y2="205" stroke="#f97316" stroke-width="3"/>
      <line x1="486" y1="257" x2="740" y2="230" stroke="#eab308" stroke-width="3"/>
      <line x1="489" y1="263" x2="740" y2="255" stroke="#22c55e" stroke-width="3"/>
      <line x1="492" y1="269" x2="740" y2="280" stroke="#06b6d4" stroke-width="3"/>
      <line x1="495" y1="275" x2="740" y2="305" stroke="#8b5cf6" stroke-width="3"/>
      <text x="750" y="310" fill="#a855f7" font-size="13" font-weight="bold">Violet (Shortest λ, Most Refraction)</text>
    </svg>`
  }
];

export const ALL_VERIFIED_ASSETS: VerifiedAssetItem[] = [
  ...VERIFIED_3D_MODELS,
  ...VERIFIED_SVG_DIAGRAMS
];

/**
 * Instant Client-Side Verified Asset Search across title, description, subject, category, and tags
 */
export function searchVerifiedAssets(query: string, categoryFilter: string = 'all'): VerifiedAssetItem[] {
  const cleanQ = (query || '').trim().toLowerCase();
  const cleanCat = (categoryFilter || 'all').toLowerCase();

  return ALL_VERIFIED_ASSETS.filter(item => {
    // 1. Category Filter
    if (cleanCat !== 'all') {
      if (cleanCat === '3d models' || cleanCat === '3d') {
        if (item.type !== '3d') return false;
      } else if (cleanCat === 'svgs' || cleanCat === 'svg') {
        if (item.type !== 'svg') return false;
      } else if (item.subject.toLowerCase() !== cleanCat && item.category.toLowerCase() !== cleanCat) {
        return false;
      }
    }

    // 2. Query Search
    if (!cleanQ) return true;

    const inTitle = item.title.toLowerCase().includes(cleanQ);
    const inDesc = item.description.toLowerCase().includes(cleanQ);
    const inSub = item.subject.toLowerCase().includes(cleanQ);
    const inCat = item.category.toLowerCase().includes(cleanQ);
    const inTags = item.tags.some(t => t.toLowerCase().includes(cleanQ) || cleanQ.includes(t.toLowerCase()));

    return inTitle || inDesc || inSub || inCat || inTags;
  });
}
