import { useRef, useEffect, useCallback } from 'react';

const BASE_SIZE = 110;  // ジョイスティック外円の直径(px)
const KNOB_SIZE =  44;  // 内円の直径(px)
const MAX_DELTA = (BASE_SIZE - KNOB_SIZE) / 2; // 最大変位(px)

/**
 * バーチャルジョイスティック
 *
 * onMove({ x, y }) を毎フレーム呼び出す。
 *   x: -1(左回転) 〜 +1(右回転)
 *   y: -1(後退)   〜 +1(前進)  ← 上 = 前進
 */
export default function Joystick({ onMove }) {
  const baseRef  = useRef(null);
  const knobRef  = useRef(null);
  const stateRef = useRef({ x: 0, y: 0, active: false, touchId: null });
  const rafRef   = useRef(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  // アニメーションループ: 毎フレーム現在値を通知
  useEffect(() => {
    const loop = () => {
      const { x, y } = stateRef.current;
      onMoveRef.current({ x, y });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const updateKnob = useCallback((clientX, clientY) => {
    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;

    // 円の範囲内にクランプ
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MAX_DELTA) {
      const ratio = MAX_DELTA / dist;
      dx *= ratio;
      dy *= ratio;
    }

    // ノブ位置を更新
    const knob = knobRef.current;
    knob.style.left = `calc(50% + ${dx}px)`;
    knob.style.top  = `calc(50% + ${dy}px)`;

    // 正規化値 (-1 〜 1) を保存
    //  x: 左右回転、y: 前後移動 (上向き = +1 = 前進 なので dy を反転)
    stateRef.current.x =  dx / MAX_DELTA;
    stateRef.current.y = -dy / MAX_DELTA;
  }, []);

  const resetKnob = useCallback(() => {
    stateRef.current.x = 0;
    stateRef.current.y = 0;
    stateRef.current.active  = false;
    stateRef.current.touchId = null;
    const knob = knobRef.current;
    if (knob) {
      knob.style.left = '50%';
      knob.style.top  = '50%';
    }
  }, []);

  // タッチイベント
  const onTouchStart = useCallback((e) => {
    e.stopPropagation();
    if (stateRef.current.active) return;
    const t = e.changedTouches[0];
    stateRef.current.active  = true;
    stateRef.current.touchId = t.identifier;
    updateKnob(t.clientX, t.clientY);
  }, [updateKnob]);

  const onTouchMove = useCallback((e) => {
    e.stopPropagation();
    const t = Array.from(e.changedTouches).find(
      (x) => x.identifier === stateRef.current.touchId
    );
    if (t) updateKnob(t.clientX, t.clientY);
  }, [updateKnob]);

  const onTouchEnd = useCallback((e) => {
    e.stopPropagation();
    const released = Array.from(e.changedTouches).some(
      (t) => t.identifier === stateRef.current.touchId
    );
    if (released) resetKnob();
  }, [resetKnob]);

  // マウスイベント (PC でも使えるように)
  const onMouseDown = useCallback((e) => {
    stateRef.current.active = true;
    updateKnob(e.clientX, e.clientY);
    const onMove_ = (ev) => { if (stateRef.current.active) updateKnob(ev.clientX, ev.clientY); };
    const onUp    = ()   => { resetKnob(); window.removeEventListener('mousemove', onMove_); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove_);
    window.addEventListener('mouseup',   onUp);
  }, [updateKnob, resetKnob]);

  return (
    <div
      ref={baseRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onMouseDown={onMouseDown}
      style={{
        width:           BASE_SIZE,
        height:          BASE_SIZE,
        borderRadius:    '50%',
        background:      'rgba(255,255,255,0.15)',
        backdropFilter:  'blur(4px)',
        border:          '2px solid rgba(255,255,255,0.4)',
        position:        'relative',
        touchAction:     'none',
        userSelect:      'none',
        WebkitUserSelect:'none',
      }}
    >
      {/* ガイドライン (十字) */}
      <div style={crossLine('horizontal')} />
      <div style={crossLine('vertical')} />

      {/* ノブ */}
      <div
        ref={knobRef}
        style={{
          position:      'absolute',
          width:          KNOB_SIZE,
          height:         KNOB_SIZE,
          borderRadius:  '50%',
          background:    'rgba(255,255,255,0.85)',
          boxShadow:     '0 2px 8px rgba(0,0,0,0.3)',
          left:          '50%',
          top:           '50%',
          transform:     'translate(-50%, -50%)',
          pointerEvents: 'none',
          transition:    'none',
        }}
      />

      {/* 移動方向ラベル */}
      <span style={{ ...arrowLabel, top: 4,  left: '50%', transform: 'translateX(-50%)' }}>▲</span>
      <span style={{ ...arrowLabel, bottom: 4, left: '50%', transform: 'translateX(-50%)' }}>▼</span>
      <span style={{ ...arrowLabel, left: 4,  top: '50%', transform: 'translateY(-50%)' }}>◀</span>
      <span style={{ ...arrowLabel, right: 4, top: '50%', transform: 'translateY(-50%)' }}>▶</span>
    </div>
  );
}

const crossLine = (dir) => ({
  position: 'absolute',
  background: 'rgba(255,255,255,0.2)',
  ...(dir === 'horizontal'
    ? { top: '50%', left: 0, right: 0, height: 1, transform: 'translateY(-50%)' }
    : { left: '50%', top: 0, bottom: 0, width: 1, transform: 'translateX(-50%)' }),
});

const arrowLabel = {
  position: 'absolute',
  color: 'rgba(255,255,255,0.5)',
  fontSize: 10,
  pointerEvents: 'none',
  lineHeight: 1,
};
