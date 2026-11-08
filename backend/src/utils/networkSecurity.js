import dns from "node:dns/promises";
import { isIP } from "node:net";

export const cleanHostname = (hostname) =>
  String(hostname || "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();

const ipv4IsPublic = (address) => {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [a, b, c] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 &&
      (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2))) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a === 255
  );
};

const ipv6IsPublic = (address) => {
  const normalized = address.toLowerCase().split("%", 1)[0];
  if (normalized === "::" || normalized === "::1") return false;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice(7);
    if (isIP(mapped) === 4) return ipv4IsPublic(mapped);
    const hex = mapped.split(":").join("");
    if (hex.length === 8) {
      const v4 = [0, 2, 4, 6]
        .map((i) => parseInt(hex.slice(i, i + 2), 16))
        .join(".");
      return ipv4IsPublic(v4);
    }
    return false;
  }
  const first = parseInt(normalized.split(":")[0] || "0", 16);
  return !(
    (first & 0xfe00) === 0xfc00 || // unique-local
    (first & 0xffc0) === 0xfe80 || // link-local
    (first & 0xff00) === 0xff00 || // multicast
    (first & 0xe000) !== 0x2000 || // outside global-unicast 2000::/3
    (first === 0x2001 &&
      parseInt(normalized.split(":")[1] || "0", 16) <= 0x01ff) ||
    normalized.startsWith("2001:db8:")
  );
};

export const isPublicAddress = (address) => {
  const family = isIP(address);
  return family === 4
    ? ipv4IsPublic(address)
    : family === 6
      ? ipv6IsPublic(address)
      : false;
};

export const resolvePublicAddresses = async (
  hostname,
  timeoutMs = 10000,
  signal = null,
) => {
  const host = cleanHostname(hostname);
  let addresses;
  const family = isIP(host);
  if (family) {
    addresses = [{ address: host, family }];
  } else {
    const lookupOptions = { all: true, verbatim: true };
    if (signal) lookupOptions.signal = signal;
    addresses = await dns.lookup(host, lookupOptions);
  }

  if (!addresses.length) {
    const error = new Error(`getaddrinfo ENOTFOUND ${host}`);
    error.code = "ENOTFOUND";
    throw error;
  }

  // Reject if any address is non-public (strictly preventing mixed public/private results)
  if (addresses.some(({ address }) => !isPublicAddress(address))) {
    const error = new Error(
      "Destination resolves to a restricted network address",
    );
    error.code = "ERR_BLOCKED_ADDRESS";
    throw error;
  }

  return addresses;
};

export const createPinnedLookup = (addresses) => {
  let addressIndex = 0;
  return (hostname, options, callback) => {
    let cb = callback;
    let opts = options;
    if (typeof opts === "function") {
      cb = opts;
      opts = {};
    }

    let filtered = addresses;
    if (opts?.family === 4 || opts?.family === 6) {
      filtered = addresses.filter((item) => item.family === opts.family);
    }

    if (!filtered.length) {
      const err = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
      err.code = "ENOTFOUND";
      return cb(err);
    }

    if (opts?.all) {
      return cb(null, filtered);
    }

    const selected = filtered[addressIndex++ % filtered.length];
    return cb(null, selected.address, selected.family);
  };
};

export const withTimeout = (promise, timeoutMs, onTimeout = null) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (typeof onTimeout === "function") {
        try {
          onTimeout();
        } catch {
          // ignore cleanup errors
        }
      }
      reject(
        Object.assign(new Error("Request timed out"), { code: "ETIMEDOUT" }),
      );
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
