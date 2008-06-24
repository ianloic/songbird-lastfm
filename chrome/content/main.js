
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

  // get the XPCOM service as a JS object
  this._service = Components.classes['@songbirdnest.com/lastfm;1']
    .getService().wrappedJSObject

  // get references to our pieces of ui
  // statusbar icon
  this._statusIcon = document.getElementById('lastfmStatusIcon');

  // listen to events from our Last.fm service
  this._service.listeners.add(this);

  // wire up UI events for the buttons
  document.getElementById('lastfmLoginButton').addEventListener('command',
      function(event) { Lastfm.onLoginClick(event); }, false);
  document.getElementById('lastfmCancelButton').addEventListener('command',
      function(event) { Lastfm.onCancelClick(event); }, false);
  document.getElementById('lastfmLogoutButton').addEventListener('command',
      function(event) { Lastfm.onLogoutClick(event); }, false);

  // wire up UI events for the profile links
  document.getElementById('lastfmImage').addEventListener('click',
      function(event) { Lastfm.onProfileClick(event); }, false);
  document.getElementById('lastfmRealname').addEventListener('click',
      function(event) { Lastfm.onProfileClick(event); }, false);

  // copy the username & password out of the service
  document.getElementById('lastfmUsername').value = this._service.username;
  document.getElementById('lastfmPassword').value = this._service.password;
  // if we have a username & password try to log in
  if (this._service.username && this._service.password) {
    this._service.login();
  }
}


Lastfm.onUnLoad = function() {
  // the window is about to close
  this._initialized = false;
  this._service.listeners.remove(this);
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
Lastfm.onLogoutClick = function(event) {
  document.getElementById('lastfmDeck').selectedPanel =
    document.getElementById('lastfmLogin');
  this._service.logout();
}

/* profile click event handler */
Lastfm.onProfileClick = function(event) {
  gBrowser.loadURI(this._service.profileurl, null, null, event);
  document.getElementById('lastfmPanel').hidePopup();
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

/* last.fm profile changed */
Lastfm.onProfileUpdated = function Lastfm_onProfileUpdated() {
  document.getElementById('lastfmImage').setAttribute('src',
      this._service.avatar);
  document.getElementById('lastfmRealname').textContent =
    this._service.realname;
  document.getElementById('lastfmTracks').textContent = this._service.playcount;
}

window.addEventListener("load", function(e) { Lastfm.onLoad(e); }, false);
