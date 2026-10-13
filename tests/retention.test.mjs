import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createRetentionFetch } from '../lib/supabase/retention-fetch.ts';
import { RetentionError, runRetention } from '../lib/retention.ts';

const base = 'https://example.supabase.co';
const jwtError = () => Response.json({ code: 'PGRST303', message: 'JWT issued at future' }, {status: 401});
const fixtures = {
  generations: [{id:'g1',output_path:'p/scene.mp4',project_id:'p1'}],
  exports: [{id:'e1',storage_path:'p/final.mp4',project_id:'p1'}],
};
function adminFixture({queryFailure, storageFailure, projectFailure}={}) {
  const calls = [];
  const client = createClient(base, 'sb_secret_fixture', {
    auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:async(input,init)=>{
      const url=new URL(String(input)); const method=init?.method??'GET'; calls.push({path:url.pathname,method,query:url.search});
      if(method==='GET') {
        const table=url.pathname.split('/').at(-1);
        if(table===queryFailure)return jwtError();
        assert.equal(url.searchParams.get('status'),'eq.succeeded');
        assert.equal(url.searchParams.get('media_deleted_at'),'is.null');
        assert.match(url.searchParams.get('expires_at'),/^lte\./);
        return Response.json(fixtures[table]);
      }
      if(url.pathname.includes('/storage/'))return storageFailure?Response.json({message:'denied',statusCode:'403'}, {status:403}):Response.json([]);
      if(url.pathname.endsWith('/projects')&&projectFailure)return jwtError();
      return new Response(null,{status:204});
    }},
  });
  return {client,calls};
}

test('PGRST303 recovers after bounded backoff and logs no credentials', async()=>{
  let calls=0; const sleeps=[], logs=[];
  const fetcher=createRetentionFetch('run-test',{fetch:async(_input,init)=>{
    assert.equal(init.cache,'no-store'); return ++calls<=2?jwtError():Response.json([]);
  },sleep:async ms=>sleeps.push(ms),log:(level,record)=>logs.push({level,...record})});
  const response=await fetcher(`${base}/rest/v1/generations`,{headers:{authorization:'Bearer never-log-this'}});
  assert.equal(response.status,200); assert.equal(calls,3); assert.deepEqual(sleeps,[1000,2000]);
  assert.equal(logs.at(-1).event,'retention.auth_recovered'); assert.equal(JSON.stringify(logs).includes('never-log-this'),false);
});
test('persistent PGRST303 returns final readable response after exactly 3 attempts',async()=>{
  let calls=0;
  const fetcher=createRetentionFetch('run-test',{fetch:async()=>{calls++;return jwtError()},sleep:async()=>{},log:()=>{}});
  const response=await fetcher(`${base}/rest/v1/exports`);
  assert.equal(calls,3); assert.equal((await response.json()).code,'PGRST303');
});
test('invalid keys, network errors, Storage and POST writes are not retried',async()=>{
  for(const [path,method,response] of [
    ['/rest/v1/exports','GET',Response.json({code:'PGRST301'},{status:401})],
    ['/storage/v1/object/generated-media','DELETE',jwtError()],
    ['/rest/v1/projects','POST',jwtError()],
  ]) {
    let calls=0; const fetcher=createRetentionFetch('run-test',{fetch:async()=>{calls++;return response},sleep:async()=>{},log:()=>{}});
    await fetcher(base+path,{method}); assert.equal(calls,1);
  }
  let calls=0; const fetcher=createRetentionFetch('run-test',{fetch:async()=>{calls++;throw new Error('network')},log:()=>{}});
  await assert.rejects(fetcher(`${base}/rest/v1/exports`)); assert.equal(calls,1);
});
test('an explicitly rejected PATCH can retry; successful write occurs only once',async()=>{
  let calls=0,successes=0; const bodies=[];
  const fetcher=createRetentionFetch('run-test',{fetch:async input=>{
    bodies.push(await input.text()); calls++; if(calls===1)return jwtError(); successes++;return new Response(null,{status:204});
  },sleep:async()=>{},log:()=>{}});
  await fetcher(new Request(`${base}/rest/v1/exports`,{method:'PATCH',body:'{"storage_path":null}'}));
  assert.deepEqual(bodies,['{"storage_path":null}','{"storage_path":null}']); assert.equal(successes,1);
});
test('either inventory query failing prevents all deletion and metadata writes',async()=>{
  for(const table of ['generations','exports']){
    const {client,calls}=adminFixture({queryFailure:table});
    await assert.rejects(runRetention(client),e=>e instanceof RetentionError&&e.stage===`query.${table}`&&e.code==='PGRST303');
    assert.equal(calls.some(x=>x.method!=='GET'),false);
  }
});
test('dry-run reports expired inventory with no writes',async()=>{
  const {client,calls}=adminFixture(); const result=await runRetention(client,true);
  assert.equal(result.expiredObjects,2);assert.equal(result.deletedObjects,0);assert.equal(calls.length,2);
});
test('Storage failure does not mark files deleted',async()=>{
  const {client,calls}=adminFixture({storageFailure:true});
  await assert.rejects(runRetention(client),e=>e.stage==='storage.remove');
  assert.equal(calls.some(x=>x.method==='PATCH'),false);
});
test('project metadata failure is surfaced; successful cleanup reports totals',async()=>{
  const failure=adminFixture({projectFailure:true});
  await assert.rejects(runRetention(failure.client),e=>e.stage==='update.projects');
  assert.equal(failure.calls.some(x=>x.path.endsWith('/exports')&&x.method==='PATCH'),false);
  const {client,calls}=adminFixture();const result=await runRetention(client);
  assert.equal(result.deletedObjects,2); assert.equal(result.sceneVideos,1); assert.equal(result.finalExports,1);
  assert.equal(calls.filter(x=>x.method==='DELETE').length,1);
  const project=calls.find(x=>x.path.endsWith('/projects'));
  assert.ok(project.query.includes('final_output_path=eq.'));
});
