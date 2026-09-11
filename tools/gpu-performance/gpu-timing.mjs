// SPDX-License-Identifier: GPL-3.0-or-later
// Nonblocking diagnostic receipts; observation time is not GPU or scanout time.
export class GpuTiming {
  constructor(gl,onComplete=()=>{}){this.gl=gl;this.ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');this.pending=[];this.active=null;this.onComplete=onComplete;this.disjoint=0;this.skipped=0;this.peak=0;this.disposed=false;}
  begin(id,now,metadata){
    if(this.disposed||this.active)throw Error('Timing lifecycle');
    if(this.pending.length>=8){this.skipped++;return false;}
    const query=this.ext?this.gl.createQuery():null;
    if(this.ext&&!query)throw Error('GPU query allocation');
    if(query)this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT,query);
    this.active={id,submittedAt:now,metadata,query,sync:null,completed:false,gpuMs:null};return true;
  }
  end(){const r=this.active;if(!r)throw Error('No timing frame');this.active=null;if(r.query)this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    r.sync=this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!r.sync){if(r.query)this.gl.deleteQuery(r.query);throw Error('GPU fence allocation');}
    this.gl.flush();this.pending.push(r);this.peak=Math.max(this.peak,this.pending.length);
  }
  poll(now){
    if(this.disposed)return;
    const gl=this.gl,disjoint=this.ext&&gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    for(const r of this.pending){
      if(disjoint&&r.query){gl.deleteQuery(r.query);r.query=null;this.disjoint++;}
      if(!r.completed){const state=gl.clientWaitSync(r.sync,0,0);if(state===gl.WAIT_FAILED)throw Error('GPU fence failed');
        if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED){r.completed=true;r.observedAt=now;gl.deleteSync(r.sync);r.sync=null;}
        else r.lastUnsignaledAt=now;
      }
      if(r.query&&gl.getQueryParameter(r.query,gl.QUERY_RESULT_AVAILABLE)){r.gpuMs=gl.getQueryParameter(r.query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(r.query);r.query=null;}
      if(now-r.submittedAt>2000)throw Error('GPU completion observation timeout');
    }
    const done=this.pending.filter(r=>r.completed&&!r.query);this.pending=this.pending.filter(r=>!r.completed||r.query);
    for(const r of done)this.onComplete({id:r.id,submittedAt:r.submittedAt,observedAt:r.observedAt,lastUnsignaledAt:r.lastUnsignaledAt??null,gpuMs:r.gpuMs,metadata:r.metadata});
  }
  dispose(){if(this.disposed)return;this.disposed=true;const gl=this.gl;if(this.active){if(this.active.query){gl.endQuery(this.ext.TIME_ELAPSED_EXT);gl.deleteQuery(this.active.query);}this.active=null;}
    for(const r of this.pending){if(r.query)gl.deleteQuery(r.query);if(r.sync)gl.deleteSync(r.sync);}this.pending=[];
  }
}
