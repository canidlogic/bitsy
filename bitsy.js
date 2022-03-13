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
  var ASC_NINE       = 0x39;
  var ASC_UPPER_A    = 0x41;
  var ASC_UPPER_Z    = 0x5a;
  var ASC_BACKSLASH  = 0x5c;
  var ASC_UNDERSCORE = 0x5f;
  var ASC_LOWER_A    = 0x61;
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
      if (((c < ASC_ZERO) || (c > ASC_NINE)) &&
          ((c < ASC_UPPER_A) || (c > ASC_UPPER_Z)) &&
          ((c < ASC_LOWER_A) || (c > ASC_LOWER_Z)) &&
          (c !== ASC_HYPHEN) &&
          (c !== ASC_UNDERSCORE) &&
          (c !== ASC_DOT)) {
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
   * Parameters:
   * 
   *   str : string - the string to check
   * 
   * Return:
   * 
   *   the number of codepoints in the string
   */
  function getCPC(str) {
    // @@TODO:
    console.log("TODO: getCPC");
    return str.length;
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
    var suf, px;
    
    // Check parameter type
    if (typeof(str) !== "string") {
      throw new EncodeException("Wrong input type", false);
    }
    
    // Make sure input is not empty
    if (str.length < 1) {
      throw new EncodeException("Input may not be empty", false);
    }
    
    // Make sure raw length in UTF-16 characters does not exceed limit
    if (str.length > LENGTH_LIMIT) {
      throw new EncodeException("Input is too long", true);
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
    
    // @@TODO:
    str = str.replace(/\u001e/g, "@");
    str = str.replace(/\u001a/g, "*");
    str = str.replace(/\u000f/g, "(");
    str = str.replace(/\u000e/g, ")");
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
    
    // Check parameter type
    if (typeof(str) !== "string") {
      throw new DecodeException("Wrong input type");
    }
    
    // @@TODO:
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
