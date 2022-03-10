# StrictName file name specification

A _StrictName_ is a file name that follows a strict set of constraints designed to make it highly portable to many different environments.

However, a StrictName does not work on _all_ environments.  In particular, the 8.3 constraint from DOS and the ISO 9660 file system standard for optical discs are even stricter.  The 8.3 constraint and the ISO 9660 standard are so strict that their usefulness is limited, especially since their extreme constraints on the lengths of file names prohibit most forms of escaping.  In both cases, the standards can be seen as historic.  The 8.3 constraint on DOS was loosened already with Windows 95, and the ISO 9660 standard has long since been extended with the likes of Joliet, which relaxes the extreme constraints.

The file name character set for StrictName is derived from &sect;5 "Base 64 Encoding with URL and Filename Safe Alphbet" in RFC 4648.  This character set includes all US-ASCII alphanumeric characters, as well as hyphen (`-`) and underscore (`_`).  StrictName also adds the US-ASCII period character (`.`), which is mentioned in that RFC section but not included there because it has special restrictions in many file systems (which StrictName takes into account).  StrictName adds the additional stipulation that US-ASCII letters are case insensitive, and so one can not depend on the case of any letter being preserved.  The resulting StrictName character set is as follows:

> __Constraint 1:__ StrictName may only contain the following US-ASCII characters:
>
> (1) Letters `A-Z` and `a-z`<br>
> (2) Digits `0-9`<br>
> (3) Hyphen `-`<br>
> (4) Underscore `_`<br>
> (5) Period `.`
>
> __Constraint 2:__ Letters in StrictName are case insensitive.  You may use both uppercase and lowercase letters, but the case of each letter is not guaranteed to be preserved.

The hyphen and period have additional constraints.  Hyphen used alone is often a shorthand for using a standard input or output stream instead of a file, and hyphen used at the beginning of a name can easily be confused with an option declaration when used on a command line.  StrictName follows the constraints established by the Domain Name System (DNS) regarding hyphens in RFC 1035 &sect;2.3.1, which requires that labels neither begin nor end with hyphen.  Within a file name, a "label" is interpreted with period characters used as internal delimiters, leading to the following constraints for hyphens:

> __Constraint 3:__ Neither the first nor the last character in a StrictName may be a hyphen.
>
> __Constraint 4:__ A hyphen may occur neither immediately before nor immediately after a period character within a StrictName.

The period character has traditionally been used to separate file names into a name component and a file extension component, where the file extension component indicates the format of data stored within the file.  Early standards such as the 8.3 standard on DOS and the ISO 9660 standard for optical media only allowed a single period within a file name that was used to add an extension, and generally disallowed periods entirely for directory names.  This earlier standard is too restrictive for modern systems.  First, a sequence of multiple extensions to indicate encodings is now generally accepted, with `.tar.gz` being one of the best known examples.  Second, directory names may end up having extensions, especially in virtual file systems, where for example a CGI script file appears as a "directory" within a path.  Third, UNIX systems have a convention of using a name beginning with a period character to indicate a hidden file.

Also, there is an exception dating back to some of the earliest systems, where the names `.` and `..` are allowed even if they would otherwise be illegal in syntax.  These names refer to the current directory and the parent directory, respectively.

The following constraints establish the StrictName policies regarding period characters:

> __Constraint 5:__ Except for the special names `.` and `..` the last character in a StrictName may not be a period.
>
> __Constraint 6:__ Except for the special name `..` no period within a StrictName may be followed immediately by another period.

In contrast to the hyphen and period symbols, the underscore has no constraints on its use.  Already in DOS systems you would encounter file extensions and name components beginning or ending with underscores to indicate compressed files.  The convention of many programming languages such as C in allowing underscore to be used in any way within identifiers, including at the beginning and at the end, further supports allowing underscores to be used in any position without constraint.

DOS and Windows systems consider certain name components to refer to device ports rather than files, even when these name components have a file extension attached.  Since the DOS/Windows conventions may be encountered in standards derived from those systems such as in Zip archives, it is generally a good idea to always avoid these special device names.  The following constraint prohibits the device names:

> __Constraint 7:__ Let the _device candidate_ be the whole name if there is no period, or otherwise the name up to but excluding the first period.  The device candidate in a StrictName may not be a case-insensitive match for any of the following:
>
> (1) `AUX`<br>
> (2) `COM0` `COM1` `COM2` ... `COM9`<br>
> (3) `CON`<br>
> (4) `LPT0` `LPT1` `LPT2` ... `LPT9`<br>
> (5) `NUL`<br>
> (6) `PRN`

Finally, there is the matter of the length constraint on the name.  The lower bound should be that there is at least one character.  The upper bound is more complicated.  As discussed earlier, the historic 8.3 length limit is too restrictive for modern applications.  On the Windows platform, the `MAX_PATH` constant enforces a limit on the total length of the path (rather than any limit on a specific name within the path), and `MAX_PATH` is traditionally set to 260 characters on Windows.

On UNIX systems, the limit for a file name length is given by the `NAME_MAX` constant.  The original POSIX standards only required 14 characters (based on the historic 8.3 scheme), but the X/Open System Interfaces Extension (XSI) boosted this requirement to at least 255 characters.  The 2nd edition of Stevens &amp; Rago's _Advanced Programming in the UNIX Environment_ (2005) indicates on page 48 that FreeBSD, Linux, Mac OS X, and Solaris 9 all have `NAME_MAX` set to this XSI requirement of 255, except that Mac OS X boosts `NAME_MAX` to 765, and Solaris 9 only supports a `NAME_MAX` of 8 when accessing FAT-formatted disks under the PCFS file system.

The two most popular archive formats should also be taken into account:  Zip and tar.  Zip files store file paths by specifying the file path length with a two-byte field and then storing the file path in a buffer using that declared length.  This theoretically allows for file names up to 65,535 characters long, but there is a recommendation in the Zip file documentation that the file name buffer within a directory record should not cause the whole directory record to exceed 65,535 bytes, so the actual limit is somewhat smaller than 65,535 characters.  tar files originally allowed only 100 characters for storing a file path, but this was extended in the widely-supported UStar format to allow for 255 characters per file path.

All of this indicates that 255 is a good choice for an upper boundary of a name length.  Note that within file paths, there is often a separate limit on the total length of a path, so using 255 characters for file names will quickly (or even immediately) cause the path limit to be exceeded.  Since StrictName is concerned with file names rather than file paths, path length constraints are not taken into account.

This leads to the following constraint on file name length:

> __Constraint 8:__ The length of a StrictName must be at least one character and at most 255 characters.

Note that due to the case-insensitive nature of StrictName, you should normalize all letters within a name to the same case before comparing two StrictNames for equality, and also when building indices of StrictName records.  However, even nominally case-insensitive platforms such as Windows will tend to preserve case as much as possible, so it is _not_ recommended to always flatten StrictName to a single letter case, but instead to leave letter case alone and take into account that letter case may change.
