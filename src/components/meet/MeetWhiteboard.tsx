import React, { useRef, useState, useEffect } from 'react';
import { 
  Pencil, 
  Square, 
  Circle as CircleIcon, 
  ArrowRight, 
  Minus, 
  Type, 
  Image as ImageIcon, 
  Eraser, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  Download, 
  Highlighter
} from 'lucide-react';
import { sendRealtimeEvent, subscribeRealtimeEvents } from '../../lib/wsHelper';

interface MeetWhiteboardProps {
  meetingId: string;
  currentUserName: string;
  isHost: boolean;
  onClose?: () => void;
}

type ToolMode = 'pen' | 'highlighter' | 'rect' | 'circle' | 'arrow' | 'line' | 'text' | 'image' | 'eraser';

interface DrawAction {
  id: string;
  type: ToolMode;
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  imageUrl?: string;
}

export const MeetWhiteboard: React.FC<MeetWhiteboardProps> = ({
  meetingId,
  currentUserName,
  isHost,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const storageKey = `studentos_meet_wb_${meetingId}`;

  const [activeTool, setActiveTool] = useState<ToolMode>('pen');
  const [activeColor, setActiveColor] = useState<string>('#6366f1');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  
  const [actions, setActions] = useState<DrawAction[]>(() => {
    try {
      const saved = localStorage.getItem(`studentos_meet_wb_${meetingId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  const [undoStack, setUndoStack] = useState<DrawAction[]>([]);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; text: string } | null>(null);

  // Persist actions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(actions));
    } catch (_) {}
  }, [actions, storageKey]);

  // Setup RealtimeBus channel for whiteboard sync
  useEffect(() => {
    const channelName = `meet_whiteboard_${meetingId}`;
    const unsubscribe = subscribeRealtimeEvents(channelName, {
      draw: (payload: any) => {
        if (payload && payload.action) {
          setActions((prev) => {
            if (prev.some(a => a.id === payload.action.id)) return prev;
            return [...prev, payload.action];
          });
        }
      },
      sync_actions: (payload: any) => {
        if (payload && Array.isArray(payload.actions)) {
          setActions(payload.actions);
        }
      },
      clear: () => {
        setActions([]);
        setUndoStack([]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [meetingId]);

  const drawBackgroundGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 28;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  // Redraw canvas whenever actions list changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawBackgroundGrid(ctx, canvas.width, canvas.height);
    actions.forEach((act) => {
      renderAction(ctx, act);
    });
  }, [actions]);

  const renderAction = (ctx: CanvasRenderingContext2D, act: DrawAction) => {
    ctx.save();
    ctx.strokeStyle = act.type === 'eraser' ? '#0f172a' : act.color;
    ctx.fillStyle = act.color;
    ctx.lineWidth = act.type === 'eraser' ? act.strokeWidth * 5 : act.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (act.type === 'highlighter') {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = act.strokeWidth * 4;
    }

    if ((act.type === 'pen' || act.type === 'highlighter' || act.type === 'eraser') && act.points && act.points.length > 0) {
      const pts = act.points;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      if (pts.length < 3) {
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
      } else {
        for (let i = 1; i < pts.length - 1; i++) {
          const midX = (pts[i].x + pts[i + 1].x) / 2;
          const midY = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      }
      ctx.stroke();
    } else if (act.type === 'rect' && act.x !== undefined && act.y !== undefined && act.width !== undefined && act.height !== undefined) {
      ctx.beginPath();
      ctx.strokeRect(act.x, act.y, act.width, act.height);
    } else if (act.type === 'circle' && act.x !== undefined && act.y !== undefined && act.width !== undefined && act.height !== undefined) {
      ctx.beginPath();
      const radius = Math.sqrt(act.width * act.width + act.height * act.height);
      ctx.arc(act.x, act.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (act.type === 'arrow' && act.points && act.points.length >= 2) {
      const p1 = act.points[0];
      const p2 = act.points[act.points.length - 1];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const headLen = 14;
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - headLen * Math.cos(angle - Math.PI / 6), p2.y - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(p2.x - headLen * Math.cos(angle + Math.PI / 6), p2.y - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (act.type === 'line' && act.points && act.points.length >= 2) {
      const p1 = act.points[0];
      const p2 = act.points[act.points.length - 1];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (act.type === 'text' && act.x !== undefined && act.y !== undefined && act.text) {
      ctx.font = `bold ${Math.max(18, act.strokeWidth * 5)}px Plus Jakarta Sans, sans-serif`;
      ctx.fillText(act.text, act.x, act.y);
    } else if (act.type === 'image' && act.x !== undefined && act.y !== undefined && act.imageUrl) {
      const cached = imageCacheRef.current.get(act.imageUrl);
      if (cached && cached.complete) {
        ctx.drawImage(cached, act.x, act.y, act.width || 240, act.height || 180);
      } else {
        const img = new Image();
        img.src = act.imageUrl;
        img.onload = () => {
          imageCacheRef.current.set(act.imageUrl!, img);
          ctx.drawImage(img, act.x!, act.y!, act.width || 240, act.height || 180);
        };
      }
    }

    ctx.restore();
  };

  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const broadcastAction = (action: DrawAction) => {
    sendRealtimeEvent(`meet_whiteboard_${meetingId}`, 'draw', { action, sender: currentUserName });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    const pos = getCanvasPos(e);
    if (activeTool === 'text') {
      setTextInput({ x: pos.x, y: pos.y, text: '' });
      return;
    }

    setIsDrawing(true);
    setStartPos(pos);
    setCurrentPoints([pos]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    e.preventDefault();
    const pos = getCanvasPos(e);

    if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') {
      setCurrentPoints((prev) => [...prev, pos]);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawBackgroundGrid(ctx, canvas.width, canvas.height);
    actions.forEach((act) => renderAction(ctx, act));

    const tempAction: DrawAction = {
      id: 'preview',
      type: activeTool,
      color: activeColor,
      strokeWidth,
      points: activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser' 
        ? [...currentPoints, pos]
        : [startPos, pos],
      x: startPos.x,
      y: startPos.y,
      width: pos.x - startPos.x,
      height: pos.y - startPos.y
    };
    renderAction(ctx, tempAction);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    setIsDrawing(false);
    const pos = getCanvasPos(e);

    const newAction: DrawAction = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      type: activeTool,
      color: activeColor,
      strokeWidth,
      points: activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser' || activeTool === 'arrow' || activeTool === 'line'
        ? [...currentPoints, pos]
        : undefined,
      x: startPos.x,
      y: startPos.y,
      width: pos.x - startPos.x,
      height: pos.y - startPos.y
    };

    setActions((prev) => [...prev, newAction]);
    setUndoStack([]);
    broadcastAction(newAction);
    setStartPos(null);
    setCurrentPoints([]);
  };

  const handleAddText = () => {
    if (!textInput || !textInput.text.trim()) {
      setTextInput(null);
      return;
    }
    const newAction: DrawAction = {
      id: 'act_' + Date.now(),
      type: 'text',
      color: activeColor,
      strokeWidth,
      x: textInput.x,
      y: textInput.y,
      text: textInput.text
    };
    setActions((prev) => [...prev, newAction]);
    setUndoStack([]);
    broadcastAction(newAction);
    setTextInput(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const newAction: DrawAction = {
        id: 'act_' + Date.now(),
        type: 'image',
        color: activeColor,
        strokeWidth,
        x: 100,
        y: 100,
        width: 320,
        height: 220,
        imageUrl: url
      };
      setActions((prev) => [...prev, newAction]);
      setUndoStack([]);
      broadcastAction(newAction);
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    setActions([]);
    setUndoStack([]);
    sendRealtimeEvent(`meet_whiteboard_${meetingId}`, 'clear', { sender: currentUserName });
  };

  const handleUndo = () => {
    if (actions.length === 0) return;
    const last = actions[actions.length - 1];
    const nextActions = actions.slice(0, actions.length - 1);
    setUndoStack((prev) => [...prev, last]);
    setActions(nextActions);
    sendRealtimeEvent(`meet_whiteboard_${meetingId}`, 'sync_actions', { actions: nextActions });
  };

  const handleRedo = () => {
    if (undoStack.length === 0) return;
    const next = undoStack[undoStack.length - 1];
    const nextActions = [...actions, next];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setActions(nextActions);
    broadcastAction(next);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `StudentOS-Meet-Whiteboard-${meetingId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white rounded-2xl border border-white/10 overflow-hidden relative shadow-2xl">
      {/* Top Toolbar */}
      <div className="p-2.5 bg-slate-900/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 backdrop-blur-md">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-1.5 rounded-lg transition-all ${activeTool === 'pen' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Pen Tool"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('highlighter')}
            className={`p-1.5 rounded-lg transition-all ${activeTool === 'highlighter' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Highlighter"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('rect')}
            className={`p-1.5 rounded-lg transition-all ${activeTool === 'rect' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Rectangle"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('circle')}
            className={`p-1.5 rounded-lg transition-all ${activeTool === 'circle' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Circle"
          >
            <CircleIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('arrow')}
            className={`p-1.5 rounded-lg transition-all ${activeTool === 'arrow' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Arrow"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('line')}
            className={`p-1.5 rounded-lg transition-all ${activeTool === 'line' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Line"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('text')}
            className={`p-1.5 rounded-lg transition-all ${activeTool === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Text Tool"
          >
            <Type className="w-3.5 h-3.5" />
          </button>
          <label className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer" title="Upload Image">
            <ImageIcon className="w-3.5 h-3.5" />
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
          <button
            onClick={() => setActiveTool('eraser')}
            className={`p-1.5 rounded-lg transition-all ${activeTool === 'eraser' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Eraser"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Color Palette & Stroke Width */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {['#6366f1', '#38bdf8', '#34d399', '#f43f5e', '#fbbf24', '#ffffff'].map((color) => (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                style={{ backgroundColor: color }}
                className={`w-5 h-5 rounded-full border-2 transition-all ${activeColor === color ? 'scale-110 border-white shadow ring-1 ring-indigo-500' : 'border-transparent opacity-80 hover:opacity-100'}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
            <input
              type="range"
              min="1"
              max="16"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(parseInt(e.target.value, 10))}
              className="w-14 accent-indigo-500"
              title={`Stroke Size: ${strokeWidth}px`}
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10">
          <button onClick={handleUndo} disabled={actions.length === 0} className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 hover:bg-white/5" title="Undo">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleRedo} disabled={undoStack.length === 0} className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 hover:bg-white/5" title="Redo">
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDownload} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10" title="Export Board">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleClear} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10" title="Clear All">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative bg-slate-950 overflow-hidden cursor-crosshair touch-none">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full block touch-none select-none"
        />

        {/* Floating Text Input Box */}
        {textInput && (
          <div
            style={{
              left: `${Math.min(75, Math.max(5, (textInput.x / 1280) * 100))}%`,
              top: `${Math.min(80, Math.max(5, (textInput.y / 720) * 100))}%`
            }}
            className="absolute z-50 bg-slate-900 p-2 rounded-xl border border-indigo-500 shadow-2xl flex items-center gap-1.5"
          >
            <input
              type="text"
              autoFocus
              placeholder="Annotation..."
              value={textInput.text}
              onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddText();
                if (e.key === 'Escape') setTextInput(null);
              }}
              className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white outline-none w-44"
            />
            <button
              onClick={handleAddText}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
