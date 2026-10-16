import test from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify, assertFile, checkPassword, sameOrigin, isAdmin, isConfigured } from './drive.js';
const secret = 'a-secure-test-secret-of-at-least-32-characters';
test('sessions expire and signatures cannot be altered', () => {
  const token = sign({ role: 'admin', exp: Date.now() + 10000 }, secret);
  assert.equal(verify(token, secret).role, 'admin');
  assert.equal(verify(token + 'x', secret), null);
  assert.equal(verify(sign({ exp: 1 }, secret), secret), null);
  assert.equal(verify(token, 'another-secret'), null);
});
test('rejects oversized files, active content, and invalid lengths', () => {
  assert.doesNotThrow(() => assertFile({ name: 'photo.jpg', type: 'image/jpeg', size: 30000000 }));
  for (const file of [
    { name: 'x.svg', type: 'image/svg+xml', size: 1 },
    { name: 'x.jpg', type: 'image/jpeg', size: 0 },
    { name: 'x.mp4', type: 'video/mp4', size: 513 * 1024 * 1024 },
    { name: 'x.jpg', type: 'image/jpeg', size: '100' },
  ]) assert.throws(() => assertFile(file));
});
test('password fails closed without configuration', () => {
  assert.equal(checkPassword('password', ''), false);
  assert.equal(checkPassword('password', 'password'), true);
  assert.equal(checkPassword('wrong', 'password'), false);
  assert.equal(checkPassword({}, 'password'), false);
  assert.equal(isConfigured({}), false);
  assert.equal(isAdmin({ headers: {} }), false);
});
test('write requests require the configured gallery origin', () => {
  assert.equal(sameOrigin({ headers: { origin: 'https://evil.example' } }), false);
  assert.equal(sameOrigin({ headers: {} }), false);
});
