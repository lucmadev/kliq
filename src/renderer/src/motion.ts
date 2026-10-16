import { animate } from "animejs";

function settle(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles);
}

export function fadeIn(el: HTMLElement): void {
  animate(el, { opacity: [0, 1], translateY: [8, 0], duration: 280, ease: "outQuad" }).then(() => {
    settle(el, { opacity: "1", translate: "none" });
  });
}

export function slideWidth(el: HTMLElement, width: number): void {
  const next = `${width}px`;
  el.style.width = `${el.getBoundingClientRect().width}px`;
  animate(el, { width: next, duration: 280, ease: "outQuad" }).then(() => {
    el.style.width = next;
  });
}

export function revealOnce(el: HTMLElement, delay: number): void {
  animate(el, { opacity: [0, 1], translateY: [12, 0], delay, duration: 420, ease: "outQuad" }).then(() => {
    settle(el, { opacity: "1", translate: "none" });
  });
}
