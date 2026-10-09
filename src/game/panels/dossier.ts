// Side panels as dossiers (§3bis D and N): paper folder tabs on the map-side edge, one
// per tab panel. A click on a closed tab opens the panel on it; a click on the open tab,
// or on the fold button of the panel's header, folds the panel down to its tabs.
// Folded state and open tab are remembered per browser (viewer convenience).

export function mountDossier(root: HTMLElement, key: string) {
  const storageKey = `ea-kharkov.game.dossier.${key}`;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const panels = [...root.querySelectorAll<HTMLElement>("[data-tabpanel]")];
  let saved: { folded?: boolean; tab?: string } = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}") ?? {}; } catch { /* storage blocked */ }

  const save = () => {
    const tab = tabs.find((t) => t.getAttribute("aria-selected") === "true")?.dataset.tab;
    try { localStorage.setItem(storageKey, JSON.stringify({ folded: root.classList.contains("folded"), tab })); } catch { /* storage blocked */ }
  };
  const fold = (folded: boolean) => {
    root.classList.toggle("folded", folded);
    tabs.forEach((t) => t.setAttribute("aria-expanded", String(!folded)));
    save();
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

  open(tabs.some((t) => t.dataset.tab === saved.tab) ? saved.tab! : tabs[0].dataset.tab!);
  fold(saved.folded ?? matchMedia("(max-width: 760px)").matches);
}
