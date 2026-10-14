import assert from 'node:assert/strict';
import {cleanupOldCalculations} from '../analytics.js';
let docs=[],deleted=[],commits=0,constraints;
const api={
  collection:()=> 'calculationEvents',
  where:(...args)=>args,orderBy:(...args)=>args,limit:value=>value,
  query:(collection,...args)=>{assert.equal(collection,'calculationEvents');constraints=args;return {};},
  getDocsFromServer:async()=>({docs}),
  writeBatch:()=>({delete:ref=>deleted.push(ref),commit:async()=>{commits++;}})
};
await cleanupOldCalculations({api,db:{}});
assert.equal(commits,0);
docs=[{ref:'old-1'},{ref:'old-2'}];
await cleanupOldCalculations({api,db:{}});
assert.deepEqual(deleted,['old-1','old-2']);
assert.equal(commits,1);
assert.equal(constraints[0][0],'createdAt');
assert.equal(constraints[0][1],'<');
assert.ok(Math.abs(Date.now()-constraints[0][2].getTime()-366*86400000)<1000);
assert.equal(constraints[2],100);
api.getDocsFromServer=async()=>{throw new Error('quota');};
await assert.rejects(cleanupOldCalculations({api,db:{}}),/quota/);
assert.equal(commits,1);
