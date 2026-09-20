const revealItems = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
},{threshold:.12});
revealItems.forEach(el=>observer.observe(el));

const modal=document.getElementById("modal");
const modalVideo=document.getElementById("modalVideo");
const closeVideoModal=()=>{
  modalVideo.pause();
  modalVideo.removeAttribute("src");
  modalVideo.load();
  modal.classList.remove("open");
};
document.querySelectorAll(".video-card").forEach(card=>{
  card.addEventListener("click",()=>{
    modalVideo.src=card.dataset.video;
    modal.classList.add("open");
    modalVideo.currentTime=0;
    modalVideo.play().catch(()=>{});
  });
});
document.getElementById("close").onclick=closeVideoModal;
document.getElementById("modalOk").onclick=closeVideoModal;
modal.addEventListener("click",e=>{if(e.target===modal)closeVideoModal()});

const messageBtn = document.getElementById("messageBtn");
const memoryForm = document.getElementById("memoryForm");
const formClose = document.getElementById("formClose");
const memoryName = document.getElementById("memoryName");
const memoryText = document.getElementById("memoryText");
const memoryDate = document.getElementById("memoryDate");
const messageBoard = document.querySelector(".message-board");
const memoryNotesList = document.getElementById("memoryNotesList");
const renderedMemoryIds = new Set();
const reactionCounts = new Map();

function normalizeEmoji(value){
  return String(value || "").trim().replace(/\s+/g, "").slice(0, 8);
}
function renderReactions(memoryId){
  const wrap=document.querySelector(`[data-reactions-for="${CSS.escape(String(memoryId))}"]`);
  if(!wrap) return;
  const counts=reactionCounts.get(String(memoryId)) || {};
  wrap.innerHTML=Object.entries(counts)
    .filter(([,count])=>count>0)
    .sort((a,b)=>b[1]-a[1])
    .map(([emoji,count])=>`<span class="reaction-chip">${escapeHtml(emoji)} <b>${count}</b></span>`).join("");
}
function addReactionToLocal(reaction){
  const id=String(reaction.memory_id);
  const emoji=normalizeEmoji(reaction.emoji);
  if(!id || !emoji) return;
  const counts=reactionCounts.get(id) || {};
  counts[emoji]=(counts[emoji]||0)+1;
  reactionCounts.set(id,counts);
  renderReactions(id);
}
async function loadReactions(memoryIds){
  if(!memoryIds.length) return;
  const {data,error}=await supabaseClient.from("memory_reactions").select("id,memory_id,emoji,created_at").in("memory_id",memoryIds);
  if(error){ console.warn("Reactions table not ready yet:", error.message); return; }
  data.forEach(addReactionToLocal);
}
async function saveReaction(memoryId, emoji){
  const clean=normalizeEmoji(emoji);
  if(!clean) return false;
  const {data,error}=await supabaseClient.from("memory_reactions").insert({memory_id:Number(memoryId),emoji:clean}).select("id,memory_id,emoji,created_at").single();
  if(error){
    console.error("Reaction save error:",error);
    alert("Reaction save panna mudiyala. Supabase-la memory_reactions table setup pannunga.");
    return false;
  }
  addReactionToLocal(data);
  return true;
}
const messageViewer = document.getElementById("messageViewer");
const messageViewerClose = document.getElementById("messageViewerClose");
const messageViewerText = document.getElementById("messageViewerText");
const messageViewerName = document.getElementById("messageViewerName");
const messageViewerDate = document.getElementById("messageViewerDate");

function formatMemoryDateTime(memory){
  const date = memory?.memory_date ?? memory?.date ?? "";
  const createdAt = memory?.created_at ?? "";
  if (!date && !createdAt) return "";
  let dateLabel = date;
  if (date) {
    const parsed = new Date(`${date}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      dateLabel = parsed.toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
      });
    }
  }
  if (!createdAt) return dateLabel;
  const timeLabel = new Date(createdAt).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata"
  });
  return `${dateLabel || new Date(createdAt).toLocaleDateString("en-IN", {day:"2-digit", month:"short", year:"numeric", timeZone:"Asia/Kolkata"})} • ${timeLabel}`;
}

function openMessageViewer(memory){
  messageViewerText.textContent = String(memory.message ?? memory.text ?? "");
  messageViewerName.textContent = memory.name ? `— ${memory.name}` : "";
  messageViewerDate.textContent = formatMemoryDateTime(memory);
  messageViewer.classList.add("open");
  messageViewer.setAttribute("aria-hidden","false");
  document.body.classList.add("message-viewer-open");
}
function closeMessageViewer(){
  messageViewer.classList.remove("open");
  messageViewer.setAttribute("aria-hidden","true");
  document.body.classList.remove("message-viewer-open");
}

// Supabase connection
const SUPABASE_URL = "https://vbqxltorxcicyywdpwui.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_eCXj5a9oWKMryfuIaqatLg_R6JRqfI5";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

memoryDate.value = new Date().toISOString().slice(0,10);

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#039;"
  }[c]));
}
function addMemoryNote(memory, animate=true){
  if (memory?.id != null && renderedMemoryIds.has(String(memory.id))) return;
  if (memory?.id != null) renderedMemoryIds.add(String(memory.id));
  const note=document.createElement("article");
  note.className="sticky memory-note";
  if (memory?.id != null) note.dataset.memoryId = String(memory.id);
  note.innerHTML = `<span class="note-message">${escapeHtml(memory.message ?? memory.text)}</span>
    <span class="note-name">— ${escapeHtml(memory.name)}</span>
    <span class="note-date">${escapeHtml(formatMemoryDateTime(memory))}</span>
    <div class="reaction-area" aria-label="React to this memory">
      <div class="reaction-list" data-reactions-for="${escapeHtml(memory.id)}"></div>
      <form class="reaction-form">
        <input class="reaction-input" type="text" inputmode="text" autocomplete="off" maxlength="8" placeholder="Type any emoji…" aria-label="Type any emoji reaction">
        <button type="submit" class="reaction-add" aria-label="Add reaction">↗</button>
      </form>
    </div>`;
  const colors=["#f3e4a7","#cfe2e9","#efd5c1","#e4e1ba","#f1d3a8"];
  note.style.background=colors[(memory.id ?? renderedMemoryIds.size) % colors.length];
  note.setAttribute("role","button");
  note.setAttribute("tabindex","0");
  note.setAttribute("aria-label","Open this memory");
  note.addEventListener("click",()=>openMessageViewer(memory));
  note.addEventListener("keydown",e=>{
    if(e.key === "Enter" || e.key === " "){
      e.preventDefault();
      openMessageViewer(memory);
    }
  });
  const reactionForm=note.querySelector(".reaction-form");
  const reactionInput=note.querySelector(".reaction-input");
  reactionForm.addEventListener("click",e=>e.stopPropagation());
  reactionInput.addEventListener("click",e=>e.stopPropagation());
  reactionForm.addEventListener("submit",async e=>{
    e.preventDefault();
    e.stopPropagation();
    const value=reactionInput.value;
    reactionInput.value="";
    await saveReaction(memory.id,value);
  });
  if(!animate) note.style.animation="none";
  memoryNotesList.appendChild(note);
}

async function loadMemories(){
  const { data, error } = await supabaseClient
    .from("memories")
    .select("id,name,message,memory_date,created_at")
    .order("created_at", { ascending: true });

  if(error){
    console.error("Supabase load error:", error);
    showMemoryStatus("Could not load shared memories. Check the Supabase table/RLS setup.", true);
    return [];
  }
  data.forEach(m => addMemoryNote(m, false));
  await loadReactions(data.map(m=>m.id));
  return data;
}

function showMemoryStatus(message, isError=false){
  let status=document.getElementById("memoryStatus");
  if(!status){
    status=document.createElement("small");
    status.id="memoryStatus";
    status.style.display="block";
    status.style.marginTop="10px";
    status.style.opacity=".85";
    memoryForm.querySelector(".memory-form-card").appendChild(status);
  }
  status.textContent=message;
  status.style.color=isError ? "#b94a48" : "inherit";
}

messageBtn.addEventListener("click",()=>{
  memoryForm.classList.add("open");
  setTimeout(()=>memoryName.focus(),80);
});
formClose.addEventListener("click",()=>memoryForm.classList.remove("open"));
memoryForm.addEventListener("click",e=>{
  if(e.target===memoryForm) memoryForm.classList.remove("open");
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    memoryForm.classList.remove("open");
    closeMessageViewer();
  }
});
messageViewerClose.addEventListener("click",closeMessageViewer);
messageViewer.addEventListener("click",e=>{
  if(e.target===messageViewer) closeMessageViewer();
});

memoryForm.querySelector(".memory-form-card").addEventListener("submit", async e=>{
  e.preventDefault();
  const name=memoryName.value.trim();
  const message=memoryText.value.trim();
  const memory_date=memoryDate.value || null;
  if(!name || !message) return;

  const saveButton=memoryForm.querySelector(".save-memory");
  saveButton.disabled=true;
  saveButton.textContent="Saving...";
  showMemoryStatus("Saving to the shared memory wall...");

  const { data, error } = await supabaseClient
    .from("memories")
    .insert({ name, message, memory_date })
    .select("id,name,message,memory_date,created_at")
    .single();

  saveButton.disabled=false;
  saveButton.textContent="Save Memory ♥";

  if(error){
    console.error("Supabase insert error:", error);
    showMemoryStatus("Could not save. Please check your Supabase table and RLS policies.", true);
    return;
  }

  addMemoryNote(data, true);
  memoryName.value="";
  memoryText.value="";
  showMemoryStatus("Memory saved successfully ♥");
  setTimeout(()=>memoryForm.classList.remove("open"), 500);
});

loadMemories().then(()=>{
  // Keep the wall synced when another friend adds a memory from another phone/browser.
  supabaseClient
    .channel("shared-memory-wall")
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "memories"
    }, payload => {
      addMemoryNote(payload.new, true);
    })
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "memory_reactions"
    }, payload => {
      addReactionToLocal(payload.new);
    })
    .subscribe(status => {
      if(status === "SUBSCRIBED") console.log("Shared memory wall realtime connected");
    });
});

const memories=[
  ["Kerala","First Trip to Kerala — photos, chaos and a bus full of stories."],
  ["birthday","Annoying Bala's Birthday — cake, jokes and zero peace."],
  ["exam","Exam Nights — somehow we survived on snacks and panic."],
  ["convocation","Convocation — one chapter ended, the squad stayed."],
  ["orientation","Orientation Day — where the five idiots first became a team."]
];
const input=document.getElementById("search"), results=document.getElementById("results");
function searchMemory(){
  const q=input.value.trim().toLowerCase();
  if(!q){results.textContent="Type a word to search the memories.";return}
  const found=memories.filter(m=>m[0].toLowerCase().includes(q)||m[1].toLowerCase().includes(q));
  results.innerHTML=found.length?found.map(m=>`<div>✦ ${m[1]}</div>`).join(""):"No memory found — try another word.";
}
document.getElementById("searchBtn").onclick=searchMemory;
input.addEventListener("keydown",e=>{if(e.key==="Enter")searchMemory()});
