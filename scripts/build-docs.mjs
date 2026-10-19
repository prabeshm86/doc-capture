// npm run build — turns output/captures/* into output/docs:
//   index.html      a self-contained HTML user guide (sidebar, search, videos with step chapters)
//   <flow>.md       one Markdown page per flow (for Confluence, a wiki, Docusaurus, MkDocs…)
//   README.md       Markdown table of contents
//   assets/<flow>/  screenshots, walkthrough.mp4 and walkthrough.gif
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv, readDocConfig, outDir } from '../lib/shared.mjs';

// ---------------------------------------------------------------------------- ffmpeg

async function findFfmpeg() {
  const candidates = [];
  if (process.env.FFMPEG_PATH) candidates.push(process.env.FFMPEG_PATH);
  try {
    const mod = await import('ffmpeg-static');
    if (mod.default) candidates.push(mod.default);
  } catch {
    /* optional dependency not installed */
  }
  candidates.push('ffmpeg');
  for (const bin of candidates) {
    const res = spawnSync(bin, ['-version'], { stdio: 'ignore' });
    if (res.status === 0) return bin;
  }
  return null;
}

function ffmpeg(bin, args) {
  const res = spawnSync(bin, ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(res.stderr || `ffmpeg exited with ${res.status}`);
}

function isFresh(target, source) {
  return fs.existsSync(target) && fs.statSync(target).mtimeMs >= fs.statSync(source).mtimeMs;
}

function convertVideo(bin, cfg, flowDir, flow) {
  const src = path.join(flowDir, flow.video);
  const trim = String(Math.max(0, (flow.trimStart || 0) - 0.1).toFixed(2));
  const out = { mp4: null, gif: null };

  const mp4 = path.join(flowDir, 'walkthrough.mp4');
  if (!isFresh(mp4, src)) {
    ffmpeg(bin, [
      '-ss', trim, '-i', src,
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', '-an', mp4,
    ]);
  }
  out.mp4 = mp4;

  if (cfg.gif.enabled) {
    const gif = path.join(flowDir, 'walkthrough.gif');
    if (!isFresh(gif, src)) {
      const width = Math.min(cfg.gif.width, flow.viewport?.width ?? cfg.gif.width);
      ffmpeg(bin, [
        '-ss', trim, '-i', src,
        '-vf',
        `fps=${cfg.gif.fps},scale=${width}:-1:flags=lanczos,split[a][b];` +
          '[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
        gif,
      ]);
    }
    out.gif = gif;
  }
  return out;
}

// ---------------------------------------------------------------------------- text helpers

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Tiny Markdown subset for step text: **bold**, `code`, _italic_, [link](url), line breaks. */
function inline(md = '') {
  let s = esc(md);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) =>
    /^(https?:|mailto:|#|\/)/.test(url) ? `<a href="${url}">${text}</a>` : text,
  );
  return s.replace(/\n/g, '<br>');
}

const plain = (md = '') => md.replace(/\*\*|`|_/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

function clock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------- load captures

function loadFlows(capturesDir, includeFailed) {
  if (!fs.existsSync(capturesDir)) return { flows: [], failed: [] };
  const flows = [];
  const failed = [];
  for (const slug of fs.readdirSync(capturesDir)) {
    const file = path.join(capturesDir, slug, 'manifest.json');
    if (!fs.existsSync(file)) continue;
    const m = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (m.status !== 'passed') {
      failed.push(m);
      if (!includeFailed) continue;
    }
    flows.push(m);
  }
  flows.sort(
    (a, b) =>
      a.file.localeCompare(b.file, undefined, { numeric: true }) ||
      (a.order ?? a.line) - (b.order ?? b.line),
  );
  return { flows, failed };
}

function groupBySection(flows) {
  const sections = new Map();
  for (const f of flows) {
    const key = f.section || 'General';
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key).push(f);
  }
  return [...sections].map(([name, items]) => ({ name, items }));
}

// ---------------------------------------------------------------------------- markdown

function flowMarkdown(f, cfg) {
  const a = `assets/${f.slug}`;
  const lines = [`# ${f.title}`, ''];
  if (f.summary) lines.push(f.summary, '');
  if (f.prerequisites?.length) {
    lines.push('**Before you start**', '', ...f.prerequisites.map((p) => `- ${p}`), '');
  }
  if (f.media?.gif) lines.push(`![${f.title} walkthrough](${a}/walkthrough.gif)`, '');
  if (f.media?.video) lines.push(`[▶ Watch the walkthrough video](${a}/${f.media.video})`, '');
  for (const s of f.steps) {
    lines.push(`## ${s.n}. ${s.title}`, '');
    if (s.text) lines.push(s.text, '');
    if (s.image) lines.push(`![${plain(s.title)}](${a}/${s.image})`, '');
    if (s.tip) lines.push(`> **Tip:** ${s.tip}`, '');
    if (s.warning) lines.push(`> **Warning:** ${s.warning}`, '');
  }
  lines.push('---', `_${cfg.productName} user guide · captured ${new Date(f.capturedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}_`, '');
  return lines.join('\n');
}

function indexMarkdown(sections, cfg) {
  const lines = [`# ${cfg.productName} user guide`, ''];
  if (cfg.intro) lines.push(cfg.intro, '');
  for (const sec of sections) {
    lines.push(`## ${sec.name}`, '');
    for (const f of sec.items) lines.push(`- [${f.title}](${f.slug}.md)${f.summary ? ` — ${f.summary}` : ''}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------- html

function flowArticle(f, prev, next) {
  const a = `assets/${f.slug}`;
  const offset = Math.max(0, (f.trimStart || 0) - 0.1);
  const poster = f.steps.find((s) => s.image)?.image;
  const video = f.media?.video
    ? `<section class="walk" aria-label="Walkthrough video">
        <video controls preload="metadata" playsinline ${poster ? `poster="${a}/${poster}"` : ''}>
          <source src="${a}/${f.media.video}" type="${f.media.video.endsWith('.mp4') ? 'video/mp4' : 'video/webm'}">
        </video>
        <ol class="chapters">${f.steps
          .map(
            (s) => `<li><button type="button" data-t="${Math.max(0, s.t - offset).toFixed(2)}">
              <span class="ch-n">${s.n}</span><span class="ch-t">${esc(s.title)}</span>
              <span class="ch-time">${clock(s.t - offset)}</span></button></li>`,
          )
          .join('')}</ol>
      </section>`
    : '';

  const prereq = f.prerequisites?.length
    ? `<div class="callout info"><strong>Before you start</strong><ul>${f.prerequisites
        .map((p) => `<li>${inline(p)}</li>`)
        .join('')}</ul></div>`
    : '';

  const steps = f.steps
    .map(
      (s) => `<li class="step" id="${f.slug}-${s.n}">
        <div class="num" aria-hidden="true">${s.n}</div>
        <div class="step-body">
          <div class="step-head"><h3>${esc(s.title)}</h3>${
            f.media?.video
              ? `<button type="button" class="seek" data-t="${Math.max(0, s.t - offset).toFixed(2)}" title="Play this step in the video">▶ ${clock(s.t - offset)}</button>`
              : ''
          }</div>
          ${s.text ? `<p>${inline(s.text)}</p>` : ''}
          ${s.image ? `<figure><img src="${a}/${s.image}" alt="${esc(plain(s.title))}" loading="lazy"></figure>` : ''}
          ${s.tip ? `<div class="callout tip"><strong>Tip</strong> ${inline(s.tip)}</div>` : ''}
          ${s.warning ? `<div class="callout warn"><strong>Warning</strong> ${inline(s.warning)}</div>` : ''}
        </div>
      </li>`,
    )
    .join('');

  const pager = `<nav class="pager">${
    prev ? `<a href="#${prev.slug}"><small>Previous</small>${esc(prev.title)}</a>` : '<span></span>'
  }${next ? `<a class="next" href="#${next.slug}"><small>Next</small>${esc(next.title)}</a>` : '<span></span>'}</nav>`;

  return `<article class="view" data-view="${f.slug}" hidden>
    <div class="crumb">${esc(f.section || 'General')}</div>
    <h1>${esc(f.title)}</h1>
    ${f.summary ? `<p class="lede">${inline(f.summary)}</p>` : ''}
    ${f.status !== 'passed' ? '<div class="callout warn"><strong>Incomplete</strong> This flow failed during capture, so some steps may be missing.</div>' : ''}
    ${prereq}${video}
    <h2 class="steps-h">Steps</h2>
    <ol class="steps">${steps}</ol>
    ${pager}
  </article>`;
}

const DARK =
  '--bg:#0b1120;--bg-soft:#111827;--ink:#e5e7eb;--ink-2:#cbd5e1;--muted:#94a3b8;--line:#1f2937;' +
  '--link:#93c5fd;--code:#1f2937;--tip:#052e25;--warn:#2a1a06;--info:#0b1d3a;' +
  '--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35);color-scheme:dark;';

function html(sections, flows, cfg) {
  const updated = flows.length
    ? new Date(Math.max(...flows.map((f) => Date.parse(f.capturedAt)))).toLocaleDateString('en-US', { dateStyle: 'medium' })
    : '';
  const initial = esc((cfg.productName.trim()[0] || 'D').toUpperCase());
  const searchText = (f) => esc([f.title, f.summary, ...f.steps.map((s) => `${s.title} ${s.text ?? ''}`)].join(' ').toLowerCase());

  const nav = sections
    .map(
      (sec) => `<div class="nav-sec"><div class="nav-h">${esc(sec.name)}</div>${sec.items
        .map((f) => `<a href="#${f.slug}" data-link="${f.slug}" data-search="${searchText(f)}">${esc(f.title)}</a>`)
        .join('')}</div>`,
    )
    .join('');

  const home = `<section class="view" data-view="home">
    <div class="crumb">User guide</div>
    <h1>${esc(cfg.productName)}</h1>
    <p class="lede">${inline(cfg.intro || `Step-by-step guides for ${cfg.productName}.`)}</p>
    ${sections
      .map(
        (sec) => `<h2 class="home-h">${esc(sec.name)}</h2><div class="cards">${sec.items
          .map(
            (f) => `<a class="card" href="#${f.slug}">
              ${f.steps.find((s) => s.image) ? `<img src="assets/${f.slug}/${f.steps.find((s) => s.image).image}" alt="" loading="lazy">` : ''}
              <div class="card-b"><strong>${esc(f.title)}</strong>${f.summary ? `<span>${inline(f.summary)}</span>` : ''}
              <small>${f.steps.length} steps${f.media?.video ? ' · video' : ''}</small></div></a>`,
          )
          .join('')}</div>`,
      )
      .join('')}
    ${flows.length ? '' : '<p class="empty">No flows have been captured yet. Run <code>npm run docs</code>.</p>'}
  </section>`;

  const articles = flows.map((f, i) => flowArticle(f, flows[i - 1], flows[i + 1])).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cfg.productName)} User Guide</title>
<style>
:root{
  --bg:#ffffff;--bg-soft:#f6f7f9;--ink:#0f172a;--ink-2:#334155;--muted:#64748b;--line:#e2e8f0;
  --accent:${cfg.accentColor};--link:#1d4ed8;--code:#f1f5f9;
  --tip:#ecfdf5;--tip-line:#10b981;--warn:#fff7ed;--warn-line:#f59e0b;--info:#eff6ff;--info-line:#3b82f6;
  --shadow:0 1px 2px rgba(15,23,42,.06),0 8px 24px rgba(15,23,42,.08);
  --font:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${DARK}}}
:root[data-theme="dark"]{${DARK}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 var(--font);-webkit-font-smoothing:antialiased}
a{color:var(--link)}
code{font:.9em ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--code);padding:.1em .35em;border-radius:5px}
.layout{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:100vh}
.side{position:sticky;top:0;height:100vh;overflow:auto;padding:24px 18px;border-right:1px solid var(--line);background:var(--bg-soft)}
.brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;margin:0 6px 20px}
.logo{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:var(--accent);color:#fff;font-weight:800}
.brand b{display:block;line-height:1.2}.brand small{color:var(--muted)}
.search{width:100%;padding:9px 12px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--ink);font:inherit;font-size:14px;margin-bottom:14px}
.nav-sec{margin:14px 0}
.nav-h{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 8px 6px}
.side a[data-link]{display:block;padding:7px 10px;border-radius:8px;color:var(--ink-2);text-decoration:none;font-size:15px;line-height:1.35}
.side a[data-link]:hover{background:var(--line)}
.side a[data-link].active{background:var(--bg);color:var(--ink);font-weight:600;box-shadow:inset 3px 0 0 var(--accent)}
.side-foot{margin:24px 8px 0;font-size:13px;color:var(--muted)}
.menu{display:none}
main{padding:48px clamp(20px,5vw,72px) 96px}
.view{max-width:880px;margin:0 auto}
.crumb{font-size:13px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--accent)}
h1{font-size:clamp(28px,4vw,38px);line-height:1.15;margin:6px 0 10px;letter-spacing:-.02em}
.lede{font-size:18px;color:var(--ink-2);margin:0 0 28px}
.home-h,.steps-h{font-size:20px;margin:40px 0 16px;letter-spacing:-.01em}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.card{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:14px;overflow:hidden;color:inherit;text-decoration:none;background:var(--bg);transition:transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-2px);box-shadow:var(--shadow)}
.card img{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top left;border-bottom:1px solid var(--line)}
.card-b{display:flex;flex-direction:column;gap:4px;padding:14px 16px 16px}
.card-b span{color:var(--ink-2);font-size:14px;line-height:1.45}.card-b small{color:var(--muted);margin-top:4px}
.walk{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--bg-soft);margin:8px 0 8px}
.walk video{display:block;width:100%;background:#000}
.chapters{list-style:none;margin:0;padding:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:2px}
.chapters button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:8px;background:none;color:var(--ink-2);font:inherit;font-size:14px;text-align:left;cursor:pointer}
.chapters button:hover{background:var(--line)}
.chapters button.on{background:var(--bg);color:var(--ink);box-shadow:var(--shadow)}
.ch-n{flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--line);font-size:12px;font-weight:700}
.chapters button.on .ch-n{background:var(--accent);color:#fff}
.ch-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ch-time{color:var(--muted);font-variant-numeric:tabular-nums;font-size:13px}
.steps{list-style:none;margin:0;padding:0;counter-reset:s}
.step{display:grid;grid-template-columns:36px minmax(0,1fr);gap:16px;padding:8px 0 36px;position:relative}
.step:not(:last-child)::before{content:"";position:absolute;left:17px;top:48px;bottom:8px;width:2px;background:var(--line)}
.num{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700}
.step-head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:36px}
.step h3{margin:0;font-size:19px;line-height:1.3}
.seek{flex:none;border:1px solid var(--line);background:var(--bg);color:var(--muted);border-radius:999px;padding:3px 10px;font:inherit;font-size:13px;cursor:pointer}
.seek:hover{color:var(--ink);border-color:var(--muted)}
.step p{margin:6px 0 14px;color:var(--ink-2)}
figure{margin:0}
figure img{display:block;max-width:100%;height:auto;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);cursor:zoom-in}
.callout{border-left:4px solid var(--info-line);background:var(--info);border-radius:0 10px 10px 0;padding:12px 16px;margin:16px 0;font-size:15px;color:var(--ink-2)}
.callout strong{color:var(--ink)}.callout>strong:first-child{margin-right:6px}.callout ul{margin:6px 0 0;padding-left:20px}
.callout.tip{border-color:var(--tip-line);background:var(--tip)}
.callout.warn{border-color:var(--warn-line);background:var(--warn)}
.pager{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px;padding-top:24px;border-top:1px solid var(--line)}
.pager a{display:block;border:1px solid var(--line);border-radius:12px;padding:12px 16px;text-decoration:none;color:var(--ink);font-weight:600}
.pager a:hover{border-color:var(--muted)}.pager small{display:block;color:var(--muted);font-weight:500}
.pager .next{text-align:right}
.empty{color:var(--muted)}
.lightbox{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:24px;background:rgba(2,6,23,.86);cursor:zoom-out}
.lightbox[hidden]{display:none}
.lightbox img{max-width:100%;max-height:100%;border-radius:10px}
@media (max-width:900px){
  .layout{grid-template-columns:1fr}
  .side{position:fixed;inset:0 25% 0 0;z-index:40;transform:translateX(-105%);transition:transform .2s;box-shadow:var(--shadow)}
  body.nav-open .side{transform:none}
  .menu{display:inline-flex;position:sticky;top:0;z-index:30;margin:12px 16px 0;padding:8px 14px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--ink);font:inherit;font-size:14px}
  main{padding-top:20px}
}
@media print{
  .side,.menu,.walk,.seek,.pager,.lightbox,.search{display:none!important}
  .layout{display:block}main{padding:0}
  .view{display:block!important;max-width:none}
  .view[data-view=home]{display:none!important}
  article.view{break-before:page}
  .step{break-inside:avoid}
  figure img{box-shadow:none;max-height:9cm;width:auto}
}
</style>
</head>
<body>
<div class="layout">
  <aside class="side" aria-label="Guides">
    <a class="brand" href="#home"><span class="logo">${initial}</span><span><b>${esc(cfg.productName)}</b><small>User guide</small></span></a>
    <input class="search" type="search" placeholder="Search guides" aria-label="Search guides">
    <nav>${nav}</nav>
    ${updated ? `<div class="side-foot">Updated ${esc(updated)}</div>` : ''}
  </aside>
  <div>
    <button class="menu" type="button" aria-label="Open navigation">☰ Guides</button>
    <main>${home}${articles}</main>
  </div>
</div>
<div class="lightbox" hidden><img alt=""></div>
<script>
(function(){
  var views=[].slice.call(document.querySelectorAll('.view'));
  var links=[].slice.call(document.querySelectorAll('[data-link]'));
  function route(){
    var slug=location.hash.replace(/^#\\/?/,'')||'home';
    if(!views.some(function(v){return v.dataset.view===slug;}))slug='home';
    views.forEach(function(v){var on=v.dataset.view===slug;v.hidden=!on;if(!on)v.querySelectorAll('video').forEach(function(x){x.pause();});});
    links.forEach(function(a){a.classList.toggle('active',a.dataset.link===slug);});
    document.body.classList.remove('nav-open');
    window.scrollTo({top:0,behavior:'instant'});
  }
  addEventListener('hashchange',route);route();

  document.querySelector('.search').addEventListener('input',function(e){
    var q=e.target.value.trim().toLowerCase();
    links.forEach(function(a){a.hidden=q&&a.dataset.search.indexOf(q)<0;});
    document.querySelectorAll('.nav-sec').forEach(function(s){s.hidden=![].some.call(s.querySelectorAll('[data-link]'),function(a){return !a.hidden;});});
  });
  document.querySelector('.menu').addEventListener('click',function(){document.body.classList.toggle('nav-open');});

  document.querySelectorAll('article').forEach(function(art){
    var video=art.querySelector('video');if(!video)return;
    var chapters=[].slice.call(art.querySelectorAll('.chapters button'));
    function seek(t){video.currentTime=parseFloat(t);video.play();}
    chapters.forEach(function(b){b.addEventListener('click',function(){seek(b.dataset.t);});});
    art.querySelectorAll('.seek').forEach(function(b){b.addEventListener('click',function(){art.querySelector('.walk').scrollIntoView({block:'center'});seek(b.dataset.t);});});
    video.addEventListener('timeupdate',function(){
      var cur=-1;chapters.forEach(function(b,i){if(video.currentTime>=parseFloat(b.dataset.t)-0.05)cur=i;});
      chapters.forEach(function(b,i){b.classList.toggle('on',i===cur);});
    });
  });

  var box=document.querySelector('.lightbox'),big=box.querySelector('img');
  document.addEventListener('click',function(e){
    if(e.target.matches('figure img')){big.src=e.target.src;big.alt=e.target.alt;box.hidden=false;}
    else if(!box.hidden&&box.contains(e.target)){box.hidden=true;}
  });
  addEventListener('keydown',function(e){if(e.key==='Escape')box.hidden=true;});
})();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------- main

export async function build({ includeFailed = process.argv.includes('--include-failed') } = {}) {
  loadEnv();
  const cfg = readDocConfig();
  const out = outDir();
  const capturesDir = path.join(out, 'captures');
  const docsDir = path.join(out, 'docs');

  const { flows, failed } = loadFlows(capturesDir, includeFailed);
  fs.rmSync(docsDir, { recursive: true, force: true });
  fs.mkdirSync(docsDir, { recursive: true });

  const bin = flows.some((f) => f.video) ? await findFfmpeg() : null;
  if (flows.some((f) => f.video) && !bin) {
    console.warn('⚠  ffmpeg not found: keeping videos as .webm and skipping GIFs. Set FFMPEG_PATH to fix.');
  }

  for (const f of flows) {
    const src = path.join(capturesDir, f.slug);
    const dest = path.join(docsDir, 'assets', f.slug);
    fs.mkdirSync(dest, { recursive: true });
    for (const s of f.steps) if (s.image) fs.copyFileSync(path.join(src, s.image), path.join(dest, s.image));

    f.media = {};
    if (f.video) {
      if (bin) {
        try {
          const v = convertVideo(bin, cfg, src, f);
          fs.copyFileSync(v.mp4, path.join(dest, 'walkthrough.mp4'));
          f.media.video = 'walkthrough.mp4';
          if (v.gif) {
            fs.copyFileSync(v.gif, path.join(dest, 'walkthrough.gif'));
            f.media.gif = true;
          }
        } catch (err) {
          console.warn(`⚠  Video conversion failed for "${f.title}": ${String(err.message).split('\n')[0]}`);
        }
      }
      if (!f.media.video) {
        fs.copyFileSync(path.join(src, f.video), path.join(dest, 'walkthrough.webm'));
        f.media.video = 'walkthrough.webm';
      }
    }
    fs.writeFileSync(path.join(docsDir, `${f.slug}.md`), flowMarkdown(f, cfg));
  }

  const sections = groupBySection(flows);
  fs.writeFileSync(path.join(docsDir, 'README.md'), indexMarkdown(sections, cfg));
  fs.writeFileSync(path.join(docsDir, 'index.html'), html(sections, flows, cfg));

  const rel = path.relative(process.cwd(), docsDir) || '.';
  console.log(`\n📘 Built ${flows.length} guide${flows.length === 1 ? '' : 's'} → ${rel}/index.html (+ Markdown)`);
  for (const f of failed) {
    console.log(`   ✗ skipped "${f.title}" (failed: ${f.error || 'see test output'}) — see captures/${f.slug}/failure.png`);
  }
  return { flows, failed, docsDir };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) {
  await build();
}
