// Explanation popover (task 4.6b, Q89): an element with `data-info` (cursor "help") shows its
// explanation in a paper slip under it when clicked (or Enter / Space), instead of a hover title.
// One slip at a time, closed by a click elsewhere, Escape, a scroll or a resize.
// The tag chips and marks, the outcome label and Kharkov's owner of the turn bar use it.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Attributes of an element that explains itself on click: `html` is the slip's content. */
export const infoAttrs = (html: string) => ` data-info="${esc(html)}" tabindex="0" role="button" aria-haspopup="dialog"`;

let mounted = false;

export function mountInfoPop() {
  if (mounted) return;
  mounted = true;
  const pop = document.createElement("div");
  pop.className = "info-pop";
  pop.setAttribute("role", "dialog");
  pop.hidden = true;
  document.body.append(pop);
  let anchor: HTMLElement | null = null;

  const close = () => {
    pop.hidden = true;
    anchor?.setAttribute("aria-expanded", "false");
    anchor = null;
  };
  const open = (el: HTMLElement) => {
    if (anchor === el) { close(); return; }
    close();
    anchor = el;
    el.setAttribute("aria-expanded", "true");
    pop.innerHTML = el.dataset.info ?? "";
    pop.hidden = false;
    // Under the element, kept inside the window; above it if there is no room below.
    const r = el.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const left = Math.max(8, Math.min(r.left, innerWidth - w - 8));
    const top = r.bottom + 6 + h <= innerHeight - 8 ? r.bottom + 6 : Math.max(8, r.top - 6 - h);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  };

  // Capture: the slip opens before the element's own handlers (a log line opening its
  // "Why this move"), which the click then does not reach.
  document.addEventListener("click", (e) => {
    const el = (e.target as Element).closest<HTMLElement>("[data-info]");
    if (el) { e.stopPropagation(); e.preventDefault(); open(el); return; }
    if (!(e.target as Element).closest(".info-pop")) close();
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pop.hidden) { e.preventDefault(); close(); return; }
    const el = (e.target as Element).closest?.<HTMLElement>("[data-info]");
    if (el && (e.key === "Enter" || e.key === " ")) { e.stopPropagation(); e.preventDefault(); open(el); }
  }, true);
  addEventListener("resize", close);
  document.addEventListener("scroll", close, true);
}
