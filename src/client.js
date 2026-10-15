import crypto from "node:crypto";

const BASE = process.env.HOTELBEDS_BASE_URL || "https://api.test.hotelbeds.com";
const BOOKING_API = "/hotel-api/1.0";
const CONTENT_API = "/hotel-content-api/1.0";

function creds() {
  const apiKey = process.env.HOTELBEDS_API_KEY;
  const secret = process.env.HOTELBEDS_SECRET;
  if (!apiKey || !secret) {
    throw new Error(
      "Missing credentials: set HOTELBEDS_API_KEY and HOTELBEDS_SECRET in the environment."
    );
  }
  return { apiKey, secret };
}

// X-Signature = SHA256(apiKey + secret + unixTimestampSeconds), hex. Recomputed per request.
// The same Hotel keypair authenticates both the Booking API and the Content API.
function signedHeaders() {
  const { apiKey, secret } = creds();
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHash("sha256").update(`${apiKey}${secret}${ts}`).digest("hex");
  return { "Api-key": apiKey, "X-Signature": sig, Accept: "application/json" };
}

async function handle(res) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const apiErr = (data && data.error) || {};
    const err = new Error(apiErr.message || `Hotelbeds API error (HTTP ${res.status})`);
    err.httpStatus = res.status;
    err.apiCode = apiErr.code;
    err.body = data;
    throw err;
  }
  return data;
}

// Booking API (POST/GET/DELETE with JSON body). Unchanged signature — booking tools rely on it.
export async function hbRequest(method, path, body) {
  // NOTE: do not set Accept-Encoding manually — Node's fetch (undici) handles gzip.
  const res = await fetch(`${BASE}${BOOKING_API}${path}`, {
    method,
    headers: { ...signedHeaders(), "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return handle(res);
}

// Content API (GET with query params). Arrays are comma-joined per Hotelbeds convention.
export async function hbContentGet(path, params) {
  const url = new URL(`${BASE}${CONTENT_API}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
    }
  }
  const res = await fetch(url, { headers: signedHeaders() });
  return handle(res);
}
