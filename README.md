The code for [codeslikeaduck.com](https://www.codeslikeaduck.com)

- The site is self-hosted, set up in a [Hugo docker container](https://github.com/klakegg/docker-hugo#readme) with request routing handled by [Traefik](https://github.com/traefik/traefik#readme).</br>
- It's a [Hugo](https://gohugo.io/) site using the [Terminal](https://github.com/panr/hugo-theme-terminal) theme with some minor CSS tweaks.
- HTTP status errors are routed to a seperate [nginx](https://hub.docker.com/_/nginx) instance that serves a 404 page.</br>
- An [Umami](https://github.com/mikecao/umami#readme) instance runs alongside for web analytics.</br>

<br />
<br />
<br />

## License

This website uses Panr's [Terminal Theme](https://github.com/panr/hugo-theme-terminal).

The theme is released under the MIT License. Check the [original theme license](https://github.com/trev-dev/hugo-theme-terminal/blob/master/LICENSE.md) for additional licensing information.
