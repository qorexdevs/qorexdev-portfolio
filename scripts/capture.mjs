import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.E2E_URL || 'http://127.0.0.1:5173';
const output = resolve(process.env.CAPTURE_DIR || 'artifacts/screenshots');
const previews = resolve('public/previews');
await mkdir(output, { recursive: true });
await mkdir(previews, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const report = [];
try {
  for (const slug of ['flowdesk', 'orderly', 'pricewatch']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/demo/${slug}`);
    await page.getByLabel('Демонстрационная роль').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() =>
      Promise.all([...document.images].map((img) => img.decode().catch(() => {}))),
    );
    await page.screenshot({ path: resolve(previews, `${slug}.png`) });
    await page.screenshot({ path: resolve(output, `${slug}-desktop.png`), fullPage: true });
    report.push({
      route: `/demo/${slug}`,
      errors,
      images: await page.evaluate(() =>
        [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src),
      ),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: resolve(previews, `${slug}-mobile.png`) });
    await page.screenshot({ path: resolve(output, `${slug}-mobile-full.png`), fullPage: true });
    await context.close();
  }
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['laptop', 1280, 800],
    ['mobile', 390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() =>
      Promise.all([...document.images].map((img) => img.decode().catch(() => {}))),
    );
    await page.screenshot({ path: resolve(output, `portfolio-${name}.png`) });
    await page.screenshot({ path: resolve(output, `portfolio-${name}-full.png`), fullPage: true });
    report.push({
      route: '/',
      width,
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      images: await page.evaluate(() =>
        [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src),
      ),
    });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/work/flowdesk`);
  await page.evaluate(() => {
    document
      .querySelectorAll('img[loading="lazy"]')
      .forEach((img) => img.setAttribute('loading', 'eager'));
  });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    Promise.all([...document.images].map((img) => img.decode().catch(() => {}))),
  );
  await page.screenshot({ path: resolve(output, 'case-flowdesk-full.png'), fullPage: true });
  await writeFile(resolve(output, 'capture-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
