/// <reference lib="deno.ns" />
import {isObjection,summarizeObjections,type Objection} from "./objections.ts";
import {freshRecord} from "./store.ts";
Deno.test("Objections group real records by reason and scoped lead membership",()=>{
 const ids=[crypto.randomUUID(),crypto.randomUUID()];
 const row=(leadId:string,reason:"price"|"timing"):Objection=>({...freshRecord(),leadId,reason,details:"Resposta registrada",revisitOn:"",resolved:false});
 const a=row(ids[0]!,"price"),b=row(ids[0]!,"price"),c=row(ids[1]!,"timing");
 if(!isObjection(a))throw Error("Objection invalid");
 const top=summarizeObjections([a,b,c],new Set([ids[0]!]));
 if(top[0]?.reason!=="price"||top[0]?.count!==2||top.reduce((n,x)=>n+x.count,0)!==2)throw Error("Counting or membership failed");
});
