import { describe, expect, test } from 'bun:test';
import { D20_FACES, topFaceValue } from '@/lib/d20';
import { createSim, stepSim, throwDie } from '@/lib/d20-physics';

const top = D20_FACES.find((f) => f.value === 20)!;
// Resting flat, the die centre sits one inradius above the table.
const INRADIUS =
  top.normal[0] * top.centroid[0] +
  top.normal[1] * top.centroid[1] +
  top.normal[2] * top.centroid[2];

describe('d20 physics', () => {
  test('a fresh die rests flat showing 20 and never moves on its own', () => {
    const sim = createSim(390, 600);
    const start = sim.die.position.clone();
    for (let i = 0; i < 600; i++) expect(stepSim(sim, 1 / 60)).toBe(false);
    expect(sim.die.position.distanceTo(start)).toBe(0);
    expect(topFaceValue(sim.die.quaternion)).toBe(20);
    expect(start.z).toBeCloseTo(INRADIUS, 3);
    expect(sim.die.interpolatedPosition.distanceTo(start)).toBe(0);
  });

  test('a hard throw stays in the tray and settles on a face', () => {
    for (let run = 0; run < 20; run++) {
      const sim = createSim(390, 600);
      throwDie(sim.die, 90 * (Math.random() - 0.5), 90 * (Math.random() - 0.5));
      let t = 0;
      while (!stepSim(sim, 1 / 60) && t < 20) {
        t += 1 / 60;
        const { x, y, z } = sim.die.position;
        expect(Math.abs(x)).toBeLessThan(sim.halfW);
        expect(Math.abs(y)).toBeLessThan(sim.halfH);
        expect(z).toBeGreaterThan(0);
      }
      expect(t).toBeLessThan(20);
      expect(sim.die.position.z).toBeCloseTo(INRADIUS, 1);
      expect(t).toBeGreaterThan(0.4);
      expect(topFaceValue(sim.die.quaternion)).toBeGreaterThanOrEqual(1);
    }
  });

  test('a wall hit keeps most of the throw speed', () => {
    const sim = createSim(390, 600);
    const { die } = sim;
    die.wakeUp();
    die.position.set(sim.halfW - 1.6, 0, 3.2);
    die.velocity.set(55, 0, 4);
    die.angularVelocity.set(0, 20, 0);
    let bounced = false;
    for (let i = 0; i < 180; i++) {
      stepSim(sim, 1 / 60);
      if (die.velocity.x < 0) {
        bounced = true;
        expect(Math.abs(die.velocity.x)).toBeGreaterThan(18);
        break;
      }
    }
    expect(bounced).toBe(true);
  });

  test('every face comes up over many throws', () => {
    const seen = new Set<number>();
    for (let run = 0; run < 300; run++) {
      const sim = createSim(390, 600);
      throwDie(sim.die, 80 * (Math.random() - 0.5), 80 * (Math.random() - 0.5));
      let t = 0;
      while (!stepSim(sim, 1 / 60) && t < 20) t += 1 / 60;
      seen.add(topFaceValue(sim.die.quaternion));
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1)
    );
  });

  test('a resize keeps the face that is showing', () => {
    const sim = createSim(390, 600);
    throwDie(sim.die, 30, -20);
    let t = 0;
    while (!stepSim(sim, 1 / 60) && t < 20) t += 1 / 60;
    const shown = topFaceValue(sim.die.quaternion);
    const rotated = createSim(600, 390, sim);
    expect(topFaceValue(rotated.die.quaternion)).toBe(shown);
    for (let i = 0; i < 120; i++) expect(stepSim(rotated, 1 / 60)).toBe(false);
  });
});
