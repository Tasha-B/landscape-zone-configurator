
import { useReducedMotion } from "framer-motion";

// Single chokepoint for prefers-reduced-motion — every animation in the app
// (new SVG/scroll animations and the existing SpaceMapper framer-motion
// transitions) reads through this one hook instead of calling
// useReducedMotion() directly, so the detection mechanism only needs to
// change in one place if it ever needs to.
export function usePrefersReducedMotion() {
  return useReducedMotion() ?? false;
}
