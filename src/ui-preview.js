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
  const sidebarMinimize = $("#sidebar-minimize");
  const pages = [
    { id: "dashboard", en: "Dashboard", my: "Dashboard" },
    { id: "menu", en: "Menu", my: "Menu" },
    { id: "ingredients", en: "Ingredients", my: "ကုန်ကြမ်းပစ္စည်းများ" },
    { id: "sales", en: "Sales", my: "အရောင်း" },
    { id: "expenses", en: "Expenses", my: "လုပ်ငန်းအသုံးစရိတ်" },
    { id: "reports", en: "Business Reports", my: "လုပ်ငန်းအစီရင်ခံစာများ" },
    { id: "settings", en: "Settings", my: "Settings" }
  ];
  const pageDescriptions = {
    dashboard: { en: "A clear overview of your kitchen business.", my: "သင့်အစားအသောက်လုပ်ငန်း၏ အခြေအနေကို တစ်နေရာတည်းမှ ကြည့်ရှုနိုင်သည်။", th: "ดูภาพรวมธุรกิจอาหารของคุณได้ในที่เดียว" },
    menu: { en: "Manage the food and drinks you offer and their selling prices.", my: "ရောင်းချမည့် အစားအသောက်များနှင့် ရောင်းဈေးများကို စီမံပါ။", th: "จัดการรายการอาหารและเครื่องดื่มพร้อมราคาขาย" },
    ingredients: { en: "Keep your ingredient and raw-material records organized.", my: "ကုန်ကြမ်းနှင့် ပါဝင်ပစ္စည်းများ၏ မှတ်တမ်းများကို စနစ်တကျ ထိန်းသိမ်းပါ။", th: "จัดระเบียบข้อมูลวัตถุดิบและส่วนผสมของคุณ" },
    sales: { en: "Record sales and review your sales history.", my: "အရောင်းမှတ်တမ်းတင်ပြီး အရောင်းမှတ်တမ်းဟောင်းများကို ပြန်ကြည့်ပါ။", th: "บันทึกยอดขายและดูประวัติการขาย" },
    expenses: { en: "Record and review the costs of running your business.", my: "လုပ်ငန်းလည်ပတ်မှုအတွက် ကုန်ကျစရိတ်များကို မှတ်တမ်းတင်ပြီး ပြန်လည်စစ်ဆေးပါ။", th: "บันทึกและตรวจสอบค่าใช้จ่ายในการดำเนินธุรกิจ" },
    reports: { en: "Review business performance and recorded activity.", my: "လုပ်ငန်း၏ ရလဒ်များနှင့် မှတ်တမ်းတင်ထားသော လုပ်ဆောင်ချက်များကို ပြန်လည်ကြည့်ရှုပါ။", th: "ตรวจสอบผลการดำเนินงานและกิจกรรมที่บันทึกไว้" },
    settings: { en: "Adjust your KitchAI workspace preferences.", my: "KitchAI အသုံးပြုမှုဆိုင်ရာ သတ်မှတ်ချက်များကို ပြင်ဆင်ပါ။", th: "ปรับการตั้งค่าการใช้งาน KitchAI ของคุณ" }
  };
  const labels = {
    en: { ai:"AI Mode", manage:"Manage Mode", aiTitle:"AI workspace", aiDescription:"Start with your kitchen questions here. AI responses will be connected after the frontend is confirmed.", aiWelcome:"Ask KitchAI about your kitchen", aiStart:"Start a conversation here. AI replies will be connected after the frontend is confirmed.", aiMessage:"Message", aiPlaceholder:"Ask about your kitchen...", aiPreviewOnly:"Frontend preview only · AI service not connected", aiSend:"Send", aiMessageNotice:"Message shown in preview only; AI is not connected yet.", manageIntro:"Manage your business in one place.", building:"This page will be built from the requirements you confirm.", navigation:"Manage Mode", workspace:"Frontend prototype", openNavigation:"Open navigation", closeNavigation:"Close navigation", appearance:"Toggle light and dark theme", language:"Interface language", emptyTitle:"No data yet", emptyCopy:"Start by adding your first record.", create:"Create", createCategory:"Create Category", createIngredient:"Create Ingredient", createMenu:"Create Menu", menuSave:"Save", search:"Search", all:"All", category:"Category", name:"Name", cancel:"Cancel", save:"Create", default:"Default", reusable:"Reusable", oneTime:"One time", type:"Type", quantity:"Quantity", unit:"Unit", price:"Price", note:"Note (optional)", sellingPrice:"Selling price", ingredients:"Ingredients", noIngredients:"No ingredients yet. You can add them later.", notNow:"I’m not adding ingredients yet", back:"Back", edit:"Edit", delete:"Delete", update:"Save changes", confirmDelete:"Delete this record?", details:"Details", chooseCategory:"Choose or type a category", required:"This field is required.", aiOnly:"AI Mode UI is a placeholder in this frontend stage.", savedInPreview:"Added to this preview only; it is not saved to a database.", personalExpenseIntro:"Track your own spending separately from business expenses.", addPersonalExpense:"Add personal expense", personalExpenseEmpty:"No personal expenses yet.", personalExpenseEmptyCopy:"Add your first personal expense to start tracking your spending.", expenseDescription:"What did you spend on?", expenseDate:"Date", expenseAmount:"Amount", expenseCategory:"Category", expenseNote:"Note (optional)", personalExpenseTotal:"Recorded personal spending", personalExpenseCount:"Entries", editPersonalExpense:"Edit personal expense", deletePersonalExpense:"Delete expense", personalExpenseSaved:"Personal expense added to this preview only.", personalExpenseCategories:"Examples: Food, Transport, Shopping, Bills", personalExpenseDeleteConfirm:"Delete this personal expense?", menuStorageSaveError:"Menu data could not be saved on this device.", menuStorageUnavailable:"Local Menu storage is unavailable in this browser.", imageTooLarge:"Please choose an image under 2 MB.", menuIntro:"Browse menus by category and review sales history.", allMenus:"All Menus", salesHistory:"Sales History", addMenu:"Add Menu", menuEmpty:"No menus yet.", menuEmptyCopy:"Create a reusable menu or record a one-time sale.", menuType:"Menu type", image:"Image (optional)", oneTimeSale:"One-time sale details", unitPrice:"Unit price", discount:"Discount", netSale:"Net sale", saleDate:"Sale date", saleTime:"Sale time", salesCount:"Sales", noSalesAll:"No sales recorded yet.", saleSaved:"Sale saved on this device only; cloud sync is not connected.", menuSaved:"Menu data is saved on this device only; cloud sync is not connected.", noSales:"No sales recorded for this menu yet.", recordSale:"Record Sale" },
    my: { ai:"AI အသုံးပြုမှု", manage:"စီမံခန့်ခွဲမှု", aiTitle:"AI လုပ်ငန်းခွင်", aiDescription:"ဒီနေရာမှာ မီးဖိုချောင်နဲ့ပတ်သက်တဲ့ မေးခွန်းတွေ စတင်မေးနိုင်ပါတယ်။ Frontend အတည်ပြုပြီးမှ AI အဖြေဝန်ဆောင်မှုကို ချိတ်ဆက်မယ်။", aiWelcome:"KitchAI ကို မီးဖိုချောင်အကြောင်း မေးမြန်းပါ", aiStart:"ဒီနေရာမှာ စကားဝိုင်း စတင်နိုင်ပါတယ်။ Frontend အတည်ပြုပြီးမှ AI အဖြေဝန်ဆောင်မှု ချိတ်ဆက်ပါမယ်။", aiMessage:"စာတို", aiPlaceholder:"မီးဖိုချောင်အကြောင်း မေးပါ...", aiPreviewOnly:"Frontend စမ်းသပ်ဗားရှင်းသာဖြစ်ပြီး AI ဝန်ဆောင်မှု မချိတ်ဆက်ရသေးပါ", aiSend:"ပို့ရန်", aiMessageNotice:"ဒီစာတိုကို Preview ထဲမှာသာ ပြထားပါတယ်။ AI မချိတ်ဆက်ရသေးပါ။", manageIntro:"လုပ်ငန်းကို တစ်နေရာတည်းမှာ စီမံခန့်ခွဲပါ။", building:"ဒီစာမျက်နှာကို အတည်ပြုထားတဲ့ လိုအပ်ချက်တွေအတိုင်း တည်ဆောက်သွားမယ်။", navigation:"စီမံခန့်ခွဲမှု", workspace:"Frontend စမ်းသပ်ဗားရှင်း", openNavigation:"Navigation ဖွင့်ရန်", closeNavigation:"Navigation ပိတ်ရန်", appearance:"Theme ပြောင်းရန်", language:"ဘာသာစကား", emptyTitle:"အချက်အလက် မရှိသေးပါ", emptyCopy:"ပထမဆုံးအချက်အလက်ကို စတင်ထည့်သွင်းပါ။", create:"အသစ်ထည့်ရန်", createCategory:"Category အသစ်", createIngredient:"Ingredient အသစ်", createMenu:"Menu အသစ်", menuSave:"သိမ်းရန်", search:"ရှာရန်", all:"အားလုံး", category:"အမျိုးအစား", name:"အမည်", cancel:"မလုပ်တော့ပါ", save:"ထည့်သွင်းရန်", default:"မူလ", reusable:"ထပ်မံအသုံးပြုနိုင်သော", oneTime:"တစ်ကြိမ်သုံး", type:"အမျိုးအစား", quantity:"အရေအတွက်", unit:"ယူနစ်", price:"ဈေးနှုန်း", note:"မှတ်ချက် (မဖြစ်မနေမဟုတ်)", sellingPrice:"ရောင်းဈေး", ingredients:"ကုန်ကြမ်းနှင့် ပါဝင်ပစ္စည်းများ", noIngredients:"Ingredient မရှိသေးပါ။ နောက်မှထည့်နိုင်ပါတယ်။", notNow:"အခု Ingredients မထည့်သေးပါ", back:"နောက်သို့", edit:"ပြင်ရန်", delete:"ဖျက်ရန်", update:"ပြင်ဆင်ချက်သိမ်းရန်", confirmDelete:"ဒီအချက်အလက်ကို ဖျက်မှာသေချာပါသလား။", details:"အသေးစိတ်", chooseCategory:"Category ရွေးရန် သို့မဟုတ် အသစ်ရိုက်ရန်", required:"ဒီအကွက်ကို ဖြည့်ရန်လိုပါတယ်။", aiOnly:"ဒီအဆင့်မှာ AI Mode UI ကို နမူနာအဖြစ်သာ ပြထားပါတယ်။", savedInPreview:"ဒီ preview ထဲမှာသာ ထည့်ထားတာဖြစ်ပြီး database ထဲ မသိမ်းရသေးပါ။", personalExpenseIntro:"လုပ်ငန်းအသုံးစရိတ်နဲ့ သီးခြားခွဲပြီး ကိုယ်ပိုင်အသုံးစရိတ်တွေကို မှတ်တမ်းတင်ပါ။", addPersonalExpense:"ကိုယ်ပိုင်အသုံးစရိတ် ထည့်ရန်", personalExpenseEmpty:"ကိုယ်ပိုင်အသုံးစရိတ် မရှိသေးပါ။", personalExpenseEmptyCopy:"အသုံးစရိတ် စတင်မှတ်တမ်းတင်ရန် ပထမဆုံးစာရင်းကို ထည့်ပါ။", expenseDescription:"ဘာအတွက် သုံးခဲ့သလဲ", expenseDate:"ရက်စွဲ", expenseAmount:"ပမာဏ", expenseCategory:"အမျိုးအစား", expenseNote:"မှတ်ချက် (မဖြစ်မနေမဟုတ်)", personalExpenseTotal:"မှတ်တမ်းတင်ထားသော ကိုယ်ပိုင်အသုံးစရိတ်", personalExpenseCount:"စာရင်းအရေအတွက်", editPersonalExpense:"ကိုယ်ပိုင်အသုံးစရိတ် ပြင်ရန်", deletePersonalExpense:"အသုံးစရိတ် ဖျက်ရန်", personalExpenseSaved:"ကိုယ်ပိုင်အသုံးစရိတ်ကို Preview ထဲမှာသာ ထည့်ထားပါတယ်။", personalExpenseCategories:"ဥပမာ - အစားအသောက်၊ ခရီးစရိတ်၊ ဈေးဝယ်၊ ဘေလ်", personalExpenseDeleteConfirm:"ဒီကိုယ်ပိုင်အသုံးစရိတ်ကို ဖျက်မှာ သေချာပါသလား။", menuStorageSaveError:"ဒီစက်ထဲမှာ မီနူးအချက်အလက်ကို သိမ်းဆည်း၍ မရပါ။", menuStorageUnavailable:"ဒီဘရောက်ဇာမှာ စက်တွင်းသိမ်းဆည်းမှုကို အသုံးမပြုနိုင်ပါ။", imageTooLarge:"ပုံအရွယ်အစား ၂ MB ထက်မကျော်ရပါ။", menuIntro:"အမျိုးအစားအလိုက် မီနူးများကို ကြည့်ရှုပြီး အရောင်းမှတ်တမ်းကို စစ်ဆေးပါ။", allMenus:"မီနူးအားလုံး", salesHistory:"အရောင်းမှတ်တမ်း", addMenu:"မီနူးထည့်ရန်", menuEmpty:"မီနူး မရှိသေးပါ။", menuEmptyCopy:"ထပ်ခါတလဲလဲ ရောင်းချနိုင်သော မီနူးတစ်ခု ဖန်တီးပါ သို့မဟုတ် တစ်ကြိမ်တည်းရောင်းချမှုကို မှတ်တမ်းတင်ပါ။", menuType:"မီနူးအမျိုးအစား", image:"ပုံ (မဖြစ်မနေမဟုတ်)", oneTimeSale:"တစ်ကြိမ်တည်းရောင်းချမှု အသေးစိတ်", unitPrice:"တစ်ယူနစ်ဈေးနှုန်း", discount:"လျှော့ဈေး", netSale:"အသားတင်ရောင်းရငွေ", saleDate:"ရောင်းချသည့်ရက်", saleTime:"ရောင်းချသည့်အချိန်", salesCount:"အရောင်းအကြိမ်ရေ", noSalesAll:"အရောင်းမှတ်တမ်း မရှိသေးပါ။", saleSaved:"အရောင်းမှတ်တမ်းကို ဒီစက်ထဲမှာသာ သိမ်းထားပြီး cloud sync မချိတ်ဆက်ရသေးပါ။", menuSaved:"မီနူးအချက်အလက်ကို ဒီစက်ထဲမှာသာ သိမ်းထားပြီး cloud sync မချိတ်ဆက်ရသေးပါ။", noSales:"ဒီမီနူးအတွက် အရောင်းမှတ်တမ်း မရှိသေးပါ။", recordSale:"အရောင်းမှတ်တမ်းတင်ရန်" },
    th: { ai:"โหมด AI", manage:"โหมดจัดการ", aiTitle:"พื้นที่ AI", aiDescription:"เริ่มถามคำถามเกี่ยวกับครัวของคุณได้ที่นี่ ระบบ AI จะเชื่อมต่อหลังจากยืนยันส่วนหน้าแล้ว", aiWelcome:"ถาม KitchAI เกี่ยวกับครัวของคุณ", aiStart:"เริ่มบทสนทนาได้ที่นี่ ระบบ AI จะเชื่อมต่อหลังจากยืนยันส่วนหน้าแล้ว", aiMessage:"ข้อความ", aiPlaceholder:"ถามเกี่ยวกับครัวของคุณ...", aiPreviewOnly:"ตัวอย่างส่วนหน้าเท่านั้น ยังไม่ได้เชื่อมต่อบริการ AI", aiSend:"ส่ง", aiMessageNotice:"แสดงข้อความนี้ในตัวอย่างเท่านั้น ยังไม่ได้เชื่อมต่อ AI", manageIntro:"จัดการธุรกิจของคุณในที่เดียว", building:"หน้านี้จะสร้างตามข้อกำหนดที่ยืนยัน", navigation:"โหมดจัดการ", workspace:"ต้นแบบส่วนหน้า", openNavigation:"เปิดเมนูนำทาง", closeNavigation:"ปิดเมนูนำทาง", appearance:"สลับธีม", language:"ภาษา", emptyTitle:"ยังไม่มีข้อมูล", emptyCopy:"เริ่มต้นด้วยการเพิ่มรายการแรก", create:"สร้าง", createCategory:"สร้างหมวดหมู่", createIngredient:"สร้างวัตถุดิบ", createMenu:"สร้างเมนู", menuSave:"บันทึก", search:"ค้นหา", all:"ทั้งหมด", category:"หมวดหมู่", name:"ชื่อ", cancel:"ยกเลิก", save:"สร้าง", default:"ค่าเริ่มต้น", reusable:"ใช้ซ้ำ", oneTime:"ครั้งเดียว", type:"ประเภท", quantity:"จำนวน", unit:"หน่วย", price:"ราคา", note:"หมายเหตุ (ไม่บังคับ)", sellingPrice:"ราคาขาย", ingredients:"วัตถุดิบ", noIngredients:"ยังไม่มีวัตถุดิบ เพิ่มภายหลังได้", notNow:"ยังไม่เพิ่มวัตถุดิบตอนนี้", back:"กลับ", edit:"แก้ไข", delete:"ลบ", update:"บันทึก", confirmDelete:"ต้องการลบรายการนี้หรือไม่", details:"รายละเอียด", chooseCategory:"เลือกหรือพิมพ์หมวดหมู่", required:"จำเป็นต้องกรอกข้อมูลนี้", aiOnly:"พื้นที่ AI เป็นตัวอย่างในขั้นตอนนี้", savedInPreview:"เพิ่มในตัวอย่างนี้เท่านั้น ยังไม่ได้บันทึกลงฐานข้อมูล", personalExpenseIntro:"บันทึกรายจ่ายส่วนตัวแยกจากรายจ่ายของธุรกิจ", addPersonalExpense:"เพิ่มรายจ่ายส่วนตัว", personalExpenseEmpty:"ยังไม่มีรายจ่ายส่วนตัว", personalExpenseEmptyCopy:"เพิ่มรายการแรกเพื่อเริ่มติดตามรายจ่ายส่วนตัว", expenseDescription:"ใช้จ่ายเรื่องอะไร", expenseDate:"วันที่", expenseAmount:"จำนวนเงิน", expenseCategory:"หมวดหมู่", expenseNote:"หมายเหตุ (ไม่บังคับ)", personalExpenseTotal:"ยอดรายจ่ายส่วนตัวที่บันทึก", personalExpenseCount:"รายการ", editPersonalExpense:"แก้ไขรายจ่ายส่วนตัว", deletePersonalExpense:"ลบรายจ่าย", personalExpenseSaved:"เพิ่มรายจ่ายส่วนตัวในตัวอย่างนี้เท่านั้น", personalExpenseCategories:"ตัวอย่าง: อาหาร, เดินทาง, ช้อปปิ้ง, บิล", personalExpenseDeleteConfirm:"ต้องการลบรายจ่ายส่วนตัวนี้หรือไม่", menuStorageSaveError:"ไม่สามารถบันทึกข้อมูลเมนูลงในอุปกรณ์นี้ได้", menuStorageUnavailable:"ไม่สามารถใช้พื้นที่จัดเก็บในเบราว์เซอร์นี้ได้", imageTooLarge:"โปรดเลือกรูปภาพที่มีขนาดไม่เกิน 2 MB", menuIntro:"ดูเมนูตามหมวดหมู่และตรวจสอบประวัติการขาย", allMenus:"เมนูทั้งหมด", salesHistory:"ประวัติการขาย", addMenu:"เพิ่มเมนู", menuEmpty:"ยังไม่มีเมนู", menuEmptyCopy:"สร้างเมนูที่ใช้ซ้ำได้หรือบันทึกการขายครั้งเดียว", menuType:"ประเภทเมนู", image:"รูปภาพ (ไม่บังคับ)", oneTimeSale:"รายละเอียดการขายครั้งเดียว", unitPrice:"ราคาต่อหน่วย", discount:"ส่วนลด", netSale:"ยอดขายสุทธิ", saleDate:"วันที่ขาย", saleTime:"เวลาขาย", salesCount:"จำนวนครั้งที่ขาย", noSalesAll:"ยังไม่มีบันทึกการขาย", saleSaved:"บันทึกการขายไว้ในอุปกรณ์นี้เท่านั้น ยังไม่ได้เชื่อมต่อซิงก์คลาวด์", menuSaved:"บันทึกข้อมูลเมนูไว้ในอุปกรณ์นี้เท่านั้น ยังไม่ได้เชื่อมต่อซิงก์คลาวด์", noSales:"ยังไม่มีบันทึกการขายสำหรับเมนูนี้", recordSale:"บันทึกการขาย" }
  };
  const state = { menuFormOpen:false, mode:"ai", aiPage:"ai", managePage:"dashboard", touchX:0, touchY:0, tracking:false, drawerGesture:false, dialog:null, dateFilterOpen:false, dateFilter:{preset:"today",start:"",end:""}, dateFilterDraft:null, dateCalendarTarget:null, dateCalendarMonth:"", dateCalendarView:"day", categoryTarget:null, detailId:null, detailType:null, editId:null, categories:{ingredients:["Default"],menu:["Default"]}, ingredients:[], menus:[], sales:[], menuView:"all", menuSearch:"", menuCategoryFilter:"all", ingredientSearch:"", ingredientCategoryFilter:"all", pendingImageData:"", personalExpenses:[], aiMessages:[], aiChats:[], activeAiChatId:null, aiView:"chat", aiSearchQuery:"" };
  // Keep an independent UI snapshot for each mode so switching modes never discards unfinished work.
  const modeWorkspaceSnapshots = { ai:null, manage:null };
  let menuPersistenceReady = false;
  let menuPersistenceModule = null;
  async function persistMenuWorkspace() {
    if (!menuPersistenceReady || !menuPersistenceModule) return;
    try {
      await menuPersistenceModule.saveMenuWorkspace({ menus: state.menus, sales: state.sales, categories: state.categories.menu });
    } catch (error) {
      console.error("KitchAI could not save local Menu data", error);
      toast(t("menuStorageSaveError"));
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
      toast(t("menuStorageUnavailable"));
    } finally {
      menuPersistenceReady = true;
      render();
    }
  }
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const language = () => labels[languageSelect?.value] ? languageSelect.value : "en";
  const t = key => labels[language()][key] || labels.en[key] || key;
  const sharedTranslation = key => {
    const sharedWindow = /** @type {Window & { KitchAI18n?: { translate: (key: string) => string, setLocale?: (locale: string) => string } }} */ (window);
    // Both the legacy preview catalog and shared catalog must read the same active locale.
    // Synchronize at the translation boundary so every existing screen is covered,
    // including render paths that run before or outside the selector change handler.
    const activeLocale = language();
    if (sharedWindow.KitchAI18n?.setLocale) sharedWindow.KitchAI18n.setLocale(activeLocale);
    const value = sharedWindow.KitchAI18n?.translate(key);
    return value && value !== key ? value : "";
  };
  const pageTranslationKeys = { dashboard: "navigation.dashboard", menu: "navigation.menu", ingredients: "navigation.ingredients", sales: "navigation.sales", expenses: "navigation.expenses", reports: "navigation.reports", settings: "navigation.settings" };
  const pageLabel = page => sharedTranslation(pageTranslationKeys[page.id]) || page[language()] || page.en;
  const isDesktop = () => window.matchMedia("(min-width: 761px)").matches;
  const openDrawer = () => {
    appShell?.classList.remove("sidebar-collapsed");
    menuToggle?.setAttribute("aria-label", t("closeNavigation"));
    menuToggle?.setAttribute("title", t("closeNavigation"));
    menuToggle?.setAttribute("aria-expanded", "true");
    if (menuToggle) menuToggle.textContent = "☰";
  };
  const closeDrawer = () => {
    appShell?.classList.add("sidebar-collapsed");
    menuToggle?.setAttribute("aria-label", t("openNavigation"));
    menuToggle?.setAttribute("title", t("openNavigation"));
    menuToggle?.setAttribute("aria-expanded", "false");
    if (menuToggle) menuToggle.textContent = "☰";
  };
  const drawerIsOpen = () => !appShell?.classList.contains("sidebar-collapsed");
  const button = (label, action, primary=false) => '<button type="button" class="ui-button '+(primary?'ui-button--primary':'ui-button--secondary')+'" data-action="'+action+'">'+esc(label)+'</button>';
  const field = (label, name, type="text", value="", required=false, extra="") => '<label class="ui-field"><span class="ui-label">'+esc(label)+(required?' *':'')+'</span><input class="ui-input" name="'+esc(name)+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required':'')+' '+extra+'></label>';
  const selectField = (label,name,options,selected="") => '<label class="ui-field"><span class="ui-label">'+esc(label)+'</span><select class="ui-select" name="'+esc(name)+'">'+options.map(o=>'<option value="'+esc(o)+'" '+(o===selected?'selected':'')+'>'+esc(o)+'</option>').join("")+'</select></label>';
  const categoryField = (kind, selected="Default") => '<label class="ui-field"><span class="ui-label">'+t("category")+'</span><input class="ui-input" name="category" list="category-options" value="'+esc(selected)+'" placeholder="'+esc(t("chooseCategory"))+'"><datalist id="category-options">'+state.categories[kind].map(c=>'<option value="'+esc(c)+'"></option>').join("")+'</datalist></label>';
  function renderSidebar() {
    if (!sidebarContent) return;
    if (state.mode==="ai") {
      const actions=[["new-chat","＋","ai.newChat","New Chat"],["recent","◷","ai.recentChats","Recent Chats"],["search","⌕","ai.searchChats","Search Chats"],["settings","⚙","ai.settings","AI Settings"]];
      let html=actions.map(([id,icon,key,fallback])=>{const label=sharedTranslation(key)||fallback;return '<button type="button" class="nav-item ai-nav-item'+(state.aiView===id?' active':'')+'" data-ai-action="'+id+'" title="'+esc(label)+'"><span class="nav-icon" aria-hidden="true">'+icon+'</span><span>'+esc(label)+'</span></button>';}).join("");
      const chats=state.aiChats.slice().reverse();
      if(state.aiView==="search") { const searchLabel=sharedTranslation("ai.searchChats")||"Search chats"; html+='<label class="sidebar-search"><span class="sr-only">'+esc(searchLabel)+'</span><input id="sidebar-chat-search" type="search" value="'+esc(state.aiSearchQuery)+'" placeholder="'+esc(searchLabel)+'"></label>'; }
      if(state.aiView==="recent"||state.aiView==="search"||chats.length){
        html+='<div class="nav-section-label ai-recent-label">'+esc(sharedTranslation("ai.recentChats")||"Recent Chats")+'</div>';
        const filtered=chats.filter(chat=>state.aiView!=="search"||!state.aiSearchQuery||chat.title.toLowerCase().includes(state.aiSearchQuery.toLowerCase()));
        html+=filtered.slice(0,state.aiView==="recent"||state.aiView==="search"?20:5).map(chat=>'<button type="button" class="nav-item chat-history-item" data-chat-id="'+chat.id+'" title="'+esc(chat.title)+'"><span class="nav-icon" aria-hidden="true">◦</span><span>'+esc(chat.title)+'</span></button>').join("");
        if(!filtered.length)html+='<p class="empty-history">'+esc(sharedTranslation("ai.noChats")||"No chats yet")+'</p>';
      }
      sidebarContent.innerHTML=html;return;
    }
    sidebarContent.innerHTML='<div class="nav-section-label">'+esc(sharedTranslation("navigation.manage")||t("navigation"))+'</div>'+pages.map(page=>'<button type="button" class="nav-item'+(state.managePage===page.id?' active':'')+'" data-page="'+page.id+'" aria-current="'+(state.managePage===page.id?'page':'false')+'" title="'+esc(pageLabel(page))+'"><span class="nav-icon" aria-hidden="true">'+({dashboard:"▦",menu:"≡",ingredients:"◈",sales:"↗",expenses:"−",reports:"▥",settings:"⚙"}[page.id])+'</span><span>'+esc(pageLabel(page))+'</span></button>').join("");
  }
  function pageHeader(title, intro, actions="") {
    return '<section class="page-section"><div class="ui-row ui-row--mobile-stack" style="justify-content:space-between;align-items:flex-start"><div><p class="eyebrow">'+esc(t("manage"))+'</p><h1>'+esc(title)+'</h1><p>'+esc(intro)+'</p></div><div class="ui-row">'+actions+'</div></div>';
  }
  function emptyState(title, copy, action) {
    return '<div class="ui-empty-state"><div aria-hidden="true" style="font-size:32px;color:var(--color-primary)">+</div><h2>'+esc(title)+'</h2><p>'+esc(copy)+'</p>'+action+'</div>';
  }
  const dateFilterCopy = {
    en: { title:"Date Filter", description:"Choose which dates to use for this page.", today:"Today", yesterday:"Yesterday", thisWeek:"This Week", last7Days:"Last 7 Days", thisMonth:"This Month", lastMonth:"Last Month", singleDate:"Single Date", custom:"Custom Date Range", start:"Start date", end:"End date", cancel:"Cancel", invalid:"End date must be the same as or later than the start date.", choose:"Choose date filter", chooseDate:"Choose date", previousMonth:"Previous month", nextMonth:"Next month", previousYears:"Previous years", nextYears:"Next years" },
    my: { title:"ရက်စွဲ Filter", description:"ဒီစာမျက်နှာအတွက် ကြည့်မယ့်ရက်ကို ရွေးချယ်ပါ။", today:"ဒီနေ့", yesterday:"မနေ့က", thisWeek:"ဒီအပတ်", last7Days:"လွန်ခဲ့သော ၇ ရက်", thisMonth:"ဒီလ", lastMonth:"ပြီးခဲ့တဲ့လ", singleDate:"ရက်တစ်ရက်တည်း", custom:"စိတ်ကြိုက်ရက်အပိုင်းအခြား", start:"စတင်ရက်", end:"ဆုံးဆုံးရက်", cancel:"မလုပ်တော့ပါ", invalid:"ဆုံးဆုံးရက်သည် စတင်ရက်နှင့် တူရမည် သို့မဟုတ် နောက်ကျရမည်။", choose:"ရက်စွဲ Filter ရွေးရန်", chooseDate:"ရက်စွဲရွေးရန်", previousMonth:"ယခင်လ", nextMonth:"နောက်လ", previousYears:"ယခင်နှစ်များ", nextYears:"နောက်နှစ်များ" },
    th: { title:"ตัวกรองวันที่", description:"เลือกวันที่ที่ต้องการใช้กับหน้านี้", today:"วันนี้", yesterday:"เมื่อวาน", thisWeek:"สัปดาห์นี้", last7Days:"7 วันล่าสุด", thisMonth:"เดือนนี้", lastMonth:"เดือนที่แล้ว", singleDate:"วันเดียว", custom:"กำหนดช่วงวันที่เอง", start:"วันที่เริ่มต้น", end:"วันที่สิ้นสุด", cancel:"ยกเลิก", invalid:"วันที่สิ้นสุดต้องเป็นวันเดียวกันหรือหลังวันที่เริ่มต้น", choose:"เลือกตัวกรองวันที่", chooseDate:"เลือกวันที่", previousMonth:"เดือนก่อนหน้า", nextMonth:"เดือนถัดไป", previousYears:"ปีก่อนหน้า", nextYears:"ปีถัดไป" }
  };
  const dateFilterTranslationKeys = { "title": "dateFilter.title", "description": "dateFilter.description", "today": "dateFilter.today", "yesterday": "dateFilter.yesterday", "thisWeek": "dateFilter.thisWeek", "last7Days": "dateFilter.last7Days", "thisMonth": "dateFilter.thisMonth", "lastMonth": "dateFilter.lastMonth", "singleDate": "dateFilter.singleDate", "custom": "dateFilter.custom", "start": "dateFilter.start", "end": "dateFilter.end", "cancel": "dateFilter.cancel", "invalid": "dateFilter.invalid", "choose": "dateFilter.choose", "chooseDate": "dateFilter.chooseDate", "previousMonth": "dateFilter.previousMonth", "nextMonth": "dateFilter.nextMonth", "previousYears": "dateFilter.previousYears", "nextYears": "dateFilter.nextYears" };
  const dateFilterText = key => {
    const translationKey = dateFilterTranslationKeys[key];
    const sharedWindow = /** @type {Window & { KitchAI18n?: { translate: (key: string) => string } }} */ (window);
    const shared = translationKey && sharedWindow.KitchAI18n?.translate(translationKey);
    return shared && shared !== translationKey ? shared : (dateFilterCopy[language()]?.[key] || dateFilterCopy.en[key] || key);
  };
  const toLocalDate = value => { const [year,month,day]=value.split("-").map(Number); return new Date(year,month-1,day); };
  const dateKey = value => { const date=value instanceof Date?value:toLocalDate(value); return [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-"); };
  const shiftDate = (value,days) => { const date=toLocalDate(value); date.setDate(date.getDate()+days); return dateKey(date); };
  function dateFilterRange(filter=state.dateFilter) {
    const today=localToday();
    if(filter.preset==="singleDate") return {start:filter.start||today,end:filter.start||today};
    if(filter.preset==="custom") return {start:filter.start,end:filter.end};
    if(filter.preset==="yesterday"){const day=shiftDate(today,-1);return {start:day,end:day};}
    if(filter.preset==="thisWeek"){const day=toLocalDate(today);day.setDate(day.getDate()-((day.getDay()+6)%7));return {start:dateKey(day),end:shiftDate(dateKey(day),6)};}
    if(filter.preset==="last7Days") return {start:shiftDate(today,-6),end:today};
    if(filter.preset==="thisMonth"){const day=toLocalDate(today);day.setDate(1);return {start:dateKey(day),end:dateKey(new Date(day.getFullYear(),day.getMonth()+1,0))};}
    if(filter.preset==="lastMonth"){const day=toLocalDate(today);return {start:dateKey(new Date(day.getFullYear(),day.getMonth()-1,1)),end:dateKey(new Date(day.getFullYear(),day.getMonth(),0))};}
    return {start:today,end:today};
  }
  function formatDate(value) {
    if(!value)return "";
    return toLocalDate(value).toLocaleDateString(language()==="my"?"my-MM":language()==="th"?"th-TH":"en-US",{month:"short",day:"numeric",year:"numeric"});
  }
  function dateFilterLabel(filter=state.dateFilter) {
    const key={today:"today",yesterday:"yesterday",thisWeek:"thisWeek",last7Days:"last7Days",thisMonth:"thisMonth",lastMonth:"lastMonth",singleDate:"singleDate",custom:"custom"}[filter.preset]||"today";
    const range=dateFilterRange(filter), label=dateFilterText(key);
    if(filter.preset==="custom") return range.start===range.end?label+" · "+formatDate(range.start):label+" · "+formatDate(range.start)+" – "+formatDate(range.end);
    return label+" · "+(range.start===range.end?formatDate(range.start):formatDate(range.start)+" – "+formatDate(range.end));
  }
  function compactDateFilterLabel(filter=state.dateFilter) {
    const range=dateFilterRange(filter);
    if(["today","yesterday","thisWeek","last7Days","thisMonth","lastMonth"].includes(filter.preset)) return dateFilterText(filter.preset);
    const shortDate=value=>toLocalDate(value).toLocaleDateString(language()==="my"?"my-MM":language()==="th"?"th-TH":"en-US",{month:"short",day:"numeric"});
    if(filter.preset==="singleDate") return shortDate(range.start);
    const start=toLocalDate(range.start),end=toLocalDate(range.end);
    const sameYear=start.getFullYear()===end.getFullYear();
    const startLabel=shortDate(range.start)+(sameYear?"":", "+start.getFullYear());
    const endLabel=sameYear&&start.getMonth()===end.getMonth()?String(end.getDate()):shortDate(range.end)+(sameYear?"":", "+end.getFullYear());
    return startLabel+" – "+endLabel;
  }
  function renderDateFilterTrigger() {
    return '<button type="button" class="ui-button ui-button--secondary date-filter-trigger" data-date-filter="open" aria-label="'+esc(dateFilterText("choose")+": "+dateFilterLabel())+'"><span class="date-filter-trigger-leading"><svg class="date-filter-trigger-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"></rect><path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17"></path></svg><span>'+esc((({en:"Date Picker",my:"ရက်စွဲရွေးရန်",th:"เลือกวันที่"})[language()]||"Date Picker"))+'</span></span><span class="date-filter-trigger-trailing"><span class="date-filter-label-compact">'+esc(compactDateFilterLabel())+'</span><svg class="date-filter-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span></button>';
  }
  function renderDateFilterPage() {
    const presets=[["today","today"],["yesterday","yesterday"],["thisWeek","thisWeek"],["last7Days","last7Days"],["thisMonth","thisMonth"],["lastMonth","lastMonth"]];
    const quick=presets.map(([value,key])=>'<button type="button" class="ui-button ui-button--secondary date-filter-quick'+(state.dateFilter.preset===value?' is-selected':'')+'" data-date-filter="quick:'+value+'" aria-pressed="'+(state.dateFilter.preset===value?'true':'false')+'">'+esc(dateFilterText(key))+'</button>').join("");
    const selectedSingle=state.dateFilterDraft?.singleDate||(state.dateFilter.preset==="singleDate"?state.dateFilter.start:localToday());
    const selectedStart=state.dateFilterDraft?.start||"";
    const selectedEnd=state.dateFilterDraft?.end||"";
    const monthKey=state.dateCalendarMonth||dateKey(selectedSingle).slice(0,7);
    const monthDate=toLocalDate(monthKey+"-01");
    const year=monthDate.getFullYear(),month=monthDate.getMonth();
    const calendarLocale=language()==="my"?"my-MM":language()==="th"?"th-TH":"en-US";
    const monthTitle=monthDate.toLocaleDateString(calendarLocale,{month:"long",year:"numeric"});
    const weekdays=Array.from({length:7},(_,i)=>new Date(2023,0,1+i).toLocaleDateString(calendarLocale,{weekday:"short"}));
    const target=state.dateCalendarTarget;
    const chosen=target==="single"?selectedSingle:target==="start"?selectedStart:selectedEnd;
    const rangeStart=selectedStart,rangeEnd=selectedEnd;
    const view=state.dateCalendarView||"day";
    const monthNames=Array.from({length:12},(_,i)=>new Date(year,i,1).toLocaleDateString(calendarLocale,{month:"long"}));
    const dayOffset=new Date(year,month,1).getDay();
    const daysInMonth=new Date(year,month+1,0).getDate();
    const cellCount=Math.ceil((dayOffset+daysInMonth)/7)*7;
    const dayCells=Array.from({length:cellCount},(_,i)=>{
      const day=i-dayOffset+1;
      if(day<1||day>daysInMonth) return '<span class="date-calendar-day is-outside" aria-hidden="true"></span>';
      const value=dateKey(new Date(year,month,day));
      const isChosen=value===chosen;
      const inRange=target!=="single"&&rangeStart&&rangeEnd&&value>=rangeStart&&value<=rangeEnd;
      return '<button type="button" class="date-calendar-day'+(isChosen?' is-selected':'')+(inRange?' is-in-range':'')+'" data-date-filter="day:'+value+'" aria-label="'+esc(formatDate(value))+'" aria-pressed="'+(isChosen?'true':'false')+'">'+day+'</button>';
    }).join("");
    const yearStart=year-5;
    const yearCells=Array.from({length:12},(_,i)=>yearStart+i).map(item=>'<button type="button" class="date-calendar-choice'+(item===year?' is-selected':'')+'" data-date-filter="pick-year:'+item+'" aria-pressed="'+(item===year?'true':'false')+'">'+item+'</button>').join("");
    const monthCells=monthNames.map((name,i)=>'<button type="button" class="date-calendar-choice'+(i===month?' is-selected':'')+'" data-date-filter="pick-month:'+i+'" aria-pressed="'+(i===month?'true':'false')+'">'+esc(name)+'</button>').join("");
    let calendarBody="";
    let calendarHeader="";
    if(view==="year"){
      calendarHeader='<button type="button" class="date-calendar-nav" data-date-filter="year:-12" aria-label="'+esc(dateFilterText("previousYears"))+'">‹</button><strong>'+yearStart+' – '+(yearStart+11)+'</strong><button type="button" class="date-calendar-nav" data-date-filter="year:12" aria-label="'+esc(dateFilterText("nextYears"))+'">›</button>';
      calendarBody='<div class="date-calendar-choices date-calendar-years">'+yearCells+'</div>';
    }else if(view==="month"){
      calendarHeader='<span aria-hidden="true"></span><button type="button" class="date-calendar-title-button" data-date-filter="view:year">'+year+'</button><span aria-hidden="true"></span>';
      calendarBody='<div class="date-calendar-choices date-calendar-months">'+monthCells+'</div>';
    }else{
      calendarHeader='<button type="button" class="date-calendar-nav" data-date-filter="month:-1" aria-label="'+esc(dateFilterText("previousMonth"))+'">‹</button><div class="date-calendar-title-pair"><button type="button" class="date-calendar-title-button" data-date-filter="view:month">'+esc(monthNames[month])+'</button><button type="button" class="date-calendar-title-button" data-date-filter="view:year">'+year+'</button></div><button type="button" class="date-calendar-nav" data-date-filter="month:1" aria-label="'+esc(dateFilterText("nextMonth"))+'">›</button>';
      calendarBody='<div class="date-calendar-weekdays">'+weekdays.map(day=>'<span>'+day+'</span>').join("")+'</div><div class="date-calendar-days">'+dayCells+'</div>';
    }
    const calendar=target?'<div class="date-calendar" role="group" aria-label="'+esc(monthTitle)+'"><div class="date-calendar-header">'+calendarHeader+'</div>'+calendarBody+'</div>':"";
    const dateField=(label,id,value)=>'<div class="date-filter-field">'+(label?'<span class="ui-label">'+esc(label)+'</span>':'')+'<button type="button" class="date-filter-date-control'+(target===id.replace("date-filter-","")?' is-active':'')+'" data-date-filter="calendar:'+id.replace("date-filter-","")+'" aria-expanded="'+(target===id.replace("date-filter-","")?'true':'false')+'"><span class="date-filter-date-value">'+esc(value?formatDate(value):dateFilterText("chooseDate"))+'</span><svg class="date-filter-date-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"></rect><path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17"></path></svg></button></div>';
    const invalid=selectedStart&&selectedEnd&&selectedEnd<selectedStart;
    return '<section class="page-section date-filter-page" aria-labelledby="date-filter-title"><div class="date-filter-heading"><h1 id="date-filter-title">'+esc(dateFilterText("title"))+'</h1><p>'+esc(dateFilterText("description"))+'</p></div><div class="date-filter-quick-grid" role="group" aria-label="'+esc(dateFilterText("title"))+'">'+quick+'</div><section class="date-filter-custom date-filter-single" aria-labelledby="date-filter-single-title"><h2 id="date-filter-single-title">'+esc(dateFilterText("singleDate"))+'</h2><div class="date-filter-date-grid single-date-grid">'+dateField("","date-filter-single",selectedSingle)+'</div>'+(target==="single"?calendar:"")+'</section><section class="date-filter-custom" aria-labelledby="date-filter-custom-title"><h2 id="date-filter-custom-title">'+esc(dateFilterText("custom"))+'</h2><div class="date-filter-date-grid">'+dateField(dateFilterText("start"),"date-filter-start",selectedStart)+dateField(dateFilterText("end"),"date-filter-end",selectedEnd)+'</div>'+(target==="start"||target==="end"?calendar:"")+'<p class="date-filter-error" id="date-filter-error" role="alert" '+(invalid?'':'hidden')+'>'+esc(dateFilterText("invalid"))+'</p></section><div class="date-filter-actions"><button type="button" class="ui-button ui-button--secondary" data-date-filter="cancel">'+esc(dateFilterText("cancel"))+'</button></div></section>';
  }
  const dashboardMetricCopy = {
    en: { title:"Date Picker", summary:"Financial summary", sample:"Sample", sale:"Sale", businessExpense:"Business Expense", netProfit:"Net Profit", personalExpenses:"Personal Expenses", afterPersonal:"Remaining Profit" },
    my: { title:"ရက်စွဲရွေးရန်", summary:"ငွေကြေးအနှစ်ချုပ်", sample:"နမူနာ", sale:"ရောင်းရငွေ", businessExpense:"လုပ်ငန်းအသုံးစရိတ်", netProfit:"အသားတင်အမြတ်", personalExpenses:"ကိုယ်ပိုင်အသုံးစရိတ်", afterPersonal:"ကျန်ရှိသောအမြတ်" },
    th: { title:"เลือกวันที่", summary:"สรุปการเงิน", sample:"ตัวอย่าง", sale:"ยอดขาย", businessExpense:"ค่าใช้จ่ายธุรกิจ", netProfit:"กำไรสุทธิ", personalExpenses:"ค่าใช้จ่ายส่วนตัว", afterPersonal:"กำไรคงเหลือ" }
  };
  function renderDashboardSummary() {
    const copy = dashboardMetricCopy[language()] || dashboardMetricCopy.en;
    const metrics = [
      { id:"sale", label:copy.sale, sampleValue:"฿5,000", icon:'<path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 8H6"></path><circle cx="10" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle>' },
      { id:"business-expense", label:copy.businessExpense, sampleValue:"฿1,800", icon:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 1 4 16.5z"></path><path d="M4 6h16M8 10h8"></path>' },
      { id:"net-profit", label:copy.netProfit, sampleValue:"฿3,200", icon:'<path d="M4 19V5M4 19h17"></path><path d="m7 15 4-4 3 2 5-6"></path>' },
      { id:"personal-expenses", label:copy.personalExpenses, sampleValue:"฿500", icon:'<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>' },
      { id:"profit-after-personal-spending", label:copy.afterPersonal, sampleValue:"฿2,700", icon:'<path d="M12 3v18M17 7H9.5a3.5 3.5 0 0 0 0 7H14a3 3 0 0 1 0 6H6"></path>' }
    ];
    return '<div class="dashboard-financial-summary" aria-label="'+esc(copy.summary)+'">'+metrics.map(metric=>'<div class="dashboard-metric dashboard-metric--'+metric.id+'" data-dashboard-metric="'+metric.id+'"><div class="dashboard-metric-heading"><span class="dashboard-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+metric.icon+'</svg></span><span class="dashboard-metric-label">'+esc(metric.label)+'</span></div><strong class="dashboard-metric-value" aria-label="'+esc(metric.label+" "+metric.sampleValue)+'">'+esc(metric.sampleValue)+'</strong><span class="dashboard-metric-chevron" aria-hidden="true">&gt;</span></div>').join("")+'</div>';
  }
  function renderMainPage(page) {
    if (page.id === "ingredients") return renderIngredients();
    const description = sharedTranslation("page.description." + page.id) || pageDescriptions[page.id]?.[language()] || pageDescriptions[page.id]?.en || "";
    const isDashboard = page.id === "dashboard";
    const dateFilter = isDashboard ? renderDateFilterTrigger() : "";
    const summary = isDashboard ? renderDashboardSummary() : "";
    return '<section class="page-section main-page-copy'+(isDashboard?' dashboard-page':'')+'"><h1>'+esc(pageLabel(page))+'</h1><p>'+esc(description)+'</p>'+(isDashboard?'<div class="dashboard-financial-panel">'+dateFilter+summary+'</div>':dateFilter+summary)+'</section>';
  }
  function renderIngredients() {
    const categories=[...new Set([...(state.categories.ingredients||[]),...state.ingredients.map(item=>item.category).filter(Boolean)])].filter(category=>category&&category!=="Default");
    const query=state.ingredientSearch.trim().toLowerCase();
    const items=state.ingredients.filter(item=>(state.ingredientCategoryFilter==="all"||(item.category||"Default")===state.ingredientCategoryFilter)&&(!query||item.name.toLowerCase().includes(query))).map(item=>'<button type="button" class="ingredient-list-row" data-action="ingredient-detail:'+item.id+'"><span class="ingredient-list-name">'+esc(item.name)+'</span><span class="ingredient-list-category">'+esc(item.category||"—")+'</span><span class="menu-list-chevron" aria-hidden="true">›</span></button>').join("");
    return '<section class="page-section main-page-copy menu-page ingredients-page"><div class="menu-page-heading"><h1>'+esc(pageLabel(pages.find(p=>p.id==="ingredients")))+'</h1>'+button(t("createIngredient"),"new-ingredient",true)+'</div><div class="menu-list-filters"><label class="ui-field menu-search-field"><span class="ui-label">'+esc(t("search"))+'</span><input class="ui-input" id="ingredient-search" type="search" value="'+esc(state.ingredientSearch)+'" placeholder="'+esc(t("search"))+'"></label><label class="ui-field menu-category-filter"><span class="ui-label">'+esc(t("category"))+'</span><select class="ui-input" id="ingredient-category-filter"><option value="all" '+(state.ingredientCategoryFilter==="all"?"selected":"")+'>'+esc(t("all"))+'</option>'+categories.map(category=>'<option value="'+esc(category)+'" '+(state.ingredientCategoryFilter===category?"selected":"")+'>'+esc(category)+'</option>').join("")+'</select></label></div><div class="ingredient-list-header"><span>'+esc(t("name"))+'</span><span>'+esc(t("category"))+'</span><span></span></div><div class="ingredient-simple-list">'+(items||'<p class="ui-hint menu-list-empty">'+esc(t("emptyTitle"))+'</p>')+'</div></section>';
  }
  function money(value) { return Number(value||0).toLocaleString(undefined,{maximumFractionDigits:2}); }
  function renderMenus() {
    const title=pageLabel(pages.find(p=>p.id==="menu"));
    const categories=[...new Set([...(state.categories.menu||[]),...state.menus.map(item=>item.category).filter(Boolean)])].filter(category=>category&&category!=="Default");
    const query=state.menuSearch.trim().toLowerCase();
    const items=state.menus.filter(item=>(state.menuCategoryFilter==="all"||(item.category||"Default")===state.menuCategoryFilter)&&(!query||item.name.toLowerCase().includes(query))).map(item=>'<button type="button" class="menu-list-row" data-action="menu-detail:'+item.id+'"><span class="menu-list-name">'+esc(item.name)+'</span><span class="menu-list-price">'+esc(item.price!==""&&item.price!=null?money(item.price):"—")+'</span><span class="menu-list-chevron" aria-hidden="true">›</span></button>').join("");
    return '<section class="page-section main-page-copy menu-page"><div class="menu-page-heading"><h1>'+esc(title)+'</h1>'+button(t("createMenu"),"new-menu",true)+'</div><div class="menu-list-filters"><label class="ui-field menu-search-field"><span class="ui-label">'+esc(t("search"))+'</span><input class="ui-input" id="menu-search" type="search" value="'+esc(state.menuSearch)+'" placeholder="'+esc(t("search"))+'"></label><label class="ui-field menu-category-filter"><span class="ui-label">'+esc(t("category"))+'</span><select class="ui-input" id="menu-category-filter"><option value="all" '+(state.menuCategoryFilter==="all"?"selected":"")+'>'+esc(t("all"))+'</option>'+categories.map(category=>'<option value="'+esc(category)+'" '+(state.menuCategoryFilter===category?"selected":"")+'>'+esc(category)+'</option>').join("")+'</select></label></div><div class="menu-list-header"><span>'+esc(t("name"))+'</span><span>'+esc(t("sellingPrice"))+'</span><span></span></div><div class="menu-simple-list">'+(items||'<p class="ui-hint menu-list-empty">'+esc(t("menuEmpty"))+'</p>')+'</div></section>';
  }
  function renderMenuForm() {
    const categories=[...new Set([...(state.categories.menu||[]),...state.menus.map(x=>x.category).filter(Boolean)])].filter(category=>category&&category!=="Default");
    return '<section class="page-section main-page-copy internal-form-screen"><div class="internal-form-heading"><button type="button" class="icon-button menu-form-back" data-action="cancel-menu-form" aria-label="'+esc(t("back"))+'" title="'+esc(t("back"))+'">←</button><h1>'+esc(t("createMenu"))+'</h1></div><form id="record-form" class="ui-card internal-form menu-create-form" novalidate><label class="ui-field"><span class="ui-label">'+esc(t("category"))+' *</span><select class="ui-input" name="category" onchange="const n=this.nextElementSibling;const isNew=this.value===\'__new_category__\';n.hidden=!isNew;n.required=isNew;if(!isNew)n.value=\'\'"><option value="">'+esc(t("chooseCategory"))+'</option>'+categories.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join("")+'<option value="__new_category__">Create new category</option></select><input class="ui-input" name="categoryNew" type="text" maxlength="80" placeholder="New category name" hidden></label>'+field(t("name"),"name","text","",true,'maxlength="100"')+field(t("sellingPrice"),"price","number","",true,'min="0" step="any"')+'<fieldset class="menu-ingredient-field"><legend>'+esc(t("ingredients"))+'</legend>'+(state.ingredients.length?state.ingredients.map(i=>'<label class="ui-check"><input type="checkbox" name="ingredientIds" value="'+i.id+'"><span>'+esc(i.name)+'</span></label>').join(""):'<p class="ui-hint">'+esc(t("noIngredients"))+'</p>')+'</fieldset><div class="internal-form-actions menu-form-actions"><button type="button" class="ui-button ui-button--secondary" data-action="cancel-menu-form">'+esc(t("cancel"))+'</button><button type="submit" class="ui-button ui-button--primary">'+esc(t("menuSave"))+'</button></div></form></section>';
  }
  function localToday() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth()+1).padStart(2,"0"), String(now.getDate()).padStart(2,"0")].join("-");
  }
  function renderPersonalExpenses() {
    return '<section class="page-section" aria-label="' + esc(pageLabel(pages.find(p=>p.id==="personal-expenses"))) + '" style="min-height:65vh"></section>';
  }
  function renderDetail() {
    const items=state.detailType==="ingredient"?state.ingredients:state.menus;
    const item=items.find(x=>x.id===state.detailId);
    if(!item){state.detailId=null;const page=pages.find(x=>x.id===state.managePage)||pages[0];return renderMainPage(page);}
    const menuSales=state.detailType==="menu"?state.sales.filter(s=>s.menuId===item.id):[];
    const info=state.detailType==="ingredient"
      ? '<p><b>'+esc(t("category"))+':</b> '+esc(item.category)+'</p><p><b>'+esc(t("type"))+':</b> '+esc(item.type==='reusable'?t("reusable"):t("oneTime"))+'</p>'+(item.type==='one-time'?'<p><b>'+esc(t("quantity"))+':</b> '+esc(item.quantity)+' '+esc(item.unit)+'</p><p><b>'+esc(t("price"))+':</b> '+esc(item.price)+'</p>':'')
      : '<p><b>'+esc(t("category"))+':</b> '+esc(item.category)+'</p><p><b>'+esc(t("sellingPrice"))+':</b> '+esc(item.price?money(item.price):"—")+'</p><p><b>'+esc(t("ingredients"))+':</b> '+esc((item.ingredientNames||[]).length?item.ingredientNames.join(", "):t("noIngredients"));
    let history="";
    if(state.detailType==="menu") history='<hr class="ui-divider"><h2>'+esc(t("salesHistory"))+'</h2>'+(menuSales.length?'<div class="personal-expense-list">'+menuSales.map(x=>'<article class="ui-card personal-expense-item"><div class="personal-expense-main"><div><strong>'+esc(x.date)+' · '+esc(x.time||"")+'</strong><p class="ui-hint">'+esc(x.quantity)+' '+esc(x.unit||"")+' × '+money(x.unitPrice)+(x.discount?' · '+esc(t("discount"))+': '+money(x.discount):'')+'</p>'+(x.note?'<p>'+esc(x.note)+'</p>':'')+'</div><strong class="personal-expense-amount">'+money(x.netSale)+'</strong></div></article>').join("")+'</div>':'<p class="ui-hint">'+esc(t("noSales"))+'</p>');
    return '<section class="page-section menu-detail-page"><div class="menu-detail-heading"><button type="button" class="icon-button menu-form-back" data-action="back-detail" aria-label="'+esc(t("back"))+'" title="'+esc(t("back"))+'">←</button><h1>'+esc(item.name)+'</h1></div>'+(item.image?'<img class="menu-detail-image" src="'+esc(item.image)+'" alt="">':'')+'<div class="ui-card ui-stack">'+info+history+'<hr class="ui-divider"><div class="ui-row">'+button(t("edit"),"edit-detail",true)+button(t("delete"),"delete-detail")+'</div></div></section>';
  }
  function renderAI() {
    let html='<section class="page-section ai-page ai-chat-workspace"><div class="ai-workspace-top"><h1 class="ai-workspace-title">'+esc(t("aiTitle"))+'</h1></div><div class="ai-chat-panel">';
    if(!state.aiMessages.length) {
      html+='<div class="ai-welcome"><div class="ai-welcome-mark" aria-hidden="true">✳</div><h2>'+esc(t("aiWelcome"))+'</h2><p>'+esc(t("aiStart"))+'</p><div class="ai-suggestions"><button type="button" class="ai-suggestion" data-prompt="'+esc(sharedTranslation("ai.prompt.menu")||"Suggest a menu for my night market stall")+'"><span aria-hidden="true">✦</span><span>'+esc(sharedTranslation("ai.suggestion.menu")||"Suggest a menu")+'</span></button><button type="button" class="ai-suggestion" data-prompt="'+esc(sharedTranslation("ai.prompt.ingredientCosts")||"Help me understand ingredient costs")+'"><span aria-hidden="true">◈</span><span>'+esc(sharedTranslation("ai.suggestion.ingredientCosts")||"Ingredient cost ideas")+'</span></button><button type="button" class="ai-suggestion" data-prompt="'+esc(sharedTranslation("ai.prompt.production")||"Help me plan today’s food production")+'"><span aria-hidden="true">▦</span><span>'+esc(sharedTranslation("ai.suggestion.production")||"Production planning")+'</span></button><button type="button" class="ai-suggestion" data-prompt="'+esc(sharedTranslation("ai.prompt.stock")||"What should I check in my stock?")+'"><span aria-hidden="true">↗</span><span>'+esc(sharedTranslation("ai.suggestion.stock")||"Stock advice")+'</span></button></div></div>';
    } else {
      html+='<div class="ai-messages" aria-live="polite">'+state.aiMessages.map(message=>'<div class="ai-message-row"><div class="ai-message-avatar" aria-hidden="true">◉</div><div class="ai-message"><span class="ai-message-label">'+esc(sharedTranslation("ai.messageSender.you")||"You")+'</span><p>'+esc(message)+'</p></div></div>').join("")+'</div>';
    }
    html+='<form id="ai-composer" class="ai-composer"><label class="ui-field"><span class="ui-label">'+esc(t("aiMessage"))+'</span><textarea class="ui-textarea" name="message" rows="2" maxlength="4000" placeholder="'+esc(t("aiPlaceholder"))+'" required></textarea></label><div class="ai-composer-footer"><span class="ui-hint">'+esc(t("aiPreviewOnly"))+'</span><button class="ui-button ui-button--primary ai-send-button" type="submit" aria-label="'+esc(t("aiSend"))+'"><span>'+esc(t("aiSend"))+'</span><span class="ai-send-arrow" aria-hidden="true">↑</span></button></div></form></div></section>';
    return html;
  }
  function renderPage() {
    if(!pageContent)return;
    if(state.mode==="ai"){
      if(state.aiView==="settings"){pageContent.innerHTML='<section class="page-section ai-page"><div class="ai-page-heading"><p class="eyebrow">KitchAI</p><h1>'+esc(sharedTranslation("ai.settings")||"AI Settings")+'</h1><p>'+esc(sharedTranslation("ai.settings.description")||"AI preferences will be available when the AI service is connected.")+'</p></div><div class="ui-card ai-settings-card"><h2>'+esc(sharedTranslation("ai.connection.title")||"AI connection")+'</h2><p class="ui-hint">'+esc(sharedTranslation("ai.connection.previewOnly")||"This preview does not connect to an AI service yet.")+'</p></div></section>';return;}
      if(state.aiView==="recent"||state.aiView==="search"){const chats=state.aiChats.slice().reverse().filter(chat=>state.aiView!=="search"||!state.aiSearchQuery||chat.title.toLowerCase().includes(state.aiSearchQuery.toLowerCase()));pageContent.innerHTML='<section class="page-section ai-page"><div class="ai-page-heading"><p class="eyebrow">KitchAI</p><h1>'+(state.aiView==="search"?(sharedTranslation("ai.searchChats")||"Search Chats"):(sharedTranslation("ai.recentChats")||"Recent Chats"))+'</h1><p>'+(sharedTranslation("ai.openPrevious")||"Open a previous conversation to continue.")+'</p></div>'+(state.aiView==="search"?'<label class="ui-field"><span class="ui-label">'+esc(sharedTranslation("ai.searchChats")||"Search Chats")+'</span><input class="ui-input" id="main-chat-search" type="search" value="'+esc(state.aiSearchQuery)+'" placeholder="'+esc(sharedTranslation("ai.searchPlaceholder")||"Search conversations")+'"></label>':"")+'<div class="ai-chat-list">'+(chats.length?chats.map(chat=>'<button type="button" class="ui-card ai-chat-list-item" data-chat-id="'+chat.id+'"><strong>'+esc(chat.title)+'</strong><span class="ui-hint">'+chat.messages.length+' '+esc(sharedTranslation("ai.messages")||"messages")+'</span></button>').join(""):'<p class="ui-hint">'+esc(sharedTranslation("ai.noSavedChats")||"No saved chats yet.")+'</p>')+'</div></section>';return;}
      pageContent.innerHTML=renderAI();return;}
    if(state.dateFilterOpen && state.mode==="manage"){pageContent.innerHTML=renderDateFilterPage();return;}
    if(state.menuFormOpen && state.mode==="manage" && state.managePage==="menu"){pageContent.innerHTML=renderMenuForm();return;}
    if(state.dialog){pageContent.innerHTML=renderDialog();return;}
    if(state.detailId){pageContent.innerHTML=renderDetail();return;}
    const page=pages.find(x=>x.id===state.managePage)||pages[0];
    pageContent.innerHTML=page.id==="menu"?renderMenus():renderMainPage(page);
  }
  function renderDialog() {
    const d=state.dialog;
    let title="", body="", submit=t("save");
    if(d==="ingredient-category"||d==="menu-category"){
      title=t("createCategory");body=field(t("name"),"categoryName","text","",true,'maxlength="80"');
    } else if(d==="ingredient"||d==="edit-ingredient"){
      const item=d==="edit-ingredient"?state.ingredients.find(x=>x.id===state.editId):{};
      title=d==="edit-ingredient"?t("edit")+" "+t("createIngredient"):t("createIngredient");
      body='<label class="ui-field"><span class="ui-label">'+esc(t("category"))+' *</span><input class="ui-input" name="category" list="ingredient-category-options" value="'+esc(item?.category||"")+'" placeholder="'+esc(t("category"))+'" required maxlength="80"><datalist id="ingredient-category-options">'+[...new Set((state.categories.ingredients||[]).filter(c=>c&&c!=="Default"))].map(c=>'<option value="'+esc(c)+'"></option>').join("")+'</datalist></label>'+field(t("name"),"name","text",item?.name||"",true,'maxlength="100"');
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
      if(d==="edit-menu"){
        const menuCategories=[...new Set([...(state.categories.menu||[]),...state.menus.map(x=>x.category).filter(Boolean),item?.category||""])].filter(c=>c&&c!=="Default");
        body='<label class="ui-field"><span class="ui-label">'+esc(t("category"))+'</span><select class="ui-input" name="category" onchange="const n=this.nextElementSibling;const isNew=this.value===\'__new_category__\';n.hidden=!isNew;if(!isNew)n.value=\'\'"><option value="">'+esc(t("chooseCategory"))+'</option>'+menuCategories.map(c=>'<option value="'+esc(c)+'" '+(c===item?.category?"selected":"")+'>'+esc(c)+'</option>').join("")+'<option value="__new_category__">Create new category</option></select><input class="ui-input" name="categoryNew" type="text" maxlength="80" placeholder="New category name" hidden></label>'+field(t("name"),"name","text",item?.name||"",true,'maxlength="100"')+field(t("sellingPrice"),"price","number",item?.price??"",true,'min="0" step="any"');
        body+='<div class="ui-field"><span class="ui-label">'+esc(t("ingredients"))+'</span>';
        if(state.ingredients.length) body+=state.ingredients.map(i=>'<label class="ui-check"><input type="checkbox" name="ingredientIds" value="'+i.id+'" '+((item?.ingredientIds||[]).includes(i.id)?'checked':'')+'> '+esc(i.name)+'</label>').join("");
        else body+='<p class="ui-hint">'+esc(t("noIngredients"))+'</p>';
        body+='</div>';
      } else {
        body=selectField(t("menuType"),"type",[t("reusable"),t("oneTime")],t("reusable"));
        body+=categoryField("menu","Default")+field(t("name"),"name","text","",true,'maxlength="100"');
        body+='<label class="ui-field"><span class="ui-label">'+esc(t("image"))+'</span><input class="ui-input" type="file" name="image" accept="image/*"></label>';
        body+='<div id="reusable-menu-fields" class="ui-stack">'+field(t("sellingPrice"),"price","number","",false,'min="0" step="any"')+field(t("unit"),"unit","text","piece",false,'maxlength="30"')+'<div class="ui-field"><span class="ui-label">'+esc(t("ingredients"))+'</span>';
        if(state.ingredients.length) body+=state.ingredients.map(i=>'<label class="ui-check"><input type="checkbox" name="ingredientIds" value="'+i.id+'"> '+esc(i.name)+'</label>').join("");
        else body+='<p class="ui-hint">'+esc(t("noIngredients"))+'</p>';
        body+='</div><label class="ui-field"><span class="ui-label">'+esc(t("note"))+'</span><textarea class="ui-textarea" name="note" maxlength="500"></textarea></label></div>';
        body+='<div id="one-time-fields" class="ui-stack" style="display:none"><h2>'+esc(t("oneTimeSale"))+'</h2>'+field(t("quantity"),"quantity","number","1",true,'min="0.001" step="any"')+field(t("unit"),"saleUnit","text","piece",false,'maxlength="30"')+field(t("unitPrice"),"unitPrice","number","",false,'min="0" step="any"')+field(t("discount"),"discount","number","0",false,'min="0" step="any"')+field(t("saleDate"),"saleDate","date",localToday(),true)+field(t("saleTime"),"saleTime","time",new Date().toTimeString().slice(0,5),true)+'<label class="ui-field"><span class="ui-label">'+esc(t("note"))+'</span><textarea class="ui-textarea" name="saleNote" maxlength="500"></textarea></label><p class="ui-hint">'+esc(t("netSale"))+': <strong id="net-sale-preview">—</strong></p></div>';
      }
      submit=d==="edit-menu"?t("update"):t("save");
    }
    return '<section class="page-section internal-form-screen"><div class="ui-row internal-form-heading"><button type="button" class="ui-button ui-button--secondary" data-action="cancel-dialog" aria-label="'+esc(t("back"))+'">← '+esc(t("back"))+'</button><h1>'+esc(title)+'</h1></div><form class="ui-card ui-stack internal-form" id="record-form">'+body+'<div class="ui-row internal-form-actions">'+button(t("cancel"),"cancel-dialog")+'<button class="ui-button ui-button--primary" type="submit">'+esc(submit)+'</button></div></form></section>';
  }
  function render() {
    modeButtons.forEach(b=>{const active=b.dataset.mode===state.mode;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});
    renderSidebar();renderPage();if(document.documentElement)document.documentElement.lang=language();
  }
  function captureModeWorkspace(mode){
    const controls=pageContent?[...pageContent.querySelectorAll("input, textarea, select")]:[];
    modeWorkspaceSnapshots[mode]={
      scrollY:window.scrollY||window.pageYOffset||0,
      controls:controls.map((el,index)=>({
        index,
        id:el.id||"",
        name:el.name||"",
        type:(el.type||el.tagName||"").toLowerCase(),
        value:el.type==="file"?undefined:el.value,
        checked:("checked" in el)?el.checked:undefined,
        selectedIndex:el.tagName==="SELECT"?el.selectedIndex:undefined,
        selectionStart:typeof el.selectionStart==="number"?el.selectionStart:null,
        selectionEnd:typeof el.selectionEnd==="number"?el.selectionEnd:null
      }))
    };
  }
  function restoreModeWorkspace(mode){
    const snapshot=modeWorkspaceSnapshots[mode];
    if(!snapshot)return;
    const controls=pageContent?[...pageContent.querySelectorAll("input, textarea, select")]:[];
    snapshot.controls.forEach(saved=>{
      const el=controls[saved.index];
      if(!el||el.id!==saved.id||el.name!==saved.name||(el.type||el.tagName||"").toLowerCase()!==saved.type)return;
      if(saved.value!==undefined&&el.type!=="file")el.value=saved.value;
      if(saved.checked!==undefined)el.checked=saved.checked;
      if(saved.selectedIndex!==undefined)el.selectedIndex=saved.selectedIndex;
      if(saved.selectionStart!==null&&typeof el.setSelectionRange==="function"){
        try{el.setSelectionRange(saved.selectionStart,saved.selectionEnd);}catch{}
      }
    });
    window.scrollTo({top:snapshot.scrollY,behavior:"auto"});
  }
  function setMode(mode){
    if((mode!=="ai"&&mode!=="manage")||state.mode===mode)return;
    captureModeWorkspace(state.mode);
    state.mode=mode;
    if(!isDesktop())closeDrawer();
    render();
    restoreModeWorkspace(mode);
  }
  function toast(message){const el=$("#toast");if(el){el.textContent=message;el.classList.add("visible");window.setTimeout(()=>el.classList.remove("visible"),2600);}}
  function categoryFor(kind,value){const name=(value||"").trim()||"Default";if(!state.categories[kind].includes(name))state.categories[kind].push(name);return name;}
  function handleAction(action){
    if(action==="new-menu"){state.menuFormOpen=true;state.dialog=null;state.editId=null;}
    else if(action==="cancel-menu-form"){state.menuFormOpen=false;}
    else if(action==="new-ingredient"){state.dialog="ingredient";state.editId=null;}
    else if(action==="new-personal-expense"){state.dialog="personal-expense";state.editId=null;}
    else if(action.startsWith("edit-personal-expense:")){state.editId=Number(action.split(":")[1]);state.dialog="edit-personal-expense";}
    else if(action.startsWith("delete-personal-expense:")){const id=Number(action.split(":")[1]);if(window.confirm(t("personalExpenseDeleteConfirm"))){state.personalExpenses=state.personalExpenses.filter(item=>item.id!==id);toast(t("personalExpenseSaved"));}}
    else if(action==="new-ingredient-category"){state.dialog="ingredient-category";state.categoryTarget="ingredients";}
    else if(action==="new-menu-category"){state.dialog="menu-category";state.categoryTarget="menu";}
    else if(action==="menu-view-all"){state.menuView="all";state.menuSearch="";state.detailId=null;state.detailType=null;}
    else if(action==="menu-view-sales"){state.menuView="sales";state.detailId=null;state.detailType=null;}
    else if(action==="cancel-dialog"){state.dialog=null;state.editId=null;state.pendingImageData="";}
    else if(action==="back-detail"){state.detailId=null;state.detailType=null;}
    else if(action.startsWith("ingredient-detail:")){state.detailType="ingredient";state.detailId=Number(action.split(":")[1]);}
    else if(action.startsWith("menu-detail:")){state.detailType="menu";state.detailId=Number(action.split(":")[1]);}
    else if(action.startsWith("record-menu-sale:")){state.editId=Number(action.split(":")[1]);state.dialog="record-menu-sale";state.pendingImageData="";}
    else if(action==="edit-detail"){state.editId=state.detailId;state.dialog=state.detailType==="ingredient"?"edit-ingredient":"edit-menu";}
    else if(action==="delete-detail"){if(window.confirm(t("confirmDelete"))){const key=state.detailType==="ingredient"?"ingredients":"menus";state[key]=state[key].filter(x=>x.id!==state.detailId);if(key==="menus")persistMenuWorkspace();state.detailId=null;state.detailType=null;}}
    render();
  }
  pageContent?.addEventListener("click",event=>{const target=event.target instanceof Element?event.target:null;const dateAction=target?.closest("[data-date-filter]")?.dataset.dateFilter;if(dateAction){if(dateAction==="open"){state.dateFilterDraft={start:"",end:""};state.dateCalendarTarget=null;state.dateCalendarView="day";state.dateCalendarMonth=dateKey(state.dateFilter.preset==="singleDate"?state.dateFilter.start||localToday():localToday()).slice(0,7);state.dateFilterOpen=true;render();window.scrollTo({top:0,behavior:"auto"});}else if(dateAction==="cancel"){state.dateFilterOpen=false;state.dateFilterDraft=null;state.dateCalendarTarget=null;render();window.scrollTo({top:0,behavior:"auto"});}else if(dateAction.startsWith("quick:")){state.dateFilter={preset:dateAction.slice(6),start:"",end:""};state.dateFilterOpen=false;state.dateFilterDraft=null;state.dateCalendarTarget=null;render();window.scrollTo({top:0,behavior:"auto"});}else if(dateAction.startsWith("calendar:")){state.dateCalendarTarget=dateAction.slice(9);state.dateCalendarView="day";const value=state.dateCalendarTarget==="single"?(state.dateFilterDraft?.singleDate||state.dateFilter.start||localToday()):state.dateCalendarTarget==="start"?(state.dateFilterDraft?.start||localToday()):(state.dateFilterDraft?.end||state.dateFilterDraft?.start||localToday());state.dateCalendarMonth=dateKey(value).slice(0,7);render();}else if(dateAction==="view:year"){state.dateCalendarView="year";render();}else if(dateAction==="view:month"){state.dateCalendarView="month";render();}else if(dateAction.startsWith("year:")){const step=Number(dateAction.slice(5));const current=toLocalDate((state.dateCalendarMonth||localToday().slice(0,7))+"-01");current.setFullYear(current.getFullYear()+step);state.dateCalendarMonth=dateKey(current).slice(0,7);state.dateCalendarView="year";render();}else if(dateAction.startsWith("pick-year:")){const picked=Number(dateAction.slice(10));const current=toLocalDate((state.dateCalendarMonth||localToday().slice(0,7))+"-01");current.setFullYear(picked);state.dateCalendarMonth=dateKey(current).slice(0,7);state.dateCalendarView="month";render();}else if(dateAction.startsWith("pick-month:")){const picked=Number(dateAction.slice(11));const current=toLocalDate((state.dateCalendarMonth||localToday().slice(0,7))+"-01");current.setMonth(picked);state.dateCalendarMonth=dateKey(current).slice(0,7);state.dateCalendarView="day";render();}else if(dateAction.startsWith("month:")){const step=Number(dateAction.slice(6));const current=toLocalDate((state.dateCalendarMonth||localToday().slice(0,7))+"-01");current.setMonth(current.getMonth()+step);state.dateCalendarMonth=dateKey(current).slice(0,7);state.dateCalendarView="day";render();}else if(dateAction.startsWith("day:")){const value=dateAction.slice(4);const targetField=state.dateCalendarTarget;if(targetField==="single"){state.dateFilter={preset:"singleDate",start:value,end:value};state.dateFilterOpen=false;state.dateFilterDraft=null;state.dateCalendarTarget=null;render();window.scrollTo({top:0,behavior:"auto"});}else{state.dateFilterDraft={...(state.dateFilterDraft||{}),[targetField]:value};if(targetField==="start"&&!state.dateFilterDraft.end){state.dateCalendarTarget="end";state.dateCalendarMonth=value.slice(0,7);render();}else if(state.dateFilterDraft.start&&state.dateFilterDraft.end&&state.dateFilterDraft.end>=state.dateFilterDraft.start){state.dateFilter={preset:"custom",start:state.dateFilterDraft.start,end:state.dateFilterDraft.end};state.dateFilterOpen=false;state.dateFilterDraft=null;state.dateCalendarTarget=null;render();window.scrollTo({top:0,behavior:"auto"});}else{state.dateCalendarTarget=targetField==="start"?"end":"end";state.dateCalendarMonth=value.slice(0,7);render();}}}return;}const chat=target?.closest("[data-chat-id]");if(chat){const saved=state.aiChats.find(item=>item.id===Number(chat.dataset.chatId));if(saved){state.activeAiChatId=saved.id;state.aiMessages=[...saved.messages];state.aiView="chat";render();}return;}const prompt=target?.closest("[data-prompt]");if(prompt){const box=pageContent.querySelector('textarea[name="message"]');if(box){box.value=prompt.dataset.prompt;box.focus();}return;}const nav=target?.closest("[data-page]");if(nav&&state.mode==="manage"){const id=nav.dataset.page;if(pages.some(p=>p.id===id)){state.managePage=id;state.dateFilterOpen=false;state.dateFilterDraft=null;state.detailId=null;state.dialog=null;render();window.scrollTo({top:0,behavior:"auto"});}return;}const el=target?.closest("[data-action]");if(el)handleAction(el.dataset.action);});
  pageContent?.addEventListener("input",event=>{
    if(event.target?.id==="main-chat-search"){state.aiSearchQuery=event.target.value;const pos=event.target.selectionStart;render();const next=$("#main-chat-search");if(next){next.focus();next.setSelectionRange(pos,pos);}return;}
    if(event.target?.id==="menu-search"){state.menuSearch=event.target.value;const pos=event.target.selectionStart;render();const next=$("#menu-search");if(next){next.focus();next.setSelectionRange(pos,pos);}return;}
    if(event.target?.id==="ingredient-search"){state.ingredientSearch=event.target.value;const pos=event.target.selectionStart;render();const next=$("#ingredient-search");if(next){next.focus();next.setSelectionRange(pos,pos);}return;}
    if(["quantity","unitPrice","discount"].includes(event.target?.name)){const form=$("#record-form");if(!form)return;const qty=Number(form.elements.quantity?.value||0),price=Number(form.elements.unitPrice?.value||0),discount=Number(form.elements.discount?.value||0);const preview=$("#net-sale-preview");if(preview)preview.textContent=money(Math.max(0,qty*price-discount));}
  });
  pageContent?.addEventListener("change",event=>{
    if(event.target?.id==="menu-category-filter"){state.menuCategoryFilter=event.target.value;render();return;}
    if(event.target?.id==="ingredient-category-filter"){state.ingredientCategoryFilter=event.target.value;render();return;}
    if(event.target?.name==="type"){const one=event.target.value===t("oneTime"),box=$("#one-time-fields"),reusable=$("#reusable-menu-fields");if(box)box.style.display=one?"grid":"none";if(reusable)reusable.style.display=one?"none":"grid";}
    if(event.target?.name==="image"){const file=event.target.files?.[0];if(!file){state.pendingImageData="";return;}if(!file.type.startsWith("image/")){toast(t("required"));event.target.value="";return;}if(file.size>2*1024*1024){toast(t("imageTooLarge"));event.target.value="";return;}const reader=new FileReader();reader.onload=()=>{state.pendingImageData=String(reader.result||"");};reader.readAsDataURL(file);}
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
    const form=event.target;const data=new FormData(form);const d=state.menuFormOpen && state.managePage==="menu" ? "menu-inline" : state.dialog;
    if(d==="menu-inline"){
      const name=String(data.get("name")||"").trim();
      const categoryChoice=String(data.get("category")||"").trim();const categoryName=categoryChoice==="__new_category__"?String(data.get("categoryNew")||"").trim():categoryChoice;
      const priceText=String(data.get("price")||"").trim();
      const price=Number(priceText);
      if(!categoryName){form.elements.category.reportValidity();return;}
      if(!name){form.elements.name.reportValidity();return;}
      if(priceText===""||!Number.isFinite(price)||price<0){form.elements.price.reportValidity();return;}
      const ingredientIds=data.getAll("ingredientIds").map(Number);
      const item={id:Date.now(),name,category:categoryFor("menu",categoryName),price:String(price),ingredientIds,ingredientNames:state.ingredients.filter(i=>ingredientIds.includes(i.id)).map(i=>i.name),note:"",unit:"piece",type:"reusable"};
      state.menus.push(item);
      state.menuFormOpen=false;
      persistMenuWorkspace();
      render();
      toast(t("menuSaved"));
      return;
    }
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
      const name=String(data.get("name")||"").trim();
      const categoryName=String(data.get("category")||"").trim();
      if(!categoryName){form.elements.category.reportValidity();return;}
      if(!name){form.elements.name.reportValidity();return;}
      const item={id:d==="edit-ingredient"?state.editId:Date.now(),name,category:categoryFor("ingredients",categoryName)};
      if(d==="edit-ingredient")state.ingredients=state.ingredients.map(x=>x.id===item.id?item:x);else state.ingredients.push(item);
      state.dialog=null;state.editId=null;state.ingredientSearch="";state.ingredientCategoryFilter="all";render();toast(t("savedInPreview"));return;
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
      const type=data.get("type")===t("oneTime")?"one-time":"reusable";const categoryChoice=String(data.get("category")||"").trim();const categoryName=categoryChoice==="__new_category__"?String(data.get("categoryNew")||"").trim():categoryChoice;const category=categoryFor("menu",categoryName);if(!categoryName){form.elements.category.reportValidity();return;}
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
      if((d==="edit-menu"&&price==="")||(price!==""&&(!Number.isFinite(Number(price))||Number(price)<0))){form.elements.price.reportValidity();return;}
      const previous=d==="edit-menu"?state.menus.find(x=>x.id===state.editId):null;
      const item={...(previous||{}),id:d==="edit-menu"?state.editId:Date.now(),name,category,image,ingredientIds,ingredientNames:state.ingredients.filter(i=>ingredientIds.includes(i.id)).map(i=>i.name),note:d==="edit-menu"?(previous?.note||""):String(data.get("note")||"").trim(),price,unit:d==="edit-menu"?(previous?.unit||"piece"):unit,type:"reusable"};
      if(d==="edit-menu")state.menus=state.menus.map(x=>x.id===item.id?item:x);else state.menus.push(item);persistMenuWorkspace();
      state.dialog=null;state.editId=null;state.pendingImageData="";state.menuView="all";render();toast(t("menuSaved"));
    }
  });
  sidebarContent?.addEventListener("click",event=>{const b=event.target instanceof Element?event.target.closest("[data-page]"):null;if(!b)return;const id=b.getAttribute("data-page");if(!pages.some(p=>p.id===id))return;state.managePage=id;state.dateFilterOpen=false;state.dateFilterDraft=null;state.detailId=null;state.dialog=null;if(!isDesktop())closeDrawer();render();window.scrollTo({top:0,behavior:"auto"});});
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
  menuToggle?.addEventListener("click",()=>{if(drawerIsOpen())closeDrawer();else openDrawer();});sidebarMinimize?.addEventListener("click",closeDrawer);backdrop?.addEventListener("click",closeDrawer);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeDrawer();if(state.dialog){state.dialog=null;render();}}});
  function updateStaticLocalizedLabels() {
    const modeGroup = document.querySelector(".topbar-mode-switch");
    if (modeGroup) modeGroup.setAttribute("aria-label", t("navigation"));
    const aiButton = document.querySelector('[data-mode="ai"]');
    const manageButton = document.querySelector('[data-mode="manage"]');
    if (aiButton) { const label = aiButton.querySelector("span:last-child"); if (label) label.textContent = t("ai"); }
    if (manageButton) { const label = manageButton.querySelector("span:last-child"); if (label) label.textContent = t("manage"); }
    const theme = document.querySelector("#theme-toggle");
    if (theme) { theme.setAttribute("aria-label", t("appearance")); theme.setAttribute("title", t("appearance")); }
    const language = document.querySelector("#language-select");
    if (language) language.setAttribute("aria-label", t("language"));
    const nav = document.querySelector("#sidebar");
    if (nav) nav.setAttribute("aria-label", "KitchAI " + t("navigation"));
    const skip = document.querySelector(".skip-link");
    if (skip) skip.textContent = sharedTranslation("common.skipToContent") || (languageSelect?.value === "my" ? "အကြောင်းအရာသို့ ကျော်ရန်" : languageSelect?.value === "th" ? "ข้ามไปยังเนื้อหา" : "Skip to content");
    const footer = document.querySelector(".footer span:last-child");
    if (footer) footer.textContent = languageSelect?.value === "my" ? "လုပ်ငန်းခွင်အခြေခံ" : languageSelect?.value === "th" ? "พื้นฐานพื้นที่ทำงาน" : "Workspace foundation";
    renderSidebar();
    renderPage();
  }
  const localeBridge = /** @type {Window & { KitchAI18n?: { setLocale?: (locale: string) => string } }} */ (window);
  // Re-render every currently mounted UI surface whenever the shared locale changes,
  // including changes initiated outside the top-bar selector.
  document.addEventListener("kitchai:localechange", () => {
    if (document.documentElement) document.documentElement.lang = language();
    updateStaticLocalizedLabels();
    updateConnectionStatus();
  });
  languageSelect?.addEventListener("change", () => {
    localeBridge.KitchAI18n?.setLocale?.(language());
    updateStaticLocalizedLabels();
    updateConnectionStatus();
  });
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
    // On mobile, a left swipe while the Drawer is open closes only the Drawer.
    // Never let a Drawer gesture also trigger a mode change.
    if (!isDesktop() && drawerIsOpen()) {
      if (dx < -60) {
        setSwipeClickGuard(start, end);
        closeDrawer();
      }
      return;
    }
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
    // On mobile, a left swipe while the Drawer is open closes only the Drawer.
    // Never let a Drawer gesture also trigger a mode change.
    if (!isDesktop() && drawerIsOpen()) {
      if (dx < -60) {
        setSwipeClickGuard(start, end);
        closeDrawer();
      }
      return;
    }
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
    const statusText = sharedTranslation(online ? "connection.online" : "connection.offline") || (online ? "Online" : "Offline");
    const statusLabel = sharedTranslation(online ? "connection.statusOnline" : "connection.statusOffline") || (online ? "Connection status: Online" : "Connection status: Offline");
    connectionStatus.textContent = statusText;
    connectionStatus.dataset.state = online ? "online" : "offline";
    connectionStatus.setAttribute("aria-label", statusLabel);
    if (installButton) installButton.textContent = sharedTranslation("app.install") || "Install app";
  }
  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
  languageSelect?.addEventListener("change", updateConnectionStatus);
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
  if (isDesktop()) openDrawer(); else closeDrawer();
  updateConnectionStatus();
  updateStaticLocalizedLabels();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    const basePath = document.querySelector('meta[name="kitchai-base-path"]')?.getAttribute("content") || "/";
    navigator.serviceWorker.register(basePath + "sw.js", { scope: basePath }).catch(error => {
      console.error("KitchAI service worker registration failed", error);
    });
  }

  initializeMenuPersistence();
})();