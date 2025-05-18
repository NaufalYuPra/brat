import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import chromium from 'chrome-aws-lambda';
import { webkit } from 'playwright-core';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, unlinkSync } from 'fs';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { fileURLToPath } from 'url';
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');

await fs.mkdir(TEMP_DIR, { recursive: true });

const imageCache = new LRUCache({ max: 100, ttl: 1000 * 60 * 60 });
const videoCache = new LRUCache({ max: 50, ttl: 1000 * 60 * 60 });

const ffmpeg = createFFmpeg({ log: true });

const hashText = text => crypto.createHash('sha256').update(text).digest('hex');

const app = express();
app.use(morgan('dev'));

let browser = null;
async function launchBrowser() {
  if (browser) return browser;
  browser = await webkit.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
  });
  return browser;
}

async function fetchImage(text, outputPath) {
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1536, height: 695 } });
  const page = await context.newPage();
  const filePath = path.join(__dirname, 'site/index.html');

  await page.goto(`file://${filePath}`);
  await page.click('#toggleButtonWhite');
  await page.click('#textOverlay');
  await page.fill('#textInput', text);

  const element = await page.$('#textOverlay');
  const box = await element.boundingBox();
  await page.screenshot({
    clip: { x: box.x, y: box.y, width: 500, height: 500 },
    path: outputPath
  });

  await context.close();
}

async function processVideo(frames, outputPath) {
  if (!ffmpeg.isLoaded()) await ffmpeg.load();
  // tulis setiap frame ke virtual FS
  frames.forEach((buffer, i) => {
    ffmpeg.FS('writeFile', `frame_${i}.png`, buffer);
  });
  // buat file list untuk concat
  const listTxt = frames.map((_, i) => `file 'frame_${i}.png'\nduration 0.7`).join('\n') +
                  `\nfile 'frame_${frames.length - 1}.png'\nduration 2`;
  ffmpeg.FS('writeFile', 'list.txt', listTxt);

  await ffmpeg.run(
    '-f', 'concat', '-safe', '0', '-i', 'list.txt',
    '-vf', 'fps=30,scale=512:512',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    'out.mp4'
  );

  const data = ffmpeg.FS('readFile', 'out.mp4');
  await fs.writeFile(outputPath, data);
}

app.get('/', async (req, res) => {
  const text = req.query.text;
  const isVideo = req.query.video === 'true';
  if (!text) {
    return res.status(400).json({ error: 'Parameter "text" diperlukan' });
  }

  const key = hashText(text);

  if (!isVideo) {
    const cached = imageCache.get(key);
    if (cached) return res.sendFile(cached);

    const imgPath = path.join(TEMP_DIR, `${key}.png`);
    try {
      if (!existsSync(imgPath)) {
        await fetchImage(text, imgPath);
      }
      imageCache.set(key, imgPath);
      res.type('png').sendFile(imgPath);
    } catch (err) {
      console.error('[ERROR][Image]', err);
      res.status(500).json({ error: 'Gagal menghasilkan gambar', detail: err.message });
    }
    return;
  }

  // Video flow
  const cachedVid = videoCache.get(key);
  if (cachedVid) return res.sendFile(cachedVid);

  const words = text.split(' ').slice(0, 40);
  const frameBuffers = [];

  try {
    const browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1536, height: 695 } });
    const page = await context.newPage();
    const filePath = path.join(__dirname, 'site/index.html');
    await page.goto(`file://${filePath}`);
    await page.click('#toggleButtonWhite');
    await page.click('#textOverlay');
    await page.click('#textInput');

    for (let i = 0; i < words.length; i++) {
      const current = words.slice(0, i + 1).join(' ');
      await page.fill('#textInput', current);
      const el = await page.$('#textOverlay');
      const box = await el.boundingBox();
      const buf = await page.screenshot({
        clip: { x: box.x, y: box.y, width: 500, height: 500 }
      });
      frameBuffers.push(buf);
    }

    await context.close();

    const vidPath = path.join(TEMP_DIR, `${key}.mp4`);
    await processVideo(frameBuffers, vidPath);
    videoCache.set(key, vidPath);

    res.type('mp4').sendFile(vidPath);
  } catch (err) {
    console.error('[ERROR][Video]', err);
    res.status(500).json({ error: 'Gagal memproses video', detail: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server ready on port ${PORT}`));

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});
