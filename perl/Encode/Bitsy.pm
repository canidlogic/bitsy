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
      ($cpv === $ASC_HYPHEN) or
      ($cpv === $ASC_UNDERSCORE) or
      ($cpv === $ASC_DOT)) {
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
  $dc = $1;
  
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
  for my $c (split / */, $str) {
  
    # Get current character code
    $c = ord($c);
    
    # Current character may not be nul and must be in Unicode range
    (($c > 0) and ($c <= $UC_MAX)) or die "Invalid input, stopped";
    
    # Current character may not be surrogate
    (($c < $UC_SURROGATE_MIN) or ($c > $UC_SURROGATE_MAX)) or
      die "Invalid input, stopped";
  
    # Check whether current codepoint is invariant and handle
    # appropriately
    if (isInvariantCode($c)) {
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
      push @result, ($c);
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
  for my $x (@$ism) {
    
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
      
    } else if ($x > 0) {
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
  for my $x (@$ism) {
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
      
    } else if (($x > 0) and (x <= $UC_MAX) and
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
      $x = $ism->[$i];
      
      # Handle different element values
      if ($x < 0) {
        # Negative values increase ccount by their absolute value
        $ccount = $ccount - $x;
        
      } else if ($x == 0) {
        # Zero values (representing a special character that has already
        # been inserted) increment ccount
        $ccount++;
        
      } else if ($x == $min_val) {
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
    for($j = 0; $j <= scalar(@$ism); $j++) {
      # If not first insertion map element, store previous b value
      my $pb;
      if ($j > 0) {
        $pb = $b;
      }
      
      # Compute base at j
      if ($j < 1) {
        $b = 0;
      } else {
        if ($ism->[$j - 1] > 0) {
          $b++;
        } else {
          $b = $b - $ism->[$j - 1];
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
      } else if ($b == $p) {
        last;
      }
      
      # If we get here and we've reached the element beyond the end of
      # the insertion map, the oplist was invalid
      ($j < scalar(@$ism)) or die "Invalid oplist, stopped";
    }
    
    # Handle insertion cases
    if (($j >= scalar(@$ism) and ($b == $p)) {
      # j was beyond end of insertion array, so we need to append the
      # special codepoint to the end of the insertion array
      push @ism, ($x->[1]);
      
    } else if (($j < scalar(@$ism)) and ($b == $p)) {
      # j not beyond end of insertion array and element at index j has
      # base matching insertion point, so insert special codepoint
      # before index j in insertion array
      splice @$ism, $j, 0, ($x->[1]);
      
    } else if (($j < scalar(@$ism)) && ($b < $p)) {
      # j not beyond end of insertion array and element at index j has
      # base that is less than insertion point, so it must be a negative
      # value that we have to split and insert the new codepoint in the
      # middle
      my $t = 0 - ($p - $b);
      splice @$ism, $j, 1, ($t, $x->[1], $ism->[$j] - $t);
    
    } else {
      # Shouldn't happen
      die "Unexpected";
    }
  }
  
  # Return the generated insertion map
  return @ism;
}
