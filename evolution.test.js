import test from 'node:test';import assert from 'node:assert/strict';import {oddsAlert,moneyGuard,counterArgument,scenario3d,evolutionCompare,evidenceTrail,promotionAudit} from '../server/evolution-features.js';
test('odds alerts based on actual snapshots',()=>assert.equal(oddsAlert([{at:'a',odds:10},{at:'b',odds:7}]).events[0].changePercent,-30));
test('risk hard stop',()=>assert.equal(moneyGuard({monthlyLimit:1000,dailyLimit:1000,lossLimit:1000,spendMonth:900,spendDay:0,netMonth:0,proposal:200}).status,'STOP'));
test('counter argument catches missing scenarios',()=>assert.ok(counterArgument({prediction:{marks:[{}]}}).arguments.length));
test('3D scenario has five frames',()=>assert.equal(scenario3d([{number:1,name:'X',style:'逃げ'}]).frames.length,5));
test('lab does not claim comparison with low sample',()=>assert.equal(evolutionCompare([{hit:true}],[{hit:false}]).comparable,false));
test('evidence trail preserves source',()=>assert.equal(evidenceTrail([{source:'official',horse:'A'}])[0].source,'official'));
test('promotion cannot auto certify',()=>assert.equal(promotionAudit([{number:1}])[0].headCaseRequired,true));
