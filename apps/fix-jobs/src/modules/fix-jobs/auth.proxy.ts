import { env } from '../../config/env';

export async function proxyRequest(
  request: any,
  reply: any,
  upstreamUrl: string,
  method: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.PROXY_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(request.headers?.authorization
        ? { Authorization: request.headers.authorization }
        : {}),
      'X-Gateway-Request-Id': request.id,
      'X-Forwarded-For': request.ip,
      'X-Forwarded-Proto': request.protocol,
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
      ...(method !== 'GET' && method !== 'HEAD' && request.body
        ? { body: JSON.stringify(request.body) }
        : {}),
    };

    const upstream = await fetch(upstreamUrl, fetchOptions);
    const data = await upstream.json();

    reply
      .status(upstream.status)
      .header('X-Served-By', 'motacare-fix-jobs')
      .send(data);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return reply.status(504).send({
        statusCode: 504,
        error: 'Gateway Timeout',
        message: 'The upstream service did not respond in time',
      });
    }

    request.log?.error?.({
      event: 'proxy_error',
      upstream: upstreamUrl,
      error: error.message,
    });

    return reply.status(502).send({
      statusCode: 502,
      error: 'Bad Gateway',
      message: 'Proxy request failed',
    });
  } finally {
    clearTimeout(timeout);
  }
}
