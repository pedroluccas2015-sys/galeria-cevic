import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { thumbnailTransform } from './thumbnail.js';

for (let orientation = 1; orientation <= 8; orientation++) {
  test(`thumbnail normalizes EXIF orientation ${orientation}`, async () => {
    const original = await sharp({ create: { width: 80, height: 40, channels: 3, background: 'red' } })
      .jpeg().withMetadata({ orientation }).toBuffer();
    const transform = thumbnailTransform(60);
    transform.end(original);
    const output = await transform.toBuffer();
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.width, orientation >= 5 ? 30 : 60);
    assert.equal(metadata.height, orientation >= 5 ? 60 : 30);
    assert.equal(metadata.orientation, undefined);
    assert.equal(metadata.format, 'webp');
    assert.equal((await sharp(original).metadata()).orientation, orientation);
  });
}
