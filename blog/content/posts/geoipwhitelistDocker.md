+++
title = "An improved GeoIP allowlist for Traefik"
date = "2023-05-12"
description = "tl;dr: If you use Traefik, this [Docker container](https://github.com/mpdcampbell/traefik-geo-ipwhitelist) lets you restrict access to your online services on a country, state, or town level. It maintains an [IPWhitelist middleware](https://doc.traefik.io/traefik/middlewares/http/ipwhitelist/) with a list of IPs matching the allowed locations."
+++

## _This solution has been obsoleted by a new container, [traefik-geoip-filter](https://github.com/mpdcampbell/traefik-geoip-filter), which can act as either blocklist or allowlist. Please see the [up-to-date article](https://www.codeslikeaduck.com/posts/geoipfilter/)._
----

> tl;dr: If you use Traefik, this [Docker container](https://github.com/mpdcampbell/traefik-geo-ipwhitelist) lets you restrict access to your online services on a country, state, or town level. It maintains an [IPWhitelist middleware](https://doc.traefik.io/traefik/middlewares/http/ipwhitelist/) with a list of IPs matching the allowed locations.

## Contents
- [Improved from what?](#improved-from-what)
- [What features?](#what-features)
- [Why use a GeoIP allowlist?](#why-use-a-geoip-allowlist)
- [How does it work?](#how-does-it-work)
- [How do I use it?](#how-do-i-use-it)
- [Does it impact performance?](#does-it-impact-performance)
---

## Improved from what?
This project used to be a [bash script](https://www.codeslikeaduck.com/posts/geoipwhitelistscript/) with only country level filtering, some dependencies, and which used the system crontab. Now it's a Docker container with more features, all the dependencies bundled in, and uses its own crontab. Much neater.

## What features?
- Supports defining locations by [ISO-3166-1](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements) and [ISO 3166-2](https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes) codes.
- Supports defining locations by name in the format _larger-region_:_location_  
e.g. New-Zealand:Wellington 
- Automatically keeps the GeoIP list up to date.
- Isn't a plugin. 

## Why use a GeoIP allowlist?

This is a niche article on a hobby blog, so the odds are you already know why. But on the off chance this section header struck SEO gold; the basic idea is that the less of the World Wide Web can access your site/online service,"the then the less of it can attack you. 

That sounds paranoid, but there really is an endless stream of bots out there prodding every URL and IP for something exploitable. According to this [2022 report](https://www.imperva.com/resources/resource-library/reports/bad-bot-report/) (enter an example.com email to download), bad bots account for [~28%](https://xkcd.com/632/) of all traffic. And if your website is as [popular](https://umami.codeslikeaduck.com/share/Ljt3LRkD/codeslikeaduck) as this blog, then a lot more bots are visiting than humans. 

Really, if you don't intend for your website or online service to have a global user base then it shouldn't be globally available.

## How does it work?

The [container](https://github.com/mpdcampbell/traefik-geo-ipwhitelist/blob/main/Dockerfile) is mainly a single [bash script](https://github.com/mpdcampbell/traefik-geo-ipwhitelist/blob/main/geo-ipwhitelist.sh) running on a lightweight Alpine Linux image. The script bridges the gap between the two points below:

1. Traefik has a built-in middleware called [IPWhiteList](https://doc.traefik.io/traefik/middlewares/http/ipwhitelist/), which will only allow HTTP requests through to the service if they are listed in a middleware file of allowed IPs. 
2. MaxMind maintains a database of geolocation IPs called [GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data), which you can download with a free user account.

**Short version**  
The script creates a yml file defining the IPWhitelist middleware, downloads and saves a local copy of the GeoLite2 database, extracts IPs which correspond to locations, and appends them to the middleware file. Then, if you apply the IPWhitelist middleware to a service router in Traefik, HTTP requests will only be passed to the service if they originate from an IP in the allowed list. Also, a cron job keeps the allowed IP list up to date.

**Long version**  
The script first checks what country or sublocation variables have been defined. MaxMind maintains separate GeoIP databases for countries and locations smaller than countries (which they call their City database even though it includes states, towns, counties...) and the script only downloads both databases if it needs to. 

If local copies of the required databases don't exist, the script downloads the databases in CSV format, reformats the files to allow for _larger-region_:_location_ search [syntax](https://github.com/mpdcampbell/traefik-geo-ipwhitelist/tree/main#sub_codes), and saves them locally as text files. While downloading it also saves the [Last-Modified](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified) header value as a local file. If the local GeoIP files do exist then it checks the remote database Last-Modified header and compares to the locally saved value. Only if the remote MaxMind database has been updated since last download will it download a new copy.

With up-to-date databases confirmed, the script searches through the local database files for the country or sublocations passed in as environment variables, extracts the matching IPs, and writes them to a IPWhiteList middleware file for Traefik: specifically a yml file. This file is written down to the Traefik [file provider directory](https://doc.traefik.io/traefik/providers/file/), which is on the local filesystem, outside the container. With Traefik [configured](https://doc.traefik.io/traefik/providers/file/#configuration-examples) to read in middlewares from file providers, the middleware can then be added to any service router to restrict access to that service to only IPs from the listed locations.

By default, the container adds a cron job to re-run the script at 6 AM UTC on Wednesdays and Saturdays. This is because the MaxMind Geolite 2 country and city databases [update](https://support.maxmind.com/hc/en-us/articles/4408216129947) every Tuesday and Friday. The cron expression, and timezone, can be set as environment variables. 

## How do I use it?
I recommend visiting the [github page](https://github.com/mpdcampbell/traefik-geo-ipwhitelist) to see details on all available environment variables, both mandatory and optional, along with an explanation of how the _larger-region_:_location_ search syntax matches locations. But for a quick start:  

- Make a free [MaxMind account](https://www.maxmind.com/en/geolite2/signup) to get a licence key.  
- Download [docker-compose.example.yml](https://github.com/mpdcampbell/traefik-geo-ipwhitelist/blob/main/docker-compose.example.yml) and add the lines to your Traefik config as instructed.  
- Replace the example file paths and licence key in the example yml.  
- Replace the location variables: countries go in COUNTRY_CODES, locations smaller than countries go in SUB_CODES.  
- Start up the container with the below command
{{< code language="docker" title="Run example docker-compose" expand="Show" collapse="Hide" isCollapsed="false" >}}
docker-compose -f docker-compose.example.yml up -d
{{< /code >}}
- Run the below command to check the container logs and confirm its working.  
{{< code language="docker" title="Check container logs" expand="Show" collapse="Hide" isCollapsed="false" >}}
docker logs -tf geoipwhitelist
{{< /code >}}

## Does it impact performance?
Not that I've noticed.

But to try and be more scientific about it, I used the [Lighthouse](https://developer.chrome.com/docs/lighthouse/) performance measurement, which is built into Google Chrome. Testing codeslikeaduck.com both with and without the GeoIP allowlist middleware applied, there was no measured difference. If you want to test this yourself make sure to add the US to your allowed locations as otherwise you'll block the Lighthouse servers doing the measuring.

To try and corroborate this, I compared the Traefik access logs for hard refreshes of the codeslikeaduck.com homepage. The key part of the logs below is the millisecond value at the end of each line, this is the [request duration](https://doc.traefik.io/traefik/observability/access-logs/#filtering). And as you can see below, there is no significant delay created by the middleware.

{{< code language="log" title="Without geo-ipwhitelist middleware" expand="Show" collapse="Hide" isCollapsed="false" >}}
#Hard refresh
"GET / HTTP/2.0" 200 8511 "-" "-" 13078 "blog-rtr@docker" "-" 1ms
#Hard refresh
"GET / HTTP/2.0" 200 8511 "-" "-" 13081 "blog-rtr@docker" "-" 1ms
#Hard refresh
"GET / HTTP/2.0" 200 8511 "-" "-" 13084 "blog-rtr@docker" "-" 1ms
{{< /code >}}

{{< code language="log" title="With geo-ipwhitelist middleware" expand="Show" collapse="Hide" isCollapsed="false" >}}
#Hard refresh
"GET / HTTP/2.0" 200 8511 "-" "-" 13102 "blog-rtr@docker" "-" 1ms
#Hard refresh
"GET / HTTP/2.0" 200 8511 "-" "-" 13105 "blog-rtr@docker" "-" 1ms
#Hard refresh
"GET / HTTP/2.0" 200 8511 "-" "-" 13108 "blog-rtr@docker" "-" 1ms
{{< /code >}}