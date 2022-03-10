# Delta Encoding Algorithm

Delta encoding is a method for encoding special characters within a source string, based on the Bootstring algorithm.

Delta encoding takes as input an _insertion map_ and produces as output a _delta string._  Delta decoding (the reverse process) takes as input a delta string and produces as output an insertion map.  Apply delta encoding to an insertion map and then delta decoding the result of that will get back the original insertion map.

## Insertion map

An __insertion map__ is an array of signed integers.  Integer values that are less than zero encode a sequence of one or more _invariant characters,_ such that the invariant character sequence has a length in characters equal to the absolute value of the negative integer.  Integer values that are greater than zero encode special characters that are inserted into the string.  The integer value zero is reserved for use as a marker character (see later).

Suppose that letters `a` through `z` are invariant characters and that numeric digits `1` through `9` are special characters that map to equivalent numeric values in the insertion map.  The following shows an example of how a string containing invariant characters and special characters is represented by an insertion map:

    Invariant : a-z
    Special   : 1-9
    
    String:
    the1quick3brown2fox7jumps6over5
    a4lazy8dog987
    
    Insertion map:
    -3, 1,-5, 3,-5, 2,-3, 7,-5, 6,-4, 5,
    -1, 4,-4, 8,-3, 9, 8, 7
    
    String with special characters dropped:
    thequickbrownfoxjumpsoveralazydog

As you can see from this example, each sequence of invariant characters in the string gets replaced by a single negative integer in the insertion map that counts (by absolute value) the number of characters in the invariant sequence.  The special characters get replaced by their equivalent numeric values (greater than zero) in the insertion map.

When all the special characters are dropped from the string, leaving only the invariant characters, the length of the invariant-only string is always equal to the absolute value of the sum of all negative integers in the insertion map.  You can confirm in the above example that the string with special characters dropped has 33 characters and the absolute value of the sum of all negative integers in the insertion map is also 33.

If you have the string with invariant characters only, the insertion map, and you know which character each non-negative value in the insertion map corresponds to, you can get back the original string with the special characters inserted.  You do this by running through the insertion map integer by integer.  If you encounter an integer that is less than zero, take its absolute value and copy that many invariant characters from the invariant string to output.  If you encounter an integer that is greater than zero, map this special character index to the special character and insert that special character into the output string.  (The reserved zero value never occurs in a valid insertion map.)  The following example shows how the string with special characters dropped and the insertion map from the previous example are used to reconstruct the original string:

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

In order to convert between an insertion map and a delta encoding, the intermediate stage is the _oplist,_ which represents the insertion map as a sequence of insertions that are ordered in the proper manner for delta encoding.

The __oplist__ is a sequence of zero or more _insertion ops,_ each of which is a pair of integers storing an insertion position and an insertion code.  The insertion position is the index of codepoint within the string, where zero means insert before the first character of the string, one means insert before the second character of the the string, and so forth.  The string length is also a valid insertion position, which means insert at the end of the string, after the last codepoint.  The insertion code is the special code value that will be inserted, which matches the (greater than zero) special code value from the insertion map.

Insertion ops within the oplist must be sorted first in ascending order by insertion code (__not__ by insertion position).  Insertion ops with the same insertion code must be sorted in ascending order of insertion position within the string.  This ordering is the key difference between the oplist and the insertion map:  the insertion map is sorted primarily by insertion position, while the oplist is sorted primarily by insertion code (which is required for delta encoding).

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

You can run through the generated oplist instructions one by one and use them to transform the invariant string back into the original string with special characters:

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

Given the length of the invariant string and an oplist, you can reconstruct the insertion map using the following algorithm.  Start the insertion map out as an empty array.  If the invariant string has a length that is greater than zero, insert a negative value into the insertion map such that the absolute value of the negative value equals the length of the invariant string.  Then, transform the insertion map by each insertion op in the order given in the oplist with the following procedure.  For each 

Find the insertion index `i`: if the insertion map is empty, `i` is zero; else, start `i` at zero and iterate over the 