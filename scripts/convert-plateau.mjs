/**
 * CityGML (PLATEAU) → GeoJSON 変換スクリプト
 * 使い方: npm run convert
 *
 * 13104_shinjuku-ku_pref_2025_citygml_1_op.zip から建物データを抽出し
 * public/plateau-buildings.geojson に出力します。
 */

import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sax from 'sax';
import unzipper from 'unzipper';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZIP_PATH = path.join(__dirname, '../13104_shinjuku-ku_pref_2025_citygml_1_op.zip');
const OUT_DIR  = path.join(__dirname, '../public');
const OUT_FILE = path.join(OUT_DIR, 'plateau-buildings.geojson');

// 戸塚警察署前(スタート地点)を中心とした探索エリア
// 余裕を持たせて約4km四方をカバーするタイルを処理する
const TARGET_TILES = [
  '53394535', '53394536', '53394537', '53394538', '53394539',
  '53394545', '53394546', '53394547', '53394548', '53394549',
  '53394554', '53394555', '53394556', '53394557', '53394558', '53394559',
  '53394563', '53394564', '53394565', '53394566',
];

/**
 * GMLストリームを解析して GeoJSON Feature 配列を返す
 * bldg:lod0RoofEdge (屋根輪郭 = 建物フットプリント) と
 * bldg:measuredHeight を抽出する。
 * 座標系: EPSG:6697 → lat, lon, alt の順
 */
function parseGML(stream) {
  return new Promise((resolve) => {
    const features = [];
    const parser = sax.createStream(true, { trim: true, lowercase: false });

    let inBuilding      = false;
    let inRoofEdge      = false;
    let inPosList       = false;
    let inMeasuredH     = false;
    let measuredHeight  = null;
    let posListBuf      = '';

    parser.on('opentag', ({ name }) => {
      if (name === 'bldg:Building') {
        inBuilding     = true;
        measuredHeight = null;
        posListBuf     = '';
      }
      if (!inBuilding) return;
      if (name === 'bldg:measuredHeight') inMeasuredH = true;
      if (name === 'bldg:lod0RoofEdge')   inRoofEdge  = true;
      if (inRoofEdge && name === 'gml:posList') {
        inPosList  = true;
        posListBuf = '';
      }
    });

    parser.on('text', (text) => {
      if (inMeasuredH)                   measuredHeight = parseFloat(text);
      if (inPosList && inRoofEdge)       posListBuf    += text;
    });

    parser.on('closetag', (name) => {
      if (name === 'bldg:measuredHeight') { inMeasuredH = false; }

      if (name === 'gml:posList' && inPosList) {
        inPosList = false;
      }

      if (name === 'bldg:lod0RoofEdge' && inRoofEdge) {
        inRoofEdge = false;

        // lat lon alt lat lon alt ... → [lon, lat] (GeoJSON)
        const nums = posListBuf.trim().split(/\s+/).map(Number);
        if (nums.length < 9) return; // 最低3頂点

        const ring = [];
        for (let i = 0; i + 2 < nums.length; i += 3) {
          ring.push([
            Math.round(nums[i + 1] * 1e7) / 1e7, // lon
            Math.round(nums[i]     * 1e7) / 1e7, // lat
          ]);
        }

        if (ring.length >= 3) {
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [ring] },
            properties: {
              height:     measuredHeight !== null ? measuredHeight : 10,
              min_height: 0,
            },
          });
        }
        posListBuf = '';
      }

      if (name === 'bldg:Building') {
        inBuilding = false;
      }
    });

    parser.on('end',   ()    => resolve(features));
    parser.on('error', (err) => {
      // SAX エラーは非致命的 — そのまま続行
      console.warn('  SAX error (ignored):', err.message);
      resolve(features);
    });

    stream.pipe(parser);
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('📦 ZIPを開いています...');
  const directory = await unzipper.Open.file(ZIP_PATH);

  const fileMap = {};
  for (const f of directory.files) {
    fileMap[f.path] = f;
  }

  let allFeatures   = [];
  let processed     = 0;

  for (const tile of TARGET_TILES) {
    const entryPath = `udx/bldg/${tile}_bldg_6697_op.gml`;
    const entry = fileMap[entryPath];
    if (!entry) {
      console.log(`  スキップ: ${tile} (ファイルなし)`);
      continue;
    }

    const mb = (entry.uncompressedSize / 1024 / 1024).toFixed(1);
    process.stdout.write(`  ${tile} (${mb}MB) 処理中...`);

    const stream = entry.stream();
    const features = await parseGML(stream);
    allFeatures = allFeatures.concat(features);
    processed++;
    console.log(` → ${features.length.toLocaleString()} 棟`);
  }

  console.log(`\n✅ 合計 ${allFeatures.length.toLocaleString()} 棟 (${processed}タイル)`);
  console.log('💾 GeoJSON を書き込んでいます...');

  const geojson = {
    type: 'FeatureCollection',
    features: allFeatures,
  };

  await new Promise((resolve, reject) => {
    const ws = createWriteStream(OUT_FILE);
    ws.write(JSON.stringify(geojson));
    ws.end();
    ws.on('finish', resolve);
    ws.on('error', reject);
  });

  const sizeKB = Math.round(JSON.stringify(geojson).length / 1024);
  console.log(`📁 保存完了: plateau-buildings.geojson (${sizeKB.toLocaleString()} KB)`);
}

main().catch(console.error);
