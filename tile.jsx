// tile.jsx — tile with swipe-to-dismiss, save, tags

const { useState: useState_t, useRef: useRef_t, useEffect: useEffect_t } = React;

function Tile({ tile, comments, dismissing, me, onDismiss, onLike, onSave, onDelete, onExpand, onOpenComments, onVote, onTag, t }) {
  const [drag, setDrag] = useState_t({ x: 0, dragging: false });
  const [menuOpen, setMenuOpen] = useState_t(false);
  const startRef = useRef_t(0);
  const tileRef = useRef_t(null);
  const isAuthor = me && tile.author && me.handle === tile.author.handle;
  const isStaff = me && (me.role === 'admin' || me.role === 'owner');
  const canDelete = isAuthor || isStaff;

  const handleExpand = () => {
    const rect = tileRef.current?.getBoundingClientRect();
    onExpand(rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null);
  };

  const onPointerDown = (e) => {
    if (e.target.closest('.ti-tile-btn,.ti-poll-opt,.ti-no-drag')) return;
    startRef.current = e.clientX;
    setDrag({ x: 0, dragging: true });
    tileRef.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.dragging) return;
    setDrag(d => ({ ...d, x: e.clientX - startRef.current }));
  };
  const onPointerUp = () => {
    if (!drag.dragging) return;
    const dx = drag.x;
    if (Math.abs(dx) > 110) {
      setDrag({ x: dx > 0 ? 600 : -600, dragging: false });
      setTimeout(onDismiss, 220);
    } else {
      setDrag({ x: 0, dragging: false });
    }
  };

  const opacity = 1 - Math.min(0.6, Math.abs(drag.x) / 400);
  const rotate = drag.x / 60;
  const dismissHint = Math.abs(drag.x) > 40;

  return (
    <article ref={tileRef}
      className={`ti-tile ti-kind-${tile.kind}${dismissing ? ' ti-dismissing' : ''}${tile.isNew ? ' ti-new' : ''}`}
      style={{
        transform: `translateX(${drag.x}px) rotate(${rotate}deg)`,
        opacity,
        transition: drag.dragging ? 'none' : 'transform .3s cubic-bezier(.2,.7,.3,1), opacity .3s',
      }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className="ti-gloss" />
      <div className="ti-gloss-edge" />

      {dismissHint && (
        <div className="ti-dismiss-hint" style={{ opacity: Math.min(1, Math.abs(drag.x) / 110) }}>
          <span>{drag.x > 0 ? 'hide →' : '← hide'}</span>
        </div>
      )}

      <header className="ti-tile-hd">
        <div className="ti-author">
          <div className="ti-avatar">
            {tile.author.avatar_url
              ? <img src={tile.author.avatar_url} alt={tile.author.avatar} />
              : tile.author.avatar}
          </div>
          <div className="ti-author-meta">
            <div className="ti-author-name">{tile.author.name}</div>
            <div className="ti-author-handle">@{tile.author.handle} · {tile.time}</div>
          </div>
        </div>
        <div className="ti-tile-more-wrap ti-no-drag">
          <button className="ti-tile-btn ti-tile-more" aria-label="more"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}>
            <span /><span /><span />
          </button>
          {menuOpen && (
            <>
              <div className="ti-tile-menu-veil"
                   onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
              <div className="ti-tile-menu" onClick={(e) => e.stopPropagation()}>
                {canDelete ? (
                  <button className="ti-tile-menu-item ti-tile-menu-danger"
                          onClick={() => {
                            setMenuOpen(false);
                            if (window.confirm(isAuthor ? 'Delete this tile?' : `Delete @${tile.author.handle}'s tile? This is a moderation action.`)) {
                              onDelete && onDelete();
                            }
                          }}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>
                    </svg>
                    <span>{isAuthor ? 'Delete tile' : 'Remove (moderate)'}</span>
                  </button>
                ) : (
                  <div className="ti-tile-menu-empty">No actions</div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <TileBody tile={tile} onVote={onVote} />

      <footer className="ti-tile-ft">
        <button className={`ti-tile-btn ti-like${tile.liked ? ' is-liked' : ''}`} onClick={onLike}>
          <HeartIcon filled={tile.liked} />
          <span>{fmt(tile.likes)}</span>
        </button>
        <button className="ti-tile-btn ti-comment" onClick={onOpenComments}>
          <CommentIcon />
          <span>{fmt(tile.comments)}</span>
        </button>
        <button className={`ti-tile-btn ti-save${tile.saved ? ' is-saved' : ''}`} onClick={onSave} aria-label="save">
          <BookmarkIcon filled={tile.saved} />
        </button>
        <button className="ti-tile-btn ti-share" aria-label="share"><ShareIcon /></button>
        <button className="ti-tile-btn ti-expand-btn" onClick={handleExpand} aria-label="expand"><ExpandIcon /></button>
      </footer>
    </article>
  );
}

function TileBody({ tile, onVote }) {
  switch (tile.kind) {
    case 'photo': return (
      <div className="ti-body ti-body-photo">
        <MediaPlaceholder tone={tile.media.tone} kind="photo" label={tile.media.label} />
        {tile.caption && <p className="ti-caption">{tile.caption}</p>}
      </div>
    );
    case 'video': return (
      <div className="ti-body ti-body-video">
        <MediaPlaceholder tone={tile.media.tone} kind="video" label={tile.media.label} duration={tile.media.duration} />
        {tile.caption && <p className="ti-caption">{tile.caption}</p>}
      </div>
    );
    case 'live': return (
      <div className="ti-body ti-body-live">
        <MediaPlaceholder tone={tile.media.tone} kind="live" />
        <div className="ti-live-overlay">
          <div className="ti-live-dot" /><span>LIVE</span>
          <span className="ti-live-viewers">{fmt(tile.media.viewers)} watching</span>
        </div>
        {tile.caption && <p className="ti-caption">{tile.caption}</p>}
      </div>
    );
    case 'text': return <div className="ti-body ti-body-text"><p className="ti-text">{tile.body}</p></div>;
    case 'audio': return (
      <div className="ti-body ti-body-audio">
        <Waveform bars={tile.media.waveform} duration={tile.media.duration} />
        {tile.caption && <p className="ti-caption">{tile.caption}</p>}
      </div>
    );
    case 'link': return (
      <div className="ti-body ti-body-link">
        {tile.body && <p className="ti-caption ti-caption-lead">{tile.body}</p>}
        <div className="ti-linkcard">
          <div className="ti-linkcard-thumb" />
          <div className="ti-linkcard-meta">
            <div className="ti-linkcard-domain">{tile.link.domain}</div>
            <div className="ti-linkcard-title">{tile.link.title}</div>
            <div className="ti-linkcard-excerpt">{tile.link.excerpt}</div>
          </div>
        </div>
      </div>
    );
    case 'poll': return (
      <div className="ti-body ti-body-poll">
        {tile.body && <p className="ti-caption ti-caption-lead">{tile.body}</p>}
        <Poll poll={tile.poll} onVote={onVote} />
      </div>
    );
    case 'chart': return (
      <div className="ti-body ti-body-chart">
        <BarChart chart={tile.chart} />
        {tile.caption && <p className="ti-caption">{tile.caption}</p>}
      </div>
    );
    case 'grid': return (
      <div className="ti-body ti-body-grid">
        <DataGrid grid={tile.grid} />
        {tile.caption && <p className="ti-caption">{tile.caption}</p>}
      </div>
    );
    default: return null;
  }
}

function BarChart({ chart, large = false }) {
  if (!chart || !chart.data || !chart.data.length) return null;
  const max = Math.max(...chart.data.map(d => d.value), 1);
  return (
    <div className={`ti-chart${large ? ' ti-chart-lg' : ''}`}>
      <div className="ti-chart-hd">
        <span className="ti-chart-label">{chart.label}</span>
        {chart.unit && <span className="ti-chart-unit">{chart.unit}</span>}
      </div>
      <div className="ti-chart-bars">
        {chart.data.map((d, i) => {
          const pct = (d.value / max) * 100;
          return (
            <div key={i} className="ti-chart-col">
              <div className="ti-chart-bar-wrap">
                <span className="ti-chart-bar" style={{ height: `${pct}%` }}>
                  <span className="ti-chart-bar-cap" />
                </span>
              </div>
              <span className="ti-chart-x">{d.label}</span>
            </div>
          );
        })}
      </div>
      <div className="ti-chart-axis">
        <span>0</span><span>{max}</span>
      </div>
    </div>
  );
}

function DataGrid({ grid, large = false }) {
  if (!grid || !grid.columns) return null;
  return (
    <div className={`ti-datagrid${large ? ' ti-datagrid-lg' : ''}`}>
      <div className="ti-datagrid-row ti-datagrid-hd"
           style={{ gridTemplateColumns: `repeat(${grid.columns.length}, minmax(0, 1fr))` }}>
        {grid.columns.map((c, i) => <div key={i} className="ti-datagrid-cell">{c}</div>)}
      </div>
      <div className="ti-datagrid-body">
        {grid.rows.map((row, ri) => (
          <div key={ri} className="ti-datagrid-row"
               style={{ gridTemplateColumns: `repeat(${grid.columns.length}, minmax(0, 1fr))` }}>
            {row.map((cell, ci) => (
              <div key={ci} className="ti-datagrid-cell">
                {typeof cell === 'object' && cell.tone ? (
                  <span className={`ti-datagrid-pill ti-tone-${cell.tone}`}>{cell.label}</span>
                ) : (
                  <span>{cell}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MediaPlaceholder({ tone = 200, kind, label, duration }) {
  const grad = `radial-gradient(120% 80% at 30% 20%, oklch(0.32 0.04 ${tone}) 0%, oklch(0.16 0.02 ${tone}) 45%, oklch(0.08 0.01 ${tone}) 100%)`;
  return (
    <div className="ti-media" style={{ background: grad }}>
      <div className="ti-media-stripes" />
      {kind === 'video' && (
        <div className="ti-play"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></div>
      )}
      {duration && <div className="ti-media-duration">{duration}</div>}
      {label && <div className="ti-media-label">{label}</div>}
    </div>
  );
}

function Waveform({ bars, duration }) {
  const [playing, setPlaying] = useState_t(false);
  const [progress, setProgress] = useState_t(0);
  useEffect_t(() => {
    if (!playing) return;
    const id = setInterval(() => setProgress(p => p >= 1 ? (setPlaying(false), 0) : p + 0.02), 80);
    return () => clearInterval(id);
  }, [playing]);
  return (
    <div className="ti-waveform">
      <button className="ti-wave-play ti-no-drag" onClick={(e) => { e.stopPropagation(); setPlaying(p => !p); }}>
        {playing
          ? <svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor"/></svg>
          : <svg viewBox="0 0 24 24" width="14" height="14"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>}
      </button>
      <div className="ti-wave-bars">
        {bars.map((b, i) => (
          <span key={i} className={`ti-wave-bar${i / bars.length < progress ? ' is-passed' : ''}`} style={{ height: `${b * 100}%` }} />
        ))}
      </div>
      <div className="ti-wave-time">{duration}</div>
    </div>
  );
}

function Poll({ poll, onVote }) {
  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  return (
    <div className="ti-poll">
      {poll.options.map(o => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        const voted = poll.voted === o.id;
        return (
          <button key={o.id}
                  className={`ti-poll-opt ti-no-drag${poll.voted ? ' is-cast' : ''}${voted ? ' is-voted' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onVote(o.id); }}
                  disabled={!!poll.voted}>
            <span className="ti-poll-fill" style={{ width: poll.voted ? `${pct}%` : '0%' }} />
            <span className="ti-poll-label">{o.label}</span>
            {poll.voted && <span className="ti-poll-pct">{pct}%</span>}
          </button>
        );
      })}
      <div className="ti-poll-total">{total} votes</div>
    </div>
  );
}

function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
      <path d="M12 20s-7-4.5-9.3-9C1 7.5 3 4 6.5 4c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 4 23 7.5 21.3 11 19 15.5 12 20 12 20z" />
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M21 12c0 4-4 7-9 7-1.3 0-2.5-.2-3.6-.6L4 20l1.2-3.5C3.8 15 3 13.6 3 12c0-4 4-7 9-7s9 3 9 7z" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14"/>
    </svg>
  );
}
function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>
    </svg>
  );
}
function BookmarkIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
      <path d="M6 4h12v17l-6-4-6 4z" />
    </svg>
  );
}

window.Tile = Tile;
window.HeartIcon = HeartIcon;
window.BookmarkIcon = BookmarkIcon;
window.BarChart = BarChart;
window.DataGrid = DataGrid;
