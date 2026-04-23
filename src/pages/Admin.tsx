import React, { useState, useEffect } from 'react';
import { Copy, Link as LinkIcon, Music, RefreshCw, Clock, Trash2, Settings2, LogIn, Lock, Download, Image as ImageIcon, X } from 'lucide-react';
import QRCode from 'qrcode';
import { API_BASE } from '../lib/config';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [spectatorUrl, setSpectatorUrl] = useState<string | null>(null);
  const [currentSong, setCurrentSong] = useState<any>(null);
  const [spectatorConnected, setSpectatorConnected] = useState(false);
  const [playlist, setPlaylist] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isActive, setIsActive] = useState(false);

  // Poster State
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);

  // Authenticated fetch wrapper
  const authFetch = async (url: string, options: any = {}) => {
    const token = localStorage.getItem('adminToken');
    if (!options.headers) options.headers = {};
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    
    // We use relative URL because Netlify proxy will handle routing back to the wuy-music backend
    const res = await fetch(url, options);
    if (res.status === 401) {
      setIsAuthenticated(false);
      localStorage.removeItem('adminToken');
      throw new Error('Unauthorized');
    }
    return res;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('adminToken', data.token);
        setIsAuthenticated(true);
        setLoginError('');
      } else {
        setLoginError('Invalid User Credentials');
      }
    } catch(err) {
      setLoginError('Connection Error');
    }
  };

  const fetchHistory = () => {
    authFetch('/api/history')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.history) {
          setHistory(data.history);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
      fetchHistory();
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !isAuthenticated) return;
    
    // Connect to SSE for current session
    const token = localStorage.getItem('adminToken');
    const eventSource = new EventSource(`/api/events/${sessionId}?token=${token}`);
    
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'init') {
            if (data.session.spectatorConnected) setSpectatorConnected(true);
            if (data.session.currentSong) setCurrentSong(data.session.currentSong);
            if (data.session.playlist) setPlaylist(data.session.playlist);
            setIsActive(data.session.isActive || false);
        } else if (data.type === 'spectator_connected') {
          setSpectatorConnected(true);
        } else if (data.type === 'session_activated') {
          setIsActive(true);
        } else if (data.type === 'session_deactivated') {
          setIsActive(false);
        } else if (data.type === 'spectator_disconnected') {
          setSpectatorConnected(false);
        } else if (data.type === 'song_played') {
          setCurrentSong(data.song);
        } else if (data.type === 'playlist_updated') {
          setPlaylist(data.playlist);
        }
      } catch (err) {
        console.error(err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId]);

  const handleGenerate = async () => {
    if (!inputText) return;
    setIsGenerating(true);
    
    try {
      // 1. Create a new session specifically for generation if we don't have one
      const sessRes = await authFetch('/api/start-session');
      const sessData = await sessRes.json();
      const newSessionId = sessData.sessionId;
      
      const res = await authFetch('/api/parse-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: newSessionId, text: inputText })
      });
      const data = await res.json();
      
      if (data.success) {
        setSessionId(newSessionId);
        
        // This is the literal URL that is copied and shown in the poster
        setSpectatorUrl(`https://wyy-music.top/s/${newSessionId}`);
        
        setInputText('');
        fetchHistory(); // Refresh history list
      } else {
        alert('Failed to generate playlist');
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to server');
    } finally {
      setIsGenerating(false);
    }
  };

    const loadHistorySession = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSessionId(id);
    
    // This is the literal URL that is copied and shown in the poster
    setSpectatorUrl(`https://wyy-music.top/s/${id}`);
    
    // Clear the current active states locally immediately so we don't bleed over
    setIsActive(false);
    setSpectatorConnected(false);
    setCurrentSong(null);
    setPlaylist(null);
    
    try {
      // Don't reset! Instead, fetch the current state to resume the session if it's already active
      const res = await authFetch(`/api/session/${id}`);
      if (res.ok) {
         const data = await res.json();
         if (data.session) {
           setIsActive(data.session.isActive || false);
           setSpectatorConnected(data.session.spectatorConnected || false);
           setCurrentSong(data.session.currentSong || null);
           setPlaylist(data.playlist || null);
         }
      }
    } catch(err) {
      console.error(err);
    }
  };

  const deleteHistorySession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this saved link?')) {
      await authFetch(`/api/session/${id}`, { method: 'DELETE' });
      if (sessionId === id) {
          setSessionId(null);
          setSpectatorUrl(null);
      }
      fetchHistory();
    }
  };

  const copyToClipboard = () => {
    if (!spectatorUrl) return;
    
    // Fallback workaround explicitly for Safari / WeChat builtin browsers
    const textArea = document.createElement('textarea');
    textArea.value = spectatorUrl;
    // Hide it structurally
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        alert('Copied successfully!');
      } else {
        alert('Failed to copy. Please manually select the link above and copy it.');
      }
    } catch (err) {
      alert('Failed to copy. Please manually select the link above and copy it.');
    }
    document.body.removeChild(textArea);
  };

  const handleCreateNew = () => {
    setSessionId(null);
    setSpectatorUrl(null);
    setSpectatorConnected(false);
    setCurrentSong(null);
    setPlaylist(null);
  };

  const generatePoster = async () => {
    if (!spectatorUrl || !playlist) return;
    setIsGeneratingPoster(true);
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d')!;

      // 1. Background
      ctx.fillStyle = '#1c1c1c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Header
      ctx.fillStyle = '#e54d42';
      ctx.font = 'bold 50px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('网易云音乐', 540, 130);

      // 3. Load Images (Cover & QR)
      const coverImg = new Image();
      coverImg.crossOrigin = 'anonymous'; // Important for CORS
      coverImg.src = `/api/proxy-image?url=${encodeURIComponent(playlist.coverPic)}`;
      await new Promise(resolve => { coverImg.onload = resolve; coverImg.onerror = resolve; });

      const qrDataUrl = await QRCode.toDataURL(spectatorUrl, { 
        width: 350, 
        margin: 2, 
        color: { dark: '#000000', light: '#ffffff' } 
      });
      const qrImg = new Image();
      qrImg.src = qrDataUrl;
      await new Promise(resolve => { qrImg.onload = resolve; });

      // 4. Draw Cover
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 20;
      
      const coverSize = 750;
      const coverX = (canvas.width - coverSize) / 2;
      const coverY = 220;
      ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
      ctx.shadowColor = 'transparent'; // Reset

      // 5. Draw Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 65px sans-serif';
      ctx.textAlign = 'center';
      
      // Basic text wrapping for title
      const maxW = 900;
      let y = coverY + coverSize + 120;
      const words = playlist.title.split('');
      let line = '';
      for(let n = 0; n < words.length; n++) {
        const testLine = line + words[n];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxW && n > 0) {
          ctx.fillText(line, 540, y);
          line = words[n];
          y += 85;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 540, y);

      // 6. Draw QR Code
      const qrY = y + 150;
      ctx.drawImage(qrImg, 540 - 175, qrY, 350, 350);

      // 7. Footer text
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '35px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('长按识别二维码，进入精选专属歌单', 540, qrY + 450);

      const finalUrl = canvas.toDataURL('image/jpeg', 0.9);
      setPosterUrl(finalUrl);
    } catch (err) {
      console.error(err);
      alert('生成海报失败，请重试');
    } finally {
      setIsGeneratingPoster(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 font-['Helvetica_Neue',Arial,sans-serif]">
        <div className="w-full max-w-sm bg-white/5 backdrop-blur-[10px] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-[#e54d42]" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Magician Access</h1>
            <p className="text-sm text-white/50">Requires authorized credentials</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/70 uppercase tracking-[1px] mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#e54d42] focus:border-[#e54d42] outline-none transition-all text-white placeholder-white/30"
                  placeholder="Enter admin username"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/70 uppercase tracking-[1px] mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#e54d42] focus:border-[#e54d42] outline-none transition-all text-white placeholder-white/30"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-sm text-red-500 font-medium text-center">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#e54d42] hover:bg-[#f37b1d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#e54d42] transition-colors"
            >
              <LogIn className="h-5 w-5 mr-2" />
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 font-['Helvetica_Neue',Arial,sans-serif]">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">🎶 Remote Mind Reading Magic</h1>
          <p className="mt-2 text-white/70">Magician Control Panel</p>
        </header>

        <div className="bg-white/5 backdrop-blur-[10px] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 p-6 space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#e54d42] uppercase tracking-[1px] mb-2">Paste NetEase Cloud Music Share Link:</label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. 分享歌单: tristantemagic的2021年度歌单 https://163cn.tv/5rj4ple (@网易云音乐)"
              className="w-full h-24 p-3 bg-black/40 border border-white/10 rounded-lg focus:ring-2 focus:ring-[#e54d42] focus:border-[#e54d42] outline-none transition-all resize-none text-sm text-white placeholder-white/30"
              disabled={!!spectatorUrl}
            />
          </div>

          {!spectatorUrl ? (
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !inputText}
              className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#e54d42] hover:bg-[#f37b1d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#e54d42] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <><RefreshCw className="animate-spin -ml-1 mr-2 h-5 w-5" /> Parsing...</>
              ) : (
                'Generate Magic Link'
              )}
            </button>
          ) : (
            <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg space-y-4">
              <div>
                <p className="text-sm font-medium text-green-400">✅ Link Generated</p>
                <div className="mt-2 flex">
                  <input
                    type="text"
                    readOnly
                    value={spectatorUrl}
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md text-sm border-white/10 border-r-0 bg-black/40 text-white"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="inline-flex items-center px-4 py-2 border border-white/10 rounded-r-md bg-white/5 text-white/80 hover:bg-white/10 hover:text-white font-medium text-sm transition-colors cursor-pointer"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </button>
                </div>
                
                {/* 增加一个海报生成按钮 */}
                <button
                  onClick={generatePoster}
                  disabled={isGeneratingPoster || !playlist}
                  className="w-full mt-4 flex items-center justify-center py-2 px-4 border border-blue-500/30 rounded-lg shadow-sm text-sm font-medium text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 focus:outline-none transition-colors"
                >
                  {isGeneratingPoster ? (
                    <><RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" /> 生成海报中...</>
                  ) : (
                    <><ImageIcon className="h-4 w-4 mr-2" /> 生成伪装网易云海报</>
                  )}
                </button>
                
                <p className="mt-4 text-xs text-white/50 text-center">Copy the link or generate a poster to send to the spectator.</p>
              </div>
              <button
                 onClick={handleCreateNew}
                 className="flex items-center text-sm text-[#e54d42] hover:text-[#f37b1d] font-medium transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Start New Session
              </button>
            </div>
          )}
        </div>

        {spectatorUrl && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-[10px] rounded-2xl shadow-sm border border-white/10 p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center">
                <LinkIcon className={`h-6 w-6 ${spectatorConnected ? 'text-green-400' : 'text-blue-400'}`} />
              </div>
              <h3 className="text-lg font-bold text-white">Spectator Status</h3>
              <p className={`text-sm font-medium px-3 py-1 rounded-full inline-block ${
                spectatorConnected ? 'bg-green-900/40 text-green-400 border border-green-500/30' : 'bg-black/40 text-white/60 border border-white/10'
              }`}>
                {spectatorConnected ? 'Connected & Browsing' : 'Waiting for connection...'}
              </p>
            </div>

            <div className={`bg-white/5 backdrop-blur-[10px] rounded-2xl shadow-sm border ${currentSong ? 'border-[#e54d42]/50 shadow-[0_0_15px_rgba(229,77,66,0.3)]' : 'border-white/10'} p-6 text-center space-y-4 transition-all duration-500`}>
              <div className="mx-auto w-12 h-12 bg-red-900/20 border border-[#e54d42]/30 rounded-full flex items-center justify-center">
                <Music className={`h-6 w-6 ${currentSong ? 'text-[#e54d42] animate-bounce' : 'text-white/40'}`} />
              </div>
              <h3 className="text-lg font-bold text-white">Currently Playing</h3>
              {currentSong ? (
                <div className="space-y-1">
                  <p className="text-xl font-bold text-[#e54d42] break-words">{currentSong.title}</p>
                  <p className="text-sm text-white/60 font-medium">{currentSong.artist}</p>
                </div>
              ) : (
                <p className="text-sm text-white/40">No song selected yet.</p>
              )}
            </div>
            
            {/* Activate / Disconnect Action */ }
            <div className="col-span-1 md:col-span-2 space-y-4">
              {!isActive ? (
                <button
                  onClick={async () => {
                    await authFetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });
                    setIsActive(true);
                  }}
                  className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition-colors cursor-pointer animate-pulse"
                >
                  🚀 Activate Magic Sync Mode
                </button>
              ) : (
                <div className="w-full py-2 bg-green-900/30 border border-green-500/50 text-green-400 font-bold rounded-xl text-center shadow-sm">
                  ✨ Magic Sync is Active ✨
                </div>
              )}
              
              <button
                onClick={async () => {
                  if (!confirm('This will end the session and permanently redirect the spectator to the real NetEase app/site. Continue?')) return;
                  await authFetch('/api/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });
                  setSpectatorConnected(false);
                }}
                className="w-full py-4 bg-red-900/20 border border-red-500/30 text-red-400 font-bold rounded-xl hover:bg-red-900/40 hover:text-red-300 transition-colors shadow-sm cursor-pointer"
              >
                End Session & Redirect Spectator
              </button>
            </div>
          </div>
        )}

        {/* Saved Sessions History */}
        {history.length > 0 && (
          <div className="bg-white/5 backdrop-blur-[10px] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center mb-4">
               <Clock className="w-5 h-5 mr-2 text-[#e54d42]" /> 
               Saved Playlists
            </h3>
            
            <div className="space-y-3">
               {history.map((hItem) => (
                  <div 
                    key={hItem.id} 
                    onClick={() => loadHistorySession(hItem.id)}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      sessionId === hItem.id 
                      ? 'bg-[#e54d42]/10 border-[#e54d42]/50' 
                      : 'bg-black/20 border-white/5 hover:border-white/20 hover:bg-black/40'
                    }`}
                  >
                     <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden border border-white/10 mr-4">
                        {hItem.coverPic ? (
                           <img src={hItem.coverPic} className="w-full h-full object-cover" alt="Playlist" />
                        ) : (
                           <Music className="w-6 h-6 m-3 text-gray-500" />
                        )}
                     </div>
                     <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-bold text-white truncate">{hItem.playlistTitle}</p>
                        <p className="text-xs text-white/50 mt-1 truncate flex items-center">
                           ID: {hItem.id.substring(0, 8)}... • {new Date(hItem.createdAt).toLocaleDateString()}
                        </p>
                     </div>
                     <div className="flex-shrink-0">
                        <button 
                          onClick={(e) => deleteHistorySession(hItem.id, e)}
                          className="p-2 text-white/40 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                        >
                           <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
               ))}
            </div>
          </div>
        )}
      </div>

      {/* Poster Modal */}
      {posterUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-[#1c1c1c] rounded-2xl border border-white/10 shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 flex justify-between items-center border-b border-white/5">
              <h3 className="text-white font-bold flex items-center"><ImageIcon className="w-5 h-5 mr-2 text-[#e54d42]" /> 专属歌单海报</h3>
              <button onClick={() => setPosterUrl(null)} className="text-white/50 hover:text-white p-1">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 flex justify-center bg-black/50">
              <img src={posterUrl} alt="Generated Poster" className="w-full h-auto rounded-xl shadow-lg border border-white/5" />
            </div>
            
            <div className="p-4 border-t border-white/5">
              <a 
                href={posterUrl}
                download={`网易云歌单_${playlist?.title || 'share'}.jpg`}
                className="w-full flex items-center justify-center py-3 bg-[#e54d42] hover:bg-[#f37b1d] text-white font-bold rounded-xl shadow-lg transition-colors cursor-pointer"
              >
                <Download className="w-5 h-5 mr-2" /> 保存海报到相册
              </a>
              <p className="text-xs text-white/40 text-center mt-3">发送给观众长按识别即可入局</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
