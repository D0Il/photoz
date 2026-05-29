import React from "react";

export function PhotozAlbumDockIcon(props) {
  const size = props.size || 30;
  return (
    <svg className="photozDockIcon photozDockBook" aria-hidden="true" viewBox="0 0 32 32" focusable="false" width={size} height={size}>
      <path className="bookShadow" d="M5.2 23.35c3.78-.82 7.2-.08 10.8 2.08 3.6-2.16 7.02-2.9 10.8-2.08" />
      <path className="bookCover left" d="M5.25 8.05c3.82-.78 7.25.07 10.75 2.33v14.18c-3.38-2.05-6.98-2.65-10.75-1.78V8.05Z" />
      <path className="bookCover right" d="M26.75 8.05c-3.82-.78-7.25.07-10.75 2.33v14.18c3.38-2.05 6.98-2.65 10.75-1.78V8.05Z" />
      <g className="bookStaticPages">
        <path className="bookPageLayer layerOne" d="M7.6 11.05c2.38-.18 4.62.3 6.72 1.44" />
        <path className="bookPageLayer layerThree" d="M17.68 12.45c2.1-1.14 4.34-1.62 6.72-1.44" />
        <path className="bookPageLayer layerFour" d="M17.68 15.22c1.96-.94 4.12-1.34 6.48-1.2" />
      </g>
      <path className="bookFlipPage" d="M16 10.45c-2.82-1.78-5.57-2.38-8.25-1.8v13.1c2.78-.54 5.53.08 8.25 1.86V10.45Z" />
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
      <g className="eyeBlinkGroup">
        <path className="eyeOutline" d="M4.85 16c2.78-4.82 6.48-7.04 11.15-7.04S24.37 11.18 27.15 16c-2.78 4.82-6.48 7.04-11.15 7.04S7.63 20.82 4.85 16Z" />
        <g className="eyePupil">
        <circle className="irisRing" cx="16" cy="16" r="4.2" />
        <circle className="iris" cx="16" cy="16" r="2.55" />
        <circle className="pupilGlint" cx="17.15" cy="14.65" r=".68" />
        </g>
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
