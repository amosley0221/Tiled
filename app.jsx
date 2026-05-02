// Tiled — premium glossy black social dashboard

const { useState, useEffect, useRef, useMemo } = React;

// stable fallback used only on the very first render before AuthGate mounts
const ME_FALLBACK = { handle: 'you', name: 'You', avatar: 'YO' };


// Tile/comment/notification data lives in Supabase. Helpers below shape
// rows from the tile_feed view, comments, and notifications tables back
// into the structure the rest of the components expect.

const fmt = (n) => n >= 1000 ? (n/1000).toFixed(1).replace(/\.0$/,'') + 'k' : String(n);

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
  const wk = Math.floor(day / 7);
  if (wk < 5) return wk + 'w';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function shapeTile(row, likedSet, savedSet, voteMap) {
  return {
    id: row.id,
    kind: row.kind,
    mode: row.mode,
    author: {
      id: row.author_id,
      handle: row.author_username,
      name: row.author_name,
      avatar: row.author_avatar,
      avatar_url: row.author_avatar_url,
      role: row.author_role,
    },
    time: relativeTime(row.created_at),
    body: row.body || undefined,
    caption: row.caption || undefined,
    media: row.media || undefined,
    link: row.link || undefined,
    poll: row.poll
      ? { ...row.poll, voted: (voteMap && voteMap[row.id]) || row.poll.voted || null }
      : undefined,
    chart: row.chart || undefined,
    grid: row.grid || undefined,
    tags: row.tags || [],
    likes: row.like_count || 0,
    comments: row.comment_count || 0,
    liked: likedSet ? likedSet.has(row.id) : false,
    saved: savedSet ? savedSet.has(row.id) : false,
    private: row.is_private,
    createdAt: row.created_at,
  };
}

function shapeComment(row) {
  return {
    id: row.id,
    tile_id: row.tile_id,
    body: row.body,
    time: relativeTime(row.created_at),
    author: row.author
      ? { handle: row.author.username, avatar: row.author.avatar, avatar_url: row.author.avatar_url }
      : { handle: 'unknown', avatar: '??' },
    createdAt: row.created_at,
  };
}

function shapeNotification(row) {
  return {
    id: row.id,
    kind: row.kind,
    unread: !row.read_at,
    time: relativeTime(row.created_at),
    actor: row.actor
      ? { handle: row.actor.username, name: row.actor.name, avatar: row.actor.avatar, avatar_url: row.actor.avatar_url }
      : { handle: 'system', name: 'Tiled', avatar: 'TI' },
    body: row.body,
    preview: row.preview,
    tile_id: row.tile_id,
  };
}

function TiledApp({ tweaks }) {
  const t = tweaks;
  const auth = useAuth();
  const ME = useMemo(() => auth?.currentUser
    ? { id: auth.currentUser.id, handle: auth.currentUser.username, name: auth.currentUser.name, avatar: auth.currentUser.avatar, avatar_url: auth.currentUser.avatar_url, role: auth.currentUser.role, email: auth.currentUser.email, bio: auth.currentUser.bio, createdAt: auth.currentUser.createdAt }
    : ME_FALLBACK,
  [auth?.currentUser]);
  const supabase = window.supabaseClient;
  const cacheKey = ME?.id ? 'tiled.feed.cache.v2.' + ME.id : null;
  const [mode, setMode] = useState('social');
  const [view, setView] = useState('feed');             // feed | liked | saved (only used in profile)
  const [onProfile, setOnProfile] = useState(false);    // is profile page active?
  const [tiles, setTiles] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [pendingDismiss, setPendingDismiss] = useState({}); // { [tileId]: expiresAt }
  const dismissTimers = useRef({});
  const [pendingNew, setPendingNew] = useState([]);     // tiles waiting to be revealed
  const [pullProgress, setPullProgress] = useState(0);  // 0..1 — pull-to-refresh visual
  const [refreshing, setRefreshing] = useState(false);
  const mainRef = useRef(null);
  const [comments, setComments] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [expandOrigin, setExpandOrigin] = useState(null);
  const [commentRail, setCommentRail] = useState(null);
  const [composing, setComposing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState(null);     // string | null
  const [userFilter, setUserFilter] = useState(null);   // { handle, name, avatar } | null
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifOrigin, setNotifOrigin] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [myStats, setMyStats] = useState({ follower_count: 0, following_count: 0 });
  const [followingIds, setFollowingIds] = useState(new Set());  // who I follow
  const [followerIds, setFollowerIds] = useState(new Set());    // who follows me
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [followListOpen, setFollowListOpen] = useState(null);   // 'followers' | 'following' | null
  const [pendingDelete, setPendingDelete] = useState({});       // { [tileId]: expiresAt }
  const deleteTimers = useRef({});
  const [messages, setMessages] = useState([]);                 // all messages I'm party to (joined w/ sender profile)
  const [conversations, setConversations] = useState([]);       // [{id, type, name, last_message_at, members: [{user_id, last_read_at, profile:{...}}]}]
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeThread, setActiveThread] = useState(null);       // conversation id (string) | null
  const [createConvOpen, setCreateConvOpen] = useState(false);
  const [shareTileTarget, setShareTileTarget] = useState(null); // tile object being shared, or null
  const [typingByConv, setTypingByConv] = useState({});         // { [conversationId]: { [userId]: { name, avatar, until } } }
  const [viewingProfileId, setViewingProfileId] = useState(null); // null = my profile (or off-profile)
  const [viewedProfile, setViewedProfile] = useState(null);       // profile_stats row when viewing another user
  const [viewedProfileLoading, setViewedProfileLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 600px)').matches
      : false);

  // Track mobile viewport so we can swap CommentRail for MobileCommentSheet
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 600px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange);
    };
  }, []);

  // Toggle a class on <html> so the mobile scroll-snap-mandatory rule
  // can be turned off in profile view. Without this, scrolling to top
  // immediately snaps past the bio onto the first tile, causing the
  // "bio flashes for a moment then shows the last tile" effect.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const cls = 'ti-on-profile';
    document.documentElement.classList.toggle(cls, !!onProfile || !!viewingProfileId);
    return () => document.documentElement.classList.remove(cls);
  }, [onProfile, viewingProfileId]);

  const accentCSS = useMemo(() => ({
    gold: 'oklch(0.82 0.13 78)',
    platinum: 'oklch(0.94 0 0)',
    ice: 'oklch(0.85 0.08 220)',
    ember: 'oklch(0.72 0.16 32)',
  }[t.accent] || 'oklch(0.82 0.13 78)'), [t.accent]);

  // ────────────────────────────────────────────────────────────────────
  // Initial data load. Fetches everything the feed needs in parallel,
  // then maps rows into the shape the rest of the components expect.
  // ────────────────────────────────────────────────────────────────────
  const loadFeed = async ({ silent = false } = {}) => {
    if (!supabase || !ME?.id) return;
    if (!silent) setFeedLoading(true);
    const [feedRes, commentsRes, likesRes, savesRes, dismRes, votesRes, notifRes, statsRes, followingRes, followersRes, messagesRes, convsRes, membersRes] = await Promise.all([
      supabase.from('tile_feed').select('*').order('created_at', { ascending: false }),
      supabase.from('comments').select('*, author:profiles!comments_author_id_fkey(username,avatar,avatar_url)').order('created_at', { ascending: true }),
      supabase.from('likes').select('tile_id').eq('user_id', ME.id),
      supabase.from('saves').select('tile_id').eq('user_id', ME.id),
      supabase.from('dismissals').select('tile_id').eq('user_id', ME.id),
      supabase.from('poll_votes').select('tile_id, option_id').eq('user_id', ME.id),
      supabase.from('notifications')
        .select('*, actor:profiles!notifications_actor_id_fkey(username,name,avatar,avatar_url)')
        .eq('recipient_id', ME.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('profile_stats').select('follower_count, following_count').eq('id', ME.id).maybeSingle(),
      supabase.from('follows').select('followee_id').eq('follower_id', ME.id),
      supabase.from('follows').select('follower_id').eq('followee_id', ME.id),
      // RLS scopes both queries to conversations I'm a member of.
      supabase.from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(id,username,name,avatar,avatar_url,role)')
        .order('created_at', { ascending: true })
        .limit(1000),
      supabase.from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false }),
      supabase.from('conversation_members')
        .select('conversation_id, user_id, last_read_at, joined_at, profile:profiles!conversation_members_user_id_fkey(id,username,name,avatar,avatar_url,role)'),
    ]);

    if (feedRes.error)     console.warn('[tiled] feed load failed:',     feedRes.error.message);
    if (commentsRes.error) console.warn('[tiled] comments load failed:', commentsRes.error.message);
    if (likesRes.error)    console.warn('[tiled] likes load failed:',    likesRes.error.message);
    if (savesRes.error)    console.warn('[tiled] saves load failed:',    savesRes.error.message);
    if (dismRes.error)     console.warn('[tiled] dismissals load failed:', dismRes.error.message);
    if (votesRes.error)    console.warn('[tiled] poll_votes load failed:', votesRes.error.message);
    if (notifRes.error)    console.warn('[tiled] notifications load failed:', notifRes.error.message);
    if (statsRes.error)    console.warn('[tiled] profile stats load failed:', statsRes.error.message);
    if (followingRes.error) console.warn('[tiled] following load failed:', followingRes.error.message);
    if (followersRes.error) console.warn('[tiled] followers load failed:', followersRes.error.message);

    setMyStats(statsRes.data || { follower_count: 0, following_count: 0 });
    setFollowingIds(new Set((followingRes.data || []).map(r => r.followee_id)));
    setFollowerIds(new Set((followersRes.data || []).map(r => r.follower_id)));
    setMessages(messagesRes.data || []);
    if (messagesRes.error) console.warn('[tiled] messages load failed:', messagesRes.error.message);

    // Group members by conversation_id and merge into conversation objects
    const membersByConv = {};
    (membersRes.data || []).forEach(m => {
      (membersByConv[m.conversation_id] = membersByConv[m.conversation_id] || []).push(m);
    });
    const enrichedConvs = (convsRes.data || []).map(c => ({
      ...c,
      members: membersByConv[c.id] || [],
    }));
    setConversations(enrichedConvs);
    if (convsRes.error) console.warn('[tiled] conversations load failed:', convsRes.error.message);
    if (membersRes.error) console.warn('[tiled] members load failed:', membersRes.error.message);

    const likedSet = new Set((likesRes.data || []).map(r => r.tile_id));
    const savedSet = new Set((savesRes.data || []).map(r => r.tile_id));
    const dismissedSet = new Set((dismRes.data || []).map(r => r.tile_id));
    const voteMap = Object.fromEntries((votesRes.data || []).map(r => [r.tile_id, r.option_id]));

    const rawTiles = (feedRes.data || [])
      .filter(row => !dismissedSet.has(row.id))
      .map(row => shapeTile(row, likedSet, savedSet, voteMap));
    setTiles(rawTiles);

    const grouped = {};
    (commentsRes.data || []).forEach(row => {
      const c = shapeComment(row);
      (grouped[c.tile_id] = grouped[c.tile_id] || []).push(c);
    });
    setComments(grouped);

    const shapedNotifs = (notifRes.data || []).map(shapeNotification);
    setNotifications(shapedNotifs);
    setFeedLoading(false);

    // Cache for instant-paint on next reload (stale-while-revalidate).
    if (cacheKey) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          ts: Date.now(),
          tiles: rawTiles,
          comments: grouped,
          notifications: shapedNotifs,
        }));
      } catch (e) { /* quota / private mode — fine to skip */ }
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // Realtime: when someone else posts a tile, queue it as pendingNew so
  // the "X new tiles" chip and pull-to-refresh both surface live activity.
  // When a notification arrives for me, prepend it to the inbox.
  // RLS gates these subscriptions, so private tiles from others never
  // reach this client.
  // ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase || !ME?.id) return;

    const tilesChannel = supabase
      .channel('rt-tiles')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tiles' }, async (payload) => {
        const row = payload.new;
        if (!row || row.author_id === ME.id) return;
        // Fetch the joined view row so we get author + counts + tags
        const { data, error } = await supabase
          .from('tile_feed').select('*').eq('id', row.id).maybeSingle();
        if (error || !data) return;
        const shaped = shapeTile(data, new Set(), new Set(), {});
        setPendingNew(prev => {
          if (prev.find(p => p.id === shaped.id) || prev.length >= 12) return prev;
          return [shaped, ...prev];
        });
      })
      .subscribe();

    // ── follows: live follower / following counts on all profiles in view
    const refreshMyFollowState = async () => {
      const [statsRes, followingRes, followersRes] = await Promise.all([
        supabase.from('profile_stats').select('follower_count, following_count').eq('id', ME.id).maybeSingle(),
        supabase.from('follows').select('followee_id').eq('follower_id', ME.id),
        supabase.from('follows').select('follower_id').eq('followee_id', ME.id),
      ]);
      if (statsRes.data) setMyStats(statsRes.data);
      setFollowingIds(new Set((followingRes.data || []).map(r => r.followee_id)));
      setFollowerIds(new Set((followersRes.data || []).map(r => r.follower_id)));
    };

    const followsChannel = supabase
      .channel('rt-follows')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, async (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        if (row.follower_id === ME.id || row.followee_id === ME.id) {
          refreshMyFollowState();
        }
        // If we're viewing another user's profile, refresh their stats too
        if (viewingProfileId && (row.follower_id === viewingProfileId || row.followee_id === viewingProfileId)) {
          const { data } = await supabase.from('profile_stats').select('*').eq('id', viewingProfileId).maybeSingle();
          if (data) setViewedProfile(data);
        }
      })
      .subscribe();

    // ── messages: RLS scopes incoming events to conversations I'm in
    const messagesChannel = supabase
      .channel('rt-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new;
          if (!row) return;
          // fetch with sender profile join
          const { data } = await supabase
            .from('messages')
            .select('*, sender:profiles!messages_sender_id_fkey(id,username,name,avatar,avatar_url,role)')
            .eq('id', row.id)
            .maybeSingle();
          if (!data) return;
          setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data]);
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new;
          if (!row) return;
          setMessages(prev => prev.map(m => m.id === row.id ? { ...m, ...row } : m));
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old;
          if (!row) return;
          setMessages(prev => prev.filter(m => m.id !== row.id));
        }
      })
      .subscribe();

    // ── conversations + members: keep the list fresh when added to a group,
    // when someone reads a thread, or when a conversation's last_message_at moves
    const convsChannel = supabase
      .channel('rt-conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new;
          if (!row) return;
          setConversations(prev => {
            const existing = prev.find(c => c.id === row.id);
            if (existing) {
              return prev.map(c => c.id === row.id ? { ...c, ...row } : c)
                .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
            }
            // new conversation — fetch full row + members
            return prev; // will be backfilled by the membership subscription below
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, async (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        // refetch the affected conversation with its members
        const [{ data: conv }, { data: members }] = await Promise.all([
          supabase.from('conversations').select('*').eq('id', row.conversation_id).maybeSingle(),
          supabase.from('conversation_members')
            .select('conversation_id, user_id, last_read_at, joined_at, profile:profiles!conversation_members_user_id_fkey(id,username,name,avatar,avatar_url,role)')
            .eq('conversation_id', row.conversation_id),
        ]);
        if (!conv) {
          setConversations(prev => prev.filter(c => c.id !== row.conversation_id));
          return;
        }
        setConversations(prev => {
          const updated = { ...conv, members: members || [] };
          const idx = prev.findIndex(c => c.id === conv.id);
          const next = idx >= 0 ? prev.map((c, i) => i === idx ? updated : c) : [...prev, updated];
          return next.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
        });
      })
      .subscribe();

    const notifChannel = supabase
      .channel('rt-notifications')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `recipient_id=eq.${ME.id}`,
      }, async (payload) => {
        const row = payload.new;
        if (!row) return;
        const { data, error } = await supabase
          .from('notifications')
          .select('*, actor:profiles!notifications_actor_id_fkey(username,name,avatar,avatar_url)')
          .eq('id', row.id)
          .maybeSingle();
        if (error || !data) return;
        const shaped = shapeNotification(data);
        setNotifications(prev => {
          if (prev.find(n => n.id === shaped.id)) return prev;
          return [shaped, ...prev];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tilesChannel);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(followsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(convsChannel);
    };
  }, [ME?.id, viewingProfileId]);

  useEffect(() => {
    if (!ME?.id) return;
    // Hydrate from cache first so the feed paints instantly on reload,
    // then refetch in the background to pick up changes.
    let hadCache = false;
    if (cacheKey) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.tiles) {
            setTiles(cached.tiles);
            setComments(cached.comments || {});
            setNotifications(cached.notifications || []);
            setFeedLoading(false);
            hadCache = true;
          }
        }
      } catch (e) { /* invalid JSON — fall through to full load */ }
    }
    loadFeed({ silent: hadCache });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ME?.id]);

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
      // viewing another user's profile → only their public tiles
      if (onProfile && viewingProfileId) {
        return tile.author.id === viewingProfileId && !tile.private;
      }
      // profile page scoping — only the user's own tiles, sub-filtered by view
      if (onProfile) {
        if (view === 'liked') return tile.liked && !tile.private;
        if (view === 'saved') return tile.saved && !tile.private;
        // 'feed' on profile === their own posts
        return tile.author.handle === ME.handle;
      }

      if (mode === 'private') return tile.private && tile.author.handle === ME.handle;
      if (tile.private) return false;
      if (mode === 'pro' && tile.mode !== 'pro') return false;
      // chart and grid are pro-only kinds — never show them outside Professional
      if (mode !== 'pro' && (tile.kind === 'chart' || tile.kind === 'grid')) return false;
      if (filter !== 'all' && tile.kind !== filter) return false;
      if (tagFilter && !(tile.tags || []).includes(tagFilter)) return false;
      if (userFilter && tile.author.handle !== userFilter.handle) return false;
      return true;
    });
  }, [tiles, mode, filter, tagFilter, userFilter, view, onProfile, viewingProfileId, ME.handle]);

  // tick at 250ms while there are pending dismissals or deletes — drives
  // the countdown text in UndoSlot
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (Object.keys(pendingDismiss).length === 0 && Object.keys(pendingDelete).length === 0) return;
    const id = setInterval(() => forceTick(n => n + 1), 250);
    return () => clearInterval(id);
  }, [pendingDismiss, pendingDelete]);

  const handleDismiss = (id) => {
    if (pendingDismiss[id]) return;
    const expiresAt = Date.now() + 5000;
    setPendingDismiss(prev => ({ ...prev, [id]: expiresAt }));
    // schedule the actual removal — only on commit do we write a dismissals row
    dismissTimers.current[id] = setTimeout(async () => {
      setTiles(prev => prev.filter(x => x.id !== id));
      setPendingDismiss(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      delete dismissTimers.current[id];
      if (supabase && ME?.id) {
        const { error } = await supabase.from('dismissals').insert({ tile_id: id, user_id: ME.id });
        if (error && !String(error.message).toLowerCase().includes('duplicate')) {
          console.warn('[tiled] dismiss persist failed:', error.message);
        }
      }
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

  // Pull-to-refresh and the new-tiles chip both call revealPending.
  // Realtime push (the source that populates pendingNew) comes in the
  // next migration step; for now this just refetches the feed from the
  // server so the user sees anyone else's posts since they last loaded.
  const revealPending = async () => {
    setRefreshing(true);
    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    await loadFeed({ silent: true });
    setPendingNew([]);
    setPullProgress(0);
    setRefreshing(false);
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
      if (pull >= THRESHOLD) {
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
      if (e.deltaY < 0) {
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
      if (dy > 0 && el.scrollTop === 0) {
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

  // ─── Like — optimistic toggle, mirror to likes table
  const handleLike = async (id) => {
    if (!supabase || !ME?.id) return;
    const tile = tiles.find(x => x.id === id);
    if (!tile) return;
    const wasLiked = tile.liked;
    // optimistic update
    setTiles(prev => prev.map(x =>
      x.id === id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x
    ));
    const op = wasLiked
      ? supabase.from('likes').delete().match({ tile_id: id, user_id: ME.id })
      : supabase.from('likes').insert({ tile_id: id, user_id: ME.id });
    const { error } = await op;
    if (error) {
      console.warn('[tiled] like failed:', error.message);
      // revert
      setTiles(prev => prev.map(x => x.id === id ? tile : x));
    }
  };

  // ─── Open another user's profile from search/lists
  const openProfileForUser = async (userId) => {
    if (!userId || userId === ME?.id) {
      // viewing own profile
      setViewingProfileId(null);
      setViewedProfile(null);
      setOnProfile(true);
      setView('feed');
      return;
    }
    setViewingProfileId(userId);
    setOnProfile(true);
    setView('feed');
    setViewedProfileLoading(true);
    setViewedProfile(null);
    if (!supabase) { setViewedProfileLoading(false); return; }
    const { data, error } = await supabase
      .from('profile_stats')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setViewedProfileLoading(false);
    if (error) { console.warn('[tiled] viewed profile load failed:', error.message); return; }
    setViewedProfile(data);
  };

  const exitOtherProfile = () => {
    setViewingProfileId(null);
    setViewedProfile(null);
  };

  // ─── Follow / Unfollow another user
  const handleFollow = async (userId) => {
    if (!supabase || !ME?.id || !userId || userId === ME.id) return;
    const wasFollowing = followingIds.has(userId);
    // optimistic update
    setFollowingIds(prev => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(userId); else next.add(userId);
      return next;
    });
    setMyStats(prev => ({
      ...prev,
      following_count: Math.max(0, (prev.following_count || 0) + (wasFollowing ? -1 : 1)),
    }));
    const op = wasFollowing
      ? supabase.from('follows').delete().match({ follower_id: ME.id, followee_id: userId })
      : supabase.from('follows').insert({ follower_id: ME.id, followee_id: userId });
    const { error } = await op;
    if (error) {
      console.warn('[tiled] follow failed:', error.message);
      // revert
      setFollowingIds(prev => {
        const next = new Set(prev);
        if (wasFollowing) next.add(userId); else next.delete(userId);
        return next;
      });
      setMyStats(prev => ({
        ...prev,
        following_count: Math.max(0, (prev.following_count || 0) + (wasFollowing ? 1 : -1)),
      }));
    }
  };

  // ─── Direct messages
  const openMessages = () => {
    setMessagesOpen(true);
    setActiveThread(null);
  };

  // Find an existing 1:1 conversation with this user or create one.
  const findOrCreateDmConversation = async (partnerId) => {
    if (!supabase || !ME?.id || !partnerId || partnerId === ME.id) return null;
    // Search local cache first
    const existing = conversations.find(c =>
      c.type === 'dm'
      && c.members.length === 2
      && c.members.some(m => m.user_id === ME.id)
      && c.members.some(m => m.user_id === partnerId)
    );
    if (existing) return existing.id;
    // Create
    const { data: conv, error } = await supabase
      .from('conversations').insert({ type: 'dm', created_by: ME.id })
      .select('*').single();
    if (error) { console.warn('[tiled] create dm conv:', error.message); return null; }
    const { error: mErr } = await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: ME.id },
      { conversation_id: conv.id, user_id: partnerId },
    ]);
    if (mErr) { console.warn('[tiled] add dm members:', mErr.message); return null; }
    // Optimistically place the conversation into local state so anything
    // that immediately reads it (e.g. opening the thread right after a
    // share) has something to render. Realtime will overwrite this row
    // with the canonical version when the INSERT events arrive.
    const partnerProfile = await supabase
      .from('profiles')
      .select('id, username, name, avatar, avatar_url, role')
      .eq('id', partnerId)
      .maybeSingle();
    const meProfile = {
      id: ME.id, username: ME.handle, name: ME.name,
      avatar: ME.avatar, avatar_url: ME.avatar_url, role: ME.role,
    };
    const optimistic = {
      ...conv,
      members: [
        { conversation_id: conv.id, user_id: ME.id, last_read_at: null, joined_at: conv.created_at, profile: meProfile },
        { conversation_id: conv.id, user_id: partnerId, last_read_at: null, joined_at: conv.created_at, profile: partnerProfile.data || null },
      ],
    };
    setConversations(prev => prev.find(c => c.id === conv.id) ? prev : [optimistic, ...prev]);
    return conv.id;
  };

  const openThreadWith = async (partnerId) => {
    if (!partnerId || partnerId === ME?.id) return;
    setMessagesOpen(true);
    const convId = await findOrCreateDmConversation(partnerId);
    if (convId) setActiveThread(convId);
  };

  const handleCreateGroup = async ({ name, memberIds }) => {
    if (!supabase || !ME?.id) return { ok: false, error: 'Not signed in.' };
    const ids = (memberIds || []).filter(id => id && id !== ME.id);
    if (ids.length < 1) return { ok: false, error: 'Pick at least one other member.' };
    const { data: conv, error } = await supabase
      .from('conversations').insert({ type: 'group', name: (name || '').trim() || null, created_by: ME.id })
      .select('*').single();
    if (error) return { ok: false, error: error.message };
    const rows = [{ conversation_id: conv.id, user_id: ME.id }, ...ids.map(id => ({ conversation_id: conv.id, user_id: id }))];
    const { error: mErr } = await supabase.from('conversation_members').insert(rows);
    if (mErr) return { ok: false, error: mErr.message };
    // Optimistic local placement so opening the thread doesn't try to
    // render against a missing row while realtime catches up.
    const profileRes = await supabase.from('profiles')
      .select('id, username, name, avatar, avatar_url, role')
      .in('id', [ME.id, ...ids]);
    const byId = new Map((profileRes.data || []).map(p => [p.id, p]));
    const optimistic = {
      ...conv,
      members: [ME.id, ...ids].map(uid => ({
        conversation_id: conv.id, user_id: uid,
        last_read_at: null, joined_at: conv.created_at,
        profile: byId.get(uid) || null,
      })),
    };
    setConversations(prev => prev.find(c => c.id === conv.id) ? prev : [optimistic, ...prev]);
    setActiveThread(conv.id);
    return { ok: true, conversationId: conv.id };
  };

  // Send a tile-format message into a conversation.
  // payload: { kind, body, caption, media, link, poll, chart, grid }
  // Shared-tile attribution rides inside link._share so we don't need a
  // dedicated column on messages.
  const handleSendMessage = async (conversationId, payload) => {
    if (!supabase || !ME?.id) return { ok: false, error: 'Not signed in.' };
    if (!conversationId) return { ok: false, error: 'No conversation.' };
    const p = payload || {};
    const kind = p.kind || 'text';
    const body = (p.body || '').trim() || null;
    const isShared = !!(p.link && p.link._share);
    // Text bubbles need a body; shared tiles can be empty since the tile
    // card carries the content (author header + caption / media / etc.)
    if (kind === 'text' && !body && !isShared)
      return { ok: false, error: 'Message can\'t be empty.' };
    const insertRow = {
      sender_id: ME.id,
      conversation_id: conversationId,
      kind,
      body: body ? body.slice(0, 5000) : null,
      caption: p.caption ? String(p.caption).slice(0, 1000) : null,
      media: p.media || null,
      link:  p.link  || null,
      poll:  p.poll  || null,
      chart: p.chart || null,
      grid:  p.grid  || null,
    };
    const { data, error } = await supabase
      .from('messages').insert(insertRow)
      .select('*, sender:profiles!messages_sender_id_fkey(id,username,name,avatar,avatar_url,role)')
      .single();
    if (error) return { ok: false, error: error.message };
    setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data]);
    return { ok: true };
  };

  // Build a DM payload from a tile. Preserves the tile's content (kind,
  // body, media, etc.) verbatim and stuffs the original author into
  // link._share so the bubble can render as a tile card. Using the
  // existing link jsonb column means we don't need a schema migration to
  // ship shared tiles.
  const tileToMessagePayload = (tile) => {
    if (!tile) return null;
    const shareMeta = {
      tile_id: tile.id,
      kind: tile.kind,
      author: {
        id: tile.author?.id || null,
        handle: tile.author?.handle || 'unknown',
        name: tile.author?.name || null,
        avatar: tile.author?.avatar || null,
        avatar_url: tile.author?.avatar_url || null,
        role: tile.author?.role || null,
      },
    };
    // For an actual link tile we keep the original link content and just
    // tag _share on top; for everything else link is unused so we put
    // _share alone.
    const link = tile.kind === 'link' && tile.link
      ? { ...tile.link, _share: shareMeta }
      : { _share: shareMeta };
    // 'live' tiles can't be reproduced after the fact, so degrade to text.
    if (tile.kind === 'live') {
      return {
        kind: 'text',
        body: tile.caption || `[live tile from @${shareMeta.author.handle}]`,
        link,
      };
    }
    return {
      kind: tile.kind,
      body: tile.body || null,
      caption: tile.caption || null,
      media: tile.media || null,
      link,
      poll: tile.poll || null,
      chart: tile.chart || null,
      grid: tile.grid || null,
    };
  };

  // Send the currently-staged tile as a DM into an existing conversation,
  // or to a user (creating/finding the 1:1 DM first).
  const handleShareTile = async ({ conversationId, userId } = {}) => {
    const tile = shareTileTarget;
    if (!tile) return { ok: false, error: 'No tile selected.' };
    let convId = conversationId;
    if (!convId && userId) {
      convId = await findOrCreateDmConversation(userId);
      if (!convId) return { ok: false, error: 'Could not open conversation.' };
    }
    if (!convId) return { ok: false, error: 'Pick a conversation.' };
    const payload = tileToMessagePayload(tile);
    if (!payload) return { ok: false, error: 'Nothing to share.' };
    const r = await handleSendMessage(convId, payload);
    if (!r.ok) return r;
    setShareTileTarget(null);
    setMessagesOpen(true);
    setActiveThread(convId);
    return { ok: true };
  };

  // Remove a conversation from my inbox by deleting my own membership row.
  // The conversation itself stays in the DB for any other members; for me
  // it disappears the moment local state drops it. RLS already permits
  // deleting your own conversation_members row (members_delete_self).
  const handleDeleteConversation = async (conversationId) => {
    if (!supabase || !ME?.id || !conversationId) return { ok: false };
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    setMessages(prev => prev.filter(m => m.conversation_id !== conversationId));
    if (activeThread === conversationId) setActiveThread(null);
    const { error } = await supabase.from('conversation_members')
      .delete()
      .match({ conversation_id: conversationId, user_id: ME.id });
    if (error) {
      console.warn('[tiled] leave conversation failed:', error.message);
      await loadFeed({ silent: true });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  // Delete one of my own messages. Optimistically removes it locally so the
  // bubble disappears immediately; if the DB call fails we refetch so the
  // UI re-syncs. RLS only allows sender_id = auth.uid() to delete.
  const handleDeleteMessage = async (messageId) => {
    if (!supabase || !ME?.id || !messageId) return { ok: false };
    const target = messages.find(m => m.id === messageId);
    if (!target || target.sender_id !== ME.id) return { ok: false };
    setMessages(prev => prev.filter(m => m.id !== messageId));
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) {
      console.warn('[tiled] delete message failed:', error.message);
      await loadFeed({ silent: true });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  const handleMarkConvRead = async (conversationId) => {
    if (!supabase || !ME?.id || !conversationId) return;
    // optimistic — update last_read_at on my membership locally
    const now = new Date().toISOString();
    setConversations(prev => prev.map(c => c.id === conversationId
      ? { ...c, members: c.members.map(m => m.user_id === ME.id ? { ...m, last_read_at: now } : m) }
      : c));
    await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
  };

  // Typing indicators — broadcast over a per-conversation channel.
  // We only listen when the user opens the thread (set up in MessageThread).
  // Helper to send a typing ping.
  const sendTypingPing = async (conversationId) => {
    if (!supabase || !ME?.id || !conversationId) return;
    const ch = supabase.channel('typing:' + conversationId, { config: { broadcast: { self: false } } });
    await ch.subscribe();
    ch.send({ type: 'broadcast', event: 'typing', payload: { user_id: ME.id, name: ME.name, avatar: ME.avatar, avatar_url: ME.avatar_url } });
    // tear down after a short delay so we don't accumulate channels
    setTimeout(() => supabase.removeChannel(ch), 1500);
  };

  // ─── Tile media upload (photos/videos/audio attached to tiles or DMs)
  const handleUploadTileMedia = async (file) => {
    if (!supabase || !ME?.id) return { ok: false, error: 'Not signed in.' };
    if (!file) return { ok: false, error: 'No file selected.' };
    // Accept any image/video/audio MIME — narrow allowlists were rejecting
    // common phone-camera formats (HEIC from iOS, AAC m4a, etc.) so the
    // upload silently no-op'd. We size-cap by family instead.
    const mt = file.type || '';
    const isImage = mt.startsWith('image/');
    const isVideo = mt.startsWith('video/');
    const isAudio = mt.startsWith('audio/');
    if (!isImage && !isVideo && !isAudio)
      return { ok: false, error: 'Unsupported file type.' };
    const max = isVideo ? 25 * 1024 * 1024 : isAudio ? 15 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > max)
      return { ok: false, error: `File too large (max ${Math.round(max/1024/1024)} MB).` };
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const path = `${ME.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('tile-media')
      .upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' });
    if (upErr) {
      console.warn('[tiled] tile-media upload failed:', upErr.message);
      return { ok: false, error: upErr.message };
    }
    const { data } = supabase.storage.from('tile-media').getPublicUrl(path);
    return { ok: true, url: data.publicUrl, kind: isImage ? 'image' : isVideo ? 'video' : 'audio', mime: file.type, size: file.size };
  };

  // ─── Avatar upload / clear (Supabase Storage 'avatars' bucket)
  const handleUploadAvatar = async (file) => {
    if (!supabase || !ME?.id) return { ok: false, error: 'Not signed in.' };
    if (!file) return { ok: false, error: 'No file selected.' };
    if (!/^image\/(png|jpeg|webp)$/.test(file.type))
      return { ok: false, error: 'Only PNG, JPG, or WEBP images are supported.' };
    if (file.size > 2 * 1024 * 1024)
      return { ok: false, error: 'Image must be under 2 MB.' };
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${ME.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '0', contentType: file.type });
    if (upErr) return { ok: false, error: upErr.message };
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = data.publicUrl + '?v=' + Date.now();
    const { error: pErr } = await supabase
      .from('profiles').update({ avatar_url: url }).eq('id', ME.id);
    if (pErr) return { ok: false, error: pErr.message };
    if (auth?.refreshProfile) await auth.refreshProfile();
    return { ok: true, url };
  };

  const handleClearAvatar = async () => {
    if (!supabase || !ME?.id) return { ok: false, error: 'Not signed in.' };
    // best-effort delete of any existing files in the user's folder
    try {
      const { data: files } = await supabase.storage.from('avatars').list(ME.id);
      if (files && files.length) {
        await supabase.storage.from('avatars').remove(files.map(f => `${ME.id}/${f.name}`));
      }
    } catch (e) { /* ignore — column update is what matters */ }
    const { error } = await supabase
      .from('profiles').update({ avatar_url: null }).eq('id', ME.id);
    if (error) return { ok: false, error: error.message };
    if (auth?.refreshProfile) await auth.refreshProfile();
    return { ok: true };
  };

  // ─── Edit profile
  const handleSaveProfile = async ({ name, avatar, bio, username }) => {
    if (!supabase || !ME?.id) return { ok: false, error: 'Not signed in.' };
    const cleanAvatar = (avatar || '').slice(0, 4).toUpperCase();
    const cleanName = (name || '').trim().slice(0, 60);
    const cleanBio = (bio || '').trim().slice(0, 200);
    const cleanUsername = (username || '').trim().toLowerCase();
    if (!cleanName) return { ok: false, error: 'Name is required.' };
    if (!cleanAvatar) return { ok: false, error: 'Avatar is required (1–4 letters).' };
    if (!cleanUsername) return { ok: false, error: 'Username is required.' };
    if (!/^[a-z0-9_.\-]{3,24}$/.test(cleanUsername))
      return { ok: false, error: 'Username must be 3–24 chars (letters, numbers, ._-).' };

    const update = { name: cleanName, avatar: cleanAvatar, bio: cleanBio };
    if (cleanUsername !== ME.handle) {
      // Verify uniqueness before attempting
      const { data: clash } = await supabase
        .from('profiles').select('id').eq('username', cleanUsername).maybeSingle();
      if (clash && clash.id !== ME.id) {
        return { ok: false, error: 'That username is taken.' };
      }
      update.username = cleanUsername;
    }

    const { error } = await supabase
      .from('profiles').update(update).eq('id', ME.id);
    if (error) {
      // Postgres unique-violation code is 23505
      if (error.code === '23505' || /duplicate/i.test(error.message))
        return { ok: false, error: 'That username is taken.' };
      return { ok: false, error: error.message };
    }
    if (auth?.refreshProfile) await auth.refreshProfile();
    return { ok: true };
  };

  // ─── Delete tile — single-tap UX with 5s undo. The tile is replaced
  // by an UndoSlot in place (same pattern as swipe-to-dismiss), and
  // only commits to the DB after the timer expires.
  const handleDeleteTile = (id) => {
    if (!supabase || !ME?.id) return;
    const tile = tiles.find(x => x.id === id);
    if (!tile) return;
    const isAuthor = tile.author?.handle === ME.handle;
    const isStaff = ME.role === 'admin' || ME.role === 'owner';
    if (!isAuthor && !isStaff) return;
    if (pendingDelete[id]) return;
    if (expanded === id) setExpanded(null);
    if (commentRail === id) setCommentRail(null);

    setPendingDelete(prev => ({ ...prev, [id]: Date.now() + 5000 }));
    deleteTimers.current[id] = setTimeout(async () => {
      setTiles(prev => prev.filter(x => x.id !== id));
      setComments(prev => { const next = { ...prev }; delete next[id]; return next; });
      setPendingDelete(prev => { const next = { ...prev }; delete next[id]; return next; });
      delete deleteTimers.current[id];
      const { error } = await supabase.from('tiles').delete().eq('id', id);
      if (error) {
        console.warn('[tiled] delete failed:', error.message);
        await loadFeed({ silent: true });
      }
    }, 5000);
  };

  const handleUndoDelete = (id) => {
    if (deleteTimers.current[id]) {
      clearTimeout(deleteTimers.current[id]);
      delete deleteTimers.current[id];
    }
    setPendingDelete(prev => { const next = { ...prev }; delete next[id]; return next; });
  };


  // ─── Save — same shape as like
  const handleSave = async (id) => {
    if (!supabase || !ME?.id) return;
    const tile = tiles.find(x => x.id === id);
    if (!tile) return;
    const wasSaved = tile.saved;
    setTiles(prev => prev.map(x => x.id === id ? { ...x, saved: !x.saved } : x));
    const op = wasSaved
      ? supabase.from('saves').delete().match({ tile_id: id, user_id: ME.id })
      : supabase.from('saves').insert({ tile_id: id, user_id: ME.id });
    const { error } = await op;
    if (error) {
      console.warn('[tiled] save failed:', error.message);
      setTiles(prev => prev.map(x => x.id === id ? tile : x));
    }
  };

  const handleAddComment = async (tileId, body) => {
    const trimmed = body.trim();
    if (!trimmed || !supabase || !ME?.id) return;
    // optimistic placeholder
    const tempId = 'tmp_' + Date.now();
    const optimistic = {
      id: tempId, tile_id: tileId, body: trimmed, time: 'now',
      author: { handle: ME.handle, avatar: ME.avatar, avatar_url: ME.avatar_url },
    };
    setComments(prev => ({ ...prev, [tileId]: [...(prev[tileId] || []), optimistic] }));
    setTiles(prev => prev.map(x => x.id === tileId ? { ...x, comments: x.comments + 1 } : x));

    const { data, error } = await supabase
      .from('comments')
      .insert({ tile_id: tileId, author_id: ME.id, body: trimmed })
      .select('*, author:profiles!comments_author_id_fkey(username,avatar,avatar_url)')
      .single();
    if (error) {
      console.warn('[tiled] comment failed:', error.message);
      setComments(prev => ({ ...prev, [tileId]: (prev[tileId] || []).filter(c => c.id !== tempId) }));
      setTiles(prev => prev.map(x => x.id === tileId ? { ...x, comments: Math.max(0, x.comments - 1) } : x));
      return;
    }
    // replace temp with real
    const real = shapeComment(data);
    setComments(prev => ({
      ...prev,
      [tileId]: (prev[tileId] || []).map(c => c.id === tempId ? real : c),
    }));
  };

  const handleVote = async (tileId, optId) => {
    if (!supabase || !ME?.id) return;
    const tile = tiles.find(x => x.id === tileId);
    if (!tile?.poll || tile.poll.voted) return;
    // optimistic update
    setTiles(prev => prev.map(x => x.id === tileId ? {
      ...x, poll: {
        ...x.poll, voted: optId,
        options: x.poll.options.map(o => o.id === optId ? { ...o, votes: (o.votes || 0) + 1 } : o),
      },
    } : x));
    const { error } = await supabase.rpc('cast_poll_vote', { p_tile_id: tileId, p_option_id: optId });
    if (error) {
      console.warn('[tiled] vote failed:', error.message);
      setTiles(prev => prev.map(x => x.id === tileId ? tile : x));
    }
  };

  const handleOpenNotifications = async (rect) => {
    setNotifOrigin(rect || null);
    setNotifOpen(true);
    const unreadIds = notifications.filter(n => n.unread).map(n => n.id);
    if (!unreadIds.length || !supabase) return;
    setNotifications(prev => prev.map(n => n.unread ? { ...n, unread: false } : n));
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds);
    if (error) console.warn('[tiled] mark-read failed:', error.message);
  };
  const handleDismissNotification = async (id) => {
    if (!supabase) return;
    setNotifications(prev => prev.filter(n => n.id !== id));
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) console.warn('[tiled] dismiss notification failed:', error.message);
  };
  const handleClearNotifications = async () => {
    if (!supabase || !ME?.id) return;
    setNotifications([]);
    const { error } = await supabase.from('notifications').delete().eq('recipient_id', ME.id);
    if (error) console.warn('[tiled] clear notifications failed:', error.message);
  };

  const handlePost = async (kind, body, postTags, mediaPayload) => {
    if (!supabase || !ME?.id) return;
    const isStructured = kind === 'chart' || kind === 'grid';
    const trimmed = (body || '').trim();
    // Real uploaded media gets a url; placeholder kinds keep the gradient seed
    const photoMedia = mediaPayload && mediaPayload.kind === 'image'
      ? { url: mediaPayload.url, mime: mediaPayload.mime }
      : { tone: 180, label: 'photo' };
    const videoMedia = mediaPayload && mediaPayload.kind === 'video'
      ? { url: mediaPayload.url, mime: mediaPayload.mime }
      : { tone: 280, label: 'video' };
    const audioMedia = mediaPayload && mediaPayload.kind === 'audio'
      ? { url: mediaPayload.url, mime: mediaPayload.mime }
      : null;
    const tilePayload = {
      author_id: ME.id,
      kind,
      mode,
      is_private: mode === 'private',
      body: kind === 'text' ? trimmed : null,
      caption: (kind !== 'text' && !isStructured) ? trimmed : null,
      media: kind === 'photo' ? photoMedia
           : kind === 'video' ? videoMedia
           : kind === 'audio' ? audioMedia
           : null,
      chart: kind === 'chart' ? {
        label: trimmed || 'Untitled chart',
        unit: '',
        data: [
          { label: 'Mon', value: 32 }, { label: 'Tue', value: 48 },
          { label: 'Wed', value: 41 }, { label: 'Thu', value: 56 },
          { label: 'Fri', value: 64 }, { label: 'Sat', value: 38 },
          { label: 'Sun', value: 29 },
        ],
      } : null,
      grid: kind === 'grid' ? {
        columns: ['Item', 'Owner', 'Status'],
        rows: [
          ['Item one', '@' + ME.handle, { label: 'In progress', tone: 'info' }],
          ['Item two', '@' + ME.handle, { label: 'Shipped', tone: 'good' }],
          ['Item three', '@' + ME.handle, { label: 'Blocked', tone: 'bad' }],
        ],
      } : null,
    };
    setComposing(false);
    const { data, error } = await supabase
      .from('tiles').insert(tilePayload).select('id').single();
    if (error) {
      console.warn('[tiled] post failed:', error.message);
      return;
    }
    // tags as a separate write
    const tags = (postTags || []).slice(0, 5);
    if (tags.length) {
      const tagRows = tags.map(tag => ({ tile_id: data.id, tag }));
      const { error: tagErr } = await supabase.from('tile_tags').insert(tagRows);
      if (tagErr) console.warn('[tiled] tag insert failed:', tagErr.message);
    }
    // refetch the feed so the new tile appears with correct counts/relations
    await loadFeed({ silent: true });
    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const expandedTile = expanded ? tiles.find(x => x.id === expanded) : null;
  const gloss = t.gloss / 100;

  // First-ever load for this user (no cache yet) → keep the auth-style
  // loading bar visible instead of swapping to a grey skeleton. After the
  // first successful fetch the cache exists and reloads paint instantly.
  if (feedLoading && tiles.length === 0) {
    return (
      <div className="ti-auth-root" style={{ '--accent': accentCSS, '--gloss': gloss }}>
        <div className="ti-auth-bg" />
        <div className="ti-auth-loading">
          <div className="ti-logo ti-auth-logo">
            <span className="ti-logo-mark"><span /><span /><span /><span /></span>
            <span className="ti-logo-word">Tiled</span>
          </div>
          <div className="ti-auth-loading-bar"><span /></div>
        </div>
      </div>
    );
  }

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
              userFilter={userFilter} setUserFilter={setUserFilter}
              onCompose={() => setComposing(true)}
              onLogoClick={() => {
                // Tiled logo always returns you to the main feed.
                setOnProfile(false);
                setViewingProfileId(null);
                setViewedProfile(null);
                setView('feed');
                setTagFilter(null);
                setUserFilter(null);
                // Desktop: mainRef is the scroller. Mobile: the document is.
                // Scroll both to be safe across viewports.
                if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'auto' });
                if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
              }}
              onProfile={() => {
                // Avatar always lands you on your own profile, scrolled to top —
                // never toggles off, so it can't accidentally take you back to the
                // feed mid-scroll.
                setViewingProfileId(null);
                setViewedProfile(null);
                setOnProfile(true);
                setView('feed');
                if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'auto' });
                if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
              }}
              isOnProfile={onProfile}
              onNotifications={handleOpenNotifications}
              notifUnread={notifications.filter(n => n.unread).length}
              onMessages={openMessages}
              msgUnread={messages.filter(m => m.recipient_id === ME.id && !m.read_at).length}
              onAdmin={() => setAdminOpen(true)}
              onFollow={handleFollow}
              followingIds={followingIds}
              onShowProfile={openProfileForUser}
              user={ME}
              t={t} />

      <main className="ti-main" data-density={t.density} ref={mainRef}>
        <PullIndicator progress={pullProgress} refreshing={refreshing}
                       count={pendingNew.length} />
        {pendingNew.length > 0 && !refreshing && !onProfile && (
          <NewTilesChip count={pendingNew.length} onClick={revealPending} />
        )}
        {onProfile ? (
          viewingProfileId ? (
            <ProfileHeader
              isMe={false}
              user={viewedProfile ? {
                id: viewedProfile.id,
                handle: viewedProfile.username,
                name: viewedProfile.name,
                avatar: viewedProfile.avatar,
                avatar_url: viewedProfile.avatar_url,
                role: viewedProfile.role,
                bio: viewedProfile.bio,
                createdAt: viewedProfile.created_at,
              } : { handle: '', name: '', avatar: '··' }}
              loading={viewedProfileLoading}
              postCount={tiles.filter(x => x.author.id === viewingProfileId).length}
              followerCount={viewedProfile?.follower_count || 0}
              followingCount={viewedProfile?.following_count || 0}
              isFollowing={followingIds.has(viewingProfileId)}
              onFollow={() => handleFollow(viewingProfileId)}
              onMessage={() => openThreadWith(viewingProfileId)}
              onShowFollowers={() => setFollowListOpen('followers')}
              onShowFollowing={() => setFollowListOpen('following')}
              onBack={exitOtherProfile}
              mode={mode} />
          ) : (
            <ProfileHeader
              isMe={true}
              view={view} setView={setView}
              likedCount={tiles.filter(x => x.liked && !x.private).length}
              savedCount={tiles.filter(x => x.saved && !x.private).length}
              postCount={tiles.filter(x => x.author.handle === ME.handle).length}
              followerCount={myStats.follower_count}
              followingCount={myStats.following_count}
              user={ME}
              onLogout={auth?.logout}
              onEdit={() => setEditProfileOpen(true)}
              onShowFollowers={() => setFollowListOpen('followers')}
              onShowFollowing={() => setFollowListOpen('following')}
              mode={mode} />
          )
        ) : (
          <FeedHeader mode={mode} view={view} count={visibleTiles.length}
                      tagFilter={tagFilter} onClearTag={() => setTagFilter(null)}
                      userFilter={userFilter} onClearUser={() => setUserFilter(null)}
                      t={t} />
        )}

        <div className="ti-grid" data-density={t.density}>
          {feedLoading ? (
            tiles.length > 0
              // refetching with stale data showing → soft skeleton (rare path now)
              ? <FeedSkeleton density={t.density} />
              // very first load with no cache → unified loading bar that matches
              // the auth screen, so it feels continuous instead of swapping styles
              : null
          ) : (
            <>
              {visibleTiles.map(tile => (
                pendingDelete[tile.id] ? (
                  <UndoSlot key={tile.id} tile={tile}
                            expiresAt={pendingDelete[tile.id]}
                            onUndo={() => handleUndoDelete(tile.id)}
                            variant="delete" />
                ) : pendingDismiss[tile.id] ? (
                  <UndoSlot key={tile.id} tile={tile}
                            expiresAt={pendingDismiss[tile.id]}
                            onUndo={() => handleUndo(tile.id)} />
                ) : (
                <Tile key={tile.id} tile={tile}
                      comments={comments[tile.id] || []}
                      dismissing={false}
                      me={ME}
                      onDismiss={() => handleDismiss(tile.id)}
                      onLike={() => handleLike(tile.id)}
                      onSave={() => handleSave(tile.id)}
                      onDelete={() => handleDeleteTile(tile.id)}
                      onShare={() => setShareTileTarget(tile)}
                      onExpand={(rect) => { setExpandOrigin(rect); setExpanded(tile.id); }}
                      onOpenComments={() => setCommentRail(tile.id)}
                      onVote={(optId) => handleVote(tile.id, optId)}
                      onTag={setTagFilter}
                      t={t} />
                )
              ))}
              {visibleTiles.length === 0 && (
                <EmptyState view={view} tagFilter={tagFilter} mode={mode}
                            onCompose={() => setComposing(true)} />
              )}
            </>
          )}
        </div>
      </main>

      {expandedTile && (
        <ExpandedTile tile={expandedTile}
                      comments={comments[expandedTile.id] || []}
                      onClose={() => setExpanded(null)}
                      originRect={expandOrigin}
                      me={ME}
                      onLike={() => handleLike(expandedTile.id)}
                      onSave={() => handleSave(expandedTile.id)}
                      onDelete={() => handleDeleteTile(expandedTile.id)}
                      onComment={(body) => handleAddComment(expandedTile.id, body)}
                      onVote={(optId) => handleVote(expandedTile.id, optId)}
                      onTag={(tag) => { setTagFilter(tag); setExpanded(null); }}
                      commentStyle={t.commentStyle} t={t} />
      )}

      {commentRail && !expandedTile && (
        isMobile ? (
          <MobileCommentSheet tile={tiles.find(x => x.id === commentRail)}
                              comments={comments[commentRail] || []}
                              me={ME}
                              onClose={() => setCommentRail(null)}
                              onComment={(body) => handleAddComment(commentRail, body)} />
        ) : (
          <CommentRail tile={tiles.find(x => x.id === commentRail)}
                       comments={comments[commentRail] || []}
                       me={ME}
                       onClose={() => setCommentRail(null)}
                       onComment={(body) => handleAddComment(commentRail, body)} />
        )
      )}

      {notifOpen && (
        <NotificationsPanel notifications={notifications}
                            originRect={notifOrigin}
                            onClose={() => setNotifOpen(false)}
                            onDismiss={handleDismissNotification}
                            onClearAll={handleClearNotifications} />
      )}

      {adminOpen && (ME.role === 'admin' || ME.role === 'owner') && (
        <AdminPanel user={ME} onClose={() => setAdminOpen(false)} />
      )}

      {messagesOpen && (
        <MessagesPanel messages={messages} conversations={conversations} me={ME}
                       activeThread={activeThread}
                       setActiveThread={setActiveThread}
                       onClose={() => { setMessagesOpen(false); setActiveThread(null); }}
                       onSend={handleSendMessage}
                       onDeleteMessage={handleDeleteMessage}
                       onDeleteConversation={handleDeleteConversation}
                       onMarkRead={handleMarkConvRead}
                       onOpenProfile={openProfileForUser}
                       onUploadMedia={handleUploadTileMedia}
                       onTyping={sendTypingPing}
                       onCreateGroup={() => setCreateConvOpen(true)}
                       supabase={supabase} />
      )}

      {shareTileTarget && (
        <ShareTileSheet me={ME}
                        tile={shareTileTarget}
                        conversations={conversations}
                        followingIds={followingIds}
                        onShare={handleShareTile}
                        onClose={() => setShareTileTarget(null)} />
      )}

      {createConvOpen && (
        <CreateConversationModal me={ME}
                                 followingIds={followingIds}
                                 onCreate={async (args) => {
                                   const r = await handleCreateGroup(args);
                                   if (r.ok) setCreateConvOpen(false);
                                   return r;
                                 }}
                                 onClose={() => setCreateConvOpen(false)} />
      )}

      {editProfileOpen && (
        <EditProfileModal user={ME}
                          onClose={() => setEditProfileOpen(false)}
                          onSave={handleSaveProfile}
                          onUploadAvatar={handleUploadAvatar}
                          onClearAvatar={handleClearAvatar} />
      )}

      {followListOpen && (
        <FollowListModal tab={followListOpen}
                         ownerId={viewingProfileId || ME.id}
                         ownerName={viewingProfileId ? (viewedProfile?.name || '') : ME.name}
                         me={ME}
                         followingIds={followingIds}
                         onFollow={handleFollow}
                         onOpenProfile={(uid) => { setFollowListOpen(null); openProfileForUser(uid); }}
                         onClose={() => setFollowListOpen(null)} />
      )}

      {composing && (
        <Composer onClose={() => setComposing(false)} onPost={handlePost}
                  mode={mode} existingTags={allTags.map(([t]) => t)}
                  onUploadMedia={handleUploadTileMedia} />
      )}

      <ModeIndicator mode={mode} view={view} />
    </div>
  );
}

function EmptyState({ view, tagFilter, mode, onCompose }) {
  let msg = 'Welcome to Tiled. Post your first tile to get started.';
  let cta = 'Post a tile';
  let showCta = true;
  if (view === 'liked') {
    msg = 'No liked tiles yet. Tap the heart on a tile to add it here.';
    showCta = false;
  } else if (view === 'saved') {
    msg = 'No saved tiles yet. Tap the bookmark to keep something for later.';
    showCta = false;
  } else if (tagFilter) {
    msg = `No tiles tagged with #${tagFilter}.`;
    showCta = false;
  } else if (mode === 'pro') {
    msg = 'No professional tiles yet. Post one to get the section going.';
  } else if (mode === 'private') {
    msg = 'Private notes are only visible to you. Write your first one.';
  }
  return (
    <div className="ti-empty">
      <div className="ti-empty-mark"><span /><span /><span /><span /></div>
      <div className="ti-empty-msg">{msg}</div>
      {showCta && onCompose && (
        <button className="ti-empty-cta" onClick={onCompose}>{cta}</button>
      )}
    </div>
  );
}

function FeedSkeleton({ density }) {
  const count = density === 'compact' ? 8 : density === 'regular' ? 6 : 4;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ti-skel">
          <div className="ti-gloss" />
          <div className="ti-skel-shimmer" />
        </div>
      ))}
    </>
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
