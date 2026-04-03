export function getDesktopApi() {
  return window.kmDesktop || null;
}

export function getLegacyWorkspaceUrl(tabId = "dashboard") {
  const current = new URL(window.location.href);
  const legacyPath = `legacy.html#tab=${encodeURIComponent(tabId)}`;

  if (/^https?:$/.test(current.protocol)) {
    return new URL(`/${legacyPath}`, current).toString();
  }

  return new URL(`../${legacyPath}`, current).toString();
}
