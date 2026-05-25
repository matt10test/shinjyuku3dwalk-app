import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MOVE_SPEED = 0.000010; // ~1m / frame
const ROT_SPEED  = 2.0;      // °  / frame

const BUILDING_COLOR = '#00e5ff';

export default function MapView({ initialSpot, joystickRef, onMapReady, onCharacterReady }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const keysRef      = useRef(new Set());
  const rafRef       = useRef(null);

  useEffect(() => {
    // ---- MapLibre 初期化 ----
    const map = new maplibregl.Map({
      container:  containerRef.current,
      style:      'https://tiles.openfreemap.org/styles/liberty',
      center:     initialSpot.center,
      zoom:       19,
      pitch:      70,
      bearing:    initialSpot.bearing,
      antialias:  false,
      maxPitch:   80,
    });

    mapRef.current = map;

    // ドラッグパン無効化 → 独自タッチ/マウスで視点制御
    map.dragPan.disable();

    // ---- ゲームループ (WASD + ジョイスティック) ----
    const gameLoop = () => {
      const m   = mapRef.current;
      const joy = joystickRef?.current ?? { x: 0, y: 0 };
      const keys = keysRef.current;

      // 回転
      let dr = joy.x * ROT_SPEED;
      if (keys.has('a') || keys.has('A') || keys.has('ArrowLeft'))  dr -= ROT_SPEED;
      if (keys.has('d') || keys.has('D') || keys.has('ArrowRight')) dr += ROT_SPEED;
      if (dr) m.setBearing(m.getBearing() + dr);

      // 前後移動
      let fwd = joy.y;
      if (keys.has('w') || keys.has('W') || keys.has('ArrowUp'))   fwd += 1;
      if (keys.has('s') || keys.has('S') || keys.has('ArrowDown'))  fwd -= 1;
      if (fwd !== 0) {
        const rad = m.getBearing() * (Math.PI / 180);
        const { lng, lat } = m.getCenter();
        m.setCenter([
          lng + Math.sin(rad) * fwd * MOVE_SPEED,
          lat + Math.cos(rad) * fwd * MOVE_SPEED,
        ]);
      }

      rafRef.current = requestAnimationFrame(gameLoop);
    };
    rafRef.current = requestAnimationFrame(gameLoop);

    // ---- キーボード ----
    const onKeyDown = (e) => {
      const nav = ['w','a','s','d','W','A','S','D','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
      if (nav.includes(e.key)) { e.preventDefault(); keysRef.current.add(e.key); }
    };
    const onKeyUp = (e) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);

    // ---- マウスドラッグ → 視点回転 ----
    let mouseDown = false, mouseStartX = 0, startBearing = 0;
    const canvas  = map.getCanvas();

    const onMouseDown = (e) => { mouseDown = true;  mouseStartX = e.clientX; startBearing = map.getBearing(); };
    const onMouseMove = (e) => { if (mouseDown) map.setBearing(startBearing + (e.clientX - mouseStartX) * 0.3); };
    const onMouseUp   = ()  => { mouseDown = false; };
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);

    // ---- タッチドラッグ → 視点回転 ----
    let touchId = null, touchStartX = 0, touchBearing = 0;

    const onTouchStart = (e) => {
      if (touchId !== null) return;
      const t = e.changedTouches[0];
      touchId = t.identifier; touchStartX = t.clientX; touchBearing = map.getBearing();
    };
    const onTouchMove = (e) => {
      if (touchId === null) return;
      const t = Array.from(e.changedTouches).find(x => x.identifier === touchId);
      if (t) map.setBearing(touchBearing + (t.clientX - touchStartX) * 0.3);
    };
    const onTouchEnd = (e) => {
      if ([...e.changedTouches].some(t => t.identifier === touchId)) touchId = null;
    };
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: true });
    canvas.addEventListener('touchend',   onTouchEnd);

    // ---- Three.js 状態 ----
    const ls = {
      character: null, mixer: null,
      idleAction: null, walkAction: null,
      jumpHeight: 0, isJumping: false, jumpStart: 0,
      lastTime: null,
    };

    // ---- Three.js カスタムレイヤー ----
    const layer = {
      id: 'three-character',
      type: 'custom',
      renderingMode: '3d',

      onAdd(m, gl) {
        this._map    = m;
        this._camera = new THREE.Camera();
        this._scene  = new THREE.Scene();

        // ライティング
        this._scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(0.5, 1, 0.5).normalize();
        this._scene.add(sun);

        // Soldier.glb (Three.js examples) を読み込む
        const loader = new GLTFLoader();
        loader.load(
          `${import.meta.env.BASE_URL}Soldier.glb`,
          (gltf) => {
            ls.character = gltf.scene;
            gltf.scene.traverse((child) => {
              if (!child.isMesh) return;
              child.material = child.material.clone();
              child.material.color.set(0xff2200);
            });
            this._scene.add(gltf.scene);

            ls.mixer      = new THREE.AnimationMixer(gltf.scene);
            const clips   = gltf.animations;
            // Soldier.glb のクリップ名は小文字 (idle, walk, run)
            const findClip = (n) =>
              THREE.AnimationClip.findByName(clips, n) ||
              THREE.AnimationClip.findByName(clips, n.toLowerCase()) ||
              clips[0];
            ls.idleAction = ls.mixer.clipAction(findClip('Idle'));
            ls.walkAction = ls.mixer.clipAction(findClip('Walk'));
            ls.idleAction.play();
            m.triggerRepaint(); // ロード完了後すぐに描画開始

            onCharacterReady({
              setWalking: (v) => {
                if (v) { ls.idleAction?.stop(); ls.walkAction?.play(); }
                else   { ls.walkAction?.stop(); ls.idleAction?.play(); }
              },
              jump: () => {
                if (ls.isJumping) return;
                ls.isJumping = true;
                ls.jumpStart = performance.now();
                m.triggerRepaint();
              },
            });
          },
          undefined,
          () => {
            // 読み込み失敗時のフォールバック: オレンジのボックス
            const mesh = new THREE.Mesh(
              new THREE.BoxGeometry(0.5, 1.75, 0.3),
              new THREE.MeshPhongMaterial({ color: 0xff6b35 }),
            );
            mesh.position.y = 0.875;
            ls.character = mesh;
            this._scene.add(mesh);
            m.triggerRepaint();

            onCharacterReady({
              setWalking: () => {},
              jump: () => {
                if (ls.isJumping) return;
                ls.isJumping = true;
                ls.jumpStart = performance.now();
                m.triggerRepaint();
              },
            });
          },
        );

        this._renderer = new THREE.WebGLRenderer({
          canvas:   m.getCanvas(),
          context:  gl,
          antialias: false,
        });
        this._renderer.autoClear = false;
      },

      render(_gl, matrix) {
        const m = this._map;

        // ジャンプ高さ更新
        if (ls.isJumping) {
          const t = (performance.now() - ls.jumpStart) / 700;
          ls.jumpHeight = t < 1 ? Math.sin(t * Math.PI) * 15 : 0;
          if (t >= 1) ls.isJumping = false;
        }

        // アニメーション更新
        const now = performance.now();
        if (ls.lastTime !== null && ls.mixer) {
          ls.mixer.update((now - ls.lastTime) / 1000);
        }
        ls.lastTime = now;

        // 建物が3Dに見えるようキャラクターをマップ中心に配置
        const center = m.getCenter();
        const mc = maplibregl.MercatorCoordinate.fromLngLat(
          [center.lng, center.lat], ls.jumpHeight
        );
        const scale = mc.meterInMercatorCoordinateUnits() * 2.9; // ~5m (1.75m × 2.9)

        // MapLibre公式パターン: translate → scale(Y反転) → rotateX(π/2)でThree.js Y軸を高度軸に合わせる
        const modelMat = new THREE.Matrix4()
          .makeTranslation(mc.x, mc.y, mc.z)
          .scale(new THREE.Vector3(scale, -scale, scale))
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

        if (ls.character) {
          ls.character.rotation.y = -m.getBearing() * Math.PI / 180;
        }

        this._camera.projectionMatrix = new THREE.Matrix4()
          .fromArray(matrix)
          .multiply(modelMat);

        this._renderer.resetState();
        this._renderer.state.buffers.depth.setTest(false);
        this._renderer.render(this._scene, this._camera);

        // 常に再描画をトリガー (アニメーション・ジャンプ連続更新)
        m.triggerRepaint();
      },
    };

    // ---- スタイル読み込み後に建物→キャラクター の順で追加 ----
    map.on('style.load', () => {
      // 背景を黒・地面を半透明紺色に
      map.getStyle().layers.forEach((l) => {
        if (l.type === 'background') {
          map.setPaintProperty(l.id, 'background-color', '#000000');
          map.setPaintProperty(l.id, 'background-opacity', 1);
        } else if (l.type === 'fill') {
          const id = l.id.toLowerCase();
          if (!id.includes('water') && !id.includes('ocean') && !id.includes('building')) {
            map.setPaintProperty(l.id, 'fill-color', '#0d1b4b');
            map.setPaintProperty(l.id, 'fill-opacity', 0.7);
          }
        }
      });

      // PLATEAU GeoJSON があれば使用、なければ OSM ビルディング
      // キャラクターは建物の後に追加して必ず上に描画されるようにする
      fetch(`${import.meta.env.BASE_URL}plateau-buildings.geojson`, { method: 'HEAD' })
        .then((r) => {
          if (r.ok) {
            map.addSource('plateau-buildings', {
              type: 'geojson',
              data: `${import.meta.env.BASE_URL}plateau-buildings.geojson`,
            });
            addBuildingLayer(map, 'plateau-buildings');
          } else {
            addOsmBuildings(map);
          }
        })
        .catch(() => addOsmBuildings(map))
        .finally(() => {
          map.addSource('police-buildings', { type: 'geojson', data: `${import.meta.env.BASE_URL}police-buildings.geojson` });
          map.addLayer({
            id: 'police-3d', type: 'fill-extrusion', source: 'police-buildings',
            paint: {
              'fill-extrusion-color':   BUILDING_COLOR,
              'fill-extrusion-height':  ['get', 'height'],
              'fill-extrusion-base':    0,
              'fill-extrusion-opacity': 0.06,
            },
          });
          // 建物レイヤー追加完了後にキャラクターレイヤーを追加
          map.addLayer(layer);
          onMapReady(map);
        });
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
      map.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, background: '#000' }}
    />
  );
}

// PLATEAU GeoJSON ソースで建物レイヤーを追加
function addBuildingLayer(map, source) {
  const firstLabel = map.getStyle().layers.find(
    (l) => l.type === 'symbol' && l.layout?.['text-field']
  )?.id;

  map.addLayer({
    id:           'plateau-3d-buildings',
    source:       source,
    type:         'fill-extrusion',
    paint: {
      'fill-extrusion-color':   BUILDING_COLOR,
      'fill-extrusion-height':  ['coalesce', ['get', 'height'], 10],
      'fill-extrusion-base':    ['coalesce', ['get', 'min_height'], 0],
      'fill-extrusion-opacity': 0.06,
    },
  }, firstLabel);
}

// OSM ビルディングで代替 (OpenFreeMap スタイルの openmaptiles ソース)
function addOsmBuildings(map) {
  const sources = map.getStyle().sources;
  const src = Object.keys(sources).find(
    (k) => sources[k].type === 'vector' || k.includes('openmaptiles')
  );
  if (!src) return;

  const firstLabel = map.getStyle().layers.find(
    (l) => l.type === 'symbol' && l.layout?.['text-field']
  )?.id;

  map.addLayer({
    id:           'osm-3d-buildings',
    source:       src,
    'source-layer': 'building',
    type:         'fill-extrusion',
    minzoom:      15,
    paint: {
      'fill-extrusion-color':   BUILDING_COLOR,
      'fill-extrusion-height':  ['coalesce', ['get', 'render_height'], ['get', 'height'], 10],
      'fill-extrusion-base':    ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
      'fill-extrusion-opacity': 0.06,
    },
  }, firstLabel);
}
