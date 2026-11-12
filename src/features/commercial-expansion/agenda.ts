import {isCommercialRecord,isObject,type CommercialRecord} from "./store.ts";
import {addDateDays} from "./sequences.ts";
export type AgendaKind="call"|"meeting"|"task";
export type AgendaItem=CommercialRecord&{
 title:string;date:string;time:string;leadId:string|null;kind:AgendaKind;notes:string;done:boolean;
};
export type CalendarMode="month"|"week"|"day";
export function isAgendaItem(x:unknown):x is AgendaItem{
 return isCommercialRecord(x)&&isObject(x)&&typeof x["title"]==="string"&&
  typeof x["date"]==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x["date"])&&
 typeof x["time"]==="string"&&(x["time"]===""||/^([01]\d|2[0-3]):[0-5]\d$/.test(x["time"]))&&
 (x["leadId"]===null||typeof x["leadId"]==="string")&&
 ["call","meeting","task"].includes(String(x["kind"]))&&typeof x["notes"]==="string"&&typeof x["done"]==="boolean";
}
export function calendarWeekStart(value:string):string {
 const date=new Date(value+"T12:00:00Z");
 if(!Number.isFinite(date.getTime()))throw Error("Data inválida");
 const day=date.getUTCDay();return addDateDays(value,-((day+6)%7));
}
export function monthGrid(monthDay:string):string[]{
 const first=monthDay.slice(0,7)+"-01";
 const firstWeek=calendarWeekStart(first);
 return Array.from({length:42},(_,i)=>addDateDays(firstWeek,i));
}
export function calendarVisibleDays(anchor:string,mode:CalendarMode):string[]{
 if(mode==="day")return [anchor];
 if(mode==="week")return Array.from({length:7},(_,i)=>addDateDays(calendarWeekStart(anchor),i));
 return monthGrid(anchor);
}
