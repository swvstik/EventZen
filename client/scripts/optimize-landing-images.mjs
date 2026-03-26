import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'src', 'assets', 'optimized');
const OUTPUT_DIR = path.join(ROOT, 'src', 'assets', 'optimized-webp', 'landing');

const jobs = [
  { in: 'event-a.jpg', out: 'event-a.webp', width: 1200 },
  { in: 'event-b.jpg', out: 'event-b.webp', width: 1200 },
  { in: 'event-c.jpg', out: 'event-c.webp', width: 1200 },
  { in: 'event-d.jpg', out: 'event-d.webp', width: 1200 },
  { in: 'why-eventzen.jpg', out: 'why-eventzen.webp', width: 1200 },
  { in: 'random-optimized.jpg', out: 'random-optimized.webp', width: 512 },
];

async function run() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const job of jobs) {
    const source = path.join(SOURCE_DIR, job.in);
    const target = path.join(OUTPUT_DIR, job.out);

    await sharp(source)
      .rotate()
      .resize({ width: job.width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toFile(target);

    // eslint-disable-next-line no-console
    console.log(`Generated ${path.relative(ROOT, target)}`);
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to optimize landing images:', error);
  process.exit(1);
});
