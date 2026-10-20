(() => {
  const page = document.querySelector(".help-page");
  if (!page) return;

  const sections = [...page.querySelectorAll(".help-region[aria-labelledby]")];
  const sectionByCountry = {
    AE: "help-uae",
    DE: "help-germany",
    AT: "help-austria",
    CH: "help-switzerland",
    US: "help-usa",
    ES: "help-spain",
    MX: "help-mexico",
    GB: "help-uk",
    UK: "help-uk",
  };
  const spanishSpeakingCountries = new Set([
    "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "SV", "GQ",
    "GT", "HN", "NI", "PA", "PY", "PE", "PR", "UY", "VE",
  ]);

  fetch("/api/visitor-country", { headers: { Accept: "application/json" } })
    .then((response) => (response.ok ? response.json() : null))
    .then((result) => {
      const countryCode = result?.countryCode?.toUpperCase();
      if (!countryCode) return;

      const sectionId = sectionByCountry[countryCode]
        || (spanishSpeakingCountries.has(countryCode) ? "help-mexico" : null);
      const preferredSection = sections.find(
        (section) => section.getAttribute("aria-labelledby") === sectionId,
      );
      if (preferredSection && preferredSection !== sections[0]) {
        page.insertBefore(preferredSection, sections[0]);
      }
    })
    .catch(() => {
      // Keep the complete directory available in its original order if geo is unavailable.
    });
})();
