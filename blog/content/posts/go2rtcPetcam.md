+++
title = "Use go2rtc for a self-hosted pet cam"
date = "2023-02-15"
keywords = "petcam go2rtc traefik docker camera"
description = "tl;dr: The popular self-host CCTV solutions are bloated with features you don't need just to securely watch your dog. This post argues you should use [go2rtc](https://github.com/AlexxIT/go2rtc) instead, and explains how to set up a live feed of your pet cam."
+++

> tl;dr: The popular self-host CCTV solutions are bloated with features you don't need just to securely watch your dog. This post argues you should use [go2rtc](https://github.com/AlexxIT/go2rtc) instead, and explains how to set up a live feed of your pet cam.

## Contents
- [Why use go2rtc?](#why-use-go2rtc)
- [Do I need a specific camera?](#do-i-need-a-specific-camera)
- [Plan your security first](#plan-your-security-first)
- [How to set up go2rtc](#how-to-set-up-go2rtc)
  - [Wait, where is the video feed?](#wait-where-is-the-video-feed)
- [Use reverse proxy to set homepage to the camera feed](#use-reverse-proxy-to-set-homepage-to-the-camera-feed)
  - [But now how do I access the menu?](#but-now-how-do-i-access-the-menu)
---

### Why use go2rtc?
If you ask online about software for self-hosting your own security cameras, you will see the same popular services suggested:
 - [Zoneminder](https://github.com/ZoneMinder/zoneminder) (Old faithful, FOSS)
 - [Frigate](https://github.com/blakeblackshear/frigate) (Newer and shinier, FOSS)
 - Blue Iris (Paid and closed source)
 - [Shinobi](https://gitlab.com/Shinobi-Systems/Shinobi) (Open Source but mobile app behind [paid licence](https://shinobi.video/pro))  

And if you are looking to set up a full fat CCTV system these are excellent options, ready to support a large array of cameras with features like object recognition, motion detection, automated recording, push notification alerts, and so on. 

But what if all you want is to view your cameras remotely, no fancy features, no [superfluous app](https://xkcd.com/1367), just a simple link to your video feeds. That's what go2rtc offers. 

You might say you can just ignore the extra features, which isn't wrong, but I say why use the wrong tool for the job? This strikes me as similar to people who host an entire [Nextcloud](https://github.com/nextcloud) instance when all they need is a basic web UI in front of their files (something like [Filestash](https://github.com/mickael-kerjean/filestash) or [Filebrowser](https://github.com/filebrowser/filebrowser)).

### Do I need a specific camera?
Nope, get anything that has RTSP stream functionality, which is most IP cameras these days. You can ignore all the smart app features, obviously you aren't going to be using those. With the possible exception of two way audio, go2rtc does [support this](https://github.com/AlexxIT/go2rtc#two-way-audio) but my cameras don't so I haven't tried to get it working. Also, I recommend setting up your home network to block the actual camera from the internet, your local network server can grab the video feed and relay that to go2rtc. The camera doesn't need to phone home. 

### Plan your security first
You are planning to expose a camera feed to the internet. I'm assuming if you are conscientious enough to self host then you also don't like the idea of strangers viewing the feed. All of the above camera services have username and password login screens built in, **please** do not assume you can just open a port on the router and this login screen alone will make your camera is secure. In my (only slightly paranoid) opinion anything private hosted online needs two things, a reverse proxy and a two-factor authentication. You probably know what [Two-factor authentication](https://blog.mozilla.org/en/products/firefox/firefox-tips/what-is-2fa/) is already. A [reverse proxy](https://www.howtogeek.com/devops/what-is-a-reverse-proxy-and-how-does-it-work/) acts as layer between the internet and your services and allows you to implement security features such as rate limiting, enforcing https, or blocking users [based on location](https://www.codeslikeaduck.com/posts/geoipwhitelistdocker/). 

---

_Anything private hosted online needs two things, a reverse proxy and 2FA._

---

Setting up a reverse proxy and two-factor authentication takes longer than setting up go2rtc, so it is not going to be explained in this blog post. If you haven't already got these features implemented I recommend researching these first. For [my set up](https://github.com/mpdcampbell/selfhosted-services) I use [Authelia](https://github.com/authelia/authelia#) for 2FA and [Traefik](https://github.com/traefik/traefik) as my reverse proxy. Any reverse proxy specific configuration shown in this blog post will be for Traefik, but popular alternatives  are [Nginx](https://nginx.org/en/) and [Caddy](https://github.com/caddyserver/caddy), and alternative 2FA services are [Authentik](https://github.com/goauthentik/authentik) and [Keycloak](https://github.com/keycloak/keycloak).

### How to set up go2rtc
You need two config files to get go2rtc going, the docker-compose.yml to install the service and a go2rtc.yaml file to set the settings.

{{< code language="yaml" title="Basic go2rtc docker-compose.yml" expand="Show" collapse="Hide" isCollapsed="false" >}}
services:
  go2rtc:
    image: alexxit/go2rtc:latest
    container_name: go2rtc
    restart: unless-stopped
    volumes:
      - ${GO2RTC_DIR}:/config
    environment:
      - GO2RTC_PORT=${GO2RTC_PORT}
      - BASE_PATH=${BASE_PATH}
      - TZ=${TZ}
## The below ports section is just for local testing.
## Please don't expose this port on your router.
    ports:
      - 1984:${GO2RTC_PORT}
{{< /code >}}

Above is the docker-compose.yml for a local instance of the go2rtc docker container, I will show an example config with reverse proxy bits included later. There are four variables you need to set/change here:
 - **${GO2RTC_DIR}** is the path of the directory where you want to save the go2rtc.yaml settings file.
 - **${GO2RTC_PORT}** is the port that the go2rtc API will listen out on.
 - **${BASE_PATH}** is the path that the web UI and camera streams will be available on. For example if it is set to /admin the webui is available at domain.com/admin. If this is not set then the default value is empty.
 -  **${TZ}** is just the timezone used for the container logs, e.g Atlantic/Bermuda. Not essential to include but good practice.

The corresponding go2rtc.yaml file is shown below, this needs to be saved in the directory defined by ${GO2RTC_DIR}.

_Editors Note: If you are annoyed that one file is using the .yml file extension and the other is using .yaml, yeah me too. I tried naming the settings file go2rtc.yml and the container wouldn't start up, it looks for the exact go2rtc.yaml filename. I could rename the docker-compose file to .yaml, but two wrongs don't make a right. Also no I don't have an Editor._

{{< code language="yaml" title="go2rtc.yaml" expand="Show" collapse="Hide" isCollapsed="false" >}}
api:
  listen: ":${GO2RTC_PORT}"
  base_path: "${BASE_PATH}"
  origin: "*"

streams:
  petCam1: rtsp://username:password@ipaddress:port
  petCam2: rtsp://username:password@ipaddress:port

## Log setting isn't needed, it defaults to "info" level.
## Handy to have if you need to debug though.
log:
  level: info
{{< /code >}}

There is no need to change the variables in the api section. The ${} syntax just means that, when reading the file, go2rtc will replace the value with the variable we passed in as part of environment in the docker-compose.yml. 

The streams section is where we assign a name to the camera video feeds and tell go2rtc where to find them. In this example I have two RTSP camera feeds listed. Your camera might support multiple ways to access the feed but RTSP is by far the most common. Luckily the RSTP URL to your camera will follow a fixed format:
- **username** is the username to access your camera on the local network (though some cameras allow you to separate RTSP authentication credentials)
- **password** is the password to access your camera on the local network (again, unless you set a separate RTSP password)
- **ipaddress** is the IP address of your camera on the local network, something like 192.168.1.22 Log in to your router to find this, and while you are in there you should give the camera a static IP so it doesn't change.
- **port** is 554 for the vast majority of cameras. But if that doesn't work, Google or Ddg your camera model.

And I have called the camera feeds petCam1 and petCam2, but you can name these whatever you like.

Once you have both the above configuration files finished, you can start up the go2rtc service with the following command. 

{{< code language="bash" title="Start up go2rtc" expand="Show" collapse="Hide" isCollapsed="false" >}}
#If in same directory as the docker-compose.yml file
#The -d flag starts the containers up in the background so they aren't running in the terminal.
docker-compose up -d

#If in a different directory you can use the -f flag to point to docker-compose.yml 
docker-compose -f PATH_TO_FILE/docker-compose.yml up -d
{{< /code >}}

Now if you visit localhost:1984 in your browser, (if you set a ${BASE_PATH} value, e.g. /admin, then you need to visit e.g. localhost:1984/admin), you should see the go2rtc web UI. 

If it isn't working you should inspect the logs of the container for issues. To view a live feed of the logs run the following command:

{{< code language="bash" title="View container logs" expand="Show" collapse="Hide" isCollapsed="false" >}}
docker logs -tf go2rtc
{{< /code >}}


#### Wait, where is the video feed?
Ok so my whole spiel was I promised a straightforward link to your camera feeds, and you've noticed the default go2rtc homepage is a distinctly video-less menu screen.

{{< collapsable-box contentType="Screenshot" title="Go2rtc web UI" expand="Show" collapse="Hide" isCollapsed="false" >}}
<img src="/img/posts/go2rtcPetCam/go2rtcMenu.png" alt="Screenshot of go2rtc menu" loading="lazy"> 
{{< /collapsable-box >}}

If you check the boxes beside your camera feeds and then click on stream, it will open a new page which is just your two video streams playing. This is the simple, mobile friendly page we have been looking for. As shown in the example screenshot below, the feeds automatically scale to the screen and you can tap/click on any video feed to get pause, volume and full screen controls. Note, rather than show my own cameras for the example screenshot I pointed go2rtc at two clips from [Big Buck Bunny](https://peach.blender.org/about/).

The URL for this page doesn't change so you can save this as a shortcut on your computer/phone homescreen and the job is done! You have a one click solution to watch your pet when away.

{{< collapsable-box contentType="Screenshot" title="Go2rtc camera feeds on mobile" expand="Show" collapse="Hide" isCollapsed="false" >}}
<img src="/img/posts/go2rtcPetCam/go2rtcVideoFeeds.png" alt="Screenshot of go2rtc camera feeds on mobile" loading="lazy"> 
{{< /collapsable-box >}}

## Use reverse proxy to set homepage to the camera feed
This step is completely optional, but personally saving the camera feed URL as a shortcut just felt too clunky. If I am hosting my go2rtc instance at dog.example.com, when I visit dog.example.com then I should see the camera feeds. No faffing about. 

To achieve this we can set up a redirect rule in the reverse proxy so that all requests for dog.example.com are automatically redirected to the camera feed URL. My reverse-proxy of choice is Traefik and with it we can use the [redirectRegex middleware](https://doc.traefik.io/traefik/middlewares/http/redirectregex/), but the same thing should be doable with Nginx and the [rewrite directive](https://www.nginx.com/blog/creating-nginx-rewrite-rules/). Isn't jargon great.

Below is my go2rtc docker-compose config with the reverse-proxy added, but before the redirect rule has been added. As stated in the [previous section](https://codeslikeaduck.com/posts/go2rtcpetcam/#plan-your-security-first) I'm not explaining how to set up a reverse proxy in this post, so this is our starting point. 

{{< code language="yaml" title="Example docker-compose.yml with reverse proxy" expand="Show" collapse="Hide" isCollapsed="false">}}      
go2rtc:
  image: alexxit/go2rtc:latest
  container_name: go2rtc
  restart: unless-stopped
  networks:
    - t2_proxy
  volumes:
    - ${GO2RTC_DIR}:/config
  environment:
    - GO2RTC_PORT
    - BASE_PATH
    - TZ
  labels:
    - "traefik.enable=true"
    # HTTP Routers
    - "traefik.http.routers.go2rtc-rtr.entrypoints=https"
    - "traefik.http.routers.go2rtc-rtr.rule=Host(`dog.${DOMAINNAME}`)"
    - "traefik.http.routers.go2rtc-rtr.tls=true"
    - "traefik.http.routers.go2rtc-rtr.tls.options=tls-opts@file"
    # Middlewares
    - "traefik.http.routers.go2rtc-rtr.middlewares=go2rtc-headers,middlewares-geoipfilter,chain-authelia-no-cf@file"
    - "traefik.http.middlewares.go2rtc-headers.headers.accesscontrolalloworiginlist=https://$DOMAINNAME"
    - "traefik.http.middlewares.go2rtc-headers.headers.allowedhosts=dog.${DOMAINNAME}"
    - "traefik.http.middlewares.go2rtc-headers.headers.sslproxyheaders.X-Forwarded-Proto=https"
    - "traefik.http.middlewares.go2rtc-headers.headers.contentsecuritypolicy=connect-src 'self'; img-src 'self'; script-src 'self' 'sha256-vguJTyH8pRrRWqm7V4xeUfY6y4lNPzG+6LanIQnjTRo=' 'sha256-inHgEVI1ARB8dDHDbhxsj0a2Mg1Ql8sTAjkibYTSiPo='; style-src 'self' 'sha256-a6GDV+5IhEoq/O32LdhToUs/GKnoTW3VKArUGQ2Fd4U=' 'sha256-uldmZibwUatiQkAiAM/ca0pbHTDr8yFmF32B4fczSSc=' 'sha256-HI4QLrOPVrXtlV8CcyKIEl2qnA0jat6kyLNN/ZH9BsU=' 'sha256-Pbnf1TaAoyGss9KtHmYulF9kHcYrCyogVN1uelKqGKs='; media-src blob:"
    - "traefik.http.middlewares.go2rtc-headers.headers.permissionsPolicy=ambient-light-sensor 'none'; camera 'none'; geolocation 'none'; microphone 'none'; payment 'none'; usb 'none'; interest-cohort 'none'"
    # HTTP Services
    - "traefik.http.routers.go2rtc-rtr.service=go2rtc-svc"
    - "traefik.http.services.go2rtc-svc.loadbalancer.server.port=${GO2RTC_PORT}"
{{< /code >}}

If you haven't seen a Traefik configuration before it looks complicated, but its not bad once the main points are explained. If you are used to Traefik syntax, skip the next paragraph. 

Apart from adding the Traefik network *t2_proxy*, all of the Traefik configuration is added under *labels*. The *#Http Routers* section defines a router called *go2rtc-rtr*, its start point, and some of its properties. The *#Http Services* section defines what service and port on that service the router is pointed at, basically where it ends. In the middle is the *#Middlewares* section. These are a set of filters or rules that tweak and change the HTTP request between it entering the router and reaching the service. In my example some middlewares, like *middlewares-geoipfilter*, are defined elsewhere whereas the the group of middlewares called *go2rtc-headers* are defined directly below where they are called.

So to set up the redirect rule we just need to define a redirectRegex middleware and add it to our go2rtc router. The redirectRegex middleware can be defined as follows.

{{< code language="yaml" title="RedirectRegex middleware" expand="Show" collapse="Hide" isCollapsed="false">}}
  # Regex redirect
  - "traefik.http.middlewares.go2rtc-stream-redirect.redirectregex.regex=^https?://dog.${DOMAINNAME}/$$"
  - "traefik.http.middlewares.go2rtc-stream-redirect.redirectregex.replacement=https://dog.${DOMAINNAME}${BASE_PATH}/stream.html?src=${CAM_1}&src=${CAM_2}&mode=${STREAM_MODE}"
  - "traefik.http.middlewares.go2rtc-stream-redirect.redirectregex.permanent=true"
{{< /code >}}

The first line defines the regex pattern we want to replace if seen by the middleware, so in my case my homepage is dog.domain.com. Here I pass in domain.com via the bash variable ${DOMAINNAME} but you could write it in directly if you like. The second line is where we define what we want to replace the pattern with. Here you could just directly type in your camera feed URL, but I have gone for a more generic example using variables.
- **${BASE_PATH}** is the base path variable defined previously in the go2rtc.yaml.
- **${CAM_1}** is the name of the first camera feed, i.e. petCam1 in our case.
- **${CAM_2}** is the name of the second camera feed, i.e. petCam2 in our case.
- **${STREAM_MODE}** is the type of video feed, webrtc, mse, mp4 or mjpeg.

And the third line is just defining that the HTTP redirect should permanently apply.

Now the middleware is defined we need to add it to our go2rtc router. In our example the middleware is called *go2rtc-stream-redirect* and the router is called *go2rtc-rtr*  so we can add the middleware to the router with the following line.

{{< code language="yaml" title="Adding redirect middleware to router" expand="Show" collapse="Hide" isCollapsed="false">}}
  - "traefik.http.routers.go2rtc-rtr.middlewares=go2rtc-stream-redirect"
{{< /code >}}

Adding this back into the example go2rtc docker-compose file we get the following.

{{< code language="yaml" title="Example docker-compose.yml with homepage to camera feed redirect" expand="Show" collapse="Hide" isCollapsed="false">}}      
go2rtc:
  image: alexxit/go2rtc:latest
  container_name: go2rtc
  restart: unless-stopped
  networks:
    - t2_proxy
  volumes:
    - ${GO2RTC_DIR}:/config
  environment:
    - GO2RTC_PORT
    - BASE_PATH
    - TZ
  labels:
    - "traefik.enable=true"
    # HTTP Routers
    - "traefik.http.routers.go2rtc-rtr.entrypoints=https"
    - "traefik.http.routers.go2rtc-rtr.rule=Host(`dog.${DOMAINNAME}`)"
    - "traefik.http.routers.go2rtc-rtr.tls=true"
    - "traefik.http.routers.go2rtc-rtr.tls.options=tls-opts@file"
    # Regex redirect
    - "traefik.http.middlewares.go2rtc-stream-redirect.redirectregex.regex=^https?://dog.${DOMAINNAME}/$$"
    - "traefik.http.middlewares.go2rtc-stream-redirect.redirectregex.replacement=https://dog.${DOMAINNAME}${BASE_PATH}/stream.html?src=${CAM_1}&src=${CAM_2}&mode=${STREAM_MODE}"
    - "traefik.http.middlewares.go2rtc-stream-redirect.redirectregex.permanent=true"
    # Middlewares
    - "traefik.http.routers.go2rtc-rtr.middlewares=go2rtc-headers,middlewares-geoipfilter,chain-authelia-no-cf@file,go2rtc-stream-redirect"
    - "traefik.http.middlewares.go2rtc-headers.headers.accesscontrolalloworiginlist=https://$DOMAINNAME"
    - "traefik.http.middlewares.go2rtc-headers.headers.allowedhosts=dog.${DOMAINNAME}"
    - "traefik.http.middlewares.go2rtc-headers.headers.sslproxyheaders.X-Forwarded-Proto=https"
    - "traefik.http.middlewares.go2rtc-headers.headers.contentsecuritypolicy=connect-src 'self'; img-src 'self'; script-src 'self' 'sha256-vguJTyH8pRrRWqm7V4xeUfY6y4lNPzG+6LanIQnjTRo=' 'sha256-inHgEVI1ARB8dDHDbhxsj0a2Mg1Ql8sTAjkibYTSiPo='; style-src 'self' 'sha256-a6GDV+5IhEoq/O32LdhToUs/GKnoTW3VKArUGQ2Fd4U=' 'sha256-uldmZibwUatiQkAiAM/ca0pbHTDr8yFmF32B4fczSSc=' 'sha256-HI4QLrOPVrXtlV8CcyKIEl2qnA0jat6kyLNN/ZH9BsU=' 'sha256-Pbnf1TaAoyGss9KtHmYulF9kHcYrCyogVN1uelKqGKs='; media-src blob:"
    - "traefik.http.middlewares.go2rtc-headers.headers.permissionsPolicy=ambient-light-sensor 'none'; camera 'none'; geolocation 'none'; microphone 'none'; payment 'none'; usb 'none'; interest-cohort 'none'"
    # HTTP Services
    - "traefik.http.routers.go2rtc-rtr.service=go2rtc-svc"
    - "traefik.http.services.go2rtc-svc.loadbalancer.server.port=${GO2RTC_PORT}"
{{< /code >}}

#### But now how do I access the menu?

After your "homepage-to-camera-feed-redirect" has been set up, visiting dog.domain.com obviously wont bring you to the go2rtc web UI anymore. But, if you inspect the redirectRegex pattern, the redirect only applies to HTTP requests that end immediately after the domain, i.e. with no path. A request with a path after the domain wont match the regex and wont get redirect to the camera feed URL. This is where the BASE_PATH variable becomes useful. If you entered a value for BASE_PATH, e.g. /admin, now if you visit dog.domain.com/admin you will be brought to the go2rtc web UI while requests for dog.domain.com will still be redirected to the camera feed URL.