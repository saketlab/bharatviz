/**
 * CORS Proxy utilities - parallel proxy attempts for faster loading
 */

const PROXY_SERVICES = [
  { name: 'allorigins.win', buildUrl: (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
  { name: 'corsproxy.io', buildUrl: (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}` },
  { name: 'codetabs.com', buildUrl: (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` },
];

const DIRECT_TIMEOUT = 10000;
const PROXY_TIMEOUT = 30000;

// timeout covers headers only; large bodies stream longer
async function tryFetch(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response;
}

export async function fetchWithCorsFallback(url: string): Promise<Response> {
  try {
    return await tryFetch(url, DIRECT_TIMEOUT);
  } catch (directError) {
    const isCorsError =
      directError instanceof TypeError ||
      (directError instanceof Error && (
        directError.message.includes('Failed to fetch') ||
        directError.message.includes('NetworkError') ||
        directError.message.includes('timeout') ||
        directError.name === 'AbortError'
      ));

    if (!isCorsError) throw directError;

    const proxyAttempts = PROXY_SERVICES.map(async proxy => {
      try {
        return await tryFetch(proxy.buildUrl(url), PROXY_TIMEOUT);
      } catch (error) {
        throw new Error(`${proxy.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    return Promise.any(proxyAttempts).catch(aggregateError => {
      const errors = aggregateError instanceof AggregateError
        ? aggregateError.errors.map((e: Error) => e.message).join('; ')
        : 'All proxies failed';
      throw new Error(`Failed to fetch URL. Direct fetch failed (CORS) and all proxies failed: ${errors}`);
    });
  }
}

export async function fetchAndDecompressGz(url: string): Promise<string> {
  const response = await fetchWithCorsFallback(url);
  const arrayBuffer = await response.arrayBuffer();
  const pako = await import('pako');
  const compressed = new Uint8Array(arrayBuffer);
  const decompressed = pako.inflate(compressed, { to: 'string' });
  return decompressed;
}
