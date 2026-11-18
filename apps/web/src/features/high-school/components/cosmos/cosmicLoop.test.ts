import { describe, expect, it, vi } from 'vitest';
import { createCosmicLoop } from './cosmicLoop';
function fixture(){let next=0;const frames=new Map<number,(t:number)=>void>(),draw=vi.fn(),error=vi.fn();const loop=createCosmicLoop({requestFrame:cb=>{frames.set(++next,cb);return next;},cancelFrame:id=>frames.delete(id),draw,onError:error});return{loop,frames,draw,error,frame(time:number){const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb(time));}};}
describe('cosmic canvas scheduling',()=>{
  it('paints at most 30 updates per second after the initial frame without per-frame React state',()=>{
    const f=fixture();f.loop.setRunning(true);expect(f.frames.size).toBe(0);f.loop.setVisible(true);for(let i=0;i<=120;i+=1)f.frame(i*1000/120);
    expect(f.draw).toHaveBeenCalledTimes(31);expect(f.loop.snapshot().time).toBeCloseTo(1);expect(f.frames.size).toBe(1);
  });
  it('paints once while paused, invalidates on view change, and ignores hidden time and late frames',()=>{
    const f=fixture();f.loop.setVisible(true);f.frame(0);expect(f.frames.size).toBe(0);f.loop.invalidate();f.frame(40);expect(f.draw).toHaveBeenCalledTimes(2);expect(f.loop.snapshot().time).toBe(0);
    f.loop.setRunning(true);f.frame(50);f.frame(100);const late=[...f.frames.values()][0];f.loop.setVisible(false);expect(f.frames.size).toBe(0);late(10000);expect(f.loop.snapshot().time).toBeCloseTo(.05);
    f.loop.setVisible(true);f.frame(10000);expect(f.loop.snapshot().time).toBeCloseTo(.05);f.frame(10050);expect(f.loop.snapshot().time).toBeCloseTo(.1);
  });
  it('cancels permanently on dispose or painter failure and never revives from a queued callback',()=>{
    const f=fixture();f.loop.setRunning(true);f.loop.setVisible(true);const late=[...f.frames.values()][0];f.loop.dispose();late(0);f.loop.invalidate();f.loop.setVisible(true);expect(f.draw).not.toHaveBeenCalled();expect(f.frames.size).toBe(0);
    const bad=fixture();bad.draw.mockImplementation(()=>{throw Error('canvas lost');});bad.loop.setVisible(true);bad.frame(0);expect(bad.error).toHaveBeenCalledTimes(1);expect(bad.loop.snapshot().disposed).toBe(true);expect(bad.frames.size).toBe(0);
  });
});
