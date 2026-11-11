/// <reference lib="deno.ns" />
import {addDateDays,isEnrollment,isSequence,nextSequenceStep,sequenceProgress,type Sequence,type Enrollment} from "./sequences.ts";
import {freshRecord} from "./store.ts";
const id=()=>crypto.randomUUID();
Deno.test("Sequences calculate real due days across month boundaries",()=>{
 if(addDateDays("2026-11-30",3)!=="2026-12-03")throw Error("Invalid date calculation");
});
Deno.test("Progress uses recorded step completion, not guessed message sends",()=>{
 const sequence:Sequence={...freshRecord(),name:"Abordagem",steps:[
 {id:id(),title:"Primeiro contato",afterDays:0,templateId:null},
 {id:id(),title:"Retorno",afterDays:4,templateId:null},
 ]};
 const enrollment:Enrollment={...freshRecord(),sequenceId:sequence.id,leadId:id(),startedAt:"2026-11-10",completed:{},paused:false};
 if(!isSequence(sequence)||!isEnrollment(enrollment))throw Error("Invalid model");
 if(nextSequenceStep(sequence,enrollment)?.due!=="2026-11-10"||sequenceProgress(sequence,enrollment)!==0)throw Error("First step invalid");
 enrollment.completed[sequence.steps[0]!.id]=new Date().toISOString();
 if(nextSequenceStep(sequence,enrollment)?.due!=="2026-11-14"||sequenceProgress(sequence,enrollment)!==50)throw Error("Recorded progress wrong");
 enrollment.completed[sequence.steps[1]!.id]=new Date().toISOString();
 if(nextSequenceStep(sequence,enrollment)!==null||sequenceProgress(sequence,enrollment)!==100)throw Error("Completion wrong");
});
