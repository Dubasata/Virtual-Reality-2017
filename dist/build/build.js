(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){

/* **********************************************
     Begin prism-core.js
********************************************** */

var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
		? self // if in worker
		: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

var Prism = (function(){

// Private helper vars
var lang = /\blang(?:uage)?-(\w+)\b/i;
var uniqueId = 0;

var _ = _self.Prism = {
	manual: _self.Prism && _self.Prism.manual,
	util: {
		encode: function (tokens) {
			if (tokens instanceof Token) {
				return new Token(tokens.type, _.util.encode(tokens.content), tokens.alias);
			} else if (_.util.type(tokens) === 'Array') {
				return tokens.map(_.util.encode);
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		},

		type: function (o) {
			return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
		},

		objId: function (obj) {
			if (!obj['__id']) {
				Object.defineProperty(obj, '__id', { value: ++uniqueId });
			}
			return obj['__id'];
		},

		// Deep clone a language definition (e.g. to extend it)
		clone: function (o) {
			var type = _.util.type(o);

			switch (type) {
				case 'Object':
					var clone = {};

					for (var key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = _.util.clone(o[key]);
						}
					}

					return clone;

				case 'Array':
					// Check for existence for IE8
					return o.map && o.map(function(v) { return _.util.clone(v); });
			}

			return o;
		}
	},

	languages: {
		extend: function (id, redef) {
			var lang = _.util.clone(_.languages[id]);

			for (var key in redef) {
				lang[key] = redef[key];
			}

			return lang;
		},

		/**
		 * Insert a token before another token in a language literal
		 * As this needs to recreate the object (we cannot actually insert before keys in object literals),
		 * we cannot just provide an object, we need anobject and a key.
		 * @param inside The key (or language id) of the parent
		 * @param before The key to insert before. If not provided, the function appends instead.
		 * @param insert Object with the key/value pairs to insert
		 * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
		 */
		insertBefore: function (inside, before, insert, root) {
			root = root || _.languages;
			var grammar = root[inside];

			if (arguments.length == 2) {
				insert = arguments[1];

				for (var newToken in insert) {
					if (insert.hasOwnProperty(newToken)) {
						grammar[newToken] = insert[newToken];
					}
				}

				return grammar;
			}

			var ret = {};

			for (var token in grammar) {

				if (grammar.hasOwnProperty(token)) {

					if (token == before) {

						for (var newToken in insert) {

							if (insert.hasOwnProperty(newToken)) {
								ret[newToken] = insert[newToken];
							}
						}
					}

					ret[token] = grammar[token];
				}
			}

			// Update references in other language definitions
			_.languages.DFS(_.languages, function(key, value) {
				if (value === root[inside] && key != inside) {
					this[key] = ret;
				}
			});

			return root[inside] = ret;
		},

		// Traverse a language definition with Depth First Search
		DFS: function(o, callback, type, visited) {
			visited = visited || {};
			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					callback.call(o, i, o[i], type || i);

					if (_.util.type(o[i]) === 'Object' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, null, visited);
					}
					else if (_.util.type(o[i]) === 'Array' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, i, visited);
					}
				}
			}
		}
	},
	plugins: {},

	highlightAll: function(async, callback) {
		var env = {
			callback: callback,
			selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
		};

		_.hooks.run("before-highlightall", env);

		var elements = env.elements || document.querySelectorAll(env.selector);

		for (var i=0, element; element = elements[i++];) {
			_.highlightElement(element, async === true, env.callback);
		}
	},

	highlightElement: function(element, async, callback) {
		// Find language
		var language, grammar, parent = element;

		while (parent && !lang.test(parent.className)) {
			parent = parent.parentNode;
		}

		if (parent) {
			language = (parent.className.match(lang) || [,''])[1].toLowerCase();
			grammar = _.languages[language];
		}

		// Set language on the element, if not present
		element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

		// Set language on the parent, for styling
		parent = element.parentNode;

		if (/pre/i.test(parent.nodeName)) {
			parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
		}

		var code = element.textContent;

		var env = {
			element: element,
			language: language,
			grammar: grammar,
			code: code
		};

		_.hooks.run('before-sanity-check', env);

		if (!env.code || !env.grammar) {
			if (env.code) {
				_.hooks.run('before-highlight', env);
				env.element.textContent = env.code;
				_.hooks.run('after-highlight', env);
			}
			_.hooks.run('complete', env);
			return;
		}

		_.hooks.run('before-highlight', env);

		if (async && _self.Worker) {
			var worker = new Worker(_.filename);

			worker.onmessage = function(evt) {
				env.highlightedCode = evt.data;

				_.hooks.run('before-insert', env);

				env.element.innerHTML = env.highlightedCode;

				callback && callback.call(env.element);
				_.hooks.run('after-highlight', env);
				_.hooks.run('complete', env);
			};

			worker.postMessage(JSON.stringify({
				language: env.language,
				code: env.code,
				immediateClose: true
			}));
		}
		else {
			env.highlightedCode = _.highlight(env.code, env.grammar, env.language);

			_.hooks.run('before-insert', env);

			env.element.innerHTML = env.highlightedCode;

			callback && callback.call(element);

			_.hooks.run('after-highlight', env);
			_.hooks.run('complete', env);
		}
	},

	highlight: function (text, grammar, language) {
		var tokens = _.tokenize(text, grammar);
		return Token.stringify(_.util.encode(tokens), language);
	},

	matchGrammar: function (text, strarr, grammar, index, startPos, oneshot, target) {
		var Token = _.Token;

		for (var token in grammar) {
			if(!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			if (token == target) {
				return;
			}

			var patterns = grammar[token];
			patterns = (_.util.type(patterns) === "Array") ? patterns : [patterns];

			for (var j = 0; j < patterns.length; ++j) {
				var pattern = patterns[j],
					inside = pattern.inside,
					lookbehind = !!pattern.lookbehind,
					greedy = !!pattern.greedy,
					lookbehindLength = 0,
					alias = pattern.alias;

				if (greedy && !pattern.pattern.global) {
					// Without the global flag, lastIndex won't work
					var flags = pattern.pattern.toString().match(/[imuy]*$/)[0];
					pattern.pattern = RegExp(pattern.pattern.source, flags + "g");
				}

				pattern = pattern.pattern || pattern;

				// Don’t cache length as it changes during the loop
				for (var i = index, pos = startPos; i < strarr.length; pos += strarr[i].length, ++i) {

					var str = strarr[i];

					if (strarr.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						return;
					}

					if (str instanceof Token) {
						continue;
					}

					pattern.lastIndex = 0;

					var match = pattern.exec(str),
					    delNum = 1;

					// Greedy patterns can override/remove up to two previously matched tokens
					if (!match && greedy && i != strarr.length - 1) {
						pattern.lastIndex = pos;
						match = pattern.exec(text);
						if (!match) {
							break;
						}

						var from = match.index + (lookbehind ? match[1].length : 0),
						    to = match.index + match[0].length,
						    k = i,
						    p = pos;

						for (var len = strarr.length; k < len && (p < to || (!strarr[k].type && !strarr[k - 1].greedy)); ++k) {
							p += strarr[k].length;
							// Move the index i to the element in strarr that is closest to from
							if (from >= p) {
								++i;
								pos = p;
							}
						}

						/*
						 * If strarr[i] is a Token, then the match starts inside another Token, which is invalid
						 * If strarr[k - 1] is greedy we are in conflict with another greedy pattern
						 */
						if (strarr[i] instanceof Token || strarr[k - 1].greedy) {
							continue;
						}

						// Number of tokens to delete and replace with the new match
						delNum = k - i;
						str = text.slice(pos, p);
						match.index -= pos;
					}

					if (!match) {
						if (oneshot) {
							break;
						}

						continue;
					}

					if(lookbehind) {
						lookbehindLength = match[1].length;
					}

					var from = match.index + lookbehindLength,
					    match = match[0].slice(lookbehindLength),
					    to = from + match.length,
					    before = str.slice(0, from),
					    after = str.slice(to);

					var args = [i, delNum];

					if (before) {
						++i;
						pos += before.length;
						args.push(before);
					}

					var wrapped = new Token(token, inside? _.tokenize(match, inside) : match, alias, match, greedy);

					args.push(wrapped);

					if (after) {
						args.push(after);
					}

					Array.prototype.splice.apply(strarr, args);

					if (delNum != 1)
						_.matchGrammar(text, strarr, grammar, i, pos, true, token);

					if (oneshot)
						break;
				}
			}
		}
	},

	tokenize: function(text, grammar, language) {
		var strarr = [text];

		var rest = grammar.rest;

		if (rest) {
			for (var token in rest) {
				grammar[token] = rest[token];
			}

			delete grammar.rest;
		}

		_.matchGrammar(text, strarr, grammar, 0, 0, false);

		return strarr;
	},

	hooks: {
		all: {},

		add: function (name, callback) {
			var hooks = _.hooks.all;

			hooks[name] = hooks[name] || [];

			hooks[name].push(callback);
		},

		run: function (name, env) {
			var callbacks = _.hooks.all[name];

			if (!callbacks || !callbacks.length) {
				return;
			}

			for (var i=0, callback; callback = callbacks[i++];) {
				callback(env);
			}
		}
	}
};

var Token = _.Token = function(type, content, alias, matchedStr, greedy) {
	this.type = type;
	this.content = content;
	this.alias = alias;
	// Copy of the full string this token was created from
	this.length = (matchedStr || "").length|0;
	this.greedy = !!greedy;
};

Token.stringify = function(o, language, parent) {
	if (typeof o == 'string') {
		return o;
	}

	if (_.util.type(o) === 'Array') {
		return o.map(function(element) {
			return Token.stringify(element, language, o);
		}).join('');
	}

	var env = {
		type: o.type,
		content: Token.stringify(o.content, language, parent),
		tag: 'span',
		classes: ['token', o.type],
		attributes: {},
		language: language,
		parent: parent
	};

	if (env.type == 'comment') {
		env.attributes['spellcheck'] = 'true';
	}

	if (o.alias) {
		var aliases = _.util.type(o.alias) === 'Array' ? o.alias : [o.alias];
		Array.prototype.push.apply(env.classes, aliases);
	}

	_.hooks.run('wrap', env);

	var attributes = Object.keys(env.attributes).map(function(name) {
		return name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
	}).join(' ');

	return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + (attributes ? ' ' + attributes : '') + '>' + env.content + '</' + env.tag + '>';

};

if (!_self.document) {
	if (!_self.addEventListener) {
		// in Node.js
		return _self.Prism;
	}
 	// In worker
	_self.addEventListener('message', function(evt) {
		var message = JSON.parse(evt.data),
		    lang = message.language,
		    code = message.code,
		    immediateClose = message.immediateClose;

		_self.postMessage(_.highlight(code, _.languages[lang], lang));
		if (immediateClose) {
			_self.close();
		}
	}, false);

	return _self.Prism;
}

//Get current script and highlight
var script = document.currentScript || [].slice.call(document.getElementsByTagName("script")).pop();

if (script) {
	_.filename = script.src;

	if (document.addEventListener && !_.manual && !script.hasAttribute('data-manual')) {
		if(document.readyState !== "loading") {
			if (window.requestAnimationFrame) {
				window.requestAnimationFrame(_.highlightAll);
			} else {
				window.setTimeout(_.highlightAll, 16);
			}
		}
		else {
			document.addEventListener('DOMContentLoaded', _.highlightAll);
		}
	}
}

return _self.Prism;

})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== 'undefined') {
	global.Prism = Prism;
}


/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
	'comment': /<!--[\s\S]*?-->/,
	'prolog': /<\?[\s\S]+?\?>/,
	'doctype': /<!DOCTYPE[\s\S]+?>/i,
	'cdata': /<!\[CDATA\[[\s\S]*?]]>/i,
	'tag': {
		pattern: /<\/?(?!\d)[^\s>\/=$<]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\\1|\\?(?!\1)[\s\S])*\1|[^\s'">=]+))?)*\s*\/?>/i,
		inside: {
			'tag': {
				pattern: /^<\/?[^\s>\/]+/i,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[^\s>\/:]+:/
				}
			},
			'attr-value': {
				pattern: /=(?:('|")[\s\S]*?(\1)|[^\s>]+)/i,
				inside: {
					'punctuation': /[=>"']/
				}
			},
			'punctuation': /\/?>/,
			'attr-name': {
				pattern: /[^\s>\/]+/,
				inside: {
					'namespace': /^[^\s>\/:]+:/
				}
			}

		}
	},
	'entity': /&#?[\da-z]{1,8};/i
};

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function(env) {

	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&amp;/, '&');
	}
});

Prism.languages.xml = Prism.languages.markup;
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;


/* **********************************************
     Begin prism-css.js
********************************************** */

Prism.languages.css = {
	'comment': /\/\*[\s\S]*?\*\//,
	'atrule': {
		pattern: /@[\w-]+?.*?(;|(?=\s*\{))/i,
		inside: {
			'rule': /@[\w-]+/
			// See rest below
		}
	},
	'url': /url\((?:(["'])(\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1|.*?)\)/i,
	'selector': /[^\{\}\s][^\{\};]*?(?=\s*\{)/,
	'string': {
		pattern: /("|')(\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'property': /(\b|\B)[\w-]+(?=\s*:)/i,
	'important': /\B!important\b/i,
	'function': /[-a-z0-9]+(?=\()/i,
	'punctuation': /[(){};:]/
};

Prism.languages.css['atrule'].inside.rest = Prism.util.clone(Prism.languages.css);

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'style': {
			pattern: /(<style[\s\S]*?>)[\s\S]*?(?=<\/style>)/i,
			lookbehind: true,
			inside: Prism.languages.css,
			alias: 'language-css'
		}
	});
	
	Prism.languages.insertBefore('inside', 'attr-value', {
		'style-attr': {
			pattern: /\s*style=("|').*?\1/i,
			inside: {
				'attr-name': {
					pattern: /^\s*style/i,
					inside: Prism.languages.markup.tag.inside
				},
				'punctuation': /^\s*=\s*['"]|['"]\s*$/,
				'attr-value': {
					pattern: /.+/i,
					inside: Prism.languages.css
				}
			},
			alias: 'language-css'
		}
	}, Prism.languages.markup.tag);
}

/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\s\S]*?\*\//,
			lookbehind: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true
		}
	],
	'string': {
		pattern: /(["'])(\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'class-name': {
		pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[a-z0-9_\.\\]+/i,
		lookbehind: true,
		inside: {
			punctuation: /(\.|\\)/
		}
	},
	'keyword': /\b(if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
	'boolean': /\b(true|false)\b/,
	'function': /[a-z0-9_]+(?=\()/i,
	'number': /\b-?(?:0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?)\b/i,
	'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
	'punctuation': /[{}[\];(),.:]/
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'keyword': /\b(as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/,
	'number': /\b-?(0x[\dA-Fa-f]+|0b[01]+|0o[0-7]+|\d*\.?\d+([Ee][+-]?\d+)?|NaN|Infinity)\b/,
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*(?=\()/i,
	'operator': /-[-=]?|\+[+=]?|!=?=?|<<?=?|>>?>?=?|=(?:==?|>)?|&[&=]?|\|[|=]?|\*\*?=?|\/=?|~|\^=?|%=?|\?|\.{3}/
});

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: /(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\\\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})]))/,
		lookbehind: true,
		greedy: true
	}
});

Prism.languages.insertBefore('javascript', 'string', {
	'template-string': {
		pattern: /`(?:\\\\|\\?[^\\])*?`/,
		greedy: true,
		inside: {
			'interpolation': {
				pattern: /\$\{[^}]+\}/,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\$\{|\}$/,
						alias: 'punctuation'
					},
					rest: Prism.languages.javascript
				}
			},
			'string': /[\s\S]+/
		}
	}
});

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'script': {
			pattern: /(<script[\s\S]*?>)[\s\S]*?(?=<\/script>)/i,
			lookbehind: true,
			inside: Prism.languages.javascript,
			alias: 'language-javascript'
		}
	});
}

Prism.languages.js = Prism.languages.javascript;

/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function () {
	if (typeof self === 'undefined' || !self.Prism || !self.document || !document.querySelector) {
		return;
	}

	self.Prism.fileHighlight = function() {

		var Extensions = {
			'js': 'javascript',
			'py': 'python',
			'rb': 'ruby',
			'ps1': 'powershell',
			'psm1': 'powershell',
			'sh': 'bash',
			'bat': 'batch',
			'h': 'c',
			'tex': 'latex'
		};

		if(Array.prototype.forEach) { // Check to prevent error in IE8
			Array.prototype.slice.call(document.querySelectorAll('pre[data-src]')).forEach(function (pre) {
				var src = pre.getAttribute('data-src');

				var language, parent = pre;
				var lang = /\blang(?:uage)?-(?!\*)(\w+)\b/i;
				while (parent && !lang.test(parent.className)) {
					parent = parent.parentNode;
				}

				if (parent) {
					language = (pre.className.match(lang) || [, ''])[1];
				}

				if (!language) {
					var extension = (src.match(/\.(\w+)$/) || [, ''])[1];
					language = Extensions[extension] || extension;
				}

				var code = document.createElement('code');
				code.className = 'language-' + language;

				pre.textContent = '';

				code.textContent = 'Loading…';

				pre.appendChild(code);

				var xhr = new XMLHttpRequest();

				xhr.open('GET', src, true);

				xhr.onreadystatechange = function () {
					if (xhr.readyState == 4) {

						if (xhr.status < 400 && xhr.responseText) {
							code.textContent = xhr.responseText;

							Prism.highlightElement(code);
						}
						else if (xhr.status >= 400) {
							code.textContent = '✖ Error ' + xhr.status + ' while fetching file: ' + xhr.statusText;
						}
						else {
							code.textContent = '✖ Error: File does not exist or is empty';
						}
					}
				};

				xhr.send(null);
			});
		}

	};

	document.addEventListener('DOMContentLoaded', self.Prism.fileHighlight);

})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],2:[function(require,module,exports){
module.exports = function() {
  return function(deck) {
    var backdrops;

    function createBackdropForSlide(slide) {
      var backdropAttribute = slide.getAttribute('data-bespoke-backdrop');

      if (backdropAttribute) {
        var backdrop = document.createElement('div');
        backdrop.className = backdropAttribute;
        backdrop.classList.add('bespoke-backdrop');
        deck.parent.appendChild(backdrop);
        return backdrop;
      }
    }

    function updateClasses(el) {
      if (el) {
        var index = backdrops.indexOf(el),
          currentIndex = deck.slide();

        removeClass(el, 'active');
        removeClass(el, 'inactive');
        removeClass(el, 'before');
        removeClass(el, 'after');

        if (index !== currentIndex) {
          addClass(el, 'inactive');
          addClass(el, index < currentIndex ? 'before' : 'after');
        } else {
          addClass(el, 'active');
        }
      }
    }

    function removeClass(el, className) {
      el.classList.remove('bespoke-backdrop-' + className);
    }

    function addClass(el, className) {
      el.classList.add('bespoke-backdrop-' + className);
    }

    backdrops = deck.slides
      .map(createBackdropForSlide);

    deck.on('activate', function() {
      backdrops.forEach(updateClasses);
    });
  };
};

},{}],3:[function(require,module,exports){
module.exports = function(options) {
  return function(deck) {
    var activeSlideIndex,
      activeBulletIndex,

      bullets = deck.slides.map(function(slide) {
        return [].slice.call(slide.querySelectorAll((typeof options === 'string' ? options : '[data-bespoke-bullet]')), 0);
      }),

      next = function() {
        var nextSlideIndex = activeSlideIndex + 1;

        if (activeSlideHasBulletByOffset(1)) {
          activateBullet(activeSlideIndex, activeBulletIndex + 1);
          return false;
        } else if (bullets[nextSlideIndex]) {
          activateBullet(nextSlideIndex, 0);
        }
      },

      prev = function() {
        var prevSlideIndex = activeSlideIndex - 1;

        if (activeSlideHasBulletByOffset(-1)) {
          activateBullet(activeSlideIndex, activeBulletIndex - 1);
          return false;
        } else if (bullets[prevSlideIndex]) {
          activateBullet(prevSlideIndex, bullets[prevSlideIndex].length - 1);
        }
      },

      activateBullet = function(slideIndex, bulletIndex) {
        activeSlideIndex = slideIndex;
        activeBulletIndex = bulletIndex;

        bullets.forEach(function(slide, s) {
          slide.forEach(function(bullet, b) {
            bullet.classList.add('bespoke-bullet');

            if (s < slideIndex || s === slideIndex && b <= bulletIndex) {
              bullet.classList.add('bespoke-bullet-active');
              bullet.classList.remove('bespoke-bullet-inactive');
            } else {
              bullet.classList.add('bespoke-bullet-inactive');
              bullet.classList.remove('bespoke-bullet-active');
            }

            if (s === slideIndex && b === bulletIndex) {
              bullet.classList.add('bespoke-bullet-current');
            } else {
              bullet.classList.remove('bespoke-bullet-current');
            }
          });
        });
      },

      activeSlideHasBulletByOffset = function(offset) {
        return bullets[activeSlideIndex][activeBulletIndex + offset] !== undefined;
      };

    deck.on('next', next);
    deck.on('prev', prev);

    deck.on('slide', function(e) {
      activateBullet(e.index, 0);
    });

    activateBullet(0, 0);
  };
};

},{}],4:[function(require,module,exports){
module.exports = function() {
  return function(deck) {
    deck.slides.forEach(function(slide) {
      slide.addEventListener('keydown', function(e) {
        if (/INPUT|TEXTAREA|SELECT/.test(e.target.nodeName) || e.target.contentEditable === 'true') {
          e.stopPropagation();
        }
      });
    });
  };
};

},{}],5:[function(require,module,exports){
module.exports = function() {
  return function(deck) {
    var activateSlide = function(index) {
      var indexToActivate = -1 < index && index < deck.slides.length ? index : 0;
      if (indexToActivate !== deck.slide()) {
        deck.slide(indexToActivate);
      }
    };

    var parseHash = function() {
      var hash = window.location.hash.slice(1),
        slideNumberOrName = parseInt(hash, 10);

      if (hash) {
        if (slideNumberOrName) {
          activateSlide(slideNumberOrName - 1);
        } else {
          deck.slides.forEach(function(slide, i) {
            if (slide.getAttribute('data-bespoke-hash') === hash || slide.id === hash) {
              activateSlide(i);
            }
          });
        }
      }
    };

    setTimeout(function() {
      parseHash();

      deck.on('activate', function(e) {
        var slideName = e.slide.getAttribute('data-bespoke-hash') || e.slide.id;
        window.location.hash = slideName || e.index + 1;
      });

      window.addEventListener('hashchange', parseHash);
    }, 0);
  };
};

},{}],6:[function(require,module,exports){
module.exports = function(options) {
  return function(deck) {
    var isHorizontal = options !== 'vertical';

    document.addEventListener('keydown', function(e) {
      if (e.which == 34 || // PAGE DOWN
        (e.which == 32 && !e.shiftKey) || // SPACE WITHOUT SHIFT
        (isHorizontal && e.which == 39) || // RIGHT
        (!isHorizontal && e.which == 40) // DOWN
      ) { deck.next(); }

      if (e.which == 33 || // PAGE UP
        (e.which == 32 && e.shiftKey) || // SPACE + SHIFT
        (isHorizontal && e.which == 37) || // LEFT
        (!isHorizontal && e.which == 38) // UP
      ) { deck.prev(); }
    });
  };
};

},{}],7:[function(require,module,exports){
module.exports = function(options) {
  return function (deck) {
    var progressParent = document.createElement('div'),
      progressBar = document.createElement('div'),
      prop = options === 'vertical' ? 'height' : 'width';

    progressParent.className = 'bespoke-progress-parent';
    progressBar.className = 'bespoke-progress-bar';
    progressParent.appendChild(progressBar);
    deck.parent.appendChild(progressParent);

    deck.on('activate', function(e) {
      progressBar.style[prop] = (e.index * 100 / (deck.slides.length - 1)) + '%';
    });
  };
};

},{}],8:[function(require,module,exports){
module.exports = function(options) {
  return function(deck) {
    var parent = deck.parent,
      firstSlide = deck.slides[0],
      slideHeight = firstSlide.offsetHeight,
      slideWidth = firstSlide.offsetWidth,
      useZoom = options === 'zoom' || ('zoom' in parent.style && options !== 'transform'),

      wrap = function(element) {
        var wrapper = document.createElement('div');
        wrapper.className = 'bespoke-scale-parent';
        element.parentNode.insertBefore(wrapper, element);
        wrapper.appendChild(element);
        return wrapper;
      },

      elements = useZoom ? deck.slides : deck.slides.map(wrap),

      transformProperty = (function(property) {
        var prefixes = 'Moz Webkit O ms'.split(' ');
        return prefixes.reduce(function(currentProperty, prefix) {
            return prefix + property in parent.style ? prefix + property : currentProperty;
          }, property.toLowerCase());
      }('Transform')),

      scale = useZoom ?
        function(ratio, element) {
          element.style.zoom = ratio;
        } :
        function(ratio, element) {
          element.style[transformProperty] = 'scale(' + ratio + ')';
        },

      scaleAll = function() {
        var xScale = parent.offsetWidth / slideWidth,
          yScale = parent.offsetHeight / slideHeight;

        elements.forEach(scale.bind(null, Math.min(xScale, yScale)));
      };

    window.addEventListener('resize', scaleAll);
    scaleAll();
  };

};

},{}],9:[function(require,module,exports){
(function (global){
/*! bespoke-theme-atomantic v2.1.4 © 2016 Adam Eivy, MIT License */
!function(t){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e=e.bespoke||(e.bespoke={}),e=e.themes||(e.themes={}),e.atomantic=t()}}(function(){return function t(e,a,n){function o(i,s){if(!a[i]){if(!e[i]){var m="function"==typeof require&&require;if(!s&&m)return m(i,!0);if(r)return r(i,!0);var f=new Error("Cannot find module '"+i+"'");throw f.code="MODULE_NOT_FOUND",f}var p=a[i]={exports:{}};e[i][0].call(p.exports,function(t){var a=e[i][1][t];return o(a?a:t)},p,p.exports,t,e,a,n)}return a[i].exports}for(var r="function"==typeof require&&require,i=0;i<n.length;i++)o(n[i]);return o}({1:[function(t,e,a){var n=t("bespoke-classes"),o=t("insert-css"),r=function(t){var e=t.slides.map(function(t){return[].slice.call(t.querySelectorAll("x-gif"),0)}),a=function(t){return function(a){e[a.index].map(function(e){t?e.setAttribute("stopped",""):e.removeAttribute("stopped"),a.slide.classList.remove("x-gif-finished"),t||e.addEventListener("x-gif-finished",function(){a.slide.classList.add("x-gif-finished")})})}};t.on("activate",a(!1)),t.on("deactivate",a(!0))},s=function(t){t.on("activate",function(t){Array.prototype.forEach.call(t.slide.querySelectorAll(".animated")||[],function(t){t.outerHTML=t.outerHTML.replace("animated","animate animated")})})};if(e.exports=function(){var t="/*! normalize.css v3.0.0 | MIT License | git.io/normalize */\nhtml{font-family:sans-serif;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}body{margin:0}article,aside,details,figcaption,figure,footer,header,hgroup,main,nav,section,summary{display:block}audio,canvas,progress,video{display:inline-block;vertical-align:baseline}audio:not([controls]){display:none;height:0}[hidden],template{display:none}a{background:0 0}a:active,a:hover{outline:0}abbr[title]{border-bottom:1px dotted}b,strong{font-weight:700}dfn{font-style:italic}h1{font-size:2em;margin:.67em 0}mark{background:#ff0;color:#000}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sup{top:-.5em}sub{bottom:-.25em}img{border:0}svg:not(:root){overflow:hidden}figure{margin:1em 40px}hr{box-sizing:content-box;height:0}pre{overflow:auto}code,kbd,pre,samp{font-family:monospace,monospace;font-size:1em}button,input,optgroup,select,textarea{color:inherit;font:inherit;margin:0}button{overflow:visible}button,select{text-transform:none}button,html input[type=button],input[type=reset],input[type=submit]{-webkit-appearance:button;cursor:pointer}button[disabled],html input[disabled]{cursor:default}button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0}input{line-height:normal}input[type=checkbox],input[type=radio]{box-sizing:border-box;padding:0}input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{height:auto}input[type=search]{-webkit-appearance:textfield;box-sizing:content-box}input[type=search]::-webkit-search-cancel-button,input[type=search]::-webkit-search-decoration{-webkit-appearance:none}fieldset{border:1px solid silver;margin:0 2px;padding:.35em .625em .75em}legend{border:0}textarea{overflow:auto}optgroup{font-weight:700}table{border-collapse:collapse;border-spacing:0}legend,td,th{padding:0}\n/*!\n * animate.css -http://daneden.me/animate\n * Version - 3.5.1\n * Licensed under the MIT license - http://opensource.org/licenses/MIT\n *\n * Copyright (c) 2016 Daniel Eden\n */\n.animated{animation-duration:1s;animation-fill-mode:both}.animated.infinite{animation-iteration-count:infinite}.animated.hinge{animation-duration:2s}.animated.bounceIn,.animated.bounceOut,.animated.flipOutX,.animated.flipOutY{animation-duration:.75s}@keyframes bounce{0%,20%,53%,80%,to{animation-timing-function:cubic-bezier(.215,.61,.355,1);transform:translateZ(0)}40%,43%{transform:translate3d(0,-30px,0)}40%,43%,70%{animation-timing-function:cubic-bezier(.755,.05,.855,.06)}70%{transform:translate3d(0,-15px,0)}90%{transform:translate3d(0,-4px,0)}}.bounce{animation-name:bounce;transform-origin:center bottom}@keyframes flash{0%,50%,to{opacity:1}25%,75%{opacity:0}}.flash{animation-name:flash}@keyframes pulse{0%,to{transform:scaleX(1)}50%{transform:scale3d(1.05,1.05,1.05)}}.pulse{animation-name:pulse}@keyframes rubberBand{0%,to{transform:scaleX(1)}30%{transform:scale3d(1.25,.75,1)}40%{transform:scale3d(.75,1.25,1)}50%{transform:scale3d(1.15,.85,1)}65%{transform:scale3d(.95,1.05,1)}75%{transform:scale3d(1.05,.95,1)}}.rubberBand{animation-name:rubberBand}@keyframes shake{0%,to{transform:translateZ(0)}10%,30%,50%,70%,90%{transform:translate3d(-10px,0,0)}20%,40%,60%,80%{transform:translate3d(10px,0,0)}}.shake{animation-name:shake}@keyframes headShake{0%,50%{transform:translateX(0)}6.5%{transform:translateX(-6px) rotateY(-9deg)}18.5%{transform:translateX(5px) rotateY(7deg)}31.5%{transform:translateX(-3px) rotateY(-5deg)}43.5%{transform:translateX(2px) rotateY(3deg)}}.headShake{animation-timing-function:ease-in-out;animation-name:headShake}@keyframes swing{20%{transform:rotate(15deg)}40%{transform:rotate(-10deg)}60%{transform:rotate(5deg)}80%{transform:rotate(-5deg)}to{transform:rotate(0deg)}}.swing{transform-origin:top center;animation-name:swing}@keyframes tada{0%,to{transform:scaleX(1)}10%,20%{transform:scale3d(.9,.9,.9) rotate(-3deg)}30%,50%,70%,90%{transform:scale3d(1.1,1.1,1.1) rotate(3deg)}40%,60%,80%{transform:scale3d(1.1,1.1,1.1) rotate(-3deg)}}.tada{animation-name:tada}@keyframes wobble{0%,to{transform:none}15%{transform:translate3d(-25%,0,0) rotate(-5deg)}30%{transform:translate3d(20%,0,0) rotate(3deg)}45%{transform:translate3d(-15%,0,0) rotate(-3deg)}60%{transform:translate3d(10%,0,0) rotate(2deg)}75%{transform:translate3d(-5%,0,0) rotate(-1deg)}}.wobble{animation-name:wobble}@keyframes jello{0%,11.1%,to{transform:none}22.2%{transform:skewX(-12.5deg) skewY(-12.5deg)}33.3%{transform:skewX(6.25deg) skewY(6.25deg)}44.4%{transform:skewX(-3.125deg) skewY(-3.125deg)}55.5%{transform:skewX(1.5625deg) skewY(1.5625deg)}66.6%{transform:skewX(-.78125deg) skewY(-.78125deg)}77.7%{transform:skewX(.390625deg) skewY(.390625deg)}88.8%{transform:skewX(-.1953125deg) skewY(-.1953125deg)}}.jello{animation-name:jello;transform-origin:center}@keyframes bounceIn{0%,20%,40%,60%,80%,to{animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;transform:scale3d(.3,.3,.3)}20%{transform:scale3d(1.1,1.1,1.1)}40%{transform:scale3d(.9,.9,.9)}60%{opacity:1;transform:scale3d(1.03,1.03,1.03)}80%{transform:scale3d(.97,.97,.97)}to{opacity:1;transform:scaleX(1)}}.bounceIn{animation-name:bounceIn}@keyframes bounceInDown{0%,60%,75%,90%,to{animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;transform:translate3d(0,-3000px,0)}60%{opacity:1;transform:translate3d(0,25px,0)}75%{transform:translate3d(0,-10px,0)}90%{transform:translate3d(0,5px,0)}to{transform:none}}.bounceInDown{animation-name:bounceInDown}@keyframes bounceInLeft{0%,60%,75%,90%,to{animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;transform:translate3d(-3000px,0,0)}60%{opacity:1;transform:translate3d(25px,0,0)}75%{transform:translate3d(-10px,0,0)}90%{transform:translate3d(5px,0,0)}to{transform:none}}.bounceInLeft{animation-name:bounceInLeft}@keyframes bounceInRight{0%,60%,75%,90%,to{animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;transform:translate3d(3000px,0,0)}60%{opacity:1;transform:translate3d(-25px,0,0)}75%{transform:translate3d(10px,0,0)}90%{transform:translate3d(-5px,0,0)}to{transform:none}}.bounceInRight{animation-name:bounceInRight}@keyframes bounceInUp{0%,60%,75%,90%,to{animation-timing-function:cubic-bezier(.215,.61,.355,1)}0%{opacity:0;transform:translate3d(0,3000px,0)}60%{opacity:1;transform:translate3d(0,-20px,0)}75%{transform:translate3d(0,10px,0)}90%{transform:translate3d(0,-5px,0)}to{transform:translateZ(0)}}.bounceInUp{animation-name:bounceInUp}@keyframes bounceOut{20%{transform:scale3d(.9,.9,.9)}50%,55%{opacity:1;transform:scale3d(1.1,1.1,1.1)}to{opacity:0;transform:scale3d(.3,.3,.3)}}.bounceOut{animation-name:bounceOut}@keyframes bounceOutDown{20%{transform:translate3d(0,10px,0)}40%,45%{opacity:1;transform:translate3d(0,-20px,0)}to{opacity:0;transform:translate3d(0,2000px,0)}}.bounceOutDown{animation-name:bounceOutDown}@keyframes bounceOutLeft{20%{opacity:1;transform:translate3d(20px,0,0)}to{opacity:0;transform:translate3d(-2000px,0,0)}}.bounceOutLeft{animation-name:bounceOutLeft}@keyframes bounceOutRight{20%{opacity:1;transform:translate3d(-20px,0,0)}to{opacity:0;transform:translate3d(2000px,0,0)}}.bounceOutRight{animation-name:bounceOutRight}@keyframes bounceOutUp{20%{transform:translate3d(0,-10px,0)}40%,45%{opacity:1;transform:translate3d(0,20px,0)}to{opacity:0;transform:translate3d(0,-2000px,0)}}.bounceOutUp{animation-name:bounceOutUp}@keyframes fadeIn{0%{opacity:0}to{opacity:1}}.fadeIn{animation-name:fadeIn}@keyframes fadeInDown{0%{opacity:0;transform:translate3d(0,-100%,0)}to{opacity:1;transform:none}}.fadeInDown{animation-name:fadeInDown}@keyframes fadeInDownBig{0%{opacity:0;transform:translate3d(0,-2000px,0)}to{opacity:1;transform:none}}.fadeInDownBig{animation-name:fadeInDownBig}@keyframes fadeInLeft{0%{opacity:0;transform:translate3d(-100%,0,0)}to{opacity:1;transform:none}}.fadeInLeft{animation-name:fadeInLeft}@keyframes fadeInLeftBig{0%{opacity:0;transform:translate3d(-2000px,0,0)}to{opacity:1;transform:none}}.fadeInLeftBig{animation-name:fadeInLeftBig}@keyframes fadeInRight{0%{opacity:0;transform:translate3d(100%,0,0)}to{opacity:1;transform:none}}.fadeInRight{animation-name:fadeInRight}@keyframes fadeInRightBig{0%{opacity:0;transform:translate3d(2000px,0,0)}to{opacity:1;transform:none}}.fadeInRightBig{animation-name:fadeInRightBig}@keyframes fadeInUp{0%{opacity:0;transform:translate3d(0,100%,0)}to{opacity:1;transform:none}}.fadeInUp{animation-name:fadeInUp}@keyframes fadeInUpBig{0%{opacity:0;transform:translate3d(0,2000px,0)}to{opacity:1;transform:none}}.fadeInUpBig{animation-name:fadeInUpBig}@keyframes fadeOut{0%{opacity:1}to{opacity:0}}.fadeOut{animation-name:fadeOut}@keyframes fadeOutDown{0%{opacity:1}to{opacity:0;transform:translate3d(0,100%,0)}}.fadeOutDown{animation-name:fadeOutDown}@keyframes fadeOutDownBig{0%{opacity:1}to{opacity:0;transform:translate3d(0,2000px,0)}}.fadeOutDownBig{animation-name:fadeOutDownBig}@keyframes fadeOutLeft{0%{opacity:1}to{opacity:0;transform:translate3d(-100%,0,0)}}.fadeOutLeft{animation-name:fadeOutLeft}@keyframes fadeOutLeftBig{0%{opacity:1}to{opacity:0;transform:translate3d(-2000px,0,0)}}.fadeOutLeftBig{animation-name:fadeOutLeftBig}@keyframes fadeOutRight{0%{opacity:1}to{opacity:0;transform:translate3d(100%,0,0)}}.fadeOutRight{animation-name:fadeOutRight}@keyframes fadeOutRightBig{0%{opacity:1}to{opacity:0;transform:translate3d(2000px,0,0)}}.fadeOutRightBig{animation-name:fadeOutRightBig}@keyframes fadeOutUp{0%{opacity:1}to{opacity:0;transform:translate3d(0,-100%,0)}}.fadeOutUp{animation-name:fadeOutUp}@keyframes fadeOutUpBig{0%{opacity:1}to{opacity:0;transform:translate3d(0,-2000px,0)}}.fadeOutUpBig{animation-name:fadeOutUpBig}@keyframes flip{0%{transform:perspective(400px) rotateY(-1turn);animation-timing-function:ease-out}40%{animation-timing-function:ease-out;transform:perspective(400px) translateZ(150px) rotateY(-190deg)}50%{transform:perspective(400px) translateZ(150px) rotateY(-170deg);animation-timing-function:ease-in}80%{animation-timing-function:ease-in;transform:perspective(400px) scale3d(.95,.95,.95)}to{transform:perspective(400px);animation-timing-function:ease-in}}.animated.flip{-webkit-backface-visibility:visible;backface-visibility:visible;animation-name:flip}@keyframes flipInX{0%{transform:perspective(400px) rotateX(90deg);opacity:0;animation-timing-function:ease-in}40%{animation-timing-function:ease-in;transform:perspective(400px) rotateX(-20deg)}60%{transform:perspective(400px) rotateX(10deg);opacity:1}80%{transform:perspective(400px) rotateX(-5deg)}to{transform:perspective(400px)}}.flipInX,.flipInY,.flipOutX,.flipOutY{-webkit-backface-visibility:visible!important;backface-visibility:visible!important;animation-name:flipInX}@keyframes flipInY{0%{transform:perspective(400px) rotateY(90deg);opacity:0;animation-timing-function:ease-in}40%{animation-timing-function:ease-in;transform:perspective(400px) rotateY(-20deg)}60%{transform:perspective(400px) rotateY(10deg);opacity:1}80%{transform:perspective(400px) rotateY(-5deg)}to{transform:perspective(400px)}}.flipInY,.flipOutX,.flipOutY{animation-name:flipInY}@keyframes flipOutX{0%{transform:perspective(400px)}30%{transform:perspective(400px) rotateX(-20deg);opacity:1}to{transform:perspective(400px) rotateX(90deg);opacity:0}}.flipOutX,.flipOutY{animation-name:flipOutX}@keyframes flipOutY{0%{transform:perspective(400px)}30%{transform:perspective(400px) rotateY(-15deg);opacity:1}to{transform:perspective(400px) rotateY(90deg);opacity:0}}.flipOutY{animation-name:flipOutY}@keyframes lightSpeedIn{0%{transform:translate3d(100%,0,0) skewX(-30deg);opacity:0}60%{transform:skewX(20deg);opacity:1}80%{opacity:1;transform:skewX(-5deg)}to{transform:none;opacity:1}}.lightSpeedIn{animation-name:lightSpeedIn;animation-timing-function:ease-out}@keyframes lightSpeedOut{0%{opacity:1}to{transform:translate3d(100%,0,0) skewX(30deg);opacity:0}}.lightSpeedOut{animation-name:lightSpeedOut;animation-timing-function:ease-in}@keyframes rotateIn{0%{transform-origin:center;transform:rotate(-200deg);opacity:0;-webkit-transform-origin:center}to{-webkit-transform-origin:center;transform-origin:center;transform:none;opacity:1}}.rotateIn{animation-name:rotateIn}@keyframes rotateInDownLeft{0%{transform-origin:left bottom;transform:rotate(-45deg);opacity:0;-webkit-transform-origin:left bottom}to{-webkit-transform-origin:left bottom;transform-origin:left bottom;transform:none;opacity:1}}.rotateInDownLeft{animation-name:rotateInDownLeft}@keyframes rotateInDownRight{0%{transform-origin:right bottom;transform:rotate(45deg);opacity:0;-webkit-transform-origin:right bottom}to{-webkit-transform-origin:right bottom;transform-origin:right bottom;transform:none;opacity:1}}.rotateInDownRight{animation-name:rotateInDownRight}@keyframes rotateInUpLeft{0%{transform-origin:left bottom;transform:rotate(45deg);opacity:0;-webkit-transform-origin:left bottom}to{-webkit-transform-origin:left bottom;transform-origin:left bottom;transform:none;opacity:1}}.rotateInUpLeft{animation-name:rotateInUpLeft}@keyframes rotateInUpRight{0%{transform-origin:right bottom;transform:rotate(-90deg);opacity:0;-webkit-transform-origin:right bottom}to{-webkit-transform-origin:right bottom;transform-origin:right bottom;transform:none;opacity:1}}.rotateInUpRight{animation-name:rotateInUpRight}@keyframes rotateOut{0%{transform-origin:center;opacity:1;-webkit-transform-origin:center}to{-webkit-transform-origin:center;transform-origin:center;transform:rotate(200deg);opacity:0}}.rotateOut{animation-name:rotateOut}@keyframes rotateOutDownLeft{0%{transform-origin:left bottom;opacity:1;-webkit-transform-origin:left bottom}to{-webkit-transform-origin:left bottom;transform-origin:left bottom;transform:rotate(45deg);opacity:0}}.rotateOutDownLeft{animation-name:rotateOutDownLeft}@keyframes rotateOutDownRight{0%{transform-origin:right bottom;opacity:1;-webkit-transform-origin:right bottom}to{-webkit-transform-origin:right bottom;transform-origin:right bottom;transform:rotate(-45deg);opacity:0}}.rotateOutDownRight{animation-name:rotateOutDownRight}@keyframes rotateOutUpLeft{0%{transform-origin:left bottom;opacity:1;-webkit-transform-origin:left bottom}to{-webkit-transform-origin:left bottom;transform-origin:left bottom;transform:rotate(-45deg);opacity:0}}.rotateOutUpLeft{animation-name:rotateOutUpLeft}@keyframes rotateOutUpRight{0%{transform-origin:right bottom;opacity:1;-webkit-transform-origin:right bottom}to{-webkit-transform-origin:right bottom;transform-origin:right bottom;transform:rotate(90deg);opacity:0}}.rotateOutUpRight{animation-name:rotateOutUpRight}@keyframes hinge{0%{transform-origin:top left;-webkit-transform-origin:top left;animation-timing-function:ease-in-out}20%,60%{-webkit-transform-origin:top left;animation-timing-function:ease-in-out;transform:rotate(80deg);transform-origin:top left}40%,80%{transform:rotate(60deg);transform-origin:top left;animation-timing-function:ease-in-out;opacity:1}to{transform:translate3d(0,700px,0);opacity:0}}.hinge{animation-name:hinge}@keyframes rollIn{0%{opacity:0;transform:translate3d(-100%,0,0) rotate(-120deg)}to{opacity:1;transform:none}}.rollIn{animation-name:rollIn}@keyframes rollOut{0%{opacity:1}to{opacity:0;transform:translate3d(100%,0,0) rotate(120deg)}}.rollOut{animation-name:rollOut}@keyframes zoomIn{0%{opacity:0;transform:scale3d(.3,.3,.3)}50%{opacity:1}}.zoomIn{animation-name:zoomIn}@keyframes zoomInDown{0%{opacity:0;transform:scale3d(.1,.1,.1) translate3d(0,-1000px,0);animation-timing-function:cubic-bezier(.55,.055,.675,.19)}60%{opacity:1;transform:scale3d(.475,.475,.475) translate3d(0,60px,0);animation-timing-function:cubic-bezier(.175,.885,.32,1)}}.zoomInDown{animation-name:zoomInDown}@keyframes zoomInLeft{0%{opacity:0;transform:scale3d(.1,.1,.1) translate3d(-1000px,0,0);animation-timing-function:cubic-bezier(.55,.055,.675,.19)}60%{opacity:1;transform:scale3d(.475,.475,.475) translate3d(10px,0,0);animation-timing-function:cubic-bezier(.175,.885,.32,1)}}.zoomInLeft{animation-name:zoomInLeft}@keyframes zoomInRight{0%{opacity:0;transform:scale3d(.1,.1,.1) translate3d(1000px,0,0);animation-timing-function:cubic-bezier(.55,.055,.675,.19)}60%{opacity:1;transform:scale3d(.475,.475,.475) translate3d(-10px,0,0);animation-timing-function:cubic-bezier(.175,.885,.32,1)}}.zoomInRight{animation-name:zoomInRight}@keyframes zoomInUp{0%{opacity:0;transform:scale3d(.1,.1,.1) translate3d(0,1000px,0);animation-timing-function:cubic-bezier(.55,.055,.675,.19)}60%{opacity:1;transform:scale3d(.475,.475,.475) translate3d(0,-60px,0);animation-timing-function:cubic-bezier(.175,.885,.32,1)}}.zoomInUp{animation-name:zoomInUp}@keyframes zoomOut{0%{opacity:1}50%{transform:scale3d(.3,.3,.3);opacity:0}to{opacity:0}}.zoomOut{animation-name:zoomOut}@keyframes zoomOutDown{40%{opacity:1;transform:scale3d(.475,.475,.475) translate3d(0,-60px,0);animation-timing-function:cubic-bezier(.55,.055,.675,.19)}to{opacity:0;transform:scale3d(.1,.1,.1) translate3d(0,2000px,0);transform-origin:center bottom;animation-timing-function:cubic-bezier(.175,.885,.32,1)}}.zoomOutDown{animation-name:zoomOutDown}@keyframes zoomOutLeft{40%{opacity:1;transform:scale3d(.475,.475,.475) translate3d(42px,0,0)}to{opacity:0;transform:scale(.1) translate3d(-2000px,0,0);transform-origin:left center}}.zoomOutLeft{animation-name:zoomOutLeft}@keyframes zoomOutRight{40%{opacity:1;transform:scale3d(.475,.475,.475) translate3d(-42px,0,0)}to{opacity:0;transform:scale(.1) translate3d(2000px,0,0);transform-origin:right center}}.zoomOutRight{animation-name:zoomOutRight}@keyframes zoomOutUp{40%{opacity:1;transform:scale3d(.475,.475,.475) translate3d(0,60px,0);animation-timing-function:cubic-bezier(.55,.055,.675,.19)}to{opacity:0;transform:scale3d(.1,.1,.1) translate3d(0,-2000px,0);transform-origin:center bottom;animation-timing-function:cubic-bezier(.175,.885,.32,1)}}.zoomOutUp{animation-name:zoomOutUp}@keyframes slideInDown{0%{transform:translate3d(0,-100%,0);visibility:visible}to{transform:translateZ(0)}}.slideInDown{animation-name:slideInDown}@keyframes slideInLeft{0%{transform:translate3d(-100%,0,0);visibility:visible}to{transform:translateZ(0)}}.slideInLeft{animation-name:slideInLeft}@keyframes slideInRight{0%{transform:translate3d(100%,0,0);visibility:visible}to{transform:translateZ(0)}}.slideInRight{animation-name:slideInRight}@keyframes slideInUp{0%{transform:translate3d(0,100%,0);visibility:visible}to{transform:translateZ(0)}}.slideInUp{animation-name:slideInUp}@keyframes slideOutDown{0%{transform:translateZ(0)}to{visibility:hidden;transform:translate3d(0,100%,0)}}.slideOutDown{animation-name:slideOutDown}@keyframes slideOutLeft{0%{transform:translateZ(0)}to{visibility:hidden;transform:translate3d(-100%,0,0)}}.slideOutLeft{animation-name:slideOutLeft}@keyframes slideOutRight{0%{transform:translateZ(0)}to{visibility:hidden;transform:translate3d(100%,0,0)}}.slideOutRight{animation-name:slideOutRight}@keyframes slideOutUp{0%{transform:translateZ(0)}to{visibility:hidden;transform:translate3d(0,-100%,0)}}.slideOutUp{animation-name:slideOutUp}body{font:18px/1.5 \"Droid Sans\",futura,helvetica,arial,arial,sans-serif;font-weight:100;color:rgba(255,255,255,.95);text-shadow:0 0 2px #000,0 0 40px #000}h1{font-size:50px;font-weight:900;margin:0 auto 10px}h2{font-size:36px;font-weight:300;margin:0 auto 5px}h3,h4,h5{font-size:28px;margin:0 auto;font-weight:200}h4,h5{font-size:22px}h5{font-size:18px}ol,ul{font-size:32px;font-weight:400}ol.noprefix,ul.noprefix{list-style:none}ol.noprefix li,ul.noprefix li{margin-left:0}ol.noprefix li::before,ul.noprefix li::before{content:none}li{margin-bottom:12px;width:100%;margin-left:.5em}ol ol,ol ul,ul ol,ul ul{margin-left:30px}ol ol li,ol ul li,ul ol li,ul ul li{margin-bottom:0;line-height:1.4em}ol ol,ul ol{list-style-type:lower-roman}blockquote,li,pre{text-align:left}td,th{padding:10px;border:1px solid #ccc}th{background-color:#333}td{background-color:#444;text-shadow:none}pre{border-radius:8px;padding:10px}pre .em-blue,pre .em-green,pre .em-red,pre .em-yellow{margin:5px 0}.bespoke-parent,.bespoke-scale-parent{position:absolute;top:0;left:0;right:0;bottom:0}.bespoke-parent{-webkit-text-size-adjust:auto;-ms-text-size-adjust:auto;text-size-adjust:auto;background:#111;overflow:hidden;transition:background 1s ease;background-position:50% 50%}.bespoke-scale-parent{pointer-events:none}.bespoke-scale-parent .bespoke-active{pointer-events:auto}.bespoke-slide{width:100%;height:100%;position:absolute;display:-ms-flexbox;display:flex;-ms-flex-direction:column;flex-direction:column;-ms-flex-pack:center;justify-content:center;-ms-flex-align:center;align-items:center}.bespoke-slide.x-gif-finished .box.wait-for-gif{opacity:1}.bespoke-bullet-inactive,.bespoke-inactive{opacity:0;pointer-events:none}.bespoke-backdrop{position:absolute;top:0;left:0;right:0;bottom:0;z-index:-1;opacity:0}.bespoke-backdrop-active{opacity:1}.bespoke-progress-parent{position:absolute;top:0;left:0;right:0;height:.3vw}.bespoke-progress-bar{position:absolute;height:100%;background:#ccc;transition:width .6s ease}.carbonfiber{background:radial-gradient(#000 15%,transparent 16%) 0 0,radial-gradient(#000 15%,transparent 16%) 8px 8px,radial-gradient(rgba(255,255,255,.1) 15%,transparent 20%) 0 1px,radial-gradient(rgba(255,255,255,.1) 15%,transparent 20%) 8px 9px;background-color:#282828;background-size:16px 16px}.carbon{background:linear-gradient(27deg,#151515 5px,transparent 5px) 0 5px,linear-gradient(207deg,#151515 5px,transparent 5px) 10px 0,linear-gradient(27deg,#222 5px,transparent 5px) 0 10px,linear-gradient(207deg,#222 5px,transparent 5px) 10px 5px,linear-gradient(90deg,#1b1b1b 10px,transparent 10px),linear-gradient(#1d1d1d 25%,#1a1a1a 25%,#1a1a1a 50%,transparent 50%,transparent 75%,#242424 75%,#242424);background-color:#131313;background-size:20px 20px}.seigaiha{background-color:silver;background-image:radial-gradient(circle at 100% 150%,silver 24%,#fff 25%,#fff 28%,silver 29%,silver 36%,#fff 36%,#fff 40%,transparent 40%,transparent),radial-gradient(circle at 0 150%,silver 24%,#fff 25%,#fff 28%,silver 29%,silver 36%,#fff 36%,#fff 40%,transparent 40%,transparent),radial-gradient(circle at 50% 100%,#fff 10%,silver 11%,silver 23%,#fff 24%,#fff 30%,silver 31%,silver 43%,#fff 44%,#fff 50%,silver 51%,silver 63%,#fff 64%,#fff 71%,transparent 71%,transparent),radial-gradient(circle at 100% 50%,#fff 5%,silver 6%,silver 15%,#fff 16%,#fff 20%,silver 21%,silver 30%,#fff 31%,#fff 35%,silver 36%,silver 45%,#fff 46%,#fff 49%,transparent 50%,transparent),radial-gradient(circle at 0 50%,#fff 5%,silver 6%,silver 15%,#fff 16%,#fff 20%,silver 21%,silver 30%,#fff 31%,#fff 35%,silver 36%,silver 45%,#fff 46%,#fff 49%,transparent 50%,transparent);background-size:100px 50px}.cubes{background-color:#556;background-image:linear-gradient(30deg,#445 12%,transparent 12.5%,transparent 87%,#445 87.5%,#445),linear-gradient(150deg,#445 12%,transparent 12.5%,transparent 87%,#445 87.5%,#445),linear-gradient(30deg,#445 12%,transparent 12.5%,transparent 87%,#445 87.5%,#445),linear-gradient(150deg,#445 12%,transparent 12.5%,transparent 87%,#445 87.5%,#445),linear-gradient(60deg,#99a 25%,transparent 25.5%,transparent 75%,#99a 75%,#99a),linear-gradient(60deg,#99a 25%,transparent 25.5%,transparent 75%,#99a 75%,#99a);background-size:80px 140px;background-position:0 0,0 0,40px 70px,40px 70px,0 0,40px 70px}.paper{background-color:#fff;background-image:linear-gradient(90deg,transparent 79px,#abced4 79px,#abced4 81px,transparent 81px),linear-gradient(#eee .1em,transparent .1em);background-size:100% 1.2em}.honeycomb{background:radial-gradient(circle farthest-side at 0% 50%,#fb1 23.5%,rgba(240,166,17,0) 0) 21px 30px,radial-gradient(circle farthest-side at 0% 50%,#b71 24%,rgba(240,166,17,0) 0) 19px 30px,linear-gradient(#fb1 14%,rgba(240,166,17,0) 0,rgba(240,166,17,0) 85%,#fb1 0) 0 0,linear-gradient(150deg,#fb1 24%,#b71 0,#b71 26%,rgba(240,166,17,0) 0,rgba(240,166,17,0) 74%,#b71 0,#b71 76%,#fb1 0) 0 0,linear-gradient(30deg,#fb1 24%,#b71 0,#b71 26%,rgba(240,166,17,0) 0,rgba(240,166,17,0) 74%,#b71 0,#b71 76%,#fb1 0) 0 0,linear-gradient(90deg,#b71 2%,#fb1 0,#fb1 98%,#b71 0%) 0 0 #fb1;background-size:40px 60px}.wave{background:linear-gradient(#fff 50%,rgba(255,255,255,0) 0) 0 0,radial-gradient(circle closest-side,#fff 53%,rgba(255,255,255,0) 0) 0 0,radial-gradient(circle closest-side,#fff 50%,rgba(255,255,255,0) 0) 55px 0 #48b;background-size:110px 200px;background-repeat:repeat-x}.blueprint{background-color:#269;background-image:linear-gradient(#fff 2px,transparent 2px),linear-gradient(90deg,#fff 2px,transparent 2px),linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px);background-size:100px 100px,100px 100px,20px 20px,20px 20px;background-position:-2px -2px,-2px -2px,-1px -1px,-1px -1px}.shippo{background-color:#def;background-image:radial-gradient(closest-side,transparent 98%,rgba(0,0,0,.3) 99%),radial-gradient(closest-side,transparent 98%,rgba(0,0,0,.3) 99%);background-size:80px 80px;background-position:0 0,40px 40px}.blackthread{background-image:url(images/patterns/black-thread-light.png)}.brickwalldark{background-image:url(images/patterns/brick-wall-dark.png)}.brickwall{background-image:url(images/patterns/brick-wall.png)}.diagmonds{background-image:url(images/patterns/diagmonds-light.png)}.diamondupholstery{background-image:url(images/patterns/diamond-upholstery.png)}.gplay{background-image:url(images/patterns/gplay.png)}.gravel{background-image:url(images/patterns/gravel.png)}.oldmath{background-image:url(images/patterns/old-mathematics.png)}.purtywood{background-image:url(images/patterns/purty-wood.png)}.bullseyes{background-image:url(images/patterns/strange-bullseyes.png)}.escheresque{background-image:url(images/patterns/escheresque.png)}.straws{background-image:url(images/patterns/straws.png)}.littleboxes{background-image:url(images/patterns/littleboxes.png)}.woodtilecolor{background-image:url(images/patterns/tileable-wood-colored.png)}.woodtile{background-image:url(images/patterns/tileable-wood.png)}.treebark{background-image:url(images/patterns/tree-bark.png)}.washi{background-image:url(images/patterns/washi.png)}.wood-pattern{background-image:url(images/patterns/wood-pattern.png)}.xv{background-image:url(images/patterns/xv.png)}section>img{position:absolute;margin:auto;display:-ms-flexbox;display:flex}.fullscreen{position:absolute;top:0;left:0}.fill,.fullscreen{width:100%;height:100%}.fillh{height:100%;left:-50%;right:-50%;position:absolute;margin:auto}.fillw,.fillwb{width:100%;height:auto}.fillwb{bottom:0}section x-gif{position:absolute;top:0;left:0}.box{position:relative;text-align:center;margin:auto;max-width:100%;border-radius:10px;padding:25px;background-color:rgba(0,0,0,.6)}.box ol,.box ul{margin:12px 20px;padding:0}.box li::before{left:.5em}.box.wait-for-gif{opacity:0}.box.bottom{bottom:5%;margin-bottom:0}.box.top{top:5%;margin-top:0}.box.left{left:5%;margin-left:0}.box.right{right:5%;margin-right:0}.box.transparent pre,span.animate{display:inline-block}.credit{position:absolute;bottom:10px;right:10px}a{color:#9cf;text-decoration:none}a.back:after,a.back:before,a:after{content:'  ➭';font-size:24px;line-height:24px;vertical-align:middle}a.back:after,a.back:before{content:'⬅  '}a.back:after{content:''}.me,.person{height:72px;width:72px;background-repeat:no-repeat;background-size:72px;background-position:50% 50%;border-radius:50%;box-shadow:0 0 0 2px #000,0 0 0 4px #9cf;margin:0 16px}.me.center,.person.center{margin:15px auto}.me{background-image:url(images/me.jpg)}.em{font-weight:300}.em,.em-blue,.em-bold,.em-green,.em-orange,.em-red,.em-yellow{padding:5px 10px;margin:5px 2px;border:1px solid transparent;border-radius:4px;text-shadow:none;display:inline-block;line-height:1.2em;font-family:monospace;font-style:normal}.em-blue,.em-green,.em-orange,.em-red,.em-yellow{font-weight:300}.em-bold{font-weight:700}.em-green{color:#468847;background-color:#dff0d8;border-color:#d6e9c6}.em-yellow{color:#8a6d3b;background-color:#fcf8e3;border-color:#faebcc}.em-blue{color:#3a87ad;background-color:#d9edf7;border-color:#bce8f1}.em-orange{color:#f85;background-color:#fcf8e3;border-color:#fbeed5}.em-red{color:#b94a48;background-color:#f2dede;border-color:#eed3d7}.mid{font-size:28px;font-style:italic;display:-ms-flexbox;display:flex;width:100%;margin:10px auto;-ms-flex-align:center;align-items:center}.mid::after,.mid::before{content:'';-ms-flex-positive:1;flex-grow:1;display:block;border-top:dotted 1px rgba(255,255,255,.3)}.mid::before{margin-right:16px}.mid::after{margin-left:16px}.mid.big{font-size:74px}.hide{display:none}.blur1{filter:blur(1px)}.blur2{filter:blur(2px)}.blur3,.blur4{filter:blur(3px)}.opac20{opacity:.2}.opac50{opacity:.5}.opac80{opacity:.8}.transparent{background-color:rgba(0,0,0,0)}.white{background-color:#fff}.white.box{color:#333;text-shadow:none}.red{background-color:#b94a48}.black{background-color:#000}.grey{background-color:#cfcfcf}.grey.box{color:#333}.blue{background-color:#004e8a}.midnight{background-color:#001f3f}.jellybean{background-color:#288895}.cocoa{background-color:#472f00}.nope{text-decoration:line-through;opacity:.7}p.code{margin:0;font-family:prestige elite std,consolas,courier new,monospace}strike code[class*=language-]{text-shadow:0 1px #00f}.rotate,.spin{display:inline-block;transform:none}.rotate.on,.spin.on{transition-delay:.5s;transition-duration:1s;transform:rotate(15deg)}.spin.on{transition-delay:1.5s;transform:rotate(360deg)}.animate.delay1{animation-delay:1s}.animate.delay2{animation-delay:2s}.animate.delay3{animation-delay:3s}.animate.delay4{animation-delay:4s}.animate.delay5{animation-delay:5s}.animate.delay6{animation-delay:6s}.animate.delay7{animation-delay:7s}.animate.delay8{animation-delay:8s}.cursor:after{content:\"_\";opacity:0;animation:cursor 1s infinite}@keyframes cursor{0%,40%,to{opacity:0}50%,90%{opacity:1}}";return o(t,{prepend:!0}),function(t){n()(t),s(t),r(t)}},window.addEventListener("resize",function(){[].forEach.call(document.querySelectorAll("x-gif"),function(t){t.relayout()})}),"registerElement"in document&&"createShadowRoot"in HTMLElement.prototype&&"import"in document.createElement("link")&&"content"in document.createElement("template"));else{var m=document.createElement("script");m.src="https://cdnjs.cloudflare.com/ajax/libs/webcomponentsjs/0.7.22/webcomponents.min.js",document.head.appendChild(m);var f=document.getElementById("browsersupport");f&&(f.className=f.className.replace("hide",""))}var p=0;document.addEventListener("keyup",function(t){
var e=function(){document.querySelector("article").style.webkitFilter="brightness("+(1+p)+") contrast("+(1+.25*p)+")"};if(t.shiftKey&&(38==t.keyCode?(p+=.1,e(p)):40==t.keyCode?(p-=.1,e(p)):48==t.keyCode&&(p=0,e(p))),console.log(t.keyCode),82==t.keyCode){var a=document.querySelectorAll(".rotate, .spin");for(i=0;i<a.length;i++)a[i].classList.toggle("on")}});var l=document.querySelectorAll(".animate"),d=function(t){t.target.classList.remove("animated")};Array.prototype.forEach.call(l,function(t,e){t.addEventListener("webkitAnimationEnd",d),t.addEventListener("mozAnimationEnd",d),t.addEventListener("MSAnimationEnd",d),t.addEventListener("oanimationend",d),t.addEventListener("animationend",d)});var c=document.createElement("link");c.rel="import",c.href="x-gif/x-gif.html",document.body.appendChild(c);var g=document.createElement("link");g.rel="stylesheet",g.type="text/css",g.href="http://fonts.googleapis.com/css?family=Courgette|Droid+Sans",document.head.appendChild(g)},{"bespoke-classes":2,"insert-css":3}],2:[function(t,e,a){e.exports=function(){return function(t){var e=function(t,e){t.classList.add("bespoke-"+e)},a=function(t,e){t.className=t.className.replace(new RegExp("bespoke-"+e+"(\\s|$)","g")," ").trim()},n=function(n,o){var r=t.slides[t.slide()],i=o-t.slide(),s=i>0?"after":"before";["before(-\\d+)?","after(-\\d+)?","active","inactive"].map(a.bind(null,n)),n!==r&&["inactive",s,s+"-"+Math.abs(i)].map(e.bind(null,n))};e(t.parent,"parent"),t.slides.map(function(t){e(t,"slide")}),t.on("activate",function(o){t.slides.map(n),e(o.slide,"active"),a(o.slide,"inactive")})}}},{}],3:[function(t,e,a){function n(){var t=document.createElement("style");return t.setAttribute("type","text/css"),t}var o=[],r=[];e.exports=function(t,e){e=e||{};var a=e.prepend===!0?"prepend":"append",i=void 0!==e.container?e.container:document.querySelector("head"),s=o.indexOf(i);s===-1&&(s=o.push(i)-1,r[s]={});var m;return void 0!==r[s]&&void 0!==r[s][a]?m=r[s][a]:(m=r[s][a]=n(),"prepend"===a?i.insertBefore(m,i.childNodes[0]):i.appendChild(m)),m.styleSheet?m.styleSheet.cssText+=t:m.textContent+=t,m}},{}]},{},[1])(1)});
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],10:[function(require,module,exports){
module.exports = function(options) {
  return function(deck) {
    var axis = options == 'vertical' ? 'Y' : 'X',
      startPosition,
      delta;

    deck.parent.addEventListener('touchstart', function(e) {
      if (e.touches.length == 1) {
        startPosition = e.touches[0]['page' + axis];
        delta = 0;
      }
    });

    deck.parent.addEventListener('touchmove', function(e) {
      if (e.touches.length == 1) {
        e.preventDefault();
        delta = e.touches[0]['page' + axis] - startPosition;
      }
    });

    deck.parent.addEventListener('touchend', function() {
      if (Math.abs(delta) > 50) {
        deck[delta > 0 ? 'prev' : 'next']();
      }
    });
  };
};

},{}],11:[function(require,module,exports){
var from = function(opts, plugins) {
  var parent = (opts.parent || opts).nodeType === 1 ? (opts.parent || opts) : document.querySelector(opts.parent || opts),
    slides = [].filter.call(typeof opts.slides === 'string' ? parent.querySelectorAll(opts.slides) : (opts.slides || parent.children), function(el) { return el.nodeName !== 'SCRIPT'; }),
    activeSlide = slides[0],
    listeners = {},

    activate = function(index, customData) {
      if (!slides[index]) {
        return;
      }

      fire('deactivate', createEventData(activeSlide, customData));
      activeSlide = slides[index];
      fire('activate', createEventData(activeSlide, customData));
    },

    slide = function(index, customData) {
      if (arguments.length) {
        fire('slide', createEventData(slides[index], customData)) && activate(index, customData);
      } else {
        return slides.indexOf(activeSlide);
      }
    },

    step = function(offset, customData) {
      var slideIndex = slides.indexOf(activeSlide) + offset;

      fire(offset > 0 ? 'next' : 'prev', createEventData(activeSlide, customData)) && activate(slideIndex, customData);
    },

    on = function(eventName, callback) {
      (listeners[eventName] || (listeners[eventName] = [])).push(callback);
      return off.bind(null, eventName, callback);
    },

    off = function(eventName, callback) {
      listeners[eventName] = (listeners[eventName] || []).filter(function(listener) { return listener !== callback; });
    },

    fire = function(eventName, eventData) {
      return (listeners[eventName] || [])
        .reduce(function(notCancelled, callback) {
          return notCancelled && callback(eventData) !== false;
        }, true);
    },

    createEventData = function(el, eventData) {
      eventData = eventData || {};
      eventData.index = slides.indexOf(el);
      eventData.slide = el;
      return eventData;
    },

    deck = {
      on: on,
      off: off,
      fire: fire,
      slide: slide,
      next: step.bind(null, 1),
      prev: step.bind(null, -1),
      parent: parent,
      slides: slides
    };

  (plugins || []).forEach(function(plugin) {
    plugin(deck);
  });

  activate(0);

  return deck;
};

module.exports = {
  from: from
};

},{}],12:[function(require,module,exports){
// Require Node modules in the browser thanks to Browserify: http://browserify.org
var bespoke = require('bespoke'),
  
  cube = require('bespoke-theme-cube'),
  keys = require('bespoke-keys'),
  touch = require('bespoke-touch'),
  bullets = require('bespoke-bullets'),
  backdrop = require('bespoke-backdrop'),
  scale = require('bespoke-scale'),
  hash = require('bespoke-hash'),
  progress = require('bespoke-progress'),
  forms = require('bespoke-forms');

// Bespoke.js
bespoke.from('article', [
  cube(),
  keys(),
  touch(),
  bullets('li, .bullet'),
  backdrop(),
  scale(),
  hash(),
  progress(),
  forms()
]);

// Prism syntax highlighting
// This is actually loaded from "bower_components" thanks to
// debowerify: https://github.com/eugeneware/debowerify
require("./..\\..\\bower_components\\prism\\prism.js");


},{"./..\\..\\bower_components\\prism\\prism.js":1,"bespoke":11,"bespoke-backdrop":2,"bespoke-bullets":3,"bespoke-forms":4,"bespoke-hash":5,"bespoke-keys":6,"bespoke-progress":7,"bespoke-scale":8,"bespoke-theme-cube":9,"bespoke-touch":10}]},{},[12])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIlg6XFxWaXJ0dWFsLVJlYWxpdHktMjAxN1xcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiWDovVmlydHVhbC1SZWFsaXR5LTIwMTcvYm93ZXJfY29tcG9uZW50cy9wcmlzbS9wcmlzbS5qcyIsIlg6L1ZpcnR1YWwtUmVhbGl0eS0yMDE3L25vZGVfbW9kdWxlcy9iZXNwb2tlLWJhY2tkcm9wL2xpYi9iZXNwb2tlLWJhY2tkcm9wLmpzIiwiWDovVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtYnVsbGV0cy9saWIvYmVzcG9rZS1idWxsZXRzLmpzIiwiWDovVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtZm9ybXMvbGliL2Jlc3Bva2UtZm9ybXMuanMiLCJYOi9WaXJ0dWFsLVJlYWxpdHktMjAxNy9ub2RlX21vZHVsZXMvYmVzcG9rZS1oYXNoL2xpYi9iZXNwb2tlLWhhc2guanMiLCJYOi9WaXJ0dWFsLVJlYWxpdHktMjAxNy9ub2RlX21vZHVsZXMvYmVzcG9rZS1rZXlzL2xpYi9iZXNwb2tlLWtleXMuanMiLCJYOi9WaXJ0dWFsLVJlYWxpdHktMjAxNy9ub2RlX21vZHVsZXMvYmVzcG9rZS1wcm9ncmVzcy9saWIvYmVzcG9rZS1wcm9ncmVzcy5qcyIsIlg6L1ZpcnR1YWwtUmVhbGl0eS0yMDE3L25vZGVfbW9kdWxlcy9iZXNwb2tlLXNjYWxlL2xpYi9iZXNwb2tlLXNjYWxlLmpzIiwiWDovVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtdGhlbWUtY3ViZS9kaXN0L2Jlc3Bva2UtdGhlbWUtYXRvbWFudGljLm1pbi5qcyIsIlg6L1ZpcnR1YWwtUmVhbGl0eS0yMDE3L25vZGVfbW9kdWxlcy9iZXNwb2tlLXRvdWNoL2xpYi9iZXNwb2tlLXRvdWNoLmpzIiwiWDovVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2UvbGliL2Jlc3Bva2UuanMiLCJYOi9WaXJ0dWFsLVJlYWxpdHktMjAxNy9zcmMvc2NyaXB0cy9mYWtlXzZiNThhZmY2LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5cclxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgIEJlZ2luIHByaXNtLWNvcmUuanNcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG5cclxudmFyIF9zZWxmID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKVxyXG5cdD8gd2luZG93ICAgLy8gaWYgaW4gYnJvd3NlclxyXG5cdDogKFxyXG5cdFx0KHR5cGVvZiBXb3JrZXJHbG9iYWxTY29wZSAhPT0gJ3VuZGVmaW5lZCcgJiYgc2VsZiBpbnN0YW5jZW9mIFdvcmtlckdsb2JhbFNjb3BlKVxyXG5cdFx0PyBzZWxmIC8vIGlmIGluIHdvcmtlclxyXG5cdFx0OiB7fSAgIC8vIGlmIGluIG5vZGUganNcclxuXHQpO1xyXG5cclxuLyoqXHJcbiAqIFByaXNtOiBMaWdodHdlaWdodCwgcm9idXN0LCBlbGVnYW50IHN5bnRheCBoaWdobGlnaHRpbmdcclxuICogTUlUIGxpY2Vuc2UgaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHAvXHJcbiAqIEBhdXRob3IgTGVhIFZlcm91IGh0dHA6Ly9sZWEudmVyb3UubWVcclxuICovXHJcblxyXG52YXIgUHJpc20gPSAoZnVuY3Rpb24oKXtcclxuXHJcbi8vIFByaXZhdGUgaGVscGVyIHZhcnNcclxudmFyIGxhbmcgPSAvXFxibGFuZyg/OnVhZ2UpPy0oXFx3KylcXGIvaTtcclxudmFyIHVuaXF1ZUlkID0gMDtcclxuXHJcbnZhciBfID0gX3NlbGYuUHJpc20gPSB7XHJcblx0bWFudWFsOiBfc2VsZi5QcmlzbSAmJiBfc2VsZi5QcmlzbS5tYW51YWwsXHJcblx0dXRpbDoge1xyXG5cdFx0ZW5jb2RlOiBmdW5jdGlvbiAodG9rZW5zKSB7XHJcblx0XHRcdGlmICh0b2tlbnMgaW5zdGFuY2VvZiBUb2tlbikge1xyXG5cdFx0XHRcdHJldHVybiBuZXcgVG9rZW4odG9rZW5zLnR5cGUsIF8udXRpbC5lbmNvZGUodG9rZW5zLmNvbnRlbnQpLCB0b2tlbnMuYWxpYXMpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKF8udXRpbC50eXBlKHRva2VucykgPT09ICdBcnJheScpIHtcclxuXHRcdFx0XHRyZXR1cm4gdG9rZW5zLm1hcChfLnV0aWwuZW5jb2RlKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRyZXR1cm4gdG9rZW5zLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpLnJlcGxhY2UoL1xcdTAwYTAvZywgJyAnKTtcclxuXHRcdFx0fVxyXG5cdFx0fSxcclxuXHJcblx0XHR0eXBlOiBmdW5jdGlvbiAobykge1xyXG5cdFx0XHRyZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pLm1hdGNoKC9cXFtvYmplY3QgKFxcdyspXFxdLylbMV07XHJcblx0XHR9LFxyXG5cclxuXHRcdG9iaklkOiBmdW5jdGlvbiAob2JqKSB7XHJcblx0XHRcdGlmICghb2JqWydfX2lkJ10pIHtcclxuXHRcdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCAnX19pZCcsIHsgdmFsdWU6ICsrdW5pcXVlSWQgfSk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIG9ialsnX19pZCddO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvLyBEZWVwIGNsb25lIGEgbGFuZ3VhZ2UgZGVmaW5pdGlvbiAoZS5nLiB0byBleHRlbmQgaXQpXHJcblx0XHRjbG9uZTogZnVuY3Rpb24gKG8pIHtcclxuXHRcdFx0dmFyIHR5cGUgPSBfLnV0aWwudHlwZShvKTtcclxuXHJcblx0XHRcdHN3aXRjaCAodHlwZSkge1xyXG5cdFx0XHRcdGNhc2UgJ09iamVjdCc6XHJcblx0XHRcdFx0XHR2YXIgY2xvbmUgPSB7fTtcclxuXHJcblx0XHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gbykge1xyXG5cdFx0XHRcdFx0XHRpZiAoby5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcblx0XHRcdFx0XHRcdFx0Y2xvbmVba2V5XSA9IF8udXRpbC5jbG9uZShvW2tleV0pO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cmV0dXJuIGNsb25lO1xyXG5cclxuXHRcdFx0XHRjYXNlICdBcnJheSc6XHJcblx0XHRcdFx0XHQvLyBDaGVjayBmb3IgZXhpc3RlbmNlIGZvciBJRThcclxuXHRcdFx0XHRcdHJldHVybiBvLm1hcCAmJiBvLm1hcChmdW5jdGlvbih2KSB7IHJldHVybiBfLnV0aWwuY2xvbmUodik7IH0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gbztcclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHRsYW5ndWFnZXM6IHtcclxuXHRcdGV4dGVuZDogZnVuY3Rpb24gKGlkLCByZWRlZikge1xyXG5cdFx0XHR2YXIgbGFuZyA9IF8udXRpbC5jbG9uZShfLmxhbmd1YWdlc1tpZF0pO1xyXG5cclxuXHRcdFx0Zm9yICh2YXIga2V5IGluIHJlZGVmKSB7XHJcblx0XHRcdFx0bGFuZ1trZXldID0gcmVkZWZba2V5XTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGxhbmc7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSW5zZXJ0IGEgdG9rZW4gYmVmb3JlIGFub3RoZXIgdG9rZW4gaW4gYSBsYW5ndWFnZSBsaXRlcmFsXHJcblx0XHQgKiBBcyB0aGlzIG5lZWRzIHRvIHJlY3JlYXRlIHRoZSBvYmplY3QgKHdlIGNhbm5vdCBhY3R1YWxseSBpbnNlcnQgYmVmb3JlIGtleXMgaW4gb2JqZWN0IGxpdGVyYWxzKSxcclxuXHRcdCAqIHdlIGNhbm5vdCBqdXN0IHByb3ZpZGUgYW4gb2JqZWN0LCB3ZSBuZWVkIGFub2JqZWN0IGFuZCBhIGtleS5cclxuXHRcdCAqIEBwYXJhbSBpbnNpZGUgVGhlIGtleSAob3IgbGFuZ3VhZ2UgaWQpIG9mIHRoZSBwYXJlbnRcclxuXHRcdCAqIEBwYXJhbSBiZWZvcmUgVGhlIGtleSB0byBpbnNlcnQgYmVmb3JlLiBJZiBub3QgcHJvdmlkZWQsIHRoZSBmdW5jdGlvbiBhcHBlbmRzIGluc3RlYWQuXHJcblx0XHQgKiBAcGFyYW0gaW5zZXJ0IE9iamVjdCB3aXRoIHRoZSBrZXkvdmFsdWUgcGFpcnMgdG8gaW5zZXJ0XHJcblx0XHQgKiBAcGFyYW0gcm9vdCBUaGUgb2JqZWN0IHRoYXQgY29udGFpbnMgYGluc2lkZWAuIElmIGVxdWFsIHRvIFByaXNtLmxhbmd1YWdlcywgaXQgY2FuIGJlIG9taXR0ZWQuXHJcblx0XHQgKi9cclxuXHRcdGluc2VydEJlZm9yZTogZnVuY3Rpb24gKGluc2lkZSwgYmVmb3JlLCBpbnNlcnQsIHJvb3QpIHtcclxuXHRcdFx0cm9vdCA9IHJvb3QgfHwgXy5sYW5ndWFnZXM7XHJcblx0XHRcdHZhciBncmFtbWFyID0gcm9vdFtpbnNpZGVdO1xyXG5cclxuXHRcdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gMikge1xyXG5cdFx0XHRcdGluc2VydCA9IGFyZ3VtZW50c1sxXTtcclxuXHJcblx0XHRcdFx0Zm9yICh2YXIgbmV3VG9rZW4gaW4gaW5zZXJ0KSB7XHJcblx0XHRcdFx0XHRpZiAoaW5zZXJ0Lmhhc093blByb3BlcnR5KG5ld1Rva2VuKSkge1xyXG5cdFx0XHRcdFx0XHRncmFtbWFyW25ld1Rva2VuXSA9IGluc2VydFtuZXdUb2tlbl07XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gZ3JhbW1hcjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIHJldCA9IHt9O1xyXG5cclxuXHRcdFx0Zm9yICh2YXIgdG9rZW4gaW4gZ3JhbW1hcikge1xyXG5cclxuXHRcdFx0XHRpZiAoZ3JhbW1hci5oYXNPd25Qcm9wZXJ0eSh0b2tlbikpIHtcclxuXHJcblx0XHRcdFx0XHRpZiAodG9rZW4gPT0gYmVmb3JlKSB7XHJcblxyXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBuZXdUb2tlbiBpbiBpbnNlcnQpIHtcclxuXHJcblx0XHRcdFx0XHRcdFx0aWYgKGluc2VydC5oYXNPd25Qcm9wZXJ0eShuZXdUb2tlbikpIHtcclxuXHRcdFx0XHRcdFx0XHRcdHJldFtuZXdUb2tlbl0gPSBpbnNlcnRbbmV3VG9rZW5dO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHJldFt0b2tlbl0gPSBncmFtbWFyW3Rva2VuXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFVwZGF0ZSByZWZlcmVuY2VzIGluIG90aGVyIGxhbmd1YWdlIGRlZmluaXRpb25zXHJcblx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhfLmxhbmd1YWdlcywgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xyXG5cdFx0XHRcdGlmICh2YWx1ZSA9PT0gcm9vdFtpbnNpZGVdICYmIGtleSAhPSBpbnNpZGUpIHtcclxuXHRcdFx0XHRcdHRoaXNba2V5XSA9IHJldDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0cmV0dXJuIHJvb3RbaW5zaWRlXSA9IHJldDtcclxuXHRcdH0sXHJcblxyXG5cdFx0Ly8gVHJhdmVyc2UgYSBsYW5ndWFnZSBkZWZpbml0aW9uIHdpdGggRGVwdGggRmlyc3QgU2VhcmNoXHJcblx0XHRERlM6IGZ1bmN0aW9uKG8sIGNhbGxiYWNrLCB0eXBlLCB2aXNpdGVkKSB7XHJcblx0XHRcdHZpc2l0ZWQgPSB2aXNpdGVkIHx8IHt9O1xyXG5cdFx0XHRmb3IgKHZhciBpIGluIG8pIHtcclxuXHRcdFx0XHRpZiAoby5oYXNPd25Qcm9wZXJ0eShpKSkge1xyXG5cdFx0XHRcdFx0Y2FsbGJhY2suY2FsbChvLCBpLCBvW2ldLCB0eXBlIHx8IGkpO1xyXG5cclxuXHRcdFx0XHRcdGlmIChfLnV0aWwudHlwZShvW2ldKSA9PT0gJ09iamVjdCcgJiYgIXZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSkge1xyXG5cdFx0XHRcdFx0XHR2aXNpdGVkW18udXRpbC5vYmpJZChvW2ldKV0gPSB0cnVlO1xyXG5cdFx0XHRcdFx0XHRfLmxhbmd1YWdlcy5ERlMob1tpXSwgY2FsbGJhY2ssIG51bGwsIHZpc2l0ZWQpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ZWxzZSBpZiAoXy51dGlsLnR5cGUob1tpXSkgPT09ICdBcnJheScgJiYgIXZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSkge1xyXG5cdFx0XHRcdFx0XHR2aXNpdGVkW18udXRpbC5vYmpJZChvW2ldKV0gPSB0cnVlO1xyXG5cdFx0XHRcdFx0XHRfLmxhbmd1YWdlcy5ERlMob1tpXSwgY2FsbGJhY2ssIGksIHZpc2l0ZWQpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcblx0cGx1Z2luczoge30sXHJcblxyXG5cdGhpZ2hsaWdodEFsbDogZnVuY3Rpb24oYXN5bmMsIGNhbGxiYWNrKSB7XHJcblx0XHR2YXIgZW52ID0ge1xyXG5cdFx0XHRjYWxsYmFjazogY2FsbGJhY2ssXHJcblx0XHRcdHNlbGVjdG9yOiAnY29kZVtjbGFzcyo9XCJsYW5ndWFnZS1cIl0sIFtjbGFzcyo9XCJsYW5ndWFnZS1cIl0gY29kZSwgY29kZVtjbGFzcyo9XCJsYW5nLVwiXSwgW2NsYXNzKj1cImxhbmctXCJdIGNvZGUnXHJcblx0XHR9O1xyXG5cclxuXHRcdF8uaG9va3MucnVuKFwiYmVmb3JlLWhpZ2hsaWdodGFsbFwiLCBlbnYpO1xyXG5cclxuXHRcdHZhciBlbGVtZW50cyA9IGVudi5lbGVtZW50cyB8fCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGVudi5zZWxlY3Rvcik7XHJcblxyXG5cdFx0Zm9yICh2YXIgaT0wLCBlbGVtZW50OyBlbGVtZW50ID0gZWxlbWVudHNbaSsrXTspIHtcclxuXHRcdFx0Xy5oaWdobGlnaHRFbGVtZW50KGVsZW1lbnQsIGFzeW5jID09PSB0cnVlLCBlbnYuY2FsbGJhY2spO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdGhpZ2hsaWdodEVsZW1lbnQ6IGZ1bmN0aW9uKGVsZW1lbnQsIGFzeW5jLCBjYWxsYmFjaykge1xyXG5cdFx0Ly8gRmluZCBsYW5ndWFnZVxyXG5cdFx0dmFyIGxhbmd1YWdlLCBncmFtbWFyLCBwYXJlbnQgPSBlbGVtZW50O1xyXG5cclxuXHRcdHdoaWxlIChwYXJlbnQgJiYgIWxhbmcudGVzdChwYXJlbnQuY2xhc3NOYW1lKSkge1xyXG5cdFx0XHRwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAocGFyZW50KSB7XHJcblx0XHRcdGxhbmd1YWdlID0gKHBhcmVudC5jbGFzc05hbWUubWF0Y2gobGFuZykgfHwgWywnJ10pWzFdLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdGdyYW1tYXIgPSBfLmxhbmd1YWdlc1tsYW5ndWFnZV07XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gU2V0IGxhbmd1YWdlIG9uIHRoZSBlbGVtZW50LCBpZiBub3QgcHJlc2VudFxyXG5cdFx0ZWxlbWVudC5jbGFzc05hbWUgPSBlbGVtZW50LmNsYXNzTmFtZS5yZXBsYWNlKGxhbmcsICcnKS5yZXBsYWNlKC9cXHMrL2csICcgJykgKyAnIGxhbmd1YWdlLScgKyBsYW5ndWFnZTtcclxuXHJcblx0XHQvLyBTZXQgbGFuZ3VhZ2Ugb24gdGhlIHBhcmVudCwgZm9yIHN0eWxpbmdcclxuXHRcdHBhcmVudCA9IGVsZW1lbnQucGFyZW50Tm9kZTtcclxuXHJcblx0XHRpZiAoL3ByZS9pLnRlc3QocGFyZW50Lm5vZGVOYW1lKSkge1xyXG5cdFx0XHRwYXJlbnQuY2xhc3NOYW1lID0gcGFyZW50LmNsYXNzTmFtZS5yZXBsYWNlKGxhbmcsICcnKS5yZXBsYWNlKC9cXHMrL2csICcgJykgKyAnIGxhbmd1YWdlLScgKyBsYW5ndWFnZTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgY29kZSA9IGVsZW1lbnQudGV4dENvbnRlbnQ7XHJcblxyXG5cdFx0dmFyIGVudiA9IHtcclxuXHRcdFx0ZWxlbWVudDogZWxlbWVudCxcclxuXHRcdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlLFxyXG5cdFx0XHRncmFtbWFyOiBncmFtbWFyLFxyXG5cdFx0XHRjb2RlOiBjb2RlXHJcblx0XHR9O1xyXG5cclxuXHRcdF8uaG9va3MucnVuKCdiZWZvcmUtc2FuaXR5LWNoZWNrJywgZW52KTtcclxuXHJcblx0XHRpZiAoIWVudi5jb2RlIHx8ICFlbnYuZ3JhbW1hcikge1xyXG5cdFx0XHRpZiAoZW52LmNvZGUpIHtcclxuXHRcdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWhpZ2hsaWdodCcsIGVudik7XHJcblx0XHRcdFx0ZW52LmVsZW1lbnQudGV4dENvbnRlbnQgPSBlbnYuY29kZTtcclxuXHRcdFx0XHRfLmhvb2tzLnJ1bignYWZ0ZXItaGlnaGxpZ2h0JywgZW52KTtcclxuXHRcdFx0fVxyXG5cdFx0XHRfLmhvb2tzLnJ1bignY29tcGxldGUnLCBlbnYpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1oaWdobGlnaHQnLCBlbnYpO1xyXG5cclxuXHRcdGlmIChhc3luYyAmJiBfc2VsZi5Xb3JrZXIpIHtcclxuXHRcdFx0dmFyIHdvcmtlciA9IG5ldyBXb3JrZXIoXy5maWxlbmFtZSk7XHJcblxyXG5cdFx0XHR3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0ZW52LmhpZ2hsaWdodGVkQ29kZSA9IGV2dC5kYXRhO1xyXG5cclxuXHRcdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWluc2VydCcsIGVudik7XHJcblxyXG5cdFx0XHRcdGVudi5lbGVtZW50LmlubmVySFRNTCA9IGVudi5oaWdobGlnaHRlZENvZGU7XHJcblxyXG5cdFx0XHRcdGNhbGxiYWNrICYmIGNhbGxiYWNrLmNhbGwoZW52LmVsZW1lbnQpO1xyXG5cdFx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xyXG5cdFx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHR3b3JrZXIucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoe1xyXG5cdFx0XHRcdGxhbmd1YWdlOiBlbnYubGFuZ3VhZ2UsXHJcblx0XHRcdFx0Y29kZTogZW52LmNvZGUsXHJcblx0XHRcdFx0aW1tZWRpYXRlQ2xvc2U6IHRydWVcclxuXHRcdFx0fSkpO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdGVudi5oaWdobGlnaHRlZENvZGUgPSBfLmhpZ2hsaWdodChlbnYuY29kZSwgZW52LmdyYW1tYXIsIGVudi5sYW5ndWFnZSk7XHJcblxyXG5cdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWluc2VydCcsIGVudik7XHJcblxyXG5cdFx0XHRlbnYuZWxlbWVudC5pbm5lckhUTUwgPSBlbnYuaGlnaGxpZ2h0ZWRDb2RlO1xyXG5cclxuXHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbChlbGVtZW50KTtcclxuXHJcblx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xyXG5cdFx0XHRfLmhvb2tzLnJ1bignY29tcGxldGUnLCBlbnYpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdGhpZ2hsaWdodDogZnVuY3Rpb24gKHRleHQsIGdyYW1tYXIsIGxhbmd1YWdlKSB7XHJcblx0XHR2YXIgdG9rZW5zID0gXy50b2tlbml6ZSh0ZXh0LCBncmFtbWFyKTtcclxuXHRcdHJldHVybiBUb2tlbi5zdHJpbmdpZnkoXy51dGlsLmVuY29kZSh0b2tlbnMpLCBsYW5ndWFnZSk7XHJcblx0fSxcclxuXHJcblx0bWF0Y2hHcmFtbWFyOiBmdW5jdGlvbiAodGV4dCwgc3RyYXJyLCBncmFtbWFyLCBpbmRleCwgc3RhcnRQb3MsIG9uZXNob3QsIHRhcmdldCkge1xyXG5cdFx0dmFyIFRva2VuID0gXy5Ub2tlbjtcclxuXHJcblx0XHRmb3IgKHZhciB0b2tlbiBpbiBncmFtbWFyKSB7XHJcblx0XHRcdGlmKCFncmFtbWFyLmhhc093blByb3BlcnR5KHRva2VuKSB8fCAhZ3JhbW1hclt0b2tlbl0pIHtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHRva2VuID09IHRhcmdldCkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIHBhdHRlcm5zID0gZ3JhbW1hclt0b2tlbl07XHJcblx0XHRcdHBhdHRlcm5zID0gKF8udXRpbC50eXBlKHBhdHRlcm5zKSA9PT0gXCJBcnJheVwiKSA/IHBhdHRlcm5zIDogW3BhdHRlcm5zXTtcclxuXHJcblx0XHRcdGZvciAodmFyIGogPSAwOyBqIDwgcGF0dGVybnMubGVuZ3RoOyArK2opIHtcclxuXHRcdFx0XHR2YXIgcGF0dGVybiA9IHBhdHRlcm5zW2pdLFxyXG5cdFx0XHRcdFx0aW5zaWRlID0gcGF0dGVybi5pbnNpZGUsXHJcblx0XHRcdFx0XHRsb29rYmVoaW5kID0gISFwYXR0ZXJuLmxvb2tiZWhpbmQsXHJcblx0XHRcdFx0XHRncmVlZHkgPSAhIXBhdHRlcm4uZ3JlZWR5LFxyXG5cdFx0XHRcdFx0bG9va2JlaGluZExlbmd0aCA9IDAsXHJcblx0XHRcdFx0XHRhbGlhcyA9IHBhdHRlcm4uYWxpYXM7XHJcblxyXG5cdFx0XHRcdGlmIChncmVlZHkgJiYgIXBhdHRlcm4ucGF0dGVybi5nbG9iYWwpIHtcclxuXHRcdFx0XHRcdC8vIFdpdGhvdXQgdGhlIGdsb2JhbCBmbGFnLCBsYXN0SW5kZXggd29uJ3Qgd29ya1xyXG5cdFx0XHRcdFx0dmFyIGZsYWdzID0gcGF0dGVybi5wYXR0ZXJuLnRvU3RyaW5nKCkubWF0Y2goL1tpbXV5XSokLylbMF07XHJcblx0XHRcdFx0XHRwYXR0ZXJuLnBhdHRlcm4gPSBSZWdFeHAocGF0dGVybi5wYXR0ZXJuLnNvdXJjZSwgZmxhZ3MgKyBcImdcIik7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRwYXR0ZXJuID0gcGF0dGVybi5wYXR0ZXJuIHx8IHBhdHRlcm47XHJcblxyXG5cdFx0XHRcdC8vIERvbuKAmXQgY2FjaGUgbGVuZ3RoIGFzIGl0IGNoYW5nZXMgZHVyaW5nIHRoZSBsb29wXHJcblx0XHRcdFx0Zm9yICh2YXIgaSA9IGluZGV4LCBwb3MgPSBzdGFydFBvczsgaSA8IHN0cmFyci5sZW5ndGg7IHBvcyArPSBzdHJhcnJbaV0ubGVuZ3RoLCArK2kpIHtcclxuXHJcblx0XHRcdFx0XHR2YXIgc3RyID0gc3RyYXJyW2ldO1xyXG5cclxuXHRcdFx0XHRcdGlmIChzdHJhcnIubGVuZ3RoID4gdGV4dC5sZW5ndGgpIHtcclxuXHRcdFx0XHRcdFx0Ly8gU29tZXRoaW5nIHdlbnQgdGVycmlibHkgd3JvbmcsIEFCT1JULCBBQk9SVCFcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmIChzdHIgaW5zdGFuY2VvZiBUb2tlbikge1xyXG5cdFx0XHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRwYXR0ZXJuLmxhc3RJbmRleCA9IDA7XHJcblxyXG5cdFx0XHRcdFx0dmFyIG1hdGNoID0gcGF0dGVybi5leGVjKHN0ciksXHJcblx0XHRcdFx0XHQgICAgZGVsTnVtID0gMTtcclxuXHJcblx0XHRcdFx0XHQvLyBHcmVlZHkgcGF0dGVybnMgY2FuIG92ZXJyaWRlL3JlbW92ZSB1cCB0byB0d28gcHJldmlvdXNseSBtYXRjaGVkIHRva2Vuc1xyXG5cdFx0XHRcdFx0aWYgKCFtYXRjaCAmJiBncmVlZHkgJiYgaSAhPSBzdHJhcnIubGVuZ3RoIC0gMSkge1xyXG5cdFx0XHRcdFx0XHRwYXR0ZXJuLmxhc3RJbmRleCA9IHBvcztcclxuXHRcdFx0XHRcdFx0bWF0Y2ggPSBwYXR0ZXJuLmV4ZWModGV4dCk7XHJcblx0XHRcdFx0XHRcdGlmICghbWF0Y2gpIHtcclxuXHRcdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0dmFyIGZyb20gPSBtYXRjaC5pbmRleCArIChsb29rYmVoaW5kID8gbWF0Y2hbMV0ubGVuZ3RoIDogMCksXHJcblx0XHRcdFx0XHRcdCAgICB0byA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoLFxyXG5cdFx0XHRcdFx0XHQgICAgayA9IGksXHJcblx0XHRcdFx0XHRcdCAgICBwID0gcG9zO1xyXG5cclxuXHRcdFx0XHRcdFx0Zm9yICh2YXIgbGVuID0gc3RyYXJyLmxlbmd0aDsgayA8IGxlbiAmJiAocCA8IHRvIHx8ICghc3RyYXJyW2tdLnR5cGUgJiYgIXN0cmFycltrIC0gMV0uZ3JlZWR5KSk7ICsraykge1xyXG5cdFx0XHRcdFx0XHRcdHAgKz0gc3RyYXJyW2tdLmxlbmd0aDtcclxuXHRcdFx0XHRcdFx0XHQvLyBNb3ZlIHRoZSBpbmRleCBpIHRvIHRoZSBlbGVtZW50IGluIHN0cmFyciB0aGF0IGlzIGNsb3Nlc3QgdG8gZnJvbVxyXG5cdFx0XHRcdFx0XHRcdGlmIChmcm9tID49IHApIHtcclxuXHRcdFx0XHRcdFx0XHRcdCsraTtcclxuXHRcdFx0XHRcdFx0XHRcdHBvcyA9IHA7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHQvKlxyXG5cdFx0XHRcdFx0XHQgKiBJZiBzdHJhcnJbaV0gaXMgYSBUb2tlbiwgdGhlbiB0aGUgbWF0Y2ggc3RhcnRzIGluc2lkZSBhbm90aGVyIFRva2VuLCB3aGljaCBpcyBpbnZhbGlkXHJcblx0XHRcdFx0XHRcdCAqIElmIHN0cmFycltrIC0gMV0gaXMgZ3JlZWR5IHdlIGFyZSBpbiBjb25mbGljdCB3aXRoIGFub3RoZXIgZ3JlZWR5IHBhdHRlcm5cclxuXHRcdFx0XHRcdFx0ICovXHJcblx0XHRcdFx0XHRcdGlmIChzdHJhcnJbaV0gaW5zdGFuY2VvZiBUb2tlbiB8fCBzdHJhcnJbayAtIDFdLmdyZWVkeSkge1xyXG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBOdW1iZXIgb2YgdG9rZW5zIHRvIGRlbGV0ZSBhbmQgcmVwbGFjZSB3aXRoIHRoZSBuZXcgbWF0Y2hcclxuXHRcdFx0XHRcdFx0ZGVsTnVtID0gayAtIGk7XHJcblx0XHRcdFx0XHRcdHN0ciA9IHRleHQuc2xpY2UocG9zLCBwKTtcclxuXHRcdFx0XHRcdFx0bWF0Y2guaW5kZXggLT0gcG9zO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICghbWF0Y2gpIHtcclxuXHRcdFx0XHRcdFx0aWYgKG9uZXNob3QpIHtcclxuXHRcdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYobG9va2JlaGluZCkge1xyXG5cdFx0XHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gbWF0Y2hbMV0ubGVuZ3RoO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHZhciBmcm9tID0gbWF0Y2guaW5kZXggKyBsb29rYmVoaW5kTGVuZ3RoLFxyXG5cdFx0XHRcdFx0ICAgIG1hdGNoID0gbWF0Y2hbMF0uc2xpY2UobG9va2JlaGluZExlbmd0aCksXHJcblx0XHRcdFx0XHQgICAgdG8gPSBmcm9tICsgbWF0Y2gubGVuZ3RoLFxyXG5cdFx0XHRcdFx0ICAgIGJlZm9yZSA9IHN0ci5zbGljZSgwLCBmcm9tKSxcclxuXHRcdFx0XHRcdCAgICBhZnRlciA9IHN0ci5zbGljZSh0byk7XHJcblxyXG5cdFx0XHRcdFx0dmFyIGFyZ3MgPSBbaSwgZGVsTnVtXTtcclxuXHJcblx0XHRcdFx0XHRpZiAoYmVmb3JlKSB7XHJcblx0XHRcdFx0XHRcdCsraTtcclxuXHRcdFx0XHRcdFx0cG9zICs9IGJlZm9yZS5sZW5ndGg7XHJcblx0XHRcdFx0XHRcdGFyZ3MucHVzaChiZWZvcmUpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHZhciB3cmFwcGVkID0gbmV3IFRva2VuKHRva2VuLCBpbnNpZGU/IF8udG9rZW5pemUobWF0Y2gsIGluc2lkZSkgOiBtYXRjaCwgYWxpYXMsIG1hdGNoLCBncmVlZHkpO1xyXG5cclxuXHRcdFx0XHRcdGFyZ3MucHVzaCh3cmFwcGVkKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoYWZ0ZXIpIHtcclxuXHRcdFx0XHRcdFx0YXJncy5wdXNoKGFmdGVyKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRBcnJheS5wcm90b3R5cGUuc3BsaWNlLmFwcGx5KHN0cmFyciwgYXJncyk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKGRlbE51bSAhPSAxKVxyXG5cdFx0XHRcdFx0XHRfLm1hdGNoR3JhbW1hcih0ZXh0LCBzdHJhcnIsIGdyYW1tYXIsIGksIHBvcywgdHJ1ZSwgdG9rZW4pO1xyXG5cclxuXHRcdFx0XHRcdGlmIChvbmVzaG90KVxyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHR0b2tlbml6ZTogZnVuY3Rpb24odGV4dCwgZ3JhbW1hciwgbGFuZ3VhZ2UpIHtcclxuXHRcdHZhciBzdHJhcnIgPSBbdGV4dF07XHJcblxyXG5cdFx0dmFyIHJlc3QgPSBncmFtbWFyLnJlc3Q7XHJcblxyXG5cdFx0aWYgKHJlc3QpIHtcclxuXHRcdFx0Zm9yICh2YXIgdG9rZW4gaW4gcmVzdCkge1xyXG5cdFx0XHRcdGdyYW1tYXJbdG9rZW5dID0gcmVzdFt0b2tlbl07XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGRlbGV0ZSBncmFtbWFyLnJlc3Q7XHJcblx0XHR9XHJcblxyXG5cdFx0Xy5tYXRjaEdyYW1tYXIodGV4dCwgc3RyYXJyLCBncmFtbWFyLCAwLCAwLCBmYWxzZSk7XHJcblxyXG5cdFx0cmV0dXJuIHN0cmFycjtcclxuXHR9LFxyXG5cclxuXHRob29rczoge1xyXG5cdFx0YWxsOiB7fSxcclxuXHJcblx0XHRhZGQ6IGZ1bmN0aW9uIChuYW1lLCBjYWxsYmFjaykge1xyXG5cdFx0XHR2YXIgaG9va3MgPSBfLmhvb2tzLmFsbDtcclxuXHJcblx0XHRcdGhvb2tzW25hbWVdID0gaG9va3NbbmFtZV0gfHwgW107XHJcblxyXG5cdFx0XHRob29rc1tuYW1lXS5wdXNoKGNhbGxiYWNrKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0cnVuOiBmdW5jdGlvbiAobmFtZSwgZW52KSB7XHJcblx0XHRcdHZhciBjYWxsYmFja3MgPSBfLmhvb2tzLmFsbFtuYW1lXTtcclxuXHJcblx0XHRcdGlmICghY2FsbGJhY2tzIHx8ICFjYWxsYmFja3MubGVuZ3RoKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKHZhciBpPTAsIGNhbGxiYWNrOyBjYWxsYmFjayA9IGNhbGxiYWNrc1tpKytdOykge1xyXG5cdFx0XHRcdGNhbGxiYWNrKGVudik7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcbn07XHJcblxyXG52YXIgVG9rZW4gPSBfLlRva2VuID0gZnVuY3Rpb24odHlwZSwgY29udGVudCwgYWxpYXMsIG1hdGNoZWRTdHIsIGdyZWVkeSkge1xyXG5cdHRoaXMudHlwZSA9IHR5cGU7XHJcblx0dGhpcy5jb250ZW50ID0gY29udGVudDtcclxuXHR0aGlzLmFsaWFzID0gYWxpYXM7XHJcblx0Ly8gQ29weSBvZiB0aGUgZnVsbCBzdHJpbmcgdGhpcyB0b2tlbiB3YXMgY3JlYXRlZCBmcm9tXHJcblx0dGhpcy5sZW5ndGggPSAobWF0Y2hlZFN0ciB8fCBcIlwiKS5sZW5ndGh8MDtcclxuXHR0aGlzLmdyZWVkeSA9ICEhZ3JlZWR5O1xyXG59O1xyXG5cclxuVG9rZW4uc3RyaW5naWZ5ID0gZnVuY3Rpb24obywgbGFuZ3VhZ2UsIHBhcmVudCkge1xyXG5cdGlmICh0eXBlb2YgbyA9PSAnc3RyaW5nJykge1xyXG5cdFx0cmV0dXJuIG87XHJcblx0fVxyXG5cclxuXHRpZiAoXy51dGlsLnR5cGUobykgPT09ICdBcnJheScpIHtcclxuXHRcdHJldHVybiBvLm1hcChmdW5jdGlvbihlbGVtZW50KSB7XHJcblx0XHRcdHJldHVybiBUb2tlbi5zdHJpbmdpZnkoZWxlbWVudCwgbGFuZ3VhZ2UsIG8pO1xyXG5cdFx0fSkuam9pbignJyk7XHJcblx0fVxyXG5cclxuXHR2YXIgZW52ID0ge1xyXG5cdFx0dHlwZTogby50eXBlLFxyXG5cdFx0Y29udGVudDogVG9rZW4uc3RyaW5naWZ5KG8uY29udGVudCwgbGFuZ3VhZ2UsIHBhcmVudCksXHJcblx0XHR0YWc6ICdzcGFuJyxcclxuXHRcdGNsYXNzZXM6IFsndG9rZW4nLCBvLnR5cGVdLFxyXG5cdFx0YXR0cmlidXRlczoge30sXHJcblx0XHRsYW5ndWFnZTogbGFuZ3VhZ2UsXHJcblx0XHRwYXJlbnQ6IHBhcmVudFxyXG5cdH07XHJcblxyXG5cdGlmIChlbnYudHlwZSA9PSAnY29tbWVudCcpIHtcclxuXHRcdGVudi5hdHRyaWJ1dGVzWydzcGVsbGNoZWNrJ10gPSAndHJ1ZSc7XHJcblx0fVxyXG5cclxuXHRpZiAoby5hbGlhcykge1xyXG5cdFx0dmFyIGFsaWFzZXMgPSBfLnV0aWwudHlwZShvLmFsaWFzKSA9PT0gJ0FycmF5JyA/IG8uYWxpYXMgOiBbby5hbGlhc107XHJcblx0XHRBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShlbnYuY2xhc3NlcywgYWxpYXNlcyk7XHJcblx0fVxyXG5cclxuXHRfLmhvb2tzLnJ1bignd3JhcCcsIGVudik7XHJcblxyXG5cdHZhciBhdHRyaWJ1dGVzID0gT2JqZWN0LmtleXMoZW52LmF0dHJpYnV0ZXMpLm1hcChmdW5jdGlvbihuYW1lKSB7XHJcblx0XHRyZXR1cm4gbmFtZSArICc9XCInICsgKGVudi5hdHRyaWJ1dGVzW25hbWVdIHx8ICcnKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7JykgKyAnXCInO1xyXG5cdH0pLmpvaW4oJyAnKTtcclxuXHJcblx0cmV0dXJuICc8JyArIGVudi50YWcgKyAnIGNsYXNzPVwiJyArIGVudi5jbGFzc2VzLmpvaW4oJyAnKSArICdcIicgKyAoYXR0cmlidXRlcyA/ICcgJyArIGF0dHJpYnV0ZXMgOiAnJykgKyAnPicgKyBlbnYuY29udGVudCArICc8LycgKyBlbnYudGFnICsgJz4nO1xyXG5cclxufTtcclxuXHJcbmlmICghX3NlbGYuZG9jdW1lbnQpIHtcclxuXHRpZiAoIV9zZWxmLmFkZEV2ZW50TGlzdGVuZXIpIHtcclxuXHRcdC8vIGluIE5vZGUuanNcclxuXHRcdHJldHVybiBfc2VsZi5QcmlzbTtcclxuXHR9XHJcbiBcdC8vIEluIHdvcmtlclxyXG5cdF9zZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdHZhciBtZXNzYWdlID0gSlNPTi5wYXJzZShldnQuZGF0YSksXHJcblx0XHQgICAgbGFuZyA9IG1lc3NhZ2UubGFuZ3VhZ2UsXHJcblx0XHQgICAgY29kZSA9IG1lc3NhZ2UuY29kZSxcclxuXHRcdCAgICBpbW1lZGlhdGVDbG9zZSA9IG1lc3NhZ2UuaW1tZWRpYXRlQ2xvc2U7XHJcblxyXG5cdFx0X3NlbGYucG9zdE1lc3NhZ2UoXy5oaWdobGlnaHQoY29kZSwgXy5sYW5ndWFnZXNbbGFuZ10sIGxhbmcpKTtcclxuXHRcdGlmIChpbW1lZGlhdGVDbG9zZSkge1xyXG5cdFx0XHRfc2VsZi5jbG9zZSgpO1xyXG5cdFx0fVxyXG5cdH0sIGZhbHNlKTtcclxuXHJcblx0cmV0dXJuIF9zZWxmLlByaXNtO1xyXG59XHJcblxyXG4vL0dldCBjdXJyZW50IHNjcmlwdCBhbmQgaGlnaGxpZ2h0XHJcbnZhciBzY3JpcHQgPSBkb2N1bWVudC5jdXJyZW50U2NyaXB0IHx8IFtdLnNsaWNlLmNhbGwoZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJzY3JpcHRcIikpLnBvcCgpO1xyXG5cclxuaWYgKHNjcmlwdCkge1xyXG5cdF8uZmlsZW5hbWUgPSBzY3JpcHQuc3JjO1xyXG5cclxuXHRpZiAoZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciAmJiAhXy5tYW51YWwgJiYgIXNjcmlwdC5oYXNBdHRyaWJ1dGUoJ2RhdGEtbWFudWFsJykpIHtcclxuXHRcdGlmKGRvY3VtZW50LnJlYWR5U3RhdGUgIT09IFwibG9hZGluZ1wiKSB7XHJcblx0XHRcdGlmICh3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKSB7XHJcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShfLmhpZ2hsaWdodEFsbCk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoXy5oaWdobGlnaHRBbGwsIDE2KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBfLmhpZ2hsaWdodEFsbCk7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG5yZXR1cm4gX3NlbGYuUHJpc207XHJcblxyXG59KSgpO1xyXG5cclxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XHJcblx0bW9kdWxlLmV4cG9ydHMgPSBQcmlzbTtcclxufVxyXG5cclxuLy8gaGFjayBmb3IgY29tcG9uZW50cyB0byB3b3JrIGNvcnJlY3RseSBpbiBub2RlLmpzXHJcbmlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xyXG5cdGdsb2JhbC5QcmlzbSA9IFByaXNtO1xyXG59XHJcblxyXG5cclxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgIEJlZ2luIHByaXNtLW1hcmt1cC5qc1xyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcblxyXG5QcmlzbS5sYW5ndWFnZXMubWFya3VwID0ge1xyXG5cdCdjb21tZW50JzogLzwhLS1bXFxzXFxTXSo/LS0+LyxcclxuXHQncHJvbG9nJzogLzxcXD9bXFxzXFxTXSs/XFw/Pi8sXHJcblx0J2RvY3R5cGUnOiAvPCFET0NUWVBFW1xcc1xcU10rPz4vaSxcclxuXHQnY2RhdGEnOiAvPCFcXFtDREFUQVxcW1tcXHNcXFNdKj9dXT4vaSxcclxuXHQndGFnJzoge1xyXG5cdFx0cGF0dGVybjogLzxcXC8/KD8hXFxkKVteXFxzPlxcLz0kPF0rKD86XFxzK1teXFxzPlxcLz1dKyg/Oj0oPzooXCJ8JykoPzpcXFxcXFwxfFxcXFw/KD8hXFwxKVtcXHNcXFNdKSpcXDF8W15cXHMnXCI+PV0rKSk/KSpcXHMqXFwvPz4vaSxcclxuXHRcdGluc2lkZToge1xyXG5cdFx0XHQndGFnJzoge1xyXG5cdFx0XHRcdHBhdHRlcm46IC9ePFxcLz9bXlxccz5cXC9dKy9pLFxyXG5cdFx0XHRcdGluc2lkZToge1xyXG5cdFx0XHRcdFx0J3B1bmN0dWF0aW9uJzogL148XFwvPy8sXHJcblx0XHRcdFx0XHQnbmFtZXNwYWNlJzogL15bXlxccz5cXC86XSs6L1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0J2F0dHItdmFsdWUnOiB7XHJcblx0XHRcdFx0cGF0dGVybjogLz0oPzooJ3xcIilbXFxzXFxTXSo/KFxcMSl8W15cXHM+XSspL2ksXHJcblx0XHRcdFx0aW5zaWRlOiB7XHJcblx0XHRcdFx0XHQncHVuY3R1YXRpb24nOiAvWz0+XCInXS9cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sXHJcblx0XHRcdCdwdW5jdHVhdGlvbic6IC9cXC8/Pi8sXHJcblx0XHRcdCdhdHRyLW5hbWUnOiB7XHJcblx0XHRcdFx0cGF0dGVybjogL1teXFxzPlxcL10rLyxcclxuXHRcdFx0XHRpbnNpZGU6IHtcclxuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cdH0sXHJcblx0J2VudGl0eSc6IC8mIz9bXFxkYS16XXsxLDh9Oy9pXHJcbn07XHJcblxyXG4vLyBQbHVnaW4gdG8gbWFrZSBlbnRpdHkgdGl0bGUgc2hvdyB0aGUgcmVhbCBlbnRpdHksIGlkZWEgYnkgUm9tYW4gS29tYXJvdlxyXG5QcmlzbS5ob29rcy5hZGQoJ3dyYXAnLCBmdW5jdGlvbihlbnYpIHtcclxuXHJcblx0aWYgKGVudi50eXBlID09PSAnZW50aXR5Jykge1xyXG5cdFx0ZW52LmF0dHJpYnV0ZXNbJ3RpdGxlJ10gPSBlbnYuY29udGVudC5yZXBsYWNlKC8mYW1wOy8sICcmJyk7XHJcblx0fVxyXG59KTtcclxuXHJcblByaXNtLmxhbmd1YWdlcy54bWwgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xyXG5QcmlzbS5sYW5ndWFnZXMuaHRtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XHJcblByaXNtLmxhbmd1YWdlcy5tYXRobWwgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xyXG5QcmlzbS5sYW5ndWFnZXMuc3ZnID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcclxuXHJcblxyXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgQmVnaW4gcHJpc20tY3NzLmpzXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuXHJcblByaXNtLmxhbmd1YWdlcy5jc3MgPSB7XHJcblx0J2NvbW1lbnQnOiAvXFwvXFwqW1xcc1xcU10qP1xcKlxcLy8sXHJcblx0J2F0cnVsZSc6IHtcclxuXHRcdHBhdHRlcm46IC9AW1xcdy1dKz8uKj8oO3woPz1cXHMqXFx7KSkvaSxcclxuXHRcdGluc2lkZToge1xyXG5cdFx0XHQncnVsZSc6IC9AW1xcdy1dKy9cclxuXHRcdFx0Ly8gU2VlIHJlc3QgYmVsb3dcclxuXHRcdH1cclxuXHR9LFxyXG5cdCd1cmwnOiAvdXJsXFwoKD86KFtcIiddKShcXFxcKD86XFxyXFxufFtcXHNcXFNdKXwoPyFcXDEpW15cXFxcXFxyXFxuXSkqXFwxfC4qPylcXCkvaSxcclxuXHQnc2VsZWN0b3InOiAvW15cXHtcXH1cXHNdW15cXHtcXH07XSo/KD89XFxzKlxceykvLFxyXG5cdCdzdHJpbmcnOiB7XHJcblx0XHRwYXR0ZXJuOiAvKFwifCcpKFxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvLFxyXG5cdFx0Z3JlZWR5OiB0cnVlXHJcblx0fSxcclxuXHQncHJvcGVydHknOiAvKFxcYnxcXEIpW1xcdy1dKyg/PVxccyo6KS9pLFxyXG5cdCdpbXBvcnRhbnQnOiAvXFxCIWltcG9ydGFudFxcYi9pLFxyXG5cdCdmdW5jdGlvbic6IC9bLWEtejAtOV0rKD89XFwoKS9pLFxyXG5cdCdwdW5jdHVhdGlvbic6IC9bKCl7fTs6XS9cclxufTtcclxuXHJcblByaXNtLmxhbmd1YWdlcy5jc3NbJ2F0cnVsZSddLmluc2lkZS5yZXN0ID0gUHJpc20udXRpbC5jbG9uZShQcmlzbS5sYW5ndWFnZXMuY3NzKTtcclxuXHJcbmlmIChQcmlzbS5sYW5ndWFnZXMubWFya3VwKSB7XHJcblx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnbWFya3VwJywgJ3RhZycsIHtcclxuXHRcdCdzdHlsZSc6IHtcclxuXHRcdFx0cGF0dGVybjogLyg8c3R5bGVbXFxzXFxTXSo/PilbXFxzXFxTXSo/KD89PFxcL3N0eWxlPikvaSxcclxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZSxcclxuXHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMuY3NzLFxyXG5cdFx0XHRhbGlhczogJ2xhbmd1YWdlLWNzcydcclxuXHRcdH1cclxuXHR9KTtcclxuXHRcclxuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdpbnNpZGUnLCAnYXR0ci12YWx1ZScsIHtcclxuXHRcdCdzdHlsZS1hdHRyJzoge1xyXG5cdFx0XHRwYXR0ZXJuOiAvXFxzKnN0eWxlPShcInwnKS4qP1xcMS9pLFxyXG5cdFx0XHRpbnNpZGU6IHtcclxuXHRcdFx0XHQnYXR0ci1uYW1lJzoge1xyXG5cdFx0XHRcdFx0cGF0dGVybjogL15cXHMqc3R5bGUvaSxcclxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcuaW5zaWRlXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQncHVuY3R1YXRpb24nOiAvXlxccyo9XFxzKlsnXCJdfFsnXCJdXFxzKiQvLFxyXG5cdFx0XHRcdCdhdHRyLXZhbHVlJzoge1xyXG5cdFx0XHRcdFx0cGF0dGVybjogLy4rL2ksXHJcblx0XHRcdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5jc3NcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sXHJcblx0XHRcdGFsaWFzOiAnbGFuZ3VhZ2UtY3NzJ1xyXG5cdFx0fVxyXG5cdH0sIFByaXNtLmxhbmd1YWdlcy5tYXJrdXAudGFnKTtcclxufVxyXG5cclxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgIEJlZ2luIHByaXNtLWNsaWtlLmpzXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuXHJcblByaXNtLmxhbmd1YWdlcy5jbGlrZSA9IHtcclxuXHQnY29tbWVudCc6IFtcclxuXHRcdHtcclxuXHRcdFx0cGF0dGVybjogLyhefFteXFxcXF0pXFwvXFwqW1xcc1xcU10qP1xcKlxcLy8sXHJcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWVcclxuXHRcdH0sXHJcblx0XHR7XHJcblx0XHRcdHBhdHRlcm46IC8oXnxbXlxcXFw6XSlcXC9cXC8uKi8sXHJcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWVcclxuXHRcdH1cclxuXHRdLFxyXG5cdCdzdHJpbmcnOiB7XHJcblx0XHRwYXR0ZXJuOiAvKFtcIiddKShcXFxcKD86XFxyXFxufFtcXHNcXFNdKXwoPyFcXDEpW15cXFxcXFxyXFxuXSkqXFwxLyxcclxuXHRcdGdyZWVkeTogdHJ1ZVxyXG5cdH0sXHJcblx0J2NsYXNzLW5hbWUnOiB7XHJcblx0XHRwYXR0ZXJuOiAvKCg/OlxcYig/OmNsYXNzfGludGVyZmFjZXxleHRlbmRzfGltcGxlbWVudHN8dHJhaXR8aW5zdGFuY2VvZnxuZXcpXFxzKyl8KD86Y2F0Y2hcXHMrXFwoKSlbYS16MC05X1xcLlxcXFxdKy9pLFxyXG5cdFx0bG9va2JlaGluZDogdHJ1ZSxcclxuXHRcdGluc2lkZToge1xyXG5cdFx0XHRwdW5jdHVhdGlvbjogLyhcXC58XFxcXCkvXHJcblx0XHR9XHJcblx0fSxcclxuXHQna2V5d29yZCc6IC9cXGIoaWZ8ZWxzZXx3aGlsZXxkb3xmb3J8cmV0dXJufGlufGluc3RhbmNlb2Z8ZnVuY3Rpb258bmV3fHRyeXx0aHJvd3xjYXRjaHxmaW5hbGx5fG51bGx8YnJlYWt8Y29udGludWUpXFxiLyxcclxuXHQnYm9vbGVhbic6IC9cXGIodHJ1ZXxmYWxzZSlcXGIvLFxyXG5cdCdmdW5jdGlvbic6IC9bYS16MC05X10rKD89XFwoKS9pLFxyXG5cdCdudW1iZXInOiAvXFxiLT8oPzoweFtcXGRhLWZdK3xcXGQqXFwuP1xcZCsoPzplWystXT9cXGQrKT8pXFxiL2ksXHJcblx0J29wZXJhdG9yJzogLy0tP3xcXCtcXCs/fCE9Pz0/fDw9P3w+PT98PT0/PT98JiY/fFxcfFxcfD98XFw/fFxcKnxcXC98fnxcXF58JS8sXHJcblx0J3B1bmN0dWF0aW9uJzogL1t7fVtcXF07KCksLjpdL1xyXG59O1xyXG5cclxuXHJcbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICAgICBCZWdpbiBwcmlzbS1qYXZhc2NyaXB0LmpzXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuXHJcblByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0ID0gUHJpc20ubGFuZ3VhZ2VzLmV4dGVuZCgnY2xpa2UnLCB7XHJcblx0J2tleXdvcmQnOiAvXFxiKGFzfGFzeW5jfGF3YWl0fGJyZWFrfGNhc2V8Y2F0Y2h8Y2xhc3N8Y29uc3R8Y29udGludWV8ZGVidWdnZXJ8ZGVmYXVsdHxkZWxldGV8ZG98ZWxzZXxlbnVtfGV4cG9ydHxleHRlbmRzfGZpbmFsbHl8Zm9yfGZyb218ZnVuY3Rpb258Z2V0fGlmfGltcGxlbWVudHN8aW1wb3J0fGlufGluc3RhbmNlb2Z8aW50ZXJmYWNlfGxldHxuZXd8bnVsbHxvZnxwYWNrYWdlfHByaXZhdGV8cHJvdGVjdGVkfHB1YmxpY3xyZXR1cm58c2V0fHN0YXRpY3xzdXBlcnxzd2l0Y2h8dGhpc3x0aHJvd3x0cnl8dHlwZW9mfHZhcnx2b2lkfHdoaWxlfHdpdGh8eWllbGQpXFxiLyxcclxuXHQnbnVtYmVyJzogL1xcYi0/KDB4W1xcZEEtRmEtZl0rfDBiWzAxXSt8MG9bMC03XSt8XFxkKlxcLj9cXGQrKFtFZV1bKy1dP1xcZCspP3xOYU58SW5maW5pdHkpXFxiLyxcclxuXHQvLyBBbGxvdyBmb3IgYWxsIG5vbi1BU0NJSSBjaGFyYWN0ZXJzIChTZWUgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjAwODQ0NClcclxuXHQnZnVuY3Rpb24nOiAvW18kYS16QS1aXFx4QTAtXFx1RkZGRl1bXyRhLXpBLVowLTlcXHhBMC1cXHVGRkZGXSooPz1cXCgpL2ksXHJcblx0J29wZXJhdG9yJzogLy1bLT1dP3xcXCtbKz1dP3whPT89P3w8PD89P3w+Pj8+Pz0/fD0oPzo9PT98Pik/fCZbJj1dP3xcXHxbfD1dP3xcXCpcXCo/PT98XFwvPT98fnxcXF49P3wlPT98XFw/fFxcLnszfS9cclxufSk7XHJcblxyXG5QcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdqYXZhc2NyaXB0JywgJ2tleXdvcmQnLCB7XHJcblx0J3JlZ2V4Jzoge1xyXG5cdFx0cGF0dGVybjogLyhefFteL10pXFwvKD8hXFwvKShcXFsuKz9dfFxcXFwufFteL1xcXFxcXHJcXG5dKStcXC9bZ2lteXVdezAsNX0oPz1cXHMqKCR8W1xcclxcbiwuO30pXSkpLyxcclxuXHRcdGxvb2tiZWhpbmQ6IHRydWUsXHJcblx0XHRncmVlZHk6IHRydWVcclxuXHR9XHJcbn0pO1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnamF2YXNjcmlwdCcsICdzdHJpbmcnLCB7XHJcblx0J3RlbXBsYXRlLXN0cmluZyc6IHtcclxuXHRcdHBhdHRlcm46IC9gKD86XFxcXFxcXFx8XFxcXD9bXlxcXFxdKSo/YC8sXHJcblx0XHRncmVlZHk6IHRydWUsXHJcblx0XHRpbnNpZGU6IHtcclxuXHRcdFx0J2ludGVycG9sYXRpb24nOiB7XHJcblx0XHRcdFx0cGF0dGVybjogL1xcJFxce1tefV0rXFx9LyxcclxuXHRcdFx0XHRpbnNpZGU6IHtcclxuXHRcdFx0XHRcdCdpbnRlcnBvbGF0aW9uLXB1bmN0dWF0aW9uJzoge1xyXG5cdFx0XHRcdFx0XHRwYXR0ZXJuOiAvXlxcJFxce3xcXH0kLyxcclxuXHRcdFx0XHRcdFx0YWxpYXM6ICdwdW5jdHVhdGlvbidcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRyZXN0OiBQcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0J3N0cmluZyc6IC9bXFxzXFxTXSsvXHJcblx0XHR9XHJcblx0fVxyXG59KTtcclxuXHJcbmlmIChQcmlzbS5sYW5ndWFnZXMubWFya3VwKSB7XHJcblx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnbWFya3VwJywgJ3RhZycsIHtcclxuXHRcdCdzY3JpcHQnOiB7XHJcblx0XHRcdHBhdHRlcm46IC8oPHNjcmlwdFtcXHNcXFNdKj8+KVtcXHNcXFNdKj8oPz08XFwvc2NyaXB0PikvaSxcclxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZSxcclxuXHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdCxcclxuXHRcdFx0YWxpYXM6ICdsYW5ndWFnZS1qYXZhc2NyaXB0J1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59XHJcblxyXG5QcmlzbS5sYW5ndWFnZXMuanMgPSBQcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdDtcclxuXHJcbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICAgICBCZWdpbiBwcmlzbS1maWxlLWhpZ2hsaWdodC5qc1xyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcblxyXG4oZnVuY3Rpb24gKCkge1xyXG5cdGlmICh0eXBlb2Ygc2VsZiA9PT0gJ3VuZGVmaW5lZCcgfHwgIXNlbGYuUHJpc20gfHwgIXNlbGYuZG9jdW1lbnQgfHwgIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IpIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdHNlbGYuUHJpc20uZmlsZUhpZ2hsaWdodCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHRcdHZhciBFeHRlbnNpb25zID0ge1xyXG5cdFx0XHQnanMnOiAnamF2YXNjcmlwdCcsXHJcblx0XHRcdCdweSc6ICdweXRob24nLFxyXG5cdFx0XHQncmInOiAncnVieScsXHJcblx0XHRcdCdwczEnOiAncG93ZXJzaGVsbCcsXHJcblx0XHRcdCdwc20xJzogJ3Bvd2Vyc2hlbGwnLFxyXG5cdFx0XHQnc2gnOiAnYmFzaCcsXHJcblx0XHRcdCdiYXQnOiAnYmF0Y2gnLFxyXG5cdFx0XHQnaCc6ICdjJyxcclxuXHRcdFx0J3RleCc6ICdsYXRleCdcclxuXHRcdH07XHJcblxyXG5cdFx0aWYoQXJyYXkucHJvdG90eXBlLmZvckVhY2gpIHsgLy8gQ2hlY2sgdG8gcHJldmVudCBlcnJvciBpbiBJRThcclxuXHRcdFx0QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgncHJlW2RhdGEtc3JjXScpKS5mb3JFYWNoKGZ1bmN0aW9uIChwcmUpIHtcclxuXHRcdFx0XHR2YXIgc3JjID0gcHJlLmdldEF0dHJpYnV0ZSgnZGF0YS1zcmMnKTtcclxuXHJcblx0XHRcdFx0dmFyIGxhbmd1YWdlLCBwYXJlbnQgPSBwcmU7XHJcblx0XHRcdFx0dmFyIGxhbmcgPSAvXFxibGFuZyg/OnVhZ2UpPy0oPyFcXCopKFxcdyspXFxiL2k7XHJcblx0XHRcdFx0d2hpbGUgKHBhcmVudCAmJiAhbGFuZy50ZXN0KHBhcmVudC5jbGFzc05hbWUpKSB7XHJcblx0XHRcdFx0XHRwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmIChwYXJlbnQpIHtcclxuXHRcdFx0XHRcdGxhbmd1YWdlID0gKHByZS5jbGFzc05hbWUubWF0Y2gobGFuZykgfHwgWywgJyddKVsxXTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICghbGFuZ3VhZ2UpIHtcclxuXHRcdFx0XHRcdHZhciBleHRlbnNpb24gPSAoc3JjLm1hdGNoKC9cXC4oXFx3KykkLykgfHwgWywgJyddKVsxXTtcclxuXHRcdFx0XHRcdGxhbmd1YWdlID0gRXh0ZW5zaW9uc1tleHRlbnNpb25dIHx8IGV4dGVuc2lvbjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHZhciBjb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY29kZScpO1xyXG5cdFx0XHRcdGNvZGUuY2xhc3NOYW1lID0gJ2xhbmd1YWdlLScgKyBsYW5ndWFnZTtcclxuXHJcblx0XHRcdFx0cHJlLnRleHRDb250ZW50ID0gJyc7XHJcblxyXG5cdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAnTG9hZGluZ+KApic7XHJcblxyXG5cdFx0XHRcdHByZS5hcHBlbmRDaGlsZChjb2RlKTtcclxuXHJcblx0XHRcdFx0dmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xyXG5cclxuXHRcdFx0XHR4aHIub3BlbignR0VUJywgc3JjLCB0cnVlKTtcclxuXHJcblx0XHRcdFx0eGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdGlmICh4aHIucmVhZHlTdGF0ZSA9PSA0KSB7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoeGhyLnN0YXR1cyA8IDQwMCAmJiB4aHIucmVzcG9uc2VUZXh0KSB7XHJcblx0XHRcdFx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9IHhoci5yZXNwb25zZVRleHQ7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFByaXNtLmhpZ2hsaWdodEVsZW1lbnQoY29kZSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAoeGhyLnN0YXR1cyA+PSA0MDApIHtcclxuXHRcdFx0XHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0gJ+KcliBFcnJvciAnICsgeGhyLnN0YXR1cyArICcgd2hpbGUgZmV0Y2hpbmcgZmlsZTogJyArIHhoci5zdGF0dXNUZXh0O1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAn4pyWIEVycm9yOiBGaWxlIGRvZXMgbm90IGV4aXN0IG9yIGlzIGVtcHR5JztcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdHhoci5zZW5kKG51bGwpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0fTtcclxuXHJcblx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIHNlbGYuUHJpc20uZmlsZUhpZ2hsaWdodCk7XHJcblxyXG59KSgpO1xyXG5cbn0pLmNhbGwodGhpcyx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcclxuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xyXG4gICAgdmFyIGJhY2tkcm9wcztcclxuXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVCYWNrZHJvcEZvclNsaWRlKHNsaWRlKSB7XHJcbiAgICAgIHZhciBiYWNrZHJvcEF0dHJpYnV0ZSA9IHNsaWRlLmdldEF0dHJpYnV0ZSgnZGF0YS1iZXNwb2tlLWJhY2tkcm9wJyk7XHJcblxyXG4gICAgICBpZiAoYmFja2Ryb3BBdHRyaWJ1dGUpIHtcclxuICAgICAgICB2YXIgYmFja2Ryb3AgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICBiYWNrZHJvcC5jbGFzc05hbWUgPSBiYWNrZHJvcEF0dHJpYnV0ZTtcclxuICAgICAgICBiYWNrZHJvcC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJhY2tkcm9wJyk7XHJcbiAgICAgICAgZGVjay5wYXJlbnQuYXBwZW5kQ2hpbGQoYmFja2Ryb3ApO1xyXG4gICAgICAgIHJldHVybiBiYWNrZHJvcDtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHVwZGF0ZUNsYXNzZXMoZWwpIHtcclxuICAgICAgaWYgKGVsKSB7XHJcbiAgICAgICAgdmFyIGluZGV4ID0gYmFja2Ryb3BzLmluZGV4T2YoZWwpLFxyXG4gICAgICAgICAgY3VycmVudEluZGV4ID0gZGVjay5zbGlkZSgpO1xyXG5cclxuICAgICAgICByZW1vdmVDbGFzcyhlbCwgJ2FjdGl2ZScpO1xyXG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnaW5hY3RpdmUnKTtcclxuICAgICAgICByZW1vdmVDbGFzcyhlbCwgJ2JlZm9yZScpO1xyXG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnYWZ0ZXInKTtcclxuXHJcbiAgICAgICAgaWYgKGluZGV4ICE9PSBjdXJyZW50SW5kZXgpIHtcclxuICAgICAgICAgIGFkZENsYXNzKGVsLCAnaW5hY3RpdmUnKTtcclxuICAgICAgICAgIGFkZENsYXNzKGVsLCBpbmRleCA8IGN1cnJlbnRJbmRleCA/ICdiZWZvcmUnIDogJ2FmdGVyJyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGFkZENsYXNzKGVsLCAnYWN0aXZlJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcmVtb3ZlQ2xhc3MoZWwsIGNsYXNzTmFtZSkge1xyXG4gICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJhY2tkcm9wLScgKyBjbGFzc05hbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGFkZENsYXNzKGVsLCBjbGFzc05hbWUpIHtcclxuICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1iYWNrZHJvcC0nICsgY2xhc3NOYW1lKTtcclxuICAgIH1cclxuXHJcbiAgICBiYWNrZHJvcHMgPSBkZWNrLnNsaWRlc1xyXG4gICAgICAubWFwKGNyZWF0ZUJhY2tkcm9wRm9yU2xpZGUpO1xyXG5cclxuICAgIGRlY2sub24oJ2FjdGl2YXRlJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgIGJhY2tkcm9wcy5mb3JFYWNoKHVwZGF0ZUNsYXNzZXMpO1xyXG4gICAgfSk7XHJcbiAgfTtcclxufTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcclxuICAgIHZhciBhY3RpdmVTbGlkZUluZGV4LFxyXG4gICAgICBhY3RpdmVCdWxsZXRJbmRleCxcclxuXHJcbiAgICAgIGJ1bGxldHMgPSBkZWNrLnNsaWRlcy5tYXAoZnVuY3Rpb24oc2xpZGUpIHtcclxuICAgICAgICByZXR1cm4gW10uc2xpY2UuY2FsbChzbGlkZS5xdWVyeVNlbGVjdG9yQWxsKCh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogJ1tkYXRhLWJlc3Bva2UtYnVsbGV0XScpKSwgMCk7XHJcbiAgICAgIH0pLFxyXG5cclxuICAgICAgbmV4dCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBuZXh0U2xpZGVJbmRleCA9IGFjdGl2ZVNsaWRlSW5kZXggKyAxO1xyXG5cclxuICAgICAgICBpZiAoYWN0aXZlU2xpZGVIYXNCdWxsZXRCeU9mZnNldCgxKSkge1xyXG4gICAgICAgICAgYWN0aXZhdGVCdWxsZXQoYWN0aXZlU2xpZGVJbmRleCwgYWN0aXZlQnVsbGV0SW5kZXggKyAxKTtcclxuICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9IGVsc2UgaWYgKGJ1bGxldHNbbmV4dFNsaWRlSW5kZXhdKSB7XHJcbiAgICAgICAgICBhY3RpdmF0ZUJ1bGxldChuZXh0U2xpZGVJbmRleCwgMCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG5cclxuICAgICAgcHJldiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBwcmV2U2xpZGVJbmRleCA9IGFjdGl2ZVNsaWRlSW5kZXggLSAxO1xyXG5cclxuICAgICAgICBpZiAoYWN0aXZlU2xpZGVIYXNCdWxsZXRCeU9mZnNldCgtMSkpIHtcclxuICAgICAgICAgIGFjdGl2YXRlQnVsbGV0KGFjdGl2ZVNsaWRlSW5kZXgsIGFjdGl2ZUJ1bGxldEluZGV4IC0gMSk7XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSBlbHNlIGlmIChidWxsZXRzW3ByZXZTbGlkZUluZGV4XSkge1xyXG4gICAgICAgICAgYWN0aXZhdGVCdWxsZXQocHJldlNsaWRlSW5kZXgsIGJ1bGxldHNbcHJldlNsaWRlSW5kZXhdLmxlbmd0aCAtIDEpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuXHJcbiAgICAgIGFjdGl2YXRlQnVsbGV0ID0gZnVuY3Rpb24oc2xpZGVJbmRleCwgYnVsbGV0SW5kZXgpIHtcclxuICAgICAgICBhY3RpdmVTbGlkZUluZGV4ID0gc2xpZGVJbmRleDtcclxuICAgICAgICBhY3RpdmVCdWxsZXRJbmRleCA9IGJ1bGxldEluZGV4O1xyXG5cclxuICAgICAgICBidWxsZXRzLmZvckVhY2goZnVuY3Rpb24oc2xpZGUsIHMpIHtcclxuICAgICAgICAgIHNsaWRlLmZvckVhY2goZnVuY3Rpb24oYnVsbGV0LCBiKSB7XHJcbiAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJ1bGxldCcpO1xyXG5cclxuICAgICAgICAgICAgaWYgKHMgPCBzbGlkZUluZGV4IHx8IHMgPT09IHNsaWRlSW5kZXggJiYgYiA8PSBidWxsZXRJbmRleCkge1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJ1bGxldC1hY3RpdmUnKTtcclxuICAgICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LnJlbW92ZSgnYmVzcG9rZS1idWxsZXQtaW5hY3RpdmUnKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1idWxsZXQtaW5hY3RpdmUnKTtcclxuICAgICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LnJlbW92ZSgnYmVzcG9rZS1idWxsZXQtYWN0aXZlJyk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChzID09PSBzbGlkZUluZGV4ICYmIGIgPT09IGJ1bGxldEluZGV4KSB7XHJcbiAgICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYnVsbGV0LWN1cnJlbnQnKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LnJlbW92ZSgnYmVzcG9rZS1idWxsZXQtY3VycmVudCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgfSxcclxuXHJcbiAgICAgIGFjdGl2ZVNsaWRlSGFzQnVsbGV0QnlPZmZzZXQgPSBmdW5jdGlvbihvZmZzZXQpIHtcclxuICAgICAgICByZXR1cm4gYnVsbGV0c1thY3RpdmVTbGlkZUluZGV4XVthY3RpdmVCdWxsZXRJbmRleCArIG9mZnNldF0gIT09IHVuZGVmaW5lZDtcclxuICAgICAgfTtcclxuXHJcbiAgICBkZWNrLm9uKCduZXh0JywgbmV4dCk7XHJcbiAgICBkZWNrLm9uKCdwcmV2JywgcHJldik7XHJcblxyXG4gICAgZGVjay5vbignc2xpZGUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGFjdGl2YXRlQnVsbGV0KGUuaW5kZXgsIDApO1xyXG4gICAgfSk7XHJcblxyXG4gICAgYWN0aXZhdGVCdWxsZXQoMCwgMCk7XHJcbiAgfTtcclxufTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcclxuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xyXG4gICAgZGVjay5zbGlkZXMuZm9yRWFjaChmdW5jdGlvbihzbGlkZSkge1xyXG4gICAgICBzbGlkZS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmICgvSU5QVVR8VEVYVEFSRUF8U0VMRUNULy50ZXN0KGUudGFyZ2V0Lm5vZGVOYW1lKSB8fCBlLnRhcmdldC5jb250ZW50RWRpdGFibGUgPT09ICd0cnVlJykge1xyXG4gICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfTtcclxufTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcclxuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xyXG4gICAgdmFyIGFjdGl2YXRlU2xpZGUgPSBmdW5jdGlvbihpbmRleCkge1xyXG4gICAgICB2YXIgaW5kZXhUb0FjdGl2YXRlID0gLTEgPCBpbmRleCAmJiBpbmRleCA8IGRlY2suc2xpZGVzLmxlbmd0aCA/IGluZGV4IDogMDtcclxuICAgICAgaWYgKGluZGV4VG9BY3RpdmF0ZSAhPT0gZGVjay5zbGlkZSgpKSB7XHJcbiAgICAgICAgZGVjay5zbGlkZShpbmRleFRvQWN0aXZhdGUpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBwYXJzZUhhc2ggPSBmdW5jdGlvbigpIHtcclxuICAgICAgdmFyIGhhc2ggPSB3aW5kb3cubG9jYXRpb24uaGFzaC5zbGljZSgxKSxcclxuICAgICAgICBzbGlkZU51bWJlck9yTmFtZSA9IHBhcnNlSW50KGhhc2gsIDEwKTtcclxuXHJcbiAgICAgIGlmIChoYXNoKSB7XHJcbiAgICAgICAgaWYgKHNsaWRlTnVtYmVyT3JOYW1lKSB7XHJcbiAgICAgICAgICBhY3RpdmF0ZVNsaWRlKHNsaWRlTnVtYmVyT3JOYW1lIC0gMSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGRlY2suc2xpZGVzLmZvckVhY2goZnVuY3Rpb24oc2xpZGUsIGkpIHtcclxuICAgICAgICAgICAgaWYgKHNsaWRlLmdldEF0dHJpYnV0ZSgnZGF0YS1iZXNwb2tlLWhhc2gnKSA9PT0gaGFzaCB8fCBzbGlkZS5pZCA9PT0gaGFzaCkge1xyXG4gICAgICAgICAgICAgIGFjdGl2YXRlU2xpZGUoaSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICBwYXJzZUhhc2goKTtcclxuXHJcbiAgICAgIGRlY2sub24oJ2FjdGl2YXRlJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIHZhciBzbGlkZU5hbWUgPSBlLnNsaWRlLmdldEF0dHJpYnV0ZSgnZGF0YS1iZXNwb2tlLWhhc2gnKSB8fCBlLnNsaWRlLmlkO1xyXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gc2xpZGVOYW1lIHx8IGUuaW5kZXggKyAxO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdoYXNoY2hhbmdlJywgcGFyc2VIYXNoKTtcclxuICAgIH0sIDApO1xyXG4gIH07XHJcbn07XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICB2YXIgaXNIb3Jpem9udGFsID0gb3B0aW9ucyAhPT0gJ3ZlcnRpY2FsJztcclxuXHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICBpZiAoZS53aGljaCA9PSAzNCB8fCAvLyBQQUdFIERPV05cclxuICAgICAgICAoZS53aGljaCA9PSAzMiAmJiAhZS5zaGlmdEtleSkgfHwgLy8gU1BBQ0UgV0lUSE9VVCBTSElGVFxyXG4gICAgICAgIChpc0hvcml6b250YWwgJiYgZS53aGljaCA9PSAzOSkgfHwgLy8gUklHSFRcclxuICAgICAgICAoIWlzSG9yaXpvbnRhbCAmJiBlLndoaWNoID09IDQwKSAvLyBET1dOXHJcbiAgICAgICkgeyBkZWNrLm5leHQoKTsgfVxyXG5cclxuICAgICAgaWYgKGUud2hpY2ggPT0gMzMgfHwgLy8gUEFHRSBVUFxyXG4gICAgICAgIChlLndoaWNoID09IDMyICYmIGUuc2hpZnRLZXkpIHx8IC8vIFNQQUNFICsgU0hJRlRcclxuICAgICAgICAoaXNIb3Jpem9udGFsICYmIGUud2hpY2ggPT0gMzcpIHx8IC8vIExFRlRcclxuICAgICAgICAoIWlzSG9yaXpvbnRhbCAmJiBlLndoaWNoID09IDM4KSAvLyBVUFxyXG4gICAgICApIHsgZGVjay5wcmV2KCk7IH1cclxuICAgIH0pO1xyXG4gIH07XHJcbn07XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xyXG4gIHJldHVybiBmdW5jdGlvbiAoZGVjaykge1xyXG4gICAgdmFyIHByb2dyZXNzUGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXHJcbiAgICAgIHByb2dyZXNzQmFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXHJcbiAgICAgIHByb3AgPSBvcHRpb25zID09PSAndmVydGljYWwnID8gJ2hlaWdodCcgOiAnd2lkdGgnO1xyXG5cclxuICAgIHByb2dyZXNzUGFyZW50LmNsYXNzTmFtZSA9ICdiZXNwb2tlLXByb2dyZXNzLXBhcmVudCc7XHJcbiAgICBwcm9ncmVzc0Jhci5jbGFzc05hbWUgPSAnYmVzcG9rZS1wcm9ncmVzcy1iYXInO1xyXG4gICAgcHJvZ3Jlc3NQYXJlbnQuYXBwZW5kQ2hpbGQocHJvZ3Jlc3NCYXIpO1xyXG4gICAgZGVjay5wYXJlbnQuYXBwZW5kQ2hpbGQocHJvZ3Jlc3NQYXJlbnQpO1xyXG5cclxuICAgIGRlY2sub24oJ2FjdGl2YXRlJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICBwcm9ncmVzc0Jhci5zdHlsZVtwcm9wXSA9IChlLmluZGV4ICogMTAwIC8gKGRlY2suc2xpZGVzLmxlbmd0aCAtIDEpKSArICclJztcclxuICAgIH0pO1xyXG4gIH07XHJcbn07XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICB2YXIgcGFyZW50ID0gZGVjay5wYXJlbnQsXHJcbiAgICAgIGZpcnN0U2xpZGUgPSBkZWNrLnNsaWRlc1swXSxcclxuICAgICAgc2xpZGVIZWlnaHQgPSBmaXJzdFNsaWRlLm9mZnNldEhlaWdodCxcclxuICAgICAgc2xpZGVXaWR0aCA9IGZpcnN0U2xpZGUub2Zmc2V0V2lkdGgsXHJcbiAgICAgIHVzZVpvb20gPSBvcHRpb25zID09PSAnem9vbScgfHwgKCd6b29tJyBpbiBwYXJlbnQuc3R5bGUgJiYgb3B0aW9ucyAhPT0gJ3RyYW5zZm9ybScpLFxyXG5cclxuICAgICAgd3JhcCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcclxuICAgICAgICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gJ2Jlc3Bva2Utc2NhbGUtcGFyZW50JztcclxuICAgICAgICBlbGVtZW50LnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHdyYXBwZXIsIGVsZW1lbnQpO1xyXG4gICAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XHJcbiAgICAgICAgcmV0dXJuIHdyYXBwZXI7XHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBlbGVtZW50cyA9IHVzZVpvb20gPyBkZWNrLnNsaWRlcyA6IGRlY2suc2xpZGVzLm1hcCh3cmFwKSxcclxuXHJcbiAgICAgIHRyYW5zZm9ybVByb3BlcnR5ID0gKGZ1bmN0aW9uKHByb3BlcnR5KSB7XHJcbiAgICAgICAgdmFyIHByZWZpeGVzID0gJ01veiBXZWJraXQgTyBtcycuc3BsaXQoJyAnKTtcclxuICAgICAgICByZXR1cm4gcHJlZml4ZXMucmVkdWNlKGZ1bmN0aW9uKGN1cnJlbnRQcm9wZXJ0eSwgcHJlZml4KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwcmVmaXggKyBwcm9wZXJ0eSBpbiBwYXJlbnQuc3R5bGUgPyBwcmVmaXggKyBwcm9wZXJ0eSA6IGN1cnJlbnRQcm9wZXJ0eTtcclxuICAgICAgICAgIH0sIHByb3BlcnR5LnRvTG93ZXJDYXNlKCkpO1xyXG4gICAgICB9KCdUcmFuc2Zvcm0nKSksXHJcblxyXG4gICAgICBzY2FsZSA9IHVzZVpvb20gP1xyXG4gICAgICAgIGZ1bmN0aW9uKHJhdGlvLCBlbGVtZW50KSB7XHJcbiAgICAgICAgICBlbGVtZW50LnN0eWxlLnpvb20gPSByYXRpbztcclxuICAgICAgICB9IDpcclxuICAgICAgICBmdW5jdGlvbihyYXRpbywgZWxlbWVudCkge1xyXG4gICAgICAgICAgZWxlbWVudC5zdHlsZVt0cmFuc2Zvcm1Qcm9wZXJ0eV0gPSAnc2NhbGUoJyArIHJhdGlvICsgJyknO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICBzY2FsZUFsbCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciB4U2NhbGUgPSBwYXJlbnQub2Zmc2V0V2lkdGggLyBzbGlkZVdpZHRoLFxyXG4gICAgICAgICAgeVNjYWxlID0gcGFyZW50Lm9mZnNldEhlaWdodCAvIHNsaWRlSGVpZ2h0O1xyXG5cclxuICAgICAgICBlbGVtZW50cy5mb3JFYWNoKHNjYWxlLmJpbmQobnVsbCwgTWF0aC5taW4oeFNjYWxlLCB5U2NhbGUpKSk7XHJcbiAgICAgIH07XHJcblxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIHNjYWxlQWxsKTtcclxuICAgIHNjYWxlQWxsKCk7XHJcbiAgfTtcclxuXHJcbn07XHJcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbi8qISBiZXNwb2tlLXRoZW1lLWF0b21hbnRpYyB2Mi4xLjQgwqkgMjAxNiBBZGFtIEVpdnksIE1JVCBMaWNlbnNlICovXHJcbiFmdW5jdGlvbih0KXtpZihcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cyYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIG1vZHVsZSltb2R1bGUuZXhwb3J0cz10KCk7ZWxzZSBpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQpZGVmaW5lKFtdLHQpO2Vsc2V7dmFyIGU7ZT1cInVuZGVmaW5lZFwiIT10eXBlb2Ygd2luZG93P3dpbmRvdzpcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP2dsb2JhbDpcInVuZGVmaW5lZFwiIT10eXBlb2Ygc2VsZj9zZWxmOnRoaXMsZT1lLmJlc3Bva2V8fChlLmJlc3Bva2U9e30pLGU9ZS50aGVtZXN8fChlLnRoZW1lcz17fSksZS5hdG9tYW50aWM9dCgpfX0oZnVuY3Rpb24oKXtyZXR1cm4gZnVuY3Rpb24gdChlLGEsbil7ZnVuY3Rpb24gbyhpLHMpe2lmKCFhW2ldKXtpZighZVtpXSl7dmFyIG09XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighcyYmbSlyZXR1cm4gbShpLCEwKTtpZihyKXJldHVybiByKGksITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIHA9YVtpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbih0KXt2YXIgYT1lW2ldWzFdW3RdO3JldHVybiBvKGE/YTp0KX0scCxwLmV4cG9ydHMsdCxlLGEsbil9cmV0dXJuIGFbaV0uZXhwb3J0c31mb3IodmFyIHI9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTxuLmxlbmd0aDtpKyspbyhuW2ldKTtyZXR1cm4gb30oezE6W2Z1bmN0aW9uKHQsZSxhKXt2YXIgbj10KFwiYmVzcG9rZS1jbGFzc2VzXCIpLG89dChcImluc2VydC1jc3NcIikscj1mdW5jdGlvbih0KXt2YXIgZT10LnNsaWRlcy5tYXAoZnVuY3Rpb24odCl7cmV0dXJuW10uc2xpY2UuY2FsbCh0LnF1ZXJ5U2VsZWN0b3JBbGwoXCJ4LWdpZlwiKSwwKX0pLGE9ZnVuY3Rpb24odCl7cmV0dXJuIGZ1bmN0aW9uKGEpe2VbYS5pbmRleF0ubWFwKGZ1bmN0aW9uKGUpe3Q/ZS5zZXRBdHRyaWJ1dGUoXCJzdG9wcGVkXCIsXCJcIik6ZS5yZW1vdmVBdHRyaWJ1dGUoXCJzdG9wcGVkXCIpLGEuc2xpZGUuY2xhc3NMaXN0LnJlbW92ZShcIngtZ2lmLWZpbmlzaGVkXCIpLHR8fGUuYWRkRXZlbnRMaXN0ZW5lcihcIngtZ2lmLWZpbmlzaGVkXCIsZnVuY3Rpb24oKXthLnNsaWRlLmNsYXNzTGlzdC5hZGQoXCJ4LWdpZi1maW5pc2hlZFwiKX0pfSl9fTt0Lm9uKFwiYWN0aXZhdGVcIixhKCExKSksdC5vbihcImRlYWN0aXZhdGVcIixhKCEwKSl9LHM9ZnVuY3Rpb24odCl7dC5vbihcImFjdGl2YXRlXCIsZnVuY3Rpb24odCl7QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCh0LnNsaWRlLnF1ZXJ5U2VsZWN0b3JBbGwoXCIuYW5pbWF0ZWRcIil8fFtdLGZ1bmN0aW9uKHQpe3Qub3V0ZXJIVE1MPXQub3V0ZXJIVE1MLnJlcGxhY2UoXCJhbmltYXRlZFwiLFwiYW5pbWF0ZSBhbmltYXRlZFwiKX0pfSl9O2lmKGUuZXhwb3J0cz1mdW5jdGlvbigpe3ZhciB0PVwiLyohIG5vcm1hbGl6ZS5jc3MgdjMuMC4wIHwgTUlUIExpY2Vuc2UgfCBnaXQuaW8vbm9ybWFsaXplICovXFxuaHRtbHtmb250LWZhbWlseTpzYW5zLXNlcmlmOy1tcy10ZXh0LXNpemUtYWRqdXN0OjEwMCU7LXdlYmtpdC10ZXh0LXNpemUtYWRqdXN0OjEwMCV9Ym9keXttYXJnaW46MH1hcnRpY2xlLGFzaWRlLGRldGFpbHMsZmlnY2FwdGlvbixmaWd1cmUsZm9vdGVyLGhlYWRlcixoZ3JvdXAsbWFpbixuYXYsc2VjdGlvbixzdW1tYXJ5e2Rpc3BsYXk6YmxvY2t9YXVkaW8sY2FudmFzLHByb2dyZXNzLHZpZGVve2Rpc3BsYXk6aW5saW5lLWJsb2NrO3ZlcnRpY2FsLWFsaWduOmJhc2VsaW5lfWF1ZGlvOm5vdChbY29udHJvbHNdKXtkaXNwbGF5Om5vbmU7aGVpZ2h0OjB9W2hpZGRlbl0sdGVtcGxhdGV7ZGlzcGxheTpub25lfWF7YmFja2dyb3VuZDowIDB9YTphY3RpdmUsYTpob3ZlcntvdXRsaW5lOjB9YWJiclt0aXRsZV17Ym9yZGVyLWJvdHRvbToxcHggZG90dGVkfWIsc3Ryb25ne2ZvbnQtd2VpZ2h0OjcwMH1kZm57Zm9udC1zdHlsZTppdGFsaWN9aDF7Zm9udC1zaXplOjJlbTttYXJnaW46LjY3ZW0gMH1tYXJre2JhY2tncm91bmQ6I2ZmMDtjb2xvcjojMDAwfXNtYWxse2ZvbnQtc2l6ZTo4MCV9c3ViLHN1cHtmb250LXNpemU6NzUlO2xpbmUtaGVpZ2h0OjA7cG9zaXRpb246cmVsYXRpdmU7dmVydGljYWwtYWxpZ246YmFzZWxpbmV9c3Vwe3RvcDotLjVlbX1zdWJ7Ym90dG9tOi0uMjVlbX1pbWd7Ym9yZGVyOjB9c3ZnOm5vdCg6cm9vdCl7b3ZlcmZsb3c6aGlkZGVufWZpZ3VyZXttYXJnaW46MWVtIDQwcHh9aHJ7Ym94LXNpemluZzpjb250ZW50LWJveDtoZWlnaHQ6MH1wcmV7b3ZlcmZsb3c6YXV0b31jb2RlLGtiZCxwcmUsc2FtcHtmb250LWZhbWlseTptb25vc3BhY2UsbW9ub3NwYWNlO2ZvbnQtc2l6ZToxZW19YnV0dG9uLGlucHV0LG9wdGdyb3VwLHNlbGVjdCx0ZXh0YXJlYXtjb2xvcjppbmhlcml0O2ZvbnQ6aW5oZXJpdDttYXJnaW46MH1idXR0b257b3ZlcmZsb3c6dmlzaWJsZX1idXR0b24sc2VsZWN0e3RleHQtdHJhbnNmb3JtOm5vbmV9YnV0dG9uLGh0bWwgaW5wdXRbdHlwZT1idXR0b25dLGlucHV0W3R5cGU9cmVzZXRdLGlucHV0W3R5cGU9c3VibWl0XXstd2Via2l0LWFwcGVhcmFuY2U6YnV0dG9uO2N1cnNvcjpwb2ludGVyfWJ1dHRvbltkaXNhYmxlZF0saHRtbCBpbnB1dFtkaXNhYmxlZF17Y3Vyc29yOmRlZmF1bHR9YnV0dG9uOjotbW96LWZvY3VzLWlubmVyLGlucHV0OjotbW96LWZvY3VzLWlubmVye2JvcmRlcjowO3BhZGRpbmc6MH1pbnB1dHtsaW5lLWhlaWdodDpub3JtYWx9aW5wdXRbdHlwZT1jaGVja2JveF0saW5wdXRbdHlwZT1yYWRpb117Ym94LXNpemluZzpib3JkZXItYm94O3BhZGRpbmc6MH1pbnB1dFt0eXBlPW51bWJlcl06Oi13ZWJraXQtaW5uZXItc3Bpbi1idXR0b24saW5wdXRbdHlwZT1udW1iZXJdOjotd2Via2l0LW91dGVyLXNwaW4tYnV0dG9ue2hlaWdodDphdXRvfWlucHV0W3R5cGU9c2VhcmNoXXstd2Via2l0LWFwcGVhcmFuY2U6dGV4dGZpZWxkO2JveC1zaXppbmc6Y29udGVudC1ib3h9aW5wdXRbdHlwZT1zZWFyY2hdOjotd2Via2l0LXNlYXJjaC1jYW5jZWwtYnV0dG9uLGlucHV0W3R5cGU9c2VhcmNoXTo6LXdlYmtpdC1zZWFyY2gtZGVjb3JhdGlvbnstd2Via2l0LWFwcGVhcmFuY2U6bm9uZX1maWVsZHNldHtib3JkZXI6MXB4IHNvbGlkIHNpbHZlcjttYXJnaW46MCAycHg7cGFkZGluZzouMzVlbSAuNjI1ZW0gLjc1ZW19bGVnZW5ke2JvcmRlcjowfXRleHRhcmVhe292ZXJmbG93OmF1dG99b3B0Z3JvdXB7Zm9udC13ZWlnaHQ6NzAwfXRhYmxle2JvcmRlci1jb2xsYXBzZTpjb2xsYXBzZTtib3JkZXItc3BhY2luZzowfWxlZ2VuZCx0ZCx0aHtwYWRkaW5nOjB9XFxuLyohXFxuICogYW5pbWF0ZS5jc3MgLWh0dHA6Ly9kYW5lZGVuLm1lL2FuaW1hdGVcXG4gKiBWZXJzaW9uIC0gMy41LjFcXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UgLSBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUXFxuICpcXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTYgRGFuaWVsIEVkZW5cXG4gKi9cXG4uYW5pbWF0ZWR7YW5pbWF0aW9uLWR1cmF0aW9uOjFzO2FuaW1hdGlvbi1maWxsLW1vZGU6Ym90aH0uYW5pbWF0ZWQuaW5maW5pdGV7YW5pbWF0aW9uLWl0ZXJhdGlvbi1jb3VudDppbmZpbml0ZX0uYW5pbWF0ZWQuaGluZ2V7YW5pbWF0aW9uLWR1cmF0aW9uOjJzfS5hbmltYXRlZC5ib3VuY2VJbiwuYW5pbWF0ZWQuYm91bmNlT3V0LC5hbmltYXRlZC5mbGlwT3V0WCwuYW5pbWF0ZWQuZmxpcE91dFl7YW5pbWF0aW9uLWR1cmF0aW9uOi43NXN9QGtleWZyYW1lcyBib3VuY2V7MCUsMjAlLDUzJSw4MCUsdG97YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjIxNSwuNjEsLjM1NSwxKTt0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX00MCUsNDMle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLC0zMHB4LDApfTQwJSw0MyUsNzAle2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC43NTUsLjA1LC44NTUsLjA2KX03MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTE1cHgsMCl9OTAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLC00cHgsMCl9fS5ib3VuY2V7YW5pbWF0aW9uLW5hbWU6Ym91bmNlO3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyIGJvdHRvbX1Aa2V5ZnJhbWVzIGZsYXNoezAlLDUwJSx0b3tvcGFjaXR5OjF9MjUlLDc1JXtvcGFjaXR5OjB9fS5mbGFzaHthbmltYXRpb24tbmFtZTpmbGFzaH1Aa2V5ZnJhbWVzIHB1bHNlezAlLHRve3RyYW5zZm9ybTpzY2FsZVgoMSl9NTAle3RyYW5zZm9ybTpzY2FsZTNkKDEuMDUsMS4wNSwxLjA1KX19LnB1bHNle2FuaW1hdGlvbi1uYW1lOnB1bHNlfUBrZXlmcmFtZXMgcnViYmVyQmFuZHswJSx0b3t0cmFuc2Zvcm06c2NhbGVYKDEpfTMwJXt0cmFuc2Zvcm06c2NhbGUzZCgxLjI1LC43NSwxKX00MCV7dHJhbnNmb3JtOnNjYWxlM2QoLjc1LDEuMjUsMSl9NTAle3RyYW5zZm9ybTpzY2FsZTNkKDEuMTUsLjg1LDEpfTY1JXt0cmFuc2Zvcm06c2NhbGUzZCguOTUsMS4wNSwxKX03NSV7dHJhbnNmb3JtOnNjYWxlM2QoMS4wNSwuOTUsMSl9fS5ydWJiZXJCYW5ke2FuaW1hdGlvbi1uYW1lOnJ1YmJlckJhbmR9QGtleWZyYW1lcyBzaGFrZXswJSx0b3t0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX0xMCUsMzAlLDUwJSw3MCUsOTAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMTBweCwwLDApfTIwJSw0MCUsNjAlLDgwJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTBweCwwLDApfX0uc2hha2V7YW5pbWF0aW9uLW5hbWU6c2hha2V9QGtleWZyYW1lcyBoZWFkU2hha2V7MCUsNTAle3RyYW5zZm9ybTp0cmFuc2xhdGVYKDApfTYuNSV7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTZweCkgcm90YXRlWSgtOWRlZyl9MTguNSV7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoNXB4KSByb3RhdGVZKDdkZWcpfTMxLjUle3RyYW5zZm9ybTp0cmFuc2xhdGVYKC0zcHgpIHJvdGF0ZVkoLTVkZWcpfTQzLjUle3RyYW5zZm9ybTp0cmFuc2xhdGVYKDJweCkgcm90YXRlWSgzZGVnKX19LmhlYWRTaGFrZXthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmVhc2UtaW4tb3V0O2FuaW1hdGlvbi1uYW1lOmhlYWRTaGFrZX1Aa2V5ZnJhbWVzIHN3aW5nezIwJXt0cmFuc2Zvcm06cm90YXRlKDE1ZGVnKX00MCV7dHJhbnNmb3JtOnJvdGF0ZSgtMTBkZWcpfTYwJXt0cmFuc2Zvcm06cm90YXRlKDVkZWcpfTgwJXt0cmFuc2Zvcm06cm90YXRlKC01ZGVnKX10b3t0cmFuc2Zvcm06cm90YXRlKDBkZWcpfX0uc3dpbmd7dHJhbnNmb3JtLW9yaWdpbjp0b3AgY2VudGVyO2FuaW1hdGlvbi1uYW1lOnN3aW5nfUBrZXlmcmFtZXMgdGFkYXswJSx0b3t0cmFuc2Zvcm06c2NhbGVYKDEpfTEwJSwyMCV7dHJhbnNmb3JtOnNjYWxlM2QoLjksLjksLjkpIHJvdGF0ZSgtM2RlZyl9MzAlLDUwJSw3MCUsOTAle3RyYW5zZm9ybTpzY2FsZTNkKDEuMSwxLjEsMS4xKSByb3RhdGUoM2RlZyl9NDAlLDYwJSw4MCV7dHJhbnNmb3JtOnNjYWxlM2QoMS4xLDEuMSwxLjEpIHJvdGF0ZSgtM2RlZyl9fS50YWRhe2FuaW1hdGlvbi1uYW1lOnRhZGF9QGtleWZyYW1lcyB3b2JibGV7MCUsdG97dHJhbnNmb3JtOm5vbmV9MTUle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMjUlLDAsMCkgcm90YXRlKC01ZGVnKX0zMCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDIwJSwwLDApIHJvdGF0ZSgzZGVnKX00NSV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xNSUsMCwwKSByb3RhdGUoLTNkZWcpfTYwJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTAlLDAsMCkgcm90YXRlKDJkZWcpfTc1JXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTUlLDAsMCkgcm90YXRlKC0xZGVnKX19LndvYmJsZXthbmltYXRpb24tbmFtZTp3b2JibGV9QGtleWZyYW1lcyBqZWxsb3swJSwxMS4xJSx0b3t0cmFuc2Zvcm06bm9uZX0yMi4yJXt0cmFuc2Zvcm06c2tld1goLTEyLjVkZWcpIHNrZXdZKC0xMi41ZGVnKX0zMy4zJXt0cmFuc2Zvcm06c2tld1goNi4yNWRlZykgc2tld1koNi4yNWRlZyl9NDQuNCV7dHJhbnNmb3JtOnNrZXdYKC0zLjEyNWRlZykgc2tld1koLTMuMTI1ZGVnKX01NS41JXt0cmFuc2Zvcm06c2tld1goMS41NjI1ZGVnKSBza2V3WSgxLjU2MjVkZWcpfTY2LjYle3RyYW5zZm9ybTpza2V3WCgtLjc4MTI1ZGVnKSBza2V3WSgtLjc4MTI1ZGVnKX03Ny43JXt0cmFuc2Zvcm06c2tld1goLjM5MDYyNWRlZykgc2tld1koLjM5MDYyNWRlZyl9ODguOCV7dHJhbnNmb3JtOnNrZXdYKC0uMTk1MzEyNWRlZykgc2tld1koLS4xOTUzMTI1ZGVnKX19LmplbGxve2FuaW1hdGlvbi1uYW1lOmplbGxvO3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyfUBrZXlmcmFtZXMgYm91bmNlSW57MCUsMjAlLDQwJSw2MCUsODAlLHRve2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4yMTUsLjYxLC4zNTUsMSl9MCV7b3BhY2l0eTowO3RyYW5zZm9ybTpzY2FsZTNkKC4zLC4zLC4zKX0yMCV7dHJhbnNmb3JtOnNjYWxlM2QoMS4xLDEuMSwxLjEpfTQwJXt0cmFuc2Zvcm06c2NhbGUzZCguOSwuOSwuOSl9NjAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCgxLjAzLDEuMDMsMS4wMyl9ODAle3RyYW5zZm9ybTpzY2FsZTNkKC45NywuOTcsLjk3KX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOnNjYWxlWCgxKX19LmJvdW5jZUlue2FuaW1hdGlvbi1uYW1lOmJvdW5jZUlufUBrZXlmcmFtZXMgYm91bmNlSW5Eb3duezAlLDYwJSw3NSUsOTAlLHRve2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4yMTUsLjYxLC4zNTUsMSl9MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLC0zMDAwcHgsMCl9NjAle29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwyNXB4LDApfTc1JXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMTBweCwwKX05MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsNXB4LDApfXRve3RyYW5zZm9ybTpub25lfX0uYm91bmNlSW5Eb3due2FuaW1hdGlvbi1uYW1lOmJvdW5jZUluRG93bn1Aa2V5ZnJhbWVzIGJvdW5jZUluTGVmdHswJSw2MCUsNzUlLDkwJSx0b3thbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguMjE1LC42MSwuMzU1LDEpfTAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTMwMDBweCwwLDApfTYwJXtvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDI1cHgsMCwwKX03NSV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xMHB4LDAsMCl9OTAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCg1cHgsMCwwKX10b3t0cmFuc2Zvcm06bm9uZX19LmJvdW5jZUluTGVmdHthbmltYXRpb24tbmFtZTpib3VuY2VJbkxlZnR9QGtleWZyYW1lcyBib3VuY2VJblJpZ2h0ezAlLDYwJSw3NSUsOTAlLHRve2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4yMTUsLjYxLC4zNTUsMSl9MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgzMDAwcHgsMCwwKX02MCV7b3BhY2l0eToxO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMjVweCwwLDApfTc1JXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTBweCwwLDApfTkwJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTVweCwwLDApfXRve3RyYW5zZm9ybTpub25lfX0uYm91bmNlSW5SaWdodHthbmltYXRpb24tbmFtZTpib3VuY2VJblJpZ2h0fUBrZXlmcmFtZXMgYm91bmNlSW5VcHswJSw2MCUsNzUlLDkwJSx0b3thbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguMjE1LC42MSwuMzU1LDEpfTAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwzMDAwcHgsMCl9NjAle29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMjBweCwwKX03NSV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMTBweCwwKX05MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTVweCwwKX10b3t0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX19LmJvdW5jZUluVXB7YW5pbWF0aW9uLW5hbWU6Ym91bmNlSW5VcH1Aa2V5ZnJhbWVzIGJvdW5jZU91dHsyMCV7dHJhbnNmb3JtOnNjYWxlM2QoLjksLjksLjkpfTUwJSw1NSV7b3BhY2l0eToxO3RyYW5zZm9ybTpzY2FsZTNkKDEuMSwxLjEsMS4xKX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlM2QoLjMsLjMsLjMpfX0uYm91bmNlT3V0e2FuaW1hdGlvbi1uYW1lOmJvdW5jZU91dH1Aa2V5ZnJhbWVzIGJvdW5jZU91dERvd257MjAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDEwcHgsMCl9NDAlLDQ1JXtvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTIwcHgsMCl9dG97b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDIwMDBweCwwKX19LmJvdW5jZU91dERvd257YW5pbWF0aW9uLW5hbWU6Ym91bmNlT3V0RG93bn1Aa2V5ZnJhbWVzIGJvdW5jZU91dExlZnR7MjAle29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMjBweCwwLDApfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTIwMDBweCwwLDApfX0uYm91bmNlT3V0TGVmdHthbmltYXRpb24tbmFtZTpib3VuY2VPdXRMZWZ0fUBrZXlmcmFtZXMgYm91bmNlT3V0UmlnaHR7MjAle29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTIwcHgsMCwwKX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDIwMDBweCwwLDApfX0uYm91bmNlT3V0UmlnaHR7YW5pbWF0aW9uLW5hbWU6Ym91bmNlT3V0UmlnaHR9QGtleWZyYW1lcyBib3VuY2VPdXRVcHsyMCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTEwcHgsMCl9NDAlLDQ1JXtvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMjBweCwwKX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTIwMDBweCwwKX19LmJvdW5jZU91dFVwe2FuaW1hdGlvbi1uYW1lOmJvdW5jZU91dFVwfUBrZXlmcmFtZXMgZmFkZUluezAle29wYWNpdHk6MH10b3tvcGFjaXR5OjF9fS5mYWRlSW57YW5pbWF0aW9uLW5hbWU6ZmFkZUlufUBrZXlmcmFtZXMgZmFkZUluRG93bnswJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTEwMCUsMCl9dG97b3BhY2l0eToxO3RyYW5zZm9ybTpub25lfX0uZmFkZUluRG93bnthbmltYXRpb24tbmFtZTpmYWRlSW5Eb3dufUBrZXlmcmFtZXMgZmFkZUluRG93bkJpZ3swJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTIwMDBweCwwKX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9fS5mYWRlSW5Eb3duQmlne2FuaW1hdGlvbi1uYW1lOmZhZGVJbkRvd25CaWd9QGtleWZyYW1lcyBmYWRlSW5MZWZ0ezAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTEwMCUsMCwwKX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9fS5mYWRlSW5MZWZ0e2FuaW1hdGlvbi1uYW1lOmZhZGVJbkxlZnR9QGtleWZyYW1lcyBmYWRlSW5MZWZ0QmlnezAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTIwMDBweCwwLDApfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX19LmZhZGVJbkxlZnRCaWd7YW5pbWF0aW9uLW5hbWU6ZmFkZUluTGVmdEJpZ31Aa2V5ZnJhbWVzIGZhZGVJblJpZ2h0ezAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTAwJSwwLDApfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX19LmZhZGVJblJpZ2h0e2FuaW1hdGlvbi1uYW1lOmZhZGVJblJpZ2h0fUBrZXlmcmFtZXMgZmFkZUluUmlnaHRCaWd7MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgyMDAwcHgsMCwwKX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9fS5mYWRlSW5SaWdodEJpZ3thbmltYXRpb24tbmFtZTpmYWRlSW5SaWdodEJpZ31Aa2V5ZnJhbWVzIGZhZGVJblVwezAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwxMDAlLDApfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX19LmZhZGVJblVwe2FuaW1hdGlvbi1uYW1lOmZhZGVJblVwfUBrZXlmcmFtZXMgZmFkZUluVXBCaWd7MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDIwMDBweCwwKX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9fS5mYWRlSW5VcEJpZ3thbmltYXRpb24tbmFtZTpmYWRlSW5VcEJpZ31Aa2V5ZnJhbWVzIGZhZGVPdXR7MCV7b3BhY2l0eToxfXRve29wYWNpdHk6MH19LmZhZGVPdXR7YW5pbWF0aW9uLW5hbWU6ZmFkZU91dH1Aa2V5ZnJhbWVzIGZhZGVPdXREb3duezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMTAwJSwwKX19LmZhZGVPdXREb3due2FuaW1hdGlvbi1uYW1lOmZhZGVPdXREb3dufUBrZXlmcmFtZXMgZmFkZU91dERvd25CaWd7MCV7b3BhY2l0eToxfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwyMDAwcHgsMCl9fS5mYWRlT3V0RG93bkJpZ3thbmltYXRpb24tbmFtZTpmYWRlT3V0RG93bkJpZ31Aa2V5ZnJhbWVzIGZhZGVPdXRMZWZ0ezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xMDAlLDAsMCl9fS5mYWRlT3V0TGVmdHthbmltYXRpb24tbmFtZTpmYWRlT3V0TGVmdH1Aa2V5ZnJhbWVzIGZhZGVPdXRMZWZ0QmlnezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0yMDAwcHgsMCwwKX19LmZhZGVPdXRMZWZ0Qmlne2FuaW1hdGlvbi1uYW1lOmZhZGVPdXRMZWZ0QmlnfUBrZXlmcmFtZXMgZmFkZU91dFJpZ2h0ezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDEwMCUsMCwwKX19LmZhZGVPdXRSaWdodHthbmltYXRpb24tbmFtZTpmYWRlT3V0UmlnaHR9QGtleWZyYW1lcyBmYWRlT3V0UmlnaHRCaWd7MCV7b3BhY2l0eToxfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMjAwMHB4LDAsMCl9fS5mYWRlT3V0UmlnaHRCaWd7YW5pbWF0aW9uLW5hbWU6ZmFkZU91dFJpZ2h0QmlnfUBrZXlmcmFtZXMgZmFkZU91dFVwezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTEwMCUsMCl9fS5mYWRlT3V0VXB7YW5pbWF0aW9uLW5hbWU6ZmFkZU91dFVwfUBrZXlmcmFtZXMgZmFkZU91dFVwQmlnezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTIwMDBweCwwKX19LmZhZGVPdXRVcEJpZ3thbmltYXRpb24tbmFtZTpmYWRlT3V0VXBCaWd9QGtleWZyYW1lcyBmbGlwezAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWSgtMXR1cm4pO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1vdXR9NDAle2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1vdXQ7dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSB0cmFuc2xhdGVaKDE1MHB4KSByb3RhdGVZKC0xOTBkZWcpfTUwJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHRyYW5zbGF0ZVooMTUwcHgpIHJvdGF0ZVkoLTE3MGRlZyk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWlufTgwJXthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmVhc2UtaW47dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSBzY2FsZTNkKC45NSwuOTUsLjk1KX10b3t0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbn19LmFuaW1hdGVkLmZsaXB7LXdlYmtpdC1iYWNrZmFjZS12aXNpYmlsaXR5OnZpc2libGU7YmFja2ZhY2UtdmlzaWJpbGl0eTp2aXNpYmxlO2FuaW1hdGlvbi1uYW1lOmZsaXB9QGtleWZyYW1lcyBmbGlwSW5YezAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWCg5MGRlZyk7b3BhY2l0eTowO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbn00MCV7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWluO3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWCgtMjBkZWcpfTYwJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHJvdGF0ZVgoMTBkZWcpO29wYWNpdHk6MX04MCV7dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVYKC01ZGVnKX10b3t0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpfX0uZmxpcEluWCwuZmxpcEluWSwuZmxpcE91dFgsLmZsaXBPdXRZey13ZWJraXQtYmFja2ZhY2UtdmlzaWJpbGl0eTp2aXNpYmxlIWltcG9ydGFudDtiYWNrZmFjZS12aXNpYmlsaXR5OnZpc2libGUhaW1wb3J0YW50O2FuaW1hdGlvbi1uYW1lOmZsaXBJblh9QGtleWZyYW1lcyBmbGlwSW5ZezAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWSg5MGRlZyk7b3BhY2l0eTowO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbn00MCV7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWluO3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWSgtMjBkZWcpfTYwJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHJvdGF0ZVkoMTBkZWcpO29wYWNpdHk6MX04MCV7dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVZKC01ZGVnKX10b3t0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpfX0uZmxpcEluWSwuZmxpcE91dFgsLmZsaXBPdXRZe2FuaW1hdGlvbi1uYW1lOmZsaXBJbll9QGtleWZyYW1lcyBmbGlwT3V0WHswJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpfTMwJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHJvdGF0ZVgoLTIwZGVnKTtvcGFjaXR5OjF9dG97dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVYKDkwZGVnKTtvcGFjaXR5OjB9fS5mbGlwT3V0WCwuZmxpcE91dFl7YW5pbWF0aW9uLW5hbWU6ZmxpcE91dFh9QGtleWZyYW1lcyBmbGlwT3V0WXswJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpfTMwJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHJvdGF0ZVkoLTE1ZGVnKTtvcGFjaXR5OjF9dG97dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVZKDkwZGVnKTtvcGFjaXR5OjB9fS5mbGlwT3V0WXthbmltYXRpb24tbmFtZTpmbGlwT3V0WX1Aa2V5ZnJhbWVzIGxpZ2h0U3BlZWRJbnswJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTAwJSwwLDApIHNrZXdYKC0zMGRlZyk7b3BhY2l0eTowfTYwJXt0cmFuc2Zvcm06c2tld1goMjBkZWcpO29wYWNpdHk6MX04MCV7b3BhY2l0eToxO3RyYW5zZm9ybTpza2V3WCgtNWRlZyl9dG97dHJhbnNmb3JtOm5vbmU7b3BhY2l0eToxfX0ubGlnaHRTcGVlZElue2FuaW1hdGlvbi1uYW1lOmxpZ2h0U3BlZWRJbjthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmVhc2Utb3V0fUBrZXlmcmFtZXMgbGlnaHRTcGVlZE91dHswJXtvcGFjaXR5OjF9dG97dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDEwMCUsMCwwKSBza2V3WCgzMGRlZyk7b3BhY2l0eTowfX0ubGlnaHRTcGVlZE91dHthbmltYXRpb24tbmFtZTpsaWdodFNwZWVkT3V0O2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbn1Aa2V5ZnJhbWVzIHJvdGF0ZUluezAle3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyO3RyYW5zZm9ybTpyb3RhdGUoLTIwMGRlZyk7b3BhY2l0eTowOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpjZW50ZXJ9dG97LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOmNlbnRlcjt0cmFuc2Zvcm0tb3JpZ2luOmNlbnRlcjt0cmFuc2Zvcm06bm9uZTtvcGFjaXR5OjF9fS5yb3RhdGVJbnthbmltYXRpb24tbmFtZTpyb3RhdGVJbn1Aa2V5ZnJhbWVzIHJvdGF0ZUluRG93bkxlZnR7MCV7dHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm06cm90YXRlKC00NWRlZyk7b3BhY2l0eTowOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46bGVmdCBib3R0b207dHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm06bm9uZTtvcGFjaXR5OjF9fS5yb3RhdGVJbkRvd25MZWZ0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZUluRG93bkxlZnR9QGtleWZyYW1lcyByb3RhdGVJbkRvd25SaWdodHswJXt0cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbTt0cmFuc2Zvcm06cm90YXRlKDQ1ZGVnKTtvcGFjaXR5OjA7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybTpub25lO29wYWNpdHk6MX19LnJvdGF0ZUluRG93blJpZ2h0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZUluRG93blJpZ2h0fUBrZXlmcmFtZXMgcm90YXRlSW5VcExlZnR7MCV7dHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm06cm90YXRlKDQ1ZGVnKTtvcGFjaXR5OjA7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tfXRvey13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tO3RyYW5zZm9ybTpub25lO29wYWNpdHk6MX19LnJvdGF0ZUluVXBMZWZ0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZUluVXBMZWZ0fUBrZXlmcmFtZXMgcm90YXRlSW5VcFJpZ2h0ezAle3RyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybTpyb3RhdGUoLTkwZGVnKTtvcGFjaXR5OjA7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybTpub25lO29wYWNpdHk6MX19LnJvdGF0ZUluVXBSaWdodHthbmltYXRpb24tbmFtZTpyb3RhdGVJblVwUmlnaHR9QGtleWZyYW1lcyByb3RhdGVPdXR7MCV7dHJhbnNmb3JtLW9yaWdpbjpjZW50ZXI7b3BhY2l0eToxOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpjZW50ZXJ9dG97LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOmNlbnRlcjt0cmFuc2Zvcm0tb3JpZ2luOmNlbnRlcjt0cmFuc2Zvcm06cm90YXRlKDIwMGRlZyk7b3BhY2l0eTowfX0ucm90YXRlT3V0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZU91dH1Aa2V5ZnJhbWVzIHJvdGF0ZU91dERvd25MZWZ0ezAle3RyYW5zZm9ybS1vcmlnaW46bGVmdCBib3R0b207b3BhY2l0eToxOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46bGVmdCBib3R0b207dHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm06cm90YXRlKDQ1ZGVnKTtvcGFjaXR5OjB9fS5yb3RhdGVPdXREb3duTGVmdHthbmltYXRpb24tbmFtZTpyb3RhdGVPdXREb3duTGVmdH1Aa2V5ZnJhbWVzIHJvdGF0ZU91dERvd25SaWdodHswJXt0cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbTtvcGFjaXR5OjE7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybTpyb3RhdGUoLTQ1ZGVnKTtvcGFjaXR5OjB9fS5yb3RhdGVPdXREb3duUmlnaHR7YW5pbWF0aW9uLW5hbWU6cm90YXRlT3V0RG93blJpZ2h0fUBrZXlmcmFtZXMgcm90YXRlT3V0VXBMZWZ0ezAle3RyYW5zZm9ybS1vcmlnaW46bGVmdCBib3R0b207b3BhY2l0eToxOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46bGVmdCBib3R0b207dHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm06cm90YXRlKC00NWRlZyk7b3BhY2l0eTowfX0ucm90YXRlT3V0VXBMZWZ0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZU91dFVwTGVmdH1Aa2V5ZnJhbWVzIHJvdGF0ZU91dFVwUmlnaHR7MCV7dHJhbnNmb3JtLW9yaWdpbjpyaWdodCBib3R0b207b3BhY2l0eToxOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpyaWdodCBib3R0b219dG97LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbTt0cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbTt0cmFuc2Zvcm06cm90YXRlKDkwZGVnKTtvcGFjaXR5OjB9fS5yb3RhdGVPdXRVcFJpZ2h0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZU91dFVwUmlnaHR9QGtleWZyYW1lcyBoaW5nZXswJXt0cmFuc2Zvcm0tb3JpZ2luOnRvcCBsZWZ0Oy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjp0b3AgbGVmdDthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmVhc2UtaW4tb3V0fTIwJSw2MCV7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOnRvcCBsZWZ0O2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbi1vdXQ7dHJhbnNmb3JtOnJvdGF0ZSg4MGRlZyk7dHJhbnNmb3JtLW9yaWdpbjp0b3AgbGVmdH00MCUsODAle3RyYW5zZm9ybTpyb3RhdGUoNjBkZWcpO3RyYW5zZm9ybS1vcmlnaW46dG9wIGxlZnQ7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWluLW91dDtvcGFjaXR5OjF9dG97dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsNzAwcHgsMCk7b3BhY2l0eTowfX0uaGluZ2V7YW5pbWF0aW9uLW5hbWU6aGluZ2V9QGtleWZyYW1lcyByb2xsSW57MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMTAwJSwwLDApIHJvdGF0ZSgtMTIwZGVnKX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9fS5yb2xsSW57YW5pbWF0aW9uLW5hbWU6cm9sbElufUBrZXlmcmFtZXMgcm9sbE91dHswJXtvcGFjaXR5OjF9dG97b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgxMDAlLDAsMCkgcm90YXRlKDEyMGRlZyl9fS5yb2xsT3V0e2FuaW1hdGlvbi1uYW1lOnJvbGxPdXR9QGtleWZyYW1lcyB6b29tSW57MCV7b3BhY2l0eTowO3RyYW5zZm9ybTpzY2FsZTNkKC4zLC4zLC4zKX01MCV7b3BhY2l0eToxfX0uem9vbUlue2FuaW1hdGlvbi1uYW1lOnpvb21Jbn1Aa2V5ZnJhbWVzIHpvb21JbkRvd257MCV7b3BhY2l0eTowO3RyYW5zZm9ybTpzY2FsZTNkKC4xLC4xLC4xKSB0cmFuc2xhdGUzZCgwLC0xMDAwcHgsMCk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjU1LC4wNTUsLjY3NSwuMTkpfTYwJXtvcGFjaXR5OjE7dHJhbnNmb3JtOnNjYWxlM2QoLjQ3NSwuNDc1LC40NzUpIHRyYW5zbGF0ZTNkKDAsNjBweCwwKTthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguMTc1LC44ODUsLjMyLDEpfX0uem9vbUluRG93bnthbmltYXRpb24tbmFtZTp6b29tSW5Eb3dufUBrZXlmcmFtZXMgem9vbUluTGVmdHswJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlM2QoLjEsLjEsLjEpIHRyYW5zbGF0ZTNkKC0xMDAwcHgsMCwwKTthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguNTUsLjA1NSwuNjc1LC4xOSl9NjAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCguNDc1LC40NzUsLjQ3NSkgdHJhbnNsYXRlM2QoMTBweCwwLDApO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4xNzUsLjg4NSwuMzIsMSl9fS56b29tSW5MZWZ0e2FuaW1hdGlvbi1uYW1lOnpvb21JbkxlZnR9QGtleWZyYW1lcyB6b29tSW5SaWdodHswJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlM2QoLjEsLjEsLjEpIHRyYW5zbGF0ZTNkKDEwMDBweCwwLDApO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC41NSwuMDU1LC42NzUsLjE5KX02MCV7b3BhY2l0eToxO3RyYW5zZm9ybTpzY2FsZTNkKC40NzUsLjQ3NSwuNDc1KSB0cmFuc2xhdGUzZCgtMTBweCwwLDApO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4xNzUsLjg4NSwuMzIsMSl9fS56b29tSW5SaWdodHthbmltYXRpb24tbmFtZTp6b29tSW5SaWdodH1Aa2V5ZnJhbWVzIHpvb21JblVwezAle29wYWNpdHk6MDt0cmFuc2Zvcm06c2NhbGUzZCguMSwuMSwuMSkgdHJhbnNsYXRlM2QoMCwxMDAwcHgsMCk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjU1LC4wNTUsLjY3NSwuMTkpfTYwJXtvcGFjaXR5OjE7dHJhbnNmb3JtOnNjYWxlM2QoLjQ3NSwuNDc1LC40NzUpIHRyYW5zbGF0ZTNkKDAsLTYwcHgsMCk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjE3NSwuODg1LC4zMiwxKX19Lnpvb21JblVwe2FuaW1hdGlvbi1uYW1lOnpvb21JblVwfUBrZXlmcmFtZXMgem9vbU91dHswJXtvcGFjaXR5OjF9NTAle3RyYW5zZm9ybTpzY2FsZTNkKC4zLC4zLC4zKTtvcGFjaXR5OjB9dG97b3BhY2l0eTowfX0uem9vbU91dHthbmltYXRpb24tbmFtZTp6b29tT3V0fUBrZXlmcmFtZXMgem9vbU91dERvd257NDAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCguNDc1LC40NzUsLjQ3NSkgdHJhbnNsYXRlM2QoMCwtNjBweCwwKTthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguNTUsLjA1NSwuNjc1LC4xOSl9dG97b3BhY2l0eTowO3RyYW5zZm9ybTpzY2FsZTNkKC4xLC4xLC4xKSB0cmFuc2xhdGUzZCgwLDIwMDBweCwwKTt0cmFuc2Zvcm0tb3JpZ2luOmNlbnRlciBib3R0b207YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjE3NSwuODg1LC4zMiwxKX19Lnpvb21PdXREb3due2FuaW1hdGlvbi1uYW1lOnpvb21PdXREb3dufUBrZXlmcmFtZXMgem9vbU91dExlZnR7NDAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCguNDc1LC40NzUsLjQ3NSkgdHJhbnNsYXRlM2QoNDJweCwwLDApfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06c2NhbGUoLjEpIHRyYW5zbGF0ZTNkKC0yMDAwcHgsMCwwKTt0cmFuc2Zvcm0tb3JpZ2luOmxlZnQgY2VudGVyfX0uem9vbU91dExlZnR7YW5pbWF0aW9uLW5hbWU6em9vbU91dExlZnR9QGtleWZyYW1lcyB6b29tT3V0UmlnaHR7NDAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCguNDc1LC40NzUsLjQ3NSkgdHJhbnNsYXRlM2QoLTQycHgsMCwwKX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlKC4xKSB0cmFuc2xhdGUzZCgyMDAwcHgsMCwwKTt0cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGNlbnRlcn19Lnpvb21PdXRSaWdodHthbmltYXRpb24tbmFtZTp6b29tT3V0UmlnaHR9QGtleWZyYW1lcyB6b29tT3V0VXB7NDAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCguNDc1LC40NzUsLjQ3NSkgdHJhbnNsYXRlM2QoMCw2MHB4LDApO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC41NSwuMDU1LC42NzUsLjE5KX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlM2QoLjEsLjEsLjEpIHRyYW5zbGF0ZTNkKDAsLTIwMDBweCwwKTt0cmFuc2Zvcm0tb3JpZ2luOmNlbnRlciBib3R0b207YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjE3NSwuODg1LC4zMiwxKX19Lnpvb21PdXRVcHthbmltYXRpb24tbmFtZTp6b29tT3V0VXB9QGtleWZyYW1lcyBzbGlkZUluRG93bnswJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMTAwJSwwKTt2aXNpYmlsaXR5OnZpc2libGV9dG97dHJhbnNmb3JtOnRyYW5zbGF0ZVooMCl9fS5zbGlkZUluRG93bnthbmltYXRpb24tbmFtZTpzbGlkZUluRG93bn1Aa2V5ZnJhbWVzIHNsaWRlSW5MZWZ0ezAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMTAwJSwwLDApO3Zpc2liaWxpdHk6dmlzaWJsZX10b3t0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX19LnNsaWRlSW5MZWZ0e2FuaW1hdGlvbi1uYW1lOnNsaWRlSW5MZWZ0fUBrZXlmcmFtZXMgc2xpZGVJblJpZ2h0ezAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgxMDAlLDAsMCk7dmlzaWJpbGl0eTp2aXNpYmxlfXRve3RyYW5zZm9ybTp0cmFuc2xhdGVaKDApfX0uc2xpZGVJblJpZ2h0e2FuaW1hdGlvbi1uYW1lOnNsaWRlSW5SaWdodH1Aa2V5ZnJhbWVzIHNsaWRlSW5VcHswJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwxMDAlLDApO3Zpc2liaWxpdHk6dmlzaWJsZX10b3t0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX19LnNsaWRlSW5VcHthbmltYXRpb24tbmFtZTpzbGlkZUluVXB9QGtleWZyYW1lcyBzbGlkZU91dERvd257MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZVooMCl9dG97dmlzaWJpbGl0eTpoaWRkZW47dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMTAwJSwwKX19LnNsaWRlT3V0RG93bnthbmltYXRpb24tbmFtZTpzbGlkZU91dERvd259QGtleWZyYW1lcyBzbGlkZU91dExlZnR7MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZVooMCl9dG97dmlzaWJpbGl0eTpoaWRkZW47dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xMDAlLDAsMCl9fS5zbGlkZU91dExlZnR7YW5pbWF0aW9uLW5hbWU6c2xpZGVPdXRMZWZ0fUBrZXlmcmFtZXMgc2xpZGVPdXRSaWdodHswJXt0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX10b3t2aXNpYmlsaXR5OmhpZGRlbjt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTAwJSwwLDApfX0uc2xpZGVPdXRSaWdodHthbmltYXRpb24tbmFtZTpzbGlkZU91dFJpZ2h0fUBrZXlmcmFtZXMgc2xpZGVPdXRVcHswJXt0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX10b3t2aXNpYmlsaXR5OmhpZGRlbjt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMTAwJSwwKX19LnNsaWRlT3V0VXB7YW5pbWF0aW9uLW5hbWU6c2xpZGVPdXRVcH1ib2R5e2ZvbnQ6MThweC8xLjUgXFxcIkRyb2lkIFNhbnNcXFwiLGZ1dHVyYSxoZWx2ZXRpY2EsYXJpYWwsYXJpYWwsc2Fucy1zZXJpZjtmb250LXdlaWdodDoxMDA7Y29sb3I6cmdiYSgyNTUsMjU1LDI1NSwuOTUpO3RleHQtc2hhZG93OjAgMCAycHggIzAwMCwwIDAgNDBweCAjMDAwfWgxe2ZvbnQtc2l6ZTo1MHB4O2ZvbnQtd2VpZ2h0OjkwMDttYXJnaW46MCBhdXRvIDEwcHh9aDJ7Zm9udC1zaXplOjM2cHg7Zm9udC13ZWlnaHQ6MzAwO21hcmdpbjowIGF1dG8gNXB4fWgzLGg0LGg1e2ZvbnQtc2l6ZToyOHB4O21hcmdpbjowIGF1dG87Zm9udC13ZWlnaHQ6MjAwfWg0LGg1e2ZvbnQtc2l6ZToyMnB4fWg1e2ZvbnQtc2l6ZToxOHB4fW9sLHVse2ZvbnQtc2l6ZTozMnB4O2ZvbnQtd2VpZ2h0OjQwMH1vbC5ub3ByZWZpeCx1bC5ub3ByZWZpeHtsaXN0LXN0eWxlOm5vbmV9b2wubm9wcmVmaXggbGksdWwubm9wcmVmaXggbGl7bWFyZ2luLWxlZnQ6MH1vbC5ub3ByZWZpeCBsaTo6YmVmb3JlLHVsLm5vcHJlZml4IGxpOjpiZWZvcmV7Y29udGVudDpub25lfWxpe21hcmdpbi1ib3R0b206MTJweDt3aWR0aDoxMDAlO21hcmdpbi1sZWZ0Oi41ZW19b2wgb2wsb2wgdWwsdWwgb2wsdWwgdWx7bWFyZ2luLWxlZnQ6MzBweH1vbCBvbCBsaSxvbCB1bCBsaSx1bCBvbCBsaSx1bCB1bCBsaXttYXJnaW4tYm90dG9tOjA7bGluZS1oZWlnaHQ6MS40ZW19b2wgb2wsdWwgb2x7bGlzdC1zdHlsZS10eXBlOmxvd2VyLXJvbWFufWJsb2NrcXVvdGUsbGkscHJle3RleHQtYWxpZ246bGVmdH10ZCx0aHtwYWRkaW5nOjEwcHg7Ym9yZGVyOjFweCBzb2xpZCAjY2NjfXRoe2JhY2tncm91bmQtY29sb3I6IzMzM310ZHtiYWNrZ3JvdW5kLWNvbG9yOiM0NDQ7dGV4dC1zaGFkb3c6bm9uZX1wcmV7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMHB4fXByZSAuZW0tYmx1ZSxwcmUgLmVtLWdyZWVuLHByZSAuZW0tcmVkLHByZSAuZW0teWVsbG93e21hcmdpbjo1cHggMH0uYmVzcG9rZS1wYXJlbnQsLmJlc3Bva2Utc2NhbGUtcGFyZW50e3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowfS5iZXNwb2tlLXBhcmVudHstd2Via2l0LXRleHQtc2l6ZS1hZGp1c3Q6YXV0bzstbXMtdGV4dC1zaXplLWFkanVzdDphdXRvO3RleHQtc2l6ZS1hZGp1c3Q6YXV0bztiYWNrZ3JvdW5kOiMxMTE7b3ZlcmZsb3c6aGlkZGVuO3RyYW5zaXRpb246YmFja2dyb3VuZCAxcyBlYXNlO2JhY2tncm91bmQtcG9zaXRpb246NTAlIDUwJX0uYmVzcG9rZS1zY2FsZS1wYXJlbnR7cG9pbnRlci1ldmVudHM6bm9uZX0uYmVzcG9rZS1zY2FsZS1wYXJlbnQgLmJlc3Bva2UtYWN0aXZle3BvaW50ZXItZXZlbnRzOmF1dG99LmJlc3Bva2Utc2xpZGV7d2lkdGg6MTAwJTtoZWlnaHQ6MTAwJTtwb3NpdGlvbjphYnNvbHV0ZTtkaXNwbGF5Oi1tcy1mbGV4Ym94O2Rpc3BsYXk6ZmxleDstbXMtZmxleC1kaXJlY3Rpb246Y29sdW1uO2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjstbXMtZmxleC1wYWNrOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyOy1tcy1mbGV4LWFsaWduOmNlbnRlcjthbGlnbi1pdGVtczpjZW50ZXJ9LmJlc3Bva2Utc2xpZGUueC1naWYtZmluaXNoZWQgLmJveC53YWl0LWZvci1naWZ7b3BhY2l0eToxfS5iZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZSwuYmVzcG9rZS1pbmFjdGl2ZXtvcGFjaXR5OjA7cG9pbnRlci1ldmVudHM6bm9uZX0uYmVzcG9rZS1iYWNrZHJvcHtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjA7cmlnaHQ6MDtib3R0b206MDt6LWluZGV4Oi0xO29wYWNpdHk6MH0uYmVzcG9rZS1iYWNrZHJvcC1hY3RpdmV7b3BhY2l0eToxfS5iZXNwb2tlLXByb2dyZXNzLXBhcmVudHtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjA7cmlnaHQ6MDtoZWlnaHQ6LjN2d30uYmVzcG9rZS1wcm9ncmVzcy1iYXJ7cG9zaXRpb246YWJzb2x1dGU7aGVpZ2h0OjEwMCU7YmFja2dyb3VuZDojY2NjO3RyYW5zaXRpb246d2lkdGggLjZzIGVhc2V9LmNhcmJvbmZpYmVye2JhY2tncm91bmQ6cmFkaWFsLWdyYWRpZW50KCMwMDAgMTUlLHRyYW5zcGFyZW50IDE2JSkgMCAwLHJhZGlhbC1ncmFkaWVudCgjMDAwIDE1JSx0cmFuc3BhcmVudCAxNiUpIDhweCA4cHgscmFkaWFsLWdyYWRpZW50KHJnYmEoMjU1LDI1NSwyNTUsLjEpIDE1JSx0cmFuc3BhcmVudCAyMCUpIDAgMXB4LHJhZGlhbC1ncmFkaWVudChyZ2JhKDI1NSwyNTUsMjU1LC4xKSAxNSUsdHJhbnNwYXJlbnQgMjAlKSA4cHggOXB4O2JhY2tncm91bmQtY29sb3I6IzI4MjgyODtiYWNrZ3JvdW5kLXNpemU6MTZweCAxNnB4fS5jYXJib257YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMjdkZWcsIzE1MTUxNSA1cHgsdHJhbnNwYXJlbnQgNXB4KSAwIDVweCxsaW5lYXItZ3JhZGllbnQoMjA3ZGVnLCMxNTE1MTUgNXB4LHRyYW5zcGFyZW50IDVweCkgMTBweCAwLGxpbmVhci1ncmFkaWVudCgyN2RlZywjMjIyIDVweCx0cmFuc3BhcmVudCA1cHgpIDAgMTBweCxsaW5lYXItZ3JhZGllbnQoMjA3ZGVnLCMyMjIgNXB4LHRyYW5zcGFyZW50IDVweCkgMTBweCA1cHgsbGluZWFyLWdyYWRpZW50KDkwZGVnLCMxYjFiMWIgMTBweCx0cmFuc3BhcmVudCAxMHB4KSxsaW5lYXItZ3JhZGllbnQoIzFkMWQxZCAyNSUsIzFhMWExYSAyNSUsIzFhMWExYSA1MCUsdHJhbnNwYXJlbnQgNTAlLHRyYW5zcGFyZW50IDc1JSwjMjQyNDI0IDc1JSwjMjQyNDI0KTtiYWNrZ3JvdW5kLWNvbG9yOiMxMzEzMTM7YmFja2dyb3VuZC1zaXplOjIwcHggMjBweH0uc2VpZ2FpaGF7YmFja2dyb3VuZC1jb2xvcjpzaWx2ZXI7YmFja2dyb3VuZC1pbWFnZTpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDEwMCUgMTUwJSxzaWx2ZXIgMjQlLCNmZmYgMjUlLCNmZmYgMjglLHNpbHZlciAyOSUsc2lsdmVyIDM2JSwjZmZmIDM2JSwjZmZmIDQwJSx0cmFuc3BhcmVudCA0MCUsdHJhbnNwYXJlbnQpLHJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgMCAxNTAlLHNpbHZlciAyNCUsI2ZmZiAyNSUsI2ZmZiAyOCUsc2lsdmVyIDI5JSxzaWx2ZXIgMzYlLCNmZmYgMzYlLCNmZmYgNDAlLHRyYW5zcGFyZW50IDQwJSx0cmFuc3BhcmVudCkscmFkaWFsLWdyYWRpZW50KGNpcmNsZSBhdCA1MCUgMTAwJSwjZmZmIDEwJSxzaWx2ZXIgMTElLHNpbHZlciAyMyUsI2ZmZiAyNCUsI2ZmZiAzMCUsc2lsdmVyIDMxJSxzaWx2ZXIgNDMlLCNmZmYgNDQlLCNmZmYgNTAlLHNpbHZlciA1MSUsc2lsdmVyIDYzJSwjZmZmIDY0JSwjZmZmIDcxJSx0cmFuc3BhcmVudCA3MSUsdHJhbnNwYXJlbnQpLHJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgMTAwJSA1MCUsI2ZmZiA1JSxzaWx2ZXIgNiUsc2lsdmVyIDE1JSwjZmZmIDE2JSwjZmZmIDIwJSxzaWx2ZXIgMjElLHNpbHZlciAzMCUsI2ZmZiAzMSUsI2ZmZiAzNSUsc2lsdmVyIDM2JSxzaWx2ZXIgNDUlLCNmZmYgNDYlLCNmZmYgNDklLHRyYW5zcGFyZW50IDUwJSx0cmFuc3BhcmVudCkscmFkaWFsLWdyYWRpZW50KGNpcmNsZSBhdCAwIDUwJSwjZmZmIDUlLHNpbHZlciA2JSxzaWx2ZXIgMTUlLCNmZmYgMTYlLCNmZmYgMjAlLHNpbHZlciAyMSUsc2lsdmVyIDMwJSwjZmZmIDMxJSwjZmZmIDM1JSxzaWx2ZXIgMzYlLHNpbHZlciA0NSUsI2ZmZiA0NiUsI2ZmZiA0OSUsdHJhbnNwYXJlbnQgNTAlLHRyYW5zcGFyZW50KTtiYWNrZ3JvdW5kLXNpemU6MTAwcHggNTBweH0uY3ViZXN7YmFja2dyb3VuZC1jb2xvcjojNTU2O2JhY2tncm91bmQtaW1hZ2U6bGluZWFyLWdyYWRpZW50KDMwZGVnLCM0NDUgMTIlLHRyYW5zcGFyZW50IDEyLjUlLHRyYW5zcGFyZW50IDg3JSwjNDQ1IDg3LjUlLCM0NDUpLGxpbmVhci1ncmFkaWVudCgxNTBkZWcsIzQ0NSAxMiUsdHJhbnNwYXJlbnQgMTIuNSUsdHJhbnNwYXJlbnQgODclLCM0NDUgODcuNSUsIzQ0NSksbGluZWFyLWdyYWRpZW50KDMwZGVnLCM0NDUgMTIlLHRyYW5zcGFyZW50IDEyLjUlLHRyYW5zcGFyZW50IDg3JSwjNDQ1IDg3LjUlLCM0NDUpLGxpbmVhci1ncmFkaWVudCgxNTBkZWcsIzQ0NSAxMiUsdHJhbnNwYXJlbnQgMTIuNSUsdHJhbnNwYXJlbnQgODclLCM0NDUgODcuNSUsIzQ0NSksbGluZWFyLWdyYWRpZW50KDYwZGVnLCM5OWEgMjUlLHRyYW5zcGFyZW50IDI1LjUlLHRyYW5zcGFyZW50IDc1JSwjOTlhIDc1JSwjOTlhKSxsaW5lYXItZ3JhZGllbnQoNjBkZWcsIzk5YSAyNSUsdHJhbnNwYXJlbnQgMjUuNSUsdHJhbnNwYXJlbnQgNzUlLCM5OWEgNzUlLCM5OWEpO2JhY2tncm91bmQtc2l6ZTo4MHB4IDE0MHB4O2JhY2tncm91bmQtcG9zaXRpb246MCAwLDAgMCw0MHB4IDcwcHgsNDBweCA3MHB4LDAgMCw0MHB4IDcwcHh9LnBhcGVye2JhY2tncm91bmQtY29sb3I6I2ZmZjtiYWNrZ3JvdW5kLWltYWdlOmxpbmVhci1ncmFkaWVudCg5MGRlZyx0cmFuc3BhcmVudCA3OXB4LCNhYmNlZDQgNzlweCwjYWJjZWQ0IDgxcHgsdHJhbnNwYXJlbnQgODFweCksbGluZWFyLWdyYWRpZW50KCNlZWUgLjFlbSx0cmFuc3BhcmVudCAuMWVtKTtiYWNrZ3JvdW5kLXNpemU6MTAwJSAxLjJlbX0uaG9uZXljb21ie2JhY2tncm91bmQ6cmFkaWFsLWdyYWRpZW50KGNpcmNsZSBmYXJ0aGVzdC1zaWRlIGF0IDAlIDUwJSwjZmIxIDIzLjUlLHJnYmEoMjQwLDE2NiwxNywwKSAwKSAyMXB4IDMwcHgscmFkaWFsLWdyYWRpZW50KGNpcmNsZSBmYXJ0aGVzdC1zaWRlIGF0IDAlIDUwJSwjYjcxIDI0JSxyZ2JhKDI0MCwxNjYsMTcsMCkgMCkgMTlweCAzMHB4LGxpbmVhci1ncmFkaWVudCgjZmIxIDE0JSxyZ2JhKDI0MCwxNjYsMTcsMCkgMCxyZ2JhKDI0MCwxNjYsMTcsMCkgODUlLCNmYjEgMCkgMCAwLGxpbmVhci1ncmFkaWVudCgxNTBkZWcsI2ZiMSAyNCUsI2I3MSAwLCNiNzEgMjYlLHJnYmEoMjQwLDE2NiwxNywwKSAwLHJnYmEoMjQwLDE2NiwxNywwKSA3NCUsI2I3MSAwLCNiNzEgNzYlLCNmYjEgMCkgMCAwLGxpbmVhci1ncmFkaWVudCgzMGRlZywjZmIxIDI0JSwjYjcxIDAsI2I3MSAyNiUscmdiYSgyNDAsMTY2LDE3LDApIDAscmdiYSgyNDAsMTY2LDE3LDApIDc0JSwjYjcxIDAsI2I3MSA3NiUsI2ZiMSAwKSAwIDAsbGluZWFyLWdyYWRpZW50KDkwZGVnLCNiNzEgMiUsI2ZiMSAwLCNmYjEgOTglLCNiNzEgMCUpIDAgMCAjZmIxO2JhY2tncm91bmQtc2l6ZTo0MHB4IDYwcHh9LndhdmV7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoI2ZmZiA1MCUscmdiYSgyNTUsMjU1LDI1NSwwKSAwKSAwIDAscmFkaWFsLWdyYWRpZW50KGNpcmNsZSBjbG9zZXN0LXNpZGUsI2ZmZiA1MyUscmdiYSgyNTUsMjU1LDI1NSwwKSAwKSAwIDAscmFkaWFsLWdyYWRpZW50KGNpcmNsZSBjbG9zZXN0LXNpZGUsI2ZmZiA1MCUscmdiYSgyNTUsMjU1LDI1NSwwKSAwKSA1NXB4IDAgIzQ4YjtiYWNrZ3JvdW5kLXNpemU6MTEwcHggMjAwcHg7YmFja2dyb3VuZC1yZXBlYXQ6cmVwZWF0LXh9LmJsdWVwcmludHtiYWNrZ3JvdW5kLWNvbG9yOiMyNjk7YmFja2dyb3VuZC1pbWFnZTpsaW5lYXItZ3JhZGllbnQoI2ZmZiAycHgsdHJhbnNwYXJlbnQgMnB4KSxsaW5lYXItZ3JhZGllbnQoOTBkZWcsI2ZmZiAycHgsdHJhbnNwYXJlbnQgMnB4KSxsaW5lYXItZ3JhZGllbnQocmdiYSgyNTUsMjU1LDI1NSwuMykgMXB4LHRyYW5zcGFyZW50IDFweCksbGluZWFyLWdyYWRpZW50KDkwZGVnLHJnYmEoMjU1LDI1NSwyNTUsLjMpIDFweCx0cmFuc3BhcmVudCAxcHgpO2JhY2tncm91bmQtc2l6ZToxMDBweCAxMDBweCwxMDBweCAxMDBweCwyMHB4IDIwcHgsMjBweCAyMHB4O2JhY2tncm91bmQtcG9zaXRpb246LTJweCAtMnB4LC0ycHggLTJweCwtMXB4IC0xcHgsLTFweCAtMXB4fS5zaGlwcG97YmFja2dyb3VuZC1jb2xvcjojZGVmO2JhY2tncm91bmQtaW1hZ2U6cmFkaWFsLWdyYWRpZW50KGNsb3Nlc3Qtc2lkZSx0cmFuc3BhcmVudCA5OCUscmdiYSgwLDAsMCwuMykgOTklKSxyYWRpYWwtZ3JhZGllbnQoY2xvc2VzdC1zaWRlLHRyYW5zcGFyZW50IDk4JSxyZ2JhKDAsMCwwLC4zKSA5OSUpO2JhY2tncm91bmQtc2l6ZTo4MHB4IDgwcHg7YmFja2dyb3VuZC1wb3NpdGlvbjowIDAsNDBweCA0MHB4fS5ibGFja3RocmVhZHtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvYmxhY2stdGhyZWFkLWxpZ2h0LnBuZyl9LmJyaWNrd2FsbGRhcmt7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL2JyaWNrLXdhbGwtZGFyay5wbmcpfS5icmlja3dhbGx7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL2JyaWNrLXdhbGwucG5nKX0uZGlhZ21vbmRze2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy9kaWFnbW9uZHMtbGlnaHQucG5nKX0uZGlhbW9uZHVwaG9sc3Rlcnl7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL2RpYW1vbmQtdXBob2xzdGVyeS5wbmcpfS5ncGxheXtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvZ3BsYXkucG5nKX0uZ3JhdmVse2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy9ncmF2ZWwucG5nKX0ub2xkbWF0aHtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvb2xkLW1hdGhlbWF0aWNzLnBuZyl9LnB1cnR5d29vZHtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvcHVydHktd29vZC5wbmcpfS5idWxsc2V5ZXN7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL3N0cmFuZ2UtYnVsbHNleWVzLnBuZyl9LmVzY2hlcmVzcXVle2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy9lc2NoZXJlc3F1ZS5wbmcpfS5zdHJhd3N7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL3N0cmF3cy5wbmcpfS5saXR0bGVib3hlc3tiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvbGl0dGxlYm94ZXMucG5nKX0ud29vZHRpbGVjb2xvcntiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvdGlsZWFibGUtd29vZC1jb2xvcmVkLnBuZyl9Lndvb2R0aWxle2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy90aWxlYWJsZS13b29kLnBuZyl9LnRyZWViYXJre2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy90cmVlLWJhcmsucG5nKX0ud2FzaGl7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL3dhc2hpLnBuZyl9Lndvb2QtcGF0dGVybntiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvd29vZC1wYXR0ZXJuLnBuZyl9Lnh2e2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy94di5wbmcpfXNlY3Rpb24+aW1ne3Bvc2l0aW9uOmFic29sdXRlO21hcmdpbjphdXRvO2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4fS5mdWxsc2NyZWVue3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MH0uZmlsbCwuZnVsbHNjcmVlbnt3aWR0aDoxMDAlO2hlaWdodDoxMDAlfS5maWxsaHtoZWlnaHQ6MTAwJTtsZWZ0Oi01MCU7cmlnaHQ6LTUwJTtwb3NpdGlvbjphYnNvbHV0ZTttYXJnaW46YXV0b30uZmlsbHcsLmZpbGx3Ynt3aWR0aDoxMDAlO2hlaWdodDphdXRvfS5maWxsd2J7Ym90dG9tOjB9c2VjdGlvbiB4LWdpZntwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjB9LmJveHtwb3NpdGlvbjpyZWxhdGl2ZTt0ZXh0LWFsaWduOmNlbnRlcjttYXJnaW46YXV0bzttYXgtd2lkdGg6MTAwJTtib3JkZXItcmFkaXVzOjEwcHg7cGFkZGluZzoyNXB4O2JhY2tncm91bmQtY29sb3I6cmdiYSgwLDAsMCwuNil9LmJveCBvbCwuYm94IHVse21hcmdpbjoxMnB4IDIwcHg7cGFkZGluZzowfS5ib3ggbGk6OmJlZm9yZXtsZWZ0Oi41ZW19LmJveC53YWl0LWZvci1naWZ7b3BhY2l0eTowfS5ib3guYm90dG9te2JvdHRvbTo1JTttYXJnaW4tYm90dG9tOjB9LmJveC50b3B7dG9wOjUlO21hcmdpbi10b3A6MH0uYm94LmxlZnR7bGVmdDo1JTttYXJnaW4tbGVmdDowfS5ib3gucmlnaHR7cmlnaHQ6NSU7bWFyZ2luLXJpZ2h0OjB9LmJveC50cmFuc3BhcmVudCBwcmUsc3Bhbi5hbmltYXRle2Rpc3BsYXk6aW5saW5lLWJsb2NrfS5jcmVkaXR7cG9zaXRpb246YWJzb2x1dGU7Ym90dG9tOjEwcHg7cmlnaHQ6MTBweH1he2NvbG9yOiM5Y2Y7dGV4dC1kZWNvcmF0aW9uOm5vbmV9YS5iYWNrOmFmdGVyLGEuYmFjazpiZWZvcmUsYTphZnRlcntjb250ZW50OicgIOKerSc7Zm9udC1zaXplOjI0cHg7bGluZS1oZWlnaHQ6MjRweDt2ZXJ0aWNhbC1hbGlnbjptaWRkbGV9YS5iYWNrOmFmdGVyLGEuYmFjazpiZWZvcmV7Y29udGVudDon4qyFICAnfWEuYmFjazphZnRlcntjb250ZW50OicnfS5tZSwucGVyc29ue2hlaWdodDo3MnB4O3dpZHRoOjcycHg7YmFja2dyb3VuZC1yZXBlYXQ6bm8tcmVwZWF0O2JhY2tncm91bmQtc2l6ZTo3MnB4O2JhY2tncm91bmQtcG9zaXRpb246NTAlIDUwJTtib3JkZXItcmFkaXVzOjUwJTtib3gtc2hhZG93OjAgMCAwIDJweCAjMDAwLDAgMCAwIDRweCAjOWNmO21hcmdpbjowIDE2cHh9Lm1lLmNlbnRlciwucGVyc29uLmNlbnRlcnttYXJnaW46MTVweCBhdXRvfS5tZXtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvbWUuanBnKX0uZW17Zm9udC13ZWlnaHQ6MzAwfS5lbSwuZW0tYmx1ZSwuZW0tYm9sZCwuZW0tZ3JlZW4sLmVtLW9yYW5nZSwuZW0tcmVkLC5lbS15ZWxsb3d7cGFkZGluZzo1cHggMTBweDttYXJnaW46NXB4IDJweDtib3JkZXI6MXB4IHNvbGlkIHRyYW5zcGFyZW50O2JvcmRlci1yYWRpdXM6NHB4O3RleHQtc2hhZG93Om5vbmU7ZGlzcGxheTppbmxpbmUtYmxvY2s7bGluZS1oZWlnaHQ6MS4yZW07Zm9udC1mYW1pbHk6bW9ub3NwYWNlO2ZvbnQtc3R5bGU6bm9ybWFsfS5lbS1ibHVlLC5lbS1ncmVlbiwuZW0tb3JhbmdlLC5lbS1yZWQsLmVtLXllbGxvd3tmb250LXdlaWdodDozMDB9LmVtLWJvbGR7Zm9udC13ZWlnaHQ6NzAwfS5lbS1ncmVlbntjb2xvcjojNDY4ODQ3O2JhY2tncm91bmQtY29sb3I6I2RmZjBkODtib3JkZXItY29sb3I6I2Q2ZTljNn0uZW0teWVsbG93e2NvbG9yOiM4YTZkM2I7YmFja2dyb3VuZC1jb2xvcjojZmNmOGUzO2JvcmRlci1jb2xvcjojZmFlYmNjfS5lbS1ibHVle2NvbG9yOiMzYTg3YWQ7YmFja2dyb3VuZC1jb2xvcjojZDllZGY3O2JvcmRlci1jb2xvcjojYmNlOGYxfS5lbS1vcmFuZ2V7Y29sb3I6I2Y4NTtiYWNrZ3JvdW5kLWNvbG9yOiNmY2Y4ZTM7Ym9yZGVyLWNvbG9yOiNmYmVlZDV9LmVtLXJlZHtjb2xvcjojYjk0YTQ4O2JhY2tncm91bmQtY29sb3I6I2YyZGVkZTtib3JkZXItY29sb3I6I2VlZDNkN30ubWlke2ZvbnQtc2l6ZToyOHB4O2ZvbnQtc3R5bGU6aXRhbGljO2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4O3dpZHRoOjEwMCU7bWFyZ2luOjEwcHggYXV0bzstbXMtZmxleC1hbGlnbjpjZW50ZXI7YWxpZ24taXRlbXM6Y2VudGVyfS5taWQ6OmFmdGVyLC5taWQ6OmJlZm9yZXtjb250ZW50OicnOy1tcy1mbGV4LXBvc2l0aXZlOjE7ZmxleC1ncm93OjE7ZGlzcGxheTpibG9jaztib3JkZXItdG9wOmRvdHRlZCAxcHggcmdiYSgyNTUsMjU1LDI1NSwuMyl9Lm1pZDo6YmVmb3Jle21hcmdpbi1yaWdodDoxNnB4fS5taWQ6OmFmdGVye21hcmdpbi1sZWZ0OjE2cHh9Lm1pZC5iaWd7Zm9udC1zaXplOjc0cHh9LmhpZGV7ZGlzcGxheTpub25lfS5ibHVyMXtmaWx0ZXI6Ymx1cigxcHgpfS5ibHVyMntmaWx0ZXI6Ymx1cigycHgpfS5ibHVyMywuYmx1cjR7ZmlsdGVyOmJsdXIoM3B4KX0ub3BhYzIwe29wYWNpdHk6LjJ9Lm9wYWM1MHtvcGFjaXR5Oi41fS5vcGFjODB7b3BhY2l0eTouOH0udHJhbnNwYXJlbnR7YmFja2dyb3VuZC1jb2xvcjpyZ2JhKDAsMCwwLDApfS53aGl0ZXtiYWNrZ3JvdW5kLWNvbG9yOiNmZmZ9LndoaXRlLmJveHtjb2xvcjojMzMzO3RleHQtc2hhZG93Om5vbmV9LnJlZHtiYWNrZ3JvdW5kLWNvbG9yOiNiOTRhNDh9LmJsYWNre2JhY2tncm91bmQtY29sb3I6IzAwMH0uZ3JleXtiYWNrZ3JvdW5kLWNvbG9yOiNjZmNmY2Z9LmdyZXkuYm94e2NvbG9yOiMzMzN9LmJsdWV7YmFja2dyb3VuZC1jb2xvcjojMDA0ZThhfS5taWRuaWdodHtiYWNrZ3JvdW5kLWNvbG9yOiMwMDFmM2Z9LmplbGx5YmVhbntiYWNrZ3JvdW5kLWNvbG9yOiMyODg4OTV9LmNvY29he2JhY2tncm91bmQtY29sb3I6IzQ3MmYwMH0ubm9wZXt0ZXh0LWRlY29yYXRpb246bGluZS10aHJvdWdoO29wYWNpdHk6Ljd9cC5jb2Rle21hcmdpbjowO2ZvbnQtZmFtaWx5OnByZXN0aWdlIGVsaXRlIHN0ZCxjb25zb2xhcyxjb3VyaWVyIG5ldyxtb25vc3BhY2V9c3RyaWtlIGNvZGVbY2xhc3MqPWxhbmd1YWdlLV17dGV4dC1zaGFkb3c6MCAxcHggIzAwZn0ucm90YXRlLC5zcGlue2Rpc3BsYXk6aW5saW5lLWJsb2NrO3RyYW5zZm9ybTpub25lfS5yb3RhdGUub24sLnNwaW4ub257dHJhbnNpdGlvbi1kZWxheTouNXM7dHJhbnNpdGlvbi1kdXJhdGlvbjoxczt0cmFuc2Zvcm06cm90YXRlKDE1ZGVnKX0uc3Bpbi5vbnt0cmFuc2l0aW9uLWRlbGF5OjEuNXM7dHJhbnNmb3JtOnJvdGF0ZSgzNjBkZWcpfS5hbmltYXRlLmRlbGF5MXthbmltYXRpb24tZGVsYXk6MXN9LmFuaW1hdGUuZGVsYXkye2FuaW1hdGlvbi1kZWxheToyc30uYW5pbWF0ZS5kZWxheTN7YW5pbWF0aW9uLWRlbGF5OjNzfS5hbmltYXRlLmRlbGF5NHthbmltYXRpb24tZGVsYXk6NHN9LmFuaW1hdGUuZGVsYXk1e2FuaW1hdGlvbi1kZWxheTo1c30uYW5pbWF0ZS5kZWxheTZ7YW5pbWF0aW9uLWRlbGF5OjZzfS5hbmltYXRlLmRlbGF5N3thbmltYXRpb24tZGVsYXk6N3N9LmFuaW1hdGUuZGVsYXk4e2FuaW1hdGlvbi1kZWxheTo4c30uY3Vyc29yOmFmdGVye2NvbnRlbnQ6XFxcIl9cXFwiO29wYWNpdHk6MDthbmltYXRpb246Y3Vyc29yIDFzIGluZmluaXRlfUBrZXlmcmFtZXMgY3Vyc29yezAlLDQwJSx0b3tvcGFjaXR5OjB9NTAlLDkwJXtvcGFjaXR5OjF9fVwiO3JldHVybiBvKHQse3ByZXBlbmQ6ITB9KSxmdW5jdGlvbih0KXtuKCkodCkscyh0KSxyKHQpfX0sd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIixmdW5jdGlvbigpe1tdLmZvckVhY2guY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwieC1naWZcIiksZnVuY3Rpb24odCl7dC5yZWxheW91dCgpfSl9KSxcInJlZ2lzdGVyRWxlbWVudFwiaW4gZG9jdW1lbnQmJlwiY3JlYXRlU2hhZG93Um9vdFwiaW4gSFRNTEVsZW1lbnQucHJvdG90eXBlJiZcImltcG9ydFwiaW4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpbmtcIikmJlwiY29udGVudFwiaW4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIpKTtlbHNle3ZhciBtPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7bS5zcmM9XCJodHRwczovL2NkbmpzLmNsb3VkZmxhcmUuY29tL2FqYXgvbGlicy93ZWJjb21wb25lbnRzanMvMC43LjIyL3dlYmNvbXBvbmVudHMubWluLmpzXCIsZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChtKTt2YXIgZj1kb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJyb3dzZXJzdXBwb3J0XCIpO2YmJihmLmNsYXNzTmFtZT1mLmNsYXNzTmFtZS5yZXBsYWNlKFwiaGlkZVwiLFwiXCIpKX12YXIgcD0wO2RvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLGZ1bmN0aW9uKHQpe1xyXG52YXIgZT1mdW5jdGlvbigpe2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJhcnRpY2xlXCIpLnN0eWxlLndlYmtpdEZpbHRlcj1cImJyaWdodG5lc3MoXCIrKDErcCkrXCIpIGNvbnRyYXN0KFwiKygxKy4yNSpwKStcIilcIn07aWYodC5zaGlmdEtleSYmKDM4PT10LmtleUNvZGU/KHArPS4xLGUocCkpOjQwPT10LmtleUNvZGU/KHAtPS4xLGUocCkpOjQ4PT10LmtleUNvZGUmJihwPTAsZShwKSkpLGNvbnNvbGUubG9nKHQua2V5Q29kZSksODI9PXQua2V5Q29kZSl7dmFyIGE9ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5yb3RhdGUsIC5zcGluXCIpO2ZvcihpPTA7aTxhLmxlbmd0aDtpKyspYVtpXS5jbGFzc0xpc3QudG9nZ2xlKFwib25cIil9fSk7dmFyIGw9ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5hbmltYXRlXCIpLGQ9ZnVuY3Rpb24odCl7dC50YXJnZXQuY2xhc3NMaXN0LnJlbW92ZShcImFuaW1hdGVkXCIpfTtBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKGwsZnVuY3Rpb24odCxlKXt0LmFkZEV2ZW50TGlzdGVuZXIoXCJ3ZWJraXRBbmltYXRpb25FbmRcIixkKSx0LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3pBbmltYXRpb25FbmRcIixkKSx0LmFkZEV2ZW50TGlzdGVuZXIoXCJNU0FuaW1hdGlvbkVuZFwiLGQpLHQuYWRkRXZlbnRMaXN0ZW5lcihcIm9hbmltYXRpb25lbmRcIixkKSx0LmFkZEV2ZW50TGlzdGVuZXIoXCJhbmltYXRpb25lbmRcIixkKX0pO3ZhciBjPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaW5rXCIpO2MucmVsPVwiaW1wb3J0XCIsYy5ocmVmPVwieC1naWYveC1naWYuaHRtbFwiLGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYyk7dmFyIGc9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpbmtcIik7Zy5yZWw9XCJzdHlsZXNoZWV0XCIsZy50eXBlPVwidGV4dC9jc3NcIixnLmhyZWY9XCJodHRwOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzP2ZhbWlseT1Db3VyZ2V0dGV8RHJvaWQrU2Fuc1wiLGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZyl9LHtcImJlc3Bva2UtY2xhc3Nlc1wiOjIsXCJpbnNlcnQtY3NzXCI6M31dLDI6W2Z1bmN0aW9uKHQsZSxhKXtlLmV4cG9ydHM9ZnVuY3Rpb24oKXtyZXR1cm4gZnVuY3Rpb24odCl7dmFyIGU9ZnVuY3Rpb24odCxlKXt0LmNsYXNzTGlzdC5hZGQoXCJiZXNwb2tlLVwiK2UpfSxhPWZ1bmN0aW9uKHQsZSl7dC5jbGFzc05hbWU9dC5jbGFzc05hbWUucmVwbGFjZShuZXcgUmVnRXhwKFwiYmVzcG9rZS1cIitlK1wiKFxcXFxzfCQpXCIsXCJnXCIpLFwiIFwiKS50cmltKCl9LG49ZnVuY3Rpb24obixvKXt2YXIgcj10LnNsaWRlc1t0LnNsaWRlKCldLGk9by10LnNsaWRlKCkscz1pPjA/XCJhZnRlclwiOlwiYmVmb3JlXCI7W1wiYmVmb3JlKC1cXFxcZCspP1wiLFwiYWZ0ZXIoLVxcXFxkKyk/XCIsXCJhY3RpdmVcIixcImluYWN0aXZlXCJdLm1hcChhLmJpbmQobnVsbCxuKSksbiE9PXImJltcImluYWN0aXZlXCIscyxzK1wiLVwiK01hdGguYWJzKGkpXS5tYXAoZS5iaW5kKG51bGwsbikpfTtlKHQucGFyZW50LFwicGFyZW50XCIpLHQuc2xpZGVzLm1hcChmdW5jdGlvbih0KXtlKHQsXCJzbGlkZVwiKX0pLHQub24oXCJhY3RpdmF0ZVwiLGZ1bmN0aW9uKG8pe3Quc2xpZGVzLm1hcChuKSxlKG8uc2xpZGUsXCJhY3RpdmVcIiksYShvLnNsaWRlLFwiaW5hY3RpdmVcIil9KX19fSx7fV0sMzpbZnVuY3Rpb24odCxlLGEpe2Z1bmN0aW9uIG4oKXt2YXIgdD1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7cmV0dXJuIHQuc2V0QXR0cmlidXRlKFwidHlwZVwiLFwidGV4dC9jc3NcIiksdH12YXIgbz1bXSxyPVtdO2UuZXhwb3J0cz1mdW5jdGlvbih0LGUpe2U9ZXx8e307dmFyIGE9ZS5wcmVwZW5kPT09ITA/XCJwcmVwZW5kXCI6XCJhcHBlbmRcIixpPXZvaWQgMCE9PWUuY29udGFpbmVyP2UuY29udGFpbmVyOmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJoZWFkXCIpLHM9by5pbmRleE9mKGkpO3M9PT0tMSYmKHM9by5wdXNoKGkpLTEscltzXT17fSk7dmFyIG07cmV0dXJuIHZvaWQgMCE9PXJbc10mJnZvaWQgMCE9PXJbc11bYV0/bT1yW3NdW2FdOihtPXJbc11bYV09bigpLFwicHJlcGVuZFwiPT09YT9pLmluc2VydEJlZm9yZShtLGkuY2hpbGROb2Rlc1swXSk6aS5hcHBlbmRDaGlsZChtKSksbS5zdHlsZVNoZWV0P20uc3R5bGVTaGVldC5jc3NUZXh0Kz10Om0udGV4dENvbnRlbnQrPXQsbX19LHt9XX0se30sWzFdKSgxKX0pO1xufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcclxuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xyXG4gICAgdmFyIGF4aXMgPSBvcHRpb25zID09ICd2ZXJ0aWNhbCcgPyAnWScgOiAnWCcsXHJcbiAgICAgIHN0YXJ0UG9zaXRpb24sXHJcbiAgICAgIGRlbHRhO1xyXG5cclxuICAgIGRlY2sucGFyZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGlmIChlLnRvdWNoZXMubGVuZ3RoID09IDEpIHtcclxuICAgICAgICBzdGFydFBvc2l0aW9uID0gZS50b3VjaGVzWzBdWydwYWdlJyArIGF4aXNdO1xyXG4gICAgICAgIGRlbHRhID0gMDtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgZGVjay5wYXJlbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICBpZiAoZS50b3VjaGVzLmxlbmd0aCA9PSAxKSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGRlbHRhID0gZS50b3VjaGVzWzBdWydwYWdlJyArIGF4aXNdIC0gc3RhcnRQb3NpdGlvbjtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgZGVjay5wYXJlbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCBmdW5jdGlvbigpIHtcclxuICAgICAgaWYgKE1hdGguYWJzKGRlbHRhKSA+IDUwKSB7XHJcbiAgICAgICAgZGVja1tkZWx0YSA+IDAgPyAncHJldicgOiAnbmV4dCddKCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH07XHJcbn07XHJcbiIsInZhciBmcm9tID0gZnVuY3Rpb24ob3B0cywgcGx1Z2lucykge1xyXG4gIHZhciBwYXJlbnQgPSAob3B0cy5wYXJlbnQgfHwgb3B0cykubm9kZVR5cGUgPT09IDEgPyAob3B0cy5wYXJlbnQgfHwgb3B0cykgOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKG9wdHMucGFyZW50IHx8IG9wdHMpLFxyXG4gICAgc2xpZGVzID0gW10uZmlsdGVyLmNhbGwodHlwZW9mIG9wdHMuc2xpZGVzID09PSAnc3RyaW5nJyA/IHBhcmVudC5xdWVyeVNlbGVjdG9yQWxsKG9wdHMuc2xpZGVzKSA6IChvcHRzLnNsaWRlcyB8fCBwYXJlbnQuY2hpbGRyZW4pLCBmdW5jdGlvbihlbCkgeyByZXR1cm4gZWwubm9kZU5hbWUgIT09ICdTQ1JJUFQnOyB9KSxcclxuICAgIGFjdGl2ZVNsaWRlID0gc2xpZGVzWzBdLFxyXG4gICAgbGlzdGVuZXJzID0ge30sXHJcblxyXG4gICAgYWN0aXZhdGUgPSBmdW5jdGlvbihpbmRleCwgY3VzdG9tRGF0YSkge1xyXG4gICAgICBpZiAoIXNsaWRlc1tpbmRleF0pIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGZpcmUoJ2RlYWN0aXZhdGUnLCBjcmVhdGVFdmVudERhdGEoYWN0aXZlU2xpZGUsIGN1c3RvbURhdGEpKTtcclxuICAgICAgYWN0aXZlU2xpZGUgPSBzbGlkZXNbaW5kZXhdO1xyXG4gICAgICBmaXJlKCdhY3RpdmF0ZScsIGNyZWF0ZUV2ZW50RGF0YShhY3RpdmVTbGlkZSwgY3VzdG9tRGF0YSkpO1xyXG4gICAgfSxcclxuXHJcbiAgICBzbGlkZSA9IGZ1bmN0aW9uKGluZGV4LCBjdXN0b21EYXRhKSB7XHJcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoKSB7XHJcbiAgICAgICAgZmlyZSgnc2xpZGUnLCBjcmVhdGVFdmVudERhdGEoc2xpZGVzW2luZGV4XSwgY3VzdG9tRGF0YSkpICYmIGFjdGl2YXRlKGluZGV4LCBjdXN0b21EYXRhKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gc2xpZGVzLmluZGV4T2YoYWN0aXZlU2xpZGUpO1xyXG4gICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIHN0ZXAgPSBmdW5jdGlvbihvZmZzZXQsIGN1c3RvbURhdGEpIHtcclxuICAgICAgdmFyIHNsaWRlSW5kZXggPSBzbGlkZXMuaW5kZXhPZihhY3RpdmVTbGlkZSkgKyBvZmZzZXQ7XHJcblxyXG4gICAgICBmaXJlKG9mZnNldCA+IDAgPyAnbmV4dCcgOiAncHJldicsIGNyZWF0ZUV2ZW50RGF0YShhY3RpdmVTbGlkZSwgY3VzdG9tRGF0YSkpICYmIGFjdGl2YXRlKHNsaWRlSW5kZXgsIGN1c3RvbURhdGEpO1xyXG4gICAgfSxcclxuXHJcbiAgICBvbiA9IGZ1bmN0aW9uKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcclxuICAgICAgKGxpc3RlbmVyc1tldmVudE5hbWVdIHx8IChsaXN0ZW5lcnNbZXZlbnROYW1lXSA9IFtdKSkucHVzaChjYWxsYmFjayk7XHJcbiAgICAgIHJldHVybiBvZmYuYmluZChudWxsLCBldmVudE5hbWUsIGNhbGxiYWNrKTtcclxuICAgIH0sXHJcblxyXG4gICAgb2ZmID0gZnVuY3Rpb24oZXZlbnROYW1lLCBjYWxsYmFjaykge1xyXG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXSA9IChsaXN0ZW5lcnNbZXZlbnROYW1lXSB8fCBbXSkuZmlsdGVyKGZ1bmN0aW9uKGxpc3RlbmVyKSB7IHJldHVybiBsaXN0ZW5lciAhPT0gY2FsbGJhY2s7IH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICBmaXJlID0gZnVuY3Rpb24oZXZlbnROYW1lLCBldmVudERhdGEpIHtcclxuICAgICAgcmV0dXJuIChsaXN0ZW5lcnNbZXZlbnROYW1lXSB8fCBbXSlcclxuICAgICAgICAucmVkdWNlKGZ1bmN0aW9uKG5vdENhbmNlbGxlZCwgY2FsbGJhY2spIHtcclxuICAgICAgICAgIHJldHVybiBub3RDYW5jZWxsZWQgJiYgY2FsbGJhY2soZXZlbnREYXRhKSAhPT0gZmFsc2U7XHJcbiAgICAgICAgfSwgdHJ1ZSk7XHJcbiAgICB9LFxyXG5cclxuICAgIGNyZWF0ZUV2ZW50RGF0YSA9IGZ1bmN0aW9uKGVsLCBldmVudERhdGEpIHtcclxuICAgICAgZXZlbnREYXRhID0gZXZlbnREYXRhIHx8IHt9O1xyXG4gICAgICBldmVudERhdGEuaW5kZXggPSBzbGlkZXMuaW5kZXhPZihlbCk7XHJcbiAgICAgIGV2ZW50RGF0YS5zbGlkZSA9IGVsO1xyXG4gICAgICByZXR1cm4gZXZlbnREYXRhO1xyXG4gICAgfSxcclxuXHJcbiAgICBkZWNrID0ge1xyXG4gICAgICBvbjogb24sXHJcbiAgICAgIG9mZjogb2ZmLFxyXG4gICAgICBmaXJlOiBmaXJlLFxyXG4gICAgICBzbGlkZTogc2xpZGUsXHJcbiAgICAgIG5leHQ6IHN0ZXAuYmluZChudWxsLCAxKSxcclxuICAgICAgcHJldjogc3RlcC5iaW5kKG51bGwsIC0xKSxcclxuICAgICAgcGFyZW50OiBwYXJlbnQsXHJcbiAgICAgIHNsaWRlczogc2xpZGVzXHJcbiAgICB9O1xyXG5cclxuICAocGx1Z2lucyB8fCBbXSkuZm9yRWFjaChmdW5jdGlvbihwbHVnaW4pIHtcclxuICAgIHBsdWdpbihkZWNrKTtcclxuICB9KTtcclxuXHJcbiAgYWN0aXZhdGUoMCk7XHJcblxyXG4gIHJldHVybiBkZWNrO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgZnJvbTogZnJvbVxyXG59O1xyXG4iLCIvLyBSZXF1aXJlIE5vZGUgbW9kdWxlcyBpbiB0aGUgYnJvd3NlciB0aGFua3MgdG8gQnJvd3NlcmlmeTogaHR0cDovL2Jyb3dzZXJpZnkub3JnXHJcbnZhciBiZXNwb2tlID0gcmVxdWlyZSgnYmVzcG9rZScpLFxyXG4gIFxyXG4gIGN1YmUgPSByZXF1aXJlKCdiZXNwb2tlLXRoZW1lLWN1YmUnKSxcclxuICBrZXlzID0gcmVxdWlyZSgnYmVzcG9rZS1rZXlzJyksXHJcbiAgdG91Y2ggPSByZXF1aXJlKCdiZXNwb2tlLXRvdWNoJyksXHJcbiAgYnVsbGV0cyA9IHJlcXVpcmUoJ2Jlc3Bva2UtYnVsbGV0cycpLFxyXG4gIGJhY2tkcm9wID0gcmVxdWlyZSgnYmVzcG9rZS1iYWNrZHJvcCcpLFxyXG4gIHNjYWxlID0gcmVxdWlyZSgnYmVzcG9rZS1zY2FsZScpLFxyXG4gIGhhc2ggPSByZXF1aXJlKCdiZXNwb2tlLWhhc2gnKSxcclxuICBwcm9ncmVzcyA9IHJlcXVpcmUoJ2Jlc3Bva2UtcHJvZ3Jlc3MnKSxcclxuICBmb3JtcyA9IHJlcXVpcmUoJ2Jlc3Bva2UtZm9ybXMnKTtcclxuXHJcbi8vIEJlc3Bva2UuanNcclxuYmVzcG9rZS5mcm9tKCdhcnRpY2xlJywgW1xyXG4gIGN1YmUoKSxcclxuICBrZXlzKCksXHJcbiAgdG91Y2goKSxcclxuICBidWxsZXRzKCdsaSwgLmJ1bGxldCcpLFxyXG4gIGJhY2tkcm9wKCksXHJcbiAgc2NhbGUoKSxcclxuICBoYXNoKCksXHJcbiAgcHJvZ3Jlc3MoKSxcclxuICBmb3JtcygpXHJcbl0pO1xyXG5cclxuLy8gUHJpc20gc3ludGF4IGhpZ2hsaWdodGluZ1xyXG4vLyBUaGlzIGlzIGFjdHVhbGx5IGxvYWRlZCBmcm9tIFwiYm93ZXJfY29tcG9uZW50c1wiIHRoYW5rcyB0b1xyXG4vLyBkZWJvd2VyaWZ5OiBodHRwczovL2dpdGh1Yi5jb20vZXVnZW5ld2FyZS9kZWJvd2VyaWZ5XHJcbnJlcXVpcmUoXCIuLy4uXFxcXC4uXFxcXGJvd2VyX2NvbXBvbmVudHNcXFxccHJpc21cXFxccHJpc20uanNcIik7XHJcblxyXG4iXX0=
