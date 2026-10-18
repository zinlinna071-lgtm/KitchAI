/* KitchAI frontend prototype. UI-only state; persistence/backend intentionally not connected. */
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const modeButtons = $$("[data-mode]");
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
    en: { ai:"AI Mode", manage:"Manage Mode", aiTitle:"AI workspace", aiDescription:"Your AI workspace will be built from the confirmed KitchAI requirements.", manageIntro:"Manage your business in one place.", building:"This page will be built from the requirements you confirm.", navigation:"Manage Mode", workspace:"Frontend prototype", openNavigation:"Open navigation", closeNavigation:"Close navigation", appearance:"Toggle light and dark theme", language:"Interface language", emptyTitle:"No data yet", emptyCopy:"Start by adding your first record.", create:"Create", createCategory:"Create Category", createIngredient:"Create Ingredient", createMenu:"Create Menu", category:"Category", name:"Name", cancel:"Cancel", save:"Create", default:"Default", reusable:"Reusable", oneTime:"One time", type:"Type", quantity:"Quantity", unit:"Unit", price:"Price", note:"Note (optional)", sellingPrice:"Selling price", ingredients:"Ingredients", noIngredients:"No ingredients yet. You can add them later.", notNow:"I’m not adding ingredients yet", back:"Back", edit:"Edit", delete:"Delete", update:"Save changes", confirmDelete:"Delete this record?", details:"Details", chooseCategory:"Choose or type a category", required:"This field is required.", aiOnly:"AI Mode UI is a placeholder in this frontend stage.", savedInPreview:"Added to this preview only; it is not saved to a database." },
    my: { ai:"AI Mode", manage:"Manage Mode", aiTitle:"AI လုပ်ငန်းခွင်", aiDescription:"အတည်ပြုထားသော KitchAI လိုအပ်ချက်များအတိုင်း AI လုပ်ငန်းခွင်ကို တည်ဆောက်သွားမည်။", manageIntro:"လုပ်ငန်းကို တစ်နေရာတည်းမှာ စီမံခန့်ခွဲပါ။", building:"ဒီစာမျက်နှာကို အတည်ပြုထားတဲ့ လိုအပ်ချက်တွေအတိုင်း တည်ဆောက်သွားမယ်။", navigation:"Manage Mode", workspace:"Frontend စမ်းသပ်ဗားရှင်း", openNavigation:"Navigation ဖွင့်ရန်", closeNavigation:"Navigation ပိတ်ရန်", appearance:"Theme ပြောင်းရန်", language:"ဘာသာစကား", emptyTitle:"အချက်အလက် မရှိသေးပါ", emptyCopy:"ပထမဆုံးအချက်အလက်ကို စတင်ထည့်သွင်းပါ။", create:"အသစ်ထည့်ရန်", createCategory:"Category အသစ်", createIngredient:"Ingredient အသစ်", createMenu:"Menu အသစ်", category:"Category", name:"အမည်", cancel:"မလုပ်တော့ပါ", save:"ထည့်သွင်းရန်", default:"Default", reusable:"Reusable", oneTime:"One time", type:"အမျိုးအစား", quantity:"အရေအတွက်", unit:"ယူနစ်", price:"ဈေးနှုန်း", note:"မှတ်ချက် (မဖြစ်မနေမဟုတ်)", sellingPrice:"ရောင်းဈေး", ingredients:"Ingredients", noIngredients:"Ingredient မရှိသေးပါ။ နောက်မှထည့်နိုင်ပါတယ်။", notNow:"အခု Ingredients မထည့်သေးပါ", back:"နောက်သို့", edit:"ပြင်ရန်", delete:"ဖျက်ရန်", update:"ပြင်ဆင်ချက်သိမ်းရန်", confirmDelete:"ဒီအချက်အလက်ကို ဖျက်မှာသေချာပါသလား။", details:"အသေးစိတ်", chooseCategory:"Category ရွေးရန် သို့မဟုတ် အသစ်ရိုက်ရန်", required:"ဒီအကွက်ကို ဖြည့်ရန်လိုပါတယ်။", aiOnly:"ဒီအဆင့်မှာ AI Mode UI ကို နမူနာအဖြစ်သာ ပြထားပါတယ်။", savedInPreview:"ဒီ preview ထဲမှာသာ ထည့်ထားတာဖြစ်ပြီး database ထဲ မသိမ်းရသေးပါ။" },
    th: { ai:"โหมด AI", manage:"โหมดจัดการ", aiTitle:"พื้นที่ AI", aiDescription:"พื้นที่ AI จะสร้างตามข้อกำหนด KitchAI ที่ยืนยันแล้ว", manageIntro:"จัดการธุรกิจของคุณในที่เดียว", building:"หน้านี้จะสร้างตามข้อกำหนดที่ยืนยัน", navigation:"โหมดจัดการ", workspace:"ต้นแบบส่วนหน้า", openNavigation:"เปิดเมนูนำทาง", closeNavigation:"ปิดเมนูนำทาง", appearance:"สลับธีม", language:"ภาษา", emptyTitle:"ยังไม่มีข้อมูล", emptyCopy:"เริ่มต้นด้วยการเพิ่มรายการแรก", create:"สร้าง", createCategory:"สร้างหมวดหมู่", createIngredient:"สร้างวัตถุดิบ", createMenu:"สร้างเมนู", category:"หมวดหมู่", name:"ชื่อ", cancel:"ยกเลิก", save:"สร้าง", default:"Default", reusable:"ใช้ซ้ำ", oneTime:"ครั้งเดียว", type:"ประเภท", quantity:"จำนวน", unit:"หน่วย", price:"ราคา", note:"หมายเหตุ (ไม่บังคับ)", sellingPrice:"ราคาขาย", ingredients:"วัตถุดิบ", noIngredients:"ยังไม่มีวัตถุดิบ เพิ่มภายหลังได้", notNow:"ยังไม่เพิ่มวัตถุดิบตอนนี้", back:"กลับ", edit:"แก้ไข", delete:"ลบ", update:"บันทึก", confirmDelete:"ต้องการลบรายการนี้หรือไม่", details:"รายละเอียด", chooseCategory:"เลือกหรือพิมพ์หมวดหมู่", required:"จำเป็นต้องกรอกข้อมูลนี้", aiOnly:"พื้นที่ AI เป็นตัวอย่างในขั้นตอนนี้", savedInPreview:"เพิ่มในตัวอย่างนี้เท่านั้น ยังไม่ได้บันทึกลงฐานข้อมูล" }
  };
  const state = { mode:"ai", aiPage:"ai", managePage:"dashboard", touchX:0, touchY:0, tracking:false, drawerGesture:false, dialog:null, categoryTarget:null, detailId:null, detailType:null, editId:null, categories:{ingredients:["Default"],menu:["Default"]}, ingredients:[], menus:[] };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const language = () => labels[languageSelect?.value] ? languageSelect.value : "en";
  const t = key => labels[language()][key] || labels.en[key] || key;
  const pageLabel = page => page[language()] || page.en;
  const openDrawer = () => { sidebar?.classList.add("open"); backdrop?.classList.add("visible"); menuToggle?.setAttribute("aria-expanded","true"); };
  const closeDrawer = () => { sidebar?.classList.remove("open"); backdrop?.classList.remove("visible"); menuToggle?.setAttribute("aria-expanded","false"); };
  const button = (label, action, primary=false) => '<button type="button" class="ui-button '+(primary?'ui-button--primary':'ui-button--secondary')+'" data-action="'+action+'">'+esc(label)+'</button>';
  const field = (label, name, type="text", value="", required=false, extra="") => '<label class="ui-field"><span class="ui-label">'+esc(label)+(required?' *':'')+'</span><input class="ui-input" name="'+esc(name)+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required':'')+' '+extra+'></label>';
  const selectField = (label,name,options,selected="") => '<label class="ui-field"><span class="ui-label">'+esc(label)+'</span><select class="ui-select" name="'+esc(name)+'">'+options.map(o=>'<option value="'+esc(o)+'" '+(o===selected?'selected':'')+'>'+esc(o)+'</option>').join("")+'</select></label>';
  const categoryField = (kind, selected="Default") => '<label class="ui-field"><span class="ui-label">'+t("category")+'</span><input class="ui-input" name="category" list="category-options" value="'+esc(selected)+'" placeholder="'+esc(t("chooseCategory"))+'"><datalist id="category-options">'+state.categories[kind].map(c=>'<option value="'+esc(c)+'"></option>').join("")+'</datalist></label>';
  function renderSidebar() {
    if (!sidebarContent) return;
    if (state.mode==="ai") { sidebarContent.innerHTML='<div class="nav-section-label">KitchAI</div><p class="empty-history">'+esc(t("aiDescription"))+'</p>'; return; }
    sidebarContent.innerHTML='<div class="nav-section-label">'+esc(t("navigation"))+'</div>'+pages.map(page=>'<button type="button" class="nav-item'+(state.managePage===page.id?' active':'')+'" data-page="'+page.id+'" aria-current="'+(state.managePage===page.id?'page':'false')+'"><span class="nav-icon" aria-hidden="true">'+({dashboard:"▦",menu:"≡",ingredients:"◈",equipment:"□",expenses:"−",reports:"▥",settings:"⚙"}[page.id])+'</span><span>'+esc(pageLabel(page))+'</span></button>').join("");
  }
  function pageHeader(title, intro, actions="") {
    return '<section class="page-section"><div class="ui-row ui-row--mobile-stack" style="justify-content:space-between;align-items:flex-start"><div><p class="eyebrow">'+esc(t("manage"))+'</p><h1>'+esc(title)+'</h1><p>'+esc(intro)+'</p></div><div class="ui-row">'+actions+'</div></div>';
  }
  function emptyState(title, copy, action) {
    return '<div class="ui-empty-state"><div aria-hidden="true" style="font-size:32px;color:var(--color-primary)">＋</div><h2>'+esc(title)+'</h2><p>'+esc(copy)+'</p>'+action+'</div>';
  }
  function renderIngredients() {
    const actions=button(t("createCategory"),"new-ingredient-category")+button(t("createIngredient"),"new-ingredient",true);
    let html=pageHeader(pageLabel(pages[2]),"Create and organize ingredient records.",actions);
    html+='<div class="ui-stack">';
    html+='<div class="ui-row"><span class="ui-label">'+esc(t("category"))+':</span>'+state.categories.ingredients.map(c=>'<span class="ui-chip">'+esc(c)+'</span>').join("")+'</div>';
    if (!state.ingredients.length) html+=emptyState(t("emptyTitle"),t("emptyCopy"),button(t("create"),"new-ingredient",true));
    else html+='<div class="ui-stack">'+state.ingredients.map(item=>'<article class="ui-card ui-row" style="justify-content:space-between"><div><h2 style="margin:0;font-size:18px">'+esc(item.name)+'</h2><p style="margin:4px 0 0;color:var(--color-text-muted)">'+esc(item.category)+' · '+esc(item.type==='reusable'?t("reusable"):t("oneTime"))+(item.type==='one-time'?' · '+esc(item.quantity)+' '+esc(item.unit)+' · '+esc(item.price):'')+'</p></div>'+button(t("details"),"ingredient-detail:"+item.id)+'</article>').join("")+'</div>';
    html+='<p class="ui-hint">'+esc(t("savedInPreview"))+'</p></div></section>';
    return html;
  }
  function renderMenus() {
    const actions=button(t("createCategory"),"new-menu-category")+button(t("createMenu"),"new-menu",true);
    let html=pageHeader(pageLabel(pages[1]),"Create menus and view their details.",actions);
    html+='<div class="ui-stack"><div class="ui-row"><span class="ui-label">'+esc(t("category"))+':</span>'+state.categories.menu.map(c=>'<span class="ui-chip">'+esc(c)+'</span>').join("")+'</div>';
    if (!state.menus.length) html+=emptyState(t("emptyTitle"),t("emptyCopy"),button(t("create"),"new-menu",true));
    else html+='<div class="ui-stack">'+state.menus.map(item=>'<article class="ui-card ui-row" style="justify-content:space-between"><div><h2 style="margin:0;font-size:18px">'+esc(item.name)+'</h2><p style="margin:4px 0 0;color:var(--color-text-muted)">'+esc(item.category)+' · '+esc(item.price)+'</p></div>'+button(t("details"),"menu-detail:"+item.id)+'</article>').join("")+'</div>';
    html+='<p class="ui-hint">'+esc(t("savedInPreview"))+'</p></div></section>';
    return html;
  }
  function renderDetail() {
    const items=state.detailType==="ingredient"?state.ingredients:state.menus;
    const item=items.find(x=>x.id===state.detailId);
    if(!item){state.detailId=null;return state.detailType==="ingredient"?renderIngredients():renderMenus();}
    const info=state.detailType==="ingredient"
      ? '<p><b>'+esc(t("category"))+':</b> '+esc(item.category)+'</p><p><b>'+esc(t("type"))+':</b> '+esc(item.type==='reusable'?t("reusable"):t("oneTime"))+'</p>'+(item.type==='one-time'?'<p><b>'+esc(t("quantity"))+':</b> '+esc(item.quantity)+' '+esc(item.unit)+'</p><p><b>'+esc(t("price"))+':</b> '+esc(item.price)+'</p>':'')
      : '<p><b>'+esc(t("category"))+':</b> '+esc(item.category)+'</p><p><b>'+esc(t("ingredients"))+':</b> '+esc(item.ingredientNames.length?item.ingredientNames.join(", "):t("noIngredients"))+'</p><p><b>'+esc(t("note"))+':</b> '+esc(item.note||"—")+'</p><p><b>'+esc(t("sellingPrice"))+':</b> '+esc(item.price)+'</p>';
    return '<section class="page-section"><div class="ui-row">'+button("← "+t("back"),"back-detail")+'</div><h1>'+esc(item.name)+'</h1><div class="ui-card ui-stack">'+info+'<hr class="ui-divider"><div class="ui-row">'+button(t("edit"),"edit-detail",true)+button(t("delete"),"delete-detail")+'</div></div><p class="ui-hint">'+esc(t("savedInPreview"))+'</p></section>';
  }
  function renderPage() {
    if(!pageContent)return;
    if(state.dialog){pageContent.innerHTML=renderDialog();return;}
    if(state.detailId){pageContent.innerHTML=renderDetail();return;}
    if(state.mode==="ai"){pageContent.innerHTML=pageHeader(t("aiTitle"),t("aiDescription"))+'<div class="ui-card"><p>'+esc(t("aiOnly"))+'</p></div></section>';return;}
    if(state.managePage==="ingredients"){pageContent.innerHTML=renderIngredients();return;}
    if(state.managePage==="menu"){pageContent.innerHTML=renderMenus();return;}
    const page=pages.find(x=>x.id===state.managePage)||pages[0];
    pageContent.innerHTML=pageHeader(pageLabel(page),page.id==="dashboard"?t("manageIntro"):t("building"))+'<div class="ui-card"><p>'+esc(t("building"))+'</p></div></section>';
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
    } else if(d==="menu"||d==="edit-menu"){
      const item=d==="edit-menu"?state.menus.find(x=>x.id===state.editId):{};
      title=d==="edit-menu"?t("edit")+" "+t("createMenu"):t("createMenu");
      body=field(t("name"),"name","text",item?.name||"",true,'maxlength="100"')+categoryField("menu",item?.category||"Default");
      body+='<div class="ui-field"><span class="ui-label">'+esc(t("ingredients"))+'</span>';
      if(state.ingredients.length) body+=state.ingredients.map(i=>'<label class="ui-check"><input type="checkbox" name="ingredientIds" value="'+i.id+'" '+((item?.ingredientIds||[]).includes(i.id)?'checked':'')+'> '+esc(i.name)+'</label>').join("");
      else body+='<label class="ui-check"><input type="checkbox" name="noIngredients" checked> '+esc(t("notNow"))+'</label><p class="ui-hint">'+esc(t("noIngredients"))+'</p>';
      body+='</div>'+ '<label class="ui-field"><span class="ui-label">'+esc(t("note"))+'</span><textarea class="ui-textarea" name="note" maxlength="500">'+esc(item?.note||"")+'</textarea></label>'+field(t("sellingPrice"),"price","number",item?.price||"",true,'min="0" step="any"');
      submit=d==="edit-menu"?t("update"):t("save");
    }
    return '<section class="page-section"><div class="ui-dialog-wrap"><form class="ui-card ui-stack ui-dialog" id="record-form"><div class="ui-row" style="justify-content:space-between"><h1 style="font-size:24px;margin:0">'+esc(title)+'</h1><button type="button" class="ui-button ui-button--secondary" data-action="cancel-dialog" aria-label="'+esc(t("cancel"))+'">×</button></div>'+body+'<div class="ui-row">'+button(t("cancel"),"cancel-dialog")+ '<button class="ui-button ui-button--primary" type="submit">'+esc(submit)+'</button></div></form></div></section>';
  }
  function render() {
    modeButtons.forEach(b=>{const active=b.dataset.mode===state.mode;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});
    renderSidebar();renderPage();if(document.documentElement)document.documentElement.lang=language();
  }
  function setMode(mode){if((mode!=="ai"&&mode!=="manage")||state.mode===mode)return;state.mode=mode;state.detailId=null;state.dialog=null;closeDrawer();render();window.scrollTo({top:0,behavior:"auto"});}
  function toast(message){const el=$("#toast");if(el){el.textContent=message;el.classList.add("visible");window.setTimeout(()=>el.classList.remove("visible"),2600);}}
  function categoryFor(kind,value){const name=(value||"").trim()||"Default";if(!state.categories[kind].includes(name))state.categories[kind].push(name);return name;}
  function handleAction(action){
    if(action==="new-ingredient"){state.dialog="ingredient";state.editId=null;}
    else if(action==="new-menu"){state.dialog="menu";state.editId=null;}
    else if(action==="new-ingredient-category"){state.dialog="ingredient-category";state.categoryTarget="ingredients";}
    else if(action==="new-menu-category"){state.dialog="menu-category";state.categoryTarget="menu";}
    else if(action==="cancel-dialog"){state.dialog=null;state.editId=null;}
    else if(action==="back-detail"){state.detailId=null;state.detailType=null;}
    else if(action.startsWith("ingredient-detail:")){state.detailType="ingredient";state.detailId=Number(action.split(":")[1]);}
    else if(action.startsWith("menu-detail:")){state.detailType="menu";state.detailId=Number(action.split(":")[1]);}
    else if(action==="edit-detail"){state.editId=state.detailId;state.dialog=state.detailType==="ingredient"?"edit-ingredient":"edit-menu";state.detailId=null;}
    else if(action==="delete-detail"){if(window.confirm(t("confirmDelete"))){const key=state.detailType==="ingredient"?"ingredients":"menus";state[key]=state[key].filter(x=>x.id!==state.detailId);state.detailId=null;state.detailType=null;}}
    render();
  }
  pageContent?.addEventListener("click",event=>{const el=event.target instanceof Element?event.target.closest("[data-action]"):null;if(el)handleAction(el.dataset.action);});
  pageContent?.addEventListener("change",event=>{if(event.target?.name==="type"){const box=$("#one-time-fields");if(box)box.style.display=event.target.value===t("oneTime")?"grid":"none";}});
  pageContent?.addEventListener("submit",event=>{
    if(event.target.id!=="record-form")return;event.preventDefault();
    const form=event.target;const data=new FormData(form);const d=state.dialog;
    if(d==="ingredient-category"||d==="menu-category"){
      const kind=d==="ingredient-category"?"ingredients":"menu";const name=String(data.get("categoryName")||"").trim();
      if(!name){form.elements.categoryName.reportValidity();return;}
      categoryFor(kind,name);state.managePage=kind==="menu"?"menu":"ingredients";state.dialog=null;render();toast(t("savedInPreview"));return;
    }
    if(d==="ingredient"||d==="edit-ingredient"){
      const name=String(data.get("name")||"").trim();if(!name){form.elements.name.reportValidity();return;}
      const type=data.get("type")===t("oneTime")?"one-time":"reusable";
      if(type==="one-time"&&(!data.get("quantity")||!data.get("unit")||!data.get("price"))){toast(t("required"));return;}
      const item={id:d==="edit-ingredient"?state.editId:Date.now(),name,category:categoryFor("ingredients",data.get("category")),type,quantity:type==="one-time"?String(data.get("quantity")):"",unit:type==="one-time"?String(data.get("unit")):"",price:type==="one-time"?String(data.get("price")):""};
      if(d==="edit-ingredient")state.ingredients=state.ingredients.map(x=>x.id===item.id?item:x);else state.ingredients.push(item);
      state.dialog=null;state.editId=null;render();toast(t("savedInPreview"));return;
    }
    if(d==="menu"||d==="edit-menu"){
      const name=String(data.get("name")||"").trim();if(!name){form.elements.name.reportValidity();return;}
      const ingredientIds=data.getAll("ingredientIds").map(Number);
      const item={id:d==="edit-menu"?state.editId:Date.now(),name,category:categoryFor("menu",data.get("category")),ingredientIds,ingredientNames:state.ingredients.filter(i=>ingredientIds.includes(i.id)).map(i=>i.name),note:String(data.get("note")||"").trim(),price:String(data.get("price")||"")};
      if(d==="edit-menu")state.menus=state.menus.map(x=>x.id===item.id?item:x);else state.menus.push(item);
      state.dialog=null;state.editId=null;render();toast(t("savedInPreview"));
    }
  });
  sidebarContent?.addEventListener("click",event=>{const b=event.target instanceof Element?event.target.closest("[data-page]"):null;if(!b)return;const id=b.getAttribute("data-page");if(!pages.some(p=>p.id===id))return;state.managePage=id;state.detailId=null;state.dialog=null;closeDrawer();render();window.scrollTo({top:0,behavior:"auto"});});
  modeButtons.forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
  menuToggle?.addEventListener("click",openDrawer);sidebarClose?.addEventListener("click",closeDrawer);backdrop?.addEventListener("click",closeDrawer);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeDrawer();if(state.dialog){state.dialog=null;render();}}});
  languageSelect?.addEventListener("change",render);
  themeToggle?.addEventListener("click",()=>{const dark=document.documentElement.dataset.theme!=="dark";document.documentElement.dataset.theme=dark?"dark":"light";document.body.classList.toggle("dark",dark);themeToggle.setAttribute("aria-pressed",String(dark));});
  document.addEventListener("touchstart",e=>{if(e.touches.length!==1){state.tracking=false;return;}state.touchX=e.touches[0].clientX;state.touchY=e.touches[0].clientY;state.drawerGesture=Boolean(sidebar?.classList.contains("open"));state.tracking=true;},{passive:true});
  document.addEventListener("touchend",e=>{if(!state.tracking||!e.changedTouches.length)return;state.tracking=false;const dx=e.changedTouches[0].clientX-state.touchX,dy=e.changedTouches[0].clientY-state.touchY;if(Math.abs(dx)<80||Math.abs(dx)<Math.abs(dy)*1.4)return;if(state.drawerGesture){closeDrawer();return;}setMode(dx<0?"manage":"ai");},{passive:true});
  render();
})();