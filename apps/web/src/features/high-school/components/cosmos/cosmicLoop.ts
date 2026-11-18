export interface CosmicLoopOptions {
  requestFrame: (callback:(timestamp:number)=>void)=>number;
  cancelFrame: (handle:number)=>void;
  draw: (elapsedSeconds:number)=>void;
  onError: ()=>void;
}
/** Imperative canvas loop: no per-frame React updates, max 30 paints/s.
 * Page visibility and intersection gate it; suspended time is discarded.
 */
export function createCosmicLoop(options: CosmicLoopOptions) {
  let running=false,visible=false,disposed=false,dirty=true,time=0;
  let frame:number|null=null,last:number|null=null,painted:number|null=null,generation=0;
  function cancel(){generation+=1;if(frame!==null)options.cancelFrame(frame);frame=null;last=null;painted=null;}
  function schedule(){
    if(disposed||!visible||(!running&&!dirty)||frame!==null)return;
    const owner=generation;
    frame=options.requestFrame(now=>{
      if(disposed||owner!==generation||!visible)return;
      frame=null;
      if(Number.isFinite(now)){
        if(running&&last!==null)time+=Math.max(0,Math.min((now-last)/1000,.1));
        last=now;
        if(painted===null||now-painted>=1000/30-1e-6||now<painted){
          try{options.draw(time);}catch{disposed=true;cancel();options.onError();return;}
          dirty=false;painted=now;
        }
      }
      if(owner===generation)schedule();
    });
  }
  return{
    setRunning(next:boolean){if(disposed||running===next)return;running=next;cancel();schedule();},
    setVisible(next:boolean){if(disposed||visible===next)return;visible=next;cancel();if(next)dirty=true;schedule();},
    invalidate(){if(disposed)return;dirty=true;schedule();},
    dispose(){if(disposed)return;disposed=true;cancel();},
    snapshot:()=>({time,running,visible,disposed}),
  };
}
