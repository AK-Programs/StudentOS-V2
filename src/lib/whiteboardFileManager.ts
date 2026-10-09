/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Whiteboard Multi-Slide Document Management
 * Handles saving, loading, validating, and exporting full multi-slide documents.
 */

import { Slide, ShapeObj, LineObj, StickyNoteObj } from '../components/Whiteboard2';
export type { Slide, ShapeObj, LineObj, StickyNoteObj };

export const WHITEBOARD_FILE_FORMAT = 'studentos-whiteboard';
export const WHITEBOARD_FILE_VERSION = 1;
export const WHITEBOARD_FILE_EXTENSION = '.studentos-whiteboard';

export interface StudentOSWhiteboardDocument {
  format: 'studentos-whiteboard';
  version: number;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  slideCount: number;
  metadata?: {
    app: string;
    version: string;
    description?: string;
  };
  slides: Slide[];
}

/**
 * Strips non-serializable properties (like HTMLImageElement) and returns pure JSON-safe slides
 */
export function serializeSlides(slides: Slide[]): Slide[] {
  return slides.map((sl, index) => ({
    id: typeof sl.id === 'number' ? sl.id : index + 1,
    name: sl.name || `Slide ${index + 1}`,
    lines: (sl.lines || []).map((ln) => ({
      id: String(ln.id || Date.now()),
      tool: ln.tool,
      color: ln.color,
      brushSize: Number(ln.brushSize) || 4,
      points: Array.isArray(ln.points) ? ln.points.map(Number) : [],
      isLocked: Boolean((ln as any).isLocked),
      scaleX: (ln as any).scaleX,
      scaleY: (ln as any).scaleY,
      rotation: (ln as any).rotation
    })),
    shapes: (sl.shapes || []).map((sh) => {
      // Exclude live DOM imageObj
      const { imageObj, ...rest } = sh;
      return {
        ...rest,
        id: String(rest.id || Date.now()),
        type: rest.type,
        x: Number(rest.x) || 0,
        y: Number(rest.y) || 0,
        width: rest.width !== undefined ? Number(rest.width) : undefined,
        height: rest.height !== undefined ? Number(rest.height) : undefined,
        stroke: rest.stroke || '#ffffff',
        strokeWidth: Number(rest.strokeWidth) || 0,
        fill: rest.fill,
        radius: rest.radius !== undefined ? Number(rest.radius) : undefined,
        points: Array.isArray(rest.points) ? rest.points.map(Number) : undefined,
        text: rest.text,
        fontSize: rest.fontSize,
        svgRaw: rest.svgRaw,
        scene3D: rest.scene3D,
        rotX: rest.rotX,
        rotY: rest.rotY,
        zoom3D: rest.zoom3D,
        explode3D: rest.explode3D,
        showLabels3D: rest.showLabels3D
      };
    }),
    stickies: (sl.stickies || []).map((st) => ({
      id: String(st.id || Date.now()),
      x: Number(st.x) || 0,
      y: Number(st.y) || 0,
      width: Number(st.width) || 160,
      height: Number(st.height) || 160,
      color: st.color || '#fef08a',
      text: String(st.text || '')
    }))
  }));
}

/**
 * Creates and triggers browser download of the complete multi-slide Whiteboard document
 */
export function exportWhiteboardDocumentFile(fileName: string, slides: Slide[]): string {
  const cleanName = (fileName || 'My Whiteboard').trim().replace(/[/\\?%*:|"<>]/g, '-');
  const safeSlides = serializeSlides(slides);

  const doc: StudentOSWhiteboardDocument = {
    format: WHITEBOARD_FILE_FORMAT,
    version: WHITEBOARD_FILE_VERSION,
    fileName: cleanName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slideCount: safeSlides.length,
    metadata: {
      app: 'StudentOS Whiteboard',
      version: '2.4.0'
    },
    slides: safeSlides
  };

  const jsonStr = JSON.stringify(doc, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanName}${WHITEBOARD_FILE_EXTENSION}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return cleanName;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  document?: StudentOSWhiteboardDocument;
}

/**
 * Validates a loaded StudentOS Whiteboard file before restoring state
 */
export function validateAndParseWhiteboardFile(rawText: string): ValidationResult {
  if (!rawText || typeof rawText !== 'string') {
    return { valid: false, error: 'Unable to load this Whiteboard file: file is empty.' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { valid: false, error: 'Unable to load this Whiteboard file: invalid JSON format.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Unable to load this Whiteboard file.' };
  }

  // Format verification (Supports format header or legacy slides array)
  let rawSlides: any[] = [];
  let fileName = 'Imported Whiteboard';

  if (parsed.format === WHITEBOARD_FILE_FORMAT) {
    if (typeof parsed.version !== 'number' || parsed.version < 1) {
      return { valid: false, error: 'Unable to load this Whiteboard file: unsupported schema version.' };
    }
    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      return { valid: false, error: 'Unable to load this Whiteboard file: no slides found in document.' };
    }
    rawSlides = parsed.slides;
    if (typeof parsed.fileName === 'string' && parsed.fileName.trim()) {
      fileName = parsed.fileName.trim();
    }
  } else if (Array.isArray(parsed)) {
    // Legacy slides array format
    rawSlides = parsed;
  } else if (Array.isArray(parsed.slides)) {
    rawSlides = parsed.slides;
  } else {
    return { valid: false, error: 'Unable to load this Whiteboard file.' };
  }

  // Deep validation of slides and inner objects
  const sanitizedSlides: Slide[] = [];

  for (let sIdx = 0; sIdx < rawSlides.length; sIdx++) {
    const sl = rawSlides[sIdx];
    if (!sl || typeof sl !== 'object') {
      return { valid: false, error: `Unable to load this Whiteboard file: slide ${sIdx + 1} is corrupted.` };
    }

    const slideLines: LineObj[] = [];
    if (Array.isArray(sl.lines)) {
      for (const ln of sl.lines) {
        if (ln && Array.isArray(ln.points) && ln.points.length >= 2) {
          slideLines.push({
            id: String(ln.id || `line_${Date.now()}_${Math.random()}`),
            tool: ln.tool || 'pen',
            color: String(ln.color || '#ffffff'),
            brushSize: Number(ln.brushSize) || 4,
            points: ln.points.map((p: any) => Number(p) || 0)
          });
        }
      }
    }

    const slideShapes: ShapeObj[] = [];
    if (Array.isArray(sl.shapes)) {
      for (const sh of sl.shapes) {
        if (sh && typeof sh === 'object' && sh.type) {
          slideShapes.push({
            id: String(sh.id || `shape_${Date.now()}_${Math.random()}`),
            type: sh.type,
            x: Number(sh.x) || 0,
            y: Number(sh.y) || 0,
            width: sh.width !== undefined ? Number(sh.width) : undefined,
            height: sh.height !== undefined ? Number(sh.height) : undefined,
            stroke: sh.stroke || '#38bdf8',
            strokeWidth: Number(sh.strokeWidth) || 0,
            fill: sh.fill,
            radius: sh.radius !== undefined ? Number(sh.radius) : undefined,
            points: Array.isArray(sh.points) ? sh.points.map((p: any) => Number(p) || 0) : undefined,
            text: sh.text ? String(sh.text) : undefined,
            fontSize: sh.fontSize ? Number(sh.fontSize) : undefined,
            svgRaw: sh.svgRaw ? String(sh.svgRaw) : undefined,
            scene3D: sh.scene3D,
            rotX: sh.rotX,
            rotY: sh.rotY,
            zoom3D: sh.zoom3D,
            explode3D: sh.explode3D,
            showLabels3D: sh.showLabels3D
          });
        }
      }
    }

    const slideStickies: StickyNoteObj[] = [];
    if (Array.isArray(sl.stickies)) {
      for (const st of sl.stickies) {
        if (st && typeof st === 'object') {
          slideStickies.push({
            id: String(st.id || `sticky_${Date.now()}_${Math.random()}`),
            x: Number(st.x) || 0,
            y: Number(st.y) || 0,
            width: Number(st.width) || 160,
            height: Number(st.height) || 160,
            color: st.color || '#fef08a',
            text: String(st.text || '')
          });
        }
      }
    }

    sanitizedSlides.push({
      id: sIdx + 1,
      name: sl.name ? String(sl.name) : `Slide ${sIdx + 1}`,
      lines: slideLines,
      shapes: slideShapes,
      stickies: slideStickies
    });
  }

  if (sanitizedSlides.length === 0) {
    return { valid: false, error: 'Unable to load this Whiteboard file: no valid slides found.' };
  }

  return {
    valid: true,
    document: {
      format: WHITEBOARD_FILE_FORMAT,
      version: parsed.version || 1,
      fileName,
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slideCount: sanitizedSlides.length,
      slides: sanitizedSlides
    }
  };
}

/**
 * Opens browser print dialog to print or save all slides as a multi-page PDF document
 */
export function printAllSlidesAsPdf(
  slideDataUrls: { title: string; dataUrl: string }[],
  documentTitle = 'StudentOS Whiteboard'
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const slidesHtml = slideDataUrls
    .map(
      (s, idx) => `
    <div class="slide-page">
      <div class="slide-header">
        <span class="slide-title">${documentTitle} — ${s.title || `Slide ${idx + 1}`}</span>
        <span class="slide-number">Page ${idx + 1} of ${slideDataUrls.length}</span>
      </div>
      <div class="slide-content">
        <img src="${s.dataUrl}" alt="Slide ${idx + 1}" />
      </div>
    </div>
  `
    )
    .join('\n');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${documentTitle} — PDF Export</title>
        <style>
          @page {
            size: landscape;
            margin: 0;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #090d16;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .slide-page {
            page-break-after: always;
            break-after: page;
            margin-bottom: 30px;
            background: #0f172a;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            width: 100%;
            height: calc(100vh - 40px);
            max-height: 960px;
          }
          .slide-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 13px;
            font-weight: 700;
            color: #94a3b8;
            margin-bottom: 12px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding-bottom: 6px;
          }
          .slide-title { color: #f8fafc; font-size: 14px; }
          .slide-number { font-family: monospace; font-size: 12px; }
          .slide-content {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: #020617;
            border-radius: 8px;
          }
          .slide-content img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          @media print {
            body { background: #fff; padding: 0; color: #000; }
            .slide-page {
              background: #fff;
              box-shadow: none;
              padding: 10mm;
              margin: 0;
              height: 100vh;
              page-break-after: always;
              break-after: page;
            }
            .slide-header {
              color: #475569;
              border-bottom: 1px solid #cbd5e1;
            }
            .slide-title { color: #0f172a; }
            .slide-content { background: #fff; }
          }
        </style>
      </head>
      <body>
        ${slidesHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

export interface CloudWhiteboardSummary {
  id: string;
  fileName: string;
  slideCount: number;
  userId: string;
  userName: string;
  schoolId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Saves a whiteboard document to StudentOS Cloud backend
 */
export async function saveWhiteboardToCloud(
  fileName: string,
  slides: Slide[],
  user?: { id?: string; name?: string; school_id?: string },
  docId?: string
): Promise<{ success: boolean; document?: any; error?: string }> {
  try {
    const safeSlides = serializeSlides(slides);
    const payload = {
      id: docId,
      fileName: (fileName || 'My Whiteboard').trim(),
      slideCount: safeSlides.length,
      slides: safeSlides,
      userId: user?.id || 'usr_anonymous',
      userName: user?.name || 'StudentOS User',
      schoolId: user?.school_id || 'school_default'
    };

    const resp = await fetch('/api/whiteboard/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.error || 'Failed to save to StudentOS Cloud');
    }
    return { success: true, document: data.document };
  } catch (err: any) {
    console.error('[Cloud Save Error]:', err);
    return { success: false, error: err.message || 'Cloud save failed' };
  }
}

/**
 * Lists cloud whiteboard documents with optional school isolation
 */
export async function listCloudWhiteboards(
  user?: { id?: string; school_id?: string; role?: string }
): Promise<CloudWhiteboardSummary[]> {
  try {
    const params = new URLSearchParams();
    if (user?.school_id) params.append('schoolId', user.school_id);
    if (user?.id) params.append('userId', user.id);
    if (user?.role) params.append('role', user.role);

    const resp = await fetch(`/api/whiteboard/documents?${params.toString()}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.documents || [];
  } catch (err) {
    console.error('[Cloud List Error]:', err);
    return [];
  }
}

/**
 * Fetches a complete whiteboard document from the cloud
 */
export async function loadCloudWhiteboard(id: string): Promise<{ success: boolean; document?: any; error?: string }> {
  try {
    const resp = await fetch(`/api/whiteboard/documents/${encodeURIComponent(id)}`);
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.error || 'Failed to load cloud whiteboard');
    }
    return { success: true, document: data.document };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to load from cloud' };
  }
}

/**
 * Deletes a whiteboard document from the cloud
 */
export async function deleteCloudWhiteboard(id: string): Promise<boolean> {
  try {
    const resp = await fetch(`/api/whiteboard/documents/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const data = await resp.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Recovery Snapshots: Stores resilient workspace backup in sessionStorage and localStorage
 */
const RECOVERY_STORAGE_KEY = 'studentos_wb_recovery_snapshot_v1';

export function saveWhiteboardRecoverySnapshot(slides: Slide[]): void {
  try {
    const serialized = JSON.stringify(serializeSlides(slides));
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, serialized);
    localStorage.setItem(RECOVERY_STORAGE_KEY, serialized);
  } catch {}
}

export function getWhiteboardRecoverySnapshot(): Slide[] | null {
  try {
    const raw = sessionStorage.getItem(RECOVERY_STORAGE_KEY) || localStorage.getItem(RECOVERY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

export function clearWhiteboardRecoverySnapshot(): void {
  try {
    sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
  } catch {}
}

