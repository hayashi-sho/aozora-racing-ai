// Offline evaluation of PRE-RACE snapshots against results, not a prediction engine.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const average=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
export function measureRaces(races,{outsiderMinOdds=10,outsiderRank=3,topK=3,ticketCounts=[12,24,48],unitStake=100}={}){
 if(!Array.isArray(races)||!races.length||races.length>2000)throw Error('1〜2000レースを入力');
 if(!finite(outsiderMinOdds)||outsiderMinOdds<2||!Number.isInteger(outsiderRank)||outsiderRank<1||outsiderRank>18||!Number.isInteger(topK)||topK<1||topK>18||!Array.isArray(ticketCounts)||!ticketCounts.length||ticketCounts.some(n=>!Number.isInteger(n)||n<1||n>1000))throw Error('評価設定が不正');
 let outsiderFound=0,outsiderTotal=0,outsiderSelections=0,firstCovered=0,secondCovered=0,thirdCovered=0, complete=0,logloss=[],brier=[],perRace=[];
 const keys=new Set();let absentPayout=0;
 for(const race of races){
  const {raceId,date,postTime,observedAt,source,region='JRA',horses}=race;
  if(region!=='JRA'||typeof raceId!=='string'||!raceId.trim()||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(horses)||horses.length<3||horses.length>18)throw Error('JRAレース識別子・出走頭数が不正');
  const key=`${date}|${raceId}`;if(keys.has(key))throw Error('レース重複');keys.add(key);
  if(!source||!observedAt||!postTime||!Number.isFinite(Date.parse(observedAt))||!Number.isFinite(Date.parse(postTime))||Date.parse(observedAt)>=Date.parse(postTime))throw Error('情報源・発走前時刻の証跡不足');
  const nos=new Set(),finishes=new Set();let pSum=0;
  for(const h of horses){if(!Number.isInteger(h.number)||h.number<1||h.number>18||nos.has(h.number)||!Number.isInteger(h.finish)||h.finish<1||h.finish>horses.length||finishes.has(h.finish)||!finite(h.winProbability)||h.winProbability<=0||h.winProbability>=1||!finite(h.odds)||h.odds<=1)throw Error('馬番・着順・予測確率・発走前オッズに不正');nos.add(h.number);finishes.add(h.finish);pSum+=h.winProbability}
  if(Math.abs(pSum-1)>0.005)throw Error('勝率の合計は1にする');
  const sorted=horses.slice().sort((a,b)=>b.winProbability-a.winProbability||a.number-b.number);
  const byFinish=horses.slice().sort((a,b)=>a.finish-b.finish);
  const outsiders=horses.filter(h=>h.odds>=outsiderMinOdds&&h.finish<=3);
  const ranked=sorted.slice(0,topK);
  outsiderFound+=outsiders.filter(h=>ranked.some(x=>x.number===h.number)).length;
  outsiderTotal+=outsiders.length;
  outsiderSelections+=ranked.filter(h=>h.odds>=outsiderMinOdds).length;
  const seatLists=[[],[],[]];
  for(const h of horses){const seats=h.seatProbabilities;if(seats!==undefined){if(!Array.isArray(seats)||seats.length!==3||seats.some(x=>!finite(x)||x<0||x>1))throw Error('着順別確率不正');for(let j=0;j<3;j++)seatLists[j].push([h.number,seats[j]])}}
  const seatChoices=seatLists.every(x=>x.length===horses.length)?seatLists.map(x=>x.sort((a,b)=>b[1]-a[1]).slice(0,topK).map(x=>x[0])):null;
  if(seatChoices){firstCovered+=seatChoices[0].includes(byFinish[0].number)?1:0;secondCovered+=seatChoices[1].includes(byFinish[1].number)?1:0;thirdCovered+=seatChoices[2].includes(byFinish[2].number)?1:0;complete++}
  const winner=byFinish[0];logloss.push(-Math.log(winner.winProbability));brier.push(horses.reduce((s,h)=>s+(h.winProbability-(h.finish===1?1:0))**2,0));
  // Deterministic Plackett-Luce joint ranking with NO lookahead, a transparent baseline only.
  const combos=[];
  for(const a of sorted)for(const b of sorted)if(b.number!==a.number)for(const c of sorted)if(c.number!==a.number&&c.number!==b.number){const p=a.winProbability*b.winProbability/(1-a.winProbability)*c.winProbability/(1-a.winProbability-b.winProbability);combos.push({selection:`${a.number}-${b.number}-${c.number}`,p})}
  combos.sort((a,b)=>b.p-a.p||a.selection.localeCompare(b.selection));
  const actual=byFinish.slice(0,3).map(h=>h.number).join('-');
  const results={};for(const k of ticketCounts){const selected=combos.slice(0,k);const hit=selected.some(x=>x.selection===actual);const payout=race.trifectaPayoutYen;const payoutKnown=finite(payout)&&payout>=0;if(!payoutKnown)absentPayout++;results[k]={hit,points:selected.length,stake:selected.length*unitStake,payoutYen:payoutKnown&&hit?payout:payoutKnown?0:null,roiPct:payoutKnown?100*(hit?payout:0)/(selected.length*unitStake):null}}
  perRace.push({raceId,date,rankOfActualTrifecta:combos.findIndex(x=>x.selection===actual)+1,outsider3rdOrBetter:outsiders.length,outsiderCaptured:outsiders.filter(h=>ranked.some(x=>x.number===h.number)).length,tickets:results,seatCoverage:seatChoices?seatChoices.map((s,i)=>s.includes(byFinish[i].number)):null});
 }
 const byTickets={};for(const k of ticketCounts){const valid=perRace.filter(r=>r.tickets[k].roiPct!==null);const wins=perRace.filter(r=>r.tickets[k].hit).length;const stake=valid.reduce((s,r)=>s+r.tickets[k].stake,0),payout=valid.reduce((s,r)=>s+r.tickets[k].payoutYen,0);byTickets[k]={races:races.length,hitRaces:wins,hitRate:wins/races.length,roiPct:valid.length===races.length&&stake?100*payout/stake:null,completePayoutCoverage:valid.length===races.length,topKTickets:k};}
 return {races:races.length,outsiderDefinition:{minimumPreRaceOdds:outsiderMinOdds,topFinish:3},outsiderTopKRecall:outsiderTotal?outsiderFound/outsiderTotal:null,outsiderPrecision:outsiderSelections?outsiderFound/outsiderSelections:null,outsiderExamples:outsiderTotal,seatCoverage:complete?{races:complete,first:firstCovered/complete,second:secondCovered/complete,third:thirdCovered/complete}:null,winLogLoss:average(logloss),multiclassBrier:average(brier),trifectaByPoints:byTickets,perRace,limitations:['予想時点の独立データのみ使用','Plackett–Luceは勝率のみから生成する参考順位モデル','統計的有意性・実戦的な収益性は別途評価が必要','公式レース情報を自動取得していません']};
}
export function compareModels(oldRaces,newRaces,opts={}){const old=measureRaces(oldRaces,opts),next=measureRaces(newRaces,opts);const a=old.perRace.map(r=>r.date+'|'+r.raceId).sort(),b=next.perRace.map(r=>r.date+'|'+r.raceId).sort();if(JSON.stringify(a)!==JSON.stringify(b))throw Error('比較するレース集合が一致しない');return {baseline:{outsiderTopKRecall:old.outsiderTopKRecall,winLogLoss:old.winLogLoss,trifectaByPoints:old.trifectaByPoints},candidate:{outsiderTopKRecall:next.outsiderTopKRecall,winLogLoss:next.winLogLoss,trifectaByPoints:next.trifectaByPoints},autoPromote:false,note:'同一レース集合の比較のみ。独立した将来データで改善を確認するまで本番採用しない'};}
