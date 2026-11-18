import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TutorHintLadder, type TutorHintLevel } from "./TutorHintLadder";

type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  return Array.isArray(node) ? node.flatMap(nodes) : isValidElement<Record<string, unknown>>(node) ? [node, ...nodes(node.props.children as ReactNode)] : [];
}

describe("tutor hints are optional scaffolds, not a completion score", () => {
  it("lets a learner progress one level at a time without inventing a fourth level", () => {
    let current: 0 | TutorHintLevel = 0;
    const selected: number[] = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      const tree = TutorHintLadder({ currentLevel: current, onSelect: (level) => { selected.push(level); current = level; } });
      const next = nodes(tree).find(node => node.props.className === "tutor-hint-ladder__next")!;
      (next.props.onClick as () => void)();
    }
    expect(selected).toEqual([1, 2, 3, 3]);
    const html = renderToStaticMarkup(<TutorHintLadder currentLevel={3} onSelect={() => {}} />);
    expect(html).toContain("上次查看：证据自检");
    expect(html).toContain("看过提示不代表完成实验");
    expect(html).not.toContain("已掌握");
    expect(html).not.toContain("progressbar");
  });

  it("allows direct choice and prevents all submissions while a tutor is busy", () => {
    const select = vi.fn();
    const tree = TutorHintLadder({ currentLevel: 0, onSelect: select });
    const third = nodes(tree).find(node => node.props["aria-label"] === "三级提示：证据自检")!;
    (third.props.onClick as () => void)();
    expect(select).toHaveBeenCalledExactlyOnceWith(3);
    select.mockClear();
    const blocked = TutorHintLadder({ currentLevel: 1, disabled: true, onSelect: select, tone: "cosmic" });
    const buttons = nodes(blocked).filter(node => node.type === "button");
    expect(buttons).toHaveLength(4);
    for (const button of buttons) {
      expect(button.props.disabled).toBe(true);
      expect(button.props.type).toBe("button");
      (button.props.onClick as () => void)();
    }
    expect(select).not.toHaveBeenCalled();
  });
});
