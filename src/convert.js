import {
  Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat,
  ALL_FORMATS, QUALITY_VERY_HIGH, QUALITY_HIGH, QUALITY_MEDIUM,
} from 'mediabunny';

export const PRESETS = {
  high: { label: '高画質', quality: QUALITY_VERY_HIGH, crf: 20 },
  standard: { label: '標準', quality: QUALITY_HIGH, crf: 24 },
  light: { label: '軽量', quality: QUALITY_MEDIUM, crf: 28 },
};

// MP4/MOV の moov > mvhd から作成日時を読む（先頭からボックスヘッダだけを辿るので軽い）
async function readMvhdCreation(file) {
  try {
    let pos = 0;
    while (pos + 8 <= file.size) {
      const dv = new DataView(await file.slice(pos, pos + 16).arrayBuffer());
      let size = dv.getUint32(0);
      const type = String.fromCharCode(dv.getUint8(4), dv.getUint8(5), dv.getUint8(6), dv.getUint8(7));
      let header = 8;
      if (size === 1) { size = Number(dv.getBigUint64(8)); header = 16; }
      else if (size === 0) size = file.size - pos;
      if (type === 'moov') {
        const m = new DataView(await file.slice(pos + header, pos + header + 32).arrayBuffer());
        if (String.fromCharCode(m.getUint8(4), m.getUint8(5), m.getUint8(6), m.getUint8(7)) !== 'mvhd') return null;
        const secs = m.getUint8(8) === 1 ? Number(m.getBigUint64(12)) : m.getUint32(12);
        const d = new Date((secs - 2082844800) * 1000);
        return secs > 0 && d.getUTCFullYear() > 1990 ? d : null;
      }
      if (size < 8) return null;
      pos += size;
    }
  } catch { /* 読めなければ次の候補へ */ }
  return null;
}

// PXL_YYYYMMDD_HHMMSSmmm（UTC）から撮影日時を推定
function dateFromName(name) {
  const m = /(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/.exec(name);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
}

export const outputName = (name) => name.replace(/\.[^.]+$/, '') + '_h264.mp4';

export function webCodecsSupported() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
}

/** WebCodecs 方式。返り値: { blob, cancel } 形式ではなく、job を返して cancel 可能にする */
export function startWebCodecs(file, presetKey, onProgress) {
  const preset = PRESETS[presetKey];
  let conversion = null;
  let canceled = false;
  const promise = (async () => {
    const created = await readMvhdCreation(file);
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    });
    // 既に H.264 の映像は再エンコードせずコピー（HEVC/VP9/AV1 は H.264 へ変換）
    const vTrack = await input.getPrimaryVideoTrack();
    const video = vTrack?.codec === 'avc'
      ? { codec: 'avc' }
      : { codec: 'avc', bitrate: preset.quality, forceTranscode: true };
    conversion = await Conversion.init({
      input, output,
      video,
      audio: { codec: 'aac' },
      // 元のメタデータ（位置情報・日付などの raw タグ含む）を引き継ぎ、作成日時も保持する
      tags: (t) => ({ ...t, creationTime: created ?? t.creationTime ?? t.date ?? dateFromName(file.name) ?? new Date(file.lastModified) }),
      showWarnings: false,
    });
    if (canceled) throw new Error('canceled');
    // 音声/映像が黙って脱落した場合も失敗扱い（互換モードへフォールバックさせる）
    const dropped = conversion.discardedTracks.filter((t) => t.reason !== 'discarded_by_user');
    if (!conversion.isValid || dropped.length) {
      const reasons = dropped.map((t) => `${t.track.type}:${t.reason}`).join(', ');
      throw new Error('このブラウザでは完全には変換できません (' + reasons + ')');
    }
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    return new Blob([output.target.buffer], { type: 'video/mp4' });
  })();
  return { promise, cancel: () => { canceled = true; conversion?.cancel(); } };
}
