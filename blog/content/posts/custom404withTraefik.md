+++
title = "Set up a custom 404 page with Traefik"
date = "2022-08-18"
keywords = "traefik docker 404 error page"
description = "tl;dr: The default error pages in Traefik are very basic. Using the [errors middleware](https://doc.traefik.io/traefik/middlewares/http/errorpages/) when a request returns an error HTTP status you can serve a [custom page](https://www.codeslikeaduck.com/error) instead."
+++

> tl;dr: The default error pages in Traefik are very basic. Using the [errors middleware](https://doc.traefik.io/traefik/middlewares/http/errorpages/) when a request returns an error HTTP status code you can serve a [custom page](https://www.codeslikeaduck.com/error) instead.

## How it works

{{< code language="ascii" title="Error Middleware Flow Diagram" expand="Show" collapse="Hide" isCollapsed="false" >}}
                           REQUEST    RESPONSE
                              │          ▲
                           [1]│          │
http://codeslikeaduck.com/page│          │custom.html
                              │          │[10]
                            ┌─▼──────────┴─┐
                            │              │
                            │  ENTRYPOINT  │
                            │              │
                            └─┬──────────▲─┘
                           [2]│          │
http://codeslikeaduck.com/page│          │custom.html
                              │          │[9]
                            ┌─▼──────────┴─┐
                            │              │
                            │    ROUTER    │
                            │              │
                            └─┬──────────▲─┘
                           [3]│          │
http://codeslikeaduck.com/page│          │custom.html
                              │          │[8]
                            ┌─▼──────────┴─┐     FILE       ┌─────────────┐
                            │              │ custom.html [7]│             │
                            │    ERRORS    ◄────────────────┤  SERVICE B  │
                            │  MIDDLEWARE  ├────────────────►             │
                            │              │[6]  REQUEST    └─────────────┘
                            └─┬──────────▲─┘   /custom.html 
                           [4]│          │
http://codeslikeaduck.com/page│          │Error
                              │          │Status Code
                              │          │[5]
                            ┌─▼──────────┴─┐
                            │              │
                            │  SERVICE A   │
                            │              │
                            └──────────────┘
{{< /code >}}

General Traefik operation is that a HTTP request reaches the server entrypoint (usually port 80 or 443), it is picked up by the appropriate router, the request is modified according to any defined rules and routed through any attached middlewares, before being passed to the service. The service response is then routed back through the chain. 

With the errors middleware the original request is passed through unaltered, but when the service responds with an error status code the errors middleware then sends a custom GET request to a separate service. The response of this separate service is then returned in response to the external request, along with the error status code.

## How to set it up in Docker
This tutorial assumes you already have a working Traefik configuration in Docker and you just wish to add the custom error page functionality. To act as the "Service B" in the above flow diagram we can set up an [Nginx web server](https://hub.docker.com/_/nginx/) to serve the error page.  

First we need a directory to store the Nginx configuration file (default.conf), and the error page html we want to serve.
{{< code language="bash" title="Create directory" expand="Show" collapse="Hide" isCollapsed="false" >}}
#Make a directory for custom error page
mkdir -p errorPage/html
#Make a blank default.conf
touch errorPage/default.conf
{{< /code >}}

This Nginx server will be basic, it only needs to listen for incoming requests and host the one webpage "custom.html". Open default.conf in your [editor of choice](https://xkcd.com/1172/) and enter the below.

{{< code language=".conf" title="default.conf" expand="Show" collapse="Hide" isCollapsed="false" >}}
server {
    listen 80;
    server_name _;

    location / {
        root  /usr/share/nginx/html;
        index custom.html;
    }
}
{{< /code >}}

The "listen" port that the container listens on can be set to different value if you wish but 80 works as a default. Similarly the custom.html file can renamed to whatever you like as long as it matches the actual filename. For now we'll create a test page.

{{< code language="bash" title="Create test custom.html" expand="Show" collapse="Hide" isCollapsed="false" >}}
echo "The errors middleware is working" > errorPage/html/custom.html
{{< /code >}}

Now the directory is ready, we can add the Nginx container.

Below is the minimum config to deploy the Nginx container. A more complete config with added security middlewares is shown [here](https://github.com/mpdcampbell/blog/blob/master/docker-compose-blog.yml). If you don't bother with a [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) for your site, [you really should](https://blog.139381512.xyz/posts/quickcspsetup/).

{{< code language="yml" title="Nginx docker-compose.yml [Bare bones set up]" expand="Show" collapse="Hide" isCollapsed="false" >}}
errorPage:
      container_name: errorPage
      image: nginx 
      restart: always
      networks:
        - ${TRAEFIK_NETWORK}
      volumes:
        - ${ERRORPAGE_DIR}/html:/usr/share/nginx/html
        - ${ERRORPAGE_DIR}/:/etc/nginx/conf.d/
      environment:
        - PUID
        - PGID
        - TZ
      labels:
        - "traefik.enable=true"
      ## HTTP Routers
        - "traefik.http.routers.errorpage-rtr.entrypoints=https"
      ## HTTP Services
        - "traefik.http.routers.errorpage-rtr.service=errorpage-svc"
        - "traefik.http.services.errorpage-svc.loadbalancer.server.port=${ERRORPAGE_PORT}"
{{< /code >}}

The variables above that you need to change:
 - **${TRAEFIK_NETWORK** is the name of your Traefik network in Docker. Without this the errorPage service isn't included in the Traefik network to receive the routed requests.
 - **${ERRORPAGE_DIR}** is the path to the errorPage directory containing default.conf.
 - **${ERRORPAGE_PORT}** is the listen port value you set in the default.conf file.

We haven't created the errors middleware yet, but at this point if you start up the errorPage container it should run and be picked up by Traefik without issues. If you have enabled the Traefik [dashboard](https://doc.traefik.io/traefik/operations/dashboard/), that's the simplest way to check for any Traefik related issues. For the errorPage container itself, you can use the command below to check the logs and confirm it loaded up okay.

{{< code language="bash" title="Check errorPage service logs" expand="Show" collapse="Hide" isCollapsed="false" >}}
docker logs -f errorPage
# the -f flag is for live log feed, ctrl + c to exit
{{< /code >}}

You should see something similar to below:
{{<code language="log" title="Excerpt errorPage service logs" expand="Show" collapse="Hide" isCollapsed="false" >}}
...
2022/08/20 19:39:43 [notice] 1#1: using the "epoll" event method
2022/08/20 19:39:43 [notice] 1#1: nginx/1.23.0
2022/08/20 19:39:43 [notice] 1#1: built by gcc 10.2.1 20210110 (Debian 10.2.1-6)
2022/08/20 19:39:43 [notice] 1#1: OS: Linux 5.4.0-124-generic
2022/08/20 19:39:43 [notice] 1#1: getrlimit(RLIMIT_NOFILE): 1048576:1048576
2022/08/20 19:39:43 [notice] 1#1: start worker processes
2022/08/20 19:39:43 [notice] 1#1: start worker process 29
2022/08/20 19:39:43 [notice] 1#1: start worker process 30
2022/08/20 19:39:43 [notice] 1#1: start worker process 31
2022/08/20 19:39:43 [notice] 1#1: start worker process 32
2022/08/20 19:39:43 [notice] 1#1: start worker process 33
2022/08/20 19:39:43 [notice] 1#1: start worker process 34
2022/08/20 19:39:43 [notice] 1#1: start worker process 35
2022/08/20 19:39:43 [notice] 1#1: start worker process 36
2022/08/20 19:39:43 [notice] 1#1: start worker process 37
2022/08/20 19:39:43 [notice] 1#1: start worker process 38
2022/08/20 19:39:43 [notice] 1#1: start worker process 39
2022/08/20 19:39:43 [notice] 1#1: start worker process 40
{{< /code >}}

So far so good, now let's create the errors middleware. There are two options (well there are [more](https://doc.traefik.io/traefik/providers/overview/#supported-providers) but I'm only mentioning two) for how to define Traefik middlewares. We can either define it as part of the docker-compose.yml or in an external [file](https://doc.traefik.io/traefik/providers/file/). Defining middlewares in a separate file is useful for keeping your docker-compose.yml tidy, but it requires some config. I explain that in a short post [here]() (well I will once I write it).

The simplest option is to define the middleware in the docker-compose.yml as you should already have docker defined as a provider in your Traefik [config](https://github.com/mpdcampbell/selfhosted-services/blob/main/docker-compose-traefik.yml#L34). Append the below to the errorPage container.

{{< code language="yml" title="Error middleware docker-compose.yml syntax" expand="Show" collapse="Hide" isCollapsed="false" >}}
 # Errorpage-redirect middleware
 - "traefik.http.middlewares.errorpage-redirect.errors.status=400-599"
 - "traefik.http.middlewares.errorpage-redirect.errors.service=errorpage-svc"
 - "traefik.http.middlewares.errorpage-redirect.errors.query=/custom.html" #/{status}.html"
{{< /code >}}

 - First line defines the range of HTTP status codes that the errors middleware (called errorpage-redirect here) will react to. For example if you replaced 400-599 with 404 then only 404 status code responses will get served custom.html and all other errors will be routed through unaffected.
 - Second line is the name of the service the errors middleware should send the custom GET request to, no need to change this.
 - Third line defines what query will be sent to the errorPage container. Here you can use the {status} variable, where status will be replaced by whatever error status code was received. With this you could serve different error pages for every status code if you wanted. 

Now the errors middleware has been created we can add it to the routers for every service we want to return the custom error page. In my case I host codeslikeaduck.com as a container named "blog" and you see where I add the errorpage-redirect middleware to the blog service router [here](https://github.com/mpdcampbell/blog/blob/master/docker-compose-blog.yml#L32). But for a general case you can add the middleware to a service by adding the below under that containers labels.

{{< code language="yml" title="Add middleware to router" expand="Show" collapse="Hide" isCollapsed="false" >}}
- "traefik.http.routers.router-name.middlewares=errorpage-redirect"
{{< /code >}}

With that added, now when you rebuild your docker-compose.yml the custom error page should be working. Visit a non-existent page on your service domain to confirm you are served a blank page with the text "The errors middleware is working". 

__Congratulations!__ Now just replace custom.html with your personalised error page and jobs done. However, you should give some consideration when designing the error page...

## Be careful of relative paths
If your error page is self contained within a single html file, for example this [space themed 404 page](https://github.com/mpdcampbell/blog/tree/master/errorPage/html/space), then there are no issues. But if the html, css and javascript are organised in separate files, for example this [duck themed 404](https://github.com/mpdcampbell/blog/tree/master/errorPage/html/duck), any files referenced by relative paths won't load successfully. At least not if if they are hosted with the error page service.

#### Why be careful?

This is easiest explained with an example. Following the flow diagram above, if a user requests a page that doesn't exist, https://codeslikeaduck.com/page, traefik routes the request to the service hosting codeslikeaduck.com, the service responds with status 404, the errors middleware will  then intercept and query the errorPage service, which will successfully return custom.html. The users browser then runs through custom.html until it reaches the line:

```<link rel="stylesheet" href="css/app.css" type="text/css"/>"``` 

The browser will then request codeslikeaduck.com/css/app.css, which will get routed by Traefik to the service hosting codeslikeaduck.com, which will respond 404, which will get intercepted by the errors middleware and the server will respond with custom.html. This wont match the expected content-type and the browser will return an error.

You could solve this by locally storing the css, js and other assets for the error page in the original service volume. But that seems messy and confusing as the html would be in a seperate service volume. You could also use [regex and path rules](https://doc.traefik.io/traefik/routing/routers/) to be more precise about what queries are routed where, but that feels overly complicated and could lead to accidental routing of valid asset queries away from the original service. Instead of those options, I recommend exposing the assets to the web so you can replace all relative paths with a URL.  


---

_Expose the error service on a subdomain so you can replace relative paths with URLs_

---


You already have a service set up to host the custom error page, with a few more lines of config you can expose this under a subdomain (e.g. [error.codeslikeaduck.com](https://error.codeslikeaduck.com)). This process would be equivalent to the steps you went through to expose your original service, but for reference you can see the docker-compose.yml for my setup [here](https://github.com/mpdcampbell/blog/blob/master/docker-compose-blog.yml). As the error subdomain exists only to host assets, you can add the below header middleware to prevent indexing by search engines.

{{< code language="yml" title="No index header middleware" expand="Show" collapse="Hide" isCollapsed="false" >}}
- "traefik.http.middlewares.errorpage-headers.customResponseHeaders.X-Robots-Tag=none,noarchive,nosnippet,notranslate,noimageindex,"
{{< /code >}}

Oh and don't forget to update your settings with your DNS provider to add the subdomain.
