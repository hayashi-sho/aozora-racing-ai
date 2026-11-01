// Transparent, deterministic experimental feature research engine. Not calibrated.
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,x));
const number=(v,d=50)=>Number.isFinite(Number(v))&&v!==undefined&&v!==null&&v!==''?clamp(Number(v)):d;
const styles=['escape','front','stalk','close','late'];
const styleOf=h=>{const s=String(h.style||'').toLowerCase();return /逃|escape/.test(s)?'escape':/先|front/.test(s)?'front':/差|close/.test(s)?'close':/追|late/.test(s)?'late':'stalk'};
export function awakeningRadar(horses){return horses.map(h=>{
 const attrs={pace:number(h.paceScore),condition:number(h.conditionScore),classFit:number(h.classFitScore),workout:number(h.workoutScore),troubleRecovery:number(h.troubleRecoveryScore)};
 const complete=Object.keys(attrs).filter(k=>h[k]!==undefined&&h[k]!==null&&h[k]!=='');
 const score=Math.round((attrs.pace*.25+attrs.condition*.25+attrs.classFit*.2+attrs.workout*.15+attrs.troubleRecovery*.15)*10)/10;
 return {number:h.number,name:h.name,score,style:styleOf(h),evidenceCount:complete.length,missing:Object.keys(attrs).filter(k=>!complete.includes(k)),reasons:complete.filter(k=>attrs[k]>=70).map(k=>`${k}: ${attrs[k]} (ユーザー入力)`),status:complete.length<3?'INSUFFICIENT_DATA':'EXPERIMENTAL',note:'入力指標からの試験スコア。確率ではありません'};
 }).sort((a,b)=>b.score-a.score||a.number-b.number)};
export function parallelWorlds(horses,seed=17,runs=1500){
 if(!Number.isInteger(runs)||runs<100||runs>100000)throw Error('invalid runs');
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296};
 const worlds=[{id:'baseline',label:'標準',pressure:0,closer:0},{id:'speed_duel',label:'先行争い激化',pressure:-.35,closer:.3},{id:'slow_pace',label:'スロー残り',pressure:.32,closer:-.25},{id:'favorite_break',label:'人気馬の出遅れ',pressure:0,closer:0}];
 return worlds.map(world=>{const counts=Object.fromEntries(horses.map(h=>[h.number,0]));
 for(let i=0;i<runs;i++){const a=horses.map(h=>{const style=styleOf(h);let modifier=style==='escape'||style==='front'?world.pressure:style==='close'||style==='late'?world.closer:0;
 if(world.id==='favorite_break' && h.odds===Math.min(...horses.filter(x=>x.odds>0).map(x=>x.odds)))modifier-=.85;
 const w=Math.max(.001,(h.odds>0?1/h.odds:1)*Math.exp(modifier));return {number:h.number,w}});
 let total=a.reduce((sum,x)=>sum+x.w,0),r=random()*total;let winner=a[a.length-1].number;for(const x of a){r-=x.w;if(r<0){winner=x.number;break}}counts[winner]++;
 }
 return {id:world.id,label:world.label,runs,seed,counts,shares:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,Math.round(v/runs*1000)/10])),note:'仮説的な重み変更による参考値。実際の展開予測確率ではありません'};
 })};
export function promotionEngine(horses,radar,worlds){const groups={first:[],second:[],third:[]};for(const r of radar){const h=horses.find(x=>x.number===r.number);const positive=worlds.filter(w=>w.shares[r.number]>=Math.max(...Object.values(w.shares))*.75).map(w=>w.id);
 const base={number:r.number,name:r.name,score:r.score,scenarios:positive,evidenceCount:r.evidenceCount};
 if(r.evidenceCount>=3){if(r.score>=75)groups.first.push({...base,reason:'入力指標の高評価・1着昇格を反証対象'});if(r.score>=60)groups.second.push({...base,reason:'2着独立審査'});groups.third.push({...base,reason:'3着穴保護審査'});}
 }return {groups,policy:'A頭解放・2着昇格・3着穴保護の試験ルール。旧プラグインの正式再現ではありません',noEvidence:radar.filter(x=>x.evidenceCount<3).map(x=>x.number)}};
export function myHorseDebate(favorite,horses,radar,worlds){const mine=horses.find(h=>String(h.number)===String(favorite)||h.name===favorite);if(!mine)return {status:'NOT_FOUND',reason:'出走馬に指定馬が存在しません'};
 const r=radar.find(x=>x.number===mine.number);const winner=radar[0];return {status:r.evidenceCount<3?'INSUFFICIENT_DATA':'EXPERIMENTAL',horse:{number:mine.number,name:mine.name},awakeningScore:r.score,rank:radar.findIndex(x=>x.number===mine.number)+1,aiTop:{number:winner.number,name:winner.name,score:winner.score},advantages:r.reasons,risks:r.missing.map(x=>`${x}の根拠未入力`),bestScenario:worlds.slice().sort((a,b)=>b.shares[mine.number]-a.shares[mine.number])[0]?.label,conclusion:'個別評価は試験モデルによる比較。好走保証ではありません'};}
export function purchaseStopper({input,radar,promotion,worlds}){const blocks=[];
 if(input.horses.length<3)blocks.push('3頭未満');
 if(input.horses.some(h=>!h.odds||h.odds<=0))blocks.push('オッズが全頭揃っていない');
 if(radar.some(r=>r.evidenceCount<3))blocks.push('覚醒評価の根拠が3項目未満の馬がいる');
 if(!input.dataVerified)blocks.push('出走表未検証');if(!input.withdrawalsVerified)blocks.push('取消未確認');if(!input.trackBiasVerified)blocks.push('当日馬場未確認');if(!input.oddsVerified)blocks.push('当日オッズ未確認');if(!input.weightVerified)blocks.push('馬体重未確認');
 if(!promotion.groups.first.length)blocks.push('1着候補の根拠不足');
 blocks.push('予想確率の校正・第三者検証未了');blocks.push('購入に使える正規データ・実運用モデル未認証');
 return {status:'HOLD',blockers:blocks,referencePredictionsAllowed:true,auditedScenarioCount:worlds.length,note:'購入許可は出しません。チェックボックス操作だけでは解除できません'};}
export function learningFromLedger(rows){const official=rows.filter(r=>r.kind==='official');const groups={};for(const r of official){const key=`${r.venue||'不明'} / ${r.race||'不明'}`;if(!groups[key])groups[key]={label:key,races:0,stake:0,payout:0};const g=groups[key];g.races++;g.stake+=r.stake;g.payout+=r.payout}
 const segments=Object.values(groups).map(g=>({...g,profit:g.payout-g.stake,roi:g.stake?Math.round(g.payout/g.stake*10000)/100:null,warning:g.races<20?'標本不足（20件未満）':'過去傾向のみ'})).sort((a,b)=>a.profit-b.profit);return {sample:official.length,totalStake:official.reduce((s,x)=>s+x.stake,0),totalPayout:official.reduce((s,x)=>s+x.payout,0),segments,advice:'損失傾向は因果的な将来予測ではありません。投資を増やす推奨ではありません'};}
export function experimentalSuite(input,ledger=[]){const radar=awakeningRadar(input.horses),worlds=parallelWorlds(input.horses,17,1500),promotion=promotionEngine(input.horses,radar,worlds);return {radar,worlds,promotion,myHorse:myHorseDebate(input.favHorse||'',input.horses,radar,worlds),stopper:purchaseStopper({input,radar,promotion,worlds}),learning:learningFromLedger(ledger),experimental:true,version:'0.5.0',limitations:['未校正のヒューリスティック。旧プラグインと一致未検証','シナリオは入力オッズと脚質に基づく仮定モデル','公式競馬データの自動取得は未接続']};}
