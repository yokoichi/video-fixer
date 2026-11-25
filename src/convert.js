import {
  Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat,
  ALL_FORMATS, QUALITY_VERY_HIGH, QUALITY_HIGH, QUALITY_MEDIUM,
} from 'mediabunny';

export const PRESETS = {
  high: { label: '高画質', quality: QUALITY_VERY_HIGH, crf: 20 },
  standard: { label: '標準', quality: QUALITY_HIGH, crf: 24 },
  light: { label: '軽量', quality: QUALITY_MEDIUM, crf: 28 },
};

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
