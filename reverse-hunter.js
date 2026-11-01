// REVERSE HUNTER v0.9: explainable heuristics, not validated probability forecasts.
const clamp=x=>Math.max(0,Math.min(100,Math.round(x)));
const number=x=>Number.isFinite(Number(x))?Number(x):0;
export function reverseHunter(request,options={}){
 const horses=request.horses||[], odds=horses.map(h=>number(h.odds)).filter(x=>x>0), median=odds.length?odds.sort((a,b)=>a-b)[Math.floor(odds.length/2)]:null;
 const pace=options.pace||'normal', focus=options.focus||'all', outcomes=[];
 for(const h of horses){
  const metrics=[h.paceScore,h.conditionScore,h.classFitScore,h.workoutScore,h.troubleRecoveryScore];
  const known=metrics.filter(x=>typeof x==='number'&&Number.isFinite(x));
  const base=known.length?known.reduce((a,b)=>a+b,0)/known.length:null;
  const gap=(base!==null&&h.odds)?clamp(base-Math.max(0,100-18*Math.log2(h.odds+1))):null;
  const issues=[];if(known.length<3)issues.push('独立した評価軸が3つ未満');if(!h.odds)issues.push('オッズ未入力');if(!h.form)issues.push('近走詳細が未入力');
  const changed=pace==='fast'?number(h.paceScore)-50:pace==='slow'?50-number(h.paceScore):0;
  const revised=base===null?null:clamp(base+changed*.15+(options.excludeFavorite&&h.odds&&median&&h.odds>median?4:0));
  const reason=[];if(number(h.troubleRecoveryScore)>=70)reason.push('前走不利解消の入力評価が高い');if(number(h.conditionScore)>=70)reason.push('条件適合の入力評価が高い');if(number(h.classFitScore)>=70)reason.push('クラス適合の入力評価が高い');
  outcomes.push({number:h.number,name:h.name,odds:h.odds??null,rawScore:base===null?null:clamp(base),revisedScore:revised,marketGap:gap,reverseCandidate:base!==null&&base>=65&&number(h.odds)>=8&&issues.length===0,reason,issues,minimumChange:base===null?null:{scorePointsUntil70:Math.max(0,70-clamp(base)),interpretation:'70点は仮設定の探索閾値で勝率ではありません'},recordSource:'利用者入力'});
 }
 return {race:`${request.date||''}:${request.venue||''}:${request.race||''}`,focus,pace,ranked:outcomes.sort((a,b)=>(b.revisedScore??-1)-(a.revisedScore??-1)),limitations:['入力値に基づくヒューリスティック。確率や的中率ではない','取消・馬場・時計・出走表を公式APIで検証していない','本分析は購入ゲートを解除しない'],purchaseGate:'HOLD'};
}
export function reliabilityAudit(request){const horses=request.horses||[];const missing=[];for(const flag of ['dataVerified','withdrawalsVerified','oddsVerified','weightVerified','trackBiasVerified'])if(!request[flag])missing.push(flag);return {horses:horses.length,missing,grade:missing.length?'UNVERIFIED':'SELF_REPORTED',verifiedByOfficialFeed:false};}
export function relationshipGraph(records){const edges=[];for(const r of records){const runners=(r.horses||[]).filter(h=>h.name);for(let i=0;i<runners.length;i++)for(let j=i+1;j<runners.length;j++)edges.push({a:runners[i].name,b:runners[j].name,race:r.race||''})}return {edges,warning:'同走履歴のリンクのみ。クラス強度や優劣の実証なし'};}
export function patternDiscovery(samples){const valid=samples.filter(s=>typeof s.hit==='boolean'&&Array.isArray(s.features));const counts=new Map();for(const s of valid)for(const f of new Set(s.features)){const n=counts.get(f)||{feature:f,total:0,hits:0};n.total++;if(s.hit)n.hits++;counts.set(f,n)}return [...counts.values()].map(n=>({...n,rate:n.hits/n.total,usable:n.total>=30})).sort((a,b)=>b.total-a.total)}
export function changes(before,after){return {old:before,new:after,changes:Object.keys(after).filter(k=>JSON.stringify(after[k])!==JSON.stringify(before[k])).map(k=>({field:k,previous:before[k]??null,current:after[k]??null}))}}
export function nextStartWatch(horse,conditions){return {horse,conditions,notification:'saved-watch-only',automaticRaceMatching:false}}
