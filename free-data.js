// AOZORA v2.2 - free, manual input only; never implies live connectivity.
const byId=id=>document.getElementById(id);
const store='aozora-racing-ai-local-jra-v22';
const venues=['東京','中山','京都','阪神','中京','新潟','福島','小倉','札幌','函館'];
const out=byId('fdResult');
function parseRows(text){
 const rows=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(rows.length&&/^(number|馬番)\s*,/i.test(rows[0]))rows.shift();
 const horses=rows.map((row,i)=>{
  const bits=row.split(',').map(s=>s.trim());
  if(bits.length!==3)throw Error(`${i+1}行目：3列（馬番,馬名,オッズ）が必要です`);
  const number=Number(bits[0]),name=bits[1],odds=Number(bits[2]);
  if(!Number.isInteger(number)||number<1||number>18||!name||name.length>80||!Number.isFinite(odds)||odds<1.0||odds>100000)throw Error(`${i+1}行目：馬番・馬名・オッズを確認してください`);
  return {number,name,odds};
 });
 if(horses.length<2||horses.length>18||new Set(horses.map(h=>h.number)).size!==horses.length)throw Error('2〜18頭で馬番重複なく入力してください');
 return horses;
}
function run(){try{
 const date=byId('fdDate').value,venue=byId('fdVenue').value,race=Number(byId('fdRace').value),observedAt=byId('fdObserved').value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!venues.includes(venue)||!Number.isInteger(race)||race<1||race>12||!observedAt)throw Error('開催日・競馬場・レース・情報確認時刻は必須です');
 const horses=parseRows(byId('fdHorses').value);
 const record={date,venue,race,observedAt,source:'利用者が確認・入力した情報',method:'manual',horses};
 localStorage.setItem(store,JSON.stringify(record));
 const ranking=[...horses].sort((a,b)=>a.odds-b.odds);
 const longshots=[...horses].filter(h=>h.odds>=10).sort((a,b)=>b.odds-a.odds);
 out.textContent=`保存しました：${date} ${venue}${race}R\n取得方式：手入力 / CSV（自動取得なし）\n出走馬数：${horses.length}\n\n【単勝オッズの低い順・予想ではありません】\n${ranking.map(h=>`${h.number}番 ${h.name}: ${h.odds}倍`).join('\n')}\n\n【10倍以上の馬・穴馬能力の評価ではありません】\n${longshots.map(h=>`${h.number}番 ${h.name}: ${h.odds}倍`).join('\n')||'該当なし'}\n\n購入ゲート：HOLD\n※オッズのみでは勝率や3連単精度は検証できません。`;
 }catch(e){out.textContent='入力エラー：'+e.message}}
byId('fdCheck').addEventListener('click',run);
byId('fdFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>100000) {out.textContent='CSVが大きすぎます（100KB以下）';return}try{const t=await file.text();parseRows(t);byId('fdHorses').value=t;out.textContent='CSVを読み込みました。「検証して保存」を押してください。'}catch(err){out.textContent='CSVエラー：'+err.message}});
byId('fdRestore').addEventListener('click',()=>{try{const d=JSON.parse(localStorage.getItem(store)||'null');if(!d)throw Error('保存データがありません');byId('fdDate').value=d.date;byId('fdVenue').value=d.venue;byId('fdRace').value=d.race;byId('fdObserved').value=d.observedAt;byId('fdHorses').value=d.horses.map(h=>`${h.number},${h.name},${h.odds}`).join('\n');out.textContent='端末内の保存データを復元しました。'}catch(e){out.textContent=e.message}});
byId('fdExport').addEventListener('click',()=>{const s=localStorage.getItem(store);if(!s){out.textContent='バックアップ対象がありません';return}const url=URL.createObjectURL(new Blob([s],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='aozora-jra-local-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
byId('fdDate').value=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
