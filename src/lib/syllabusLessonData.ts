/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Authoritative Syllabus Lesson & Practice Content Repository
 * Provides structured educational steps: Concept breakdown, Worked Examples,
 * Step-by-Step hints, and Curriculum Practice Questions with explanations.
 */

export interface LessonExercise {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  hint: string;
  explanation: string;
}

export interface ChapterLessonContent {
  chapterId: string;
  subject: string;
  chapterNumber: number | string;
  title: string;
  conceptSummary: string;
  keyFormulasOrRules?: string[];
  workedExample: {
    problemStatement: string;
    stepByStepSolution: string[];
    keyTakeaway: string;
  };
  exercises: LessonExercise[];
}

export const CURRICULUM_LESSONS: Record<string, ChapterLessonContent> = {
  // ==========================================
  // MATHEMATICS
  // ==========================================
  math_g10_ch1: {
    chapterId: 'math_g10_ch1',
    subject: 'Mathematics',
    chapterNumber: 1,
    title: 'Real Numbers & Fundamental Arithmetic',
    conceptSummary:
      'Every composite number can be expressed (factorised) uniquely as a product of prime numbers, apart from the order in which the prime factors occur. Real numbers also include irrational numbers, which cannot be expressed as a ratio of two integers p/q.',
    keyFormulasOrRules: [
      'Fundamental Theorem of Arithmetic: Every integer n > 1 can be uniquely written as n = p₁ · p₂ · ... · pₖ.',
      'HCF(a, b) × LCM(a, b) = a × b (valid for any two positive integers a and b).',
      'If a prime p divides a², then p divides a (fundamental lemma for irrationality proofs).'
    ],
    workedExample: {
      problemStatement: 'Find the HCF and LCM of 72 and 120 using prime factorisation, and verify that HCF × LCM = 72 × 120.',
      stepByStepSolution: [
        'Step 1: Express 72 as a product of primes: 72 = 2³ × 3².',
        'Step 2: Express 120 as a product of primes: 120 = 2³ × 3 × 5.',
        'Step 3: HCF is the product of smallest powers of common prime factors: HCF = 2³ × 3¹ = 8 × 3 = 24.',
        'Step 4: LCM is the product of greatest powers of all prime factors: LCM = 2³ × 3² × 5¹ = 8 × 9 × 5 = 360.',
        'Step 5: Verify: HCF × LCM = 24 × 360 = 8640; 72 × 120 = 8640. Both sides match.'
      ],
      keyTakeaway: 'The product of two positive integers always equals the product of their HCF and LCM.'
    },
    exercises: [
      {
        id: 'math_ch1_q1',
        question: 'If HCF(306, 657) = 9, what is the LCM(306, 657)?',
        options: ['22,338', '18,520', '2,754', '24,192'],
        correctOptionIndex: 0,
        hint: 'Use the theorem: HCF(a, b) × LCM(a, b) = a × b. Rearrange to find LCM = (a × b) / HCF.',
        explanation: 'LCM = (306 × 657) / 9 = 34 × 657 = 22,338.'
      },
      {
        id: 'math_ch1_q2',
        question: 'What is the prime factorisation of 504?',
        options: ['2³ × 3² × 7', '2² × 3³ × 7', '2⁴ × 3 × 7', '2³ × 3 × 7²'],
        correctOptionIndex: 0,
        hint: 'Divide 504 successively by 2: 504/2 = 252, 252/2 = 126, 126/2 = 63, then divide by 3: 63/3 = 21, 21/3 = 7.',
        explanation: '504 = 8 × 9 × 7 = 2³ × 3² × 7.'
      },
      {
        id: 'math_ch1_q3',
        question: 'Which of the following numbers has a non-terminating repeating decimal expansion?',
        options: ['17 / 8', '13 / 3125', '29 / 343', '15 / 1600'],
        correctOptionIndex: 2,
        hint: 'A rational number p/q in simplest form has a terminating decimal expansion if and only if the denominator q has prime factors of only 2 and 5.',
        explanation: '343 = 7³. Since the denominator contains prime factor 7 (not 2 or 5), 29/343 is non-terminating repeating.'
      }
    ]
  },

  math_g10_ch2: {
    chapterId: 'math_g10_ch2',
    subject: 'Mathematics',
    chapterNumber: 2,
    title: 'Polynomials & Geometric Zeroes',
    conceptSummary:
      'The zeroes of a polynomial p(x) are the x-coordinates of the points where the graph y = p(x) intersects the x-axis. For a quadratic polynomial ax² + bx + c, the sum and product of zeroes are directly linked to the coefficients.',
    keyFormulasOrRules: [
      'Sum of zeroes: α + β = -b / a',
      'Product of zeroes: α · β = c / a',
      'Quadratic polynomial with zeroes α and β: k · [x² - (α + β)x + αβ]'
    ],
    workedExample: {
      problemStatement: 'Find the zeroes of the quadratic polynomial x² - 5x + 6, and verify the relationship between zeroes and coefficients.',
      stepByStepSolution: [
        'Step 1: Set x² - 5x + 6 = 0 and factorise by splitting middle term: (x - 2)(x - 3) = 0.',
        'Step 2: The zeroes are α = 2 and β = 3.',
        'Step 3: Sum of zeroes = α + β = 2 + 3 = 5. Formula: -b/a = -(-5)/1 = 5. Verified.',
        'Step 4: Product of zeroes = α · β = 2 × 3 = 6. Formula: c/a = 6/1 = 6. Verified.'
      ],
      keyTakeaway: 'Factoring quadratic expressions provides the roots, which verify -b/a and c/a relationships.'
    },
    exercises: [
      {
        id: 'math_ch2_q1',
        question: 'If one zero of the quadratic polynomial 2x² - 3x + k is 1/2, what is the value of k?',
        options: ['1', '-1', '2', '-2'],
        correctOptionIndex: 0,
        hint: 'Substitute x = 1/2 into 2x² - 3x + k = 0 and solve for k.',
        explanation: '2(1/2)² - 3(1/2) + k = 0 ⇒ 2(1/4) - 3/2 + k = 0 ⇒ 1/2 - 3/2 + k = 0 ⇒ -1 + k = 0 ⇒ k = 1.'
      },
      {
        id: 'math_ch2_q2',
        question: 'Find a quadratic polynomial whose sum and product of zeroes are -3 and 2, respectively.',
        options: ['x² + 3x + 2', 'x² - 3x + 2', 'x² + 3x - 2', 'x² - 3x - 2'],
        correctOptionIndex: 0,
        hint: 'General form is x² - (Sum)x + (Product). Substitute Sum = -3 and Product = 2.',
        explanation: 'x² - (-3)x + 2 = x² + 3x + 2.'
      },
      {
        id: 'math_ch2_q3',
        question: 'The graph of y = p(x) cuts the x-axis at 3 distinct points. How many zeroes does p(x) have?',
        options: ['3 zeroes', '1 zero', '2 zeroes', 'Infinite zeroes'],
        correctOptionIndex: 0,
        hint: 'The number of real zeroes of y = p(x) equals the number of times its graph intersects the x-axis.',
        explanation: 'Since the curve crosses the x-axis at 3 distinct points, p(x) has exactly 3 real zeroes.'
      }
    ]
  },

  math_g10_ch4: {
    chapterId: 'math_g10_ch4',
    subject: 'Mathematics',
    chapterNumber: 4,
    title: 'Quadratic Equations & Discriminants',
    conceptSummary:
      'A quadratic equation in standard form is ax² + bx + c = 0 (a ≠ 0). The discriminant D = b² - 4ac determines whether roots are real, equal, or complex.',
    keyFormulasOrRules: [
      'Quadratic formula: x = [-b ± √(b² - 4ac)] / (2a)',
      'Discriminant D = b² - 4ac',
      'If D > 0: Two distinct real roots',
      'If D = 0: Two equal real roots (x = -b / 2a)',
      'If D < 0: No real roots'
    ],
    workedExample: {
      problemStatement: 'Find the nature of the roots of 2x² - 4x + 3 = 0, and solve if real.',
      stepByStepSolution: [
        'Step 1: Identify coefficients: a = 2, b = -4, c = 3.',
        'Step 2: Calculate discriminant D = b² - 4ac = (-4)² - 4(2)(3) = 16 - 24 = -8.',
        'Step 3: Analyze D: Since D = -8 < 0, there are no real roots for this equation.',
        'Step 4: Conclusion: The parabola y = 2x² - 4x + 3 lies entirely above the x-axis.'
      ],
      keyTakeaway: 'Always calculate the discriminant D first before attempting to apply the quadratic formula.'
    },
    exercises: [
      {
        id: 'math_ch4_q1',
        question: 'For what value of k does the quadratic equation 4x² - 2kx + 9 = 0 have equal real roots?',
        options: ['k = ±6', 'k = ±12', 'k = 6 only', 'k = 3'],
        correctOptionIndex: 0,
        hint: 'For equal real roots, set the discriminant D = b² - 4ac = 0.',
        explanation: 'D = (-2k)² - 4(4)(9) = 4k² - 144 = 0 ⇒ 4k² = 144 ⇒ k² = 36 ⇒ k = ±6.'
      },
      {
        id: 'math_ch4_q2',
        question: 'Solve x² - 7x + 12 = 0 by factorisation.',
        options: ['x = 3, 4', 'x = -3, -4', 'x = 2, 6', 'x = -2, -6'],
        correctOptionIndex: 0,
        hint: 'Find two numbers that multiply to 12 and add to -7: (-3) and (-4).',
        explanation: '(x - 3)(x - 4) = 0 ⇒ x = 3 or x = 4.'
      },
      {
        id: 'math_ch4_q3',
        question: 'What is the discriminant of the equation 3x² - 5x + 2 = 0?',
        options: ['1', '-1', '49', '25'],
        correctOptionIndex: 0,
        hint: 'Calculate D = b² - 4ac where a = 3, b = -5, c = 2.',
        explanation: 'D = (-5)² - 4(3)(2) = 25 - 24 = 1. Since D > 0 and a perfect square, roots are real and rational.'
      }
    ]
  },

  // ==========================================
  // PHYSICS
  // ==========================================
  phys_g10_ch1: {
    chapterId: 'phys_g10_ch1',
    subject: 'Physics',
    chapterNumber: 1,
    title: 'Light: Reflection and Refraction',
    conceptSummary:
      'Light travels in straight lines in a uniform medium. Reflection follows the law that angle of incidence equals angle of reflection. Refraction is the bending of light as it passes from one optical medium to another due to a change in speed.',
    keyFormulasOrRules: [
      'Mirror Formula: 1/f = 1/v + 1/u',
      'Lens Formula: 1/f = 1/v - 1/u',
      'Magnification (mirror): m = -v/u = h\'/h; (lens): m = +v/u = h\'/h',
      'Snell’s Law of Refraction: sin(i) / sin(r) = n₂ / n₁',
      'Power of a Lens: P = 1 / f(in meters) (Unit: Dioptre, D)'
    ],
    workedExample: {
      problemStatement: 'A convex lens of focal length 20 cm forms a real, inverted image at a distance of 30 cm from the lens. Find the object distance and magnification.',
      stepByStepSolution: [
        'Step 1: Sign convention for convex lens: focal length f = +20 cm. Real image is on the opposite side: v = +30 cm.',
        'Step 2: Apply Lens Formula: 1/f = 1/v - 1/u ⇒ 1/20 = 1/30 - 1/u.',
        'Step 3: Solve for 1/u: 1/u = 1/30 - 1/20 = (2 - 3)/60 = -1/60 ⇒ u = -60 cm.',
        'Step 4: Compute magnification: m = v/u = (+30)/(-60) = -0.5.',
        'Step 5: Interpretation: Negative magnification confirms a real, inverted, and diminished image (half size).'
      ],
      keyTakeaway: 'Always apply Cartesian sign conventions: object distance u is always negative.'
    },
    exercises: [
      {
        id: 'phys_ch1_q1',
        question: 'A convex mirror used for rear-view on an automobile has a radius of curvature of 3.00 m. What is its focal length?',
        options: ['+1.50 m', '-1.50 m', '+3.00 m', '+0.75 m'],
        correctOptionIndex: 0,
        hint: 'The focal length of a spherical mirror is half its radius of curvature: f = R / 2. Convex mirrors have a positive focal length.',
        explanation: 'f = R / 2 = +3.00 / 2 = +1.50 m.'
      },
      {
        id: 'phys_ch1_q2',
        question: 'What is the power of a concave lens of focal length 2 m?',
        options: ['-0.5 D', '+0.5 D', '-2.0 D', '+2.0 D'],
        correctOptionIndex: 0,
        hint: 'Power P = 1 / f (in meters). For a concave lens, focal length is negative.',
        explanation: 'f = -2 m ⇒ P = 1 / (-2) = -0.5 D (Dioptres).'
      },
      {
        id: 'phys_ch1_q3',
        question: 'When light travels from glass (n = 1.5) into water (n = 1.33), how does its ray bend?',
        options: [
          'Bends away from the normal and speeds up',
          'Bends towards the normal and slows down',
          'Travels undeviated without bending',
          'Reflects entirely back without entering water'
        ],
        correctOptionIndex: 0,
        hint: 'Glass is optically denser than water. Moving from denser to rarer medium causes light to speed up and bend away from the normal.',
        explanation: 'Passing from an optically denser medium (glass) to a rarer medium (water), the light ray accelerates and bends away from the normal.'
      }
    ]
  },

  // ==========================================
  // CHEMISTRY
  // ==========================================
  chem_g10_ch2: {
    chapterId: 'chem_g10_ch2',
    subject: 'Chemistry',
    chapterNumber: 2,
    title: 'Acids, Bases, and Salts',
    conceptSummary:
      'Acids produce H⁺ (hydronium H₃O⁺) ions in aqueous solution and turn blue litmus red. Bases produce OH⁻ ions and turn red litmus blue. The pH scale measures hydrogen ion concentration from 0 (strongly acidic) to 14 (strongly alkaline), with 7 being neutral.',
    keyFormulasOrRules: [
      'Neutralisation reaction: Acid + Base → Salt + Water (Exothermic)',
      'Metal + Acid → Salt + Hydrogen Gas (H₂ pops with burning splinter)',
      'Baking Soda: Sodium Hydrogen Carbonate (NaHCO₃)',
      'Plaster of Paris: CaSO₄ · 0.5 H₂O (prepared by heating Gypsum at 373 K)'
    ],
    workedExample: {
      problemStatement: 'Explain what happens when carbon dioxide gas is passed through lime water first for a short duration, and then in excess.',
      stepByStepSolution: [
        'Step 1: Short duration: Lime water Ca(OH)₂ reacts with CO₂ to form insoluble calcium carbonate CaCO₃.',
        'Reaction: Ca(OH)₂ + CO₂ → CaCO₃(s) [milky precipitate] + H₂O.',
        'Step 2: Excess CO₂: The precipitate dissolves because soluble calcium hydrogen carbonate is formed.',
        'Reaction: CaCO₃ + H₂O + CO₂ → Ca(HCO₃)₂(aq) [clear solution].',
        'Step 3: Key takeaway: This is the definitive laboratory test for carbon dioxide gas.'
      ],
      keyTakeaway: 'Milkiness appears due to CaCO₃ precipitate and clears on excess CO₂ due to soluble Ca(HCO₃)₂.'
    },
    exercises: [
      {
        id: 'chem_ch2_q1',
        question: 'Which of the following compounds is known chemically as Plaster of Paris?',
        options: ['CaSO₄ · ½ H₂O', 'CaSO₄ · 2 H₂O', 'CaCO₃', 'CaOCl₂'],
        correctOptionIndex: 0,
        hint: 'It is calcium sulphate hemihydrate, prepared by gently heating gypsum (which has 2 water molecules).',
        explanation: 'Plaster of Paris is calcium sulphate hemihydrate: CaSO₄ · ½ H₂O. Gypsum is CaSO₄ · 2 H₂O.'
      },
      {
        id: 'chem_ch2_q2',
        question: 'A solution turns red litmus paper blue. Its pH is likely to be:',
        options: ['10', '1', '4', '5'],
        correctOptionIndex: 0,
        hint: 'Red litmus turns blue in a basic (alkaline) solution. A basic solution has pH > 7.',
        explanation: 'Bases have pH values greater than 7 and turn red litmus blue. Among the options, pH 10 is basic.'
      },
      {
        id: 'chem_ch2_q3',
        question: 'What gas is evolved when zinc metal reacts with dilute sulphuric acid?',
        options: ['Hydrogen (H₂)', 'Oxygen (O₂)', 'Carbon dioxide (CO₂)', 'Sulphur dioxide (SO₂)'],
        correctOptionIndex: 0,
        hint: 'Active metal + dilute acid → salt + hydrogen gas. The gas burns with a pop sound.',
        explanation: 'Zn + H₂SO₄ → ZnSO₄ + H₂↑. Hydrogen gas is liberated.'
      }
    ]
  },

  // ==========================================
  // COMPUTER SCIENCE
  // ==========================================
  cs_g10_ch1: {
    chapterId: 'cs_g10_ch1',
    subject: 'Computer Science',
    chapterNumber: 1,
    title: 'Networking Basics & Internet Protocols',
    conceptSummary:
      'A computer network consists of interconnected computing devices that exchange data using communication protocols. Networks are classified by geographical span (LAN, MAN, WAN) and topology (Star, Bus, Ring, Mesh). Communication over the internet is governed by the TCP/IP protocol suite.',
    keyFormulasOrRules: [
      'LAN (Local Area Network): Confined to a single room, office, or campus (< 1 km).',
      'WAN (Wide Area Network): Spans cities, countries, or the globe (e.g. the Internet).',
      'Star Topology: All nodes connect to a central switch/hub. Failure of one cable affects only that node.',
      'TCP (Transmission Control Protocol): Connection-oriented, reliable, packet sequencing and retransmission.',
      'IP (Internet Protocol): Addressing and routing packets across network boundaries (IPv4: 32-bit, IPv6: 128-bit).'
    ],
    workedExample: {
      problemStatement: 'Compare IPv4 and IPv6 addressing schemes, and calculate how many bits are used in each.',
      stepByStepSolution: [
        'Step 1: IPv4 uses 32 bits divided into 4 octets separated by dots (e.g., 192.168.1.1). Total addresses = 2³² ≈ 4.3 billion.',
        'Step 2: Due to address exhaustion, IPv6 was introduced, using 128 bits divided into 8 groups of hexadecimal digits separated by colons (e.g., 2001:0db8::1).',
        'Step 3: Total IPv6 addresses = 2¹²⁸ (virtually limitless for every device on Earth).',
        'Step 4: IPv6 also includes native IPSec support and eliminates the requirement for NAT.'
      ],
      keyTakeaway: 'IPv4 is 32-bit (dotted-decimal); IPv6 is 128-bit (hexadecimal colon-separated).'
    },
    exercises: [
      {
        id: 'cs_ch1_q1',
        question: 'In which network topology does the failure of the central switch or hub disrupt the entire network?',
        options: ['Star Topology', 'Bus Topology', 'Ring Topology', 'Mesh Topology'],
        correctOptionIndex: 0,
        hint: 'In this topology, every computer has a dedicated point-to-point link to a central controller.',
        explanation: 'In a Star topology, all devices communicate through a central hub or switch. If the hub fails, communication ceases for all nodes.'
      },
      {
        id: 'cs_ch1_q2',
        question: 'Which protocol is responsible for resolving a domain name (like www.google.com) into an IP address?',
        options: ['DNS', 'DHCP', 'FTP', 'SMTP'],
        correctOptionIndex: 0,
        hint: 'DNS stands for Domain Name System, the phonebook of the Internet.',
        explanation: 'DNS (Domain Name System) translates human-friendly domain names into machine-readable numerical IP addresses.'
      },
      {
        id: 'cs_ch1_q3',
        question: 'How many bits are used in an IPv4 address compared to an IPv6 address?',
        options: ['32 bits in IPv4, 128 bits in IPv6', '16 bits in IPv4, 64 bits in IPv6', '64 bits in IPv4, 128 bits in IPv6', '32 bits in IPv4, 64 bits in IPv6'],
        correctOptionIndex: 0,
        hint: 'IPv4 has 4 bytes (4 × 8 = 32 bits), while IPv6 has 16 bytes (16 × 8 = 128 bits).',
        explanation: 'IPv4 addresses are 32 bits long. IPv6 addresses are 128 bits long.'
      }
    ]
  }
};

/**
 * Helper to synthesize an educational lesson for any chapter
 * whether pre-authored or dynamically published by faculty.
 */
export function getOrSynthesizeChapterLesson(
  chapterId: string,
  subject: string,
  chapterNumber: number | string,
  title: string,
  topics: string[] = [],
  notes: string = ''
): ChapterLessonContent {
  if (CURRICULUM_LESSONS[chapterId]) {
    return CURRICULUM_LESSONS[chapterId];
  }

  // Pedagogical Synthesis based on syllabus metadata
  const cleanTopics = topics.length > 0 ? topics : [title];
  const conceptSummary = notes.trim()
    ? notes
    : `In Chapter ${chapterNumber}: "${title}", you will master foundational concepts in ${subject}. Key curriculum topics include ${cleanTopics.slice(0, 3).join(', ')}.`;

  const workedExample = {
    problemStatement: `Key Problem Analysis: Understanding ${cleanTopics[0] || title} in ${subject}.`,
    stepByStepSolution: [
      `Step 1: Identify the given criteria and fundamental definitions in ${cleanTopics[0] || title}.`,
      `Step 2: Apply the core theorem or rule governing ${subject} principles for this topic.`,
      `Step 3: Analyze constraints, verify units or logic, and formulate the standard solution.`,
      `Step 4: Review: Ensure the conclusion matches official curriculum expectations.`
    ],
    keyTakeaway: `Mastering the definition and step-by-step methodology for ${cleanTopics[0] || title} ensures full marks on board assessments.`
  };

  const exercises: LessonExercise[] = cleanTopics.slice(0, 3).map((topic, i) => ({
    id: `synth_${chapterId}_q${i + 1}`,
    question: `Which statement best describes the primary principle of "${topic}" in ${subject}?`,
    options: [
      `It establishes the standard core rules and verified relationships for ${topic}.`,
      `It is an optional observation with no direct bearing on ${subject} examination questions.`,
      `It replaces all previous foundational theories without mathematical or scientific proof.`,
      `It only applies in laboratory conditions and is never examined in board papers.`
    ],
    correctOptionIndex: 0,
    hint: `Focus on the foundational academic definitions provided in standard school textbooks for ${topic}.`,
    explanation: `Option A is correct: In ${subject}, "${topic}" defines the authoritative, tested principles required for your examinations.`
  }));

  return {
    chapterId,
    subject,
    chapterNumber,
    title,
    conceptSummary,
    keyFormulasOrRules: [
      `Official Curriculum Focus: ${cleanTopics.join(' · ')}`,
      `Always state standard units, definitions, and step-by-step derivations in your answers.`
    ],
    workedExample,
    exercises
  };
}
