import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const LOCALES_DIR = resolve(process.cwd(), "store/locales");
const LIMITS = {
  title: 30,
  subtitle: 30,
  promoText: 170,
  description: 4000,
  keywords: 100,
};

function words(value) {
  return new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function assert(condition, message, errors) {
  if (!condition) {
    errors.push(message);
  }
}

async function validateLocale(file) {
  const locale = file.replace(/\.json$/, "");
  const copy = JSON.parse(await readFile(resolve(LOCALES_DIR, file), "utf8"));
  const errors = [];

  for (const field of ["title", "subtitle", "promoText", "description"]) {
    const value = copy[field];
    assert(typeof value === "string", `${field} must be a string`, errors);
    if (typeof value === "string") {
      assert(
        [...value].length <= LIMITS[field],
        `${field} is ${[...value].length} characters; limit is ${LIMITS[field]}`,
        errors,
      );
    }
  }

  const keywords = Array.isArray(copy.keywords) ? copy.keywords : [];
  assert(Array.isArray(copy.keywords), "keywords must be an array", errors);
  const keywordField = keywords.join(",");
  assert(
    Buffer.byteLength(keywordField, "utf8") <= LIMITS.keywords,
    `keywords use ${Buffer.byteLength(keywordField, "utf8")} bytes; limit is ${LIMITS.keywords}`,
    errors,
  );
  assert(new Set(keywords).size === keywords.length, "keywords contain duplicates", errors);
  for (const keyword of keywords) {
    assert(
      typeof keyword === "string" && keyword.length > 2,
      `keyword "${String(keyword)}" must contain at least three characters`,
      errors,
    );
    assert(!/\s/.test(keyword), `keyword "${keyword}" contains whitespace`, errors);
  }

  const indexedVisibleWords = new Set([...words(copy.title), ...words(copy.subtitle)]);
  const repeated = keywords.filter((keyword) => indexedVisibleWords.has(keyword.toLowerCase()));
  assert(
    repeated.length === 0,
    `keywords repeat title or subtitle words: ${repeated.join(", ")}`,
    errors,
  );

  for (const field of ["title", "subtitle", "promoText", "description", "releaseNotes"]) {
    const value = copy[field];
    if (typeof value === "string") {
      assert(!value.includes("\u2014"), `${field} contains an em dash`, errors);
    }
  }

  if (errors.length > 0) {
    throw new Error(`${locale}\n  ${errors.join("\n  ")}`);
  }

  console.log(
    `${locale}: valid (${Buffer.byteLength(keywordField, "utf8")}/${LIMITS.keywords} keyword bytes)`,
  );
}

const files = (await readdir(LOCALES_DIR))
  .filter((file) => file.endsWith(".json") && !file.startsWith("_"))
  .sort();

try {
  await Promise.all(files.map(validateLocale));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
