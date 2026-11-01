// AOZORA v1.0 learning laboratory; time-split, auditable and deliberately NOT automatically deployable.
// Each row is a horse/race entry recorded before post time. outcomeFinish is supplied only as a training label.
export const FIELDS=['form','pace','distanceFit','groundFit','classFit','adversity','weightFit','drawFit'];
const clip=(n,l,h)=>Math.max(l,Math.min(h,n));
const sigmoid=x=>1/(1+Math.exp(-clip(x,-30,30)));
export function validateRows(rows){
 if(!Array.isArray(rows)||rows.length>15000)throw Error('invalid dataset size');
 const seen=new Set();
 return rows.map((r,i)=>{
   if(typeof r!=='object'||!r)throw Error('invalid row '+i);
   const {raceId,horseId,date,region,outcomeFinish,odds}=r;
   if(!/^[a-zA-Z0-9_:\-]{1,90}$/.test(raceId||'')|| !/^[a-zA-Z0-9_:\-]{1,90}$/.test(horseId||''))throw Error('invalid ids');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||Number.isNaN(Date.parse(date)))throw Error('invalid date');
   if(region!=='JRA')throw Error('JRA only');
   if(!Number.isInteger(outcomeFinish)||outcomeFinish<1||outcomeFinish>30)throw Error('invalid finish');
   if(!Number.isFinite(odds)||odds<1||odds>10000)throw Error('invalid odds');
   const key=region+':'+raceId+':'+horseId;if(seen.has(key))throw Error('duplicate runner');seen.add(key);
   const features={};for(const k of FIELDS){if(!Number.isFinite(r.features?.[k])||r.features[k]<0||r.features[k]>1)throw Error('missing/bad feature '+k);features[k]=r.features[k]}
   return {raceId,horseId,date,region,outcomeFinish,odds,features,source:String(r.source||'user supplied').slice(0,200),featureTime:String(r.featureTime||'unknown').slice(0,35)};
 });
}
function fit(train,epochs=180){let w=Array(FIELDS.length+1).fill(0);const reg=.015;
 for(let e=0;e<epochs;e++){let g=Array(w.length).fill(0);for(const r of train){const x=[1,...FIELDS.map(k=>r.features[k])],y=r.outcomeFinish===1?1:0,p=sigmoid(w.reduce((a,v,i)=>a+v*x[i],0));for(let i=0;i<w.length;i++)g[i]+=(p-y)*x[i]};let lr=.2/(1+e/100);for(let i=0;i<w.length;i++)w[i]-=lr*(g[i]/train.length+(i===0?0:reg*w[i]))}return w}
function rawProb(model,r){return sigmoid(model.reduce((s,v,i)=>s+v*(i===0?1:r.features[FIELDS[i-1]]),0))}
function score(rows,model){const p=rows.map(r=>rawProb(model,r)),y=rows.map(r=>Number(r.outcomeFinish===1));let brier=p.reduce((s,v,i)=>s+(v-y[i])**2,0)/p.length,logloss=p.reduce((s,v,i)=>s-y[i]*Math.log(clip(v,1e-9,1-1e-9))-(1-y[i])*Math.log(clip(1-v,1e-9,1-1e-9)),0)/p.length;
 const byRace=new Map();for(let i=0;i<rows.length;i++){const k=rows[i].raceId;if(!byRace.has(k))byRace.set(k,[]);byRace.get(k).push({p:p[i],r:rows[i]})}
 let hits=0;for(const items of byRace.values()){const best=items.sort((a,b)=>b.p-a.p)[0];if(best.r.outcomeFinish===1)hits++}
 let underdog=0,found=0;for(const items of byRace.values()){for(const {p,r} of items){if(r.odds>=10&&r.outcomeFinish<=3){underdog++;if(items.filter(x=>x.p>p).length<3)found++}}}
 return {runners:rows.length,races:byRace.size,brier:+brier.toFixed(6),logLoss:+logloss.toFixed(6),topOneHitRate:+(hits/byRace.size).toFixed(4),outsiderTopThreeRecall:underdog?+(found/underdog).toFixed(4):null,outsiderTopThreeCount:underdog}
}
export function trainAndBacktest(input,region){if(region!=='JRA')throw Error('JRA only');const rows=validateRows(input).filter(x=>x.region===region).sort((a,b)=>a.date.localeCompare(b.date)||a.raceId.localeCompare(b.raceId));
 const groups=new Map();for(const r of rows){const k=r.date+'|'+r.raceId;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
 const races=[...groups.values()];if(races.length<30)throw Error('at least 30 races in region required');
 const a=Math.floor(races.length*.6),b=Math.floor(races.length*.8);let training=races.slice(0,a).flat(),validation=races.slice(a,b).flat(),test=races.slice(b).flat();
 // Do not let a race appear in separate folds. Prevent duplicate dates crossing fold boundary.
 const foldEnd=training[training.length-1].date;
 validation=validation.filter(r=>r.date>foldEnd);
 const validationEnd=validation.at(-1)?.date;
 if(!validationEnd)throw Error('validation fold empty');
 test=test.filter(r=>r.date>validationEnd);
 if(!test.length)throw Error('test fold empty: need data across dates');
 // No test labels are used by model.fit or model selection.
 const model=fit(training);const result={version:'v1.0-logit-baseline',region,features:FIELDS,weights:model,counts:{trainingRaces:new Set(training.map(x=>x.raceId)).size,validationRaces:new Set(validation.map(x=>x.raceId)).size,testRaces:new Set(test.map(x=>x.raceId)).size},time:{trainingThrough:foldEnd,validationThrough:validationEnd,testThrough:test.at(-1).date},validation:score(validation,model),test:score(test,model),holdoutLocked:true,verifiedOfficially:false,calibrated:false,source:'user-supplied dataset',limitations:['Unverified supplied data','Not guaranteed or calibrated winning probabilities','Not automatically eligible for wagering','Past outcomes must not appear in features']};return result;
}
export function modelComparison(oldModel,newModel){if(!oldModel||!newModel||oldModel.region!==newModel.region)throw Error('same region required');return {region:newModel.region,deltaBrier:+(oldModel.test.brier-newModel.test.brier).toFixed(6),deltaHitRate:+(newModel.test.topOneHitRate-oldModel.test.topOneHitRate).toFixed(4),candidateOnly:true,promote:false,reason:'Approval needs independently verified prospective data, calibration and operational sign-off'};}
export function analyzeFailure(before,finish){const warnings=[];if(!before?.predictedTop?.includes(finish?.[0]))warnings.push('winner not included in pre-race first-place candidates');if(!before?.predictedTop?.some(x=>finish.slice(0,3).includes(x)))warnings.push('none of first-place candidates placed top 3');if(!before?.snapshotTime)warnings.push('missing pre-race timestamp');return {warnings,postHoc:false,automaticRuleChange:false};}
export function gateLabStatus(model,feedLicensed=false){return {status:'HOLD',reasons:[!feedLicensed?'commercially licensed race feed not connected':null,!model?'no validated trained model':null,model&&!model.calibrated?'model probabilities not calibrated':null,'prospective betting ROI not independently validated'].filter(Boolean)};}
