import { writeFile } from "node:fs/promises";
import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";
import { japaneseTranslations } from "../src/i18n.js";

const kuroshiro = new Kuroshiro();
await kuroshiro.init(new KuromojiAnalyzer());

const romajiTranslations = {};
for (const [source, japanese] of Object.entries(japaneseTranslations)) {
  const converted = await kuroshiro.convert(japanese, {
    mode: "spaced",
    to: "romaji",
    romajiSystem: "passport",
  });
  romajiTranslations[source] =
    source === "Good morning,"
      ? "Ohayou gozaimasu,"
      : converted
          .replace(/\s+/g, " ")
          .replace(/\s+([,，。.!?;:])/g, "$1")
          .replace(/\(\s+/g, "(")
          .replace(/\s+\)/g, ")")
          .replace(/\bgozai masu\b/gi, "gozaimasu")
          .replace(/^([a-z])/, (letter) => letter.toUpperCase())
          .trim();
}

const output = `// Generated with \`npm run generate:romaji\`; do not edit by hand.\nexport default ${JSON.stringify(romajiTranslations, null, 2)};\n`;
await writeFile(new URL("../src/i18n.romaji.js", import.meta.url), output);
console.log(
  `Generated Romaji translations for ${Object.keys(romajiTranslations).length} UI strings.`,
);
