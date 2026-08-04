import { useEffect, useSyncExternalStore } from "react";

interface OrangeCatAvatarProps {
  mood?: "idle" | "listening" | "speaking" | "celebrating";
  compact?: boolean;
}

const avatarVariants = [
  { id: "original", label: "好奇光光", file: "orange-cat.png" },
  { id: "sitting", label: "端坐光光", file: "orange-cat-2.png" },
  { id: "loaf", label: "趴趴光光", file: "orange-cat-3.png" },
  { id: "tilt-white", label: "歪头光光", file: "orange-cat-4.png" },
  { id: "focused", label: "专注光光", file: "orange-cat-5.png" },
  { id: "tilt-orange", label: "好奇歪头光光", file: "orange-cat-6.png" }
] as const;

const avatarSessionKey = "physics-lab-orange-cat-avatar-v1";
const avatarListeners = new Set<() => void>();

function randomAvatarIndex() {
  return Math.floor(Math.random() * avatarVariants.length);
}

function initialAvatarIndex() {
  if (typeof window === "undefined") return 0;
  const stored = Number(window.sessionStorage.getItem(avatarSessionKey));
  if (Number.isInteger(stored) && stored >= 0 && stored < avatarVariants.length) return stored;
  const next = randomAvatarIndex();
  window.sessionStorage.setItem(avatarSessionKey, String(next));
  return next;
}

let activeAvatarIndex = initialAvatarIndex();
let avatarsPreloaded = false;

function subscribeAvatar(listener: () => void) {
  avatarListeners.add(listener);
  return () => {
    avatarListeners.delete(listener);
  };
}

function avatarSnapshot() {
  return activeAvatarIndex;
}

export function shuffleOrangeCatAvatar() {
  const offset = 1 + Math.floor(Math.random() * (avatarVariants.length - 1));
  activeAvatarIndex = (activeAvatarIndex + offset) % avatarVariants.length;
  if (typeof window !== "undefined") window.sessionStorage.setItem(avatarSessionKey, String(activeAvatarIndex));
  avatarListeners.forEach((listener) => listener());
}

export function useOrangeCatAvatarLabel() {
  const index = useSyncExternalStore(subscribeAvatar, avatarSnapshot, () => 0);
  return avatarVariants[index].label;
}

export function OrangeCatAvatar({ mood = "idle", compact = false }: OrangeCatAvatarProps) {
  const avatarIndex = useSyncExternalStore(subscribeAvatar, avatarSnapshot, () => 0);
  const avatar = avatarVariants[avatarIndex];
  const catImage = `${import.meta.env.BASE_URL}images/cat-assistant/${avatar.file}`;

  useEffect(() => {
    if (avatarsPreloaded || typeof window === "undefined") return;
    avatarsPreloaded = true;
    avatarVariants.forEach(({ file }) => {
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}images/cat-assistant/${file}`;
    });
  }, []);

  return (
    <span className={`orange-cat-avatar photo-cat avatar-${avatar.id} mood-${mood} ${compact ? "is-compact" : ""}`} aria-hidden="true" data-avatar-name={avatar.label}>
      <img src={catImage} alt="" draggable={false} />
      <i className="photo-cat-aura" />
      <i className="photo-cat-spark spark-one" />
      <i className="photo-cat-spark spark-two" />
      {mood === "speaking" && <b className="photo-cat-voice"><i /><i /><i /></b>}
    </span>
  );
}
