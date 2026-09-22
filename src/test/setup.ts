import "@testing-library/jest-dom/vitest";

Element.prototype.scrollIntoView = () => undefined;

Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  value() {
    return Promise.resolve();
  },
});

Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value() {
    return undefined;
  },
});
