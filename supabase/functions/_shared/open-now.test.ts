import {
  evaluateOpenNow,
  isOpenNowCacheFresh,
} from "./open-now.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function saoPauloUtc(year: number, month: number, day: number, hour: number, minute = 0) {
  // Brazil has used UTC-03:00 continuously since 2019. Intl in the evaluator
  // remains the source of truth; this helper only produces deterministic fixtures.
  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute));
}

Deno.test("Monday 10:00 is open from regular periods", () => {
  const value = evaluateOpenNow(null,{
    periods:[{open:{day:1,hour:9,minute:0},close:{day:1,hour:18,minute:0}}],
  },saoPauloUtc(2026,10,5,10));
  assert(value.isOpen === true,"Monday 10:00 should be open.");
});

Deno.test("Saturday and Sunday are evaluated by weekday", () => {
  const saturday = evaluateOpenNow(null,{
    periods:[{open:{day:6,hour:9},close:{day:6,hour:13}}],
  },saoPauloUtc(2026,10,10,10));
  const sunday = evaluateOpenNow(null,{
    periods:[{open:{day:6,hour:9},close:{day:6,hour:13}}],
  },saoPauloUtc(2026,10,11,10));
  assert(saturday.isOpen === true,"Saturday fixture should be open.");
  assert(sunday.isOpen === false,"Sunday fixture should be closed.");
});

Deno.test("closed business stays closed", () => {
  const value = evaluateOpenNow({openNow:false,periods:[]},null,saoPauloUtc(2026,10,5,10));
  assert(value.state === "CLOSED","current openNow=false must be authoritative.");
});

Deno.test("current openNow true is authoritative when periods are missing", () => {
  const value = evaluateOpenNow({openNow:true},null,saoPauloUtc(2026,10,5,10));
  assert(value.isOpen === true,"Google current openNow=true should remain open.");
});

Deno.test("closing in 30 minutes is CLOSING_SOON", () => {
  const value = evaluateOpenNow(null,{
    periods:[{open:{day:1,hour:9},close:{day:1,hour:10,minute:30}}],
  },saoPauloUtc(2026,10,5,10));
  assert(value.state === "CLOSING_SOON","30 minutes to close should be closing soon.");
  assert(value.minutesUntilClose === 30,"Expected 30 minutes.");
});

Deno.test("18:00 to 02:00 remains open at 01:00 next day", () => {
  const value = evaluateOpenNow(null,{
    periods:[{open:{day:1,hour:18},close:{day:2,hour:2}}],
  },saoPauloUtc(2026,10,6,1));
  assert(value.isOpen === true,"Overnight period should remain open.");
  assert(value.closingAt === "02:00","Expected next-day closing time.");
});

Deno.test("24h business has no synthetic closing time", () => {
  const value = evaluateOpenNow(null,{
    periods:[{open:{day:0,hour:0}}],
  },saoPauloUtc(2026,10,7,12));
  assert(value.isOpen === true && value.is24Hours,"Missing close on continuous period means 24h.");
  assert(value.closingAt === null,"24h must not invent closing time.");
});

Deno.test("missing hours are UNKNOWN", () => {
  const value = evaluateOpenNow(null,null,saoPauloUtc(2026,10,5,10));
  assert(value.state === "UNKNOWN","No hours must never become open.");
});

Deno.test("currentOpeningHours overrides conflicting regular hours", () => {
  const value = evaluateOpenNow(
    {openNow:false,periods:[]},
    {periods:[{open:{day:1,hour:0},close:{day:2,hour:0}}]},
    saoPauloUtc(2026,10,5,10),
  );
  assert(value.state === "CLOSED","Current/special hours must beat regular schedule.");
});

Deno.test("Saturday 18:30 to Sunday 00:00 is open at 23:30", () => {
  const value = evaluateOpenNow(null,{
    periods:[{open:{day:6,hour:18,minute:30},close:{day:0,hour:0}}],
  },saoPauloUtc(2026,10,10,23,30));
  assert(value.isOpen === true,"Saturday 23:30 must be open.");
  assert(value.closingAt === "00:00","Closing should be midnight next day.");
});

Deno.test("timezone result does not depend on server local timezone", () => {
  const utcInstant = new Date("2026-10-05T13:00:00.000Z");
  const value = evaluateOpenNow(null,{
    periods:[{open:{day:1,hour:9},close:{day:1,hour:11}}],
  },utcInstant);
  assert(value.isOpen === true,"13:00 UTC must evaluate as 10:00 America/Sao_Paulo.");
});

Deno.test("cache is fresh before TTL and stale afterwards", () => {
  const checked = new Date("2026-10-05T13:00:00.000Z");
  assert(
    isOpenNowCacheFresh(checked.toISOString(),new Date("2026-10-05T13:10:00.000Z")),
    "10 minutes should still be fresh.",
  );
  assert(
    !isOpenNowCacheFresh(checked.toISOString(),new Date("2026-10-05T13:16:00.000Z")),
    "16 minutes should be stale.",
  );
});


Deno.test("structured current periods can recalculate after reported openNow becomes stale", () => {
  const hours = {
    openNow:true,
    periods:[{open:{day:1,hour:9},close:{day:1,hour:10}}],
  };
  const value = evaluateOpenNow(
    hours,
    null,
    saoPauloUtc(2026,10,5,10,5),
    {preferReportedOpenNow:false},
  );
  assert(value.state === "CLOSED","After 10:00 the structured period must close locally.");
});
