// Soviet card held up to read: hovering or focusing any element with data-card="eNN" shows
// the scan large beside the pointer; a click keeps it up until another click or Escape.
import { t } from "../../i18n/i18n";
import { staticUrl } from "../../ui/static-url";

export const cardImage = (card: string) => staticUrl(`assets/cards/EAKh-sovECcards-E-${card.slice(1)}.png`);
/** The back shared by all Soviet cards. */
export const CARD_BACK = staticUrl("assets/cards/EAKh-sovECCcards-back.png");

export function mountCardZoom(root: HTMLElement = document.body) {
  const zoom = document.createElement("figure");
  zoom.className = "card-zoom";
  zoom.hidden = true;
  zoom.setAttribute("aria-hidden", "true");
  document.body.append(zoom);
  let pinned: HTMLElement | null = null;

  const show = (el: HTMLElement) => {
    const card = el.dataset.card!;
    if (zoom.dataset.card !== card) {
      zoom.dataset.card = card;
      zoom.innerHTML = `<img src="${cardImage(card)}" alt="${t("cardZoom.alt", { card: card.toUpperCase() })}">`;
    }
    zoom.hidden = false;
    // Beside the element, on the side with room, kept inside the window.
    const r = el.getBoundingClientRect(), w = zoom.offsetWidth, h = zoom.offsetHeight, gap = 12;
    const left = r.left - w - gap >= 8 ? r.left - w - gap : Math.min(r.right + gap, innerWidth - w - 8);
    zoom.style.left = `${Math.max(8, left)}px`;
    zoom.style.top = `${Math.min(Math.max(8, r.top + r.height / 2 - h / 2), innerHeight - h - 8)}px`;
  };
  const hide = () => { if (!pinned) zoom.hidden = true; };
  const target = (e: Event) => (e.target as Element | null)?.closest?.<HTMLElement>("[data-card]") ?? null;

  root.addEventListener("pointerover", (e) => { const t = target(e); if (t && !pinned) show(t); });
  root.addEventListener("pointerout", (e) => { const t = target(e); if (t && !t.contains(e.relatedTarget as Node)) hide(); });
  root.addEventListener("focusin", (e) => { const t = target(e); if (t && !pinned) show(t); });
  root.addEventListener("focusout", (e) => { if (target(e)) hide(); });
  document.addEventListener("click", (e) => {
    const t = target(e);
    if (t && t !== pinned) { pinned = t; show(t); zoom.classList.add("pinned"); return; }
    pinned = null;
    zoom.classList.remove("pinned");
    zoom.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pinned) { e.preventDefault(); pinned = null; zoom.classList.remove("pinned"); zoom.hidden = true; }
  });
}
