+++
title = "Self-hosted analytics with Umami"
date = "2022-06-09"
description = "tl;dr: [Umami](https://umami.is/) is a simple and privacy-focused web analytics tool. This post runs through deploying Umami with Docker to track codeslikeaduck.com, which required some CSP and CORS header tweaks for hosting online. You can [view the analytics](https://umami.codeslikeaduck.com/share/Ljt3LRkD/codeslikeaduck)." 
+++

> tl;dr: [Umami](https://umami.is/) is a simple and privacy-focused web analytics tool. This post runs through deploying Umami with Docker to track codeslikeaduck.com, which required some CSP and CORS header tweaks for hosting online. You can [view the analytics](https://umami.codeslikeaduck.com/share/Ljt3LRkD/codeslikeaduck)." 

## Why Analytics 

I'm interested to see if anyone ever visits this site, or if it really is just an elaborate notepad. 
Codeslikeaduck is already hosted behind Cloudflare and Traefik reverse proxies, each with some level of traffic logging functionality, but neither is really fit for my purpose. 
Traefik is set up to record your typical backend access logs for security purposes and while you could filter out web-analytics style information from this, I think its best practice to keep the security and web-analytics separate. Cloudflare's proxy does include free web analytics but it falls short in many ways, helpfully [outlined](https://plausible.io/vs-cloudflare-web-analytics) by web analytics competitor Plausible, but the main flaw for me is that it doesn't filter out bot traffic. 
If you go by Cloudflare this site has had 42 visitors from a dozen countries in the last 24 hours.       

## Why Umami

Looking into self-hosted web analytics, there are [a lot of options](https://alternativeto.net/software/google-analytics/?license=opensource&platform=self-hosted). The two most popular seem to be [Matomo](https://matomo.org/) and [Plausible](https://plausible.io/). Matomo is a powerful google analytics alternative but overly complicated for my needs, see [live demo](https://demo.matomo.cloud/?menu). Plausible, on the other hand, seems ideal. It's lightweight, designed with a privacy focus, and has a nice simple single page UI (see [live demo](https://plausible.io/plausible.io)). Umami is as far as I can tell very similar to Plausible (see [live demo](https://app.umami.is/share/8rmHaheU/umami.is)) but with a slightly different focus, Plausible is an open source SaaS product with a free self-host option whereas Umami has no SaaS implementation. 

But why did I choose Umami over Plausible? Plausible requires two database deployments, a Postgres database for user data and a Clickhouse database for the analytics data. Umami only requires one database, Postgres or Mysql.
	

## How to set up Umami in Docker
_Editors Note: Capitalising Docker appears to be the accepted convention online but its pretty annoying when you are used to typing the 'docker' command in lower case all the time. Also no I don't have an Editor._

[This website](https://github.com/mpdcampbell/blog) and [everything else I host](https://github.com/mpdcampbell/selfhosted-services) are running in Docker containers, so I opted to deploy Umami with Docker. Many blog tutorials correctly point out the quickest way to set up a working Umami and database combo in Docker is to clone the repository, cd in and run docker-compose.

{{< code language="bash" title="Don't do this" expand="Show" collapse="Hide" isCollapsed="false" >}}
git clone https://github.com/mikecao/umami.git
cd umami
docker-compose up
{{< /code >}}

But this is cloning an entire repository to your server just to avoid having to initialise the database. Yes, it is an extra step but the repository contains [schema files](https://github.com/mikecao/umami/tree/master/sql), so the only step you are really skipping is "making a directory to save the schema file in". You will then have to point the database container at the schema, but you need to edit the docker-compose.yml anyway so that its not using the default credentials. 

Instead of the above code snippet we can follow the below steps. Note the following is assumes you chose a Postgres database; the same procedure applies for deploying with a Mysql database just use the other schema file and be aware you need to swap out the Postgres image and variables in the docker-compose.yml with a [Mysql image](https://hub.docker.com/_/mysql/?tab=description).

{{< code language="bash" title="Do this instead" expand="Show" collapse="Hide" isCollapsed="false" >}}
#Make a directory for Umami Database
mkdir -p umami/umamidb/schema
#Download the Postgres schema (you could just make this file manually)
curl https://raw.githubusercontent.com/mikecao/umami/master/sql/schema.postgresql.sql > umami/umamidb/schema/schema.postgresql.sql
#Download the docker-compose.yml from Umami repository (you could just make this file manually)
curl https://raw.githubusercontent.com/mikecao/umami/master/docker-compose.yml > umami/docker-compose.yml
{{< /code >}}

Now we have to edit the variables in the docker-compose.yml before we can build the images. 
The default docker-compose.yml is below and I have used an alias to represent every value you need to replace. The comments are also mine not original:

{{< code language="yaml" title="docker-compose.yml" expand="Show" collapse="Hide" isCollapsedi="false" >}}
---
version: '3'
services:
  umami:
    image: ghcr.io/mikecao/umami:postgresql-latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://${UMAMI_DB_USERNAME}:${UMAMI_DB_PASSWORD}@db:5432/umami
      DATABASE_TYPE: postgresql
      HASH_SALT: ${UMAMI_HASH_SALT}
    depends_on:
      - db
    restart: always
  db:
    image: postgres:12-alpine
    environment:
      POSTGRES_DB: ${UMAMI_DB_NAME}
      POSTGRES_USER: ${UMAMI_DB_USERNAME}
      POSTGRES_PASSWORD: ${UMAMI_DB_PASSWORD}
    volumes:
     #Here is where we are pointing the database at the schema file we saved earlier
      - ${UMAMI_DB_DIR}/schema:/docker-entrypoint-initdb.d:ro #I have removed the following part of path /schema.postgresql.sql:ro
      - ${UMAMI_DB_DIR}/data:/var/lib/postgresql/data
    restart: always
volumes:
  umami-db-data:
{{< /code >}}

Quick explainer through each variable that needs changed.
 - **${UMAMI_DB_NAME} / USERNAME / PASSWORD** are the credentials for the database. These also go in the DATABASE_URL so that the Umami application can access the database.
 - **${UMAMI_DB_DIR}** is the path to the umami/umamidb folder created in the last code snippet. The change to volume path tidies it up.
 - **${UMAMI_HASH_SALT}** is a random string. To generate a random string you can use the following command (Command taken from [this tutorial](https://www.digitalocean.com/community/tutorials/how-to-install-umami-web-analytics-software-on-ubuntu-20-04))
{{< code language="bash" title="hash generator" expand="Show" collapse="Hide" isCollapsed="false" >}}
openssl rand -base64 32
{{< /code >}}

Once the docker-compose.yml file has been changed you can start up your Umami application:

{{< code language="bash" title="Start up containers" expand="Show" collapse="Hide" isCollapsed="false" >}}
#If in same directory as the docker-compose.yml file
#The -d flag starts the containers up in the background so they aren't running in the terminal.
docker-compose up -d

#If in a different directory you can use the -f flag to point to docker-compose.yml 
docker-compose -f PATH_TO_FILE/docker-compose.yml up -d
{{< /code >}}

Now if you visit localhost:3000 in your browser, or "local_server_ip":3000 you should see the Umami login screen.
If it isn't working you should inspect the logs of the containers for issues. 
To view a live feed of the logs run the following command:

{{< code language="bash" title="View container logs" expand="Show" collapse="Hide" isCollapsed="false" >}}
#Below is for the umami container, to view the database logs replace umami with db
docker logs -tf umami
{{< /code >}}

If it did work, congratulations! 
You now have a working instance of Umami running locally on your server. 
The first thing you should do now is change the default username (admin) and password (umami).

## How to start tracking your site

**First get Umami online**  
Umami will prompt you to add a website. Input your website name and address, and then click the "Get tracking code" button to get the tracking code. This is where you realise that an Umami instance that is only running locally is not very useful. The "tracking code" is a line of HTML telling the users browser to download the tracking script from our Umami instance. If the Umami instance isn't exposed to the internet then the browser can't grab the script and send any analytics data.

To expose your server you could just open port 3000 on your router, which will work, but exposing a direct public pathway to your application with zero security implemented is not recommended. The better approach would be to set up a subdomain on your website and use a reverse proxy to route and filter requests for that subdomain to your Umami instance. 

I'm going to gloss over this crucial step in the Umami set up and assume if you are looking to self host web analytics, you already self host a website and have a working reverse proxy configuration. Reverse proxy set up is a large tutorial in an of itself. If you don't have an existing configuration, I recommend [Traefik](https://github.com/traefik/traefik#readme) as it's [what I use](https://github.com/mpdcampbell/selfhosted-services/blob/main/docker-compose-traefik.yml). But for immediate results, [this Umami tutorial](https://www.digitalocean.com/community/tutorials/how-to-install-umami-web-analytics-software-on-ubuntu-20-04#step-2-installing-and-configuring-nginx) covers set up of a Nginx web server and adding an SSL cert so your Umami subdomain is HTTPS. Though note the Nginx web server is not deployed in Docker, and long term you will want to look into [security headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers).

**How to actually do the tracking**  
As outlined in the [Umami docs](https://umami.is/docs/collect-data), if you click on "Get tracking code" you get a line of HTML to copy into the \<head\> section of your website. However, by default the tracking code does not include the "data-do-not-track" flag, meaning by default Umami will ignore any [Do Not Track HTTP requests](https://en.wikipedia.org/wiki/Do_Not_Track). I strongly recommend you add this line to respect users wishes, see data-do-not-track usage below:

{{< code language="html" title="Respectful tracking code" highlight="2" expand="Show" collapse="Hide" isCollapsed="false" >}}
<script async defer
  src="http://mywebsite/umami.js"
  data-website-id="94db1cb1-74f4-4a40-ad6c-962362670409"
  data-do-not-track="true"
></script>
{{< /code >}}

As well as analytics of general visitors, you can track [specific events](https://developer.mozilla.org/en-US/docs/Web/Events) such as a user clicking on a link. The [Umami docs](https://umami.is/docs/track-events) for this are clear and concise (unlike anything I write) so follow those. But for an example, below is the code change I made to track when users click the link to my [Github profile](https://github.com/mpdcampbell) in the website footer. [Full html file here](https://github.com/mpdcampbell/blog/blob/master/blog/themes/terminal/layouts/partials/footer.html#L4).

{{< code language="diff yml" title="Tracking click event" expand="Show" collapse="Hide" isCollapsed="false" >}}
- <span><a href="https://github.com/mpdcampbell">{{ partial "inline-svg" "octocat"}}</a></span>
+ <span><a id="github-icon" class="githubIcon umami--click--github-icon" href="https://github.com/mpdcampbell">{{ partial "inline-svg" "octocat"}}</a></span>
{{< /code >}}

## CORS and CPS changes needed for Umami
Long time readers of codeslikeaduck (which thanks to [Umami](https://umami.codeslikeaduck.com/share/Ljt3LRkD/codeslikeaduck) I now know don't exist) will know the importance of a strong [Content Security Policy](https://www.codeslikeaduck.com/posts/quickcspsetup/) (CSP). Also important for a secure website is adding headers to define [Cross-Origin Resource Sharing](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) (CORS) parameters. If you have CSP and CORS headers set on your website, when you add the tracking code snippets it probably wont work. That's good news, it means your site wont run random scripts, but we need to add some exceptions for Umami. 

Below is a summary of the changes I had to make so that Umami could function, link to the [full docker-compose.yml](https://github.com/mpdcampbell/blog/blob/master/docker-compose-blog.yml).

- Domain being tracked
    *  Content Security Policy: Add Umami domain to script-src and content-src  
- Umami domain 
    * Access Control Allow Headers: Add Content-Type
    * Access Control Allow Origin List: Add Domain being tracked

**Website being tracked: CSP script-src and content-src**  
The [script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src) flag dictates the allowed sources for any Javascript and [connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/connect-src) flag dictates the URLs that can be connections can be made to as part of a running script. You need to add the subdomain that the Umami instance is hosted at to both so that user's browser can download the script pointed to by the tracking code, and then send the data back to Umami. See below the changes I made, formatted for readability, for the line in the full [docker-compose.yml](https://github.com/mpdcampbell/blog/blob/11a0f8f51f6c571217e383339111e11d1b1b82b0/docker-compose-blog.yml#L39)

{{< code language="diff yml" title="Tracked website CSP change" expand="Show" collapse="Hide" isCollapsed="false" >}}
traefik.http.middlewares.blog-headers.headers.contentsecuritypolicy=
  default-src 'none';
- connect-src 'self';  
+ connect-src 'self' https://umami.${BLOGDOMAIN}; 
  font-src 'self'; 
  img-src 'self'; 
- script-src 'self';  
+ script-src 'self' https://umami.${BLOGDOMAIN}/umami.js; 
  style-src 'self'"
{{< /code >}}

**Umami domain: Access Control Allow Headers and Allow Origin**  
Before sending a POST request with the analytics data, the tracking script will send a [preflight request](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request) with various request headers to check if the Umami instance will the POST request. You can view the full preflight request in the console (Ctrl+Shift+I) and looking at the OPTIONS request to the Umami domain. The errors I received were regards the preflight request checking the request [origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin) and if ["Content-Type"](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type) header will be accepted. To fix the Origin error we add list the website URL on the ["Access-Control-Allow-Origin"](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin) header. To allow Content-Type headers we set the ["Access-Control-Allow-Headers"](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers) header. Syntax below is for defining headers as part of a middleware file, declaration in a docker-compose as label see the full [docker-compose.yml](https://github.com/mpdcampbell/blog/blob/11a0f8f51f6c571217e383339111e11d1b1b82b0/docker-compose-blog.yml#L85).

{{< code language="yml" title="Umami domain CORS headers" expand="Show" collapse="Hide" isCollapsed="false" >}}
http:
  middlewares:
    accessControlHeaders:
      headers:
        accessControlAllowHeaders: 
          - Content-Type
        accessControlAllowOriginList:
          - https://www.codeslikeaduck.com
{{< /code >}}
