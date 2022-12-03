+++
title = "Rebuild files from a local Sharry database"
date = "2022-11-20"
keywords = ["sharry", "bash", "MIME type", "selfhost"]
description = "tl;dr: [Sharry](https://github.com/eikek/sharry#readme) is a selfhost file upload-download service, it supports grouped uploads of hundreds of files, but only individual file downloads. This [bash script](https://github.com/mpdcampbell/sharry-chunk-combiner#readme) combines the chunks in the database to quickly rebuild local copies of the files." 
+++

> tl;dr: [Sharry](https://github.com/eikek/sharry#readme) is a selfhost file upload-download service, it supports grouped uploads of hundreds of files, but only individual file downloads. This [bash script](https://github.com/mpdcampbell/sharry-chunk-combiner#readme) combines the chunks in the database to quickly rebuild local copies of the files.

## Why make this?
I got married and wanted a selfhost solution for our friends and family to upload photos and videos. A fair amount of guests were [not computer people](https://xkcd.com/627/) so the file uploading process needed to be as user friendly as possible, in particular on mobile. [Sharry](https://github.com/eikek/sharry) fit the bill, authenticated users can generate custom urls and anyone with the url can upload files but not view them. However there was major one flaw for my use case, users can upload huge number of photos at once but you can only download the files individually. The creator [plans to add](https://github.com/eikek/sharry/issues/907) "Download as zip" as a feature, but not for at least a year.

I didn't want to spend 20-ish minutes clicking download a hundreds of times when I knew all the data was already on my server. So instead I spent several hours writing a bash script to cat the data chunks and assign the file extensions.

## How does it work?
Sharry can be [configured](https://eikek.github.io/sharry/doc/configure) to store the files in several different formats: local filesystem, S3 storage or an SQL database. By default the files are stored in the H2 database (an SQL db) used for the service backend, but I had my instance configured to use the local filesystem. Sharry breaks each file up into binary chunks and saves them as numbered files in individual directories, as shown below.  

{{< code language="shell" title="Database file structure" expand="Show" collapse="Hide" isCollapsed="false" >}}
$:~/sharryDatabase$ ls
14  2u  3m  4M  5b  66  6T  7P  8G  9B  9v  AN  bb  BR  Ci  DF  DY  EX  Fm  G8  h2
21  2U  3p  4p  5d  6A  6U  7q  8i  9C  9W  Ap  BB  Bs  CJ  DG  E5  EY  FN  G9  H2
$:~/sharryDatabase$ find 14
14
14/14Z5vVuqbDk-faqbApMaszR-jYD2tTVJFh9-WmXNkP193dx
14/14Z5vVuqbDk-faqbApMaszR-jYD2tTVJFh9-WmXNkP193dx/chunk_00000002
14/14Z5vVuqbDk-faqbApMaszR-jYD2tTVJFh9-WmXNkP193dx/chunk_00000003
14/14Z5vVuqbDk-faqbApMaszR-jYD2tTVJFh9-WmXNkP193dx/chunk_00000000
14/14Z5vVuqbDk-faqbApMaszR-jYD2tTVJFh9-WmXNkP193dx/chunk_00000001
14/14Z5vVuqbDk-faqbApMaszR-jYD2tTVJFh9-WmXNkP193dx/chunk_00000004
{{< /code >}}

Sometimes there are branching midlevel directories, but the chunks are always in the lowest level directory. 

By concatenating the chunks in numerical order, you get a copy of the original file, just without the filename or file extension. Filename is a lost cause; well depending on the file type you could potentially assign a meaningful name from the metadata, but this script doesn't. For my use case of photos and videos, the gibberish filenames [aren't important anyway.](https://xkcd.com/349/) Newly combined files are just assigned numerically ordered names, e.g. file_001. Though to make myself feel better, the number of [padded zeroes](https://github.com/mpdcampbell/sharry-chunk-combiner/blob/84588037c139b506210183a3e65e51ca068ba0d5/chunkCombiner.sh#L81) scales with the number of files to be recombined. 

To figure out what the new file actually is, the script uses the following [file command:](https://manpages.ubuntu.com/manpages/focal/en/man1/file.1.html)

```file -b --mime-type combinedChunks```  

 to identify the MIME type, e.g image/jpeg. 
 
 This is compared to a [dictionary](https://www.delftstack.com/howto/linux/bash-associative-array/) of MIME-type|file-extension key|value pairs to get the corresponding file extension. The dictionary is saved in a large [text file](https://github.com/mpdcampbell/sharry-chunk-combiner/blob/master/extByMimeType.txt) that read in by the script, the values for which were taken from this [helpful list](https://www.freeformatter.com/mime-types-list.html). The dictionary is probably not complete, running tests on random files I found some missing MIME type/sub-type combinations I had to manually add, but at 705 entries it should cover most files. If the file extension is found it is appended to the name of the newly combined file, and the file is moved to the designated output directory.

## How do you use it?
The [script](https://github.com/mpdcampbell/sharry-chunk-combiner/blob/master/chunkCombiner.sh) and [dictionary](https://github.com/mpdcampbell/sharry-chunk-combiner/blob/master/extByMimeType.txt) files need to be saved within the same directory, then the script can be ran with the following arguments:

```./chunkCombiner.sh -d sharryDatabase -o outputDirectory```

See below for an example of the script running, showing the newly combined files in the output directory.

![script demo](/img/posts/sharryFileRebuilder/scriptDemo.gif)

The optional ```-h``` flag will show the help readout, shown below.
{{< code language="shell" title="chunkCombiner.sh -h readout" expand="Show" collapse="Hide" isCollapsed="false" >}}
Usage: chunkCombiner.sh [-d -o -h]
  Mandatory Flags.
    -d    Path to Sharry filesystem database directory.
    -o    Path to directory to output rebuilt files.
  Other Flags.
    -h    Show usage.
{{< /code >}}