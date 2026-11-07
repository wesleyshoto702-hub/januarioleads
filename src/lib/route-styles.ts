/*
 * Load each page family's styles only when that route is rendered.
 * Global resets and utility classes remain in styles.css via __root.tsx.
 * Keep each family's cascade order aligned with the former root links.
 */
import appShellCss from "../styles/app-shell.css?url";
import saasVisualRefreshCss from "../styles/saas-visual-refresh.css?url";
import marketingHomeCss from "../styles/marketing-home.css?url";
import animatedTourCss from "../styles/animated-product-tour.css?url";
import heroSearchCss from "../styles/hero-search.css?url";
import messageExampleCss from "../styles/message-example.css?url";
import betaRegistrationCss from "../styles/beta-registration.css?url";
import marketingEditorialCss from "../styles/marketing-editorial.css?url";
import authIdentityCss from "../styles/auth-identity.css?url";
import auroraBackdropCss from "../styles/aurora-backdrop.css?url";
import homeMinimalWorkflowCss from "../styles/home-minimal-workflow.css?url";

const stylesheet = (href: string) => ({ rel: "stylesheet" as const, href });

export const APP_STYLES = [stylesheet(appShellCss), stylesheet(saasVisualRefreshCss)];

export const MARKETING_STYLES = [
  stylesheet(marketingHomeCss),
  stylesheet(animatedTourCss),
  stylesheet(heroSearchCss),
  stylesheet(messageExampleCss),
  stylesheet(marketingEditorialCss),
  stylesheet(auroraBackdropCss),
  stylesheet(homeMinimalWorkflowCss),
];

export const AUTH_STYLES = [
  stylesheet(betaRegistrationCss),
  stylesheet(authIdentityCss),
  stylesheet(auroraBackdropCss),
];
