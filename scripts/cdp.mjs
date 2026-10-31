import { setTimeout as delay } from 'node:timers/promises';

export async function connect() {
  let target;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:9223/json/list', {
        signal: AbortSignal.timeout(1000),
      });
      const targets = await response.json();
      target = targets.find(item => item.type === 'page' && item.url.startsWith('https://discord.com/'));
      if (target) break;
    } catch {}
    await delay(1000);
  }
  if (!target) throw new Error('Discordの診断接続を開始できませんでした。');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  return {
    close: () => socket.close(),
    evaluate(expression) {
      const requestId = ++id;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error('Discordの応答がタイムアウトしました。')), 45000);
        function finish(error, value) {
          clearTimeout(timer);
          socket.removeEventListener('message', receive);
          socket.removeEventListener('close', closed);
          error ? reject(error) : resolve(value);
        }
        function closed() { finish(new Error('Discordの診断接続が切断されました。')); }
        function receive(event) {
          const message = JSON.parse(event.data);
          if (message.id !== requestId) return;
          if (message.error || message.result.exceptionDetails) {
            const detail = message.error?.message ?? message.result.exceptionDetails.exception?.description ?? message.result.exceptionDetails.text;
            finish(new Error(`Discord内部の診断処理に失敗しました: ${detail}`));
          } else finish(null, message.result.result.value);
        }
        socket.addEventListener('message', receive);
        socket.addEventListener('close', closed, { once: true });
        socket.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate', params: {
          expression, returnByValue: true, awaitPromise: true,
        } }));
      });
    },
  };
}
