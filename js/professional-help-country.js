(() => {
  const page = document.querySelector(".help-page");
  const picker = document.querySelector("#helpCountry");
  if (!page || !picker) return;

  const sections = [...page.querySelectorAll(".help-region[aria-labelledby]")];
  const originalSections = [...sections];
  const sectionByCountry = {
    AE: "help-uae",
    DE: "help-germany",
    AT: "help-austria",
    CH: "help-switzerland",
    US: "help-usa",
    ES: "help-spain",
    MX: "help-mexico",
    GB: "help-uk",
  };
  const spanishSpeakingCountries = new Set([
    "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "SV", "GQ",
    "GT", "HN", "NI", "PA", "PY", "PE", "PR", "UY", "VE",
  ]);

  function sectionForCountry(countryCode) {
    if (countryCode === "ES-LATAM") return "help-mexico";
    return sectionByCountry[countryCode]
      || (spanishSpeakingCountries.has(countryCode) ? "help-mexico" : null);
  }

  function regionFromLocale(locale) {
    try {
      return new Intl.Locale(locale).region || null;
    } catch {
      const parts = locale.replaceAll("_", "-").split("-");
      return parts.find((part) => /^[A-Za-z]{2}$/.test(part))?.toUpperCase() || null;
    }
  }

  function initialCountry() {
    try {
      const saved = localStorage.getItem("skysbridge-help-country");
      if (saved && sectionForCountry(saved)) return saved;
    } catch {
      // Private browsing may block local storage; browser-language detection still works.
    }

    const locales = [...(navigator.languages || []), navigator.language].filter(Boolean);
    for (const locale of locales) {
      const countryCode = regionFromLocale(locale);
      if (!countryCode) continue;
      if (sectionByCountry[countryCode]) return countryCode;
      if (spanishSpeakingCountries.has(countryCode)) return "ES-LATAM";
    }
    return "";
  }

  function prioritize(countryCode) {
    const sectionId = sectionForCountry(countryCode);
    const preferredSection = sections.find(
      (section) => section.getAttribute("aria-labelledby") === sectionId,
    );

    const currentFirstSection = page.querySelector(".help-region[aria-labelledby]");
    if (preferredSection && preferredSection !== currentFirstSection) {
      page.insertBefore(preferredSection, currentFirstSection);
    }
    else originalSections.forEach((section) => page.append(section));
  }

  picker.value = initialCountry();
  prioritize(picker.value);

  picker.addEventListener("change", () => {
    try {
      if (picker.value) localStorage.setItem("skysbridge-help-country", picker.value);
      else localStorage.removeItem("skysbridge-help-country");
    } catch {
      // The selection still applies for this page view if storage is unavailable.
    }
    prioritize(picker.value);
  });
})();
