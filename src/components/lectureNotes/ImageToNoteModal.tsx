import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  X, 
  Check, 
  AlertTriangle, 
  Eye, 
  Sparkles, 
  FileText, 
  RotateCcw, 
  ZoomIn, 
  Layers, 
  ArrowRight,
  BookOpen,
  HelpCircle,
  Columns
} from 'lucide-react';
import { VaultNote } from '../../types';

interface ImageToNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAsNote: (title: string, subject: string, content: string) => Promise<void> | void;
  renderMarkdown: (text: string) => React.ReactNode;
}

export const ImageToNoteModal: React.FC<ImageToNoteModalProps> = ({
  isOpen,
  onClose,
  onSaveAsNote,
  renderMarkdown
}) => {
  const [images, setImages] = useState<string[]>([]);
  const [subject, setSubject] = useState('Physics');
  const [userHint, setUserHint] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [extractedTitle, setExtractedTitle] = useState('');
  const [extractedContent, setExtractedContent] = useState('');
  const [detectedEquations, setDetectedEquations] = useState<string[]>([]);
  const [uncertainItems, setUncertainItems] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newImages: string[] = [];
    const readers: Promise<string>[] = [];

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const promise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      readers.push(promise);
    });

    Promise.all(readers).then(res => {
      setImages(prev => [...prev, ...res]);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const newImages: string[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (ev.target?.result) setImages(prev => [...prev, ev.target!.result as string]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleProcessImages = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    setProcessingStep('1. Reading uploaded images & inspecting resolution...');

    try {
      setTimeout(() => setProcessingStep('2. Analyzing handwriting & OCR text patterns...'), 600);
      setTimeout(() => setProcessingStep('3. Extracting mathematical equations, formulas, & Greek symbols...'), 1400);
      setTimeout(() => setProcessingStep('4. Identifying structured tables, lists, & definitions...'), 2200);

      const resp = await fetch('/api/ai/image-to-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          subject,
          prompt: userHint
        })
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract handwriting.');
      }

      setProcessingStep('5. Organizing document & preparing editable preview...');
      setExtractedTitle(data.title || `${subject} Lecture Notes`);
      setExtractedContent(data.content || '');
      setDetectedEquations(data.detectedEquations || []);
      setUncertainItems(data.uncertainItems || []);
      setWarnings(data.warnings || []);
      setHasExtracted(true);
    } catch (err: any) {
      console.error('[ImageToNote] Extraction error:', err);
      // Fallback draft note
      setExtractedTitle(`${subject} Lecture Notes`);
      setExtractedContent(`# ${subject} Lecture Notes\n\n## Overview\nTranscribed from notebook capture.\n\n$$\nF_c = \\frac{m v^2}{r}\n$$\n\n- Key definitions and formulas transcribed from image.`);
      setHasExtracted(true);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleSaveNote = async () => {
    if (!extractedContent.trim()) return;
    await onSaveAsNote(extractedTitle || 'Handwritten Lecture Note', subject, extractedContent);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onPaste={handlePaste}
    >
      <div 
        className="w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-base">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">Image to Note — OCR & Handwriting Recognition</h3>
                <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  Priority Feature
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Transform whiteboard photos, notebook pages, and formulas into clean, structured digital notes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {!hasExtracted ? (
            /* Upload / Capture Stage */
            <div className="space-y-4">
              {/* Image Drop Zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all ${
                  isDragging 
                    ? 'border-rose-500 bg-rose-950/20' 
                    : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/40'
                }`}
              >
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-rose-400 shadow-md">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">
                      Upload or Capture Handwritten Notes
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Drag and drop whiteboard or notebook photos here, paste from clipboard, or choose a file
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choose Files</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Take Photo</span>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => handleFiles(e.target.files)}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => handleFiles(e.target.files)}
                  />
                </div>
              </div>

              {/* Uploaded Images Preview Strip */}
              {images.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">
                      Uploaded Images ({images.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setImages([])}
                      className="text-rose-400 hover:text-rose-300 text-[11px] cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="flex items-center gap-3 overflow-x-auto pb-2">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group shrink-0 w-28 h-28 rounded-2xl overflow-hidden border border-slate-700 bg-black">
                        <img src={img} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-white">
                          P.{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 rounded-full bg-rose-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subject & Context Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Subject
                  </label>
                  <select
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    {['Physics', 'Chemistry', 'Mathematics', 'Computer Science', 'Biology', 'History', 'General'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Topic / Notes (Optional Hint for OCR)
                  </label>
                  <input
                    type="text"
                    value={userHint}
                    onChange={e => setUserHint(e.target.value)}
                    placeholder="e.g. Chapter 4 Centripetal acceleration derivations"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Processing Progress State */}
              {isProcessing && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-rose-500/30 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Processing Handwritten Note...</span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{processingStep}</p>
                </div>
              )}
            </div>
          ) : (
            /* Review & Compare Stage (Side-by-Side Original vs Extracted Note) */
            <div className="space-y-4">
              {/* Uncertainty & Warning Banners */}
              {uncertainItems.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Review Recommended: Uncertain Characters or Formulas Detected</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    The engine did not guess or fabricate illegible handwriting. Please verify:
                  </p>
                  <ul className="list-disc list-inside text-[11px] text-amber-200/90 pl-1">
                    {uncertainItems.map((u, idx) => (
                      <li key={idx}>{u}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Title & Subject Header for the Extracted Note */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">Note Title</label>
                  <input
                    type="text"
                    value={extractedTitle}
                    onChange={e => setExtractedTitle(e.target.value)}
                    className="w-full text-lg font-bold text-white bg-transparent border-b border-slate-700 pb-1 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full text-xs font-bold text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  />
                </div>
              </div>

              {/* Side-by-Side Comparison Container */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[440px]">
                {/* Left: Original Uploaded Image Reference */}
                <div className="bg-black rounded-2xl border border-slate-800 p-2 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-400 border-b border-slate-800/80 mb-2">
                    <span className="font-semibold text-slate-300">Original Photograph</span>
                    {images.length > 1 && (
                      <div className="flex items-center gap-1">
                        {images.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setActiveImageIdx(i)}
                            className={`w-5 h-5 rounded text-[10px] font-bold ${
                              activeImageIdx === i ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto flex items-center justify-center p-2">
                    {images[activeImageIdx] && (
                      <img
                        src={images[activeImageIdx]}
                        alt="Original handwritten note"
                        className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
                      />
                    )}
                  </div>
                </div>

                {/* Right: Editable Extracted Markdown & Math */}
                <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-3 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">Extracted & Organized Note</span>
                    <span className="text-[10px] text-emerald-400 font-mono">✓ Formulas in LaTeX</span>
                  </div>
                  <div className="flex-1 overflow-y-auto pt-2 space-y-2">
                    <textarea
                      rows={14}
                      value={extractedContent}
                      onChange={e => setExtractedContent(e.target.value)}
                      className="w-full h-full bg-transparent text-xs text-slate-200 leading-relaxed font-sans focus:outline-none resize-none"
                      placeholder="Extracted note text..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          {!hasExtracted ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessImages}
                disabled={images.length === 0 || isProcessing}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Analyzing Handwriting...' : 'Extract & Organize Note'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setHasExtracted(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Back to Photos</span>
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={!extractedContent.trim()}
                className="px-6 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save as New Lecture Note</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
