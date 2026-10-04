import React, { useRef, useState, useEffect } from 'react';
import { 
  Stage as StageComp, Layer as LayerComp, Line as LineComp, Rect as RectComp, 
  Circle as CircleComp, RegularPolygon as RegularPolygonComp, Arrow as ArrowComp, 
  Group as GroupComp, Text as TextComp, Ellipse as EllipseComp, Star as StarComp, 
  Transformer as TransformerComp, Image as KonvaImageComp 
} from 'react-konva';

const Stage = StageComp as any;
const Layer = LayerComp as any;
const Line = LineComp as any;
const Rect = RectComp as any;
const Circle = CircleComp as any;
const RegularPolygon = RegularPolygonComp as any;
const Arrow = ArrowComp as any;
const Group = GroupComp as any;
const Text = TextComp as any;
const Ellipse = EllipseComp as any;
const Star = StarComp as any;
const Transformer = TransformerComp as any;
const KonvaImage = KonvaImageComp as any;
import { 
  Download, Eraser, MousePointer2, Pen, PenTool, Square, Circle as CircleIcon, 
  Triangle, Minus, ChevronDown, Trash2, Sliders, Settings2, Plus, Copy,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, ArrowUp, ArrowDown, Type, Sparkles,
  Undo2, Redo2, Image as ImageIcon, StickyNote, FileText
} from 'lucide-react';

interface ShapeObj {
  id: string;
  type: 'rect' | 'square' | 'circle' | 'ellipse' | 'triangle' | 'line' | 'arrow' | 'pentagon' | 'polygon' | 'star' | 'ruler-15' | 'ruler-30' | 'protractor' | 'compass' | 'setsquare-45' | 'setsquare-30-60' | 'geometry' | 'text' | 'ruler' | 'setsquare' | 'divider' | 'angle-meter' | 'svg_node' | 'mermaid';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[];
  fill?: string;
  stroke: string;
  strokeWidth: number;
  text?: string;
  fontSize?: number;
  imageObj?: HTMLImageElement;
}

interface LineObj {
  id: string;
  points: number[];
  color: string;
  brushSize: number;
  tool: 'pen' | 'pencil' | 'marker' | 'highlighter' | 'eraser';
}

interface Slide {
  id: string;
  shapes: ShapeObj[];
  lines: LineObj[];
  stickies: any[];
}

declare const mermaid: any;

export const Whiteboard2 = ({ onClose, currentUser }: any) => {
  const [slides, setSlides] = useState<Slide[]>([{ id: 'slide_1', shapes: [], lines: [], stickies: [] }]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  
  const [tool, setTool] = useState<'pen' | 'pencil' | 'marker' | 'highlighter' | 'eraser' | 'object_eraser' | 'select' | 'shape'>('pen');
  const [shapeType, setShapeType] = useState<'rect' | 'square' | 'circle' | 'ellipse' | 'triangle' | 'line' | 'arrow' | 'pentagon' | 'polygon' | 'star' | 'ruler-15' | 'ruler-30' | 'protractor' | 'compass' | 'setsquare-45' | 'setsquare-30-60' | 'geometry' | 'text' | 'ruler' | 'setsquare'>('rect');
  
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(4);
  
  // Settings without LocalStorage persistence
  const [backgroundColor, setBackgroundColor] = useState<string>('#0f172a');
  const [backgroundPattern, setBackgroundPattern] = useState<'plain' | 'grid' | 'dot' | 'graph' | 'ruled'>('plain');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [gridOpacity, setGridOpacity] = useState<number>(0.05);

  const [aiShapeAssistant, setAiShapeAssistant] = useState<boolean>(false);

  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);
  const [eraserMenuOpen, setEraserMenuOpen] = useState(false);
  
  // Advanced Select & Object controls
  const [selectedObj, setSelectedObj] = useState<{ id: string; type: 'shape' | 'line' } | null>(null);

  // Hover position for the transparent eraser brush outline
  const [eraserHoverPos, setEraserHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [aiTip, setAiTip] = useState<string | null>(null);

  useEffect(() => {
    if (aiTip) {
      const timer = setTimeout(() => setAiTip(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [aiTip]);

  // Zoom and Pan Controls
  const [stageScale, setStageScale] = useState(1);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiPromptQuery, setAiPromptQuery] = useState('');
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [aiToolType, setAiToolType] = useState<'auto' | 'mermaid' | 'svg' | 'diagram' | 'mindmap' | 'assistant'>('auto');

  const handleGenerateDiagram = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiPromptQuery.trim()) return;
    setIsGeneratingDiagram(true);
    setAiPromptOpen(false);

    const queryLower = aiPromptQuery.toLowerCase();
    let effectiveTool: 'mermaid' | 'svg' | 'diagram' = 'mermaid';

    if (aiToolType === 'auto') {
      const isSvgSubject = /\b(heart|cell|lungs|brain|digestive|stomach|gut|anatomy|pulley|lever|circuit|voltage|optics|lens|mirror|atom|molecule|beaker|lab|volcano|earth|rock|coordinate|geometry|triangle|circle|respiratory|biology|physics|chemistry|body|organ|solar\s*system|neuron|dna|eye|ear|battery|motor|generator|bridge|machine|solar|planet|star|galaxy)\b/.test(queryLower);
      effectiveTool = isSvgSubject ? 'svg' : 'mermaid';
    } else if (aiToolType === 'svg') {
      effectiveTool = 'svg';
    } else if (aiToolType === 'mermaid' || aiToolType === 'mindmap') {
      effectiveTool = 'mermaid';
    } else {
      effectiveTool = 'diagram';
    }

    try {
      if (effectiveTool === 'mermaid') {
        const response = await fetch('/api/ai/mermaid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: aiPromptQuery })
        });
        let data: any = {};
        try {
          data = await response.json();
        } catch (_) {
          const text = await response.text().catch(() => '');
          data = { code: text || `graph TD\n  Start[${aiPromptQuery}] --> Concept1[Primary Mechanism]` };
        }
        const mermaidCode = data.mermaid || data.code;
        if (mermaidCode) {
          try {
            const mermaidModule = await import('mermaid');
            const mermaid: any = mermaidModule.default || mermaidModule;
            mermaid.initialize({ startOnLoad: false, theme: 'dark' });
            const id = `mermaid_render_${Date.now()}`;
            const { svg } = await mermaid.render(id, mermaidCode);
            
            const img = new Image();
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
            img.onload = () => {
              const svgShape: ShapeObj = {
                id: `mermaid-${Date.now()}`,
                type: 'svg_node',
                x: 100,
                y: 100,
                width: 520,
                height: 380,
                stroke: '#818cf8',
                strokeWidth: 0,
                imageObj: img
              };
              setSlides(prev => {
                const updated = [...prev];
                updated[activeSlideIdx].shapes = [...(updated[activeSlideIdx].shapes || []), svgShape];
                return updated;
              });
            };
            setAiTip(`🧜‍♂️ Educational Mermaid diagram inserted for "${aiPromptQuery}"`);
          } catch(mErr) {
            console.error("Mermaid generation or render error:", mErr);
            setAiTip(`❌ Mermaid could not render diagram. Check console.`);
          }
        }
      } else if (effectiveTool === 'svg') {
        try {
          const response = await fetch('/api/ai/svg-diagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: aiPromptQuery })
          });
          if (!response.ok) throw new Error('SVG API unavailable');
          const data = await response.json();
          const svgContent = data.svg;
          if (svgContent) {
            const img = new Image();
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
            img.onload = () => {
              const svgShape: ShapeObj = {
                id: `svg-${Date.now()}`,
                type: 'svg_node',
                x: 100,
                y: 100,
                width: 520,
                height: 390,
                stroke: '#10b981',
                strokeWidth: 0,
                imageObj: img
              };
              setSlides(prev => {
                const updated = [...prev];
                updated[activeSlideIdx].shapes = [...(updated[activeSlideIdx].shapes || []), svgShape];
                return updated;
              });
            };
            setAiTip(`🎨 Educational SVG diagram inserted for "${aiPromptQuery}"`);
          } else if (data.mermaid) {
            console.warn('SVG failed, but Mermaid returned. Rendering Mermaid instead.');
            const mermaidCode = data.mermaid;
            const mermaidId = `mermaid-${Date.now()}`;
            const container = document.createElement('div');
            container.id = mermaidId;
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            document.body.appendChild(container);
            
            try {
              mermaid.mermaidAPI.initialize({ startOnLoad: false, theme: 'dark' });
              const { svg } = await mermaid.render(mermaidId, mermaidCode, container);
              const img = new Image();
              img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
              img.onload = () => {
                const shape: ShapeObj = {
                  id: `mermaid-diagram-${Date.now()}`,
                  type: 'mermaid',
                  x: 50, y: 50, width: 800, height: 600,
                  stroke: '#10b981', strokeWidth: 0, imageObj: img
                };
                setSlides(prev => {
                  const updated = [...prev];
                  updated[activeSlideIdx].shapes = [...(updated[activeSlideIdx].shapes || []), shape];
                  return updated;
                });
              };
              setAiTip(`🎨 Mermaid diagram rendered for "${aiPromptQuery}" (SVG unavailable)`);
            } catch (merr) {
              console.error('Mermaid Fallback render failed:', merr);
              setAiTip(`❌ AI engine could not generate diagram. Check server logs.`);
            } finally {
              container.remove();
            }
          } else {
            throw new Error('No SVG and no Mermaid returned');
          }
        } catch (err) {
          console.error('SVG Generation Error:', err);
          setAiTip(`❌ AI engine could not generate diagram. Check server logs.`);
        }
      } else {
        try {
          const response = await fetch('/api/ai/diagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: aiPromptQuery, type: aiToolType })
          });
          if (!response.ok) throw new Error('Diagram API unavailable');
          const data = await response.json();
          
          const newShapes: ShapeObj[] = [];
          if (data.elements) {
            data.elements.forEach((el: any, index: number) => {
              if (el.type === 'rect') {
                newShapes.push({ id: `rect-${Date.now()}-${index}`, type: 'rect', x: el.x || 100, y: el.y || 100, width: el.width || 100, height: el.height || 100, fill: el.fill || 'transparent', stroke: el.fill || '#fff', strokeWidth: 2, text: el.text });
              } else if (el.type === 'circle') {
                newShapes.push({ id: `circle-${Date.now()}-${index}`, type: 'circle', x: el.x || 100, y: el.y || 100, radius: el.radius || 50, stroke: el.fill || '#fff', strokeWidth: 2, text: el.text });
              } else if (el.type === 'text') {
                newShapes.push({ id: `text-${Date.now()}-${index}`, type: 'text', x: el.x || 100, y: el.y || 100, text: el.text, stroke: el.fill || '#ffffff', strokeWidth: 1, fontSize: el.fontSize || 16 });
              } else if (el.type === 'arrow') {
                newShapes.push({ id: `arrow-${Date.now()}-${index}`, type: 'arrow', x: 0, y: 0, points: el.points || [100,100,200,200], stroke: el.stroke || '#fff', strokeWidth: 2 });
              }
            });
          }
          
          if (newShapes.length === 0) {
            throw new Error('No valid diagram elements returned');
          }
          
          setSlides(prev => {
            const updated = [...prev];
            updated[activeSlideIdx].shapes = [...(updated[activeSlideIdx].shapes || []), ...newShapes];
            return updated;
          });
          setAiTip(`🪄 AI Assistant generated a diagram for "${aiPromptQuery}"`);
        } catch (err) {
          console.error('Canvas Diagram Error:', err);
          setAiTip(`❌ AI engine could not generate diagram. Check server logs.`);
        }
      }
    } catch (e) {
      console.error("Diagram generation error:", e);
      setAiTip("❌ Diagram generation failed. Please try again.");
    } finally {
      setIsGeneratingDiagram(false);
      setAiPromptQuery('');
    }
  };

  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight - 120 });

  useEffect(() => {
    if (selectedObj) {
      if (trRef.current && stageRef.current) {
        const node = stageRef.current.findOne('#' + selectedObj.id);
        if (node) {
          trRef.current.nodes([node]);
          trRef.current.getLayer().batchDraw();
        }
      }
    } else {
      if (trRef.current) {
        trRef.current.nodes([]);
        trRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedObj, activeSlideIdx]);

  // Adapt brush color depending on the background paper shade
  useEffect(() => {
    if (backgroundColor === '#ffffff' && (brushColor === '#ffffff' || brushColor === '#fff')) {
      setBrushColor('#0f172a');
    } else if (backgroundColor !== '#ffffff' && brushColor === '#0f172a') {
      setBrushColor('#ffffff');
    }
  }, [backgroundColor]);

  // Tablet & Device Responsive Canvas Handling using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ 
          width: width || window.innerWidth, 
          height: height || (window.innerHeight - 120) 
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Generous tolerances for comfortable erasing
  const isCloseToLine = (linePoints: number[], px: number, py: number) => {
    for (let i = 0; i < linePoints.length; i += 2) {
      const lx = linePoints[i];
      const ly = linePoints[i+1];
      const dist = Math.sqrt(Math.pow(lx - px, 2) + Math.pow(ly - py, 2));
      if (dist < 45) return true; // Generous circular hit stroke
    }
    return false;
  };

  const isCloseToShape = (shape: ShapeObj, px: number, py: number) => {
    if (shape.type === 'rect' || shape.type === 'square') {
      const minX = Math.min(shape.x, shape.x + (shape.width || 0));
      const maxX = Math.max(shape.x, shape.x + (shape.width || 0));
      const minY = Math.min(shape.y, shape.y + (shape.height || 0));
      const maxY = Math.max(shape.y, shape.y + (shape.height || 0));
      return px >= minX - 30 && px <= maxX + 30 && py >= minY - 30 && py <= maxY + 30; // Expanded bounding box hit zone
    }
    if (shape.type === 'circle' || shape.type === 'ellipse' || shape.type === 'triangle' || shape.type === 'polygon' || shape.type === 'pentagon' || shape.type === 'star' || shape.type === 'geometry') {
      const dist = Math.sqrt(Math.pow(shape.x - px, 2) + Math.pow(shape.y - py, 2));
      return dist <= (shape.radius || 20) + 35; // Generous circular radius hit zone
    }
    if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'ruler-15' || shape.type === 'ruler-30' || shape.type === 'protractor' || shape.type === 'compass' || shape.type === 'setsquare-45' || shape.type === 'setsquare-30-60') {
      if (shape.points) {
        for (let i = 0; i < shape.points.length; i += 2) {
          const lx = shape.x + shape.points[i];
          const ly = shape.y + shape.points[i+1];
          const dist = Math.sqrt(Math.pow(lx - px, 2) + Math.pow(ly - py, 2));
          if (dist < 50) return true;
        }
      } else {
        // Fallback for tools without standard path points: check distance to shape origin
        const dist = Math.sqrt(Math.pow(shape.x - px, 2) + Math.pow(shape.y - py, 2));
        return dist < 60;
      }
    }
    return false;
  };

  const eraseAt = (px: number, py: number) => {
    setSlides(prev => {
      const updated = [...prev];
      const current = updated[activeSlideIdx];
      current.lines = current.lines.filter(line => !isCloseToLine(line.points, px, py));
      current.shapes = current.shapes.filter(shape => !isCloseToShape(shape, px, py));
      return updated;
    });
  };

  // Convert client pointer coordinate relative to current zoom stage position & scale factor
  const getRelativePointerPosition = (stage: any) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const x = (pointer.x - stage.x()) / stage.scaleX();
    const y = (pointer.y - stage.y()) / stage.scaleY();
    if (snapToGrid) {
      return {
        x: Math.round(x / 20) * 20,
        y: Math.round(y / 20) * 20,
      };
    }
    return { x, y };
  };

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const pos = getRelativePointerPosition(stage);
    if (!pos) return;

    if (tool === 'object_eraser') {
      isDrawing.current = true;
      eraseAt(pos.x, pos.y);
      return;
    }
    
    if (tool === 'select') {
      // Clear selected object if clicking raw stage background
      if (e.target === stage) {
        setSelectedObj(null);
      }
      return;
    }
    
    isDrawing.current = true;
    
    if (tool === 'pen' || tool === 'pencil' || tool === 'marker' || tool === 'highlighter' || tool === 'eraser') {
      let colorStr = brushColor;
      let sizeVal = brushSize;
      
      if (tool === 'pencil') {
        colorStr = brushColor + 'a0'; 
        sizeVal = Math.max(1, Math.round(brushSize * 0.5));
      } else if (tool === 'marker') {
        colorStr = brushColor;
        sizeVal = brushSize * 2.2;
      } else if (tool === 'highlighter') {
        colorStr = brushColor + '40'; 
        sizeVal = brushSize * 4.0;
      } else if (tool === 'eraser') {
        colorStr = '#000000';
        sizeVal = brushSize * 3.0;
      }
      
      const newLine: LineObj = {
        id: Date.now().toString(),
        tool,
        color: colorStr,
        brushSize: sizeVal,
        points: [pos.x, pos.y, pos.x, pos.y],
      };
      
      setSlides(prev => {
        const updated = [...prev];
        updated[activeSlideIdx].lines.push(newLine);
        return updated;
      });
    } else if (tool === 'shape') {
      if (shapeType === 'text') {
        const textVal = prompt('Enter academic text value:');
        if (textVal) {
          const newShape: ShapeObj = {
            id: Date.now().toString(),
            type: shapeType,
            x: pos.x,
            y: pos.y,
            stroke: brushColor,
            strokeWidth: brushSize,
            fill: brushColor,
            width: 0,
            height: 0,
            radius: 0,
            points: [0, 0, 0, 0],
            text: textVal,
            fontSize: Math.max(16, brushSize * 4)
          };
          setSlides(prev => {
            const updated = [...prev];
            updated[activeSlideIdx].shapes.push(newShape);
            return updated;
          });
        }
        isDrawing.current = false;
        return;
      }
      
      const newShape: ShapeObj = {
        id: Date.now().toString(),
        type: shapeType,
        x: pos.x,
        y: pos.y,
        stroke: brushColor,
        strokeWidth: brushSize,
        fill: 'transparent',
        width: 0,
        height: 0,
        radius: 0,
        points: [0, 0, 0, 0]
      };
      
      setSlides(prev => {
        const updated = [...prev];
        updated[activeSlideIdx].shapes.push(newShape);
        return updated;
      });
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const point = getRelativePointerPosition(stage);
    
    // Eraser hover state tracking for circular outline
    if (point && (tool === 'eraser' || tool === 'object_eraser')) {
      setEraserHoverPos(point);
    } else {
      setEraserHoverPos(null);
    }

    if (!isDrawing.current) return;
    if (!point) return;
    
    if (tool === 'object_eraser') {
      eraseAt(point.x, point.y);
      return;
    }

    if (tool === 'select') return;

    setSlides(prev => {
      const updated = [...prev];
      const currentSlide = updated[activeSlideIdx];

      if (tool === 'pen' || tool === 'pencil' || tool === 'marker' || tool === 'highlighter' || tool === 'eraser') {
        const lastLine = currentSlide.lines[currentSlide.lines.length - 1];
        if (lastLine) {
          lastLine.points = lastLine.points.concat([point.x, point.y]);
        }
      } else if (tool === 'shape') {
        const lastShape = currentSlide.shapes[currentSlide.shapes.length - 1];
        if (lastShape) {
          if (lastShape.type === 'rect') {
            lastShape.width = point.x - lastShape.x;
            lastShape.height = point.y - lastShape.y;
          } else if (lastShape.type === 'square') {
            const size = Math.max(Math.abs(point.x - lastShape.x), Math.abs(point.y - lastShape.y));
            lastShape.width = (point.x < lastShape.x ? -1 : 1) * size;
            lastShape.height = (point.y < lastShape.y ? -1 : 1) * size;
          } else if (lastShape.type === 'ellipse') {
            lastShape.width = point.x - lastShape.x;
            lastShape.height = point.y - lastShape.y;
          } else if (lastShape.type === 'circle') {
            lastShape.radius = Math.sqrt(Math.pow(point.x - lastShape.x, 2) + Math.pow(point.y - lastShape.y, 2));
          } else if (lastShape.type === 'line' || lastShape.type === 'arrow') {
            lastShape.points = [0, 0, point.x - lastShape.x, point.y - lastShape.y];
          } else if (
            lastShape.type === 'triangle' || 
            lastShape.type === 'polygon' || 
            lastShape.type === 'pentagon' || 
            lastShape.type === 'star' || 
            lastShape.type === 'geometry' ||
            lastShape.type === 'ruler-15' ||
            lastShape.type === 'ruler-30' ||
            lastShape.type === 'protractor' ||
            lastShape.type === 'compass' ||
            lastShape.type === 'setsquare-45' ||
            lastShape.type === 'setsquare-30-60' ||
            lastShape.type === 'ruler' ||
            lastShape.type === 'setsquare'
          ) {
            lastShape.radius = Math.sqrt(Math.pow(point.x - lastShape.x, 2) + Math.pow(point.y - lastShape.y, 2));
          }
        }
      }
      return updated;
    });
  };

  const handleMouseUp = () => {
    isDrawing.current = false;

    // AI Predictive Shape Assistant Engine
    if (aiShapeAssistant && (tool === 'pen' || tool === 'pencil' || tool === 'marker' || tool === 'highlighter')) {
      const currentSlide = slides[activeSlideIdx];
      const lastLine = currentSlide.lines[currentSlide.lines.length - 1];
      
      if (lastLine && lastLine.points.length >= 10) {
        const pts = lastLine.points;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0;
        const count = pts.length / 2;
        
        for (let i = 0; i < pts.length; i += 2) {
          const px = pts[i];
          const py = pts[i + 1];
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
          sumX += px;
          sumY += py;
        }

        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = sumX / count;
        const centerY = sumY / count;

        const startX = pts[0];
        const startY = pts[1];
        const endX = pts[pts.length - 2];
        const endY = pts[pts.length - 1];
        
        const startEndDist = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        const diag = Math.sqrt(width * width + height * height);
        const isClosed = startEndDist < diag * 0.45; // Generous closure threshold

        let recognized: 'circle' | 'square' | 'rect' | 'triangle' | 'line' | null = null;

        if (isClosed && diag > 25) {
          // Circularity metrics
          let sumRadius = 0;
          for (let i = 0; i < pts.length; i += 2) {
            sumRadius += Math.sqrt(Math.pow(pts[i] - centerX, 2) + Math.pow(pts[i + 1] - centerY, 2));
          }
          const avgRadius = sumRadius / count;
          
          let variance = 0;
          for (let i = 0; i < pts.length; i += 2) {
            const r = Math.sqrt(Math.pow(pts[i] - centerX, 2) + Math.pow(pts[i + 1] - centerY, 2));
            variance += Math.pow(r - avgRadius, 2);
          }
          const stdDev = Math.sqrt(variance / count);
          const circularity = stdDev / avgRadius;

          if (circularity < 0.22) {
            recognized = 'circle';
          } else {
            // Check aspect ratio for square vs rectangle
            const ratioDiff = Math.abs(width - height) / Math.max(width, height);
            if (ratioDiff < 0.2) {
              recognized = 'square';
            } else {
              recognized = 'rect';
            }
          }
        } else if (diag > 40) {
          // Straight line check
          let pathLen = 0;
          for (let i = 2; i < pts.length; i += 2) {
            pathLen += Math.sqrt(Math.pow(pts[i] - pts[i - 2], 2) + Math.pow(pts[i + 1] - pts[i - 1], 2));
          }
          const straightLen = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
          if (straightLen / pathLen > 0.82) {
            recognized = 'line';
          }
        }

        if (recognized) {
          // Replace rough line with a beautiful vector shape
          setSlides(prev => {
            const updated = [...prev];
            const slide = updated[activeSlideIdx];
            // Remove the hand stroke
            slide.lines = slide.lines.filter(l => l.id !== lastLine.id);

            // Add the perfect geometry
            const cleanStroke = lastLine.color.substring(0, 7);
            if (recognized === 'circle') {
              const radius = Math.max(width, height) / 2;
              slide.shapes.push({
                id: `ai_${Date.now()}`,
                type: 'circle',
                x: centerX,
                y: centerY,
                radius,
                stroke: cleanStroke,
                strokeWidth: Math.max(2, lastLine.brushSize)
              });
            } else if (recognized === 'square') {
              const size = Math.max(width, height);
              slide.shapes.push({
                id: `ai_${Date.now()}`,
                type: 'square',
                x: centerX - size / 2,
                y: centerY - size / 2,
                width: size,
                height: size,
                stroke: cleanStroke,
                strokeWidth: Math.max(2, lastLine.brushSize)
              });
            } else if (recognized === 'rect') {
              slide.shapes.push({
                id: `ai_${Date.now()}`,
                type: 'rect',
                x: minX,
                y: minY,
                width,
                height,
                stroke: cleanStroke,
                strokeWidth: Math.max(2, lastLine.brushSize)
              });
            } else if (recognized === 'line') {
              slide.shapes.push({
                id: `ai_${Date.now()}`,
                type: 'line',
                x: startX,
                y: startY,
                points: [0, 0, endX - startX, endY - startY],
                stroke: cleanStroke,
                strokeWidth: Math.max(2, lastLine.brushSize)
              });
            }

            return updated;
          });
          setAiTip(`🪄 AI Assistant: Sketched path converted to a perfect ${recognized}!`);
        }
      }
    }
  };
  
  const handleObjectClick = (e: any, id: string, type: 'line' | 'shape') => {
    if (tool === 'object_eraser') {
      setSlides(prev => {
        const updated = [...prev];
        if (type === 'line') {
          updated[activeSlideIdx].lines = updated[activeSlideIdx].lines.filter(l => l.id !== id);
        } else {
          updated[activeSlideIdx].shapes = updated[activeSlideIdx].shapes.filter(s => s.id !== id);
        }
        return updated;
      });
      if (selectedObj?.id === id) {
        setSelectedObj(null);
      }
    } else if (tool === 'select') {
      e.cancelBubble = true;
      setSelectedObj({ id, type });
    }
  };

  const handleClearCanvas = () => {
    if (confirm("Are you sure you want to clear this slide's canvas?")) {
      setSlides(prev => {
        const updated = [...prev];
        updated[activeSlideIdx].lines = [];
        updated[activeSlideIdx].shapes = [];
        return updated;
      });
      setSelectedObj(null);
    }
  };

  // Slide Manager Actions
  const handleAddSlide = () => {
    setSlides(prev => [...prev, { id: `slide_${Date.now()}`, shapes: [], lines: [], stickies: [] }]);
    setActiveSlideIdx(slides.length);
    setSelectedObj(null);
  };

  const handleDuplicateSlide = () => {
    const current = slides[activeSlideIdx];
    const duplicated: Slide = {
      id: `slide_${Date.now()}`,
      shapes: current.shapes.map(s => ({ ...s, id: `shape_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` })),
      lines: current.lines.map(l => ({ ...l, id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` })),
      stickies: []
    };
    setSlides(prev => {
      const updated = [...prev];
      updated.splice(activeSlideIdx + 1, 0, duplicated);
      return updated;
    });
    setActiveSlideIdx(activeSlideIdx + 1);
    setSelectedObj(null);
  };

  const handleDeleteSlide = () => {
    if (slides.length <= 1) {
      alert("You cannot delete the only remaining slide.");
      return;
    }
    if (confirm("Are you sure you want to delete this whiteboard slide?")) {
      const newIdx = Math.max(0, activeSlideIdx - 1);
      setSlides(prev => prev.filter((_, idx) => idx !== activeSlideIdx));
      setActiveSlideIdx(newIdx);
      setSelectedObj(null);
    }
  };

  // Zoom viewport controls
  const handleZoomIn = () => setStageScale(prev => Math.min(4, prev + 0.15));
  const handleZoomOut = () => setStageScale(prev => Math.max(0.4, prev - 0.15));
  const handleResetZoom = () => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  // Selection Object Modifiers
  const handleModifyObjectColor = (color: string) => {
    if (!selectedObj) return;
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      if (selectedObj.type === 'shape') {
        const shape = slide.shapes.find(s => s.id === selectedObj.id);
        if (shape) {
          shape.stroke = color;
          if (shape.type === 'text') shape.fill = color;
        }
      } else {
        const line = slide.lines.find(l => l.id === selectedObj.id);
        if (line) line.color = color;
      }
      return updated;
    });
  };

  const handleModifyObjectFill = (color: string) => {
    if (!selectedObj || selectedObj.type !== 'shape') return;
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      const shape = slide.shapes.find(s => s.id === selectedObj.id);
      if (shape) shape.fill = color;
      return updated;
    });
  };

  const handleModifyObjectThickness = (size: number) => {
    if (!selectedObj) return;
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      if (selectedObj.type === 'shape') {
        const shape = slide.shapes.find(s => s.id === selectedObj.id);
        if (shape) shape.strokeWidth = size;
      } else {
        const line = slide.lines.find(l => l.id === selectedObj.id);
        if (line) line.brushSize = size;
      }
      return updated;
    });
  };

  const handleModifyObjectLayer = (order: 'front' | 'back') => {
    if (!selectedObj) return;
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      if (selectedObj.type === 'shape') {
        const shapeIdx = slide.shapes.findIndex(s => s.id === selectedObj.id);
        if (shapeIdx > -1) {
          const shape = slide.shapes[shapeIdx];
          slide.shapes.splice(shapeIdx, 1);
          if (order === 'front') {
            slide.shapes.push(shape);
          } else {
            slide.shapes.unshift(shape);
          }
        }
      } else {
        const lineIdx = slide.lines.findIndex(l => l.id === selectedObj.id);
        if (lineIdx > -1) {
          const line = slide.lines[lineIdx];
          slide.lines.splice(lineIdx, 1);
          if (order === 'front') {
            slide.lines.push(line);
          } else {
            slide.lines.unshift(line);
          }
        }
      }
      return updated;
    });
  };

  const handleDeleteSelectedObject = () => {
    if (!selectedObj) return;
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      if (selectedObj.type === 'shape') {
        slide.shapes = slide.shapes.filter(s => s.id !== selectedObj.id);
      } else {
        slide.lines = slide.lines.filter(l => l.id !== selectedObj.id);
      }
      return updated;
    });
    setSelectedObj(null);
  };

  const handleDuplicateSelectedObject = () => {
    if (!selectedObj) return;
    setSlides(prev => {
      const updated = [...prev];
      const slide = updated[activeSlideIdx];
      if (selectedObj.type === 'shape') {
        const shape = slide.shapes.find(s => s.id === selectedObj.id);
        if (shape) {
          const dup: ShapeObj = {
            ...shape,
            id: `shape_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            x: shape.x + 25,
            y: shape.y + 25,
          };
          slide.shapes.push(dup);
          setTimeout(() => setSelectedObj({ id: dup.id, type: 'shape' }), 50);
        }
      } else {
        const line = slide.lines.find(l => l.id === selectedObj.id);
        if (line) {
          const dup: LineObj = {
            ...line,
            id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            points: line.points.map((p, i) => i % 2 === 0 ? p + 25 : p + 25)
          };
          slide.lines.push(dup);
          setTimeout(() => setSelectedObj({ id: dup.id, type: 'line' }), 50);
        }
      }
      return updated;
    });
  };

  const handleEditSelectedObjectLabel = () => {
    if (!selectedObj || selectedObj.type !== 'shape') return;
    const slide = slides[activeSlideIdx];
    const shape = slide?.shapes.find(s => s.id === selectedObj.id);
    if (!shape) return;

    const newText = prompt('Edit label / text content:', shape.text || '');
    if (newText !== null) {
      setSlides(prev => {
        const updated = [...prev];
        const currentSlide = updated[activeSlideIdx];
        const target = currentSlide.shapes.find(s => s.id === selectedObj.id);
        if (target) {
          target.text = newText;
        }
        return updated;
      });
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportPNG = () => {
    if (!stageRef.current) return;
    if (trRef.current) trRef.current.nodes([]);
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `smartboard_slide_${activeSlideIdx + 1}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setAiTip(`🖼️ Exported Slide ${activeSlideIdx + 1} as PNG`);
  };

  const handleExportPDF = () => {
    if (!stageRef.current) return;
    if (trRef.current) trRef.current.nodes([]);
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>SmartBoard Slide ${activeSlideIdx + 1} Export</title>
            <style>
              body { margin: 0; display: flex; align-items: center; justify-content: center; background: #0f172a; height: 100vh; font-family: sans-serif; }
              img { max-width: 95%; max-height: 95vh; object-fit: contain; box-shadow: 0 10px 30px rgba(0,0,0,0.6); border-radius: 12px; }
              @media print {
                body { background: #fff; }
                img { max-width: 100%; height: auto; box-shadow: none; border-radius: 0; }
              }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" onload="window.print();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
    setAiTip(`📄 PDF export ready for Slide ${activeSlideIdx + 1}`);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const src = evt.target?.result as string;
      if (!src) return;
      const img = new Image();
      img.src = src;
      img.onload = () => {
        const imgShape: ShapeObj = {
          id: `img_${Date.now()}`,
          type: 'svg_node',
          x: 120,
          y: 120,
          width: Math.min(img.width, 500) || 400,
          height: Math.min(img.height, 350) || 300,
          stroke: '#818cf8',
          strokeWidth: 0,
          imageObj: img
        };
        setSlides(prev => {
          const updated = [...prev];
          updated[activeSlideIdx].shapes.push(imgShape);
          return updated;
        });
        setAiTip(`🖼️ Inserted image onto whiteboard`);
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleInsertStickyNote = (color: string = '#fef08a') => {
    const stickyShape: ShapeObj = {
      id: `sticky_${Date.now()}`,
      type: 'rect',
      x: 180 + Math.random() * 60,
      y: 150 + Math.random() * 60,
      width: 220,
      height: 190,
      stroke: '#eab308',
      strokeWidth: 2,
      fill: color,
      text: 'Double-click to edit note'
    };
    setSlides(prev => {
      const updated = [...prev];
      updated[activeSlideIdx].shapes.push(stickyShape);
      return updated;
    });
    setAiTip(`📝 Sticky note inserted!`);
  };

  const currentSlide = slides[activeSlideIdx] || { id: 'default', shapes: [], lines: [] };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col font-sans select-none overflow-hidden">
      
      {/* 1. MAIN HEADER / BRAND BAR */}
      <div className="h-14 bg-slate-900 border-b border-white/10 flex items-center justify-between px-4 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-white/5 shadow-md flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" /> Exit Board
          </button>
          <div className="text-white font-black text-sm tracking-widest uppercase flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-glow shadow-emerald-500/55" />
            Class SmartBoard 3.0
          </div>
        </div>
        
        {/* Dynamic Tool Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950 border border-white/10 p-1.5 rounded-2xl shadow-inner max-w-full overflow-x-auto">
          <button 
            onClick={() => { setTool('select'); setShapesMenuOpen(false); }} 
            className={`p-2 rounded-xl transition-all ${tool === 'select' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title="Select & Move Shapes/Lines"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => { setTool('pen'); setShapesMenuOpen(false); }} 
            className={`p-2 rounded-xl transition-all ${tool === 'pen' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title="Academic Ink Pen"
          >
            <Pen className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => { setTool('pencil'); setShapesMenuOpen(false); }} 
            className={`p-2 rounded-xl transition-all ${tool === 'pencil' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title="Fine Graphite Pencil"
          >
            <span className="text-xs font-extrabold font-mono">✏️</span>
          </button>
          
          <button 
            onClick={() => { setTool('marker'); setShapesMenuOpen(false); }} 
            className={`p-2 rounded-xl transition-all ${tool === 'marker' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title="Bold Dry-Erase Marker"
          >
            <span className="text-xs font-extrabold font-mono">🖍️</span>
          </button>
          
          <button 
            onClick={() => { setTool('highlighter'); setShapesMenuOpen(false); }} 
            className={`p-2 rounded-xl transition-all ${tool === 'highlighter' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title="Translucent Text Highlighter"
          >
            <PenTool className="w-4 h-4" />
          </button>
          
          {/* Shapes Dropdown Selector Menu */}
          <div className="relative">
            <button 
              onClick={() => { setShapesMenuOpen(!shapesMenuOpen); setTool('shape'); }} 
              className={`p-2 px-3 rounded-xl transition-all flex items-center gap-1 border border-transparent ${tool === 'shape' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              title="Interactive Shapes Menu"
            >
              <Square className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider hidden md:inline">{shapeType}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            
            {shapesMenuOpen && (
              <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2.5 flex flex-col gap-1 w-44 z-50 animate-fadeIn max-h-64 overflow-y-auto">
                 <div className="px-2.5 py-1 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1">Vector Geometries</div>
                 <button onClick={() => { setTool('shape'); setShapeType('line'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'line' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Minus className="w-3.5 h-3.5" /> Simple Line</button>
                 <button onClick={() => { setTool('shape'); setShapeType('arrow'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'arrow' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>↗ Directed Arrow</button>
                 <button onClick={() => { setTool('shape'); setShapeType('rect'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'rect' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Square className="w-3.5 h-3.5" /> Rectangle</button>
                 <button onClick={() => { setTool('shape'); setShapeType('square'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'square' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Square className="w-3.5 h-3.5 text-indigo-400" /> Square Node</button>
                 <button onClick={() => { setTool('shape'); setShapeType('circle'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'circle' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><CircleIcon className="w-3.5 h-3.5" /> Circular Node</button>
                 <button onClick={() => { setTool('shape'); setShapeType('triangle'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'triangle' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Triangle className="w-3.5 h-3.5" /> Equilateral Triangle</button>
                 <button onClick={() => { setTool('shape'); setShapeType('polygon'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'polygon' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><span className="text-xs font-extrabold font-mono">⬡</span> Hexagonal Hex</button>
                 <button onClick={() => { setTool('shape'); setShapeType('geometry'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'geometry' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><span className="text-xs font-extrabold font-mono">📐</span> Graph Axis Grid</button>
                <div className="px-2.5 py-1 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1 mt-1">Geometry Tools</div>
                 <button onClick={() => { setTool('shape'); setShapeType('ruler'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'ruler' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><span className="text-xs font-extrabold font-mono">📏</span> Ruler</button>
                 <button onClick={() => { setTool('shape'); setShapeType('protractor'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'protractor' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><span className="text-xs font-extrabold font-mono">🪶</span> Protractor</button>
                 <button onClick={() => { setTool('shape'); setShapeType('compass'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'compass' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><span className="text-xs font-extrabold font-mono">🧭</span> Compass</button>
                 <button onClick={() => { setTool('shape'); setShapeType('setsquare'); setShapesMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${shapeType === 'setsquare' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Triangle className="w-3.5 h-3.5" /> Set Square</button>
              </div>
            )}
          </div>
          
          <div className="relative">
            <button 
              onClick={() => { setEraserMenuOpen(!eraserMenuOpen); if(!eraserMenuOpen) setTool('eraser'); setShapesMenuOpen(false); }} 
              className={`p-2 rounded-xl transition-all flex items-center gap-1 ${tool === 'eraser' || tool === 'object_eraser' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              title="Erase Lines & Shapes"
            >
              <Eraser className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {eraserMenuOpen && (
              <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2.5 flex flex-col gap-1 w-40 z-50 animate-fadeIn max-h-64 overflow-y-auto">
                 <button onClick={() => { setTool('eraser'); setEraserMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${tool === 'eraser' ? 'bg-red-500/20 text-red-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>Stroke Eraser</button>
                 <button onClick={() => { setTool('object_eraser'); setEraserMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${tool === 'object_eraser' ? 'bg-red-500/20 text-red-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>Object Eraser</button>
              </div>
            )}
          </div>
        </div>

        {/* Global Action Handlers */}
        <div className="flex items-center gap-2">
          
          <div className="relative">
            <button 
              onClick={() => setAiPromptOpen(!aiPromptOpen)}
              className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
              title="AI Whiteboard (Coming Soon)"
            >
              <span>🚀</span>
              <span>AI Whiteboard</span>
            </button>
            {aiPromptOpen && (
              <div className="absolute top-full mt-2 right-0 w-80 bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-2xl z-50 space-y-3 backdrop-blur-xl animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🚀</span>
                    <h4 className="text-sm font-extrabold text-white tracking-tight">AI Whiteboard</h4>
                  </div>
                  <button onClick={() => setAiPromptOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
                </div>
                
                <div className="inline-block px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-[10px] font-black uppercase tracking-wider">
                  Coming Soon
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  AI-powered SVG diagrams, Mermaid diagrams, intelligent flowcharts, concept maps, visual learning, and advanced whiteboard AI will arrive in a future StudentOS update.
                </p>

                <div className="pt-2 border-t border-white/10 flex justify-end">
                  <button 
                    onClick={() => setAiPromptOpen(false)} 
                    className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-md"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Sticky Notes & Media Tools */}
          <button 
            onClick={() => handleInsertStickyNote('#fef08a')}
            className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
            title="Insert Sticky Note"
          >
            <StickyNote className="w-4 h-4" />
            <span className="hidden lg:inline text-[10px] uppercase font-black">Sticky</span>
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
            title="Upload Image File"
          >
            <ImageIcon className="w-4 h-4 text-indigo-400" />
            <span className="hidden lg:inline text-[10px] uppercase font-black">Image</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />

          <div className="h-5 w-px bg-white/10 mx-0.5" />

          {/* Export PNG / PDF */}
          <button 
            onClick={handleExportPNG}
            className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-1 text-xs font-bold"
            title="Export Board as PNG Image"
          >
            <Download className="w-4 h-4" />
            <span className="hidden xl:inline text-[10px] uppercase font-black">PNG</span>
          </button>

          <button 
            onClick={handleExportPDF}
            className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-xl transition-all flex items-center gap-1 text-xs font-bold"
            title="Print / Save Board as PDF Document"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden xl:inline text-[10px] uppercase font-black">PDF</span>
          </button>

          <button 
            onClick={handleClearCanvas}
            className="p-2 bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-400 hover:border-red-500/35 rounded-xl transition-all border border-white/5"
            title="Reset Board Elements"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. SECONDARY CONTROLS HUD (ZOOM + SLIDES + ACTIVE OBJECT CONFIG) */}
      <div className="bg-slate-900/90 border-b border-white/5 py-2 px-4 flex flex-wrap items-center justify-between gap-3 shrink-0 z-10 backdrop-blur-md">
        
        {/* Dynamic Multi-Slide Manager */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-2xl border border-white/5 shadow-md">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mr-1">Slides</span>
          <button 
            disabled={activeSlideIdx <= 0}
            onClick={() => { setActiveSlideIdx(prev => prev - 1); setSelectedObj(null); }}
            className="p-1 text-slate-400 hover:text-white disabled:text-slate-700 transition-colors"
            title="Previous Slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-200 font-mono px-1">
            {activeSlideIdx + 1} / {slides.length}
          </span>
          <button 
            disabled={activeSlideIdx >= slides.length - 1}
            onClick={() => { setActiveSlideIdx(prev => prev + 1); setSelectedObj(null); }}
            className="p-1 text-slate-400 hover:text-white disabled:text-slate-700 transition-colors"
            title="Next Slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <div className="h-4 w-px bg-white/10 mx-1" />
          
          <button 
            onClick={handleAddSlide}
            className="p-1 px-2.5 bg-indigo-500/10 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1 border border-indigo-500/20"
            title="Add New Blank Slide"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
          <button 
            onClick={handleDuplicateSlide}
            className="p-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1 border border-white/5"
            title="Duplicate Current Elements to New Slide"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button 
            disabled={slides.length <= 1}
            onClick={handleDeleteSlide}
            className="p-1 text-red-400 hover:text-red-300 disabled:text-slate-700 transition-colors"
            title="Delete Current Slide"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View Zoom & Navigation Controls */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-2xl border border-white/5 shadow-md font-mono">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest mr-1">Viewport</span>
          <button onClick={handleZoomOut} className="p-1 text-slate-400 hover:text-white transition-colors" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs text-slate-300 font-bold w-12 text-center">{Math.round(stageScale * 100)}%</span>
          <button onClick={handleZoomIn} className="p-1 text-slate-400 hover:text-white transition-colors" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={handleResetZoom} className="p-1 ml-1 text-indigo-400 hover:text-indigo-300 transition-colors" title="Fit to Canvas (100%)"><Maximize2 className="w-3.5 h-3.5" /></button>
        </div>

        {/* Board Background Config */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-2xl border border-white/5 shadow-md font-mono hidden md:flex">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest mr-1">Paper</span>
          <select 
            value={backgroundPattern} 
            onChange={(e) => setBackgroundPattern(e.target.value as any)}
            className="bg-slate-900 border border-white/10 rounded-xl text-xs text-white px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="plain">Plain</option>
            <option value="grid">Grid</option>
            <option value="dot">Dot Grid</option>
            <option value="graph">Graph Paper</option>
            <option value="ruled">Ruled Paper</option>
          </select>
        </div>

        {/* Selected Object Advanced Properties Config Panel */}
        {selectedObj ? (
          <div className="flex items-center gap-3.5 bg-indigo-500/10 border border-indigo-500/30 px-4 py-1.5 rounded-2xl animate-fadeIn max-h-64 overflow-y-auto">
            <span className="text-[10px] text-indigo-300 uppercase tracking-widest font-black font-mono">Selected: {selectedObj.type}</span>
            
            {/* Color modifier */}
            <div className="flex items-center gap-1">
              {[ '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#eab308' ].map(col => (
                <button 
                  key={col}
                  onClick={() => handleModifyObjectColor(col)}
                  className="w-4.5 h-4.5 rounded-full border border-white/20 hover:scale-110 transition-transform shadow-sm"
                  style={{ backgroundColor: col }}
                  title="Change Stroke Color"
                />
              ))}
            </div>

            {/* Fill modifier (Shapes only) */}
            {selectedObj.type === 'shape' && (
              <div className="flex items-center gap-1 border-l border-white/10 pl-3">
                <span className="text-[8px] text-slate-400 mr-1 uppercase font-mono">Fill</span>
                <button 
                  onClick={() => handleModifyObjectFill('transparent')}
                  className="w-4.5 h-4.5 rounded-full border border-white/20 text-slate-400 text-[8px] font-bold hover:scale-110 transition-transform bg-slate-900"
                  title="Transparent Fill"
                >
                  ∅
                </button>
                {[ '#ef444430', '#3b82f630', '#10b98130', '#eab30830', '#ffffff20' ].map(fillCol => (
                  <button 
                    key={fillCol}
                    onClick={() => handleModifyObjectFill(fillCol)}
                    className="w-4.5 h-4.5 rounded-full border border-white/20 hover:scale-110 transition-transform shadow-sm"
                    style={{ backgroundColor: fillCol }}
                    title="Soft Translucent Fill"
                  />
                ))}
              </div>
            )}

            {/* Thickness Modifier */}
            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <input 
                type="range"
                min="1"
                max="24"
                onChange={(e) => handleModifyObjectThickness(parseInt(e.target.value))}
                className="w-16 accent-indigo-500 cursor-pointer"
                title="Change Border Thickness"
              />
            </div>

            {/* Order/Layering modifiers */}
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
              <button 
                onClick={() => handleModifyObjectLayer('front')} 
                className="p-1 bg-slate-850 hover:bg-slate-700 text-slate-200 rounded-lg border border-white/5" 
                title="Bring Layer to Front"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => handleModifyObjectLayer('back')} 
                className="p-1 bg-slate-850 hover:bg-slate-700 text-slate-200 rounded-lg border border-white/5" 
                title="Send Layer to Back"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Duplicate & Edit Label controls */}
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
              {selectedObj.type === 'shape' && (
                <button 
                  onClick={handleEditSelectedObjectLabel} 
                  className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg border border-white/10 text-[10px] font-bold flex items-center gap-1" 
                  title="Edit Label / Text"
                >
                  <Type className="w-3 h-3" /> Label
                </button>
              )}
              <button 
                onClick={() => {
                  setSlides(prev => {
                    const updated = [...prev];
                    const slide = updated[activeSlideIdx];
                    if (selectedObj.type === 'shape') {
                      const shape = slide.shapes.find(s => s.id === selectedObj.id);
                      if (shape) (shape as any).isLocked = !(shape as any).isLocked;
                    } else {
                      const line = slide.lines.find(l => l.id === selectedObj.id);
                      if (line) (line as any).isLocked = !(line as any).isLocked;
                    }
                    return updated;
                  });
                }} 
                className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-white/10 text-[10px] font-bold flex items-center gap-1" 
                title="Lock/Unlock Element"
              >
                Lock
              </button>
              <button 
                onClick={handleDuplicateSelectedObject} 
                className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-white/10 text-[10px] font-bold flex items-center gap-1" 
                title="Duplicate Element"
              >
                <Copy className="w-3 h-3" /> Duplicate
              </button>
            </div>

            {/* Action buttons */}
            <button 
              onClick={handleDeleteSelectedObject} 
              className="p-1 px-2.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase rounded-lg border border-red-500/30 shadow-md transition-all flex items-center gap-1"
              title="Delete Element"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>
        ) : (
          /* General Stroke Thickness Controls */
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-white/5 p-1 rounded-full">
              {[ '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#eab308' ].map(c => (
                <button 
                  key={c} 
                  onClick={() => setBrushColor(c)} 
                  className={`w-5 h-5 rounded-full border-2 transition-all ${brushColor === c ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'}`} 
                  style={{ backgroundColor: c }} 
                />
              ))}
            </div>
            
            <div className="flex items-center gap-2 bg-slate-950 border border-white/5 px-2.5 py-1 rounded-xl">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <input 
                type="range" 
                min="1" 
                max="24" 
                value={brushSize} 
                onChange={(e) => setBrushSize(parseInt(e.target.value))} 
                className="w-20 accent-indigo-500 cursor-pointer" 
                title="Brush Thickness"
              />
              <span className="text-[10px] font-mono text-slate-400 w-4 text-center">{brushSize}px</span>
            </div>
          </div>
        )}
      </div>
      
      {/* 3. DYNAMIC CANVAS DRAWING CONTAINER STAGE */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden select-none" 
        style={{ 
          cursor: tool === 'select' ? 'default' : (tool === 'eraser' || tool === 'object_eraser') ? 'cell' : 'crosshair',
          backgroundColor,
          backgroundImage: 
             backgroundPattern === 'grid' ? 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)' :
             backgroundPattern === 'dot' ? 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)' :
             backgroundPattern === 'graph' ? 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)' :
             backgroundPattern === 'ruled' ? 'linear-gradient(to bottom, transparent 24px, rgba(255,255,255,0.05) 25px)' : 'none',
          backgroundSize: 
             backgroundPattern === 'grid' ? '20px 20px' :
             backgroundPattern === 'dot' ? '20px 20px' :
             backgroundPattern === 'graph' ? '10px 10px, 10px 10px, 50px 50px, 50px 50px' :
             backgroundPattern === 'ruled' ? '100% 25px' : 'auto',
          backgroundPosition: `${stagePos.x}px ${stagePos.y}px`
        }}
      >
        <Stage
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          ref={stageRef}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          draggable={tool === 'select' && !selectedObj}
          onDragEnd={(e) => {
            if (tool === 'select' && e.target === e.target.getStage()) {
              setStagePos({ x: e.target.x(), y: e.target.y() });
            }
          }}
        >
          <Layer>
            {/* Vector Shapes rendering */}
            {currentSlide.shapes.map((shape) => (
              <Group 
                key={shape.id}
                id={shape.id}
                name="object"
                x={shape.x} 
                y={shape.y} 
                draggable={tool === 'select' && !(shape as any).isLocked}
                onDragEnd={(e) => {
                  shape.x = e.target.x();
                  shape.y = e.target.y();
                }}
                onTransformEnd={(e) => {
                  const node = e.target;
                  shape.x = node.x();
                  shape.y = node.y();
                  // For shapes we should scale their properties or just store scaleX/scaleY on the shape object.
                  // Since the shape doesn't have scale property explicitly, we can add it or just let konva keep it 
                  // as long as the component doesn't remount without it. Wait, React Konva will lose scale on remount 
                  // if not tied to state. But wait, `shape.scaleX` works if we map it!
                  (shape as any).scaleX = node.scaleX();
                  (shape as any).scaleY = node.scaleY();
                  (shape as any).rotation = node.rotation();
                }}
                scaleX={(shape as any).scaleX || 1}
                scaleY={(shape as any).scaleY || 1}
                rotation={(shape as any).rotation || 0}
                onMouseEnter={(e) => { 
                  if (tool === 'object_eraser') {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'cell';
                  }
                }}
                onClick={(e) => handleObjectClick(e, shape.id, 'shape')}
                onTap={(e) => handleObjectClick(e, shape.id, 'shape')}
                onDblClick={() => {
                  setSelectedObj({ id: shape.id, type: 'shape' });
                  setTimeout(() => handleEditSelectedObjectLabel(), 50);
                }}
              >
                {/* Visual Highlight indicator if selected */}
                {selectedObj?.id === shape.id && (
                  <Rect 
                    x={shape.type === 'circle' ? -(shape.radius || 20) - 4 : -4}
                    y={shape.type === 'circle' ? -(shape.radius || 20) - 4 : -4}
                    width={shape.type === 'circle' ? ((shape.radius || 20) * 2) + 8 : (shape.width || 40) + 8}
                    height={shape.type === 'circle' ? ((shape.radius || 20) * 2) + 8 : (shape.height || 40) + 8}
                    stroke="#4f46e5"
                    strokeWidth={1}
                    dash={[4, 2]}
                  />
                )}

                {shape.type === 'rect' && (
                  <Rect 
                    width={shape.width || 0} 
                    height={shape.height || 0} 
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'square' && (
                  <Rect 
                    width={shape.width || 0} 
                    height={shape.height || 0} 
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'circle' && (
                  <Circle 
                    radius={shape.radius || 0} 
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'ellipse' && (
                  <Ellipse 
                    radiusX={shape.width ? Math.abs(shape.width) / 2 : 30}
                    radiusY={shape.height ? Math.abs(shape.height) / 2 : 20}
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'triangle' && (
                  <RegularPolygon 
                    sides={3} 
                    radius={shape.radius || 0} 
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'pentagon' && (
                  <RegularPolygon 
                    sides={5} 
                    radius={shape.radius || 0} 
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'polygon' && (
                  <RegularPolygon 
                    sides={6} 
                    radius={shape.radius || 0} 
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'star' && (
                  <Star 
                    numPoints={5}
                    innerRadius={(shape.radius || 30) / 2}
                    outerRadius={shape.radius || 30}
                    fill={shape.fill} 
                    stroke={shape.stroke} 
                    strokeWidth={shape.strokeWidth} 
                  />
                )}
                {shape.type === 'geometry' && (
                  <Group>
                    <RegularPolygon 
                      sides={4} 
                      radius={shape.radius || 0} 
                      fill={shape.fill} 
                      stroke={shape.stroke} 
                      strokeWidth={shape.strokeWidth} 
                    />
                    <Line 
                      points={[0, -(shape.radius || 0), 0, (shape.radius || 0)]} 
                      stroke={shape.stroke} 
                      strokeWidth={1} 
                      dash={[4, 4]} 
                    />
                    <Line 
                      points={[-(shape.radius || 0), 0, (shape.radius || 0), 0]} 
                      stroke={shape.stroke} 
                      strokeWidth={1} 
                      dash={[4, 4]} 
                    />
                  </Group>
                )}
                {shape.type === 'line' && (
                  <Line 
                    points={shape.points || [0,0,0,0]}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                  />
                )}
                {(shape.type === 'ruler' || shape.type === 'ruler-15') && (
                  <Group>
                    <Rect width={240} height={40} fill="#f1f5f9" stroke="#475569" strokeWidth={2} opacity={0.9} cornerRadius={4} />
                    {Array.from({ length: 16 }).map((_, i) => (
                      <Group key={i}>
                        <Line points={[i * 15, 0, i * 15, i % 5 === 0 ? 18 : 10]} stroke="#475569" strokeWidth={1.5} />
                        {i % 5 === 0 && (
                          <Text text={String(i)} x={i * 15 - 4} y={22} fontSize={9} fontStyle="bold" fill="#334155" />
                        )}
                      </Group>
                    ))}
                    <Text text="15 cm Ruler" x={90} y={6} fontSize={8} fontStyle="bold" fill="#94a3b8" />
                  </Group>
                )}
                {shape.type === 'ruler-30' && (
                  <Group>
                    <Rect width={400} height={40} fill="#f1f5f9" stroke="#475569" strokeWidth={2} opacity={0.9} cornerRadius={4} />
                    {Array.from({ length: 31 }).map((_, i) => (
                      <Group key={i}>
                        <Line points={[i * 12.5, 0, i * 12.5, i % 5 === 0 ? 18 : 10]} stroke="#475569" strokeWidth={1.5} />
                        {i % 5 === 0 && (
                          <Text text={String(i)} x={i * 12.5 - 4} y={22} fontSize={9} fontStyle="bold" fill="#334155" />
                        )}
                      </Group>
                    ))}
                    <Text text="30 cm Ruler" x={160} y={6} fontSize={8} fontStyle="bold" fill="#94a3b8" />
                  </Group>
                )}
                {shape.type === 'protractor' && (
                  <Group>
                    <Circle radius={120} angle={180} rotation={180} fill="#f1f5f9" stroke="#475569" strokeWidth={2.5} opacity={0.9} />
                    <Line points={[-120, 0, 120, 0]} stroke="#475569" strokeWidth={2.5} />
                    {Array.from({ length: 19 }).map((_, i) => {
                      const angle = i * 10;
                      const rad = angle * Math.PI / 180;
                      const x1 = -120 * Math.cos(rad);
                      const y1 = -120 * Math.sin(rad);
                      const x2 = -(120 - (i % 3 === 0 ? 16 : 8)) * Math.cos(rad);
                      const y2 = -(120 - (i % 3 === 0 ? 16 : 8)) * Math.sin(rad);
                      return (
                        <Group key={i}>
                          <Line points={[x1, y1, x2, y2]} stroke="#475569" strokeWidth={1.5} />
                          {i % 3 === 0 && (
                            <Text text={String(angle)} x={-95 * Math.cos(rad) - 7} y={-95 * Math.sin(rad) - 4} fontSize={8} fontStyle="bold" fill="#334155" />
                          )}
                        </Group>
                      );
                    })}
                    <Circle radius={6} x={0} y={0} fill="#475569" />
                    <Text text="Protractor" x={-25} y={-45} fontSize={10} fontStyle="bold" fill="#64748b" />
                  </Group>
                )}
                {shape.type === 'compass' && (
                  <Group>
                    {/* Metal leg with sharp point */}
                    <Line points={[0, 0, -25, 90]} stroke="#64748b" strokeWidth={4} lineCap="round" />
                    <Line points={[-25, 90, -28, 100]} stroke="#334155" strokeWidth={1.5} />
                    {/* Pencil leg */}
                    <Line points={[0, 0, 25, 80]} stroke="#cbd5e1" strokeWidth={4} lineCap="round" />
                    <Rect x={22} y={80} width={6} height={15} fill="#f59e0b" stroke="#334155" strokeWidth={1} />
                    <Line points={[25, 95, 25, 102]} stroke="#0f172a" strokeWidth={2} />
                    {/* Adjustment wheel arc */}
                    <Line points={[-15, 40, 15, 40]} stroke="#475569" strokeWidth={2} />
                    <Circle radius={4} x={0} y={40} fill="#94a3b8" />
                    {/* Hinge join */}
                    <Circle radius={8} x={0} y={0} fill="#334155" stroke="#cbd5e1" strokeWidth={2} />
                    <Text text="Compass" x={-22} y={110} fontSize={10} fontStyle="bold" fill="#94a3b8" />
                  </Group>
                )}
                {(shape.type === 'setsquare' || shape.type === 'setsquare-45') && (
                  <Group>
                    <Line points={[0, 0, 0, 150, 150, 150]} closed={true} fill="#f1f5f9" stroke="#475569" strokeWidth={2.5} opacity={0.9} />
                    <Line points={[15, 35, 15, 135, 115, 135]} closed={true} stroke="#94a3b8" strokeWidth={1.5} opacity={0.6} />
                    <Text text="45° Set Square" x={20} y={100} fontSize={9} fontStyle="bold" fill="#475569" />
                  </Group>
                )}
                {shape.type === 'setsquare-30-60' && (
                  <Group>
                    <Line points={[0, 0, 0, 160, 92, 160]} closed={true} fill="#f1f5f9" stroke="#475569" strokeWidth={2.5} opacity={0.9} />
                    <Line points={[15, 30, 15, 145, 70, 145]} closed={true} stroke="#94a3b8" strokeWidth={1.5} opacity={0.6} />
                    <Text text="30°/60° Set Square" x={18} y={110} fontSize={8} fontStyle="bold" fill="#475569" />
                  </Group>
                )}
                {shape.type === 'arrow' && (
                  <Arrow 
                    points={shape.points || [0,0,0,0]} 
                    stroke={shape.stroke} 
                    fill={shape.stroke} 
                    strokeWidth={shape.strokeWidth}
                    pointerLength={shape.strokeWidth * 3}
                    pointerWidth={shape.strokeWidth * 3}
                  />
                )}
                {shape.type === 'text' && (
                  <Text
                    text={shape.text || ''}
                    fontSize={shape.fontSize || 24}
                    fill={shape.fill || '#fff'}
                    fontFamily="mono"
                  />
                )}
                {shape.type === 'divider' && (
                  <Group>
                    <Line points={[0, 0, -30, 110]} stroke="#94a3b8" strokeWidth={5} lineCap="round" />
                    <Line points={[-30, 110, -32, 122]} stroke="#334155" strokeWidth={2} />
                    <Line points={[0, 0, 30, 110]} stroke="#94a3b8" strokeWidth={5} lineCap="round" />
                    <Line points={[30, 110, 32, 122]} stroke="#334155" strokeWidth={2} />
                    <Circle radius={10} x={0} y={0} fill="#334155" stroke="#cbd5e1" strokeWidth={2.5} />
                    <Line points={[-20, 50, 20, 50]} stroke="#64748b" strokeWidth={2} />
                    <Text text="Divider" x={-18} y={130} fontSize={10} fontStyle="bold" fill="#94a3b8" />
                  </Group>
                )}
                {shape.type === 'angle-meter' && (
                  <Group>
                    <Arrow points={[0, 0, 120, 0]} stroke="#818cf8" strokeWidth={3} pointerLength={8} pointerWidth={8} />
                    <Arrow points={[0, 0, 85, -85]} stroke="#818cf8" strokeWidth={3} pointerLength={8} pointerWidth={8} />
                    <Circle radius={35} angle={45} rotation={-45} stroke="#f59e0b" strokeWidth={2} dash={[3, 3]} />
                    <Text text="45° Angle" x={42} y={-25} fontSize={14} fontStyle="bold" fill="#f59e0b" />
                    <Circle radius={5} x={0} y={0} fill="#818cf8" />
                  </Group>
                )}
                {shape.type === 'svg_node' && shape.imageObj && (
                  <KonvaImage
                    image={shape.imageObj}
                    width={shape.width || 450}
                    height={shape.height || 300}
                  />
                )}
                {shape.text && shape.type !== 'text' && (
                  <Text
                    text={shape.text}
                    x={shape.type === 'rect' || shape.type === 'square' ? (shape.width || 0) / 2 - 40 : -40}
                    y={shape.type === 'rect' || shape.type === 'square' ? (shape.height || 0) / 2 - 8 : -8}
                    width={80}
                    align="center"
                    fontSize={13}
                    fontStyle="bold"
                    fill={shape.stroke || '#ffffff'}
                  />
                )}
              </Group>
            ))}
            
            {/* Fine Inks Rendering */}
            {currentSlide.lines.map((line) => (
              <Line
                key={line.id}
                id={line.id}
                name="object"
                points={line.points}
                stroke={line.color}
                strokeWidth={line.brushSize}
                tension={0.4}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : 'source-over'}
                draggable={tool === 'select' && !(line as any).isLocked}
                onDragEnd={(e) => {
                  line.points = line.points.map((p, idx) => {
                    const deltaX = e.target.x();
                    const deltaY = e.target.y();
                    return idx % 2 === 0 ? p + deltaX : p + deltaY;
                  });
                  e.target.position({ x: 0, y: 0 });
                }}
                onTransformEnd={(e) => {
                  const node = e.target;
                  (line as any).scaleX = node.scaleX();
                  (line as any).scaleY = node.scaleY();
                  (line as any).rotation = node.rotation();
                }}
                scaleX={(line as any).scaleX || 1}
                scaleY={(line as any).scaleY || 1}
                rotation={(line as any).rotation || 0}
                onMouseEnter={(e) => { 
                  if (tool === 'object_eraser') {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'cell';
                  }
                }}
                onClick={(e) => handleObjectClick(e, line.id, 'line')}
                onTap={(e) => handleObjectClick(e, line.id, 'line')}
              />
            ))}
            {/* Transparent Circular Eraser hover brush outline with outer border */}
            {eraserHoverPos && (tool === 'eraser' || tool === 'object_eraser') && (
              <Circle 
                x={eraserHoverPos.x}
                y={eraserHoverPos.y}
                radius={30}
                fill="rgba(148, 163, 184, 0.25)"
                stroke="#64748b"
                strokeWidth={1.5}
                listening={false}
              />
            )}
            
            {/* Transformer for Selection */}
            {selectedObj && tool === 'select' && (
              <Transformer 
                ref={trRef} 
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 5 || newBox.height < 5) {
                    return oldBox;
                  }
                  return newBox;
                }}
                padding={8}
                borderStroke="#4f46e5"
                anchorStroke="#4f46e5"
                anchorFill="#fff"
                anchorSize={8}
                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              />
            )}
          </Layer>
        </Stage>

        {/* AI Shape Predictive Toast Notification */}
        {aiTip && (
          <div className="absolute top-4 right-4 bg-slate-900/95 border border-indigo-500/30 text-indigo-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-medium animate-bounce z-50 backdrop-blur-md">
            <span className="text-indigo-400">✨</span>
            <span>{aiTip}</span>
          </div>
        )}
      </div>
    </div>
  );
};
