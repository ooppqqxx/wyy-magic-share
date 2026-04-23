import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Play, PlayCircle, Heart, MessageSquare, Download, Share2, MoreVertical, ChevronLeft, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_BASE } from '../lib/config';

export default function Spectator() {
  const { sessionId } = useParams();
  const [playlist, setPlaylist] = useState<any>(null);
  const [playingSong, setPlayingSong] = useState<any>(null);
  const [view, setView] = useState<'playlist' | 'player'>('playlist');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    document.title = '\u200E'; // Invisible zero-width space to hide the title entirely
  }, []);

  const handleAppClick = () => {
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2500);
  };

  useEffect(() => {
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
    }

    if (!sessionId) return;
    
    fetch(`${API_BASE}/api/session/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.playlist) {
          setPlaylist(data.playlist);
        } else {
          alert('Session expired or invalid link.');
        }
      })
      .catch(console.error);

    const eventSource = new EventSource(`${API_BASE}/api/spectator-events/${sessionId}`);
    
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'redirect' && data.url) {
          window.location.replace(data.url);
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    return () => {
      eventSource.close();
    };
  }, [sessionId]);

  const handlePlaySong = async (song: any) => {
    setPlayingSong(song);
    setView('player');
    setIsPlaying(false);
    
    if (sessionId) {
      try {
        await fetch(`${API_BASE}/api/play`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ sessionId, song })
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleBack = () => {
    setView('playlist');
    setPlayingSong(null);
    setIsPlaying(false);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current?.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  if (!playlist) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-[100dvh] w-full max-w-md mx-auto overflow-hidden relative font-sans select-none text-black">
      {playingSong && (
        <audio 
          ref={audioRef}
          src={`http://music.163.com/song/media/outer/url?id=${playingSong.id}.mp3`} 
          onError={(e) => console.log('Audio playback error or VIP song', e)}
          onEnded={() => setIsPlaying(false)}
        />
      )}
      <AnimatePresence mode="wait">
        {view === 'playlist' ? (
          <motion.div 
            key="playlist"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full h-full pb-24"
          >
            {/* Playlist Header Background */}
            <div className="relative w-full h-[210px] overflow-hidden bg-[#222] text-white">
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-60 blur-md scale-110"
                style={{ backgroundImage: `url(${playlist.coverPic})` }}
              ></div>
              <div className="absolute inset-0 bg-black/30"></div>
              
              <div className="relative z-10 pt-10 px-4 flex">
                <div className="w-[124px] h-[124px] relative flex-shrink-0 border border-white/10 rounded-sm">
                  <img src={playlist.coverPic} className="w-full h-full object-cover rounded-sm" alt="Cover" referrerPolicy="no-referrer" />
                  <div className="absolute top-1 left-0 bg-[#d33a31] text-white text-[10px] px-1.5 py-0.5 rounded-r-lg font-bold tracking-wider z-10">
                    歌单
                  </div>
                  <div className="absolute top-1 right-1 text-white text-[11px] flex items-center z-10 font-bold tracking-tighter" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-[12px] h-[12px] mr-0.5 mt-[1px]"><path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.805-2.816-2.225 2.51-2.816-.805 2.51-2.225-2.225-2.51.805-2.816 2.225 2.51 2.816-.805-2.51 2.225 3.016 3.016z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /><circle cx="12" cy="10.5" r="2.5" /></svg>
                    {playlist.playCount || '37.5万'}
                  </div>
                  <div className="absolute top-0 right-0 left-0 h-8 bg-gradient-to-b from-black/60 to-transparent rounded-t-sm"></div>
                </div>
                <div className="ml-4 pt-0.5 flex flex-col">
                  <h1 className="text-[17px] font-medium leading-[1.3] line-clamp-2 mt-1 pr-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                    {playlist.title}
                  </h1>
                  <div className="mt-4 flex items-center">
                    <div className="w-[28px] h-[28px] rounded-full overflow-hidden bg-gray-300 mr-2 flex-shrink-0 border border-white/20">
                      <img src="https://picsum.photos/seed/user/100/100" alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[14px] text-gray-200 truncate opacity-90">{playlist.creator}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* List Header */}
            <div className="bg-[#f2f2f2] relative z-20">
              <div className="px-3 py-1.5 flex items-center justify-between text-gray-500 text-[12px]">
                 歌曲列表
              </div>

              {/* Songs */}
              <div className="bg-white">
                {playlist.songs.map((song: any, idx: number) => (
                  <div 
                    key={song.id} 
                    className="flex flex-row items-center cursor-pointer active:bg-gray-100 py-1.5"
                    onClick={() => handlePlaySong(song)}
                  >
                    <div className="w-[50px] text-center text-[#999] text-[17px] flex-shrink-0 font-light">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0 pr-4 border-b border-[#f2f2f2] pb-2 pt-2 flex justify-between items-center">
                      <div className="min-w-0 flex-1">
                        <div className="text-[16px] text-[#333] truncate leading-tight">{song.title}</div>
                        <div className="text-[12px] text-[#888] truncate mt-1 flex items-center leading-tight">
                          {song.isVip && <span className="text-red-500 border border-red-500 rounded px-1 text-[8px] mr-1 scale-90 transform origin-left rounded-sm font-bold tracking-tighter">VIP</span>}
                          {song.artist}
                        </div>
                      </div>
                      <div className="text-[#ccc] px-2 flex-shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-7 h-7"><circle cx="12" cy="12" r="10" /><path d="M10 8l6 4-6 4V8z" fill="currentColor" /></svg>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="py-4 text-center text-[#999] text-[13px]">
                  查看更多歌曲，请下载客户端
                </div>
                <div className="px-4 py-2 text-[13px] text-[#666]">
                  最新评论(2)
                </div>
              </div>
            </div>

            {/* Bottom Floating App Header */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#f2f2f2]">
               <button onClick={handleAppClick} className="w-full bg-[#ec4141] text-white py-4 rounded-t-3xl text-[18px] tracking-widest shadow-[0_-5px_15px_rgba(0,0,0,0.05)] border-t border-[#ec4141]/50">
                  <span className="font-light">打开网易云音乐</span>
               </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="player"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full h-[100dvh] bg-[#222] flex flex-col text-white absolute inset-0 z-50 player-view overflow-hidden"
          >
            <div className="relative flex-1 flex flex-col overflow-y-auto no-scrollbar">
               {/* Top Bar inside the scroll area or fixed to match screenshot exactly */}
               <div 
                 className="flex items-center justify-between px-3 py-2 bg-white text-black shrink-0 relative z-50 cursor-pointer"
                 onClick={handleBack}
               >
                  <div className="flex items-center">
                     <div className="w-8 h-8 flex items-center justify-center bg-[#d33a31] rounded-full shrink-0">
                       <svg viewBox="0 0 100 100" className="w-5 h-5 fill-white"><path d="M50 0C22.4 0 0 22.4 0 50s22.4 50 50 50 50-22.4 50-50S77.6 0 50 0zm0 90C27.9 90 10 72.1 10 50S27.9 10 50 10s40 17.9 40 40-17.9 40-40 40z"/><path d="M40 30v40l30-20z"/></svg>
                     </div>
                     <div className="ml-2 flex flex-col">
                       <span className="text-[14px] font-medium leading-tight text-[#333]">网易云音乐</span>
                       <span className="text-[11px] text-[#999] leading-tight mt-0.5">去云音乐，下载歌曲随时畅听</span>
                     </div>
                  </div>
                  <button className="bg-[#ff3a3a] text-white px-4 py-1.5 rounded-full text-[13px] font-medium tracking-wide">
                    立即体验
                  </button>
               </div>
               
               {/* Clickable Back button area mimicking the left side edge just in case */}
               <button 
                  onClick={handleBack}
                  className="absolute top-[60px] left-[18px] z-20 text-white hover:text-gray-300 opacity-0"
               >
                 <ChevronLeft className="w-8 h-8 font-light" strokeWidth={2.5} />
               </button>

               {/* Vinyl Record */}
               <div className="flex flex-col items-center pt-24 pb-8 relative shrink-0">
                  {/* Subtle outer ring */}
                  <div 
                    className="w-[280px] h-[280px] rounded-full bg-[#161616] relative flex items-center justify-center cursor-pointer" 
                    style={{ 
                        boxShadow: '0 0 0 5px rgba(255,255,255,0.06)',
                        animation: 'spin 20s linear infinite',
                        animationPlayState: isPlaying ? 'running' : 'paused'
                    }}
                    onClick={togglePlay}
                  >
                     {/* Grooves */}
                     <div className="absolute inset-0 rounded-full" style={{ background: 'repeating-radial-gradient(circle, #161616 0, #161616 2px, #1a1a1a 3px, #1a1a1a 4px)' }}></div>
                     
                     {/* Center artwork */}
                     <div className="w-[190px] h-[190px] rounded-full overflow-hidden bg-[#000] border-[5px] border-[#0a0a0a] relative z-10 flex items-center justify-center">
                       <img src={playingSong.picUrl} alt="Artwork" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                       
                       {!isPlaying && (
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <svg viewBox="0 0 24 24" className="w-[60px] h-[60px] text-white/95 drop-shadow-lg ml-2" fill="currentColor"><path d="M7 6v12l11-6z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>
                         </div>
                       )}
                     </div>
                  </div>
                  
                  {/* Stylus arm - exact static motion based on user request */}
                  <div className="absolute top-[10px] left-1/2 ml-[20px] w-[140px] h-[220px] pointer-events-none origin-top-left z-20">
                     <svg viewBox="0 0 140 220" fill="none" className="w-full h-full drop-shadow-sm">
                       {/* Pivot */}
                       <circle cx="20" cy="5" r="8" fill="#fff" />
                       <circle cx="20" cy="5" r="3" fill="#ccc" />
                       {/* Curvy white arm */}
                       <path d="M 20 5 C 20 60, 40 100, 100 130" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                       {/* Light gray rectangular head */}
                       <g transform="translate(100, 130) rotate(-30)">
                         <rect x="-10" y="0" width="20" height="30" rx="3" fill="#fff" />
                         <rect x="-6" y="27" width="12" height="15" rx="1.5" fill="#f0f0f0" />
                       </g>
                     </svg>
                  </div>
               </div>

               {/* Song Info & Controls */}
               <div className="px-6 flex flex-col pt-4 pb-12 w-full shrink-0 relative mt-4">
                  <div className="flex justify-between items-start">
                     <div className="flex flex-col min-w-0 pr-4">
                        <span className="text-xl font-medium text-white/90 truncate">{playingSong.title}</span>
                        <span className="text-[13px] text-white/50 mt-1 truncate">{playingSong.artist}</span>
                     </div>
                     <div className="flex items-center space-x-7 text-white/50 pt-1 shrink-0">
                        <div className="flex items-center">
                           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-[28px] h-[28px]"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78v0z" strokeLinejoin="round"/></svg>
                           <span className="text-[10px] transform -translate-y-2.5 ml-0.5">1w+</span>
                        </div>
                        <div className="flex items-center">
                           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-[28px] h-[28px]"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinejoin="round"/></svg>
                           <span className="text-[10px] transform -translate-y-2.5 ml-0.5">309</span>
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center text-center text-[13px] text-[#777] mt-8 leading-[1.8] tracking-wide font-light">
                     <span>作曲 : {playingSong.artist}</span>
                     <span>编曲 : {playingSong.artist}</span>
                     <span>纯音乐，请欣赏</span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-4 mt-8 px-2">
                     <button onClick={handleAppClick} className="flex-1 py-2.5 rounded-full border border-[#555] text-[#ccc] text-[15px] tracking-wide">下载APP</button>
                     <button onClick={handleAppClick} className="flex-1 py-2.5 rounded-full bg-[#ff3a3a] text-white text-[15px] tracking-wide">打开</button>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-12 mt-10 border-b border-[#333] text-[15px] text-[#888]">
                     <div className="relative text-white font-medium pb-2.5">
                        评论
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[3px] bg-[#ff3a3a] rounded-full"></div>
                     </div>
                     <div className="pb-2.5">相似歌曲</div>
                     <div className="pb-2.5">相似歌单</div>
                  </div>
                  
                  <div className="mt-8 pb-10">
                     <div className="text-[14px] font-bold text-white mb-5">精彩评论</div>
                     <div className="flex items-start">
                        <img src="https://picsum.photos/seed/user1/40/40" className="w-[36px] h-[36px] rounded-full object-cover" />
                        <div className="ml-3 flex-1 pb-4">
                           <div className="flex justify-between items-start">
                              <div>
                                 <div className="text-[13px] text-[#999] flex items-center">
                                    别説妳愛喔
                                    <span className="ml-1.5 bg-[#111] border border-[#ff3a3a] text-[#a32222] font-bold text-[8px] px-[3px] rounded-sm italic leading-tight scale-90">v1P</span>
                                 </div>
                                 <div className="text-[10px] text-[#555] mt-0.5">2024年11月6日</div>
                              </div>
                              <div className="flex items-center text-[11px] text-[#777]">
                                 56 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5 ml-1 inline"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                              </div>
                           </div>
                           <div className="text-[14.5px] text-[#ddd] mt-3 leading-relaxed">
                              如果你也在听的话， 可以踢我回来听一下吗
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Extra height at bottom so it unscrolls smoothly like app */}
               <div className="h-10"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Busy Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-6 py-3 rounded-lg text-sm tracking-wide z-50 whitespace-nowrap shadow-xl backdrop-blur-md"
          >
            当前服务器繁忙，请稍后再试
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
