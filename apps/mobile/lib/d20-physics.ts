import { D20_FACES, D20_VERTICES, rotate, type Vec3 } from '@/lib/d20';
import * as CANNON from 'cannon-es';

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// World units: die circumradius = 1 (about 12 mm), z up, camera looks straight down from CAMERA_Z.
export const CAMERA_Z = 14;
const CEILING_Z = 7;
// Felt-tray scale: Codrops/3d-dice use modest g so dice tumble instead of jitter.
const GRAVITY = 520;
const STEP = 1 / 120;
const MAX_THROW = 120;
const THROW_SCALE = 1.3;
const SOFT_THROW = 38;

export type Sim = {
  world: CANNON.World;
  die: CANNON.Body;
  px: number;
  halfW: number;
  halfH: number;
  restTime: number;
  stuckTime: number;
  nudges: number;
};

/** `previous` carries the die over a tray resize (e.g. rotation) so the face showing stays true. */
export function createSim(width: number, height: number, previous?: Sim): Sim {
  const px = Math.max(40, Math.min(80, Math.min(width, height) * 0.13));
  // Walls sit inside the visible edge: perspective draws the die's upper half larger than its footprint.
  const inset = (CAMERA_Z - 1.8) / CAMERA_Z;
  const halfW = (width / 2 / px) * inset;
  const halfH = (height / 2 / px) * inset;

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, -GRAVITY) });
  // Coulomb bound per substep; keep modest so wall scrapes don't eat a throw.
  world.frictionGravity = new CANNON.Vec3(0, 0, -GRAVITY * STEP);
  const solver = new CANNON.GSSolver();
  solver.iterations = 20;
  world.solver = solver;
  const dieMat = new CANNON.Material('die');
  const tableMat = new CANNON.Material('table');
  const wallMat = new CANNON.Material('wall');
  // Felt: high grip, low bounce (Codrops ~0.3 rest, 3d-dice friction ~0.8).
  world.addContactMaterial(
    new CANNON.ContactMaterial(dieMat, tableMat, {
      friction: 0.55,
      restitution: 0.28,
      contactEquationStiffness: 1e6,
      contactEquationRelaxation: 4,
    })
  );
  // Tray rim: bounce without pinball; soft contacts keep speed.
  world.addContactMaterial(
    new CANNON.ContactMaterial(dieMat, wallMat, {
      friction: 0.04,
      restitution: 0.6,
      contactEquationStiffness: 4e5,
      contactEquationRelaxation: 5,
    })
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
    linearDamping: 0.015,
    angularDamping: 0.06,
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

  return { world, die, px, halfW, halfH, restTime: 0, stuckTime: 0, nudges: 0 };
}

const rand = (spread: number) => (Math.random() * 2 - 1) * spread;

export function throwDie(die: CANNON.Body, vx: number, vy: number) {
  vx *= THROW_SCALE;
  vy *= THROW_SCALE;
  let speed = Math.hypot(vx, vy);
  // A tap or gentle release still rolls: pick a random direction.
  if (speed < 5) {
    const angle = Math.random() * Math.PI * 2;
    vx = Math.cos(angle) * SOFT_THROW;
    vy = Math.sin(angle) * SOFT_THROW;
    speed = SOFT_THROW;
  }
  const cap = Math.min(1, MAX_THROW / speed);
  die.wakeUp();
  die.velocity.set(vx * cap, vy * cap, 16 + Math.min(speed, MAX_THROW) * 0.32);
  // Spin as if rolling off the finger, plus a random tumble so repeated flicks differ.
  die.angularVelocity.set(
    -vy * cap * 1.1 + rand(18),
    vx * cap * 1.1 + rand(18),
    rand(12)
  );
}

const REST_SPEED = 0.85;
const REST_SECONDS = 0.4;
const NUDGE_SECONDS = 0.5;
// A hop of about half a die height: enough to tip a die propped against a wall.
const NUDGE_HOP = Math.sqrt(2 * GRAVITY * 0.6);
const MAX_NUDGES = 8;
// Contact jitter must never keep the die alive forever.
const GIVE_UP_SECONDS = 5;

/** Advance the world; returns true on the frame the die comes to rest flat on a face. */
export function stepSim(sim: Sim, dt: number): boolean {
  const { die } = sim;
  if (die.sleepState === CANNON.Body.SLEEPING) return false;
  sim.world.step(STEP, dt, 8);
  const v = die.velocity.length();
  const w = die.angularVelocity.length();
  const flat = D20_FACES.some((f) => rotate(die.quaternion, f.normal)[2] > 0.995);
  sim.restTime = v < REST_SPEED && w < REST_SPEED ? sim.restTime + dt : 0;
  // Wedged against a wall the die jitters and is never truly still, so judge "stuck" more loosely.
  const crawling = v < REST_SPEED * 3 && w < REST_SPEED * 3;
  sim.stuckTime = flat || !crawling ? 0 : sim.stuckTime + dt;
  if (sim.stuckTime > NUDGE_SECONDS && sim.nudges < MAX_NUDGES) {
    // A real die never balances cocked: hop it toward the tray centre so it falls onto a face.
    const { x, y } = die.position;
    const len = Math.hypot(x, y) || 1;
    const push = NUDGE_HOP * 0.4;
    die.velocity.set((-x / len) * push, (-y / len) * push, NUDGE_HOP);
    die.angularVelocity.set(
      (-y / len) * 12 + rand(3),
      (x / len) * 12 + rand(3),
      rand(2)
    );
    sim.restTime = 0;
    sim.stuckTime = 0;
    sim.nudges++;
    return false;
  }
  if (flat ? sim.restTime < REST_SECONDS : sim.stuckTime < GIVE_UP_SECONDS)
    return false;
  die.velocity.setZero();
  die.angularVelocity.setZero();
  sim.restTime = 0;
  sim.stuckTime = 0;
  sim.nudges = 0;
  die.sleep();
  return true;
}
