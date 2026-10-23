/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS — Orion 3D Animated Orb Core (Three.js)
 * Renders an iridescent glowing 3D sphere with orbiting wireframe rings and particle field.
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Orion3DOrbProps {
  isProcessing?: boolean;
  size?: number;
}

export const Orion3DOrb: React.FC<Orion3DOrbProps> = ({ isProcessing = false, size = 180 }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 4.5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Core Sphere (Iridescent Glowing Core)
    const sphereGeo = new THREE.SphereGeometry(1.2, 64, 64);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: isProcessing ? 0x6366f1 : 0x4f46e5,
      emissive: isProcessing ? 0x3b82f6 : 0x4338ca,
      emissiveIntensity: isProcessing ? 0.8 : 0.4,
      roughness: 0.1,
      metalness: 0.8,
      wireframe: false
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphereMesh);

    // Outer Orbiting Wireframe Rings
    const ringGeo1 = new THREE.TorusGeometry(1.7, 0.03, 16, 100);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    scene.add(ring1);

    const ringGeo2 = new THREE.TorusGeometry(2.1, 0.02, 16, 100);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.5 });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.y = Math.PI / 4;
    scene.add(ring2);

    // Ambient & Point Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x60a5fa, 3, 10);
    pointLight.position.set(3, 3, 3);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0xc084fc, 2, 10);
    pointLight2.position.set(-3, -3, 3);
    scene.add(pointLight2);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Idle and processing motion
      sphereMesh.rotation.y = elapsedTime * 0.4;
      sphereMesh.rotation.x = Math.sin(elapsedTime * 0.5) * 0.2;

      ring1.rotation.z = elapsedTime * 0.6;
      ring1.rotation.x = Math.PI / 3 + Math.sin(elapsedTime * 0.3) * 0.1;

      ring2.rotation.z = -elapsedTime * 0.4;
      ring2.rotation.y = Math.PI / 4 + Math.cos(elapsedTime * 0.3) * 0.1;

      if (isProcessing) {
        const pulse = 1 + Math.sin(elapsedTime * 10) * 0.15;
        sphereMesh.scale.set(pulse, pulse, pulse);
        sphereMat.emissiveIntensity = 0.9 + Math.sin(elapsedTime * 12) * 0.3;
      } else {
        sphereMesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);
        sphereMat.emissiveIntensity = 0.5;
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isProcessing, size]);

  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl animate-pulse pointer-events-none" />
      <div ref={mountRef} className="relative z-10 cursor-pointer transition-transform hover:scale-105" />
    </div>
  );
};
