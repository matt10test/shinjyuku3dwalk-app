# 新宿3D探索Webアプリ

## GitHubリポジトリ
https://github.com/matt10test/shinjyuku3dwalk.git

## 開発サーバー起動
```
npm run dev
```

## PLATEAUデータ変換
```
npm run convert
```
`13104_shinjuku-ku_pref_2025_citygml_1_op.zip` を `public/plateau-buildings.geojson` に変換する。

## デプロイ先
https://matt10test.github.io/shinjyuku3dwalk/

## 技術スタック
| 用途 | ライブラリ・ツール |
|------|-------------------|
| UIフレームワーク | React 18 |
| ビルドツール | Vite 5 |
| 3D地図描画 | MapLibre GL 4 |
| 3Dモデル | Three.js 0.169 |
| 地図データ | PLATEAU CityGML / OpenStreetMap |
| デプロイ | GitHub Pages（GitHub Actions自動デプロイ） |
| データ変換 | Node.js スクリプト（sax, unzipper） |

## コンポーネント命名規約
- ファイル名・コンポーネント名はPascalCase（例: `MapView.jsx`, `SpotSelector.jsx`）
- コンポーネントは `src/components/` に配置する
- アプリのルートは `src/App.jsx`、エントリーポイントは `src/main.jsx`
- 定数・設定値はファイル先頭にまとめてアッパースネークケースで定義（例: `BUILDING_COLOR`, `SPOTS`）

## Git運用ルール
- コードを変更するたびに、変更内容をコミットしてGitHubにプッシュする。
- プッシュ先: https://github.com/matt10test/shinjyuku3dwalk.git（ブランチ: main）
- GitHub Pagesへの反映はプッシュ後に自動でデプロイされる（1〜2分）。
