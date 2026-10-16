import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadMedia } from './cloudinary.js';
const photo = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
test('rejects disabled cloud responses instead of saving a missing URL', async () => {
  await assert.rejects(uploadMedia(photo, 'cloud', 'preset', async () => ({
    ok: false, json: async () => ({ error: { message: 'cloud is disabled' } }),
  })), /disabled/);
});
test('rejects a successful HTTP response without a durable URL', async () => {
  await assert.rejects(uploadMedia(photo, 'cloud', 'preset', async () => ({
    ok: true, json: async () => ({}),
  })), /não confirmou/);
});
test('uploads with the correct preset and returns the confirmed URL', async () => {
  const url = await uploadMedia(photo, 'cloud', 'preset', async (endpoint, options) => {
    assert.equal(endpoint, 'https://api.cloudinary.com/v1_1/cloud/image/upload');
    assert.equal(options.body.get('upload_preset'), 'preset');
    assert.equal(options.body.get('file').name, 'photo.jpg');
    return { ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/cloud/image/upload/photo.jpg' }) };
  });
  assert.match(url, /^https:/);
});
