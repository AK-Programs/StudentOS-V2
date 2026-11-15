/**
 * Generates a sculpted, adult-proportioned, articulated 3D Santa Claus GLB asset
 * with embedded AnimationClips (Idle, ReachGift, Celebrate) for Veylentra Winter Festival.
 *
 * Self-authored Apache-2.0 geometry using Three.js LatheGeometry, TubeGeometry, and
 * organic vertex shaping (no stacked cone/box/cylinder toy primitives).
 */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Polyfill minimal FileReader for Node GLTFExporter binary mode if needed
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class NodeFileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (typeof this.onloadend === 'function') this.onloadend({ target: this });
        if (typeof this.onload === 'function') this.onload({ target: this });
      }).catch((err) => {
        if (typeof this.onerror === 'function') this.onerror(err);
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        const b64 = Buffer.from(buf).toString('base64');
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
        if (typeof this.onloadend === 'function') this.onloadend({ target: this });
        if (typeof this.onload === 'function') this.onload({ target: this });
      }).catch((err) => {
        if (typeof this.onerror === 'function') this.onerror(err);
      });
    }
  };
}

function createTaperedTube(curve, tubularSegments, radiusFn, radialSegments = 14) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    const P = curve.getPointAt(u);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = Math.max(0.002, radiusFn(u));

    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);

      const nx = cos * N.x + sin * B.x;
      const ny = cos * N.y + sin * B.y;
      const nz = cos * N.z + sin * B.z;

      positions.push(P.x + r * nx, P.y + r * ny, P.z + r * nz);
      normals.push(nx, ny, nz);
      uvs.push(u, j / radialSegments);
    }
  }

  for (let j = 1; j <= tubularSegments; j++) {
    for (let i = 1; i <= radialSegments; i++) {
      const a = (radialSegments + 1) * (j - 1) + (i - 1);
      const b = (radialSegments + 1) * j + (i - 1);
      const c = (radialSegments + 1) * j + i;
      const d = (radialSegments + 1) * (j - 1) + i;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function displaceFurRing(geo, amp = 0.008, freqA = 11, freqB = 7) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const angle = Math.atan2(v.z, v.x);
    const wave =
      Math.sin(angle * freqA + v.y * 18) * amp +
      Math.cos(angle * freqB - v.y * 14) * (amp * 0.6);
    const len = Math.hypot(v.x, v.z) || 1;
    v.x += (v.x / len) * wave;
    v.z += (v.z / len) * wave;
    v.y += Math.sin(angle * (freqA + 2)) * (amp * 0.45);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBoot(matLeather, matFur, matTrouser) {
  const group = new THREE.Group();

  // Sculpted boot shaft via LatheGeometry (sole at y=0)
  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.078, 0.0),
    new THREE.Vector2(0.082, 0.032),
    new THREE.Vector2(0.068, 0.048),
    new THREE.Vector2(0.062, 0.14),
    new THREE.Vector2(0.068, 0.26),
    new THREE.Vector2(0.074, 0.34),
    new THREE.Vector2(0.056, 0.34),
  ];
  const shaftGeo = new THREE.LatheGeometry(profile, 20);
  const shaft = new THREE.Mesh(shaftGeo, matLeather);
  shaft.scale.set(0.95, 1, 1.15);
  shaft.castShadow = true;
  group.add(shaft);

  // Rounded toe vamp extending forward (+Z)
  const toeGeo = new THREE.SphereGeometry(0.072, 18, 14);
  const toe = new THREE.Mesh(toeGeo, matLeather);
  toe.scale.set(0.95, 0.62, 1.48);
  toe.position.set(0, 0.042, 0.072);
  toe.castShadow = true;
  group.add(toe);

  // Thick rubber/leather sole under toe
  const soleGeo = new THREE.CylinderGeometry(0.074, 0.078, 0.024, 18);
  const sole = new THREE.Mesh(soleGeo, matLeather);
  sole.scale.set(0.98, 1, 1.45);
  sole.position.set(0, 0.012, 0.072);
  group.add(sole);

  // Plush shearling boot cuff
  const cuffGeo = displaceFurRing(new THREE.TorusGeometry(0.074, 0.025, 12, 24), 0.005, 9, 5);
  const cuff = new THREE.Mesh(cuffGeo, matFur);
  cuff.rotation.x = Math.PI / 2;
  cuff.scale.set(0.98, 1.12, 1.15);
  cuff.position.set(0, 0.335, 0);
  cuff.castShadow = true;
  group.add(cuff);

  // Upper trouser leg tucked into boot
  const legGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.062, 0.32),
      new THREE.Vector2(0.078, 0.44),
      new THREE.Vector2(0.088, 0.58),
    ],
    18
  );
  const leg = new THREE.Mesh(legGeo, matTrouser);
  leg.scale.set(0.96, 1, 1.05);
  leg.castShadow = true;
  group.add(leg);

  return group;
}

function buildArm(side /* -1 left, +1 right */, matCoat, matFur, matGlove) {
  const shoulderPivot = new THREE.Group();
  shoulderPivot.name = side < 0 ? 'LeftShoulder' : 'RightShoulder';
  shoulderPivot.position.set(side * 0.275, 0.40, 0.0); // relative to Chest (y=0.90 -> 1.30)

  // Rounded shoulder cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.086, 16, 14), matCoat);
  cap.scale.set(1.0, 0.92, 0.95);
  cap.castShadow = true;
  shoulderPivot.add(cap);

  // Upper arm sleeve (shoulder -> elbow at y = -0.25)
  const upperCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(side * 0.035, -0.13, 0.01),
    new THREE.Vector3(side * 0.055, -0.25, 0.02),
  ]);
  const upperGeo = createTaperedTube(
    upperCurve,
    12,
    (u) => 0.084 - 0.016 * u,
    14
  );
  const upperMesh = new THREE.Mesh(upperGeo, matCoat);
  upperMesh.castShadow = true;
  shoulderPivot.add(upperMesh);

  // Elbow pivot
  const elbowPivot = new THREE.Group();
  elbowPivot.name = side < 0 ? 'LeftElbow' : 'RightElbow';
  elbowPivot.position.set(side * 0.055, -0.25, 0.02);
  shoulderPivot.add(elbowPivot);

  // Elbow joint roundness
  const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.067, 14, 12), matCoat);
  elbowPivot.add(elbowCap);

  // Forearm sleeve (0 -> wrist at (side*0.02, -0.22, 0.05))
  const foreCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(side * 0.015, -0.11, 0.025),
    new THREE.Vector3(side * 0.02, -0.22, 0.05),
  ]);
  const foreGeo = createTaperedTube(
    foreCurve,
    12,
    (u) => 0.068 + 0.01 * Math.sin(u * Math.PI * 0.6),
    14
  );
  const foreMesh = new THREE.Mesh(foreGeo, matCoat);
  foreMesh.castShadow = true;
  elbowPivot.add(foreMesh);

  // Plush fur wrist cuff
  const cuffGeo = displaceFurRing(new THREE.TorusGeometry(0.066, 0.024, 12, 22), 0.005, 8, 5);
  const cuff = new THREE.Mesh(cuffGeo, matFur);
  cuff.position.set(side * 0.02, -0.215, 0.05);
  cuff.rotation.x = Math.PI / 2 - 0.2;
  cuff.castShadow = true;
  elbowPivot.add(cuff);

  // Gloved Hand pivot
  const handPivot = new THREE.Group();
  handPivot.name = side < 0 ? 'LeftHand' : 'RightHand';
  handPivot.position.set(side * 0.02, -0.24, 0.055);
  elbowPivot.add(handPivot);

  const palmGeo = new THREE.SphereGeometry(0.052, 16, 14);
  const palm = new THREE.Mesh(palmGeo, matGlove);
  palm.scale.set(0.85, 1.25, 0.72);
  palm.position.set(0, -0.048, 0.012);
  palm.castShadow = true;
  handPivot.add(palm);

  const thumbGeo = new THREE.CapsuleGeometry(0.018, 0.036, 6, 10);
  const thumb = new THREE.Mesh(thumbGeo, matGlove);
  thumb.position.set(-side * 0.036, -0.032, 0.032);
  thumb.rotation.z = side * 0.55;
  thumb.rotation.x = -0.35;
  handPivot.add(thumb);

  return shoulderPivot;
}

function buildSantaScene() {
  const root = new THREE.Group();
  root.name = 'SantaClaus';

  // Materials
  const matCoat = new THREE.MeshStandardMaterial({
    name: 'SantaCoatCrimson',
    color: 0xc21822,
    roughness: 0.72,
    metalness: 0.04,
  });
  const matTrouser = new THREE.MeshStandardMaterial({
    name: 'SantaTrousers',
    color: 0x991b1b,
    roughness: 0.78,
    metalness: 0.02,
  });
  const matFur = new THREE.MeshStandardMaterial({
    name: 'SantaFurTrim',
    color: 0xf8fafc,
    roughness: 0.92,
    metalness: 0.0,
  });
  const matBeard = new THREE.MeshStandardMaterial({
    name: 'SantaBeardHair',
    color: 0xf1f5f9,
    roughness: 0.88,
    metalness: 0.0,
  });
  const matSkin = new THREE.MeshStandardMaterial({
    name: 'SantaSkin',
    color: 0xf5c4a1,
    roughness: 0.58,
    metalness: 0.02,
  });
  const matBlush = new THREE.MeshStandardMaterial({
    name: 'SantaRosyCheek',
    color: 0xe78578,
    roughness: 0.65,
    metalness: 0.0,
  });
  const matLeather = new THREE.MeshStandardMaterial({
    name: 'SantaLeather',
    color: 0x18181b,
    roughness: 0.34,
    metalness: 0.12,
  });
  const matGold = new THREE.MeshStandardMaterial({
    name: 'SantaGoldBuckle',
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.88,
  });
  const matSclera = new THREE.MeshStandardMaterial({
    name: 'SantaSclera',
    color: 0xffffff,
    roughness: 0.2,
  });
  const matIris = new THREE.MeshStandardMaterial({
    name: 'SantaIris',
    color: 0x1e293b,
    roughness: 0.14,
    metalness: 0.1,
  });
  const matGlove = new THREE.MeshStandardMaterial({
    name: 'SantaGloves',
    color: 0x7f1d1d,
    roughness: 0.62,
    metalness: 0.04,
  });

  // Pelvis / Lower Body Root
  const pelvis = new THREE.Group();
  pelvis.name = 'Pelvis';
  root.add(pelvis);

  const leftLeg = buildBoot(matLeather, matFur, matTrouser);
  leftLeg.name = 'LeftLeg';
  leftLeg.position.set(-0.13, 0, 0);
  pelvis.add(leftLeg);

  const rightLeg = buildBoot(matLeather, matFur, matTrouser);
  rightLeg.name = 'RightLeg';
  rightLeg.position.set(0.13, 0, 0);
  pelvis.add(rightLeg);

  // Spine (at waist/hips y = 0.44)
  const spine = new THREE.Group();
  spine.name = 'Spine';
  spine.position.set(0, 0.48, 0);
  pelvis.add(spine);

  // Coat Tunic Skirt (flared lower coat from y = 0.0 -> 0.44 relative to Spine, i.e. 0.48 -> 0.92 world)
  const skirtProfile = [
    new THREE.Vector2(0.0, 0.02),
    new THREE.Vector2(0.32, 0.02),
    new THREE.Vector2(0.35, 0.06),
    new THREE.Vector2(0.33, 0.18),
    new THREE.Vector2(0.295, 0.30),
    new THREE.Vector2(0.268, 0.40),
    new THREE.Vector2(0.262, 0.43),
  ];
  const skirtGeo = new THREE.LatheGeometry(skirtProfile, 26);
  const skirt = new THREE.Mesh(skirtGeo, matCoat);
  skirt.scale.set(1.0, 1.0, 0.84);
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  spine.add(skirt);

  // Fluffy Fur Coat Hem Ring
  const hemFurGeo = displaceFurRing(new THREE.TorusGeometry(0.34, 0.042, 14, 34), 0.009, 14, 9);
  const hemFur = new THREE.Mesh(hemFurGeo, matFur);
  hemFur.rotation.x = Math.PI / 2;
  hemFur.scale.set(1.0, 0.84, 1.15);
  hemFur.position.set(0, 0.035, 0);
  hemFur.castShadow = true;
  spine.add(hemFur);

  // Chest Group (starts at waist y = 0.42 relative to Spine -> world y = 0.90)
  const chest = new THREE.Group();
  chest.name = 'Chest';
  chest.position.set(0, 0.42, 0);
  spine.add(chest);

  // Sculpted Upper Coat Torso (waist 0.0 -> collar 0.50 relative to Chest, world 0.90 -> 1.40)
  const torsoProfile = [
    new THREE.Vector2(0.262, 0.0),
    new THREE.Vector2(0.295, 0.11),
    new THREE.Vector2(0.312, 0.22),
    new THREE.Vector2(0.302, 0.33),
    new THREE.Vector2(0.275, 0.41),
    new THREE.Vector2(0.18, 0.465),
    new THREE.Vector2(0.11, 0.495),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 26);
  const torso = new THREE.Mesh(torsoGeo, matCoat);
  torso.scale.set(1.0, 1.0, 0.82);
  torso.castShadow = true;
  torso.receiveShadow = true;
  chest.add(torso);

  // Leather Belt at waist (y = 0.01 relative to Chest)
  const beltGeo = new THREE.TorusGeometry(0.272, 0.034, 12, 32);
  const belt = new THREE.Mesh(beltGeo, matLeather);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.0, 0.84, 1.5);
  belt.position.set(0, 0.01, 0);
  belt.castShadow = true;
  chest.add(belt);

  // Detailed Gold Belt Buckle Frame
  const buckleGroup = new THREE.Group();
  buckleGroup.position.set(0, 0.01, 0.245);
  const barH = new THREE.BoxGeometry(0.115, 0.022, 0.026);
  const barV = new THREE.BoxGeometry(0.022, 0.095, 0.026);
  const bTop = new THREE.Mesh(barH, matGold);
  bTop.position.y = 0.038;
  const bBot = new THREE.Mesh(barH, matGold);
  bBot.position.y = -0.038;
  const bLeft = new THREE.Mesh(barV, matGold);
  bLeft.position.x = -0.048;
  const bRight = new THREE.Mesh(barV, matGold);
  bRight.position.x = 0.048;
  const bProng = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.014, 0.03), matGold);
  bProng.position.set(-0.02, 0, 0.004);
  buckleGroup.add(bTop, bBot, bLeft, bRight, bProng);
  chest.add(buckleGroup);

  // Vertical Fur Coat Placket Strip down front
  const placketCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.36, 0.285),
    new THREE.Vector3(0, -0.14, 0.258),
    new THREE.Vector3(0, 0.04, 0.245),
    new THREE.Vector3(0, 0.22, 0.262),
    new THREE.Vector3(0, 0.42, 0.205),
  ]);
  const placketGeo = createTaperedTube(placketCurve, 18, () => 0.028, 10);
  const placket = new THREE.Mesh(placketGeo, matFur);
  placket.scale.set(1.3, 1.0, 0.65);
  chest.add(placket);

  // 3 Brass Coat Buttons
  [0.14, 0.26, 0.37].forEach((by, idx) => {
    const bz = idx === 0 ? 0.275 : idx === 1 ? 0.268 : 0.238;
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), matGold);
    btn.scale.set(1, 1, 0.6);
    btn.position.set(0, by, bz);
    chest.add(btn);
  });

  // Plush Fur Collar Wrap around neck/shoulders
  const collarGeo = displaceFurRing(new THREE.TorusGeometry(0.155, 0.048, 14, 28), 0.008, 10, 6);
  const collar = new THREE.Mesh(collarGeo, matFur);
  collar.rotation.x = Math.PI / 2 + 0.08;
  collar.scale.set(1.12, 0.95, 1.1);
  collar.position.set(0, 0.465, 0.01);
  collar.castShadow = true;
  chest.add(collar);

  // Articulated Arms
  const leftArm = buildArm(-1, matCoat, matFur, matGlove);
  const rightArm = buildArm(1, matCoat, matFur, matGlove);
  chest.add(leftArm, rightArm);

  // Head Group (relative to Chest y = 0.50 -> world y = 1.40, head center at +0.165 -> world 1.565)
  const headPivot = new THREE.Group();
  headPivot.name = 'Head';
  headPivot.position.set(0, 0.52, 0.01);
  chest.add(headPivot);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.086, 0.09, 16), matSkin);
  neck.position.set(0, 0.03, 0);
  headPivot.add(neck);

  // Sculpted Skull & Face (adult scale radius 0.146 -> total height ~1.84m)
  const craniumGeo = new THREE.SphereGeometry(0.146, 28, 22);
  const cranium = new THREE.Mesh(craniumGeo, matSkin);
  cranium.scale.set(0.98, 1.07, 0.99);
  cranium.position.set(0, 0.155, 0.005);
  cranium.castShadow = true;
  headPivot.add(cranium);

  // Ears
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), matSkin);
    ear.scale.set(0.55, 1.15, 0.8);
    ear.position.set(side * 0.142, 0.152, -0.005);
    headPivot.add(ear);
  });

  // Rosy Cheeks
  [-1, 1].forEach((side) => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 12), matBlush);
    cheek.scale.set(1.15, 0.85, 0.55);
    cheek.position.set(side * 0.072, 0.128, 0.118);
    headPivot.add(cheek);
  });

  // Warm Jolly Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.031, 16, 14), matBlush);
  nose.scale.set(1.08, 0.95, 1.12);
  nose.position.set(0, 0.145, 0.152);
  headPivot.add(nose);

  // Eyes + Eyelids for natural blinking
  [-1, 1].forEach((side) => {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(side * 0.048, 0.178, 0.122);
    headPivot.add(eyeGroup);

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.021, 14, 12), matSclera);
    sclera.scale.set(0.95, 1.05, 0.72);
    eyeGroup.add(sclera);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), matIris);
    iris.position.set(0, 0, 0.012);
    eyeGroup.add(iris);

    const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 8), matSclera);
    catchlight.position.set(0.004, 0.005, 0.022);
    eyeGroup.add(catchlight);

    // Upper Eyelid Shell (rotates downward on blink)
    const lidGeo = new THREE.SphereGeometry(0.0235, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const lid = new THREE.Mesh(lidGeo, matSkin);
    lid.name = side < 0 ? 'EyelidLeft' : 'EyelidRight';
    lid.rotation.x = -0.78; // open resting position
    eyeGroup.add(lid);
  });

  // Bushy Expressive Eyebrows
  [-1, 1].forEach((side) => {
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.018, 0.212, 0.132),
      new THREE.Vector3(side * 0.050, 0.222, 0.135),
      new THREE.Vector3(side * 0.084, 0.208, 0.118),
    ]);
    const browGeo = createTaperedTube(browCurve, 10, (u) => 0.013 * (1 - 0.35 * u) + 0.004, 10);
    const brow = new THREE.Mesh(browGeo, matBeard);
    headPivot.add(brow);
  });

  // Sweeping Handlebar Mustache
  [-1, 1].forEach((side) => {
    const mCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.118, 0.152),
      new THREE.Vector3(side * 0.048, 0.112, 0.152),
      new THREE.Vector3(side * 0.095, 0.094, 0.132),
      new THREE.Vector3(side * 0.122, 0.104, 0.105),
    ]);
    const mGeo = createTaperedTube(mCurve, 14, (u) => 0.024 * Math.sin((1 - u * 0.72) * Math.PI * 0.6) + 0.006, 12);
    const mustache = new THREE.Mesh(mGeo, matBeard);
    mustache.castShadow = true;
    headPivot.add(mustache);
  });

  // Full Sculpted Flowing Santa Beard (layered locks + sculpted chin apron — NO cone!)
  const beardGroup = new THREE.Group();
  beardGroup.name = 'Beard';
  headPivot.add(beardGroup);

  const mainBeardCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.105, 0.122),
    new THREE.Vector3(0, 0.02, 0.155),
    new THREE.Vector3(0, -0.09, 0.168),
    new THREE.Vector3(0, -0.19, 0.145),
    new THREE.Vector3(0, -0.255, 0.108),
  ]);
  const mainBeardGeo = createTaperedTube(
    mainBeardCurve,
    18,
    (u) => {
      if (u < 0.3) return 0.088 + u * 0.06;
      return 0.106 * Math.pow(1 - (u - 0.3) / 0.7, 0.65) + 0.015;
    },
    18
  );
  const mainBeard = new THREE.Mesh(mainBeardGeo, matBeard);
  mainBeard.scale.set(1.25, 1.0, 0.72);
  mainBeard.castShadow = true;
  beardGroup.add(mainBeard);

  // Side jaw & cheek beard locks wrapping smoothly up to ears
  [-1, 1].forEach((side) => {
    const sideLock = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.122, 0.135, 0.035),
      new THREE.Vector3(side * 0.118, 0.06, 0.092),
      new THREE.Vector3(side * 0.088, -0.04, 0.128),
      new THREE.Vector3(side * 0.048, -0.155, 0.132),
      new THREE.Vector3(side * 0.015, -0.225, 0.105),
    ]);
    const lockGeo = createTaperedTube(
      sideLock,
      14,
      (u) => 0.052 * (1 - 0.6 * u) + 0.012,
      12
    );
    const lockMesh = new THREE.Mesh(lockGeo, matBeard);
    lockMesh.castShadow = true;
    beardGroup.add(lockMesh);
  });

  // Hair at back of head
  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.148, 18, 14), matBeard);
  backHair.scale.set(1.02, 0.85, 0.88);
  backHair.position.set(0, 0.15, -0.026);
  headPivot.add(backHair);

  // Santa Hat (Plush Fur Brim + Curved Drooping Hat + Bobbing Pom-Pom)
  const hatPivot = new THREE.Group();
  hatPivot.name = 'HatBase';
  hatPivot.position.set(0, 0.255, 0);
  headPivot.add(hatPivot);

  const hatBrimGeo = displaceFurRing(new THREE.TorusGeometry(0.148, 0.038, 14, 28), 0.006, 12, 7);
  const hatBrim = new THREE.Mesh(hatBrimGeo, matFur);
  hatBrim.rotation.x = Math.PI / 2 - 0.12;
  hatBrim.scale.set(1.02, 1.08, 1.0);
  hatBrim.castShadow = true;
  hatPivot.add(hatBrim);

  const hatCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0, 0.0),
    new THREE.Vector3(0.02, 0.12, -0.01),
    new THREE.Vector3(0.08, 0.22, -0.03),
    new THREE.Vector3(0.17, 0.24, -0.05),
    new THREE.Vector3(0.23, 0.16, -0.06),
  ]);
  const hatClothGeo = createTaperedTube(
    hatCurve,
    20,
    (u) => 0.146 * Math.pow(1 - u, 0.85) + 0.016,
    18
  );
  const hatCloth = new THREE.Mesh(hatClothGeo, matCoat);
  hatCloth.castShadow = true;
  hatPivot.add(hatCloth);

  const hatTip = new THREE.Group();
  hatTip.name = 'HatTip';
  hatTip.position.set(0.23, 0.155, -0.06);
  hatPivot.add(hatTip);

  const pomGeo = displaceFurRing(new THREE.SphereGeometry(0.044, 14, 12), 0.005, 8, 5);
  const pomPom = new THREE.Mesh(pomGeo, matFur);
  pomPom.castShadow = true;
  hatTip.add(pomPom);

  // =========================================================
  // EMBEDDED GLTF ANIMATION CLIPS (Idle, ReachGift, Celebrate)
  // =========================================================

  // 1. Idle (4.0s looping): subtle weight shift, chest breath, head look, eye blink
  const idleTimes = [0, 1.0, 2.0, 3.0, 4.0];
  const blinkTimes = [0, 2.6, 2.7, 2.82, 4.0];

  const idleTracks = [
    new THREE.VectorKeyframeTrack('Pelvis.position', idleTimes, [
      0, 0, 0,
      0.012, 0.004, 0,
      0, 0, 0,
      -0.012, 0.004, 0,
      0, 0, 0,
    ]),
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', idleTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, 0.03, -0.018)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.0, 0.0, 0.018)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, -0.03, 0.02)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.0, 0.0, -0.018)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, 0.03, -0.018)).toArray(),
    ]),
    new THREE.VectorKeyframeTrack('Chest.scale', idleTimes, [
      1, 1, 1,
      1.018, 1.012, 1.022,
      1, 1, 1,
      1.018, 1.012, 1.022,
      1, 1, 1,
    ]),
    new THREE.QuaternionKeyframeTrack('Head.quaternion', idleTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, 0.04, 0.015)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.02, -0.03, -0.01)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.01, -0.05, -0.015)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.015, 0.03, 0.01)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, 0.04, 0.015)).toArray(),
    ]),
    new THREE.QuaternionKeyframeTrack('RightShoulder.quaternion', idleTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0, -0.14)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, -0.17)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0, -0.14)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0, -0.12)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0, -0.14)).toArray(),
    ]),
    new THREE.QuaternionKeyframeTrack('RightElbow.quaternion', idleTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.28, 0, 0.05)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.32, 0, 0.08)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.28, 0, 0.05)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, 0, 0.04)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.28, 0, 0.05)).toArray(),
    ]),
    new THREE.QuaternionKeyframeTrack('LeftShoulder.quaternion', idleTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, 0, 0.14)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04, 0, 0.12)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0, 0.16)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0, 0.13)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, 0, 0.14)).toArray(),
    ]),
    new THREE.QuaternionKeyframeTrack('LeftElbow.quaternion', idleTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.24, 0, -0.05)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22, 0, -0.04)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.28, 0, -0.07)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22, 0, -0.04)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.24, 0, -0.05)).toArray(),
    ]),
    // Natural eye blink
    new THREE.QuaternionKeyframeTrack('EyelidLeft.quaternion', blinkTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.78, 0, 0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.78, 0, 0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.78, 0, 0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.78, 0, 0)).toArray(),
    ]),
    new THREE.QuaternionKeyframeTrack('EyelidRight.quaternion', blinkTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.78, 0, 0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.78, 0, 0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.78, 0, 0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.78, 0, 0)).toArray(),
    ]),
  ];
  const idleClip = new THREE.AnimationClip('Idle', 4.0, idleTracks);

  // 2. ReachGift (1.6s): Acknowledge -> Turn toward gift (+X) -> Reach right arm gracefully toward gift box
  const reachTimes = [0, 0.35, 0.8, 1.3, 1.6];
  const reachTracks = [
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', reachTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, 0.0, 0.0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, -0.12, -0.03)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.10, -0.26, -0.08)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, -0.22, -0.06)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, -0.18, -0.04)).toArray(),
    ]),
    new THREE.QuaternionKeyframeTrack('Head.quaternion', reachTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.0, 0.0, 0.0)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0.06, 0.0)).toArray(), // warm nod
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, -0.24, -0.04)).toArray(), // look toward gift
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, -0.22, -0.03)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04, -0.18, -0.02)).toArray(),
    ]),
    new THREE.QuaternionKeyframeTrack('RightShoulder.quaternion', reachTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0, -0.14)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.32, 0.18, 0.32)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.62, 0.34, 0.68)).toArray(), // reaching toward gift
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.52, 0.28, 0.56)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.42, 0.20, 0.44)).toArray(),
    ]),
    new THREE.QuaternionKeyframeTrack('RightElbow.quaternion', reachTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.28, 0, 0.05)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.45, 0, 0.10)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0, 0.04)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22, 0, 0.04)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.26, 0, 0.04)).toArray(),
    ]),
    new THREE.QuaternionKeyframeTrack('LeftShoulder.quaternion', reachTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, 0, 0.14)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.10, 0, 0.20)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.14, 0, 0.26)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.10, 0, 0.22)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.06, 0, 0.18)).toArray(),
    ]),
  ];
  const reachClip = new THREE.AnimationClip('ReachGift', 1.6, reachTracks);

  // 3. Celebrate (2.4s looping gentle present-admiring cheer while box is open)
  const celTimes = [0, 0.8, 1.6, 2.4];
  const celTracks = [
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', celTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, -0.16, -0.02)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, -0.10, 0.02)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, -0.18, -0.02)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, -0.16, -0.02)).toArray(),
    ]),
    new THREE.QuaternionKeyframeTrack('Head.quaternion', celTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, -0.14, -0.02)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.04, 0.04, 0.03)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, -0.16, -0.02)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, -0.14, -0.02)).toArray(),
    ]),
    new THREE.QuaternionKeyframeTrack('RightShoulder.quaternion', celTimes, [
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0.18, 0.35)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.46, 0.22, 0.44)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0.18, 0.35)).toArray(),
      ...new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0.18, 0.35)).toArray(),
    ]),
  ];
  const celebrateClip = new THREE.AnimationClip('Celebrate', 2.4, celTracks);

  return { root, animations: [idleClip, reachClip, celebrateClip] };
}

function countStats(root) {
  let meshes = 0;
  let triangles = 0;
  const nodes = [];
  root.traverse((obj) => {
    if (obj.name) nodes.push(obj.name);
    if (obj.isMesh && obj.geometry) {
      meshes++;
      const geo = obj.geometry;
      if (geo.index) {
        triangles += geo.index.count / 3;
      } else if (geo.attributes.position) {
        triangles += geo.attributes.position.count / 3;
      }
    }
  });
  return { meshes, triangles: Math.round(triangles), nodes };
}

async function main() {
  const { root, animations } = buildSantaScene();
  const stats = countStats(root);

  const exporter = new GLTFExporter();
  const glbBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      root,
      (result) => resolve(result),
      (err) => reject(err),
      { binary: true, animations }
    );
  });

  const outPath = path.resolve(process.cwd(), 'public/assets/models/santa.glb');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const nodeBuf = Buffer.from(glbBuffer);
  fs.writeFileSync(outPath, nodeBuf);

  console.log('Generated:', outPath);
  console.log('File size (bytes):', nodeBuf.byteLength, `(${(nodeBuf.byteLength / 1024).toFixed(1)} KB)`);
  console.log('Meshes:', stats.meshes, 'Triangles:', stats.triangles);
  console.log('Named Nodes:', stats.nodes.join(', '));
  console.log('Animation Clips:', animations.map((a) => `${a.name} (${a.duration}s, ${a.tracks.length} tracks)`).join(' | '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
