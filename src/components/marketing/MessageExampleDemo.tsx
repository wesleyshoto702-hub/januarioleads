import { Check, ClipboardCopy, Mail, MessageCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";

/** Illustrative message templates; no AI generation, network calls or automatic sending. */
const examples = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    title: "Primeiro contato",
    text:
      "Olá! Tudo bem? Vi o trabalho da sua empresa e acredito que posso ajudar com soluções digitais. Posso explicar brevemente uma ideia?",
  },
  {
    key: "email",
    label: "E-mail",
    icon: Mail,
    title: "Apresentação comercial",
    text:
      "Olá, equipe! Trabalho com serviços digitais e gostaria de apresentar uma proposta que pode ser relevante para o negócio de vocês. Podemos conversar?",
  },
  {
    key: "followup",
    label: "Follow-up",
    icon: Send,
    title: "Retomar conversa",
    text:
      "Olá! Passando para saber se você teve a oportunidade de avaliar minha mensagem anterior. Fico à disposição para conversarmos quando fizer sentido.",
  },
] as const;

export function MessageExampleDemo() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const [selected, setSelected] = useState<(typeof examples)[number]["key"]>("whatsapp");
  const [copied, setCopied] = useState(false);
  const active = examples.find((entry) => entry.key === selected) ?? examples[0];

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(active.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function select(key: (typeof examples)[number]["key"]) {
    setSelected(key);
    setCopied(false);
  }

  return (
    <div className="jl-message-experience">
      <div className="jl-message-experience-copy">
        <p className="jl-eyebrow">ABORDAGEM COM CONTEXTO</p>
        <h3>Uma conversa melhor começa com <span>uma mensagem preparada.</span></h3>
        <p>
          Tenha modelos para adaptar à realidade de cada empresa. O Januário Leads
          organiza o contato; você revisa a abordagem e decide quando conversar.
        </p>
        <div className="jl-message-points">
          <span><Check size={16} aria-hidden="true" /> Modelos de mensagens reutilizáveis</span>
          <span><Check size={16} aria-hidden="true" /> Contatos e histórico reunidos no CRM</span>
          <span><Check size={16} aria-hidden="true" /> Abertura de conversa no WhatsApp sob seu controle</span>
        </div>
      </div>
      <div className="jl-message-card" aria-label="Demonstração de modelos de mensagens">
        <div className="jl-message-card-top">
          <div>
            <span>MODELO DE ABORDAGEM</span>
            <strong>Mensagem para adaptar</strong>
          </div>
          <small>Exemplo fictício</small>
        </div>
        <div className="jl-message-tabs" role="tablist" aria-label="Canais da mensagem">
          {examples.map(({ key, label, icon: Icon }) => (
            <button
              type="button"
              key={key}
              id={"jl-message-tab-" + key}
              className={selected === key ? "active" : ""}
              role="tab"
              aria-selected={selected === key}
              disabled={!hydrated}
              aria-controls="jl-message-panel"
              onClick={() => select(key)}
            >
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <div
          className="jl-message-panel"
          id="jl-message-panel"
          role="tabpanel"
          aria-labelledby={"jl-message-tab-" + selected}
          key={selected}
        >
          <span>{active.title}</span>
          <p>{active.text}</p>
          <small>Texto demonstrativo. Confira os dados antes de usar.</small>
        </div>
        <div className="jl-message-card-actions">
          <span>Sem envio automático</span>
          <button type="button" disabled={!hydrated} onClick={() => void copyMessage()}>
            {copied ? <Check size={16} aria-hidden="true" /> : <ClipboardCopy size={16} aria-hidden="true" />}
            {copied ? "Copiado" : "Copiar exemplo"}
          </button>
        </div>
      </div>
    </div>
  );
}
