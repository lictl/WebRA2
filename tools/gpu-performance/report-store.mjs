// SPDX-License-Identifier: GPL-3.0-or-later
// Collection occurs after timing. Large telemetry never participates in the DOM.
export class ReportStore {
 constructor(link,summary){this.link=link;this.summary=summary;this.url=null;}
 clear(){if(this.url)URL.revokeObjectURL(this.url);this.url=null;this.link.removeAttribute('href');this.link.hidden=true;this.summary.textContent='';}
 show(report){this.clear();const text=JSON.stringify(report),blob=new Blob([text+'\n'],{type:'application/json'});if(blob.size>32*1024*1024)throw Error('Report byte cap');this.url=URL.createObjectURL(blob);this.link.href=this.url;this.link.download=`gpu-${report.kind}-${report.worldProfile??'render'}-${report.width??'checks'}-${Date.now()}.json`;this.link.hidden=false;
  const {schema,kind,error,reason,worldProfile,rendererProfile,mapSize,count,width,height,coupled,summary,verified,lifecycle,completedAt}=report;
  this.summary.textContent=JSON.stringify({schema,kind,error,reason,worldProfile,rendererProfile,mapSize,count,width,height,coupled,summary,verified,lifecycle,completedAt,download:this.link.download,bytes:blob.size,cases:report.cases?.length},null,2);
 }
}
