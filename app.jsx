// Tiled — premium glossy black social dashboard

const { useState, useEffect, useRef, useMemo } = React;

const ME = { handle: 'you', name: 'You', avatar: 'YO' };

const SEED_TILES = [
  { id: 't1', kind: 'photo', mode: 'social',
    author: { handle: 'mira.jpg', name: 'Mira Okafor', avatar: 'MO' },
    time: '12m', caption: 'fog rolling off the bay this morning. shutter wide open.',
    media: { tone: 220, label: 'long exposure · 30s' },
    tags: ['photography', 'sf-bay'],
    likes: 142, comments: 8, liked: false, saved: false },
  { id: 't2', kind: 'video', mode: 'social',
    author: { handle: 'noahbeats', name: 'Noah Reyes', avatar: 'NR' },
    time: '34m', caption: 'first run of the new sequencer patch',
    media: { tone: 12, label: 'video · 0:42', duration: '0:42' },
    tags: ['music', 'production'],
    likes: 89, comments: 14, liked: true, saved: true },
  { id: 't3', kind: 'text', mode: 'pro',
    author: { handle: 'asha.r', name: 'Asha Rajan', avatar: 'AR' },
    time: '1h', body: 'Shipping is a feature. The longer you sit on something the more it owns you, not the other way around.',
    tags: ['startups', 'product'],
    likes: 312, comments: 41, liked: false, saved: true },
  { id: 't4', kind: 'audio', mode: 'social',
    author: { handle: 'lume', name: 'Lume', avatar: 'LU' },
    time: '2h', caption: 'voice memo — chord progression for the bridge',
    media: { duration: '1:12', waveform: [0.3,0.5,0.7,0.4,0.8,0.6,0.9,0.7,0.5,0.8,0.6,0.4,0.7,0.9,0.5,0.6,0.8,0.4,0.7,0.5,0.6,0.8,0.7,0.4,0.6,0.5,0.7,0.4,0.3,0.5,0.6,0.4,0.7,0.5,0.3,0.4] },
    tags: ['music'],
    likes: 56, comments: 6, liked: false, saved: false },
  { id: 't5', kind: 'live', mode: 'social',
    author: { handle: 'kenji.live', name: 'Kenji Park', avatar: 'KP' },
    time: 'now', caption: 'studio session — open mic',
    media: { tone: 340, viewers: 1284 },
    tags: ['music', 'live'],
    likes: 0, comments: 0, liked: false, saved: false },
  { id: 't6', kind: 'link', mode: 'pro',
    author: { handle: 'tessa.w', name: 'Tessa Whitfield', avatar: 'TW' },
    time: '3h', body: 'A piece on the economics of attention I keep coming back to.',
    link: { domain: 'longform.org', title: 'The Compounding Cost of Distraction', excerpt: 'How the cheapest minute of your day became the most expensive one.' },
    tags: ['reading', 'attention'],
    likes: 71, comments: 11, liked: false, saved: false },
  { id: 't7', kind: 'poll', mode: 'social',
    author: { handle: 'devon', name: 'Devon Yu', avatar: 'DY' },
    time: '4h', body: 'choosing a name for the new record',
    poll: { options: [
      { id: 'a', label: 'Slow Light', votes: 142 },
      { id: 'b', label: 'Half-Tide', votes: 87 },
      { id: 'c', label: 'After-Image', votes: 213 },
    ], voted: null },
    tags: ['music'],
    likes: 24, comments: 19, liked: false, saved: false },
  { id: 't8', kind: 'photo', mode: 'pro',
    author: { handle: 'studio.frame', name: 'Frame Studio', avatar: 'FS' },
    time: '5h', caption: 'concept boards for the Q3 campaign · final round',
    media: { tone: 40, label: 'case study · 6 frames' },
    tags: ['design', 'case-study'],
    likes: 198, comments: 23, liked: true, saved: false },
  { id: 't9', kind: 'text', mode: 'social',
    author: { handle: 'rune', name: 'Rune Halvorsen', avatar: 'RH' },
    time: '6h', body: 'late-night thought: every tool you use is also using you. choose carefully.',
    tags: ['philosophy'],
    likes: 421, comments: 58, liked: false, saved: false },
  { id: 't10', kind: 'photo', mode: 'social',
    author: { handle: 'iyla', name: 'Iyla Mendes', avatar: 'IM' },
    time: '8h', caption: 'sunset, no filter, no caption',
    media: { tone: 25, label: 'photo' },
    tags: ['photography'],
    likes: 67, comments: 4, liked: false, saved: false },
  { id: 't11', kind: 'video', mode: 'pro',
    author: { handle: 'arc.studio', name: 'Arc Studio', avatar: 'AS' },
    time: '12h', caption: 'process reel — physical prototype week 04',
    media: { tone: 200, label: 'reel · 1:18', duration: '1:18' },
    tags: ['design', 'industrial'],
    likes: 256, comments: 31, liked: false, saved: true },
  { id: 't12', kind: 'text', mode: 'private',
    author: { handle: 'me', name: 'You', avatar: 'YO' },
    time: '2d', body: 'note to self — outline for the talk. start with the question, not the framework.',
    tags: ['notes'],
    likes: 0, comments: 0, liked: false, saved: false, private: true },
  { id: 't13', kind: 'photo', mode: 'social',
    author: { handle: 'pitchside', name: 'Pitchside', avatar: 'PS' },
    time: '1h', caption: 'derby night. north stand absolute scenes.',
    media: { tone: 140, label: 'matchday · 89th min' },
    tags: ['sports', 'arsenal', 'football'],
    likes: 1284, comments: 207, liked: false, saved: false },
  { id: 't14', kind: 'text', mode: 'social',
    author: { handle: 'corner.flag', name: 'Corner Flag', avatar: 'CF' },
    time: '3h', body: 'predicting Arsenal 2-1 tonight. Saka brace, Ødegaard quiet but key.',
    tags: ['sports', 'arsenal', 'football'],
    likes: 91, comments: 34, liked: false, saved: false },
];

const SEED_COMMENTS = {
  t1: [
    { id: 'c1', author: { handle: 'noahbeats', avatar: 'NR' }, time: '8m', body: 'this is unreal. what lens?' },
    { id: 'c2', author: { handle: 'mira.jpg', avatar: 'MO' }, time: '6m', body: '50mm 1.4. the fog did the work.' },
    { id: 'c3', author: { handle: 'rune', avatar: 'RH' }, time: '3m', body: 'cinematic.' },
  ],
  t2: [{ id: 'c4', author: { handle: 'lume', avatar: 'LU' }, time: '20m', body: 'the second drop is filthy 🎛️' }],
  t3: [
    { id: 'c5', author: { handle: 'tessa.w', avatar: 'TW' }, time: '50m', body: 'needed this today.' },
    { id: 'c6', author: { handle: 'devon', avatar: 'DY' }, time: '40m', body: 'pinning this.' },
  ],
  t7: [{ id: 'c7', author: { handle: 'iyla', avatar: 'IM' }, time: '3h', body: 'after-image, no question.' }],
  t13: [
    { id: 'c8', author: { handle: 'corner.flag', avatar: 'CF' }, time: '40m', body: 'goosebumps. what an atmosphere.' },
    { id: 'c9', author: { handle: 'rune', avatar: 'RH' }, time: '20m', body: 'this shot belongs in a museum.' },
  ],
};

const fmt = (n) => n >= 1000 ? (n/1000).toFixed(1).replace(/\.0$/,'') + 'k' : String(n);

// pool of incoming tiles used by the live-refresh simulator
const INCOMING_POOL = [
  { kind: 'photo', mode: 'social',
    author: { handle: 'rua.frame', name: 'Rua Vasquez', avatar: 'RV' },
    time: 'now', caption: 'caught the last light off the rooftop',
    media: { tone: 28, label: 'rooftop dusk' },
    tags: ['photo'], likes: 4, comments: 0, liked: false, saved: false },
  { kind: 'text', mode: 'social',
    author: { handle: 'noor', name: 'Noor Halabi', avatar: 'NH' },
    time: 'now', body: 'half the trick of writing well is just refusing to send the first draft.',
    tags: ['notes'], likes: 12, comments: 2, liked: false, saved: false },
  { kind: 'live', mode: 'social',
    author: { handle: 'curio.live', name: 'Curio Live', avatar: 'CL' },
    time: 'now', caption: 'late night studio session — chiming in from Berlin',
    media: { tone: 200, viewers: 412 },
    tags: ['live'], likes: 0, comments: 0, liked: false, saved: false },
  { kind: 'link', mode: 'pro',
    author: { handle: 'design.weekly', name: 'Design Weekly', avatar: 'DW' },
    time: 'now', body: 'On the quiet revival of slow interfaces',
    link: { domain: 'designweekly.co', title: 'The Quiet Revival of Slow Interfaces',
            excerpt: 'A small movement of designers building software that asks for less of you.' },
    tags: ['design'], likes: 18, comments: 3, liked: false, saved: false },
  { kind: 'audio', mode: 'social',
    author: { handle: 'tova.fm', name: 'Tova FM', avatar: 'TF' },
    time: 'now', caption: 'fragment 04 — strings & a ticking clock',
    media: { duration: '2:14', waveform: [0.3,0.5,0.8,0.6,0.9,0.4,0.7,0.5,0.8,0.6,0.4,0.7,0.9,0.5,0.6,0.8,0.4,0.7,0.5,0.6,0.8,0.4,0.6,0.7,0.5,0.3,0.6,0.8,0.5,0.4] },
    tags: ['music'], likes: 7, comments: 1, liked: false, saved: false },
  { kind: 'video', mode: 'social',
    author: { handle: 'kit.lapse', name: 'Kit Aronson', avatar: 'KA' },
    time: 'now', caption: 'overnight time-lapse, 600 frames',
    media: { tone: 220, label: 'overnight lapse', duration: '0:42' },
    tags: ['video'], likes: 21, comments: 4, liked: false, saved: false },
];

function TiledApp({ tweaks }) {
  const t = tweaks;
  const [mode, setMode] = useState('social');
  const [view, setView] = useState('feed');             // feed | liked | saved (only used in profile)
  const [onProfile, setOnProfile] = useState(false);    // is profile page active?
  const [tiles, setTiles] = useState(SEED_TILES);
  const [pendingDismiss, setPendingDismiss] = useState({}); // { [tileId]: expiresAt }
  const dismissTimers = useRef({});
  const [pendingNew, setPendingNew] = useState([]);     // tiles waiting to be revealed
  const [pullProgress, setPullProgress] = useState(0);  // 0..1 — pull-to-refresh visual
  const [refreshing, setRefreshing] = useState(false);
  const mainRef = useRef(null);
  const [comments, setComments] = useState(SEED_COMMENTS);
  const [expanded, setExpanded] = useState(null);
  const [expandOrigin, setExpandOrigin] = useState(null);
  const [commentRail, setCommentRail] = useState(null);
  const [composing, setComposing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState(null);     // string | null

  const accentCSS = useMemo(() => ({
    gold: 'oklch(0.82 0.13 78)',
    platinum: 'oklch(0.94 0 0)',
    ice: 'oklch(0.85 0.08 220)',
    ember: 'oklch(0.72 0.16 32)',
  }[t.accent] || 'oklch(0.82 0.13 78)'), [t.accent]);

  // collect all tags currently in use, with counts
  const allTags = useMemo(() => {
    const counts = {};
    tiles.forEach(tile => (tile.tags || []).forEach(tag => {
      counts[tag] = (counts[tag] || 0) + 1;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [tiles]);

  const visibleTiles = useMemo(() => {
    return tiles.filter(tile => {
      // profile page scoping — only the user's own tiles, sub-filtered by view
      if (onProfile) {
        if (view === 'liked') return tile.liked && !tile.private;
        if (view === 'saved') return tile.saved && !tile.private;
        // 'feed' on profile === their own posts
        return tile.author.handle === 'me';
      }

      if (mode === 'private') return tile.private || tile.author.handle === 'me';
      if (tile.private) return false;
      if (mode === 'pro' && tile.mode !== 'pro') return false;
      if (filter !== 'all' && tile.kind !== filter) return false;
      if (tagFilter && !(tile.tags || []).includes(tagFilter)) return false;
      return true;
    });
  }, [tiles, mode, filter, tagFilter, view, onProfile]);

  // garbage-collect expired pending dismissals every 500ms (drives the countdown UI)
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (Object.keys(pendingDismiss).length === 0) return;
    const id = setInterval(() => forceTick(n => n + 1), 250);
    return () => clearInterval(id);
  }, [pendingDismiss]);

  const handleDismiss = (id) => {
    if (pendingDismiss[id]) return;
    const expiresAt = Date.now() + 5000;
    setPendingDismiss(prev => ({ ...prev, [id]: expiresAt }));
    // schedule the actual removal
    dismissTimers.current[id] = setTimeout(() => {
      setTiles(prev => prev.filter(x => x.id !== id));
      setPendingDismiss(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      delete dismissTimers.current[id];
    }, 5000);
  };

  const handleUndo = (tileId) => {
    if (!tileId) {
      // undo most-recent (largest expiresAt)
      const ids = Object.keys(pendingDismiss);
      if (!ids.length) return;
      tileId = ids.sort((a, b) => pendingDismiss[b] - pendingDismiss[a])[0];
    }
    if (dismissTimers.current[tileId]) {
      clearTimeout(dismissTimers.current[tileId]);
      delete dismissTimers.current[tileId];
    }
    setPendingDismiss(prev => {
      const next = { ...prev };
      delete next[tileId];
      return next;
    });
  };

  const handleUndoAll = () => {
    Object.values(dismissTimers.current).forEach(clearTimeout);
    dismissTimers.current = {};
    setPendingDismiss({});
  };

  // ---- live-refresh simulator: queues a fresh tile every 18s ----
  useEffect(() => {
    if (onProfile) return; // pause on profile
    let i = 0;
    const id = setInterval(() => {
      if (document.hidden) return;
      const template = INCOMING_POOL[i % INCOMING_POOL.length];
      i += 1;
      const newTile = { ...template, id: 'inc' + Date.now() + '_' + i };
      setPendingNew(prev => prev.length >= 8 ? prev : [newTile, ...prev]);
    }, 18000);
    return () => clearInterval(id);
  }, [onProfile]);

  const revealPending = () => {
    if (pendingNew.length === 0) return;
    setRefreshing(true);
    // scroll the main column to top so the new tiles are visible
    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    // small delay so the refresh ring spins before tiles drop in
    setTimeout(() => {
      setTiles(prev => [...pendingNew.map(p => ({ ...p, isNew: true })), ...prev]);
      setPendingNew([]);
      setPullProgress(0);
      setRefreshing(false);
      // strip the isNew flag after the highlight animation
      setTimeout(() => {
        setTiles(prev => prev.map(x => x.isNew ? { ...x, isNew: false } : x));
      }, 1600);
    }, 450);
  };

  // ---- pull-to-refresh: wheel + touch on the main column when scrollTop===0 ----
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    let touchStartY = null;
    let pull = 0;
    const THRESHOLD = 90;

    const updatePull = (delta) => {
      // resistance — pull feels heavier as it stretches
      pull = Math.max(0, pull + delta * 0.55);
      const capped = Math.min(pull, THRESHOLD * 1.6);
      setPullProgress(Math.min(1, capped / THRESHOLD));
    };

    const release = () => {
      if (pull >= THRESHOLD && pendingNew.length > 0) {
        revealPending();
      } else {
        setPullProgress(0);
      }
      pull = 0;
      touchStartY = null;
    };

    const onWheel = (e) => {
      if (refreshing) return;
      // only react when at the very top AND user is scrolling up (deltaY < 0)
      if (el.scrollTop > 0) { pull = 0; setPullProgress(0); return; }
      if (e.deltaY < 0 && pendingNew.length > 0) {
        e.preventDefault();
        updatePull(-e.deltaY);
        clearTimeout(onWheel._t);
        onWheel._t = setTimeout(release, 180);
      }
    };

    const onTouchStart = (e) => {
      if (el.scrollTop > 0) return;
      touchStartY = e.touches[0].clientY;
      pull = 0;
    };
    const onTouchMove = (e) => {
      if (touchStartY == null || refreshing) return;
      const dy = e.touches[0].clientY - touchStartY;
      if (dy > 0 && el.scrollTop === 0 && pendingNew.length > 0) {
        e.preventDefault();
        pull = dy;
        setPullProgress(Math.min(1, pull / THRESHOLD));
      }
    };
    const onTouchEnd = () => { if (touchStartY != null) release(); };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pendingNew.length, refreshing]);

  const handleLike = (id) => {
    setTiles(prev => prev.map(x =>
      x.id === id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x
    ));
  };

  const handleSave = (id) => {
    setTiles(prev => prev.map(x => x.id === id ? { ...x, saved: !x.saved } : x));
  };

  const handleAddComment = (tileId, body) => {
    if (!body.trim()) return;
    const c = { id: 'c' + Date.now(), author: { handle: ME.handle, avatar: ME.avatar }, time: 'now', body: body.trim() };
    setComments(prev => ({ ...prev, [tileId]: [...(prev[tileId] || []), c] }));
    setTiles(prev => prev.map(x => x.id === tileId ? { ...x, comments: x.comments + 1 } : x));
  };

  const handleVote = (tileId, optId) => {
    setTiles(prev => prev.map(x => {
      if (x.id !== tileId || !x.poll || x.poll.voted) return x;
      return { ...x, poll: { ...x.poll, voted: optId,
        options: x.poll.options.map(o => o.id === optId ? { ...o, votes: o.votes + 1 } : o) } };
    }));
  };

  const handlePost = (kind, body, postTags) => {
    const newTile = {
      id: 'new' + Date.now(),
      kind, mode, author: ME, time: 'now',
      body: kind === 'text' ? body : undefined,
      caption: kind !== 'text' ? body : undefined,
      media: kind === 'photo' ? { tone: 180, label: 'new photo' }
            : kind === 'video' ? { tone: 280, label: 'new video', duration: '0:18' }
            : undefined,
      tags: postTags || [],
      likes: 0, comments: 0, liked: false, saved: false,
      isNew: true,
    };
    setTiles(prev => [newTile, ...prev]);
    setComposing(false);
  };

  const expandedTile = expanded ? tiles.find(x => x.id === expanded) : null;
  const gloss = t.gloss / 100;

  return (
    <div className="ti-root" data-mode={mode} style={{
      '--accent': accentCSS, '--gloss': gloss,
      '--font-display': t.fontDisplay === 'serif' ? "'Fraunces', 'Times New Roman', serif" : "'Inter Tight', system-ui, sans-serif",
    }}>
      <TopBar mode={mode} setMode={setMode} filter={filter} setFilter={setFilter}
              view={onProfile ? view : null} setView={setView}
              likedCount={tiles.filter(x => x.liked && !x.private).length}
              savedCount={tiles.filter(x => x.saved && !x.private).length}
              allTags={allTags} tagFilter={tagFilter} setTagFilter={setTagFilter}
              onCompose={() => setComposing(true)}
              onProfile={() => { setOnProfile(p => !p); setView('feed'); }}
              isOnProfile={onProfile}
              t={t} />

      <main className="ti-main" data-density={t.density} ref={mainRef}>
        <PullIndicator progress={pullProgress} refreshing={refreshing}
                       count={pendingNew.length} />
        {pendingNew.length > 0 && !refreshing && !onProfile && (
          <NewTilesChip count={pendingNew.length} onClick={revealPending} />
        )}
        {onProfile ? (
          <ProfileHeader
            view={view} setView={setView}
            likedCount={tiles.filter(x => x.liked && !x.private).length}
            savedCount={tiles.filter(x => x.saved && !x.private).length}
            postCount={tiles.filter(x => x.author.handle === 'me').length}
            mode={mode} />
        ) : (
          <FeedHeader mode={mode} view={view} count={visibleTiles.length}
                      tagFilter={tagFilter} onClearTag={() => setTagFilter(null)} t={t} />
        )}

        <div className="ti-grid" data-density={t.density}>
          {visibleTiles.map(tile => (
            pendingDismiss[tile.id] ? (
              <UndoSlot key={tile.id} tile={tile}
                        expiresAt={pendingDismiss[tile.id]}
                        onUndo={() => handleUndo(tile.id)} />
            ) : (
            <Tile key={tile.id} tile={tile}
                  comments={comments[tile.id] || []}
                  dismissing={false}
                  onDismiss={() => handleDismiss(tile.id)}
                  onLike={() => handleLike(tile.id)}
                  onSave={() => handleSave(tile.id)}
                  onExpand={(rect) => { setExpandOrigin(rect); setExpanded(tile.id); }}
                  onOpenComments={() => setCommentRail(tile.id)}
                  onVote={(optId) => handleVote(tile.id, optId)}
                  onTag={setTagFilter}
                  t={t} />
            )
          ))}
          {visibleTiles.length === 0 && <EmptyState view={view} tagFilter={tagFilter} />}
        </div>
      </main>

      {expandedTile && (
        <ExpandedTile tile={expandedTile}
                      comments={comments[expandedTile.id] || []}
                      onClose={() => setExpanded(null)}
                      originRect={expandOrigin}
                      onLike={() => handleLike(expandedTile.id)}
                      onSave={() => handleSave(expandedTile.id)}
                      onComment={(body) => handleAddComment(expandedTile.id, body)}
                      onVote={(optId) => handleVote(expandedTile.id, optId)}
                      onTag={(tag) => { setTagFilter(tag); setExpanded(null); }}
                      commentStyle={t.commentStyle} t={t} />
      )}

      {commentRail && !expandedTile && (
        <CommentRail tile={tiles.find(x => x.id === commentRail)}
                     comments={comments[commentRail] || []}
                     onClose={() => setCommentRail(null)}
                     onComment={(body) => handleAddComment(commentRail, body)} />
      )}

      {composing && (
        <Composer onClose={() => setComposing(false)} onPost={handlePost}
                  mode={mode} existingTags={allTags.map(([t]) => t)} />
      )}

      <ModeIndicator mode={mode} view={view} />
    </div>
  );
}

function EmptyState({ view, tagFilter }) {
  let msg = 'Nothing here yet.';
  if (view === 'liked') msg = 'No liked tiles yet. Tap the heart on a tile to add it here.';
  else if (view === 'saved') msg = 'No saved tiles yet. Tap the bookmark to keep something for later.';
  else if (tagFilter) msg = `No tiles tagged with #${tagFilter}.`;
  return (
    <div className="ti-empty">
      <div className="ti-empty-mark"><span /><span /><span /><span /></div>
      <div className="ti-empty-msg">{msg}</div>
    </div>
  );
}

window.TiledApp = TiledApp;

function NewTilesChip({ count, onClick }) {
  return (
    <button className="ti-newchip" onClick={onClick} aria-label={`Reveal ${count} new tiles`}>
      <span className="ti-newchip-pulse" aria-hidden="true">
        <span /><span /><span />
      </span>
      <span className="ti-newchip-label">
        {count} new {count === 1 ? 'tile' : 'tiles'}
      </span>
      <span className="ti-newchip-hint">tap or pull ↓</span>
    </button>
  );
}

function PullIndicator({ progress, refreshing, count }) {
  if (progress === 0 && !refreshing) return null;
  const armed = progress >= 1;
  // height grows with pull, capped
  const h = refreshing ? 56 : Math.min(72, progress * 72);
  return (
    <div className="ti-pull" style={{ height: h }} data-armed={armed} data-refreshing={refreshing}>
      <div className="ti-pull-ring" style={{
        transform: `rotate(${progress * 360}deg) scale(${0.6 + progress * 0.4})`,
        opacity: 0.4 + progress * 0.6,
      }}>
        <svg viewBox="0 0 32 32" width="22" height="22">
          <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeDasharray={`${progress * 82} 999`} strokeLinecap="round" />
          <circle cx="16" cy="3" r="2" fill="currentColor" />
        </svg>
      </div>
      <div className="ti-pull-label">
        {refreshing ? 'pulling fresh tiles…'
          : armed ? `release to load ${count}`
          : `pull to refresh${count ? ` · ${count} new` : ''}`}
      </div>
    </div>
  );
}
