const $ = id => document.getElementById(id);
const STORAGE_KEY = "tiermaker-session-v1";
const palette = ["#f47b6d", "#f2a65a", "#f2cf63", "#a8d67b", "#75c9b7", "#87a7e8"];
const titleOrder = new Intl.Collator("ru", {numeric: true, sensitivity: "base"});
let tiers = ["S", "A", "B", "C", "D", "E"].map((name, index) => ({id: crypto.randomUUID(), name, color: palette[index], items: []}));
let pool = [], draggedId = null, dirty = false, tierMenu = null, menuOpener = null, editingItem = null;
const cardElements = new Map();

const proxy = url => url ? (location.protocol === "file:" ? url : `/api/image?url=${encodeURIComponent(url)}`) : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='176' height='244'%3E%3Crect width='100%25' height='100%25' fill='%23d9d5cc'/%3E%3C/svg%3E";
const preview = url => proxy(url?.includes("images.igdb.com/igdb/image/upload/") ? url.replace(/\/t_[^/]+\//, "/t_thumb/") : url);
const exportCover = url => proxy(url?.replace("/t_cover_big_2x/", "/t_cover_big/"));
const allItems = () => [...pool, ...tiers.flatMap(tier => tier.items)];
const uniqueItems = items => [...new Map(items.filter(item => item.title).map(item => [item.url || `${item.title}|${item.image}`, {...item, id: item.id || crypto.randomUUID()}])).values()];

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({version: 1, tiers, pool})); dirty = false; }
  catch { $("status").textContent = "Не удалось сохранить прогресс в браузере."; }
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version !== 1 || !Array.isArray(saved.tiers) || !Array.isArray(saved.pool)) return false;
    tiers = saved.tiers.map(tier => ({...tier, id: tier.id || crypto.randomUUID(), items: uniqueItems(tier.items || [])}));
    pool = uniqueItems(saved.pool); return true;
  } catch { return false; }
}

function card(item) {
  if (cardElements.has(item.id)) return cardElements.get(item.id);
  const el = document.createElement(item.url ? "a" : "div");
  el.className = "card"; el.draggable = true; el.dataset.id = item.id; el.dataset.search = item.title.toLocaleLowerCase(); el.tabIndex = 0;
  if (item.url) { el.href = item.url; el.target = "_blank"; el.rel = "noreferrer"; }
  const img = new Image(88, 88); img.src = preview(item.image); img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.addEventListener("error", () => img.style.opacity = 0, {once: true});
  el.title = item.title; el.setAttribute("aria-label", item.title); el.append(img);
  el.addEventListener("dragstart", event => { draggedId = item.id; el.classList.add("dragging"); event.dataTransfer.effectAllowed = "move"; });
  el.addEventListener("dragend", () => { draggedId = null; el.classList.remove("dragging"); document.querySelectorAll(".drag-over").forEach(node => node.classList.remove("drag-over")); });
  el.addEventListener("click", event => { if (el.dataset.dragged === "true") event.preventDefault(); });
  el.addEventListener("contextmenu", event => { event.preventDefault(); showTierMenu(item, event.clientX, event.clientY); });
  el.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const visible = tiers.filter(tier => !tier.hidden), rect = el.getBoundingClientRect();
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) showTierMenu(item, rect.left, rect.bottom + 4);
    else if (event.key === "Delete") removeItem(item);
    else if (event.key === "0") { moveItem(item.id, "pool"); el.focus({preventScroll: true}); }
    else if (/^[1-9]$/.test(event.key) && visible[event.key - 1]) { moveItem(item.id, visible[event.key - 1].id); el.focus({preventScroll: true}); }
    else return;
    event.preventDefault();
  });
  cardElements.set(item.id, el);
  updateNewBadge(item);
  return el;
}

function updateNewBadge(item) {
  const el = cardElements.get(item.id); el?.querySelector(".new-badge")?.remove();
  if (el && item.isNew) { const badge = document.createElement("span"); badge.className = "new-badge"; badge.textContent = "NEW"; el.append(badge); }
}

function closeTierMenu() {
  if (tierMenu?.contains(document.activeElement)) menuOpener?.focus({preventScroll: true});
  tierMenu?.remove(); tierMenu = null;
}

function removeItem(item) {
  if (!confirm(`Удалить «${item.title}» из тир-листа?`)) return;
  pool = pool.filter(value => value.id !== item.id); tiers.forEach(tier => tier.items = tier.items.filter(value => value.id !== item.id)); cardElements.delete(item.id); dirty = true; closeTierMenu(); render();
}

function openItemDialog(item = null) {
  editingItem = item; $("itemForm").reset(); $("itemDialogEyebrow").textContent = item ? "РЕДАКТИРОВАНИЕ" : "НОВЫЙ ЭЛЕМЕНТ"; $("itemDialogTitle").textContent = item ? "Изменить элемент" : "Добавить на доску"; $("itemSubmit").textContent = item ? "Сохранить изменения" : "Добавить элемент";
  if (item) { $("itemTitle").value = item.title; $("itemUrl").value = item.url || ""; $("itemImage").value = item.image || ""; }
  $("itemDialog").showModal();
}

function showTierMenu(item, x, y) {
  closeTierMenu(); menuOpener = cardElements.get(item.id);
  tierMenu = document.createElement("div"); tierMenu.className = "tier-menu"; tierMenu.setAttribute("role", "menu");
  const actions = document.createElement("p"); actions.textContent = "Действия"; tierMenu.append(actions);
  const edit = document.createElement("button"); edit.type = "button"; edit.setAttribute("role", "menuitem"); edit.innerHTML = '<i style="--tier-color:#87a7e8"></i><span>Редактировать</span><b>✎</b>'; edit.addEventListener("click", () => { closeTierMenu(); openItemDialog(item); }); tierMenu.append(edit);
  const mark = document.createElement("button"); mark.type = "button"; mark.setAttribute("role", "menuitem"); mark.innerHTML = `<i style="--tier-color:#f6cf55"></i><span></span><b>${item.isNew ? "✓" : ""}</b>`; mark.querySelector("span").textContent = item.isNew ? "Убрать отметку NEW" : "Отметить как NEW";
  mark.addEventListener("click", () => { item.isNew = !item.isNew; updateNewBadge(item); dirty = true; saveState(); closeTierMenu(); }); tierMenu.append(mark);
  const remove = document.createElement("button"); remove.type = "button"; remove.className = "danger"; remove.setAttribute("role", "menuitem"); remove.innerHTML = '<i style="--tier-color:#f47b6d"></i><span>Удалить</span><b>×</b>'; remove.addEventListener("click", () => removeItem(item)); tierMenu.append(remove);
  const title = document.createElement("p"); title.textContent = "Отправить в тир"; tierMenu.append(title);
  const destinations = [...tiers, {id: "pool", name: "Без категории", color: "#b9b5ac"}], visible = tiers.filter(tier => !tier.hidden);
  destinations.forEach(tier => {
    const button = document.createElement("button"), current = tier.id === "pool" ? pool.some(value => value.id === item.id) : tier.items.some(value => value.id === item.id);
    const key = tier.id === "pool" ? "0" : visible.indexOf(tier) >= 0 && visible.indexOf(tier) < 9 ? String(visible.indexOf(tier) + 1) : "";
    button.type = "button"; button.setAttribute("role", "menuitem"); button.disabled = current;
    button.innerHTML = `<i style="--tier-color:${tier.color}"></i><span></span><b>${current ? "✓" : key}</b>`;
    button.querySelector("span").textContent = tier.name;
    button.addEventListener("click", () => { closeTierMenu(); moveItem(item.id, tier.id); });
    tierMenu.append(button);
  });
  tierMenu.addEventListener("keydown", event => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = [...tierMenu.querySelectorAll("button:not(:disabled)")], index = buttons.indexOf(document.activeElement);
    buttons.at((index + (event.key === "ArrowDown" ? 1 : -1)) % buttons.length)?.focus();
  });
  document.body.append(tierMenu);
  const rect = tierMenu.getBoundingClientRect();
  tierMenu.style.left = `${Math.min(x, innerWidth - rect.width - 8)}px`;
  tierMenu.style.top = `${Math.min(y, innerHeight - rect.height - 8)}px`;
  tierMenu.querySelector("button:not(:disabled)")?.focus({preventScroll: true});
}

function bindZone(zone) {
  zone.addEventListener("dragover", event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", event => { if (!zone.contains(event.relatedTarget)) zone.classList.remove("drag-over"); });
  zone.addEventListener("drop", event => {
    event.preventDefault(); zone.classList.remove("drag-over");
    if (!draggedId) return;
    const before = event.target.closest(".card")?.dataset.id;
    moveItem(draggedId, zone.dataset.zone, before === draggedId ? null : before);
  });
}

function moveItem(id, destination, before) {
  const pageScroll = {x: scrollX, y: scrollY}, poolScroll = $("pool").scrollTop;
  let item;
  pool = pool.filter(value => value.id === id ? (item = value, false) : true);
  tiers.forEach(tier => tier.items = tier.items.filter(value => value.id === id ? (item = value, false) : true));
  if (!item) return;
  const target = destination === "pool" ? pool : tiers.find(tier => tier.id === destination)?.items;
  if (!target) return;
  const index = before ? target.findIndex(value => value.id === before) : -1;
  target.splice(index < 0 ? target.length : index, 0, item); dirty = true;
  const element = cardElements.get(id) || card(item), zone = destination === "pool" ? $("pool") : document.querySelector(`[data-zone="${CSS.escape(destination)}"]`), beforeElement = cardElements.get(before);
  zone.insertBefore(element, beforeElement?.parentElement === zone ? beforeElement : null);
  filterCards(); updateCounts(); saveState();
  const restoreScroll = () => { $("pool").scrollTop = poolScroll; scrollTo(pageScroll.x, pageScroll.y); };
  restoreScroll(); requestAnimationFrame(() => { restoreScroll(); requestAnimationFrame(restoreScroll); });
}

function renderPool() {
  $("pool").replaceChildren(...pool.map(card)); filterCards();
}

function filterCards() {
  const query = $("search").value.trim().toLocaleLowerCase();
  let found = 0;
  cardElements.forEach(element => { element.hidden = !element.dataset.search.includes(query); found += !element.hidden; });
  $("searchCount").hidden = !query; $("searchCount").textContent = `${found} найдено`;
}

function updateCounts() {
  $("emptyPool").hidden = pool.length > 0; $("poolCount").textContent = pool.length;
  $("placedCount").textContent = tiers.reduce((sum, tier) => sum + tier.items.length, 0); $("totalCount").textContent = allItems().length;
  tiers.forEach(tier => { const count = document.querySelector(`[data-tier="${CSS.escape(tier.id)}"] .tier-count`); if (count) count.textContent = tier.items.length || ""; });
}

function render() {
  const hidden = tiers.filter(tier => tier.hidden);
  $("hiddenTiers").hidden = !hidden.length;
  $("hiddenTiers").replaceChildren(...hidden.map(tier => {
    const button = document.createElement("button"); button.type = "button"; button.style.setProperty("--tier-color", tier.color); button.textContent = `Вернуть «${tier.name || "Без имени"}»`; button.setAttribute("aria-label", `Показать тир ${tier.name}`);
    button.addEventListener("click", () => { tier.hidden = false; dirty = true; render(); }); return button;
  }));
  $("tiers").replaceChildren(...tiers.filter(tier => !tier.hidden).map(tier => {
    const row = document.createElement("section"); row.className = "tier"; row.dataset.tier = tier.id;
    const meta = document.createElement("div"); meta.className = "tier-meta"; meta.style.setProperty("--tier-color", tier.color);
    const name = document.createElement("textarea"); name.className = "tier-name"; name.value = tier.name; name.maxLength = 32; name.rows = 2; name.setAttribute("aria-label", "Название тира");
    const fitName = () => name.style.fontSize = `${Math.max(11, 22 - Math.max(0, name.value.length - 4) * .45)}px`; fitName();
    name.addEventListener("keydown", event => { if (event.key === "Enter") event.preventDefault(); });
    name.addEventListener("input", () => { tier.name = name.value; fitName(); dirty = true; saveState(); });
    const controls = document.createElement("div"); controls.className = "tier-controls";
    const visibility = document.createElement("button"); visibility.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c5 0 9 5 9 7a9 9 0 0 1-2.2 3.2M6.6 6.6C4.4 8 3 10.3 3 12c0 2 4 7 9 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'; visibility.title = "Скрыть тир (не попадёт в экспорт)"; visibility.setAttribute("aria-label", `Скрыть тир ${tier.name}`);
    visibility.addEventListener("click", () => { tier.hidden = true; dirty = true; render(); });
    const color = document.createElement("input"); color.type = "color"; color.value = tier.color; color.setAttribute("aria-label", `Цвет тира ${tier.name}`);
    color.addEventListener("input", () => { tier.color = color.value; meta.style.setProperty("--tier-color", tier.color); dirty = true; saveState(); });
    const remove = document.createElement("button"); remove.textContent = "×"; remove.title = "Удалить тир"; remove.setAttribute("aria-label", `Удалить тир ${tier.name}`);
    remove.addEventListener("click", () => { if (tier.items.length && !confirm(`Переместить ${tier.items.length} элементов в «Без категории» и удалить тир?`)) return; pool.push(...tier.items); tiers = tiers.filter(value => value.id !== tier.id); dirty = true; render(); });
    const count = document.createElement("span"); count.className = "tier-count"; count.setAttribute("aria-hidden", "true");
    controls.append(visibility, color, remove); meta.append(count, name, controls);
    const cards = document.createElement("div"); cards.className = "cards drop-zone"; cards.dataset.zone = tier.id; cards.append(...tier.items.map(card)); bindZone(cards);
    row.append(meta, cards); return row;
  }));
  renderPool(); updateCounts();
  const activeIds = new Set(allItems().map(item => item.id));
  cardElements.forEach((element, id) => { if (!activeIds.has(id)) { element.remove(); cardElements.delete(id); } });
  saveState();
}

function parseHtml(text) {
  const doc = new DOMParser().parseFromString(text, "text/html"), found = [];
  const gamePage = doc.querySelector("#game-page-meta[data-game-slug]");
  if (gamePage) {
    const slug = gamePage.dataset.gameSlug, cover = doc.querySelector('meta[property="og:image"]')?.content || "";
    const title = doc.querySelector('.game-cover img[alt], img[src*="/t_cover_big/"][alt]')?.alt || doc.querySelector('meta[property="og:title"]')?.content.replace(/\s*\(\d{4}\)\s*$/, "");
    if (title) return [{title: title.trim(), url: `https://backloggd.com/games/${slug}/`, image: cover.replace("/t_cover_big/", "/t_cover_big_2x/")}];
  }
  doc.querySelectorAll('a[href*="/games/"]').forEach(link => {
    const href = new URL(link.getAttribute("href"), "https://backloggd.com"), parts = href.pathname.split("/").filter(Boolean);
    if (parts.length !== 2 || parts[0] !== "games") return;
    const image = link.querySelector("img") || link.closest(".game-cover")?.querySelector("img");
    const title = image?.alt || link.ariaLabel || link.textContent.trim();
    let imageUrl = image?.dataset.src || image?.getAttribute("src") || "";
    imageUrl = imageUrl.replace("/t_cover_big/", "/t_cover_big_2x/");
    const saved = imageUrl.match(/\/([a-z0-9]+\.(?:jpg|jpeg|png|webp))$/i);
    if (saved && !imageUrl.startsWith("http")) imageUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${saved[1]}`;
    if (title) found.push({title: title.replace(/^Cover of /i, "").trim(), url: href.href, image: imageUrl});
  });
  return found;
}

function parseCsv(text) {
  const rows = []; let row = [], value = "", quoted = false;
  for (let i = 0; i <= text.length; i++) {
    const char = text[i] || "\n";
    if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i++; row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (!rows.length) return [];
  const headers = rows.shift().map(value => value.replace(/^\ufeff/, "").trim().toLocaleLowerCase());
  const column = names => headers.findIndex(header => names.includes(header));
  const title = column(["игра", "название", "title", "game", "name"]), url = column(["ссылка_backloggd", "ссылка", "url", "link"]), image = column(["обложка", "image", "cover", "image_url"]);
  return rows.map(row => ({title: row[title >= 0 ? title : 1]?.trim(), url: row[url]?.trim() || "", image: row[image]?.trim() || ""})).filter(item => item.title);
}

async function importFiles(files) {
  $("status").textContent = `Читаем файлов: ${files.length}…`;
  let imported = [];
  for (const file of files) {
    const text = await file.text(), name = file.name.toLocaleLowerCase();
    if (name.endsWith(".json")) {
      const data = JSON.parse(text);
      if (!Array.isArray(data.tiers) || !Array.isArray(data.pool)) throw new Error("Это не проект Tiermaker.");
      tiers = data.tiers.map(tier => ({...tier, id: tier.id || crypto.randomUUID(), items: uniqueItems(tier.items || [])})); pool = uniqueItems(data.pool); cardElements.clear(); dirty = false; render();
      $("status").textContent = `Проект восстановлен · ${allItems().length} элементов`; return;
    }
    imported.push(...(name.endsWith(".csv") ? parseCsv(text) : parseHtml(text)));
  }
  const known = new Set(allItems().map(item => item.url || `${item.title}|${item.image}`));
  const fresh = uniqueItems(imported).filter(item => !known.has(item.url || `${item.title}|${item.image}`)); pool.push(...fresh); dirty = fresh.length > 0;
  $("status").textContent = fresh.length ? `Добавлено: ${fresh.length} · пропущено дублей: ${imported.length - fresh.length}` : "Новых элементов не найдено"; render();
}

async function handleFiles(files) {
  try { await importFiles(files); }
  catch (error) { $("status").textContent = `Не удалось импортировать: ${error.message}`; }
}

function download(name, blob) {
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function drawTierName(ctx, text, width, y, height) {
  const words = (text.trim() || "Без имени").split(/\s+/); let lines = [], fontSize = 22;
  for (; fontSize >= 10; fontSize--) {
    ctx.font = `900 ${fontSize}px system-ui`; lines = [];
    words.forEach(word => {
      if (!lines.length) return lines.push(word);
      const candidate = `${lines.at(-1)} ${word}`;
      if (ctx.measureText(candidate).width > width - 16) lines.push(word); else lines[lines.length - 1] = candidate;
    });
    if (lines.length <= 3 && lines.every(line => ctx.measureText(line).width <= width - 16)) break;
  }
  const lineHeight = fontSize * .95, top = y + (height - lines.length * lineHeight) / 2 + lineHeight / 2;
  lines.forEach((line, index) => ctx.fillText(line, width / 2, top + index * lineHeight, width - 16));
}

async function exportImage(format) {
  if (!allItems().length) return $("status").textContent = "Сначала добавьте элементы.";
  const exportedTiers = tiers.filter(tier => !tier.hidden);
  if (!exportedTiers.length) return $("status").textContent = "Все тиры скрыты из экспорта.";
  const formats = {png: {id: "exportPng", mime: "image/png", name: "tier-list.png", label: "PNG"}, jpg: {id: "exportJpg", mime: "image/jpeg", name: "tier-list.jpg", label: "JPG · Discord", quality: .9}, webp: {id: "exportWebp", mime: "image/webp", name: "tier-list.webp", label: "WebP", quality: .9}}, selected = formats[format];
  const buttons = Object.values(formats).map(value => $(value.id)); buttons.forEach(button => button.disabled = true); $(selected.id).textContent = "Готовим…";
  const width = 1800, scale = 2, labelWidth = 120, cellSize = 92, gutter = 1, tileSize = cellSize - gutter * 2, cols = Math.floor((width - labelWidth) / cellSize);
  const newItems = exportedTiers.flatMap(tier => tier.items.filter(item => item.isNew).map(item => ({...item, tierName: tier.name, tierColor: tier.color}))), newIndexes = new Map(newItems.map((item, index) => [item.id, index + 1]));
  const panelCols = 8, panelRowHeight = 236, panelHeight = newItems.length ? 80 + Math.ceil(newItems.length / panelCols) * panelRowHeight : 0;
  const heights = exportedTiers.map(tier => Math.max(1, Math.ceil(tier.items.length / cols)) * cellSize), height = panelHeight + heights.reduce((sum, value) => sum + value, 0);
  const canvas = $("exportCanvas"), ctx = canvas.getContext("2d"); canvas.width = width * scale; canvas.height = height * scale; ctx.scale(scale, scale); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.fillStyle = "#f1eee7"; ctx.fillRect(0, 0, width, height);
  if (newItems.length) {
    ctx.fillStyle = "#191916"; ctx.fillRect(0, 0, width, panelHeight); ctx.fillStyle = "#ff2f70"; ctx.font = "1000 30px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(`НОВЫЕ ИГРЫ · ${newItems.length}`, 28, 38);
    for (let index = 0; index < newItems.length; index++) {
      const item = newItems[index], cardX = 10 + index % panelCols * 222.5, cardY = 70 + Math.floor(index / panelCols) * panelRowHeight, coverX = cardX + 41, image = new Image();
      try {
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = exportCover(item.image); });
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight), sx = (image.naturalWidth - sourceSize) / 2, sy = (image.naturalHeight - sourceSize) / 2;
        ctx.drawImage(image, sx, sy, sourceSize, sourceSize, coverX, cardY, 128, 128);
      } catch { ctx.fillStyle = "#dedad1"; ctx.fillRect(coverX, cardY, 128, 128); }
      ctx.strokeStyle = "#ff2f70"; ctx.lineWidth = 6; ctx.strokeRect(coverX + 3, cardY + 3, 122, 122); ctx.fillStyle = "#ff2f70"; ctx.beginPath(); ctx.arc(coverX + 16, cardY + 16, 16, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#191916"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "1000 14px system-ui"; ctx.textAlign = "center"; ctx.fillText(String(index + 1), coverX + 16, cardY + 17); ctx.font = "800 17px system-ui"; ctx.fillText(item.title, cardX + 105, cardY + 150, 205);
      // Плашка тира в его цвете — видно издалека, куда попала игра
      const tierLabel = item.tierName.trim() || "Без имени"; ctx.font = "900 20px system-ui";
      const chipWidth = Math.min(205, Math.max(48, ctx.measureText(tierLabel).width + 28));
      ctx.fillStyle = item.tierColor; ctx.beginPath(); ctx.roundRect(cardX + 105 - chipWidth / 2, cardY + 166, chipWidth, 34, 6); ctx.fill();
      ctx.fillStyle = "#191916"; ctx.fillText(tierLabel, cardX + 105, cardY + 184, chipWidth - 16);
    }
  }
  let y = panelHeight;
  for (let t = 0; t < exportedTiers.length; t++) {
    const tier = exportedTiers[t], rowH = heights[t]; ctx.fillStyle = tier.color; ctx.fillRect(0, y, labelWidth, rowH); ctx.fillStyle = "#191916"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    drawTierName(ctx, tier.name, labelWidth, y, rowH); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#faf8f3"; ctx.fillRect(labelWidth, y, width - labelWidth, rowH);
    for (let index = 0; index < tier.items.length; index++) {
      const item = tier.items[index];
      const x = labelWidth + index % cols * cellSize, iy = y + Math.floor(index / cols) * cellSize, image = new Image();
      try {
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = exportCover(item.image); });
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight), sx = (image.naturalWidth - sourceSize) / 2, sy = (image.naturalHeight - sourceSize) / 2;
        ctx.drawImage(image, sx, sy, sourceSize, sourceSize, x + gutter, iy + gutter, tileSize, tileSize);
      } catch { ctx.fillStyle = "#dedad1"; ctx.fillRect(x + gutter, iy + gutter, tileSize, tileSize); }
      const newIndex = newIndexes.get(item.id);
      // Если есть новинки, остальные обложки приглушаются, чтобы новые было видно сразу
      if (!newIndex && newItems.length) { ctx.fillStyle = "rgba(250,248,243,.62)"; ctx.fillRect(x + gutter, iy + gutter, tileSize, tileSize); }
      if (newIndex) {
        ctx.save(); ctx.strokeStyle = "#ff2f70"; ctx.lineWidth = 7; ctx.strokeRect(x + 4, iy + 4, cellSize - 8, cellSize - 8); ctx.fillStyle = "#ff2f70"; ctx.beginPath(); ctx.arc(x + 22, iy + 22, 20, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#191916"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#fff"; ctx.font = "1000 19px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(newIndex), x + 22, iy + 23); ctx.restore();
      }
    }
    y += rowH;
  }
  canvas.toBlob(blob => { if (blob) download(selected.name, blob); else $("status").textContent = `Браузер не поддерживает экспорт ${selected.label}.`; buttons.forEach(button => button.disabled = false); $(selected.id).textContent = selected.label; }, selected.mime, selected.quality);
}

const restored = restoreState();
bindZone($("pool")); render();
if (restored) $("status").textContent = `Прогресс восстановлен · ${allItems().length} элементов`;
$("fileInput").addEventListener("change", event => { const files = [...event.target.files]; event.target.value = ""; handleFiles(files); });
$("fileDrop").addEventListener("dragover", event => { event.preventDefault(); $("fileDrop").classList.add("over"); });
$("fileDrop").addEventListener("dragleave", () => $("fileDrop").classList.remove("over"));
$("fileDrop").addEventListener("drop", event => { event.preventDefault(); $("fileDrop").classList.remove("over"); handleFiles([...event.dataTransfer.files]); });
$("search").addEventListener("input", filterCards);
$("sortTiers").addEventListener("click", () => {
  if (!confirm("Отсортировать игры по алфавиту внутри каждого тира? Текущий порядок изменится.")) return;
  tiers.forEach(tier => {
    tier.items.sort((a, b) => titleOrder.compare(a.title, b.title));
    document.querySelector(`[data-zone="${CSS.escape(tier.id)}"]`)?.append(...tier.items.map(card));
  });
  dirty = true; saveState(); $("status").textContent = "Игры внутри тиров отсортированы по названию.";
});
$("addTier").addEventListener("click", () => { tiers.push({id: crypto.randomUUID(), name: "Новый", color: "#c9c4f5", items: []}); dirty = true; render(); });
$("addItem").addEventListener("click", () => openItemDialog());
$("itemForm").addEventListener("submit", event => { if (event.submitter?.value === "cancel") return; event.preventDefault(); const values = {title: $("itemTitle").value.trim(), url: $("itemUrl").value.trim(), image: $("itemImage").value.trim()}; if (editingItem) { Object.assign(editingItem, values); cardElements.delete(editingItem.id); } else pool.push({id: crypto.randomUUID(), ...values}); dirty = true; event.target.reset(); $("itemDialog").close(); render(); });
$("itemDialog").addEventListener("click", event => { if (event.target === $("itemDialog")) $("itemDialog").close(); });
$("itemDialog").addEventListener("close", () => { editingItem = null; });
$("clearBoard").addEventListener("click", () => { if (!allItems().length || confirm("Удалить все элементы с доски?")) { tiers.forEach(tier => tier.items = []); pool = []; dirty = true; render(); } });
$("saveSession").addEventListener("click", () => { download("tier-list.tierlist.json", new Blob([JSON.stringify({version: 1, tiers, pool}, null, 2)], {type: "application/json"})); dirty = false; });
$("exportPng").addEventListener("click", () => exportImage("png"));
$("exportJpg").addEventListener("click", () => exportImage("jpg"));
$("exportWebp").addEventListener("click", () => exportImage("webp"));
addEventListener("pointerdown", event => { if (!tierMenu?.contains(event.target)) closeTierMenu(); });
addEventListener("scroll", closeTierMenu, true);
addEventListener("keydown", event => { if (event.key === "Escape") closeTierMenu(); });
addEventListener("keydown", event => {
  const mod = event.ctrlKey || event.metaKey, typing = event.target.closest?.("input, textarea, [contenteditable]"), code = event.code;
  if (mod && code === "KeyS") { event.preventDefault(); $("saveSession").click(); return; }
  if (mod && code === "KeyK") { event.preventDefault(); $("search").focus(); $("search").select(); return; }
  if (typing || mod || event.altKey || $("itemDialog").open) return;
  if (event.key === "/") { event.preventDefault(); $("search").focus(); $("search").select(); }
  else if (code === "KeyN") { event.preventDefault(); openItemDialog(); }
  else if (code === "KeyT") { event.preventDefault(); $("addTier").click(); }
});
$("search").addEventListener("keydown", event => { if (event.key === "Escape" && !event.target.value) event.target.blur(); });
// Файлы можно бросить в любое место страницы, а не только в зону импорта
let fileDragDepth = 0;
const hasFiles = event => event.dataTransfer?.types.includes("Files");
addEventListener("dragenter", event => { if (hasFiles(event)) { fileDragDepth++; document.body.classList.add("file-over"); } });
addEventListener("dragleave", event => { if (hasFiles(event) && --fileDragDepth <= 0) { fileDragDepth = 0; document.body.classList.remove("file-over"); } });
addEventListener("dragover", event => { if (hasFiles(event)) event.preventDefault(); });
addEventListener("drop", event => {
  if (!hasFiles(event)) return;
  fileDragDepth = 0; document.body.classList.remove("file-over"); event.preventDefault();
  if (!$("fileDrop").contains(event.target)) handleFiles([...event.dataTransfer.files]);
});
addEventListener("beforeunload", event => { if (dirty) event.preventDefault(); });
