
const ICON_BUSY = 'chrome://lastfm/skin/busy.gif';
const ICON_DISABLED = 'chrome://lastfm/skin/disabled.png';
const ICON_LOGGED_IN = 'chrome://lastfm/skin/as.png';
const ICON_LOGGED_OUT = 'chrome://lastfm/skin/disabled.png';
const ICON_ERROR = 'chrome://lastfm/skin/error.png';
const ICON_LOGIN_ERROR = 'chrome://lastfm/skin/error.png';

const URL_SIGNUP = 'http://www.last.fm/join/';

// Make a namespace.
if (typeof Lastfm == 'undefined') {
  var Lastfm = {};
}

// Called when the window finishes loading
Lastfm.onLoad = function() {
  // the window has finished loading
  this._initialized = true;
  this._strings = document.getElementById("lastfmStrings");

  // get the XPCOM service as a JS object
  this._service = Components.classes['@songbirdnest.com/lastfm;1']
    .getService().wrappedJSObject

  // get references to our pieces of ui

  // menu items
  this._menuLogin = document.getElementById('lastfmMenuLogin');
  this._menuLogout = document.getElementById('lastfmMenuLogout');
  this._menuEnableScrobbling =
    document.getElementById('lastfmMenuEnableScrobbling');

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
  this._loginError = document.getElementById('lastfmLoginError');
  // login button
  this._loginButton = document.getElementById('lastfmLoginButton');
  // signup link
  this._signup = document.getElementById('lastfmSignup');

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
  // enable-scrobbling checkbox
  this._scrobble = document.getElementById('lastfmScrobble');
  // the currently playing element
  this._currently = document.getElementById('lastfmCurrently');


  // listen to events from our Last.fm service
  this._service.listeners.add(this);

  // wire up UI events for the menu items
  this._menuLogin.addEventListener('command',
      function(event) { Lastfm.showPanel(); }, false);
  this._menuLogout.addEventListener('command',
      function(event) { Lastfm.onLogoutClick(event); }, false);
  this._menuEnableScrobbling.addEventListener('command',
      function(event) { Lastfm.toggleShouldScrobble(); }, false);

  // wire up click event for the status icon
  this._statusIcon.addEventListener('click',
      function(event) {
        if (event.button == 0 && !event.ctrlKey && Lastfm._service.loggedIn) {
          // if we're logged in, toggle the scrobble state
          Lastfm.toggleShouldScrobble();
      } else {
        // or show the panel
        Lastfm.showPanel();
      }
    }, false);

  // wire up UI events for the buttons
  this._loginButton.addEventListener('command',
      function(event) { Lastfm.onLoginClick(event); }, false);
  this._cancelButton.addEventListener('command',
      function(event) { Lastfm.onCancelClick(event); }, false);
  this._logoutButton.addEventListener('command',
      function(event) { Lastfm.onLogoutClick(event); }, false);

  // wire up the signup link
  this._signup.addEventListener('click',
      function(event) { Lastfm.loadURI(URL_SIGNUP, event); }, false);

  // wire up UI events for the profile links
  this._image.addEventListener('click',
      function(event) { Lastfm.loadURI(Lastfm._service.profileurl, event); },
      false);
  this._realname.addEventListener('click',
      function(event) { Lastfm.loadURI(Lastfm._service.profileurl, event); },
      false);
  this._tracks.addEventListener('click',
      function(event) {
        Lastfm.loadURI('http://www.last.fm/user/' +
                       Lastfm._service.username + '/charts/', event);
      }, false);

  // ui event for the should-scrobble checkbox
  this._scrobble.addEventListener('command',
      function(event) { Lastfm.toggleShouldScrobble(); }, false);

  // copy the username & password out of the service into the UI
  this._username.value = this._service.username;
  this._password.value = this._service.password;

  // clear the login error message
  this.setLoginError(null);
  // update the ui with the should-scrobble state
  this.onShouldScrobbleChanged(this._service.shouldScrobble);
  // update the ui with the logged-in state
  this.onLoggedInStateChanged();

  // if we have a username & password and we're scrobbling, try to log in
  if (this._service.username && this._service.password) {
    this._service.login();
  } else {
    this.updateStatus();
    this.setStatusTextId('lastfm.status.disabled');
  }
}


Lastfm.onUnLoad = function() {
  // the window is about to close
  this._initialized = false;
  this._service.listeners.remove(this);
}


Lastfm.showPanel = function Lastfm_showPanel() {
  this._panel.openPopup(this._statusIcon);
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
  this._service.logout();
  this._deck.selectedPanel = this._login;
  this.setLoginError(null);
  this.updateStatus();
  this.setStatusTextId('lastfm.status.disabled');
}

// load an URL from an event in the panel
Lastfm.loadURI= function(uri, event) {
  gBrowser.loadURI(uri, null, null, event, '_blank');
  this._panel.hidePopup();
}

// charts click handler
Lastfm.onChartsClick = function(event) {
  http://www.last.fm/user/ianloictest/charts/
  gBrowser.loadURI('http://www.last.fm/user/'+this._service.username+'/charts/',
                   null, null, event, '_blank');
  this._panel.hidePopup();
}

Lastfm.toggleShouldScrobble = function() {
  this._service.shouldScrobble = !this._service.shouldScrobble;
}

// last.fm event handlers for login events
Lastfm.onLoggedInStateChanged = function Lastfm_onLoggedInStateChanged() {
  if (this._service.loggedIn) {
    // logged in

    // show the "log out" menu item
    this._menuLogout.style.visibility = 'visible';
    // hide the "log in" menu item
    this._menuLogin.style.visibility = 'collapse';
    // enable the "enable scrobbling" menu item
    this._menuEnableScrobbling.disabled = false;
  } else {
    // logged out

    // hide the "log out" menu item
    this._menuLogout.style.visibility = 'collapse';
    // show the "log in" menu item
    this._menuLogin.style.visibility = 'visible';
    // disable the "enable scrobbling" menu item
    this._menuEnableScrobbling.disabled = true;
  }
}
Lastfm.onLoginBegins = function Lastfm_onLoginBegins() {
  this._deck.selectedPanel = this._loggingIn;
  this.setStatusIcon(ICON_BUSY);
  this.setStatusTextId('lastfm.status.logging_in');
}
Lastfm.onLoginCancelled = function Lastfm_onLoginCancelled() {
  // clear the login error
  this.setLoginError(null);

}
Lastfm.onLoginFailed = function Lastfm_onLoginFailed() {
  // set the login error message
  this.setLoginErrorId('lastfm.error.login_failed');

  // set the status icon
  this.updateStatus();
  this.setStatusTextId('lastfm.status.failed');
}
Lastfm.onLoginSucceeded = function Lastfm_onLoginSucceeded() {
  // clear the login error
  this.setLoginError(null);
}
Lastfm.onOnline = function Lastfm_onOnline() {
  // main screen turn on
  this._deck.selectedPanel = this._profile;
  // enable the scrobbling menuitem
  this._menuEnableScrobbling.removeAttribute('disabled');

  // set the status icon
  this.updateStatus();
  this.setStatusTextId('lastfm.status.logged_in');
}
Lastfm.onOffline = function Lastfm_onOffline() {
  // switch back to the login panel
  this._deck.selectedPanel = this._login;
  // disable the scrobbling menu item
  this._menuEnableScrobbling.setAttribute('disabled', 'true');

  // set the status icon
  this.updateStatus();
  this.setStatusTextId('lastfm.status.offline');
}

// last.fm profile changed
Lastfm.onProfileUpdated = function Lastfm_onProfileUpdated() {
  this._image.setAttribute('src', this._service.avatar);
  if (this._service.realname && this._service.realname.length) {
    this._realname.textContent = this._service.realname;
  } else {
    this._realname.textContent = this._service.username;
  }
  this._tracks.textContent = this._service.playcount;
}

// shouldScrobble changed
Lastfm.onShouldScrobbleChanged = function Lastfm_onShouldScrobbleChanged(val) {
  if (val) {
    this._menuEnableScrobbling.setAttribute('checked', 'true');
    this._scrobble.setAttribute('checked', 'true');
    //this._nextContainer.className='';
    this.updateStatus();
  } else {
    this._menuEnableScrobbling.removeAttribute('checked');
    this._scrobble.removeAttribute('checked');
    //this._nextContainer.className='disabled';
    this.updateStatus();
  }
  // FIXME change the status icon?
}

// update the status icon's icon
Lastfm.setStatusIcon = function Lastfm_setStatusIcon(aIcon) {
  this._statusIcon.setAttribute('src', aIcon);
}

// update the status icon based on the current service state
Lastfm.updateStatus = function Lastfm_updateStatus() {
  dump('updateStatus error:' + this._service.error +
       ', loggedIn: ' + this._service.loggedIn +
       ' shouldScrobble: ' + this._service.shouldScrobble + '\n');
  if (this._service.error) {
    if (this._service.loggedIn) {
      this.setStatusIcon(ICON_ERROR);
    } else {
      this.setStatusIcon(ICON_LOGIN_ERROR);
    }
  } else {
    if (this._service.shouldScrobble) {
      if (this._service.loggedIn) {
        this.setStatusIcon(ICON_LOGGED_IN);
      } else {
        this.setStatusIcon(ICON_LOGGED_OUT);
      }
    } else {
      this.setStatusIcon(ICON_DISABLED);
    }
  }
}

// update the status icon's text
Lastfm.setStatusText = function Lastfm_setStatusText(aText) {
  this._statusIcon.setAttribute('tooltiptext', aText);
}

// update the status icon's text from the properties file by id
Lastfm.setStatusTextId = function Lastfm_setStatusTextId(aId) {
  this.setStatusText(this._strings.getString(aId));
}

// update the login error - pass null to clear the error message
Lastfm.setLoginError = function Lastfm_setLoginError(aText) {
  if (aText) {
    this._loginError.textContent = aText;
    this._loginError.style.display = '-moz-box';
  } else {
    this._loginError.textContent = '';
    this._loginError.style.display = 'none';
  }
}

// update the login error from the properties file by id
Lastfm.setLoginErrorId = function Lastfm_setLoginErrorId(aId) {
  this.setLoginError(this._strings.getString(aId));
}

Lastfm.onErrorChanged = function Lastfm_onErrorChanged(aError) {
  dump('onErrorChanged('+aError+')\n');
  this.setLoginError(aError);
  this.updateStatus();
}

window.addEventListener("load", function(e) { Lastfm.onLoad(e); }, false);
