import test from 'node:test';import assert from 'node:assert/strict';import {digest,branchMap,suitabilityDNA,failureAutopsy,humanAICompare} from '../server/v07-features.js';
test('canonical integrity hash independent of object ordering',()=>assert.equal(digest({a:1,b:2}),digest({b:2,a:1})));
test('scenario rankings change across pace assumptions',()=>{const horses=[{number:1,name:'先',style:'逃げ'},{number:2,name:'後',style:'差し'}];assert.notDeepEqual(branchMap(horses,{pace:'fast'}).ranking.map(h=>h.number),branchMap(horses,{pace:'slow'}).ranking.map(h=>h.number));});
test('DNA small samples refuse confident rates',()=>assert.equal(suitabilityDNA([{distance:'1600',finish:1}]).distance[0].top3Rate,null));
test('failure autopsy detects uncovered winner',()=>assert.equal(failureAutopsy({predicted:[1,2],finish:[3,2,1]}).winnerInTop,false));
test('human AI comparison keeps different picks',()=>assert.deepEqual(humanAICompare({human:[3],ai:[1],finish:[3,2,1]}).humanOnly,[3]));
