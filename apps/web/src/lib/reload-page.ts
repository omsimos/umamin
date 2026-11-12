// Own module so tests can observe a reload or a navigation: jsdom's location
// is unforgeable and can't be spied on.
export function reloadPage() {
  window.location.reload();
}

export function assignLocation(url: string) {
  window.location.assign(url);
}
