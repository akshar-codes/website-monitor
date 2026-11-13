/**
 * Parses and extracts host identity from a monitor's target endpoint.
 *
 * @param {Object} monitor - Monitor record
 * @returns {Object} { host, baseDomain, port, isAvailable }
 */
export const extractEndpointIdentity = (monitor) => {
  if (!monitor || !monitor.url) {
    return {
      host: null,
      baseDomain: null,
      port: null,
      isAvailable: false,
    };
  }

  try {
    const rawUrl =
      monitor.url.startsWith("http://") || monitor.url.startsWith("https://")
        ? monitor.url
        : `http://${monitor.url}`;

    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");

    // Extract base domain (e.g. 'orders.api.internal' -> 'api.internal' or 'api.example.com' -> 'example.com')
    const parts = host.split(".");
    let baseDomain = host;
    if (parts.length >= 2) {
      baseDomain = parts.slice(-2).join(".");
    }

    return {
      host,
      baseDomain,
      port,
      isAvailable: Boolean(host),
    };
  } catch {
    return {
      host: null,
      baseDomain: null,
      port: null,
      isAvailable: false,
    };
  }
};

/**
 * Compares endpoint identities of two services.
 *
 * @param {Object} identityA
 * @param {Object} identityB
 * @returns {{ score: number, maxScore: number, matchType: string, description: string, isAvailable: boolean }}
 */
export const compareEndpointIdentities = (identityA, identityB) => {
  if (!identityA?.isAvailable || !identityB?.isAvailable) {
    return {
      score: 0,
      maxScore: 10,
      matchType: "unavailable",
      description: "Host identity not reliably available for comparison.",
      isAvailable: false,
    };
  }

  // Exact host match
  if (identityA.host === identityB.host) {
    return {
      score: 10,
      maxScore: 10,
      matchType: "exact_host",
      description: `Both services resolve to identical host endpoint "${identityA.host}".`,
      isAvailable: true,
    };
  }

  // Shared base domain (e.g. cluster or private VPC)
  if (
    identityA.baseDomain &&
    identityB.baseDomain &&
    identityA.baseDomain === identityB.baseDomain
  ) {
    return {
      score: 6,
      maxScore: 10,
      matchType: "shared_domain",
      description: `Services reside on shared infrastructure domain "${identityA.baseDomain}".`,
      isAvailable: true,
    };
  }

  return {
    score: 0,
    maxScore: 10,
    matchType: "distinct_hosts",
    description: `Services reside on distinct hosts (${identityA.host} vs ${identityB.host}).`,
    isAvailable: true,
  };
};
