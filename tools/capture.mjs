// Animacijos kadrai: paslėptas Chrome atidaro index.php?models=<sąrašas>&scrub, nustato laiką (e) ir nufotografuoja 3D sceną.
//   node capture.mjs --list __look --port 8079 --out <aplankas> --times 1,2.2,3,3.8,4.6,5.4,6.2,6.9
// Išveda JSON: { ok, frames: [{ e, file }], renderer }.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const list = arg('list', '__look'), port = arg('port', '8079'), out = arg('out', '.');
const times = arg('times', '1,2.2,3,3.8,4.6,5.4,6.2,6.9').split(',').map(Number);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
fs.mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--hide-scrollbars'],
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
});
const res = { ok: false, frames: [] };
try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.goto(`http://127.0.0.1:${port}/index.php?models=${list}&scrub&lang=en`, { waitUntil: 'networkidle0', timeout: 60000 });
    res.renderer = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g && g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : (g ? 'webgl2' : 'none'); });
    await page.waitForSelector('#modelChips button', { timeout: 30000 });
    await page.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
    const seek = async e => {
        await page.evaluate(v => { const r = document.querySelector('#stage input[type=range]'); r.value = v; r.dispatchEvent(new Event('input')); }, e);
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    };
    await seek(0.2); await new Promise(r => setTimeout(r, 3500));     // modelis + animacijos modulis įsikelia
    const stage = await page.$('#stage');
    for (const e of times) {
        await seek(e);
        const file = path.join(out, `frame_${e.toFixed(2)}.png`);
        await stage.screenshot({ path: file });
        res.frames.push({ e, file });
    }
    res.errors = errors.filter(x => !/favicon/i.test(x)).slice(0, 5);
    res.ok = true;
} catch (err) {
    res.error = String(err);
} finally {
    await browser.close();
}
console.log(JSON.stringify(res));
