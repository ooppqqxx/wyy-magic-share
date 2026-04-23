import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function test() {
  const url = 'https://163cn.tv/5rj4ple';
  const res = await fetch(url, { redirect: 'follow' });
  console.log('Redirected to:', res.url);
  const idMatch = res.url.match(/id=(\d+)/);
  if (!idMatch) return console.log('no id');
  const id = idMatch[1];
  console.log('ID:', id);

  const apiRes = await fetch(`https://music.163.com/api/playlist/detail?id=${id}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  const data = await apiRes.json();
  console.log('API Status:', apiRes.status, data?.code);
  if (data?.playlist) {
     console.log('Title:', data.playlist.name);
     console.log('Cover:', data.playlist.coverImgUrl);
     console.log('Tracks count:', data.playlist.tracks?.length);
  }
}
test();
