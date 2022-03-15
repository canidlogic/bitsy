"use strict";

/*
 * bitsy_app.js
 * ============
 * 
 * Main program module for the Bitsy encoding app.
 * 
 * Requires the bitsy.js module to also be loaded.
 */

// Wrap everything in an anonymous function that we immediately invoke
// after it is declared -- this prevents anything from being implicitly
// added to global scope
(function() {
	
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
                  " in bitsy_app");
    
    // Throw exception
    throw ("bitsy_app:" + func_name + ":" + String(loc));
  }
  
  /*
   * Find the element with the given ID and set its display property to
   * "block" to show it.
   *
   * Assumes that the element is properly displayed with "block".
   *
   * Parameters:
   *
   *   elid : string - the ID of the element to show
   */
  function appear(elid) {
    
    var func_name = "appear";
    var e;
    
    // Check parameter
    if (typeof elid !== "string") {
      fault(func_name, 100);
    }
    
    // Get the element
    e = document.getElementById(elid);
    if (e == null) {
      fault(func_name, 200);
    }
    
    // Show the element
    e.style.display = "block";
  }

  /*
   * Find the element with the given ID and set its display property to
   * "none" to hide it.
   *
   * Parameters:
   *
   *   elid : string - the ID of the element to hide
   */
  function dismiss(elid) {
    
    var func_name = "dismiss";
    var e;
    
    // Check parameter
    if (typeof elid !== "string") {
      fault(func_name, 100);
    }
    
    // Get the element
    e = document.getElementById(elid);
    if (e == null) {
      fault(func_name, 200);
    }
    
    // Hide the element
    e.style.display = "none";
  }
  
  /*
   * Set the display showing the ratio of encoded characters to original
   * characters.
   * 
   * r is the ratio to set.  It must be a finite numeric value greater
   * than zero, or a negative value to indicate no ratio to report.
   * 
   * Parameters:
   * 
   *   r : number - the ratio to display
   */
  function setRatio(r) {
    
    var func_name = "setRatio";
    var e;
    
    // Check parameter
    if (typeof(r) !== "number") {
      fault(func_name, 100);
    }
    if (!isFinite(r)) {
      fault(func_name, 110);
    }
    
    // Get output element
    e = document.getElementById("spnMeasure");
    if (e == null) {
      fault(func_name, 120);
    }
    
    // Update display
    if (r < 0.0) {
      // No ratio to display
      e.innerHTML = "&mdash;";
      
    } else {
      // Display ratio
      e.innerHTML = r.toFixed(3);
    }
  }
  
  /*
   * Public functions
   * ================
   */
  
  /*
   * Function called when the user clicks the encode button.
   */
  function handleEncode() {
    
    var func_name = "handleEncode";
    var eInput, eOutput, r;
    
    // Reset ratio display
    setRatio(-1);
    
    // Get the input and output boxes
    eInput = document.getElementById("txtInput");
    eOutput = document.getElementById("txtOutput");
    
    if ((eInput == null) || (eOutput == null)) {
      fault(func_name, 100);
    }
    
    // Try to encode, handling any exceptions
    try {
      eOutput.value = bitsy.encode(eInput.value);
      
    } catch (ex) {
      if (ex instanceof bitsy.EncodeException) {
        // EncodeException, so report the message
        eOutput.value = "ENCODING ERROR: " + ex;
        
      } else {
        // Something besides EncodeException
        eOutput.value = "UNEXPECTED EXCEPTION: " + ex;
      }
    }
    
    // If output value is at least four characters and begins with xz--
    // then calculate the ratio and display it
    if ((eOutput.value.length >= 4) && (eInput.value.length > 0)) {
      if (eOutput.value.slice(0, 4) === "xz--") {
        r = (eOutput.value.length - 4) / eInput.value.length;
        setRatio(r);
      }
    }
  }
  
  /*
   * Function called when the user clicks the decode button.
   */
  function handleDecode() {
    
    var func_name = "handleDecode";
    var eInput, eOutput, r;
    
    // Reset ratio display
    setRatio(-1);
    
    // Get the input and output boxes
    eInput = document.getElementById("txtInput");
    eOutput = document.getElementById("txtOutput");
    
    if ((eInput == null) || (eOutput == null)) {
      fault(func_name, 100);
    }
    
    // Try to decode, handling any exceptions
    try {
      eOutput.value = bitsy.decode(eInput.value);
      
    } catch (ex) {
      if (ex instanceof bitsy.DecodeException) {
        // DecodeException, so report the message
        eOutput.value = "DECODING ERROR: " + ex;
        
      } else {
        // Something besides DecodeException
        eOutput.value = "UNEXPECTED EXCEPTION: " + ex;
      }
    }
    
    // If input value is at least four characters and begins with xz--
    // then calculate the ratio and display it
    if ((eInput.value.length >= 4) && (eOutput.value.length > 0)) {
      if (eInput.value.slice(0, 4) === "xz--") {
        r = (eInput.value.length - 4) / eOutput.value.length;
        setRatio(r);
      }
    }
  }
  
  /*
   * Function called after the page is loaded.
   */
  function handleLoad() {
    
    /* Clear ratio display */
    setRatio(-1);
    
    /* Hide the splash screen and show the main window */
    dismiss("divSplash");
    appear("divMain");
  }

  /*
   * Export declarations
   * ===================
   * 
   * All exports are declared within a global "bitsy_app" object.
   */
  window.bitsy_app = {
    "handleEncode": handleEncode,
    "handleDecode": handleDecode,
    "handleLoad": handleLoad
  };

}());

// Since we loaded this script module with defer, this doesn't run until
// after the page has loaded the DOM, so we can start directly here by
// calling the loading procedure
//
bitsy_app.handleLoad();
