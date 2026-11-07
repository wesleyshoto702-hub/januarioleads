import { test, expect, type Page } from "@playwright/test";

// Read-only field/lab diagnostic. Neither this test nor PSI changes production.
const LIVE_SITE = "https://januleads.vercel.app/";

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const data = {
      lcp: null as number | null,
      cls: 0,
      durations: [] as number[],
      longTasks: [] as number[],
      gaps: [] as { time: number; duration: number }[],
    };
    (window as Window & { __perfProbe?: typeof data }).__perfProbe = data;
    const listen = (
      type: string,
      callback: (entries: PerformanceEntryList) => void,
      extras: Record<string, unknown> = {},
    ) => {
      try {
        new PerformanceObserver((items) => callback(items.getEntries()))
          .observe({ type, buffered: true, ...extras } as PerformanceObserverInit);
      } catch { /* Unsupported entry type */ }
    };
    listen("largest-contentful-paint", (entries) => {
      const last = entries[entries.length - 1];
      if (last) data.lcp = last.startTime;
    });
    listen("layout-shift", (entries) => {
      for (const shift of entries) {
        const item = shift as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!item.hadRecentInput) data.cls += item.value;
      }
    });
    listen("longtask", (entries) => {
      for (const item of entries) data.longTasks.push(item.duration);
    });
    listen("event", (entries) => {
      for (const item of entries) {
        const event = item as PerformanceEntry & { interactionId?: number };
        if (event.interactionId) data.durations.push(event.duration);
      }
    }, { durationThreshold: 16 });
    let previous = 0;
    function sample(time: number) {
      if (previous) data.gaps.push({ time, duration: time - previous });
      previous = time;
      if (data.gaps.length > 1800) data.gaps.splice(0, 400);
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
}

async function snapshot(page: Page, from: number) {
  return page.evaluate((start) => {
    const data = (window as Window & { __perfProbe: {
      lcp: number | null; cls: number; durations: number[];
      longTasks: number[]; gaps: { time: number; duration: number }[];
    }}).__perfProbe;
    const gaps = data.gaps.filter((g) => g.time >= start).map((g) => g.duration).sort((a,b)=>a-b);
    const p95 = gaps.length ? gaps[Math.min(gaps.length - 1, Math.ceil(gaps.length * .95) - 1)] : null;
    return {
      fcpMs: performance.getEntriesByType("paint").find((e)=>e.name==="first-contentful-paint")?.startTime ?? null,
      lcpMs: data.lcp,
      cls: Math.round(data.cls * 10000) / 10000,
      syntheticMaxEventMs: data.durations.length ? Math.max(...data.durations) : null,
      longTasks: data.longTasks.length,
      longTaskTotalMs: Math.round(data.longTasks.reduce((a,b)=>a+b,0)),
      frames: gaps.length,
      frameP95Ms: p95===null?null:Math.round(p95*10)/10,
      framesOver34Ms: gaps.filter((v)=>v>34).length,
    };
  }, from);
}

for (const device of [
  { name:"desktop", width:1440, height:900 },
  { name:"mobile", width:390, height:844 },
]) {
  test("aurora lag baseline " + device.name, async ({ browser }) => {
    test.skip(process.env["RUN_AURORA_PERF_AUDIT"] !== "1", "Dedicated benchmark workflow only");
    test.setTimeout(120_000);
    for (const target of [
      { label:"publicado", url:LIVE_SITE },
      { label:"candidato-dev", url:"http://127.0.0.1:5173/" },
    ]) {
      const context = await browser.newContext({
        viewport: {width:device.width, height:device.height},
        reducedMotion:"no-preference",
      });
      const page = await context.newPage();
      await instrument(page);
      try {
        const response = await page.goto(target.url, {waitUntil:"domcontentloaded", timeout:25_000});
        expect(response?.status()).toBe(200);
        await expect(page.locator(".jl-site > .jl-aurora")).toBeVisible({timeout:18_000});
        await page.waitForTimeout(900);
        const activeStart=await page.evaluate(()=>performance.now());
        await page.waitForTimeout(2500);
        const active=await snapshot(page,activeStart);
        await page.emulateMedia({reducedMotion:"reduce"});
        await page.waitForTimeout(400);
        const reducedStart=await page.evaluate(()=>performance.now());
        await page.waitForTimeout(2200);
        const reduced=await snapshot(page,reducedStart);
        // An automated interaction cannot replace real-user INP field data.
        await page.locator(".jl-faq-item summary").first().click({timeout:7000});
        await page.waitForTimeout(400);
        const event=await snapshot(page,reducedStart);
        console.log("AURORA_DIAGNOSTIC " + JSON.stringify({
          target:target.label, device:device.name,
          active,reducedMotion:reduced,
          syntheticClickMaxDurationMs:event.syntheticMaxEventMs,
        }));
      } catch(error) {
        console.log("AURORA_DIAGNOSTIC_UNAVAILABLE "+JSON.stringify({
          target:target.label,device:device.name,
          reason:error instanceof Error?error.message.slice(0,250):String(error),
        }));
        if(target.label==="candidato-dev")throw error;
      } finally {
        await context.close();
      }
    }
  });
}
