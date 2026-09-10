// SPDX-License-Identifier: GPL-3.0-or-later
// Original fabricated files; no retail definitions or strings.
import test from 'node:test';import assert from 'node:assert/strict';
import {prepareCampaignLaunches,campaignMissionRequest,isCampaignLaunchPlan} from '../../packages/content/src/campaign-launch.ts';
import {inspectBrowserCatalog,type BrowserCatalog} from '../../packages/vfs/src/browser-catalog.ts';
const u32=(v:number)=>{const b=Buffer.alloc(4);b.writeUInt32LE(v);return b;};
function strings(text='原創任務') {const label=Buffer.from('UI:Original'),bytes=Buffer.from(text,'utf16le');for(let i=0;i<bytes.length;i++)bytes[i]=bytes[i]!^255;
  return Buffer.concat([Buffer.from(' FSC'),u32(3),u32(1),u32(1),u32(0),u32(9),Buffer.from(' LBL'),u32(1),u32(label.length),label,Buffer.from(' RTS'),u32(text.length),bytes]);}
function fixture(profile:'ra2'|'yr',patch:Record<string,string|Uint8Array|null>={}){
  const md=profile==='yr'?'md':'',rows:Record<string,string|Uint8Array>={
    [`battle${md}.ini`]:'[Battles]\n9=SOV1\n3=ALL1\n1=Other\n[ALL1]\nScenario=alpha.map\nDescription=UI:Original\n[SOV1]\nScenario=beta.map\n[Other]\nScenario=not-an-opening.map',
    [`mapsel${md}.ini`]:'[Unrelated]\n1=DoNotInferProgression', [`mission${md}.ini`]:'[Original]\nValue=1',
    [profile==='yr'?'ra2md.csf':'ra2.csf']:strings(),
    'alpha.map':'[Map]\nTheater=SNOW\n[Basic]\nBriefing=UI:Original\nIntro=original_intro\nBrief=<none>',
    'beta.map':'[Map]\nTheater=TEMPERATE', [`snow${md}.ini`]:'[General]\nClearTile=0', [`temperat${md}.ini`]:'[General]\nClearTile=0',
    'isosno.pal':new Uint8Array(768),'isotem.pal':new Uint8Array(768)};
  for(const [key,value]of Object.entries(patch)){if(value===null)delete rows[key];else rows[key]=value;}
  return Object.entries(rows).map(([name,bytes])=>new File([typeof bytes==='string'?bytes:new Uint8Array(bytes)],name));
}
async function withPlan(profile:'ra2'|'yr',patch:Record<string,string|Uint8Array|null>,run:(plan:Awaited<ReturnType<typeof prepareCampaignLaunches>>,cat:BrowserCatalog)=>void|Promise<void>){
  const cat=await inspectBrowserCatalog(fixture(profile,patch),{profile,policy:'tolerant'});try{await run(await prepareCampaignLaunches(cat,{profile}),cat);}finally{cat.dispose();}
}
test('native named starts select authored Scenario rather than list order or progression entries in both profiles',async()=>{
  for(const profile of ['ra2','yr'] as const)await withPlan(profile,{},(plan)=>{
    assert.equal(isCampaignLaunchPlan(plan),true);assert.deepEqual(plan.entries.map(e=>[e.id,e.status,e.missionPath]),[['allied','ready','alpha.map'],['soviet','ready','beta.map']]);
    assert.equal(plan.omittedBattleEntries,1);assert.equal(plan.entries[0]!.title,'原創任務');assert.equal(plan.entries[0]!.briefing,'原創任務');
    assert.deepEqual(plan.entries[0]!.cinematics,[{field:'Intro',reference:'original_intro'}]);assert.equal(plan.cinematicPlayback,false);assert.equal(plan.canCompleteCampaign,false);
    const r=campaignMissionRequest(plan,plan.fingerprint,'allied');assert.equal(r.theaterIniPath,profile==='yr'?'snowmd.ini':'snow.ini');assert.equal(r.palettePath,'isosno.pal');
    assert.throws(()=>campaignMissionRequest({...plan},plan.fingerprint,'allied'),/plan-identity/);assert.throws(()=>campaignMissionRequest(plan,'0'.repeat(64),'allied'),/plan-identity/);
    assert.ok(Object.isFrozen(plan.entries)&&Object.isFrozen(plan.entries[0]!.cinematics)&&Object.isFrozen(r));
  });
});
test('unavailable starts preserve independent playable previews without accepting unsafe or conflicting field interpretations',async()=>{
  for(const [patch,reason] of [
    [{'alpha.map':null},'source-missing:alpha.map'],
    [{'alpha.map':'[Map]\nTheater=LUNAR'},'unsupported-theater'],
    [{'alpha.map':'[Map]\nTheater=SNOW\nTheater=URBAN'},'ambiguous-field'],
    [{'alpha.map':'[Map]\ntheater=SNOW'},'unsupported-key-case'],
    [{'snow.ini':null},'source-missing:snow.ini'],
    [{'alpha.map':'[Map]\nTheater=SNOW\n[Map]\nTheater=URBAN'},'ambiguous-section'],
  ] as const)await withPlan('ra2',patch,(plan)=>{assert.equal(plan.entries[0]!.status,'unavailable');assert.ok(plan.entries[0]!.reasons.includes(reason));assert.equal(plan.entries[1]!.status,'ready');assert.throws(()=>campaignMissionRequest(plan,plan.fingerprint,'allied'),/unavailable/);});
});
test('scenario traversal, duplicate memberships and debug-only starts never become launch requests',async()=>{
  for(const [extra,scenario,reason] of [['','../alpha.map','scenario-path'],['\nDebugOnly=yes','alpha.map','debug-start'],['\nScenario=beta.map','alpha.map','ambiguous-field']] as const)
    await withPlan('yr',{'battlemd.ini':`[Battles]\n1=ALL1\n[ALL1]\nScenario=${scenario}${extra}`},p=>{assert.ok(p.entries[0]!.reasons.includes(reason));});
  await withPlan('ra2',{'battle.ini':'[Battles]\n1=ALL1\n2=all1\n[ALL1]\nScenario=alpha.map'},p=>assert.ok(p.entries[0]!.reasons.includes('ambiguous-membership')));
});
test('fresh catalog order changes audit handles but preserves durable plan and mission request',async()=>{
  const files=fixture('yr'),a=await inspectBrowserCatalog(files,{profile:'yr',policy:'tolerant'}),b=await inspectBrowserCatalog([...files].reverse(),{profile:'yr',policy:'tolerant'});
  try{const x=await prepareCampaignLaunches(a,{profile:'yr'}),y=await prepareCampaignLaunches(b,{profile:'yr'});assert.deepEqual(x,y);assert.deepEqual(campaignMissionRequest(x,x.fingerprint,'soviet'),campaignMissionRequest(y,y.fingerprint,'soviet'));await assert.rejects(prepareCampaignLaunches(a,{profile:'ra2'}),/catalog/);}finally{a.dispose();b.dispose();}
});
test('abort, callback reentrancy and oversized localized values fail within the source boundary',async()=>{
  const cat=await inspectBrowserCatalog(fixture('ra2'),{profile:'ra2',policy:'tolerant'}),abort=new AbortController();let nested:Promise<unknown>|undefined;
  try{await assert.rejects(prepareCampaignLaunches(cat,{profile:'ra2'},{signal:abort.signal,onProgress(){nested=prepareCampaignLaunches(cat,{profile:'ra2'});nested.catch(()=>{});abort.abort();}}),{name:'AbortError'});await assert.rejects(nested!,/busy/);}
  finally{cat.dispose();}
  await withPlan('ra2',{'ra2.csf':strings('界'.repeat(8193))},p=>assert.ok(p.entries[0]!.reasons.includes('localized-text-limit')));
});
