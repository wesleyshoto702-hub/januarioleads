import { Bell } from "lucide-react";
import type { PersistedLead } from "../leads/remote-leads";
import type { UserSettings } from "./user-settings";

/** Only an in-app prompt; no push, email or background monitoring. */
export function SettingsReminders({settings,leads,onShow}:{
  settings:UserSettings;
  leads:PersistedLead[];
  onShow:(type:"today"|"overdue")=>void;
}){
  const today=new Intl.DateTimeFormat("sv-SE",{
    timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",
  }).format(new Date());
  const scheduled=leads.filter(lead=>typeof lead.nextActionDate==="string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(lead.nextActionDate));
  const due=scheduled.filter(x=>x.nextActionDate===today).length;
  const late=scheduled.filter(x=>Boolean(x.nextActionDate && x.nextActionDate<today)).length;
  if((!settings.notifyDueToday||due===0)&&(!settings.notifyOverdue||late===0))return null;
  return <div className="js-settings-reminders" role="status">
    <Bell size={18}/>
    <div><strong>Acompanhamentos pendentes</strong><p>Confira as próximas ações dos seus leads.</p></div>
    <div className="js-settings-reminder-buttons">
      {settings.notifyDueToday&&due>0&&<button type="button" onClick={()=>onShow("today")}>{due} para hoje</button>}
      {settings.notifyOverdue&&late>0&&<button type="button" onClick={()=>onShow("overdue")}>{late} atrasado{late===1?"":"s"}</button>}
    </div>
  </div>;
}
