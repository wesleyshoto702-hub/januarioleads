import { drawCurtains } from "./aurora-draw";

type Message =
  | { type: "resize"; width: number; height: number; pixelRatio: number; mobile: boolean }
  | { type: "resume" }
  | { type: "pause"; staticFrame?: boolean }
  | { type: "ack" };

type FrameMessage = { type: "frame"; bitmap: ImageBitmap };

// DedicatedWorkerGlobalScope is not included in the application's DOM-only
// TypeScript libs. Its postMessage API matches Worker for transferable images.
const workerScope = self as unknown as Worker;
let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let mobile = false;
let active = false;
let inFlight = false;
let staticFramePending = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let averageCost = 0;
const startedAt = performance.now();

function cancelTimer() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}
function paint(time: number) {
  if (!canvas || !context || width <= 0 || height <= 0 || inFlight) return;
  const started = performance.now();
  drawCurtains(context, width, height, time, mobile);
  const bitmap = canvas.transferToImageBitmap();
  inFlight = true;
  workerScope.postMessage({ type: "frame", bitmap } satisfies FrameMessage, [bitmap]);
  const cost = performance.now() - started;
  averageCost = averageCost ? averageCost * .75 + cost * .25 : cost;
}
function scheduleNext() {
  if (!active || inFlight || timer !== null) return;
  const minimum = mobile ? 1000 / 14 : 1000 / 18;
  const interval = Math.max(minimum, Math.min(1000 / 9, averageCost * 3));
  timer = setTimeout(() => {
    timer = null;
    if (!active) return;
    paint((performance.now() - startedAt) / 1000);
  }, interval);
}
workerScope.onmessage = (event: MessageEvent<Message>) => {
  const data = event.data;
  switch (data.type) {
    case "resize": {
      const { width: nextWidth, height: nextHeight, pixelRatio, mobile: nextMobile } = data;
      if (nextWidth <= 0 || nextHeight <= 0) return;
      cancelTimer();
      width = nextWidth;
      height = nextHeight;
      mobile = nextMobile;
      canvas = new OffscreenCanvas(
        Math.max(1, Math.round(width * pixelRatio)),
        Math.max(1, Math.round(height * pixelRatio)),
      );
      context = canvas.getContext("2d", { alpha: true });
      context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      // Initial still frame is useful even if reduced-motion was requested.
      staticFramePending = true;
      if (!inFlight) {
        staticFramePending = false;
        paint(0);
      }
      break;
    }
    case "resume":
      active = true;
      scheduleNext();
      break;
    case "pause":
      active = false;
      cancelTimer();
      if (data.staticFrame) {
        staticFramePending = true;
        if (!inFlight) {
          staticFramePending = false;
          paint(0);
        }
      }
      break;
    case "ack":
      inFlight = false;
      if (staticFramePending) {
        staticFramePending = false;
        paint(0);
      } else {
        scheduleNext();
      }
      break;
  }
};
