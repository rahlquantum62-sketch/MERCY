// app.js
import { FIREBASE_CONFIG } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

// helpers
const params = new URLSearchParams(location.search);
const user = params.get('name') || 'Guest';
const greetingEl = document.getElementById('greeting');
const subEl = document.getElementById('sub');

const chatWindow = document.getElementById('chatWindow');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const openAdmin = document.getElementById('openAdmin');

// personal greeting
if(user.toLowerCase() === 'mercy'){
  greetingEl.innerHTML = 'I love you Mercy 💖';
} else if(user.toLowerCase() === 'rahl'){
  greetingEl.innerHTML = 'Rahl loves you 💖';
} else {
  greetingEl.innerText = `Welcome ${user}`;
}

// chat functions
const messagesCol = collection(db, 'messages');
function formatTime(ms){
  const d = new Date(ms);
  return d.toLocaleString();
}
function renderMessage(docData, mine){
  const div = document.createElement('div');
  div.className = 'msg ' + (docData.user && docData.user.toLowerCase().includes('rahl') ? 'rahl' : 'mercy');
  div.innerHTML = `<div>${docData.text}</div><small>${docData.user || 'Anon'} • ${formatTime(docData.time)}</small>`;
  return div;
}

const q = query(messagesCol, orderBy('time'));
let firstLoad = true;
let lastId = null;
onSnapshot(q, snap => {
  chatWindow.innerHTML = '';
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const node = renderMessage(data, data.user === user);
    chatWindow.appendChild(node);
    lastId = docSnap.id;
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;

  // in-page notification using Notification API
  if(!firstLoad){
    // show notification for the last message if it's from other user
    const last = snap.docs[snap.docs.length - 1];
    if(last){
      const d = last.data();
      if(d.user !== user){
        notify(`${d.user}`, d.text);
      }
    }
  }
  firstLoad = false;
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e)=>{ if(e.key === 'Enter') sendMessage(); });

async function sendMessage(){
  const text = messageInput.value.trim();
  if(!text) return;
  await addDoc(messagesCol, { user, text, time: Date.now() });
  messageInput.value = '';
}

// Notifications (in-page)
function notify(title, body){
  if(!("Notification" in window)) return;
  if(Notification.permission === "granted"){
    new Notification(title, { body, icon: null });
  } else if(Notification.permission !== "denied"){
    Notification.requestPermission().then(p => { if(p === "granted") new Notification(title, { body }); });
  }
}

// Slideshow: read 'slideshowImages' collection and render slides
const slideshowArea = document.getElementById('slideshowArea');
const slidesCol = collection(db, 'slideshowImages');
let slides = [];
let slideIndex = 0;
function renderSlides(){
  slideshowArea.innerHTML = '';
  slides.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'slide' + (i===slideIndex ? ' show' : '');
    const img = document.createElement('img');
    img.src = s.url;
    img.alt = s.caption || '';
    div.appendChild(img);
    slideshowArea.appendChild(div);
  });
}
onSnapshot(query(slidesCol, orderBy('created')), snap => {
  slides = snap.docs.map(d => ({ id:d.id, ...(d.data()) }));
  if(slides.length === 0){
    // placeholder slide
    slides = [{url:'https://images.unsplash.com/photo-1511988617509-a57c8a288659?q=80&w=800&auto=format&fit=crop', caption:'Our love'}];
  }
  renderSlides();
});

// automatic rotate
setInterval(()=>{
  if(slides.length === 0) return;
  slideIndex = (slideIndex + 1) % slides.length;
  const nodes = document.querySelectorAll('.slide');
  nodes.forEach((n,i)=> n.classList.toggle('show', i===slideIndex));
}, 4000);

// admin open
openAdmin.addEventListener('click', ()=> location.href = 'admin.html');

// theme & settings (read from settings/general)
async function applySettings(){
  const sRef = doc(db, 'settings', 'general');
  const snap = await getDoc(sRef);
  if(snap.exists()){
    const cfg = snap.data();
    if(cfg.theme === 'night') document.body.style.background = 'linear-gradient(135deg,#020428,#1b1b2f)';
    if(cfg.theme === 'hearts') document.body.style.background = 'radial-gradient(circle at 20% 20%, #ffd1e6,#ff9ab7)';
    if(cfg.playlist) {
      // embed small player area or add link to notes - for simplicity show below sub
      subEl.innerText = `Playlist: ${cfg.playlist}`;
    }
  }
}
applySettings();
