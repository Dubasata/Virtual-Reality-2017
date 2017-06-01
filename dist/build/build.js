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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkQ6XFxNaWtyb3NraWxcXFRLUFBMXFxWaXJ0dWFsLVJlYWxpdHktMjAxN1xcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiRDovTWlrcm9za2lsL1RLUFBML1ZpcnR1YWwtUmVhbGl0eS0yMDE3L2Jvd2VyX2NvbXBvbmVudHMvcHJpc20vcHJpc20uanMiLCJEOi9NaWtyb3NraWwvVEtQUEwvVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtYmFja2Ryb3AvbGliL2Jlc3Bva2UtYmFja2Ryb3AuanMiLCJEOi9NaWtyb3NraWwvVEtQUEwvVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtYnVsbGV0cy9saWIvYmVzcG9rZS1idWxsZXRzLmpzIiwiRDovTWlrcm9za2lsL1RLUFBML1ZpcnR1YWwtUmVhbGl0eS0yMDE3L25vZGVfbW9kdWxlcy9iZXNwb2tlLWZvcm1zL2xpYi9iZXNwb2tlLWZvcm1zLmpzIiwiRDovTWlrcm9za2lsL1RLUFBML1ZpcnR1YWwtUmVhbGl0eS0yMDE3L25vZGVfbW9kdWxlcy9iZXNwb2tlLWhhc2gvbGliL2Jlc3Bva2UtaGFzaC5qcyIsIkQ6L01pa3Jvc2tpbC9US1BQTC9WaXJ0dWFsLVJlYWxpdHktMjAxNy9ub2RlX21vZHVsZXMvYmVzcG9rZS1rZXlzL2xpYi9iZXNwb2tlLWtleXMuanMiLCJEOi9NaWtyb3NraWwvVEtQUEwvVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtcHJvZ3Jlc3MvbGliL2Jlc3Bva2UtcHJvZ3Jlc3MuanMiLCJEOi9NaWtyb3NraWwvVEtQUEwvVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2Utc2NhbGUvbGliL2Jlc3Bva2Utc2NhbGUuanMiLCJEOi9NaWtyb3NraWwvVEtQUEwvVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtdGhlbWUtY3ViZS9kaXN0L2Jlc3Bva2UtdGhlbWUtYXRvbWFudGljLm1pbi5qcyIsIkQ6L01pa3Jvc2tpbC9US1BQTC9WaXJ0dWFsLVJlYWxpdHktMjAxNy9ub2RlX21vZHVsZXMvYmVzcG9rZS10b3VjaC9saWIvYmVzcG9rZS10b3VjaC5qcyIsIkQ6L01pa3Jvc2tpbC9US1BQTC9WaXJ0dWFsLVJlYWxpdHktMjAxNy9ub2RlX21vZHVsZXMvYmVzcG9rZS9saWIvYmVzcG9rZS5qcyIsIkQ6L01pa3Jvc2tpbC9US1BQTC9WaXJ0dWFsLVJlYWxpdHktMjAxNy9zcmMvc2NyaXB0cy9mYWtlX2M2Njc3MTdkLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY29yZS5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG52YXIgX3NlbGYgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpXG5cdD8gd2luZG93ICAgLy8gaWYgaW4gYnJvd3NlclxuXHQ6IChcblx0XHQodHlwZW9mIFdvcmtlckdsb2JhbFNjb3BlICE9PSAndW5kZWZpbmVkJyAmJiBzZWxmIGluc3RhbmNlb2YgV29ya2VyR2xvYmFsU2NvcGUpXG5cdFx0PyBzZWxmIC8vIGlmIGluIHdvcmtlclxuXHRcdDoge30gICAvLyBpZiBpbiBub2RlIGpzXG5cdCk7XG5cbi8qKlxuICogUHJpc206IExpZ2h0d2VpZ2h0LCByb2J1c3QsIGVsZWdhbnQgc3ludGF4IGhpZ2hsaWdodGluZ1xuICogTUlUIGxpY2Vuc2UgaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHAvXG4gKiBAYXV0aG9yIExlYSBWZXJvdSBodHRwOi8vbGVhLnZlcm91Lm1lXG4gKi9cblxudmFyIFByaXNtID0gKGZ1bmN0aW9uKCl7XG5cbi8vIFByaXZhdGUgaGVscGVyIHZhcnNcbnZhciBsYW5nID0gL1xcYmxhbmcoPzp1YWdlKT8tKFxcdyspXFxiL2k7XG52YXIgdW5pcXVlSWQgPSAwO1xuXG52YXIgXyA9IF9zZWxmLlByaXNtID0ge1xuXHRtYW51YWw6IF9zZWxmLlByaXNtICYmIF9zZWxmLlByaXNtLm1hbnVhbCxcblx0dXRpbDoge1xuXHRcdGVuY29kZTogZnVuY3Rpb24gKHRva2Vucykge1xuXHRcdFx0aWYgKHRva2VucyBpbnN0YW5jZW9mIFRva2VuKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgVG9rZW4odG9rZW5zLnR5cGUsIF8udXRpbC5lbmNvZGUodG9rZW5zLmNvbnRlbnQpLCB0b2tlbnMuYWxpYXMpO1xuXHRcdFx0fSBlbHNlIGlmIChfLnV0aWwudHlwZSh0b2tlbnMpID09PSAnQXJyYXknKSB7XG5cdFx0XHRcdHJldHVybiB0b2tlbnMubWFwKF8udXRpbC5lbmNvZGUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHRva2Vucy5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoLzwvZywgJyZsdDsnKS5yZXBsYWNlKC9cXHUwMGEwL2csICcgJyk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdHR5cGU6IGZ1bmN0aW9uIChvKSB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pLm1hdGNoKC9cXFtvYmplY3QgKFxcdyspXFxdLylbMV07XG5cdFx0fSxcblxuXHRcdG9iaklkOiBmdW5jdGlvbiAob2JqKSB7XG5cdFx0XHRpZiAoIW9ialsnX19pZCddKSB7XG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosICdfX2lkJywgeyB2YWx1ZTogKyt1bmlxdWVJZCB9KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBvYmpbJ19faWQnXTtcblx0XHR9LFxuXG5cdFx0Ly8gRGVlcCBjbG9uZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gKGUuZy4gdG8gZXh0ZW5kIGl0KVxuXHRcdGNsb25lOiBmdW5jdGlvbiAobykge1xuXHRcdFx0dmFyIHR5cGUgPSBfLnV0aWwudHlwZShvKTtcblxuXHRcdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRcdGNhc2UgJ09iamVjdCc6XG5cdFx0XHRcdFx0dmFyIGNsb25lID0ge307XG5cblx0XHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gbykge1xuXHRcdFx0XHRcdFx0aWYgKG8uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0XHRcdFx0XHRjbG9uZVtrZXldID0gXy51dGlsLmNsb25lKG9ba2V5XSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIGNsb25lO1xuXG5cdFx0XHRcdGNhc2UgJ0FycmF5Jzpcblx0XHRcdFx0XHQvLyBDaGVjayBmb3IgZXhpc3RlbmNlIGZvciBJRThcblx0XHRcdFx0XHRyZXR1cm4gby5tYXAgJiYgby5tYXAoZnVuY3Rpb24odikgeyByZXR1cm4gXy51dGlsLmNsb25lKHYpOyB9KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG87XG5cdFx0fVxuXHR9LFxuXG5cdGxhbmd1YWdlczoge1xuXHRcdGV4dGVuZDogZnVuY3Rpb24gKGlkLCByZWRlZikge1xuXHRcdFx0dmFyIGxhbmcgPSBfLnV0aWwuY2xvbmUoXy5sYW5ndWFnZXNbaWRdKTtcblxuXHRcdFx0Zm9yICh2YXIga2V5IGluIHJlZGVmKSB7XG5cdFx0XHRcdGxhbmdba2V5XSA9IHJlZGVmW2tleV07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBsYW5nO1xuXHRcdH0sXG5cblx0XHQvKipcblx0XHQgKiBJbnNlcnQgYSB0b2tlbiBiZWZvcmUgYW5vdGhlciB0b2tlbiBpbiBhIGxhbmd1YWdlIGxpdGVyYWxcblx0XHQgKiBBcyB0aGlzIG5lZWRzIHRvIHJlY3JlYXRlIHRoZSBvYmplY3QgKHdlIGNhbm5vdCBhY3R1YWxseSBpbnNlcnQgYmVmb3JlIGtleXMgaW4gb2JqZWN0IGxpdGVyYWxzKSxcblx0XHQgKiB3ZSBjYW5ub3QganVzdCBwcm92aWRlIGFuIG9iamVjdCwgd2UgbmVlZCBhbm9iamVjdCBhbmQgYSBrZXkuXG5cdFx0ICogQHBhcmFtIGluc2lkZSBUaGUga2V5IChvciBsYW5ndWFnZSBpZCkgb2YgdGhlIHBhcmVudFxuXHRcdCAqIEBwYXJhbSBiZWZvcmUgVGhlIGtleSB0byBpbnNlcnQgYmVmb3JlLiBJZiBub3QgcHJvdmlkZWQsIHRoZSBmdW5jdGlvbiBhcHBlbmRzIGluc3RlYWQuXG5cdFx0ICogQHBhcmFtIGluc2VydCBPYmplY3Qgd2l0aCB0aGUga2V5L3ZhbHVlIHBhaXJzIHRvIGluc2VydFxuXHRcdCAqIEBwYXJhbSByb290IFRoZSBvYmplY3QgdGhhdCBjb250YWlucyBgaW5zaWRlYC4gSWYgZXF1YWwgdG8gUHJpc20ubGFuZ3VhZ2VzLCBpdCBjYW4gYmUgb21pdHRlZC5cblx0XHQgKi9cblx0XHRpbnNlcnRCZWZvcmU6IGZ1bmN0aW9uIChpbnNpZGUsIGJlZm9yZSwgaW5zZXJ0LCByb290KSB7XG5cdFx0XHRyb290ID0gcm9vdCB8fCBfLmxhbmd1YWdlcztcblx0XHRcdHZhciBncmFtbWFyID0gcm9vdFtpbnNpZGVdO1xuXG5cdFx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAyKSB7XG5cdFx0XHRcdGluc2VydCA9IGFyZ3VtZW50c1sxXTtcblxuXHRcdFx0XHRmb3IgKHZhciBuZXdUb2tlbiBpbiBpbnNlcnQpIHtcblx0XHRcdFx0XHRpZiAoaW5zZXJ0Lmhhc093blByb3BlcnR5KG5ld1Rva2VuKSkge1xuXHRcdFx0XHRcdFx0Z3JhbW1hcltuZXdUb2tlbl0gPSBpbnNlcnRbbmV3VG9rZW5dO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBncmFtbWFyO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgcmV0ID0ge307XG5cblx0XHRcdGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcblxuXHRcdFx0XHRpZiAoZ3JhbW1hci5oYXNPd25Qcm9wZXJ0eSh0b2tlbikpIHtcblxuXHRcdFx0XHRcdGlmICh0b2tlbiA9PSBiZWZvcmUpIHtcblxuXHRcdFx0XHRcdFx0Zm9yICh2YXIgbmV3VG9rZW4gaW4gaW5zZXJ0KSB7XG5cblx0XHRcdFx0XHRcdFx0aWYgKGluc2VydC5oYXNPd25Qcm9wZXJ0eShuZXdUb2tlbikpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXRbbmV3VG9rZW5dID0gaW5zZXJ0W25ld1Rva2VuXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldFt0b2tlbl0gPSBncmFtbWFyW3Rva2VuXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBVcGRhdGUgcmVmZXJlbmNlcyBpbiBvdGhlciBsYW5ndWFnZSBkZWZpbml0aW9uc1xuXHRcdFx0Xy5sYW5ndWFnZXMuREZTKF8ubGFuZ3VhZ2VzLCBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG5cdFx0XHRcdGlmICh2YWx1ZSA9PT0gcm9vdFtpbnNpZGVdICYmIGtleSAhPSBpbnNpZGUpIHtcblx0XHRcdFx0XHR0aGlzW2tleV0gPSByZXQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gcm9vdFtpbnNpZGVdID0gcmV0O1xuXHRcdH0sXG5cblx0XHQvLyBUcmF2ZXJzZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gd2l0aCBEZXB0aCBGaXJzdCBTZWFyY2hcblx0XHRERlM6IGZ1bmN0aW9uKG8sIGNhbGxiYWNrLCB0eXBlLCB2aXNpdGVkKSB7XG5cdFx0XHR2aXNpdGVkID0gdmlzaXRlZCB8fCB7fTtcblx0XHRcdGZvciAodmFyIGkgaW4gbykge1xuXHRcdFx0XHRpZiAoby5oYXNPd25Qcm9wZXJ0eShpKSkge1xuXHRcdFx0XHRcdGNhbGxiYWNrLmNhbGwobywgaSwgb1tpXSwgdHlwZSB8fCBpKTtcblxuXHRcdFx0XHRcdGlmIChfLnV0aWwudHlwZShvW2ldKSA9PT0gJ09iamVjdCcgJiYgIXZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSkge1xuXHRcdFx0XHRcdFx0dmlzaXRlZFtfLnV0aWwub2JqSWQob1tpXSldID0gdHJ1ZTtcblx0XHRcdFx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhvW2ldLCBjYWxsYmFjaywgbnVsbCwgdmlzaXRlZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgaWYgKF8udXRpbC50eXBlKG9baV0pID09PSAnQXJyYXknICYmICF2aXNpdGVkW18udXRpbC5vYmpJZChvW2ldKV0pIHtcblx0XHRcdFx0XHRcdHZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRfLmxhbmd1YWdlcy5ERlMob1tpXSwgY2FsbGJhY2ssIGksIHZpc2l0ZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSxcblx0cGx1Z2luczoge30sXG5cblx0aGlnaGxpZ2h0QWxsOiBmdW5jdGlvbihhc3luYywgY2FsbGJhY2spIHtcblx0XHR2YXIgZW52ID0ge1xuXHRcdFx0Y2FsbGJhY2s6IGNhbGxiYWNrLFxuXHRcdFx0c2VsZWN0b3I6ICdjb2RlW2NsYXNzKj1cImxhbmd1YWdlLVwiXSwgW2NsYXNzKj1cImxhbmd1YWdlLVwiXSBjb2RlLCBjb2RlW2NsYXNzKj1cImxhbmctXCJdLCBbY2xhc3MqPVwibGFuZy1cIl0gY29kZSdcblx0XHR9O1xuXG5cdFx0Xy5ob29rcy5ydW4oXCJiZWZvcmUtaGlnaGxpZ2h0YWxsXCIsIGVudik7XG5cblx0XHR2YXIgZWxlbWVudHMgPSBlbnYuZWxlbWVudHMgfHwgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChlbnYuc2VsZWN0b3IpO1xuXG5cdFx0Zm9yICh2YXIgaT0wLCBlbGVtZW50OyBlbGVtZW50ID0gZWxlbWVudHNbaSsrXTspIHtcblx0XHRcdF8uaGlnaGxpZ2h0RWxlbWVudChlbGVtZW50LCBhc3luYyA9PT0gdHJ1ZSwgZW52LmNhbGxiYWNrKTtcblx0XHR9XG5cdH0sXG5cblx0aGlnaGxpZ2h0RWxlbWVudDogZnVuY3Rpb24oZWxlbWVudCwgYXN5bmMsIGNhbGxiYWNrKSB7XG5cdFx0Ly8gRmluZCBsYW5ndWFnZVxuXHRcdHZhciBsYW5ndWFnZSwgZ3JhbW1hciwgcGFyZW50ID0gZWxlbWVudDtcblxuXHRcdHdoaWxlIChwYXJlbnQgJiYgIWxhbmcudGVzdChwYXJlbnQuY2xhc3NOYW1lKSkge1xuXHRcdFx0cGFyZW50ID0gcGFyZW50LnBhcmVudE5vZGU7XG5cdFx0fVxuXG5cdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0bGFuZ3VhZ2UgPSAocGFyZW50LmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCcnXSlbMV0udG9Mb3dlckNhc2UoKTtcblx0XHRcdGdyYW1tYXIgPSBfLmxhbmd1YWdlc1tsYW5ndWFnZV07XG5cdFx0fVxuXG5cdFx0Ly8gU2V0IGxhbmd1YWdlIG9uIHRoZSBlbGVtZW50LCBpZiBub3QgcHJlc2VudFxuXHRcdGVsZW1lbnQuY2xhc3NOYW1lID0gZWxlbWVudC5jbGFzc05hbWUucmVwbGFjZShsYW5nLCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpICsgJyBsYW5ndWFnZS0nICsgbGFuZ3VhZ2U7XG5cblx0XHQvLyBTZXQgbGFuZ3VhZ2Ugb24gdGhlIHBhcmVudCwgZm9yIHN0eWxpbmdcblx0XHRwYXJlbnQgPSBlbGVtZW50LnBhcmVudE5vZGU7XG5cblx0XHRpZiAoL3ByZS9pLnRlc3QocGFyZW50Lm5vZGVOYW1lKSkge1xuXHRcdFx0cGFyZW50LmNsYXNzTmFtZSA9IHBhcmVudC5jbGFzc05hbWUucmVwbGFjZShsYW5nLCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpICsgJyBsYW5ndWFnZS0nICsgbGFuZ3VhZ2U7XG5cdFx0fVxuXG5cdFx0dmFyIGNvZGUgPSBlbGVtZW50LnRleHRDb250ZW50O1xuXG5cdFx0dmFyIGVudiA9IHtcblx0XHRcdGVsZW1lbnQ6IGVsZW1lbnQsXG5cdFx0XHRsYW5ndWFnZTogbGFuZ3VhZ2UsXG5cdFx0XHRncmFtbWFyOiBncmFtbWFyLFxuXHRcdFx0Y29kZTogY29kZVxuXHRcdH07XG5cblx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLXNhbml0eS1jaGVjaycsIGVudik7XG5cblx0XHRpZiAoIWVudi5jb2RlIHx8ICFlbnYuZ3JhbW1hcikge1xuXHRcdFx0aWYgKGVudi5jb2RlKSB7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaGlnaGxpZ2h0JywgZW52KTtcblx0XHRcdFx0ZW52LmVsZW1lbnQudGV4dENvbnRlbnQgPSBlbnYuY29kZTtcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0XHR9XG5cdFx0XHRfLmhvb2tzLnJ1bignY29tcGxldGUnLCBlbnYpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaGlnaGxpZ2h0JywgZW52KTtcblxuXHRcdGlmIChhc3luYyAmJiBfc2VsZi5Xb3JrZXIpIHtcblx0XHRcdHZhciB3b3JrZXIgPSBuZXcgV29ya2VyKF8uZmlsZW5hbWUpO1xuXG5cdFx0XHR3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdGVudi5oaWdobGlnaHRlZENvZGUgPSBldnQuZGF0YTtcblxuXHRcdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWluc2VydCcsIGVudik7XG5cblx0XHRcdFx0ZW52LmVsZW1lbnQuaW5uZXJIVE1MID0gZW52LmhpZ2hsaWdodGVkQ29kZTtcblxuXHRcdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjay5jYWxsKGVudi5lbGVtZW50KTtcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XG5cdFx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XG5cdFx0XHR9O1xuXG5cdFx0XHR3b3JrZXIucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRsYW5ndWFnZTogZW52Lmxhbmd1YWdlLFxuXHRcdFx0XHRjb2RlOiBlbnYuY29kZSxcblx0XHRcdFx0aW1tZWRpYXRlQ2xvc2U6IHRydWVcblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRlbnYuaGlnaGxpZ2h0ZWRDb2RlID0gXy5oaWdobGlnaHQoZW52LmNvZGUsIGVudi5ncmFtbWFyLCBlbnYubGFuZ3VhZ2UpO1xuXG5cdFx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWluc2VydCcsIGVudik7XG5cblx0XHRcdGVudi5lbGVtZW50LmlubmVySFRNTCA9IGVudi5oaWdobGlnaHRlZENvZGU7XG5cblx0XHRcdGNhbGxiYWNrICYmIGNhbGxiYWNrLmNhbGwoZWxlbWVudCk7XG5cblx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xuXHRcdFx0Xy5ob29rcy5ydW4oJ2NvbXBsZXRlJywgZW52KTtcblx0XHR9XG5cdH0sXG5cblx0aGlnaGxpZ2h0OiBmdW5jdGlvbiAodGV4dCwgZ3JhbW1hciwgbGFuZ3VhZ2UpIHtcblx0XHR2YXIgdG9rZW5zID0gXy50b2tlbml6ZSh0ZXh0LCBncmFtbWFyKTtcblx0XHRyZXR1cm4gVG9rZW4uc3RyaW5naWZ5KF8udXRpbC5lbmNvZGUodG9rZW5zKSwgbGFuZ3VhZ2UpO1xuXHR9LFxuXG5cdG1hdGNoR3JhbW1hcjogZnVuY3Rpb24gKHRleHQsIHN0cmFyciwgZ3JhbW1hciwgaW5kZXgsIHN0YXJ0UG9zLCBvbmVzaG90LCB0YXJnZXQpIHtcblx0XHR2YXIgVG9rZW4gPSBfLlRva2VuO1xuXG5cdFx0Zm9yICh2YXIgdG9rZW4gaW4gZ3JhbW1hcikge1xuXHRcdFx0aWYoIWdyYW1tYXIuaGFzT3duUHJvcGVydHkodG9rZW4pIHx8ICFncmFtbWFyW3Rva2VuXSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRva2VuID09IHRhcmdldCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHZhciBwYXR0ZXJucyA9IGdyYW1tYXJbdG9rZW5dO1xuXHRcdFx0cGF0dGVybnMgPSAoXy51dGlsLnR5cGUocGF0dGVybnMpID09PSBcIkFycmF5XCIpID8gcGF0dGVybnMgOiBbcGF0dGVybnNdO1xuXG5cdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IHBhdHRlcm5zLmxlbmd0aDsgKytqKSB7XG5cdFx0XHRcdHZhciBwYXR0ZXJuID0gcGF0dGVybnNbal0sXG5cdFx0XHRcdFx0aW5zaWRlID0gcGF0dGVybi5pbnNpZGUsXG5cdFx0XHRcdFx0bG9va2JlaGluZCA9ICEhcGF0dGVybi5sb29rYmVoaW5kLFxuXHRcdFx0XHRcdGdyZWVkeSA9ICEhcGF0dGVybi5ncmVlZHksXG5cdFx0XHRcdFx0bG9va2JlaGluZExlbmd0aCA9IDAsXG5cdFx0XHRcdFx0YWxpYXMgPSBwYXR0ZXJuLmFsaWFzO1xuXG5cdFx0XHRcdGlmIChncmVlZHkgJiYgIXBhdHRlcm4ucGF0dGVybi5nbG9iYWwpIHtcblx0XHRcdFx0XHQvLyBXaXRob3V0IHRoZSBnbG9iYWwgZmxhZywgbGFzdEluZGV4IHdvbid0IHdvcmtcblx0XHRcdFx0XHR2YXIgZmxhZ3MgPSBwYXR0ZXJuLnBhdHRlcm4udG9TdHJpbmcoKS5tYXRjaCgvW2ltdXldKiQvKVswXTtcblx0XHRcdFx0XHRwYXR0ZXJuLnBhdHRlcm4gPSBSZWdFeHAocGF0dGVybi5wYXR0ZXJuLnNvdXJjZSwgZmxhZ3MgKyBcImdcIik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwYXR0ZXJuID0gcGF0dGVybi5wYXR0ZXJuIHx8IHBhdHRlcm47XG5cblx0XHRcdFx0Ly8gRG9u4oCZdCBjYWNoZSBsZW5ndGggYXMgaXQgY2hhbmdlcyBkdXJpbmcgdGhlIGxvb3Bcblx0XHRcdFx0Zm9yICh2YXIgaSA9IGluZGV4LCBwb3MgPSBzdGFydFBvczsgaSA8IHN0cmFyci5sZW5ndGg7IHBvcyArPSBzdHJhcnJbaV0ubGVuZ3RoLCArK2kpIHtcblxuXHRcdFx0XHRcdHZhciBzdHIgPSBzdHJhcnJbaV07XG5cblx0XHRcdFx0XHRpZiAoc3RyYXJyLmxlbmd0aCA+IHRleHQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHQvLyBTb21ldGhpbmcgd2VudCB0ZXJyaWJseSB3cm9uZywgQUJPUlQsIEFCT1JUIVxuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChzdHIgaW5zdGFuY2VvZiBUb2tlbikge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cGF0dGVybi5sYXN0SW5kZXggPSAwO1xuXG5cdFx0XHRcdFx0dmFyIG1hdGNoID0gcGF0dGVybi5leGVjKHN0ciksXG5cdFx0XHRcdFx0ICAgIGRlbE51bSA9IDE7XG5cblx0XHRcdFx0XHQvLyBHcmVlZHkgcGF0dGVybnMgY2FuIG92ZXJyaWRlL3JlbW92ZSB1cCB0byB0d28gcHJldmlvdXNseSBtYXRjaGVkIHRva2Vuc1xuXHRcdFx0XHRcdGlmICghbWF0Y2ggJiYgZ3JlZWR5ICYmIGkgIT0gc3RyYXJyLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRcdHBhdHRlcm4ubGFzdEluZGV4ID0gcG9zO1xuXHRcdFx0XHRcdFx0bWF0Y2ggPSBwYXR0ZXJuLmV4ZWModGV4dCk7XG5cdFx0XHRcdFx0XHRpZiAoIW1hdGNoKSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR2YXIgZnJvbSA9IG1hdGNoLmluZGV4ICsgKGxvb2tiZWhpbmQgPyBtYXRjaFsxXS5sZW5ndGggOiAwKSxcblx0XHRcdFx0XHRcdCAgICB0byA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoLFxuXHRcdFx0XHRcdFx0ICAgIGsgPSBpLFxuXHRcdFx0XHRcdFx0ICAgIHAgPSBwb3M7XG5cblx0XHRcdFx0XHRcdGZvciAodmFyIGxlbiA9IHN0cmFyci5sZW5ndGg7IGsgPCBsZW4gJiYgKHAgPCB0byB8fCAoIXN0cmFycltrXS50eXBlICYmICFzdHJhcnJbayAtIDFdLmdyZWVkeSkpOyArK2spIHtcblx0XHRcdFx0XHRcdFx0cCArPSBzdHJhcnJba10ubGVuZ3RoO1xuXHRcdFx0XHRcdFx0XHQvLyBNb3ZlIHRoZSBpbmRleCBpIHRvIHRoZSBlbGVtZW50IGluIHN0cmFyciB0aGF0IGlzIGNsb3Nlc3QgdG8gZnJvbVxuXHRcdFx0XHRcdFx0XHRpZiAoZnJvbSA+PSBwKSB7XG5cdFx0XHRcdFx0XHRcdFx0KytpO1xuXHRcdFx0XHRcdFx0XHRcdHBvcyA9IHA7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Lypcblx0XHRcdFx0XHRcdCAqIElmIHN0cmFycltpXSBpcyBhIFRva2VuLCB0aGVuIHRoZSBtYXRjaCBzdGFydHMgaW5zaWRlIGFub3RoZXIgVG9rZW4sIHdoaWNoIGlzIGludmFsaWRcblx0XHRcdFx0XHRcdCAqIElmIHN0cmFycltrIC0gMV0gaXMgZ3JlZWR5IHdlIGFyZSBpbiBjb25mbGljdCB3aXRoIGFub3RoZXIgZ3JlZWR5IHBhdHRlcm5cblx0XHRcdFx0XHRcdCAqL1xuXHRcdFx0XHRcdFx0aWYgKHN0cmFycltpXSBpbnN0YW5jZW9mIFRva2VuIHx8IHN0cmFycltrIC0gMV0uZ3JlZWR5KSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBOdW1iZXIgb2YgdG9rZW5zIHRvIGRlbGV0ZSBhbmQgcmVwbGFjZSB3aXRoIHRoZSBuZXcgbWF0Y2hcblx0XHRcdFx0XHRcdGRlbE51bSA9IGsgLSBpO1xuXHRcdFx0XHRcdFx0c3RyID0gdGV4dC5zbGljZShwb3MsIHApO1xuXHRcdFx0XHRcdFx0bWF0Y2guaW5kZXggLT0gcG9zO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghbWF0Y2gpIHtcblx0XHRcdFx0XHRcdGlmIChvbmVzaG90KSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZihsb29rYmVoaW5kKSB7XG5cdFx0XHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gbWF0Y2hbMV0ubGVuZ3RoO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHZhciBmcm9tID0gbWF0Y2guaW5kZXggKyBsb29rYmVoaW5kTGVuZ3RoLFxuXHRcdFx0XHRcdCAgICBtYXRjaCA9IG1hdGNoWzBdLnNsaWNlKGxvb2tiZWhpbmRMZW5ndGgpLFxuXHRcdFx0XHRcdCAgICB0byA9IGZyb20gKyBtYXRjaC5sZW5ndGgsXG5cdFx0XHRcdFx0ICAgIGJlZm9yZSA9IHN0ci5zbGljZSgwLCBmcm9tKSxcblx0XHRcdFx0XHQgICAgYWZ0ZXIgPSBzdHIuc2xpY2UodG8pO1xuXG5cdFx0XHRcdFx0dmFyIGFyZ3MgPSBbaSwgZGVsTnVtXTtcblxuXHRcdFx0XHRcdGlmIChiZWZvcmUpIHtcblx0XHRcdFx0XHRcdCsraTtcblx0XHRcdFx0XHRcdHBvcyArPSBiZWZvcmUubGVuZ3RoO1xuXHRcdFx0XHRcdFx0YXJncy5wdXNoKGJlZm9yZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dmFyIHdyYXBwZWQgPSBuZXcgVG9rZW4odG9rZW4sIGluc2lkZT8gXy50b2tlbml6ZShtYXRjaCwgaW5zaWRlKSA6IG1hdGNoLCBhbGlhcywgbWF0Y2gsIGdyZWVkeSk7XG5cblx0XHRcdFx0XHRhcmdzLnB1c2god3JhcHBlZCk7XG5cblx0XHRcdFx0XHRpZiAoYWZ0ZXIpIHtcblx0XHRcdFx0XHRcdGFyZ3MucHVzaChhZnRlcik7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0QXJyYXkucHJvdG90eXBlLnNwbGljZS5hcHBseShzdHJhcnIsIGFyZ3MpO1xuXG5cdFx0XHRcdFx0aWYgKGRlbE51bSAhPSAxKVxuXHRcdFx0XHRcdFx0Xy5tYXRjaEdyYW1tYXIodGV4dCwgc3RyYXJyLCBncmFtbWFyLCBpLCBwb3MsIHRydWUsIHRva2VuKTtcblxuXHRcdFx0XHRcdGlmIChvbmVzaG90KVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cblx0dG9rZW5pemU6IGZ1bmN0aW9uKHRleHQsIGdyYW1tYXIsIGxhbmd1YWdlKSB7XG5cdFx0dmFyIHN0cmFyciA9IFt0ZXh0XTtcblxuXHRcdHZhciByZXN0ID0gZ3JhbW1hci5yZXN0O1xuXG5cdFx0aWYgKHJlc3QpIHtcblx0XHRcdGZvciAodmFyIHRva2VuIGluIHJlc3QpIHtcblx0XHRcdFx0Z3JhbW1hclt0b2tlbl0gPSByZXN0W3Rva2VuXTtcblx0XHRcdH1cblxuXHRcdFx0ZGVsZXRlIGdyYW1tYXIucmVzdDtcblx0XHR9XG5cblx0XHRfLm1hdGNoR3JhbW1hcih0ZXh0LCBzdHJhcnIsIGdyYW1tYXIsIDAsIDAsIGZhbHNlKTtcblxuXHRcdHJldHVybiBzdHJhcnI7XG5cdH0sXG5cblx0aG9va3M6IHtcblx0XHRhbGw6IHt9LFxuXG5cdFx0YWRkOiBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2spIHtcblx0XHRcdHZhciBob29rcyA9IF8uaG9va3MuYWxsO1xuXG5cdFx0XHRob29rc1tuYW1lXSA9IGhvb2tzW25hbWVdIHx8IFtdO1xuXG5cdFx0XHRob29rc1tuYW1lXS5wdXNoKGNhbGxiYWNrKTtcblx0XHR9LFxuXG5cdFx0cnVuOiBmdW5jdGlvbiAobmFtZSwgZW52KSB7XG5cdFx0XHR2YXIgY2FsbGJhY2tzID0gXy5ob29rcy5hbGxbbmFtZV07XG5cblx0XHRcdGlmICghY2FsbGJhY2tzIHx8ICFjYWxsYmFja3MubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Zm9yICh2YXIgaT0wLCBjYWxsYmFjazsgY2FsbGJhY2sgPSBjYWxsYmFja3NbaSsrXTspIHtcblx0XHRcdFx0Y2FsbGJhY2soZW52KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn07XG5cbnZhciBUb2tlbiA9IF8uVG9rZW4gPSBmdW5jdGlvbih0eXBlLCBjb250ZW50LCBhbGlhcywgbWF0Y2hlZFN0ciwgZ3JlZWR5KSB7XG5cdHRoaXMudHlwZSA9IHR5cGU7XG5cdHRoaXMuY29udGVudCA9IGNvbnRlbnQ7XG5cdHRoaXMuYWxpYXMgPSBhbGlhcztcblx0Ly8gQ29weSBvZiB0aGUgZnVsbCBzdHJpbmcgdGhpcyB0b2tlbiB3YXMgY3JlYXRlZCBmcm9tXG5cdHRoaXMubGVuZ3RoID0gKG1hdGNoZWRTdHIgfHwgXCJcIikubGVuZ3RofDA7XG5cdHRoaXMuZ3JlZWR5ID0gISFncmVlZHk7XG59O1xuXG5Ub2tlbi5zdHJpbmdpZnkgPSBmdW5jdGlvbihvLCBsYW5ndWFnZSwgcGFyZW50KSB7XG5cdGlmICh0eXBlb2YgbyA9PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiBvO1xuXHR9XG5cblx0aWYgKF8udXRpbC50eXBlKG8pID09PSAnQXJyYXknKSB7XG5cdFx0cmV0dXJuIG8ubWFwKGZ1bmN0aW9uKGVsZW1lbnQpIHtcblx0XHRcdHJldHVybiBUb2tlbi5zdHJpbmdpZnkoZWxlbWVudCwgbGFuZ3VhZ2UsIG8pO1xuXHRcdH0pLmpvaW4oJycpO1xuXHR9XG5cblx0dmFyIGVudiA9IHtcblx0XHR0eXBlOiBvLnR5cGUsXG5cdFx0Y29udGVudDogVG9rZW4uc3RyaW5naWZ5KG8uY29udGVudCwgbGFuZ3VhZ2UsIHBhcmVudCksXG5cdFx0dGFnOiAnc3BhbicsXG5cdFx0Y2xhc3NlczogWyd0b2tlbicsIG8udHlwZV0sXG5cdFx0YXR0cmlidXRlczoge30sXG5cdFx0bGFuZ3VhZ2U6IGxhbmd1YWdlLFxuXHRcdHBhcmVudDogcGFyZW50XG5cdH07XG5cblx0aWYgKGVudi50eXBlID09ICdjb21tZW50Jykge1xuXHRcdGVudi5hdHRyaWJ1dGVzWydzcGVsbGNoZWNrJ10gPSAndHJ1ZSc7XG5cdH1cblxuXHRpZiAoby5hbGlhcykge1xuXHRcdHZhciBhbGlhc2VzID0gXy51dGlsLnR5cGUoby5hbGlhcykgPT09ICdBcnJheScgPyBvLmFsaWFzIDogW28uYWxpYXNdO1xuXHRcdEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KGVudi5jbGFzc2VzLCBhbGlhc2VzKTtcblx0fVxuXG5cdF8uaG9va3MucnVuKCd3cmFwJywgZW52KTtcblxuXHR2YXIgYXR0cmlidXRlcyA9IE9iamVjdC5rZXlzKGVudi5hdHRyaWJ1dGVzKS5tYXAoZnVuY3Rpb24obmFtZSkge1xuXHRcdHJldHVybiBuYW1lICsgJz1cIicgKyAoZW52LmF0dHJpYnV0ZXNbbmFtZV0gfHwgJycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKSArICdcIic7XG5cdH0pLmpvaW4oJyAnKTtcblxuXHRyZXR1cm4gJzwnICsgZW52LnRhZyArICcgY2xhc3M9XCInICsgZW52LmNsYXNzZXMuam9pbignICcpICsgJ1wiJyArIChhdHRyaWJ1dGVzID8gJyAnICsgYXR0cmlidXRlcyA6ICcnKSArICc+JyArIGVudi5jb250ZW50ICsgJzwvJyArIGVudi50YWcgKyAnPic7XG5cbn07XG5cbmlmICghX3NlbGYuZG9jdW1lbnQpIHtcblx0aWYgKCFfc2VsZi5hZGRFdmVudExpc3RlbmVyKSB7XG5cdFx0Ly8gaW4gTm9kZS5qc1xuXHRcdHJldHVybiBfc2VsZi5QcmlzbTtcblx0fVxuIFx0Ly8gSW4gd29ya2VyXG5cdF9zZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbihldnQpIHtcblx0XHR2YXIgbWVzc2FnZSA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpLFxuXHRcdCAgICBsYW5nID0gbWVzc2FnZS5sYW5ndWFnZSxcblx0XHQgICAgY29kZSA9IG1lc3NhZ2UuY29kZSxcblx0XHQgICAgaW1tZWRpYXRlQ2xvc2UgPSBtZXNzYWdlLmltbWVkaWF0ZUNsb3NlO1xuXG5cdFx0X3NlbGYucG9zdE1lc3NhZ2UoXy5oaWdobGlnaHQoY29kZSwgXy5sYW5ndWFnZXNbbGFuZ10sIGxhbmcpKTtcblx0XHRpZiAoaW1tZWRpYXRlQ2xvc2UpIHtcblx0XHRcdF9zZWxmLmNsb3NlKCk7XG5cdFx0fVxuXHR9LCBmYWxzZSk7XG5cblx0cmV0dXJuIF9zZWxmLlByaXNtO1xufVxuXG4vL0dldCBjdXJyZW50IHNjcmlwdCBhbmQgaGlnaGxpZ2h0XG52YXIgc2NyaXB0ID0gZG9jdW1lbnQuY3VycmVudFNjcmlwdCB8fCBbXS5zbGljZS5jYWxsKGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKFwic2NyaXB0XCIpKS5wb3AoKTtcblxuaWYgKHNjcmlwdCkge1xuXHRfLmZpbGVuYW1lID0gc2NyaXB0LnNyYztcblxuXHRpZiAoZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciAmJiAhXy5tYW51YWwgJiYgIXNjcmlwdC5oYXNBdHRyaWJ1dGUoJ2RhdGEtbWFudWFsJykpIHtcblx0XHRpZihkb2N1bWVudC5yZWFkeVN0YXRlICE9PSBcImxvYWRpbmdcIikge1xuXHRcdFx0aWYgKHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShfLmhpZ2hsaWdodEFsbCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dChfLmhpZ2hsaWdodEFsbCwgMTYpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBfLmhpZ2hsaWdodEFsbCk7XG5cdFx0fVxuXHR9XG59XG5cbnJldHVybiBfc2VsZi5QcmlzbTtcblxufSkoKTtcblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdG1vZHVsZS5leHBvcnRzID0gUHJpc207XG59XG5cbi8vIGhhY2sgZm9yIGNvbXBvbmVudHMgdG8gd29yayBjb3JyZWN0bHkgaW4gbm9kZS5qc1xuaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG5cdGdsb2JhbC5QcmlzbSA9IFByaXNtO1xufVxuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tbWFya3VwLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5tYXJrdXAgPSB7XG5cdCdjb21tZW50JzogLzwhLS1bXFxzXFxTXSo/LS0+Lyxcblx0J3Byb2xvZyc6IC88XFw/W1xcc1xcU10rP1xcPz4vLFxuXHQnZG9jdHlwZSc6IC88IURPQ1RZUEVbXFxzXFxTXSs/Pi9pLFxuXHQnY2RhdGEnOiAvPCFcXFtDREFUQVxcW1tcXHNcXFNdKj9dXT4vaSxcblx0J3RhZyc6IHtcblx0XHRwYXR0ZXJuOiAvPFxcLz8oPyFcXGQpW15cXHM+XFwvPSQ8XSsoPzpcXHMrW15cXHM+XFwvPV0rKD86PSg/OihcInwnKSg/OlxcXFxcXDF8XFxcXD8oPyFcXDEpW1xcc1xcU10pKlxcMXxbXlxccydcIj49XSspKT8pKlxccypcXC8/Pi9pLFxuXHRcdGluc2lkZToge1xuXHRcdFx0J3RhZyc6IHtcblx0XHRcdFx0cGF0dGVybjogL148XFwvP1teXFxzPlxcL10rL2ksXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9ePFxcLz8vLFxuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQnYXR0ci12YWx1ZSc6IHtcblx0XHRcdFx0cGF0dGVybjogLz0oPzooJ3xcIilbXFxzXFxTXSo/KFxcMSl8W15cXHM+XSspL2ksXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9bPT5cIiddL1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J3B1bmN0dWF0aW9uJzogL1xcLz8+Lyxcblx0XHRcdCdhdHRyLW5hbWUnOiB7XG5cdFx0XHRcdHBhdHRlcm46IC9bXlxccz5cXC9dKy8sXG5cdFx0XHRcdGluc2lkZToge1xuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH1cblx0fSxcblx0J2VudGl0eSc6IC8mIz9bXFxkYS16XXsxLDh9Oy9pXG59O1xuXG4vLyBQbHVnaW4gdG8gbWFrZSBlbnRpdHkgdGl0bGUgc2hvdyB0aGUgcmVhbCBlbnRpdHksIGlkZWEgYnkgUm9tYW4gS29tYXJvdlxuUHJpc20uaG9va3MuYWRkKCd3cmFwJywgZnVuY3Rpb24oZW52KSB7XG5cblx0aWYgKGVudi50eXBlID09PSAnZW50aXR5Jykge1xuXHRcdGVudi5hdHRyaWJ1dGVzWyd0aXRsZSddID0gZW52LmNvbnRlbnQucmVwbGFjZSgvJmFtcDsvLCAnJicpO1xuXHR9XG59KTtcblxuUHJpc20ubGFuZ3VhZ2VzLnhtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XG5QcmlzbS5sYW5ndWFnZXMuaHRtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XG5QcmlzbS5sYW5ndWFnZXMubWF0aG1sID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcblByaXNtLmxhbmd1YWdlcy5zdmcgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY3NzLmpzXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXG5cblByaXNtLmxhbmd1YWdlcy5jc3MgPSB7XG5cdCdjb21tZW50JzogL1xcL1xcKltcXHNcXFNdKj9cXCpcXC8vLFxuXHQnYXRydWxlJzoge1xuXHRcdHBhdHRlcm46IC9AW1xcdy1dKz8uKj8oO3woPz1cXHMqXFx7KSkvaSxcblx0XHRpbnNpZGU6IHtcblx0XHRcdCdydWxlJzogL0BbXFx3LV0rL1xuXHRcdFx0Ly8gU2VlIHJlc3QgYmVsb3dcblx0XHR9XG5cdH0sXG5cdCd1cmwnOiAvdXJsXFwoKD86KFtcIiddKShcXFxcKD86XFxyXFxufFtcXHNcXFNdKXwoPyFcXDEpW15cXFxcXFxyXFxuXSkqXFwxfC4qPylcXCkvaSxcblx0J3NlbGVjdG9yJzogL1teXFx7XFx9XFxzXVteXFx7XFx9O10qPyg/PVxccypcXHspLyxcblx0J3N0cmluZyc6IHtcblx0XHRwYXR0ZXJuOiAvKFwifCcpKFxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvLFxuXHRcdGdyZWVkeTogdHJ1ZVxuXHR9LFxuXHQncHJvcGVydHknOiAvKFxcYnxcXEIpW1xcdy1dKyg/PVxccyo6KS9pLFxuXHQnaW1wb3J0YW50JzogL1xcQiFpbXBvcnRhbnRcXGIvaSxcblx0J2Z1bmN0aW9uJzogL1stYS16MC05XSsoPz1cXCgpL2ksXG5cdCdwdW5jdHVhdGlvbic6IC9bKCl7fTs6XS9cbn07XG5cblByaXNtLmxhbmd1YWdlcy5jc3NbJ2F0cnVsZSddLmluc2lkZS5yZXN0ID0gUHJpc20udXRpbC5jbG9uZShQcmlzbS5sYW5ndWFnZXMuY3NzKTtcblxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcblx0UHJpc20ubGFuZ3VhZ2VzLmluc2VydEJlZm9yZSgnbWFya3VwJywgJ3RhZycsIHtcblx0XHQnc3R5bGUnOiB7XG5cdFx0XHRwYXR0ZXJuOiAvKDxzdHlsZVtcXHNcXFNdKj8+KVtcXHNcXFNdKj8oPz08XFwvc3R5bGU+KS9pLFxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZSxcblx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmNzcyxcblx0XHRcdGFsaWFzOiAnbGFuZ3VhZ2UtY3NzJ1xuXHRcdH1cblx0fSk7XG5cdFxuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdpbnNpZGUnLCAnYXR0ci12YWx1ZScsIHtcblx0XHQnc3R5bGUtYXR0cic6IHtcblx0XHRcdHBhdHRlcm46IC9cXHMqc3R5bGU9KFwifCcpLio/XFwxL2ksXG5cdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0J2F0dHItbmFtZSc6IHtcblx0XHRcdFx0XHRwYXR0ZXJuOiAvXlxccypzdHlsZS9pLFxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcuaW5zaWRlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9eXFxzKj1cXHMqWydcIl18WydcIl1cXHMqJC8sXG5cdFx0XHRcdCdhdHRyLXZhbHVlJzoge1xuXHRcdFx0XHRcdHBhdHRlcm46IC8uKy9pLFxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmNzc1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWxpYXM6ICdsYW5ndWFnZS1jc3MnXG5cdFx0fVxuXHR9LCBQcmlzbS5sYW5ndWFnZXMubWFya3VwLnRhZyk7XG59XG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tY2xpa2UuanNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cblxuUHJpc20ubGFuZ3VhZ2VzLmNsaWtlID0ge1xuXHQnY29tbWVudCc6IFtcblx0XHR7XG5cdFx0XHRwYXR0ZXJuOiAvKF58W15cXFxcXSlcXC9cXCpbXFxzXFxTXSo/XFwqXFwvLyxcblx0XHRcdGxvb2tiZWhpbmQ6IHRydWVcblx0XHR9LFxuXHRcdHtcblx0XHRcdHBhdHRlcm46IC8oXnxbXlxcXFw6XSlcXC9cXC8uKi8sXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlXG5cdFx0fVxuXHRdLFxuXHQnc3RyaW5nJzoge1xuXHRcdHBhdHRlcm46IC8oW1wiJ10pKFxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvLFxuXHRcdGdyZWVkeTogdHJ1ZVxuXHR9LFxuXHQnY2xhc3MtbmFtZSc6IHtcblx0XHRwYXR0ZXJuOiAvKCg/OlxcYig/OmNsYXNzfGludGVyZmFjZXxleHRlbmRzfGltcGxlbWVudHN8dHJhaXR8aW5zdGFuY2VvZnxuZXcpXFxzKyl8KD86Y2F0Y2hcXHMrXFwoKSlbYS16MC05X1xcLlxcXFxdKy9pLFxuXHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0aW5zaWRlOiB7XG5cdFx0XHRwdW5jdHVhdGlvbjogLyhcXC58XFxcXCkvXG5cdFx0fVxuXHR9LFxuXHQna2V5d29yZCc6IC9cXGIoaWZ8ZWxzZXx3aGlsZXxkb3xmb3J8cmV0dXJufGlufGluc3RhbmNlb2Z8ZnVuY3Rpb258bmV3fHRyeXx0aHJvd3xjYXRjaHxmaW5hbGx5fG51bGx8YnJlYWt8Y29udGludWUpXFxiLyxcblx0J2Jvb2xlYW4nOiAvXFxiKHRydWV8ZmFsc2UpXFxiLyxcblx0J2Z1bmN0aW9uJzogL1thLXowLTlfXSsoPz1cXCgpL2ksXG5cdCdudW1iZXInOiAvXFxiLT8oPzoweFtcXGRhLWZdK3xcXGQqXFwuP1xcZCsoPzplWystXT9cXGQrKT8pXFxiL2ksXG5cdCdvcGVyYXRvcic6IC8tLT98XFwrXFwrP3whPT89P3w8PT98Pj0/fD09Pz0/fCYmP3xcXHxcXHw/fFxcP3xcXCp8XFwvfH58XFxefCUvLFxuXHQncHVuY3R1YXRpb24nOiAvW3t9W1xcXTsoKSwuOl0vXG59O1xuXG5cbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgQmVnaW4gcHJpc20tamF2YXNjcmlwdC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG5QcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdCA9IFByaXNtLmxhbmd1YWdlcy5leHRlbmQoJ2NsaWtlJywge1xuXHQna2V5d29yZCc6IC9cXGIoYXN8YXN5bmN8YXdhaXR8YnJlYWt8Y2FzZXxjYXRjaHxjbGFzc3xjb25zdHxjb250aW51ZXxkZWJ1Z2dlcnxkZWZhdWx0fGRlbGV0ZXxkb3xlbHNlfGVudW18ZXhwb3J0fGV4dGVuZHN8ZmluYWxseXxmb3J8ZnJvbXxmdW5jdGlvbnxnZXR8aWZ8aW1wbGVtZW50c3xpbXBvcnR8aW58aW5zdGFuY2VvZnxpbnRlcmZhY2V8bGV0fG5ld3xudWxsfG9mfHBhY2thZ2V8cHJpdmF0ZXxwcm90ZWN0ZWR8cHVibGljfHJldHVybnxzZXR8c3RhdGljfHN1cGVyfHN3aXRjaHx0aGlzfHRocm93fHRyeXx0eXBlb2Z8dmFyfHZvaWR8d2hpbGV8d2l0aHx5aWVsZClcXGIvLFxuXHQnbnVtYmVyJzogL1xcYi0/KDB4W1xcZEEtRmEtZl0rfDBiWzAxXSt8MG9bMC03XSt8XFxkKlxcLj9cXGQrKFtFZV1bKy1dP1xcZCspP3xOYU58SW5maW5pdHkpXFxiLyxcblx0Ly8gQWxsb3cgZm9yIGFsbCBub24tQVNDSUkgY2hhcmFjdGVycyAoU2VlIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIwMDg0NDQpXG5cdCdmdW5jdGlvbic6IC9bXyRhLXpBLVpcXHhBMC1cXHVGRkZGXVtfJGEtekEtWjAtOVxceEEwLVxcdUZGRkZdKig/PVxcKCkvaSxcblx0J29wZXJhdG9yJzogLy1bLT1dP3xcXCtbKz1dP3whPT89P3w8PD89P3w+Pj8+Pz0/fD0oPzo9PT98Pik/fCZbJj1dP3xcXHxbfD1dP3xcXCpcXCo/PT98XFwvPT98fnxcXF49P3wlPT98XFw/fFxcLnszfS9cbn0pO1xuXG5QcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdqYXZhc2NyaXB0JywgJ2tleXdvcmQnLCB7XG5cdCdyZWdleCc6IHtcblx0XHRwYXR0ZXJuOiAvKF58W14vXSlcXC8oPyFcXC8pKFxcWy4rP118XFxcXC58W14vXFxcXFxcclxcbl0pK1xcL1tnaW15dV17MCw1fSg/PVxccyooJHxbXFxyXFxuLC47fSldKSkvLFxuXHRcdGxvb2tiZWhpbmQ6IHRydWUsXG5cdFx0Z3JlZWR5OiB0cnVlXG5cdH1cbn0pO1xuXG5QcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdqYXZhc2NyaXB0JywgJ3N0cmluZycsIHtcblx0J3RlbXBsYXRlLXN0cmluZyc6IHtcblx0XHRwYXR0ZXJuOiAvYCg/OlxcXFxcXFxcfFxcXFw/W15cXFxcXSkqP2AvLFxuXHRcdGdyZWVkeTogdHJ1ZSxcblx0XHRpbnNpZGU6IHtcblx0XHRcdCdpbnRlcnBvbGF0aW9uJzoge1xuXHRcdFx0XHRwYXR0ZXJuOiAvXFwkXFx7W159XStcXH0vLFxuXHRcdFx0XHRpbnNpZGU6IHtcblx0XHRcdFx0XHQnaW50ZXJwb2xhdGlvbi1wdW5jdHVhdGlvbic6IHtcblx0XHRcdFx0XHRcdHBhdHRlcm46IC9eXFwkXFx7fFxcfSQvLFxuXHRcdFx0XHRcdFx0YWxpYXM6ICdwdW5jdHVhdGlvbidcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHJlc3Q6IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQnc3RyaW5nJzogL1tcXHNcXFNdKy9cblx0XHR9XG5cdH1cbn0pO1xuXG5pZiAoUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cCkge1xuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdtYXJrdXAnLCAndGFnJywge1xuXHRcdCdzY3JpcHQnOiB7XG5cdFx0XHRwYXR0ZXJuOiAvKDxzY3JpcHRbXFxzXFxTXSo/PilbXFxzXFxTXSo/KD89PFxcL3NjcmlwdD4pL2ksXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlLFxuXHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdCxcblx0XHRcdGFsaWFzOiAnbGFuZ3VhZ2UtamF2YXNjcmlwdCdcblx0XHR9XG5cdH0pO1xufVxuXG5QcmlzbS5sYW5ndWFnZXMuanMgPSBQcmlzbS5sYW5ndWFnZXMuamF2YXNjcmlwdDtcblxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICBCZWdpbiBwcmlzbS1maWxlLWhpZ2hsaWdodC5qc1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xuXG4oZnVuY3Rpb24gKCkge1xuXHRpZiAodHlwZW9mIHNlbGYgPT09ICd1bmRlZmluZWQnIHx8ICFzZWxmLlByaXNtIHx8ICFzZWxmLmRvY3VtZW50IHx8ICFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0c2VsZi5QcmlzbS5maWxlSGlnaGxpZ2h0ID0gZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgRXh0ZW5zaW9ucyA9IHtcblx0XHRcdCdqcyc6ICdqYXZhc2NyaXB0Jyxcblx0XHRcdCdweSc6ICdweXRob24nLFxuXHRcdFx0J3JiJzogJ3J1YnknLFxuXHRcdFx0J3BzMSc6ICdwb3dlcnNoZWxsJyxcblx0XHRcdCdwc20xJzogJ3Bvd2Vyc2hlbGwnLFxuXHRcdFx0J3NoJzogJ2Jhc2gnLFxuXHRcdFx0J2JhdCc6ICdiYXRjaCcsXG5cdFx0XHQnaCc6ICdjJyxcblx0XHRcdCd0ZXgnOiAnbGF0ZXgnXG5cdFx0fTtcblxuXHRcdGlmKEFycmF5LnByb3RvdHlwZS5mb3JFYWNoKSB7IC8vIENoZWNrIHRvIHByZXZlbnQgZXJyb3IgaW4gSUU4XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdwcmVbZGF0YS1zcmNdJykpLmZvckVhY2goZnVuY3Rpb24gKHByZSkge1xuXHRcdFx0XHR2YXIgc3JjID0gcHJlLmdldEF0dHJpYnV0ZSgnZGF0YS1zcmMnKTtcblxuXHRcdFx0XHR2YXIgbGFuZ3VhZ2UsIHBhcmVudCA9IHByZTtcblx0XHRcdFx0dmFyIGxhbmcgPSAvXFxibGFuZyg/OnVhZ2UpPy0oPyFcXCopKFxcdyspXFxiL2k7XG5cdFx0XHRcdHdoaWxlIChwYXJlbnQgJiYgIWxhbmcudGVzdChwYXJlbnQuY2xhc3NOYW1lKSkge1xuXHRcdFx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0XHRcdGxhbmd1YWdlID0gKHByZS5jbGFzc05hbWUubWF0Y2gobGFuZykgfHwgWywgJyddKVsxXTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghbGFuZ3VhZ2UpIHtcblx0XHRcdFx0XHR2YXIgZXh0ZW5zaW9uID0gKHNyYy5tYXRjaCgvXFwuKFxcdyspJC8pIHx8IFssICcnXSlbMV07XG5cdFx0XHRcdFx0bGFuZ3VhZ2UgPSBFeHRlbnNpb25zW2V4dGVuc2lvbl0gfHwgZXh0ZW5zaW9uO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmFyIGNvZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjb2RlJyk7XG5cdFx0XHRcdGNvZGUuY2xhc3NOYW1lID0gJ2xhbmd1YWdlLScgKyBsYW5ndWFnZTtcblxuXHRcdFx0XHRwcmUudGV4dENvbnRlbnQgPSAnJztcblxuXHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0gJ0xvYWRpbmfigKYnO1xuXG5cdFx0XHRcdHByZS5hcHBlbmRDaGlsZChjb2RlKTtcblxuXHRcdFx0XHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cblx0XHRcdFx0eGhyLm9wZW4oJ0dFVCcsIHNyYywgdHJ1ZSk7XG5cblx0XHRcdFx0eGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoeGhyLnJlYWR5U3RhdGUgPT0gNCkge1xuXG5cdFx0XHRcdFx0XHRpZiAoeGhyLnN0YXR1cyA8IDQwMCAmJiB4aHIucmVzcG9uc2VUZXh0KSB7XG5cdFx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSB4aHIucmVzcG9uc2VUZXh0O1xuXG5cdFx0XHRcdFx0XHRcdFByaXNtLmhpZ2hsaWdodEVsZW1lbnQoY29kZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlIGlmICh4aHIuc3RhdHVzID49IDQwMCkge1xuXHRcdFx0XHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0gJ+KcliBFcnJvciAnICsgeGhyLnN0YXR1cyArICcgd2hpbGUgZmV0Y2hpbmcgZmlsZTogJyArIHhoci5zdGF0dXNUZXh0O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAn4pyWIEVycm9yOiBGaWxlIGRvZXMgbm90IGV4aXN0IG9yIGlzIGVtcHR5Jztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0eGhyLnNlbmQobnVsbCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0fTtcblxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgc2VsZi5QcmlzbS5maWxlSGlnaGxpZ2h0KTtcblxufSkoKTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xuICAgIHZhciBiYWNrZHJvcHM7XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVCYWNrZHJvcEZvclNsaWRlKHNsaWRlKSB7XG4gICAgICB2YXIgYmFja2Ryb3BBdHRyaWJ1dGUgPSBzbGlkZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtYmVzcG9rZS1iYWNrZHJvcCcpO1xuXG4gICAgICBpZiAoYmFja2Ryb3BBdHRyaWJ1dGUpIHtcbiAgICAgICAgdmFyIGJhY2tkcm9wID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGJhY2tkcm9wLmNsYXNzTmFtZSA9IGJhY2tkcm9wQXR0cmlidXRlO1xuICAgICAgICBiYWNrZHJvcC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJhY2tkcm9wJyk7XG4gICAgICAgIGRlY2sucGFyZW50LmFwcGVuZENoaWxkKGJhY2tkcm9wKTtcbiAgICAgICAgcmV0dXJuIGJhY2tkcm9wO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHVwZGF0ZUNsYXNzZXMoZWwpIHtcbiAgICAgIGlmIChlbCkge1xuICAgICAgICB2YXIgaW5kZXggPSBiYWNrZHJvcHMuaW5kZXhPZihlbCksXG4gICAgICAgICAgY3VycmVudEluZGV4ID0gZGVjay5zbGlkZSgpO1xuXG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnYWN0aXZlJyk7XG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnaW5hY3RpdmUnKTtcbiAgICAgICAgcmVtb3ZlQ2xhc3MoZWwsICdiZWZvcmUnKTtcbiAgICAgICAgcmVtb3ZlQ2xhc3MoZWwsICdhZnRlcicpO1xuXG4gICAgICAgIGlmIChpbmRleCAhPT0gY3VycmVudEluZGV4KSB7XG4gICAgICAgICAgYWRkQ2xhc3MoZWwsICdpbmFjdGl2ZScpO1xuICAgICAgICAgIGFkZENsYXNzKGVsLCBpbmRleCA8IGN1cnJlbnRJbmRleCA/ICdiZWZvcmUnIDogJ2FmdGVyJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWRkQ2xhc3MoZWwsICdhY3RpdmUnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlbW92ZUNsYXNzKGVsLCBjbGFzc05hbWUpIHtcbiAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2Jlc3Bva2UtYmFja2Ryb3AtJyArIGNsYXNzTmFtZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkQ2xhc3MoZWwsIGNsYXNzTmFtZSkge1xuICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1iYWNrZHJvcC0nICsgY2xhc3NOYW1lKTtcbiAgICB9XG5cbiAgICBiYWNrZHJvcHMgPSBkZWNrLnNsaWRlc1xuICAgICAgLm1hcChjcmVhdGVCYWNrZHJvcEZvclNsaWRlKTtcblxuICAgIGRlY2sub24oJ2FjdGl2YXRlJywgZnVuY3Rpb24oKSB7XG4gICAgICBiYWNrZHJvcHMuZm9yRWFjaCh1cGRhdGVDbGFzc2VzKTtcbiAgICB9KTtcbiAgfTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcbiAgICB2YXIgYWN0aXZlU2xpZGVJbmRleCxcbiAgICAgIGFjdGl2ZUJ1bGxldEluZGV4LFxuXG4gICAgICBidWxsZXRzID0gZGVjay5zbGlkZXMubWFwKGZ1bmN0aW9uKHNsaWRlKSB7XG4gICAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKHNsaWRlLnF1ZXJ5U2VsZWN0b3JBbGwoKHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiAnW2RhdGEtYmVzcG9rZS1idWxsZXRdJykpLCAwKTtcbiAgICAgIH0pLFxuXG4gICAgICBuZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBuZXh0U2xpZGVJbmRleCA9IGFjdGl2ZVNsaWRlSW5kZXggKyAxO1xuXG4gICAgICAgIGlmIChhY3RpdmVTbGlkZUhhc0J1bGxldEJ5T2Zmc2V0KDEpKSB7XG4gICAgICAgICAgYWN0aXZhdGVCdWxsZXQoYWN0aXZlU2xpZGVJbmRleCwgYWN0aXZlQnVsbGV0SW5kZXggKyAxKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSBpZiAoYnVsbGV0c1tuZXh0U2xpZGVJbmRleF0pIHtcbiAgICAgICAgICBhY3RpdmF0ZUJ1bGxldChuZXh0U2xpZGVJbmRleCwgMCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIHByZXYgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHByZXZTbGlkZUluZGV4ID0gYWN0aXZlU2xpZGVJbmRleCAtIDE7XG5cbiAgICAgICAgaWYgKGFjdGl2ZVNsaWRlSGFzQnVsbGV0QnlPZmZzZXQoLTEpKSB7XG4gICAgICAgICAgYWN0aXZhdGVCdWxsZXQoYWN0aXZlU2xpZGVJbmRleCwgYWN0aXZlQnVsbGV0SW5kZXggLSAxKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSBpZiAoYnVsbGV0c1twcmV2U2xpZGVJbmRleF0pIHtcbiAgICAgICAgICBhY3RpdmF0ZUJ1bGxldChwcmV2U2xpZGVJbmRleCwgYnVsbGV0c1twcmV2U2xpZGVJbmRleF0ubGVuZ3RoIC0gMSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIGFjdGl2YXRlQnVsbGV0ID0gZnVuY3Rpb24oc2xpZGVJbmRleCwgYnVsbGV0SW5kZXgpIHtcbiAgICAgICAgYWN0aXZlU2xpZGVJbmRleCA9IHNsaWRlSW5kZXg7XG4gICAgICAgIGFjdGl2ZUJ1bGxldEluZGV4ID0gYnVsbGV0SW5kZXg7XG5cbiAgICAgICAgYnVsbGV0cy5mb3JFYWNoKGZ1bmN0aW9uKHNsaWRlLCBzKSB7XG4gICAgICAgICAgc2xpZGUuZm9yRWFjaChmdW5jdGlvbihidWxsZXQsIGIpIHtcbiAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJ1bGxldCcpO1xuXG4gICAgICAgICAgICBpZiAocyA8IHNsaWRlSW5kZXggfHwgcyA9PT0gc2xpZGVJbmRleCAmJiBiIDw9IGJ1bGxldEluZGV4KSB7XG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJ1bGxldC1hY3RpdmUnKTtcbiAgICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5yZW1vdmUoJ2Jlc3Bva2UtYnVsbGV0LWluYWN0aXZlJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1idWxsZXQtaW5hY3RpdmUnKTtcbiAgICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5yZW1vdmUoJ2Jlc3Bva2UtYnVsbGV0LWFjdGl2ZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocyA9PT0gc2xpZGVJbmRleCAmJiBiID09PSBidWxsZXRJbmRleCkge1xuICAgICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1idWxsZXQtY3VycmVudCcpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5yZW1vdmUoJ2Jlc3Bva2UtYnVsbGV0LWN1cnJlbnQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuXG4gICAgICBhY3RpdmVTbGlkZUhhc0J1bGxldEJ5T2Zmc2V0ID0gZnVuY3Rpb24ob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBidWxsZXRzW2FjdGl2ZVNsaWRlSW5kZXhdW2FjdGl2ZUJ1bGxldEluZGV4ICsgb2Zmc2V0XSAhPT0gdW5kZWZpbmVkO1xuICAgICAgfTtcblxuICAgIGRlY2sub24oJ25leHQnLCBuZXh0KTtcbiAgICBkZWNrLm9uKCdwcmV2JywgcHJldik7XG5cbiAgICBkZWNrLm9uKCdzbGlkZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGFjdGl2YXRlQnVsbGV0KGUuaW5kZXgsIDApO1xuICAgIH0pO1xuXG4gICAgYWN0aXZhdGVCdWxsZXQoMCwgMCk7XG4gIH07XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcbiAgICBkZWNrLnNsaWRlcy5mb3JFYWNoKGZ1bmN0aW9uKHNsaWRlKSB7XG4gICAgICBzbGlkZS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBpZiAoL0lOUFVUfFRFWFRBUkVBfFNFTEVDVC8udGVzdChlLnRhcmdldC5ub2RlTmFtZSkgfHwgZS50YXJnZXQuY29udGVudEVkaXRhYmxlID09PSAndHJ1ZScpIHtcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xuICAgIHZhciBhY3RpdmF0ZVNsaWRlID0gZnVuY3Rpb24oaW5kZXgpIHtcbiAgICAgIHZhciBpbmRleFRvQWN0aXZhdGUgPSAtMSA8IGluZGV4ICYmIGluZGV4IDwgZGVjay5zbGlkZXMubGVuZ3RoID8gaW5kZXggOiAwO1xuICAgICAgaWYgKGluZGV4VG9BY3RpdmF0ZSAhPT0gZGVjay5zbGlkZSgpKSB7XG4gICAgICAgIGRlY2suc2xpZGUoaW5kZXhUb0FjdGl2YXRlKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgdmFyIHBhcnNlSGFzaCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGhhc2ggPSB3aW5kb3cubG9jYXRpb24uaGFzaC5zbGljZSgxKSxcbiAgICAgICAgc2xpZGVOdW1iZXJPck5hbWUgPSBwYXJzZUludChoYXNoLCAxMCk7XG5cbiAgICAgIGlmIChoYXNoKSB7XG4gICAgICAgIGlmIChzbGlkZU51bWJlck9yTmFtZSkge1xuICAgICAgICAgIGFjdGl2YXRlU2xpZGUoc2xpZGVOdW1iZXJPck5hbWUgLSAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWNrLnNsaWRlcy5mb3JFYWNoKGZ1bmN0aW9uKHNsaWRlLCBpKSB7XG4gICAgICAgICAgICBpZiAoc2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtaGFzaCcpID09PSBoYXNoIHx8IHNsaWRlLmlkID09PSBoYXNoKSB7XG4gICAgICAgICAgICAgIGFjdGl2YXRlU2xpZGUoaSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgIHBhcnNlSGFzaCgpO1xuXG4gICAgICBkZWNrLm9uKCdhY3RpdmF0ZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgdmFyIHNsaWRlTmFtZSA9IGUuc2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtaGFzaCcpIHx8IGUuc2xpZGUuaWQ7XG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gc2xpZGVOYW1lIHx8IGUuaW5kZXggKyAxO1xuICAgICAgfSk7XG5cbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdoYXNoY2hhbmdlJywgcGFyc2VIYXNoKTtcbiAgICB9LCAwKTtcbiAgfTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcbiAgICB2YXIgaXNIb3Jpem9udGFsID0gb3B0aW9ucyAhPT0gJ3ZlcnRpY2FsJztcblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBmdW5jdGlvbihlKSB7XG4gICAgICBpZiAoZS53aGljaCA9PSAzNCB8fCAvLyBQQUdFIERPV05cbiAgICAgICAgKGUud2hpY2ggPT0gMzIgJiYgIWUuc2hpZnRLZXkpIHx8IC8vIFNQQUNFIFdJVEhPVVQgU0hJRlRcbiAgICAgICAgKGlzSG9yaXpvbnRhbCAmJiBlLndoaWNoID09IDM5KSB8fCAvLyBSSUdIVFxuICAgICAgICAoIWlzSG9yaXpvbnRhbCAmJiBlLndoaWNoID09IDQwKSAvLyBET1dOXG4gICAgICApIHsgZGVjay5uZXh0KCk7IH1cblxuICAgICAgaWYgKGUud2hpY2ggPT0gMzMgfHwgLy8gUEFHRSBVUFxuICAgICAgICAoZS53aGljaCA9PSAzMiAmJiBlLnNoaWZ0S2V5KSB8fCAvLyBTUEFDRSArIFNISUZUXG4gICAgICAgIChpc0hvcml6b250YWwgJiYgZS53aGljaCA9PSAzNykgfHwgLy8gTEVGVFxuICAgICAgICAoIWlzSG9yaXpvbnRhbCAmJiBlLndoaWNoID09IDM4KSAvLyBVUFxuICAgICAgKSB7IGRlY2sucHJldigpOyB9XG4gICAgfSk7XG4gIH07XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoZGVjaykge1xuICAgIHZhciBwcm9ncmVzc1BhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuICAgICAgcHJvZ3Jlc3NCYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcbiAgICAgIHByb3AgPSBvcHRpb25zID09PSAndmVydGljYWwnID8gJ2hlaWdodCcgOiAnd2lkdGgnO1xuXG4gICAgcHJvZ3Jlc3NQYXJlbnQuY2xhc3NOYW1lID0gJ2Jlc3Bva2UtcHJvZ3Jlc3MtcGFyZW50JztcbiAgICBwcm9ncmVzc0Jhci5jbGFzc05hbWUgPSAnYmVzcG9rZS1wcm9ncmVzcy1iYXInO1xuICAgIHByb2dyZXNzUGFyZW50LmFwcGVuZENoaWxkKHByb2dyZXNzQmFyKTtcbiAgICBkZWNrLnBhcmVudC5hcHBlbmRDaGlsZChwcm9ncmVzc1BhcmVudCk7XG5cbiAgICBkZWNrLm9uKCdhY3RpdmF0ZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIHByb2dyZXNzQmFyLnN0eWxlW3Byb3BdID0gKGUuaW5kZXggKiAxMDAgLyAoZGVjay5zbGlkZXMubGVuZ3RoIC0gMSkpICsgJyUnO1xuICAgIH0pO1xuICB9O1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xuICAgIHZhciBwYXJlbnQgPSBkZWNrLnBhcmVudCxcbiAgICAgIGZpcnN0U2xpZGUgPSBkZWNrLnNsaWRlc1swXSxcbiAgICAgIHNsaWRlSGVpZ2h0ID0gZmlyc3RTbGlkZS5vZmZzZXRIZWlnaHQsXG4gICAgICBzbGlkZVdpZHRoID0gZmlyc3RTbGlkZS5vZmZzZXRXaWR0aCxcbiAgICAgIHVzZVpvb20gPSBvcHRpb25zID09PSAnem9vbScgfHwgKCd6b29tJyBpbiBwYXJlbnQuc3R5bGUgJiYgb3B0aW9ucyAhPT0gJ3RyYW5zZm9ybScpLFxuXG4gICAgICB3cmFwID0gZnVuY3Rpb24oZWxlbWVudCkge1xuICAgICAgICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICB3cmFwcGVyLmNsYXNzTmFtZSA9ICdiZXNwb2tlLXNjYWxlLXBhcmVudCc7XG4gICAgICAgIGVsZW1lbnQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUod3JhcHBlciwgZWxlbWVudCk7XG4gICAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XG4gICAgICAgIHJldHVybiB3cmFwcGVyO1xuICAgICAgfSxcblxuICAgICAgZWxlbWVudHMgPSB1c2Vab29tID8gZGVjay5zbGlkZXMgOiBkZWNrLnNsaWRlcy5tYXAod3JhcCksXG5cbiAgICAgIHRyYW5zZm9ybVByb3BlcnR5ID0gKGZ1bmN0aW9uKHByb3BlcnR5KSB7XG4gICAgICAgIHZhciBwcmVmaXhlcyA9ICdNb3ogV2Via2l0IE8gbXMnLnNwbGl0KCcgJyk7XG4gICAgICAgIHJldHVybiBwcmVmaXhlcy5yZWR1Y2UoZnVuY3Rpb24oY3VycmVudFByb3BlcnR5LCBwcmVmaXgpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmVmaXggKyBwcm9wZXJ0eSBpbiBwYXJlbnQuc3R5bGUgPyBwcmVmaXggKyBwcm9wZXJ0eSA6IGN1cnJlbnRQcm9wZXJ0eTtcbiAgICAgICAgICB9LCBwcm9wZXJ0eS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgIH0oJ1RyYW5zZm9ybScpKSxcblxuICAgICAgc2NhbGUgPSB1c2Vab29tID9cbiAgICAgICAgZnVuY3Rpb24ocmF0aW8sIGVsZW1lbnQpIHtcbiAgICAgICAgICBlbGVtZW50LnN0eWxlLnpvb20gPSByYXRpbztcbiAgICAgICAgfSA6XG4gICAgICAgIGZ1bmN0aW9uKHJhdGlvLCBlbGVtZW50KSB7XG4gICAgICAgICAgZWxlbWVudC5zdHlsZVt0cmFuc2Zvcm1Qcm9wZXJ0eV0gPSAnc2NhbGUoJyArIHJhdGlvICsgJyknO1xuICAgICAgICB9LFxuXG4gICAgICBzY2FsZUFsbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgeFNjYWxlID0gcGFyZW50Lm9mZnNldFdpZHRoIC8gc2xpZGVXaWR0aCxcbiAgICAgICAgICB5U2NhbGUgPSBwYXJlbnQub2Zmc2V0SGVpZ2h0IC8gc2xpZGVIZWlnaHQ7XG5cbiAgICAgICAgZWxlbWVudHMuZm9yRWFjaChzY2FsZS5iaW5kKG51bGwsIE1hdGgubWluKHhTY2FsZSwgeVNjYWxlKSkpO1xuICAgICAgfTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCBzY2FsZUFsbCk7XG4gICAgc2NhbGVBbGwoKTtcbiAgfTtcblxufTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbi8qISBiZXNwb2tlLXRoZW1lLWF0b21hbnRpYyB2Mi4xLjQgwqkgMjAxNiBBZGFtIEVpdnksIE1JVCBMaWNlbnNlICovXHJcbiFmdW5jdGlvbih0KXtpZihcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cyYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIG1vZHVsZSltb2R1bGUuZXhwb3J0cz10KCk7ZWxzZSBpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQpZGVmaW5lKFtdLHQpO2Vsc2V7dmFyIGU7ZT1cInVuZGVmaW5lZFwiIT10eXBlb2Ygd2luZG93P3dpbmRvdzpcInVuZGVmaW5lZFwiIT10eXBlb2YgZ2xvYmFsP2dsb2JhbDpcInVuZGVmaW5lZFwiIT10eXBlb2Ygc2VsZj9zZWxmOnRoaXMsZT1lLmJlc3Bva2V8fChlLmJlc3Bva2U9e30pLGU9ZS50aGVtZXN8fChlLnRoZW1lcz17fSksZS5hdG9tYW50aWM9dCgpfX0oZnVuY3Rpb24oKXtyZXR1cm4gZnVuY3Rpb24gdChlLGEsbil7ZnVuY3Rpb24gbyhpLHMpe2lmKCFhW2ldKXtpZighZVtpXSl7dmFyIG09XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighcyYmbSlyZXR1cm4gbShpLCEwKTtpZihyKXJldHVybiByKGksITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIHA9YVtpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbih0KXt2YXIgYT1lW2ldWzFdW3RdO3JldHVybiBvKGE/YTp0KX0scCxwLmV4cG9ydHMsdCxlLGEsbil9cmV0dXJuIGFbaV0uZXhwb3J0c31mb3IodmFyIHI9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTxuLmxlbmd0aDtpKyspbyhuW2ldKTtyZXR1cm4gb30oezE6W2Z1bmN0aW9uKHQsZSxhKXt2YXIgbj10KFwiYmVzcG9rZS1jbGFzc2VzXCIpLG89dChcImluc2VydC1jc3NcIikscj1mdW5jdGlvbih0KXt2YXIgZT10LnNsaWRlcy5tYXAoZnVuY3Rpb24odCl7cmV0dXJuW10uc2xpY2UuY2FsbCh0LnF1ZXJ5U2VsZWN0b3JBbGwoXCJ4LWdpZlwiKSwwKX0pLGE9ZnVuY3Rpb24odCl7cmV0dXJuIGZ1bmN0aW9uKGEpe2VbYS5pbmRleF0ubWFwKGZ1bmN0aW9uKGUpe3Q/ZS5zZXRBdHRyaWJ1dGUoXCJzdG9wcGVkXCIsXCJcIik6ZS5yZW1vdmVBdHRyaWJ1dGUoXCJzdG9wcGVkXCIpLGEuc2xpZGUuY2xhc3NMaXN0LnJlbW92ZShcIngtZ2lmLWZpbmlzaGVkXCIpLHR8fGUuYWRkRXZlbnRMaXN0ZW5lcihcIngtZ2lmLWZpbmlzaGVkXCIsZnVuY3Rpb24oKXthLnNsaWRlLmNsYXNzTGlzdC5hZGQoXCJ4LWdpZi1maW5pc2hlZFwiKX0pfSl9fTt0Lm9uKFwiYWN0aXZhdGVcIixhKCExKSksdC5vbihcImRlYWN0aXZhdGVcIixhKCEwKSl9LHM9ZnVuY3Rpb24odCl7dC5vbihcImFjdGl2YXRlXCIsZnVuY3Rpb24odCl7QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCh0LnNsaWRlLnF1ZXJ5U2VsZWN0b3JBbGwoXCIuYW5pbWF0ZWRcIil8fFtdLGZ1bmN0aW9uKHQpe3Qub3V0ZXJIVE1MPXQub3V0ZXJIVE1MLnJlcGxhY2UoXCJhbmltYXRlZFwiLFwiYW5pbWF0ZSBhbmltYXRlZFwiKX0pfSl9O2lmKGUuZXhwb3J0cz1mdW5jdGlvbigpe3ZhciB0PVwiLyohIG5vcm1hbGl6ZS5jc3MgdjMuMC4wIHwgTUlUIExpY2Vuc2UgfCBnaXQuaW8vbm9ybWFsaXplICovXFxuaHRtbHtmb250LWZhbWlseTpzYW5zLXNlcmlmOy1tcy10ZXh0LXNpemUtYWRqdXN0OjEwMCU7LXdlYmtpdC10ZXh0LXNpemUtYWRqdXN0OjEwMCV9Ym9keXttYXJnaW46MH1hcnRpY2xlLGFzaWRlLGRldGFpbHMsZmlnY2FwdGlvbixmaWd1cmUsZm9vdGVyLGhlYWRlcixoZ3JvdXAsbWFpbixuYXYsc2VjdGlvbixzdW1tYXJ5e2Rpc3BsYXk6YmxvY2t9YXVkaW8sY2FudmFzLHByb2dyZXNzLHZpZGVve2Rpc3BsYXk6aW5saW5lLWJsb2NrO3ZlcnRpY2FsLWFsaWduOmJhc2VsaW5lfWF1ZGlvOm5vdChbY29udHJvbHNdKXtkaXNwbGF5Om5vbmU7aGVpZ2h0OjB9W2hpZGRlbl0sdGVtcGxhdGV7ZGlzcGxheTpub25lfWF7YmFja2dyb3VuZDowIDB9YTphY3RpdmUsYTpob3ZlcntvdXRsaW5lOjB9YWJiclt0aXRsZV17Ym9yZGVyLWJvdHRvbToxcHggZG90dGVkfWIsc3Ryb25ne2ZvbnQtd2VpZ2h0OjcwMH1kZm57Zm9udC1zdHlsZTppdGFsaWN9aDF7Zm9udC1zaXplOjJlbTttYXJnaW46LjY3ZW0gMH1tYXJre2JhY2tncm91bmQ6I2ZmMDtjb2xvcjojMDAwfXNtYWxse2ZvbnQtc2l6ZTo4MCV9c3ViLHN1cHtmb250LXNpemU6NzUlO2xpbmUtaGVpZ2h0OjA7cG9zaXRpb246cmVsYXRpdmU7dmVydGljYWwtYWxpZ246YmFzZWxpbmV9c3Vwe3RvcDotLjVlbX1zdWJ7Ym90dG9tOi0uMjVlbX1pbWd7Ym9yZGVyOjB9c3ZnOm5vdCg6cm9vdCl7b3ZlcmZsb3c6aGlkZGVufWZpZ3VyZXttYXJnaW46MWVtIDQwcHh9aHJ7Ym94LXNpemluZzpjb250ZW50LWJveDtoZWlnaHQ6MH1wcmV7b3ZlcmZsb3c6YXV0b31jb2RlLGtiZCxwcmUsc2FtcHtmb250LWZhbWlseTptb25vc3BhY2UsbW9ub3NwYWNlO2ZvbnQtc2l6ZToxZW19YnV0dG9uLGlucHV0LG9wdGdyb3VwLHNlbGVjdCx0ZXh0YXJlYXtjb2xvcjppbmhlcml0O2ZvbnQ6aW5oZXJpdDttYXJnaW46MH1idXR0b257b3ZlcmZsb3c6dmlzaWJsZX1idXR0b24sc2VsZWN0e3RleHQtdHJhbnNmb3JtOm5vbmV9YnV0dG9uLGh0bWwgaW5wdXRbdHlwZT1idXR0b25dLGlucHV0W3R5cGU9cmVzZXRdLGlucHV0W3R5cGU9c3VibWl0XXstd2Via2l0LWFwcGVhcmFuY2U6YnV0dG9uO2N1cnNvcjpwb2ludGVyfWJ1dHRvbltkaXNhYmxlZF0saHRtbCBpbnB1dFtkaXNhYmxlZF17Y3Vyc29yOmRlZmF1bHR9YnV0dG9uOjotbW96LWZvY3VzLWlubmVyLGlucHV0OjotbW96LWZvY3VzLWlubmVye2JvcmRlcjowO3BhZGRpbmc6MH1pbnB1dHtsaW5lLWhlaWdodDpub3JtYWx9aW5wdXRbdHlwZT1jaGVja2JveF0saW5wdXRbdHlwZT1yYWRpb117Ym94LXNpemluZzpib3JkZXItYm94O3BhZGRpbmc6MH1pbnB1dFt0eXBlPW51bWJlcl06Oi13ZWJraXQtaW5uZXItc3Bpbi1idXR0b24saW5wdXRbdHlwZT1udW1iZXJdOjotd2Via2l0LW91dGVyLXNwaW4tYnV0dG9ue2hlaWdodDphdXRvfWlucHV0W3R5cGU9c2VhcmNoXXstd2Via2l0LWFwcGVhcmFuY2U6dGV4dGZpZWxkO2JveC1zaXppbmc6Y29udGVudC1ib3h9aW5wdXRbdHlwZT1zZWFyY2hdOjotd2Via2l0LXNlYXJjaC1jYW5jZWwtYnV0dG9uLGlucHV0W3R5cGU9c2VhcmNoXTo6LXdlYmtpdC1zZWFyY2gtZGVjb3JhdGlvbnstd2Via2l0LWFwcGVhcmFuY2U6bm9uZX1maWVsZHNldHtib3JkZXI6MXB4IHNvbGlkIHNpbHZlcjttYXJnaW46MCAycHg7cGFkZGluZzouMzVlbSAuNjI1ZW0gLjc1ZW19bGVnZW5ke2JvcmRlcjowfXRleHRhcmVhe292ZXJmbG93OmF1dG99b3B0Z3JvdXB7Zm9udC13ZWlnaHQ6NzAwfXRhYmxle2JvcmRlci1jb2xsYXBzZTpjb2xsYXBzZTtib3JkZXItc3BhY2luZzowfWxlZ2VuZCx0ZCx0aHtwYWRkaW5nOjB9XFxuLyohXFxuICogYW5pbWF0ZS5jc3MgLWh0dHA6Ly9kYW5lZGVuLm1lL2FuaW1hdGVcXG4gKiBWZXJzaW9uIC0gMy41LjFcXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UgLSBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUXFxuICpcXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTYgRGFuaWVsIEVkZW5cXG4gKi9cXG4uYW5pbWF0ZWR7YW5pbWF0aW9uLWR1cmF0aW9uOjFzO2FuaW1hdGlvbi1maWxsLW1vZGU6Ym90aH0uYW5pbWF0ZWQuaW5maW5pdGV7YW5pbWF0aW9uLWl0ZXJhdGlvbi1jb3VudDppbmZpbml0ZX0uYW5pbWF0ZWQuaGluZ2V7YW5pbWF0aW9uLWR1cmF0aW9uOjJzfS5hbmltYXRlZC5ib3VuY2VJbiwuYW5pbWF0ZWQuYm91bmNlT3V0LC5hbmltYXRlZC5mbGlwT3V0WCwuYW5pbWF0ZWQuZmxpcE91dFl7YW5pbWF0aW9uLWR1cmF0aW9uOi43NXN9QGtleWZyYW1lcyBib3VuY2V7MCUsMjAlLDUzJSw4MCUsdG97YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjIxNSwuNjEsLjM1NSwxKTt0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX00MCUsNDMle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLC0zMHB4LDApfTQwJSw0MyUsNzAle2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC43NTUsLjA1LC44NTUsLjA2KX03MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTE1cHgsMCl9OTAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLC00cHgsMCl9fS5ib3VuY2V7YW5pbWF0aW9uLW5hbWU6Ym91bmNlO3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyIGJvdHRvbX1Aa2V5ZnJhbWVzIGZsYXNoezAlLDUwJSx0b3tvcGFjaXR5OjF9MjUlLDc1JXtvcGFjaXR5OjB9fS5mbGFzaHthbmltYXRpb24tbmFtZTpmbGFzaH1Aa2V5ZnJhbWVzIHB1bHNlezAlLHRve3RyYW5zZm9ybTpzY2FsZVgoMSl9NTAle3RyYW5zZm9ybTpzY2FsZTNkKDEuMDUsMS4wNSwxLjA1KX19LnB1bHNle2FuaW1hdGlvbi1uYW1lOnB1bHNlfUBrZXlmcmFtZXMgcnViYmVyQmFuZHswJSx0b3t0cmFuc2Zvcm06c2NhbGVYKDEpfTMwJXt0cmFuc2Zvcm06c2NhbGUzZCgxLjI1LC43NSwxKX00MCV7dHJhbnNmb3JtOnNjYWxlM2QoLjc1LDEuMjUsMSl9NTAle3RyYW5zZm9ybTpzY2FsZTNkKDEuMTUsLjg1LDEpfTY1JXt0cmFuc2Zvcm06c2NhbGUzZCguOTUsMS4wNSwxKX03NSV7dHJhbnNmb3JtOnNjYWxlM2QoMS4wNSwuOTUsMSl9fS5ydWJiZXJCYW5ke2FuaW1hdGlvbi1uYW1lOnJ1YmJlckJhbmR9QGtleWZyYW1lcyBzaGFrZXswJSx0b3t0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX0xMCUsMzAlLDUwJSw3MCUsOTAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMTBweCwwLDApfTIwJSw0MCUsNjAlLDgwJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTBweCwwLDApfX0uc2hha2V7YW5pbWF0aW9uLW5hbWU6c2hha2V9QGtleWZyYW1lcyBoZWFkU2hha2V7MCUsNTAle3RyYW5zZm9ybTp0cmFuc2xhdGVYKDApfTYuNSV7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTZweCkgcm90YXRlWSgtOWRlZyl9MTguNSV7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoNXB4KSByb3RhdGVZKDdkZWcpfTMxLjUle3RyYW5zZm9ybTp0cmFuc2xhdGVYKC0zcHgpIHJvdGF0ZVkoLTVkZWcpfTQzLjUle3RyYW5zZm9ybTp0cmFuc2xhdGVYKDJweCkgcm90YXRlWSgzZGVnKX19LmhlYWRTaGFrZXthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmVhc2UtaW4tb3V0O2FuaW1hdGlvbi1uYW1lOmhlYWRTaGFrZX1Aa2V5ZnJhbWVzIHN3aW5nezIwJXt0cmFuc2Zvcm06cm90YXRlKDE1ZGVnKX00MCV7dHJhbnNmb3JtOnJvdGF0ZSgtMTBkZWcpfTYwJXt0cmFuc2Zvcm06cm90YXRlKDVkZWcpfTgwJXt0cmFuc2Zvcm06cm90YXRlKC01ZGVnKX10b3t0cmFuc2Zvcm06cm90YXRlKDBkZWcpfX0uc3dpbmd7dHJhbnNmb3JtLW9yaWdpbjp0b3AgY2VudGVyO2FuaW1hdGlvbi1uYW1lOnN3aW5nfUBrZXlmcmFtZXMgdGFkYXswJSx0b3t0cmFuc2Zvcm06c2NhbGVYKDEpfTEwJSwyMCV7dHJhbnNmb3JtOnNjYWxlM2QoLjksLjksLjkpIHJvdGF0ZSgtM2RlZyl9MzAlLDUwJSw3MCUsOTAle3RyYW5zZm9ybTpzY2FsZTNkKDEuMSwxLjEsMS4xKSByb3RhdGUoM2RlZyl9NDAlLDYwJSw4MCV7dHJhbnNmb3JtOnNjYWxlM2QoMS4xLDEuMSwxLjEpIHJvdGF0ZSgtM2RlZyl9fS50YWRhe2FuaW1hdGlvbi1uYW1lOnRhZGF9QGtleWZyYW1lcyB3b2JibGV7MCUsdG97dHJhbnNmb3JtOm5vbmV9MTUle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMjUlLDAsMCkgcm90YXRlKC01ZGVnKX0zMCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDIwJSwwLDApIHJvdGF0ZSgzZGVnKX00NSV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xNSUsMCwwKSByb3RhdGUoLTNkZWcpfTYwJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTAlLDAsMCkgcm90YXRlKDJkZWcpfTc1JXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTUlLDAsMCkgcm90YXRlKC0xZGVnKX19LndvYmJsZXthbmltYXRpb24tbmFtZTp3b2JibGV9QGtleWZyYW1lcyBqZWxsb3swJSwxMS4xJSx0b3t0cmFuc2Zvcm06bm9uZX0yMi4yJXt0cmFuc2Zvcm06c2tld1goLTEyLjVkZWcpIHNrZXdZKC0xMi41ZGVnKX0zMy4zJXt0cmFuc2Zvcm06c2tld1goNi4yNWRlZykgc2tld1koNi4yNWRlZyl9NDQuNCV7dHJhbnNmb3JtOnNrZXdYKC0zLjEyNWRlZykgc2tld1koLTMuMTI1ZGVnKX01NS41JXt0cmFuc2Zvcm06c2tld1goMS41NjI1ZGVnKSBza2V3WSgxLjU2MjVkZWcpfTY2LjYle3RyYW5zZm9ybTpza2V3WCgtLjc4MTI1ZGVnKSBza2V3WSgtLjc4MTI1ZGVnKX03Ny43JXt0cmFuc2Zvcm06c2tld1goLjM5MDYyNWRlZykgc2tld1koLjM5MDYyNWRlZyl9ODguOCV7dHJhbnNmb3JtOnNrZXdYKC0uMTk1MzEyNWRlZykgc2tld1koLS4xOTUzMTI1ZGVnKX19LmplbGxve2FuaW1hdGlvbi1uYW1lOmplbGxvO3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyfUBrZXlmcmFtZXMgYm91bmNlSW57MCUsMjAlLDQwJSw2MCUsODAlLHRve2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4yMTUsLjYxLC4zNTUsMSl9MCV7b3BhY2l0eTowO3RyYW5zZm9ybTpzY2FsZTNkKC4zLC4zLC4zKX0yMCV7dHJhbnNmb3JtOnNjYWxlM2QoMS4xLDEuMSwxLjEpfTQwJXt0cmFuc2Zvcm06c2NhbGUzZCguOSwuOSwuOSl9NjAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCgxLjAzLDEuMDMsMS4wMyl9ODAle3RyYW5zZm9ybTpzY2FsZTNkKC45NywuOTcsLjk3KX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOnNjYWxlWCgxKX19LmJvdW5jZUlue2FuaW1hdGlvbi1uYW1lOmJvdW5jZUlufUBrZXlmcmFtZXMgYm91bmNlSW5Eb3duezAlLDYwJSw3NSUsOTAlLHRve2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4yMTUsLjYxLC4zNTUsMSl9MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLC0zMDAwcHgsMCl9NjAle29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwyNXB4LDApfTc1JXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMTBweCwwKX05MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsNXB4LDApfXRve3RyYW5zZm9ybTpub25lfX0uYm91bmNlSW5Eb3due2FuaW1hdGlvbi1uYW1lOmJvdW5jZUluRG93bn1Aa2V5ZnJhbWVzIGJvdW5jZUluTGVmdHswJSw2MCUsNzUlLDkwJSx0b3thbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguMjE1LC42MSwuMzU1LDEpfTAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTMwMDBweCwwLDApfTYwJXtvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDI1cHgsMCwwKX03NSV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xMHB4LDAsMCl9OTAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCg1cHgsMCwwKX10b3t0cmFuc2Zvcm06bm9uZX19LmJvdW5jZUluTGVmdHthbmltYXRpb24tbmFtZTpib3VuY2VJbkxlZnR9QGtleWZyYW1lcyBib3VuY2VJblJpZ2h0ezAlLDYwJSw3NSUsOTAlLHRve2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4yMTUsLjYxLC4zNTUsMSl9MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgzMDAwcHgsMCwwKX02MCV7b3BhY2l0eToxO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMjVweCwwLDApfTc1JXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTBweCwwLDApfTkwJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTVweCwwLDApfXRve3RyYW5zZm9ybTpub25lfX0uYm91bmNlSW5SaWdodHthbmltYXRpb24tbmFtZTpib3VuY2VJblJpZ2h0fUBrZXlmcmFtZXMgYm91bmNlSW5VcHswJSw2MCUsNzUlLDkwJSx0b3thbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguMjE1LC42MSwuMzU1LDEpfTAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwzMDAwcHgsMCl9NjAle29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMjBweCwwKX03NSV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMTBweCwwKX05MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTVweCwwKX10b3t0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX19LmJvdW5jZUluVXB7YW5pbWF0aW9uLW5hbWU6Ym91bmNlSW5VcH1Aa2V5ZnJhbWVzIGJvdW5jZU91dHsyMCV7dHJhbnNmb3JtOnNjYWxlM2QoLjksLjksLjkpfTUwJSw1NSV7b3BhY2l0eToxO3RyYW5zZm9ybTpzY2FsZTNkKDEuMSwxLjEsMS4xKX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlM2QoLjMsLjMsLjMpfX0uYm91bmNlT3V0e2FuaW1hdGlvbi1uYW1lOmJvdW5jZU91dH1Aa2V5ZnJhbWVzIGJvdW5jZU91dERvd257MjAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDEwcHgsMCl9NDAlLDQ1JXtvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTIwcHgsMCl9dG97b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDIwMDBweCwwKX19LmJvdW5jZU91dERvd257YW5pbWF0aW9uLW5hbWU6Ym91bmNlT3V0RG93bn1Aa2V5ZnJhbWVzIGJvdW5jZU91dExlZnR7MjAle29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMjBweCwwLDApfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTIwMDBweCwwLDApfX0uYm91bmNlT3V0TGVmdHthbmltYXRpb24tbmFtZTpib3VuY2VPdXRMZWZ0fUBrZXlmcmFtZXMgYm91bmNlT3V0UmlnaHR7MjAle29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTIwcHgsMCwwKX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDIwMDBweCwwLDApfX0uYm91bmNlT3V0UmlnaHR7YW5pbWF0aW9uLW5hbWU6Ym91bmNlT3V0UmlnaHR9QGtleWZyYW1lcyBib3VuY2VPdXRVcHsyMCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTEwcHgsMCl9NDAlLDQ1JXtvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMjBweCwwKX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTIwMDBweCwwKX19LmJvdW5jZU91dFVwe2FuaW1hdGlvbi1uYW1lOmJvdW5jZU91dFVwfUBrZXlmcmFtZXMgZmFkZUluezAle29wYWNpdHk6MH10b3tvcGFjaXR5OjF9fS5mYWRlSW57YW5pbWF0aW9uLW5hbWU6ZmFkZUlufUBrZXlmcmFtZXMgZmFkZUluRG93bnswJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTEwMCUsMCl9dG97b3BhY2l0eToxO3RyYW5zZm9ybTpub25lfX0uZmFkZUluRG93bnthbmltYXRpb24tbmFtZTpmYWRlSW5Eb3dufUBrZXlmcmFtZXMgZmFkZUluRG93bkJpZ3swJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTIwMDBweCwwKX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9fS5mYWRlSW5Eb3duQmlne2FuaW1hdGlvbi1uYW1lOmZhZGVJbkRvd25CaWd9QGtleWZyYW1lcyBmYWRlSW5MZWZ0ezAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTEwMCUsMCwwKX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9fS5mYWRlSW5MZWZ0e2FuaW1hdGlvbi1uYW1lOmZhZGVJbkxlZnR9QGtleWZyYW1lcyBmYWRlSW5MZWZ0QmlnezAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTIwMDBweCwwLDApfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX19LmZhZGVJbkxlZnRCaWd7YW5pbWF0aW9uLW5hbWU6ZmFkZUluTGVmdEJpZ31Aa2V5ZnJhbWVzIGZhZGVJblJpZ2h0ezAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTAwJSwwLDApfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX19LmZhZGVJblJpZ2h0e2FuaW1hdGlvbi1uYW1lOmZhZGVJblJpZ2h0fUBrZXlmcmFtZXMgZmFkZUluUmlnaHRCaWd7MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgyMDAwcHgsMCwwKX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9fS5mYWRlSW5SaWdodEJpZ3thbmltYXRpb24tbmFtZTpmYWRlSW5SaWdodEJpZ31Aa2V5ZnJhbWVzIGZhZGVJblVwezAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwxMDAlLDApfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX19LmZhZGVJblVwe2FuaW1hdGlvbi1uYW1lOmZhZGVJblVwfUBrZXlmcmFtZXMgZmFkZUluVXBCaWd7MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDIwMDBweCwwKX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9fS5mYWRlSW5VcEJpZ3thbmltYXRpb24tbmFtZTpmYWRlSW5VcEJpZ31Aa2V5ZnJhbWVzIGZhZGVPdXR7MCV7b3BhY2l0eToxfXRve29wYWNpdHk6MH19LmZhZGVPdXR7YW5pbWF0aW9uLW5hbWU6ZmFkZU91dH1Aa2V5ZnJhbWVzIGZhZGVPdXREb3duezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMTAwJSwwKX19LmZhZGVPdXREb3due2FuaW1hdGlvbi1uYW1lOmZhZGVPdXREb3dufUBrZXlmcmFtZXMgZmFkZU91dERvd25CaWd7MCV7b3BhY2l0eToxfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwyMDAwcHgsMCl9fS5mYWRlT3V0RG93bkJpZ3thbmltYXRpb24tbmFtZTpmYWRlT3V0RG93bkJpZ31Aa2V5ZnJhbWVzIGZhZGVPdXRMZWZ0ezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xMDAlLDAsMCl9fS5mYWRlT3V0TGVmdHthbmltYXRpb24tbmFtZTpmYWRlT3V0TGVmdH1Aa2V5ZnJhbWVzIGZhZGVPdXRMZWZ0QmlnezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0yMDAwcHgsMCwwKX19LmZhZGVPdXRMZWZ0Qmlne2FuaW1hdGlvbi1uYW1lOmZhZGVPdXRMZWZ0QmlnfUBrZXlmcmFtZXMgZmFkZU91dFJpZ2h0ezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDEwMCUsMCwwKX19LmZhZGVPdXRSaWdodHthbmltYXRpb24tbmFtZTpmYWRlT3V0UmlnaHR9QGtleWZyYW1lcyBmYWRlT3V0UmlnaHRCaWd7MCV7b3BhY2l0eToxfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMjAwMHB4LDAsMCl9fS5mYWRlT3V0UmlnaHRCaWd7YW5pbWF0aW9uLW5hbWU6ZmFkZU91dFJpZ2h0QmlnfUBrZXlmcmFtZXMgZmFkZU91dFVwezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTEwMCUsMCl9fS5mYWRlT3V0VXB7YW5pbWF0aW9uLW5hbWU6ZmFkZU91dFVwfUBrZXlmcmFtZXMgZmFkZU91dFVwQmlnezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTIwMDBweCwwKX19LmZhZGVPdXRVcEJpZ3thbmltYXRpb24tbmFtZTpmYWRlT3V0VXBCaWd9QGtleWZyYW1lcyBmbGlwezAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWSgtMXR1cm4pO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1vdXR9NDAle2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1vdXQ7dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSB0cmFuc2xhdGVaKDE1MHB4KSByb3RhdGVZKC0xOTBkZWcpfTUwJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHRyYW5zbGF0ZVooMTUwcHgpIHJvdGF0ZVkoLTE3MGRlZyk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWlufTgwJXthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmVhc2UtaW47dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSBzY2FsZTNkKC45NSwuOTUsLjk1KX10b3t0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbn19LmFuaW1hdGVkLmZsaXB7LXdlYmtpdC1iYWNrZmFjZS12aXNpYmlsaXR5OnZpc2libGU7YmFja2ZhY2UtdmlzaWJpbGl0eTp2aXNpYmxlO2FuaW1hdGlvbi1uYW1lOmZsaXB9QGtleWZyYW1lcyBmbGlwSW5YezAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWCg5MGRlZyk7b3BhY2l0eTowO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbn00MCV7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWluO3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWCgtMjBkZWcpfTYwJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHJvdGF0ZVgoMTBkZWcpO29wYWNpdHk6MX04MCV7dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVYKC01ZGVnKX10b3t0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpfX0uZmxpcEluWCwuZmxpcEluWSwuZmxpcE91dFgsLmZsaXBPdXRZey13ZWJraXQtYmFja2ZhY2UtdmlzaWJpbGl0eTp2aXNpYmxlIWltcG9ydGFudDtiYWNrZmFjZS12aXNpYmlsaXR5OnZpc2libGUhaW1wb3J0YW50O2FuaW1hdGlvbi1uYW1lOmZsaXBJblh9QGtleWZyYW1lcyBmbGlwSW5ZezAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWSg5MGRlZyk7b3BhY2l0eTowO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbn00MCV7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWluO3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWSgtMjBkZWcpfTYwJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHJvdGF0ZVkoMTBkZWcpO29wYWNpdHk6MX04MCV7dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVZKC01ZGVnKX10b3t0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpfX0uZmxpcEluWSwuZmxpcE91dFgsLmZsaXBPdXRZe2FuaW1hdGlvbi1uYW1lOmZsaXBJbll9QGtleWZyYW1lcyBmbGlwT3V0WHswJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpfTMwJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHJvdGF0ZVgoLTIwZGVnKTtvcGFjaXR5OjF9dG97dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVYKDkwZGVnKTtvcGFjaXR5OjB9fS5mbGlwT3V0WCwuZmxpcE91dFl7YW5pbWF0aW9uLW5hbWU6ZmxpcE91dFh9QGtleWZyYW1lcyBmbGlwT3V0WXswJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpfTMwJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHJvdGF0ZVkoLTE1ZGVnKTtvcGFjaXR5OjF9dG97dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVZKDkwZGVnKTtvcGFjaXR5OjB9fS5mbGlwT3V0WXthbmltYXRpb24tbmFtZTpmbGlwT3V0WX1Aa2V5ZnJhbWVzIGxpZ2h0U3BlZWRJbnswJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTAwJSwwLDApIHNrZXdYKC0zMGRlZyk7b3BhY2l0eTowfTYwJXt0cmFuc2Zvcm06c2tld1goMjBkZWcpO29wYWNpdHk6MX04MCV7b3BhY2l0eToxO3RyYW5zZm9ybTpza2V3WCgtNWRlZyl9dG97dHJhbnNmb3JtOm5vbmU7b3BhY2l0eToxfX0ubGlnaHRTcGVlZElue2FuaW1hdGlvbi1uYW1lOmxpZ2h0U3BlZWRJbjthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmVhc2Utb3V0fUBrZXlmcmFtZXMgbGlnaHRTcGVlZE91dHswJXtvcGFjaXR5OjF9dG97dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDEwMCUsMCwwKSBza2V3WCgzMGRlZyk7b3BhY2l0eTowfX0ubGlnaHRTcGVlZE91dHthbmltYXRpb24tbmFtZTpsaWdodFNwZWVkT3V0O2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbn1Aa2V5ZnJhbWVzIHJvdGF0ZUluezAle3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyO3RyYW5zZm9ybTpyb3RhdGUoLTIwMGRlZyk7b3BhY2l0eTowOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpjZW50ZXJ9dG97LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOmNlbnRlcjt0cmFuc2Zvcm0tb3JpZ2luOmNlbnRlcjt0cmFuc2Zvcm06bm9uZTtvcGFjaXR5OjF9fS5yb3RhdGVJbnthbmltYXRpb24tbmFtZTpyb3RhdGVJbn1Aa2V5ZnJhbWVzIHJvdGF0ZUluRG93bkxlZnR7MCV7dHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm06cm90YXRlKC00NWRlZyk7b3BhY2l0eTowOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46bGVmdCBib3R0b207dHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm06bm9uZTtvcGFjaXR5OjF9fS5yb3RhdGVJbkRvd25MZWZ0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZUluRG93bkxlZnR9QGtleWZyYW1lcyByb3RhdGVJbkRvd25SaWdodHswJXt0cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbTt0cmFuc2Zvcm06cm90YXRlKDQ1ZGVnKTtvcGFjaXR5OjA7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybTpub25lO29wYWNpdHk6MX19LnJvdGF0ZUluRG93blJpZ2h0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZUluRG93blJpZ2h0fUBrZXlmcmFtZXMgcm90YXRlSW5VcExlZnR7MCV7dHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm06cm90YXRlKDQ1ZGVnKTtvcGFjaXR5OjA7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tfXRvey13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tO3RyYW5zZm9ybTpub25lO29wYWNpdHk6MX19LnJvdGF0ZUluVXBMZWZ0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZUluVXBMZWZ0fUBrZXlmcmFtZXMgcm90YXRlSW5VcFJpZ2h0ezAle3RyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybTpyb3RhdGUoLTkwZGVnKTtvcGFjaXR5OjA7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybTpub25lO29wYWNpdHk6MX19LnJvdGF0ZUluVXBSaWdodHthbmltYXRpb24tbmFtZTpyb3RhdGVJblVwUmlnaHR9QGtleWZyYW1lcyByb3RhdGVPdXR7MCV7dHJhbnNmb3JtLW9yaWdpbjpjZW50ZXI7b3BhY2l0eToxOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpjZW50ZXJ9dG97LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOmNlbnRlcjt0cmFuc2Zvcm0tb3JpZ2luOmNlbnRlcjt0cmFuc2Zvcm06cm90YXRlKDIwMGRlZyk7b3BhY2l0eTowfX0ucm90YXRlT3V0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZU91dH1Aa2V5ZnJhbWVzIHJvdGF0ZU91dERvd25MZWZ0ezAle3RyYW5zZm9ybS1vcmlnaW46bGVmdCBib3R0b207b3BhY2l0eToxOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46bGVmdCBib3R0b207dHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm06cm90YXRlKDQ1ZGVnKTtvcGFjaXR5OjB9fS5yb3RhdGVPdXREb3duTGVmdHthbmltYXRpb24tbmFtZTpyb3RhdGVPdXREb3duTGVmdH1Aa2V5ZnJhbWVzIHJvdGF0ZU91dERvd25SaWdodHswJXt0cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbTtvcGFjaXR5OjE7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybTpyb3RhdGUoLTQ1ZGVnKTtvcGFjaXR5OjB9fS5yb3RhdGVPdXREb3duUmlnaHR7YW5pbWF0aW9uLW5hbWU6cm90YXRlT3V0RG93blJpZ2h0fUBrZXlmcmFtZXMgcm90YXRlT3V0VXBMZWZ0ezAle3RyYW5zZm9ybS1vcmlnaW46bGVmdCBib3R0b207b3BhY2l0eToxOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46bGVmdCBib3R0b207dHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm06cm90YXRlKC00NWRlZyk7b3BhY2l0eTowfX0ucm90YXRlT3V0VXBMZWZ0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZU91dFVwTGVmdH1Aa2V5ZnJhbWVzIHJvdGF0ZU91dFVwUmlnaHR7MCV7dHJhbnNmb3JtLW9yaWdpbjpyaWdodCBib3R0b207b3BhY2l0eToxOy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpyaWdodCBib3R0b219dG97LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbTt0cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbTt0cmFuc2Zvcm06cm90YXRlKDkwZGVnKTtvcGFjaXR5OjB9fS5yb3RhdGVPdXRVcFJpZ2h0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZU91dFVwUmlnaHR9QGtleWZyYW1lcyBoaW5nZXswJXt0cmFuc2Zvcm0tb3JpZ2luOnRvcCBsZWZ0Oy13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjp0b3AgbGVmdDthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmVhc2UtaW4tb3V0fTIwJSw2MCV7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOnRvcCBsZWZ0O2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbi1vdXQ7dHJhbnNmb3JtOnJvdGF0ZSg4MGRlZyk7dHJhbnNmb3JtLW9yaWdpbjp0b3AgbGVmdH00MCUsODAle3RyYW5zZm9ybTpyb3RhdGUoNjBkZWcpO3RyYW5zZm9ybS1vcmlnaW46dG9wIGxlZnQ7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWluLW91dDtvcGFjaXR5OjF9dG97dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsNzAwcHgsMCk7b3BhY2l0eTowfX0uaGluZ2V7YW5pbWF0aW9uLW5hbWU6aGluZ2V9QGtleWZyYW1lcyByb2xsSW57MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMTAwJSwwLDApIHJvdGF0ZSgtMTIwZGVnKX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9fS5yb2xsSW57YW5pbWF0aW9uLW5hbWU6cm9sbElufUBrZXlmcmFtZXMgcm9sbE91dHswJXtvcGFjaXR5OjF9dG97b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgxMDAlLDAsMCkgcm90YXRlKDEyMGRlZyl9fS5yb2xsT3V0e2FuaW1hdGlvbi1uYW1lOnJvbGxPdXR9QGtleWZyYW1lcyB6b29tSW57MCV7b3BhY2l0eTowO3RyYW5zZm9ybTpzY2FsZTNkKC4zLC4zLC4zKX01MCV7b3BhY2l0eToxfX0uem9vbUlue2FuaW1hdGlvbi1uYW1lOnpvb21Jbn1Aa2V5ZnJhbWVzIHpvb21JbkRvd257MCV7b3BhY2l0eTowO3RyYW5zZm9ybTpzY2FsZTNkKC4xLC4xLC4xKSB0cmFuc2xhdGUzZCgwLC0xMDAwcHgsMCk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjU1LC4wNTUsLjY3NSwuMTkpfTYwJXtvcGFjaXR5OjE7dHJhbnNmb3JtOnNjYWxlM2QoLjQ3NSwuNDc1LC40NzUpIHRyYW5zbGF0ZTNkKDAsNjBweCwwKTthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguMTc1LC44ODUsLjMyLDEpfX0uem9vbUluRG93bnthbmltYXRpb24tbmFtZTp6b29tSW5Eb3dufUBrZXlmcmFtZXMgem9vbUluTGVmdHswJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlM2QoLjEsLjEsLjEpIHRyYW5zbGF0ZTNkKC0xMDAwcHgsMCwwKTthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguNTUsLjA1NSwuNjc1LC4xOSl9NjAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCguNDc1LC40NzUsLjQ3NSkgdHJhbnNsYXRlM2QoMTBweCwwLDApO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4xNzUsLjg4NSwuMzIsMSl9fS56b29tSW5MZWZ0e2FuaW1hdGlvbi1uYW1lOnpvb21JbkxlZnR9QGtleWZyYW1lcyB6b29tSW5SaWdodHswJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlM2QoLjEsLjEsLjEpIHRyYW5zbGF0ZTNkKDEwMDBweCwwLDApO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC41NSwuMDU1LC42NzUsLjE5KX02MCV7b3BhY2l0eToxO3RyYW5zZm9ybTpzY2FsZTNkKC40NzUsLjQ3NSwuNDc1KSB0cmFuc2xhdGUzZCgtMTBweCwwLDApO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4xNzUsLjg4NSwuMzIsMSl9fS56b29tSW5SaWdodHthbmltYXRpb24tbmFtZTp6b29tSW5SaWdodH1Aa2V5ZnJhbWVzIHpvb21JblVwezAle29wYWNpdHk6MDt0cmFuc2Zvcm06c2NhbGUzZCguMSwuMSwuMSkgdHJhbnNsYXRlM2QoMCwxMDAwcHgsMCk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjU1LC4wNTUsLjY3NSwuMTkpfTYwJXtvcGFjaXR5OjE7dHJhbnNmb3JtOnNjYWxlM2QoLjQ3NSwuNDc1LC40NzUpIHRyYW5zbGF0ZTNkKDAsLTYwcHgsMCk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjE3NSwuODg1LC4zMiwxKX19Lnpvb21JblVwe2FuaW1hdGlvbi1uYW1lOnpvb21JblVwfUBrZXlmcmFtZXMgem9vbU91dHswJXtvcGFjaXR5OjF9NTAle3RyYW5zZm9ybTpzY2FsZTNkKC4zLC4zLC4zKTtvcGFjaXR5OjB9dG97b3BhY2l0eTowfX0uem9vbU91dHthbmltYXRpb24tbmFtZTp6b29tT3V0fUBrZXlmcmFtZXMgem9vbU91dERvd257NDAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCguNDc1LC40NzUsLjQ3NSkgdHJhbnNsYXRlM2QoMCwtNjBweCwwKTthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguNTUsLjA1NSwuNjc1LC4xOSl9dG97b3BhY2l0eTowO3RyYW5zZm9ybTpzY2FsZTNkKC4xLC4xLC4xKSB0cmFuc2xhdGUzZCgwLDIwMDBweCwwKTt0cmFuc2Zvcm0tb3JpZ2luOmNlbnRlciBib3R0b207YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjE3NSwuODg1LC4zMiwxKX19Lnpvb21PdXREb3due2FuaW1hdGlvbi1uYW1lOnpvb21PdXREb3dufUBrZXlmcmFtZXMgem9vbU91dExlZnR7NDAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCguNDc1LC40NzUsLjQ3NSkgdHJhbnNsYXRlM2QoNDJweCwwLDApfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06c2NhbGUoLjEpIHRyYW5zbGF0ZTNkKC0yMDAwcHgsMCwwKTt0cmFuc2Zvcm0tb3JpZ2luOmxlZnQgY2VudGVyfX0uem9vbU91dExlZnR7YW5pbWF0aW9uLW5hbWU6em9vbU91dExlZnR9QGtleWZyYW1lcyB6b29tT3V0UmlnaHR7NDAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCguNDc1LC40NzUsLjQ3NSkgdHJhbnNsYXRlM2QoLTQycHgsMCwwKX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlKC4xKSB0cmFuc2xhdGUzZCgyMDAwcHgsMCwwKTt0cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGNlbnRlcn19Lnpvb21PdXRSaWdodHthbmltYXRpb24tbmFtZTp6b29tT3V0UmlnaHR9QGtleWZyYW1lcyB6b29tT3V0VXB7NDAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCguNDc1LC40NzUsLjQ3NSkgdHJhbnNsYXRlM2QoMCw2MHB4LDApO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC41NSwuMDU1LC42NzUsLjE5KX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlM2QoLjEsLjEsLjEpIHRyYW5zbGF0ZTNkKDAsLTIwMDBweCwwKTt0cmFuc2Zvcm0tb3JpZ2luOmNlbnRlciBib3R0b207YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjE3NSwuODg1LC4zMiwxKX19Lnpvb21PdXRVcHthbmltYXRpb24tbmFtZTp6b29tT3V0VXB9QGtleWZyYW1lcyBzbGlkZUluRG93bnswJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMTAwJSwwKTt2aXNpYmlsaXR5OnZpc2libGV9dG97dHJhbnNmb3JtOnRyYW5zbGF0ZVooMCl9fS5zbGlkZUluRG93bnthbmltYXRpb24tbmFtZTpzbGlkZUluRG93bn1Aa2V5ZnJhbWVzIHNsaWRlSW5MZWZ0ezAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMTAwJSwwLDApO3Zpc2liaWxpdHk6dmlzaWJsZX10b3t0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX19LnNsaWRlSW5MZWZ0e2FuaW1hdGlvbi1uYW1lOnNsaWRlSW5MZWZ0fUBrZXlmcmFtZXMgc2xpZGVJblJpZ2h0ezAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgxMDAlLDAsMCk7dmlzaWJpbGl0eTp2aXNpYmxlfXRve3RyYW5zZm9ybTp0cmFuc2xhdGVaKDApfX0uc2xpZGVJblJpZ2h0e2FuaW1hdGlvbi1uYW1lOnNsaWRlSW5SaWdodH1Aa2V5ZnJhbWVzIHNsaWRlSW5VcHswJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwxMDAlLDApO3Zpc2liaWxpdHk6dmlzaWJsZX10b3t0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX19LnNsaWRlSW5VcHthbmltYXRpb24tbmFtZTpzbGlkZUluVXB9QGtleWZyYW1lcyBzbGlkZU91dERvd257MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZVooMCl9dG97dmlzaWJpbGl0eTpoaWRkZW47dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMTAwJSwwKX19LnNsaWRlT3V0RG93bnthbmltYXRpb24tbmFtZTpzbGlkZU91dERvd259QGtleWZyYW1lcyBzbGlkZU91dExlZnR7MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZVooMCl9dG97dmlzaWJpbGl0eTpoaWRkZW47dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xMDAlLDAsMCl9fS5zbGlkZU91dExlZnR7YW5pbWF0aW9uLW5hbWU6c2xpZGVPdXRMZWZ0fUBrZXlmcmFtZXMgc2xpZGVPdXRSaWdodHswJXt0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX10b3t2aXNpYmlsaXR5OmhpZGRlbjt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTAwJSwwLDApfX0uc2xpZGVPdXRSaWdodHthbmltYXRpb24tbmFtZTpzbGlkZU91dFJpZ2h0fUBrZXlmcmFtZXMgc2xpZGVPdXRVcHswJXt0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX10b3t2aXNpYmlsaXR5OmhpZGRlbjt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMTAwJSwwKX19LnNsaWRlT3V0VXB7YW5pbWF0aW9uLW5hbWU6c2xpZGVPdXRVcH1ib2R5e2ZvbnQ6MThweC8xLjUgXFxcIkRyb2lkIFNhbnNcXFwiLGZ1dHVyYSxoZWx2ZXRpY2EsYXJpYWwsYXJpYWwsc2Fucy1zZXJpZjtmb250LXdlaWdodDoxMDA7Y29sb3I6cmdiYSgyNTUsMjU1LDI1NSwuOTUpO3RleHQtc2hhZG93OjAgMCAycHggIzAwMCwwIDAgNDBweCAjMDAwfWgxe2ZvbnQtc2l6ZTo1MHB4O2ZvbnQtd2VpZ2h0OjkwMDttYXJnaW46MCBhdXRvIDEwcHh9aDJ7Zm9udC1zaXplOjM2cHg7Zm9udC13ZWlnaHQ6MzAwO21hcmdpbjowIGF1dG8gNXB4fWgzLGg0LGg1e2ZvbnQtc2l6ZToyOHB4O21hcmdpbjowIGF1dG87Zm9udC13ZWlnaHQ6MjAwfWg0LGg1e2ZvbnQtc2l6ZToyMnB4fWg1e2ZvbnQtc2l6ZToxOHB4fW9sLHVse2ZvbnQtc2l6ZTozMnB4O2ZvbnQtd2VpZ2h0OjQwMH1vbC5ub3ByZWZpeCx1bC5ub3ByZWZpeHtsaXN0LXN0eWxlOm5vbmV9b2wubm9wcmVmaXggbGksdWwubm9wcmVmaXggbGl7bWFyZ2luLWxlZnQ6MH1vbC5ub3ByZWZpeCBsaTo6YmVmb3JlLHVsLm5vcHJlZml4IGxpOjpiZWZvcmV7Y29udGVudDpub25lfWxpe21hcmdpbi1ib3R0b206MTJweDt3aWR0aDoxMDAlO21hcmdpbi1sZWZ0Oi41ZW19b2wgb2wsb2wgdWwsdWwgb2wsdWwgdWx7bWFyZ2luLWxlZnQ6MzBweH1vbCBvbCBsaSxvbCB1bCBsaSx1bCBvbCBsaSx1bCB1bCBsaXttYXJnaW4tYm90dG9tOjA7bGluZS1oZWlnaHQ6MS40ZW19b2wgb2wsdWwgb2x7bGlzdC1zdHlsZS10eXBlOmxvd2VyLXJvbWFufWJsb2NrcXVvdGUsbGkscHJle3RleHQtYWxpZ246bGVmdH10ZCx0aHtwYWRkaW5nOjEwcHg7Ym9yZGVyOjFweCBzb2xpZCAjY2NjfXRoe2JhY2tncm91bmQtY29sb3I6IzMzM310ZHtiYWNrZ3JvdW5kLWNvbG9yOiM0NDQ7dGV4dC1zaGFkb3c6bm9uZX1wcmV7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoxMHB4fXByZSAuZW0tYmx1ZSxwcmUgLmVtLWdyZWVuLHByZSAuZW0tcmVkLHByZSAuZW0teWVsbG93e21hcmdpbjo1cHggMH0uYmVzcG9rZS1wYXJlbnQsLmJlc3Bva2Utc2NhbGUtcGFyZW50e3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowfS5iZXNwb2tlLXBhcmVudHstd2Via2l0LXRleHQtc2l6ZS1hZGp1c3Q6YXV0bzstbXMtdGV4dC1zaXplLWFkanVzdDphdXRvO3RleHQtc2l6ZS1hZGp1c3Q6YXV0bztiYWNrZ3JvdW5kOiMxMTE7b3ZlcmZsb3c6aGlkZGVuO3RyYW5zaXRpb246YmFja2dyb3VuZCAxcyBlYXNlO2JhY2tncm91bmQtcG9zaXRpb246NTAlIDUwJX0uYmVzcG9rZS1zY2FsZS1wYXJlbnR7cG9pbnRlci1ldmVudHM6bm9uZX0uYmVzcG9rZS1zY2FsZS1wYXJlbnQgLmJlc3Bva2UtYWN0aXZle3BvaW50ZXItZXZlbnRzOmF1dG99LmJlc3Bva2Utc2xpZGV7d2lkdGg6MTAwJTtoZWlnaHQ6MTAwJTtwb3NpdGlvbjphYnNvbHV0ZTtkaXNwbGF5Oi1tcy1mbGV4Ym94O2Rpc3BsYXk6ZmxleDstbXMtZmxleC1kaXJlY3Rpb246Y29sdW1uO2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjstbXMtZmxleC1wYWNrOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyOy1tcy1mbGV4LWFsaWduOmNlbnRlcjthbGlnbi1pdGVtczpjZW50ZXJ9LmJlc3Bva2Utc2xpZGUueC1naWYtZmluaXNoZWQgLmJveC53YWl0LWZvci1naWZ7b3BhY2l0eToxfS5iZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZSwuYmVzcG9rZS1pbmFjdGl2ZXtvcGFjaXR5OjA7cG9pbnRlci1ldmVudHM6bm9uZX0uYmVzcG9rZS1iYWNrZHJvcHtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjA7cmlnaHQ6MDtib3R0b206MDt6LWluZGV4Oi0xO29wYWNpdHk6MH0uYmVzcG9rZS1iYWNrZHJvcC1hY3RpdmV7b3BhY2l0eToxfS5iZXNwb2tlLXByb2dyZXNzLXBhcmVudHtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjA7cmlnaHQ6MDtoZWlnaHQ6LjN2d30uYmVzcG9rZS1wcm9ncmVzcy1iYXJ7cG9zaXRpb246YWJzb2x1dGU7aGVpZ2h0OjEwMCU7YmFja2dyb3VuZDojY2NjO3RyYW5zaXRpb246d2lkdGggLjZzIGVhc2V9LmNhcmJvbmZpYmVye2JhY2tncm91bmQ6cmFkaWFsLWdyYWRpZW50KCMwMDAgMTUlLHRyYW5zcGFyZW50IDE2JSkgMCAwLHJhZGlhbC1ncmFkaWVudCgjMDAwIDE1JSx0cmFuc3BhcmVudCAxNiUpIDhweCA4cHgscmFkaWFsLWdyYWRpZW50KHJnYmEoMjU1LDI1NSwyNTUsLjEpIDE1JSx0cmFuc3BhcmVudCAyMCUpIDAgMXB4LHJhZGlhbC1ncmFkaWVudChyZ2JhKDI1NSwyNTUsMjU1LC4xKSAxNSUsdHJhbnNwYXJlbnQgMjAlKSA4cHggOXB4O2JhY2tncm91bmQtY29sb3I6IzI4MjgyODtiYWNrZ3JvdW5kLXNpemU6MTZweCAxNnB4fS5jYXJib257YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMjdkZWcsIzE1MTUxNSA1cHgsdHJhbnNwYXJlbnQgNXB4KSAwIDVweCxsaW5lYXItZ3JhZGllbnQoMjA3ZGVnLCMxNTE1MTUgNXB4LHRyYW5zcGFyZW50IDVweCkgMTBweCAwLGxpbmVhci1ncmFkaWVudCgyN2RlZywjMjIyIDVweCx0cmFuc3BhcmVudCA1cHgpIDAgMTBweCxsaW5lYXItZ3JhZGllbnQoMjA3ZGVnLCMyMjIgNXB4LHRyYW5zcGFyZW50IDVweCkgMTBweCA1cHgsbGluZWFyLWdyYWRpZW50KDkwZGVnLCMxYjFiMWIgMTBweCx0cmFuc3BhcmVudCAxMHB4KSxsaW5lYXItZ3JhZGllbnQoIzFkMWQxZCAyNSUsIzFhMWExYSAyNSUsIzFhMWExYSA1MCUsdHJhbnNwYXJlbnQgNTAlLHRyYW5zcGFyZW50IDc1JSwjMjQyNDI0IDc1JSwjMjQyNDI0KTtiYWNrZ3JvdW5kLWNvbG9yOiMxMzEzMTM7YmFja2dyb3VuZC1zaXplOjIwcHggMjBweH0uc2VpZ2FpaGF7YmFja2dyb3VuZC1jb2xvcjpzaWx2ZXI7YmFja2dyb3VuZC1pbWFnZTpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDEwMCUgMTUwJSxzaWx2ZXIgMjQlLCNmZmYgMjUlLCNmZmYgMjglLHNpbHZlciAyOSUsc2lsdmVyIDM2JSwjZmZmIDM2JSwjZmZmIDQwJSx0cmFuc3BhcmVudCA0MCUsdHJhbnNwYXJlbnQpLHJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgMCAxNTAlLHNpbHZlciAyNCUsI2ZmZiAyNSUsI2ZmZiAyOCUsc2lsdmVyIDI5JSxzaWx2ZXIgMzYlLCNmZmYgMzYlLCNmZmYgNDAlLHRyYW5zcGFyZW50IDQwJSx0cmFuc3BhcmVudCkscmFkaWFsLWdyYWRpZW50KGNpcmNsZSBhdCA1MCUgMTAwJSwjZmZmIDEwJSxzaWx2ZXIgMTElLHNpbHZlciAyMyUsI2ZmZiAyNCUsI2ZmZiAzMCUsc2lsdmVyIDMxJSxzaWx2ZXIgNDMlLCNmZmYgNDQlLCNmZmYgNTAlLHNpbHZlciA1MSUsc2lsdmVyIDYzJSwjZmZmIDY0JSwjZmZmIDcxJSx0cmFuc3BhcmVudCA3MSUsdHJhbnNwYXJlbnQpLHJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgMTAwJSA1MCUsI2ZmZiA1JSxzaWx2ZXIgNiUsc2lsdmVyIDE1JSwjZmZmIDE2JSwjZmZmIDIwJSxzaWx2ZXIgMjElLHNpbHZlciAzMCUsI2ZmZiAzMSUsI2ZmZiAzNSUsc2lsdmVyIDM2JSxzaWx2ZXIgNDUlLCNmZmYgNDYlLCNmZmYgNDklLHRyYW5zcGFyZW50IDUwJSx0cmFuc3BhcmVudCkscmFkaWFsLWdyYWRpZW50KGNpcmNsZSBhdCAwIDUwJSwjZmZmIDUlLHNpbHZlciA2JSxzaWx2ZXIgMTUlLCNmZmYgMTYlLCNmZmYgMjAlLHNpbHZlciAyMSUsc2lsdmVyIDMwJSwjZmZmIDMxJSwjZmZmIDM1JSxzaWx2ZXIgMzYlLHNpbHZlciA0NSUsI2ZmZiA0NiUsI2ZmZiA0OSUsdHJhbnNwYXJlbnQgNTAlLHRyYW5zcGFyZW50KTtiYWNrZ3JvdW5kLXNpemU6MTAwcHggNTBweH0uY3ViZXN7YmFja2dyb3VuZC1jb2xvcjojNTU2O2JhY2tncm91bmQtaW1hZ2U6bGluZWFyLWdyYWRpZW50KDMwZGVnLCM0NDUgMTIlLHRyYW5zcGFyZW50IDEyLjUlLHRyYW5zcGFyZW50IDg3JSwjNDQ1IDg3LjUlLCM0NDUpLGxpbmVhci1ncmFkaWVudCgxNTBkZWcsIzQ0NSAxMiUsdHJhbnNwYXJlbnQgMTIuNSUsdHJhbnNwYXJlbnQgODclLCM0NDUgODcuNSUsIzQ0NSksbGluZWFyLWdyYWRpZW50KDMwZGVnLCM0NDUgMTIlLHRyYW5zcGFyZW50IDEyLjUlLHRyYW5zcGFyZW50IDg3JSwjNDQ1IDg3LjUlLCM0NDUpLGxpbmVhci1ncmFkaWVudCgxNTBkZWcsIzQ0NSAxMiUsdHJhbnNwYXJlbnQgMTIuNSUsdHJhbnNwYXJlbnQgODclLCM0NDUgODcuNSUsIzQ0NSksbGluZWFyLWdyYWRpZW50KDYwZGVnLCM5OWEgMjUlLHRyYW5zcGFyZW50IDI1LjUlLHRyYW5zcGFyZW50IDc1JSwjOTlhIDc1JSwjOTlhKSxsaW5lYXItZ3JhZGllbnQoNjBkZWcsIzk5YSAyNSUsdHJhbnNwYXJlbnQgMjUuNSUsdHJhbnNwYXJlbnQgNzUlLCM5OWEgNzUlLCM5OWEpO2JhY2tncm91bmQtc2l6ZTo4MHB4IDE0MHB4O2JhY2tncm91bmQtcG9zaXRpb246MCAwLDAgMCw0MHB4IDcwcHgsNDBweCA3MHB4LDAgMCw0MHB4IDcwcHh9LnBhcGVye2JhY2tncm91bmQtY29sb3I6I2ZmZjtiYWNrZ3JvdW5kLWltYWdlOmxpbmVhci1ncmFkaWVudCg5MGRlZyx0cmFuc3BhcmVudCA3OXB4LCNhYmNlZDQgNzlweCwjYWJjZWQ0IDgxcHgsdHJhbnNwYXJlbnQgODFweCksbGluZWFyLWdyYWRpZW50KCNlZWUgLjFlbSx0cmFuc3BhcmVudCAuMWVtKTtiYWNrZ3JvdW5kLXNpemU6MTAwJSAxLjJlbX0uaG9uZXljb21ie2JhY2tncm91bmQ6cmFkaWFsLWdyYWRpZW50KGNpcmNsZSBmYXJ0aGVzdC1zaWRlIGF0IDAlIDUwJSwjZmIxIDIzLjUlLHJnYmEoMjQwLDE2NiwxNywwKSAwKSAyMXB4IDMwcHgscmFkaWFsLWdyYWRpZW50KGNpcmNsZSBmYXJ0aGVzdC1zaWRlIGF0IDAlIDUwJSwjYjcxIDI0JSxyZ2JhKDI0MCwxNjYsMTcsMCkgMCkgMTlweCAzMHB4LGxpbmVhci1ncmFkaWVudCgjZmIxIDE0JSxyZ2JhKDI0MCwxNjYsMTcsMCkgMCxyZ2JhKDI0MCwxNjYsMTcsMCkgODUlLCNmYjEgMCkgMCAwLGxpbmVhci1ncmFkaWVudCgxNTBkZWcsI2ZiMSAyNCUsI2I3MSAwLCNiNzEgMjYlLHJnYmEoMjQwLDE2NiwxNywwKSAwLHJnYmEoMjQwLDE2NiwxNywwKSA3NCUsI2I3MSAwLCNiNzEgNzYlLCNmYjEgMCkgMCAwLGxpbmVhci1ncmFkaWVudCgzMGRlZywjZmIxIDI0JSwjYjcxIDAsI2I3MSAyNiUscmdiYSgyNDAsMTY2LDE3LDApIDAscmdiYSgyNDAsMTY2LDE3LDApIDc0JSwjYjcxIDAsI2I3MSA3NiUsI2ZiMSAwKSAwIDAsbGluZWFyLWdyYWRpZW50KDkwZGVnLCNiNzEgMiUsI2ZiMSAwLCNmYjEgOTglLCNiNzEgMCUpIDAgMCAjZmIxO2JhY2tncm91bmQtc2l6ZTo0MHB4IDYwcHh9LndhdmV7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoI2ZmZiA1MCUscmdiYSgyNTUsMjU1LDI1NSwwKSAwKSAwIDAscmFkaWFsLWdyYWRpZW50KGNpcmNsZSBjbG9zZXN0LXNpZGUsI2ZmZiA1MyUscmdiYSgyNTUsMjU1LDI1NSwwKSAwKSAwIDAscmFkaWFsLWdyYWRpZW50KGNpcmNsZSBjbG9zZXN0LXNpZGUsI2ZmZiA1MCUscmdiYSgyNTUsMjU1LDI1NSwwKSAwKSA1NXB4IDAgIzQ4YjtiYWNrZ3JvdW5kLXNpemU6MTEwcHggMjAwcHg7YmFja2dyb3VuZC1yZXBlYXQ6cmVwZWF0LXh9LmJsdWVwcmludHtiYWNrZ3JvdW5kLWNvbG9yOiMyNjk7YmFja2dyb3VuZC1pbWFnZTpsaW5lYXItZ3JhZGllbnQoI2ZmZiAycHgsdHJhbnNwYXJlbnQgMnB4KSxsaW5lYXItZ3JhZGllbnQoOTBkZWcsI2ZmZiAycHgsdHJhbnNwYXJlbnQgMnB4KSxsaW5lYXItZ3JhZGllbnQocmdiYSgyNTUsMjU1LDI1NSwuMykgMXB4LHRyYW5zcGFyZW50IDFweCksbGluZWFyLWdyYWRpZW50KDkwZGVnLHJnYmEoMjU1LDI1NSwyNTUsLjMpIDFweCx0cmFuc3BhcmVudCAxcHgpO2JhY2tncm91bmQtc2l6ZToxMDBweCAxMDBweCwxMDBweCAxMDBweCwyMHB4IDIwcHgsMjBweCAyMHB4O2JhY2tncm91bmQtcG9zaXRpb246LTJweCAtMnB4LC0ycHggLTJweCwtMXB4IC0xcHgsLTFweCAtMXB4fS5zaGlwcG97YmFja2dyb3VuZC1jb2xvcjojZGVmO2JhY2tncm91bmQtaW1hZ2U6cmFkaWFsLWdyYWRpZW50KGNsb3Nlc3Qtc2lkZSx0cmFuc3BhcmVudCA5OCUscmdiYSgwLDAsMCwuMykgOTklKSxyYWRpYWwtZ3JhZGllbnQoY2xvc2VzdC1zaWRlLHRyYW5zcGFyZW50IDk4JSxyZ2JhKDAsMCwwLC4zKSA5OSUpO2JhY2tncm91bmQtc2l6ZTo4MHB4IDgwcHg7YmFja2dyb3VuZC1wb3NpdGlvbjowIDAsNDBweCA0MHB4fS5ibGFja3RocmVhZHtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvYmxhY2stdGhyZWFkLWxpZ2h0LnBuZyl9LmJyaWNrd2FsbGRhcmt7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL2JyaWNrLXdhbGwtZGFyay5wbmcpfS5icmlja3dhbGx7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL2JyaWNrLXdhbGwucG5nKX0uZGlhZ21vbmRze2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy9kaWFnbW9uZHMtbGlnaHQucG5nKX0uZGlhbW9uZHVwaG9sc3Rlcnl7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL2RpYW1vbmQtdXBob2xzdGVyeS5wbmcpfS5ncGxheXtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvZ3BsYXkucG5nKX0uZ3JhdmVse2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy9ncmF2ZWwucG5nKX0ub2xkbWF0aHtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvb2xkLW1hdGhlbWF0aWNzLnBuZyl9LnB1cnR5d29vZHtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvcHVydHktd29vZC5wbmcpfS5idWxsc2V5ZXN7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL3N0cmFuZ2UtYnVsbHNleWVzLnBuZyl9LmVzY2hlcmVzcXVle2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy9lc2NoZXJlc3F1ZS5wbmcpfS5zdHJhd3N7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL3N0cmF3cy5wbmcpfS5saXR0bGVib3hlc3tiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvbGl0dGxlYm94ZXMucG5nKX0ud29vZHRpbGVjb2xvcntiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvdGlsZWFibGUtd29vZC1jb2xvcmVkLnBuZyl9Lndvb2R0aWxle2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy90aWxlYWJsZS13b29kLnBuZyl9LnRyZWViYXJre2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy90cmVlLWJhcmsucG5nKX0ud2FzaGl7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL3dhc2hpLnBuZyl9Lndvb2QtcGF0dGVybntiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvd29vZC1wYXR0ZXJuLnBuZyl9Lnh2e2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy94di5wbmcpfXNlY3Rpb24+aW1ne3Bvc2l0aW9uOmFic29sdXRlO21hcmdpbjphdXRvO2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4fS5mdWxsc2NyZWVue3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MH0uZmlsbCwuZnVsbHNjcmVlbnt3aWR0aDoxMDAlO2hlaWdodDoxMDAlfS5maWxsaHtoZWlnaHQ6MTAwJTtsZWZ0Oi01MCU7cmlnaHQ6LTUwJTtwb3NpdGlvbjphYnNvbHV0ZTttYXJnaW46YXV0b30uZmlsbHcsLmZpbGx3Ynt3aWR0aDoxMDAlO2hlaWdodDphdXRvfS5maWxsd2J7Ym90dG9tOjB9c2VjdGlvbiB4LWdpZntwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjB9LmJveHtwb3NpdGlvbjpyZWxhdGl2ZTt0ZXh0LWFsaWduOmNlbnRlcjttYXJnaW46YXV0bzttYXgtd2lkdGg6MTAwJTtib3JkZXItcmFkaXVzOjEwcHg7cGFkZGluZzoyNXB4O2JhY2tncm91bmQtY29sb3I6cmdiYSgwLDAsMCwuNil9LmJveCBvbCwuYm94IHVse21hcmdpbjoxMnB4IDIwcHg7cGFkZGluZzowfS5ib3ggbGk6OmJlZm9yZXtsZWZ0Oi41ZW19LmJveC53YWl0LWZvci1naWZ7b3BhY2l0eTowfS5ib3guYm90dG9te2JvdHRvbTo1JTttYXJnaW4tYm90dG9tOjB9LmJveC50b3B7dG9wOjUlO21hcmdpbi10b3A6MH0uYm94LmxlZnR7bGVmdDo1JTttYXJnaW4tbGVmdDowfS5ib3gucmlnaHR7cmlnaHQ6NSU7bWFyZ2luLXJpZ2h0OjB9LmJveC50cmFuc3BhcmVudCBwcmUsc3Bhbi5hbmltYXRle2Rpc3BsYXk6aW5saW5lLWJsb2NrfS5jcmVkaXR7cG9zaXRpb246YWJzb2x1dGU7Ym90dG9tOjEwcHg7cmlnaHQ6MTBweH1he2NvbG9yOiM5Y2Y7dGV4dC1kZWNvcmF0aW9uOm5vbmV9YS5iYWNrOmFmdGVyLGEuYmFjazpiZWZvcmUsYTphZnRlcntjb250ZW50OicgIOKerSc7Zm9udC1zaXplOjI0cHg7bGluZS1oZWlnaHQ6MjRweDt2ZXJ0aWNhbC1hbGlnbjptaWRkbGV9YS5iYWNrOmFmdGVyLGEuYmFjazpiZWZvcmV7Y29udGVudDon4qyFICAnfWEuYmFjazphZnRlcntjb250ZW50OicnfS5tZSwucGVyc29ue2hlaWdodDo3MnB4O3dpZHRoOjcycHg7YmFja2dyb3VuZC1yZXBlYXQ6bm8tcmVwZWF0O2JhY2tncm91bmQtc2l6ZTo3MnB4O2JhY2tncm91bmQtcG9zaXRpb246NTAlIDUwJTtib3JkZXItcmFkaXVzOjUwJTtib3gtc2hhZG93OjAgMCAwIDJweCAjMDAwLDAgMCAwIDRweCAjOWNmO21hcmdpbjowIDE2cHh9Lm1lLmNlbnRlciwucGVyc29uLmNlbnRlcnttYXJnaW46MTVweCBhdXRvfS5tZXtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvbWUuanBnKX0uZW17Zm9udC13ZWlnaHQ6MzAwfS5lbSwuZW0tYmx1ZSwuZW0tYm9sZCwuZW0tZ3JlZW4sLmVtLW9yYW5nZSwuZW0tcmVkLC5lbS15ZWxsb3d7cGFkZGluZzo1cHggMTBweDttYXJnaW46NXB4IDJweDtib3JkZXI6MXB4IHNvbGlkIHRyYW5zcGFyZW50O2JvcmRlci1yYWRpdXM6NHB4O3RleHQtc2hhZG93Om5vbmU7ZGlzcGxheTppbmxpbmUtYmxvY2s7bGluZS1oZWlnaHQ6MS4yZW07Zm9udC1mYW1pbHk6bW9ub3NwYWNlO2ZvbnQtc3R5bGU6bm9ybWFsfS5lbS1ibHVlLC5lbS1ncmVlbiwuZW0tb3JhbmdlLC5lbS1yZWQsLmVtLXllbGxvd3tmb250LXdlaWdodDozMDB9LmVtLWJvbGR7Zm9udC13ZWlnaHQ6NzAwfS5lbS1ncmVlbntjb2xvcjojNDY4ODQ3O2JhY2tncm91bmQtY29sb3I6I2RmZjBkODtib3JkZXItY29sb3I6I2Q2ZTljNn0uZW0teWVsbG93e2NvbG9yOiM4YTZkM2I7YmFja2dyb3VuZC1jb2xvcjojZmNmOGUzO2JvcmRlci1jb2xvcjojZmFlYmNjfS5lbS1ibHVle2NvbG9yOiMzYTg3YWQ7YmFja2dyb3VuZC1jb2xvcjojZDllZGY3O2JvcmRlci1jb2xvcjojYmNlOGYxfS5lbS1vcmFuZ2V7Y29sb3I6I2Y4NTtiYWNrZ3JvdW5kLWNvbG9yOiNmY2Y4ZTM7Ym9yZGVyLWNvbG9yOiNmYmVlZDV9LmVtLXJlZHtjb2xvcjojYjk0YTQ4O2JhY2tncm91bmQtY29sb3I6I2YyZGVkZTtib3JkZXItY29sb3I6I2VlZDNkN30ubWlke2ZvbnQtc2l6ZToyOHB4O2ZvbnQtc3R5bGU6aXRhbGljO2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4O3dpZHRoOjEwMCU7bWFyZ2luOjEwcHggYXV0bzstbXMtZmxleC1hbGlnbjpjZW50ZXI7YWxpZ24taXRlbXM6Y2VudGVyfS5taWQ6OmFmdGVyLC5taWQ6OmJlZm9yZXtjb250ZW50OicnOy1tcy1mbGV4LXBvc2l0aXZlOjE7ZmxleC1ncm93OjE7ZGlzcGxheTpibG9jaztib3JkZXItdG9wOmRvdHRlZCAxcHggcmdiYSgyNTUsMjU1LDI1NSwuMyl9Lm1pZDo6YmVmb3Jle21hcmdpbi1yaWdodDoxNnB4fS5taWQ6OmFmdGVye21hcmdpbi1sZWZ0OjE2cHh9Lm1pZC5iaWd7Zm9udC1zaXplOjc0cHh9LmhpZGV7ZGlzcGxheTpub25lfS5ibHVyMXtmaWx0ZXI6Ymx1cigxcHgpfS5ibHVyMntmaWx0ZXI6Ymx1cigycHgpfS5ibHVyMywuYmx1cjR7ZmlsdGVyOmJsdXIoM3B4KX0ub3BhYzIwe29wYWNpdHk6LjJ9Lm9wYWM1MHtvcGFjaXR5Oi41fS5vcGFjODB7b3BhY2l0eTouOH0udHJhbnNwYXJlbnR7YmFja2dyb3VuZC1jb2xvcjpyZ2JhKDAsMCwwLDApfS53aGl0ZXtiYWNrZ3JvdW5kLWNvbG9yOiNmZmZ9LndoaXRlLmJveHtjb2xvcjojMzMzO3RleHQtc2hhZG93Om5vbmV9LnJlZHtiYWNrZ3JvdW5kLWNvbG9yOiNiOTRhNDh9LmJsYWNre2JhY2tncm91bmQtY29sb3I6IzAwMH0uZ3JleXtiYWNrZ3JvdW5kLWNvbG9yOiNjZmNmY2Z9LmdyZXkuYm94e2NvbG9yOiMzMzN9LmJsdWV7YmFja2dyb3VuZC1jb2xvcjojMDA0ZThhfS5taWRuaWdodHtiYWNrZ3JvdW5kLWNvbG9yOiMwMDFmM2Z9LmplbGx5YmVhbntiYWNrZ3JvdW5kLWNvbG9yOiMyODg4OTV9LmNvY29he2JhY2tncm91bmQtY29sb3I6IzQ3MmYwMH0ubm9wZXt0ZXh0LWRlY29yYXRpb246bGluZS10aHJvdWdoO29wYWNpdHk6Ljd9cC5jb2Rle21hcmdpbjowO2ZvbnQtZmFtaWx5OnByZXN0aWdlIGVsaXRlIHN0ZCxjb25zb2xhcyxjb3VyaWVyIG5ldyxtb25vc3BhY2V9c3RyaWtlIGNvZGVbY2xhc3MqPWxhbmd1YWdlLV17dGV4dC1zaGFkb3c6MCAxcHggIzAwZn0ucm90YXRlLC5zcGlue2Rpc3BsYXk6aW5saW5lLWJsb2NrO3RyYW5zZm9ybTpub25lfS5yb3RhdGUub24sLnNwaW4ub257dHJhbnNpdGlvbi1kZWxheTouNXM7dHJhbnNpdGlvbi1kdXJhdGlvbjoxczt0cmFuc2Zvcm06cm90YXRlKDE1ZGVnKX0uc3Bpbi5vbnt0cmFuc2l0aW9uLWRlbGF5OjEuNXM7dHJhbnNmb3JtOnJvdGF0ZSgzNjBkZWcpfS5hbmltYXRlLmRlbGF5MXthbmltYXRpb24tZGVsYXk6MXN9LmFuaW1hdGUuZGVsYXkye2FuaW1hdGlvbi1kZWxheToyc30uYW5pbWF0ZS5kZWxheTN7YW5pbWF0aW9uLWRlbGF5OjNzfS5hbmltYXRlLmRlbGF5NHthbmltYXRpb24tZGVsYXk6NHN9LmFuaW1hdGUuZGVsYXk1e2FuaW1hdGlvbi1kZWxheTo1c30uYW5pbWF0ZS5kZWxheTZ7YW5pbWF0aW9uLWRlbGF5OjZzfS5hbmltYXRlLmRlbGF5N3thbmltYXRpb24tZGVsYXk6N3N9LmFuaW1hdGUuZGVsYXk4e2FuaW1hdGlvbi1kZWxheTo4c30uY3Vyc29yOmFmdGVye2NvbnRlbnQ6XFxcIl9cXFwiO29wYWNpdHk6MDthbmltYXRpb246Y3Vyc29yIDFzIGluZmluaXRlfUBrZXlmcmFtZXMgY3Vyc29yezAlLDQwJSx0b3tvcGFjaXR5OjB9NTAlLDkwJXtvcGFjaXR5OjF9fVwiO3JldHVybiBvKHQse3ByZXBlbmQ6ITB9KSxmdW5jdGlvbih0KXtuKCkodCkscyh0KSxyKHQpfX0sd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIixmdW5jdGlvbigpe1tdLmZvckVhY2guY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwieC1naWZcIiksZnVuY3Rpb24odCl7dC5yZWxheW91dCgpfSl9KSxcInJlZ2lzdGVyRWxlbWVudFwiaW4gZG9jdW1lbnQmJlwiY3JlYXRlU2hhZG93Um9vdFwiaW4gSFRNTEVsZW1lbnQucHJvdG90eXBlJiZcImltcG9ydFwiaW4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpbmtcIikmJlwiY29udGVudFwiaW4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIpKTtlbHNle3ZhciBtPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7bS5zcmM9XCJodHRwczovL2NkbmpzLmNsb3VkZmxhcmUuY29tL2FqYXgvbGlicy93ZWJjb21wb25lbnRzanMvMC43LjIyL3dlYmNvbXBvbmVudHMubWluLmpzXCIsZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChtKTt2YXIgZj1kb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImJyb3dzZXJzdXBwb3J0XCIpO2YmJihmLmNsYXNzTmFtZT1mLmNsYXNzTmFtZS5yZXBsYWNlKFwiaGlkZVwiLFwiXCIpKX12YXIgcD0wO2RvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLGZ1bmN0aW9uKHQpe1xyXG52YXIgZT1mdW5jdGlvbigpe2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJhcnRpY2xlXCIpLnN0eWxlLndlYmtpdEZpbHRlcj1cImJyaWdodG5lc3MoXCIrKDErcCkrXCIpIGNvbnRyYXN0KFwiKygxKy4yNSpwKStcIilcIn07aWYodC5zaGlmdEtleSYmKDM4PT10LmtleUNvZGU/KHArPS4xLGUocCkpOjQwPT10LmtleUNvZGU/KHAtPS4xLGUocCkpOjQ4PT10LmtleUNvZGUmJihwPTAsZShwKSkpLGNvbnNvbGUubG9nKHQua2V5Q29kZSksODI9PXQua2V5Q29kZSl7dmFyIGE9ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5yb3RhdGUsIC5zcGluXCIpO2ZvcihpPTA7aTxhLmxlbmd0aDtpKyspYVtpXS5jbGFzc0xpc3QudG9nZ2xlKFwib25cIil9fSk7dmFyIGw9ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5hbmltYXRlXCIpLGQ9ZnVuY3Rpb24odCl7dC50YXJnZXQuY2xhc3NMaXN0LnJlbW92ZShcImFuaW1hdGVkXCIpfTtBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKGwsZnVuY3Rpb24odCxlKXt0LmFkZEV2ZW50TGlzdGVuZXIoXCJ3ZWJraXRBbmltYXRpb25FbmRcIixkKSx0LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3pBbmltYXRpb25FbmRcIixkKSx0LmFkZEV2ZW50TGlzdGVuZXIoXCJNU0FuaW1hdGlvbkVuZFwiLGQpLHQuYWRkRXZlbnRMaXN0ZW5lcihcIm9hbmltYXRpb25lbmRcIixkKSx0LmFkZEV2ZW50TGlzdGVuZXIoXCJhbmltYXRpb25lbmRcIixkKX0pO3ZhciBjPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaW5rXCIpO2MucmVsPVwiaW1wb3J0XCIsYy5ocmVmPVwieC1naWYveC1naWYuaHRtbFwiLGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYyk7dmFyIGc9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpbmtcIik7Zy5yZWw9XCJzdHlsZXNoZWV0XCIsZy50eXBlPVwidGV4dC9jc3NcIixnLmhyZWY9XCJodHRwOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzP2ZhbWlseT1Db3VyZ2V0dGV8RHJvaWQrU2Fuc1wiLGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZyl9LHtcImJlc3Bva2UtY2xhc3Nlc1wiOjIsXCJpbnNlcnQtY3NzXCI6M31dLDI6W2Z1bmN0aW9uKHQsZSxhKXtlLmV4cG9ydHM9ZnVuY3Rpb24oKXtyZXR1cm4gZnVuY3Rpb24odCl7dmFyIGU9ZnVuY3Rpb24odCxlKXt0LmNsYXNzTGlzdC5hZGQoXCJiZXNwb2tlLVwiK2UpfSxhPWZ1bmN0aW9uKHQsZSl7dC5jbGFzc05hbWU9dC5jbGFzc05hbWUucmVwbGFjZShuZXcgUmVnRXhwKFwiYmVzcG9rZS1cIitlK1wiKFxcXFxzfCQpXCIsXCJnXCIpLFwiIFwiKS50cmltKCl9LG49ZnVuY3Rpb24obixvKXt2YXIgcj10LnNsaWRlc1t0LnNsaWRlKCldLGk9by10LnNsaWRlKCkscz1pPjA/XCJhZnRlclwiOlwiYmVmb3JlXCI7W1wiYmVmb3JlKC1cXFxcZCspP1wiLFwiYWZ0ZXIoLVxcXFxkKyk/XCIsXCJhY3RpdmVcIixcImluYWN0aXZlXCJdLm1hcChhLmJpbmQobnVsbCxuKSksbiE9PXImJltcImluYWN0aXZlXCIscyxzK1wiLVwiK01hdGguYWJzKGkpXS5tYXAoZS5iaW5kKG51bGwsbikpfTtlKHQucGFyZW50LFwicGFyZW50XCIpLHQuc2xpZGVzLm1hcChmdW5jdGlvbih0KXtlKHQsXCJzbGlkZVwiKX0pLHQub24oXCJhY3RpdmF0ZVwiLGZ1bmN0aW9uKG8pe3Quc2xpZGVzLm1hcChuKSxlKG8uc2xpZGUsXCJhY3RpdmVcIiksYShvLnNsaWRlLFwiaW5hY3RpdmVcIil9KX19fSx7fV0sMzpbZnVuY3Rpb24odCxlLGEpe2Z1bmN0aW9uIG4oKXt2YXIgdD1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7cmV0dXJuIHQuc2V0QXR0cmlidXRlKFwidHlwZVwiLFwidGV4dC9jc3NcIiksdH12YXIgbz1bXSxyPVtdO2UuZXhwb3J0cz1mdW5jdGlvbih0LGUpe2U9ZXx8e307dmFyIGE9ZS5wcmVwZW5kPT09ITA/XCJwcmVwZW5kXCI6XCJhcHBlbmRcIixpPXZvaWQgMCE9PWUuY29udGFpbmVyP2UuY29udGFpbmVyOmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJoZWFkXCIpLHM9by5pbmRleE9mKGkpO3M9PT0tMSYmKHM9by5wdXNoKGkpLTEscltzXT17fSk7dmFyIG07cmV0dXJuIHZvaWQgMCE9PXJbc10mJnZvaWQgMCE9PXJbc11bYV0/bT1yW3NdW2FdOihtPXJbc11bYV09bigpLFwicHJlcGVuZFwiPT09YT9pLmluc2VydEJlZm9yZShtLGkuY2hpbGROb2Rlc1swXSk6aS5hcHBlbmRDaGlsZChtKSksbS5zdHlsZVNoZWV0P20uc3R5bGVTaGVldC5jc3NUZXh0Kz10Om0udGV4dENvbnRlbnQrPXQsbX19LHt9XX0se30sWzFdKSgxKX0pO1xufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcbiAgICB2YXIgYXhpcyA9IG9wdGlvbnMgPT0gJ3ZlcnRpY2FsJyA/ICdZJyA6ICdYJyxcbiAgICAgIHN0YXJ0UG9zaXRpb24sXG4gICAgICBkZWx0YTtcblxuICAgIGRlY2sucGFyZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBmdW5jdGlvbihlKSB7XG4gICAgICBpZiAoZS50b3VjaGVzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIHN0YXJ0UG9zaXRpb24gPSBlLnRvdWNoZXNbMF1bJ3BhZ2UnICsgYXhpc107XG4gICAgICAgIGRlbHRhID0gMDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGRlY2sucGFyZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGlmIChlLnRvdWNoZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBkZWx0YSA9IGUudG91Y2hlc1swXVsncGFnZScgKyBheGlzXSAtIHN0YXJ0UG9zaXRpb247XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBkZWNrLnBhcmVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKE1hdGguYWJzKGRlbHRhKSA+IDUwKSB7XG4gICAgICAgIGRlY2tbZGVsdGEgPiAwID8gJ3ByZXYnIDogJ25leHQnXSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xufTtcbiIsInZhciBmcm9tID0gZnVuY3Rpb24ob3B0cywgcGx1Z2lucykge1xuICB2YXIgcGFyZW50ID0gKG9wdHMucGFyZW50IHx8IG9wdHMpLm5vZGVUeXBlID09PSAxID8gKG9wdHMucGFyZW50IHx8IG9wdHMpIDogZG9jdW1lbnQucXVlcnlTZWxlY3RvcihvcHRzLnBhcmVudCB8fCBvcHRzKSxcbiAgICBzbGlkZXMgPSBbXS5maWx0ZXIuY2FsbCh0eXBlb2Ygb3B0cy5zbGlkZXMgPT09ICdzdHJpbmcnID8gcGFyZW50LnF1ZXJ5U2VsZWN0b3JBbGwob3B0cy5zbGlkZXMpIDogKG9wdHMuc2xpZGVzIHx8IHBhcmVudC5jaGlsZHJlbiksIGZ1bmN0aW9uKGVsKSB7IHJldHVybiBlbC5ub2RlTmFtZSAhPT0gJ1NDUklQVCc7IH0pLFxuICAgIGFjdGl2ZVNsaWRlID0gc2xpZGVzWzBdLFxuICAgIGxpc3RlbmVycyA9IHt9LFxuXG4gICAgYWN0aXZhdGUgPSBmdW5jdGlvbihpbmRleCwgY3VzdG9tRGF0YSkge1xuICAgICAgaWYgKCFzbGlkZXNbaW5kZXhdKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgZmlyZSgnZGVhY3RpdmF0ZScsIGNyZWF0ZUV2ZW50RGF0YShhY3RpdmVTbGlkZSwgY3VzdG9tRGF0YSkpO1xuICAgICAgYWN0aXZlU2xpZGUgPSBzbGlkZXNbaW5kZXhdO1xuICAgICAgZmlyZSgnYWN0aXZhdGUnLCBjcmVhdGVFdmVudERhdGEoYWN0aXZlU2xpZGUsIGN1c3RvbURhdGEpKTtcbiAgICB9LFxuXG4gICAgc2xpZGUgPSBmdW5jdGlvbihpbmRleCwgY3VzdG9tRGF0YSkge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgZmlyZSgnc2xpZGUnLCBjcmVhdGVFdmVudERhdGEoc2xpZGVzW2luZGV4XSwgY3VzdG9tRGF0YSkpICYmIGFjdGl2YXRlKGluZGV4LCBjdXN0b21EYXRhKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBzbGlkZXMuaW5kZXhPZihhY3RpdmVTbGlkZSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIHN0ZXAgPSBmdW5jdGlvbihvZmZzZXQsIGN1c3RvbURhdGEpIHtcbiAgICAgIHZhciBzbGlkZUluZGV4ID0gc2xpZGVzLmluZGV4T2YoYWN0aXZlU2xpZGUpICsgb2Zmc2V0O1xuXG4gICAgICBmaXJlKG9mZnNldCA+IDAgPyAnbmV4dCcgOiAncHJldicsIGNyZWF0ZUV2ZW50RGF0YShhY3RpdmVTbGlkZSwgY3VzdG9tRGF0YSkpICYmIGFjdGl2YXRlKHNsaWRlSW5kZXgsIGN1c3RvbURhdGEpO1xuICAgIH0sXG5cbiAgICBvbiA9IGZ1bmN0aW9uKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIChsaXN0ZW5lcnNbZXZlbnROYW1lXSB8fCAobGlzdGVuZXJzW2V2ZW50TmFtZV0gPSBbXSkpLnB1c2goY2FsbGJhY2spO1xuICAgICAgcmV0dXJuIG9mZi5iaW5kKG51bGwsIGV2ZW50TmFtZSwgY2FsbGJhY2spO1xuICAgIH0sXG5cbiAgICBvZmYgPSBmdW5jdGlvbihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXSA9IChsaXN0ZW5lcnNbZXZlbnROYW1lXSB8fCBbXSkuZmlsdGVyKGZ1bmN0aW9uKGxpc3RlbmVyKSB7IHJldHVybiBsaXN0ZW5lciAhPT0gY2FsbGJhY2s7IH0pO1xuICAgIH0sXG5cbiAgICBmaXJlID0gZnVuY3Rpb24oZXZlbnROYW1lLCBldmVudERhdGEpIHtcbiAgICAgIHJldHVybiAobGlzdGVuZXJzW2V2ZW50TmFtZV0gfHwgW10pXG4gICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24obm90Q2FuY2VsbGVkLCBjYWxsYmFjaykge1xuICAgICAgICAgIHJldHVybiBub3RDYW5jZWxsZWQgJiYgY2FsbGJhY2soZXZlbnREYXRhKSAhPT0gZmFsc2U7XG4gICAgICAgIH0sIHRydWUpO1xuICAgIH0sXG5cbiAgICBjcmVhdGVFdmVudERhdGEgPSBmdW5jdGlvbihlbCwgZXZlbnREYXRhKSB7XG4gICAgICBldmVudERhdGEgPSBldmVudERhdGEgfHwge307XG4gICAgICBldmVudERhdGEuaW5kZXggPSBzbGlkZXMuaW5kZXhPZihlbCk7XG4gICAgICBldmVudERhdGEuc2xpZGUgPSBlbDtcbiAgICAgIHJldHVybiBldmVudERhdGE7XG4gICAgfSxcblxuICAgIGRlY2sgPSB7XG4gICAgICBvbjogb24sXG4gICAgICBvZmY6IG9mZixcbiAgICAgIGZpcmU6IGZpcmUsXG4gICAgICBzbGlkZTogc2xpZGUsXG4gICAgICBuZXh0OiBzdGVwLmJpbmQobnVsbCwgMSksXG4gICAgICBwcmV2OiBzdGVwLmJpbmQobnVsbCwgLTEpLFxuICAgICAgcGFyZW50OiBwYXJlbnQsXG4gICAgICBzbGlkZXM6IHNsaWRlc1xuICAgIH07XG5cbiAgKHBsdWdpbnMgfHwgW10pLmZvckVhY2goZnVuY3Rpb24ocGx1Z2luKSB7XG4gICAgcGx1Z2luKGRlY2spO1xuICB9KTtcblxuICBhY3RpdmF0ZSgwKTtcblxuICByZXR1cm4gZGVjaztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBmcm9tOiBmcm9tXG59O1xuIiwiLy8gUmVxdWlyZSBOb2RlIG1vZHVsZXMgaW4gdGhlIGJyb3dzZXIgdGhhbmtzIHRvIEJyb3dzZXJpZnk6IGh0dHA6Ly9icm93c2VyaWZ5Lm9yZ1xyXG52YXIgYmVzcG9rZSA9IHJlcXVpcmUoJ2Jlc3Bva2UnKSxcclxuICBcclxuICBjdWJlID0gcmVxdWlyZSgnYmVzcG9rZS10aGVtZS1jdWJlJyksXHJcbiAga2V5cyA9IHJlcXVpcmUoJ2Jlc3Bva2Uta2V5cycpLFxyXG4gIHRvdWNoID0gcmVxdWlyZSgnYmVzcG9rZS10b3VjaCcpLFxyXG4gIGJ1bGxldHMgPSByZXF1aXJlKCdiZXNwb2tlLWJ1bGxldHMnKSxcclxuICBiYWNrZHJvcCA9IHJlcXVpcmUoJ2Jlc3Bva2UtYmFja2Ryb3AnKSxcclxuICBzY2FsZSA9IHJlcXVpcmUoJ2Jlc3Bva2Utc2NhbGUnKSxcclxuICBoYXNoID0gcmVxdWlyZSgnYmVzcG9rZS1oYXNoJyksXHJcbiAgcHJvZ3Jlc3MgPSByZXF1aXJlKCdiZXNwb2tlLXByb2dyZXNzJyksXHJcbiAgZm9ybXMgPSByZXF1aXJlKCdiZXNwb2tlLWZvcm1zJyk7XHJcblxyXG4vLyBCZXNwb2tlLmpzXHJcbmJlc3Bva2UuZnJvbSgnYXJ0aWNsZScsIFtcclxuICBjdWJlKCksXHJcbiAga2V5cygpLFxyXG4gIHRvdWNoKCksXHJcbiAgYnVsbGV0cygnbGksIC5idWxsZXQnKSxcclxuICBiYWNrZHJvcCgpLFxyXG4gIHNjYWxlKCksXHJcbiAgaGFzaCgpLFxyXG4gIHByb2dyZXNzKCksXHJcbiAgZm9ybXMoKVxyXG5dKTtcclxuXHJcbi8vIFByaXNtIHN5bnRheCBoaWdobGlnaHRpbmdcclxuLy8gVGhpcyBpcyBhY3R1YWxseSBsb2FkZWQgZnJvbSBcImJvd2VyX2NvbXBvbmVudHNcIiB0aGFua3MgdG9cclxuLy8gZGVib3dlcmlmeTogaHR0cHM6Ly9naXRodWIuY29tL2V1Z2VuZXdhcmUvZGVib3dlcmlmeVxyXG5yZXF1aXJlKFwiLi8uLlxcXFwuLlxcXFxib3dlcl9jb21wb25lbnRzXFxcXHByaXNtXFxcXHByaXNtLmpzXCIpO1xyXG5cclxuIl19
