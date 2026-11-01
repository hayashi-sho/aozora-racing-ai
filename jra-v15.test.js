import test from 'node:test';import assert from 'node:assert/strict';
import {importLicensedRows,trainCalibratedJra,inferJraRace,promotionAuditV15} from '../server/jra-v15.js';
const base={attestation:{authorized:true,holder:'Synthetic test data holder',scope:'internal-research'}};
function dataset(){let rows=[];for(let i=0;i<60;i++){const date=new Date(Date.UTC(2025,0,1+i*3)).toISOString().slice(0,10);for(let j=0;j<5;j++){const feat=Object.fromEntries(['form','pace','distanceFit','groundFit','classFit','adversity','weightFit','drawFit'].map((k,n)=>[k,((j+n+i)%10)/10]));rows.push({region:'JRA',raceId:`R${i}`,horseId:`H${j}`,date,odds:3+j*3,outcomeFinish:(j+i)%5+1,features:feat,featureTime:`${date}T10:00:00Z`,postTime:`${date}T14:00:00Z`,source:'Synthetic test source'})}}return {...base,rows}}
test('valid authorized synthetic JRA rows accepted',()=>{assert.equal(importLicensedRows(dataset()).races,60)});
test('unlicensed source rejected',()=>{assert.throws(()=>importLicensedRows({...dataset(),attestation:{authorized:false}}))});
test('late leaked feature rejected',()=>{const d=dataset();d.rows[0].featureTime=d.rows[0].postTime;assert.throws(()=>importLicensedRows(d),/precede/)});
test('non-JRA row rejected',()=>{const d=dataset();d.rows[0].region='LOCAL';assert.throws(()=>importLicensedRows(d),/JRA/)});
test('temperature calibration and holdout with no auto deploy',()=>{const d=dataset(),m=trainCalibratedJra(d);assert.equal(m.gate,'HOLD');assert.equal(m.approvedForSale,false);assert.ok(m.test.races>=5);assert.ok(m.temperature>0);const p=inferJraRace(m,d.rows.slice(0,5));assert.ok(Math.abs(p.horses.reduce((a,x)=>a+x.winProbabilityReference,0)-1)<1e-9);assert.equal(p.gate,'HOLD');assert.equal(promotionAuditV15(m,m).autoDeploy,false)});
