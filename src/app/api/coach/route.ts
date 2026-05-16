/**
 * NIM proxy. Browser → this route → NIM (server-to-server, no CORS).
 * Streams SSE back to the browser. User's key is passed through but never stored.
 */

export const runtime = 'edge';

const NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

interface ProxyBody {
  model: string;
  apiKey: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export async function POST(req: Request): Promise<Response> {
  let body: ProxyBody;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!body.apiKey || !body.model || !Array.isArray(body.messages)) {
    return new Response('Missing fields', { status: 400 });
  }

  const upstream = await fetch(NIM_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${body.apiKey}`,
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: body.model,
      stream: true,
      temperature: body.temperature ?? 0.3,
      max_tokens: body.max_tokens ?? 220,
      messages: body.messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const txt = await upstream.text().catch(() => '');
    return new Response(`NIM upstream ${upstream.status}: ${txt.slice(0, 300)}`, {
      status: upstream.status || 502,
    });
  }

  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
