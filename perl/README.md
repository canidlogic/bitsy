# Bitsy Perl module

You can test the Bitsy Perl module with Perl one-liners.

Make sure you are in this directory with the README file (_not_ the Encode directory).

Here is a one-liner for testing the encode function:

    perl -I. -e "use Encode::Bitsy; print encodeBitsy(\"...\"); print \"\\n\";"

Here is a one-liner for testing the decode function:

    perl -I. -e "use Encode::Bitsy; print decodeBitsy(\"...\"); print \"\\n\";"

In both cases, replace `...` with the input to encode or decode.  Since we are in the midst of a quoted string argument in a quoted string argument, you must double-escape any double quotes in the input with `\\\"` and other special characters need to be double-escaped in the same way.  Also, use `\\x{f6}` to insert Unicode codepoint U+00F6 for example.
