import { BUILD_TIME_PHOTOZ_ACCESS_CODE } from "./generated-access-code.js";
const INDEX_KEY = "index.json";

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...corsHeaders(),
      ...(init.headers || {}),
    },
  });
}

function emptyIndex(reason = "") {
  return { memories: [], albums: [], settings: {}, updatedAt: new Date().toISOString(), warning: reason };
}

function normalizeIndex(index) {
  const source = index && typeof index === "object" ? index : {};
  return {
    ...source,
    memories: Array.isArray(source.memories) ? source.memories : [],
    albums: Array.isArray(source.albums) ? source.albums.map((album) => ({
      ...album,
      id: album && album.id ? album.id : `album-${Date.now()}`,
      title: album && album.title ? album.title : "Untitled album",
      memoryIds: Array.isArray(album && album.memoryIds) ? album.memoryIds : [],
      parentId: album && album.parentId ? album.parentId : "",
      excludeFromAll: Boolean(album && album.excludeFromAll),
    })) : [],
    settings: source.settings && typeof source.settings === "object" ? source.settings : {},
    updatedAt: source.updatedAt || new Date().toISOString(),
  };
}

async function readJsonBody(request) {
  try { return await request.json(); } catch (error) { return {}; }
}

async function readStoredText(stored) {
  if (!stored) return "";
  if (typeof stored === "string") return stored;
  if (typeof stored.text === "function") return await stored.text();
  return String(stored || "");
}

function getMediaBucket(env) {
  if (env && env.PHOTOZ_BUCKET && typeof env.PHOTOZ_BUCKET.put === "function") return env.PHOTOZ_BUCKET;
  if (env && env.photoz && typeof env.photoz.put === "function") return env.photoz;
  return null;
}

async function readIndex(env) {
  try {
    if (env && env.PHOTOZ_INDEX && typeof env.PHOTOZ_INDEX.get === "function") {
      const stored = await env.PHOTOZ_INDEX.get(INDEX_KEY, { type: "json" });
      return normalizeIndex(stored || emptyIndex("missing index"));
    }
    const bucket = getMediaBucket(env);
    if (bucket && typeof bucket.get === "function") {
      const stored = await bucket.get(INDEX_KEY);
      if (!stored) return normalizeIndex(emptyIndex("missing index"));
      const text = await readStoredText(stored);
      return normalizeIndex(JSON.parse(text || "{}"));
    }
    return normalizeIndex(emptyIndex("missing binding"));
  } catch (error) {
    return normalizeIndex(emptyIndex(String(error && error.message ? error.message : error)));
  }
}

async function writeIndex(env, index) {
  const normalized = normalizeIndex(index);
  normalized.updatedAt = new Date().toISOString();
  try {
    if (env && env.PHOTOZ_INDEX && typeof env.PHOTOZ_INDEX.put === "function") {
      await env.PHOTOZ_INDEX.put(INDEX_KEY, JSON.stringify(normalized));
    } else {
      const bucket = getMediaBucket(env);
      if (bucket) await bucket.put(INDEX_KEY, JSON.stringify(normalized), { httpMetadata: { contentType: "application/json" } });
    }
  } catch (error) {}
  return normalized;
}

async function handleUpload(request, env) {
  try {
    const form = await request.formData();
    const files = [];
    for (const [name, value] of form.entries()) {
      if (value && typeof value === "object" && "name" in value) {
        const id = `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const key = `uploads/${id}-${value.name || "file"}`;
        const bucket = getMediaBucket(env);
        if (!bucket) return jsonResponse({ ok: false, error: "PHOTOZ_BUCKET_NOT_CONFIGURED", files: [], memories: [] }, { status: 500 });
        let storageUrl = `/api/file/${key}`;
        await bucket.put(key, value.stream(), { httpMetadata: { contentType: value.type || "application/octet-stream" } });
        files.push({
          id,
          title: value.name || "Untitled",
          filename: value.name || "file",
          kind: String(value.type || "").startsWith("video") ? "video" : "image",
          type: value.type || "",
          size: value.size || 0,
          storageKey: key,
          storageUrl,
          previewUrl: storageUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sort: Date.now(),
          albumIds: [],
        });
      }
    }
    return jsonResponse({ ok: true, files, memories: files });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error), files: [], memories: [] });
  }
}

async function handleFile(env, pathname) {
  const key = decodeURIComponent(pathname.replace(/^\/(api\/file|media|thumb)\//, ""));
  const bucket = getMediaBucket(env);
  if (!bucket || typeof bucket.get !== "function") {
    return new Response("Missing bucket", { status: 404, headers: corsHeaders() });
  }
  const object = await bucket.get(key);
  if (!object) return new Response("Not found", { status: 404, headers: corsHeaders() });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata && object.httpMetadata.contentType ? object.httpMetadata.contentType : "application/octet-stream",
      "cache-control": "public, max-age=31536000",
      ...corsHeaders(),
    },
  });
}


function getConfiguredPassword(env) {
  const runtimeValue = String((env && env.PHOTOZ_ACCESS_CODE) || "").trim();
  const buildValue = String(BUILD_TIME_PHOTOZ_ACCESS_CODE || "").trim();
  return runtimeValue || buildValue;
}

async function handleUnlock(request, env) {
  const configured = String(getConfiguredPassword(env) || "").trim();
  let supplied = "";
  try {
    const body = await request.json();
    supplied = String((body && body.password) || "").trim();
  } catch (error) {}

  if (!configured) {
    return jsonResponse({
      ok: false,
      error: "PHOTOZ_ACCESS_CODE_NOT_CONFIGURED",
    }, { status: 500 });
  }

  if (supplied && supplied === configured) {
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "INVALID_ACCESS_CODE" }, { status: 401 });
}


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders() });
    if (url.pathname === "/favicon.ico") return new Response("", { status: 204, headers: corsHeaders() });
    if (url.pathname === "/api/unlock" && request.method === "POST") return handleUnlock(request, env);
    if ((url.pathname === "/api/index" || url.pathname === "/api/load-index") && request.method === "GET") return jsonResponse(await readIndex(env));
    if ((url.pathname === "/api/index" || url.pathname === "/api/save-index") && request.method !== "GET") {
      const body = await readJsonBody(request);
      const index = body && body.memories !== undefined ? body : body.index;
      return jsonResponse(await writeIndex(env, index || emptyIndex("empty save")));
    }
    if (url.pathname === "/api/backup-index") {
      if (request.method === "GET") return jsonResponse(await readIndex(env));
      const body = await readJsonBody(request);
      const index = body && body.memories !== undefined ? body : body.index;
      return jsonResponse(await writeIndex(env, index || emptyIndex("empty backup")));
    }
    if (url.pathname === "/api/upload" && request.method === "POST") return handleUpload(request, env);
    if (url.pathname.startsWith("/api/file/") || url.pathname.startsWith("/media/") || url.pathname.startsWith("/thumb/")) return handleFile(env, url.pathname);
    return new Response("Not found", { status: 404, headers: corsHeaders() });
  },
};
