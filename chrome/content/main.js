
// Make a namespace.
if (typeof Lastfm == 'undefined') {
  var Lastfm = {};
}

/**
 * Called when the window finishes loading
 */
Lastfm.onLoad = function() {
  // initialization code
  this._initialized = true;
  this._strings = document.getElementById("lastfm-strings");
  this._service = Components.classes['@songbirdnest.com/lastfm;1']
    .getService().wrappedJSObject
  
  // Perform extra actions the first time the extension is run
  if (Application.prefs.get("extensions.lastfm.firstrun").value) {
    Application.prefs.setValue("extensions.lastfm.firstrun", false);
    this._firstRunSetup();
  }

  // listen to events from our Last.fm service
  this._service.addListener(this);

  // wire up UI events for the buttons
  document.getElementById('lastfmLoginButton').addEventListener('command',
      function(event) { Lastfm.onLoginClick(event); });
  document.getElementById('lastfmCancelButton').addEventListener('command',
      function(event) { Lastfm.onCancelClick(event); });
  document.getElementById('lastfmLogoutButton').addEventListener('command',
      function(event) { Lastfm.onLogoutClick(event); });
}
  

/**
 * Called when the window is about to close
 */
Lastfm.onUnLoad = function() {
  this._initialized = false;
  this._service.removeListener(this);
}
  

  
/**
 * Perform extra setup the first time the extension is run
 */
Lastfm._firstRunSetup : function() {

  // Call this.doHelloWorld() after a 3 second timeout
  setTimeout(function(controller) { controller.doHelloWorld(); }, 3000, this); 

}

window.addEventListener("load", function(e) { Lastfm.onLoad(e); }, false);
