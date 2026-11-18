import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modules = process.argv[2];
assert.ok(modules, 'Pass the path to the game’s node_modules directory');
const dependency = path => pathToFileURL(resolve(modules, path)).href;
const { GLTFLoader } = await import(dependency('three/examples/jsm/loaders/GLTFLoader.js'));
const { AnimationMixer, Box3, Quaternion } = await import(dependency('three/build/three.module.js'));
const folder = new URL('./', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', folder), 'utf8'));
assert.equal(manifest.length, 9);
const loader = new GLTFLoader();

for (const asset of manifest) {
  const glb = await readFile(new URL(asset.glb, folder));
  const png = await readFile(new URL(asset.png, folder));
  for (const [extension, buffer] of Object.entries({ glb, png })) {
    assert.equal(createHash('sha256').update(buffer).digest('hex'), asset.sha256[extension]);
  }
  assert.equal(png.readUInt32BE(16), 384);
  assert.equal(png.readUInt32BE(20), 384);
  assert.equal(png[25], 6);
  const parsed = await loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  let triangles = 0;
  let meshes = 0;
  parsed.scene.traverse(object => {
    if (!object.isMesh) return;
    assert.ok(object.material.vertexColors);
    const position = object.geometry.attributes.position;
    const index = object.geometry.index;
    for (const value of index.array) assert.ok(value < position.count);
    triangles += index.count / 3;
    meshes++;
  });
  assert.equal(triangles, asset.triangles);
  assert.equal(meshes, asset.draw_calls);
  const bounds = new Box3().setFromObject(parsed.scene);
  for (const [corner, expected] of [[bounds.min, asset.world_bounds_min], [bounds.max, asset.world_bounds_max]]) {
    corner.toArray().forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < .001));
  }
  if (asset.asset === 'castle-gate') {
    // The ground-level opening must be unobstructed along the bridge's travel axis.
    const mesh = parsed.scene.getObjectByName('Gatehouse');
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      assert.ok(Math.abs(positions.getX(i)) >= .80 || positions.getY(i) >= 1.35);
    }
  }
  assert.equal(parsed.animations.length, Object.keys(asset.animations).length);
  for (const clip of parsed.animations) {
    assert.ok(Math.abs(clip.duration - asset.animations[clip.name]) < .001);
    const name = clip.name === 'WheelTurn' ? 'WaterWheel' : 'FrontFoot_L';
    const node = parsed.scene.getObjectByName(name);
    assert.ok(node);
    const initial = new Quaternion().copy(node.quaternion);
    const mixer = new AnimationMixer(parsed.scene);
    mixer.clipAction(clip).play();
    mixer.update(clip.duration * .25);
    assert.ok(node.quaternion.angleTo(initial) > .24, `${asset.asset} clip did not move ${name}`);
    mixer.update(clip.duration * .75);
    assert.ok(node.quaternion.angleTo(initial) < .001, `${asset.asset} clip did not loop to start`);
  }
  console.log(`${asset.asset} PASS | ${triangles} triangles | ${meshes} meshes | ${parsed.animations.map(clip => clip.name).join(', ') || 'static'}`);
}
