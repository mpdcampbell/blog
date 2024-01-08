+++
title = "Automatically update Dockerfile, build, and push"
date = "2024-01-08"
keywords = "Dockerfile GitHub workflow update"
description = "tl;dr: If you maintain a Docker image on GitHub, this [workflow](https://github.com/mpdcampbell/traefik-geoip-filter/tree/main/.github) will automatically update your Dockerfile when the base image updates, update the repo tag, build a new image and push a version tagged build to Docker Hub."
+++

> tl;dr: If you maintain a Docker image on GitHub, this [workflow](https://github.com/mpdcampbell/traefik-geoip-filter/tree/main/.github) will automatically update your Dockerfile when the base image updates, update the repo tag, build a new image and push a version tagged build to Docker Hub.

## Contents
- [How it works](#how-it-works)
- [How to set it up](#how-to-set-it-up)
- [How to manually trigger the workflow](#how-to-manually-trigger-the-workflow)
- [Acknowledgement](#acknowledgement)
---

## How it works

'GitHub Actions' [is](https://xkcd.com/1090/) GitHub's automated [CI/CD](https://resources.github.com/ci-cd/) solution. There is a [marketplace](https://xkcd.com/1060/) of FOSS and paid closed-source [actions](https://github.com/marketplace?category=&query=&type=actions&verification=) available, where you can think of each action as a modular script that runs on a GitHub server. You can use a YAML file to chain together multiple actions into a single 'workflow', and set it to run when a GitHub event trigger occurs (e.g. a pull request is raised). GitHub also offers a tool called [Dependabot](https://github.com/dependabot/dependabot-core) which can monitor the dependencies in your code and generate pull requests when updated versions are available. By using Dependabot to monitor the Dockerfile, and as the trigger for the GitHub Actions workflow, we can automatically detect updates to the base image and push new patch builds to Docker Hub.  

There are two files needed, ``dependabot.yml`` to set the Dependabot configuration and ``approve-merge-build-push.yml`` to define the GitHub Actions workflow. The diagram below breaks down how the actual workflow works.

{{< collapsable-box contentType="Diagram" title="The GitHub action workflow" expand="Show" collapse="Hide" isCollapsed="false" >}}
<a href="/img/posts/dockerFileGithubAction/githubActionDiagram.png"><img src="/img/posts/dockerFileGithubAction/githubActionDiagram.png" alt="Diagram of the GitHub workflow" loading="lazy" class="center"></a>
{{< /collapsable-box >}}

## How to set it up

First you need to enable Dependabot for the repository. Follow these four steps (lifted wholesale from [GitHub Docs](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuring-dependabot-version-updates#enabling-dependabot-version-update)):

1. On GitHub.com, navigate to the main page of the repository.
2. Under your repository name, click Settings. If you cannot see the "Settings" tab, select the dropdown menu, then click Settings.
3. In the "Security" section of the sidebar, click Code security and analysis.
4. Under "Code security and analysis", to the right of "Dependabot version updates", click "Enable" to open a basic ``dependabot.yml`` configuration file in the .github directory of your repository.

Then replace the default config with the below.

{{< code language="yaml" title="dependabot.yml" expand="Show" collapse="Hide" isCollapsed="false" >}}
version: 2
updates:
  - package-ecosystem: "docker"
    # Change if your Dockerfile is not stored in repository root
    directory: "/" 
    schedule:
      interval: "daily"
    # Change to match your branch name
    target-branch: "develop"
  
  - package-ecosystem: "github-actions"
    directory: "/" 
    schedule:
      interval: "weekly"
    # Change to match your branch name
    target-branch: "develop"
    # Groups multiple action updates into single PR if all are minor or patch
    groups:
      github-action-dependencies:
        update-types:
          - "minor"
          - "patch"
{{< /code >}}

From the flow diagram shown above, you can see that the workflow reads in the pre-existing [Git tag](https://git-scm.com/book/en/v2/Git-Basics-Tagging) to determine what version to tag the newly built image. So if your repository doesn't already utilise tags, add a suitable one. Follow the [SemVer syntax](https://semver.org/) of MAJOR.MINOR.PATCH. If you use Git CLI you can do this as follows:

{{< code language="Git" title="Add annotated Git tag" expand="Show" collapse="Hide" isCollapsed="false" >}}
git tag -a 1.0.0 -m "Add a tag message here"
{{< /code >}}

More prep before adding the GitHub Action workflow, you need to set up your Docker Hub access credentials. For that you need to generate an Access Token.
- Log in to Docker Hub and navigate to ["My Account"](https://hub.docker.com/settings/general).
- Click on "Security", and then on "New Access Token".
- Give an appropriate description, leave permissions as "Read, Write, Delete", and click "Generate".

This token is only displayed once, but if you lose it before saving to your GitHub repository secrets you can always delete and generate another. Now to securely add the token to your GitHub repository:
- Navigate again to your repository and click on the "Settings" tab.
- Under "Security" click on "Secrets and variables", and click on "Actions".
- Click "New repository secret", under Name enter DOCKERHUB_PASSWORD, under Secret paste in your new access token, click "Add secret"
- Click "New repository secret" again, this time name it DOCKERHUB_USERNAME, and under Secret enter your Docker Hub username, click "Add secret".

Now you can add the workflow config file. 
- Navigate to the .github directory in the root of your repository and create a new directory called ["workflows"](https://github.com/mpdcampbell/traefik-geoip-filter/tree/main/.github).
- In the workflows directory, add the below .yml file.

{{< code language="yaml" title="approve-merge-build-push.yml" expand="Show" collapse="Hide" isCollapsed="false" >}}
name: Approve merge build tag push

on: pull_request_target

permissions:
  pull-requests: write
  contents: write

jobs:
  merge-dependabot-pr:
    runs-on: ubuntu-22.04
    if: ${{ github.actor == 'dependabot[bot]' }}
    steps:
      - name: Dependabot metadata
        id: dependabot-metadata
        uses: dependabot/fetch-metadata@v1.6.0
        with:
          github-token: "${{ secrets.GITHUB_TOKEN }}"

      - name: Approve the PR
        run: gh pr review --approve "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Auto-merge non-major PRs
        if: ${{ steps.dependabot-metadata.outputs.update-type != 'version-update:semver-major' }}
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build-push-image:
    runs-on: ubuntu-22.04
    needs: merge-dependabot-pr
    if: github.event.pull_request.user.login == 'dependabot[bot]'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get changed Dockerfile
        id: changed-files-specific
        uses: tj-actions/changed-files@v41.0.1
        with:
          files: |
            Dockerfile

      - name: Log in to Docker Hub
        if: steps.changed-files-specific.outputs.any_changed == 'true'
        uses: docker/login-action@v3
        with:
          username: "${{ secrets.DOCKERHUB_USERNAME }}"
          password: "${{ secrets.DOCKERHUB_PASSWORD }}"

      - name: Get previous tag
        if: steps.changed-files-specific.outputs.any_changed == 'true'
        id: previoustag
        uses: "WyriHaximus/github-action-get-previous-tag@v1"
        env:
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
      
      - name: Get next version tag
        if: steps.changed-files-specific.outputs.any_changed == 'true'
        id: semvers
        uses: "WyriHaximus/github-action-next-semvers@v1"
        with:
          version: ${{ steps.previoustag.outputs.tag }}
      
      - name: Update tag
        if: steps.changed-files-specific.outputs.any_changed == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.git.createRef({
              owner: context.repo.owner,
              repo: context.repo.repo,
              ref: 'refs/tags/${{ steps.semvers.outputs.patch }}',
              sha: context.sha
            })

      - name: Build and push Docker image
        if: steps.changed-files-specific.outputs.any_changed == 'true'
        id: build-and-push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            username/repository-name:${{ steps.semvers.outputs.patch }}
# Substitute in your Docker Hub repository e.g. mpdcampbell/traefik-geoip-filter
{{< /code >}}

And you're done!

## How to manually trigger the workflow

If something goes wrong and you need to debug, or if you want to test changes to the file, it's useful to be able to manually trigger the approve-merge-build-push.yml workflow. 
1. Navigate to your repository and click on the "Insights" tab.
2. Click on "Dependency graph" and then on "Dependabot".
3. Click on "Recent update jobs" beside the approve-merge-build-push.yml filename.
4. Click on "Check for updates". 

You can use the same approach to manually trigger a Dependabot Dockerfile check outside the daily schedule.

## Acknowledgement

The "merge-dependabot-pr" job in the GitHub action workflow was sourced from this [detailed blog post](https://blog.somewhatabstract.com/2021/10/11/setting-up-dependabot-with-github-actions-to-approve-and-merge/) by Jeff Yates.