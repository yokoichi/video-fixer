// ffmpeg.wasm（単一スレッド版）。コアは 31MB で Cloudflare Pages の 25MB 上限を超えるため CDN から遅延ロード。
const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
import { PRESETS } from './convert.js';

export function startFfmpeg(file, presetKey, onProgress, onStatus) {
  let ffmpeg = null;
  let canceled = false;
  const promise = (async () => {
    const [{ FFmpeg }, { toBlobURL, fetchFile }] = await Promise.all([
      import('@ffmpeg/ffmpeg'), import('@ffmpeg/util'),
    ]);
    ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress }) => onProgress(Math.min(1, Math.max(0, progress))));
    onStatus('変換エンジンを読み込み中（約30MB）…');
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    if (canceled) throw new Error('canceled');
    onStatus('変換中（互換モード・低速）…');
    await ffmpeg.writeFile('in', await fetchFile(file));
    const code = await ffmpeg.exec([
      '-i', 'in', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(PRESETS[presetKey].crf),
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', 'out.mp4',
    ]);
    if (code !== 0) throw new Error('ffmpeg が失敗しました (code ' + code + ')');
    const data = await ffmpeg.readFile('out.mp4');
    ffmpeg.terminate();
    return new Blob([data.buffer], { type: 'video/mp4' });
  })();
  return { promise, cancel: () => { canceled = true; ffmpeg?.terminate(); } };
}
