import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, BookMarked, Bot, Check, ChevronDown, Compass, Lightbulb, MessageCircle, Save, SendHorizontal, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { getHarnessQuickQuestions } from "@physics-lab/harness";
import type { HarnessArea, HarnessEventType } from "@physics-lab/harness";
import { useHarnessStore } from "./harnessStore";

const eventNames: Record<HarnessEventType, string> = {
  "module.entered": "进入实验情境",
  "control.changed": "调整实验参数",
  "simulation.toggled": "改变动态状态",
  "configuration.changed": "切换实验配置",
  "scene.navigated": "旋转或缩放三维场景",
  "view.changed": "切换三维观察视角",
  "observation.created": "保存一条观察",
  "insight.read": "查看方法提示",
  "dialogue.asked": "向探究伙伴提问"
};

const areaNames: Record<HarnessArea, string> = {
  optics: "光现象",
  lens: "透镜",
  sound: "声现象",
  mechanics: "运动与力",
  circuit: "电与磁",
  thermal: "热与物态",
  measurement: "质量与密度"
};

function routeHarnessContext(pathname: string, search: string): { area: HarnessArea; module: string } | undefined {
  const params = new URLSearchParams(search);
  if (pathname === "/student/explore/light") {
    return { area: "optics", module: params.get("mode") ?? "overview" };
  }
  const value = pathname.match(/^\/student\/explore\/(sound|mechanics|circuit|thermal|measurement)$/)?.[1];
  if (!value) return undefined;
  return { area: value as HarnessArea, module: params.get("module") ?? `${value}-overview` };
}

export function HarnessRuntime() {
  const location = useLocation();
  const context = useMemo(() => routeHarnessContext(location.pathname, location.search), [location.pathname, location.search]);
  const enterArea = useHarnessStore((state) => state.enterArea);
  const setPanelOpen = useHarnessStore((state) => state.setPanelOpen);

  useEffect(() => {
    if (context) void enterArea(context.area, context.module);
  }, [context, enterArea]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("harness") === "dialogue") setPanelOpen(true);
  }, [location.search, setPanelOpen]);

  if (!context) return null;
  return <HarnessPanel />;
}

function HarnessPanel() {
  const activeArea = useHarnessStore((state) => state.activeArea);
  const activeModule = useHarnessStore((state) => state.activeModule);
  const session = useHarnessStore((state) => state.session);
  const loading = useHarnessStore((state) => state.loading);
  const panelOpen = useHarnessStore((state) => state.panelOpen);
  const setPanelOpen = useHarnessStore((state) => state.setPanelOpen);
  const askQuestion = useHarnessStore((state) => state.askQuestion);
  const saveObservation = useHarnessStore((state) => state.saveObservation);
  const readInsight = useHarnessStore((state) => state.readInsight);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const streamEndRef = useRef<HTMLDivElement>(null);

  const unread = session?.insights.filter((item) => !item.read).length ?? 0;
  const latestInsight = session?.insights.at(-1);
  const recentEvents = session?.events.slice(-5).reverse() ?? [];
  const dialogue = (session?.dialogue ?? []).filter((message) => message.module === activeModule).slice(-14);
  const quickQuestions = activeArea && activeModule ? getHarnessQuickQuestions(activeModule, activeArea) : [];
  const lastFollowUps = [...dialogue].reverse().find((message) => message.role === "assistant")?.followUps;
  const suggestions = lastFollowUps?.length ? lastFollowUps : quickQuestions;

  useEffect(() => {
    if (!panelOpen) return;
    streamEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [dialogue.length, panelOpen, activeModule]);

  const send = (text = draft) => {
    const question = text.trim();
    if (!question || !askQuestion(question)) return;
    setDraft("");
  };

  const save = () => {
    if (!saveObservation(draft)) return;
    setDraft("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  };

  return (
    <>
      <button className="harness-dock-trigger harness-dialogue-trigger" onClick={() => setPanelOpen(true)} aria-label="打开可交流的探究伙伴">
        <MessageCircle size={19} />
        <span><small>RULE DIALOGUE · NO LLM</small><strong>和探究伙伴交流</strong></span>
        {unread > 0 && <b>{unread}</b>}
      </button>

      {panelOpen && (
        <aside className="harness-panel harness-dialogue-panel" aria-label="无 LLM 半对话探究伙伴">
          <header>
            <div className="harness-panel-mark"><Compass size={20} /></div>
            <div><span>INQUIRY HARNESS / 半对话支架</span><strong>本地探究伙伴</strong></div>
            <button onClick={() => setPanelOpen(false)} aria-label="收起探究伙伴"><X size={17} /></button>
          </header>

          <div className="harness-assurance harness-dialogue-assurance">
            <ShieldCheck size={16} />
            <span><strong>规则对话 · 不联网 · 不调用 LLM</strong><small>结合当前实验与操作记录回答，超出规则库会明确说明</small></span>
          </div>

          {loading || !session || !activeArea || !activeModule ? (
            <div className="harness-loading"><span /><p>正在恢复本地探究记录…</p></div>
          ) : (
            <div className="harness-panel-body harness-dialogue-body">
              <section className="harness-dialogue-context">
                <div><span>当前讨论</span><strong>{areaNames[activeArea]} · {activeModule.replaceAll("-", " ")}</strong></div>
                <div className="harness-dialogue-metrics"><span><Activity size={13} />{session.events.length} 次操作</span><span><BookMarked size={13} />{session.observations.length} 条发现</span></div>
              </section>

              <section className="harness-chat" aria-live="polite">
                <div className="harness-chat-stream">
                  {dialogue.length === 0 && (
                    <article className="harness-message assistant welcome">
                      <i><Bot size={16} /></i>
                      <div><small>探究伙伴</small><p>我已经连接到当前实验。你可以问我下一步观察什么、为什么会出现这个现象，或者让我帮助你把猜想变成可检验的实验。</p><em>我的回答来自本地规则，不是大语言模型。</em></div>
                    </article>
                  )}
                  {dialogue.map((message) => (
                    <article className={`harness-message ${message.role}`} key={message.id}>
                      <i>{message.role === "assistant" ? <Bot size={16} /> : <UserRound size={16} />}</i>
                      <div><small>{message.role === "assistant" ? "探究伙伴" : "我的问题"}</small><p>{message.text}</p>{message.intent && <em>{message.intent.toUpperCase()} · RULE RESPONSE</em>}</div>
                    </article>
                  ))}
                  <div ref={streamEndRef} />
                </div>

                <div className="harness-quick-questions" aria-label="快捷提问">
                  <span>接着问</span>
                  <div>{suggestions.slice(0, 4).map((question) => <button onClick={() => send(question)} key={question}>{question}</button>)}</div>
                </div>

                <div className="harness-composer">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        send();
                      }
                    }}
                    placeholder="输入与当前实验有关的问题或猜想……"
                    aria-label="向探究伙伴提问"
                  />
                  <button className="harness-send" onClick={() => send()} disabled={!draft.trim()}><SendHorizontal size={16} /><span>发送问题</span></button>
                  <button className="harness-save-observation" onClick={save} disabled={!draft.trim()}>{saved ? <Check size={15} /> : <Save size={15} />}{saved ? "已保存" : "保存为观察"}</button>
                  <small>Enter 发送 · Shift + Enter 换行</small>
                </div>
              </section>

              {latestInsight && (
                <button className={`harness-live-insight ${latestInsight.read ? "read" : ""}`} onClick={() => readInsight(latestInsight.id)}>
                  <Lightbulb size={17} /><span><small>规则引擎刚刚注意到</small><strong>{latestInsight.title}</strong><p>{latestInsight.message}</p></span>{!latestInsight.read && <b>新</b>}
                </button>
              )}

              <details className="harness-trace harness-dialogue-trace">
                <summary><span>探究档案与最近事件</span><ChevronDown size={14} /></summary>
                <ol>{recentEvents.map((event) => <li key={event.id}><i /><span>{eventNames[event.type]}</span><time>{new Date(event.occurredAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time></li>)}</ol>
              </details>
            </div>
          )}

          <footer><span>PHYSICS HARNESS · RULE DIALOGUE v0.2</span><button onClick={() => setPanelOpen(false)}>回到实验 <ArrowRight size={14} /></button></footer>
        </aside>
      )}
    </>
  );
}
