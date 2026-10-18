/* Minimal mode shell only. Legacy preview pages and mock workflows retired. */
(() => {
  const modeButtons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll("[data-mode]")]);
  const pageContent = document.querySelector("#page-content");
  const sidebar = document.querySelector("#sidebar-content");
  const languageSelect = /** @type {HTMLSelectElement|null} */ (document.querySelector("#language-select"));
  const themeToggle = /** @type {HTMLButtonElement|null} */ (document.querySelector("#theme-toggle"));
  const state = { mode: "ai", startX: 0, startY: 0, tracking: false };

  const labels = {
    en: {
      ai: "AI Mode", manage: "Manage Mode",
      aiTitle: "AI workspace", manageTitle: "Manage workspace",
      empty: "This workspace is being rebuilt around the confirmed KitchAI requirements.",
      note: "Legacy preview screens and sample workflows have been cleared. Existing data and business logic are kept separate and have not been deleted.",
      settings: "Settings", language: "Language", appearance: "Appearance",
      light: "Light", dark: "Dark", system: "System default"
    },
    my: {
      ai: "AI Mode", manage: "Manage Mode",
      aiTitle: "AI လုပ်ငန်းခွင်", manageTitle: "လုပ်ငန်းစီမံခန့်ခွဲမှု",
      empty: "အတည်ပြုထားသော KitchAI လိုအပ်ချက်များအတိုင်း ဒီနေရာကို ပြန်လည်တည်ဆောက်နေပါသည်။",
      note: "အဟောင်း Preview စာမျက်နှာများနှင့် နမူနာလုပ်ဆောင်ချက်များကို ရှင်းထားပါသည်။ ရှိပြီးသား Data နှင့် အရေးကြီး Logic များကို မဖျက်ထားပါ။",
      settings: "Settings", language: "ဘာသာစကား", appearance: "အသွင်အပြင်",
      light: "အလင်း", dark: "အမှောင်", system: "စနစ်အတိုင်း"
    },
    th: {
      ai: "โหมด AI", manage: "โหมดจัดการ",
      aiTitle: "พื้นที่ AI", manageTitle: "พื้นที่จัดการ",
      empty: "กำลังสร้างพื้นที่นี้ใหม่ตามข้อกำหนด KitchAI ที่ยืนยันแล้ว",
      note: "ล้างหน้าตัวอย่างและขั้นตอนจำลองเดิมแล้ว โดยยังเก็บข้อมูลและตรรกะธุรกิจที่มีอยู่ไว้",
      settings: "ตั้งค่า", language: "ภาษา", appearance: "รูปลักษณ์",
      light: "สว่าง", dark: "มืด", system: "ตามระบบ"
    }
  };

  function t(key) {
    const lang = languageSelect?.value || "en";
    return (labels[lang] || labels.en)[key] || labels.en[key] || key;
  }

  function render() {
    modeButtons.forEach(button => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (sidebar) {
      sidebar.innerHTML = '<div class="nav-section-label">' + t("settings") +
        '</div><p class="empty-history">' + t("note") + '</p>';
    }
    if (pageContent) {
      pageContent.innerHTML = '<section class="page-section" aria-labelledby="workspace-title">' +
        '<h1 id="workspace-title">' + t(state.mode === "ai" ? "aiTitle" : "manageTitle") + '</h1>' +
        '<p>' + t("empty") + '</p></section>';
    }
    document.documentElement.lang = languageSelect?.value || "en";
  }

  function setMode(mode) {
    if (mode !== "ai" && mode !== "manage") return;
    if (state.mode === mode) return;
    state.mode = mode;
    render();
  }

  modeButtons.forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
  languageSelect?.addEventListener("change", render);
  themeToggle?.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.body.classList.toggle("theme-dark", dark);
    themeToggle.setAttribute("aria-pressed", String(dark));
  });

  document.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) { state.tracking = false; return; }
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, button, a, [contenteditable=true]")) {
      state.tracking = false;
      return;
    }
    state.startX = event.touches[0].clientX;
    state.startY = event.touches[0].clientY;
    state.tracking = true;
  }, { passive: true });

  document.addEventListener("touchend", event => {
    if (!state.tracking || !event.changedTouches.length) return;
    state.tracking = false;
    const dx = event.changedTouches[0].clientX - state.startX;
    const dy = event.changedTouches[0].clientY - state.startY;
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    setMode(dx < 0 ? "manage" : "ai");
  }, { passive: true });

  render();
})();
