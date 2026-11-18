import "./TutorHintLadder.css";

export type TutorHintLevel = 1 | 2 | 3;

type Props = {
  /** The last explicitly requested hint, not a measure of learning progress. */
  currentLevel: 0 | TutorHintLevel;
  disabled?: boolean;
  onSelect: (level: TutorHintLevel) => void;
  tone?: "warm" | "cosmic";
};

const levels = [
  { level: 1, ordinal: "一级", title: "观察方向", detail: "先看什么" },
  { level: 2, ordinal: "二级", title: "操作方法", detail: "怎样比较" },
  { level: 3, ordinal: "三级", title: "证据自检", detail: "还缺什么" },
] as const;

/** Both tutors expose the same controls while keeping their own guidance logic. */
export function TutorHintLadder({ currentLevel, disabled = false, onSelect, tone = "warm" }: Props) {
  const nextLevel = Math.min(currentLevel + 1, 3) as TutorHintLevel;
  const select = (level: TutorHintLevel) => { if (!disabled) onSelect(level); };
  return <section className={`tutor-hint-ladder tutor-hint-ladder--${tone}`} aria-label="按需查看分步提示">
    <div className="tutor-hint-ladder__heading">
      <div><strong>分步提示</strong><span>{currentLevel ? `上次查看：${levels[currentLevel - 1].title}` : "从一个小提示开始"}</span></div>
      <button className="tutor-hint-ladder__next" type="button" disabled={disabled} onClick={() => select(nextLevel)}>
        {currentLevel === 0 ? "开始提示" : currentLevel === 3 ? "再看自检" : "进一步提示"}<span aria-hidden="true">↗</span>
      </button>
    </div>
    <div className="tutor-hint-ladder__levels">
      {levels.map(({ level, ordinal, title, detail }) => <button
        key={level} type="button" disabled={disabled}
        className={currentLevel === level ? "is-current" : undefined}
        aria-label={`${ordinal}提示：${title}${currentLevel === level ? "（上次查看）" : ""}`}
        onClick={() => select(level)}
      >
        <span className="tutor-hint-ladder__index" aria-hidden="true">0{level}</span>
        <span className="tutor-hint-ladder__copy"><strong>{title}</strong><small>{detail}</small></span>
      </button>)}
    </div>
    <p className="tutor-hint-ladder__note">可任选一级；看过提示不代表完成实验。</p>
  </section>;
}
