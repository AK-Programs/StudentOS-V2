/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Veylentra Lecture Notes Document Types & Schema
 */

export type BlockType = 
  | 'heading'
  | 'paragraph'
  | 'concept'
  | 'formula'
  | 'worked_example'
  | 'definition'
  | 'callout'
  | 'recall_question'
  | 'table'
  | 'list'
  | 'diagram'
  | 'sketch'
  | 'code'
  | 'divider';

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  level: 1 | 2 | 3;
  text: string;
}

export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  text: string;
}

export interface ConceptBlock extends BaseBlock {
  type: 'concept';
  title: string;
  explanation: string;
  keyTakeaway: string;
  example?: string;
}

export interface FormulaVariable {
  symbol: string;
  meaning: string;
  unit?: string;
}

export interface FormulaBlock extends BaseBlock {
  type: 'formula';
  name: string;
  latex: string;
  explanation?: string;
  variables: FormulaVariable[];
  example?: string;
}

export interface WorkedExampleBlock extends BaseBlock {
  type: 'worked_example';
  problem: string;
  given?: string;
  required?: string;
  steps: string[];
  finalAnswer: string;
}

export interface DefinitionBlock extends BaseBlock {
  type: 'definition';
  term: string;
  pronunciation?: string;
  definition: string;
  context?: string;
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  variant: 'info' | 'warning' | 'exam_tip' | 'mistake' | 'teacher_note';
  title: string;
  text: string;
}

export interface RecallQuestionBlock extends BaseBlock {
  type: 'recall_question';
  question: string;
  answer: string;
  explanation?: string;
  isRevealed?: boolean;
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface ListItem {
  id: string;
  text: string;
  checked?: boolean;
  indent?: number;
}

export interface ListBlock extends BaseBlock {
  type: 'list';
  listType: 'bullet' | 'number' | 'checklist';
  items: ListItem[];
}

export interface DiagramBlock extends BaseBlock {
  type: 'diagram';
  title: string;
  diagramType: 'flowchart' | 'process' | 'comparison' | 'mindmap';
  nodes: { id: string; label: string; details?: string; color?: string }[];
  connections?: { from: string; to: string; label?: string }[];
  svgData?: string;
}

export interface SketchBlock extends BaseBlock {
  type: 'sketch';
  dataUrl: string;
  caption?: string;
}

export interface CodeBlock extends BaseBlock {
  type: 'code';
  language: string;
  code: string;
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
}

export type EducationalBlock = 
  | HeadingBlock
  | ParagraphBlock
  | ConceptBlock
  | FormulaBlock
  | WorkedExampleBlock
  | DefinitionBlock
  | CalloutBlock
  | RecallQuestionBlock
  | TableBlock
  | ListBlock
  | DiagramBlock
  | SketchBlock
  | CodeBlock
  | DividerBlock;

export interface EducationalDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  subject: string;
  icon?: string;
  coverBg?: string;
  blocks: EducationalBlock[];
  tags?: string[];
  folderId?: string | null;
  linkedHomeworkIds?: string[];
  updatedAt?: string;
  createdAt?: string;
}

export interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  content: string;
  createdAt: string;
  savedBy?: string;
}

export interface NoteFolder {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
  createdAt?: string;
}

export interface NoteHomeworkLink {
  id: string;
  noteId: string;
  homeworkId: string;
  linkedBy: string;
  createdAt: string;
  noteTitle?: string;
  noteSubject?: string;
  homeworkTitle?: string;
  homeworkSubject?: string;
  dueDate?: string;
}
