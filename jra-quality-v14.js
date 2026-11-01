import {createHash} from 'node:crypto';
export const JRA_VENUES=Object.freeze(['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉']);
const stamp=s=>Number.isFinite(Date.parse(s));
export function validateJraRace(r){
 const issues=[];if(!JRA_VENUES.includes(r.venue))issues.push('JRA中央10場以外');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')||!stamp(r.date))issues.push('開催日が不正');
 if(!Number.isInteger(r.race)||r.race<1||r.race>12)issues.push('レース番号は1〜12');
 if(!['芝','ダート','障害'].includes(r.surface))issues.push('競走種別が不正');
 if(!Number.isInteger(r.distance)||r.distance<800||r.distance>5000)issues.push('距離が想定範囲外');
 if(!Array.isArray(r.horses)||r.horses.length<3||r.horses.length>18)issues.push('出走馬数を要確認（3〜18頭）');
 const numbers=(r.horses||[]).map(h=>h.number);
 if(new Set(numbers).size!==numbers.length||numbers.some(n=>!Number.isInteger(n)||n<1||n>18))issues.push('馬番の重複・範囲外');
 const names=(r.horses||[]).map(h=>String(h.name||'').trim());
 if(names.some(x=>!x)||new Set(names).size!==names.length)issues.push('馬名の欠損・重複');
 if(!r.source?.name||!r.source?.observedAt||!stamp(r.source.observedAt))issues.push('提供元・取得日時が未確認');
 if(r.source?.observedAt&&stamp(r.source.observedAt)&&r.date&&Date.parse(r.source.observedAt)>Date.parse(r.date+'T23:59:59+09:00'))issues.push('予想時点より後の情報が混入した可能性');
 return {ok:issues.length===0,issues,horseCount:numbers.length,verifiedByProvider:false};
}
export function freezeResearchSnapshot(snapshot){
 const canonical=JSON.stringify(snapshot);return {algorithm:'SHA-256',digest:createHash('sha256').update(canonical).digest('hex'),canonical,at:new Date().toISOString(),tamperEvidentNotTimestamped:true};
}
export function verifyResearchSnapshot(x){return !!x&&createHash('sha256').update(x.canonical||'').digest('hex')===x.digest}
export function evaluateDarkHorseAtK(records,k=3,threshold=10){
 if(!Array.isArray(records)||!Number.isInteger(k)||k<1)throw Error('invalid inputs');
 let evaluated=0,flagged=0,hit=0;
 for(const race of records){if(!Array.isArray(race.candidates)||!Array.isArray(race.finish)||!race.finish.length)continue;
 evaluated++;const picks=race.candidates.filter(c=>c.odds>=threshold).sort((a,b)=>b.score-a.score).slice(0,k);
 if(picks.length){flagged++;if(picks.some(p=>race.finish.slice(0,3).includes(p.number)))hit++}
 }
 return {evaluatedRaces:evaluated,racesWithPicks:flagged,racesWithTop3Hit:hit,hitRate:flagged?hit/flagged:null,thresholdOdds:threshold,k,warning:'過去データの記述統計。未来の勝率・利益を保証しません'};
}
export function assessModelRevision(base,candidate){
 const missing=['sampleCount','brier','top3Recall'].filter(k=>!Number.isFinite(base?.[k])||!Number.isFinite(candidate?.[k]));
 const reasons=[];if(missing.length)reasons.push('比較指標不足: '+missing.join(','));
 else {if(base.sampleCount<100||candidate.sampleCount<100)reasons.push('比較レース数不足');if(candidate.brier>=base.brier)reasons.push('Brierスコア未改善');if(candidate.top3Recall<base.top3Recall)reasons.push('3着内捕捉率が低下')}
 return {status:'REVIEW_ONLY',passesNumericalScreen:reasons.length===0,reasons,autoDeploy:false,gate:'HOLD'};
}
