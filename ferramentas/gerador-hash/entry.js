const hashCategories={fotos:{accept:'image/*,.heic,.heif,.avif,.webp,.bmp,.tif,.tiff,.raw,.cr2,.nef,.arw,.dng,.svg,.jfif,.ico',extensions:'jpg jpeg png gif bmp tif tiff webp heic heif avif svg jfif ico raw cr2 nef arw dng psd'.split(' ')},videos:{accept:'video/*,.mkv,.avi,.mov,.wmv,.flv,.webm,.m4v,.3gp,.mts,.m2ts,.vob,.ts',extensions:'mp4 m4v mov avi mkv webm wmv flv mpg mpeg 3gp 3g2 mts m2ts ts vob ogv asf'.split(' ')},audios:{accept:'audio/*,.opus,.ogg,.oga,.amr,.m4a,.aac,.flac,.wma,.aiff,.caf',extensions:'mp3 wav m4a aac flac ogg oga opus amr wma aiff aif caf midi mid 3ga ac3'.split(' ')},diversos:{accept:'*/*',extensions:[]}};
const hashPicker=document.createElement("input");
hashPicker.type="file";hashPicker.multiple=true;hashPicker.hidden=true;
document.body.append(hashPicker);
const hashButtons=[...document.querySelectorAll(".hash-actions button")];
const hashTypes=["fotos","videos","audios","diversos"];
const hashStatus=document.createElement("p");
hashStatus.setAttribute("role","status");hashStatus.style.fontSize="14px";
document.querySelector(".hash-actions").after(hashStatus);
let hashCategory="diversos";
hashButtons.forEach((button,index)=>{
 button.style.cursor="pointer";
 button.addEventListener("click",()=>{
  hashCategory=hashTypes[index];
  hashPicker.accept=hashCategories[hashCategory].accept;
  hashPicker.value="";
  hashPicker.click();
 });
});
hashPicker.addEventListener("change",async()=>{
 if(!hashPicker.files.length)return;
 hashButtons.forEach(button=>button.disabled=true);
 hashStatus.textContent="Preparando arquivos para abrir o Gerador de Hash…";
 try{
  const token=await HashTransfer.send(hashPicker.files,hashCategory);
  location.href="./ferramentas/gerador-hash/?selection="+encodeURIComponent(token);
 }catch(error){
  hashStatus.textContent="Não foi possível abrir a seleção. Verifique o espaço disponível no navegador e tente novamente.";
  hashButtons.forEach(button=>button.disabled=false);
 }
});
window.addEventListener("pageshow",()=>{
 hashButtons.forEach(button=>button.disabled=false);
 hashStatus.textContent="";
});
