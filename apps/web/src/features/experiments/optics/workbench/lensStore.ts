import { create } from "zustand";

export interface LensSceneState {
  focalLength: number;
  lensX: number;
  objectX: number;
  objectHeight: number;
  screenX: number;
  showRays: boolean;
  showGrid: boolean;
  showLabels: boolean;
}

interface LensHistoryState {
  scene: LensSceneState;
  past: LensSceneState[];
  future: LensSceneState[];
  update: (patch: Partial<LensSceneState>, remember?: boolean) => void;
  preview: (patch: Partial<LensSceneState>) => void;
  remember: (snapshot: LensSceneState) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  replace: (scene: LensSceneState) => void;
}

export const initialLensScene: LensSceneState = {
  focalLength: 15,
  lensX: 0,
  objectX: -45,
  objectHeight: 10,
  screenX: 22.5,
  showRays: true,
  showGrid: true,
  showLabels: true
};

const HISTORY_LIMIT = 60;

export const useLensStore = create<LensHistoryState>((set) => ({
  scene: initialLensScene,
  past: [],
  future: [],
  update: (patch, remember = true) => set((state) => ({
    scene: { ...state.scene, ...patch },
    past: remember ? [...state.past, state.scene].slice(-HISTORY_LIMIT) : state.past,
    future: remember ? [] : state.future
  })),
  preview: (patch) => set((state) => ({ scene: { ...state.scene, ...patch } })),
  remember: (snapshot) => set((state) => ({
    past: [...state.past, snapshot].slice(-HISTORY_LIMIT),
    future: []
  })),
  undo: () => set((state) => {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      scene: previous,
      past: state.past.slice(0, -1),
      future: [state.scene, ...state.future]
    };
  }),
  redo: () => set((state) => {
    const next = state.future[0];
    if (!next) return state;
    return {
      scene: next,
      past: [...state.past, state.scene],
      future: state.future.slice(1)
    };
  }),
  reset: () => set((state) => ({ scene: initialLensScene, past: [...state.past, state.scene], future: [] })),
  replace: (scene) => set({ scene, past: [], future: [] })
}));
