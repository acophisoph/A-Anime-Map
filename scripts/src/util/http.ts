const RPS = Number(process.env.REQUESTS_PER_SECOND ?? '0.35');
let nextAt = 0;

async function pace() {
  const interval = 1000 / Math.max(RPS, 0.01);
  const now = Date.now();
  const wait = Math.max(0, nextAt - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  nextAt = Math.max(now, nextAt) + interval;
}

export async function postGraphQL(queryName: string, query: string, variables: unknown, retries = 5): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await pace();
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    }).catch((error) => ({ ok: false, status: 0, headers: new Headers(), json: async () => ({ errors: [String(error)] }) } as Response));

    if (response.ok) {
      const body = await response.json();
      if (!body.errors) return body.data;
    }

    const retryAfter = Number(response.headers.get('Retry-After') ?? '0');
    const transient = response.status === 429 || response.status >= 500 || response.status === 0;
    if (!transient || attempt === retries) {
      const body = await response.json().catch(() => ({}));
      throw new Error(`${queryName} failed status=${response.status} vars=${JSON.stringify(variables)} body=${JSON.stringify(body)}`);
    }
    const sleep = retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** attempt;
    console.log(`[retry] ${queryName} status=${response.status} waitMs=${sleep} vars=${JSON.stringify(variables)}`);
    await new Promise((r) => setTimeout(r, sleep));
  }
  throw new Error('unreachable');
}
