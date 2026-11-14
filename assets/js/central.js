(()=>{
"use strict";
const $=id=>document.getElementById(id);
const STORAGE={favorites:"delta-central-favoritos",recent:"delta-central-recentes",glow:"delta-central-less-glow",compact:"delta-central-compact"};
const get=(key,otherwise)=>{try{const v=JSON.parse(localStorage.getItem(key));return v===null?otherwise:v}catch{return otherwise}};
const set=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v))}catch{}};
const tool={id:"organizador-bo",nome:"Organizador de BO",descricao:"Facilita a leitura e a organização dos boletins de ocorrência e permite copiar textos",categoria:"Policial",url:"./ferramentas/organizador-bo/"};
const cards=[{id:"gerador-hash",nome:"Gerador de Hash",descricao:"Coleta e verificação de integridade de arquivos.",categoria:"Perícia Digital",active:false},{...tool,active:true},{id:"gerador-senhas",nome:"Gerador de Senha Forte",descricao:"Geração de senhas aleatórias e seguras.",categoria:"Utilitários",active:false},{id:"futuras",nome:"Próximas Ferramentas",descricao:"Novas ferramentas serão incorporadas gradualmente.",categoria:"Documentos",active:false}];
let view="inicio",category="todas";
function list(key){const value=get(key,[]);return Array.isArray(value)?value:[]}
function isFav(id){return list(STORAGE.favorites).includes(id)}
function flipFav(id){const old=list(STORAGE.favorites);set(STORAGE.favorites,isFav(id)?old.filter(x=>x!==id):[...old,id]);render()}
function visit(id){set(STORAGE.recent,[id,...list(STORAGE.recent).filter(x=>x!==id)].slice(0,20))}
function matches(item,q){return (category==="todas"||item.categoria===category)&&[item.nome,item.descricao,item.categoria].join(" ").toLocaleLowerCase("pt-BR").includes(q)}
function getItems(){const q=$("search").value.trim().toLocaleLowerCase("pt-BR");let items=cards.filter(c=>matches(c,q));if(view==="favoritos")items=items.filter(c=>isFav(c.id));if(view==="recentes"){const recent=list(STORAGE.recent);items=items.filter(c=>recent.includes(c.id)).sort((a,b)=>recent.indexOf(a.id)-recent.indexOf(b.id))}return items}
function catalogCard(c){const el=document.createElement("article");el.className="catalog-card";const h=document.createElement("h3");h.textContent=c.nome;const p=document.createElement("p");p.textContent=c.descricao;el.append(h,p);if(c.active){const fav=document.createElement("button");fav.textContent=isFav(c.id)?"★ Favorito":"☆ Favoritar";fav.addEventListener("click",()=>flipFav(c.id));const a=document.createElement("a");a.href=c.url;a.textContent="Abrir";a.addEventListener("click",()=>visit(c.id));el.append(fav,a)}else{const note=document.createElement("span");note.className="coming-pill";note.textContent="Em desenvolvimento";el.append(note)}return el}
function render(){const items=getItems(),searching=$("search").value.trim().length>0,filtered=category!=="todas"||searching||view!=="inicio";$("dashboard").hidden=filtered;$("catalogSection").hidden=!filtered;if(filtered){$("catalogTitle").textContent=view==="favoritos"?"Favoritos":view==="recentes"?"Acessadas recentemente":"Ferramentas";$("catalogGrid").replaceChildren(...items.map(catalogCard));$("emptyState").hidden=items.length!==0}const b=document.querySelector(".mini-fav");if(b){const val=isFav("organizador-bo");b.textContent=val?"★ Favorito":"☆ Favoritar";b.setAttribute("aria-pressed",String(val))}document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===view));document.querySelectorAll(".filter").forEach(n=>n.classList.toggle("active",n.dataset.filter===category))}
document.querySelectorAll(".nav-item").forEach(n=>n.addEventListener("click",()=>{view=n.dataset.view;$("sidebar").classList.remove("open");$("menuButton").setAttribute("aria-expanded","false");render()}));
document.querySelectorAll(".filter").forEach(n=>n.addEventListener("click",()=>{category=n.dataset.filter;render()}));
$("search").addEventListener("input",render);$("organizerLink").addEventListener("click",()=>visit("organizador-bo"));document.querySelector(".mini-fav").addEventListener("click",()=>flipFav("organizador-bo"));
$("menuButton").addEventListener("click",()=>{const open=$("sidebar").classList.toggle("open");$("menuButton").setAttribute("aria-expanded",String(open))});
function dialog(id){$(id).showModal()}
$("noticeButton").addEventListener("click",()=>dialog("infoDialog"));$("settingsButton").addEventListener("click",()=>dialog("settingsDialog"));
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));
document.querySelectorAll("dialog").forEach(d=>d.addEventListener("click",e=>{if(e.target===d)d.close()}));
const reduced=get(STORAGE.glow,false),compact=get(STORAGE.compact,false);
$("reduceGlow").checked=reduced;$("compactCards").checked=compact;document.body.classList.toggle("reduce-glow",reduced);document.body.classList.toggle("compact-cards",compact);
$("reduceGlow").addEventListener("change",e=>{set(STORAGE.glow,e.target.checked);document.body.classList.toggle("reduce-glow",e.target.checked)});
$("compactCards").addEventListener("change",e=>{set(STORAGE.compact,e.target.checked);document.body.classList.toggle("compact-cards",e.target.checked)});
render();
})();