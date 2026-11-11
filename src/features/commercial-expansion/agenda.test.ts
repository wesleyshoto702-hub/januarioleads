/// <reference lib="deno.ns" />
import {isAgendaItem,calendarWeekStart,calendarVisibleDays,monthGrid} from "./agenda.ts";
import {freshRecord} from "./store.ts";
Deno.test("Agenda uses Monday-based ISO week and month geometry",()=>{
 if(calendarWeekStart("2026-11-10")!=="2026-11-09")throw Error("Incorrect week start");
 const grid=monthGrid("2026-11-10");
 if(grid.length!==42||grid[0]!=="2026-10-26")throw Error("Month matrix failed");
 if(calendarVisibleDays("2026-11-10","day").length!==1)throw Error("Day selection failed");
 if(calendarVisibleDays("2026-11-10","week").length!==7)throw Error("Week selection failed");
});
Deno.test("Agenda accepts real dated commitments only",()=>{
 const x={...freshRecord(),title:"Reunião",date:"2026-11-10",time:"14:30",leadId:null,kind:"meeting",notes:"",done:false};
 if(!isAgendaItem(x)||isAgendaItem({...x,time:"45:99"}))throw Error("Invalid event validation");
});
