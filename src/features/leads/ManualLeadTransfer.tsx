import { useState, type ChangeEvent } from "react";
import { Download, FileUp } from "lucide-react";
import type { PersistedLead } from "./remote-leads";
import {
  exportManualLeadsCsv, manualLeadsCsvTemplate, parseManualLeadCsv,
  type CsvPreview, type ManualLeadCsvRow,
} from "./manual-leads-csv";

function downloadCsv(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ManualLeadTransfer({
  leads, onImport,
}: {
  leads: PersistedLead[];
  onImport: (rows: ManualLeadCsvRow[]) => Promise<{ count: number; synced: boolean }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setPreview(null); setError(""); setNotice("");
    if (!file) return;
    if (file.size > 500_000) { setError("CSV muito grande. Limite de 500 KB e 100 registros."); return; }
    try {
      const result = parseManualLeadCsv(await file.text(), leads);
      setPreview(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível ler o CSV.");
    }
  }

  async function importConfirmed() {
    if (!preview?.rows.length || working) return;
    setWorking(true); setError(""); setNotice("");
    try {
      const result = await onImport(preview.rows);
      setNotice(result.count + " contatos adicionados. " +
        (result.synced ? "Dados sincronizados com o CRM." : "Cópia local salva; sincronização pendente."));
      setPreview(null);
    } catch {
      setError("A importação não foi concluída. Confira sua conexão e tente novamente.");
    } finally {
      setWorking(false);
    }
  }

  const exportable = exportManualLeadsCsv(leads);
  return (
    <section className="manual-csv-panel" aria-label="Importação e exportação de contatos próprios">
      <button className="manual-csv-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((old) => !old)}>
        <FileUp size={16} aria-hidden="true"/> Importar / exportar contatos próprios
      </button>
      {expanded && (
        <div className="manual-csv-content">
          <p>
            Importe apenas contatos que você tem direito de utilizar. O arquivo precisa ter empresa, segmento, telefone,
            cidade, UF, status e observacoes. Até 100 empresas por vez; duplicatas são ignoradas.
          </p>
          <div className="manual-csv-buttons">
            <button type="button" onClick={() => downloadCsv("januarioleads-modelo.csv", manualLeadsCsvTemplate())}>
              <Download size={15} aria-hidden="true"/> Baixar modelo CSV
            </button>
            <label className="manual-csv-file">
              <FileUp size={15} aria-hidden="true"/> Selecionar CSV
              <input type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event)} />
            </label>
            <button type="button" disabled={exportable.count === 0} onClick={() => downloadCsv("januarioleads-contatos-manuais.csv", exportable.csv)}>
              <Download size={15} aria-hidden="true"/> Exportar {exportable.count} {exportable.count === 1 ? "contato manual" : "contatos manuais"}
            </button>
          </div>
          <p className="manual-csv-policy">
            A exportação inclui apenas contatos adicionados manualmente e não enriquecidos. Empresas e dados provenientes
            do Google Places ou de pesquisas externas não são exportados.
          </p>
          {error && <p role="alert" className="manual-csv-error">{error}</p>}
          {notice && <p role="status" className="manual-csv-notice">{notice}</p>}
          {preview && (
            <div className="manual-csv-preview">
              <strong>{preview.rows.length} {preview.rows.length === 1 ? "novo contato pronto" : "novos contatos prontos"} para importar</strong>
              <small>{preview.duplicates} duplicatas ignoradas · {preview.errors.length} linhas inválidas</small>
              {preview.errors.length > 0 && <p role="alert">{preview.errors.slice(0, 4).join(" ")}</p>}
              {preview.rows.length > 0 && (
                <>
                  <ul>{preview.rows.slice(0, 5).map((row) => <li key={row.company + row.city}>{row.company} · {row.city}/{row.state}</li>)}</ul>
                  <button type="button" className="primary-button" disabled={working} onClick={() => void importConfirmed()}>
                    {working ? "Importando..." : "Confirmar importação de " + preview.rows.length + (preview.rows.length === 1 ? " contato" : " contatos")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
