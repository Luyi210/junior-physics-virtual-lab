import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { MultimeterControlPanel, type MultimeterControlPanelProps } from './MultimeterControlPanel';
import { ElectricDiagram } from '../expanded/ElectricDiagrams';
import { ElectricApparatus3D } from '../expanded/ElectricApparatus3D';
import { Action } from '../expanded/DiagramPrimitives';
import { SceneAction } from '../expanded/ApparatusPrimitives3D';
import { useExpandedSceneControls, type ExpandedSceneProps } from '../expanded/expandedSceneTypes';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const hooks=vi.hoisted(()=>({frame:null as Frame|null}));
// Execute real callbacks with deterministic hooks. This does not emulate browser layout or GPU hit testing.
vi.mock('react',async importOriginal=>{
  const actual=await importOriginal<typeof import('react')>();
  const slot=()=>{const frame=hooks.frame!;return frame.slots[frame.cursor++]??(frame.slots[frame.cursor-1]={});};
  return {...actual,useRef:(initial:unknown)=>{if(!hooks.frame)return actual.useRef(initial);const item=slot();if(!Object.hasOwn(item,'value'))item.value={current:initial};return item.value;},useEffect:(effect:()=>void|(()=>void),deps?:readonly unknown[])=>{if(!hooks.frame)return actual.useEffect(effect,deps);const item=slot();if(!deps||!item.deps||deps.some((value,i)=>!Object.is(value,item.deps![i]))){item.deps=deps;hooks.frame.effects.push(()=>{item.cleanup?.();item.cleanup=effect()||undefined;});}}};
});
type Element=ReactElement<Record<string,unknown>>;
const cleanups:Array<()=>void>=[];
function nodes(node:ReactNode):Element[]{return Array.isArray(node)?node.flatMap(nodes):isValidElement<Record<string,unknown>>(node)?[node,...nodes(node.props.children as ReactNode)]:[];}
function text(node:ReactNode):string{return typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):isValidElement<Record<string,unknown>>(node)?text(node.props.children as ReactNode):'';}
function invoke(node:Element,key:string,event:unknown={}){(node.props[key] as (event:unknown)=>void)(event);}
function mount<P extends object>(component:(props:P)=>ReactNode,initial:P){let props=initial;const frame:Frame={slots:[],cursor:0,effects:[]};const app={tree:null as ReactNode,render(next:Partial<P>={}){props={...props,...next};frame.cursor=0;hooks.frame=frame;try{app.tree=component(props);}finally{hooks.frame=null;}frame.effects.splice(0).forEach(effect=>effect());},unmount(){frame.slots.forEach(slot=>{slot.cleanup?.();slot.cleanup=undefined;});}};app.render();cleanups.push(()=>app.unmount());return app;}
function model(parameters=defaultHighSchoolParameters('multimeter')){return{experimentId:'multimeter' as const,parameters,simulation:simulateHighSchoolExperiment('multimeter',parameters,0)};}
function button(tree:ReactNode,label:string){return nodes(tree).find(node=>node.type==='button'&&text(node).startsWith(label))!;}
function select(tree:ReactNode){return nodes(tree).find(node=>node.type==='select')!;}
function output(tree:ReactNode){return text(nodes(tree).find(node=>node.type==='output')!);}
afterEach(()=>cleanups.splice(0).forEach(cleanup=>cleanup()));

describe('multimeter actual controls retain student decisions',()=>{
  it('walks voltage → incorrect current wiring → series → over-range → resistance without silently fixing anything',()=>{
    let parameters=defaultHighSchoolParameters('multimeter');const patches:Record<string,number>[]=[];
    const onChange=(patch:Record<string,number>)=>{patches.push(patch);parameters={...parameters,...patch};};
    const app=mount(MultimeterControlPanel,{...model(parameters),onChange});
    const refresh=()=>app.render(model(parameters));
    expect(output(app.tree)).toBe('6.00 V');
    invoke(button(app.tree,'直流电流'),'onClick');refresh();expect(output(app.tree)).toBe('接法无效');expect(parameters.connection).toBe(0);expect(parameters.powerOn).toBe(1);expect(parameters.rangeIndex).toBe(1);
    invoke(button(app.tree,'串入电流回路'),'onClick');refresh();expect(output(app.tree)).toBe('6.00 mA');
    invoke(select(app.tree),'onChange',{target:{value:'0'}});refresh();expect(output(app.tree)).toBe('超量程');expect(parameters.connection).toBe(1);
    invoke(select(app.tree),'onChange',{target:{value:'1'}});refresh();expect(output(app.tree)).toBe('6.00 mA');
    invoke(button(app.tree,'表笔极性'),'onClick');refresh();expect(output(app.tree)).toBe('-6.00 mA');
    invoke(button(app.tree,'电阻'),'onClick');refresh();expect(output(app.tree)).toBe('接法无效');expect(parameters.probesReversed).toBe(1);expect(parameters.connection).toBe(1);expect(parameters.powerOn).toBe(1);
    invoke(button(app.tree,'外部电源'),'onClick');refresh();expect(output(app.tree)).toBe('接法无效');
    invoke(button(app.tree,'隔离待测元件'),'onClick');refresh();expect(output(app.tree)).toBe('1.000 kΩ');
    expect(patches.every(patch=>Object.keys(patch).length===1)).toBe(true);
    expect(parameters.probesReversed).toBe(1);expect(parameters.supplyVoltage).toBe(6);expect(parameters.resistanceOhms).toBe(1000);
  });

  it('retains range index across functions and validates native select choices',()=>{
    const change=vi.fn(),app=mount(MultimeterControlPanel,{...model(),onChange:change});
    invoke(select(app.tree),'onChange',{target:{value:'2'}});expect(change).toHaveBeenLastCalledWith({rangeIndex:2});
    for(const value of ['NaN','-1','1.5','3'])invoke(select(app.tree),'onChange',{target:{value}});
    expect(change).toHaveBeenCalledOnce();
    invoke(button(app.tree,'直流电压'),'onClick');expect(change).toHaveBeenCalledOnce();
    app.render(model({...model().parameters,functionMode:2,rangeIndex:2}));
    expect(text(select(app.tree))).toBe('200 Ω2 kΩ20 kΩ');expect(select(app.tree).props.value).toBe(2);
    const html=renderToStaticMarkup(<MultimeterControlPanel {...model()} />);expect(html).toContain('disabled=""');expect(html).toContain('aria-label="万用表实际量程"');
  });

  it('old toggle callbacks use current settings and stop after callback removal or unmount',()=>{
    const change=vi.fn();const app=mount<MultimeterControlPanelProps>(MultimeterControlPanel,{...model(),onChange:change});
    const old=button(app.tree,'外部电源');app.render(model({...model().parameters,powerOn:0}));invoke(old,'onClick');expect(change).toHaveBeenLastCalledWith({powerOn:1});
    app.render({onChange:undefined});invoke(old,'onClick');expect(change).toHaveBeenCalledOnce();
    expect(nodes(app.tree).filter(node=>node.type==='fieldset').every(node=>node.props.disabled===true)).toBe(true);
    app.render({onChange:change});app.unmount();invoke(old,'onClick');expect(change).toHaveBeenCalledOnce();
  });

  it('SVG switch/range and function buttons support Enter/Space with one-field commands',()=>{
    const change=vi.fn();const component=(props:ExpandedSceneProps)=>ElectricDiagram(useExpandedSceneControls(props));
    const app=mount(component,{...model(),onChange:change});
    const contact=(name:string)=>nodes(app.tree).find(node=>String(node.props['aria-label']??'').startsWith(name))!;
    const preventDefault=vi.fn();invoke(contact('切换下一量程'),'onKeyDown',{key:'Enter',preventDefault});expect(change).toHaveBeenLastCalledWith({rangeIndex:2});
    invoke(contact('断开总开关'),'onKeyDown',{key:' ',preventDefault});expect(change).toHaveBeenLastCalledWith({circuitClosed:0});
    invoke(contact('断开外部电源'),'onClick');expect(change).toHaveBeenLastCalledWith({powerOn:0});
    const action=nodes(app.tree).find(node=>node.type===Action&&node.props.label==='电阻挡')!;
    invoke(Action(action.props as Parameters<typeof Action>[0]),'onKeyDown',{key:'Enter',preventDefault});expect(change).toHaveBeenLastCalledWith({functionMode:2});
    const old=contact('切换下一量程');app.render({onChange:undefined});invoke(old,'onClick');expect(change).toHaveBeenCalledTimes(4);
    app.render({onChange:change});app.unmount();invoke(old,'onClick');expect(change).toHaveBeenCalledTimes(4);
  });

  it('Three knob rejects camera drag/right click and range actions preserve every other field',()=>{
    const change=vi.fn();const component=(props:ExpandedSceneProps)=>ElectricApparatus3D(useExpandedSceneControls(props));
    const app=mount(component,{...model(),onChange:change});
    const dial=nodes(app.tree).find(node=>(node.props.userData as {multimeterDial?:boolean})?.multimeterDial)!;
    for(const event of [{delta:10,button:0},{delta:0,button:2},{button:0}])invoke(dial,'onClick',{...event,stopPropagation:vi.fn()});
    expect(change).not.toHaveBeenCalled();invoke(dial,'onClick',{delta:0,button:0,stopPropagation:vi.fn()});expect(change).toHaveBeenLastCalledWith({functionMode:1});
    const range=nodes(app.tree).find(node=>node.type===SceneAction&&node.props.label==='下一量程')!;
    const sceneAction=SceneAction(range.props as Parameters<typeof SceneAction>[0]);
    invoke(nodes(sceneAction).find(node=>node.type==='mesh')!,'onClick',{delta:0,button:0,stopPropagation:vi.fn()});expect(change).toHaveBeenLastCalledWith({rangeIndex:2});
    app.unmount();invoke(dial,'onClick',{delta:0,button:0,stopPropagation:vi.fn()});expect(change).toHaveBeenCalledTimes(2);
  });
});
