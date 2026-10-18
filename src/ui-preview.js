/* KitchAI shared application shell. Page workflows are added only from confirmed requirements. */
(() => {
  const $ = (selector) => document.querySelector(selector);
  const modeButtons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll("[data-mode]")]);
  const pageContent = $("#page-content");
  const sidebarContent = $("#sidebar-content");
  const sidebar = $("#sidebar");
  const backdrop = $("#sidebar-backdrop");
  const languageSelect = $("#language-select");
  const themeToggle = $("#theme-toggle");
  const menuToggle = $("#menu-toggle");
  const sidebarClose = $("#sidebar-close");

  const pages = [
    { id: "dashboard", en: "Dashboard", my: "Dashboard" },
    { id: "menu", en: "Menu", my: "Menu" },
    { id: "ingredients", en: "Ingredients", my: "ကုန်ကြမ်းပစ္စည်းများ" },
    { id: "equipment", en: "Equipment & Supplies", my: "ပစ္စည်းကိရိယာနှင့် အသုံးအဆောင်များ" },
    { id: "expenses", en: "Expenses", my: "အသုံးစရိတ်များ" },
    { id: "reports", en: "Business Reports", my: "လုပ်ငန်းအစီရင်ခံစာများ" },
    { id: "settings", en: "Settings", my: "Settings" }
  ];
  const labels = {
    en: {
      ai: "AI Mode", manage: "Manage Mode", aiTitle: "AI workspace",
      aiDescription: "Your AI workspace will be built from the confirmed KitchAI requirements.",
      manageIntro: "Manage your business in one place.",
      building: "This page will be built from the requirements you confirm.",
      navigation: "Manage Mode", workspace: "Workspace foundation",
      openNavigation: "Open navigation", closeNavigation: "Close navigation",
      appearance: "Toggle light and dark theme", language: "Interface language"
    },
    my: {
      ai: "AI Mode", manage: "Manage Mode", aiTitle: "AI လုပ်ငန်းခွင်",
      aiDescription: "အတည်ပြုထားသော KitchAI လိုအပ်ချက်များအတိုင်း AI လုပ်ငန်းခွင်ကို တည်ဆောက်သွားမည်။",
      manageIntro: "လုပ်ငန်းကို တစ်နေရာတည်းမှာ စီမံခန့်ခွဲပါ။",
      building: "ဒီစာမျက်နှာကို မင်းအတည်ပြုထားတဲ့ လိုအပ်ချက်တွေအတိုင်း တည်ဆောက်သွားမယ်။",
      navigation: "Manage Mode", workspace: "UI အခြေခံတည်ဆောက်မှု",
      openNavigation: "Navigation ဖွင့်ရန်", closeNavigation: "Navigation ပိတ်ရန်",
      appearance: "Light/Dark Theme ပြောင်းရန်", language: "ဘာသာစကား"
    },
    th: {
      ai: "โหมด AI", manage: "โหมดจัดการ", aiTitle: "พื้นที่ AI",
      aiDescription: "พื้นที่ AI จะสร้างตามข้อกำหนด KitchAI ที่ยืนยันแล้ว",
      manageIntro: "จัดการธุรกิจของคุณในที่เดียว",
      building: "หน้านี้จะสร้างตามข้อกำหนดที่คุณยืนยัน",
      navigation: "โหมดจัดการ", workspace: "พื้นฐานพื้นที่ทำงาน",
      openNavigation: "เปิดเมนูนำทาง", closeNavigation: "ปิดเมนูนำทาง",
      appearance: "สลับธีมสว่างและมืด", language: "ภาษา"
    }
  };

  /* Launch always starts in AI Mode; each mode keeps its own place during this session. */
  const state = { mode: "ai", aiPage: "ai", managePage: "dashboard", touchX: 0, touchY: 0, tracking: false, drawerGesture: false };

  function language() {
    return labels[languageSelect?.value] ? languageSelect.value : "en";
  }
  function t(key) {
    return labels[language()][key] || labels.en[key] || key;
  }
  function pageLabel(page) {
    return page[language()] || page.en;
  }
  function openDrawer() {
    sidebar?.classList.add("open");
    backdrop?.classList.add("visible");
    menuToggle?.setAttribute("aria-expanded", "true");
  }
  function closeDrawer() {
    sidebar?.classList.remove("open");
    backdrop?.classList.remove("visible");
    menuToggle?.setAttribute("aria-expanded", "false");
  }
  function renderSidebar() {
    if (!sidebarContent) return;
    if (state.mode === "ai") {
      sidebarContent.innerHTML = '<div class="nav-section-label">KitchAI</div><p class="empty-history">' +
        t("aiDescription") + '</p>';
      return;
    }
    sidebarContent.innerHTML = '<div class="nav-section-label">' + t("navigation") + '</div>' +
      pages.map(page => '<button type="button" class="nav-item' +
        (state.managePage === page.id ? ' active' : '') +
        '" data-page="' + page.id + '" aria-current="' + (state.managePage === page.id ? 'page' : 'false') + '">' +
        '<span class="nav-icon" aria-hidden="true">' + (page.id === "dashboard" ? "▦" : page.id === "menu" ? "≡" : page.id === "ingredients" ? "◈" : page.id === "equipment" ? "□" : page.id === "expenses" ? "−" : page.id === "reports" ? "▥" : "⚙") + '</span>' +
        '<span>' + pageLabel(page) + '</span></button>').join("");
  }
  function renderPage() {
    if (!pageContent) return;
    if (state.mode === "ai") {
      pageContent.innerHTML = '<section class="page-section" aria-labelledby="workspace-title">' +
        '<h1 id="workspace-title">' + t("aiTitle") + '</h1><p>' + t("aiDescription") + '</p></section>';
      return;
    }
    const page = pages.find(item => item.id === state.managePage) || pages[0];
    const isDashboard = page.id === "dashboard";
    pageContent.innerHTML = '<section class="page-section" aria-labelledby="workspace-title">' +
      '<p class="eyebrow">' + t("manage") + '</p>' +
      '<h1 id="workspace-title">' + pageLabel(page) + '</h1>' +
      '<p>' + (isDashboard ? t("manageIntro") : t("building")) + '</p></section>';
  }
  function render() {
    modeButtons.forEach(button => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderSidebar();
    renderPage();
    if (document.documentElement) document.documentElement.lang = language();
  }
  function setMode(mode) {
    if (mode !== "ai" && mode !== "manage" || state.mode === mode) return;
    state.mode = mode;
    closeDrawer();
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  modeButtons.forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
  sidebarContent?.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest("[data-page]") : null;
    if (!button) return;
    const pageId = button.getAttribute("data-page");
    if (!pages.some(page => page.id === pageId)) return;
    state.managePage = pageId;
    closeDrawer();
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
  });
  menuToggle?.addEventListener("click", openDrawer);
  sidebarClose?.addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeDrawer();
  });
  languageSelect?.addEventListener("change", render);
  themeToggle?.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.body.classList.toggle("dark", dark);
    themeToggle.setAttribute("aria-pressed", String(dark));
  });

  /* Horizontal swipes only change modes, except an open Drawer consumes the swipe to close itself. */
  document.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) { state.tracking = false; return; }
    state.touchX = event.touches[0].clientX;
    state.touchY = event.touches[0].clientY;
    state.drawerGesture = Boolean(sidebar?.classList.contains("open"));
    state.tracking = true;
  }, { passive: true });
  document.addEventListener("touchend", event => {
    if (!state.tracking || !event.changedTouches.length) return;
    state.tracking = false;
    const dx = event.changedTouches[0].clientX - state.touchX;
    const dy = event.changedTouches[0].clientY - state.touchY;
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (state.drawerGesture) { closeDrawer(); return; }
    setMode(dx < 0 ? "manage" : "ai");
  }, { passive: true });

  render();
})();
