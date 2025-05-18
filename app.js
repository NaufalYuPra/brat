import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, unlinkSync } from 'fs';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

const exec = promisify(execCb);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');

await fs.mkdir(TEMP_DIR, { recursive: true });

const imageCache = new LRUCache({ max: 100, ttl: 1000 * 60 * 60 });
const videoCache = new LRUCache({ max: 50, ttl: 1000 * 60 * 60 });
const hashText = text => crypto.createHash('sha256').update(text).digest('hex');

const app = express();
app.use(morgan('dev'));

let browser = null;
async function launchBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
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

  const el = await page.$('#textOverlay');
  const box = await el.boundingBox();
  await page.screenshot({
    clip: { x: box.x, y: box.y, width: 500, height: 500 },
    path: outputPath
  });

  await context.close();
}

app.get('/', async (req, res) => {
  const text = req.query.text;
  const isVideo = req.query.video === 'true';

  if (!text) {
    try {
      const info = await fetch('http://ip-api.com/json').then(r => r.json());
      return res.json({ status: true, msg: 'Parameter text diperlukan', data: info });
    } catch {
      return res.status(400).json({ error: 'Parameter text diperlukan' });
    }
  }

  const key = hashText(text);

  if (!isVideo) {
    // IMAGE FLOW
    try {
      const imgPath = path.join(TEMP_DIR, `${key}.png`);
      if (!imageCache.has(key) || !existsSync(imgPath)) {
        await fetchImage(text, imgPath);
        imageCache.set(key, imgPath);
        console.log('[GENERATE] - Gambar baru dibuat');
      } else {
        console.log('[CACHE] - Kirim gambar dari cache');
      }
      return res.type('png').sendFile(imgPath);
    } catch (err) {
      console.error('[ERROR][Image]', err);
      return res.status(500).json({ error: 'Gagal menghasilkan gambar', detail: err.message });
    }
  }

  // VIDEO FLOW
  try {
    const vidPath = path.join(TEMP_DIR, `${key}.mp4`);
    if (videoCache.has(key) && existsSync(vidPath)) {
      console.log('[CACHE] - Kirim video dari cache');
      return res.type('mp4').sendFile(vidPath);
    }

    console.log('[GENERATE] - Membuat video baru');
    const browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1536, height: 695 } });
    const page = await context.newPage();
    const filePath = path.join(__dirname, 'site/index.html');

    await page.goto(`file://${filePath}`);
    await page.click('#toggleButtonWhite');
    await page.click('#textOverlay');
    await page.click('#textInput');

    const words = text.split(' ').slice(0, 40);
    const frameFiles = [];

    for (let i = 0; i < words.length; i++) {
      const current = words.slice(0, i + 1).join(' ');
      await page.fill('#textInput', current);
      const el = await page.$('#textOverlay');
      const box = await el.boundingBox();
      const framePath = path.join(TEMP_DIR, `${key}_${i}.png`);
      await page.screenshot({
        clip: { x: box.x, y: box.y, width: 500, height: 500 },
        path: framePath
      });
      frameFiles.push(framePath);
    }
    await context.close();

    // Buat file list untuk ffmpeg
    const listTxt = frameFiles.map(p => `file '${p}'\nduration 0.7`).join('\n') +
                    `\nfile '${frameFiles.at(-1)}'\nduration 2`;
    const listPath = path.join(TEMP_DIR, `${key}_files.txt`);
    await fs.writeFile(listPath, listTxt);

    // Jalankan ffmpeg via promise
    const cmd = `ffmpeg -y -f concat -safe 0 -i "${listPath}" -vf "fps=30,scale=512:512" -c:v libx264 -preset ultrafast -pix_fmt yuv420p "${vidPath}"`;
    await exec(cmd);

    // Cleanup sementara
    await fs.unlink(listPath);
    frameFiles.forEach(f => existsSync(f) && unlinkSync(f));

    videoCache.set(key, vidPath);
    return res.type('mp4').sendFile(vidPath);
  } catch (err) {
    console.error('[ERROR][Video]', err);
    return res.status(500).json({ error: 'Gagal memproses video', detail: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});
