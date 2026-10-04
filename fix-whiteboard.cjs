const fs = require('fs');
let code = fs.readFileSync('src/components/Whiteboard2.tsx', 'utf8');

// 1. Add new tools to state
code = code.replace(
  /const \[tool, setTool\] = useState\<'select' \| 'pen' \| 'eraser' \| 'rect' \| 'circle' \| 'sticky'\>\('pen'\);/,
  "const [tool, setTool] = useState<'select' | 'pen' | 'highlighter' | 'eraser' | 'rect' | 'circle' | 'triangle' | 'line' | 'sticky'>('pen');"
);

// 2. Add properties to interface Shape
code = code.replace(
  /type: 'rect' \| 'circle';/,
  "type: 'rect' | 'circle' | 'triangle' | 'line'; id: string;"
);

// Add id to LineData
code = code.replace(
  /interface LineData \{ tool: string;/,
  "interface LineData { id: string; tool: string;"
);

// 3. Update initial shapes in addSlide
code = code.replace(
  /shapes: \[\], lines: \[\], stickies: \[\]/g,
  "shapes: [], lines: [], stickies: []"
);

// 4. In handleMouseDown, generate IDs and add support for new tools
const handleMouseDownTarget = `    if (tool === 'pen' || tool === 'eraser') {
      updateCurrentSlide({ lines: [...currentSlide.lines, { tool, points: [pos.x, pos.y], color: tool === 'eraser' ? backgroundColor : color, brushSize }] });
    } else if (tool === 'rect') {
      updateCurrentSlide({ shapes: [...currentSlide.shapes, { type: 'rect', x: pos.x, y: pos.y, width: 0, height: 0, stroke: color }] });
    } else if (tool === 'circle') {
      updateCurrentSlide({ shapes: [...currentSlide.shapes, { type: 'circle', x: pos.x, y: pos.y, radius: 0, stroke: color }] });
    } else if (tool === 'sticky') {`;

const handleMouseDownReplace = `    const id = Math.random().toString();
    if (tool === 'eraser') return; // Handled by object click now
    if (tool === 'pen' || tool === 'highlighter') {
      updateCurrentSlide({ lines: [...currentSlide.lines, { id, tool, points: [pos.x, pos.y], color: tool === 'highlighter' ? color + '80' : color, brushSize: tool === 'highlighter' ? brushSize * 4 : brushSize }] });
    } else if (tool === 'rect') {
      updateCurrentSlide({ shapes: [...currentSlide.shapes, { id, type: 'rect', x: pos.x, y: pos.y, width: 0, height: 0, stroke: color }] });
    } else if (tool === 'circle') {
      updateCurrentSlide({ shapes: [...currentSlide.shapes, { id, type: 'circle', x: pos.x, y: pos.y, radius: 0, stroke: color }] });
    } else if (tool === 'triangle') {
      updateCurrentSlide({ shapes: [...currentSlide.shapes, { id, type: 'triangle', x: pos.x, y: pos.y, radius: 0, stroke: color }] });
    } else if (tool === 'line') {
      updateCurrentSlide({ shapes: [...currentSlide.shapes, { id, type: 'line', x: pos.x, y: pos.y, width: pos.x, height: pos.y, stroke: color }] });
    } else if (tool === 'sticky') {`;

code = code.replace(handleMouseDownTarget, handleMouseDownReplace);

// 5. Update handleMouseMove
const handleMouseMoveTarget = `    if (tool === 'pen' || tool === 'eraser') {
      const lines = [...currentSlide.lines];
      let lastLine = lines[lines.length - 1];
      lastLine.points = lastLine.points.concat([point.x, point.y]);
      updateCurrentSlide({ lines });
    } else if (tool === 'rect') {
      const shapes = [...currentSlide.shapes];
      let lastShape = shapes[shapes.length - 1];
      lastShape.width = point.x - lastShape.x;
      lastShape.height = point.y - lastShape.y;
      updateCurrentSlide({ shapes });
    } else if (tool === 'circle') {
      const shapes = [...currentSlide.shapes];
      let lastShape = shapes[shapes.length - 1];
      const dx = point.x - lastShape.x;
      const dy = point.y - lastShape.y;
      lastShape.radius = Math.sqrt(dx * dx + dy * dy);
      updateCurrentSlide({ shapes });
    }`;

const handleMouseMoveReplace = `    if (tool === 'pen' || tool === 'highlighter') {
      const lines = [...currentSlide.lines];
      let lastLine = lines[lines.length - 1];
      lastLine.points = lastLine.points.concat([point.x, point.y]);
      updateCurrentSlide({ lines });
    } else if (tool === 'rect') {
      const shapes = [...currentSlide.shapes];
      let lastShape = shapes[shapes.length - 1];
      lastShape.width = point.x - lastShape.x;
      lastShape.height = point.y - lastShape.y;
      updateCurrentSlide({ shapes });
    } else if (tool === 'circle' || tool === 'triangle') {
      const shapes = [...currentSlide.shapes];
      let lastShape = shapes[shapes.length - 1];
      const dx = point.x - lastShape.x;
      const dy = point.y - lastShape.y;
      lastShape.radius = Math.sqrt(dx * dx + dy * dy);
      updateCurrentSlide({ shapes });
    } else if (tool === 'line') {
      const shapes = [...currentSlide.shapes];
      let lastShape = shapes[shapes.length - 1];
      lastShape.width = point.x;
      lastShape.height = point.y;
      updateCurrentSlide({ shapes });
    }`;

code = code.replace(handleMouseMoveTarget, handleMouseMoveReplace);

// 6. Add handleErase function inside component
const eraseFunction = `  const handleErase = (id: string, type: 'shapes'|'lines'|'stickies') => {
    if (tool === 'eraser') {
      updateCurrentSlide({ [type]: currentSlide[type].filter((item: any) => item.id !== id) });
    }
  };`;
code = code.replace(/  const handleMouseDown = \(e: any\) => \{/, eraseFunction + '\n  const handleMouseDown = (e: any) => {');

// 7. Render shapes with handleErase and new shapes
const shapesRenderTarget = `              {currentSlide.shapes.map((shape, i) => (
                shape.type === 'rect' ? 
                  <Rect key={i} x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={shape.fill} stroke={shape.stroke} strokeWidth={2} draggable={tool === 'select'} /> :
                  <Circle key={i} x={shape.x} y={shape.y} radius={shape.radius} fill={shape.fill} stroke={shape.stroke} strokeWidth={2} draggable={tool === 'select'} />
              ))}
              {currentSlide.lines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke={line.tool === 'eraser' ? backgroundColor : line.color}
                  strokeWidth={line.tool === 'eraser' ? brushSize * 4 : brushSize}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : 'source-over'}
                />
              ))}
              {currentSlide.stickies.map((sticky, i) => (
                <Group key={i} x={sticky.x} y={sticky.y} draggable={tool === 'select'}>`;

const shapesRenderReplace = `              {currentSlide.shapes.map((shape: any, i: number) => {
                const commonProps = {
                  key: i, stroke: shape.stroke, strokeWidth: 2, draggable: tool === 'select',
                  onMouseDown: () => handleErase(shape.id, 'shapes'),
                  onTouchStart: () => handleErase(shape.id, 'shapes')
                };
                if (shape.type === 'rect') return <Rect {...commonProps} x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={shape.fill} />;
                if (shape.type === 'circle') return <Circle {...commonProps} x={shape.x} y={shape.y} radius={shape.radius || 0} fill={shape.fill} />;
                if (shape.type === 'triangle') return <Circle {...commonProps} x={shape.x} y={shape.y} radius={shape.radius || 0} sides={3} fill={shape.fill} />;
                if (shape.type === 'line') return <Line {...commonProps} points={[shape.x, shape.y, shape.width || shape.x, shape.height || shape.y]} />;
                return null;
              })}
              {currentSlide.lines.map((line: any, i: number) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke={line.color}
                  strokeWidth={line.brushSize}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={line.tool === 'highlighter' ? 'multiply' : 'source-over'}
                  onMouseDown={() => handleErase(line.id, 'lines')}
                  onTouchStart={() => handleErase(line.id, 'lines')}
                />
              ))}
              {currentSlide.stickies.map((sticky: any, i: number) => (
                <Group key={i} x={sticky.x} y={sticky.y} draggable={tool === 'select'} onMouseDown={() => handleErase(sticky.id, 'stickies')} onTouchStart={() => handleErase(sticky.id, 'stickies')}>`;

code = code.replace(shapesRenderTarget, shapesRenderReplace);

// 8. Add toolbar UI for brush size, highlighter, and triangle
const toolbarTarget = `            {[
              { id: 'select', icon: MousePointer2, label: 'Select' },
              { id: 'pen', icon: Pencil, label: 'Pen' },
              { id: 'eraser', icon: Eraser, label: 'Eraser' },
              { id: 'rect', icon: Square, label: 'Rectangle' },
              { id: 'circle', icon: CircleIcon, label: 'Circle' },
              { id: 'sticky', icon: Type, label: 'Sticky Note' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id as any)}
                className={\`p-2 rounded-md transition-all \${tool === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}\`}
                title={t.label}
              >
                <t.icon className="w-4 h-4" />
              </button>
            ))}`;

const toolbarReplace = `            {[
              { id: 'select', icon: MousePointer2, label: 'Select' },
              { id: 'pen', icon: Pencil, label: 'Pen' },
              { id: 'highlighter', icon: Pencil, label: 'Highlighter' }, // Reusing Pencil for highlighter
              { id: 'eraser', icon: Eraser, label: 'Eraser (Click Object)' },
              { id: 'rect', icon: Square, label: 'Rectangle' },
              { id: 'circle', icon: CircleIcon, label: 'Circle' },
              { id: 'triangle', icon: CircleIcon, label: 'Triangle' }, // Reusing circle icon for geometry
              { id: 'line', icon: Eraser, label: 'Line' }, // Reusing icon
              { id: 'sticky', icon: Type, label: 'Sticky Note' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id as any)}
                className={\`p-2 rounded-md transition-all \${tool === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}\`}
                title={t.label}
              >
                <t.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          {/* Brush Size Picker */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-white/10 ml-2">
             {[1, 3, 5, 8].map(size => (
               <button 
                 key={size}
                 onClick={() => setBrushSize(size)}
                 className={\`w-6 h-6 rounded-full flex items-center justify-center \${brushSize === size ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}\`}
               >
                 <div className="bg-current rounded-full" style={{ width: size * 2, height: size * 2 }}></div>
               </button>
             ))}`;

code = code.replace(toolbarTarget, toolbarReplace);

fs.writeFileSync('src/components/Whiteboard2.tsx', code);
