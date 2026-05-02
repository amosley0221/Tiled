// chrome.jsx — top bar, mode toggle, view toggle, feed header, tag bar, undo toast

const { useState: useState_c, useEffect: useEffect_c, useRef: useRef_c } = React;

function TopBar({ mode, setMode, filter, setFilter, view, setView, likedCount, savedCount, onCompose, onLogoClick, onProfile, isOnProfile, allTags, tagFilter, setTagFilter, userFilter, setUserFilter, onNotifications, notifUnread, onMessages, msgUnread, onAdmin, onFollow, followingIds, onShowProfile, user, t }) {
  const notifBtnRef = useRef_c(null);
  const handleBell = () => {
    const r = notifBtnRef.current?.getBoundingClientRect();
    onNotifications(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
  };
  const isStaff = user?.role === 'admin' || user?.role === 'owner';
  return (
    <header className="ti-top">
      <div className="ti-top-l">
        <button type="button" className="ti-logo ti-logo-btn"
                onClick={onLogoClick}
                aria-label="Back to feed">
          <span className="ti-logo-mark"><span /><span /><span /><span /></span>
          <span className="ti-logo-word">Tiled</span>
        </button>
      </div>

      <div className="ti-top-c">
        <ModeToggle mode={mode} setMode={setMode}
                    hideSocial={t?.hideSocial}
                    hidePro={t?.hidePro}
                    hidePrivate={t?.hidePrivate} />
      </div>

      <div className="ti-top-r">
        <FilterPill filter={filter} setFilter={setFilter} />
        <SearchPopover allTags={allTags} tagFilter={tagFilter} setTagFilter={setTagFilter}
                       userFilter={userFilter} setUserFilter={setUserFilter}
                       me={user} followingIds={followingIds} onFollow={onFollow}
                       onShowProfile={onShowProfile} />
        {isStaff && (
          <button className={`ti-icn-btn ti-staff ti-staff-${user.role}`}
                  aria-label={`${user.role} panel`}
                  title={`${user.role === 'owner' ? 'Owner' : 'Admin'} panel`}
                  onClick={onAdmin}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 3l8 3v5c0 5-3.5 8.5-8 9.5C7.5 19.5 4 16 4 11V6z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </button>
        )}
        {onMessages && (
          <button className="ti-icn-btn ti-msg-btn" aria-label="messages"
                  onClick={onMessages}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 6h18v11a1 1 0 0 1-1 1H8l-5 4z"/>
            </svg>
            {msgUnread > 0 && (
              <span className="ti-icn-badge">{msgUnread > 9 ? '9+' : msgUnread}</span>
            )}
          </button>
        )}
        <button ref={notifBtnRef} className="ti-icn-btn ti-bell" aria-label="notifications" onClick={handleBell}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0"/>
          </svg>
          {notifUnread > 0 && (
            <span className="ti-icn-badge">{notifUnread > 9 ? '9+' : notifUnread}</span>
          )}
        </button>
        <button className="ti-compose" onClick={onCompose}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>Post</span>
        </button>
        <button className={`ti-me${isOnProfile ? ' is-active' : ''}${user?.role === 'owner' ? ' is-owner' : user?.role === 'admin' ? ' is-admin' : ''}`}
                onClick={onProfile} aria-label="profile" title={user?.name || 'Profile'}>
          {user?.avatar_url
            ? <img src={user.avatar_url} alt={user?.avatar || ''} />
            : (user?.avatar || 'YO')}
        </button>
      </div>
    </header>
  );
}

function SearchPopover({ allTags, tagFilter, setTagFilter, userFilter, setUserFilter, me, followingIds, onFollow, onShowProfile }) {
  const [open, setOpen] = useState_c(false);
  const [q, setQ] = useState_c('');
  const [users, setUsers] = useState_c([]);
  const inputRef = useRef_c(null);
  const supabase = window.supabaseClient;

  useEffect_c(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else { setQ(''); setUsers([]); }
  }, [open]);

  useEffect_c(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Detect search mode: leading "#" forces tag-only, "@" forces user-only,
  // otherwise both are searched.
  const raw = q.trim();
  const tagMode  = raw.startsWith('#');
  const userMode = raw.startsWith('@');
  const cleaned  = raw.toLowerCase().replace(/^[#@]/, '');

  // Tags are pre-loaded; just filter client-side.
  const tagMatches = userMode ? [] : (allTags || [])
    .map(([tag, count]) => ({ tag, count }))
    .filter(({ tag }) => !cleaned || tag.includes(cleaned))
    .slice(0, 6);

  // Users are queried live against profiles, debounced.
  useEffect_c(() => {
    if (tagMode || !supabase) { setUsers([]); return; }
    if (!cleaned) { setUsers([]); return; }
    let mounted = true;
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, name, avatar, avatar_url, role')
        .or(`username.ilike.%${cleaned}%,name.ilike.%${cleaned}%`)
        .limit(6);
      if (!mounted) return;
      if (error) { console.warn('[tiled] user search:', error.message); setUsers([]); return; }
      setUsers(data || []);
    }, 180);
    return () => { mounted = false; clearTimeout(t); };
  }, [cleaned, tagMode]);

  const applyTag = (tag) => { setTagFilter(tag); setUserFilter && setUserFilter(null); setOpen(false); };
  // Clicking a user's name now opens their profile page; the legacy filter-by-user
  // behavior is still available via the secondary "Filter feed" affordance.
  const openUser = (u) => {
    setOpen(false);
    if (onShowProfile) onShowProfile(u.id);
  };
  const filterByUser = (u) => {
    setUserFilter && setUserFilter({ handle: u.username, name: u.name, avatar: u.avatar, role: u.role });
    setTagFilter(null);
    setOpen(false);
  };
  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (users[0] && (userMode || tagMatches.length === 0)) openUser(users[0]);
      else if (tagMatches[0]) applyTag(tagMatches[0].tag);
      else if (users[0]) openUser(users[0]);
      else if (cleaned && !userMode) applyTag(cleaned);
    }
  };

  const hasActiveFilter = !!tagFilter || !!userFilter;

  return (
    <div className="ti-search">
      <button
        className={`ti-icn-btn${hasActiveFilter ? ' is-active-filter' : ''}`}
        aria-label="search"
        onClick={() => setOpen(o => !o)}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        {hasActiveFilter && <span className="ti-search-active-dot" />}
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
                     placeholder="Search @people or #topics…" />
              {q && <button className="ti-search-clr" onClick={() => setQ('')}>✕</button>}
            </div>

            {!tagMode && (
              <>
                <div className="ti-search-section-lbl">
                  {cleaned ? 'People' : 'People · type to search'}
                </div>
                <div className="ti-search-list">
                  {cleaned && users.length === 0 && (
                    <div className="ti-search-empty">No users match "{cleaned}"</div>
                  )}
                  {users.map(u => {
                    const isMe = me && u.id === me.id;
                    const isFollowing = followingIds?.has(u.id);
                    return (
                      <div key={u.id}
                           className={`ti-search-row ti-search-user${userFilter?.handle === u.username ? ' is-active' : ''}`}>
                        <button className="ti-search-user-main" onClick={() => openUser(u)}>
                          <span className={`ti-search-user-avatar ti-role-ring-${u.role}`}>
                            {u.avatar_url
                              ? <img src={u.avatar_url} alt={u.avatar} />
                              : u.avatar}
                          </span>
                          <span className="ti-search-user-meta">
                            <span className="ti-search-user-name">
                              {u.name}
                              {u.role === 'owner' && <span className="ti-role-badge ti-role-badge-owner ti-role-badge-sm">Owner</span>}
                              {u.role === 'admin' && <span className="ti-role-badge ti-role-badge-admin ti-role-badge-sm">Admin</span>}
                            </span>
                            <span className="ti-search-user-handle">@{u.username}</span>
                          </span>
                        </button>
                        {!isMe && onFollow && (
                          <button className={`ti-follow-btn ti-follow-btn-sm${isFollowing ? ' is-following' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); onFollow(u.id); }}>
                            {isFollowing ? 'Following' : 'Follow'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {!userMode && (
              <>
                <div className="ti-search-section-lbl">
                  {cleaned ? 'Topics' : 'Browse topics'}
                </div>
                <div className="ti-search-list">
                  {tagMatches.length === 0 && cleaned && (
                    <div className="ti-search-empty">No tags match "{cleaned}"</div>
                  )}
                  {tagMatches.map(({ tag, count }) => (
                    <button key={tag}
                            className={`ti-search-row${tagFilter === tag ? ' is-active' : ''}`}
                            onClick={() => applyTag(tag)}>
                      <span className="ti-search-row-tag">#{tag}</span>
                      <span className="ti-search-row-count">{count} tile{count === 1 ? '' : 's'}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {(tagFilter || userFilter) && (
              <div className="ti-search-foot">
                <span className="ti-search-active-lbl">Active filter</span>
                <span className="ti-search-active-tag">
                  {tagFilter ? '#' + tagFilter : '@' + userFilter.handle}
                </span>
                <button className="ti-search-clear-all" onClick={() => { setTagFilter(null); setUserFilter && setUserFilter(null); setOpen(false); }}>
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

function ModeToggle({ mode, setMode, hideSocial, hidePro, hidePrivate }) {
  const allModes = [
    { id: 'social', label: 'Social', hidden: hideSocial },
    { id: 'pro', label: 'Professional', hidden: hidePro },
    { id: 'private', label: 'Private', hidden: hidePrivate },
  ];
  const modes = allModes.filter(m => !m.hidden);

  // if the active mode is hidden, snap to the first visible one
  useEffect_c(() => {
    if (modes.length === 0) return;
    if (!modes.find(m => m.id === mode)) setMode(modes[0].id);
  }, [hideSocial, hidePro, hidePrivate]);

  if (modes.length <= 1) return null;
  const idx = Math.max(0, modes.findIndex(m => m.id === mode));
  const n = modes.length;
  return (
    <div className="ti-mode-toggle" data-mode={mode} data-count={n}>
      <div className="ti-mode-thumb"
           style={{ left: `calc(4px + ${idx} * (100% - 8px) / ${n})`, width: `calc((100% - 8px) / ${n})` }} />
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

function FeedHeader({ mode, view, count, tagFilter, onClearTag, userFilter, onClearUser, feedSource, onSetFeedSource, showFeedSource }) {
  let kicker, title;
  if (view === 'liked') {
    kicker = 'Library · Liked';
    title = 'Tiles you\'ve loved';
  } else if (view === 'saved') {
    kicker = 'Library · Saved';
    title = 'Saved for later';
  } else {
    const meta = {
      social: {
        kicker: 'Feed · Social',
        title: feedSource === 'discover'
          ? 'Discover what\'s new on Tiled'
          : 'Today, from the people you follow',
      },
      pro: { kicker: 'Feed · Professional', title: 'Work worth your attention' },
      private: { kicker: 'Feed · Private', title: 'Drafts and notes — only visible to you' },
    }[mode];
    kicker = meta.kicker; title = meta.title;
  }
  if (userFilter) title = `Tiles by ${userFilter.name || '@' + userFilter.handle}`;
  else if (tagFilter) title = `Filtered by #${tagFilter}`;

  return (
    <div className="ti-feed-hd">
      <div className="ti-feed-kicker">{kicker}</div>
      <h1 className="ti-feed-title">{title}</h1>
      <div className="ti-feed-meta">
        <span>{count} tile{count === 1 ? '' : 's'}</span>
        <span className="ti-dot">·</span>
        {userFilter ? (
          <button className="ti-clear-tag" onClick={onClearUser}>clear @{userFilter.handle} ✕</button>
        ) : tagFilter ? (
          <button className="ti-clear-tag" onClick={onClearTag}>clear filter ✕</button>
        ) : (
          <>
            <span>swipe a tile to dismiss</span>
            <span className="ti-dot">·</span>
            <span>updated just now</span>
          </>
        )}
      </div>
      {showFeedSource && (
        <FeedSourceToggle source={feedSource} setSource={onSetFeedSource} />
      )}
    </div>
  );
}

function FeedSourceToggle({ source, setSource }) {
  const opts = [
    { id: 'following', label: 'Following' },
    { id: 'discover',  label: 'Discover' },
  ];
  const idx = Math.max(0, opts.findIndex(o => o.id === source));
  return (
    <div className="ti-mode-toggle ti-feed-src" data-src={source}>
      <div className="ti-mode-thumb"
           style={{ left: `calc(4px + ${idx} * (100% - 8px) / 2)`, width: 'calc((100% - 8px) / 2)' }} />
      {opts.map(o => (
        <button key={o.id}
                className={`ti-mode-btn${source === o.id ? ' is-active' : ''}`}
                onClick={() => setSource(o.id)}>
          <span>{o.label}</span>
        </button>
      ))}
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

function UndoSlot({ tile, expiresAt, onUndo, variant }) {
  const remainingMs = Math.max(0, expiresAt - Date.now());
  const remainingSec = Math.ceil(remainingMs / 1000);
  const totalMs = 5000;
  const progress = Math.min(1, remainingMs / totalMs);

  const kindLabel = {
    photo: 'photo', video: 'video', text: 'note', audio: 'voice memo',
    live: 'live stream', link: 'link', poll: 'poll',
    chart: 'chart', grid: 'data grid',
  }[tile.kind] || 'tile';

  const isDelete = variant === 'delete';

  return (
    <div className={`ti-undo-slot ti-no-drag${isDelete ? ' ti-undo-slot-delete' : ''}`}>
      <div className="ti-gloss" />
      <div className="ti-gloss-edge" />
      <div className="ti-undo-slot-progress" style={{ transform: `scaleX(${progress})` }} />
      <div className="ti-undo-slot-inner">
        <div className="ti-undo-slot-icn">
          {isDelete ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 10h11a5 5 0 0 1 0 10h-2"/><path d="m7 6-4 4 4 4"/>
            </svg>
          )}
        </div>
        <div className="ti-undo-slot-body">
          <div className="ti-undo-slot-eyebrow">
            {isDelete ? 'Deleted' : 'Hidden'} · {isDelete ? 'removing' : 'clearing'} in {remainingSec}s
          </div>
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

function ProfileHeader({ user, view, setView, likedCount, savedCount, postCount, mode, onLogout, onEdit, onShowFollowers, onShowFollowing, followerCount, followingCount, isMe = true, isFollowing, onFollow, onMessage, onBack, loading }) {
  const u = user || {};
  const role = u.role || 'user';
  const joined = (() => {
    if (!u.createdAt) return 'recently';
    try {
      const d = new Date(u.createdAt);
      return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch (e) { return 'recently'; }
  })();
  const followerN = Number.isFinite(followerCount) ? followerCount : 0;
  const followingN = Number.isFinite(followingCount) ? followingCount : 0;
  return (
    <section className={`ti-profile ti-role-${role}${isMe ? '' : ' ti-profile-other'}`}>
      <div className="ti-gloss" />
      <div className="ti-gloss-edge" />
      <div className="ti-profile-bg" />
      {!isMe && onBack && (
        <button className="ti-profile-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="m15 6-6 6 6 6"/>
          </svg>
          <span>Back to my profile</span>
        </button>
      )}
      <div className="ti-profile-row">
        <div className={`ti-profile-avatar ti-role-ring-${role}`}>
          {u.avatar_url
            ? <img src={u.avatar_url} alt={u.avatar || ''} />
            : (u.avatar || 'YO')}
        </div>
        <div className="ti-profile-meta">
          <div className="ti-profile-name">
            {loading ? '…' : (u.name || (isMe ? 'You' : ''))}
            {role !== 'user' && <RoleBadge role={role} />}
          </div>
          <div className="ti-profile-handle">@{u.handle || ''} · joined {joined}</div>
          <div className="ti-profile-bio">
            {loading
              ? 'Loading profile…'
              : (u.bio || (isMe ? `Currently in ${mode} mode.` : 'No bio yet.'))}
          </div>
          <div className="ti-profile-stats">
            <span><strong>{postCount}</strong> tile{postCount === 1 ? '' : 's'}</span>
            <span className="ti-profile-stat-sep" />
            <button className="ti-profile-stat-btn" onClick={onShowFollowers}>
              <strong>{followerN.toLocaleString()}</strong> follower{followerN === 1 ? '' : 's'}
            </button>
            <span className="ti-profile-stat-sep" />
            <button className="ti-profile-stat-btn" onClick={onShowFollowing}>
              <strong>{followingN.toLocaleString()}</strong> following
            </button>
          </div>
        </div>
        <div className="ti-profile-actions">
          {isMe ? (
            <>
              <button className="ti-profile-edit" onClick={onEdit}>Edit profile</button>
              {onLogout && (
                <button className="ti-profile-logout" onClick={onLogout}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/>
                    <path d="M10 17l-5-5 5-5"/>
                    <path d="M5 12h12"/>
                  </svg>
                  <span>Sign out</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button className={`ti-follow-btn${isFollowing ? ' is-following' : ''}`}
                      onClick={onFollow}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              {onMessage && (
                <button className="ti-profile-msg-btn" onClick={onMessage}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M3 6h18v11a1 1 0 0 1-1 1H8l-5 4z"/>
                  </svg>
                  <span>Message</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {isMe && (
        <div className="ti-profile-toggle-row">
          <ViewToggle view={view} setView={setView} likedCount={likedCount} savedCount={savedCount} />
        </div>
      )}
    </section>
  );
}

function RoleBadge({ role }) {
  if (role === 'owner') {
    return (
      <span className="ti-role-badge ti-role-badge-owner" title="Owner">
        <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
          <path d="M2 5l3 3 3-5 3 5 3-3-1 8H3z"/>
        </svg>
        <span>Owner</span>
      </span>
    );
  }
  if (role === 'admin') {
    return (
      <span className="ti-role-badge ti-role-badge-admin" title="Admin">
        <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
          <path d="M8 1l6 2v5c0 4-3 6.5-6 7-3-.5-6-3-6-7V3z"/>
        </svg>
        <span>Admin</span>
      </span>
    );
  }
  return null;
}

window.ProfileHeader = ProfileHeader;
window.UndoSlot = UndoSlot;
window.TopBar = TopBar;
window.FeedHeader = FeedHeader;
window.TagBar = TagBar;
window.UndoToast = UndoToast;
window.ModeIndicator = ModeIndicator;
