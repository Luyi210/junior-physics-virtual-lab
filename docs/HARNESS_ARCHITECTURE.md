# 无 LLM 探究 Harness 架构（v0.1）

## 目标

Harness 不负责计算物理规律，也不代替学生思考。它围绕实验运行过程提供四项共享能力：

1. 统一记录学生与实验的交互事件。
2. 保存学生自己的观察和问题。
3. 使用透明、可测试的规则提供方法提示。
4. 为未来的教师端、数据分析和可选 LLM 适配器提供稳定接口。

当前版本完全在浏览器本地运行，不发送数据，也没有调用任何大语言模型。

## 分层

```text
学生探索页面
  ├─ 光学探索模块
  └─ 声音 / 力学 / 电学 / 热学 / 密度
             │
             ▼
Web Harness Runtime
  ├─ 路由上下文识别
  ├─ Zustand 会话状态
  ├─ 探究伙伴面板
  └─ IndexedDB 持久化
             │
             ▼
@physics-lab/harness（纯 TypeScript）
  ├─ Session / Event / Observation
  ├─ RuleBasedLearningAssistant
  ├─ Rule Evaluator
  └─ LearningAssistant 稳定接口
             │
             ▼
@physics-lab/physics（事实与数值来源）
```

## 事件协议

第一版定义以下事件：

- `module.entered`：进入实验领域或情境。
- `control.changed`：改变连续实验参数。
- `simulation.toggled`：启动或暂停动态过程。
- `configuration.changed`：切换串并联、材料等离散配置。
- `observation.created`：学生保存一条观察。
- `insight.read`：学生阅读方法提示（接口已预留）。

所有事件都包含会话、实验领域、时间、类型和结构化负载。后续教师端只消费事件协议，不直接依赖某个页面组件。

## 规则助手边界

`RuleBasedLearningAssistant` 只做探究方法支架，例如：

- 建议一次只改变一个变量。
- 操作多次后提醒保存观察。
- 保存观察后建议重复实验或寻找反例。
- 第一次启动动态前提醒先做预测。

物理数值和规律必须来自 `@physics-lab/physics`，规则助手不能凭文本生成实验结果。

## 未来接入 LLM

`LearningAssistant` 已抽象为稳定接口：

```ts
interface LearningAssistant {
  provider: "rules" | "llm";
  respond(session, event): HarnessInsight[];
}
```

未来可以新增 `LlmLearningAssistant`，但必须遵守：

1. 物理计算仍调用确定性物理内核。
2. 默认保留规则助手作为离线降级方案。
3. 未经用户授权不上传学习记录。
4. LLM 输出经过物理规则验证后才能展示为结论。
5. 教师能够配置、关闭并审计智能提示。

## 下一阶段建议

- 将光学画布的拖拽位置也转换为节流后的结构化事件。
- 为每个实验增加领域规则，而不只使用通用探究规则。
- 增加会话导出与删除功能。
- 建立教师端可读取的探究轨迹 API。
- 为规则命中率、提示阅读率和实验完成质量建立测试数据集。
