(() => {
  "use strict";

  const DATA_ROOT = "./delta-zurich-brazil/";
  const NOTE_RELEVANCE_KEY = "platform-upgrade-note-relevance-v1";
  const elements = Object.fromEntries([
    "sourceStatus", "datasetCaption", "productCount", "currentProductMetric", "visibleCount", "searchInput", "noteRelevanceFilter", "productList", "catalogMessage", "reader", "footerStatus", "brazilMode", "deltaMode"
  ].map(id => [id, document.getElementById(id)]));
  const state = { mode: "brazil", products: [], installedApplications: [], noteSuggestions: new Map(), selectedSlug: "serviceportal", currentCanonical: "", pageToken: 0, cache: new Map(), pendingReads: new Map(), searchableText: new Map(), noteRelevance: loadNoteRelevance(), markdownLoading: false, markdownFailures: 0 };

  function loadNoteRelevance() {
    try {
      const value = JSON.parse(localStorage.getItem(NOTE_RELEVANCE_KEY));
      return value && !Array.isArray(value) && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function parseCatalog(markdown) {
    const pattern = /\[([^\]]+)\]\(https?:\/\/raw\.githubusercontent\.com\/ServiceNow\/ServiceNowDocs\/[^)\s]+\/([^/]+-release-notes\.md)\)/g;
    const products = [];
    const seen = new Set();
    let match;
    while ((match = pattern.exec(markdown))) {
      const file = decodeURIComponent(match[2]);
      if (seen.has(file)) continue;
      seen.add(file);
      const name = match[1].replace(/\\([()])/g, "$1").replace(/^Combined\s+/i, "").replace(/\s+release notes for upgrades from Zurich to Brazil\s*$/i, "").replace(/\s+/g, " ").trim();
      products.push({ name, file, slug: slugify(file.replace(/^brazil-zurich-/, "").replace(/-release-notes\.md$/, "")) });
    }
    return products.sort((left, right) => left.name.localeCompare(right.name));
  }

  async function readMarkdown(file) {
    if (state.cache.has(file)) return state.cache.get(file);
    if (state.pendingReads.has(file)) return state.pendingReads.get(file);
    const request = (async () => {
      const response = await fetch(`${DATA_ROOT}${encodeURIComponent(file)}`);
      if (!response.ok) throw new Error(`Could not read ${file} (${response.status})`);
      const markdown = await response.text();
      state.cache.set(file, markdown);
      return markdown;
    })();
    state.pendingReads.set(file, request);
    try { return await request; }
    finally { state.pendingReads.delete(file); }
  }

  function stripFrontmatter(markdown) {
    const text = markdown.replace(/^\uFEFF/, "");
    if (!text.startsWith("---")) return text;
    const closing = text.indexOf("\n---", 3);
    return closing < 0 ? text : text.slice(closing + 4).trim();
  }

  function getMetadata(markdown) {
    const frontmatter = markdown.startsWith("---") ? markdown.slice(0, markdown.indexOf("\n---", 3)) : "";
    return {
      canonical: frontmatter.match(/^canonical_url:\s*(https?:\/\/[^\s]+)\s*$/m)?.[1] || "",
      updated: frontmatter.match(/^last_updated:\s*["']?([^\n"']+)/m)?.[1]?.trim() || ""
    };
  }

  function safeHtmlTable(table) {
    const allowed = new Set(["TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD", "P", "DIV", "SPAN", "A", "STRONG", "B", "EM", "I", "CODE", "BR", "UL", "OL", "LI", "SUP", "SUB"]);
    const protectedTable = table.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);
    const parsed = new DOMParser().parseFromString(protectedTable, "text/html");
    const copy = (node, inCell = false, transformText = true) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue || "";
        if (inCell && transformText && /(?:^|\n)\s*[-*+]\s+|`[^`]+`|\[[^\n]+\]\(https?:\/\/|\*\*/m.test(text)) {
          const rendered = renderMarkdown(text).html;
          const fragment = document.createDocumentFragment();
          if (rendered) {
            const content = new DOMParser().parseFromString(rendered, "text/html");
            for (const child of content.body.childNodes) fragment.append(document.importNode(child, true));
          }
          return fragment;
        }
        return document.createTextNode(text);
      }
      if (node.nodeType !== Node.ELEMENT_NODE || !allowed.has(node.tagName)) return document.createDocumentFragment();
      const result = document.createElement(node.tagName.toLowerCase());
      const childInCell = inCell || node.tagName === "TD" || node.tagName === "TH";
      if (node.tagName === "A" && /^https:\/\//i.test(node.getAttribute("href") || "")) {
        result.href = node.getAttribute("href");
        result.target = "_blank";
        result.rel = "noopener noreferrer";
      }
      if (["TH", "TD"].includes(node.tagName)) {
        for (const key of ["colspan", "rowspan"]) if (/^\d{1,2}$/.test(node.getAttribute(key) || "")) result.setAttribute(key, node.getAttribute(key));
      }
      for (const child of node.childNodes) result.append(copy(child, childInCell, transformText));
      return result;
    };
    const wrapper = document.createElement("div");
    for (const child of parsed.body.childNodes) wrapper.append(copy(child));
    return wrapper.innerHTML;
  }

  function inline(text) {
    let html = escapeHtml(text).replace(/\\_/g, "_");
    const codeSpans = [];
    html = html.replace(/`([^`]+)`/g, (_, code) => {
      const token = `INLINE_CODE_${codeSpans.length}_TOKEN`;
      codeSpans.push(code);
      return token;
    });
    html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+[^)]*)?\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/\[((?:\\.|[^\]])+)\]\((https?:\/\/[^\s)]+)(?:\s+[^)]*)?\)/g, (_, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label.replace(/\\([\[\]])/g, "$1")}</a>`);
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
    codeSpans.forEach((code, index) => { html = html.replace(`INLINE_CODE_${index}_TOKEN`, `<code>${code}</code>`); });
    return html;
  }

  function cells(line) {
    return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
  }

  function formatFeatureLists(markup) {
    const parsed = new DOMParser().parseFromString(markup, "text/html");
    const lists = [...parsed.body.querySelectorAll("ul")];
    const hasLinkedTitle = item => Boolean(item.querySelector("strong a"));
    for (const list of lists) {
      const items = [...list.children].filter(child => child.tagName === "LI");
      if (!items.length || !items.every(hasLinkedTitle)) continue;
      list.classList.add("feature-note-list");
      items.forEach(item => item.classList.add("feature-note-item"));
      if (items.length !== 1) continue;
      const description = parsed.createElement("div");
      description.className = "feature-note-description";
      let next = list.nextElementSibling;
      while (next?.tagName === "P") {
        const paragraph = parsed.createElement("span");
        paragraph.className = "feature-note-paragraph";
        while (next.firstChild) paragraph.append(next.firstChild);
        description.append(paragraph);
        next.remove();
        next = list.nextElementSibling;
      }
      if (description.childNodes.length) items[0].append(description);
    }
    for (const list of [...parsed.body.querySelectorAll("ul.feature-note-list")]) {
      let next = list.nextElementSibling;
      while (next?.matches("ul.feature-note-list")) {
        while (next.firstElementChild) list.append(next.firstElementChild);
        next.remove();
        next = list.nextElementSibling;
      }
    }
    for (const item of parsed.body.querySelectorAll(".feature-note-item")) {
      const link = item.querySelector("strong a");
      if (!link || item.querySelector(".feature-note-actions")) continue;
      const title = link.textContent.trim();
      const description = item.querySelector(".feature-note-description");
      const summary = (description?.textContent || item.textContent.replace(title, "")).replace(/\s+/g, " ").trim();
      const actions = parsed.createElement("div");
      actions.className = "feature-note-actions";
      const button = parsed.createElement("button");
      button.type = "button";
      button.className = "feature-note-add";
      button.dataset.teamBriefAdd = "feature";
      button.dataset.noteSlug = state.selectedSlug;
      button.dataset.briefTitle = title;
      button.dataset.briefSummary = summary;
      button.dataset.briefUrl = link.href;
      button.textContent = "Save for team";
      actions.append(button);
      item.append(actions);
    }
    return parsed.body.innerHTML;
  }

  function renderMarkdown(markdown) {
    const rawTables = [];
    const prepared = stripFrontmatter(markdown).replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, table => {
      const token = `LOCAL_TABLE_${rawTables.length}_END`;
      rawTables.push(safeHtmlTable(table));
      return `\n\n${token}\n\n`;
    });
    const html = [];
    const sections = [];
    const normalized = prepared.replace(/([^\r\n])\s+-\s+(?=\*\*\[)/g, "$1\n- ");
    const lines = normalized.split(/\r?\n/);
    let paragraph = [];
    let list = "";
    const flushParagraph = () => {
      if (paragraph.length) html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    };
    const closeList = () => { if (list) html.push(`</${list}>`); list = ""; };
    const closeText = () => { flushParagraph(); closeList(); };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const tableToken = line.match(/^LOCAL_TABLE_(\d+)_END$/);
      if (tableToken) { closeText(); html.push(`<div class="table-wrap">${rawTables[Number(tableToken[1])]}</div>`); continue; }
      const heading = line.match(/^(#{1,6})\s+(.+?)\s*#?\s*$/);
      if (heading) {
        closeText();
        const level = heading[1].length;
        const title = heading[2].replace(/\s*\{#[^}]+\}\s*$/, "").trim();
        const id = slugify(title);
        if (level === 2) sections.push({ title, id });
        html.push(`<h${level} id="${id}">${inline(title)}</h${level}>`);
        continue;
      }
      if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] || "")) {
        closeText();
        const header = cells(line);
        index += 1;
        const rows = [];
        while (/^\s*\|/.test(lines[index + 1] || "")) rows.push(cells(lines[++index]));
        html.push(`<div class="table-wrap"><table><thead><tr>${header.map(cell => `<th scope="col">${inline(cell)}</th>`).join("")}</tr></thead><tbody>`);
        for (const row of rows) html.push(`<tr>${header.map((_, cellIndex) => `<td>${inline(row[cellIndex] || "")}</td>`).join("")}</tr>`);
        html.push("</tbody></table></div>");
        continue;
      }
      const item = line.match(/^\s*([-*+] |\d+\. )(.*)$/);
      if (item) {
        flushParagraph();
        const type = /^\s*\d+\./.test(line) ? "ol" : "ul";
        if (list !== type) { closeList(); html.push(`<${type}>`); list = type; }
        html.push(`<li>${inline(item[2])}</li>`);
        continue;
      }
      if (!line.trim()) { closeText(); continue; }
      paragraph.push(line.trim());
    }
    closeText();
    return { html: formatFeatureLists(html.join("\n")), sections };
  }

  function renderCatalog() {
    const query = elements.searchInput.value.trim().toLowerCase();
    const relevance = elements.noteRelevanceFilter.value;
    const filtered = state.products.filter(product => {
      const status = state.noteRelevance[product.slug] || "unreviewed";
      const matches = state.noteSuggestions.get(product.slug) || [];
      return `${product.name} ${product.file} ${state.searchableText.get(product.slug) || ""}`.toLowerCase().includes(query)
        && (relevance === "all" || relevance === "suggested" && matches.length > 0 || relevance === status);
    });
    elements.visibleCount.textContent = String(filtered.length);
    elements.productList.innerHTML = filtered.map(product => {
      const status = state.noteRelevance[product.slug] || "unreviewed";
      const matches = state.noteSuggestions.get(product.slug) || [];
      const matchNames = [...new Set(matches.map(app => app.name))];
      const matchSummary = matchNames.length ? `${matchNames.length} exact app name${matchNames.length === 1 ? "" : "s"}: ${matchNames.slice(0, 2).join(", ")}${matchNames.length > 2 ? ` +${matchNames.length - 2}` : ""}` : "";
      return `<li><button class="product-button${product.slug === state.selectedSlug ? " active" : ""}" type="button" data-product="${escapeHtml(product.slug)}" aria-current="${product.slug === state.selectedSlug ? "page" : "false"}">${escapeHtml(product.name)}${matchSummary ? `<small class="inventory-match">${escapeHtml(matchSummary)}</small>` : ""}<small class="relevance-${status}">${relevanceLabel(product.slug)}</small></button></li>`;
    }).join("");
    if (!filtered.length) {
      const message = relevance === "suggested" && !state.installedApplications.length
        ? "Import installed apps in Applications to see exact-name suggestions. All platform notes remain in All areas."
        : "No areas match this search and relevance filter. All platform notes remain available under All areas.";
      elements.productList.innerHTML = `<li class="reader-empty">${escapeHtml(message)}</li>`;
    }
    if (relevance === "suggested") {
      elements.catalogMessage.textContent = state.installedApplications.length
        ? "Suggestions use exact installed-app name or title matches only. Review each note and mark it relevant yourself."
        : "Import installed apps in Applications to calculate exact-name suggestions. No notes are hidden from All areas.";
      elements.catalogMessage.hidden = false;
    } else if (!state.markdownFailures) {
      elements.catalogMessage.hidden = true;
    }
  }

  function normalizedAppName(value) {
    return String(value || "").replace(/^'+/, "").toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function buildNoteSuggestions() {
    const appsByName = new Map();
    for (const app of state.installedApplications) {
      for (const value of [app.name, app.title]) {
        const key = normalizedAppName(value);
        if (!key) continue;
        if (!appsByName.has(key)) appsByName.set(key, new Map());
        appsByName.get(key).set(app.scope || app.name, app);
      }
    }
    state.noteSuggestions = new Map(state.products.map(product => {
      const matches = appsByName.get(normalizedAppName(product.name));
      return [product.slug, matches ? [...matches.values()] : []];
    }));
    renderCatalog();
  }

  function relevanceLabel(slug) {
    const status = state.noteRelevance[slug] || "unreviewed";
    return status === "relevant" ? "Relevant to this instance" : status === "not-relevant" ? "Marked not relevant" : "Not reviewed";
  }

  function relevanceControl(slug) {
    const status = state.noteRelevance[slug] || "unreviewed";
    const product = state.products.find(item => item.slug === slug);
    return `<div class="note-relevance-control" data-relevance-control="${escapeHtml(slug)}"><span class="note-relevance-status">${relevanceLabel(slug)}</span><div class="note-relevance-segment" role="group" aria-label="Relevance to this instance"><button type="button" data-note-relevance="unreviewed" data-note-slug="${escapeHtml(slug)}" aria-pressed="${status === "unreviewed"}">Not reviewed</button><button type="button" data-note-relevance="relevant" data-note-slug="${escapeHtml(slug)}" aria-pressed="${status === "relevant"}">Relevant to us</button><button type="button" data-note-relevance="not-relevant" data-note-slug="${escapeHtml(slug)}" aria-pressed="${status === "not-relevant"}">Not relevant</button></div><button type="button" class="note-area-brief-add" data-team-brief-add="area" data-note-slug="${escapeHtml(slug)}" data-brief-title="${escapeHtml(product?.name || slug)}" data-brief-summary="Review ${escapeHtml(product?.name || slug)} release notes for the Zurich-to-Brazil upgrade." data-brief-url="${escapeHtml(state.currentCanonical)}">Save area for team</button></div>`;
  }

  function setNoteRelevance(slug, status) {
    if (!state.products.some(product => product.slug === slug)) return;
    state.noteRelevance[slug] = status;
    try { localStorage.setItem(NOTE_RELEVANCE_KEY, JSON.stringify(state.noteRelevance)); } catch { elements.footerStatus.textContent = "Relevance saved for this tab only; browser storage unavailable"; }
    renderCatalog();
    const current = elements.reader.querySelector(`[data-relevance-control="${slug}"]`);
    if (current) current.outerHTML = relevanceControl(slug);
  }

  function setMode(mode) {
    state.mode = mode;
    for (const button of [elements.brazilMode, elements.deltaMode]) {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    }
    elements.datasetCaption.textContent = mode === "delta" ? "Original markdown from the local Delta archive" : "Formatted Zurich-to-Brazil release notes";
    if (state.products.length) selectProduct(state.selectedSlug);
  }

  async function selectProduct(slug) {
    const product = state.products.find(item => item.slug === slug) || state.products[0];
    if (!product) return;
    state.selectedSlug = product.slug;
    const token = ++state.pageToken;
    location.hash = `${state.mode}/${product.slug}`;
    renderCatalog();
    elements.currentProductMetric.textContent = product.name;
    elements.reader.innerHTML = '<div class="reader-loading"><span class="loader" aria-hidden="true"></span><span>Loading release notes</span></div>';
    try {
      let markdown = state.cache.get(product.file);
      if (!markdown) { markdown = await readMarkdown(product.file); state.cache.set(product.file, markdown); }
      if (token !== state.pageToken) return;
      state.searchableText.set(product.slug, stripFrontmatter(markdown));
      const metadata = getMetadata(markdown);
      state.currentCanonical = metadata.canonical;
      const sourceLink = `${DATA_ROOT}${encodeURIComponent(product.file)}`;
      if (state.mode === "delta") {
        elements.reader.innerHTML = `<header class="reader-header"><div class="reader-overline"><span>Delta markdown</span><span>${metadata.updated ? `Updated ${escapeHtml(metadata.updated)}` : "Zurich · Australia · Brazil"}</span></div><h2>${escapeHtml(product.name)}</h2><p class="reader-summary">Original source file: <code>${escapeHtml(product.file)}</code></p><div class="reader-toolbar">${metadata.canonical ? `<a href="${escapeHtml(metadata.canonical)}" target="_blank" rel="noopener noreferrer">Open on ServiceNow ↗</a>` : ""}<a href="${escapeHtml(sourceLink)}" target="_blank" rel="noopener noreferrer">Open local markdown file ↗</a>${relevanceControl(product.slug)}</div></header><pre class="source-markdown">${escapeHtml(markdown)}</pre>`;
      } else {
        const rendered = renderMarkdown(markdown);
        const title = stripFrontmatter(markdown).match(/^#\s+(.+)$/m)?.[1]?.replace(/\s*\{#[^}]+\}\s*$/, "") || `Combined ${product.name} release notes from Zurich to Brazil`;
        const sectionNav = rendered.sections.map(section => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`).join("");
        elements.reader.innerHTML = `<header class="reader-header"><div class="reader-overline"><span>Brazil release notes</span><span>${metadata.updated ? `Updated ${escapeHtml(metadata.updated)}` : "Zurich · Australia · Brazil"}</span></div><h2>${escapeHtml(title)}</h2><p class="reader-summary">Consolidated release notes for ${escapeHtml(product.name)} from Zurich to Brazil.</p><div class="reader-toolbar">${metadata.canonical ? `<a href="${escapeHtml(metadata.canonical)}" target="_blank" rel="noopener noreferrer">Open on ServiceNow ↗</a>` : ""}<a href="${escapeHtml(sourceLink)}" target="_blank" rel="noopener noreferrer">View source markdown ↗</a>${relevanceControl(product.slug)}</div></header>${sectionNav ? `<nav class="section-nav" aria-label="Release note sections">${sectionNav}</nav>` : ""}<div class="markdown-body">${rendered.html}</div>`;
      }
      elements.sourceStatus.textContent = state.markdownLoading ? "Loading local Markdown files" : state.markdownFailures ? `${state.markdownFailures} Markdown files unavailable` : "Local markdown ready";
      elements.sourceStatus.previousElementSibling.classList.toggle("error", Boolean(state.markdownFailures));
      renderCatalog();
    } catch (error) {
      if (token === state.pageToken) {
        elements.reader.innerHTML = `<div class="reader-error"><strong>Could not load this release note.</strong><span>${escapeHtml(error.message)}</span><button id="retryLoad" type="button">Retry</button></div>`;
        document.getElementById("retryLoad").addEventListener("click", () => selectProduct(state.selectedSlug));
      }
    }
  }

  async function preloadMarkdownFolder() {
    const files = [...new Set(["index.md", "rn-combined-intro.md", ...state.products.map(product => product.file)])];
    const productsByFile = new Map(state.products.map(product => [product.file, product]));
    const failures = [];
    let nextIndex = 0;
    let completed = 0;
    const loadNext = async () => {
      while (nextIndex < files.length) {
        const file = files[nextIndex];
        nextIndex += 1;
        try {
          const markdown = await readMarkdown(file);
          const product = productsByFile.get(file);
          if (product) state.searchableText.set(product.slug, stripFrontmatter(markdown));
        } catch (error) {
          failures.push({ file, message: error.message });
        }
        completed += 1;
        if (completed % 12 === 0 || completed === files.length) {
          elements.sourceStatus.textContent = `Loading Markdown ${completed} of ${files.length}`;
          elements.footerStatus.textContent = `Loading local Markdown ${completed} of ${files.length}`;
        }
      }
    };
    elements.sourceStatus.textContent = "Loading local Markdown files";
    elements.footerStatus.textContent = `Loading local Markdown 0 of ${files.length}`;
    await Promise.all(Array.from({ length: Math.min(8, files.length) }, () => loadNext()));
    state.markdownLoading = false;
    state.markdownFailures = failures.length;
    renderCatalog();
    if (failures.length) {
      elements.sourceStatus.textContent = `${failures.length} Markdown files unavailable`;
      elements.sourceStatus.previousElementSibling.classList.add("error");
      elements.footerStatus.textContent = `Loaded ${files.length - failures.length} of ${files.length} Markdown files`;
      elements.catalogMessage.textContent = `Could not load ${failures.map(item => item.file).join(", ")}. Confirm all files listed in delta-zurich-brazil/index.md are present.`;
      elements.catalogMessage.hidden = false;
    } else {
      elements.sourceStatus.textContent = "Local markdown ready";
      elements.sourceStatus.previousElementSibling.classList.remove("error");
      elements.footerStatus.textContent = `All ${files.length} local Markdown files loaded`;
    }
  }

  async function initialize() {
    const hash = location.hash.match(/^#(brazil|delta)\/([a-z0-9-]+)$/);
    if (hash) { state.mode = hash[1]; state.selectedSlug = hash[2]; }
    setMode(state.mode);
    try {
      const [folderIndex, catalog] = await Promise.all([readMarkdown("index.md"), readMarkdown("rn-combined-intro.md")]);
      const indexedProducts = parseCatalog(folderIndex);
      const catalogProducts = parseCatalog(catalog);
      const allProducts = new Map(indexedProducts.map(product => [product.file, product]));
      catalogProducts.forEach(product => allProducts.set(product.file, product));
      state.products = [...allProducts.values()].sort((left, right) => left.name.localeCompare(right.name));
      buildNoteSuggestions();
      if (!state.products.length) throw new Error("No products were linked from rn-combined-intro.md.");
      window.dispatchEvent(new CustomEvent("platform-catalog-ready", { detail: { products: state.products } }));
      elements.productCount.textContent = String(state.products.length);
      elements.catalogMessage.hidden = true;
      state.markdownLoading = true;
      elements.footerStatus.textContent = "Loading local Markdown folder";
      elements.sourceStatus.textContent = "Loading local Markdown files";
      const selected = state.products.find(product => product.slug === state.selectedSlug);
      state.selectedSlug = selected?.slug || state.products.find(product => product.slug === "serviceportal")?.slug || state.products[0].slug;
      renderCatalog();
      await selectProduct(state.selectedSlug);
      await preloadMarkdownFolder();
    } catch (error) {
      elements.sourceStatus.textContent = "Local markdown unavailable";
      elements.sourceStatus.previousElementSibling.classList.add("error");
      elements.catalogMessage.textContent = `Could not load the local catalog: ${error.message}. Confirm delta-zurich-brazil/rn-combined-intro.md is present.`;
      elements.catalogMessage.hidden = false;
      elements.footerStatus.textContent = "Catalog unavailable";
      elements.reader.innerHTML = '<div class="reader-empty">No local release catalog is available.</div>';
    }
  }

  elements.brazilMode.addEventListener("click", () => setMode("brazil"));
  elements.deltaMode.addEventListener("click", () => setMode("delta"));
  elements.searchInput.addEventListener("input", renderCatalog);
  elements.noteRelevanceFilter.addEventListener("change", renderCatalog);
  elements.reader.addEventListener("click", event => {
    const button = event.target.closest("[data-note-relevance]");
    if (button) setNoteRelevance(button.dataset.noteSlug, button.dataset.noteRelevance);
  });
  elements.productList.addEventListener("click", event => {
    const button = event.target.closest("[data-product]");
    if (button) selectProduct(button.dataset.product);
  });
  window.addEventListener("hashchange", () => {
    const hash = location.hash.match(/^#(brazil|delta)\/([a-z0-9-]+)$/);
    if (!hash) return;
    if (hash[1] !== state.mode) setMode(hash[1]);
    if (hash[2] !== state.selectedSlug) selectProduct(hash[2]);
  });
  window.addEventListener("platform-note-open", event => {
    const product = state.products.find(item => item.slug === event.detail?.slug);
    if (!product) return;
    if (state.mode !== "brazil") setMode("brazil");
    selectProduct(product.slug);
  });
  window.addEventListener("platform-note-relevance-update", event => {
    if (["relevant", "not-relevant"].includes(event.detail?.status)) setNoteRelevance(event.detail.slug, event.detail.status);
  });
  window.addEventListener("platform-note-relevance-restore", event => {
    const values = event.detail?.values;
    if (!values || typeof values !== "object" || Array.isArray(values)) return;
    state.noteRelevance = values;
    try { localStorage.setItem(NOTE_RELEVANCE_KEY, JSON.stringify(values)); } catch { /* Relevance remains available until this tab closes. */ }
    renderCatalog();
    const current = elements.reader.querySelector(`[data-relevance-control="${state.selectedSlug}"]`);
    if (current) current.outerHTML = relevanceControl(state.selectedSlug);
  });
  window.addEventListener("platform-installed-apps-ready", event => {
    state.installedApplications = Array.isArray(event.detail?.apps) ? event.detail.apps : [];
    buildNoteSuggestions();
  });
  initialize();
})();