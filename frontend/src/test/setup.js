import '@testing-library/jest-dom/vitest'

beforeEach(() => {
  sessionStorage.clear()
})

// Polyfill URL.createObjectURL / revokeObjectURL used in DataTable export
global.URL.createObjectURL = global.URL.createObjectURL || function () {
  return 'blob://stub'
}
global.URL.revokeObjectURL = global.URL.revokeObjectURL || function () {}

// Prevent jsdom navigation errors where tests create anchor elements for downloads.
// jsdom does not implement navigation; stub anchor clicks and window.location.assign.
if (typeof HTMLAnchorElement !== 'undefined' && HTMLAnchorElement.prototype) {
  HTMLAnchorElement.prototype.click = HTMLAnchorElement.prototype.click || function () {}
}
Object.defineProperty(window, 'location', {
  configurable: true,
  value: {
    ...window.location,
    assign: () => {},
  },
})
