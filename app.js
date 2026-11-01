const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const request=async(url,opts={})=>{const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...opts});const d=await r.json();if(!r.ok)throw new Error(d.error||'通信エラー');return d};
const post=(url,body)=>request(url,{method:'POST',body:JSON.stringify(body)});const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});$$('input[type="date"]').forEach(x=>x.value=today);
function tab(id){$$('.tab').forEach(x=>x.hidden=x.id!==id);$$('#tabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));if(id==='ledger')loadLedger();if(id==='history')loadHistory()}
$$('#tabs button').forEach(x=>x.onclick=()=>tab(x.dataset.tab));$('#gotoPredict').onclick=()=>tab('predict');
async function me(){try{const u=await request('/api/me');$('#auth').hidden=true;$('#account').textContent=`${u.email} | ${u.plan} | 無料残${u.trial_left} | 月${u.monthlyUsed}/${u.monthlyLimit}`}catch{$('#auth').hidden=false;$('#account').textContent='未ログイン'}}
$('#authForm').addEventListener('click',e=>{if(e.target.matches('button'))$('#authForm').dataset.action=e.target.dataset.action});
$('#authForm').onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));try{await post('/api/'+(e.target.dataset.action||'register'),v);await me()}catch(err){alert(err.message)}};
function lines(text){return text.split('\n').filter(x=>x.trim()).map(s=>{const a=s.split(',').map(x=>x.trim());return {number:Number(a[0]),name:a[1],odds:a[2]?Number(a[2]):undefined,style:a[3]||undefined,form:a[4]||undefined,workout:a[5]||undefined,paddock:a[6]||undefined,notes:a[7]||undefined,...Object.fromEntries(['paceScore','conditionScore','classFitScore','workoutScore','troubleRecoveryScore'].map((key,i)=>[key,a[i+8]!==undefined&&a[i+8]!==''?Number(a[i+8]):undefined]))}})};
function renderResult(data){const {result:r,gate:g}=data;const h=(label,v)=>`<h4>${esc(label)}</h4><div>${esc(typeof v==='string'?v:JSON.stringify(v,null,2))}</div>`;$('#predictionOutput').innerHTML=`<div class="${g.status==='HOLD'?'hold':'hold'}"><b>購入ゲート：${g.status==='HOLD'?'見送り':'要専門確認（自動許可なし）'}</b><div>${esc(g.misses.join(' / ')||'まだ正式購入許可を出していません')}</div></div>`+h('総合評価',r.summary)+h('予想印・全頭評価',r.marks)+h('展開3シナリオ',r.paceScenarios)+h('穴馬評価',r.darkHorses)+h('自分の推奨馬の評価',r.favHorseReview)+h('実計算2000回の参考モデル（未校正）',r.simulation)+h('重複除去済み参考買い目・予算内',r.generatedTickets)+h('参考買い目（正式購入ではありません）',r.ticketCandidates)+h('見落とし・反証',r.risks)+h('不足データ',r.dataGaps)+h('結論の根拠',r.recommendationReason)+h('独自6機能：穴馬覚醒レーダー',r.uniqueFeatures?.radar)+h('逆転世界線AI：4シナリオ各1500回の参考計算',r.uniqueFeatures?.worlds)+h('着順昇格エンジン',r.uniqueFeatures?.promotion)+h('MY推奨馬 対決AI',r.uniqueFeatures?.myHorse)+h('AI購入ストッパー',r.uniqueFeatures?.stopper)}
$('#raceForm').onsubmit=async e=>{e.preventDefault();const f=e.target,v=Object.fromEntries(new FormData(f));const horses=lines(v.horses);if(horses.some(h=>!Number.isInteger(h.number)||!h.name||h.odds!==undefined&&!Number.isFinite(h.odds)||['paceScore','conditionScore','classFitScore','workoutScore','troubleRecoveryScore'].some(k=>h[k]!==undefined&&(!Number.isFinite(h[k])||h[k]<0||h[k]>100)))){alert('出走馬の各行を「馬番,馬名,オッズ,...」で入力してください');return}const data={date:v.date,venue:v.venue,race:v.race,surface:v.surface,ground:v.ground,distance:Number(v.distance),ticket:v.ticket,budget:Number(v.budget),maxPoints:Number(v.maxPoints),favHorse:v.favHorse,horses};['dataVerified','withdrawalsVerified','oddsVerified','weightVerified','trackBiasVerified','simulationsActuallyComputed'].forEach(k=>data[k]=f.elements[k].checked);$('#predictionOutput').textContent='AI分析中...';try{renderResult(await post('/api/predict',data));await me()}catch(err){$('#predictionOutput').textContent=err.message}};
$('#ledgerForm').onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));v.stake=Number(v.stake);v.payout=Number(v.payout);try{await post('/api/ledger',v);await loadLedger()}catch(err){alert(err.message)}};
async function loadLedger(){try{const learning=await request('/api/unique/learning');$('#learningOutput').textContent=JSON.stringify(learning,null,2);const d=await request('/api/ledger'),s=d.stats;$('#ledgerStats').innerHTML=[['購入額',s.stake+'円'],['払戻',s.payout+'円'],['損益',s.profit+'円'],['回収率',s.roi===null?'--':s.roi+'%'],['的中率',s.hitRate===null?'--':s.hitRate+'%']].map(([a,b])=>`<div class="stat">${esc(a)}<b>${esc(b)}</b></div>`).join('');$('#ledgerRows').innerHTML=d.rows.map(x=>`<div class="item">${esc(x.date)} ${esc(x.venue)} ${esc(x.race)} ${x.kind==='official'?'実購入':'仮想'} | 購入 ${x.stake}円 / 払戻 ${x.payout}円 | ${esc(x.note)} <button class="outline" data-delete="${esc(x.id)}">削除</button></div>`).join('')||'記録なし';$$('[data-delete]').forEach(x=>x.onclick=async()=>{if(confirm('削除しますか？')){await request('/api/ledger/'+x.dataset.delete,{method:'DELETE'});loadLedger()}})}catch(e){$('#ledgerRows').textContent=e.message}}
async function loadHistory(){try{const d=await request('/api/predictions');$('#historyRows').innerHTML=d.map(x=>`<div class="item">${esc(x.created_at)} | ${esc(x.race_key)} | ${esc(x.gate)} <button class="outline" data-history="${esc(x.id)}">結果を見る</button> <button class="outline" data-outcome="${esc(x.id)}">着順入力</button></div>`).join('')||'予想履歴なし';$$('[data-outcome]').forEach(b=>b.onclick=async()=>{const value=prompt('着順を馬番で入力（例 5,2,6）');if(!value)return;const finish=value.split(',').map(x=>Number(x.trim()));const sourceNote=prompt('結果の確認元を入力');if(!sourceNote)return;try{const d=await post('/api/predictions/'+b.dataset.outcome+'/outcome',{finish,sourceNote});alert('参考買い目 '+d.checks.length+'点中、一致 '+d.hitCount+'点。公式データ自動照合ではありません。')}catch(e){alert(e.message)}});$$('[data-history]').forEach(b=>b.onclick=async()=>{try{const row=await request('/api/predictions/'+b.dataset.history);tab('predict');renderResult(row);$('#predictionOutput').scrollIntoView({behavior:'smooth'})}catch(e){alert(e.message)}})}catch(e){$('#historyRows').textContent=e.message}}
$$('[data-plan]').forEach(x=>x.onclick=async()=>{try{const d=await post('/api/billing/checkout',{plan:x.dataset.plan});location.href=d.url}catch(e){alert(e.message)}});
$('#portal').onclick=async()=>{try{const d=await post('/api/billing/portal',{});location.href=d.url}catch(e){alert(e.message)}};
$('#logout').onclick=async()=>{await post('/api/logout',{});await me()};me();tab('predict');

$('#exportLedger').onclick=()=>{location.href='/api/ledger/export.csv'};

$('#evaluateFavourite').onclick=()=>{const name=$('#favouriteHorseInput').value.trim();if(!name){alert('評価したい馬を入力してください');return}$('#raceForm').elements.favHorse.value=name;tab('predict');$('#raceForm').requestSubmit()};

// v0.6 independent owner-scoped experiments
const $ev=id=>document.getElementById(id);const evText=(id,value)=>$ev(id).textContent=JSON.stringify(value,null,2);
$ev('evAudit').onclick=async()=>{try{const d=await request('/api/evolution/audit/'+encodeURIComponent($ev('evPredictionId').value.trim()));evText('evAuditOutput',{counter:d.counter,promotion:d.promotion,gate:d.gate});const frames=d.scene.frames;let f=0;const el=$ev('evHorses');const draw=()=>{const frame=frames[f++%frames.length];el.innerHTML=frame.positions.map(p=>`<span class="runner" style="left:${Math.min(94,Math.max(0,p.x*90))}%;top:${p.lane*24+4}px">${esc(p.number)}</span>`).join('')};draw();$ev('evAuditOutput').dataset.frames=JSON.stringify(frames);$ev('evTrack').onclick=draw;}catch(e){$ev('evAuditOutput').textContent=e.message}};
$ev('evSaveEvidence').onclick=async()=>{try{const id=$ev('evPredictionId').value.trim();await post('/api/evolution/evidence',{predictionId:id,horse:$ev('evHorse').value,reason:$ev('evReason').value,source:$ev('evSource').value,before:$ev('evBefore').value,after:$ev('evAfter').value});const d=await request('/api/evolution/evidence/'+encodeURIComponent(id));evText('evAuditOutput',d)}catch(e){alert(e.message)}};
$ev('evSaveOdds').onclick=async()=>{try{const raceKey=$ev('evRaceKey').value;await post('/api/evolution/odds',{raceKey,horseNo:Number($ev('evNo').value),odds:Number($ev('evOdds').value),observedAt:new Date().toISOString(),source:$ev('evOddsSource').value});evText('evOddsOutput',await request('/api/evolution/odds?raceKey='+encodeURIComponent(raceKey)))}catch(e){$ev('evOddsOutput').textContent=e.message}};
$ev('evRisk').onclick=async()=>{try{await request('/api/evolution/risk',{method:'PUT',body:JSON.stringify({monthlyLimit:Number($ev('evMonthly').value),lossLimit:Number($ev('evLoss').value),dailyLimit:Number($ev('evDaily').value)})});evText('evRiskOutput',await request('/api/evolution/risk?proposal='+encodeURIComponent($ev('evProposal').value)))}catch(e){$ev('evRiskOutput').textContent=e.message}};
$ev('evLab').onclick=async()=>{try{await post('/api/evolution/lab',{version:$ev('evVersion').value,raceKey:$ev('evLabRace').value,hit:$ev('evHit').value==='true',stake:Number($ev('evStake').value),payout:Number($ev('evPayout').value)});evText('evLabOutput',await request('/api/evolution/lab'))}catch(e){$ev('evLabOutput').textContent=e.message}};
$ev('evAnalyzePhoto').onclick=async()=>{const f=$ev('evPhoto').files[0];if(!f)return alert('写真を選択してください');if(f.size>2800000)return alert('画像は約2.8MBまでにしてください');try{const reader=new FileReader();reader.onload=async()=>{try{evText('evPhotoOutput',await post('/api/evolution/photo',{dataUrl:reader.result,context:$ev('evPhotoContext').value}))}catch(e){$ev('evPhotoOutput').textContent=e.message}};reader.readAsDataURL(f)}catch(e){$ev('evPhotoOutput').textContent=e.message}};

// v0.7 independent integrated tools
const x07=id=>document.getElementById(id);
const x07nums=id=>x07(id).value.split(',').map(s=>Number(s.trim())).filter(n=>Number.isInteger(n)&&n>0);
async function x07run(endpoint,method,body,out){try{const id=x07('x07id').value.trim();if(!id)throw Error('予想履歴IDを入力してください');const url='/api/v07/'+encodeURIComponent(id)+'/'+endpoint;const d=method==='GET'?await request(url):await post(url,body);x07(out).textContent=JSON.stringify(d,null,2)}catch(e){x07(out).textContent=e.message}}
x07('x07branch').onclick=()=>x07run('branch','POST',{pace:x07('x07pace').value,ground:x07('x07ground').value,favouriteBreak:x07('x07break').checked},'x07branchResult');
x07('x07dna').onclick=()=>{const observations=x07('x07dnaLines').value.split('\n').filter(s=>s.trim()).map(s=>{const a=s.split(',').map(v=>v.trim());return {distance:a[0],surface:a[1],ground:a[2],pace:a[3],course:a[4],finish:Number(a[5])}});x07run('dna','POST',{horseNo:Number(x07('x07horse').value),observations},'x07dnaResult')};
x07('x07seal').onclick=()=>x07run('seal','POST',{},'x07sealResult');x07('x07verify').onclick=()=>x07run('seal','GET',null,'x07sealResult');
x07('x07autopsy').onclick=()=>x07run('autopsy','POST',{predicted:x07nums('x07predicted'),finish:x07nums('x07finish'),reasons:x07('x07reason').value?[x07('x07reason').value]:[]},'x07autopsyResult');
x07('x07compare').onclick=()=>x07run('human-ai','POST',{human:x07nums('x07human'),ai:x07nums('x07ai')},'x07compareResult');
x07('x07records').onclick=()=>x07run('records','GET',null,'x07recordsResult');

// v0.8 controls: server validates owner and persists analyses per prediction.
const d08=id=>document.getElementById(id);
async function d08call(url,method,body,target){try{const options=method==='GET'?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};const x=await request(url,options);d08(target).textContent=JSON.stringify(x,null,2)}catch(e){d08(target).textContent=e.message}}
const d08pid=()=>encodeURIComponent(d08('d08id').value.trim());
d08('d08analyze').onclick=()=>d08call('/api/v08/'+d08pid()+'/analyze','POST',{pace:d08('d08pace').value,favoriteFails:d08('d08fail').checked},'d08result');
d08('d08autopsy').onclick=()=>d08call('/api/v08/'+d08pid()+'/autopsy','POST',{},'d08autopsyResult');
d08('d08records').onclick=()=>d08call('/api/v08/'+d08pid()+'/records','GET',{},'d08recordsResult');
d08('d08settings').onclick=()=>d08call('/api/v08/notifications','PUT',{enabled:d08('d08enabled').checked,threshold:Number(d08('d08threshold').value)},'d08noticeResult');
d08('d08notices').onclick=()=>d08call('/api/v08/notifications','GET',{},'d08noticeResult');

// REVERSE HUNTER v0.9 user-scoped workflow
const r09=id=>document.getElementById(id);
async function call09(url,method,target,body){try{const x=await request(url,method==='GET'?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});r09(target).textContent=JSON.stringify(x,null,2)}catch(e){r09(target).textContent=e.message}}
const pid09=()=>encodeURIComponent(r09('r09id').value.trim());
r09('r09run').onclick=()=>call09('/api/v09/'+pid09()+'/reverse','POST','r09out',{pace:r09('r09pace').value,excludeFavorite:r09('r09exclude').checked});
r09('r09graph').onclick=()=>call09('/api/v09/'+pid09()+'/network','GET','r09aux');
r09('r09history').onclick=()=>call09('/api/v09/'+pid09()+'/records','GET','r09aux');
r09('r09watch').onclick=()=>call09('/api/v09/watch','POST','r09watchout',{horse:r09('r09horse').value,conditions:r09('r09condition').value});
r09('r09list').onclick=()=>call09('/api/v09/watch','GET','r09watchout');
r09('r09patterns').onclick=()=>call09('/api/v09/patterns','GET','r09patternout');

// v1.0 learning lab — authenticated endpoints; raw data and model diagnostics are user-specific.
const v10print=x=>{$('#v10output').textContent=JSON.stringify(x,null,2)};
async function v10datasets(){const data=await request('/api/v10/datasets');$('#v10dataset').innerHTML=data.map(x=>`<option value="${esc(x.id)}">${esc(x.region)} | ${esc(x.source_note)} | ${esc(x.created_at)}</option>`).join('');v10print({datasets:data.length})}
$('#v10upload').onclick=async()=>{try{const rows=JSON.parse($('#v10rows').value);const data=await post('/api/v10/datasets',{region:'JRA',sourceNote:$('#v10source').value,rows});v10print(data);await v10datasets()}catch(e){v10print({error:e.message})}};
$('#v10list').onclick=async()=>{try{await v10datasets()}catch(e){v10print({error:e.message})}};
$('#v10train').onclick=async()=>{try{v10print(await post('/api/v10/train',{datasetId:$('#v10dataset').value}))}catch(e){v10print({error:e.message})}};
$('#v10runs').onclick=async()=>{try{v10print(await request('/api/v10/runs'))}catch(e){v10print({error:e.message})}};
$('#v10gate').onclick=async()=>{try{v10print(await request('/api/v10/gate'))}catch(e){v10print({error:e.message})}};

// v1.3 research lab controls: all server routes require authenticated session.
for(const [id,url,method,payload] of [
 ['v13audit','/api/v13/audit','POST',()=>({datasetId:document.querySelector('#v13dataset').value.trim()})],
 ['v13benchmark','/api/v13/benchmark','POST',()=>({datasetId:document.querySelector('#v13dataset').value.trim()})],
 ['v13tickets','/api/v13/tickets','POST',()=>({datasetId:document.querySelector('#v13dataset').value.trim(),runId:document.querySelector('#v13run').value.trim(),raceId:document.querySelector('#v13race').value.trim(),maxPoints:24,stake:100})],
 ['v13release','/api/v13/release-check','GET',()=>null]]){
 const btn=document.getElementById(id);if(btn)btn.addEventListener('click',async()=>{const out=document.getElementById('v13out');out.textContent='確認中…';try{const options={method,credentials:'include',headers:{'Content-Type':'application/json'}};if(method==='POST')options.body=JSON.stringify(payload());const response=await fetch(url,options);const result=await response.json();out.textContent=JSON.stringify(result,null,2);if(!response.ok)out.textContent='エラー: '+out.textContent}catch(err){out.textContent='通信エラー: '+err.message}});
}
