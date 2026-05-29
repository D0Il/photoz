import React from "react";

export function PhotozAlbumDockIcon(props) {
  const size = props.size || 30;
  return (
    <svg className="photozDockIcon photozDockBook" aria-hidden="true" viewBox="0 0 32 32" focusable="false" width={size} height={size}>
      <path className="bookShadow" d="M5.2 23.35c3.78-.82 7.2-.08 10.8 2.08 3.6-2.16 7.02-2.9 10.8-2.08" />
      <path className="bookCover left" d="M5.4 8.05c3.85-.76 7.24.08 10.6 2.32v14.1c-3.34-2.04-6.9-2.62-10.6-1.76V8.05Z" />
      <path className="bookCover right" d="M26.6 8.05c-3.85-.76-7.24.08-10.6 2.32v14.1c3.34-2.04 6.9-2.62 10.6-1.76V8.05Z" />
      <path className="bookPageLayer layerOne" d="M7.7 10.75c2.5-.2 4.82.3 6.95 1.52" />
      <path className="bookPageLayer layerTwo" d="M7.7 13.85c2.25-.17 4.48.32 6.7 1.46" />
      <path className="bookPageLayer layerThree" d="M17.35 12.25c2.22-1.16 4.54-1.66 6.95-1.5" />
      <path className="bookPageLayer layerFour" d="M17.62 15.18c2.02-1.03 4.25-1.48 6.68-1.36" />
      <path className="bookSpine" d="M16 10.2v14.85" />
    </svg>
  );
}

export function PhotozMirrorDockIcon(props) {
  const size = props.size || 30;
  return (
    <svg className="photozDockIcon photozDockEye" aria-hidden="true" viewBox="0 0 32 32" focusable="false" width={size} height={size}>
      <path className="lash" d="M7.85 11.1 6.25 8.75" />
      <path className="lash" d="M11.3 9.55 10.65 6.95" />
      <path className="lash" d="M16 9.1V6.2" />
      <path className="lash" d="M20.7 9.55l.65-2.6" />
      <path className="lash" d="M24.15 11.1l1.6-2.35" />
      <g className="eyeAperture">
        <path className="eyeTop" d="M4.85 16c2.78-4.82 6.48-7.04 11.15-7.04S24.37 11.18 27.15 16" />
        <path className="eyeBottom" d="M4.85 16c2.78 4.82 6.48 7.04 11.15 7.04S24.37 20.82 27.15 16" />
      </g>
      <g className="eyePupil">
        <circle className="irisRing" cx="16" cy="16" r="4.2" />
        <circle className="iris" cx="16" cy="16" r="2.55" />
        <circle className="pupilGlint" cx="17.15" cy="14.65" r=".68" />
      </g>
    </svg>
  );
}

export function PhotozSearchDockIcon(props) {
  const size = props.size || 30;
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
