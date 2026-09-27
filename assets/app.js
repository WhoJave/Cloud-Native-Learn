const chapters=[
["00-overview","00","全貌：什么是云原生"],
["01-containers","01","容器：从虚拟机到 Linux 进程"],
["02-kubernetes-control-plane","02","Kubernetes：声明式控制系统"],
["03-networking","03","网络：CNI、Service 与 eBPF"],
["04-storage","04","存储：PV、CSI 与 StatefulSet"],
["05-microservices-distributed","05","微服务与分布式系统"],
["06-observability","06","可观测性：Metrics / Logs / Traces"],
["07-devops-gitops-platform","07","CI/CD、GitOps 与平台工程"],
["08-security","08","云原生安全与零信任"],
["09-multicluster-serverless-finops","09","多集群、Serverless 与 FinOps"],
["10-case-study","10","案例：消费金融额度申请全链路"],
["11-roadmap","11","学习路线与架构师检查清单"]
];

const nav=document.querySelector("#nav"),content=document.querySelector("#content"),crumb=document.querySelector("#breadcrumbs");
nav.innerHTML=chapters.map(([id,n,t])=>`<a class="nav-link" data-id="${id}" href="#${id}"><span class="nav-index">${n}</span><span>${t}</span></a>`).join("");

marked.setOptions({gfm:true,breaks:false});
mermaid.initialize({startOnLoad:false,theme:"neutral",securityLevel:"loose"});

function currentId(){const x=location.hash.replace("#","");return chapters.some(c=>c[0]===x)?x:"00-overview"}
async function load(){
 const id=currentId(),chapter=chapters.find(c=>c[0]===id);
 document.querySelectorAll(".nav-link").forEach(a=>a.classList.toggle("active",a.dataset.id===id));
 crumb.textContent=chapter[2];
 content.innerHTML='<div class="loading">正在加载章节…</div>';
 try{
  const r=await fetch(`./docs/${id}.md`); if(!r.ok)throw new Error(r.status);
  const md=await r.text(); content.innerHTML=marked.parse(md);
  content.querySelectorAll("pre code.language-mermaid").forEach(block=>{
    const pre=block.parentElement,div=document.createElement("div");div.className="mermaid";div.textContent=block.textContent;pre.replaceWith(div);
  });
  await mermaid.run({querySelector:".mermaid"});
  document.querySelectorAll("a[href^='http']").forEach(a=>{a.target="_blank";a.rel="noreferrer"});
  window.scrollTo({top:0,behavior:"instant"});
  updateProgress(id);
 }catch(e){content.innerHTML='<div class="callout"><strong>章节加载失败。</strong><br>请刷新页面或检查 GitHub Pages 发布状态。</div>'}
}
function updateProgress(id){
 const idx=chapters.findIndex(c=>c[0]===id),pct=Math.round((idx+1)/chapters.length*100);
 document.querySelector("#progressText").textContent=pct+"%";
 document.querySelector("#progressBar").style.width=pct+"%";
 localStorage.setItem("cn-last",id);
}
window.addEventListener("hashchange",load);
document.querySelector("#themeBtn").onclick=()=>{document.body.classList.toggle("light");localStorage.setItem("cn-theme",document.body.classList.contains("light")?"light":"dark")};
if(localStorage.getItem("cn-theme")==="light")document.body.classList.add("light");
document.querySelector("#menuBtn").onclick=()=>document.querySelector("#sidebar").classList.toggle("open");
nav.addEventListener("click",()=>document.querySelector("#sidebar").classList.remove("open"));
if(!location.hash){const last=localStorage.getItem("cn-last");if(last)location.hash=last}
load();
