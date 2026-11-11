/// <reference lib="deno.ns" />
import {countInPeriod,goalPeriodRange,isCommercialGoal} from "./goals.ts";
import {freshRecord} from "./store.ts";
Deno.test("Goals measure current Monday-based week with actual timestamps",()=>{
 const sample=["2026-11-08T13:00:00Z","2026-11-09T13:00:00Z","2026-11-10T23:00:00Z","2026-11-16T13:00:00Z"];
 const range=goalPeriodRange("2026-11-10","week");
 if(range.start!=="2026-11-09"||range.end!=="2026-11-16")throw Error("Wrong date range");
 if(countInPeriod(sample,"2026-11-10","week")!==2)throw Error("Should count exactly two timestamps in week");
});
Deno.test("Goals validate metric/period/target",()=>{
 const entry={...freshRecord(),metric:"new_leads",period:"month",target:10};
 if(!isCommercialGoal(entry)||isCommercialGoal({...entry,target:-1})||
   isCommercialGoal({...entry,metric:"unknown"}))throw Error("Goal guard failed");
});
