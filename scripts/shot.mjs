// Visual smoke test: screenshot the key screens + collect console errors.
// Local dev tool only (playwright is not a project dependency). To run:
//   npm i -D playwright && npx playwright install chromium
//   npm run build && npm start          # serve on :3000
//   node scripts/shot.mjs               # -> shots/*.png
import { chromium } from "playwright";
import fs from "node:fs";

const base = "http://localhost:3000";
fs.mkdirSync("shots", { recursive: true });
const browser = await chromium.launch();
const errors = [];

async function shot(name, viewport, steps) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${name}] ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`[${name}] PAGEERROR ${e.message}`));
  try {
    await steps(page);
  } catch (e) {
    errors.push(`[${name}] STEP FAILED ${e.message}`);
  }
  await page.screenshot({ path: `shots/${name}.png` });
  await ctx.close();
}

const loadQuiz = async (page) => {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("button.answer", { timeout: 15000 });
  await page.waitForTimeout(700);
};

await shot("quiz-idle", { width: 1100, height: 850 }, loadQuiz);
await shot("quiz-reveal", { width: 1100, height: 850 }, async (page) => {
  await loadQuiz(page);
  await page.locator("button.answer").first().click();
  await page.waitForTimeout(600);
});
await shot("mode-picker", { width: 1100, height: 850 }, async (page) => {
  await loadQuiz(page);
  await page.locator("button:has-text('Mode')").first().click();
  await page.waitForTimeout(400);
});
await shot("study", { width: 1100, height: 850 }, async (page) => {
  await page.goto(base + "/study", { waitUntil: "networkidle" });
  await page.waitForSelector("button:has-text('Brazil')", { timeout: 15000 });
  await page.waitForTimeout(700);
});
await shot("team", { width: 1100, height: 950 }, async (page) => {
  await page.goto(base + "/study", { waitUntil: "networkidle" });
  await page.waitForSelector("button:has-text('Brazil')", { timeout: 15000 });
  await page.locator("button:has-text('Brazil')").first().click();
  await page.waitForTimeout(600);
});
await shot("quiz-mobile", { width: 390, height: 844 }, loadQuiz);

console.log(errors.length ? "CONSOLE ERRORS:\n" + errors.join("\n") : "no console errors");
await browser.close();
