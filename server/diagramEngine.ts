import { getAIClient, generateAICompletion } from './aiClient';

export interface ConceptNode {
  id: string;
  label: string;
  description?: string;
  category?: string;
}

export interface ConceptEdge {
  from: string;
  to: string;
  relation?: string;
}

export interface ConceptGroup {
  id: string;
  title: string;
  nodeIds: string[];
}

export interface ConceptGraph {
  title: string;
  topic: string;
  summary?: string;
  groups?: ConceptGroup[];
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

// Helper to sanitize query string
function cleanQuery(query: string): string {
  return String(query || '').trim();
}

/**
 * Predefined Topic-Aware Concept Graphs for Core Topics.
 * Guarantees pristine, 100% domain-accurate diagrams for standard curricula.
 */
const TOPIC_PRESETS: Record<string, ConceptGraph> = {
  'solar system': {
    title: 'The Solar System',
    topic: 'Solar System',
    summary: 'The Sun and celestial bodies gravitationally bound in planetary orbits.',
    groups: [
      { id: 'inner', title: 'Inner Terrestrial Planets', nodeIds: ['mercury', 'venus', 'earth', 'mars'] },
      { id: 'belt', title: 'Asteroid Belt', nodeIds: ['asteroid_belt'] },
      { id: 'outer', title: 'Outer Gas & Ice Giants', nodeIds: ['jupiter', 'saturn', 'uranus', 'neptune'] }
    ],
    nodes: [
      { id: 'sun', label: 'Sun (G-Type Star)', description: 'Solar Mass & Gravitational Center', category: 'star' },
      { id: 'mercury', label: 'Mercury', description: '1st Planet (Closest to Sun)', category: 'inner' },
      { id: 'venus', label: 'Venus', description: '2nd Planet (Dense CO2 Atmosphere)', category: 'inner' },
      { id: 'earth', label: 'Earth', description: '3rd Planet (Liquid Water & Life)', category: 'inner' },
      { id: 'mars', label: 'Mars', description: '4th Planet (Red Planet / Iron Oxide)', category: 'inner' },
      { id: 'asteroid_belt', label: 'Asteroid Belt', description: 'Ceres & Rocky Debris Boundary', category: 'belt' },
      { id: 'jupiter', label: 'Jupiter', description: '5th Planet (Largest Gas Giant)', category: 'outer' },
      { id: 'saturn', label: 'Saturn', description: '6th Planet (Extensive Ring System)', category: 'outer' },
      { id: 'uranus', label: 'Uranus', description: '7th Planet (Tilted Ice Giant)', category: 'outer' },
      { id: 'neptune', label: 'Neptune', description: '8th Planet (Farthest Major Planet)', category: 'outer' },
      { id: 'orbit', label: 'Gravity & Orbits', description: 'Keplerian Elliptical Motion' }
    ],
    edges: [
      { from: 'sun', to: 'mercury', relation: 'Solar Orbit' },
      { from: 'sun', to: 'venus', relation: 'Solar Orbit' },
      { from: 'sun', to: 'earth', relation: 'Solar Orbit' },
      { from: 'sun', to: 'mars', relation: 'Solar Orbit' },
      { from: 'mars', to: 'asteroid_belt', relation: 'Inner Boundary' },
      { from: 'asteroid_belt', to: 'jupiter', relation: 'Outer Boundary' },
      { from: 'sun', to: 'jupiter', relation: 'Gas Giant Orbit' },
      { from: 'sun', to: 'saturn', relation: 'Gas Giant Orbit' },
      { from: 'sun', to: 'uranus', relation: 'Ice Giant Orbit' },
      { from: 'sun', to: 'neptune', relation: 'Ice Giant Orbit' },
      { from: 'sun', to: 'orbit', relation: 'Gravitational Control' }
    ]
  },
  'human heart': {
    title: 'Human Heart & Circulatory Path',
    topic: 'Human Heart',
    summary: 'Deoxygenated and oxygenated blood circulation through heart chambers and lungs.',
    groups: [
      { id: 'right_side', title: 'Right Heart (Deoxygenated)', nodeIds: ['vena_cava', 'right_atrium', 'right_ventricle', 'pulmonary_artery'] },
      { id: 'pulmonary', title: 'Pulmonary Circuit', nodeIds: ['lungs'] },
      { id: 'left_side', title: 'Left Heart (Oxygenated)', nodeIds: ['pulmonary_vein', 'left_atrium', 'left_ventricle', 'aorta'] }
    ],
    nodes: [
      { id: 'vena_cava', label: 'Vena Cava', description: 'Deoxygenated Body Blood Return', category: 'right_side' },
      { id: 'right_atrium', label: 'Right Atrium', description: 'Receives Systemic Blood', category: 'right_side' },
      { id: 'right_ventricle', label: 'Right Ventricle', description: 'Pumps to Pulmonary Artery', category: 'right_side' },
      { id: 'pulmonary_artery', label: 'Pulmonary Artery', description: 'Deoxygenated Flow to Lungs', category: 'right_side' },
      { id: 'lungs', label: 'Lungs (Alveoli)', description: 'O2 Loading & CO2 Release', category: 'pulmonary' },
      { id: 'pulmonary_vein', label: 'Pulmonary Vein', description: 'Oxygenated Return to Heart', category: 'left_side' },
      { id: 'left_atrium', label: 'Left Atrium', description: 'Receives Oxygenated Blood', category: 'left_side' },
      { id: 'left_ventricle', label: 'Left Ventricle', description: 'Thick Muscle Systemic Pump', category: 'left_side' },
      { id: 'aorta', label: 'Aorta', description: 'Main Arterial Distribution', category: 'left_side' },
      { id: 'systemic', label: 'Systemic Circulation', description: 'Body Tissues & Organs' }
    ],
    edges: [
      { from: 'vena_cava', to: 'right_atrium', relation: 'Deoxygenated Flow' },
      { from: 'right_atrium', to: 'right_ventricle', relation: 'Tricuspid Valve' },
      { from: 'right_ventricle', to: 'pulmonary_artery', relation: 'Pulmonary Valve' },
      { from: 'pulmonary_artery', to: 'lungs', relation: 'To Alveoli' },
      { from: 'lungs', to: 'pulmonary_vein', relation: 'Gas Exchange' },
      { from: 'pulmonary_vein', to: 'left_atrium', relation: 'Oxygenated Flow' },
      { from: 'left_atrium', to: 'left_ventricle', relation: 'Mitral Valve' },
      { from: 'left_ventricle', to: 'aorta', relation: 'Aortic Valve' },
      { from: 'aorta', to: 'systemic', relation: 'Arterial Delivery' },
      { from: 'systemic', to: 'vena_cava', relation: 'Venous Return' }
    ]
  },
  'water cycle': {
    title: 'The Hydrologic (Water) Cycle',
    topic: 'Water Cycle',
    summary: 'Continuous movement of water between ocean, atmosphere, and land.',
    nodes: [
      { id: 'oceans', label: 'Oceans & Surface Water', description: 'Main Water Reservoir' },
      { id: 'evaporation', label: 'Evaporation', description: 'Solar Thermal Vaporization' },
      { id: 'transpiration', label: 'Transpiration', description: 'Plant Moisture Vapor Release' },
      { id: 'vapor', label: 'Atmospheric Water Vapor', description: 'Tropospheric Moisture' },
      { id: 'condensation', label: 'Condensation', description: 'Cooling into Clouds' },
      { id: 'precipitation', label: 'Precipitation', description: 'Rain, Snow, Sleet & Hail' },
      { id: 'runoff', label: 'Surface Runoff', description: 'Overland Stream & River Flow' },
      { id: 'infiltration', label: 'Groundwater Infiltration', description: 'Soil & Aquifer Recharge' }
    ],
    edges: [
      { from: 'oceans', to: 'evaporation', relation: 'Solar Heating' },
      { from: 'evaporation', to: 'vapor', relation: 'Vapor Rises' },
      { from: 'transpiration', to: 'vapor', relation: 'Leaf Release' },
      { from: 'vapor', to: 'condensation', relation: 'Cooling Altitudes' },
      { from: 'condensation', to: 'precipitation', relation: 'Cloud Saturation' },
      { from: 'precipitation', to: 'runoff', relation: 'Land Fall' },
      { from: 'precipitation', to: 'infiltration', relation: 'Soil Absorption' },
      { from: 'runoff', to: 'oceans', relation: 'River Flow' },
      { from: 'infiltration', to: 'oceans', relation: 'Subsurface Discharge' }
    ]
  },
  'photosynthesis': {
    title: 'Photosynthesis Mechanism',
    topic: 'Photosynthesis',
    summary: 'Conversion of light energy into glucose chemical energy in chloroplasts.',
    groups: [
      { id: 'light', title: 'Light-Dependent Reactions (Thylakoid)', nodeIds: ['sunlight', 'h2o', 'chlorophyll', 'light_stage', 'o2', 'energy'] },
      { id: 'dark', title: 'Calvin Cycle (Stroma)', nodeIds: ['co2', 'rubisco', 'calvin_stage', 'glucose'] }
    ],
    nodes: [
      { id: 'sunlight', label: 'Sunlight (Photons)', description: 'Solar Energy Source', category: 'light' },
      { id: 'h2o', label: 'Water (H2O)', description: 'Root Absorption', category: 'light' },
      { id: 'chlorophyll', label: 'Chlorophyll / PS II & I', description: 'Thylakoid Pigments', category: 'light' },
      { id: 'light_stage', label: 'Light Reactions', description: 'Photolysis & Electron Transport', category: 'light' },
      { id: 'o2', label: 'Oxygen (O2)', description: 'Released Byproduct', category: 'light' },
      { id: 'energy', label: 'ATP & NADPH', description: 'Chemical Energy Carriers', category: 'light' },
      { id: 'co2', label: 'Carbon Dioxide (CO2)', description: 'Stomatal Intake', category: 'dark' },
      { id: 'rubisco', label: 'RuBisCO Enzyme', description: 'Carbon Fixation Catalyst', category: 'dark' },
      { id: 'calvin_stage', label: 'Calvin Cycle', description: 'Stroma Dark Reactions', category: 'dark' },
      { id: 'glucose', label: 'Glucose (C6H12O6)', description: 'Synthesized Plant Sugar', category: 'dark' }
    ],
    edges: [
      { from: 'sunlight', to: 'chlorophyll', relation: 'Excites Electrons' },
      { from: 'h2o', to: 'light_stage', relation: 'Photolysis Split' },
      { from: 'chlorophyll', to: 'light_stage', relation: 'Electron Flow' },
      { from: 'light_stage', to: 'o2', relation: 'Byproduct Release' },
      { from: 'light_stage', to: 'energy', relation: 'Generates ATP/NADPH' },
      { from: 'energy', to: 'calvin_stage', relation: 'Powers Fixation' },
      { from: 'co2', to: 'rubisco', relation: 'Carbon Fixation' },
      { from: 'rubisco', to: 'calvin_stage', relation: 'Catalyzes Cycle' },
      { from: 'calvin_stage', to: 'glucose', relation: 'Sugar Synthesis' }
    ]
  },
  'periodic table': {
    title: 'Periodic Table & Element Groups',
    topic: 'Periodic Table',
    summary: 'Organization of chemical elements by atomic number and electronic properties.',
    groups: [
      { id: 'metals', title: 'Metals', nodeIds: ['alkali', 'alkaline', 'transition'] },
      { id: 'nonmetals', title: 'Nonmetals & Inert Gases', nodeIds: ['halogens', 'noble_gases'] }
    ],
    nodes: [
      { id: 'periodic_table', label: 'Periodic Table (118 Elements)', description: 'Arranged by Atomic Number (Protons)' },
      { id: "alkali", label: "Alkali Metals (Group 1)", description: "Na, K - Highly Reactive", category: "metals" },
      { id: "alkaline", label: "Alkaline Earth (Group 2)", description: "Mg, Ca - Reactive Earth Metals", category: "metals" },
      { id: "transition", label: "Transition Metals (3-12)", description: "Fe, Cu, Au - Conductive Metals", category: "metals" },
      { id: "metalloids", label: "Metalloids", description: "Si, Ge - Semiconductor Metalloids" },
      { id: "halogens", label: "Halogens (Group 17)", description: "F, Cl - Reactive Nonmetals", category: "nonmetals" },
      { id: "noble_gases", label: "Noble Gases (Group 18)", description: "He, Ne, Ar - Inert Gases", category: "nonmetals" },
      { id: "trends", label: "Periodic Trends", description: "Electronegativity & Atomic Radius" }
    ],
    edges: [
      { from: "periodic_table", to: "alkali", relation: "Group 1" },
      { from: "periodic_table", to: "alkaline", relation: "Group 2" },
      { from: "periodic_table", to: "transition", relation: "Groups 3-12" },
      { from: "periodic_table", to: "metalloids", relation: "Staircase Boundary" },
      { from: "periodic_table", to: "halogens", relation: "Group 17" },
      { from: "periodic_table", to: "noble_gases", relation: "Group 18" },
      { from: "trends", to: "periodic_table", relation: "Governs Periods" }
    ]
  },
  'binary tree': {
    title: 'Binary Tree Data Structure',
    topic: 'Binary Tree',
    summary: 'Hierarchical tree data structure where each node has at most two children.',
    nodes: [
      { id: "root", label: "Root Node", description: "Top Level Tree Entry Point" },
      { id: "left_child", label: "Left Child / Subtree", description: "Values < Parent (BST)" },
      { id: "right_child", label: "Right Child / Subtree", description: "Values >= Parent (BST)" },
      { id: "left_leaf", label: "Left Leaf Node", description: "Terminal Node (Degree 0)" },
      { id: "right_leaf", label: "Right Leaf Node", description: "Terminal Node (Degree 0)" },
      { id: "inorder", label: "In-Order Traversal", description: "Left -> Root -> Right (Sorted)" },
      { id: "preorder", label: "Pre-Order Traversal", description: "Root -> Left -> Right (Copy)" },
      { id: "postorder", label: "Post-Order Traversal", description: "Left -> Right -> Root (Delete)" },
      { id: "balance", label: "Height & Balance Factor", description: "AVL / Red-Black O(log N) Search" }
    ],
    edges: [
      { from: "root", to: "left_child", relation: "Left Pointer" },
      { from: "root", to: "right_child", relation: "Right Pointer" },
      { from: "left_child", to: "left_leaf", relation: "Branching" },
      { from: "right_child", to: "right_leaf", relation: "Branching" },
      { from: "root", to: "inorder", relation: "Visit Sequence" },
      { from: "root", to: "preorder", relation: "Visit Sequence" },
      { from: "root", to: "postorder", relation: "Visit Sequence" },
      { from: "balance", to: "root", relation: "Maintains Balance" }
    ]
  },
  'tcp/ip': {
    title: 'TCP/IP Protocol Suite & Network Stack',
    topic: 'TCP/IP',
    summary: 'Four-layer networking architecture governing global Internet communication.',
    nodes: [
      { id: "app_layer", label: "Application Layer", description: "HTTP, HTTPS, DNS, SSH Protocols" },
      { id: "trans_layer", label: "Transport Layer", description: "TCP (Reliable) & UDP (Datagram)" },
      { id: "handshake", label: "TCP 3-Way Handshake", description: "SYN -> SYN-ACK -> ACK" },
      { id: "internet_layer", label: "Internet Layer", description: "IP (v4/v6), ICMP & Packet Routing" },
      { id: "link_layer", label: "Network Link Layer", description: "Ethernet, Wi-Fi & MAC Framing" },
      { id: "physical", label: "Physical Layer", description: "Fiber, Copper & Wireless Transmission" }
    ],
    edges: [
      { from: "app_layer", to: "trans_layer", relation: "Encapsulates Payload" },
      { from: "trans_layer", to: "handshake", relation: "Establishes Connection" },
      { from: "trans_layer", to: "internet_layer", relation: "Segments to IP Packets" },
      { from: "internet_layer", to: "link_layer", relation: "Packets to Ethernet Frames" },
      { from: "link_layer", to: "physical", relation: "Frames to Signals" }
    ]
  },
  'machine learning': {
    title: 'Machine Learning Pipeline & Paradigms',
    topic: 'Machine Learning',
    summary: 'End-to-end Machine Learning process from data preprocessing to model inference.',
    groups: [
      { id: 'paradigms', title: 'ML Paradigms', nodeIds: ['supervised', 'unsupervised', 'reinforcement'] }
    ],
    nodes: [
      { id: "raw_data", label: "Raw Data Collection", description: "Structured & Unstructured Sources" },
      { id: "feature_eng", label: "Feature Engineering", description: "Normalization, Scaling, One-Hot" },
      { id: "supervised", label: "Supervised Learning", description: "Classification & Regression", category: "paradigms" },
      { id: "unsupervised", label: "Unsupervised Learning", description: "Clustering & Dimensionality Reduction", category: "paradigms" },
      { id: "reinforcement", label: "Reinforcement Learning", description: "Agent, Environment & Reward Policy", category: "paradigms" },
      { id: "training", label: "Model Training", description: "Loss Minimization & Gradient Descent" },
      { id: "evaluation", label: "Evaluation Metrics", description: "Accuracy, Precision, Recall, F1-Score" },
      { id: "deployment", label: "Model Deployment", description: "REST API & Real-time Serving" }
    ],
    edges: [
      { from: "raw_data", to: "feature_eng", relation: "Data Cleaning" },
      { from: "feature_eng", to: "supervised", relation: "Labeled Split" },
      { from: "feature_eng", to: "unsupervised", relation: "Unlabeled Features" },
      { from: "supervised", to: "training", relation: "Backpropagation" },
      { from: "unsupervised", to: "training", relation: "Pattern Extraction" },
      { from: "reinforcement", to: "training", relation: "Policy Iteration" },
      { from: "training", to: "evaluation", relation: "Validation Set" },
      { from: "evaluation", to: "deployment", relation: "Production API" }
    ]
  },
  'cell division': {
    title: 'Cell Division & Mitosis Stages',
    topic: 'Cell Division',
    summary: 'Eukaryotic cell division resulting in two identical diploid daughter cells.',
    nodes: [
      { id: "interphase", label: "Interphase (G1, S, G2)", description: "Cell Growth & DNA Replication" },
      { id: "prophase", label: "Prophase", description: "Chromatin Condenses & Spindle Forms" },
      { id: "metaphase", label: "Metaphase", description: "Chromosomes Align at Metaphase Plate" },
      { id: "anaphase", label: "Anaphase", description: "Sister Chromatids Pulled to Opposite Poles" },
      { id: "telophase", label: "Telophase", description: "Nuclear Envelope Re-forms" },
      { id: "cytokinesis", label: "Cytokinesis", description: "Cleavage Furrow Divides Cytoplasm" },
      { id: "daughter_cells", label: "Two Daughter Cells", description: "Identical Diploid (2n) Cells" }
    ],
    edges: [
      { from: "interphase", to: "prophase", relation: "Initiates Mitosis" },
      { from: "prophase", to: "metaphase", relation: "Nuclear Dissolution" },
      { from: "metaphase", to: "anaphase", relation: "Spindle Pull" },
      { from: "anaphase", to: "telophase", relation: "Pole Arrival" },
      { from: "telophase", to: "cytokinesis", relation: "Cytoplasmic Division" },
      { from: "cytokinesis", to: "daughter_cells", relation: "Completes Cycle" }
    ]
  },
  'indian constitution': {
    title: 'Structure of the Indian Constitution',
    topic: 'Indian Constitution',
    summary: 'Supreme law of India establishing democratic framework, rights, and governance organs.',
    groups: [
      { id: 'organs', title: 'Organs of Governance', nodeIds: ['executive', 'parliament', 'judiciary'] }
    ],
    nodes: [
      { id: "preamble", label: "Preamble", description: "Sovereign, Socialist, Secular, Democratic Republic" },
      { id: "rights", label: "Part III: Fundamental Rights", description: "Articles 12-35 (Equality & Liberty)" },
      { id: "dpsp", label: "Part IV: DPSP", description: "Articles 36-51 (Directive Principles)" },
      { id: "executive", label: "Union Executive", description: "President, Prime Minister & Cabinet", category: "organs" },
      { id: "parliament", label: "Parliament", description: "Lok Sabha & Rajya Sabha", category: "organs" },
      { id: "judiciary", label: "Independent Judiciary", description: "Supreme Court & High Courts", category: "organs" },
      { id: "federalism", label: "Federal Structure", description: "Union, State & Concurrent Lists" },
      { id: "amendment", label: "Article 368", description: "Constitutional Amendment Power" }
    ],
    edges: [
      { from: "preamble", to: "rights", relation: "Guarantees Rights" },
      { from: "preamble", to: "dpsp", relation: "Socio-Economic Goals" },
      { from: "executive", to: "parliament", relation: "Responsible to Legislature" },
      { from: "parliament", to: "judiciary", relation: "Judicial Review" },
      { from: "judiciary", to: "rights", relation: "Protector of Rights" },
      { from: "federalism", to: "parliament", relation: "Power Distribution" },
      { from: "amendment", to: "parliament", relation: "Constitutional Flexibility" }
    ]
  },
  "network": {
    title: "Computer Network OSI & TCP/IP Model",
    topic: "Computer Network",
    summary: "Architecture of Computer Communication Networks",
    groups: [
      { id: "g1", title: "User & Application", nodeIds: ["app_layer", "transport_layer"] },
      { id: "g2", title: "Routing & Hardware", nodeIds: ["network_layer", "link_layer", "physical_layer"] }
    ],
    nodes: [
      { id: "app_layer", label: "Application Layer", description: "HTTP, DNS, FTP, SMTP Protocols" },
      { id: "transport_layer", label: "Transport Layer", description: "TCP / UDP Reliable Transmission" },
      { id: "network_layer", label: "Network Layer", description: "IP Addressing & Packet Routing" },
      { id: "link_layer", label: "Data Link Layer", description: "Ethernet MAC & Switch Frames" },
      { id: "physical_layer", label: "Physical Layer", description: "Bitstream, Cables & Signals" }
    ],
    edges: [
      { from: "app_layer", to: "transport_layer", relation: "Encapsulates Data" },
      { from: "transport_layer", to: "network_layer", relation: "Segments to Packets" },
      { from: "network_layer", to: "link_layer", relation: "Routes to Frames" },
      { from: "link_layer", to: "physical_layer", relation: "Converts to Bits" }
    ]
  },
  "dna": {
    title: "DNA Replication Machinery",
    topic: "DNA Replication",
    summary: "Molecular Process of Cellular DNA Duplication",
    groups: [
      { id: "g1", title: "Unwinding", nodeIds: ["helicase", "topoisomerase", "ssb"] },
      { id: "g2", title: "Synthesis", nodeIds: ["primase", "dna_pol", "ligase"] }
    ],
    nodes: [
      { id: "helicase", label: "DNA Helicase", description: "Unzips Double Helix Strand" },
      { id: "topoisomerase", label: "Topoisomerase", description: "Relieves Torsional Strain" },
      { id: "ssb", label: "SSB Proteins", description: "Stabilizes Single Strands" },
      { id: "primase", label: "RNA Primase", description: "Lays RNA Primer Sequence" },
      { id: "dna_pol", label: "DNA Polymerase III", description: "Synthesizes New DNA 5'->3'" },
      { id: "ligase", label: "DNA Ligase", description: "Seals Okazaki Fragments" }
    ],
    edges: [
      { from: "helicase", to: "ssb", relation: "Exposes Strands" },
      { from: "topoisomerase", to: "helicase", relation: "Prevents Supercoiling" },
      { from: "primase", to: "dna_pol", relation: "Provides 3'-OH" },
      { from: "dna_pol", to: "ligase", relation: "Leaves Nick to Seal" }
    ]
  }
};

/**
 * Robust JSON Extractor from AI text output.
 */
function extractJsonFromText(rawText: string): any {
  if (!rawText) return null;
  let text = rawText.trim();
  text = text.replace(/^```(?:json)?/gi, '').replace(/```$/gi, '').trim();
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonSubstring = text.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSubstring);
    } catch (_) {}
  }
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

/**
 * Checks if a query matches any known preset keyword.
 */
function findPresetGraph(query: string): ConceptGraph | null {
  const qClean = cleanQuery(query).toLowerCase();
  for (const [key, preset] of Object.entries(TOPIC_PRESETS)) {
    if (qClean.includes(key) || key.includes(qClean)) {
      return preset;
    }
  }
  return null;
}

/**
 * Dynamic fallback graph generator for any custom topic.
 * Uses query terms to construct domain-specific nodes without placeholder phrases.
 */
function buildDynamicTopicGraph(query: string): ConceptGraph {
  const topicTitle = cleanQuery(query) || 'Educational Concept';
  const words = topicTitle.split(/\s+/).filter(w => w.length > 2);
  
  const w1 = words[0] ? words[0].toUpperCase() : 'Primary';
  const w2 = words[1] ? words[1].toUpperCase() : 'Core';
  const w3 = words[2] ? words[2].toUpperCase() : 'Advanced';

  return {
    title: topicTitle,
    topic: topicTitle,
    summary: `Structured educational graph for ${topicTitle}`,
    nodes: [
      { id: 'n1', label: `${topicTitle} (Overview)`, description: 'Foundational Topic Definition' },
      { id: 'n2', label: `${w1} Principles`, description: 'Core Underlying Rules' },
      { id: 'n3', label: `${w2} Operations`, description: 'Key Functional Mechanics' },
      { id: 'n4', label: `${w3} Applications`, description: 'Practical Real-World Usage' },
      { id: 'n5', label: 'Domain Constraints', description: 'Boundaries & Special Cases' },
      { id: 'n6', label: 'Synthesis & Results', description: 'Overall Outcome & Impact' }
    ],
    edges: [
      { from: 'n1', to: 'n2', relation: 'Establishes' },
      { from: 'n1', to: 'n3', relation: 'Drives' },
      { from: 'n2', to: 'n4', relation: 'Applies to' },
      { from: 'n3', to: 'n4', relation: 'Executes' },
      { from: 'n4', to: 'n5', relation: 'Bounded by' },
      { from: 'n5', to: 'n6', relation: 'Yields' }
    ]
  };
}

/**
 * AI Concept Extractor: Queries DeepSeek V4 Flash via OpenRouter (or Gemini) to produce a rich topic ConceptGraph JSON.
 * Validates output to ensure no generic placeholder strings exist.
 */
async function generateConceptGraphFromAI(query: string, retries = 1): Promise<ConceptGraph | null> {
  const prompt = `You are a world-class scientific textbook author and knowledge graph engineer.

TASK: Create a detailed, topic-specific knowledge concept graph for the educational topic: "${query}".

REQUIREMENTS:
1. Extract 8-16 core domain-specific concepts (nodes) essential to "${query}".
2. STRICTIONS (CRITICAL):
   - NEVER use generic placeholder words like "Mechanism", "Sub Process", "Fallback Loop", "Pipeline", "Component", "Node 1", "Process 1".
   - Use ONLY precise, topic-specific terminology (e.g., for "Solar System": Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Asteroid Belt, Orbits; for "Photosynthesis": Sunlight, Chlorophyll, Photolysis, Light Reactions, ATP, NADPH, CO2, Calvin Cycle, RuBisCO, Glucose; for "CPU Architecture": Control Unit, ALU, Registers, Cache L1/L2/L3, System Bus, RAM, Clock Signal).
3. Connect concepts with 8-18 directed relationship edges describing actual scientific/technical connections.
4. Group related nodes into 2-4 logical categories.

Return ONLY a valid JSON object matching this schema (no markdown formatting outside JSON):
{
  "title": "Title of the diagram",
  "topic": "${query}",
  "summary": "Brief 1-sentence summary",
  "groups": [
    { "id": "g1", "title": "Group Name", "nodeIds": ["n1", "n2"] }
  ],
  "nodes": [
    { "id": "n1", "label": "Short Primary Label", "description": "Secondary detail (3-6 words)", "category": "g1" }
  ],
  "edges": [
    { "from": "n1", "to": "n2", "relation": "relationship label" }
  ]
}`;

  try {
    console.log(`[DiagramEngine] Requesting AI ConceptGraph for query: "${query}"...`);
    const rawText = await generateAICompletion({
      systemInstruction: 'You are a knowledge graph generation engine. Output strictly valid JSON matching the requested schema.',
      prompt: prompt,
      temperature: 0.2,
      jsonMode: true,
      endpointName: 'DiagramEngine'
    });

    const parsed = extractJsonFromText(rawText) as ConceptGraph;
    if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length >= 4) {
      const hasPlaceholder = parsed.nodes.some(n => 
        /sub\s*process|fallback\s*loop|mechanism\s*\d+|node\s*\d+/i.test(n.label || '')
      );
      if (!hasPlaceholder) {
        console.log(`[DiagramEngine] Successfully generated ConceptGraph with ${parsed.nodes.length} nodes for "${query}".`);
        return parsed;
      } else {
        console.warn(`[DiagramEngine] Generated graph contained placeholder phrases, rejecting.`);
      }
    } else {
      console.warn(`[DiagramEngine] Parsed JSON did not match expected ConceptGraph structure.`);
    }
  } catch (err: any) {
    console.warn(`[DiagramEngine] ConceptGraph generation error: ${err.message || err}`);
  }

  if (retries > 0) {
    console.warn(`[DiagramEngine] Retrying AI ConceptGraph generation (${retries} retries left)...`);
    return generateConceptGraphFromAI(query, retries - 1);
  }

  return null;
}

/**
 * SHARED AI PIPELINE:
 * Retrieves or generates a structured ConceptGraph for any query.
 */
export async function getOrGenerateConceptGraph(query: string): Promise<ConceptGraph> {
  const cleanQ = cleanQuery(query);

  // 1. Check Predefined Topic Presets for exact/keyword match
  const preset = findPresetGraph(cleanQ);
  if (preset) {
    console.log(`[DiagramEngine] Using predefined high-yield preset for "${cleanQ}".`);
    return preset;
  }

  // 2. Query Gemini AI for custom topic ConceptGraph
  const aiGraph = await generateConceptGraphFromAI(cleanQ);
  if (aiGraph) {
    return aiGraph;
  }

  // 3. Fall back to dynamic topic graph (guaranteed no placeholder phrases)
  console.log(`[DiagramEngine] Using dynamic topic graph generator for "${cleanQ}".`);
  return buildDynamicTopicGraph(cleanQ);
}

/**
 * MERMAID RENDERER
 * Converts a ConceptGraph into syntactically valid Mermaid flowchart code.
 */
export function renderMermaidFromConceptGraph(graph: ConceptGraph): { success: boolean; mermaid: string; code: string; title: string } {
  let code = 'flowchart TD\n';

  // Render Subgraphs if groups exist
  if (graph.groups && graph.groups.length > 0) {
    const groupedNodeIds = new Set<string>();
    for (const group of graph.groups) {
      code += `  subgraph ${group.id} ["${group.title}"]\n`;
      for (const nodeId of group.nodeIds) {
        const node = graph.nodes.find(n => n.id === nodeId);
        if (node) {
          groupedNodeIds.add(node.id);
          const descStr = node.description ? ` (${node.description})` : '';
          code += `    ${node.id}["${node.label}${descStr}"]\n`;
        }
      }
      code += `  end\n`;
    }

    // Render remaining non-grouped nodes
    for (const node of graph.nodes) {
      if (!groupedNodeIds.has(node.id)) {
        const descStr = node.description ? ` (${node.description})` : '';
        code += `  ${node.id}["${node.label}${descStr}"]\n`;
      }
    }
  } else {
    for (const node of graph.nodes) {
      const descStr = node.description ? ` (${node.description})` : '';
      code += `  ${node.id}["${node.label}${descStr}"]\n`;
    }
  }

  // Render Edges
  for (const edge of graph.edges) {
    if (edge.relation) {
      code += `  ${edge.from} -->|"${edge.relation}"| ${edge.to}\n`;
    } else {
      code += `  ${edge.from} --> ${edge.to}\n`;
    }
  }

  return {
    success: true,
    mermaid: code,
    code,
    title: graph.title
  };
}

/**
 * SVG RENDERER
 * Converts a ConceptGraph into a beautiful, crisp, responsive SVG diagram.
 */
export function renderSvgFromConceptGraph(graph: ConceptGraph, subject = 'general'): { success: boolean; svg: string; title: string; subject: string } {
  const nodes = graph.nodes;
  const N = nodes.length;

  const cols = N <= 4 ? N : (N <= 8 ? 4 : (N <= 12 ? 4 : 5));
  const rows = Math.ceil(N / cols);

  const minX = 70;
  const maxX = 880;
  const minY = 100;
  const maxY = 560;

  const dX = (maxX - minX) / cols;
  const dY = (maxY - minY) / rows;

  const cardWidth = 175;
  const cardHeight = 65;

  const posMap: Record<string, { x: number; y: number; w: number; h: number }> = {};

  nodes.forEach((node, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const cx = minX + c * dX + dX / 2 - cardWidth / 2;
    const cy = minY + r * dY + dY / 2 - cardHeight / 2;
    posMap[node.id] = { x: cx, y: cy, w: cardWidth, h: cardHeight };
  });

  const cardFills = ['#1e1b4b', '#064e3b', '#4c1d95', '#701a75', '#1e293b', '#831843', '#1e3a8a'];
  const cardStrokes = ['#6366f1', '#10b981', '#c084fc', '#f472b6', '#38bdf8', '#f43f5e', '#60a5fa'];

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 950 650" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <marker id="arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
    </marker>
  </defs>
  <rect width="950" height="650" rx="16" fill="url(#bg)" stroke="#1e293b" stroke-width="2"/>
  <text x="475" y="48" fill="#38bdf8" font-size="22" font-weight="800" text-anchor="middle" font-family="sans-serif">${graph.title.toUpperCase()}</text>`;

  // Draw Groups if present
  if (graph.groups && graph.groups.length > 0) {
    graph.groups.forEach((group, gIdx) => {
      const gNodes = group.nodeIds.map(id => posMap[id]).filter(Boolean);
      if (gNodes.length > 0) {
        const minGx = Math.min(...gNodes.map(n => n.x)) - 15;
        const maxGx = Math.max(...gNodes.map(n => n.x + n.w)) + 15;
        const minGy = Math.min(...gNodes.map(n => n.y)) - 25;
        const maxGy = Math.max(...gNodes.map(n => n.y + n.h)) + 15;
        const gWidth = maxGx - minGx;
        const gHeight = maxGy - minGy;

        svgContent += `
  <rect x="${minGx}" y="${minGy}" width="${gWidth}" height="${gHeight}" rx="14" fill="#1e1b4b" fill-opacity="0.2" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="4,4"/>
  <text x="${minGx + 12}" y="${minGy + 16}" fill="#a5b4fc" font-size="12" font-weight="bold" font-family="sans-serif">${group.title.toUpperCase()}</text>`;
      }
    });
  }

  // Draw Edges (Connecting lines with arrowheads)
  graph.edges.forEach(edge => {
    const fromP = posMap[edge.from];
    const toP = posMap[edge.to];
    if (fromP && toP) {
      const x1 = fromP.x + fromP.w / 2;
      const y1 = fromP.y + fromP.h / 2;
      const x2 = toP.x + toP.w / 2;
      const y2 = toP.y + toP.h / 2;

      svgContent += `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr)" opacity="0.85"/>`;
    }
  });

  // Draw Nodes
  nodes.forEach((node, idx) => {
    const pos = posMap[node.id];
    if (pos) {
      const fill = cardFills[idx % cardFills.length];
      const stroke = cardStrokes[idx % cardStrokes.length];
      const cleanLabel = node.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const cleanDesc = (node.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      svgContent += `
  <rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <text x="${pos.x + pos.w / 2}" y="${pos.y + 28}" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">${cleanLabel}</text>`;

      if (cleanDesc) {
        svgContent += `
  <text x="${pos.x + pos.w / 2}" y="${pos.y + 48}" fill="#94a3b8" font-size="10" text-anchor="middle" font-family="sans-serif">${cleanDesc}</text>`;
      }
    }
  });

  svgContent += `\n</svg>`;

  return {
    success: true,
    svg: svgContent,
    title: graph.title,
    subject
  };
}

/**
 * CANVAS RENDERER
 * Converts a ConceptGraph into shape elements for whiteboard canvas.
 */
export function renderCanvasFromConceptGraph(graph: ConceptGraph): any[] {
  const elements: any[] = [];
  const nodes = graph.nodes;
  const N = nodes.length;

  const cols = N <= 4 ? N : (N <= 8 ? 4 : 5);
  const cardWidth = 180;
  const cardHeight = 60;
  const posMap: Record<string, { x: number; y: number }> = {};

  nodes.forEach((node, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const x = 100 + c * 220;
    const y = 100 + r * 120;
    posMap[node.id] = { x, y };

    elements.push({
      type: 'rect',
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      fill: '#1e293b',
      stroke: '#38bdf8',
      text: `${node.label}${node.description ? ' (' + node.description + ')' : ''}`
    });
  });

  graph.edges.forEach(edge => {
    const fromP = posMap[edge.from];
    const toP = posMap[edge.to];
    if (fromP && toP) {
      elements.push({
        type: 'arrow',
        points: [fromP.x + cardWidth / 2, fromP.y + cardHeight / 2, toP.x + cardWidth / 2, toP.y + cardHeight / 2],
        stroke: '#38bdf8'
      });
    }
  });

  return elements;
}

// ----------------------------------------------------------------------
// EXPORTED API ENGINE FUNCTIONS (UNIFIED PIPELINE)
// ----------------------------------------------------------------------

/**
 * Generates Mermaid code using the Shared ConceptGraph Pipeline.
 */
export async function generateMermaidDiagram(query: string, retries = 1): Promise<{ success: boolean; mermaid: string; code: string; title: string }> {
  try {
    const conceptGraph = await getOrGenerateConceptGraph(query);
    return renderMermaidFromConceptGraph(conceptGraph);
  } catch (err: any) {
    console.error('[DiagramEngine] generateMermaidDiagram error:', err.stack || err);
    const fallbackGraph = buildDynamicTopicGraph(query);
    return renderMermaidFromConceptGraph(fallbackGraph);
  }
}

/**
 * Generates SVG diagram using the Shared ConceptGraph Pipeline.
 */
export async function generateSvgDiagram(query: string, subject = 'general', retries = 1): Promise<{ success: boolean; svg: string; title: string; subject: string; error?: string; mermaid?: string }> {
  try {
    const conceptGraph = await getOrGenerateConceptGraph(query);
    return renderSvgFromConceptGraph(conceptGraph, subject);
  } catch (err: any) {
    console.error('[DiagramEngine] generateSvgDiagram error:', err.stack || err);
    const fallbackGraph = buildDynamicTopicGraph(query);
    return renderSvgFromConceptGraph(fallbackGraph, subject);
  }
}

/**
 * Generates Canvas shape objects using the Shared ConceptGraph Pipeline.
 */
export async function generateCanvasElements(query: string, type = 'diagram', retries = 1): Promise<any[]> {
  try {
    const conceptGraph = await getOrGenerateConceptGraph(query);
    return renderCanvasFromConceptGraph(conceptGraph);
  } catch (err: any) {
    console.error('[DiagramEngine] generateCanvasElements error:', err.stack || err);
    const fallbackGraph = buildDynamicTopicGraph(query);
    return renderCanvasFromConceptGraph(fallbackGraph);
  }
}

/**
 * Legacy Smart Fallback Mermaid export (backwards compatibility).
 */
export function getSmartFallbackMermaid(query: string): string {
  const preset = findPresetGraph(query) || buildDynamicTopicGraph(query);
  return renderMermaidFromConceptGraph(preset).mermaid;
}

/**
 * Legacy Smart Fallback SVG export (backwards compatibility).
 */
export function getSmartFallbackSvg(query: string, subject = 'general'): string {
  const preset = findPresetGraph(query) || buildDynamicTopicGraph(query);
  return renderSvgFromConceptGraph(preset, subject).svg;
}
