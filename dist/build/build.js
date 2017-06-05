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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIlg6XFxWaXJ0dWFsLVJlYWxpdHktMjAxN1xcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiWDovVmlydHVhbC1SZWFsaXR5LTIwMTcvYm93ZXJfY29tcG9uZW50cy9wcmlzbS9wcmlzbS5qcyIsIlg6L1ZpcnR1YWwtUmVhbGl0eS0yMDE3L25vZGVfbW9kdWxlcy9iZXNwb2tlLWJhY2tkcm9wL2xpYi9iZXNwb2tlLWJhY2tkcm9wLmpzIiwiWDovVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtYnVsbGV0cy9saWIvYmVzcG9rZS1idWxsZXRzLmpzIiwiWDovVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtZm9ybXMvbGliL2Jlc3Bva2UtZm9ybXMuanMiLCJYOi9WaXJ0dWFsLVJlYWxpdHktMjAxNy9ub2RlX21vZHVsZXMvYmVzcG9rZS1oYXNoL2xpYi9iZXNwb2tlLWhhc2guanMiLCJYOi9WaXJ0dWFsLVJlYWxpdHktMjAxNy9ub2RlX21vZHVsZXMvYmVzcG9rZS1rZXlzL2xpYi9iZXNwb2tlLWtleXMuanMiLCJYOi9WaXJ0dWFsLVJlYWxpdHktMjAxNy9ub2RlX21vZHVsZXMvYmVzcG9rZS1wcm9ncmVzcy9saWIvYmVzcG9rZS1wcm9ncmVzcy5qcyIsIlg6L1ZpcnR1YWwtUmVhbGl0eS0yMDE3L25vZGVfbW9kdWxlcy9iZXNwb2tlLXNjYWxlL2xpYi9iZXNwb2tlLXNjYWxlLmpzIiwiWDovVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2UtdGhlbWUtY3ViZS9kaXN0L2Jlc3Bva2UtdGhlbWUtYXRvbWFudGljLm1pbi5qcyIsIlg6L1ZpcnR1YWwtUmVhbGl0eS0yMDE3L25vZGVfbW9kdWxlcy9iZXNwb2tlLXRvdWNoL2xpYi9iZXNwb2tlLXRvdWNoLmpzIiwiWDovVmlydHVhbC1SZWFsaXR5LTIwMTcvbm9kZV9tb2R1bGVzL2Jlc3Bva2UvbGliL2Jlc3Bva2UuanMiLCJYOi9WaXJ0dWFsLVJlYWxpdHktMjAxNy9zcmMvc2NyaXB0cy9mYWtlX2JkNWZlY2IuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3B6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcblxyXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgQmVnaW4gcHJpc20tY29yZS5qc1xyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcblxyXG52YXIgX3NlbGYgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpXHJcblx0PyB3aW5kb3cgICAvLyBpZiBpbiBicm93c2VyXHJcblx0OiAoXHJcblx0XHQodHlwZW9mIFdvcmtlckdsb2JhbFNjb3BlICE9PSAndW5kZWZpbmVkJyAmJiBzZWxmIGluc3RhbmNlb2YgV29ya2VyR2xvYmFsU2NvcGUpXHJcblx0XHQ/IHNlbGYgLy8gaWYgaW4gd29ya2VyXHJcblx0XHQ6IHt9ICAgLy8gaWYgaW4gbm9kZSBqc1xyXG5cdCk7XHJcblxyXG4vKipcclxuICogUHJpc206IExpZ2h0d2VpZ2h0LCByb2J1c3QsIGVsZWdhbnQgc3ludGF4IGhpZ2hsaWdodGluZ1xyXG4gKiBNSVQgbGljZW5zZSBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocC9cclxuICogQGF1dGhvciBMZWEgVmVyb3UgaHR0cDovL2xlYS52ZXJvdS5tZVxyXG4gKi9cclxuXHJcbnZhciBQcmlzbSA9IChmdW5jdGlvbigpe1xyXG5cclxuLy8gUHJpdmF0ZSBoZWxwZXIgdmFyc1xyXG52YXIgbGFuZyA9IC9cXGJsYW5nKD86dWFnZSk/LShcXHcrKVxcYi9pO1xyXG52YXIgdW5pcXVlSWQgPSAwO1xyXG5cclxudmFyIF8gPSBfc2VsZi5QcmlzbSA9IHtcclxuXHRtYW51YWw6IF9zZWxmLlByaXNtICYmIF9zZWxmLlByaXNtLm1hbnVhbCxcclxuXHR1dGlsOiB7XHJcblx0XHRlbmNvZGU6IGZ1bmN0aW9uICh0b2tlbnMpIHtcclxuXHRcdFx0aWYgKHRva2VucyBpbnN0YW5jZW9mIFRva2VuKSB7XHJcblx0XHRcdFx0cmV0dXJuIG5ldyBUb2tlbih0b2tlbnMudHlwZSwgXy51dGlsLmVuY29kZSh0b2tlbnMuY29udGVudCksIHRva2Vucy5hbGlhcyk7XHJcblx0XHRcdH0gZWxzZSBpZiAoXy51dGlsLnR5cGUodG9rZW5zKSA9PT0gJ0FycmF5Jykge1xyXG5cdFx0XHRcdHJldHVybiB0b2tlbnMubWFwKF8udXRpbC5lbmNvZGUpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHJldHVybiB0b2tlbnMucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvXFx1MDBhMC9nLCAnICcpO1xyXG5cdFx0XHR9XHJcblx0XHR9LFxyXG5cclxuXHRcdHR5cGU6IGZ1bmN0aW9uIChvKSB7XHJcblx0XHRcdHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobykubWF0Y2goL1xcW29iamVjdCAoXFx3KylcXF0vKVsxXTtcclxuXHRcdH0sXHJcblxyXG5cdFx0b2JqSWQ6IGZ1bmN0aW9uIChvYmopIHtcclxuXHRcdFx0aWYgKCFvYmpbJ19faWQnXSkge1xyXG5cdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosICdfX2lkJywgeyB2YWx1ZTogKyt1bmlxdWVJZCB9KTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gb2JqWydfX2lkJ107XHJcblx0XHR9LFxyXG5cclxuXHRcdC8vIERlZXAgY2xvbmUgYSBsYW5ndWFnZSBkZWZpbml0aW9uIChlLmcuIHRvIGV4dGVuZCBpdClcclxuXHRcdGNsb25lOiBmdW5jdGlvbiAobykge1xyXG5cdFx0XHR2YXIgdHlwZSA9IF8udXRpbC50eXBlKG8pO1xyXG5cclxuXHRcdFx0c3dpdGNoICh0eXBlKSB7XHJcblx0XHRcdFx0Y2FzZSAnT2JqZWN0JzpcclxuXHRcdFx0XHRcdHZhciBjbG9uZSA9IHt9O1xyXG5cclxuXHRcdFx0XHRcdGZvciAodmFyIGtleSBpbiBvKSB7XHJcblx0XHRcdFx0XHRcdGlmIChvLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRcdFx0XHRjbG9uZVtrZXldID0gXy51dGlsLmNsb25lKG9ba2V5XSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRyZXR1cm4gY2xvbmU7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ0FycmF5JzpcclxuXHRcdFx0XHRcdC8vIENoZWNrIGZvciBleGlzdGVuY2UgZm9yIElFOFxyXG5cdFx0XHRcdFx0cmV0dXJuIG8ubWFwICYmIG8ubWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIF8udXRpbC5jbG9uZSh2KTsgfSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBvO1xyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdGxhbmd1YWdlczoge1xyXG5cdFx0ZXh0ZW5kOiBmdW5jdGlvbiAoaWQsIHJlZGVmKSB7XHJcblx0XHRcdHZhciBsYW5nID0gXy51dGlsLmNsb25lKF8ubGFuZ3VhZ2VzW2lkXSk7XHJcblxyXG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gcmVkZWYpIHtcclxuXHRcdFx0XHRsYW5nW2tleV0gPSByZWRlZltrZXldO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gbGFuZztcclxuXHRcdH0sXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbnNlcnQgYSB0b2tlbiBiZWZvcmUgYW5vdGhlciB0b2tlbiBpbiBhIGxhbmd1YWdlIGxpdGVyYWxcclxuXHRcdCAqIEFzIHRoaXMgbmVlZHMgdG8gcmVjcmVhdGUgdGhlIG9iamVjdCAod2UgY2Fubm90IGFjdHVhbGx5IGluc2VydCBiZWZvcmUga2V5cyBpbiBvYmplY3QgbGl0ZXJhbHMpLFxyXG5cdFx0ICogd2UgY2Fubm90IGp1c3QgcHJvdmlkZSBhbiBvYmplY3QsIHdlIG5lZWQgYW5vYmplY3QgYW5kIGEga2V5LlxyXG5cdFx0ICogQHBhcmFtIGluc2lkZSBUaGUga2V5IChvciBsYW5ndWFnZSBpZCkgb2YgdGhlIHBhcmVudFxyXG5cdFx0ICogQHBhcmFtIGJlZm9yZSBUaGUga2V5IHRvIGluc2VydCBiZWZvcmUuIElmIG5vdCBwcm92aWRlZCwgdGhlIGZ1bmN0aW9uIGFwcGVuZHMgaW5zdGVhZC5cclxuXHRcdCAqIEBwYXJhbSBpbnNlcnQgT2JqZWN0IHdpdGggdGhlIGtleS92YWx1ZSBwYWlycyB0byBpbnNlcnRcclxuXHRcdCAqIEBwYXJhbSByb290IFRoZSBvYmplY3QgdGhhdCBjb250YWlucyBgaW5zaWRlYC4gSWYgZXF1YWwgdG8gUHJpc20ubGFuZ3VhZ2VzLCBpdCBjYW4gYmUgb21pdHRlZC5cclxuXHRcdCAqL1xyXG5cdFx0aW5zZXJ0QmVmb3JlOiBmdW5jdGlvbiAoaW5zaWRlLCBiZWZvcmUsIGluc2VydCwgcm9vdCkge1xyXG5cdFx0XHRyb290ID0gcm9vdCB8fCBfLmxhbmd1YWdlcztcclxuXHRcdFx0dmFyIGdyYW1tYXIgPSByb290W2luc2lkZV07XHJcblxyXG5cdFx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSAyKSB7XHJcblx0XHRcdFx0aW5zZXJ0ID0gYXJndW1lbnRzWzFdO1xyXG5cclxuXHRcdFx0XHRmb3IgKHZhciBuZXdUb2tlbiBpbiBpbnNlcnQpIHtcclxuXHRcdFx0XHRcdGlmIChpbnNlcnQuaGFzT3duUHJvcGVydHkobmV3VG9rZW4pKSB7XHJcblx0XHRcdFx0XHRcdGdyYW1tYXJbbmV3VG9rZW5dID0gaW5zZXJ0W25ld1Rva2VuXTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiBncmFtbWFyO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgcmV0ID0ge307XHJcblxyXG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiBncmFtbWFyKSB7XHJcblxyXG5cdFx0XHRcdGlmIChncmFtbWFyLmhhc093blByb3BlcnR5KHRva2VuKSkge1xyXG5cclxuXHRcdFx0XHRcdGlmICh0b2tlbiA9PSBiZWZvcmUpIHtcclxuXHJcblx0XHRcdFx0XHRcdGZvciAodmFyIG5ld1Rva2VuIGluIGluc2VydCkge1xyXG5cclxuXHRcdFx0XHRcdFx0XHRpZiAoaW5zZXJ0Lmhhc093blByb3BlcnR5KG5ld1Rva2VuKSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0cmV0W25ld1Rva2VuXSA9IGluc2VydFtuZXdUb2tlbl07XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cmV0W3Rva2VuXSA9IGdyYW1tYXJbdG9rZW5dO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gVXBkYXRlIHJlZmVyZW5jZXMgaW4gb3RoZXIgbGFuZ3VhZ2UgZGVmaW5pdGlvbnNcclxuXHRcdFx0Xy5sYW5ndWFnZXMuREZTKF8ubGFuZ3VhZ2VzLCBmdW5jdGlvbihrZXksIHZhbHVlKSB7XHJcblx0XHRcdFx0aWYgKHZhbHVlID09PSByb290W2luc2lkZV0gJiYga2V5ICE9IGluc2lkZSkge1xyXG5cdFx0XHRcdFx0dGhpc1trZXldID0gcmV0O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRyZXR1cm4gcm9vdFtpbnNpZGVdID0gcmV0O1xyXG5cdFx0fSxcclxuXHJcblx0XHQvLyBUcmF2ZXJzZSBhIGxhbmd1YWdlIGRlZmluaXRpb24gd2l0aCBEZXB0aCBGaXJzdCBTZWFyY2hcclxuXHRcdERGUzogZnVuY3Rpb24obywgY2FsbGJhY2ssIHR5cGUsIHZpc2l0ZWQpIHtcclxuXHRcdFx0dmlzaXRlZCA9IHZpc2l0ZWQgfHwge307XHJcblx0XHRcdGZvciAodmFyIGkgaW4gbykge1xyXG5cdFx0XHRcdGlmIChvLmhhc093blByb3BlcnR5KGkpKSB7XHJcblx0XHRcdFx0XHRjYWxsYmFjay5jYWxsKG8sIGksIG9baV0sIHR5cGUgfHwgaSk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKF8udXRpbC50eXBlKG9baV0pID09PSAnT2JqZWN0JyAmJiAhdmlzaXRlZFtfLnV0aWwub2JqSWQob1tpXSldKSB7XHJcblx0XHRcdFx0XHRcdHZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSA9IHRydWU7XHJcblx0XHRcdFx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhvW2ldLCBjYWxsYmFjaywgbnVsbCwgdmlzaXRlZCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRlbHNlIGlmIChfLnV0aWwudHlwZShvW2ldKSA9PT0gJ0FycmF5JyAmJiAhdmlzaXRlZFtfLnV0aWwub2JqSWQob1tpXSldKSB7XHJcblx0XHRcdFx0XHRcdHZpc2l0ZWRbXy51dGlsLm9iaklkKG9baV0pXSA9IHRydWU7XHJcblx0XHRcdFx0XHRcdF8ubGFuZ3VhZ2VzLkRGUyhvW2ldLCBjYWxsYmFjaywgaSwgdmlzaXRlZCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSxcclxuXHRwbHVnaW5zOiB7fSxcclxuXHJcblx0aGlnaGxpZ2h0QWxsOiBmdW5jdGlvbihhc3luYywgY2FsbGJhY2spIHtcclxuXHRcdHZhciBlbnYgPSB7XHJcblx0XHRcdGNhbGxiYWNrOiBjYWxsYmFjayxcclxuXHRcdFx0c2VsZWN0b3I6ICdjb2RlW2NsYXNzKj1cImxhbmd1YWdlLVwiXSwgW2NsYXNzKj1cImxhbmd1YWdlLVwiXSBjb2RlLCBjb2RlW2NsYXNzKj1cImxhbmctXCJdLCBbY2xhc3MqPVwibGFuZy1cIl0gY29kZSdcclxuXHRcdH07XHJcblxyXG5cdFx0Xy5ob29rcy5ydW4oXCJiZWZvcmUtaGlnaGxpZ2h0YWxsXCIsIGVudik7XHJcblxyXG5cdFx0dmFyIGVsZW1lbnRzID0gZW52LmVsZW1lbnRzIHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoZW52LnNlbGVjdG9yKTtcclxuXHJcblx0XHRmb3IgKHZhciBpPTAsIGVsZW1lbnQ7IGVsZW1lbnQgPSBlbGVtZW50c1tpKytdOykge1xyXG5cdFx0XHRfLmhpZ2hsaWdodEVsZW1lbnQoZWxlbWVudCwgYXN5bmMgPT09IHRydWUsIGVudi5jYWxsYmFjayk7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0aGlnaGxpZ2h0RWxlbWVudDogZnVuY3Rpb24oZWxlbWVudCwgYXN5bmMsIGNhbGxiYWNrKSB7XHJcblx0XHQvLyBGaW5kIGxhbmd1YWdlXHJcblx0XHR2YXIgbGFuZ3VhZ2UsIGdyYW1tYXIsIHBhcmVudCA9IGVsZW1lbnQ7XHJcblxyXG5cdFx0d2hpbGUgKHBhcmVudCAmJiAhbGFuZy50ZXN0KHBhcmVudC5jbGFzc05hbWUpKSB7XHJcblx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChwYXJlbnQpIHtcclxuXHRcdFx0bGFuZ3VhZ2UgPSAocGFyZW50LmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCcnXSlbMV0udG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0Z3JhbW1hciA9IF8ubGFuZ3VhZ2VzW2xhbmd1YWdlXTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBTZXQgbGFuZ3VhZ2Ugb24gdGhlIGVsZW1lbnQsIGlmIG5vdCBwcmVzZW50XHJcblx0XHRlbGVtZW50LmNsYXNzTmFtZSA9IGVsZW1lbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xyXG5cclxuXHRcdC8vIFNldCBsYW5ndWFnZSBvbiB0aGUgcGFyZW50LCBmb3Igc3R5bGluZ1xyXG5cdFx0cGFyZW50ID0gZWxlbWVudC5wYXJlbnROb2RlO1xyXG5cclxuXHRcdGlmICgvcHJlL2kudGVzdChwYXJlbnQubm9kZU5hbWUpKSB7XHJcblx0XHRcdHBhcmVudC5jbGFzc05hbWUgPSBwYXJlbnQuY2xhc3NOYW1lLnJlcGxhY2UobGFuZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKSArICcgbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBjb2RlID0gZWxlbWVudC50ZXh0Q29udGVudDtcclxuXHJcblx0XHR2YXIgZW52ID0ge1xyXG5cdFx0XHRlbGVtZW50OiBlbGVtZW50LFxyXG5cdFx0XHRsYW5ndWFnZTogbGFuZ3VhZ2UsXHJcblx0XHRcdGdyYW1tYXI6IGdyYW1tYXIsXHJcblx0XHRcdGNvZGU6IGNvZGVcclxuXHRcdH07XHJcblxyXG5cdFx0Xy5ob29rcy5ydW4oJ2JlZm9yZS1zYW5pdHktY2hlY2snLCBlbnYpO1xyXG5cclxuXHRcdGlmICghZW52LmNvZGUgfHwgIWVudi5ncmFtbWFyKSB7XHJcblx0XHRcdGlmIChlbnYuY29kZSkge1xyXG5cdFx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaGlnaGxpZ2h0JywgZW52KTtcclxuXHRcdFx0XHRlbnYuZWxlbWVudC50ZXh0Q29udGVudCA9IGVudi5jb2RlO1xyXG5cdFx0XHRcdF8uaG9va3MucnVuKCdhZnRlci1oaWdobGlnaHQnLCBlbnYpO1xyXG5cdFx0XHR9XHJcblx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRfLmhvb2tzLnJ1bignYmVmb3JlLWhpZ2hsaWdodCcsIGVudik7XHJcblxyXG5cdFx0aWYgKGFzeW5jICYmIF9zZWxmLldvcmtlcikge1xyXG5cdFx0XHR2YXIgd29ya2VyID0gbmV3IFdvcmtlcihfLmZpbGVuYW1lKTtcclxuXHJcblx0XHRcdHdvcmtlci5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRlbnYuaGlnaGxpZ2h0ZWRDb2RlID0gZXZ0LmRhdGE7XHJcblxyXG5cdFx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaW5zZXJ0JywgZW52KTtcclxuXHJcblx0XHRcdFx0ZW52LmVsZW1lbnQuaW5uZXJIVE1MID0gZW52LmhpZ2hsaWdodGVkQ29kZTtcclxuXHJcblx0XHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbChlbnYuZWxlbWVudCk7XHJcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XHJcblx0XHRcdFx0Xy5ob29rcy5ydW4oJ2NvbXBsZXRlJywgZW52KTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdHdvcmtlci5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeSh7XHJcblx0XHRcdFx0bGFuZ3VhZ2U6IGVudi5sYW5ndWFnZSxcclxuXHRcdFx0XHRjb2RlOiBlbnYuY29kZSxcclxuXHRcdFx0XHRpbW1lZGlhdGVDbG9zZTogdHJ1ZVxyXG5cdFx0XHR9KSk7XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0ZW52LmhpZ2hsaWdodGVkQ29kZSA9IF8uaGlnaGxpZ2h0KGVudi5jb2RlLCBlbnYuZ3JhbW1hciwgZW52Lmxhbmd1YWdlKTtcclxuXHJcblx0XHRcdF8uaG9va3MucnVuKCdiZWZvcmUtaW5zZXJ0JywgZW52KTtcclxuXHJcblx0XHRcdGVudi5lbGVtZW50LmlubmVySFRNTCA9IGVudi5oaWdobGlnaHRlZENvZGU7XHJcblxyXG5cdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjay5jYWxsKGVsZW1lbnQpO1xyXG5cclxuXHRcdFx0Xy5ob29rcy5ydW4oJ2FmdGVyLWhpZ2hsaWdodCcsIGVudik7XHJcblx0XHRcdF8uaG9va3MucnVuKCdjb21wbGV0ZScsIGVudik7XHJcblx0XHR9XHJcblx0fSxcclxuXHJcblx0aGlnaGxpZ2h0OiBmdW5jdGlvbiAodGV4dCwgZ3JhbW1hciwgbGFuZ3VhZ2UpIHtcclxuXHRcdHZhciB0b2tlbnMgPSBfLnRva2VuaXplKHRleHQsIGdyYW1tYXIpO1xyXG5cdFx0cmV0dXJuIFRva2VuLnN0cmluZ2lmeShfLnV0aWwuZW5jb2RlKHRva2VucyksIGxhbmd1YWdlKTtcclxuXHR9LFxyXG5cclxuXHRtYXRjaEdyYW1tYXI6IGZ1bmN0aW9uICh0ZXh0LCBzdHJhcnIsIGdyYW1tYXIsIGluZGV4LCBzdGFydFBvcywgb25lc2hvdCwgdGFyZ2V0KSB7XHJcblx0XHR2YXIgVG9rZW4gPSBfLlRva2VuO1xyXG5cclxuXHRcdGZvciAodmFyIHRva2VuIGluIGdyYW1tYXIpIHtcclxuXHRcdFx0aWYoIWdyYW1tYXIuaGFzT3duUHJvcGVydHkodG9rZW4pIHx8ICFncmFtbWFyW3Rva2VuXSkge1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodG9rZW4gPT0gdGFyZ2V0KSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgcGF0dGVybnMgPSBncmFtbWFyW3Rva2VuXTtcclxuXHRcdFx0cGF0dGVybnMgPSAoXy51dGlsLnR5cGUocGF0dGVybnMpID09PSBcIkFycmF5XCIpID8gcGF0dGVybnMgOiBbcGF0dGVybnNdO1xyXG5cclxuXHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBwYXR0ZXJucy5sZW5ndGg7ICsraikge1xyXG5cdFx0XHRcdHZhciBwYXR0ZXJuID0gcGF0dGVybnNbal0sXHJcblx0XHRcdFx0XHRpbnNpZGUgPSBwYXR0ZXJuLmluc2lkZSxcclxuXHRcdFx0XHRcdGxvb2tiZWhpbmQgPSAhIXBhdHRlcm4ubG9va2JlaGluZCxcclxuXHRcdFx0XHRcdGdyZWVkeSA9ICEhcGF0dGVybi5ncmVlZHksXHJcblx0XHRcdFx0XHRsb29rYmVoaW5kTGVuZ3RoID0gMCxcclxuXHRcdFx0XHRcdGFsaWFzID0gcGF0dGVybi5hbGlhcztcclxuXHJcblx0XHRcdFx0aWYgKGdyZWVkeSAmJiAhcGF0dGVybi5wYXR0ZXJuLmdsb2JhbCkge1xyXG5cdFx0XHRcdFx0Ly8gV2l0aG91dCB0aGUgZ2xvYmFsIGZsYWcsIGxhc3RJbmRleCB3b24ndCB3b3JrXHJcblx0XHRcdFx0XHR2YXIgZmxhZ3MgPSBwYXR0ZXJuLnBhdHRlcm4udG9TdHJpbmcoKS5tYXRjaCgvW2ltdXldKiQvKVswXTtcclxuXHRcdFx0XHRcdHBhdHRlcm4ucGF0dGVybiA9IFJlZ0V4cChwYXR0ZXJuLnBhdHRlcm4uc291cmNlLCBmbGFncyArIFwiZ1wiKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHBhdHRlcm4gPSBwYXR0ZXJuLnBhdHRlcm4gfHwgcGF0dGVybjtcclxuXHJcblx0XHRcdFx0Ly8gRG9u4oCZdCBjYWNoZSBsZW5ndGggYXMgaXQgY2hhbmdlcyBkdXJpbmcgdGhlIGxvb3BcclxuXHRcdFx0XHRmb3IgKHZhciBpID0gaW5kZXgsIHBvcyA9IHN0YXJ0UG9zOyBpIDwgc3RyYXJyLmxlbmd0aDsgcG9zICs9IHN0cmFycltpXS5sZW5ndGgsICsraSkge1xyXG5cclxuXHRcdFx0XHRcdHZhciBzdHIgPSBzdHJhcnJbaV07XHJcblxyXG5cdFx0XHRcdFx0aWYgKHN0cmFyci5sZW5ndGggPiB0ZXh0Lmxlbmd0aCkge1xyXG5cdFx0XHRcdFx0XHQvLyBTb21ldGhpbmcgd2VudCB0ZXJyaWJseSB3cm9uZywgQUJPUlQsIEFCT1JUIVxyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKHN0ciBpbnN0YW5jZW9mIFRva2VuKSB7XHJcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHBhdHRlcm4ubGFzdEluZGV4ID0gMDtcclxuXHJcblx0XHRcdFx0XHR2YXIgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMoc3RyKSxcclxuXHRcdFx0XHRcdCAgICBkZWxOdW0gPSAxO1xyXG5cclxuXHRcdFx0XHRcdC8vIEdyZWVkeSBwYXR0ZXJucyBjYW4gb3ZlcnJpZGUvcmVtb3ZlIHVwIHRvIHR3byBwcmV2aW91c2x5IG1hdGNoZWQgdG9rZW5zXHJcblx0XHRcdFx0XHRpZiAoIW1hdGNoICYmIGdyZWVkeSAmJiBpICE9IHN0cmFyci5sZW5ndGggLSAxKSB7XHJcblx0XHRcdFx0XHRcdHBhdHRlcm4ubGFzdEluZGV4ID0gcG9zO1xyXG5cdFx0XHRcdFx0XHRtYXRjaCA9IHBhdHRlcm4uZXhlYyh0ZXh0KTtcclxuXHRcdFx0XHRcdFx0aWYgKCFtYXRjaCkge1xyXG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgZnJvbSA9IG1hdGNoLmluZGV4ICsgKGxvb2tiZWhpbmQgPyBtYXRjaFsxXS5sZW5ndGggOiAwKSxcclxuXHRcdFx0XHRcdFx0ICAgIHRvID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgsXHJcblx0XHRcdFx0XHRcdCAgICBrID0gaSxcclxuXHRcdFx0XHRcdFx0ICAgIHAgPSBwb3M7XHJcblxyXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBsZW4gPSBzdHJhcnIubGVuZ3RoOyBrIDwgbGVuICYmIChwIDwgdG8gfHwgKCFzdHJhcnJba10udHlwZSAmJiAhc3RyYXJyW2sgLSAxXS5ncmVlZHkpKTsgKytrKSB7XHJcblx0XHRcdFx0XHRcdFx0cCArPSBzdHJhcnJba10ubGVuZ3RoO1xyXG5cdFx0XHRcdFx0XHRcdC8vIE1vdmUgdGhlIGluZGV4IGkgdG8gdGhlIGVsZW1lbnQgaW4gc3RyYXJyIHRoYXQgaXMgY2xvc2VzdCB0byBmcm9tXHJcblx0XHRcdFx0XHRcdFx0aWYgKGZyb20gPj0gcCkge1xyXG5cdFx0XHRcdFx0XHRcdFx0KytpO1xyXG5cdFx0XHRcdFx0XHRcdFx0cG9zID0gcDtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdC8qXHJcblx0XHRcdFx0XHRcdCAqIElmIHN0cmFycltpXSBpcyBhIFRva2VuLCB0aGVuIHRoZSBtYXRjaCBzdGFydHMgaW5zaWRlIGFub3RoZXIgVG9rZW4sIHdoaWNoIGlzIGludmFsaWRcclxuXHRcdFx0XHRcdFx0ICogSWYgc3RyYXJyW2sgLSAxXSBpcyBncmVlZHkgd2UgYXJlIGluIGNvbmZsaWN0IHdpdGggYW5vdGhlciBncmVlZHkgcGF0dGVyblxyXG5cdFx0XHRcdFx0XHQgKi9cclxuXHRcdFx0XHRcdFx0aWYgKHN0cmFycltpXSBpbnN0YW5jZW9mIFRva2VuIHx8IHN0cmFycltrIC0gMV0uZ3JlZWR5KSB7XHJcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdC8vIE51bWJlciBvZiB0b2tlbnMgdG8gZGVsZXRlIGFuZCByZXBsYWNlIHdpdGggdGhlIG5ldyBtYXRjaFxyXG5cdFx0XHRcdFx0XHRkZWxOdW0gPSBrIC0gaTtcclxuXHRcdFx0XHRcdFx0c3RyID0gdGV4dC5zbGljZShwb3MsIHApO1xyXG5cdFx0XHRcdFx0XHRtYXRjaC5pbmRleCAtPSBwb3M7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCFtYXRjaCkge1xyXG5cdFx0XHRcdFx0XHRpZiAob25lc2hvdCkge1xyXG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZihsb29rYmVoaW5kKSB7XHJcblx0XHRcdFx0XHRcdGxvb2tiZWhpbmRMZW5ndGggPSBtYXRjaFsxXS5sZW5ndGg7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dmFyIGZyb20gPSBtYXRjaC5pbmRleCArIGxvb2tiZWhpbmRMZW5ndGgsXHJcblx0XHRcdFx0XHQgICAgbWF0Y2ggPSBtYXRjaFswXS5zbGljZShsb29rYmVoaW5kTGVuZ3RoKSxcclxuXHRcdFx0XHRcdCAgICB0byA9IGZyb20gKyBtYXRjaC5sZW5ndGgsXHJcblx0XHRcdFx0XHQgICAgYmVmb3JlID0gc3RyLnNsaWNlKDAsIGZyb20pLFxyXG5cdFx0XHRcdFx0ICAgIGFmdGVyID0gc3RyLnNsaWNlKHRvKTtcclxuXHJcblx0XHRcdFx0XHR2YXIgYXJncyA9IFtpLCBkZWxOdW1dO1xyXG5cclxuXHRcdFx0XHRcdGlmIChiZWZvcmUpIHtcclxuXHRcdFx0XHRcdFx0KytpO1xyXG5cdFx0XHRcdFx0XHRwb3MgKz0gYmVmb3JlLmxlbmd0aDtcclxuXHRcdFx0XHRcdFx0YXJncy5wdXNoKGJlZm9yZSk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dmFyIHdyYXBwZWQgPSBuZXcgVG9rZW4odG9rZW4sIGluc2lkZT8gXy50b2tlbml6ZShtYXRjaCwgaW5zaWRlKSA6IG1hdGNoLCBhbGlhcywgbWF0Y2gsIGdyZWVkeSk7XHJcblxyXG5cdFx0XHRcdFx0YXJncy5wdXNoKHdyYXBwZWQpO1xyXG5cclxuXHRcdFx0XHRcdGlmIChhZnRlcikge1xyXG5cdFx0XHRcdFx0XHRhcmdzLnB1c2goYWZ0ZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdEFycmF5LnByb3RvdHlwZS5zcGxpY2UuYXBwbHkoc3RyYXJyLCBhcmdzKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoZGVsTnVtICE9IDEpXHJcblx0XHRcdFx0XHRcdF8ubWF0Y2hHcmFtbWFyKHRleHQsIHN0cmFyciwgZ3JhbW1hciwgaSwgcG9zLCB0cnVlLCB0b2tlbik7XHJcblxyXG5cdFx0XHRcdFx0aWYgKG9uZXNob3QpXHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcblxyXG5cdHRva2VuaXplOiBmdW5jdGlvbih0ZXh0LCBncmFtbWFyLCBsYW5ndWFnZSkge1xyXG5cdFx0dmFyIHN0cmFyciA9IFt0ZXh0XTtcclxuXHJcblx0XHR2YXIgcmVzdCA9IGdyYW1tYXIucmVzdDtcclxuXHJcblx0XHRpZiAocmVzdCkge1xyXG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiByZXN0KSB7XHJcblx0XHRcdFx0Z3JhbW1hclt0b2tlbl0gPSByZXN0W3Rva2VuXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZGVsZXRlIGdyYW1tYXIucmVzdDtcclxuXHRcdH1cclxuXHJcblx0XHRfLm1hdGNoR3JhbW1hcih0ZXh0LCBzdHJhcnIsIGdyYW1tYXIsIDAsIDAsIGZhbHNlKTtcclxuXHJcblx0XHRyZXR1cm4gc3RyYXJyO1xyXG5cdH0sXHJcblxyXG5cdGhvb2tzOiB7XHJcblx0XHRhbGw6IHt9LFxyXG5cclxuXHRcdGFkZDogZnVuY3Rpb24gKG5hbWUsIGNhbGxiYWNrKSB7XHJcblx0XHRcdHZhciBob29rcyA9IF8uaG9va3MuYWxsO1xyXG5cclxuXHRcdFx0aG9va3NbbmFtZV0gPSBob29rc1tuYW1lXSB8fCBbXTtcclxuXHJcblx0XHRcdGhvb2tzW25hbWVdLnB1c2goY2FsbGJhY2spO1xyXG5cdFx0fSxcclxuXHJcblx0XHRydW46IGZ1bmN0aW9uIChuYW1lLCBlbnYpIHtcclxuXHRcdFx0dmFyIGNhbGxiYWNrcyA9IF8uaG9va3MuYWxsW25hbWVdO1xyXG5cclxuXHRcdFx0aWYgKCFjYWxsYmFja3MgfHwgIWNhbGxiYWNrcy5sZW5ndGgpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZvciAodmFyIGk9MCwgY2FsbGJhY2s7IGNhbGxiYWNrID0gY2FsbGJhY2tzW2krK107KSB7XHJcblx0XHRcdFx0Y2FsbGJhY2soZW52KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbnZhciBUb2tlbiA9IF8uVG9rZW4gPSBmdW5jdGlvbih0eXBlLCBjb250ZW50LCBhbGlhcywgbWF0Y2hlZFN0ciwgZ3JlZWR5KSB7XHJcblx0dGhpcy50eXBlID0gdHlwZTtcclxuXHR0aGlzLmNvbnRlbnQgPSBjb250ZW50O1xyXG5cdHRoaXMuYWxpYXMgPSBhbGlhcztcclxuXHQvLyBDb3B5IG9mIHRoZSBmdWxsIHN0cmluZyB0aGlzIHRva2VuIHdhcyBjcmVhdGVkIGZyb21cclxuXHR0aGlzLmxlbmd0aCA9IChtYXRjaGVkU3RyIHx8IFwiXCIpLmxlbmd0aHwwO1xyXG5cdHRoaXMuZ3JlZWR5ID0gISFncmVlZHk7XHJcbn07XHJcblxyXG5Ub2tlbi5zdHJpbmdpZnkgPSBmdW5jdGlvbihvLCBsYW5ndWFnZSwgcGFyZW50KSB7XHJcblx0aWYgKHR5cGVvZiBvID09ICdzdHJpbmcnKSB7XHJcblx0XHRyZXR1cm4gbztcclxuXHR9XHJcblxyXG5cdGlmIChfLnV0aWwudHlwZShvKSA9PT0gJ0FycmF5Jykge1xyXG5cdFx0cmV0dXJuIG8ubWFwKGZ1bmN0aW9uKGVsZW1lbnQpIHtcclxuXHRcdFx0cmV0dXJuIFRva2VuLnN0cmluZ2lmeShlbGVtZW50LCBsYW5ndWFnZSwgbyk7XHJcblx0XHR9KS5qb2luKCcnKTtcclxuXHR9XHJcblxyXG5cdHZhciBlbnYgPSB7XHJcblx0XHR0eXBlOiBvLnR5cGUsXHJcblx0XHRjb250ZW50OiBUb2tlbi5zdHJpbmdpZnkoby5jb250ZW50LCBsYW5ndWFnZSwgcGFyZW50KSxcclxuXHRcdHRhZzogJ3NwYW4nLFxyXG5cdFx0Y2xhc3NlczogWyd0b2tlbicsIG8udHlwZV0sXHJcblx0XHRhdHRyaWJ1dGVzOiB7fSxcclxuXHRcdGxhbmd1YWdlOiBsYW5ndWFnZSxcclxuXHRcdHBhcmVudDogcGFyZW50XHJcblx0fTtcclxuXHJcblx0aWYgKGVudi50eXBlID09ICdjb21tZW50Jykge1xyXG5cdFx0ZW52LmF0dHJpYnV0ZXNbJ3NwZWxsY2hlY2snXSA9ICd0cnVlJztcclxuXHR9XHJcblxyXG5cdGlmIChvLmFsaWFzKSB7XHJcblx0XHR2YXIgYWxpYXNlcyA9IF8udXRpbC50eXBlKG8uYWxpYXMpID09PSAnQXJyYXknID8gby5hbGlhcyA6IFtvLmFsaWFzXTtcclxuXHRcdEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KGVudi5jbGFzc2VzLCBhbGlhc2VzKTtcclxuXHR9XHJcblxyXG5cdF8uaG9va3MucnVuKCd3cmFwJywgZW52KTtcclxuXHJcblx0dmFyIGF0dHJpYnV0ZXMgPSBPYmplY3Qua2V5cyhlbnYuYXR0cmlidXRlcykubWFwKGZ1bmN0aW9uKG5hbWUpIHtcclxuXHRcdHJldHVybiBuYW1lICsgJz1cIicgKyAoZW52LmF0dHJpYnV0ZXNbbmFtZV0gfHwgJycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKSArICdcIic7XHJcblx0fSkuam9pbignICcpO1xyXG5cclxuXHRyZXR1cm4gJzwnICsgZW52LnRhZyArICcgY2xhc3M9XCInICsgZW52LmNsYXNzZXMuam9pbignICcpICsgJ1wiJyArIChhdHRyaWJ1dGVzID8gJyAnICsgYXR0cmlidXRlcyA6ICcnKSArICc+JyArIGVudi5jb250ZW50ICsgJzwvJyArIGVudi50YWcgKyAnPic7XHJcblxyXG59O1xyXG5cclxuaWYgKCFfc2VsZi5kb2N1bWVudCkge1xyXG5cdGlmICghX3NlbGYuYWRkRXZlbnRMaXN0ZW5lcikge1xyXG5cdFx0Ly8gaW4gTm9kZS5qc1xyXG5cdFx0cmV0dXJuIF9zZWxmLlByaXNtO1xyXG5cdH1cclxuIFx0Ly8gSW4gd29ya2VyXHJcblx0X3NlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0dmFyIG1lc3NhZ2UgPSBKU09OLnBhcnNlKGV2dC5kYXRhKSxcclxuXHRcdCAgICBsYW5nID0gbWVzc2FnZS5sYW5ndWFnZSxcclxuXHRcdCAgICBjb2RlID0gbWVzc2FnZS5jb2RlLFxyXG5cdFx0ICAgIGltbWVkaWF0ZUNsb3NlID0gbWVzc2FnZS5pbW1lZGlhdGVDbG9zZTtcclxuXHJcblx0XHRfc2VsZi5wb3N0TWVzc2FnZShfLmhpZ2hsaWdodChjb2RlLCBfLmxhbmd1YWdlc1tsYW5nXSwgbGFuZykpO1xyXG5cdFx0aWYgKGltbWVkaWF0ZUNsb3NlKSB7XHJcblx0XHRcdF9zZWxmLmNsb3NlKCk7XHJcblx0XHR9XHJcblx0fSwgZmFsc2UpO1xyXG5cclxuXHRyZXR1cm4gX3NlbGYuUHJpc207XHJcbn1cclxuXHJcbi8vR2V0IGN1cnJlbnQgc2NyaXB0IGFuZCBoaWdobGlnaHRcclxudmFyIHNjcmlwdCA9IGRvY3VtZW50LmN1cnJlbnRTY3JpcHQgfHwgW10uc2xpY2UuY2FsbChkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInNjcmlwdFwiKSkucG9wKCk7XHJcblxyXG5pZiAoc2NyaXB0KSB7XHJcblx0Xy5maWxlbmFtZSA9IHNjcmlwdC5zcmM7XHJcblxyXG5cdGlmIChkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyICYmICFfLm1hbnVhbCAmJiAhc2NyaXB0Lmhhc0F0dHJpYnV0ZSgnZGF0YS1tYW51YWwnKSkge1xyXG5cdFx0aWYoZG9jdW1lbnQucmVhZHlTdGF0ZSAhPT0gXCJsb2FkaW5nXCIpIHtcclxuXHRcdFx0aWYgKHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcclxuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKF8uaGlnaGxpZ2h0QWxsKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dChfLmhpZ2hsaWdodEFsbCwgMTYpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIF8uaGlnaGxpZ2h0QWxsKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbnJldHVybiBfc2VsZi5QcmlzbTtcclxuXHJcbn0pKCk7XHJcblxyXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcclxuXHRtb2R1bGUuZXhwb3J0cyA9IFByaXNtO1xyXG59XHJcblxyXG4vLyBoYWNrIGZvciBjb21wb25lbnRzIHRvIHdvcmsgY29ycmVjdGx5IGluIG5vZGUuanNcclxuaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XHJcblx0Z2xvYmFsLlByaXNtID0gUHJpc207XHJcbn1cclxuXHJcblxyXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgQmVnaW4gcHJpc20tbWFya3VwLmpzXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuXHJcblByaXNtLmxhbmd1YWdlcy5tYXJrdXAgPSB7XHJcblx0J2NvbW1lbnQnOiAvPCEtLVtcXHNcXFNdKj8tLT4vLFxyXG5cdCdwcm9sb2cnOiAvPFxcP1tcXHNcXFNdKz9cXD8+LyxcclxuXHQnZG9jdHlwZSc6IC88IURPQ1RZUEVbXFxzXFxTXSs/Pi9pLFxyXG5cdCdjZGF0YSc6IC88IVxcW0NEQVRBXFxbW1xcc1xcU10qP11dPi9pLFxyXG5cdCd0YWcnOiB7XHJcblx0XHRwYXR0ZXJuOiAvPFxcLz8oPyFcXGQpW15cXHM+XFwvPSQ8XSsoPzpcXHMrW15cXHM+XFwvPV0rKD86PSg/OihcInwnKSg/OlxcXFxcXDF8XFxcXD8oPyFcXDEpW1xcc1xcU10pKlxcMXxbXlxccydcIj49XSspKT8pKlxccypcXC8/Pi9pLFxyXG5cdFx0aW5zaWRlOiB7XHJcblx0XHRcdCd0YWcnOiB7XHJcblx0XHRcdFx0cGF0dGVybjogL148XFwvP1teXFxzPlxcL10rL2ksXHJcblx0XHRcdFx0aW5zaWRlOiB7XHJcblx0XHRcdFx0XHQncHVuY3R1YXRpb24nOiAvXjxcXC8/LyxcclxuXHRcdFx0XHRcdCduYW1lc3BhY2UnOiAvXlteXFxzPlxcLzpdKzovXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnYXR0ci12YWx1ZSc6IHtcclxuXHRcdFx0XHRwYXR0ZXJuOiAvPSg/OignfFwiKVtcXHNcXFNdKj8oXFwxKXxbXlxccz5dKykvaSxcclxuXHRcdFx0XHRpbnNpZGU6IHtcclxuXHRcdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9bPT5cIiddL1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0J3B1bmN0dWF0aW9uJzogL1xcLz8+LyxcclxuXHRcdFx0J2F0dHItbmFtZSc6IHtcclxuXHRcdFx0XHRwYXR0ZXJuOiAvW15cXHM+XFwvXSsvLFxyXG5cdFx0XHRcdGluc2lkZToge1xyXG5cdFx0XHRcdFx0J25hbWVzcGFjZSc6IC9eW15cXHM+XFwvOl0rOi9cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblx0fSxcclxuXHQnZW50aXR5JzogLyYjP1tcXGRhLXpdezEsOH07L2lcclxufTtcclxuXHJcbi8vIFBsdWdpbiB0byBtYWtlIGVudGl0eSB0aXRsZSBzaG93IHRoZSByZWFsIGVudGl0eSwgaWRlYSBieSBSb21hbiBLb21hcm92XHJcblByaXNtLmhvb2tzLmFkZCgnd3JhcCcsIGZ1bmN0aW9uKGVudikge1xyXG5cclxuXHRpZiAoZW52LnR5cGUgPT09ICdlbnRpdHknKSB7XHJcblx0XHRlbnYuYXR0cmlidXRlc1sndGl0bGUnXSA9IGVudi5jb250ZW50LnJlcGxhY2UoLyZhbXA7LywgJyYnKTtcclxuXHR9XHJcbn0pO1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLnhtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XHJcblByaXNtLmxhbmd1YWdlcy5odG1sID0gUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cDtcclxuUHJpc20ubGFuZ3VhZ2VzLm1hdGhtbCA9IFByaXNtLmxhbmd1YWdlcy5tYXJrdXA7XHJcblByaXNtLmxhbmd1YWdlcy5zdmcgPSBQcmlzbS5sYW5ndWFnZXMubWFya3VwO1xyXG5cclxuXHJcbi8qICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuICAgICBCZWdpbiBwcmlzbS1jc3MuanNcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmNzcyA9IHtcclxuXHQnY29tbWVudCc6IC9cXC9cXCpbXFxzXFxTXSo/XFwqXFwvLyxcclxuXHQnYXRydWxlJzoge1xyXG5cdFx0cGF0dGVybjogL0BbXFx3LV0rPy4qPyg7fCg/PVxccypcXHspKS9pLFxyXG5cdFx0aW5zaWRlOiB7XHJcblx0XHRcdCdydWxlJzogL0BbXFx3LV0rL1xyXG5cdFx0XHQvLyBTZWUgcmVzdCBiZWxvd1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0J3VybCc6IC91cmxcXCgoPzooW1wiJ10pKFxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDF8Lio/KVxcKS9pLFxyXG5cdCdzZWxlY3Rvcic6IC9bXlxce1xcfVxcc11bXlxce1xcfTtdKj8oPz1cXHMqXFx7KS8sXHJcblx0J3N0cmluZyc6IHtcclxuXHRcdHBhdHRlcm46IC8oXCJ8JykoXFxcXCg/OlxcclxcbnxbXFxzXFxTXSl8KD8hXFwxKVteXFxcXFxcclxcbl0pKlxcMS8sXHJcblx0XHRncmVlZHk6IHRydWVcclxuXHR9LFxyXG5cdCdwcm9wZXJ0eSc6IC8oXFxifFxcQilbXFx3LV0rKD89XFxzKjopL2ksXHJcblx0J2ltcG9ydGFudCc6IC9cXEIhaW1wb3J0YW50XFxiL2ksXHJcblx0J2Z1bmN0aW9uJzogL1stYS16MC05XSsoPz1cXCgpL2ksXHJcblx0J3B1bmN0dWF0aW9uJzogL1soKXt9OzpdL1xyXG59O1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmNzc1snYXRydWxlJ10uaW5zaWRlLnJlc3QgPSBQcmlzbS51dGlsLmNsb25lKFByaXNtLmxhbmd1YWdlcy5jc3MpO1xyXG5cclxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcclxuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdtYXJrdXAnLCAndGFnJywge1xyXG5cdFx0J3N0eWxlJzoge1xyXG5cdFx0XHRwYXR0ZXJuOiAvKDxzdHlsZVtcXHNcXFNdKj8+KVtcXHNcXFNdKj8oPz08XFwvc3R5bGU+KS9pLFxyXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlLFxyXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5jc3MsXHJcblx0XHRcdGFsaWFzOiAnbGFuZ3VhZ2UtY3NzJ1xyXG5cdFx0fVxyXG5cdH0pO1xyXG5cdFxyXG5cdFByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ2luc2lkZScsICdhdHRyLXZhbHVlJywge1xyXG5cdFx0J3N0eWxlLWF0dHInOiB7XHJcblx0XHRcdHBhdHRlcm46IC9cXHMqc3R5bGU9KFwifCcpLio/XFwxL2ksXHJcblx0XHRcdGluc2lkZToge1xyXG5cdFx0XHRcdCdhdHRyLW5hbWUnOiB7XHJcblx0XHRcdFx0XHRwYXR0ZXJuOiAvXlxccypzdHlsZS9pLFxyXG5cdFx0XHRcdFx0aW5zaWRlOiBQcmlzbS5sYW5ndWFnZXMubWFya3VwLnRhZy5pbnNpZGVcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdCdwdW5jdHVhdGlvbic6IC9eXFxzKj1cXHMqWydcIl18WydcIl1cXHMqJC8sXHJcblx0XHRcdFx0J2F0dHItdmFsdWUnOiB7XHJcblx0XHRcdFx0XHRwYXR0ZXJuOiAvLisvaSxcclxuXHRcdFx0XHRcdGluc2lkZTogUHJpc20ubGFuZ3VhZ2VzLmNzc1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0YWxpYXM6ICdsYW5ndWFnZS1jc3MnXHJcblx0XHR9XHJcblx0fSwgUHJpc20ubGFuZ3VhZ2VzLm1hcmt1cC50YWcpO1xyXG59XHJcblxyXG4vKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbiAgICAgQmVnaW4gcHJpc20tY2xpa2UuanNcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmNsaWtlID0ge1xyXG5cdCdjb21tZW50JzogW1xyXG5cdFx0e1xyXG5cdFx0XHRwYXR0ZXJuOiAvKF58W15cXFxcXSlcXC9cXCpbXFxzXFxTXSo/XFwqXFwvLyxcclxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZVxyXG5cdFx0fSxcclxuXHRcdHtcclxuXHRcdFx0cGF0dGVybjogLyhefFteXFxcXDpdKVxcL1xcLy4qLyxcclxuXHRcdFx0bG9va2JlaGluZDogdHJ1ZVxyXG5cdFx0fVxyXG5cdF0sXHJcblx0J3N0cmluZyc6IHtcclxuXHRcdHBhdHRlcm46IC8oW1wiJ10pKFxcXFwoPzpcXHJcXG58W1xcc1xcU10pfCg/IVxcMSlbXlxcXFxcXHJcXG5dKSpcXDEvLFxyXG5cdFx0Z3JlZWR5OiB0cnVlXHJcblx0fSxcclxuXHQnY2xhc3MtbmFtZSc6IHtcclxuXHRcdHBhdHRlcm46IC8oKD86XFxiKD86Y2xhc3N8aW50ZXJmYWNlfGV4dGVuZHN8aW1wbGVtZW50c3x0cmFpdHxpbnN0YW5jZW9mfG5ldylcXHMrKXwoPzpjYXRjaFxccytcXCgpKVthLXowLTlfXFwuXFxcXF0rL2ksXHJcblx0XHRsb29rYmVoaW5kOiB0cnVlLFxyXG5cdFx0aW5zaWRlOiB7XHJcblx0XHRcdHB1bmN0dWF0aW9uOiAvKFxcLnxcXFxcKS9cclxuXHRcdH1cclxuXHR9LFxyXG5cdCdrZXl3b3JkJzogL1xcYihpZnxlbHNlfHdoaWxlfGRvfGZvcnxyZXR1cm58aW58aW5zdGFuY2VvZnxmdW5jdGlvbnxuZXd8dHJ5fHRocm93fGNhdGNofGZpbmFsbHl8bnVsbHxicmVha3xjb250aW51ZSlcXGIvLFxyXG5cdCdib29sZWFuJzogL1xcYih0cnVlfGZhbHNlKVxcYi8sXHJcblx0J2Z1bmN0aW9uJzogL1thLXowLTlfXSsoPz1cXCgpL2ksXHJcblx0J251bWJlcic6IC9cXGItPyg/OjB4W1xcZGEtZl0rfFxcZCpcXC4/XFxkKyg/OmVbKy1dP1xcZCspPylcXGIvaSxcclxuXHQnb3BlcmF0b3InOiAvLS0/fFxcK1xcKz98IT0/PT98PD0/fD49P3w9PT89P3wmJj98XFx8XFx8P3xcXD98XFwqfFxcL3x+fFxcXnwlLyxcclxuXHQncHVuY3R1YXRpb24nOiAvW3t9W1xcXTsoKSwuOl0vXHJcbn07XHJcblxyXG5cclxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgIEJlZ2luIHByaXNtLWphdmFzY3JpcHQuanNcclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG5cclxuUHJpc20ubGFuZ3VhZ2VzLmphdmFzY3JpcHQgPSBQcmlzbS5sYW5ndWFnZXMuZXh0ZW5kKCdjbGlrZScsIHtcclxuXHQna2V5d29yZCc6IC9cXGIoYXN8YXN5bmN8YXdhaXR8YnJlYWt8Y2FzZXxjYXRjaHxjbGFzc3xjb25zdHxjb250aW51ZXxkZWJ1Z2dlcnxkZWZhdWx0fGRlbGV0ZXxkb3xlbHNlfGVudW18ZXhwb3J0fGV4dGVuZHN8ZmluYWxseXxmb3J8ZnJvbXxmdW5jdGlvbnxnZXR8aWZ8aW1wbGVtZW50c3xpbXBvcnR8aW58aW5zdGFuY2VvZnxpbnRlcmZhY2V8bGV0fG5ld3xudWxsfG9mfHBhY2thZ2V8cHJpdmF0ZXxwcm90ZWN0ZWR8cHVibGljfHJldHVybnxzZXR8c3RhdGljfHN1cGVyfHN3aXRjaHx0aGlzfHRocm93fHRyeXx0eXBlb2Z8dmFyfHZvaWR8d2hpbGV8d2l0aHx5aWVsZClcXGIvLFxyXG5cdCdudW1iZXInOiAvXFxiLT8oMHhbXFxkQS1GYS1mXSt8MGJbMDFdK3wwb1swLTddK3xcXGQqXFwuP1xcZCsoW0VlXVsrLV0/XFxkKyk/fE5hTnxJbmZpbml0eSlcXGIvLFxyXG5cdC8vIEFsbG93IGZvciBhbGwgbm9uLUFTQ0lJIGNoYXJhY3RlcnMgKFNlZSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMDA4NDQ0KVxyXG5cdCdmdW5jdGlvbic6IC9bXyRhLXpBLVpcXHhBMC1cXHVGRkZGXVtfJGEtekEtWjAtOVxceEEwLVxcdUZGRkZdKig/PVxcKCkvaSxcclxuXHQnb3BlcmF0b3InOiAvLVstPV0/fFxcK1srPV0/fCE9Pz0/fDw8Pz0/fD4+Pz4/PT98PSg/Oj09P3w+KT98JlsmPV0/fFxcfFt8PV0/fFxcKlxcKj89P3xcXC89P3x+fFxcXj0/fCU9P3xcXD98XFwuezN9L1xyXG59KTtcclxuXHJcblByaXNtLmxhbmd1YWdlcy5pbnNlcnRCZWZvcmUoJ2phdmFzY3JpcHQnLCAna2V5d29yZCcsIHtcclxuXHQncmVnZXgnOiB7XHJcblx0XHRwYXR0ZXJuOiAvKF58W14vXSlcXC8oPyFcXC8pKFxcWy4rP118XFxcXC58W14vXFxcXFxcclxcbl0pK1xcL1tnaW15dV17MCw1fSg/PVxccyooJHxbXFxyXFxuLC47fSldKSkvLFxyXG5cdFx0bG9va2JlaGluZDogdHJ1ZSxcclxuXHRcdGdyZWVkeTogdHJ1ZVxyXG5cdH1cclxufSk7XHJcblxyXG5QcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdqYXZhc2NyaXB0JywgJ3N0cmluZycsIHtcclxuXHQndGVtcGxhdGUtc3RyaW5nJzoge1xyXG5cdFx0cGF0dGVybjogL2AoPzpcXFxcXFxcXHxcXFxcP1teXFxcXF0pKj9gLyxcclxuXHRcdGdyZWVkeTogdHJ1ZSxcclxuXHRcdGluc2lkZToge1xyXG5cdFx0XHQnaW50ZXJwb2xhdGlvbic6IHtcclxuXHRcdFx0XHRwYXR0ZXJuOiAvXFwkXFx7W159XStcXH0vLFxyXG5cdFx0XHRcdGluc2lkZToge1xyXG5cdFx0XHRcdFx0J2ludGVycG9sYXRpb24tcHVuY3R1YXRpb24nOiB7XHJcblx0XHRcdFx0XHRcdHBhdHRlcm46IC9eXFwkXFx7fFxcfSQvLFxyXG5cdFx0XHRcdFx0XHRhbGlhczogJ3B1bmN0dWF0aW9uJ1xyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdHJlc3Q6IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnc3RyaW5nJzogL1tcXHNcXFNdKy9cclxuXHRcdH1cclxuXHR9XHJcbn0pO1xyXG5cclxuaWYgKFByaXNtLmxhbmd1YWdlcy5tYXJrdXApIHtcclxuXHRQcmlzbS5sYW5ndWFnZXMuaW5zZXJ0QmVmb3JlKCdtYXJrdXAnLCAndGFnJywge1xyXG5cdFx0J3NjcmlwdCc6IHtcclxuXHRcdFx0cGF0dGVybjogLyg8c2NyaXB0W1xcc1xcU10qPz4pW1xcc1xcU10qPyg/PTxcXC9zY3JpcHQ+KS9pLFxyXG5cdFx0XHRsb29rYmVoaW5kOiB0cnVlLFxyXG5cdFx0XHRpbnNpZGU6IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0LFxyXG5cdFx0XHRhbGlhczogJ2xhbmd1YWdlLWphdmFzY3JpcHQnXHJcblx0XHR9XHJcblx0fSk7XHJcbn1cclxuXHJcblByaXNtLmxhbmd1YWdlcy5qcyA9IFByaXNtLmxhbmd1YWdlcy5qYXZhc2NyaXB0O1xyXG5cclxuLyogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG4gICAgIEJlZ2luIHByaXNtLWZpbGUtaGlnaGxpZ2h0LmpzXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuXHJcbihmdW5jdGlvbiAoKSB7XHJcblx0aWYgKHR5cGVvZiBzZWxmID09PSAndW5kZWZpbmVkJyB8fCAhc2VsZi5QcmlzbSB8fCAhc2VsZi5kb2N1bWVudCB8fCAhZG9jdW1lbnQucXVlcnlTZWxlY3Rvcikge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0c2VsZi5QcmlzbS5maWxlSGlnaGxpZ2h0ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdFx0dmFyIEV4dGVuc2lvbnMgPSB7XHJcblx0XHRcdCdqcyc6ICdqYXZhc2NyaXB0JyxcclxuXHRcdFx0J3B5JzogJ3B5dGhvbicsXHJcblx0XHRcdCdyYic6ICdydWJ5JyxcclxuXHRcdFx0J3BzMSc6ICdwb3dlcnNoZWxsJyxcclxuXHRcdFx0J3BzbTEnOiAncG93ZXJzaGVsbCcsXHJcblx0XHRcdCdzaCc6ICdiYXNoJyxcclxuXHRcdFx0J2JhdCc6ICdiYXRjaCcsXHJcblx0XHRcdCdoJzogJ2MnLFxyXG5cdFx0XHQndGV4JzogJ2xhdGV4J1xyXG5cdFx0fTtcclxuXHJcblx0XHRpZihBcnJheS5wcm90b3R5cGUuZm9yRWFjaCkgeyAvLyBDaGVjayB0byBwcmV2ZW50IGVycm9yIGluIElFOFxyXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdwcmVbZGF0YS1zcmNdJykpLmZvckVhY2goZnVuY3Rpb24gKHByZSkge1xyXG5cdFx0XHRcdHZhciBzcmMgPSBwcmUuZ2V0QXR0cmlidXRlKCdkYXRhLXNyYycpO1xyXG5cclxuXHRcdFx0XHR2YXIgbGFuZ3VhZ2UsIHBhcmVudCA9IHByZTtcclxuXHRcdFx0XHR2YXIgbGFuZyA9IC9cXGJsYW5nKD86dWFnZSk/LSg/IVxcKikoXFx3KylcXGIvaTtcclxuXHRcdFx0XHR3aGlsZSAocGFyZW50ICYmICFsYW5nLnRlc3QocGFyZW50LmNsYXNzTmFtZSkpIHtcclxuXHRcdFx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKHBhcmVudCkge1xyXG5cdFx0XHRcdFx0bGFuZ3VhZ2UgPSAocHJlLmNsYXNzTmFtZS5tYXRjaChsYW5nKSB8fCBbLCAnJ10pWzFdO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCFsYW5ndWFnZSkge1xyXG5cdFx0XHRcdFx0dmFyIGV4dGVuc2lvbiA9IChzcmMubWF0Y2goL1xcLihcXHcrKSQvKSB8fCBbLCAnJ10pWzFdO1xyXG5cdFx0XHRcdFx0bGFuZ3VhZ2UgPSBFeHRlbnNpb25zW2V4dGVuc2lvbl0gfHwgZXh0ZW5zaW9uO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIGNvZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjb2RlJyk7XHJcblx0XHRcdFx0Y29kZS5jbGFzc05hbWUgPSAnbGFuZ3VhZ2UtJyArIGxhbmd1YWdlO1xyXG5cclxuXHRcdFx0XHRwcmUudGV4dENvbnRlbnQgPSAnJztcclxuXHJcblx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICdMb2FkaW5n4oCmJztcclxuXHJcblx0XHRcdFx0cHJlLmFwcGVuZENoaWxkKGNvZGUpO1xyXG5cclxuXHRcdFx0XHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcblxyXG5cdFx0XHRcdHhoci5vcGVuKCdHRVQnLCBzcmMsIHRydWUpO1xyXG5cclxuXHRcdFx0XHR4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0aWYgKHhoci5yZWFkeVN0YXRlID09IDQpIHtcclxuXHJcblx0XHRcdFx0XHRcdGlmICh4aHIuc3RhdHVzIDwgNDAwICYmIHhoci5yZXNwb25zZVRleHQpIHtcclxuXHRcdFx0XHRcdFx0XHRjb2RlLnRleHRDb250ZW50ID0geGhyLnJlc3BvbnNlVGV4dDtcclxuXHJcblx0XHRcdFx0XHRcdFx0UHJpc20uaGlnaGxpZ2h0RWxlbWVudChjb2RlKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRlbHNlIGlmICh4aHIuc3RhdHVzID49IDQwMCkge1xyXG5cdFx0XHRcdFx0XHRcdGNvZGUudGV4dENvbnRlbnQgPSAn4pyWIEVycm9yICcgKyB4aHIuc3RhdHVzICsgJyB3aGlsZSBmZXRjaGluZyBmaWxlOiAnICsgeGhyLnN0YXR1c1RleHQ7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0Y29kZS50ZXh0Q29udGVudCA9ICfinJYgRXJyb3I6IEZpbGUgZG9lcyBub3QgZXhpc3Qgb3IgaXMgZW1wdHknO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0eGhyLnNlbmQobnVsbCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG5cclxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgc2VsZi5QcmlzbS5maWxlSGlnaGxpZ2h0KTtcclxuXHJcbn0pKCk7XHJcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICB2YXIgYmFja2Ryb3BzO1xyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUJhY2tkcm9wRm9yU2xpZGUoc2xpZGUpIHtcclxuICAgICAgdmFyIGJhY2tkcm9wQXR0cmlidXRlID0gc2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtYmFja2Ryb3AnKTtcclxuXHJcbiAgICAgIGlmIChiYWNrZHJvcEF0dHJpYnV0ZSkge1xyXG4gICAgICAgIHZhciBiYWNrZHJvcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgIGJhY2tkcm9wLmNsYXNzTmFtZSA9IGJhY2tkcm9wQXR0cmlidXRlO1xyXG4gICAgICAgIGJhY2tkcm9wLmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYmFja2Ryb3AnKTtcclxuICAgICAgICBkZWNrLnBhcmVudC5hcHBlbmRDaGlsZChiYWNrZHJvcCk7XHJcbiAgICAgICAgcmV0dXJuIGJhY2tkcm9wO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlQ2xhc3NlcyhlbCkge1xyXG4gICAgICBpZiAoZWwpIHtcclxuICAgICAgICB2YXIgaW5kZXggPSBiYWNrZHJvcHMuaW5kZXhPZihlbCksXHJcbiAgICAgICAgICBjdXJyZW50SW5kZXggPSBkZWNrLnNsaWRlKCk7XHJcblxyXG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnYWN0aXZlJyk7XHJcbiAgICAgICAgcmVtb3ZlQ2xhc3MoZWwsICdpbmFjdGl2ZScpO1xyXG4gICAgICAgIHJlbW92ZUNsYXNzKGVsLCAnYmVmb3JlJyk7XHJcbiAgICAgICAgcmVtb3ZlQ2xhc3MoZWwsICdhZnRlcicpO1xyXG5cclxuICAgICAgICBpZiAoaW5kZXggIT09IGN1cnJlbnRJbmRleCkge1xyXG4gICAgICAgICAgYWRkQ2xhc3MoZWwsICdpbmFjdGl2ZScpO1xyXG4gICAgICAgICAgYWRkQ2xhc3MoZWwsIGluZGV4IDwgY3VycmVudEluZGV4ID8gJ2JlZm9yZScgOiAnYWZ0ZXInKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgYWRkQ2xhc3MoZWwsICdhY3RpdmUnKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiByZW1vdmVDbGFzcyhlbCwgY2xhc3NOYW1lKSB7XHJcbiAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2Jlc3Bva2UtYmFja2Ryb3AtJyArIGNsYXNzTmFtZSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gYWRkQ2xhc3MoZWwsIGNsYXNzTmFtZSkge1xyXG4gICAgICBlbC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJhY2tkcm9wLScgKyBjbGFzc05hbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGJhY2tkcm9wcyA9IGRlY2suc2xpZGVzXHJcbiAgICAgIC5tYXAoY3JlYXRlQmFja2Ryb3BGb3JTbGlkZSk7XHJcblxyXG4gICAgZGVjay5vbignYWN0aXZhdGUnLCBmdW5jdGlvbigpIHtcclxuICAgICAgYmFja2Ryb3BzLmZvckVhY2godXBkYXRlQ2xhc3Nlcyk7XHJcbiAgICB9KTtcclxuICB9O1xyXG59O1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcclxuICByZXR1cm4gZnVuY3Rpb24oZGVjaykge1xyXG4gICAgdmFyIGFjdGl2ZVNsaWRlSW5kZXgsXHJcbiAgICAgIGFjdGl2ZUJ1bGxldEluZGV4LFxyXG5cclxuICAgICAgYnVsbGV0cyA9IGRlY2suc2xpZGVzLm1hcChmdW5jdGlvbihzbGlkZSkge1xyXG4gICAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKHNsaWRlLnF1ZXJ5U2VsZWN0b3JBbGwoKHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiAnW2RhdGEtYmVzcG9rZS1idWxsZXRdJykpLCAwKTtcclxuICAgICAgfSksXHJcblxyXG4gICAgICBuZXh0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIG5leHRTbGlkZUluZGV4ID0gYWN0aXZlU2xpZGVJbmRleCArIDE7XHJcblxyXG4gICAgICAgIGlmIChhY3RpdmVTbGlkZUhhc0J1bGxldEJ5T2Zmc2V0KDEpKSB7XHJcbiAgICAgICAgICBhY3RpdmF0ZUJ1bGxldChhY3RpdmVTbGlkZUluZGV4LCBhY3RpdmVCdWxsZXRJbmRleCArIDEpO1xyXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoYnVsbGV0c1tuZXh0U2xpZGVJbmRleF0pIHtcclxuICAgICAgICAgIGFjdGl2YXRlQnVsbGV0KG5leHRTbGlkZUluZGV4LCAwKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBwcmV2ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIHByZXZTbGlkZUluZGV4ID0gYWN0aXZlU2xpZGVJbmRleCAtIDE7XHJcblxyXG4gICAgICAgIGlmIChhY3RpdmVTbGlkZUhhc0J1bGxldEJ5T2Zmc2V0KC0xKSkge1xyXG4gICAgICAgICAgYWN0aXZhdGVCdWxsZXQoYWN0aXZlU2xpZGVJbmRleCwgYWN0aXZlQnVsbGV0SW5kZXggLSAxKTtcclxuICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9IGVsc2UgaWYgKGJ1bGxldHNbcHJldlNsaWRlSW5kZXhdKSB7XHJcbiAgICAgICAgICBhY3RpdmF0ZUJ1bGxldChwcmV2U2xpZGVJbmRleCwgYnVsbGV0c1twcmV2U2xpZGVJbmRleF0ubGVuZ3RoIC0gMSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG5cclxuICAgICAgYWN0aXZhdGVCdWxsZXQgPSBmdW5jdGlvbihzbGlkZUluZGV4LCBidWxsZXRJbmRleCkge1xyXG4gICAgICAgIGFjdGl2ZVNsaWRlSW5kZXggPSBzbGlkZUluZGV4O1xyXG4gICAgICAgIGFjdGl2ZUJ1bGxldEluZGV4ID0gYnVsbGV0SW5kZXg7XHJcblxyXG4gICAgICAgIGJ1bGxldHMuZm9yRWFjaChmdW5jdGlvbihzbGlkZSwgcykge1xyXG4gICAgICAgICAgc2xpZGUuZm9yRWFjaChmdW5jdGlvbihidWxsZXQsIGIpIHtcclxuICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYnVsbGV0Jyk7XHJcblxyXG4gICAgICAgICAgICBpZiAocyA8IHNsaWRlSW5kZXggfHwgcyA9PT0gc2xpZGVJbmRleCAmJiBiIDw9IGJ1bGxldEluZGV4KSB7XHJcbiAgICAgICAgICAgICAgYnVsbGV0LmNsYXNzTGlzdC5hZGQoJ2Jlc3Bva2UtYnVsbGV0LWFjdGl2ZScpO1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZScpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QuYWRkKCdiZXNwb2tlLWJ1bGxldC1pbmFjdGl2ZScpO1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJ1bGxldC1hY3RpdmUnKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHMgPT09IHNsaWRlSW5kZXggJiYgYiA9PT0gYnVsbGV0SW5kZXgpIHtcclxuICAgICAgICAgICAgICBidWxsZXQuY2xhc3NMaXN0LmFkZCgnYmVzcG9rZS1idWxsZXQtY3VycmVudCcpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIGJ1bGxldC5jbGFzc0xpc3QucmVtb3ZlKCdiZXNwb2tlLWJ1bGxldC1jdXJyZW50Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9LFxyXG5cclxuICAgICAgYWN0aXZlU2xpZGVIYXNCdWxsZXRCeU9mZnNldCA9IGZ1bmN0aW9uKG9mZnNldCkge1xyXG4gICAgICAgIHJldHVybiBidWxsZXRzW2FjdGl2ZVNsaWRlSW5kZXhdW2FjdGl2ZUJ1bGxldEluZGV4ICsgb2Zmc2V0XSAhPT0gdW5kZWZpbmVkO1xyXG4gICAgICB9O1xyXG5cclxuICAgIGRlY2sub24oJ25leHQnLCBuZXh0KTtcclxuICAgIGRlY2sub24oJ3ByZXYnLCBwcmV2KTtcclxuXHJcbiAgICBkZWNrLm9uKCdzbGlkZScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgYWN0aXZhdGVCdWxsZXQoZS5pbmRleCwgMCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBhY3RpdmF0ZUJ1bGxldCgwLCAwKTtcclxuICB9O1xyXG59O1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICBkZWNrLnNsaWRlcy5mb3JFYWNoKGZ1bmN0aW9uKHNsaWRlKSB7XHJcbiAgICAgIHNsaWRlLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKC9JTlBVVHxURVhUQVJFQXxTRUxFQ1QvLnRlc3QoZS50YXJnZXQubm9kZU5hbWUpIHx8IGUudGFyZ2V0LmNvbnRlbnRFZGl0YWJsZSA9PT0gJ3RydWUnKSB7XHJcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9O1xyXG59O1xyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICB2YXIgYWN0aXZhdGVTbGlkZSA9IGZ1bmN0aW9uKGluZGV4KSB7XHJcbiAgICAgIHZhciBpbmRleFRvQWN0aXZhdGUgPSAtMSA8IGluZGV4ICYmIGluZGV4IDwgZGVjay5zbGlkZXMubGVuZ3RoID8gaW5kZXggOiAwO1xyXG4gICAgICBpZiAoaW5kZXhUb0FjdGl2YXRlICE9PSBkZWNrLnNsaWRlKCkpIHtcclxuICAgICAgICBkZWNrLnNsaWRlKGluZGV4VG9BY3RpdmF0ZSk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgdmFyIHBhcnNlSGFzaCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICB2YXIgaGFzaCA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnNsaWNlKDEpLFxyXG4gICAgICAgIHNsaWRlTnVtYmVyT3JOYW1lID0gcGFyc2VJbnQoaGFzaCwgMTApO1xyXG5cclxuICAgICAgaWYgKGhhc2gpIHtcclxuICAgICAgICBpZiAoc2xpZGVOdW1iZXJPck5hbWUpIHtcclxuICAgICAgICAgIGFjdGl2YXRlU2xpZGUoc2xpZGVOdW1iZXJPck5hbWUgLSAxKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgZGVjay5zbGlkZXMuZm9yRWFjaChmdW5jdGlvbihzbGlkZSwgaSkge1xyXG4gICAgICAgICAgICBpZiAoc2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtaGFzaCcpID09PSBoYXNoIHx8IHNsaWRlLmlkID09PSBoYXNoKSB7XHJcbiAgICAgICAgICAgICAgYWN0aXZhdGVTbGlkZShpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgIHBhcnNlSGFzaCgpO1xyXG5cclxuICAgICAgZGVjay5vbignYWN0aXZhdGUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgdmFyIHNsaWRlTmFtZSA9IGUuc2xpZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWJlc3Bva2UtaGFzaCcpIHx8IGUuc2xpZGUuaWQ7XHJcbiAgICAgICAgd2luZG93LmxvY2F0aW9uLmhhc2ggPSBzbGlkZU5hbWUgfHwgZS5pbmRleCArIDE7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2hhc2hjaGFuZ2UnLCBwYXJzZUhhc2gpO1xyXG4gICAgfSwgMCk7XHJcbiAgfTtcclxufTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcclxuICAgIHZhciBpc0hvcml6b250YWwgPSBvcHRpb25zICE9PSAndmVydGljYWwnO1xyXG5cclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGlmIChlLndoaWNoID09IDM0IHx8IC8vIFBBR0UgRE9XTlxyXG4gICAgICAgIChlLndoaWNoID09IDMyICYmICFlLnNoaWZ0S2V5KSB8fCAvLyBTUEFDRSBXSVRIT1VUIFNISUZUXHJcbiAgICAgICAgKGlzSG9yaXpvbnRhbCAmJiBlLndoaWNoID09IDM5KSB8fCAvLyBSSUdIVFxyXG4gICAgICAgICghaXNIb3Jpem9udGFsICYmIGUud2hpY2ggPT0gNDApIC8vIERPV05cclxuICAgICAgKSB7IGRlY2submV4dCgpOyB9XHJcblxyXG4gICAgICBpZiAoZS53aGljaCA9PSAzMyB8fCAvLyBQQUdFIFVQXHJcbiAgICAgICAgKGUud2hpY2ggPT0gMzIgJiYgZS5zaGlmdEtleSkgfHwgLy8gU1BBQ0UgKyBTSElGVFxyXG4gICAgICAgIChpc0hvcml6b250YWwgJiYgZS53aGljaCA9PSAzNykgfHwgLy8gTEVGVFxyXG4gICAgICAgICghaXNIb3Jpem9udGFsICYmIGUud2hpY2ggPT0gMzgpIC8vIFVQXHJcbiAgICAgICkgeyBkZWNrLnByZXYoKTsgfVxyXG4gICAgfSk7XHJcbiAgfTtcclxufTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uIChkZWNrKSB7XHJcbiAgICB2YXIgcHJvZ3Jlc3NQYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcclxuICAgICAgcHJvZ3Jlc3NCYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcclxuICAgICAgcHJvcCA9IG9wdGlvbnMgPT09ICd2ZXJ0aWNhbCcgPyAnaGVpZ2h0JyA6ICd3aWR0aCc7XHJcblxyXG4gICAgcHJvZ3Jlc3NQYXJlbnQuY2xhc3NOYW1lID0gJ2Jlc3Bva2UtcHJvZ3Jlc3MtcGFyZW50JztcclxuICAgIHByb2dyZXNzQmFyLmNsYXNzTmFtZSA9ICdiZXNwb2tlLXByb2dyZXNzLWJhcic7XHJcbiAgICBwcm9ncmVzc1BhcmVudC5hcHBlbmRDaGlsZChwcm9ncmVzc0Jhcik7XHJcbiAgICBkZWNrLnBhcmVudC5hcHBlbmRDaGlsZChwcm9ncmVzc1BhcmVudCk7XHJcblxyXG4gICAgZGVjay5vbignYWN0aXZhdGUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIHByb2dyZXNzQmFyLnN0eWxlW3Byb3BdID0gKGUuaW5kZXggKiAxMDAgLyAoZGVjay5zbGlkZXMubGVuZ3RoIC0gMSkpICsgJyUnO1xyXG4gICAgfSk7XHJcbiAgfTtcclxufTtcclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uKGRlY2spIHtcclxuICAgIHZhciBwYXJlbnQgPSBkZWNrLnBhcmVudCxcclxuICAgICAgZmlyc3RTbGlkZSA9IGRlY2suc2xpZGVzWzBdLFxyXG4gICAgICBzbGlkZUhlaWdodCA9IGZpcnN0U2xpZGUub2Zmc2V0SGVpZ2h0LFxyXG4gICAgICBzbGlkZVdpZHRoID0gZmlyc3RTbGlkZS5vZmZzZXRXaWR0aCxcclxuICAgICAgdXNlWm9vbSA9IG9wdGlvbnMgPT09ICd6b29tJyB8fCAoJ3pvb20nIGluIHBhcmVudC5zdHlsZSAmJiBvcHRpb25zICE9PSAndHJhbnNmb3JtJyksXHJcblxyXG4gICAgICB3cmFwID0gZnVuY3Rpb24oZWxlbWVudCkge1xyXG4gICAgICAgIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgd3JhcHBlci5jbGFzc05hbWUgPSAnYmVzcG9rZS1zY2FsZS1wYXJlbnQnO1xyXG4gICAgICAgIGVsZW1lbnQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUod3JhcHBlciwgZWxlbWVudCk7XHJcbiAgICAgICAgd3JhcHBlci5hcHBlbmRDaGlsZChlbGVtZW50KTtcclxuICAgICAgICByZXR1cm4gd3JhcHBlcjtcclxuICAgICAgfSxcclxuXHJcbiAgICAgIGVsZW1lbnRzID0gdXNlWm9vbSA/IGRlY2suc2xpZGVzIDogZGVjay5zbGlkZXMubWFwKHdyYXApLFxyXG5cclxuICAgICAgdHJhbnNmb3JtUHJvcGVydHkgPSAoZnVuY3Rpb24ocHJvcGVydHkpIHtcclxuICAgICAgICB2YXIgcHJlZml4ZXMgPSAnTW96IFdlYmtpdCBPIG1zJy5zcGxpdCgnICcpO1xyXG4gICAgICAgIHJldHVybiBwcmVmaXhlcy5yZWR1Y2UoZnVuY3Rpb24oY3VycmVudFByb3BlcnR5LCBwcmVmaXgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHByZWZpeCArIHByb3BlcnR5IGluIHBhcmVudC5zdHlsZSA/IHByZWZpeCArIHByb3BlcnR5IDogY3VycmVudFByb3BlcnR5O1xyXG4gICAgICAgICAgfSwgcHJvcGVydHkudG9Mb3dlckNhc2UoKSk7XHJcbiAgICAgIH0oJ1RyYW5zZm9ybScpKSxcclxuXHJcbiAgICAgIHNjYWxlID0gdXNlWm9vbSA/XHJcbiAgICAgICAgZnVuY3Rpb24ocmF0aW8sIGVsZW1lbnQpIHtcclxuICAgICAgICAgIGVsZW1lbnQuc3R5bGUuem9vbSA9IHJhdGlvO1xyXG4gICAgICAgIH0gOlxyXG4gICAgICAgIGZ1bmN0aW9uKHJhdGlvLCBlbGVtZW50KSB7XHJcbiAgICAgICAgICBlbGVtZW50LnN0eWxlW3RyYW5zZm9ybVByb3BlcnR5XSA9ICdzY2FsZSgnICsgcmF0aW8gKyAnKSc7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgIHNjYWxlQWxsID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIHhTY2FsZSA9IHBhcmVudC5vZmZzZXRXaWR0aCAvIHNsaWRlV2lkdGgsXHJcbiAgICAgICAgICB5U2NhbGUgPSBwYXJlbnQub2Zmc2V0SGVpZ2h0IC8gc2xpZGVIZWlnaHQ7XHJcblxyXG4gICAgICAgIGVsZW1lbnRzLmZvckVhY2goc2NhbGUuYmluZChudWxsLCBNYXRoLm1pbih4U2NhbGUsIHlTY2FsZSkpKTtcclxuICAgICAgfTtcclxuXHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgc2NhbGVBbGwpO1xyXG4gICAgc2NhbGVBbGwoKTtcclxuICB9O1xyXG5cclxufTtcclxuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuLyohIGJlc3Bva2UtdGhlbWUtYXRvbWFudGljIHYyLjEuNCDCqSAyMDE2IEFkYW0gRWl2eSwgTUlUIExpY2Vuc2UgKi9cclxuIWZ1bmN0aW9uKHQpe2lmKFwib2JqZWN0XCI9PXR5cGVvZiBleHBvcnRzJiZcInVuZGVmaW5lZFwiIT10eXBlb2YgbW9kdWxlKW1vZHVsZS5leHBvcnRzPXQoKTtlbHNlIGlmKFwiZnVuY3Rpb25cIj09dHlwZW9mIGRlZmluZSYmZGVmaW5lLmFtZClkZWZpbmUoW10sdCk7ZWxzZXt2YXIgZTtlPVwidW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3c/d2luZG93OlwidW5kZWZpbmVkXCIhPXR5cGVvZiBnbG9iYWw/Z2xvYmFsOlwidW5kZWZpbmVkXCIhPXR5cGVvZiBzZWxmP3NlbGY6dGhpcyxlPWUuYmVzcG9rZXx8KGUuYmVzcG9rZT17fSksZT1lLnRoZW1lc3x8KGUudGhlbWVzPXt9KSxlLmF0b21hbnRpYz10KCl9fShmdW5jdGlvbigpe3JldHVybiBmdW5jdGlvbiB0KGUsYSxuKXtmdW5jdGlvbiBvKGkscyl7aWYoIWFbaV0pe2lmKCFlW2ldKXt2YXIgbT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFzJiZtKXJldHVybiBtKGksITApO2lmKHIpcmV0dXJuIHIoaSwhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgcD1hW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHQpe3ZhciBhPWVbaV1bMV1bdF07cmV0dXJuIG8oYT9hOnQpfSxwLHAuZXhwb3J0cyx0LGUsYSxuKX1yZXR1cm4gYVtpXS5leHBvcnRzfWZvcih2YXIgcj1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPG4ubGVuZ3RoO2krKylvKG5baV0pO3JldHVybiBvfSh7MTpbZnVuY3Rpb24odCxlLGEpe3ZhciBuPXQoXCJiZXNwb2tlLWNsYXNzZXNcIiksbz10KFwiaW5zZXJ0LWNzc1wiKSxyPWZ1bmN0aW9uKHQpe3ZhciBlPXQuc2xpZGVzLm1hcChmdW5jdGlvbih0KXtyZXR1cm5bXS5zbGljZS5jYWxsKHQucXVlcnlTZWxlY3RvckFsbChcIngtZ2lmXCIpLDApfSksYT1mdW5jdGlvbih0KXtyZXR1cm4gZnVuY3Rpb24oYSl7ZVthLmluZGV4XS5tYXAoZnVuY3Rpb24oZSl7dD9lLnNldEF0dHJpYnV0ZShcInN0b3BwZWRcIixcIlwiKTplLnJlbW92ZUF0dHJpYnV0ZShcInN0b3BwZWRcIiksYS5zbGlkZS5jbGFzc0xpc3QucmVtb3ZlKFwieC1naWYtZmluaXNoZWRcIiksdHx8ZS5hZGRFdmVudExpc3RlbmVyKFwieC1naWYtZmluaXNoZWRcIixmdW5jdGlvbigpe2Euc2xpZGUuY2xhc3NMaXN0LmFkZChcIngtZ2lmLWZpbmlzaGVkXCIpfSl9KX19O3Qub24oXCJhY3RpdmF0ZVwiLGEoITEpKSx0Lm9uKFwiZGVhY3RpdmF0ZVwiLGEoITApKX0scz1mdW5jdGlvbih0KXt0Lm9uKFwiYWN0aXZhdGVcIixmdW5jdGlvbih0KXtBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHQuc2xpZGUucXVlcnlTZWxlY3RvckFsbChcIi5hbmltYXRlZFwiKXx8W10sZnVuY3Rpb24odCl7dC5vdXRlckhUTUw9dC5vdXRlckhUTUwucmVwbGFjZShcImFuaW1hdGVkXCIsXCJhbmltYXRlIGFuaW1hdGVkXCIpfSl9KX07aWYoZS5leHBvcnRzPWZ1bmN0aW9uKCl7dmFyIHQ9XCIvKiEgbm9ybWFsaXplLmNzcyB2My4wLjAgfCBNSVQgTGljZW5zZSB8IGdpdC5pby9ub3JtYWxpemUgKi9cXG5odG1se2ZvbnQtZmFtaWx5OnNhbnMtc2VyaWY7LW1zLXRleHQtc2l6ZS1hZGp1c3Q6MTAwJTstd2Via2l0LXRleHQtc2l6ZS1hZGp1c3Q6MTAwJX1ib2R5e21hcmdpbjowfWFydGljbGUsYXNpZGUsZGV0YWlscyxmaWdjYXB0aW9uLGZpZ3VyZSxmb290ZXIsaGVhZGVyLGhncm91cCxtYWluLG5hdixzZWN0aW9uLHN1bW1hcnl7ZGlzcGxheTpibG9ja31hdWRpbyxjYW52YXMscHJvZ3Jlc3MsdmlkZW97ZGlzcGxheTppbmxpbmUtYmxvY2s7dmVydGljYWwtYWxpZ246YmFzZWxpbmV9YXVkaW86bm90KFtjb250cm9sc10pe2Rpc3BsYXk6bm9uZTtoZWlnaHQ6MH1baGlkZGVuXSx0ZW1wbGF0ZXtkaXNwbGF5Om5vbmV9YXtiYWNrZ3JvdW5kOjAgMH1hOmFjdGl2ZSxhOmhvdmVye291dGxpbmU6MH1hYmJyW3RpdGxlXXtib3JkZXItYm90dG9tOjFweCBkb3R0ZWR9YixzdHJvbmd7Zm9udC13ZWlnaHQ6NzAwfWRmbntmb250LXN0eWxlOml0YWxpY31oMXtmb250LXNpemU6MmVtO21hcmdpbjouNjdlbSAwfW1hcmt7YmFja2dyb3VuZDojZmYwO2NvbG9yOiMwMDB9c21hbGx7Zm9udC1zaXplOjgwJX1zdWIsc3Vwe2ZvbnQtc2l6ZTo3NSU7bGluZS1oZWlnaHQ6MDtwb3NpdGlvbjpyZWxhdGl2ZTt2ZXJ0aWNhbC1hbGlnbjpiYXNlbGluZX1zdXB7dG9wOi0uNWVtfXN1Yntib3R0b206LS4yNWVtfWltZ3tib3JkZXI6MH1zdmc6bm90KDpyb290KXtvdmVyZmxvdzpoaWRkZW59ZmlndXJle21hcmdpbjoxZW0gNDBweH1ocntib3gtc2l6aW5nOmNvbnRlbnQtYm94O2hlaWdodDowfXByZXtvdmVyZmxvdzphdXRvfWNvZGUsa2JkLHByZSxzYW1we2ZvbnQtZmFtaWx5Om1vbm9zcGFjZSxtb25vc3BhY2U7Zm9udC1zaXplOjFlbX1idXR0b24saW5wdXQsb3B0Z3JvdXAsc2VsZWN0LHRleHRhcmVhe2NvbG9yOmluaGVyaXQ7Zm9udDppbmhlcml0O21hcmdpbjowfWJ1dHRvbntvdmVyZmxvdzp2aXNpYmxlfWJ1dHRvbixzZWxlY3R7dGV4dC10cmFuc2Zvcm06bm9uZX1idXR0b24saHRtbCBpbnB1dFt0eXBlPWJ1dHRvbl0saW5wdXRbdHlwZT1yZXNldF0saW5wdXRbdHlwZT1zdWJtaXRdey13ZWJraXQtYXBwZWFyYW5jZTpidXR0b247Y3Vyc29yOnBvaW50ZXJ9YnV0dG9uW2Rpc2FibGVkXSxodG1sIGlucHV0W2Rpc2FibGVkXXtjdXJzb3I6ZGVmYXVsdH1idXR0b246Oi1tb3otZm9jdXMtaW5uZXIsaW5wdXQ6Oi1tb3otZm9jdXMtaW5uZXJ7Ym9yZGVyOjA7cGFkZGluZzowfWlucHV0e2xpbmUtaGVpZ2h0Om5vcm1hbH1pbnB1dFt0eXBlPWNoZWNrYm94XSxpbnB1dFt0eXBlPXJhZGlvXXtib3gtc2l6aW5nOmJvcmRlci1ib3g7cGFkZGluZzowfWlucHV0W3R5cGU9bnVtYmVyXTo6LXdlYmtpdC1pbm5lci1zcGluLWJ1dHRvbixpbnB1dFt0eXBlPW51bWJlcl06Oi13ZWJraXQtb3V0ZXItc3Bpbi1idXR0b257aGVpZ2h0OmF1dG99aW5wdXRbdHlwZT1zZWFyY2hdey13ZWJraXQtYXBwZWFyYW5jZTp0ZXh0ZmllbGQ7Ym94LXNpemluZzpjb250ZW50LWJveH1pbnB1dFt0eXBlPXNlYXJjaF06Oi13ZWJraXQtc2VhcmNoLWNhbmNlbC1idXR0b24saW5wdXRbdHlwZT1zZWFyY2hdOjotd2Via2l0LXNlYXJjaC1kZWNvcmF0aW9uey13ZWJraXQtYXBwZWFyYW5jZTpub25lfWZpZWxkc2V0e2JvcmRlcjoxcHggc29saWQgc2lsdmVyO21hcmdpbjowIDJweDtwYWRkaW5nOi4zNWVtIC42MjVlbSAuNzVlbX1sZWdlbmR7Ym9yZGVyOjB9dGV4dGFyZWF7b3ZlcmZsb3c6YXV0b31vcHRncm91cHtmb250LXdlaWdodDo3MDB9dGFibGV7Ym9yZGVyLWNvbGxhcHNlOmNvbGxhcHNlO2JvcmRlci1zcGFjaW5nOjB9bGVnZW5kLHRkLHRoe3BhZGRpbmc6MH1cXG4vKiFcXG4gKiBhbmltYXRlLmNzcyAtaHR0cDovL2RhbmVkZW4ubWUvYW5pbWF0ZVxcbiAqIFZlcnNpb24gLSAzLjUuMVxcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZSAtIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcXG4gKlxcbiAqIENvcHlyaWdodCAoYykgMjAxNiBEYW5pZWwgRWRlblxcbiAqL1xcbi5hbmltYXRlZHthbmltYXRpb24tZHVyYXRpb246MXM7YW5pbWF0aW9uLWZpbGwtbW9kZTpib3RofS5hbmltYXRlZC5pbmZpbml0ZXthbmltYXRpb24taXRlcmF0aW9uLWNvdW50OmluZmluaXRlfS5hbmltYXRlZC5oaW5nZXthbmltYXRpb24tZHVyYXRpb246MnN9LmFuaW1hdGVkLmJvdW5jZUluLC5hbmltYXRlZC5ib3VuY2VPdXQsLmFuaW1hdGVkLmZsaXBPdXRYLC5hbmltYXRlZC5mbGlwT3V0WXthbmltYXRpb24tZHVyYXRpb246Ljc1c31Aa2V5ZnJhbWVzIGJvdW5jZXswJSwyMCUsNTMlLDgwJSx0b3thbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguMjE1LC42MSwuMzU1LDEpO3RyYW5zZm9ybTp0cmFuc2xhdGVaKDApfTQwJSw0MyV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTMwcHgsMCl9NDAlLDQzJSw3MCV7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjc1NSwuMDUsLjg1NSwuMDYpfTcwJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMTVweCwwKX05MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTRweCwwKX19LmJvdW5jZXthbmltYXRpb24tbmFtZTpib3VuY2U7dHJhbnNmb3JtLW9yaWdpbjpjZW50ZXIgYm90dG9tfUBrZXlmcmFtZXMgZmxhc2h7MCUsNTAlLHRve29wYWNpdHk6MX0yNSUsNzUle29wYWNpdHk6MH19LmZsYXNoe2FuaW1hdGlvbi1uYW1lOmZsYXNofUBrZXlmcmFtZXMgcHVsc2V7MCUsdG97dHJhbnNmb3JtOnNjYWxlWCgxKX01MCV7dHJhbnNmb3JtOnNjYWxlM2QoMS4wNSwxLjA1LDEuMDUpfX0ucHVsc2V7YW5pbWF0aW9uLW5hbWU6cHVsc2V9QGtleWZyYW1lcyBydWJiZXJCYW5kezAlLHRve3RyYW5zZm9ybTpzY2FsZVgoMSl9MzAle3RyYW5zZm9ybTpzY2FsZTNkKDEuMjUsLjc1LDEpfTQwJXt0cmFuc2Zvcm06c2NhbGUzZCguNzUsMS4yNSwxKX01MCV7dHJhbnNmb3JtOnNjYWxlM2QoMS4xNSwuODUsMSl9NjUle3RyYW5zZm9ybTpzY2FsZTNkKC45NSwxLjA1LDEpfTc1JXt0cmFuc2Zvcm06c2NhbGUzZCgxLjA1LC45NSwxKX19LnJ1YmJlckJhbmR7YW5pbWF0aW9uLW5hbWU6cnViYmVyQmFuZH1Aa2V5ZnJhbWVzIHNoYWtlezAlLHRve3RyYW5zZm9ybTp0cmFuc2xhdGVaKDApfTEwJSwzMCUsNTAlLDcwJSw5MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xMHB4LDAsMCl9MjAlLDQwJSw2MCUsODAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgxMHB4LDAsMCl9fS5zaGFrZXthbmltYXRpb24tbmFtZTpzaGFrZX1Aa2V5ZnJhbWVzIGhlYWRTaGFrZXswJSw1MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoMCl9Ni41JXt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtNnB4KSByb3RhdGVZKC05ZGVnKX0xOC41JXt0cmFuc2Zvcm06dHJhbnNsYXRlWCg1cHgpIHJvdGF0ZVkoN2RlZyl9MzEuNSV7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTNweCkgcm90YXRlWSgtNWRlZyl9NDMuNSV7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoMnB4KSByb3RhdGVZKDNkZWcpfX0uaGVhZFNoYWtle2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbi1vdXQ7YW5pbWF0aW9uLW5hbWU6aGVhZFNoYWtlfUBrZXlmcmFtZXMgc3dpbmd7MjAle3RyYW5zZm9ybTpyb3RhdGUoMTVkZWcpfTQwJXt0cmFuc2Zvcm06cm90YXRlKC0xMGRlZyl9NjAle3RyYW5zZm9ybTpyb3RhdGUoNWRlZyl9ODAle3RyYW5zZm9ybTpyb3RhdGUoLTVkZWcpfXRve3RyYW5zZm9ybTpyb3RhdGUoMGRlZyl9fS5zd2luZ3t0cmFuc2Zvcm0tb3JpZ2luOnRvcCBjZW50ZXI7YW5pbWF0aW9uLW5hbWU6c3dpbmd9QGtleWZyYW1lcyB0YWRhezAlLHRve3RyYW5zZm9ybTpzY2FsZVgoMSl9MTAlLDIwJXt0cmFuc2Zvcm06c2NhbGUzZCguOSwuOSwuOSkgcm90YXRlKC0zZGVnKX0zMCUsNTAlLDcwJSw5MCV7dHJhbnNmb3JtOnNjYWxlM2QoMS4xLDEuMSwxLjEpIHJvdGF0ZSgzZGVnKX00MCUsNjAlLDgwJXt0cmFuc2Zvcm06c2NhbGUzZCgxLjEsMS4xLDEuMSkgcm90YXRlKC0zZGVnKX19LnRhZGF7YW5pbWF0aW9uLW5hbWU6dGFkYX1Aa2V5ZnJhbWVzIHdvYmJsZXswJSx0b3t0cmFuc2Zvcm06bm9uZX0xNSV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0yNSUsMCwwKSByb3RhdGUoLTVkZWcpfTMwJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMjAlLDAsMCkgcm90YXRlKDNkZWcpfTQ1JXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTE1JSwwLDApIHJvdGF0ZSgtM2RlZyl9NjAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgxMCUsMCwwKSByb3RhdGUoMmRlZyl9NzUle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtNSUsMCwwKSByb3RhdGUoLTFkZWcpfX0ud29iYmxle2FuaW1hdGlvbi1uYW1lOndvYmJsZX1Aa2V5ZnJhbWVzIGplbGxvezAlLDExLjElLHRve3RyYW5zZm9ybTpub25lfTIyLjIle3RyYW5zZm9ybTpza2V3WCgtMTIuNWRlZykgc2tld1koLTEyLjVkZWcpfTMzLjMle3RyYW5zZm9ybTpza2V3WCg2LjI1ZGVnKSBza2V3WSg2LjI1ZGVnKX00NC40JXt0cmFuc2Zvcm06c2tld1goLTMuMTI1ZGVnKSBza2V3WSgtMy4xMjVkZWcpfTU1LjUle3RyYW5zZm9ybTpza2V3WCgxLjU2MjVkZWcpIHNrZXdZKDEuNTYyNWRlZyl9NjYuNiV7dHJhbnNmb3JtOnNrZXdYKC0uNzgxMjVkZWcpIHNrZXdZKC0uNzgxMjVkZWcpfTc3Ljcle3RyYW5zZm9ybTpza2V3WCguMzkwNjI1ZGVnKSBza2V3WSguMzkwNjI1ZGVnKX04OC44JXt0cmFuc2Zvcm06c2tld1goLS4xOTUzMTI1ZGVnKSBza2V3WSgtLjE5NTMxMjVkZWcpfX0uamVsbG97YW5pbWF0aW9uLW5hbWU6amVsbG87dHJhbnNmb3JtLW9yaWdpbjpjZW50ZXJ9QGtleWZyYW1lcyBib3VuY2VJbnswJSwyMCUsNDAlLDYwJSw4MCUsdG97YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjIxNSwuNjEsLjM1NSwxKX0wJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlM2QoLjMsLjMsLjMpfTIwJXt0cmFuc2Zvcm06c2NhbGUzZCgxLjEsMS4xLDEuMSl9NDAle3RyYW5zZm9ybTpzY2FsZTNkKC45LC45LC45KX02MCV7b3BhY2l0eToxO3RyYW5zZm9ybTpzY2FsZTNkKDEuMDMsMS4wMywxLjAzKX04MCV7dHJhbnNmb3JtOnNjYWxlM2QoLjk3LC45NywuOTcpfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGVYKDEpfX0uYm91bmNlSW57YW5pbWF0aW9uLW5hbWU6Ym91bmNlSW59QGtleWZyYW1lcyBib3VuY2VJbkRvd257MCUsNjAlLDc1JSw5MCUsdG97YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjIxNSwuNjEsLjM1NSwxKX0wJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsLTMwMDBweCwwKX02MCV7b3BhY2l0eToxO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDI1cHgsMCl9NzUle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLC0xMHB4LDApfTkwJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCw1cHgsMCl9dG97dHJhbnNmb3JtOm5vbmV9fS5ib3VuY2VJbkRvd257YW5pbWF0aW9uLW5hbWU6Ym91bmNlSW5Eb3dufUBrZXlmcmFtZXMgYm91bmNlSW5MZWZ0ezAlLDYwJSw3NSUsOTAlLHRve2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4yMTUsLjYxLC4zNTUsMSl9MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMzAwMHB4LDAsMCl9NjAle29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMjVweCwwLDApfTc1JXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTEwcHgsMCwwKX05MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDVweCwwLDApfXRve3RyYW5zZm9ybTpub25lfX0uYm91bmNlSW5MZWZ0e2FuaW1hdGlvbi1uYW1lOmJvdW5jZUluTGVmdH1Aa2V5ZnJhbWVzIGJvdW5jZUluUmlnaHR7MCUsNjAlLDc1JSw5MCUsdG97YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjIxNSwuNjEsLjM1NSwxKX0wJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDMwMDBweCwwLDApfTYwJXtvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0yNXB4LDAsMCl9NzUle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgxMHB4LDAsMCl9OTAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtNXB4LDAsMCl9dG97dHJhbnNmb3JtOm5vbmV9fS5ib3VuY2VJblJpZ2h0e2FuaW1hdGlvbi1uYW1lOmJvdW5jZUluUmlnaHR9QGtleWZyYW1lcyBib3VuY2VJblVwezAlLDYwJSw3NSUsOTAlLHRve2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4yMTUsLjYxLC4zNTUsMSl9MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDMwMDBweCwwKX02MCV7b3BhY2l0eToxO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLC0yMHB4LDApfTc1JXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwxMHB4LDApfTkwJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtNXB4LDApfXRve3RyYW5zZm9ybTp0cmFuc2xhdGVaKDApfX0uYm91bmNlSW5VcHthbmltYXRpb24tbmFtZTpib3VuY2VJblVwfUBrZXlmcmFtZXMgYm91bmNlT3V0ezIwJXt0cmFuc2Zvcm06c2NhbGUzZCguOSwuOSwuOSl9NTAlLDU1JXtvcGFjaXR5OjE7dHJhbnNmb3JtOnNjYWxlM2QoMS4xLDEuMSwxLjEpfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06c2NhbGUzZCguMywuMywuMyl9fS5ib3VuY2VPdXR7YW5pbWF0aW9uLW5hbWU6Ym91bmNlT3V0fUBrZXlmcmFtZXMgYm91bmNlT3V0RG93bnsyMCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMTBweCwwKX00MCUsNDUle29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMjBweCwwKX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMjAwMHB4LDApfX0uYm91bmNlT3V0RG93bnthbmltYXRpb24tbmFtZTpib3VuY2VPdXREb3dufUBrZXlmcmFtZXMgYm91bmNlT3V0TGVmdHsyMCV7b3BhY2l0eToxO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgyMHB4LDAsMCl9dG97b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMjAwMHB4LDAsMCl9fS5ib3VuY2VPdXRMZWZ0e2FuaW1hdGlvbi1uYW1lOmJvdW5jZU91dExlZnR9QGtleWZyYW1lcyBib3VuY2VPdXRSaWdodHsyMCV7b3BhY2l0eToxO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMjBweCwwLDApfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMjAwMHB4LDAsMCl9fS5ib3VuY2VPdXRSaWdodHthbmltYXRpb24tbmFtZTpib3VuY2VPdXRSaWdodH1Aa2V5ZnJhbWVzIGJvdW5jZU91dFVwezIwJXt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMTBweCwwKX00MCUsNDUle29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwyMHB4LDApfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMjAwMHB4LDApfX0uYm91bmNlT3V0VXB7YW5pbWF0aW9uLW5hbWU6Ym91bmNlT3V0VXB9QGtleWZyYW1lcyBmYWRlSW57MCV7b3BhY2l0eTowfXRve29wYWNpdHk6MX19LmZhZGVJbnthbmltYXRpb24tbmFtZTpmYWRlSW59QGtleWZyYW1lcyBmYWRlSW5Eb3duezAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMTAwJSwwKX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9fS5mYWRlSW5Eb3due2FuaW1hdGlvbi1uYW1lOmZhZGVJbkRvd259QGtleWZyYW1lcyBmYWRlSW5Eb3duQmlnezAle29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMjAwMHB4LDApfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX19LmZhZGVJbkRvd25CaWd7YW5pbWF0aW9uLW5hbWU6ZmFkZUluRG93bkJpZ31Aa2V5ZnJhbWVzIGZhZGVJbkxlZnR7MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMTAwJSwwLDApfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX19LmZhZGVJbkxlZnR7YW5pbWF0aW9uLW5hbWU6ZmFkZUluTGVmdH1Aa2V5ZnJhbWVzIGZhZGVJbkxlZnRCaWd7MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgtMjAwMHB4LDAsMCl9dG97b3BhY2l0eToxO3RyYW5zZm9ybTpub25lfX0uZmFkZUluTGVmdEJpZ3thbmltYXRpb24tbmFtZTpmYWRlSW5MZWZ0QmlnfUBrZXlmcmFtZXMgZmFkZUluUmlnaHR7MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgxMDAlLDAsMCl9dG97b3BhY2l0eToxO3RyYW5zZm9ybTpub25lfX0uZmFkZUluUmlnaHR7YW5pbWF0aW9uLW5hbWU6ZmFkZUluUmlnaHR9QGtleWZyYW1lcyBmYWRlSW5SaWdodEJpZ3swJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDIwMDBweCwwLDApfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX19LmZhZGVJblJpZ2h0Qmlne2FuaW1hdGlvbi1uYW1lOmZhZGVJblJpZ2h0QmlnfUBrZXlmcmFtZXMgZmFkZUluVXB7MCV7b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDEwMCUsMCl9dG97b3BhY2l0eToxO3RyYW5zZm9ybTpub25lfX0uZmFkZUluVXB7YW5pbWF0aW9uLW5hbWU6ZmFkZUluVXB9QGtleWZyYW1lcyBmYWRlSW5VcEJpZ3swJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDAsMjAwMHB4LDApfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX19LmZhZGVJblVwQmlne2FuaW1hdGlvbi1uYW1lOmZhZGVJblVwQmlnfUBrZXlmcmFtZXMgZmFkZU91dHswJXtvcGFjaXR5OjF9dG97b3BhY2l0eTowfX0uZmFkZU91dHthbmltYXRpb24tbmFtZTpmYWRlT3V0fUBrZXlmcmFtZXMgZmFkZU91dERvd257MCV7b3BhY2l0eToxfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwxMDAlLDApfX0uZmFkZU91dERvd257YW5pbWF0aW9uLW5hbWU6ZmFkZU91dERvd259QGtleWZyYW1lcyBmYWRlT3V0RG93bkJpZ3swJXtvcGFjaXR5OjF9dG97b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDIwMDBweCwwKX19LmZhZGVPdXREb3duQmlne2FuaW1hdGlvbi1uYW1lOmZhZGVPdXREb3duQmlnfUBrZXlmcmFtZXMgZmFkZU91dExlZnR7MCV7b3BhY2l0eToxfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTEwMCUsMCwwKX19LmZhZGVPdXRMZWZ0e2FuaW1hdGlvbi1uYW1lOmZhZGVPdXRMZWZ0fUBrZXlmcmFtZXMgZmFkZU91dExlZnRCaWd7MCV7b3BhY2l0eToxfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTIwMDBweCwwLDApfX0uZmFkZU91dExlZnRCaWd7YW5pbWF0aW9uLW5hbWU6ZmFkZU91dExlZnRCaWd9QGtleWZyYW1lcyBmYWRlT3V0UmlnaHR7MCV7b3BhY2l0eToxfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTAwJSwwLDApfX0uZmFkZU91dFJpZ2h0e2FuaW1hdGlvbi1uYW1lOmZhZGVPdXRSaWdodH1Aa2V5ZnJhbWVzIGZhZGVPdXRSaWdodEJpZ3swJXtvcGFjaXR5OjF9dG97b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgyMDAwcHgsMCwwKX19LmZhZGVPdXRSaWdodEJpZ3thbmltYXRpb24tbmFtZTpmYWRlT3V0UmlnaHRCaWd9QGtleWZyYW1lcyBmYWRlT3V0VXB7MCV7b3BhY2l0eToxfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMTAwJSwwKX19LmZhZGVPdXRVcHthbmltYXRpb24tbmFtZTpmYWRlT3V0VXB9QGtleWZyYW1lcyBmYWRlT3V0VXBCaWd7MCV7b3BhY2l0eToxfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwtMjAwMHB4LDApfX0uZmFkZU91dFVwQmlne2FuaW1hdGlvbi1uYW1lOmZhZGVPdXRVcEJpZ31Aa2V5ZnJhbWVzIGZsaXB7MCV7dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVZKC0xdHVybik7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLW91dH00MCV7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLW91dDt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHRyYW5zbGF0ZVooMTUwcHgpIHJvdGF0ZVkoLTE5MGRlZyl9NTAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgdHJhbnNsYXRlWigxNTBweCkgcm90YXRlWSgtMTcwZGVnKTthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmVhc2UtaW59ODAle2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbjt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHNjYWxlM2QoLjk1LC45NSwuOTUpfXRve3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWlufX0uYW5pbWF0ZWQuZmxpcHstd2Via2l0LWJhY2tmYWNlLXZpc2liaWxpdHk6dmlzaWJsZTtiYWNrZmFjZS12aXNpYmlsaXR5OnZpc2libGU7YW5pbWF0aW9uLW5hbWU6ZmxpcH1Aa2V5ZnJhbWVzIGZsaXBJblh7MCV7dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVYKDkwZGVnKTtvcGFjaXR5OjA7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWlufTQwJXthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmVhc2UtaW47dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVYKC0yMGRlZyl9NjAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWCgxMGRlZyk7b3BhY2l0eToxfTgwJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHJvdGF0ZVgoLTVkZWcpfXRve3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCl9fS5mbGlwSW5YLC5mbGlwSW5ZLC5mbGlwT3V0WCwuZmxpcE91dFl7LXdlYmtpdC1iYWNrZmFjZS12aXNpYmlsaXR5OnZpc2libGUhaW1wb3J0YW50O2JhY2tmYWNlLXZpc2liaWxpdHk6dmlzaWJsZSFpbXBvcnRhbnQ7YW5pbWF0aW9uLW5hbWU6ZmxpcEluWH1Aa2V5ZnJhbWVzIGZsaXBJbll7MCV7dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVZKDkwZGVnKTtvcGFjaXR5OjA7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWlufTQwJXthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmVhc2UtaW47dHJhbnNmb3JtOnBlcnNwZWN0aXZlKDQwMHB4KSByb3RhdGVZKC0yMGRlZyl9NjAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWSgxMGRlZyk7b3BhY2l0eToxfTgwJXt0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHJvdGF0ZVkoLTVkZWcpfXRve3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCl9fS5mbGlwSW5ZLC5mbGlwT3V0WCwuZmxpcE91dFl7YW5pbWF0aW9uLW5hbWU6ZmxpcEluWX1Aa2V5ZnJhbWVzIGZsaXBPdXRYezAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCl9MzAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWCgtMjBkZWcpO29wYWNpdHk6MX10b3t0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHJvdGF0ZVgoOTBkZWcpO29wYWNpdHk6MH19LmZsaXBPdXRYLC5mbGlwT3V0WXthbmltYXRpb24tbmFtZTpmbGlwT3V0WH1Aa2V5ZnJhbWVzIGZsaXBPdXRZezAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCl9MzAle3RyYW5zZm9ybTpwZXJzcGVjdGl2ZSg0MDBweCkgcm90YXRlWSgtMTVkZWcpO29wYWNpdHk6MX10b3t0cmFuc2Zvcm06cGVyc3BlY3RpdmUoNDAwcHgpIHJvdGF0ZVkoOTBkZWcpO29wYWNpdHk6MH19LmZsaXBPdXRZe2FuaW1hdGlvbi1uYW1lOmZsaXBPdXRZfUBrZXlmcmFtZXMgbGlnaHRTcGVlZEluezAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgxMDAlLDAsMCkgc2tld1goLTMwZGVnKTtvcGFjaXR5OjB9NjAle3RyYW5zZm9ybTpza2V3WCgyMGRlZyk7b3BhY2l0eToxfTgwJXtvcGFjaXR5OjE7dHJhbnNmb3JtOnNrZXdYKC01ZGVnKX10b3t0cmFuc2Zvcm06bm9uZTtvcGFjaXR5OjF9fS5saWdodFNwZWVkSW57YW5pbWF0aW9uLW5hbWU6bGlnaHRTcGVlZEluO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1vdXR9QGtleWZyYW1lcyBsaWdodFNwZWVkT3V0ezAle29wYWNpdHk6MX10b3t0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMTAwJSwwLDApIHNrZXdYKDMwZGVnKTtvcGFjaXR5OjB9fS5saWdodFNwZWVkT3V0e2FuaW1hdGlvbi1uYW1lOmxpZ2h0U3BlZWRPdXQ7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWlufUBrZXlmcmFtZXMgcm90YXRlSW57MCV7dHJhbnNmb3JtLW9yaWdpbjpjZW50ZXI7dHJhbnNmb3JtOnJvdGF0ZSgtMjAwZGVnKTtvcGFjaXR5OjA7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOmNlbnRlcn10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46Y2VudGVyO3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyO3RyYW5zZm9ybTpub25lO29wYWNpdHk6MX19LnJvdGF0ZUlue2FuaW1hdGlvbi1uYW1lOnJvdGF0ZUlufUBrZXlmcmFtZXMgcm90YXRlSW5Eb3duTGVmdHswJXt0cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tO3RyYW5zZm9ybTpyb3RhdGUoLTQ1ZGVnKTtvcGFjaXR5OjA7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tfXRvey13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tO3RyYW5zZm9ybTpub25lO29wYWNpdHk6MX19LnJvdGF0ZUluRG93bkxlZnR7YW5pbWF0aW9uLW5hbWU6cm90YXRlSW5Eb3duTGVmdH1Aa2V5ZnJhbWVzIHJvdGF0ZUluRG93blJpZ2h0ezAle3RyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybTpyb3RhdGUoNDVkZWcpO29wYWNpdHk6MDstd2Via2l0LXRyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tfXRvey13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpyaWdodCBib3R0b207dHJhbnNmb3JtLW9yaWdpbjpyaWdodCBib3R0b207dHJhbnNmb3JtOm5vbmU7b3BhY2l0eToxfX0ucm90YXRlSW5Eb3duUmlnaHR7YW5pbWF0aW9uLW5hbWU6cm90YXRlSW5Eb3duUmlnaHR9QGtleWZyYW1lcyByb3RhdGVJblVwTGVmdHswJXt0cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tO3RyYW5zZm9ybTpyb3RhdGUoNDVkZWcpO29wYWNpdHk6MDstd2Via2l0LXRyYW5zZm9ybS1vcmlnaW46bGVmdCBib3R0b219dG97LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tO3RyYW5zZm9ybS1vcmlnaW46bGVmdCBib3R0b207dHJhbnNmb3JtOm5vbmU7b3BhY2l0eToxfX0ucm90YXRlSW5VcExlZnR7YW5pbWF0aW9uLW5hbWU6cm90YXRlSW5VcExlZnR9QGtleWZyYW1lcyByb3RhdGVJblVwUmlnaHR7MCV7dHJhbnNmb3JtLW9yaWdpbjpyaWdodCBib3R0b207dHJhbnNmb3JtOnJvdGF0ZSgtOTBkZWcpO29wYWNpdHk6MDstd2Via2l0LXRyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tfXRvey13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpyaWdodCBib3R0b207dHJhbnNmb3JtLW9yaWdpbjpyaWdodCBib3R0b207dHJhbnNmb3JtOm5vbmU7b3BhY2l0eToxfX0ucm90YXRlSW5VcFJpZ2h0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZUluVXBSaWdodH1Aa2V5ZnJhbWVzIHJvdGF0ZU91dHswJXt0cmFuc2Zvcm0tb3JpZ2luOmNlbnRlcjtvcGFjaXR5OjE7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOmNlbnRlcn10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46Y2VudGVyO3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyO3RyYW5zZm9ybTpyb3RhdGUoMjAwZGVnKTtvcGFjaXR5OjB9fS5yb3RhdGVPdXR7YW5pbWF0aW9uLW5hbWU6cm90YXRlT3V0fUBrZXlmcmFtZXMgcm90YXRlT3V0RG93bkxlZnR7MCV7dHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTtvcGFjaXR5OjE7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tfXRvey13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tO3RyYW5zZm9ybTpyb3RhdGUoNDVkZWcpO29wYWNpdHk6MH19LnJvdGF0ZU91dERvd25MZWZ0e2FuaW1hdGlvbi1uYW1lOnJvdGF0ZU91dERvd25MZWZ0fUBrZXlmcmFtZXMgcm90YXRlT3V0RG93blJpZ2h0ezAle3RyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO29wYWNpdHk6MTstd2Via2l0LXRyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tfXRvey13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpyaWdodCBib3R0b207dHJhbnNmb3JtLW9yaWdpbjpyaWdodCBib3R0b207dHJhbnNmb3JtOnJvdGF0ZSgtNDVkZWcpO29wYWNpdHk6MH19LnJvdGF0ZU91dERvd25SaWdodHthbmltYXRpb24tbmFtZTpyb3RhdGVPdXREb3duUmlnaHR9QGtleWZyYW1lcyByb3RhdGVPdXRVcExlZnR7MCV7dHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTtvcGFjaXR5OjE7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tfXRvey13ZWJraXQtdHJhbnNmb3JtLW9yaWdpbjpsZWZ0IGJvdHRvbTt0cmFuc2Zvcm0tb3JpZ2luOmxlZnQgYm90dG9tO3RyYW5zZm9ybTpyb3RhdGUoLTQ1ZGVnKTtvcGFjaXR5OjB9fS5yb3RhdGVPdXRVcExlZnR7YW5pbWF0aW9uLW5hbWU6cm90YXRlT3V0VXBMZWZ0fUBrZXlmcmFtZXMgcm90YXRlT3V0VXBSaWdodHswJXt0cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbTtvcGFjaXR5OjE7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOnJpZ2h0IGJvdHRvbX10b3std2Via2l0LXRyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybS1vcmlnaW46cmlnaHQgYm90dG9tO3RyYW5zZm9ybTpyb3RhdGUoOTBkZWcpO29wYWNpdHk6MH19LnJvdGF0ZU91dFVwUmlnaHR7YW5pbWF0aW9uLW5hbWU6cm90YXRlT3V0VXBSaWdodH1Aa2V5ZnJhbWVzIGhpbmdlezAle3RyYW5zZm9ybS1vcmlnaW46dG9wIGxlZnQ7LXdlYmtpdC10cmFuc2Zvcm0tb3JpZ2luOnRvcCBsZWZ0O2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246ZWFzZS1pbi1vdXR9MjAlLDYwJXstd2Via2l0LXRyYW5zZm9ybS1vcmlnaW46dG9wIGxlZnQ7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjplYXNlLWluLW91dDt0cmFuc2Zvcm06cm90YXRlKDgwZGVnKTt0cmFuc2Zvcm0tb3JpZ2luOnRvcCBsZWZ0fTQwJSw4MCV7dHJhbnNmb3JtOnJvdGF0ZSg2MGRlZyk7dHJhbnNmb3JtLW9yaWdpbjp0b3AgbGVmdDthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmVhc2UtaW4tb3V0O29wYWNpdHk6MX10b3t0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCw3MDBweCwwKTtvcGFjaXR5OjB9fS5oaW5nZXthbmltYXRpb24tbmFtZTpoaW5nZX1Aa2V5ZnJhbWVzIHJvbGxJbnswJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xMDAlLDAsMCkgcm90YXRlKC0xMjBkZWcpfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX19LnJvbGxJbnthbmltYXRpb24tbmFtZTpyb2xsSW59QGtleWZyYW1lcyByb2xsT3V0ezAle29wYWNpdHk6MX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDEwMCUsMCwwKSByb3RhdGUoMTIwZGVnKX19LnJvbGxPdXR7YW5pbWF0aW9uLW5hbWU6cm9sbE91dH1Aa2V5ZnJhbWVzIHpvb21JbnswJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlM2QoLjMsLjMsLjMpfTUwJXtvcGFjaXR5OjF9fS56b29tSW57YW5pbWF0aW9uLW5hbWU6em9vbUlufUBrZXlmcmFtZXMgem9vbUluRG93bnswJXtvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlM2QoLjEsLjEsLjEpIHRyYW5zbGF0ZTNkKDAsLTEwMDBweCwwKTthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguNTUsLjA1NSwuNjc1LC4xOSl9NjAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCguNDc1LC40NzUsLjQ3NSkgdHJhbnNsYXRlM2QoMCw2MHB4LDApO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC4xNzUsLjg4NSwuMzIsMSl9fS56b29tSW5Eb3due2FuaW1hdGlvbi1uYW1lOnpvb21JbkRvd259QGtleWZyYW1lcyB6b29tSW5MZWZ0ezAle29wYWNpdHk6MDt0cmFuc2Zvcm06c2NhbGUzZCguMSwuMSwuMSkgdHJhbnNsYXRlM2QoLTEwMDBweCwwLDApO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC41NSwuMDU1LC42NzUsLjE5KX02MCV7b3BhY2l0eToxO3RyYW5zZm9ybTpzY2FsZTNkKC40NzUsLjQ3NSwuNDc1KSB0cmFuc2xhdGUzZCgxMHB4LDAsMCk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjE3NSwuODg1LC4zMiwxKX19Lnpvb21JbkxlZnR7YW5pbWF0aW9uLW5hbWU6em9vbUluTGVmdH1Aa2V5ZnJhbWVzIHpvb21JblJpZ2h0ezAle29wYWNpdHk6MDt0cmFuc2Zvcm06c2NhbGUzZCguMSwuMSwuMSkgdHJhbnNsYXRlM2QoMTAwMHB4LDAsMCk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjU1LC4wNTUsLjY3NSwuMTkpfTYwJXtvcGFjaXR5OjE7dHJhbnNmb3JtOnNjYWxlM2QoLjQ3NSwuNDc1LC40NzUpIHRyYW5zbGF0ZTNkKC0xMHB4LDAsMCk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjE3NSwuODg1LC4zMiwxKX19Lnpvb21JblJpZ2h0e2FuaW1hdGlvbi1uYW1lOnpvb21JblJpZ2h0fUBrZXlmcmFtZXMgem9vbUluVXB7MCV7b3BhY2l0eTowO3RyYW5zZm9ybTpzY2FsZTNkKC4xLC4xLC4xKSB0cmFuc2xhdGUzZCgwLDEwMDBweCwwKTthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguNTUsLjA1NSwuNjc1LC4xOSl9NjAle29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUzZCguNDc1LC40NzUsLjQ3NSkgdHJhbnNsYXRlM2QoMCwtNjBweCwwKTthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguMTc1LC44ODUsLjMyLDEpfX0uem9vbUluVXB7YW5pbWF0aW9uLW5hbWU6em9vbUluVXB9QGtleWZyYW1lcyB6b29tT3V0ezAle29wYWNpdHk6MX01MCV7dHJhbnNmb3JtOnNjYWxlM2QoLjMsLjMsLjMpO29wYWNpdHk6MH10b3tvcGFjaXR5OjB9fS56b29tT3V0e2FuaW1hdGlvbi1uYW1lOnpvb21PdXR9QGtleWZyYW1lcyB6b29tT3V0RG93bns0MCV7b3BhY2l0eToxO3RyYW5zZm9ybTpzY2FsZTNkKC40NzUsLjQ3NSwuNDc1KSB0cmFuc2xhdGUzZCgwLC02MHB4LDApO2FuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246Y3ViaWMtYmV6aWVyKC41NSwuMDU1LC42NzUsLjE5KX10b3tvcGFjaXR5OjA7dHJhbnNmb3JtOnNjYWxlM2QoLjEsLjEsLjEpIHRyYW5zbGF0ZTNkKDAsMjAwMHB4LDApO3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyIGJvdHRvbTthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguMTc1LC44ODUsLjMyLDEpfX0uem9vbU91dERvd257YW5pbWF0aW9uLW5hbWU6em9vbU91dERvd259QGtleWZyYW1lcyB6b29tT3V0TGVmdHs0MCV7b3BhY2l0eToxO3RyYW5zZm9ybTpzY2FsZTNkKC40NzUsLjQ3NSwuNDc1KSB0cmFuc2xhdGUzZCg0MnB4LDAsMCl9dG97b3BhY2l0eTowO3RyYW5zZm9ybTpzY2FsZSguMSkgdHJhbnNsYXRlM2QoLTIwMDBweCwwLDApO3RyYW5zZm9ybS1vcmlnaW46bGVmdCBjZW50ZXJ9fS56b29tT3V0TGVmdHthbmltYXRpb24tbmFtZTp6b29tT3V0TGVmdH1Aa2V5ZnJhbWVzIHpvb21PdXRSaWdodHs0MCV7b3BhY2l0eToxO3RyYW5zZm9ybTpzY2FsZTNkKC40NzUsLjQ3NSwuNDc1KSB0cmFuc2xhdGUzZCgtNDJweCwwLDApfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06c2NhbGUoLjEpIHRyYW5zbGF0ZTNkKDIwMDBweCwwLDApO3RyYW5zZm9ybS1vcmlnaW46cmlnaHQgY2VudGVyfX0uem9vbU91dFJpZ2h0e2FuaW1hdGlvbi1uYW1lOnpvb21PdXRSaWdodH1Aa2V5ZnJhbWVzIHpvb21PdXRVcHs0MCV7b3BhY2l0eToxO3RyYW5zZm9ybTpzY2FsZTNkKC40NzUsLjQ3NSwuNDc1KSB0cmFuc2xhdGUzZCgwLDYwcHgsMCk7YW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbjpjdWJpYy1iZXppZXIoLjU1LC4wNTUsLjY3NSwuMTkpfXRve29wYWNpdHk6MDt0cmFuc2Zvcm06c2NhbGUzZCguMSwuMSwuMSkgdHJhbnNsYXRlM2QoMCwtMjAwMHB4LDApO3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyIGJvdHRvbTthbmltYXRpb24tdGltaW5nLWZ1bmN0aW9uOmN1YmljLWJlemllciguMTc1LC44ODUsLjMyLDEpfX0uem9vbU91dFVwe2FuaW1hdGlvbi1uYW1lOnpvb21PdXRVcH1Aa2V5ZnJhbWVzIHNsaWRlSW5Eb3duezAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLC0xMDAlLDApO3Zpc2liaWxpdHk6dmlzaWJsZX10b3t0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX19LnNsaWRlSW5Eb3due2FuaW1hdGlvbi1uYW1lOnNsaWRlSW5Eb3dufUBrZXlmcmFtZXMgc2xpZGVJbkxlZnR7MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKC0xMDAlLDAsMCk7dmlzaWJpbGl0eTp2aXNpYmxlfXRve3RyYW5zZm9ybTp0cmFuc2xhdGVaKDApfX0uc2xpZGVJbkxlZnR7YW5pbWF0aW9uLW5hbWU6c2xpZGVJbkxlZnR9QGtleWZyYW1lcyBzbGlkZUluUmlnaHR7MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZTNkKDEwMCUsMCwwKTt2aXNpYmlsaXR5OnZpc2libGV9dG97dHJhbnNmb3JtOnRyYW5zbGF0ZVooMCl9fS5zbGlkZUluUmlnaHR7YW5pbWF0aW9uLW5hbWU6c2xpZGVJblJpZ2h0fUBrZXlmcmFtZXMgc2xpZGVJblVwezAle3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLDEwMCUsMCk7dmlzaWJpbGl0eTp2aXNpYmxlfXRve3RyYW5zZm9ybTp0cmFuc2xhdGVaKDApfX0uc2xpZGVJblVwe2FuaW1hdGlvbi1uYW1lOnNsaWRlSW5VcH1Aa2V5ZnJhbWVzIHNsaWRlT3V0RG93bnswJXt0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX10b3t2aXNpYmlsaXR5OmhpZGRlbjt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoMCwxMDAlLDApfX0uc2xpZGVPdXREb3due2FuaW1hdGlvbi1uYW1lOnNsaWRlT3V0RG93bn1Aa2V5ZnJhbWVzIHNsaWRlT3V0TGVmdHswJXt0cmFuc2Zvcm06dHJhbnNsYXRlWigwKX10b3t2aXNpYmlsaXR5OmhpZGRlbjt0cmFuc2Zvcm06dHJhbnNsYXRlM2QoLTEwMCUsMCwwKX19LnNsaWRlT3V0TGVmdHthbmltYXRpb24tbmFtZTpzbGlkZU91dExlZnR9QGtleWZyYW1lcyBzbGlkZU91dFJpZ2h0ezAle3RyYW5zZm9ybTp0cmFuc2xhdGVaKDApfXRve3Zpc2liaWxpdHk6aGlkZGVuO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgxMDAlLDAsMCl9fS5zbGlkZU91dFJpZ2h0e2FuaW1hdGlvbi1uYW1lOnNsaWRlT3V0UmlnaHR9QGtleWZyYW1lcyBzbGlkZU91dFVwezAle3RyYW5zZm9ybTp0cmFuc2xhdGVaKDApfXRve3Zpc2liaWxpdHk6aGlkZGVuO3RyYW5zZm9ybTp0cmFuc2xhdGUzZCgwLC0xMDAlLDApfX0uc2xpZGVPdXRVcHthbmltYXRpb24tbmFtZTpzbGlkZU91dFVwfWJvZHl7Zm9udDoxOHB4LzEuNSBcXFwiRHJvaWQgU2Fuc1xcXCIsZnV0dXJhLGhlbHZldGljYSxhcmlhbCxhcmlhbCxzYW5zLXNlcmlmO2ZvbnQtd2VpZ2h0OjEwMDtjb2xvcjpyZ2JhKDI1NSwyNTUsMjU1LC45NSk7dGV4dC1zaGFkb3c6MCAwIDJweCAjMDAwLDAgMCA0MHB4ICMwMDB9aDF7Zm9udC1zaXplOjUwcHg7Zm9udC13ZWlnaHQ6OTAwO21hcmdpbjowIGF1dG8gMTBweH1oMntmb250LXNpemU6MzZweDtmb250LXdlaWdodDozMDA7bWFyZ2luOjAgYXV0byA1cHh9aDMsaDQsaDV7Zm9udC1zaXplOjI4cHg7bWFyZ2luOjAgYXV0bztmb250LXdlaWdodDoyMDB9aDQsaDV7Zm9udC1zaXplOjIycHh9aDV7Zm9udC1zaXplOjE4cHh9b2wsdWx7Zm9udC1zaXplOjMycHg7Zm9udC13ZWlnaHQ6NDAwfW9sLm5vcHJlZml4LHVsLm5vcHJlZml4e2xpc3Qtc3R5bGU6bm9uZX1vbC5ub3ByZWZpeCBsaSx1bC5ub3ByZWZpeCBsaXttYXJnaW4tbGVmdDowfW9sLm5vcHJlZml4IGxpOjpiZWZvcmUsdWwubm9wcmVmaXggbGk6OmJlZm9yZXtjb250ZW50Om5vbmV9bGl7bWFyZ2luLWJvdHRvbToxMnB4O3dpZHRoOjEwMCU7bWFyZ2luLWxlZnQ6LjVlbX1vbCBvbCxvbCB1bCx1bCBvbCx1bCB1bHttYXJnaW4tbGVmdDozMHB4fW9sIG9sIGxpLG9sIHVsIGxpLHVsIG9sIGxpLHVsIHVsIGxpe21hcmdpbi1ib3R0b206MDtsaW5lLWhlaWdodDoxLjRlbX1vbCBvbCx1bCBvbHtsaXN0LXN0eWxlLXR5cGU6bG93ZXItcm9tYW59YmxvY2txdW90ZSxsaSxwcmV7dGV4dC1hbGlnbjpsZWZ0fXRkLHRoe3BhZGRpbmc6MTBweDtib3JkZXI6MXB4IHNvbGlkICNjY2N9dGh7YmFja2dyb3VuZC1jb2xvcjojMzMzfXRke2JhY2tncm91bmQtY29sb3I6IzQ0NDt0ZXh0LXNoYWRvdzpub25lfXByZXtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjEwcHh9cHJlIC5lbS1ibHVlLHByZSAuZW0tZ3JlZW4scHJlIC5lbS1yZWQscHJlIC5lbS15ZWxsb3d7bWFyZ2luOjVweCAwfS5iZXNwb2tlLXBhcmVudCwuYmVzcG9rZS1zY2FsZS1wYXJlbnR7cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDowO3JpZ2h0OjA7Ym90dG9tOjB9LmJlc3Bva2UtcGFyZW50ey13ZWJraXQtdGV4dC1zaXplLWFkanVzdDphdXRvOy1tcy10ZXh0LXNpemUtYWRqdXN0OmF1dG87dGV4dC1zaXplLWFkanVzdDphdXRvO2JhY2tncm91bmQ6IzExMTtvdmVyZmxvdzpoaWRkZW47dHJhbnNpdGlvbjpiYWNrZ3JvdW5kIDFzIGVhc2U7YmFja2dyb3VuZC1wb3NpdGlvbjo1MCUgNTAlfS5iZXNwb2tlLXNjYWxlLXBhcmVudHtwb2ludGVyLWV2ZW50czpub25lfS5iZXNwb2tlLXNjYWxlLXBhcmVudCAuYmVzcG9rZS1hY3RpdmV7cG9pbnRlci1ldmVudHM6YXV0b30uYmVzcG9rZS1zbGlkZXt3aWR0aDoxMDAlO2hlaWdodDoxMDAlO3Bvc2l0aW9uOmFic29sdXRlO2Rpc3BsYXk6LW1zLWZsZXhib3g7ZGlzcGxheTpmbGV4Oy1tcy1mbGV4LWRpcmVjdGlvbjpjb2x1bW47ZmxleC1kaXJlY3Rpb246Y29sdW1uOy1tcy1mbGV4LXBhY2s6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7LW1zLWZsZXgtYWxpZ246Y2VudGVyO2FsaWduLWl0ZW1zOmNlbnRlcn0uYmVzcG9rZS1zbGlkZS54LWdpZi1maW5pc2hlZCAuYm94LndhaXQtZm9yLWdpZntvcGFjaXR5OjF9LmJlc3Bva2UtYnVsbGV0LWluYWN0aXZlLC5iZXNwb2tlLWluYWN0aXZle29wYWNpdHk6MDtwb2ludGVyLWV2ZW50czpub25lfS5iZXNwb2tlLWJhY2tkcm9we3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2JvdHRvbTowO3otaW5kZXg6LTE7b3BhY2l0eTowfS5iZXNwb2tlLWJhY2tkcm9wLWFjdGl2ZXtvcGFjaXR5OjF9LmJlc3Bva2UtcHJvZ3Jlc3MtcGFyZW50e3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtyaWdodDowO2hlaWdodDouM3Z3fS5iZXNwb2tlLXByb2dyZXNzLWJhcntwb3NpdGlvbjphYnNvbHV0ZTtoZWlnaHQ6MTAwJTtiYWNrZ3JvdW5kOiNjY2M7dHJhbnNpdGlvbjp3aWR0aCAuNnMgZWFzZX0uY2FyYm9uZmliZXJ7YmFja2dyb3VuZDpyYWRpYWwtZ3JhZGllbnQoIzAwMCAxNSUsdHJhbnNwYXJlbnQgMTYlKSAwIDAscmFkaWFsLWdyYWRpZW50KCMwMDAgMTUlLHRyYW5zcGFyZW50IDE2JSkgOHB4IDhweCxyYWRpYWwtZ3JhZGllbnQocmdiYSgyNTUsMjU1LDI1NSwuMSkgMTUlLHRyYW5zcGFyZW50IDIwJSkgMCAxcHgscmFkaWFsLWdyYWRpZW50KHJnYmEoMjU1LDI1NSwyNTUsLjEpIDE1JSx0cmFuc3BhcmVudCAyMCUpIDhweCA5cHg7YmFja2dyb3VuZC1jb2xvcjojMjgyODI4O2JhY2tncm91bmQtc2l6ZToxNnB4IDE2cHh9LmNhcmJvbntiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgyN2RlZywjMTUxNTE1IDVweCx0cmFuc3BhcmVudCA1cHgpIDAgNXB4LGxpbmVhci1ncmFkaWVudCgyMDdkZWcsIzE1MTUxNSA1cHgsdHJhbnNwYXJlbnQgNXB4KSAxMHB4IDAsbGluZWFyLWdyYWRpZW50KDI3ZGVnLCMyMjIgNXB4LHRyYW5zcGFyZW50IDVweCkgMCAxMHB4LGxpbmVhci1ncmFkaWVudCgyMDdkZWcsIzIyMiA1cHgsdHJhbnNwYXJlbnQgNXB4KSAxMHB4IDVweCxsaW5lYXItZ3JhZGllbnQoOTBkZWcsIzFiMWIxYiAxMHB4LHRyYW5zcGFyZW50IDEwcHgpLGxpbmVhci1ncmFkaWVudCgjMWQxZDFkIDI1JSwjMWExYTFhIDI1JSwjMWExYTFhIDUwJSx0cmFuc3BhcmVudCA1MCUsdHJhbnNwYXJlbnQgNzUlLCMyNDI0MjQgNzUlLCMyNDI0MjQpO2JhY2tncm91bmQtY29sb3I6IzEzMTMxMztiYWNrZ3JvdW5kLXNpemU6MjBweCAyMHB4fS5zZWlnYWloYXtiYWNrZ3JvdW5kLWNvbG9yOnNpbHZlcjtiYWNrZ3JvdW5kLWltYWdlOnJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgMTAwJSAxNTAlLHNpbHZlciAyNCUsI2ZmZiAyNSUsI2ZmZiAyOCUsc2lsdmVyIDI5JSxzaWx2ZXIgMzYlLCNmZmYgMzYlLCNmZmYgNDAlLHRyYW5zcGFyZW50IDQwJSx0cmFuc3BhcmVudCkscmFkaWFsLWdyYWRpZW50KGNpcmNsZSBhdCAwIDE1MCUsc2lsdmVyIDI0JSwjZmZmIDI1JSwjZmZmIDI4JSxzaWx2ZXIgMjklLHNpbHZlciAzNiUsI2ZmZiAzNiUsI2ZmZiA0MCUsdHJhbnNwYXJlbnQgNDAlLHRyYW5zcGFyZW50KSxyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDUwJSAxMDAlLCNmZmYgMTAlLHNpbHZlciAxMSUsc2lsdmVyIDIzJSwjZmZmIDI0JSwjZmZmIDMwJSxzaWx2ZXIgMzElLHNpbHZlciA0MyUsI2ZmZiA0NCUsI2ZmZiA1MCUsc2lsdmVyIDUxJSxzaWx2ZXIgNjMlLCNmZmYgNjQlLCNmZmYgNzElLHRyYW5zcGFyZW50IDcxJSx0cmFuc3BhcmVudCkscmFkaWFsLWdyYWRpZW50KGNpcmNsZSBhdCAxMDAlIDUwJSwjZmZmIDUlLHNpbHZlciA2JSxzaWx2ZXIgMTUlLCNmZmYgMTYlLCNmZmYgMjAlLHNpbHZlciAyMSUsc2lsdmVyIDMwJSwjZmZmIDMxJSwjZmZmIDM1JSxzaWx2ZXIgMzYlLHNpbHZlciA0NSUsI2ZmZiA0NiUsI2ZmZiA0OSUsdHJhbnNwYXJlbnQgNTAlLHRyYW5zcGFyZW50KSxyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDAgNTAlLCNmZmYgNSUsc2lsdmVyIDYlLHNpbHZlciAxNSUsI2ZmZiAxNiUsI2ZmZiAyMCUsc2lsdmVyIDIxJSxzaWx2ZXIgMzAlLCNmZmYgMzElLCNmZmYgMzUlLHNpbHZlciAzNiUsc2lsdmVyIDQ1JSwjZmZmIDQ2JSwjZmZmIDQ5JSx0cmFuc3BhcmVudCA1MCUsdHJhbnNwYXJlbnQpO2JhY2tncm91bmQtc2l6ZToxMDBweCA1MHB4fS5jdWJlc3tiYWNrZ3JvdW5kLWNvbG9yOiM1NTY7YmFja2dyb3VuZC1pbWFnZTpsaW5lYXItZ3JhZGllbnQoMzBkZWcsIzQ0NSAxMiUsdHJhbnNwYXJlbnQgMTIuNSUsdHJhbnNwYXJlbnQgODclLCM0NDUgODcuNSUsIzQ0NSksbGluZWFyLWdyYWRpZW50KDE1MGRlZywjNDQ1IDEyJSx0cmFuc3BhcmVudCAxMi41JSx0cmFuc3BhcmVudCA4NyUsIzQ0NSA4Ny41JSwjNDQ1KSxsaW5lYXItZ3JhZGllbnQoMzBkZWcsIzQ0NSAxMiUsdHJhbnNwYXJlbnQgMTIuNSUsdHJhbnNwYXJlbnQgODclLCM0NDUgODcuNSUsIzQ0NSksbGluZWFyLWdyYWRpZW50KDE1MGRlZywjNDQ1IDEyJSx0cmFuc3BhcmVudCAxMi41JSx0cmFuc3BhcmVudCA4NyUsIzQ0NSA4Ny41JSwjNDQ1KSxsaW5lYXItZ3JhZGllbnQoNjBkZWcsIzk5YSAyNSUsdHJhbnNwYXJlbnQgMjUuNSUsdHJhbnNwYXJlbnQgNzUlLCM5OWEgNzUlLCM5OWEpLGxpbmVhci1ncmFkaWVudCg2MGRlZywjOTlhIDI1JSx0cmFuc3BhcmVudCAyNS41JSx0cmFuc3BhcmVudCA3NSUsIzk5YSA3NSUsIzk5YSk7YmFja2dyb3VuZC1zaXplOjgwcHggMTQwcHg7YmFja2dyb3VuZC1wb3NpdGlvbjowIDAsMCAwLDQwcHggNzBweCw0MHB4IDcwcHgsMCAwLDQwcHggNzBweH0ucGFwZXJ7YmFja2dyb3VuZC1jb2xvcjojZmZmO2JhY2tncm91bmQtaW1hZ2U6bGluZWFyLWdyYWRpZW50KDkwZGVnLHRyYW5zcGFyZW50IDc5cHgsI2FiY2VkNCA3OXB4LCNhYmNlZDQgODFweCx0cmFuc3BhcmVudCA4MXB4KSxsaW5lYXItZ3JhZGllbnQoI2VlZSAuMWVtLHRyYW5zcGFyZW50IC4xZW0pO2JhY2tncm91bmQtc2l6ZToxMDAlIDEuMmVtfS5ob25leWNvbWJ7YmFja2dyb3VuZDpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGZhcnRoZXN0LXNpZGUgYXQgMCUgNTAlLCNmYjEgMjMuNSUscmdiYSgyNDAsMTY2LDE3LDApIDApIDIxcHggMzBweCxyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGZhcnRoZXN0LXNpZGUgYXQgMCUgNTAlLCNiNzEgMjQlLHJnYmEoMjQwLDE2NiwxNywwKSAwKSAxOXB4IDMwcHgsbGluZWFyLWdyYWRpZW50KCNmYjEgMTQlLHJnYmEoMjQwLDE2NiwxNywwKSAwLHJnYmEoMjQwLDE2NiwxNywwKSA4NSUsI2ZiMSAwKSAwIDAsbGluZWFyLWdyYWRpZW50KDE1MGRlZywjZmIxIDI0JSwjYjcxIDAsI2I3MSAyNiUscmdiYSgyNDAsMTY2LDE3LDApIDAscmdiYSgyNDAsMTY2LDE3LDApIDc0JSwjYjcxIDAsI2I3MSA3NiUsI2ZiMSAwKSAwIDAsbGluZWFyLWdyYWRpZW50KDMwZGVnLCNmYjEgMjQlLCNiNzEgMCwjYjcxIDI2JSxyZ2JhKDI0MCwxNjYsMTcsMCkgMCxyZ2JhKDI0MCwxNjYsMTcsMCkgNzQlLCNiNzEgMCwjYjcxIDc2JSwjZmIxIDApIDAgMCxsaW5lYXItZ3JhZGllbnQoOTBkZWcsI2I3MSAyJSwjZmIxIDAsI2ZiMSA5OCUsI2I3MSAwJSkgMCAwICNmYjE7YmFja2dyb3VuZC1zaXplOjQwcHggNjBweH0ud2F2ZXtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgjZmZmIDUwJSxyZ2JhKDI1NSwyNTUsMjU1LDApIDApIDAgMCxyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGNsb3Nlc3Qtc2lkZSwjZmZmIDUzJSxyZ2JhKDI1NSwyNTUsMjU1LDApIDApIDAgMCxyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGNsb3Nlc3Qtc2lkZSwjZmZmIDUwJSxyZ2JhKDI1NSwyNTUsMjU1LDApIDApIDU1cHggMCAjNDhiO2JhY2tncm91bmQtc2l6ZToxMTBweCAyMDBweDtiYWNrZ3JvdW5kLXJlcGVhdDpyZXBlYXQteH0uYmx1ZXByaW50e2JhY2tncm91bmQtY29sb3I6IzI2OTtiYWNrZ3JvdW5kLWltYWdlOmxpbmVhci1ncmFkaWVudCgjZmZmIDJweCx0cmFuc3BhcmVudCAycHgpLGxpbmVhci1ncmFkaWVudCg5MGRlZywjZmZmIDJweCx0cmFuc3BhcmVudCAycHgpLGxpbmVhci1ncmFkaWVudChyZ2JhKDI1NSwyNTUsMjU1LC4zKSAxcHgsdHJhbnNwYXJlbnQgMXB4KSxsaW5lYXItZ3JhZGllbnQoOTBkZWcscmdiYSgyNTUsMjU1LDI1NSwuMykgMXB4LHRyYW5zcGFyZW50IDFweCk7YmFja2dyb3VuZC1zaXplOjEwMHB4IDEwMHB4LDEwMHB4IDEwMHB4LDIwcHggMjBweCwyMHB4IDIwcHg7YmFja2dyb3VuZC1wb3NpdGlvbjotMnB4IC0ycHgsLTJweCAtMnB4LC0xcHggLTFweCwtMXB4IC0xcHh9LnNoaXBwb3tiYWNrZ3JvdW5kLWNvbG9yOiNkZWY7YmFja2dyb3VuZC1pbWFnZTpyYWRpYWwtZ3JhZGllbnQoY2xvc2VzdC1zaWRlLHRyYW5zcGFyZW50IDk4JSxyZ2JhKDAsMCwwLC4zKSA5OSUpLHJhZGlhbC1ncmFkaWVudChjbG9zZXN0LXNpZGUsdHJhbnNwYXJlbnQgOTglLHJnYmEoMCwwLDAsLjMpIDk5JSk7YmFja2dyb3VuZC1zaXplOjgwcHggODBweDtiYWNrZ3JvdW5kLXBvc2l0aW9uOjAgMCw0MHB4IDQwcHh9LmJsYWNrdGhyZWFke2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy9ibGFjay10aHJlYWQtbGlnaHQucG5nKX0uYnJpY2t3YWxsZGFya3tiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvYnJpY2std2FsbC1kYXJrLnBuZyl9LmJyaWNrd2FsbHtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvYnJpY2std2FsbC5wbmcpfS5kaWFnbW9uZHN7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL2RpYWdtb25kcy1saWdodC5wbmcpfS5kaWFtb25kdXBob2xzdGVyeXtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvZGlhbW9uZC11cGhvbHN0ZXJ5LnBuZyl9LmdwbGF5e2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy9ncGxheS5wbmcpfS5ncmF2ZWx7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL2dyYXZlbC5wbmcpfS5vbGRtYXRoe2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy9vbGQtbWF0aGVtYXRpY3MucG5nKX0ucHVydHl3b29ke2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy9wdXJ0eS13b29kLnBuZyl9LmJ1bGxzZXllc3tiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvc3RyYW5nZS1idWxsc2V5ZXMucG5nKX0uZXNjaGVyZXNxdWV7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL2VzY2hlcmVzcXVlLnBuZyl9LnN0cmF3c3tiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvc3RyYXdzLnBuZyl9LmxpdHRsZWJveGVze2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy9saXR0bGVib3hlcy5wbmcpfS53b29kdGlsZWNvbG9ye2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy90aWxlYWJsZS13b29kLWNvbG9yZWQucG5nKX0ud29vZHRpbGV7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL3RpbGVhYmxlLXdvb2QucG5nKX0udHJlZWJhcmt7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL3RyZWUtYmFyay5wbmcpfS53YXNoaXtiYWNrZ3JvdW5kLWltYWdlOnVybChpbWFnZXMvcGF0dGVybnMvd2FzaGkucG5nKX0ud29vZC1wYXR0ZXJue2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9wYXR0ZXJucy93b29kLXBhdHRlcm4ucG5nKX0ueHZ7YmFja2dyb3VuZC1pbWFnZTp1cmwoaW1hZ2VzL3BhdHRlcm5zL3h2LnBuZyl9c2VjdGlvbj5pbWd7cG9zaXRpb246YWJzb2x1dGU7bWFyZ2luOmF1dG87ZGlzcGxheTotbXMtZmxleGJveDtkaXNwbGF5OmZsZXh9LmZ1bGxzY3JlZW57cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDowfS5maWxsLC5mdWxsc2NyZWVue3dpZHRoOjEwMCU7aGVpZ2h0OjEwMCV9LmZpbGxoe2hlaWdodDoxMDAlO2xlZnQ6LTUwJTtyaWdodDotNTAlO3Bvc2l0aW9uOmFic29sdXRlO21hcmdpbjphdXRvfS5maWxsdywuZmlsbHdie3dpZHRoOjEwMCU7aGVpZ2h0OmF1dG99LmZpbGx3Yntib3R0b206MH1zZWN0aW9uIHgtZ2lme3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MH0uYm94e3Bvc2l0aW9uOnJlbGF0aXZlO3RleHQtYWxpZ246Y2VudGVyO21hcmdpbjphdXRvO21heC13aWR0aDoxMDAlO2JvcmRlci1yYWRpdXM6MTBweDtwYWRkaW5nOjI1cHg7YmFja2dyb3VuZC1jb2xvcjpyZ2JhKDAsMCwwLC42KX0uYm94IG9sLC5ib3ggdWx7bWFyZ2luOjEycHggMjBweDtwYWRkaW5nOjB9LmJveCBsaTo6YmVmb3Jle2xlZnQ6LjVlbX0uYm94LndhaXQtZm9yLWdpZntvcGFjaXR5OjB9LmJveC5ib3R0b217Ym90dG9tOjUlO21hcmdpbi1ib3R0b206MH0uYm94LnRvcHt0b3A6NSU7bWFyZ2luLXRvcDowfS5ib3gubGVmdHtsZWZ0OjUlO21hcmdpbi1sZWZ0OjB9LmJveC5yaWdodHtyaWdodDo1JTttYXJnaW4tcmlnaHQ6MH0uYm94LnRyYW5zcGFyZW50IHByZSxzcGFuLmFuaW1hdGV7ZGlzcGxheTppbmxpbmUtYmxvY2t9LmNyZWRpdHtwb3NpdGlvbjphYnNvbHV0ZTtib3R0b206MTBweDtyaWdodDoxMHB4fWF7Y29sb3I6IzljZjt0ZXh0LWRlY29yYXRpb246bm9uZX1hLmJhY2s6YWZ0ZXIsYS5iYWNrOmJlZm9yZSxhOmFmdGVye2NvbnRlbnQ6JyAg4p6tJztmb250LXNpemU6MjRweDtsaW5lLWhlaWdodDoyNHB4O3ZlcnRpY2FsLWFsaWduOm1pZGRsZX1hLmJhY2s6YWZ0ZXIsYS5iYWNrOmJlZm9yZXtjb250ZW50OifirIUgICd9YS5iYWNrOmFmdGVye2NvbnRlbnQ6Jyd9Lm1lLC5wZXJzb257aGVpZ2h0OjcycHg7d2lkdGg6NzJweDtiYWNrZ3JvdW5kLXJlcGVhdDpuby1yZXBlYXQ7YmFja2dyb3VuZC1zaXplOjcycHg7YmFja2dyb3VuZC1wb3NpdGlvbjo1MCUgNTAlO2JvcmRlci1yYWRpdXM6NTAlO2JveC1zaGFkb3c6MCAwIDAgMnB4ICMwMDAsMCAwIDAgNHB4ICM5Y2Y7bWFyZ2luOjAgMTZweH0ubWUuY2VudGVyLC5wZXJzb24uY2VudGVye21hcmdpbjoxNXB4IGF1dG99Lm1le2JhY2tncm91bmQtaW1hZ2U6dXJsKGltYWdlcy9tZS5qcGcpfS5lbXtmb250LXdlaWdodDozMDB9LmVtLC5lbS1ibHVlLC5lbS1ib2xkLC5lbS1ncmVlbiwuZW0tb3JhbmdlLC5lbS1yZWQsLmVtLXllbGxvd3twYWRkaW5nOjVweCAxMHB4O21hcmdpbjo1cHggMnB4O2JvcmRlcjoxcHggc29saWQgdHJhbnNwYXJlbnQ7Ym9yZGVyLXJhZGl1czo0cHg7dGV4dC1zaGFkb3c6bm9uZTtkaXNwbGF5OmlubGluZS1ibG9jaztsaW5lLWhlaWdodDoxLjJlbTtmb250LWZhbWlseTptb25vc3BhY2U7Zm9udC1zdHlsZTpub3JtYWx9LmVtLWJsdWUsLmVtLWdyZWVuLC5lbS1vcmFuZ2UsLmVtLXJlZCwuZW0teWVsbG93e2ZvbnQtd2VpZ2h0OjMwMH0uZW0tYm9sZHtmb250LXdlaWdodDo3MDB9LmVtLWdyZWVue2NvbG9yOiM0Njg4NDc7YmFja2dyb3VuZC1jb2xvcjojZGZmMGQ4O2JvcmRlci1jb2xvcjojZDZlOWM2fS5lbS15ZWxsb3d7Y29sb3I6IzhhNmQzYjtiYWNrZ3JvdW5kLWNvbG9yOiNmY2Y4ZTM7Ym9yZGVyLWNvbG9yOiNmYWViY2N9LmVtLWJsdWV7Y29sb3I6IzNhODdhZDtiYWNrZ3JvdW5kLWNvbG9yOiNkOWVkZjc7Ym9yZGVyLWNvbG9yOiNiY2U4ZjF9LmVtLW9yYW5nZXtjb2xvcjojZjg1O2JhY2tncm91bmQtY29sb3I6I2ZjZjhlMztib3JkZXItY29sb3I6I2ZiZWVkNX0uZW0tcmVke2NvbG9yOiNiOTRhNDg7YmFja2dyb3VuZC1jb2xvcjojZjJkZWRlO2JvcmRlci1jb2xvcjojZWVkM2Q3fS5taWR7Zm9udC1zaXplOjI4cHg7Zm9udC1zdHlsZTppdGFsaWM7ZGlzcGxheTotbXMtZmxleGJveDtkaXNwbGF5OmZsZXg7d2lkdGg6MTAwJTttYXJnaW46MTBweCBhdXRvOy1tcy1mbGV4LWFsaWduOmNlbnRlcjthbGlnbi1pdGVtczpjZW50ZXJ9Lm1pZDo6YWZ0ZXIsLm1pZDo6YmVmb3Jle2NvbnRlbnQ6Jyc7LW1zLWZsZXgtcG9zaXRpdmU6MTtmbGV4LWdyb3c6MTtkaXNwbGF5OmJsb2NrO2JvcmRlci10b3A6ZG90dGVkIDFweCByZ2JhKDI1NSwyNTUsMjU1LC4zKX0ubWlkOjpiZWZvcmV7bWFyZ2luLXJpZ2h0OjE2cHh9Lm1pZDo6YWZ0ZXJ7bWFyZ2luLWxlZnQ6MTZweH0ubWlkLmJpZ3tmb250LXNpemU6NzRweH0uaGlkZXtkaXNwbGF5Om5vbmV9LmJsdXIxe2ZpbHRlcjpibHVyKDFweCl9LmJsdXIye2ZpbHRlcjpibHVyKDJweCl9LmJsdXIzLC5ibHVyNHtmaWx0ZXI6Ymx1cigzcHgpfS5vcGFjMjB7b3BhY2l0eTouMn0ub3BhYzUwe29wYWNpdHk6LjV9Lm9wYWM4MHtvcGFjaXR5Oi44fS50cmFuc3BhcmVudHtiYWNrZ3JvdW5kLWNvbG9yOnJnYmEoMCwwLDAsMCl9LndoaXRle2JhY2tncm91bmQtY29sb3I6I2ZmZn0ud2hpdGUuYm94e2NvbG9yOiMzMzM7dGV4dC1zaGFkb3c6bm9uZX0ucmVke2JhY2tncm91bmQtY29sb3I6I2I5NGE0OH0uYmxhY2t7YmFja2dyb3VuZC1jb2xvcjojMDAwfS5ncmV5e2JhY2tncm91bmQtY29sb3I6I2NmY2ZjZn0uZ3JleS5ib3h7Y29sb3I6IzMzM30uYmx1ZXtiYWNrZ3JvdW5kLWNvbG9yOiMwMDRlOGF9Lm1pZG5pZ2h0e2JhY2tncm91bmQtY29sb3I6IzAwMWYzZn0uamVsbHliZWFue2JhY2tncm91bmQtY29sb3I6IzI4ODg5NX0uY29jb2F7YmFja2dyb3VuZC1jb2xvcjojNDcyZjAwfS5ub3Ble3RleHQtZGVjb3JhdGlvbjpsaW5lLXRocm91Z2g7b3BhY2l0eTouN31wLmNvZGV7bWFyZ2luOjA7Zm9udC1mYW1pbHk6cHJlc3RpZ2UgZWxpdGUgc3RkLGNvbnNvbGFzLGNvdXJpZXIgbmV3LG1vbm9zcGFjZX1zdHJpa2UgY29kZVtjbGFzcyo9bGFuZ3VhZ2UtXXt0ZXh0LXNoYWRvdzowIDFweCAjMDBmfS5yb3RhdGUsLnNwaW57ZGlzcGxheTppbmxpbmUtYmxvY2s7dHJhbnNmb3JtOm5vbmV9LnJvdGF0ZS5vbiwuc3Bpbi5vbnt0cmFuc2l0aW9uLWRlbGF5Oi41czt0cmFuc2l0aW9uLWR1cmF0aW9uOjFzO3RyYW5zZm9ybTpyb3RhdGUoMTVkZWcpfS5zcGluLm9ue3RyYW5zaXRpb24tZGVsYXk6MS41czt0cmFuc2Zvcm06cm90YXRlKDM2MGRlZyl9LmFuaW1hdGUuZGVsYXkxe2FuaW1hdGlvbi1kZWxheToxc30uYW5pbWF0ZS5kZWxheTJ7YW5pbWF0aW9uLWRlbGF5OjJzfS5hbmltYXRlLmRlbGF5M3thbmltYXRpb24tZGVsYXk6M3N9LmFuaW1hdGUuZGVsYXk0e2FuaW1hdGlvbi1kZWxheTo0c30uYW5pbWF0ZS5kZWxheTV7YW5pbWF0aW9uLWRlbGF5OjVzfS5hbmltYXRlLmRlbGF5NnthbmltYXRpb24tZGVsYXk6NnN9LmFuaW1hdGUuZGVsYXk3e2FuaW1hdGlvbi1kZWxheTo3c30uYW5pbWF0ZS5kZWxheTh7YW5pbWF0aW9uLWRlbGF5OjhzfS5jdXJzb3I6YWZ0ZXJ7Y29udGVudDpcXFwiX1xcXCI7b3BhY2l0eTowO2FuaW1hdGlvbjpjdXJzb3IgMXMgaW5maW5pdGV9QGtleWZyYW1lcyBjdXJzb3J7MCUsNDAlLHRve29wYWNpdHk6MH01MCUsOTAle29wYWNpdHk6MX19XCI7cmV0dXJuIG8odCx7cHJlcGVuZDohMH0pLGZ1bmN0aW9uKHQpe24oKSh0KSxzKHQpLHIodCl9fSx3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLGZ1bmN0aW9uKCl7W10uZm9yRWFjaC5jYWxsKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJ4LWdpZlwiKSxmdW5jdGlvbih0KXt0LnJlbGF5b3V0KCl9KX0pLFwicmVnaXN0ZXJFbGVtZW50XCJpbiBkb2N1bWVudCYmXCJjcmVhdGVTaGFkb3dSb290XCJpbiBIVE1MRWxlbWVudC5wcm90b3R5cGUmJlwiaW1wb3J0XCJpbiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlua1wiKSYmXCJjb250ZW50XCJpbiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIikpO2Vsc2V7dmFyIG09ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNjcmlwdFwiKTttLnNyYz1cImh0dHBzOi8vY2RuanMuY2xvdWRmbGFyZS5jb20vYWpheC9saWJzL3dlYmNvbXBvbmVudHNqcy8wLjcuMjIvd2ViY29tcG9uZW50cy5taW4uanNcIixkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKG0pO3ZhciBmPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYnJvd3NlcnN1cHBvcnRcIik7ZiYmKGYuY2xhc3NOYW1lPWYuY2xhc3NOYW1lLnJlcGxhY2UoXCJoaWRlXCIsXCJcIikpfXZhciBwPTA7ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsZnVuY3Rpb24odCl7XHJcbnZhciBlPWZ1bmN0aW9uKCl7ZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcImFydGljbGVcIikuc3R5bGUud2Via2l0RmlsdGVyPVwiYnJpZ2h0bmVzcyhcIisoMStwKStcIikgY29udHJhc3QoXCIrKDErLjI1KnApK1wiKVwifTtpZih0LnNoaWZ0S2V5JiYoMzg9PXQua2V5Q29kZT8ocCs9LjEsZShwKSk6NDA9PXQua2V5Q29kZT8ocC09LjEsZShwKSk6NDg9PXQua2V5Q29kZSYmKHA9MCxlKHApKSksY29uc29sZS5sb2codC5rZXlDb2RlKSw4Mj09dC5rZXlDb2RlKXt2YXIgYT1kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLnJvdGF0ZSwgLnNwaW5cIik7Zm9yKGk9MDtpPGEubGVuZ3RoO2krKylhW2ldLmNsYXNzTGlzdC50b2dnbGUoXCJvblwiKX19KTt2YXIgbD1kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmFuaW1hdGVcIiksZD1mdW5jdGlvbih0KXt0LnRhcmdldC5jbGFzc0xpc3QucmVtb3ZlKFwiYW5pbWF0ZWRcIil9O0FycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwobCxmdW5jdGlvbih0LGUpe3QuYWRkRXZlbnRMaXN0ZW5lcihcIndlYmtpdEFuaW1hdGlvbkVuZFwiLGQpLHQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vekFuaW1hdGlvbkVuZFwiLGQpLHQuYWRkRXZlbnRMaXN0ZW5lcihcIk1TQW5pbWF0aW9uRW5kXCIsZCksdC5hZGRFdmVudExpc3RlbmVyKFwib2FuaW1hdGlvbmVuZFwiLGQpLHQuYWRkRXZlbnRMaXN0ZW5lcihcImFuaW1hdGlvbmVuZFwiLGQpfSk7dmFyIGM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpbmtcIik7Yy5yZWw9XCJpbXBvcnRcIixjLmhyZWY9XCJ4LWdpZi94LWdpZi5odG1sXCIsZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjKTt2YXIgZz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlua1wiKTtnLnJlbD1cInN0eWxlc2hlZXRcIixnLnR5cGU9XCJ0ZXh0L2Nzc1wiLGcuaHJlZj1cImh0dHA6Ly9mb250cy5nb29nbGVhcGlzLmNvbS9jc3M/ZmFtaWx5PUNvdXJnZXR0ZXxEcm9pZCtTYW5zXCIsZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChnKX0se1wiYmVzcG9rZS1jbGFzc2VzXCI6MixcImluc2VydC1jc3NcIjozfV0sMjpbZnVuY3Rpb24odCxlLGEpe2UuZXhwb3J0cz1mdW5jdGlvbigpe3JldHVybiBmdW5jdGlvbih0KXt2YXIgZT1mdW5jdGlvbih0LGUpe3QuY2xhc3NMaXN0LmFkZChcImJlc3Bva2UtXCIrZSl9LGE9ZnVuY3Rpb24odCxlKXt0LmNsYXNzTmFtZT10LmNsYXNzTmFtZS5yZXBsYWNlKG5ldyBSZWdFeHAoXCJiZXNwb2tlLVwiK2UrXCIoXFxcXHN8JClcIixcImdcIiksXCIgXCIpLnRyaW0oKX0sbj1mdW5jdGlvbihuLG8pe3ZhciByPXQuc2xpZGVzW3Quc2xpZGUoKV0saT1vLXQuc2xpZGUoKSxzPWk+MD9cImFmdGVyXCI6XCJiZWZvcmVcIjtbXCJiZWZvcmUoLVxcXFxkKyk/XCIsXCJhZnRlcigtXFxcXGQrKT9cIixcImFjdGl2ZVwiLFwiaW5hY3RpdmVcIl0ubWFwKGEuYmluZChudWxsLG4pKSxuIT09ciYmW1wiaW5hY3RpdmVcIixzLHMrXCItXCIrTWF0aC5hYnMoaSldLm1hcChlLmJpbmQobnVsbCxuKSl9O2UodC5wYXJlbnQsXCJwYXJlbnRcIiksdC5zbGlkZXMubWFwKGZ1bmN0aW9uKHQpe2UodCxcInNsaWRlXCIpfSksdC5vbihcImFjdGl2YXRlXCIsZnVuY3Rpb24obyl7dC5zbGlkZXMubWFwKG4pLGUoby5zbGlkZSxcImFjdGl2ZVwiKSxhKG8uc2xpZGUsXCJpbmFjdGl2ZVwiKX0pfX19LHt9XSwzOltmdW5jdGlvbih0LGUsYSl7ZnVuY3Rpb24gbigpe3ZhciB0PWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtyZXR1cm4gdC5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsXCJ0ZXh0L2Nzc1wiKSx0fXZhciBvPVtdLHI9W107ZS5leHBvcnRzPWZ1bmN0aW9uKHQsZSl7ZT1lfHx7fTt2YXIgYT1lLnByZXBlbmQ9PT0hMD9cInByZXBlbmRcIjpcImFwcGVuZFwiLGk9dm9pZCAwIT09ZS5jb250YWluZXI/ZS5jb250YWluZXI6ZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcImhlYWRcIikscz1vLmluZGV4T2YoaSk7cz09PS0xJiYocz1vLnB1c2goaSktMSxyW3NdPXt9KTt2YXIgbTtyZXR1cm4gdm9pZCAwIT09cltzXSYmdm9pZCAwIT09cltzXVthXT9tPXJbc11bYV06KG09cltzXVthXT1uKCksXCJwcmVwZW5kXCI9PT1hP2kuaW5zZXJ0QmVmb3JlKG0saS5jaGlsZE5vZGVzWzBdKTppLmFwcGVuZENoaWxkKG0pKSxtLnN0eWxlU2hlZXQ/bS5zdHlsZVNoZWV0LmNzc1RleHQrPXQ6bS50ZXh0Q29udGVudCs9dCxtfX0se31dfSx7fSxbMV0pKDEpfSk7XG59KS5jYWxsKHRoaXMsdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob3B0aW9ucykge1xyXG4gIHJldHVybiBmdW5jdGlvbihkZWNrKSB7XHJcbiAgICB2YXIgYXhpcyA9IG9wdGlvbnMgPT0gJ3ZlcnRpY2FsJyA/ICdZJyA6ICdYJyxcclxuICAgICAgc3RhcnRQb3NpdGlvbixcclxuICAgICAgZGVsdGE7XHJcblxyXG4gICAgZGVjay5wYXJlbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgaWYgKGUudG91Y2hlcy5sZW5ndGggPT0gMSkge1xyXG4gICAgICAgIHN0YXJ0UG9zaXRpb24gPSBlLnRvdWNoZXNbMF1bJ3BhZ2UnICsgYXhpc107XHJcbiAgICAgICAgZGVsdGEgPSAwO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBkZWNrLnBhcmVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgIGlmIChlLnRvdWNoZXMubGVuZ3RoID09IDEpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgZGVsdGEgPSBlLnRvdWNoZXNbMF1bJ3BhZ2UnICsgYXhpc10gLSBzdGFydFBvc2l0aW9uO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBkZWNrLnBhcmVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICBpZiAoTWF0aC5hYnMoZGVsdGEpID4gNTApIHtcclxuICAgICAgICBkZWNrW2RlbHRhID4gMCA/ICdwcmV2JyA6ICduZXh0J10oKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfTtcclxufTtcclxuIiwidmFyIGZyb20gPSBmdW5jdGlvbihvcHRzLCBwbHVnaW5zKSB7XHJcbiAgdmFyIHBhcmVudCA9IChvcHRzLnBhcmVudCB8fCBvcHRzKS5ub2RlVHlwZSA9PT0gMSA/IChvcHRzLnBhcmVudCB8fCBvcHRzKSA6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Iob3B0cy5wYXJlbnQgfHwgb3B0cyksXHJcbiAgICBzbGlkZXMgPSBbXS5maWx0ZXIuY2FsbCh0eXBlb2Ygb3B0cy5zbGlkZXMgPT09ICdzdHJpbmcnID8gcGFyZW50LnF1ZXJ5U2VsZWN0b3JBbGwob3B0cy5zbGlkZXMpIDogKG9wdHMuc2xpZGVzIHx8IHBhcmVudC5jaGlsZHJlbiksIGZ1bmN0aW9uKGVsKSB7IHJldHVybiBlbC5ub2RlTmFtZSAhPT0gJ1NDUklQVCc7IH0pLFxyXG4gICAgYWN0aXZlU2xpZGUgPSBzbGlkZXNbMF0sXHJcbiAgICBsaXN0ZW5lcnMgPSB7fSxcclxuXHJcbiAgICBhY3RpdmF0ZSA9IGZ1bmN0aW9uKGluZGV4LCBjdXN0b21EYXRhKSB7XHJcbiAgICAgIGlmICghc2xpZGVzW2luZGV4XSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgZmlyZSgnZGVhY3RpdmF0ZScsIGNyZWF0ZUV2ZW50RGF0YShhY3RpdmVTbGlkZSwgY3VzdG9tRGF0YSkpO1xyXG4gICAgICBhY3RpdmVTbGlkZSA9IHNsaWRlc1tpbmRleF07XHJcbiAgICAgIGZpcmUoJ2FjdGl2YXRlJywgY3JlYXRlRXZlbnREYXRhKGFjdGl2ZVNsaWRlLCBjdXN0b21EYXRhKSk7XHJcbiAgICB9LFxyXG5cclxuICAgIHNsaWRlID0gZnVuY3Rpb24oaW5kZXgsIGN1c3RvbURhdGEpIHtcclxuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcclxuICAgICAgICBmaXJlKCdzbGlkZScsIGNyZWF0ZUV2ZW50RGF0YShzbGlkZXNbaW5kZXhdLCBjdXN0b21EYXRhKSkgJiYgYWN0aXZhdGUoaW5kZXgsIGN1c3RvbURhdGEpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBzbGlkZXMuaW5kZXhPZihhY3RpdmVTbGlkZSk7XHJcbiAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgc3RlcCA9IGZ1bmN0aW9uKG9mZnNldCwgY3VzdG9tRGF0YSkge1xyXG4gICAgICB2YXIgc2xpZGVJbmRleCA9IHNsaWRlcy5pbmRleE9mKGFjdGl2ZVNsaWRlKSArIG9mZnNldDtcclxuXHJcbiAgICAgIGZpcmUob2Zmc2V0ID4gMCA/ICduZXh0JyA6ICdwcmV2JywgY3JlYXRlRXZlbnREYXRhKGFjdGl2ZVNsaWRlLCBjdXN0b21EYXRhKSkgJiYgYWN0aXZhdGUoc2xpZGVJbmRleCwgY3VzdG9tRGF0YSk7XHJcbiAgICB9LFxyXG5cclxuICAgIG9uID0gZnVuY3Rpb24oZXZlbnROYW1lLCBjYWxsYmFjaykge1xyXG4gICAgICAobGlzdGVuZXJzW2V2ZW50TmFtZV0gfHwgKGxpc3RlbmVyc1tldmVudE5hbWVdID0gW10pKS5wdXNoKGNhbGxiYWNrKTtcclxuICAgICAgcmV0dXJuIG9mZi5iaW5kKG51bGwsIGV2ZW50TmFtZSwgY2FsbGJhY2spO1xyXG4gICAgfSxcclxuXHJcbiAgICBvZmYgPSBmdW5jdGlvbihldmVudE5hbWUsIGNhbGxiYWNrKSB7XHJcbiAgICAgIGxpc3RlbmVyc1tldmVudE5hbWVdID0gKGxpc3RlbmVyc1tldmVudE5hbWVdIHx8IFtdKS5maWx0ZXIoZnVuY3Rpb24obGlzdGVuZXIpIHsgcmV0dXJuIGxpc3RlbmVyICE9PSBjYWxsYmFjazsgfSk7XHJcbiAgICB9LFxyXG5cclxuICAgIGZpcmUgPSBmdW5jdGlvbihldmVudE5hbWUsIGV2ZW50RGF0YSkge1xyXG4gICAgICByZXR1cm4gKGxpc3RlbmVyc1tldmVudE5hbWVdIHx8IFtdKVxyXG4gICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24obm90Q2FuY2VsbGVkLCBjYWxsYmFjaykge1xyXG4gICAgICAgICAgcmV0dXJuIG5vdENhbmNlbGxlZCAmJiBjYWxsYmFjayhldmVudERhdGEpICE9PSBmYWxzZTtcclxuICAgICAgICB9LCB0cnVlKTtcclxuICAgIH0sXHJcblxyXG4gICAgY3JlYXRlRXZlbnREYXRhID0gZnVuY3Rpb24oZWwsIGV2ZW50RGF0YSkge1xyXG4gICAgICBldmVudERhdGEgPSBldmVudERhdGEgfHwge307XHJcbiAgICAgIGV2ZW50RGF0YS5pbmRleCA9IHNsaWRlcy5pbmRleE9mKGVsKTtcclxuICAgICAgZXZlbnREYXRhLnNsaWRlID0gZWw7XHJcbiAgICAgIHJldHVybiBldmVudERhdGE7XHJcbiAgICB9LFxyXG5cclxuICAgIGRlY2sgPSB7XHJcbiAgICAgIG9uOiBvbixcclxuICAgICAgb2ZmOiBvZmYsXHJcbiAgICAgIGZpcmU6IGZpcmUsXHJcbiAgICAgIHNsaWRlOiBzbGlkZSxcclxuICAgICAgbmV4dDogc3RlcC5iaW5kKG51bGwsIDEpLFxyXG4gICAgICBwcmV2OiBzdGVwLmJpbmQobnVsbCwgLTEpLFxyXG4gICAgICBwYXJlbnQ6IHBhcmVudCxcclxuICAgICAgc2xpZGVzOiBzbGlkZXNcclxuICAgIH07XHJcblxyXG4gIChwbHVnaW5zIHx8IFtdKS5mb3JFYWNoKGZ1bmN0aW9uKHBsdWdpbikge1xyXG4gICAgcGx1Z2luKGRlY2spO1xyXG4gIH0pO1xyXG5cclxuICBhY3RpdmF0ZSgwKTtcclxuXHJcbiAgcmV0dXJuIGRlY2s7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICBmcm9tOiBmcm9tXHJcbn07XHJcbiIsIi8vIFJlcXVpcmUgTm9kZSBtb2R1bGVzIGluIHRoZSBicm93c2VyIHRoYW5rcyB0byBCcm93c2VyaWZ5OiBodHRwOi8vYnJvd3NlcmlmeS5vcmdcclxudmFyIGJlc3Bva2UgPSByZXF1aXJlKCdiZXNwb2tlJyksXHJcbiAgXHJcbiAgY3ViZSA9IHJlcXVpcmUoJ2Jlc3Bva2UtdGhlbWUtY3ViZScpLFxyXG4gIGtleXMgPSByZXF1aXJlKCdiZXNwb2tlLWtleXMnKSxcclxuICB0b3VjaCA9IHJlcXVpcmUoJ2Jlc3Bva2UtdG91Y2gnKSxcclxuICBidWxsZXRzID0gcmVxdWlyZSgnYmVzcG9rZS1idWxsZXRzJyksXHJcbiAgYmFja2Ryb3AgPSByZXF1aXJlKCdiZXNwb2tlLWJhY2tkcm9wJyksXHJcbiAgc2NhbGUgPSByZXF1aXJlKCdiZXNwb2tlLXNjYWxlJyksXHJcbiAgaGFzaCA9IHJlcXVpcmUoJ2Jlc3Bva2UtaGFzaCcpLFxyXG4gIHByb2dyZXNzID0gcmVxdWlyZSgnYmVzcG9rZS1wcm9ncmVzcycpLFxyXG4gIGZvcm1zID0gcmVxdWlyZSgnYmVzcG9rZS1mb3JtcycpO1xyXG5cclxuLy8gQmVzcG9rZS5qc1xyXG5iZXNwb2tlLmZyb20oJ2FydGljbGUnLCBbXHJcbiAgY3ViZSgpLFxyXG4gIGtleXMoKSxcclxuICB0b3VjaCgpLFxyXG4gIGJ1bGxldHMoJ2xpLCAuYnVsbGV0JyksXHJcbiAgYmFja2Ryb3AoKSxcclxuICBzY2FsZSgpLFxyXG4gIGhhc2goKSxcclxuICBwcm9ncmVzcygpLFxyXG4gIGZvcm1zKClcclxuXSk7XHJcblxyXG4vLyBQcmlzbSBzeW50YXggaGlnaGxpZ2h0aW5nXHJcbi8vIFRoaXMgaXMgYWN0dWFsbHkgbG9hZGVkIGZyb20gXCJib3dlcl9jb21wb25lbnRzXCIgdGhhbmtzIHRvXHJcbi8vIGRlYm93ZXJpZnk6IGh0dHBzOi8vZ2l0aHViLmNvbS9ldWdlbmV3YXJlL2RlYm93ZXJpZnlcclxucmVxdWlyZShcIi4vLi5cXFxcLi5cXFxcYm93ZXJfY29tcG9uZW50c1xcXFxwcmlzbVxcXFxwcmlzbS5qc1wiKTtcclxuXHJcbiJdfQ==
