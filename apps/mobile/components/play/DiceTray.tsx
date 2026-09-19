import { XIcon } from '@/components/icons';
import { Button, ButtonText } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { D20_MODEL_RADIUS, topFaceValue } from '@/lib/d20';
import { CAMERA_Z, createSim, stepSim, throwDie, type Sim } from '@/lib/d20-physics';
import { hapticPress } from '@/utils/haptics';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as CANNON from 'cannon-es';
import { Asset } from 'expo-asset';
import { File as ExpoFile } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Platform, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useCSSVariable } from 'uniwind';

const HOLD_Z = 2.4;

type DieAssets = { geometry: THREE.BufferGeometry; texture: THREE.Texture };

// Mesh and number texture: see assets/models/README.md for provenance and license.
async function loadDieAssets(): Promise<DieAssets> {
  const [model, image] = await Promise.all([
    Asset.fromModule(require('@/assets/models/d20.glb')).downloadAsync(),
    Asset.fromModule(require('@/assets/models/d20-diffuse.png')).downloadAsync(),
  ]);
  const modelUri = model.localUri ?? model.uri;
  const buffer =
    Platform.OS === 'web'
      ? await (await fetch(modelUri)).arrayBuffer()
      : await new ExpoFile(modelUri).arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  const mesh = meshes[0];
  if (!mesh) throw new Error('d20.glb has no mesh');
  // On native @react-three/fiber patches TextureLoader to read file:// URIs through expo-gl.
  const texture = await new THREE.TextureLoader().loadAsync(
    image.localUri ?? image.uri
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  return { geometry: mesh.geometry, texture };
}

type DiceTrayProps = { onClose: () => void };

export function DiceTray({ onClose }: DiceTrayProps) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [sim, setSim] = useState<Sim | null>(null);
  const [assets, setAssets] = useState<DieAssets | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const thrown = useRef(false);
  const panelRaw = useCSSVariable('--color-card-panel');
  const panel = String(panelRaw ?? '#1c1c1c');

  useEffect(() => {
    let live = true;
    loadDieAssets().then(
      (loaded) => live && setAssets(loaded),
      () => live && setLoadFailed(true)
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!sim || Platform.OS === 'web') return;
    let lastBump = 0;
    const onCollide = (e: { contact: CANNON.ContactEquation }) => {
      const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
      const now = Date.now();
      if (impact < 12 || now - lastBump < 70) return;
      lastBump = now;
      void Haptics.impactAsync(
        impact > 45
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => {});
    };
    sim.die.addEventListener('collide', onCollide);
    return () => {
      sim.die.removeEventListener('collide', onCollide);
    };
  }, [sim]);

  const onSettled = (value: number) => {
    if (!thrown.current) return;
    thrown.current = false;
    setResult(value);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    }
  };

  const toTray = (x: number, y: number) =>
    size ? { x: x - size.width / 2, y: y - size.height / 2 } : { x: 0, y: 0 };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => {
      if (!sim) return;
      const touch = toTray(e.x, e.y);
      const k = (CAMERA_Z / (CAMERA_Z - sim.die.position.z)) * sim.px;
      const dx = touch.x - sim.die.position.x * k;
      const dy = touch.y + sim.die.position.y * k;
      // Only a touch on (or right next to) the die picks it up.
      if (Math.hypot(dx, dy) > k * 1.8) return;
      drag.current = touch;
      sim.die.wakeUp();
      sim.restTime = 0;
      setResult(null);
    })
    .onUpdate((e) => {
      if (drag.current) drag.current = toTray(e.x, e.y);
    })
    .onFinalize((e) => {
      if (!sim || !drag.current) return;
      drag.current = null;
      thrown.current = true;
      throwDie(sim.die, e.velocityX / sim.px, -e.velocityY / sim.px);
    });

  const rollFromButton = () => {
    if (!sim) return;
    void hapticPress();
    setResult(null);
    thrown.current = true;
    sim.restTime = 0;
    sim.die.position.z = Math.max(sim.die.position.z, 2);
    throwDie(sim.die, 0, 0);
  };

  return (
    <View
      className="absolute inset-0 z-50 bg-background"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <View className="flex-row items-center justify-between px-3 py-2">
        <Text className="text-base font-semibold text-foreground">Roll a d20</Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Close dice tray"
          onPress={onClose}
          className="size-10 items-center justify-center rounded-[3px] border border-border bg-background"
          contentClassName="items-center justify-center"
        >
          <XIcon size={18} className="text-foreground" />
        </PressableScale>
      </View>

      <GestureDetector gesture={pan}>
        <View
          className="mx-3 flex-1 overflow-hidden rounded-[3px] border border-border bg-card-panel"
          onLayout={(e: LayoutChangeEvent) => {
            const { width, height } = e.nativeEvent.layout;
            if (
              !size ||
              Math.abs(size.width - width) > 1 ||
              Math.abs(size.height - height) > 1
            ) {
              setSize({ width, height });
              setSim((prev) => createSim(width, height, prev ?? undefined));
            }
          }}
          accessibilityLabel="Dice tray. Drag and release the die to throw it."
        >
          {/* The canvas ignores touches so the pan gesture above owns them on every platform. */}
          <View pointerEvents="none" className="flex-1">
            {sim && size && assets ? (
              <Canvas
                style={{ flex: 1 }}
                shadows
                camera={{ position: [0, 0, CAMERA_Z], near: 1, far: 40 }}
              >
                <TrayView px={sim.px} height={size.height} background={panel} />
                <hemisphereLight
                  args={['#ffffff', '#6b6b6b', 0.9]}
                  position={[0, 0, 1]}
                />
                <directionalLight
                  position={[-5, 6, 12]}
                  intensity={2.2}
                  castShadow
                  shadow-mapSize={[1024, 1024]}
                  shadow-bias={-0.0005}
                  shadow-camera-left={-12}
                  shadow-camera-right={12}
                  shadow-camera-top={12}
                  shadow-camera-bottom={-12}
                  shadow-camera-far={30}
                />
                <mesh receiveShadow>
                  <planeGeometry args={[60, 60]} />
                  <shadowMaterial opacity={0.4} />
                </mesh>
                <Die sim={sim} assets={assets} drag={drag} onSettled={onSettled} />
              </Canvas>
            ) : loadFailed ? (
              <Text className="p-4 text-sm text-muted-foreground">
                The die could not be loaded.
              </Text>
            ) : null}
          </View>
        </View>
      </GestureDetector>

      <View className="h-16 flex-row items-center gap-3 px-3">
        <View className="min-w-0 flex-1" accessibilityLiveRegion="polite">
          {result !== null ? (
            <Text className="text-3xl font-bold text-foreground">
              You rolled {result}
            </Text>
          ) : (
            <Text className="text-sm text-muted-foreground" numberOfLines={2}>
              Drag the die and throw it, or tap Roll
            </Text>
          )}
        </View>
        <Button className="w-auto px-8" onPress={rollFromButton}>
          <ButtonText>Roll</ButtonText>
        </Button>
      </View>
    </View>
  );
}

const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

/** Matches the perspective camera to the physics scale (px per world unit at the table) and paints the tray. */
function TrayView({
  px,
  height,
  background,
}: {
  px: number;
  height: number;
  background: string;
}) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.fov = (2 * Math.atan(height / 2 / px / CAMERA_Z) * 180) / Math.PI;
    camera.updateProjectionMatrix();
  }, [camera, height, px]);
  useEffect(() => {
    scene.background = new THREE.Color(background);
  }, [scene, background]);
  return null;
}

function Die({
  sim,
  assets,
  drag,
  onSettled,
}: {
  sim: Sim;
  assets: DieAssets;
  drag: RefObject<{ x: number; y: number } | null>;
  onSettled: (value: number) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  // Glossy resin with the numbers inked into the diffuse map.
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: assets.texture,
        roughness: 0.4,
        metalness: 0,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
      }),
    [assets.texture]
  );

  useFrame((_, delta) => {
    const { die } = sim;
    const dt = Math.min(delta, 1 / 20);
    const held = drag.current;
    if (held) {
      // Spring the die toward the finger, lifted off the table, tumbling as it moves.
      const k = CAMERA_Z / (CAMERA_Z - HOLD_Z);
      const tx = clamp(held.x / (sim.px * k), sim.halfW - 1.4);
      const ty = clamp(-held.y / (sim.px * k), sim.halfH - 1.4);
      const vx = (tx - die.position.x) * 20;
      const vy = (ty - die.position.y) * 20;
      die.velocity.set(vx, vy, (HOLD_Z - die.position.z) * 14);
      die.angularVelocity.set(-vy * 0.3, vx * 0.3, die.angularVelocity.z * 0.9);
    }
    if (die.sleepState !== CANNON.Body.SLEEPING) {
      const settled = stepSim(sim, dt);
      if (settled && !drag.current) onSettled(topFaceValue(die.quaternion));
    }
    const mesh = ref.current;
    if (!mesh) return;
    const p = die.interpolatedPosition;
    const q = die.interpolatedQuaternion;
    mesh.position.set(p.x, p.y, p.z);
    mesh.quaternion.set(q.x, q.y, q.z, q.w);
  });

  return (
    <mesh
      ref={ref}
      geometry={assets.geometry}
      material={material}
      castShadow
      scale={1 / D20_MODEL_RADIUS}
    />
  );
}
