// overlays.jsx — expanded tile, comment rail, composer (with tags)

const { useState: useState_o, useRef: useRef_o, useEffect: useEffect_o, useMemo: useMemo_o } = React;

function ExpandedTile({ tile, comments, onClose, onLike, onSave, onDelete, onComment, onVote, onTag, originRect, me, t }) {
  const isAuthor = me && tile.author && me.handle === tile.author.handle;
  const isStaff = me && (me.role === 'admin' || me.role === 'owner');
  const canDelete = isAuthor || isStaff;
  const [draft, setDraft] = useState_o('');
  const [phase, setPhase] = useState_o('opening'); // 'opening' | 'open' | 'closing'
  const expandedRef = useRef_o(null);
  const bgRef = useRef_o(null);

  useEffect_o(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // FLIP-style: snap the expanded card to the origin rect on first paint,
  // then release on next frame so it transitions to its natural size.
  useEffect_o(() => {
    const el = expandedRef.current;
    if (!el) return;
    if (originRect) {
      const final = el.getBoundingClientRect();
      const dx = originRect.left + originRect.width / 2 - (final.left + final.width / 2);
      const dy = originRect.top + originRect.height / 2 - (final.top + final.height / 2);
      const sx = originRect.width / final.width;
      const sy = originRect.height / final.height;
      el.style.transformOrigin = 'center center';
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      el.style.opacity = '0.6';
      // force reflow then animate to identity
      // eslint-disable-next-line no-unused-expressions
      el.getBoundingClientRect();
      requestAnimationFrame(() => {
        el.style.transition = 'transform .42s cubic-bezier(.2,.8,.2,1), opacity .28s ease-out';
        el.style.transform = 'translate(0,0) scale(1,1)';
        el.style.opacity = '1';
      });
      const done = () => { setPhase('open'); el.style.transition = ''; el.removeEventListener('transitionend', done); };
      el.addEventListener('transitionend', done);
    } else {
      setPhase('open');
    }
  }, []);

  const handleClose = () => {
    const el = expandedRef.current;
    if (!el || !originRect) { onClose(); return; }
    const final = el.getBoundingClientRect();
    const dx = originRect.left + originRect.width / 2 - (final.left + final.width / 2);
    const dy = originRect.top + originRect.height / 2 - (final.top + final.height / 2);
    const sx = originRect.width / final.width;
    const sy = originRect.height / final.height;
    setPhase('closing');
    el.style.transition = 'transform .34s cubic-bezier(.4,.0,.2,1), opacity .3s ease-in';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    el.style.opacity = '0';
    if (bgRef.current) {
      bgRef.current.style.transition = 'opacity .3s ease-in';
      bgRef.current.style.opacity = '0';
    }
    setTimeout(onClose, 320);
  };

  const submit = (e) => {
    e?.preventDefault();
    if (!draft.trim()) return;
    onComment(draft);
    setDraft('');
  };

  return (
    <div className={`ti-overlay ti-overlay-anim is-${phase}`} onClick={handleClose}>
      <div className="ti-overlay-bg" ref={bgRef} />
      <div className="ti-expanded" ref={expandedRef} onClick={(e) => e.stopPropagation()}>
        <div className="ti-gloss" />
        <div className="ti-gloss-edge" />

        <button className="ti-x" onClick={handleClose} aria-label="close">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="m6 6 12 12M6 18 18 6"/>
          </svg>
        </button>

        <div className="ti-expanded-main">
          <header className="ti-tile-hd ti-tile-hd-lg">
            <div className="ti-author">
              <div className="ti-avatar ti-avatar-lg">
                {tile.author.avatar_url
                  ? <img src={tile.author.avatar_url} alt={tile.author.avatar} />
                  : tile.author.avatar}
              </div>
              <div className="ti-author-meta">
                <div className="ti-author-name">{tile.author.name}</div>
                <div className="ti-author-handle">@{tile.author.handle} · {tile.time}</div>
              </div>
            </div>
            <div className="ti-expanded-hd-actions">
              {canDelete && (
                <button className="ti-expanded-delete"
                        onPointerDown={(e) => { e.stopPropagation(); onClose(); onDelete && onDelete(); }}
                        aria-label={isAuthor ? 'Delete tile' : 'Remove tile'}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>
                  </svg>
                  <span>{isAuthor ? 'Delete' : 'Remove'}</span>
                </button>
              )}
              {!isAuthor && <button className="ti-follow">Follow</button>}
            </div>
          </header>

          <div className="ti-expanded-body">
            <ExpandedBody tile={tile} onVote={onVote} />
          </div>

          <footer className="ti-expanded-ft">
            <button className={`ti-tile-btn ti-like${tile.liked ? ' is-liked' : ''}`} onClick={onLike}>
              <HeartIcon filled={tile.liked} />
              <span>{fmt(tile.likes)}</span>
            </button>
            <button className={`ti-tile-btn ti-save${tile.saved ? ' is-saved' : ''}`} onClick={onSave}>
              <BookmarkIcon filled={tile.saved} />
              <span>{tile.saved ? 'Saved' : 'Save'}</span>
            </button>
            <span className="ti-sep" />
            <span className="ti-meta-line">{comments.length} comments</span>
            <span className="ti-meta-grow" />
            <span className="ti-meta-line">{fmt(Math.round(tile.likes * 4.7) + 1200)} views</span>
          </footer>
        </div>

        <aside className="ti-comments-rail">
          <div className="ti-rail-hd">
            <span>Comments</span>
            <span className="ti-rail-count">{comments.length}</span>
          </div>
          <div className="ti-rail-list">
            {comments.length === 0 && <div className="ti-rail-empty">No comments yet. Be the first.</div>}
            {comments.map(c => <Comment key={c.id} c={c} />)}
          </div>
          <form className="ti-rail-input" onSubmit={submit}>
            <div className="ti-avatar ti-avatar-sm">
              {me?.avatar_url
                ? <img src={me.avatar_url} alt={me?.avatar || 'you'} />
                : (me?.avatar || 'YO')}
            </div>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment…" />
            <button type="submit" disabled={!draft.trim()}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function ExpandedBody({ tile, onVote }) {
  switch (tile.kind) {
    case 'photo': case 'video': case 'live': {
      // If real media is uploaded, render the actual file
      if (tile.media?.url && tile.kind !== 'live') {
        return (
          <>
            <div className="ti-exp-media ti-exp-media-real">
              {tile.kind === 'photo'
                ? <img src={tile.media.url} alt={tile.caption || ''} />
                : <video src={tile.media.url} controls playsInline preload="metadata" />}
            </div>
            {tile.caption && <p className="ti-exp-caption">{tile.caption}</p>}
          </>
        );
      }
      const tone = tile.media?.tone || 200;
      const grad = `radial-gradient(120% 80% at 30% 20%, oklch(0.32 0.04 ${tone}) 0%, oklch(0.14 0.02 ${tone}) 50%, oklch(0.06 0.01 ${tone}) 100%)`;
      return (
        <>
          <div className="ti-exp-media" style={{ background: grad }}>
            <div className="ti-media-stripes" />
            {tile.kind === 'video' && (
              <div className="ti-play ti-play-lg">
                <svg viewBox="0 0 24 24" width="32" height="32"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
              </div>
            )}
            {tile.kind === 'live' && (
              <div className="ti-live-overlay ti-live-overlay-lg">
                <div className="ti-live-dot" /><span>LIVE</span>
                <span className="ti-live-viewers">{fmt(tile.media?.viewers || 0)} watching</span>
              </div>
            )}
            {tile.media?.duration && <div className="ti-media-duration">{tile.media.duration}</div>}
            {tile.media?.label && <div className="ti-media-label">{tile.media.label}</div>}
          </div>
          {tile.caption && <p className="ti-exp-caption">{tile.caption}</p>}
        </>
      );
    }
    case 'text': return <p className="ti-exp-text">{tile.body}</p>;
    case 'audio': return (
      <div className="ti-exp-audio">
        {tile.media?.url
          ? <audio className="ti-audio-real" src={tile.media.url} controls preload="metadata" />
          : <Waveform bars={tile.media?.waveform || []} duration={tile.media?.duration} />}
        {tile.caption && <p className="ti-exp-caption">{tile.caption}</p>}
      </div>
    );
    case 'link': return (
      <>
        {tile.body && <p className="ti-exp-caption ti-caption-lead">{tile.body}</p>}
        <div className="ti-linkcard ti-linkcard-lg">
          <div className="ti-linkcard-thumb" />
          <div className="ti-linkcard-meta">
            <div className="ti-linkcard-domain">{tile.link.domain}</div>
            <div className="ti-linkcard-title">{tile.link.title}</div>
            <div className="ti-linkcard-excerpt">{tile.link.excerpt}</div>
          </div>
        </div>
      </>
    );
    case 'poll': return (
      <>
        {tile.body && <p className="ti-exp-caption ti-caption-lead">{tile.body}</p>}
        <Poll poll={tile.poll} onVote={onVote} />
      </>
    );
    case 'chart': return (
      <div className="ti-exp-chart-wrap">
        <BarChart chart={tile.chart} large />
        {tile.caption && <p className="ti-exp-caption">{tile.caption}</p>}
      </div>
    );
    case 'grid': return (
      <div className="ti-exp-grid-wrap">
        <DataGrid grid={tile.grid} large />
        {tile.caption && <p className="ti-exp-caption">{tile.caption}</p>}
      </div>
    );
    default: return null;
  }
}

function Comment({ c }) {
  return (
    <div className="ti-comment">
      <div className="ti-avatar ti-avatar-sm">
        {c.author.avatar_url
          ? <img src={c.author.avatar_url} alt={c.author.avatar} />
          : c.author.avatar}
      </div>
      <div className="ti-comment-body">
        <div className="ti-comment-meta">
          <span className="ti-comment-handle">@{c.author.handle}</span>
          <span className="ti-comment-time">{c.time}</span>
        </div>
        <div className="ti-comment-text">{c.body}</div>
        <div className="ti-comment-actions">
          <button>Reply</button>
          <button>Like</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Mobile comment sheet — full-screen view with the tile shown up top,
// comments scrolling below, and a sticky input at the bottom. Used in
// place of CommentRail on phone-sized viewports.
// ─────────────────────────────────────────────────────────────────────────
function MobileCommentSheet({ tile, comments, onClose, onComment, me }) {
  const [draft, setDraft] = useState_o('');
  useEffect_o(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e) => {
    e?.preventDefault();
    if (!draft.trim()) return;
    onComment(draft);
    setDraft('');
  };

  if (!tile) return null;
  return (
    <div className="ti-mc-sheet">
      <header className="ti-mc-topbar">
        <button className="ti-mc-back" onClick={onClose} aria-label="back">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="m15 6-6 6 6 6"/>
          </svg>
        </button>
        <div className="ti-mc-title">
          <span className="ti-mc-title-main">Comments</span>
          <span className="ti-mc-title-sub">{comments.length} on @{tile.author.handle}'s tile</span>
        </div>
        <span className="ti-mc-spacer" />
      </header>

      <div className="ti-mc-scroll">
        <article className="ti-mc-tile">
          <div className="ti-gloss" />
          <div className="ti-gloss-edge" />
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
          </header>
          <ExpandedBody tile={tile} onVote={() => {}} />
        </article>

        <div className="ti-mc-divider">
          <span>{comments.length} comment{comments.length === 1 ? '' : 's'}</span>
        </div>

        <div className="ti-mc-list">
          {comments.length === 0 ? (
            <div className="ti-mc-empty">
              <div className="ti-mc-empty-mark"><span /><span /><span /><span /></div>
              <div className="ti-mc-empty-msg">No comments yet.</div>
              <div className="ti-mc-empty-sub">Be the first to share your thoughts.</div>
            </div>
          ) : (
            comments.map(c => <Comment key={c.id} c={c} />)
          )}
        </div>
      </div>

      <form className="ti-mc-input" onSubmit={submit}>
        <div className="ti-avatar ti-avatar-sm">
          {me?.avatar_url
            ? <img src={me.avatar_url} alt={me?.avatar || 'you'} />
            : (me?.avatar || 'YO')}
        </div>
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
               placeholder="Add a comment…" autoFocus />
        <button type="submit" disabled={!draft.trim()} aria-label="Post comment">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
        </button>
      </form>
    </div>
  );
}

function CommentRail({ tile, comments, onClose, onComment, me }) {
  const [draft, setDraft] = useState_o('');
  useEffect_o(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e) => {
    e?.preventDefault();
    if (!draft.trim()) return;
    onComment(draft);
    setDraft('');
  };

  return (
    <>
      <div className="ti-rail-veil" onClick={onClose} />
      <aside className="ti-side-rail">
        <div className="ti-gloss" />
        <header className="ti-side-rail-hd">
          <div>
            <div className="ti-rail-eyebrow">Comments on</div>
            <div className="ti-rail-tiletitle">@{tile.author.handle}'s tile</div>
          </div>
          <button className="ti-x" onClick={onClose} aria-label="close">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="m6 6 12 12M6 18 18 6"/>
            </svg>
          </button>
        </header>
        <div className="ti-rail-list">
          {comments.length === 0 && <div className="ti-rail-empty">No comments yet. Be the first.</div>}
          {comments.map(c => <Comment key={c.id} c={c} />)}
        </div>
        <form className="ti-rail-input" onSubmit={submit}>
          <div className="ti-avatar ti-avatar-sm">
            {me?.avatar_url
              ? <img src={me.avatar_url} alt={me?.avatar || 'you'} />
              : (me?.avatar || 'YO')}
          </div>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment…" autoFocus />
          <button type="submit" disabled={!draft.trim()}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </button>
        </form>
      </aside>
    </>
  );
}

function Composer({ onClose, onPost, mode, existingTags = [], onUploadMedia }) {
  const [kind, setKind] = useState_o('text');
  const [body, setBody] = useState_o('');
  const [tags, setTags] = useState_o([]);
  const [tagDraft, setTagDraft] = useState_o('');
  const [media, setMedia] = useState_o(null);   // { url, mime } when uploaded
  const [uploading, setUploading] = useState_o(false);
  const [error, setError] = useState_o(null);
  const inputRef = useRef_o(null);
  const fileRef = useRef_o(null);

  useEffect_o(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const kinds = [
    { id: 'text', label: 'Text' },
    { id: 'photo', label: 'Photo' },
    { id: 'video', label: 'Video' },
    { id: 'audio', label: 'Audio' },
    { id: 'link', label: 'Link' },
    { id: 'poll', label: 'Poll' },
    ...(mode === 'pro' ? [
      { id: 'chart', label: 'Chart', proOnly: true },
      { id: 'grid', label: 'Grid', proOnly: true },
    ] : []),
  ];

  // if mode flips and current kind is no longer available, fall back to text
  useEffect_o(() => {
    if (!kinds.some(k => k.id === kind)) setKind('text');
  }, [mode]);

  const addTag = (raw) => {
    const t = raw.trim().toLowerCase().replace(/^#/, '').replace(/[^\w-]/g, '-');
    if (!t || tags.includes(t) || tags.length >= 5) return;
    setTags(prev => [...prev, t]);
    setTagDraft('');
  };
  const removeTag = (t) => setTags(prev => prev.filter(x => x !== t));

  const onTagKey = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      if (tagDraft.trim()) addTag(tagDraft);
    } else if (e.key === 'Backspace' && !tagDraft && tags.length) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  const suggested = existingTags.filter(t => !tags.includes(t)).slice(0, 6);

  const pickFile = () => fileRef.current?.click();
  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUploadMedia) return;
    setError(null);
    setUploading(true);
    const r = await onUploadMedia(file);
    setUploading(false);
    if (!r.ok) { setError(r.error); return; }
    setMedia({ url: r.url, mime: r.mime, kind: r.kind });
  };

  // Keep accept loose so iOS / Android camera roll surfaces all media in
  // the picker (HEIC photos, m4a audio, etc.). The actual MIME validation
  // happens server-side via handleUploadTileMedia.
  const acceptForKind = kind === 'photo' ? 'image/*'
                     : kind === 'video' ? 'video/*'
                     : kind === 'audio' ? 'audio/*'
                     : '';

  const submit = (e) => {
    e?.preventDefault();
    setError(null);
    // text/chart/grid require a body; media kinds can post with just media
    const needsBody = kind === 'text' || kind === 'chart' || kind === 'grid' || kind === 'link' || kind === 'poll';
    if (needsBody && !body.trim()) return;
    if ((kind === 'photo' || kind === 'video' || kind === 'audio') && !media) {
      setError('Pick a file first.');
      return;
    }
    onPost(kind, body, tags, media);
  };

  return (
    <div className="ti-overlay ti-overlay-composer" onClick={onClose}>
      <div className="ti-overlay-bg" />
      <form className="ti-composer" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="ti-gloss" />
        <div className="ti-gloss-edge" />

        <header className="ti-composer-hd">
          <div className="ti-composer-eyebrow">
            <span className="ti-composer-dot" /> New tile · posting to {mode}
          </div>
          <button type="button" className="ti-x" onClick={onClose} aria-label="close">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="m6 6 12 12M6 18 18 6"/>
            </svg>
          </button>
        </header>

        <div className="ti-composer-kinds">
          {kinds.map(k => (
            <button key={k.id} type="button"
                    className={`ti-comp-kind${kind === k.id ? ' is-active' : ''}${k.proOnly ? ' is-pro' : ''}`}
                    onClick={() => setKind(k.id)}>
              {k.proOnly && <span className="ti-comp-pro-mark">PRO</span>}
              {k.label}
            </button>
          ))}
        </div>

        <textarea ref={inputRef}
          className="ti-composer-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            kind === 'text' ? 'What\'s on your mind?'
            : kind === 'photo' ? 'Drop a photo here, or write a caption…'
            : kind === 'video' ? 'Drop a video, or write a caption…'
            : kind === 'audio' ? 'Record audio, or write a caption…'
            : kind === 'link' ? 'Paste a link, or add context…'
            : kind === 'poll' ? 'Write your poll question…'
            : kind === 'chart' ? 'Title for your chart (e.g. WAU · last 8 weeks)…'
            : 'Title for your data grid…'
          }
        />

        {(kind === 'photo' || kind === 'video' || kind === 'audio') && (
          <div className="ti-composer-dropzone" onClick={pickFile}>
            <input ref={fileRef} type="file" accept={acceptForKind}
                   className="ti-file-hidden"
                   onChange={onFileChosen} />
            {media
              ? <div className="ti-composer-media-preview">
                  {media.kind === 'image' && <img src={media.url} alt="" />}
                  {media.kind === 'video' && <video src={media.url} muted />}
                  {media.kind === 'audio' && <audio src={media.url} controls onClick={(e) => e.stopPropagation()} />}
                  <button type="button" className="ti-composer-media-x"
                          onClick={(e) => { e.stopPropagation(); setMedia(null); }}>×</button>
                </div>
              : <span>
                  {uploading ? 'Uploading…'
                   : kind === 'photo' ? 'Tap to upload a photo'
                   : kind === 'video' ? 'Tap to upload a video'
                   : 'Tap to upload audio'}
                </span>}
          </div>
        )}
        {kind === 'link' && (
          <div className="ti-composer-dropzone">
            <span>Paste URL in the box above (link unfurl coming later)</span>
          </div>
        )}
        {kind === 'poll' && (
          <div className="ti-composer-dropzone">
            <span>Poll options coming after post (default 3 options)</span>
          </div>
        )}
        {error && <div className="ti-auth-err">{error}</div>}

        {kind === 'chart' && (
          <div className="ti-composer-preview">
            <div className="ti-composer-preview-lbl">Preview · sample data</div>
            <BarChart chart={{ label: body.trim() || 'Untitled chart', unit: '',
              data: [
                { label: 'Mon', value: 32 }, { label: 'Tue', value: 48 },
                { label: 'Wed', value: 41 }, { label: 'Thu', value: 56 },
                { label: 'Fri', value: 64 }, { label: 'Sat', value: 38 },
                { label: 'Sun', value: 29 },
              ] }} />
            <div className="ti-composer-hint">
              Connect a data source after posting · sample data shown for now.
            </div>
          </div>
        )}

        {kind === 'grid' && (
          <div className="ti-composer-preview">
            <div className="ti-composer-preview-lbl">Preview · 3×3 starter</div>
            <DataGrid grid={{
              columns: ['Item', 'Owner', 'Status'],
              rows: [
                ['Item one', '@you', { label: 'In progress', tone: 'info' }],
                ['Item two', '@you', { label: 'Shipped', tone: 'good' }],
                ['Item three', '@you', { label: 'Blocked', tone: 'bad' }],
              ],
            }} />
            <div className="ti-composer-hint">
              Add or import rows after posting · starter rows shown for now.
            </div>
          </div>
        )}

        {/* tags */}
        <div className="ti-comp-tags">
          <div className="ti-comp-tags-hd">
            <span>Tags</span>
            <span className="ti-comp-tags-meta">{tags.length}/5 · helps people find this</span>
          </div>
          <div className="ti-comp-tags-input-wrap">
            {tags.map(t => (
              <span key={t} className="ti-comp-tag">
                #{t}
                <button type="button" onClick={() => removeTag(t)} aria-label={`remove ${t}`}>×</button>
              </span>
            ))}
            <input
              className="ti-comp-tag-input"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={onTagKey}
              onBlur={() => tagDraft.trim() && addTag(tagDraft)}
              placeholder={tags.length === 0 ? 'e.g. arsenal, photography, music…' : 'add another'}
              disabled={tags.length >= 5}
            />
          </div>
          {suggested.length > 0 && (
            <div className="ti-comp-suggested">
              <span className="ti-comp-suggested-lbl">Suggested:</span>
              {suggested.map(s => (
                <button key={s} type="button" className="ti-comp-suggested-chip" onClick={() => addTag(s)}>
                  +#{s}
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="ti-composer-ft">
          <div className="ti-composer-meta">{body.length} / 280</div>
          <button type="button" className="ti-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="ti-btn-primary" disabled={!body.trim()}>Post tile</button>
        </footer>
      </form>
    </div>
  );
}

function NotificationsPanel({ notifications, originRect, onClose, onDismiss, onClearAll }) {
  const [phase, setPhase] = useState_o('opening');
  const panelRef = useRef_o(null);
  const bgRef = useRef_o(null);

  useEffect_o(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // FLIP: snap to origin rect (the bell button), then release to natural size.
  useEffect_o(() => {
    const el = panelRef.current;
    if (!el) return;
    if (originRect) {
      const final = el.getBoundingClientRect();
      const dx = originRect.left + originRect.width / 2 - (final.left + final.width / 2);
      const dy = originRect.top + originRect.height / 2 - (final.top + final.height / 2);
      const sx = originRect.width / final.width;
      const sy = originRect.height / final.height;
      el.style.transformOrigin = 'center center';
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      el.style.opacity = '0.4';
      el.getBoundingClientRect();
      requestAnimationFrame(() => {
        el.style.transition = 'transform .38s cubic-bezier(.2,.8,.2,1), opacity .26s ease-out';
        el.style.transform = 'translate(0,0) scale(1,1)';
        el.style.opacity = '1';
      });
      const done = () => { setPhase('open'); el.style.transition = ''; el.removeEventListener('transitionend', done); };
      el.addEventListener('transitionend', done);
    } else {
      setPhase('open');
    }
  }, []);

  const handleClose = () => {
    const el = panelRef.current;
    if (!el || !originRect) { onClose(); return; }
    const final = el.getBoundingClientRect();
    const dx = originRect.left + originRect.width / 2 - (final.left + final.width / 2);
    const dy = originRect.top + originRect.height / 2 - (final.top + final.height / 2);
    const sx = originRect.width / final.width;
    const sy = originRect.height / final.height;
    setPhase('closing');
    el.style.transition = 'transform .3s cubic-bezier(.4,0,.2,1), opacity .26s ease-in';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    el.style.opacity = '0';
    if (bgRef.current) {
      bgRef.current.style.transition = 'opacity .26s ease-in';
      bgRef.current.style.opacity = '0';
    }
    setTimeout(onClose, 280);
  };

  return (
    <div className={`ti-overlay ti-notif-overlay ti-overlay-anim is-${phase}`} onClick={handleClose}>
      <div className="ti-overlay-bg ti-notif-bg" ref={bgRef} />
      <div className="ti-notif-panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className="ti-gloss" />
        <div className="ti-gloss-edge" />

        <header className="ti-notif-hd">
          <div className="ti-notif-title-wrap">
            <div className="ti-notif-eyebrow">Inbox</div>
            <h2 className="ti-notif-title">Notifications</h2>
          </div>
          <div className="ti-notif-hd-actions">
            {notifications.length > 0 && (
              <button className="ti-notif-clear" onClick={onClearAll}>Clear all</button>
            )}
            <button className="ti-x ti-notif-x" onClick={handleClose} aria-label="close">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="m6 6 12 12M6 18 18 6"/>
              </svg>
            </button>
          </div>
        </header>

        <div className="ti-notif-list">
          {notifications.length === 0 ? (
            <div className="ti-notif-empty">
              <div className="ti-empty-mark"><span /><span /><span /><span /></div>
              <div className="ti-notif-empty-msg">You're all caught up.</div>
              <div className="ti-notif-empty-sub">New activity will appear here.</div>
            </div>
          ) : (
            notifications.map(n => (
              <NotificationItem key={n.id} n={n} onDismiss={() => onDismiss(n.id)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationItem({ n, onDismiss }) {
  const [drag, setDrag] = useState_o({ x: 0, dragging: false });
  const startRef = useRef_o(0);
  const elRef = useRef_o(null);

  const onPointerDown = (e) => {
    if (e.target.closest('.ti-no-drag')) return;
    startRef.current = e.clientX;
    setDrag({ x: 0, dragging: true });
    elRef.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.dragging) return;
    setDrag(d => ({ ...d, x: e.clientX - startRef.current }));
  };
  const onPointerUp = () => {
    if (!drag.dragging) return;
    const dx = drag.x;
    if (Math.abs(dx) > 90) {
      setDrag({ x: dx > 0 ? 600 : -600, dragging: false });
      setTimeout(onDismiss, 200);
    } else {
      setDrag({ x: 0, dragging: false });
    }
  };

  const opacity = 1 - Math.min(0.7, Math.abs(drag.x) / 360);
  const dismissHint = Math.abs(drag.x) > 30;

  return (
    <article ref={elRef}
      className={`ti-notif-item ti-kind-${n.kind}${n.unread ? ' is-unread' : ''}`}
      style={{
        transform: `translateX(${drag.x}px)`,
        opacity,
        transition: drag.dragging ? 'none' : 'transform .26s cubic-bezier(.2,.7,.3,1), opacity .26s',
      }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className="ti-gloss" />
      {dismissHint && (
        <div className="ti-notif-dismiss-hint" style={{ opacity: Math.min(1, Math.abs(drag.x) / 90) }}>
          {drag.x > 0 ? 'dismiss →' : '← dismiss'}
        </div>
      )}
      {n.unread && <span className="ti-notif-unread-dot" />}
      <div className="ti-notif-avatar-wrap">
        <div className="ti-avatar ti-notif-avatar">
          {n.actor.avatar_url
            ? <img src={n.actor.avatar_url} alt={n.actor.avatar} />
            : n.actor.avatar}
        </div>
        <span className={`ti-notif-glyph ti-notif-glyph-${n.kind}`}>
          <NotifGlyph kind={n.kind} />
        </span>
      </div>
      <div className="ti-notif-body">
        <div className="ti-notif-line">
          <span className="ti-notif-actor">{n.actor.name}</span>
          <span className="ti-notif-action"> {n.body}</span>
        </div>
        {n.preview && <div className="ti-notif-preview">{n.preview}</div>}
        <div className="ti-notif-meta">
          <span className="ti-notif-handle">@{n.actor.handle}</span>
          <span className="ti-notif-dot">·</span>
          <span className="ti-notif-time">{n.time}</span>
        </div>
      </div>
      <button className="ti-notif-x ti-no-drag" onClick={(e) => { e.stopPropagation(); onDismiss(); }} aria-label="dismiss notification">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m6 6 12 12M6 18 18 6"/>
        </svg>
      </button>
    </article>
  );
}

function NotifGlyph({ kind }) {
  if (kind === 'like') return (
    <svg viewBox="0 0 12 12" width="9" height="9" fill="currentColor">
      <path d="M6 10.5s-3.7-2.4-4.9-4.7C.5 4.3 1.6 2.4 3.4 2.4c1 0 1.7.5 2.6 1.5.9-1 1.6-1.5 2.6-1.5 1.8 0 2.9 1.9 2.3 3.4C9.7 8.1 6 10.5 6 10.5z"/>
    </svg>
  );
  if (kind === 'comment' || kind === 'reply') return (
    <svg viewBox="0 0 12 12" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M10.5 6c0 2-2 3.5-4.5 3.5-.6 0-1.2-.1-1.7-.3L2 10l.6-1.7C1.9 7.6 1.5 6.8 1.5 6c0-2 2-3.5 4.5-3.5s4.5 1.5 4.5 3.5z"/>
    </svg>
  );
  if (kind === 'follow') return (
    <svg viewBox="0 0 12 12" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="5" cy="4" r="1.8"/>
      <path d="M1.5 10.5c.5-1.6 1.8-2.5 3.5-2.5s3 .9 3.5 2.5"/>
      <path d="M9.5 4v3M8 5.5h3"/>
    </svg>
  );
  if (kind === 'mention') return (
    <svg viewBox="0 0 12 12" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="6" cy="6" r="1.8"/>
      <path d="M7.8 6v1.2c0 .8.6 1.3 1.3 1.1.7-.2 1-.9 1-1.8 0-2.6-2-4.5-4.5-4.5S1.5 3.4 1.5 6 3.4 10.5 6 10.5c1 0 1.9-.3 2.6-.8"/>
    </svg>
  );
  if (kind === 'save') return (
    <svg viewBox="0 0 12 12" width="9" height="9" fill="currentColor">
      <path d="M3 2h6v8.5L6 8.7 3 10.5z"/>
    </svg>
  );
  if (kind === 'live') return (
    <svg viewBox="0 0 12 12" width="9" height="9" fill="currentColor">
      <circle cx="6" cy="6" r="2.5"/>
    </svg>
  );
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Admin / Owner panel — visible only to staff. Lists profiles from
// Supabase; Owner can change roles, Admin can view. Stats tab summarizes
// the count by role.
// ─────────────────────────────────────────────────────────────────────────

function AdminPanel({ user, onClose }) {
  const supabase = window.supabaseClient;
  const [users, setUsers] = useState_o([]);
  const [loading, setLoading] = useState_o(true);
  const [tab, setTab] = useState_o('users');
  const [error, setError] = useState_o(null);
  const [pendingId, setPendingId] = useState_o(null);
  const isOwner = user?.role === 'owner';

  useEffect_o(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadUsers = () => {
    if (!supabase) { setError('Supabase not configured.'); setLoading(false); return; }
    setLoading(true);
    supabase.from('profiles')
      .select('id, username, name, avatar, avatar_url, role, bio, created_at')
      .order('role', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) { setError(error.message); setLoading(false); return; }
        setUsers(data || []);
        setLoading(false);
      });
  };

  useEffect_o(() => { loadUsers(); }, []);

  const setRole = async (userId, newRole) => {
    setError(null);
    setPendingId(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    setPendingId(null);
    if (error) {
      setError(error.message || 'Could not change role.');
      return;
    }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const stats = {
    total: users.length,
    owners: users.filter(u => u.role === 'owner').length,
    admins: users.filter(u => u.role === 'admin').length,
    members: users.filter(u => u.role === 'user').length,
  };

  return (
    <div className="ti-overlay ti-admin-overlay" onClick={onClose}>
      <div className="ti-overlay-bg" />
      <div className="ti-admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ti-gloss" />
        <div className="ti-gloss-edge" />

        <header className="ti-admin-hd">
          <div>
            <div className="ti-admin-eyebrow">
              {isOwner ? 'Owner panel' : 'Admin panel'} · staff only
            </div>
            <h2 className="ti-admin-title">Site administration</h2>
          </div>
          <button className="ti-x" onClick={onClose} aria-label="close">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="m6 6 12 12M6 18 18 6"/>
            </svg>
          </button>
        </header>

        <nav className="ti-admin-tabs">
          <button className={`ti-admin-tab${tab === 'users' ? ' is-active' : ''}`} onClick={() => setTab('users')}>
            Users <span className="ti-admin-tab-count">{stats.total}</span>
          </button>
          <button className={`ti-admin-tab${tab === 'stats' ? ' is-active' : ''}`} onClick={() => setTab('stats')}>
            Overview
          </button>
        </nav>

        <div className="ti-admin-body">
          {error && <div className="ti-auth-err ti-admin-err">{error}</div>}
          {loading ? (
            <div className="ti-admin-loading"><div className="ti-auth-loading-bar"><span /></div></div>
          ) : tab === 'users' ? (
            <AdminUsersList users={users} isOwner={isOwner} myId={user?.id}
                            pendingId={pendingId} onChangeRole={setRole} />
          ) : (
            <AdminStats stats={stats} />
          )}
        </div>

        <footer className="ti-admin-ft">
          <span className="ti-admin-ft-note">
            {isOwner
              ? 'As Owner, you can promote or demote any account.'
              : 'As Admin, you can view all accounts. Only the Owner can change roles.'}
          </span>
          <button className="ti-admin-refresh" onClick={loadUsers} disabled={loading}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>
            </svg>
            <span>Refresh</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

function AdminUsersList({ users, isOwner, myId, pendingId, onChangeRole }) {
  if (!users.length) {
    return <div className="ti-admin-empty">No accounts yet.</div>;
  }
  return (
    <div className="ti-admin-users">
      {users.map(u => {
        const isSelf = u.id === myId;
        const disabled = !isOwner || isSelf || pendingId === u.id;
        return (
          <div key={u.id} className={`ti-admin-user ti-role-${u.role}`}>
            <div className={`ti-admin-user-avatar ti-role-ring-${u.role}`}>
              {u.avatar_url
                ? <img src={u.avatar_url} alt={u.avatar} />
                : u.avatar}
            </div>
            <div className="ti-admin-user-meta">
              <div className="ti-admin-user-name">
                {u.name}
                {u.role === 'owner' && <span className="ti-role-badge ti-role-badge-owner ti-role-badge-sm">Owner</span>}
                {u.role === 'admin' && <span className="ti-role-badge ti-role-badge-admin ti-role-badge-sm">Admin</span>}
                {isSelf && <span className="ti-admin-self">you</span>}
              </div>
              <div className="ti-admin-user-handle">@{u.username}</div>
              {u.bio && <div className="ti-admin-user-bio">{u.bio}</div>}
            </div>
            <div className="ti-admin-user-actions">
              {isOwner ? (
                <select className="ti-admin-role-select"
                        value={u.role}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next === u.role) return;
                          if (u.role === 'owner' && !window.confirm(`Demote ${u.name} from Owner?`)) return;
                          if (next === 'owner' && !window.confirm(`Promote ${u.name} to Owner? You'll keep your own owner role.`)) return;
                          onChangeRole(u.id, next);
                        }}
                        title={isSelf ? "You can't change your own role." : ''}>
                  <option value="user">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              ) : (
                <span className="ti-admin-role-readonly">{u.role}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminStats({ stats }) {
  const cards = [
    { label: 'Total accounts', value: stats.total, tone: 'neutral' },
    { label: 'Members',        value: stats.members, tone: 'neutral' },
    { label: 'Admins',         value: stats.admins, tone: 'info' },
    { label: 'Owners',         value: stats.owners, tone: 'gold' },
  ];
  return (
    <div className="ti-admin-stats">
      {cards.map(c => (
        <div key={c.label} className={`ti-admin-stat ti-admin-stat-${c.tone}`}>
          <div className="ti-admin-stat-num">{c.value}</div>
          <div className="ti-admin-stat-lbl">{c.label}</div>
        </div>
      ))}
      <div className="ti-admin-stat-note">
        Tile, comment, and notification counts will appear here once the data layer migration is complete.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Edit profile modal
// ─────────────────────────────────────────────────────────────────────────

function EditProfileModal({ user, onClose, onSave, onUploadAvatar, onClearAvatar }) {
  const [name, setName] = useState_o(user?.name || '');
  const [username, setUsername] = useState_o(user?.handle || '');
  const [avatar, setAvatar] = useState_o(user?.avatar || '');
  const [avatarUrl, setAvatarUrl] = useState_o(user?.avatar_url || null);
  const [bio, setBio] = useState_o(user?.bio || '');
  const [busy, setBusy] = useState_o(false);
  const [uploading, setUploading] = useState_o(false);
  const [error, setError] = useState_o(null);
  const fileRef = useRef_o(null);

  const handleFile = async (file) => {
    if (!file || !onUploadAvatar) return;
    setError(null);
    setUploading(true);
    const r = await onUploadAvatar(file);
    setUploading(false);
    if (!r.ok) { setError(r.error); return; }
    // bust browser cache so the new file shows immediately
    setAvatarUrl(r.url + (r.url.includes('?') ? '&' : '?') + 'cb=' + Date.now());
  };

  const handleRemoveAvatar = async () => {
    if (!onClearAvatar) return;
    setError(null);
    setUploading(true);
    const r = await onClearAvatar();
    setUploading(false);
    if (!r.ok) { setError(r.error); return; }
    setAvatarUrl(null);
  };

  useEffect_o(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    const r = await onSave({ name, avatar, bio, username });
    setBusy(false);
    if (!r?.ok) setError(r?.error || 'Could not save changes.');
    else onClose();
  };

  return (
    <div className="ti-overlay ti-edit-overlay" onClick={onClose}>
      <div className="ti-overlay-bg" />
      <form className="ti-edit-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="ti-gloss" />
        <div className="ti-gloss-edge" />

        <header className="ti-edit-hd">
          <div>
            <div className="ti-edit-eyebrow">Profile</div>
            <h2 className="ti-edit-title">Edit your profile</h2>
          </div>
          <button type="button" className="ti-x" onClick={onClose} aria-label="close">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="m6 6 12 12M6 18 18 6"/>
            </svg>
          </button>
        </header>

        <div className="ti-edit-row">
          <div className="ti-edit-avatar-preview">
            {avatarUrl
              ? <img src={avatarUrl} alt={avatar} />
              : (avatar || 'YO').slice(0, 4).toUpperCase()}
          </div>
          <div className="ti-edit-avatar-controls">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
                   style={{ display: 'none' }}
                   onChange={(e) => handleFile(e.target.files?.[0])} />
            <button type="button" className="ti-edit-upload"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}>
              {uploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
            </button>
            {avatarUrl && (
              <button type="button" className="ti-edit-remove"
                      disabled={uploading}
                      onClick={handleRemoveAvatar}>
                Remove
              </button>
            )}
            <span className="ti-edit-hint ti-edit-hint-block">PNG / JPG / WEBP · max 2 MB</span>
          </div>
        </div>

        <label className="ti-edit-field">
          <span className="ti-edit-lbl">Avatar fallback (1–4 letters)</span>
          <input className="ti-auth-input" maxLength={4}
                 value={avatar}
                 onChange={(e) => setAvatar(e.target.value.toUpperCase())} />
          <span className="ti-edit-hint">Shown when no photo is set or fails to load.</span>
        </label>

        <label className="ti-edit-field">
          <span className="ti-edit-lbl">Display name</span>
          <input className="ti-auth-input" maxLength={60}
                 value={name}
                 onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="ti-edit-field">
          <span className="ti-edit-lbl">Username</span>
          <div className="ti-edit-username-wrap">
            <span className="ti-edit-username-at">@</span>
            <input className="ti-auth-input ti-edit-username-input" maxLength={24}
                   value={username}
                   onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.\-]/g, ''))}
                   placeholder="yourhandle" />
          </div>
          <span className="ti-edit-hint">3–24 characters · letters, numbers, dots, dashes, underscores</span>
        </label>

        <label className="ti-edit-field">
          <span className="ti-edit-lbl">Bio</span>
          <textarea className="ti-auth-input ti-edit-bio" rows={3} maxLength={200}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="A short line about you." />
          <span className="ti-edit-hint">{bio.length} / 200</span>
        </label>

        {error && <div className="ti-auth-err">{error}</div>}

        <footer className="ti-edit-ft">
          <button type="button" className="ti-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="ti-auth-submit ti-edit-save" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Followers / Following list modal
// ─────────────────────────────────────────────────────────────────────────

function FollowListModal({ tab, ownerId, ownerName, me, followingIds, onFollow, onClose, onOpenProfile }) {
  const supabase = window.supabaseClient;
  const [users, setUsers] = useState_o([]);
  const [loading, setLoading] = useState_o(true);
  const [error, setError] = useState_o(null);

  useEffect_o(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect_o(() => {
    if (!supabase || !ownerId) return;
    let mounted = true;
    setLoading(true);
    // tab === 'followers' → people who follow ownerId  → join on follower_id
    // tab === 'following' → people ownerId follows     → join on followee_id
    const select = tab === 'followers'
      ? 'follower:profiles!follows_follower_id_fkey(id,username,name,avatar,avatar_url,role,bio)'
      : 'followee:profiles!follows_followee_id_fkey(id,username,name,avatar,avatar_url,role,bio)';
    const filter = tab === 'followers' ? 'followee_id' : 'follower_id';
    supabase.from('follows').select(select).eq(filter, ownerId)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) { setError(error.message); setLoading(false); return; }
        const key = tab === 'followers' ? 'follower' : 'followee';
        setUsers((data || []).map(r => r[key]).filter(Boolean));
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [tab, ownerId]);

  const title = tab === 'followers' ? 'Followers' : 'Following';
  const sub = tab === 'followers'
    ? `People who follow ${ownerName || 'this user'}`
    : `${ownerName || 'This user'} follows`;

  return (
    <div className="ti-overlay ti-follow-overlay" onClick={onClose}>
      <div className="ti-overlay-bg" />
      <div className="ti-follow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ti-gloss" />
        <div className="ti-gloss-edge" />

        <header className="ti-follow-hd">
          <div>
            <div className="ti-edit-eyebrow">{sub}</div>
            <h2 className="ti-edit-title">{title}</h2>
          </div>
          <button className="ti-x" onClick={onClose} aria-label="close">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="m6 6 12 12M6 18 18 6"/>
            </svg>
          </button>
        </header>

        <div className="ti-follow-body">
          {error && <div className="ti-auth-err">{error}</div>}
          {loading ? (
            <div className="ti-admin-loading"><div className="ti-auth-loading-bar"><span /></div></div>
          ) : users.length === 0 ? (
            <div className="ti-admin-empty">
              {tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </div>
          ) : (
            <div className="ti-follow-list">
              {users.map(u => {
                const isMe = u.id === me?.id;
                const isFollowing = followingIds?.has(u.id);
                return (
                  <div key={u.id} className="ti-follow-row">
                    <button className="ti-follow-row-main"
                            onClick={() => { if (!isMe && onOpenProfile) onOpenProfile(u.id); }}>
                      <div className={`ti-admin-user-avatar ti-role-ring-${u.role}`}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt={u.avatar} />
                          : u.avatar}
                      </div>
                      <div className="ti-admin-user-meta">
                        <div className="ti-admin-user-name">
                          {u.name}
                          {u.role === 'owner' && <span className="ti-role-badge ti-role-badge-owner ti-role-badge-sm">Owner</span>}
                          {u.role === 'admin' && <span className="ti-role-badge ti-role-badge-admin ti-role-badge-sm">Admin</span>}
                          {isMe && <span className="ti-admin-self">you</span>}
                        </div>
                        <div className="ti-admin-user-handle">@{u.username}</div>
                        {u.bio && <div className="ti-admin-user-bio">{u.bio}</div>}
                      </div>
                    </button>
                    {!isMe && onFollow && (
                      <button className={`ti-follow-btn${isFollowing ? ' is-following' : ''}`}
                              onClick={() => onFollow(u.id)}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.ExpandedTile = ExpandedTile;
window.CommentRail = CommentRail;
window.Composer = Composer;
window.NotificationsPanel = NotificationsPanel;
window.AdminPanel = AdminPanel;
// ─────────────────────────────────────────────────────────────────────────
// Messages — inbox panel + thread view. Inbox lists conversations sorted
// by most-recent activity; selecting one opens the thread with a sticky
// composer at the bottom. Realtime pushes new messages from the parent.
// ─────────────────────────────────────────────────────────────────────────

function MessagesPanel({ messages, conversations, me, activeThread, setActiveThread, onClose, onSend, onDeleteMessage, onMarkRead, onOpenProfile, onUploadMedia, onTyping, onCreateGroup, supabase }) {
  useEffect_o(() => {
    const onKey = (e) => { if (e.key === 'Escape') {
      if (activeThread) setActiveThread(null);
      else onClose();
    } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeThread, onClose, setActiveThread]);

  // Build per-conversation summary: messages, unread count, last activity.
  const threads = useMemo_o(() => {
    if (!me?.id) return [];
    const byConv = new Map();
    conversations.forEach(c => {
      byConv.set(c.id, { conv: c, messages: [], unread: 0, lastAt: c.last_message_at ? new Date(c.last_message_at).getTime() : 0 });
    });
    messages.forEach(m => {
      const entry = byConv.get(m.conversation_id);
      if (!entry) return;
      entry.messages.push(m);
      const t = new Date(m.created_at).getTime();
      if (t > entry.lastAt) entry.lastAt = t;
    });
    // Compute unread from my last_read_at on conversation_members
    byConv.forEach((entry) => {
      const myMembership = entry.conv.members.find(mm => mm.user_id === me.id);
      const myLastRead = myMembership?.last_read_at ? new Date(myMembership.last_read_at).getTime() : 0;
      entry.unread = entry.messages.filter(m => m.sender_id !== me.id && new Date(m.created_at).getTime() > myLastRead).length;
    });
    return Array.from(byConv.values()).sort((a, b) => b.lastAt - a.lastAt);
  }, [messages, conversations, me?.id]);

  const activeThreadData = useMemo_o(
    () => activeThread ? threads.find(t => t.conv.id === activeThread) : null,
    [threads, activeThread]);

  return (
    <div className="ti-overlay ti-msg-overlay" onClick={onClose}>
      <div className="ti-overlay-bg" />
      <div className="ti-msg-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ti-gloss" />
        <div className="ti-gloss-edge" />

        {!activeThread ? (
          <>
            <header className="ti-msg-hd">
              <div>
                <div className="ti-edit-eyebrow">Inbox</div>
                <h2 className="ti-edit-title">Direct messages</h2>
              </div>
              <div className="ti-msg-hd-actions">
                <button className="ti-msg-new-group" onClick={onCreateGroup}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  <span>Group</span>
                </button>
                <button className="ti-x ti-notif-x" onClick={onClose} aria-label="close">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="m6 6 12 12M6 18 18 6"/>
                  </svg>
                </button>
              </div>
            </header>
            <div className="ti-msg-list">
              {threads.length === 0 ? (
                <div className="ti-notif-empty">
                  <div className="ti-empty-mark"><span /><span /><span /><span /></div>
                  <div className="ti-notif-empty-msg">No messages yet.</div>
                  <div className="ti-notif-empty-sub">Open someone's profile and tap Message — or create a group.</div>
                </div>
              ) : threads.map(t => {
                const display = describeConversation(t.conv, me);
                const last = t.messages[t.messages.length - 1];
                return (
                  <button key={t.conv.id} className="ti-msg-row"
                          onPointerDown={(e) => { e.stopPropagation(); setActiveThread(t.conv.id); }}>
                    <ConvAvatar conv={t.conv} me={me} />
                    <div className="ti-msg-row-meta">
                      <div className="ti-msg-row-top">
                        <span className="ti-msg-row-name">{display.title}</span>
                        <span className="ti-msg-row-time">{relativeTime(new Date(t.lastAt).toISOString())}</span>
                      </div>
                      <div className="ti-msg-row-bot">
                        <span className="ti-msg-row-preview">
                          {last
                            ? (last.sender_id === me.id ? 'You: ' : (t.conv.type === 'group' ? (last.sender?.name || '') + ': ' : ''))
                              + previewMessage(last)
                            : <em>No messages yet</em>}
                        </span>
                        {t.unread > 0 && <span className="ti-msg-row-unread">{t.unread}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <MessageThread conv={activeThreadData?.conv} threadMessages={activeThreadData?.messages || []} me={me}
                         onBack={() => setActiveThread(null)}
                         onClose={onClose}
                         onSend={(payload) => onSend(activeThread, payload)}
                         onDeleteMessage={onDeleteMessage}
                         onMarkRead={() => onMarkRead && onMarkRead(activeThread)}
                         onOpenProfile={onOpenProfile}
                         onUploadMedia={onUploadMedia}
                         onTyping={() => onTyping && onTyping(activeThread)}
                         supabase={supabase} />
        )}
      </div>
    </div>
  );
}

function describeConversation(conv, me) {
  if (!conv) return { title: '' };
  if (conv.type === 'group' && conv.name) return { title: conv.name };
  const others = (conv.members || []).filter(m => m.user_id !== me?.id).map(m => m.profile).filter(Boolean);
  if (others.length === 0) return { title: 'Just you' };
  if (others.length === 1) return { title: others[0].name || '@' + others[0].username };
  if (others.length === 2) return { title: `${others[0].name || others[0].username} & ${others[1].name || others[1].username}` };
  return { title: `${others[0].name || others[0].username} + ${others.length - 1} others` };
}

function previewMessage(m) {
  if (!m) return '';
  if (m.link && m.link._share) {
    const handle = m.link._share.author?.handle || 'unknown';
    return `↗ Shared @${handle}'s tile`;
  }
  if (m.kind === 'text' || !m.kind) return m.body || '';
  if (m.kind === 'photo') return '📷 Photo' + (m.caption ? ' · ' + m.caption : '');
  if (m.kind === 'video') return '🎞️ Video' + (m.caption ? ' · ' + m.caption : '');
  if (m.kind === 'audio') return '🎙️ Audio' + (m.caption ? ' · ' + m.caption : '');
  if (m.kind === 'link')  return '🔗 ' + (m.link?.title || m.link?.url || 'Link');
  if (m.kind === 'poll')  return '📊 Poll · ' + (m.body || '');
  if (m.kind === 'chart') return '📈 Chart · ' + (m.chart?.label || '');
  if (m.kind === 'grid')  return '🗂️ Grid · ' + (m.caption || '');
  return m.body || '';
}

function ConvAvatar({ conv, me }) {
  if (!conv) {
    return <div className="ti-admin-user-avatar">··</div>;
  }
  const others = (conv.members || []).filter(m => m.user_id !== me?.id).map(m => m.profile).filter(Boolean);
  if (conv.type === 'group' && others.length >= 2) {
    const a = others[0], b = others[1];
    return (
      <div className="ti-conv-avatar ti-conv-avatar-group">
        <div className={`ti-admin-user-avatar ti-role-ring-${a.role}`}>
          {a.avatar_url ? <img src={a.avatar_url} alt={a.avatar} /> : a.avatar}
        </div>
        <div className={`ti-admin-user-avatar ti-role-ring-${b.role}`}>
          {b.avatar_url ? <img src={b.avatar_url} alt={b.avatar} /> : b.avatar}
        </div>
      </div>
    );
  }
  const partner = others[0] || { avatar: '??', role: 'user' };
  return (
    <div className={`ti-admin-user-avatar ti-role-ring-${partner.role}`}>
      {partner.avatar_url ? <img src={partner.avatar_url} alt={partner.avatar} /> : partner.avatar}
    </div>
  );
}

function MessageThread({ conv, threadMessages, me, onBack, onClose, onSend, onDeleteMessage, onMarkRead, onOpenProfile, onUploadMedia, onTyping, supabase }) {
  const [draft, setDraft] = useState_o('');
  const [busy, setBusy] = useState_o(false);
  const [uploadingMedia, setUploadingMedia] = useState_o(false);
  const [pendingMedia, setPendingMedia] = useState_o(null); // { url, kind, mime }
  const [error, setError] = useState_o(null);
  const [typingPeers, setTypingPeers] = useState_o([]); // [{ user_id, name, avatar, until }]
  const scrollRef = useRef_o(null);
  const fileRef = useRef_o(null);
  const lastTypingSent = useRef_o(0);

  const display = describeConversation(conv, me);
  const others = useMemo_o(
    () => (conv?.members || []).filter(m => m.user_id !== me?.id).map(m => m.profile).filter(Boolean),
    [conv?.members, me?.id]);

  // Auto-scroll to bottom on new messages
  useEffect_o(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [threadMessages.length, typingPeers.length]);

  // Mark read on open + when new messages arrive while open
  useEffect_o(() => { onMarkRead && onMarkRead(); }, [conv?.id, threadMessages.length]);

  // Subscribe to typing broadcast for this conversation
  useEffect_o(() => {
    if (!supabase || !conv?.id) return;
    const ch = supabase.channel('typing:' + conv.id, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!payload || payload.user_id === me?.id) return;
      const until = Date.now() + 4000;
      setTypingPeers(prev => {
        const without = prev.filter(p => p.user_id !== payload.user_id);
        return [...without, { ...payload, until }];
      });
    });
    ch.subscribe();
    // GC stale typers every second
    const gc = setInterval(() => {
      setTypingPeers(prev => {
        const fresh = prev.filter(p => p.until > Date.now());
        return fresh.length === prev.length ? prev : fresh;
      });
    }, 1000);
    return () => { clearInterval(gc); supabase.removeChannel(ch); };
  }, [supabase, conv?.id, me?.id]);

  const handleDraftChange = (v) => {
    setDraft(v);
    // throttle typing pings to once per 1.5s
    const now = Date.now();
    if (onTyping && now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      onTyping();
    }
  };

  const onPickFile = () => fileRef.current?.click();
  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUploadMedia) return;
    setError(null);
    setUploadingMedia(true);
    const r = await onUploadMedia(file);
    setUploadingMedia(false);
    if (!r.ok) { setError(r.error); return; }
    setPendingMedia(r);
  };

  const submit = async (e) => {
    e?.preventDefault();
    setError(null);
    const body = draft.trim();
    if (!body && !pendingMedia) return;
    setBusy(true);
    const payload = pendingMedia
      ? {
          kind: pendingMedia.kind === 'image' ? 'photo'
              : pendingMedia.kind === 'video' ? 'video'
              : 'audio',
          caption: body || null,
          media: { url: pendingMedia.url, mime: pendingMedia.mime },
        }
      : { kind: 'text', body };
    const localDraft = draft;
    const localMedia = pendingMedia;
    setDraft('');
    setPendingMedia(null);
    const r = await onSend(payload);
    setBusy(false);
    if (!r?.ok) {
      setDraft(localDraft);
      setPendingMedia(localMedia);
      setError(r?.error || 'Send failed.');
    }
  };

  // Compute the latest read-by-others timestamp for read receipts
  const lastSeenAt = useMemo_o(() => {
    if (!conv) return 0;
    const otherReads = (conv.members || [])
      .filter(m => m.user_id !== me?.id && m.last_read_at)
      .map(m => new Date(m.last_read_at).getTime());
    return otherReads.length ? Math.max(...otherReads) : 0;
  }, [conv?.members, me?.id]);

  // Group consecutive messages from same sender
  const groups = [];
  threadMessages.forEach(m => {
    const last = groups[groups.length - 1];
    if (last && last[0].sender_id === m.sender_id) last.push(m);
    else groups.push([m]);
  });

  const lastMineIdx = (() => {
    for (let i = threadMessages.length - 1; i >= 0; i--) {
      if (threadMessages[i].sender_id === me?.id) return i;
    }
    return -1;
  })();
  const lastMineSeen = lastMineIdx >= 0 && lastSeenAt >= new Date(threadMessages[lastMineIdx].created_at).getTime();

  // Guard against the brief moment between creating a new conversation
  // and the row landing in local state — without this, downstream calls
  // (e.g. ConvAvatar) would dereference null and crash the whole panel.
  if (!conv) {
    return (
      <div className="ti-msg-thread">
        <header className="ti-msg-thread-hd">
          <button className="ti-mc-back" onPointerDown={(e) => { e.stopPropagation(); onBack && onBack(); }} aria-label="back">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="m15 6-6 6 6 6"/>
            </svg>
          </button>
          <div className="ti-msg-thread-info"><div className="ti-msg-thread-name">Loading…</div></div>
          <button className="ti-x ti-notif-x" onClick={onClose} aria-label="close">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="m6 6 12 12M6 18 18 6"/>
            </svg>
          </button>
        </header>
      </div>
    );
  }

  return (
    <div className="ti-msg-thread">
      <header className="ti-msg-thread-hd">
        <button className="ti-mc-back" onPointerDown={(e) => { e.stopPropagation(); onBack(); }} aria-label="back">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="m15 6-6 6 6 6"/>
          </svg>
        </button>
        <div className="ti-msg-thread-partner"
             onPointerDown={(e) => {
               e.stopPropagation();
               if (conv?.type === 'dm' && others[0] && onOpenProfile) {
                 onClose && onClose();
                 onOpenProfile(others[0].id);
               }
             }}>
          <ConvAvatar conv={conv} me={me} />
          <div className="ti-msg-thread-info">
            <div className="ti-msg-thread-name">{display.title}</div>
            <div className="ti-msg-thread-handle">
              {conv?.type === 'group'
                ? `${conv.members?.length || 0} member${conv.members?.length === 1 ? '' : 's'}`
                : (others[0] ? '@' + others[0].username : '')}
            </div>
          </div>
        </div>
        <button className="ti-x ti-notif-x" onClick={onClose} aria-label="close">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="m6 6 12 12M6 18 18 6"/>
          </svg>
        </button>
      </header>

      <div className="ti-msg-thread-scroll" ref={scrollRef}>
        {groups.length === 0 && (
          <div className="ti-msg-thread-empty">
            {conv?.type === 'group'
              ? <>Say hi to the group.</>
              : <>Send the first message to <b>{others[0] ? '@' + others[0].username : 'this user'}</b>.</>}
          </div>
        )}
        {groups.map((group, gi) => {
          const fromMe = group[0].sender_id === me.id;
          const senderProfile = group[0].sender;
          return (
            <div key={gi} className={`ti-msg-group${fromMe ? ' is-mine' : ''}`}>
              {!fromMe && (
                <div className={`ti-admin-user-avatar ti-role-ring-${senderProfile?.role}`}>
                  {senderProfile?.avatar_url
                    ? <img src={senderProfile.avatar_url} alt={senderProfile.avatar} />
                    : (senderProfile?.avatar || '··')}
                </div>
              )}
              <div className="ti-msg-group-bubbles">
                {!fromMe && conv?.type === 'group' && senderProfile && (
                  <div className="ti-msg-group-name">{senderProfile.name || '@' + senderProfile.username}</div>
                )}
                {group.map(m => <MessageBubble key={m.id} m={m} fromMe={fromMe} onDelete={fromMe ? onDeleteMessage : null} />)}
                <div className="ti-msg-group-time">{relativeTime(group[group.length - 1].created_at)}</div>
              </div>
            </div>
          );
        })}
        {typingPeers.length > 0 && (
          <div className="ti-msg-typing">
            <span className="ti-msg-typing-dots"><span /><span /><span /></span>
            <span>{typingPeers.map(p => p.name || 'Someone').join(', ')} {typingPeers.length === 1 ? 'is' : 'are'} typing…</span>
          </div>
        )}
        {lastMineSeen && lastMineIdx === threadMessages.length - 1 && (
          <div className="ti-msg-seen">Seen</div>
        )}
      </div>

      {pendingMedia && (
        <div className="ti-msg-pending">
          <div className="ti-msg-pending-preview">
            {pendingMedia.kind === 'image'
              ? <img src={pendingMedia.url} alt="" />
              : pendingMedia.kind === 'video'
              ? <video src={pendingMedia.url} muted />
              : <span>🎙️ Audio attached</span>}
          </div>
          <button type="button" className="ti-msg-pending-x" onClick={() => setPendingMedia(null)} aria-label="remove attachment">×</button>
        </div>
      )}
      {error && <div className="ti-auth-err ti-msg-err">{error}</div>}

      <form className="ti-msg-input" onSubmit={submit}>
        <input ref={fileRef} type="file"
               accept="image/*,video/*,audio/*"
               className="ti-file-hidden"
               onChange={onFileChosen} />
        <button type="button" className="ti-msg-attach" onClick={onPickFile}
                disabled={uploadingMedia} aria-label="Attach media">
          {uploadingMedia ? '…' : (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M16 8 8.5 15.5a2.5 2.5 0 0 0 3.5 3.5L20 11a4.5 4.5 0 0 0-6.4-6.3L5 13a6.5 6.5 0 0 0 9.2 9.2L21 15"/>
            </svg>
          )}
        </button>
        <input value={draft}
               onChange={(e) => handleDraftChange(e.target.value)}
               placeholder={pendingMedia ? 'Add a caption (optional)…' : `Message ${display.title}…`}
               maxLength={1000}
               autoFocus />
        <button type="submit" disabled={busy || (!draft.trim() && !pendingMedia)} aria-label="Send message">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ m, fromMe, onDelete }) {
  const kind = m.kind || 'text';
  const shareMeta = m.link && m.link._share ? m.link._share : null;
  const isShared = !!shareMeta;
  let inner;

  if (kind === 'photo' && m.media?.url) {
    inner = (
      <>
        <div className="ti-msg-tile-media">
          <img src={m.media.url} alt={m.caption || ''} />
        </div>
        {m.caption && <div className="ti-msg-tile-text">{m.caption}</div>}
      </>
    );
  } else if (kind === 'video' && m.media?.url) {
    inner = (
      <>
        <div className="ti-msg-tile-media">
          <video src={m.media.url} controls playsInline preload="metadata" />
        </div>
        {m.caption && <div className="ti-msg-tile-text">{m.caption}</div>}
      </>
    );
  } else if (kind === 'audio' && m.media?.url) {
    inner = (
      <>
        <audio className="ti-msg-tile-audio" src={m.media.url} controls preload="metadata" />
        {m.caption && <div className="ti-msg-tile-text">{m.caption}</div>}
      </>
    );
  } else if (kind === 'link' && m.link) {
    inner = (
      <a className="ti-msg-tile-link" href={m.link.url} target="_blank" rel="noopener noreferrer">
        <div className="ti-linkcard-domain">{m.link.domain || m.link.url}</div>
        <div className="ti-linkcard-title">{m.link.title || m.link.url}</div>
        {m.link.excerpt && <div className="ti-linkcard-excerpt">{m.link.excerpt}</div>}
      </a>
    );
  } else if (kind === 'poll' && m.poll) {
    const options = m.poll.options || [];
    inner = (
      <>
        {m.body && <div className="ti-msg-tile-text">{m.body}</div>}
        <div className="ti-msg-tile-poll">
          {options.map((o, i) => (
            <div key={i} className="ti-msg-tile-poll-opt">{o.label || o.text || o}</div>
          ))}
        </div>
      </>
    );
  } else {
    inner = (
      <div className="ti-msg-tile-text">{m.body || m.caption || ''}</div>
    );
  }

  let bubble;
  if (isShared) {
    const a = m.shared.author || {};
    bubble = (
      <div className="ti-msg-bubble ti-msg-bubble-tile" title={new Date(m.created_at).toLocaleString()}>
        <div className="ti-msg-tile-hd">
          <div className={`ti-msg-tile-avatar ti-role-ring-${a.role || ''}`}>
            {a.avatar_url
              ? <img src={a.avatar_url} alt={a.avatar || ''} />
              : (a.avatar || (a.handle ? a.handle.slice(0, 2).toUpperCase() : '··'))}
          </div>
          <div className="ti-msg-tile-meta">
            <div className="ti-msg-tile-author">{a.name || a.handle || 'unknown'}</div>
            <div className="ti-msg-tile-handle">@{a.handle || 'unknown'} · shared tile</div>
          </div>
        </div>
        <div className="ti-msg-tile-body">{inner}</div>
      </div>
    );
  } else if (kind === 'photo' && m.media?.url) {
    bubble = (
      <div className="ti-msg-bubble ti-msg-bubble-media">
        <img src={m.media.url} alt={m.caption || ''} />
        {m.caption && <div className="ti-msg-bubble-caption">{m.caption}</div>}
      </div>
    );
  } else if (kind === 'video' && m.media?.url) {
    bubble = (
      <div className="ti-msg-bubble ti-msg-bubble-media">
        <video src={m.media.url} controls playsInline preload="metadata" />
        {m.caption && <div className="ti-msg-bubble-caption">{m.caption}</div>}
      </div>
    );
  } else if (kind === 'audio' && m.media?.url) {
    bubble = (
      <div className="ti-msg-bubble ti-msg-bubble-audio">
        <audio src={m.media.url} controls preload="metadata" />
        {m.caption && <div className="ti-msg-bubble-caption">{m.caption}</div>}
      </div>
    );
  } else if (kind === 'link' && m.link) {
    bubble = (
      <a className="ti-msg-bubble ti-msg-bubble-link" href={m.link.url} target="_blank" rel="noopener noreferrer">
        <div className="ti-linkcard-domain">{m.link.domain || m.link.url}</div>
        <div className="ti-linkcard-title">{m.link.title || m.link.url}</div>
        {m.link.excerpt && <div className="ti-linkcard-excerpt">{m.link.excerpt}</div>}
      </a>
    );
  } else {
    bubble = (
      <div className="ti-msg-bubble" title={new Date(m.created_at).toLocaleString()}>
        {m.body || ''}
      </div>
    );
  }

  if (!fromMe || !onDelete) return bubble;

  return <DeletableBubble onDelete={() => onDelete(m.id)}>{bubble}</DeletableBubble>;
}

// Wraps an own-message bubble with a two-step inline delete control.
// First tap arms the confirm (button label flips to "Confirm"); second tap
// within 3s commits the delete. The first tap is the "soft" state — the
// bubble itself is non-interactive so a stray tap can't accidentally delete.
function DeletableBubble({ children, onDelete }) {
  const [armed, setArmed] = useState_o(false);
  const timerRef = useRef_o(null);

  useEffect_o(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const arm = (e) => {
    e.stopPropagation();
    if (armed) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      setArmed(false);
      onDelete();
      return;
    }
    setArmed(true);
    timerRef.current = setTimeout(() => {
      setArmed(false);
      timerRef.current = null;
    }, 3000);
  };

  return (
    <div className="ti-msg-bubble-row">
      <button type="button"
              className={`ti-msg-bubble-del${armed ? ' is-armed' : ''}`}
              onClick={arm}
              aria-label={armed ? 'Confirm delete' : 'Delete message'}>
        {armed ? 'Confirm' : (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/>
          </svg>
        )}
      </button>
      {children}
    </div>
  );
}

function CreateConversationModal({ me, followingIds, onCreate, onClose }) {
  const supabase = window.supabaseClient;
  const [name, setName] = useState_o('');
  const [q, setQ] = useState_o('');
  const [users, setUsers] = useState_o([]);
  const [picked, setPicked] = useState_o(new Set());
  const [busy, setBusy] = useState_o(false);
  const [error, setError] = useState_o(null);

  useEffect_o(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // initial: load people I follow as default suggestions
  useEffect_o(() => {
    if (!supabase || !me?.id) return;
    let mounted = true;
    const load = async () => {
      const ids = Array.from(followingIds || []);
      if (ids.length === 0) { setUsers([]); return; }
      const { data } = await supabase.from('profiles')
        .select('id, username, name, avatar, avatar_url, role')
        .in('id', ids).limit(30);
      if (mounted) setUsers(data || []);
    };
    load();
    return () => { mounted = false; };
  }, [supabase, me?.id]);

  // search profiles when query is non-empty
  useEffect_o(() => {
    if (!supabase) return;
    const cleaned = q.trim().toLowerCase();
    if (!cleaned) return; // keep follower list when empty
    let mounted = true;
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles')
        .select('id, username, name, avatar, avatar_url, role')
        .or(`username.ilike.%${cleaned}%,name.ilike.%${cleaned}%`)
        .neq('id', me?.id || '')
        .limit(20);
      if (mounted) setUsers(data || []);
    }, 180);
    return () => { mounted = false; clearTimeout(t); };
  }, [q, supabase, me?.id]);

  const togglePicked = (id) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submit = async (e) => {
    e?.preventDefault();
    setError(null);
    if (picked.size < 1) { setError('Pick at least one person.'); return; }
    setBusy(true);
    const r = await onCreate({ name: picked.size > 1 ? name : '', memberIds: Array.from(picked) });
    setBusy(false);
    if (!r?.ok) setError(r?.error || 'Could not create.');
  };

  return (
    <div className="ti-overlay ti-edit-overlay" onClick={onClose}>
      <div className="ti-overlay-bg" />
      <form className="ti-edit-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="ti-gloss" /><div className="ti-gloss-edge" />
        <header className="ti-edit-hd">
          <div>
            <div className="ti-edit-eyebrow">{picked.size > 1 ? 'New group' : 'New conversation'}</div>
            <h2 className="ti-edit-title">Pick {picked.size > 1 ? 'members' : 'someone to message'}</h2>
          </div>
          <button type="button" className="ti-x" onClick={onClose} aria-label="close">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="m6 6 12 12M6 18 18 6"/>
            </svg>
          </button>
        </header>

        {picked.size > 1 && (
          <label className="ti-edit-field">
            <span className="ti-edit-lbl">Group name (optional)</span>
            <input className="ti-auth-input" maxLength={60}
                   value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="e.g. Design crew" />
          </label>
        )}

        <label className="ti-edit-field">
          <span className="ti-edit-lbl">Search people</span>
          <input className="ti-auth-input"
                 value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="@username or name" />
        </label>

        <div className="ti-msg-picker-list">
          {users.length === 0 && <div className="ti-search-empty">No matches.</div>}
          {users.map(u => {
            const isPicked = picked.has(u.id);
            return (
              <button type="button" key={u.id}
                      className={`ti-msg-picker-row${isPicked ? ' is-picked' : ''}`}
                      onClick={() => togglePicked(u.id)}>
                <div className={`ti-admin-user-avatar ti-role-ring-${u.role}`}>
                  {u.avatar_url ? <img src={u.avatar_url} alt={u.avatar} /> : u.avatar}
                </div>
                <div className="ti-admin-user-meta">
                  <div className="ti-admin-user-name">{u.name}</div>
                  <div className="ti-admin-user-handle">@{u.username}</div>
                </div>
                <span className={`ti-msg-picker-check${isPicked ? ' is-on' : ''}`}>
                  {isPicked && (
                    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m2 6 3 3 5-6"/>
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {error && <div className="ti-auth-err">{error}</div>}

        <footer className="ti-edit-ft">
          <button type="button" className="ti-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="ti-auth-submit ti-edit-save" disabled={busy || picked.size < 1}>
            {busy ? 'Creating…' : picked.size > 1 ? 'Create group' : 'Start chat'}
          </button>
        </footer>
      </form>
    </div>
  );
}

// Share-tile-as-DM sheet. Lists existing conversations + people I follow as
// targets; tap one to send the tile through as a tile-format DM message.
function ShareTileSheet({ me, tile, conversations, followingIds, onShare, onClose }) {
  const supabase = window.supabaseClient;
  const [busy, setBusy] = useState_o(false);
  const [error, setError] = useState_o(null);
  const [q, setQ] = useState_o('');
  const [searchUsers, setSearchUsers] = useState_o([]);
  const [followers, setFollowers] = useState_o([]);

  useEffect_o(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect_o(() => {
    if (!supabase || !me?.id) return;
    let mounted = true;
    (async () => {
      const ids = Array.from(followingIds || []);
      if (ids.length === 0) { setFollowers([]); return; }
      const { data } = await supabase.from('profiles')
        .select('id, username, name, avatar, avatar_url, role')
        .in('id', ids).limit(40);
      if (mounted) setFollowers(data || []);
    })();
    return () => { mounted = false; };
  }, [supabase, me?.id]);

  useEffect_o(() => {
    if (!supabase) return;
    const cleaned = q.trim().toLowerCase();
    if (!cleaned) { setSearchUsers([]); return; }
    let mounted = true;
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles')
        .select('id, username, name, avatar, avatar_url, role')
        .or(`username.ilike.%${cleaned}%,name.ilike.%${cleaned}%`)
        .neq('id', me?.id || '')
        .limit(20);
      if (mounted) setSearchUsers(data || []);
    }, 180);
    return () => { mounted = false; clearTimeout(t); };
  }, [q, supabase, me?.id]);

  const convTargets = useMemo_o(() => {
    if (!me?.id || q.trim()) return [];
    return (conversations || []).map(c => {
      const display = describeConversation(c, me);
      return { kind: 'conv', id: c.id, conv: c, title: display.title, sub: display.sub };
    });
  }, [conversations, me, q]);

  const userTargets = useMemo_o(() => {
    if (q.trim()) {
      return (searchUsers || []).map(u => ({ kind: 'user', id: u.id, profile: u }));
    }
    const dmPartnerIds = new Set();
    (conversations || []).forEach(c => {
      if (c.type !== 'dm') return;
      c.members?.forEach(m => { if (m.user_id !== me?.id) dmPartnerIds.add(m.user_id); });
    });
    return (followers || [])
      .filter(u => !dmPartnerIds.has(u.id))
      .map(u => ({ kind: 'user', id: u.id, profile: u }));
  }, [followers, searchUsers, conversations, me, q]);

  const submit = async (target) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const args = target.kind === 'conv'
      ? { conversationId: target.id }
      : { userId: target.id };
    const r = await onShare(args);
    // On success the parent unmounts this sheet, so we only touch state on
    // failure to avoid a "set state on unmounted component" warning.
    if (!r?.ok) {
      setBusy(false);
      setError(r?.error || 'Could not share.');
    }
  };

  const previewLine = (tile.kind === 'photo' || tile.kind === 'video' || tile.kind === 'audio')
    ? (tile.caption || `[${tile.kind}]`)
    : (tile.body || tile.caption || `[${tile.kind}]`);

  return (
    <div className="ti-overlay ti-edit-overlay" onClick={onClose}>
      <div className="ti-overlay-bg" />
      <div className="ti-edit-modal ti-share-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ti-gloss" /><div className="ti-gloss-edge" />
        <header className="ti-edit-hd">
          <div>
            <div className="ti-edit-eyebrow">Share tile</div>
            <h2 className="ti-edit-title">Send as a direct message</h2>
          </div>
          <button type="button" className="ti-x" onClick={onClose} aria-label="close">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="m6 6 12 12M6 18 18 6"/>
            </svg>
          </button>
        </header>

        <div className="ti-share-preview">
          <div className="ti-share-preview-author">@{tile.author?.handle || 'unknown'}</div>
          <div className="ti-share-preview-body">{previewLine}</div>
        </div>

        <label className="ti-edit-field">
          <span className="ti-edit-lbl">Search people</span>
          <input className="ti-auth-input"
                 value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="@username or name" />
        </label>

        {error && <div className="ti-auth-err">{error}</div>}

        <div className="ti-msg-picker-list">
          {!q.trim() && convTargets.length === 0 && userTargets.length === 0 && (
            <div className="ti-search-empty">No conversations yet — search for someone to start one.</div>
          )}
          {convTargets.map(t => (
            <button type="button" key={'c-' + t.id}
                    className="ti-msg-picker-row"
                    onClick={() => submit(t)} disabled={busy}>
              <ConvAvatar conv={t.conv} me={me} />
              <div className="ti-admin-user-meta">
                <div className="ti-admin-user-name">{t.title}</div>
                <div className="ti-admin-user-handle">
                  {t.conv.type === 'group' ? `${t.conv.members?.length || 0} members` : (t.sub || '')}
                </div>
              </div>
              <span className="ti-share-send">Send</span>
            </button>
          ))}
          {userTargets.map(t => (
            <button type="button" key={'u-' + t.id}
                    className="ti-msg-picker-row"
                    onClick={() => submit(t)} disabled={busy}>
              <div className={`ti-admin-user-avatar ti-role-ring-${t.profile.role}`}>
                {t.profile.avatar_url ? <img src={t.profile.avatar_url} alt={t.profile.avatar} /> : t.profile.avatar}
              </div>
              <div className="ti-admin-user-meta">
                <div className="ti-admin-user-name">{t.profile.name}</div>
                <div className="ti-admin-user-handle">@{t.profile.username}</div>
              </div>
              <span className="ti-share-send">Send</span>
            </button>
          ))}
          {q.trim() && userTargets.length === 0 && (
            <div className="ti-search-empty">No matches.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Tiny relativeTime helper duplicated here so overlays.jsx doesn't depend on app.jsx
function relativeTime(iso) {
  if (!iso) return 'now';
  const d = new Date(iso);
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h';
  const day = Math.floor(hr / 24);
  if (day < 7) return day + 'd';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

window.EditProfileModal = EditProfileModal;
window.FollowListModal = FollowListModal;
window.MobileCommentSheet = MobileCommentSheet;
window.MessagesPanel = MessagesPanel;
window.CreateConversationModal = CreateConversationModal;
window.ShareTileSheet = ShareTileSheet;
