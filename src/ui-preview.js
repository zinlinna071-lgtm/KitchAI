/* Pages publish marker: Menu and Personal Expenses pages intentionally cleared. */
/* KitchAI frontend prototype. UI-only state; persistence/backend intentionally not connected. */
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const modeButtons = $$("[data-mode]");
  const pageContent = $("#page-content");
  const sidebarContent = $("#sidebar-content");
  const sidebar = $("#sidebar");
  const appShell = $(".app-shell");
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
    { id: "expenses", en: "Expenses", my: "လုပ်ငန်းအသုံးစရိတ်" },
    { id: "personal-expenses", en: "Personal Expenses", my: "တကိုယ်ရည်အသုံးစရိတ်" },
    { id: "reports", en: "Business Reports", my: "လုပ်ငန်းအစီရင်ခံစာများ" },
    { id: "settings", en: "Settings", my: "Settings" }
  ];
  const pageDescriptions = {
    dashboard: { en: "A clear overview of your kitchen business.", my: "သင့်အစားအသောက်လုပ်ငန်း၏ အခြေအနေကို တစ်နေရာတည်းမှ ကြည့်ရှုနိုင်သည်။", th: "ดูภาพรวมธุรกิจอาหารของคุณได้ในที่เดียว" },
    menu: { en: "Manage the food and drinks you offer and their selling prices.", my: "ရောင်းချမည့် အစားအသောက်များနှင့် ရောင်းဈေးများကို စီမံပါ။", th: "จัดการรายการอาหารและเครื่องดื่มพร้อมราคาขาย" },
    ingredients: { en: "Keep your ingredient and raw-material records organized.", my: "ကုန်ကြမ်းနှင့် ပါဝင်ပစ္စည်းများ၏ မှတ်တမ်းများကို စနစ်တကျ ထိန်းသိမ်းပါ။", th: "จัดระเบียบข้อมูลวัตถุดิบและส่วนผสมของคุณ" },
    equipment: { en: "Keep track of business equipment and everyday supplies.", my: "လုပ်ငန်းသုံးပစ္စည်းကိရိယာများနှင့် နေ့စဉ်အသုံးအဆောင်များကို မှတ်တမ်းတင်ပါ။", th: "ติดตามอุปกรณ์ธุรกิจและของใช้ประจำวัน" },
    expenses: { en: "Record and review the costs of running your business.", my: "လုပ်ငန်းလည်ပတ်မှုအတွက် ကုန်ကျစရိတ်များကို မှတ်တမ်းတင်ပြီး ပြန်လည်စစ်ဆေးပါ။", th: "บันทึกและตรวจสอบค่าใช้จ่ายในการดำเนินธุรกิจ" },
    "personal-expenses": { en: "Track personal spending separately from business expenses.", my: "ကိုယ်ပိုင်အသုံးစရိတ်ကို လုပ်ငန်းအသုံးစရိတ်နှင့် သီးခြားမှတ်တမ်းတင်ပါ။", th: "ติดตามรายจ่ายส่วนตัวแยกจากรายจ่ายธุรกิจ" },
    reports: { en: "Review business performance and recorded activity.", my: "လုပ်ငန်း၏ ရလဒ်များနှင့် မှတ်တမ်းတင်ထားသော လုပ်ဆောင်ချက်များကို ပြန်လည်ကြည့်ရှုပါ။", th: "ตรวจสอบผลการดำเนินงานและกิจกรรมที่บันทึกไว้" },
    settings: { en: "Adjust your KitchAI workspace preferences.", my: "KitchAI အသုံးပြုမှုဆိုင်ရာ သတ်မှတ်ချက်များကို ပြင်ဆင်ပါ။", th: "ปรับการตั้งค่าการใช้งาน KitchAI ของคุณ" }
  };
  const labels = {
    en: { ai:"AI Mode", manage:"Manage Mode", aiTitle:"AI workspace", aiDescription:"Start with your kitchen questions here. AI responses will be connected after the frontend is confirmed.", aiWelcome:"Ask KitchAI about your kitchen", aiStart:"Start a conversation here. AI replies will be connected after the frontend is confirmed.", aiMessage:"Message", aiPlaceholder:"Ask about your kitchen...", aiPreviewOnly:"Frontend preview only · AI service not connected", aiSend:"Send", aiMessageNotice:"Message shown in preview only; AI is not connected yet.", manageIntro:"Manage your business in one place.", building:"This page will be built from the requirements you confirm.", navigation:"Manage Mode", workspace:"Frontend prototype", openNavigation:"Open navigation", closeNavigation:"Close navigation", appearance:"Toggle light and dark theme", language:"Interface language", emptyTitle:"No data yet", emptyCopy:"Start by adding your first record.", create:"Create", createCategory:"Create Category", createIngredient:"Create Ingredient", createMenu:"Create Menu", category:"Category", name:"Name", cancel:"Cancel", save:"Create", default:"Default", reusable:"Reusable", oneTime:"One time", type:"Type", quantity:"Quantity", unit:"Unit", price:"Price", note:"Note (optional)", sellingPrice:"Selling price", ingredients:"Ingredients", noIngredients:"No ingredients yet. You can add them later.", notNow:"I’m not adding ingredients yet", back:"Back", edit:"Edit", delete:"Delete", update:"Save changes", confirmDelete:"Delete this record?", details:"Details", chooseCategory:"Choose or type a category", required:"This field is required.", aiOnly:"AI Mode UI is a placeholder in this frontend stage.", savedInPreview:"Added to this preview only; it is not saved to a database.", personalExpenseIntro:"Track your own spending separately from business expenses.", addPersonalExpense:"Add personal expense", personalExpenseEmpty:"No personal expenses yet.", personalExpenseEmptyCopy:"Add your first personal expense to start tracking your spending.", expenseDescription:"What did you spend on?", expenseDate:"Date", expenseAmount:"Amount", expenseCategory:"Category", expenseNote:"Note (optional)", personalExpenseTotal:"Recorded personal spending", personalExpenseCount:"Entries", editPersonalExpense:"Edit personal expense", deletePersonalExpense:"Delete expense", personalExpenseSaved:"Personal expense added to this preview only.", personalExpenseCategories:"Examples: Food, Transport, Shopping, Bills", personalExpenseDeleteConfirm:"Delete this personal expense?", menuIntro:"Browse menus by category and review sales history.", allMenus:"All Menus", salesHistory:"Sales History", addMenu:"Add Menu", menuEmpty:"No menus yet.", menuEmptyCopy:"Create a reusable menu or record a one-time sale.", menuType:"Menu type", image:"Image (optional)", oneTimeSale:"One-time sale details", unitPrice:"Unit price", discount:"Discount", netSale:"Net sale", saleDate:"Sale date", saleTime:"Sale time", salesCount:"Sales", noSalesAll:"No sales recorded yet.", saleSaved:"Sale saved on this device only; cloud sync is not connected.", menuSaved:"Menu data is saved on this device only; cloud sync is not connected.", noSales:"No sales recorded for this menu yet.", recordSale:"Record Sale" },
    my: { ai:"AI Mode", manage:"Manage Mode", aiTitle:"AI လုပ်ငန်းခွင်", aiDescription:"ဒီနေရာမှာ မီးဖိုချောင်နဲ့ပတ်သက်တဲ့ မေးခွန်းတွေ စတင်မေးနိုင်ပါတယ်။ Frontend အတည်ပြုပြီးမှ AI အဖြေဝန်ဆောင်မှုကို ချိတ်ဆက်မယ်။", aiWelcome:"KitchAI ကို မီးဖိုချောင်အကြောင်း မေးမြန်းပါ", aiStart:"ဒီနေရာမှာ စကားဝိုင်း စတင်နိုင်ပါတယ်။ Frontend အတည်ပြုပြီးမှ AI အဖြေဝန်ဆောင်မှု ချိတ်ဆက်ပါမယ်။", aiMessage:"စာတို", aiPlaceholder:"မီးဖိုချောင်အကြောင်း မေးပါ...", aiPreviewOnly:"Frontend စမ်းသပ်ဗားရှင်းသာဖြစ်ပြီး AI ဝန်ဆောင်မှု မချိတ်ဆက်ရသေးပါ", aiSend:"ပို့ရန်", aiMessageNotice:"ဒီစာတိုကို Preview ထဲမှာသာ ပြထားပါတယ်။ AI မချိတ်ဆက်ရသေးပါ။", manageIntro:"လုပ်ငန်းကို တစ်နေရာတည်းမှာ စီမံခန့်ခွဲပါ။", building:"ဒီစာမျက်နှာကို အတည်ပြုထားတဲ့ လိုအပ်ချက်တွေအတိုင်း တည်ဆောက်သွားမယ်။", navigation:"Manage Mode", workspace:"Frontend စမ်းသပ်ဗားရှင်း", openNavigation:"Navigation ဖွင့်ရန်", closeNavigation:"Navigation ပိတ်ရန်", appearance:"Theme ပြောင်းရန်", language:"ဘာသာစကား", emptyTitle:"အချက်အလက် မရှိသေးပါ", emptyCopy:"ပထမဆုံးအချက်အလက်ကို စတင်ထည့်သွင်းပါ။", create:"အသစ်ထည့်ရန်", createCategory:"Category အသစ်", createIngredient:"Ingredient အသစ်", createMenu:"Menu အသစ်", category:"Category", name:"အမည်", cancel:"မလုပ်တော့ပါ", save:"ထည့်သွင်းရန်", default:"Default", reusable:"Reusable", oneTime:"One time", type:"အမျိုးအစား", quantity:"အရေအတွက်", unit:"ယူနစ်", price:"ဈေးနှုန်း", note:"မှတ်ချက် (မဖြစ်မနေမဟုတ်)", sellingPrice:"ရောင်းဈေး", ingredients:"Ingredients", noIngredients:"Ingredient မရှိသေးပါ။ နောက်မှထည့်နိုင်ပါတယ်။", notNow:"အခု Ingredients မထည့်သေးပါ", back:"နောက်သို့", edit:"ပြင်ရန်", delete:"ဖျက်ရန်", update:"ပြင်ဆင်ချက်သိမ်းရန်", confirmDelete:"ဒီအချက်အလက်ကို ဖျက်မှာသေချာပါသလား။", details:"အသေးစိတ်", chooseCategory:"Category ရွေးရန် သို့မဟုတ် အသစ်ရိုက်ရန်", required:"ဒီအကွက်ကို ဖြည့်ရန်လိုပါတယ်။", aiOnly:"ဒီအဆင့်မှာ AI Mode UI ကို နမူနာအဖြစ်သာ ပြထားပါတယ်။", savedInPreview:"ဒီ preview ထဲမှာသာ ထည့်ထားတာဖြစ်ပြီး database ထဲ မသိမ်းရသေးပါ။", personalExpenseIntro:"လုပ်ငန်းအသုံးစရိတ်နဲ့ သီးခြားခွဲပြီး ကိုယ်ပိုင်အသုံးစရိတ်တွေကို မှတ်တမ်းတင်ပါ။", addPersonalExpense:"ကိုယ်ပိုင်အသုံးစရိတ် ထည့်ရန်", personalExpenseEmpty:"ကိုယ်ပိုင်အသုံးစရိတ် မရှိသေးပါ။", personalExpenseEmptyCopy:"အသုံးစရိတ် စတင်မှတ်တမ်းတင်ရန် ပထမဆုံးစာရင်းကို ထည့်ပါ။", expenseDescription:"ဘာအတွက် သုံးခဲ့သလဲ", expenseDate:"ရက်စွဲ", expenseAmount:"ပမာဏ", expenseCategory:"အမျိုးအစား", expenseNote:"မှတ်ချက် (မဖြစ်မနေမဟုတ်)", personalExpenseTotal:"မှတ်တမ်းတင်ထားသော ကိုယ်ပိုင်အသုံးစရိတ်", personalExpenseCount:"စာရင်းအရေအတွက်", editPersonalExpense:"ကိုယ်ပိုင်အသုံးစရိတ် ပြင်ရန်", deletePersonalExpense:"အသုံးစရိတ် ဖျက်ရန်", personalExpenseSaved:"ကိုယ်ပိုင်အသုံးစရိတ်ကို Preview ထဲမှာသာ ထည့်ထားပါတယ်။", personalExpenseCategories:"ဥပမာ - အစားအသောက်၊ ခရီးစရိတ်၊ ဈေးဝယ်၊ ဘေလ်", personalExpenseDeleteConfirm:"ဒီကိုယ်ပိုင်အသုံးစရိတ်ကို ဖျက်မှာ သေချာပါသလား။" },
    th: { ai:"โหมด AI", manage:"โหมดจัดการ", aiTitle:"พื้นที่ AI", aiDescription:"เริ่มถามคำถามเกี่ยวกับครัวของคุณได้ที่นี่ ระบบ AI จะเชื่อมต่อหลังจากยืนยันส่วนหน้าแล้ว", aiWelcome:"ถาม KitchAI เกี่ยวกับครัวของคุณ", aiStart:"เริ่มบทสนทนาได้ที่นี่ ระบบ AI จะเชื่อมต่อหลังจากยืนยันส่วนหน้าแล้ว", aiMessage:"ข้อความ", aiPlaceholder:"ถามเกี่ยวกับครัวของคุณ...", aiPreviewOnly:"ตัวอย่างส่วนหน้าเท่านั้น ยังไม่ได้เชื่อมต่อบริการ AI", aiSend:"ส่ง", aiMessageNotice:"แสดงข้อความนี้ในตัวอย่างเท่านั้น ยังไม่ได้เชื่อมต่อ AI", manageIntro:"จัดการธุรกิจของคุณในที่เดียว", building:"หน้านี้จะสร้างตามข้อกำหนดที่ยืนยัน", navigation:"โหมดจัดการ", workspace:"ต้นแบบส่วนหน้า", openNavigation:"เปิดเมนูนำทาง", closeNavigation:"ปิดเมนูนำทาง", appearance:"สลับธีม", language:"ภาษา", emptyTitle:"ยังไม่มีข้อมูล", emptyCopy:"เริ่มต้นด้วยการเพิ่มรายการแรก", create:"สร้าง", createCategory:"สร้างหมวดหมู่", createIngredient:"สร้างวัตถุดิบ", createMenu:"สร้างเมนู", category:"หมวดหมู่", name:"ชื่อ", cancel:"ยกเลิก", save:"สร้าง", default:"Default", reusable:"ใช้ซ้ำ", oneTime:"ครั้งเดียว", type:"ประเภท", quantity:"จำนวน", unit:"หน่วย", price:"ราคา", note:"หมายเหตุ (ไม่บังคับ)", sellingPrice:"ราคาขาย", ingredients:"วัตถุดิบ", noIngredients:"ยังไม่มีวัตถุดิบ เพิ่มภายหลังได้", notNow:"ยังไม่เพิ่มวัตถุดิบตอนนี้", back:"กลับ", edit:"แก้ไข", delete:"ลบ", update:"บันทึก", confirmDelete:"ต้องการลบรายการนี้หรือไม่", details:"รายละเอียด", chooseCategory:"เลือกหรือพิมพ์หมวดหมู่", required:"จำเป็นต้องกรอกข้อมูลนี้", aiOnly:"พื้นที่ AI เป็นตัวอย่างในขั้นตอนนี้", savedInPreview:"เพิ่มในตัวอย่างนี้เท่านั้น ยังไม่ได้บันทึกลงฐานข้อมูล", personalExpenseIntro:"บันทึกรายจ่ายส่วนตัวแยกจากรายจ่ายของธุรกิจ", addPersonalExpense:"เพิ่มรายจ่ายส่วนตัว", personalExpenseEmpty:"ยังไม่มีรายจ่ายส่วนตัว", personalExpenseEmptyCopy:"เพิ่มรายการแรกเพื่อเริ่มติดตามรายจ่ายส่วนตัว", expenseDescription:"ใช้จ่ายเรื่องอะไร", expenseDate:"วันที่", expenseAmount:"จำนวนเงิน", expenseCategory:"หมวดหมู่", expenseNote:"หมายเหตุ (ไม่บังคับ)", personalExpenseTotal:"ยอดรายจ่ายส่วนตัวที่บันทึก", personalExpenseCount:"รายการ", editPersonalExpense:"แก้ไขรายจ่ายส่วนตัว", deletePersonalExpense:"ลบรายจ่าย", personalExpenseSaved:"เพิ่มรายจ่ายส่วนตัวในตัวอย่างนี้เท่านั้น", personalExpenseCategories:"ตัวอย่าง: อาหาร, เดินทาง, ช้อปปิ้ง, บิล", personalExpenseDeleteConfirm:"ต้องการลบรายจ่ายส่วนตัวนี้หรือไม่" }
  };
  const state = { mode:"ai", aiPage:"ai", managePage:"dashboard", touchX:0, touchY:0, tracking:false, drawerGesture:false, dialog:null, categoryTarget:null, detailId:null, detailType:null, editId:null, categories:{ingredients:["Default"],menu:["Default"]}, ingredients:[], menus:[], sales:[], menuView:"all", menuSearch:"", pendingImageData:"", personalExpenses:[], aiMessages:[], aiChats:[], activeAiChatId:null, aiView:"chat", aiSearchQuery:"" };
  let menuPersistenceReady = false;
  let menuPersistenceModule = null;
  async function persistMenuWorkspace() {
    if (!menuPersistenceReady || !menuPersistenceModule) return;
    try {
      await menuPersistenceModule.saveMenuWorkspace({ menus: state.menus, sales: state.sales, categories: state.categories.menu });
    } catch (error) {
      console.error("KitchAI could not save local Menu data", error);
      toast("Menu data could not be saved on this device.");
    }
  }
  async function initializeMenuPersistence() {
    try {
      menuPersistenceModule = await import("./menu-preview-store.js");
      const saved = await menuPersistenceModule.loadMenuWorkspace();
      state.menus = saved.menus;
      state.sales = saved.sales;
      state.categories.menu = [...new Set(["Default", ...saved.categories])];
    } catch (error) {
      console.error("KitchAI could not load local Menu data", error);
      toast("Local Menu storage is unavailable in this browser.");
    } finally {
      menuPersistenceReady = true;
      render();
    }
  }
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const language = () => labels[languageSelect?.value] ? languageSelect.value : "en";
  const t = key => labels[language()][key] || labels.en[key] || key;
  const pageLabel = page => page[language()] || page.en;
  const isDesktop = () => window.matchMedia("(min-width: 761px)").matches;
  const openDrawer = () => {
    appShell?.classList.remove("sidebar-collapsed");
    menuToggle?.setAttribute("aria-label", t("closeNavigation"));
    menuToggle?.setAttribute("aria-expanded", "true");
    sidebarClose?.setAttribute("aria-label", t("closeNavigation"));
    sidebarClose?.textContent = "‹";
  };
  const closeDrawer = () => {
    appShell?.classList.add("sidebar-collapsed");
    menuToggle?.setAttribute("aria-label", t("openNavigation"));
    menuToggle?.setAttribute("aria-expanded", "false");
    sidebarClose?.setAttribute("aria-label", t("openNavigation"));
    sidebarClose?.textContent = "›";
  };
  const drawerIsOpen = () => !appShell?.classList.contains("sidebar-collapsed");
  const button = (label, action, primary=false) => '<button type="button" class="ui-button '+(primary?'ui-button--primary':'ui-button--secondary')+'" data-action="'+action+'">'+esc(label)+'</button>';
  const field = (label, name, type="text", value="", required=false, extra="") => '<label class="ui-field"><span class="ui-label">'+esc(label)+(required?' *':'')+'</span><input class="ui-input" name="'+esc(name)+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required':'')+' '+extra+'></label>';
  const selectField = (label,name,options,selected="") => '<label class="ui-field"><span class="ui-label">'+esc(label)+'</span><select class="ui-select" name="'+esc(name)+'">'+options.map(o=>'<option value="'+esc(o)+'" '+(o===selected?'selected':'')+'>'+esc(o)+'</option>').join("")+'</select></label>';
  const categoryField = (kind, selected="Default") => '<label class="ui-field"><span class="ui-label">'+t("category")+'</span><input class="ui-input" name="category" list="category-options" value="'+esc(selected)+'" placeholder="'+esc(t("chooseCategory"))+'"><datalist id="category-options">'+state.categories[kind].map(c=>'<option value="'+esc(c)+'"></option>').join("")+'</datalist></label>';
  function renderSidebar() {
    if (!sidebarContent) return;
    if (state.mode==="ai") {
      const actions=[["new-chat","＋","New Chat"],["recent","◷","Recent Chats"],["search","⌕","Search Chats"],["settings","⚙","AI Settings"]];
      let html=actions.map(([id,icon,label])=>'<button type="button" class="nav-item ai-nav-item'+(state.aiView===id?' active':'')+'" data-ai-action="'+id+'" title="'+label+'"><span class="nav-icon" aria-hidden="true">'+icon+'</span><span>'+label+'</span></button>').join("");
      const chats=state.aiChats.slice().reverse();
      if(state.aiView==="search") html+='<label class="sidebar-search"><span class="sr-only">Search chats</span><input id="sidebar-chat-search" type="search" value="'+esc(state.aiSearchQuery)+'" placeholder="Search chats"></label>';
      if(state.aiView==="recent"||state.aiView==="search"||chats.length){
        html+='<div class="nav-section-label ai-recent-label">Recent Chats</div>';
        const filtered=chats.filter(chat=>state.aiView!=="search"||!state.aiSearchQuery||chat.title.toLowerCase().includes(state.aiSearchQuery.toLowerCase()));
        html+=filtered.slice(0,state.aiView==="recent"||state.aiView==="search"?20:5).map(chat=>'<button type="button" class="nav-item chat-history-item" data-chat-id="'+chat.id+'" title="'+esc(chat.title)+'"><span class="nav-icon" aria-hidden="true">◦</span><span>'+esc(chat.title)+'</span></button>').join("");
        if(!filtered.length)html+='<p class="empty-history">No chats yet</p>';
      }
      sidebarContent.innerHTML=html;return;
    }
    sidebarContent.innerHTML='<div class="nav-section-label">'+esc(t("navigation"))+'</div>'+pages.map(page=>'<button type="button" class="nav-item'+(state.managePage===page.id?' active':'')+'" data-page="'+page.id+'" aria-current="'+(state.managePage===page.id?'page':'false')+'" title="'+esc(pageLabel(page))+'"><span class="nav-icon" aria-hidden="true">'+({dashboard:"▦",menu:"≡",ingredients:"◈",equipment:"□",expenses:"−","personal-expenses":"◷",reports:"▥",settings:"⚙"}[page.id])+'</span><span>'+esc(pageLabel(page))+'</span></button>').join("");
  }
  function pageHeader(title, intro, actions="") {
    return '<section class="page-section"><div class="ui-row ui-row--mobile-stack" style="justify-content:space-between;align-items:flex-start"><div><p class="eyebrow">'+esc(t("manage"))+'</p><h1>'+esc(title)+'</h1><p>'+esc(intro)+'</p></div><div class="ui-row">'+actions+'</div></div>';
  }
  function emptyState(title, copy, action) {
    return '<div class="ui-empty-state"><div aria-hidden="true" style="font-size:32px;color:var(--color-primary)">+</div><h2>'+esc(title)+'</h2><p>'+esc(copy)+'</p>'+action+'</div>';
  }
  function renderMainPage(page) {
    const description = pageDescriptions[page.id]?.[language()] || pageDescriptions[page.id]?.en || "";
    return '<section class="page-section main-page-copy"><h1>'+esc(pageLabel(page))+'</h1><p>'+esc(description)+'</p></section>';
  }
  function money(value) { return Number(value||0).toLocaleString(undefined,{maximumFractionDigits:2}); }
  function renderMenus() {
    return '<section class="page-section" aria-label="Menu" style="min-height:65vh"></section>';
  }
  function localToday() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth()+1).padStart(2,"0"), String(now.getDate()).padStart(2,"0")].join("-");
  }
  function renderPersonalExpenses() {
    return '<section class="page-section" aria-label="Personal Expenses" style="min-height:65vh"></section>';
  }
  function renderDetail() {
    const items=state.detailType==="ingredient"?state.ingredients:state.menus;
    const item=items.find(x=>x.id===state.detailId);
    if(!item){state.detailId=null;const page=pages.find(x=>x.id===state.managePage)||pages[0];return renderMainPage(page);}
    const menuSales=state.detailType==="menu"?state.sales.filter(s=>s.menuId===item.id):[];
    const info=state.detailType==="ingredient"
      ? '<p><b>'+esc(t("category"))+':</b> '+esc(item.category)+'</p><p><b>'+esc(t("type"))+':</b> '+esc(item.type==='reusable'?t("reusable"):t("oneTime"))+'</p>'+(item.type==='one-time'?'<p><b>'+esc(t("quantity"))+':</b> '+esc(item.quantity)+' '+esc(item.unit)+'</p><p><b>'+esc(t("price"))+':</b> '+esc(item.price)+'</p>':'')
      : '<p><b>'+esc(t("category"))+':</b> '+esc(item.category)+'</p><p><b>'+esc(t("sellingPrice"))+':</b> '+esc(item.price?money(item.price):"—")+'</p><p><b>'+esc(t("unit"))+':</b> '+esc(item.unit||"—")+'</p><p><b>'+esc(t("ingredients"))+':</b> '+esc(item.ingredientNames.length?item.ingredientNames.join(", "):t("noIngredients"))+'</p><p><b>'+esc(t("note"))+':</b> '+esc(item.note||"—")+'</p>';
    let history="";
    if(state.detailType==="menu") history='<hr class="ui-divider"><h2>'+esc(t("salesHistory"))+'</h2>'+(menuSales.length?'<div class="personal-expense-list">'+menuSales.map(x=>'<article class="ui-card personal-expense-item"><div class="personal-expense-main"><div><strong>'+esc(x.date)+' · '+esc(x.time||"")+'</strong><p class="ui-hint">'+esc(x.quantity)+' '+esc(x.unit||"")+' × '+money(x.unitPrice)+(x.discount?' · '+esc(t("discount"))+': '+money(x.discount):'')+'</p>'+(x.note?'<p>'+esc(x.note)+'</p>':'')+'</div><strong class="personal-expense-amount">'+money(x.netSale)+'</strong></div></article>').join("")+'</div>':'<p class="ui-hint">'+esc(t("noSales"))+'</p>');
    return '<section class="page-section"><div class="ui-row">'+button("← "+t("back"),"back-detail")+'</div><h1>'+esc(item.name)+'</h1>'+(item.image?'<img class="menu-detail-image" src="'+esc(item.image)+'" alt="">':'')+'<div class="ui-card ui-stack">'+info+(state.detailType==="menu"?'<div class="ui-row">'+button(t("recordSale"),"record-menu-sale:"+item.id,true)+'</div>':"")+history+'<hr class="ui-divider"><div class="ui-row">'+button(t("edit"),"edit-detail",true)+button(t("delete"),"delete-detail")+'</div></div><p class="ui-hint">'+esc(state.detailType==="menu"?t("menuSaved"):t("savedInPreview"))+'</p></section>';
  }
  function renderAI() {
    let html='<section class="page-section ai-page"><div class="ai-page-heading"><p class="eyebrow">KitchAI AI</p><h1>'+esc(t("aiWelcome"))+'</h1><p>'+esc(t("aiDescription"))+'</p></div><div class="ui-card ai-chat-panel">';
    if(!state.aiMessages.length) {
      html+='<div class="ai-welcome"><div class="ai-welcome-mark" aria-hidden="true">✳</div><h2>'+esc(t("aiTitle"))+'</h2><p>'+esc(t("aiStart"))+'</p><div class="ai-suggestions"><button type="button" class="ai-suggestion" data-prompt="Suggest a menu for my night market stall">Suggest a menu</button><button type="button" class="ai-suggestion" data-prompt="Help me understand ingredient costs">Ingredient cost ideas</button><button type="button" class="ai-suggestion" data-prompt="Help me plan today’s food production">Production planning</button><button type="button" class="ai-suggestion" data-prompt="What should I check in my stock?">Stock advice</button></div></div>';
    } else {
      html+='<div class="ai-messages" aria-live="polite">'+state.aiMessages.map(message=>'<div class="ai-message"><span class="ai-message-label">You</span><p>'+esc(message)+'</p></div>').join("")+'</div>';
    }
    html+='<form id="ai-composer" class="ai-composer"><label class="ui-field"><span class="ui-label">'+esc(t("aiMessage"))+'</span><textarea class="ui-textarea" name="message" maxlength="4000" placeholder="'+esc(t("aiPlaceholder"))+'" required></textarea></label><div class="ai-composer-footer"><span class="ui-hint">'+esc(t("aiPreviewOnly"))+'</span><button class="ui-button ui-button--primary" type="submit">'+esc(t("aiSend"))+' <span aria-hidden="true">↑</span></button></div></form></div></section>';
    return html;
  }
  function renderPage() {
    if(!pageContent)return;
    if(state.mode==="ai"){
      if(state.aiView==="settings"){pageContent.innerHTML='<section class="page-section ai-page"><div class="ai-page-heading"><p class="eyebrow">KitchAI</p><h1>AI Settings</h1><p>AI preferences will be available when the AI service is connected.</p></div><div class="ui-card ai-settings-card"><h2>AI connection</h2><p class="ui-hint">This preview does not connect to an AI service yet.</p></div></section>';return;}
      if(state.aiView==="recent"||state.aiView==="search"){const chats=state.aiChats.slice().reverse().filter(chat=>state.aiView!=="search"||!state.aiSearchQuery||chat.title.toLowerCase().includes(state.aiSearchQuery.toLowerCase()));pageContent.innerHTML='<section class="page-section ai-page"><div class="ai-page-heading"><p class="eyebrow">KitchAI</p><h1>'+(state.aiView==="search"?"Search Chats":"Recent Chats")+'</h1><p>Open a previous conversation to continue.</p></div>'+(state.aiView==="search"?'<label class="ui-field"><span class="ui-label">Search chats</span><input class="ui-input" id="main-chat-search" type="search" value="'+esc(state.aiSearchQuery)+'" placeholder="Search conversations"></label>':"")+'<div class="ai-chat-list">'+(chats.length?chats.map(chat=>'<button type="button" class="ui-card ai-chat-list-item" data-chat-id="'+chat.id+'"><strong>'+esc(chat.title)+'</strong><span class="ui-hint">'+chat.messages.length+' message(s)</span></button>').join(""):'<p class="ui-hint">No saved chats yet.</p>')+'</div></section>';return;}
      pageContent.innerHTML=renderAI();return;}
    if(state.dialog){pageContent.innerHTML=renderDialog();return;}
    if(state.detailId){pageContent.innerHTML=renderDetail();return;}
    const page=pages.find(x=>x.id===state.managePage)||pages[0];
    pageContent.innerHTML=renderMainPage(page);
  }
  function renderDialog() {
    const d=state.dialog;
    let title="", body="", submit=t("save");
    if(d==="ingredient-category"||d==="menu-category"){
      title=t("createCategory");body=field(t("name"),"categoryName","text","",true,'maxlength="80"');
    } else if(d==="ingredient"||d==="edit-ingredient"){
      const item=d==="edit-ingredient"?state.ingredients.find(x=>x.id===state.editId):{};
      title=d==="edit-ingredient"?t("edit")+" "+t("createIngredient"):t("createIngredient");
      body=field(t("name"),"name","text",item?.name||"",true,'maxlength="100"')+categoryField("ingredients",item?.category||"Default")+
        selectField(t("type"),"type",[t("reusable"),t("oneTime")],item?.type==="one-time"?t("oneTime"):t("reusable"));
      body+='<div id="one-time-fields" class="ui-grid" style="display:'+(item?.type==="one-time"?"grid":"none")+'">'+field(t("quantity"),"quantity","number",item?.quantity||"",false,'min="0" step="any"')+field(t("unit"),"unit","text",item?.unit||"",false,'maxlength="30"')+field(t("price"),"price","number",item?.price||"",false,'min="0" step="any"')+'</div>';
      submit=d==="edit-ingredient"?t("update"):t("save");
    } else if(d==="personal-expense"||d==="edit-personal-expense"){
      const item=d==="edit-personal-expense"?state.personalExpenses.find(x=>x.id===state.editId):{};
      title=d==="edit-personal-expense"?t("editPersonalExpense"):t("addPersonalExpense");
      body=field(t("expenseDescription"),"description","text",item?.description||"",true,'maxlength="120"')+field(t("expenseAmount"),"amount","number",item?.amount||"",true,'min="0.01" step="any"')+field(t("expenseDate"),"date","date",item?.date||localToday(),true)+field(t("expenseCategory"),"category","text",item?.category||"",false,'maxlength="60" placeholder="'+esc(t("personalExpenseCategories"))+'"')+'<label class="ui-field"><span class="ui-label">'+esc(t("expenseNote"))+'</span><textarea class="ui-textarea" name="note" maxlength="500">'+esc(item?.note||"")+'</textarea></label>';
      submit=d==="edit-personal-expense"?t("update"):t("save");
    } else if(d==="record-menu-sale"){
      const item=state.menus.find(x=>x.id===state.editId)||{};
      title=t("recordSale")+" · "+(item.name||t("createMenu"));
      body='<p class="ui-hint">'+esc(item.name||"")+'</p>'+field(t("quantity"),"quantity","number","1",false,'min="0.001" step="any"')+field(t("unit"),"saleUnit","text",item.unit||"piece",true,'maxlength="30"')+field(t("unitPrice"),"unitPrice","number",item.price||"",true,'min="0" step="any"')+field(t("discount"),"discount","number","0",false,'min="0" step="any"')+field(t("saleDate"),"saleDate","date",localToday(),false)+field(t("saleTime"),"saleTime","time",new Date().toTimeString().slice(0,5),false)+'<label class="ui-field"><span class="ui-label">'+esc(t("note"))+'</span><textarea class="ui-textarea" name="saleNote" maxlength="500"></textarea></label><p class="ui-hint">'+esc(t("netSale"))+': <strong id="net-sale-preview">—</strong></p>';
      submit=t("save");
    } else if(d==="menu"||d==="edit-menu"){
      const item=d==="edit-menu"?state.menus.find(x=>x.id===state.editId):{};
      title=d==="edit-menu"?t("edit")+" "+t("createMenu"):t("createMenu");
      body=selectField(t("menuType"),"type",[t("reusable"),t("oneTime")],item?.type==="one-time"?t("oneTime"):t("reusable"));
      body+=categoryField("menu",item?.category||"Default")+field(t("name"),"name","text",item?.name||"",true,'maxlength="100"');
      body+='<label class="ui-field"><span class="ui-label">'+esc(t("image"))+'</span><input class="ui-input" type="file" name="image" accept="image/*"></label>';
      body+='<div id="reusable-menu-fields" class="ui-stack" style="display:'+(item?.type==="one-time"?"none":"grid")+'">'+field(t("sellingPrice"),"price","number",item?.price||"",false,'min="0" step="any"')+field(t("unit"),"unit","text",item?.unit||"piece",false,'maxlength="30"')+'<div class="ui-field"><span class="ui-label">'+esc(t("ingredients"))+'</span>';
      if(state.ingredients.length) body+=state.ingredients.map(i=>'<label class="ui-check"><input type="checkbox" name="ingredientIds" value="'+i.id+'" '+((item?.ingredientIds||[]).includes(i.id)?'checked':'')+'> '+esc(i.name)+'</label>').join("");
      else body+='<p class="ui-hint">'+esc(t("noIngredients"))+'</p>';
      body+='</div><label class="ui-field"><span class="ui-label">'+esc(t("note"))+'</span><textarea class="ui-textarea" name="note" maxlength="500">'+esc(item?.note||"")+'</textarea></label></div>';
      body+='<div id="one-time-fields" class="ui-stack" style="display:'+(item?.type==="one-time"?"grid":"none")+'"><h2>'+esc(t("oneTimeSale"))+'</h2>'+field(t("quantity"),"quantity","number","1",true,'min="0.001" step="any"')+field(t("unit"),"saleUnit","text",item?.unit||"piece",false,'maxlength="30"')+field(t("unitPrice"),"unitPrice","number",item?.price||"",false,'min="0" step="any"')+field(t("discount"),"discount","number","0",false,'min="0" step="any"')+field(t("saleDate"),"saleDate","date",localToday(),true)+field(t("saleTime"),"saleTime","time",new Date().toTimeString().slice(0,5),true)+'<label class="ui-field"><span class="ui-label">'+esc(t("note"))+'</span><textarea class="ui-textarea" name="saleNote" maxlength="500"></textarea></label><p class="ui-hint">'+esc(t("netSale"))+': <strong id="net-sale-preview">—</strong></p></div>';
      submit=d==="edit-menu"?t("update"):t("save");
    }
    return '<section class="page-section internal-form-screen"><div class="ui-row internal-form-heading"><button type="button" class="ui-button ui-button--secondary" data-action="cancel-dialog" aria-label="'+esc(t("back"))+'">← '+esc(t("back"))+'</button><h1>'+esc(title)+'</h1></div><form class="ui-card ui-stack internal-form" id="record-form">'+body+'<div class="ui-row internal-form-actions">'+button(t("cancel"),"cancel-dialog")+'<button class="ui-button ui-button--primary" type="submit">'+esc(submit)+'</button></div></form></section>';
  }
  function render() {
    modeButtons.forEach(b=>{const active=b.dataset.mode===state.mode;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});
    renderSidebar();renderPage();if(document.documentElement)document.documentElement.lang=language();
  }
  function setMode(mode){if((mode!=="ai"&&mode!=="manage")||state.mode===mode)return;if(state.dialog){if(state.editId&&state.detailType)state.detailId=state.editId;state.dialog=null;state.editId=null;}state.mode=mode;if(!isDesktop())closeDrawer();render();window.scrollTo({top:0,behavior:"auto"});}
  function toast(message){const el=$("#toast");if(el){el.textContent=message;el.classList.add("visible");window.setTimeout(()=>el.classList.remove("visible"),2600);}}
  function categoryFor(kind,value){const name=(value||"").trim()||"Default";if(!state.categories[kind].includes(name))state.categories[kind].push(name);return name;}
  function handleAction(action){
    if(action==="new-ingredient"){state.dialog="ingredient";state.editId=null;}
    else if(action==="new-personal-expense"){state.dialog="personal-expense";state.editId=null;}
    else if(action.startsWith("edit-personal-expense:")){state.editId=Number(action.split(":")[1]);state.dialog="edit-personal-expense";}
    else if(action.startsWith("delete-personal-expense:")){const id=Number(action.split(":")[1]);if(window.confirm(t("personalExpenseDeleteConfirm"))){state.personalExpenses=state.personalExpenses.filter(item=>item.id!==id);toast(t("personalExpenseSaved"));}}
    else if(action==="new-menu"){state.dialog="menu";state.editId=null;state.pendingImageData="";}
    else if(action==="new-ingredient-category"){state.dialog="ingredient-category";state.categoryTarget="ingredients";}
    else if(action==="new-menu-category"){state.dialog="menu-category";state.categoryTarget="menu";}
    else if(action==="menu-view-all"){state.menuView="all";state.menuSearch="";state.detailId=null;state.detailType=null;}
    else if(action==="menu-view-sales"){state.menuView="sales";state.detailId=null;state.detailType=null;}
    else if(action==="cancel-dialog"){state.dialog=null;state.editId=null;state.pendingImageData="";}
    else if(action==="back-detail"){state.detailId=null;state.detailType=null;}
    else if(action.startsWith("ingredient-detail:")){state.detailType="ingredient";state.detailId=Number(action.split(":")[1]);}
    else if(action.startsWith("menu-detail:")){state.detailType="menu";state.detailId=Number(action.split(":")[1]);}
    else if(action.startsWith("record-menu-sale:")){state.editId=Number(action.split(":")[1]);state.dialog="record-menu-sale";state.pendingImageData="";}
    else if(action==="edit-detail"){state.editId=state.detailId;state.dialog=state.detailType==="ingredient"?"edit-ingredient":"edit-menu";state.detailId=null;}
    else if(action==="delete-detail"){if(window.confirm(t("confirmDelete"))){const key=state.detailType==="ingredient"?"ingredients":"menus";state[key]=state[key].filter(x=>x.id!==state.detailId);if(key==="menus")persistMenuWorkspace();state.detailId=null;state.detailType=null;}}
    render();
  }
  pageContent?.addEventListener("click",event=>{const target=event.target instanceof Element?event.target:null;const chat=target?.closest("[data-chat-id]");if(chat){const saved=state.aiChats.find(item=>item.id===Number(chat.dataset.chatId));if(saved){state.activeAiChatId=saved.id;state.aiMessages=[...saved.messages];state.aiView="chat";render();}return;}const prompt=target?.closest("[data-prompt]");if(prompt){const box=pageContent.querySelector('textarea[name="message"]');if(box){box.value=prompt.dataset.prompt;box.focus();}return;}const nav=target?.closest("[data-page]");if(nav&&state.mode==="manage"){const id=nav.dataset.page;if(pages.some(p=>p.id===id)){state.managePage=id;state.detailId=null;state.dialog=null;render();window.scrollTo({top:0,behavior:"auto"});}return;}const el=target?.closest("[data-action]");if(el)handleAction(el.dataset.action);});
  pageContent?.addEventListener("input",event=>{
    if(event.target?.id==="main-chat-search"){state.aiSearchQuery=event.target.value;const pos=event.target.selectionStart;render();const next=$("#main-chat-search");if(next){next.focus();next.setSelectionRange(pos,pos);}return;}
    if(event.target?.id==="menu-search"){state.menuSearch=event.target.value;const pos=event.target.selectionStart;render();const next=$("#menu-search");if(next){next.focus();next.setSelectionRange(pos,pos);}return;}
    if(["quantity","unitPrice","discount"].includes(event.target?.name)){const form=$("#record-form");if(!form)return;const qty=Number(form.elements.quantity?.value||0),price=Number(form.elements.unitPrice?.value||0),discount=Number(form.elements.discount?.value||0);const preview=$("#net-sale-preview");if(preview)preview.textContent=money(Math.max(0,qty*price-discount));}
  });
  pageContent?.addEventListener("change",event=>{
    if(event.target?.name==="type"){const one=event.target.value===t("oneTime"),box=$("#one-time-fields"),reusable=$("#reusable-menu-fields");if(box)box.style.display=one?"grid":"none";if(reusable)reusable.style.display=one?"none":"grid";}
    if(event.target?.name==="image"){const file=event.target.files?.[0];if(!file){state.pendingImageData="";return;}if(!file.type.startsWith("image/")){toast(t("required"));event.target.value="";return;}if(file.size>2*1024*1024){toast("Please choose an image under 2 MB.");event.target.value="";return;}const reader=new FileReader();reader.onload=()=>{state.pendingImageData=String(reader.result||"");};reader.readAsDataURL(file);}
  });
  pageContent?.addEventListener("submit",event=>{
    if(event.target.id==="ai-composer") {
      event.preventDefault();
      const message=String(new FormData(event.target).get("message")||"").trim();
      if(!message)return;
      state.aiMessages.push(message);
      if(!state.activeAiChatId){state.activeAiChatId=Date.now();state.aiChats.push({id:state.activeAiChatId,title:message.slice(0,48),messages:[...state.aiMessages]});}
      else {const saved=state.aiChats.find(chat=>chat.id===state.activeAiChatId);if(saved)saved.messages=[...state.aiMessages];}
      state.aiView="chat";render();toast(t("aiMessageNotice"));
      return;
    }
    if(event.target.id!=="record-form")return;event.preventDefault();
    const form=event.target;const data=new FormData(form);const d=state.dialog;
    if(d==="ingredient-category"||d==="menu-category"){
      const kind=d==="ingredient-category"?"ingredients":"menu";const name=String(data.get("categoryName")||"").trim();
      if(!name){form.elements.categoryName.reportValidity();return;}
      categoryFor(kind,name);state.managePage=kind==="menu"?"menu":"ingredients";state.dialog=null;render();if(kind==="menu")persistMenuWorkspace();toast(t("savedInPreview"));return;
    }
    if(d==="personal-expense"||d==="edit-personal-expense"){
      const description=String(data.get("description")||"").trim();
      const amount=Number(data.get("amount"));
      const date=String(data.get("date")||"");
      if(!description){form.elements.description.reportValidity();return;}
      if(!Number.isFinite(amount)||amount<=0){form.elements.amount.reportValidity();return;}
      if(!date){form.elements.date.reportValidity();return;}
      const item={id:d==="edit-personal-expense"?state.editId:Date.now(),description,amount,date,category:String(data.get("category")||"").trim(),note:String(data.get("note")||"").trim()};
      if(d==="edit-personal-expense")state.personalExpenses=state.personalExpenses.map(x=>x.id===item.id?item:x);else state.personalExpenses.push(item);
      state.dialog=null;state.editId=null;render();toast(t("personalExpenseSaved"));return;
    }
    if(d==="ingredient"||d==="edit-ingredient"){
      const name=String(data.get("name")||"").trim();if(!name){form.elements.name.reportValidity();return;}
      const type=data.get("type")===t("oneTime")?"one-time":"reusable";
      if(type==="one-time"&&(!data.get("quantity")||!data.get("unit")||!data.get("price"))){toast(t("required"));return;}
      const item={id:d==="edit-ingredient"?state.editId:Date.now(),name,category:categoryFor("ingredients",data.get("category")),type,quantity:type==="one-time"?String(data.get("quantity")):"",unit:type==="one-time"?String(data.get("unit")):"",price:type==="one-time"?String(data.get("price")):""};
      if(d==="edit-ingredient")state.ingredients=state.ingredients.map(x=>x.id===item.id?item:x);else state.ingredients.push(item);
      state.dialog=null;state.editId=null;render();toast(t("savedInPreview"));return;
    }
    if(d==="record-menu-sale"){
      const item=state.menus.find(x=>x.id===state.editId);if(!item)return;
      const quantity=Number(data.get("quantity")),unit=String(data.get("saleUnit")||"").trim(),unitPrice=Number(data.get("unitPrice")),discount=Number(data.get("discount")||0),date=String(data.get("saleDate")||""),time=String(data.get("saleTime")||"");
      if(!Number.isFinite(quantity)||quantity<=0){form.elements.quantity.reportValidity();return;}
      if(!unit){form.elements.saleUnit.reportValidity();return;}
      if(!Number.isFinite(unitPrice)||unitPrice<0){form.elements.unitPrice.reportValidity();return;}
      if(!Number.isFinite(discount)||discount<0||discount>quantity*unitPrice){form.elements.discount.reportValidity();return;}
      if(!date||!time){toast(t("required"));return;}
      state.sales.push({id:Date.now(),menuId:item.id,name:item.name,category:item.category,image:item.image||"",quantity,unit,unitPrice,discount,netSale:Math.round((quantity*unitPrice-discount)*100)/100,date,time,note:String(data.get("saleNote")||"").trim(),status:"completed",type:"reusable"});persistMenuWorkspace();
      state.dialog=null;state.editId=null;render();toast(t("saleSaved"));return;
    }
    if(d==="menu"||d==="edit-menu"){
      const name=String(data.get("name")||"").trim();if(!name){form.elements.name.reportValidity();return;}
      const type=data.get("type")===t("oneTime")?"one-time":"reusable",category=categoryFor("menu",String(data.get("category")||"").trim());
      const image=state.pendingImageData||(d==="edit-menu"?state.menus.find(x=>x.id===state.editId)?.image:"")||"";
      if(type==="one-time"){
        const quantity=Number(data.get("quantity")),unit=String(data.get("saleUnit")||"").trim(),unitPrice=Number(data.get("unitPrice")),discount=Number(data.get("discount")||0),date=String(data.get("saleDate")||""),time=String(data.get("saleTime")||"");
        if(!Number.isFinite(quantity)||quantity<=0){form.elements.quantity.reportValidity();return;}
        if(!unit){form.elements.saleUnit.reportValidity();return;}
        if(!Number.isFinite(unitPrice)||unitPrice<0){form.elements.unitPrice.reportValidity();return;}
        if(!Number.isFinite(discount)||discount<0||discount>quantity*unitPrice){form.elements.discount.reportValidity();return;}
        if(!date||!time){toast(t("required"));return;}
        state.sales.push({id:Date.now(),menuId:null,name,category,image,quantity,unit,unitPrice,discount,netSale:Math.round((quantity*unitPrice-discount)*100)/100,date,time,note:String(data.get("saleNote")||"").trim(),status:"completed",type:"one-time"});persistMenuWorkspace();
        state.menuView="sales";state.dialog=null;state.editId=null;state.pendingImageData="";render();toast(t("saleSaved"));return;
      }
      const price=String(data.get("price")||"").trim(),unit=String(data.get("unit")||"piece").trim(),ingredientIds=data.getAll("ingredientIds").map(Number);
      if(price!==""&&(!Number.isFinite(Number(price))||Number(price)<0)){form.elements.price.reportValidity();return;}
      const item={id:d==="edit-menu"?state.editId:Date.now(),name,category,image,ingredientIds,ingredientNames:state.ingredients.filter(i=>ingredientIds.includes(i.id)).map(i=>i.name),note:String(data.get("note")||"").trim(),price,unit,type:"reusable"};
      if(d==="edit-menu")state.menus=state.menus.map(x=>x.id===item.id?item:x);else state.menus.push(item);persistMenuWorkspace();
      state.dialog=null;state.editId=null;state.pendingImageData="";state.menuView="all";render();toast(t("menuSaved"));
    }
  });
  sidebarContent?.addEventListener("click",event=>{const b=event.target instanceof Element?event.target.closest("[data-page]"):null;if(!b)return;const id=b.getAttribute("data-page");if(!pages.some(p=>p.id===id))return;state.managePage=id;state.detailId=null;state.dialog=null;if(!isDesktop())closeDrawer();render();window.scrollTo({top:0,behavior:"auto"});});
  sidebarContent?.addEventListener("click",event=>{
    const target=event.target instanceof Element?event.target:null;
    const action=target?.closest("[data-ai-action]");
    if(action){
      const key=action.dataset.aiAction;
      if(key==="new-chat"){state.aiMessages=[];state.activeAiChatId=null;state.aiView="chat";state.aiSearchQuery="";}
      else if(key==="recent"){state.aiView="recent";state.aiSearchQuery="";}
      else if(key==="search"){state.aiView="search";state.aiSearchQuery="";}
      else if(key==="settings"){state.aiView="settings";}
      render();return;
    }
    const chat=target?.closest("[data-chat-id]");
    if(chat){const saved=state.aiChats.find(item=>item.id===Number(chat.dataset.chatId));if(saved){state.activeAiChatId=saved.id;state.aiMessages=[...saved.messages];state.aiView="chat";render();}return;}
    const b=target?.closest("[data-page]");if(!b)return;const id=b.dataset.page;if(!pages.some(p=>p.id===id))return;state.managePage=id;state.detailId=null;state.dialog=null;render();window.scrollTo({top:0,behavior:"auto"});
  });
  sidebarContent?.addEventListener("input",event=>{if(event.target?.id==="sidebar-chat-search"){state.aiSearchQuery=event.target.value;const pos=event.target.selectionStart;render();const next=$("#sidebar-chat-search");if(next){next.focus();next.setSelectionRange(pos,pos);}}});
  modeButtons.forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
  menuToggle?.addEventListener("click",()=>drawerIsOpen()?closeDrawer():openDrawer());sidebarClose?.addEventListener("click",()=>drawerIsOpen()?closeDrawer():openDrawer());backdrop?.addEventListener("click",closeDrawer);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeDrawer();if(state.dialog){state.dialog=null;render();}}});
  languageSelect?.addEventListener("change",render);
  themeToggle?.addEventListener("click",()=>{const dark=document.documentElement.dataset.theme!=="dark";document.documentElement.dataset.theme=dark?"dark":"light";document.body.classList.toggle("dark",dark);themeToggle.setAttribute("aria-pressed",String(dark));});
  let touchGestureStart = null;
  // Suppress a swipe-generated click only when it lands near either end
  // of that swipe. Browsers differ on whether the click uses start or release coordinates.
  let swipeClickGuard = null;
  const clearSwipeClickGuard = () => { swipeClickGuard = null; };
  const setSwipeClickGuard = (start, end) => {
    swipeClickGuard = { start, end, expiresAt: Date.now() + 500 };
    window.setTimeout(() => {
      if (swipeClickGuard && swipeClickGuard.expiresAt <= Date.now()) swipeClickGuard = null;
    }, 510);
  };
  document.addEventListener("click", e => {
    const guard = swipeClickGuard;
    if (!guard) return;
    if (Date.now() > guard.expiresAt) { swipeClickGuard = null; return; }
    if (e.detail === 0) return; // Preserve keyboard and assistive-technology activation.
    const near = point => Math.abs(e.clientX - point.x) <= 32 && Math.abs(e.clientY - point.y) <= 32;
    if (!near(guard.start) && !near(guard.end)) return;
    swipeClickGuard = null;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  document.addEventListener("touchstart", e => {
    clearSwipeClickGuard();
    if (!e.changedTouches.length) return;
    const touch = e.changedTouches[0];
    touchGestureStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true, capture: true });
  document.addEventListener("touchend", e => {
    if (!touchGestureStart || !e.changedTouches.length) return;
    const start = touchGestureStart;
    touchGestureStart = null;
    const touch = e.changedTouches[0];
    const end = { x: touch.clientX, y: touch.clientY };
    const dx = end.x - start.x, dy = end.y - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    setSwipeClickGuard(start, end);
    const nextMode = state.mode === "ai" ? "manage" : "ai";
    window.setTimeout(() => setMode(nextMode), 0);
  }, { passive: true, capture: true });
  document.addEventListener("touchcancel", () => { touchGestureStart = null; }, { passive: true, capture: true });
  // Mouse and pen use the same swipe guard; touch is handled above.
  document.addEventListener("pointerdown", e => {
    if (e.pointerType === "touch") return;
    clearSwipeClickGuard();
    if (e.isPrimary === false || (e.pointerType === "mouse" && e.button !== 0)) { state.tracking = false; return; }
    state.touchX = e.clientX; state.touchY = e.clientY; state.tracking = true;
  }, { passive: true, capture: true });
  document.addEventListener("pointerup", e => {
    if (!state.tracking) return;
    state.tracking = false;
    const start = { x: state.touchX, y: state.touchY };
    const end = { x: e.clientX, y: e.clientY };
    const dx = end.x - start.x, dy = end.y - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    setSwipeClickGuard(start, end);
    const nextMode = state.mode === "ai" ? "manage" : "ai";
    window.setTimeout(() => setMode(nextMode), 0);
  }, { passive: true, capture: true });
  document.addEventListener("pointercancel", () => { state.tracking = false; }, { passive: true, capture: true });
  window.addEventListener("resize",()=>closeDrawer());
  let deferredInstallPrompt = null;
  const connectionStatus = $("#connection-status");
  const installButton = $("#install-button");
  function updateConnectionStatus() {
    if (!connectionStatus) return;
    const online = navigator.onLine;
    connectionStatus.textContent = online ? "Online" : "Offline";
    connectionStatus.dataset.state = online ? "online" : "offline";
    connectionStatus.setAttribute("aria-label", online ? "Connection status: Online" : "Connection status: Offline");
  }
  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) installButton.hidden = false;
  });
  installButton?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (installButton) installButton.hidden = true;
  });
  closeDrawer();
  updateConnectionStatus();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    const basePath = document.querySelector('meta[name="kitchai-base-path"]')?.getAttribute("content") || "/";
    navigator.serviceWorker.register(basePath + "sw.js", { scope: basePath }).catch(error => {
      console.error("KitchAI service worker registration failed", error);
    });
  }

  initializeMenuPersistence();
})();