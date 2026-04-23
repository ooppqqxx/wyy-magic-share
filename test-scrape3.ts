import fetch from 'node-fetch';

async function test() {
  const apiRes = await fetch(`https://music.163.com/api/playlist/detail?id=7190743641`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  const data = await apiRes.json();
  console.log(Object.keys(data));
  console.log(data.result ? Object.keys(data.result) : 'no result');
  if (data.result) {
     console.log('Title:', data.result.name);
     console.log('Cover:', data.result.coverImgUrl);
     console.log('Tracks count:', data.result.tracks?.length);
     if (data.result.tracks?.length > 0) {
       console.log('Song 1:', data.result.tracks[0].name, data.result.tracks[0].artists?.[0]?.name);
     }
  }
}
test();
