"use strict";

const memorials = [
  {
      name: "Sky",
          birthDate: "",
              passingDate: "",
                  featured: true
                    },
                      {
                          name: "S",
                              birthDate: "",
                                  passingDate: ""
                                    },
                                      {
                                          name: "Ben",
                                              birthDate: "",
                                                  passingDate: ""
                                                    },
                                                      {
                                                          name: "Gb",
                                                              birthDate: "2020-07-26",
                                                                  passingDate: "2020-08-06"
                                                                    },
                                                                      {
                                                                          name: "Max",
                                                                              birthDate: "",
                                                                                  passingDate: ""
                                                                                    }
                                                                                    ];

                                                                                    function isSameCalendarDay(dateString, today = new Date()) {
                                                                                      if (!dateString) return false;

                                                                                        const date = new Date(`${dateString}T12:00:00`);

                                                                                          if (Number.isNaN(date.getTime())) {
                                                                                              return false;
                                                                                                }

                                                                                                  return (
                                                                                                      date.getMonth() === today.getMonth() &&
                                                                                                          date.getDate() === today.getDate()
                                                                                                            );
                                                                                                            }

                                                                                                            function getMemorialState(memorial, today = new Date()) {
                                                                                                              if (isSameCalendarDay(memorial.passingDate, today)) {
                                                                                                                  return "anniversary";
                                                                                                                    }

                                                                                                                      if (isSameCalendarDay(memorial.birthDate, today)) {
                                                                                                                          return "birthday";
                                                                                                                            }

                                                                                                                              return "standard";
                                                                                                                              }

                                                                                                                              function createStar() {
                                                                                                                                const star = document.createElement("div");
                                                                                                                                  star.className = "memorial-star";
                                                                                                                                    star.setAttribute("aria-hidden", "true");

                                                                                                                                      return star;
                                                                                                                                      }

                                                                                                                                      function createCandle() {
                                                                                                                                        const candle = document.createElement("img");

                                                                                                                                          candle.className = "memorial-candle";
                                                                                                                                            candle.src = "assets/memorial-candle.svg";
                                                                                                                                              candle.alt = "A memorial candle";
                                                                                                                                                candle.loading = "lazy";

                                                                                                                                                  return candle;
                                                                                                                                                  }

                                                                                                                                                  function createMemorialCard(memorial) {
                                                                                                                                                    const state = getMemorialState(memorial);

                                                                                                                                                      const card = document.createElement("article");
                                                                                                                                                        card.className = "memorial-card";

                                                                                                                                                          if (memorial.featured) {
                                                                                                                                                              card.classList.add("is-featured");
                                                                                                                                                                }

                                                                                                                                                                  if (state === "birthday") {
                                                                                                                                                                      card.classList.add("is-birthday");
                                                                                                                                                                        }

                                                                                                                                                                          if (state === "anniversary") {
                                                                                                                                                                              card.classList.add("is-anniversary");
                                                                                                                                                                                }

                                                                                                                                                                                  /*
                                                                                                                                                                                     * Standard day:
                                                                                                                                                                                        * A normal gold star is shown.
                                                                                                                                                                                           *
                                                                                                                                                                                              * Birthday:
                                                                                                                                                                                                 * The same star receives a gentle glow.
                                                                                                                                                                                                    *
                                                                                                                                                                                                       * Passing anniversary:
                                                                                                                                                                                                          * The star is replaced by the memorial candle.
                                                                                                                                                                                                             */
                                                                                                                                                                                                               if (state === "anniversary") {
                                                                                                                                                                                                                   card.appendChild(createCandle());
                                                                                                                                                                                                                     } else {
                                                                                                                                                                                                                         card.appendChild(createStar());
                                                                                                                                                                                                                           }

                                                                                                                                                                                                                             const name = document.createElement("h2");
                                                                                                                                                                                                                               name.textContent = memorial.name || "Forever loved";
                                                                                                                                                                                                                                 card.appendChild(name);

                                                                                                                                                                                                                                   if (state === "birthday") {
                                                                                                                                                                                                                                       card.setAttribute(
                                                                                                                                                                                                                                             "aria-label",
                                                                                                                                                                                                                                                   `${name.textContent}: today we celebrate their birthday`
                                                                                                                                                                                                                                                       );
                                                                                                                                                                                                                                                         } else if (state === "anniversary") {
                                                                                                                                                                                                                                                             card.setAttribute(
                                                                                                                                                                                                                                                                   "aria-label",
                                                                                                                                                                                                                                                                         `${name.textContent}: today we remember them`
                                                                                                                                                                                                                                                                             );
                                                                                                                                                                                                                                                                               } else {
                                                                                                                                                                                                                                                                                   card.setAttribute("aria-label", name.textContent);
                                                                                                                                                                                                                                                                                     }

                                                                                                                                                                                                                                                                                       return card;
                                                                                                                                                                                                                                                                                       }

                                                                                                                                                                                                                                                                                       function renderWall() {
                                                                                                                                                                                                                                                                                         const wallGrid = document.getElementById("wall-grid");

                                                                                                                                                                                                                                                                                           if (!wallGrid) {
                                                                                                                                                                                                                                                                                               console.error("The Wall of Stars container was not found.");
                                                                                                                                                                                                                                                                                                   return;
                                                                                                                                                                                                                                                                                                     }

                                                                                                                                                                                                                                                                                                       wallGrid.replaceChildren();

                                                                                                                                                                                                                                                                                                         memorials.forEach((memorial) => {
                                                                                                                                                                                                                                                                                                             wallGrid.appendChild(createMemorialCard(memorial));
                                                                                                                                                                                                                                                                                                               });
                                                                                                                                                                                                                                                                                                               }

                                                                                                                                                                                                                                                                                                               document.addEventListener("DOMContentLoaded", renderWall);