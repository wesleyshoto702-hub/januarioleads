/** Pure CRM transitions shared by the actual app and offline synthetic tests.
 * No network, account storage, timers or browser APIs. Every transition
 * preserves the lead ID and existing non-target business fields.
 */
import type { PersistedLead, LeadStatus } from "../leads/remote-leads.ts";
import type { NextActionType } from "./types.ts";
import {
  addDaysToDateKey, clearActionForStatus, DEFAULT_FOLLOW_UP_DAYS,
} from "./next-actions.ts";

export type CrmNextActionPatch = {
  nextActionType?: NextActionType | undefined;
  nextActionDate?: string | undefined;
  nextActionNotes?: string | undefined;
};

export function toggleLeadFavorite(lead:PersistedLead):PersistedLead {
  return {...lead,isFavorite:lead.isFavorite!==true};
}

export function changeLeadStatus(
  lead:PersistedLead,status:LeadStatus,
):PersistedLead {
  return lead.status===status?lead:clearActionForStatus(lead,status);
}

export function applyNextActionPatch(
  lead:PersistedLead,patch:CrmNextActionPatch,
):PersistedLead {
  if(!patch.nextActionType) {
    return {...lead,nextActionType:undefined,nextActionDate:undefined,
      nextActionNotes:undefined};
  }
  return {...lead,nextActionType:patch.nextActionType,
    nextActionDate:patch.nextActionDate,
    nextActionNotes:patch.nextActionNotes};
}

/** This must only be called AFTER explicit confirmation of a sent message.
 * Merely opening WhatsApp must not update status or last-contact fields.
 */
export function applyConfirmedContact(
  lead:PersistedLead,today:string,followUp:boolean,
):PersistedLead {
  const shouldAdvanceToWaiting=lead.status==="send_message";
  const isFollowUp=followUp&&lead.status==="waiting";
  const completedInitialContact=shouldAdvanceToWaiting&&
    lead.nextActionType==="initial_contact";
  const completedScheduledFollowUp=isFollowUp&&
    lead.nextActionType==="follow_up";
  const shouldScheduleDefaultFollowUp=shouldAdvanceToWaiting&&
    (!lead.nextActionType||completedInitialContact);

  let updated:PersistedLead={
    ...lead,
    lastContact:today,
    ...(shouldAdvanceToWaiting?{status:"waiting" as LeadStatus}:{}),
  };
  if(completedScheduledFollowUp) {
    updated={...updated,nextActionType:undefined,
      nextActionDate:undefined,nextActionNotes:undefined};
  }
  if(shouldScheduleDefaultFollowUp) {
    updated={...updated,nextActionType:"follow_up",
      nextActionDate:addDaysToDateKey(today,DEFAULT_FOLLOW_UP_DAYS),
      nextActionNotes:undefined};
  }
  return updated;
}
