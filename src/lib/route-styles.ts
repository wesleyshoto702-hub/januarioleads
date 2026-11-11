/*
 * Load each page family's styles only when that route is rendered.
 * Global resets and utility classes remain in styles.css via __root.tsx.
 * Keep each family's cascade order aligned with the former root links.
 */
import appShellCss from "../styles/app-shell.css?url";
import leadPortfolioCss from "../features/leads/lead-portfolio-overview.css?url";
import saasVisualRefreshCss from "../styles/saas-visual-refresh.css?url";
import prospectingInformationCss from "../styles/prospecting-information.css?url";
import premiumWorkspaceCss from "../styles/premium-workspace.css?url";
import premiumReferenceFivePagesCss from "../styles/premium-reference-five-pages.css?url";
import premiumMotionFivePagesCss from "../styles/premium-motion-five-pages.css?url";
import settingsCss from "../features/settings/settings.css?url";
import digitalPresenceCss from "../features/digital-presence/digital-presence.css?url";
import proposalsCss from "../features/proposals/proposals.css?url";
import commercialExpansionCss from "../features/commercial-expansion/commercial.css?url";
import marketingHomeCss from "../styles/marketing-home.css?url";
import animatedTourCss from "../styles/animated-product-tour.css?url";
import heroSearchCss from "../styles/hero-search.css?url";
import messageExampleCss from "../styles/message-example.css?url";
import marketingEditorialCss from "../styles/marketing-editorial.css?url";
import auroraBackdropCss from "../styles/aurora-backdrop.css?url";
import homeMinimalWorkflowCss from "../styles/home-minimal-workflow.css?url";
import signupCrimsonCss from "../styles/signup-crimson.css?url";

const stylesheet = (href: string) => ({ rel: "stylesheet" as const, href });

export const APP_STYLES = [stylesheet(appShellCss), stylesheet(saasVisualRefreshCss), stylesheet(prospectingInformationCss), stylesheet(settingsCss), stylesheet(premiumWorkspaceCss), stylesheet(premiumReferenceFivePagesCss), stylesheet(premiumMotionFivePagesCss), stylesheet(digitalPresenceCss), stylesheet(proposalsCss), stylesheet(commercialExpansionCss), stylesheet(leadPortfolioCss)];

export const MARKETING_STYLES = [
  stylesheet(marketingHomeCss),
  stylesheet(animatedTourCss),
  stylesheet(heroSearchCss),
  stylesheet(messageExampleCss),
  stylesheet(marketingEditorialCss),
  stylesheet(auroraBackdropCss),
  stylesheet(homeMinimalWorkflowCss),
];

/** Login and signup now share exactly one visual identity and one card. */
export const AUTH_STYLES = [
  stylesheet(auroraBackdropCss),
  stylesheet(signupCrimsonCss),
];
export const SIGNUP_STYLES = AUTH_STYLES;
