/**
 * Visual + functional QA for the Spotless Cleaning homepage.
 * Runs in GitHub Actions (Chromium with system fonts installed).
 *
 * Checks: console errors, failed requests, broken images, horizontal overflow,
 * tap-target sizes, drawer/FAB/FAQ behaviour, anchor integrity and scroll offset.
 *
 * Outputs:
 *   qa/out/*.jpg        screenshots (hero / full page / interactive states)
 *   qa/out/report.json  machine-readable report
 *   stdout              human-readable summary (also written to the job summary)
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.QA_URL || "http://127.0.0.1:8080/";
const OUT = path.join(process.cwd(), "qa", "out");
const SHOTS = process.env.QA_SHOTS === "1"; // set to 1 to capture screenshots
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "360-mobile", width: 360, height: 780, mobile: true },
  { name: "390-mobile", width: 390, height: 844, mobile: true },
  { name: "430-mobile", width: 430, height: 932, mobile: true },
  { name: "768-tablet", width: 768, height: 1024, mobile: false },
  { name: "1024-laptop", width: 1024, height: 768, mobile: false },
  { name: "1280-desktop", width: 1280, height: 900, mobile: false },
  { name: "1440-desktop", width: 1440, height: 960, mobile: false },
];

const report = { generated: new Date().toISOString(), base: BASE, viewports: [], issues: [] };
const issue = (where, msg) => report.issues.push(`${where} :: ${msg}`);
const log = (...a) => console.log(...a);

/** Run a step without aborting the whole suite. */
async function safe(label, where, fn, fallback = null) {
  try {
    return await fn();
  } catch (err) {
    issue(where, `${label} threw: ${err.message.split("\n")[0]}`);
    return fallback;
  }
}

const shot = async (page, file, fullPage = false) => {
  if (!SHOTS) return;
  await page.screenshot({ path: path.join(OUT, file), fullPage, type: "jpeg", quality: 72 });
};

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    reducedMotion: "reduce",
    userAgent: vp.mobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : undefined,
  });
  const page = await context.newPage();
  const errors = [];
  const failures = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => failures.push(`${r.url()} :: ${r.failure()?.errorText}`));
  page.on("response", (r) => { if (r.status() >= 400) failures.push(`${r.url()} :: HTTP ${r.status()}`); });

  const vpReport = { name: vp.name, size: `${vp.width}x${vp.height}`, checks: {} };

  await page.goto(BASE, { waitUntil: "networkidle" });

  // Scroll the full page to trigger lazy-loaded images and reveals, then return.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 120));
  });
  // Wait for every <img> to be decoded (or 8s, whichever comes first).
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.race([
      Promise.all(imgs.map((i) => (i.complete && i.naturalWidth ? Promise.resolve() : i.decode().catch(() => {})))),
      new Promise((r) => setTimeout(r, 8000)),
    ]);
  });
  await page.waitForTimeout(300);

  /* ---- static layout checks ------------------------------------------- */
  const layout = await page.evaluate(() => {
    const vw = window.innerWidth;
    const offenders = [];
    if (document.documentElement.scrollWidth > vw + 1) {
      document.querySelectorAll("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
          if (getComputedStyle(el).position === "fixed") return;
          offenders.push(`${el.tagName.toLowerCase()}.${String(el.className || "").trim().split(/\s+/).join(".")} [${Math.round(r.left)}…${Math.round(r.right)}]`);
        }
      });
    }
    const small = [];
    document.querySelectorAll("a, button").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < 30) {
        small.push(`${el.tagName.toLowerCase()} “${(el.textContent || "").trim().slice(0, 24)}” ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    });
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: vw,
      offenders: offenders.slice(0, 10),
      brokenImages: Array.from(document.images)
        .filter((i) => !i.complete || i.naturalWidth === 0)
        .map((i) => i.currentSrc || i.src),
      missingAlt: Array.from(document.images).filter((i) => !i.hasAttribute("alt")).length,
      smallTargets: small.slice(0, 10),
      headerHeight: Math.round(document.querySelector("#site-header").getBoundingClientRect().height),
      h1Count: document.querySelectorAll("h1").length,
      imgCount: document.images.length,
    };
  });

  vpReport.checks.layout = layout;
  if (layout.scrollWidth > layout.innerWidth + 1)
    issue(vp.name, `horizontal overflow ${layout.scrollWidth}px > ${layout.innerWidth}px; ${layout.offenders.join(" | ")}`);
  if (layout.brokenImages.length) issue(vp.name, `broken images: ${layout.brokenImages.join(", ")}`);
  if (layout.missingAlt) issue(vp.name, `${layout.missingAlt} image(s) without alt text`);
  if (layout.smallTargets.length) issue(vp.name, `tap targets under 30px: ${layout.smallTargets.join(" | ")}`);
  if (layout.h1Count !== 1) issue(vp.name, `expected exactly one h1, found ${layout.h1Count}`);

  await shot(page, `${vp.name}-hero.jpg`);

  /* ---- mobile drawer -------------------------------------------------- */
  if (vp.mobile) {
    vpReport.checks.drawer = await safe("drawer", vp.name, async () => {
      await page.click("#navToggle");
      await page.waitForTimeout(600);
      const state = await page.evaluate(() => {
        const d = document.querySelector("#drawer");
        const cs = getComputedStyle(d);
        const links = Array.from(document.querySelectorAll(".drawer__link"));
        return {
          visible: cs.visibility === "visible" && Number(cs.opacity) > 0.9,
          ariaExpanded: document.querySelector("#navToggle").getAttribute("aria-expanded"),
          ariaHidden: d.getAttribute("aria-hidden"),
          scrollLocked: getComputedStyle(document.body).overflow === "hidden",
          focusInside: d.contains(document.activeElement),
          firstLinkTop: Math.round(links[0].getBoundingClientRect().top),
          lastLinkBottom: Math.round(links[links.length - 1].getBoundingClientRect().bottom),
          viewportHeight: window.innerHeight,
          ctaVisible: (() => {
            const r = document.querySelector(".drawer__contact .btn").getBoundingClientRect();
            return r.top >= 0 && r.bottom <= window.innerHeight;
          })(),
          drawerScrollable: d.scrollHeight > d.clientHeight + 2,
        };
      });
      await shot(page, `${vp.name}-drawer.jpg`);
      if (!state.visible) issue(vp.name, "drawer did not become visible");
      if (state.ariaExpanded !== "true" || state.ariaHidden !== "false") issue(vp.name, "drawer aria state wrong");
      if (!state.scrollLocked) issue(vp.name, "body not scroll-locked while drawer open");
      if (!state.focusInside) issue(vp.name, "focus not moved into drawer");
      if (state.lastLinkBottom > state.viewportHeight && !state.drawerScrollable)
        issue(vp.name, `drawer links overflow viewport with no scroll (${state.lastLinkBottom} > ${state.viewportHeight})`);

      // close via Escape, confirm focus returns
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      const closed = await page.evaluate(() => ({
        open: document.body.classList.contains("menu-open"),
        focusOnToggle: document.activeElement === document.querySelector("#navToggle"),
      }));
      if (closed.open) issue(vp.name, "Escape did not close the drawer");
      if (!closed.focusOnToggle) issue(vp.name, "focus not returned to menu toggle");

      // reopen then close with the button
      await page.click("#navToggle");
      await page.waitForTimeout(450);
      await page.click("#navToggle");
      await page.waitForTimeout(450);
      const afterBtn = await page.evaluate(() => !document.body.classList.contains("menu-open"));
      if (!afterBtn) issue(vp.name, "toggle button did not close the drawer");
      return { ...state, escapeClosed: !closed.open, focusReturned: closed.focusOnToggle };
    });
  } else {
    vpReport.checks.nav = await page.evaluate(() => ({
      navVisible: getComputedStyle(document.querySelector(".nav")).display !== "none",
      toggleHidden: getComputedStyle(document.querySelector("#navToggle")).display === "none",
      phoneVisible: getComputedStyle(document.querySelector(".header-phone")).display !== "none",
    }));
  }

  /* ---- floating action button ----------------------------------------- */
  vpReport.checks.fab = await safe("fab", vp.name, async () => {
    await page.evaluate(() => window.scrollTo({ top: Math.round(document.body.scrollHeight * 0.45), behavior: "instant" }));
    await page.waitForTimeout(600);
    const box = await page.locator("#fabToggle").boundingBox();
    const inView = box && box.x >= -1 && box.y >= -1 &&
      box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1;
    if (!inView) issue(vp.name, `FAB outside viewport: ${JSON.stringify(box)}`);
    let hit = false;
    if (box && Number.isFinite(box.x) && Number.isFinite(box.y)) {
      hit = await page.evaluate(({ x, y, w, h }) => {
        const el = document.elementFromPoint(Math.round(x + w / 2), Math.round(y + h / 2));
        return !!el && !!el.closest("#fab");
      }, box);
    }
    if (!hit) issue(vp.name, "FAB is covered by another element");

    await page.click("#fabToggle");
    await page.waitForTimeout(500);
    const open = await page.evaluate(() => {
      const actions = Array.from(document.querySelectorAll(".fab__action"));
      return {
        isOpen: document.querySelector("#fab").classList.contains("is-open"),
        allVisibleInView: actions.every((a) => {
          const r = a.getBoundingClientRect();
          return Number(getComputedStyle(a).opacity) > 0.9 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= 0;
        }),
        ariaExpanded: document.querySelector("#fabToggle").getAttribute("aria-expanded"),
      };
    });
    await shot(page, `${vp.name}-fab.jpg`);
    if (!open.isOpen || !open.allVisibleInView || open.ariaExpanded !== "true")
      issue(vp.name, `FAB open state wrong: ${JSON.stringify(open)}`);

    // outside click closes
    await page.mouse.click(vp.width / 2, 40);
    await page.waitForTimeout(350);
    const closed = await page.evaluate(() => !document.querySelector("#fab").classList.contains("is-open"));
    if (!closed) issue(vp.name, "outside click did not close the FAB");
    return { box, inView, hit, ...open, outsideClickClosed: closed };
  });

  /* ---- FAQ ------------------------------------------------------------ */
  vpReport.checks.faq = await safe("faq", vp.name, async () => {
    await page.evaluate(() => document.querySelector("#faq").scrollIntoView({ behavior: "instant", block: "start" }));
    await page.waitForTimeout(400);
    await page.locator("#faq-q1").click();
    await page.waitForTimeout(550);
    const state = await page.evaluate(() => {
      const btn = document.querySelector("#faq-q1");
      const panel = document.querySelector("#faq-a1");
      const text = panel.querySelector("p");
      return {
        expanded: btn.getAttribute("aria-expanded"),
        panelHeight: Math.round(panel.getBoundingClientRect().height),
        textVisible: text.getBoundingClientRect().height > 10,
        othersClosed: Array.from(document.querySelectorAll(".faq__q"))
          .filter((b) => b !== btn)
          .every((b) => b.getAttribute("aria-expanded") === "false"),
      };
    });
    await shot(page, `${vp.name}-faq.jpg`);
    if (state.expanded !== "true" || !state.textVisible || state.panelHeight < 20)
      issue(vp.name, `FAQ did not expand: ${JSON.stringify(state)}`);

    // close again
    await page.locator("#faq-q1").click();
    await page.waitForTimeout(500);
    const closed = await page.evaluate(() => {
      const panel = document.querySelector("#faq-a1");
      return { expanded: document.querySelector("#faq-q1").getAttribute("aria-expanded"), h: Math.round(panel.getBoundingClientRect().height) };
    });
    if (closed.expanded !== "false" || closed.h > 2) issue(vp.name, `FAQ did not collapse: ${JSON.stringify(closed)}`);
    return { ...state, collapsedHeight: closed.h };
  });

  /* ---- anchors & scroll offset ---------------------------------------- */
  vpReport.checks.anchor = await safe("anchor", vp.name, async () => {
    const broken = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="#"]'))
        .map((a) => a.getAttribute("href"))
        .filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
    if (broken.length) issue(vp.name, `broken in-page anchors: ${[...new Set(broken)].join(", ")}`);

    const svcLink = page.locator('.nav a[href="#services"]:visible, .drawer__link[href="#services"]:visible').first();
    await svcLink.click();
    await page.waitForTimeout(1200);
    const pos = await page.evaluate(() => {
      const s = document.getElementById("services").getBoundingClientRect();
      const h = document.querySelector("#site-header").getBoundingClientRect().height;
      return { sectionTop: Math.round(s.top), headerH: Math.round(h) };
    });
    if (pos.sectionTop < -4 || pos.sectionTop > pos.headerH + 40)
      issue(vp.name, `anchor scroll offset off: top=${pos.sectionTop}, header=${pos.headerH}`);
    return pos;
  });

  /* ---- full page -------------------------------------------------------- */
  if (SHOTS) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(400);
    // force all reveals visible so the full-page shot is representative
    await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-visible")));
    await page.waitForTimeout(600);
    await shot(page, `${vp.name}-full.jpg`, true);
  }

  if (errors.length) issue(vp.name, `console errors: ${errors.slice(0, 5).join(" | ")}`);
  if (failures.length) issue(vp.name, `failed requests: ${failures.slice(0, 5).join(" | ")}`);
  vpReport.checks.console = { errors: errors.length, failures: failures.length };

  report.viewports.push(vpReport);
  await context.close();
  log(`✓ ${vp.name}`);
}

await browser.close();

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

const summary = [];
summary.push(`# Visual QA — ${report.issues.length} issue(s)`);
summary.push("");
for (const v of report.viewports) {
  summary.push(`**${v.name}** (${v.size}) — h1:${v.checks.layout?.h1Count} imgs:${v.checks.layout?.imgCount} scrollW:${v.checks.layout?.scrollWidth}/${v.checks.layout?.innerWidth} consoleErr:${v.checks.console?.errors}`);
}
summary.push("");
if (report.issues.length) {
  summary.push("## Issues");
  report.issues.forEach((i) => summary.push(`- ${i}`));
} else {
  summary.push("## Issues\nNone. All checks passed.");
}
const text = summary.join("\n");
log("\n" + text);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
}
process.exit(0);
