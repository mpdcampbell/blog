+++
title = "Self-hosted grammar & spellcheck with LanguageTool"
date = "2023-09-23"
description = "tl;dr: [LanguageTool](https://github.com/languagetool-org/languagetool#languagetool) offer an open source Grammarly alternative, but with some closed source elements you need to avoid. This post explains how to set up and use a fully open source instance, and what it's limitations are."
+++

> tl;dr: [LanguageTool](https://github.com/languagetool-org/languagetool#languagetool) offer an open source Grammarly alternative, but with some closed source elements you need to avoid. This post explains how to set up and use a fully open source instance, and what it's limitations are. 

## Contents
- [What parts are closed source?](#what-parts-are-closed-source)
- [What's wrong with using closed source bits?](#whats-wrong-with-using-closed-source-bits)
- [What extensions are open source then?](#what-extensions-are-open-source-then)
- [How to set up LanguageTool in Docker?](#how-to-set-up-languagetool-in-docker)
- [Connect LibreOffice to your LanguageTool server](#connect-libreoffice-to-your-languagetool-server)
- [Connect VS Code to your LanguageTool server](#connect-vs-code-to-your-languagetool-server)
---

## What parts are closed source?
LanguageTool works as a central server that takes in text via [HTTP requests](https://languagetool.org/http-api/swagger-ui/#/default), checks the text, and returns grammar and spelling suggestions. That central server component is open source and that is what you can self-host. But the incoming HTTP requests, those are sent from extensions that you add to whatever program it is you're typing in, and most of the extensions are closed source.

#### _All the LanguageTool browser extensions are closed source._

For [years](https://github.com/languagetool-org/languagetool-browser-addon) now, all the official LanguageTool browser extensions have been completely closed source, and the team have [confirmed](https://github.com/languagetool-org/languagetool-browser-addon/issues/247) they have no plans to open-source them again. This greatly reduces the utility of LanguageTool as a FOSS solution, as you can't use it in the browser where I do the majority of my typing.

#### _All the LanguageTool email plugins are closed source._

The official email plugins are also closed source but, if you are using Gmail, Apple Mail or Outlook you might not care. Your closed source email provider is already parsing everything, so what's one more set of eyeballs. But Mozilla Firebird is an open source client, giving a closed source plugin access to read everything you type somewhat undoes the point.

#### _Some LanguageTool office plugins are closed source._

The extensions for Google Docs, Microsoft Word and Apple pages are all closed source, but so are the office packages themselves, so this isn't really an issue. Unless you trust [Google, Microsoft, and Apple](https://xkcd.com/1118/) more than you trust LanguageTool. 


## What's wrong with using closed source bits?
For LanguageTool specifically, it is described online as an open source solution. And typically people who go to the hassle of self-hosting care about the privacy assurances that open source solutions bring. So, it is important to understand that in this case mainly the core is open source and that using the wrong extension makes this a closed source solution.

## What extensions are open source then?
For official extensions from LanguageTool, only the plugins for the open source word processors [OpenOffice](https://extensions.openoffice.org/project/languagetool) and [LibreOffice](https://help.libreoffice.org/latest/en-GB/text/shared/optionen/languagetools.html?DbPAR=SHARED#bm_id501673477245967). In the case of LibreOffice, the plugin is actually built in to the word processor by default. You just need to set it up.

For unofficial extensions, the main one I use is [LTeX for VS Code](https://github.com/valentjn/vscode-ltex), but [searching GitHub](https://github.com/search?q=languagetool&type=repositories) there are many more, including [Vim](https://github.com/search?q=vim+languagetool&type=repositories) and [Emacs](https://github.com/search?q=emacs+languagetool&type=repositories). 

## How to set up LanguageTool in Docker?
You can [run it raw](https://dev.languagetool.org/http-server) on your server, but [everything I host](https://github.com/mpdcampbell/selfhosted-services) is running in Docker containers, so I opted to deploy LanguageTool within Docker. 

The LanguageTool team suggest two other [Docker files](https://github.com/languagetool-org/languagetool#docker), but I recommend this [Docker file](https://github.com/meyayl/docker-languagetool) as it has a few benefits:
- Dependencies look to be actively updated.
- Automatically downloads and sets up [n-grams.](https://dev.languagetool.org/finding-errors-using-n-gram-data.html)
- Automatically downloads and sets up [fasttext](https://github.com/facebookresearch/fastText/) (for language detection).
- Allows log level to be set as an environment variable.

Copy the docker-compose.yml file outlined below.

{{< code language="yaml" title="docker-compose.yml" expand="Show" collapse="Hide" isCollapsed="false" >}}
services:
  languagetool:
    image: meyay/languagetool
    container_name: languagetool
    restart: unless-stopped
    ports:
      - ${LANGUAGETOOL_PORT}:8010
    environment:
      download_ngrams_for_langs: en
      langtool_languageModel: /ngrams
      langtool_fasttextModel: /fasttext/lid.176.bin
    volumes:
      - ${LANGUAGETOOL_DIR}/ngrams:/ngrams
      - ${LANGUAGETOOL_DIR}/fasttext:/fasttext
{{< /code >}}

There are a couple of bash alias's in the above docker-compose, you either need to replace these with your own values or add the alias to your systems .env file:
- **${LANGUAGETOOL_PORT}** is the port on which the server will listen for HTTP requests, e.g. 8010.
- **${LANGUAGETOOL_DIR}** is a directory path, set this to wherever you want to store the LanguageTool related files. The n-grams zip is a substantial 15Gb so make sure wherever you chose has room. 

Once the docker-compose.yml file has been changed, you can start up the LanguageTool server. 

{{< code language="bash" title="Start up the container" expand="Show" collapse="Hide" isCollapsed="false" >}}
#If in same directory as the docker-compose.yml file
#The -d flag starts the containers up in the background, so they aren't running in the terminal.
docker-compose up -d

#If in a different directory you can use the -f flag to point to docker-compose.yml 
docker-compose -f PATH_TO_FILE/docker-compose.yml up -d
{{< /code >}}

The initial start-up is quite slow as it has to download the 15Gb of n-grams data, you can track the download progress with the below command.

{{< code language="bash" title="Show container logs" expand="Show" collapse="Hide" isCollapsed="false" >}}
docker logs -f languagetool
{{< /code >}}

When the start-up looks completed, you can test it by opening a browser and visiting the servers listen port. So for example if your server IP address is 192.168.1.23 and if you picked 8010 for the value of ${LANGUAGE_PORT}, go to ``https://192.168.1.23:8010``.

You should see a blank page with the following message.

``Error: Missing arguments for LanguageTool API. Please see https://languagetool.org/http-api/swagger-ui/#/default``

Congratulations, your LanguageTool server is working! But it isn't much use without some extensions to send it text for checking, so let's add some of those. 

## Connect LibreOffice to your LanguageTool server

Open LibreOffice Writer and press Alt + F12 to open the tool options. You should see the below window.

{{< collapsable-box contentType="Screenshot" title="Tool -> Options" expand="Show" collapse="Hide" isCollapsed="false" >}}
<img src="/img/posts/languageTool/languageSettings.png" alt="Screenshot of the tool options window in LibreOffice" loading="lazy">
{{< /collapsable-box >}}

Ignore the external server warning, we will fix that, and click "Enable LanguageTool".

{{< collapsable-box contentType="Screenshot" title="Adding LanguageTool server URL" expand="Show" collapse="Hide" isCollapsed="false" >}}
<img src="/img/posts/languageTool/baseUrl.png" alt="Screenshot of the languageTool menu in LibreOffice" loading="lazy">
{{< /collapsable-box >}}

In the "Base URL" field, enter the URL to the LanguageTool listen port and add "/v2". So for example if your server IP address is 192.168.1.23 and if you picked 8010 for the value of ${LANGUAGE_PORT}, enter ``http://192.168.1.23:8010/v2``. And click apply. 

Next, click on "Writing Aids" and check that under "Available Language Modules" the only activated grammar checker is "LanguageTool Remote Grammar Checker". Untick any other grammar checkers as they will conflict. 

{{< collapsable-box contentType="Screenshot" title="Selecting grammar checker" expand="Show" collapse="Hide" isCollapsed="false" >}}
<img src="/img/posts/languageTool/writingAids.png" alt="Screenshot of the writing aids menu in LibreOffice" loading="lazy"> 
{{< /collapsable-box >}}

And you're done. To check it is working you can try typing the following phrase:  
``Are human beings any different than animals?``

## Connect VS Code to your LanguageTool server

Open VS Code, press Ctrl + Shift + X to open the extension menu, and search for the "LTeX" extension. 

{{< collapsable-box contentType="Screenshot" title="The LTeX extension" expand="Show" collapse="Hide" isCollapsed="false" >}}
<img src="/img/posts/languageTool/ltexExtension.png" alt="Screenshot of the LTeX extension in VS Code" loading="lazy">
{{< /collapsable-box >}}

When you find the LTeX extension, click install. Once installed, click on the little settings cog and open "Extension Settings".

{{< collapsable-box contentType="Screenshot" title="Settings cog -> Extension settings" expand="Show" collapse="Hide" isCollapsed="false" >}}
<img src="/img/posts/languageTool/settingsCog.png" alt="Screenshot of the settings cog menu" loading="lazy">
{{< /collapsable-box >}}

The LTeX settings will open, scroll down to "Ltex: Language Tool Http Server Uri".

{{< collapsable-box contentType="Screenshot" title="Adding the LanguageTool server URL" expand="Show" collapse="Hide" isCollapsed="false" >}}
<img src="/img/posts/languageTool/ltexServerUri.png" alt="Screenshot of the Server URI setting." loading="lazy">
{{< /collapsable-box >}}

In the Http Server Uri field, enter the URL to the LanguageTool listen port. So for example if your server IP address is 192.168.1.23 and if you picked 8010 for the value of ${LANGUAGE_PORT}, enter ``http://192.168.1.23:8010``. Close the LTeX settings.

And you're done! To check if it is working, open a markdown file and try typing the following phrase: ``Are human beings any different than animals?``