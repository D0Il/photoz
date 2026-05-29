
const INDEX_KEY = "vault-index.json";
const BACKUP_PREFIX = "index-backups/";
const AUTH_COOKIE = "photoz_access";
const ACCESS_ENV_NAME = "PHOTOZ_ACCESS_CODE";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

function notFound() {
  return json({ error: "not_found" }, 404);
}

function safeKey(key) {
  return String(key || "").replace(/^\/+/, "").replace(/\.\./g, "");
}

function contentTypeFromKey(key) {
  const lower = String(key || "").toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

async function handleHealth(request, env) {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "GET") return notFound();

  const index = await env.photoz.get(INDEX_KEY);
  return json({
    ok: true,
    bucket: "photoz",
    indexFound: Boolean(index),
    checkedAt: new Date().toISOString(),
  });
}

function thumbKeyFromOriginal(key) {
  return "thumbs/" + String(key || "").replace(/^\/+/, "") + ".webp";
}

async function handleThumb(request, env, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") return notFound();

  const key = safeKey(decodeURIComponent(pathname.replace(/^\/thumb\//, "")));
  if (!key) return notFound();

  const thumbKey = thumbKeyFromOriginal(key);
  let object = await env.photoz.get(thumbKey);
  let isThumb = true;

  if (!object) {
    object = await env.photoz.get(key);
    isThumb = false;
  }

  if (!object) return notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.has("content-type")) headers.set("content-type", isThumb ? "image/webp" : contentTypeFromKey(key));
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=604800");

  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(object.body, { headers });
}

async function handleMedia(request, env, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") return notFound();

  const key = safeKey(decodeURIComponent(pathname.replace(/^\/media\//, "")));
  if (!key) return notFound();

  const object = await env.photoz.get(key);
  if (!object) return notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.has("content-type")) headers.set("content-type", contentTypeFromKey(key));
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(object.body, { headers });
}

async function handleIndex(request, env) {
  if (request.method === "OPTIONS") return json({ ok: true });

  if (request.method === "GET") {
    const object = await env.photoz.get(INDEX_KEY);
    if (!object) {
      return json({ version: 1, memories: [], albums: [], savedAt: new Date().toISOString() });
    }
    return new Response(await object.text(), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  if (request.method === "PUT") {
    const body = await request.text();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (error) {
      return json({ error: "invalid_json" }, 400);
    }

    parsed.savedAt = new Date().toISOString();
    await env.photoz.put(INDEX_KEY, JSON.stringify(parsed, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    return json({ ok: true });
  }

  return notFound();
}

async function handleDelete(request, env) {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return notFound();

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "invalid_json" }, 400);
  }

  const key = safeKey(body.key);
  if (!key) return json({ error: "missing_key" }, 400);

  await env.photoz.delete(key);
  await env.photoz.delete(key + ".metadata.json");

  return json({ ok: true, key });
}

async function handleUpload(request, env) {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return notFound();

  const form = await request.formData();
  const file = form.get("file");
  const key = safeKey(form.get("key"));
  const metadataRaw = String(form.get("metadata") || "{}");

  if (!file || !key) {
    return json({ error: "missing_file_or_key" }, 400);
  }

  let metadata = {};
  try {
    metadata = JSON.parse(metadataRaw);
  } catch (error) {
    metadata = {};
  }

  await env.photoz.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
    customMetadata: {
      originalName: metadata.name || file.name || "",
      kind: String(form.get("kind") || ""),
      title: String(form.get("title") || ""),
      lastModified: String(metadata.lastModified || ""),
      signature: String(metadata.signature || ""),
    },
  });

  await env.photoz.put(key + ".metadata.json", JSON.stringify(metadata, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });

  return json({ ok: true, key });
}


async function handleBackupIndex(request, env) {
  if (request.method !== "POST") return notFound();
  const current = await env.photoz.get(INDEX_KEY);
  if (!current) return json({ ok: true, backedUp: false });
  const text = await current.text();
  const key = BACKUP_PREFIX + "vault-index-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
  await env.photoz.put(key, text, {
    httpMetadata: { contentType: "application/json" },
  });
  return json({ ok: true, backedUp: true, key });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/access") {
      return handleAccess(request, env);
    }

    const authError = await requireAuth(request, env);
    if (authError) return authError;

    if (url.pathname === "/api/backup-index") {
      return handleBackupIndex(request, env);
    }

    if (url.pathname === "/api/health") {
      return handleHealth(request, env);
    }

    if (url.pathname.startsWith("/thumb/")) {
      return handleThumb(request, env, url.pathname);
    }

    if (url.pathname.startsWith("/media/")) {
      return handleMedia(request, env, url.pathname);
    }

    if (url.pathname === "/api/index") {
      return handleIndex(request, env);
    }

    if (url.pathname === "/api/upload") {
      return handleUpload(request, env);
    }

    if (url.pathname === "/api/delete") {
      return handleDelete(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
