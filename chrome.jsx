// chrome.jsx — top bar, mode toggle, view toggle, feed header, tag bar, undo toast

const { useState: useState_c, useEffect: useEffect_c, useRef: useRef_c } = React;

function TopBar({ mode, setMode, filter, setFilter, view, setView, likedCount, savedCount, onCompose, onProfile, isOnProfile, allTags, tagFilter, setTagFilter, t }) {
  return (
    <header className="ti-top">
      <div className="ti-top-l">
        <div className="ti-logo">
          <span className="ti-logo-mark"><span /><span /><span /><span /></span>
          <span className="ti-logo-word">Tiled</span>
        </div>
      </div>

      <div className="ti-top-c">
        <ModeToggle mode={mode} setMode={setMode} />
      </div>

      <div className="ti-top-r">
        <FilterPill filter={filter} setFilter={setFilter} />
        <SearchPopover allTags={allTags} tagFilter={tagFilter} setTagFilter={setTagFilter} />
        <button className="ti-icn-btn" aria-label="notifications">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0"/>
          </svg>
          <span className="ti-icn-dot" />
        </button>
        <button className="ti-compose" onClick={onCompose}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>Post</span>
        </button>
        <button className={`ti-me${isOnProfile ? ' is-active' : ''}`} onClick={onProfile} aria-label="profile">YO</button>
      </div>
    </header>
  );
}

function SearchPopover({ allTags, tagFilter, setTagFilter }) {
  const [open, setOpen] = useState_c(false);
  const [q, setQ] = useState_c('');
  const inputRef = useRef_c(null);

  useEffect_c(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else setQ('');
  }, [open]);

  useEffect_c(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const cleaned = q.trim().toLowerCase().replace(/^#/, '');
  const matches = (allTags || [])
    .map(([t, count]) => ({ tag: t, count }))
    .filter(({ tag }) => !cleaned || tag.includes(cleaned))
    .slice(0, 8);

  const apply = (tag) => { setTagFilter(tag); setOpen(false); };
  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matches[0]) apply(matches[0].tag);
      else if (cleaned) apply(cleaned);
    }
  };

  return (
    <div className="ti-search">
      <button
        className={`ti-icn-btn${tagFilter ? ' is-active-filter' : ''}`}
        aria-label="search"
        onClick={() => setOpen(o => !o)}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        {tagFilter && <span className="ti-search-active-dot" />}
      </button>
      {open && (
        <>
          <div className="ti-filter-veil" onClick={() => setOpen(false)} />
          <div className="ti-search-pop" onClick={(e) => e.stopPropagation()}>
            <div className="ti-search-input-wrap">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
              </svg>
              <input ref={inputRef}
                     value={q}
                     onChange={(e) => setQ(e.target.value)}
                     onKeyDown={onKey}
                     placeholder="Search by #tag…" />
              {q && <button className="ti-search-clr" onClick={() => setQ('')}>✕</button>}
            </div>

            <div className="ti-search-section-lbl">
              {cleaned ? 'Matching tags' : 'Browse topics'}
            </div>
            <div className="ti-search-list">
              {matches.length === 0 && (
                <div className="ti-search-empty">No tags match "{cleaned}"</div>
              )}
              {matches.map(({ tag, count }) => (
                <button key={tag}
                        className={`ti-search-row${tagFilter === tag ? ' is-active' : ''}`}
                        onClick={() => apply(tag)}>
                  <span className="ti-search-row-tag">#{tag}</span>
                  <span className="ti-search-row-count">{count} tile{count === 1 ? '' : 's'}</span>
                </button>
              ))}
            </div>

            {tagFilter && (
              <div className="ti-search-foot">
                <span className="ti-search-active-lbl">Active filter</span>
                <span className="ti-search-active-tag">#{tagFilter}</span>
                <button className="ti-search-clear-all" onClick={() => { setTagFilter(null); setOpen(false); }}>
                  Clear
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ViewToggle({ view, setView, likedCount, savedCount }) {
  const views = [
    { id: 'feed',  label: 'Feed' },
    { id: 'liked', label: 'Liked', count: likedCount },
    { id: 'saved', label: 'Saved', count: savedCount },
  ];
  const idx = Math.max(0, views.findIndex(v => v.id === view));
  return (
    <div className="ti-mode-toggle ti-view-segmented" data-view={view}>
      <div className="ti-mode-thumb"
           style={{ left: `calc(4px + ${idx} * (100% - 8px) / 3)`, width: 'calc((100% - 8px) / 3)' }} />
      {views.map(v => (
        <button key={v.id}
                className={`ti-mode-btn${view === v.id ? ' is-active' : ''}`}
                onClick={() => setView(v.id)}>
          <ViewGlyph id={v.id} />
          <span>{v.label}</span>
          {v.count != null && v.count > 0 && <span className="ti-view-count">{v.count}</span>}
        </button>
      ))}
    </div>
  );
}

function ViewGlyph({ id }) {
  if (id === 'feed') return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="currentColor">
      <rect x="1.5" y="1.5" width="3.8" height="3.8" rx="0.6"/>
      <rect x="6.7" y="1.5" width="3.8" height="3.8" rx="0.6"/>
      <rect x="1.5" y="6.7" width="3.8" height="3.8" rx="0.6"/>
      <rect x="6.7" y="6.7" width="3.8" height="3.8" rx="0.6"/>
    </svg>
  );
  if (id === 'liked') return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="currentColor">
      <path d="M6 10.5s-3.7-2.4-4.9-4.7C.5 4.3 1.6 2.4 3.4 2.4c1 0 1.7.5 2.6 1.5.9-1 1.6-1.5 2.6-1.5 1.8 0 2.9 1.9 2.3 3.4C9.7 8.1 6 10.5 6 10.5z"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="currentColor">
      <path d="M3 2h6v8.5L6 8.7 3 10.5z"/>
    </svg>
  );
}

function ModeToggle({ mode, setMode }) {
  const modes = [
    { id: 'social', label: 'Social' },
    { id: 'pro', label: 'Professional' },
    { id: 'private', label: 'Private' },
  ];
  const idx = modes.findIndex(m => m.id === mode);
  return (
    <div className="ti-mode-toggle" data-mode={mode}>
      <div className="ti-mode-thumb"
           style={{ left: `calc(4px + ${idx} * (100% - 8px) / 3)`, width: 'calc((100% - 8px) / 3)' }} />
      {modes.map(m => (
        <button key={m.id}
                className={`ti-mode-btn${mode === m.id ? ' is-active' : ''}`}
                onClick={() => setMode(m.id)}>
          <ModeGlyph id={m.id} />
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}

function ModeGlyph({ id }) {
  if (id === 'social') return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="currentColor">
      <circle cx="3.5" cy="3.5" r="1.6"/><circle cx="8.5" cy="3.5" r="1.6"/>
      <path d="M1 10c.5-2 2-3 2.5-3s2 1 2.5 3M6 10c.5-2 2-3 2.5-3s2 1 2.5 3"/>
    </svg>
  );
  if (id === 'pro') return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="3" width="8" height="7" rx="1"/><path d="M4.5 3V2h3v1"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="3" y="5.5" width="6" height="4.5" rx="0.8"/><path d="M4.5 5.5V4a1.5 1.5 0 0 1 3 0v1.5"/>
    </svg>
  );
}

function FilterPill({ filter, setFilter }) {
  const [open, setOpen] = useState_c(false);
  const opts = [
    { id: 'all', label: 'All tiles' },
    { id: 'photo', label: 'Photos' },
    { id: 'video', label: 'Video' },
    { id: 'text', label: 'Text' },
    { id: 'audio', label: 'Audio' },
  ];
  const cur = opts.find(o => o.id === filter);
  return (
    <div className="ti-filter">
      <button className="ti-filter-btn" onClick={() => setOpen(o => !o)}>
        <span className="ti-filter-dot" />
        <span>{cur.label}</span>
        <svg viewBox="0 0 12 12" width="9" height="9" fill="currentColor"><path d="M2 4h8L6 9z"/></svg>
      </button>
      {open && (
        <>
          <div className="ti-filter-veil" onClick={() => setOpen(false)} />
          <div className="ti-filter-menu">
            {opts.map(o => (
              <button key={o.id} className={`ti-filter-item${filter === o.id ? ' is-active' : ''}`}
                      onClick={() => { setFilter(o.id); setOpen(false); }}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FeedHeader({ mode, view, count, tagFilter, onClearTag }) {
  let kicker, title;
  if (view === 'liked') {
    kicker = 'Library · Liked';
    title = 'Tiles you\'ve loved';
  } else if (view === 'saved') {
    kicker = 'Library · Saved';
    title = 'Saved for later';
  } else {
    const meta = {
      social: { kicker: 'Feed · Social', title: 'Today, from the people you follow' },
      pro: { kicker: 'Feed · Professional', title: 'Work worth your attention' },
      private: { kicker: 'Feed · Private', title: 'Drafts and notes — only visible to you' },
    }[mode];
    kicker = meta.kicker; title = meta.title;
  }
  if (tagFilter) title = `Filtered by #${tagFilter}`;

  return (
    <div className="ti-feed-hd">
      <div className="ti-feed-kicker">{kicker}</div>
      <h1 className="ti-feed-title">{title}</h1>
      <div className="ti-feed-meta">
        <span>{count} tile{count === 1 ? '' : 's'}</span>
        <span className="ti-dot">·</span>
        {tagFilter ? (
          <button className="ti-clear-tag" onClick={onClearTag}>clear filter ✕</button>
        ) : (
          <>
            <span>swipe a tile to dismiss</span>
            <span className="ti-dot">·</span>
            <span>updated just now</span>
          </>
        )}
      </div>
    </div>
  );
}

function TagBar({ tags, active, onPick }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="ti-tagbar">
      <span className="ti-tagbar-label">Topics</span>
      <div className="ti-tagbar-scroll">
        {tags.map(([tag, count]) => (
          <button key={tag}
                  className={`ti-tagbar-chip${active === tag ? ' is-active' : ''}`}
                  onClick={() => onPick(active === tag ? null : tag)}>
            <span>#{tag}</span>
            <span className="ti-tagbar-count">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function UndoSlot({ tile, expiresAt, onUndo }) {
  const remainingMs = Math.max(0, expiresAt - Date.now());
  const remainingSec = Math.ceil(remainingMs / 1000);
  const totalMs = 5000;
  const progress = Math.min(1, remainingMs / totalMs);

  const kindLabel = {
    photo: 'photo', video: 'video', text: 'note', audio: 'voice memo',
    live: 'live stream', link: 'link', poll: 'poll',
    chart: 'chart', table: 'data grid',
  }[tile.kind] || 'tile';

  return (
    <div className="ti-undo-slot ti-no-drag">
      <div className="ti-gloss" />
      <div className="ti-gloss-edge" />
      <div className="ti-undo-slot-progress" style={{ transform: `scaleX(${progress})` }} />
      <div className="ti-undo-slot-inner">
        <div className="ti-undo-slot-icn">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 10h11a5 5 0 0 1 0 10h-2"/><path d="m7 6-4 4 4 4"/>
          </svg>
        </div>
        <div className="ti-undo-slot-body">
          <div className="ti-undo-slot-eyebrow">Hidden · clearing in {remainingSec}s</div>
          <div className="ti-undo-slot-line">
            <span>{kindLabel} from </span>
            <b>@{tile.author.handle}</b>
          </div>
        </div>
        <button className="ti-undo-slot-btn" onClick={onUndo}>Undo</button>
      </div>
    </div>
  );
}

function UndoToast({ entries, onUndo, onUndoAll, onDismiss }) {
  if (!entries.length) return null;
  const latest = entries[entries.length - 1];

  return (
    <div className="ti-undo">
      <div className="ti-gloss" />
      <div className="ti-gloss-edge" />
      <div className="ti-undo-icn">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 10h11a5 5 0 0 1 0 10h-2"/><path d="m7 6-4 4 4 4"/>
        </svg>
      </div>
      <div className="ti-undo-body">
        <div className="ti-undo-line">
          {entries.length === 1
            ? <>Hidden tile from <b>@{latest.tile.author.handle}</b></>
            : <><b>{entries.length}</b> tiles hidden</>}
        </div>
        <div className="ti-undo-sub">Will clear in a few seconds</div>
      </div>
      {entries.length > 1 && (
        <button className="ti-undo-all" onClick={onUndoAll}>Undo all</button>
      )}
      <button className="ti-undo-btn" onClick={() => onUndo(latest.tile.id)}>Undo</button>
      <button className="ti-undo-x" onClick={() => entries.forEach(e => onDismiss(e.tile.id))} aria-label="dismiss">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m6 6 12 12M6 18 18 6"/>
        </svg>
      </button>
    </div>
  );
}

function ModeIndicator({ mode, view }) {
  const labels = { social: 'SOCIAL', pro: 'PROFESSIONAL', private: 'PRIVATE' };
  const text = view === 'feed' ? `${labels[mode]} MODE` : view === 'liked' ? 'LIKED LIBRARY' : 'SAVED LIBRARY';
  return <div className="ti-mode-indicator" data-mode={mode}>{text}</div>;
}

function ProfileHeader({ user, view, setView, likedCount, savedCount, postCount, mode }) {
  return (
    <section className="ti-profile">
      <div className="ti-gloss" />
      <div className="ti-gloss-edge" />
      <div className="ti-profile-bg" />
      <div className="ti-profile-row">
        <div className="ti-profile-avatar">YO</div>
        <div className="ti-profile-meta">
          <div className="ti-profile-name">Yohan Olivier</div>
          <div className="ti-profile-handle">@yohan · joined March 2024</div>
          <div className="ti-profile-bio">Designer, sometimes photographer. Currently in {mode} mode.</div>
          <div className="ti-profile-stats">
            <span><strong>{postCount}</strong> tiles</span>
            <span className="ti-profile-stat-sep" />
            <span><strong>1,284</strong> followers</span>
            <span className="ti-profile-stat-sep" />
            <span><strong>312</strong> following</span>
          </div>
        </div>
        <button className="ti-profile-edit">Edit profile</button>
      </div>
      <div className="ti-profile-toggle-row">
        <ViewToggle view={view} setView={setView} likedCount={likedCount} savedCount={savedCount} />
      </div>
    </section>
  );
}

window.ProfileHeader = ProfileHeader;
window.UndoSlot = UndoSlot;
window.TopBar = TopBar;
window.FeedHeader = FeedHeader;
window.TagBar = TagBar;
window.UndoToast = UndoToast;
window.ModeIndicator = ModeIndicator;
