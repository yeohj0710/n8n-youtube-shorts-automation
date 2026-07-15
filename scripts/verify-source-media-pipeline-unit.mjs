import assert from 'node:assert/strict';
import { canonicalizeUrl, sourceIdFromUrl } from './source-media-pipeline.mjs';

assert.equal(
  canonicalizeUrl('https://www.instagram.com/reel/ABC123/?utm_source=test'),
  'https://www.instagram.com/reel/ABC123/',
);
assert.equal(
  canonicalizeUrl('https://youtu.be/dQw4w9WgXcQ?t=3'),
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
);
assert.equal(sourceIdFromUrl('https://www.instagram.com/p/POST987/'), 'instagram_POST987');
assert.equal(sourceIdFromUrl('https://www.youtube.com/shorts/VID456'), 'youtube_VID456');
assert.throws(() => canonicalizeUrl('https://example.com/video/1'), /Unsupported/);

console.log('PASS: source media URL canonicalization and stable IDs');
