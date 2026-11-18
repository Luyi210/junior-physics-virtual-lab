import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CosmicObservatory, CosmicStaticArt } from './CosmicObservatory';
import { paintCosmicObservatory } from './cosmicPainter';
type Slot={value?:unknown;deps?:readonly unknown[];cleanup?:()=>void;effect?:boolean};
type Frame={slots:Slot[];cursor:number;effects:Array<()=>void>;dirty:boolean};
const hooks=vi.hoisted(()=>({frame:null as Frame|null,id:0}));
vi.mock('./cosmicPainter',async original=>{const actual=await original<typeof import('./cosmicPainter')>();return{...actual,paintCosmicObservatory:vi.fn(actual.paintCosmicObservatory)};});
vi.mock('react',async original=>{
  const actual=await original<typeof import('react')>();
  const slot=()=>{const f=hooks.frame!;return f.slots[f.cursor++]??(f.slots[f.cursor-1]={});};
  const changed=(a:readonly unknown[]|undefined,b:readonly unknown[]|undefined)=>!a||!b||a.length!==b.length||a.some((v,i)=>!Object.is(v,b[i]));
  return{...actual,
    useRef:(initial:unknown)=>{if(!hooks.frame)return actual.useRef(initial);const s=slot();if(!Object.hasOwn(s,'value'))s.value={current:initial};return s.value;},
    useId:()=>{if(!hooks.frame)return actual.useId();const s=slot();return s.value??(s.value=`cosmic-test-${++hooks.id}`);},
    useState:(initial:unknown)=>{if(!hooks.frame)return actual.useState(initial);const frame=hooks.frame,s=slot();if(!Object.hasOwn(s,'value'))s.value=typeof initial==='function'?initial():initial;return[s.value,(next:unknown)=>{const value=typeof next==='function'?next(s.value):next;if(!Object.is(value,s.value)){s.value=value;frame.dirty=true;}}];},
    useEffect:(effect:()=>void|(()=>void),deps?:readonly unknown[])=>{if(!hooks.frame)return actual.useEffect(effect,deps);const s=slot();s.effect=true;if(changed(s.deps,deps)){s.deps=deps;hooks.frame.effects.push(()=>{s.cleanup?.();s.cleanup=effect()||undefined;});}},
  };
});
type Element=ReactElement<Record<string,unknown>>;
function nodes(node:ReactNode):Element[]{return Array.isArray(node)?node.flatMap(nodes):isValidElement<Record<string,unknown>>(node)?[node,...nodes(node.props.children as ReactNode)]:[];}
function text(node:ReactNode):string{return typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):isValidElement<Record<string,unknown>>(node)?text(node.props.children as ReactNode):'';}
function button(tree:ReactNode,label:string){return nodes(tree).find(n=>n.type==='button'&&(n.props['aria-label']===label||text(n).endsWith(label)))!;}
function click(node:Element){(node.props.onClick as ()=>void)();}
const cleanups:Array<()=>void>=[];
function browser(reduced=false,canvasAvailable=true){
  let next=0,width=288;const frames=new Map<number,(t:number)=>void>(),visibility=new Set<()=>void>(),resizes=new Set<()=>void>(),motion=new Set<(e:{matches:boolean})=>void>();
  const ctx={clearRect(){},fillRect(){},createRadialGradient(){return{addColorStop(){}};},beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},save(){},restore(){},clip(){},setTransform:vi.fn()};
  const capture=new Set<number>(),host={getBoundingClientRect:()=>({width,height:width*420/650}),focus:vi.fn(),setPointerCapture:(id:number)=>capture.add(id),hasPointerCapture:(id:number)=>capture.has(id),releasePointerCapture:(id:number)=>capture.delete(id)};
  const canvas={width:650,height:420,getContext:()=>canvasAvailable?ctx:null};
  const doc={hidden:false,addEventListener:(_t:string,fn:()=>void)=>visibility.add(fn),removeEventListener:(_t:string,fn:()=>void)=>visibility.delete(fn)};
  const media={matches:reduced,addEventListener:(_t:string,fn:(e:{matches:boolean})=>void)=>motion.add(fn),removeEventListener:(_t:string,fn:(e:{matches:boolean})=>void)=>motion.delete(fn)};
  class Observer {static all:Observer[]=[];target:unknown;active=true;constructor(readonly callback:(entries:Array<{target:unknown;isIntersecting:boolean}>)=>void){Observer.all.push(this);}observe(target:unknown){this.target=target;}disconnect(){this.active=false;}fire(visible:boolean){this.callback([{target:this.target,isIntersecting:visible}]);}}
  class Resizer {static all:Resizer[]=[];active=true;constructor(readonly callback:()=>void){Resizer.all.push(this);}observe(){}disconnect(){this.active=false;}}
  vi.stubGlobal('window',{devicePixelRatio:3,requestAnimationFrame:(cb:(t:number)=>void)=>{frames.set(++next,cb);return next;},cancelAnimationFrame:(id:number)=>frames.delete(id),matchMedia:()=>media,addEventListener:(_t:string,fn:()=>void)=>resizes.add(fn),removeEventListener:(_t:string,fn:()=>void)=>resizes.delete(fn)});
  vi.stubGlobal('document',doc);vi.stubGlobal('IntersectionObserver',Observer);vi.stubGlobal('ResizeObserver',Resizer);
  return{frames,visibility,resizes,motion,canvas,host,capture,observers:Observer.all,resizeObservers:Resizer.all,
    resize:(nextWidth:number)=>{width=nextWidth;Resizer.all.filter(o=>o.active).forEach(o=>o.callback());},
    observe:(visible:boolean)=>Observer.all.filter(o=>o.active).forEach(o=>o.fire(visible)),frame:(time:number)=>{const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb(time));},hide:(hidden:boolean)=>{doc.hidden=hidden;visibility.forEach(fn=>fn());},reduce:(matches:boolean)=>{media.matches=matches;motion.forEach(fn=>fn({matches}));}};
}
function mount(env:ReturnType<typeof browser>){
  const frame:Frame={slots:[],cursor:0,effects:[],dirty:false};
  const app={tree:null as ReactNode,render(){let turns=0;do{frame.dirty=false;frame.cursor=0;hooks.frame=frame;try{app.tree=CosmicObservatory();}finally{hooks.frame=null;}for(const node of nodes(app.tree)){if(node.props.ref)(node.props.ref as {current:unknown}).current=node.type==='canvas'?env.canvas:env.host;}frame.effects.splice(0).forEach(effect=>effect());if(++turns>20)throw Error('render loop');}while(frame.dirty);},unmount(){frame.slots.forEach(s=>{s.cleanup?.();s.cleanup=undefined;});},strictRestart(){app.unmount();frame.slots.filter(s=>s.effect).forEach(s=>s.deps=undefined);app.render();}};
  app.render();cleanups.push(()=>app.unmount());return app;
}
afterEach(()=>{cleanups.splice(0).forEach(fn=>fn());vi.unstubAllGlobals();vi.clearAllMocks();});
describe('cosmic observatory',()=>{
  it('renders stable SSR art with distinct gradients and honest, accessible mode labels',()=>{
    const html=renderToStaticMarkup(<><CosmicObservatory/><CosmicObservatory/></>);expect(html).toContain('物理意象 · 非定量实验');expect(html).toContain('方向键调整');expect(html).toContain('量子云');expect(html).not.toMatch(/NaN|Infinity/);
    const ids=[...html.matchAll(/id="([^"]+-planet)"/g)].map(match=>match[1]);expect(ids).toHaveLength(2);expect(new Set(ids).size).toBe(2);
    const quantum=renderToStaticMarkup(<CosmicStaticArt mode="quantum" id="cloud"/>);expect(quantum).toContain('data-cosmic-fallback="quantum"');expect(quantum).not.toContain('<ellipse');
  });
  it('defaults to a static canvas for reduced motion, permits explicit play, and bounds DPR at 1.5',()=>{
    const env=browser(true),app=mount(env);expect(env.frames.size).toBe(0);expect(env.canvas.width).toBe(432);env.observe(true);env.frame(0);app.render();expect(paintCosmicObservatory).toHaveBeenCalledTimes(1);expect(env.frames.size).toBe(0);expect(text(app.tree)).toContain('减少动态');
    click(button(app.tree,'播放意象动画'));env.frame(20);env.frame(60);app.render();expect(env.frames.size).toBe(1);expect(vi.mocked(paintCosmicObservatory).mock.calls.at(-1)![3]).toBeCloseTo(.04);
    env.reduce(false);env.reduce(true);app.render();expect(env.frames.size).toBe(0);expect(button(app.tree,'播放意象动画')).toBeDefined();
  });
  it('uses current mode and drag/keyboard view while paused, without advancing illustration time',()=>{
    const env=browser(true),app=mount(env);env.observe(true);env.frame(0);click(button(app.tree,'量子云'));app.render();env.frame(40);expect(vi.mocked(paintCosmicObservatory).mock.calls.at(-1)![1]).toBe('quantum');expect(text(app.tree)).toContain('点不是电子');
    const scene=nodes(app.tree).find(n=>n.props.role==='group')!;
    (scene.props.onPointerDown as (e:unknown)=>void)({button:0,pointerId:1,clientX:0,clientY:0,currentTarget:env.host});
    (scene.props.onPointerMove as (e:unknown)=>void)({pointerId:1,clientX:100,clientY:30,currentTarget:env.host});env.frame(80);expect(vi.mocked(paintCosmicObservatory).mock.calls.at(-1)![2].yaw).toBeGreaterThan(.18);expect(vi.mocked(paintCosmicObservatory).mock.calls.at(-1)![3]).toBe(0);
    (scene.props.onKeyDown as (e:unknown)=>void)({key:'Home',preventDefault(){}});env.frame(120);expect(vi.mocked(paintCosmicObservatory).mock.calls.at(-1)![2]).toEqual({yaw:.18,pitch:-.16});expect(env.capture.size).toBe(0);
  });
  it('does not catch up hidden time and disposes old frames/listeners during StrictMode replay',()=>{
    const env=browser(),app=mount(env);env.observe(true);env.frame(0);env.frame(50);const late=[...env.frames.values()][0];env.hide(true);expect(env.frames.size).toBe(0);env.hide(false);env.frame(90000);expect(vi.mocked(paintCosmicObservatory).mock.calls.at(-1)![3]).toBeCloseTo(.05);
    app.strictRestart();env.observe(true);const before=vi.mocked(paintCosmicObservatory).mock.calls.length;late(99999);expect(paintCosmicObservatory).toHaveBeenCalledTimes(before);expect(env.frames.size).toBe(1);expect(env.visibility.size).toBe(1);
    const oldToggle=button(app.tree,'暂停意象动画');app.unmount();click(oldToggle);expect(env.frames.size).toBe(0);expect(env.visibility.size+env.resizes.size+env.motion.size).toBe(0);expect(env.observers.every(o=>!o.active)).toBe(true);expect(env.resizeObservers.every(o=>!o.active)).toBe(true);
  });
  it('retains mode-switchable static SVG without a working canvas and no animation resources',()=>{
    const env=browser(false,false),app=mount(env);expect(text(app.tree)).toContain('静态意象');expect(env.frames.size).toBe(0);expect(env.visibility.size).toBe(0);expect(button(app.tree,'播放意象动画').props.disabled).toBe(true);
    click(button(app.tree,'波的干涉'));app.render();expect(nodes(app.tree).find(n=>n.type===CosmicStaticArt)!.props.mode).toBe('waves');
  });
  it('expands inline, uses native angle inputs, and restores trigger focus on Escape without changing mode or play intent',()=>{
    const env=browser(true),app=mount(env);env.observe(true);env.frame(0);
    click(button(app.tree,'量子云'));click(button(app.tree,'展开观测'));app.render();
    expect((app.tree as Element).props['data-expanded']).toBe('true');expect(button(app.tree,'收起观测').props['aria-expanded']).toBe(true);
    const slider=nodes(app.tree).find(n=>n.type==='input'&&n.props['aria-label']==='水平视角')!;
    expect(slider.props.type).toBe('range');expect(slider.props.step).toBe('0.1');expect(slider.props.onKeyDown).toBeUndefined();
    (slider.props.onChange as (event:unknown)=>void)({currentTarget:{value:'30.4'}});app.render();env.frame(40);
    const call=vi.mocked(paintCosmicObservatory).mock.calls.at(-1)!;expect(call[1]).toBe('quantum');expect(call[2].yaw).toBeCloseTo(30.4*Math.PI/180);expect(call[3]).toBe(0);expect(text(app.tree)).toContain('30.4°');expect(env.frames.size).toBe(0);
    const event={key:'Escape',preventDefault:vi.fn()};((app.tree as Element).props.onKeyDown as (event:unknown)=>void)(event);app.render();
    expect(event.preventDefault).toHaveBeenCalledOnce();expect(env.host.focus).toHaveBeenCalledOnce();expect((app.tree as Element).props['data-expanded']).toBe('false');expect(button(app.tree,'播放意象动画')).toBeDefined();
    expect(text(app.tree)).toContain('30.4°');expect(button(app.tree,'量子云').props['aria-pressed']).toBe(true);
    expect(nodes(app.tree).find(n=>n.props.className==='cosmic-observatory__view-controls')!.props.hidden).toBe(true);
  });
  it('bounds the expanded backing buffer and retains clock phase through resize and collapse',()=>{
    const env=browser(),app=mount(env);env.observe(true);env.frame(0);env.frame(50);
    click(button(app.tree,'展开观测'));app.render();env.resize(2400);expect(env.canvas.width).toBe(1600);expect(env.canvas.height).toBe(Math.round(1600*420/650));
    env.frame(100);expect(vi.mocked(paintCosmicObservatory).mock.calls.at(-1)![3]).toBeCloseTo(.1);
    click(button(app.tree,'收起观测'));app.render();env.resize(272);expect(env.canvas.width).toBe(408);
    env.frame(150);expect(vi.mocked(paintCosmicObservatory).mock.calls.at(-1)![3]).toBeCloseTo(.15);expect(env.frames.size).toBe(1);
  });
});
