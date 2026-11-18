export function OpticsMobileViewNote({ mode }: { mode: "2d" | "3d" }) {
  return <p className="optics-mobile-view-note">{mode === "2d"
    ? "手机推荐二维：照常调参、观察和读取结果。需要空间视角时，再选择三维。"
    : "已选择三维；如果画面卡顿，可切回二维继续，当前参数会保留。"}</p>;
}
