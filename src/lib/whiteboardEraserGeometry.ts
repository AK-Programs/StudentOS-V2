/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Geometric Stroke Cutting & Collision Engine for StudentOS Whiteboard Erasers
 * Strictly implements analytical circle-segment intersection, geometric slicing,
 * tiny-fragment removal, and segment-distance collision.
 * Zero painting over. Zero fake black strokes. Zero 45px hardcodes.
 */

import { LineObj } from '../components/Whiteboard2';

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Calculates Euclidean distance between two 2D points
 */
export function distance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Calculates minimum distance from a point C to a line segment P1 -> P2
 */
export function distanceToSegment(c: Point2D, p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-9) {
    return distance(c, p1);
  }

  // Projection scalar t along segment [0, 1]
  const t = ((c.x - p1.x) * dx + (c.y - p1.y) * dy) / lenSq;
  const clampedT = Math.max(0, Math.min(1, t));

  const projX = p1.x + clampedT * dx;
  const projY = p1.y + clampedT * dy;

  return Math.hypot(c.x - projX, c.y - projY);
}

/**
 * Checks if an eraser circle (center C, radius R) intersects ANY segment of a stroke line
 */
export function doesCircleIntersectStroke(
  points: number[],
  cx: number,
  cy: number,
  radius: number
): boolean {
  if (!points || points.length < 2) return false;

  const center: Point2D = { x: cx, y: cy };

  // Single-point or degenerated stroke
  if (points.length === 2) {
    return distance(center, { x: points[0], y: points[1] }) <= radius;
  }

  for (let i = 0; i < points.length - 2; i += 2) {
    const p1: Point2D = { x: points[i], y: points[i + 1] };
    const p2: Point2D = { x: points[i + 2], y: points[i + 3] };

    if (distanceToSegment(center, p1, p2) <= radius) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates the total length of a polyline given as [x0, y0, x1, y1, ...]
 */
export function calculatePolylineLength(points: number[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 2; i += 2) {
    len += Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
  }
  return len;
}

interface SegmentCutResult {
  hasCut: boolean;
  // Sub-intervals along t in [0, 1] that are OUTSIDE the circle
  outsideIntervals: [number, number][];
}

/**
 * Analytically intersects line segment P1 -> P2 with circle (center C, radius R).
 * Returns the portions of the segment (in parameter t ∈ [0, 1]) that lie OUTSIDE the circle.
 */
function cutSegmentWithCircle(
  p1: Point2D,
  p2: Point2D,
  c: Point2D,
  radius: number
): SegmentCutResult {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const fx = p1.x - c.x;
  const fy = p1.y - c.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const cCoeff = fx * fx + fy * fy - radius * radius;

  // Degenerate segment
  if (a < 1e-9) {
    const isInside = cCoeff <= 0;
    return {
      hasCut: isInside,
      outsideIntervals: isInside ? [] : [[0, 1]]
    };
  }

  const discriminant = b * b - 4 * a * cCoeff;

  // No intersection with the circle's boundary
  if (discriminant <= 0) {
    // Either the entire segment is inside or entirely outside
    const isInside = cCoeff < 0;
    return {
      hasCut: isInside,
      outsideIntervals: isInside ? [] : [[0, 1]]
    };
  }

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  const tEntry = Math.min(t1, t2);
  const tExit = Math.max(t1, t2);

  // Portion inside the circle along segment t ∈ [0, 1]
  const inStart = Math.max(0, tEntry);
  const inEnd = Math.min(1, tExit);

  // If the inside interval is empty or inverted, the entire segment is outside
  if (inStart >= inEnd) {
    return {
      hasCut: false,
      outsideIntervals: [[0, 1]]
    };
  }

  // The inside interval is non-empty -> it is cut!
  const outsideIntervals: [number, number][] = [];

  if (inStart > 1e-4) {
    outsideIntervals.push([0, inStart]);
  }
  if (inEnd < 1 - 1e-4) {
    outsideIntervals.push([inEnd, 1]);
  }

  return {
    hasCut: true,
    outsideIntervals
  };
}

const MIN_PIECE_LENGTH_PX = 3.5; // Threshold to drop tiny dots, micro-lines and accidental fragments

/**
 * Cuts a stroke with an eraser circle (cx, cy, radius).
 * Returns array of new line point arrays representing the remaining pieces.
 * If stroke is untouched, returns [originalPoints].
 * If stroke is completely erased, returns [].
 */
export function cutStrokeWithEraserCircle(
  originalPoints: number[],
  cx: number,
  cy: number,
  radius: number
): { modified: boolean; remainingPieces: number[][] } {
  if (!originalPoints || originalPoints.length < 4) {
    // If only 1 point, check if inside circle
    if (originalPoints && originalPoints.length === 2) {
      const isInside = Math.hypot(originalPoints[0] - cx, originalPoints[1] - cy) <= radius;
      return {
        modified: isInside,
        remainingPieces: isInside ? [] : [originalPoints]
      };
    }
    return { modified: false, remainingPieces: [originalPoints] };
  }

  // Quick bounding box + distance check: if stroke is nowhere near the circle, skip fast
  const center: Point2D = { x: cx, y: cy };
  let intersectsAny = false;
  for (let i = 0; i < originalPoints.length - 2; i += 2) {
    const p1: Point2D = { x: originalPoints[i], y: originalPoints[i + 1] };
    const p2: Point2D = { x: originalPoints[i + 2], y: originalPoints[i + 3] };
    if (distanceToSegment(center, p1, p2) <= radius) {
      intersectsAny = true;
      break;
    }
  }

  if (!intersectsAny) {
    return { modified: false, remainingPieces: [originalPoints] };
  }

  // Segment-by-segment analytical cutting
  const rawPieces: number[][] = [];
  let currentPiece: number[] = [];

  const startPoint = (p: Point2D) => {
    currentPiece = [p.x, p.y];
  };

  const appendPoint = (p: Point2D) => {
    if (currentPiece.length >= 2) {
      const lastX = currentPiece[currentPiece.length - 2];
      const lastY = currentPiece[currentPiece.length - 1];
      if (Math.hypot(p.x - lastX, p.y - lastY) > 0.5) {
        currentPiece.push(p.x, p.y);
      }
    } else {
      currentPiece.push(p.x, p.y);
    }
  };

  const closeCurrentPiece = () => {
    if (currentPiece.length >= 4) {
      rawPieces.push([...currentPiece]);
    }
    currentPiece = [];
  };

  for (let i = 0; i < originalPoints.length - 2; i += 2) {
    const p1: Point2D = { x: originalPoints[i], y: originalPoints[i + 1] };
    const p2: Point2D = { x: originalPoints[i + 2], y: originalPoints[i + 3] };

    const cut = cutSegmentWithCircle(p1, p2, center, radius);

    if (!cut.hasCut) {
      // Entire segment outside eraser
      if (currentPiece.length === 0) {
        startPoint(p1);
      }
      appendPoint(p2);
    } else {
      // Segment intersects or is partly inside eraser
      if (cut.outsideIntervals.length === 0) {
        // Entire segment inside eraser
        closeCurrentPiece();
      } else {
        for (const [tStart, tEnd] of cut.outsideIntervals) {
          const ptA: Point2D = {
            x: p1.x + tStart * (p2.x - p1.x),
            y: p1.y + tStart * (p2.y - p1.y)
          };
          const ptB: Point2D = {
            x: p1.x + tEnd * (p2.x - p1.x),
            y: p1.y + tEnd * (p2.y - p1.y)
          };

          if (tStart === 0 && currentPiece.length > 0) {
            appendPoint(ptB);
            if (tEnd < 1) {
              closeCurrentPiece();
            }
          } else {
            closeCurrentPiece();
            startPoint(ptA);
            appendPoint(ptB);
            if (tEnd < 1) {
              closeCurrentPiece();
            }
          }
        }
      }
    }
  }

  closeCurrentPiece();

  // Filter out pieces shorter than minimum threshold to drop accidental micro-dots
  const filteredPieces = rawPieces.filter((piece) => {
    return piece.length >= 4 && calculatePolylineLength(piece) >= MIN_PIECE_LENGTH_PX;
  });

  return {
    modified: true,
    remainingPieces: filteredPieces
  };
}

/**
 * Applies Stroke Eraser cut across an entire array of slide lines.
 * Returns the new array of lines and a boolean indicating whether any line was cut.
 */
export function applyStrokeEraserToLines(
  lines: LineObj[],
  cx: number,
  cy: number,
  brushSize: number
): { updatedLines: LineObj[]; hasModified: boolean } {
  // Use current brushSize as the actual collision radius
  const radius = Math.max(4, Number(brushSize) || 20);
  let hasModified = false;
  const newLines: LineObj[] = [];

  for (const line of lines) {
    // If the line was already created as a legacy eraser line, skip it
    if (line.tool === 'eraser') {
      hasModified = true;
      continue;
    }

    const cutResult = cutStrokeWithEraserCircle(line.points, cx, cy, radius);

    if (!cutResult.modified) {
      newLines.push(line);
    } else {
      hasModified = true;
      // Reconstruct pieces as independent valid lines
      for (let pIdx = 0; pIdx < cutResult.remainingPieces.length; pIdx++) {
        const piecePts = cutResult.remainingPieces[pIdx];
        newLines.push({
          ...line,
          id: `${line.id}_cut_${pIdx}_${Date.now()}`,
          points: piecePts
        });
      }
    }
  }

  return {
    updatedLines: newLines,
    hasModified
  };
}
