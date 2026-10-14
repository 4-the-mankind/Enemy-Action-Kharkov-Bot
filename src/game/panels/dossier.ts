// Side panels as dossiers (§3bis D and N): paper folder tabs on the map-side edge, one
// per tab panel. A click on a closed tab opens the panel on it; a click on the open tab,
// or on the fold button of the panel's header, folds the panel down to its tabs.
// Nothing is remembered: the page always opens on each panel's first tab, unfolded, except
// on a phone, where an open panel would cover the map. A tab may be disabled (Combat, D18:
// only during a combat): it stays on the edge, greyed, and cannot be opened.

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
  const selected = () => tabs.find((t) => t.getAttribute("aria-selected") === "true")?.dataset.tab ?? null;
  /** Enables or disables a tab; disabling the open one opens the first tab. */
  const enable = (name: string, on: boolean) => {
    const tab = tabs.find((t) => t.dataset.tab === name);
    if (!tab) return;
    tab.disabled = !on;
    if (!on && selected() === name) open(tabs[0].dataset.tab!);
  };
  return { open, enable, selected };
}
