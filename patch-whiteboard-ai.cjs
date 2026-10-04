const fs = require('fs');
let content = fs.readFileSync('src/components/Whiteboard2.tsx', 'utf8');

// Add state variables
const stateRegex = /const \[stageScale, setStageScale\] = useState\(1\);/;
const stateReplacement = `const [stageScale, setStageScale] = useState(1);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiPromptQuery, setAiPromptQuery] = useState('');
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);

  const handleGenerateDiagram = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiPromptQuery.trim()) return;
    setIsGeneratingDiagram(true);
    setAiPromptOpen(false);
    try {
      const response = await fetch('/api/ai/diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiPromptQuery })
      });
      if (!response.ok) throw new Error('Diagram API failed');
      const data = await response.json();
      
      const newShapes = [];
      if (data.elements) {
        data.elements.forEach((el: any, index: number) => {
          if (el.type === 'rect') {
            newShapes.push({ id: \`rect-\${Date.now()}-\${index}\`, type: 'rect', x: el.x || 100, y: el.y || 100, width: el.width || 100, height: el.height || 100, fill: el.fill || 'transparent', stroke: el.fill || '#fff', strokeWidth: 2, text: el.text });
          } else if (el.type === 'circle') {
            newShapes.push({ id: \`circle-\${Date.now()}-\${index}\`, type: 'circle', x: el.x || 100, y: el.y || 100, radius: el.radius || 50, fill: el.fill || 'transparent', stroke: el.fill || '#fff', strokeWidth: 2, text: el.text });
          } else if (el.type === 'text') {
            newShapes.push({ id: \`text-\${Date.now()}-\${index}\`, type: 'text', x: el.x || 100, y: el.y || 100, text: el.text, fill: el.fill || '#ffffff', stroke: el.fill || '#ffffff', strokeWidth: 1, fontSize: el.fontSize || 16 });
          } else if (el.type === 'arrow') {
            newShapes.push({ id: \`arrow-\${Date.now()}-\${index}\`, type: 'arrow', x: 0, y: 0, points: el.points || [100,100,200,200], stroke: el.stroke || '#fff', strokeWidth: 2 });
          }
        });
      }
      
      setSlides(prev => {
        const updated = [...prev];
        updated[activeSlideIdx].shapes = [...(updated[activeSlideIdx].shapes || []), ...newShapes];
        return updated;
      });
      setAiTip(\`🪄 AI Assistant generated a diagram for "\${aiPromptQuery}"\`);
    } catch (e) {
      console.error(e);
      setAiTip("❌ Diagram generation failed.");
    } finally {
      setIsGeneratingDiagram(false);
      setAiPromptQuery('');
    }
  };
`;

content = content.replace(stateRegex, stateReplacement);

// Add button to Toolbar
const buttonRegex = /<button \s*onClick=\{handleClearCanvas\}/;
const buttonReplacement = `
          <div className="relative">
            <button 
              onClick={() => setAiPromptOpen(!aiPromptOpen)}
              className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl transition-all"
              title="Generate Diagram with AI"
              disabled={isGeneratingDiagram}
            >
              {isGeneratingDiagram ? '⏳' : '✨ AI Draw'}
            </button>
            {aiPromptOpen && (
              <div className="absolute top-full mt-2 right-0 w-72 bg-slate-900 border border-indigo-500/30 rounded-xl p-3 shadow-2xl z-50">
                <form onSubmit={handleGenerateDiagram} className="space-y-2">
                  <p className="text-xs text-slate-300 font-bold">What would you like to draw?</p>
                  <input 
                    autoFocus
                    type="text" 
                    value={aiPromptQuery}
                    onChange={e => setAiPromptQuery(e.target.value)}
                    placeholder="e.g. Solar System, Food Chain..." 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setAiPromptOpen(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-all">Cancel</button>
                    <button type="submit" className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-all">Generate</button>
                  </div>
                </form>
              </div>
            )}
          </div>
          <button 
            onClick={handleClearCanvas}`;

content = content.replace(buttonRegex, buttonReplacement);

fs.writeFileSync('src/components/Whiteboard2.tsx', content);
console.log('Patched Whiteboard2 AI generation');
