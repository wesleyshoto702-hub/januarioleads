import type { LeadStatus } from "./remote-leads";

export const STATUS_LABEL: Record<LeadStatus, string> = {
  send_message: "Enviar mensagem",
  waiting: "Aguardando",
  accepted: "Aceito",
  rejected: "Recusado",
};
