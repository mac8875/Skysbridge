(() => {
  const page = document.querySelector(".help-page");
  const picker = document.querySelector("#helpCountry");
  if (!page || !picker) return;

  const sections = [...page.querySelectorAll(".help-region[aria-labelledby]")];
  const originalSections = [...sections];
  const pageLanguage = (document.documentElement.lang || "en").split("-")[0].toLowerCase();
  const defaultCountriesByLanguage = {
    de: ["DE", "AT", "CH"],
    en: ["US", "GB"],
    es: ["ES", "MX"],
  };
  const defaultCountries = defaultCountriesByLanguage[pageLanguage]
    || defaultCountriesByLanguage.en;
  const storageKey = `skysbridge-help-country-${pageLanguage}`;
  const legacyStorageKey = "skysbridge-help-country";
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

  function initialCountry() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && sectionForCountry(saved)) return saved;

      // Preserve a country selected before language-specific preferences were added.
      const legacySaved = localStorage.getItem(legacyStorageKey);
      if (legacySaved && sectionForCountry(legacySaved)) {
        localStorage.setItem(storageKey, legacySaved);
        localStorage.removeItem(legacyStorageKey);
        return legacySaved;
      }
    } catch {
      // Private browsing may block local storage; language defaults still work.
    }
    return defaultCountries[0] || "";
  }

  function prioritize(countryCode) {
    const preferredSections = [];
    const addCountry = (code) => {
      const sectionId = sectionForCountry(code);
      const section = sections.find(
        (item) => item.getAttribute("aria-labelledby") === sectionId,
      );
      if (section && !preferredSections.includes(section)) {
        preferredSections.push(section);
      }
    };

    if (countryCode) addCountry(countryCode);
    defaultCountries.forEach(addCountry);

    const orderedSections = [
      ...preferredSections,
      ...originalSections.filter((section) => !preferredSections.includes(section)),
    ];
    orderedSections.forEach((section) => page.append(section));
  }

  picker.value = initialCountry();
  prioritize(picker.value);

  picker.addEventListener("change", () => {
    try {
      if (picker.value) localStorage.setItem(storageKey, picker.value);
      else localStorage.removeItem(storageKey);
    } catch {
      // The selection still applies for this page view if storage is unavailable.
    }
    prioritize(picker.value);
  });
})();