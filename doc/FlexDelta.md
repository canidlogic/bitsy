# FlexDelta encoding

FlexDelta is a technique for encoding an unsigned integer value into a variable-length sequence of two to six case-insensitive US-ASCII alphanumeric characters.

The range of integer values that FlexDelta can encode must include the maximum possible delta value used during Bitsy encoding.  Bitsy delta values work with coordinates in the form (_n_, _p_), where _n_ is the numeric codepoint value of a character to insert and _p_ is the index of a character within the output string in front of which to insert the new character, or the length of the string (to insert the new character at the end of the string).  Since names are limited to 255 characters, we can insert a character into at most a 254-character name, which implies that _p_ has a maximum range of [0, 254].  We are using Unicode, so the range of the numeric codepoint _n_ is [0, 0x10FFFF].

Bitsy delta values encode the displacement from a coordinate (`n1`, `p1`) to a coordinate (`n2`, `p2`).  The maximum possible displacement is from (0, 0) to (0x10FFFF, 254).  This displacement is:

    d_max = ((0x10FFFF - 0) * (254 - 0 + 1)) + 254
          = (0x10FFFF * 255) + 254
          = 284,098,559

Therefore, FlexDelta must be able to encode unsigned integers in range [0, 284098559].

FlexDelta encoding is similar in design to UTF-8.  However, UTF-8 is a binary format, while FlexDelta may only use case-insensitive US-ASCII alphanumeric characters.  Also, UTF-8 is always able to distinguish leading bytes from continuation bytes, which is useful for resiliency and random seeking when a long text is encoded in UTF-8.  Within FlexDelta, on the other hand, there is no way to determine whether or not a given character is the first character of an encoded numeric value by just looking at the character in isolation.  This difference is necessary because FlexDelta's character alphabet is much more constrained than UTF-8's binary alphabet, and also because FlexDelta is not intended for use within very long texts (in contrast to UTF-8).

Since FlexDelta uses case-insensitive ASCII alphanumeric characters, its alphabet is base-36:

     Char | Value || Char | Value || Char | Value
    ======+=======||======+=======||======+=======
      A   |    0  ||  M   |   12  ||  Y   |   24
      B   |    1  ||  N   |   13  ||  Z   |   25
      C   |    2  ||  O   |   14  ||  0   |   26
      D   |    3  ||  P   |   15  ||  1   |   27
      E   |    4  ||  Q   |   16  ||  2   |   28
      F   |    5  ||  R   |   17  ||  3   |   29
      G   |    6  ||  S   |   18  ||  4   |   30
      H   |    7  ||  T   |   19  ||  5   |   31
      I   |    8  ||  U   |   20  ||  6   |   32
      J   |    9  ||  V   |   21  ||  7   |   33
      K   |   10  ||  W   |   22  ||  8   |   34
      L   |   11  ||  X   |   23  ||  9   |   35

The first character of a FlexDelta-encoded integer value always indicates the total number of characters within the FlexDelta encoding, which has a range of two up to six characters.  The first character also encodes part of the numeric value of the delta value.  The following table shows all possible characters and indicates -- for the first encoded character only! -- how many characters long the encoding will be and what numeric value is encoded within the first character.  The "First" column stores this data in the format `m:n` where `m` is the total number of characters in the encoding and `n` is the numeric value encoded within this first character:

     Char | First || Char | First || Char | First
    ======+=======||======+=======||======+=======
      A   |  2:0  ||  M   |  3:0  ||  Y   |  5:0
      B   |  2:1  ||  N   |  3:1  ||  Z   |  5:1
      C   |  2:2  ||  O   |  3:2  ||  0   |  5:2
      D   |  2:3  ||  P   |  3:3  ||  1   |  5:3
      E   |  2:4  ||  Q   |  3:4  ||  2   |  5:4
      F   |  2:5  ||  R   |  3:5  ||  3   |  5:5
      G   |  2:6  ||  S   |  4:0  ||  4   |  6:0
      H   |  2:7  ||  T   |  4:1  ||  5   |  6:1
      I   |  2:8  ||  U   |  4:2  ||  6   |  6:2
      J   |  2:9  ||  V   |  4:3  ||  7   |  6:3
      K   |  2:10 ||  W   |  4:4  ||  8   |  6:4
      L   |  2:11 ||  X   |  4:5  ||  9   |  6:5

All characters after the first within a FlexDelta encoding are base-36 digits that use the numeric values from the "Value" column of the table preceding the one above.  The encoded delta value is stored in big-endian order, with the first character storing the most significant part of the number and the last character storing the least significant part of the number.

To decode a FlexDelta-encoded integer, get the first character and determine from the above table how many characters total there are in this encoding and what numeric value is encoded in this first character.  Let the result equal the numeric value encoded in this first character.  Then, for all remaining characters in the encoding, multiply the result by 36 and add the numeric value of the new digit.

The full range of FlexDelta values in this scheme ranges from `AA` which is zero, up to `999999` which decodes to:

    enc = 999999
    enc_n means the nth character, enc_1 is first
    
    enc_1 is 9
    -> 6 total characters in encoding
    -> 5 is numeric value encoded in first character
    
    result = 5
    enc_2 is 9, encodes value 35
    result -> (result * 36) + 35 = 215
    
    result = 215
    enc_3 is 9, encodes value 35
    result -> (result * 36) + 35 = 7,775
    
    result = 7,775
    enc_4 is 9, encodes value 35
    result -> (result * 36) + 35 = 279,935
    
    result = 279,935
    enc_5 is 9, encodes value 35
    result -> (result * 36) + 35 = 10,077,695
    
    result = 10,077,695
    enc_6 is 9, encodes value 35
    result -> (result * 36) + 35 = 362,797,055
    
    result = 362,797,055 (= 6 * 36^5 - 1)

You can therefore see that FlexDelta has more than enough range to encode the maximum value of delta, `d_max` which was computed earlier.

A single numeric value may have multiple possible encodings.  For example, the value 2 can be represented as `AC`, `MAC`, `SAAC`, `YAAAC`, or `4AAAAC`.  FlexDelta requires the smallest representation to always be used.  "Overlong" encodings in UTF-8 turned out to be a security problem, so FlexDelta takes the same approach as UTF-8, and requires decoders to fail if a delta value is encoded in an unnecessarily long fashion.

The following table shows the valid ranges of each code length within FlexDelta:

     Len |  Encoding   |  Minimum   |   Maximum
    =====+=============+============+=============
      2  |    AA-L9    |          0 |         431
      3  |   MMA-R99   |        432 |       7,775
      4  |  SGAA-X999  |      7,776 |     279,935
      5  | YGAAA-39999 |    279,936 |  10,077,695
      6  |4GAAAA-999999| 10,077,696 | 362,797,055

In order to encode a given integer value into its FlexDelta representation, you first use the range table shown above to determine the encoding length for the integer value.  Let _m_ be one less than the length of the encoding, which will be equal to the number of base-36 digits that follow the first digit.  The last digit will be the remainder after dividing the value by 36.  Update the value by dividing by 36 and flooring the result, and then repeat this process of taking the remainder and dividing for all remaining base-36 digits, moving from the last back to the first.  At the first digit, the remaining value should be less than 12 if the encoding length is two or less than 6 otherwise.  Use this remaining value along with the coding length to look up in the earlier table with the "First" column what the first digit of the encoding should be.

Here is how to encode the maximum delta value `d_max` that was computed earlier:

    value = 284,098,559
    Therefore: code_len = 6
    
    value MOD 36 = 23
    Therefore: digit_6 = "X"
    value -> value DIV 36 = 7,891,626
    
    value MOD 36 = 30
    Therefore: digit_5 = "4"
    value -> value DIV 36 = 219,211
    
    value MOD 36 = 7
    Therefore: digit_4 = "H"
    value -> value DIV 36 = 6,089
    
    value MOD 36 = 5
    Therefore: digit_3 = "F"
    value -> value DIV 36 = 169
    
    value MOD 36 = 25
    Therefore: digit_2 = "Z"
    value -> value DIV 36 = 4
    
    First digit:
    - code_len = 6
    - value = 4
    - 6:4 in first digit table is "8"
    Therefore: digit_1 = "8"
    
    THUS:
    284,098,559 encoded is: 8ZFH4X

We can decode "8ZFH4X" to make sure we get the same value back:

    enc = 8ZFH4X
    enc_n means the nth character, enc_1 is first
    
    enc_1 is 8
    -> 6 total characters in encoding
    -> 4 is numeric value encoded in first character
    
    result = 4
    enc_2 is Z, encodes value 25
    result -> (result * 36) + 25 = 169
    
    result = 169
    enc_3 is F, encodes value 5
    result -> (result * 36) + 5 = 6,089
    
    result = 6,089
    enc_4 is H, encodes value 7
    result -> (result * 36) + 7 = 219,211
    
    result = 219,211
    enc_5 is 4, encodes value 30
    result -> (result * 36) + 30 = 7,891,626
    
    result = 7,891,626
    enc_6 is X, encodes value 23
    result -> (result * 36) + 23 = 284,098,559
    
    result = 284,098,559 (= d_max)
    VERIFY: 284,098,559 is >= 10,077,696, so it is not overlong

Since the first character of each FlexDelta-encoded value encodes how many characters long the encoded value is, it is possible to concatenate multiple FlexDelta-encoded values one right after another with no delimiter and still reconstruct the boundaries of the individual values.
