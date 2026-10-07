/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Interactive Three.js 3D WebGL Educational Scene Viewer
 * Renders structured educational 3D models with WebGL lighting, Orbit controls,
 * dynamic spatial label projections, exploded view, and part inspection.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Rotate3d,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Sparkles,
  Info,
  Check,
  X,
  Play,
  Pause,
  Grid,
  Box,
  Eye,
  Camera
} from 'lucide-react';

export interface Educational3DPart {
  id: string;
  shape: 'box' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'triangular_prism' | 'torus' | 'ring' | 'plane';
  label: string;
  description?: string;
  position: [number, number, number];
  dimensions: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  opacity?: number;
  wireframe?: boolean;
}

export interface Educational3DConnection {
  fromId: string;
  toId: string;
  label?: string;
  color?: string;
}

export interface Educational3DScene {
  id: string;
  title: string;
  subtitle?: string;
  subject?: string;
  sceneType?: 'geometry' | 'science_model' | 'infographic_3d';
  summary?: string;
  formulas?: string[];
  parts: Educational3DPart[];
  connections?: Educational3DConnection[];
  educationalNotes?: string[];
}

interface InteractiveThreeDViewerProps {
  scene: Educational3DScene;
  width?: number | string;
  height?: number | string;
  interactive?: boolean;
  autoSpinDefault?: boolean;
  onSnapshot?: (dataUrl: string) => void;
  onClose?: () => void;
  className?: string;
}

export const InteractiveThreeDViewer: React.FC<InteractiveThreeDViewerProps> = ({
  scene,
  width = '100%',
  height = 440,
  interactive = true,
  autoSpinDefault = false,
  onSnapshot,
  onClose,
  className = ''
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Interaction State
  const [isAutoSpin, setIsAutoSpin] = useState(autoSpinDefault);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [explodeFactor, setExplodeFactor] = useState(0);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [labelPositions, setLabelPositions] = useState<{ id: string; label: string; x: number; y: number; visible: boolean }[]>([]);

  // Orbit / Interaction refs
  const isPointerDown = useRef(false);
  const pointerStart = useRef({ x: 0, y: 0 });
  const rotationEuler = useRef({ x: 0.35, y: -0.55 });
  const cameraDistance = useRef(320);
  const panOffset = useRef({ x: 0, y: 0 });
  const isRightClick = useRef(false);

  // Build the Three.js 3D Scene
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const initialWidth = container.clientWidth || 600;
    const initialHeight = container.clientHeight || 440;

    // 1. Create Scene & Camera
    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color('#090d16');
    threeScene.fog = new THREE.FogExp2('#090d16', 0.0018);
    sceneRef.current = threeScene;

    const camera = new THREE.PerspectiveCamera(45, initialWidth / initialHeight, 1, 3000);
    camera.position.set(0, 40, cameraDistance.current);
    cameraRef.current = camera;

    // 2. WebGL Renderer with High Quality & Anti-aliasing
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      });
    } catch (e) {
      console.warn('Fallback WebGL initialization', e);
      renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    }

    renderer.setSize(initialWidth, initialHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Clear previous canvases if any
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 3. Lighting Setup for rich classroom visuals
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    threeScene.add(ambientLight);

    const mainDirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    mainDirLight.position.set(200, 350, 250);
    mainDirLight.castShadow = true;
    threeScene.add(mainDirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    fillLight.position.set(-200, 100, -150);
    threeScene.add(fillLight);

    const pointLight = new THREE.PointLight(0xa855f7, 1.2, 800);
    pointLight.position.set(0, 150, 0);
    threeScene.add(pointLight);

    // 4. Reference Floor Grid
    const grid = new THREE.GridHelper(400, 20, 0x334155, 0x1e293b);
    grid.position.y = -90;
    gridHelperRef.current = grid;
    threeScene.add(grid);

    // 5. Mesh Group holding all educational parts and connections
    const meshGroup = new THREE.Group();
    meshGroupRef.current = meshGroup;
    threeScene.add(meshGroup);

    // Defensive validation of scene parts
    const rawParts = Array.isArray(scene?.parts) ? scene.parts : [];
    const partMap = new Map<string, { part: Educational3DPart; mesh: THREE.Object3D; basePos: THREE.Vector3 }>();

    rawParts.forEach((part, idx) => {
      if (!part) return;
      const posX = Array.isArray(part.position) && typeof part.position[0] === 'number' ? part.position[0] : (idx - 1) * 60;
      const posY = Array.isArray(part.position) && typeof part.position[1] === 'number' ? part.position[1] : 0;
      const posZ = Array.isArray(part.position) && typeof part.position[2] === 'number' ? part.position[2] : 0;

      const dimW = Array.isArray(part.dimensions) && typeof part.dimensions[0] === 'number' ? Math.max(10, part.dimensions[0]) : 50;
      const dimH = Array.isArray(part.dimensions) && typeof part.dimensions[1] === 'number' ? Math.max(10, part.dimensions[1]) : 50;
      const dimD = Array.isArray(part.dimensions) && typeof part.dimensions[2] === 'number' ? Math.max(10, part.dimensions[2]) : 50;

      const hexColor = /^#[0-9a-fA-F]{6}$/.test(part.color || '') ? part.color : '#38bdf8';
      const opacity = typeof part.opacity === 'number' ? Math.max(0.2, Math.min(1, part.opacity)) : 0.92;

      let geometry: THREE.BufferGeometry;

      switch (part.shape) {
        case 'sphere':
          geometry = new THREE.SphereGeometry(dimW * 0.5, 32, 32);
          break;
        case 'cylinder':
          geometry = new THREE.CylinderGeometry(dimW * 0.5, dimW * 0.5, dimH, 32);
          break;
        case 'cone':
          geometry = new THREE.ConeGeometry(dimW * 0.5, dimH, 32);
          break;
        case 'pyramid':
          geometry = new THREE.ConeGeometry(dimW * 0.65, dimH, 4);
          geometry.rotateY(Math.PI / 4);
          break;
        case 'triangular_prism':
          geometry = new THREE.CylinderGeometry(dimW * 0.55, dimW * 0.55, dimH, 3);
          break;
        case 'torus':
        case 'ring':
          geometry = new THREE.TorusGeometry(dimW * 0.5, Math.max(3, dimH * 0.12), 16, 64);
          break;
        case 'plane':
          geometry = new THREE.PlaneGeometry(dimW, dimD);
          geometry.rotateX(-Math.PI / 2);
          break;
        case 'box':
        default:
          geometry = new THREE.BoxGeometry(dimW, dimH, dimD);
          break;
      }

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hexColor),
        roughness: 0.28,
        metalness: 0.18,
        transparent: opacity < 1,
        opacity,
        wireframe: wireframeMode || Boolean(part.wireframe)
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(posX, posY, posZ);

      if (Array.isArray(part.rotation)) {
        mesh.rotation.x = ((part.rotation[0] || 0) * Math.PI) / 180;
        mesh.rotation.y = ((part.rotation[1] || 0) * Math.PI) / 180;
        mesh.rotation.z = ((part.rotation[2] || 0) * Math.PI) / 180;
      }

      // Subtle edge outlines for crisp architectural/schematic look
      if (part.shape === 'box' || part.shape === 'pyramid' || part.shape === 'triangular_prism') {
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
        mesh.add(line);
      }

      mesh.userData = { partId: part.id || `part_${idx}`, part };
      meshGroup.add(mesh);
      partMap.set(part.id || `part_${idx}`, {
        part,
        mesh,
        basePos: new THREE.Vector3(posX, posY, posZ)
      });
    });

    // 6. Connections (Bonds / Flow Arrows / Relations)
    const rawConns = Array.isArray(scene?.connections) ? scene.connections : [];
    rawConns.forEach((conn) => {
      if (!conn || !conn.fromId || !conn.toId) return;
      const fromObj = partMap.get(conn.fromId);
      const toObj = partMap.get(conn.toId);
      if (!fromObj || !toObj) return;

      const p1 = fromObj.basePos;
      const p2 = toObj.basePos;
      const dist = p1.distanceTo(p2);
      if (dist < 1) return;

      const cylGeo = new THREE.CylinderGeometry(2.5, 2.5, dist, 12);
      const connMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(conn.color || '#38bdf8'),
        roughness: 0.3,
        emissive: new THREE.Color(conn.color || '#38bdf8'),
        emissiveIntensity: 0.2
      });

      const cyl = new THREE.Mesh(cylGeo, connMat);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      cyl.position.copy(mid);

      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      const axis = new THREE.Vector3(0, 1, 0);
      cyl.quaternion.setFromUnitVectors(axis, dir);

      meshGroup.add(cyl);
    });

    // 7. Render Loop & Label Projection
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      if (isAutoSpin && !isPointerDown.current) {
        rotationEuler.current.y += 0.006;
      }

      // Smooth camera position from spherical coordinates
      const cx = panOffset.current.x + cameraDistance.current * Math.sin(rotationEuler.current.y) * Math.cos(rotationEuler.current.x);
      const cy = panOffset.current.y + cameraDistance.current * Math.sin(rotationEuler.current.x);
      const cz = cameraDistance.current * Math.cos(rotationEuler.current.y) * Math.cos(rotationEuler.current.x);

      camera.position.set(cx, cy, cz);
      camera.lookAt(panOffset.current.x, panOffset.current.y, 0);

      // Handle Exploded View if slider > 0
      partMap.forEach(({ mesh, basePos }) => {
        const factor = 1 + explodeFactor * 0.75;
        mesh.position.set(basePos.x * factor, basePos.y * factor, basePos.z * factor);
      });

      renderer.render(threeScene, camera);

      // Project 3D Part Positions to 2D Screen for Floating Labels
      if (showLabels && container) {
        const rect = container.getBoundingClientRect();
        const w = rect.width || initialWidth;
        const h = rect.height || initialHeight;

        const nextLabels: { id: string; label: string; x: number; y: number; visible: boolean }[] = [];
        partMap.forEach(({ part, mesh }) => {
          const worldPos = new THREE.Vector3();
          mesh.getWorldPosition(worldPos);
          worldPos.y += 24; // Float above the part

          worldPos.project(camera);

          // Check if within camera frustum and facing front
          const visible = worldPos.z < 1 && worldPos.x >= -1.1 && worldPos.x <= 1.1 && worldPos.y >= -1.1 && worldPos.y <= 1.1;
          const screenX = ((worldPos.x + 1) * w) / 2;
          const screenY = ((-worldPos.y + 1) * h) / 2;

          nextLabels.push({
            id: part.id,
            label: part.label,
            x: screenX,
            y: screenY,
            visible
          });
        });
        setLabelPositions(nextLabels);
      }
    };

    animate();

    // Resize Observer for dynamic resizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      threeScene.clear();
    };
  }, [scene, wireframeMode, explodeFactor, showLabels]);

  // Pointer Orbit, Zoom & Pan Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    isPointerDown.current = true;
    isRightClick.current = e.button === 2;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDown.current || !interactive) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    pointerStart.current = { x: e.clientX, y: e.clientY };

    if (isRightClick.current || e.shiftKey) {
      // Pan
      panOffset.current.x -= dx * 0.35;
      panOffset.current.y += dy * 0.35;
    } else {
      // Orbit
      rotationEuler.current.y -= dx * 0.008;
      rotationEuler.current.x = Math.max(-1.3, Math.min(1.3, rotationEuler.current.x + dy * 0.008));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isPointerDown.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    cameraDistance.current = Math.max(80, Math.min(900, cameraDistance.current + e.deltaY * 0.35));
  };

  const handleResetCamera = () => {
    rotationEuler.current = { x: 0.35, y: -0.55 };
    cameraDistance.current = 320;
    panOffset.current = { x: 0, y: 0 };
    setExplodeFactor(0);
  };

  const handleCaptureSnapshot = useCallback(() => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    if (onSnapshot) onSnapshot(dataUrl);
  }, [onSnapshot]);

  const activePart = scene?.parts?.find((p) => p.id === selectedPartId) || null;

  return (
    <div
      className={`relative flex flex-col bg-slate-950 border border-indigo-500/30 rounded-2xl overflow-hidden shadow-2xl ${className}`}
      style={{ width, height: typeof height === 'number' ? `${height}px` : height }}
    >
      {/* 1. Header Bar with Educational Context */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/90 backdrop-blur-md border-b border-white/10 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Box className="w-4 h-4" />
          </div>
          <div className="truncate">
            <h4 className="text-xs sm:text-sm font-black text-white truncate flex items-center gap-2">
              {scene.title || '3D Educational Scene'}
              {scene.subject && (
                <span className="px-1.5 py-0.2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[9px] font-mono rounded">
                  {scene.subject}
                </span>
              )}
            </h4>
            {scene.subtitle && <p className="text-[10px] text-slate-400 truncate">{scene.subtitle}</p>}
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsAutoSpin(!isAutoSpin)}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
              isAutoSpin ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle Auto-Spin Orbit"
          >
            {isAutoSpin ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
              showLabels ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle 3D Floating Part Labels"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setWireframeMode(!wireframeMode)}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
              wireframeMode ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle Wireframe Mesh"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetCamera}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all"
            title="Reset Camera & View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {onSnapshot && (
            <button
              onClick={handleCaptureSnapshot}
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow flex items-center gap-1 transition-all"
              title="Capture snapshot and embed to Whiteboard"
            >
              <Camera className="w-3 h-3" /> Snapshot
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-all"
              title="Close 3D Viewer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. WebGL 3D Canvas Mount */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing touch-none select-none overflow-hidden"
      >
        {/* Floating Dynamic 3D Spatial Labels */}
        {showLabels &&
          labelPositions.map(
            (lbl) =>
              lbl.visible && (
                <div
                  key={lbl.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPartId(lbl.id === selectedPartId ? null : lbl.id);
                  }}
                  style={{
                    left: `${lbl.x}px`,
                    top: `${lbl.y}px`,
                    transform: 'translate(-50%, -100%)'
                  }}
                  className={`absolute pointer-events-auto cursor-pointer px-2 py-0.5 rounded-full text-[10px] font-bold transition-all shadow-lg border ${
                    selectedPartId === lbl.id
                      ? 'bg-indigo-600 text-white border-white scale-110 shadow-indigo-500/50'
                      : 'bg-slate-900/90 text-slate-200 border-indigo-500/40 hover:bg-slate-800 hover:scale-105'
                  }`}
                >
                  {lbl.label}
                </div>
              )
          )}
      </div>

      {/* 3. Bottom Interactive Overlay Controls (Exploded View & Zoom) */}
      <div className="absolute bottom-2 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-20">
        {/* Exploded View Slider */}
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-lg">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Explode:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={explodeFactor}
            onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
            className="w-20 sm:w-28 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <span className="text-[9px] font-mono text-slate-400">{Math.round(explodeFactor * 100)}%</span>
        </div>

        {/* Orbit Hint */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 backdrop-blur-sm border border-white/10 rounded-xl text-[9px] text-slate-400 font-mono shadow">
          <Rotate3d className="w-3 h-3 text-sky-400" /> Left Drag: Orbit · Right Drag: Pan · Wheel: Zoom
        </div>
      </div>

      {/* 4. Selected Part Educational Card / Formula Drawer */}
      {activePart && (
        <div className="absolute top-12 left-3 right-3 max-w-sm bg-slate-900/95 backdrop-blur-md border border-indigo-500/40 rounded-xl p-3 shadow-2xl z-30 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activePart.color }} />
                <h5 className="text-xs font-bold text-white">{activePart.label}</h5>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                {activePart.description || `3D Spatial component representing ${activePart.label}.`}
              </p>
            </div>
            <button
              onClick={() => setSelectedPartId(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {scene.formulas && scene.formulas.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <span className="text-[9px] uppercase font-mono text-indigo-300 font-bold">Key Formulas:</span>
              <ul className="mt-1 space-y-0.5">
                {scene.formulas.slice(0, 2).map((f, i) => (
                  <li key={i} className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
