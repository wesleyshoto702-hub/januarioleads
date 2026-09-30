import type {
  BusinessInput,
  ConfirmedChannels,
  FactCandidate,
  PersistedFact,
  Resolution,
  VerifiedContent,
  VerifiedImage,
} from "./types.ts";
import { normalizeText, sha256Text } from "./security.ts";

function unique(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function imageUnique(values: VerifiedImage[]) {
  const seen = new Set<string>();
  return values.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export async function factSignature(candidate: FactCandidate) {
  return sha256Text(`${candidate.type}|${candidate.normalizedValue}`);
}

export async function finalizeCandidates(
  candidates: FactCandidate[],
  rejectedSignatures: Set<string>,
) {
  const staged: PersistedFact[] = [];
  for (const candidate of candidates) {
    if (!candidate.normalizedValue) continue;
    const signature = await factSignature(candidate);
    if (rejectedSignatures.has(signature)) {
      staged.push({ ...candidate, factSignature: signature, resolution: "rejected" });
      continue;
    }
    const resolution: Resolution =
      candidate.confidence === "high"
        ? "auto_verified"
        : candidate.confidence === "medium"
          ? "needs_review"
          : "low_confidence";
    staged.push({ ...candidate, factSignature: signature, resolution });
  }

  const bySignature = new Map<string, PersistedFact[]>();
  for (const item of staged) {
    const list = bySignature.get(item.factSignature) ?? [];
    list.push(item);
    bySignature.set(item.factSignature,list);
  }

  for (const group of bySignature.values()) {
    const medium = group.filter((item) => item.resolution === "needs_review");
    const domains = new Set(medium.map((item) => item.sourceDomain).filter(Boolean));
    if (medium.length >= 2 && domains.size >= 2 && medium.every((item) => item.identityScore >= 50)) {
      for (const item of medium) {
        item.confidence = "high";
        item.resolution = "auto_verified";
      }
    }
  }

  const dedupe = new Map<string, PersistedFact>();
  const rank = (item: PersistedFact) =>
    item.resolution === "manual_verified" ? 5 :
    item.resolution === "auto_verified" ? 4 :
    item.resolution === "needs_review" ? 3 :
    item.resolution === "low_confidence" ? 2 : 1;
  for (const item of staged) {
    const key = `${item.factSignature}|${item.sourceUrl}`;
    const current = dedupe.get(key);
    if (!current || rank(item) > rank(current)) dedupe.set(key,item);
  }
  return Array.from(dedupe.values()).slice(0,180);
}

function labelValue(fact: PersistedFact) {
  const name = fact.value.name?.trim() || fact.label.trim();
  const detail = fact.value.detail?.trim();
  const role = fact.value.role?.trim();
  if (role && role !== name) return `${name} — ${role}`;
  if (detail && detail !== name) return `${name} — ${detail}`;
  return name;
}

function priceValue(fact: PersistedFact) {
  const name = fact.value.name?.trim();
  const price = fact.value.price?.trim();
  const currency = fact.value.currency?.trim();
  if (!price) return labelValue(fact);
  const prefix = currency && currency !== "BRL" ? `${currency} ` : "R$ ";
  return name ? `${name} — ${prefix}${price}` : `${prefix}${price}`;
}

export function buildVerifiedSnapshot(
  facts: PersistedFact[],
  existing?: {
    verifiedContent?: VerifiedContent;
    verifiedImages?: VerifiedImage[];
    confirmedChannels?: ConfirmedChannels;
  },
) {
  const accepted = facts.filter((item) =>
    item.resolution === "auto_verified" || item.resolution === "manual_verified"
  );
  const content: VerifiedContent = { ...(existing?.verifiedContent ?? {}) };
  const images: VerifiedImage[] = [...(existing?.verifiedImages ?? [])];
  const channels: ConfirmedChannels = { ...(existing?.confirmedChannels ?? {}) };
  const identityUpdates: { website?: string | null; instagram?: string | null } = {};

  const append = (key: keyof VerifiedContent, value: string) => {
    const current = Array.isArray(content[key]) ? (content[key] as string[]) : [];
    (content as Record<string,unknown>)[key] = unique([...current,value]).slice(0,60);
  };

  for (const fact of accepted) {
    const source = fact.sourceUrl;
    switch (fact.type) {
      case "service": append("services", labelValue(fact)); break;
      case "product": append("products", labelValue(fact)); break;
      case "menu_item": append("menuItems", labelValue(fact)); break;
      case "price": append("prices", priceValue(fact)); break;
      case "professional": append("professionals", labelValue(fact)); break;
      case "credential": append("credentials", labelValue(fact)); break;
      case "facility": append("facilities", labelValue(fact)); break;
      case "team_member": append("team", labelValue(fact)); break;
      case "region_served": append("regionsServed", labelValue(fact)); break;
      case "vehicle_type": append("vehicleTypes", labelValue(fact)); break;
      case "modality": append("modalities", labelValue(fact)); break;
      case "course": append("courses", labelValue(fact)); break;
      case "treatment": append("treatments", labelValue(fact)); break;
      case "event_type": append("eventTypes", labelValue(fact)); break;
      case "property": append("properties", labelValue(fact)); break;
      case "brand": append("brands", labelValue(fact)); break;
      case "process": append("process", labelValue(fact)); break;
      case "plan": append("plans", labelValue(fact)); break;
      case "specialty": append("specialties", labelValue(fact)); break;
      case "history":
        if (!content.history) content.history = fact.value.description || labelValue(fact);
        break;
      case "capacity":
        if (!content.capacity) content.capacity = labelValue(fact);
        break;
      case "portfolio_image": {
        const url = fact.value.imageUrl;
        if (url) {
          const item = { url, alt: fact.label, source };
          content.portfolioImages = imageUnique([...(content.portfolioImages ?? []),item]).slice(0,30);
          images.push(item);
        }
        break;
      }
      case "before_after_image": {
        const url = fact.value.imageUrl;
        if (url) {
          const item = { url, alt: fact.label, source };
          content.beforeAfterImages = imageUnique([...(content.beforeAfterImages ?? []),item]).slice(0,20);
          images.push(item);
        }
        break;
      }
      case "professional_image":
      case "facility_image":
      case "product_image": {
        if (fact.value.imageUrl) images.push({ url: fact.value.imageUrl, alt: fact.label, source });
        break;
      }
      case "channel_whatsapp": if (fact.value.url) channels.whatsappUrl = fact.value.url; break;
      case "channel_booking": if (fact.value.url) channels.bookingUrl = fact.value.url; break;
      case "channel_delivery": if (fact.value.url) channels.deliveryUrl = fact.value.url; break;
      case "channel_reservation": if (fact.value.url) channels.reservationUrl = fact.value.url; break;
      case "channel_ecommerce": if (fact.value.url) channels.ecommerceUrl = fact.value.url; break;
      case "channel_menu": if (fact.value.url) channels.menuUrl = fact.value.url; break;
      case "official_website": if (fact.value.url) identityUpdates.website = fact.value.url; break;
      case "official_instagram": if (fact.value.url) identityUpdates.instagram = fact.value.url; break;
    }
  }

  return {
    verifiedContent: content,
    verifiedImages: imageUnique(images).slice(0,40),
    confirmedChannels: channels,
    identityUpdates,
  };
}

export function conflictCount(facts: PersistedFact[]) {
  const groups = new Map<string, Set<string>>();
  for (const fact of facts.filter((item) => item.resolution !== "rejected")) {
    if (!["price","channel_booking","channel_delivery","channel_menu","official_website"].includes(fact.type)) continue;
    const key = `${fact.type}|${normalizeText(fact.value.name || fact.label)}`;
    const set = groups.get(key) ?? new Set<string>();
    set.add(fact.normalizedValue);
    groups.set(key,set);
  }
  return Array.from(groups.values()).filter((values) => values.size > 1).length;
}

export function summaryOf(facts: PersistedFact[], snapshot: ReturnType<typeof buildVerifiedSnapshot>) {
  const verified = facts.filter((item) => item.resolution === "auto_verified" || item.resolution === "manual_verified");
  const review = facts.filter((item) => item.resolution === "needs_review");
  const low = facts.filter((item) => item.resolution === "low_confidence");
  const count = (type: string) => verified.filter((item) => item.type === type).length;
  return {
    verifiedFacts: verified.length,
    reviewFacts: review.length,
    lowFacts: low.length,
    services: count("service"),
    products: count("product"),
    professionals: count("professional"),
    portfolioImages: count("portfolio_image"),
    verifiedImages: snapshot.verifiedImages.length,
    prices: count("price"),
    bookingConfirmed: Boolean(snapshot.confirmedChannels.bookingUrl),
    whatsappConfirmed: Boolean(snapshot.confirmedChannels.whatsappUrl),
    websiteFound: Boolean(snapshot.identityUpdates.website),
    conflicts: conflictCount(facts),
  };
}

export function missingResearchPriorities(
  priorities: string[],
  facts: PersistedFact[],
) {
  const verifiedText = normalizeText(
    facts
      .filter((item) => item.resolution === "auto_verified" || item.resolution === "manual_verified")
      .map((item) => `${item.type} ${item.label}`)
      .join(" "),
  );
  return priorities
    .filter((priority) => {
      const tokens = normalizeText(priority).split(" ").filter((x) => x.length >= 4);
      return !tokens.some((token) => verifiedText.includes(token));
    })
    .slice(0,6);
}

export function mergeExistingBusiness(
  business: BusinessInput,
  snapshot: ReturnType<typeof buildVerifiedSnapshot>,
) {
  return {
    ...business,
    website: snapshot.identityUpdates.website || business.website,
    instagram: snapshot.identityUpdates.instagram || business.instagram,
    verifiedContent: snapshot.verifiedContent,
    verifiedImages: snapshot.verifiedImages,
    confirmedChannels: snapshot.confirmedChannels,
  };
}
