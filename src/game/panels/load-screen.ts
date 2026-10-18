// Loading screen (task 5.2, Q97): a slip on the middle of the map while a save's commands are
// replayed, with the game-turn reached and a progress bar. The page stays responsive.
import { t } from "../../i18n/i18n";

export function mountLoadScreen(root: HTMLElement) {
  root.innerHTML = `<h2>${t("save.loading.title")}</h2>
    <p class="load-count"></p>
    <progress max="1" value="0"></progress>`;
  const count = root.querySelector<HTMLElement>(".load-count")!, bar = root.querySelector<HTMLProgressElement>("progress")!;
  let total = 0;
  const progress = (done: number, turn: number) => {
    count.textContent = t("save.loading.count", { turn, done, count: total });
    bar.max = Math.max(total, 1);
    bar.value = done;
  };
  return {
    show(commands: number) {
      total = commands;
      root.hidden = false;
      document.body.classList.add("loading-save");
      progress(0, 1);
    },
    progress,
    hide() {
      root.hidden = true;
      document.body.classList.remove("loading-save");
    },
  };
}
