// these constants make everything better
const Cc = Components.classes;
const CC = Components.Constructor;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

// import the XPCOM helper
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// import the properites helper
Components.utils.import("resource://app/jsmodules/sbProperties.jsm");

// login manager
const loginManager = Cc["@mozilla.org/login-manager;1"]
    .getService(Ci.nsILoginManager);
const nsLoginInfo = new CC("@mozilla.org/login-manager/loginInfo;1",
    Ci.nsILoginInfo, "init");
const LOGIN_HOSTNAME = 'https://www.last.fm';
const LOGIN_FORMURL = 'https://www.last.fm';
const LOGIN_FIELD_USERNAME = 'username';
const LOGIN_FIELD_PASSWORD = 'password';

// helper for enumerating enumerators. duh.
function enumerate(enumerator, func) {
  while(enumerator.hasMoreEntries()) {
    try {
      func(enumerator.getNext());
    } catch(e) {
      Cu.reportError(e);
    }
  }
}

// helper for getting the set of relevant logins
function lastfmLogins() {
  return loginManager.findLogins({}, LOGIN_HOSTNAME, LOGIN_FORMURL,
      null);
}

// calculate a hex md5 digest thing
function md5(str) {
  var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
      .createInstance(Ci.nsIScriptableUnicodeConverter);

  converter.charset = "UTF-8";
  // result is an out parameter,
  // result.value will contain the array length
  var result = {};
  // data is an array of bytes
  var data = converter.convertToByteArray(str, result);
  var ch = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
  ch.init(ch.MD5);
  ch.update(data, data.length);
  var hash = ch.finish(false);

  // return the two-digit hexadecimal code for a byte
  function toHexString(charCode) {
    return ("0" + charCode.toString(16)).slice(-2);
  }

  // convert the binary hash data to a hex string.
  var s = [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
  return s;
}

// An object to track listeners
function Listeners() {
  this._listeners = [];
}
Listeners.prototype.add = function Listeners_add(aListener) {
  this._listeners.push(aListener);
}
Listeners.prototype.remove = function Listeners_remove(aListener) {
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
Listeners.prototype.each = function Listeners_each(aCallback) {
  for (var i=0; i<this._listeners.length; i++) {
    try {
      aCallback(this._listeners[i]);
    } catch(e) {
      Cu.reportError(e);
    }
  }
}


// an object that represents a played track for sending to Last.fm
function PlayedTrack(mediaItem, timestamp, rating, source) {
  // apply defaults
  if (!rating) rating = ''; // no rating
  if (!source) source = 'P'; // user picked

  // copy properties out of the media item
  this.a = mediaItem.getProperty(SBProperties.artistName);
  this.t = mediaItem.getProperty(SBProperties.trackName);
  this.b = mediaItem.getProperty(SBProperties.albumName);
  this.n = mediaItem.getProperty(SBProperties.trackNumber);
  this.l = Math.round(parseInt(
      mediaItem.getProperty(SBProperties.duration))/1000000);
  // pull the musicbrainz id when we have a standard sb property for that...
  this.m = '';

  // attach info that was passed in
  this.r = rating;
  this.o = source;
  this.i = timestamp;
}


function sbLastFm() {
  // our interface is really lightweight - make the service available as a JS
  // object so we can avoid the IDL / XPConnect complexity.
  this.wrappedJSObject = this;

  // keep track of our listeners
  this.listeners = new Listeners();

  // username & password
  this.username = '';
  this.password = '';
  // lets ask the login manager
  var logins = lastfmLogins();
  Cu.reportError(logins.length);
  for (var i = 0; i < logins.length; i++) {
    if (i==0) {
      // use the first username & password we find
      this.username = logins[i].username;
      this.password = logins[i].password;
    } else {
      // get rid of the rest
      loginManager.removeLogin(logins[i]);
    }
  }

  // session info
  this.session = null;
  this.nowplaying_url = null;
  this.submission_url = null;

  // logged in state
  this.loggedIn = false;

  // the should-we-scrobble pref
  var prefsService = Cc['@mozilla.org/preferences-service;1']
      .getService(Ci.nsIPrefBranch);
  this.__defineGetter__('shouldScrobble', function() {
    return prefsService.getBoolPref('extensions.lastfm.scrobble');
  });
  this.__defineSetter__('shouldScrobble', function(val) {
    prefsService.setBoolPref('extensions.lastfm.scrobble', val);
    this.listeners.each(function(l) { l.onShouldScrobbleChanged(val); });
  });

  // add ourselves as a playlist playback listener
  Cc['@songbirdnest.com/Songbird/PlaylistPlayback;1']
      .getService(Ci.sbIPlaylistPlayback).addListener(this);

  this._playbackHistory =
      Cc['@songbirdnest.com/Songbird/PlaybackHistoryService;1']
      .getService(Ci.sbIPlaybackHistoryService);
}
// XPCOM Magic
sbLastFm.prototype.classDescription = 'Songbird Last.fm Service'
sbLastFm.prototype.contractID = '@songbirdnest.com/lastfm;1';
sbLastFm.prototype.classID =
    Components.ID('13bc0c9e-5c37-4528-bcf0-5fe37fcdc37a');
sbLastFm.prototype.QueryInterface =
    XPCOMUtils.generateQI([Components.interfaces.sbIPlaylistPlaybackListener]);

// login functionality
sbLastFm.prototype.login =
function sbLastFm_login() {
  this.listeners.each(function(l) { l.onLoginBegins(); });

  // first step - handshake.
  var self = this;
  this.handshake(function success() {
    // clear old login infos
    var logins = lastfmLogins();
    for (var i=0; i<logins.length; i++) {
      loginManager.removeLogin(logins[i]);
    }
    // set new login info
    loginManager.addLogin(new nsLoginInfo(LOGIN_HOSTNAME,
        LOGIN_FORMURL, null, self.username, self.password,
        LOGIN_FIELD_USERNAME, LOGIN_FIELD_PASSWORD));
    // download profile info
    self.updateProfile(function success() {
      self.loggedIn = true;
      self.listeners.each(function(l) { l.onLoginSucceeded(); });
      self.listeners.each(function(l) { l.onOnline(); });
    }, function failure() {
      self.listeners.each(function(l) { l.onLoginFailed(); });
      self.listeners.each(function(l) { l.onOffline(); });
    });
  }, function failure() {
    // FIXME: actually, we need some kind of retry / error reporting
    self.listeners.each(function(l) { l.onLoginFailed(); });
    self.listeners.each(function(l) { l.onOffline(); });
  }, function auth_failure() {
    self.listeners.each(function(l) { l.onLoginFailed(); });
    self.listeners.each(function(l) { l.onOffline(); });
  });
}
sbLastFm.prototype.cancelLogin =
function sbLastFm_cancelLogin() {
  if (this._handshake_xhr) {
    this._handshake_xhr.abort();
  }
  this.listeners.each(function(l) { l.onLoginCancelled(); });
}

// logout is pretty simple
sbLastFm.prototype.logout =
function sbLastFm_logout() {
  this.session = null;
  this.nowplaying_url = null;
  this.submission_url = null;
  this.loggedIn = false;
}

// do the handshake
sbLastFm.prototype.handshake =
function sbLastFm_handshake(success, failure, auth_failure) {
  // make the url
  var timestamp = Math.round(Date.now()/1000).toString();
  var hs_url = 'http://post.audioscrobbler.com/?hs=true&p=1.2&c=sbd&v=0.1' +
    '&u=' + this.username + '&t=' + timestamp + '&a=' +
    md5(md5(this.password) + timestamp);

  Cu.reportError(hs_url);

  this._handshake_xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
    .createInstance();
  this._handshake_xhr.mozBackgroundRequest = true;
  var self = this;
  this._handshake_xhr.onload = function(event) {
    /* loaded */
    if (self._handshake_xhr.status != 200) {
      Cu.reportError('status: '+self._handshake_xhr.status);
      failure();
      return;
    }
    var response_lines = self._handshake_xhr.responseText.split('\n');
    if (response_lines.length < 4) {
      Cu.reportError('not enough lines: '+response_lines.toSource());
      failure();
      return;
    }
    if (response_lines[0] == 'BADAUTH') {
      Co.reportError('auth failed');
      auth_failure();
      return;
    }
    if (response_lines[0] != 'OK') {
      Co.reportError('handshake failure: '+response_lines[0]);
      failure();
      return;
    }
    self.session = response_lines[1];
    self.nowplaying_url = response_lines[2];
    self.submission_url = response_lines[3];
    success();
  };
  this._handshake_xhr.onerror = function(event) {
    /* loaded */
    Cu.reportError('errored');
  };
  this._handshake_xhr.open('GET', hs_url, true);
  this._handshake_xhr.send(null);

}

// update profile data
sbLastFm.prototype.updateProfile =
function sbLastFm_updateProfile(succeeded, failed) {
  var url = 'http://ws.audioscrobbler.com/1.0/user/' +
    encodeURIComponent(this.username) + '/profile.xml';
  self = this;
  this.getXML(url, function success(xml) {
    function text(tag) {
      var tags = xml.getElementsByTagName(tag);
      if (tags.length) {
        return tags[0].textContent;
      } else {
        return '';
      }
    }
    self.realname = text('realname');
    self.playcount = parseInt(text('playcount'));
    self.avatar = text('avatar');
    self.profileurl = text('url');
    self.listeners.each(function(l) { l.onProfileUpdated(); });
    succeeded();
  }, function failure(xhr) {
    failed();
  });
}


// set now playing for the current user
// the first argument is an array of object, each with one-letter keys
// corresponding to the audioscrobbler submission protocol keys - ie:
// a=artist, t=track, l=track-length, b=album, n=track-number
// the PlayedTrack object implements this
sbLastFm.prototype.nowPlaying =
function sbLastFm_nowPlaying(submission) {
  var url = this.nowplaying_url;
  var body = 's=' + encodeURIComponent(this.session);
  var props = 'atblnm'; // the keys we send
  for (var j=0; j<props.length; j++) {
    body += '&' + props[j] + '=' + encodeURIComponent(submission[props[j]]);
  }
  this.post(url, body, success, failure);
}

// the first argument is an array of object, each with one-letter keys
// corresponding to the audioscrobbler submission protocol keys - ie:
// a=artist, t=track, i=start-time, l=track-length, b=album, n=track-number
// the PlayedTrack object implements this
sbLastFm.prototype.submit =
function sbLastFm_submit(submissions, success, failure) {
  // build the submission
  var url = this.submission_url;
  var body = 's=' + encodeURIComponent(this.session);
  var props = 'brainmolt'; // the keys we send
  for (var i=0; i<submissions.length; i++) {
    for (var j=0; j<props.length; j++) {
      body += '&' + props[j] + '[' + i + ']=' +
        encodeURIComponent(submissions[i][props[j]]);
    }
  }
  this.post(url, body, success, failure);
}

// get XML from an URL
sbLastFm.prototype.getXML =
function sbLastFm_getXML(url, success, failure) {
  var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
    .createInstance();
  // run in the background, since we're in xpcomland
  xhr.mozBackgroundRequest = true;
  // force an xml response
  xhr.overrideMimeType('text/xml');
  xhr.onload = function(event) {
    if (xhr.responseXML) {
      success(xhr.responseXML);
    } else {
      failure(xhr);
    }
  };
  xhr.onerror = function(event) {
    failure(xhr);
  };
  xhr.open('GET', url, true);
  xhr.send(null);
  return xhr;
}


// post to last.fm
sbLastFm.prototype.post =
function sbLastFm_post(url, body, success, failure, badsession) {
  var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
  xhr.mozBackgroundRequest = true;
  xhr.onload = function(event) {
    /* loaded */
    if (xhr.status != 200) {
      Cu.reportError('HTTP Error posting to last.fm: '+xhr.status);
      failure();
    } else if (xhr.responseText.match(/^OK\n/)) {
      success();
    } else if (xhr.responseText.match(/^BADSESSION\n/)) {
      Cu.reportError('Bad Session when posting to last.fm');
      badsession();
    } else {
      Cu.reportError('Error posting to last.fm: ' + xhr.responseText);
      failure();
    }
  };
  xhr.onerror = function(event) {
    /* errored */
    Cu.reportError('Received error posting to last.fm');
  };
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.send(body);
}


// sbIPlaylistPlaybackListener
sbLastFm.prototype.onStop = function sbLastFm_onStop() {
  try {
  dump('sbLastFm.onStop()\n');
  dump('entries: '+this._playbackHistory.entries+'\n');
  dump('entries.hasMoreElements(): '+this._playbackHistory.entries.hasMoreElements()+'\n');
  enumerate(this._playbackHistory.entries,
            function(e) {
              e.QueryInterface(Ci.sbIPlaybackHistoryEntry);
              dump(' history entry: '+e+'\n');
            });
  } catch(e) { Cu.reportError(e); }
}
sbLastFm.prototype.onBeforeTrackChange =
function sbLastFm_onBeforeTrackChange(aItem, aView, aIndex) {
  dump('sbLastFm.onBeforeTrackChange('+aItem+')\n');
  var timestamp = Math.round(Date.now()/1000).toString();
  this.submit([new PlayedTrack(aItem, timestamp)],
              function() { }, function() { });
}
sbLastFm.prototype.onTrackChange =
function sbLastFm_onTrackChange(aItem, aView, aIndex) {
  dump('sbLastFm.onTrackChange('+aItem+')\n');
  // ugh - we need to add our own entries to the history service now
  // this will go away once Aus is done
  this._playbackHistory.createEntry(aItem, (new Date()).getTime(), 1000, null);
  dump('added a history entry\n');
}



function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule([sbLastFm]);
}
