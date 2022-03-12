# Bitsy Encoding Specification

Bitsy is a method for encoding case-sensitive, Unicode file names in environments that might be case insensitive or not reliably support Unicode.  It also works around a number of platform-specific quirks regarding file names.

The encoded Bitsy file name always follows the constraints documented in `StrictName.md`, such that it should work reliably on all modern platforms.  The original file name can be any sequence of Unicode codepoints, with only the following limitations:

> __Limitation 1:__ No ASCII control codes in range [U+0000, U+001F] nor the control code U+007F may be used.
>
> __Limitation 2:__ Neither forward slash `/` nor backslash `\` may be used, since those are conventionally reserved as path separator characters.
>
> __Limitation 3:__ Codepoints in surrogate range [U+D800, U+DFFF] are not allowed, but supplemental codepoints in range [U+10000, U+10FFFF] _are_ allowed.
>
> __Limitation 4:__ There must be at least one character in the file name.
>
> __Limitation 5:__ There must be at most 255 characters in the file name.

Bitsy is a technique for taking file names that obey only the above five limitations and encoding them such that they obey all the limitations in `StrictName.md`.  The encoding can then be used to reconstruct the original file name, including the original case of all letters even if the underlying file system is case-insensitive.

Bitsy encoding will fail if the encoded file name exceeds 255 characters.  This may happen even if the original file name satisfied all five limitations noted above.  Unfortunately, there is no easy way to know whether a file name will exceed this limit after encoding, apart from actually attempting the encoding.

## Pass-through encoding

If the Bitsy encoding is exactly the same as the original file name, then this particular original file name has _pass-through encoding._  Pass-through encoding is used when the original file name satisfies all the constraints in `StrictName.md` __AND__ both of the following extra constraints:

> __Extra constraint 1:__ If the original file name has any letters in it, all letters are lowercase.
>
> __Extra constraint 2:__ If the original file name has at least four characters, the first four characters are neither `xz--` nor `xq--`

If all the StrictName constraints and both these extra constraints are satisfied, then the Bitsy encoding of a file name is exactly the same as the original file name.  Skip all subsequent encoding steps in this case.

Example of pass-through encoding:

    example.txt (original) -> example.txt (Bitsy)

## Prefix encoding

If a given original file name satisfies all constraints for pass-through encoding __EXCEPT__ extra constraint 2, then _prefix encoding_ is used.  Since extra constraint 2 failed, the original file name in this case must have at least four characters, and the first four characters must be either `xz--` or `xq--`

Define the _suffix_ as `-z` or `-q` so that the letter in the suffix matches the second character of the original file name.  If there are no period characters in the file name, the suffix shall be added at the end of the file name.  Otherwise, the suffix shall be added immediately before the first period character.  (The first period character will never be the first character of the file name in prefix encoding, because prefix encoding is only used for file names that begin with `x`)

After the suffix is inserted, the second and final step in prefix encoding is to change the second letter of the file name to `q` if it is not already `q`

Prefix encoding will be used if a file name that is already encoded with Bitsy is encoded a second time with Bitsy.  It is also used for file names that happen to have a four-character prefix matching the one of the two four-character prefixes used by Bitsy.  Prefix encoding will fail if the two additional characters required for the suffix cause the length of the encoded file name to exceed 255 characters.

Examples of prefix encoding:

    xz--prefix.txt (original) -> xq--prefix-z.txt (Bitsy)
    xq--reflexive-q (original) -> xq--reflexive-q-q (Bitsy)

## Device encoding

If a given original file name satisfies all constraints for pass-through encoding __EXCEPT__ constraint 7 in `StrictName.md` then _device encoding_ is used.  This encoding is simply used to avoid reserved device names.

The first step is to add the suffix `-x` into the file name.  If the file name has any period characters, insert this suffix immediately before the first period in the file name; otherwise, append this suffix at the end of the file name.  (Since the file name is known to violate constraint 7 in this encoding case, the first character of the original file name will never be a period.)

The second and final step to this encoding is to insert the four-character prefix `xq--` at the start of the file name.  Bitsy encoding fails if either of these encoding steps causes the length of the encoded file name to exceed 255 characters.

Examples of device encoding:

    com2 (original) -> xq--com2-x (Bitsy)
    nul.txt (original) -> xq--nul-x.txt (Bitsy)

## General encoding procedure

If neither pass-through nor prefix nor device encoding can be used for a given original file name, then the general encoding procedure must be used.  The following subsections describe the encoding steps in the order they are performed.

### Unicode normalization

The first step of the general encoding procedure is to normalize the Unicode input.  First, make sure that the representation of supplemental codepoints is consistent.  Preferrably, supplemental codepoints are always encoded directly and no surrogates are present anywhere in the string.  On systems that do not support direct encoding of supplementals, make sure that all surrogates are properly paired.

Second, run the Unicode input through Unicode normalization to NFC form.  After these normalization steps are complete, check that the resulting normalized Unicode string is at most 255 codepoints long, failing if this limit has been exceeded.

Note that during the decoding process, the reconstructed original file name will be this normalized input form, _not_ the actual original string if the actual original string was not in normal form.

### Dot conversion

Initialize the _dot limit_ to the length of the input string after normalization.  Starting at the last ASCII period character in the file name and working backwards to the first, check whether each dot is a _proper_ dot.  A dot is _proper_ if when you take the substring that starts with that dot and runs to the end of the string, and then prefix the letter `a` to it, the result satisfies all the constraints in `StrictName.md`.  Each time you encounter a proper dot when running backwards in the string, update the dot limit to the index of the proper dot that was just located.  If you ever encounter a dot that is not proper, you may stop scanning backwards for further dots &mdash; do _not_ update the dot limit in this case.

After the proper dot limit has been determined through the method described above, go through the string from start to finish and replace any ASCII period characters that occur _before_ the dot limit with ASCII control code Record Separator (RS, U+001E).  Leave any dots at or beyond the dot limit as they are.

Also, if the first character is an ASCII period, it is _always_ changed to a RS control code, even if it is a proper dot.  File names that begin with a dot are used to represent hidden files on UNIX platforms, but these hidden files tend to have fixed names that should not be altered in any way.  In other words, pass-through encoding should always be used for these special hidden files.  Forcing hidden files to un-hide themselves if they are subject to the general encoding procedure of Bitsy can alert users of the potential problem rather than silently changing a hidden file name.

Dot conversion has the effect of converting any ASCII periods that are "problematic" into RS control codes while leaving alone any dots that may form part of a proper file extension at the end of the file name.  After this dot conversion step, if there are any ASCII periods that have not been turned into RS control codes, the first such period is always the start of the file extension.

The special `.` and `..` names are never subject to dot conversion, because those names are always handled with pass-through encoding.

### Note about hyphen constraints

It might seem that we need to be concerned about "problematic" hyphens that might violate constraint 3 or 4 in `StrictName.md`.  However, the dot conversion process has already guaranteed that hyphens within the string are valid.  This section gives the reason behind that guarantee.

The general encoding process will always add an `xz--` prefix to the start of the name at a later encoding stage.  Therefore, we never have to be concerned about the constraint that a hyphen may not be the first character of a StrictName.  Also, the general encoding process will always add a delta-encoded suffix prior to the file extension if present, or else to the end of the name.  We already know that any hyphens contained within the file extension are proper because this was verified during dot conversion.  The only hyphens that could be "problematic" would therefore occur before the delta-encoded suffix, so we never have to be concerned about the constraint that a hyphen may not be the last character of a StrictName.

The only hyphen-related constraint that remains to concern us is that a hyphen may occur neither immediately before nor immediately after a period character.  During the dot conversion process, however, any period characters that occurred before the file extension were converted to the RS control code, which will later be dropped and encoded in the delta suffix.  We therefore do not need to worry about constraint 4, either.

Therefore, the dot conversion process along with the Bitsy prefix and delta suffix that will be added later guarantee that all hyphens within the name will eventually satisfy the constraints.

### Casing conversion

After dot conversion, the next transformation that is done during Bitsy encoding is _casing conversion._  The _casing state_ starts out as lowercase.  Moving from the start of the string to the end, whenever an ASCII letter character is encountered, check whether its case matches the casing state.  If the case matches, then nothing is done with that letter.  If the case does not match, then a _casing control_ is inserted before the letter.  The following casing control codes are supported:

- `SUB` (U+001A): invert case for one letter
- `SI` (U+000F): switch to uppercase
- `SO` (U+000E): switch to lowercase

If the ASCII letter that has a different case is followed by at least one more ASCII letter with that same case, use either `SI` or `SO` co change the casing state to match the new sequence of letters.  Otherwise, use `SUB` to indicate the case is inverted from the casing state just for this one letter.

Casing conversion only applies to ASCII letters.  Letters in Unicode range are ignored during this conversion, since they will be encoded numerically.  Casing conversion is necessary only for ASCII letters because ASCII letters are literal in the Bitsy encoding and therefore might lose their case in case-insensitive file name environments.  Casing control codes ensure that the original case of all the ASCII letters can always be recovered.

If the inserted casing control codes cause the length of the string to exceed the limit of 255 characters, Bitsy encoding fails.

### Delta encoding

Once normalization, dot conversion, and casing conversion have been applied, the string is ready for delta encoding.  The delta encoding process is described in detail in `DeltaEncoding.md`.  The invariant character set includes only the characters listed under constraint 1 in `StrictName.md`.  All other characters &mdash; including any control codes that may have been added during dot conversion and casing conversion &mdash; are specials.  Specials are encoded with their numeric Unicode codepoint value.

The result of delta encoding is an invariant string and an encoded delta string.  The invariant string may be empty if, for example, the input string contained only specials and no invariants.  The encoded delta string may be empty if, for example, the input string consisted of just a single hyphen.  If the encoded delta string ends up empty, replace it with the special string `aa` which will mark an empty delta string.  The delta string `aa` never occurs normally because that would decode to a special codepoint with numeric value U+0001 which is a control code that can't be present in the input and would never be added by dot or casing conversion.

If the invariant string is empty, transform the input string to equal the encoded delta string (or `aa` if the encoded delta string was empty too).  If the invariant string is not empty, transform the input string to equal the invariant string and let the _delta suffix_ be a hyphen followed by the encoded delta string (or `-aa` if the encoded delta string was empty).  Then, if the invariant string contains any ASCII period characters, insert the delta suffix immediately before the first period character; else, append the delta suffix to the end of the invariant string.

Note that although the delta string appears before any file extension, the delta string transforms the whole invariant string &mdash; including the file extension (but not including the delta string).

If the transformed invariant-with-delta file name exceeds the 255-character length limit, the Bitsy encoding process fails.

### Prefixation

The final Bitsy general encoding step is to add a prefix `xz--` to the transformed file name to indicate that it is encoded with a delta string.  If this causes the encoded file name to exceed the 255-character length limit, the Bitsy encoding process fails.

After this prefix is added, the transformed string should always satisfy `StrictName.md`  The result is the encoded Bitsy string.

## Decoding

The decoding process takes a file name that has been encoded with Bitsy and gets the (Unicode-normalized) original file name back.

The decoding process begins by checking that the encoded file name conforms to `StrictName.md`.  If it does not, then the file name is not a Bitsy-encoded file name and the decoding process should fail.

Second, the case of any letter present in the Bitsy-encoded file name can not be trusted, so convert any letters to lowercase before proceeding with the decoding process.

Next, the decoding process checks for one of the following four-character prefixes at the start of the encoded file name:

- `xq--` (escaping prefix)
- `xz--` (encoding device name)

If neither prefix is present, then pass-through encoding was used.  All letters were originally lowercase if pass-through encoding was used.  We've already converted all letters to lowercase, so we already have the original file name in this case without any further decoding needed.

If the `xq--` prefix is present, then we need to locate its suffix.  Make sure that the length of the encoded file name is at least six characters, or else it is invalid and decoding fails.  If there are no period characters in the file name, then the suffix is the last two characters of the file name.  Otherwise, the suffix is the two characters immediately before the first period character in the file name, and this first period must not be earlier than the seventh character in the name.  The suffix must either be `-q` `-z` or `-x` or otherwise the decoding process fails.  Remove the suffix from the file name.  If the suffix is `-x` then drop the first four characters of the file name; otherwise, replace the second character of the file name with the second character of the suffix.  The result of this process is the original file name.

If the `xz--` prefix is present, you must do the whole general decoding process.  Begin by dropping the first four characters of the file name.  Then, look for the _label._  The label is the whole file name if there are no period characters, or otherwise the substring from the beginning of the transformed file name up to but excluding the first period character.  If the label contains no hyphens, then the delta string is the whole label; otherwise, the delta string is the last hyphen within the label and everything that follows it within the label.  Extract this delta string from the file name, and then drop the hyphen character from the beginning of the delta string if it is present.

The file name after the `xz--` prefix and the delta string have been removed as described above is the invariant string.  The delta string (after removing any hyphen that may be present at the beginning of it) must not be empty or decoding fails.  If the delta string is the special marker `aa` then replace it now with an empty string.

Use the invariant string and the delta string to decode the original transformed file name using the decoding process described in `DeltaEncoding.md`.

Next, reverse the casing conversion process.  Start with the casing state at lowercase.  Step through the string.  Each time an SI control code is encountered, change the casing state to uppercase.  Each time an SO control code is encountered, change the casing state to lowercase.  Each time a SUB control code is encountered, check that it is immediately followed by an ASCII letter, set the case of that ASCII letter to the opposite of the current casing state.  Each time an ASCII letter is encountered that is _not_ preceded by a SUB control code, set its case to match the current casing state.  After the whole string has been case-corrected this way, go through the string again and drop all SI, SO, and SUB control codes.

Next, reverse the dot conversion process.  Replace all RS control codes within the string with ASCII period characters.

Finally, apply Unicode normalization to the name and make sure the result follows the five limitations on file names specified at the beginning of this document.  If it does, then the result is the decoded original file name (after Unicode normalization).
