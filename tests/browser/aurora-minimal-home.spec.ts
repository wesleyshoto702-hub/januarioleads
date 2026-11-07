import { expect, test } from "@playwright/test";

function isolate(page: import("@playwright/test").Page, report: () => void) {
  return page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith(".supabase.co")) report();
    return ["localhost", "127.0.0.1"].includes(url.hostname)
      ? route.continue() : route.abort();
  });
}

for (const path of ["/", "/produto", "/login", "/cadastro"]) {
  test("aurora carmesim do HTML de referência renderiza sem scripts externos em " + path, async ({ page }) => {
    let supabaseRequests = 0;
    await isolate(page, () => supabaseRequests++);
    await page.goto(path);

    const aurora = page.locator(".jl-aurora");
    await expect(aurora).toHaveCount(1);
    await expect(aurora).toHaveAttribute("aria-hidden", "true");
    await expect(aurora).toHaveAttribute("data-ambient", "crimson-ribbons");
    await expect(aurora.locator("canvas.jl-aurora-canvas")).toHaveCount(1);
    await expect(aurora.locator(".jl-aurora-wisp")).toHaveCount(0);
    await expect(aurora.locator(".jl-aurora-veil, .jl-aurora-haze")).toHaveCount(0);
    await expect(page.locator(".jl-ambient, .jl-ambient-particle")).toHaveCount(0);
    const actual = await aurora.evaluate((node) => ({
      position: getComputedStyle(node).position,
      pointerEvents: getComputedStyle(node).pointerEvents,
      background: getComputedStyle(node).backgroundColor,
      z: getComputedStyle(node).zIndex,
      canvasWidth: (node.querySelector("canvas") as HTMLCanvasElement).width,
    }));
    expect(actual.position).toBe("fixed");
    expect(actual.pointerEvents).toBe("none");
    expect(actual.z).toBe("0");
    expect(actual.background).toBe("rgb(5, 1, 2)");
    expect(actual.canvasWidth).toBeGreaterThan(0);
    expect(supabaseRequests).toBe(0);
  });
}

test("faixas vermelhas realmente se movem atrás da homepage inteira", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await isolate(page, () => {});
  await page.goto("/");

  const canvas = page.locator(".jl-site .jl-aurora-canvas");
  await expect.poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBeGreaterThan(300);
  const first = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(1000);
  const second = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  expect(second).not.toBe(first);

  const layering = await page.evaluate(() => {
    const aurora = document.querySelector<HTMLElement>(".jl-site > .jl-aurora")!;
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".jl-site > main > section"));
    return {
      auroraZ: Number(getComputedStyle(aurora).zIndex),
      mainZ: Number(getComputedStyle(document.querySelector(".jl-site > main")!).zIndex),
      headerZ: Number(getComputedStyle(document.querySelector(".jl-site > header")!).zIndex),
      canvasOpacity: Number(getComputedStyle(aurora.querySelector("canvas")!).opacity),
      sections: sections.map((section) => ({
        name: section.className,
        bg: getComputedStyle(section).backgroundColor,
      })),
    };
  });
  expect(layering.mainZ).toBeGreaterThan(layering.auroraZ);
  expect(layering.headerZ).toBeGreaterThan(layering.auroraZ);
  expect(layering.canvasOpacity).toBeLessThan(.97);
  expect(layering.sections.length).toBeGreaterThanOrEqual(8);
  for (const section of layering.sections) {
    const match = section.bg.match(/rgba?\(([^)]+)\)/);
    expect(match, section.name).not.toBeNull();
    const parts = match![1].split(/[,/]/).map((part) => part.trim());
    const alpha = parts.length === 4 ? Number(parts[3]) : 1;
    expect(alpha, section.name).toBeGreaterThanOrEqual(.50);
    expect(alpha, section.name).toBeLessThan(.85);
  }

  const before = await page.locator(".jl-aurora").boundingBox();
  await page.locator("#duvidas").scrollIntoViewIfNeeded();
  const after = await page.locator(".jl-aurora").boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs(before!.y - after!.y)).toBeLessThan(2);
  await expect(page.locator("#duvidas")).toBeVisible();
});

test("hero compacto, beta e CTAs repetidos removidos; ícone FAQ centrado", async ({ page }) => {
  await isolate(page, () => {});
  await page.goto("/");
  await expect(page.locator(".jl-marketing-briefing, .jl-hero-disclaimer, .jl-access, .jl-bottom-cta")).toHaveCount(0);
  await expect(page.getByText(/plataforma em evolução comercial|acesso atual por convite|a próxima fase da sua prospecção|transforme sua pesquisa em um processo comercial/i)).toHaveCount(0);
  const highlights = page.locator(".jl-hero-highlights span");
  await expect(highlights).toHaveCount(3);
  await expect(highlights.nth(0)).toContainText("Busca por cidade e nicho");
  await expect(highlights.nth(1)).toContainText("CRM e próximos contatos");
  await expect(highlights.nth(2)).toContainText("Acesso pelo navegador");
  await expect(page.locator(".jl-faq-item")).toHaveCount(4);
  const plus = page.locator(".jl-faq-item summary > span").first();
  const offset = await plus.evaluate((node) => {
    const outer = node.getBoundingClientRect();
    const svg = node.querySelector("svg")!.getBoundingClientRect();
    return Math.abs((outer.top + outer.bottom) / 2 - (svg.top + svg.bottom) / 2);
  });
  expect(offset).toBeLessThan(2);
});

test("Explore, Organize, Acompanhe acendem em ordem no scroll", async ({ page }) => {
  await isolate(page, () => {});
  await page.goto("/");
  await expect(page.locator(".jl-demo-window")).toHaveAttribute("data-interactive", "true", { timeout: 15000 });
  const section = page.locator(".jl-editorial-workflow");
  await section.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(section.locator(".jl-workflow-track")).toHaveAttribute("data-stage", "2", { timeout: 9500 });
  await expect(section.locator("li.jl-workflow-active")).toHaveCount(3);
});

test("movimento reduzido preserva aurora estática e etapas concluídas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await isolate(page, () => {});
  await page.goto("/");
  const canvas = page.locator(".jl-site .jl-aurora-canvas");
  await expect.poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBeGreaterThan(300);
  const first = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(700);
  const second = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  expect(second).toBe(first);
  await expect(page.locator(".jl-workflow-track")).toHaveAttribute("data-stage", "2");
  await expect(page.locator(".jl-workflow-active")).toHaveCount(3);
});

for (const width of [320, 360, 390, 768, 1280]) {
  test("aurora não causa overflow nem bloqueia cliques em " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await isolate(page, () => {});
    await page.goto("/");
    await expect(page.locator(".jl-aurora-canvas")).toBeAttached();
    await expect(page.locator(".jl-mobile-menu-toggle")).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    if (width <= 370) {
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await page.getByRole("navigation", { name: "Navegação para celular" })
        .getByRole("link", { name: "Acessar conta" }).click();
    } else {
      await page.locator(".jl-header-actions").getByRole("link", { name: "Acessar conta" }).click();
    }
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator(".jl-auth-shell > .jl-aurora > .jl-aurora-canvas")).toBeAttached();
  });
}


test("nova aurora usa quatro ondas carmesim e partículas sem camadas CSS animadas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await isolate(page, () => {});
  await page.goto("/");
  const backdrop = page.locator(".jl-site > .jl-aurora");
  const canvas = backdrop.locator("canvas.jl-aurora-canvas");
  await expect(canvas).toHaveAttribute("data-aurora-engine", "crimson-canvas");
  await expect(backdrop.locator(".jl-aurora-wisp")).toHaveCount(0);
  await expect.poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBeGreaterThan(300);

  const visual = await page.evaluate(() => {
    const element = document.querySelector<HTMLCanvasElement>(".jl-site .jl-aurora-canvas")!;
    const context = element.getContext("2d")!;
    let redSamples = 0;
    for (let y = 1; y < 10; y++) {
      for (let x = 1; x < 10; x++) {
        const rgba = context.getImageData(
          Math.floor(element.width * x / 10),
          Math.floor(element.height * y / 10), 1, 1,
        ).data;
        if (rgba[0] > rgba[1] + 12 && rgba[0] > 20) redSamples++;
      }
    }
    const header = document.querySelector<HTMLElement>(".jl-site > .jl-header")!;
    return {
      redSamples,
      background: getComputedStyle(document.querySelector(".jl-site > .jl-aurora")!).backgroundColor,
      heroTitle: getComputedStyle(document.querySelector(".jl-hero h1")!).color,
      titleAccent: getComputedStyle(document.querySelector(".jl-hero h1 em")!).color,
      description: getComputedStyle(document.querySelector(".jl-hero-description")!).color,
      headerBackdrop: getComputedStyle(header).backdropFilter,
      pixels: element.width * element.height,
      canvasOpacity: Number(getComputedStyle(element).opacity),
    };
  });
  expect(visual.redSamples).toBeGreaterThan(0);
  expect(visual.background).toBe("rgb(5, 1, 2)");
  expect(visual.heroTitle).toBe("rgb(248, 250, 252)");
  expect(visual.titleAccent).toBe("rgb(255, 87, 114)");
  expect(visual.description).toBe("rgb(178, 186, 199)");
  expect(visual.headerBackdrop).toBe("none");
  expect(visual.pixels).toBeLessThan(605_000);
  expect(visual.canvasOpacity).toBeLessThan(.97);
});

test("nova aurora limita pixels no desktop e permanece fixa atrás do rodapé", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await isolate(page, () => {});
  await page.goto("/");
  const canvas = page.locator(".jl-site .jl-aurora-canvas");
  await expect.poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBeGreaterThan(300);
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".jl-site .jl-aurora-canvas")!;
    const backdrop = document.querySelector<HTMLElement>(".jl-site > .jl-aurora")!;
    return {
      pixels: canvas.width * canvas.height,
      backdropZ: Number(getComputedStyle(backdrop).zIndex),
      footerZ: Number(getComputedStyle(document.querySelector(".jl-site > .jl-footer")!).zIndex),
      pointerEvents: getComputedStyle(canvas).pointerEvents,
    };
  });
  expect(metrics.pixels).toBeLessThan(905_000);
  expect(metrics.footerZ).toBeGreaterThan(metrics.backdropZ);
  expect(metrics.pointerEvents).toBe("none");
  await page.locator("#duvidas").scrollIntoViewIfNeeded();
  await expect(page.locator(".jl-site > .jl-aurora")).toBeVisible();
});

test("homepage apresenta as seis seções reais sem promessa de cadastro público ou automação", async ({ page }) => {
  await isolate(page, () => {});
  await page.goto("/");
  await expect(page.locator(".jl-header-actions").getByRole("link", { name: "Acessar conta" })).toHaveAttribute("href", "/login");
  await expect(page.locator(".jl-site a[href='/cadastro']")).toHaveCount(0);

  const displayedModules = await page.locator(".jl-module-tab strong").allTextContents();
  expect(displayedModules).toEqual(["Dashboard", "Meus Leads", "Buscar Leads", "Oportunidades", "Mensagens", "Financeiro"]);
  await page.locator(".jl-module-tab").filter({ hasText: "Oportunidades" }).click();
  await expect(page.locator("#jl-module-panel")).toContainText("amostras");
  await expect(page.locator("#jl-module-panel")).toContainText("não é um funil de negociações");
  await page.locator(".jl-module-tab").filter({ hasText: "Meus Leads" }).click();
  await expect(page.locator("#jl-module-panel")).toContainText("não são sincronizadas automaticamente");
  await expect(page.locator(".jl-spotlight-points")).toContainText("Histórico de atividades e anotações por empresa");
  await expect(page.locator(".jl-spotlight-points")).toContainText("Datas de retorno e próximas ações no CRM");
  await expect(page.locator(".jl-spotlight-points")).toContainText("Análise de oportunidades por cidade e nicho");
});

test("login e cadastro dividem o mesmo cartão e acesso permanece restrito", async ({ page }) => {
  await isolate(page, () => {});
  await page.goto("/login");
  await expect(page.getByRole("tab", { name: "Criar conta" })).toBeVisible();
  await expect(page.getByText(/O acesso ao CRM depende de autorização individual/)).toBeVisible();
  await expect(page.locator(".jl-signup-card")).toHaveCount(1);
  await expect(page.locator(".jl-auth-story")).toHaveCount(0);
});


test("marketing CSS is route-scoped while aurora remains visible", async ({ page }) => {
  await page.goto("/");
  const homeLinks = await page.locator('link[rel="stylesheet"]').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLLinkElement).href),
  );
  expect(homeLinks.some((href) => href.includes("marketing-home"))).toBe(true);
  expect(homeLinks.some((href) => href.includes("aurora-backdrop"))).toBe(true);
  expect(homeLinks.some((href) => href.includes("app-shell"))).toBe(false);
  expect(homeLinks.some((href) => href.includes("saas-visual-refresh"))).toBe(false);
  await expect(page.locator(".jl-aurora-canvas")).toBeVisible();
  await page.goto("/login");
  const authLinks = await page.locator('link[rel="stylesheet"]').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLLinkElement).href),
  );
  expect(authLinks.some((href) => href.includes("signup-crimson"))).toBe(true);
  expect(authLinks.some((href) => href.includes("auth-identity"))).toBe(false);
  expect(authLinks.some((href) => href.includes("aurora-backdrop"))).toBe(true);
  expect(authLinks.some((href) => href.includes("marketing-home"))).toBe(false);
  expect(authLinks.some((href) => href.includes("app-shell"))).toBe(false);
});


for (const input of ["wheel", "touchmove"]) {
  test("aurora continua animada durante eventos repetidos de " + input, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await isolate(page, () => {});
    await page.goto("/");
    const canvas = page.locator(".jl-site .jl-aurora-canvas");
    await expect.poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).width)).toBeGreaterThan(300);

    // Send interaction events continuously for more than the old 320ms pause
    // window: the image must keep changing throughout the interaction.
    const snapshots = await page.evaluate(async (eventName) => {
      const element = document.querySelector<HTMLCanvasElement>(".jl-site .jl-aurora-canvas")!;
      const before = element.toDataURL();
      const events = window.setInterval(() => {
        window.dispatchEvent(new Event(eventName, { bubbles: true }));
      }, 25);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 650));
      window.clearInterval(events);
      const during = element.toDataURL();
      return { before, during };
    }, input);
    expect(snapshots.during).not.toBe(snapshots.before);
  });
}


for (const width of [390, 1280]) {
  test("cabeçalho permanece fixo no topo durante a rolagem em " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await isolate(page, () => {});
    await page.goto("/");
    const header = page.locator(".jl-site > .jl-header");

    await expect(header).toBeVisible();
    expect(await header.evaluate((node) => getComputedStyle(node).position)).toBe("sticky");
    await page.evaluate(() => window.scrollTo(0, Math.min(950, document.documentElement.scrollHeight - innerHeight)));
    await expect.poll(() => header.evaluate((node) => Math.round(node.getBoundingClientRect().top))).toBe(0);
    expect(await header.evaluate((node) => Number(getComputedStyle(node).zIndex))).toBeGreaterThan(10);
    await expect(header.getByRole("link", { name: "Acessar conta" })).toBeVisible();

    if (width === 390) {
      await header.getByRole("button", { name: "Abrir menu" }).click();
      await expect(header.getByRole("navigation", { name: "Navegação para celular" })).toBeVisible();
      await header.getByRole("navigation", { name: "Navegação para celular" })
        .getByRole("link", { name: "Perguntas" }).click();
    } else {
      await header.getByRole("navigation", { name: "Navegação principal" })
        .getByRole("link", { name: "Perguntas" }).click();
    }
    await expect(page).toHaveURL(/#duvidas$/);
    await expect.poll(() => header.evaluate((node) => Math.round(node.getBoundingClientRect().top))).toBe(0);
    const anchorTop = await page.locator("#duvidas").evaluate((node) => node.getBoundingClientRect().top);
    expect(anchorTop).toBeGreaterThanOrEqual(60);
  });
}

test("homepage exibe a aurora mais iluminada que o login sem criar outro canvas", async ({ page }) => {
  await isolate(page, () => {});
  await page.goto("/");
  const home = await page.evaluate(() => ({
    canvasOpacity: Number(getComputedStyle(document.querySelector(".jl-site .jl-aurora-canvas")!).opacity),
    heroBackground: getComputedStyle(document.querySelector(".jl-site > main > .jl-hero")!).backgroundColor,
    canvases: document.querySelectorAll(".jl-aurora-canvas").length,
  }));
  await page.goto("/login");
  const login = await page.evaluate(() => ({
    canvasOpacity: Number(getComputedStyle(document.querySelector(".jl-auth-shell .jl-aurora-canvas")!).opacity),
    canvases: document.querySelectorAll(".jl-aurora-canvas").length,
  }));
  expect(home.canvases).toBe(1);
  expect(login.canvases).toBe(1);
  expect(home.canvasOpacity).toBeGreaterThan(0.90);
  expect(login.canvasOpacity).toBeGreaterThan(0.90);
  expect(home.heroBackground).toBe("rgba(5, 1, 2, 0.3)");
});


test("na seção Da pesquisa à rotina os ícones aparecem antes dos textos e as frases revelam da esquerda para direita", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await isolate(page, () => {});
  await page.goto("/");
  const workflow = page.locator(".jl-editorial-workflow");
  const track = workflow.locator(".jl-workflow-track");
  const nodes = track.locator("li");
  await expect(nodes).toHaveCount(3);
  await expect(nodes.nth(0)).toContainText("Explore");
  await expect(nodes.nth(0)).toContainText("Escolha o segmento e a cidade.");

  // Icons are present for all three stages, but non-Explore copies begin
  // visually clipped. They remain in the DOM for assistive technologies.
  for (const index of [1, 2]) {
    await expect(nodes.nth(index).locator(".jl-workflow-node svg")).toBeVisible();
    const initialOpacity = await nodes.nth(index).locator(".jl-workflow-copy")
      .evaluate((element) => Number(getComputedStyle(element).opacity));
    expect(initialOpacity).toBe(0);
  }

  await workflow.scrollIntoViewIfNeeded();
  await expect(track).toHaveAttribute("data-stage", "2", { timeout: 9500 });
  await expect(nodes.locator(".jl-workflow-node")).toHaveCount(3);
  for (const index of [1, 2]) {
    const copy = nodes.nth(index).locator(".jl-workflow-copy");
    await expect.poll(() => copy.evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(1);
    await expect.poll(() => copy.evaluate((element) => getComputedStyle(element).clipPath)).toMatch(/inset\(0px(?: 0px){0,3}\)/);
    await expect(copy).toHaveCSS("animation-name", "jlWorkflowCopyReveal");
  }
});

test("linhas de conexão respeitam o espaço entre etapas sem atravessar os títulos", async ({ page }) => {
  await isolate(page, () => {});
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const workflow = page.locator(".jl-editorial-workflow");
    await workflow.scrollIntoViewIfNeeded();
    const track = workflow.locator(".jl-workflow-track");
    await expect(track).toHaveAttribute("data-stage", "2", { timeout: 9500 });
    const geometry = await track.evaluate((list, mobile) => {
      const items = Array.from(list.querySelectorAll("li"));
      return items.slice(0,2).map((row,index) => {
        const icon = row.querySelector(".jl-workflow-node")!.getBoundingClientRect();
        const text = row.querySelector(".jl-workflow-copy")!.getBoundingClientRect();
        const nextIcon = items[index+1]!.querySelector(".jl-workflow-node")!.getBoundingClientRect();
        const rect = row.getBoundingClientRect();
        const after = getComputedStyle(row,"::after");
        const origin = mobile ? rect.top + parseFloat(after.top) : rect.left + parseFloat(after.left);
        const length = parseFloat(mobile ? after.height : after.width);
        return {
          start: origin,
          end: origin+length,
          expectedStart: mobile ? icon.bottom : rect.right,
          expectedEnd: mobile ? nextIcon.top : nextIcon.left,
          avoidsCopy: mobile || origin >= text.right - 2,
          iconAlignedWithCopy: Math.abs((icon.top+icon.bottom)/2 - (text.top+text.bottom)/2) < 3,
        };
      });
    }, width <= 900);
    for (const step of geometry) {
      expect(Math.abs(step.start-step.expectedStart)).toBeLessThan(3);
      expect(Math.abs(step.end-step.expectedEnd)).toBeLessThan(3);
      expect(step.avoidsCopy).toBe(true);
      expect(step.iconAlignedWithCopy).toBe(true);
    }
  }
});
