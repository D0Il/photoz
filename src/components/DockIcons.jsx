import React from "react";

export function PhotozAlbumDockIcon(props) {
  const size = props.size || 28;
  return (
    <svg className="photozDockIcon photozDockBook" aria-hidden="true" viewBox="0 0 32 32" focusable="false" width={size} height={size}>
      <path className="bookShadow" d="M5.2 23.3c3.8-.82 7.1-.12 10.8 2.1 3.7-2.22 7-2.92 10.8-2.1" />
      <path className="bookCover left" d="M5.3 7.8c3.8-.68 7.1.15 10.7 2.48v14.18c-3.45-2.08-7.04-2.72-10.7-1.84V7.8Z" />
      <path className="bookCover right" d="M26.7 7.8c-3.8-.68-7.1.15-10.7 2.48v14.18c3.45-2.08 7.04-2.72 10.7-1.84V7.8Z" />
      <path className="bookPage leftPage" d="M7.65 10.15c2.65-.18 5.02.38 7.14 1.66" />
      <path className="bookPage leftPage" d="M7.65 13.25c2.28-.14 4.55.36 6.82 1.48" />
      <path className="bookPage rightPage" d="M17.22 11.8c2.35-1.18 4.72-1.74 7.13-1.65" />
      <path className="bookPage rightPage" d="M17.52 14.74c2.14-1.05 4.42-1.55 6.83-1.49" />
      <path className="bookFlipPage" d="M16 10.44c2.02-1.04 3.86-1.44 5.53-1.22v12.02c-1.7-.1-3.55.44-5.53 1.62V10.44Z" />
      <path className="bookSpine" d="M16 10.15v14.88" />
    </svg>
  );
}

export function PhotozMirrorDockIcon(props) {
  const size = props.size || 28;
  return (
    <svg className="photozDockIcon photozDockEye" aria-hidden="true" viewBox="0 0 32 32" focusable="false" width={size} height={size}>
      <path className="lash" d="M7.85 11.1 6.25 8.75" />
      <path className="lash" d="M11.3 9.55 10.65 6.95" />
      <path className="lash" d="M16 9.1V6.2" />
      <path className="lash" d="M20.7 9.55l.65-2.6" />
      <path className="lash" d="M24.15 11.1l1.6-2.35" />
      <path className="eyeTop" d="M4.85 16c2.78-4.82 6.48-7.04 11.15-7.04S24.37 11.18 27.15 16" />
      <path className="eyeBottom" d="M4.85 16c2.78 4.82 6.48 7.04 11.15 7.04S24.37 20.82 27.15 16" />
      <circle className="irisRing" cx="16" cy="16" r="4.2" />
      <circle className="iris" cx="16" cy="16" r="2.55" />
      <circle className="pupilGlint" cx="17.15" cy="14.65" r=".68" />
    </svg>
  );
}

export function PhotozSearchDockIcon(props) {
  const size = props.size || 28;
  return (
    <svg className="photozDockIcon photozDockSearch" aria-hidden="true" viewBox="0 0 32 32" focusable="false" width={size} height={size}>
      <circle className="lensOuter" cx="14" cy="14" r="7.25" />
      <circle className="lensInner" cx="14" cy="14" r="4.45" />
      <path className="handle" d="M19.65 19.65 26.1 26.1" />
      <path className="spark big" d="M24.08 4.45l.76 2.18 2.18.76-2.18.76-.76 2.18-.76-2.18-2.18-.76 2.18-.76.76-2.18Z" />
      <path className="spark small" d="M7.42 5.05l.5 1.38 1.38.5-1.38.5-.5 1.38-.5-1.38-1.38-.5 1.38-.5.5-1.38Z" />
    </svg>
  );
}

export const AnimatedBookDockIcon = PhotozAlbumDockIcon;
export const LashEyeIcon = PhotozMirrorDockIcon;
export const SparkSearchDockIcon = PhotozSearchDockIcon;
export const DockAlbumGlyph = PhotozAlbumDockIcon;
export const DockMirrorGlyph = PhotozMirrorDockIcon;
export const DockSearchGlyph = PhotozSearchDockIcon;
