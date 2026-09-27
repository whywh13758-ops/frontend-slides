// Render index.html to an MP4, frame by frame.
// Usage: node render.mjs [out.mp4] [fps]   (needs playwright + ffmpeg; FFMPEG env var overrides the binary)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(dir, 'color-intro.mp4');
const fps = Number(process.argv[3] || 30);
const audio = process.env.AUDIO;
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href + '?capture');
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);

const args = ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'];
if (audio) args.push('-i', audio, '-c:a', 'aac', '-b:a', '192k', '-shortest');
args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
const ff = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'inherit'] });

const total = Math.round(duration * fps);
for (let f = 0; f < total; f++) {
  const b64 = await page.evaluate(t => { window.renderFrame(t); return document.getElementById('c').toDataURL('image/jpeg', 0.95).split(',')[1]; }, f / fps);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 60 === 0) process.stdout.write(`frame ${f}/${total}\n`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('wrote', out);
