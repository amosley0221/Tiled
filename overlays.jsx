// overlays.jsx — expanded tile, comment rail, composer (with tags)

const { useState: useState_o, useRef: useRef_o, useEffect: useEffect_o } = React;

function ExpandedTile({ tile, comments, onClose, onLike, onSave, onComment, onVote, onTag, originRect, t }) {
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
              <div className="ti-avatar ti-avatar-lg">{tile.author.avatar}</div>
              <div className="ti-author-meta">
                <div className="ti-author-name">{tile.author.name}</div>
                <div className="ti-author-handle">@{tile.author.handle} · {tile.time}</div>
              </div>
            </div>
            <button className="ti-follow">Follow</button>
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
            <div className="ti-avatar ti-avatar-sm">YO</div>
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
      const grad = `radial-gradient(120% 80% at 30% 20%, oklch(0.32 0.04 ${tile.media.tone}) 0%, oklch(0.14 0.02 ${tile.media.tone}) 50%, oklch(0.06 0.01 ${tile.media.tone}) 100%)`;
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
                <span className="ti-live-viewers">{fmt(tile.media.viewers)} watching</span>
              </div>
            )}
            {tile.media.duration && <div className="ti-media-duration">{tile.media.duration}</div>}
            {tile.media.label && <div className="ti-media-label">{tile.media.label}</div>}
          </div>
          {tile.caption && <p className="ti-exp-caption">{tile.caption}</p>}
        </>
      );
    }
    case 'text': return <p className="ti-exp-text">{tile.body}</p>;
    case 'audio': return (
      <div className="ti-exp-audio">
        <Waveform bars={tile.media.waveform} duration={tile.media.duration} />
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
      <div className="ti-avatar ti-avatar-sm">{c.author.avatar}</div>
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

function CommentRail({ tile, comments, onClose, onComment }) {
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
          <div className="ti-avatar ti-avatar-sm">YO</div>
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

function Composer({ onClose, onPost, mode, existingTags = [] }) {
  const [kind, setKind] = useState_o('text');
  const [body, setBody] = useState_o('');
  const [tags, setTags] = useState_o([]);
  const [tagDraft, setTagDraft] = useState_o('');
  const inputRef = useRef_o(null);

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

  const submit = (e) => {
    e?.preventDefault();
    if (!body.trim()) return;
    onPost(kind, body, tags);
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

        {kind !== 'text' && kind !== 'chart' && kind !== 'grid' && (
          <div className="ti-composer-dropzone">
            <span>{kind === 'photo' ? 'Drop or click to upload photo' : kind === 'video' ? 'Drop or click to upload video' : kind === 'audio' ? 'Tap to record audio' : kind === 'link' ? 'Paste URL above' : 'Add poll options below'}</span>
          </div>
        )}

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
        <div className="ti-avatar ti-notif-avatar">{n.actor.avatar}</div>
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
      .select('id, username, name, avatar, role, bio, created_at')
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
            <div className={`ti-admin-user-avatar ti-role-ring-${u.role}`}>{u.avatar}</div>
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

window.ExpandedTile = ExpandedTile;
window.CommentRail = CommentRail;
window.Composer = Composer;
window.NotificationsPanel = NotificationsPanel;
window.AdminPanel = AdminPanel;
