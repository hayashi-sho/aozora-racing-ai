// Research-only JRA v2.1 pipeline. No official feed, no autonomous betting or automatic deployment.
import {validateV20,evaluateV20,missedOutsiders} from './jra-v20.js';
import crypto from 'node:crypto';
const jraVenues=new Set(['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉']);
export function auditV21(races,license){
 if(typeof license!=='object'||license===null||license.commercialUseAuthorized!==true||typeof license.provider!=='string'||license.provider.trim().length<3||typeof license.termsReference!=='string'||license.termsReference.trim().length<4)throw Error('利用許諾の確認情報が必要');
 validateV20(races);
 for(const r of races){if(!jraVenues.has(r.venue))throw Error('JRA競馬場以外のデータ');if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date))throw Error('日付形式不正');if(!r.horses.every(h=>h.finish<=r.horses.length))throw Error('着順不正');}
 const sorted=[...races].sort((a,b)=>a.date.localeCompare(b.date)||a.raceId.localeCompare(b.raceId));
 const sha256=crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
 return {races:sorted,sha256,provider:license.provider,termsReference:license.termsReference,authorizationSelfAttested:true,verifiedByProvider:false,gate:'HOLD'};
}
export function temporalSplit(races){
 const dates=[...new Set(races.map(r=>r.date))].sort();
 if(dates.length<5)throw Error('5つ以上の異なる開催日が必要');
 const a=Math.max(1,Math.floor(dates.length*.6));const b=Math.max(a+1,Math.floor(dates.length*.8));
 const stages={train:races.filter(r=>r.date<dates[a]),validation:races.filter(r=>r.date>=dates[a]&&r.date<dates[b]),test:races.filter(r=>r.date>=dates[b])};
 if(Object.values(stages).some(x=>!x.length))throw Error('時系列分割に失敗');
 return {stages,boundaries:{validationStart:dates[a],testStart:dates[b]},note:'日付単位の分割。将来の結果を予測入力に混ぜないでください'};
}
export function evaluateResearchV21(races,options={}){
 const split=temporalSplit(races);const sections={};
 for(const [stage,data] of Object.entries(split.stages)){
  const report=evaluateV20(data,{ticketCounts:[12,24,48],...options});
  sections[stage]={races:data.length,outsider:report.outsider,bySurface:report.bySurface,seatTopK:report.overall.seatTopK,trifecta:report.overall.trifecta};
 }
 return {boundaries:split.boundaries,sections,missed:missedOutsiders(split.stages.test,options).slice(0,100),gate:'HOLD',researchOnly:true,probabilitiesValidated:false,summary:'モデル重みのバックテスト。実データで学習済みの予測モデルではありません'};
}
export function challengerReviewV21(oldRaces,newRaces){
 const ids=r=>r.map(x=>x.date+'|'+x.raceId).sort();validateV20(oldRaces);validateV20(newRaces);
 if(JSON.stringify(ids(oldRaces))!==JSON.stringify(ids(newRaces)))throw Error('比較するレースが一致しません');
 const old=evaluateResearchV21(oldRaces),fresh=evaluateResearchV21(newRaces);
 const o=old.sections.test,f=fresh.sections.test;
 const top=(x)=>x?.trifecta?.[24]?.hitRate;
 const improved=Number.isFinite(top(o))&&Number.isFinite(top(f))&&top(f)>top(o)&&Number.isFinite(f.outsider.recall)&&Number.isFinite(o.outsider.recall)&&f.outsider.recall>=o.outsider.recall;
 return {oldTest:o,newTest:f,improvedOnTest:improved,autoPromote:false,decision:'HOLD',requires:['より大きな未知の将来レースでの検証','配当を伴うROIの統計的不確実性確認','責任者の手動承認'],gate:'HOLD'};
}
export function freshnessGateV21(races){
 validateV20(races);const missing=[];
 for(const r of races){if(!r.horses.every(h=>Number.isFinite(h.odds)))missing.push(r.raceId+':オッズ不明');if(!r.source)missing.push(r.raceId+':出典不明');}
 return {gate:'HOLD',missing,reason:'公式提供元からの直前更新・取消・馬場・馬体重・オッズ整合性が未確認',hasRealTimeFeed:false};
}
