import https from 'node:https';
import { SocksProxyAgent } from 'socks-proxy-agent';

const maxResponseBytes = 1024 * 1024;

export function createTelegramTransport(token, proxyUrl) {
  if (!token || !proxyUrl) throw new Error('Telegram polling requires token and proxy');
  const agent = new SocksProxyAgent(proxyUrl);

  return (method, data, signal) =>
    new Promise((resolve, reject) => {
      const body = JSON.stringify(data);
      const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
      const request = https.request(
        url,
        {
          agent,
          method: 'POST',
          signal,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (response) => {
          const chunks = [];
          let bytes = 0;
          response.on('data', (chunk) => {
            bytes += chunk.length;
            if (bytes > maxResponseBytes) {
              request.destroy(Object.assign(new Error('Response too large'), { code: 'BOT_SIZE' }));
              return;
            }
            chunks.push(chunk);
          });
          response.on('error', reject);
          response.on('end', () => {
            let result;
            try {
              result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            } catch {
              reject(Object.assign(new Error('Invalid Telegram response'), { code: 'BOT_JSON' }));
              return;
            }
            if (!result?.ok) {
              const status = Number(result?.error_code) || response.statusCode || 502;
              reject(Object.assign(new Error('Telegram API error'), { code: `BOT_API_${status}` }));
              return;
            }
            resolve(result.result);
          });
        },
      );
      request.setTimeout(method === 'getUpdates' ? 45000 : 20000, () =>
        request.destroy(
          Object.assign(new Error('Telegram request timed out'), { code: 'BOT_TIMEOUT' }),
        ),
      );
      request.on('error', reject);
      request.end(body);
    });
}
