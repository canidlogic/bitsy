"use strict";

/*
 * bitsy.js
 * ========
 * 
 * JavaScript client module for encoding and decoding Bitsy file names.
 */

// Wrap everything in an anonymous function that we immediately invoke
// after it is declared -- this prevents anything from being implicitly
// added to global scope
(function() {

  /*
   * Constants
   * =========
   */
  
  /*
   * The maximum number of codepoints allowed in file names.
   */
  var LENGTH_LIMIT = 255;
  
  /*
   * ASCII numeric character codes.
   */
  var ASC_CTL_SO     = 0x0e;
  var ASC_CTL_SI     = 0x0f;
  var ASC_CTL_SUB    = 0x1a;
  var ASC_CTL_RS     = 0x1e;
  var ASC_CTL_MAX    = 0x1f;
  var ASC_HYPHEN     = 0x2d;
  var ASC_DOT        = 0x2e;
  var ASC_SLASH      = 0x2f;
  var ASC_ZERO       = 0x30;
  var ASC_FOUR       = 0x34;
  var ASC_NINE       = 0x39;
  var ASC_UPPER_A    = 0x41;
  var ASC_UPPER_Z    = 0x5a;
  var ASC_BACKSLASH  = 0x5c;
  var ASC_UNDERSCORE = 0x5f;
  var ASC_LOWER_A    = 0x61;
  var ASC_LOWER_M    = 0x6d;
  var ASC_LOWER_S    = 0x73;
  var ASC_LOWER_Y    = 0x79; 
  var ASC_LOWER_Z    = 0x7a;
  var ASC_CTL_DEL    = 0x7f;

  /*
   * Surrogate ranges.
   */
  var UC_SURROGATE_MIN = 0xd800;
  var UC_SURROGATE_MAX = 0xdfff;
  
  var UC_HISUR_MIN = 0xd800;
  var UC_HISUR_MAX = 0xdbff;
  
  var UC_LOSUR_MIN = 0xdc00;
  var UC_LOSUR_MAX = 0xdfff;
  
  /*
   * Maximum Unicode codepoint.
   */
  var UC_MAX = 0x10ffff;
  
  /*
   * Prefix strings.
   */
  var PREFIX_ENCODE = "xz--";
  var PREFIX_ESCAPE = "xq--";
  
  /*
   * Suffix used with an escape prefix to remove the prefix.
   */
  var SUFFIX_REMOVE = "-x";

  /*
   * Exception constructors
   * ======================
   */

  /*
   * Constructor for an EncodeException.
   * 
   * Invoke with "new EncodeException(message, tooLong)"
   * 
   * Resulting object has a "tooLong" boolean property and a "toString"
   * method that returns the message.
   * 
   * Parameters:
   * 
   *   message : string - the error message stored in this exception
   * 
   *   tooLong : boolean - true if the reason for this exception is
   *   because the encoded string would be too long, false otherwise
   */
  function EncodeException(message, tooLong) {
    
    // If message isn't a string, change it to a generic message
    if (typeof(message) !== "string") {
      message = "Unknown Bitsy encoding error";
    }
    
    // If tooLong isn't a boolean, change it to false
    if (typeof(tooLong) !== "boolean") {
      tooLong = false;
    }
    
    // Set up the object
    this.tooLong = tooLong;
    this.toString = function() {
      return message;
    };
  }

  /*
   * Constructor for a DecodeException.
   * 
   * Invoke with "new DecodeException(message)"
   * 
   * Resulting object has a "toString" method that returns the message.
   * 
   * Parameters:
   * 
   *   message : string - the error message stored in this exception
   */
  function DecodeException(message) {
    
    // If message isn't a string, change it to a generic message
    if (typeof(message) !== "string") {
      message = "Unknown Bitsy decoding error";
    }
    
    // Set up the object
    this.toString = function() {
      return message;
    };
  }

  /*
   * Local functions
   * ===============
   */

  /*
   * Report an error to console and throw an exception for a fault
   * occurring within this module.
   *
   * Parameters:
   *
   *   func_name : string - the name of the function in this module
   *
   *   loc : number(int) - the location within the function
   */
  function fault(func_name, loc) {
    
    // If parameters not valid, set to unknown:0
    if ((typeof func_name !== "string") || (typeof loc !== "number")) {
      func_name = "unknown";
      loc = 0;
    }
    loc = Math.floor(loc);
    if (!isFinite(loc)) {
      loc = 0;
    }
    
    // Report error to console
    console.log("Fault at " + func_name + ":" + String(loc) +
                  " in bitsy");
    
    // Throw exception
    throw ("bitsy:" + func_name + ":" + String(loc));
  }

  /*
   * Check whether a given numeric codepoint value is an invariant
   * character for purposes of Bitsy encoding.
   * 
   * Invariant characters are defined by constraint 1 in StrictName.md
   * to include ASCII alphanumerics (both uppercase and lowercase), as
   * well as hyphen, underscore, and period.
   * 
   * Pass the NUMERIC codepoint value to check, not the actual character
   * as a string.
   * 
   * Parameters:
   * 
   *   cpv : integer - the numeric codepoint value to check
   * 
   * Return:
   * 
   *   true if codepoint is invariant, false otherwise
   */
  function isInvariantCode(cpv) {
    
    var func_name = "isInvariantCode";
    
    // Check parameter
    if (typeof(cpv) !== "number") {
      fault(func_name, 100);
    }
    if (!isFinite(cpv)) {
      fault(func_name, 110);
    }
    if (Math.floor(cpv) !== cpv) {
      fault(func_name, 120);
    }
    
    // Check if invariant
    if (((cpv >= ASC_ZERO) && (cpv <= ASC_NINE)) ||
        ((cpv >= ASC_UPPER_A) && (cpv <= ASC_UPPER_Z)) ||
        ((cpv >= ASC_LOWER_A) && (cpv <= ASC_LOWER_Z)) ||
        (cpv === ASC_HYPHEN) ||
        (cpv === ASC_UNDERSCORE) ||
        (cpv === ASC_DOT)) {
      return true;
    } else {
      return false;
    }
  }

  /*
   * Check whether a string is at least "almost" a StrictName.
   * 
   * This returns true if the string satisfies all constraints except
   * constraint 7 in StrictName.md.  This also returns for all
   * StrictNames.
   * 
   * Parameters:
   * 
   *   str : string - the string to check
   * 
   * Return:
   * 
   *   true if a StrictName or StrictName except for constraint 7, false
   *   otherwise
   */
  function isAlmostStrict(str) {
    
    var func_name = "isAlmostStrict";
    var i, c;
    
    // Check parameter
    if (typeof(str) !== "string") {
      fault(func_name, 100);
    }
    
    // Accept the special names . and .. without further checking
    if ((str === ".") || (str === "..")) {
      return true;
    }
    
    // Check length constraint (constraint 8)
    if ((str.length < 1) || (str.length > LENGTH_LIMIT)) {
      return false;
    }
    
    // Go through and check each character
    for(i = 0; i < str.length; i++) {
      
      // Get current character code
      c = str.charCodeAt(i);
      
      // Check that character code is ASCII alphanumeric or hyphen
      // underscore or period (constraints 1 & 2)
      if (!isInvariantCode(c)) {
        return false;
      }
      
      // If this is the first character, check that it isn't a
      // hyphen (constraint 3)
      if ((i < 1) && (c === ASC_DOT)) {
        return false;
      }
      
      // If this is the last character, check that it isn't a
      // hyphen or period (constraints 3 & 5)
      if (i >= str.length - 1) {
        if ((c === ASC_HYPHEN) || (c === ASC_DOT)) {
          return false;
        }
      }
      
      // If this is a hyphen, check that the preceding character is not
      // a dot and that the next character is not a dot (constraint 4)
      if ((i > 0) && (c === ASC_HYPHEN)) {
        if (str.charCodeAt(i - 1) === ASC_DOT) {
          return false;
        }
      }
      if ((i < str.length - 1) && (c === ASC_HYPHEN)) {
        if (str.charCodeAt(i + 1) === ASC_DOT) {
          return false;
        }
      }
      
      // If this is a dot before the last character, make sure that the
      // next character is not also a dot (constraint 6)
      if ((i < str.length - 1) && (c === ASC_DOT)) {
        if (str.charCodeAt(i + 1) === ASC_DOT) {
          return false;
        }
      }
    }
    
    // If we got here, string passes the check
    return true;
  }

  /*
   * Check whether a given string is a StrictName.
   * 
   * Parameters:
   * 
   *   str : string - the string to check
   * 
   * Return:
   * 
   *   true if a StrictName, false otherwise
   */
  function isStrictName(str) {
    
    var func_name = "isStrictName";
    var first_dot, dc, c;
    
    // Check parameter
    if (typeof(str) !== "string") {
      fault(func_name, 100);
    }
    
    // Check if almost a strict name
    if (!isAlmostStrict(str)) {
      return false;
    }
    
    // If we got here, we just have to check constraint 7, so find the
    // first dot, if there is one
    first_dot = str.indexOf(".");
    
    // Get the device candidate, which is the whole string if not dot,
    // the empty string if dot is first character, or else the substring
    // up to but excluding the first dot
    if (first_dot < 0) {
      dc = str;
    } else if (first_dot === 0) {
      dc = "";
    } else {
      dc = str.slice(0, first_dot);
    }
    
    // If device candidate is less than three characters or more than
    // four characters, there is no device match so check passes
    if ((dc.length < 3) || (dc.length > 4)) {
      return true;
    }
    
    // If device candidate is four characters and fourth character is
    // not a decimal digit, there is no device match so check passes;
    // otherwise, replace the fourth character with "#"
    if (dc.length === 4) {
      c = dc.charCodeAt(3);
      if ((c >= ASC_ZERO) && (c <= ASC_NINE)) {
        dc = dc.slice(0, 3) + "#";
      } else {
        return true;
      }
    }
    
    // Convert device candidate to lowercase (we know that the device
    // candidate only contains ASCII)
    dc = dc.toLowerCase();
    
    // Check if device candidate matches one of the reserved names
    if ((dc === "aux") ||
        (dc === "com#") ||
        (dc === "con") ||
        (dc === "lpt#") ||
        (dc === "nul") ||
        (dc === "prn")) {
      return false;
    } else {
      return true;
    }
  }

  /*
   * Count the number of CODE POINTS within a string.
   * 
   * This is NOT the same as the number of characters, because surrogate
   * pairs only count as a single codepoint but two characters.
   * 
   * A fault occurs if there are any improperly paired surrogates.
   * 
   * Parameters:
   * 
   *   str : string - the string to check
   * 
   * Return:
   * 
   *   the number of codepoints in the string
   */
  function getCPC(str) {
    
    var func_name = "getCPC";
    var i, c, c2, result;
    
    // Check parameter
    if (typeof(str) !== "string") {
      fault(func_name, 100);
    }
    
    // Count the characters in the string, except do not count low
    // surrogates; also, check that all surrogates are properly paired
    result = 0;
    for(i = 0; i < str.length; i++) {
      
      // Get current character code
      c = str.charCodeAt(i);
      
      // Handle depending on type
      if ((c >= UC_HISUR_MIN) && (c <= UC_HISUR_MAX)) {
        // High surrogate, so make sure not last character
        if (i >= str.length - 1) {
          fault(func_name, 200);
        }
        
        // Check that next character is low surrogate
        c2 = str.charCodeAt(i + 1);
        if ((c2 < UC_LOSUR_MIN) || (c2 > UC_LOSUR_MAX)) {
          fault(func_name, 210);
        }
        
        // Increase result count for the whole surrogate pair, and also
        // increment i to skip over the low surrogate
        result++;
        i++;
        
      } else if ((c >= UC_LOSUR_MIN) && (c <= UC_LOSUR_MAX)) {
        // We only get here if we encounter an unpaired low surrogate,
        // so fault
        fault(func_name, 300);
        
      } else {
        // Not a surrogate, so just increase the result count
        result++;
      }
    }
    
    // Return result
    return result;
  }

  /*
   * Given a Unicode string, derive an insertion map for it.
   * 
   * The insertion map is specified in DeltaEncoding.md.  Briefly, it is
   * an array of integers, where negative integers encode a sequence of
   * invariant characters, the length of which is the absolute value of
   * the negative integer, and integers greater than zero encode a
   * single special codepoint.
   * 
   * The given string must not include any characters with codepoint
   * zero, and must not include any improperly paired surrogates, or
   * else a fault occurs.  Provided that these constraints are
   * satisfied, this function accepts any string for transformation into
   * an insertion map.
   * 
   * The isInvariantCode() function determines which codepoints are
   * considered invariant.  Supplemental codepoints may never be
   * invariant.
   * 
   * Parameters:
   * 
   *   str : string - the string to derive an insertion map for
   * 
   * Return:
   * 
   *   an array containing the derived insertion map
   */
  function deriveInsertions(str) {
    
    var func_name = "deriveInsertions";
    var result, icount;
    var i, c, c2;
    
    // Check parameter
    if (typeof(str) !== "string") {
      fault(func_name, 100);
    }
    
    // Result begins as an empty array
    result = [];
    
    // Invariant counter starts at zero
    icount = 0;
    
    // Go through the string character by character
    for(i = 0; i < str.length; i++) {
    
      // Get current character
      c = str.charCodeAt(i);
      
      // Current character may not be nul
      if (c < 1) {
        fault(func_name, 190);
      }
      
      // Current character must not be low surrogate or it would be
      // improperly paired
      if ((c >= UC_LOSUR_MIN) && (c <= UC_LOSUR_MAX)) {
        fault(func_name, 200);
      }
      
      // If current character is high surrogate, then make sure it is
      // not the last character, make sure it is followed by a low
      // surrogate, and then replace character by the decoded
      // supplemental value, make sure the supplemental value is not
      // invariant, and increment i so that the low surrogate is skipped
      // over next loop iteration
      if ((c >= UC_HISUR_MIN) && (c <= UC_HISUR_MAX)) {
        // Make sure not last character
        if (i >= str.length - 1) {
          fault(func_name, 300);
        }
        
        // Get next character
        c2 = str.charCodeAt(i + 1);
        
        // Make sure next character is low surrogate
        if ((c2 < UC_LOSUR_MIN) || (c2 > UC_LOSUR_MAX)) {
          fault(func_name, 310);
        }
        
        // Convert both surrogates to their offset from the base
        // surrogate codes
        c = c - UC_HISUR_MIN;
        c2 = c2 - UC_LOSUR_MIN;
        
        // Combine both surrogates into a single supplemental offset
        c = (c << 10) + c2;
        
        // Get the decoded supplemental codepoint value
        c = c + 0x10000;
        
        // Make sure supplemental codepoint is not invariant
        if (isInvariantCode(c)) {
          fault(func_name, 320);
        }
        
        // Increment i to skip over the low surrogate
        i++;
      }
    
      // Check whether current codepoint is invariant and handle
      // appropriately
      if (isInvariantCode(c)) {
        // Invariant code, so just increment the invariant counter
        icount++;
        
      } else {
        // Not an invariant character, so first if we have invariant
        // characters buffered, flush the buffer
        if (icount > 0) {
          result.push(0 - icount);
          icount = 0;
        }
        
        // Now add the special character codepoint into the array
        result.push(c);
      }
    }
    
    // If we have invariant characters buffered, flush the buffer
    if (icount > 0) {
      result.push(0 - icount);
      icount = 0;
    }
    
    // Return result
    return result;
  }

  /*
   * Given an original string value and an insertion map for the string,
   * use the insertion map to derive the invariant string from the
   * original string.
   * 
   * You should pass an insertion map that was generated for the given
   * input string parameter using deriveInsertions().  The insertion map
   * must be an array containing only non-zero integers.
   * 
   * The returned invariant string might be empty.
   * 
   * Parameters:
   * 
   *   str : string - the original string
   * 
   *   ism : Array of integers - an insertion map for the string
   * 
   * Return:
   * 
   *   the derived invariant string
   */
  function deriveInvariant(str, ism) {
    
    var func_name = "deriveInvariant";
    var result;
    var char_read, j;
    
    // Check parameters
    if (typeof(str) !== "string") {
      fault(func_name, 100);
    }
    if (!(ism instanceof Array)) {
      fault(func_name, 110);
    }
    if (!(ism.every(function(x) {
      if (typeof(x) !== "number") {
        return false;
      }
      if (!isFinite(x)) {
        return false;
      }
      if (Math.floor(x) !== x) {
        return false;
      }
      if (x === 0) {
        return false;
      }
      
      return true;
      
    }))) {
      fault(func_name, 120);
    }
    
    // Start out the character read counter at zero and the result as an
    // empty string
    char_read = 0;
    result = "";
    
    // Step through the insertion map element by element to build the
    // result
    ism.forEach(function(x, i, a) {
      
      // Check what kind of element we have
      if (x < 0) {
        // Run of invariants that we need to copy to result; begin by
        // inverting the value so we have the count of invariants
        x = -(x);
        
        // Make sure that this run of invariants does not extend beyond
        // the end of the string
        if (x > str.length - char_read) {
          fault(func_name, 200);
        }
        
        // Copy this run of invariants to the result string
        if (x >= str.length) {
          result = result + str;
        } else {
          result = result + str.slice(char_read, char_read + x);
        }
        
        // Update the char_read counter
        char_read = char_read + x;
        
      } else if (x > 0) {
        // Special code in insertion map that won't be added to the
        // invariant string, so we just need to skip over it; increase
        // char_read by one or two, depending on whether it is a
        // supplemental character (which is encoded by a surrogate pair
        // in the original string)
        if (x > 0xffff) {
          char_read = char_read + 2;
        } else {
          char_read++;
        }
        
        // Make sure char_read hasn't exceeded the length in characters
        // of the string
        if (char_read > str.length) {
          fault(func_name, 280);
        }
        
      } else {
        // Shouldn't happen
        fault(func_name, 290);
      }
      
    });
    
    // Make sure the insertion map has covered the entire input string
    if (char_read !== str.length) {
      fault(func_name, 300);
    }
    
    // Make sure that each character in the result is invariant
    for(j = 0; j < result.length; j++) {
      if (!isInvariantCode(result.charCodeAt(j))) {
        fault(func_name, 310);
      }
    }
    
    // Return the derived invariant string
    return result;
  }

  /*
   * Given an invariant string and an insertion map, reconstruct the
   * encoded string and return it.
   * 
   * The invariant string may be any string value, provided that it
   * contains no surrogates and that its length equals the absolute
   * value of the sum of all negative values in ism.  The invariant
   * string may be empty.
   * 
   * The insertion map is described in detail in DeltaEncoding.md.
   * Briefly, negative values encode a sequence of characters copied
   * from the invariant string, with the absolute value of the negative
   * integer determining the number of invariant characters to copy.
   * Zero values are not allowed in the insertion map.  Values greater
   * than zero indicate the codepoint of a special character to insert.
   * 
   * Most errors will cause faults.  However, the specific problem of a
   * special codepoint encountered in the insertion map that is within
   * surrogate range will cause a DecodeException indicating that a
   * surrogate was delta-encoded (which is not allowed).
   * 
   * Encoded supplemental characters will be replaced with an equivalent
   * surrogate pair in the reconstructed string.
   * 
   * Parameters:
   * 
   *   ivstr : string - the invariant string
   * 
   *   ism : Array of integer - the insertion map to apply
   * 
   * Return:
   * 
   *   the reconstructed string
   */
  function reconstruct(ivstr, ism) {
    
    var func_name = "reconstruct";
    var cl, c, c2, i, result;
    
    // Check parameters
    if (typeof(ivstr) !== "string") {
      fault(func_name, 100);
    }
    for(i = 0; i < ivstr.length; i++) {
      c = ivstr.charCodeAt(i);
      if ((c >= UC_SURROGATE_MIN) && (c <= UC_SURROGATE_MAX)) {
        fault(func_name, 105);
      }
    }
    
    if (!(ism instanceof Array)) {
      fault(func_name, 110);
    }
    if (!(ism.every(function(x) {
      if (typeof(x) !== "number") {
        return false;
      }
      if (!isFinite(x)) {
        return false;
      }
      if (Math.floor(x) !== x) {
        return false;
      }
      if ((x === 0) || (x > UC_MAX)) {
        return false;
      }
      
      return true;
      
    }))) {
      fault(func_name, 120);
    }
    
    // Throw exception if any special codepoint contained in the
    // insertion map is in surrogate range
    if (!(ism.every(function(x) {
      if ((x < UC_SURROGATE_MIN) || (x > UC_SURROGATE_MAX)) {
        return true;
      } else {
        return false;
      }
      
    }))) {
      throw new DecodeException("Surrogate encoded in delta");
    }
    
    // Find the absolute value of the sum of all negative integers in
    // the insertion map and make sure it is equal to the length of the
    // invariant string
    cl = 0;
    ism.forEach(function(x, j, a) {
      if (x < 0) {
        cl = cl - x;
      }
    });
    
    if (cl !== ivstr.length) {
      fault(func_name, 200);
    }
    
    // Start the result as an empty string and the invariant index at
    // the start of the invariant
    result = "";
    i = 0;
    
    // Reconstruct the original string
    ism.forEach(function(x, j, a) {
      // Handle current element
      if (x < 0) {
        // Negative value encodes length of invariant sequence, so get
        // absolute value
        x = 0 - x;
        
        // Invariant sequence should be within remaining invariant
        if (x > ivstr.length - i) {
          fault(func_name, 250);
        }
        
        // Transfer invariant sequence to result
        result = result + ivstr.slice(i, i + x);
        
        // Update invariant index
        i = i + x;
        
      } else if ((x > 0xffff) && (x < UC_MAX)) {
        // Supplemental special codepoint, so begin by getting its
        // offset within the supplemental area
        x = x - 0x10000;
        
        // Split into 10-bit portions
        c = (x >> 10) & 0x3ff;
        c2 = x & 0x3ff;
        
        // Get the high and low surrogate codepoints
        c = c + UC_HISUR_MIN;
        c2 = c2 + UC_LOSUR_MIN;
        
        // Append the surrogate pair to the result string
        result = result + String.fromCharCode(c, c2);
        
      } else if ((x > 1) && (x <= 0xffff) &&
                  ((x < UC_SURROGATE_MIN) || (x > UC_SURROGATE_MAX))) {
        // Non-surrogate, non-supplemental special codepoint, so just
        // append it to string
        result = result + String.fromCharCode(x);
        
      } else {
        // Shouldn't happen
        fault(func_name, 300);
      }
      
    });
    
    // Return reconstructed original string
    return result;
  }

  /*
   * Given an insertion map, generate an equivalent oplist.
   * 
   * CAUTION:  this function will leave the given insertion map array in
   * an undefined state!
   * 
   * The oplist is defined in DeltaEncoding.md.  Briefly, it has a pair
   * of coordinates for each element in the array.  The first coordinate
   * gives the index in the string where to insert a special character
   * and the second coordinate gives the codepoint value of the special
   * character to insert.  The first coordinate may be equal to the
   * length of the string to append at the end.  Taking the invariant
   * string and running all insertions in the order given in the oplist
   * would reconstruct the original string.
   * 
   * The oplist is furthermore sorted first by ascending SECOND
   * coordinate values and secondarily by ascending first coordinate
   * values.  This means the oplist is sorted primarily by the codepoint
   * of the inserted special character, rather than by the insertion
   * position in the string.
   * 
   * Parameters:
   * 
   *   ism : Array of integers - the insertion map to transform, which
   *   will be left in an undefined state
   * 
   * Return:
   * 
   *   the generated oplist
   */
  function imapToOplist(ism) {
    
    var func_name = "imapToOplist";
    var opl, fMin, min_val, ccount;
    
    // Check parameter
    if (!(ism instanceof Array)) {
      fault(func_name, 100);
    }
    if (!(ism.every(function(x) {
      if (typeof(x) !== "number") {
        return false;
      }
      if (!isFinite(x)) {
        return false;
      }
      if (Math.floor(x) !== x) {
        return false;
      }
      if (x === 0) {
        return false;
      }
      
      return true;
      
    }))) {
      fault(func_name, 110);
    }
    
    // Oplist starts out empty
    opl = [];
    
    // Define a function for Array.forEach() that will update min_val to
    // the lowest value in the array that is greater than zero; a
    // min_val of -1 has special meaning that no min_val is set yet
    fMin = function(x, i, a) {
      if (x > 0) {
        if (min_val < 0) {
          min_val = x;
          
        } else if (x < min_val) {
          min_val = x;
        }
      }
    };
    
    // Look for the lowest value in the insertion map that is greater
    // than zero
    min_val = -1;
    ism.forEach(fMin);
    
    // Keep processing while there is at least one value that is greater
    // than zero
    while (min_val > 0) {
      // Go through ism map in sequential order, looking for elements
      // that match min_val and updating ccount; each negative value
      // causes ccount to increase by the absolute value of the negative
      // value, each zero value causes ccount to increment, and values
      // greater than zero have no effect on ccount; for elements that
      // match min_val, add an insertion op at position matching current
      // value of ccount and special character code matching min_val and
      // then clear the insertion map value to zero and increment ccount
      ccount = 0;
      ism.forEach(function(x, i, a) {
        // Handle different element values
        if (x < 0) {
          // Negative values increase ccount by their absolute value
          ccount = ccount - x;
          
        } else if (x === 0) {
          // Zero values (representing a special character that has
          // already been inserted) increment ccount
          ccount++;
          
        } else if (x === min_val) {
          // We found a match for min_val, so add an insertion op
          opl.push([ccount, min_val]);
          
          // Clear the insertion map value to zero
          a[i] = 0;
          
          // Increment ccount to take into account the character we just
          // inserted
          ccount++;
        }
      });
      
      // Reset min_val and search again for the lowest value that is
      // greater than zero
      min_val = -1;
      ism.forEach(fMin);
    }
    
    // Return the generated oplist
    return opl;
  }

  /*
   * Given an oplist and the invariant string length, generate an
   * equivalent insertion map.
   * 
   * This function is the inverse of imapToOplist().  Faults will occur
   * if there is any problem with the oplist.
   * 
   * Parameters:
   * 
   *   opl : Array of arrays - the oplist to transform
   * 
   *   isl : integer - the length of the invariant string
   * 
   * Return:
   * 
   *   the generated insertion map
   */
  function oplistToImap(opl, isl) {
    
    var func_name = "oplistToImap";
    var ism;
    
    // Check parameters
    if (!(opl instanceof Array)) {
      fault(func_name, 100);
    }
    if (!(opl.every(function(x) {
      if (!(x instanceof Array)) {
        return false;
      }
      if (x.length !== 2) {
        return false;
      }
      if ((typeof(x[0]) !== "number") ||
          (typeof(x[1]) !== "number")) {
        return false;
      }
      if ((!isFinite(x[0])) || (!isFinite(x[1]))) {
        return false;
      }
      if ((Math.floor(x[0]) !== x[0]) ||
          (Math.floor(x[1]) !== x[1])) {
        return false;
      }
      if ((x[0] < 0) || (x[1] < 1) || (x[1] > UC_MAX)) {
        return false;
      }
      
      return true;
      
    }))) {
      fault(func_name, 110);
    }
    
    if (typeof(isl) !== "number") {
      fault(func_name, 120);
    }
    if (!isFinite(isl)) {
      fault(func_name, 130);
    }
    if (Math.floor(isl) !== isl) {
      fault(func_name, 140);
    }
    if (isl < 0) {
      fault(func_name, 150);
    }
    
    // Start insertion map empty
    ism = [];
    
    // If invariant string is not empty, insert a negative value
    // covering the whole invariant string
    if (isl > 0) {
      ism.push(0 - isl);
    }
    
    // Build the insertion map by applying all the insertion ops
    opl.forEach(function(x, i, a) {
      
      var p, j, b, pb, t;
      
      // Get the insertion position of the current op
      p = x[0];
      
      // Find the greatest j such that the base position in the
      // insertion map at index j does not exceed p; j may also be equal
      // to the length of the insertion map
      for(j = 0; j <= ism.length; j++) {
        // If not first insertion map element, store previous b value
        if (j > 0) {
          pb = b;
        }
        
        // Compute base at j
        if (j < 1) {
          b = 0;
        } else {
          if (ism[j - 1] > 0) {
            b++;
          } else {
            b = b - ism[j - 1];
          }
        }
        
        // If our base at j has exeeded the insertion position, greatest
        // j is previous element; if our base at j is equal to the
        // insertion position, then greatest j is current element; else
        // continue search
        if (b > p) {
          j--;
          b = pb;
          break;
        } else if (b === p) {
          break;
        }
        
        // If we get here and we've reached the element beyond the end
        // of the insertion map, the oplist was invalid
        if (j >= ism.length) {
          fault(func_name, 200);
        }
      }
      
      // Handle insertion cases
      if ((j >= ism.length) && (b === p)) {
        // j was beyond end of insertion array, so we need to append the
        // special codepoint to the end of the insertion array
        ism.push(x[1]);
        
      } else if ((j < ism.length) && (b === p)) {
        // j not beyond end of insertion array and element at index j
        // has base matching insertion point, so insert special
        // codepoint before index j in insertion array
        ism.splice(j, 0, x[1]);
        
      } else if ((j < ism.length) && (b < p)) {
        // j not beyond end of insertion array and element at index j
        // has base that is less than insertion point, so it must be a
        // negative value that we have to split and insert the new
        // codepoint in the middle
        t = 0 - (p - b);
        ism.splice(
                j,
                1,
                t,
                x[1],
                ism[j] - t);
      
      } else {
        // Shouldn't happen
        fault(func_name, 300);
      }
      
    });
    
    // Return the generated insertion map
    return ism;
  }

  /*
   * Encode an integer value into a FlexDelta string.
   * 
   * The FlexDelta encoding is defined in FlexDelta.md.  The given
   * parameter may be any integer in range [0, 362797055].
   * 
   * Parameters:
   * 
   *   v : integer - the value to encode
   * 
   * Return:
   * 
   *   string containing the FlexDelta encoding of the integer
   */
  function encodeFlex(v) {
    
    var func_name = "encodeFlex";
    var elen, result, i, d;
    
    // Check parameter
    if (typeof(v) !== "number") {
      fault(func_name, 100);
    }
    if (!isFinite(v)) {
      fault(func_name, 110);
    }
    if (Math.floor(v) !== v) {
      fault(func_name, 120);
    }
    if ((v < 0) || (v > 362797055)) {
      fault(func_name, 130);
    }
    
    // Determine the encoding length
    if (v < 432) {
      elen = 2;
    } else if (v < 7776) {
      elen = 3;
    } else if (v < 279936) {
      elen = 4;
    } else if (v < 10077696) {
      elen = 5;
    } else {
      elen = 6;
    }

    // Start the result as an empty string
    result = "";
    
    // Compute all the digits that follow the first digit in reverse
    // order
    for(i = 1; i < elen; i++) {

      // Get current digit value and update value
      d = v % 36;
      v = Math.floor(v / 36);

      // Determine digit codepoint
      if (d < 26) {
        d = d + ASC_LOWER_A;
        
      } else {
        d = d - 26 + ASC_ZERO;
      }

      // Prefix this digit to the result
      result = String.fromCharCode(d) + result;
    }
    
    // Now map the remaining value to a leading byte numeric value based
    // on the table with column "First" in FlexDelta.md
    if (elen === 2) {
      v = v + 0;
      
    } else if (elen === 3) {
      v = v + 12;
      
    } else if (elen === 4) {
      v = v + 18;
      
    } else if (elen === 5) {
      v = v + 24;
      
    } else if (elen === 6) {
      v = v + 30;
      
    } else {
      // Shouldn't happen
      fault(func_name, 200);
    }
    
    // Convert leading byte numeric value to letter codepoint
    if (v < 26) {
      v = v + ASC_LOWER_A;
      
    } else {
      v = v - 26 + ASC_ZERO;
    }
    
    // Prefix lead byte digit to the result
    result = String.fromCharCode(v) + result;
    
    // Return result
    return result;
  }

  /*
   * Decode a FlexDelta string into an integer value.
   * 
   * The FlexDelta encoding is defined in FlexDelta.md.  The given
   * parameter must be a non-empty string.  If the string is not a valid
   * FlexDelta encoding, then a DecodeException is thrown.
   * 
   * The returned integer will be in range [0, 362797055].
   * 
   * Parameters:
   * 
   *   str : string - the FlexDelta encoding to decode
   * 
   * Return:
   * 
   *   decoded integer value
   */
  function decodeFlex(str) {
    
    var func_name = "decodeFlex";
    var c, result, elen, i, lbound;
    
    // Check parameter
    if (typeof(str) !== "string") {
      fault(func_name, 100);
    }
    if (str.length < 1) {
      fault(func_name, 110);
    }
    
    // Convert string to lowercase
    str = str.toLowerCase();
    
    // Get first character code
    c = str.charCodeAt(0);
    
    // Determine encoding length and initial numeric value from first
    // character code
    if ((c >= ASC_LOWER_A) && (c <= ASC_LOWER_Z)) {
      c = c - ASC_LOWER_A;
      
    } else if ((c >= ASC_ZERO) && (c <= ASC_NINE)) {
      c = c - ASC_ZERO + 26;
      
    } else {
      throw new DecodeException("Invalid FlexDelta encoding");
    }
    
    if (c < 12) {
      elen = 2;
      result = c;
    
    } else if (c < 18) {
      elen = 3;
      result = c - 12;
      
    } else if (c < 24) {
      elen = 4;
      result = c - 18;
      
    } else if (c < 30) {
      elen = 5;
      result = c - 24;
      
    } else {
      elen = 6;
      result = c - 30;
    }
    
    // Make sure encoding length matches length of string
    if (str.length !== elen) {
      throw new DecodeException("Invalid FlexDelta parsing");
    }
    
    // Combine all remaining characters into result
    for(i = 1; i < str.length; i++) {
      // Get character code
      c = str.charCodeAt(i);
      
      // Convert to numeric value
      if ((c >= ASC_LOWER_A) && (c <= ASC_LOWER_Z)) {
        c = c - ASC_LOWER_A;
        
      } else if ((c >= ASC_ZERO) && (c <= ASC_NINE)) {
        c = c - ASC_ZERO + 26;
        
      } else {
        throw new DecodeException("Invalid FlexDelta encoding");
      }
      
      // Combine into result
      result = (result * 36) + c;
    }
    
    // Based on encoding length, make sure result is not "overlong"
    if (elen === 2) {
      lbound = 0;
      
    } else if (elen === 3) {
      lbound = 432;
      
    } else if (elen === 4) {
      lbound = 7776;
      
    } else if (elen === 5) {
      lbound = 279936;
      
    } else if (elen === 6) {
      lbound = 10077696;
      
    } else {
      // Shouldn't happen
      fault(func_name, 200);
    }
    
    if (result < lbound) {
      throw new DecodeException("Overlong FlexDelta encoding");
    }
    
    // Return decoded value
    return result;
  }

  /*
   * Public functions
   * ================
   */

  /*
   * Given an original string value, return the Bitsy-encoded string
   * corresponding to that value.
   * 
   * If there is a problem with the given parameter or with encoding it
   * to Bitsy, then an exception of type bitsy.EncodeException is
   * thrown.  This has a toString method that returns an error message
   * string.  It also has a boolean tooLong property that is set to true
   * if the reason for the failure is that the encoded string would
   * exceed the length limit of 255 characters, or false in all other
   * cases.
   * 
   * Parameters:
   * 
   *   str : string - the original string
   * 
   * Return:
   * 
   *   the Bitsy-encoded string value
   */
  function encode(str) {
    
    var i, j, c, c2;
    var has_upper, has_prefix, already_strict, almost_strict;
    var dot_limit, upper_state, upper_c, upper_next;
    var suf, px, ar, c_p, c_n, d, ls, ds;
    
    // Check parameter type
    if (typeof(str) !== "string") {
      throw new EncodeException("Wrong input type", false);
    }
    
    // Make sure input is not empty
    if (str.length < 1) {
      throw new EncodeException("Input may not be empty", false);
    }
    
    // Go through each UTF-16 character of the input string and verify
    // that no ASCII control codes, no slashes, and all surrogates are
    // properly paired
    for(i = 0; i < str.length; i++) {
      // Get current character code
      c = str.charCodeAt(i);
      
      // Check that not an ASCII control
      if ((c <= ASC_CTL_MAX) || (c === ASC_CTL_DEL)) {
        throw new EncodeException("Input contains ASCII control codes",
                    false);
      }
      
      // Check that no forward slashes
      if (c === ASC_SLASH) {
        throw new EncodeException("Input contains forward slashes",
                    false);
      }
      
      // Check that no backslashes
      if (c === ASC_BACKSLASH) {
        throw new EncodeException("Input contains backslashes", false);
      }
      
      // Check that this is not a low surrogate, which would indicate an
      // improperly paired surrogate
      if ((c >= UC_LOSUR_MIN) && (c <= UC_LOSUR_MAX)) {
        throw new EncodeException("Input contains improper surrogates",
                    false);
      }
      
      // If this is a high surrogate, check that this is not the last
      // character and that it is followed by a low surrogate
      if ((c >= UC_HISUR_MIN) && (c <= UC_HISUR_MAX)) {
        if (i >= str.length - 1) {
          throw new EncodeException(
            "Input contains improper surrogates", false);
        }
        c2 = str.charCodeAt(i + 1);
        if ((c2 < UC_LOSUR_MIN) || (c2 > UC_LOSUR_MAX)) {
          throw new EncodeException(
            "Input contains improper surrogates", false);
        }
      }
      
      // If we are on a high surrogate, skip the next low surrogate,
      // which we already checked
      if ((c >= UC_HISUR_MIN) && (c <= UC_HISUR_MAX)) {
        i++;
      }
    }
    
    // Make sure length in codepoints does not exceed limit
    if (getCPC(str) > LENGTH_LIMIT) {
      throw new EncodeException("Input is too long", true);
    }
    
    // Check whether there is at least one ASCII uppercase letter within
    // the string; we don't care about Unicode letters
    if ((/[A-Z]/).test(str)) {
      has_upper = true;
    } else {
      has_upper = false;
    }
    
    // Check whether we have one of the special prefixes already on the
    // string (we don't need to do a case-insensitive check)
    has_prefix = false;
    if (str.length >= 4) {
      c = str.slice(0, 4);
      if ((c === PREFIX_ENCODE) || (c === PREFIX_ESCAPE)) {
        has_prefix = true;
      }
    }
    
    // Check whether input is already a StrictName
    if (isStrictName(str)) {
      already_strict = true;
    } else {
      already_strict = false;
    }
    
    // If already a StrictName, then also already almost strict; else,
    // check whether name satisfies weaker "almost" criteria
    if (already_strict) {
      almost_strict = true;
    } else {
      almost_strict = isAlmostStrict(str);
    }
    
    // If the input is a StrictName AND it doesn't have uppercase
    // letters AND it doesn't have a prefix, then we can use
    // pass-through encoding so just return the file name as-is
    if (already_strict && (!has_upper) && (!has_prefix)) {
      return str;
    }
    
    // Otherwise, if the input is a StrictName AND it doesn't have
    // uppercase letters BUT it has a prefix, we can use prefix encoding
    if (already_strict && (!has_upper) && has_prefix) {
      // Define the suffix
      suf = "-" + str.charAt(1);
      
      // Look for the first period character in the string
      px = str.indexOf(".");
      
      // If we have a period, it is not the first character, so insert
      // the suffix before the first period; else, add the suffix to the
      // end of the name; also, change the second letter to q in both
      // cases
      if (px >= 0) {
        str = PREFIX_ESCAPE + str.slice(4, px) + suf + str.slice(px);
      } else {
        str = PREFIX_ESCAPE + str.slice(4) + suf;
      }
      
      // Return the prefix-encoded result
      return str;
    }
    
    // Otherwise, if the input is almost strict AND it doesn't have
    // uppercase letters AND it doesn't have a prefix, then we can use
    // device encoding
    if (almost_strict && (!has_upper) && (!has_prefix)) {
      // Look for the first period character in the string
      px = str.indexOf(".");
      
      // If we have a period, it is not the first character, so insert
      // the "-x" suffix before the first period; else, add the suffix
      // to the end of the name; also, prefix "xq--" to the string in
      // both cases
      if (px >= 0) {
        str = PREFIX_ESCAPE + str.slice(0, px)
                + SUFFIX_REMOVE + str.slice(px);
      } else {
        str = PREFIX_ESCAPE + str + SUFFIX_REMOVE;
      }
      
      // Return the device-encoded result
      return str;
    }
    
    // GENERAL ENCODING PROCEDURE ======================================
    
    // Unicode normalization -------------------------------------------
    
    // We've already checked the input limitations and handled the
    // special encoding types; general encoding starts out by
    // normalizing to NFC
    str = str.normalize("NFC");
    
    // Normalization may have changed the length, so do a length check
    // again
    if (str.length < 1) {
      throw new EncodeException("Input normalized to empty", false);
    }
    if (getCPC(str) > LENGTH_LIMIT) {
      throw new EncodeException("Input normalization too long", true);
    }
    
    // Dot conversion --------------------------------------------------
    
    // Initialize the dot limit to -1 indicating limit beyond end of
    // string
    dot_limit = -1;
    
    // Scan through the dots in the file name in reverse order, from
    // last to first
    for(i = str.lastIndexOf(".");
        i >= 0;
        i = str.lastIndexOf(".", i)) {
      
      // We found a dot; get the substring that starts at that dot and
      // runs to the end of the name
      if (i > 0) {
        c = str.slice(i);
      } else {
        c = str;
      }
      
      // Check whether dot is proper by prefixing an "a" to it and
      // checking whether the result is a StrictName
      if (isStrictName("a" + c)) {
        // Dot is proper, so update dot limit and continue
        dot_limit = i;
        
      } else {
        // Dot is not proper so do not update dot limit and stop
        // scanning
        break;
      }
      
      // If we just handled the first character of the string, then
      // leave the loop; otherwise, decrement i so that the search
      // resumes in the next iteration
      if (i < 1) {
        break;
      } else {
        i--;
      }
    }
    
    // If dot_limit is zero, then change it to one; we always want to
    // convert an initial dot to RS, even if it is technically proper;
    // we handled special case "." earlier with pass-through encoding,
    // so the increased dot_limit will always still refer to a character
    // that exists within the string
    if (dot_limit === 0) {
      dot_limit = 1;
    }
    
    // If dot_limit remains at -1 then there are no proper dots, so
    // convert all dots to RS control codes; otherwise, convert only
    // dots before the dot limit to RS control codes
    if (dot_limit < 0) {
      // No proper dots, so convert all dots to RS control codes
      str = str.replace(/\./g, String.fromCharCode(ASC_CTL_RS));
      
    } else {
      // Dot limit is in effect, and we know both that it is greater
      // than zero at this point and also refers to a character that
      // exists within the string; split string into two substrings, one
      // before the dot limit and the other from the dot limit to the
      // end of the string
      c = str.slice(0, dot_limit);
      c2 = str.slice(dot_limit);
      
      // Only convert dots in the substring prior to the dot limit to
      // RS control codes
      c = c.replace(/\./g, String.fromCharCode(ASC_CTL_RS));
      
      // Rejoin the strings
      str = c + c2;
    }
    
    // Casing conversion -----------------------------------------------
    
    // The casing state will start out lowercase
    upper_state = false;
    
    // Go through the string character by character
    for(i = 0; i < str.length; i++) {
      // Get the character code at this location
      c = str.charCodeAt(i);
      
      // Figure out the ASCII letter case of this character, or skip
      // this character if it is not an ASCII letter
      if ((c >= ASC_UPPER_A) && (c <= ASC_UPPER_Z)) {
        // Uppercase
        upper_c = true;
        
      } else if ((c >= ASC_LOWER_A) && (c <= ASC_LOWER_Z)) {
        // Lowercase
        upper_c = false;
        
      } else {
        // Not an ASCII letter, so skip
        continue;
      }
      
      // If letter case of current ASCII letter matches the current case
      // state, then we do not need to do anything so skip it
      if (upper_c === upper_state) {
        continue;
      }
      
      // If we got here, we found an ASCII letter that does not match
      // the current case state, so we will need to examine the case of
      // the next ASCII letter (if there is one) to determine which
      // casing control code to use; begin by setting the upper_next
      // flag to the inverse of the current casing state, so that if
      // there is no ASCII letter following this one, SUB will be the
      // control code used
      if (upper_c) {
        upper_next = false;
      } else {
        upper_next = true;
      }
      
      // Scan any remaining characters in the string until we reach the
      // end of the string or find an ASCII letter; if we find an ASCII
      // letter, store its case in upper_next
      for(j = i + 1; j < str.length; j++) {
        // Get the character
        c2 = str.charCodeAt(j);
        
        // If we found a letter, set the upper_next flag to match its
        // case and leave the loop
        if ((c2 >= ASC_UPPER_A) && (c2 <= ASC_UPPER_Z)) {
          // Uppercase
          upper_next = true;
          break;
        
        } else if ((c2 >= ASC_LOWER_A) && (c2 <= ASC_LOWER_Z)) {
          // Lowercase
          upper_next = false;
          break;
        }
      }
      
      // upper_next is now set to the case of the next ASCII letter in
      // the string (or the inverse of the current case if no more ASCII
      // letters in string), so determine which control code needs to
      // be inserted as c2 and change casing state if SI or SO
      if (upper_next === upper_c) {
        // The case of the next letter matches the case of the current
        // letter, so use an SI if this case is uppercase or an SO if
        // this case is lowercase, and update the casing state to match
        // this case
        if (upper_c) {
          c2 = ASC_CTL_SI;
        } else {
          c2 = ASC_CTL_SO;
        }
        upper_state = upper_c;
        
      } else {
        // The case of the current letter does not match the case of the
        // next letter (or there is no next letter), so use a SUB
        // control code and do not update the casing state
        c2 = ASC_CTL_SUB;
      }
      
      // Insert the control code before the current character
      if (i > 0) {
        c = str.slice(0, i);
      } else {
        c = "";
      }
      str = c + String.fromCharCode(c2) + str.slice(i);
      
      // Increment i to account for the inserted control code
      i++;
    }
    
    // Casing conversion may have extended the length, so do a length
    // check again
    if (getCPC(str) > LENGTH_LIMIT) {
      throw new EncodeException("Input encoding too long", true);
    }
    
    // Split into invariant and oplist ---------------------------------
    
    // Derive an insertion map from the string
    ar = deriveInsertions(str);
    
    // Replace the string with an invariant string derived from it and
    // the insertion map
    str = deriveInvariant(str, ar);
    
    // Convert the insertion map into an oplist
    ar = imapToOplist(ar);
    
    // Delta array encoding --------------------------------------------
    
    // Length state starts out with length of invariant string -- since
    // no invariants are supplementals, we can just use normal length
    // operation here
    ls = str.length;
    
    // Set initial coordinate state
    c_p = 0;
    c_n = 1;
    
    // Now go through the oplist and replace each element with a delta
    // encoding so that the oplist will be transformed into a delta
    // array
    ar.forEach(function(x, i, a) {
      
      // Compute the delta using the formula from DeltaEncoding.md
      d = ((x[1] - c_n) * (ls + 1)) - c_p + x[0];
      
      // Update state
      c_p = x[0];
      c_n = x[1];
      ls++;
      
      // Replace current array element with the delta
      a[i] = d;
    });
    
    // Start the delta suffix out empty and then add each encoded value
    ds = "";
    ar.forEach(function(x, i, a) {
      ds = ds + encodeFlex(x);
    });
    
    // If delta suffix is empty, replace it with special marker aa
    if (ds.length < 1) {
      ds = "aa";
    }
    
    // Final assembly --------------------------------------------------
    
    // Insert the delta suffix into the appropriate position in the
    // invariant string
    if (str.length < 1) {
      // Invariant string is empty, so replace it with delta suffix
      str = ds;
      
    } else {
      // Invariant string is not empty, find first period if there is
      // one
      i = str.indexOf(".");
      if (i < 0) {
        // No period, so just suffix the delta suffix
        str = str + "-" + ds;
        
      } else {
        // Period, so insert the delta suffix before the period
        str = str.slice(0, i) + "-" + ds + str.slice(i);
      }
    }
    
    // Finally, add the prefix
    str = PREFIX_ENCODE + str;
    
    // Final length check
    if (str.length > LENGTH_LIMIT) {
      throw new EncodeException("Input encoding too long", true);
    }
    
    // We should have a StrictName
    if (!isStrictName(str)) {
      throw new EncodeException("Encoding is not strict", false);
    }
    
    // Return the encoded result
    return str;
  }

  /*
   * Given a Bitsy-encoded string, return the decoded original string.
   * 
   * If there is a problem with the given parameter or it is not a valid
   * Bitsy string, then an exception of type bitsy.DecodeException is
   * thrown.  This has a toString method that returns an error message
   * string.
   * 
   * Parameters:
   * 
   *   str : string - the Bitsy-encoded string
   * 
   * Return:
   * 
   *   the decoded original string
   */
  function decode(str) {
    
    var i, j, c, t;
    var suf, ar, ls, c_p, c_n, i_p, i_n, upper_state;
    
    // Check parameter type
    if (typeof(str) !== "string") {
      throw new DecodeException("Wrong input type");
    }
    
    // The input should be a StrictName
    if (!isStrictName(str)) {
      throw new DecodeException("Input is not StrictName");
    }
    
    // Letter case can not be trusted, so convert everything to
    // lowercase
    str = str.toLowerCase();
    
    // If the input is not at least four characters, or it does not
    // start with xz-- then it had a special encoding, so handle the
    // special decoding
    if (str.length < 4) {
      // Special encoding with no prefix, and we've already converted
      // all letters to lowercase, so return as-is
      return str;
      
    } else if (str.slice(0, 4) !== "xz--") {
      // Special encoding, check which kind
      if (str.slice(0, 4) === "xq--") {
        // Escaping prefix, first make sure it is at least six
        // characters which is required for the suffix
        if (str.length < 6) {
          throw new DecodeException("Invalid escape encoding");
        }
        
        // Locate and extract the suffix
        i = str.indexOf(".");
        if (i < 0) {
          // No period in file name, so suffix is last two characters
          suf = str.slice(-2);
          str = str.slice(0, -2);
          
        } else {
          // Period in file name, so check that first period is at least
          // the seventh character
          if (i < 6) {
            throw new DecodeException("Invalid escape encoding");
          }
          
          // Suffix is two characters immediately before the period
          suf = str.slice(i - 2, i);
          str = str.slice(0, i - 2) + str.slice(i);
        }
        
        // Interpret the suffix
        if (suf === "-q") {
          // First two characters of file name need to be xq, and they
          // already are xq, so we don't need to do anything
          str = str;
          
        } else if (suf === "-z") {
          // Replace first two characters of file name with xz
          str = "xz" + str.slice(2);
          
        } else if (suf === "-x") {
          // Drop the first four characters of file name
          str = str.slice(4);
          
        } else {
          // Unrecognized suffix
          throw new DecodeException("Invalid escape encoding");
        }
        
        // Now that suffix is interpreted and everything has been
        // converted to lowercase already, return the decoded file name
        return str;
        
      } else {
        // No prefix, and we've already converted all letters to
        // lowercase, so return as-is
        return str;
      }
    }
    
    // GENERAL DECODING PROCEDURE ======================================
    
    // Split into invariant and delta strings --------------------------
    
    // Begin by dropping the first four characters to remove the xz--
    // prefix
    str = str.slice(4);
    
    // Let j be the length of the "label" at the start of the file name;
    // if there are no periods in the file name, the label is the whole
    // file name, otherwise it is everything up to but excluding the
    // first period; we know the period isn't the first character
    // because otherwise it would be a period following a hyphen, which
    // isn't allowed for a StrictName, which we already checked earlier
    j = str.indexOf(".");
    if (j < 0) {
      j = str.length;
    }
    
    // Let i be the start of the delta suffix; if there are no hyphens
    // within the label, the delta suffix is the whole label; otherwise,
    // the delta suffix starts at the last hyphen within the label and
    // proceeds to the end of the label
    i = str.lastIndexOf("-", j - 1);
    if (i < 0) {
      i = 0;
    }
    
    // Extract the delta suffix from the string, which will also leave
    // the string as the invariant string (which may be empty)
    suf = str.slice(i, j);
    if ((j < str.length) && (i > 0)) {
      str = str.slice(0, i) + str.slice(j, str.length);
    } else if (j < str.length) {
      str = str.slice(j, str.length);
    } else if (i > 0) {
      str = str.slice(0, i);
    } else {
      str = "";
    }
    
    // If there is a hyphen at the start of the delta suffix, drop it
    if (suf.length > 0) {
      if (suf.charAt(0) === "-") {
        if (suf.length > 1) {
          suf = suf.slice(1);
        } else {
          suf = "";
        }
      }
    }
    
    // Delta suffix may not be empty
    if (suf.length < 1) {
      throw new DecodeException("Delta suffix is empty");
    }
    
    // If delta suffix is special marker aa, change it to empty
    if (suf === "aa") {
      suf = "";
    }
    
    // Split delta suffix into array -----------------------------------
    
    // Begin with an empty delta array
    ar = [];
    
    // Go through delta suffix and split at FlexDelta boundaries
    for(i = 0; i < suf.length; i++) {
      // Get current character code
      c = suf.charCodeAt(i);
      
      // Let j be the length of this FlexDelta substring, based on the
      // first letter range from the "char/first" table in FlexDelta.md
      if ((c >= ASC_LOWER_A) && (c < ASC_LOWER_M)) {
        j = 2;
      
      } else if ((c >= ASC_LOWER_M) && (c < ASC_LOWER_S)) {
        j = 3;
        
      } else if ((c >= ASC_LOWER_S) && (c < ASC_LOWER_Y)) {
        j = 4;
        
      } else if ((c === ASC_LOWER_Y) || (c === ASC_LOWER_Z) ||
                  ((c >= ASC_ZERO) && (c < ASC_FOUR))) {
        j = 5;
        
      } else if ((c >= ASC_FOUR) && (c <= ASC_NINE)) {
        j = 6;
        
      } else {
        throw new DecodeException("Invalid characters in delta suffix");
      }
      
      // Add j to i to get the character index after this current
      // FlexDelta substring, and make sure j is no more than the length
      // of the delta suffix
      j = i + j;
      if (j > suf.length) {
        throw new DecodeException("Failed to parse delta suffix");
      }
      
      // Extract the current FlexDelta substring and add it to delta
      // array
      ar.push(suf.slice(i, j));
      
      // Set i to one less than j so that next loop iteration will start
      // at index j
      i = j - 1;
    }
    
    // Decode delta array into oplist ----------------------------------
    
    // Transform each element in delta array into numeric integer delta
    // value
    ar.forEach(function(x, z, a) {
      a[z] = decodeFlex(x);
    });
    
    // Initial delta decoding state has ls as the length of the
    // invariant string and (c_p, c_n) as (0, 1)
    ls = str.length;
    c_p = 0;
    c_n = 1;
    
    // Transform each element in delta array from numeric integer delta
    // value into insertion op to yield the oplist
    ar.forEach(function(x, z, a) {
      // Compute t value by applying delta to current position
      t = c_p + x;
      
      // Use t to compute the new position and codepoint value
      i_p = (t % (ls + 1));
      i_n = c_n + Math.floor(t / (ls + 1));
      
      // Check that numeric codepoint value doesn't exceed Unicode
      if (i_n > UC_MAX) {
        throw new DecodeException("Delta exceeds maximum codepoint");
      }
      
      // Replace current array element with the decoded insertion op
      a[z] = [i_p, i_n];
      
      // Update state
      ls++;
      c_p = i_p;
      c_n = i_n;
    });
    
    // Reconstruct the full string with control codes ------------------
    
    // Convert the oplist to an insertion map
    ar = oplistToImap(ar, str.length);
    
    // Apply the insertion map to the invariant string to reconstruct
    // the full string with control codes
    str = reconstruct(str, ar);
    
    // Apply casing control codes --------------------------------------
    
    // Start with casing state in lowercase
    upper_state = false;
    
    // Go through the string and interpret casing controls
    for(i = 0; i < str.length; i++) {
      // Get current codepoint
      c = str.charCodeAt(i);
      
      // Handle control codes and ASCII letters (which are all lowercase
      // at this point)
      if ((c >= ASC_LOWER_A) && (c <= ASC_LOWER_Z)) {
        // Lowercase letter; if casing state is uppercase, change this
        // letter to uppercase
        if (upper_state) {
          if ((i > 0) && (i < str.length - 1)) {
            str = str.slice(0, i)
                  + String.fromCharCode(c - ASC_LOWER_A + ASC_UPPER_A)
                  + str.slice(i + 1);
          } else if (i > 0) {
            str = str.slice(0, i)
                  + String.fromCharCode(c - ASC_LOWER_A + ASC_UPPER_A);
            
          } else if (i < str.length - 1) {
            str = String.fromCharCode(c - ASC_LOWER_A + ASC_UPPER_A)
                  + str.slice(i + 1);
          } else {
            str = String.fromCharCode(c - ASC_LOWER_A + ASC_UPPER_A);
          }
        }
        
      } else if (c === ASC_CTL_SI) {
        // SI control, so switch casing state to uppercase
        upper_state = true;
        
      } else if (c === ASC_CTL_SO) {
        // SO control, so switch casing state to lowercase
        upper_state = false;
        
      } else if (c === ASC_CTL_SUB) {
        // Invert next letter, so first make sure that there is a next
        // character and that it is a letter, which is always lowercase
        // at this point
        if (i >= str.length - 1) {
          throw new DecodeException("Invalid SUB casing control");
        }
        c = str.charCodeAt(i + 1);
        if ((c < ASC_LOWER_A) || (c > ASC_LOWER_Z)) {
          throw new DecodeException("Invalid SUB casing control");
        }
        
        // Increment i so that we are at the inverted letter position
        // and so we will skip over this letter on next loop iteration
        i++;
        
        // Next letter is always lowercase at this point, so switch it
        // to uppercase if in lowercase casing state, otherwise leave it
        // alone
        if (!upper_state) {
          if ((i > 0) && (i < str.length - 1)) {
            str = str.slice(0, i)
                  + String.fromCharCode(c - ASC_LOWER_A + ASC_UPPER_A)
                  + str.slice(i + 1);
          } else if (i > 0) {
            str = str.slice(0, i)
                  + String.fromCharCode(c - ASC_LOWER_A + ASC_UPPER_A);
            
          } else if (i < str.length - 1) {
            str = String.fromCharCode(c - ASC_LOWER_A + ASC_UPPER_A)
                  + str.slice(i + 1);
          } else {
            str = String.fromCharCode(c - ASC_LOWER_A + ASC_UPPER_A);
          }
        }
      }
    }
    
    // Drop all SI SO SUB casing control codes from the string
    str = str.replace(/[\u000e\u000f\u001a]/g, "");
    
    // Apply dot control codes -----------------------------------------
    
    // Replace all RS control codes with ASCII periods
    str = str.replace(/\u001e/g, ".");
    
    // Normalization and final checking --------------------------------
    
    // Normalize to NFC
    str = str.normalize("NFC");
    
    // Make sure result is not empty
    if (str.length < 1) {
      throw new DecodeException("Result is empty");
    }
    
    // Go through each UTF-16 character of the input string and verify
    // that no ASCII control codes, no slashes, and all surrogates are
    // properly paired
    for(i = 0; i < str.length; i++) {
      // Get current character code
      c = str.charCodeAt(i);
      
      // Check that not an ASCII control
      if ((c <= ASC_CTL_MAX) || (c === ASC_CTL_DEL)) {
        throw new DecodeException(
          "Result contains unrecognized ASCII control codes");
      }
      
      // Check that no forward slashes
      if (c === ASC_SLASH) {
        throw new DecodeException("Result contains forward slashes");
      }
      
      // Check that no backslashes
      if (c === ASC_BACKSLASH) {
        throw new DecodeException("Result contains backslashes");
      }
      
      // Check that this is not a low surrogate, which would indicate an
      // improperly paired surrogate
      if ((c >= UC_LOSUR_MIN) && (c <= UC_LOSUR_MAX)) {
        throw new DecodeException(
          "Result contains improper surrogates");
      }
      
      // If this is a high surrogate, check that this is not the last
      // character and that it is followed by a low surrogate
      if ((c >= UC_HISUR_MIN) && (c <= UC_HISUR_MAX)) {
        if (i >= str.length - 1) {
          throw new DecodeException(
            "Result contains improper surrogates");
        }
        c2 = str.charCodeAt(i + 1);
        if ((c2 < UC_LOSUR_MIN) || (c2 > UC_LOSUR_MAX)) {
          throw new DecodeException(
            "Result contains improper surrogates");
        }
      }
      
      // If we are on a high surrogate, skip the next low surrogate,
      // which we already checked
      if ((c >= UC_HISUR_MIN) && (c <= UC_HISUR_MAX)) {
        i++;
      }
    }
    
    // Make sure length in codepoints does not exceed limit
    if (getCPC(str) > LENGTH_LIMIT) {
      throw new DecodeException("Result is too long");
    }
    
    // All checks pass, so return the decoded original file name
    return str;
  }

  /*
   * Export declarations
   * ===================
   * 
   * All exports are declared within a global "bitsy" object.
   */
  window.bitsy = {
    "EncodeException": EncodeException,
    "DecodeException": DecodeException,
    "encode": encode,
    "decode": decode
  };

}());
