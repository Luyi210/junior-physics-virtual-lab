import { Sun, Info } from "lucide-react";
import { publicAsset } from "../shared/assets";

export function ShadowlessLampLife() {
  const scenes = [
    {
      number: "01",
      title: "一只灯头，里面有许多发光单元",
      tag: "多个位置同时发光",
      image: publicAsset("images/shadowless-lamp/lamp-closeup.jpg"),
      alt: "由多个反光面和发光区域组成的手术无影灯灯头",
      text: "无影灯不是只从一个小点发光。灯头里的多个灯珠或反光面，让光从不同位置同时射向同一片区域。"
    },
    {
      number: "02",
      title: "多个灯头，从不同方向照明",
      tag: "让光线绕开遮挡",
      image: publicAsset("images/shadowless-lamp/cardiac-operating-room.jpg"),
      alt: "手术室内悬挂在手术台上方的多个圆形无影灯",
      text: "手术台上方常有两个或更多灯头。医生的头或手挡住一个方向的光时，其他方向的光仍能到达手术区域。"
    },
    {
      number: "03",
      title: "灯头对准同一个工作区域",
      tag: "阴影被其他光束补亮",
      image: publicAsset("images/shadowless-lamp/laparoscopic-operating-room.jpg"),
      alt: "无影灯安装在手术台上方的现代手术室",
      text: "不同方向形成的影子位置并不完全重合。某束光留下的暗处，会被其他光束照亮，因此看起来影子很淡。"
    }
  ];

  return <section className="rainbow-life-section shadowless-life-section" aria-labelledby="shadowless-life-title">
    <header>
      <div><span>PHYSICS IN DAILY LIFE / 物理走进生活</span><h2 id="shadowless-life-title">医生的手挡住了光，<br />为什么手术区仍然明亮？</h2></div>
      <div><Sun size={22} /><p><strong>无影灯并不是“完全没有影子”。</strong>它利用多个方向的光共同照明，让一束光被遮挡时，其他光线仍能沿直线到达目标区域，把明显的暗影补亮。</p></div>
    </header>
    <div className="rainbow-life-grid shadowless-photo-grid">{scenes.map((scene) => <article key={scene.number}>
      <figure><img src={scene.image} alt={scene.alt} loading="lazy" /><figcaption><b>{scene.number}</b><span>{scene.tag}</span></figcaption></figure>
      <div><h3>{scene.title}</h3><p>{scene.text}</p></div>
    </article>)}</div>
    <div className="rainbow-mechanism-strip shadowless-mechanism-strip">
      <span><b>多个位置发光</b><small>每个灯珠都能发出一组光线</small></span><i>→</i>
      <span><b>光沿直线传播</b><small>不同方向的光同时照向手术区</small></span><i>→</i>
      <span><b>遮住部分光线</b><small>手或器械只能挡住其中一些方向</small></span><i>→</i>
      <span><b>其余光线补亮</b><small>阴影变浅，观察区域仍然清楚</small></span>
    </div>
    <aside><Info size={19} /><p><b>一句话理解：</b>无影灯没有让光“拐弯”，每一束光仍然沿直线传播；它只是让更多束光从不同方向到达同一个地方。</p></aside>
    <small className="photo-credit">图片来源：Wikimedia Commons · <a href="https://commons.wikimedia.org/wiki/File:Lampada_scialitica.jpg" target="_blank" rel="noreferrer">Glaucolongoni（CC BY-SA 4.0）</a>、<a href="https://commons.wikimedia.org/wiki/File:Cardiac_operating_room.jpg" target="_blank" rel="noreferrer">Ruhrfisch（CC BY-SA 2.0）</a>、<a href="https://commons.wikimedia.org/wiki/File:Laparoscopic_operating_theatre.jpg" target="_blank" rel="noreferrer">Dr.jayesh amin（CC BY-SA 3.0）</a></small>
  </section>;
}
