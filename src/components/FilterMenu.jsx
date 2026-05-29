import React from "react";
import { SlidersHorizontal } from "lucide-react";

function withTooltip(label) {
  const value = String(label || "").trim();
  return value ? { title: value, "data-tooltip": value, "aria-label": value } : {};
}

export function FilterPanel(props) {
  if (!props.open) return null;

  const sortMode = props.sortMode || "newest";
  const setSortMode = props.setSortMode || function () {};
  const filterType = props.filterType || "all";
  const setFilterType = props.setFilterType || function () {};
  const filterSource = props.filterSource || "all";
  const setFilterSource = props.setFilterSource || function () {};
  const filterQuality = props.filterQuality || "any";
  const setFilterQuality = props.setFilterQuality || function () {};
  const viewDensity = props.viewDensity || "normal";
  const setViewDensity = props.setViewDensity || function () {};

  return (
    <div className="floatingPanel filterPopover filterMenuPanel refinedFilterMenu" role="menu" aria-label="FILTER">

      <section className="filterMenuSection">
        <span>SORT</span>
        <div className="segmentedFilterRow">
          <button type="button" className={sortMode === "newest" ? "active" : ""} onClick={function () { setSortMode("newest"); }} {...withTooltip("Newest first")}>NEWEST</button>
          <button type="button" className={sortMode === "oldest" ? "active" : ""} onClick={function () { setSortMode("oldest"); }} {...withTooltip("Oldest first")}>OLDEST</button>
          <button type="button" className={sortMode === "title" ? "active" : ""} onClick={function () { setSortMode("title"); }} {...withTooltip("Title")}>TITLE</button>
        </div>
      </section>

      <section className="filterMenuSection">
        <span>TYPE</span>
        <div className="segmentedFilterRow">
          <button type="button" className={filterType === "all" ? "active" : ""} onClick={function () { setFilterType("all"); }} {...withTooltip("Any file type")}>ANY</button>
          <button type="button" className={filterType === "photos" ? "active" : ""} onClick={function () { setFilterType("photos"); }} {...withTooltip("Photos only")}>PHOTOS</button>
          <button type="button" className={filterType === "videos" ? "active" : ""} onClick={function () { setFilterType("videos"); }} {...withTooltip("Videos only")}>VIDEOS</button>
        </div>
      </section>

      <section className="filterMenuSection">
        <span>SOURCE</span>
        <div className="segmentedFilterRow">
          <button type="button" className={filterSource === "all" ? "active" : ""} onClick={function () { setFilterSource("all"); }} {...withTooltip("Any source")}>ANY</button>
          <button type="button" className={filterSource === "takeout" ? "active" : ""} onClick={function () { setFilterSource("takeout"); }} {...withTooltip("Google Takeout")}>TAKEOUT</button>
          <button type="button" className={filterSource === "needs-file" ? "active" : ""} onClick={function () { setFilterSource("needs-file"); }} {...withTooltip("Needs file")}>MISSING</button>
        </div>
      </section>

      <section className="filterMenuSection">
        <span>QUALITY</span>
        <div className="segmentedFilterRow">
          <button type="button" className={filterQuality === "any" ? "active" : ""} onClick={function () { setFilterQuality("any"); }} {...withTooltip("Any quality")}>ANY</button>
          <button type="button" className={filterQuality === "rated" ? "active" : ""} onClick={function () { setFilterQuality("rated"); setSortMode("rating"); }} {...withTooltip("Rated")}>RATED</button>
          <button type="button" className={sortMode === "largest" ? "active" : ""} onClick={function () { setSortMode("largest"); }} {...withTooltip("Largest files")}>LARGE</button>
        </div>
      </section>

      <section className="filterMenuSection">
        <span>VIEW</span>
        <div className="segmentedFilterRow">
          <button type="button" className={viewDensity === "compact" ? "active" : ""} onClick={function () { setViewDensity("compact"); }} {...withTooltip("Compact grid")}>TIGHT</button>
          <button type="button" className={viewDensity === "normal" ? "active" : ""} onClick={function () { setViewDensity("normal"); }} {...withTooltip("Normal grid")}>NORMAL</button>
          <button type="button" className={viewDensity === "large" ? "active" : ""} onClick={function () { setViewDensity("large"); }} {...withTooltip("Large grid")}>LARGE</button>
        </div>
      </section>
    </div>
  );
}
