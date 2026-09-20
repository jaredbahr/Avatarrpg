import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { webkit } from 'playwright';

/**
 * Diagnose a Windows WebKit WebGL canvas after a CSS/backing-store resize.
 *
 * Set FNT_WEBKIT_EXECUTABLE when WebKit is not in Playwright's default cache.
 * Set FNT_RESIZE_BASE_URL to a running preview URL to include the Riverside
 * reproduction; the standalone control always runs and needs no server.
 * Set FNT_RESIZE_OUTPUT to retain the four screenshots.
 */

const executablePath = process.env.FNT_WEBKIT_EXECUTABLE || undefined;
const baseUrl = process.env.FNT_RESIZE_BASE_URL || '';
const outputDir = process.env.FNT_RESIZE_OUTPUT || '';
if (outputDir) fs.mkdirSync(outputDir, { recursive: true });

function imageMetrics(buffer) {
  const image = PNG.sync.read(buffer);
  let sum = 0;
  let nonBackground = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i] ?? 0;
    const g = image.data[i + 1] ?? 0;
    const b = image.data[i + 2] ?? 0;
    const a = image.data[i + 3] ?? 0;
    sum += r + g + b;
    if (a > 0 && Math.abs(r - 239) + Math.abs(g - 222) + Math.abs(b - 188) > 30) {
      nonBackground += 1;
    }
  }
  const count = image.width * image.height;
  return {
    width: image.width,
    height: image.height,
    meanRgb: Number((sum / Math.max(1, count * 3)).toFixed(2)),
    nonBackground,
  };
}

function savePath(label) {
  return outputDir ? path.join(outputDir, `${label}.png`) : undefined;
}

function dataUrlMetrics(dataUrl) {
  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return imageMetrics(Buffer.from(encoded, 'base64'));
}

async function runStandalone(browser) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  try {
    await page.setContent(
      '<!doctype html><style>html,body{margin:0;background:#eeddbc}#c{display:block;width:1280px;height:485px}</style><canvas id="c" width="1280" height="485"></canvas>',
    );
    await page.evaluate(() => {
      const canvas = globalThis.document.querySelector('#c');
      const gl = canvas?.getContext('webgl', { alpha: false, preserveDrawingBuffer: true });
      if (!canvas || !gl) throw new Error('WebGL unavailable');
      const draw = () => {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.18, 0.62, 0.82, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.flush();
        const pixel = new Uint8Array(4);
        gl.readPixels(
          Math.floor(canvas.width / 2),
          Math.floor(canvas.height / 2),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixel,
        );
        return {
          width: canvas.width,
          height: canvas.height,
          pixel: Array.from(pixel),
          error: gl.getError(),
        };
      };
      globalThis.__resizeControlDraw = draw;
      globalThis.__resizeControlInitial = draw();
    });

    const initialDataUrl = await page
      .locator('#c')
      .evaluate((canvas) => canvas.toDataURL('image/png'));
    const initialPng = await page.locator('#c').screenshot({ path: savePath('control-initial') });
    const initial = {
      framebuffer: await page.evaluate(() => globalThis.__resizeControlInitial),
      dataUrl: dataUrlMetrics(initialDataUrl),
      screenshot: imageMetrics(initialPng),
    };

    const resizedFramebuffer = await page.evaluate(() => {
      const canvas = globalThis.document.querySelector('#c');
      if (!canvas) throw new Error('Missing control canvas');
      canvas.width = 1280;
      canvas.height = 428;
      canvas.style.height = '428px';
      return globalThis.__resizeControlDraw();
    });
    const resizedDataUrl = await page
      .locator('#c')
      .evaluate((canvas) => canvas.toDataURL('image/png'));
    const resizedPng = await page.locator('#c').screenshot({ path: savePath('control-resized') });
    const resized = {
      framebuffer: resizedFramebuffer,
      dataUrl: dataUrlMetrics(resizedDataUrl),
      screenshot: imageMetrics(resizedPng),
    };
    return { initial, resized };
  } finally {
    await page.close();
  }
}

async function runRiverside(browser) {
  if (!baseUrl) return { skipped: 'Set FNT_RESIZE_BASE_URL to a running preview.' };
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });
  try {
    await page.goto(`${baseUrl}/?renderer=webgl`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Explore the riverside', exact: true }).click();
    await page.waitForSelector('.village-life-canvas');
    await page.waitForTimeout(1800);
    await page.locator('.village-life-canvas').evaluate((canvas) => {
      canvas.style.display = 'none';
    });
    await page.evaluate(() => {
      const backend = globalThis.fnt?.app?.scene?.renderer?.backend;
      const renderer = backend?.app?.renderer;
      if (!backend || !renderer) throw new Error('Missing Pixi WebGL backend');
      const original = renderer.render.bind(renderer);
      const samples = [];
      let lastSize = '';
      renderer.render = (...args) => {
        const result = original(...args);
        const gl = renderer.gl;
        if (!gl) return result;
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;
        const key = `${width}x${height}`;
        if (key === lastSize) return result;
        lastSize = key;
        gl.flush();
        const pixel = new Uint8Array(4);
        gl.readPixels(
          Math.floor(width / 2),
          Math.floor(height / 2),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixel,
        );
        const dataUrl = renderer.canvas?.toDataURL?.('image/png') ?? '';
        samples.push({
          width,
          height,
          viewport: Array.from(gl.getParameter(gl.VIEWPORT)),
          framebuffer: Boolean(gl.getParameter(gl.FRAMEBUFFER_BINDING)),
          pixel: Array.from(pixel),
          dataUrl,
          error: gl.getError(),
        });
        return result;
      };
      backend.__resizeDiagnosticSamples = samples;
    });

    const capture = async (label) => {
      await page.waitForTimeout(300);
      const screenshot = await page.locator('.map-canvas').screenshot({ path: savePath(label) });
      const rawSamples = await page.evaluate(
        () => globalThis.fnt?.app?.scene?.renderer?.backend?.__resizeDiagnosticSamples ?? [],
      );
      const samples = rawSamples.map(({ dataUrl, ...sample }) => ({
        ...sample,
        dataUrl: dataUrl ? dataUrlMetrics(dataUrl) : null,
      }));
      const latest = samples.at(-1);
      return {
        dataUrl: latest?.dataUrl ?? null,
        screenshot: imageMetrics(screenshot),
        samples,
      };
    };

    const initial = await capture('riverside-initial');
    const toggle = page.getByRole('button', { name: 'Activities', exact: true });
    await toggle.click();
    await page.waitForFunction(
      () =>
        globalThis.document
          .querySelector('.village-activities-toggle')
          ?.getAttribute('aria-expanded') === 'true',
    );
    const opened = await capture('riverside-opened');
    await toggle.click();
    await page.waitForFunction(
      () =>
        globalThis.document
          .querySelector('.village-activities-toggle')
          ?.getAttribute('aria-expanded') === 'false',
    );
    const closed = await capture('riverside-closed');
    return { initial, opened, closed, errors };
  } finally {
    await page.close();
  }
}

const browser = await webkit.launch({ headless: true, executablePath });
try {
  const result = {
    browser: { version: browser.version(), executablePath: executablePath ?? 'Playwright default' },
    standalone: await runStandalone(browser),
    riverside: await runRiverside(browser),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
}
