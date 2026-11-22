/**
 * Visual + functional QA for the Spotless Cleaning homepage.
 * Runs in GitHub Actions (Chromium with system fonts).
 *
 * Checks: console errors, failed requests, broken images, horizontal overflow,
 * menu/drawer/FAB/FAQ behaviour, anchor targets, tap-target sizes.
 * Outputs screenshots to qa/out and a JSON report to qa/out/report.json.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.QA_URL || "http://127.0.0.1:8080/";
const OUT = path.join(process.cwd(), "qa", "out");
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

const report = { generated: new Date().toISOString(), viewports: [], issues: [] };
const addIssue = (where, msg) => report.issues.push(`${where}: ${msg}`);

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    userAgent: vp.mobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : undefined,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];

  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) =>
    failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`)
  );
  page.on("response", (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.url()} :: HTTP ${r.status()}`);
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // ---- overflow / broken images -----------------------------------------
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [];
    if (doc.scrollWidth > window.innerWidth + 1) {
      document.querySelectorAll("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
          const cs = getComputedStyle(el);
          if (cs.position === "fixed") return;
          wide.push(
            `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ").filter(Boolean).join(".")} right=${Math.round(r.right)} left=${Math.round(r.left)}`
          );
        }
      });
    }
    const brokenImages = Array.from(document.images)
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.currentSrc || img.src);
    const missingAlt = Array.from(document.images)
      .filter((img) => !img.hasAttribute("alt"))
      .map((img) => img.src);
    const smallTargets = Array.from(document.querySelectorAll("a, button")).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 24);
    }).map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    return {
      docScrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      wide: wide.slice(0, 12),
      brokenImages,
      missingAlt,
      smallTargets: smallTargets.slice(0, 12),
      headerHeight: document.querySelector("#site-header")?.getBoundingClientRect().height,
      fabVisible: !!document.querySelector("#fab") &&
        getComputedStyle(document.querySelector("#fab")).visibility !== "hidden",
    };
  });

  if (metrics.docScrollWidth > metrics.innerWidth + 1)
    addIssue(vp.name, `horizontal overflow ${metrics.docScrollWidth} > ${metrics.innerWidth} :: ${metrics.wide.join(" | ")}`);
  if (metrics.brokenImages.length) addIssue(vp.name, `broken images: ${metrics.brokenImages.join(", ")}`);
  if (metrics.missingAlt.length) addIssue(vp.name, `images missing alt: ${metrics.missingAlt.join(", ")}`);
  if (metrics.smallTargets.length) addIssue(vp.name, `small tap targets: ${metrics.smallTargets.join(" | ")}`);

  await page.screenshot({ path: path.join(OUT, `${vp.name}-hero.png`) });
  await page.screenshot({ path: path.join(OUT, `${vp.name}-full.png`), fullPage: true });

  // ---- interactions ------------------------------------------------------
  const interactions = {};

  if (vp.mobile) {
    await page.click("#navToggle");
    await page.waitForTimeout(500);
    interactions.drawerOpen = await page.evaluate(() => {
      const d = document.querySelector("#drawer");
      const s = getComputedStyle(d);
      return {
        visible: s.visibility === "visible" && Number(s.opacity) > 0.9,
        expanded: document.querySelector("#navToggle").getAttribute("aria-expanded"),
        locked: document.body.classList.contains("is-locked"),
        focusInDrawer: document.querySelector("#drawer").contains(document.activeElement),
        linksInView: Array.from(document.querySelectorAll(".drawer__link")).every((l) => {
          const r = l.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= window.innerHeight + 1;
        }),
      };
    });
    await page.screenshot({ path: path.join(OUT, `${vp.name}-drawer.png`) });

    // drawer must not push scroll
    interactions.scrollLocked = await page.evaluate(
      () => getComputedStyle(document.body).overflow === "hidden"
    );

    await page.click("#navToggle");
    await page.waitForTimeout(450);
    interactions.drawerClosed = await page.evaluate(
      () => !document.body.classList.contains("menu-open")
    );
  } else {
    interactions.navVisible = await page.evaluate(() => {
      const nav = document.querySelector(".nav");
      return getComputedStyle(nav).display !== "none";
    });
  }

  // FAB
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.55));
  await page.waitForTimeout(500);
  const fabBox = await page.locator("#fabToggle").boundingBox();
  interactions.fabBox = fabBox;
  if (fabBox) {
    const onScreen =
      fabBox.x >= 0 && fabBox.y >= 0 &&
      fabBox.x + fabBox.width <= vp.width + 1 &&
      fabBox.y + fabBox.height <= vp.height + 1;
    if (!onScreen) addIssue(vp.name, `FAB outside viewport: ${JSON.stringify(fabBox)}`);
    const overlap = await page.evaluate(({ x, y, w, h }) => {
      const el = document.elementFromPoint(x + w / 2, y + h / 2);
      return el ? el.closest("#fab") !== null : false;
    }, fabBox);
    if (!overlap) addIssue(vp.name, "FAB is covered by another element");
  }

  await page.click("#fabToggle");
  await page.waitForTimeout(450);
  interactions.fabOpen = await page.evaluate(() => {
    const actions = Array.from(document.querySelectorAll(".fab__action"));
    return {
      open: document.querySelector("#fab").classList.contains("is-open"),
      allVisible: actions.every((a) => {
        const s = getComputedStyle(a);
        const r = a.getBoundingClientRect();
        return Number(s.opacity) > 0.9 && r.left >= 0 && r.right <= window.innerWidth + 1;
      }),
    };
  });
  await page.screenshot({ path: path.join(OUT, `${vp.name}-fab.png`) });
  await page.click("#fabToggle");
  await page.waitForTimeout(350);

  // FAQ
  await page.evaluate(() => document.querySelector("#faq").scrollIntoView());
  await page.waitForTimeout(400);
  await page.click("#faq-q1");
  await page.waitForTimeout(500);
  interactions.faq = await page.evaluate(() => {
    const btn = document.querySelector("#faq-q1");
    const panel = document.querySelector("#faq-a1");
    return {
      expanded: btn.getAttribute("aria-expanded"),
      height: panel.getBoundingClientRect().height,
      othersClosed: Array.from(document.querySelectorAll(".faq__q"))
        .filter((b) => b !== btn)
        .every((b) => b.getAttribute("aria-expanded") === "false"),
    };
  });
  if (interactions.faq.expanded !== "true" || interactions.faq.height < 20)
    addIssue(vp.name, `FAQ did not open: ${JSON.stringify(interactions.faq)}`);
  await page.screenshot({ path: path.join(OUT, `${vp.name}-faq.png`) });

  // Anchor integrity + smooth-scroll offset
  const anchors = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      const id = a.getAttribute("href").slice(1);
      if (id && !document.getElementById(id)) bad.push(a.getAttribute("href"));
    });
    return bad;
  });
  if (anchors.length) addIssue(vp.name, `broken in-page anchors: ${anchors.join(", ")}`);

  await page.click('a[href="#services"]');
  await page.waitForTimeout(900);
  const anchorPos = await page.evaluate(() => {
    const s = document.getElementById("services").getBoundingClientRect();
    const h = document.querySelector("#site-header").getBoundingClientRect().height;
    return { sectionTop: s.top, headerH: h };
  });
  if (anchorPos.sectionTop < -4 || anchorPos.sectionTop > anchorPos.headerH + 40)
    addIssue(vp.name, `anchor offset wrong: section top ${anchorPos.sectionTop} vs header ${anchorPos.headerH}`);
  interactions.anchorPos = anchorPos;

  if (consoleErrors.length) addIssue(vp.name, `console errors: ${consoleErrors.slice(0, 4).join(" | ")}`);
  if (failedRequests.length) addIssue(vp.name, `failed requests: ${failedRequests.slice(0, 6).join(" | ")}`);

  report.viewports.push({ name: vp.name, metrics, interactions });
  await context.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.issues, null, 2));
console.log(`\nScreenshots: ${fs.readdirSync(OUT).length} files`);
if (report.issues.length) {
  console.log(`\n${report.issues.length} issue(s) found.`);
}
