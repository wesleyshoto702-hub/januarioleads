/// <reference lib="deno.ns" />
import {isClientProject,projectProgress,type ClientProject} from "./projects.ts";
import {freshRecord} from "./store.ts";
Deno.test("Project checklist progress comes from completed tasks only",()=>{
 const project:ClientProject={...freshRecord(),leadId:"lead",proposalId:null,name:"Site",
  description:"",status:"development",dueDate:"",deliveredAt:null,
  tasks:[{id:"a",title:"Briefing",done:true},{id:"b",title:"Layout",done:false}]};
 if(!isClientProject(project)||projectProgress(project)!==50)throw Error("Progress is not based on tasks");
 const copy={...project,tasks:[]};
 if(projectProgress(copy)!==0)throw Error("Empty checklist must not be estimated");
});
