/** Keep experiment routing and optional AI away from unsafe or fabricated-evidence requests. */
export function protectedTutorReply(question: string): string | null {
  if (/系统提示|忽略.*规则|API.?key|密钥|密码|执行.*命令|system prompt/iu.test(question)) {
    return "我负责辅导物理实验，不能提供系统配置或执行命令。请告诉我想研究的实验现象。";
  }
  if (/激光.*(眼|直视)|直视.*激光|市电|插座|短接|短路|烫伤/iu.test(question)) {
    return "实物实验请先停止危险操作：不要直视激光，电学实验只使用教师指导下的低压电源，不接市电或短接电源。虚拟实验不能代替真实器材的安全检查。";
  }
  if (/编造|伪造|假装.*测|(?:替我|帮我|代我|直接).{0,10}(?:写|生成).{0,12}(?:数据|报告)|生成.*(?:真实|实测).*数据/iu.test(question)) {
    return "我可以解释虚拟模型的预测，但不能把计算值写成你亲自测得的数据。请先保存实际操作的虚拟读数，再核对条件与单位。";
  }
  return null;
}
