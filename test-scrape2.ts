import fetch from 'node-fetch';

async function test() {
  const apiRes = await fetch(`https://music.163.com/api/v3/playlist/detail?id=7190743641`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'id=7190743641&n=1000&c=true'
  });
  const data = await apiRes.text();
  console.log(data.slice(0, 500));
}
test();
