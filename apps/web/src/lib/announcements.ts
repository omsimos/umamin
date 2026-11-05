// Dismissible announcements render in the server HTML and are hidden by CSS
// (styles.css) when <html data-dismissed> lists their id. A pre-paint script
// sets that attribute from localStorage before first paint, so a dismissed card
// never flashes and an undismissed one never pops in after hydration and
// pushes the page down.

// The storage keys predate this module; changing one resurfaces the card for
// everyone who dismissed it.
export const ANNOUNCEMENT_KEYS = {
  chat: "umamin:chat-announcement-dismissed",
  "chats-tab": "umamin:chats-tab-promo-dismissed",
  uma: "umamin:uma-announcement-dismissed",
} as const;

export type AnnouncementId = keyof typeof ANNOUNCEMENT_KEYS;

export const DISMISSED_ATTRIBUTE = "data-dismissed";

// Storage that throws leaves the attribute unset, so every card shows.
export const ANNOUNCEMENTS_PREPAINT_SCRIPT = `(function(){try{var k=${JSON.stringify(ANNOUNCEMENT_KEYS)},d=[];for(var i in k){if(localStorage.getItem(k[i]))d.push(i)}if(d.length)document.documentElement.setAttribute('${DISMISSED_ATTRIBUTE}',d.join(' '))}catch(e){}})();`;

export function dismissAnnouncement(id: AnnouncementId) {
  const root = document.documentElement;
  const ids = new Set(
    (root.getAttribute(DISMISSED_ATTRIBUTE) ?? "").split(" ").filter(Boolean),
  );
  ids.add(id);
  root.setAttribute(DISMISSED_ATTRIBUTE, [...ids].join(" "));

  try {
    localStorage.setItem(ANNOUNCEMENT_KEYS[id], "1");
  } catch {
    // Storage unavailable: the attribute keeps it hidden for this visit only.
  }
}
