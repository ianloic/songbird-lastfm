// these constants make everything better
const Cc = Components.classes;
const CC = Components.Constructor;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

// import the XPCOM helper
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// login manager
const loginManager = Cc["@mozilla.org/login-manager;1"]
    .getService(Ci.nsILoginManager);
const nsLoginInfo = new CC("@mozilla.org/login-manager/loginInfo;1",
    Ci.nsILoginInfo, "init");
const LOGIN_HOSTNAME = 'https://www.last.fm';
const LOGIN_FORMURL = 'https://www.last.fm';
const LOGIN_FIELD_USERNAME = 'username';
const LOGIN_FIELD_PASSWORD = 'password';

// helper for getting the set of relevant logins
function lastfmLogins() {
  return loginManager.findLogins({}, LOGIN_HOSTNAME, LOGIN_FORMURL,
      null);
}

// calculate a hex md5 digest thing
function md5(str) {
  var converter =
    Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
      createInstance(Components.interfaces.nsIScriptableUnicodeConverter);

  converter.charset = "UTF-8";
  // result is an out parameter,
  // result.value will contain the array length
  var result = {};
  // data is an array of bytes
  var data = converter.convertToByteArray(str, result);
  var ch = Components.classes["@mozilla.org/security/hash;1"]
                     .createInstance(Components.interfaces.nsICryptoHash);
  ch.init(ch.MD5);
  ch.update(data, data.length);
  var hash = ch.finish(false);

  // return the two-digit hexadecimal code for a byte
  function toHexString(charCode)
  {
    return ("0" + charCode.toString(16)).slice(-2);
  }

  // convert the binary hash data to a hex string.
  var s = [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
  return s;
}


function sbLastFm() {
  // our interface is really lightweight - make the service available as a JS
  // object so we can avoid the IDL / XPConnect complexity.
  this.wrappedJSObject = this;

  // keep track of our listeners
  this._listeners = [];

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
      self.eachListener(function(l) { l.onLoginSucceeded(); });
  }, function failure() {
      self.eachListener(function(l) { l.onLoginFailed(); });
    });
  }, function failure() {
    // FIXME: actually, we need some kind of retry / error reporting
    self.eachListener(function(l) { l.onLoginFailed(); });
  }, function auth_failure() {
    self.eachListener(function(l) { l.onLoginFailed(); });
  });
}
sbLastFm.prototype.cancelLogin =
function sbLastFm_cancelLogin() {
  if (this._handshake_xhr) {
    this._handshake_xhr.abort();
  }
  this.eachListener(function(l) { l.onLoginCancelled(); });
}

// logout is pretty simple
sbLastFm.prototype.logout =
function sbLastFm_logout() {
  this.session = null;
  this.nowplaying_url = null;
  this.submission_url = null;
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
    this.sessionid = response_lines[1];
    this.nowplaying_url = response_lines[2];
    this.submission_url = response_lines[3];
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
    self.eachListener(function(l) { l.onProfileUpdated(); });
    succeeded();
  }, function failure(xhr) {
    failed();
  });
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
}


function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule([sbLastFm]);
}
