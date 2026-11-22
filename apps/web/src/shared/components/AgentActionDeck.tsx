import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Compass,
  HelpCircle,
  Lightbulb,
  PenTool,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users
} from "lucide-react";
import type {
  BktSkillSnapshot,
  LearnerMemoryItem,
  TutorAgentAction,
  TutorAgentResult
} from "@physics-lab/harness/agent";
import { PhysicsScratchpad } from "./PhysicsScratchpad";
import "./AgentDeck.css";

export function AgentActionDeck({
  result,
  tone = "warm",
  disabled = false,
  onAsk,
  onHint,
  onNavigate,
  onApplyParams,
  onQuizChoice
}: {
  result?: Pick<TutorAgentResult, "intentLabel" | "memoryHint" | "peerTurn" | "actions" | "trace"> | null;
  tone?: "warm" | "cosmic";
  disabled?: boolean;
  onAsk: (prompt: string) => void;
  onHint: (level: 1 | 2 | 3) => void;
  onNavigate?: () => void;
  onApplyParams?: (experimentId: string, patch: Record<string, number>, route?: string) => { applied: boolean; message: string };
  onQuizChoice?: (action: TutorAgentAction) => void;
}) {
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  if (!result) return null;
  const hasContent = Boolean(result.memoryHint || result.peerTurn || result.actions.length || result.trace.length);
  if (!hasContent) return null;

  const renderAction = (action: TutorAgentAction) => {
    if (action.kind === "apply-params" && action.targetExperimentId && action.paramsPatch && onApplyParams) {
      return (
        <button
          key={action.id}
          type="button"
          className="agent-action-card is-apply-params"
          title={action.description}
          disabled={disabled}
          onClick={() => {
            const outcome = onApplyParams(action.targetExperimentId!, action.paramsPatch!, action.route);
            setApplyFeedback(outcome.message);
          }}
        >
          <SlidersHorizontal size={13} aria-hidden="true" />
          <span>{action.label}</span>
        </button>
      );
    }
    if (action.kind === "quiz-choice" && action.prompt) {
      const picked = selectedQuizId === action.id;
      return (
        <button
          key={action.id}
          type="button"
          className={`agent-action-card is-quiz${picked ? " is-picked" : ""}`}
          title={action.description}
          disabled={disabled || selectedQuizId !== null}
          onClick={() => {
            setSelectedQuizId(action.id);
            if (onQuizChoice) onQuizChoice(action);
            else onAsk(action.prompt!);
          }}
        >
          <CheckCircle2 size={13} aria-hidden="true" />
          <span>{action.label}</span>
        </button>
      );
    }
    if (action.kind === "navigate" && action.route) {
      return (
        <Link
          key={action.id}
          to={action.route}
          className="agent-action-card is-navigate"
          title={action.description}
          onClick={onNavigate}
        >
          <Compass size={13} aria-hidden="true" />
          <span>{action.label}</span>
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      );
    }
    if (action.kind === "hint" && action.hintLevel) {
      return (
        <button
          key={action.id}
          type="button"
          className="agent-action-card"
          title={action.description}
          disabled={disabled}
          onClick={() => onHint(action.hintLevel!)}
        >
          <Lightbulb size={13} aria-hidden="true" />
          <span>{action.label}</span>
        </button>
      );
    }
    if (action.prompt) {
      return (
        <button
          key={action.id}
          type="button"
          className="agent-action-card"
          title={action.description}
          disabled={disabled}
          onClick={() => onAsk(action.prompt!)}
        >
          <Sparkles size={13} aria-hidden="true" />
          <span>{action.label}</span>
        </button>
      );
    }
    return null;
  };

  return (
    <div className={`agent-action-deck tone-${tone}`}>
      {result.peerTurn && (
        <div className="agent-peer-bubble" role="note" aria-label="情境实验同桌发言">
          <div className="agent-peer-header">
            <Users size={13} aria-hidden="true" />
            <strong>{result.peerTurn.speakerName}</strong>
            <span>{result.peerTurn.roleLabel}</span>
          </div>
          <p className="agent-peer-utterance">“{result.peerTurn.utterance}”</p>
          <small className="agent-peer-challenge">{result.peerTurn.challengePrompt}</small>
        </div>
      )}
      {result.memoryHint && (
        <div className="agent-memory-hint">
          <BrainCircuit size={13} aria-hidden="true" />
          <span>{result.memoryHint}</span>
        </div>
      )}
      {result.actions.length > 0 && (
        <div className="agent-action-cards" role="group" aria-label="智能体联动建议">
          {result.actions.map(renderAction)}
        </div>
      )}
      {applyFeedback && (
        <p className="agent-apply-feedback" role="status">
          <SlidersHorizontal size={12} aria-hidden="true" />
          <span>{applyFeedback}</span>
        </p>
      )}
      {result.trace.length > 0 && (
        <details className="agent-trace-details">
          <summary>
            <BrainCircuit size={11} aria-hidden="true" />
            <span>智能体路径 · {result.intentLabel}（{result.trace.length} 步）</span>
          </summary>
          <ol>
            {result.trace.map((step) => (
              <li key={step.node}>
                <strong>{step.label}</strong>
                {step.summary ? `：${step.summary}` : ""}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

export function AgentQuickTools({
  tone = "warm",
  disabled = false,
  memories,
  bktSnapshots = [],
  onPrefillProblem,
  onStartQuiz,
  onStartWeakestQuiz,
  onStartPeerDebate,
  onSendScratchpad,
  onDeleteMemory
}: {
  tone?: "warm" | "cosmic";
  disabled?: boolean;
  memories: readonly LearnerMemoryItem[];
  bktSnapshots?: readonly BktSkillSnapshot[];
  onPrefillProblem: () => void;
  onStartQuiz: () => void;
  onStartWeakestQuiz?: () => void;
  onStartPeerDebate?: () => void;
  onSendScratchpad?: (summary: string) => void;
  onDeleteMemory: (id: string) => void;
}) {
  const [activeDrawer, setActiveDrawer] = useState<"none" | "memories" | "bkt" | "scratchpad">("none");

  const toggleDrawer = (target: "memories" | "bkt" | "scratchpad") => {
    setActiveDrawer((current) => (current === target ? "none" : target));
  };

  const assessedCount = bktSnapshots.filter((s) => s.attempts > 0).length;

  return (
    <div className={`agent-quick-tools tone-${tone}`} aria-label="智能体增强工具">
      <div className="agent-quick-tools-row">
        <button type="button" className="agent-quick-btn" disabled={disabled} onClick={onPrefillProblem}>
          <Compass size={13} aria-hidden="true" />
          <span>输题找实验</span>
        </button>
        <button type="button" className="agent-quick-btn" disabled={disabled} onClick={onStartQuiz}>
          <HelpCircle size={13} aria-hidden="true" />
          <span>考考我</span>
        </button>
        {onStartPeerDebate && (
          <button type="button" className="agent-quick-btn" disabled={disabled} onClick={onStartPeerDebate}>
            <Users size={13} aria-hidden="true" />
            <span>同桌讨论</span>
          </button>
        )}
        {onSendScratchpad && (
          <button
            type="button"
            className={`agent-quick-btn${activeDrawer === "scratchpad" ? " is-active" : ""}`}
            aria-expanded={activeDrawer === "scratchpad"}
            onClick={() => toggleDrawer("scratchpad")}
          >
            <PenTool size={13} aria-hidden="true" />
            <span>草图白板</span>
          </button>
        )}
        {bktSnapshots.length > 0 && (
          <button
            type="button"
            className={`agent-quick-btn${activeDrawer === "bkt" ? " is-active" : ""}`}
            aria-expanded={activeDrawer === "bkt"}
            onClick={() => toggleDrawer("bkt")}
          >
            <BarChart3 size={13} aria-hidden="true" />
            <span>自测进度 ({assessedCount}/{bktSnapshots.length})</span>
          </button>
        )}
        {memories.length > 0 && (
          <button
            type="button"
            className={`agent-quick-btn${activeDrawer === "memories" ? " is-active" : ""}`}
            aria-expanded={activeDrawer === "memories"}
            onClick={() => toggleDrawer("memories")}
          >
            <BrainCircuit size={13} aria-hidden="true" />
            <span>长期记忆 ({memories.length})</span>
          </button>
        )}
      </div>

      {activeDrawer === "scratchpad" && onSendScratchpad && (
        <PhysicsScratchpad
          tone={tone}
          disabled={disabled}
          onSendSummary={(summary) => {
            onSendScratchpad(summary);
            setActiveDrawer("none");
          }}
        />
      )}

      {activeDrawer === "bkt" && bktSnapshots.length > 0 && (
        <div className="agent-bkt-panel" aria-label="BKT物理知识点掌握度">
          <div className="agent-bkt-header">
            <span>自测后的练习估计（仅本机参考）</span>
            {onStartWeakestQuiz && (
              <button
                type="button"
                className="agent-bkt-practice-btn"
                disabled={disabled}
                onClick={() => {
                  onStartWeakestQuiz();
                  setActiveDrawer("none");
                }}
              >
                <Sparkles size={11} aria-hidden="true" />
                <span>专练薄弱点</span>
              </button>
            )}
          </div>
          <div className="agent-bkt-list">
            {bktSnapshots.map((skill) => (
              <div key={skill.skillId} className={`agent-bkt-row status-${skill.status}`}>
                <div className="agent-bkt-row-top">
                  <span>{skill.label}</span>
                  <strong>{skill.attempts ? `${skill.masteryPercent}%` : "未自测"}</strong>
                </div>
                <div className="agent-bkt-bar">
                  <i style={{ width: `${skill.attempts ? skill.masteryPercent : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeDrawer === "memories" && memories.length > 0 && (
        <div className="agent-memory-list" aria-label="跨实验学习记忆">
          {memories.slice(0, 4).map((memory) => (
            <div key={memory.id} className="agent-memory-item">
              <span>
                <strong>{memory.topic}</strong>：{memory.summary}
              </span>
              <button
                type="button"
                aria-label={`忘记记忆 ${memory.topic}`}
                title="移除这条记忆"
                onClick={() => onDeleteMemory(memory.id)}
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
