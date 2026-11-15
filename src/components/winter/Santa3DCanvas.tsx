/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Immersive 3D Santa & Gift Box Canvas with Three.js
 * - 3D Santa character with idle sway, blinking, and reaching animation on claim
 * - 3D Gift box with a separate hinged lid that rotates open on claim
 * - Internal glowing light pillar and slow 3D snowfall particle system
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Santa3DCanvasProps {
  isClaiming: boolean;
  isOpen?: boolean;
}

export const Santa3DCanvas: React.FC<Santa3DCanvasProps> = ({ isClaiming, isOpen = false }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 260;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = null; // transparent

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 1.8, 6.2);
    camera.lookAt(0, 0.2, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    dirLight.position.set(5, 8, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x38bdf8, 1.5, 10);
    pointLight.position.set(-3, 2, 2);
    scene.add(pointLight);

    // 4. Build Santa 3D Group
    const santaGroup = new THREE.Group();
    santaGroup.position.set(-1.2, -0.9, 0);
    scene.add(santaGroup);

    // Santa Body (Coat)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
    const whiteTrimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.4 });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.2 });

    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.4, 16), bodyMat);
    bodyMesh.position.y = 0.7;
    santaGroup.add(bodyMesh);

    // Santa Belt
    const beltMesh = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 1.05), beltMat);
    beltMesh.position.y = 0.5;
    santaGroup.add(beltMesh);

    const buckleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.1), goldMat);
    buckleMesh.position.set(0, 0.5, 0.53);
    santaGroup.add(buckleMesh);

    // Santa Head & Hat Group
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.6, 0);
    santaGroup.add(headGroup);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), skinMat);
    headGroup.add(headMesh);

    // Beard
    const beardMesh = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 16), whiteTrimMat);
    beardMesh.position.set(0, -0.25, 0.2);
    beardMesh.rotation.x = Math.PI * 0.15;
    headGroup.add(beardMesh);

    // Hat
    const hatMesh = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.8, 16), bodyMat);
    hatMesh.position.set(0, 0.5, 0);
    hatMesh.rotation.z = -Math.PI * 0.1;
    headGroup.add(hatMesh);

    const pomPom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), whiteTrimMat);
    pomPom.position.set(-0.2, 0.9, 0);
    headGroup.add(pomPom);

    // Santa Right Arm (for reaching)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.5, 1.1, 0);
    santaGroup.add(rightArmGroup);

    const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 12), bodyMat);
    armMesh.position.set(0.3, -0.3, 0);
    armMesh.rotation.z = -Math.PI * 0.3;
    rightArmGroup.add(armMesh);

    // 5. Build 3D Gift Box with Separate Hinged Lid
    const giftGroup = new THREE.Group();
    giftGroup.position.set(1.2, -0.9, 0);
    scene.add(giftGroup);

    const boxMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.2 });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.5, roughness: 0.3 });

    // Box Base
    const boxBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 1.4), boxMat);
    boxBase.position.y = 0.65;
    giftGroup.add(boxBase);

    // Ribbons on Base
    const ribV = new THREE.Mesh(new THREE.BoxGeometry(1.42, 1.31, 0.25), ribbonMat);
    ribV.position.y = 0.65;
    giftGroup.add(ribV);

    const ribH = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.31, 1.42), ribbonMat);
    ribH.position.y = 0.65;
    giftGroup.add(ribH);

    // Hinged Lid Group (pivot at back edge: z = -0.7)
    const lidPivotGroup = new THREE.Group();
    lidPivotGroup.position.set(0, 1.3, -0.7);
    giftGroup.add(lidPivotGroup);

    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.25, 1.46), boxMat);
    lidMesh.position.set(0, 0.125, 0.7); // offset relative to pivot
    lidPivotGroup.add(lidMesh);

    const lidRibbon = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.27, 0.26), ribbonMat);
    lidRibbon.position.set(0, 0.125, 0.7);
    lidPivotGroup.add(lidRibbon);

    // Inside glowing light pillar
    const boxLight = new THREE.PointLight(0xfbbf24, 0, 5);
    boxLight.position.set(0, 0.8, 0);
    giftGroup.add(boxLight);

    // 6. Falling Snow Particles in 3D Scene
    const snowCount = 200;
    const snowGeo = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount * 3; i += 3) {
      snowPositions[i] = (Math.random() - 0.5) * 12;
      snowPositions[i + 1] = Math.random() * 6 - 2;
      snowPositions[i + 2] = (Math.random() - 0.5) * 8;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snowMat = new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.05, transparent: true, opacity: 0.7 });
    const snowParticles = new THREE.Points(snowGeo, snowMat);
    scene.add(snowParticles);

    // 7. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Slow Snow fall
      const posAttr = snowGeo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 1; i < arr.length; i += 3) {
        arr[i] -= 0.012;
        if (arr[i] < -2) arr[i] = 4;
      }
      posAttr.needsUpdate = true;

      // Santa Idle Sway & Blink
      if (!isClaiming) {
        santaGroup.rotation.z = Math.sin(elapsedTime * 2) * 0.04;
        rightArmGroup.rotation.x = THREE.MathUtils.damp(rightArmGroup.rotation.x, 0, 5, 0.016);
        lidPivotGroup.rotation.x = THREE.MathUtils.damp(lidPivotGroup.rotation.x, 0, 8, 0.016);
        boxLight.intensity = THREE.MathUtils.damp(boxLight.intensity, 0, 8, 0.016);
      } else {
        // Claiming animation: Santa reaches towards box, lid rotates open on hinge, light glows
        santaGroup.rotation.z = THREE.MathUtils.damp(santaGroup.rotation.z, 0.1, 6, 0.016);
        rightArmGroup.rotation.x = THREE.MathUtils.damp(rightArmGroup.rotation.x, -Math.PI * 0.45, 10, 0.016);
        rightArmGroup.rotation.y = THREE.MathUtils.damp(rightArmGroup.rotation.y, Math.PI * 0.3, 10, 0.016);
        
        // Lid rotates open on its hinge (-Math.PI * 0.75)
        lidPivotGroup.rotation.x = THREE.MathUtils.damp(lidPivotGroup.rotation.x, -Math.PI * 0.75, 10, 0.016);
        boxLight.intensity = THREE.MathUtils.damp(boxLight.intensity, 3.5, 10, 0.016);
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 320;
      const h = container.clientHeight || 260;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [isClaiming]);

  return <div ref={mountRef} className="w-full h-full min-h-[240px] flex items-center justify-center" />;
};
