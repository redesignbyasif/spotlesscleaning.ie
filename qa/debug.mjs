import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await p.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await p.evaluate(() => window.scrollTo(0, 1200));
await p.waitForTimeout(400);
console.log(JSON.stringify(await p.evaluate(() => {
  const el = document.querySelector("#fabToggle");
  const fab = document.querySelector("#fab");
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const fs = getComputedStyle(fab);
  return {
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    display: cs.display, position: cs.position, visibility: cs.visibility, opacity: cs.opacity,
    fabPosition: fs.position, fabRight: fs.right, fabBottom: fs.bottom, fabDisplay: fs.display,
    fabRect: (() => { const q = fab.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; })(),
    svgs: Array.from(el.querySelectorAll("svg")).map(s => { const q = s.getBoundingClientRect(); return { w: q.width, h: q.height }; }),
    stylesheets: Array.from(document.styleSheets).map(s => s.href),
    fabCss: (() => { const out=[]; for (const sh of document.styleSheets) { try { for (const rule of sh.cssRules) { if (rule.cssText && rule.cssText.includes('.fab__toggle')) out.push(rule.cssText.slice(0,200)); } } catch(e){} } return out; })(),
  };
}), null, 2));
await b.close();
