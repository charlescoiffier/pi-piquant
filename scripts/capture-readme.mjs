/**
 * Régénère les images du README dans docs/images/ : captures d'écran (bureau et mobile) et GIF de l'animation.
 *
 * Usage : npm run capture:readme
 * Prérequis : Google Chrome (ou CHROME_PATH=/chemin/vers/chrome) et ffmpeg dans le PATH.
 *
 * Le script construit l'application, la sert en local, pilote Chrome sur des liens à réglages fixes (les images sont
 * donc reproductibles) et obtient le GIF en enregistrant l'animation avec le vrai bouton « Vidéo » de l'application,
 * ce qui teste aussi cette fonction de bout en bout.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs', 'images');
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const GIF_MAX_BYTES = 3_000_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kb = (f) => `${Math.round(statSync(f).size / 1024)} Ko`;

/** Réglages communs des liens (le dessin dépend uniquement du lien : captures reproductibles). */
const lien = (extra) => `source=pi&segment=10&sens=anti-horaire&trait=111111&fond=ffffff&epaisseur=0.5&${extra}`;

function check() {
  if (!existsSync(CHROME)) throw new Error(`Chrome introuvable (${CHROME}). Définir CHROME_PATH.`);
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { throw new Error('ffmpeg introuvable dans le PATH.'); }
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* pas encore prêt */ }
    await sleep(250);
  }
  throw new Error('Le serveur de prévisualisation ne répond pas.');
}

async function open(browser, viewport, hash, { mobile = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ deviceScaleFactor: 1, ...viewport, isMobile: mobile, hasTouch: mobile });
  // interface en français, quelle que soit la langue de la machine
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'language', { get: () => 'fr-FR' }));
  await page.goto(`${BASE}#${hash}`);
  await page.waitForFunction(() => /piquant •/.test(document.title), { timeout: 20_000 });
  await sleep(900); // fin du tracé et des transitions
  return page;
}

const hidePanel = async (page) => { await page.keyboard.press('h'); await sleep(200); };
const click = (page, label) => page.evaluate((l) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === l)?.click(), label);

async function shot(page, name) {
  const file = join(OUT, name);
  await page.screenshot({ path: file });
  console.log(`  ${name} (${kb(file)})`);
  await page.close();
}

/** Enregistre l'animation avec le bouton « Vidéo » de l'application ; renvoie le fichier téléchargé. */
async function recordAnimation(browser, dir) {
  const page = await open(browser, { width: 1280, height: 800 }, lien('decimales=250&angle=17&prolongements=oui&intensite=20'));
  const cdp = await browser.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  // durée de 5 s : le 2e cran du curseur de durée (3, 5, 10, 20, 30, 60)
  await page.evaluate(() => {
    const f = [...document.querySelectorAll('.field')].find((x) => x.querySelector('span').textContent.startsWith('Durée vidéo'));
    const r = f.querySelector('input[type=range]');
    r.value = '1';
    r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click(page, 'Vidéo');
  for (let i = 0; i < 120; i++) {
    const files = readdirSync(dir).filter((f) => /\.(mp4|webm)$/.test(f));
    if (files.length) { await sleep(500); await page.close(); return join(dir, files[0]); }
    await sleep(250);
  }
  throw new Error('La vidéo n\'a pas été téléchargée.');
}

/**
 * Convertit la vidéo en GIF carré (la figure est centrée sur fond blanc, quelle que soit sa forme), avec une palette
 * optimisée, en réduisant la taille jusqu'à passer sous GIF_MAX_BYTES.
 */
function toGif(video, out) {
  for (const [side, fps] of [[560, 15], [480, 15], [420, 12], [360, 10]]) {
    const filtre = `fps=${fps},scale=${side}:${side}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${side}:${side}:(ow-iw)/2:(oh-ih)/2:white,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, '-vf', filtre, '-loop', '0', out]);
    console.log(`  essai ${side} px, ${fps} i/s : ${kb(out)}`);
    if (statSync(out).size <= GIF_MAX_BYTES) return;
  }
  throw new Error(`GIF supérieur à ${GIF_MAX_BYTES} octets même à la plus petite taille.`);
}

async function main() {
  check();
  mkdirSync(OUT, { recursive: true });
  console.log('Construction de l\'application…');
  execFileSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'ignore' });
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  const tmp = mkdtempSync(join(tmpdir(), 'pi-piquant-'));
  let browser;
  try {
    await waitForServer();
    browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--lang=fr-FR'] });

    console.log('Captures :');
    await shot(await open(browser, { width: 1280, height: 800 }, lien('decimales=250&angle=17&prolongements=non')), 'apercu-bureau.png');

    const prolong = await open(browser, { width: 900, height: 900 }, lien('decimales=100&angle=10&prolongements=oui&intensite=30'));
    await hidePanel(prolong);
    await shot(prolong, 'prolongements.png');

    const texte = await open(browser, { width: 900, height: 900 }, 'source=texte&segment=10&angle=24&sens=anti-horaire&trait=111111&fond=ffffff&epaisseur=0.5&prolongements=non');
    await hidePanel(texte);
    await shot(texte, 'texte.png');

    const mobile = { width: 390, height: 844, deviceScaleFactor: 2 };
    await shot(await open(browser, mobile, lien('decimales=400&angle=24&prolongements=non'), { mobile: true }), 'mobile.png');
    const ouvert = await open(browser, mobile, lien('decimales=400&angle=24&prolongements=non'), { mobile: true });
    await ouvert.evaluate(() => [...document.querySelectorAll('.panel-head button')].pop().click());
    await sleep(400);
    await shot(ouvert, 'mobile-reglages.png');

    console.log('Animation :');
    const video = await recordAnimation(browser, tmp);
    const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height:format=duration', '-of', 'default=nw=1', video]).toString().trim().replace(/\n/g, ' · ');
    console.log(`  vidéo enregistrée : ${video.split('.').pop()} · ${probe}`);
    const gif = join(OUT, 'animation.gif');
    toGif(video, gif);
    console.log(`  animation.gif (${kb(gif)})`);
  } finally {
    await browser?.close();
    server.kill();
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().then(() => console.log('Terminé : docs/images/'), (e) => { console.error(e.message); process.exit(1); });
