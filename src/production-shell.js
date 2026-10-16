const main = document.querySelector("#main");
const topbar = document.querySelector(".topbar");
const topbarActions = document.querySelector(".topbar-actions");

if (main && topbar && topbarActions && !document.querySelector("#kitchai-mode-switcher")) {
  const originalNodes = [...main.children];
  const shell = document.createElement("div");
  shell.className = "kitchai-shell";
  shell.innerHTML = `
    <aside class="kitchai-drawer" id="kitchai-drawer" aria-label="KitchAI navigation" hidden>
      <div class="kitchai-drawer-heading"><strong id="kitchai-drawer-title">AI Mode</strong><button class="kitchai-icon-button" id="kitchai-drawer-close" type="button" aria-label="Close navigation">×</button></div>
      <nav id="kitchai-navigation" aria-label="Main navigation"></nav>
      <p class="kitchai-drawer-note">KitchAI · Local-first workspace</p>
    </aside>
    <div class="kitchai-workspace">
      <section id="kitchai-ai-screen" class="kitchai-ai-screen" aria-labelledby="kitchai-ai-title">
        <div class="kitchai-ai-intro"><div class="kitchai-ai-mark" aria-hidden="true">✦</div><p class="kitchai-eyebrow">KITCHAI ASSISTANT</p><h1 id="kitchai-ai-title">How can I help your business?</h1><p class="kitchai-muted">Ask about your kitchen workflow, ingredients, production, or daily operations.</p></div>
        <div class="kitchai-disconnected" role="status"><span aria-hidden="true">ⓘ</span><div><strong>AI service not connected</strong><p>This interface is ready for integration, but messages are not sent and no AI responses are generated yet.</p></div></div>
        <form class="kitchai-chat-composer" id="kitchai-chat-composer">
          <label class="kitchai-sr-only" for="kitchai-chat-input">Message KitchAI</label>
          <textarea id="kitchai-chat-input" rows="1" placeholder="AI chat is coming soon…" disabled></textarea>
          <button type="submit" disabled aria-label="Send message">↑</button>
        </form>
        <p class="kitchai-chat-disclaimer">AI Mode · Coming Soon</p>
      </section>
      <section id="kitchai-manage-screen" class="kitchai-manage-screen" aria-label="Manage Mode" hidden>
        <div class="kitchai-manage-heading"><div><p class="kitchai-eyebrow">MANAGE MODE</p><h1 id="kitchai-manage-title">Overview</h1></div><p id="kitchai-manage-description">Your workspace and existing business workflows.</p></div>
        <div id="kitchai-manage-content" class="kitchai-manage-content"></div>
        <section id="kitchai-coming-soon" class="kitchai-coming-soon" hidden><span aria-hidden="true">◷</span><p class="kitchai-eyebrow">COMING SOON</p><h2 id="kitchai-coming-title">Coming soon</h2><p id="kitchai-coming-description">This workflow is not implemented yet. No sample records or totals are shown.</p></section>
      </section>
    </div>`;
  const manageContent = shell.querySelector("#kitchai-manage-content");
  originalNodes.forEach((node) => manageContent.append(node));
  main.append(shell);
  main.classList.add("kitchai-shell-root");

  const switcher = document.createElement("div");
  switcher.className = "kitchai-mode-switcher";
  switcher.id = "kitchai-mode-switcher";
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", "Switch mode");
  switcher.innerHTML = '<button type="button" data-mode="ai" aria-pressed="true">AI Mode</button><button type="button" data-mode="manage" aria-pressed="false">Manage Mode</button>';
  const drawerButton = document.createElement("button");
  drawerButton.type = "button";
  drawerButton.id = "kitchai-drawer-toggle";
  drawerButton.className = "kitchai-icon-button";
  drawerButton.setAttribute("aria-label", "Open navigation");
  drawerButton.setAttribute("aria-controls", "kitchai-drawer");
  drawerButton.textContent = "☰";
  topbarActions.prepend(switcher, drawerButton);

  const nav = shell.querySelector("#kitchai-navigation");
  const drawer = shell.querySelector("#kitchai-drawer");
  const aiScreen = shell.querySelector("#kitchai-ai-screen");
  const manageScreen = shell.querySelector("#kitchai-manage-screen");
  const manageTitle = shell.querySelector("#kitchai-manage-title");
  const manageDescription = shell.querySelector("#kitchai-manage-description");
  const comingSoon = shell.querySelector("#kitchai-coming-soon");
  const comingTitle = shell.querySelector("#kitchai-coming-title");
  const comingDescription = shell.querySelector("#kitchai-coming-description");
  const drawerTitle = shell.querySelector("#kitchai-drawer-title");
  const aiIntro = shell.querySelector(".kitchai-ai-intro");
  const aiComposer = shell.querySelector("#kitchai-chat-composer");
  const aiDisclaimer = shell.querySelector(".kitchai-chat-disclaimer");
  const aiPlaceholder = document.createElement("section");
  aiPlaceholder.className = "kitchai-coming-soon";
  aiPlaceholder.hidden = true;
  aiPlaceholder.innerHTML = '<span aria-hidden="true">◷</span><p class="kitchai-eyebrow">COMING SOON</p><h2 id="kitchai-ai-placeholder-title">Chat History</h2><p id="kitchai-ai-placeholder-description">Chat history is not implemented yet; no conversations are stored by this interface.</p>';
  aiScreen.append(aiPlaceholder);
  const modeButtons = [...switcher.querySelectorAll("[data-mode]")];

  const sections = [
    { id: "overview", label: "Overview", mode: "manage", description: "Your workspace and existing business workflows.", selectors: [".welcome", ".status-grid", ".offline-panel"] },
    { id: "business-profile", label: "Business Profile", group: "Settings", mode: "manage", description: "Manage your local business profile.", selectors: [".profile-editor:has(#profile-form)"] },
    { id: "data-sync", label: "Data & Sync", group: "Settings", mode: "manage", description: "Account connection, sync status, and conflict review.", selectors: ["#auth-panel", "#entity-sync-panel"] },
    { id: "ingredients", label: "Ingredients & Stock", group: "Business", mode: "manage", description: "Maintain ingredients and review physical stock counts.", selectors: ["#ingredient-panel", "#stock-count-panel"] },
    { id: "purchases", label: "Purchases", group: "Business", mode: "manage", description: "Record purchase drafts and review receipts.", selectors: ["#purchase-panel"] },
    { id: "menu-recipes", label: "Menu & Recipes", group: "Business", mode: "manage", description: "Manage menu items, recipes, and ingredient lines.", selectors: ["#menu-panel", "#recipe-panel"] },
    { id: "production", label: "Production", group: "Business", mode: "manage", description: "Create batches and record actual ingredient usage.", selectors: ["#production-panel"] },
    { id: "finished-food", label: "Finished Food", group: "Business", mode: "manage", description: "Review finished lots and record safe stock dispositions.", selectors: ["#finished-stock-panel"] },
    { id: "sales", label: "Sales", group: "Business", mode: "manage", coming: true, description: "Sales entry and revenue records are not implemented yet." },
    { id: "business-expenses", label: "Business Expenses", group: "Business", mode: "manage", coming: true, description: "Business expense entry is not implemented yet." },
    { id: "day-closing", label: "Day Closing", group: "Business", mode: "manage", coming: true, description: "Daily reconciliation requires sales and expense workflows first." },
    { id: "personal-overview", label: "Personal Overview", group: "Personal", mode: "manage", coming: true, description: "Personal finance is not implemented yet." },
    { id: "personal-income", label: "Income", group: "Personal", mode: "manage", coming: true, description: "Personal income records are not implemented yet." },
    { id: "personal-expenses", label: "Expenses", group: "Personal", mode: "manage", coming: true, description: "Personal expense records are not implemented yet." },
    { id: "personal-accounts", label: "Accounts", group: "Personal", mode: "manage", coming: true, description: "Personal accounts are not implemented yet." },
    { id: "personal-assets", label: "Assets & Debts", group: "Personal", mode: "manage", coming: true, description: "Personal assets and debts are not implemented yet." },
    { id: "reports", label: "Reports", group: "Main", mode: "manage", coming: true, description: "Reports will use saved records only when reporting definitions are implemented." },
    { id: "general-settings", label: "General", group: "Settings", mode: "manage", coming: true, description: "General app settings are not implemented yet." },
    { id: "appearance-settings", label: "Appearance", group: "Settings", mode: "manage", coming: true, description: "Appearance settings are not implemented yet." },
    { id: "language-settings", label: "Language", group: "Settings", mode: "manage", coming: true, description: "Language settings are not implemented yet." },
    { id: "ai-preferences", label: "AI Preferences", group: "Settings", mode: "manage", coming: true, description: "AI preferences are not implemented yet." },
    { id: "security-settings", label: "Security", group: "Settings", mode: "manage", coming: true, description: "Additional security settings are not implemented yet." },
    { id: "about", label: "About KitchAI", group: "Settings", mode: "manage", coming: true, description: "Product information page is not implemented yet." },
    { id: "ai-history", label: "Chat History", group: "AI", mode: "ai", coming: true, description: "Chat history is not implemented yet; no conversations are stored by this interface." },
    { id: "ai-settings", label: "AI Settings", group: "AI", mode: "ai", coming: true, description: "AI settings are not implemented yet." }
  ];

  let mode = "ai";
  let activePage = "overview";
  const elementBySelector = new Map();
  for (const page of sections) {
    page.elements = (page.selectors || []).map((selector) => {
      const element = manageContent.querySelector(selector);
      if (element) elementBySelector.set(selector, element);
      return element;
    }).filter(Boolean);
  }
  const originalDisplay = new Map();
  for (const page of sections) for (const element of page.elements) {
    if (!originalDisplay.has(element)) originalDisplay.set(element, element.hidden);
  }
  const footer = manageContent.querySelector(".page-footer");

  function buildNavigation() {
    nav.replaceChildren();
    const groups = mode === "ai"
      ? [{ heading: "Chats", ids: ["new-chat", "search-chats", "ai-history"] }, { heading: "Preferences", ids: ["ai-settings"] }]
      : [
          { heading: "Workspace", ids: ["overview"] },
          { heading: "Business", ids: ["ingredients", "purchases", "menu-recipes", "production", "finished-food", "sales", "business-expenses", "day-closing"] },
          { heading: "Personal", ids: ["personal-overview", "personal-income", "personal-expenses", "personal-accounts", "personal-assets"] },
          { heading: "Reports", ids: ["reports"] },
          { heading: "Settings", ids: ["general-settings", "appearance-settings", "language-settings", "business-profile", "data-sync", "ai-preferences", "security-settings", "about"] }
        ];
    const labels = { "new-chat": "＋ New Chat", "search-chats": "Search Chats" };
    for (const group of groups) {
      const heading = document.createElement("p");
      heading.className = "kitchai-nav-group";
      heading.textContent = group.heading;
      nav.append(heading);
      for (const id of group.ids) {
        const page = sections.find((candidate) => candidate.id === id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "kitchai-nav-item";
        button.textContent = labels[id] || page?.label || id;
        button.dataset.page = id;
        button.setAttribute("aria-current", activePage === id && ((mode === "ai") === (id.startsWith("ai-") || id === "search-chats" || id === "new-chat")) ? "page" : "false");
        nav.append(button);
      }
    }
  }

  function renderPage(pageId) {
    const page = sections.find((candidate) => candidate.id === pageId);
    if (!page) return;
    activePage = pageId;
    manageTitle.textContent = page.label;
    manageDescription.textContent = page.description || "";
    comingSoon.hidden = !page.coming;
    comingTitle.textContent = page.label;
    comingDescription.textContent = page.description || "This workflow is not implemented yet.";
    for (const element of originalNodes) {
      if (element === footer) continue;
      element.hidden = true;
    }
    for (const element of page.elements) element.hidden = false;
    if (footer) footer.hidden = false;
    if (page.coming) {
      for (const element of originalNodes) if (element !== footer) element.hidden = true;
    }
    buildNavigation();
    if (window.matchMedia("(max-width: 760px)").matches) closeDrawer();
  }

  function setMode(nextMode) {
    if (nextMode !== "ai" && nextMode !== "manage") return;
    mode = nextMode;
    aiScreen.hidden = mode !== "ai";
    manageScreen.hidden = mode !== "manage";
    modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
    drawerButton.setAttribute("aria-label", mode === "ai" ? "Open AI navigation" : "Open Manage navigation");
    drawerTitle.textContent = mode === "ai" ? "AI Mode" : "Manage Mode";
    buildNavigation();
    if (mode === "manage") renderPage(activePage);
    else closeDrawer();
  }

  function openDrawer() {
    drawer.hidden = false;
    drawerButton.setAttribute("aria-expanded", "true");
  }
  function closeDrawer() {
    drawer.hidden = true;
    drawerButton.setAttribute("aria-expanded", "false");
  }

  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page],button[data-action]");
    if (!button) return;
    if (button.dataset.page === "new-chat") {
      shell.querySelector("#kitchai-chat-input").value = "";
      aiIntro.hidden = false;
      aiComposer.hidden = false;
      aiDisclaimer.hidden = false;
      aiPlaceholder.hidden = true;
      closeDrawer();
      return;
    }
    if (button.dataset.page === "search-chats" || button.dataset.page === "ai-history" || button.dataset.page === "ai-settings") {
      const title = button.dataset.page === "search-chats" ? "Search Chats" : sections.find((page) => page.id === button.dataset.page).label;
      const description = button.dataset.page === "search-chats"
        ? "Chat search is not implemented yet."
        : sections.find((page) => page.id === button.dataset.page).description;
      aiIntro.hidden = true;
      aiComposer.hidden = true;
      aiDisclaimer.hidden = true;
      aiPlaceholder.querySelector("#kitchai-ai-placeholder-title").textContent = title;
      aiPlaceholder.querySelector("#kitchai-ai-placeholder-description").textContent = description;
      aiPlaceholder.hidden = false;
      closeDrawer();
      return;
    }
    renderPage(button.dataset.page);
  });

  switcher.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (button) setMode(button.dataset.mode);
  });
  drawerButton.addEventListener("click", () => drawer.hidden ? openDrawer() : closeDrawer());
  shell.querySelector("#kitchai-drawer-close").addEventListener("click", closeDrawer);
  shell.querySelector("#kitchai-chat-composer").addEventListener("submit", (event) => event.preventDefault());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !drawer.hidden) closeDrawer();
  });

  let touchStart = null;
  main.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) { touchStart = null; return; }
    const target = event.target;
    if (target.closest("input,textarea,select,button,a,[contenteditable=true],.kitchai-drawer")) { touchStart = null; return; }
    const touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  main.addEventListener("touchend", (event) => {
    if (!touchStart || event.changedTouches.length !== 1) { touchStart = null; return; }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    setMode(dx < 0 ? "manage" : "ai");
  }, { passive: true });

  buildNavigation();
  setMode("ai");
}
