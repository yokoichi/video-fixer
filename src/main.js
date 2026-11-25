import { PRESETS, outputName, startWebCodecs, webCodecsSupported } from './convert.js';
import './style.css';

const $ = (s) => document.querySelector(s);
const drop = $('#drop'), picker = $('#picker'), list = $('#list'), preset = $('#preset');
for (const [k, v] of Object.entries(PRESETS)) preset.append(new Option(v.label, k, false, k === 'standard'));
if (!webCodecsSupported()) $('#note').hidden = false;

drop.addEventListener('click', () => picker.click());
picker.addEventListener('change', () => { addFiles(picker.files); picker.value = ''; });
['dragenter', 'dragover'].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (ev) => addFiles(ev.dataTransfer.files));

const queue = [];
let running = false;

function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv|m4v)$/i.test(file.name)) continue;
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = '<div class="name"></div><div class="status">待機中</div><progress max="1" value="0"></progress><div class="actions"></div>';
    el.querySelector('.name').textContent = file.name;
    list.append(el);
    queue.push({ file, el, preset: preset.value });
  }
  pump();
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) await run(queue.shift());
  running = false;
}

async function run({ file, el, preset }) {
  const status = el.querySelector('.status'), bar = el.querySelector('progress'), actions = el.querySelector('.actions');
  const cancelBtn = Object.assign(document.createElement('button'), { textContent: 'キャンセル' });
  actions.append(cancelBtn);
  const t0 = performance.now();
  let job;
  const tryJob = async (starter) => {
    job = starter();
    cancelBtn.onclick = () => job.cancel();
    return job.promise;
  };
  let blob;
  try {
    status.textContent = '変換中…';
    try {
      if (!webCodecsSupported()) throw new Error('no webcodecs');
      blob = await tryJob(() => startWebCodecs(file, preset, (p) => { bar.value = p; status.textContent = `変換中 ${Math.round(p * 100)}%`; }));
    } catch (e) {
      if (String(e.message) === 'canceled') throw e;
      console.warn('WebCodecs 失敗、互換モードへ:', e);
      bar.value = 0;
      const { startFfmpeg } = await import('./fallback.js');
      blob = await tryJob(() => startFfmpeg(file, preset, (p) => { bar.value = p; status.textContent = `互換モード変換中 ${Math.round(p * 100)}%`; }, (s) => { status.textContent = s; }));
    }
    bar.value = 1;
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: outputName(file.name), textContent: `ダウンロード (${(blob.size / 1048576).toFixed(1)} MB)`, className: 'dl' });
    const v = Object.assign(document.createElement('video'), { src: url, controls: true, playsInline: true, muted: true });
    actions.replaceChildren(a);
    el.append(v);
    status.textContent = `完了 (${((performance.now() - t0) / 1000).toFixed(1)} 秒)`;
  } catch (e) {
    status.textContent = String(e.message) === 'canceled' ? 'キャンセルしました' : '失敗: ' + e.message;
    actions.replaceChildren();
    el.classList.add('error');
  }
}
