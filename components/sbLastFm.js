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

  // username & password
  // FIXME: load from prefs
  this.username = 'ianloic';
  this.password = 'hello world';
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
sbLastFm.prototype.eachListener =
function sbLastFm_eachListener(aCallback) {
  for (var i=0; i<this._listeners.length; i++) {
    try {
      aCallback(this._listeners[i]);
    } catch(e) {
      Cu.reportError(e);
    }
  }
}

// login functionality
sbLastFm.prototype.login =
function sbLastFm_login() {
  this.eachListener(function(l) { l.onLoginBegins(); });
  // FIXME: log in and fetch profile information
}
sbLastFm.prototype.cancelLogin =
function sbLastFm_cancelLogin() {
  // FIXME: cancel the in-process login
  this.eachListener(function(l) { l.onLoginCancelled(); });
}


function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule([sbLastFm]);
}
