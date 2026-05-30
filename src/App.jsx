
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {ChevronLeft, Eye, Images, Search, Upload, X, Trash2, CircleHelp, SlidersHorizontal, CircleCheck, Music2, Volume2, VolumeX, LockKeyhole, UnlockKeyhole, FolderPen, ShieldCheck, Film, Download, PanelRightOpen, ArchiveRestore, Save, AlertTriangle, UploadCloud, Play, Clock3, HardDrive, Sparkles, Maximize2, CalendarDays, RotateCcw, Undo2, Settings, FolderUp, FileDown, Wrench, Star, Image, UserRound, ChevronDown, Glasses} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { FilterPanel } from "./components/FilterMenu.jsx";
import { makeUploadPreview, makePendingUploadMemory } from "./components/UploadFlow.jsx";
import { PhotozAlbumDockIcon, PhotozMirrorDockIcon, PhotozSearchDockIcon } from "./components/DockIcons.jsx";
const UNASSIGNED_ALBUM_ID = "unassigned";
const INITIAL_ALBUMS = [
  { id: UNASSIGNED_ALBUM_ID, title: "UNASSIGNED", memoryIds: [] },
  { id: "star", title: "★", memoryIds: [] },
  { id: "videos", title: "VIDEOS", memoryIds: [] },
];

const PAGES = [
  { id: "albums", label: "PHOTO ALBUM", Icon: PhotozAlbumDockIcon },
  { id: "mirror", label: "MIRROR", Icon: PhotozMirrorDockIcon },
  { id: "search", label: "SEARCH", Icon: PhotozSearchDockIcon },
];

const ARCHIVE_FILTERS = ["albums", "years", "months", "eras"];
const SEARCH_FILTERS = ["all", "photos", "videos", "tagged", "takeout", "archive", "needs-file"];
const PRIMARY_SEARCH_FILTERS = ["all", "photos", "videos"];
const ADVANCED_SEARCH_FILTERS = ["me", "tagged", "takeout", "archive", "needs-file"];
const SORT_OPTIONS = ["newest", "oldest", "title", "status", "largest", "smallest", "rating"];
const GRID_SIZES = ["compact", "normal", "large"];
const ALBUM_SORT_OPTIONS = ["recent", "title", "count", "size"];
const APP_VERSION = "2026.05.29-stabilize-simplify";
const INDEX_SCHEMA_VERSION = 3;
const MEDIA_BASE = "/api/file";
const MAX_PARALLEL_UPLOADS = 3;



function tooltipForText(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.replace(/\s+/g, " ");
}

function withSettingtip(label) {
  return {
    "aria-label": tooltipForText(label),
  };
}

function playUiTick(kind) {
  try {
    if (typeof window === "undefined") return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!window.__photozAudioContext) window.__photozAudioContext = new AudioContext();
    const ctx = window.__photozAudioContext;
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const isPanel = kind === "panel";
    const isSoft = kind === "soft";

    osc.type = "sine";
    osc.frequency.setValueAtTime(isPanel ? 720 : isSoft ? 520 : 620, now);
    osc.frequency.exponentialRampToValueAtTime(isPanel ? 940 : isSoft ? 620 : 760, now + 0.045);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(isPanel ? 0.030 : 0.022, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.070);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  } catch (error) {}
}

function installUiInteractionSounds() {
  if (typeof document === "undefined" || window.__photozSoundInstalled) return;
  window.__photozSoundInstalled = true;
  document.addEventListener("pointerdown", function (event) {
    const target = event.target && event.target.closest ? event.target.closest("button, [role='button'], input, select, textarea, a") : null;
    if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") return;
    const panelTrigger = target.closest(".floatingUtilityRail, .dock, .systemRail, .settingsDropdown, .settingsPopover, .filterPanel, .filterDropdown");
    playUiTick(panelTrigger ? "panel" : "soft");
  }, { passive: true });
}


function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray(value.items)) return value.items;
  return [];
}

function normalizeMemoryRecord(memory) {
  const source = memory && typeof memory === "object" ? memory : {};
  const metadata = source.metadata && typeof source.metadata === "object" ? source.metadata : {};
  const fileName = source.fileName || source.filename || metadata.originalName || metadata.name || source.name || "";
  const mime = source.mimeType || source.type || metadata.mimeType || metadata.type || "";
  const storageKey = source.storageKey || source.key || source.objectKey || "";
  const cleanTitle = source.title && !/^r2[-_]/i.test(String(source.title)) ? source.title : fileBaseName(fileName);
  const normalizedMetadata = {
    ...metadata,
    name: metadata.name || fileName,
    originalName: metadata.originalName || fileName,
    displayName: metadata.displayName || fileName,
    type: metadata.type || mime,
    mimeType: metadata.mimeType || mime,
    extension: metadata.extension || fileExtension(fileName),
    baseName: metadata.baseName || fileBaseName(fileName),
  };
  return {
    ...source,
    id: source.id || ("memory-" + Date.now() + "-" + Math.random().toString(36).slice(2)),
    title: cleanTitle || fileBaseName(fileName) || "Untitled",
    fileName: fileName,
    filename: source.filename || fileName,
    name: source.name || fileName,
    kind: source.kind || (String(mime).startsWith("video") ? "video" : "photo"),
    mimeType: mime,
    type: source.type || mime,
    size: Number(source.size || normalizedMetadata.size || 0),
    width: Number(source.width || normalizedMetadata.width || 0),
    height: Number(source.height || normalizedMetadata.height || 0),
    duration: Number(source.duration || normalizedMetadata.duration || 0),
    durationSeconds: Number(source.durationSeconds || normalizedMetadata.durationSeconds || 0),
    storageKey: storageKey,
    albumIds: safeArray(source.albumIds),
    tags: safeArray(source.tags),
    metadata: normalizedMetadata,
    uploadStatus: source.uploadStatus || (storageKey ? "r2" : "local"),
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
  if (text === "archive" || text === "archived") return "Archive";
  if (text === "trash" || text === "trashed") return "Trash";
  if (text === "unassigned") return "Unassigned";
  if (text === "mirror") return "Mirror";
  return up(value);
}

function archiveFilterLabel(value) {
  if (value === "albums") return "PHOTO ALBUM";
  if (value === "years") return "YEAR";
  if (value === "months") return "MONTH";
  if (value === "eras") return "ERA";
  return up(value);
}

function filterLabel(value) {
  if (value === "starred") return "★";
  if (value === "archive") return "Archive";
  if (value === "needs-file") return "Reselect";
  return up(value);
}

function cleanSystemLabel(value) {
  const text = String(value || "").toLowerCase();
  if (text === "starred" || text === "star" || text === "★" || text === "virtual-starred") return "★";
  if (text === "trash" || text === "trashed" || text === "virtual-trash") return "Trash";
  if (text === "unassigned" || text === "virtual-unassigned") return "?";
  if (text === "all" || text === "virtual-all") return "All";
  if (text === "videos" || text === "virtual-videos") return "Videos";
  if (text === "archived" || text === "archive" || text === "virtual-archived") return "Archive";
  return up(value);
}

function up(value) {
  return String(value || "").toUpperCase();
}

function cls() {
  return Array.prototype.slice.call(arguments).filter(Boolean).join(" ");
}

function newest(items) {
  return safeArray(items).slice().sort(function (a, b) {
    return dateValue(b && (b.sort || b.updatedAt || b.createdAt || b.date)) - dateValue(a && (a.sort || a.updatedAt || a.createdAt || a.date));
  });
}

function sortMemories(items, sortMode) {
  items = safeArray(items).map(normalizeMemoryRecord);

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
  const album = safeArray(albums).find(function (item) { return item.id === "star"; });
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
  safeArray(memories).forEach(function (memory) {
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

function stableStringHash(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function fileImportPath(file) {
  return String((file && (file.webkitRelativePath || file.name)) || "").replace(/\\/g, "/");
}

function stableFileImportId(file) {
  return stableStringHash([fileImportPath(file), file && file.name, file && file.size, file && file.lastModified].join("::"));
}

function isMediaUploadFile(file) {
  const type = String((file && file.type) || "").toLowerCase();
  const name = String((file && file.name) || "").toLowerCase();
  return Boolean(file) && (type.indexOf("image/") === 0 || type.indexOf("video/") === 0 || /\.(jpe?g|png|gif|webp|heic|heif|avif|tiff?|bmp|mp4|mov|m4v|webm|avi)$/i.test(name));
}

function isTakeoutSidecarFile(file) {
  const name = String((file && file.name) || "").toLowerCase();
  return Boolean(file) && name.endsWith(".json") && /takeout|google photos|photos from|albumarchive/i.test(fileImportPath(file));
}

function stripJsonExtension(value) {
  return String(value || "").replace(/\.json$/i, "");
}

function stripMediaExtension(value) {
  return String(value || "").replace(/\.(jpe?g|png|gif|webp|heic|heif|avif|tiff?|bmp|mp4|mov|m4v|webm|avi)$/i, "");
}

function normalizeTakeoutLookupPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^.*?Takeout\//i, "Takeout/").toLowerCase();
}

function takeoutSidecarKeysForPath(pathValue) {
  const path = normalizeTakeoutLookupPath(pathValue);
  const withoutJson = stripJsonExtension(path);
  const filename = withoutJson.split("/").pop() || withoutJson;
  const base = stripMediaExtension(filename);
  const folder = withoutJson.indexOf("/") !== -1 ? withoutJson.slice(0, withoutJson.lastIndexOf("/") + 1) : "";
  return Array.from(new Set([
    path,
    withoutJson,
    folder + filename,
    folder + base,
    filename,
    base,
  ].filter(Boolean)));
}

function takeoutSidecarKeysForFile(file) {
  const path = fileImportPath(file);
  const filename = String((file && file.name) || "");
  return Array.from(new Set(takeoutSidecarKeysForPath(path).concat(takeoutSidecarKeysForPath(filename))));
}

function readTextFile(file) {
  return new Promise(function (resolve) {
    if (!file) { resolve(""); return; }
    const reader = new FileReader();
    reader.onload = function () { resolve(String(reader.result || "")); };
    reader.onerror = function () { resolve(""); };
    reader.readAsText(file);
  });
}

async function readTakeoutSidecar(file) {
  const text = await readTextFile(file);
  if (!text) return null;
  try { return JSON.parse(text); } catch (error) { return null; }
}

function takeoutTimestampToIso(value) {
  if (value === undefined || value === null || value === "") return "";
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) {
    const date = new Date(number < 100000000000 ? number * 1000 : number);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function datePartsFromIso(iso, fallbackModified) {
  const date = iso ? new Date(iso) : (fallbackModified ? new Date(fallbackModified) : new Date());
  const clean = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    date: clean.toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" }),
    year: String(clean.getFullYear()),
    month: clean.toLocaleString("en", { month: "long", year: "numeric" }),
    sort: Number(String(clean.getFullYear()) + String(clean.getMonth() + 1).padStart(2, "0") + String(clean.getDate()).padStart(2, "0")),
  };
}

function extractTakeoutMetadata(sidecar) {
  const data = sidecar && typeof sidecar === "object" ? sidecar : {};
  const photoTakenIso = takeoutTimestampToIso(data.photoTakenTime && (data.photoTakenTime.timestamp || data.photoTakenTime.formatted));
  const createdIso = takeoutTimestampToIso(data.creationTime && (data.creationTime.timestamp || data.creationTime.formatted));
  const geo = data.geoData || data.geoDataExif || {};
  const title = String(data.title || "").trim();
  return {
    title: title,
    description: String(data.description || "").trim(),
    photoTakenTime: photoTakenIso,
    creationTime: createdIso,
    googlePhotosUrl: data.url || "",
    geoData: geo,
    latitude: Number(geo.latitude || 0),
    longitude: Number(geo.longitude || 0),
    altitude: Number(geo.altitude || 0),
  };
}

async function buildTakeoutSidecarMap(files) {
  const map = {};
  const sidecars = Array.from(files || []).filter(isTakeoutSidecarFile);
  await Promise.all(sidecars.map(async function (file) {
    const data = await readTakeoutSidecar(file);
    if (!data) return;
    takeoutSidecarKeysForFile(file).forEach(function (key) { map[key] = data; });
    if (data.title) takeoutSidecarKeysForPath(data.title).forEach(function (key) { map[key] = data; });
  }));
  return map;
}

function sidecarForMediaFile(file, sidecarMap) {
  const keys = takeoutSidecarKeysForFile(file);
  for (let index = 0; index < keys.length; index += 1) {
    if (sidecarMap[keys[index]]) return sidecarMap[keys[index]];
  }
  return null;
}

function applyTakeoutSidecar(memory, file, sidecar) {
  if (!sidecar) return memory;
  const extracted = extractTakeoutMetadata(sidecar);
  const takenIso = extracted.photoTakenTime || extracted.creationTime || "";
  const dateParts = datePartsFromIso(takenIso, file && file.lastModified);
  const metadata = {
    ...(memory.metadata || {}),
    takeout: true,
    source: "google-takeout",
    takeoutPath: fileImportPath(file),
    sidecarTitle: extracted.title,
    sidecarDescription: extracted.description,
    photoTakenTime: extracted.photoTakenTime,
    creationTime: extracted.creationTime,
    googlePhotosUrl: extracted.googlePhotosUrl,
    geoData: extracted.geoData,
    latitude: extracted.latitude,
    longitude: extracted.longitude,
    altitude: extracted.altitude,
  };
  const nextTitle = extracted.title ? fileBaseName(extracted.title) : memory.title;
  return normalizeMemoryUrl({
    ...memory,
    title: nextTitle || memory.title,
    date: takenIso ? dateParts.date : memory.date,
    year: takenIso ? dateParts.year : memory.year,
    month: takenIso ? dateParts.month : memory.month,
    sort: takenIso ? dateParts.sort : memory.sort,
    caption: extracted.description || memory.caption || "",
    location: extracted.latitude || extracted.longitude ? [extracted.latitude, extracted.longitude].filter(Boolean).join(", ") : memory.location,
    takeout: true,
    isTakeout: true,
    takeoutMeta: {
      folder: fileImportPath(file).split("/").slice(0, -1).join("/"),
      sidecarPath: metadata.takeoutPath ? metadata.takeoutPath + ".json" : "",
      photoTakenTime: extracted.photoTakenTime,
      creationTime: extracted.creationTime,
    },
    metadata,
  });
}

function objectUrl(file) {
  if (typeof URL === "undefined") return "";
  if (typeof URL.createObjectURL !== "function") return "";
  if (typeof Blob === "undefined") return "";
  return file instanceof Blob ? URL.createObjectURL(file) : "";
}

function fileExtension(name) {
  const text = String(name || "");
  const match = text.match(/\.([^.\/]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function fileBaseName(name) {
  return String(name || "FILE").replace(/\.[^.]+$/, "");
}

function readableDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function dimensionsLabel(memory) {
  const metadata = memory && memory.metadata ? memory.metadata : {};
  const width = Number(memory && (memory.width || metadata.width || metadata.naturalWidth || metadata.videoWidth));
  const height = Number(memory && (memory.height || metadata.height || metadata.naturalHeight || metadata.videoHeight));
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return Math.round(width) + " × " + Math.round(height);
  }
  return "UNKNOWN";
}

function fileMeta(file, modified) {
  const name = file.name || "";
  const extension = fileExtension(name);
  return {
    name: name,
    originalName: name,
    displayName: name,
    baseName: fileBaseName(name),
    extension: extension,
    type: file.type || "",
    mimeType: file.type || "",
    size: typeof file.size === "number" ? file.size : 0,
    sizeLabel: formatBytes(typeof file.size === "number" ? file.size : 0),
    lastModified: file.lastModified || 0,
    lastModifiedISO: modified.toISOString(),
    lastModifiedLabel: readableDateTime(modified),
    importedAt: new Date().toISOString(),
    webkitRelativePath: file.webkitRelativePath || "",
    importPath: fileImportPath(file),
    stableImportId: stableFileImportId(file),
    source: /takeout|google photos/i.test(fileImportPath(file)) ? "google-takeout" : "browser-file-input",
    preserveEmbeddedMetadata: true,
    originalFileStoredUnmodified: true,
    signature: fileSignature(file),
  };
}

function readMediaElementMetadata(file, kind) {
  return new Promise(function (resolve) {
    if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      resolve({});
      return;
    }
    const url = URL.createObjectURL(file);
    const element = kind === "video" ? document.createElement("video") : document.createElement("img");
    let done = false;
    function finish(extra) {
      if (done) return;
      done = true;
      try { URL.revokeObjectURL(url); } catch (error) {}
      resolve(extra || {});
    }
    const timer = setTimeout(function () { finish({}); }, 2500);
    function complete(extra) {
      clearTimeout(timer);
      finish(extra);
    }
    element.onerror = function () { complete({}); };
    if (kind === "video") {
      element.preload = "metadata";
      element.onloadedmetadata = function () {
        complete({
          width: element.videoWidth || 0,
          height: element.videoHeight || 0,
          duration: Number.isFinite(element.duration) ? element.duration : 0,
          durationSeconds: Number.isFinite(element.duration) ? element.duration : 0,
        });
      };
    } else {
      element.onload = function () {
        complete({
          width: element.naturalWidth || 0,
          height: element.naturalHeight || 0,
        });
      };
    }
    element.src = url;
  });
}

async function enrichMemoryWithFileMetadata(memory, file) {
  const source = normalizeMemoryRecord(memory);
  const kind = source.kind || (file && file.type && file.type.indexOf("video") === 0 ? "video" : "photo");
  const mediaMeta = file ? await readMediaElementMetadata(file, kind) : {};
  const metadata = {
    ...(source.metadata || {}),
    ...mediaMeta,
  };
  if (metadata.width && metadata.height) {
    metadata.dimensions = Math.round(Number(metadata.width)) + " × " + Math.round(Number(metadata.height));
    metadata.aspectRatio = Number(metadata.width) / Number(metadata.height);
  }
  return normalizeMemoryUrl({
    ...source,
    width: metadata.width || source.width || 0,
    height: metadata.height || source.height || 0,
    duration: metadata.duration || source.duration || 0,
    durationSeconds: metadata.durationSeconds || source.durationSeconds || 0,
    metadata,
  });
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
    stableFileImportId(file) + "-" + safeName(file.name || ("file-" + index)),
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
    id: "memory-" + stableFileImportId(file),
    title,
    date: modified.toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    size: typeof file.size === "number" ? file.size : 0,
    mimeType: file.type || "",
    type: file.type || "",
    sort: Number(year + String(modified.getMonth() + 1).padStart(2, "0") + String(modified.getDate()).padStart(2, "0")),
    year,
    month,
    era: "Unassigned",
    kind,
    fileName: file.name || "",
    previewUrl: objectUrl(file) || MEDIA_BASE + "/" + encodedStorageKey(key),
    storageBase: MEDIA_BASE,
    storageKey: key,
    storageUrl: MEDIA_BASE + "/" + encodedStorageKey(key),
    uploadStatus: "queued",
    metadata: fileMeta(file, modified),
    tags: [],
    takeout: /takeout|google photos/i.test(fileImportPath(file)),
    isTakeout: /takeout|google photos/i.test(fileImportPath(file)),
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
  items = safeArray(items).map(normalizeMemoryRecord).filter(function (memory) {
    return !memory.trashed;
  });

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

function memoryHiddenFromAll(memory) {
  return Boolean(memory && (memory.hiddenFromAll || memory.hideFromAll || memory.excludeFromAll));
}

function memoryVisibleInSearch(memory, albums) {
  return Boolean(memory) && !memory.trashed && !memoryHiddenFromAll(memory) && !memoryExcludedFromAll(memory, albums);
}

function visibleAllMemories(memories, albums) {
  return newest(safeArray(memories).filter(function (memory) {
    return !memory.inMirror && !memory.archived && memoryVisibleInSearch(memory, albums);
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
    id === "all" || id === "virtual-all" ||
    id === "star" || id === "starred" || id === "virtual-starred" ||
    id === "archive" || id === "archived" || id === "virtual-archived" ||
    id === "trash" || id === "trashed" || id === "virtual-trash" ||
    id === "unassigned" || id === "virtual-unassigned" ||
    id === "videos" || id === "virtual-videos" ||
    title === "all" || title === "star" || title === "starred" || title === "archive" ||
    title === "archived" || title === "trash" ||
    title === "unassigned" || title === "videos" || title === "★";
}

function isStarredMemory(memory, albums) {
  if (!memory || memory.trashed) return false;
  if (memory.starred || memory.favorite || memory.fav) return true;
  return albumHasMemory(safeArray(albums), "star", memory.id);
}

function starredMemories(memories, albums) {
  return newest(safeArray(memories).map(normalizeMemoryRecord).filter(function (memory) {
    return isStarredMemory(memory, albums) && !memoryExcludedFromAll(memory, albums);
  }));
}

function isMeMemory(memory) {
  return Boolean(memory && (memory.isMe || memory.me || memory.inMirror));
}

function meMemories(memories) {
  return newest(safeArray(memories).map(normalizeMemoryRecord).filter(function (memory) {
    return isMeMemory(memory) && !memory.trashed && !memory.archived;
  }));
}

function starredMeMemories(memories, albums) {
  return newest(meMemories(memories).filter(function (memory) {
    return isStarredMemory(memory, albums);
  }));
}


function virtualAlbumGroups(albums, memories) {
  albums = safeArray(albums).map(normalizeAlbumRecord);
  memories = safeArray(memories).map(normalizeMemoryRecord);

  const trash = newest(memories.filter(function (memory) { return Boolean(memory.trashed); }));
  const starredItems = starredMemories(memories, albums);
  const unassignedAlbum = albums.find(function (album) { return album.id === UNASSIGNED_ALBUM_ID; });
  const unassigned = unassignedAlbum ? newest(albumMemoryIds(unassignedAlbum).map(function (id) {
    return memories.find(function (memory) { return memory.id === id && !memory.trashed && !memoryExcludedFromAll(memory, albums); });
  }).filter(Boolean)) : [];

  return [
    { id: "virtual-starred", sourceId: "star", title: "STARRED", items: starredItems, sort: starredItems[0] ? starredItems[0].sort : 0, virtual: true },
    { id: "virtual-trash", sourceId: "virtual-trash", title: "TRASH", items: trash, sort: trash[0] ? trash[0].sort : 0, virtual: true },
    { id: "virtual-unassigned", sourceId: UNASSIGNED_ALBUM_ID, title: "UNASSIGNED", items: unassigned, sort: unassigned[0] ? unassigned[0].sort : 0, virtual: true },
  ];
}

function albumGroups(albums, memories, parentId) {
  albums = safeArray(albums).map(normalizeAlbumRecord);
  memories = safeArray(memories).map(normalizeMemoryRecord);
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
  safeArray(albums).forEach(function (album) {
    byId[album.id] = album;
  });

  const output = [];
  INITIAL_ALBUMS.forEach(function (album) {
    output.push(byId[album.id] ? { ...byId[album.id] } : { ...album, memoryIds: [] });
  });

  safeArray(albums).forEach(function (album) {
    if (!byId[album.id]) return;
    if (!INITIAL_ALBUMS.some(function (core) { return core.id === album.id; })) {
      output.push({ ...album });
    }
  });

  return output;
}

function memoryHasHomeAlbum(memory, albums) {
  if (memory && memory.inMirror) return true;
  return safeArray(albums).some(function (album) {
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

  safeArray(memories).forEach(function (memory) {
    if (!memoryHasHomeAlbum(memory, cleanAlbums)) {
      unassigned.memoryIds.push(memory.id);
    }
  });

  unassigned.memoryIds = Array.from(new Set(unassigned.memoryIds));
  return cleanAlbums;
}

function removeMemoryFromAlbum(albums, albumId, memoryId) {
  return safeArray(albums).filter(function (album) {
    const groupLike = { id: album.id, sourceId: album.id, title: album.title };
    return !isSystemAlbumGroup(groupLike);
  }).map(function (album) {
    if (album.id !== albumId) return album;
    return { ...album, memoryIds: (album.memoryIds || []).filter(function (id) { return id !== memoryId; }) };
  });
}

function addMemoryToAlbum(albums, albumId, memoryId) {
  return safeArray(albums).map(function (album) {
    if (album.id !== albumId) return album;
    return { ...album, memoryIds: Array.from(new Set((album.memoryIds || []).concat([memoryId]))) };
  });
}

function albumHasMemory(albums, albumId, memoryId) {
  const album = safeArray(albums).find(function (item) {
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
  return safeArray(albums).some(function (album) {
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
  return safeArray(items).reduce(function (total, memory) {
    return total + fileSizeBytes(memory);
  }, 0);
}


function albumDateRangeLabel(items) {
  const years = Array.from(new Set(safeArray(items).map(function (memory) {
    return String(memory.year || (memory.date ? String(memory.date).slice(0, 4) : "")).trim();
  }).filter(Boolean))).sort();
  if (!years.length) return "";
  if (years.length === 1) return years[0];
  return years[0] + "–" + years[years.length - 1];
}

function albumStatsLabel(items, childCount) {
  const count = safeArray(items).length;
  const pieces = [count + " " + (count === 1 ? "PHOTO" : "PHOTOS")];
  if (childCount) pieces.push(childCount + " " + (childCount === 1 ? "ALBUM" : "ALBUMS"));
  const size = albumSizeBytes(items);
  if (size) pieces.push(formatBytes(size));
  return pieces.join(" / ");
}

function AlbumCoverStack(props) {
  const items = newest(safeArray(props.items)).slice(0, 4);
  if (!items.length) {
    return (
      <div className="albumCoverStack empty">
        <PhotozAlbumDockIcon size={36} />
      </div>
    );
  }
  return (
    <div className="albumCoverStack">
      {items.map(function (memory, index) {
        const source = pzMediaSource(memory);
        const video = pzIsVideo(memory);
        return (
          <span key={memory.id || index} className={"albumCoverPiece piece" + index}>
            {video ? <video src={source} muted playsInline preload="metadata" /> : <img src={source} alt="" loading="lazy" />}
          </span>
        );
      })}
    </div>
  );
}


function AlbumWorkspaceHero(props) {
  const album = props.album ? normalizeAlbumRecord(props.album) : null;
  if (!album) return null;
  const photos = newest(safeArray(props.photos));
  const children = safeArray(props.children);
  const count = photos.length;
  const dateRange = albumDateRangeLabel(photos);
  const hasMeta = count > 0 || children.length > 0 || Boolean(dateRange);

  return (
    <section className={album.excludeFromAll ? "albumWorkspaceHero hiddenFromAll" : "albumWorkspaceHero"}>
      <AlbumCoverStack items={photos} />
      <div className="albumWorkspaceMain">
        <div className="albumWorkspaceTopline">
          <button className="albumBackButton" type="button" aria-label="Back to albums" onClick={function () { props.backToAlbums && props.backToAlbums(); }}>‹</button>
          {album.excludeFromAll ? <span className="albumHiddenBadge">HIDDEN</span> : null}
        </div>
        <div className="albumWorkspaceTitleRow">
          <div>
            <h2>{album.title || "Untitled album"}</h2>
            {album.description ? <p>{album.description}</p> : null}
          </div>
          {hasMeta ? <div className="albumWorkspaceStats">
            {count > 0 ? <span>{count} {count === 1 ? "photo" : "photos"}</span> : null}
            {children.length > 0 ? <span>{children.length} {children.length === 1 ? "album" : "albums"}</span> : null}
            {dateRange ? <span>{dateRange}</span> : null}
          </div> : null}
        </div>
        <div className="albumWorkspaceActions">
          <button type="button" onClick={function () { props.openCreate && props.openCreate(); }}>+ ALBUM</button>
          <button type="button" onClick={function () { props.editAlbum && props.editAlbum(album); }}>EDIT</button>
        </div>
      </div>
    </section>
  );
}

function AlbumSectionHeader(props) {
  if (!props.show) return null;
  return (
    <div className="albumSectionHeader">
      <strong>{props.title}</strong>
      <span>{props.count}</span>
    </div>
  );
}

function storageTotal(memories) {
  return safeArray(memories).reduce(function (total, memory) {
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
  safeArray(memories).forEach(function (memory) {
    memoryIds[memory.id] = true;
  });

  let orphanAlbumRefs = 0;
  safeArray(albums).forEach(function (album) {
    (album.memoryIds || []).forEach(function (id) {
      if (!memoryIds[id]) orphanAlbumRefs += 1;
    });
  });

  const missingHomes = safeArray(memories).filter(function (memory) {
    return !memory.trashed && !memoryHasHomeAlbum(memory, albums);
  }).length;

  const duplicateIds = safeArray(memories).length - Object.keys(memoryIds).length;

  return {
    memories: safeArray(memories).length,
    albums: safeArray(albums).length,
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

function uploadPlanStats(files, memories, sidecarCount) {
  const signatures = existingSignatureMap(safeArray(memories));
  return Array.from(files || []).reduce(function (stats, file) {
    const signature = fileSignature(file);
    stats.total += 1;
    stats.bytes += file.size || 0;
    if (file.size && file.size > 50 * 1024 * 1024) stats.large += 1;
    if (signatures[signature]) stats.duplicates += 1;
    if (/takeout|google photos/i.test(fileImportPath(file))) stats.takeout += 1;
    return stats;
  }, { total: 0, bytes: 0, large: 0, duplicates: 0, takeout: 0, sidecars: sidecarCount || 0 });
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function activeQueueCount(queue) {
  return safeArray(queue).filter(function (item) { return item.status === "uploading"; }).length;
}

function pendingQueueCount(queue) {
  return safeArray(queue).filter(function (item) { return item.status === "queued"; }).length;
}

function uploadQueueStats(queue) {
  return safeArray(queue).reduce(function (stats, item) {
    stats.total += 1;
    stats[item.status] = (stats[item.status] || 0) + 1;
    return stats;
  }, { total: 0, queued: 0, uploading: 0, done: 0, failed: 0 });
}

function uploadStats(memories) {
  return safeArray(memories).reduce(function (stats, memory) {
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
  const source = selectedIds && typeof selectedIds === "object" ? selectedIds : {};
  return Object.keys(source).filter(function (id) { return source[id]; });
}

function assignableAlbums(albums) {
  return safeArray(albums).filter(function (album) {
    return album.id !== "star";
  });
}

function memoryAlbumTitles(memory, albums) {
  return safeArray(albums).filter(function (album) {
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

function matchesSearchFilter(memory, albums, filter) {
  if (!memory || memory.trashed) return false;
  const mode = filter || "all";
  if (mode === "all") return true;
  if (mode === "photos") return memory.kind !== "video";
  if (mode === "videos") return memory.kind === "video";
  if (mode === "starred") return isStarredMemory(memory, albums);
  if (mode === "mirror") return Boolean(memory.inMirror);
  if (mode === "me") return Boolean(memory.isMe);
  if (mode === "tagged") return safeArray(memory.tags).length > 0;
  if (mode === "takeout") return Boolean(memory.takeout || memory.isTakeout);
  if (mode === "archive") return Boolean(memory.archived);
  if (mode === "needs-file") return !memory.storageUrl && !memory.previewUrl && !memory.url;
  return true;
}

function searchMemories(memories, albums, query, filter, options) {
  const terms = String(query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  return newest(safeArray(memories).filter(function (memory) {
    if (!matchesSearchFilter(memory, albums, filter || "all", options)) return false;
    if (!terms.length) return filter && filter !== "all";
    const haystack = searchableText(memory, albums);
    return terms.every(function (term) {
      return haystack.indexOf(term) !== -1;
    });
  }));
}

function removeAlbum(albums, id) {
  return safeArray(albums).filter(function (album) {
    return album.id !== id;
  });
}

function renameAlbum(albums, id, title) {
  const clean = String(title || "").trim();
  if (!clean) return albums;
  return safeArray(albums).map(function (album) {
    return album.id === id ? { ...album, title: clean } : album;
  });
}

function updateAlbumDetails(albums, id, title, description) {
  const clean = String(title || "").trim();
  if (!clean || albumTitleExists(albums, clean, id)) return albums;
  return safeArray(albums).map(function (album) {
    return album.id === id ? { ...album, title: clean, description: String(description || "").trim(), updatedAt: new Date().toISOString() } : album;
  });
}

function removeMemoryEverywhere(albums, memoryId) {
  return safeArray(albums).map(function (album) {
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

function isBlobUrl(value) {
  return String(value || "").indexOf("blob:") === 0;
}

function encodedStorageKey(key) {
  return String(key || "")
    .replace(/^\/+/, "")
    .split("/")
    .filter(function (part) { return part && part !== "." && part !== ".."; })
    .map(function (part) { return encodeURIComponent(part); })
    .join("/");
}

function storageKeyFromMemory(memory) {
  if (!memory) return "";
  if (memory.storageKey) return String(memory.storageKey).replace(/^\/+/, "");
  const raw = String(memory.key || memory.objectKey || "").replace(/^\/+/, "");
  if (raw) return raw;
  const url = String(memory.storageUrl || memory.previewUrl || memory.url || "");
  const marker = "/api/file/";
  if (url.indexOf(marker) !== -1) {
    try { return decodeURIComponent(url.split(marker).pop().split(/[?#]/)[0]); } catch (error) { return url.split(marker).pop().split(/[?#]/)[0]; }
  }
  return "";
}

function originalUrlForMemory(memory) {
  const key = storageKeyFromMemory(memory);
  if (!key) return "";
  return MEDIA_BASE + "/" + encodedStorageKey(key);
}

function previewUrlForMemory(memory) {
  if (!memory) return "";
  const original = originalUrlForMemory(memory);
  if (original) return original;
  const fallback = memory.previewUrl || memory.storageUrl || memory.url || "";
  return isBlobUrl(fallback) ? fallback : String(fallback || "");
}

function normalizeMemoryUrl(memory) {
  if (!memory) return memory;
  const key = storageKeyFromMemory(memory);
  const normalized = normalizeMemoryRecord({
    ...memory,
    storageKey: key || memory.storageKey || "",
  });
  return {
    ...normalized,
    storageBase: MEDIA_BASE,
    storageUrl: key ? originalUrlForMemory(normalized) : (isBlobUrl(memory.storageUrl) ? "" : (memory.storageUrl || "")),
    previewUrl: previewUrlForMemory(normalized),
    tags: Array.isArray(normalized.tags) ? normalized.tags : [],
    caption: normalized.caption || "",
    location: normalized.location || "",
    event: normalized.event || "",
    rating: normalizeRating(normalized.rating),
    label: normalizeLabel(normalized.label),
    review: Boolean(normalized.review),
    private: Boolean(normalized.private),
    isMe: Boolean(normalized.isMe),
    inMirror: Boolean(normalized.inMirror),
    archived: Boolean(normalized.archived),
    trashed: Boolean(normalized.trashed),
    deletedAt: normalized.deletedAt || "",
    updatedAt: normalized.updatedAt || "",
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
  const normalizedMemories = safeArray(memories).map(normalizeMemoryUrl).map(function (memory) {
    const copy = { ...memory };
    if (isBlobUrl(copy.previewUrl)) delete copy.previewUrl;
    if (isBlobUrl(copy.storageUrl)) delete copy.storageUrl;
    if (isBlobUrl(copy.url)) delete copy.url;
    return copy;
  });
  const coveredAlbums = ensureAlbumCoverage(normalizedMemories, albums);
  const payload = cleanIndex({
    memories: normalizedMemories,
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
  const normalized = normalizeMemoryUrl(memory);
  const form = new FormData();
  form.append("file", file);
  form.append("id", normalized.id);
  form.append("key", storageKeyFromMemory(normalized));
  form.append("kind", normalized.kind);
  form.append("title", normalized.title);
  form.append("metadata", JSON.stringify(normalized.metadata || {}));
  form.append("storageUrl", originalUrlForMemory(normalized));

  const res = await fetch("/api/upload", { method: "POST", body: form });
  let data = null;
  try { data = await res.json(); } catch (error) {}
  if (!res.ok || !data || data.ok === false) return false;
  const serverMemory = safeArray(data.memories || data.files)[0];
  return serverMemory ? normalizeMemoryUrl({ ...normalized, ...serverMemory, id: normalized.id }) : normalizeMemoryUrl(normalized);
}

async function checkMissingFiles(memories) {
  const sample = safeArray(memories).slice(0, 50);
  const results = await Promise.all(sample.map(function (memory) {
    const url = originalUrlForMemory(memory) || memory.storageUrl || memory.previewUrl || memory.url;
    if (!url || isBlobUrl(url)) return Promise.resolve({ id: memory.id, ok: false });
    return fetch(url, { method: "HEAD", cache: "no-store" }).then(function (res) {
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


async function fetchFileAudit() {
  const res = await fetch("/api/file-audit", { cache: "no-store" });
  if (!res.ok) throw new Error("file_audit_failed");
  return res.json();
}

async function fetchFileRepair() {
  const res = await fetch("/api/repair-files", { method: "POST" });
  if (!res.ok) throw new Error("file_repair_failed");
  return res.json();
}

async function deleteOne(memory) {
  const key = storageKeyFromMemory(memory);
  if (!memory || !key) return true;
  const res = await fetch("/api/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: key, id: memory.id }),
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

function deleteConfirmCopy(count) {
  const amount = Number(count) || 1;
  return amount === 1 ? "This file will be removed from PHOTOZ and storage." : amount + " files will be removed from PHOTOZ and storage.";
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
    if (typeof props.reportVisibleIds !== "function") return;
    props.reportVisibleIds(safeArray(props.items).map(function (item) { return item && item.id; }).filter(Boolean));
  }, [props.items, props.reportVisibleIds]);
  return null;
}

function EmptyState() {
  return (
    <div className="emptyState emptyStateXOnly" aria-label="No files">
      <span className="emptyStateX" aria-hidden="true">X</span>
    </div>
  );
}

function UploadButton(props) {
  const inputRef = useRef(null);
  const label = props.folder ? "Folder" : "Upload";
  return (
    <>
      <button type="button" className="uploadButton" {...withSettingtip(props.folder ? "Upload folder" : "Upload files")} onClick={function () { inputRef.current && inputRef.current.click(); }}>
        <Upload size={14} />
        <span>{label}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={props.folder ? undefined : "image/*,video/*,.json"}
        webkitdirectory={props.folder ? "true" : undefined}
        directory={props.folder ? "true" : undefined}
        onChange={function (event) {
          props.onUpload(event.target.files);
          event.target.value = "";
        }}
      />
    </>
  );
}

function ImportBackupButton(props) {
  const inputRef = useRef(null);
  return (
    <>
      <button type="button" className="importButton" {...withSettingtip("Import backup file")} onClick={function () { inputRef.current && inputRef.current.click(); }}>Import file</button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        onChange={function (event) {
          const file = event.target.files && event.target.files[0];
          if (file) props.onImport(file);
          event.target.value = "";
        }}
      />
    </>
  );
}

function PhotoCard(props) {
  const memory = normalizeMemoryRecord(props.memory);
  const source = pzMediaSource(memory);
  const video = pzIsVideo(memory);
  const pressTimerRef = useRef(null);
  const longPressRef = useRef(false);
  const dragSelectingRef = useRef(false);
  const selectedDuringDragRef = useRef({});

  function clearPressTimer() {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  function selectMemory(targetMemory) {
    if (!targetMemory || !targetMemory.id) return;
    if (selectedDuringDragRef.current[targetMemory.id]) return;
    selectedDuringDragRef.current[targetMemory.id] = true;
    props.onDragSelect ? props.onDragSelect(targetMemory) : props.onLongSelect && props.onLongSelect(targetMemory);
  }

  function selectFromPoint(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    const card = element && element.closest ? element.closest("[data-memory-id]") : null;
    if (!card) return;
    const id = card.getAttribute("data-memory-id");
    if (!id) return;
    const targetMemory = { id };
    selectMemory(targetMemory);
  }

  function endDragSelection() {
    clearPressTimer();
    if (dragSelectingRef.current) {
      dragSelectingRef.current = false;
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", endDragSelection);
      window.removeEventListener("pointercancel", endDragSelection);
      window.removeEventListener("blur", endDragSelection);
      setTimeout(function () {
        selectedDuringDragRef.current = {};
      }, 0);
    }
  }

  function handleWindowPointerMove(event) {
    if (!dragSelectingRef.current) return;
    event.preventDefault();
    selectFromPoint(event.clientX, event.clientY);
  }

  function beginPress(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    longPressRef.current = false;
    dragSelectingRef.current = false;
    selectedDuringDragRef.current = {};
    clearPressTimer();
    pressTimerRef.current = window.setTimeout(function () {
      longPressRef.current = true;
      dragSelectingRef.current = true;
      if (navigator.vibrate) {
        try { navigator.vibrate(12); } catch (error) {}
      }
      selectMemory(memory);
      window.addEventListener("pointermove", handleWindowPointerMove, { passive: false });
      window.addEventListener("pointerup", endDragSelection);
      window.addEventListener("pointercancel", endDragSelection);
      window.addEventListener("blur", endDragSelection);
    }, 420);
  }

  function cancelPress() {
    if (!dragSelectingRef.current) clearPressTimer();
  }

  function activate(event) {
    clearPressTimer();

    if (longPressRef.current) {
      event.preventDefault();
      longPressRef.current = false;
      return;
    }

    if (props.selectionMode) {
      props.toggleSelected && props.toggleSelected(memory.id);
      return;
    }

    if (video && props.onPlayVideo) {
      props.onPlayVideo(memory);
      return;
    }

    props.onClick && props.onClick(memory, event);
  }

  return (
    <article
      className={props.selected ? "photoCard selected" : video ? "photoCard videoCard" : "photoCard"}
      data-memory-id={memory.id}
      onPointerDown={beginPress}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={function (event) {
        event.preventDefault();
        props.onLongSelect && props.onLongSelect(memory);
      }}
      onClick={activate}
    >
      <div className="photoThumb">
        {video ? <video src={source} muted playsInline preload="metadata" /> : <img src={source} alt="" loading="lazy" draggable="false" />}
        {video ? (
          <>
            <span className="pzVideoPlayPlate"><Play size={14} fill="currentColor" /></span>
            <span className="pzVideoBadge"><Film size={11} />{pzVideoRuntime(memory)}</span>
          </>
        ) : null}
        {memory.uploadPending ? <span className="pendingUploadBadge">UPLOADING</span> : null}
        {props.isStarred || memory.starred ? <span className="starBadge">★</span> : null}
        {props.selectionMode ? <span className={props.selected ? "selectionDot active" : "selectionDot"} /> : null}
      </div>
      {props.showText ? (
        <div className="photoMeta">
          <strong>{memory.title || memory.name || "FILE"}</strong>
          <span>{video ? pzVideoSizeLabel(memory) : memory.location || memory.date || memory.kind || ""}</span>
        </div>
      ) : null}
      <div className="pzCardQuickActions">
        {props.onEdit ? (
          <button type="button" aria-label="Edit file" onClick={function (event) { event.stopPropagation(); props.onEdit(memory); }}><PanelRightOpen size={12} /></button>
        ) : null}
        {video && props.onPlayVideo ? <button type="button" aria-label="Play video" onClick={function (event) { event.stopPropagation(); props.onPlayVideo(memory); }}><Film size={12} /></button> : null}
      </div>
    </article>
  );
}

function Dock(props) {
  return (
    <div className="dockWrap">
      <Glass className="dock bottomDock">
        {PAGES.map(function (page) {
          const Icon = page.Icon;
          const active = props.active === page.id;
          return (
            <button
              key={page.id}
              type="button"
              aria-label={page.label}
              data-tooltip={page.label}
              className={cls("dockButton", active && "active")}
              onClick={function () {
                props.setActive(page.id);
              }}
            >
              <Icon size={28} />
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



function SettingsPanel(props) {
  if (!props.open) return null;

  return (
    <div className="floatingPanel settingsPopover settingsMenuPanel polishedMenuPanel" role="menu" aria-label="SETTINGS">
      <section className="panelSection settingsMenuGroup primary">
        <span className="panelLabel">IMPORT</span>
        <div className="panelActionList">
          <UploadButton onUpload={props.onUpload} />
          <UploadButton onUpload={props.onUpload} folder />
          <button type="button" {...withTooltip("Upload queue")} onClick={props.toggleUploadRefilterPanel || props.toggleUploadQueuePanel}>
            <UploadCloud size={14} strokeWidth={2.05} /> <span>Queue</span>
          </button>
        </div>
      </section>

      <section className="panelSection settingsMenuGroup">
        <span className="panelLabel">LIBRARY</span>
        <div className="panelActionList">
          <button type="button" {...withTooltip("Import backup")} onClick={props.toggleImportPanel}>
            <ArchiveRestore size={14} strokeWidth={2.05} /> <span>Import</span>
          </button>
          <button type="button" {...withTooltip("Export backup index")} onClick={props.exportVaultIndex}>
            <FileDown size={14} strokeWidth={2.05} /> <span>Backup</span>
          </button>
          <button type="button" {...withTooltip("Export file list")} onClick={props.exportManifestCsv}>
            <FileDown size={14} strokeWidth={2.05} /> <span>List</span>
          </button>
        </div>
      </section>

      <section className="panelSection settingsMenuGroup">
        <span className="panelLabel">MAINTAIN</span>
        <div className="panelActionList">
          <button type="button" {...withTooltip("Refilter duplicates")} onClick={props.toggleDuplicatePanel}>Duplicates</button>
          <button type="button" {...withTooltip("Find missing files")} onClick={props.toggleStatusPanel}>Missing</button>
          <button type="button" {...withTooltip("Repair library")} onClick={props.toggleHealthPanel}>Repair</button>
        </div>
      </section>
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
        <span>{props.health && props.health.bucket ? "STORAGE READY" : "STORAGE"}</span>
      </div>
      {props.validation ? <div className="statusClean">Archive: {props.validation.memories} files / {props.validation.albums} albums / {props.validation.orphanAlbumRefs} broken links / {props.validation.missingHomes} without album</div> : null}
      {props.health && props.health.repairReport ? <div className="statusClean">Last repair: {props.health.repairReport.orphanAlbumRefs} broken links / {props.health.repairReport.missingHomes} without album</div> : null}
      {props.health && props.health.routeCheck ? <div className="statusClean">App: ACCESS {String(props.health.routeCheck.access).toUpperCase()} / HEALTH {String(props.health.routeCheck.health).toUpperCase()}</div> : null}
      {props.missingReport ? <div className="statusClean">Files: {props.missingReport.missing} MISSING / {props.missingReport.checked} CHECKED</div> : null}
      {props.fileAuditReport ? <div className="statusClean">File audit: {props.fileAuditReport.indexMemories} records / {props.fileAuditReport.r2Objects} stored / {props.fileAuditReport.missingRecords} missing / {props.fileAuditReport.recoveredOrphans} recovered / {props.fileAuditReport.guaranteedDisplayable ? "DISPLAY READY" : "REPAIR NEEDED"}</div> : null}
      {props.healthError ? <div className="statusClean">HEALTH CHECK FAILED.</div> : null}
      <button type="button" onClick={props.runHealthCheck}>CHECK ARCHIVE</button>
      <button type="button" onClick={props.runRouteCheck}>CHECK APP</button>
      <button type="button" onClick={props.runMissingCheck}>CHECK FILES</button>
      <button type="button" onClick={props.runFileAudit}>AUDIT FILES</button>
      <button type="button" onClick={props.repairFilesAndReload}>REPAIR FILE RECORDS</button>
      <button type="button" onClick={props.repairIndex}>REPAIR ALBUM LINKS</button>
    </div>
  );
}

function DuplicatePanel(props) {
  if (!props.open) return null;
  const groups = duplicateGroups(safeArray(props.memories)).filter(function (group) {
    return group.some(function (memory) { return !memory.trashed; });
  });

  return (
    <div className="duplicatePanel duplicateRefilterPanel">
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
                    <b>{itemIndex === 0 ? "KEEP" : "REFILTER"}</b>
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
          <span>TAKEOUT {props.importSummary.takeout || 0}</span>
          <span>JSON {props.importSummary.sidecars || 0}</span>
          <span>LEFT {props.importSummary.remaining || 0}</span>
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

  const issues = safeArray(props.memories).filter(function (memory) {
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
        <span>STORED {stats.r2 || 0}</span>
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
        <div className="statusClean">ALL FILES ARE STORED.</div>
      )}
    </div>
  );
}

function UndoBar(props) {
  if (!props.snapshot) return null;
  return (
    <div className="undoBar" role="status" aria-live="polite">
      <span className="undoBarLabel">{props.snapshot.label}</span>
      <div className="undoBarActions">
        <button type="button" onClick={props.undo}>UNDO</button>
        <button type="button" onClick={props.clear} aria-label="Dismiss undo notice">×</button>
      </div>
    </div>
  );
}

function BulkBar(props) {
  if (!props.selectionMode) return null;
  const count = Object.keys(props.selectedIds || {}).filter(function (id) { return props.selectedIds[id]; }).length;
  const albumOptions = assignableAlbums(props.albums);
  const inAlbum = Boolean(props.currentAlbumId);
  const targetAlbum = props.bulkAlbum || UNASSIGNED_ALBUM_ID;

  return (
    <div className="bulkBar albumReadyBulkBar" aria-label="Selected file actions">
      <span>{count} selected</span>
      <select value={targetAlbum} aria-label="Target album" onChange={function (event) { props.setBulkAlbum && props.setBulkAlbum(event.target.value); }}>
        {albumOptions.map(function (album) {
          return <option key={album.id} value={album.id}>{album.title || "PHOTO ALBUM"}</option>;
        })}
      </select>
      <button type="button" disabled={!count || !targetAlbum} onClick={props.bulkAddToAlbum}>ADD</button>
      <button type="button" disabled={!count || !targetAlbum} onClick={props.bulkMoveToAlbum}>MOVE</button>
      {inAlbum ? <button type="button" disabled={!count} onClick={props.bulkRemoveFromCurrentAlbum}>REMOVE</button> : null}
      <button type="button" disabled={!count} onClick={props.bulkMarkMe}>ME</button>
      <button type="button" disabled={!count} onClick={props.bulkMoveToMirror}>MIRROR</button>
      <button type="button" disabled={!count} onClick={props.bulkStar}>STAR</button>
      <button type="button" disabled={!count} className="danger" onClick={props.bulkDelete}>TRASH</button>
      <button type="button" onClick={props.clearSelection}>CLEAR</button>
    </div>
  );
}

function CenteredGlassesIcon(props) {
  const size = props && props.size ? props.size : 18;
  return (
    <svg
      className="centeredGlassesIcon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="glassesLens" cx="8" cy="12.25" r="3.65" />
      <circle className="glassesLens" cx="16" cy="12.25" r="3.65" />
      <path className="glassesBridge" d="M11.62 12.18c.45-.62 1.31-.62 1.76 0" />
      <path className="glassesArm" d="M4.55 10.52 3.25 9.4" />
      <path className="glassesArm" d="M19.45 10.52l1.3-1.12" />
    </svg>
  );
}

function ControlBar(props) {
  if (props.activePage && props.activePage !== "albums") return null;

  return (
    <div className="controlBar">
      <div className="leftControls">
        {props.archive && !props.currentAlbumId ? (
          <div className="modeBar">
            {ARCHIVE_FILTERS.map(function (filter) {
              return (
                <button
                  key={filter}
                  type="button"
                  className={props.archiveFilter === filter ? "selected" : ""}
                  onClick={function () {
                    props.setArchiveFilter(filter);
                  }}
                >
                  {archiveFilterLabel(filter)}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="albumInlineActions">
          <button
            type="button"
            className={props.albumSearchOpen ? "albumSearchToggle active" : "albumSearchToggle"}
            aria-label="Search"
            onClick={function () { props.setAlbumSearchOpen(function (value) { return !value; }); }}
          >
            <CenteredGlassesIcon size={18} />
          </button>
          <button
            type="button"
            className={props.albumCreateOpen ? "albumQuickCreate active" : "albumQuickCreate"}
            aria-label="New album"
            onClick={function () { props.setAlbumCreateOpen(function (value) { return !value; }); }}
          >
            +
          </button>
        </div>
        {props.sync !== "saved" ? <Pill>{up(props.sync)}</Pill> : null}
      </div>
    </div>
  );
}

function SystemShortcutCard(props) {
  const group = props.group || {};
  const sourceId = String((group && (group.sourceId || group.id)) || "").toLowerCase();
  const rawLabel = cleanSystemLabel(group.title || group.id);
  const labelText = String(rawLabel || "").toLowerCase();
  const isStarred = sourceId.indexOf("star") !== -1 || sourceId.indexOf("favorite") !== -1 || rawLabel === "★" || labelText === "starred" || labelText === "favorites";
  const isTrash = sourceId.indexOf("trash") !== -1 || labelText === "trash" || labelText === "trashed";
  const isUnassigned = sourceId.indexOf("unassigned") !== -1 || sourceId.indexOf("unknown") !== -1 || labelText === "?" || labelText === "unknown" || labelText === "unassigned";
  const tooltip = isStarred ? "Starred" : isTrash ? "Trash" : isUnassigned ? "Unassigned" : rawLabel;
  const className = cls("systemRailItem", (isStarred || isTrash || isUnassigned) ? "iconShortcut" : "", isStarred ? "starShortcut" : "", isTrash ? "trashShortcut" : "", isUnassigned ? "unknownShortcut" : "");

  return (
    <button type="button" className={className} data-source-id={sourceId} {...withSettingtip(tooltip)} onClick={function () { props.openGroup(group); }}>
      <span>{isStarred ? "★" : isTrash ? <Trash2 size={13} strokeWidth={2.15} /> : isUnassigned ? <span className="questionMark">?</span> : rawLabel}</span>
      <em>{safeArray(group.items).length}</em>
    </button>
  );
}

function GroupCard(props) {
  const group = props.group || {};
  const items = newest(safeArray(group.items));
  const cover = items[0] || null;
  const video = cover && pzIsVideo(cover);
  const count = items.length;
  const childCount = Number(group.childCount || 0);
  const badges = [group.pinned ? "PINNED" : "", group.locked ? "LOCKED" : "", group.excludeFromAll ? "HIDDEN" : ""].filter(Boolean);

  return (
    <article className={cls("groupCard proAlbumCard", group.excludeFromAll && "excludedFromAll")} onClick={function () { props.openGroup && props.openGroup(group); }}>
      <div className="groupCover proAlbumCover">
        {cover ? (video ? <video src={cover.previewUrl || cover.storageUrl || cover.url} muted playsInline preload="metadata" /> : <img src={cover.previewUrl || cover.storageUrl || cover.url} alt="" loading="lazy" />) : <span className="pzBlankCover"><PhotozAlbumDockIcon size={32} /></span>}
        {items.slice(1, 4).length ? (
          <div className="albumMiniStack">
            {items.slice(1, 4).map(function (memory) {
              const source = pzMediaSource(memory);
              return <span key={memory.id}>{pzIsVideo(memory) ? <video src={source} muted playsInline preload="metadata" /> : <img src={source} alt="" loading="lazy" />}</span>;
            })}
          </div>
        ) : null}
        {video ? <span className="pzVideoBadge"><Film size={11} />{pzVideoLabel(cover)}</span> : null}
      </div>
      <div className="groupMeta proAlbumMeta">
        <strong>{cleanSystemLabel(group.title || group.id)}</strong>
        {group.description ? <p>{group.description}</p> : null}
        <span>{albumStatsLabel(items, childCount)}</span>
      </div>
      {badges.length ? <div className="albumBadges">{badges.map(function (badge) { return <em key={badge}>{badge}</em>; })}</div> : null}
      {!group.virtual && !isSystemAlbumGroup(group) ? <button type="button" className="pzGroupEditButton" aria-label="Edit album" onClick={function (event) { event.stopPropagation(); props.onEditAlbum && props.onEditAlbum(group); }}><FolderPen size={12} /></button> : null}
    </article>
  );
}









function mirrorAllMemories(memories) {
  // MIRROR all layer: every file marked ME, regardless of whether it is also starred.
  return meMemories(memories);
}

function mirrorFeaturedMemories(memories, albums) {
  // MIRROR first layer: only files that are BOTH marked ME and starred.
  // ME and STARRED are tags, not exclusive folders, so the same file must live in both views.
  return newest(safeArray(memories).map(normalizeMemoryRecord).filter(function (memory) {
    return isMeMemory(memory) && isStarredMemory(memory, albums) && !memory.trashed && !memory.archived;
  }));
}


function MirrorFilter(props) {
  const allMemories = safeArray(props.memories).map(normalizeMemoryRecord);
  const allAlbums = safeArray(props.albums).map(normalizeAlbumRecord);
  const allMirror = mirrorAllMemories(allMemories);
  const featuredMirror = mirrorFeaturedMemories(allMemories, allAlbums);
  const items = props.mirrorAllMode ? allMirror : featuredMirror;
  const total = allMirror.length;

  return (
    <div className="pageScroll mirrorPage">
      <VisibleReporter items={items} reportVisibleIds={props.reportVisibleIds} />
      <div className="mirrorModeRail">
        <button
          type="button"
          {...withSettingtip("Show all ME files")}
          className={props.mirrorAllMode ? "active" : ""}
          onClick={function () { props.setMirrorAllMode(function (value) { return !value; }); }}
        >
          <PhotozMirrorDockIcon size={14} />
          <span>All</span>
          <em>{total}</em>
        </button>
      </div>

      {!items.length ? (
        <EmptyState />
      ) : (
        <div className="photoGrid mirrorGrid">
          {items.map(function (memory) {
            return (
              <PhotoCard
                key={memory.id}
                memory={memory}
                showText
                selectionMode={props.selectionMode}
                selected={props.selectedIds && props.selectedIds[memory.id]}
                toggleSelected={props.toggleSelected}
                setSelectionMode={props.setSelectionMode}
                isStarred={props.starredIds && props.starredIds[memory.id]}
                onDelete={props.deleteMemory}
                onClick={function () { props.openMemory(memory); }}
              
                onEdit={props.onEditMemory || function () {}}
                onPlayVideo={props.onPlayVideo || function () {}}
                onLongSelect={function (memory) { (typeof setSelectionMode !== "undefined" ? setSelectionMode(true) : (typeof props !== "undefined" && props.setSelectionMode ? props.setSelectionMode(true) : null)); const fn = (typeof toggleSelected !== "undefined" ? toggleSelected : (typeof props !== "undefined" ? props.toggleSelected : null)); if (fn) fn(memory.id); }}
                onDragSelect={function (memory) { const lookup = (typeof selectedIds !== "undefined" ? selectedIds : (typeof props !== "undefined" ? props.selectedIds : {})); const fn = (typeof toggleSelected !== "undefined" ? toggleSelected : (typeof props !== "undefined" ? props.toggleSelected : null)); (typeof setSelectionMode !== "undefined" ? setSelectionMode(true) : (typeof props !== "undefined" && props.setSelectionMode ? props.setSelectionMode(true) : null)); if (fn && (!lookup || !lookup[memory.id])) fn(memory.id); }}/>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlbumsFilter(props) {
  const q = props.albumQuery.trim().toLowerCase();
  const albums = sortAlbumGroups(
    virtualAlbumGroups(safeArray(props.albums), safeArray(props.memories)).concat(
      albumGroups(safeArray(props.albums), safeArray(props.memories), props.currentAlbumId)
    ),
    props.albumSort
  ).filter(function (folder) {
    return !q || String(folder.title || "").toLowerCase().indexOf(q) !== -1;
  });
  const currentAlbum = props.currentAlbumId ? albumById(props.albums, props.currentAlbumId) : null;
  const currentPhotos = currentAlbum ? directAlbumMemories(props.albums, props.memories, props.currentAlbumId) : [];
  const groupingSource = currentAlbum ? currentPhotos : safeArray(props.memories);
  const archiveGroups = props.archiveFilter === "albums" ? albums : groupBy(props.archiveFilter, groupingSource);
  const virtualGroups = props.archiveFilter === "albums" && !props.currentAlbumId ? safeArray(archiveGroups).filter(isSystemAlbumGroup) : [];
  const seenVirtualLabels = {};
  const dedupedVirtualGroups = safeArray(virtualGroups).filter(function (group) {
    const label = cleanSystemLabel(group.title || group.id);
    if (seenVirtualLabels[label]) return false;
    seenVirtualLabels[label] = true;
    return true;
  });
  const realGroups = props.archiveFilter === "albums" ? safeArray(archiveGroups).filter(function (group) { return !isSystemAlbumGroup(group); }) : safeArray(archiveGroups);
  const isAlbums = props.archiveFilter === "albums";
  return (
    <div className="pageScroll albumsPage proAlbumsView">
      <VisibleReporter items={props.currentAlbumId ? currentPhotos : safeArray(props.memories)} reportVisibleIds={props.reportVisibleIds} />
      {isAlbums && (props.albumSearchOpen || props.albumCreateOpen) ? (
        <div className="albumControlsRow">
          {props.albumSearchOpen ? (
            <label className="albumSearchOnly" aria-label="SEARCH">
              <input
                value={props.albumQuery}
                onChange={function (event) { props.setAlbumQuery(event.target.value); }}
                placeholder="SEARCH"
                autoFocus
              />
            </label>
          ) : null}
          {props.albumCreateOpen ? (
            <div className="newAlbumPanel">
              <input
                value={props.draft}
                onChange={function (event) { props.setDraft(event.target.value); }}
                placeholder={props.currentAlbumId ? "Nested album name" : "Album name"}
              />
              <button type="button" onClick={props.createAlbum}>Create</button>
              <button type="button" onClick={function () { props.setAlbumCreateOpen(false); props.setDraft(""); }}>Cancel</button>
            </div>
          ) : null}
        </div>
      ) : null}


      {isAlbums && currentAlbum ? (
        <AlbumWorkspaceHero
          album={currentAlbum}
          photos={currentPhotos}
          children={realGroups}
          backToAlbums={function () { props.setCurrentAlbumId(""); props.setAlbumQuery(""); props.setAlbumCreateOpen(false); }}
          openCreate={function () { props.setAlbumCreateOpen(true); }}
          editAlbum={props.onEditAlbum}
          toggleHidden={props.toggleAlbumExcludeFromAll}
        />
      ) : null}

      {isAlbums && dedupedVirtualGroups.length ? (
        <div className="systemRail">
          {safeArray(dedupedVirtualGroups).map(function (group) {
            return <SystemShortcutCard key={group.id} group={group} openGroup={props.openGroup} />;
          })}
        </div>
      ) : null}

      {!isAlbums ? <div className="archiveLabel">{up(props.archiveFilter)}</div> : null}
      <AlbumSectionHeader show={isAlbums && currentAlbum && realGroups.length} title="ALBUMS" count={realGroups.length} />
      <div className={isAlbums ? "albumGrid folderFilter proAlbumGrid" : props.archiveFilter === "months" ? "albumGrid filterFilter" : "timelineStack filterFilter"}>
        {safeArray(isAlbums ? realGroups : archiveGroups).map(function (group) {
          const editing = isAlbums && props.editingId === group.sourceId;
          if (!isAlbums) {
            return <SystemShortcutCard key={group.id} group={group} openGroup={props.openGroup} />;
          }

          return (
            <div className={group.excludeFromAll ? "albumTile excludedFromAll" : "albumTile"} key={group.id}>
              <div className="tileActions">
                {!group.virtual ? <button type="button" onClick={function () { props.toggleAlbumPin(group.sourceId); }}>{group.pinned ? "Unpin" : "Pin"}</button> : null}
                {!group.virtual ? <button type="button" onClick={function () { props.toggleAlbumLock(group.sourceId); }}>{group.locked ? "Unlock" : "Lock"}</button> : null}
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
                <GroupCard group={group} openGroup={props.openGroup} openMemory={props.openMemory} deleteMemory={props.deleteMemory} selectionMode={props.selectionMode} selectedIds={props.selectedIds} toggleSelected={props.toggleSelected} setSelectionMode={props.setSelectionMode} starredIds={props.starredIds} 
                onEditAlbum={function (group) { props.onEditAlbum && props.onEditAlbum(group); }}/>
              )}
            </div>
          );
        })}
      </div>

      {isAlbums && currentAlbum ? (
        <>
          {!currentPhotos.length && !realGroups.length ? <EmptyState /> : null}
          {currentPhotos.length ? (
            <div className="photoGrid albumPhotoGrid">
              {safeArray(currentPhotos).map(function (memory) {
                return <PhotoCard key={memory.id} memory={memory} showText selectionMode={props.selectionMode} selected={props.selectedIds && props.selectedIds[memory.id]} toggleSelected={props.toggleSelected} setSelectionMode={props.setSelectionMode} isStarred={props.starredIds && props.starredIds[memory.id]} onDelete={props.deleteMemory} onClick={function () { props.openMemory(memory); }} 
                onEdit={props.onEditMemory}
                onPlayVideo={props.onPlayVideo}
                onLongSelect={function (memory) { (typeof setSelectionMode !== "undefined" ? setSelectionMode(true) : (typeof props !== "undefined" && props.setSelectionMode ? props.setSelectionMode(true) : null)); const fn = (typeof toggleSelected !== "undefined" ? toggleSelected : (typeof props !== "undefined" ? props.toggleSelected : null)); if (fn) fn(memory.id); }}
                onDragSelect={function (memory) { const lookup = (typeof selectedIds !== "undefined" ? selectedIds : (typeof props !== "undefined" ? props.selectedIds : {})); const fn = (typeof toggleSelected !== "undefined" ? toggleSelected : (typeof props !== "undefined" ? props.toggleSelected : null)); (typeof setSelectionMode !== "undefined" ? setSelectionMode(true) : (typeof props !== "undefined" && props.setSelectionMode ? props.setSelectionMode(true) : null)); if (fn && (!lookup || !lookup[memory.id])) fn(memory.id); }}/>;
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function searchTextForMemory(memory, albums) {
  const albumTitles = safeArray(albums).filter(function (album) {
    return albumMemoryIds(album).indexOf(memory.id) !== -1;
  }).map(function (album) { return album.title; });
  return [
    memory.title,
    memory.filename,
    memory.name,
    memory.type,
    memory.kind,
    memory.year,
    memory.month,
    memory.era,
    memory.date,
    memory.createdAt,
    memory.updatedAt,
    memory.uploadStatus,
    memory.storageKey,
    memory.storageUrl,
    memory.previewUrl,
    safeArray(memory.tags).join(" "),
    safeArray(memory.albumIds).join(" "),
    albumTitles.join(" "),
  ].filter(Boolean).join(" ").toLowerCase();
}

function matchesSearchQuery(memory, query, albums) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return searchTextForMemory(memory, albums).indexOf(q) !== -1;
}





function SearchFilter(props) {
  const query = String(props.query || "").trim();
  const rawFilter = props.searchFilter || props.filter || "all";
  const activeSearchFilter = PRIMARY_SEARCH_FILTERS.indexOf(rawFilter) !== -1 ? rawFilter : "all";
  const setFilter = props.setSearchFilter || props.setFilter || function () {};
  const allMemories = safeArray(props.memories).map(normalizeMemoryRecord);
  const allAlbums = safeArray(props.albums).map(normalizeAlbumRecord);
  // Search mode is intentionally broad: show every non-trashed file unless the file
  // itself is hidden from All or it belongs to an album hidden from All.
  const baseItems = newest(allMemories.filter(function (memory) {
    return memoryVisibleInSearch(memory, allAlbums);
  }));
  const allItems = newest(baseItems.filter(function (memory) {
    return matchesSearchFilter(memory, allAlbums, activeSearchFilter);
  }));
  const items = allItems.filter(function (memory) {
    return matchesSearchQuery(memory, query, allAlbums);
  });
  const searchFilterOpen = Boolean(props.advancedSearchOpen);
  const setSearchFilterOpen = props.setAdvancedSearchOpen || function () {};
  const activeFilterLabel = activeSearchFilter === "all" ? "BROWSE" : up(activeSearchFilter);

  return (
    <div className="pageScroll searchPage">
      <VisibleReporter items={items} reportVisibleIds={props.reportVisibleIds} />

      <div className="searchControlRow compactSearchControlRow">
        <div className="searchBar librarySearchBar unifiedSearchBar">
          <Search size={15} />
          <input
            value={props.query}
            onChange={function (event) { props.setQuery(event.target.value); }}
            placeholder="SEARCH"
          />
          <div className="searchFilterDropdown inlineSearchFilterDropdown">
            <button
              type="button"
              className={searchFilterOpen ? "searchFilterTrigger iconOnly active" : "searchFilterTrigger iconOnly"}
              aria-label="Filter results"
              onClick={function () { setSearchFilterOpen(function (value) { return !value; }); }}
            >
              <SlidersHorizontal size={14} />
            </button>
            {searchFilterOpen ? (
              <div className="searchFilterMenu">
                {PRIMARY_SEARCH_FILTERS.map(function (filter) {
                  return (
                    <button
                      type="button"
                      key={filter}
                      className={activeSearchFilter === filter ? "active" : ""}
                      onClick={function () { setFilter(filter); setSearchFilterOpen(false); }}
                    >
                      {filter === "all" ? "BROWSE" : up(filter)}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {!items.length ? (
        <EmptyState />
      ) : (
        <div className="photoGrid searchGrid">
          {items.map(function (memory) {
            return (
              <PhotoCard
                key={memory.id}
                memory={memory}
                showText
                selectionMode={props.selectionMode}
                selected={props.selectedIds && props.selectedIds[memory.id]}
                toggleSelected={props.toggleSelected}
                setSelectionMode={props.setSelectionMode}
                isStarred={props.starredIds && props.starredIds[memory.id]}
                onDelete={props.deleteMemory}
                onClick={function () { props.openMemory(memory); }}
                onEdit={props.onEditMemory}
                onPlayVideo={props.onPlayVideo}
              
                onLongSelect={function (memory) { (typeof setSelectionMode !== "undefined" ? setSelectionMode(true) : (typeof props !== "undefined" && props.setSelectionMode ? props.setSelectionMode(true) : null)); const fn = (typeof toggleSelected !== "undefined" ? toggleSelected : (typeof props !== "undefined" ? props.toggleSelected : null)); if (fn) fn(memory.id); }}
                onDragSelect={function (memory) { const lookup = (typeof selectedIds !== "undefined" ? selectedIds : (typeof props !== "undefined" ? props.selectedIds : {})); const fn = (typeof toggleSelected !== "undefined" ? toggleSelected : (typeof props !== "undefined" ? props.toggleSelected : null)); (typeof setSelectionMode !== "undefined" ? setSelectionMode(true) : (typeof props !== "undefined" && props.setSelectionMode ? props.setSelectionMode(true) : null)); if (fn && (!lookup || !lookup[memory.id])) fn(memory.id); }}/>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GroupFilter(props) {
  const group = props.group || {};
  const items = sortMemories(safeArray(group.items), props.sortMode);
  const title = up(cleanSystemLabel(group.title || group.id || ""));
  return (
    <Glass className="shell groupShell">
      <VisibleReporter items={items} reportVisibleIds={props.reportVisibleIds} />
      <div className="groupTop compactGroupTop">
        <button type="button" onClick={props.back}><ChevronLeft size={16} /> BACK</button>
        {items.length ? <strong>{title}</strong> : null}
        {items.length ? <Pill>{items.length}</Pill> : null}
      </div>
      {items.length ? (
        <div className="photoGrid">
          {items.map(function (memory) {
            return (
              <PhotoCard
                key={memory.id}
                memory={memory}
                showText
                selectionMode={props.selectionMode}
                selected={props.selectedIds && props.selectedIds[memory.id]}
                toggleSelected={props.toggleSelected}
                setSelectionMode={props.setSelectionMode}
                isStarred={props.starredIds && props.starredIds[memory.id]}
                onDelete={props.deleteMemory}
                onClick={function () { props.openMemory(memory); }}
                onEdit={props.onEditMemory}
                onPlayVideo={props.onPlayVideo}
                onLongSelect={function (memory) { props.setSelectionMode && props.setSelectionMode(true); props.toggleSelected && props.toggleSelected(memory.id); }}
                onDragSelect={function (memory) { props.setSelectionMode && props.setSelectionMode(true); if (props.toggleSelected && (!props.selectedIds || !props.selectedIds[memory.id])) props.toggleSelected(memory.id); }}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState />
      )}
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
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoPan, setPhotoPan] = useState({ x: 0, y: 0 });
  const viewerPointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const lastTapRef = useRef(0);

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
    setShowMetadata(false);
    setShowTechnical(false);
    setEditDetailsOpen(false);
    setInspectorOpen(false);
    setPhotoZoom(1);
    setPhotoPan({ x: 0, y: 0 });
    viewerPointersRef.current.clear();
    pinchRef.current = null;
  }, [props.memory]);

  if (!props.memory) return null;

  const memory = normalizeMemoryRecord(props.memory);
  const video = pzIsVideo(memory);
  const source = pzMediaSource(memory);
  const currentAlbums = assignableAlbums(props.albums).filter(function (album) {
    return albumHasMemory(props.albums, album.id, memory.id);
  });
  const availableAlbums = assignableAlbums(props.albums);
  const albumLabel = currentAlbums.length ? currentAlbums.map(function (album) { return album.title; }).join(" / ") : "NONE";
  const sizeLabel = formatBytes(fileSizeBytes(memory));
  const displayTitle = String(draftTitle || memory.title || memory.label || "").trim() || pzMemoryDisplayName(memory);
  const originalName = memory.metadata?.originalName || memory.metadata?.name || memory.fileName || "";
  const titleMetaLine = [originalName && originalName !== displayTitle ? originalName : "", sizeLabel, dimensionsLabel(memory), readableDateTime(memory.metadata?.lastModifiedISO || memory.metadata?.lastModified || memory.createdAt || memory.date)].filter(Boolean).join("  •  ");
  const importedLabel = readableDateTime(memory.createdAt || memory.importedAt || memory.date) || memory.date || "";

  function clampZoom(value) {
    return Math.max(0.25, Math.min(6, Number(value) || 1));
  }

  function resetPhotoZoom() {
    setPhotoZoom(1);
    setPhotoPan({ x: 0, y: 0 });
    viewerPointersRef.current.clear();
    pinchRef.current = null;
  }

  function adjustPhotoZoom(delta) {
    setPhotoZoom(function (current) {
      const next = clampZoom(current + delta);
      if (next <= 1) setPhotoPan({ x: 0, y: 0 });
      return next;
    });
  }

  function handleViewerPointerDown(event) {
    if (video) return;
    viewerPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);

    const now = Date.now();
    if (now - lastTapRef.current < 280 && viewerPointersRef.current.size === 1) {
      event.preventDefault();
      setPhotoZoom(function (current) {
        const next = current > 1 ? 1 : 2.25;
        if (next <= 1) setPhotoPan({ x: 0, y: 0 });
        return next;
      });
    }
    lastTapRef.current = now;

    if (viewerPointersRef.current.size === 2) {
      const points = Array.from(viewerPointersRef.current.values());
      pinchRef.current = {
        distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        zoom: photoZoom
      };
    }
  }

  function handleViewerPointerMove(event) {
    if (video || !viewerPointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    const previous = viewerPointersRef.current.get(event.pointerId);
    viewerPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (viewerPointersRef.current.size === 2) {
      const points = Array.from(viewerPointersRef.current.values());
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const pinch = pinchRef.current || { distance, zoom: photoZoom };
      const next = clampZoom(pinch.zoom * (distance / Math.max(1, pinch.distance)));
      setPhotoZoom(next);
      if (next <= 1) setPhotoPan({ x: 0, y: 0 });
      return;
    }

    if (photoZoom > 1 && previous) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      setPhotoPan(function (current) {
        return { x: current.x + dx, y: current.y + dy };
      });
    }
  }

  function handleViewerPointerEnd(event) {
    viewerPointersRef.current.delete(event.pointerId);
    if (viewerPointersRef.current.size < 2) pinchRef.current = null;
    if (photoZoom <= 1.001) {
      setPhotoPan({ x: 0, y: 0 });
    }
  }

  function handleViewerWheel(event) {
    if (video) return;
    if (!event.ctrlKey && Math.abs(event.deltaY) < 40) return;
    event.preventDefault();
    adjustPhotoZoom(event.deltaY > 0 ? -0.25 : 0.25);
  }

  function saveDetails() {
    const nextPatch = {
      title: draftTitle,
      date: draftDate,
      era: draftEra,
      tags: draftTags,
      caption: draftCaption,
      location: draftLocation,
      event: draftEvent,
      rating: draftRating,
      label: draftLabel
    };
    props.updateMemoryDetails(memory, nextPatch);
    setEditDetailsOpen(false);
  }

  const photoTransform = video ? undefined : { transform: `translate3d(${photoPan.x}px, ${photoPan.y}px, 0) scale(${photoZoom})` };

  const modalNode = (
    <AnimatePresence>
      <motion.div className="modal fileInfoModal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={props.close}>
        <motion.div className={"modalCard fileInfoCard" + (inspectorOpen ? " inspectorOpen" : "")} initial={{ y: 18, scale: 0.985 }} animate={{ y: 0, scale: 1 }} onClick={function (event) { event.stopPropagation(); }}>
          <header className="fileInfoHeader">
            <div className="fileViewerPrimaryActions">
              {memory.trashed ? <>
                <button type="button" aria-label="Restore" data-tooltip="Restore" className="viewerTrashTextButton" onClick={function () { props.restoreMemory(memory); }}><RotateCcw size={17} /><span>RESTORE</span></button>
                <button type="button" aria-label="Delete forever" data-tooltip="Delete forever" className="danger viewerTrashTextButton" onClick={function () { props.permanentDeleteMemory(memory); }}><Trash2 size={17} /><span>DELETE FOREVER</span></button>
              </> : null}
            </div>
            <div className="fileViewerChromeActions"><button type="button" className={"fileViewerInfoButton" + (inspectorOpen ? " active" : "")} aria-label="Info" data-tooltip="Info" onClick={function () { setInspectorOpen(function (value) { return !value; }); }}><PanelRightOpen size={15} /> INFO</button><button type="button" className="fileInfoClose" aria-label="Close" data-tooltip="Close" onClick={props.close}><X size={18} /></button></div>
          </header>

          <main className={"fileInfoLayout" + (inspectorOpen ? " inspectorOpen" : "")}>
            <section className="fileInfoPreviewPanel">
              <div
                className={"fileInfoPreview" + (photoZoom > 1 ? " zoomed" : "")}
                onPointerDown={handleViewerPointerDown}
                onPointerMove={handleViewerPointerMove}
                onPointerUp={handleViewerPointerEnd}
                onPointerCancel={handleViewerPointerEnd}
                onWheel={handleViewerWheel}
                onDoubleClick={function (event) { event.preventDefault(); setPhotoZoom(function (current) { const next = current > 1 ? 1 : 2.25; if (next <= 1) setPhotoPan({ x: 0, y: 0 }); return next; }); }}
              >
                {video ? <video src={source} controls playsInline /> : <img src={source} alt="" draggable="false" style={photoTransform} />}
                {memory.trashed ? <span className="pzTrashRibbon">TRASH</span> : null}
              </div>
              <div className={"fileInfoZoomCorner" + (memory.trashed ? " trashZoomCorner" : "")} aria-label="Zoom controls">
                <button type="button" aria-label="Zoom out" data-tooltip="Zoom out" onClick={function () { adjustPhotoZoom(-0.35); }}><span aria-hidden="true" className="zoomGlyph">−</span></button>
                <button type="button" aria-label="Fit photo" data-tooltip="Fit" className="zoomLevelButton" onClick={resetPhotoZoom}><Maximize2 size={14} /><span>{Math.round(photoZoom * 100)}%</span></button>
                <button type="button" aria-label="Zoom in" data-tooltip="Zoom in" onClick={function () { adjustPhotoZoom(0.35); }}><span aria-hidden="true" className="zoomGlyph">+</span></button>
              </div>
              <div className="fileInfoActionRail" aria-label="Photo actions">
                <button type="button" aria-label="Favorite" data-tooltip="Favorite" className={props.isStarred ? "active" : ""} onClick={function () { props.toggleStar(memory); }}><Star size={17} /></button>
                <button type="button" aria-label="Me" data-tooltip="Me" className={isMeMemory(memory) ? "active" : ""} onClick={function () { props.toggleMeFlag(memory); }}><UserRound size={17} /></button>
                {!memory.trashed ? <button type="button" aria-label="Trash" data-tooltip="Trash" className="danger" onClick={function () { props.deleteMemory(memory); }}><Trash2 size={17} /></button> : null}
              </div>
            </section>

            {inspectorOpen ? <aside className="fileInfoInspector open">
              <div className="fileInfoTitleBlock fileInfoInspectorTitleBlock">
                <span className="fileInfoTypeGlyph" aria-label={video ? "Video" : "Photo"}>{video ? <Film size={13} /> : <Image size={13} />}</span>
                <h2>{displayTitle}</h2>
                <em>{titleMetaLine}</em>
              </div>

              <div className="fileInfoStats fileInfoFacts">
                <span className="fileInfoMediaSymbol" aria-label={video ? "Video" : "Photo"}>{video ? <Film size={16} /> : <Image size={16} />}</span>
                <span><em>SIZE</em><strong>{sizeLabel}</strong></span>
                <span><em>DIMENSIONS</em><strong>{dimensionsLabel(memory)}</strong></span>
                <span><em>IMPORTED</em><strong>{importedLabel || "—"}</strong></span>
              </div>

              <section className="fileInfoPanel fileInfoCoreMetaPanel">
                <div className="fileInfoMetaLine"><span>ORIGINAL</span><strong>{memory.metadata?.originalName || memory.metadata?.name || memory.fileName || "UNKNOWN"}</strong></div>
                <div className="fileInfoMetaLine"><span>FORMAT</span><strong>{memory.mimeType || memory.type || memory.metadata?.type || "UNKNOWN"}</strong></div>
                <div className="fileInfoMetaLine"><span>MODIFIED</span><strong>{readableDateTime(memory.metadata?.lastModifiedISO || memory.metadata?.lastModified) || "UNKNOWN"}</strong></div>
                <div className="fileInfoMetaLine"><span>IMPORTED</span><strong>{readableDateTime(memory.createdAt || memory.importedAt || memory.date) || memory.date || "UNKNOWN"}</strong></div>
              </section>

              <section className={"fileInfoPanel fileInfoDetailsPanel" + (editDetailsOpen ? " editing" : "") }>
                <div className="fileInfoPanelTop"><strong>DETAILS</strong>{editDetailsOpen ? <button type="button" onClick={saveDetails}><Save size={13} /> SAVE</button> : <button type="button" onClick={function () { setEditDetailsOpen(true); }}>EDIT</button>}</div>
                {editDetailsOpen ? <div className="fileInfoFormGrid">
                  <label><span>TITLE</span><input value={draftTitle} onChange={function (event) { setDraftTitle(event.target.value); }} /></label>
                  <label><span>DATE</span><input value={draftDate} onChange={function (event) { setDraftDate(event.target.value); }} /></label>
                  <label><span>ERA</span><input value={draftEra} onChange={function (event) { setDraftEra(event.target.value); }} /></label>
                  <label><span>LOCATION</span><input value={draftLocation} onChange={function (event) { setDraftLocation(event.target.value); }} /></label>
                  <label><span>EVENT</span><input value={draftEvent} onChange={function (event) { setDraftEvent(event.target.value); }} /></label>
                  <label><span>RATING</span><input value={draftRating} onChange={function (event) { setDraftRating(event.target.value); }} /></label>
                  <label className="wide"><span>TAGS</span><input value={draftTags} onChange={function (event) { setDraftTags(event.target.value); }} /></label>
                  <label className="wide"><span>CAPTION</span><textarea value={draftCaption} onChange={function (event) { setDraftCaption(event.target.value); }} /></label>
                </div> : <div className="fileInfoDetailsSummary"><span>{displayTitle}</span><span>{draftDate || "No date"}</span><span>{draftEra || "Unassigned"}</span></div>}
              </section>

              <section className="fileInfoPanel fileInfoAlbumPanel">
                <div className="fileInfoPanelTop"><strong>PHOTO ALBUM</strong><span>{albumLabel}</span></div>
                <div className="fileInfoAlbumControls">
                  <select value={selectedAlbum} aria-label="Choose photo album" onChange={function (event) { setSelectedAlbum(event.target.value); }}>
                    {availableAlbums.map(function (album) {
                      return <option value={album.id} key={album.id}>{album.title || "PHOTO ALBUM"}</option>;
                    })}
                  </select>
                  <button type="button" disabled={!selectedAlbum || albumHasMemory(props.albums, selectedAlbum, memory.id)} onClick={function () { props.addToAlbum(memory, selectedAlbum); }}>ADD</button>
                  <button type="button" disabled={!selectedAlbum} onClick={function () { props.moveToAlbum(memory, selectedAlbum); }}>MOVE</button>
                  <button type="button" className="danger" disabled={!selectedAlbum || !albumHasMemory(props.albums, selectedAlbum, memory.id)} onClick={function () { props.removeFromAlbum(memory, selectedAlbum); }}>REMOVE</button>
                </div>
              </section>

              {showTechnical ? (
                <section className="fileInfoPanel fileInfoTechnicalPanel">
                  <span>{memory.metadata && memory.metadata.webkitRelativePath ? memory.metadata.webkitRelativePath : memory.storageKey || "NO STORAGE KEY"}</span>
                  {memory.takeoutMeta && memory.takeoutMeta.sidecarPath ? <span>TAKEOUT JSON {memory.takeoutMeta.sidecarPath}</span> : null}
                </section>
              ) : null}

              {showMetadata ? <pre className="fileInfoMetadata">{JSON.stringify(memory.metadata || {}, null, 2)}</pre> : null}
            </aside> : null}
          </main>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(modalNode, document.body) : modalNode;
}
















function pzNowIso() {
  return new Date().toISOString();
}

function pzIsVideo(memory) {
  const source = memory && typeof memory === "object" ? memory : {};
  const type = String(source.type || source.mimeType || source.metadata?.type || source.kind || "").toLowerCase();
  const name = String(source.fileName || source.filename || source.name || source.title || source.storageKey || "").toLowerCase();
  return type.indexOf("video") !== -1 || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(name);
}

function pzMemoryDisplayName(memory) {
  const source = memory && typeof memory === "object" ? memory : {};
  return source.title || source.fileName || source.filename || source.name || source.storageKey || "FILE";
}

function pzVideoRuntime(memory) {
  const source = memory && typeof memory === "object" ? memory : {};
  const seconds = Number(source.duration || source.durationSeconds || source.metadata?.duration || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return "VIDEO";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return String(mins) + ":" + String(secs).padStart(2, "0");
}

function pzVideoSizeLabel(memory) {
  return formatBytes(fileSizeBytes(memory));
}

function pzMediaSource(memory) {
  const source = memory && typeof memory === "object" ? memory : {};
  if (source.storageKey) return originalUrlForMemory(source);
  return source.storageUrl || source.previewUrl || source.url || "";
}

function pzUpdateAlbum(items, id, patch) {
  const target = String(id || "");
  return safeArray(items).map(normalizeAlbumRecord).map(function (album) {
    if (String(album.id) !== target) return album;
    return normalizeAlbumRecord({ ...album, ...(patch || {}) });
  });
}

function pzUpdateMemory(items, id, patch) {
  const target = String(id || "");
  return safeArray(items).map(normalizeMemoryRecord).map(function (memory) {
    if (String(memory.id) !== target) return memory;
    return normalizeMemoryRecord({ ...memory, ...(patch || {}) });
  });
}

function PzToastStack(props) {
  const items = safeArray(props.items);
  if (!items.length) return null;

  return (
    <div className="pzToastStack" aria-live="polite" aria-atomic="false">
      {items.map(function (toast) {
        const tone = toast && toast.type ? String(toast.type) : "info";
        return (
          <div key={toast.id || toast.title || toast.message} className={"pzToast " + tone}>
            {toast.title ? <strong>{toast.title}</strong> : null}
            {toast.message ? <span>{toast.message}</span> : null}
          </div>
        );
      })}
    </div>
  );
}


function PzAlbumEditorPanel(props) {
  const album = props.album ? normalizeAlbumRecord(props.album) : null;
  const [draftTitle, setDraftTitle] = useState(album ? album.title : "");
  const [draftDescription, setDraftDescription] = useState(album ? album.description : "");
  const [draftParentId, setDraftParentId] = useState(album ? album.parentId || "" : "");
  const [draftHidden, setDraftHidden] = useState(album ? Boolean(album.excludeFromAll) : false);
  const [draftLocked, setDraftLocked] = useState(album ? Boolean(album.locked) : false);
  const [draftPinned, setDraftPinned] = useState(album ? Boolean(album.pinned) : false);

  useEffect(function () {
    setDraftTitle(album ? album.title : "");
    setDraftDescription(album ? album.description || "" : "");
    setDraftParentId(album ? album.parentId || "" : "");
    setDraftHidden(album ? Boolean(album.excludeFromAll) : false);
    setDraftLocked(album ? Boolean(album.locked) : false);
    setDraftPinned(album ? Boolean(album.pinned) : false);
  }, [album && album.id]);

  if (!props.open || !album) return null;

  const parentOptions = safeArray(props.albums).map(normalizeAlbumRecord).filter(function (item) {
    return item.id !== album.id && item.id !== "star";
  });

  function save() {
    if (props.onSave) {
      props.onSave(album.id, {
        title: draftTitle || album.title || "PHOTO ALBUM",
        description: draftDescription,
        parentId: draftParentId,
        excludeFromAll: draftHidden,
        locked: draftLocked,
        pinned: draftPinned
      });
    }
    if (props.onClose) props.onClose();
  }

  return (
    <div className="modalBackdrop pzDetailBackdrop" onClick={props.onClose}>
      <section className="pzEditorSheet pzAlbumEditorPanel" onClick={function (event) { event.stopPropagation(); }}>
        <header>
          <div>
            <em>PHOTO ALBUM</em>
            <strong>{album.title || "PHOTO ALBUM"}</strong>
          </div>
          <button type="button" className="closeButton" onClick={props.onClose}>×</button>
        </header>

        <div className="pzDetailFieldsGrid">
          <label className="span2"><span>TITLE</span><input value={draftTitle} onChange={function (event) { setDraftTitle(event.target.value); }} /></label>
          <label className="span2"><span>DESCRIPTION</span><textarea value={draftDescription} onChange={function (event) { setDraftDescription(event.target.value); }} /></label>
          <label className="span2"><span>PARENT</span><select value={draftParentId} onChange={function (event) { setDraftParentId(event.target.value); }}>
            <option value="">NONE</option>
            {parentOptions.map(function (item) { return <option key={item.id} value={item.id}>{item.title}</option>; })}
          </select></label>
          <label className="pzEditorToggleRow"><input type="checkbox" checked={draftPinned} onChange={function (event) { setDraftPinned(event.target.checked); }} /><span>PINNED</span></label>
          <label className="pzEditorToggleRow"><input type="checkbox" checked={draftLocked} onChange={function (event) { setDraftLocked(event.target.checked); }} /><span>LOCKED</span></label>
          <label className="pzEditorToggleRow"><input type="checkbox" checked={draftHidden} onChange={function (event) { setDraftHidden(event.target.checked); }} /><span>HIDE FROM ALL</span></label>
        </div>

        <div className="pzEditorActions">
          <button type="button" onClick={save}>SAVE</button>
          {props.onSetCover ? <button type="button" onClick={function () { props.onSetCover(album.id); }}>SET COVER</button> : null}
          {props.onDelete ? <button type="button" className="danger" onClick={function () { props.onDelete(album.id); if (props.onClose) props.onClose(); }}>DELETE</button> : null}
        </div>
      </section>
    </div>
  );
}

function PasswordGate(props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function unlock(event) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code })
      });
      if (!response.ok) throw new Error("LOCKED");
      window.sessionStorage.setItem("photozUnlocked", "true");
      if (props.onUnlock) props.onUnlock();
    } catch (err) {
      setError("ACCESS DENIED");
    }
  }

  return (
    <div className="passwordGate">
      <form className="passwordCard" onSubmit={unlock}>
        <span>PHOTOZ</span>
        <input value={code} onChange={function (event) { setCode(event.target.value); }} placeholder="ACCESS CODE" autoFocus />
        <button type="submit">ENTER</button>
        {error ? <em>{error}</em> : null}
      </form>
    </div>
  );
}

function PzFileDetailEditor(props) {
  const memory = props.memory ? normalizeMemoryRecord(props.memory) : null;
  const [draft, setDraft] = useState(memory || {});

  useEffect(function () {
    setDraft(memory || {});
  }, [memory && memory.id]);

  if (!props.open || !memory) return null;

  function setField(name, value) {
    setDraft(function (current) { return { ...current, [name]: value }; });
  }

  const tagsText = safeArray(draft.tags).join(", ");
  const source = pzMediaSource(memory);
  const video = pzIsVideo(memory);

  return (
    <div className="modalBackdrop pzDetailBackdrop" onClick={props.onClose}>
      <section className="pzEditorSheet pzFileDetailEditor" onClick={function (event) { event.stopPropagation(); }}>
        <header>
          <div>
            <em>{video ? "VIDEO" : "FILE"}</em>
            <strong>{pzMemoryDisplayName(memory)}</strong>
          </div>
          <button type="button" className="closeButton" onClick={props.onClose}>×</button>
        </header>
        <div className="pzDetailPreview">
          {video ? <video src={source} controls playsInline /> : <img src={source} alt="" />}
          {video ? <span className="pzVideoBadge"><Film size={12} />{pzVideoRuntime(memory)}</span> : null}
          {memory.trashed ? <span className="pzTrashRibbon">TRASH</span> : null}
        </div>
        <div className="pzDetailFieldsGrid">
          <label><span>TITLE</span><input value={draft.title || ""} onChange={function (event) { setField("title", event.target.value); }} /></label>
          <label><span>DATE</span><input value={draft.date || ""} onChange={function (event) { setField("date", event.target.value); }} /></label>
          <label><span>LOCATION</span><input value={draft.location || ""} onChange={function (event) { setField("location", event.target.value); }} /></label>
          <label><span>RATING</span><input value={draft.rating || ""} onChange={function (event) { setField("rating", event.target.value); }} /></label>
          <label className="span2"><span>CAPTION</span><textarea value={draft.caption || draft.description || ""} onChange={function (event) { setField("caption", event.target.value); }} /></label>
          <label className="span2"><span>TAGS</span><input value={tagsText} onChange={function (event) { setField("tags", event.target.value.split(",").map(function (tag) { return tag.trim(); }).filter(Boolean)); }} /></label>
        </div>
        <div className="pzEditorToggleRow">
          <button type="button" className={draft.starred ? "active" : ""} onClick={function () { setField("starred", !draft.starred); }}>★</button>
          <button type="button" className={draft.isMe ? "active" : ""} onClick={function () { setField("isMe", !draft.isMe); }}>ME</button>
          <button type="button" className={draft.private ? "active" : ""} onClick={function () { setField("private", !draft.private); }}>PRIVATE</button>
          <button type="button" className={draft.review ? "active" : ""} onClick={function () { setField("review", !draft.review); }}>REFILTER</button>
        </div>
        <div className="pzEditorActions pzDetailActions">
          <button type="button" onClick={function () { props.onSave(memory.id, draft); props.onClose(); }}>SAVE</button>
          <button type="button" onClick={function () { props.onDownload(memory); }}>DOWNLOAD</button>
          {memory.trashed ? (
            <button type="button" onClick={function () { props.onRestore(memory.id); props.onClose(); }}>RESTORE</button>
          ) : (
            <button type="button" className="danger" onClick={function () { props.onTrash(memory.id); props.onClose(); }}>TRASH</button>
          )}
          <button type="button" className="danger permaDeleteButton" onClick={function () { if (props.onPermanentDelete) props.onPermanentDelete(memory); }}>DELETE FOREVER</button>
        </div>
      </section>
    </div>
  );
}

function PzUploadRefilterPanel(props) {
  const queue = safeArray(props.queue);
  if (!props.open) return null;
  const failed = queue.filter(function (item) { return item.status === "FAILED"; }).length;
  const done = queue.filter(function (item) { return item.status === "DONE"; }).length;

  return (
    <div className="floatingPanel pzUploadRefilterPanel">
      <div className="panelSection">
        <div className="panelLabel">UPLOAD</div>
        <div className="pzQueueSummary">
          <span>{queue.length} FILES</span>
          <span>{failed} FAILED</span>
          <span>{done} DONE</span>
        </div>
        {queue.length ? queue.map(function (item) {
          return (
            <div className={item.status === "FAILED" ? "pzQueueRow failed" : item.status === "DONE" ? "pzQueueRow done" : "pzQueueRow"} key={item.id || item.name}>
              <span>{item.name}</span>
              <em>{item.status || "READY"}</em>
            </div>
          );
        }) : <div className="pzQueueRow muted"><span>NO QUEUE</span><em>—</em></div>}
      </div>
      <div className="panelSection">
        <button type="button" onClick={props.onRetryFailed}>RETRY FAILED</button>
        <button type="button" onClick={props.onClearComplete}>CLEAR COMPLETE</button>
        <button type="button" onClick={props.onClose}>CLOSE</button>
      </div>
    </div>
  );
}

function PzVideoPlaybackModal(props) {
  const memory = props.memory ? normalizeMemoryRecord(props.memory) : null;
  if (!props.open || !memory || !pzIsVideo(memory)) return null;
  const source = pzMediaSource(memory);

  return (
    <div className="modalBackdrop pzVideoBackdrop" onClick={props.onClose}>
      <section className="pzVideoCinemaPanel" onClick={function (event) { event.stopPropagation(); }}>
        <header>
          <div>
            <em>PLAYING</em>
            <strong>{memory.title || memory.name || "VIDEO"}</strong>
          </div>
          <button type="button" className="closeButton" onClick={props.onClose}>×</button>
        </header>
        <main>
          <div className="pzCinemaStage">
            <video src={source} controls autoPlay playsInline />
          </div>
          <aside className="pzCinemaInfo">
            <div><span>DURATION</span><strong>{pzVideoRuntime(memory)}</strong></div>
            <div><span>SIZE</span><strong>{pzVideoSizeLabel(memory)}</strong></div>
            <div><span>DATE</span><strong>{memory.date || "—"}</strong></div>
            <div><span>LOCATION</span><strong>{memory.location || "—"}</strong></div>
            <button type="button" onClick={function () { props.onEdit && props.onEdit(memory); }}>EDIT</button>
            <button type="button" onClick={function () { props.onDownload && props.onDownload(memory); }}>DOWNLOAD</button>
          </aside>
        </main>
      </section>
    </div>
  );
}




function withTooltip(label) {
  const value = String(label || "").trim();
  return value ? { "aria-label": value } : {};
}




















function MusicUtilityIcon(props) {
  const size = props.size || 20;
  return (
    <span className="musicUtilityIcon clearMusicNoteIcon" aria-hidden="true" style={{ width: size, height: size }}>
      <svg className="clearMusicNoteSvg" viewBox="0 0 32 32" focusable="false">
        <path className="clearMusicBeam" d="M12.1 7.4 24.7 5.1c.72-.13 1.35.42 1.35 1.15v12.58c0 2.58-2.26 4.62-5.18 4.62-2.42 0-4.25-1.28-4.25-3.05 0-1.9 2.05-3.35 4.73-3.35.82 0 1.58.14 2.2.4v-6.86l-10.12 1.86v8.68c0 2.6-2.24 4.64-5.16 4.64-2.44 0-4.27-1.28-4.27-3.06 0-1.9 2.05-3.35 4.75-3.35.82 0 1.58.14 2.2.4V8.83c0-.7.5-1.28 1.16-1.43Z" />
        <path className="clearMusicCut" d="M13.43 10.08 23.55 8.2v1.72l-10.12 1.86v-1.7Z" />
        <path className="clearMusicSpark" d="M27.55 4.4l.48.98 1.03.4-1.03.38-.48.99-.47-.99-1.03-.38 1.03-.4.47-.98Z" />
      </svg>
    </span>
  );
}



const AMBIENT_AUDIO_SOURCES = [];
const AMBIENT_YOUTUBE_VIDEO_ID = "QH-CAuEfCAA";

function createAmbientSynth(ctx) {
  const master = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const voices = [
    { frequency: 174, detune: -7 },
    { frequency: 261.63, detune: 3 },
    { frequency: 329.63, detune: 6 },
  ].map(function (voice) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = voice.frequency;
    osc.detune.value = voice.detune;
    filter.type = "lowpass";
    filter.frequency.value = 760;
    filter.Q.value = 0.42;
    gain.gain.value = 0.025;
    osc.connect(filter);
    filter.connect(gain);
    return { osc, filter, gain };
  });

  master.gain.value = 0.0001;
  lfo.type = "sine";
  lfo.frequency.value = 0.045;
  lfoGain.gain.value = 90;

  voices.forEach(function (voice) {
    lfo.connect(lfoGain);
    lfoGain.connect(voice.filter.frequency);
    voice.gain.connect(master);
  });

  return {
    master: master,
    voices: voices,
    lfo: lfo,
    start: function () {
      const now = ctx.currentTime;
      voices.forEach(function (voice) { voice.osc.start(now); });
      lfo.start(now);
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.085, now + 1.8);
    },
    stop: function () {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      voices.forEach(function (voice) {
        try { voice.osc.stop(now + 0.85); } catch (error) {}
      });
      try { lfo.stop(now + 0.85); } catch (error) {}
    },
    setVolume: function (value) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.linearRampToValueAtTime(Math.max(0.0001, value), now + 0.18);
    },
  };
}

function AmbientMusicControl() {
  const [enabled, setEnabled] = useState(function () {
    try { return window.localStorage.getItem("photozAmbientEnabled") === "true"; } catch (error) { return false; }
  });
  const audioRef = useRef(null);
  const synthRef = useRef(null);
  const ctxRef = useRef(null);

  useEffect(function () {
    try { window.localStorage.setItem("photozAmbientEnabled", enabled ? "true" : "false"); } catch (error) {}

    if (!enabled) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (synthRef.current) {
        synthRef.current.stop();
        synthRef.current = null;
      }
      return;
    }

    if (AMBIENT_YOUTUBE_VIDEO_ID) return;

    if (AMBIENT_AUDIO_SOURCES.length) {
      if (!audioRef.current) {
        const audio = new Audio(AMBIENT_AUDIO_SOURCES[0]);
        audio.loop = true;
        audio.preload = "auto";
        audioRef.current = audio;
      }
      audioRef.current.volume = 1;
      audioRef.current.play().catch(function () { setEnabled(false); });
      return;
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      if (!synthRef.current) {
        synthRef.current = createAmbientSynth(ctx);
        synthRef.current.master.connect(ctx.destination);
        synthRef.current.start();
      }
      synthRef.current.setVolume(0.095);
    } catch (error) {
      setEnabled(false);
    }
  }, [enabled]);

  useEffect(function () {
    return function () {
      if (audioRef.current) audioRef.current.pause();
      if (synthRef.current) synthRef.current.stop();
    };
  }, []);

  const youtubeSrc = enabled && AMBIENT_YOUTUBE_VIDEO_ID
    ? "https://www.youtube.com/embed/" + AMBIENT_YOUTUBE_VIDEO_ID + "?autoplay=1&loop=1&playlist=" + AMBIENT_YOUTUBE_VIDEO_ID + "&controls=0&modestbranding=1&playsinline=1"
    : "";

  return (
    <>
      <button
        type="button"
        className={enabled ? "utilityRailButton iconUtilityButton ambientUtilityButton active" : "utilityRailButton iconUtilityButton ambientUtilityButton"}
        aria-label={enabled ? "Ambient music on" : "Ambient music off"}
        onClick={function () { setEnabled(function (value) { return !value; }); }}
      >
        <span className="ambientGlyph">
          <MusicUtilityIcon size={18} />
        </span>
      </button>
      {youtubeSrc ? (
        <iframe
          className="ambientYoutubeFrame"
          src={youtubeSrc}
          title="Ambient music"
          allow="autoplay; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : null}
    </>
  );
}


function DeleteConfirmModal(props) {
  if (!props.open) return null;
  const title = "ARE YOU SURE?";
  const modalNode = (
    <AnimatePresence>
      <motion.div className="deleteConfirmBackdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={props.onCancel}>
        <motion.section className="deleteConfirmCard" initial={{ y: 14, scale: 0.985 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, scale: 0.985, opacity: 0 }} onClick={function (event) { event.stopPropagation(); }} role="dialog" aria-modal="true" aria-label={title}>
          <div className="deleteConfirmCopy">
            <strong>{title}</strong>
          </div>
          <div className="deleteConfirmActions">
            <button type="button" onClick={props.onCancel}>CANCEL</button>
            <button type="button" className="danger" onClick={props.onConfirm}>DELETE</button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
  return typeof document !== "undefined" ? createPortal(modalNode, document.body) : modalNode;
}

export default function App() {
  const [uploadNotice, setUploadNotice] = useState("");
  const [uploadPendingItems, setUploadPendingItems] = useState([]);
const [filterType, setFilterType] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterQuality, setFilterQuality] = useState("any");
  const [viewDensity, setViewDensity] = useState("normal");


  const [pzAlbumEditorId, setPzAlbumEditorId] = useState(null);
  const [pzDetailEditorId, setPzDetailEditorId] = useState(null);
  const [pzVideoPlayerId, setPzVideoPlayerId] = useState(null);
  const [pzUploadRefilterOpen, setPzUploadRefilterOpen] = useState(false);
  const [pzUploadQueue, setPzUploadQueue] = useState([]);
  const [pzBackupState, setPzBackupState] = useState({ lastSavedAt: "", lastBackupAt: "" });
  const [pzLibraryError, setPzLibraryError] = useState("");
  const [pzLibraryLoading, setPzLibraryLoading] = useState(false);
  const [pzToasts, setPzToasts] = useState([]);

  function pzPushToast(title, message, type) {
    const item = { id: "pz-toast-" + Date.now() + "-" + Math.random().toString(16).slice(2), title, message, type };
    setPzToasts(function (items) { return safeArray(items).concat(item).slice(-4); });
    setTimeout(function () {
      setPzToasts(function (items) { return safeArray(items).filter(function (toast) { return toast.id !== item.id; }); });
    }, 3200);
  }


  const [unlocked, setUnlocked] = useState(function () {
    try { return window.sessionStorage.getItem("photozUnlocked") === "true"; } catch (error) { return false; }
  });


  useEffect(function () {
    installUiInteractionSounds();
  }, []);

  function pzSaveAlbumEditor(id, patch) {
    setAlbums(function (items) { return pzUpdateAlbum(items, id, patch); });
    setPzBackupState(function (state) { return { ...state, lastSavedAt: pzNowIso() }; });
    pzPushToast("SAVED", "Album updated.", "success");
  }

  function pzDeleteAlbum(id) {
    setAlbums(function (items) {
      return safeArray(items).map(normalizeAlbumRecord).filter(function (album) { return album.id !== id && album.parentId !== id; });
    });
    setPzBackupState(function (state) { return { ...state, lastSavedAt: pzNowIso() }; });
    pzPushToast("REMOVED", "Album deleted.", "success");
  }

  function pzSetAlbumCover(id) {
    const album = albumById(albums, id);
    const first = album && safeArray(album.items)[0];
    if (!first) {
      pzPushToast("NO COVER", "Add files before setting cover.", "warn");
      return;
    }
    setAlbums(function (items) { return pzUpdateAlbum(items, id, { coverId: first }); });
    pzPushToast("COVER", "Album cover saved.", "success");
  }

  function pzSaveMemoryDetail(id, patch) {
    setMemories(function (items) { return pzUpdateMemory(items, id, patch); });
    setPzBackupState(function (state) { return { ...state, lastSavedAt: pzNowIso() }; });
    pzPushToast("SAVED", "File updated.", "success");
  }

  function pzTrashMemory(id) {
    setMemories(function (items) { return pzUpdateMemory(items, id, { trashed: true }); });
    setPzBackupState(function (state) { return { ...state, lastSavedAt: pzNowIso() }; });
    pzPushToast("TRASHED", "File moved to trash.", "success");
  }

  function pzDownloadMemory(memory) {
    if (!pzDownload(memory)) pzPushToast("NO FILE", "Original file is unavailable.", "warn");
  }


  function pzRestoreMemory(id) {
    setMemories(function (items) { return pzUpdateMemory(items, id, { trashed: false }); });
    setPzBackupState(function (state) { return { ...state, lastSavedAt: pzNowIso() }; });
    pzPushToast("RESTORED", "File restored.", "success");
  }

  

  

  function pzRetryFailedUploads() {
    setPzUploadQueue(function (items) {
      return safeArray(items).map(function (item) { return item.status === "FAILED" ? { ...item, status: "READY" } : item; });
    });
  }

  function pzClearCompleteUploads() {
    setPzUploadQueue(function (items) { return safeArray(items).filter(function (item) { return item.status !== "DONE"; }); });
  }

  const [archiveFilter, setArchiveFilter] = useState("albums");
  const [activePage, setActivePage] = useState("albums");
    const [mirrorAllMode, setMirrorAllMode] = useState(false);
const [screen, setScreen] = useState("home");
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeMemory, setActiveMemory] = useState(null);
  const [memories, setMemories] = useState([]);
  const [albums, setAlbums] = useState(ensureCoreAlbums(INITIAL_ALBUMS));
  const pzActiveAlbumEditor = albumById(albums, pzAlbumEditorId);
  const pzActiveDetailMemory = safeArray(memories).map(normalizeMemoryRecord).find(function (memory) { return memory.id === pzDetailEditorId; }) || null;
  const pzActiveVideoMemory = safeArray(memories).map(normalizeMemoryRecord).find(function (memory) { return memory.id === pzVideoPlayerId; }) || null;


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
  const [filterControlsOpen, setFilterControlsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [sortMode, setSortMode] = useState("newest");
  const [healthOpen, setHealthOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(false);
  const [missingReport, setMissingReport] = useState(null);
  const [fileAuditReport, setFileAuditReport] = useState(null);
  const [gridSize, setGridSize] = useState("normal");
  const [albumQuery, setAlbumQuery] = useState("");
  const [albumSearchOpen, setAlbumSearchOpen] = useState(false);
  const [albumCreateOpen, setAlbumCreateOpen] = useState(false);
  const [currentAlbumId, setCurrentAlbumId] = useState("");
  const [albumSort, setAlbumSort] = useState("recent");
  const [visibleIds, setVisibleIds] = useState([]);
  const [sync, setSync] = useState("loading");
  const [deleteConfirmRequest, setDeleteConfirmRequest] = useState(null);
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const saving = useRef(false);

  function closeTransientOverlays(except) {
    if (except !== "settings") setSettingsOpen(false);
    if (except !== "filter") setFilterControlsOpen(false);
    if (except !== "import") setImportPanelOpen(false);
    if (except !== "queue") setUploadQueueOpen(false);
    if (except !== "status") setStatusOpen(false);
    if (except !== "duplicates") setDuplicatesOpen(false);
    if (except !== "health") setHealthOpen(false);
    if (except !== "uploadRefilter") setPzUploadRefilterOpen(false);
    if (except !== "albumSearch") setAlbumSearchOpen(false);
    if (except !== "albumCreate") setAlbumCreateOpen(false);
    if (except !== "bulk") setBulkMoreOpen(false);
    if (except !== "searchFilter") setAdvancedSearchOpen(false);
    if (except !== "fileInfo") setActiveMemory(null);
    if (except !== "albumEditor") setPzAlbumEditorId(null);
    if (except !== "detailEditor") setPzDetailEditorId(null);
    if (except !== "videoPlayer") setPzVideoPlayerId(null);
    if (except !== "undo") setUndoSnapshot(null);
  }

  function openExclusiveSurface(name, setter, value) {
    closeTransientOverlays(name);
    setter(value === undefined ? true : value);
  }

  function toggleOverlay(name, isOpen, setter) {
    if (isOpen) {
      setter(false);
      return;
    }
    closeTransientOverlays(name);
    setter(true);
  }

  function setAlbumSearchExclusive(nextValue) {
    const next = typeof nextValue === "function" ? nextValue(albumSearchOpen) : nextValue;
    if (next) closeTransientOverlays("albumSearch");
    setAlbumSearchOpen(Boolean(next));
  }

  function setAlbumCreateExclusive(nextValue) {
    const next = typeof nextValue === "function" ? nextValue(albumCreateOpen) : nextValue;
    if (next) closeTransientOverlays("albumCreate");
    setAlbumCreateOpen(Boolean(next));
  }

  function leaveAlbumContext() {
    setCurrentAlbumId("");
    setAlbumQuery("");
    setAlbumCreateOpen(false);
    setAlbumSearchOpen(false);
    setActiveGroup(null);
    setScreen("home");
  }

  function navigatePage(pageId) {
    leaveAlbumContext();
    setActivePage(pageId);
  }

  function setArchiveFilterFromNav(filter) {
    // YEAR / MONTH / ERA are global archive views, never scoped to the album you were just inside.
    leaveAlbumContext();
    setArchiveFilter(filter);
  }

  const hasTransientOverlayOpen = Boolean(
    settingsOpen || filterControlsOpen || importPanelOpen || uploadQueueOpen || statusOpen ||
    duplicatesOpen || healthOpen || pzUploadRefilterOpen || albumSearchOpen || albumCreateOpen ||
    bulkMoreOpen || advancedSearchOpen || activeMemory || pzAlbumEditorId || pzDetailEditorId ||
    pzVideoPlayerId || undoSnapshot
  );
  useEffect(function () {
    if (!hasTransientOverlayOpen) return;
    function handlePointerDown(event) {
      const target = event.target;
      if (!target || !target.closest) return;
      if (target.closest(".photozOverlaySurface, .floatingPanel, .settingsPopover, .filterPopover, .filterPanel, .albumControlsRow, .albumInlineActions, .floatingUtilityCluster, .bulkBar, .dockWrap, .searchFilterDropdown, .modal, .modalCard, .modalBackdrop, .pzEditorSheet, .pzVideoCinemaPanel, .undoBar")) return;
      closeTransientOverlays();
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") closeTransientOverlays();
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return function () {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [hasTransientOverlayOpen]);

  useEffect(function () {
    closeTransientOverlays();
  }, [activePage, screen]);

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

  function openMemoryDetail(memory) {
    closeTransientOverlays("fileInfo");
    setActiveMemory(memory);
  }

  function openGroup(group) {
    closeTransientOverlays();
    if (group && group.sourceId && !group.virtual && activePage === "albums") {
      setCurrentAlbumId(String(group.sourceId));
      setAlbumQuery("");
      setAlbumCreateOpen(false);
      setAlbumSearchOpen(false);
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
    const next = safeArray(albums).map(function (album) {
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
    setCurrentAlbumId(nextAlbum.id);
    setActivePage("albums");
    setArchiveFilter("albums");
    setScreen("home");
    setActiveGroup(null);
    setDraft("");
    setAlbumCreateOpen(false);
    setAlbumSearchOpen(false);
    persist(memories, next);
  }

  function toggleAlbumLock(id) {
    if (id === UNASSIGNED_ALBUM_ID || id === "star") return;
    const next = safeArray(albums).map(function (album) {
      return album.id === id ? { ...album, locked: !Boolean(album.locked), updatedAt: new Date().toISOString() } : album;
    });
    setAlbums(next);
    persist(memories, next);
  }

  function toggleAlbumPin(id) {
    const next = safeArray(albums).map(function (album) {
      return album.id === id ? { ...album, pinned: !Boolean(album.pinned), updatedAt: new Date().toISOString() } : album;
    });
    setAlbums(next);
    persist(memories, next);
  }

  function deleteAlbum(id) {
    const album = safeArray(albums).find(function (item) { return item.id === id; });
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
    safeArray(memories).forEach(function (memory) { memoryIds[memory.id] = true; });

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


  function runFileAudit() {
    setHealthError(false);
    fetchFileAudit()
      .then(function (result) {
        setFileAuditReport(result);
        setHealth(function (current) { return { ...(current || {}), fileAudit: result }; });
      })
      .catch(function () { setHealthError(true); });
  }

  function repairFilesAndReload() {
    setHealthError(false);
    fetchFileRepair()
      .then(function (result) {
        setFileAuditReport(result);
        setHealth(function (current) { return { ...(current || {}), fileAudit: result, fileRepair: result }; });
        reloadIndex();
      })
      .catch(function () { setHealthError(true); });
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
    const selected = safeArray(memories).filter(function (memory) { return ids.indexOf(memory.id) !== -1; });
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
    safeArray(memories).forEach(function (memory) {
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
    safeArray(memories).forEach(function (memory) {
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
    return safeArray(memories).filter(function (memory) {
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

  function bulkRemoveFromCurrentAlbum() {
    if (!currentAlbumId) return;
    rememberUndo("REMOVE FROM ALBUM");

    const ids = selectedMemoryIds(selectedIds);
    if (!ids.length) return;
    let nextAlbums = albums;
    ids.forEach(function (id) {
      nextAlbums = removeMemoryFromAlbum(nextAlbums, currentAlbumId, id);
    });
    nextAlbums = ensureAlbumCoverage(memories, nextAlbums);
    setAlbums(nextAlbums);
    persist(memories, nextAlbums);
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

  function bulkMarkRefilter() {
    const ids = selectedMemoryIds(selectedIds);
    const nextMemories = memories.map(function (memory) {
      return ids.indexOf(memory.id) !== -1 ? { ...memory, review: true } : memory;
    });
    setMemories(nextMemories);
    persist(nextMemories, albums);
  }

  function bulkClearRefilter() {
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

  function requestDeleteForever(options) {
    const request = options || {};
    setDeleteConfirmRequest({
      title: request.title || "DELETE FOREVER",
      message: request.message || deleteConfirmCopy(request.count || 1),
      count: request.count || 1,
      onConfirm: typeof request.onConfirm === "function" ? request.onConfirm : function () {}
    });
  }

  function runDeleteConfirm() {
    const request = deleteConfirmRequest;
    setDeleteConfirmRequest(null);
    if (request && typeof request.onConfirm === "function") request.onConfirm();
  }

  function bulkDelete() {
    rememberUndo("BULK TRASH");
    
    const ids = selectedMemoryIds(selectedIds);
    if (!ids.length) return;

    const selected = safeArray(memories).filter(function (memory) { return ids.indexOf(memory.id) !== -1; });
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

    requestDeleteForever({
      title: "DELETE SELECTED",
      count: ids.length,
      message: deleteConfirmCopy(ids.length),
      onConfirm: function () {
        const doomed = selected;
        const nextMemories = safeArray(memories).filter(function (memory) {
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

    const nextMemories = safeArray(memories).map(function (item) {
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
    const nextMemories = safeArray(memories).map(function (item) {
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
    const nextMemories = safeArray(memories).map(function (item) {
      return item.id === memory.id ? { ...item, isMe: !Boolean(item.isMe) } : item;
    });
    const nextActive = nextMemories.find(function (item) {
      return item.id === memory.id;
    });
    setMemories(nextMemories);
    setActiveMemory(nextActive || null);
    persist(nextMemories, albums);
  }

  function toggleRefilter(memory) {
    if (!memory) return;
    const nextMemories = safeArray(memories).map(function (item) {
      return item.id === memory.id ? { ...item, review: !Boolean(item.review) } : item;
    });
    const nextActive = nextMemories.find(function (item) { return item.id === memory.id; });
    setMemories(nextMemories);
    setActiveMemory(nextActive || null);
    persist(nextMemories, albums);
  }

  function togglePrivate(memory) {
    if (!memory) return;
    const nextMemories = safeArray(memories).map(function (item) {
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
    const nextMemories = safeArray(memories).map(function (item) {
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
    const nextMemories = safeArray(memories).map(function (item) {
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
    const nextMemories = safeArray(memories).map(function (item) {
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
    const doomed = safeArray(memories).filter(function (memory) { return memory.trashed; });
    if (!doomed.length) return;
    requestDeleteForever({
      title: "EMPTY TRASH",
      count: doomed.length,
      message: deleteConfirmCopy(doomed.length),
      onConfirm: function () {
        const doomedIds = doomed.map(function (memory) { return memory.id; });
        const nextMemories = safeArray(memories).filter(function (memory) { return !memory.trashed; });
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
    });
  }

  function permanentDeleteMemory(memory) {
    if (!memory) return;
    requestDeleteForever({
      title: "DELETE FOREVER",
      count: 1,
      message: "This file will be removed from PHOTOZ and storage.",
      onConfirm: function () {
        const nextMemories = safeArray(memories).filter(function (item) {
          return item.id !== memory.id;
        });
        const nextAlbums = ensureAlbumCoverage(nextMemories, removeMemoryEverywhere(albums, memory.id));

        setActiveMemory(null);
        setPzDetailEditorId(null);
        if (activeGroup) {
          setActiveGroup({
            ...activeGroup,
            items: safeArray(activeGroup && activeGroup.items).filter(function (item) {
              return item.id !== memory.id;
            }),
          });
        }

        setMemories(nextMemories);
        setAlbums(nextAlbums);
        setSync("deleting");

        deleteOne(memory)
          .then(function () {
            pzPushToast("DELETED", "File permanently deleted.", "success");
            persist(nextMemories, nextAlbums);
          })
          .catch(function () {
            setSync("local");
            pzPushToast("LOCAL DELETE", "Removed locally. Storage delete will need retry.", "error");
            persist(nextMemories, nextAlbums);
          });
      }
    });
  }

  function deleteMemory(memory) {
    rememberUndo("TRASH");
    
    if (!memory) return;
    if (!memory.trashed) {
      const nextMemories = safeArray(memories).map(function (item) {
        return item.id === memory.id ? { ...item, trashed: true, deletedAt: new Date().toISOString(), inMirror: false } : item;
      });
      const nextActive = nextMemories.find(function (item) { return item.id === memory.id; });
      setActiveMemory(nextActive || null);
      setMemories(nextMemories);
      persist(nextMemories, albums);
      return;
    }

    requestDeleteForever({
      title: "DELETE FOREVER",
      count: 1,
      message: "This file will be removed from PHOTOZ and storage.",
      onConfirm: function () {
        const nextMemories = safeArray(memories).filter(function (item) {
          return item.id !== memory.id;
        });
        const nextAlbums = ensureAlbumCoverage(nextMemories, removeMemoryEverywhere(albums, memory.id));

        setActiveMemory(null);
        if (activeGroup) {
          setActiveGroup({
            ...activeGroup,
            items: safeArray(activeGroup && activeGroup.items).filter(function (item) {
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
            .then(function (uploadedMemory) {
              if (uploadedMemory) {
                Object.assign(memory, normalizeMemoryUrl(uploadedMemory), { uploadStatus: "r2" });
              } else {
                memory.uploadStatus = "failed";
              }
              if (memory.queueId) updateQueueItem(memory.queueId, { status: uploadedMemory ? "done" : "failed" });
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
          .then(function (uploadedMemory) {
            if (uploadedMemory) {
              pair.memory = { ...pair.memory, ...normalizeMemoryUrl(uploadedMemory), uploadStatus: "r2" };
              uploadFileRefs.current[queueItem.id].memory = pair.memory;
            } else {
              pair.memory.uploadStatus = "failed";
            }
            markQueueItem(queueItem.id, { status: uploadedMemory ? "done" : "failed" });
            setMemories(function (list) {
              const updated = list.map(function (item) {
                return item.id === pair.memory.id ? normalizeMemoryUrl({ ...item, ...pair.memory }) : item;
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

  async function handleUploadOriginal(eventOrFiles) {
    const sourceFiles = eventOrFiles && eventOrFiles.target && eventOrFiles.target.files
      ? eventOrFiles.target.files
      : eventOrFiles;
    const incomingFiles = Array.prototype.slice.call(sourceFiles || []);
    const sidecarFiles = incomingFiles.filter(isTakeoutSidecarFile);
    const sidecarMap = await buildTakeoutSidecarMap(sidecarFiles);
    const files = incomingFiles.filter(isMediaUploadFile);
    if (eventOrFiles && eventOrFiles.target) eventOrFiles.target.value = "";

    if (!files.length) {
      setImportSummary({ total: 0, added: 0, skipped: 0, large: 0, duplicates: 0, bytes: 0, takeout: 0, sidecars: sidecarFiles.length, failed: incomingFiles.length });
      return;
    }

    rememberUndo("IMPORT");
    backupIndex();

    const signatures = existingSignatureMap(safeArray(memories));
    const existingIds = new Set(safeArray(memories).map(function (memory) { return String(memory.id); }));
    const plan = uploadPlanStats(files, memories, sidecarFiles.length);
    const freshFiles = files.filter(function (file) {
      const memoryId = "memory-" + stableFileImportId(file);
      return !skipDuplicates || (!signatures[fileSignature(file)] && !existingIds.has(memoryId));
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
      takeout: plan.takeout,
      sidecars: plan.sidecars,
      remaining: Math.max(0, freshFiles.length - batchFiles.length),
    });
    closeTransientOverlays("queue");

    const imported = await Promise.all(batchFiles.map(async function (file, index) {
      let memory = fromFile(file, index);
      memory = await enrichMemoryWithFileMetadata(memory, file);
      memory = applyTakeoutSidecar(memory, file, sidecarForMediaFile(file, sidecarMap));
      memory.queueId = "queue-" + stableFileImportId(file);
      memory.uploadStatus = "queued";
      uploadFileRefs.current[memory.queueId] = { file: file, memory: memory };
      return memory;
    }));

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
    setImportPanelOpen(false);
    setStatusOpen(false);
    setPzUploadRefilterOpen(false);

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

async function handleUpload(eventOrFiles) {
  const incomingFiles = eventOrFiles && eventOrFiles.target && eventOrFiles.target.files
    ? Array.from(eventOrFiles.target.files)
    : Array.from(eventOrFiles || []);

  if (!incomingFiles.length) {
    setUploadNotice("NO FILE SELECTED");
    return;
  }

  const mediaIncomingFiles = incomingFiles.filter(isMediaUploadFile);
  const pending = mediaIncomingFiles.map(makePendingUploadMemory);
  setUploadPendingItems(function (items) { return pending.concat(items); });
  setUploadNotice(mediaIncomingFiles.length === 1 ? "UPLOADING 1 FILE" : "UPLOADING " + mediaIncomingFiles.length + " FILES");

  try {
    const result = await handleUploadOriginal(eventOrFiles);
    setUploadNotice(mediaIncomingFiles.length === 1 ? "UPLOAD COMPLETE" : "UPLOADS COMPLETE");
    window.setTimeout(function () {
      setUploadPendingItems(function (items) {
        const pendingIds = new Set(pending.map(function (item) { return item.id; }));
        return items.filter(function (item) { return !pendingIds.has(item.id); });
      });
      setUploadNotice("");
    }, 1200);
    return result;
  } catch (error) {
    setUploadPendingItems(function (items) {
      const pendingIds = new Set(pending.map(function (item) { return item.id; }));
      return items.filter(function (item) { return !pendingIds.has(item.id); });
    });
    setUploadNotice("UPLOAD FAILED");
    console.error("PHOTOZ upload failed", error);
    return null;
  } finally {
    if (eventOrFiles && eventOrFiles.target) eventOrFiles.target.value = "";
  }
}


  const archive = activePage === "albums";
  const starredIds = starMap(albums);
  const validation = validateIndex(memories, albums);
  const key = screen + "-" + (activeGroup ? activeGroup.id : "home");

  return unlocked ? (
    <div className={"app photozProUI page-" + activePage + (hasTransientOverlayOpen ? " has-open-overlay" : "")}>
      
        {uploadNotice && !hasTransientOverlayOpen ? <div className="uploadNoticeToast">{uploadNotice}</div> : null}
        {uploadPendingItems.length && !hasTransientOverlayOpen ? <div className="uploadPendingStrip">{uploadPendingItems.length} UPLOADING</div> : null}
<Dock active={activePage} setActive={navigatePage} />
      <main>
        <AnimatePresence mode="wait">
          <motion.div key={key} className="screen" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
            {screen === "home" ? (
              <Glass className={"shell grid-" + gridSize + (hasTransientOverlayOpen ? " has-panel-open" : "")}>
                <ControlBar activePage={activePage} currentAlbumId={currentAlbumId} archive={archive} archiveFilter={archiveFilter} setArchiveFilter={setArchiveFilterFromNav} count={memories.length} sync={sync} onUpload={handleUpload} selectionMode={selectionMode} toggleSelectionMode={toggleSelectionMode} filterControlsOpen={filterControlsOpen} toggleFilterControls={function () { toggleOverlay("filter", filterControlsOpen, setFilterControlsOpen); }} settingsOpen={settingsOpen} toggleSettingsPanel={function () { toggleOverlay("settings", settingsOpen, setSettingsOpen); }} albumSearchOpen={albumSearchOpen} setAlbumSearchOpen={setAlbumSearchExclusive} albumCreateOpen={albumCreateOpen} setAlbumCreateOpen={setAlbumCreateExclusive} />
                <div className="floatingUtilityCluster">
                  <span className="utilityFileCount" aria-label={safeArray(memories).length + " files"}>{safeArray(memories).length} FILES</span>
                  <div className="floatingUtilityRail" aria-label="Quick actions">
                    <AmbientMusicControl />
                    <button type="button" aria-label="Filter" data-tooltip="Filter" className={filterControlsOpen ? "utilityRailButton iconUtilityButton active" : "utilityRailButton iconUtilityButton"} onClick={function () { toggleOverlay("filter", filterControlsOpen, setFilterControlsOpen); }}><SlidersHorizontal size={14} strokeWidth={2.1} /></button>
                    <button type="button" aria-label="Settings" data-tooltip="Settings" className={settingsOpen ? "utilityRailButton cogUtilityButton iconUtilityButton active" : "utilityRailButton cogUtilityButton iconUtilityButton"} onClick={function () { toggleOverlay("settings", settingsOpen, setSettingsOpen); }}>⚙</button>
                  </div>
                </div>
                <FilterPanel open={filterControlsOpen} close={function () { setFilterControlsOpen(false); }} sortMode={sortMode} setSortMode={setSortMode} showAlbumSort={activePage === "albums" && archiveFilter === "albums"} albumSort={albumSort} setAlbumSort={setAlbumSort} gridSize={gridSize} setGridSize={setGridSize}
                showAlbumDateModes={activePage === "albums" && Boolean(currentAlbumId)} albumDateMode={archiveFilter} setAlbumDateMode={setArchiveFilterFromNav}
                searchFilter={searchFilter}
                setSearchFilter={setSearchFilter}
                filterType={filterType}
                setFilterType={setFilterType}
                filterSource={filterSource}
                setFilterSource={setFilterSource}
                filterQuality={filterQuality}
                setFilterQuality={setFilterQuality}
                viewDensity={viewDensity}
                setViewDensity={setViewDensity}/>
                <UndoBar snapshot={(settingsOpen || filterControlsOpen || importPanelOpen || uploadQueueOpen || statusOpen || duplicatesOpen || healthOpen || pzUploadRefilterOpen || albumSearchOpen || albumCreateOpen || bulkMoreOpen || advancedSearchOpen || activeMemory || pzAlbumEditorId || pzDetailEditorId || pzVideoPlayerId) ? null : undoSnapshot} undo={undoLastAction} clear={function () { setUndoSnapshot(null); }} />
                <SettingsPanel onUpload={handleUpload} open={settingsOpen} close={function () { setSettingsOpen(false); }} toggleImportPanel={function () { closeTransientOverlays("import"); setImportPanelOpen(true); }} toggleUploadQueuePanel={function () { closeTransientOverlays("queue"); setUploadQueueOpen(true); }} toggleStatusPanel={function () { closeTransientOverlays("status"); setStatusOpen(true); }} toggleDuplicatePanel={function () { closeTransientOverlays("duplicates"); setDuplicatesOpen(true); }} toggleHealthPanel={function () { closeTransientOverlays("health"); setHealthOpen(true); }} exportVaultIndex={exportVaultIndex} exportManifestCsv={exportManifestCsv} importVaultIndex={importVaultIndex} 
                toggleUploadRefilterPanel={function () { closeTransientOverlays("uploadRefilter"); setPzUploadRefilterOpen(true); }}/>
                <ImportPanel open={importPanelOpen} close={function () { setImportPanelOpen(false); }} uploadBatchSize={uploadBatchSize} setUploadBatchSize={setUploadBatchSize} uploadConcurrency={uploadConcurrency} setUploadConcurrency={setUploadConcurrency} skipDuplicates={skipDuplicates} setSkipDuplicates={setSkipDuplicates} importSummary={importSummary} />
                <UploadQueuePanel open={uploadQueueOpen} queue={uploadQueue} paused={uploadPaused} togglePause={function () { setUploadPaused(function (value) { return !value; }); }} retryFailed={retryFailedUploads} close={function () { setUploadQueueOpen(false); }} clearFinished={function () { setUploadQueue(function (items) { return items.filter(function (item) { return item.status === "queued" || item.status === "uploading"; }); }); }} />
                <StatusPanel open={statusOpen} memories={uploadPendingItems.concat(safeArray(memories))} close={function () { setStatusOpen(false); }} retryUpload={retryUpload} clearLocalFailedStatus={clearLocalFailedStatus} purgeTrash={purgeTrash} />
                <DuplicatePanel open={duplicatesOpen} memories={uploadPendingItems.concat(safeArray(memories))} close={function () { setDuplicatesOpen(false); }} openMemory={openMemoryDetail} trashDuplicateOthers={trashDuplicateOthers} />
                <HealthPanel open={healthOpen} health={health} healthError={healthError} validation={validation} missingReport={missingReport} fileAuditReport={fileAuditReport} close={function () { setHealthOpen(false); }} runHealthCheck={runHealthCheck} runRouteCheck={runRouteCheck} runMissingCheck={runMissingCheck} runFileAudit={runFileAudit} repairFilesAndReload={repairFilesAndReload} repairIndex={repairIndex} />
                <BulkBar selectionMode={selectionMode} selectedIds={selectedIds} albums={albums} currentAlbumId={currentAlbumId} bulkAlbum={bulkAlbum} setBulkAlbum={setBulkAlbum} bulkText={bulkText} setBulkText={setBulkText} bulkMoreOpen={bulkMoreOpen} toggleBulkMore={function () { toggleOverlay("bulk", bulkMoreOpen, setBulkMoreOpen); }} selectAll={selectAll} selectVisible={selectVisible} invertSelection={invertSelection} bulkAddToAlbum={bulkAddToAlbum} bulkMoveToAlbum={bulkMoveToAlbum} bulkRemoveFromCurrentAlbum={bulkRemoveFromCurrentAlbum} bulkStar={bulkStar} bulkUnstar={bulkUnstar} bulkMarkMe={bulkMarkMe} bulkUnmarkMe={bulkUnmarkMe} bulkApplyTags={bulkApplyTags} bulkClearTags={bulkClearTags} bulkSetEra={bulkSetEra} bulkSetCaption={bulkSetCaption} bulkSetLocation={bulkSetLocation} bulkSetEvent={bulkSetEvent} bulkClearTextFields={bulkClearTextFields} bulkSetRating={bulkSetRating} bulkClearRating={bulkClearRating} bulkSetLabel={bulkSetLabel} bulkClearLabel={bulkClearLabel} bulkMarkRefilter={bulkMarkRefilter} bulkClearRefilter={bulkClearRefilter} bulkMarkPrivate={bulkMarkPrivate} bulkClearPrivate={bulkClearPrivate} bulkMoveToMirror={bulkMoveToMirror} bulkRemoveFromMirror={bulkRemoveFromMirror} bulkArchive={bulkArchive} bulkUnarchive={bulkUnarchive} bulkRestore={bulkRestore} exportSelectedJson={exportSelectedJson} bulkDelete={bulkDelete} clearSelection={clearSelection} />
                {activePage === "albums" ? <AlbumsFilter currentAlbumId={currentAlbumId} setCurrentAlbumId={setCurrentAlbumId} toggleAlbumExcludeFromAll={toggleAlbumExcludeFromAll} albumSearchOpen={albumSearchOpen} setAlbumSearchOpen={setAlbumSearchExclusive} albumCreateOpen={albumCreateOpen} setAlbumCreateOpen={setAlbumCreateExclusive} archiveFilter={archiveFilter} memories={uploadPendingItems.concat(safeArray(memories))} albums={albums} albumQuery={albumQuery} setAlbumQuery={setAlbumQuery} albumSort={albumSort} draft={draft} setDraft={setDraft} createAlbum={createAlbum} deleteAlbum={deleteAlbum} toggleAlbumPin={toggleAlbumPin} toggleAlbumLock={toggleAlbumLock} editingId={editingId} editDraft={editDraft} setEditDraft={setEditDraft} editDescriptionDraft={editDescriptionDraft} setEditDescriptionDraft={setEditDescriptionDraft} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit} openGroup={openGroup} openMemory={openMemoryDetail} deleteMemory={deleteMemory} selectionMode={selectionMode} selectedIds={selectedIds} toggleSelected={toggleSelected} starredIds={starredIds} reportVisibleIds={setVisibleIds} setSelectionMode={setSelectionMode} onEditMemory={function (memory) { closeTransientOverlays("detailEditor"); setPzDetailEditorId(memory.id); }} onPlayVideo={function (memory) { closeTransientOverlays("videoPlayer"); setPzVideoPlayerId(memory.id); }} onEditAlbum={function (group) { closeTransientOverlays("albumEditor"); setPzAlbumEditorId(group.id || group.sourceId); }} /> : null}
                {activePage === "mirror" ? <MirrorFilter mirrorAllMode={mirrorAllMode} setMirrorAllMode={setMirrorAllMode} memories={uploadPendingItems.concat(safeArray(memories))} albums={albums} openGroup={openGroup} openMemory={openMemoryDetail} deleteMemory={deleteMemory} selectionMode={selectionMode} selectedIds={selectedIds} toggleSelected={toggleSelected} setSelectionMode={setSelectionMode} sortMode={sortMode} starredIds={starredIds} reportVisibleIds={setVisibleIds} /> : null}
                {activePage === "search" ? <SearchFilter memories={uploadPendingItems.concat(safeArray(memories))} albums={albums} query={query} setQuery={setQuery} filter={searchFilter} setFilter={setSearchFilter} fromDate={searchFromDate} setFromDate={setSearchFromDate} toDate={searchToDate} setToDate={setSearchToDate} minRating={searchMinRating} setMinRating={setSearchMinRating} advancedSearchOpen={advancedSearchOpen} setAdvancedSearchOpen={function (nextValue) { const next = typeof nextValue === "function" ? nextValue(advancedSearchOpen) : nextValue; if (next) closeTransientOverlays("searchFilter"); setAdvancedSearchOpen(Boolean(next)); }} openMemory={openMemoryDetail} deleteMemory={deleteMemory} selectionMode={selectionMode} selectedIds={selectedIds} toggleSelected={toggleSelected} setSelectionMode={setSelectionMode} sortMode={sortMode} starredIds={starredIds} reportVisibleIds={setVisibleIds} onEditMemory={function (memory) { closeTransientOverlays("detailEditor"); setPzDetailEditorId(memory.id); }} onPlayVideo={function (memory) { closeTransientOverlays("videoPlayer"); setPzVideoPlayerId(memory.id); }} /> : null}
              </Glass>
            ) : null}
            {screen === "group" && activeGroup ? <GroupFilter group={activeGroup} back={goHome} openMemory={openMemoryDetail} deleteMemory={deleteMemory} selectionMode={selectionMode} selectedIds={selectedIds} toggleSelected={toggleSelected} setSelectionMode={setSelectionMode} sortMode={sortMode} starredIds={starredIds} reportVisibleIds={setVisibleIds} onEditMemory={function (memory) { closeTransientOverlays("detailEditor"); setPzDetailEditorId(memory.id); }} onPlayVideo={function (memory) { closeTransientOverlays("videoPlayer"); setPzVideoPlayerId(memory.id); }} /> : null}
          </motion.div>
        </AnimatePresence>
      </main>
      <Modal memory={activeMemory} close={function () { setActiveMemory(null); }} deleteMemory={deleteMemory} permanentDeleteMemory={permanentDeleteMemory} restoreMemory={restoreMemory} toggleMeFlag={toggleMeFlag} toggleMirror={toggleMirror} toggleArchive={toggleArchive} toggleRefilter={toggleRefilter} togglePrivate={togglePrivate} albums={albums} addToAlbum={addToAlbum} moveToAlbum={moveToAlbum} removeFromAlbum={removeFromAlbum} updateMemoryDetails={updateMemoryDetails} downloadOriginal={downloadOriginal} openOriginal={openOriginal} copyMediaUrl={copyMediaUrl} copyStorageKey={copyStorageKey} toggleStar={toggleStar} isStarred={activeMemory ? isStarredMemory(activeMemory, albums) : false} setAlbumCover={setAlbumCover} clearAlbumCover={clearAlbumCover} />
      <PzToastStack items={pzToasts} />
      <PzAlbumEditorPanel
        open={Boolean(pzActiveAlbumEditor)}
        album={pzActiveAlbumEditor}
        albums={albums}
        onClose={function () { setPzAlbumEditorId(null); }}
        onSave={pzSaveAlbumEditor}
        onDelete={pzDeleteAlbum}
        onSetCover={pzSetAlbumCover}
      />
      <PzFileDetailEditor
        open={Boolean(pzActiveDetailMemory)}
        memory={pzActiveDetailMemory}
        onClose={function () { setPzDetailEditorId(null); }}
        onSave={pzSaveMemoryDetail}
        onTrash={pzTrashMemory}
        onPermanentDelete={permanentDeleteMemory}
        onRestore={pzRestoreMemory}
        onDownload={pzDownloadMemory}
      />
      <PzVideoPlaybackModal
        open={Boolean(pzActiveVideoMemory)}
        memory={pzActiveVideoMemory}
        onClose={function () { setPzVideoPlayerId(null); }}
        onEdit={function (memory) { closeTransientOverlays("detailEditor"); setPzDetailEditorId(memory.id); }}
        onDownload={pzDownloadMemory}
      />
      <PzUploadRefilterPanel
        open={pzUploadRefilterOpen}
        queue={pzUploadQueue}
        onRetryFailed={pzRetryFailedUploads}
        onClearComplete={pzClearCompleteUploads}
        onClose={function () { setPzUploadRefilterOpen(false); }}
      />
      <DeleteConfirmModal
        open={Boolean(deleteConfirmRequest)}
        request={deleteConfirmRequest}
        onCancel={function () { setDeleteConfirmRequest(null); }}
        onConfirm={runDeleteConfirm}
      />

    </div>
  ) : <PasswordGate onUnlock={function () { setUnlocked(true); }} />;
}
