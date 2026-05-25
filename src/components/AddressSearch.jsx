import { useState, useCallback } from 'react';

/**
 * 住所検索コンポーネント
 * 国土地理院 ジオコーディング API を使用 (APIキー不要・無料)
 * https://msearch.gsi.go.jp/address-search/AddressSearch?q=QUERY
 */
export default function AddressSearch({ onSearch, loading }) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  }, [query, onSearch]);

  return (
    <div style={styles.wrapper}>
      {!open ? (
        <button style={styles.toggleBtn} onClick={() => setOpen(true)}>
          🔍 住所で移動
        </button>
      ) : (
        <form style={styles.form} onSubmit={handleSubmit}>
          <input
            style={styles.input}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例: 新宿区西早稲田3-30-13"
            autoFocus
          />
          <button style={styles.searchBtn} type="submit" disabled={loading}>
            {loading ? '…' : '移動'}
          </button>
          <button
            style={{ ...styles.searchBtn, background: 'rgba(255,255,255,0.1)' }}
            type="button"
            onClick={() => { setOpen(false); setQuery(''); }}
          >
            ✕
          </button>
        </form>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'absolute',
    top: 52,
    right: 12,
    zIndex: 20,
  },
  toggleBtn: {
    padding:         '7px 14px',
    background:      'rgba(0,0,0,0.5)',
    backdropFilter:  'blur(4px)',
    border:          '1px solid rgba(255,255,255,0.2)',
    borderRadius:    20,
    color:           '#fff',
    fontSize:        13,
    cursor:          'pointer',
    whiteSpace:      'nowrap',
  },
  form: {
    display:    'flex',
    gap:         6,
    alignItems: 'center',
  },
  input: {
    width:           200,
    padding:         '7px 10px',
    background:      'rgba(0,0,0,0.6)',
    backdropFilter:  'blur(4px)',
    border:          '1px solid rgba(255,255,255,0.3)',
    borderRadius:    8,
    color:           '#fff',
    fontSize:        13,
    outline:         'none',
  },
  searchBtn: {
    padding:         '7px 12px',
    background:      'rgba(60,130,255,0.7)',
    backdropFilter:  'blur(4px)',
    border:          '1px solid rgba(255,255,255,0.2)',
    borderRadius:    8,
    color:           '#fff',
    fontSize:        13,
    cursor:          'pointer',
    whiteSpace:      'nowrap',
  },
};
