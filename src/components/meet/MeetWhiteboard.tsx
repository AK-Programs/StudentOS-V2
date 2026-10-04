import React, { useRef, useState, useEffect } from 'react';
import { 
  Pencil, 
  Square, 
  Circle as CircleIcon, 
  ArrowRight, 
  Minus, 
  Type, 
  Image as ImageIcon, 
  FileText, 
  Eraser, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  Download, 
  Highlighter,
  Move
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
  const [activeTool, setActiveTool] = useState<ToolMode>('pen');
  const [activeColor, setActiveColor] = useState<string>('#6366f1');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [undoStack, setUndoStack] = useState<DrawAction[]>([]);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; text: string } | null>(null);

  // Setup Supabase realtime channel for whiteboard sync
  useEffect(() => {
    const channel = supabase.channel(`meet_whiteboard_${meetingId}`);

    channel
      .on('broadcast', { event: 'draw' }, ({ payload }) => {
        if (payload && payload.action) {
          setActions((prev) => [...prev, payload.action]);
        }
      })
      .on('broadcast', { event: 'clear' }, () => {
        setActions([]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId]);

  // Redraw canvas whenever actions list changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid pattern background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 25;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Render each action
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
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = act.strokeWidth * 4;
    }

    if ((act.type === 'pen' || act.type === 'highlighter' || act.type === 'eraser') && act.points && act.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(act.points[0].x, act.points[0].y);
      for (let i = 1; i < act.points.length; i++) {
        ctx.lineTo(act.points[i].x, act.points[i].y);
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

      // Arrow head
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const headLen = 12;
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
      ctx.font = `bold ${Math.max(16, act.strokeWidth * 5)}px Plus Jakarta Sans, sans-serif`;
      ctx.fillText(act.text, act.x, act.y);
    } else if (act.type === 'image' && act.x !== undefined && act.y !== undefined && act.imageUrl) {
      const img = new Image();
      img.src = act.imageUrl;
      img.onload = () => {
        ctx.drawImage(img, act.x!, act.y!, act.width || 200, act.height || 150);
      };
    }

    ctx.restore();
  };

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const broadcastAction = (action: DrawAction) => {
    supabase.channel(`meet_whiteboard_${meetingId}`).send({
      type: 'broadcast',
      event: 'draw',
      payload: { action }
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    if (activeTool === 'text') {
      setTextInput({ x: pos.x, y: pos.y, text: '' });
      return;
    }

    setIsDrawing(true);
    setStartPos(pos);
    setCurrentPoints([pos]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    const pos = getCanvasPos(e);

    if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') {
      setCurrentPoints((prev) => [...prev, pos]);
    }

    // Live preview
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    setIsDrawing(false);
    const pos = getCanvasPos(e);

    const newAction: DrawAction = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
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
        width: 300,
        height: 200,
        imageUrl: url
      };
      setActions((prev) => [...prev, newAction]);
      broadcastAction(newAction);
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    setActions([]);
    supabase.channel(`meet_whiteboard_${meetingId}`).send({
      type: 'broadcast',
      event: 'clear'
    });
  };

  const handleUndo = () => {
    if (actions.length === 0) return;
    const last = actions[actions.length - 1];
    setUndoStack((prev) => [...prev, last]);
    setActions((prev) => prev.slice(0, prev.length - 1));
  };

  const handleRedo = () => {
    if (undoStack.length === 0) return;
    const next = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setActions((prev) => [...prev, next]);
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
      <div className="p-3 bg-slate-900/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-2 rounded-lg transition-all ${activeTool === 'pen' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Pen Tool"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('highlighter')}
            className={`p-2 rounded-lg transition-all ${activeTool === 'highlighter' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Highlighter"
          >
            <Highlighter className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('rect')}
            className={`p-2 rounded-lg transition-all ${activeTool === 'rect' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Rectangle"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('circle')}
            className={`p-2 rounded-lg transition-all ${activeTool === 'circle' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Circle"
          >
            <CircleIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('arrow')}
            className={`p-2 rounded-lg transition-all ${activeTool === 'arrow' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Arrow"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('line')}
            className={`p-2 rounded-lg transition-all ${activeTool === 'line' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Line"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('text')}
            className={`p-2 rounded-lg transition-all ${activeTool === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Text Tool"
          >
            <Type className="w-4 h-4" />
          </button>
          <label className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer" title="Upload Image / PDF Diagram">
            <ImageIcon className="w-4 h-4" />
            <input type="file" accept="image/*,.pdf" onChange={handleImageUpload} className="hidden" />
          </label>
          <button
            onClick={() => setActiveTool('eraser')}
            className={`p-2 rounded-lg transition-all ${activeTool === 'eraser' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Color Palette & Stroke Width */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {['#6366f1', '#38bdf8', '#34d399', '#f43f5e', '#fbbf24', '#ffffff'].map((color) => (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                style={{ backgroundColor: color }}
                className={`w-6 h-6 rounded-full border-2 transition-all ${activeColor === color ? 'scale-110 border-white shadow-lg ring-2 ring-indigo-500' : 'border-transparent opacity-80 hover:opacity-100'}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 border-l border-white/10 pl-3">
            <span className="text-[10px] font-mono uppercase text-slate-400">Size:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(parseInt(e.target.value, 10))}
              className="w-16 accent-indigo-500"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
          <button onClick={handleUndo} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" title="Undo">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={handleRedo} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" title="Redo">
            <RotateCw className="w-4 h-4" />
          </button>
          <button onClick={handleDownload} className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10" title="Export Board">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={handleClear} className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10" title="Clear All">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas Canvas */}
      <div className="flex-1 relative bg-slate-950 overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full object-contain block"
        />

        {/* Floating Text Input Box */}
        {textInput && (
          <div
            style={{ left: textInput.x, top: textInput.y }}
            className="absolute z-50 bg-slate-900 p-2 rounded-xl border border-indigo-500 shadow-2xl flex items-center gap-2"
          >
            <input
              type="text"
              autoFocus
              placeholder="Type whiteboard annotation..."
              value={textInput.text}
              onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
              className="bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none w-60"
            />
            <button
              onClick={handleAddText}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
