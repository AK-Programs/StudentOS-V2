/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Document & Attachment Extraction Engine
 * - Extracts text from PDF using PDF.js
 * - Fallbacks to Page 1 Canvas Image Slicing for tall or image-based PDFs (e.g. DrainQA.pdf)
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
  wasRenderedFromScannedPdf?: boolean;
  imageChunks?: { name: string; dataUrl: string; cleanBase64: string; mimeType: string }[];
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
 * Render Page 1 of a PDF to high-resolution PNG image chunks if the page is tall
 * - Slices tall pages (aspectRatio > 1.6) into 2-4 horizontal image chunks
 * - Keeps each chunk wide and legible (width ~900-1100px) instead of shrinking the whole page
 */
export async function renderPdfPageToImages(
  pdfOrFile: any,
  fileRef?: File
): Promise<{ chunks: { name: string; dataUrl: string; cleanBase64: string; mimeType: string }[] }> {
  let pdf = pdfOrFile;
  if (!pdf || typeof pdf.getPage !== 'function') {
    const pdfjsLib = await ensurePdfJsLoaded();
    const arrayBuffer = await (fileRef || pdfOrFile).arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdf = await loadingTask.promise;
  }

  const page = await pdf.getPage(1);
  const unscaledViewport = page.getViewport({ scale: 1.0 });
  const width = unscaledViewport.width || 1;
  const height = unscaledViewport.height || 1;
  const aspectRatio = height / width;

  // Scale so text stays sharp and wide (target width ~ 900-1100px)
  let scale = 2.0;
  if (width * scale > 1200) {
    scale = 1200 / width;
  } else if (width * scale < 700) {
    scale = 700 / width;
  }

  const viewport = page.getViewport({ scale });
  const fullCanvas = document.createElement('canvas');
  const context = fullCanvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context unavailable for PDF rendering.');
  }

  fullCanvas.width = Math.floor(viewport.width);
  fullCanvas.height = Math.floor(viewport.height);

  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };

  await page.render(renderContext).promise;

  // Determine number of horizontal chunks based on aspect ratio
  const numChunks = aspectRatio > 4.5 ? 4 : aspectRatio > 2.2 ? 3 : aspectRatio > 1.6 ? 2 : 1;
  const chunks: { name: string; dataUrl: string; cleanBase64: string; mimeType: string }[] = [];
  const fileName = fileRef?.name || 'Document.pdf';

  if (numChunks === 1) {
    const dataUrl = fullCanvas.toDataURL('image/png');
    const cleanBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    chunks.push({
      name: fileName,
      dataUrl,
      cleanBase64,
      mimeType: 'image/png'
    });
  } else {
    const totalH = fullCanvas.height;
    const chunkH = Math.floor(totalH / numChunks);
    const overlap = 50; // Overlap to preserve text spanning chunk boundaries

    for (let i = 0; i < numChunks; i++) {
      const srcY = Math.max(0, i * chunkH - (i > 0 ? overlap : 0));
      const srcH = Math.min(totalH - srcY, chunkH + (i > 0 ? overlap : 0) + (i < numChunks - 1 ? overlap : 0));

      const chunkCanvas = document.createElement('canvas');
      chunkCanvas.width = fullCanvas.width;
      chunkCanvas.height = srcH;
      const chunkCtx = chunkCanvas.getContext('2d');
      if (chunkCtx) {
        chunkCtx.drawImage(
          fullCanvas,
          0, srcY, fullCanvas.width, srcH,
          0, 0, fullCanvas.width, srcH
        );
        const dataUrl = chunkCanvas.toDataURL('image/png');
        const cleanBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        chunks.push({
          name: `${fileName} (Part ${i + 1} of ${numChunks})`,
          dataUrl,
          cleanBase64,
          mimeType: 'image/png'
        });
      }
    }
  }

  return { chunks };
}

/**
 * Extract text from PDF using PDF.js
 * - Joins text items with a space and handles EOL line breaks cleanly
 * - Capped at safe length (15,000 chars) preserving document start
 */
export async function extractPDFText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('PDF file is empty.');
  }

  const pdfjsLib = await ensurePdfJsLoaded();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

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
    throw new Error('PDF has no text layer.');
  }

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

  try {
    const decoder16 = new TextDecoder('utf-16le');
    const raw16 = decoder16.decode(bytes);
    const cleaned16 = raw16.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{2,}/g, ' ');
    const words16 = cleaned16.match(/[a-zA-Z0-9]{3,}/g) || [];
    if (words16.length > 25) {
      text = cleaned16.trim();
    }
  } catch (_) {}

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
 * Universal extractor dispatch:
 * - Text PDFs return clean extracted text
 * - Image-based/Scanned PDFs (< 20 text chars) automatically fall back to rendering Page 1 as high-clarity horizontal image chunks
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

  if (lowerName.endsWith('.pdf')) {
    try {
      const pdfjsLib = await ensurePdfJsLoaded();
      const arrayBuffer = await file.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('PDF file is empty.');
      }

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

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

      const trimmedText = entireText.trim();

      // Scanned or Image-based PDF (e.g. DrainQA.pdf) -> Fallback to rendering Page 1 as horizontal image chunks
      if (!trimmedText || trimmedText.length < 20) {
        console.log(`[PDF Engine] "${file.name}" has no text layer (${trimmedText.length} chars). Fallback rendering page 1 as images...`);
        try {
          const rendered = await renderPdfPageToImages(pdf, file);
          if (!rendered.chunks || rendered.chunks.length === 0) {
            throw new Error('Image rendering produced empty output.');
          }

          const primary = rendered.chunks[0];
          return {
            name: primary.name,
            size: file.size,
            type: 'image/png',
            content: primary.dataUrl,
            mimeType: 'image/png',
            base64Data: primary.cleanBase64,
            isImage: true,
            wasRenderedFromScannedPdf: true,
            imageChunks: rendered.chunks
          };
        } catch (renderErr: any) {
          throw new Error(`PDF could not be read: no text layer and image render failed (${renderErr?.message || 'canvas error'}).`);
        }
      }

      // Normal Text PDF
      const MAX_CAP = 15000;
      const finalText = trimmedText.length > MAX_CAP
        ? trimmedText.slice(0, MAX_CAP) + '\n\n[...Remainder of PDF text truncated for performance...]'
        : trimmedText;

      return {
        name: file.name,
        size: file.size,
        type: file.type || 'application/pdf',
        content: finalText,
        isImage: false
      };
    } catch (err: any) {
      return {
        name: file.name,
        size: file.size,
        type: file.type || 'application/pdf',
        content: `[PDF "${file.name}" could not be read: ${err.message || 'Unknown read error'}]`,
        isImage: false,
        extractionError: err.message || 'PDF could not be read'
      };
    }
  }

  let text = '';
  try {
    if (lowerName.endsWith('.docx')) {
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
