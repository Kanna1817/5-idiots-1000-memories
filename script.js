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
const messageViewer = document.getElementById("messageViewer");
const messageViewerClose = document.getElementById("messageViewerClose");
const messageViewerText = document.getElementById("messageViewerText");
const messageViewerName = document.getElementById("messageViewerName");
const messageViewerDate = document.getElementById("messageViewerDate");

function openMessageViewer(memory){
  messageViewerText.textContent = String(memory.message ?? memory.text ?? "");
  messageViewerName.textContent = memory.name ? `— ${memory.name}` : "";
  const date = memory.memory_date ?? memory.date ?? "";
  messageViewerDate.textContent = date ? date : "";
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
    <span class="note-date">${escapeHtml(memory.memory_date ?? memory.date ?? "")}</span>`;
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
      event: "INSERT",
      schema: "public",
      table: "memories"
    }, payload => {
      addMemoryNote(payload.new, true);
    })
    .on("postgres_changes", {
      event: "DELETE",
      schema: "public",
      table: "memories"
    }, payload => {
      const id = payload.old?.id;
      if(id != null){
        const note = document.querySelector(`.memory-note[data-memory-id="${CSS.escape(String(id))}"]`);
        if(note) note.remove();
      }
    })
    .subscribe(status => {
      if(status === "SUBSCRIBED") console.log("Shared memory wall realtime connected");
    });
});

// Private admin tools: opened only with the URL hash #admin.
// Security is enforced by Supabase RLS; this UI is not the security boundary.
const adminPanel = document.getElementById("adminPanel");
const adminClose = document.getElementById("adminClose");
const adminLoginView = document.getElementById("adminLoginView");
const adminManageView = document.getElementById("adminManageView");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const adminStatus = document.getElementById("adminStatus");
const adminMessageList = document.getElementById("adminMessageList");
const adminSignedInAs = document.getElementById("adminSignedInAs");
const adminSignOut = document.getElementById("adminSignOut");

function setAdminStatus(message, isError=false){
  if(!adminStatus) return;
  adminStatus.textContent = message || "";
  adminStatus.classList.toggle("error", !!isError);
}
function isAdminSession(session){
  return !!session && session.user?.app_metadata?.role === "admin";
}
function openAdminPanel(){
  if(!adminPanel) return;
  adminPanel.classList.add("open");
  adminPanel.setAttribute("aria-hidden","false");
  document.body.classList.add("admin-open");
}
function closeAdminPanel(){
  if(!adminPanel) return;
  adminPanel.classList.remove("open");
  adminPanel.setAttribute("aria-hidden","true");
  document.body.classList.remove("admin-open");
}
function renderAdminLogin(){
  adminLoginView.hidden=false;
  adminManageView.hidden=true;
  adminEmail.value="";
  adminPassword.value="";
  setAdminStatus("");
}
async function renderAdminManage(session){
  adminLoginView.hidden=true;
  adminManageView.hidden=false;
  adminSignedInAs.textContent = session.user.email || "Admin";
  setAdminStatus("");
  await loadAdminMessages();
}
async function loadAdminMessages(){
  adminMessageList.innerHTML='<div class="admin-empty">Loading memories…</div>';
  const {data,error}=await supabaseClient
    .from("memories")
    .select("id,name,message,memory_date,created_at")
    .order("created_at",{ascending:true});
  if(error){
    adminMessageList.innerHTML='';
    setAdminStatus("Could not load memories. Check the Supabase DELETE policy/setup.",true);
    return;
  }
  if(!data.length){
    adminMessageList.innerHTML='<div class="admin-empty">No saved memories yet.</div>';
    return;
  }
  adminMessageList.innerHTML="";
  data.forEach(renderAdminMessage);
}
function renderAdminMessage(memory){
  const row=document.createElement("article");
  row.className="admin-message-row";
  row.dataset.memoryId=String(memory.id);
  const date=memory.memory_date || "";
  row.innerHTML=`<div class="admin-message-copy"><strong>${escapeHtml(memory.name)}</strong><p>${escapeHtml(memory.message)}</p><small>${escapeHtml(date)}</small></div><button type="button" class="admin-delete" data-id="${escapeHtml(memory.id)}">Delete</button>`;
  row.querySelector(".admin-delete").addEventListener("click",()=>deleteMemoryAsAdmin(memory.id,row));
  adminMessageList.appendChild(row);
}
async function deleteMemoryAsAdmin(id,row){
  const ok=window.confirm("Delete this memory from the shared wall? This cannot be undone.");
  if(!ok) return;
  const button=row.querySelector(".admin-delete");
  button.disabled=true;
  button.textContent="Deleting…";
  const {error}=await supabaseClient.from("memories").delete().eq("id",id);
  if(error){
    button.disabled=false;
    button.textContent="Delete";
    setAdminStatus("Delete failed. Make sure the Supabase admin DELETE policy is installed.",true);
    return;
  }
  row.remove();
  const publicNote=document.querySelector(`.memory-note[data-memory-id="${CSS.escape(String(id))}"]`);
  if(publicNote) publicNote.remove();
  setAdminStatus("Memory deleted.");
  if(!adminMessageList.children.length) adminMessageList.innerHTML='<div class="admin-empty">No saved memories yet.</div>';
}

if(adminPanel){
  adminClose.addEventListener("click",closeAdminPanel);
  adminPanel.addEventListener("click",e=>{if(e.target===adminPanel) closeAdminPanel();});
  adminLoginForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const submit=adminLoginForm.querySelector("button[type=submit]");
    submit.disabled=true;
    setAdminStatus("Signing in…");
    const {data,error}=await supabaseClient.auth.signInWithPassword({email:adminEmail.value.trim(),password:adminPassword.value});
    submit.disabled=false;
    if(error || !isAdminSession(data?.session)){
      if(!error && data?.session) await supabaseClient.auth.signOut();
      setAdminStatus(error ? "Sign in failed. Check the admin email and password." : "This account is not an admin.",true);
      return;
    }
    await renderAdminManage(data.session);
  });
  adminSignOut.addEventListener("click",async()=>{
    await supabaseClient.auth.signOut();
    renderAdminLogin();
  });
  supabaseClient.auth.onAuthStateChange((_event,session)=>{
    if(isAdminSession(session)) renderAdminManage(session);
    else if(location.hash === "#admin") renderAdminLogin();
  });
  if(location.hash === "#admin"){
    openAdminPanel();
    supabaseClient.auth.getSession().then(({data})=>{
      if(isAdminSession(data.session)) renderAdminManage(data.session);
      else renderAdminLogin();
    });
  }
  window.addEventListener("hashchange",()=>{
    if(location.hash === "#admin"){
      openAdminPanel();
      supabaseClient.auth.getSession().then(({data})=>{
        if(isAdminSession(data.session)) renderAdminManage(data.session);
        else renderAdminLogin();
      });
    } else closeAdminPanel();
  });
}


// Supabase password-recovery flow: recovery emails return to the live site,
// so PASSWORD_RECOVERY opens a small in-site form instead of leaving the user stuck on the homepage.
const passwordResetPanel=document.getElementById("passwordResetPanel");
const passwordResetForm=document.getElementById("passwordResetForm");
const passwordResetClose=document.getElementById("passwordResetClose");
const newPassword=document.getElementById("newPassword");
const confirmPassword=document.getElementById("confirmPassword");
const passwordResetSubmit=document.getElementById("passwordResetSubmit");
const passwordResetStatus=document.getElementById("passwordResetStatus");
function openPasswordReset(){
  if(!passwordResetPanel) return;
  passwordResetPanel.style.display="flex";
  passwordResetPanel.setAttribute("aria-hidden","false");
  if(newPassword) newPassword.focus();
}
function closePasswordReset(){
  if(!passwordResetPanel) return;
  passwordResetPanel.style.display="none";
  passwordResetPanel.setAttribute("aria-hidden","true");
}
if(passwordResetClose) passwordResetClose.addEventListener("click",closePasswordReset);
if(passwordResetPanel) passwordResetPanel.addEventListener("click",e=>{if(e.target===passwordResetPanel) closePasswordReset();});
if(passwordResetForm) passwordResetForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const a=newPassword.value;
  const b=confirmPassword.value;
  if(a.length<8){passwordResetStatus.textContent="Password must be at least 8 characters."; return;}
  if(a!==b){passwordResetStatus.textContent="Passwords do not match."; return;}
  passwordResetSubmit.disabled=true;
  passwordResetStatus.textContent="Updating password…";
  const {error}=await supabaseClient.auth.updateUser({password:a});
  passwordResetSubmit.disabled=false;
  if(error){passwordResetStatus.textContent="Could not update password. Please request a new recovery email."; return;}
  passwordResetStatus.textContent="Password updated successfully. You can now use it to sign in as admin.";
  passwordResetForm.reset();
});

supabaseClient.auth.onAuthStateChange((event,session)=>{
  if(event==="PASSWORD_RECOVERY" && session) openPasswordReset();
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
