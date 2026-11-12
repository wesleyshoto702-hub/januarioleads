import {isCommercialRecord,isObject,type CommercialRecord} from "./store.ts";
export type SequenceStep={id:string;title:string;afterDays:number;templateId:string|null};
export type Sequence=CommercialRecord&{name:string;steps:SequenceStep[]};
export type Enrollment=CommercialRecord&{leadId:string;sequenceId:string;startedAt:string;completed:Record<string,string>;paused:boolean};
export const SEQUENCE_PLAN_KEY="sequences";
export const ENROLLMENT_KEY="enrollments";
export function isSequence(x:unknown):x is Sequence {
 return isCommercialRecord(x)&&isObject(x)&&typeof x["name"]==="string"&&Array.isArray(x["steps"])&&x["steps"].length<=12&&x["steps"].every(s=>
   isObject(s)&&typeof s["id"]==="string"&&typeof s["title"]==="string"&&typeof s["afterDays"]==="number"&&
   Number.isInteger(s["afterDays"])&&s["afterDays"]>=0&&s["afterDays"]<=365&&
   (s["templateId"]===null||typeof s["templateId"]==="string"));
}
export function isEnrollment(x:unknown):x is Enrollment {
 return isCommercialRecord(x)&&isObject(x)&&typeof x["leadId"]==="string"&&typeof x["sequenceId"]==="string"&&
 typeof x["startedAt"]==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x["startedAt"])&&isObject(x["completed"])&&
 typeof x["paused"]==="boolean";
}
export function addDateDays(start:string,days:number):string{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isInteger(days)||Math.abs(days)>3650)throw Error("Data inválida.");
 const d=new Date(start+"T12:00:00Z");
 if(!Number.isFinite(d.getTime()))throw Error("Data inválida.");
 d.setUTCDate(d.getUTCDate()+days);
 return d.toISOString().slice(0,10);
}
export function nextSequenceStep(plan:Sequence,entry:Enrollment):{step:SequenceStep;due:string}|null{
 const step=plan.steps.find(s=>!Object.hasOwn(entry.completed,s.id));
 return step?{step,due:addDateDays(entry.startedAt,step.afterDays)}:null;
}
export function sequenceProgress(plan:Sequence,entry:Enrollment):number {
 if(!plan.steps.length)return 0;
 return Math.round(100*plan.steps.filter(s=>Object.hasOwn(entry.completed,s.id)).length/plan.steps.length);
}
