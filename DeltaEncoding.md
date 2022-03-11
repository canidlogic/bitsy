# Delta Encoding Algorithm

Delta encoding is a method for encoding special characters within a source string.  It is based on the Bootstring algorithm that is used for Punycode, but it uses a different method of encoding delta values into alphanumeric digits.

## Invariants and specials

The first step in delta encoding is to divide the input string into _invariants_ and _specials._  Invariant characters are those that can appear in the final string.  Special characters are those that are not allowed in the final string and must be instead encoded by deltas.  The specific definition of which characters are invariants and which characters are specials is not defined here, as the delta encoding algorithm can work with any set of invariants and specials, provided that each character in the string is in exactly one of those two sets.

For sake of examples in this specification, we will assume that the letters `a` through `z` are invariant and that the numeric digits `1` through `9` are special.  For simplicity, we will also assume that the numeric codepoint values of digits `1` through `9` are 1 through 9, although this isn't actually the case in most encodings.

## Insertion map

An __insertion map__ is an array of signed integers.  Integer values that are less than zero encode a sequence of one or more invariants, such that the invariant sequence has a length in characters equal to the absolute value of the negative integer.  Integer values that are greater than zero encode special codepoints that are inserted into the string.  The integer value zero is reserved for use as a marker character (see later).

The following shows an example of how a string containing invariants and specials is represented by an insertion map:

    Invariant : a-z
    Special   : 1-9
    
    Original string:
    the1quick3brown2fox7jumps6over5
    a4lazy8dog987
    
    Insertion map:
    -3, 1,-5, 3,-5, 2,-3, 7,-5, 6,-4, 5,
    -1, 4,-4, 8,-3, 9, 8, 7
    
    Invariant string:
    thequickbrownfoxjumpsoveralazydog

As you can see from this example, each sequence of invariants gets replaced by a single negative integer in the insertion map that counts (by absolute value) the number of characters in the invariant sequence.  The specials get replaced by their equivalent numeric codepoint values (which are equal to the digits in this simple example) in the insertion map.

When all the specials are dropped from the string, leaving only the invariants, the length of the invariant string is always equal to the absolute value of the sum of all negative integers in the insertion map.  You can confirm in the above example that the string with special characters dropped has 33 characters and the absolute value of the sum of all negative integers in the insertion map is also 33.  It is possible for the resulting invariant string to be an empty string, if every character in the original string was a special.

If you have the invariant string and the insertion map, you can get back the original string with the following algorithm.  Run through the insertion map integer by integer.  When you encounter an integer that is less than zero, take its absolute value and copy that many invariant characters from the invariant string to output.  When you encounter an integer that is greater than zero, append a special character with that codepoint value into the output string.  (The reserved zero value never occurs in a valid insertion map.)  The following example shows how the invariant string and the insertion map from the previous example are used to reconstruct the original string:

    Input : thequickbrownfoxjumpsoveralazydog
    Output: <null>
    
    Insertion map entry: -3
    Input : quickbrownfoxjumpsoveralazydog
    Output: the
    
    Insertion map entry:  1
    Input : quickbrownfoxjumpsoveralazydog
    Output: the1
    
    Insertion map entry: -5
    Input : brownfoxjumpsoveralazydog
    Output: the1quick
    
    Insertion map entry:  3
    Input : brownfoxjumpsoveralazydog
    Output: the1quick3
    
    Insertion map entry: -5
    Input : foxjumpsoveralazydog
    Output: the1quick3brown
    
    ....
    
    Insertion map entry:  8
    Input : dog
    Output: the1quick3brown2fox7jumps6over5
            a4lazy8
    
    Insertion map entry: -3
    Input : <null>
    Output: the1quick3brown2fox7jumps6over5
            a4lazy8dog
    
    Insertion map entry: 9
    Input : <null>
    Output: the1quick3brown2fox7jumps6over5
            a4lazy8dog9
    
    Insertion map entry: 8
    Input : <null>
    Output: the1quick3brown2fox7jumps6over5
            a4lazy8dog98
    
    Insertion map entry: 7
    Input : <null>
    Output: the1quick3brown2fox7jumps6over5
            a4lazy8dog987

## Oplist

An __oplist__ is a sequence of zero or more _insertion ops,_ each of which is a pair of integers storing an insertion position and an insertion code.  The insertion position is the index of codepoint within the string, where zero means insert before the first character of the string, one means insert before the second character of the the string, and so forth.  The string length is also a valid insertion position, which means append at the end of the string.  The insertion code is the special codepoint value that will be inserted, which matches the (greater than zero) special code value from the insertion map.

Insertion ops within the oplist must be sorted first in ascending order by insertion code (__not__ by insertion position).  Insertion ops with the same insertion code must be sorted in ascending order of insertion position within the string.  This ordering is the key difference between the oplist and the insertion map:  the insertion map is sorted primarily by insertion position, while the oplist is sorted primarily by insertion code.

An insertion map can be converted to an oplist by the following algorithm.  Begin by setting the oplist to an empty array.  Keep going with the following procedure until the insertion map contains no values greater than zero.  First, find the lowest value that is greater than zero in the whole insertion map, call it `min_val`.  Second, find the first instance of `min_val` in the insertion map, call the index of this first instance `i`.  Third, let `p` be the number of characters up to this insertion:  `p` starts out at zero; for every negative value before index `i` within the insertion map, `p` is incremented by the absolute value of the negative value; for every zero value before index `i` within the insertion map, `p` is incremented by one; and values greater than zero are ignored.  Add an insertion op to the end of the oplist with insertion position `p` and insertion code `min_val`, set the element at index `i` in the insertion map to zero, and loop back until the insertion map contains only negative and zero values.

Here is how the insertion map from the previous section is converted to an oplist using this algorithm:

    == INITIAL STATE ==
    
    Insertion map: 
    -3, 1,-5, 3,-5, 2,-3, 7,-5, 6,-4, 5,
    -1, 4,-4, 8,-3, 9, 8, 7
    
    Oplist (pos, char):
    <empty>
    
    == BEGIN ==
    
    Insertion map:
    -3, 1,-5, 3,-5, 2,-3, 7,-5, 6,-4, 5,
    -1, 4,-4, 8,-3, 9, 8, 7
    
    min_val = 1
          i = 1
          p = 3
    
    Oplist (pos, char):
    [(3, 1)]
    
    Insertion map:
    -3, 0,-5, 3,-5, 2,-3, 7,-5, 6,-4, 5,
    -1, 4,-4, 8,-3, 9, 8, 7
    
    min_val = 2
          i = 5
          p = 14
    
    Oplist (pos, char):
    [(3, 1), (14, 2)]
    
    Insertion map:
    -3, 0,-5, 3,-5, 0,-3, 7,-5, 6,-4, 5,
    -1, 4,-4, 8,-3, 9, 8, 7
    
    min_val = 3
          i = 3
          p = 9
    
    Oplist (pos, char):
    [(3, 1), (14, 2), (9, 3)]
    
    Insertion map:
    -3, 0,-5, 0,-5, 0,-3, 7,-5, 6,-4, 5,
    -1, 4,-4, 8,-3, 9, 8, 7
    
    min_val = 4
          i = 13
          p = 29
    
    Oplist (pos, char):
    [(3, 1), (14, 2), (9, 3), (29, 4)]
    
    Insertion map:
    -3, 0,-5, 0,-5, 0,-3, 7,-5, 6,-4, 5,
    -1, 0,-4, 8,-3, 9, 8, 7
    
    min_val = 5
          i = 11
          p = 28
    
    Oplist (pos, char):
    [(3, 1), (14, 2), (9, 3), (29, 4), (28, 5)]
    
    Insertion map:
    -3, 0,-5, 0,-5, 0,-3, 7,-5, 6,-4, 0,
    -1, 0,-4, 8,-3, 9, 8, 7
    
    min_val = 6
          i = 9
          p = 24
    
    Oplist (pos, char):
    [(3, 1), (14, 2), (9, 3), (29, 4), (28, 5), (24, 6)]
    
    Insertion map:
    -3, 0,-5, 0,-5, 0,-3, 7,-5, 0,-4, 0,
    -1, 0,-4, 8,-3, 9, 8, 7
    
    min_val = 7
          i = 7
          p = 19
    
    Oplist (pos, char):
    [( 3, 1), (14, 2), (9, 3), (29, 4), (28, 5), (24, 6),
     (19, 7)]
    
    Insertion map:
    -3, 0,-5, 0,-5, 0,-3, 0,-5, 0,-4, 0,
    -1, 0,-4, 8,-3, 9, 8, 7
    
    min_val = 7
          i = 19
          p = 40
    
    Oplist (pos, char):
    [( 3, 1), (14, 2), (9, 3), (29, 4), (28, 5), (24, 6),
     (19, 7), (40, 7)]
    
    Insertion map:
    -3, 0,-5, 0,-5, 0,-3, 0,-5, 0,-4, 0,
    -1, 0,-4, 8,-3, 9, 8, 0
    
    min_val = 8
          i = 15
          p = 37
    
    Oplist (pos, char):
    [( 3, 1), (14, 2), ( 9, 3), (29, 4), (28, 5), (24, 6),
     (19, 7), (40, 7), (37, 8)]
    
    Insertion map:
    -3, 0,-5, 0,-5, 0,-3, 0,-5, 0,-4, 0,
    -1, 0,-4, 0,-3, 9, 8, 0
    
    min_val = 8
          i = 18
          p = 41
    
    Oplist (pos, char):
    [( 3, 1), (14, 2), ( 9, 3), (29, 4), (28, 5), (24, 6),
     (19, 7), (40, 7), (37, 8), (41, 8)]
    
    Insertion map:
    -3, 0,-5, 0,-5, 0,-3, 0,-5, 0,-4, 0,
    -1, 0,-4, 0,-3, 9, 0, 0
    
    min_val = 9
          i = 17
          p = 41
    
    Oplist (pos, char):
    [( 3, 1), (14, 2), ( 9, 3), (29, 4), (28, 5), (24, 6),
     (19, 7), (40, 7), (37, 8), (41, 8), (41, 9)]
    
    === FINAL STATE ===
    
    Insertion map:
    -3, 0,-5, 0,-5, 0,-3, 0,-5, 0,-4, 0,
    -1, 0,-4, 0,-3, 0, 0, 0
    
    Oplist (pos, char):
    [( 3, 1), (14, 2), ( 9, 3), (29, 4), (28, 5), (24, 6),
     (19, 7), (40, 7), (37, 8), (41, 8), (41, 9)]

You can run through the generated oplist instructions one by one and use them to transform the invariant string back into the original string:

    Invariant string:
    thequickbrownfoxjumpsover
    alazydog
    
    Insertion op: ( 3, 1)
    the1quickbrownfoxjumpsover
    alazydog
    
    Insertion op: (14, 2)
    the1quickbrown2foxjumpsover
    alazydog
    
    Insertion op: ( 9, 3)
    the1quick3brown2foxjumpsover
    alazydog
    
    Insertion op: (29, 4)
    the1quick3brown2foxjumpsover
    a4lazydog
    
    Insertion op: (28, 5)
    the1quick3brown2foxjumpsover5
    a4lazydog
    
    Insertion op: (24, 6)
    the1quick3brown2foxjumps6over5
    a4lazydog
    
    Insertion op: (19, 7)
    the1quick3brown2fox7jumps6over5
    a4lazydog
    
    Insertion op: (40, 7)
    the1quick3brown2fox7jumps6over5
    a4lazydog7
    
    Insertion op: (37, 8)
    the1quick3brown2fox7jumps6over5
    a4lazy8dog7
    
    Insertion op: (41, 8)
    the1quick3brown2fox7jumps6over5
    a4lazy8dog87
    
    Insertion op: (41, 9)
    the1quick3brown2fox7jumps6over5
    a4lazy8dog987

Given the length of the invariant string and an oplist, you can reconstruct the insertion map using the following algorithm.  Start the insertion map out as an empty array.  If the invariant string has a length that is greater than zero, insert a negative value into the insertion map such that the absolute value of the negative value equals the length of the invariant string.  Then, transform the insertion map by each insertion op in the order given in the oplist with the following procedure.  For each array index _i_ in the insertion map array, define _v(i)_ as the value of the element at that index within the insertion map array, and define _b(i)_ as the _base_ of the element at that index within the insertion map array:  

    For i = 0:
        b(0) = 0

    For i > 0:    
        b(i) = (b(i - 1) + 1) if v(i) is > 0,
               - or -
        b(i) = (b(i - 1) + abs(v(i - 1))) if v(i) is < 0

Also define this function _b(i)_ for the _i_ that is equal to the length of the insertion array, using the same definition shown above.  Let _m_ be the current character length of the insertion map, which is equal to _b(len)_ where _len_ is the current length of the insertion array.  If the position of the current insertion op is equal to _m_ then simply append the special to the end of the insertion map.  Otherwise, let _p_ be the insertion position, and find the greatest _j_ such that _b(j)_ <= _p_.  If _b(j)_ = _p_ then insert the special before index _j_ in the insertion array.  Otherwise, the element at index _j_ must be a negative integer.  Split this element into two negative integers _a_ and _b_ such that (_a_ + _b_) equals the original negative value and abs(_a_) = _p_ - _b(j)_.  Then, insert the special between these two split elements.  (In short, this case splits a negative value in the insertion array into two and then inserts the special in between.)

The following example shows how the preceding oplist is transformed back into the insertion map using this algorithm:

    Oplist (pos, char):
    [( 3, 1), (14, 2), ( 9, 3), (29, 4), (28, 5), (24, 6),
     (19, 7), (40, 7), (37, 8), (41, 8), (41, 9)]
    
    Invariant length: 33
    -> Initial insertion map state:
    
    Insertion map:
    -33
    
    Insertion op: ( 3, 1)
          p  = 3
          j  = 0
        b(j) = 0
    p - b(j) = 3
    -> Split -33 into [-3, -30]
    -> Insert special [-3, 1, -30]
    -> Replace index j:
    
    Insertion map:
    -3, 1,-30
    
    Insertion op: (14, 2)
          p  = 14
          j  = 2
        b(j) = 4
    p - b(j) = 10
    -> Split -30 into [-10, -20]
    -> Insert special [-10, 2, -20]
    -> Replace index j:
    
    Insertion map:
    -3, 1,-10, 2,-20
    
    Insertion op: ( 9, 3)
          p  = 9
          j  = 2
        b(j) = 4
    p - b(j) = 5
    -> Split -10 into [-5, -5]
    -> Insert special [-5, 3, -5]
    -> Replace index j:
    
    Insertion map:
    -3, 1,-5, 3,-5, 2,-20
    
    Insertion op: (29, 4)
          p  = 29
          j  = 6
        b(j) = 16
    p - b(j) = 13
    -> Split -20 into [-13, -7]
    -> Insert special [-13, 4, -7]
    -> Replace index j:
    
    Insertion map:
    -3, 1,-5, 3,-5, 2,-13, 4,-7
    
    Insertion op: (28, 5)
          p  = 28
          j  = 6
        b(j) = 16
    p - b(j) = 12
    -> Split -13 into [-12, -1]
    -> Insert special [-12, 5, -1]
    -> Replace index j:
    
    Insertion map:
    -3, 1,-5, 3,-5, 2,-12, 5,-1, 4,-7
    
    Insertion op: (24, 6)
          p  = 24
          j  = 6
        b(j) = 16
    p - b(j) = 8
    -> Split -12 into [-8, -4]
    -> Insert special [-8, 6, -4]
    -> Replace index j:
    
    Insertion map:
    -3, 1,-5, 3,-5, 2,-8, 6,-4, 5,-1, 4,
    -7
    
    Insertion op: (19, 7)
          p  = 19
          j  = 6
        b(j) = 16
    p - b(j) = 3
    -> Split -8 into [-3, -5]
    -> Insert special [-3, 7, -5]
    -> Replace index j:
    
    Insertion map:
    -3, 1,-5, 3,-5, 2,-3, 7,-5, 6,-4, 5,
    -1, 4,-7
    
    Insertion op: (40, 7)
          p  = 40
          m  = b(15) = 40
    -> Append special to end of insertion map:
    
    Insertion map:
    -3, 1,-5, 3,-5, 2,-3, 7,-5, 6,-4, 5,
    -1, 4,-7, 7
    
    Insertion op: (37, 8)
          p  = 37
          j  = 14
        b(j) = 33
    p - b(j) = 4
    -> Split -7 into [-4, -3]
    -> Insert special [-4, 8, -3]
    -> Replace index j:
    
    Insertion map:
    -3, 1,-5, 3,-5, 2,-3, 7,-5, 6,-4, 5,
    -1, 4,-4, 8,-3, 7
    
    Insertion op: (41, 8)
          p  = 41
          j  = 17
        b(j) = 41
    -> Insert special before index j:
    
    Insertion map:
    -3, 1,-5, 3,-5, 2,-3, 7,-5, 6,-4, 5,
    -1, 4,-4, 8,-3, 8, 7
    
    Insertion op: (41, 9)
          p  = 41
          j  = 17
        b(j) = 41
    -> Insert special before index j:
    
    Insertion map:
    -3, 1,-5, 3,-5, 2,-3, 7,-5, 6,-4, 5,
    -1, 4,-4, 8,-3, 9, 8, 7

You can confirm that the insertion map we generated with the algorithm is the same insertion map we started with at the beginning of this section.  We therefore now have algorithms to convert insertion maps to oplists and oplists to insertion maps.

## Deltas

Deltas are derived from the oplist generated in the preceding step.  The _coordinate state_ always starts out at (0, 1), which means to insert special codepoint 1 at position zero in the string.  The _length state_ always starts out as the length in characters of the invariant string.

For each insertion op in the oplist, a delta is generated from the current coordinate state to the coordinate equal to the current insertion op.  After the delta is generated, the current coordinate state is updated to the coordinate equal to the insertion op that was just encoded before proceeding to encode any further deltas.  Also, the length state is incremented after each delta is generated.

The following describes how to derive each delta:

    Current coordinate state is (c_p, c_n)
    -> c_p is position
    -> c_n is special codepoint
    
    Current length state is ls
    
    Insertion op to encode is (i_p, i_n)
    -> i_p is position
    -> i_n is special codepoint
    
    delta = ((i_n - c_n) * (ls + 1)) - c_p + i_p
    
    Update state:
    -> Set c_p to i_p
    -> Set c_n to i_n
    -> Increment ls

Therefore, we can convert the example oplist from the last section into deltas as follows:

    Oplist (pos, char):
    [( 3, 1), (14, 2), ( 9, 3), (29, 4), (28, 5), (24, 6),
     (19, 7), (40, 7), (37, 8), (41, 8), (41, 9)]
    
    Initial state:
          ls   = 33 (length of invariant string)
    (c_p, c_n) = ( 0, 1)
    
    Insertion op: ( 3, 1)
    delta = ((i_n - c_n) * (ls + 1)) - c_p + i_p
          = ((1 - 1) * (33 + 1)) - 0 + 3
          = 3
    
          ls   = 34
    (c_p, c_n) = ( 3, 1)
    
    Insertion op: (14, 2)
    delta = ((i_n - c_n) * (ls + 1)) - c_p + i_p
          = ((2 - 1) * (34 + 1)) - 3 + 14
          = 46
    
          ls   = 35
    (c_p, c_n) = (14, 2)
    
    Insertion op: ( 9, 3)
    delta = ((i_n - c_n) * (ls + 1)) - c_p + i_p
          = ((3 - 2) * (35 + 1)) - 14 + 9
          = 31
    
          ls   = 36
    (c_p, c_n) = ( 9, 3)
    
    Insertion op: (29, 4)
    delta = ((i_n - c_n) * (ls + 1)) - c_p + i_p
          = ((4 - 3) * (36 + 1)) - 9 + 29
          = 57
    
          ls   = 37
    (c_p, c_n) = (29, 4)
    
    Insertion op: (28, 5)
    delta = ((i_n - c_n) * (ls + 1)) - c_p + i_p
          = ((5 - 4) * (37 + 1)) - 29 + 28
          = 37
    
          ls   = 38
    (c_p, c_n) = (28, 5)
    
    Insertion op: (24, 6)
    delta = ((i_n - c_n) * (ls + 1)) - c_p + i_p
          = ((6 - 5) * (38 + 1)) - 28 + 24
          = 35
    
          ls   = 39
    (c_p, c_n) = (24, 6)
    
    Insertion op: (19, 7)
    delta = ((i_n - c_n) * (ls + 1)) - c_p + i_p
          = ((7 - 6) * (39 + 1)) - 24 + 19
          = 35
    
          ls   = 40
    (c_p, c_n) = (19, 7)
    
    Insertion op: (40, 7)
    delta = ((i_n - c_n) * (ls + 1)) - c_p + i_p
          = ((7 - 7) * (40 + 1)) - 19 + 40
          = 21
    
          ls   = 41
    (c_p, c_n) = (40, 7)
    
    Insertion op: (37, 8)
    delta = ((i_n - c_n) * (ls + 1)) - c_p + i_p
          = ((8 - 7) * (41 + 1)) - 40 + 37
          = 39
    
          ls   = 42
    (c_p, c_n) = (37, 8)
    
    Insertion op: (41, 8)
    delta = ((i_n - c_n) * (ls + 1)) - c_p + i_p
          = ((8 - 8) * (42 + 1)) - 37 + 41
          = 4
    
          ls   = 43
    (c_p, c_n) = (41, 8)
    
    Insertion op: (41, 9)
    delta = ((i_n - c_n) * (ls + 1)) - c_p + i_p
          = ((9 - 8) * (43 + 1)) - 41 + 41
          = 44
    
          ls   = 44
    (c_p, c_n) = (41, 9)
    
    Delta sequence:
    3, 46, 31, 57, 37, 35, 35, 21, 39, 4, 44

The delta sequence can then be encoded into a sequence of case-insensitive ASCII alphanumeric characters by using the method described in `FlexDelta.md`.  Using that procedure on the example delta sequence generated above results in the following:
    
    Original string:
    the1quick3brown2fox7jumps6over5
    a4lazy8dog987
    
    Invariant string:
    thequickbrownfoxjumpsoveralazydog
    
    Specials encoded as deltas:
    adbka5bvbba9a9avb3aebi

Deriving an oplist from a delta sequence uses a similar procedure, with the same initial state:

    Current coordinate state is (c_p, c_n)
    -> c_p is position
    -> c_n is special codepoint
    
    Current length state is ls
    
      t = c_p + delta
    i_p = (t MOD (ls + 1))
    i_n = c_n + (t DIV (ls + 1))
    
    Decoded insertion op is (i_p, i_n)
    -> i_p is position
    -> i_n is special codepoint
        
    Update state:
    -> Set c_p to i_p
    -> Set c_n to i_n
    -> Increment ls

The following shows how the example delta sequence we computed can be transformed back into an oplist:

    Delta sequence:
    3, 46, 31, 57, 37, 35, 35, 21, 39, 4, 44
    
    Initial state:
          ls   = 33 (length of invariant string)
    (c_p, c_n) = ( 0, 1)
    
    Delta: 3
      t = c_p + delta
        = 0 + 3
        = 3
    i_p = (t MOD (ls + 1))
        = (3 MOD (33 + 1))
        = 3
    i_n = c_n + (t DIV (ls + 1))
        = 1 + (3 DIV (33 + 1))
        = 1
    Decoded insertion op: ( 3, 1)
    
          ls   = 34
    (c_p, c_n) = ( 3, 1)
    
    Delta: 46
      t = c_p + delta
        = 3 + 46
        = 49
    i_p = (t MOD (ls + 1))
        = (49 MOD (34 + 1))
        = 14
    i_n = c_n + (t DIV (ls + 1))
        = 1 + (49 DIV (34 + 1))
        = 2
    Decoded insertion op: (14, 2)
    
          ls   = 35
    (c_p, c_n) = (14, 2)
    
    Delta: 31
      t = c_p + delta
        = 14 + 31
        = 45
    i_p = (t MOD (ls + 1))
        = (45 MOD (35 + 1))
        = 9
    i_n = c_n + (t DIV (ls + 1))
        = 2 + (45 DIV (35 + 1))
        = 3
    Decoded insertion op: ( 9, 3)
    
          ls   = 36
    (c_p, c_n) = ( 9, 3)
    
    Delta: 57
      t = c_p + delta
        = 9 + 57
        = 66
    i_p = (t MOD (ls + 1))
        = (66 MOD (36 + 1))
        = 29
    i_n = c_n + (t DIV (ls + 1))
        = 3 + (66 DIV (36 + 1))
        = 4
    Decoded insertion op: (29, 4)
    
          ls   = 37
    (c_p, c_n) = (29, 4)
    
    Delta: 37
      t = c_p + delta
        = 29 + 37
        = 66
    i_p = (t MOD (ls + 1))
        = (66 MOD (37 + 1))
        = 28
    i_n = c_n + (t DIV (ls + 1))
        = 4 + (66 DIV (37 + 1))
        = 5
    Decoded insertion op: (28, 5)
    
          ls   = 38
    (c_p, c_n) = (28, 5)
    
    Delta: 35
      t = c_p + delta
        = 28 + 35
        = 63
    i_p = (t MOD (ls + 1))
        = (63 MOD (38 + 1))
        = 24
    i_n = c_n + (t DIV (ls + 1))
        = 5 + (63 DIV (38 + 1))
        = 6
    Decoded insertion op: (24, 6)
    
          ls   = 39
    (c_p, c_n) = (24, 6)
    
    Delta: 35
      t = c_p + delta
        = 24 + 35
        = 59
    i_p = (t MOD (ls + 1))
        = (59 MOD (39 + 1))
        = 19
    i_n = c_n + (t DIV (ls + 1))
        = 6 + (59 DIV (39 + 1))
        = 7
    Decoded insertion op: (19, 7)
    
          ls   = 40
    (c_p, c_n) = (19, 7)
    
    Delta: 21
      t = c_p + delta
        = 19 + 21
        = 40
    i_p = (t MOD (ls + 1))
        = (40 MOD (40 + 1))
        = 40
    i_n = c_n + (t DIV (ls + 1))
        = 7 + (40 DIV (40 + 1))
        = 7
    Decoded insertion op: (40, 7)
    
          ls   = 41
    (c_p, c_n) = (40, 7)
    
    Delta: 39
      t = c_p + delta
        = 40 + 39
        = 79
    i_p = (t MOD (ls + 1))
        = (79 MOD (41 + 1))
        = 37
    i_n = c_n + (t DIV (ls + 1))
        = 7 + (79 DIV (41 + 1))
        = 8
    Decoded insertion op: (37, 8)
    
          ls   = 42
    (c_p, c_n) = (37, 8)
    
    Delta: 4
      t = c_p + delta
        = 37 + 4
        = 41
    i_p = (t MOD (ls + 1))
        = (41 MOD (42 + 1))
        = 41
    i_n = c_n + (t DIV (ls + 1))
        = 8 + (41 DIV (42 + 1))
        = 8
    Decoded insertion op: (41, 8)
    
          ls   = 43
    (c_p, c_n) = (41, 8)
    
    Delta: 44
      t = c_p + delta
        = 41 + 44
        = 85
    i_p = (t MOD (ls + 1))
        = (85 MOD (43 + 1))
        = 41
    i_n = c_n + (t DIV (ls + 1))
        = 8 + (85 DIV (43 + 1))
        = 9
    Decoded insertion op: (41, 9)
    
          ls   = 44
    (c_p, c_n) = (41, 9)
    
    Oplist (pos, char):
    [( 3, 1), (14, 2), ( 9, 3), (29, 4), (28, 5), (24, 6),
     (19, 7), (40, 7), (37, 8), (41, 8), (41, 9)]

We can therefore transform any oplist into a delta sequence, and any delta sequence back into an oplist.

## Summary

_In order to transform an original string into an invariant string and delta sequence:_

Transform the original string into an invariant string and an insertion map.  Transform the insertion map into an oplist.  Transform the oplist into a delta sequence.  Encode the delta sequence using `FlexDelta.md`.

_In order to transform an invariant string and delta sequence back into an original string:_

Decode the delta sequence using `FlexDelta.md`.  Transform the delta sequence into an oplist.  Transform the oplist into an insertion map.  Apply the insertion map to the invariant string to build back the original string.
