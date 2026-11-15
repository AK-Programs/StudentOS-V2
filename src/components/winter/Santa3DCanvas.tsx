/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Immersive 3D Santa & Hinged Gift Box Scene (Three.js + GLTFLoader)
 * - Loads adult-proportioned articulated /assets/models/santa.glb with AnimationMixer clips
 * - Caches GLB ArrayBuffer across modal open/close cycles; full GPU disposal on unmount
 * - Separate 3D Gift Box with recessed cavity, wrap ribbons, sculpted multi-loop bow,
 *   and back-edge hinged lid opening >= 115 degrees (-2.02 rad)
 * - Coordinated timeline: Idle -> Server Pending -> Santa Reach -> Lid Open -> Glow & GPU Sparkles -> Reveal
 * - RoomEnvironment PMREM lighting, software-WebGL detection, ResizeObserver, visibility pause, & fallback UI
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SantaGiftBoxSvg, SnowflakeVector } from './WinterArtwork';

export type SantaScenePhase = 'idle' | 'pending' | 'revealing' | 'revealed';

interface Santa3DCanvasProps {
  phase: SantaScenePhase;
  isOpen: boolean;
  prefersReducedMotion?: boolean;
  isLegendaryWin?: boolean;
  onRevealComplete?: () => void;
}

const SANTA_MODEL_URL = '/assets/models/santa.glb';
const LID_OPEN_ANGLE_RAD = -2.02; // ~115.7 degrees backward around back hinge

let cachedSantaGlbPromise: Promise<ArrayBuffer> | null = null;

function fetchCachedSantaGlb(): Promise<ArrayBuffer> {
  if (!cachedSantaGlbPromise) {
    cachedSantaGlbPromise = fetch(SANTA_MODEL_URL, { cache: 'force-cache' }).then((res) => {
      if (!res.ok) {
        cachedSantaGlbPromise = null;
        throw new Error(`Failed to load Santa 3D model (${res.status})`);
      }
      return res.arrayBuffer();
    });
  }
  return cachedSantaGlbPromise;
}

function detectSoftwareWebGL(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const vendor = String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '');
      const rendererStr = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
      if (/swiftshader|llvmpipe|software|mesa offscreen|virtualbox/i.test(`${vendor} ${rendererStr}`)) {
        return true;
      }
    }
  } catch {
    // ignore debug extension errors
  }
  return false;
}

function disposeObjectTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = (mesh as unknown as { material?: THREE.Material | THREE.Material[] }).material;
    if (mat) {
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        for (const key of Object.keys(m)) {
          const val = (m as unknown as Record<string, unknown>)[key];
          if (val && typeof val === 'object' && 'isTexture' in val) {
            (val as THREE.Texture).dispose();
          }
        }
        m.dispose();
      }
    }
  });
}

function buildHollowGiftBox() {
  const giftGroup = new THREE.Group();
  giftGroup.name = 'GiftBoxRoot';

  const w = 1.02;
  const h = 0.84;
  const d = 1.02;
  const wallT = 0.055;

  const boxMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    roughness: 0.34,
    metalness: 0.14,
  });
  const linerMat = new THREE.MeshStandardMaterial({
    color: 0x090d1a,
    roughness: 0.85,
    metalness: 0.02,
  });
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.24,
    metalness: 0.78,
  });
  const trimGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    roughness: 0.2,
    metalness: 0.86,
  });

  // Floor & 4 walls (recessed interior cavity so opening lid reveals a true open box)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, wallT, d), boxMat);
  floor.position.y = wallT / 2;
  floor.receiveShadow = true;
  floor.castShadow = true;
  giftGroup.add(floor);

  const innerFloor = new THREE.Mesh(new THREE.PlaneGeometry(w - wallT * 2.1, d - wallT * 2.1), linerMat);
  innerFloor.rotation.x = -Math.PI / 2;
  innerFloor.position.y = wallT + 0.004;
  giftGroup.add(innerFloor);

  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), boxMat);
  frontWall.position.set(0, h / 2, d / 2 - wallT / 2);
  frontWall.castShadow = true;
  frontWall.receiveShadow = true;
  giftGroup.add(frontWall);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), boxMat);
  backWall.position.set(0, h / 2, -d / 2 + wallT / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  giftGroup.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d - wallT * 2), boxMat);
  leftWall.position.set(-w / 2 + wallT / 2, h / 2, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  giftGroup.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d - wallT * 2), boxMat);
  rightWall.position.set(w / 2 - wallT / 2, h / 2, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  giftGroup.add(rightWall);

  // Inner dark velvet liner walls
  const innerFront = new THREE.Mesh(new THREE.PlaneGeometry(w - wallT * 2.02, h - 0.06), linerMat);
  innerFront.position.set(0, h / 2, d / 2 - wallT - 0.002);
  innerFront.rotation.y = Math.PI;
  giftGroup.add(innerFront);

  const innerBack = new THREE.Mesh(new THREE.PlaneGeometry(w - wallT * 2.02, h - 0.06), linerMat);
  innerBack.position.set(0, h / 2, -d / 2 + wallT + 0.002);
  giftGroup.add(innerBack);

  // Wrap-around vertical golden ribbons on exterior walls
  const ribZ = new THREE.Mesh(new THREE.BoxGeometry(0.18, h - 0.02, d + 0.018), ribbonMat);
  ribZ.position.set(0, h / 2, 0);
  giftGroup.add(ribZ);

  const ribX = new THREE.Mesh(new THREE.BoxGeometry(w + 0.018, h - 0.02, 0.18), ribbonMat);
  ribX.position.set(0, h / 2, 0);
  giftGroup.add(ribX);

  // Subtle gold inner rim collar
  const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.012, 0.025, d + 0.012), trimGoldMat);
  rim.position.set(0, h - 0.012, 0);
  giftGroup.add(rim);

  // ==============================================================
  // SEPARATE HINGED LID (Pivot cleanly at exact back-top edge!)
  // ==============================================================
  const lidPivot = new THREE.Group();
  lidPivot.name = 'GiftLidPivot';
  lidPivot.position.set(0, h, -d / 2); // exact back hinge axis
  giftGroup.add(lidPivot);

  const lidW = w + 0.08;
  const lidD = d + 0.08;
  const lidH = 0.17;

  const lidCap = new THREE.Mesh(new THREE.BoxGeometry(lidW, lidH, lidD), boxMat);
  // Offset forward (+Z) from hinge so back edge aligns with hinge pivot (z=0 in pivot space)
  lidCap.position.set(0, lidH / 2 - 0.03, d / 2);
  lidCap.castShadow = true;
  lidCap.receiveShadow = true;
  lidPivot.add(lidCap);

  // Cross ribbons attached to Lid
  const lidRibZ = new THREE.Mesh(new THREE.BoxGeometry(0.185, lidH + 0.014, lidD + 0.014), ribbonMat);
  lidRibZ.position.set(0, lidH / 2 - 0.03, d / 2);
  lidPivot.add(lidRibZ);

  const lidRibX = new THREE.Mesh(new THREE.BoxGeometry(lidW + 0.014, lidH + 0.014, 0.185), ribbonMat);
  lidRibX.position.set(0, lidH / 2 - 0.03, d / 2);
  lidPivot.add(lidRibX);

  // Sculpted Multi-Loop Satin Bow mounted atop Lid center
  const bowGroup = new THREE.Group();
  bowGroup.position.set(0, lidH - 0.02, d / 2);
  lidPivot.add(bowGroup);

  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), trimGoldMat);
  knot.scale.set(1.1, 0.72, 1.1);
  knot.position.y = 0.04;
  bowGroup.add(knot);

  const loopGeo = new THREE.TorusGeometry(0.145, 0.036, 10, 22);
  [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((ang, idx) => {
    const loop = new THREE.Mesh(loopGeo, idx % 2 === 0 ? trimGoldMat : ribbonMat);
    loop.scale.set(1.25, 0.68, 0.55);
    loop.position.set(Math.cos(ang) * 0.135, 0.085, Math.sin(ang) * 0.135);
    loop.rotation.y = -ang;
    loop.rotation.z = 0.36;
    loop.castShadow = true;
    bowGroup.add(loop);
  });

  // Volumetric Internal Glow Cone (scales & brightens when lid opens)
  const glowConeGeo = new THREE.CylinderGeometry(0.68, 0.32, 1.5, 24, 1, true);
  glowConeGeo.translate(0, 0.75, 0);
  const glowConeMat = new THREE.MeshBasicMaterial({
    color: 0xfde68a,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glowCone = new THREE.Mesh(glowConeGeo, glowConeMat);
  glowCone.position.set(0, 0.35, 0);
  giftGroup.add(glowCone);

  const boxLight = new THREE.PointLight(0xfbbf24, 0, 5.5, 1.6);
  boxLight.position.set(0, 0.65, 0);
  giftGroup.add(boxLight);

  return { giftGroup, lidPivot, glowCone, glowConeMat, boxLight };
}

function buildEmergingSparklesSystem(count: number) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const gold = new THREE.Color(0xfef08a);
  const cyan = new THREE.Color(0x38bdf8);
  const rose = new THREE.Color(0xfb7185);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.52;
    positions[i * 3 + 1] = 0.35 + Math.random() * 0.25;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.52;
    seeds[i] = Math.random();
    const c = i % 3 === 0 ? gold : i % 3 === 1 ? cyan : rose;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBurst: { value: 0 },
      uSize: { value: 22.0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSeed;
      attribute vec3 aColor;
      uniform float uTime;
      uniform float uBurst;
      uniform float uSize;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        float life = fract(uTime * (0.45 + aSeed * 0.35) + aSeed);
        vec3 p = position;
        float spread = (0.3 + life * 1.15) * uBurst;
        float angle = aSeed * 6.28318 + uTime * 1.4;
        p.x += cos(angle) * spread * 0.42;
        p.z += sin(angle) * spread * 0.42;
        p.y += life * 1.85 * uBurst;
        vAlpha = uBurst * sin(life * 3.14159);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.55 + 0.65 * aSeed) * (2.6 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float glow = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor, glow * vAlpha);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat };
}

export const Santa3DCanvas: React.FC<Santa3DCanvasProps> = ({
  phase,
  isOpen,
  prefersReducedMotion = false,
  isLegendaryWin = false,
  onRevealComplete,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState<boolean>(false);
  const [modelLoading, setModelLoading] = useState<boolean>(true);

  const phaseRef = useRef<SantaScenePhase>(phase);
  const isOpenRef = useRef<boolean>(isOpen);
  const reducedRef = useRef<boolean>(prefersReducedMotion);
  const legendaryRef = useRef<boolean>(isLegendaryWin);
  const onRevealCompleteRef = useRef(onRevealComplete);
  const syncLoopRef = useRef<(() => void) | null>(null);

  phaseRef.current = phase;
  isOpenRef.current = isOpen;
  reducedRef.current = prefersReducedMotion;
  legendaryRef.current = isLegendaryWin;
  onRevealCompleteRef.current = onRevealComplete;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      setModelLoading(false);
      return;
    }

    const isSoftwareGl = detectSoftwareWebGL(renderer);
    const width = container.clientWidth || 440;
    const height = container.clientHeight || 256;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFailed(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    scene.background = null;

    // PMREM RoomEnvironment for crisp metallic/ribbon highlights
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0.0, 0.85, 4.65);
    camera.lookAt(0.0, 0.08, 0.0);

    // 3-Point Festive Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
    keyLight.position.set(3.2, 5.2, 4.4);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1.0;
      keyLight.shadow.camera.far = 14.0;
      keyLight.shadow.camera.left = -2.8;
      keyLight.shadow.camera.right = 2.8;
      keyLight.shadow.camera.top = 2.6;
      keyLight.shadow.camera.bottom = -1.6;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimLight.position.set(-3.4, 2.8, -3.2);
    scene.add(rimLight);

    // Grounded Snowy Pedestal Base
    const stageY = -0.88;
    const snowDiscGeo = new THREE.CylinderGeometry(2.35, 2.5, 0.14, 48);
    const snowDiscMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.9,
      metalness: 0.02,
      transparent: true,
      opacity: 0.22,
    });
    const snowDisc = new THREE.Mesh(snowDiscGeo, snowDiscMat);
    snowDisc.position.set(0, stageY - 0.07, 0);
    snowDisc.receiveShadow = true;
    scene.add(snowDisc);

    // Gift Box + Hinged Lid + Emerging Sparkles
    const { giftGroup, lidPivot, glowCone, glowConeMat, boxLight } = buildHollowGiftBox();
    giftGroup.position.set(0.84, stageY, 0.12);
    giftGroup.rotation.y = -0.34;
    scene.add(giftGroup);

    const sparkleSystem = buildEmergingSparklesSystem(isSoftwareGl ? 45 : 90);
    giftGroup.add(sparkleSystem.points);

    // Ambient 3D Snowfall
    const snowCount = isSoftwareGl ? 80 : 150;
    const snowGeo = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(snowCount * 3);
    const snowDriftSeeds = new Float32Array(snowCount);
    for (let i = 0; i < snowCount; i++) {
      snowPositions[i * 3] = (Math.random() - 0.5) * 9.5;
      snowPositions[i * 3 + 1] = Math.random() * 5.0 - 1.4;
      snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 5.5 - 0.5;
      snowDriftSeeds[i] = Math.random() * Math.PI * 2;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.045,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const snowPoints = new THREE.Points(snowGeo, snowMat);
    scene.add(snowPoints);

    // Santa GLB Model + AnimationMixer State
    let mixer: THREE.AnimationMixer | null = null;
    const actions: Record<string, THREE.AnimationAction> = {};
    let activeClipName = 'Idle';
    let santaRoot: THREE.Object3D | null = null;
    let disposed = false;

    const switchClip = (nextName: string, fadeSec: number = 0.3, loopOnce: boolean = false) => {
      if (!mixer || activeClipName === nextName) return;
      const fromAction = actions[activeClipName];
      const toAction = actions[nextName];
      if (!toAction) return;

      toAction.reset();
      toAction.setEffectiveTimeScale(1);
      toAction.setEffectiveWeight(1);
      if (loopOnce) {
        toAction.setLoop(THREE.LoopOnce, 1);
        toAction.clampWhenFinished = true;
      } else {
        toAction.setLoop(THREE.LoopRepeat, Infinity);
      }
      toAction.play();
      if (fromAction && fromAction !== toAction) {
        fromAction.crossFadeTo(toAction, fadeSec, false);
      }
      activeClipName = nextName;
    };

    const loader = new GLTFLoader();
    fetchCachedSantaGlb()
      .then((buffer) => loader.parseAsync(buffer, '/assets/models/'))
      .then((gltf) => {
        if (disposed) return;
        santaRoot = gltf.scene;
        santaRoot.position.set(-0.78, stageY, 0.08);
        santaRoot.rotation.y = 0.32;
        santaRoot.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = !isSoftwareGl;
            obj.receiveShadow = !isSoftwareGl;
          }
        });
        scene.add(santaRoot);

        mixer = new THREE.AnimationMixer(santaRoot);
        for (const clip of gltf.animations) {
          actions[clip.name] = mixer.clipAction(clip);
        }
        if (actions['Idle']) {
          actions['Idle'].play();
          activeClipName = 'Idle';
        }
        setModelLoading(false);
      })
      .catch(() => {
        if (!disposed) {
          setModelLoading(false);
          setWebglFailed(true);
        }
      });

    // Coordinated Timeline State (all mutable refs -> zero React re-renders)
    let prevObservedPhase: SantaScenePhase = phaseRef.current;
    let revealTimerSec = 0;
    let revealCallbackFired = false;
    let lidAngle = phaseRef.current === 'revealed' ? LID_OPEN_ANGLE_RAD : 0;
    let glowStrength = phaseRef.current === 'revealed' ? 1 : 0;

    const clock = new THREE.Clock();

    const stepLoop = () => {
      const dt = Math.min(clock.getDelta(), 1 / 24);
      const elapsed = clock.elapsedTime;
      const curPhase = phaseRef.current;
      const isReduced = reducedRef.current;

      // Detect phase transitions cleanly
      if (curPhase !== prevObservedPhase) {
        if (curPhase === 'idle') {
          revealTimerSec = 0;
          revealCallbackFired = false;
          switchClip('Idle', 0.35, false);
        } else if (curPhase === 'pending') {
          revealTimerSec = 0;
          revealCallbackFired = false;
        } else if (curPhase === 'revealing') {
          revealTimerSec = 0;
          revealCallbackFired = false;
          switchClip('ReachGift', 0.25, true);
        } else if (curPhase === 'revealed') {
          switchClip('Celebrate', 0.35, false);
        }
        prevObservedPhase = curPhase;
      }

      // Advance GLTF AnimationMixer
      if (mixer) {
        if (isReduced && curPhase === 'idle') {
          mixer.update(0);
        } else {
          mixer.update(dt);
        }
      }

      // Snowfall motion (paused smoothly on reduced motion)
      if (!isReduced) {
        const attr = snowGeo.attributes.position as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        for (let i = 0; i < snowCount; i++) {
          const idx = i * 3;
          arr[idx + 1] -= dt * 0.42;
          arr[idx] += Math.sin(elapsed * 0.9 + snowDriftSeeds[i]) * dt * 0.08;
          if (arr[idx + 1] < -1.4) {
            arr[idx + 1] = 3.5;
          }
        }
        attr.needsUpdate = true;
      }

      // Coordinated Santa -> Hinged Lid -> Glow -> Sparkles -> Reveal timeline
      let targetLidAngle = 0;
      let targetGlow = 0;
      let sparkleBurst = 0;

      if (curPhase === 'idle') {
        targetLidAngle = 0;
        targetGlow = 0;
        sparkleBurst = 0;
      } else if (curPhase === 'pending') {
        // Gentle anticipation while server confirms claim; lid remains closed
        targetLidAngle = 0;
        targetGlow = 0.08;
        if (santaRoot && !isReduced) {
          santaRoot.rotation.y = THREE.MathUtils.damp(santaRoot.rotation.y, 0.44, 5, dt);
        }
      } else if (curPhase === 'revealing') {
        revealTimerSec += dt;

        if (isReduced) {
          lidAngle = LID_OPEN_ANGLE_RAD;
          glowStrength = 1;
          targetLidAngle = LID_OPEN_ANGLE_RAD;
          targetGlow = 1;
          sparkleBurst = 0.25;
          if (!revealCallbackFired && revealTimerSec >= 0.12) {
            revealCallbackFired = true;
            onRevealCompleteRef.current?.();
          }
        } else {
          // 0.00 - 0.60s: Santa reaches toward box
          if (santaRoot) {
            santaRoot.rotation.y = THREE.MathUtils.damp(santaRoot.rotation.y, 0.54, 7, dt);
          }

          // 0.60 - 1.35s: Hinged lid rotates >= 115 deg backward around back-edge pivot
          if (revealTimerSec >= 0.55) {
            const openU = Math.min(1, (revealTimerSec - 0.55) / 0.72);
            const easedOpen = 1 - Math.pow(1 - openU, 3);
            targetLidAngle = LID_OPEN_ANGLE_RAD * easedOpen;
            lidAngle = THREE.MathUtils.damp(lidAngle, targetLidAngle, 14, dt);
          }

          // 0.85 - 1.65s: Magical interior glow + emerging GPU sparkles
          if (revealTimerSec >= 0.80) {
            const glowU = Math.min(1, (revealTimerSec - 0.80) / 0.65);
            targetGlow = glowU * (legendaryRef.current ? 1.3 : 1.0);
            glowStrength = THREE.MathUtils.damp(glowStrength, targetGlow, 10, dt);
            sparkleBurst = glowU;
          }

          // 1.65s: Lid is open & glow peaked -> reveal prize card!
          if (!revealCallbackFired && revealTimerSec >= 1.65) {
            revealCallbackFired = true;
            switchClip('Celebrate', 0.35, false);
            onRevealCompleteRef.current?.();
          }
        }
      } else if (curPhase === 'revealed') {
        targetLidAngle = LID_OPEN_ANGLE_RAD;
        targetGlow = legendaryRef.current ? 1.15 : 0.85;
        lidAngle = THREE.MathUtils.damp(lidAngle, targetLidAngle, 10, dt);
        glowStrength = THREE.MathUtils.damp(glowStrength, targetGlow, 6, dt);
        sparkleBurst = isReduced ? 0.15 : 0.65;
        if (santaRoot && !isReduced) {
          santaRoot.rotation.y = THREE.MathUtils.damp(santaRoot.rotation.y, 0.38, 4, dt);
        }
      }

      if (curPhase === 'idle' || curPhase === 'pending') {
        lidAngle = THREE.MathUtils.damp(lidAngle, targetLidAngle, 10, dt);
        glowStrength = THREE.MathUtils.damp(glowStrength, targetGlow, 8, dt);
        if (curPhase === 'idle' && santaRoot) {
          santaRoot.rotation.y = THREE.MathUtils.damp(santaRoot.rotation.y, 0.32, 4, dt);
        }
      }

      // Apply hinged lid rotation & magical glow cone + point light + GPU sparkles
      lidPivot.rotation.x = lidAngle;
      const pulse = isReduced ? 1 : 0.92 + 0.08 * Math.sin(elapsed * 4.2);
      boxLight.intensity = Math.max(0, glowStrength * 3.8 * pulse);
      glowConeMat.opacity = Math.min(0.45, Math.max(0, glowStrength * 0.32 * pulse));
      glowCone.scale.set(1, 0.4 + Math.min(1, glowStrength) * 0.85, 1);

      sparkleSystem.mat.uniforms.uTime.value = elapsed;
      sparkleSystem.mat.uniforms.uBurst.value = sparkleBurst;

      renderer.render(scene, camera);
    };

    const syncLoopState = () => {
      const shouldRun = isOpenRef.current && document.visibilityState !== 'hidden';
      if (shouldRun) {
        clock.getDelta(); // reset delta jump after pause
        renderer.setAnimationLoop(stepLoop);
      } else {
        renderer.setAnimationLoop(null);
      }
    };

    syncLoopRef.current = syncLoopState;
    syncLoopState();

    const onVisibilityChange = () => syncLoopState();
    document.addEventListener('visibilitychange', onVisibilityChange);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(100, entry.contentRect.width);
      const h = Math.max(100, entry.contentRect.height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      syncLoopRef.current = null;
      renderer.setAnimationLoop(null);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      if (mixer) {
        mixer.stopAllAction();
      }
      disposeObjectTree(scene);
      envTarget.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Pause/resume animation loop cleanly when modal opens/closes without recreating WebGL scene
  useEffect(() => {
    syncLoopRef.current?.();
  }, [isOpen]);

  if (webglFailed) {
    return (
      <div className="w-full h-full min-h-[240px] flex flex-col items-center justify-center gap-3 p-4 bg-gradient-to-b from-slate-900/70 to-sky-950/60 text-center">
        <div className="flex items-center gap-3">
          <SnowflakeVector size={28} className="text-sky-300" />
          <SantaGiftBoxSvg size={58} />
        </div>
        <p className="text-xs font-medium text-slate-300">
          Festive Gift Stage Ready ({phase === 'revealed' ? 'Gift Opened!' : 'Interactive Mode'})
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[240px]">
      <div ref={mountRef} className="w-full h-full min-h-[240px] flex items-center justify-center" />
      {modelLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[11px] font-medium text-sky-200/80 animate-pulse">
            Preparing 3D Santa &amp; Gift Stage...
          </span>
        </div>
      )}
    </div>
  );
};
