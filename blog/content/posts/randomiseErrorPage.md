+++
title = "Randomise your 404 page with Nginx & Traefik"
date = "2022-08-30"
keywords = "traefik nginx docker random 404 error"
description = "tl;dr: You can use the [split_clients module](https://nginx.org/en/docs/http/ngx_http_split_clients_module.html) in Nginx to randomly choose the page served in response to a query. This post shows how to configure a randomised error page in Nginx and Traefik. Refresh [this 404 error](https://www.codeslikeaduck.com/error) to see an example."
+++

> tl;dr: You can use the [split_clients module](https://nginx.org/en/docs/http/ngx_http_split_clients_module.html) in Nginx to randomly choose the page served in response to a query. This post shows how to configure a randomised error page in Nginx and Traefik. Refresh [this 404 error](https://www.codeslikeaduck.com/error) to see an example.

# Why do this?
When deciding on an error page for codeslikeaduck, I ended up with two different options; this [space theme 404 page](https://github.com/mpdcampbell/blog/tree/master/errorPage/html/space) and this [duck themed 404 page](https://github.com/mpdcampbell/blog/tree/master/errorPage/html/duck). I like them both and they both took time to customise. I had difficulty choosing, so I didn't. When an error occurs you are now randomly served one of the two.

# How to configure this in Nginx
Open the Nginx configuration file. If you don't have an existing Nginx webserver you can follow the first few steps of this [tutorial](https://www.codeslikeaduck.com/posts/custom404withtraefik/#how-to-set-it-up-in-docker) to deploy one in docker. Below is an example configuration for basic webserver.

{{< code language=".conf" title="Basic Nginx config" expand="Show" collapse="Hide" isCollapsed="false" >}}
server {
    listen 80;
    server_name _;

    location / {
        root  /usr/share/nginx/html;
        index index.html;
    }
}
{{< /code >}}

To define what page to serve in response to a given HTTP error status code, we can use the [error_page module](http://nginx.org/en/docs/http/ngx_http_core_module.html#error_page). It follows the following syntax: 

```error_page $statusCode $responsePath```  

So for example, adding to our configuration file we get the below:
{{< code language=".conf" title="error_page config" expand="Show" collapse="Hide" isCollapsed="false" >}}
server {
    listen 80;
    server_name _;

    # Respond with page 404.html for all status codes listed
    error_page 400 401 402 403 404  /404.html

    location / {
        root  /usr/share/nginx/html;
        index index.html;
    }
}
{{< /code >}}

The randomisation comes from the [split_clients module](https://nginx.org/en/docs/http/ngx_http_split_clients_module.html). 

#### How split_clients works
The module follows the following syntax:

```split_clients "$variable" $variant { x% string1; y% string2; * string3; }```

Here $variable is any of the [Nginx variables](https://nginx.org/en/docs/varindex.html) and x and y are numbers whose sum is equal to or less than 100. The split_client directive will take the value of $variable as a string and convert it to a 32bit numerical hash. If the hash number falls within the first x percent of possible values then $variant is set to be an alias of "string1". If the hash number falls within the next y percent of possible values then $variant is an alias of "string2". For any other values, $variant is an alias of "string3".

By defining the error page response path using the $variant string, the Nginx server will respond with a different page depending on outcome of the split_client calculation. Typically, the split_clients directive is used for A/B testing where users are directed to different versions of a page dependent on a user specific variable like their IP Address. We don't want this because then the same user would always see the same error page. Instead we can use the [$request_id](https://nginx.org/en/docs/http/ngx_http_core_module.html#var_request_id) as our variable. 

So for example, see the below configuration file:
{{< code language=".conf" title="split_clients config" expand="Show" collapse="Hide" isCollapsed="false" >}}
split_clients "${request_id}" $variant {
    50% duck;
    50% space;
}

server {
    listen 80;
    server_name _;

    #Respond with page 404.html for all status codes listed
    error_page 400 401 402 403 404  /${variant}/404.html

    location / {
        root  /usr/share/nginx/html;
        index index.html;
    }
}
{{< /code >}}

Here with have two versions of 404.html that we want to choose one of at random. Each page is saved in a separate directory at the root path, /usr/share/nginx/html/duck and /usr/share/nginx/html/space respectively.

# How to configure this for Traefik
In a [previous post](https://www.codeslikeaduck.com/posts/custom404withtraefik/) we talked through how you can serve a custom error page in Traefik by hosting that error page in Nginx service and redirecting any queries with an error status code response to this service. So really to configure the randomisation for Traefik is still just configuring for Nginx and the above explanation on split_clients should be enough to customise to your use case.

But if you followed the previous post and are picking up from there exactly, the below configuration allows for the fact we exposed the Nginx service on a subdomain, [error.codeslikeaduck.com](https://error.codeslikeaduck.com), and want that subdomain to resolve when visited directly. Note our Nginx service is set up solely for returning 404.html so we don't need to worry about the error_page directive, any http status code errors from the service itself can be handled by adding the errors middleware we set up to the Nginx service router.

{{< code language=".conf" title="default.conf" expand="Show" collapse="Hide" isCollapsed="false" >}}
split_clients "${request_id}" $variant {
    50% duck;
    50% space;
}

server {
    listen 80;
    server_name _;

# This section is to respond to the errors middleware query for 404.html
    location /404.html {
        root  /usr/share/nginx/html/${variant};
        index 404.html;
    }

# This section is to respond to requests for error.codeslikaduck.com homepage
    location / {
        root /usr/share/nginx/html/;
        index ${variant}/404.html;
    }
}
{{< /code >}}