/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Official 3D Character Model: "Byte"
 * Lightweight, procedural Three.js 3D character optimized for school phones & desktops:
 * - Expressive rounded cybernetic head with dark reflective visor
 * - Digital glowing LED eyes that blink periodically
 * - Antenna with pulsing quantum beacon
 * - Floating magnetic chassis with glowing Arc-Reactor core
 * - Articulated magnetic floating arms with wave animation
 * - Smooth idle floating bob, nodding celebration, and eye gaze tracking
 * - 100% procedural (zero remote assets, zero 404s, high mobile FPS)
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type Byte3DMood = 'idle' | 'wave' | 'nod' | 'happy' | 'talking';

interface Byte3DCanvasProps {
  mood?: Byte3DMood;
  size?: number; // Canvas size in pixels (e.g. 72, 96, 128, 200)
  className?: string;
  onClick?: () => void;
  interactiveGaze?: boolean;
}

export const Byte3DCanvas: React.FC<Byte3DCanvasProps> = ({
  mood = 'idle',
  size = 96,
  className = '',
  onClick,
  interactiveGaze = true
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const moodRef = useRef<Byte3DMood>(mood);
  moodRef.current = mood;

  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software rendering to safeguard budget school devices
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch (_) {
        return false;
      }
    })();

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 0.1, 4.2);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 2. Lighting Rig (Warm key + Cool fill + Ambient)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x60a5fa, 2.0); // Soft cyan/blue key
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xa78bfa, 1.4); // Lavender rim
    fillLight.position.set(-3, -2, 2);
    scene.add(fillLight);

    // 3. Procedural Materials
    // Primary Chassis (Sleek porcelain white with pearlescent sheen)
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.15
    });

    // Accent Cyber Teal Material
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // Cyan-500
      roughness: 0.3,
      metalness: 0.5
    });

    // Dark Visor Glass
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.1,
      metalness: 0.8
    });

    // Glowing LED Eyes Material (Bright Cyan/Emerald)
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee
    });

    // Glowing Heart Reactor Material
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8
    });

    // Antenna Glow
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6
    });

    // 4. Character Assembly (Hierarchical THREE.Group)
    const byteGroup = new THREE.Group();
    scene.add(byteGroup);

    // --- HEAD GROUP ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.45, 0);
    byteGroup.add(headGroup);

    // Head Base (Rounded box / sphere combo)
    const headGeo = new THREE.SphereGeometry(0.72, 24, 20);
    headGeo.scale(1.15, 1.0, 1.0);
    const headMesh = new THREE.Mesh(headGeo, chassisMat);
    headGroup.add(headMesh);

    // Visor Screen
    const visorGeo = new THREE.SphereGeometry(0.68, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.48);
    visorGeo.scale(1.08, 0.75, 1.02);
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.rotation.x = Math.PI * 0.28;
    visorMesh.position.set(0, 0.05, 0.08);
    headGroup.add(visorMesh);

    // Eyes (Expressive capsule/caps)
    const eyeGeo = new THREE.CapsuleGeometry(0.085, 0.14, 8, 12);
    eyeGeo.rotateZ(Math.PI / 2);

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.25, 0.06, 0.68);
    headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.25, 0.06, 0.68);
    headGroup.add(rightEye);

    // Cute Cheeks
    const cheekGeo = new THREE.CircleGeometry(0.08, 12);
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.6 });
    const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
    leftCheek.position.set(-0.42, -0.12, 0.62);
    leftCheek.rotation.y = -0.3;
    headGroup.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
    rightCheek.position.set(0.42, -0.12, 0.62);
    rightCheek.rotation.y = 0.3;
    headGroup.add(rightCheek);

    // Antenna & Halo Beacon
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8);
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

    // Quantum Arc-Reactor Chest Core
    const coreGeo = new THREE.SphereGeometry(0.15, 16, 12);
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, 0.1, 0.46);
    torsoGroup.add(coreMesh);

    const coreRingGeo = new THREE.TorusGeometry(0.2, 0.025, 8, 20);
    const coreRingMesh = new THREE.Mesh(coreRingGeo, accentMat);
    coreRingMesh.position.set(0, 0.1, 0.46);
    torsoGroup.add(coreRingMesh);

    // Floating Ion Thruster Ring
    const thrusterGeo = new THREE.TorusGeometry(0.26, 0.05, 8, 20);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterMesh = new THREE.Mesh(thrusterGeo, accentMat);
    thrusterMesh.position.set(0, -0.58, 0);
    torsoGroup.add(thrusterMesh);

    // --- ARMS & HANDS ---
    // Left Arm (Relaxed)
    const armGeo = new THREE.SphereGeometry(0.14, 12, 10);
    armGeo.scale(0.8, 1.4, 0.8);
    const leftArm = new THREE.Mesh(armGeo, chassisMat);
    leftArm.position.set(-0.68, 0.0, 0);
    torsoGroup.add(leftArm);

    // Right Arm (Waves when greeted or message arrives)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.68, 0.15, 0);
    torsoGroup.add(rightArmGroup);

    const rightArmMesh = new THREE.Mesh(armGeo, chassisMat);
    rightArmMesh.position.set(0, -0.15, 0);
    rightArmGroup.add(rightArmMesh);

    const handGeo = new THREE.SphereGeometry(0.11, 12, 10);
    const rightHand = new THREE.Mesh(handGeo, accentMat);
    rightHand.position.set(0, -0.32, 0);
    rightArmGroup.add(rightHand);

    // Interactive mouse listener
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactiveGaze) return;
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      mousePosRef.current = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    };
    if (interactiveGaze) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
    }

    // 5. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let blinkTimer = 0;
    let isBlinking = false;
    let nodProgress = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();
      const currentMood = moodRef.current;

      // 1. Idle Bobbing Motion (Smooth, weightless floating)
      const bobY = Math.sin(time * 2.8) * 0.07;
      byteGroup.position.y = bobY;

      // Gentle floating tilt
      byteGroup.rotation.z = Math.sin(time * 1.4) * 0.04;
      byteGroup.rotation.y = Math.sin(time * 0.9) * 0.06;

      // 2. Interactive Gaze Tracking
      if (interactiveGaze) {
        const targetRotY = mousePosRef.current.x * 0.28;
        const targetRotX = -mousePosRef.current.y * 0.22;
        headGroup.rotation.y = THREE.MathUtils.damp(headGroup.rotation.y, targetRotY, 5, delta);
        headGroup.rotation.x = THREE.MathUtils.damp(headGroup.rotation.x, targetRotX, 5, delta);
      }

      // 3. Periodic Blink Animation
      blinkTimer += delta;
      if (blinkTimer > 3.2) {
        isBlinking = true;
        blinkTimer = 0;
      }
      if (isBlinking) {
        leftEye.scale.y = 0.12;
        rightEye.scale.y = 0.12;
        setTimeout(() => {
          leftEye.scale.y = 1.0;
          rightEye.scale.y = 1.0;
          isBlinking = false;
        }, 130);
      }

      // 4. Mood: Wave Animation (Hand waves up and down cheerfully)
      if (currentMood === 'wave' || currentMood === 'happy') {
        rightArmGroup.rotation.z = Math.PI * 0.45 + Math.sin(time * 8.0) * 0.35;
        rightArmGroup.rotation.x = Math.sin(time * 6.0) * 0.25;
      } else {
        rightArmGroup.rotation.z = THREE.MathUtils.damp(rightArmGroup.rotation.z, 0, 6, delta);
        rightArmGroup.rotation.x = THREE.MathUtils.damp(rightArmGroup.rotation.x, 0, 6, delta);
      }

      // 5. Mood: Nod Animation (Affirmative celebration when task completed)
      if (currentMood === 'nod') {
        nodProgress += delta * 7.0;
        headGroup.rotation.x = Math.sin(nodProgress) * 0.35;
      } else {
        nodProgress = 0;
      }

      // 6. Beacon & Core gentle pulse
      const coreScale = 1.0 + Math.sin(time * 4.0) * 0.08;
      coreMesh.scale.set(coreScale, coreScale, coreScale);

      renderer.render(scene, camera);
    };

    animate();

    // 6. Cleanup
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
      coreMat.dispose();
      beaconMat.dispose();
      cheekMat.dispose();
    };
  }, [size, interactiveGaze]);

  return (
    <div
      ref={mountRef}
      style={{ width: size, height: size }}
      className={`relative select-none pointer-events-auto cursor-pointer ${className}`}
      onClick={onClick}
      title="Byte · StudentOS 3D Study Buddy"
    />
  );
};
