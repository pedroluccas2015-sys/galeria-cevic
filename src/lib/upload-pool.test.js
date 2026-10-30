import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadPool } from './upload-pool.js';

test('upload queue processes each file once and never exceeds three concurrent files', async () => {
  let active = 0;
  let peak = 0;
  const visited = [];
  await uploadPool([0, 1, 2, 3, 4, 5, 6], async (file, index) => {
    active++;
    peak = Math.max(peak, active);
    visited.push([file, index]);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
  });
  assert.equal(peak, 3);
  assert.deepEqual(visited.map(([file]) => file).sort(), [0, 1, 2, 3, 4, 5, 6]);
  assert.ok(visited.every(([file, index]) => file === index));
});

test('handled upload failure does not block later files', async () => {
  const successes = [];
  const failures = [];
  await uploadPool([0, 1, 2, 3], async file => {
    try {
      if (file === 1) throw new Error('offline');
      successes.push(file);
    } catch { failures.push(file); }
  });
  assert.deepEqual(successes.sort(), [0, 2, 3]);
  assert.deepEqual(failures, [1]);
});
