# FlexDelta encoding

FlexDelta is a technique for encoding either an unsigned integer value or a signed displacement into a variable-length sequence of two to six case-insensitive US-ASCII alphanumeric characters.

## Unsigned range requirement

The range of unsigned integer values that FlexDelta can encode must include the maximum possible delta value used during Bitsy encoding.  Bitsy delta values work with coordinates in the form (_n_, _p_), where _n_ is the numeric codepoint value of a character to insert and _p_ is the index of a character within the output string in front of which to insert the new character, or the length of the string (to insert the new character at the end of the string).  Since names are limited to 255 characters, we can insert a character into at most a 254-character name, which implies that _p_ has a maximum range of [0, 254].  We are using Unicode, so the range of the numeric codepoint _n_ is [0, 0x10FFFF].

Bitsy unsigned delta values encode the difference from a coordinate (`n1`, `p1`) to a coordinate (`n2`, `p2`).  The maximum possible difference is from (0, 0) to (0x10FFFF, 254).  This difference is:

    d_max = ((0x10FFFF - 0) * (254 - 0 + 1)) + 254
          = (0x10FFFF * 255) + 254
          = 284,098,559

Therefore, FlexDelta must be able to encode unsigned integers in range [0, 284098559].

## Signed and unsigned values

When possible, FlexDelta stores a signed displacement from a predicted delta value instead of storing the delta value directly.  Sometimes the displacement from the predicted delta value is too large to store in FlexDelta, in which case FlexDelta directly stores the delta value as an unsigned integer instead.  This is intended to efficiently encode the common case where most special characters that are being encoded are clustered in a limited number of Unicode blocks &mdash; the signed displacements from prediction values are intended for use for encoding deltas within the same Unicode block, while unsigned values stored directly can be used to encode large skips between different Unicode blocks.

The FlexDelta encoding and decoding procedures must always be given a predicted delta.  When the encoding procedure returns, the length of the encoding determines whether a signed displacement or unsigned value was stored &mdash; encodings of 5 or more characters are unsigned deltas and encodings of less than 5 characters are signed displacements.  For decoding, you can use the length of the encoded value in the same way to determine whether or not it is a signed displacement.  Knowing whether an unsigned direct delta (a large skip, probably between Unicode blocks) or a signed displacement (a small skip, probably within a Unicode block) was used can affect subsequent predictions.  FlexDelta is not concerned with the specific prediction algorithm used, however.

## Signed displacement encoding

Signed displacements are encoded as unsigned values before being stored in FlexDelta.  This encoding is done in such a way that signed values closer to zero encode to smaller unsigned values.

Let _s_ be the signed value that is being encoded into an unsigned value _u_.  The following gives the encoding formula:

    u = s * 2 if s >= 0
    u = (s * -2) - 1 if s < 0

The following is the decoding formula:

    s = u DIV 2 if (u MOD 2) = 0
    s = (u + 1) DIV -2 if (u MOD 2) = 1

The following then shows how the first few unsigned values map to signed values according to these formulas:

     Unsigned | Signed
    ==========+========
         0    |    0
         1    |   -1
         2    |   +1
         3    |   -2
         4    |   +2
         5    |   -3
         6    |   +3
        ...   |  ...

The maximum signed displacement range that FlexDelta can encode is [-138,968, +139,967], which maps to an encoded unsigned range of [0, 279,935].

## Unsigned value encoding

FlexDelta unsigned value encoding is similar in design to UTF-8.  However, UTF-8 is a binary format, while FlexDelta may only use case-insensitive US-ASCII alphanumeric characters.  Also, UTF-8 is always able to distinguish leading bytes from continuation bytes, which is useful for resiliency and random seeking when a long text is encoded in UTF-8.  Within FlexDelta, on the other hand, there is no way to determine whether or not a given character is the first character of an encoded numeric value by just looking at the character in isolation.  This difference is necessary because FlexDelta's character alphabet is much more constrained than UTF-8's binary alphabet, and also because FlexDelta is not intended for use within very long texts (in contrast to UTF-8).

Since FlexDelta uses case-insensitive ASCII alphanumeric characters, its unsigned alphabet is base-36:

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

The first character of a FlexDelta-encoded unsigned integer value always indicates the total number of characters within the FlexDelta encoding, which has a range of two up to six characters.  The first character also encodes part of the numeric value of the unsigned value.  The following table shows all possible characters and indicates -- for the first encoded character only! -- how many characters long the encoding will be and what numeric value is encoded within the first character.  The "First" column stores this data in the format `m:n` where `m` is the total number of characters in the encoding and `n` is the numeric value encoded within this first character:

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

All characters after the first within a FlexDelta encoding are base-36 digits that use the numeric values from the "Value" column of the table preceding the one above.  The unsigned value is stored in big-endian order, with the first character storing the most significant part of the number and the last character storing the least significant part of the number.

To decode a FlexDelta-encoded unsigned integer, get the first character and determine from the above table how many characters total there are in this encoding and what numeric value is encoded in this first character.  Let the result equal the numeric value encoded in this first character.  Then, for all remaining characters in the encoding, multiply the result by 36 and add the numeric value of the new digit.

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

You can therefore see that FlexDelta has more than enough range to encode the maximum unsigned delta value `d_max` which was computed earlier.

## Encoding ranges

A single unsigned numeric value may have multiple possible encodings.  For example, the value 2 can be represented as `AC`, `MAC`, `SAAC`, `YAAAC`, or `4AAAAC`.  Unsigned numeric values furthermore represent two different things within FlexDelta:  either an encoded signed displacement value, or an unsigned delta value.

The length in base-36 digits of the unsigned value determines what kind of value is stored within it.  For a length in range 2 to 4 characters, the unsigned value is an encoded signed displacement.  When you have multiple choices for how to store a particular encoded unsigned value, the smallest encoding is always used.  This leads to the following table, showing encodings of 2 to 4 characters, their minimum and maximum encoded unsigned ranges, and the positive and negative signed ranges they correspond to:

         |             |  Unsigned enc.  | Positive signed  | Negative signed
     Len |  Encoding   +-------+---------+-------+----------+-------+---------
         |             |  Min  |   Max   |  Min  |   Max    |  Max  |   Min
    =====+=============+=======+=========+=======+==========+=======+=========
      2  |    AA-L9    |     0 |     431 |     0 |     +215 |    -1 |     -216
      3  |   MMA-R99   |   432 |   7,775 |  +216 |   +3,887 |  -217 |   -3,888
      4  |  SGAA-X999  | 7,776 | 279,935 | +3888 | +139,967 | -3889 | -139,968

For a length of 5 to 6 characters, the FlexDelta encoding always represents an unsigned delta value encoded directly.  The following table shows the valid ranges of these unsigned code lengths within FlexDelta:

     Len |  Encoding   |  Minimum   |   Maximum
    =====+=============+============+=============
      5  | YAAAA-39999 |          0 |  10,077,695
      6  |4GAAAA-999999| 10,077,696 | 362,797,055

## Encoding summary

Given a delta value and a prediction, FlexDelta encoding works as follows.  First, compute the displacement as the delta value subtracted by the prediction.  Second, check whether this signed displacement is within the range [-138,968, +139,967].  If it is, then encode the signed displacement as an unsigned value as described in an earlier section and then determine whether two, three, or four digits will be required using the signed ranges table given in the previous section; finally, encode the encoded unsigned value into a sequence of base-36 digits using that digit length and the unsigned value encoding scheme given in an earlier section.

If the signed displacement is out of range, then forget the prediction and encode the unsigned delta value directly as a five or six digit base-36 value.  Use the unsigned ranges table given in the previous section to determine whether to use five or six digits and then use the scheme given in the unsigned value encoding section.

### Encoding example 1

Let us encode the maximum delta value `d_max` that was computed earlier, with a given prediction value of 1,024.  Subtracting `d_max` by 1,024 results in +284,097,535 which is outside the signed displacement range [-138,968, +139,967], so we need to encode this value directly.  Using the unsigned ranges table, we can determine that the `d_max` value of 284,098,559 should have six encoded base-36 digits.

In order to encode the unsigned value 284,098,559 into six digits, we start by determining the last encoded digit and working our way up to the first.  The last encoded digit is the unsigned value modulo 36, and then converted into a character using the "Char / Value" table given earlier.  We then divide the unsigned value by 36 and floor the result before doing this again to get the preceding digit, so on and so forth until arriving at the first digit.  At the first digit, we use the length of the encoding _m_ and the remaining unsigned value _n_ to look up the appropriate character to use in the "Char / First" table given earlier with value `m:n`.

Here is a trace of encoding `d_max` with prediction 1,024 in FlexDelta:

           value = 284,098,559
      prediction = 1,024
    displacement = value - prediction = +284,097,535
    
    displacement is outside of [-138,968, +139,967]
    Therefore: encode unsigned value directly
    
    Look up value in unsigned ranges table
    value in range [10,077,696, 362,797,055]
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
    - 6:4 in char/first table is "8"
    Therefore: digit_1 = "8"
    
    THUS:
    284,098,559 with prediction 1,024
    encoded is: 8ZFH4X

### Encoding example 2

Suppose we are given a delta value of 512 and a prediction of 1,024 to encode.  The following is a full trace:

           value = 512
      prediction = 1,024
    displacement = value - prediction = -512
    
    displacement is inside of [-138,968, +139,967]
    Therefore: encode signed displacement
    
    Encode signed value -512 as unsigned value:
    value -> (-512 * -2) - 1 = 1,023
    value = 1,023
    
    Look up encoding length in the signed ranges table:
    Unsigned enc. 1,023 requires code_len = 3
    
    value MOD 36 = 15
    Therefore: digit_3 = "P"
    value -> value DIV 36 = 28
    
    value MOD 36 = 28
    Therefore: digit_2 = "2"
    value -> value DIV 36 = 0
    
    First digit:
    - code_len = 3
    - value = 0
    - 3:0 in char/first table is "M"
    Therefore: digit_1 = "M"
    
    THUS:
    512 with prediction 1,024
    encoded is: M2P

## Decoding summary

Given an encoded delta value and the same prediction that was used to encode it, FlexDelta decoding works as follows.  First, decode an unsigned value from the FlexDelta encoding.  Look up the first character in the char/first table to determine the numeric value of the first digit.  Then, for all subsequent digits, multiply the current result value by 36 and then add the value of the new digit by looking it up in the char/value table.

The second step after decoding the unsigned value is to determine whether or not it is a signed displacement.  If the encoded delta had less than five characters, it is a signed displacement; if it had five or more characters, it is not a signed displacement.

For a signed displacement, decode the unsigned value into a signed value using the formula given in an earlier section.  Then, add the signed displacement to the prediction to get the encoded delta value.  Finally, subtract the computed delta value from zero and then subtract one more to get an encoded negative value to return that indicates the delta was computed by displacement.

If the value is not a signed displacement, then the unsigned value itself is the delta.  Return it as-is, and the fact that it is zero or greater indicates that it was not computed by displacement.

### Decoding example 1

We can decode the "8ZFH4X" that we encoded in encoding example 1 with prediction 1,024 to make sure we get the same value back:

           enc = 8ZFH4X
    prediction = 1,024
    
    enc_n means the nth character, enc_1 is first
    
    enc_1 is "8"
    -> 6 total characters in encoding
    -> 4 is numeric value encoded in first character
    
    Since five or more characters, delta is encoded directly
    Prediction is therefore not used
    
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

Since the encoded value was five or more characters long, we know it was encoded directly and not with signed displacement.

### Decoding example 2

We can also decode the "M2P" with prediction 1,024 that we encoded in encoding example 2 to make sure we get the same value back:

           enc = M2P
    prediction = 1,024
    
    enc_n means the nth character, enc_1 is first
    
    enc_1 is "M"
    -> 3 total characters in encoding
    -> 0 is numeric value encoded in first character
    
    Since less than five characters, signed displacement
    Decode as an unsigned value first:
    
    result = 0
    enc_2 is 2, encodes value 28
    result -> (result * 36) + 28 = 28
    
    result = 28
    enc_3 is P, encodes value 15
    result -> (result * 36) + 15 = 1,023
    
    Now convert unsigned result to signed displacement:
    result MOD 2 == 1 so use the following:
    result -> (result + 1) DIV -2 = -512
    
    Signed displacement = -512
    Add to prediction to get:
      512 as reconstructed delta

Since the encoded value was less than five characters long, we know it was derived by signed displacement.

## Encoding sequences of deltas

Since the first character of each FlexDelta-encoded value encodes how many characters long the encoded value is, it is possible to concatenate multiple FlexDelta-encoded values one right after another with no delimiter and still reconstruct the boundaries of the individual values.

To do this, start with the first character of the encoded delta array.  Use the char/first table to figure out how many characters this first delta has.  Extract the first delta using this length, then move on to the next encoded delta and use the first character of this in the same way.  Therefore, the whole array can be unambiguously decoded without needing any sort of delimiter characters.
