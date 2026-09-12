// Sky's family remembrance dates drive visuals only; the expected date is not displayed.
(() => {
  function state(today = new Date()) {
    const month = today.getMonth() + 1;
    const day = today.getDate();
    if (month === 2 && day === 9) return "anniversary";
    if (month === 8 && day === 18) return "birthday";
    return "standard";
  }
  function symbol(detailed = false, today = new Date()) {
    if (state(today) === "anniversary") {
      return '<img class="memorial-candle-image" src="assets/memorial-candle.svg" alt="">';
    }
    return detailed
      ? '<img src="assets/memorial-star.svg?v=55" alt="">'
      : '<span class="sky-symbol" aria-hidden="true"></span>';
  }
  function applyState(element, today) {
    element.classList.toggle("is-anniversary", state(today) === "anniversary");
    element.classList.toggle("is-birthday", state(today) === "birthday");
    element.classList.toggle("is-standard", state(today) === "standard");
  }
  let lastDay;
  function refresh() {
    const today = new Date();
    const dayKey = today.toDateString();
    if (lastDay === dayKey) return;
    lastDay = dayKey;
    document.querySelectorAll('[data-star="sky"]').forEach(card => {
      applyState(card, today);
      const target = card.querySelector(".memorial-symbol");
      if (target) target.innerHTML = symbol(false, today);
    });
    const nativeStory = document.querySelector("#sky-de-modal .star-remembrance");
    if (nativeStory) {
      applyState(nativeStory, today);
      const target = nativeStory.querySelector(".star-remembrance-symbol");
      if (target) target.innerHTML = symbol(true, today);
    }
    const openStory = document.querySelector("#modalContent .star-remembrance");
    if (openStory && openStory.querySelector("#modalTitle")?.textContent === "Sky") {
      applyState(openStory, today);
      openStory.querySelector(".star-remembrance-symbol").innerHTML = symbol(true, today);
    }
  }
  window.SkyRemembrance = { state, symbol };
  refresh();
  window.setInterval(refresh, 60000);
})();
