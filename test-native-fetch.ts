async function test() {
  const url = 'https://163cn.tv/5rj4ple';
  const res = await fetch(url, { redirect: 'follow' });
  console.log('Redirected native to:', res.url);
}
test();
