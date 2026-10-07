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
  Camera,
  Activity,
  Compass
} from 'lucide-react';

export interface Educational3DPart {
  id: string;
  shape:
    | 'box'
    | 'sphere'
    | 'cylinder'
    | 'cone'
    | 'pyramid'
    | 'triangular_prism'
    | 'hexagonal_prism'
    | 'capsule'
    | 'torus'
    | 'ring'
    | 'plane'
    | 'dodecahedron'
    | 'icosahedron'
    | 'tube'
    | 'helix';
  label: string;
  description?: string;
  position: [number, number, number];
  dimensions: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  opacity?: number;
  wireframe?: boolean;
  glass?: boolean;
  emissive?: string;
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
  sceneType?: string;
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);
  const [labelPositions, setLabelPositions] = useState<{ id: string; label: string; x: number; y: number; visible: boolean }[]>([]);

  // Orbit / Interaction refs
  const isPointerDown = useRef(false);
  const pointerStart = useRef({ x: 0, y: 0 });
  const rotationEuler = useRef({ x: 0.35, y: -0.55 });
  const cameraDistance = useRef(320);
  const panOffset = useRef({ x: 0, y: 0 });
  const isRightClick = useRef(false);
  const partMeshEntries = useRef<{ part: Educational3DPart; mesh: THREE.Mesh; basePos: THREE.Vector3 }[]>([]);

  // Build the Three.js 3D Scene
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const initialWidth = container.clientWidth || 600;
    const initialHeight = container.clientHeight || 440;

    // 1. Create Scene & Camera
    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color('#090d16');
    threeScene.fog = new THREE.FogExp2('#090d16', 0.0016);
    sceneRef.current = threeScene;

    const camera = new THREE.PerspectiveCamera(45, initialWidth / initialHeight, 1, 3000);
    camera.position.set(0, 35, cameraDistance.current);
    cameraRef.current = camera;

    // 2. WebGL Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      });
    } catch {
      renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    }

    renderer.setSize(initialWidth, initialHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 3. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    threeScene.add(ambientLight);

    const mainDirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    mainDirLight.position.set(220, 380, 260);
    mainDirLight.castShadow = true;
    threeScene.add(mainDirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    fillLight.position.set(-220, 120, -180);
    threeScene.add(fillLight);

    const rimLight = new THREE.PointLight(0xa855f7, 1.6, 900);
    rimLight.position.set(0, 180, 0);
    threeScene.add(rimLight);

    // 4. Floor Grid
    const grid = new THREE.GridHelper(450, 22, 0x334155, 0x1e293b);
    grid.position.y = -95;
    gridHelperRef.current = grid;
    threeScene.add(grid);

    // 5. Mesh Group
    const meshGroup = new THREE.Group();
    meshGroupRef.current = meshGroup;
    threeScene.add(meshGroup);

    // Build Geometry and Part Meshes
    const rawParts = Array.isArray(scene?.parts) ? scene.parts : [];
    const partMap = new Map<string, { part: Educational3DPart; mesh: THREE.Mesh; basePos: THREE.Vector3 }>();
    const entries: { part: Educational3DPart; mesh: THREE.Mesh; basePos: THREE.Vector3 }[] = [];

    rawParts.forEach((part, idx) => {
      if (!part) return;
      const posX = Array.isArray(part.position) && typeof part.position[0] === 'number' ? part.position[0] : (idx - 1) * 55;
      const posY = Array.isArray(part.position) && typeof part.position[1] === 'number' ? part.position[1] : 0;
      const posZ = Array.isArray(part.position) && typeof part.position[2] === 'number' ? part.position[2] : 0;

      const dimW = Array.isArray(part.dimensions) && typeof part.dimensions[0] === 'number' ? Math.max(8, part.dimensions[0]) : 45;
      const dimH = Array.isArray(part.dimensions) && typeof part.dimensions[1] === 'number' ? Math.max(8, part.dimensions[1]) : 45;
      const dimD = Array.isArray(part.dimensions) && typeof part.dimensions[2] === 'number' ? Math.max(8, part.dimensions[2]) : 45;

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
        case 'hexagonal_prism':
          geometry = new THREE.CylinderGeometry(dimW * 0.55, dimW * 0.55, dimH, 6);
          break;
        case 'capsule':
          geometry = new THREE.CapsuleGeometry(dimW * 0.4, Math.max(10, dimH - dimW * 0.8), 16, 32);
          break;
        case 'dodecahedron':
          geometry = new THREE.DodecahedronGeometry(dimW * 0.55);
          break;
        case 'icosahedron':
          geometry = new THREE.IcosahedronGeometry(dimW * 0.55);
          break;
        case 'torus':
        case 'ring':
          geometry = new THREE.TorusGeometry(dimW * 0.5, Math.max(2.5, dimH * 0.1), 16, 64);
          break;
        case 'plane':
          geometry = new THREE.PlaneGeometry(dimW, dimD);
          geometry.rotateX(-Math.PI / 2);
          break;
        case 'helix':
        case 'tube': {
          const curvePts: THREE.Vector3[] = [];
          const turns = 2.5;
          const heightStep = dimH / (turns * 16);
          const rad = dimW * 0.45;
          for (let i = 0; i <= turns * 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            curvePts.push(new THREE.Vector3(Math.cos(angle) * rad, (i - turns * 8) * heightStep, Math.sin(angle) * rad));
          }
          const curve = new THREE.CatmullRomCurve3(curvePts);
          geometry = new THREE.TubeGeometry(curve, 64, Math.max(2.5, dimW * 0.08), 12, false);
          break;
        }
        case 'box':
        default:
          geometry = new THREE.BoxGeometry(dimW, dimH, dimD);
          break;
      }

      const isGlass = Boolean(part.glass);
      const isWire = wireframeMode || Boolean(part.wireframe);

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hexColor),
        roughness: isGlass ? 0.12 : 0.32,
        metalness: isGlass ? 0.08 : 0.2,
        transparent: isGlass || opacity < 1,
        opacity: isGlass ? Math.min(0.45, opacity) : opacity,
        wireframe: isWire,
        emissive: part.emissive ? new THREE.Color(part.emissive) : undefined,
        emissiveIntensity: part.emissive ? 0.35 : 0
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

      // Clean schematic outlines for architectural & biological boundaries
      if (
        part.shape === 'box' ||
        part.shape === 'pyramid' ||
        part.shape === 'triangular_prism' ||
        part.shape === 'hexagonal_prism' ||
        part.shape === 'dodecahedron'
      ) {
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
        );
        mesh.add(line);
      }

      mesh.userData = { partId: part.id || `part_${idx}`, part };
      meshGroup.add(mesh);
      const entry = {
        part,
        mesh,
        basePos: new THREE.Vector3(posX, posY, posZ)
      };
      partMap.set(part.id || `part_${idx}`, entry);
      entries.push(entry);
    });

    partMeshEntries.current = entries;

    // 6. Connections
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
        emissiveIntensity: 0.3
      });

      const cyl = new THREE.Mesh(cylGeo, connMat);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      cyl.position.copy(mid);

      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      const axis = new THREE.Vector3(0, 1, 0);
      cyl.quaternion.setFromUnitVectors(axis, dir);

      meshGroup.add(cyl);
    });

    // 7. Render Loop & Dynamic Label Projection
    let lastTime = performance.now();

    const animate = (time: number) => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (isAutoSpin && !isPointerDown.current) {
        rotationEuler.current.y += delta * 0.45;
      }

      // Apply rotation Euler & Pan
      meshGroup.rotation.x = rotationEuler.current.x;
      meshGroup.rotation.y = rotationEuler.current.y;
      camera.position.x = panOffset.current.x;
      camera.position.y = 35 + panOffset.current.y;
      camera.position.z = cameraDistance.current;

      renderer.render(threeScene, camera);

      // Project part labels into 2D screen coordinates
      if (showLabels && container && camera) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const projected: { id: string; label: string; x: number; y: number; visible: boolean }[] = [];

        partMeshEntries.current.forEach((entry) => {
          const worldPos = new THREE.Vector3();
          entry.mesh.getWorldPosition(worldPos);
          worldPos.y += 18; // offset label slightly above part

          const screenVec = worldPos.clone().project(camera);
          const isVisible = screenVec.z < 1;
          const x = (screenVec.x * 0.5 + 0.5) * w;
          const y = (-(screenVec.y * 0.5) + 0.5) * h;

          projected.push({
            id: entry.part.id,
            label: entry.part.label,
            x: Math.round(x),
            y: Math.round(y),
            visible: isVisible && x > 20 && x < w - 20 && y > 20 && y < h - 20
          });
        });

        setLabelPositions(projected);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    // Resize Observer
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      if (renderer) {
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }
    };
  }, [scene, wireframeMode]);

  // Update Explode Factor
  useEffect(() => {
    partMeshEntries.current.forEach((entry) => {
      const orig = entry.basePos;
      const dir = orig.clone().normalize();
      if (dir.length() < 0.01) dir.set(0, 1, 0);

      const offsetDist = explodeFactor * 45;
      entry.mesh.position.set(
        orig.x + dir.x * offsetDist,
        orig.y + dir.y * offsetDist,
        orig.z + dir.z * offsetDist
      );
    });
  }, [explodeFactor]);

  // Update Grid Visibility
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Pointer Interaction Handlers
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
      rotationEuler.current.y += dx * 0.008;
      rotationEuler.current.x = Math.max(-1.4, Math.min(1.4, rotationEuler.current.x + dy * 0.008));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isPointerDown.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    const zoomDelta = e.deltaY * 0.28;
    cameraDistance.current = Math.max(120, Math.min(650, cameraDistance.current + zoomDelta));
  };

  const handleResetCamera = () => {
    rotationEuler.current = { x: 0.35, y: -0.55 };
    cameraDistance.current = 320;
    panOffset.current = { x: 0, y: 0 };
    setExplodeFactor(0);
    setSelectedPartId(null);
  };

  const handleTakeSnapshot = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    onSnapshot?.(dataUrl);
  };

  const selectedPart = scene.parts.find((p) => p.id === selectedPartId);

  return (
    <div
      className={`relative flex flex-col bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden font-sans select-none ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      } ${className}`}
      style={{ width, height: isFullscreen ? '100vh' : height }}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 z-10 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
            <Rotate3d className="w-4 h-4 animate-spin-slow" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100 truncate flex items-center gap-2">
              {scene.title || 'Interactive 3D Model'}
              {scene.subject && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 font-medium border border-slate-700">
                  {scene.subject}
                </span>
              )}
            </h3>
            {scene.subtitle && (
              <p className="text-[11px] text-slate-400 truncate">{scene.subtitle}</p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsAutoSpin(!isAutoSpin)}
            title={isAutoSpin ? 'Pause auto-rotation' : 'Start auto-rotation'}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              isAutoSpin
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isAutoSpin ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setShowLabels(!showLabels)}
            title="Toggle part labels"
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              showLabels
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setWireframeMode(!wireframeMode)}
            title="Toggle wireframe rendering"
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              wireframeMode
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle reference floor grid"
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
              showGrid
                ? 'bg-slate-700 text-slate-200'
                : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetCamera}
            title="Reset 3D camera position"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleTakeSnapshot}
            title="Export snapshot image"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              title="Close 3D Viewer"
              className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main 3D Canvas Area */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing touch-none overflow-hidden"
      >
        {/* Spatial 3D Pin Labels Overlay */}
        {showLabels && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {labelPositions.map((pos) => {
              if (!pos.visible) return null;
              const isSelected = pos.id === selectedPartId;
              return (
                <div
                  key={pos.id}
                  style={{
                    transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -100%)`,
                    transition: 'transform 0.05s ease-out'
                  }}
                  className="absolute pointer-events-auto cursor-pointer"
                  onClick={() => setSelectedPartId(isSelected ? null : pos.id)}
                >
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide backdrop-blur-md shadow-lg transition-all border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-400 scale-110 ring-2 ring-indigo-400/50'
                        : 'bg-slate-900/85 text-slate-200 border-slate-700/80 hover:bg-slate-800 hover:border-indigo-500 hover:scale-105'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{pos.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Exploded View & Zoom Floating Toolbar */}
      <div className="absolute bottom-4 left-4 flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl z-20">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px] font-medium text-slate-300">Explode:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={explodeFactor}
            onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
            className="w-20 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
        </div>

        <div className="h-4 w-px bg-slate-800" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              cameraDistance.current = Math.max(120, cameraDistance.current - 40);
            }}
            title="Zoom in"
            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              cameraDistance.current = Math.min(650, cameraDistance.current + 40);
            }}
            title="Zoom out"
            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Part Inspector / Educational Notes Bottom Drawer */}
      <div className="px-4 py-3 bg-slate-900/95 border-t border-slate-800 z-10 shrink-0">
        {selectedPart ? (
          <div className="flex items-start justify-between gap-4 animate-fadeIn">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedPart.color }} />
                <h4 className="text-xs font-bold text-slate-100 truncate">{selectedPart.label}</h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                  {selectedPart.shape}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedPart.description || 'Interactive anatomical / physical 3D sub-component.'}
              </p>
            </div>
            <button
              onClick={() => setSelectedPartId(null)}
              className="text-xs text-slate-400 hover:text-slate-200 underline shrink-0"
            >
              Deselect
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2 truncate">
              <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">
                {scene.summary || 'Click on any part or label to inspect structural details. Drag to orbit, wheel to zoom.'}
              </span>
            </div>
            {scene.formulas && scene.formulas.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 font-mono shrink-0">
                {scene.formulas[0]}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
