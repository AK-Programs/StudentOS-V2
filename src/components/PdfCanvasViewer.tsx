import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, ExternalLink, Download, Sparkles, BookOpen, Layers, HelpCircle, FileText, Globe, X } from 'lucide-react';

interface PdfCanvasViewerProps {
  url: string;
  title?: string;
  onDownload?: () => void;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({ url, title, onDownload }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [useGoogleFallback, setUseGoogleFallback] = useState<boolean>(false);

  // AI PDF Assistant state
  const [aiDrawerOpen, setAiDrawerOpen] = useState<boolean>(false);
  const [aiActionType, setAiActionType] = useState<'summary' | 'flashcards' | 'mcqs' | 'extract_points' | 'translate' | 'ask'>('summary');
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [aiResult, setAiResult] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const handleRunAiAssistant = async (action: 'summary' | 'flashcards' | 'mcqs' | 'extract_points' | 'translate' | 'ask', questionStr?: string) => {
    setAiActionType(action);
    setAiDrawerOpen(true);
    setAiLoading(true);
    setAiResult('');

    try {
      const response = await fetch('/api/ai/pdf-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfTitle: title || 'Uploaded Document',
          action: action,
          textSnippet: `Document Title: ${title || 'Document'}. Page ${currentPage} of ${numPages || 1}.`,
          question: questionStr || aiQuestion
        })
      });
      const data = await response.json();
      setAiResult(data.text || 'Analysis completed.');
    } catch (err: any) {
      setAiResult('Error connecting to AI Assistant: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setCurrentPage(1);
    setNumPages(0);
    setUseGoogleFallback(false);

    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      setError('PDF engine is not loaded on this page.');
      setLoading(false);
      return;
    }

    const base64ToUint8Array = (base64Str: string): Uint8Array => {
      // Clean up the prefix if present
      const b64 = base64Str.includes(';base64,') ? base64Str.split(';base64,')[1] : base64Str;
      const raw = window.atob(b64);
      const rawLength = raw.length;
      const array = new Uint8Array(new ArrayBuffer(rawLength));
      for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
      }
      return array;
    };

    const loadDocument = async () => {
      console.log("Preview URL:", url);
      try {
        let loadingTask;
        if (url.startsWith('data:application/pdf') || url.includes(';base64,')) {
          const uint8Array = base64ToUint8Array(url);
          loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        } else {
          loadingTask = pdfjsLib.getDocument({
            url: url,
            withCredentials: false
          });
        }
        
        const pdf = await loadingTask.promise;
        if (!isMounted) return;
        
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
        renderPage(1, pdf);
      } catch (err: any) {
        console.error('PDF.js loading failed:', err);
        if (isMounted) {
          // Fall back to Google Docs viewer when original URL fails to load or CORS blocks it
          if (url.startsWith('http')) {
            setUseGoogleFallback(true);
          } else {
            setError(`Exact error: ${err.message || String(err)}`);
          }
          setLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      isMounted = false;
      if (pdfRef.current) {
        pdfRef.current.destroy();
      }
    };
  }, [url]);

  const renderPage = async (pageNum: number, pdfDoc = pdfRef.current) => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      
      await renderTask.promise;
    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', err);
      }
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const nextP = currentPage - 1;
      setCurrentPage(nextP);
      renderPage(nextP);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      const nextP = currentPage + 1;
      setCurrentPage(nextP);
      renderPage(nextP);
    }
  };

  if (useGoogleFallback) {
    const fallbackUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    return (
      <div className="w-full h-full min-h-[285px] relative rounded-xl overflow-hidden bg-slate-900 border border-white/10 flex flex-col">
        <iframe
          src={fallbackUrl}
          title="Document Reader fallback"
          className="w-full h-full flex-grow"
          style={{ border: 'none', background: '#0f172a' }}
        />
        <div className="bg-slate-950 px-3.5 py-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
          <span className="font-semibold text-indigo-400 flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Cloud Rendering Engine Active
          </span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold"
          >
            Open Original <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[300px] relative rounded-xl overflow-hidden bg-slate-950 border border-white/10 flex flex-col justify-between">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20 space-y-2.5">
          <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
          <p className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Assembling PDF visual segments...</p>
        </div>
      )}

      {error ? (
        <div className="flex-grow flex flex-col items-center justify-center p-6 text-center space-y-3">
          <div className="text-3xl">📕</div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-white">Direct Rendering Not Available</p>
            <p className="text-[10px] text-slate-400 max-w-[240px] leading-relaxed mx-auto">
              This file could not be parsed inline. You can download the pristine document directly to your device.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                onClick={onDownload}
                className="aria-label-download px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
              >
                <Download className="w-3 h-3" /> Download Document
              </button>
            )}
            {!url.startsWith('blob:') && !url.startsWith('data:') && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-350 text-[10px] font-bold flex items-center gap-1.5 transition-all"
              >
                <ExternalLink className="w-3 h-3" /> Open in New Tab
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="bg-slate-950 px-2 py-1.5 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto text-[10px]">
            <span className="text-indigo-400 font-bold flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 rounded-lg whitespace-nowrap">
              <Sparkles className="w-3 h-3 text-indigo-400" /> AI Assistant:
            </span>
            <button
              onClick={() => handleRunAiAssistant('summary')}
              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-lg text-slate-200 font-medium flex items-center gap-1 transition-all whitespace-nowrap active:scale-95"
            >
              <FileText className="w-2.5 h-2.5 text-teal-400" /> Summary
            </button>
            <button
              onClick={() => handleRunAiAssistant('flashcards')}
              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-lg text-slate-200 font-medium flex items-center gap-1 transition-all whitespace-nowrap active:scale-95"
            >
              <Layers className="w-2.5 h-2.5 text-amber-400" /> Flashcards
            </button>
            <button
              onClick={() => handleRunAiAssistant('mcqs')}
              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-lg text-slate-200 font-medium flex items-center gap-1 transition-all whitespace-nowrap active:scale-95"
            >
              <HelpCircle className="w-2.5 h-2.5 text-indigo-400" /> MCQs
            </button>
            <button
              onClick={() => handleRunAiAssistant('extract_points')}
              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-lg text-slate-200 font-medium flex items-center gap-1 transition-all whitespace-nowrap active:scale-95"
            >
              <BookOpen className="w-2.5 h-2.5 text-emerald-400" /> Key Points
            </button>
            <button
              onClick={() => handleRunAiAssistant('translate')}
              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-lg text-slate-200 font-medium flex items-center gap-1 transition-all whitespace-nowrap active:scale-95"
            >
              <Globe className="w-2.5 h-2.5 text-rose-400" /> Translate
            </button>
          </div>

          <div className="flex-grow overflow-auto p-2 bg-slate-900 border-b border-white/5 flex items-center justify-center min-h-[240px] max-h-[310px] relative">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full object-contain shadow-md rounded border border-white/10 bg-white"
            />

            {/* AI Assistant Overlay Drawer */}
            {aiDrawerOpen && (
              <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-30 p-4 flex flex-col justify-between overflow-y-auto animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      AI PDF Assistant ({aiActionType.toUpperCase()})
                    </h4>
                  </div>
                  <button
                    onClick={() => setAiDrawerOpen(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="my-3 flex-grow overflow-auto">
                  {aiLoading ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-2 py-8">
                      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                      <p className="text-[11px] text-slate-300 font-medium">Orion AI reading & processing PDF content...</p>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed space-y-2 bg-slate-900/60 p-3 rounded-xl border border-white/5">
                      {aiResult}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Ask Orion anything about this document..."
                    className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && aiQuestion.trim()) {
                        handleRunAiAssistant('ask', aiQuestion);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleRunAiAssistant('ask', aiQuestion)}
                    disabled={!aiQuestion.trim() || aiLoading}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    Ask
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-950 px-3.5 py-2 flex items-center justify-between text-[11px] border-t border-white/5">
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1 || loading}
                onClick={handlePrevPage}
                className="p-1 rounded-md border border-white/10 hover:border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-all active:scale-90"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-white" />
              </button>
              <button
                disabled={currentPage >= numPages || loading}
                onClick={handleNextPage}
                className="p-1 rounded-md border border-white/10 hover:border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-all active:scale-90"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            <span className="font-mono text-slate-400 font-medium">
              Page <span className="text-white font-bold">{currentPage}</span> of <span className="text-slate-400">{numPages || '?'}</span>
            </span>

            <div className="flex items-center gap-2">
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/25 text-indigo-400 font-bold flex items-center gap-1 transition-all"
                  title="Download offline copy"
                >
                  <Download className="w-3 h-3" /> <span className="text-[10px]">Save</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
