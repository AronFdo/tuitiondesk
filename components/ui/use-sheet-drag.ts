"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

// Swipe a bottom sheet down to close it, the way iOS sheets work:
// - the sheet follows the finger 1:1 from where it was grabbed,
// - pulling up past the top resists more the further you go (rubber band),
// - on release the flick speed projects where the sheet would come to rest,
//   and that decides close or stay, so a quick flick closes it from anywhere,
// - grabbing it while it is still springing back starts from where it is on
//   screen, never from where it was heading.
// Phones only; on a desktop the dialog is centred and does not drag.

const MOBILE = "(max-width: 767px)";
// Apple's scroll deceleration.
const DECELERATION = 0.998;
// A drag ending within this distance of the top springs back regardless.
const MIN_TRAVEL = 8;
// iOS sheet curve: quick start, long soft settle, no overshoot.
const SETTLE = "cubic-bezier(0.32, 0.72, 0, 1)";

type Sample = { y: number; t: number };

// How far momentum carries a release, in px (from Designing Fluid Interfaces).
export function projectMomentum(velocityPxPerSecond: number, rate = DECELERATION) {
  return ((velocityPxPerSecond / 1000) * rate) / (1 - rate);
}

// Past a boundary, follow less the further you go.
export function rubberBand(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

// Close when the resting point lands past half the sheet, unless the finger
// was moving back up.
export function shouldDismiss(offset: number, velocity: number, height: number) {
  if (offset < MIN_TRAVEL || velocity < -300) {
    return false;
  }
  return offset + projectMomentum(velocity) > height / 2;
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useSheetDrag(onDismiss: () => void, enabled = true) {
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ grab: number; samples: Sample[] } | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(onDismiss);
  useEffect(() => {
    latest.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const element = sheet.current;
      if (!enabled || !element || !window.matchMedia(MOBILE).matches || event.button !== 0) {
        return;
      }
      clearTimeout(settleTimer.current);
      // Start from where the sheet is on screen right now (it may be mid-spring).
      const current = new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;
      element.style.transition = "none";
      element.style.transform = `translateY(${current}px)`;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { grab: event.clientY - current, samples: [{ y: event.clientY, t: event.timeStamp }] };
    },
    [enabled],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const element = sheet.current;
    const state = drag.current;
    if (!element || !state) {
      return;
    }
    const raw = event.clientY - state.grab;
    const offset = raw < 0 ? -rubberBand(-raw, element.offsetHeight) : raw;
    element.style.transform = `translateY(${offset}px)`;
    state.samples.push({ y: event.clientY, t: event.timeStamp });
    if (state.samples.length > 5) {
      state.samples.shift();
    }
  }, []);

  const release = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const element = sheet.current;
    const state = drag.current;
    drag.current = null;
    if (!element || !state) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const offset = new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;
    const first = state.samples[0];
    const last = state.samples[state.samples.length - 1];
    const elapsed = last.t - first.t;
    const velocity = elapsed > 0 ? ((last.y - first.y) / elapsed) * 1000 : 0;
    const height = element.offsetHeight;
    const calm = reducedMotion();

    if (shouldDismiss(offset, velocity, height)) {
      // Carry on at the finger's speed: the faster the flick, the quicker it goes.
      const remaining = height - offset;
      const duration = calm ? 0 : Math.min(300, Math.max(120, (remaining / Math.max(velocity, 1)) * 1000));
      element.style.transition = `transform ${duration}ms ${SETTLE}`;
      element.style.transform = `translateY(${height}px)`;
      settleTimer.current = setTimeout(() => latest.current(), duration);
      return;
    }

    element.style.transition = calm ? "none" : `transform 400ms ${SETTLE}`;
    element.style.transform = "translateY(0px)";
    settleTimer.current = setTimeout(() => {
      element.style.transition = "";
      element.style.transform = "";
    }, calm ? 0 : 400);
  }, []);

  return {
    sheetRef: sheet,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: release,
    },
  };
}
