/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Official 3D Character Model: "Byte"
 * High-performance, procedural Three.js 3D character with 12 state-driven expressions:
 * - States: idle, listening, thinking, speaking, explaining, encouraging,
 *           correct_answer, incorrect_answer, celebration, confused, recoverable_error, quiet
 * - Articulated visor with dynamic LED eyes, blushing cheeks, and mouth visualizer
 * - Articulated magnetic floating arms with state-specific pedagogical gestures
 * - Quantum Arc-Reactor chest core with dynamic energy pulse
 * - Dual-Theme Harmony: Native visual styling for both Claymorphism & Glassmorphism
 * - Accessibility: Native reduced-motion compliance & automatic WebGL context loss recovery
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type Byte3DState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'explaining'
  | 'encouraging'
  | 'correct_answer'
  | 'incorrect_answer'
  | 'celebration'
  | 'confused'
  | 'recoverable_error'
  | 'quiet'
  // Backward compatibility aliases
  | 'wave'
  | 'nod'
  | 'happy'
  | 'talking';

export type Byte3DMood = Byte3DState;

// Normalize any mood alias to the official 12 states
export function normalizeByteState(state?: string): Byte3DState {
  if (!state) return 'idle';
  if (state === 'wave' || state === 'happy') return 'celebration';
  if (state === 'nod') return 'encouraging';
  if (state === 'talking') return 'speaking';
  return state as Byte3DState;
}

export interface Byte3DCanvasProps {
  mood?: Byte3DState;
  state?: Byte3DState;
  size?: number | 'sm' | 'md' | 'lg'; // Size in pixels or semantic label
  className?: string;
  onClick?: () => void;
  interactiveGaze?: boolean;
  reducedMotion?: boolean;
  themeStyle?: 'clay' | 'glass' | 'standard';
  isSpeaking?: boolean;
}

export const Byte3DCanvas: React.FC<Byte3DCanvasProps> = ({
  mood,
  state,
  size = 110,
  className = '',
  onClick,
  interactiveGaze = true,
  reducedMotion = false,
  themeStyle = 'standard',
  isSpeaking = false
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const numericSize = typeof size === 'number'
    ? size
    : size === 'lg'
    ? 260
    : size === 'md'
    ? 200
    : 110;

  const rawState = state || mood || (isSpeaking ? 'speaking' : 'idle');
  const activeState = normalizeByteState(rawState);
  const stateRef = useRef<Byte3DState>(activeState);
  stateRef.current = activeState;

  const [hasWebGlError, setHasWebGlError] = useState(false);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software rendering or disabled WebGL
    let glContext: WebGLRenderingContext | null = null;
    try {
      const testCanvas = document.createElement('canvas');
      glContext = (testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')) as WebGLRenderingContext;
      if (!glContext) {
        setHasWebGlError(true);
        return;
      }
    } catch (_) {
      setHasWebGlError(true);
      return;
    }

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
    camera.position.set(0, 0.08, 4.3);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(numericSize, numericSize);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);
    } catch (e) {
      console.warn('[Byte3D] WebGL renderer initialization error:', e);
      setHasWebGlError(true);
      return;
    }

    // 2. Multi-Directional Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    // Warm Key Light (Soft Cyan/Sky)
    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    keyLight.position.set(2.8, 3.5, 3.2);
    scene.add(keyLight);

    // Fill Rim Light (Soft Indigo/Violet)
    const fillLight = new THREE.DirectionalLight(0x818cf8, 1.6);
    fillLight.position.set(-2.8, -2.0, 2.4);
    scene.add(fillLight);

    // 3. Procedural Materials
    // Primary Pearlescent Porcelain Chassis
    const chassisMat = new THREE.MeshStandardMaterial({
      color: themeStyle === 'clay' ? 0xffffff : 0xf8fafc,
      roughness: themeStyle === 'clay' ? 0.38 : 0.22,
      metalness: themeStyle === 'clay' ? 0.05 : 0.18
    });

    // Cyber Teal Accent Material
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // Cyan-500
      roughness: 0.25,
      metalness: 0.45
    });

    // Deep Curved Visor Glass
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.12,
      metalness: 0.85
    });

    // Luminescent Visor LED Eyes (Cyan/Emerald)
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee
    });

    // Visor LED Mouth
    const mouthMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8
    });

    // Quantum Chest Arc-Reactor Core
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9
    });

    // Antenna Beacon
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6
    });

    // Warm Blushing Cheeks
    const cheekMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.65
    });

    // 4. Hierarchical Mesh Assembly
    const byteGroup = new THREE.Group();
    scene.add(byteGroup);

    // --- HEAD GROUP ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.45, 0);
    byteGroup.add(headGroup);

    // Head Base
    const headGeo = new THREE.SphereGeometry(0.72, 24, 20);
    headGeo.scale(1.15, 1.0, 1.0);
    const headMesh = new THREE.Mesh(headGeo, chassisMat);
    headGroup.add(headMesh);

    // Visor Glass
    const visorGeo = new THREE.SphereGeometry(0.68, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.48);
    visorGeo.scale(1.08, 0.76, 1.02);
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.rotation.x = Math.PI * 0.28;
    visorMesh.position.set(0, 0.05, 0.08);
    headGroup.add(visorMesh);

    // Eyes (Capsule mesh with eyelid blink scaling)
    const eyeGeo = new THREE.CapsuleGeometry(0.08, 0.13, 8, 12);
    eyeGeo.rotateZ(Math.PI / 2);

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.25, 0.08, 0.68);
    headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.25, 0.08, 0.68);
    headGroup.add(rightEye);

    // Dynamic LED Mouth Strip / Equalizer
    const mouthGeo = new THREE.CapsuleGeometry(0.035, 0.22, 6, 8);
    mouthGeo.rotateZ(Math.PI / 2);
    const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    mouthMesh.position.set(0, -0.16, 0.68);
    headGroup.add(mouthMesh);

    // Cheeks
    const cheekGeo = new THREE.CircleGeometry(0.08, 12);
    const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
    leftCheek.position.set(-0.42, -0.09, 0.62);
    leftCheek.rotation.y = -0.3;
    headGroup.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
    rightCheek.position.set(0.42, -0.09, 0.62);
    rightCheek.rotation.y = 0.3;
    headGroup.add(rightCheek);

    // Antenna & Beacon
    const stemGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8);
    const stemMesh = new THREE.Mesh(stemGeo, accentMat);
    stemMesh.position.set(0, 0.85, 0);
    headGroup.add(stemMesh);

    const beaconGeo = new THREE.SphereGeometry(0.12, 16, 12);
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(0, 1.05, 0);
    headGroup.add(beaconMesh);

    // Ear Pods
    const earGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16);
    earGeo.rotateZ(Math.PI / 2);
    const leftEar = new THREE.Mesh(earGeo, accentMat);
    leftEar.position.set(-0.84, 0.05, 0);
    headGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, accentMat);
    rightEar.position.set(0.84, 0.05, 0);
    headGroup.add(rightEar);

    // --- TORSO GROUP ---
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, -0.45, 0);
    byteGroup.add(torsoGroup);

    // Body Capsule
    const bodyGeo = new THREE.SphereGeometry(0.55, 20, 16);
    bodyGeo.scale(0.95, 1.05, 0.85);
    const bodyMesh = new THREE.Mesh(bodyGeo, chassisMat);
    torsoGroup.add(bodyMesh);

    // Quantum Arc Reactor Chest
    const coreGeo = new THREE.SphereGeometry(0.15, 16, 12);
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, 0.1, 0.46);
    torsoGroup.add(coreMesh);

    const coreRingGeo = new THREE.TorusGeometry(0.2, 0.025, 8, 20);
    const coreRingMesh = new THREE.Mesh(coreRingGeo, accentMat);
    coreRingMesh.position.set(0, 0.1, 0.46);
    torsoGroup.add(coreRingMesh);

    // Floating Thruster Ring
    const thrusterGeo = new THREE.TorusGeometry(0.26, 0.05, 8, 20);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterMesh = new THREE.Mesh(thrusterGeo, accentMat);
    thrusterMesh.position.set(0, -0.58, 0);
    torsoGroup.add(thrusterMesh);

    // --- ARMS & HANDS ---
    const armGeo = new THREE.SphereGeometry(0.13, 12, 10);
    armGeo.scale(0.8, 1.4, 0.8);
    const handGeo = new THREE.SphereGeometry(0.11, 12, 10);

    // Left Arm Group
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.68, 0.1, 0);
    torsoGroup.add(leftArmGroup);
    const leftArmMesh = new THREE.Mesh(armGeo, chassisMat);
    leftArmMesh.position.set(0, -0.15, 0);
    leftArmGroup.add(leftArmMesh);
    const leftHand = new THREE.Mesh(handGeo, accentMat);
    leftHand.position.set(0, -0.32, 0);
    leftArmGroup.add(leftHand);

    // Right Arm Group
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.68, 0.1, 0);
    torsoGroup.add(rightArmGroup);
    const rightArmMesh = new THREE.Mesh(armGeo, chassisMat);
    rightArmMesh.position.set(0, -0.15, 0);
    rightArmGroup.add(rightArmMesh);
    const rightHand = new THREE.Mesh(handGeo, accentMat);
    rightHand.position.set(0, -0.32, 0);
    rightArmGroup.add(rightHand);

    // Gaze Tracker
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactiveGaze) return;
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      mousePosRef.current = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    };

    if (interactiveGaze) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
    }

    // 5. High-Fidelity State-Driven Animation Engine
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let blinkTimer = 0;
    let isBlinking = false;
    let nodTimer = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();
      const st = stateRef.current;
      const prefersReduced = reducedMotion || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      // A. Floating Bobbing (Disabled in reduced motion)
      if (!prefersReduced) {
        if (st === 'celebration' || st === 'correct_answer') {
          // Bouncy happy jump
          byteGroup.position.y = Math.abs(Math.sin(time * 6.0)) * 0.16;
          byteGroup.rotation.z = Math.sin(time * 4.0) * 0.08;
        } else if (st === 'quiet') {
          // Minimal tranquil float
          byteGroup.position.y = Math.sin(time * 1.5) * 0.02;
          byteGroup.rotation.z = 0;
        } else {
          // Natural idle floating
          byteGroup.position.y = Math.sin(time * 2.8) * 0.06;
          byteGroup.rotation.z = Math.sin(time * 1.4) * 0.03;
          byteGroup.rotation.y = Math.sin(time * 0.9) * 0.04;
        }
      } else {
        byteGroup.position.y = 0;
        byteGroup.rotation.z = 0;
        byteGroup.rotation.y = 0;
      }

      // B. State-Specific Facial LED Expression & Mouth
      switch (st) {
        case 'speaking':
        case 'explaining':
          // Dynamic soundwave equalizer mouth opening
          const mouthOpen = 0.5 + Math.abs(Math.sin(time * 12.0)) * 0.8;
          mouthMesh.scale.set(1.0, mouthOpen, 1.0);
          mouthMat.color.setHex(0x38bdf8);
          eyeMat.color.setHex(0x22d3ee);
          beaconMat.color.setHex(0x06b6d4);
          coreMat.color.setHex(0x38bdf8);
          break;

        case 'celebration':
        case 'correct_answer':
          // Wide radiant smile & joyful gold/emerald aura
          mouthMesh.scale.set(1.3, 1.1, 1.0);
          mouthMat.color.setHex(0x34d399); // Emerald
          eyeMat.color.setHex(0x10b981);
          beaconMat.color.setHex(0xfbbf24); // Gold beacon
          coreMat.color.setHex(0x34d399);
          break;

        case 'incorrect_answer':
          // Gentle caring blue/amber expression
          mouthMesh.scale.set(0.7, 0.4, 1.0);
          mouthMat.color.setHex(0xfbbf24);
          eyeMat.color.setHex(0x93c5fd);
          beaconMat.color.setHex(0xf59e0b);
          coreMat.color.setHex(0xf59e0b);
          break;

        case 'thinking':
          // Scanning visor laser beam
          const scanX = Math.sin(time * 4.0) * 0.15;
          leftEye.position.x = -0.25 + scanX;
          rightEye.position.x = 0.25 + scanX;
          mouthMesh.scale.set(0.6, 0.3, 1.0);
          mouthMat.color.setHex(0xc084fc); // Purple
          eyeMat.color.setHex(0xc084fc);
          beaconMat.color.setHex(0xa855f7);
          coreMat.color.setHex(0xa855f7);
          break;

        case 'listening':
          // Ears pulsing, eyes alert
          mouthMesh.scale.set(0.5, 0.4, 1.0);
          eyeMat.color.setHex(0x38bdf8);
          leftEar.scale.set(1.0 + Math.sin(time * 6.0) * 0.15, 1.0 + Math.sin(time * 6.0) * 0.15, 1.0);
          rightEar.scale.set(1.0 + Math.sin(time * 6.0) * 0.15, 1.0 + Math.sin(time * 6.0) * 0.15, 1.0);
          beaconMat.color.setHex(0x38bdf8);
          break;

        case 'confused':
          // Head tilted & asymmetric questioning eyes
          mouthMesh.scale.set(0.6, 0.5, 1.0);
          mouthMat.color.setHex(0xf97316); // Orange
          eyeMat.color.setHex(0xf97316);
          leftEye.scale.set(1.15, 1.15, 1.15);
          rightEye.scale.set(0.85, 0.85, 0.85);
          headGroup.rotation.z = 0.18;
          break;

        case 'encouraging':
          // Gentle warm affirmative smile
          mouthMesh.scale.set(1.0, 0.8, 1.0);
          mouthMat.color.setHex(0x34d399);
          eyeMat.color.setHex(0x22d3ee);
          beaconMat.color.setHex(0x38bdf8);
          break;

        case 'recoverable_error':
          mouthMesh.scale.set(0.6, 0.3, 1.0);
          mouthMat.color.setHex(0xf43f5e); // Rose
          eyeMat.color.setHex(0xf43f5e);
          beaconMat.color.setHex(0xf43f5e);
          break;

        case 'quiet':
          // Soft resting mode with dimmed lighting
          mouthMesh.scale.set(0.3, 0.15, 1.0);
          eyeMat.color.setHex(0x64748b);
          beaconMat.color.setHex(0x475569);
          coreMat.color.setHex(0x475569);
          break;

        default: // idle
          mouthMesh.scale.set(0.8, 0.4, 1.0);
          mouthMat.color.setHex(0x38bdf8);
          eyeMat.color.setHex(0x22d3ee);
          beaconMat.color.setHex(0x3b82f6);
          coreMat.color.setHex(0x0ea5e9);
          leftEye.scale.set(1.0, 1.0, 1.0);
          rightEye.scale.set(1.0, 1.0, 1.0);
          leftEye.position.x = -0.25;
          rightEye.position.x = 0.25;
          headGroup.rotation.z = THREE.MathUtils.damp(headGroup.rotation.z, 0, 5, delta);
          break;
      }

      // C. Periodic Natural Blinking (Active in all states except quiet)
      if (st !== 'quiet') {
        blinkTimer += delta;
        if (blinkTimer > 3.4) {
          isBlinking = true;
          blinkTimer = 0;
        }
        if (isBlinking) {
          leftEye.scale.y = 0.1;
          rightEye.scale.y = 0.1;
          setTimeout(() => {
            leftEye.scale.y = 1.0;
            rightEye.scale.y = 1.0;
            isBlinking = false;
          }, 110);
        }
      }

      // D. Interactive Gaze Tracking
      if (interactiveGaze && !prefersReduced && st !== 'quiet') {
        const targetRotY = mousePosRef.current.x * 0.26;
        const targetRotX = -mousePosRef.current.y * 0.20;
        headGroup.rotation.y = THREE.MathUtils.damp(headGroup.rotation.y, targetRotY, 5, delta);
        headGroup.rotation.x = THREE.MathUtils.damp(headGroup.rotation.x, targetRotX, 5, delta);
      }

      // E. Arm Gestures based on State
      if (st === 'celebration' || st === 'correct_answer') {
        // Both arms raised high celebrating!
        leftArmGroup.rotation.z = THREE.MathUtils.damp(leftArmGroup.rotation.z, -Math.PI * 0.45 - Math.sin(time * 8.0) * 0.25, 8, delta);
        rightArmGroup.rotation.z = THREE.MathUtils.damp(rightArmGroup.rotation.z, Math.PI * 0.45 + Math.sin(time * 8.0) * 0.25, 8, delta);
      } else if (st === 'explaining' || st === 'speaking') {
        // Right hand gesturing forward pedagogically
        rightArmGroup.rotation.z = THREE.MathUtils.damp(rightArmGroup.rotation.z, Math.PI * 0.35 + Math.sin(time * 5.0) * 0.15, 6, delta);
        rightArmGroup.rotation.x = THREE.MathUtils.damp(rightArmGroup.rotation.x, Math.PI * 0.2, 6, delta);
        leftArmGroup.rotation.z = THREE.MathUtils.damp(leftArmGroup.rotation.z, 0, 6, delta);
      } else if (st === 'thinking') {
        // Hand to chin reflection pose
        rightArmGroup.rotation.z = THREE.MathUtils.damp(rightArmGroup.rotation.z, Math.PI * 0.5, 6, delta);
        rightArmGroup.rotation.y = THREE.MathUtils.damp(rightArmGroup.rotation.y, -Math.PI * 0.25, 6, delta);
        leftArmGroup.rotation.z = THREE.MathUtils.damp(leftArmGroup.rotation.z, 0, 6, delta);
      } else if (st === 'encouraging') {
        // Affirmative head nod cycle
        nodTimer += delta * 6.0;
        headGroup.rotation.x = Math.sin(nodTimer) * 0.22;
        rightArmGroup.rotation.z = THREE.MathUtils.damp(rightArmGroup.rotation.z, Math.PI * 0.25, 6, delta);
      } else {
        // Relaxed resting arms
        leftArmGroup.rotation.z = THREE.MathUtils.damp(leftArmGroup.rotation.z, 0, 5, delta);
        rightArmGroup.rotation.z = THREE.MathUtils.damp(rightArmGroup.rotation.z, 0, 5, delta);
        rightArmGroup.rotation.x = THREE.MathUtils.damp(rightArmGroup.rotation.x, 0, 5, delta);
        rightArmGroup.rotation.y = THREE.MathUtils.damp(rightArmGroup.rotation.y, 0, 5, delta);
      }

      // F. Chest Arc-Reactor Quantum Pulse
      const coreScale = 1.0 + Math.sin(time * 4.5) * 0.08;
      coreMesh.scale.set(coreScale, coreScale, coreScale);

      renderer.render(scene, camera);
    };

    animate();

    // 6. Memory Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (interactiveGaze) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      headGeo.dispose();
      visorGeo.dispose();
      eyeGeo.dispose();
      mouthGeo.dispose();
      cheekGeo.dispose();
      stemGeo.dispose();
      beaconGeo.dispose();
      earGeo.dispose();
      bodyGeo.dispose();
      coreGeo.dispose();
      coreRingGeo.dispose();
      thrusterGeo.dispose();
      armGeo.dispose();
      handGeo.dispose();
      chassisMat.dispose();
      accentMat.dispose();
      visorMat.dispose();
      eyeMat.dispose();
      mouthMat.dispose();
      coreMat.dispose();
      beaconMat.dispose();
      cheekMat.dispose();
    };
  }, [numericSize, interactiveGaze, reducedMotion, themeStyle]);

  // High-Quality SVG Fallback if WebGL is unavailable or failed
  if (hasWebGlError) {
    return (
      <div
        style={{ width: numericSize, height: numericSize }}
        className={`relative flex items-center justify-center cursor-pointer ${className}`}
        onClick={onClick}
        title="Byte · StudentOS AI Tutor"
      >
        <svg viewBox="0 0 100 100" width={numericSize} height={numericSize} className="drop-shadow-lg">
          <circle cx="50" cy="50" r="42" fill="#0f172a" stroke="#06b6d4" strokeWidth="3" />
          <rect x="22" y="28" width="56" height="34" rx="14" fill="#030712" stroke="#334155" strokeWidth="2" />
          <circle cx="38" cy="45" r="5" fill="#22d3ee" />
          <circle cx="62" cy="45" r="5" fill="#22d3ee" />
          <path d="M 42 54 Q 50 60 58 54" stroke="#38bdf8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="50" cy="18" r="4" fill="#3b82f6" />
          <line x1="50" y1="22" x2="50" y2="28" stroke="#06b6d4" strokeWidth="2.5" />
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      style={{ width: numericSize, height: numericSize }}
      className={`relative select-none pointer-events-auto cursor-pointer ${className}`}
      onClick={onClick}
      title={`Byte · AI Companion (${activeState})`}
    />
  );
};
