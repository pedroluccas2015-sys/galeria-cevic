import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadToDrive } from './drive.js';
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
test('large uploads go directly to Drive and are confirmed before publishing', async () => {
  const file = new File([new Uint8Array(9 * 1024 * 1024)], 'photo.jpg', { type: 'image/jpeg' });
  const calls = [];
  const result = await uploadToDrive(file, () => {}, async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return json({ uploadUrl: 'https://www.googleapis.com/upload/session', receipt: 'signed-receipt' });
    if (calls.length === 2) {
      assert.equal(options.body.size, 8 * 1024 * 1024);
      assert.equal(options.headers['Content-Range'], 'bytes 0-8388607/9437184');
      return new Response(null, { status: 308, headers: { Range: 'bytes=0-8388607' } });
    }
    if (calls.length === 3) return json({ id: 'file-id' });
    assert.equal(JSON.parse(options.body).action, 'complete');
    return json({ url: '/api/media?id=file-id', fileId: 'file-id' });
  });
  assert.equal(calls.length, 4);
  assert.equal(result.fileId, 'file-id');
});
test('failed authorization prevents uploads', async () => {
  await assert.rejects(uploadToDrive(new File(['x'], 'x.jpg', { type: 'image/jpeg' }), undefined, async () => json({ error: 'Entre novamente' }, 401)), /Entre novamente/);
});
test('unconfirmed upload is not published', async () => {
  let calls = 0;
  await assert.rejects(uploadToDrive(new File(['x'], 'x.jpg', { type: 'image/jpeg' }), undefined, async () => {
    calls++;
    if (calls === 1) return json({ uploadUrl: 'https://www.googleapis.com/upload/session' });
    return new Response(null, { status: 308 });
  }), /não confirmou o progresso/);
  assert.equal(calls, 2);
});
