// v0.8: transparent, uncalibrated explanatory heuristics; not calibrated predictions.
const clamp=x=>Math.max(0,Math.min(100,Number.isFinite(x)?x:0));
const mean=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:null;
const hp=h=>[h.paceScore,h.conditionScore,h.classFitScore,h.workoutScore,h.troubleRecoveryScore].filter(Number.isFinite);
export function assessDarkHorses(req,scenarios=[]){
 const horses=(req.horses||[]).map(h=>{
  const scores=hp(h),evidence=scores.length;
  const score=evidence?Math.round(mean(scores)):null;
  const odds=Number(h.odds),market=odds>0?clamp(100-80/Math.sqrt(odds)):null;
  const gap=score!==null&&market!==null?Math.round(score-market):null;
  const revival=(Number(h.troubleRecoveryScore)||0)>=70&&evidence>=3;
  const fit=(Number(h.conditionScore)||0)>=70&&(Number(h.paceScore)||0)>=65;
  const conditionalWin=evidence>=4&&(Number(h.paceScore)||0)>=75&&(Number(h.classFitScore)||0)>=70;
  return {number:h.number,name:h.name,odds:odds>0?odds:null,score,coverage:evidence+'/5',dataCoverage:evidence/5,marketMismatch:gap,revivalCandidate:revival,conditionMatch:fit,firstPlaceScenarioCandidate:conditionalWin,
  evidence:[revival?'前走不利解消スコアの入力あり':null,fit?'条件＋展開の入力スコアが高い':null,conditionalWin?'1着への仮説を検討できる入力条件':null].filter(Boolean),
  limitations:evidence<5?'入力データが不足。スコアの信頼性は未検証':'手入力スコア由来。市場比較モデルは未校正'};
 });
 const ranked=[...horses].sort((a,b)=>(b.marketMismatch??-999)-(a.marketMismatch??-999));
 return {engine:'v08 uncalibrated evidence heuristic',horses,ranked,alerts:ranked.filter(h=>h.marketMismatch!==null&&h.marketMismatch>=15&&h.dataCoverage>=.6).map(h=>({number:h.number,message:'過小評価の可能性を調べるための参考通知',score:h.marketMismatch})),noMarketEdgeProof:true};
}
export function collapseAndChains(assessment,scenario={pace:'normal',favoriteFails:false}){
 const horses=assessment.horses;
 const favorites=[...horses].filter(h=>h.odds!==null).sort((a,b)=>a.odds-b.odds).slice(0,2);
 const challengers=horses.filter(h=>!favorites.some(f=>f.number===h.number)&&h.score!==null);
 const pace=scenario.pace||'normal';
 const lift=challengers.map(h=>({number:h.number,name:h.name,conditionalScore:clamp(h.score+(pace==='fast'?7:pace==='slow'?-4:0)+(scenario.favoriteFails?6:0)),reason:scenario.favoriteFails?'人気馬失速の仮説を置いた参考変化':'選択したペースでの参考変化'})).sort((a,b)=>b.conditionalScore-a.conditionalScore);
 const chains=[];
 for(let i=0;i<lift.length;i++)for(let j=i+1;j<lift.length;j++)if(lift[i].conditionalScore>=60&&lift[j].conditionalScore>=60)chains.push({numbers:[lift[i].number,lift[j].number],score:Math.round((lift[i].conditionalScore+lift[j].conditionalScore)/2),note:'同時浮上の仮説。相関・的中率は未校正'});
 return {favorites:favorites.map(h=>h.number),pace,assumptionFavoriteFails:!!scenario.favoriteFails,lift,chains:chains.sort((a,b)=>b.score-a.score).slice(0,10),verified:false};
}
export function autopsyDarkHorse(assessment,finish){
 const pos=new Map(finish.map((n,i)=>[Number(n),i+1]));
 return assessment.horses.filter(h=>h.score!==null&&h.score>=65).map(h=>({number:h.number,name:h.name,predictedScore:h.score,actualPosition:pos.get(h.number)||null,followUp:pos.has(h.number)&&pos.get(h.number)<=3?'着順上位：根拠別の寄与は未確定':'不発または着外：展開・条件・データ精度を再点検',causalityProven:false}));
}
export function noticeCandidates(rows,threshold=15){return rows.filter(x=>x.marketMismatch!==null&&x.marketMismatch>=threshold&&x.dataCoverage>=.6).map(x=>({number:x.number,name:x.name,why:'市場乖離の参考条件に該当',referenceOnly:true}));}
