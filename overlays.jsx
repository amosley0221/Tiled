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
  ];

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
                    className={`ti-comp-kind${kind === k.id ? ' is-active' : ''}`}
                    onClick={() => setKind(k.id)}>{k.label}</button>
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
            : 'Write your poll question…'
          }
        />

        {kind !== 'text' && (
          <div className="ti-composer-dropzone">
            <span>{kind === 'photo' ? 'Drop or click to upload photo' : kind === 'video' ? 'Drop or click to upload video' : kind === 'audio' ? 'Tap to record audio' : kind === 'link' ? 'Paste URL above' : 'Add poll options below'}</span>
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

window.ExpandedTile = ExpandedTile;
window.CommentRail = CommentRail;
window.Composer = Composer;
