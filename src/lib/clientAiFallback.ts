import { GoogleGenAI } from '@google/genai';

export function sanitizeHistory(history: any[] = []): any[] {
  if (!Array.isArray(history) || history.length === 0) return [];
  
  const filtered = history.filter(h => h && typeof h.content === 'string' && h.content.trim().length > 0);
  if (filtered.length === 0) return [];

  const sanitized: any[] = [];

  for (const msg of filtered) {
    const role = (msg.role === 'assistant' || msg.role === 'model') ? 'assistant' : 'user';
    if (sanitized.length === 0) {
      sanitized.push({ role, content: msg.content.trim() });
    } else {
      const last = sanitized[sanitized.length - 1];
      if (last.role === role) {
        last.content += '\n' + msg.content.trim();
      } else {
        sanitized.push({ role, content: msg.content.trim() });
      }
    }
  }

  return sanitized;
}

export async function clientSideGemini(
  userMessage: string, 
  history: any[] = [], 
  systemInstruction?: string
): Promise<string> {
  const key = (import.meta as any).env.VITE_GEMINI_API_KEY;
  const sanitized = sanitizeHistory(history);

  if (key) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const contents: any[] = [];

      // Ensure first turn in Gemini contents is 'user' for Gemini SDK rules
      let startIdx = 0;
      if (sanitized.length > 0 && sanitized[0].role === 'assistant') {
        contents.push({
          role: 'user',
          parts: [{ text: `[Prior Tutor Context]: ${sanitized[0].content}` }]
        });
        startIdx = 1;
      }

      for (let i = startIdx; i < sanitized.length; i++) {
        contents.push({
          role: sanitized[i].role === 'assistant' ? 'model' : 'user',
          parts: [{ text: sanitized[i].content }]
        });
      }

      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: systemInstruction ? { systemInstruction } : undefined
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.error('Client-side Gemini failed, using offline response:', err);
    }
  }

  return getMockAiResponse(userMessage, sanitized);
}

/** Use regex word boundaries so partial matches like "workspace" don't fire "work". */
function hasWord(word: string, text: string): boolean {
  return new RegExp(`\\b${word}\\b`, 'i').test(text);
}

function getMockAiResponse(msg: string, sanitizedHistory: any[] = []): string {
  const p = msg.toLowerCase();

  // If request requires JSON format, return structured JSON
  if (p.includes('json') || p.includes('operational actions') || p.includes('raw json format')) {
    return JSON.stringify({
      responseText: "I am ready to assist you. What would you like to automate across StudentOS?",
      action: "general_chat",
      targetValue: "",
      details: {}
    });
  }

  // Combine history text + current msg for entity / context extraction
  const allUserTexts = [
    ...sanitizedHistory.filter(m => m.role === 'user').map(m => m.content),
    msg
  ];
  const fullText = allUserTexts.join('\n');

  // Name extraction
  const nameMatch = fullText.match(/(?:my name is|i am|call me|name's)\s+([A-Za-z]+)/i);
  const detectedName = nameMatch ? nameMatch[1] : null;

  // Favorite subject extraction
  const subMatch = fullText.match(/(?:favourite|favorite|like|enjoy|studying)\s+(?:subject\s+is\s+|is\s+|subject\s+)?([A-Za-z]+)/i);
  const detectedSubject = subMatch ? subMatch[1] : null;

  // Answer identity or memory questions
  if (p.includes('my name') || p.includes('who am i') || p.includes('what is my name')) {
    if (detectedName) {
      return `Your name is **${detectedName}**!`;
    }
    return `You haven't told me your name yet! What should I call you?`;
  }

  if (p.includes('subject') && (p.includes('like') || p.includes('favourite') || p.includes('favorite') || p.includes('which'))) {
    if (detectedSubject) {
      return `Your favorite subject is **${detectedSubject}**!`;
    }
    return `You haven't mentioned your favorite subject yet! Is it Physics, Math, Chemistry, or Computer Science?`;
  }

  if (p.includes('photosynthesis') || p.includes('plant')) {
    return `### 🍃 Photosynthesis Explained\n\n**Photosynthesis** is the biological process by which green plants, algae, and cyanobacteria convert light energy into chemical energy stored in glucose.\n\n$$\\text{Chemical Equation: } 6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{light energy} \\rightarrow \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$$\n\n* **Light-Dependent Reactions**: Take place in the thylakoid membranes of chloroplasts where chlorophyll absorbs sunlight to split water molecules ($2\\text{H}_2\\text{O} \\rightarrow 4\\text{H}^+ + 4e^- + \\text{O}_2$), generating ATP and NADPH.\n* **Calvin Cycle (Light-Independent)**: Occurs in the stroma where ATP and NADPH are consumed to fix atmospheric carbon dioxide into 3-carbon sugars (G3P) that form glucose.\n\nWould you like a diagram or a quiz on the chloroplast structure?`;
  }

  if (p.includes('newton') || p.includes('second law')) {
    return `### 🍎 Newton's Second Law of Motion\n\n**Newton's Second Law** states that the acceleration of an object is directly proportional to the net external force acting on it and inversely proportional to its mass.\n\n$$\\vec{F}_{net} = m \\vec{a}$$\n\n* **Force ($F$)**: Measured in Newtons (N) or $\\text{kg}\\cdot\\text{m/s}^2$.\n* **Mass ($m$)**: The inertia or amount of matter in the object (kg).\n* **Acceleration ($a$)**: The rate of change of velocity ($\\text{m/s}^2$).\n\n**Key Takeaway**: If you push two objects with equal force, the heavier one accelerates slower. If you push an object twice as hard, it accelerates twice as fast.`;
  }

  if (p.includes('speed') && p.includes('velocity')) {
    return `### ⚡ Speed vs. Velocity\n\nHere is the core distinction in Physics:\n\n1. **Speed** is a **scalar quantity** — it measures only how fast an object moves regardless of direction (e.g., $60\\text{ km/h}$).\n2. **Velocity** is a **vector quantity** — it measures both rate of motion **and direction** (e.g., $60\\text{ km/h due North}$).\n\n$$\\text{Speed} = \\frac{\\text{Total Distance}}{\\text{Time}} \\quad | \\quad \\vec{v} = \\frac{\\Delta \\vec{x}}{\\Delta t} \\text{ (Displacement / Time)}$$\n\n*An object moving in a circle at a constant speed has a changing velocity because its direction is continuously changing!*`;
  }

  if (p.includes('what can you help') || p.includes('what can you do') || p.includes('help me with')) {
    return `### 🚀 What I Can Help You With\n\nI am your **StudentOS AI Assistant**! Here is what I can do for you across StudentOS:\n\n1. 🧠 **Academic Explanations**: Ask me anything in Science, Math, Literature, History, or Coding.\n2. 📅 **Study Planning**: Schedule study sessions, create tasks, and manage homework.\n3. 📢 **Automations**: Broadcast school announcements, schedule meetings, and create competitions.\n4. 📝 **Note Summaries & Quizzes**: Summarize lecture materials and practice active recall.\n\nWhat would you like to explore or automate today?`;
  }

  if (
    hasWord('physics', p) || hasWord('centripetal', p) || hasWord('mechanics', p) ||
    hasWord('velocity', p) || hasWord('acceleration', p) ||
    (hasWord('work', p) && hasWord('force', p))
  ) {
    return `### 🪐 Centripetal Force & Work Analysis\n\nIn classical mechanics, the work done by a **centripetal force** on an object in uniform circular motion is **exactly zero**.\n\n$$\\text{Work} = \\vec{F} \\cdot \\vec{d} = F d \\cos(\\theta)$$\n\n* **Perpendicularity**: The force is always directed radially inward toward the center, while the instantaneous displacement vector is tangent to the path.\n* **Angle ($\\theta$)**: The angle between them is always $90^\\circ$ ($\\cos(90^\\circ) = 0$).\n\nWould you like me to help you draft a mechanics cheat-sheet or solve another circular motion equation?`;
  }

  if (
    hasWord('chemistry', p) || hasWord('chem', p) ||
    hasWord('acid', p) || hasWord('synthesis', p) || hasWord('base', p)
  ) {
    return `### 🧪 Acid-Base Equilibrium & Synthesis Guide\n\nBased on synthesis guides, here is a quick overview of Lewis systems:\n\n1. **Lewis Acid**: An electron-pair acceptor (e.g., $BF_3$, $H^+$).\n2. **Lewis Base**: An electron-pair donor (e.g., $NH_3$, $H_2O$).\n3. **pKa & Equilibrium**: A lower pKa corresponds to a stronger acid, meaning it dissociates more completely in aqueous solutions.\n\nWould you like me to construct a quick practice quiz on acid-base equilibrium curves?`;
  }

  if (
    hasWord('bst', p) || hasWord('binary', p) || hasWord('tree', p) ||
    hasWord('complexity', p) || hasWord('algorithm', p) || hasWord('code', p) ||
    hasWord('programming', p)
  ) {
    return `### 💻 Binary Search Tree (BST) & O(log N) Complexity\n\nIn an optimally balanced Binary Search Tree (BST):\n\n* **Subdivision**: Each node divides the searchable subspace in half. This leads to **$O(\\log N)$** average time complexity for insertion, deletion, and lookup operations.\n* **Rotations**: If the tree becomes skewed, left/right AVL rotations must be executed to balance node heights and restore logarithmic efficiency.\n\nWould you like to review the node-balancing algorithm inside our study workspace?`;
  }

  // If this is an ongoing thread (history has 1 or more messages), NEVER send an introduction
  if (sanitizedHistory.length > 0) {
    return `That makes sense! Let's build on that concept. Regarding **"${msg.length > 40 ? msg.substring(0, 40) + '...' : msg}"**, what specific part would you like to explore next?`;
  }

  // Default initial greeting for brand-new blank threads only
  return `### 👋 Hey there!\n\nI'm your **StudentOS AI Buddy** — here to help you study smarter, not harder.\n\n* 📚 **Summarize notes** and generate study guides\n* 🧠 **Quiz you** on any topic with active recall questions\n* 🔬 **Explain concepts** in Physics, Chemistry, Computer Science, and more\n* ✅ **Build task checklists** and plan your study sessions\n\nWhat would you like to study today?`;
}
