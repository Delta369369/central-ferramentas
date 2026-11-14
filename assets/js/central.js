(() => {
"use strict";
const grid=document.getElementById("toolsGrid"),empty=document.getElementById("empty"),search=document.getElementById("searchInput");
const count=document.getElementById("countLabel"),title=document.getElementById("sectionTitle"),filterButtons=[...document.querySelectorAll(".chip")],navButtons=[...document.querySelectorAll(".nav-link")];
let tools=[],category="todas",view="todos";
const read=(key)=>{try{return JSON.parse(localStorage.getItem(key))||[]}catch{return []}};
const write=(key,data)=>{try{localStorage.setItem(key,JSON.stringify(data))}catch{}};
const favs=()=>read("delta-central-favoritos");
function visit(id){const next=[id,...read("delta-central-recentes").filter(x=>x!==id)].slice(0,20);write("delta-central-recentes",next)}
function makeTool(tool){
 const card=document.createElement("article");card.className="tool";
 const top=document.createElement("div");top.className="tool-top";
 const ic=document.createElement("div");ic.className="tool-icon";ic.textContent=tool.simbolo||"◇";ic.setAttribute("aria-hidden","true");
 const fav=document.createElement("button");fav.className="favorite";fav.type="button";fav.textContent=favs().includes(tool.id)?"★ Favorito":"☆ Favoritar";fav.setAttribute("aria-pressed",String(favs().includes(tool.id)));
 fav.addEventListener("click",()=>{const current=favs();write("delta-central-favoritos",current.includes(tool.id)?current.filter(x=>x!==tool.id):[...current,tool.id]);render()});
 top.append(ic,fav);
 const h=document.createElement("h3");h.textContent=tool.nome;
 const p=document.createElement("p");p.textContent=tool.descricao;
 const acts=document.createElement("div");acts.className="tool-actions";
 const a=document.createElement("a");a.className="open-tool";a.textContent="INICIAR";a.href=tool.url;a.addEventListener("click",()=>visit(tool.id));acts.append(a);
 card.append(top,h,p,acts);return card;
}
function render(){
 const q=search.value.trim().toLocaleLowerCase("pt-BR"),f=favs(),r=read("delta-central-recentes");
 const filtered=tools.filter(t=>(category==="todas"||t.categoria===category)&&(view!=="favoritos"||f.includes(t.id))&&(view!=="recentes"||r.includes(t.id))&&[t.nome,t.descricao,t.categoria].join(" ").toLocaleLowerCase("pt-BR").includes(q));
 if(view==="recentes")filtered.sort((a,b)=>r.indexOf(a.id)-r.indexOf(b.id));
 grid.replaceChildren(...filtered.map(makeTool));empty.hidden=filtered.length!==0;count.textContent=filtered.length+" ferramenta"+(filtered.length===1?"":"s");
 title.textContent=view==="favoritos"?"Favoritos":view==="recentes"?"Acessadas recentemente":"Suas ferramentas";
}
filterButtons.forEach(b=>b.addEventListener("click",()=>{category=b.dataset.category;filterButtons.forEach(x=>x.classList.toggle("active",x===b));render()}));
navButtons.forEach(b=>b.addEventListener("click",()=>{view=b.dataset.view;navButtons.forEach(x=>x.classList.toggle("active",x===b));document.getElementById("sidebar").classList.remove("open");document.getElementById("menuToggle").setAttribute("aria-expanded","false");render()}));
document.getElementById("menuToggle").addEventListener("click",e=>{const open=document.getElementById("sidebar").classList.toggle("open");e.currentTarget.setAttribute("aria-expanded",String(open))});
search.addEventListener("input",render);
fetch("./ferramentas.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Catálogo indisponível");return r.json()}).then(data=>{tools=Array.isArray(data)?data.filter(t=>t.status==="ativo"):[];render()}).catch(()=>{empty.hidden=false;empty.textContent="Não foi possível carregar o catálogo de ferramentas.";count.textContent="0 ferramentas"});
})();