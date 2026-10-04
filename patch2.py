import re
with open('src/components/Whiteboard2.tsx', 'r') as f:
    content = f.read()

replacement = """                {shape.type === 'line' && (
                  <Line 
                    points={shape.points || [0,0,0,0]}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                  />
                )}
                {shape.type === 'ruler' && (
                  <Group>
                    <Rect width={Math.max(shape.width || 0, 200)} height={30} fill="#f8fafc" stroke="#334155" strokeWidth={2} />
                    {Array.from({ length: 20 }).map((_, i) => (
                      <Line key={i} points={[i * 10, 0, i * 10, i % 5 === 0 ? 15 : 8]} stroke="#334155" strokeWidth={1} />
                    ))}
                    <Text text="15cm Ruler" x={70} y={10} fontSize={10} fill="#334155" />
                  </Group>
                )}
                {shape.type === 'protractor' && (
                  <Group>
                    <Circle radius={Math.max(shape.radius || 0, 100)} angle={180} rotation={180} fill="#f8fafc" stroke="#334155" strokeWidth={2} opacity={0.8} />
                    <Line points={[-Math.max(shape.radius || 0, 100), 0, Math.max(shape.radius || 0, 100), 0]} stroke="#334155" strokeWidth={2} />
                    <Circle radius={5} x={0} y={0} fill="#334155" />
                    <Text text="Protractor" x={-30} y={-40} fontSize={12} fill="#334155" />
                  </Group>
                )}
                {shape.type === 'compass' && (
                  <Group>
                    <Line points={[0, 0, -30, 80]} stroke="#334155" strokeWidth={4} />
                    <Line points={[0, 0, 30, 80]} stroke="#334155" strokeWidth={4} />
                    <Circle radius={6} x={0} y={0} fill="#94a3b8" />
                    <Text text="Compass" x={-25} y={90} fontSize={12} fill="#e2e8f0" />
                  </Group>
                )}
                {shape.type === 'setsquare' && (
                  <Group>
                    <RegularPolygon sides={3} radius={Math.max(shape.radius || 0, 100)} fill="#f8fafc" stroke="#334155" strokeWidth={2} opacity={0.8} />
                    <RegularPolygon sides={3} radius={Math.max(shape.radius || 0, 100) - 20} stroke="#334155" strokeWidth={1} opacity={0.5} />
                  </Group>
                )}"""

content = re.sub(r"\{\s*shape\.type === 'line' && \(\s*<Line\s+points=\{shape\.points \|\| \[0,0,0,0\]\}\s+stroke=\{shape\.stroke\}\s+strokeWidth=\{shape\.strokeWidth\}\s+/>\s*\)\s*\}", replacement, content)

with open('src/components/Whiteboard2.tsx', 'w') as f:
    f.write(content)
