
const INDEX_KEY = "vault-index.json";

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/index") {
      return handleIndex(request, env);
    }

    if (url.pathname === "/api/upload") {
      return handleUpload(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
