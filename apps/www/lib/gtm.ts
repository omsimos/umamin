import { createHash } from "node:crypto";

export function getGtmInlineScript(gtmId: string) {
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':Date.now(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!=='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
}

export function getGtmInlineHash(gtmId: string) {
  return createHash("sha256")
    .update(getGtmInlineScript(gtmId))
    .digest("base64");
}
