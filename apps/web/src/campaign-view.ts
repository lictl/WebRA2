// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. All content strings use textContent.
import {TerrainController} from './terrain-controller.ts';import {mountTerrain} from './terrain-view.ts';
import {campaignText,campaignReason} from './campaign-i18n.ts';import {formatBytes,type Locale} from './i18n.ts';
import './campaign.css';
const template=`<div id="campaign-chooser"><a class="skip" href="#campaign-main" data-campaign="skip"></a><div class="layout"><aside class="sidebar"><a class="brand" href="#setup" aria-label="WebRA2"><span class="brand-mark" aria-hidden="true">W</span><span class="brand-word">WEB<span>RA2</span></span></a><nav class="navigation"><a href="#setup" data-campaign="installation"></a><a href="#practice" data-campaign="practice"></a><a href="#campaign" class="current" data-campaign="nav"></a></nav><p class="sidebar-footer" data-campaign="tagline"></p></aside><div class="content"><header class="topbar"><div class="topbar-left"><span data-campaign="stage"></span><b data-campaign="device"></b></div><select id="campaign-locale" aria-label="Language / 語言"><option value="en">English</option><option value="zh-Hant">繁體中文</option></select></header><main id="campaign-main" tabindex="-1"><section class="hero"><div class="eyebrow" data-campaign="kicker"></div><h1 data-campaign="title"></h1><p class="intro" data-campaign="intro"></p></section><section class="campaign-source"><label for="campaign-profile" data-campaign="profile"></label><select id="campaign-profile"><option value="ra2" data-campaign="ra2"></option><option value="yr" data-campaign="yr"></option></select><div class="campaign-actions"><button id="campaign-folder" data-campaign="folder"></button><button id="campaign-files" data-campaign="files"></button><button id="campaign-clear" class="quiet" data-campaign="clear"></button></div><input id="campaign-folder-input" class="file-input" type="file" multiple webkitdirectory tabindex="-1" aria-hidden="true"><input id="campaign-file-input" class="file-input" type="file" multiple tabindex="-1" aria-hidden="true"><p class="scope-note" data-campaign="fileHelp"></p><p id="campaign-fallback" class="scope-note" data-campaign="fallback" hidden></p><p id="campaign-selection"></p><div class="campaign-actions"><button id="campaign-scan" class="primary" data-campaign="scan"></button><button id="campaign-cancel" data-campaign="cancel"></button></div><p id="campaign-status" role="status" aria-live="polite"></p><p id="campaign-error" role="alert" hidden></p><div id="campaign-progress-box" hidden><progress id="campaign-progress" aria-label="Progress / 進度" value="0" max="1"></progress><span id="campaign-progress-value"></span></div></section><p class="campaign-scope" data-campaign="scope"></p><div id="campaign-entries" class="campaign-entries"></div><details id="campaign-details" hidden><summary data-campaign="details"></summary><dl id="campaign-metadata"></dl></details></main></div></div></div><div id="campaign-viewport" hidden></div>`;
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function mountCampaign(root:HTMLElement,controller:TerrainController):()=>void{
  root.innerHTML=template;const get=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>('#campaign-'+id)!;
  const folder=get<HTMLInputElement>('folder-input'),files=get<HTMLInputElement>('file-input'),chooser=get('chooser'),viewport=get('viewport');
  let terrain:ReturnType<typeof mountTerrain>|null=null,lastPlan='',lastLocale='',disposed=false;
  const canFolder='webkitdirectory' in folder;get('folder').hidden=!canFolder;get('fallback').hidden=canFolder;
  get('folder').addEventListener('click',()=>folder.click());get('files').addEventListener('click',()=>files.click());
  for(const input of [folder,files])input.addEventListener('change',()=>{if(input.files?.length)controller.select(input.files);input.value='';});
  get('clear').addEventListener('click',()=>controller.select([]));get('scan').addEventListener('click',()=>{void controller.scanCampaigns();});get('cancel').addEventListener('click',()=>{controller.cancel();get('scan').focus();});
  get<HTMLSelectElement>('profile').addEventListener('change',()=>controller.setProfile(get<HTMLSelectElement>('profile').value as 'ra2'|'yr'));
  get<HTMLSelectElement>('locale').addEventListener('change',()=>controller.setLocale(get<HTMLSelectElement>('locale').value as Locale));
  const unsubscribe=controller.subscribe(state=>{
    if(disposed)return;const t=(key:string)=>campaignText(state.locale,key),playing=state.phase==='ready'&&state.campaign!==null;
    chooser.hidden=playing;viewport.hidden=!playing;
    if(playing){if(!terrain){terrain=mountTerrain(viewport,controller,{campaign:true});queueMicrotask(()=>{if(!disposed&&controller.state.phase==='ready')viewport.querySelector<HTMLCanvasElement>('canvas')?.focus();});}return;}
    if(terrain){terrain();terrain=null;viewport.replaceChildren();queueMicrotask(()=>{if(!disposed)get('entries').querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();});}
    const localeChanged=lastLocale!==state.locale;
    if(localeChanged){lastLocale=state.locale;document.documentElement.lang=state.locale;for(const el of chooser.querySelectorAll<HTMLElement>('[data-campaign]'))el.textContent=t(el.dataset.campaign!);chooser.querySelector('nav')!.setAttribute('aria-label',t('workspace'));}
    get<HTMLSelectElement>('locale').value=state.locale;get<HTMLSelectElement>('profile').value=state.profile;
    get('selection').textContent=`${t('selected')}: ${state.files.toLocaleString()} · ${formatBytes(state.bytes,state.locale)}`;
    const scan=get<HTMLButtonElement>('scan');scan.disabled=!state.files||state.busy;scan.textContent=t(state.phase==='failed'||state.phase==='cancelled'?'retry':'scan');
    get<HTMLButtonElement>('cancel').disabled=!state.busy;get<HTMLButtonElement>('clear').disabled=!state.files;get('status').textContent=t(state.phase==='selected'?'empty':state.phase);
    get('error').hidden=!state.error;get('error').textContent=state.error?`${t('failed')} ${t('technical')}: ${state.error}`:'';
    const p=state.progress;get('progress-box').hidden=!p;if(p){get<HTMLProgressElement>('progress').max=Math.max(1,p.total);get<HTMLProgressElement>('progress').value=p.completed;get('progress-value').textContent=`${p.completed.toLocaleString()} / ${p.total.toLocaleString()} · ${formatBytes(p.bytes,state.locale)}`;}
    const plan=state.campaign,key=plan?.fingerprint??'';
    if(key!==lastPlan||localeChanged){lastPlan=key;get('entries').replaceChildren();get('metadata').replaceChildren();get('details').hidden=!plan;
      if(plan){for(const entry of plan.entries){const card=node('section');card.className='campaign-card';card.dataset.faction=entry.id;
        const label=node('div',t(entry.id));label.className='eyebrow';card.append(label,node('h2',entry.title??t(entry.id)),node('p',t(entry.status)));
        card.append(node('h3',t('briefing')),node('p',entry.briefing??t('noBriefing')));
        if(entry.cinematics.length)card.append(node('p',t('media')));
        for(const reason of entry.reasons){const p=node('p',campaignReason(state.locale,reason));p.className='campaign-unavailable';card.append(p);const detail=node('small',`${t('technical')}: ${reason}`);card.append(detail);}
        const button=node('button',t('launch'));button.className='primary';button.disabled=entry.status!=='ready'||state.busy;button.dataset.launch=entry.id;button.setAttribute('aria-label',`${t('launch')} — ${t(entry.id)}`);button.addEventListener('click',()=>{void controller.launchCampaign(entry.id);});card.append(button);get('entries').append(card);
      }
      for(const [label,value]of [[t('identity'),plan.fingerprint],[t('pins'),String(plan.pins.length)],[t('omitted'),String(plan.omittedBattleEntries)]])get('metadata').append(node('dt',label),node('dd',value));}
    }
    for(const button of get('entries').querySelectorAll<HTMLButtonElement>('button[data-launch]'))button.disabled=state.busy||!plan?.entries.some(e=>e.id===button.dataset.launch&&e.status==='ready');
  });
  return()=>{disposed=true;unsubscribe();terrain?.();terrain=null;root.replaceChildren();};
}
