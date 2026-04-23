import fetch from 'node-fetch';

async function test() {
  const apiRes = await fetch(`https://music.163.com/api/playlist/detail?id=7190743641`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  const data = await apiRes.json();
  const t = data.result.tracks[0];
  console.log(JSON.stringify({
    id: t.id,
    name: t.name,
    artist: t.artists?.map((a:any)=>a.name).join('/'),
    album: t.album?.name,
    picUrl: t.album?.picUrl
  }, null, 2));
}
test();
