// Hull and numbering of assets/models/d20.glb (3d-dice "default" theme, see assets/models/README.md).
export type Vec3 = readonly [number, number, number];
export type D20Face = {
  /** Vertex indices, counter-clockwise seen from outside. */
  indices: [number, number, number];
  /** Outward unit normal in body space. */
  normal: Vec3;
  centroid: Vec3;
  value: number;
};

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Circumradius of the mesh in its own units; scale the model by 1 / this to match physics. */
export const D20_MODEL_RADIUS = 0.116274;

/** Collider vertices at circumradius 1. Slightly irregular: they trace the sculpted mesh, not an ideal icosahedron. */
export const D20_VERTICES: Vec3[] = [
  [-0.00344, -0.787795, 0.609767],
  [-0.522903, -0.794676, -0.296713],
  [0.516023, -0.797256, -0.305314],
  [0.520323, 0.792096, 0.308754],
  [0.841978, -0.192649, 0.496242],
  [0.848858, 0.178028, -0.491942],
  [-0.850578, -0.185768, 0.491942],
  [-0.0043, -0.196089, -0.977864],
  [-0.0043, 0.797256, -0.599447],
  [-0.00258, 0.180608, 0.981304],
  [-0.528064, 0.789515, 0.303594],
  [-0.848858, 0.180608, -0.491942],
];

// [a, b, c, value]: triangle counter-clockwise from outside, and the number painted on it.
const FACE_DATA: [number, number, number, number][] = [
  [0, 1, 2, 12],
  [3, 4, 5, 3],
  [1, 0, 6, 2],
  [1, 7, 2, 15],
  [8, 3, 5, 19],
  [6, 9, 10, 14],
  [6, 0, 9, 20],
  [2, 7, 5, 7],
  [9, 0, 4, 8],
  [11, 6, 10, 4],
  [3, 8, 10, 9],
  [5, 7, 8, 1],
  [7, 11, 8, 13],
  [9, 3, 10, 6],
  [0, 2, 4, 10],
  [11, 1, 6, 18],
  [1, 11, 7, 5],
  [11, 10, 8, 11],
  [4, 2, 5, 17],
  [3, 9, 4, 16],
];

export const D20_FACES: D20Face[] = FACE_DATA.map(([a, b, c, value]) => {
  const va = D20_VERTICES[a]!;
  const vb = D20_VERTICES[b]!;
  const vc = D20_VERTICES[c]!;
  return {
    indices: [a, b, c],
    normal: normalize(cross(sub(vb, va), sub(vc, va))),
    centroid: [
      (va[0] + vb[0] + vc[0]) / 3,
      (va[1] + vb[1] + vc[1]) / 3,
      (va[2] + vb[2] + vc[2]) / 3,
    ],
    value,
  };
});

/** Rotate a body-space vector by quaternion (x, y, z, w). */
export function rotate(
  q: { x: number; y: number; z: number; w: number },
  v: Vec3
): Vec3 {
  const { x, y, z, w } = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}

/** The face pointing most toward +z (up). */
export function topFace(q: { x: number; y: number; z: number; w: number }): D20Face {
  let best = D20_FACES[0]!;
  let bestZ = -Infinity;
  for (const face of D20_FACES) {
    const z = rotate(q, face.normal)[2];
    if (z > bestZ) {
      bestZ = z;
      best = face;
    }
  }
  return best;
}

/** The value on the face pointing most toward +z (up). */
export function topFaceValue(q: {
  x: number;
  y: number;
  z: number;
  w: number;
}): number {
  return topFace(q).value;
}
