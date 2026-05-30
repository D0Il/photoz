import { BUILD_TIME_PHOTOZ_ACCESS_CODE } from "./generated-access-code.js";
const INDEX_KEY = "index.json";

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
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
  return { version: 3, memories: [], albums: [], settings: {}, updatedAt: new Date().toISOString(), warning: reason };
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeIndex(index) {
  const source = index && typeof index === "object" ? index : {};
  return {
    ...source,
    version: source.version || 3,
    memories: safeArray(source.memories).map((memory) => {
      const item = memory && typeof memory === "object" ? memory : {};
      return {
        ...item,
        id: item.id || `memory-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: item.title || item.fileName || item.filename || item.name || "Untitled",
        fileName: item.fileName || item.filename || item.name || "",
        kind: item.kind || (String(item.type || item.mimeType || item.metadata?.type || "").startsWith("video") ? "video" : "photo"),
        storageKey: item.storageKey || item.key || "",
        uploadStatus: item.uploadStatus || (item.storageKey ? "r2" : "local"),
        albumIds: safeArray(item.albumIds),
        tags: safeArray(item.tags),
        metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {},
        trashed: Boolean(item.trashed),
        archived: Boolean(item.archived),
        inMirror: Boolean(item.inMirror),
      };
    }),
    albums: safeArray(source.albums).map((album) => ({
      ...(album && typeof album === "object" ? album : {}),
      id: album && album.id ? album.id : `album-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: album && album.title ? album.title : "Untitled album",
      memoryIds: safeArray(album && album.memoryIds),
      parentId: album && album.parentId ? album.parentId : "",
      excludeFromAll: Boolean(album && album.excludeFromAll),
      coverId: album && album.coverId ? album.coverId : null,
    })),
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

function cleanStorageKey(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/")
    .slice(0, 900);
}

function encodeStorageKey(key) {
  return cleanStorageKey(key).split("/").map((part) => encodeURIComponent(part)).join("/");
}

function fileUrlForKey(key) {
  return `/api/file/${encodeStorageKey(key)}`;
}

function safeName(name) {
  return String(name || "file").normalize("NFKD").replace(/[^\w.()\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 140) || "file";
}

function fallbackStorageKey(file, id) {
  const now = new Date();
  return [
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    `${Date.now()}-${id}-${safeName(file && file.name)}`,
  ].join("/");
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
  } catch (error) {
    return { ...normalized, warning: String(error && error.message ? error.message : error) };
  }
  return normalized;
}

function getConfiguredPassword(env) {
  const runtimeValue = String((env && env.PHOTOZ_ACCESS_CODE) || "").trim();
  const buildValue = String(BUILD_TIME_PHOTOZ_ACCESS_CODE || "").trim();
  return runtimeValue || buildValue;
}

async function handleAccess(request, env) {
  const configured = getConfiguredPassword(env);
  if (request.method === "GET") {
    return jsonResponse({ required: Boolean(configured), authorized: !configured });
  }
  const body = await readJsonBody(request);
  const supplied = String((body && (body.password || body.code)) || "").trim();
  if (!configured) return jsonResponse({ ok: false, required: true, authorized: false, error: "PHOTOZ_ACCESS_CODE_NOT_CONFIGURED" }, { status: 500 });
  if (supplied && supplied === configured) return jsonResponse({ ok: true, required: true, authorized: true });
  return jsonResponse({ ok: false, required: true, authorized: false, error: "INVALID_ACCESS_CODE" }, { status: 401 });
}

async function getFormMetadata(form) {
  const raw = form.get("metadata");
  if (!raw) return {};
  try { return JSON.parse(String(raw)); } catch (error) { return {}; }
}

async function handleUpload(request, env) {
  try {
    const form = await request.formData();
    const bucket = getMediaBucket(env);
    if (!bucket) return jsonResponse({ ok: false, error: "PHOTOZ_BUCKET_NOT_CONFIGURED", files: [], memories: [] }, { status: 500 });

    const metadata = await getFormMetadata(form);
    const requestedKeys = [];
    const explicitKeysRaw = form.get("keys");
    if (explicitKeysRaw) {
      try { requestedKeys.push(...safeArray(JSON.parse(String(explicitKeysRaw))).map(cleanStorageKey)); } catch (error) {}
    }
    ["key", "storageKey"].forEach((field) => {
      const value = form.get(field);
      if (value) requestedKeys.push(cleanStorageKey(value));
    });

    const files = [];
    let fileIndex = 0;
    for (const [, value] of form.entries()) {
      if (!value || typeof value !== "object" || !("name" in value)) continue;
      const id = String(form.get("id") || `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const key = cleanStorageKey(requestedKeys[fileIndex] || fallbackStorageKey(value, id));
      fileIndex += 1;
      const type = value.type || metadata.type || "application/octet-stream";
      await bucket.put(key, value.stream(), {
        httpMetadata: {
          contentType: type,
          cacheControl: "public, max-age=31536000",
        },
        customMetadata: {
          originalName: value.name || metadata.name || "file",
          photozId: id,
        },
      });
      const storageUrl = fileUrlForKey(key);
      files.push({
        id,
        title: String(form.get("title") || value.name || metadata.name || "Untitled").replace(/\.[^.]+$/, ""),
        fileName: value.name || metadata.name || "file",
        filename: value.name || metadata.name || "file",
        kind: String(type).startsWith("video") ? "video" : "photo",
        type,
        size: value.size || metadata.size || 0,
        storageKey: key,
        storageUrl,
        previewUrl: storageUrl,
        uploadStatus: "r2",
        metadata: { ...metadata, name: value.name || metadata.name || "file", type, size: value.size || metadata.size || 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sort: Date.now(),
        albumIds: [],
      });
    }
    return jsonResponse({ ok: true, files, memories: files });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error), files: [], memories: [] }, { status: 500 });
  }
}

async function resolveObjectKey(bucket, key) {
  const clean = cleanStorageKey(key);
  if (!bucket || !clean) return "";
  const exact = await bucket.get(clean);
  if (exact) return clean;

  const basename = clean.split("/").pop();
  if (!basename || typeof bucket.list !== "function") return clean;

  const candidatePrefixes = ["uploads/", clean.split("/").slice(0, -1).join("/") + "/"].filter(Boolean);
  for (const prefix of Array.from(new Set(candidatePrefixes))) {
    try {
      let cursor = undefined;
      do {
        const listed = await bucket.list({ prefix, cursor, limit: 1000 });
        const found = safeArray(listed.objects).find((object) => {
          const objectKey = String(object.key || "");
          return objectKey === clean || objectKey.endsWith("/" + basename) || objectKey.endsWith("-" + basename);
        });
        if (found && found.key) return found.key;
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);
    } catch (error) {}
  }
  return clean;
}

async function listAllObjects(bucket) {
  const objects = [];
  if (!bucket || typeof bucket.list !== "function") return objects;
  let cursor = undefined;
  do {
    const listed = await bucket.list({ cursor, limit: 1000 });
    safeArray(listed.objects).forEach((object) => {
      const key = cleanStorageKey(object && object.key);
      if (!key || key === INDEX_KEY || key.endsWith("/")) return;
      objects.push({
        key,
        size: Number(object.size || 0),
        uploaded: object.uploaded ? new Date(object.uploaded).toISOString() : "",
        etag: object.etag || "",
      });
    });
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return objects;
}

function basenameOf(key) {
  return cleanStorageKey(key).split("/").pop() || "";
}

function storageKeyFromRecord(memory) {
  const item = memory && typeof memory === "object" ? memory : {};
  const direct = cleanStorageKey(item.storageKey || item.key || item.objectKey || "");
  if (direct) return direct;
  const url = String(item.storageUrl || item.previewUrl || item.url || "");
  const match = url.match(/\/(?:api\/file|media|thumb)\/(.+)$/);
  if (match && match[1]) {
    try { return cleanStorageKey(decodeURIComponent(match[1].split(/[?#]/)[0])); } catch (error) { return cleanStorageKey(match[1].split(/[?#]/)[0]); }
  }
  return "";
}

function bestObjectForMemory(memory, objects) {
  const wanted = storageKeyFromRecord(memory);
  if (wanted) {
    const exact = objects.find((object) => object.key === wanted);
    if (exact) return exact;
  }
  const names = Array.from(new Set([
    basenameOf(wanted),
    safeName(memory && (memory.fileName || memory.filename || memory.name || memory.title)),
    safeName(memory && memory.metadata && memory.metadata.name),
  ].filter(Boolean)));
  const id = String(memory && memory.id || "").toLowerCase();
  const byName = objects.find((object) => names.some((name) => object.key.endsWith("/" + name) || object.key.endsWith("-" + name) || basenameOf(object.key) === name));
  if (byName) return byName;
  if (id) {
    const byId = objects.find((object) => object.key.toLowerCase().includes(id));
    if (byId) return byId;
  }
  return null;
}

function memoryFromObject(object) {
  const fileName = basenameOf(object.key);
  const isVideo = /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(fileName);
  const createdAt = object.uploaded || new Date().toISOString();
  return {
    id: "r2-" + object.key.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80),
    title: fileName.replace(/\.[^.]+$/, "") || fileName || "Recovered file",
    fileName,
    filename: fileName,
    kind: isVideo ? "video" : "photo",
    type: isVideo ? "video/mp4" : "image/jpeg",
    size: Number(object.size || 0),
    storageKey: object.key,
    storageUrl: fileUrlForKey(object.key),
    previewUrl: fileUrlForKey(object.key),
    uploadStatus: "r2",
    recovered: true,
    albumIds: ["unassigned"],
    tags: [],
    metadata: { name: fileName, size: Number(object.size || 0), recoveredFromR2: true },
    createdAt,
    updatedAt: new Date().toISOString(),
    sort: Date.parse(createdAt) || Date.now(),
  };
}

function repairIndexAgainstObjects(index, objects) {
  const objectByKey = new Map(objects.map((object) => [object.key, object]));
  const usedKeys = new Set();
  const source = normalizeIndex(index);
  const repaired = [];
  let repairedRecords = 0;
  let missingRecords = 0;

  safeArray(source.memories).forEach((memory) => {
    const match = bestObjectForMemory(memory, objects);
    if (!match) {
      missingRecords += 1;
      repaired.push({
        ...memory,
        storageKey: storageKeyFromRecord(memory),
        uploadStatus: "missing",
        missing: true,
        storageUrl: "",
        previewUrl: "",
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    usedKeys.add(match.key);
    const priorKey = storageKeyFromRecord(memory);
    if (priorKey !== match.key || memory.uploadStatus !== "r2" || memory.previewUrl !== fileUrlForKey(match.key)) repairedRecords += 1;
    repaired.push({
      ...memory,
      fileName: memory.fileName || memory.filename || basenameOf(match.key),
      filename: memory.filename || memory.fileName || basenameOf(match.key),
      storageKey: match.key,
      storageUrl: fileUrlForKey(match.key),
      previewUrl: fileUrlForKey(match.key),
      uploadStatus: "r2",
      missing: false,
      size: Number(memory.size || match.size || 0),
      metadata: { ...(memory.metadata || {}), size: Number((memory.metadata && memory.metadata.size) || memory.size || match.size || 0), repairedFromKey: priorKey && priorKey !== match.key ? priorKey : undefined },
      updatedAt: new Date().toISOString(),
    });
  });

  const orphanObjects = objects.filter((object) => !usedKeys.has(object.key));
  const recoveredMemories = orphanObjects.map(memoryFromObject);
  const memories = repaired.concat(recoveredMemories);
  const validIds = new Set(memories.map((memory) => String(memory.id)));
  const albums = safeArray(source.albums).map((album) => ({
    ...album,
    memoryIds: safeArray(album.memoryIds).filter((id) => validIds.has(String(id))),
  }));
  let unassigned = albums.find((album) => String(album.id) === "unassigned");
  if (!unassigned) {
    unassigned = { id: "unassigned", title: "Unassigned", memoryIds: [], parentId: "", excludeFromAll: false };
    albums.push(unassigned);
  }
  const assigned = new Set();
  albums.forEach((album) => safeArray(album.memoryIds).forEach((id) => assigned.add(String(id))));
  unassigned.memoryIds = Array.from(new Set(safeArray(unassigned.memoryIds).concat(memories.filter((memory) => !assigned.has(String(memory.id))).map((memory) => memory.id))));

  return {
    index: normalizeIndex({ ...source, memories, albums, updatedAt: new Date().toISOString() }),
    report: {
      checkedRecords: safeArray(source.memories).length,
      r2Objects: objects.length,
      repairedRecords,
      missingRecords,
      recoveredOrphans: recoveredMemories.length,
      guaranteedDisplayable: missingRecords === 0,
      repairedAt: new Date().toISOString(),
    },
  };
}

async function handleFileAudit(env, repair = false) {
  const bucket = getMediaBucket(env);
  if (!bucket) return jsonResponse({ ok: false, error: "PHOTOZ_BUCKET_NOT_CONFIGURED" }, { status: 500 });
  const index = await readIndex(env);
  const objects = await listAllObjects(bucket);
  const result = repairIndexAgainstObjects(index, objects);
  if (repair) await writeIndex(env, result.index);
  return jsonResponse({ ok: true, repaired: Boolean(repair), ...result.report, indexMemories: safeArray(result.index.memories).length, indexAlbums: safeArray(result.index.albums).length });
}

async function handleFile(env, pathname, method) {
  const key = decodeURIComponent(pathname.replace(/^\/(api\/file|media|thumb)\//, ""));
  const bucket = getMediaBucket(env);
  if (!bucket || typeof bucket.get !== "function") {
    return new Response("Missing bucket", { status: 404, headers: corsHeaders() });
  }
  const resolvedKey = await resolveObjectKey(bucket, key);
  const object = await bucket.get(resolvedKey);
  if (!object) return new Response("Not found", { status: 404, headers: corsHeaders() });
  const headers = {
    "content-type": object.httpMetadata && object.httpMetadata.contentType ? object.httpMetadata.contentType : "application/octet-stream",
    "cache-control": "public, max-age=31536000",
    "etag": object.etag || `\"${resolvedKey}\"`,
    ...corsHeaders(),
  };
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(object.body, { headers });
}

async function handleDelete(request, env) {
  const bucket = getMediaBucket(env);
  if (!bucket || typeof bucket.delete !== "function") return jsonResponse({ ok: false, error: "PHOTOZ_BUCKET_NOT_CONFIGURED" }, { status: 500 });
  const body = await readJsonBody(request);
  const key = cleanStorageKey(body && (body.key || body.storageKey));
  if (!key) return jsonResponse({ ok: false, error: "MISSING_STORAGE_KEY" }, { status: 400 });
  const resolvedKey = await resolveObjectKey(bucket, key);
  try {
    await bucket.delete(resolvedKey);
    return jsonResponse({ ok: true, key, deletedKey: resolvedKey });
  } catch (error) {
    return jsonResponse({ ok: false, key, error: String(error && error.message ? error.message : error) }, { status: 500 });
  }
}

async function handleHealth(env) {
  const bucket = getMediaBucket(env);
  const index = await readIndex(env);
  return jsonResponse({
    ok: Boolean(bucket),
    bucket: Boolean(bucket),
    indexMemories: safeArray(index.memories).length,
    indexAlbums: safeArray(index.albums).length,
    accessConfigured: Boolean(getConfiguredPassword(env)),
    routes: ["/api/index", "/api/upload", "/api/file/:key", "/api/delete", "/api/file-audit", "/api/repair-files", "/api/health", "/api/access", "/api/auth"],
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders() });
    if (url.pathname === "/favicon.ico") return new Response("", { status: 204, headers: corsHeaders() });
    if ((url.pathname === "/api/unlock" || url.pathname === "/api/access" || url.pathname === "/api/auth") && (request.method === "GET" || request.method === "POST")) return handleAccess(request, env);
    if (url.pathname === "/api/health") return handleHealth(env);
    if (url.pathname === "/api/file-audit") return handleFileAudit(env, false);
    if (url.pathname === "/api/repair-files" && (request.method === "POST" || request.method === "GET")) return handleFileAudit(env, true);
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
    if (url.pathname === "/api/delete" && (request.method === "POST" || request.method === "DELETE")) return handleDelete(request, env);
    if (url.pathname.startsWith("/api/file/") || url.pathname.startsWith("/media/") || url.pathname.startsWith("/thumb/")) return handleFile(env, url.pathname, request.method);
    return new Response("Not found", { status: 404, headers: corsHeaders() });
  },
};
