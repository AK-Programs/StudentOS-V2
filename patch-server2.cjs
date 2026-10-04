const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const replacement = `
You are an expert educational diagram generator. 
The user wants a diagram for: "\${query}". (e.g. Solar System, Food Chain, Mind Map, Flowchart).
Generate a JSON array of graphical elements that visually represent this topic on a 2D canvas. 

Allowed types: 
- "rect": { type: "rect", x, y, width, height, fill: color, text (optional) }
- "circle": { type: "circle", x, y, radius, fill: color, text (optional) }
- "text": { type: "text", x, y, text, fill: color, fontSize }
- "arrow": { type: "arrow", points: [startX, startY, endX, endY], stroke: color }

Guidelines:
- Place elements logically on a 800x600 canvas (start x: 100, y: 100).
- Space them out well.
- Colors should be hex codes (e.g. #ff0000).

Return ONLY raw JSON array. Do not include markdown json wrappers.
`;

content = content.replace(/You are an expert educational diagram generator\.[\s\S]*?Return ONLY raw JSON array\. Do not include markdown json wrappers\./m, replacement.trim());
fs.writeFileSync('server.ts', content);
