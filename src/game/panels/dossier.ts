// Side panels as dossiers (§3bis D and N): paper folder tabs on the map-side edge, one
// per tab panel. A click on a closed tab opens the panel on it; a click on the open tab,
// or on the fold button of the panel's header, folds the panel down to its tabs.
// Nothing is remembered: the page always opens on each panel's first tab, unfolded, except
// on a phone, where an open panel would cover the map.

export function mountDossier(root: HTMLElement) {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const panels = [...root.querySelectorAll<HTMLElement>("[data-tabpanel]")];
  const fold = (folded: boolean) => {
    root.classList.toggle("folded", folded);
    tabs.forEach((t) => t.setAttribute("aria-expanded", String(!folded)));
  };
  const open = (name: string) => {
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    if (panels.length > 1) panels.forEach((p) => (p.hidden = p.dataset.tabpanel !== name));
    fold(false);
  };

  for (const t of tabs) {
    t.addEventListener("click", () => {
      if (t.getAttribute("aria-selected") === "true" && !root.classList.contains("folded")) fold(true);
      else open(t.dataset.tab!);
    });
  }
  root.querySelectorAll("[data-fold]").forEach((b) => b.addEventListener("click", () => fold(true)));

  open(tabs[0].dataset.tab!);
  fold(matchMedia("(max-width: 760px)").matches);
  return { open };
}
