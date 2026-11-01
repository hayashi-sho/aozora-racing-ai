// JRA v2.0: out-of-sample evaluation only; no licensed feed / no purchase permission.
const ok=n=>typeof n==='number'&&Number.isFinite(n);
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const oddsGroups=['芝','ダート','障害'];
export function validateV20(races){
 if(!Array.isArray(races)||!races.length||races.length>1500)throw Error('1〜1500レースを入力してください');
 const ids=new Set();
 for(const r of races){
  if(r.region!=='JRA'||!oddsGroups.includes(r.surface)||!r.raceId||!r.date||!r.venue)throw Error('JRA・馬場種別・競馬場・識別子が必要');
  const key=r.date+'|'+r.raceId;if(ids.has(key))throw Error('レース重複');ids.add(key);
  if(!Number.isFinite(Date.parse(r.observedAt))||!Number.isFinite(Date.parse(r.postTime))||Date.parse(r.observedAt)>=Date.parse(r.postTime)||!r.source)throw Error('発走前情報の証跡が必要');
  if(!Array.isArray(r.horses)||r.horses.length<3||r.horses.length>18)throw Error('出走馬数不正');
  let sum=0;const numbers=new Set(),finishes=new Set();
  for(const h of r.horses){
   if(!Number.isInteger(h.number)||h.number<1||h.number>18||numbers.has(h.number)||!Number.isInteger(h.finish)||h.finish<1||h.finish>r.horses.length||finishes.has(h.finish)||!ok(h.odds)||h.odds<=1||!Array.isArray(h.seatWeights)||h.seatWeights.length!==3||h.seatWeights.some(x=>!ok(x)||x<=0||x>1))throw Error('馬番/着順/オッズ/着順重みが不正');
   numbers.add(h.number);finishes.add(h.finish);sum+=h.seatWeights[0];
  }
  if(Math.abs(sum-1)>0.005)throw Error('1着の予測重み合計が1ではありません');
 }
 return races;
}
// Sequential conditioned rankings: each remaining horse is renormalized independently at each seat.
// Seat weights are pre-race model outputs, NOT independently validated odds.
export function rankTrifectas(horses){
 const combos=[];
 const aTotal=horses.reduce((s,h)=>s+h.seatWeights[0],0);
 for(const a of horses)for(const b of horses)if(a.number!==b.number)for(const c of horses)if(c.number!==a.number&&c.number!==b.number){
  const bTotal=horses.reduce((s,h)=>s+(h.number===a.number?0:h.seatWeights[1]),0);
  const cTotal=horses.reduce((s,h)=>s+(h.number===a.number||h.number===b.number?0:h.seatWeights[2]),0);
  const probability=(a.seatWeights[0]/aTotal)*(b.seatWeights[1]/bTotal)*(c.seatWeights[2]/cTotal);
  combos.push({selection:`${a.number}-${b.number}-${c.number}`,probability});
 }
 combos.sort((a,b)=>b.probability-a.probability||a.selection.localeCompare(b.selection));return combos;
}
const hits=(list,truth)=>list.some(x=>x.selection===truth);
export function evaluateV20(races,{topK=3,outsiderMinOdds=10,ticketCounts=[12,24,48],unitStake=100}={}){
 validateV20(races);
 if(!Number.isInteger(topK)||topK<1||topK>18||!ok(outsiderMinOdds)||outsiderMinOdds<2||!Array.isArray(ticketCounts)||ticketCounts.some(n=>!Number.isInteger(n)||n<1||n>250)||!Number.isInteger(unitStake)||unitStake<100)throw Error('設定が不正');
 const detail=[];const group={};let denominator=0,numerator=0,selected=0,selectedHit=0;
 for(const r of races){
  const sorted=r.horses.slice().sort((a,b)=>b.seatWeights[0]-a.seatWeights[0]);
  const found=r.horses.filter(h=>h.odds>=outsiderMinOdds&&h.finish<=3);
  const picks=sorted.slice(0,topK).filter(h=>h.odds>=outsiderMinOdds);
  const recovered=found.filter(h=>picks.some(x=>x.number===h.number)).length;
  denominator+=found.length;numerator+=recovered;selected+=picks.length;selectedHit+=picks.filter(h=>h.finish<=3).length;
  const ranking=rankTrifectas(r.horses),truth=r.horses.slice().sort((a,b)=>a.finish-b.finish).slice(0,3).map(h=>h.number).join('-');
  const seats=[0,1,2].map(i=>r.horses.slice().sort((a,b)=>b.seatWeights[i]-a.seatWeights[i]).slice(0,topK).some(h=>h.finish===i+1));
  const tickets={};for(const n of ticketCounts){const selection=ranking.slice(0,n);const won=hits(selection,truth);const payout=ok(r.trifectaPayoutYen)&&r.trifectaPayoutYen>=0?r.trifectaPayoutYen:null;tickets[n]={hit:won,stake:selection.length*unitStake,payout:payout===null?null:won?payout:0};}
  const record={raceId:r.raceId,date:r.date,surface:r.surface,venue:r.venue,truth,rankOfActual:ranking.findIndex(x=>x.selection===truth)+1,seatCoverage:seats,foundOutsiders:found.length,recoveredOutsiders:recovered,selectedOutsiders:picks.length,tickets};detail.push(record);(group[r.surface]??=[]).push(record);
 }
 const summarize=rows=>{const n=rows.length;const tickets={};for(const k of ticketCounts){const wins=rows.filter(x=>x.tickets[k].hit).length;const complete=rows.every(x=>x.tickets[k].payout!==null);tickets[k]={races:n,hitRate:n?wins/n:null,hits:wins,roi:complete?100*rows.reduce((s,x)=>s+x.tickets[k].payout,0)/rows.reduce((s,x)=>s+x.tickets[k].stake,0):null,payoutCoverageComplete:complete};}return {races:n,seatTopK:[0,1,2].map(i=>rows.filter(x=>x.seatCoverage[i]).length/n),trifecta:tickets};};
 return {races:races.length,outsider:{definition:`発走前単勝オッズ${outsiderMinOdds}倍以上かつ3着内`,captured:numerator,eligible:denominator,recall:denominator?numerator/denominator:null,precision:selected?selectedHit/selected:null,selectionCount:selected},overall:summarize(detail),bySurface:Object.fromEntries(Object.entries(group).map(([k,v])=>[k,summarize(v)])),detail,gate:'HOLD',limitations:['公式JRAデータは自動取得しません','確率は入力モデルの重みから算出した暫定値です','点数別命中率は過去結果による研究指標です','配当が欠落した場合はROIを出しません']};
}
export function missedOutsiders(races,{topK=3,minOdds=10}={}){validateV20(races);return races.flatMap(r=>{const top=r.horses.slice().sort((a,b)=>b.seatWeights[0]-a.seatWeights[0]).slice(0,topK);return r.horses.filter(h=>h.finish<=3&&h.odds>=minOdds&&!top.some(x=>x.number===h.number)).map(h=>({raceId:r.raceId,date:r.date,horseNumber:h.number,finish:h.finish,odds:h.odds,note:'未捕捉。理由の特定には発走前情報・展開分析が必要。結果から特徴量を捏造しない'}))})}
export function compareV20(a,b,options={}){validateV20(a);validateV20(b);const keys=r=>r.map(x=>x.date+'|'+x.raceId).sort();if(JSON.stringify(keys(a))!==JSON.stringify(keys(b)))throw Error('同一レース集合のみ比較できます');const baseline=evaluateV20(a,options),candidate=evaluateV20(b,options);return {baseline:baseline.overall,candidate:candidate.overall,outsiderOld:baseline.outsider,outsiderNew:candidate.outsider,autoPromote:false,requiresForwardTest:true,note:'同じ事後検証集合の比較だけで自動昇格は禁止'};}
