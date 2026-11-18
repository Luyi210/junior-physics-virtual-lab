import { useEffect, useState } from 'react';

// A coarse pointer still needs touch-safe navigation in phone landscape/tablet
// widths. The width branch also makes a compact desktop preview usable.
export const MOBILE_SCENE_QUERY = '(pointer: coarse), (max-width: 760px)';

function matchesMobileScene() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(MOBILE_SCENE_QUERY).matches : false;
}

export function useMobileSceneMode() {
  const [mobile, setMobile] = useState(matchesMobileScene);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(MOBILE_SCENE_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return mobile;
}
