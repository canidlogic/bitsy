# Bitsy Encoding Specification

Bitsy is a method for encoding case-sensitive, Unicode file names in environments that might be case insensitive or not reliably support Unicode.

## Exceptional file name encoding

If the file name is the special file name `.` or `..` then the Bitsy encoding is exactly the same as the input.

Skip the rest of encoding if any exceptional file name is encountered.

## Unicode normalization

Any surrogate pairs that are present in the input file name are replaced by the supplemental codepoint they select.  Surrogates that do not form a proper surrogate pair cause Bitsy encoding to fail.

After surrogates have been corrected to supplementals, the whole input file name is run through NFC Unicode normalization.

## Control code and separator filtering

Input file names are not allowed to have any C0 control codes.  Specifically, this is U+0000 up to and including U+001F, as well as the codepoint U+007F.  Bitsy encoding fails if any of these control codes is present in the input file name.

Input file names are not allowed to have forward slash `/` (U+002F) or backslash `\` (U+005C).  Both these characters are interpreted as path separators in Windows/DOS environments, and allowing them to be escaped would be a possible security risk.  UNIX technically would allow backslash in file names, but it is a bad idea not only for interoperability but also because backslash is frequently an escape symbol.

## File extension identification

The first step in Bitsy encoding after handling exceptional names is to split the file name into a _label_ and an _extension._  The only purpose of this split is to determine where to place suffixes at the end of the encoding process.  Suffixes will be placed at the end of the label and before the extension, so as to leave file extensions as intact as possible.  However, apart from that detail, the whole file name is encoded as a single string; labels and extensions are _not_ encoded separately.

__Case 1:__  There is no ASCII period character `.` in the file name anywhere.

The whole file name is the label and the extension is an empty string in this case.

__Case 2:__  There is only one ASCII period character in the file name and it is the first character.

The whole file name is the label and the extension is an empty string in this case.  The special file name `.` was handled earlier as an exceptional file name, so this case will never be applied to it.  On UNIX systems, a period at the start of a file name indicates a hidden file rather than an extension.

__Case 3:__ General case.

In all other cases, the following procedure is used.  Starting at the last character of the file name and moving to the _second_ character of the file name, identify a sequence of zero or more _extension components._  An extension component is a period followed by a sequence of one or more _extension characters,_ so when scanning backwards an extension component will be a sequence of one or more extension characters followed by a period.

Extension characters are: all ASCII alphanumeric characters and ASCII underscore.  ASCII hyphen is _not_ included so that encoded delta suffixes (defined later) will not accidentally be confused as an extension.

The extension in this case will be the period that begins the sequence of extension components, and the label will be everything before the extension.  Since the first character of the file name is excluded from extension component scanning, the label will always have at least one character in it.  However, the extension may end up being empty in this general case if there is not a single valid extension component at the end of the file name.

## Device name escaping

Let the _device candidate_ be a substring that is either the whole file name if the file name includes no period characters, or the substring up to but excluding the first period otherwise.  The device candidate is _not_ necessarily the same as the label found in the previous step &mdash; for example, the file name `three...dots` will have the label `three..`, the extension `.dots`, and the device candidate `three`  The device candidate might also be an empty string.

If the device candidate is a _case-insensitive_ match for any of the following, then _device name escaping_ is required:

- `AUX`
- `COM1` `COM2` ... `COM9`
- `CON`
- `LPT1` `LPT2` ... `LPT9`
- `NUL`
- `PRN`

Device name escaping is not performed right away.  Instead, a flag is set indicating that it is required.  At the end of Bitsy encoding, a check is made whether device name escaping is set __and__ no Bitsy escape prefix has been added yet.  If this is the case, then a Bitsy escape `xd--` is prefixed to the file name.  If some other Bitsy escape prefix is already present at the end of encoding, then nothing is requried for device escaping.

Device escaping works around an issue on Windows/DOS systems, where file names that begin with one of these special names are reinterpreted as naming a device rather than a file.  Device name escaping prevents this by adding the special `xd--` prefix.  When decoding a Bitsy name, an `xd--` prefix just needs to be dropped to get back the original name.

## Point substitution

The first transformation that is done during Bitsy encoding is _point substitution._  Each ASCII period character `.` within the file name is either a _proper point_ or a _problem point._  Period characters that are followed by another period character are problem points, and a period character occuring as the last character within a file name is also a problem point.  All other periods are proper points.

During point substitution, all problem points are replaced by the ASCII control code `SUB` (U+001A).  Proper points are left as-is.

A point that begins a file extension (defined earlier) will never be a problem point, because it will always be followed by a character that is not another point.

During decoding, `SUB` characters will be replaced by ASCII periods to get back the original string.  Windows/DOS systems don't like file names that end with periods, and multiple periods in a row can be iffy, which is why they are substituted.

The special `.` and `..` file names are not affected by point substitution because they were handled as exceptional cases earlier.

## Casing conversion

The second transformation that is done during Bitsy encoding is _casing conversion._  The _casing state_ starts out as lowercase.  Whenever an ASCII letter character is encountered, check whether its case matches the casing state.  If the case matches, then nothing is done with that letter.  If the case does not match, then a _casing control_ is inserted before the letter.  The following casing control codes are supported:

- `ESC` (U+001B): invert case for one letter
- `SI` (U+000F): switch to uppercase
- `SO` (U+000E): switch to lowercase

If the ASCII letter that has a different case is followed by at least one more ASCII letter with that same case, use either `SI` or `SO` co change the casing state to match the new sequence of letters.  Otherwise, use `ESC` to indicate the case is inverted from the casing state just for this one letter.

Casing conversion only applies to ASCII letters.  Letters in Unicode range are ignored during this conversion, since they will be encoded numerically.  Casing conversion is necessary only for ASCII letters because ASCII letters are literal in the Bitsy encoding and therefore might lose their case in case-insensitive file name environments.  Casing control codes ensure that the original case of all the ASCII letters can always be recovered.

## ASCII masking

The third transformation that is done during Bitsy encoding is _ASCII masking._  This masking transformation drops any ASCII codes that are not "safe" from the file name and generates a sequence of encoded deltas that can be used to reconstruct the dropped codes.  This transformation does not affect Unicode codepoints (codepoints U+0080 and above).

The following table maps all of the "unsafe" ASCII characters to a unique integer index.  This table includes the special control codes that were generated during the previous point substitution and casing conversion steps:

     Index | Codepoint |    Unsafe character
    -------+-----------+-------------------------
        0  |   U+0020  | SP (space)
        1  |   U+001B  | ESC (invert ASCII case)
        2  |   U+000F  | SI (switch to uppercase)
        3  |   U+000E  | SO (switch to lowercase)
        4  |   U+001A  | SUB (problem point)
        5  |   U+003A  | Colon (:)
        6  |   U+003F  | Question mark (?)
        7  |   U+0022  | Double quote (")
        8  |   U+002A  | Asterisk (*)
        9  |   U+003C  | Less than (<)
       10  |   U+003E  | Greater than (>)
       11  |   U+007C  | Vertical bar (|)

The unsafe characters in the table above are roughly sorted so that characters which probably occur more frequently within file names are earlier in the order.

The encoding into deltas uses the same Bootstring algorithm that is behind Punycode.  However, for the ASCII masking stage, the `initial_n` parameter of Bootstring is zero, and encoded codepoint `n` values are for the index values in the unsafe characters table above, rather than corresponding to Unicode codepoints.  Also, the `damp` parameter for Bootstring is dropped from 700 to 2, effectively turning off dampening.  (Dampening optimizes the Punycode case for when there is an initial large delta skip to a Unicode block, and then remaining deltas stay within that block; the limited `n` values used during ASCII masking makes for a much less compelling case.)  The `base`, `tmin`, `tmax`, `skew`, and `initial_bias` parameters of Bootstring are left the same as they are for Punycode.

At the end of this transformation, all "unsafe" ASCII characters will have been dropped, and there will be an encoded ASCII masking string, which may be empty if there were no "unsafe" ASCII characters present.

## Punycode transformation

After ASCII masking has dropped all unsafe ASCII characters, the whole file name string is run through the Bootstring algorithm again, except this time dropping all codepoint values of U+0080 or greater and generating an encoded delta string using the exact same Bootstring parameters as for Punycode.  The encoded delta string may be empty if there are no codepoint values of U+0080 or greater within the string.

## Prefixation

The last encoding stage is _prefixation._  There are the following cases:

__Case 1:__  ASCII masking delta string is not empty and Punycode delta string is not empty.

The string `xp--` is prefixed to the whole file name.  After the label but before the extension, there is a hyphen followed by the ASCII masking delta string, and then a hyphen followed by the Punycode delta string.

__Case 2:__  ASCII masking delta string is not empty but Punycode delta string is empty.

The string `xa--` is prefixed to the whole file name.  After the label but before the extension, a hyphen followed by the ASCII masking delta string is added.

__Case 3:__  ASCII masking delta string is empty but Punycode delta string is not empty.

The string `xn--` is prefixed to the whole file name.  After the label but before the extension, a hyphen followed by the Punycode delta string is added.

__Case 4:__ ASCII masking delta string and Punycode delta string are both empty, but device name escaping flag is set.

The string `xd--` is prefixed to the whole file name.

__Case 5:__ ASCII masking delta string and Punycode delta string are both empty, and device name escaping flag is clear.

Check whether the start of the file name is a case-insensitive match for `X#--` where `#` is any ASCII letter.  If there is such a match, take the 2nd letter (the `#` in the pattern above), prefix a hyphen to it, and add this after the label but before the extension.  Then, replace the first two characters of the file name with `xx` so that the file name begins with the prefix `xx--`

If such a match does not exist, then the file name needs no prefix or suffix.

## Decoding

The decoding process takes a file name that has been encoded with Bitsy and gets the original file name back (after normalization).

The decoding process begins by checking for one of the following four-character prefixes at the start of the file name (matching is case-insensitive):

- `xa--` (ASCII masking)
- `xd--` (Escaped device name)
- `xn--` (Punycode)
- `xp--` (ASCII masking and Punycode)
- `xx--` (Escaped prefix)

If none of these prefixes is present, then the file name should only contain ASCII characters.  The original file name in this case has any ASCII letters converted to lowercase.

For the escaped device name prefix `xd--` you must drop this prefix and then convert any ASCII characters to lowercase.  There should only be ASCII characters in the rest of it.

For the escaped prefix prefix `xx--` first drop the prefix.  Then, split the file name into label and extension, as discussed earlier.  The last two characters of the label should be a hyphen followed by an ASCII letter.  Add a prefix `x#--` to the file name where `#` is replaced by the lowercase version of the ASCII letter at the end of the label, then drop the last two characters of the label, and finally convert all ASCII letters to lowercase to get the original file name back.

The other three escapes select either ASCII masking or Punycode or both.  Begin by dropping the prefix.  Then, split the file name into label and extension, as discussed earlier.  At the end of the label are encoded delta suffixes for reversing the ASCII masking and/or Punycode transformation, each delta suffix string being prefixed with a hyphen.  When ASCII masking and Punycode are used at the same time, the ASCII masking delta suffix precedes the Punycode suffix.  Store the delta suffix(es) and then drop the suffix(es) from the end of the label.  Rejoin the trimmed label and the extension.  Decode Punycode and/or ASCII masking; if both are specified, Punycode is decoded first.  Finally, if ASCII masking was decoded, convert `SUB` control codes back to period characters, and correct the case of all ASCII letters by using the casing state and `SI` `SO` and `ESC` controls as described earlier, dropping these control codes after casing has been corrected.  If no ASCII masking was decoded, convert the case of all ASCII letters to lowercase.
