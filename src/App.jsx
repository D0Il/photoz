
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Eye, Images, Search, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const UNASSIGNED_ALBUM_ID = "unassigned";
const INITIAL_ALBUMS = [
  { id: UNASSIGNED_ALBUM_ID, title: "UNASSIGNED", memoryIds: [] },
  { id: "star", title: "★", memoryIds: [] },
  { id: "videos", title: "VIDEOS", memoryIds: [] },
];

const PAGES = [
  { id: "albums", icon: Images },
  { id: "mirror", icon: Eye },
  { id: "search", icon: Search },
];

const ARCHIVE_VIEWS = ["albums", "years", "months", "eras"];
const SEARCH_FILTERS = ["all", "photos", "videos", "starred", "mirror", "trash", "me", "tagged", "takeout", "archive", "needs-file"];
const PRIMARY_SEARCH_FILTERS = ["all", "photos", "videos", "starred", "mirror", "trash"];
const ADVANCED_SEARCH_FILTERS = ["me", "tagged", "takeout", "archive", "needs-file"];
const SORT_OPTIONS = ["newest", "oldest", "title", "status", "largest", "smallest", "rating"];
const GRID_SIZES = ["compact", "normal", "large"];
const ALBUM_SORT_OPTIONS = ["recent", "title", "count", "size"];
const APP_VERSION = "2026.05.29-stabilize-simplify";
const INDEX_SCHEMA_VERSION = 3;
const MEDIA_BASE = "/media";
const MAX_PARALLEL_UPLOADS = 3;



function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeMemoryRecord(memory) {
  const source = memory && typeof memory === "object" ? memory : {};
  return {
    ...source,
    id: source.id || ("memory-" + Date.now() + "-" + Math.random().toString(36).slice(2)),
    title: source.title || source.name || source.filename || "Untitled",
    kind: source.kind || (String(source.type || "").startsWith("video") ? "video" : "image"),
    albumIds: safeArray(source.albumIds),
  };
}

function normalizeAlbumRecord(album) {
  const source = album && typeof album === "object" ? album : {};
  return {
    ...source,
    id: source.id || ("album-" + Date.now() + "-" + Math.random().toString(36).slice(2)),
    title: source.title || "Untitled album",
    description: source.description || "",
    memoryIds: safeArray(source.memoryIds),
    parentId: source.parentId || "",
    excludeFromAll: Boolean(source.excludeFromAll),
  };
}

function normalizeVaultIndex(index) {
  const source = index && typeof index === "object" ? index : {};
  return {
    ...source,
    memories: safeArray(source.memories).map(normalizeMemoryRecord),
    albums: safeArray(source.albums).map(normalizeAlbumRecord),
    settings: source.settings && typeof source.settings === "object" ? source.settings : {},
    updatedAt: source.updatedAt || new Date().toISOString(),
  };
}

function displayShortcutSymbol(value) {
  const text = String(value || "").toLowerCase();
  if (text === "starred" || text === "star") return "★";
  if (text === "trash" || text === "trashed") return "⌫";
  if (text === "archive" || text === "archived" || text === "hidden") return "—";
  if (text === "unassigned") return "•";
  if (text === "all") return "All";
  return "";
}

function systemShortcutLabel(value) {
  const text = String(value || "").toLowerCase();
  if (text === "starred" || text === "star") return "★";
  if (text === "all") return "All";
  if (text === "archive" || text === "archived") return "Hidden";
  if (text === "trash" || text === "trashed") return "Trash";
  if (text === "unassigned") return "Unassigned";
  if (text === "mirror") return "Mirror";
  return up(value);
}

function archiveViewLabel(value) {
  if (value === "albums" || value === "albums") return "ALBUMS";
  return up(value);
}

function filterLabel(value) {
  if (value === "starred") return "★";
  if (value === "archive") return "Hidden";
  if (value === "needs-file") return "Reselect";
  return up(value);
}

function cleanSystemLabel(value) {
  const text = String(value || "").toLowerCase();
  if (text === "starred" || text === "star" || text === "★" || text === "virtual-starred") return "★";
  if (text === "archived" || text === "archive" || text === "hidden" || text === "virtual-archived") return "Hidden";
  if (text === "trash" || text === "trashed" || text === "virtual-trash") return "Trash";
  if (text === "all" || text === "virtual-all") return "All";
  if (text === "unassigned" || text === "virtual-unassigned") return "Unassigned";
  if (text === "videos" || text === "virtual-videos") return "Videos";
  return up(value);
}

function up(value) {
  return String(value || "").toUpperCase();
}

function cls() {
  return Array.prototype.slice.call(arguments).filter(Boolean).join(" ");
}

function newest(items) {
  return items.slice().sort(function (a, b) {
    return (b.sort || 0) - (a.sort || 0);
  });
}

function sortMemories(items, sortMode) {
  items = safeArray(items);

  const mode = sortMode || "newest";
  return items.slice().sort(function (a, b) {
    if (mode === "oldest") return (a.sort || 0) - (b.sort || 0);
    if (mode === "title") return String(a.title || "").localeCompare(String(b.title || ""));
    if (mode === "status") return String(a.uploadStatus || "").localeCompare(String(b.uploadStatus || ""));
    if (mode === "largest") return fileSizeBytes(b) - fileSizeBytes(a);
    if (mode === "smallest") return fileSizeBytes(a) - fileSizeBytes(b);
    if (mode === "rating") return normalizeRating(b.rating) - normalizeRating(a.rating);
    return (b.sort || 0) - (a.sort || 0);
  });
}

function memorySignature(memory) {
  if (memory && memory.metadata && memory.metadata.signature) return memory.metadata.signature;
  return [
    memory.fileName || "",
    memory.metadata && memory.metadata.size ? memory.metadata.size : "",
    memory.metadata && memory.metadata.lastModified ? memory.metadata.lastModified : "",
    memory.metadata && memory.metadata.type ? memory.metadata.type : "",
    memory.storageKey ? String(memory.storageKey).split("/").pop() : "",
  ].join("::");
}

function starMap(albums) {
  const starred = {};
  const album = albums.find(function (item) { return item.id === "star"; });
  (album ? album.memoryIds : []).forEach(function (id) { starred[id] = true; });
  return starred;
}

function duplicateGroupTitle(group) {
  const first = group && group[0];
  if (!first) return "DUPLICATE GROUP";
  const size = first.metadata && first.metadata.size ? formatBytes(first.metadata.size) : "UNKNOWN SIZE";
  return (first.fileName || first.title || "FILE") + " / " + size;
}

function duplicateGroups(memories) {
  const map = {};
  memories.forEach(function (memory) {
    const key = memorySignature(memory);
    if (!key || key === "::") return;
    if (!map[key]) map[key] = [];
    map[key].push(memory);
  });
  return Object.keys(map).map(function (key) { return map[key]; }).filter(function (group) { return group.length > 1; });
}

function albumCoverMemory(album, memories) {
  album = normalizeAlbumRecord(album);
  memories = safeArray(memories).map(normalizeMemoryRecord);

  if (album.coverId) {
    const cover = memories.find(function (memory) { return memory.id === album.coverId; });
    if (cover) return cover;
  }
  const firstId = (album.memoryIds || [])[0];
  return memories.find(function (memory) { return memory.id === firstId; });
}

function safeName(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function fileSignature(file) {
  return [file.name || "", file.size || 0, file.lastModified || 0].join("::");
}

function objectUrl(file) {
  if (typeof URL === "undefined") return "";
  if (typeof URL.createObjectURL !== "function") return "";
  if (typeof Blob === "undefined") return "";
  return file instanceof Blob ? URL.createObjectURL(file) : "";
}

function fileMeta(file, modified) {
  return {
    name: file.name || "",
    type: file.type || "",
    size: typeof file.size === "number" ? file.size : 0,
    lastModified: file.lastModified || 0,
    lastModifiedISO: modified.toISOString(),
    webkitRelativePath: file.webkitRelativePath || "",
    source: "browser-file-input",
    preserveEmbeddedMetadata: true,
    originalFileStoredUnmodified: true,
    signature: fileSignature(file),
  };
}

function sortFromDateText(value, fallback) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback || 0;
  return Number(String(parsed.getFullYear()) + String(parsed.getMonth() + 1).padStart(2, "0") + String(parsed.getDate()).padStart(2, "0"));
}

function monthFromDateText(value, fallback) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback || "Unassigned";
  return parsed.toLocaleString("en", { month: "long", year: "numeric" });
}

function yearFromDateText(value, fallback) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback || "Unassigned";
  return String(parsed.getFullYear());
}

function makeKey(file, index, modified) {
  return [
    modified.getFullYear(),
    String(modified.getMonth() + 1).padStart(2, "0"),
    String(Date.now()) + "-" + index + "-" + safeName(file.name),
  ].join("/");
}

function fromFile(file, index) {
  const modified = file.lastModified ? new Date(file.lastModified) : new Date();
  const year = String(modified.getFullYear());
  const month = modified.toLocaleString("en", { month: "long", year: "numeric" });
  const kind = file.type && file.type.indexOf("video") === 0 ? "video" : "photo";
  const title = (file.name || "File").replace(/\.[^.]+$/, "");
  const key = makeKey(file, index, modified);

  return {
    id: Date.now() + index + Math.floor(Math.random() * 999999),
    title,
    date: modified.toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" }),
    sort: Number(year + String(modified.getMonth() + 1).padStart(2, "0") + String(modified.getDate()).padStart(2, "0")),
    year,
    month,
    era: "Unassigned",
    kind,
    fileName: file.name || "",
    previewUrl: objectUrl(file),
    storageBase: MEDIA_BASE,
    storageKey: key,
    storageUrl: MEDIA_BASE + "/" + key,
    previewUrl: "/thumb/" + key,
    uploadStatus: "queued",
    metadata: fileMeta(file, modified),
    tags: [],
    caption: "",
    location: "",
    event: "",
    rating: 0,
    label: "",
    review: false,
    private: false,
    isMe: false,
    inMirror: false,
    archived: false,
    trashed: false,
    deletedAt: "",
    updatedAt: "",
  };
}

function pageItems(page, memories) {
  return newest(memories);
}

function groupBy(mode, items) {
  memories = safeArray(memories).map(normalizeMemoryRecord);

  memories = safeArray(memories);

  const key = mode === "months" ? "month" : mode === "eras" ? "era" : "year";
  const groups = {};
  newest(items).forEach(function (memory) {
    const value = memory[key] || "Unassigned";
    if (!groups[value]) groups[value] = [];
    groups[value].push(memory);
  });

  return newest(Object.keys(groups).map(function (title) {
    return {
      id: mode + "-" + title,
      title,
      items: groups[title],
      sort: groups[title][0] ? groups[title][0].sort : 0,
    };
  }));
}

function sortAlbumGroups(groups, mode) {
  const sortMode = mode || "recent";
  return groups.slice().sort(function (a, b) {
    if (a.virtual !== b.virtual) return a.virtual ? -1 : 1;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sortMode === "title") return String(a.title || "").localeCompare(String(b.title || ""));
    if (sortMode === "count") return (b.items || []).length - (a.items || []).length;
    if (sortMode === "size") return albumSizeBytes(b.items || []) - albumSizeBytes(a.items || []);
    return (b.sort || 0) - (a.sort || 0);
  });
}

function albumParentId(album) {
  return album && album.parentId ? String(album.parentId) : "";
}

function albumMemoryIds(album) {
  album = normalizeAlbumRecord(album);

  return Array.from(new Set(safeArray(album && album.memoryIds).filter(Boolean)));
}

function albumById(albums, id) {
  albums = safeArray(albums).map(normalizeAlbumRecord);

  return safeArray(albums).find(function (album) { return String(album.id) === String(id); }) || null;
}

function albumChildIds(albums, parentId) {
  albums = safeArray(albums).map(normalizeAlbumRecord);

  const parent = String(parentId || "");
  return safeArray(albums)
    .filter(function (album) { return albumParentId(album) === parent; })
    .map(function (album) { return String(album.id); });
}

function albumDescendantIds(albums, rootId) {
  albums = safeArray(albums).map(normalizeAlbumRecord);

  const all = safeArray(albums);
  const found = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    all.forEach(function (album) {
      const id = String(album.id || "");
      if (!id || found.has(id)) return;
      const parent = albumParentId(album);
      if (parent === String(rootId || "") || found.has(parent)) {
        found.add(id);
        changed = true;
      }
    });
  }
  return found;
}

function albumTreeIds(albums, rootId) {
  const ids = albumDescendantIds(albums, rootId);
  if (rootId) ids.add(String(rootId));
  return ids;
}

function albumsExcludedFromAll(albums) {
  const excluded = new Set();
  safeArray(albums).forEach(function (album) {
    if (!album.excludeFromAll) return;
    albumTreeIds(albums, album.id).forEach(function (id) { excluded.add(id); });
  });
  return excluded;
}

function memoryIsInAlbumTree(memory, albums, rootId) {
  const ids = albumTreeIds(albums, rootId);
  return safeArray(albums).some(function (album) {
    return ids.has(String(album.id)) && albumMemoryIds(album).indexOf(memory.id) !== -1;
  });
}

function memoryExcludedFromAll(memory, albums) {
  const excluded = albumsExcludedFromAll(albums);
  if (!excluded.size) return false;
  return safeArray(albums).some(function (album) {
    return excluded.has(String(album.id)) && albumMemoryIds(album).indexOf(memory.id) !== -1;
  });
}

function visibleAllMemories(memories, albums) {
  return newest(safeArray(memories).filter(function (memory) {
    return !memory.inMirror && !memory.archived && !memory.trashed && !memoryExcludedFromAll(memory, albums);
  }));
}

function directAlbumMemories(albums, memories, albumId) {
  const album = albumById(albums, albumId);
  if (!album) return [];
  const ids = albumMemoryIds(album);
  return newest(ids.map(function (id) {
    return safeArray(memories).find(function (memory) { return memory.id === id && !memory.trashed; });
  }).filter(Boolean));
}

function isSystemAlbumGroup(group) {
  const id = String((group && (group.id || group.sourceId)) || "").toLowerCase();
  const title = String((group && group.title) || "").toLowerCase();
  return Boolean(group && group.virtual) ||
    id === "all" ||
    id === "virtual-all" ||
    id === "star" ||
    id === "starred" ||
    id === "virtual-starred" ||
    id === "archive" ||
    id === "archived" ||
    id === "virtual-archived" ||
    id === "trash" ||
    id === "trashed" ||
    id === "virtual-trash" ||
    id === "unassigned" ||
    id === "virtual-unassigned" ||
    id === "videos" ||
    id === "virtual-videos" ||
    title === "all" ||
    title === "star" ||
    title === "starred" ||
    title === "archive" ||
    title === "archived" ||
    title === "hidden" ||
    title === "trash" ||
    title === "unassigned" ||
    title === "videos" ||
    title === "★";
}

function virtualAlbumGroups(albums, memories) {
  albums = safeArray(albums).map(normalizeAlbumRecord);
  memories = safeArray(memories).map(normalizeMemoryRecord);

  albums = safeArray(albums);
  memories = safeArray(memories);

  const all = visibleAllMemories(memories, albums);
  const archived = newest(memories.filter(function (memory) { return Boolean(memory.archived) && !memory.trashed; }));
  const trash = newest(memories.filter(function (memory) { return Boolean(memory.trashed); }));
  const starredAlbum = albums.find(function (album) { return album.id === "star"; });
  const starredItems = starredAlbum ? newest(starredAlbum.memoryIds.map(function (id) {
    return memories.find(function (memory) { return memory.id === id && !memoryExcludedFromAll(memory, albums); });
  }).filter(Boolean)) : [];
  const unassignedAlbum = albums.find(function (album) { return album.id === UNASSIGNED_ALBUM_ID; });
  const unassigned = unassignedAlbum ? newest(albumMemoryIds(unassignedAlbum).map(function (id) {
    return memories.find(function (memory) { return memory.id === id && !memory.trashed && !memoryExcludedFromAll(memory, albums); });
  }).filter(Boolean)) : [];
  const videos = all.filter(function (memory) { return memory.kind === "video"; });

  return [
    { id: "virtual-all", sourceId: "virtual-all", title: "ALL", items: all, sort: all[0] ? all[0].sort : 0, virtual: true },
    { id: "virtual-starred", sourceId: "star", title: "STARRED", items: starredItems, sort: starredItems[0] ? starredItems[0].sort : 0, virtual: true },
    { id: "virtual-archived", sourceId: "virtual-archived", title: "ARCHIVED", items: archived, sort: archived[0] ? archived[0].sort : 0, virtual: true },
    { id: "virtual-trash", sourceId: "virtual-trash", title: "TRASH", items: trash, sort: trash[0] ? trash[0].sort : 0, virtual: true },
    { id: "virtual-unassigned", sourceId: UNASSIGNED_ALBUM_ID, title: "UNASSIGNED", items: unassigned, sort: unassigned[0] ? unassigned[0].sort : 0, virtual: true },
    { id: "virtual-videos", sourceId: "virtual-videos", title: "VIDEOS", items: videos, sort: videos[0] ? videos[0].sort : 0, virtual: true },
  ];
}

function albumGroups(albums, memories, parentId) {
  albums = safeArray(albums).map(normalizeAlbumRecord);
  memories = safeArray(memories).map(normalizeMemoryRecord);

  albums = safeArray(albums);
  memories = safeArray(memories);
  const parent = String(parentId || "");

  return albums.filter(function (album) {
    const groupLike = { id: album.id, sourceId: album.id, title: album.title };
    return albumParentId(album) === parent && !isSystemAlbumGroup(groupLike);
  }).map(function (album) {
    const items = newest(albumMemoryIds(album).map(function (id) {
      return memories.find(function (memory) {
        return memory.id === id && !memory.trashed;
      });
    }).filter(Boolean));
    const cover = albumCoverMemory(album, memories);
    const childAlbums = albums.filter(function (child) { return albumParentId(child) === String(album.id); });

    return {
      id: "album-" + album.id,
      sourceId: album.id,
      title: album.title,
      description: album.description || "",
      items,
      coverId: album.coverId || null,
      cover,
      childAlbums,
      childCount: childAlbums.length,
      sort: cover ? cover.sort : items[0] ? items[0].sort : 0,
      pinned: Boolean(album.pinned),
      locked: Boolean(album.locked),
      parentId: albumParentId(album),
      excludeFromAll: Boolean(album.excludeFromAll),
    };
  }).sort(function (a, b) {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.sort || 0) - (a.sort || 0);
  });
}

function ensureCoreAlbums(albums) {
  albums = safeArray(albums).map(normalizeAlbumRecord);

  const byId = {};
  albums.forEach(function (album) {
    byId[album.id] = album;
  });

  const output = [];
  INITIAL_ALBUMS.forEach(function (album) {
    output.push(byId[album.id] ? { ...byId[album.id] } : { ...album, memoryIds: [] });
  });

  albums.forEach(function (album) {
    if (!byId[album.id]) return;
    if (!INITIAL_ALBUMS.some(function (core) { return core.id === album.id; })) {
      output.push({ ...album });
    }
  });

  return output;
}

function memoryHasHomeAlbum(memory, albums) {
  if (memory && memory.inMirror) return true;
  return albums.some(function (album) {
    if (album.id === "star") return false;
    return (album.memoryIds || []).indexOf(memory.id) !== -1;
  });
}

function ensureAlbumCoverage(memories, albums) {
  memories = safeArray(memories).map(normalizeMemoryRecord);
  albums = safeArray(albums).map(normalizeAlbumRecord);

  memories = safeArray(memories);
  albums = safeArray(albums);

  const cleanAlbums = ensureCoreAlbums(albums).map(function (album) {
    return { ...album, memoryIds: Array.from(new Set(album.memoryIds || [])) };
  });

  const unassigned = cleanAlbums.find(function (album) {
    return album.id === UNASSIGNED_ALBUM_ID;
  });

  memories.forEach(function (memory) {
    if (!memoryHasHomeAlbum(memory, cleanAlbums)) {
      unassigned.memoryIds.push(memory.id);
    }
  });

  unassigned.memoryIds = Array.from(new Set(unassigned.memoryIds));
  return cleanAlbums;
}

function removeMemoryFromAlbum(albums, albumId, memoryId) {
  return albums.filter(function (album) {
    const groupLike = { id: album.id, sourceId: album.id, title: album.title };
    return !isSystemAlbumGroup(groupLike);
  }).map(function (album) {
    if (album.id !== albumId) return album;
    return { ...album, memoryIds: (album.memoryIds || []).filter(function (id) { return id !== memoryId; }) };
  });
}

function addMemoryToAlbum(albums, albumId, memoryId) {
  return albums.map(function (album) {
    if (album.id !== albumId) return album;
    return { ...album, memoryIds: Array.from(new Set((album.memoryIds || []).concat([memoryId]))) };
  });
}

function albumHasMemory(albums, albumId, memoryId) {
  const album = albums.find(function (item) {
    return item.id === albumId;
  });
  return album ? (album.memoryIds || []).indexOf(memoryId) !== -1 : false;
}

function mirrorItems(memories) {
  memories = safeArray(memories).map(normalizeMemoryRecord);

  memories = safeArray(memories);

  return newest(memories.filter(function (memory) {
    return !memory.trashed && (Boolean(memory.inMirror) || Boolean(memory.isMe));
  }));
}


function dateValue(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function albumTitleExists(albums, title, exceptId) {
  albums = safeArray(albums).map(normalizeAlbumRecord);

  const clean = String(title || "").trim().toLowerCase();
  if (!clean) return false;
  return albums.some(function (album) {
    return album.id !== exceptId && String(album.title || "").trim().toLowerCase() === clean;
  });
}

function normalizeRating(value) {
  const rating = Number(value || 0);
  if (!Number.isFinite(rating)) return 0;
  return Math.max(0, Math.min(5, Math.round(rating)));
}

function normalizeLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map(function (tag) { return tag.trim().toLowerCase(); })
    .filter(Boolean)
    .filter(function (tag, index, list) { return list.indexOf(tag) === index; });
}

function formatTags(tags) {
  return (Array.isArray(tags) ? tags : []).join(", ");
}

function fileSizeBytes(memory) {
  const direct = memory && memory.metadata ? Number(memory.metadata.size || 0) : 0;
  return Number.isFinite(direct) ? direct : 0;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024 * 1024) return (value / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + " MB";
  if (value >= 1024) return (value / 1024).toFixed(1) + " KB";
  return value + " B";
}

function albumSizeBytes(items) {
  return (items || []).reduce(function (total, memory) {
    return total + fileSizeBytes(memory);
  }, 0);
}

function storageTotal(memories) {
  return memories.reduce(function (total, memory) {
    return total + fileSizeBytes(memory);
  }, 0);
}

function isRecentMemory(memory) {
  const date = memory && memory.metadata && memory.metadata.lastModified ? Number(memory.metadata.lastModified) : 0;
  if (!date) return false;
  return Date.now() - date <= 30 * 24 * 60 * 60 * 1000;
}

function validateIndex(memories, albums) {
  const memoryIds = {};
  memories.forEach(function (memory) {
    memoryIds[memory.id] = true;
  });

  let orphanAlbumRefs = 0;
  albums.forEach(function (album) {
    (album.memoryIds || []).forEach(function (id) {
      if (!memoryIds[id]) orphanAlbumRefs += 1;
    });
  });

  const missingHomes = memories.filter(function (memory) {
    return !memory.trashed && !memoryHasHomeAlbum(memory, albums);
  }).length;

  const duplicateIds = memories.length - Object.keys(memoryIds).length;

  return {
    memories: memories.length,
    albums: albums.length,
    orphanAlbumRefs,
    missingHomes,
    duplicateIds,
  };
}

function existingSignatureMap(memories) {
  const map = {};
  (memories || []).forEach(function (memory) {
    const signature = memory && memory.metadata && memory.metadata.signature;
    if (signature) map[signature] = true;
  });
  return map;
}

function isTakeoutMemory(memory) {
  const path = memory && memory.metadata ? String(memory.metadata.webkitRelativePath || memory.metadata.name || "") : "";
  return /takeout|google photos/i.test(path);
}

function uploadPlanStats(files, memories) {
  const signatures = existingSignatureMap(memories);
  return Array.from(files || []).reduce(function (stats, file) {
    const signature = fileSignature(file);
    stats.total += 1;
    stats.bytes += file.size || 0;
    if (file.size && file.size > 50 * 1024 * 1024) stats.large += 1;
    if (signatures[signature]) stats.duplicates += 1;
    return stats;
  }, { total: 0, bytes: 0, large: 0, duplicates: 0 });
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function activeQueueCount(queue) {
  return (queue || []).filter(function (item) { return item.status === "uploading"; }).length;
}

function pendingQueueCount(queue) {
  return (queue || []).filter(function (item) { return item.status === "queued"; }).length;
}

function uploadQueueStats(queue) {
  return (queue || []).reduce(function (stats, item) {
    stats.total += 1;
    stats[item.status] = (stats[item.status] || 0) + 1;
    return stats;
  }, { total: 0, queued: 0, uploading: 0, done: 0, failed: 0 });
}

function uploadStats(memories) {
  return memories.reduce(function (stats, memory) {
    const status = memory.uploadStatus || "local";
    stats.total += 1;
    stats[status] = (stats[status] || 0) + 1;
    if (status === "failed" || status === "local" || status === "needs-file") stats.needsAttention += 1;
    return stats;
  }, { total: 0, queued: 0, uploading: 0, r2: 0, failed: 0, local: 0, needsAttention: 0 });
}

function selectedCount(selectedIds) {
  return Object.keys(selectedIds || {}).filter(function (id) { return selectedIds[id]; }).length;
}

function selectedMemoryIds(selectedIds) {
  return Object.keys(selectedIds || {}).filter(function (id) { return selectedIds[id]; }).map(function (id) {
    return Number(id);
  });
}

function assignableAlbums(albums) {
  return albums.filter(function (album) {
    return album.id !== "star";
  });
}

function memoryAlbumTitles(memory, albums) {
  return albums.filter(function (album) {
    return (album.memoryIds || []).indexOf(memory.id) !== -1;
  }).map(function (album) {
    return album.title;
  });
}

function searchableText(memory, albums) {
  const metadata = memory.metadata || {};
  return [
    memory.title,
    memory.date,
    memory.year,
    memory.month,
    memory.era,
    memory.kind,
    memory.fileName,
    memory.storageKey,
    memory.uploadStatus,
    memory.isMe ? "me marked" : "",
    memory.rating ? "rated rating " + memory.rating : "",
    memory.label ? "label labeled " + memory.label : "",
    memory.review ? "review" : "",
    memory.private ? "private" : "",
    metadata.name,
    metadata.type,
    metadata.size,
    metadata.lastModified,
    metadata.lastModifiedISO,
    metadata.webkitRelativePath,
    
    memory.isMe ? "me" : "",
    memory.inMirror ? "mirror" : "",
    memory.archived ? "archived" : "",
    memory.trashed ? "trash deleted" : "",
    memory.caption || "",
    memory.location || "",
    memory.event || "",
    isTakeoutMemory(memory) ? "takeout google photos" : "",
    memory.takeoutMeta && memory.takeoutMeta.folder ? memory.takeoutMeta.folder : "",
    memory.takeoutMeta && memory.takeoutMeta.sidecarPath ? memory.takeoutMeta.sidecarPath : "",
    Array.isArray(memory.tags) ? memory.tags.join(" ") : "",
    metadata.signature,
    memoryAlbumTitles(memory, albums).join(" "),
  ].join(" ").toLowerCase();
}

function matchesSearchFilter(memory, albums, filter, options) {
  const opts = options || {};
  if (opts.fromDate && dateValue(memory.date) && dateValue(memory.date) < dateValue(opts.fromDate)) return false;
  if (opts.toDate && dateValue(memory.date) && dateValue(memory.date) > dateValue(opts.toDate)) return false;
  if (opts.minRating && normalizeRating(memory.rating) < normalizeRating(opts.minRating)) return false;
  if (filter === "photos") return memory.kind === "photo";
  if (filter === "videos") return memory.kind === "video";
  if (filter === "me") return Boolean(memory.isMe);
  if (filter === "mirror") return Boolean(memory.inMirror);
  if (filter === "starred") return albumHasMemory(albums, "star", memory.id);
  if (filter === "recent") return isRecentMemory(memory);
  if (filter === "takeout") return isTakeoutMemory(memory);
  if (filter === "tagged") return Array.isArray(memory.tags) && memory.tags.length > 0;
  if (filter === "untagged") return !Array.isArray(memory.tags) || memory.tags.length === 0;
  if (filter === "noted") return Boolean(String(memory.caption || "").trim());
  if (filter === "located") return Boolean(String(memory.location || "").trim());
  if (filter === "rated") return normalizeRating(memory.rating) > 0;
  if (filter === "unrated") return normalizeRating(memory.rating) === 0;
  if (filter === "labeled") return Boolean(normalizeLabel(memory.label));
  if (filter === "unlabeled") return !normalizeLabel(memory.label);
  if (filter === "review") return Boolean(memory.review);
  if (filter === "private") return Boolean(memory.private);
  if (filter === "originals") return memory.uploadStatus === "r2";
  if (filter === "needs-file") return memory.uploadStatus === "needs-file" || memory.uploadStatus === "local" || memory.uploadStatus === "failed";
  if (filter === "archive" || filter === "archived") return Boolean(memory.archived) && !memory.trashed;
  if (filter === "trash") return Boolean(memory.trashed);
  if (filter === "failed") return memory.uploadStatus === "failed" || memory.uploadStatus === "local" || memory.uploadStatus === "needs-file";
  if (filter === "unassigned") return albumHasMemory(albums, UNASSIGNED_ALBUM_ID, memory.id);
  return true;
}

function searchMemories(memories, albums, query, filter, options) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return newest(memories.filter(function (memory) {
    if (!matchesSearchFilter(memory, albums, filter || "all", options)) return false;
    if (!terms.length) return filter && filter !== "all";
    const haystack = searchableText(memory, albums);
    return terms.every(function (term) {
      return haystack.indexOf(term) !== -1;
    });
  }));
}

function removeAlbum(albums, id) {
  return albums.filter(function (album) {
    return album.id !== id;
  });
}

function renameAlbum(albums, id, title) {
  const clean = String(title || "").trim();
  if (!clean) return albums;
  return albums.map(function (album) {
    return album.id === id ? { ...album, title: clean } : album;
  });
}

function updateAlbumDetails(albums, id, title, description) {
  const clean = String(title || "").trim();
  if (!clean || albumTitleExists(albums, clean, id)) return albums;
  return albums.map(function (album) {
    return album.id === id ? { ...album, title: clean, description: String(description || "").trim(), updatedAt: new Date().toISOString() } : album;
  });
}

function removeMemoryEverywhere(albums, memoryId) {
  return albums.map(function (album) {
    return {
      ...album,
      memoryIds: (album.memoryIds || []).filter(function (id) {
        return id !== memoryId;
      }),
    };
  });
}

function migrateMemory(memory) {
  const base = memory || {};
  return {
    ...base,
    tags: Array.isArray(base.tags) ? base.tags : [],
    caption: base.caption || "",
    location: base.location || "",
    event: base.event || "",
    rating: normalizeRating(base.rating),
    label: normalizeLabel(base.label),
    review: Boolean(base.review),
    private: Boolean(base.private),
    isMe: Boolean(base.isMe),
    inMirror: Boolean(base.inMirror),
    archived: Boolean(base.archived),
    trashed: Boolean(base.trashed),
    deletedAt: base.deletedAt || "",
    updatedAt: base.updatedAt || "",
  };
}

function migrateAlbum(album) {
  const base = album || {};
  return {
    ...base,
    title: base.title || "UNTITLED",
    description: base.description || "",
    memoryIds: Array.from(new Set(base.memoryIds || [])),
    createdAt: base.createdAt || "",
    updatedAt: base.updatedAt || "",
    pinned: Boolean(base.pinned),
    locked: Boolean(base.locked),
    coverId: base.coverId || null,
  };
}

function migrateIndex(index) {
  const raw = index || {};
  return {
    version: INDEX_SCHEMA_VERSION,
    savedAt: raw.savedAt || new Date().toISOString(),
    memories: (Array.isArray(raw.memories) ? raw.memories : []).map(migrateMemory),
    albums: (Array.isArray(raw.albums) ? raw.albums : INITIAL_ALBUMS).map(migrateAlbum),
  };
}

function previewUrlForMemory(memory) {
  if (!memory || !memory.storageKey) return "";
  return "/thumb/" + memory.storageKey;
}

function originalUrlForMemory(memory) {
  if (!memory || !memory.storageKey) return "";
  return MEDIA_BASE + "/" + memory.storageKey;
}

function normalizeMemoryUrl(memory) {
  if (!memory || !memory.storageKey) return memory;
  return {
    ...memory,
    storageBase: MEDIA_BASE,
    storageUrl: originalUrlForMemory(memory),
    previewUrl: previewUrlForMemory(memory),
    tags: Array.isArray(memory.tags) ? memory.tags : [],
    caption: memory.caption || "",
    location: memory.location || "",
    event: memory.event || "",
    rating: normalizeRating(memory.rating),
    label: normalizeLabel(memory.label),
    review: Boolean(memory.review),
    private: Boolean(memory.private),
    isMe: Boolean(memory.isMe),
    inMirror: Boolean(memory.inMirror),
    archived: Boolean(memory.archived),
    trashed: Boolean(memory.trashed),
    deletedAt: memory.deletedAt || "",
    updatedAt: memory.updatedAt || "",
  };
}



function cleanIndex(index) {
  const migrated = migrateIndex(index);
  const memories = migrated.memories.map(normalizeMemoryUrl);
  const albums = migrated.albums.length ? migrated.albums : INITIAL_ALBUMS;
  return {
    version: INDEX_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    memories,
    albums: ensureAlbumCoverage(memories, albums),
  };
}

async function loadIndex() {
  const res = await fetch("/api/index");
  if (!res.ok) return cleanIndex({});
  return cleanIndex(await res.json());
}

async function backupIndex() {
  try {
    const res = await fetch("/api/backup-index", { method: "POST" });
    return res.ok;
  } catch (error) {
    return false;
  }
}

async function saveIndex(memories, albums) {
  const coveredAlbums = ensureAlbumCoverage(memories, albums);
  const payload = cleanIndex({
    memories: memories.map(function (memory) {
      const copy = { ...memory };
      delete copy.previewUrl;
      return copy;
    }),
    albums: coveredAlbums,
  });

  const res = await fetch("/api/index", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res.ok;
}

async function uploadOne(memory, file) {
  const form = new FormData();
  form.append("file", file);
  form.append("key", memory.storageKey);
  form.append("kind", memory.kind);
  form.append("title", memory.title);
  form.append("metadata", JSON.stringify(memory.metadata || {}));
  form.append("storageUrl", memory.storageUrl || "");

  const res = await fetch("/api/upload", { method: "POST", body: form });
  return res.ok;
}

async function checkMissingFiles(memories) {
  const sample = memories.slice(0, 50);
  const results = await Promise.all(sample.map(function (memory) {
    if (!memory.storageUrl) return Promise.resolve({ id: memory.id, ok: false });
    return fetch(memory.storageUrl, { method: "HEAD" }).then(function (res) {
      return { id: memory.id, ok: res.ok };
    }).catch(function () {
      return { id: memory.id, ok: false };
    });
  }));

  return {
    checked: sample.length,
    missing: results.filter(function (result) { return !result.ok; }).length,
  };
}

async function checkAccess() {
  const res = await fetch("/api/access");
  if (!res.ok) return { required: true, authorized: false };
  return res.json();
}

async function submitAccessCode(code) {
  const res = await fetch("/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data.authorized || data.ok);
}

async function fetchHealth() {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error("health_failed");
  return res.json();
}

async function deleteOne(memory) {
  if (!memory || !memory.storageKey) return true;
  const res = await fetch("/api/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: memory.storageKey }),
  });
  return res.ok;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type: type || "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function memoriesToCsv(memories, albums) {
  const header = ["id", "title", "fileName", "kind", "date", "year", "month", "era", "caption", "location", "event", "rating", "label", "tags", "albums", "size", "status", "storageKey", "storageUrl"];
  const rows = memories.map(function (memory) {
    return [
      memory.id,
      memory.title,
      memory.fileName,
      memory.kind,
      memory.date,
      memory.year,
      memory.month,
      memory.era,
      memory.caption,
      memory.location,
      memory.event,
      normalizeRating(memory.rating),
      memory.label,
      Array.isArray(memory.tags) ? memory.tags.join("|") : "",
      memoryAlbumTitles(memory, albums).join("|"),
      fileSizeBytes(memory),
      memory.uploadStatus,
      memory.storageKey,
      memory.storageUrl,
    ].map(csvEscape).join(",");
  });
  return header.map(csvEscape).join(",") + "\n" + rows.join("\n");
}

function confirmDelete(message) {
  if (typeof window === "undefined") return true;
  return window.confirm(message || "Delete this file permanently?");
}

function downloadOriginal(memory) {
  if (!memory || !memory.storageUrl) return;
  const anchor = document.createElement("a");
  anchor.href = memory.storageUrl;
  anchor.download = memory.fileName || memory.title || "photo";
  anchor.target = "_blank";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function openOriginal(memory) {
  if (!memory || !memory.storageUrl) return;
  window.open(memory.storageUrl, "_blank", "noopener,noreferrer");
}

function copyMediaUrl(memory) {
  if (!memory || !memory.storageUrl) return;
  const value = window.location.origin + memory.storageUrl;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value);
  }
}

function copyStorageKey(memory) {
  if (!memory || !memory.storageKey) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(memory.storageKey);
  }
}

function AccessGate(props) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  useEffect(function () {
    checkAccess()
      .then(function (status) {
        setLocked(Boolean(status.required && !status.authorized));
        setChecking(false);
      })
      .catch(function () {
        setLocked(false);
        setChecking(false);
      });
  }, []);

  function unlock() {
    setError("");
    submitAccessCode(code).then(function (ok) {
      if (ok) {
        setLocked(false);
        props.onUnlocked();
      } else {
        setError("ACCESS DENIED");
      }
    });
  }

  if (checking) {
    return (
      <div className="accessScreen">
        <Glass className="accessCard">
          <strong>PHOTOZ</strong>
          <span>CHECKING ACCESS</span>
        </Glass>
      </div>
    );
  }

  if (!locked) return props.children;

  return (
    <div className="accessScreen">
      <Glass className="accessCard">
        <strong>PHOTOZ</strong>
        <span>PRIVATE ARCHIVE</span>
        <input value={code} onChange={function (event) { setCode(event.target.value); }} onKeyDown={function (event) { if (event.key === "Enter") unlock(); }} placeholder="ACCESS CODE" type="password" />
        <button type="button" onClick={unlock}>UNLOCK</button>
        {error ? <em>{error}</em> : null}
      </Glass>
    </div>
  );
}

function Glass(props) {
  return (
    <div className={cls("glass", props.className)}>
      {props.children}
    </div>
  );
}

function Pill(props) {
  return <span className="pill">{props.children}</span>;
}

function VisibleReporter(props) {
  useEffect(function () {
    if (props.reportVisibleIds) props.reportVisibleIds((props.items || []).map(function (item) { return item.id; }));
  }, [props.items, props.reportVisibleIds]);
  return null;
}

function EmptyState(props) {
  return (
    <div className="emptyState">
      <strong>{props.title || "EMPTY"}</strong>
      <span>{props.children}</span>
    </div>
  );
}

function UploadButton(props) {
  return (
    <label className="uploadButton">
      <Upload size={16} />
      <span>{props.folder ? "FOLDER" : "UPLOAD"}</span>
      <input
        type="file"
        multiple
        accept="image/*,video/*"
        webkitdirectory={props.folder ? "true" : undefined}
        directory={props.folder ? "true" : undefined}
        onChange={props.onUpload}
      />
    </label>
  );
}

function ImportBackupButton(props) {
  return (
    <label className="importButton">
      <span>IMPORT</span>
      <input type="file" accept="application/json,.json" onChange={props.onImport} />
    </label>
  );
}

function PhotoCard(props) {
  const memory = props.memory;
  const [imageFailed, setImageFailed] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const preferredSrc = useOriginal ? memory.storageUrl : (memory.previewUrl || memory.storageUrl);
  const imageSrc = !imageFailed ? preferredSrc : "";
  const isVideo = memory.kind === "video";
  return (
    <motion.button
      type="button"
      className={cls("photoCard", props.large && "large", props.className)}
      onClick={function (event) {
        if (props.selectionMode) {
          event.preventDefault();
          props.toggleSelected(memory.id);
          return;
        }
        if (props.onClick) props.onClick(event);
      }}
      whileHover={props.onClick ? { y: -3, scale: 1.01 } : undefined}
      whileTap={props.onClick ? { scale: 0.98 } : undefined}
    >
      {imageSrc && isVideo ? (
        <video src={memory.storageUrl || imageSrc} muted playsInline preload="metadata" onError={function () { setImageFailed(true); }} />
      ) : imageSrc ? (
        <img src={imageSrc} alt="" loading="lazy" decoding="async" onError={function () { if (!useOriginal && memory.storageUrl) setUseOriginal(true); else setImageFailed(true); }} />
      ) : <span className="brokenMedia">NO FILE</span>}
      {isVideo ? <span className="videoBadge">VIDEO</span> : null}
      <div className="photoOverlay" />
      {memory.isMe ? <span className="meBadge">Me</span> : null}
      {props.selectionMode ? (
        <span
          className={cls("selectDot", props.selected && "selected")}
          onClick={function (event) {
            event.preventDefault();
            event.stopPropagation();
            props.toggleSelected(memory.id);
          }}
        >
          {props.selected ? "✓" : ""}
        </span>
      ) : null}
      {props.onDelete && !props.selectionMode ? (
        <span
          className="photoDelete"
          title="Delete"
          onClick={function (event) {
            event.preventDefault();
            event.stopPropagation();
            props.onDelete(memory);
          }}
        >
          <X size={13} />
        </span>
      ) : null}
      {props.showText ? (
        <div className="photoText">
          <strong>{up(memory.title)}</strong>
          <span>{memory.date}</span>
          <em>{up(memory.uploadStatus || "local")}</em>
        </div>
      ) : null}
    </motion.button>
  );
}

function Dock(props) {
  return (
    <div className="dockWrap">
      <Glass className="dock">
        {PAGES.map(function (page) {
          const Icon = page.icon;
          const active = props.active === page.id;
          return (
            <button
              key={page.id}
              type="button"
              aria-label={page.id}
              className={cls("dockButton", active && "active")}
              onClick={function () {
                props.setActive(page.id);
              }}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 1.9} />
              <span>{up(page.id)}</span>
            </button>
          );
        })}
      </Glass>
    </div>
  );
}

function SortControl(props) {
  return (
    <div className="sortControl">
      {SORT_OPTIONS.map(function (sort) {
        return (
          <button key={sort} type="button" className={props.sortMode === sort ? "active" : ""} onClick={function () { props.setSortMode(sort); }}>
            {up(sort)}
          </button>
        );
      })}
    </div>
  );
}

function AlbumSortControl(props) {
  if (!props.show) return null;
  return (
    <div className="albumSortControl">
      {ALBUM_SORT_OPTIONS.map(function (sort) {
        return <button key={sort} type="button" className={props.albumSort === sort ? "active" : ""} onClick={function () { props.setAlbumSort(sort); }}>{up(sort)}</button>;
      })}
    </div>
  );
}

function GridSizeControl(props) {
  return (
    <div className="gridSizeControl">
      {GRID_SIZES.map(function (size) {
        return (
          <button key={size} type="button" className={props.gridSize === size ? "active" : ""} onClick={function () { props.setGridSize(size); }}>
            {up(size)}
          </button>
        );
      })}
    </div>
  );
}

function ViewPanel(props) {
  if (!props.open) return null;

  return (
    <div className="viewDropdown">
      <div className="statusPanelTop">
        <strong>Filter</strong>
        <button type="button" onClick={props.close}>Close</button>
      </div>
      <div className="viewPanelGrid">
        <SortControl sortMode={props.sortMode} setSortMode={props.setSortMode} />
        <AlbumSortControl show={props.showAlbumSort} albumSort={props.albumSort} setAlbumSort={props.setAlbumSort} />
        <GridSizeControl gridSize={props.gridSize} setGridSize={props.setGridSize} />
      </div>
    </div>
  );
}

function ToolsPanel(props) {
  if (!props.open) return null;

  return (
    <div className="toolsDropdown toolsIconMenu">
      <div className="toolsDropdownList">
        <UploadButton onUpload={props.onUpload} />
        <UploadButton onUpload={props.onUpload} folder />
        <button type="button" onClick={props.toggleImportPanel}>Import</button>
        <button type="button" onClick={props.toggleUploadQueuePanel}>Queue</button>
        <button type="button" onClick={props.toggleDuplicatePanel}>Duplicates</button>
        <button type="button" onClick={props.toggleStatusPanel}>Missing</button>
        <button type="button" onClick={props.toggleHealthPanel}>Repair</button>
        <button type="button" onClick={props.exportVaultIndex}>Backup</button>
        <button type="button" onClick={props.exportManifestCsv}>List</button>
        <ImportBackupButton onImport={props.importVaultIndex} />
      </div>
    </div>
  );
}

function HealthPanel(props) {
  if (!props.open) return null;

  return (
    <div className="healthPanel">
      <div className="statusPanelTop">
        <strong>HEALTH</strong>
        <button type="button" onClick={props.close}>Close</button>
      </div>
      <div className="statusStats">
        <span>{props.health ? "OK " + String(props.health.ok).toUpperCase() : "NOT CHECKED"}</span>
        <span>{props.health && props.health.indexFound ? "INDEX FOUND" : "INDEX NEW"}</span>
        <span>{props.health && props.health.bucket ? "R2 " + props.health.bucket : "R2"}</span>
      </div>
      {props.validation ? <div className="statusClean">Archive: {props.validation.memories} files / {props.validation.albums} albums / {props.validation.orphanAlbumRefs} broken links / {props.validation.missingHomes} without album</div> : null}
      {props.health && props.health.repairReport ? <div className="statusClean">Last repair: {props.health.repairReport.orphanAlbumRefs} broken links / {props.health.repairReport.missingHomes} without album</div> : null}
      {props.health && props.health.routeCheck ? <div className="statusClean">App: ACCESS {String(props.health.routeCheck.access).toUpperCase()} / HEALTH {String(props.health.routeCheck.health).toUpperCase()}</div> : null}
      {props.missingReport ? <div className="statusClean">Files: {props.missingReport.missing} MISSING / {props.missingReport.checked} CHECKED</div> : null}
      {props.healthError ? <div className="statusClean">HEALTH CHECK FAILED.</div> : null}
      <button type="button" onClick={props.runHealthCheck}>CHECK ARCHIVE</button>
      <button type="button" onClick={props.runRouteCheck}>CHECK APP</button>
      <button type="button" onClick={props.runMissingCheck}>CHECK FILES</button>
      <button type="button" onClick={props.repairIndex}>REPAIR ALBUM LINKS</button>
    </div>
  );
}

function DuplicatePanel(props) {
  if (!props.open) return null;
  const groups = duplicateGroups(props.memories).filter(function (group) {
    return group.some(function (memory) { return !memory.trashed; });
  });

  return (
    <div className="duplicatePanel duplicateReviewPanel">
      <div className="statusPanelTop">
        <strong>DUPLICATES</strong>
        <button type="button" onClick={props.close}>Close</button>
      </div>
      {!groups.length ? <div className="statusClean">NO DUPLICATES FOUND.</div> : null}
      {groups.slice(0, 10).map(function (group, index) {
        const cleanGroup = group.filter(function (memory) { return !memory.trashed; });
        const keeper = cleanGroup[0];
        return (
          <div key={index} className="duplicateGroup reviewGroup">
            <div className="duplicateGroupTop">
              <strong>{duplicateGroupTitle(cleanGroup)}</strong>
              <span>{cleanGroup.length} MATCHES</span>
              {keeper ? <button type="button" onClick={function () { props.trashDuplicateOthers(cleanGroup, keeper.id); }}>MOVE EXTRAS TO TRASH</button> : null}
            </div>
            <div className="duplicateCandidates">
              {cleanGroup.map(function (memory, itemIndex) {
                return (
                  <button key={memory.id} type="button" className={itemIndex === 0 ? "keeperCandidate" : ""} onClick={function () { props.openMemory(memory); }}>
                    <b>{itemIndex === 0 ? "KEEP" : "REVIEW"}</b>
                    <span>{up(memory.title)}</span>
                    <em>{memory.metadata && memory.metadata.webkitRelativePath ? memory.metadata.webkitRelativePath : memory.fileName}</em>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ImportPanel(props) {
  if (!props.open) return null;

  return (
    <div className="importPanel simplifiedImport">
      <div className="statusPanelTop">
        <strong>IMPORT PHOTOS</strong>
        <button type="button" onClick={props.close}>Close</button>
      </div>

      <div className="importSettings primaryImportSettings">
        <label>
          <span>ADD TO</span>
          <select value={props.uploadAlbum} onChange={function (event) { props.setUploadAlbum(event.target.value); }}>
            {assignableAlbums(props.albums).map(function (album) {
              return <option key={album.id} value={album.id}>{album.title}</option>;
            })}
          </select>
        </label>
        <label className="toggleLine">
          <input type="checkbox" checked={props.skipDuplicates} onChange={function (event) { props.setSkipDuplicates(event.target.checked); }} />
          <span>SKIP DUPLICATES</span>
        </label>
      </div>

      <button type="button" className="advancedToggle" onClick={function () { props.setImportAdvancedOpen(function (value) { return !value; }); }}>
        {props.importAdvancedOpen ? "HIDE ADVANCED" : "ADVANCED IMPORT"}
      </button>

      {props.importAdvancedOpen ? (
        <div className="importSettings advancedImportSettings">
          <label>
            <span>BATCH SIZE</span>
            <input value={props.uploadBatchSize} onChange={function (event) { props.setUploadBatchSize(event.target.value); }} />
          </label>
          <label>
            <span>UPLOAD SLOTS</span>
            <input value={props.uploadConcurrency} onChange={function (event) { props.setUploadConcurrency(event.target.value); }} />
          </label>
        </div>
      ) : null}

      {props.importSummary ? (
        <div className="statusStats">
          <span>FILES {props.importSummary.total}</span>
          <span>ADDED {props.importSummary.added}</span>
          <span>SKIPPED {props.importSummary.skipped}</span>
          <span>LARGE {props.importSummary.large}</span>
          <span>SIZE {formatBytes(props.importSummary.bytes)}</span>
        </div>
      ) : <div className="statusClean">Choose photos or a folder with the Upload button.</div>}
    </div>
  );
}

function UploadQueuePanel(props) {
  if (!props.open) return null;
  const stats = uploadQueueStats(props.queue);
  const active = props.queue.slice(-18).reverse();

  return (
    <div className="uploadQueuePanel">
      <div className="statusPanelTop">
        <strong>UPLOAD QUEUE</strong>
        <button type="button" onClick={props.close}>Close</button>
      </div>
      <div className="statusStats">
        <span>TOTAL {stats.total}</span>
        <span>QUEUED {stats.queued || 0}</span>
        <span>UPLOADING {stats.uploading || 0}</span>
        <span>DONE {stats.done || 0}</span>
        <span>FAILED {stats.failed || 0}</span>
      </div>
      {!active.length ? <div className="statusClean">Nothing is uploading.</div> : null}
      {active.length ? (
        <div className="uploadQueueRows">
          {active.map(function (item) {
            return (
              <div key={item.id} className={"uploadQueueRow " + item.status}>
                <span>{up(item.name)}</span>
                <em>{up(item.status)}</em>
              </div>
            );
          })}
        </div>
      ) : null}
      <button type="button" className="statusCleanup" onClick={props.togglePause}>{props.paused ? "RESUME" : "PAUSE"}</button>
      <button type="button" className="statusCleanup" onClick={props.retryFailed}>RETRY FAILED</button>
      <button type="button" className="statusCleanup" onClick={props.clearFinished}>CLEAR FINISHED</button>
    </div>
  );
}

function StatusPanel(props) {
  const stats = uploadStats(props.memories);
  if (!props.open) return null;

  const issues = props.memories.filter(function (memory) {
    return memory.uploadStatus === "failed" || memory.uploadStatus === "local" || memory.uploadStatus === "needs-file";
  });

  return (
    <div className="statusPanel">
      <div className="statusPanelTop">
        <strong>UPLOAD STATUS</strong>
        <button type="button" onClick={props.close}>Close</button>
      </div>
      <div className="statusStats">
        <span>TOTAL {stats.total}</span>
        <span>SIZE {formatBytes(storageTotal(props.memories))}</span>
        <span>R2 {stats.r2 || 0}</span>
        <span>QUEUED {stats.queued || 0}</span>
        <span>FAILED {stats.failed || 0}</span>
        <span>LOCAL {stats.local || 0}</span>
      </div>
      <button type="button" className="statusCleanup" onClick={props.purgeTrash}>EMPTY TRASH</button>
      {issues.length ? <button type="button" className="statusCleanup" onClick={props.clearLocalFailedStatus}>NEEDS RESELECT</button> : null}
      {issues.length ? (
        <div className="statusIssues">
          {issues.slice(0, 12).map(function (memory) {
            return (
              <div key={memory.id} className="statusIssue">
                <span>{up(memory.title)}</span>
                <em>{up(memory.uploadStatus)}</em>
                <button type="button" onClick={function () { props.retryUpload(memory); }}>RESELECT</button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="statusClean">ALL FILES ARE STORED IN R2.</div>
      )}
    </div>
  );
}

function UndoBar(props) {
  if (!props.snapshot) return null;
  return (
    <div className="undoBar">
      <span>{props.snapshot.label}</span>
      <button type="button" onClick={props.undo}>UNDO</button>
      <button type="button" onClick={props.clear}>DISMISS</button>
    </div>
  );
}

function BulkBar(props) {
  const count = selectedCount(props.selectedIds);
  if (!props.selectionMode) return null;

  return (
    <div className="bulkBar simplifiedBulk">
      <Pill>{count}</Pill>
      <select value={props.bulkAlbum} onChange={function (event) { props.setBulkAlbum(event.target.value); }}>
        {assignableAlbums(props.albums).map(function (album) {
          return <option key={album.id} value={album.id}>{album.title}</option>;
        })}
      </select>
      <button type="button" disabled={!count} onClick={props.bulkMoveToAlbum}>MOVE</button>
      <button type="button" disabled={!count} onClick={props.bulkDelete}>Trash</button>
      <button type="button" className={props.bulkMoreOpen ? "active" : ""} onClick={props.toggleBulkMore}>MORE</button>
      <button type="button" onClick={props.clearSelection}>CLEAR</button>

      {props.bulkMoreOpen ? (
        <div className="bulkMore">
          <input value={props.bulkText} onChange={function (event) { props.setBulkText(event.target.value); }} placeholder="TAGS / ERA / CAPTION / LOCATION / EVENT" />
          <button type="button" onClick={props.selectAll}>SELECT ALL</button>
          <button type="button" onClick={props.selectVisible}>SELECT VIEW</button>
          <button type="button" onClick={props.invertSelection}>INVERT</button>
          <button type="button" disabled={!count} onClick={props.bulkAddToAlbum}>ADD TO ALBUM</button>
          <button type="button" disabled={!count} onClick={props.bulkStar}>Star</button>
          <button type="button" disabled={!count} onClick={props.bulkUnstar}>Unstar</button>
          <button type="button" disabled={!count} onClick={props.bulkMarkMe}>MARK ME</button>
          <button type="button" disabled={!count} onClick={props.bulkUnmarkMe}>Unmark me</button>
          <button type="button" disabled={!count} onClick={props.bulkMoveToMirror}>Mirror</button>
          <button type="button" disabled={!count} onClick={props.bulkRemoveFromMirror}>Unmirror</button>
          <button type="button" disabled={!count} onClick={props.bulkArchive}>Hide</button>
          <button type="button" disabled={!count} onClick={props.bulkUnarchive}>Unhide</button>
          <button type="button" disabled={!count} onClick={props.bulkRestore}>Restore</button>
          <button type="button" disabled={!count} onClick={props.bulkClearTags}>CLEAR TAGS</button>
          <button type="button" disabled={!count} onClick={props.bulkSetEra}>SET ERA</button>
          <button type="button" disabled={!count} onClick={props.bulkSetCaption}>CAPTION</button>
          <button type="button" disabled={!count} onClick={props.bulkSetLocation}>LOCATION</button>
          <button type="button" disabled={!count} onClick={props.bulkSetEvent}>EVENT</button>
          <button type="button" disabled={!count} onClick={props.bulkClearTextFields}>CLEAR TEXT</button>
          <button type="button" disabled={!count} onClick={props.exportSelectedJson}>EXPORT SELECTED</button>
        </div>
      ) : null}
    </div>
  );
}

function ControlBar(props) {
  return (
    <div className="controlBar">
      <div className="leftControls">
        {props.archive ? (
          <div className="modeBar">
            {ARCHIVE_VIEWS.map(function (view) {
              return (
                <button
                  key={view}
                  type="button"
                  className={props.archiveView === view ? "selected" : ""}
                  onClick={function () {
                    props.setArchiveView(view);
                  }}
                >
                  {archiveViewLabel(view)}
                </button>
              );
            })}
          </div>
        ) : null}
        <Pill>{props.count}</Pill>
        {props.sync !== "saved" ? <Pill>{up(props.sync)}</Pill> : null}
      </div>
    </div>
  );
}

function SystemShortcutCard(props) {
  const group = props.group;
  return (
    <button type="button" className="systemRailItem" onClick={function () { props.openGroup(group); }}>
      <span>{cleanSystemLabel(group.title || group.id)}</span>
      <em>{group.items.length}</em>
    </button>
  );
}

function GroupCard(props) {
  const group = props.group;
  if (isSystemAlbumGroup(group)) {
    return <SystemShortcutCard group={group} openGroup={props.openGroup} />;
  }
  if (group && group.virtual) {
    return <SystemShortcutCard group={group} openGroup={props.openGroup} />;
  }
  const displayItems = group.cover ? [group.cover].concat(group.items.filter(function (item) { return item.id !== group.cover.id; })) : group.items;
  return (
    <button type="button" className="groupCard" onClick={function () { props.openGroup(group); }}>
      <div className="groupGrid">
        {!displayItems.length ? <div className="emptyCard">{group.childCount ? group.childCount + " ALBUMS" : "EMPTY"}</div> : null}
        {displayItems.slice(0, 6).map(function (memory, index) {
          return (
            <PhotoCard
              key={memory.id}
              memory={memory}
              className={index === 0 ? "featured" : ""}
              selectionMode={props.selectionMode}
              selected={props.selectedIds && props.selectedIds[memory.id]}
              toggleSelected={props.toggleSelected}
              isStarred={props.starredIds && props.starredIds[memory.id]}
              onDelete={props.deleteMemory}
              onClick={function (event) {
                event.stopPropagation();
                props.openMemory(memory);
              }}
            />
          );
        })}
      </div>
      {group.pinned ? <span className="pinBadge">PIN</span> : null}
      {group.locked ? <span className="lockBadge">LOCK</span> : null}
      <div className="groupTitle">
        <strong>{up(group.title)}</strong>
        {group.description ? <small className="groupDescription">{up(group.description)}</small> : null}
        <span>{group.items.length + (group.childCount || 0)}</span>
        {group.excludeFromAll ? <em>Hidden from All</em> : <em>{formatBytes(albumSizeBytes(group.items))}</em>}
      </div>
    </button>
  );
}

function MirrorView(props) {
  const items = sortMemories(mirrorItems(props.memories), props.sortMode);
  const mirrorOnly = newest(items.filter(function (memory) { return Boolean(memory.inMirror); }));
  const marked = newest(items.filter(function (memory) { return Boolean(memory.isMe) && !memory.inMirror; }));
  const allGroup = { id: "mirror-all", title: "ALL", items: items, sort: items[0] ? items[0].sort : 0 };

  return (
    <div className="pageScroll mirrorPage">
      <VisibleReporter items={items} reportVisibleIds={props.reportVisibleIds} />
      <div className="mirrorControl">
        <button type="button" onClick={function () { props.openGroup(allGroup); }}>
          <Eye size={20} />
          <span>All</span>
          <b>{items.length}</b>
          <em>›</em>
        </button>
      </div>

      {mirrorOnly.length ? <div className="archiveLabel">Mirror</div> : null}
      {!items.length ? <EmptyState title="MIRROR EMPTY">Move photos to Mirror or mark them ME.</EmptyState> : null}
      <div className="photoGrid">
        {mirrorOnly.map(function (memory) {
          return <PhotoCard key={memory.id} memory={memory} showText selectionMode={props.selectionMode} selected={props.selectedIds && props.selectedIds[memory.id]} toggleSelected={props.toggleSelected} isStarred={props.starredIds && props.starredIds[memory.id]} onDelete={props.deleteMemory} onClick={function () { props.openMemory(memory); }} />;
        })}
      </div>

      {marked.length ? <div className="archiveLabel">MARKED ME</div> : null}
      {marked.length ? (
        <div className="photoGrid mirrorAlbumGrid">
          {marked.map(function (memory) {
            return <PhotoCard key={memory.id} memory={memory} showText selectionMode={props.selectionMode} selected={props.selectedIds && props.selectedIds[memory.id]} toggleSelected={props.toggleSelected} isStarred={props.starredIds && props.starredIds[memory.id]} onDelete={props.deleteMemory} onClick={function () { props.openMemory(memory); }} />;
          })}
        </div>
      ) : null}
    </div>
  );
}

function AlbumsView(props) {
  const q = props.albumQuery.trim().toLowerCase();
  const albums = sortAlbumGroups(
    virtualAlbumGroups(safeArray(props.albums), safeArray(props.memories)).concat(
      albumGroups(safeArray(props.albums), safeArray(props.memories), props.currentAlbumId)
    ),
    props.albumSort
  ).filter(function (folder) {
    return !q || String(folder.title || "").toLowerCase().indexOf(q) !== -1;
  });
  const archiveGroups = props.archiveView === "albums" ? albums : groupBy(props.archiveView, safeArray(props.memories));
  const virtualGroups = props.archiveView === "albums" && !props.currentAlbumId ? archiveGroups.filter(isSystemAlbumGroup) : [];
  const realGroups = props.archiveView === "albums" ? archiveGroups.filter(function (group) { return !isSystemAlbumGroup(group); }) : archiveGroups;
  const isAlbums = props.archiveView === "albums";
  const currentAlbum = props.currentAlbumId ? albumById(props.albums, props.currentAlbumId) : null;
  const currentPhotos = currentAlbum ? directAlbumMemories(props.albums, props.memories, props.currentAlbumId) : [];

  return (
    <div className="pageScroll">
      <VisibleReporter items={props.currentAlbumId ? currentPhotos : props.memories} reportVisibleIds={props.reportVisibleIds} />
      {isAlbums ? (
        <div className="albumControlsRow">
          <div className="albumSearchOnly">
            <input
              value={props.albumQuery}
              onChange={function (event) { props.setAlbumQuery(event.target.value); }}
              placeholder={props.currentAlbumId ? "Search inside album" : "Search albums"}
            />
          </div>
          {!props.albumCreateOpen ? (
            <button type="button" className="newAlbumTrigger" onClick={function () { props.setAlbumCreateOpen(true); }}>
              {props.currentAlbumId ? "New nested album" : "New album"}
            </button>
          ) : null}
          {props.albumCreateOpen ? (
            <div className="newAlbumPanel">
              <input
                value={props.draft}
                onChange={function (event) { props.setDraft(event.target.value); }}
                placeholder={props.currentAlbumId ? "Nested album name" : "Album name"}
              />
              <button type="button" title="Create album" onClick={props.createAlbum}>Create</button>
              <button type="button" onClick={function () { props.setAlbumCreateOpen(false); props.setDraft(""); }}>Cancel</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isAlbums && currentAlbum ? (
        <div className="albumPathBar">
          <button type="button" onClick={function () { props.setCurrentAlbumId(""); props.setAlbumQuery(""); props.setAlbumCreateOpen(false); }}>Albums</button>
          <span>/</span>
          <strong>{currentAlbum.title}</strong>
          <button type="button" onClick={function () { props.toggleAlbumExcludeFromAll(currentAlbum.id); }}>
            {currentAlbum.excludeFromAll ? "Show in All" : "Hide from All"}
          </button>
        </div>
      ) : null}

      {isAlbums && virtualGroups.length ? (
        <div className="systemRail">
          {virtualGroups.map(function (group) {
            return <SystemShortcutCard key={group.id} group={group} openGroup={props.openGroup} />;
          })}
        </div>
      ) : null}

      <div className="archiveLabel">{isAlbums ? (currentAlbum ? "Inside album" : "Albums") : up(props.archiveView)}</div>
      <div className={isAlbums ? "albumGrid folderView" : props.archiveView === "months" ? "albumGrid filterView" : "timelineStack filterView"}>
        {(isAlbums ? realGroups : archiveGroups).map(function (group) {
          const editing = isAlbums && props.editingId === group.sourceId;
          if (!isAlbums) {
            return <SystemShortcutCard key={group.id} group={group} openGroup={props.openGroup} />;
          }

          return (
            <div className={group.excludeFromAll ? "albumTile excludedFromAll" : "albumTile"} key={group.id}>
              <div className="tileActions">
                {!group.virtual ? <button type="button" onClick={function () { props.toggleAlbumPin(group.sourceId); }}>{group.pinned ? "Unpin" : "Pin"}</button> : null}
                {!group.virtual ? <button type="button" onClick={function () { props.toggleAlbumLock(group.sourceId); }}>{group.locked ? "Unlock" : "Lock"}</button> : null}
                {!group.virtual ? <button type="button" onClick={function () { props.toggleAlbumExcludeFromAll(group.sourceId); }}>{group.excludeFromAll ? "Show in All" : "Hide from All"}</button> : null}
                {!group.virtual ? <button type="button" onClick={function () { props.startEdit(group.sourceId, group.title, group.description); }}>Edit</button> : null}
                {!group.virtual && !group.locked && group.sourceId !== UNASSIGNED_ALBUM_ID ? <button type="button" onClick={function () { props.deleteAlbum(group.sourceId); }}><X size={14} /></button> : null}
              </div>
              {editing ? (
                <Glass className="editPanel">
                  <input value={props.editDraft} onChange={function (event) { props.setEditDraft(event.target.value); }} />
                  <input value={props.editDescriptionDraft} onChange={function (event) { props.setEditDescriptionDraft(event.target.value); }} placeholder="DESCRIPTION" />
                  <div>
                    <button type="button" onClick={props.saveEdit}>Save</button>
                    <button type="button" onClick={props.cancelEdit}>Cancel</button>
                  </div>
                </Glass>
              ) : (
                <GroupCard group={group} openGroup={props.openGroup} openMemory={props.openMemory} deleteMemory={props.deleteMemory} selectionMode={props.selectionMode} selectedIds={props.selectedIds} toggleSelected={props.toggleSelected} starredIds={props.starredIds} />
              )}
            </div>
          );
        })}
      </div>

      {isAlbums && currentAlbum ? (
        <>
          <div className="archiveLabel">Photos</div>
          {!currentPhotos.length && !realGroups.length ? <EmptyState title="EMPTY ALBUM">Add photos or create a nested album.</EmptyState> : null}
          {currentPhotos.length ? (
            <div className="photoGrid">
              {currentPhotos.map(function (memory) {
                return <PhotoCard key={memory.id} memory={memory} showText selectionMode={props.selectionMode} selected={props.selectedIds && props.selectedIds[memory.id]} toggleSelected={props.toggleSelected} isStarred={props.starredIds && props.starredIds[memory.id]} onDelete={props.deleteMemory} onClick={function () { props.openMemory(memory); }} />;
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function SearchView(props) {
  const results = sortMemories(searchMemories(props.memories, props.albums, props.query, props.filter, { fromDate: props.fromDate, toDate: props.toDate, minRating: props.minRating }), props.sortMode);
  const active = props.query.trim().length > 0 || props.filter !== "all";

  return (
    <div className="pageScroll searchPage">
      <VisibleReporter items={results} reportVisibleIds={props.reportVisibleIds} />
      <div className="searchBar searchBarFull">
        <Pill>{results.length}</Pill>
        <Search size={17} />
        <input
          value={props.query}
          onChange={function (event) { props.setQuery(event.target.value); }}
          placeholder="SEARCH PHOTOS, ALBUMS, TAGS, DATES"
        />
        {active ? <button type="button" onClick={function () { props.setQuery(""); props.setFilter("all"); props.setFromDate(""); props.setToDate(""); props.setMinRating(""); }}>CLEAR</button> : null}
      </div>

      {props.advancedSearchOpen ? (
        <div className="searchAdvanced">
          <input value={props.fromDate} onChange={function (event) { props.setFromDate(event.target.value); }} placeholder="FROM DATE" />
          <input value={props.toDate} onChange={function (event) { props.setToDate(event.target.value); }} placeholder="TO DATE" />
        </div>
      ) : null}

      <div className="searchFilters">
        {PRIMARY_SEARCH_FILTERS.map(function (filter) {
          return (
            <button
              key={filter}
              type="button"
              className={props.filter === filter ? "active" : ""}
              onClick={function () { props.setFilter(filter); }}
            >
              {filterLabel(filter)}
            </button>
          );
        })}
        <button type="button" className={props.advancedSearchOpen ? "active" : ""} onClick={function () { props.setAdvancedSearchOpen(function (value) { return !value; }); }}>
          MORE
        </button>
      </div>

      {props.advancedSearchOpen ? (
        <div className="searchFilters advancedFilterRow">
          {ADVANCED_SEARCH_FILTERS.map(function (filter) {
            return (
              <button
                key={filter}
                type="button"
                className={props.filter === filter ? "active" : ""}
                onClick={function () { props.setFilter(filter); }}
              >
                {filterLabel(filter)}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="searchMeta">
        <span>Find photos.</span>
      </div>

      {!results.length ? <EmptyState title={active ? "NO RESULTS" : "SEARCH"}>{active ? "Nothing matched this search." : "Find photos."}</EmptyState> : null}
      <div className="photoGrid">
        {results.map(function (memory) {
          return <PhotoCard key={memory.id} memory={memory} showText selectionMode={props.selectionMode} selected={props.selectedIds && props.selectedIds[memory.id]} toggleSelected={props.toggleSelected} isStarred={props.starredIds && props.starredIds[memory.id]} onDelete={props.deleteMemory} onClick={function () { props.openMemory(memory); }} />;
        })}
      </div>
    </div>
  );
}

function GroupView(props) {
  return (
    <Glass className="groupView">
      <VisibleReporter items={props.group.items} reportVisibleIds={props.reportVisibleIds} />
      <div className="groupTop">
        <button type="button" onClick={props.back}><ChevronLeft size={16} /> BACK</button>
        <Pill>{props.group.items.length}</Pill>
      </div>
      <h1>{up(props.group.title)}</h1>
      <div className="photoGrid">
        {sortMemories(props.group.items, props.sortMode).map(function (memory) {
          return <PhotoCard key={memory.id} memory={memory} showText selectionMode={props.selectionMode} selected={props.selectedIds && props.selectedIds[memory.id]} toggleSelected={props.toggleSelected} isStarred={props.starredIds && props.starredIds[memory.id]} onDelete={props.deleteMemory} onClick={function () { props.openMemory(memory); }} />;
        })}
      </div>
    </Glass>
  );
}

function Modal(props) {
  const [selectedAlbum, setSelectedAlbum] = useState(UNASSIGNED_ALBUM_ID);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftEra, setDraftEra] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [draftCaption, setDraftCaption] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftEvent, setDraftEvent] = useState("");
  const [draftRating, setDraftRating] = useState("0");
  const [draftLabel, setDraftLabel] = useState("");
  const [showMetadata, setShowMetadata] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(function () {
    if (!props.memory) return;
    setDraftTitle(props.memory.title || "");
    setDraftDate(props.memory.date || "");
    setDraftEra(props.memory.era || "Unassigned");
    setDraftTags(formatTags(props.memory.tags));
    setDraftCaption(props.memory.caption || "");
    setDraftLocation(props.memory.location || "");
    setDraftEvent(props.memory.event || "");
    setDraftRating(String(normalizeRating(props.memory.rating)));
    setDraftLabel(props.memory.label || "");
  }, [props.memory]);

  if (!props.memory) return null;

  const currentAlbums = assignableAlbums(props.albums).filter(function (album) {
    return albumHasMemory(props.albums, album.id, props.memory.id);
  });
  const availableAlbums = assignableAlbums(props.albums);

  return (
    <AnimatePresence>
      <motion.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={props.close}>
        <motion.div className="modalCard" initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} onClick={function (event) { event.stopPropagation(); }}>
          <div className="modalTop">
            <div>
              <h2>{up(props.memory.title)}</h2>
              <p>{props.memory.fileName}</p>
            </div>
            <div className="modalActions">
              <button type="button" onClick={function () { props.toggleStar(props.memory); }}>{props.isStarred ? "UNSTAR" : "STAR"}</button>
              <button type="button" onClick={function () { props.toggleMeFlag(props.memory); }}>{props.memory.isMe ? "UNMARK ME" : "MARK ME"}</button>
              <button type="button" onClick={function () { props.toggleMirror(props.memory); }}>{props.memory.inMirror ? "REMOVE FROM MIRROR" : "MOVE TO MIRROR"}</button>
              <button type="button" onClick={function () { props.toggleArchive(props.memory); }}>{props.memory.archived ? "UNARCHIVE" : "ARCHIVE"}</button>
              
              <button type="button" onClick={function () { props.openOriginal(props.memory); }}>Open</button>
              <button type="button" onClick={function () { props.downloadOriginal(props.memory); }}>Download</button>
              <button type="button" onClick={function () { props.copyMediaUrl(props.memory); }}>Copy link</button>
              <button type="button" onClick={function () { props.copyStorageKey(props.memory); }}>Copy key</button>
              <button type="button" onClick={function () { setShowMetadata(function (value) { return !value; }); }}>METADATA</button>
              {props.memory.trashed ? <button type="button" onClick={function () { props.restoreMemory(props.memory); }}>Restore</button> : null}
              <button type="button" onClick={function () { props.deleteMemory(props.memory); }}>{props.memory.trashed ? "DELETE FOREVER" : "TRASH"}</button>
              <button type="button" onClick={props.close}><X size={18} /></button>
            </div>
          </div>

          <PhotoCard memory={{ ...props.memory, previewUrl: props.memory.storageUrl }} className="modalPhoto" isStarred={props.isStarred} />

          <button type="button" className="technicalToggle" onClick={function () { setShowTechnical(function (value) { return !value; }); }}>
            {showTechnical ? "HIDE FILE DETAILS" : "FILE DETAILS"}
          </button>

          {showTechnical ? (
            <div className="fileInfoRow technicalDetails">
              <span>{up(props.memory.kind || "file")}</span>
              <span>{formatBytes(fileSizeBytes(props.memory))}</span>
              <span>{props.memory.uploadStatus ? up(props.memory.uploadStatus) : "LOCAL"}</span>
              <span>{props.memory.metadata && props.memory.metadata.webkitRelativePath ? props.memory.metadata.webkitRelativePath : props.memory.storageKey || "NO STORAGE KEY"}</span>
              {props.memory.takeoutMeta && props.memory.takeoutMeta.sidecarPath ? <span>TAKEOUT JSON {props.memory.takeoutMeta.sidecarPath}</span> : null}
            </div>
          ) : null}

          <div className="modalSectionTitle">DETAILS</div>
          <div className="detailsEditPanel">
            <div className="detailsEditGrid">
              <label>
                <span>TITLE</span>
                <input value={draftTitle} onChange={function (event) { setDraftTitle(event.target.value); }} />
              </label>
              <label>
                <span>DATE</span>
                <input value={draftDate} onChange={function (event) { setDraftDate(event.target.value); }} placeholder="May 29, 2026" />
              </label>
              <label>
                <span>ERA</span>
                <input value={draftEra} onChange={function (event) { setDraftEra(event.target.value); }} />
              </label>
              <label>
                <span>TAGS</span>
                <input value={draftTags} onChange={function (event) { setDraftTags(event.target.value); }} placeholder="video, cover, shoot" />
              </label>
              <label>
                <span>CAPTION</span>
                <input value={draftCaption} onChange={function (event) { setDraftCaption(event.target.value); }} placeholder="NOTES" />
              </label>
              <label>
                <span>LOCATION</span>
                <input value={draftLocation} onChange={function (event) { setDraftLocation(event.target.value); }} placeholder="PLACE" />
              </label>
              <label>
                <span>EVENT</span>
                <input value={draftEvent} onChange={function (event) { setDraftEvent(event.target.value); }} placeholder="EVENT" />
              </label>
              
              <button type="button" onClick={function () { props.updateMemoryDetails(props.memory, { title: draftTitle, date: draftDate, era: draftEra, tags: draftTags, caption: draftCaption, location: draftLocation, event: draftEvent }); }}>Save</button>
            </div>
          </div>

          <div className="modalSectionTitle">ORGANIZE</div>
          <div className="albumAssignPanel">
            <div>
              <strong>ALBUMS</strong>
              <span>{currentAlbums.length ? currentAlbums.map(function (album) { return album.title; }).join(" / ") : "NONE"}</span>
            </div>
            <div className="albumAssignControls">
              <select value={selectedAlbum} onChange={function (event) { setSelectedAlbum(event.target.value); }}>
                {availableAlbums.map(function (album) {
                  return <option key={album.id} value={album.id}>{album.title}</option>;
                })}
              </select>
              <button type="button" onClick={function () { props.addToAlbum(props.memory, selectedAlbum); }}>ADD</button>
              <button type="button" onClick={function () { props.moveToAlbum(props.memory, selectedAlbum); }}>MOVE</button>
              <button type="button" onClick={function () { props.removeFromAlbum(props.memory, selectedAlbum); }}>REMOVE</button>
              <button type="button" onClick={function () { props.setAlbumCover(props.memory, selectedAlbum); }}>COVER</button>
              <button type="button" onClick={function () { props.clearAlbumCover(selectedAlbum); }}>CLEAR COVER</button>
            </div>
          </div>

          {showMetadata ? <pre>{JSON.stringify(props.memory.metadata || {}, null, 2)}</pre> : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
































export default function App() {
  const [archiveView, setArchiveView] = useState("albums");
  const [activePage, setActivePage] = useState("albums");
  const [screen, setScreen] = useState("home");
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeMemory, setActiveMemory] = useState(null);
  const [memories, setMemories] = useState([]);
  const [albums, setAlbums] = useState(ensureCoreAlbums(INITIAL_ALBUMS));
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [editDescriptionDraft, setEditDescriptionDraft] = useState("");
  const [query, setQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("all");
  const [searchFromDate, setSearchFromDate] = useState("");
  const [searchToDate, setSearchToDate] = useState("");
  const [searchMinRating, setSearchMinRating] = useState("");
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState({});
  const [bulkAlbum, setBulkAlbum] = useState(UNASSIGNED_ALBUM_ID);
  const [bulkText, setBulkText] = useState("");
  const [bulkMoreOpen, setBulkMoreOpen] = useState(false);
  const [importPanelOpen, setImportPanelOpen] = useState(false);
  const [uploadBatchSize, setUploadBatchSize] = useState("250");
  const [uploadConcurrency, setUploadConcurrency] = useState("2");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [uploadPaused, setUploadPaused] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importAdvancedOpen, setImportAdvancedOpen] = useState(false);
  const [uploadQueueOpen, setUploadQueueOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const uploadFileRefs = useRef({});
  const [viewControlsOpen, setViewControlsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [sortMode, setSortMode] = useState("newest");
  const [healthOpen, setHealthOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(false);
  const [missingReport, setMissingReport] = useState(null);
  const [gridSize, setGridSize] = useState("normal");
  const [albumQuery, setAlbumQuery] = useState("");
    const [albumCreateOpen, setAlbumCreateOpen] = useState(false);
  const [currentAlbumId, setCurrentAlbumId] = useState("");
const [albumSort, setAlbumSort] = useState("recent");
  const [visibleIds, setVisibleIds] = useState([]);
  const [sync, setSync] = useState("loading");
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const saving = useRef(false);

  useEffect(function () {
    let alive = true;
    loadIndex().then(function (index) {
      if (!alive) return;
      setMemories(normalizeVaultIndex(normalizeVaultIndex(index)).memories);
      setAlbums(ensureAlbumCoverage(index.memories, index.albums));
      setSync("saved");
    }).catch(function () {
      if (alive) setSync("local");
    });
    return function () { alive = false; };
  }, []);

  function rememberUndo(label) {
    setUndoSnapshot({
      label: label || "LAST ACTION",
      memories: memories,
      albums: albums,
      activeMemory: activeMemory,
      activeGroup: activeGroup,
      createdAt: new Date().toISOString(),
    });
  }

  function undoLastAction() {
    if (!undoSnapshot) return;
    setMemories(normalizeVaultIndex(normalizeVaultIndex(undoSnapshot)).memories);
    setAlbums(ensureCoreAlbums(normalizeVaultIndex(normalizeVaultIndex(undoSnapshot)).albums));
    setActiveMemory(undoSnapshot.activeMemory || null);
    setActiveGroup(undoSnapshot.activeGroup || null);
    persist(undoSnapshot.memories, undoSnapshot.albums);
    setUndoSnapshot(null);
  }

  function persist(nextMemories, nextAlbums) {
    const normalizedIndex = normalizeVaultIndex({ memories: nextMemories, albums: nextAlbums });
    if (saving.current) return;
    saving.current = true;
    setSync("saving");
    saveIndex(normalizedIndex.memories, ensureCoreAlbums(normalizedIndex.albums)).then(function (ok) {
      setSync(ok ? "saved" : "local");
      saving.current = false;
    }).catch(function () {
      setSync("local");
      saving.current = false;
    });
  }

  function openGroup(group) {
    if (group && group.sourceId && !group.virtual && activePage === "albums") {
      setCurrentAlbumId(String(group.sourceId));
      setAlbumQuery("");
      setAlbumCreateOpen(false);
      setScreen("home");
      setActiveGroup(null);
      return;
    }
    setActiveGroup(group);
    setScreen("group");
  }

  function goHome() {
    setScreen("home");
    setActiveGroup(null);
  }

  function toggleAlbumExcludeFromAll(albumId) {
    const next = albums.map(function (album) {
      if (String(album.id) !== String(albumId)) return album;
      return { ...album, excludeFromAll: !Boolean(album.excludeFromAll), updatedAt: new Date().toISOString() };
    });
    setAlbums(next);
    persist(memories, next);
  }

  function createAlbum() {
    const name = draft.trim();
    if (!name || albumTitleExists(albums, name)) return;
    const nextAlbum = {
      id: "custom-" + safeName(name.toLowerCase()) + "-" + Date.now(),
      title: name,
      description: "",
      parentId: currentAlbumId || "",
      excludeFromAll: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      memoryIds: [],
    };
    const next = ensureAlbumCoverage(memories, albums.concat([nextAlbum]));
    setAlbums(next);
    setDraft("");
    setAlbumCreateOpen(false);
    persist(memories, next);
  }

  function toggleAlbumLock(id) {
    if (id === UNASSIGNED_ALBUM_ID || id === "star") return;
    const next = albums.map(function (album) {
      return album.id === id ? { ...album, locked: !Boolean(album.locked), updatedAt: new Date().toISOString() } : album;
    });
    setAlbums(next);
    persist(memories, next);
  }

  function toggleAlbumPin(id) {
    const next = albums.map(function (album) {
      return album.id === id ? { ...album, pinned: !Boolean(album.pinned), updatedAt: new Date().toISOString() } : album;
    });
    setAlbums(next);
    persist(memories, next);
  }

  function deleteAlbum(id) {
    const album = albums.find(function (item) { return item.id === id; });
    if (id === UNASSIGNED_ALBUM_ID || (album && album.locked)) return;
    const next = ensureAlbumCoverage(memories, removeAlbum(albums, id));
    setAlbums(next);
    if (editingId === id) {
      setEditingId(null);
      setEditDraft("");
    setEditDescriptionDraft("");
    }
    persist(memories, next);
  }

  function startEdit(id, title, description) {
    setEditingId(id);
    setEditDraft(title);
    setEditDescriptionDraft(description || "");
  }

  function saveEdit() {
    if (!editingId) return;
    const next = ensureAlbumCoverage(memories, updateAlbumDetails(albums, editingId, editDraft, editDescriptionDraft));
    setAlbums(next);
    setEditingId(null);
    setEditDraft("");
    persist(memories, next);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  function clearLocalFailedStatus() {
    const nextMemories = memories.map(function (memory) {
      if (memory.uploadStatus === "failed" || memory.uploadStatus === "local") {
        return { ...memory, uploadStatus: "needs-file" };
      }
      return memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function repairIndex() {
    const memoryIds = {};
    memories.forEach(function (memory) { memoryIds[memory.id] = true; });

    const cleanedAlbums = albums.map(function (album) {
      return {
        ...album,
        memoryIds: Array.from(new Set((album.memoryIds || []).filter(function (id) { return memoryIds[id]; }))),
        updatedAt: album.updatedAt || new Date().toISOString(),
      };
    });

    const coveredAlbums = ensureAlbumCoverage(memories, cleanedAlbums);
    const report = validateIndex(memories, coveredAlbums);
    setAlbums(coveredAlbums);
    setHealth(function (current) {
      return { ...(current || {}), repairedAt: new Date().toISOString(), repairReport: report };
    });
    persist(memories, coveredAlbums);
  }

  function runRouteCheck() {
    Promise.all([
      fetch("/api/access").then(function (res) { return res.ok; }).catch(function () { return false; }),
      fetch("/api/health").then(function (res) { return res.ok; }).catch(function () { return false; }),
    ]).then(function (checks) {
      setHealth(function (current) {
        return { ...(current || {}), routeCheck: { access: checks[0], health: checks[1], checkedAt: new Date().toISOString() } };
      });
    });
  }

  function runMissingCheck() {
    checkMissingFiles(memories)
      .then(function (result) {
        setMissingReport(result);
      })
      .catch(function () {
        setMissingReport({ checked: 0, missing: 0 });
      });
  }

  function runHealthCheck() {
    setHealthError(false);
    fetchHealth()
      .then(function (result) {
        setHealth(result);
      })
      .catch(function () {
        setHealthError(true);
      });
  }

  function exportSelectedJson() {
    const ids = selectedMemoryIds(selectedIds);
    const selected = memories.filter(function (memory) { return ids.indexOf(memory.id) !== -1; });
    downloadJson("photoz-selected-" + new Date().toISOString().slice(0, 10) + ".json", { version: 1, exportedAt: new Date().toISOString(), memories: selected, albums: albums });
  }

  function exportManifestCsv() {
    downloadText("photoz-manifest-" + new Date().toISOString().slice(0, 10) + ".csv", memoriesToCsv(memories, albums), "text/csv");
  }

  function exportVaultIndex() {
    downloadJson("photoz-vault-index-" + new Date().toISOString().slice(0, 10) + ".json", cleanIndex({ memories: memories, albums: albums }));
  }

  function importVaultIndex(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function () {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const restored = cleanIndex(parsed);
        setMemories(normalizeVaultIndex(normalizeVaultIndex(restored)).memories);
        setAlbums(ensureCoreAlbums(normalizeVaultIndex(normalizeVaultIndex(restored)).albums));
        setActiveMemory(null);
        setActiveGroup(null);
        setSelectedIds({});
        setSync("saving");
        saveIndex(restored.memories, restored.albums).then(function (ok) {
          setSync(ok ? "saved" : "local");
        });
      } catch (error) {
        setSync("local");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function clearSelection() {
    setSelectedIds({});
  }

  function selectAll() {
    const next = {};
    memories.forEach(function (memory) {
      next[memory.id] = true;
    });
    setSelectedIds(next);
  }

  function selectVisible() {
    const next = {};
    visibleIds.forEach(function (id) {
      next[id] = true;
    });
    setSelectedIds(next);
  }

  function invertSelection() {
    const next = {};
    memories.forEach(function (memory) {
      next[memory.id] = !selectedIds[memory.id];
    });
    setSelectedIds(next);
  }

  function toggleSelectionMode() {
    setSelectionMode(function (value) {
      if (value) setSelectedIds({});
      return !value;
    });
  }

  function toggleSelected(id) {
    setSelectedIds(function (current) {
      return { ...current, [id]: !current[id] };
    });
  }

  function retryUpload(memory) {
    if (!memory || !memory.storageKey) return;
    setMemories(function (list) {
      return list.map(function (item) {
        return item.id === memory.id ? { ...item, uploadStatus: "local" } : item;
      });
    });
    setSync("local");
  }

  function selectedMemories() {
    const ids = selectedMemoryIds(selectedIds);
    return memories.filter(function (memory) {
      return ids.indexOf(memory.id) !== -1;
    });
  }

  function bulkAddToAlbum() {
    const ids = selectedMemoryIds(selectedIds);
    let nextAlbums = albums;
    ids.forEach(function (id) {
      nextAlbums = addMemoryToAlbum(nextAlbums, bulkAlbum, id);
      if (bulkAlbum !== UNASSIGNED_ALBUM_ID) nextAlbums = removeMemoryFromAlbum(nextAlbums, UNASSIGNED_ALBUM_ID, id);
    });
    nextAlbums = ensureAlbumCoverage(memories, nextAlbums);
    setAlbums(nextAlbums);
    persist(memories, nextAlbums);
  }

  function bulkMoveToAlbum() {
    rememberUndo("BULK MOVE");
    
    const ids = selectedMemoryIds(selectedIds);
    let nextAlbums = albums;
    ids.forEach(function (id) {
      nextAlbums = removeMemoryEverywhere(nextAlbums, id);
      nextAlbums = addMemoryToAlbum(nextAlbums, bulkAlbum, id);
    });
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, inMirror: false } : memory;
    });
    nextAlbums = ensureAlbumCoverage(nextMemories, nextAlbums);
    setMemories(nextMemories);
    setAlbums(nextAlbums);
    persist(nextMemories, nextAlbums);
  }

  function bulkStar() {
    const ids = selectedMemoryIds(selectedIds);
    let nextAlbums = albums;
    ids.forEach(function (id) {
      nextAlbums = addMemoryToAlbum(nextAlbums, "star", id);
    });
    setAlbums(nextAlbums);
    persist(memories, nextAlbums);
  }

  function bulkUnstar() {
    const ids = selectedMemoryIds(selectedIds);
    let nextAlbums = albums;
    ids.forEach(function (id) {
      nextAlbums = removeMemoryFromAlbum(nextAlbums, "star", id);
    });
    setAlbums(nextAlbums);
    persist(memories, nextAlbums);
  }

  function bulkApplyTags() {
    const ids = selectedMemoryIds(selectedIds);
    const tags = parseTags(bulkText);
    if (!tags.length) return;
    const nextMemories = memories.map(function (memory) {
      if (ids.indexOf(memory.id) === -1) return memory;
      return { ...memory, tags: Array.from(new Set((memory.tags || []).concat(tags))) };
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkClearTags() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, tags: [] } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkSetEra() {
    const ids = selectedMemoryIds(selectedIds);
    const era = String(bulkText || "").trim();
    if (!era) return;
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, era: era } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkSetCaption() {
    const ids = selectedMemoryIds(selectedIds);
    const value = String(bulkText || "").trim();
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, caption: value, updatedAt: new Date().toISOString() } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkSetLocation() {
    const ids = selectedMemoryIds(selectedIds);
    const value = String(bulkText || "").trim();
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, location: value, updatedAt: new Date().toISOString() } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkSetEvent() {
    const ids = selectedMemoryIds(selectedIds);
    const value = String(bulkText || "").trim();
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, event: value, updatedAt: new Date().toISOString() } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkClearTextFields() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, caption: "", location: "", event: "", updatedAt: new Date().toISOString() } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkSetRating() {
    const ids = selectedMemoryIds(selectedIds);
    const rating = normalizeRating(bulkText);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, rating: rating } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkClearRating() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, rating: 0 } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkSetLabel() {
    const ids = selectedMemoryIds(selectedIds);
    const label = normalizeLabel(bulkText);
    if (!label) return;
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, label: label } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkClearLabel() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, label: "" } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkMarkReview() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, review: true } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkClearReview() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, review: false } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkMarkPrivate() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, private: true } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkClearPrivate() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, private: false } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkMarkMe() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, isMe: true } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkUnmarkMe() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, isMe: false } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkMoveToMirror() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, inMirror: true } : memory;
    });
    let nextAlbums = albums;
    ids.forEach(function (id) {
      nextAlbums = removeMemoryEverywhere(nextAlbums, id);
    });
    nextAlbums = ensureAlbumCoverage(nextMemories, nextAlbums);
    setMemories(nextMemories);
    setAlbums(nextAlbums);
    persist(nextMemories, nextAlbums);
  }

  function bulkRestore() {
    rememberUndo("BULK RESTORE");
    
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, trashed: false, deletedAt: "" } : memory;
    });
    const nextAlbums = ensureAlbumCoverage(nextMemories, albums);
    setMemories(nextMemories);
    setAlbums(nextAlbums);
    persist(nextMemories, nextAlbums);
  }

  function bulkArchive() {
    rememberUndo("BULK ARCHIVE");
    
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, archived: true } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkUnarchive() {
    rememberUndo("BULK UNARCHIVE");
    
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, archived: false } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkRemoveFromMirror() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, inMirror: false } : memory;
    });
    const nextAlbums = ensureAlbumCoverage(nextMemories, albums);
    setMemories(nextMemories);
    setAlbums(nextAlbums);
    persist(nextMemories, nextAlbums);
  }

  function trashDuplicateOthers(group, keepId) {
    if (!group || !group.length) return;
    rememberUndo("DUPLICATES");
    const ids = group.filter(function (memory) { return memory.id !== keepId; }).map(function (memory) { return memory.id; });
    if (!ids.length) return;
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, trashed: true, deletedAt: new Date().toISOString(), inMirror: false } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkDelete() {
    rememberUndo("BULK TRASH");
    
    const ids = selectedMemoryIds(selectedIds);
    if (!ids.length) return;

    const selected = memories.filter(function (memory) { return ids.indexOf(memory.id) !== -1; });
    const allAlreadyTrashed = selected.length && selected.every(function (memory) { return memory.trashed; });

    if (!allAlreadyTrashed) {
      const nextMemories = memories.map(function (memory) {
        return ids.indexOf(memory.id) !== -1 ? { ...memory, trashed: true, deletedAt: new Date().toISOString(), inMirror: false } : memory;
      });
      setMemories(nextMemories);
      setSelectedIds({});
      persist(nextMemories, albums);
      return;
    }

    if (!confirmDelete("Permanently delete " + ids.length + " selected trashed files from PHOTOZ and R2? This cannot be undone.")) return;

    const doomed = selected;
    const nextMemories = memories.filter(function (memory) {
      return ids.indexOf(memory.id) === -1;
    });
    const nextAlbums = ensureAlbumCoverage(nextMemories, ids.reduce(function (currentAlbums, id) {
      return removeMemoryEverywhere(currentAlbums, id);
    }, albums));

    setMemories(nextMemories);
    setAlbums(nextAlbums);
    setSelectedIds({});
    setSync("deleting");

    Promise.all(doomed.map(deleteOne)).finally(function () {
      persist(nextMemories, nextAlbums);
    });
  }

  function toggleStar(memory) {
    if (!memory) return;
    const inStar = albumHasMemory(albums, "star", memory.id);
    const nextAlbums = inStar ? removeMemoryFromAlbum(albums, "star", memory.id) : addMemoryToAlbum(albums, "star", memory.id);
    setAlbums(nextAlbums);
    persist(memories, nextAlbums);
  }

  function clearAlbumCover(albumId) {
    if (!albumId) return;
    const nextAlbums = albums.map(function (album) {
      return album.id === albumId ? { ...album, coverId: null, updatedAt: new Date().toISOString() } : album;
    });
    setAlbums(nextAlbums);
    persist(memories, nextAlbums);
  }

  function setAlbumCover(memory, albumId) {
    if (!memory || !albumId) return;
    const nextAlbums = albums.map(function (album) {
      return album.id === albumId ? { ...album, coverId: memory.id, updatedAt: new Date().toISOString() } : album;
    });
    setAlbums(nextAlbums);
    persist(memories, nextAlbums);
  }

  function updateMemoryDetails(memory, patch) {
    if (!memory) return;
    const title = String(patch.title || "").trim() || memory.title;
    const date = String(patch.date || "").trim() || memory.date;
    const era = String(patch.era || "").trim() || "Unassigned";
    const tags = parseTags(patch.tags);
    const caption = String(patch.caption || "").trim();
    const location = String(patch.location || "").trim();
    const eventName = String(patch.event || "").trim();
    const rating = normalizeRating(patch.rating);
    const label = normalizeLabel(patch.label);

    const nextMemories = memories.map(function (item) {
      if (item.id !== memory.id) return item;
      return {
        ...item,
        title: title,
        date: date,
        era: era,
        tags: tags,
        caption: caption,
        location: location,
        event: eventName,
        rating: rating,
        label: label,
        updatedAt: new Date().toISOString(),
        year: yearFromDateText(date, item.year),
        month: monthFromDateText(date, item.month),
        sort: sortFromDateText(date, item.sort),
      };
    });

    const nextActive = nextMemories.find(function (item) {
      return item.id === memory.id;
    });

    setMemories(nextMemories);
    setActiveMemory(nextActive || null);
    persist(nextMemories, albums);
  }

  function addToAlbum(memory, albumId) {
    rememberUndo("ALBUM CHANGE");
    
    if (!memory || !albumId) return;
    let nextAlbums = addMemoryToAlbum(albums, albumId, memory.id);
    if (albumId !== UNASSIGNED_ALBUM_ID) {
      nextAlbums = removeMemoryFromAlbum(nextAlbums, UNASSIGNED_ALBUM_ID, memory.id);
    }
    nextAlbums = ensureAlbumCoverage(memories, nextAlbums);
    setAlbums(nextAlbums);
    persist(memories, nextAlbums);
  }

  function moveToAlbum(memory, albumId) {
    rememberUndo("MOVED FILE");
    
    if (!memory || !albumId) return;
    let nextAlbums = removeMemoryEverywhere(albums, memory.id);
    nextAlbums = addMemoryToAlbum(nextAlbums, albumId, memory.id);
    const nextMemories = memories.map(function (item) {
      return item.id === memory.id ? { ...item, inMirror: false } : item;
    });
    const nextActive = nextMemories.find(function (item) {
      return item.id === memory.id;
    });
    nextAlbums = ensureAlbumCoverage(nextMemories, nextAlbums);
    setMemories(nextMemories);
    setAlbums(nextAlbums);
    setActiveMemory(nextActive || null);
    persist(nextMemories, nextAlbums);
  }

  function removeFromAlbum(memory, albumId) {
    rememberUndo("ALBUM CHANGE");
    
    if (!memory || !albumId) return;
    const nextAlbums = ensureAlbumCoverage(memories, removeMemoryFromAlbum(albums, albumId, memory.id));
    setAlbums(nextAlbums);
    persist(memories, nextAlbums);
  }

  function toggleMeFlag(memory) {
    if (!memory) return;
    const nextMemories = memories.map(function (item) {
      return item.id === memory.id ? { ...item, isMe: !Boolean(item.isMe) } : item;
    });
    const nextActive = nextMemories.find(function (item) {
      return item.id === memory.id;
    });
    setMemories(nextMemories);
    setActiveMemory(nextActive || null);
    persist(nextMemories, albums);
  }

  function toggleReview(memory) {
    if (!memory) return;
    const nextMemories = memories.map(function (item) {
      return item.id === memory.id ? { ...item, review: !Boolean(item.review) } : item;
    });
    const nextActive = nextMemories.find(function (item) { return item.id === memory.id; });
    setMemories(nextMemories);
    setActiveMemory(nextActive || null);
    persist(nextMemories, albums);
  }

  function togglePrivate(memory) {
    if (!memory) return;
    const nextMemories = memories.map(function (item) {
      return item.id === memory.id ? { ...item, private: !Boolean(item.private) } : item;
    });
    const nextActive = nextMemories.find(function (item) { return item.id === memory.id; });
    setMemories(nextMemories);
    setActiveMemory(nextActive || null);
    persist(nextMemories, albums);
  }

  function toggleArchive(memory) {
    rememberUndo("ARCHIVE CHANGE");
    
    if (!memory) return;
    const nextMemories = memories.map(function (item) {
      return item.id === memory.id ? { ...item, archived: !Boolean(item.archived) } : item;
    });
    const nextActive = nextMemories.find(function (item) {
      return item.id === memory.id;
    });
    setMemories(nextMemories);
    setActiveMemory(nextActive || null);
    persist(nextMemories, albums);
  }

  function toggleMirror(memory) {
    rememberUndo("MIRROR CHANGE");
    
    if (!memory) return;
    const nextMemories = memories.map(function (item) {
      return item.id === memory.id ? { ...item, inMirror: !Boolean(item.inMirror) } : item;
    });
    const nextMemory = nextMemories.find(function (item) {
      return item.id === memory.id;
    });

    let nextAlbums = albums;
    if (nextMemory && nextMemory.inMirror) {
      nextAlbums = removeMemoryEverywhere(albums, memory.id);
    }
    nextAlbums = ensureAlbumCoverage(nextMemories, nextAlbums);

    setMemories(nextMemories);
    setAlbums(nextAlbums);
    setActiveMemory(nextMemory || null);
    persist(nextMemories, nextAlbums);
  }

  function restoreMemory(memory) {
    rememberUndo("RESTORE");
    
    if (!memory) return;
    const nextMemories = memories.map(function (item) {
      return item.id === memory.id ? { ...item, trashed: false, deletedAt: "" } : item;
    });
    const nextAlbums = ensureAlbumCoverage(nextMemories, albums);
    const nextActive = nextMemories.find(function (item) { return item.id === memory.id; });
    setMemories(nextMemories);
    setAlbums(nextAlbums);
    setActiveMemory(nextActive || null);
    persist(nextMemories, nextAlbums);
  }

  function purgeTrash() {
    const doomed = memories.filter(function (memory) { return memory.trashed; });
    if (!doomed.length) return;
    if (!confirmDelete("Permanently delete " + doomed.length + " trashed files from R2? This cannot be undone.")) return;
    const doomedIds = doomed.map(function (memory) { return memory.id; });
    const nextMemories = memories.filter(function (memory) { return !memory.trashed; });
    const nextAlbums = ensureAlbumCoverage(nextMemories, doomedIds.reduce(function (currentAlbums, id) {
      return removeMemoryEverywhere(currentAlbums, id);
    }, albums));
    setMemories(nextMemories);
    setAlbums(nextAlbums);
    setSync("deleting");
    Promise.all(doomed.map(deleteOne)).finally(function () {
      persist(nextMemories, nextAlbums);
    });
  }

  function deleteMemory(memory) {
    rememberUndo("TRASH");
    
    if (!memory) return;
    if (!memory.trashed) {
      const nextMemories = memories.map(function (item) {
        return item.id === memory.id ? { ...item, trashed: true, deletedAt: new Date().toISOString(), inMirror: false } : item;
      });
      const nextActive = nextMemories.find(function (item) { return item.id === memory.id; });
      setActiveMemory(nextActive || null);
      setMemories(nextMemories);
      persist(nextMemories, albums);
      return;
    }

    if (!confirmDelete("Permanently delete this file from PHOTOZ and R2? This cannot be undone.")) return;
    const nextMemories = memories.filter(function (item) {
      return item.id !== memory.id;
    });
    const nextAlbums = ensureAlbumCoverage(nextMemories, removeMemoryEverywhere(albums, memory.id));

    setActiveMemory(null);
    if (activeGroup) {
      setActiveGroup({
        ...activeGroup,
        items: activeGroup.items.filter(function (item) {
          return item.id !== memory.id;
        }),
      });
    }

    setMemories(nextMemories);
    setAlbums(nextAlbums);
    setSync("deleting");

    deleteOne(memory)
      .then(function () {
        persist(nextMemories, nextAlbums);
      })
      .catch(function () {
        setSync("local");
        persist(nextMemories, nextAlbums);
      });
  }

  async function runQueue(imported, files, nextAlbums) {
    let cursor = 0;
    let active = 0;

    return new Promise(function (resolve) {
      function step() {
        if (cursor >= imported.length && active === 0) {
          resolve(true);
          return;
        }

        while (active < MAX_PARALLEL_UPLOADS && cursor < imported.length) {
          const index = cursor;
          const memory = imported[index];
          const file = files[index];
          cursor += 1;
          active += 1;

          if (uploadPaused) {
            if (memory.queueId) updateQueueItem(memory.queueId, { status: "queued" });
            active -= 1;
            setTimeout(step, 250);
            return;
          }
          if (memory.queueId) updateQueueItem(memory.queueId, { status: "uploading" });
          memory.uploadStatus = "uploading";
          setMemories(function (list) {
            return list.map(function (item) {
              return item.id === memory.id ? { ...memory } : item;
            });
          });

          uploadOne(memory, file)
            .then(function (ok) {
              memory.uploadStatus = ok ? "r2" : "failed";
              if (memory.queueId) updateQueueItem(memory.queueId, { status: ok ? "done" : "failed" });
            })
            .catch(function () {
              memory.uploadStatus = "failed";
              if (memory.queueId) updateQueueItem(memory.queueId, { status: "failed" });
            })
            .then(function () {
              setMemories(function (list) {
                return list.map(function (item) {
                  return item.id === memory.id ? { ...memory } : item;
                });
              });
              active -= 1;
              step();
            });
        }
      }
      step();
    }).then(function () {
      setMemories(function (current) {
        persist(current, nextAlbums);
        return current;
      });
    });
  }

  useEffect(function () {
    if (!uploadPaused && pendingQueueCount(uploadQueue) > 0) {
      scheduleUploads(memories, albums);
    }
  }, [uploadPaused, uploadConcurrency, uploadQueue.length]);

  function reloadIndex() {
    loadIndex().then(function (index) {
      const clean = cleanIndex(index);
      setMemories(normalizeVaultIndex(normalizeVaultIndex(clean)).memories);
      setAlbums(ensureCoreAlbums(normalizeVaultIndex(normalizeVaultIndex(clean)).albums));
      setSync("saved");
    });
  }

  function updateQueueItem(id, patch) {
    setUploadQueue(function (items) {
      return items.map(function (item) {
        return item.id === id ? { ...item, ...patch } : item;
      });
    });
  }

  function markQueueItem(id, patch) {
    updateQueueItem(id, patch);
  }

  function scheduleUploads(nextMemories, nextAlbums) {
    if (uploadPaused) return;
    const limit = clampNumber(uploadConcurrency, 2, 1, 6);

    setUploadQueue(function (items) {
      const active = activeQueueCount(items);
      const available = Math.max(0, limit - active);
      const toStart = items.filter(function (item) {
        return item.status === "queued" && uploadFileRefs.current[item.id];
      }).slice(0, available);

      if (!toStart.length) return items;

      toStart.forEach(function (queueItem) {
        const pair = uploadFileRefs.current[queueItem.id];
        if (!pair || !pair.file || !pair.memory) return;

        pair.memory.uploadStatus = "uploading";
        uploadOne(pair.memory, pair.file)
          .then(function (ok) {
            pair.memory.uploadStatus = ok ? "r2" : "failed";
            markQueueItem(queueItem.id, { status: ok ? "done" : "failed" });
            setMemories(function (list) {
              const updated = list.map(function (item) {
                return item.id === pair.memory.id ? { ...pair.memory } : item;
              });
              saveIndex(updated, nextAlbums || albums);
              return updated;
            });
          })
          .catch(function () {
            pair.memory.uploadStatus = "failed";
            markQueueItem(queueItem.id, { status: "failed" });
            setMemories(function (list) {
              const updated = list.map(function (item) {
                return item.id === pair.memory.id ? { ...pair.memory } : item;
              });
              saveIndex(updated, nextAlbums || albums);
              return updated;
            });
          })
          .finally(function () {
            setTimeout(function () {
              scheduleUploads(nextMemories || memories, nextAlbums || albums);
            }, 25);
          });
      });

      const starting = {};
      toStart.forEach(function (item) { starting[item.id] = true; });
      return items.map(function (item) {
        return starting[item.id] ? { ...item, status: "uploading" } : item;
      });
    });
  }

  function retryFailedUploads() {
    setUploadQueue(function (items) {
      return items.map(function (item) {
        if (item.status === "failed" && uploadFileRefs.current[item.id]) {
          const pair = uploadFileRefs.current[item.id];
          if (pair && pair.memory) pair.memory.uploadStatus = "queued";
          return { ...item, status: "queued" };
        }
        return item;
      });
    });
    setTimeout(function () {
      scheduleUploads(memories, albums);
    }, 50);
  }

  function handleUpload(event) {
    const files = Array.prototype.slice.call(event.target.files || []).filter(function (file) {
      return file.type && (file.type.indexOf("image") === 0 || file.type.indexOf("video") === 0);
    });
    event.target.value = "";

    if (!files.length) return;

    rememberUndo("IMPORT");
    backupIndex();

    const signatures = existingSignatureMap(memories);
    const plan = uploadPlanStats(files, memories);
    const freshFiles = files.filter(function (file) {
      return !skipDuplicates || !signatures[fileSignature(file)];
    });

    const batchLimit = clampNumber(uploadBatchSize, 250, 10, 2000);
    const batchFiles = freshFiles.slice(0, batchLimit);

    setImportSummary({
      total: plan.total,
      added: batchFiles.length,
      skipped: files.length - batchFiles.length,
      large: plan.large,
      duplicates: plan.duplicates,
      bytes: plan.bytes,
    });
    setImportPanelOpen(true);

    const imported = batchFiles.map(function (file, index) {
      const memory = fromFile(file, index);
      memory.queueId = Date.now() + "-" + index + "-" + safeName(file.name);
      memory.uploadStatus = "queued";
      uploadFileRefs.current[memory.queueId] = { file: file, memory: memory };
      return memory;
    });

    const queueItems = imported.map(function (memory, index) {
      const file = batchFiles[index];
      return {
        id: memory.queueId,
        name: file ? file.name : memory.fileName,
        size: file ? file.size : 0,
        path: file ? (file.webkitRelativePath || file.name) : memory.fileName,
        status: "queued",
      };
    });

    setUploadQueue(function (items) {
      return items.concat(queueItems);
    });
    setUploadQueueOpen(true);

    const nextMemories = memories.concat(imported);
    const nextAlbums = ensureAlbumCoverage(nextMemories, albums);

    setMemories(nextMemories);
    setAlbums(nextAlbums);
    setSync("uploading");
    persist(nextMemories, nextAlbums);

    setTimeout(function () {
      scheduleUploads(nextMemories, nextAlbums);
    }, 50);
  }

  const archive = activePage === "albums";
  const starredIds = starMap(albums);
  const validation = validateIndex(memories, albums);
  const key = screen + "-" + (activeGroup ? activeGroup.id : "home");

  return (
    <div className="app photozProUI">
      <Dock active={activePage} setActive={setActivePage} />
      <main>
        <AnimatePresence mode="wait">
          <motion.div key={key} className="screen" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
            {screen === "home" ? (
              <Glass className={"shell grid-" + gridSize + (toolsOpen || viewControlsOpen || importPanelOpen || uploadQueueOpen || statusOpen || duplicatesOpen || healthOpen ? " has-panel-open" : "")}>
                <div className="productHeader">
                  <strong>{activePage === "albums" ? "Albums" : activePage === "mirror" ? "Mirror" : "Search"}</strong>
                  <em>{memories.length} files</em>
                </div>
                <ControlBar archive={archive} archiveView={archiveView} setArchiveView={setArchiveView} count={memories.length} sync={sync} onUpload={handleUpload} selectionMode={selectionMode} toggleSelectionMode={toggleSelectionMode} viewControlsOpen={viewControlsOpen} toggleViewControls={function () { setViewControlsOpen(function (value) { return !value; }); }} toolsOpen={toolsOpen} toggleToolsPanel={function () { setToolsOpen(function (value) { return !value; }); }} />
                <div className="floatingUtilityRail">
                  <button type="button" className={viewControlsOpen ? "active" : ""} onClick={function () { setToolsOpen(false); setViewControlsOpen(function (value) { return !value; }); }}>Filter</button>
                  <button type="button" className={selectionMode ? "active" : ""} onClick={function () { setSelectionMode(function (value) { return !value; }); }}>{selectionMode ? "Done" : "Select"}</button>
                  <button type="button" className={toolsOpen ? "active" : ""} onClick={function () { setViewControlsOpen(false); setToolsOpen(function (value) { return !value; }); }}>⚙</button>
                </div>
                <ViewPanel open={viewControlsOpen} close={function () { setViewControlsOpen(false); }} sortMode={sortMode} setSortMode={setSortMode} showAlbumSort={activePage === "albums" && archiveView === "albums"} albumSort={albumSort} setAlbumSort={setAlbumSort} gridSize={gridSize} setGridSize={setGridSize} />
                <UndoBar snapshot={undoSnapshot} undo={undoLastAction} clear={function () { setUndoSnapshot(null); }} />
                <ToolsPanel onUpload={handleUpload} open={toolsOpen} close={function () { setToolsOpen(false); }} toggleImportPanel={function () { setImportPanelOpen(function (value) { return !value; }); }} toggleUploadQueuePanel={function () { setUploadQueueOpen(function (value) { return !value; }); }} toggleStatusPanel={function () { setStatusOpen(function (value) { return !value; }); }} toggleDuplicatePanel={function () { setDuplicatesOpen(function (value) { return !value; }); }} toggleHealthPanel={function () { setHealthOpen(function (value) { return !value; }); }} exportVaultIndex={exportVaultIndex} exportManifestCsv={exportManifestCsv} importVaultIndex={importVaultIndex} />
                <ImportPanel open={importPanelOpen} close={function () { setImportPanelOpen(false); }} uploadBatchSize={uploadBatchSize} setUploadBatchSize={setUploadBatchSize} uploadConcurrency={uploadConcurrency} setUploadConcurrency={setUploadConcurrency} skipDuplicates={skipDuplicates} setSkipDuplicates={setSkipDuplicates} importSummary={importSummary} />
                <UploadQueuePanel open={uploadQueueOpen} queue={uploadQueue} paused={uploadPaused} togglePause={function () { setUploadPaused(function (value) { return !value; }); }} retryFailed={retryFailedUploads} close={function () { setUploadQueueOpen(false); }} clearFinished={function () { setUploadQueue(function (items) { return items.filter(function (item) { return item.status === "queued" || item.status === "uploading"; }); }); }} />
                <StatusPanel open={statusOpen} memories={memories} close={function () { setStatusOpen(false); }} retryUpload={retryUpload} clearLocalFailedStatus={clearLocalFailedStatus} purgeTrash={purgeTrash} />
                <DuplicatePanel open={duplicatesOpen} memories={memories} close={function () { setDuplicatesOpen(false); }} openMemory={setActiveMemory} trashDuplicateOthers={trashDuplicateOthers} />
                <HealthPanel open={healthOpen} health={health} healthError={healthError} validation={validation} missingReport={missingReport} close={function () { setHealthOpen(false); }} runHealthCheck={runHealthCheck} runRouteCheck={runRouteCheck} runMissingCheck={runMissingCheck} repairIndex={repairIndex} />
                <BulkBar selectionMode={selectionMode} selectedIds={selectedIds} albums={albums} bulkAlbum={bulkAlbum} setBulkAlbum={setBulkAlbum} bulkText={bulkText} setBulkText={setBulkText} bulkMoreOpen={bulkMoreOpen} toggleBulkMore={function () { setBulkMoreOpen(function (value) { return !value; }); }} selectAll={selectAll} selectVisible={selectVisible} invertSelection={invertSelection} bulkAddToAlbum={bulkAddToAlbum} bulkMoveToAlbum={bulkMoveToAlbum} bulkStar={bulkStar} bulkUnstar={bulkUnstar} bulkMarkMe={bulkMarkMe} bulkUnmarkMe={bulkUnmarkMe} bulkApplyTags={bulkApplyTags} bulkClearTags={bulkClearTags} bulkSetEra={bulkSetEra} bulkSetCaption={bulkSetCaption} bulkSetLocation={bulkSetLocation} bulkSetEvent={bulkSetEvent} bulkClearTextFields={bulkClearTextFields} bulkSetRating={bulkSetRating} bulkClearRating={bulkClearRating} bulkSetLabel={bulkSetLabel} bulkClearLabel={bulkClearLabel} bulkMarkReview={bulkMarkReview} bulkClearReview={bulkClearReview} bulkMarkPrivate={bulkMarkPrivate} bulkClearPrivate={bulkClearPrivate} bulkMoveToMirror={bulkMoveToMirror} bulkRemoveFromMirror={bulkRemoveFromMirror} bulkArchive={bulkArchive} bulkUnarchive={bulkUnarchive} bulkRestore={bulkRestore} exportSelectedJson={exportSelectedJson} bulkDelete={bulkDelete} clearSelection={clearSelection} />
                {activePage === "albums" ? <AlbumsView currentAlbumId={currentAlbumId} setCurrentAlbumId={setCurrentAlbumId} toggleAlbumExcludeFromAll={toggleAlbumExcludeFromAll} albumCreateOpen={albumCreateOpen} setAlbumCreateOpen={setAlbumCreateOpen} archiveView={archiveView} memories={memories} albums={albums} albumQuery={albumQuery} setAlbumQuery={setAlbumQuery} albumSort={albumSort} draft={draft} setDraft={setDraft} createAlbum={createAlbum} deleteAlbum={deleteAlbum} toggleAlbumPin={toggleAlbumPin} toggleAlbumLock={toggleAlbumLock} editingId={editingId} editDraft={editDraft} setEditDraft={setEditDraft} editDescriptionDraft={editDescriptionDraft} setEditDescriptionDraft={setEditDescriptionDraft} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit} openGroup={openGroup} openMemory={setActiveMemory} deleteMemory={deleteMemory} selectionMode={selectionMode} selectedIds={selectedIds} toggleSelected={toggleSelected} starredIds={starredIds} reportVisibleIds={setVisibleIds} /> : null}
                {activePage === "mirror" ? <MirrorView memories={memories} openGroup={openGroup} openMemory={setActiveMemory} deleteMemory={deleteMemory} selectionMode={selectionMode} selectedIds={selectedIds} toggleSelected={toggleSelected} sortMode={sortMode} starredIds={starredIds} reportVisibleIds={setVisibleIds} /> : null}
                {activePage === "search" ? <SearchView memories={memories} albums={albums} query={query} setQuery={setQuery} filter={searchFilter} setFilter={setSearchFilter} fromDate={searchFromDate} setFromDate={setSearchFromDate} toDate={searchToDate} setToDate={setSearchToDate} minRating={searchMinRating} setMinRating={setSearchMinRating} advancedSearchOpen={advancedSearchOpen} setAdvancedSearchOpen={setAdvancedSearchOpen} openMemory={setActiveMemory} deleteMemory={deleteMemory} selectionMode={selectionMode} selectedIds={selectedIds} toggleSelected={toggleSelected} sortMode={sortMode} starredIds={starredIds} reportVisibleIds={setVisibleIds} /> : null}
              </Glass>
            ) : null}
            {screen === "group" && activeGroup ? <GroupView group={activeGroup} back={goHome} openMemory={setActiveMemory} deleteMemory={deleteMemory} selectionMode={selectionMode} selectedIds={selectedIds} toggleSelected={toggleSelected} sortMode={sortMode} starredIds={starredIds} reportVisibleIds={setVisibleIds} /> : null}
          </motion.div>
        </AnimatePresence>
      </main>
      <Modal memory={activeMemory} close={function () { setActiveMemory(null); }} deleteMemory={deleteMemory} restoreMemory={restoreMemory} toggleMeFlag={toggleMeFlag} toggleMirror={toggleMirror} toggleArchive={toggleArchive} toggleReview={toggleReview} togglePrivate={togglePrivate} albums={albums} addToAlbum={addToAlbum} moveToAlbum={moveToAlbum} removeFromAlbum={removeFromAlbum} updateMemoryDetails={updateMemoryDetails} downloadOriginal={downloadOriginal} openOriginal={openOriginal} copyMediaUrl={copyMediaUrl} copyStorageKey={copyStorageKey} toggleStar={toggleStar} isStarred={activeMemory ? albumHasMemory(albums, "star", activeMemory.id) : false} setAlbumCover={setAlbumCover} clearAlbumCover={clearAlbumCover} />
    </div>
  );
}
