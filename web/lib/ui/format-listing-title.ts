const SMALL_WORDS = new Set(["in", "and", "of", "to", "for"]);

const ACRONYM_MAP: Record<string, string> = {
  AC: "AC",
  CCTV: "CCTV",
  NYC: "NYC",
  WIFI: "Wi-Fi",
  "WI-FI": "Wi-Fi",
};

const ROMAN_NUMERAL_PATTERN =
  /^(?=[ivxlcdm]+$)m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;

function hasMeaningfulMixedCase(word: string): boolean {
  return /[a-z][A-Z]/.test(word) || /[A-Z][a-z]+[A-Z]/.test(word);
}

function isMostlyUppercase(input: string): boolean {
  const letters = input.match(/[A-Za-z]/g) ?? [];
  if (!letters.length) return false;
  const upperCount = letters.filter((char) => char === char.toUpperCase()).length;
  return upperCount / letters.length >= 0.9;
}

function splitWordAffixes(word: string): { prefix: string; core: string; suffix: string } {
  const match = word.match(/^([^A-Za-z0-9]*)([A-Za-z0-9'./-]+)([^A-Za-z0-9]*)$/);
  if (!match) {
    return {
      prefix: "",
      core: "",
      suffix: "",
    };
  }
  return {
    prefix: match[1] ?? "",
    core: match[2] ?? "",
    suffix: match[3] ?? "",
  };
}

function titleCaseWord(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatAlphaNumericToken(core: string): string {
  if (/^\d+$/.test(core)) return core;

  const prefixDigits = core.match(/^(\d+)([A-Za-z]+)$/);
  if (prefixDigits) {
    const digits = prefixDigits[1] ?? "";
    const letters = prefixDigits[2] ?? "";
    const upperLetters = letters.toUpperCase();
    if (upperLetters === "SQM" || upperLetters === "SQFT") {
      return `${digits}${upperLetters.toLowerCase()}`;
    }
    if (letters === upperLetters && letters.length <= 3) {
      return `${digits}${upperLetters}`;
    }
    return `${digits}${letters.toLowerCase()}`;
  }

  const suffixDigits = core.match(/^([A-Za-z]+)(\d+)$/);
  if (suffixDigits) {
    const letters = suffixDigits[1] ?? "";
    const digits = suffixDigits[2] ?? "";
    if (letters === letters.toUpperCase() && letters.length <= 3) {
      return `${letters}${digits}`;
    }
    return `${titleCaseWord(letters)}${digits}`;
  }

  return core;
}

function formatCoreWord(
  core: string,
  options: {
    isFirstWord: boolean;
    mostlyUppercaseInput: boolean;
  }
): string {
  if (!core) return core;

  const upperCore = core.toUpperCase();
  const acronym = ACRONYM_MAP[upperCore];
  if (acronym) return acronym;

  if (ROMAN_NUMERAL_PATTERN.test(core)) {
    return upperCore;
  }

  if (/\d/.test(core)) {
    return formatAlphaNumericToken(core);
  }

  if (!options.mostlyUppercaseInput && hasMeaningfulMixedCase(core)) {
    return core;
  }

  const lowerCore = core.toLowerCase();
  if (!options.isFirstWord && !options.mostlyUppercaseInput && SMALL_WORDS.has(lowerCore)) {
    return lowerCore;
  }

  if (core === upperCore && core.length > 1 && ACRONYM_MAP[upperCore]) {
    return ACRONYM_MAP[upperCore];
  }

  return titleCaseWord(core);
}

function formatWord(
  word: string,
  options: {
    isFirstWord: boolean;
    mostlyUppercaseInput: boolean;
  }
): string {
  if (!word) return word;
  const { prefix, core, suffix } = splitWordAffixes(word);
  if (!core) return word;

  const slashSegments = core.split(/(\/)/);
  let segmentIndex = 0;
  const formattedCore = slashSegments
    .map((segment) => {
      if (segment === "/") return segment;
      const hyphenSegments = segment.split(/(-)/);
      return hyphenSegments
        .map((hyphenPart) => {
          if (hyphenPart === "-") return hyphenPart;
          const formatted = formatCoreWord(hyphenPart, {
            isFirstWord: options.isFirstWord && segmentIndex === 0,
            mostlyUppercaseInput: options.mostlyUppercaseInput,
          });
          segmentIndex += 1;
          return formatted;
        })
        .join("");
    })
    .join("");

  return `${prefix}${formattedCore}${suffix}`;
}

export function formatListingTitle(input: string): string {
  const normalized = input.trim().replace(/\s+/g, " ");
  if (!normalized) return "";

  const mostlyUppercaseInput = isMostlyUppercase(normalized);
  const words = normalized.split(" ");

  return words
    .map((word, index) =>
      formatWord(word, {
        isFirstWord: index === 0,
        mostlyUppercaseInput,
      })
    )
    .join(" ");
}
