import { useState, type CSSProperties } from "react";
import { LegacyCorgiAvatar } from "./LegacyCorgiAvatar";
import { corgiAvatarAsset } from "./corgiAvatars";
import "./CorgiAvatar.css";

/** One controlled image, with no timer of its own. Both assistant placements share an index. */
export function CorgiAvatar({ speaking = false, avatarIndex = 0, size = 72 }: { speaking?: boolean; avatarIndex?: number; size?: 32 | 72 | 96 }) {
  const avatar = corgiAvatarAsset(avatarIndex);
  return <span className={`lili-corgi lili-corgi-photo${speaking ? " is-speaking" : ""}`} style={{ "--corgi-size": `${size}px` } as CSSProperties} aria-hidden="true" data-corgi-avatar={avatar.id}>
    <CorgiPhoto key={avatar.src} src={avatar.src} alt={avatar.alt} speaking={speaking} />
  </span>;
}

function CorgiPhoto({ src, alt, speaking }: { src: string; alt: string; speaking: boolean }) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  return <>
    {status !== "ready" && <LegacyCorgiAvatar speaking={speaking} />}
    {status !== "failed" && <img className={`lili-corgi-image${status === "ready" ? " is-ready" : ""}`} src={src} alt={alt} width={192} height={192} decoding="async" draggable={false} onLoad={() => setStatus("ready")} onError={() => setStatus("failed")} />}
  </>;
}
