import React from "react";

export function PhotozAlbumDockIcon(props) {
  const size = props.size || 23;
  return (
    <svg className="photozDockIcon photozDockBook" aria-hidden="true" viewBox="0 0 28 28" focusable="false" width={size} height={size}>
      <path className="bookCover left" d="M4.8 7.3c3.25-.52 6.1.16 9.2 2.02v12.9c-3-1.72-6-2.25-9.2-1.55V7.3Z" />
      <path className="bookCover right" d="M23.2 7.3c-3.25-.52-6.1.16-9.2 2.02v12.9c3-1.72 6-2.25 9.2-1.55V7.3Z" />
      <path className="bookPage" d="M14 9.45c2.35-1.24 4.58-1.78 6.75-1.55v11.12c-2.08-.23-4.35.31-6.75 1.66V9.45Z" />
      <path className="bookFlipPage" d="M14 9.55c1.88-.88 3.6-1.24 5.18-1.08v10.02c-1.56-.08-3.3.36-5.18 1.34V9.55Z" />
      <path className="bookLine spine" d="M14 9.4v13" />
      <path className="bookLine leftLine" d="M7.25 11.45c1.5-.12 2.95.12 4.45.76" />
      <path className="bookLine rightLine" d="M16.3 12.2c1.55-.66 3-.92 4.45-.75" />
    </svg>
  );
}

export function PhotozMirrorDockIcon(props) {
  const size = props.size || 23;
  return (
    <svg className="photozDockIcon photozDockEye" aria-hidden="true" viewBox="0 0 28 28" focusable="false" width={size} height={size}>
      <path className="eyeTop" d="M4.3 14c2.45-4.15 5.65-6.04 9.7-6.04S21.25 9.85 23.7 14" />
      <path className="eyeBottom" d="M4.3 14c2.45 4.15 5.65 6.04 9.7 6.04s7.25-1.89 9.7-6.04" />
      <path className="lash" d="M8.25 9.35 6.85 7.25" />
      <path className="lash" d="M11.2 8.16 10.7 5.9" />
      <path className="lash" d="M14 7.86V5.45" />
      <path className="lash" d="M16.8 8.16l.5-2.26" />
      <path className="lash" d="M19.75 9.35l1.4-2.1" />
      <circle className="iris" cx="14" cy="14" r="2.55" />
      <circle className="pupilGlint" cx="15.05" cy="13.05" r=".55" />
    </svg>
  );
}

export function PhotozSearchDockIcon(props) {
  const size = props.size || 23;
  return (
    <svg className="photozDockIcon photozDockSearch" aria-hidden="true" viewBox="0 0 28 28" focusable="false" width={size} height={size}>
      <circle className="lens" cx="12.2" cy="12.2" r="6.25" />
      <path className="handle" d="M16.9 16.9 22.4 22.4" />
      <path className="spark big" d="M21.25 4.45l.68 1.95 1.95.68-1.95.68-.68 1.95-.68-1.95-1.95-.68 1.95-.68.68-1.95Z" />
      <path className="spark small" d="M6.2 4.35l.45 1.22 1.22.45-1.22.45L6.2 7.7l-.45-1.23-1.22-.45 1.22-.45.45-1.22Z" />
    </svg>
  );
}

export const AnimatedBookDockIcon = PhotozAlbumDockIcon;
export const LashEyeIcon = PhotozMirrorDockIcon;
export const SparkSearchDockIcon = PhotozSearchDockIcon;
export const DockAlbumGlyph = PhotozAlbumDockIcon;
export const DockMirrorGlyph = PhotozMirrorDockIcon;
export const DockSearchGlyph = PhotozSearchDockIcon;
