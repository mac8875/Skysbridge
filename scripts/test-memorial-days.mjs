import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const cases = [
  { file: "js/app.js", locale: "en" },
  { file: "js/app-de-v41.js", locale: "de" },
  { file: "js/app-es.js", locale: "es" },
];
let sharedDateLogic = null;

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} exists`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  assert.fail(`${name} has a closing brace`);
}

for (const { file, locale } of cases) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const functions = ["sameMonthAndDay", "memorialDayState", "memorialSymbolMarkup"]
    .map(name => extractFunction(source, name)).join("\n");
  const dateLogic = ["sameMonthAndDay", "memorialDayState"].map(name => extractFunction(source, name)).join("\n");
  if (sharedDateLogic === null) sharedDateLogic = dateLogic;
  else assert.equal(dateLogic, sharedDateLogic, `${locale}: all language versions use the same date rules`);
  const context = { module: { exports: {} } };
  vm.runInNewContext(`${functions}\nmodule.exports={sameMonthAndDay,memorialDayState,memorialSymbolMarkup};`, context);
  const { sameMonthAndDay, memorialDayState, memorialSymbolMarkup } = context.module.exports;
  const birthday = new Date(2026, 6, 24, 12);
  const anniversary = new Date(2026, 6, 25, 12);
  assert.equal(sameMonthAndDay("2018-07-24", birthday), true, `${locale}: birthday recurs annually`);
  assert.equal(sameMonthAndDay("2018-07-25", birthday), false, `${locale}: other date stays standard`);
  assert.equal(sameMonthAndDay("2018-02-29", birthday), false, `${locale}: impossible date is rejected`);
  assert.equal(sameMonthAndDay("2018-13-24", birthday), false, `${locale}: invalid month is rejected`);
  assert.equal(memorialDayState({ birth_date: "2018-07-24", passing_date: "2018-07-25" }, birthday), "birthday");
  assert.equal(memorialDayState({ birth_date: "2018-07-24", passing_date: "2018-07-25" }, anniversary), "anniversary");
  assert.equal(memorialDayState({ birth_date: "2018-07-24", passing_date: "2018-07-24" }, birthday), "anniversary", `${locale}: passing date takes priority`);
  assert.match(memorialSymbolMarkup("anniversary", false), /memorial-candle-image/, `${locale}: candle appears on the star card`);
  assert.match(memorialSymbolMarkup("anniversary", true), /memorial-candle-image/, `${locale}: candle appears in details`);
  assert.match(memorialSymbolMarkup("birthday", false, "classic"), /star-classic/, `${locale}: birthday keeps its selected star`);
  assert.match(memorialSymbolMarkup("standard", false, "north"), /star-north/, `${locale}: ordinary dates keep the selected star`);
  console.log(`${locale}: date and symbol checks passed`);
}

const styles = await readFile(new URL("../css/styles.css", import.meta.url), "utf8");
assert.match(styles, /\.memorial-card\.is-birthday \.memorial-star-shape[\s\S]*?brightness\(1\.2\)/, "birthday stars glow brighter");
assert.match(styles, /\.celestial-wall \.memorial-card\.is-anniversary \.memorial-candle-image/, "anniversary candles fit the star map");
