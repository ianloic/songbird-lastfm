
// Make a namespace.
if (typeof Lastfm == 'undefined') {
  var Lastfm = {};
}

/**
 * Called when the window finishes loading
 */
Lastfm.onLoad = function() {
  // the window has finished loading
  this._initialized = true;
  this._strings = document.getElementById("lastfm-strings");
  this._service = Components.classes['@songbirdnest.com/lastfm;1']
    .getService().wrappedJSObject
  
  // listen to events from our Last.fm service
  this._service.addListener(this);

  // wire up UI events for the buttons
  document.getElementById('lastfmLoginButton').addEventListener('command',
      function(event) { Lastfm.onLoginClick(event); }, false);
  document.getElementById('lastfmCancelButton').addEventListener('command',
      function(event) { Lastfm.onCancelClick(event); }, false);
  document.getElementById('lastfmLogoutButton').addEventListener('command',
      function(event) { Lastfm.onLogoutClick(event); }, false);
}
  

Lastfm.onUnLoad = function() {
  // the window is about to close
  this._initialized = false;
  this._service.removeListener(this);
}

/* button event handlers */
Lastfm.onLoginClick = function(event) {
  this._service.username = document.getElementById('lastfmUsername').value;
  this._service.password = document.getElementById('lastfmPassword').value;
  this._service.login();
}
Lastfm.onCancelClick = function(event) {
  this._service.cancelLogin();
}
  
/* last.fm event handlers for login events */
Lastfm.onLoginBegins = function Lastfm_onLoginBegins() {
  document.getElementById('lastfmDeck').selectedPanel =
    document.getElementById('lastfmLoggingIn');
}
Lastfm.onLoginCancelled = function Lastfm_onLoginCancelled() {
  document.getElementById('lastfmDeck').selectedPanel =
    document.getElementById('lastfmLogin');
}
Lastfm.onLoginFailed = function Lastfm_onLoginFailed() {
  document.getElementById('lastfmDeck').selectedPanel =
    document.getElementById('lastfmLogin');
}
Lastfm.onLoginSucceeded = function Lastfm_onLoginSucceeded() {
  document.getElementById('lastfmDeck').selectedPanel =
    document.getElementById('lastfmProfile');
}

window.addEventListener("load", function(e) { Lastfm.onLoad(e); }, false);
