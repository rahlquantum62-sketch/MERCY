// --- Storage & defaults ---
const STORAGE_KEY = 'our-love-data-v1'
const DRAWINGS_KEY = 'our-love-drawings-v1'
const defaults = { since: 'June 1, 2021', timeline: [], gallery: [], notes: [] }

function load(){ try{ const raw = localStorage.getItem(STORAGE_KEY); return raw?JSON.parse(raw):structuredClone(defaults)}catch(e){console.error(e);return structuredClone(defaults)} }
function save(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }

// --- Simple note UI (kept minimal) ---
const data = load()
function renderNotes(){ const nl = document.getElementById('notes-list'); nl.innerHTML=''; if(!data.notes||data.notes.length===0){ nl.innerHTML='<div class="muted">No notes yet — write the first one!</div>'; return } data.notes.slice().reverse().forEach(n=>{ const card = document.createElement('div'); card.className='note'; card.innerHTML = `<strong>${escapeHtml(n.from)}</strong> <small class="muted">${new Date(n.created).toLocaleString()}</small><p style="margin:6px 0 0">${escapeHtml(n.message)}</p>`; nl.appendChild(card) }) }
document.getElementById('note-form').addEventListener('submit', e=>{ e.preventDefault(); const from = document.getElementById('from').value.trim(); const message = document.getElementById('message').value.trim(); if(!from||!message) return; data.notes.push({from,message,created:Date.now()}); save(data); document.getElementById('from').value=''; document.getElementById('message').value=''; renderNotes() })
document.getElementById('export-notes').addEventListener('click', ()=>{ const payload = JSON.stringify(data.notes, null, 2); const blob = new Blob([payload], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='our-love-notes.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); })
function escapeHtml(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
renderNotes()

// --- Canvas Implementation ---
const canvas = document.getElementById('board')
const ctx = canvas.getContext('2d')
let drawing = false
let strokeColor = document.getElementById('color').value
let strokeSize = Number(document.getElementById('size').value)

// Resize canvas to match CSS pixel size and devicePixelRatio
function resizeCanvas(){ const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; canvas.width = Math.floor(rect.width * dpr); canvas.height = Math.floor(rect.height * dpr); canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px'; ctx.scale(dpr, dpr); redrawFromHistory(); }
window.addEventListener('resize', ()=>{ clearTimeout(window._rc); window._rc = setTimeout(()=>{ ctx.setTransform(1,0,0,1,0,0); resizeCanvas(); }, 120) })

// Drawing history for undo/redo
const history = []
let redoStack = []

function pushHistory(snapshot){ history.push(snapshot); if(history.length>50) history.shift(); redoStack = []; saveDrawingsToStorage(); broadcastFrame({type:'history',payload:getHistorySnapshot()}) }
function getHistorySnapshot(){ return history.map(h=>h) }

function redrawFromHistory(){ ctx.clearRect(0,0,canvas.width,canvas.height); history.forEach(item=>{ drawPath(item, {replay:true}) }) }

// Path format: {color,size,points:[{x,y},...]} where x,y are CSS pixels
function beginPath(x,y){ drawing=true; currentPath = {color:strokeColor,size:strokeSize,points:[{x,y}]} }
function extendPath(x,y){ if(!drawing||!currentPath) return; currentPath.points.push({x,y}); drawPath(currentPath) }
function endPath(){ if(!drawing) return; drawing=false; pushHistory(structuredClone(currentPath)); currentPath=null }

function drawPath(path, opts={}){
  const s = path.size; const c = path.color; const pts = path.points
  if(!pts||pts.length===0) return
  ctx.lineJoin='round'; ctx.lineCap='round'; ctx.lineWidth = s; ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke();
  if(!opts.replay) broadcastFrame({type:'stroke',payload:path})
}

// Mouse / touch handlers
let currentPath = null
function getPosFromEvent(e){ const rect = canvas.getBoundingClientRect(); const touch = e.touches ? e.touches[0] : null; const clientX = touch?touch.clientX:e.clientX; const clientY = touch?touch.clientY:e.clientY; return {x: clientX - rect.left, y: clientY - rect.top} }

canvas.addEventListener('pointerdown', (e)=>{ canvas.setPointerCapture(e.pointerId); const p = getPosFromEvent(e); beginPath(p.x,p.y) })
canvas.addEventListener('pointermove', (e)=>{ if(!drawing) return; const p = getPosFromEvent(e); extendPath(p.x,p.y) })
window.addEventListener('pointerup', (e)=>{ if(drawing) endPath() })

document.getElementById('color').addEventListener('input',(e)=>{ strokeColor = e.target.value })
document.getElementById('size').addEventListener('input',(e)=>{ strokeSize = Number(e.target.value) })

document.getElementById('clear').addEventListener('click', ()=>{ if(confirm('Clear the canvas?')){ history.length=0; redoStack.length=0; ctx.clearRect(0,0,canvas.width,canvas.height); saveDrawingsToStorage(); broadcastFrame({type:'clear'}) } })
document.getElementById('undo').addEventListener('click', ()=>{ if(history.length===0) return; const item = history.pop(); redoStack.push(item); ctx.clearRect(0,0,canvas.width,canvas.height); history.forEach(it=>drawPath(it,{replay:true})); saveDrawingsToStorage(); broadcastFrame({type:'undo'}) })

// Save to gallery
function saveCanvasImage(){ const dataUrl = canvas.toDataURL('image/png'); const drawings = loadDrawingsFromStorage(); drawings.unshift({dataUrl,created:Date.now()}); localStorage.setItem(DRAWINGS_KEY, JSON.stringify(drawings)); renderGallery(); }
document.getElementById('save').addEventListener('click', ()=>{ saveCanvasImage(); alert('Saved to gallery (browser storage).') })

// Download PNG
document.getElementById('download').addEventListener('click', ()=>{ const dataUrl = canvas.toDataURL('image/png'); const a = document.createElement('a'); a.href=dataUrl; a.download = 'drawing.png'; document.body.appendChild(a); a.click(); a.remove(); })

// Copy share link (data URL encoded in hash)
document.getElementById('copyLink').addEventListener('click', async ()=>{
  const dataUrl = canvas.toDataURL('image/png'); const encoded = encodeURIComponent(dataUrl); const url = location.origin + location.pathname + '#drawing=' + encoded;
  try{ await navigator.clipboard.writeText(url); alert('Share link copied to clipboard. Paste it to open this drawing.') }catch(e){ prompt('Copy this link:', url) }
})

// Gallery render
function loadDrawingsFromStorage(){ try{ const raw = localStorage.getItem(DRAWINGS_KEY); return raw?JSON.parse(raw):[] }catch(e){return[]} }
function renderGallery(){ const container = document.getElementById('canvas-gallery'); container.innerHTML=''; const items = loadDrawingsFromStorage(); if(items.length===0){ container.innerHTML = '<div class="muted">No saved drawings yet.</div>'; return } items.forEach(it=>{ const d = document.createElement('div'); d.className='thumb'; d.innerHTML = `<img src="${it.dataUrl}" alt="drawing" loading="lazy">`; d.addEventListener('click', ()=>{ const w = window.open(); w.document.write(`<img src="${it.dataUrl}" style="max-width:100%;height:auto;display:block;margin:20px auto">`) }); container.appendChild(d) }) }
renderGallery()

// Share / Sync: BroadcastChannel for same-origin live sync between tabs
let bc = null
const syncToggle = document.getElementById('syncToggle')
function ensureBroadcast(){ if(!('BroadcastChannel' in window)) return null; if(!bc) bc = new BroadcastChannel('our-love-canvas'); bc.onmessage = (ev)=>{ handleBroadcast(ev.data) } return bc }
function startSync(){ ensureBroadcast(); broadcastFrame({type:'request-sync'}) }
function stopSync(){ if(bc){ bc.close(); bc = null } }

syncToggle.addEventListener('change', (e)=>{ if(e.target.checked){ ensureBroadcast(); alert('Live sync enabled for this browser (tabs on same origin). For cross-device realtime, we can add Firebase Realtime / Firestore later.') }else{ stopSync(); alert('Live sync disabled.') } })

function broadcastFrame(msg){ if(syncToggle.checked && bc) bc.postMessage(msg) }

function handleBroadcast(msg){ if(!msg || !msg.type) return; switch(msg.type){
  case 'stroke':
    history.push(msg.payload); drawPath(msg.payload,{replay:true}); saveDrawingsToStorage(); break;
  case 'clear': history.length=0; ctx.clearRect(0,0,canvas.width,canvas.height); saveDrawingsToStorage(); break;
  case 'undo':
    history.pop(); ctx.clearRect(0,0,canvas.width,canvas.height); history.forEach(it=>drawPath(it,{replay:true})); saveDrawingsToStorage(); break;
  case 'history':
    if(Array.isArray(msg.payload)){ history.length=0; msg.payload.forEach(p=>history.push(p)); ctx.clearRect(0,0,canvas.width,canvas.height); history.forEach(it=>drawPath(it,{replay:true})); saveDrawingsToStorage(); }
    break;
  case 'request-sync':
    if(history.length>0) broadcastFrame({type:'history',payload:getHistorySnapshot()}); break;
} }

// Save & load drawing history to local storage (for persistence)
function saveDrawingsToStorage(){ try{ localStorage.setItem('our-love-history', JSON.stringify(history)); }catch(e){} }
function loadHistoryFromStorage(){ try{ const raw = localStorage.getItem('our-love-history'); if(raw){ const h = JSON.parse(raw); history.length=0; h.forEach(it=>history.push(it)); } }catch(e){} }

// initial setup
loadHistoryFromStorage();
setTimeout(()=>{
  resizeCanvas();
  ensureBroadcast()
}, 60)
