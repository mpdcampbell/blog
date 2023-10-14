+++
title = "Set up Jitsi behind Traefik"
date = "2023-07-27"
keywords = "traefik jitsi docker"
description = "tl;dr: [Jitsi](https://jitsi.github.io/handbook/docs/intro) is effectively open source Zoom that you can self-host. This post describes how to get Jitsi working behind Traefik."
+++

> tl;dr: [Jitsi](https://jitsi.github.io/handbook/docs/intro) is effectively open source Zoom that you can self host. This post describes how to get Jitsi working behind Traefik.

## Contents
- [What](#what)  
- [Why](#why)  
- [How](#how)  
- [Fixes to problems you might see](#fixes-to-problems-you-might-see)  
  - [Weird insufficient bandwidth behaviour](#weird-insufficient-bandwidth-behaviour)  
  - [Invalid message ... non-null is null](#invalid-message--non-null-is-null)
- [Customising Jitsi settings](#customising-jitsi-settings)
  - [Disable third party server requests](#disable-third-party-server-requests)
---

## What
[Jitsi](https://jitsi.github.io/handbook/docs/intro) describes itself as video conferencing solution, I'd describe it as open source Zoom. But crucially, as FOSS, Jitsi includes the same features as enterprise Zoom for free. If you don't want to self host (why are you reading this), then you can use their [official instance](https://meet.jit.si/) for free. Unlike Zoom, there are no time limits.

## Why
During the pandemic I hosted Jitsi as a Zoom alternative for the obligatory friend group pub quiz. Recently I hadn't used it for over a year and, after updating to the latest version, I found my instance was broken. Attempting to set Jitsi up again from scratch, I couldn't find a straight forward "just do this" guide that worked with Traefik. There is extensive [official documentation](https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker/) on hosting with Docker in general, including [guidance](https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker/#running-behind-a-reverse-proxy) if you are using Nginx or Apache as a reverse proxy. But unfortunately no lazy copy-paste snippets for Traefik.

There is an [example docker-compose.yml](https://github.com/jitsi-contrib/jitsi-traefik/tree/main/traefik-v2) for Traefik on the third-party contribution repo, but as of writing it's two years old and didn't work when I blindly followed it. Also, among the docker repository issues there is a detailed [step by step guide](https://github.com/jitsi/docker-jitsi-meet/issues/1271#issuecomment-1113991933) from a user on how they got their Jitsi instance working behind Traefik, but unfortunately this didn't work for me either.

_Editor's Note: In hindsight, the jitsi-contrib [example](https://github.com/jitsi-contrib/jitsi-traefik/tree/main/traefik-v2) should work fine, it was just not sufficiently idiotproof for me as it is missing some necessary extra config steps to do with Traefik itself. Confusingly, these extra steps are included in the instructions from the [github issue](https://github.com/jitsi/docker-jitsi-meet/issues/1271#issuecomment-1113991933), and should work, but didn't. I'm not sure why, maybe a mismatch with Traefik versions or the .env.example variables? It is the only file they didn't include copies of._

_Regardless, both example files contain a lot of extraneous lines you don't need just to get Jitsi working, so I think following the below simpler guide is worthwhile for new users._

## How
This guide assumes you are already using Traefik as a reverse proxy and explains how to get Jitsi working behind it. It doesn't explain how to set up Traefik from scratch. Also, this guide is confirmed working with Jitsi build stable-8719 and Traefik version 2.9.1. In theory it should continue to work provided no breaking changes are announced. For Jitsi there is this [brilliant website](https://shawnchin.github.io/jitsi-config-differ/) to compare builds to check for any potential breaking changes in configuration files.

You need the following ports on your router/firewall open and pointed towards the server which is hosting Traefik:
 - **80/TCP** the default port for HTTP traffic, (your Traefik instance should already be set up to [redirect HTTP requests](https://doc.traefik.io/traefik/middlewares/http/redirectscheme/))
 - **443/TCP** the default port for HTTPS traffic.
 - **10000/UDP** a Jitsi specific port, used by the [JVB container](https://jitsi.github.io/handbook/docs/architecture) to route video to and from users. It must be configured using the UDP protocol.

Your Traefik instance should ready have named entrypoints set up for ports 80 and 443 (named 'http' and 'https' in this example). Now you need to define another entrypoint for port 10000, and specify that it is for UDP traffic. Entrypoints can be defined in [multiple ways](https://v2.doc.traefik.io/traefik/routing/entrypoints/), but the example shown below applies if you define entrypoints in a yaml file provider. Here the 10000/udp entrypoint has been named 'video'.

{{< code language="yaml" title="Define JVB entrypoint in Traefik" expand="Show" collapse="Hide" isCollapsed="false" >}}
entryPoints:
  video:
    address: ":10000/udp"
{{< /code >}}

You also need to open the 10000/udp port on Traefik container to the host, so incoming requests to 10000/udp on the server are able to pass into the Traefik container. Again there are multiple ways this could be done, just add the 10000/udp port in the same manner you have already mapped the 80 and 443 ports necessary for Traefik. But for examples sake, assuming you have a yaml for your Traefik instance, you can add the following to map the 10000/udp port of the container to the host.

{{< code language="yaml" title="Map JVB port of Traefik container to the host" expand="Show" collapse="Hide" isCollapsed="false" >}}
ports:
  - target: 10000
    published: 10000
    protocol: udp
    mode: host
{{< /code >}}

To start the Jitsi containers you need three files, the docker-compose.yml file to start the services, the .env file to define some of the variables in the docker-compose.yml, and a gen-passwords.sh script to set strong passwords in the .env file. All three should be saved in the same directory.

{{< code language="yaml" title="docker-compose.yml" expand="Show" collapse="Hide" isCollapsed="false" >}}
networks:
  meet.jitsi:
    name: meet.jitsi
    internal: true
# Here 'traefik_net' is the existing Traefik network.
# Substitute all mentions with the name of your Traefik network
  traefik_net:
    name: traefik_net

services:
  jitsi-web:
    container_name: jitsi-web
# Change to latest build version as required
# Ensure all jitsi services are on the same build version
    image: jitsi/web:stable-8719
    restart: unless-stopped
    volumes:
# ${CONFIG} is a bash alias, add to your system env or replace with directory path.
      - ${CONFIG}/web:/config:Z
    environment:
      - PUBLIC_URL
      - TZ
    networks:
      - meet.jitsi
      - traefik_net
    labels:
      - "traefik.enable=true"
# Here 'https' is the name of the :443 entrypoint as defined in your Traefik config.
# Substitute if needed.
      - "traefik.http.routers.jitsi-rtr.entrypoints=https"
# Substitute 'jitsi.example.com' with the domain you will host Jitsi on
      - "traefik.http.routers.jitsi-rtr.rule=Host(`jitsi.example.com`)"
      - "traefik.http.routers.jitsi-rtr.tls=true"
      - "traefik.http.routers.jitsi-rtr.service=jitsi-svc"
      - "traefik.http.services.jitsi-svc.loadbalancer.server.port=80"

  prosody:
    container_name: prosody
    image: jitsi/prosody:stable-8719
    restart: unless-stopped
    volumes:
      - ${CONFIG}/prosody/config:/config:Z
    environment:
      - JICOFO_AUTH_PASSWORD
      - JVB_AUTH_PASSWORD
      - PUBLIC_URL
      - TZ
    networks:
      meet.jitsi:
        aliases:
          - xmpp.meet.jitsi

  jicofo:
    container_name: jicofo
    image: jitsi/jicofo:stable-8719
    restart: unless-stopped
    volumes:
      - ${CONFIG}/jicofo:/config:Z
    environment:
      - JICOFO_AUTH_PASSWORD
      - TZ
    depends_on:
      - prosody
    networks:
      - meet.jitsi

  jvb:
    container_name: jvb
    image: jitsi/jvb:stable-8719
    restart: unless-stopped
    volumes:
      - ${CONFIG}/jvb:/config:Z
    environment:
      - JVB_ADVERTISE_IPS
      - JVB_AUTH_PASSWORD
      - PUBLIC_URL
      - TZ
    depends_on:
      - prosody
    networks:
      - meet.jitsi
      - traefik_net
    labels:
      - "traefik.enable=true"
      - "traefik.udp.routers.jvb-rtr.entrypoints=video"
      - "traefik.udp.routers.jvb-rtr.service=jvb-svc"
      - "traefik.udp.services.jvb-svc.loadbalancer.server.port=10000"
{{< /code >}}

In the docker-compose.yml above, there are comments pointing out any sections you need to change. Other than these parts, you can copy the above file exactly.

{{< code language="bash" title=".env" expand="Show" collapse="Hide" isCollapsed="false" >}}
HTTP_PORT=8000
HTTPS_PORT=8443

# Directory where all configuration will be stored
# Change this if needed
CONFIG=~/.jitsi-meet-cfg

# Change if needed
TZ=UTC

# Substitute 'jitsi.example.com' with the domain you will host Jitsi on
PUBLIC_URL="https://jitsi.example.com"

# This is only needed if you are running behind NAT
# See the section in the Handbook:
# https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker#running-behind-nat-or-on-a-lan-environment
#JVB_ADVERTISE_IPS=192.168.1.1,1.2.3.4

# You don't have to set these manually
# Running ./gen-passwords.sh will update the passwords below
JICOFO_AUTH_PASSWORD=
JVB_AUTH_PASSWORD=
{{< /code >}}

In the .env file above you need to set the value of PUBLIC_URL, and [if behind a NAT](https://superuser.com/a/1630107) you need to set JVB_ADVERTISE_IPS. My own server is not behind a NAT so unfortunately this the one part of the set-up I haven't been able to test. The other variables you can change if you wish, but you don't have to.

{{< code language="bash" title="gen-passwords.sh" expand="Show" collapse="Hide" isCollapsed="false" >}}
# Copied from https://github.com/jitsi/docker-jitsi-meet/blob/master/gen-passwords.sh
#!/usr/bin/env bash

function generatePassword() {
    openssl rand -hex 16
}

JICOFO_AUTH_PASSWORD=$(generatePassword)
JVB_AUTH_PASSWORD=$(generatePassword)

sed -i.bak \
    -e "s#JICOFO_AUTH_PASSWORD=.*#JICOFO_AUTH_PASSWORD=${JICOFO_AUTH_PASSWORD}#g" \
    -e "s#JVB_AUTH_PASSWORD=.*#JVB_AUTH_PASSWORD=${JVB_AUTH_PASSWORD}#g" \
    "$(dirname "$0")/.env"
{{< /code >}}

The gen-passwords.sh script above has been [copied directly](https://github.com/jitsi/docker-jitsi-meet/blob/master/gen-passwords.sh) from the Jitsi repository, just with some lines deleted. The original generates passwords for the optional [Jigasi and Jibri](https://jitsi.github.io/handbook/docs/architecture) services we aren't using, but generating extra passwords won't do any harm, it's just unnecessary. Rather than copy the above, you could just download the script from there if you want.

Ensuring all three files are saved in the same directory, run the gen-passwords.sh script with the below command.

{{< code language="bash" title="Run .gen-passwords.sh" expand="Show" collapse="Hide" isCollapsed="false" >}}
#If you copied the script from the blog, don't forget to make it executable
#You can do that with this command
chmod +x gen-passwords.sh

#Then you can run the script with this command.
./gen-passwords.sh
{{< /code >}}

With the passwords generated, and the necessary parts of the docker-compose and env files edited, you can finally start up Jitsi with the below command.

{{< code language="bash" title="Start up Jitsi" expand="Show" collapse="Hide" isCollapsed="false" >}}
#If in same directory as the docker-compose.yml file
#The -d flag starts the containers up in the background so they aren't running in the terminal.
docker-compose up -d

#If in a different directory you can use the -f flag to point to docker-compose.yml
docker-compose -f PATH_TO_FILE/docker-compose.yml up -d
{{< /code >}}

Now open the PUBLIC_URL, i.e. jitsi.example.com, and you should see the Jitsi homepage. This doesn't prove it's working yet though. You need to start a meeting with three users, all with active video feeds. You can do this by turning on your webcam and opening three duplicate tabs. It needs to be three as by default for two users Jitsi operates in a different peer to peer mode, only for 3 or more are the video feeds routed through the JVB container.

If all three of these video feeds are working then congratulations, you have a working Jitsi instance!

If not, this guide has failed you. I recommend opening the browser developer console (Ctrl + Shift + I in most browsers) and looking for errors. You can also check the JVB container logs, the below command will open a live feed of the logs.

{{< code language="bash" title="View JVB container logs" expand="Show" collapse="Hide" isCollapsed="false" >}}
docker logs -tf jvb
{{< /code >}}

## Fixes to problems you might see

#### Weird insufficient bandwidth behaviour
The video feeds on my Jitsi instance were constantly turning off with the JVB container logs stating it was due to "insufficient bandwidth".

{{< code language="Log" title="Insufficient Bandwidth message" expand="Show" collapse="Hide" isCollapsed="false" >}}
...BandwidthAllocator.allocate#275: Sources suspended due to insufficient bandwidth
{{< /code >}}

But this didn't make sense, I should have plenty of bandwidth. It turns out I was able to fix this behaviour by disabling simulcast. But fair warning, this is **NOT recommended** by the veterans in the Jitsi [community forum](https://community.jitsi.org/).

By default Jitsi measures the network connection between clients and will auto-scale the video quality, including turning it off, depending on available bandwidth and if the streams are in tile view vs fullscreen. Disabling simulcast will [disable this behaviour](https://community.jitsi.org/t/performance-settings-in-high-quality/121812/2). The [result](https://community.jitsi.org/t/how-are-video-streams-handled-with-disabling-simulcast/125120) is the full video quality will be streamed from all clients to all clients, all the time. This is a lot of bandwidth that needs to run through the JVB on your server. Intuitively, choosing to disable simulcast is removing functionality and wasting bandwidth.

With that warning said, I found the auto-scaling was overly aggressive for some reason and kept turning off video feeds. Also, I should have plenty of bandwidth available for the small games nights I host, and my friends also have decent internet connections. So, rather than debug this weird behaviour it was [easier](https://xkcd.com/1495/) to take the brute-force approach and turn off the video auto-scaling entirely.

To do this you need to add the ENABLE_SIMULCAST environment variable to the jitsi-web container in the docker-compose.yml, and set its value to false in the .env file.

{{< code language="yaml" title="Adding ENABLE_SIMULCAST to yml" expand="Show" collapse="Hide" isCollapsed="false" >}}
...
  jitsi-web:
    container_name: jitsi-web
    image: jitsi/web:stable-8719
    restart: unless-stopped
    volumes:
      - ${CONFIG}/web:/config:Z
    environment:
      - PUBLIC_URL
      - TZ
      - ENABLE_SIMULCAST
...
{{< /code >}}

{{< code language="env" title="Adding ENABLE_SIMULCAST to .env" expand="Show" collapse="Hide" isCollapsed="false" >}}
ENABLE_SIMULCAST=false
{{< /code >}}

Then you need to rebuild the jitsi-web container. As Jitsi is made of 4 different containers, whenever you stop one it is best practice to stop and restart them all.

{{< code language="bash" title="Stop and rebuild Jitsi" expand="Show" collapse="Hide" isCollapsed="false" >}}
docker stop jitsi-web jvb jicofo prosody

#If in a different directory you can use the -f flag to point to docker-compose.yml
docker-compose -f PATH_TO_FILE/docker-compose.yml up -d
{{< /code >}}


#### Invalid message ... non-null is null
This is an odd one. At one stage in trying to get Jitsi working, this warning message was filling the logs for the JVB container.

{{< code language="Log" title="Invalid message received" expand="Show" collapse="Hide" isCollapsed="false" >}}
WARNING: Invalid message received (Parameter specified as non-null is null: method org.jitsi.videobridge.message.EndpointStats.put, parameter value (through reference chain: org.jitsi.videobridge.message.EndpointStats["connectionQuality"]):...
{{< /code >}}

Searching, I found [a fix](https://community.jitsi.org/t/jvb-error-invalid-message-received-parameter-specified-as-non-null-is-null/106505) for the issue on the Jitsi community forum, and adding it to my configuration stopped the issue. However, later when writing this post I removed the fix to try and recreate the error message and wasn't able to. I removed my Jitsi containers, images, volumes and deleted all files within ${CONFIG} to do a fresh install, but couldn't get the error to happen again.

So I don't understand what's going on and really this could be a complete red herring, but in case you are seeing the same issue I've included the fix here. To apply the fix you need to add the below environment variables to the jitsi-web container in the docker-compose.yml, and set their values as shown in the .env file.

{{< code language="yaml" title="Adding VIDEOQUALITY variables to yml" expand="Show" collapse="Hide" isCollapsed="false" >}}
...
  jitsi-web:
    container_name: jitsi-web
    image: jitsi/web:stable-8719
    restart: unless-stopped
    volumes:
      - ${CONFIG}/web:/config:Z
    environment:
      - PUBLIC_URL
      - TZ
      - VIDEOQUALITY_BITRATE_H264_LOW
      - VIDEOQUALITY_BITRATE_H264_STANDARD
      - VIDEOQUALITY_BITRATE_H264_HIGH
      - VIDEOQUALITY_BITRATE_VP8_LOW
      - VIDEOQUALITY_BITRATE_VP8_STANDARD
      - VIDEOQUALITY_BITRATE_VP8_HIGH
      - VIDEOQUALITY_BITRATE_VP9_LOW
      - VIDEOQUALITY_BITRATE_VP9_STANDARD
      - VIDEOQUALITY_BITRATE_VP9_HIGH
...
{{< /code >}}

{{< code language="bash" title="Adding VIDEOQUALITY variables to .env" expand="Show" collapse="Hide" isCollapsed="false" >}}
VIDEOQUALITY_BITRATE_H264_LOW=200000
VIDEOQUALITY_BITRATE_H264_STANDARD=500000
VIDEOQUALITY_BITRATE_H264_HIGH=1500000
VIDEOQUALITY_BITRATE_VP8_LOW=200000
VIDEOQUALITY_BITRATE_VP8_STANDARD=500000
VIDEOQUALITY_BITRATE_VP8_HIGH=15000000
VIDEOQUALITY_BITRATE_VP9_LOW=100000
VIDEOQUALITY_BITRATE_VP9_STANDARD=300000
VIDEOQUALITY_BITRATE_VP9_HIGH=1200000
{{< /code >}}

Then you need to rebuild the jitsi-web container. As Jitsi is made of 4 different containers, whenever you stop one it is best practice to stop and restart them all.

{{< code language="bash" title="Stop and rebuild Jitsi" expand="Show" collapse="Hide" isCollapsed="false" >}}
docker stop jitsi-web jvb jicofo prosody

#If in a different directory you can use the -f flag to point to docker-compose.yml
docker-compose -f PATH_TO_FILE/docker-compose.yml up -d
{{< /code >}}

## Customising Jitsi settings
Okay so your instance is working, now you want to play with all the options! A huge range of things can be controlled via environment variables. To see the full list you can check the [example docker-compose.yml](https://github.com/jitsi/docker-jitsi-meet/blob/master/docker-compose.yml) from the Jitsi Github repo. I left the majority of these out of my example as you don't need them just to get Jitsi up and running.

#### Disable third party server requests
There are even more settings that can't be controlled via the docker-compose.yml. These are setting which are configurable in the main non-docker build of Jitsi, but the necessary code hasn't been added to the docker image to allow them to be set via docker-compose. These settings are defined within config.js file. In our dockerised version of Jitsi this file is found at the Jitsi-web container config path, in our example case ${CONFIG}/web/config.js. However, by default it won't list every available setting that the non-docker build file contains.

You can view the full range of available settings at the [non-docker build repo](https://github.com/jitsi/jitsi-meet/blob/master/config.js) and then decide if you wish to change any in your Jitsi instance. One in particular I'd recommend is ``disableThirdPartyRequests``. Privacy is one of the main reasons to self host your instance, this setting ensures no external third party servers are contacted.

To set this you need to create a file in the same directory as config.js called custom-config.js and define the new setting there. As described in the [official documentation](https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker#jitsi-meet-configuration), the config.js file is recreated on every restart but the custom-config.js will remain static and be appended to config.js on start up. If you are only changing this one setting, your file only needs the one line.

{{< code language="js" title="Disable third party requests with custom-config.js" expand="Show" collapse="Hide" isCollapsed="false" >}}
config.disableThirdPartyRequests = true;
{{< /code >}}

Then you need to rebuild the jitsi-web container. As Jitsi is made of 4 different containers, whenever you stop one it is best practice to stop and restart them all.

{{< code language="bash" title="Stop and rebuild Jitsi" expand="Show" collapse="Hide" isCollapsed="false" >}}
docker stop jitsi-web jvb jicofo prosody

#If in a different directory you can use the -f flag to point to docker-compose.yml
docker-compose -f PATH_TO_FILE/docker-compose.yml up -d
{{< /code >}}