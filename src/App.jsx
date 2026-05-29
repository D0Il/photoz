
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

const ARCHIVE_VIEWS = ["folders", "years", "months", "eras"];
const R2_BASE = "https://ede1e7633dd439375ff7a143c1c9b512.r2.cloudflarestorage.com/photoz";
const MAX_PARALLEL_UPLOADS = 3;

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
    storageBase: R2_BASE,
    storageKey: key,
    storageUrl: R2_BASE + "/" + key,
    uploadStatus: "queued",
    metadata: fileMeta(file, modified),
    detectedFaces: [],
    mirrorFavorite: false,
  };
}

function hasFace(memory, personId) {
  return (memory.detectedFaces || []).some(function (face) {
    return face.personId === personId && face.confidence >= 0.9;
  });
}

function mirrorItems(memories) {
  return newest(memories.filter(function (memory) {
    return hasFace(memory, "self");
  }));
}

function mirrorFavorites(memories) {
  return mirrorItems(memories).filter(function (memory) {
    return memory.mirrorFavorite;
  });
}

function pageItems(page, memories) {
  return page === "mirror" ? mirrorItems(memories) : newest(memories);
}

function groupBy(mode, items) {
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

function albumGroups(albums, memories) {
  return newest(albums.map(function (album) {
    const items = newest(album.memoryIds.map(function (id) {
      return memories.find(function (memory) {
        return memory.id === id;
      });
    }).filter(Boolean));

    return {
      id: "album-" + album.id,
      sourceId: album.id,
      title: album.title,
      items,
      sort: items[0] ? items[0].sort : 0,
    };
  }));
}

function ensureCoreAlbums(albums) {
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

function memoryHasHomeAlbum(memoryId, albums) {
  return albums.some(function (album) {
    if (album.id === "star") return false;
    return (album.memoryIds || []).indexOf(memoryId) !== -1;
  });
}

function ensureAlbumCoverage(memories, albums) {
  const cleanAlbums = ensureCoreAlbums(albums).map(function (album) {
    return { ...album, memoryIds: Array.from(new Set(album.memoryIds || [])) };
  });

  const unassigned = cleanAlbums.find(function (album) {
    return album.id === UNASSIGNED_ALBUM_ID;
  });

  memories.forEach(function (memory) {
    if (!memoryHasHomeAlbum(memory.id, cleanAlbums)) {
      unassigned.memoryIds.push(memory.id);
    }
  });

  unassigned.memoryIds = Array.from(new Set(unassigned.memoryIds));
  return cleanAlbums;
}

function removeMemoryFromAlbum(albums, albumId, memoryId) {
  return albums.map(function (album) {
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


function searchMemories(memories, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return newest(memories.filter(function (memory) {
    return [
      memory.title,
      memory.date,
      memory.year,
      memory.month,
      memory.era,
      memory.kind,
      memory.fileName,
      memory.storageKey,
    ].join(" ").toLowerCase().indexOf(needle) !== -1;
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

function cleanIndex(index) {
  const memories = Array.isArray(index.memories) ? index.memories : [];
  const albums = Array.isArray(index.albums) && index.albums.length ? index.albums : INITIAL_ALBUMS;
  return {
    version: 1,
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

function PhotoCard(props) {
  const memory = props.memory;
  return (
    <motion.button
      type="button"
      className={cls("photoCard", props.large && "large", props.className)}
      onClick={props.onClick}
      whileHover={props.onClick ? { y: -3, scale: 1.01 } : undefined}
      whileTap={props.onClick ? { scale: 0.98 } : undefined}
    >
      {memory.previewUrl || memory.storageUrl ? (
        <img src={memory.previewUrl || memory.storageUrl} alt="" />
      ) : null}
      <div className="photoOverlay" />
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

function ControlBar(props) {
  return (
    <div className="controlBar">
      <div className="leftControls">
        <div className="brandMark">PHOTOZ</div>
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
                  {up(view)}
                </button>
              );
            })}
          </div>
        ) : null}
        <Pill>{props.count}</Pill>
        <Pill>{up(props.sync)}</Pill>
      </div>
      <div className="rightControls">
        <UploadButton onUpload={props.onUpload} />
        <UploadButton onUpload={props.onUpload} folder />
      </div>
    </div>
  );
}

function GroupCard(props) {
  const group = props.group;
  return (
    <button type="button" className="groupCard" onClick={function () { props.openGroup(group); }}>
      <div className="groupGrid">
        {group.items.slice(0, 6).map(function (memory, index) {
          return (
            <PhotoCard
              key={memory.id}
              memory={memory}
              className={index === 0 ? "featured" : ""}
              onClick={function (event) {
                event.stopPropagation();
                props.openMemory(memory);
              }}
            />
          );
        })}
      </div>
      <div className="groupTitle">
        <strong>{up(group.title)}</strong>
        <span>{group.items.length}</span>
      </div>
    </button>
  );
}

function MirrorView(props) {
  const all = mirrorItems(props.memories);
  const favorites = mirrorFavorites(props.memories);
  const allGroup = { id: "mirror-all", title: "ALL", items: all, sort: all[0] ? all[0].sort : 0 };

  return (
    <div className="pageScroll">
      <div className="mirrorControl">
        <button type="button" onClick={function () { props.openGroup(allGroup); }}>
          <Eye size={20} />
          <span>ALL</span>
          <b>{all.length}</b>
          <em>›</em>
        </button>
      </div>
      <div className="photoGrid">
        {favorites.map(function (memory) {
          return <PhotoCard key={memory.id} memory={memory} showText onClick={function () { props.openMemory(memory); }} />;
        })}
      </div>
    </div>
  );
}

function AlbumsView(props) {
  const folders = albumGroups(props.albums, props.memories);
  const archiveGroups = props.archiveView === "folders" ? folders : groupBy(props.archiveView, props.memories);
  const isFolders = props.archiveView === "folders";

  return (
    <div className="pageScroll">
      {isFolders ? (
        <div className="albumEditor">
          <Pill>{props.albums.length}</Pill>
          <input
            value={props.draft}
            onChange={function (event) { props.setDraft(event.target.value); }}
            placeholder="NEW ALBUM"
          />
          <button type="button" onClick={props.createAlbum}>CREATE</button>
        </div>
      ) : null}

      <div className="archiveLabel">{up(props.archiveView)}</div>
      <div className={isFolders ? "albumGrid folderView" : props.archiveView === "months" ? "albumGrid filterView" : "timelineStack filterView"}>
        {archiveGroups.map(function (group) {
          const editing = isFolders && props.editingId === group.sourceId;
          if (!isFolders) {
            return <GroupCard key={group.id} group={group} openGroup={props.openGroup} openMemory={props.openMemory} />;
          }

          return (
            <div className="albumTile" key={group.id}>
              <div className="tileActions">
                <button type="button" onClick={function () { props.startEdit(group.sourceId, group.title); }}>EDIT</button>
                {group.sourceId !== UNASSIGNED_ALBUM_ID ? <button type="button" onClick={function () { props.deleteAlbum(group.sourceId); }}><X size={14} /></button> : null}
              </div>
              {editing ? (
                <Glass className="editPanel">
                  <input value={props.editDraft} onChange={function (event) { props.setEditDraft(event.target.value); }} />
                  <div>
                    <button type="button" onClick={props.saveEdit}>SAVE</button>
                    <button type="button" onClick={props.cancelEdit}>CANCEL</button>
                  </div>
                </Glass>
              ) : (
                <GroupCard group={group} openGroup={props.openGroup} openMemory={props.openMemory} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SearchView(props) {
  const results = searchMemories(props.memories, props.query);
  return (
    <div className="pageScroll">
      <div className="searchBar">
        <Pill>{results.length}</Pill>
        <Search size={17} />
        <input
          value={props.query}
          onChange={function (event) { props.setQuery(event.target.value); }}
          placeholder="SEARCH"
        />
        {props.query ? <button type="button" onClick={function () { props.setQuery(""); }}>CLEAR</button> : null}
      </div>
      <div className="photoGrid">
        {results.map(function (memory) {
          return <PhotoCard key={memory.id} memory={memory} showText onClick={function () { props.openMemory(memory); }} />;
        })}
      </div>
    </div>
  );
}

function GroupView(props) {
  return (
    <Glass className="groupView">
      <div className="groupTop">
        <button type="button" onClick={props.back}><ChevronLeft size={16} /> BACK</button>
        <Pill>{props.group.items.length}</Pill>
      </div>
      <h1>{up(props.group.title)}</h1>
      <div className="photoGrid">
        {props.group.items.map(function (memory) {
          return <PhotoCard key={memory.id} memory={memory} showText onClick={function () { props.openMemory(memory); }} />;
        })}
      </div>
    </Glass>
  );
}

function Modal(props) {
  if (!props.memory) return null;
  return (
    <AnimatePresence>
      <motion.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={props.close}>
        <motion.div className="modalCard" initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} onClick={function (event) { event.stopPropagation(); }}>
          <div className="modalTop">
            <div>
              <h2>{up(props.memory.title)}</h2>
              <p>{props.memory.fileName}</p>
            </div>
            <button type="button" onClick={props.close}><X size={18} /></button>
          </div>
          <PhotoCard memory={props.memory} className="modalPhoto" />
          <pre>{JSON.stringify(props.memory.metadata || {}, null, 2)}</pre>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const [archiveView, setArchiveView] = useState("folders");
  const [activePage, setActivePage] = useState("albums");
  const [screen, setScreen] = useState("home");
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeMemory, setActiveMemory] = useState(null);
  const [memories, setMemories] = useState([]);
  const [albums, setAlbums] = useState(ensureCoreAlbums(INITIAL_ALBUMS));
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [query, setQuery] = useState("");
  const [sync, setSync] = useState("loading");
  const saving = useRef(false);

  useEffect(function () {
    let alive = true;
    loadIndex().then(function (index) {
      if (!alive) return;
      setMemories(index.memories);
      setAlbums(ensureAlbumCoverage(index.memories, index.albums));
      setSync("saved");
    }).catch(function () {
      if (alive) setSync("local");
    });
    return function () { alive = false; };
  }, []);

  function persist(nextMemories, nextAlbums) {
    if (saving.current) return;
    saving.current = true;
    setSync("saving");
    saveIndex(nextMemories, nextAlbums).then(function (ok) {
      setSync(ok ? "saved" : "local");
      saving.current = false;
    });
  }

  function openGroup(group) {
    setActiveGroup(group);
    setScreen("group");
  }

  function goHome() {
    setScreen("home");
    setActiveGroup(null);
  }

  function createAlbum() {
    const name = draft.trim();
    if (!name) return;
    const next = ensureAlbumCoverage(memories, albums.concat([{ id: "custom-" + safeName(name.toLowerCase()) + "-" + Date.now(), title: name, memoryIds: [] }]));
    setAlbums(next);
    setDraft("");
    persist(memories, next);
  }

  function deleteAlbum(id) {
    if (id === UNASSIGNED_ALBUM_ID) return;
    const next = ensureAlbumCoverage(memories, removeAlbum(albums, id));
    setAlbums(next);
    if (editingId === id) {
      setEditingId(null);
      setEditDraft("");
    }
    persist(memories, next);
  }

  function startEdit(id, title) {
    setEditingId(id);
    setEditDraft(title);
  }

  function saveEdit() {
    if (!editingId) return;
    const next = ensureAlbumCoverage(memories, renameAlbum(albums, editingId, editDraft));
    setAlbums(next);
    setEditingId(null);
    setEditDraft("");
    persist(memories, next);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
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

          uploadOne(memory, file)
            .then(function (ok) {
              memory.uploadStatus = ok ? "r2" : "failed";
            })
            .catch(function () {
              memory.uploadStatus = "failed";
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

  function handleUpload(event) {
    const files = Array.prototype.slice.call(event.target.files || []).filter(function (file) {
      return file.type && (file.type.indexOf("image") === 0 || file.type.indexOf("video") === 0);
    });

    const signatures = {};
    memories.forEach(function (memory) {
      if (memory.metadata && memory.metadata.signature) signatures[memory.metadata.signature] = true;
    });

    const freshFiles = files.filter(function (file) {
      return !signatures[fileSignature(file)];
    });

    const imported = freshFiles.map(fromFile);
    const nextMemories = newest(memories.concat(imported));
    const videoIds = imported.filter(function (memory) {
      return memory.kind === "video";
    }).map(function (memory) {
      return memory.id;
    });

    const photoIds = imported.filter(function (memory) {
      return memory.kind !== "video";
    }).map(function (memory) {
      return memory.id;
    });

    let nextAlbums = albums.map(function (album) {
      if (album.id === "videos") return { ...album, memoryIds: Array.from(new Set(album.memoryIds.concat(videoIds))) };
      if (album.id === UNASSIGNED_ALBUM_ID) return { ...album, memoryIds: Array.from(new Set(album.memoryIds.concat(photoIds))) };
      return album;
    });
    nextAlbums = ensureAlbumCoverage(nextMemories, nextAlbums);

    setMemories(nextMemories);
    setAlbums(nextAlbums);
    setSync("uploading");
    runQueue(imported, freshFiles, nextAlbums);
    event.target.value = "";
  }

  const archive = activePage === "albums";
  const key = screen + "-" + activePage + "-" + archiveView + "-" + (activeGroup ? activeGroup.id : "");

  return (
    <div className="app">
      <Dock active={activePage} setActive={setActivePage} />
      <main>
        <AnimatePresence mode="wait">
          <motion.div key={key} className="screen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {screen === "home" ? (
              <Glass className="shell">
                <ControlBar archive={archive} archiveView={archiveView} setArchiveView={setArchiveView} count={memories.length} sync={sync} onUpload={handleUpload} />
                {activePage === "mirror" ? <MirrorView memories={memories} openGroup={openGroup} openMemory={setActiveMemory} /> : null}
                {activePage === "albums" ? <AlbumsView archiveView={archiveView} memories={memories} albums={albums} draft={draft} setDraft={setDraft} createAlbum={createAlbum} deleteAlbum={deleteAlbum} editingId={editingId} editDraft={editDraft} setEditDraft={setEditDraft} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={cancelEdit} openGroup={openGroup} openMemory={setActiveMemory} /> : null}
                {activePage === "search" ? <SearchView memories={memories} query={query} setQuery={setQuery} openMemory={setActiveMemory} /> : null}
              </Glass>
            ) : null}
            {screen === "group" && activeGroup ? <GroupView group={activeGroup} back={goHome} openMemory={setActiveMemory} /> : null}
          </motion.div>
        </AnimatePresence>
      </main>
      <Modal memory={activeMemory} close={function () { setActiveMemory(null); }} />
    </div>
  );
}
