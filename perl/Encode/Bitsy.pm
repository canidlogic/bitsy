package Encode::Bitsy;
use parent qw(Exporter);
use strict;

# Core dependencies
use Unicode::Normalize;

#
# Export lists
# ============
#

# Symbols to export by default
#
our @EXPORT = qw(encodeBitsy);

#
# Constants
# =========
#

#
# The maximum number of codepoints allowed in file names.
#
my $LENGTH_LIMIT = 255;

#
# ASCII numeric character codes.
#
my $ASC_CTL_SO     = 0x0e;
my $ASC_CTL_SI     = 0x0f;
my $ASC_CTL_SUB    = 0x1a;
my $ASC_CTL_RS     = 0x1e;
my $ASC_CTL_MAX    = 0x1f;
my $ASC_HYPHEN     = 0x2d;
my $ASC_DOT        = 0x2e;
my $ASC_SLASH      = 0x2f;
my $ASC_ZERO       = 0x30;
my $ASC_FOUR       = 0x34;
my $ASC_NINE       = 0x39;
my $ASC_UPPER_A    = 0x41;
my $ASC_UPPER_Z    = 0x5a;
my $ASC_BACKSLASH  = 0x5c;
my $ASC_UNDERSCORE = 0x5f;
my $ASC_LOWER_A    = 0x61;
my $ASC_LOWER_M    = 0x6d;
my $ASC_LOWER_S    = 0x73;
my $ASC_LOWER_Y    = 0x79; 
my $ASC_LOWER_Z    = 0x7a;
my $ASC_CTL_DEL    = 0x7f;

#
# Surrogate ranges.
#
my $UC_SURROGATE_MIN = 0xd800;
my $UC_SURROGATE_MAX = 0xdfff;

#
# Maximum Unicode codepoint.
#
my $UC_MAX = 0x10ffff;

#
# Prefix strings.
#
my $PREFIX_ENCODE = "xz--";
my $PREFIX_ESCAPE = "xq--";

#
# Suffix used with an escape prefix to remove the prefix.
#
my $SUFFIX_REMOVE = "-x";

#
# Local functions
# ===============
#

# Check whether a given numeric codepoint value is an invariant 
# character for purposes of Bitsy encoding.
# 
# Invariant characters are defined by constraint 1 in StrictName.md to
# include ASCII alphanumerics (both uppercase and lowercase), as well as
# hyphen, underscore, and period.
# 
# Pass the NUMERIC codepoint value to check, not the actual character as
# a string.
# 
# Parameters:
# 
#   1 : integer - the numeric codepoint value to check
# 
# Return:
# 
#   1 if codepoint is invariant, 0 otherwise
#
sub isInvariantCode {
  
  # Check parameter count
  ($#_ == 0) or die "Wrong parameter count, stopped";
  
  # Get and check parameters
  my $cpv = shift;
  
  (not ref($cpv)) or die "Wrong parameter type, stopped";
  (int($cpv) == $cpv) or die "Wrong parameter type, stopped";
  $cpv = int($cpv);
  
  # Check if invariant
  if ((($cpv >= $ASC_ZERO) and ($cpv <= $ASC_NINE)) or
      (($cpv >= $ASC_UPPER_A) and ($cpv <= $ASC_UPPER_Z)) or
      (($cpv >= $ASC_LOWER_A) and ($cpv <= $ASC_LOWER_Z)) or
      ($cpv == $ASC_HYPHEN) or
      ($cpv == $ASC_UNDERSCORE) or
      ($cpv == $ASC_DOT)) {
    return 1;
  } else {
    return 0;
  }
}

# Check whether a string is at least "almost" a StrictName.
# 
# This returns true if the string satisfies all constraints except 
# constraint 7 in StrictName.md.  This also returns true for all
# StrictNames.
# 
# Parameters:
# 
#   1 : string - the string to check
# 
# Return:
# 
#   1 if a StrictName or StrictName except for constraint 7, 0 otherwise
#
sub isAlmostStrict {
  
  # Check parameter count
  ($#_ == 0) or die "Wrong parameter count, stopped";
  
  # Get and check parameters
  my $str = shift;
  (not ref($str)) or die "Wrong parameter type, stopped";
  $str = "$str";
  
  # Accept the special names . and .. without further checking
  if (($str eq ".") or ($str eq "..")) {
    return 1;
  }
  
  # Check length constraint (constraint 8)
  ((length($str) >= 1) and (length($str) <= $LENGTH_LIMIT)) or return 0;
  
  # Check that string only contains ASCII alphanumerics, hyphens,
  # underscores, and periods (constraints 1 & 2)
  ($str =~ /^[A-Za-z0-9\-_\.]+$/) or return 0;
  
  # Check that first character isn't a hyphen (constraint 3)
  (not ($str =~ /^-/)) or return 0;
  
  # Check that last character isn't a hyphen or period
  # (constraints 3 & 5)
  (not ($str =~ /[\-\.]$/)) or return 0;
  
  # Check that no hyphen is immediately preceded nor followed by a dot
  # (constraint 4)
  ((not ($str =~ /-\./)) and (not ($str =~ /\.-/))) or return 0;
  
  # Check that no dot is followed immediately by another dot
  # (constraint 6)
  (not ($str =~ /\.\./)) or return 0;
  
  # If we got here, string passes the check
  return 1;
}

# Check whether a given string is a StrictName.
# 
# Parameters:
# 
#   1 : string - the string to check
# 
# Return:
# 
#   1 if a StrictName, 0 otherwise
#
sub isStrictName {
  
  # Check parameter count
  ($#_ == 0) or die "Wrong parameter count, stopped";
  
  # Get and check parameters
  my $str = shift;
  (not ref($str)) or die "Wrong parameter type, stopped";
  $str = "$str";
  
  # Check if almost a strict name
  (isAlmostStrict($str)) or return 0;
  
  # If we got here, we just have to check constraint 7, so get the
  # device candidate, which is the whole string if no dot is present,
  # the empty string if dot is first character, or else the substring
  # up to but excluding the first dot
  $str =~ /^[^\.]*/;
  my $dc = $1;
  
  # Check if device candidate matches one of the reserved names
  if (($dc =~ /^aux$/i) or
      ($dc =~ /^com[0-9]$/i) or
      ($dc =~ /^con$/i) or
      ($dc =~ /^lpt[0-9]$/i) or
      ($dc =~ /^nul$/) or
      ($dc =~ /^prn$/)) {
    return 0;
  } else {
    return 1;
  }
}

# Given a Unicode string, derive an insertion map for it.
# 
# The insertion map is specified in DeltaEncoding.md.  Briefly, it is an
# array of integers, where negative integers encode a sequence of
# invariant characters, the length of which is the absolute value of the
# negative integer, and integers greater than zero encode a single
# special codepoint.
# 
# The given string must not include any characters with codepoint zero,
# and must not include any surrogates, or else a fault occurs.  Provided
# that these constraints are satisfied, this function accepts any string
# for transformation into an insertion map.
# 
# The isInvariantCode() function determines which codepoints are
# considered invariant.
# 
# Parameters:
# 
#   1 : string - the string to derive an insertion map for
# 
# Return:
# 
#   array in list context containing the derived insertion map
#
sub deriveInsertions {
  
  # Check parameter count
  ($#_ == 0) or die "Wrong number of parameters, stopped";
  
  # Get and check parameters
  my $str = shift;
  (not ref($str)) or die "Wrong parameter type, stopped";
  $str = "$str";
  
  # Result begins as an empty array
  my @result;
  
  # Invariant counter starts at zero
  my $icount = 0;
  
  # Go through the string character by character
  for my $c (split //, $str) {
  
    # Get current character code
    my $cc = ord($c);
    
    # Current character may not be nul and must be in Unicode range
    (($cc > 0) and ($cc <= $UC_MAX)) or die "Invalid input, stopped";
    
    # Current character may not be surrogate
    (($cc < $UC_SURROGATE_MIN) or ($cc > $UC_SURROGATE_MAX)) or
      die "Invalid input, stopped";
  
    # Check whether current codepoint is invariant and handle
    # appropriately
    if (isInvariantCode($cc)) {
      # Invariant code, so just increment the invariant counter
      $icount++;
      
    } else {
      # Not an invariant character, so first if we have invariant 
      # characters buffered, flush the buffer
      if ($icount > 0) {
        push @result, (0 - $icount);
        $icount = 0;
      }
      
      # Now add the special character codepoint into the array
      push @result, ($cc);
    }
  }
  
  # If we have invariant characters buffered, flush the buffer
  if ($icount > 0) {
    push @result, (0 - $icount);
    $icount = 0;
  }
  
  # Return result
  return @result;
}

# Given an original string value and an insertion map for the string, 
# use the insertion map to derive the invariant string from the original
# string.
# 
# You should pass an insertion map that was generated for the given 
# input string parameter using deriveInsertions().  The insertion map
# must be an array containing only non-zero integers.
#
# The returned invariant string might be empty.
# 
# Parameters:
# 
#   1 : string - the original string
# 
#   2 : array reference - an insertion map for the string
# 
# Return:
# 
#   the derived invariant string
#
sub deriveInvariant {
  
  # Check parameter count
  ($#_ == 1) or die "Wrong number of parameters, stopped";
  
  # Get and check parameters
  my $str = shift;
  my $ism = shift;

  (not ref($str)) or die "Wrong parameter type, stopped";
  $str = "$str";
  
  (ref($ism) eq 'ARRAY') or die "Wrong parameter type, stopped";
  for my $a (@$ism) {
    (not ref($a)) or die "Invalid insertion map, stopped";
    (int($a) == $a) or die "Invalid insertion map, stopped";
    ($a != 0) or die "Invalid insertion map, stopped";
  }
  
  # Start out the character read counter at zero and the result as an
  # empty string
  my $char_read = 0;
  my $result = "";
  
  # Step through the insertion map element by element to build the 
  # result
  for my $y (@$ism) {
    
    # Get copy of value
    my $x = $y;
    
    # Check what kind of element we have
    if ($x < 0) {
      # Run of invariants that we need to copy to result; begin by
      # inverting the value so we have the count of invariants
      $x = 0 - $x;
      
      # Make sure that this run of invariants does not extend beyond the
      # end of the string
      ($x <= length($str) - $char_read) or
        die "Invalid insertion map, stopped";
      
      # Copy this run of invariants to the result string
      if ($x >= length($str)) {
        $result = $result . $str;
      } else {
        $result = $result . substr($str, $char_read, $x);
      }
      
      # Update the char_read counter
      $char_read = $char_read + $x;
      
    } elsif ($x > 0) {
      # Special code in insertion map that won't be added to the
      # invariant string, so we just need to skip over it; increase
      # char_read by one
      $char_read++;
      
      # Make sure char_read hasn't exceeded the length in characters of
      # the string
      ($char_read <= length($str)) or
        die "Invalid insertion map, stopped";
      
    } else {
      # Shouldn't happen
      die "Unexpected";
    }
  }
  
  # Make sure the insertion map has covered the entire input string
  ($char_read == length($str)) or die "Invalid insertion map, stopped";
  
  # Make sure that each character in the result is invariant
  ($result =~ /^[A-Za-z0-9\-_\.]*$/) or
    die "Invalid insertion map, stopped";
  
  # Return the derived invariant string
  return $result;
}

# Given an invariant string and an insertion map, reconstruct the 
# encoded string and return it.
# 
# The invariant string may be any string value, provided that its length
# equals the absolute value of the sum of all negative values in ism.
# The invariant string may be empty.
# 
# The insertion map is described in detail in DeltaEncoding.md.
# Briefly, negative values encode a sequence of characters copied from
# the invariant string, with the absolute value of the negative integer
# determining the number of invariant characters to copy.  Zero values
# are not allowed in the insertion map.  Values greater than zero
# indicate the codepoint of a special character to insert.
#
# This function will make sure that all special codepoints inserted are
# greater than zero, in Unicode range, and not in surrogate range.
# 
# Parameters:
# 
#   1 : string - the invariant string
# 
#   2 : array reference - the insertion map to apply
# 
# Return:
# 
#   the reconstructed string
#
sub reconstruct {
  
  # Check parameter count
  ($#_ == 1) or die "Wrong number of parameters, stopped";
  
  # Get and check parameters
  my $ivstr = shift;
  my $ism = shift;
  
  (not ref($ivstr)) or die "Wrong parameter type, stopped";
  $ivstr = "$ivstr";
  
  (ref($ism) eq 'ARRAY') or die "Wrong parameter type, stopped";
  for my $a (@$ism) {
    (not ref($a)) or die "Invalid insertion map, stopped";
    (int($a) == $a) or die "Invalid insertion map, stopped";
    ($a != 0) or die "Invalid insertion map, stopped";
    ($a <= $UC_MAX) or die "Invalid insertion map, stopped";
    (($a < $UC_SURROGATE_MIN) or ($a > $UC_SURROGATE_MAX)) or
      die "Surrogate encoded in delta, stopped";
  }
  
  # Find the absolute value of the sum of all negative integers in
  # the insertion map and make sure it is equal to the length of the
  # invariant string
  my $cl = 0;
  for my $x (@$ism) {
    if ($x < 0) {
      $cl = $cl - $x;
    }
  }
  
  ($cl == length($ivstr)) or die "Invalid insertion map, stopped";
  
  # Start the result as an empty string and the invariant index at the
  # start of the invariant
  my $result = "";
  my $i = 0;
  
  # Reconstruct the original string
  for my $y (@$ism) {
    
    # Get copy of current value
    my $x = $y;
    
    # Handle current element
    if ($x < 0) {
      # Negative value encodes length of invariant sequence, so get
      # absolute value
      $x = 0 - $x;
      
      # Invariant sequence should be within remaining invariant
      ($x <= length($ivstr) - $i) or
        die "Invalid insertion map, stopped";
      
      # Transfer invariant sequence to result
      $result = $result . substr($ivstr, $i, $x);
      
      # Update invariant index
      $i = $i + $x;
      
    } elsif (($x > 0) and ($x <= $UC_MAX) and
                (($x < $UC_SURROGATE_MIN) or
                  ($x > $UC_SURROGATE_MAX))) {
      # Non-surrogate, Unicode special codepoint, so just append it to
      # string
      $result = $result . chr($x);
      
    } else {
      # Shouldn't happen
      die "Unexpected";
    }
  }
  
  # Return reconstructed original string
  return $result;
}

# Given an array reference to an array of integers, return the lowest
# element that is greater than zero, or -1 if there is no such element
# in the array.
#
# Parameters:
#
#   1 : array reference - the array to check
#
# Return:
#
#   the lowest integer value that is greater than zero in the array, or
#   -1 if there is no such value
#
sub imapMin {
  
  # Check parameter count
  ($#_ == 0) or die "Wrong number of parameters, stopped";
  
  # Get and check parameter
  my $ar = shift;
  (ref($ar) eq 'ARRAY') or die "Wrong parameter type, stopped";
  
  # Find desired value
  my $result = -1;
  for my $a (@$ar) {
    # Check that this is an integer value
    (not ref($a)) or die "Invalid array element, stopped";
    (int($a) == $a) or die "Invalid array element, stopped";
    
    # Only proceed if greater than zero
    if ($a > 0) {
      # Check if anything stored in result yet
      if ($result > 0) {
        # Result is filled, so update only if this value is lower
        if ($a < $result) {
          $result = int($a);
        }
        
      } else {
        # Nothing stored in result yet, so store this element
        $result = int($a);
      }
    }
  }
  
  # Return result
  return $result;
}

# Given an insertion map, generate an equivalent oplist.
# 
# CAUTION:  this function will leave the given insertion map array in an
# undefined state!
# 
# The oplist is defined in DeltaEncoding.md.  Briefly, it has a pair of
# coordinates for each element in the array.  The first coordinate gives
# the index in the string where to insert a special character and the
# second coordinate gives the codepoint value of the special character
# to insert.  The first coordinate may be equal to the length of the
# string to append at the end.  Taking the invariant string and running
# all insertions in the order given in the oplist would reconstruct the
# original string.
# 
# The oplist is furthermore sorted first by ascending SECOND coordinate
# values and secondarily by ascending first coordinate values.  This
# means the oplist is sorted primarily by the codepoint of the inserted
# special character, rather than by the insertion position in the
# string.
# 
# Parameters:
# 
#   1 : array reference - the insertion map to transform, which will be
#   left in an undefined state
# 
# Return:
# 
#   the generated oplist in list context
#
sub imapToOplist {
  
  # Check parameter count
  ($#_ == 0) or die "Wrong number of parameters, stopped";
  
  # Get and check parameters
  my $ism = shift;
  (ref($ism) eq 'ARRAY') or die "Wrong parameter type, stopped";
  for my $a (@$ism) {
    (not ref($a)) or die "Invalid insertion map, stopped";
    (int($a) == $a) or die "Invalid insertion map, stopped";
    ($a != 0) or die "Invalid insertion map, stopped";
  }
  
  # Oplist starts out empty
  my @opl;
  
  # Look for the lowest value in the insertion map that is greater than
  # zero
  my $min_val = imapMin($ism);
  
  # Keep processing while there is at least one value that is greater
  # than zero
  for(my $min_val = imapMin($ism);
      $min_val > 0;
      $min_val = imapMin($ism)) {
  
    # Go through ism map in sequential order, looking for elements that
    # match min_val and updating ccount; each negative value causes
    # ccount to increase by the absolute value of the negative value,
    # each zero value causes ccount to increment, and values greater
    # than zero have no effect on ccount; for elements that match
    # min_val, add an insertion op at position matching current value of
    # ccount and special character code matching min_val and then clear
    # the insertion map value to zero and increment ccount
    my $ccount = 0;
    for(my $i = 0; $i < scalar(@$ism); $i++) {
      # Get current element
      my $x = $ism->[$i];
      
      # Handle different element values
      if ($x < 0) {
        # Negative values increase ccount by their absolute value
        $ccount = $ccount - $x;
        
      } elsif ($x == 0) {
        # Zero values (representing a special character that has already
        # been inserted) increment ccount
        $ccount++;
        
      } elsif ($x == $min_val) {
        # We found a match for min_val, so add an insertion op
        push @opl, ([$ccount, $min_val]);
        
        # Clear the insertion map value to zero
        $ism->[$i] = 0;
        
        # Increment ccount to take into account the character we just
        # inserted
        $ccount++;
      }
    }
  }
  
  # Return the generated oplist
  return @opl;
}

# Given an oplist and the invariant string length, generate an 
# equivalent insertion map.
# 
# This function is the inverse of imapToOplist().  Faults will occur if
# there is any problem with the oplist.
# 
# Parameters:
# 
#   1 : array reference - the oplist to transform
# 
#   2 : integer - the length of the invariant string
# 
# Return:
# 
#   the generated insertion map in list context
#
sub oplistToImap {
  
  # Check parameter count
  ($#_ == 1) or die "Wrong parameter count, stopped";
  
  # Get and check parameters
  my $opl = shift;
  my $isl = shift;
  
  (ref($opl) eq 'ARRAY') or die "Wrong parameter type, stopped";
  for my $x (@$opl) {
    (ref($x) eq 'ARRAY') or die "Invalid oplist, stopped";
    (scalar(@$x) == 2) or die "Invalid oplist, stopped";
    ((not ref($x->[0])) and (not ref($x->[1]))) or
      die "Invalid oplist, stopped";
    ((int($x->[0]) == $x->[0]) and
        (int($x->[1]) == $x->[1])) or
      die "Invalid oplist, stopped";
    (($x->[0] >= 0) and ($x->[1] > 0) and ($x->[1] <= $UC_MAX)) or
      die "Invalid oplist, stopped";
  }
  
  (not ref($isl)) or die "Wrong parameter type, stopped";
  (int($isl) == $isl) or die "Wrong parameter type, stopped";
  $isl = int($isl);
  ($isl >= 0) or die "Invalid parameter value, stopped";
  
  # Start insertion map empty
  my @ism;
  
  # If invariant string is not empty, insert a negative value covering
  # the whole invariant string
  if ($isl > 0) {
    push @ism, (0 - $isl);
  }
  
  # Build the insertion map by applying all the insertion ops
  for my $x (@$opl) {
    
    # Get the insertion position of the current op
    my $p = $x->[0];
    
    # Find the greatest j such that the base position in the insertion
    # map at index j does not exceed p; j may also be equal to the
    # length of the insertion map
    my $j, $b;
    for($j = 0; $j <= scalar(@ism); $j++) {
      # If not first insertion map element, store previous b value
      my $pb;
      if ($j > 0) {
        $pb = $b;
      }
      
      # Compute base at j
      if ($j < 1) {
        $b = 0;
      } else {
        if ($ism[$j - 1] > 0) {
          $b++;
        } else {
          $b = $b - $ism[$j - 1];
        }
      }
      
      # If our base at j has exeeded the insertion position, greatest j
      # is previous element; if our base at j is equal to the insertion
      # position, then greatest j is current element; else continue
      # search
      if ($b > $p) {
        $j--;
        $b = $pb;
        last;
      } elsif ($b == $p) {
        last;
      }
      
      # If we get here and we've reached the element beyond the end of
      # the insertion map, the oplist was invalid
      ($j < scalar(@ism)) or die "Invalid oplist, stopped";
    }
    
    # Handle insertion cases
    if (($j >= scalar(@ism)) and ($b == $p)) {
      # j was beyond end of insertion array, so we need to append the
      # special codepoint to the end of the insertion array
      push @ism, ($x->[1]);
      
    } elsif (($j < scalar(@ism)) and ($b == $p)) {
      # j not beyond end of insertion array and element at index j has
      # base matching insertion point, so insert special codepoint
      # before index j in insertion array
      splice @ism, $j, 0, ($x->[1]);
      
    } elsif (($j < scalar(@ism)) && ($b < $p)) {
      # j not beyond end of insertion array and element at index j has
      # base that is less than insertion point, so it must be a negative
      # value that we have to split and insert the new codepoint in the
      # middle
      my $t = 0 - ($p - $b);
      splice @ism, $j, 1, ($t, $x->[1], $ism[$j] - $t);
    
    } else {
      # Shouldn't happen
      die "Unexpected";
    }
  }
  
  # Return the generated insertion map
  return @ism;
}

# Encode an integer value into a FlexDelta string.
# 
# The FlexDelta encoding is defined in FlexDelta.md.  The given 
# parameter may be any integer in range [0, 362797055].
# 
# Parameters:
# 
#   1 : integer - the value to encode
# 
# Return:
# 
#   string containing the FlexDelta encoding of the integer
#
sub encodeFlex {
  
  # Check parameter count
  ($#_ == 0) or die "Wrong number of parameters, stopped";
  
  # Get and check parameters
  my $v = shift;
  (not ref($v)) or die "Wrong parameter type, stopped";
  (int($v) == $v) or die "Wrong parameter type, stopped";
  $v = int($v);
  
  (($v >= 0) and ($v <= 362797055)) or
    die "Value out of range, stopped";
  
  # Determine the encoding length
  my $elen;
  if ($v < 432) {
    $elen = 2;
  } elsif ($v < 7776) {
    $elen = 3;
  } elsif ($v < 279936) {
    $elen = 4;
  } elsif ($v < 10077696) {
    $elen = 5;
  } else {
    $elen = 6;
  }

  # Start the result as an empty string
  my $result = "";
  
  # Compute all the digits that follow the first digit in reverse order
  for(my $i = 1; $i < $elen; $i++) {

    # Get current digit value and update value
    my $d = $v % 36;
    $v = int($v / 36);

    # Determine digit codepoint
    if ($d < 26) {
      $d = $d + $ASC_LOWER_A;
      
    } else {
      $d = $d - 26 + $ASC_ZERO;
    }

    # Prefix this digit to the result
    $result = chr($d) . $result;
  }
  
  # Now map the remaining value to a leading byte numeric value based on
  # the table with column "First" in FlexDelta.md
  if ($elen == 2) {
    $v = $v + 0;
    
  } elsif ($elen == 3) {
    $v = $v + 12;
    
  } elsif ($elen == 4) {
    $v = $v + 18;
    
  } elsif ($elen == 5) {
    $v = $v + 24;
    
  } elsif ($elen == 6) {
    $v = $v + 30;
    
  } else {
    # Shouldn't happen
    die "Unexpected";
  }
  
  # Convert leading byte numeric value to letter codepoint
  if ($v < 26) {
    $v = $v + $ASC_LOWER_A;
    
  } else {
    $v = $v - 26 + $ASC_ZERO;
  }
  
  # Prefix lead byte digit to the result
  $result = chr($v) . $result;
  
  # Return result
  return $result;
}

# Decode a FlexDelta string into an integer value.
# 
# The FlexDelta encoding is defined in FlexDelta.md.  The given 
# parameter must be a string of at least two characters.
# 
# The returned integer will be in range [0, 362797055].
# 
# Parameters:
# 
#   str : string - the FlexDelta encoding to decode
# 
# Return:
# 
#   decoded integer value
#
sub decodeFlex {
  
  # Check parameter count
  ($#_ == 0) or die "Wrong number of parameters, stopped";
  
  # Get and check parameters
  my $str = shift;
  (not ref($str)) or die "Wrong parameter type, stopped";
  $str = "$str";
  
  (length($str) >= 2) or die "Invalid parameter value, stopped";
  
  # Convert string to lowercase
  $str = $str =~ tr/A-Z/a-z/;
  
  # Split into first character and trailing characters
  my $str_first = substr $str, 0, 1;
  my $str_trail = substr $str, 1;
  
  # Get first character code
  my $c = ord($str_first);
  
  # Determine encoding length and initial numeric value from first
  # character code
  my $elen;
  my $result;
  
  if (($c >= $ASC_LOWER_A) and ($c <= $ASC_LOWER_Z)) {
    $c = $c - $ASC_LOWER_A;
    
  } elsif (($c >= $ASC_ZERO) and ($c <= $ASC_NINE)) {
    $c = $c - $ASC_ZERO + 26;
    
  } else {
    die "Invalid FlexDelta encoding";
  }
  
  if ($c < 12) {
    $elen = 2;
    $result = $c;
  
  } elsif ($c < 18) {
    $elen = 3;
    $result = $c - 12;
    
  } elsif ($c < 24) {
    $elen = 4;
    $result = $c - 18;
    
  } elsif ($c < 30) {
    $elen = 5;
    $result = $c - 24;
    
  } else {
    $elen = 6;
    $result = $c - 30;
  }
  
  # Make sure encoding length matches length of string
  (length($str) == $elen) or die "Invalid FlexDelta parsing";
  
  # Combine all remaining characters into result
  for my $s (split //, $str_trail) {
    # Get character code
    $c = ord($s);
    
    # Convert to numeric value
    if (($c >= $ASC_LOWER_A) and ($c <= $ASC_LOWER_Z)) {
      $c = $c - $ASC_LOWER_A;
      
    } elsif (($c >= $ASC_ZERO) and ($c <= $ASC_NINE)) {
      $c = $c - $ASC_ZERO + 26;
      
    } else {
      die "Invalid FlexDelta encoding";
    }
    
    # Combine into result
    $result = ($result * 36) + $c;
  }
  
  # Based on encoding length, make sure result is not "overlong"
  my $lbound;
  
  if ($elen == 2) {
    $lbound = 0;
    
  } elsif ($elen == 3) {
    $lbound = 432;
    
  } elsif ($elen == 4) {
    $lbound = 7776;
    
  } elsif ($elen == 5) {
    $lbound = 279936;
    
  } elsif ($elen == 6) {
    $lbound = 10077696;
    
  } else {
    # Shouldn't happen
    die "Unexpected";
  }
  
  ($result >= $lbound) or die "Overlong FlexDelta encoding";
  
  # Return decoded value
  return $result;
}

=item encodeBitsy(str)

Given an original string value, return the Bitsy-encoded string 
corresponding to that value.

A fault occurs if there is a problem with the given parameter or with
encoding it to Bitsy.  Use an eval block to catch encoding failures.

=cut

sub encodeBitsy {
  
  # Check parameter count
  ($#_ == 0) or die "Wrong parameter count, stopped";
  
  # Get and check parameter
  my $str = shift;
  (not ref($str)) or die "Wrong parameter type, stopped";
  $str = "$str";
  
  # Make sure input is not empty
  (length($str) > 0) or die "Input may not be empty";
  
  # Go through each codepoint of the input string and verify that no
  # ASCII control codes, no slashes, everything in Unicode range, and no
  # surrogates
  for my $s (split //, $str) {
  
    # Get current character code
    my $c = ord($s);
    
    # Check that not an ASCII control
    (($c > $ASC_CTL_MAX) and ($c != $ASC_CTL_DEL)) or
      die "Input contains ASCII control codes";
    
    # Check that no forward slashes
    ($c != $ASC_SLASH) or die "Input contains forward slashes";
    
    # Check that no backslashes
    ($c != $ASC_BACKSLASH) or die "Input contains backslashes";
    
    # Check that in Unicode range
    ($c <= $UC_MAX) or die "Input is outside of Unicode range";
    
    # Check that not a surrogate
    (($c < $UC_SURROGATE_MIN) or ($c > $UC_SURROGATE_MAX)) or
      die "Input contains surrogates";
  }
  
  # Make sure length in codepoints does not exceed limit
  (length($str) <= $LENGTH_LIMIT) or die "Input is too long";
  
  # Check whether there is at least one ASCII uppercase letter within
  # the string; we don't care about Unicode letters
  my $has_upper;
  if ($str =~ /[A-Z]/) {
    $has_upper = 1;
  } else {
    $has_upper = 0;
  }
  
  # Check whether we have one of the special prefixes already on the 
  # string (we don't need to do a case-insensitive check)
  my $has_prefix = 0;
  if (length($str) >= 4) {
    my $ps = substr $str, 0, 4;
    if (($ps eq $PREFIX_ENCODE) or ($ps eq $PREFIX_ESCAPE)) {
      $has_prefix = 1;
    }
  }
  
  # Check whether input is already a StrictName
  my $already_strict;
  if (isStrictName($str)) {
    $already_strict = 1;
  } else {
    $already_strict = 0;
  }
  
  # If already a StrictName, then also already almost strict; else, 
  # check whether name satisfies weaker "almost" criteria
  my $almost_strict;
  if ($already_strict) {
    $almost_strict = 1;
  } else {
    $almost_strict = isAlmostStrict($str);
  }
  
  # If the input is a StrictName AND it doesn't have uppercase letters
  # AND it doesn't have a prefix, then we can use pass-through encoding
  # so just return the file name as-is
  if ($already_strict and (not $has_upper) and (not $has_prefix)) {
    return $str;
  }
  
  # Otherwise, if the input is a StrictName AND it doesn't have 
  # uppercase letters BUT it has a prefix, we can use prefix encoding
  if ($already_strict and (not $has_upper) and $has_prefix) {
    
    # Split the string into the second character of the prefix, a
    # sequence of one or more non-period characters that follow the
    # prefix, and a sequence of zero or more period and non-period
    # characters at the end of the string
    ($str =~ /^x(.)--([^\.]+)(.*)$/) or die "Unexpected";
    my $sp = $1;
    my $sa = $2;
    my $sb = $3;
    
    # Return the prefix-encoded result
    return $PREFIX_ESCAPE . $sa . "-$sp" . $sb;
  }
  
  # Otherwise, if the input is almost strict AND it doesn't have 
  # uppercase letters AND it doesn't have a prefix, then we can use
  # device encoding
  if ($almost_strict and (not $has_upper) and (not $has_prefix)) {
    
    # Split the string into a sequence of one or more non-period
    # characters followed by a sequence of zero or more period and
    # non-period characters
    ($str =~ /^([^\.]+)(.*)$/) or die "Unexpected";
    my $sa = $1;
    my $sb = $2;
    
    # Return the device-encoded result
    return $PREFIX_ESCAPE . $sa . $SUFFIX_REMOVE . $sb;
  }
  
  # GENERAL ENCODING PROCEDURE =========================================
  
  # Unicode normalization ----------------------------------------------
  
  # We've already checked the input limitations and handled the special
  # encoding types; general encoding starts out by normalizing to NFC
  $str = NFC($str);
  
  # Normalization may have changed the length, so do a length check 
  # again
  (length($str) > 0) or die "Input normalized to empty";
  (length($str) <= $LENGTH_LIMIT) or die "Input normalization too long";
  
  # Dot conversion -----------------------------------------------------
  
  # Initialize the dot limit to -1 indicating limit beyond end of string
  my $dot_limit = -1;
  
  # Scan through the dots in the file name in reverse order, from last
  # to first
  for(my $i = rindex $str, ".";
      $i >= 0;
      $i = rindex $str, ".", $i) {
    
    # We found a dot; get the substring that starts at that dot and runs
    # to the end of the name
    my $cx = substr $str, $i;
    
    # Check whether dot is proper by prefixing an "a" to it and checking
    # whether the result is a StrictName
    if (isStrictName("a" . $cx)) {
      # Dot is proper, so update dot limit and continue
      $dot_limit = $i;
      
    } else {
      # Dot is not proper so do not update dot limit and stop scanning
      last;
    }
    
    # If we just handled the first character of the string, then leave
    # the loop; otherwise, decrement i so that the search resumes in the
    # next iteration
    if ($i < 1) {
      last;
    } else {
      $i--;
    }
  }
  
  # If dot_limit is zero, then change it to one; we always want to
  # convert an initial dot to RS, even if it is technically proper; we
  # handled special case "." earlier with pass-through encoding, so the
  # increased dot_limit will always still refer to a character that
  # exists within the string
  if ($dot_limit == 0) {
    $dot_limit = 1;
  }
  
  # If dot_limit remains at -1 then there are no proper dots, so convert
  # all dots to RS control codes; otherwise, convert only dots before
  # the dot limit to RS control codes
  if ($dot_limit < 0) {
    # No proper dots, so convert all dots to RS control codes
    $str =~ s/\./\x{1e}/g;
    
  } else {
    # Dot limit is in effect, and we know both that it is greater than
    # zero at this point and also refers to a character that exists
    # within the string; split string into two substrings, one before
    # the dot limit and the other from the dot limit to the end of the
    # string
    my $sa = substr $str, 0, $dot_limit;
    my $sb = substr $str, $dot_limit;
    
    # Only convert dots in the substring prior to the dot limit to RS
    # control codes
    $sa =~ s/\./\x{1e}/g;
    
    # Rejoin the strings
    $str = $sa . $sb;
  }
  
  # Casing conversion --------------------------------------------------
  
  # The casing state will start out lowercase
  my $upper_state = 0;
  
  # Split the string into an array where each element of the array is a
  # single character
  my @stra = split //, $str;
  
  # Go through the string array character by character
  for(my $i = 0; $i <= $#stra; $i++) {
    # Get the character code at this location
    my $c = ord($stra[$i]);
    
    # Figure out the ASCII letter case of this character, or skip this
    # character if it is not an ASCII letter
    my $upper_c;
    if (($c >= $ASC_UPPER_A) and ($c <= $ASC_UPPER_Z)) {
      # Uppercase
      $upper_c = 1;
      
    } elsif (($c >= $ASC_LOWER_A) and ($c <= $ASC_LOWER_Z)) {
      # Lowercase
      $upper_c = 0;
      
    } else {
      # Not an ASCII letter, so skip
      next;
    }
    
    # If letter case of current ASCII letter matches the current case
    # state, then we do not need to do anything so skip it
    if ($upper_c == $upper_state) {
      next;
    }
    
    # If we got here, we found an ASCII letter that does not match the
    # current case state, so we will need to examine the case of the
    # next ASCII letter (if there is one) to determine which casing
    # control code to use; begin by setting the upper_next flag to the
    # inverse of the current casing state, so that if there is no ASCII
    # letter following this one, SUB will be the control code used
    my $upper_next;
    if ($upper_c) {
      $upper_next = 0;
    } else {
      $upper_next = 1;
    }
    
    # Scan any remaining characters in the string until we reach the end
    # of the string or find an ASCII letter; if we find an ASCII letter,
    # store its case in upper_next
    for(my $j = $i + 1; $j <= $#stra; $j++) {
      # Get the character
      my $c2 = ord($stra[$j]);
      
      # If we found a letter, set the upper_next flag to match its case
      # and leave the loop
      if (($c2 >= $ASC_UPPER_A) and ($c2 <= $ASC_UPPER_Z)) {
        # Uppercase
        $upper_next = 1;
        last;
      
      } elsif (($c2 >= $ASC_LOWER_A) and ($c2 <= $ASC_LOWER_Z)) {
        # Lowercase
        $upper_next = 0;
        last;
      }
    }
    
    # upper_next is now set to the case of the next ASCII letter in the
    # string (or the inverse of the current case if no more ASCII 
    # letters in string), so determine which control code needs to be
    # inserted as c2 and change casing state if SI or SO
    my $cct;
    if ($upper_next == $upper_c) {
      # The case of the next letter matches the case of the current
      # letter, so use an SI if this case is uppercase or an SO if this
      # case is lowercase, and update the casing state to match this
      # case
      if ($upper_c) {
        $cct = $ASC_CTL_SI;
      } else {
        $cct = $ASC_CTL_SO;
      }
      $upper_state = $upper_c;
      
    } else {
      # The case of the current letter does not match the case of the
      # next letter (or there is no next letter), so use a SUB control
      # code and do not update the casing state
      $cct = $ASC_CTL_SUB;
    }
    
    # Insert the control code before the current character in the string
    # array
    splice @stra, $i, 0, chr($cct);
    
    # Increment i to account for the inserted control code
    $i++;
  }
  
  # Rejoin all the characters in the array into the string again
  $str = join "", @stra;
  
  # Casing conversion may have extended the length, so do a length check
  # once again
  (length($str) <= $LENGTH_LIMIT) or die "Input encoding too long";
  
  # Split into invariant and oplist ------------------------------------

  # Derive an insertion map from the string
  my @ar = deriveInsertions($str);

  # Replace the string with an invariant string derived from it and the
  # insertion map
  $str = deriveInvariant($str, \@ar); 
  
  # Convert the insertion map into an oplist
  @ar = imapToOplist(\@ar);
  
  # Delta array encoding -----------------------------------------------
  
  # Length state starts out with length of invariant string
  my $ls = length($str);
  
  # Set initial coordinate state
  my $c_p = 0;
  my $c_n = 1;
  
  # Now go through the oplist and replace each element with a delta
  # encoding so that the oplist will be transformed into a delta array
  for(my $i = 0; $i <= $#ar; $i++) {
    
    # Get current element reference
    my $x = $ar[$i];
    
    # Compute the delta using the formula from DeltaEncoding.md
    my $d = (($x->[1] - $c_n) * ($ls + 1)) - $c_p + $x->[0];
    
    # Update state
    $c_p = $x->[0];
    $c_n = $x->[1];
    $ls++;
    
    # Replace current array element with the delta
    $ar[$i] = $d;
  }
  
  # Start the delta suffix out empty and then add each encoded value
  my $ds = "";
  for my $dv (@ar) {
    $ds = $ds . encodeFlex($dv);
  }
  
  # If delta suffix is empty, replace it with special marker aa
  if (length($ds) < 1) {
    $ds = "aa";
  }
  
  # Final assembly -----------------------------------------------------
  
  # If invariant string is not empty, insert a hyphen at the start of
  # the delta suffix
  if (length($str) > 0) {
    $ds = '-' . $ds;
  }
  
  # Split invariant string into a sequence of zero or more non-period
  # characters followed by a sequence of zero or more period and
  # non-period characters
  ($str =~ /^([^\.]*)(.*)$/) or die "Unexpected";
  my $saa = $1;
  my $sbb = $2;
  
  # Assemble the final string
  $str = $PREFIX_ENCODE . $saa . $ds . $sbb;
  
  # Final length check
  (length($str) <= $LENGTH_LIMIT) or die "Input encoding too long";
  
  # We should have a StrictName
  (isStrictName($str)) or die "Encoding is not strict";
  
  # Return the encoded result
  return $str;
}

# Finish with something that evaluates to true
#
1;
