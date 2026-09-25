import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio } from "@/lib/a11y/contrast";

const root = path.resolve(__dirname, "../../..");

function themeColor(name: string): string {
  const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) {
    throw new Error(`Missing theme color ${name}`);
  }
  return match[1];
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      return entry === "generated" ? [] : sourceFiles(fullPath);
    }
    return fullPath.endsWith(".tsx") ? [fullPath] : [];
  });
}

describe("theme contrast", () => {
  it("keeps text and meaningful greens above WCAG thresholds", () => {
    const paper = themeColor("paper");
    const dark = "#0e1512";
    expect(contrastRatio(themeColor("ink"), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(themeColor("moss-700"), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(themeColor("moss-500"), paper)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(themeColor("moss-900"), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(themeColor("amber-800"), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", themeColor("moss-700"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(themeColor("moss-300"), dark)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(themeColor("moss-100"), dark)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(themeColor("moss-900"), themeColor("moss-300"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(themeColor("moss-300"), paper)).toBeLessThan(3);
  });

  it("does not use low-contrast colors for light-mode text or graphics", () => {
    const unsafe =
      /(?:^|[\s"'`])(?:text-ink\/(?:40|50|60)|(?:text|bg|stroke|fill)-moss-300(?:\/\d+)?)(?=$|[\s"'`])/;
    const failures = sourceFiles(path.join(root, "src"))
      .map((file) => {
        const lightMode = readFileSync(file, "utf8").replace(/dark:[^\s"'`]+/g, "");
        return unsafe.test(lightMode) ? path.relative(root, file) : null;
      })
      .filter((file) => file !== null);

    expect(failures).toEqual([]);
  });
});
