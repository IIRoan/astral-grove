import { D20_FACES, D20_VERTICES, rotate, type Vec3 } from '@/lib/d20';
import * as CANNON from 'cannon-es';

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// World units: die circumradius = 1 (about 12 mm), z up, camera looks straight down from CAMERA_Z.
export const CAMERA_Z = 14;
const CEILING_Z = 7;
// Real gravity at this scale is ~820 (9.81 m/s² over 12 mm); a little less keeps the hops readable on a phone.
const GRAVITY = 600;
const MAX_THROW = 90;

export type Sim = {
  world: CANNON.World;
  die: CANNON.Body;
  px: number;
  halfW: number;
  halfH: number;
  restTime: number;
};

/** `previous` carries the die over a tray resize (e.g. rotation) so the face showing stays true. */
export function createSim(width: number, height: number, previous?: Sim): Sim {
  const px = Math.max(40, Math.min(80, Math.min(width, height) * 0.13));
  // Walls sit inside the visible edge: perspective draws the die's upper half larger than its footprint.
  const inset = (CAMERA_Z - 1.8) / CAMERA_Z;
  const halfW = (width / 2 / px) * inset;
  const halfH = (height / 2 / px) * inset;

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, -GRAVITY) });
  const solver = new CANNON.GSSolver();
  solver.iterations = 20;
  world.solver = solver;
  const dieMat = new CANNON.Material('die');
  const tableMat = new CANNON.Material('table');
  const wallMat = new CANNON.Material('wall');
  // Resin on a felt-lined tray: grips a little, bounces a little.
  world.addContactMaterial(
    new CANNON.ContactMaterial(dieMat, tableMat, { friction: 0.4, restitution: 0.3 })
  );
  // Near-frictionless walls so a die never rests propped up against the side.
  world.addContactMaterial(
    new CANNON.ContactMaterial(dieMat, wallMat, { friction: 0.05, restitution: 0.45 })
  );

  const addPlane = (pos: Vec3, axis: Vec3, angle: number, material = wallMat) => {
    const body = new CANNON.Body({
      mass: 0,
      material,
      shape: new CANNON.Plane(),
    });
    body.position.set(...pos);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(...axis), angle);
    world.addBody(body);
  };
  addPlane([0, 0, 0], [1, 0, 0], 0, tableMat);
  addPlane([-halfW, 0, 0], [0, 1, 0], Math.PI / 2);
  addPlane([halfW, 0, 0], [0, 1, 0], -Math.PI / 2);
  addPlane([0, -halfH, 0], [1, 0, 0], -Math.PI / 2);
  addPlane([0, halfH, 0], [1, 0, 0], Math.PI / 2);
  addPlane([0, 0, CEILING_Z], [1, 0, 0], Math.PI);

  const die = new CANNON.Body({
    mass: 1,
    material: dieMat,
    shape: new CANNON.ConvexPolyhedron({
      vertices: D20_VERTICES.map((v) => new CANNON.Vec3(...v)),
      faces: D20_FACES.map((f) => f.indices),
    }),
    linearDamping: 0.03,
    angularDamping: 0.1,
    // Settling is decided by stepSim: cannon's own sleep can freeze the die balanced on an edge.
    allowSleep: false,
  });
  // Start at rest in the middle with 20 up; only a throw ever wakes it.
  const top = D20_FACES.find((f) => f.value === 20)!;
  const [nx, ny, nz] = top.normal;
  die.quaternion.setFromAxisAngle(new CANNON.Vec3(ny, -nx, 0).unit(), Math.acos(nz));
  die.position.set(0, 0, dot(top.normal, top.centroid));
  world.addBody(die);
  if (previous && previous.die.sleepState !== CANNON.Body.SLEEPING) {
    // Mid-roll: drop it from the middle and let it settle again.
    die.quaternion.copy(previous.die.quaternion);
    die.position.z = 2;
  } else {
    if (previous) die.quaternion.copy(previous.die.quaternion);
    die.sleep();
  }
  // The renderer reads the interpolated pose, which only updates once the world steps.
  die.interpolatedPosition.copy(die.position);
  die.interpolatedQuaternion.copy(die.quaternion);

  return { world, die, px, halfW, halfH, restTime: 0 };
}

const rand = (spread: number) => (Math.random() * 2 - 1) * spread;

export function throwDie(die: CANNON.Body, vx: number, vy: number) {
  let speed = Math.hypot(vx, vy);
  // A tap or gentle release still rolls: pick a random direction.
  if (speed < 4) {
    const angle = Math.random() * Math.PI * 2;
    vx = Math.cos(angle) * 25;
    vy = Math.sin(angle) * 25;
    speed = 25;
  }
  const cap = Math.min(1, MAX_THROW / speed);
  die.wakeUp();
  die.velocity.set(vx * cap, vy * cap, 14 + Math.min(speed, MAX_THROW) * 0.25);
  // Spin as if rolling off the finger, plus a random tumble so repeated flicks differ.
  die.angularVelocity.set(
    -vy * cap * 0.8 + rand(12),
    vx * cap * 0.8 + rand(12),
    rand(8)
  );
}

const REST_SPEED = 1;
const REST_SECONDS = 0.25;
const NUDGE_SECONDS = 0.35;
// Contact jitter must never keep the die alive forever.
const GIVE_UP_SECONDS = 3;

/** Advance the world; returns true on the frame the die comes to rest flat on a face. */
export function stepSim(sim: Sim, dt: number): boolean {
  const { die } = sim;
  if (die.sleepState === CANNON.Body.SLEEPING) return false;
  sim.world.step(1 / 120, dt, 8);
  const slow =
    die.velocity.length() < REST_SPEED && die.angularVelocity.length() < REST_SPEED;
  const flat = D20_FACES.some((f) => rotate(die.quaternion, f.normal)[2] > 0.995);
  sim.restTime = slow ? sim.restTime + dt : 0;
  if (!flat && slow && sim.restTime > NUDGE_SECONDS && sim.restTime < GIVE_UP_SECONDS) {
    // A real die never balances cocked: tip it toward the tray centre so it falls onto a face.
    const { x, y } = die.position;
    const len = Math.hypot(x, y) || 1;
    die.velocity.set((-x / len) * 4, (-y / len) * 4, 6);
    die.angularVelocity.set((-y / len) * 10 + rand(2), (x / len) * 10 + rand(2), 0);
    sim.restTime = 0;
    return false;
  }
  if (sim.restTime < (flat ? REST_SECONDS : GIVE_UP_SECONDS)) return false;
  sim.restTime = 0;
  die.sleep();
  return true;
}
