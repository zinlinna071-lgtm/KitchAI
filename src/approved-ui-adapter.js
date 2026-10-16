/* Production adapter for the approved KitchAI UI. Does not replace business workflows. */
const main = document.querySelector("#main");
const topbar = document.querySelector(".topbar");
const topbarActions = document.querySelector(".topbar-actions");

if (main && topbar && topbarActions && !document.querySelector("#kitchai-mode-switcher")) {
  const originalNodes = [...main.children];
  const appShell = document.createElement("div");
  appShell.className = "app-shell";
  appShell.innerHTML = `
    <aside class="sidebar" id="sidebar" aria-label="KitchAI navigation">
      <div class="sidebar-top">
        <a class="brand" href="#ai" aria-label="KitchAI home"><span class="brand-mark">K</span><span class="brand-name">KitchAI</span></a>
        <button class="icon-button sidebar-close" id="sidebar-close" type="button" aria-label="Close navigation">×</button>
      </div>
      <div class="sidebar-content" id="sidebar-content"></div>
      <div class="sidebar-bottom"><div class="sidebar-footnote"><span class="status-dot"></span><span><b>KitchAI UI v1.1.0</b><small>Draft · local-first workspace</small></span></div></div>
    </aside>
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    <div class="main-column" id="kitchai-main-column"></div>`;
  const sidebar = appShell.querySelector("#sidebar");
  const sidebarContent = appShell.querySelector("#sidebar-content");
  const backdrop = appShell.querySelector("#sidebar-backdrop");
  const mainColumn = appShell.querySelector("#kitchai-main-column");
  const sidebarBottom = appShell.querySelector(".sidebar-bottom");
  const body = document.body;
  body.insertBefore(appShell, body.querySelector(".footer") || body.lastElementChild);
  mainColumn.append(topbar, main);
  topbar.querySelector(".brand")?.remove();
  topbar.classList.add("approved-ui-topbar");
  const menuButton = document.createElement("button");
  menuButton.className = "icon-button menu-toggle";
  menuButton.id = "menu-toggle";
  menuButton.dataset.kitchaiDrawerToggle = "true";
  menuButton.type = "button";
  menuButton.setAttribute("aria-label", "Open AI navigation");
  menuButton.textContent = "☰";

  const switcher = document.createElement("div");
  switcher.className = "mode-switch topbar-mode-switch";
  switcher.id = "kitchai-mode-switcher";
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", "Choose mode");
  switcher.innerHTML = '<button class="mode-button active" data-mode="ai" aria-pressed="true"><span class="mode-icon">✳</span><span>AI Mode</span></button><button class="mode-button" data-mode="manage" aria-pressed="false"><span class="mode-icon">▦</span><span>Manage Mode</span></button>';
  topbar.prepend(menuButton, switcher);

  const themeButton = document.createElement("button");
  themeButton.className = "icon-button compact-theme";
  themeButton.id = "theme-toggle";
  themeButton.type = "button";
  themeButton.setAttribute("aria-label", "Toggle light and dark theme");
  themeButton.textContent = "◐";
  const languageSelect = document.createElement("select");
  languageSelect.id = "kitchai-language-select";
  languageSelect.setAttribute("aria-label", "Interface language");
  languageSelect.innerHTML = '<option value="en">EN</option><option value="my">မြန်မာ</option><option value="th">ไทย</option>';
  const profileButton = document.createElement("button");
  profileButton.id = "kitchai-profile-button";
  profileButton.type = "button";
  profileButton.setAttribute("aria-label", "User profile");
  profileButton.title = "User profile";
  profileButton.textContent = "K";
  topbarActions.prepend(themeButton, languageSelect, profileButton);
  const connectionStatus = document.querySelector("#connection-status");
  if (connectionStatus) sidebarBottom.append(connectionStatus);

  const chatScreen = document.createElement("section");
  chatScreen.id = "kitchai-ai-screen";
  chatScreen.className = "chat-screen";
  chatScreen.innerHTML = `
    <div class="chat-welcome"><div class="ai-orb" aria-hidden="true">✳</div><h1>How can I help you today?</h1><p>AI connections are not enabled in this version yet.</p></div>
    <div class="chat-bottom">
      <div class="prompt-chips"><button type="button" data-prompt="sales">Sales</button><button type="button" data-prompt="stock">Ingredients &amp; stock</button><button type="button" data-prompt="expenses">Expenses</button><button type="button" data-prompt="production">Production</button></div>
      <form id="kitchai-chat-composer" class="chat-composer"><textarea id="kitchai-chat-input" rows="1" placeholder="Ask about sales, stock, expenses, or production…" aria-label="Message KitchAI"></textarea><div class="composer-bottom"><span class="composer-hint">KitchAI · AI is not connected yet</span><button class="send-button" type="submit" aria-label="Send message">↑</button></div></form>
      <p class="disclaimer">Preview of the AI experience · Messages are not sent to an AI service.</p>
    </div>
    <section id="kitchai-ai-placeholder" class="page-content" hidden><div class="page-head"><div><p class="eyebrow">AI MODE</p><h1 id="kitchai-ai-placeholder-title">AI Settings</h1><p id="kitchai-ai-placeholder-description" class="page-subtitle">This page is not implemented yet.</p></div><span class="status">Coming soon</span></div><div class="empty-panel"><b>Coming soon</b><p>AI settings and chat history are not active yet. No messages or settings are saved by this screen.</p></div></section>`;
  const manageScreen = document.createElement("section");
  manageScreen.id = "kitchai-manage-screen";
  manageScreen.className = "page-content";
  manageScreen.hidden = true;
  manageScreen.innerHTML = '<div class="page-head"><div><p class="eyebrow">MANAGE MODE</p><h1 id="kitchai-manage-title">Overview</h1><p id="kitchai-manage-description" class="page-subtitle">Your workspace and existing business workflows.</p></div></div><div id="kitchai-settings-home" class="settings-grid" hidden><button class="settings-row" type="button" data-settings-page="general-settings"><span class="settings-icon">⚙</span><span><b>General</b><small>Coming soon</small></span><span class="arrow">›</span></button><button class="settings-row" type="button" data-settings-page="appearance-settings"><span class="settings-icon">◐</span><span><b>Appearance</b><small>Use the theme control in the top bar</small></span><span class="arrow">›</span></button><button class="settings-row" type="button" data-settings-page="language-settings"><span class="settings-icon">文</span><span><b>Language</b><small>Full translation is not implemented yet</small></span><span class="arrow">›</span></button><button class="settings-row" type="button" data-settings-page="business-profile"><span class="settings-icon">▦</span><span><b>Business Profile</b><small>Edit your saved local business profile</small></span><span class="arrow">›</span></button><button class="settings-row" type="button" data-settings-page="data-sync"><span class="settings-icon">↻</span><span><b>Data &amp; Sync</b><small>Account connection and sync state</small></span><span class="arrow">›</span></button><button class="settings-row" type="button" data-settings-page="ai-preferences"><span class="settings-icon">✳</span><span><b>AI Preferences</b><small>Coming soon</small></span><span class="arrow">›</span></button><button class="settings-row" type="button" data-settings-page="security-settings"><span class="settings-icon">◇</span><span><b>Security</b><small>Coming soon</small></span><span class="arrow">›</span></button><button class="settings-row" type="button" data-settings-page="about"><span class="settings-icon">ⓘ</span><span><b>About KitchAI</b><small>Product information</small></span><span class="arrow">›</span></button></div><div id="kitchai-manage-content"></div><section id="kitchai-settings-note" class="empty-panel" hidden><b></b><p></p></section><section id="kitchai-coming-soon" class="empty-panel" hidden><span class="empty-symbol">◷</span><b id="kitchai-coming-title">Coming soon</b><p id="kitchai-coming-description">This workflow is not implemented yet. No sample records or totals are shown.</p></section>';
  const manageContent = manageScreen.querySelector("#kitchai-manage-content");
  originalNodes.forEach(node => manageContent.append(node));
  main.replaceChildren(chatScreen, manageScreen);
  main.classList.remove("page-shell");
  main.classList.add("approved-ui-main");
  const legacyFooter = manageContent.querySelector(".page-footer");

  const pageDefinitions = [
    { id:"overview", label:"Overview", group:"Workspace", description:"Your workspace and existing business workflows.", selectors:[".welcome",".status-grid",".offline-panel"] },
    { id:"business-overview", label:"Business", group:"Business", description:"Manage business records and operational workflows.", selectors:[".welcome",".status-grid",".offline-panel"] },
    { id:"sales", label:"Sales", group:"Business", coming:true, description:"Sales entry is not implemented yet." },
    { id:"purchases", label:"Purchases", group:"Business", description:"Record purchase drafts and review receipts.", selectors:["#purchase-panel"] },
    { id:"ingredients", label:"Ingredients & Stock", group:"Business", description:"Manage ingredients and physical stock counts.", selectors:["#ingredient-panel","#stock-count-panel"] },
    { id:"recipes", label:"Menu & Recipes", group:"Business", description:"Manage menu items, recipes, and recipe lines.", selectors:["#menu-panel","#recipe-panel"] },
    { id:"production", label:"Production", group:"Business", description:"Plan batches and record actual ingredient usage.", selectors:["#production-panel"] },
    { id:"finished", label:"Finished Food", group:"Business", description:"Track finished lots and safe stock dispositions.", selectors:["#finished-stock-panel"] },
    { id:"business-expenses", label:"Business Expenses", group:"Business", coming:true, description:"Business expense entry is not implemented yet." },
    { id:"day-closing", label:"Day Closing", group:"Business", coming:true, description:"Day closing needs sales and expense reconciliation first." },
    { id:"personal-overview", label:"Personal", group:"Personal", coming:true, description:"Personal finance will remain separate from business records." },
    { id:"income", label:"Income", group:"Personal", coming:true, description:"Personal income records are not implemented yet." },
    { id:"personal-expenses", label:"Expenses", group:"Personal", coming:true, description:"Personal expense records are not implemented yet." },
    { id:"accounts", label:"Accounts", group:"Personal", coming:true, description:"Personal accounts are not implemented yet." },
    { id:"assets-debts", label:"Assets & Debts", group:"Personal", coming:true, description:"Personal assets and debts are not implemented yet." },
    { id:"reports", label:"Reports", group:"Main", coming:true, description:"Reports will use real saved records when implemented." },
    { id:"business-profile", label:"Business Profile", group:"Settings", description:"Edit your local business profile.", selectors:[".profile-editor:has(#profile-form)"] },
    { id:"data-sync", label:"Data & Sync", group:"Settings", description:"Account connection, sync status, and conflict review.", selectors:["#auth-panel","#entity-sync-panel","#conflict-panel"] },
    { id:"app-settings", label:"App Settings", group:"Settings", description:"General app preferences and workspace settings." },
    { id:"general-settings", label:"General", group:"Settings", coming:true, description:"General app settings are not implemented yet." },
    { id:"appearance-settings", label:"Appearance", group:"Settings", description:"Theme can be changed using the top-bar theme control." },
    { id:"language-settings", label:"Language", group:"Settings", coming:true, description:"Full interface translation is not implemented yet." },
    { id:"ai-preferences", label:"AI Preferences", group:"Settings", coming:true, description:"AI preferences are not implemented yet." },
    { id:"security-settings", label:"Security", group:"Settings", coming:true, description:"Additional security settings are not implemented yet." },
    { id:"about", label:"About KitchAI", group:"Settings", coming:true, description:"Product information is not implemented yet." },
    { id:"ai-settings", label:"AI Settings", group:"AI", coming:true, description:"AI settings are not implemented yet." },
    { id:"chat-history", label:"Chat History", group:"AI", coming:true, description:"Chat history is not implemented yet; no conversations are stored." }
  ];
  let mode = "ai";
  let activeAIPage = "ai";
  let activeManagePage = "overview";
  const modeButtons = [...switcher.querySelectorAll("[data-mode]")];
  const hiddenOriginalNodes = originalNodes.filter(node => node !== legacyFooter);
  const nodeStates = new Map(hiddenOriginalNodes.map(node => [node, node.hidden]));

  function closeDrawer() {
    sidebar.classList.remove("open");
    backdrop.classList.remove("visible");
  }
  function openDrawer() {
    sidebar.classList.add("open");
    backdrop.classList.add("visible");
  }
  function renderNavigation() {
    sidebarContent.replaceChildren();
    const addItem = (label, id, icon, active) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sidebar-link nav-item" + (active ? " active" : "");
      button.dataset.page = id;
      button.innerHTML = '<span class="nav-icon" aria-hidden="true">' + icon + '</span><span></span>';
      button.lastElementChild.textContent = label;
      if (active) button.setAttribute("aria-current","page");
      sidebarContent.append(button);
    };
    const addGroup = (label) => {
      const heading = document.createElement("div");
      heading.className = "nav-section-label";
      heading.textContent = label;
      sidebarContent.append(heading);
    };
    if (mode === "ai") {
      addItem("New Chat","new-chat","＋",activeAIPage==="ai");
      addItem("Search Chats","search-chats","⌕",activeAIPage==="search-chats");
      addGroup("Recent chats");
      const empty = document.createElement("div");
      empty.className = "empty-history";
      empty.textContent = "Your conversations will appear here.";
      sidebarContent.append(empty);
      addItem("AI Settings","ai-settings","⚙",activeAIPage==="ai-settings");
    } else {
      addGroup("Workspace"); addItem("Overview","overview","⌂",activeManagePage==="overview");
      addGroup("Business");
      for (const p of pageDefinitions.filter(x=>x.group==="Business")) addItem(p.label,p.id,"▦",activeManagePage===p.id);
      addGroup("Personal");
      for (const p of pageDefinitions.filter(x=>x.group==="Personal")) addItem(p.label,p.id,"♙",activeManagePage===p.id);
      addItem("Reports","reports","▥",activeManagePage==="reports");
      addGroup("More");
      for (const id of ["app-settings","data-sync","about"]) {
        const p = pageDefinitions.find(x=>x.id===id);
        addItem(p.label,p.id,"⚙",activeManagePage===p.id);
      }
    }
  }
  function showAIPage(id) {
    activeAIPage = id;
    const isChat = id === "ai";
    chatScreen.querySelector(".chat-welcome").hidden = !isChat;
    chatScreen.querySelector(".chat-bottom").hidden = !isChat;
    const placeholder = chatScreen.querySelector("#kitchai-ai-placeholder");
    placeholder.hidden = isChat;
    const title = id === "search-chats" ? "Search Chats" : id === "chat-history" ? "Chat History" : "AI Settings";
    chatScreen.querySelector("#kitchai-ai-placeholder-title").textContent = title;
    chatScreen.querySelector("#kitchai-ai-placeholder-description").textContent = id === "search-chats" ? "Chat search is not implemented yet." : id === "chat-history" ? "Chat history is not implemented yet; no conversations are stored." : "AI settings are not implemented yet.";
    renderNavigation();
  }
  function showPage(id) {
    const page = pageDefinitions.find(p=>p.id===id);
    if (!page) return;
    activeManagePage = id;
    manageScreen.hidden = false;
    chatScreen.hidden = true;
    manageScreen.querySelector("#kitchai-manage-title").textContent = page.label;
    manageScreen.querySelector("#kitchai-manage-description").textContent = page.description || "";
    const coming = manageScreen.querySelector("#kitchai-coming-soon");
    coming.hidden = !page.coming;
    manageScreen.querySelector("#kitchai-coming-title").textContent = page.label + (page.coming ? " · Coming Soon" : "");
    manageScreen.querySelector("#kitchai-coming-description").textContent = page.description || "This workflow is not implemented yet.";
    hiddenOriginalNodes.forEach(node => { node.hidden = true; });
    const settingsHome = manageScreen.querySelector("#kitchai-settings-home");
    settingsHome.hidden = id !== "app-settings";
    const settingsNote = manageScreen.querySelector("#kitchai-settings-note");
    settingsNote.hidden = !(page.group === "Settings" && !page.coming && id !== "app-settings" && !(page.selectors || []).length);
    settingsNote.querySelector("b").textContent = page.label;
    settingsNote.querySelector("p").textContent = page.description || "Settings for this section will be added here.";
    for (const selector of page.selectors || []) {
      const element = manageContent.querySelector(selector);
      if (element) element.hidden = false;
    }
    if (legacyFooter) legacyFooter.hidden = false;
    if (page.coming) hiddenOriginalNodes.forEach(node => { node.hidden = true; });
    renderNavigation();
    if (window.matchMedia("(max-width:680px)").matches) closeDrawer();
  }
  function setMode(nextMode) {
    mode = nextMode === "manage" ? "manage" : "ai";
    modeButtons.forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    });
    menuButton.setAttribute("aria-label", mode === "ai" ? "Open AI navigation" : "Open Manage navigation");
    if (mode === "ai") {
      chatScreen.hidden = false;
      manageScreen.hidden = true;
      showAIPage(activeAIPage);
    } else showPage(activeManagePage);
    renderNavigation();
    if (mode === "ai") closeDrawer();
  }

  menuButton.addEventListener("click",openDrawer);
  sidebar.querySelector("#sidebar-close").addEventListener("click",closeDrawer);
  backdrop.addEventListener("click",closeDrawer);
  switcher.addEventListener("click",event=>{
    const button = event.target instanceof Element ? event.target.closest("[data-mode]") : null;
    if (button) setMode(button.dataset.mode);
  });
  sidebarContent.addEventListener("click",event=>{
    const button = event.target instanceof Element ? event.target.closest("[data-page]") : null;
    if (!button) return;
    const id = button.dataset.page;
    if (id==="new-chat") { activeAIPage="ai"; setMode("ai"); const input=chatScreen.querySelector("#kitchai-chat-input"); input.value=""; closeDrawer(); return; }
    if (id==="search-chats" || id==="ai-settings" || id==="chat-history") { activeAIPage=id; setMode("ai"); closeDrawer(); return; }
    setMode("manage"); showPage(id);
  });
  manageScreen.querySelector("#kitchai-settings-home").addEventListener("click",event=>{
    const button = event.target instanceof Element ? event.target.closest("[data-settings-page]") : null;
    if (button) showPage(button.dataset.settingsPage);
  });
  themeButton.addEventListener("click",()=>{
    document.body.classList.toggle("dark");
    localStorage.setItem("kitchai-ui-theme",document.body.classList.contains("dark")?"dark":"light");
  });
  languageSelect.addEventListener("change",()=>{
    showToast("Full interface translation is not implemented yet.");
  });
  profileButton.addEventListener("click",()=>{
    showToast("Profile and account controls are available in Business Profile and Data & Sync.");
  });
  if (localStorage.getItem("kitchai-ui-theme")==="dark") document.body.classList.add("dark");
  chatScreen.querySelector("#kitchai-chat-composer").addEventListener("submit",event=>{
    event.preventDefault();
    const input=chatScreen.querySelector("#kitchai-chat-input");
    if (input.value.trim()) showToast("AI is not connected yet. Your message was not sent.");
  });
  chatScreen.querySelectorAll("[data-prompt]").forEach(button=>button.addEventListener("click",()=>{
    const input=chatScreen.querySelector("#kitchai-chat-input");
    input.value=button.dataset.prompt==="sales"?"Please summarize today's sales.":button.dataset.prompt==="stock"?"Please check ingredient stock.":button.dataset.prompt==="expenses"?"Please summarize expenses.":"Please show production status.";
    input.focus();
  }));
  let touchStart=null;
  main.addEventListener("touchstart",event=>{
    if(event.touches.length!==1){touchStart=null;return;}
    const target=event.target;
    if(!(target instanceof Element)||target.closest("input,textarea,select,button,a,[contenteditable=true],.sidebar,.prompt-chips")){touchStart=null;return;}
    touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  main.addEventListener("touchend",event=>{
    if(!touchStart||event.changedTouches.length!==1){touchStart=null;return;}
    const dx=event.changedTouches[0].clientX-touchStart.x,dy=event.changedTouches[0].clientY-touchStart.y;touchStart=null;
    if(Math.abs(dx)<52||Math.abs(dx)<Math.abs(dy)*1.12)return;
    setMode(mode==="ai"?"manage":"ai");
  },{passive:true});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeDrawer();});
  function showToast(message) {
    let toast=document.querySelector("#toast");
    if(!toast){toast=document.createElement("div");toast.id="toast";toast.className="toast";toast.setAttribute("role","status");toast.setAttribute("aria-live","polite");document.body.append(toast);}
    toast.textContent=message;toast.classList.add("visible");
    window.setTimeout(()=>toast.classList.remove("visible"),2600);
  }
  renderNavigation();
  setMode("ai");
}
