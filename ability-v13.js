// v1.3 research-only ability pipeline; separate from production purchase decisions.
import {validateRows, trainAndBacktest, modelComparison, gateLabStatus, FIELDS} from './learning-v10.js';
import {createHash} from 'node:crypto';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const datasetDigest=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
export function auditDataset(raw){
 const rows=validateRows(raw); const issues=[];const groups=new Map();
 for(const r of rows){const k=`${r.region}|${r.date}|${r.raceId}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);
 if(r.featureTime==='unknown')issues.push({race:r.raceId,horse:r.horseId,issue:'feature timestamp missing'});
 else if(!Number.isFinite(Date.parse(r.featureTime)) || Date.parse(r.featureTime)>Date.parse(r.date+'T23:59:59Z'))issues.push({race:r.raceId,horse:r.horseId,issue:'feature timestamp invalid or after race date'});
 }
 for(const [key,g] of groups){if(g.filter(r=>r.outcomeFinish===1).length!==1)issues.push({race:key,issue:'exactly one winner required'});
 const places=new Set(g.map(r=>r.outcomeFinish));if(places.size!==g.length)issues.push({race:key,issue:'duplicate finishing rank'});
 if(g.length<3)issues.push({race:key,issue:'insufficient runners'});}
 return {rows,issues,ok:issues.length===0,sha256:datasetDigest(rows),counts:{races:groups.size,runners:rows.length,JRA:rows.filter(r=>r.region==='JRA').length,LOCAL:rows.filter(r=>r.region==='LOCAL').length}};
}
function normalizeRace(rows,weights){
 const logits=rows.map(r=>clamp(weights[0]+FIELDS.reduce((s,k,i)=>s+weights[i+1]*r.features[k],0),-25,25));
 const ex=logits.map(Math.exp),sum=ex.reduce((a,b)=>a+b,0);return ex.map(x=>x/sum);
}
export function rankRace(rows,model){
 if(!rows.length||!model||model.weights?.length!==FIELDS.length+1)throw Error('missing model or race');
 if(rows.some(r=>r.region!==model.region))throw Error('region mismatch');
 const probs=normalizeRace(rows,model.weights);
 return rows.map((r,i)=>({horseId:r.horseId,raceId:r.raceId,estimatedShare:probs[i],odds:r.odds,valueProxy:probs[i]*r.odds,underdog:r.odds>=10}))
 .sort((a,b)=>b.estimatedShare-a.estimatedShare);
}
export function exactaTrifectaCandidates(ranking,maxPoints=24,stake=100){
 if(!Number.isInteger(maxPoints)||maxPoints<1||maxPoints>500||!Number.isInteger(stake)||stake<100||stake%100)throw Error('invalid limit');
 const top=ranking.slice(0,Math.min(ranking.length,12));const list=[];
 for(const a of top)for(const b of top)for(const c of top){if(new Set([a.horseId,b.horseId,c.horseId]).size!==3)continue;
 const z=a.estimatedShare*b.estimatedShare/Math.max(.001,1-a.estimatedShare)*c.estimatedShare/Math.max(.001,1-a.estimatedShare-b.estimatedShare);
 list.push({selection:[a.horseId,b.horseId,c.horseId],modelScore:z});}
 list.sort((a,b)=>b.modelScore-a.modelScore);const chosen=list.slice(0,maxPoints).map(x=>({...x,stake}));
 return {tickets:chosen,totalStake:chosen.length*stake,model:'heuristic sequential ranking, UNCALIBRATED',purchaseAllowed:false};
}
export function benchmarkRegions(raw){
 if(raw.some(r=>r.region!=='JRA'))return {status:'REJECTED',issues:['JRA専用: 地方競馬データは利用不可']};
 const checked=auditDataset(raw);if(!checked.ok)return {status:'REJECTED',issues:checked.issues};
 const models={};for(const region of ['JRA']){
  try{models[region]=trainAndBacktest(checked.rows,region)}catch(e){models[region]={error:e.message}} }
 return {status:'RESEARCH_ONLY',digest:checked.sha256,models,gate:{status:'HOLD',reasons:['Not officially verified','Not prospectively calibrated','Not economically validated']}};
}
export function compareAndStage(previous,candidate){
 if(!candidate?.test||!previous?.test)return {promote:false,status:'HOLD',reason:'Missing independent evaluations'};
 const result=modelComparison(previous,candidate);
 const improved=result.deltaBrier>0&&result.deltaHitRate>=0;
 return {...result,improvedOnRecordedHoldout:improved,status:'REVIEW_REQUIRED',promote:false,reason:'Manual approval requires a newly untouched prospective set and data provenance audit'};
}
export function analyzeOutcome(prediction,finish){
 if(!prediction?.snapshotTime||!Array.isArray(finish)||finish.length<3)return {status:'INSUFFICIENT_EVIDENCE',causes:[]};
 const top=(prediction.ranked||[]).slice(0,3).map(x=>x.horseId);
 const winner=finish[0],causes=[];
 if(!top.includes(winner))causes.push('winner absent from top-three shortlist');
 if(prediction.tickets?.length&&!prediction.tickets.some(t=>t.selection?.join('|')===finish.slice(0,3).join('|')))causes.push('exact order not in ticket set');
 return {status:'REVIEW_ONLY',causes,doNotTrainWithoutAudit:true};
}
export function releaseReadiness({license=false,sourceVerified=false,model=null,prospectiveRaces=0,profitValidated=false}={}){
 const reasons=[];if(!license)reasons.push('commercial data license missing');if(!sourceVerified)reasons.push('source provenance not verified');
 if(!model?.calibrated)reasons.push('prediction probabilities not calibrated');
 if(prospectiveRaces<100)reasons.push('insufficient prospective races (<100)');
 if(!profitValidated)reasons.push('independent return/risk evaluation missing');
 return {status:reasons.length?'HOLD':'ELIGIBLE_FOR_HUMAN_REVIEW',reasons,autoPromote:false,autoPurchase:false};
}
export function scheduleResearch({lastTrainingDate,nowDate,minimumDays=30}){
 const elapsed=(Date.parse(nowDate)-Date.parse(lastTrainingDate))/86400000;
 return {reviewDue:Number.isFinite(elapsed)&&elapsed>=minimumDays,action:'manual data audit and shadow comparison only',automaticDeployment:false};
}
