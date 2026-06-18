// Halaman web (dark mode). Disajikan sebagai string statis dari Worker.

const STYLE = `
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0b0d12;--card:#151922;--card2:#1c2230;--line:#262d3d;--txt:#e7ecf3;--mut:#8a93a6;--acc:#e50914;--acc2:#ff3b46;--ok:#2ecc71;--bad:#ff5d5d}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:radial-gradient(1200px 600px at 80% -10%,#1a1030,transparent),var(--bg);color:var(--txt);min-height:100vh}
a{color:var(--acc2);text-decoration:none}
.wrap{max-width:1040px;margin:0 auto;padding:24px}
.brand{font-weight:800;letter-spacing:.5px;font-size:20px}
.brand span{color:var(--acc)}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px;margin-bottom:18px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.h{font-size:15px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.mut{color:var(--mut);font-size:13px}
input,select,textarea{width:100%;background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:11px 13px;font-size:14px;margin-top:6px;outline:none}
input:focus,select:focus{border-color:var(--acc2)}
label{font-size:12px;color:var(--mut);display:block;margin-top:12px}
button{background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;border:0;border-radius:10px;padding:11px 16px;font-weight:700;font-size:14px;cursor:pointer;margin-top:14px}
button.sec{background:var(--card2);border:1px solid var(--line)}
button.sm{padding:7px 11px;margin-top:0;font-size:12px}
.row{display:flex;gap:12px;flex-wrap:wrap}
.row>*{flex:1;min-width:160px}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.tab{padding:9px 15px;border-radius:999px;background:var(--card);border:1px solid var(--line);cursor:pointer;font-size:13px;font-weight:600}
.tab.on{background:var(--acc);border-color:var(--acc)}
.hide{display:none}
.item{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--line);font-size:14px}
.item:last-child{border-bottom:0}
.pill{font-size:11px;padding:3px 9px;border-radius:999px;background:var(--card2);border:1px solid var(--line)}
.pill.ok{color:var(--ok);border-color:#23492f}
.pill.bad{color:var(--bad);border-color:#4a2230}
.res{margin-top:14px;padding:14px;border-radius:12px;background:var(--card2);border:1px solid var(--line);word-break:break-all}
.code{font-size:26px;font-weight:800;letter-spacing:4px;color:var(--ok)}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}
.chip{display:flex;gap:8px}
.toggle{display:flex;align-items:center;gap:10px;margin-top:14px}
.sw{width:46px;height:26px;border-radius:999px;background:var(--card2);border:1px solid var(--line);position:relative;cursor:pointer;flex:none}
.sw.on{background:var(--acc)}
.sw i{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s}
.sw.on i{left:22px}
.blist{display:grid;gap:10px;margin-top:8px}
.bcard{background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:13px 15px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.bcard .bn{font-weight:700;font-size:14.5px}
.bcard .bm{color:var(--mut);font-size:12px;margin-top:3px}
.bcard .bact{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.bklist{display:flex;flex-direction:column;gap:6px;margin-top:12px}
.bkrow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 13px;background:var(--card2);border:1px solid var(--line);border-radius:11px}
.bkrow .bki{min-width:0}
.bkrow .bkl{font-weight:600;font-size:13px}
.bkrow .bkm{color:var(--mut);font-size:11px;margin-top:2px}
.btnfull{width:100%;margin-top:6px}
.dbinfo{display:flex;align-items:center;gap:12px;margin-top:6px}
.dbicon{width:46px;height:46px;border-radius:12px;background:var(--card2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:22px;flex:none}
.dbname{font-weight:700}
.dbstats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}
.dbstat{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;display:flex;flex-direction:column;gap:3px}
.dbstat b{font-size:13px}
.rowbtw{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0 4px;font-weight:600}
.scopebox{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.chk{display:flex;align-items:center;gap:8px;background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:9px 11px;font-size:13px;cursor:pointer}
.chk input{width:16px;height:16px;accent-color:var(--acc);flex:none;margin:0}
.statusrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:16px 0 4px}
.stbadge{font-weight:600;font-size:13px}
.dropzone{border:2px dashed var(--line);border-radius:14px;padding:26px 14px;text-align:center;cursor:pointer;transition:.15s;display:flex;flex-direction:column;gap:6px;align-items:center}
.dropzone:hover{border-color:var(--acc)}
.dropzone.drag{border-color:var(--acc);background:var(--card2)}
.dzicon{font-size:30px}
@media(max-width:560px){.dbstats{grid-template-columns:1fr}.scopebox{grid-template-columns:1fr}}
.bkrow .kindtag{font-size:9.5px;padding:1px 7px;border-radius:999px;background:var(--line);color:var(--mut);text-transform:uppercase;letter-spacing:.4px;font-weight:700}
.iconbtn{width:34px;height:34px;border-radius:9px;background:var(--card);border:1px solid var(--line);color:var(--txt);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;margin:0;padding:0}
.iconbtn:hover{border-color:var(--acc2)}
.iconbtn.danger:hover{border-color:var(--bad);color:var(--bad)}
.daysbox{display:flex;align-items:center;gap:6px}
.daysbox input{width:58px;margin:0;padding:7px 8px;text-align:center}
.daysbox button{margin-top:0}
.close-x{position:absolute;top:12px;right:14px;width:30px;height:30px;border-radius:8px;background:var(--card2);border:1px solid var(--line);color:var(--txt);cursor:pointer;font-size:14px;line-height:1;margin:0;padding:0}
.term{background:#05070a;border:1px solid #11331f;border-radius:12px;padding:14px;font-family:'Consolas','Courier New',monospace;font-size:12.5px;color:#9ff7c4;max-height:340px;overflow:auto;line-height:1.65;margin-top:6px}
.term .ln{white-space:pre-wrap;word-break:break-word}
.term .t{color:#5f6b7a}
.term .a{color:#ffd479}
.modal{position:fixed;inset:0;background:rgba(2,4,8,.66);display:flex;align-items:flex-start;justify-content:center;padding:5vh 16px;z-index:50;overflow:auto}
.modal.hide{display:none}
.modal-box{position:relative;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px;max-width:560px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.cancelbtn{background:var(--card2);border:1px solid var(--line);color:var(--txt);margin-top:10px}
.created{margin-top:12px}
.barhead{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:14px}
.barhead .h{margin-bottom:0}
.addbtn{margin-top:0;white-space:nowrap}
.bgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;margin-top:14px}
.bcard2{background:var(--card2);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 6px 18px rgba(0,0,0,.18)}
.bcard2.off{opacity:.6}
.bc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:15px 16px 12px}
.bc-name{font-weight:800;font-size:16px;line-height:1.2}
.bc-exp{color:var(--mut);font-size:12px;margin-top:4px}
.badge{font-size:11px;font-weight:700;padding:5px 10px;border-radius:999px;white-space:nowrap}
.badge.ok{background:rgba(46,204,113,.14);color:#43d17f;border:1px solid rgba(46,204,113,.3)}
.badge.soon{background:rgba(245,196,0,.14);color:#f5c400;border:1px solid rgba(245,196,0,.3)}
.badge.off{background:rgba(255,93,93,.14);color:#ff6b6b;border:1px solid rgba(255,93,93,.3)}
.badge.adm{background:rgba(245,196,0,.14);color:#f5c400;border:1px solid rgba(245,196,0,.3)}
.bc-sep{height:1px;background:var(--line);margin:0 16px}
.bc-rows{padding:13px 16px;display:flex;flex-direction:column;gap:9px}
.bc-row{display:flex;align-items:center;gap:9px;font-size:13px}
.bc-row .ic{color:var(--mut);width:17px;text-align:center;flex:none}
.bc-row .lb{color:var(--mut);min-width:62px;flex:none}
.bc-row .vl{color:var(--txt);word-break:break-all;font-weight:600}
.bc-status{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;font-size:13px;font-weight:600}
.bc-acts{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:13px 16px 16px}
.cbtn{margin-top:0;padding:10px 8px;font-size:13px;font-weight:700;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:6px;background:var(--card);border:1px solid var(--line);color:var(--txt);cursor:pointer}
.cbtn:hover{border-color:var(--acc2)}
.cbtn.danger{color:#ff6b6b}
.cbtn.danger:hover{border-color:var(--bad)}
.cbtn.imap{color:#4aa3ff}.cbtn.imap:hover{border-color:#4aa3ff}
.cbtn.durasi{color:#f5c400}.cbtn.durasi:hover{border-color:#f5c400}
.cbtn.kelola{color:#a974ff}.cbtn.kelola:hover{border-color:#a974ff}
.modactions{display:flex;gap:10px;margin-top:18px}
.modactions button{flex:1;margin-top:0}
.acts{display:flex;flex-direction:column;gap:2px;margin-top:4px}
.actrow{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--line);font-size:13px}
.actrow:last-child{border-bottom:0}
.actrow .ae{flex:none;font-size:15px}
.actrow .at{color:var(--mut);font-size:11px;margin-left:auto;white-space:nowrap}
.actrow .atg{color:var(--mut);font-weight:400}
.linkbtn{background:none;border:0;color:var(--acc2);font-weight:700;cursor:pointer;padding:0;margin-top:12px;font-size:13px}
@media(max-width:560px){.bgrid{grid-template-columns:1fr}}
.rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-top:6px}
.rstat{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:13px 14px}
.rstat .rn{font-size:24px;font-weight:800;line-height:1.1}
.rstat .rl{color:var(--mut);font-size:12px;margin-top:4px}
`

export const LOGIN_HTML = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>__BRAND__ - Masuk</title>
<style>${STYLE}.login{max-width:380px;margin:8vh auto}</style></head><body>
<div class="login">
<div class="card">
<div class="brand" style="text-align:center;font-size:26px;margin-bottom:6px">__BRAND__</div>
<p class="mut" style="text-align:center;margin-bottom:8px">Masuk ke dashboard</p>
<label>Email</label><input id="email" type="email" placeholder="email@domain.com">
<label>Password</label><input id="pw" type="password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022">
<button id="go" style="width:100%">Masuk</button>
<p id="msg" class="mut" style="text-align:center;margin-top:12px;color:var(--bad)"></p>
</div></div>
<script>
const go=document.getElementById('go');
go.onclick=async()=>{
 go.disabled=true;document.getElementById('msg').textContent='';
 const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.value.trim(),password:pw.value})});
 const d=await r.json();
 if(d.ok){location.href='/';}else{document.getElementById('msg').textContent=d.error==='expired'?'Langganan kadaluarsa':'Email atau password salah';go.disabled=false;}
};
pw.addEventListener('keydown',e=>{if(e.key==='Enter')go.click()});
</script></body></html>`

export const APP_HTML = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>__BRAND__</title>
<style>${STYLE}</style></head><body>
<div class="wrap">
<div class="top">
<div class="brand">__BRAND__</div>
<div class="chip"><span id="who" class="pill"></span><button class="sec sm" id="logout">Keluar</button></div>
</div>
<div class="tabs" id="tabs"></div>

<div id="t-search" class="tabpane">
<div class="card"><div class="h">🔍 Cari Email Netflix</div>
<label>Alamat email</label><input id="s_email" placeholder="user@domainmu.com">
<label>Kategori</label><select id="s_cat">
<option value="signin">🔑 Kode Masuk (4 digit)</option>
<option value="household">🏠 Household</option>
<option value="tvlink">📺 Link TV</option>
<option value="resetpw">🔓 Reset Password</option>
<option value="resetemail">📧 Reset Email (6 digit)</option>
</select>
<button id="s_go">Cari</button>
<p class="mut" style="margin-top:8px">Kalau belum masuk, sistem auto cek tiap 5 detik sampai email diterima.</p>
<div id="s_res"></div></div></div>

<div id="t-imap" class="tabpane hide">
<div class="card"><div class="h">⚙️ Pengaturan IMAP</div>
<div class="row"><div><label>Host</label><input id="i_host" placeholder="imap.domainmu.com"></div>
<div><label>Port</label><input id="i_port" placeholder="993"></div></div>
<div class="row"><div><label>Username</label><input id="i_user" placeholder="login@domainmu.com"></div>
<div><label>Keamanan</label><select id="i_sec"><option value="ssl">SSL/TLS (993)</option><option value="starttls">STARTTLS (143)</option></select></div></div>
<label>Password</label><input id="i_pass" type="password" placeholder="(kosongkan jika tidak diubah)">
<button id="i_save">Simpan IMAP</button><span id="i_msg" class="mut"></span></div>
<div class="card"><div class="h">🌐 Domain</div>
<label>Domain tersimpan — satu per baris. Hapus baris untuk menghapus domain, lalu Simpan.</label><textarea id="d_add" rows="5" placeholder="parciv.net&#10;woi.lol"></textarea>
<button id="d_save">Simpan Domain</button><span id="d_msg" class="mut"></span></div></div>

<div id="t-buyers" class="tabpane hide">
<div class="card"><div class="h">📊 Rekap</div><div class="rgrid" id="recap">memuat...</div></div>
<div class="card">
<div class="barhead"><div class="h">👥 Daftar Member</div><button class="addbtn" id="b_add">+ Tambah Member</button></div>
<input id="bq" placeholder="🔍 Cari nama / ID / email...">
<div id="b_list">memuat...</div></div>
<div class="card"><div class="barhead"><div class="h">🧾 Aktivitas Terbaru</div></div>
<div id="a_list">memuat...</div>
<button class="linkbtn" id="a_all">Lihat Semua →</button></div></div>

<div id="t-backup" class="tabpane hide">
<div class="card bkcard"><div class="h">💾 Database Backup</div>
<div class="dbinfo"><div class="dbicon">🗄️</div><div><div class="dbname" id="db_name">database.db</div><div class="mut" id="db_engine">SQLite Database</div></div></div>
<div class="dbstats"><div class="dbstat"><span class="mut">Ukuran Database</span><b id="db_size">—</b></div><div class="dbstat"><span class="mut">Backup Terakhir</span><b id="db_last">—</b></div></div>
<button id="bk_now" class="btnfull">💾 Backup Sekarang</button> <span id="bk_msg" class="mut"></span></div>
<div class="card"><div class="h">⚙️ Auto Backup</div>
<div class="rowbtw"><span>Auto Backup</span><div class="sw" id="bk_enabled"><i></i></div></div>
<label>Interval Backup (hari)</label><input id="bk_interval" type="number" min="1" value="1">
<label>Jam Backup (WIB, 0-23)</label><input id="bk_hour" value="3">
<label>Chat ID Telegram</label><input id="bk_chat" placeholder="-100...">
<div class="toggle"><div class="sw" id="bk_tg"><i></i></div><div>Kirim backup ke Telegram</div></div>
<div class="toggle"><div class="sw" id="bk_change"><i></i></div><div>Backup saat ada perubahan</div></div>
<div class="toggle"><div class="sw" id="bk_active"><i></i></div><div>Hanya backup member aktif</div></div>
<label style="margin-top:16px">Scope Backup</label>
<div class="scopebox" id="bk_scope"><label class="chk"><input type="checkbox" data-scope="buyers"><span>Member</span></label><label class="chk"><input type="checkbox" data-scope="users"><span>User/Admin</span></label><label class="chk"><input type="checkbox" data-scope="imap"><span>IMAP Settings</span></label><label class="chk"><input type="checkbox" data-scope="domains"><span>Domain Settings</span></label><label class="chk"><input type="checkbox" data-scope="branding"><span>Branding Settings</span></label><label class="chk"><input type="checkbox" data-scope="backupset"><span>Backup Settings</span></label><label class="chk"><input type="checkbox" data-scope="logs"><span>Activity Logs</span></label></div>
<div class="statusrow"><span class="mut">Status Backup Terakhir</span><span id="bk_status" class="stbadge">—</span></div>
<div class="modactions"><button id="bk_save">Simpan</button><button class="sec" id="bk_test">🧪 Test Backup</button></div>
<span id="bk_msg2" class="mut"></span></div>
<div class="card"><div class="h">📂 Restore Database</div>
<div class="dropzone" id="rs_drop"><input type="file" id="rs_file" accept=".db,.json" hidden><div class="dzicon">📂</div><div>Klik atau Drag & Drop file backup</div><div class="mut">Format .db / .json • Maksimal 100 MB</div></div>
<div id="rs_filemsg" class="mut"></div>
<div class="h" style="font-size:13px;margin-top:18px">📦 Backup Tersimpan</div>
<div id="bk_list" style="margin-top:10px">memuat...</div></div></div>

<div id="t-brand" class="tabpane hide">
<div class="card"><div class="h">🎨 Branding Bot</div>
<p class="mut">Ganti nama & teks supaya tidak mirip brand lain. Berlaku di bot & dashboard.</p>
<label>Nama bot</label><input id="br_name" placeholder="MailVault">
<label>Teks sambutan /start (kosongkan = default)</label><textarea id="br_welcome" rows="5" placeholder="Selamat datang..."></textarea>
<label>Domain login web buyer (mis. parciv.net)</label><input id="br_domain" placeholder="parciv.net">
<button id="br_save">Simpan Branding</button> <span id="br_msg" class="mut"></span></div></div>

<div style="text-align:center;color:var(--mut);font-size:11px;margin-top:10px">build 2026-06-11r</div>
</div>
<div id="modal" class="modal hide"><div class="modal-box"><button class="close-x" id="m_close" title="Tutup">✕</button><div id="m_body"></div></div></div>
<script>
let ME={};
const $=id=>document.getElementById(id);
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
async function api(p,m,b){const r=await fetch(p,{method:m||'GET',headers:b?{'Content-Type':'application/json'}:{},body:b?JSON.stringify(b):undefined});return r.json();}
$('logout').onclick=async()=>{await api('/api/logout','POST');location.href='/login';};

function buildTabs(){
 const t=$('tabs');t.innerHTML='';
 const tabs=ME.role==='admin'?[['search','🔍 Cari'],['buyers','👥 Member'],['backup','💾 Backup'],['brand','🎨 Branding']]:[['search','🔍 Cari'],['imap','⚙️ IMAP & Domain']];
 tabs.forEach(([k,lbl],idx)=>{const el=document.createElement('div');el.className='tab'+(idx===0?' on':'');el.dataset.tab=k;el.textContent=lbl;el.onclick=()=>show(k,el);t.appendChild(el);});
}
var TABURL={search:'/search',buyers:'/member',backup:'/backup',brand:'/branding',imap:'/imap'};
var URLTAB={'/':'search','/dashboard':'search','/search':'search','/member':'buyers','/backup':'backup','/branding':'brand','/imap':'imap'};
function tabFromUrl(){var k=URLTAB[location.pathname]||'search';if(!document.querySelector('.tab[data-tab="'+k+'"]'))k='search';return k;}
function show(k,el,skipUrl){
 document.querySelectorAll('.tabpane').forEach(p=>p.classList.add('hide'));
 $('t-'+k).classList.remove('hide');
 document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
 var tabEl=el||document.querySelector('.tab[data-tab="'+k+'"]');
 if(tabEl)tabEl.classList.add('on');
 if(!skipUrl){var u=TABURL[k]||'/';if(location.pathname!==u)history.pushState({tab:k},'',u);}
 if(k==='imap'){loadImap();loadDomains();}
 if(k==='buyers'){loadBuyers();loadAudit();loadStats();api('/api/settings/brand').then(d=>{if(d&&d.domain)WEBDOMAIN=d.domain;});}
 if(k==='backup'){loadBackupSettings();loadBackups();loadDbStats();}
 if(k==='brand')loadBrand();
}
window.addEventListener('popstate',function(){show(tabFromUrl(),null,true);});

// ---------- search (auto-refresh tiap 5 detik) ----------
let S_TIMER=null,S_COUNT=0;
function stopAuto(){if(S_TIMER){clearInterval(S_TIMER);S_TIMER=null;}}
function validEmail(e){var at=e.indexOf('@');return at>0&&e.indexOf(' ')<0&&e.indexOf('.',at)>at+1&&e.length>=5;}
function errMsg(e){return {domain_not_found:'❌ Email/domain belum terdaftar',bad_email:'❌ Email tidak valid',missing:'Lengkapi data',forbidden:'Bukan domain milikmu',no_imap:'IMAP belum diatur',imap_error:'Gagal koneksi IMAP',bad_category:'Kategori tidak valid'}[e]||e;}
async function runWebSearch(){
 const email=$('s_email').value.trim().toLowerCase();
 const cat=$('s_cat').value;const box=$('s_res');
 const d=await api('/api/search','POST',{email:email,category:cat});
 if(d.error){stopAuto();box.innerHTML='<div class="res" style="color:var(--bad)">'+errMsg(d.error)+'</div>';return 'stop';}
 if(d.found){stopAuto();
  if(d.kind==='code')box.innerHTML='<div class="res"><div class="mut">'+esc(d.label)+'</div><div class="code">'+esc(d.value)+'</div>'+(d.date?'<div class="mut" style="margin-top:8px">🕒 '+esc(d.date)+'</div>':'')+'</div>';
  else box.innerHTML='<div class="res"><div class="mut">'+esc(d.label)+'</div><a href="'+esc(d.value)+'" target="_blank">'+esc(d.value)+'</a>'+(d.date?'<div class="mut" style="margin-top:8px">🕒 '+esc(d.date)+'</div>':'')+'</div>';
  return 'stop';
 }
 box.innerHTML='<div class="res">😕 '+esc(d.label)+' belum masuk.<br><span class="mut">⏳ Auto cek tiap 5 detik'+(S_COUNT?(' (cek ke-'+S_COUNT+')'):'')+'...</span><br><button class="cancelbtn" id="s_cancel">✕ Batalkan</button></div>';
 $('s_cancel').onclick=function(){stopAuto();box.innerHTML='<div class="res mut">Dibatalkan. Ubah email/kategori lalu cari lagi.</div>';};
 return 'wait';
}
$('s_go').onclick=async()=>{
 stopAuto();S_COUNT=0;
 const email=$('s_email').value.trim();
 if(!validEmail(email)){$('s_res').innerHTML='<div class="res" style="color:var(--bad)">❌ Email tidak valid. Contoh: nama@domain.com</div>';return;}
 $('s_res').innerHTML='<div class="res mut">⏳ mencari...</div>';
 const st=await runWebSearch();
 if(st==='wait'){S_TIMER=setInterval(async()=>{S_COUNT++;await runWebSearch();},5000);}
};

// ---------- imap (self-service buyer) ----------
$('i_save').onclick=async()=>{
 const body={host:$('i_host').value.trim(),port:$('i_port').value.trim(),username:$('i_user').value.trim(),security:$('i_sec').value};
 if($('i_pass').value)body.password=$('i_pass').value;
 if(!body.password){$('i_msg').textContent=' isi password';return;}
 const d=await api('/api/imap','POST',body);$('i_msg').textContent=d.ok?' ✅ tersimpan':(' gagal'+(d.error?' ('+d.error+')':''));
};
async function loadImap(){const d=await api('/api/imap');if(d.imap){$('i_host').value=d.imap.host;$('i_port').value=d.imap.port;$('i_user').value=d.imap.username;$('i_sec').value=d.imap.security;}else{$('i_host').value='';$('i_port').value='';$('i_user').value='';$('i_sec').value='ssl';}$('i_pass').value='';}
$('d_save').onclick=async()=>{$('d_msg').textContent=' ⏳ menyimpan...';const d=await api('/api/domains/set','POST',{domains:$('d_add').value});if(d.error){$('d_msg').textContent=' '+(d.error==='no_imap'?'IMAP belum diatur':d.error);return;}$('d_msg').textContent=' ✅ tersimpan ('+(d.domains||[]).length+' domain)'+(d.conflict&&d.conflict.length?' • bentrok: '+d.conflict.join(','):'');loadDomains();};
async function loadDomains(){const d=await api('/api/domains');$('d_add').value=(d.domains||[]).join(String.fromCharCode(10));}

// ---------- buyers (admin) ----------
let WEBDOMAIN='parciv.net';
function autofillTid(){const nm=$('b_name').value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'');const em=$('b_email');if(!nm)return;if(em.dataset.auto!=='0'){em.value=nm+'@'+WEBDOMAIN;em.dataset.auto='1';}}
function openCreateModal(){
 openModal('<div class="h">➕ Tambah Member</div>'
  +'<label>Telegram ID</label><input id="b_tid" placeholder="123456789">'
  +'<label>Nama Member</label><input id="b_name" placeholder="Nama member">'
  +'<label>Durasi (hari)</label><input id="b_days" value="30">'
  +'<label>Email Login (opsional — kosong = otomatis dari nama)</label><input id="b_email" placeholder="nama@'+esc(WEBDOMAIN)+'">'
  +'<label>Password (opsional — kosong = otomatis)</label><input id="b_pass" placeholder="(auto)">'
  +'<div id="b_created"></div>'
  +'<div class="modactions"><button class="sec" id="b_cancel">Batal</button><button id="b_create">Simpan</button></div>'
  +'<div id="b_msg" class="mut" style="margin-top:8px"></div>');
 $('b_name').oninput=autofillTid;
 $('b_email').oninput=function(){$('b_email').dataset.auto='0';};
 $('b_cancel').onclick=closeModal;
 $('b_create').onclick=submitCreateBuyer;
}
async function submitCreateBuyer(){
 const tid=$('b_tid').value.trim();
 if(!tid){$('b_msg').textContent=' isi Telegram ID';return;}
 $('b_msg').textContent=' ⏳';
 const d=await api('/api/buyers','POST',{telegram_id:tid,name:$('b_name').value.trim(),days:$('b_days').value.trim(),email:$('b_email').value.trim(),password:$('b_pass').value.trim()});
 if(!d.ok){$('b_msg').textContent=' gagal'+(d.error?' ('+d.error+')':'');return;}
 $('b_msg').textContent=' ✅ tersimpan';
 if(d.login){$('b_created').innerHTML='<div class="res created">🔐 Login web member:<br>Email: <b>'+esc(d.login.email)+'</b><br>Password: <code>'+esc(d.login.password)+'</code><br>'+(d.pushed?'📩 Sudah dikirim otomatis ke member.':'⚠️ Member belum /start bot — belum terkirim, salin & kirim manual.')+'</div>';}
 loadBuyers();loadAudit();
}
async function loadStats(){var d=await api('/api/stats');if(!d||d.error)return;var box=$('recap');if(!box)return;var t=[['👥 Total User',d.users],['💎 Member',d.members],['🟢 Aktif',d.membersActive],['🔴 Suspended',d.membersSuspended],['📨 Total Diproses',d.processed],['✅ Ketemu',d.found],['😕 Tidak Ketemu',d.notfound],['📅 Hari Ini',d.processedToday],['🗓️ 7 Hari',d.processedWeek],['📆 30 Hari',d.processedMonth]];box.innerHTML=t.map(function(x){return '<div class="rstat"><div class="rn">'+esc(String(x[1]==null?0:x[1]))+'</div><div class="rl">'+x[0]+'</div></div>';}).join('');}
let ALLBUYERS=[];
async function loadBuyers(){const d=await api('/api/buyers');ALLBUYERS=d.buyers||[];renderBuyers();}
function fmtExp(s){if(!s)return '-';var d=new Date(s);if(isNaN(d.getTime()))return String(s).slice(0,10);return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});}
function statusBadge(b){if(b.is_admin)return '<span class="badge adm">👑 Admin</span>';if(!b.active)return '<span class="badge off">🔴 Nonaktif</span>';var soon=false;if(b.expired_at){var ms=Date.parse(b.expired_at)-Date.now();if(ms>0&&ms<604800000)soon=true;}if(soon)return '<span class="badge soon">🟡 Expiring Soon</span>';return '<span class="badge ok">🟢 Aktif</span>';}
function findBuyer(id){return ALLBUYERS.filter(function(x){return String(x.id)===String(id);})[0];}
function openDurasiModal(b){
 openModal('<div class="h">🕒 Perpanjang Durasi</div><p class="mut">Member <b>'+esc(b.name||'-')+'</b> • aktif s/d '+esc(fmtExp(b.expired_at))+'</p><label>Tambah Hari</label><input id="du_days" type="number" value="30"><div class="modactions"><button class="sec" id="du_no">Batal</button><button id="du_yes">Simpan</button></div><div id="du_msg" class="mut" style="margin-top:8px"></div>');
 $('du_no').onclick=closeModal;
 $('du_yes').onclick=async function(){const days=parseInt($('du_days').value,10);if(!days||days<=0){$('du_msg').textContent=' Isi jumlah hari yang valid.';return;}$('du_msg').textContent=' ⏳';const r=await api('/api/buyers/reactivate','POST',{telegram_id:b.telegram_id,days:days});if(r.ok){closeModal();loadBuyers();loadAudit();}else{$('du_msg').textContent=' Gagal: '+(r.error||'error');}};
}
function errKelola(e){return {name_required:'Nama wajib diisi',tid_taken:'Telegram ID sudah dipakai member lain',email_taken:'Email sudah dipakai member lain',bad_tid:'Telegram ID harus angka'}[e]||e||'error';}
function openKelolaModal(b){
 openModal('<div class="h">⚙️ Kelola Member</div>'
  +'<label>Nama Member</label><input id="k_name" value="'+esc(b.name||'')+'">'
  +'<label>Telegram ID</label><input id="k_tid" value="'+esc(b.telegram_id||'')+'">'
  +'<label>Email Login</label><input id="k_email" value="'+esc(b.email||'')+'">'
  +'<label>Password (kosong = tidak diubah)</label><input id="k_pass" placeholder="(biarkan kosong)">'
  +'<button class="linkbtn" id="k_reset" type="button">🔑 Reset password acak</button>'
  +'<div class="modactions"><button class="sec" id="k_no">Batal</button><button id="k_yes">Simpan</button></div>'
  +'<div id="k_msg" class="mut" style="margin-top:8px"></div>');
 $('k_no').onclick=closeModal;
 $('k_reset').onclick=async function(){if(!b.email){$('k_msg').textContent=' Member belum punya email login.';return;}if(!confirm('Reset password ke acak & timpa yang lama?'))return;const r=await api('/api/buyers/resetpw','POST',{telegram_id:b.telegram_id});if(r.ok){$('k_msg').innerHTML=' ✅ Password baru: <code>'+esc(r.password)+'</code> — salin & kirim ke member.';loadAudit();}else{$('k_msg').textContent=' '+(r.error==='no_login'?'Member belum punya login web.':(r.error||'error'));}};
 $('k_yes').onclick=async function(){$('k_msg').textContent=' ⏳';const r=await api('/api/buyers/update','POST',{id:b.id,name:$('k_name').value.trim(),telegram_id:$('k_tid').value.trim(),email:$('k_email').value.trim(),password:$('k_pass').value.trim()});if(r.ok){closeModal();loadBuyers();loadAudit();}else{$('k_msg').textContent=' Gagal: '+errKelola(r.error);}};
}
async function openWhitelistModal(b){
 openModal('<div class="h">🔐 Whitelist User</div><p class="mut">Member <b>'+esc(b.name||('#'+b.id))+'</b>. Hanya user di daftar yang boleh akses domain member ini lewat bot. <b>Kosong = terbuka untuk semua.</b></p><div id="wl_list" class="mut">⏳ memuat...</div><label>Tambah (@username atau ID Telegram)</label><div style="display:flex;gap:8px"><input id="wl_in" placeholder="@user atau 12345678"><button id="wl_add" style="width:auto;padding:8px 14px">Tambah</button></div><div class="modactions"><button class="sec" id="wl_close">Tutup</button></div><div id="wl_msg" class="mut" style="margin-top:8px"></div>');
 $('wl_close').onclick=closeModal;
 async function refresh(){const r=await api('/api/buyers/whitelist','POST',{id:b.id});if(!r||!r.ok){$('wl_list').textContent='Gagal memuat.';return;}var L=r.whitelist||[];if(!L.length){$('wl_list').innerHTML='<span class="mut">Kosong — semua orang boleh akses.</span>';return;}$('wl_list').innerHTML=L.map(function(w){var lbl=w.username?('@'+esc(w.username)):('ID '+esc(w.telegram_id));return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)"><span>'+lbl+'</span><button class="linkbtn" data-wid="'+esc(w.id)+'">🗑 hapus</button></div>';}).join('');$('wl_list').querySelectorAll('[data-wid]').forEach(function(el){el.onclick=async function(){await api('/api/buyers/whitelist/remove','POST',{id:b.id,wid:el.getAttribute('data-wid')});refresh();};});}
 $('wl_add').onclick=async function(){var v=$('wl_in').value.trim();if(!v)return;$('wl_msg').textContent=' ⏳';var r=await api('/api/buyers/whitelist/add','POST',{id:b.id,value:v});if(r&&r.ok){$('wl_in').value='';$('wl_msg').textContent=(r.conflict&&r.conflict.length)?(' Sebagian dilewati: '+r.conflict.join(', ')):' ✅ ditambahkan';refresh();}else{$('wl_msg').textContent=' Gagal: '+((r&&r.error)||'error');}};
 refresh();
}
function renderBuyers(){
 const q=(($('bq')&&$('bq').value)||'').toLowerCase().trim();
 const box=$('b_list');
 const list=ALLBUYERS.filter(b=>!q||String(b.name||'').toLowerCase().indexOf(q)>=0||String(b.telegram_id||'').indexOf(q)>=0||String(b.email||'').toLowerCase().indexOf(q)>=0);
 if(!list.length){box.innerHTML='<span class="mut">tidak ada member.</span>';return;}
 box.innerHTML='<div class="bgrid">'+list.map(function(b){
  var on=b.active;var adm=b.is_admin;
  var h='<div class="bcard2'+(on?'':' off')+'">';
  h+='<div class="bc-head"><div><div class="bc-name">'+esc(b.name||'-')+'</div><div class="bc-exp">Expired: '+esc(fmtExp(b.expired_at))+'</div></div>'+statusBadge(b)+'</div>';
  h+='<div class="bc-sep"></div><div class="bc-rows">';
  h+='<div class="bc-row"><span class="ic">🔗</span><span class="lb">Username</span><span class="vl">'+(b.username?'@'+esc(b.username):'-')+'</span></div>';
  h+='<div class="bc-row"><span class="ic">📨</span><span class="lb">Telegram</span><span class="vl">'+esc(b.telegram_id||'-')+'</span></div>';
  h+='<div class="bc-row"><span class="ic">✉️</span><span class="lb">Email</span><span class="vl">'+esc(b.email||'tanpa login')+'</span></div>';
  h+='<div class="bc-row"><span class="ic">🔒</span><span class="lb">Password</span><span class="vl"><span class="pwval" data-pw="'+esc(b.password||'')+'" data-shown="0">'+(b.password?'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022':'-')+'</span>'+(b.password?' <span class="pweye" style="cursor:pointer;margin-left:6px" title="Lihat / sembunyikan">👁</span>':'')+'</span></div>';
  h+='<div class="bc-row"><span class="ic">🌐</span><span class="lb">Domain</span><span class="vl">'+esc((b.domains&&b.domains.length)?b.domains.join(', '):'-')+'</span></div>';
  h+='<div class="bc-row"><span class="ic">✅</span><span class="lb">OTP Sukses</span><span class="vl"><b>'+esc(String(b.otpSuccess==null?0:b.otpSuccess))+'</b></span></div>';
  h+='</div>';
  if(!adm){h+='<div class="bc-sep"></div><div class="bc-status"><span>Status Member</span><button class="cbtn" style="width:auto;padding:7px 14px" data-act="status" data-on="'+(on?'1':'0')+'" data-tid="'+esc(b.telegram_id)+'" data-id="'+esc(b.id)+'">'+(on?'🟢 Aktif':'🔴 Nonaktif')+' • Ubah</button></div>';}
  h+='<div class="bc-sep"></div>';
  if(adm){h+='<div class="bc-acts"><button class="cbtn imap" data-act="imap" data-tid="'+esc(b.telegram_id)+'" data-name="'+esc(b.name||'')+'" data-id="'+esc(b.id)+'">📡 IMAP</button><button class="cbtn kelola" data-act="kelola" data-tid="'+esc(b.telegram_id)+'" data-id="'+esc(b.id)+'">⚙️ Kelola</button></div>';}
  else{h+='<div class="bc-acts"><button class="cbtn imap" data-act="imap" data-tid="'+esc(b.telegram_id)+'" data-name="'+esc(b.name||'')+'" data-id="'+esc(b.id)+'">📡 IMAP</button><button class="cbtn durasi" data-act="durasi" data-tid="'+esc(b.telegram_id)+'" data-id="'+esc(b.id)+'">🕒 Durasi</button><button class="cbtn kelola" data-act="kelola" data-tid="'+esc(b.telegram_id)+'" data-id="'+esc(b.id)+'">⚙️ Kelola</button><button class="cbtn" style="background:#2bb59a;color:#fff" data-act="whitelist" data-tid="'+esc(b.telegram_id)+'" data-id="'+esc(b.id)+'">🔐 Whitelist</button><button class="cbtn danger" data-act="del" data-tid="'+esc(b.telegram_id)+'" data-id="'+esc(b.id)+'">🗑 Hapus</button></div>';}
  h+='</div>';
  return h;
 }).join('')+'</div>';
 box.querySelectorAll('[data-act]').forEach(el=>{el.onclick=()=>buyerAction(el.getAttribute('data-act'),el.getAttribute('data-tid'),el);});
 box.querySelectorAll('.pweye').forEach(function(el){el.onclick=function(){var v=el.parentNode.querySelector('.pwval');if(!v)return;var p=v.getAttribute('data-pw')||'';if(!p)return;if(v.getAttribute('data-shown')==='1'){v.textContent='\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';v.setAttribute('data-shown','0');}else{v.textContent=p;v.setAttribute('data-shown','1');}};});
}
async function buyerAction(act,t,el){
 if(act==='toggle'){
  const on=el.getAttribute('data-on')==='1';
  if(on){if(!confirm('Suspend (nonaktifkan) member '+t+'?'))return;await api('/api/buyers/revoke','POST',{telegram_id:t});}
  else{const dn=$('bd_'+t);const days=parseInt(dn&&dn.value,10)||30;const r=await api('/api/buyers/reactivate','POST',{telegram_id:t,days:days});if(!r.ok){alert('Gagal: '+(r.error||'error'));return;}}
  loadBuyers();loadAudit();return;
 }
 if(act==='extend'){const dn=$('bd_'+t);const days=parseInt(dn&&dn.value,10);if(!days||days<=0){alert('Isi jumlah hari yang valid.');return;}const r=await api('/api/buyers/reactivate','POST',{telegram_id:t,days:days});if(r.ok){loadBuyers();loadAudit();showBDetail('⏱️ Durasi diperbarui','Member <code>'+esc(t)+'</code> aktif sampai <b>'+esc(String(r.expired_at||'').slice(0,10))+'</b>.');}else{alert('Gagal: '+(r.error||'error'));}return;}
 if(act==='imap'){openImapModal(t,el.getAttribute('data-name')||('Member '+t));return;}
 if(act==='status'){const b=findBuyer(el.getAttribute('data-id'))||{telegram_id:t};openStatusModal(b,el.getAttribute('data-on')==='1');return;}
 if(act==='durasi'){const b=findBuyer(el.getAttribute('data-id'));openDurasiModal(b||{telegram_id:t});return;}
 if(act==='kelola'){const b=findBuyer(el.getAttribute('data-id'));if(b)openKelolaModal(b);return;}
 if(act==='whitelist'){var wb=findBuyer(el.getAttribute('data-id'))||{id:el.getAttribute('data-id'),telegram_id:t,name:t};openWhitelistModal(wb);return;}
 if(act==='detail'){const dd=await api('/api/buyers/detail','POST',{telegram_id:t});if(!dd.ok){showBDetail('Detail','<span class="mut">Gagal memuat.</span>');return;}const i=dd.imap;showBDetail('ℹ️ Detail Member','Nama: <b>'+esc(dd.buyer.name)+'</b><br>ID: <code>'+esc(dd.buyer.telegram_id)+'</code><br>Login web: '+esc(dd.buyer.email||'-')+'<br>Status: '+esc(dd.buyer.status)+(dd.buyer.active?' ✅ aktif':' ❌ nonaktif')+'<br>Berlaku s/d: '+esc(String(dd.buyer.expired_at||'-').slice(0,16).replace('T',' '))+'<br>IMAP: '+(i?(esc(i.host)+':'+esc(i.port)+' ('+esc(i.security)+'), user '+esc(i.username)):'belum diatur')+'<br>✅ OTP Sukses: <b>'+esc(String(dd.buyer.otpSuccess==null?0:dd.buyer.otpSuccess))+'</b><br>Domain ('+dd.domains.length+'): '+(dd.domains.map(esc).join(', ')||'-'));return;}
 if(act==='resetpw'){openModal('<div class="h">🔑 Reset Password</div><p class="mut">Reset password login web untuk member <code>'+esc(t)+'</code>?</p><div style="display:flex;gap:8px;margin-top:14px"><button id="rp_no" class="sec">Batal</button><button id="rp_yes">Ya, reset</button></div><div id="rp_msg" class="mut" style="margin-top:8px"></div>');$('rp_no').onclick=closeModal;$('rp_yes').onclick=async()=>{$('rp_msg').textContent=' ⏳ memproses...';const r=await api('/api/buyers/resetpw','POST',{telegram_id:t});if(r.ok){openModal('<div class="h">🔑 Password baru</div>Login: <b>'+esc(r.email)+'</b><br>Password: <code>'+esc(r.password)+'</code><br><span class="mut">Salin & kirim ke member. Hanya tampil sekali.</span><div style="display:flex;gap:8px;margin-top:14px"><button id="rp_ok">Tutup</button></div>');$('rp_ok').onclick=closeModal;loadAudit();}else{$('rp_msg').textContent=' '+(r.error==='no_login'?'Member belum punya login web. Buat lewat form di atas.':(r.error||'error'));}};return;}
 if(act==='del'){var bb=findBuyer(el.getAttribute('data-id'))||{telegram_id:t,name:t};openModal('<div class="h">🗑️ Hapus Member</div><p class="mut">Yakin ingin menghapus member <b>'+esc(bb.name||'-')+'</b>? Tindakan permanen — IMAP & domain miliknya ikut terhapus.</p><div class="modactions"><button class="sec" id="del_no">Batal</button><button id="del_yes" style="background:#e5484d;color:#fff">Hapus</button></div><div id="del_msg" class="mut" style="margin-top:8px"></div>');$('del_no').onclick=closeModal;$('del_yes').onclick=async()=>{$('del_msg').textContent=' ⏳ menghapus...';await api('/api/buyers/delete','POST',{telegram_id:bb.telegram_id});closeModal();loadBuyers();loadAudit();};return;}
}
function openStatusModal(b,on){
 var nm=esc(b.name||('Member '+b.telegram_id));
 openModal('<div class="h">🔌 Status Member</div><p class="mut">Member <b>'+nm+'</b> saat ini <b>'+(on?'AKTIF':'NONAKTIF')+'</b>.</p>'+(on?'':'<label>Aktifkan untuk berapa hari?</label><input id="st_days" type="number" value="30">')+'<div class="modactions"><button class="sec" id="st_no">Batal</button><button id="st_yes" style="'+(on?'background:#e5484d;color:#fff':'')+'">'+(on?'Nonaktifkan':'Aktifkan')+'</button></div><div id="st_msg" class="mut" style="margin-top:8px"></div>');
 $('st_no').onclick=closeModal;
 $('st_yes').onclick=async function(){$('st_msg').textContent=' ⏳ memproses...';if(on){const r=await api('/api/buyers/revoke','POST',{telegram_id:b.telegram_id});if(r&&r.error){$('st_msg').textContent=' ❌ '+r.error;return;}}else{const days=parseInt($('st_days').value,10)||30;const r=await api('/api/buyers/reactivate','POST',{telegram_id:b.telegram_id,days:days});if(!r.ok){$('st_msg').textContent=' ❌ '+(r.error||'error');return;}}closeModal();loadBuyers();loadAudit();};
}
function showBDetail(title,h){const el=$('b_detail');el.innerHTML='<button class="close-x" id="bd_close" title="Tutup">✕</button><div class="h">'+title+'</div>'+h;el.classList.remove('hide');$('bd_close').onclick=()=>el.classList.add('hide');el.scrollIntoView({behavior:'smooth',block:'nearest'});}
let ALLAUDIT=[];
function actMeta(a){return {create:['🟢','Member dibuat'],reactivate:['🕒','Durasi diperpanjang'],update:['✏️','Member diperbarui'],suspend:['🔴','Member dinonaktifkan'],delete:['🗑️','Member dihapus'],resetpw:['🔑','Password direset']}[a]||['⚙️',a||'aktivitas'];}
function fmtTime(s){return String(s||'').slice(0,16).replace('T',' ');}
async function loadAudit(){const d=await api('/api/audit');ALLAUDIT=d.audit||[];const box=$('a_list');if(!box)return;if(!ALLAUDIT.length){box.innerHTML='<span class="mut">belum ada aktivitas.</span>';return;}box.innerHTML='<div class="acts">'+ALLAUDIT.slice(0,5).map(function(a){var m=actMeta(a.action);return '<div class="actrow"><span class="ae">'+m[0]+'</span><span>'+esc(m[1])+(a.target?(' <span class="atg">#'+esc(a.target)+'</span>'):'')+'</span><span class="at">'+esc(fmtTime(a.created_at))+'</span></div>';}).join('')+'</div>';}
function openAuditModal(){if(!ALLAUDIT.length){openModal('<div class="h">🧾 Log Aktivitas</div><p class="mut">Belum ada aktivitas.</p><div class="modactions"><button class="sec" id="au_close">Tutup</button></div>');$('au_close').onclick=closeModal;return;}openModal('<div class="h">🧾 Log Aktivitas</div><div class="term">'+ALLAUDIT.map(function(a){var ts=String(a.created_at||'').slice(0,19).replace('T',' ');return '<div class="ln"><span class="t">['+esc(ts)+']</span> <span class="a">'+esc(a.actor||'?')+'@flixvault</span>:~$ '+esc(a.action||'')+' '+esc(a.target||'')+(a.detail?(' <span class="t"># '+esc(a.detail)+'</span>'):'')+'</div>';}).join('')+'</div><div class="modactions"><button class="sec" id="au_close">Tutup</button></div>');$('au_close').onclick=closeModal;}

// ---------- modal IMAP/domain (admin) ----------
let MODAL_TID='';
$('m_close').onclick=()=>$('modal').classList.add('hide');
/* klik di luar modal sengaja tidak menutup; gunakan tombol ✕ atau Batal */
function openModal(html){$('m_body').innerHTML=html;$('modal').classList.remove('hide');}
function closeModal(){$('modal').classList.add('hide');}
function openImapModal(tid,name){
 MODAL_TID=String(tid);
 $('m_body').innerHTML='<div class="h">📡 IMAP & Domain — '+esc(name)+' <span class="mut" style="font-weight:400">#'+esc(String(tid))+'</span></div>'
  +'<div class="row"><div><label>Host</label><input id="mi_host" placeholder="imap.domain.com"></div><div><label>Port</label><input id="mi_port" placeholder="993"></div></div>'
  +'<div class="row"><div><label>Username</label><input id="mi_user" placeholder="login@domain.com"></div><div><label>Keamanan</label><select id="mi_sec"><option value="ssl">SSL/TLS (993)</option><option value="starttls">STARTTLS (143)</option></select></div></div>'
  +'<label>Password</label><input id="mi_pass" type="password" placeholder="(kosongkan jika tidak diubah)">'
  +'<button id="mi_save">Simpan IMAP</button><span id="mi_msg" class="mut"></span>'
  +'<hr style="border:0;border-top:1px solid var(--line);margin:18px 0">'
  +'<label>Domain — satu per baris. Hapus baris untuk menghapus domain, lalu Simpan.</label><textarea id="md_add" rows="5" placeholder="parciv.net&#10;woi.lol"></textarea>'
  +'<button id="md_save">Simpan Domain</button><span id="md_msg" class="mut"></span>'
  +'<div class="modactions"><button class="sec" id="mi_close2">Tutup</button></div>';
 $('mi_save').onclick=saveModalImap;$('md_save').onclick=saveModalDomains;$('mi_close2').onclick=closeModal;
 loadModalImap();loadModalDomains();
 $('modal').classList.remove('hide');
}
window.openImapModal=openImapModal;
async function loadModalImap(){const d=await api('/api/imap?tid='+encodeURIComponent(MODAL_TID));if(d.imap){$('mi_host').value=d.imap.host;$('mi_port').value=d.imap.port;$('mi_user').value=d.imap.username;$('mi_sec').value=d.imap.security;}$('mi_pass').value='';}
async function saveModalImap(){const body={host:$('mi_host').value.trim(),port:$('mi_port').value.trim(),username:$('mi_user').value.trim(),security:$('mi_sec').value,target_tid:MODAL_TID};if($('mi_pass').value)body.password=$('mi_pass').value;if(!body.password){$('mi_msg').textContent=' isi password';return;}$('mi_msg').textContent=' ⏳ menyimpan & menguji koneksi...';const d=await api('/api/imap','POST',body);if(!d.ok){$('mi_msg').textContent=' ❌ gagal'+(d.error?' ('+d.error+')':'');return;}$('mi_msg').textContent=d.connected?' ✅ tersimpan & TERHUBUNG':(' ⚠️ tersimpan, TIDAK terhubung'+(d.error?': '+d.error:''));}
async function loadModalDomains(){const d=await api('/api/domains?tid='+encodeURIComponent(MODAL_TID));$('md_add').value=(d.domains||[]).join(String.fromCharCode(10));}
async function saveModalDomains(){$('md_msg').textContent=' ⏳ menyimpan...';const d=await api('/api/domains/set','POST',{domains:$('md_add').value,target_tid:MODAL_TID});if(d.error){$('md_msg').textContent=' '+(d.error==='no_imap'?'Atur IMAP dulu':d.error);return;}$('md_msg').textContent=' ✅ tersimpan ('+(d.domains||[]).length+' domain)'+(d.conflict&&d.conflict.length?' • bentrok: '+d.conflict.join(','):'');loadModalDomains();}

// ---------- backup ----------
async function loadBackupSettings(){const d=await api('/api/settings/backup');$('bk_hour').value=d.hour;$('bk_interval').value=d.intervalDays||1;$('bk_chat').value=d.tgChatId||'';setSw('bk_enabled',d.enabled);setSw('bk_change',d.changeEnabled);setSw('bk_active',d.changeActiveOnly);setSw('bk_tg',d.tgEnabled);var sc=d.scope||[];document.querySelectorAll('#bk_scope input[data-scope]').forEach(function(c){c.checked=sc.indexOf(c.getAttribute('data-scope'))>=0;});applyStatus(d.lastStatus,d.lastAt);}
function applyStatus(st,at){var b=$('bk_status');if(!b)return;var map={success:['🟢','Success'],running:['🟡','Running'],failed:['🔴','Failed']};var m=map[st]||['⚪','Belum ada'];b.textContent=m[0]+' '+m[1]+(at?(' • '+fmtTime(at)+' WIB'):'');}
function fmtBytes(n){n=n||0;if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(2)+' MB';}
async function loadDbStats(){const d=await api('/api/db/stats');if(!d||d.error)return;$('db_name').textContent=d.name||'database.db';$('db_engine').textContent=d.engine||'SQLite Database';$('db_size').textContent=fmtBytes(d.bytes)+' • '+d.rows+' baris';$('db_last').textContent=d.lastBackupAt?(fmtTime(d.lastBackupAt)+' WIB'):'belum ada';}
function handleRestoreFile(file){if(file.size>100*1024*1024){$('rs_filemsg').textContent=' ❌ File melebihi 100 MB';return;}var reader=new FileReader();reader.onload=function(){var content=String(reader.result||'');openModal('<div class="h">📂 Restore Database</div><p class="mut">Yakin ingin melakukan restore database dari <b>'+esc(file.name)+'</b>? Data saat ini akan <b>diganti</b> dengan data dari file backup. Snapshot pengaman dibuat otomatis.</p><div class="modactions"><button class="sec" id="rf_no">Batal</button><button id="rf_yes" style="background:#e5484d;color:#fff">Restore</button></div><div id="rf_msg" class="mut" style="margin-top:8px"></div>');$('rf_no').onclick=closeModal;$('rf_yes').onclick=async()=>{$('rf_msg').textContent=' ⏳ memulihkan...';const d=await api('/api/restore/file','POST',{json:content});if(d&&d.ok){$('rf_msg').textContent=' ✅ Selesai: '+d.rows+' baris dipulihkan';$('rs_filemsg').textContent='';loadBackups();loadBuyers();loadAudit();loadDbStats();setTimeout(closeModal,1500);}else{$('rf_msg').textContent=' ❌ Gagal: '+((d&&(d.detail||d.error))||'error');}};};reader.readAsText(file);$('rs_file').value='';}
function setSw(id,on){const e=$(id);if(on)e.classList.add('on');else e.classList.remove('on');}
$('bk_enabled').onclick=()=>$('bk_enabled').classList.toggle('on');
$('bk_change').onclick=()=>$('bk_change').classList.toggle('on');
$('bk_active').onclick=()=>$('bk_active').classList.toggle('on');
$('bk_tg').onclick=()=>$('bk_tg').classList.toggle('on');
$('bk_test').onclick=async()=>{$('bk_msg2').textContent=' ⏳ mengirim test ke Telegram...';const d=await api('/api/backups/test','POST');if(d&&d.ok){$('bk_msg2').textContent=' ✅ Terkirim ke Telegram ('+d.rows+' baris)';}else{var e=d&&d.error;var msg=e==='tg_disabled'?'aktifkan "Kirim ke Telegram" dulu':e==='no_chat_id'?'isi Chat ID Telegram dulu':e==='no_bot_token'?'bot token belum diset':(e||'gagal');$('bk_msg2').textContent=' ❌ '+msg;}setTimeout(function(){$('bk_msg2').textContent='';},4000);};
(function(){var dz=$('rs_drop'),fi=$('rs_file');if(!dz||!fi)return;dz.onclick=()=>fi.click();dz.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('drag');});dz.addEventListener('dragleave',function(){dz.classList.remove('drag');});dz.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('drag');if(e.dataTransfer.files&&e.dataTransfer.files[0])handleRestoreFile(e.dataTransfer.files[0]);});fi.onchange=function(){if(fi.files&&fi.files[0])handleRestoreFile(fi.files[0]);};})();
$('bk_save').onclick=async()=>{var scope=[];document.querySelectorAll('#bk_scope input[data-scope]').forEach(function(c){if(c.checked)scope.push(c.getAttribute('data-scope'));});const d=await api('/api/settings/backup','POST',{enabled:$('bk_enabled').classList.contains('on'),intervalDays:parseInt($('bk_interval').value,10)||1,hour:$('bk_hour').value,changeEnabled:$('bk_change').classList.contains('on'),changeActiveOnly:$('bk_active').classList.contains('on'),tgEnabled:$('bk_tg').classList.contains('on'),tgChatId:$('bk_chat').value.trim(),scope:scope});$('bk_msg2').textContent=d.ok?' ✅ tersimpan':' gagal';setTimeout(function(){$('bk_msg2').textContent='';},2500);};
$('bk_now').onclick=async()=>{$('bk_msg').textContent=' ⏳ membuat backup...';const d=await api('/api/backups','POST');$('bk_msg').textContent=(d&&d.ok)?(' ✅ '+d.rows+' baris'):' ✅';loadBackups();loadDbStats();loadBackupSettings();setTimeout(function(){$('bk_msg').textContent='';},2500);};
async function loadBackups(){const d=await api('/api/backups');const arr=d.backups||[];const box=$('bk_list');if(!arr.length){box.innerHTML='<span class="mut">belum ada backup</span>';return;}box.innerHTML='<div class="bklist">'+arr.map(b=>'<div class="bkrow"><div class="bki"><div class="bkl"><span class="kindtag">'+esc(b.kind)+'</span> '+esc(b.label||'backup')+'</div><div class="bkm">'+b.rows+' baris • '+esc(String(b.created_at||'').slice(0,16).replace('T',' '))+'</div></div><div style="display:flex;gap:6px;flex:none"><button class="sec sm dl" data-dl="'+b.id+'" title="Download">⬇</button><button class="sec sm" data-bk="'+b.id+'" title="Restore">↩</button></div></div>').join('')+'</div><div class="mut" style="font-size:11px;margin-top:10px">Menyimpan 3 backup terbaru — yang lebih lama otomatis terhapus.</div>';box.querySelectorAll('button[data-bk]').forEach(b=>b.onclick=()=>doRestore(b.getAttribute('data-bk')));box.querySelectorAll('button[data-dl]').forEach(b=>b.onclick=()=>{window.open('/api/backups/download?id='+b.getAttribute('data-dl'),'_blank');});}
function doRestore(id){openModal('<div class="h">↩ Restore Backup</div><p class="mut">Restore backup <code>#'+esc(id)+'</code>? Seluruh data sekarang akan <b>ditimpa</b>. Snapshot pengaman otomatis dibuat sebelum restore.</p><div style="display:flex;gap:8px;margin-top:14px"><button id="rs_no" class="sec">Batal</button><button id="rs_yes">Ya, restore</button></div><div id="rs_msg" class="mut" style="margin-top:8px"></div>');$('rs_no').onclick=closeModal;$('rs_yes').onclick=async()=>{$('rs_msg').textContent=' ⏳ memulihkan...';const d=await api('/api/restore','POST',{id:id});if(d.ok){$('rs_msg').textContent=' ✅ Selesai: '+d.rows+' baris dipulihkan';loadBackups();loadBuyers();loadAudit();}else{$('rs_msg').textContent=' ❌ Gagal: '+(d.detail||d.error||'error');}};}

// ---------- branding ----------
async function loadBrand(){const d=await api('/api/settings/brand');$('br_name').value=d.brand||'';$('br_welcome').value=d.welcome||'';$('br_domain').value=d.domain||'';if(d.domain)WEBDOMAIN=d.domain;}
$('br_save').onclick=async()=>{const d=await api('/api/settings/brand','POST',{brand:$('br_name').value.trim(),welcome:$('br_welcome').value,domain:$('br_domain').value.trim()});if(d.ok&&$('br_domain').value.trim())WEBDOMAIN=$('br_domain').value.trim().toLowerCase();$('br_msg').textContent=d.ok?' ✅ tersimpan (muat ulang untuk judul baru)':' gagal';};

if($('bq'))$('bq').oninput=renderBuyers;
if($('b_add'))$('b_add').onclick=openCreateModal;
if($('a_all'))$('a_all').onclick=openAuditModal;
(async()=>{ME=await api('/api/me');$('who').textContent=ME.role==='admin'?'🛡️ Admin':('👤 '+(ME.name||'Member'));buildTabs();show(tabFromUrl(),null,true);})();
</script></body></html>`
