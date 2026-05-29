import React from "react";

export function PhotozAlbumDockIcon(props) {
  const size = props.size || 23;
  return (
    <span className="photozDockIcon photozDockBook" aria-hidden="true" style={{ width: size, height: size }}>
      <svg viewBox="0 0 28 28" focusable="false">
        <path className="bookCover" d="M4.8 7.3c3.25-.52 6.1.16 9.2 2.02v12.9c-3-1.72-6-2.25-9.2-1.55V7.3Z" />
        <path className="bookCover" d="M23.2 7.3c-3.25-.52-6.1.16-9.2 2.02v12.9c3-1.72 6-2.25 9.2-1.55V7.3Z" />
        <path className="bookPage" d="M14 9.45c2.35-1.24 4.58-1.78 6.75-1.55v11.12c-2.08-.23-4.35.31-6.75 1.66V9.45Z" />
        <path className="bookLine" d="M14 9.4v13" />
        <path className="bookLine" d="M7.25 11.45c1.5-.12 2.95.12 4.45.76" />
        <path className="bookLine" d="M16.3 12.2c1.55-.66 3-.92 4.45-.75" />
      </svg>
    </span>
  );
}

export function PhotozMirrorDockIcon(props) {
  const size = props.size || 23;
  return (
    <span className="photozDockIcon photozDockEye" aria-hidden="true" style={{ width: size, height: size }}>
      <svg viewBox="0 0 28 28" focusable="false">
        <path className="eyeTop" d="M4.3 14c2.45-4.15 5.65-6.04 9.7-6.04S21.25 9.85 23.7 14" />
        <path className="eyeBottom" d="M4.3 14c2.45 4.15 5.65 6.04 9.7 6.04s7.25-1.89 9.7-6.04" />
        <path className="lash" d="M8.25 9.35 6.85 7.25" />
        <path className="lash" d="M11.2 8.16 10.7 5.9" />
        <path className="lash" d="M14 7.86V5.45" />
        <path className="lash" d="M16.8 8.16l.5-2.26" />
        <path className="lash" d="M19.75 9.35l1.4-2.1" />
        <circle className="iris" cx="14" cy="14" r="2.55" />
      </svg>
    </span>
  );
}

export function PhotozSearchDockIcon(props) {
  const size = props.size || 23;
  return (
    <span className="photozDockIcon photozDockSearch" aria-hidden="true" style={{ width: size, height: size }}>
      <svg viewBox="0 0 28 28" focusable="false">
        <circle className="lens" cx="12.2" cy="12.2" r="6.25" />
        <path className="handle" d="M16.9 16.9 22.4 22.4" />
        <path className="spark big" d="M21.25 4.45l.68 1.95 1.95.68-1.95.68-.68 1.95-.68-1.95-1.95-.68 1.95-.68.68-1.95Z" />
        <path className="spark small" d="M6.2 4.35l.45 1.22 1.22.45-1.22.45L6.2 7.7l-.45-1.23-1.22-.45 1.22-.45.45-1.22Z" />
      </svg>
    </span>
  );
}
