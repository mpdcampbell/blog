+++
title = "A geoip whitelist for Traefik"
date = "2022-05-22"
description = "tl;dr: Cloudflare proxy has a useful geoip block/allowlist feature to allow only traffic from certain countries to visit your site, but Cloudflare proxy has usage rules. Using [this bash script](https://github.com/mpdcampbell/traefik-geo-ipwhitelist) you can recreate the same functionality in Traefik."
+++

> tl;dr: Cloudflare proxy has a useful geoip block/allowlist feature to allow only traffic from certain countries to visit your site, but Cloudflare proxy has usage rules. Using [this bash script](https://github.com/mpdcampbell/traefik-geo-ipwhitelist) you can recreate the same functionality in Traefik.

## Why

If you use Cloudflare as your [DNS](https://www.cloudflare.com/en-gb/learning/dns/what-is-dns/) provider they offer a built in reverse-proxy for free. As well as hiding your host server IP, this offers lots of security [features](https://developers.cloudflare.com/fundamentals/get-started/concepts/how-cloudflare-works/), some of which you can recreate with your own server-side reverse-proxy. 

One useful feature of the Cloudflare proxy is the country level geolocation IP filter where you can limit access to your site to a few allowed countries. If you don't intend for your site to have a global audience this is a great security addition as it reduces your exposure to attacks. This is particularly useful if, like me, you host [services](https://github.com/mpdcampbell/selfhosted-services) solely for private use by friends and family. 

But the problem is that to minimise bandwidth usage Cloudflare's terms of service don't allow for serving video on their free proxy, see [section 2.8](https://www.cloudflare.com/en-gb/terms/) of TOS. This means you can't use their proxy if, say, you host a private [video conferencing service](https://github.com/mpdcampbell/selfhosted-services#jitsi) for you and your friends weekly board games session.  

---

_A quick Traefik explainer: [Traefik](https://github.com/traefik/traefik#readme) is a reverse-proxy, it sits between your server and incoming traffic and can route incoming HTTP requests to various services running on the server depending on rules you set. Between entry to Traefik and reaching the service you can route the request through middlewares, where the http request is changed or tested against rules of your choice. See [handy diagram](https://doc.traefik.io/traefik/middlewares/overview/). This blog post won't be useful to you if you don't have Traefik set up already._

---

## How

1. Traefik has a built in middleware called [ipWhiteList](https://doc.traefik.io/traefik/middlewares/http/ipwhitelist/), which will only allow HTTP requests through to the service if they are in a defined list of allowed IPs. 
2. Maxmind maintain a geolocation IP database called [GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data?lang=en), which you can download with a free user account.

To bridge 1 and 2 I wrote a [bash script](https://github.com/mpdcampbell/traefik-geo-ipwhitelist). The script creates a yml file defining a ipWhitelist middleware, downloads the csv version of the GeoLite2 database, extracts IPs which correspond to countries defined in the script, and appends them to the middleware. With this you can automate the adding of thousands of IPs to the whitelist. 

**Performance**  
But how does this brute force approach affect site response times?</br>
 
To test this I ran the script for the 5 countries with the [most IP addresses](https://www.ip2location.com/reports/internet-ip-address-2022-report) to generate a middleware file 283,040 lines long. Then I used [the first](https://www.uptrends.com/tools/website-speed-test) online speed test I found to measure the response time of [codeslikeaduck.com](https://xkcd.com/244/) with the IP filter on and the IP filter off. Remembering to set the domain to "development mode" on Cloudflare to bypass their cache. The result of this very scientific test was that the IP filter doesn't make a measurable difference. The variation between repeat measurements (~ 100ms) was greater than the middleware lag, maybe dependent more on which Cloudflare proxy server responded, or my local server response.

**Run on schedule**  
The script also saves the date of last database download in a text file and for subsequent runs will only re-download the database if it has been updated since this date. This allows you to set up the script as a cron job to regularly check for updates and to keep your IP list as up to date as desired. Though the GeoLite2 database is only updated weekly, [every Tuesday](https://support.maxmind.com/hc/en-us/articles/4408216129947-Download-and-Update-Databases), so ideally you would schedule around that.   
