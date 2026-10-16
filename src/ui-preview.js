const settingsItems=[
 ["general","General","App defaults, regional formats, and startup preferences."],
 ["appearance","Appearance","Theme, density, and comfortable display options."],
 ["language","Language","Choose English, Burmese, or Thai for the interface."],
 ["business-profile","Business profile","Manage business identity and the active workspace."],
 ["data-sync","Data & sync","Local data status, backup, restore, and future cloud sync."],
 ["ai-preferences","AI preferences","Configure assistant behavior, language, and usage controls."],
 ["security","Security","Sign-in, session, access, and privacy controls."],
 ["about","About KitchAI","App version, help, policies, and product information."]
];
const businessItems=[
 ["overview","Business overview","A home for the selected food business and its daily activity."],
 ["sales","Sales","Record sales, discounts, payment methods, and corrections."],
 ["purchases","Purchases","Record ingredient and supply purchases using existing catalog items."],
 ["ingredients","Ingredients & stock","Manage ingredient catalog, stock levels, units, and stock counts."],
 ["menu-recipes","Menu & recipes","Maintain menu products, recipe quantities, and direct ingredients."],
 ["production","Production","Plan batches, record actual ingredient usage, and post finished output."],
 ["finished-stock","Finished food","Track prepared stock, sales, carry-over, and end-of-day disposition."],
 ["expenses","Business expenses","Track rent, transport, utilities, and other operating costs."]
];
const personalItems=[
 ["overview","Personal overview","A separate view of personal money, balances, and recent activity."],
 ["income","Personal income","Record personal income without mixing it with business revenue."],
 ["expenses","Personal expenses","Track household and personal spending."],
 ["accounts","Personal accounts","Plan accounts, cash balances, and transfers."],
 ["assets-debts","Assets & debts","Keep a separate overview of personal assets and liabilities."]
];
const pages={
 "dashboard":{title:"Dashboard",crumb:"Workspace",desc:"A clear starting point for your food business. Live metrics will appear when the relevant data sources are connected.",tag:"Workspace home",sections:[["Today at a glance","Sales, expenses, profit, production, and cash summaries from verified records."],["AI Quick Chat","Ask questions about your own records when the AI service is configured."],["Daily operations","Quick access to sales, purchases, production, stock, and day closing."],["Attention needed","Stock alerts, pending sync, and unsold food requiring a decision."],["Recent activity","A traceable timeline of saved business changes."]]},
 "business":{title:"Business",crumb:"Workspace",desc:"Choose a business workspace and manage its operations. No sample financial values are shown in this prototype.",tag:"Business workspace",items:businessItems},
 "personal":{title:"Personal",crumb:"Workspace",desc:"Keep personal finances separate from every business workspace.",tag:"Personal workspace",items:personalItems},
 "reports":{title:"Reports",crumb:"Workspace",desc:"Review reports generated from saved records, with date ranges and clear calculation definitions.",tag:"Reporting",sections:[["Sales & discounts","Sales totals, discounts, payment breakdown, and sales history."],["Costs & profitability","Recorded expenses, recipe costs, gross margin, and net result where data supports it."],["Production & waste","Planned versus actual output, ingredient use, waste, giveaways, and carry-over."],["Business vs personal","Separate reports with no accidental mixing of transactions."]]},
 "ai-assistant":{title:"AI Assistant",crumb:"Workspace",desc:"A dedicated place to ask questions and get explanations grounded in your KitchAI records.",tag:"AI workspace",sections:[["Ask about your business","Questions about sales, costs, stock, production, and reports."],["Explain the answer","Show which records and time range support each answer."],["Privacy & controls","Configure AI access, language, and usage before enabling live responses."]]},
 "tools":{title:"Tools",crumb:"Workspace",desc:"Utilities that support daily operations without replacing the source records.",tag:"Utilities",sections:[["Unit converter","Convert supported ingredient and packaging units."],["Price & margin calculator","Explore calculations using values you enter, without saving them as business records."],["Import & export","Prepare data transfer tools with validation and clear recovery steps."]]},
 "settings":{title:"Settings",crumb:"Workspace",desc:"One home for app preferences, workspace setup, data controls, and account security.",tag:"Preferences",items:settingsItems,settings:true}
};
for(const [key,label,description] of [...businessItems.map(x=>[x[0],x[1],x[2]]),...personalItems.map(x=>[x[0],x[1],x[2]])]){
 if(key==="overview") continue;
 pages[key]={title:label,crumb:key==="sales"||businessItems.some(x=>x[0]===key)?"Business":"Personal",desc:description,tag:"Business workspace",sections:[["Page purpose",description],["Planned content","The page will be built around the required workflows, validation, and recovery behavior."],["Data status","Backend actions are not connected in this UI structure preview."]]};
}
for(const [key,label,description] of settingsItems){
 pages["settings/"+key]={title:label,crumb:"Settings",desc:description,tag:"Settings",settings:true,settingsKey:key,sections:[["Purpose",description],["Controls to add","The page will receive its own focused controls, explanations, and safe-save behavior."],["Connection status","Settings are visual placeholders until their behavior is implemented and tested."]]};
}
const translations={
 en:{workspace:"WORKSPACE",dashboard:"Dashboard",business:"Business",personal:"Personal",reports:"Reports",ai:"AI Assistant",tools:"Tools",settings:"Settings",preview:"PREVIEW",prototype:"UI prototype",backend:"Backend not connected",coming:"Coming soon",purpose:"Page purpose",planned:"Planned content",data:"Data status"},
 my:{workspace:"လုပ်ငန်းခွင်",dashboard:"ပင်မစာမျက်နှာ",business:"လုပ်ငန်း",personal:"ကိုယ်ရေးကိုယ်တာ",reports:"အစီရင်ခံစာ",ai:"AI အကူအညီ",tools:"ကိရိယာများ",settings:"ဆက်တင်များ",preview:"အစမ်းကြည့်",prototype:"UI ပုံစံငယ်",backend:"Backend မချိတ်ဆက်ရသေး",coming:"မကြာမီလာမည်",purpose:"စာမျက်နှာရည်ရွယ်ချက်",planned:"ထည့်သွင်းမည့်အရာများ",data:"ဒေတာအခြေအနေ"},
 th:{workspace:"พื้นที่ทำงาน",dashboard:"แดชบอร์ด",business:"ธุรกิจ",personal:"ส่วนตัว",reports:"รายงาน",ai:"ผู้ช่วย AI",tools:"เครื่องมือ",settings:"ตั้งค่า",preview:"ตัวอย่าง",prototype:"ต้นแบบ UI",backend:"ยังไม่เชื่อมต่อ Backend",coming:"เร็ว ๆ นี้",purpose:"วัตถุประสงค์ของหน้า",planned:"เนื้อหาที่วางแผนไว้",data:"สถานะข้อมูล"}
};
const navLabels={dashboard:"dashboard",business:"business",personal:"personal",reports:"reports","ai-assistant":"ai",tools:"tools",settings:"settings"};
const content=document.querySelector("#page-content");
const breadcrumb=document.querySelector("#breadcrumb");
function route(){let path=location.hash.replace(/^#\/?/,"").replace(/\/$/,"")||"dashboard";return pages[path]?path:"dashboard"}
function card(title,description,icon="•"){return `<li><span class="list-icon" aria-hidden="true">${icon}</span><span><b>${escapeText(title)}</b><small>${escapeText(description)}</small></span></li>`}
function escapeText(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){const path=route(),page=pages[path],lang=translations[document.querySelector("#language-select").value]||translations.en;document.documentElement.lang=document.querySelector("#language-select").value==="my"?"my":document.querySelector("#language-select").value;document.querySelectorAll("#primary-nav a").forEach(a=>{const target=a.dataset.route;const active=target==="settings"?path.startsWith("settings"):target===path;a.classList.toggle("active",active);if(active)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});breadcrumb.innerHTML=`${escapeText(page.crumb)} <span>/</span> ${escapeText(page.title)}`;document.querySelector(".prototype-chip").textContent=lang.preview;document.querySelector(".workspace-label").textContent=lang.workspace;document.querySelector(".local-note b").textContent=lang.prototype;document.querySelector(".local-note small").textContent=lang.backend;
let html=`<div class="page-heading"><div><p class="eyebrow">${escapeText(page.tag||"Workspace")}</p><h1>${escapeText(page.title)}</h1><p class="page-description">${escapeText(page.desc)}</p></div><span class="coming-soon">${lang.coming}</span></div>`;
if(page.items){if(page.settings){html+=`<div class="settings-layout"><nav class="panel settings-menu" aria-label="Settings pages">${page.items.map(([key,label])=>`<a class="${path==="settings/"+key?"active":""}" href="#/settings/${key}">${escapeText(label)}</a>`).join("")}</nav><section class="panel setting-detail"><div class="panel-header"><h2>${escapeText(path==="settings"?"Settings overview":page.title)}</h2><span class="status-label">Not connected</span></div><p class="panel-subtitle">Each setting has a dedicated page so it can grow without crowding the main settings screen.</p><ul class="outline-list">${page.items.map(([key,label,desc])=>card(label,desc,"⚙")).join("")}</ul></section></div>`}else{html+=`<div class="content-grid">${page.items.map(([key,label,desc])=>`<a class="panel span-4 page-link" href="#/${path==="business"?"":path==="personal"?"":""}${key}" aria-label="Open ${escapeText(label)}"><div class="panel-header"><span class="list-icon">${escapeText(label.slice(0,1))}</span><span class="coming-soon">${lang.coming}</span></div><h2>${escapeText(label)}</h2><p class="panel-subtitle">${escapeText(desc)}</p></a>`).join("")}</div>`}}else{const sections=page.sections||[];html+=`<div class="content-grid">${sections.map((item,i)=>`<section class="panel ${path==="dashboard"?(i===0?"span-4":i===1?"span-8":"span-6"):"span-6"}"><div class="panel-header"><h2>${escapeText(item[0])}</h2><span class="status-label">Planned</span></div><div class="empty-state"><strong>${escapeText(item[0])}</strong><p>${escapeText(item[1])}</p></div></section>`).join("")}</div>`}
content.innerHTML=html;document.querySelector("#main").focus({preventScroll:true});}
document.querySelector("#language-select").addEventListener("change",render);
document.querySelector("#theme-toggle").addEventListener("click",()=>document.body.classList.toggle("dark"));
document.querySelector("#menu-toggle").addEventListener("click",()=>document.body.classList.toggle("nav-open"));
document.querySelector("#mobile-backdrop").addEventListener("click",()=>document.body.classList.remove("nav-open"));
document.addEventListener("click",event=>{if(event.target.closest("a"))document.body.classList.remove("nav-open")});
window.addEventListener("hashchange",render);
render();