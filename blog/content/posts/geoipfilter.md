+++
title = "A GeoIP allow/blocklist for Traefik"
date = "2023-08-18"
description = "tl;dr: If you use Traefik, this [Docker container](https://github.com/mpdcampbell/traefik-geoip-filter) lets you set a location based block or allowlist in front of your online services. It works on a country, state, or town level, and automatically updates its IP database."
+++

> tl;dr: If you use Traefik, this [Docker container](https://github.com/mpdcampbell/traefik-geoip-filter) lets you set a location based block or allowlist in front of your online services. It works on a country, state, or town level, and automatically updates its IP database. 

## Contents
- [Why use a GeoIP filter?](#why-use-a-geoip-filter)
  - [Cloudflare offers this already, but with conditions](#cloudflare-offers-this-already-but-with-conditions)
- [How does it work?](#how-does-it-work)
  - [Short Version](#short-version)
  - [Long Version](#long-version)
- [How do I use it?](#how-do-i-use-it)
- [Does it impact performance?](#does-it-impact-performance)
---

### Why use a GeoIP filter?
The basic idea is that the less of the Web that can access your site/online service, the less of it can attack you.

That sounds paranoid but there really is an endless stream of bots out there prodding every URL and IP for something exploitable. According to this [2022 report](https://www.imperva.com/resources/resource-library/reports/bad-bot-report/) (enter an example.com email to download), bad bots account for [~28%](https://xkcd.com/632/) of all traffic. And if your website is as [popular](https://umami.codeslikeaduck.com/share/Ljt3LRkD/codeslikeaduck) as this blog, then a lot more bots are visiting than humans.

Really, if you don't intend for your website to have a global audience then it shouldn't be globally available.

#### Cloudflare offers this already, but with conditions
[Long-time readers](https://xkcd.com/1158/) will know I use Cloudflare as a [DNS](https://www.cloudflare.com/en-gb/learning/dns/what-is-dns/) provider, and they offer a built-in reverse-proxy for free, complete with a country level GeoIP filter.

But I actually only use them for some services. The problem is that to minimise bandwidth usage, Cloudflare's terms of service don't allow for serving video (or a large number of images) via their free tier proxy, see this [update to their TOS](https://blog.cloudflare.com/updated-tos/). This means you can't use their proxy if, say, you host a private [video chat service](https://www.codeslikeaduck.com/posts/jitsiwithtraefik/) for your weekly D&D sessions, or if you host your own [pet cam stream](https://www.codeslikeaduck.com/posts/go2rtcpetcam/) for checking on the dog, or even if you host a [file server](https://www.codeslikeaduck.com/posts/sharryfilerebuilder/) for wedding guests to upload their photos.

### How does it work?
The container is basically a bash script on top of a lightweight Nginx web server image. The script bridges the gap between the three points below:

1. Traefik has a built-in middleware called [ForwardAuth](https://doc.traefik.io/traefik/middlewares/http/forwardauth/), which will route all requests through an external authentication server.
2. Nginx can be configured to check incoming traffic against a preset list of IPs.
3. MaxMind maintain a database of geolocation IPs called [GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data), which you can download with a free user account.

#### Short version
The script downloads, formats and saves local copies of the GeoLite2 databases. It then writes an IPlist.conf file, extracts IPs that correspond to defined locations, and appends them to the file. Finally, it writes a new default.conf, setting Nginx to check the originating IP of all incoming requests against the list and return a 2XX or 4XX status code as appropriate. Then, if you apply a forwardAuth middleware to a service router in Traefik, HTTP requests will only be passed on to the service if they are/aren't in the allowlist/blocklist. Also, a cron job updates the IPlist.conf when the GeoLite2 database updates.

#### Long version
The script first checks what country or sublocation variables have been defined. These can be defined either by [ISO 3166-1](https://en.wikipedia.org/wiki/SO_3166-1_alpha-2#Officially_assigned_code_elements) country codes, [ISO 3166-2](https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes) subdivision codes, or by place names. For place names, to avoid false positives there is a [larger-region:location](https://github.com/mpdcampbell/traefik-geoip-filter#sub_codes) syntax available. MaxMind maintains separate GeoIP databases for countries and locations smaller than countries (which they call their City database even though it includes states, towns, counties…) and the script only downloads both databases if it needs to.

If local copies of the required databases don’t exist, the script downloads the databases in CSV format, reformats the files to allow for the larger-region:location syntax, and saves them locally as text files. While downloading it also saves the [Last-Modified header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified) value as a local file. If the local GeoIP list files do exist, and aren't empty, then it checks the remote database Last-Modified header and compares it to the locally saved value. Only if the local GeoIP list files are missing/empty, or the remote MaxMind database has been updated since the last download, will it download a new copy.

With up-to-date databases confirmed, the script searches through the local database files for the country or sublocations passed in as environment variables, extracts the matching IPs, and writes them to an Nginx configuration file (IPlist.conf). This file uses the [ngx_http_geo_module](https://nginx.org/en/docs/http/ngx_http_geo_module.html) built into Nginx by default, wherein the module checks the client address against a list of IP addresses and on finding a match will return the value defined beside that address in the configuration file. If no match is found it returns the defined default value. Specifically, the script checks the [X_Forwarded_For](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For) header value against the IP list. The return value for all IPs matches is set to 1, and the default (no match) value to 0, so effectively the configuration file acts as a boolean "isIPInList" function.

Next, the script writes the main Nginx configuration file (default.conf), so that all incoming requests are checked against the boolean $inIPList function if true/false returns either a 200 or 404 status code as appropriate depending on whether the container was set to allowlist or blocklist.

At this point the container is a working GeoIP authentication server. Within Traefik a forwardAuth middleware can be defined which points at the container, and is then added to any service [router](https://doc.traefik.io/traefik/routing/routers/). Then any HTTP requests that Traefik would typically route to the service, will first be passed to GeoIP authentication server. If the authentication server returns a 2XX status code, Traefik will pass the HTTP request on to the service but for any other status code (e.g. 404) the HTTP request ends there and the server response is returned to the user.

Also, there is the self updating. By default, the container adds a cron job to re-run the bash script at 6 AM UTC on Wednesdays and Saturdays. This is because the MaxMind Geolite 2 country and city databases [update](https://support.maxmind.com/hc/en-us/articles/4408216129947) every Tuesday and Friday. The cron expression, and timezone, can be set as environment variables.

### How do I use it?
I recommend visiting the [GitHub page](https://github.com/mpdcampbell/traefik-geoip-filter) to see details on all available environment variables, both mandatory and optional, along with an explanation of how to use the _larger-region_:_location_ syntax to define locations. But for a quick start:  

1. Make a free [MaxMind account](https://www.maxmind.com/en/geolite2/signup) to get a licence key.  
2. Download [docker-compose.example.yml](https://github.com/mpdcampbell/traefik-geoip-filter/blob/main/docker-compose.example.yml) and add the lines to your Traefik config as instructed.  
3. Replace the dummy key in the example.  
4. Replace the location variables: countries go in COUNTRY_CODES, locations smaller than countries go in SUB_CODES.  
5. Start up the container with the below command
{{< code language="docker" title="Run example docker-compose" expand="Show" collapse="Hide" isCollapsed="false" >}}
docker-compose -f docker-compose.example.yml up -d
{{< /code >}}
6. Run the below command to check the container logs and confirm it's working.  
{{< code language="docker" title="Check container logs" expand="Show" collapse="Hide" isCollapsed="false" >}}
docker logs -tf geoipfilter
{{< /code >}}

## Does it impact performance?
Not that I've noticed.

But to try and be more scientific about it, I used the [Lighthouse](https://developer.chrome.com/docs/lighthouse/) performance measurement, which is built into Google Chrome. Testing codeslikeaduck.com both with and without geoipfilter applied, there was no measured difference. If you want to test this yourself make sure to add the US to your allowed locations as otherwise you'll block the Lighthouse servers doing the measuring.

To try and corroborate this I compared the Traefik access logs for hard refreshes of the codeslikeaduck.com homepage. The key part of the logs below is the millisecond value at the end of each line, this is the [request duration](https://doc.traefik.io/traefik/observability/access-logs/#filtering). And as you can see below, there is no significant delay created by the middleware.

{{< code language="log" title="With geoipfilter" expand="Show" collapse="Hide" isCollapsed="false" >}}
#Hard refresh
"GET / HTTP/2.0" 200 8374 "-" "-" 645 "blog-rtr@docker" "-" 1ms
#Hard refresh
"GET / HTTP/2.0" 200 8374 "-" "-" 647 "blog-rtr@docker" "-" 0ms
#Hard refresh
"GET / HTTP/2.0" 200 8374 "-" "-" 657 "blog-rtr@docker" "-" 1ms
{{< /code >}}

{{< code language="log" title="Without geoipfilter" expand="Show" collapse="Hide" isCollapsed="false" >}}
#Hard refresh
"GET / HTTP/2.0" 200 8374 "-" "-" 716 "blog-rtr@docker" "-" 0ms
#Hard refresh
"GET / HTTP/2.0" 200 8374 "-" "-" 721 "blog-rtr@docker" "-" 0ms
#Hard refresh
"GET / HTTP/2.0" 200 8374 "-" "-" 735 "blog-rtr@docker" "-" 1ms
{{< /code >}}