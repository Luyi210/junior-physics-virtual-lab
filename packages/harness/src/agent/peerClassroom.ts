import type { LearnerMemoryScope } from "./learnerMemory.ts";

export interface PeerClassmateTurn {
  speakerName: string;
  roleLabel: string;
  stance: "misconception-trap" | "prediction-partner";
  utterance: string;
  challengePrompt: string;
}

const PEER_SCRIPTS: Record<string, Omit<PeerClassmateTurn, "speakerName" | "roleLabel">> = {
  lens: {
    stance: "misconception-trap",
    utterance: "等等，我刚才把蜡烛离凸透镜更近了一点（还在 1 倍和 2 倍焦距之间），我觉得像应该变小才对，因为东西靠近透镜不就变紧凑了吗？",
    challengePrompt: "帮小研纠正一下：物距减小时（u > f），像距和像的大小其实是怎么变的？"
  },
  "circuit-ohm": {
    stance: "misconception-trap",
    utterance: "我把定值电阻两端的电压从 3V 调到 6V，电流变大了，所以我写结论说“电阻也跟着变小了一半”，这样对吗？",
    challengePrompt: "指出小研的漏洞：电压翻倍时，定值电阻的阻值本身变了吗？"
  },
  "mechanics-buoyancy": {
    stance: "misconception-trap",
    utterance: "石头已经完全沉在水里了，我觉得再往深处按，水压变大了，所以它受到的浮力肯定也会越来越大！",
    challengePrompt: "用阿基米德原理反驳小研：完全浸没后继续下沉，排开液体的体积变了吗？"
  },
  "mechanics-lever": {
    stance: "prediction-partner",
    utterance: "如果我把右边的弹簧测力计斜着拉，我猜需要的拉力会比竖直拉更小，因为斜着拉好像更省劲？",
    challengePrompt: "斜拉时动力臂是变长还是变短了？拉力应该变大还是变小？"
  },
  pendulum: {
    stance: "misconception-trap",
    utterance: "我在单摆上换了一个质量重一倍的铁球，摆长和摆角都没动，我猜它肯定摆得更快、周期变短！",
    challengePrompt: "给小研做个裁判：单摆周期和摆球质量有关吗？去实验台验证一下吧。"
  },
  "double-slit": {
    stance: "misconception-trap",
    utterance: "我想让双缝干涉的亮纹间距 Δx 变宽一点更好读数，那我应该把双缝间距 d 调大，还是调小？我感觉 d 越大条纹应该越宽吧？",
    challengePrompt: "帮小研核对公式 Δx = Lλ/d：调大 d 会让亮纹变宽还是变密？"
  },
  "capacitor-charge": {
    stance: "misconception-trap",
    utterance: "我把电容器开关从充电挡切到断路挡了，我觉得电路断开了，电容器两端的电压应该瞬间掉回 0V 吧？",
    challengePrompt: "告诉小研断路保持段会发生什么：电流归零了，电压和电荷会瞬间消失吗？"
  },
  "projectile-motion": {
    stance: "prediction-partner",
    utterance: "同一高度水平抛出小球，我把水平初速度调到原来 2 倍，那它飞得更远，在空中停留的时间应该也变成 2 倍吧？",
    challengePrompt: "平抛运动竖直方向是什么运动？水平初速度翻倍会改变落地时间吗？"
  },
  "spring-force": {
    stance: "misconception-trap",
    utterance: "我直接用“弹力 ÷ 弹簧总长度 L”算出来的劲度系数 k，为什么每次挂不同砝码算出来的 k 都不一样啊？",
    challengePrompt: "帮小研找出计算错误：胡克定律里的 x 应该是总长 L 还是伸长量 ΔL？"
  },
  "newton-second-law": {
    stance: "misconception-trap",
    utterance: "我觉得小车启动加速时，绳子的拉力就严格等于下面挂的槽码重力 mg，反正绳子是连着的嘛！",
    challengePrompt: "槽码自己也在向下加速，绳子拉力比 mg 大还是小？"
  },
  "emf-internal-resistance": {
    stance: "prediction-partner",
    utterance: "我把外电阻调大以后，电路电流变小了，所以我猜电源的路端电压 U 也会跟着变小，对不对？",
    challengePrompt: "根据 U = E - Ir，外电阻变大、电流 I 变小时，路端电压 U 怎么变？"
  },
  "photoelectric-effect": {
    stance: "misconception-trap",
    utterance: "红光打不出光电子，那我把红光的亮度调到最大、照久一点，总能攒够能量把电子打出来吧？",
    challengePrompt: "用爱因斯坦光电效应方程解释给小研听：能不能打出光电子取决于光强还是频率？"
  }
};

export function createPeerClassmateTurn(
  scope: LearnerMemoryScope,
  experimentId: string | null | undefined,
  experimentName?: string | null
): PeerClassmateTurn {
  const key = experimentId ?? "";
  const exact = key ? PEER_SCRIPTS[key] ?? Object.entries(PEER_SCRIPTS).find(([k]) => key.includes(k) || k.includes(key))?.[1] : undefined;
  if (exact) {
    return {
      speakerName: "小研",
      roleLabel: scope === "high-school" ? "高中实验同桌" : "初中实验同桌",
      ...exact
    };
  }
  const title = experimentName || "这个实验";
  return {
    speakerName: "小研",
    roleLabel: scope === "high-school" ? "高中实验同桌" : "初中实验同桌",
    stance: "prediction-partner",
    utterance: `我正在做「${title}」，打算一次性把两个滑块都调大，这样能更快看到明显变化——不过我隐约觉得老师好像不让这么干？`,
    challengePrompt: "告诉小研为什么一次只能改一个自变量，并帮他选定这一轮要保持不变的控制变量！"
  };
}
