

export function selectTeacherChineseVoice(voices: SpeechSynthesisVoice[]) {
  const chineseVoices = voices.filter((voice) => /^zh([_-]|$)/i.test(voice.lang));
  const candidates = chineseVoices.length ? chineseVoices : voices;
  const preferredNames: Array<[RegExp, number]> = [
    [/Xiaoxiao|晓晓|小晓/i, 190],
    [/Ting[- ]?Ting|Tingting|Mei[- ]?Jia|Meijia|Sin[- ]?Ji|Sinji|Yaoyao|Huihui/i, 170],
    [/Google.*(?:普通话|Mandarin|Chinese)|普通话|Mandarin/i, 155],
    [/Xiaoyi|Xiaohan|Xiaomeng|Xiaorui|小艺|晓涵|晓梦|晓睿/i, 145],
    [/Yunxi|Yunjian|Yunyang|Kangkang|云希|云健|云扬/i, 105]
  ];
  const noveltyVoices = /Grandpa|Grandma|Rocko|Eddy|Flo|Sandy|Shelley|Whisper|Wobble|Bahh|Bells|Bubbles/i;
  return [...candidates].sort((left, right) => {
    const score = (voice: SpeechSynthesisVoice) => {
      const nameScore = preferredNames.reduce((best, [pattern, value]) => pattern.test(voice.name) ? Math.max(best, value) : best, 0);
      const languageScore = /^zh[-_]CN$/i.test(voice.lang) ? 30 : /^zh/i.test(voice.lang) ? 20 : 0;
      const naturalScore = /Natural|Neural|自然/i.test(voice.name) ? 28 : 0;
      return nameScore + languageScore + naturalScore + (voice.localService ? 4 : 0) - (noveltyVoices.test(voice.name) ? 120 : 0);
    };
    return score(right) - score(left);
  })[0];
}
