import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createServer as createViteServer } from 'vite';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// In-memory / persistent store for magic sessions
const DB_FILE = path.join(process.cwd(), 'database.json');

let sessions: Record<string, any> = {};

// Load sessions from disk
if (fs.existsSync(DB_FILE)) {
  try {
    sessions = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (e) {
    console.error('Error reading database file', e);
  }
}

// Helper to save sessions to disk
const saveDb = () => {
  fs.writeFileSync(DB_FILE, JSON.stringify(sessions, null, 2));
};

const VALID_USERS: Record<string, string> = {
  'admin01': 'Mgc_8372!',
  'admin02': 'Mgc_1928!',
  'admin03': 'Mgc_4739!',
  'admin04': 'Mgc_5610!',
  'admin05': 'Mgc_8492!',
  'admin06': 'Mgc_2039!',
  'admin07': 'Mgc_7481!',
  'admin08': 'Mgc_9302!',
  'admin09': 'Mgc_1456!',
  'admin10': 'Mgc_6723!'
};

const activeTokens = new Map<string, string>();

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (VALID_USERS[username] && VALID_USERS[username] === password) {
    const token = uuidv4();
    activeTokens.set(token, username);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const tokenFromQuery = req.query.token as string;
  const token = tokenFromHeader || tokenFromQuery;

  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  res.locals.username = activeTokens.get(token);
  next();
};

// SSE logic for admin and spectators
const adminClients: Record<string, express.Response[]> = {};
const spectatorClients: Record<string, express.Response[]> = {};

// Helper to send SSE
const notifyAdmins = (sessionId: string, data: any) => {
  if (adminClients[sessionId]) {
    adminClients[sessionId].forEach(client => {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  }
};

const notifySpectators = (sessionId: string, data: any) => {
  if (spectatorClients[sessionId]) {
    spectatorClients[sessionId].forEach(client => {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  }
};

app.get('/api/spectator-events/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!spectatorClients[sessionId]) {
    spectatorClients[sessionId] = [];
  }
  spectatorClients[sessionId].push(res);

  res.write(`data: ${JSON.stringify({ type: 'init' })}\n\n`);

  req.on('close', () => {
    spectatorClients[sessionId] = spectatorClients[sessionId].filter(client => client !== res);
    
    if (spectatorClients[sessionId].length === 0 && sessions[sessionId]) {
      sessions[sessionId].spectatorConnected = false;
      // Removed the auto-lock line and the session_deactivated notification
      saveDb();
      notifyAdmins(sessionId, { type: 'spectator_disconnected' });
    }
  });
});

app.post('/api/disconnect', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const session = sessions[sessionId];
  if (!session) return res.status(400).json({ error: 'Invalid session' });

  const currentSong = session.currentSong;
  const url = currentSong 
    ? `https://y.music.163.com/m/song?id=${currentSong.id}` 
    : `https://y.music.163.com/m/playlist?id=${session.playlist?.id || ''}`;

  session.redirectUrl = url;
  notifySpectators(sessionId, { type: 'redirect', url });
  
  // Optional: clear state
  session.spectatorConnected = false;
  saveDb();
  notifyAdmins(sessionId, { type: 'spectator_disconnected' });
  
  res.json({ success: true });
});

// New API endpoints for History Management
app.get('/api/history', requireAuth, (req, res) => {
  const username = res.locals.username;
  // Return an array of sorted sessions Filtered by Username (newest first)
  const history = Object.entries(sessions)
    .filter(([_, session]) => session.username === username)
    .map(([id, session]) => {
      return {
        id,
        playlistTitle: session.playlist?.title || 'Unknown Playlist',
        coverPic: session.playlist?.coverPic || '',
        createdAt: session.createdAt || Date.now()
      };
    }).sort((a, b) => b.createdAt - a.createdAt);
  
  res.json({ success: true, history });
});

app.delete('/api/session/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const username = res.locals.username;
  
  if (sessions[id] && sessions[id].username === username) {
    delete sessions[id];
    saveDb();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'Not found or not authorized' });
  }
});

app.get('/api/start-session', requireAuth, (req, res) => {
  const sessionId = uuidv4();
  const username = res.locals.username;
  
  sessions[sessionId] = { 
    playlist: null, 
    currentSong: null,
    spectatorConnected: false,
    isActive: false,      // default to false: redirects to real URL
    originalUrl: null,
    createdAt: Date.now(),
    username
  };
  saveDb();
  res.json({ sessionId });
});

app.get('/api/events/:sessionId', requireAuth, (req, res) => {
  const { sessionId } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // flush the headers to establish SSE with client

  if (!adminClients[sessionId]) {
    adminClients[sessionId] = [];
  }
  adminClients[sessionId].push(res);

  // Send initial state
  res.write(`data: ${JSON.stringify({ type: 'init', session: sessions[sessionId] })}\n\n`);

  req.on('close', () => {
    adminClients[sessionId] = adminClients[sessionId].filter(client => client !== res);
  });
});

app.post('/api/parse-playlist', requireAuth, async (req, res) => {
  const { sessionId, text } = req.body;
  
  // If parsing directly without session, bypass session check
  if (sessionId && !sessions[sessionId]) return res.status(400).json({ error: 'Invalid session' });

  try {
    // 1. Extract URL
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    let playlistId = null;
    let url = urlMatch ? urlMatch[1] : null;

    let title = "网易云歌单";
    let creator = "G_lswp";
    let coverPic = "https://picsum.photos/seed/playlist/400/400";
    let playCount = "37.5万";
    let songs: any[] = [];

    // Fallback static songs representing a typical playlist
    const fallbackSongs = [
      { id: 1, title: 'WE CAME', artist: 'APRIL(CN)', picUrl: coverPic },
      { id: 2, title: 'Bounce Or Die (Extended Mix)', artist: 'ZUZU / Blithe', picUrl: coverPic },
    ];

    if (url) {
      // 2. Resolve URL
      const response = await fetch(url, { redirect: 'follow' });
      const finalUrl = response.url;
      
      const idMatch = finalUrl.match(/id=(\d+)/);
      if (idMatch) playlistId = idMatch[1];
      
      if (playlistId) {
        // 3. Fetch NetEase API
        try {
          const apiRes = await fetch(`https://music.163.com/api/playlist/detail?id=${playlistId}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          const data: any = await apiRes.json();
          if (data && data.result) {
            title = data.result.name || title;
            creator = data.result.creator?.nickname || creator;
            coverPic = data.result.coverImgUrl || coverPic;
            if (data.result.playCount) {
               let num = data.result.playCount;
               playCount = num > 10000 ? (num / 10000).toFixed(1) + '万' : num.toString();
            }

            if (data.result.tracks && Array.isArray(data.result.tracks)) {
              songs = data.result.tracks.slice(0, 20).map((t: any) => ({
                id: t.id,
                title: t.name,
                artist: t.artists?.map((a:any) => a.name).join('/') + (t.album?.name ? ' - ' + t.album.name : ''),
                picUrl: t.album?.picUrl || coverPic
              }));
            }
          }
        } catch (e) {
          console.error("API Fetch failed, using defaults", e);
        }
      }
    }

    if (songs.length === 0) {
      songs = fallbackSongs;
      // Extract custom title from text if present
      const titleMatch = text.match(/分享歌单:\s*([^\s]+)/);
      if (titleMatch) title = titleMatch[1];
    }

    const playlist = { title, creator, coverPic, playCount, songs };
    
    // Save to session if present
    if (sessionId) {
      sessions[sessionId].playlist = playlist;
      sessions[sessionId].originalUrl = url || `https://y.music.163.com/m/playlist?id=${playlistId || ''}`;
      saveDb();
      notifyAdmins(sessionId, { type: 'playlist_updated', playlist });
    }
    
    res.json({ success: true, playlist });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to parse' });
  }
});

app.post('/api/activate', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !sessions[sessionId]) return res.status(400).json({ error: 'Invalid session' });
  
  sessions[sessionId].isActive = true;
  saveDb();
  notifyAdmins(sessionId, { type: 'session_activated' });
  res.json({ success: true });
});

// Proxy to bypass CORS on the canvas
app.get('/api/proxy-image', async (req, res) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send('Missing URL');
    
    // Some image sources might need a basic fetch
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    
    // Get arrayBuffer directly
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Pass along content type and add CORS headers
    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    res.send(buffer);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).send('Error proxying image');
  }
});

app.post('/api/reset-session', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !sessions[sessionId]) return res.status(400).json({ error: 'Invalid session' });
  
  sessions[sessionId].isActive = false;
  sessions[sessionId].spectatorConnected = false;
  sessions[sessionId].currentSong = null;
  saveDb();
  notifyAdmins(sessionId, { type: 'session_deactivated' });
  notifyAdmins(sessionId, { type: 'spectator_disconnected' });
  notifyAdmins(sessionId, { type: 'song_played', song: null }); // clear song
  
  res.json({ success: true });
});

app.post('/api/play', (req, res) => {
  const { sessionId, song } = req.body;
  if (!sessionId || !sessions[sessionId]) return res.status(400).json({ error: 'Invalid session' });
  
  sessions[sessionId].currentSong = song;
  saveDb();
  notifyAdmins(sessionId, { type: 'song_played', song });
  res.json({ success: true });
});

app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (sessions[sessionId]) {
    sessions[sessionId].spectatorConnected = true;
    // Don't clear song when spectator just connects. Let old info persist.
    // sessions[sessionId].currentSong = null; 
    saveDb();
    notifyAdmins(sessionId, { type: 'spectator_connected' });
    // notifyAdmins(sessionId, { type: 'song_played', song: null }); 
    res.json({ success: true, playlist: sessions[sessionId].playlist, session: sessions[sessionId] });
  } else {
    res.status(404).json({ error: 'Playlist not found' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'development-server') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom', 
    });
    
    app.use(vite.middlewares);
    
    app.use('*', async (req, res, next) => {
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        
        // Inject OpenGraph for Sessions
        const match = req.originalUrl.match(/^\/s\/([^\/?]+)/);
        if (match && sessions[match[1]] && sessions[match[1]].playlist) {
          const p = sessions[match[1]].playlist;
          
          // Restore OpenGraph tags specifically for WeChat "Favorite -> Share" card generation
          const ogTags = `
            <title>${p.title}</title>
            <meta property="og:title" content="${p.title}">
            <meta property="description" itemprop="description" content="来自：${p.creator}">
            <meta property="og:description" content="来自：${p.creator}">
            <meta itemprop="image" content="${p.coverPic}">
            <meta property="og:image" content="${p.coverPic}">
          `;
          template = template.replace('</head>', `${ogTags}\n</head>`);
          
          // Add invisible img for WeChat JS bridge older versions
          const wechatImgHacks = `<div style="display:none;width:0;height:0;overflow:hidden;"><img src="${p.coverPic}" width="400" height="400" /></div>`;
          template = template.replace('<body>', `<body>\n${wechatImgHacks}`);
          
          if (!sessions[match[1]].isActive) {
            const redirectUrl = sessions[match[1]].originalUrl || 'https://music.163.com/';
            template = template.replace('</head>', `<script>window.location.replace('${redirectUrl}');</script>\n</head>`);
          }
        }
        
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });

  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false })); 
    
    app.get('*', (req, res) => {
      try {
        let template = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        
        const match = req.originalUrl.match(/^\/s\/([^\/?]+)/);
        if (match && sessions[match[1]] && sessions[match[1]].playlist) {
          const p = sessions[match[1]].playlist;
          
          const ogTags = `
            <title>${p.title}</title>
            <meta property="og:title" content="${p.title}">
            <meta property="description" itemprop="description" content="来自：${p.creator}">
            <meta property="og:description" content="来自：${p.creator}">
            <meta itemprop="image" content="${p.coverPic}">
            <meta property="og:image" content="${p.coverPic}">
          `;
          template = template.replace('</head>', `${ogTags}\n</head>`);
          
          const wechatImgHacks = `<div style="display:none;width:0;height:0;overflow:hidden;"><img src="${p.coverPic}" width="400" height="400" /></div>`;
          template = template.replace('<body>', `<body>\n${wechatImgHacks}`);
          
          if (!sessions[match[1]].isActive) {
            const redirectUrl = sessions[match[1]].originalUrl || 'https://music.163.com/';
            template = template.replace('</head>', `<script>window.location.replace('${redirectUrl}');</script>\n</head>`);
          }
        }
        
        res.send(template);
      } catch (e) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
