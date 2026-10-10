/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS Professional In-App Learning Workspace Document Viewer
 * High-fidelity, self-contained educational document reader supporting
 * PDF.js canvas rendering, rich images, video/audio lectures, code/text,
 * Pen Mode freehand drawing, Eraser, Full Screen viewing, and annotation persistence.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw,
  Download, Share2, Sparkles, FileText, Image as ImageIcon,
  Video, Music, Loader2, Maximize2, Minimize2, ExternalLink,
  BookOpen, Layers, HelpCircle, Globe, Check, Copy, PenTool, Eraser, Save
} from 'lucide-react';
import { UserProfile } from '../types';

interface Stroke {
  id: string;
  page: number;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

interface InAppDocumentViewerProps {
  url: string;
  title?: string;
  fileName?: string;
  fileType?: string;
  onClose: () => void;
  onDownload?: () => void;
  onShareToChat?: () => void;
  currentUser?: UserProfile | null;
  showNotification?: (msg: string) => void;
}

export const InAppDocumentViewer: React.FC<InAppDocumentViewerProps> = ({
  url,
  title,
  fileName,
  fileType,
  onClose,
  onDownload,
  onShareToChat,
  currentUser,
  showNotification
}) => {
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pen Mode & Eraser State
  const [isPenMode, setIsPenMode] = useState<boolean>(false);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [penColor, setPenColor] = useState<string>('#4f46e5'); // Indigo default
  const [penWidth, setPenWidth] = useState<number>(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[] | null>(null);
  const [isSavingAnnotations, setIsSavingAnnotations] = useState<boolean>(false);
  const [annotationSaveStatus, setAnnotationSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);

  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // PDF specific state
  const [isPdf, setIsPdf] = useState<boolean>(false);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  // Text specific state
  const [isText, setIsText] = useState<boolean>(false);
  const [textContent, setTextContent] = useState<string>('');
  const [textLoading, setTextLoading] = useState<boolean>(false);

  // AI Learning Companion State
  const [aiDrawerOpen, setAiDrawerOpen] = useState<boolean>(false);
  const [aiAction, setAiAction] = useState<'summary' | 'flashcards' | 'mcqs' | 'explain' | 'ask'>('summary');
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const cleanTitle = title || fileName || 'Document';
  const extension = (fileName || url || '').split('?')[0].split('.').pop()?.toLowerCase() || '';

  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension) ||
    fileType?.startsWith('image/');
  const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(extension) ||
    fileType?.startsWith('video/');
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(extension) ||
    fileType?.startsWith('audio/');
  const checkIsPdf = extension === 'pdf' || fileType === 'application/pdf' || url.toLowerCase().includes('.pdf');
  const checkIsText = ['txt', 'md', 'csv', 'json', 'js', 'ts', 'py', 'html', 'css'].includes(extension) ||
    fileType?.startsWith('text/');

  // Determine file kind
  useEffect(() => {
    setIsPdf(checkIsPdf);
    setIsText(checkIsText);
  }, [url, extension, fileType]);

  // Load saved annotations on mount
  useEffect(() => {
    if (!url) return;
    async function loadSavedAnnotations() {
      try {
        const res = await fetch(`/api/document-annotations?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.annotations)) {
            setStrokes(data.annotations);
          }
        }
      } catch (err) {
        console.warn('Failed to load annotations:', err);
      }
    }
    loadSavedAnnotations();
  }, [url]);

  // Save annotations to backend
  const persistAnnotations = async (updatedStrokes: Stroke[]) => {
    setAnnotationSaveStatus('saving');
    setIsSavingAnnotations(true);
    try {
      const res = await fetch('/api/document-annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          annotations: updatedStrokes,
          userId: currentUser?.uid || 'guest'
        })
      });
      if (res.ok) {
        setAnnotationSaveStatus('saved');
        if (showNotification) showNotification('✓ Annotations saved successfully.');
      } else {
        setAnnotationSaveStatus('error');
      }
    } catch (e) {
      setAnnotationSaveStatus('error');
    } finally {
      setIsSavingAnnotations(false);
    }
  };

  // Full Screen Handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => setIsFullscreen(false));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // Load PDF when PDF detected
  useEffect(() => {
    if (!checkIsPdf) return;

    let isMounted = true;
    setPdfLoading(true);
    setPdfError(null);
    setCurrentPage(1);
    setNumPages(0);

    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      setPdfError('PDF engine is initializing...');
      setPdfLoading(false);
      return;
    }

    const base64ToUint8Array = (base64Str: string): Uint8Array => {
      const b64 = base64Str.includes(';base64,') ? base64Str.split(';base64,')[1] : base64Str;
      const raw = window.atob(b64);
      const array = new Uint8Array(new ArrayBuffer(raw.length));
      for (let i = 0; i < raw.length; i++) {
        array[i] = raw.charCodeAt(i);
      }
      return array;
    };

    const loadPdfDoc = async () => {
      try {
        let loadingTask;
        if (url.startsWith('data:application/pdf') || url.includes(';base64,')) {
          const data = base64ToUint8Array(url);
          loadingTask = pdfjsLib.getDocument({ data });
        } else {
          loadingTask = pdfjsLib.getDocument({
            url: url,
            withCredentials: false
          });
        }

        const pdf = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setPdfLoading(false);
        renderPdfPage(1, scale, pdf);
      } catch (err: any) {
        console.warn('PDF.js render notice:', err);
        if (isMounted) {
          setPdfError(err.message || 'Could not parse PDF in canvas.');
          setPdfLoading(false);
        }
      }
    };

    loadPdfDoc();

    return () => {
      isMounted = false;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
      }
    };
  }, [url, checkIsPdf]);

  const renderPdfPage = async (pageNum: number, currentScale = scale, doc = pdfDocRef.current) => {
    if (!doc || !canvasRef.current) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale, rotation });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: ctx,
        viewport
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
      redrawOverlay();
    } catch (e: any) {
      if (e.name !== 'RenderingCancelledException') {
        console.error('Render error:', e);
      }
    }
  };

  // Redraw drawing overlay strokes
  const redrawOverlay = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw saved strokes for current page
    const pageStrokes = strokes.filter(s => s.page === currentPage);
    for (const stroke of pageStrokes) {
      if (!stroke.points || stroke.points.length === 0) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      stroke.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x * canvas.width, pt.y * canvas.height);
        else ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
      });
      ctx.stroke();
    }

    // Draw active stroke if any
    if (currentStroke && currentStroke.length > 0 && !isEraser) {
      ctx.beginPath();
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      currentStroke.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x * canvas.width, pt.y * canvas.height);
        else ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
      });
      ctx.stroke();
    }
  };

  useEffect(() => {
    redrawOverlay();
  }, [strokes, currentStroke, currentPage, scale, isPenMode]);

  // Drawing Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isPenMode) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'clientX' in e ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = 'clientY' in e ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    if (isEraser) {
      eraseAtPoint(x, y);
      setIsDrawing(true);
    } else {
      setIsDrawing(true);
      setCurrentStroke([{ x, y }]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isPenMode || !isDrawing) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'clientX' in e ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = 'clientY' in e ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    if (isEraser) {
      eraseAtPoint(x, y);
    } else {
      setCurrentStroke(prev => (prev ? [...prev, { x, y }] : [{ x, y }]));
    }
  };

  const handlePointerUp = () => {
    if (!isPenMode || !isDrawing) return;
    setIsDrawing(false);

    if (!isEraser && currentStroke && currentStroke.length > 0) {
      const newStroke: Stroke = {
        id: 'stroke_' + Date.now() + Math.random().toString(36).substring(2, 6),
        page: currentPage,
        color: penColor,
        width: penWidth,
        points: currentStroke
      };
      const updated = [...strokes, newStroke];
      setStrokes(updated);
      setCurrentStroke(null);
      persistAnnotations(updated);
    }
  };

  const eraseAtPoint = (x: number, y: number) => {
    const threshold = 0.03; // hit-testing radius
    const remainingStrokes = strokes.filter(stroke => {
      if (stroke.page !== currentPage) return true;
      const hit = stroke.points.some(pt => Math.hypot(pt.x - x, pt.y - y) < threshold);
      return !hit;
    });

    if (remainingStrokes.length !== strokes.length) {
      setStrokes(remainingStrokes);
      persistAnnotations(remainingStrokes);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      if (checkIsPdf) renderPdfPage(next);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const prev = currentPage - 1;
      setCurrentPage(prev);
      if (checkIsPdf) renderPdfPage(prev);
    }
  };

  const handleZoomIn = () => {
    const next = Math.min(3.0, scale + 0.2);
    setScale(next);
    if (checkIsPdf) renderPdfPage(currentPage, next);
  };

  const handleZoomOut = () => {
    const next = Math.max(0.6, scale - 0.2);
    setScale(next);
    if (checkIsPdf) renderPdfPage(currentPage, next);
  };

  // Load Text / Code content
  useEffect(() => {
    if (!checkIsText || isImage || isVideo || isAudio || checkIsPdf) return;

    let isMounted = true;
    async function loadText() {
      setTextLoading(true);
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const txt = await resp.text();
          if (isMounted) setTextContent(txt);
        }
      } catch (_) {
        if (isMounted) setTextContent('Unable to load plain text preview.');
      } finally {
        if (isMounted) setTextLoading(false);
      }
    }
    loadText();
    return () => { isMounted = false; };
  }, [url, checkIsText]);

  // AI Learning Companion Query
  const handleRunAi = async (action: 'summary' | 'flashcards' | 'mcqs' | 'explain' | 'ask') => {
    setAiAction(action);
    setAiDrawerOpen(true);
    setAiLoading(true);
    setAiResponse('');

    try {
      const response = await fetch('/api/ai/pdf-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfTitle: cleanTitle,
          action,
          textSnippet: `Document Title: ${cleanTitle}. Page ${currentPage} of ${numPages || 1}. Format: ${extension || 'document'}.`,
          question: aiPrompt
        })
      });

      const data = await response.json();
      setAiResponse(data.text || 'Analysis completed.');
    } catch (err: any) {
      setAiResponse('AI Tutor response: ' + (err.message || 'Offline'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleDefaultDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || cleanTitle || 'download';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (showNotification) showNotification('Downloading document...');
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl z-[99995] flex flex-col font-sans select-none overflow-hidden animate-fadeIn"
    >
      {/* Top Learning Workspace Navigation Bar */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900 border-b border-white/10 flex items-center justify-between shrink-0 gap-3 z-20">
        
        {/* Document Metadata */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            {checkIsPdf && <FileText className="w-5 h-5 text-rose-400" />}
            {isImage && <ImageIcon className="w-5 h-5 text-cyan-400" />}
            {isVideo && <Video className="w-5 h-5 text-emerald-400" />}
            {isAudio && <Music className="w-5 h-5 text-amber-400" />}
            {!checkIsPdf && !isImage && !isVideo && !isAudio && <FileText className="w-5 h-5 text-indigo-400" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-extrabold text-white truncate max-w-sm sm:max-w-md">
              {cleanTitle}
            </h3>
            <p className="text-[11px] text-slate-400 flex items-center gap-2">
              <span className="uppercase font-mono font-bold text-indigo-400">{extension || 'DOC'}</span>
              <span>•</span>
              <span>In-App Learning Workspace</span>
              {checkIsPdf && numPages > 0 && (
                <>
                  <span>•</span>
                  <span className="font-mono text-emerald-400">Page {currentPage} of {numPages}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Center / Action Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* Pen Mode Toggle */}
          <button
            onClick={() => {
              setIsPenMode(!isPenMode);
              if (isPenMode) setIsEraser(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${isPenMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400' : 'bg-slate-800 text-slate-300 hover:text-white border border-white/5'}`}
            title="Toggle Pen Mode"
          >
            <PenTool className="w-4 h-4" />
            <span className="hidden sm:inline">Pen Mode</span>
          </button>

          {/* Eraser Button (Only visible when Pen Mode is active) */}
          {isPenMode && (
            <button
              onClick={() => setIsEraser(!isEraser)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${isEraser ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-400' : 'bg-slate-800 text-slate-300 hover:text-white border border-white/5'}`}
              title="Toggle Eraser"
            >
              <Eraser className="w-4 h-4" />
              <span className="hidden sm:inline">Eraser</span>
            </button>
          )}

          {/* Pen Color & Width selectors when Pen Mode is active */}
          {isPenMode && !isEraser && (
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-white/10">
              {['#4f46e5', '#ef4444', '#22c55e', '#eab308', '#ffffff', '#000000'].map(c => (
                <button
                  key={c}
                  onClick={() => setPenColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-4 h-4 rounded-full border transition-transform ${penColor === c ? 'scale-125 border-white ring-2 ring-indigo-500' : 'border-transparent hover:scale-110'}`}
                  title={`Color ${c}`}
                />
              ))}
              <select
                value={penWidth}
                onChange={(e) => setPenWidth(Number(e.target.value))}
                className="bg-slate-900 text-white text-[10px] font-bold rounded px-1 py-0.5 border border-white/10 ml-1"
                title="Stroke Width"
              >
                <option value={2}>2px</option>
                <option value={3}>3px</option>
                <option value={5}>5px</option>
                <option value={8}>8px</option>
              </select>
            </div>
          )}

          {/* PDF Page Navigator */}
          {checkIsPdf && numPages > 1 && (
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-white/5 mr-1">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold px-1 text-slate-200">
                {currentPage}/{numPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= numPages}
                className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-white/5">
            <button
              onClick={handleZoomOut}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono text-slate-400 px-1">{Math.round(scale * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Full Screen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/5 transition-colors"
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* AI Learning Assistant Drawer Toggle */}
          <button
            onClick={() => {
              setAiDrawerOpen(!aiDrawerOpen);
              if (!aiDrawerOpen && !aiResponse) {
                handleRunAi('summary');
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Ask Orion AI Companion"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">AI Study Assistant</span>
          </button>

          {/* Download Action */}
          <button
            onClick={handleDefaultDownload}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/5 transition-colors"
            title="Download Document"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Close Viewer */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-colors ml-1"
            title="Close Viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Document Canvas Viewport */}
      <main className="flex-1 relative overflow-auto flex items-center justify-center p-4 sm:p-8 bg-slate-950">
        
        {/* Saving Indicator Overlay */}
        {isSavingAnnotations && (
          <div className="absolute top-4 left-4 z-40 bg-slate-900/90 border border-white/10 px-3 py-1.5 rounded-xl text-[11px] text-indigo-300 flex items-center gap-2 shadow-lg backdrop-blur">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" /> Saving annotations...
          </div>
        )}

        {/* 1. PDF Canvas Mode */}
        {checkIsPdf && (
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            {pdfLoading && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-xs text-slate-400 font-medium">Rendering document pages...</p>
              </div>
            )}

            {pdfError && (
              <div className="text-center space-y-4 max-w-md p-6 bg-slate-900 border border-white/10 rounded-2xl">
                <div className="text-4xl">📄</div>
                <div>
                  <h4 className="text-sm font-bold text-white">Direct Canvas Preview</h4>
                  <p className="text-xs text-slate-400 mt-1">{pdfError}</p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleDefaultDownload}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download Pristine File
                  </button>
                </div>
              </div>
            )}

            <div className="relative inline-block">
              <canvas
                ref={canvasRef}
                className={`max-w-full shadow-2xl rounded-xl border border-white/10 bg-white transition-all ${pdfLoading || pdfError ? 'hidden' : 'block'}`}
              />
              {/* Drawing / Eraser Canvas Overlay */}
              <canvas
                ref={drawingCanvasRef}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                className={`absolute inset-0 z-10 w-full h-full rounded-xl ${isPenMode ? (isEraser ? 'cursor-cell' : 'cursor-crosshair') : 'pointer-events-none'}`}
              />
            </div>
          </div>
        )}

        {/* 2. High-Res Image Mode */}
        {isImage && (
          <div className="relative max-w-full max-h-full flex items-center justify-center overflow-auto p-4">
            <div className="relative inline-block">
              <img
                src={url}
                alt={cleanTitle}
                style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10 transition-transform duration-200"
              />
              <canvas
                ref={drawingCanvasRef}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                className={`absolute inset-0 z-10 w-full h-full rounded-2xl ${isPenMode ? (isEraser ? 'cursor-cell' : 'cursor-crosshair') : 'pointer-events-none'}`}
              />
            </div>
          </div>
        )}

        {/* 3. Educational Video Mode */}
        {isVideo && (
          <div className="w-full max-w-4xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <video
              controls
              autoPlay
              playsInline
              className="w-full h-auto max-h-[75vh]"
              src={url}
            >
              Your browser does not support HTML5 video streaming.
            </video>
          </div>
        )}

        {/* 4. Audio Lesson Mode */}
        {isAudio && (
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg">
              <Music className="w-10 h-10 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">{cleanTitle}</h3>
              <p className="text-xs text-slate-400 mt-1">Audio Lecture / Class Recording</p>
            </div>
            <audio controls className="w-full" src={url}>
              Your browser does not support audio playback.
            </audio>
          </div>
        )}

        {/* 5. Plain Text / Code / Notes Mode */}
        {checkIsText && !checkIsPdf && !isImage && !isVideo && !isAudio && (
          <div className="w-full max-w-4xl h-full max-h-[80vh] bg-slate-900 border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-2.5 bg-slate-950 border-b border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">{fileName || 'document.txt'}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(textContent);
                  if (showNotification) showNotification('Copied code to clipboard!');
                }}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center gap-1.5 font-bold"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Text
              </button>
            </div>
            <div className="flex-1 p-6 overflow-auto font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-indigo-600 selection:text-white">
              {textLoading ? 'Loading document text...' : textContent}
            </div>
          </div>
        )}

        {/* 6. Document Fallback (Cloud Viewer for DOCX, PPTX, etc.) */}
        {!checkIsPdf && !isImage && !isVideo && !isAudio && !checkIsText && (
          <div className="w-full max-w-5xl h-full max-h-[85vh] bg-slate-900 border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <iframe
              src={`https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`}
              title="Document Reader Cloud Engine"
              className="w-full flex-1 border-none bg-slate-950"
            />
            <div className="p-3 bg-slate-900 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="text-indigo-400 font-semibold">Embedded Document Reader Engine</span>
              <button
                onClick={handleDefaultDownload}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </div>
          </div>
        )}

        {/* Orion AI Study Companion Drawer */}
        {aiDrawerOpen && (
          <div className="absolute top-4 right-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] bg-slate-900/95 border border-indigo-500/30 rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col z-30 animate-slideLeft overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-extrabold text-white">Orion Study Companion</h4>
              </div>
              <button
                onClick={() => setAiDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="p-3 border-b border-white/5 flex gap-1.5 overflow-x-auto text-xs">
              <button
                onClick={() => handleRunAi('summary')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${aiAction === 'summary' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'}`}
              >
                Summary
              </button>
              <button
                onClick={() => handleRunAi('flashcards')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${aiAction === 'flashcards' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'}`}
              >
                Flashcards
              </button>
              <button
                onClick={() => handleRunAi('mcqs')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${aiAction === 'mcqs' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'}`}
              >
                Quiz MCQs
              </button>
              <button
                onClick={() => handleRunAi('explain')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${aiAction === 'explain' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'}`}
              >
                Explain
              </button>
            </div>

            {/* AI Results Output */}
            <div className="flex-1 p-4 overflow-y-auto font-sans text-xs text-slate-200 leading-relaxed space-y-3 whitespace-pre-wrap">
              {aiLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-2 py-12">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Orion AI reading document...</p>
                </div>
              ) : aiResponse ? (
                aiResponse
              ) : (
                <div className="text-center py-12 text-slate-500">
                  Select a study tool or ask a question to analyze this document.
                </div>
              )}
            </div>

            {/* Ask Custom Question Input */}
            <div className="p-3 border-t border-white/10 bg-slate-950 flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunAi('ask')}
                placeholder="Ask Orion about this document..."
                className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => handleRunAi('ask')}
                disabled={aiLoading || !aiPrompt.trim()}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shrink-0"
              >
                Ask
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
