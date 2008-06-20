// these constants make everything better
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

// import the XPCOM helper
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// prefs service
const PREFS = Cc['@mozilla.org/preferences-service;1']
    .getService(Ci.nsIPrefBranch);


function sbLastFm() { 
  // our interface is really lightweight - make the service available as a JS
  // object so we can avoid the IDL / XPConnect complexity.
  this.wrappedJSObject = this; 

  // keep track of our listeners
  this._listeners = [];
}
// XPCOM Magic
sbLastFm.prototype.classDescription = 'Songbird Last.fm Service'
sbLastFm.prototype.contractID = '@songbirdnest.com/lastfm;1';
sbLastFm.prototype.classID =
    Components.ID('13bc0c9e-5c37-4528-bcf0-5fe37fcdc37a');
sbLastFm.prototype.QueryInterface = XPCOMUtils.generateQI([]);

// manage listeners
sbLastFm.prototype.addListener = 
function sbLastFm_addListener(aListener) {
  this._listeners.push(aListener);
}
sbLastFm.prototype.removeListener = 
function sbLastFm_removeListener(aListener) {
  for(;;) {
    // find our listener in the array
    let i = this._listeners.indexOf(aListener);
    if (i >= 0) {
      // remove it
      this._listeners.splice(i, 1);
    } else {
      return;
    }
  }
}


function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule([sbLastFm]);
}
