/**
 * クイックジャンプ スポットセレクター
 */
export default function SpotSelector({ spots, active, onSelect, onClose }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>スポット一覧</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <ul style={styles.list}>
          {spots.map((spot) => (
            <li
              key={spot.id}
              style={{
                ...styles.item,
                ...(spot.id === active.id ? styles.itemActive : {}),
              }}
              onClick={() => onSelect(spot)}
            >
              <span style={styles.pin}>📍</span>
              <span>{spot.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position:        'fixed',
    inset:            0,
    background:      'rgba(0,0,0,0.4)',
    zIndex:           30,
    display:         'flex',
    alignItems:      'flex-start',
    justifyContent:  'flex-end',
    padding:         '56px 12px 0',
  },
  panel: {
    background:      'rgba(15,15,20,0.92)',
    backdropFilter:  'blur(8px)',
    border:          '1px solid rgba(255,255,255,0.12)',
    borderRadius:    12,
    minWidth:        200,
    overflow:        'hidden',
  },
  header: {
    display:         'flex',
    justifyContent:  'space-between',
    alignItems:      'center',
    padding:         '10px 14px',
    borderBottom:    '1px solid rgba(255,255,255,0.08)',
  },
  title: {
    color:    '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeBtn: {
    background: 'none',
    border:     'none',
    color:      'rgba(255,255,255,0.5)',
    fontSize:    16,
    cursor:     'pointer',
    padding:     0,
    lineHeight:  1,
  },
  list: {
    listStyle: 'none',
    padding:   '6px 0',
    margin:     0,
  },
  item: {
    display:    'flex',
    alignItems: 'center',
    gap:         8,
    padding:   '10px 16px',
    cursor:    'pointer',
    color:     'rgba(255,255,255,0.85)',
    fontSize:   14,
    transition: 'background 0.15s',
  },
  itemActive: {
    background: 'rgba(60,130,255,0.25)',
    color:      '#fff',
  },
  pin: {
    fontSize: 16,
  },
};
