import {isCommercialRecord,isObject,type CommercialRecord} from "./store.ts";
export type ProjectStatus="briefing"|"planning"|"development"|"review"|"delivered"|"paused";
export const PROJECT_STAGES:Record<ProjectStatus,string>={
 briefing:"Briefing",planning:"Planejamento",development:"Desenvolvimento",
 review:"Revisão",delivered:"Entregue",paused:"Pausado",
};
export type ProjectTask={id:string;title:string;done:boolean};
export type ClientProject=CommercialRecord&{
 leadId:string|null;proposalId:string|null;name:string;description:string;status:ProjectStatus;
 dueDate:string;deliveredAt:string|null;tasks:ProjectTask[];
};
export function isClientProject(x:unknown):x is ClientProject {
 return isCommercialRecord(x)&&isObject(x)&&
 (x.leadId===null||typeof x.leadId==="string")&&
 (x.proposalId===null||typeof x.proposalId==="string")&&
 typeof x.name==="string"&&typeof x.description==="string"&&
 Object.hasOwn(PROJECT_STAGES,String(x.status))&&
 typeof x.dueDate==="string"&&(x.dueDate===""||/^\d{4}-\d{2}-\d{2}$/.test(x.dueDate))&&
 (x.deliveredAt===null||typeof x.deliveredAt==="string")&&Array.isArray(x.tasks)&&x.tasks.length<=60&&
 x.tasks.every(t=>isObject(t)&&typeof t.id==="string"&&typeof t.title==="string"&&typeof t.done==="boolean");
}
export function projectProgress(project:ClientProject):number {
 if(!project.tasks.length)return 0;
 return Math.round(100*project.tasks.filter(t=>t.done).length/project.tasks.length);
}
