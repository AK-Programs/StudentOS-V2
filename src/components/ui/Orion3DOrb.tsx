/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS — Orion 3D Animated Orb Core (Three.js WebGL)
 * High-fidelity iridescent holographic sphere with multi-axis gyroscopic rings,
 * dynamic vertex pulse, orbiting particle constellation, and interactive mouse parallax.
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Orion3DOrbProps {
  isProcessing?: boolean;
  size?: number;
  className?: string;
  onClick?: () => void;
}

export const Orion3DOrb: React.FC<Orion3DOrbProps> = ({ 
  isProcessing = false, 
  size = 180,
  className = '',
  onClick
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera & Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 5.2;

    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 2. Main Holographic Core Sphere
    const sphereRadius = 1.15;
    const sphereGeo = new THREE.IcosahedronGeometry(sphereRadius, 32);
    // Store original positions for dynamic vertex pulsation
    const origPositions = sphereGeo.attributes.position.clone();

    const sphereMat = new THREE.MeshPhysicalMaterial({
      color: isProcessing ? 0x6366f1 : 0x3b82f6,
      emissive: isProcessing ? 0x4f46e5 : 0x1d4ed8,
      emissiveIntensity: isProcessing ? 0.9 : 0.45,
      roughness: 0.15,
      metalness: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      wireframe: false
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphereMesh);

    // Inner wireframe lattice for technological holographic depth
    const wireGeo = new THREE.IcosahedronGeometry(1.22, 4);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: isProcessing ? 0.4 : 0.2
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wireMesh);

    // 3. Multi-Axis Gyroscopic Rings
    // Ring 1 (Cyan electric)
    const ring1Geo = new THREE.TorusGeometry(1.7, 0.024, 16, 120);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.75 });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    scene.add(ring1);

    // Ring 2 (Neon Violet/Purple)
    const ring2Geo = new THREE.TorusGeometry(2.05, 0.02, 16, 120);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.65 });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI / 4;
    scene.add(ring2);

    // Ring 3 (Equatorial Amber Accent)
    const ring3Geo = new THREE.TorusGeometry(2.35, 0.015, 16, 120);
    const ring3Mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.45 });
    const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3.rotation.x = -Math.PI / 6;
    scene.add(ring3);

    // 4. Surrounding Swirling Particle Constellation
    const particleCount = 140;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const radius = 2.0 + Math.random() * 1.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = radius * Math.cos(phi);
      particleSpeeds[i] = 0.2 + Math.random() * 0.5;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.045,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(0x38bdf8, 3.5, 20);
    keyLight.position.set(4, 3, 4);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xa855f7, 3.0, 20);
    rimLight.position.set(-4, -3, 3);
    scene.add(rimLight);

    const frontPulseLight = new THREE.PointLight(0x6366f1, 2.0, 15);
    frontPulseLight.position.set(0, 0, 4);
    scene.add(frontPulseLight);

    // 6. Interactive Mouse Tracking
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseRef.current.targetX = normX * 0.45;
      mouseRef.current.targetY = normY * 0.45;
    };

    container.addEventListener('mousemove', handleMouseMove);

    // 7. Animation Loop with WebGL Shading & Physics
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const time = clock.getElapsedTime();
      const speedMult = isProcessing ? 2.4 : 1.0;

      // Smooth mouse lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      // Group tilt based on mouse parallax
      scene.rotation.y = mouseRef.current.x;
      scene.rotation.x = -mouseRef.current.y;

      // Core rotation and breathing
      sphereMesh.rotation.y = time * 0.35 * speedMult;
      sphereMesh.rotation.x = Math.sin(time * 0.4) * 0.15;
      wireMesh.rotation.y = -time * 0.25 * speedMult;
      wireMesh.rotation.z = Math.cos(time * 0.3) * 0.15;

      // Gyroscopic Ring Rotations
      ring1.rotation.z = time * 0.55 * speedMult;
      ring1.rotation.x = Math.PI / 3 + Math.sin(time * 0.35) * 0.12;

      ring2.rotation.z = -time * 0.45 * speedMult;
      ring2.rotation.y = Math.PI / 4 + Math.cos(time * 0.3) * 0.15;

      ring3.rotation.y = time * 0.3 * speedMult;
      ring3.rotation.z = Math.sin(time * 0.5) * 0.1;

      // Particle Constellation Swirl
      particles.rotation.y = time * 0.18 * speedMult;
      particles.rotation.x = time * 0.08;

      // Processing Pulse / Soundwave effect
      if (isProcessing) {
        const pulse = 1 + Math.sin(time * 8) * 0.08;
        sphereMesh.scale.set(pulse, pulse, pulse);
        wireMesh.scale.set(pulse * 1.02, pulse * 1.02, pulse * 1.02);
        sphereMat.emissiveIntensity = 0.8 + Math.sin(time * 10) * 0.35;
        particleMat.size = 0.06;
      } else {
        sphereMesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);
        wireMesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);
        sphereMat.emissiveIntensity = 0.45 + Math.sin(time * 2) * 0.1;
        particleMat.size = 0.045;
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // 8. Cleanup on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousemove', handleMouseMove);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sphereGeo.dispose();
      origPositions.clone();
      sphereMat.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      ring2Geo.dispose();
      ring2Mat.dispose();
      ring3Geo.dispose();
      ring3Mat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, [isProcessing, size]);

  return (
    <div 
      onClick={onClick}
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Multi-tier Neon Ambient Backglow */}
      <div 
        className={`absolute rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          isProcessing 
            ? 'w-full h-full bg-indigo-500/35 scale-125' 
            : 'w-4/5 h-4/5 bg-cyan-500/20 scale-100'
        }`} 
      />
      <div 
        ref={mountRef} 
        className="relative z-10 transition-transform duration-300 hover:scale-105 active:scale-95" 
      />
    </div>
  );
};
