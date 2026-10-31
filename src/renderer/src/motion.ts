import { animate } from "animejs";

export function slideWidth(el: HTMLElement, width: number): void {
  const next = `${width}px`;
  el.style.width = `${el.getBoundingClientRect().width}px`;
  animate(el, { width: next, duration: 280, ease: "outQuad" }).then(() => {
    el.style.width = next;
  });
}
