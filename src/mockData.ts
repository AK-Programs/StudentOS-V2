/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QuizQuestion, AITeacherPersona, FeedbackPost, MaterialResource, ScheduleItem } from './types';

export const INITIAL_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    title: '🏆 Emerald House Claims Physics Decathlon Championship',
    content: 'Congratulations to Vega and Astra Section representatives of Emerald House for scoring a stellar 280 points in yesterday’s competitive physics and mechanics finals! +100 Points added to Emerald standings!',
    date: 'June 9, 2026',
    tag: 'Celebration',
    tagColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
  },
  {
    id: 'ann-2',
    title: '🔬 Chemistry AP Laboratory Expansion Hours',
    content: 'To support study preparations for upcoming term papers, the main Chemistry Lab in Solara Block will remain open until 8 PM on Tuesdays and Thursdays. Teacher supervision is fully available.',
    date: 'June 8, 2026',
    tag: 'Academic',
    tagColor: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
  },
  {
    id: 'ann-3',
    title: '🚀 AI Hackathon and Smart Web Presentations',
    content: 'The Computer Science Club is launching a joint hackathon featuring responsive smart components. Register with your section groups by Friday. Special award credits count towards House points!',
    date: 'June 7, 2026',
    tag: 'Event',
    tagColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
  }
];

export const MOCK_QUIZZES: { [subject: string]: QuizQuestion[] } = {
  Physics: [
    {
      id: 'phy-1',
      question: 'What is the work done by a centripetal force acting on an object moving in a perfect circular orbit?',
      options: [
        'Equal to the force multiplied by the circumference',
        'Directly proportional to the kinetic energy',
        'Exactly zero because force is perpendicular to displacement',
        'Determined entirely by the velocity vector'
      ],
      correctOptionIndex: 2,
      explanation: 'Work is defined as force dotted with displacement. Since centripetal force is always perpendicular to instantaneous movement, the dot product is 0, yielding zero net work.'
    },
    {
      id: 'phy-2',
      question: 'Which law confirms that the entropy of an isolated thermodynamic system can never decrease over time?',
      options: [
        'First Law of Thermodynamics',
        'Second Law of Thermodynamics',
        'Third Law of Thermodynamics',
        'Zeroth Law of thermal equilibrium'
      ],
      correctOptionIndex: 1,
      explanation: 'The Second Law of Thermodynamics states that the total entropy of an isolated system always increases or remains constant in ideal reversible processes.'
    },
    {
      id: 'phy-3',
      question: 'What happens to the frequency of sound observed when a source moves rapidly away from a stationary monitor?',
      options: [
        'The frequency increases (pitch becomes higher)',
        'The frequency decreases (pitch becomes lower)',
        'The frequency remains absolutely constant',
        'The wave speed increases proportionally'
      ],
      correctOptionIndex: 1,
      explanation: 'By the Doppler Effect, when a source of sound moves away, the intervals between wave crests expand, causing a decrease in observed frequency (lower pitch).'
    }
  ],
  Chemistry: [
    {
      id: 'chem-1',
      question: 'Why does water exhibit an extraordinarily high boiling point compared to hydrogen sulfide (H₂S)?',
      options: [
        'Water contains ionic bonds, whereas H₂S is fully covalent',
        'Presence of extensive intermolecular hydrogen bonding in H₂O',
        'The molar mass of Oxygen is much higher than Sulfur',
        'Water molecules are perfectly linear, minimizing surface resistance'
      ],
      correctOptionIndex: 1,
      explanation: 'Oxygen is highly electronegative, creating substantial dipole attractions which enable strong intermolecular hydrogen bonding. H₂S molecules lack this property.'
    },
    {
      id: 'chem-2',
      question: 'What is the conjugate base of the bisulfate ion (HSO₄⁻) in aqueous state solutions?',
      options: [
        'H₂SO₄',
        'SO₄²⁻',
        'H₃O⁺',
        'OH⁻'
      ],
      correctOptionIndex: 1,
      explanation: 'A conjugate base is formed when an acid loses a proton (H⁺). HSO₄⁻ minus H⁺ becomes the sulfate ion, SO₄²⁻.'
    }
  ],
  'Computer Science': [
    {
      id: 'cs-1',
      question: 'What is the average runtime complexity of searching a value in an optimally balanced Binary Search Tree (BST)?',
      options: [
        'O(1) constant search time',
        'O(N) linear iteration count',
        'O(log N) logarithmic binary subdivision',
        'O(N log N) linear-logarithmic sorting cycle'
      ],
      correctOptionIndex: 2,
      explanation: 'A balanced BST divides search candidates in half at every level, leading to O(log N) search operations.'
    },
    {
      id: 'cs-2',
      question: 'Which mechanism prevents race conditions in multi-threaded runtime applications?',
      options: [
        'Continuous Garbage Collection',
        'Mutual Exclusion Locks (Mutex / Semaphore)',
        'Dynamic Resolution Proxies',
        'Stateless Garbage Pipelines'
      ],
      correctOptionIndex: 1,
      explanation: 'A Mutex enforces mutual exclusion, allowing only one thread to write or modify a shared variable at any given instant.'
    }
  ],
  Mathematics: [
    {
      id: 'math-1',
      question: 'What is the limit of (sin x) / x as x approaches 0 in real-valued calculus?',
      options: [
        'Zero',
        '1',
        'Infinity',
        'Undefined'
      ],
      correctOptionIndex: 1,
      explanation: 'Using L’Hôpital’s Rule or geometric limits, the limit as x goes to 0 of sin(x)/x is exactly 1.'
    },
    {
      id: 'math-2',
      question: 'If a matrix is orthogonal, what corresponds exactly to its inverse matrix?',
      options: [
        'Its diagonal matrix multiplier',
        'Its transposed matrix representation',
        'Its determinant divisor',
        'An identity matrix of scale N'
      ],
      correctOptionIndex: 1,
      explanation: 'By definition, a matrix A is orthogonal if A * Aᵀ = I. Therefore, its transpose Aᵀ is exactly equal to its inverse A⁻¹.'
    }
  ]
};

export const AI_PERSONAS: AITeacherPersona[] = [
  {
    id: 'elara',
    name: 'Professor Elara',
    speciality: 'Mathematics & Physics',
    style: 'Kind, highly conceptual, visual analogies',
    avatarChar: '🧬',
    avatarColor: 'from-blue-500 to-indigo-600',
    systemPrompt: 'You are Professor Elara. Explain formulas using beautiful intuitive physical analogies.'
  },
  {
    id: 'ruby',
    name: 'Dr. Ruby',
    speciality: 'Literature & History',
    style: 'Slightly rigorous, challenging, essay-focused',
    avatarChar: '🎭',
    avatarColor: 'from-rose-500 to-red-600',
    systemPrompt: 'You are Dr. Ruby. Expect critical thinking, structural composition, and rhetorical evidence.'
  },
  {
    id: 'solara',
    name: 'Coach Solara',
    speciality: 'Computer Science',
    style: 'Energetic, code block oriented, logical debugging',
    avatarChar: '⚡',
    avatarColor: 'from-amber-400 to-amber-600',
    systemPrompt: 'You are Coach Solara. Teach coding with real-time variables, game design hooks and debugging rules.'
  },
  {
    id: 'study_buddy',
    name: 'StudentOS Study Buddy',
    speciality: 'General Coaching',
    style: 'Friendly peer, energetic, schedules helper',
    avatarChar: '🚀',
    avatarColor: 'from-emerald-400 to-teal-600',
    systemPrompt: 'You are StudentOS Study Buddy. Help students keep track, summarize notes, and cheer them up!'
  }
];

export const INITIAL_FEEDBACK: FeedbackPost[] = [
  {
    id: 'feed-1',
    author: 'Aarav Patel',
    role: 'student',
    text: 'Can we expand the Vega computer laboratory hours on Friday afternoons? Many students are working on terminal project submissions and could use the workstations.',
    votes: 24,
    category: 'facilities',
    status: 'planned',
    createdAt: '2026-06-08T10:30:00Z',
    replies: [
      {
        author: 'Principal Mitchell',
        role: 'teacher',
        text: 'This is a reasonable request. I am scheduling Vega room supervision for Fridays starting next week!',
        createdAt: '2026-06-08T14:45:00Z'
      }
    ]
  },
  {
    id: 'feed-2',
    author: 'Priya Sharma',
    role: 'student',
    text: 'Requesting a dedicated Chemistry AP formula reference booklet before the exam block.',
    votes: 18,
    category: 'academic',
    status: 'solved',
    createdAt: '2026-06-07T09:15:00Z',
    replies: [
      {
        author: 'Dr. Ruby',
        role: 'teacher',
        text: 'The absolute formula sheet has been compiled and is now live in the Materials Hub under Science resources!',
        createdAt: '2026-06-07T12:00:00Z'
      }
    ]
  },
  {
    id: 'feed-3',
    author: 'Rohan Singh',
    role: 'student',
    text: 'Would be helpful to organize a mock debate championship between Houses (Ruby vs Sapphire, Emerald vs Topaz) to accumulate team points outside of sports!',
    votes: 12,
    category: 'events',
    status: 'in-progress',
    createdAt: '2026-06-08T16:20:00Z',
    replies: []
  }
];

export const INITIAL_MATERIALS: MaterialResource[] = [
  {
    id: 'mat-1',
    title: '📖 Physics Mechanics Formula Compendium',
    subject: 'Physics',
    type: 'pdf',
    description: 'Calculus-based derivations for rotational motion, translational mechanics, and torque systems.',
    uploadedBy: 'Prof. Elara',
    createdAt: '2026-06-07'
  },
  {
    id: 'mat-2',
    title: '🧪 Organic Chemistry Acid-Base Synthesis Guide',
    subject: 'Chemistry',
    type: 'pdf',
    description: 'Mechanisms for Lewis acids, bases, conjugate equilibrium indices, and pKa value lookup tables.',
    uploadedBy: 'Dr. Ruby',
    createdAt: '2026-06-06'
  },
  {
    id: 'mat-3',
    title: '💻 Complete Balanced BST Operations Code',
    subject: 'Computer Science',
    type: 'formula-sheet',
    description: 'C++ & TypeScript implementations for balancing tree depth, node height updates, and tree traversal sequences.',
    uploadedBy: 'Coach Solara',
    createdAt: '2026-06-08'
  }
];

export const MOCK_SCHEDULES: ScheduleItem[] = [
  { id: 'sch-1', subject: 'Calculus III lecture', time: '09:00 - 10:30', day: 'Monday' },
  { id: 'sch-2', subject: 'AP Physics Mechanics', time: '11:00 - 12:30', day: 'Monday' },
  { id: 'sch-3', subject: 'Data Structures & Trees', time: '14:00 - 15:30', day: 'Monday' },
  { id: 'sch-4', subject: 'English Rhetoric Seminar', time: '09:00 - 10:30', day: 'Tuesday' },
  { id: 'sch-5', subject: 'Organic Chemistry Lab', time: '11:00 - 13:00', day: 'Tuesday' }
];
