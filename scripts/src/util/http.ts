const RPS = Number(process.env.REQUESTS_PER_SECOND ?? '0.35');
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? '30000');
const MAX_RETRY_SLEEP_MS = Number(process.env.MAX_RETRY_SLEEP_MS ?? '30000');
let nextAt = 0;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pace() {
  const interval = 1000 / Math.max(RPS, 0.01);
  const now = Date.now();
  const wait = Math.max(0, nextAt - now);
  if (wait > 0) await sleep(wait);
  nextAt = Math.max(now, nextAt) + interval;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function postGraphQL(queryName: string, query: string, variables: unknown, retries = 5): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await pace();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
    } catch (error) {
      response = {
        ok: false,
        status: 0,
        headers: new Headers(),
        json: async () => ({ errors: [String(error)] }),
      } as Response;
    } finally {
      clearTimeout(timeout);
    }

    const body = await safeJson(response);
    if (response.ok && !body.errors) return body.data;

    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfter = Number(retryAfterHeader ?? '0');
    const transient = response.status === 429 || response.status >= 500 || response.status === 0;

    if (!transient || attempt === retries) {
      throw new Error(`${queryName} failed status=${response.status} vars=${JSON.stringify(variables)} body=${JSON.stringify(body)}`);
    }

    const backoff = Math.min(MAX_RETRY_SLEEP_MS, 800 * 2 ** attempt);
    const sleepMs = retryAfter > 0 ? Math.min(MAX_RETRY_SLEEP_MS, retryAfter * 1000) : backoff;
    console.log(`[retry] ${queryName} status=${response.status} waitMs=${sleepMs} vars=${JSON.stringify(variables)}`);
    await sleep(sleepMs);
  }

  throw new Error('unreachable');
}
