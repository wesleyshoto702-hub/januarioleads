import {isCommercialRecord,isObject,type CommercialRecord} from "./store.ts";
import {calendarWeekStart} from "./agenda.ts";
export type GoalMetric="new_leads"|"new_proposals"|"new_appointments"|"delivered_projects";
export type GoalPeriod="week"|"month";
export const GOAL_METRICS:Record<GoalMetric,string>={
 new_leads:"Leads cadastrados",new_proposals:"Propostas criadas",
 new_appointments:"Compromissos registrados",delivered_projects:"Projetos entregues",
};
export type CommercialGoal=CommercialRecord&{metric:GoalMetric;period:GoalPeriod;target:number};
export function isCommercialGoal(x:unknown):x is CommercialGoal{
 return isCommercialRecord(x)&&isObject(x)&&Object.hasOwn(GOAL_METRICS,String(x.metric))&&
 (x.period==="week"||x.period==="month")&&typeof x.target==="number"&&
 Number.isInteger(x.target)&&x.target>=1&&x.target<=100000;
}
export function goalPeriodRange(day:string,period:GoalPeriod):{start:string;end:string}{
 const start=period==="week"?calendarWeekStart(day):day.slice(0,7)+"-01";
 const end=period==="week"?addDays(start,7):addMonth(start);
 return {start,end};
}
function addDays(day:string,n:number):string{
 const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);
}
function addMonth(day:string):string{
 const d=new Date(day+"T12:00:00Z");d.setUTCMonth(d.getUTCMonth()+1);return d.toISOString().slice(0,10);
}
export function brazilDateOf(timestamp:string):string|null{
 if(/^\d{4}-\d{2}-\d{2}$/.test(timestamp))return timestamp;
 const d=new Date(timestamp);
 return Number.isFinite(d.getTime())?
   new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d):null;
}
export function countInPeriod(timestamps:readonly (string|null|undefined)[],day:string,period:GoalPeriod):number{
 const {start,end}=goalPeriodRange(day,period);
 return timestamps.filter(x=>{const value=x?brazilDateOf(x):null;return Boolean(value&&value>=start&&value<end);}).length;
}
