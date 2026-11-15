import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildResolvedSpinPlan,
  countPegBoundaryCrossings,
  evaluateLaunchPhase,
  evaluateResolvedSpinAngle,
  getSegmentCenterModulo,
  SPIN_DECEL_EXPONENT,
  SPIN_NOMINAL_EXTRA_TURNS,
  SPIN_TOTAL_DURATION_MS,
  SpinLaunchState,
} from '../src/lib/winterSpinPhysics';

function runSpinCurveTests() {
  const segmentCount = 8;
  const sliceDeg = 360 / segmentCount;

  // 1. Verify instant launch movement at first frame (16ms)
  const launch: SpinLaunchState = {
    startAngle: 17.5,
    nominalDelta: SPIN_NOMINAL_EXTRA_TURNS * 360,
    durationMs: SPIN_TOTAL_DURATION_MS,
    exponent: SPIN_DECEL_EXPONENT,
  };
  const frame1 = evaluateLaunchPhase(launch, 16);
  assert(frame1.angle > launch.startAngle, 'Wheel must start moving immediately on first frame');
  assert(frame1.velocityDegPerMs > 0.9, 'Initial angular velocity should feel snappy');

  // 2. Verify C1 continuity, 8s milestones (0-5s ~90%, 5-7s gradual, 7-8s crawl), exact center landing, zero overshoot
  for (let segIdx = 0; segIdx < segmentCount; segIdx++) {
    for (const resolvedAtMs of [80, 240, 750, 1800]) {
      const plan = buildResolvedSpinPlan({
        launch,
        resolvedAtMs,
        segmentIndex: segIdx,
        segmentCount,
        reducedMotion: false,
      });

      assert.equal(plan.endAtMs, SPIN_TOTAL_DURATION_MS, 'Total duration must equal 8000ms for prompt API responses');

      // Check C1 continuity across resolvedAtMs
      const justBefore = evaluateLaunchPhase(launch, resolvedAtMs);
      const justAfter = evaluateResolvedSpinAngle(plan, resolvedAtMs);
      assert(Math.abs(justBefore.angle - justAfter.angle) < 1e-6, 'Angle must be continuous at API resolution');

      // Check milestones
      const totalTravel = plan.targetAngle - launch.startAngle;
      const at5s = evaluateResolvedSpinAngle(plan, 5000).angle - launch.startAngle;
      const at7s = evaluateResolvedSpinAngle(plan, 7000).angle - launch.startAngle;
      const at7_5s = evaluateResolvedSpinAngle(plan, 7500).angle - launch.startAngle;
      const at8s = evaluateResolvedSpinAngle(plan, 8000);

      const frac5s = at5s / totalTravel;
      const frac7s = at7s / totalTravel;
      const finalSecondDeg = (at8s.angle - launch.startAngle) - at7s;
      const finalHalfSecDeg = (at8s.angle - launch.startAngle) - at7_5s;

      assert(frac5s >= 0.88 && frac5s <= 0.94, `Expected ~90% travel by 5s, got ${(frac5s * 100).toFixed(2)}%`);
      assert(frac7s >= 0.985 && frac7s <= 0.997, `Expected ~99% travel by 7s, got ${(frac7s * 100).toFixed(2)}%`);
      assert(finalSecondDeg > 5 && finalSecondDeg <= 35, `Expected slow crawl in 7-8s, got ${finalSecondDeg.toFixed(2)} deg`);
      assert(finalHalfSecDeg <= 8, `Expected barely perceptible final 0.5s, got ${finalHalfSecDeg.toFixed(2)} deg`);

      // Monotonicity (zero overshoot / zero backward bounce)
      let prev = launch.startAngle;
      for (let t = resolvedAtMs; t <= 8100; t += 20) {
        const cur = evaluateResolvedSpinAngle(plan, t).angle;
        assert(cur >= prev - 1e-9, `Angle decreased from ${prev} to ${cur} at t=${t}`);
        assert(cur <= plan.targetAngle + 1e-9, `Overshoot detected: ${cur} > ${plan.targetAngle}`);
        prev = cur;
      }

      // Exact center-of-slice landing
      assert.equal(at8s.finished, true);
      assert.equal(at8s.angle, plan.targetAngle);
      const finalMod = ((at8s.angle % 360) + 360) % 360;
      const expectedMod = getSegmentCenterModulo(segIdx, segmentCount);
      assert(
        Math.abs(finalMod - expectedMod) < 1e-7,
        `Segment ${segIdx}: expected mod ${expectedMod}, got ${finalMod}`
      );

      // Verify pointer sits at exact center of segIdx
      const pointerWheelAngle = ((360 - finalMod) % 360 + 360) % 360;
      const expectedCenter = segIdx * sliceDeg + sliceDeg / 2;
      assert(Math.abs(pointerWheelAngle - expectedCenter) < 1e-7);
    }
  }

  // 3. Verify peg boundary crossing detector
  assert.equal(countPegBoundaryCrossings(10, 44.9, 8), 0);
  assert.equal(countPegBoundaryCrossings(44.9, 45.1, 8), 1);
  assert.equal(countPegBoundaryCrossings(44.9, 136.0, 8), 3);
  console.log('✓ 8-second Spin Wheel physics & boundary tick tests passed');
}

function runSantaGlbAssetTests() {
  const glbPath = path.resolve(process.cwd(), 'public/assets/models/santa.glb');
  assert(fs.existsSync(glbPath), 'public/assets/models/santa.glb must exist');

  const buf = fs.readFileSync(glbPath);
  assert(buf.byteLength > 50_000 && buf.byteLength < 1_500_000, `Unexpected GLB size: ${buf.byteLength}`);
  assert.equal(buf.toString('ascii', 0, 4), 'glTF', 'Invalid GLB magic header');

  const jsonLen = buf.readUInt32LE(12);
  const jsonChunk = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const nodeNames = (jsonChunk.nodes || []).map((n: any) => n.name);
  const animNames = (jsonChunk.animations || []).map((a: any) => a.name);

  for (const requiredNode of ['SantaClaus', 'Head', 'EyelidLeft', 'EyelidRight', 'RightShoulder', 'RightElbow']) {
    assert(nodeNames.includes(requiredNode), `Missing required Santa node: ${requiredNode}`);
  }
  for (const requiredAnim of ['Idle', 'ReachGift', 'Celebrate']) {
    assert(animNames.includes(requiredAnim), `Missing required Santa AnimationClip: ${requiredAnim}`);
  }
  console.log(
    `✓ Santa GLB verified: ${(buf.byteLength / 1024).toFixed(1)} KB, ${jsonChunk.meshes.length} meshes, clips=[${animNames.join(', ')}]`
  );
}

runSpinCurveTests();
runSantaGlbAssetTests();
