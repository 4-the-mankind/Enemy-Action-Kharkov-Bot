// Layers panel: one "acetate sheet" per layer, laid over the map or lifted off.
// Keys 1…n toggle the layers in panel order.
import type { LayerStack } from "../map/layer-stack";
import { t } from "../../i18n/i18n";

export function mountLayersPanel(root: HTMLElement, stack: LayerStack) {
  root.innerHTML = stack.layers.map((l, i) => `
    <li>
      <button type="button" class="sheet" data-layer="${l.id}" style="--ink: ${l.color}"
        aria-pressed="false" aria-keyshortcuts="${i + 1}" title="${t(l.description)}">
        <span class="sheet-ink" aria-hidden="true"></span>
        <span class="sheet-label">${t(l.label)}</span>
        <kbd>${i + 1}</kbd>
      </button>
    </li>`).join("");

  const sync = () => root.querySelectorAll<HTMLButtonElement>(".sheet").forEach((b) => {
    b.setAttribute("aria-pressed", String(stack.isOn(b.dataset.layer!)));
  });
  root.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".sheet");
    if (b) stack.toggle(b.dataset.layer!);
  });
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).matches("input, select, textarea")) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= stack.layers.length) stack.toggle(stack.layers[n - 1].id);
  });
  stack.onChange(sync);
  sync();
}
