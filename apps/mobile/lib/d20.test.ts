import { describe, expect, test } from 'bun:test';
import { D20_FACES, D20_VERTICES, rotate, topFaceValue } from '@/lib/d20';

const dot = (a: readonly number[], b: readonly number[]) =>
  a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

describe('d20', () => {
  test('has 20 faces numbered 1–20 with opposite faces summing to 21', () => {
    expect(D20_FACES.map((f) => f.value).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1)
    );
    for (const face of D20_FACES) {
      const opposite = D20_FACES.find((f) => dot(f.normal, face.normal) < -0.99)!;
      expect(face.value + opposite.value).toBe(21);
    }
  });

  test('is a convex hull at circumradius 1 wound counter-clockwise from outside', () => {
    for (const v of D20_VERTICES) expect(Math.hypot(...v)).toBeCloseTo(1, 2);
    for (const face of D20_FACES) {
      expect(dot(face.normal, face.centroid)).toBeGreaterThan(0.78);
      // Every other vertex lies behind the face plane.
      for (const v of D20_VERTICES)
        expect(dot(face.normal, v) - dot(face.normal, face.centroid)).toBeLessThan(
          1e-6
        );
    }
  });

  test('reads whichever face is rotated to point up', () => {
    for (const face of D20_FACES) {
      const [nx, ny, nz] = face.normal;
      // Shortest-arc quaternion taking the face normal onto +z (no face normal is exactly ±z).
      const axis = [ny, -nx, 0];
      const len = Math.hypot(axis[0]!, axis[1]!);
      const half = Math.acos(nz) / 2;
      const s = Math.sin(half) / len;
      const q = { x: axis[0]! * s, y: axis[1]! * s, z: 0, w: Math.cos(half) };
      expect(rotate(q, face.normal)[2]).toBeCloseTo(1);
      expect(topFaceValue(q)).toBe(face.value);
    }
  });
});
