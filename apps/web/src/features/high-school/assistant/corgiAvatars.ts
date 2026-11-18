export const CORGI_AVATAR_COUNT = 5;
export const CORGI_ROTATION_INTERVAL_MS = 15_000;
const CORGI_PORTRAITS = [
  { name: "微笑相伴", alt: "微笑相伴：三色柯基微笑趴卧" },
  { name: "元气端坐", alt: "元气端坐：黄白柯基全身坐姿" },
  { name: "认真倾听", alt: "认真倾听：柯基安静面向前方" },
  { name: "开心守候", alt: "开心守候：三色柯基坐姿" },
  { name: "安静陪伴", alt: "安静陪伴：柯基趴卧近景" },
] as const;

export function normalizeCorgiIndex(index: number): number {
  return Number.isSafeInteger(index) ? ((index % CORGI_AVATAR_COUNT) + CORGI_AVATAR_COUNT) % CORGI_AVATAR_COUNT : 0;
}

export function corgiAvatarAsset(index: number, baseUrl = import.meta.env.BASE_URL) {
  const normalized = normalizeCorgiIndex(index);
  const id = String(normalized + 1).padStart(2, "0");
  return { id: `corgi-${id}`, label: `${id} · ${CORGI_PORTRAITS[normalized].name}`, alt: CORGI_PORTRAITS[normalized].alt, src: `${baseUrl.replace(/\/?$/, "/")}assets/lili/corgi-${id}.webp` };
}

export function corgiSourceUrl(baseUrl = import.meta.env.BASE_URL) {
  return `${baseUrl.replace(/\/?$/, "/")}assets/lili/SOURCES.html`;
}
