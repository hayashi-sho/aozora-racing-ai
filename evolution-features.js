// v0.6: deterministic, transparent experimental functions. NOT calibrated predictive models.
export function oddsAlert(points){
 const a=[...points].sort((x,y)=>x.at.localeCompare(y.at));const events=[];
 for(let i=1;i<a.length;i++){const p=a[i-1],q=a[i];if(p.odds<=0||q.odds<=0)continue;const move=(q.odds-p.odds)/p.odds*100;if(Math.abs(move)>=20)events.push({from:p.at,to:q.at,previous:p.odds,current:q.odds,changePercent:+move.toFixed(1),meaning:move<0?'オッズ低下':'オッズ上昇'});}
 return {events,observations:a.length,confidence:'market movement only',warning:'異常値は的中根拠・内部情報を意味しません。手入力値のみを分析。'};
}
export function moneyGuard({monthlyLimit,lossLimit,dailyLimit,spendMonth,netMonth,spendDay,proposal}){
 const reasons=[];if(monthlyLimit>=0&&spendMonth+proposal>monthlyLimit)reasons.push('月間購入予算上限');if(dailyLimit>=0&&spendDay+proposal>dailyLimit)reasons.push('1日購入予算上限');if(lossLimit>=0&&netMonth-proposal < -lossLimit)reasons.push('月間最大損失上限（未払戻を保守的に計算）');return {status:reasons.length?'STOP':'WITHIN_LIMITS',reasons,remainingMonthly:Math.max(0,monthlyLimit-spendMonth),note:'資金上限判定は購入を推奨・許可するものではありません'};
}
export function counterArgument({prediction,sourceIssues=[]}){
 const argumentsFound=[];
 if(!prediction?.marks?.length)argumentsFound.push('全頭の根拠付き評価がありません');
 if(!prediction?.paceScenarios?.length)argumentsFound.push('展開分岐が記載されていません');
 if(!prediction?.dataGaps?.length)argumentsFound.push('不足データの記録なし：完全性は保証されません');
 if(!prediction?.risks?.length)argumentsFound.push('反証・リスクの記載がありません');
 argumentsFound.push(...sourceIssues.map(x=>'情報不足: '+String(x).slice(0,160)));
 return {arguments:argumentsFound,accepted:argumentsFound.length===0,action:argumentsFound.length?'追加の反証・元データ照合が必要':'追加の形式的不備は検出されず（精度保証なし）',method:'rule-based audit, not independent AI'};
}
export function promotionAudit(marks){
 return (marks||[]).map(x=>({number:x.number,name:x.name,from:x.mark||'未設定',headCaseRequired:true,secondCaseRequired:true,thirdCaseRequired:true,review:'1着・2着・3着の独立根拠が保存されるまで昇格は確定しません'}));
}
export function scenario3d(horses,pace='normal'){
 const factor={normal:1,fast:1.2,slow:.8,late:1.05}[pace]||1;
 return {pace,frames:[0,0.25,0.5,0.75,1].map(t=>({t,positions:horses.slice(0,24).map((h,i)=>{let style=String(h.style||'');let early=/逃|先/.test(style)?-.15:/追|差/.test(style)?.13:0;let spread=(i/(Math.max(1,horses.length-1))-.5)*.09;return {number:h.number,name:h.name,x:Math.max(.02,Math.min(.98,t+spread+early*(1-t)*factor)),lane:i%8};})})),notice:'演出用の仮定的3D隊列。実際の位置・速度・着順・騎乗を表すものではありません'};
}
export function evolutionCompare(oldRows,newRows){
 const summarize=(a)=>{const n=a.length,hit=a.filter(x=>x.hit===true).length,stake=a.reduce((s,x)=>s+(x.stake||0),0),payout=a.reduce((s,x)=>s+(x.payout||0),0);return {n,hit,hitRate:n?hit/n:null,roi:stake?payout/stake:null}};
 const old=summarize(oldRows),next=summarize(newRows);return {old,new:next,comparable:old.n>=30&&next.n>=30&&old.n===next.n,warning:'同一レース・同一時点データで前向きに比較しない限り優越性は認定しません'};
}
export function evidenceTrail(items){return items.map((x,i)=>({step:i+1,time:x.time||null,source:x.source||'未指定',horse:x.horse||'',reason:x.reason||'',before:x.before??null,after:x.after??null}));}
