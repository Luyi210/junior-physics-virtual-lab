import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Link } from 'react-router-dom';
import { calculatePendulum } from '@physics-lab/physics/high-school/pendulum';
import { calculateProjectileMotion } from '@physics-lab/physics/high-school/kinematics';
import { calculateMomentumConservation } from '@physics-lab/physics/high-school/expandedModels';
import { HighSchoolShowcase, ShowcaseApparatus } from './HighSchoolShowcase';
import { createShowcaseModel, showcasePosition, showcaseReadings } from './showcaseModel';

type Slot={value?:unknown;deps?:readonly unknown[];cleanup?:()=>void;effect?:boolean};
type Frame={slots:Slot[];cursor:number;effects:Array<()=>void>;dirty:boolean};
const hooks=vi.hoisted(()=>({frame:null as Frame|null,id:0}));
vi.mock('react',async importOriginal=>{
  const actual=await importOriginal<typeof import('react')>();
  const slot=()=>{const f=hooks.frame!;return f.slots[f.cursor++]??(f.slots[f.cursor-1]={});};
  const changed=(a:readonly unknown[]|undefined,b:readonly unknown[]|undefined)=>!a||!b||a.length!==b.length||a.some((v,i)=>!Object.is(v,b[i]));
  return{...actual,
    useRef:(initial:unknown)=>{if(!hooks.frame)return actual.useRef(initial);const s=slot();if(!Object.hasOwn(s,'value'))s.value={current:initial};return s.value;},
    useId:()=>{if(!hooks.frame)return actual.useId();const s=slot();return s.value??(s.value=`showcase-test-${++hooks.id}`);},
    useState:(initial:unknown)=>{if(!hooks.frame)return actual.useState(initial);const frame=hooks.frame,s=slot();if(!Object.hasOwn(s,'value'))s.value=typeof initial==='function'?initial():initial;return[s.value,(next:unknown)=>{const v=typeof next==='function'?next(s.value):next;if(!Object.is(v,s.value)){s.value=v;frame.dirty=true;}}];},
    useMemo:(factory:()=>unknown,deps:readonly unknown[])=>{if(!hooks.frame)return actual.useMemo(factory,deps);const s=slot();if(changed(s.deps,deps)){s.deps=deps;s.value=factory();}return s.value;},
    useEffect:(effect:()=>void|(()=>void),deps?:readonly unknown[])=>{if(!hooks.frame)return actual.useEffect(effect,deps);const s=slot();s.effect=true;if(changed(s.deps,deps)){s.deps=deps;hooks.frame.effects.push(()=>{s.cleanup?.();s.cleanup=effect()||undefined;});}},
  };
});
type Element=ReactElement<Record<string,unknown>>;
const cleanups:Array<()=>void>=[];
function nodes(node:ReactNode):Element[]{return Array.isArray(node)?node.flatMap(nodes):isValidElement<Record<string,unknown>>(node)?[node,...nodes(node.props.children as ReactNode)]:[];}
function text(node:ReactNode):string{return typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):isValidElement<Record<string,unknown>>(node)?text(node.props.children as ReactNode):'';}
function click(node:Element){(node.props.onClick as ()=>void)();}
function findButton(tree:ReactNode,label:string){return nodes(tree).find(n=>n.type==='button'&&(n.props['aria-label']===label||text(n)===label))!;}
function mount(){const frame:Frame={slots:[],cursor:0,effects:[],dirty:false};const target={showcase:true};const app={tree:null as ReactNode,render(){let loops=0;do{frame.dirty=false;frame.cursor=0;hooks.frame=frame;try{app.tree=HighSchoolShowcase();}finally{hooks.frame=null;}const root=app.tree as Element;(root.props.ref as {current:unknown}).current=target;frame.effects.splice(0).forEach(effect=>effect());if(++loops>20)throw new Error('hook loop');}while(frame.dirty);},unmount(){frame.slots.forEach(s=>{s.cleanup?.();s.cleanup=undefined;});},strictRestart(){app.unmount();frame.slots.filter(s=>s.effect).forEach(s=>s.deps=undefined);app.render();}};app.render();cleanups.push(()=>app.unmount());return app;}
function browser(reduced=false){
  let next=0;const frames=new Map<number,(t:number)=>void>(),visibility=new Set<()=>void>(),motion=new Set<(event:{matches:boolean})=>void>();
  const doc={hidden:false,addEventListener:(_type:string,fn:()=>void)=>visibility.add(fn),removeEventListener:(_type:string,fn:()=>void)=>visibility.delete(fn)};
  const media={matches:reduced,addEventListener:(_type:string,fn:(event:{matches:boolean})=>void)=>motion.add(fn),removeEventListener:(_type:string,fn:(event:{matches:boolean})=>void)=>motion.delete(fn)};
  class Observer {static all:Observer[]=[];target:unknown;alive=true;constructor(readonly callback:(entries:unknown[])=>void){Observer.all.push(this);}observe(target:unknown){this.target=target;}disconnect(){this.alive=false;}fire(visible:boolean){this.callback([{target:this.target,isIntersecting:visible,intersectionRatio:visible?1:0}]);}}
  vi.stubGlobal('window',{requestAnimationFrame:(cb:(t:number)=>void)=>{frames.set(++next,cb);return next;},cancelAnimationFrame:(id:number)=>frames.delete(id),matchMedia:()=>media});vi.stubGlobal('document',doc);vi.stubGlobal('IntersectionObserver',Observer);
  return{frames,visibility,motion,observe:(value:boolean)=>Observer.all.filter(o=>o.alive).forEach(o=>o.fire(value)),frame:(time:number)=>{const queued=[...frames.values()];frames.clear();queued.forEach(cb=>cb(time));},hide:(hidden:boolean)=>{doc.hidden=hidden;visibility.forEach(fn=>fn());},reduce:(value:boolean)=>{media.matches=value;motion.forEach(fn=>fn({matches:value}));},observers:Observer.all};
}
afterEach(()=>{cleanups.splice(0).forEach(fn=>fn());vi.unstubAllGlobals();});

describe('showcase physical preview and fixed SVG scale',()=>{
  it('reads the existing pure models for all three phenomena instead of deriving display motion',()=>{
    const pendulum=createShowcaseModel('pendulum',1);expect(pendulum.stateAt(.73)).toEqual(calculatePendulum({length:1,amplitudeDegrees:30,mass:.2},.73));
    const projectile=createShowcaseModel('projectile',2);expect(projectile.stateAt(.32)).toEqual(calculateProjectileMotion({initialSpeed:6,angleDegrees:55,initialHeight:.5},.32));
    const collision=createShowcaseModel('collision',0);expect(collision.stateAt(3)).toEqual(calculateMomentumConservation({mass1:.5,mass2:.5,velocity1:.75,velocity2:-.25,separation:1.8,restitution:0},3));
    expect(collision.stateAt(3).velocity1).toBe(.25);expect(collision.stateAt(3).velocity2).toBe(.25);
    expect(showcaseReadings('collision',collision.stateAt(3))[0].value).toBe('0.250');expect(()=>createShowcaseModel('pendulum',9)).toThrow();
  });
  it('makes length differences visible and keeps every projectile point at its original scale',()=>{
    const short=createShowcaseModel('pendulum',0),long=createShowcaseModel('pendulum',2);
    const a=showcasePosition.pendulum(short.initial.x,short.initial.y),b=showcasePosition.pendulum(long.initial.x,long.initial.y);
    expect(Math.hypot(b.x-320,b.y-85)/Math.hypot(a.x-320,a.y-85)).toBeCloseTo(3);expect(long.initial.period).toBeGreaterThan(short.initial.period);
    for(const index of [0,1,2]){const m=createShowcaseModel('projectile',index),last=m.stateAt(m.durationSeconds+2);expect(last.y).toBeCloseTo(0,12);expect(last.time).toBe(m.durationSeconds);expect(m.path.at(-1)!.time).toBe(m.durationSeconds);for(const p of m.path){const xy=showcasePosition.projectile(p.x,p.y);expect(xy.x).toBeGreaterThanOrEqual(95);expect(xy.x).toBeLessThan(567);expect(xy.y).toBeLessThanOrEqual(316);}}
  });
  it('renders stable initial content and unique gradient IDs without a browser or Three',()=>{
    const html=renderToStaticMarkup(<MemoryRouter><HighSchoolShowcase/><HighSchoolShowcase/></MemoryRouter>);
    expect(html).toContain('改变摆长，观察节奏');expect(html).toContain('30.0');expect(html).toContain('播放模型预览');expect(html).toContain('/high-school/experiments/pendulum');expect(html).not.toMatch(/NaN|Infinity|<canvas/);
    const ids=[...html.matchAll(/id="([^"]+-gold)"/g)].map(match=>match[1]);expect(ids).toHaveLength(2);expect(new Set(ids).size).toBe(2);
    const model=createShowcaseModel('projectile',1),state=model.stateAt(.2),tree=ShowcaseApparatus({model,state,id:'render-test'});
    const ball=nodes(tree).find(n=>n.props['data-showcase-body']==='true')!;expect(ball.props.cx).toBe(showcasePosition.projectile(state.x,state.y).x);expect(ball.props.cy).toBe(showcasePosition.projectile(state.x,state.y).y);
  });
});

describe('actual showcase component lifecycle with explicit browser substitutes',()=>{
  it('starts only when visible, stops advancing hidden/offscreen, and resumes without a time jump',()=>{
    const env=browser(),app=mount();expect(env.frames.size).toBe(0);env.observe(true);env.frame(0);env.frame(50);app.render();expect(text(app.tree)).toContain('0.05');
    env.hide(true);expect(env.frames.size).toBe(0);env.hide(false);env.frame(50000);app.render();expect(text(app.tree)).toContain('0.05');
    env.frame(50050);app.render();expect(text(app.tree)).toContain('0.10');env.observe(false);expect(env.frames.size).toBe(0);env.observe(true);env.frame(90000);app.render();expect(text(app.tree)).toContain('0.10');
  });
  it('defaults to static for reduced motion, permits explicit play, and honors changes to that preference',()=>{
    const env=browser(true),app=mount();env.observe(true);app.render();expect(env.frames.size).toBe(0);expect(text(app.tree)).toContain('减少动态效果');
    click(findButton(app.tree,'播放模型预览'));env.frame(0);env.frame(80);app.render();expect(env.frames.size).toBe(1);expect(text(app.tree)).toContain('0.08');
    env.reduce(false);app.render();env.reduce(true);app.render();expect(env.frames.size).toBe(0);expect(text(app.tree)).toContain('已暂停');
  });
  it('changes the phenomenon/condition from its initial state and retains the explicit pause decision',()=>{
    const env=browser(),app=mount();env.observe(true);env.frame(0);env.frame(80);app.render();click(findButton(app.tree,'暂停模型预览'));app.render();
    click(findButton(app.tree,'1.5 m'));app.render();expect(text(app.tree)).toContain('0.00');expect(env.frames.size).toBe(0);
    const apparatus=nodes(app.tree).find(n=>n.type===ShowcaseApparatus)!;expect((apparatus.props.model as ReturnType<typeof createShowcaseModel>).initial.length).toBe(1.5);
    click(findButton(app.tree,'02抛体'));app.render();expect(text(app.tree)).toContain('0.5× 慢放');expect(nodes(app.tree).find(n=>n.type===Link)!.props.to).toBe('/high-school/experiments/projectile-motion');expect(env.frames.size).toBe(0);
    click(findButton(app.tree,'55°'));app.render();const next=nodes(app.tree).find(n=>n.type===ShowcaseApparatus)!;expect((next.props.state as Record<string,number>).time).toBe(0);expect((next.props.state as Record<string,number>).y).toBe(.5);
  });
  it('stops at the collision observation endpoint and replay/condition changes use a fresh initial state',()=>{
    const env=browser(),app=mount();click(findButton(app.tree,'03碰撞'));app.render();env.observe(true);env.frame(0);
    for(let i=1;i<=61;i+=1)env.frame(i*100);app.render();expect(text(app.tree)).toContain('本轮结束');expect(env.frames.size).toBe(0);
    click(findButton(app.tree,'重新播放模型预览'));app.render();expect(text(app.tree)).toContain('0.00');env.frame(10000);env.frame(10100);app.render();
    click(findButton(app.tree,'0 · 非弹性'));app.render();expect(text(app.tree)).toContain('0.00');const apparatus=nodes(app.tree).find(n=>n.type===ShowcaseApparatus)!;
    expect((apparatus.props.model as ReturnType<typeof createShowcaseModel>).choiceIndex).toBe(0);expect((apparatus.props.state as Record<string,number>).collided).toBe(0);
    env.observe(true);expect(env.frames.size).toBe(1);
  });
  it('disconnects effects and rejects late animation callbacks across StrictMode restart and unmount',()=>{
    const env=browser(),app=mount();env.observe(true);env.frame(0);const old=[...env.frames.values()][0];app.strictRestart();env.observe(true);expect(env.frames.size).toBe(1);old(5000);expect(env.frames.size).toBe(1);
    expect(env.visibility.size).toBe(1);expect(env.motion.size).toBe(1);const toggle=findButton(app.tree,'暂停模型预览');app.unmount();expect(env.frames.size).toBe(0);expect(env.visibility.size).toBe(0);expect(env.motion.size).toBe(0);expect(env.observers.every(o=>!o.alive)).toBe(true);old(9000);click(toggle);expect(env.frames.size).toBe(0);
  });
});
