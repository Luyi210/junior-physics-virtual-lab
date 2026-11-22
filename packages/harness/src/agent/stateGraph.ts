export const GRAPH_END = "__END__" as const;

export type GraphEnd = typeof GRAPH_END;
export type GraphNodeName<TNode extends string> = TNode | GraphEnd;
export type GraphNodeHandler<TState> = (state: TState) => Partial<TState> | void;
export type GraphRouter<TState, TNode extends string> = (state: TState) => GraphNodeName<TNode>;

export interface AgentTraceStep {
  node: string;
  label: string;
  summary: string;
}

export interface CompiledAgentGraph<TState> {
  invoke(initialState: TState): {
    state: TState;
    trace: AgentTraceStep[];
  };
}

interface NodeRecord<TState> {
  label: string;
  handler: GraphNodeHandler<TState>;
  summarize?: (state: TState) => string;
}

/**
 * Lightweight, deterministic StateGraph runtime modeled on LangGraphJS.
 * Runs identically in Node.js (API) and browser (offline/demo mode) with zero external bundle cost.
 */
export class AgentStateGraph<TState extends Record<string, unknown>, TNode extends string = string> {
  private readonly nodes = new Map<TNode, NodeRecord<TState>>();
  private readonly edges = new Map<TNode, GraphNodeName<TNode>>();
  private readonly conditionalEdges = new Map<TNode, GraphRouter<TState, TNode>>();
  private entryPoint: TNode | null = null;
  private readonly maxSteps: number;

  constructor(options: { maxSteps?: number } = {}) {
    this.maxSteps = Math.max(1, Math.min(options.maxSteps ?? 16, 64));
  }

  addNode(name: TNode, handler: GraphNodeHandler<TState>, meta: { label?: string; summarize?: (state: TState) => string } = {}): this {
    this.nodes.set(name, {
      label: meta.label ?? name,
      handler,
      summarize: meta.summarize
    });
    return this;
  }

  setEntryPoint(name: TNode): this {
    this.entryPoint = name;
    return this;
  }

  addEdge(from: TNode, to: GraphNodeName<TNode>): this {
    this.edges.set(from, to);
    return this;
  }

  addConditionalEdges(from: TNode, router: GraphRouter<TState, TNode>): this {
    this.conditionalEdges.set(from, router);
    return this;
  }

  compile(): CompiledAgentGraph<TState> {
    if (!this.entryPoint || !this.nodes.has(this.entryPoint)) {
      throw new Error("AgentStateGraph requires a registered entry point.");
    }
    const entry = this.entryPoint;
    const nodes = new Map(this.nodes);
    const edges = new Map(this.edges);
    const conditionalEdges = new Map(this.conditionalEdges);
    const maxSteps = this.maxSteps;

    return {
      invoke(initialState: TState) {
        let state: TState = { ...initialState };
        const trace: AgentTraceStep[] = [];
        let current: GraphNodeName<TNode> = entry;
        let steps = 0;

        while (current !== GRAPH_END) {
          steps += 1;
          if (steps > maxSteps) {
            throw new Error(`AgentStateGraph exceeded maxSteps (${maxSteps}) at node "${current}".`);
          }
          const record = nodes.get(current);
          if (!record) {
            throw new Error(`AgentStateGraph encountered unknown node "${current}".`);
          }
          const patch = record.handler(state);
          if (patch && typeof patch === "object") {
            state = { ...state, ...patch };
          }
          trace.push({
            node: current,
            label: record.label,
            summary: record.summarize ? record.summarize(state) : ""
          });

          const router = conditionalEdges.get(current);
          if (router) {
            current = router(state);
          } else if (edges.has(current)) {
            current = edges.get(current)!;
          } else {
            current = GRAPH_END;
          }
        }

        return { state, trace };
      }
    };
  }
}
