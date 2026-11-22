import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = s => document.querySelector(s);
let user = null, entries = [], reviews = [], editingReviewId = null, settings = { week_start: 0, daily_target: 10 }, authMode = 'login', view = 'today';
const dateKey = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const today = () => dateKey(new Date());
const shiftDate = (date, days) => { const d = new Date(date+'T12:00:00'); d.setDate(d.getDate()+days); return dateKey(d); };
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = d => new Date(d+'T12:00:00').toLocaleDateString('ar-DZ',{weekday:'long',day:'numeric',month:'long'});
const shortDate = d => new Date(d+'T12:00:00').toLocaleDateString('ar-DZ',{day:'numeric',month:'short'});
const dayEntries = d => entries.filter(e=>e.entry_date===d);
const tasksFor = d => dayEntries(d).filter(e=>e.kind==='task');
const taskPoints = list => list.reduce((n,e)=>n+Number(e.difficulty||0),0);
const donePoints = list => list.filter(e=>e.is_completed).reduce((n,e)=>n+Number(e.difficulty||0),0);
const pct = (done,total) => total ? Math.min(100,Math.round(done/total*100)) : 0;
const dayStats = d => {const t=tasksFor(d), total=taskPoints(t), done=donePoints(t);return {total,done,pct:pct(done,total),count:t.length,completed:t.filter(x=>x.is_completed).length};};
const sumStats = dates => dates.reduce((a,d)=>{const x=dayStats(d);a.done+=x.done;a.total+=x.total;a.tasks+=x.count;a.completed+=x.completed;a.active+=x.count>0?1:0;return a;},{done:0,total:0,tasks:0,completed:0,active:0});
const lastDays = (n,end=today()) => Array.from({length:n},(_,i)=>shiftDate(end,i-(n-1)));
function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function authMessage(s,error=false){$('#auth-msg').textContent=s;$('#auth-msg').style.color=error?'#b42318':'#667085'}
function showAuth(){ $('#app').hidden=true; $('#auth').hidden=false; $('#auth-toggle').textContent=authMode==='login'?'ليس لديك حساب؟ أنشئ حسابًا':'لديك حساب؟ سجّل الدخول'; $('#auth-submit').textContent=authMode==='login'?'دخول':'إنشاء الحساب'; $('#auth-pass').autocomplete=authMode==='login'?'current-password':'new-password'; $('#auth-pass').value=''; authMessage('');}
async function handleAuth(e){e.preventDefault();const email=$('#auth-email').value.trim(),password=$('#auth-pass').value;if(!email||!password)return authMessage('أدخل البريد الإلكتروني وكلمة المرور.',true);$('#auth-submit').disabled=true;try{if(authMode==='login'){const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;}else{const {data,error}=await supabase.auth.signUp({email,password});if(error)throw error;if(!data.session){authMessage('تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.');return;}}}catch(e){authMessage(e.message||'تعذر إتمام العملية.',true)}finally{$('#auth-submit').disabled=false;}}
$('#auth-form').addEventListener('submit',handleAuth);
$('#auth-toggle').addEventListener('click',()=>{authMode=authMode==='login'?'signup':'login';showAuth()});
async function loadData(){
 const [a,b]=await Promise.all([
  supabase.from('mahami_entries').select('*').order('entry_date',{ascending:false}).order('created_at',{ascending:true}),
  supabase.from('mahami_settings').select('week_start,daily_target').maybeSingle(),
  supabase.from('mahami_reviews').select('*').order('review_date',{ascending:false}).order('updated_at',{ascending:false})
 ]);
 if(a.error)throw a.error; if(b.error)throw b.error; if(c.error)throw c.error;
 entries=a.data||[]; settings={week_start:Number(b.data?.week_start??0),daily_target:Number(b.data?.daily_target??10)}; reviews=c.data||[];
}
async function startApp(){try{await loadData();$('#auth').hidden=true;$('#app').hidden=false;render();}catch(e){showAuth();authMessage('تعذر تحميل بياناتك: '+e.message,true)}}
supabase.auth.onAuthStateChange(async(_event,session)=>{user=session?.user||null;if(user)await startApp();else showAuth();});
(async()=>{const {data:{session}}=await supabase.auth.getSession();user=session?.user||null;if(user)await startApp();else showAuth()})();
async function addTask(name,difficulty){const {data,error}=await supabase.from('mahami_entries').insert({entry_date:today(),kind:'task',title:name,difficulty,is_completed:false}).select().single();if(error)throw error;entries.push(data);}
async function toggleTask(id,checked){const {data,error}=await supabase.from('mahami_entries').update({is_completed:checked,completed_at:checked?new Date().toISOString():null}).eq('id',id).select().single();if(error)throw error;entries=entries.map(e=>e.id===id?data:e);}
async function deleteTask(id){const {error}=await supabase.from('mahami_entries').delete().eq('id',id);if(error)throw error;entries=entries.filter(e=>e.id!==id);}
function datesFor(period){const now=new Date();if(period==='week'){const offset=(now.getDay()-Number(settings.week_start||0)+7)%7;const start=new Date(now);start.setDate(now.getDate()-offset);return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return dateKey(d)});}return Array.from({length:now.getDate()},(_,i)=>dateKey(new Date(now.getFullYear(),now.getMonth(),i+1)));}
function streakCount(){let n=0,d=today();if(dayStats(d).completed===0)d=shiftDate(d,-1);while(dayStats(d).completed>0&&n<365){n++;d=shiftDate(d,-1);}return n;}
function statCard(label,value,sub=''){return '<div class="stat"><small>'+label+'</small><strong>'+value+'</strong>'+(sub?'<div class="stat-sub">'+sub+'</div>':'')+'</div>';}
function barRow(label,value,max,sub=''){const width=max?Math.max(0,Math.min(100,Math.round(value/max*100))):0;return '<div class="chart-row"><div class="chart-label"><span>'+label+'</span><b>'+value+'</b></div><div class="bar"><i style="width:'+width+'%"></i></div>'+(sub?'<small class="muted">'+sub+'</small>':'')+'</div>';}
function insightsMarkup(current,previous,days){
 const notes=[],delta=current.done-previous.done,rate=pct(current.completed,current.tasks);
 if(current.tasks===0)notes.push('لم تسجل مهامًا في الفترة الحالية بعد. ابدأ بإضافة مهامك لتظهر تحليلاتك.');
 else {
  if(delta>0)notes.push('نقاطك ارتفعت بمقدار '+delta+' نقطة مقارنة بالفترة السابقة. استمر على هذا النسق.');
  else if(delta<0)notes.push('إنجازك أقل بمقدار '+Math.abs(delta)+' نقطة من الفترة السابقة. جرّب تقسيم المهام الكبيرة إلى خطوات أصغر.');
  else notes.push('مستوى نقاطك مماثل للفترة السابقة. يمكنك رفعه بإضافة هدف يومي واقعي.');
  notes.push('أنجزت '+rate+'% من المهام المسجلة في آخر 7 أيام.');
  const best=days.map(d=>({d,s:dayStats(d)})).sort((a,b)=>b.s.done-a.s.done)[0];
  if(best&&best.s.done>0)notes.push('أفضل يوم في آخر أسبوع كان '+fmt(best.d)+' بـ '+best.s.done+' نقطة.');
  const missed=days.filter(d=>dayStats(d).count>0&&dayStats(d).completed===0).length;
  if(missed)notes.push('لديك '+missed+' أيام أُضيفت فيها مهام دون إكمال أي منها؛ راجع حجم أهداف تلك الأيام.');
 }
 return '<ul class="insight-list">'+notes.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>';
}
function renderHeatmap(){
 const days=lastDays(364),cells=days.map(d=>{const s=dayStats(d),level=s.done===0?0:s.done<=2?1:s.done<=5?2:s.done<=9?3:4;return '<span class="heat-cell heat-'+level+'" title="'+esc(fmt(d)+': '+s.done+' نقطة، '+s.completed+' مهام مكتملة')+'"></span>';}).join('');
 return '<div class="heatmap-wrap"><div class="heatmap">'+cells+'</div><div class="heat-legend"><span>أقل</span><i class="heat-cell heat-0"></i><i class="heat-cell heat-1"></i><i class="heat-cell heat-2"></i><i class="heat-cell heat-3"></i><i class="heat-cell heat-4"></i><span>أكثر</span></div></div>';
}
function exportCsv(){
 const rows=[['التاريخ','المهمة','الصعوبة','الحالة','وقت الإنجاز'],...entries.filter(e=>e.kind==='task').sort((a,b)=>a.entry_date.localeCompare(b.entry_date)).map(e=>[e.entry_date,e.title,e.difficulty,e.is_completed?'مكتملة':'غير مكتملة',e.completed_at||''])];
 const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mahami-report-'+today()+'.csv';a.click();URL.revokeObjectURL(url);toast('تم تجهيز ملف CSV.');
}
function exportPdf(){
 const dates=lastDays(30),s=sumStats(dates),rows=dates.map(d=>{const x=dayStats(d);return '<tr><td>'+esc(fmt(d))+'</td><td>'+x.done+'</td><td>'+x.completed+'/'+x.count+'</td><td>'+x.pct+'%</td></tr>';}).join('');
 const w=window.open('','_blank');if(!w){toast('اسمح بالنوافذ المنبثقة لتصدير التقرير PDF.');return;}
 w.document.write('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تقرير مهامي</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#222}h1{margin-bottom:4px}.muted{color:#777}.cards{display:flex;gap:12px;margin:24px 0}.card{border:1px solid #ddd;padding:14px;border-radius:10px;flex:1}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:right}@media print{button{display:none}}</style><h1>تقرير مهامي</h1><p class="muted">آخر 30 يومًا · حتى '+today()+'</p><div class="cards"><div class="card">النقاط المنجزة<br><b>'+s.done+'</b></div><div class="card">المهام المكتملة<br><b>'+s.completed+'/'+s.tasks+'</b></div><div class="card">معدل الإنجاز<br><b>'+pct(s.completed,s.tasks)+'%</b></div></div><table><thead><tr><th>اليوم</th><th>النقاط</th><th>المهام</th><th>الإنجاز</th></tr></thead><tbody>'+rows+'</tbody></table><p class="muted">تم إنشاء هذا التقرير من بيانات حسابك في Mahami.</p><script>window.onload=()=>window.print()<\/script></html>');
 w.document.close();
}
function renderAnalytics(){
 const days=lastDays(7),prevDays=lastDays(7,shiftDate(today(),-7)),cur=sumStats(days),prev=sumStats(prevDays),target=Number(settings.daily_target)||10;
 const month=sumStats(lastDays(30)),change=cur.done-prev.done,changeText=change>0?'+'+change: String(change);
 const chart=days.map(d=>{const s=dayStats(d);return barRow(shortDate(d),s.done,Math.max(1,...days.map(x=>dayStats(x).done)),s.completed+'/'+s.count+' مهام');}).join('');
 const streak=streakCount();
 return '<section class="stats analytics-stats">'+statCard('إنجاز آخر 7 أيام',cur.done+' نقطة',changeText+' نقطة مقارنة بالأسبوع السابق')+statCard('المهام المكتملة',cur.completed+' / '+cur.tasks,pct(cur.completed,cur.tasks)+'% من المهام')+statCard('سلسلة الالتزام',streak+' يوم','أيام متتالية بإنجاز مهمة على الأقل')+statCard('إنجاز آخر 30 يومًا',month.done+' نقطة',month.completed+' مهمة مكتملة')+'</section>'+
 '<section class="panel analytics-panel"><div class="section-heading"><div><h2>خريطة النشاط</h2><p class="muted">توزيع إنجازك خلال آخر 12 شهرًا تقريبًا</p></div></div>'+renderHeatmap()+'</section>'+
 '<div class="analytics-grid"><section class="panel"><h2>مقارنة آخر أسبوع بالسابق</h2><div class="compare-grid"><div><small class="muted">الأسبوع الحالي</small><strong>'+cur.done+' نقطة</strong><span>'+cur.completed+'/'+cur.tasks+' مهام</span></div><div><small class="muted">الأسبوع السابق</small><strong>'+prev.done+' نقطة</strong><span>'+prev.completed+'/'+prev.tasks+' مهام</span></div></div><div class="compare-change '+(change>=0?'positive':'negative')+'">'+(change>=0?'زيادة ':'انخفاض ')+Math.abs(change)+' نقطة ('+changeText+')</div></section><section class="panel"><h2>هدفك اليومي</h2><div class="goal-big">'+target+' <small>نقطة</small></div><p class="muted">أنجزت اليوم '+dayStats(today()).done+' من '+target+' نقطة مستهدفة.</p><div class="bar"><i style="width:'+pct(dayStats(today()).done,target)+'%"></i></div><form id="goal-form" class="goal-form"><label for="daily-target">تعديل الهدف اليومي</label><div><input id="daily-target" type="number" min="1" max="100" step="1" value="'+target+'" required><button class="btn" type="submit">حفظ الهدف</button></div></form></section></div>'+
 '<section class="panel analytics-panel"><h2>النقاط المنجزة يوميًا · آخر 7 أيام</h2>'+chart+'</section>'+
 '<section class="panel analytics-panel"><h2>ملاحظات وتحليل الأداء</h2>'+insightsMarkup(cur,prev,days)+'</section>'+
 '<section class="export-panel"><div><h2>تصدير تقاريرك</h2><p class="muted">احتفظ بنسخة من سجل المهام أو اطبع تقريرًا منسقًا لآخر 30 يومًا بصيغة PDF.</p></div><div class="export-actions"><button class="btn btn-light" id="export-csv">تصدير CSV</button><button class="btn" id="export-pdf">تصدير PDF</button></div></section>';
}

function reviewDateLabel(d){return new Date(d+'T12:00:00').toLocaleDateString('ar-DZ',{day:'numeric',month:'long',year:'numeric'});}
function renderReviews(){
 const selected=editingReviewId?reviews.find(r=>r.id===editingReviewId):null;
 const date=selected?.review_date||today(),title=selected?.title||'',content=selected?.content||'';
 const list=reviews.length?reviews.map(r=>'<article class="review-item"><div class="review-item-main"><strong>'+esc(r.title)+'</strong><time>'+esc(reviewDateLabel(r.review_date))+'</time><p>'+esc((r.content||'').replace(/\\s+/g,' ').slice(0,150))+(r.content?.length>150?'…':'')+'</p></div><div class="review-item-actions"><button class="btn btn-light btn-small" data-review-edit="'+r.id+'">فتح</button><button class="btn btn-danger btn-small" data-review-delete="'+r.id+'">حذف</button></div></article>').join(''):'<div class="empty">لا توجد ملاحظات بعد. ابدأ أول مراجعة واكتب ما تعلمته أو ما تريد تحسينه.</div>';
 return '<div class="review-layout"><section class="panel review-editor"><div class="review-editor-head"><div><h2>'+(selected?'تعديل المراجعة':'مراجعة جديدة')+'</h2><p class="muted">دوّن أفكارك، ملاحظاتك، وما تريد تذكره لاحقًا.</p></div>'+(selected?'<button class="btn btn-light btn-small" id="review-new">مراجعة جديدة</button>':'')+'</div><form id="review-form"><label class="field"><span>عنوان المراجعة</span><input id="review-title" maxlength="180" required placeholder="مثلاً: مراجعة يوم الأحد" value="'+esc(title)+'"></label><label class="field"><span>التاريخ</span><input id="review-date" type="date" required value="'+esc(date)+'"></label><label class="field"><span>ملاحظاتك وتدويناتك</span><textarea id="review-content" maxlength="30000" rows="12" placeholder="اكتب ما أنجزته، ما تعلمته، الأفكار التي تريد الاحتفاظ بها، وما ستعمل عليه لاحقًا...">'+esc(content)+'</textarea></label><div class="review-editor-footer"><span class="muted" id="review-count">'+content.length+' / 30000 حرف</span><button class="btn" type="submit">'+(selected?'حفظ التعديلات':'حفظ المراجعة')+'</button></div></form></section><section class="panel review-list"><div class="review-list-head"><div><h2>دفتر المراجعات</h2><p class="muted">'+reviews.length+' تدوينة محفوظة</p></div><button class="btn btn-light btn-small" id="reviews-pdf">تصدير PDF</button></div>'+list+'</section></div>';
}
function exportReviewsPdf(){
 if(!reviews.length){toast('لا توجد تدوينات لتصديرها بعد.');return;}
 const content=reviews.map(r=>'<article><h2>'+esc(r.title)+'</h2><p class="date">'+esc(reviewDateLabel(r.review_date))+'</p><div class="note">'+esc(r.content||'').replace(/\\n/g,'<br>')+'</div></article>').join('');
 const w=window.open('','_blank');if(!w){toast('اسمح بالنوافذ المنبثقة لتصدير PDF.');return;}
 w.document.write('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>مراجعاتي - Mahami</title><style>body{font-family:Arial,sans-serif;color:#20211f;padding:32px;line-height:1.9}h1{font-size:26px;margin:0}h2{font-size:19px;margin:24px 0 4px}.subtitle,.date{color:#777;font-size:12px}.note{white-space:pre-wrap;overflow-wrap:anywhere;border-bottom:1px solid #ddd;padding:8px 0 24px}article{break-inside:avoid;margin-bottom:24px}@media print{body{padding:12mm}}</style><h1>دفتر المراجعات</h1><p class="subtitle">Mahami · '+reviews.length+' تدوينة · '+today()+'</p>'+content+'<script>window.onload=()=>window.print()<\\/script></html>');
 w.document.close();
}

function render(){
 const d=today(),stats=dayStats(d),v=view;
 document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
 const titles={today:'اليوم',week:'الأسبوع',month:'الشهر',log:'سجل الإنجاز',analytics:'الإحصائيات',reviews:'المراجعة',settings:'الإعدادات'};
 let html='<header class="page-head"><div><div class="eyebrow">مساحة تطويرك الشخصي</div><h1>'+titles[v]+'</h1><div class="muted">'+fmt(d)+'</div></div><button class="btn btn-light" id="signout">تسجيل الخروج</button></header>';
 if(v==='today'){
  const tasks=tasksFor(d);
  html+='<section class="stats"><div class="stat"><small>نسبة إنجاز اليوم</small><strong>'+stats.pct+'<small>%</small></strong><div class="bar"><i style="width:'+stats.pct+'%"></i></div></div><div class="stat"><small>النقاط المكتملة / المستهدفة</small><strong>'+stats.done+' <small>/ '+stats.total+'</small></strong></div><div class="stat"><small>المهام المكتملة</small><strong>'+stats.completed+' <small>/ '+stats.count+'</small></strong></div></section><div class="layout"><section class="panel"><h2>مهام اليوم</h2><form class="task-form" id="add-form"><input id="task-name" placeholder="ما المهمة التي تريد إنجازها؟" required maxlength="200"><select id="task-points"><option value="1">سهلة · 1 نقطة</option><option value="2">متوسطة · 2 نقطتان</option><option value="3">صعبة · 3 نقاط</option></select><button class="btn">إضافة</button></form><div>'+ (tasks.length?tasks.map(t=>'<div class="task '+(t.is_completed?'done':'')+'"><input type="checkbox" data-check="'+t.id+'" '+(t.is_completed?'checked':'')+'><span>'+esc(t.title)+' <small class="muted">· '+t.difficulty+' نقاط</small></span><button data-delete="'+t.id+'" aria-label="حذف">×</button></div>').join(''):'<div class="empty">أضف مهامك لهذا اليوم، وسيُحسب الهدف تلقائيًا من مجموع نقاطها.</div>')+'</div></section><section class="panel"><h2>مؤشر التقدم</h2><div class="score">'+stats.pct+'<small class="muted" style="font-size:18px">%</small></div><div class="bar"><i style="width:'+stats.pct+'%"></i></div><p class="muted">الهدف اليومي = مجموع نقاط جميع مهام اليوم. كلما أكملت مهمة ارتفعت نسبة تقدمك.</p><div class="day-row"><span>النقاط المتبقية</span><b>'+Math.max(0,stats.total-stats.done)+'</b></div></section></div>';
 } else if(v==='week'||v==='month'){
  const dates=datesFor(v),sum=sumStats(dates),progress=pct(sum.done,sum.total);
  html+='<section class="stats"><div class="stat"><small>نسبة التقدم الإجمالية</small><strong>'+progress+'%</strong><div class="bar"><i style="width:'+progress+'%"></i></div></div><div class="stat"><small>النقاط المنجزة / المستهدفة</small><strong>'+sum.done+' <small>/ '+sum.total+'</small></strong></div><div class="stat"><small>إنجاز المهام</small><strong>'+sum.completed+' <small>/ '+sum.tasks+'</small></strong></div></section><section class="panel"><h2>مؤشر التقدم اليومي</h2>'+dates.map(date=>{const x=dayStats(date);return '<div class="progress-row"><div class="day-row"><span>'+fmt(date)+'</span><b>'+x.pct+'%</b></div><div class="bar"><i style="width:'+x.pct+'%"></i></div><small class="muted">'+x.done+' من '+x.total+' نقطة · '+x.completed+'/'+x.count+' مهام</small></div>'}).join('')+'</section>';
 } else if(v==='log'){
  const ds=[...new Set(entries.map(e=>e.entry_date))].sort().reverse();
  html+='<section class="panel"><h2>سجل إنجازك</h2>'+(ds.length?ds.map(date=>{const x=dayStats(date);return '<div class="progress-row"><div class="day-row"><span>'+fmt(date)+'</span><b>'+x.pct+'%</b></div><div class="bar"><i style="width:'+x.pct+'%"></i></div><small class="muted">'+x.done+'/'+x.total+' نقطة مكتملة</small></div>'}).join(''):'<div class="empty">سيظهر سجل إنجازك هنا بعد إضافة المهام.</div>')+'</section>';
 } else if(v==='analytics'){html+=renderAnalytics();}
 else if(v==='reviews'){html+=renderReviews();}
 else {
  html+='<section class="panel"><h2>إعدادات الحساب</h2><p class="muted">بيانات المهام والتقدم محفوظة في قاعدة بياناتك على Supabase، وتُحمّل عند تسجيل الدخول من أي جهاز.</p><div class="settings-row"><span>البريد الإلكتروني</span><b dir="ltr">'+esc(user?.email||'')+'</b></div><div class="settings-row"><span>بداية الأسبوع</span><select id="week-start"><option value="0" '+(settings.week_start===0?'selected':'')+'>الأحد</option><option value="1" '+(settings.week_start===1?'selected':'')+'>الإثنين</option><option value="6" '+(settings.week_start===6?'selected':'')+'>السبت</option></select></div><div class="settings-row"><span>الهدف اليومي الافتراضي</span><b>'+settings.daily_target+' نقطة</b></div></section>';
 }
 $('#view').innerHTML=html;
 $('#signout')?.addEventListener('click',async()=>{await supabase.auth.signOut();});
 $('#add-form')?.addEventListener('submit',async e=>{e.preventDefault();const name=$('#task-name').value.trim();if(!name)return;try{await addTask(name,+$('#task-points').value);render();toast('تمت إضافة المهمة وحساب الهدف تلقائيًا.')}catch(err){toast('تعذر الحفظ: '+err.message)}});
 document.querySelectorAll('[data-check]').forEach(el=>el.addEventListener('change',async()=>{try{await toggleTask(el.dataset.check,el.checked);render()}catch(err){toast('تعذر تحديث المهمة: '+err.message)}}));
 document.querySelectorAll('[data-delete]').forEach(el=>el.addEventListener('click',async()=>{try{await deleteTask(el.dataset.delete);render()}catch(err){toast('تعذر حذف المهمة: '+err.message)}}));
 $('#week-start')?.addEventListener('change',async e=>{const next={user_id:user.id,week_start:+e.target.value,daily_target:settings.daily_target};const {error}=await supabase.from('mahami_settings').upsert(next,{onConflict:'user_id'});if(error)toast(error.message);else{settings.week_start=+e.target.value;render()}});
 $('#goal-form')?.addEventListener('submit',async e=>{e.preventDefault();const target=Number($('#daily-target').value);if(!Number.isInteger(target)||target<1||target>100){toast('اختر هدفًا بين 1 و100 نقطة.');return;}const {error}=await supabase.from('mahami_settings').upsert({user_id:user.id,week_start:settings.week_start,daily_target:target},{onConflict:'user_id'});if(error)toast('تعذر حفظ الهدف: '+error.message);else{settings.daily_target=target;render();toast('تم حفظ هدفك اليومي.')}});

 $('#review-new')?.addEventListener('click',()=>{editingReviewId=null;render();});
 $('#review-content')?.addEventListener('input',e=>{$('#review-count').textContent=e.target.value.length+' / 30000 حرف';});
 $('#review-form')?.addEventListener('submit',async e=>{e.preventDefault();const title=$('#review-title').value.trim(),review_date=$('#review-date').value,content=$('#review-content').value;if(!title||!review_date){toast('أدخل عنوان المراجعة والتاريخ.');return;}const payload={user_id:user.id,title,review_date,content,updated_at:new Date().toISOString()};try{let result;if(editingReviewId){result=await supabase.from('mahami_reviews').update(payload).eq('id',editingReviewId).select().single();}else{result=await supabase.from('mahami_reviews').insert(payload).select().single();}if(result.error)throw result.error;if(editingReviewId)reviews=reviews.map(r=>r.id===editingReviewId?result.data:r);else reviews.unshift(result.data);editingReviewId=result.data.id;render();toast('تم حفظ المراجعة في حسابك.');}catch(err){toast('تعذر حفظ المراجعة: '+err.message);}});
 document.querySelectorAll('[data-review-edit]').forEach(b=>b.addEventListener('click',()=>{editingReviewId=b.dataset.reviewEdit;render();}));
 document.querySelectorAll('[data-review-delete]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('هل تريد حذف هذه المراجعة نهائيًا؟'))return;const id=b.dataset.reviewDelete;const {error}=await supabase.from('mahami_reviews').delete().eq('id',id);if(error){toast('تعذر الحذف: '+error.message);return;}reviews=reviews.filter(r=>r.id!==id);if(editingReviewId===id)editingReviewId=null;render();toast('تم حذف المراجعة.');}));
 $('#reviews-pdf')?.addEventListener('click',exportReviewsPdf);
 $('#export-csv')?.addEventListener('click',exportCsv);
 $('#export-pdf')?.addEventListener('click',exportPdf);
}
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;render()}));
