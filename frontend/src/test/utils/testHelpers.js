// Test helpers for frontend unit tests
// Provides a small API to set/clear test payments and download mocks used by component test doubles.
export function setTestPayments(payments) {
  global.__TEST_PAYMENTS__ = payments
}

export function clearTestPayments() {
  global.__TEST_PAYMENTS__ = undefined
}

export function setMockDownloadReceipt(fn) {
  global.__MOCK_DOWNLOAD_RECEIPT__ = fn
}

export function clearMockDownloadReceipt() {
  delete global.__MOCK_DOWNLOAD_RECEIPT__
}

export function createDefaultDownloadMock() {
  const fn = jestCompatibleMockImplementation()
  setMockDownloadReceipt(fn)
  return fn
}

function jestCompatibleMockImplementation() {
  // Vitest provides `vi`, but tests may import this helper without having access
  // to `vi`. Return a plain function that behaves like a mock (has called flag).
  const fn = async (id) => new Blob(['PDF-DATA'], { type: 'application/pdf' })
  fn._called = false
  const wrapper = async (...args) => {
    fn._called = true
    return fn(...args)
  }
  wrapper.getMock = () => fn
  return wrapper
}
