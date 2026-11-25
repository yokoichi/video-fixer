# Video Fixer 計画
目的: Pixel/Google フォト由来の VP9 mp4 を、Mac/iPhone で再生可能な H.264+AAC mp4 にブラウザ内で変換。サーバー送信なし。
## 構成
- Vite + バニラ JS。`npm run build` → `docs/`（GitHub Pages: main /docs、Cloudflare Pages: output dir docs）
- 主方式: mediabunny (Conversion, WebCodecs)。映像 avc、音声 aac。プリセット: 高画質/標準/軽量=bitrate指定、解像度は元のまま
- 非対応環境（WebCodecs の VideoEncoder/avc 不可、変換失敗）: ffmpeg.wasm 単一スレッド版を CDN(jsDelivr)から遅延ロード。Cloudflare Pages は 25MB/ファイル上限で wasm(31MB) を同梱不可のため CDN。COOP/COEP 不要
- UI: ファイル選択+D&D、複数ファイル、進捗、キャンセル、ダウンロード（`<名前>_h264.mp4`）、プレビュー
- 入力が既に H.264/HEVC でも再エンコードせず通常変換可（forceTranscode は映像が非互換のときのみ）
## 検証
- サンプル VP9 動画をブラウザで変換→出力コーデックを確認(mdls)
