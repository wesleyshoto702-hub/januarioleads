import type {
  BusinessInput,
  PersistedFact,
  SourceDiagnostic,
} from "./types.ts";
import {
  buildVerifiedSnapshot,
  summaryOf,
} from "./consolidate.ts";
import {
  normalizeText,
} from "./security.ts";
import {
  resolveNicheStrategy,
} from "../niche-strategies.ts";

export function evidenceQualityFrom(
  facts: PersistedFact[],
  diagnostics: SourceDiagnostic[],
) {
  const usable = facts.filter((fact)=>
    fact.resolution !== "rejected" &&
    fact.resolution !== "low_confidence"
  );
  if (!usable.length) return "low" as const;

  const manuallyVerified = usable.some(
    (fact)=>fact.resolution === "manual_verified"
  );
  const strongOfficial = usable.some((fact)=>
    fact.resolution === "auto_verified" &&
    fact.confidence === "high" &&
    fact.identityScore >= 80 &&
    fact.sourceType !== "web_search"
  );
  if (manuallyVerified || strongOfficial) return "high" as const;

  const probableSources = diagnostics.filter((source)=>
    source.identityStatus === "confirmed" ||
    source.identityStatus === "probable"
  ).length;
  const mediumOrBetter = usable.filter((fact)=>
    fact.confidence === "high" || fact.confidence === "medium"
  ).length;

  if (mediumOrBetter >= 2 || probableSources >= 1) return "medium" as const;
  return "low" as const;
}

function countValue(count: number) {
  return count > 0 ? `${count} encontrados` : "Não encontrado";
}

function confirmationValue(value: boolean) {
  return value ? "Confirmado" : "Não confirmado";
}

export function buildSummaryIndicators(
  business: BusinessInput,
  strategy: ReturnType<typeof resolveNicheStrategy>,
  summary: ReturnType<typeof summaryOf>,
  snapshot: ReturnType<typeof buildVerifiedSnapshot>,
) {
  const indicators: Array<{key:string;label:string;value:string}> = [];
  const seen = new Set<string>();
  const add = (key:string,label:string,value:string) => {
    if (seen.has(key) || indicators.length >= 6) return;
    seen.add(key);
    indicators.push({key,label,value});
  };

  const content = snapshot.verifiedContent;
  const channels = snapshot.confirmedChannels;
  const contentCount = (key: keyof typeof content) =>
    Array.isArray(content[key]) ? (content[key] as unknown[]).length : 0;

  const applyPriority = (raw: string) => {
    const value = normalizeText(raw);
    if (/produto|cardap|menu|pizza|sabor|lanche/.test(value)) {
      add(
        "products_menu",
        "Produtos / Cardápio",
        countValue(summary.products + summary.menuItems),
      );
      add("prices","Preços",countValue(summary.prices));
      return;
    }
    if (/preco|valor/.test(value)) {
      add("prices","Preços",countValue(summary.prices));
      return;
    }
    if (/tratamento/.test(value)) {
      add("treatments","Tratamentos",countValue(contentCount("treatments")));
      return;
    }
    if (/servic|procediment/.test(value)) {
      add("services","Serviços",countValue(summary.services));
      return;
    }
    if (/credencial|especializacao|formacao|registro/.test(value)) {
      add("credentials","Credenciais",countValue(contentCount("credentials")));
      return;
    }
    if (/profission|equipe|artista|barbeir|dentist/.test(value)) {
      add("professionals","Profissionais",countValue(summary.professionals));
      return;
    }
    if (/portfolio|trabalho|resultado/.test(value)) {
      add(
        "portfolio",
        "Portfólio",
        summary.portfolioImages > 0 ? "Disponível" : "Não encontrado",
      );
      return;
    }
    if (/estilo|especialidade/.test(value)) {
      add("specialties","Estilos / Especialidades",countValue(contentCount("specialties")));
      return;
    }
    if (/estrutura|ambiente|oficina|clinica/.test(value)) {
      add("facilities","Estrutura",countValue(contentCount("facilities")));
      return;
    }
    if (/veiculo|carro|moto/.test(value)) {
      add("vehicles","Veículos atendidos",countValue(contentCount("vehicleTypes")));
      return;
    }
    if (/foto|fotografia|imagem/.test(value)) {
      add("images","Imagens",countValue(summary.verifiedImages));
      return;
    }
    if (/delivery|pedido|entrega|retirada/.test(value)) {
      add(
        "order",
        "Pedido / Delivery",
        confirmationValue(Boolean(channels.deliveryUrl || channels.menuUrl)),
      );
      return;
    }
    if (/agend|booking|reserva/.test(value)) {
      add(
        "booking",
        "Agendamento",
        confirmationValue(Boolean(channels.bookingUrl || channels.reservationUrl)),
      );
      return;
    }
    if (/instagram/.test(value)) {
      add("instagram","Instagram",business.instagram ? "Confirmado" : "Não confirmado");
      return;
    }
    if (/orcamento/.test(value)) {
      add(
        "quote",
        "Orçamento / contato",
        confirmationValue(Boolean(channels.whatsappUrl || business.phone)),
      );
    }
  };

  for (const priority of strategy.contentPriorities) applyPriority(priority);

  for (const [key] of strategy.visualContentPriorities) {
    applyPriority(key);
  }

  for (const section of strategy.idealSections) {
    for (const key of section.requiresAny) applyPriority(key);
  }

  for (const action of strategy.preferredPrimaryActions) {
    if (action === "delivery") applyPriority("delivery pedido");
    else if (action === "booking") applyPriority("agendamento");
    else if (action === "whatsapp") {
      add(
        "whatsapp",
        "WhatsApp",
        confirmationValue(Boolean(channels.whatsappUrl)),
      );
    } else if (action === "instagram") applyPriority("Instagram");
  }

  if (indicators.length < 6 && summary.verifiedImages > 0) {
    add("images","Imagens",countValue(summary.verifiedImages));
  }

  if (
    indicators.length < 6 &&
    (business.address || business.openingHours?.length)
  ) {
    add(
      "location_hours",
      "Localização / horários",
      business.address && business.openingHours?.length
        ? "Confirmados"
        : "Parcialmente confirmados",
    );
  }

  return indicators.slice(0,6);
}
