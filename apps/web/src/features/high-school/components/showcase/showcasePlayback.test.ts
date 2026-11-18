import { describe, expect, it, vi } from 'vitest';
import { createShowcasePlayback, type ShowcaseClockSnapshot } from './showcasePlayback';

function fixture(durationSeconds=2,rate=1){
  let next=0;const queued=new Map<number,(time:number)=>void>();const updates:ShowcaseClockSnapshot[]=[];
  const clock=createShowcasePlayback({durationSeconds,rate,onChange:s=>updates.push(s),requestFrame:cb=>{queued.set(++next,cb);return next;},cancelFrame:id=>{queued.delete(id);}});
  const frame=(time:number)=>{const callbacks=[...queued.values()];queued.clear();callbacks.forEach(cb=>cb(time));};
  return{clock,queued,updates,frame};
}

describe('homepage exhibit bounded animation clock',()=>{
  it('advances physical seconds from elapsed frames and declared slow-motion rate',()=>{
    const f=fixture(2,.5);f.clock.setVisible(true);f.clock.play();
    f.frame(1000);f.frame(1040);f.frame(1100);expect(f.clock.snapshot().time).toBeCloseTo(.05);
    f.clock.pause();expect(f.queued.size).toBe(0);expect(f.clock.snapshot().playing).toBe(false);
    f.clock.play();f.frame(9000);expect(f.clock.snapshot().time).toBeCloseTo(.05);
    f.frame(9040);expect(f.clock.snapshot().time).toBeCloseTo(.07);
  });
  it('suspends when hidden/offscreen and never catches up unseen wall-clock time',()=>{
    const f=fixture();f.clock.setVisible(true);f.clock.play();f.frame(0);f.frame(80);
    const old=[...f.queued.values()][0];f.clock.setVisible(false);expect(f.queued.size).toBe(0);
    expect(f.clock.snapshot()).toMatchObject({time:.08,playing:true,active:false});
    old(10000);expect(f.clock.snapshot().time).toBe(.08);
    f.clock.setVisible(true);f.frame(20000);expect(f.clock.snapshot().time).toBe(.08);
    f.frame(20050);expect(f.clock.snapshot().time).toBeCloseTo(.13);
  });
  it('stops exactly at the endpoint, and replay is a distinct run from zero',()=>{
    const f=fixture(.15);f.clock.setVisible(true);f.clock.play();f.frame(0);f.frame(100);f.frame(200);
    expect(f.clock.snapshot()).toEqual({time:.15,playing:false,active:false,finished:true});expect(f.queued.size).toBe(0);
    f.clock.play();expect(f.clock.snapshot()).toEqual({time:0,playing:true,active:true,finished:false});
    f.frame(2000);f.frame(2050);expect(f.clock.snapshot().time).toBeCloseTo(.05);
  });
  it('bounds long stalls, tolerates invalid timestamps, and blocks callbacks after disposal',()=>{
    const f=fixture();f.clock.setVisible(true);f.clock.play();f.frame(NaN);f.frame(0);f.frame(100000);expect(f.clock.snapshot().time).toBe(.1);
    const old=[...f.queued.values()][0],count=f.updates.length;f.clock.dispose();old(100040);f.clock.play();f.clock.setVisible(true);f.clock.pause();
    expect(f.updates).toHaveLength(count);expect(f.queued.size).toBe(0);
  });
  it('limits continuous frame publications to 30 fps but publishes pause/end immediately',()=>{
    const f=fixture(1.01);f.clock.setVisible(true);f.clock.play();f.frame(0);const initial=f.updates.length;
    for(let i=1;i<=60;i+=1)f.frame(i*1000/60);
    expect(f.updates.length-initial).toBe(30);expect(f.clock.snapshot().time).toBeCloseTo(1);
    f.frame(1010);expect(f.updates.at(-1)).toMatchObject({time:1.01,finished:true,playing:false});
    f.clock.play();f.frame(2000);f.frame(2010);const count=f.updates.length;f.clock.pause();
    expect(f.updates).toHaveLength(count+1);expect(f.updates.at(-1)!.time).toBeCloseTo(.01);
  });
  it('does not reschedule when the consumer pauses during a frame callback',()=>{
    let id=0;const callbacks=new Map<number,(t:number)=>void>();let stop=false;
    const clock=createShowcasePlayback({durationSeconds:1,rate:1,requestFrame:callback=>{callbacks.set(++id,callback);return id;},cancelFrame:frame=>{callbacks.delete(frame);},onChange:()=>{if(stop){stop=false;clock.pause();}}});
    clock.setVisible(true);clock.play();const first=[...callbacks.values()][0];callbacks.clear();first(0);
    const second=[...callbacks.values()][0];callbacks.clear();stop=true;second(50);expect(clock.snapshot().playing).toBe(false);expect(callbacks.size).toBe(0);
    expect(()=>createShowcasePlayback({durationSeconds:Infinity,rate:1,onChange:vi.fn(),requestFrame:vi.fn(),cancelFrame:vi.fn()})).toThrow();
  });
});
