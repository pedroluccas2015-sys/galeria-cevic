import sharp from 'sharp';

// Read the original EXIF before resizing. Drive previews can lose that metadata.
// autoOrient also handles mirrored orientations and strips the orientation tag,
// preventing a second rotation in the browser. Originals are never modified.
export function thumbnailTransform(size) {
  return sharp({ limitInputPixels: 100_000_000 })
    .autoOrient()
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 });
}
