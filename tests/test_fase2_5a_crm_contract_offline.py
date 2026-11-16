"""Fase 2.5a: prove testable CRM steps are wired into the real workspace.

No browser/network/database. Ensures source attribution and no automatic
contact confirmation; all fake fixtures are intentionally synthetic.
"""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/"src/routes/app.tsx"
CRM=ROOT/"src/features/next-actions/crm-journey.ts"
LEAD=ROOT/"src/features/leads/build-found-lead.ts"
GATE=ROOT/"src/features/leads/found-lead-save-gate.ts"
STORAGE=ROOT/"src/features/business-presence/presence-transform.ts"
PENDING=ROOT/"src/features/leads/pending-leads.ts"
QUEUE=ROOT/"src/lib/mutation-queue.ts"
TEST=ROOT/"tests/fase2_5a_crm_journey_offline.test.ts"

class CrmJourneyContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=APP.read_text(encoding="utf-8")
        cls.crm=CRM.read_text(encoding="utf-8")
        cls.lead=LEAD.read_text(encoding="utf-8")
        cls.gate=GATE.read_text(encoding="utf-8")
        cls.storage=STORAGE.read_text(encoding="utf-8")
        cls.pending=PENDING.read_text(encoding="utf-8")
        cls.queue=QUEUE.read_text(encoding="utf-8")
        cls.test=TEST.read_text(encoding="utf-8")

    def test_actual_crm_ui_uses_tested_transitions(self):
        for part in (
            'import { buildFoundLead } from "../features/leads/build-found-lead"',
            'import { createFoundLeadSaveGate } from "../features/leads/found-lead-save-gate"',
            "updateLeadLocally(lead.id, toggleLeadFavorite)",
            "const nextLead = changeLeadStatus(lead, status)",
            "const next = applyNextActionPatch(previous,patch)",
            "const nextLead = applyConfirmedContact(",
            "foundLeadSaveGateRef.current.run(business,async()=>",
            "foundLeadSaveGateRef.current.forgetSaved(id)",
            "foundLeadSaveGateRef.current.reset()",
        ):
            self.assertIn(part,self.app)

    def test_only_confirmed_whatsapp_send_updates_last_contact(self):
        confirmation=self.app.split("async function confirmWhatsAppSent()",1)[1].split(
            "function ",1
        )[0]
        opened=self.app.split("function openWhatsApp()",1)[1].split(
            "async function confirmWhatsAppSent()",1
        )[0]
        self.assertIn("applyConfirmedContact(",confirmation)
        self.assertIn("await saveRemoteLead(nextLead)",confirmation)
        self.assertIn("if (!remoteReady)",confirmation)
        self.assertNotIn("applyConfirmedContact(",opened)
        self.assertNotIn("lastContact: today",opened)
        self.assertIn("type: \"whatsapp_opened\"",confirmation)

    def test_save_guard_and_source_attribution_are_real(self):
        main=self.app.split("async function addFoundLeadConfirmed(",1)[1].split(
            "function navigateTo(",1
        )[0]
        self.assertIn("findBusinessDuplicate(business, leads)",main)
        self.assertIn("if (!remoteReady)",main)
        self.assertIn("await saveRemoteLead(newLead)",main)
        self.assertIn("if (!persisted)",main)
        self.assertIn('provider: business.source ?? "unknown"',main)
        self.assertNotIn('business.source === "geoapify" ? "geoapify" : "google_places"',main)
        self.assertIn(".then(()=>currentGeneration===generation?save()",self.gate)
        self.assertIn("generation++",self.gate)
        self.assertIn("if(result.ok && currentGeneration===generation)",self.gate)
        self.assertIn("forgetSaved(leadId:string)",self.gate)
        self.assertIn("const address=normalizeLocationText(business.address)",self.gate)
        self.assertNotIn("business.phone",self.gate)

    def test_account_isolation_and_pending_mutations_not_lost(self):
        self.assertIn("sameOwner: async () =>",self.pending)
        self.assertIn("mergePendingLeads(remote",self.pending)
        self.assertIn("next.revision !== item.revision",self.queue)
        self.assertIn('throw new Error("ACCOUNT_CHANGED")',self.queue)
        self.assertIn("scoped to one mounted crm workspace",self.gate.lower())

    def test_instagram_evidence_is_not_fabricated(self):
        self.assertIn('business.instagramConfidence ?? "medium"',self.storage)
        self.assertIn('business.instagramSource ?? "existing_data"',self.storage)
        self.assertNotIn('business.placeId?.trim() ? "google_places"',self.storage)
        self.assertIn("instagramNeedsReview:",self.storage)
        self.assertIn("presenceFromBusiness(business)",self.lead)

    def test_all_fixtures_are_fake_and_no_external_urls_used(self):
        self.assertIn("example.invalid",self.test)
        self.assertIn("Barbearia Fictícia",self.test)
        for forbidden in ("SUPABASE_SERVICE_ROLE_KEY=","sb_secret_","AIzaSy",
                          "eyJhbGciOi","https://api.geoapify.com"):
            self.assertNotIn(forbidden,self.test)

if __name__=="__main__":
    unittest.main()
