export function simulate(horses,runs=2000,seed=20261031){
 let state=seed>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296};
 const weights=horses.map(h=>h.odds&&h.odds>0?Math.max(.01,1/h.odds):1);
 const counts=Object.fromEntries(horses.map(h=>[h.number,{first:0,second:0,third:0}]));const combinations={};
 for(let i=0;i<runs;i++){let pool=horses.map((h,j)=>({number:h.number,w:weights[j]})),top=[];
 for(let p=0;p<Math.min(3,horses.length);p++){let x=rand()*pool.reduce((a,v)=>a+v.w,0),idx=pool.length-1;for(let j=0;j<pool.length;j++){x-=pool[j].w;if(x<0){idx=j;break}}const h=pool.splice(idx,1)[0];top.push(h.number);counts[h.number][['first','second','third'][p]]++}
 if(top.length===3){const key=top.join('-');combinations[key]=(combinations[key]||0)+1}}
 return {method:'uncalibrated odds-weighted Plackett-Luce demonstration',runs,seed,counts,combinations,calibrated:false};
}
export function evaluatePrediction(selection,finish,ticket){const a=selection.split('-').map(Number),b=finish.map(Number),sort=x=>x.slice().sort((x,y)=>x-y).join(',');if(ticket==='trifecta')return a.length===3&&a.every((x,i)=>x===b[i]);if(ticket==='trio')return a.length===3&&sort(a)===sort(b.slice(0,3));if(ticket==='quinella')return a.length===2&&sort(a)===sort(b.slice(0,2));if(ticket==='wide')return a.length===2&&a.every(x=>b.slice(0,3).includes(x));if(ticket==='win')return a.length===1&&a[0]===b[0];return false}
export function generateTickets(sim,ticket,maxPoints,budget){const limit=Math.min(maxPoints,Math.floor(budget/100));if(limit<1)return {candidates:[],total:0,referenceOnly:true};const seen=new Set(),out=[];const sorted=Object.entries(sim.combinations).sort((a,b)=>b[1]-a[1]);for(const [key] of sorted){const a=key.split('-').map(Number);const k=ticket==='trifecta'?key:ticket==='trio'?a.slice().sort((x,y)=>x-y).join('-'):ticket==='quinella'||ticket==='wide'?a.slice(0,2).sort((x,y)=>x-y).join('-'):String(a[0]);if(!seen.has(k)){seen.add(k);out.push({selection:k,stake:100})}if(out.length>=limit)break}return {candidates:out,total:out.length*100,referenceOnly:true,method:'uncalibrated ranking, NOT expected-value optimized'}}
