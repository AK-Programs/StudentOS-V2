/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS — Orion 3D Animated Prism Badge Component (Three.js)
 * Mini 3D holographic spinning octahedron/crystal that gives Orion responses a futuristic 3D identity.
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Orion3DPrismBadgeProps {
  size?: number;
  className?: string;
}

export const Orion3DPrismBadge: React.FC<Orion3DPrismBadgeProps> = ({ 
  size = 32,
  className = ''
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.z = 3.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Holographic Octahedron Crystal
    const geometry = new THREE.OctahedronGeometry(0.8, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.85,
      wireframe: false
    });
    const crystal = new THREE.Mesh(geometry, material);
    scene.add(crystal);

    // Outer wireframe edge accent
    const wireGeo = new THREE.OctahedronGeometry(0.86, 0);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wire);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambient);

    const point = new THREE.PointLight(0xa855f7, 2.5, 10);
    point.position.set(2, 2, 2);
    scene.add(point);

    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const time = clock.getElapsedTime();
      crystal.rotation.y = time * 1.2;
      crystal.rotation.x = Math.sin(time * 0.8) * 0.3;
      wire.rotation.y = -time * 0.9;
      wire.rotation.z = Math.cos(time * 0.7) * 0.2;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      renderer.dispose();
    };
  }, [size]);

  return (
    <div 
      ref={mountRef} 
      className={`inline-flex items-center justify-center shrink-0 ${className}`} 
      style={{ width: size, height: size }}
    />
  );
};
