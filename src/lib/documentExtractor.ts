/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Document & Attachment Extraction Engine
 * - Extracts text from PDF using PDF.js
 * - Extracts text from DOCX and PPTX using JSZip + XML parsing
 * - Extracts text from legacy DOC / PPT using binary text recovery
 * - Extracts text from plain text formats (MD, TXT, CSV, JSON)
 * - Converts images into clean base64 data for Gemini multimodal processing
 */

import JSZip from 'jszip';

export interface ExtractedAttachment {
  name: string;
  size: number;
  type: string;
  content: string; // extracted text or data URL
  mimeType?: string;
  base64Data?: string; // clean base64 without data URI scheme
  isImage: boolean;
  extractionError?: string;
}

/**
 * Ensures PDF.js library and CDN worker are loaded reliably.
 */
export async function ensurePdfJsLoaded(): Promise<any> {
  let pdfjsLib = (window as any).pdfjsLib;

  if (!pdfjsLib) {
    try {
      await new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector('script[src*="pdf.min.js"]');
        if (existingScript) {
          existingScript.addEventListener('load', () => resolve());
          existingScript.addEventListener('error', () => reject(new Error('Failed loading PDF.js script.')));
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed loading PDF.js script from CDN.'));
        document.head.appendChild(script);
      });
      pdfjsLib = (window as any).pdfjsLib;
    } catch (err) {
      throw new Error('PDF.js engine could not be loaded from CDN.');
    }
  }

  if (!pdfjsLib) {
    throw new Error('PDF.js engine is unavailable.');
  }

  try {
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    }
  } catch (_) {}

  return pdfjsLib;
}

/**
 * Extract text from PDF using PDF.js
 * - Joins text items with a space and handles EOL line breaks cleanly (never join(''))
 * - Rejects text under 20 characters (scanned PDFs)
 * - Caps total length at a safe limit while preserving the start of document
 */
export async function extractPDFText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('PDF file is empty.');
  }

  let pdfjsLib: any;
  try {
    pdfjsLib = await ensurePdfJsLoaded();
  } catch (err: any) {
    throw new Error('PDF could not be read: engine failed to initialize.');
  }

  let pdf: any;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdf = await loadingTask.promise;
  } catch (pdfErr: any) {
    throw new Error(`PDF could not be read: ${pdfErr?.message || 'invalid or corrupted PDF file'}.`);
  }

  let entireText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    let pageLines: string[] = [];
    let currentLineItems: string[] = [];

    for (const item of textContent.items) {
      const str = (item.str || '').trim();
      if (str) {
        currentLineItems.push(str);
      }
      if (item.hasEOL) {
        if (currentLineItems.length > 0) {
          pageLines.push(currentLineItems.join(' '));
          currentLineItems = [];
        }
      }
    }
    if (currentLineItems.length > 0) {
      pageLines.push(currentLineItems.join(' '));
    }

    const pageText = pageLines.join('\n').trim();
    if (pageText) {
      entireText += `[Page ${i}]\n${pageText}\n\n`;
    }
  }

  const trimmed = entireText.trim();
  if (!trimmed || trimmed.length < 20) {
    throw new Error('This PDF has no readable text. Please provide a text PDF or upload a photo/image of the page.');
  }

  // Cap at safe length (15,000 chars) while preserving start of document
  const MAX_CAP = 15000;
  if (trimmed.length > MAX_CAP) {
    return trimmed.slice(0, MAX_CAP) + '\n\n[...Remainder of PDF text truncated for performance...]';
  }

  return trimmed;
}

/**
 * Extract text from DOCX using JSZip to parse word/document.xml
 */
export async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('DOCX file is empty.');
  }

  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Invalid DOCX format: missing word/document.xml.');
  }

  const xmlText = await docXmlFile.async('text');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

  const paragraphs = xmlDoc.getElementsByTagName('w:p');
  const lines: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const textNodes = p.getElementsByTagName('w:t');
    let pText = '';
    for (let j = 0; j < textNodes.length; j++) {
      pText += textNodes[j].textContent || '';
    }
    if (pText.trim()) {
      lines.push(pText.trim());
    }
  }

  const result = lines.join('\n');
  if (!result.trim()) {
    throw new Error('DOCX document contains no extractable text.');
  }
  return result;
}

/**
 * Extract text from PPTX using JSZip to parse ppt/slides/slide*.xml
 */
export async function extractPptxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('PPTX file is empty.');
  }

  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideEntries: { num: number; file: JSZip.JSZipObject }[] = [];

  zip.forEach((relativePath, zipEntry) => {
    const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (match) {
      slideEntries.push({ num: parseInt(match[1], 10), file: zipEntry });
    }
  });

  slideEntries.sort((a, b) => a.num - b.num);
  if (slideEntries.length === 0) {
    throw new Error('Invalid PPTX format: no slide XML files found.');
  }

  const parser = new DOMParser();
  const slideOutputs: string[] = [];

  for (const entry of slideEntries) {
    const xmlText = await entry.file.async('text');
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    const paragraphs = xmlDoc.getElementsByTagName('a:p');
    const pLines: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const textNodes = p.getElementsByTagName('a:t');
      let pText = '';
      for (let j = 0; j < textNodes.length; j++) {
        pText += textNodes[j].textContent || '';
      }
      if (pText.trim()) {
        pLines.push(pText.trim());
      }
    }

    if (pLines.length > 0) {
      slideOutputs.push(`[Slide ${entry.num}]\n${pLines.join('\n')}`);
    }
  }

  const result = slideOutputs.join('\n\n');
  if (!result.trim()) {
    throw new Error('PPTX presentation contains no extractable text.');
  }
  return result;
}

/**
 * Extract text from legacy binary DOC / PPT
 */
export async function extractLegacyDocPptText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('File is empty.');
  }

  const bytes = new Uint8Array(arrayBuffer);
  let text = '';

  // 1. Try UTF-16LE extraction
  try {
    const decoder16 = new TextDecoder('utf-16le');
    const raw16 = decoder16.decode(bytes);
    const cleaned16 = raw16.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{2,}/g, ' ');
    const words16 = cleaned16.match(/[a-zA-Z0-9]{3,}/g) || [];
    if (words16.length > 25) {
      text = cleaned16.trim();
    }
  } catch (_) {}

  // 2. Try Latin-1 extraction if UTF-16 didn't produce enough words
  if (!text) {
    try {
      const decoder = new TextDecoder('latin1');
      const raw = decoder.decode(bytes);
      const cleaned = raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{2,}/g, ' ');
      const words = cleaned.match(/[a-zA-Z0-9]{3,}/g) || [];
      if (words.length > 25) {
        text = cleaned.trim();
      }
    } catch (_) {}
  }

  if (!text || text.length < 40) {
    throw new Error(`Legacy binary file (${file.name}) could not be read. Please convert to modern DOCX/PPTX or PDF.`);
  }

  return text;
}

/**
 * Read image file as base64 string
 */
export async function readImageFile(file: File): Promise<{ dataUrl: string; cleanBase64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = (e.target?.result as string) || '';
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        resolve({
          dataUrl,
          mimeType: match[1] || file.type || 'image/jpeg',
          cleanBase64: match[2]
        });
      } else {
        const fallbackBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
        resolve({
          dataUrl,
          mimeType: file.type || 'image/jpeg',
          cleanBase64: fallbackBase64
        });
      }
    };
    reader.onerror = () => reject(new Error('Failed reading image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Universal extractor dispatch
 */
export async function extractAttachmentContent(file: File): Promise<ExtractedAttachment> {
  const lowerName = file.name.toLowerCase();
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(lowerName);

  if (isImage) {
    const imgData = await readImageFile(file);
    return {
      name: file.name,
      size: file.size,
      type: imgData.mimeType,
      content: imgData.dataUrl,
      mimeType: imgData.mimeType,
      base64Data: imgData.cleanBase64,
      isImage: true
    };
  }

  let text = '';
  try {
    if (lowerName.endsWith('.pdf')) {
      text = await extractPDFText(file);
    } else if (lowerName.endsWith('.docx')) {
      text = await extractDocxText(file);
    } else if (lowerName.endsWith('.pptx')) {
      text = await extractPptxText(file);
    } else if (lowerName.endsWith('.doc') || lowerName.endsWith('.ppt')) {
      text = await extractLegacyDocPptText(file);
    } else if (
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md') ||
      lowerName.endsWith('.json') ||
      lowerName.endsWith('.csv') ||
      lowerName.endsWith('.xml') ||
      file.type.startsWith('text/')
    ) {
      text = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = (ev) => resolve((ev.target?.result as string) || '');
        r.onerror = () => reject(new Error('Failed reading text file.'));
        r.readAsText(file);
      });
    } else {
      // Try DOCX/PPTX via JSZip in case extension was omitted
      try {
        text = await extractDocxText(file);
      } catch {
        try {
          text = await extractPptxText(file);
        } catch {
          text = await extractLegacyDocPptText(file);
        }
      }
    }
  } catch (err: any) {
    return {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      content: `[File "${file.name}" could not be read: ${err.message || 'Unknown read error'}]`,
      isImage: false,
      extractionError: err.message || 'File could not be read'
    };
  }

  return {
    name: file.name,
    size: file.size,
    type: file.type || 'text/plain',
    content: text,
    isImage: false
  };
}
