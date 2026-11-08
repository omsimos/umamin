// Own module so tests can observe a reload: jsdom's location.reload is
// unforgeable and can't be spied on.
export function reloadPage() {
  window.location.reload();
}
