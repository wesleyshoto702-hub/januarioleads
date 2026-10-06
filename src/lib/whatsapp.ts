export const WHATSAPP_MOBILE_FALLBACK_MS = 1_500;

export type WhatsAppLinkOptions = {
  phone: string;
  message?: string;
};

export type WhatsAppLinks = {
  appUrl: string;
  webUrl: string;
};

export function isValidWhatsAppPhone(phone: string) {
  return /^55\d{10,11}$/.test(phone);
}

export function buildWhatsAppLinks({
  phone,
  message,
}: WhatsAppLinkOptions): WhatsAppLinks {
  const encodedMessage =
    typeof message === "string" ? encodeURIComponent(message) : "";
  const appText =
    typeof message === "string" ? `&text=${encodedMessage}` : "";
  const webText =
    typeof message === "string" ? `?text=${encodedMessage}` : "";

  return {
    appUrl: `whatsapp://send?phone=${phone}${appText}`,
    webUrl: `https://wa.me/${phone}${webText}`,
  };
}

function isMobileNavigationEnvironment(target: Window) {
  const navigatorWithHints = target.navigator as Navigator & {
    userAgentData?: {
      mobile?: boolean;
    };
  };

  if (typeof navigatorWithHints.userAgentData?.mobile === "boolean") {
    return navigatorWithHints.userAgentData.mobile;
  }

  const hasTouch = navigatorWithHints.maxTouchPoints > 0;
  const coarsePointer =
    typeof target.matchMedia === "function" &&
    target.matchMedia("(pointer: coarse)").matches;

  return hasTouch && coarsePointer;
}

function openDesktopWhatsApp(target: Window, webUrl: string) {
  const opened = target.open(webUrl, "_blank");
  if (!opened) return false;

  try {
    opened.opener = null;
  } catch {
    // Cross-origin browser restrictions can make opener inaccessible.
  }

  return true;
}

function openMobileWhatsApp(
  target: Window,
  appUrl: string,
  webUrl: string,
) {
  const doc = target.document;
  let fallbackTimer: number | null = null;

  const cleanup = () => {
    if (fallbackTimer !== null) {
      target.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    target.removeEventListener("pagehide", cleanup);
  };

  const onVisibilityChange = () => {
    if (doc.visibilityState === "hidden") {
      cleanup();
    }
  };

  doc.addEventListener("visibilitychange", onVisibilityChange);
  target.addEventListener("pagehide", cleanup, { once: true });

  fallbackTimer = target.setTimeout(() => {
    cleanup();
    target.location.assign(webUrl);
  }, WHATSAPP_MOBILE_FALLBACK_MS);

  try {
    target.location.assign(appUrl);
  } catch {
    cleanup();
    target.location.assign(webUrl);
  }

  return true;
}

export function openWhatsAppLink(options: WhatsAppLinkOptions) {
  if (typeof window === "undefined") return false;
  if (!isValidWhatsAppPhone(options.phone)) return false;

  const { appUrl, webUrl } = buildWhatsAppLinks(options);

  if (isMobileNavigationEnvironment(window)) {
    return openMobileWhatsApp(window, appUrl, webUrl);
  }

  return openDesktopWhatsApp(window, webUrl);
}
