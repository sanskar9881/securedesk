import { useEffect } from "react";

/**
 * Marketing + auth pages are always light — they're the front door.
 * The console keeps its own dark/light preference. This paints the body so
 * overscroll and rubber-banding don't reveal the console ground underneath.
 */
export default function useMarketingSurface(color = "#FCFCFA") {
  useEffect(() => {
    const body = document.body;
    const prevBg = body.style.background;
    const prevColor = body.style.color;
    body.style.background = color;
    body.style.color = "#131A21";
    return () => {
      body.style.background = prevBg;
      body.style.color = prevColor;
    };
  }, [color]);
}
