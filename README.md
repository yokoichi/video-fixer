# Video Fixer
VP9 mp4（Pixel / Google フォト）を H.264 + AAC に変換するブラウザ完結ツール。
- 開発: `npm i && npm run dev` / ビルド: `npm run build`（出力 `docs/`）
- GitHub Pages: Settings → Pages → main /docs
- Cloudflare Pages: Build command `npm run build`、Output directory `docs`
- 主方式 WebCodecs（高速）、非対応時は ffmpeg.wasm を jsDelivr から遅延ロード（低速）
