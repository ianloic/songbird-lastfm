
// Make a namespace.
if (typeof Lastfm == 'undefined') {
  var Lastfm = {};
}

// Called when the window finishes loading
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

  // the panel
  this._panel = document.getElementById('lastfmPanel');

  // the deck
  this._deck = document.getElementById('lastfmDeck');

  // login page of the deck
  this._login = document.getElementById('lastfmLogin');
  // login username field
  this._username = document.getElementById('lastfmUsername');
  // login password field
  this._password = document.getElementById('lastfmPassword');
  // login button
  this._loginButton = document.getElementById('lastfmLoginButton');

  // the logging-in page of the deck
  this._loggingIn = document.getElementById('lastfmLoggingIn');
  // login cancel button
  this._cancelButton = document.getElementById('lastfmCancelButton');

  // the logged-in / profile page of the deck
  this._profile = document.getElementById('lastfmProfile');
  // logout button
  this._logoutButton = document.getElementById('lastfmLogoutButton');
  // profile image
  this._image = document.getElementById('lastfmImage');
  // profile real name
  this._realname = document.getElementById('lastfmRealname');
  // profile tracks
  this._tracks = document.getElementById('lastfmTracks');


  // listen to events from our Last.fm service
  this._service.listeners.add(this);

  // wire up UI events for the buttons
  this._loginButton.addEventListener('command',
      function(event) { Lastfm.onLoginClick(event); }, false);
  this._cancelButton.addEventListener('command',
      function(event) { Lastfm.onCancelClick(event); }, false);
  this._logoutButton.addEventListener('command',
      function(event) { Lastfm.onLogoutClick(event); }, false);

  // wire up UI events for the profile links
  this._image.addEventListener('click',
      function(event) { Lastfm.onProfileClick(event); }, false);
  this._realname.addEventListener('click',
      function(event) { Lastfm.onProfileClick(event); }, false);

  // copy the username & password out of the service
  this._username.value = this._service.username;
  this._password.value = this._service.password;
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

// button event handlers
Lastfm.onLoginClick = function(event) {
  this._service.username = this._username.value;
  this._service.password = this._password.value;
  this._service.login();
}
Lastfm.onCancelClick = function(event) {
  this._service.cancelLogin();
}
Lastfm.onLogoutClick = function(event) {
  this._deck.selectedPanel = this._login;
  this._service.logout();
}

// profile click event handler
Lastfm.onProfileClick = function(event) {
  gBrowser.loadURI(this._service.profileurl, null, null, event);
  this._panel.hidePopup();
}

// last.fm event handlers for login events
Lastfm.onLoginBegins = function Lastfm_onLoginBegins() {
  this._deck.selectedPanel = this._loggingIn;
}
Lastfm.onLoginCancelled = function Lastfm_onLoginCancelled() {
  this._deck.selectedPanel = this._login;
}
Lastfm.onLoginFailed = function Lastfm_onLoginFailed() {
  this._deck.selectedPanel = this._login;
}
Lastfm.onLoginSucceeded = function Lastfm_onLoginSucceeded() {
  this._deck.selectedPanel = this._profile;
}

// last.fm profile changed
Lastfm.onProfileUpdated = function Lastfm_onProfileUpdated() {
  this._image.setAttribute('src',
      this._service.avatar);
  this._realname.textContent =
    this._service.realname;
  this._tracks.textContent = this._service.playcount;
}

window.addEventListener("load", function(e) { Lastfm.onLoad(e); }, false);
