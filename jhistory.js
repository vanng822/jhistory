/*
 * jQuery history plugin
 *
 * sample page: http://www.serpere.info/jquery-history-plugin/samples/
 *
 * Copyright (c) 2006-2009 Taku Sano (Mikage Sawatari)
 * Copyright (c) 2010 Takayuki Miwa
 * Licensed under the MIT License:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * Modified by Lincoln Cooper to add Safari support
 * and only call the callback once during initialization
 * for msie when no initial hash supplied.
 *
 * Modified by Van Nhu Nguyen (2011);
 * redesign
 * use hash token #!
 * delay of iframe creation
 * support popstate and hashchange (html5)
 * always load page if dynamic content
 * shorten the hash if it is a full url
 * reload full page using the hash if enter the page with a hash
 * reload the page when user uses back-button
 * and navigate to the "entered" page if this does not contain a hash
 */

(function($) {
	$.history = (function() {
		var appState = undefined;
		var appCallback = undefined;
		var usePushState = true;
		var dynamic = true;
		var hashHandler = {};
		var interval = 100;
		var support = {};
		var reloadIfInitHash = true;
		var shortenHashPattern = new RegExp("^" + document.location.protocol + "\/\/" + document.location.host, "i");
		var shortenHash = true;
		var encodeHash = false;
		var uaMatch = function(ua) {
			ua = ua.toLowerCase();
			var match = /(chrome)[ \/]([\w.]+)/.exec(ua) || /(webkit)[ \/]([\w.]+)/.exec(ua) || /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) || /(msie) ([\w.]+)/.exec(ua) || ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) || [];

			return {
				browser : match[1] || "",
				version : match[2] || "0"
			};
		};
		var browser = uaMatch(navigator.userAgent)
		support.needIframe = (browser.msie && (browser.version < 8 || document.documentMode < 8));
		support.pushState = (window.history && window.history.pushState);
		support.hashChange = ("onhashchange" in window);
		var hashHandlers = {};
		// Chrome fix
		var attachPopstateTimeout = browser.webkit ? 1500 : 0;

		hashHandlers.pushState = {
			init : function() {
				appState = this.get();
				if(reloadIfInitHash) {
					var hash = getHash(window);
					if(hash) {
						window.location = getReloadUrl(hash);
						return;
					}
				}
				this.attachPopstate(this, attachPopstateTimeout);
			},
			attachPopstate : function(handler, timeout) {
				if(timeout) {
					setTimeout(function() {
						$(window).bind("popstate", function() {
							handler.detect();
						});
					}, timeout);
				} else {
					$(window).bind("popstate", function() {
						handler.detect();
					});
				}
			},
			detect : function() {
				appState = this.get();
				appCallback(appState);
			},
			set : function(hash, title) {
				window.history.pushState(null, title ? title : "", hash);
			},
			get : function() {
				return window.location.href;
			}
		};

		hashHandlers.hashChange = {
			init : function() {
				if(( appState = getHash(window))) {
					if(reloadIfInitHash) {
						window.location = getReloadUrl(appState);
						return;
					}
					appCallback(appState);
				}
				if(support.hashChange) {
					$(window).bind("hashchange", detectHashChange);
				} else {
					setInterval(detectHashChange, interval);
				}
			},
			detect : function() {
				var currentHash = this.get();
				if(currentHash) {
					if(currentHash != appState) {
						appState = currentHash;
						appCallback(currentHash);
					}
				} else if(appState) {
					currentHash = cleanHash(window.location.href);
					appState = currentHash;
					appCallback(currentHash);
				}
			},
			set : function(hash, title) {
				setHash(hash, window);
				if(title) {
					document.title = title;
				}
			},
			get : function() {
				return getHash(window);
			}
		};

		hashHandlers.iframe = (function() {
			var id = "__jQuery_history";
			var getIframeDocument = function(write) {
				var doc = $("#" + id)[0].contentWindow.document;
				if(write) {
					doc.open();
					doc.close();
				}
				return doc;
			};
			return {
				init : function() {
					var self = null;
					if(( appState = getHash(window))) {
						if(reloadIfInitHash) {
							window.location = getReloadUrl(appState);
							return;
						}
						self = this;
					}
					/* delay call in case this method called before dom ready */
					$(document).ready(function() {
						var html = '<iframe id="' + id + '" style="display:none" src="javascript:false;" />';
						$("body").prepend(html);
						setInterval(detectHashChange, interval);
						if(appState) {
							appCallback(appState);
							self.set(appState);
						}
					});
				},
				detect : function() {
					var currentHash = this.get();
					var windowHash = getHash(window);
					if(currentHash != appState) {
						appState = currentHash;
						setHash(appState, window);
						appCallback(appState);
					} else if(currentHash != windowHash) {
						appState = windowHash;
						setHash(appState, getIframeDocument(true));
						appCallback(appState);
					}
				},
				set : function(hash, title) {
					setHash(hash, getIframeDocument(true));
					setHash(hash, window);
					if(title) {
						document.title = title;
					}
				},
				get : function() {
					return getHash(getIframeDocument());
				}
			};
		})();

		var setHash = function(hash, win) {
			win.location.hash = "!" + ( encodeHash ? encodeURIComponent(hash) : hash);
		};
		var getHash = function(win) {
			var hash = (win.location.hash).replace(/^#!/, '');
			return browser.mozilla ? hash : ( encodeHash ? decodeURIComponent(hash) : hash);
		};
		var cleanHash = function(hash) {
			if(shortenHash) {
				hash = hash.replace(shortenHashPattern, "");
			}
			return hash;
		};
		var getReloadUrl = function(hash) {
			var url = window.location.protocol + '//' + window.location.host;
			if(hash.charAt(0) != '/') {
				return url + '/' + hash;
			}
			return url + hash;
		};
		var getHashHandler = function() {
			if(support.needIframe) {
				return hashHandlers.iframe;
			}
			if(support.pushState && usePushState) {
				return hashHandlers.pushState;
			}
			return hashHandlers.hashChange;
		};
		var detectHashChange = function() {
			hashHandler.detect();
		};
		return {
			init : function(callback, options) {
				if(!$.isFunction(callback)) {
					throw new Error("callback must be a function");
				}
				appCallback = callback;
				if(options) {
					if( typeof options.noHash != 'undefined') {
						usePushState = new Boolean(options.noHash);
					}
					if( typeof options.dynamic != 'undefined') {
						dynamic = new Boolean(options.dynamic);
					}
					if( typeof options.initReload != 'undefined') {
						reloadIfInitHash = new Boolean(options.initReload);
					}
					if( typeof options.shorten != 'undefined') {
						shortenHash = new Boolean(options.shorten);
					}
				}
				hashHandler = getHashHandler();
				hashHandler.init();
			},
			load : function(hash, title) {
				hash = cleanHash(hash);
				if(dynamic || hash != appState) {
					hashHandler.set(hash, title);
					appState = hash;
					appCallback(hash);
				}
			}
		};
	})();

})(jQuery);
