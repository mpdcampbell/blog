+++
title = "Make network diagrams less boring with Excalidraw"
date = "2023-11-17"
keywords = ["excalidraw", "network diagram", "self-host"]
description = "tl;dr: Network diagrams are often monotonous webs, [Excalidraw](https://github.com/excalidraw/excalidraw) uses a sketchy hand-drawn style to make your information dump more visually engaging. This post shows example diagrams and how to host your own Excalidraw instance." 
+++

> tl;dr: Network diagrams are often monotonous webs, [Excalidraw](https://github.com/excalidraw/excalidraw) uses a sketchy hand-drawn style to make your information dump more visually engaging. This post shows example diagrams and how you to host your own Excalidraw instance.

## Contents
- [Network diagrams are boring](#network-diagrams-are-visually-boring)  
- [Excalidraw - a solution](#excalidraw---a-solution)
  - [Example Excalidraw diagram](#example-excalidraw-diagram)
- [How to use Excalidraw](#how-to-use-excalidraw)
- [How to self-host Excalidraw](#how-to-self-host-excalidraw)  
---

### Network diagrams are visually boring

Network diagrams are extremely useful, they are a concise way to convey a large amount of top level information on your service / system architecture. Generally, they are easier to digest than the equivalent information in a block of text. 

But, even if you put thought into the design and layout, you just end up with a load of arrows, boxes, and labels. And without any graphic design thought, this is probably a monotone bunch of arrows and boxes. For anyone who isn't extremely keen on your system architecture, their eyes are going to glaze over. 

### Excalidraw - a solution
This is where Excalidraw comes in. It's browser based whiteboard tool. It draws the boxes and arrows in a rough hand-drawn style, each time drawn slightly different to breaking up the visual monotony. (The handwritten font is the same every time, but hey it's fun.) 

#### Example Excalidraw diagram

Here is a network diagram I made for the services I host. 

{{< collapsable-box contentType="Network Diagram" title="My hosted services" expand="Show" collapse="Hide" isCollapsed="false" >}}
<img src="/img/posts/excalidrawDiagrams/selfhostedServiceNetwork.png" alt="Excalidraw Diagram of Docker services" loading="lazy"> 
{{< /collapsable-box >}}

### How to use Excalidraw
There's a free public instance at [excalidraw.com](https://excalidraw.com). It loads directly into a blank whiteboard (see screenshot below), and a little purple shield reassures you that everything is end-to-end encrypted so the Excalidraw servers can't see your diagrams. 

{{< collapsable-box contentType="Screenshot" title="Excalidraw whiteboard" expand="Show" collapse="Hide" isCollapsed="false" >}}
<img src="/img/posts/excalidrawDiagrams/excalidrawWhiteboard.png" alt="Screenshot of the Excalidraw UI" loading="lazy"> 
{{< /collapsable-box >}}

But why use their convenient, free and encrypted instance when you can [host your own](https://xkcd.com/456/). 

### How to self-host Excalidraw

Docker config files don't get much shorter than this one. A working docker-compose.yml file is shown below.

{{< code language="yaml" title="docker-compose.yml" expand="Show" collapse="Hide" isCollapsed="false" >}}
services:
  excalidraw:
    image: excalidraw/excalidraw
    container_name: excalidraw
    restart: unless-stopped
    ports:
      - ${EXCALIDRAW_PORT}:80
{{< /code >}}

I've overcomplicated it a bit by including a bash alias, you either need to replace this with your own value or add the alias to your systems .env file:
- **${EXCALIDRAW_PORT}** is the port at which you can access Excalidraw, e.g. 7070

Once the docker-compose.yml file has been changed, you can start up the Excalidraw instance. 

{{< code language="bash" title="Start up the container" expand="Show" collapse="Hide" isCollapsed="false" >}}
#If in same directory as the docker-compose.yml file
#The -d flag starts the containers up in the background, so they aren't running in the terminal.
docker-compose up -d

#If in a different directory you can use the -f flag to point to docker-compose.yml 
docker-compose -f PATH_TO_FILE/docker-compose.yml up -d
{{< /code >}}

Now if you visit localhost:${EXCALIDRAW_PORT} in your browser, e.g. localhost:7070, you should see your Excalidraw whiteboard.

If it isn't working you can inspect the container logs for issues.

{{< code language="bash" title="View container logs" expand="Show" collapse="Hide" isCollapsed="false" >}}
docker logs -tf excalidraw
{{< /code >}}