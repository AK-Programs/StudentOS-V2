/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — AI Tutor Structured Content Renderer Regression Test Suite
 * Tests all 10 required scenarios ensuring React Error #31 can never recur.
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  StructuredContentRenderer,
  normalizeTutorContent,
  extractTutorText
} from '../src/components/syllabus/StructuredContentRenderer';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true });
    console.log(`✅ [PASS] ${name}`);
  } else {
    results.push({ name, passed: false, details });
    console.error(`❌ [FAIL] ${name}: ${details}`);
  }
}

console.log('====================================================');
console.log('StudentOS AI Tutor Content Renderer Regression Tests');
console.log('====================================================\n');

// ---------------------------------------------------------------------------
// Test 1: Rendering a normal string explanation
// ---------------------------------------------------------------------------
try {
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StructuredContentRenderer, {
      content: "Ohm's Law states that current is directly proportional to voltage and inversely proportional to resistance: **V = IR**."
    })
  );
  assert(
    html.includes("Ohm&#x27;s Law") && html.includes('V = IR') && html.includes('<strong'),
    'Test 1: Render normal string explanation with bold formatting',
    `Received HTML: ${html}`
  );
} catch (e: any) {
  assert(false, 'Test 1: Render normal string explanation', e?.message);
}

// ---------------------------------------------------------------------------
// Test 2: Rendering "{ text, analogy }" correctly
// ---------------------------------------------------------------------------
try {
  const structuredData = {
    text: 'Mitochondria generate ATP through cellular respiration.',
    analogy: 'Think of mitochondria as the power plant of a bustling city, generating electricity for all factories.'
  };
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StructuredContentRenderer, {
      content: structuredData
    })
  );

  assert(
    html.includes('Mitochondria generate ATP') &&
    html.includes('Real-World Analogy') &&
    html.includes('power plant of a bustling city') &&
    !html.includes('[object Object]'),
    'Test 2: Render { text, analogy } object with distinct analogy card',
    `Received HTML: ${html}`
  );
} catch (e: any) {
  assert(false, 'Test 2: Render { text, analogy } correctly', e?.message);
}

// ---------------------------------------------------------------------------
// Test 3: Rendering an explanation when the analogy is missing
// ---------------------------------------------------------------------------
try {
  const onlyText = {
    text: 'Plant cell walls are composed of rigid cellulose fibers.'
  };
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StructuredContentRenderer, {
      content: onlyText
    })
  );

  assert(
    html.includes('Plant cell walls are composed of rigid cellulose fibers') &&
    !html.includes('Real-World Analogy') &&
    !html.includes('[object Object]'),
    'Test 3: Render explanation when analogy is missing (no empty analogy card)',
    `Received HTML: ${html}`
  );
} catch (e: any) {
  assert(false, 'Test 3: Render explanation when analogy is missing', e?.message);
}

// ---------------------------------------------------------------------------
// Test 4: Rendering supported nested lesson sections
// ---------------------------------------------------------------------------
try {
  const nestedWorkedExample = {
    problem: { text: 'A 9V battery powers a circuit with 30 ohms resistance.', analogy: 'Water pressure pushing through a pipe' },
    steps: [
      { title: { text: 'Step 1' }, detail: { text: 'Apply Ohm’s Law: I = V / R' } },
      { title: 'Step 2', detail: { text: 'I = 9 / 30 = 0.3 Amperes' } }
    ]
  };

  const htmlProblem = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StructuredContentRenderer, { content: nestedWorkedExample.problem })
  );
  const htmlStep1 = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StructuredContentRenderer, { content: nestedWorkedExample.steps[0].detail })
  );

  assert(
    htmlProblem.includes('9V battery powers a circuit') &&
    htmlProblem.includes('Water pressure') &&
    htmlStep1.includes('Apply Ohm’s Law') &&
    !htmlProblem.includes('[object Object]'),
    'Test 4: Render nested lesson sections safely',
    `Problem HTML: ${htmlProblem}`
  );
} catch (e: any) {
  assert(false, 'Test 4: Render nested lesson sections', e?.message);
}

// ---------------------------------------------------------------------------
// Test 5: Rendering supported arrays of content blocks
// ---------------------------------------------------------------------------
try {
  const blockArray = [
    'First foundational principle of genetics.',
    { text: 'Second mechanism: alleles segregate during gamete formation.', analogy: 'Like dealing two cards to separate players.' },
    { explanation: 'Third rule: independent assortment of chromosomes.' }
  ];

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StructuredContentRenderer, { content: blockArray })
  );

  assert(
    html.includes('First foundational principle') &&
    html.includes('alleles segregate') &&
    html.includes('dealing two cards') &&
    html.includes('independent assortment') &&
    !html.includes('[object Object]'),
    'Test 5: Render arrays of content blocks sequentially',
    `Received HTML: ${html}`
  );
} catch (e: any) {
  assert(false, 'Test 5: Render arrays of content blocks', e?.message);
}

// ---------------------------------------------------------------------------
// Test 6: Handling null, empty, malformed, and unexpected responses without crashing
// ---------------------------------------------------------------------------
try {
  const htmlNull = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: null }));
  const htmlUndefined = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: undefined }));
  const htmlEmpty = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: '' }));
  const htmlEmptyObj = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: {} }));
  const htmlRandomKeys = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: { randomProp: 'Important note' } }));
  const htmlNumber = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: 42 }));
  const htmlBoolean = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: true }));

  assert(
    htmlNull === '' &&
    htmlUndefined === '' &&
    htmlEmpty === '' &&
    htmlEmptyObj === '' &&
    htmlRandomKeys.includes('Important note') &&
    htmlNumber.includes('42') &&
    htmlBoolean.includes('true') &&
    !htmlRandomKeys.includes('[object Object]'),
    'Test 6: Gracefully handle null, undefined, empty, numbers, booleans, and arbitrary objects',
    `RandomKeys HTML: ${htmlRandomKeys}`
  );
} catch (e: any) {
  assert(false, 'Test 6: Handling unexpected responses', e?.message);
}

// ---------------------------------------------------------------------------
// Test 7: Handling streamed responses and incomplete structured output
// ---------------------------------------------------------------------------
try {
  // Partial streaming state where only text prefix has arrived
  const streamingPartial1 = 'The nucleus coordinates';
  const streamingPartial2 = { text: 'The nucleus coordinates cell activity and contains chromosomes' };
  const streamingPartialWithIncompleteAnalogy = { text: 'Cell membrane controls transport', analogy: 'Bouncer at a venue' };

  const html1 = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: streamingPartial1 }));
  const html2 = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: streamingPartial2 }));
  const html3 = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: streamingPartialWithIncompleteAnalogy }));

  assert(
    html1.includes('The nucleus coordinates') &&
    html2.includes('cell activity and contains chromosomes') &&
    html3.includes('Bouncer at a venue') &&
    !html3.includes('[object Object]'),
    'Test 7: Handle streaming partial responses and incomplete structured output cleanly',
    `Streaming HTML: ${html3}`
  );
} catch (e: any) {
  assert(false, 'Test 7: Handling streamed responses', e?.message);
}

// ---------------------------------------------------------------------------
// Test 8: Rendering practice questions, hints, and assessment feedback
// ---------------------------------------------------------------------------
try {
  const practiceQuestion = {
    question: { text: 'Which organelle is responsible for cellular respiration?' },
    options: [
      { text: 'Chloroplast' },
      'Mitochondria',
      { text: 'Ribosome' },
      'Endoplasmic Reticulum'
    ],
    hint: { text: 'It produces ATP and is often called the powerhouse of the cell.', analogy: 'Like a battery generator' },
    explanation: { text: 'Mitochondria are the sites of cellular respiration.', analogy: 'Where glucose is combusted into fuel' }
  };

  const htmlQ = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: practiceQuestion.question }));
  const htmlOpt1 = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: practiceQuestion.options[0], inline: true }));
  const htmlHint = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: practiceQuestion.hint }));
  const htmlFeedback = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: practiceQuestion.explanation }));

  assert(
    htmlQ.includes('cellular respiration') &&
    htmlOpt1.includes('Chloroplast') &&
    htmlHint.includes('produces ATP') &&
    htmlHint.includes('battery generator') &&
    htmlFeedback.includes('combusted into fuel') &&
    !htmlOpt1.includes('[object Object]') &&
    !htmlHint.includes('[object Object]'),
    'Test 8: Render practice questions, structured options, hints, and feedback',
    `Hint HTML: ${htmlHint}`
  );
} catch (e: any) {
  assert(false, 'Test 8: Rendering practice questions', e?.message);
}

// ---------------------------------------------------------------------------
// Test 9: Restoring persisted structured lesson content (JSON serialization)
// ---------------------------------------------------------------------------
try {
  const originalLesson = {
    topic: 'Photosynthesis',
    coreExplanation: {
      text: 'Plants convert solar energy into chemical energy stored in glucose: 6CO2 + 6H2O -> C6H12O6 + 6O2.',
      analogy: 'Solar panels capturing sunlight to charge a battery pack.'
    },
    keyPoints: [
      { text: 'Light-dependent reactions occur in the thylakoid membranes.' },
      { text: 'Calvin cycle occurs in the stroma.' }
    ]
  };

  // Simulate JSON serialization to and from database / sessionStorage
  const serialized = JSON.stringify(originalLesson);
  const restored = JSON.parse(serialized);

  const htmlCore = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StructuredContentRenderer, { content: restored.coreExplanation })
  );
  const htmlKey1 = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StructuredContentRenderer, { content: restored.keyPoints[0], inline: true })
  );

  assert(
    htmlCore.includes('chemical energy stored in glucose') &&
    htmlCore.includes('Solar panels capturing sunlight') &&
    htmlKey1.includes('thylakoid membranes') &&
    !htmlCore.includes('[object Object]'),
    'Test 9: Restoring and rendering persisted structured lesson content',
    `Restored Core HTML: ${htmlCore}`
  );
} catch (e: any) {
  assert(false, 'Test 9: Restoring persisted content', e?.message);
}

// ---------------------------------------------------------------------------
// Test 10: Confirming the tutor does not render raw JavaScript objects or JSON unintentionally
// ---------------------------------------------------------------------------
try {
  const trickyCases = [
    { text: 'Direct text' },
    { text: 'Text with analogy', analogy: 'Analogy value' },
    { explanation: 'Custom explanation field', analogy: 'Custom analogy' },
    { fullExplanation: 'Full explanation field' },
    { unknownKey1: 'Val1', unknownKey2: 'Val2' },
    [{ text: 'Array item 1' }, { text: 'Array item 2', analogy: 'Analogy 2' }],
    { text: { nested: 'Deeply nested text' } }
  ];

  let rawObjectFound = false;
  let rawJsonDumpFound = false;

  for (const c of trickyCases) {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(StructuredContentRenderer, { content: c }));
    if (html.includes('[object Object]')) {
      rawObjectFound = true;
      console.error('Found [object Object] in:', html);
    }
    if (html.includes('{"text":') || html.includes('{"analogy":')) {
      rawJsonDumpFound = true;
      console.error('Found raw JSON dump in:', html);
    }

    // Verify extractTutorText also never outputs [object Object]
    const extracted = extractTutorText(c);
    if (extracted.includes('[object Object]')) {
      rawObjectFound = true;
      console.error('Found [object Object] in extractTutorText:', extracted);
    }
  }

  assert(
    !rawObjectFound && !rawJsonDumpFound,
    'Test 10: Zero instances of [object Object] or unparsed JSON rendered to JSX',
    'Detected raw object or JSON dump in output'
  );
} catch (e: any) {
  assert(false, 'Test 10: Raw object leak check', e?.message);
}

console.log('\n====================================================');
const passedCount = results.filter(r => r.passed).length;
console.log(`Summary: ${passedCount} / ${results.length} tests passed.`);
console.log('====================================================');

if (passedCount !== results.length) {
  process.exit(1);
} else {
  process.exit(0);
}
