+++
title = "A quick and dirty CSP for your website"
date = "2022-04-27"
description = "tl;dr: CSP is a HTTP header that makes your website more secure by only allowing resources to be loaded from specific sources. The Mozilla Laboratory browser extension for [Firefox](https://addons.mozilla.org/en-US/firefox/addon/laboratory-by-mozilla) or [Chrome](https://chrome.google.com/webstore/detail/laboratory/mjcamldajgnpgjcpacomkgfhccnibldg) makes it easy to setup a decent CSP."
+++

> tl;dr: CSP is a HTTP header that makes your website more secure by only allowing resources to be loaded from specific sources. The Mozilla Laboratory browser extension for [Firefox](https://addons.mozilla.org/en-US/firefox/addon/laboratory-by-mozilla) or [Chrome](https://chrome.google.com/webstore/detail/laboratory/mjcamldajgnpgjcpacomkgfhccnibldg) makes it easy to setup a decent CSP. 

- For a full technical description of what a content security policy (CSP) is checkout the [Mozilla Dev docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP).
- For a quick qualitative description checkout this [short summary](https://www.digitalocean.com/community/tutorials/what-is-a-content-security-policy) by Digital Ocean.

## The CSP Problem

CSPs can seem overly complex on first glance as they allow granular control over many different resource types (images, frames, fonts, scripts, workers e.t.c) and for each you can set an allowed source group (self, none), or from specific domains / domain paths. And they even support using cryptographic nonces and hashes to securely signify specific scripts which can be loaded. So it can quickly snowball, especially for more complex websites if you wanted complete control with every individual resource loading from only sources defined in the CSP. But we aren't aiming for perfect here, that's time-consuming, we are aiming for pretty good. 

---

_Some CSP is better than no CSP... as long as it doesn't break anything_

---

That caveat is a big one. If you restrict a resource type (say fonts) to self, it is easy to forget on that one article you imported a nice monospaced web font from Google Fonts. Now the font won't load and your [fixed width joke](https://xkcd.com/276/) is ruined. Fonts are minor example but with the many resource types you can subtly or utterly break your website in many different ways. 

To avoid this the recommended approach is to set a strict CSP in [report-only](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#testing_your_policy) mode, then when a rule is broken it won't block the resource loading but it will send a violation report to the report-uri you define. This means you need to set up somewhere on your server to receive reports, or use the [external](https://report-uri.com/) report-uri service. And after that now you have [violation reports](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#sample_violation_report) you need to interpret. This is all too involved.

## The Solution
The quick solution is the Laboratory browser extension for [Firefox](https://addons.mozilla.org/en-US/firefox/addon/laboratory-by-mozilla/) and [Chrome](https://chrome.google.com/webstore/detail/laboratory/mjcamldajgnpgjcpacomkgfhccnibldg) from Mozilla, specifically created by [April King](https://github.com/april/laboratory).

Click record, browse around your site and the extension generates a complete CSP header. You can then click enforce to test the generated policy in your browser and see what, if anything, has broken. Record, enforce, tweak, repeat to achieve your desired level of CSP precision.

I've described the Laboratory extension as a quick way to get a "pretty good" CSP, and that's because with very little effort that's exactly what you can get. But that is underselling it somewhat as it is a very powerful tool that can be used to identify where resources load from and, with some user input, generate precise and exhaustive CSP headers.

As a demo I visited www.usps.com, hit record and browsed for 30 seconds, clicking everything in sight. The extension generated the following CSP. We can see using the laboratory browser extension they could quickly generate a CSP and thanks to 'unsafe-inline' they still keep all their in-line tracking scripts. (Which does indeed seem to be how they are [utilising CSP](https://observatory.mozilla.org/analyze/www.usps.com))

{{< code language="Headers" title="Generated CSP for www.usps.com" expand="Show" collapse="Hide" isCollapsed="false" >}}
default-src 'none';
connect-src https://bat.bing.com/actionp/0 https://ct.pinterest.com/user/ https://tr.snapchat.com/collector/is_enabled https://tr.snapchat.com/init https://www.facebook.com/tr/;
font-src 'self';
form-action https://tr.snapchat.com;
frame-src https://3976941.fls.doubleclick.net https://bid.g.doubleclick.net https://tr.snapchat.com;
img-src 'self' https://alb.reddit.com https://analytics.twitter.com https://bat.bing.com https://ct.pinterest.com https://r.turn.com https://t.co https://trkn.us https://www.facebook.com https://www.google.com;
script-src 'self' 'unsafe-eval' 'unsafe-inline' https://bat.bing.com/bat.js https://bat.bing.com/p/action/21006064.js https://connect.facebook.net/en_US/fbevents.js https://connect.facebook.net/signals/config/533374513433337 https://dap.digitalgov.gov/Universal-Federated-Analytics-Min.js https://fast.fonts.net/t/trackingCode.js https://googleads.g.doubleclick.net/pagead/viewthroughconversion/978081151/ https://resources.digital-cloud-gov.medallia.com/wdcgov/2/onsite/embed.js https://resources.digital-cloud-gov.medallia.com/wdcgov/2/onsite/generic1650488365319.js https://s.pinimg.com/ct/core.js https://s.pinimg.com/ct/lib/main.32155010.js https://sc-static.net/scevent.min.js https://static.ads-twitter.com/uwt.js https://www.google-analytics.com/analytics.js https://www.google.com/pagead/conversion_async.js https://www.googleoptimize.com/optimize.js https://www.googletagmanager.com/gtag/js https://www.googletagmanager.com/gtm.js https://www.redditstatic.com/ads/pixel.js;
style-src 'self' 'unsafe-inline' https://fast.fonts.net/t/
{{< /code >}}