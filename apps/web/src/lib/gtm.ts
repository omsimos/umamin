// Client-safe GTM loader snippet. The apps/www version also exported a
// node:crypto CSP-hash helper; that stays server-side (CSP is emitted by the
// Hono security-headers middleware), so this port keeps only the inline script.
export function getGtmInlineScript(gtmId: string) {
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':Date.now(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!=='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
}
