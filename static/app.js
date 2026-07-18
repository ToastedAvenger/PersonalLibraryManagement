let OPTION_FIELDS = {};   // populated from /api/options at startup — see options.py
let books = [];
let editingId = null;      // null = not editing, 'new' = creating
let linkTargetId = null;   // id of the entry this form's set is linked to, or null
let pendingCover = null;   // {data, mime} staged for the current form, or null
let coverRemoved = false;  // true if user explicitly removed the existing cover
let selectModeOn = false;  // true while the bulk-selection UI is active
let selectedIds = new Set(); // book ids selected for bulk actions — survives filter/search changes

const $ = (id) => document.getElementById(id);

function escapeHtml(s){
  return (s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function showToast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(()=>t.classList.remove("show"), 2800);
}

async function api(path, options={}){
  const res = await fetch(path, {
    headers: {"Content-Type":"application/json"},
    ...options,
  });
  if(!res.ok){
    let msg = "Something went wrong.";
    try{ msg = (await res.json()).error || msg; }catch(e){}
    throw new Error(msg);
  }
  return res.json();
}

async function loadBooks(){
  try{
    books = await api("/api/books");
  }catch(e){
    showToast("Couldn't load your library: " + e.message);
    books = [];
  }
  const validIds = new Set(books.map(b=>b.id));
  [...selectedIds].forEach(id=>{ if(!validIds.has(id)) selectedIds.delete(id); });
  render();
}

// Builds a button + checkbox popover inside `container`, replacing whatever
// was there before. Reads any previously-checked values out of the
// container's own prior DOM first, so repeated calls (once per render, like
// the old <select>-based populateFilters()) preserve the user's selection
// across option-list rebuilds.
function createCheckboxDropdown(container, values, allLabel){
  const prevChecked = new Set(
    [...container.querySelectorAll('input[type=checkbox]:checked')].map(cb=>cb.value)
  );
  // render() rebuilds every dropdown from scratch on every change (including
  // one fired by a checkbox inside this very dropdown) — without this, that
  // rebuild would silently close whichever panel the user just clicked in,
  // making it impossible to check more than one box per open.
  const wasOpen = !!container.querySelector(".dropdown-filter-panel.open");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dropdown-filter-btn";
  const panel = document.createElement("div");
  panel.className = "dropdown-filter-panel";
  panel.innerHTML = values.map(v=>`
    <label class="dropdown-filter-option">
      <input type="checkbox" value="${escapeHtml(v.value)}" ${prevChecked.has(v.value)?"checked":""}>
      ${escapeHtml(v.label)}
    </label>`).join("") || `<div class="link-result-empty">No values yet.</div>`;

  function updateBtnLabel(){
    const n = panel.querySelectorAll('input:checked').length;
    btn.textContent = n===0 ? `All ${allLabel}` : `${n} selected`;
    btn.classList.toggle("active", n>0);
  }
  btn.addEventListener("click", (e)=>{
    e.stopPropagation();
    document.querySelectorAll(".dropdown-filter-panel.open").forEach(p=>{ if(p!==panel) p.classList.remove("open"); });
    panel.classList.toggle("open");
  });
  panel.addEventListener("click", e=>e.stopPropagation());
  panel.addEventListener("change", ()=>{ updateBtnLabel(); render(); });

  if(wasOpen) panel.classList.add("open");

  container.innerHTML = "";
  container.append(btn, panel);
  updateBtnLabel();
}

function getCheckedValues(containerId){
  return [...document.querySelectorAll(`#${containerId} input[type=checkbox]:checked`)].map(cb=>cb.value);
}

async function loadOptions(){
  try{
    OPTION_FIELDS = await api("/api/options");
  }catch(e){
    showToast("Couldn't load dropdown options: " + e.message);
    OPTION_FIELDS = {};
  }
  populateFormSelects();
  populateBulkEditSelects();
}

// Fills the bulk-edit modal's Shelf Position / Shelf Side selects (which
// already have a leading "— don't change —" option in the HTML) from
// options.py, mirroring populateFormSelects() below but without the
// "Other…" free-text fallback — bulk edit only ever picks a known value.
function populateBulkEditSelects(){
  for(const field of ["shelfPosition","shelfSide"]){
    const select = $(`bulk_${field}`);
    const cfg = OPTION_FIELDS[field];
    if(!select || !cfg) continue;
    const opts = cfg.options.map(o=>`<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
    select.innerHTML = select.querySelector('option[value=""]').outerHTML + opts;
  }
}

// Fills a <select> (which already has its leading "— None —" option in the
// HTML) with the options for `field` as defined in options.py, plus an
// "Other…" entry when that field allows free-text custom values.
function populateFormSelects(){
  for(const field of ["genre","language","isTranslation","copyType","publisher","shelfPosition","shelfSide"]){
    const selectId = field==="isTranslation" ? "f_translation" : field==="copyType" ? "f_copytype" : `f_${field}`;
    const select = $(selectId);
    const cfg = OPTION_FIELDS[field];
    if(!select || !cfg) continue;
    const opts = cfg.options.map(o=>`<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
    select.innerHTML = select.querySelector('option[value=""]').outerHTML + opts +
      (cfg.allowOther ? '<option value="Other">Other…</option>' : "");
  }
}

function optionLabel(field, value){
  const match = (OPTION_FIELDS[field]?.options || []).find(o=>o.value===value);
  return match ? match.label : value;
}

function genreLabel(value){ return optionLabel("genre", value); }

// Selects `value` in the dropdown if it's one of the known options for
// `field`; otherwise selects "Other…" and shows the free-text fallback
// pre-filled with the existing (custom/legacy) value.
function applyKnownOrOther(field, selectId, otherId, value){
  const known = (OPTION_FIELDS[field]?.options || []).map(o=>o.value);
  if(value && known.includes(value)){
    $(selectId).value = value;
    $(otherId).style.display = "none";
    $(otherId).value = "";
  } else if(value){
    $(selectId).value = "Other";
    $(otherId).style.display = "block";
    $(otherId).value = value;
  } else {
    $(selectId).value = "";
    $(otherId).style.display = "none";
    $(otherId).value = "";
  }
}

function nextAccession(){
  const max = books.reduce((m,b)=> Math.max(m, b.accession||0), 0);
  return max + 1;
}

function normTitle(t){ return (t||"").trim().toLowerCase(); }

// Rows sharing a non-empty setGroupId are fragments of one physical set
// (e.g. split across publishers or shelves) and must count as ONE unit
// whose volume is the sum of its fragments, not one unit per row —
// otherwise a 16-volume set split into two entries counts as 32.
function collapseIntoUnits(list){
  const units = [];
  const byGroup = {};
  list.forEach(b=>{
    const gid = (b.setGroupId||"").trim();
    if(!gid){ units.push({ id: b.id, members: [b] }); return; }
    if(!byGroup[gid]){
      byGroup[gid] = { id: gid, members: [] };
      units.push(byGroup[gid]);
    }
    byGroup[gid].members.push(b);
  });
  return units;
}

function unitVolume(unit){
  return unit.members.reduce((sum,b)=> sum + (parseInt(b.volume,10) || 1), 0);
}

function totalVolumesOf(list){
  return collapseIntoUnits(list).reduce((sum,u)=> sum + unitVolume(u), 0);
}

function searchNormalize(s){
  s = (s||"");
  s = s.replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, ""); // strip Arabic diacritics
  s = s.toLowerCase().trim();
  s = s.replace(/[^\w\s\u0600-\u06FF]/g, "");
  s = s.replace(/\s+/g, " ");
  return s;
}

function levenshtein(a, b){
  const m = a.length, n = b.length;
  if(m===0) return n;
  if(n===0) return m;
  let prev = Array.from({length:n+1}, (_,i)=>i);
  for(let i=1;i<=m;i++){
    const cur = [i];
    for(let j=1;j<=n;j++){
      cur[j] = a[i-1]===b[j-1] ? prev[j-1] : 1 + Math.min(prev[j-1], prev[j], cur[j-1]);
    }
    prev = cur;
  }
  return prev[n];
}

function fuzzyContains(text, query){
  const normText = searchNormalize(text);
  const normQuery = searchNormalize(query);
  if(!normQuery) return true;
  if(normText.includes(normQuery)) return true; // exact substring after cleanup — handles diacritics/punctuation
  // otherwise check word-by-word for small typos
  const textWords = normText.split(" ").filter(Boolean);
  const queryWords = normQuery.split(" ").filter(Boolean);
  return queryWords.every(qw=>
    textWords.some(tw=>{
      if(tw.includes(qw) || qw.includes(tw)) return true;
      const dist = levenshtein(qw, tw);
      return dist <= Math.max(1, Math.floor(qw.length * 0.3)); // allow ~30% of the word to be "wrong"
    })
  );
}

const FILTER_SPECS = [
  { id:"genreFilter", field:"genre", allLabel:"genres", labelFn:genreLabel },
  { id:"shelfFilter", field:"shelf", allLabel:"shelves", labelFn:v=>v },
  { id:"languageFilter", field:"language", allLabel:"languages", labelFn:v=>optionLabel("language", v) },
  { id:"publisherFilter", field:"publisher", allLabel:"publishers", labelFn:v=>optionLabel("publisher", v) },
  { id:"shelfPositionFilter", field:"shelfPosition", allLabel:"positions", labelFn:v=>optionLabel("shelfPosition", v) },
  { id:"shelfSideFilter", field:"shelfSide", allLabel:"sides", labelFn:v=>optionLabel("shelfSide", v) },
  { id:"translationFilter", field:"isTranslation", allLabel:"original/translation", labelFn:v=>optionLabel("isTranslation", v) },
];

function populateFilters(){
  FILTER_SPECS.forEach(spec=>{
    const values = [...new Set(books.map(b=>b[spec.field]).filter(Boolean))]
      .map(v=>({ value: v, label: spec.labelFn(v) }));
    createCheckboxDropdown($(spec.id), values, spec.allLabel);
  });
}

function updateStats(){
  const groups = {};
  books.forEach(b=>{ const k=normTitle(b.title); (groups[k]=groups[k]||[]).push(b); });
  const withPdf = books.filter(b=>b.hasPdf).length;
  const totalVolumes = totalVolumesOf(books);
  $("statsBox").innerHTML = `<b>${books.length}</b> ${books.length===1?'copy':'copies'} · <b>${Object.keys(groups).length}</b> titles · <b>${totalVolumes}</b> ${totalVolumes===1?'volume':'volumes'} · <b>${withPdf}</b> with PDF`;
}

function getFiltered(){
  const q = $("searchInput").value.trim();
  const selGenre = getCheckedValues("genreFilter");
  const selShelf = getCheckedValues("shelfFilter");
  const selLang = getCheckedValues("languageFilter");
  const selPub = getCheckedValues("publisherFilter");
  const selPos = getCheckedValues("shelfPositionFilter");
  const selSide = getCheckedValues("shelfSideFilter");
  const selTrans = getCheckedValues("translationFilter");
  const sortBy = $("sortBy").value;
  let list = books.filter(b=>{
    if(selGenre.length && !selGenre.includes(b.genre)) return false;
    if(selShelf.length && !selShelf.includes(b.shelf)) return false;
    if(selLang.length && !selLang.includes(b.language)) return false;
    if(selPub.length && !selPub.includes(b.publisher)) return false;
    if(selPos.length && !selPos.includes(b.shelfPosition)) return false;
    if(selSide.length && !selSide.includes(b.shelfSide)) return false;
    if(selTrans.length && !selTrans.includes(b.isTranslation)) return false;
    if(q && !fuzzyContains(`${b.title} ${b.author}`, q)) return false;
    return true;
  });
  list.sort((a,b)=>{
    if(sortBy==="author") return (a.author||"").localeCompare(b.author||"");
    if(sortBy==="shelf") return (a.shelf||"").localeCompare(b.shelf||"");
    if(sortBy==="recent") return (b.addedAt||0) - (a.addedAt||0);
    return (a.title||"").localeCompare(b.title||"");
  });
  return list;
}

function updateFilterSummary(list){
  const groups = new Set(list.map(b=>normTitle(b.title)));
  const volumes = totalVolumesOf(list);
  $("filterSummary").innerHTML = `<b>${groups.size}</b> ${groups.size===1?'title':'titles'} · <b>${volumes}</b> ${volumes===1?'volume':'volumes'}`;
}

function render(){
  populateFilters();
  updateStats();
  const list = getFiltered();
  updateFilterSummary(list);
  const grid = $("grid");
  $("emptyState").style.display = books.length===0 ? "block" : "none";

  if(list.length===0 && books.length>0){
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">No books match your search or filters.</div>`;
    $("selectAllVisibleBtn").textContent = "Select all 0 visible";
    updateSelectionBar();
    return;
  }

  const seen = new Set();
  const groups = [];
  list.forEach(b=>{
    const k = normTitle(b.title);
    if(!seen.has(k)){ seen.add(k); groups.push({key:k, items: list.filter(x=>normTitle(x.title)===k)}); }
  });

  grid.innerHTML = groups.map(grp => renderCard(collapseIntoUnits(grp.items))).join("");

  grid.querySelectorAll("[data-edit]").forEach(el=>{
    el.addEventListener("click", ()=> openForm(el.getAttribute("data-edit")));
  });
  grid.querySelectorAll("[data-toggle]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const box = el.closest(".card").querySelector(".edition-list");
      box.classList.toggle("open");
      el.textContent = box.classList.contains("open") ? "Hide editions ▲" : `${el.dataset.count} editions ▼`;
    });
  });
  grid.querySelectorAll("[data-set-toggle]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const box = el.closest(".set-breakdown").querySelector(".set-breakdown-list");
      box.classList.toggle("open");
      el.textContent = box.classList.contains("open") ? "Hide sources ▲" : `${el.dataset.count} sources ▼`;
    });
  });
  grid.querySelectorAll(".select-checkbox").forEach(el=>{
    el.addEventListener("change", ()=> toggleBookSelection(el.dataset.selectId, el.checked));
  });
  $("selectAllVisibleBtn").textContent = `Select all ${list.length} visible`;
  updateSelectionBar();
}

// Adds/removes `id` from the persistent selection set, then re-syncs every
// checkbox bound to that id in the current DOM (a row can appear twice — as
// a card's main entry and again inside its own "N sources" breakdown) so
// both stay checked/unchecked together without a full re-render.
function toggleBookSelection(id, checked){
  if(checked) selectedIds.add(id); else selectedIds.delete(id);
  document.querySelectorAll(`.select-checkbox[data-select-id="${id}"]`).forEach(cb=>{ cb.checked = checked; });
  updateSelectionBar();
}

function updateSelectionBar(){
  const n = selectedIds.size;
  $("selectionBar").style.display = (selectModeOn || n>0) ? "flex" : "none";
  $("selectionCount").textContent = `${n} ${n===1?"book":"books"} selected`;
}

const SHELF_POSITION_LABELS = { Front:"F", Back:"B" };
const SHELF_SIDE_LABELS = { East:"E", Middle:"M", West:"W" };

// Checkbox for one individually-addressable book row (same id as its Edit
// button). Hidden by CSS outside select mode. A row that appears in more
// than one place (a set's main member also appears in its own "N sources"
// breakdown) gets one checkbox per appearance, kept in sync via
// toggleBookSelection() rather than being deduplicated here.
function selectCheckboxHtml(id){
  return `<input type="checkbox" class="select-checkbox" data-select-id="${id}" ${selectedIds.has(id)?"checked":""}>`;
}

function renderBadges(book){
  const genreTag = book.genre ? `<span class="tag">${escapeHtml(genreLabel(book.genre))}</span>` : "";
  const shelfTag = book.shelf ? `<span class="shelf-stamp">${escapeHtml(book.shelf)}</span>` : "";
  const volumeTag = (book.volume || "").trim() !== "" ? `<span class="tag tag-volume">Vol. ${escapeHtml(book.volume)}</span>` : "";
  const posTag = book.shelfPosition ? `<span class="tag tag-side">${escapeHtml(SHELF_POSITION_LABELS[book.shelfPosition] || book.shelfPosition)}</span>` : "";
  const sideTag = book.shelfSide ? `<span class="tag tag-pos">${escapeHtml(SHELF_SIDE_LABELS[book.shelfSide] || book.shelfSide)}</span>` : "";
  const pdfBadge = book.hasPdf ? `<a class="pdf-badge" href="/api/books/${book.id}/pdf" target="_blank">📄 View PDF</a>` : "";
  return `${genreTag}${shelfTag}${volumeTag}${posTag}${sideTag}${pdfBadge}`;
}

// Badges for a "unit" — either a single row (behaves exactly like
// renderBadges) or a merged set (multiple rows sharing setGroupId), in
// which case the volume tag shows the summed total instead of one row's
// raw value, and shelf/position tags are dropped (they differ per member
// and are shown in the set's breakdown instead).
function renderUnitBadges(unit){
  if(unit.members.length === 1) return renderBadges(unit.members[0]);
  const main = unit.members[0];
  const total = unitVolume(unit);
  const genreTag = main.genre ? `<span class="tag">${escapeHtml(genreLabel(main.genre))}</span>` : "";
  const volumeTag = `<span class="tag tag-volume">${total} ${total===1?'volume':'volumes'} total</span>`;
  const pdfSource = unit.members.find(m=>m.hasPdf);
  const pdfBadge = pdfSource ? `<a class="pdf-badge" href="/api/books/${pdfSource.id}/pdf" target="_blank">📄 View PDF</a>` : "";
  return `${genreTag}${volumeTag}${pdfBadge}`;
}

// Expandable list of a merged set's individual sources (publisher/shelf/
// partial volume count per row), reusing the edition-list visual pattern
// but nested one level deeper so it doesn't collide with the outer toggle.
function renderSetBreakdown(unit){
  if(unit.members.length <= 1) return "";
  return `
    <div class="set-breakdown">
      <button class="link-btn set-breakdown-toggle" data-set-toggle data-count="${unit.members.length}">${unit.members.length} sources ▼</button>
      <div class="set-breakdown-list">
        ${unit.members.map(m=>{
          const count = parseInt(m.volume,10) || 1;
          const meta = [m.publisher, m.edition, m.year].filter(Boolean).join(" · ") || "Untitled source";
          return `
          <div class="edition-item">
            ${selectCheckboxHtml(m.id)}
            <div class="edition-meta">${escapeHtml(meta)} — ${count} ${count===1?'volume':'volumes'}</div>
            <div class="tag-row edition-tag-row">${renderBadges(m)}</div>
            <button class="link-btn" data-edit="${m.id}">Edit</button>
          </div>`;
        }).join("")}
      </div>
    </div>`;
}

function unitMetaLine(unit){
  if(unit.members.length === 1){
    const m = unit.members[0];
    return [m.publisher, m.edition, m.year].filter(Boolean).join(" · ");
  }
  return [...new Set(unit.members.map(m=>m.publisher).filter(Boolean))].join(" + ");
}

function renderCard(units){
  const mainUnit = units[0];
  const main = mainUnit.members[0];
  const extraUnits = units.slice(1);
  const metaBits = unitMetaLine(mainUnit);
  const coverHtml = main.hasCover
    ? `<img src="/api/books/${main.id}/cover" alt="">`
    : `<span class="no-img">No image</span>`;

  const editionListHtml = extraUnits.length ? `
    <div class="edition-list">
      ${extraUnits.map(u=>{
        if(u.members.length === 1){
          const e = u.members[0];
          return `
          <div class="edition-item">
            ${selectCheckboxHtml(e.id)}
            <div class="edition-meta">${escapeHtml([e.publisher,e.edition,e.year].filter(Boolean).join(" · ") || "Untitled edition")}</div>
            <div class="tag-row edition-tag-row">${renderBadges(e)}</div>
            <button class="link-btn" data-edit="${e.id}">Edit</button>
          </div>`;
        }
        return `
        <div class="edition-item">
          <div class="edition-meta">${escapeHtml(unitMetaLine(u) || "Untitled edition")}</div>
          <div class="tag-row edition-tag-row">${renderUnitBadges(u)}</div>
          ${renderSetBreakdown(u)}
        </div>`;
      }).join("")}
    </div>` : "";

  return `
    <div class="card">
      ${selectCheckboxHtml(main.id)}
      <span class="accession">No. ${String(main.accession).padStart(4,"0")}</span>
      <div class="card-body">
        <div class="card-cover">${coverHtml}</div>
        <div class="card-main">
          <h3>${escapeHtml(main.title)}</h3>
          ${main.author ? `<div class="author">${escapeHtml(main.author)} ${main.deathYear?`<span class="death">(d. ${escapeHtml(main.deathYear)})</span>`:""}</div>` : ""}
          ${metaBits ? `<div class="meta-line">${escapeHtml(metaBits)}</div>` : ""}
          <div class="tag-row">
            ${renderUnitBadges(mainUnit)}
            ${extraUnits.length ? `<button class="link-btn editions-badge" data-toggle data-count="${units.length}">${units.length} editions ▼</button>` : ""}
          </div>
        </div>
      </div>
      ${mainUnit.members.length > 1 ? renderSetBreakdown(mainUnit) : ""}
      ${editionListHtml}
      <div class="card-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${main.id}">Edit</button>
      </div>
    </div>`;
}

function setCoverPreview(src){
  const box = $("coverPreview");
  if(src){
    box.innerHTML = `<img src="${src}" alt="">`;
    $("removeCoverBtn").style.display = "inline-flex";
    $("extractCoverBtn").style.display = "inline-flex";
  } else {
    box.innerHTML = `<span class="cover-placeholder">No image</span>`;
    $("removeCoverBtn").style.display = "none";
    $("extractCoverBtn").style.display = "none";
  }
}

function openForm(id){
  editingId = id || 'new';
  pendingCover = null;
  coverRemoved = false;
  const b = id ? books.find(x=>x.id===id) : null;
  $("formTitle").textContent = b ? "Edit Book" : "Add a Book";
  $("f_isbn").value = b?.isbn || "";
  $("isbnLookupStatus").textContent = "";
  $("f_title").value = b?.title || "";
  $("f_author").value = b?.author || "";
  $("f_death").value = b?.deathYear || "";
  $("f_edition").value = b?.edition || "";
  $("f_year").value = b?.year || "";
  $("f_volume").value = b?.volume || "";
  $("f_shelf").value = b?.shelf || "";
  $("f_notes").value = b?.notes || "";
  $("f_translation").value = b?.isTranslation || "";
  $("f_translator").value = b?.translator || "";
  updateTranslatorVisibility();
  $("f_copytype").value = b?.copyType || "";
  $("f_shelfPosition").value = b?.shelfPosition || "";
  $("f_shelfSide").value = b?.shelfSide || "";
  $("coverFileInput").value = "";

  applyKnownOrOther("genre", "f_genre", "f_genre_other", b?.genre);
  applyKnownOrOther("publisher", "f_publisher", "f_publisher_other", b?.publisher);
  applyKnownOrOther("language", "f_language", "f_language_other", b?.language);

  setCoverPreview(b?.hasCover ? `/api/books/${b.id}/cover?ts=${Date.now()}` : null);

  if(b?.hasPdf){
    $("pdfInfoField").style.display = "block";
    $("pdfInfo").innerHTML = `📄 A matching PDF is linked. <a href="/api/books/${b.id}/pdf" target="_blank">Open it</a>.`;
  } else {
    $("pdfInfoField").style.display = "none";
  }

  $("deleteBtn").style.display = b ? "inline-flex" : "none";

  linkTargetId = null;
  $("f_linkToggle").checked = false;
  $("linkPicker").style.display = "none";
  $("f_linkSearch").value = "";
  $("linkResults").innerHTML = "";
  $("linkSelected").style.display = "none";
  if(b?.setGroupId){
    const sibling = books.find(x=>x.setGroupId===b.setGroupId && x.id!==b.id);
    if(sibling){
      linkTargetId = sibling.id;
      $("f_linkToggle").checked = true;
      $("linkPicker").style.display = "block";
      showLinkSelected(sibling);
    }
  }

  $("overlay").classList.add("open");
  setTimeout(()=>$("f_title").focus(), 50);
}

function renderLinkResults(){
  const q = $("f_linkSearch").value.trim();
  const results = books
    .filter(b=> b.id !== editingId && (!q || fuzzyContains(b.title, q)))
    .slice(0, 8);
  $("linkResults").innerHTML = results.map(b=>{
    const meta = [b.publisher, b.volume ? `${b.volume} vol.` : "", b.shelf].filter(Boolean).join(" · ");
    return `<button type="button" class="link-result-item" data-link-pick="${b.id}">
      <div class="link-result-title">${escapeHtml(b.title)}</div>
      ${meta ? `<div class="link-result-meta">${escapeHtml(meta)}</div>` : ""}
    </button>`;
  }).join("") || `<div class="link-result-empty">No matching entries.</div>`;
  $("linkResults").querySelectorAll("[data-link-pick]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const target = books.find(x=>x.id===el.getAttribute("data-link-pick"));
      linkTargetId = target.id;
      showLinkSelected(target);
    });
  });
}

function showLinkSelected(b){
  $("linkResults").innerHTML = "";
  $("f_linkSearch").value = "";
  $("linkSelected").style.display = "flex";
  $("linkSelected").innerHTML = `<span>Linked to: <b>${escapeHtml(b.title)}</b>${b.publisher?` (${escapeHtml(b.publisher)})`:""}</span>
    <button type="button" class="link-btn" id="linkChangeBtn">Change</button>`;
  $("linkChangeBtn").addEventListener("click", ()=>{
    linkTargetId = null;
    $("linkSelected").style.display = "none";
    $("f_linkSearch").value = $("f_title").value.trim();
    renderLinkResults();
    $("f_linkSearch").focus();
  });
}

function closeForm(){
  $("overlay").classList.remove("open");
  editingId = null;
  closeBarcodeScanner();
}

// Reads a select+"Other" free-text pair back into a single value.
function collectKnownOrOther(selectId, otherId){
  const selected = $(selectId).value;
  return selected === "Other" ? ($(otherId).value.trim() || "Other") : selected;
}

function collectForm(){
  const payload = {
    isbn: $("f_isbn").value.trim(),
    title: $("f_title").value.trim(),
    author: $("f_author").value.trim(),
    deathYear: $("f_death").value.trim(),
    publisher: collectKnownOrOther("f_publisher", "f_publisher_other"),
    edition: $("f_edition").value.trim(),
    year: $("f_year").value.trim(),
    volume: $("f_volume").value.trim(),
    genre: collectKnownOrOther("f_genre", "f_genre_other"),
    shelf: $("f_shelf").value.trim(),
    shelfPosition: $("f_shelfPosition").value,
    shelfSide: $("f_shelfSide").value,
    notes: $("f_notes").value.trim(),
    language: collectKnownOrOther("f_language", "f_language_other"),
    isTranslation: $("f_translation").value,
    translator: $("f_translation").value === "Translation" ? $("f_translator").value.trim() : "",
    copyType: $("f_copytype").value,
  };
  if(pendingCover) payload.cover = pendingCover;
  if(coverRemoved) payload.removeCover = true;
  return payload;
}

// Resolves the setGroupId to save with this entry. If linked to a target
// that has no group yet, mints one and stamps it onto the target too, so
// both rows end up sharing it — this is what makes their volume counts
// combine into one total instead of each counting the full set twice.
async function resolveSetGroupId(){
  if(!$("f_linkToggle").checked || !linkTargetId) return "";
  const target = books.find(x=>x.id===linkTargetId);
  if(target?.setGroupId) return target.setGroupId;
  const newGroupId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
  await api(`/api/books/${linkTargetId}`, { method:"PUT", body: JSON.stringify({ setGroupId: newGroupId }) });
  return newGroupId;
}

async function saveForm(){
  const data = collectForm();
  if(!data.title){
    showToast("Please enter a title.");
    $("f_title").focus();
    return;
  }
  if($("f_linkToggle").checked && !linkTargetId){
    showToast("Please select an entry to link to, or uncheck that box.");
    return;
  }
  try{
    data.setGroupId = await resolveSetGroupId();
    if(editingId === 'new'){
      await api("/api/books", { method:"POST", body: JSON.stringify(data) });
      showToast("Book added.");
    } else {
      await api(`/api/books/${editingId}`, { method:"PUT", body: JSON.stringify(data) });
      showToast("Changes saved.");
    }
    closeForm();
    await loadBooks();
  }catch(e){
    showToast("Couldn't save: " + e.message);
  }
}

async function deleteCurrent(){
  if(editingId==='new' || !editingId) return;
  if(!confirm("Delete this book entry? This cannot be undone. (The PDF file itself, if any, will not be deleted from your disk.)")) return;
  try{
    await api(`/api/books/${editingId}`, { method:"DELETE" });
    closeForm();
    await loadBooks();
    showToast("Book deleted.");
  }catch(e){
    showToast("Couldn't delete: " + e.message);
  }
}

function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleFileUpload(e){
  const file = e.target.files[0];
  if(!file) return;
  const b64 = await fileToBase64(file);
  pendingCover = { data: b64, mime: file.type || "image/jpeg" };
  coverRemoved = false;
  setCoverPreview(`data:${pendingCover.mime};base64,${pendingCover.data}`);
}

function removeCover(){
  pendingCover = null;
  coverRemoved = true;
  setCoverPreview(null);
}

// Returns {data, mime} for whatever cover is currently showing in the form —
// a freshly-staged pendingCover, or (when editing) the book's saved cover
// fetched fresh from the server — or null if there's nothing to extract from.
async function getCoverForExtraction(){
  if(pendingCover) return pendingCover;
  if(editingId && editingId !== 'new' && !coverRemoved){
    const b = books.find(x=>x.id===editingId);
    if(b?.hasCover){
      const res = await fetch(`/api/books/${editingId}/cover`);
      if(!res.ok) return null;
      const blob = await res.blob();
      const data = await fileToBase64(blob);
      return { data, mime: blob.type || "image/jpeg" };
    }
  }
  return null;
}

const EXTRACT_FIELD_LABELS = { title:"Title", author:"Author", deathYear:"Author's Death Year", publisher:"Publisher", translator:"Translator", isTranslation:"Original/Translation" };

async function extractCoverInfo(){
  const cover = await getCoverForExtraction();
  if(!cover){ showToast("Add a cover image first."); return; }
  const btn = $("extractCoverBtn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Extracting…";
  try{
    const result = await api("/api/extract_cover", { method:"POST", body: JSON.stringify({cover}) });
    if(result.notABookCover){
      showToast("That doesn't look like a book cover — couldn't extract info.");
      return;
    }
    const found = Object.keys(EXTRACT_FIELD_LABELS).filter(k=>result[k]);
    if(!found.length){
      showToast("Couldn't read any book details off that cover.");
      return;
    }
    const msg = `Fill in ${found.map(k=>EXTRACT_FIELD_LABELS[k]).join(", ")} from the cover?\n\n(Only fields Gemini found a value for are changed — anything else you've already typed is left as-is.)`;
    if(!confirm(msg)) return;
    applyExtractedInfo(result);
    showToast("Filled in from cover.");
  }catch(e){
    showToast("Couldn't extract info: " + e.message);
  }finally{
    btn.disabled = false;
    btn.textContent = original;
  }
}

function applyExtractedInfo(result){
  if(result.title) $("f_title").value = result.title;
  if(result.author) $("f_author").value = result.author;
  if(result.deathYear) $("f_death").value = result.deathYear;
  if(result.publisher) applyKnownOrOther("publisher", "f_publisher", "f_publisher_other", result.publisher);
  if(result.isTranslation) $("f_translation").value = result.isTranslation;
  if(result.translator) $("f_translator").value = result.translator;
  updateTranslatorVisibility();
}

// ---- ISBN barcode scanning + lookup ----
let barcodeReader = null;   // ZXingBrowser.BrowserMultiFormatReader instance while a scan is active
let barcodeControls = null; // return value of decodeFromConstraints — lets us stop the camera stream

const ISBN_PREFIX_RE = /^(978|979)\d{10}$/; // Bookland/EAN prefix — rejects non-book EAN-13 barcodes

async function openBarcodeScanner(){
  $("barcodeStatus").textContent = "";
  $("barcodeOverlay").classList.add("open");

  if(!navigator.mediaDevices?.getUserMedia){
    $("barcodeStatus").textContent = "Camera scanning isn't available in this browser/connection (it needs HTTPS or localhost). Type the ISBN manually instead.";
    return;
  }
  if(!window.ZXingBrowser){
    $("barcodeStatus").textContent = "Barcode scanner library failed to load.";
    return;
  }

  try{
    // @zxing/browser's bundle doesn't expose DecodeHintType, so we can't restrict
    // to EAN_13 at construction time — it decodes all supported formats instead,
    // and ISBN_PREFIX_RE below filters for genuine book barcodes among the results.
    barcodeReader = new ZXingBrowser.BrowserMultiFormatReader();

    barcodeControls = await barcodeReader.decodeFromConstraints(
      { video: { facingMode: { ideal: "environment" } } },
      "barcodeVideo",
      (result)=>{
        if(!result) return; // fires repeatedly with no match between frames — ignore
        const code = result.getText();
        if(!ISBN_PREFIX_RE.test(code)){
          $("barcodeStatus").textContent = "That doesn't look like a book barcode — keep scanning.";
          return;
        }
        closeBarcodeScanner();
        onIsbnScanned(code);
      }
    );
  }catch(e){
    if(e.name === "NotAllowedError"){
      $("barcodeStatus").textContent = "Camera access was denied. Allow camera permission in your browser and try again.";
    } else if(e.name === "NotFoundError"){
      $("barcodeStatus").textContent = "No camera found on this device.";
    } else {
      $("barcodeStatus").textContent = "Couldn't start the camera: " + e.message;
    }
  }
}

function closeBarcodeScanner(){
  $("barcodeOverlay").classList.remove("open");
  if(barcodeControls){ barcodeControls.stop(); barcodeControls = null; }
  barcodeReader = null;
}

function onIsbnScanned(isbn){
  $("f_isbn").value = isbn;
  $("isbnLookupStatus").textContent = "ISBN scanned. Click \"Look up\" to fetch book details.";
}

const ISBN_LOOKUP_FIELD_SETTERS = {
  title:     v => { $("f_title").value = v; },
  author:    v => { $("f_author").value = v; },
  publisher: v => applyKnownOrOther("publisher", "f_publisher", "f_publisher_other", v),
  year:      v => { $("f_year").value = v; },
  edition:   v => { $("f_edition").value = v; },
};

function applyIsbnLookupInfo(result){
  for(const [key, setter] of Object.entries(ISBN_LOOKUP_FIELD_SETTERS)){
    if(result[key]) setter(result[key]);
  }
}

function warnIfDuplicateIsbn(isbn){
  const dupes = books.filter(b => b.isbn && b.isbn === isbn && b.id !== editingId);
  if(dupes.length){
    $("isbnLookupStatus").textContent += ` Note: ${dupes.length} other entr${dupes.length===1?"y":"ies"} in your library already ${dupes.length===1?"has":"have"} this ISBN.`;
  }
}

async function lookupIsbn(isbn){
  isbn = (isbn || "").trim();
  if(!isbn){ showToast("Enter or scan an ISBN first."); return; }
  $("isbnLookupStatus").textContent = "Looking up ISBN…";
  try{
    const result = await api("/api/lookup_isbn", { method:"POST", body: JSON.stringify({isbn}) });
    applyIsbnLookupInfo(result);
    $("isbnLookupStatus").textContent = "Filled in from Open Library.";
    warnIfDuplicateIsbn(isbn);
    showToast("Book info found via Open Library.");
  }catch(e){
    $("isbnLookupStatus").textContent = "No match on Open Library.";
    const cover = await getCoverForExtraction();
    if(cover){
      showToast("No Open Library match — trying the cover photo instead…");
      await extractCoverInfo();
    } else {
      showToast("No Open Library match for that ISBN. Take a cover photo, or fill in details manually.");
    }
  }
}

// ---- Scan PDFs panel ----

async function openScanPanel(){
  $("scanResults").innerHTML = "";
  try{
    const cfg = await api("/api/settings");
    $("pdfFolderInput").value = cfg.pdf_folder || "";
  }catch(e){}
  $("scanOverlay").classList.add("open");
}

function closeScanPanel(){
  $("scanOverlay").classList.remove("open");
}

async function runScan(){
  const folder = $("pdfFolderInput").value.trim();
  const btn = $("scanRunBtn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Scanning…";
  $("scanResults").innerHTML = "";
  try{
    await api("/api/settings", { method:"POST", body: JSON.stringify({pdf_folder: folder}) });
    const res = await api("/api/scan_pdfs", { method:"POST" });
    $("scanResults").innerHTML = `
      <div class="stat-line">✅ Linked ${res.linked.length} PDF(s) to matching entries.</div>
      ${res.linked.length ? `<ul>${res.linked.map(l=>`<li>${escapeHtml(l.file)} → ${escapeHtml(l.matchedTitle)}</li>`).join("")}</ul>` : ""}
      <div class="stat-line">↩️ Skipped ${res.skippedAlreadyLinked.length} already-linked file(s).</div>
      <div class="stat-line">⏭️ Skipped ${res.skippedUnmatched.length} file(s) with no matching entry.</div>
      ${res.skippedUnmatched.length ? `<ul>${res.skippedUnmatched.map(f=>`<li>${escapeHtml(f)}</li>`).join("")}</ul>` : ""}
    `;
    await loadBooks();
  }catch(e){
    $("scanResults").innerHTML = `<div class="stat-line" style="color:var(--rubric);">${escapeHtml(e.message)}</div>`;
  }finally{
    btn.disabled = false;
    btn.textContent = original;
  }
}

// ---- AI Settings panel ----

async function openAiSettingsPanel(){
  $("geminiApiKeyInput").value = "";
  $("geminiKeyStatus").textContent = "";
  try{
    const cfg = await api("/api/settings");
    $("geminiKeyStatus").textContent = cfg.hasGeminiKey ? "A key is currently set." : "No key set yet.";
  }catch(e){}
  $("aiSettingsOverlay").classList.add("open");
}

function closeAiSettingsPanel(){
  $("aiSettingsOverlay").classList.remove("open");
}

async function saveAiSettings(){
  const key = $("geminiApiKeyInput").value.trim();
  if(!key){ showToast("Enter a key to save, or use Clear key to remove it."); return; }
  try{
    const cfg = await api("/api/settings", { method:"POST", body: JSON.stringify({gemini_api_key: key}) });
    $("geminiApiKeyInput").value = "";
    $("geminiKeyStatus").textContent = cfg.hasGeminiKey ? "A key is currently set." : "No key set yet.";
    showToast("Gemini API key saved.");
  }catch(e){
    showToast("Couldn't save key: " + e.message);
  }
}

async function clearAiSettings(){
  if(!confirm("Remove the saved Gemini API key?")) return;
  try{
    const cfg = await api("/api/settings", { method:"POST", body: JSON.stringify({clearGeminiKey: true}) });
    $("geminiApiKeyInput").value = "";
    $("geminiKeyStatus").textContent = cfg.hasGeminiKey ? "A key is currently set." : "No key set yet.";
    showToast("Gemini API key cleared.");
  }catch(e){
    showToast("Couldn't clear key: " + e.message);
  }
}

// ---- Wire up events ----
$("addBtn").addEventListener("click", ()=>openForm(null));
$("cancelBtn").addEventListener("click", closeForm);
$("saveBtn").addEventListener("click", saveForm);
$("deleteBtn").addEventListener("click", deleteCurrent);
$("coverFileInput").addEventListener("change", handleFileUpload);
$("coverCameraInput").addEventListener("change", handleFileUpload);
$("removeCoverBtn").addEventListener("click", removeCover);
$("extractCoverBtn").addEventListener("click", extractCoverInfo);
$("scanBarcodeBtn").addEventListener("click", openBarcodeScanner);
$("isbnLookupBtn").addEventListener("click", ()=>lookupIsbn($("f_isbn").value));
$("barcodeCancelBtn").addEventListener("click", closeBarcodeScanner);
$("barcodeOverlay").addEventListener("click", (e)=>{ if(e.target.id==="barcodeOverlay") closeBarcodeScanner(); });
$("overlay").addEventListener("click", (e)=>{ if(e.target.id==="overlay") closeForm(); });
[["f_genre","f_genre_other"], ["f_language","f_language_other"], ["f_publisher","f_publisher_other"]].forEach(([selectId, otherId])=>{
  $(selectId).addEventListener("change", ()=>{
    $(otherId).style.display = $(selectId).value==="Other" ? "block" : "none";
  });
});
function updateTranslatorVisibility(){
  $("f_translator_field").style.display = $("f_translation").value === "Translation" ? "block" : "none";
}
$("f_translation").addEventListener("change", updateTranslatorVisibility);
["searchInput","sortBy"].forEach(id=>{
  $(id).addEventListener("input", render);
  $(id).addEventListener("change", render);
});
document.addEventListener("click", ()=>{
  document.querySelectorAll(".dropdown-filter-panel.open").forEach(p=>p.classList.remove("open"));
});
$("advFilterToggle").addEventListener("click", ()=>{
  const open = $("advFilterPanel").style.display !== "none";
  $("advFilterPanel").style.display = open ? "none" : "block";
  $("advFilterToggle").textContent = open ? "Advanced Filters ▾" : "Advanced Filters ▴";
});
$("resetFiltersBtn").addEventListener("click", ()=>{
  $("searchInput").value = "";
  $("sortBy").value = "title";
  document.querySelectorAll(".dropdown-filter input[type=checkbox]:checked").forEach(cb=>{ cb.checked = false; });
  render();
});
$("selectModeBtn").addEventListener("click", ()=>{
  selectModeOn = !selectModeOn;
  $("selectModeBtn").textContent = selectModeOn ? "Done Selecting" : "Select";
  $("selectModeBtn").classList.toggle("btn-primary", selectModeOn);
  document.body.classList.toggle("select-mode", selectModeOn);
  updateSelectionBar();
});
$("selectAllVisibleBtn").addEventListener("click", ()=>{
  getFiltered().forEach(b=> selectedIds.add(b.id));
  render();
});
$("clearSelectionBtn").addEventListener("click", ()=>{
  selectedIds.clear();
  render();
});
$("bulkDeleteBtn").addEventListener("click", async ()=>{
  const n = selectedIds.size;
  if(n===0) return;
  if(!confirm(`Delete ${n} selected book${n===1?"":"s"}? This cannot be undone. (Linked PDF files on disk are not deleted.)`)) return;
  try{
    const res = await api("/api/books/bulk_delete", { method:"POST", body: JSON.stringify({ids:[...selectedIds]}) });
    res.deleted.forEach(id=> selectedIds.delete(id));
    await loadBooks();
    showToast(`Deleted ${res.deleted.length} book(s).`);
  }catch(e){
    showToast("Couldn't delete: " + e.message);
  }
});
$("bulkEditBtn").addEventListener("click", ()=>{
  if(selectedIds.size===0) return;
  $("bulk_shelf").value = "";
  $("bulk_shelfPosition").value = "";
  $("bulk_shelfSide").value = "";
  $("bulkEditOverlay").classList.add("open");
});
$("bulkEditCancelBtn").addEventListener("click", ()=> $("bulkEditOverlay").classList.remove("open"));
$("bulkEditOverlay").addEventListener("click", (e)=>{ if(e.target.id==="bulkEditOverlay") $("bulkEditOverlay").classList.remove("open"); });
$("bulkEditSaveBtn").addEventListener("click", async ()=>{
  const payload = { ids: [...selectedIds] };
  const shelf = $("bulk_shelf").value.trim();
  const pos = $("bulk_shelfPosition").value;
  const side = $("bulk_shelfSide").value;
  if(shelf) payload.shelf = shelf;
  if(pos) payload.shelfPosition = pos;
  if(side) payload.shelfSide = side;
  if(!("shelf" in payload) && !("shelfPosition" in payload) && !("shelfSide" in payload)){
    showToast("Nothing to change — fill in at least one field.");
    return;
  }
  try{
    const res = await api("/api/books/bulk_update", { method:"POST", body: JSON.stringify(payload) });
    $("bulkEditOverlay").classList.remove("open");
    await loadBooks();
    showToast(`Updated ${res.updated.length} book(s).`);
  }catch(e){
    showToast("Couldn't update: " + e.message);
  }
});
$("scanBtn").addEventListener("click", openScanPanel);
$("scanCancelBtn").addEventListener("click", closeScanPanel);
$("scanRunBtn").addEventListener("click", runScan);
$("aiSettingsBtn").addEventListener("click", openAiSettingsPanel);
$("aiSettingsCancelBtn").addEventListener("click", closeAiSettingsPanel);
$("aiSettingsSaveBtn").addEventListener("click", saveAiSettings);
$("aiSettingsClearBtn").addEventListener("click", clearAiSettings);
$("aiSettingsOverlay").addEventListener("click", (e)=>{ if(e.target.id==="aiSettingsOverlay") closeAiSettingsPanel(); });
$("scanOverlay").addEventListener("click", (e)=>{ if(e.target.id==="scanOverlay") closeScanPanel(); });
$("f_volume").addEventListener("input", ()=>{
  $("f_volume").value = $("f_volume").value.replace(/[^\d]/g, "");
});
$("f_linkToggle").addEventListener("change", ()=>{
  const on = $("f_linkToggle").checked;
  $("linkPicker").style.display = on ? "block" : "none";
  if(!on){
    linkTargetId = null;
    $("linkSelected").style.display = "none";
    $("f_linkSearch").value = "";
    $("linkResults").innerHTML = "";
  } else if(!linkTargetId){
    $("f_linkSearch").value = $("f_title").value.trim();
    renderLinkResults();
    $("f_linkSearch").focus();
  }
});
$("f_linkSearch").addEventListener("input", renderLinkResults);
$("exportBtn").addEventListener("click", ()=>{
  window.location.href = "/api/export/csv";
});

$("exportExcelBtn").addEventListener("click", ()=>{
  window.location.href = "/api/export/xlsx";
});

$("importFileInput").addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const formData = new FormData();
  formData.append("file", file);
  try{
    const res = await fetch("/api/import/csv", { method:"POST", body: formData });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || "Import failed.");
    showToast(`Import done — ${data.created} added, ${data.updated} updated, ${data.skipped} skipped (blank title).`);
    await loadBooks();
  }catch(err){
    showToast("Import failed: " + err.message);
  }
  e.target.value = "";
});

$("importExcelFileInput").addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const formData = new FormData();
  formData.append("file", file);
  try{
    const res = await fetch("/api/import/xlsx", { method:"POST", body: formData });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || "Import failed.");
    showToast(`Import done — ${data.created} added, ${data.updated} updated, ${data.skipped} skipped (blank title).`);
    await loadBooks();
  }catch(err){
    showToast("Import failed: " + err.message);
  }
  e.target.value = "";
});

async function init(){
  await loadOptions();
  await loadBooks();
}
init();
