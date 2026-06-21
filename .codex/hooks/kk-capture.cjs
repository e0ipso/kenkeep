'use strict';
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) =>
  function __init() {
    return (fn && (res = (0, fn[__getOwnPropNames(fn)[0]])((fn = 0))), res);
  };
var __commonJS = (cb, mod) =>
  function __require() {
    return (
      mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod),
      mod.exports
    );
  };
var __export = (target, all) => {
  for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === 'object') || typeof from === 'function') {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, 'default', { value: mod, enumerable: true })
      : target,
    mod
  )
);
var __toCommonJS = mod => __copyProps(__defProp({}, '__esModule', { value: true }), mod);

// node_modules/tsup/assets/cjs_shims.js
var init_cjs_shims = __esm({
  'node_modules/tsup/assets/cjs_shims.js'() {
    'use strict';
  },
});

// node_modules/kind-of/index.js
var require_kind_of = __commonJS({
  'node_modules/kind-of/index.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var toString = Object.prototype.toString;
    module2.exports = function kindOf(val) {
      if (val === void 0) return 'undefined';
      if (val === null) return 'null';
      var type = typeof val;
      if (type === 'boolean') return 'boolean';
      if (type === 'string') return 'string';
      if (type === 'number') return 'number';
      if (type === 'symbol') return 'symbol';
      if (type === 'function') {
        return isGeneratorFn(val) ? 'generatorfunction' : 'function';
      }
      if (isArray(val)) return 'array';
      if (isBuffer(val)) return 'buffer';
      if (isArguments(val)) return 'arguments';
      if (isDate(val)) return 'date';
      if (isError(val)) return 'error';
      if (isRegexp(val)) return 'regexp';
      switch (ctorName(val)) {
        case 'Symbol':
          return 'symbol';
        case 'Promise':
          return 'promise';
        // Set, Map, WeakSet, WeakMap
        case 'WeakMap':
          return 'weakmap';
        case 'WeakSet':
          return 'weakset';
        case 'Map':
          return 'map';
        case 'Set':
          return 'set';
        // 8-bit typed arrays
        case 'Int8Array':
          return 'int8array';
        case 'Uint8Array':
          return 'uint8array';
        case 'Uint8ClampedArray':
          return 'uint8clampedarray';
        // 16-bit typed arrays
        case 'Int16Array':
          return 'int16array';
        case 'Uint16Array':
          return 'uint16array';
        // 32-bit typed arrays
        case 'Int32Array':
          return 'int32array';
        case 'Uint32Array':
          return 'uint32array';
        case 'Float32Array':
          return 'float32array';
        case 'Float64Array':
          return 'float64array';
      }
      if (isGeneratorObj(val)) {
        return 'generator';
      }
      type = toString.call(val);
      switch (type) {
        case '[object Object]':
          return 'object';
        // iterators
        case '[object Map Iterator]':
          return 'mapiterator';
        case '[object Set Iterator]':
          return 'setiterator';
        case '[object String Iterator]':
          return 'stringiterator';
        case '[object Array Iterator]':
          return 'arrayiterator';
      }
      return type.slice(8, -1).toLowerCase().replace(/\s/g, '');
    };
    function ctorName(val) {
      return typeof val.constructor === 'function' ? val.constructor.name : null;
    }
    function isArray(val) {
      if (Array.isArray) return Array.isArray(val);
      return val instanceof Array;
    }
    function isError(val) {
      return (
        val instanceof Error ||
        (typeof val.message === 'string' &&
          val.constructor &&
          typeof val.constructor.stackTraceLimit === 'number')
      );
    }
    function isDate(val) {
      if (val instanceof Date) return true;
      return (
        typeof val.toDateString === 'function' &&
        typeof val.getDate === 'function' &&
        typeof val.setDate === 'function'
      );
    }
    function isRegexp(val) {
      if (val instanceof RegExp) return true;
      return (
        typeof val.flags === 'string' &&
        typeof val.ignoreCase === 'boolean' &&
        typeof val.multiline === 'boolean' &&
        typeof val.global === 'boolean'
      );
    }
    function isGeneratorFn(name, val) {
      return ctorName(name) === 'GeneratorFunction';
    }
    function isGeneratorObj(val) {
      return (
        typeof val.throw === 'function' &&
        typeof val.return === 'function' &&
        typeof val.next === 'function'
      );
    }
    function isArguments(val) {
      try {
        if (typeof val.length === 'number' && typeof val.callee === 'function') {
          return true;
        }
      } catch (err) {
        if (err.message.indexOf('callee') !== -1) {
          return true;
        }
      }
      return false;
    }
    function isBuffer(val) {
      if (val.constructor && typeof val.constructor.isBuffer === 'function') {
        return val.constructor.isBuffer(val);
      }
      return false;
    }
  },
});

// node_modules/is-extendable/index.js
var require_is_extendable = __commonJS({
  'node_modules/is-extendable/index.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    module2.exports = function isExtendable(val) {
      return (
        typeof val !== 'undefined' &&
        val !== null &&
        (typeof val === 'object' || typeof val === 'function')
      );
    };
  },
});

// node_modules/extend-shallow/index.js
var require_extend_shallow = __commonJS({
  'node_modules/extend-shallow/index.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var isObject = require_is_extendable();
    module2.exports = function extend(o) {
      if (!isObject(o)) {
        o = {};
      }
      var len = arguments.length;
      for (var i = 1; i < len; i++) {
        var obj = arguments[i];
        if (isObject(obj)) {
          assign(o, obj);
        }
      }
      return o;
    };
    function assign(a, b) {
      for (var key in b) {
        if (hasOwn(b, key)) {
          a[key] = b[key];
        }
      }
    }
    function hasOwn(obj, key) {
      return Object.prototype.hasOwnProperty.call(obj, key);
    }
  },
});

// node_modules/section-matter/index.js
var require_section_matter = __commonJS({
  'node_modules/section-matter/index.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var typeOf = require_kind_of();
    var extend = require_extend_shallow();
    module2.exports = function (input, options2) {
      if (typeof options2 === 'function') {
        options2 = { parse: options2 };
      }
      var file = toObject(input);
      var defaults = { section_delimiter: '---', parse: identity };
      var opts = extend({}, defaults, options2);
      var delim = opts.section_delimiter;
      var lines = file.content.split(/\r?\n/);
      var sections = null;
      var section = createSection();
      var content = [];
      var stack = [];
      function initSections(val) {
        file.content = val;
        sections = [];
        content = [];
      }
      function closeSection(val) {
        if (stack.length) {
          section.key = getKey(stack[0], delim);
          section.content = val;
          opts.parse(section, sections);
          sections.push(section);
          section = createSection();
          content = [];
          stack = [];
        }
      }
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var len = stack.length;
        var ln = line.trim();
        if (isDelimiter(ln, delim)) {
          if (ln.length === 3 && i !== 0) {
            if (len === 0 || len === 2) {
              content.push(line);
              continue;
            }
            stack.push(ln);
            section.data = content.join('\n');
            content = [];
            continue;
          }
          if (sections === null) {
            initSections(content.join('\n'));
          }
          if (len === 2) {
            closeSection(content.join('\n'));
          }
          stack.push(ln);
          continue;
        }
        content.push(line);
      }
      if (sections === null) {
        initSections(content.join('\n'));
      } else {
        closeSection(content.join('\n'));
      }
      file.sections = sections;
      return file;
    };
    function isDelimiter(line, delim) {
      if (line.slice(0, delim.length) !== delim) {
        return false;
      }
      if (line.charAt(delim.length + 1) === delim.slice(-1)) {
        return false;
      }
      return true;
    }
    function toObject(input) {
      if (typeOf(input) !== 'object') {
        input = { content: input };
      }
      if (typeof input.content !== 'string' && !isBuffer(input.content)) {
        throw new TypeError('expected a buffer or string');
      }
      input.content = input.content.toString();
      input.sections = [];
      return input;
    }
    function getKey(val, delim) {
      return val ? val.slice(delim.length).trim() : '';
    }
    function createSection() {
      return { key: '', data: '', content: '' };
    }
    function identity(val) {
      return val;
    }
    function isBuffer(val) {
      if (val && val.constructor && typeof val.constructor.isBuffer === 'function') {
        return val.constructor.isBuffer(val);
      }
      return false;
    }
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/common.js
var require_common = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/common.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    function isNothing(subject) {
      return typeof subject === 'undefined' || subject === null;
    }
    function isObject(subject) {
      return typeof subject === 'object' && subject !== null;
    }
    function toArray(sequence) {
      if (Array.isArray(sequence)) return sequence;
      else if (isNothing(sequence)) return [];
      return [sequence];
    }
    function extend(target, source) {
      var index, length, key, sourceKeys;
      if (source) {
        sourceKeys = Object.keys(source);
        for (index = 0, length = sourceKeys.length; index < length; index += 1) {
          key = sourceKeys[index];
          target[key] = source[key];
        }
      }
      return target;
    }
    function repeat(string, count) {
      var result = '',
        cycle;
      for (cycle = 0; cycle < count; cycle += 1) {
        result += string;
      }
      return result;
    }
    function isNegativeZero(number) {
      return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
    }
    module2.exports.isNothing = isNothing;
    module2.exports.isObject = isObject;
    module2.exports.toArray = toArray;
    module2.exports.repeat = repeat;
    module2.exports.isNegativeZero = isNegativeZero;
    module2.exports.extend = extend;
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/exception.js
var require_exception = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/exception.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    function YAMLException2(reason, mark) {
      Error.call(this);
      this.name = 'YAMLException';
      this.reason = reason;
      this.mark = mark;
      this.message =
        (this.reason || '(unknown reason)') + (this.mark ? ' ' + this.mark.toString() : '');
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = new Error().stack || '';
      }
    }
    YAMLException2.prototype = Object.create(Error.prototype);
    YAMLException2.prototype.constructor = YAMLException2;
    YAMLException2.prototype.toString = function toString(compact) {
      var result = this.name + ': ';
      result += this.reason || '(unknown reason)';
      if (!compact && this.mark) {
        result += ' ' + this.mark.toString();
      }
      return result;
    };
    module2.exports = YAMLException2;
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/mark.js
var require_mark = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/mark.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var common = require_common();
    function Mark(name, buffer, position, line, column) {
      this.name = name;
      this.buffer = buffer;
      this.position = position;
      this.line = line;
      this.column = column;
    }
    Mark.prototype.getSnippet = function getSnippet(indent, maxLength) {
      var head, start, tail, end, snippet;
      if (!this.buffer) return null;
      indent = indent || 4;
      maxLength = maxLength || 75;
      head = '';
      start = this.position;
      while (start > 0 && '\0\r\n\x85\u2028\u2029'.indexOf(this.buffer.charAt(start - 1)) === -1) {
        start -= 1;
        if (this.position - start > maxLength / 2 - 1) {
          head = ' ... ';
          start += 5;
          break;
        }
      }
      tail = '';
      end = this.position;
      while (
        end < this.buffer.length &&
        '\0\r\n\x85\u2028\u2029'.indexOf(this.buffer.charAt(end)) === -1
      ) {
        end += 1;
        if (end - this.position > maxLength / 2 - 1) {
          tail = ' ... ';
          end -= 5;
          break;
        }
      }
      snippet = this.buffer.slice(start, end);
      return (
        common.repeat(' ', indent) +
        head +
        snippet +
        tail +
        '\n' +
        common.repeat(' ', indent + this.position - start + head.length) +
        '^'
      );
    };
    Mark.prototype.toString = function toString(compact) {
      var snippet,
        where = '';
      if (this.name) {
        where += 'in "' + this.name + '" ';
      }
      where += 'at line ' + (this.line + 1) + ', column ' + (this.column + 1);
      if (!compact) {
        snippet = this.getSnippet();
        if (snippet) {
          where += ':\n' + snippet;
        }
      }
      return where;
    };
    module2.exports = Mark;
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type.js
var require_type = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var YAMLException2 = require_exception();
    var TYPE_CONSTRUCTOR_OPTIONS = [
      'kind',
      'resolve',
      'construct',
      'instanceOf',
      'predicate',
      'represent',
      'defaultStyle',
      'styleAliases',
    ];
    var YAML_NODE_KINDS = ['scalar', 'sequence', 'mapping'];
    function compileStyleAliases(map) {
      var result = {};
      if (map !== null) {
        Object.keys(map).forEach(function (style) {
          map[style].forEach(function (alias) {
            result[String(alias)] = style;
          });
        });
      }
      return result;
    }
    function Type2(tag, options2) {
      options2 = options2 || {};
      Object.keys(options2).forEach(function (name) {
        if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
          throw new YAMLException2(
            'Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.'
          );
        }
      });
      this.tag = tag;
      this.kind = options2['kind'] || null;
      this.resolve =
        options2['resolve'] ||
        function () {
          return true;
        };
      this.construct =
        options2['construct'] ||
        function (data) {
          return data;
        };
      this.instanceOf = options2['instanceOf'] || null;
      this.predicate = options2['predicate'] || null;
      this.represent = options2['represent'] || null;
      this.defaultStyle = options2['defaultStyle'] || null;
      this.styleAliases = compileStyleAliases(options2['styleAliases'] || null);
      if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
        throw new YAMLException2(
          'Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.'
        );
      }
    }
    module2.exports = Type2;
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/schema.js
var require_schema = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/schema.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var common = require_common();
    var YAMLException2 = require_exception();
    var Type2 = require_type();
    function compileList(schema, name, result) {
      var exclude = [];
      schema.include.forEach(function (includedSchema) {
        result = compileList(includedSchema, name, result);
      });
      schema[name].forEach(function (currentType) {
        result.forEach(function (previousType, previousIndex) {
          if (previousType.tag === currentType.tag && previousType.kind === currentType.kind) {
            exclude.push(previousIndex);
          }
        });
        result.push(currentType);
      });
      return result.filter(function (type, index) {
        return exclude.indexOf(index) === -1;
      });
    }
    function compileMap() {
      var result = {
          scalar: {},
          sequence: {},
          mapping: {},
          fallback: {},
        },
        index,
        length;
      function collectType(type) {
        result[type.kind][type.tag] = result['fallback'][type.tag] = type;
      }
      for (index = 0, length = arguments.length; index < length; index += 1) {
        arguments[index].forEach(collectType);
      }
      return result;
    }
    function Schema2(definition) {
      this.include = definition.include || [];
      this.implicit = definition.implicit || [];
      this.explicit = definition.explicit || [];
      this.implicit.forEach(function (type) {
        if (type.loadKind && type.loadKind !== 'scalar') {
          throw new YAMLException2(
            'There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.'
          );
        }
      });
      this.compiledImplicit = compileList(this, 'implicit', []);
      this.compiledExplicit = compileList(this, 'explicit', []);
      this.compiledTypeMap = compileMap(this.compiledImplicit, this.compiledExplicit);
    }
    Schema2.DEFAULT = null;
    Schema2.create = function createSchema() {
      var schemas, types2;
      switch (arguments.length) {
        case 1:
          schemas = Schema2.DEFAULT;
          types2 = arguments[0];
          break;
        case 2:
          schemas = arguments[0];
          types2 = arguments[1];
          break;
        default:
          throw new YAMLException2('Wrong number of arguments for Schema.create function');
      }
      schemas = common.toArray(schemas);
      types2 = common.toArray(types2);
      if (
        !schemas.every(function (schema) {
          return schema instanceof Schema2;
        })
      ) {
        throw new YAMLException2(
          'Specified list of super schemas (or a single Schema object) contains a non-Schema object.'
        );
      }
      if (
        !types2.every(function (type) {
          return type instanceof Type2;
        })
      ) {
        throw new YAMLException2(
          'Specified list of YAML types (or a single Type object) contains a non-Type object.'
        );
      }
      return new Schema2({
        include: schemas,
        explicit: types2,
      });
    };
    module2.exports = Schema2;
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/str.js
var require_str = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/str.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Type2 = require_type();
    module2.exports = new Type2('tag:yaml.org,2002:str', {
      kind: 'scalar',
      construct: function (data) {
        return data !== null ? data : '';
      },
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/seq.js
var require_seq = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/seq.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Type2 = require_type();
    module2.exports = new Type2('tag:yaml.org,2002:seq', {
      kind: 'sequence',
      construct: function (data) {
        return data !== null ? data : [];
      },
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/map.js
var require_map = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/map.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Type2 = require_type();
    module2.exports = new Type2('tag:yaml.org,2002:map', {
      kind: 'mapping',
      construct: function (data) {
        return data !== null ? data : {};
      },
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/schema/failsafe.js
var require_failsafe = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/schema/failsafe.js'(
    exports2,
    module2
  ) {
    'use strict';
    init_cjs_shims();
    var Schema2 = require_schema();
    module2.exports = new Schema2({
      explicit: [require_str(), require_seq(), require_map()],
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/null.js
var require_null = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/null.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Type2 = require_type();
    function resolveYamlNull(data) {
      if (data === null) return true;
      var max = data.length;
      return (
        (max === 1 && data === '~') ||
        (max === 4 && (data === 'null' || data === 'Null' || data === 'NULL'))
      );
    }
    function constructYamlNull() {
      return null;
    }
    function isNull(object) {
      return object === null;
    }
    module2.exports = new Type2('tag:yaml.org,2002:null', {
      kind: 'scalar',
      resolve: resolveYamlNull,
      construct: constructYamlNull,
      predicate: isNull,
      represent: {
        canonical: function () {
          return '~';
        },
        lowercase: function () {
          return 'null';
        },
        uppercase: function () {
          return 'NULL';
        },
        camelcase: function () {
          return 'Null';
        },
      },
      defaultStyle: 'lowercase',
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/bool.js
var require_bool = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/bool.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Type2 = require_type();
    function resolveYamlBoolean(data) {
      if (data === null) return false;
      var max = data.length;
      return (
        (max === 4 && (data === 'true' || data === 'True' || data === 'TRUE')) ||
        (max === 5 && (data === 'false' || data === 'False' || data === 'FALSE'))
      );
    }
    function constructYamlBoolean(data) {
      return data === 'true' || data === 'True' || data === 'TRUE';
    }
    function isBoolean(object) {
      return Object.prototype.toString.call(object) === '[object Boolean]';
    }
    module2.exports = new Type2('tag:yaml.org,2002:bool', {
      kind: 'scalar',
      resolve: resolveYamlBoolean,
      construct: constructYamlBoolean,
      predicate: isBoolean,
      represent: {
        lowercase: function (object) {
          return object ? 'true' : 'false';
        },
        uppercase: function (object) {
          return object ? 'TRUE' : 'FALSE';
        },
        camelcase: function (object) {
          return object ? 'True' : 'False';
        },
      },
      defaultStyle: 'lowercase',
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/int.js
var require_int = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/int.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var common = require_common();
    var Type2 = require_type();
    function isHexCode(c) {
      return (48 <= c && c <= 57) || (65 <= c && c <= 70) || (97 <= c && c <= 102);
    }
    function isOctCode(c) {
      return 48 <= c && c <= 55;
    }
    function isDecCode(c) {
      return 48 <= c && c <= 57;
    }
    function resolveYamlInteger(data) {
      if (data === null) return false;
      var max = data.length,
        index = 0,
        hasDigits = false,
        ch;
      if (!max) return false;
      ch = data[index];
      if (ch === '-' || ch === '+') {
        ch = data[++index];
      }
      if (ch === '0') {
        if (index + 1 === max) return true;
        ch = data[++index];
        if (ch === 'b') {
          index++;
          for (; index < max; index++) {
            ch = data[index];
            if (ch === '_') continue;
            if (ch !== '0' && ch !== '1') return false;
            hasDigits = true;
          }
          return hasDigits && ch !== '_';
        }
        if (ch === 'x') {
          index++;
          for (; index < max; index++) {
            ch = data[index];
            if (ch === '_') continue;
            if (!isHexCode(data.charCodeAt(index))) return false;
            hasDigits = true;
          }
          return hasDigits && ch !== '_';
        }
        for (; index < max; index++) {
          ch = data[index];
          if (ch === '_') continue;
          if (!isOctCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && ch !== '_';
      }
      if (ch === '_') return false;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (ch === ':') break;
        if (!isDecCode(data.charCodeAt(index))) {
          return false;
        }
        hasDigits = true;
      }
      if (!hasDigits || ch === '_') return false;
      if (ch !== ':') return true;
      return /^(:[0-5]?[0-9])+$/.test(data.slice(index));
    }
    function constructYamlInteger(data) {
      var value = data,
        sign = 1,
        ch,
        base,
        digits = [];
      if (value.indexOf('_') !== -1) {
        value = value.replace(/_/g, '');
      }
      ch = value[0];
      if (ch === '-' || ch === '+') {
        if (ch === '-') sign = -1;
        value = value.slice(1);
        ch = value[0];
      }
      if (value === '0') return 0;
      if (ch === '0') {
        if (value[1] === 'b') return sign * parseInt(value.slice(2), 2);
        if (value[1] === 'x') return sign * parseInt(value, 16);
        return sign * parseInt(value, 8);
      }
      if (value.indexOf(':') !== -1) {
        value.split(':').forEach(function (v) {
          digits.unshift(parseInt(v, 10));
        });
        value = 0;
        base = 1;
        digits.forEach(function (d) {
          value += d * base;
          base *= 60;
        });
        return sign * value;
      }
      return sign * parseInt(value, 10);
    }
    function isInteger(object) {
      return (
        Object.prototype.toString.call(object) === '[object Number]' &&
        object % 1 === 0 &&
        !common.isNegativeZero(object)
      );
    }
    module2.exports = new Type2('tag:yaml.org,2002:int', {
      kind: 'scalar',
      resolve: resolveYamlInteger,
      construct: constructYamlInteger,
      predicate: isInteger,
      represent: {
        binary: function (obj) {
          return obj >= 0 ? '0b' + obj.toString(2) : '-0b' + obj.toString(2).slice(1);
        },
        octal: function (obj) {
          return obj >= 0 ? '0' + obj.toString(8) : '-0' + obj.toString(8).slice(1);
        },
        decimal: function (obj) {
          return obj.toString(10);
        },
        /* eslint-disable max-len */
        hexadecimal: function (obj) {
          return obj >= 0
            ? '0x' + obj.toString(16).toUpperCase()
            : '-0x' + obj.toString(16).toUpperCase().slice(1);
        },
      },
      defaultStyle: 'decimal',
      styleAliases: {
        binary: [2, 'bin'],
        octal: [8, 'oct'],
        decimal: [10, 'dec'],
        hexadecimal: [16, 'hex'],
      },
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/float.js
var require_float = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/float.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var common = require_common();
    var Type2 = require_type();
    var YAML_FLOAT_PATTERN = new RegExp(
      // 2.5e4, 2.5 and integers
      '^(?:[-+]?(?:0|[1-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$'
    );
    function resolveYamlFloat(data) {
      if (data === null) return false;
      if (
        !YAML_FLOAT_PATTERN.test(data) || // Quick hack to not allow integers end with `_`
        // Probably should update regexp & check speed
        data[data.length - 1] === '_'
      ) {
        return false;
      }
      return true;
    }
    function constructYamlFloat(data) {
      var value, sign, base, digits;
      value = data.replace(/_/g, '').toLowerCase();
      sign = value[0] === '-' ? -1 : 1;
      digits = [];
      if ('+-'.indexOf(value[0]) >= 0) {
        value = value.slice(1);
      }
      if (value === '.inf') {
        return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      } else if (value === '.nan') {
        return NaN;
      } else if (value.indexOf(':') >= 0) {
        value.split(':').forEach(function (v) {
          digits.unshift(parseFloat(v, 10));
        });
        value = 0;
        base = 1;
        digits.forEach(function (d) {
          value += d * base;
          base *= 60;
        });
        return sign * value;
      }
      return sign * parseFloat(value, 10);
    }
    var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
    function representYamlFloat(object, style) {
      var res;
      if (isNaN(object)) {
        switch (style) {
          case 'lowercase':
            return '.nan';
          case 'uppercase':
            return '.NAN';
          case 'camelcase':
            return '.NaN';
        }
      } else if (Number.POSITIVE_INFINITY === object) {
        switch (style) {
          case 'lowercase':
            return '.inf';
          case 'uppercase':
            return '.INF';
          case 'camelcase':
            return '.Inf';
        }
      } else if (Number.NEGATIVE_INFINITY === object) {
        switch (style) {
          case 'lowercase':
            return '-.inf';
          case 'uppercase':
            return '-.INF';
          case 'camelcase':
            return '-.Inf';
        }
      } else if (common.isNegativeZero(object)) {
        return '-0.0';
      }
      res = object.toString(10);
      return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace('e', '.e') : res;
    }
    function isFloat(object) {
      return (
        Object.prototype.toString.call(object) === '[object Number]' &&
        (object % 1 !== 0 || common.isNegativeZero(object))
      );
    }
    module2.exports = new Type2('tag:yaml.org,2002:float', {
      kind: 'scalar',
      resolve: resolveYamlFloat,
      construct: constructYamlFloat,
      predicate: isFloat,
      represent: representYamlFloat,
      defaultStyle: 'lowercase',
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/schema/json.js
var require_json = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/schema/json.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Schema2 = require_schema();
    module2.exports = new Schema2({
      include: [require_failsafe()],
      implicit: [require_null(), require_bool(), require_int(), require_float()],
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/schema/core.js
var require_core = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/schema/core.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Schema2 = require_schema();
    module2.exports = new Schema2({
      include: [require_json()],
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/timestamp.js
var require_timestamp = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/timestamp.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Type2 = require_type();
    var YAML_DATE_REGEXP = new RegExp('^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$');
    var YAML_TIMESTAMP_REGEXP = new RegExp(
      '^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$'
    );
    function resolveYamlTimestamp(data) {
      if (data === null) return false;
      if (YAML_DATE_REGEXP.exec(data) !== null) return true;
      if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
      return false;
    }
    function constructYamlTimestamp(data) {
      var match,
        year,
        month,
        day,
        hour,
        minute,
        second,
        fraction = 0,
        delta = null,
        tz_hour,
        tz_minute,
        date;
      match = YAML_DATE_REGEXP.exec(data);
      if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
      if (match === null) throw new Error('Date resolve error');
      year = +match[1];
      month = +match[2] - 1;
      day = +match[3];
      if (!match[4]) {
        return new Date(Date.UTC(year, month, day));
      }
      hour = +match[4];
      minute = +match[5];
      second = +match[6];
      if (match[7]) {
        fraction = match[7].slice(0, 3);
        while (fraction.length < 3) {
          fraction += '0';
        }
        fraction = +fraction;
      }
      if (match[9]) {
        tz_hour = +match[10];
        tz_minute = +(match[11] || 0);
        delta = (tz_hour * 60 + tz_minute) * 6e4;
        if (match[9] === '-') delta = -delta;
      }
      date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
      if (delta) date.setTime(date.getTime() - delta);
      return date;
    }
    function representYamlTimestamp(object) {
      return object.toISOString();
    }
    module2.exports = new Type2('tag:yaml.org,2002:timestamp', {
      kind: 'scalar',
      resolve: resolveYamlTimestamp,
      construct: constructYamlTimestamp,
      instanceOf: Date,
      represent: representYamlTimestamp,
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/merge.js
var require_merge = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/merge.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Type2 = require_type();
    function resolveYamlMerge(data) {
      return data === '<<' || data === null;
    }
    module2.exports = new Type2('tag:yaml.org,2002:merge', {
      kind: 'scalar',
      resolve: resolveYamlMerge,
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/binary.js
var require_binary = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/binary.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var NodeBuffer;
    try {
      _require = require;
      NodeBuffer = _require('buffer').Buffer;
    } catch (__) {}
    var _require;
    var Type2 = require_type();
    var BASE64_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r';
    function resolveYamlBinary(data) {
      if (data === null) return false;
      var code,
        idx,
        bitlen = 0,
        max = data.length,
        map = BASE64_MAP;
      for (idx = 0; idx < max; idx++) {
        code = map.indexOf(data.charAt(idx));
        if (code > 64) continue;
        if (code < 0) return false;
        bitlen += 6;
      }
      return bitlen % 8 === 0;
    }
    function constructYamlBinary(data) {
      var idx,
        tailbits,
        input = data.replace(/[\r\n=]/g, ''),
        max = input.length,
        map = BASE64_MAP,
        bits = 0,
        result = [];
      for (idx = 0; idx < max; idx++) {
        if (idx % 4 === 0 && idx) {
          result.push((bits >> 16) & 255);
          result.push((bits >> 8) & 255);
          result.push(bits & 255);
        }
        bits = (bits << 6) | map.indexOf(input.charAt(idx));
      }
      tailbits = (max % 4) * 6;
      if (tailbits === 0) {
        result.push((bits >> 16) & 255);
        result.push((bits >> 8) & 255);
        result.push(bits & 255);
      } else if (tailbits === 18) {
        result.push((bits >> 10) & 255);
        result.push((bits >> 2) & 255);
      } else if (tailbits === 12) {
        result.push((bits >> 4) & 255);
      }
      if (NodeBuffer) {
        return NodeBuffer.from ? NodeBuffer.from(result) : new NodeBuffer(result);
      }
      return result;
    }
    function representYamlBinary(object) {
      var result = '',
        bits = 0,
        idx,
        tail,
        max = object.length,
        map = BASE64_MAP;
      for (idx = 0; idx < max; idx++) {
        if (idx % 3 === 0 && idx) {
          result += map[(bits >> 18) & 63];
          result += map[(bits >> 12) & 63];
          result += map[(bits >> 6) & 63];
          result += map[bits & 63];
        }
        bits = (bits << 8) + object[idx];
      }
      tail = max % 3;
      if (tail === 0) {
        result += map[(bits >> 18) & 63];
        result += map[(bits >> 12) & 63];
        result += map[(bits >> 6) & 63];
        result += map[bits & 63];
      } else if (tail === 2) {
        result += map[(bits >> 10) & 63];
        result += map[(bits >> 4) & 63];
        result += map[(bits << 2) & 63];
        result += map[64];
      } else if (tail === 1) {
        result += map[(bits >> 2) & 63];
        result += map[(bits << 4) & 63];
        result += map[64];
        result += map[64];
      }
      return result;
    }
    function isBinary(object) {
      return NodeBuffer && NodeBuffer.isBuffer(object);
    }
    module2.exports = new Type2('tag:yaml.org,2002:binary', {
      kind: 'scalar',
      resolve: resolveYamlBinary,
      construct: constructYamlBinary,
      predicate: isBinary,
      represent: representYamlBinary,
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/omap.js
var require_omap = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/omap.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Type2 = require_type();
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    var _toString = Object.prototype.toString;
    function resolveYamlOmap(data) {
      if (data === null) return true;
      var objectKeys = [],
        index,
        length,
        pair,
        pairKey,
        pairHasKey,
        object = data;
      for (index = 0, length = object.length; index < length; index += 1) {
        pair = object[index];
        pairHasKey = false;
        if (_toString.call(pair) !== '[object Object]') return false;
        for (pairKey in pair) {
          if (_hasOwnProperty.call(pair, pairKey)) {
            if (!pairHasKey) pairHasKey = true;
            else return false;
          }
        }
        if (!pairHasKey) return false;
        if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
        else return false;
      }
      return true;
    }
    function constructYamlOmap(data) {
      return data !== null ? data : [];
    }
    module2.exports = new Type2('tag:yaml.org,2002:omap', {
      kind: 'sequence',
      resolve: resolveYamlOmap,
      construct: constructYamlOmap,
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/pairs.js
var require_pairs = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/pairs.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Type2 = require_type();
    var _toString = Object.prototype.toString;
    function resolveYamlPairs(data) {
      if (data === null) return true;
      var index,
        length,
        pair,
        keys,
        result,
        object = data;
      result = new Array(object.length);
      for (index = 0, length = object.length; index < length; index += 1) {
        pair = object[index];
        if (_toString.call(pair) !== '[object Object]') return false;
        keys = Object.keys(pair);
        if (keys.length !== 1) return false;
        result[index] = [keys[0], pair[keys[0]]];
      }
      return true;
    }
    function constructYamlPairs(data) {
      if (data === null) return [];
      var index,
        length,
        pair,
        keys,
        result,
        object = data;
      result = new Array(object.length);
      for (index = 0, length = object.length; index < length; index += 1) {
        pair = object[index];
        keys = Object.keys(pair);
        result[index] = [keys[0], pair[keys[0]]];
      }
      return result;
    }
    module2.exports = new Type2('tag:yaml.org,2002:pairs', {
      kind: 'sequence',
      resolve: resolveYamlPairs,
      construct: constructYamlPairs,
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/set.js
var require_set = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/set.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Type2 = require_type();
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    function resolveYamlSet(data) {
      if (data === null) return true;
      var key,
        object = data;
      for (key in object) {
        if (_hasOwnProperty.call(object, key)) {
          if (object[key] !== null) return false;
        }
      }
      return true;
    }
    function constructYamlSet(data) {
      return data !== null ? data : {};
    }
    module2.exports = new Type2('tag:yaml.org,2002:set', {
      kind: 'mapping',
      resolve: resolveYamlSet,
      construct: constructYamlSet,
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/schema/default_safe.js
var require_default_safe = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/schema/default_safe.js'(
    exports2,
    module2
  ) {
    'use strict';
    init_cjs_shims();
    var Schema2 = require_schema();
    module2.exports = new Schema2({
      include: [require_core()],
      implicit: [require_timestamp(), require_merge()],
      explicit: [require_binary(), require_omap(), require_pairs(), require_set()],
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/js/undefined.js
var require_undefined = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/js/undefined.js'(
    exports2,
    module2
  ) {
    'use strict';
    init_cjs_shims();
    var Type2 = require_type();
    function resolveJavascriptUndefined() {
      return true;
    }
    function constructJavascriptUndefined() {
      return void 0;
    }
    function representJavascriptUndefined() {
      return '';
    }
    function isUndefined(object) {
      return typeof object === 'undefined';
    }
    module2.exports = new Type2('tag:yaml.org,2002:js/undefined', {
      kind: 'scalar',
      resolve: resolveJavascriptUndefined,
      construct: constructJavascriptUndefined,
      predicate: isUndefined,
      represent: representJavascriptUndefined,
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/js/regexp.js
var require_regexp = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/js/regexp.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Type2 = require_type();
    function resolveJavascriptRegExp(data) {
      if (data === null) return false;
      if (data.length === 0) return false;
      var regexp = data,
        tail = /\/([gim]*)$/.exec(data),
        modifiers = '';
      if (regexp[0] === '/') {
        if (tail) modifiers = tail[1];
        if (modifiers.length > 3) return false;
        if (regexp[regexp.length - modifiers.length - 1] !== '/') return false;
      }
      return true;
    }
    function constructJavascriptRegExp(data) {
      var regexp = data,
        tail = /\/([gim]*)$/.exec(data),
        modifiers = '';
      if (regexp[0] === '/') {
        if (tail) modifiers = tail[1];
        regexp = regexp.slice(1, regexp.length - modifiers.length - 1);
      }
      return new RegExp(regexp, modifiers);
    }
    function representJavascriptRegExp(object) {
      var result = '/' + object.source + '/';
      if (object.global) result += 'g';
      if (object.multiline) result += 'm';
      if (object.ignoreCase) result += 'i';
      return result;
    }
    function isRegExp(object) {
      return Object.prototype.toString.call(object) === '[object RegExp]';
    }
    module2.exports = new Type2('tag:yaml.org,2002:js/regexp', {
      kind: 'scalar',
      resolve: resolveJavascriptRegExp,
      construct: constructJavascriptRegExp,
      predicate: isRegExp,
      represent: representJavascriptRegExp,
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/js/function.js
var require_function = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/type/js/function.js'(
    exports2,
    module2
  ) {
    'use strict';
    init_cjs_shims();
    var esprima;
    try {
      _require = require;
      esprima = _require('esprima');
    } catch (_) {
      if (typeof window !== 'undefined') esprima = window.esprima;
    }
    var _require;
    var Type2 = require_type();
    function resolveJavascriptFunction(data) {
      if (data === null) return false;
      try {
        var source = '(' + data + ')',
          ast = esprima.parse(source, { range: true });
        if (
          ast.type !== 'Program' ||
          ast.body.length !== 1 ||
          ast.body[0].type !== 'ExpressionStatement' ||
          (ast.body[0].expression.type !== 'ArrowFunctionExpression' &&
            ast.body[0].expression.type !== 'FunctionExpression')
        ) {
          return false;
        }
        return true;
      } catch (err) {
        return false;
      }
    }
    function constructJavascriptFunction(data) {
      var source = '(' + data + ')',
        ast = esprima.parse(source, { range: true }),
        params = [],
        body;
      if (
        ast.type !== 'Program' ||
        ast.body.length !== 1 ||
        ast.body[0].type !== 'ExpressionStatement' ||
        (ast.body[0].expression.type !== 'ArrowFunctionExpression' &&
          ast.body[0].expression.type !== 'FunctionExpression')
      ) {
        throw new Error('Failed to resolve function');
      }
      ast.body[0].expression.params.forEach(function (param) {
        params.push(param.name);
      });
      body = ast.body[0].expression.body.range;
      if (ast.body[0].expression.body.type === 'BlockStatement') {
        return new Function(params, source.slice(body[0] + 1, body[1] - 1));
      }
      return new Function(params, 'return ' + source.slice(body[0], body[1]));
    }
    function representJavascriptFunction(object) {
      return object.toString();
    }
    function isFunction(object) {
      return Object.prototype.toString.call(object) === '[object Function]';
    }
    module2.exports = new Type2('tag:yaml.org,2002:js/function', {
      kind: 'scalar',
      resolve: resolveJavascriptFunction,
      construct: constructJavascriptFunction,
      predicate: isFunction,
      represent: representJavascriptFunction,
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/schema/default_full.js
var require_default_full = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/schema/default_full.js'(
    exports2,
    module2
  ) {
    'use strict';
    init_cjs_shims();
    var Schema2 = require_schema();
    module2.exports = Schema2.DEFAULT = new Schema2({
      include: [require_default_safe()],
      explicit: [require_undefined(), require_regexp(), require_function()],
    });
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/loader.js
var require_loader = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/loader.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var common = require_common();
    var YAMLException2 = require_exception();
    var Mark = require_mark();
    var DEFAULT_SAFE_SCHEMA = require_default_safe();
    var DEFAULT_FULL_SCHEMA = require_default_full();
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    var CONTEXT_FLOW_IN = 1;
    var CONTEXT_FLOW_OUT = 2;
    var CONTEXT_BLOCK_IN = 3;
    var CONTEXT_BLOCK_OUT = 4;
    var CHOMPING_CLIP = 1;
    var CHOMPING_STRIP = 2;
    var CHOMPING_KEEP = 3;
    var PATTERN_NON_PRINTABLE =
      /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
    var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
    var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
    var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
    var PATTERN_TAG_URI =
      /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
    function _class(obj) {
      return Object.prototype.toString.call(obj);
    }
    function is_EOL(c) {
      return c === 10 || c === 13;
    }
    function is_WHITE_SPACE(c) {
      return c === 9 || c === 32;
    }
    function is_WS_OR_EOL(c) {
      return c === 9 || c === 32 || c === 10 || c === 13;
    }
    function is_FLOW_INDICATOR(c) {
      return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
    }
    function fromHexCode(c) {
      var lc;
      if (48 <= c && c <= 57) {
        return c - 48;
      }
      lc = c | 32;
      if (97 <= lc && lc <= 102) {
        return lc - 97 + 10;
      }
      return -1;
    }
    function escapedHexLen(c) {
      if (c === 120) {
        return 2;
      }
      if (c === 117) {
        return 4;
      }
      if (c === 85) {
        return 8;
      }
      return 0;
    }
    function fromDecimalCode(c) {
      if (48 <= c && c <= 57) {
        return c - 48;
      }
      return -1;
    }
    function simpleEscapeSequence(c) {
      return c === 48
        ? '\0'
        : c === 97
          ? '\x07'
          : c === 98
            ? '\b'
            : c === 116
              ? '	'
              : c === 9
                ? '	'
                : c === 110
                  ? '\n'
                  : c === 118
                    ? '\v'
                    : c === 102
                      ? '\f'
                      : c === 114
                        ? '\r'
                        : c === 101
                          ? '\x1B'
                          : c === 32
                            ? ' '
                            : c === 34
                              ? '"'
                              : c === 47
                                ? '/'
                                : c === 92
                                  ? '\\'
                                  : c === 78
                                    ? '\x85'
                                    : c === 95
                                      ? '\xA0'
                                      : c === 76
                                        ? '\u2028'
                                        : c === 80
                                          ? '\u2029'
                                          : '';
    }
    function charFromCodepoint(c) {
      if (c <= 65535) {
        return String.fromCharCode(c);
      }
      return String.fromCharCode(((c - 65536) >> 10) + 55296, ((c - 65536) & 1023) + 56320);
    }
    function setProperty(object, key, value) {
      if (key === '__proto__') {
        Object.defineProperty(object, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value,
        });
      } else {
        object[key] = value;
      }
    }
    var simpleEscapeCheck = new Array(256);
    var simpleEscapeMap = new Array(256);
    for (i = 0; i < 256; i++) {
      simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
      simpleEscapeMap[i] = simpleEscapeSequence(i);
    }
    var i;
    function State(input, options2) {
      this.input = input;
      this.filename = options2['filename'] || null;
      this.schema = options2['schema'] || DEFAULT_FULL_SCHEMA;
      this.onWarning = options2['onWarning'] || null;
      this.legacy = options2['legacy'] || false;
      this.json = options2['json'] || false;
      this.listener = options2['listener'] || null;
      this.implicitTypes = this.schema.compiledImplicit;
      this.typeMap = this.schema.compiledTypeMap;
      this.length = input.length;
      this.position = 0;
      this.line = 0;
      this.lineStart = 0;
      this.lineIndent = 0;
      this.documents = [];
    }
    function generateError(state, message) {
      return new YAMLException2(
        message,
        new Mark(
          state.filename,
          state.input,
          state.position,
          state.line,
          state.position - state.lineStart
        )
      );
    }
    function throwError(state, message) {
      throw generateError(state, message);
    }
    function throwWarning(state, message) {
      if (state.onWarning) {
        state.onWarning.call(null, generateError(state, message));
      }
    }
    var directiveHandlers = {
      YAML: function handleYamlDirective(state, name, args) {
        var match, major, minor;
        if (state.version !== null) {
          throwError(state, 'duplication of %YAML directive');
        }
        if (args.length !== 1) {
          throwError(state, 'YAML directive accepts exactly one argument');
        }
        match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
        if (match === null) {
          throwError(state, 'ill-formed argument of the YAML directive');
        }
        major = parseInt(match[1], 10);
        minor = parseInt(match[2], 10);
        if (major !== 1) {
          throwError(state, 'unacceptable YAML version of the document');
        }
        state.version = args[0];
        state.checkLineBreaks = minor < 2;
        if (minor !== 1 && minor !== 2) {
          throwWarning(state, 'unsupported YAML version of the document');
        }
      },
      TAG: function handleTagDirective(state, name, args) {
        var handle, prefix;
        if (args.length !== 2) {
          throwError(state, 'TAG directive accepts exactly two arguments');
        }
        handle = args[0];
        prefix = args[1];
        if (!PATTERN_TAG_HANDLE.test(handle)) {
          throwError(state, 'ill-formed tag handle (first argument) of the TAG directive');
        }
        if (_hasOwnProperty.call(state.tagMap, handle)) {
          throwError(
            state,
            'there is a previously declared suffix for "' + handle + '" tag handle'
          );
        }
        if (!PATTERN_TAG_URI.test(prefix)) {
          throwError(state, 'ill-formed tag prefix (second argument) of the TAG directive');
        }
        state.tagMap[handle] = prefix;
      },
    };
    function captureSegment(state, start, end, checkJson) {
      var _position, _length, _character, _result;
      if (start < end) {
        _result = state.input.slice(start, end);
        if (checkJson) {
          for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
            _character = _result.charCodeAt(_position);
            if (!(_character === 9 || (32 <= _character && _character <= 1114111))) {
              throwError(state, 'expected valid JSON character');
            }
          }
        } else if (PATTERN_NON_PRINTABLE.test(_result)) {
          throwError(state, 'the stream contains non-printable characters');
        }
        state.result += _result;
      }
    }
    function mergeMappings(state, destination, source, overridableKeys) {
      var sourceKeys, key, index, quantity;
      if (!common.isObject(source)) {
        throwError(state, 'cannot merge mappings; the provided source object is unacceptable');
      }
      sourceKeys = Object.keys(source);
      for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
        key = sourceKeys[index];
        if (!_hasOwnProperty.call(destination, key)) {
          setProperty(destination, key, source[key]);
          overridableKeys[key] = true;
        }
      }
    }
    function storeMappingPair(
      state,
      _result,
      overridableKeys,
      keyTag,
      keyNode,
      valueNode,
      startLine,
      startPos
    ) {
      var index, quantity;
      if (Array.isArray(keyNode)) {
        keyNode = Array.prototype.slice.call(keyNode);
        for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
          if (Array.isArray(keyNode[index])) {
            throwError(state, 'nested arrays are not supported inside keys');
          }
          if (typeof keyNode === 'object' && _class(keyNode[index]) === '[object Object]') {
            keyNode[index] = '[object Object]';
          }
        }
      }
      if (typeof keyNode === 'object' && _class(keyNode) === '[object Object]') {
        keyNode = '[object Object]';
      }
      keyNode = String(keyNode);
      if (_result === null) {
        _result = {};
      }
      if (keyTag === 'tag:yaml.org,2002:merge') {
        if (Array.isArray(valueNode)) {
          for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
            mergeMappings(state, _result, valueNode[index], overridableKeys);
          }
        } else {
          mergeMappings(state, _result, valueNode, overridableKeys);
        }
      } else {
        if (
          !state.json &&
          !_hasOwnProperty.call(overridableKeys, keyNode) &&
          _hasOwnProperty.call(_result, keyNode)
        ) {
          state.line = startLine || state.line;
          state.position = startPos || state.position;
          throwError(state, 'duplicated mapping key');
        }
        setProperty(_result, keyNode, valueNode);
        delete overridableKeys[keyNode];
      }
      return _result;
    }
    function readLineBreak(state) {
      var ch;
      ch = state.input.charCodeAt(state.position);
      if (ch === 10) {
        state.position++;
      } else if (ch === 13) {
        state.position++;
        if (state.input.charCodeAt(state.position) === 10) {
          state.position++;
        }
      } else {
        throwError(state, 'a line break is expected');
      }
      state.line += 1;
      state.lineStart = state.position;
    }
    function skipSeparationSpace(state, allowComments, checkIndent) {
      var lineBreaks = 0,
        ch = state.input.charCodeAt(state.position);
      while (ch !== 0) {
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (allowComments && ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 10 && ch !== 13 && ch !== 0);
        }
        if (is_EOL(ch)) {
          readLineBreak(state);
          ch = state.input.charCodeAt(state.position);
          lineBreaks++;
          state.lineIndent = 0;
          while (ch === 32) {
            state.lineIndent++;
            ch = state.input.charCodeAt(++state.position);
          }
        } else {
          break;
        }
      }
      if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
        throwWarning(state, 'deficient indentation');
      }
      return lineBreaks;
    }
    function testDocumentSeparator(state) {
      var _position = state.position,
        ch;
      ch = state.input.charCodeAt(_position);
      if (
        (ch === 45 || ch === 46) &&
        ch === state.input.charCodeAt(_position + 1) &&
        ch === state.input.charCodeAt(_position + 2)
      ) {
        _position += 3;
        ch = state.input.charCodeAt(_position);
        if (ch === 0 || is_WS_OR_EOL(ch)) {
          return true;
        }
      }
      return false;
    }
    function writeFoldedLines(state, count) {
      if (count === 1) {
        state.result += ' ';
      } else if (count > 1) {
        state.result += common.repeat('\n', count - 1);
      }
    }
    function readPlainScalar(state, nodeIndent, withinFlowCollection) {
      var preceding,
        following,
        captureStart,
        captureEnd,
        hasPendingContent,
        _line,
        _lineStart,
        _lineIndent,
        _kind = state.kind,
        _result = state.result,
        ch;
      ch = state.input.charCodeAt(state.position);
      if (
        is_WS_OR_EOL(ch) ||
        is_FLOW_INDICATOR(ch) ||
        ch === 35 ||
        ch === 38 ||
        ch === 42 ||
        ch === 33 ||
        ch === 124 ||
        ch === 62 ||
        ch === 39 ||
        ch === 34 ||
        ch === 37 ||
        ch === 64 ||
        ch === 96
      ) {
        return false;
      }
      if (ch === 63 || ch === 45) {
        following = state.input.charCodeAt(state.position + 1);
        if (is_WS_OR_EOL(following) || (withinFlowCollection && is_FLOW_INDICATOR(following))) {
          return false;
        }
      }
      state.kind = 'scalar';
      state.result = '';
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
      while (ch !== 0) {
        if (ch === 58) {
          following = state.input.charCodeAt(state.position + 1);
          if (is_WS_OR_EOL(following) || (withinFlowCollection && is_FLOW_INDICATOR(following))) {
            break;
          }
        } else if (ch === 35) {
          preceding = state.input.charCodeAt(state.position - 1);
          if (is_WS_OR_EOL(preceding)) {
            break;
          }
        } else if (
          (state.position === state.lineStart && testDocumentSeparator(state)) ||
          (withinFlowCollection && is_FLOW_INDICATOR(ch))
        ) {
          break;
        } else if (is_EOL(ch)) {
          _line = state.line;
          _lineStart = state.lineStart;
          _lineIndent = state.lineIndent;
          skipSeparationSpace(state, false, -1);
          if (state.lineIndent >= nodeIndent) {
            hasPendingContent = true;
            ch = state.input.charCodeAt(state.position);
            continue;
          } else {
            state.position = captureEnd;
            state.line = _line;
            state.lineStart = _lineStart;
            state.lineIndent = _lineIndent;
            break;
          }
        }
        if (hasPendingContent) {
          captureSegment(state, captureStart, captureEnd, false);
          writeFoldedLines(state, state.line - _line);
          captureStart = captureEnd = state.position;
          hasPendingContent = false;
        }
        if (!is_WHITE_SPACE(ch)) {
          captureEnd = state.position + 1;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, captureEnd, false);
      if (state.result) {
        return true;
      }
      state.kind = _kind;
      state.result = _result;
      return false;
    }
    function readSingleQuotedScalar(state, nodeIndent) {
      var ch, captureStart, captureEnd;
      ch = state.input.charCodeAt(state.position);
      if (ch !== 39) {
        return false;
      }
      state.kind = 'scalar';
      state.result = '';
      state.position++;
      captureStart = captureEnd = state.position;
      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 39) {
          captureSegment(state, captureStart, state.position, true);
          ch = state.input.charCodeAt(++state.position);
          if (ch === 39) {
            captureStart = state.position;
            state.position++;
            captureEnd = state.position;
          } else {
            return true;
          }
        } else if (is_EOL(ch)) {
          captureSegment(state, captureStart, captureEnd, true);
          writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
          captureStart = captureEnd = state.position;
        } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
          throwError(state, 'unexpected end of the document within a single quoted scalar');
        } else {
          state.position++;
          captureEnd = state.position;
        }
      }
      throwError(state, 'unexpected end of the stream within a single quoted scalar');
    }
    function readDoubleQuotedScalar(state, nodeIndent) {
      var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
      ch = state.input.charCodeAt(state.position);
      if (ch !== 34) {
        return false;
      }
      state.kind = 'scalar';
      state.result = '';
      state.position++;
      captureStart = captureEnd = state.position;
      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 34) {
          captureSegment(state, captureStart, state.position, true);
          state.position++;
          return true;
        } else if (ch === 92) {
          captureSegment(state, captureStart, state.position, true);
          ch = state.input.charCodeAt(++state.position);
          if (is_EOL(ch)) {
            skipSeparationSpace(state, false, nodeIndent);
          } else if (ch < 256 && simpleEscapeCheck[ch]) {
            state.result += simpleEscapeMap[ch];
            state.position++;
          } else if ((tmp = escapedHexLen(ch)) > 0) {
            hexLength = tmp;
            hexResult = 0;
            for (; hexLength > 0; hexLength--) {
              ch = state.input.charCodeAt(++state.position);
              if ((tmp = fromHexCode(ch)) >= 0) {
                hexResult = (hexResult << 4) + tmp;
              } else {
                throwError(state, 'expected hexadecimal character');
              }
            }
            state.result += charFromCodepoint(hexResult);
            state.position++;
          } else {
            throwError(state, 'unknown escape sequence');
          }
          captureStart = captureEnd = state.position;
        } else if (is_EOL(ch)) {
          captureSegment(state, captureStart, captureEnd, true);
          writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
          captureStart = captureEnd = state.position;
        } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
          throwError(state, 'unexpected end of the document within a double quoted scalar');
        } else {
          state.position++;
          captureEnd = state.position;
        }
      }
      throwError(state, 'unexpected end of the stream within a double quoted scalar');
    }
    function readFlowCollection(state, nodeIndent) {
      var readNext = true,
        _line,
        _tag = state.tag,
        _result,
        _anchor = state.anchor,
        following,
        terminator,
        isPair,
        isExplicitPair,
        isMapping,
        overridableKeys = {},
        keyNode,
        keyTag,
        valueNode,
        ch;
      ch = state.input.charCodeAt(state.position);
      if (ch === 91) {
        terminator = 93;
        isMapping = false;
        _result = [];
      } else if (ch === 123) {
        terminator = 125;
        isMapping = true;
        _result = {};
      } else {
        return false;
      }
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = _result;
      }
      ch = state.input.charCodeAt(++state.position);
      while (ch !== 0) {
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if (ch === terminator) {
          state.position++;
          state.tag = _tag;
          state.anchor = _anchor;
          state.kind = isMapping ? 'mapping' : 'sequence';
          state.result = _result;
          return true;
        } else if (!readNext) {
          throwError(state, 'missed comma between flow collection entries');
        }
        keyTag = keyNode = valueNode = null;
        isPair = isExplicitPair = false;
        if (ch === 63) {
          following = state.input.charCodeAt(state.position + 1);
          if (is_WS_OR_EOL(following)) {
            isPair = isExplicitPair = true;
            state.position++;
            skipSeparationSpace(state, true, nodeIndent);
          }
        }
        _line = state.line;
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        keyTag = state.tag;
        keyNode = state.result;
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if ((isExplicitPair || state.line === _line) && ch === 58) {
          isPair = true;
          ch = state.input.charCodeAt(++state.position);
          skipSeparationSpace(state, true, nodeIndent);
          composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
          valueNode = state.result;
        }
        if (isMapping) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode);
        } else if (isPair) {
          _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode));
        } else {
          _result.push(keyNode);
        }
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if (ch === 44) {
          readNext = true;
          ch = state.input.charCodeAt(++state.position);
        } else {
          readNext = false;
        }
      }
      throwError(state, 'unexpected end of the stream within a flow collection');
    }
    function readBlockScalar(state, nodeIndent) {
      var captureStart,
        folding,
        chomping = CHOMPING_CLIP,
        didReadContent = false,
        detectedIndent = false,
        textIndent = nodeIndent,
        emptyLines = 0,
        atMoreIndented = false,
        tmp,
        ch;
      ch = state.input.charCodeAt(state.position);
      if (ch === 124) {
        folding = false;
      } else if (ch === 62) {
        folding = true;
      } else {
        return false;
      }
      state.kind = 'scalar';
      state.result = '';
      while (ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
        if (ch === 43 || ch === 45) {
          if (CHOMPING_CLIP === chomping) {
            chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
          } else {
            throwError(state, 'repeat of a chomping mode identifier');
          }
        } else if ((tmp = fromDecimalCode(ch)) >= 0) {
          if (tmp === 0) {
            throwError(
              state,
              'bad explicit indentation width of a block scalar; it cannot be less than one'
            );
          } else if (!detectedIndent) {
            textIndent = nodeIndent + tmp - 1;
            detectedIndent = true;
          } else {
            throwError(state, 'repeat of an indentation width identifier');
          }
        } else {
          break;
        }
      }
      if (is_WHITE_SPACE(ch)) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (is_WHITE_SPACE(ch));
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (!is_EOL(ch) && ch !== 0);
        }
      }
      while (ch !== 0) {
        readLineBreak(state);
        state.lineIndent = 0;
        ch = state.input.charCodeAt(state.position);
        while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
        if (!detectedIndent && state.lineIndent > textIndent) {
          textIndent = state.lineIndent;
        }
        if (is_EOL(ch)) {
          emptyLines++;
          continue;
        }
        if (state.lineIndent < textIndent) {
          if (chomping === CHOMPING_KEEP) {
            state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
          } else if (chomping === CHOMPING_CLIP) {
            if (didReadContent) {
              state.result += '\n';
            }
          }
          break;
        }
        if (folding) {
          if (is_WHITE_SPACE(ch)) {
            atMoreIndented = true;
            state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
          } else if (atMoreIndented) {
            atMoreIndented = false;
            state.result += common.repeat('\n', emptyLines + 1);
          } else if (emptyLines === 0) {
            if (didReadContent) {
              state.result += ' ';
            }
          } else {
            state.result += common.repeat('\n', emptyLines);
          }
        } else {
          state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
        }
        didReadContent = true;
        detectedIndent = true;
        emptyLines = 0;
        captureStart = state.position;
        while (!is_EOL(ch) && ch !== 0) {
          ch = state.input.charCodeAt(++state.position);
        }
        captureSegment(state, captureStart, state.position, false);
      }
      return true;
    }
    function readBlockSequence(state, nodeIndent) {
      var _line,
        _tag = state.tag,
        _anchor = state.anchor,
        _result = [],
        following,
        detected = false,
        ch;
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = _result;
      }
      ch = state.input.charCodeAt(state.position);
      while (ch !== 0) {
        if (ch !== 45) {
          break;
        }
        following = state.input.charCodeAt(state.position + 1);
        if (!is_WS_OR_EOL(following)) {
          break;
        }
        detected = true;
        state.position++;
        if (skipSeparationSpace(state, true, -1)) {
          if (state.lineIndent <= nodeIndent) {
            _result.push(null);
            ch = state.input.charCodeAt(state.position);
            continue;
          }
        }
        _line = state.line;
        composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
        _result.push(state.result);
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
        if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
          throwError(state, 'bad indentation of a sequence entry');
        } else if (state.lineIndent < nodeIndent) {
          break;
        }
      }
      if (detected) {
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = 'sequence';
        state.result = _result;
        return true;
      }
      return false;
    }
    function readBlockMapping(state, nodeIndent, flowIndent) {
      var following,
        allowCompact,
        _line,
        _pos,
        _tag = state.tag,
        _anchor = state.anchor,
        _result = {},
        overridableKeys = {},
        keyTag = null,
        keyNode = null,
        valueNode = null,
        atExplicitKey = false,
        detected = false,
        ch;
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = _result;
      }
      ch = state.input.charCodeAt(state.position);
      while (ch !== 0) {
        following = state.input.charCodeAt(state.position + 1);
        _line = state.line;
        _pos = state.position;
        if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
          if (ch === 63) {
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = true;
            allowCompact = true;
          } else if (atExplicitKey) {
            atExplicitKey = false;
            allowCompact = true;
          } else {
            throwError(
              state,
              'incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line'
            );
          }
          state.position += 1;
          ch = following;
        } else if (composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
          if (state.line === _line) {
            ch = state.input.charCodeAt(state.position);
            while (is_WHITE_SPACE(ch)) {
              ch = state.input.charCodeAt(++state.position);
            }
            if (ch === 58) {
              ch = state.input.charCodeAt(++state.position);
              if (!is_WS_OR_EOL(ch)) {
                throwError(
                  state,
                  'a whitespace character is expected after the key-value separator within a block mapping'
                );
              }
              if (atExplicitKey) {
                storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
                keyTag = keyNode = valueNode = null;
              }
              detected = true;
              atExplicitKey = false;
              allowCompact = false;
              keyTag = state.tag;
              keyNode = state.result;
            } else if (detected) {
              throwError(state, 'can not read an implicit mapping pair; a colon is missed');
            } else {
              state.tag = _tag;
              state.anchor = _anchor;
              return true;
            }
          } else if (detected) {
            throwError(
              state,
              'can not read a block mapping entry; a multiline key may not be an implicit key'
            );
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else {
          break;
        }
        if (state.line === _line || state.lineIndent > nodeIndent) {
          if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
            if (atExplicitKey) {
              keyNode = state.result;
            } else {
              valueNode = state.result;
            }
          }
          if (!atExplicitKey) {
            storeMappingPair(
              state,
              _result,
              overridableKeys,
              keyTag,
              keyNode,
              valueNode,
              _line,
              _pos
            );
            keyTag = keyNode = valueNode = null;
          }
          skipSeparationSpace(state, true, -1);
          ch = state.input.charCodeAt(state.position);
        }
        if (state.lineIndent > nodeIndent && ch !== 0) {
          throwError(state, 'bad indentation of a mapping entry');
        } else if (state.lineIndent < nodeIndent) {
          break;
        }
      }
      if (atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
      }
      if (detected) {
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = 'mapping';
        state.result = _result;
      }
      return detected;
    }
    function readTagProperty(state) {
      var _position,
        isVerbatim = false,
        isNamed = false,
        tagHandle,
        tagName,
        ch;
      ch = state.input.charCodeAt(state.position);
      if (ch !== 33) return false;
      if (state.tag !== null) {
        throwError(state, 'duplication of a tag property');
      }
      ch = state.input.charCodeAt(++state.position);
      if (ch === 60) {
        isVerbatim = true;
        ch = state.input.charCodeAt(++state.position);
      } else if (ch === 33) {
        isNamed = true;
        tagHandle = '!!';
        ch = state.input.charCodeAt(++state.position);
      } else {
        tagHandle = '!';
      }
      _position = state.position;
      if (isVerbatim) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && ch !== 62);
        if (state.position < state.length) {
          tagName = state.input.slice(_position, state.position);
          ch = state.input.charCodeAt(++state.position);
        } else {
          throwError(state, 'unexpected end of the stream within a verbatim tag');
        }
      } else {
        while (ch !== 0 && !is_WS_OR_EOL(ch)) {
          if (ch === 33) {
            if (!isNamed) {
              tagHandle = state.input.slice(_position - 1, state.position + 1);
              if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
                throwError(state, 'named tag handle cannot contain such characters');
              }
              isNamed = true;
              _position = state.position + 1;
            } else {
              throwError(state, 'tag suffix cannot contain exclamation marks');
            }
          }
          ch = state.input.charCodeAt(++state.position);
        }
        tagName = state.input.slice(_position, state.position);
        if (PATTERN_FLOW_INDICATORS.test(tagName)) {
          throwError(state, 'tag suffix cannot contain flow indicator characters');
        }
      }
      if (tagName && !PATTERN_TAG_URI.test(tagName)) {
        throwError(state, 'tag name cannot contain such characters: ' + tagName);
      }
      if (isVerbatim) {
        state.tag = tagName;
      } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
        state.tag = state.tagMap[tagHandle] + tagName;
      } else if (tagHandle === '!') {
        state.tag = '!' + tagName;
      } else if (tagHandle === '!!') {
        state.tag = 'tag:yaml.org,2002:' + tagName;
      } else {
        throwError(state, 'undeclared tag handle "' + tagHandle + '"');
      }
      return true;
    }
    function readAnchorProperty(state) {
      var _position, ch;
      ch = state.input.charCodeAt(state.position);
      if (ch !== 38) return false;
      if (state.anchor !== null) {
        throwError(state, 'duplication of an anchor property');
      }
      ch = state.input.charCodeAt(++state.position);
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (state.position === _position) {
        throwError(state, 'name of an anchor node must contain at least one character');
      }
      state.anchor = state.input.slice(_position, state.position);
      return true;
    }
    function readAlias(state) {
      var _position, alias, ch;
      ch = state.input.charCodeAt(state.position);
      if (ch !== 42) return false;
      ch = state.input.charCodeAt(++state.position);
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (state.position === _position) {
        throwError(state, 'name of an alias node must contain at least one character');
      }
      alias = state.input.slice(_position, state.position);
      if (!_hasOwnProperty.call(state.anchorMap, alias)) {
        throwError(state, 'unidentified alias "' + alias + '"');
      }
      state.result = state.anchorMap[alias];
      skipSeparationSpace(state, true, -1);
      return true;
    }
    function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
      var allowBlockStyles,
        allowBlockScalars,
        allowBlockCollections,
        indentStatus = 1,
        atNewLine = false,
        hasContent = false,
        typeIndex,
        typeQuantity,
        type,
        flowIndent,
        blockIndent;
      if (state.listener !== null) {
        state.listener('open', state);
      }
      state.tag = null;
      state.anchor = null;
      state.kind = null;
      state.result = null;
      allowBlockStyles =
        allowBlockScalars =
        allowBlockCollections =
          CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
      if (allowToSeek) {
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        }
      }
      if (indentStatus === 1) {
        while (readTagProperty(state) || readAnchorProperty(state)) {
          if (skipSeparationSpace(state, true, -1)) {
            atNewLine = true;
            allowBlockCollections = allowBlockStyles;
            if (state.lineIndent > parentIndent) {
              indentStatus = 1;
            } else if (state.lineIndent === parentIndent) {
              indentStatus = 0;
            } else if (state.lineIndent < parentIndent) {
              indentStatus = -1;
            }
          } else {
            allowBlockCollections = false;
          }
        }
      }
      if (allowBlockCollections) {
        allowBlockCollections = atNewLine || allowCompact;
      }
      if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
        if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
          flowIndent = parentIndent;
        } else {
          flowIndent = parentIndent + 1;
        }
        blockIndent = state.position - state.lineStart;
        if (indentStatus === 1) {
          if (
            (allowBlockCollections &&
              (readBlockSequence(state, blockIndent) ||
                readBlockMapping(state, blockIndent, flowIndent))) ||
            readFlowCollection(state, flowIndent)
          ) {
            hasContent = true;
          } else {
            if (
              (allowBlockScalars && readBlockScalar(state, flowIndent)) ||
              readSingleQuotedScalar(state, flowIndent) ||
              readDoubleQuotedScalar(state, flowIndent)
            ) {
              hasContent = true;
            } else if (readAlias(state)) {
              hasContent = true;
              if (state.tag !== null || state.anchor !== null) {
                throwError(state, 'alias node should not have any properties');
              }
            } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
              hasContent = true;
              if (state.tag === null) {
                state.tag = '?';
              }
            }
            if (state.anchor !== null) {
              state.anchorMap[state.anchor] = state.result;
            }
          }
        } else if (indentStatus === 0) {
          hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
        }
      }
      if (state.tag !== null && state.tag !== '!') {
        if (state.tag === '?') {
          if (state.result !== null && state.kind !== 'scalar') {
            throwError(
              state,
              'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"'
            );
          }
          for (
            typeIndex = 0, typeQuantity = state.implicitTypes.length;
            typeIndex < typeQuantity;
            typeIndex += 1
          ) {
            type = state.implicitTypes[typeIndex];
            if (type.resolve(state.result)) {
              state.result = type.construct(state.result);
              state.tag = type.tag;
              if (state.anchor !== null) {
                state.anchorMap[state.anchor] = state.result;
              }
              break;
            }
          }
        } else if (_hasOwnProperty.call(state.typeMap[state.kind || 'fallback'], state.tag)) {
          type = state.typeMap[state.kind || 'fallback'][state.tag];
          if (state.result !== null && type.kind !== state.kind) {
            throwError(
              state,
              'unacceptable node kind for !<' +
                state.tag +
                '> tag; it should be "' +
                type.kind +
                '", not "' +
                state.kind +
                '"'
            );
          }
          if (!type.resolve(state.result)) {
            throwError(state, 'cannot resolve a node with !<' + state.tag + '> explicit tag');
          } else {
            state.result = type.construct(state.result);
            if (state.anchor !== null) {
              state.anchorMap[state.anchor] = state.result;
            }
          }
        } else {
          throwError(state, 'unknown tag !<' + state.tag + '>');
        }
      }
      if (state.listener !== null) {
        state.listener('close', state);
      }
      return state.tag !== null || state.anchor !== null || hasContent;
    }
    function readDocument(state) {
      var documentStart = state.position,
        _position,
        directiveName,
        directiveArgs,
        hasDirectives = false,
        ch;
      state.version = null;
      state.checkLineBreaks = state.legacy;
      state.tagMap = {};
      state.anchorMap = {};
      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
        if (state.lineIndent > 0 || ch !== 37) {
          break;
        }
        hasDirectives = true;
        ch = state.input.charCodeAt(++state.position);
        _position = state.position;
        while (ch !== 0 && !is_WS_OR_EOL(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        directiveName = state.input.slice(_position, state.position);
        directiveArgs = [];
        if (directiveName.length < 1) {
          throwError(state, 'directive name must not be less than one character in length');
        }
        while (ch !== 0) {
          while (is_WHITE_SPACE(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 35) {
            do {
              ch = state.input.charCodeAt(++state.position);
            } while (ch !== 0 && !is_EOL(ch));
            break;
          }
          if (is_EOL(ch)) break;
          _position = state.position;
          while (ch !== 0 && !is_WS_OR_EOL(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          directiveArgs.push(state.input.slice(_position, state.position));
        }
        if (ch !== 0) readLineBreak(state);
        if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
          directiveHandlers[directiveName](state, directiveName, directiveArgs);
        } else {
          throwWarning(state, 'unknown document directive "' + directiveName + '"');
        }
      }
      skipSeparationSpace(state, true, -1);
      if (
        state.lineIndent === 0 &&
        state.input.charCodeAt(state.position) === 45 &&
        state.input.charCodeAt(state.position + 1) === 45 &&
        state.input.charCodeAt(state.position + 2) === 45
      ) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      } else if (hasDirectives) {
        throwError(state, 'directives end mark is expected');
      }
      composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
      skipSeparationSpace(state, true, -1);
      if (
        state.checkLineBreaks &&
        PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))
      ) {
        throwWarning(state, 'non-ASCII line breaks are interpreted as content');
      }
      state.documents.push(state.result);
      if (state.position === state.lineStart && testDocumentSeparator(state)) {
        if (state.input.charCodeAt(state.position) === 46) {
          state.position += 3;
          skipSeparationSpace(state, true, -1);
        }
        return;
      }
      if (state.position < state.length - 1) {
        throwError(state, 'end of the stream or a document separator is expected');
      } else {
        return;
      }
    }
    function loadDocuments(input, options2) {
      input = String(input);
      options2 = options2 || {};
      if (input.length !== 0) {
        if (
          input.charCodeAt(input.length - 1) !== 10 &&
          input.charCodeAt(input.length - 1) !== 13
        ) {
          input += '\n';
        }
        if (input.charCodeAt(0) === 65279) {
          input = input.slice(1);
        }
      }
      var state = new State(input, options2);
      var nullpos = input.indexOf('\0');
      if (nullpos !== -1) {
        state.position = nullpos;
        throwError(state, 'null byte is not allowed in input');
      }
      state.input += '\0';
      while (state.input.charCodeAt(state.position) === 32) {
        state.lineIndent += 1;
        state.position += 1;
      }
      while (state.position < state.length - 1) {
        readDocument(state);
      }
      return state.documents;
    }
    function loadAll2(input, iterator, options2) {
      if (iterator !== null && typeof iterator === 'object' && typeof options2 === 'undefined') {
        options2 = iterator;
        iterator = null;
      }
      var documents = loadDocuments(input, options2);
      if (typeof iterator !== 'function') {
        return documents;
      }
      for (var index = 0, length = documents.length; index < length; index += 1) {
        iterator(documents[index]);
      }
    }
    function load2(input, options2) {
      var documents = loadDocuments(input, options2);
      if (documents.length === 0) {
        return void 0;
      } else if (documents.length === 1) {
        return documents[0];
      }
      throw new YAMLException2('expected a single document in the stream, but found more');
    }
    function safeLoadAll2(input, iterator, options2) {
      if (typeof iterator === 'object' && iterator !== null && typeof options2 === 'undefined') {
        options2 = iterator;
        iterator = null;
      }
      return loadAll2(input, iterator, common.extend({ schema: DEFAULT_SAFE_SCHEMA }, options2));
    }
    function safeLoad2(input, options2) {
      return load2(input, common.extend({ schema: DEFAULT_SAFE_SCHEMA }, options2));
    }
    module2.exports.loadAll = loadAll2;
    module2.exports.load = load2;
    module2.exports.safeLoadAll = safeLoadAll2;
    module2.exports.safeLoad = safeLoad2;
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/dumper.js
var require_dumper = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml/dumper.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var common = require_common();
    var YAMLException2 = require_exception();
    var DEFAULT_FULL_SCHEMA = require_default_full();
    var DEFAULT_SAFE_SCHEMA = require_default_safe();
    var _toString = Object.prototype.toString;
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    var CHAR_TAB = 9;
    var CHAR_LINE_FEED = 10;
    var CHAR_CARRIAGE_RETURN = 13;
    var CHAR_SPACE = 32;
    var CHAR_EXCLAMATION = 33;
    var CHAR_DOUBLE_QUOTE = 34;
    var CHAR_SHARP = 35;
    var CHAR_PERCENT = 37;
    var CHAR_AMPERSAND = 38;
    var CHAR_SINGLE_QUOTE = 39;
    var CHAR_ASTERISK = 42;
    var CHAR_COMMA = 44;
    var CHAR_MINUS = 45;
    var CHAR_COLON = 58;
    var CHAR_EQUALS = 61;
    var CHAR_GREATER_THAN = 62;
    var CHAR_QUESTION = 63;
    var CHAR_COMMERCIAL_AT = 64;
    var CHAR_LEFT_SQUARE_BRACKET = 91;
    var CHAR_RIGHT_SQUARE_BRACKET = 93;
    var CHAR_GRAVE_ACCENT = 96;
    var CHAR_LEFT_CURLY_BRACKET = 123;
    var CHAR_VERTICAL_LINE = 124;
    var CHAR_RIGHT_CURLY_BRACKET = 125;
    var ESCAPE_SEQUENCES = {};
    ESCAPE_SEQUENCES[0] = '\\0';
    ESCAPE_SEQUENCES[7] = '\\a';
    ESCAPE_SEQUENCES[8] = '\\b';
    ESCAPE_SEQUENCES[9] = '\\t';
    ESCAPE_SEQUENCES[10] = '\\n';
    ESCAPE_SEQUENCES[11] = '\\v';
    ESCAPE_SEQUENCES[12] = '\\f';
    ESCAPE_SEQUENCES[13] = '\\r';
    ESCAPE_SEQUENCES[27] = '\\e';
    ESCAPE_SEQUENCES[34] = '\\"';
    ESCAPE_SEQUENCES[92] = '\\\\';
    ESCAPE_SEQUENCES[133] = '\\N';
    ESCAPE_SEQUENCES[160] = '\\_';
    ESCAPE_SEQUENCES[8232] = '\\L';
    ESCAPE_SEQUENCES[8233] = '\\P';
    var DEPRECATED_BOOLEANS_SYNTAX = [
      'y',
      'Y',
      'yes',
      'Yes',
      'YES',
      'on',
      'On',
      'ON',
      'n',
      'N',
      'no',
      'No',
      'NO',
      'off',
      'Off',
      'OFF',
    ];
    function compileStyleMap(schema, map) {
      var result, keys, index, length, tag, style, type;
      if (map === null) return {};
      result = {};
      keys = Object.keys(map);
      for (index = 0, length = keys.length; index < length; index += 1) {
        tag = keys[index];
        style = String(map[tag]);
        if (tag.slice(0, 2) === '!!') {
          tag = 'tag:yaml.org,2002:' + tag.slice(2);
        }
        type = schema.compiledTypeMap['fallback'][tag];
        if (type && _hasOwnProperty.call(type.styleAliases, style)) {
          style = type.styleAliases[style];
        }
        result[tag] = style;
      }
      return result;
    }
    function encodeHex(character) {
      var string, handle, length;
      string = character.toString(16).toUpperCase();
      if (character <= 255) {
        handle = 'x';
        length = 2;
      } else if (character <= 65535) {
        handle = 'u';
        length = 4;
      } else if (character <= 4294967295) {
        handle = 'U';
        length = 8;
      } else {
        throw new YAMLException2('code point within a string may not be greater than 0xFFFFFFFF');
      }
      return '\\' + handle + common.repeat('0', length - string.length) + string;
    }
    function State(options2) {
      this.schema = options2['schema'] || DEFAULT_FULL_SCHEMA;
      this.indent = Math.max(1, options2['indent'] || 2);
      this.noArrayIndent = options2['noArrayIndent'] || false;
      this.skipInvalid = options2['skipInvalid'] || false;
      this.flowLevel = common.isNothing(options2['flowLevel']) ? -1 : options2['flowLevel'];
      this.styleMap = compileStyleMap(this.schema, options2['styles'] || null);
      this.sortKeys = options2['sortKeys'] || false;
      this.lineWidth = options2['lineWidth'] || 80;
      this.noRefs = options2['noRefs'] || false;
      this.noCompatMode = options2['noCompatMode'] || false;
      this.condenseFlow = options2['condenseFlow'] || false;
      this.implicitTypes = this.schema.compiledImplicit;
      this.explicitTypes = this.schema.compiledExplicit;
      this.tag = null;
      this.result = '';
      this.duplicates = [];
      this.usedDuplicates = null;
    }
    function indentString(string, spaces) {
      var ind = common.repeat(' ', spaces),
        position = 0,
        next = -1,
        result = '',
        line,
        length = string.length;
      while (position < length) {
        next = string.indexOf('\n', position);
        if (next === -1) {
          line = string.slice(position);
          position = length;
        } else {
          line = string.slice(position, next + 1);
          position = next + 1;
        }
        if (line.length && line !== '\n') result += ind;
        result += line;
      }
      return result;
    }
    function generateNextLine(state, level) {
      return '\n' + common.repeat(' ', state.indent * level);
    }
    function testImplicitResolving(state, str2) {
      var index, length, type;
      for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
        type = state.implicitTypes[index];
        if (type.resolve(str2)) {
          return true;
        }
      }
      return false;
    }
    function isWhitespace(c) {
      return c === CHAR_SPACE || c === CHAR_TAB;
    }
    function isPrintable(c) {
      return (
        (32 <= c && c <= 126) ||
        (161 <= c && c <= 55295 && c !== 8232 && c !== 8233) ||
        (57344 <= c && c <= 65533 && c !== 65279) ||
        (65536 <= c && c <= 1114111)
      );
    }
    function isNsChar(c) {
      return (
        isPrintable(c) &&
        !isWhitespace(c) &&
        c !== 65279 &&
        c !== CHAR_CARRIAGE_RETURN &&
        c !== CHAR_LINE_FEED
      );
    }
    function isPlainSafe(c, prev) {
      return (
        isPrintable(c) &&
        c !== 65279 &&
        c !== CHAR_COMMA &&
        c !== CHAR_LEFT_SQUARE_BRACKET &&
        c !== CHAR_RIGHT_SQUARE_BRACKET &&
        c !== CHAR_LEFT_CURLY_BRACKET &&
        c !== CHAR_RIGHT_CURLY_BRACKET &&
        c !== CHAR_COLON &&
        (c !== CHAR_SHARP || (prev && isNsChar(prev)))
      );
    }
    function isPlainSafeFirst(c) {
      return (
        isPrintable(c) &&
        c !== 65279 &&
        !isWhitespace(c) &&
        c !== CHAR_MINUS &&
        c !== CHAR_QUESTION &&
        c !== CHAR_COLON &&
        c !== CHAR_COMMA &&
        c !== CHAR_LEFT_SQUARE_BRACKET &&
        c !== CHAR_RIGHT_SQUARE_BRACKET &&
        c !== CHAR_LEFT_CURLY_BRACKET &&
        c !== CHAR_RIGHT_CURLY_BRACKET &&
        c !== CHAR_SHARP &&
        c !== CHAR_AMPERSAND &&
        c !== CHAR_ASTERISK &&
        c !== CHAR_EXCLAMATION &&
        c !== CHAR_VERTICAL_LINE &&
        c !== CHAR_EQUALS &&
        c !== CHAR_GREATER_THAN &&
        c !== CHAR_SINGLE_QUOTE &&
        c !== CHAR_DOUBLE_QUOTE &&
        c !== CHAR_PERCENT &&
        c !== CHAR_COMMERCIAL_AT &&
        c !== CHAR_GRAVE_ACCENT
      );
    }
    function needIndentIndicator(string) {
      var leadingSpaceRe = /^\n* /;
      return leadingSpaceRe.test(string);
    }
    var STYLE_PLAIN = 1;
    var STYLE_SINGLE = 2;
    var STYLE_LITERAL = 3;
    var STYLE_FOLDED = 4;
    var STYLE_DOUBLE = 5;
    function chooseScalarStyle(
      string,
      singleLineOnly,
      indentPerLevel,
      lineWidth,
      testAmbiguousType
    ) {
      var i;
      var char, prev_char;
      var hasLineBreak = false;
      var hasFoldableLine = false;
      var shouldTrackWidth = lineWidth !== -1;
      var previousLineBreak = -1;
      var plain =
        isPlainSafeFirst(string.charCodeAt(0)) &&
        !isWhitespace(string.charCodeAt(string.length - 1));
      if (singleLineOnly) {
        for (i = 0; i < string.length; i++) {
          char = string.charCodeAt(i);
          if (!isPrintable(char)) {
            return STYLE_DOUBLE;
          }
          prev_char = i > 0 ? string.charCodeAt(i - 1) : null;
          plain = plain && isPlainSafe(char, prev_char);
        }
      } else {
        for (i = 0; i < string.length; i++) {
          char = string.charCodeAt(i);
          if (char === CHAR_LINE_FEED) {
            hasLineBreak = true;
            if (shouldTrackWidth) {
              hasFoldableLine =
                hasFoldableLine || // Foldable line = too long, and not more-indented.
                (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== ' ');
              previousLineBreak = i;
            }
          } else if (!isPrintable(char)) {
            return STYLE_DOUBLE;
          }
          prev_char = i > 0 ? string.charCodeAt(i - 1) : null;
          plain = plain && isPlainSafe(char, prev_char);
        }
        hasFoldableLine =
          hasFoldableLine ||
          (shouldTrackWidth &&
            i - previousLineBreak - 1 > lineWidth &&
            string[previousLineBreak + 1] !== ' ');
      }
      if (!hasLineBreak && !hasFoldableLine) {
        return plain && !testAmbiguousType(string) ? STYLE_PLAIN : STYLE_SINGLE;
      }
      if (indentPerLevel > 9 && needIndentIndicator(string)) {
        return STYLE_DOUBLE;
      }
      return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    }
    function writeScalar(state, string, level, iskey) {
      state.dump = (function () {
        if (string.length === 0) {
          return "''";
        }
        if (!state.noCompatMode && DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1) {
          return "'" + string + "'";
        }
        var indent = state.indent * Math.max(1, level);
        var lineWidth =
          state.lineWidth === -1
            ? -1
            : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
        var singleLineOnly = iskey || (state.flowLevel > -1 && level >= state.flowLevel);
        function testAmbiguity(string2) {
          return testImplicitResolving(state, string2);
        }
        switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity)) {
          case STYLE_PLAIN:
            return string;
          case STYLE_SINGLE:
            return "'" + string.replace(/'/g, "''") + "'";
          case STYLE_LITERAL:
            return (
              '|' +
              blockHeader(string, state.indent) +
              dropEndingNewline(indentString(string, indent))
            );
          case STYLE_FOLDED:
            return (
              '>' +
              blockHeader(string, state.indent) +
              dropEndingNewline(indentString(foldString(string, lineWidth), indent))
            );
          case STYLE_DOUBLE:
            return '"' + escapeString(string, lineWidth) + '"';
          default:
            throw new YAMLException2('impossible error: invalid scalar style');
        }
      })();
    }
    function blockHeader(string, indentPerLevel) {
      var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : '';
      var clip = string[string.length - 1] === '\n';
      var keep = clip && (string[string.length - 2] === '\n' || string === '\n');
      var chomp = keep ? '+' : clip ? '' : '-';
      return indentIndicator + chomp + '\n';
    }
    function dropEndingNewline(string) {
      return string[string.length - 1] === '\n' ? string.slice(0, -1) : string;
    }
    function foldString(string, width) {
      var lineRe = /(\n+)([^\n]*)/g;
      var result = (function () {
        var nextLF = string.indexOf('\n');
        nextLF = nextLF !== -1 ? nextLF : string.length;
        lineRe.lastIndex = nextLF;
        return foldLine(string.slice(0, nextLF), width);
      })();
      var prevMoreIndented = string[0] === '\n' || string[0] === ' ';
      var moreIndented;
      var match;
      while ((match = lineRe.exec(string))) {
        var prefix = match[1],
          line = match[2];
        moreIndented = line[0] === ' ';
        result +=
          prefix +
          (!prevMoreIndented && !moreIndented && line !== '' ? '\n' : '') +
          foldLine(line, width);
        prevMoreIndented = moreIndented;
      }
      return result;
    }
    function foldLine(line, width) {
      if (line === '' || line[0] === ' ') return line;
      var breakRe = / [^ ]/g;
      var match;
      var start = 0,
        end,
        curr = 0,
        next = 0;
      var result = '';
      while ((match = breakRe.exec(line))) {
        next = match.index;
        if (next - start > width) {
          end = curr > start ? curr : next;
          result += '\n' + line.slice(start, end);
          start = end + 1;
        }
        curr = next;
      }
      result += '\n';
      if (line.length - start > width && curr > start) {
        result += line.slice(start, curr) + '\n' + line.slice(curr + 1);
      } else {
        result += line.slice(start);
      }
      return result.slice(1);
    }
    function escapeString(string) {
      var result = '';
      var char, nextChar;
      var escapeSeq;
      for (var i = 0; i < string.length; i++) {
        char = string.charCodeAt(i);
        if (char >= 55296 && char <= 56319) {
          nextChar = string.charCodeAt(i + 1);
          if (nextChar >= 56320 && nextChar <= 57343) {
            result += encodeHex((char - 55296) * 1024 + nextChar - 56320 + 65536);
            i++;
            continue;
          }
        }
        escapeSeq = ESCAPE_SEQUENCES[char];
        result += !escapeSeq && isPrintable(char) ? string[i] : escapeSeq || encodeHex(char);
      }
      return result;
    }
    function writeFlowSequence(state, level, object) {
      var _result = '',
        _tag = state.tag,
        index,
        length;
      for (index = 0, length = object.length; index < length; index += 1) {
        if (writeNode(state, level, object[index], false, false)) {
          if (index !== 0) _result += ',' + (!state.condenseFlow ? ' ' : '');
          _result += state.dump;
        }
      }
      state.tag = _tag;
      state.dump = '[' + _result + ']';
    }
    function writeBlockSequence(state, level, object, compact) {
      var _result = '',
        _tag = state.tag,
        index,
        length;
      for (index = 0, length = object.length; index < length; index += 1) {
        if (writeNode(state, level + 1, object[index], true, true)) {
          if (!compact || index !== 0) {
            _result += generateNextLine(state, level);
          }
          if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
            _result += '-';
          } else {
            _result += '- ';
          }
          _result += state.dump;
        }
      }
      state.tag = _tag;
      state.dump = _result || '[]';
    }
    function writeFlowMapping(state, level, object) {
      var _result = '',
        _tag = state.tag,
        objectKeyList = Object.keys(object),
        index,
        length,
        objectKey,
        objectValue,
        pairBuffer;
      for (index = 0, length = objectKeyList.length; index < length; index += 1) {
        pairBuffer = '';
        if (index !== 0) pairBuffer += ', ';
        if (state.condenseFlow) pairBuffer += '"';
        objectKey = objectKeyList[index];
        objectValue = object[objectKey];
        if (!writeNode(state, level, objectKey, false, false)) {
          continue;
        }
        if (state.dump.length > 1024) pairBuffer += '? ';
        pairBuffer +=
          state.dump + (state.condenseFlow ? '"' : '') + ':' + (state.condenseFlow ? '' : ' ');
        if (!writeNode(state, level, objectValue, false, false)) {
          continue;
        }
        pairBuffer += state.dump;
        _result += pairBuffer;
      }
      state.tag = _tag;
      state.dump = '{' + _result + '}';
    }
    function writeBlockMapping(state, level, object, compact) {
      var _result = '',
        _tag = state.tag,
        objectKeyList = Object.keys(object),
        index,
        length,
        objectKey,
        objectValue,
        explicitPair,
        pairBuffer;
      if (state.sortKeys === true) {
        objectKeyList.sort();
      } else if (typeof state.sortKeys === 'function') {
        objectKeyList.sort(state.sortKeys);
      } else if (state.sortKeys) {
        throw new YAMLException2('sortKeys must be a boolean or a function');
      }
      for (index = 0, length = objectKeyList.length; index < length; index += 1) {
        pairBuffer = '';
        if (!compact || index !== 0) {
          pairBuffer += generateNextLine(state, level);
        }
        objectKey = objectKeyList[index];
        objectValue = object[objectKey];
        if (!writeNode(state, level + 1, objectKey, true, true, true)) {
          continue;
        }
        explicitPair =
          (state.tag !== null && state.tag !== '?') || (state.dump && state.dump.length > 1024);
        if (explicitPair) {
          if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
            pairBuffer += '?';
          } else {
            pairBuffer += '? ';
          }
        }
        pairBuffer += state.dump;
        if (explicitPair) {
          pairBuffer += generateNextLine(state, level);
        }
        if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
          continue;
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += ':';
        } else {
          pairBuffer += ': ';
        }
        pairBuffer += state.dump;
        _result += pairBuffer;
      }
      state.tag = _tag;
      state.dump = _result || '{}';
    }
    function detectType(state, object, explicit) {
      var _result, typeList, index, length, type, style;
      typeList = explicit ? state.explicitTypes : state.implicitTypes;
      for (index = 0, length = typeList.length; index < length; index += 1) {
        type = typeList[index];
        if (
          (type.instanceOf || type.predicate) &&
          (!type.instanceOf || (typeof object === 'object' && object instanceof type.instanceOf)) &&
          (!type.predicate || type.predicate(object))
        ) {
          state.tag = explicit ? type.tag : '?';
          if (type.represent) {
            style = state.styleMap[type.tag] || type.defaultStyle;
            if (_toString.call(type.represent) === '[object Function]') {
              _result = type.represent(object, style);
            } else if (_hasOwnProperty.call(type.represent, style)) {
              _result = type.represent[style](object, style);
            } else {
              throw new YAMLException2(
                '!<' + type.tag + '> tag resolver accepts not "' + style + '" style'
              );
            }
            state.dump = _result;
          }
          return true;
        }
      }
      return false;
    }
    function writeNode(state, level, object, block, compact, iskey) {
      state.tag = null;
      state.dump = object;
      if (!detectType(state, object, false)) {
        detectType(state, object, true);
      }
      var type = _toString.call(state.dump);
      if (block) {
        block = state.flowLevel < 0 || state.flowLevel > level;
      }
      var objectOrArray = type === '[object Object]' || type === '[object Array]',
        duplicateIndex,
        duplicate;
      if (objectOrArray) {
        duplicateIndex = state.duplicates.indexOf(object);
        duplicate = duplicateIndex !== -1;
      }
      if (
        (state.tag !== null && state.tag !== '?') ||
        duplicate ||
        (state.indent !== 2 && level > 0)
      ) {
        compact = false;
      }
      if (duplicate && state.usedDuplicates[duplicateIndex]) {
        state.dump = '*ref_' + duplicateIndex;
      } else {
        if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
          state.usedDuplicates[duplicateIndex] = true;
        }
        if (type === '[object Object]') {
          if (block && Object.keys(state.dump).length !== 0) {
            writeBlockMapping(state, level, state.dump, compact);
            if (duplicate) {
              state.dump = '&ref_' + duplicateIndex + state.dump;
            }
          } else {
            writeFlowMapping(state, level, state.dump);
            if (duplicate) {
              state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
            }
          }
        } else if (type === '[object Array]') {
          var arrayLevel = state.noArrayIndent && level > 0 ? level - 1 : level;
          if (block && state.dump.length !== 0) {
            writeBlockSequence(state, arrayLevel, state.dump, compact);
            if (duplicate) {
              state.dump = '&ref_' + duplicateIndex + state.dump;
            }
          } else {
            writeFlowSequence(state, arrayLevel, state.dump);
            if (duplicate) {
              state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
            }
          }
        } else if (type === '[object String]') {
          if (state.tag !== '?') {
            writeScalar(state, state.dump, level, iskey);
          }
        } else {
          if (state.skipInvalid) return false;
          throw new YAMLException2('unacceptable kind of an object to dump ' + type);
        }
        if (state.tag !== null && state.tag !== '?') {
          state.dump = '!<' + state.tag + '> ' + state.dump;
        }
      }
      return true;
    }
    function getDuplicateReferences(object, state) {
      var objects = [],
        duplicatesIndexes = [],
        index,
        length;
      inspectNode(object, objects, duplicatesIndexes);
      for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
        state.duplicates.push(objects[duplicatesIndexes[index]]);
      }
      state.usedDuplicates = new Array(length);
    }
    function inspectNode(object, objects, duplicatesIndexes) {
      var objectKeyList, index, length;
      if (object !== null && typeof object === 'object') {
        index = objects.indexOf(object);
        if (index !== -1) {
          if (duplicatesIndexes.indexOf(index) === -1) {
            duplicatesIndexes.push(index);
          }
        } else {
          objects.push(object);
          if (Array.isArray(object)) {
            for (index = 0, length = object.length; index < length; index += 1) {
              inspectNode(object[index], objects, duplicatesIndexes);
            }
          } else {
            objectKeyList = Object.keys(object);
            for (index = 0, length = objectKeyList.length; index < length; index += 1) {
              inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
            }
          }
        }
      }
    }
    function dump2(input, options2) {
      options2 = options2 || {};
      var state = new State(options2);
      if (!state.noRefs) getDuplicateReferences(input, state);
      if (writeNode(state, 0, input, true, true)) return state.dump + '\n';
      return '';
    }
    function safeDump2(input, options2) {
      return dump2(input, common.extend({ schema: DEFAULT_SAFE_SCHEMA }, options2));
    }
    module2.exports.dump = dump2;
    module2.exports.safeDump = safeDump2;
  },
});

// node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml.js
var require_js_yaml = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/lib/js-yaml.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var loader = require_loader();
    var dumper = require_dumper();
    function deprecated(name) {
      return function () {
        throw new Error('Function ' + name + ' is deprecated and cannot be used.');
      };
    }
    module2.exports.Type = require_type();
    module2.exports.Schema = require_schema();
    module2.exports.FAILSAFE_SCHEMA = require_failsafe();
    module2.exports.JSON_SCHEMA = require_json();
    module2.exports.CORE_SCHEMA = require_core();
    module2.exports.DEFAULT_SAFE_SCHEMA = require_default_safe();
    module2.exports.DEFAULT_FULL_SCHEMA = require_default_full();
    module2.exports.load = loader.load;
    module2.exports.loadAll = loader.loadAll;
    module2.exports.safeLoad = loader.safeLoad;
    module2.exports.safeLoadAll = loader.safeLoadAll;
    module2.exports.dump = dumper.dump;
    module2.exports.safeDump = dumper.safeDump;
    module2.exports.YAMLException = require_exception();
    module2.exports.MINIMAL_SCHEMA = require_failsafe();
    module2.exports.SAFE_SCHEMA = require_default_safe();
    module2.exports.DEFAULT_SCHEMA = require_default_full();
    module2.exports.scan = deprecated('scan');
    module2.exports.parse = deprecated('parse');
    module2.exports.compose = deprecated('compose');
    module2.exports.addConstructor = deprecated('addConstructor');
  },
});

// node_modules/gray-matter/node_modules/js-yaml/index.js
var require_js_yaml2 = __commonJS({
  'node_modules/gray-matter/node_modules/js-yaml/index.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var yaml2 = require_js_yaml();
    module2.exports = yaml2;
  },
});

// node_modules/gray-matter/lib/engines.js
var require_engines = __commonJS({
  'node_modules/gray-matter/lib/engines.js'(exports, module) {
    'use strict';
    init_cjs_shims();
    var yaml = require_js_yaml2();
    var engines = (exports = module.exports);
    engines.yaml = {
      parse: yaml.safeLoad.bind(yaml),
      stringify: yaml.safeDump.bind(yaml),
    };
    engines.json = {
      parse: JSON.parse.bind(JSON),
      stringify: function (obj, options2) {
        const opts = Object.assign({ replacer: null, space: 2 }, options2);
        return JSON.stringify(obj, opts.replacer, opts.space);
      },
    };
    engines.javascript = {
      parse: function parse(str, options, wrap) {
        try {
          if (wrap !== false) {
            str = '(function() {\nreturn ' + str.trim() + ';\n}());';
          }
          return eval(str) || {};
        } catch (err) {
          if (wrap !== false && /(unexpected|identifier)/i.test(err.message)) {
            return parse(str, options, false);
          }
          throw new SyntaxError(err);
        }
      },
      stringify: function () {
        throw new Error('stringifying JavaScript is not supported');
      },
    };
  },
});

// node_modules/strip-bom-string/index.js
var require_strip_bom_string = __commonJS({
  'node_modules/strip-bom-string/index.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    module2.exports = function (str2) {
      if (typeof str2 === 'string' && str2.charAt(0) === '\uFEFF') {
        return str2.slice(1);
      }
      return str2;
    };
  },
});

// node_modules/gray-matter/lib/utils.js
var require_utils = __commonJS({
  'node_modules/gray-matter/lib/utils.js'(exports2) {
    'use strict';
    init_cjs_shims();
    var stripBom = require_strip_bom_string();
    var typeOf = require_kind_of();
    exports2.define = function (obj, key, val) {
      Reflect.defineProperty(obj, key, {
        enumerable: false,
        configurable: true,
        writable: true,
        value: val,
      });
    };
    exports2.isBuffer = function (val) {
      return typeOf(val) === 'buffer';
    };
    exports2.isObject = function (val) {
      return typeOf(val) === 'object';
    };
    exports2.toBuffer = function (input) {
      return typeof input === 'string' ? Buffer.from(input) : input;
    };
    exports2.toString = function (input) {
      if (exports2.isBuffer(input)) return stripBom(String(input));
      if (typeof input !== 'string') {
        throw new TypeError('expected input to be a string or buffer');
      }
      return stripBom(input);
    };
    exports2.arrayify = function (val) {
      return val ? (Array.isArray(val) ? val : [val]) : [];
    };
    exports2.startsWith = function (str2, substr, len) {
      if (typeof len !== 'number') len = substr.length;
      return str2.slice(0, len) === substr;
    };
  },
});

// node_modules/gray-matter/lib/defaults.js
var require_defaults = __commonJS({
  'node_modules/gray-matter/lib/defaults.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var engines2 = require_engines();
    var utils = require_utils();
    module2.exports = function (options2) {
      const opts = Object.assign({}, options2);
      opts.delimiters = utils.arrayify(opts.delims || opts.delimiters || '---');
      if (opts.delimiters.length === 1) {
        opts.delimiters.push(opts.delimiters[0]);
      }
      opts.language = (opts.language || opts.lang || 'yaml').toLowerCase();
      opts.engines = Object.assign({}, engines2, opts.parsers, opts.engines);
      return opts;
    };
  },
});

// node_modules/gray-matter/lib/engine.js
var require_engine = __commonJS({
  'node_modules/gray-matter/lib/engine.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    module2.exports = function (name, options2) {
      let engine = options2.engines[name] || options2.engines[aliase(name)];
      if (typeof engine === 'undefined') {
        throw new Error('gray-matter engine "' + name + '" is not registered');
      }
      if (typeof engine === 'function') {
        engine = { parse: engine };
      }
      return engine;
    };
    function aliase(name) {
      switch (name.toLowerCase()) {
        case 'js':
        case 'javascript':
          return 'javascript';
        case 'coffee':
        case 'coffeescript':
        case 'cson':
          return 'coffee';
        case 'yaml':
        case 'yml':
          return 'yaml';
        default: {
          return name;
        }
      }
    }
  },
});

// node_modules/gray-matter/lib/stringify.js
var require_stringify = __commonJS({
  'node_modules/gray-matter/lib/stringify.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var typeOf = require_kind_of();
    var getEngine = require_engine();
    var defaults = require_defaults();
    module2.exports = function (file, data, options2) {
      if (data == null && options2 == null) {
        switch (typeOf(file)) {
          case 'object':
            data = file.data;
            options2 = {};
            break;
          case 'string':
            return file;
          default: {
            throw new TypeError('expected file to be a string or object');
          }
        }
      }
      const str2 = file.content;
      const opts = defaults(options2);
      if (data == null) {
        if (!opts.data) return file;
        data = opts.data;
      }
      const language = file.language || opts.language;
      const engine = getEngine(language, opts);
      if (typeof engine.stringify !== 'function') {
        throw new TypeError('expected "' + language + '.stringify" to be a function');
      }
      data = Object.assign({}, file.data, data);
      const open = opts.delimiters[0];
      const close = opts.delimiters[1];
      const matter2 = engine.stringify(data, options2).trim();
      let buf = '';
      if (matter2 !== '{}') {
        buf = newline(open) + newline(matter2) + newline(close);
      }
      if (typeof file.excerpt === 'string' && file.excerpt !== '') {
        if (str2.indexOf(file.excerpt.trim()) === -1) {
          buf += newline(file.excerpt) + newline(close);
        }
      }
      return buf + newline(str2);
    };
    function newline(str2) {
      return str2.slice(-1) !== '\n' ? str2 + '\n' : str2;
    }
  },
});

// node_modules/gray-matter/lib/excerpt.js
var require_excerpt = __commonJS({
  'node_modules/gray-matter/lib/excerpt.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var defaults = require_defaults();
    module2.exports = function (file, options2) {
      const opts = defaults(options2);
      if (file.data == null) {
        file.data = {};
      }
      if (typeof opts.excerpt === 'function') {
        return opts.excerpt(file, opts);
      }
      const sep2 = file.data.excerpt_separator || opts.excerpt_separator;
      if (sep2 == null && (opts.excerpt === false || opts.excerpt == null)) {
        return file;
      }
      const delimiter =
        typeof opts.excerpt === 'string' ? opts.excerpt : sep2 || opts.delimiters[0];
      const idx = file.content.indexOf(delimiter);
      if (idx !== -1) {
        file.excerpt = file.content.slice(0, idx);
      }
      return file;
    };
  },
});

// node_modules/gray-matter/lib/to-file.js
var require_to_file = __commonJS({
  'node_modules/gray-matter/lib/to-file.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var typeOf = require_kind_of();
    var stringify = require_stringify();
    var utils = require_utils();
    module2.exports = function (file) {
      if (typeOf(file) !== 'object') {
        file = { content: file };
      }
      if (typeOf(file.data) !== 'object') {
        file.data = {};
      }
      if (file.contents && file.content == null) {
        file.content = file.contents;
      }
      utils.define(file, 'orig', utils.toBuffer(file.content));
      utils.define(file, 'language', file.language || '');
      utils.define(file, 'matter', file.matter || '');
      utils.define(file, 'stringify', function (data, options2) {
        if (options2 && options2.language) {
          file.language = options2.language;
        }
        return stringify(file, data, options2);
      });
      file.content = utils.toString(file.content);
      file.isEmpty = false;
      file.excerpt = '';
      return file;
    };
  },
});

// node_modules/gray-matter/lib/parse.js
var require_parse = __commonJS({
  'node_modules/gray-matter/lib/parse.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var getEngine = require_engine();
    var defaults = require_defaults();
    module2.exports = function (language, str2, options2) {
      const opts = defaults(options2);
      const engine = getEngine(language, opts);
      if (typeof engine.parse !== 'function') {
        throw new TypeError('expected "' + language + '.parse" to be a function');
      }
      return engine.parse(str2, opts);
    };
  },
});

// node_modules/gray-matter/index.js
var require_gray_matter = __commonJS({
  'node_modules/gray-matter/index.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var fs = require('fs');
    var sections = require_section_matter();
    var defaults = require_defaults();
    var stringify = require_stringify();
    var excerpt = require_excerpt();
    var engines2 = require_engines();
    var toFile = require_to_file();
    var parse2 = require_parse();
    var utils = require_utils();
    function matter2(input, options2) {
      if (input === '') {
        return { data: {}, content: input, excerpt: '', orig: input };
      }
      let file = toFile(input);
      const cached = matter2.cache[file.content];
      if (!options2) {
        if (cached) {
          file = Object.assign({}, cached);
          file.orig = cached.orig;
          return file;
        }
        matter2.cache[file.content] = file;
      }
      return parseMatter(file, options2);
    }
    function parseMatter(file, options2) {
      const opts = defaults(options2);
      const open = opts.delimiters[0];
      const close = '\n' + opts.delimiters[1];
      let str2 = file.content;
      if (opts.language) {
        file.language = opts.language;
      }
      const openLen = open.length;
      if (!utils.startsWith(str2, open, openLen)) {
        excerpt(file, opts);
        return file;
      }
      if (str2.charAt(openLen) === open.slice(-1)) {
        return file;
      }
      str2 = str2.slice(openLen);
      const len = str2.length;
      const language = matter2.language(str2, opts);
      if (language.name) {
        file.language = language.name;
        str2 = str2.slice(language.raw.length);
      }
      let closeIndex = str2.indexOf(close);
      if (closeIndex === -1) {
        closeIndex = len;
      }
      file.matter = str2.slice(0, closeIndex);
      const block = file.matter.replace(/^\s*#[^\n]+/gm, '').trim();
      if (block === '') {
        file.isEmpty = true;
        file.empty = file.content;
        file.data = {};
      } else {
        file.data = parse2(file.language, file.matter, opts);
      }
      if (closeIndex === len) {
        file.content = '';
      } else {
        file.content = str2.slice(closeIndex + close.length);
        if (file.content[0] === '\r') {
          file.content = file.content.slice(1);
        }
        if (file.content[0] === '\n') {
          file.content = file.content.slice(1);
        }
      }
      excerpt(file, opts);
      if (opts.sections === true || typeof opts.section === 'function') {
        sections(file, opts.section);
      }
      return file;
    }
    matter2.engines = engines2;
    matter2.stringify = function (file, data, options2) {
      if (typeof file === 'string') file = matter2(file, options2);
      return stringify(file, data, options2);
    };
    matter2.read = function (filepath, options2) {
      const str2 = fs.readFileSync(filepath, 'utf8');
      const file = matter2(str2, options2);
      file.path = filepath;
      return file;
    };
    matter2.test = function (str2, options2) {
      return utils.startsWith(str2, defaults(options2).delimiters[0]);
    };
    matter2.language = function (str2, options2) {
      const opts = defaults(options2);
      const open = opts.delimiters[0];
      if (matter2.test(str2)) {
        str2 = str2.slice(open.length);
      }
      const language = str2.slice(0, str2.search(/\r?\n/));
      return {
        raw: language,
        name: language ? language.trim() : '',
      };
    };
    matter2.cache = {};
    matter2.clearCache = function () {
      matter2.cache = {};
    };
    module2.exports = matter2;
  },
});

// node_modules/graceful-fs/polyfills.js
var require_polyfills = __commonJS({
  'node_modules/graceful-fs/polyfills.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var constants = require('constants');
    var origCwd = process.cwd;
    var cwd = null;
    var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
    process.cwd = function () {
      if (!cwd) cwd = origCwd.call(process);
      return cwd;
    };
    try {
      process.cwd();
    } catch (er) {}
    if (typeof process.chdir === 'function') {
      chdir = process.chdir;
      process.chdir = function (d) {
        cwd = null;
        chdir.call(process, d);
      };
      if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
    }
    var chdir;
    module2.exports = patch;
    function patch(fs) {
      if (
        constants.hasOwnProperty('O_SYMLINK') &&
        process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)
      ) {
        patchLchmod(fs);
      }
      if (!fs.lutimes) {
        patchLutimes(fs);
      }
      fs.chown = chownFix(fs.chown);
      fs.fchown = chownFix(fs.fchown);
      fs.lchown = chownFix(fs.lchown);
      fs.chmod = chmodFix(fs.chmod);
      fs.fchmod = chmodFix(fs.fchmod);
      fs.lchmod = chmodFix(fs.lchmod);
      fs.chownSync = chownFixSync(fs.chownSync);
      fs.fchownSync = chownFixSync(fs.fchownSync);
      fs.lchownSync = chownFixSync(fs.lchownSync);
      fs.chmodSync = chmodFixSync(fs.chmodSync);
      fs.fchmodSync = chmodFixSync(fs.fchmodSync);
      fs.lchmodSync = chmodFixSync(fs.lchmodSync);
      fs.stat = statFix(fs.stat);
      fs.fstat = statFix(fs.fstat);
      fs.lstat = statFix(fs.lstat);
      fs.statSync = statFixSync(fs.statSync);
      fs.fstatSync = statFixSync(fs.fstatSync);
      fs.lstatSync = statFixSync(fs.lstatSync);
      if (fs.chmod && !fs.lchmod) {
        fs.lchmod = function (path, mode, cb) {
          if (cb) process.nextTick(cb);
        };
        fs.lchmodSync = function () {};
      }
      if (fs.chown && !fs.lchown) {
        fs.lchown = function (path, uid, gid, cb) {
          if (cb) process.nextTick(cb);
        };
        fs.lchownSync = function () {};
      }
      if (platform === 'win32') {
        fs.rename =
          typeof fs.rename !== 'function'
            ? fs.rename
            : (function (fs$rename) {
                function rename(from, to, cb) {
                  var start = Date.now();
                  var backoff = 0;
                  fs$rename(from, to, function CB(er) {
                    if (
                      er &&
                      (er.code === 'EACCES' || er.code === 'EPERM' || er.code === 'EBUSY') &&
                      Date.now() - start < 6e4
                    ) {
                      setTimeout(function () {
                        fs.stat(to, function (stater, st) {
                          if (stater && stater.code === 'ENOENT') fs$rename(from, to, CB);
                          else cb(er);
                        });
                      }, backoff);
                      if (backoff < 100) backoff += 10;
                      return;
                    }
                    if (cb) cb(er);
                  });
                }
                if (Object.setPrototypeOf) Object.setPrototypeOf(rename, fs$rename);
                return rename;
              })(fs.rename);
      }
      fs.read =
        typeof fs.read !== 'function'
          ? fs.read
          : (function (fs$read) {
              function read(fd, buffer, offset, length, position, callback_) {
                var callback;
                if (callback_ && typeof callback_ === 'function') {
                  var eagCounter = 0;
                  callback = function (er, _, __) {
                    if (er && er.code === 'EAGAIN' && eagCounter < 10) {
                      eagCounter++;
                      return fs$read.call(fs, fd, buffer, offset, length, position, callback);
                    }
                    callback_.apply(this, arguments);
                  };
                }
                return fs$read.call(fs, fd, buffer, offset, length, position, callback);
              }
              if (Object.setPrototypeOf) Object.setPrototypeOf(read, fs$read);
              return read;
            })(fs.read);
      fs.readSync =
        typeof fs.readSync !== 'function'
          ? fs.readSync
          : /* @__PURE__ */ (function (fs$readSync) {
              return function (fd, buffer, offset, length, position) {
                var eagCounter = 0;
                while (true) {
                  try {
                    return fs$readSync.call(fs, fd, buffer, offset, length, position);
                  } catch (er) {
                    if (er.code === 'EAGAIN' && eagCounter < 10) {
                      eagCounter++;
                      continue;
                    }
                    throw er;
                  }
                }
              };
            })(fs.readSync);
      function patchLchmod(fs2) {
        fs2.lchmod = function (path, mode, callback) {
          fs2.open(path, constants.O_WRONLY | constants.O_SYMLINK, mode, function (err, fd) {
            if (err) {
              if (callback) callback(err);
              return;
            }
            fs2.fchmod(fd, mode, function (err2) {
              fs2.close(fd, function (err22) {
                if (callback) callback(err2 || err22);
              });
            });
          });
        };
        fs2.lchmodSync = function (path, mode) {
          var fd = fs2.openSync(path, constants.O_WRONLY | constants.O_SYMLINK, mode);
          var threw = true;
          var ret;
          try {
            ret = fs2.fchmodSync(fd, mode);
            threw = false;
          } finally {
            if (threw) {
              try {
                fs2.closeSync(fd);
              } catch (er) {}
            } else {
              fs2.closeSync(fd);
            }
          }
          return ret;
        };
      }
      function patchLutimes(fs2) {
        if (constants.hasOwnProperty('O_SYMLINK') && fs2.futimes) {
          fs2.lutimes = function (path, at, mt, cb) {
            fs2.open(path, constants.O_SYMLINK, function (er, fd) {
              if (er) {
                if (cb) cb(er);
                return;
              }
              fs2.futimes(fd, at, mt, function (er2) {
                fs2.close(fd, function (er22) {
                  if (cb) cb(er2 || er22);
                });
              });
            });
          };
          fs2.lutimesSync = function (path, at, mt) {
            var fd = fs2.openSync(path, constants.O_SYMLINK);
            var ret;
            var threw = true;
            try {
              ret = fs2.futimesSync(fd, at, mt);
              threw = false;
            } finally {
              if (threw) {
                try {
                  fs2.closeSync(fd);
                } catch (er) {}
              } else {
                fs2.closeSync(fd);
              }
            }
            return ret;
          };
        } else if (fs2.futimes) {
          fs2.lutimes = function (_a, _b, _c, cb) {
            if (cb) process.nextTick(cb);
          };
          fs2.lutimesSync = function () {};
        }
      }
      function chmodFix(orig) {
        if (!orig) return orig;
        return function (target, mode, cb) {
          return orig.call(fs, target, mode, function (er) {
            if (chownErOk(er)) er = null;
            if (cb) cb.apply(this, arguments);
          });
        };
      }
      function chmodFixSync(orig) {
        if (!orig) return orig;
        return function (target, mode) {
          try {
            return orig.call(fs, target, mode);
          } catch (er) {
            if (!chownErOk(er)) throw er;
          }
        };
      }
      function chownFix(orig) {
        if (!orig) return orig;
        return function (target, uid, gid, cb) {
          return orig.call(fs, target, uid, gid, function (er) {
            if (chownErOk(er)) er = null;
            if (cb) cb.apply(this, arguments);
          });
        };
      }
      function chownFixSync(orig) {
        if (!orig) return orig;
        return function (target, uid, gid) {
          try {
            return orig.call(fs, target, uid, gid);
          } catch (er) {
            if (!chownErOk(er)) throw er;
          }
        };
      }
      function statFix(orig) {
        if (!orig) return orig;
        return function (target, options2, cb) {
          if (typeof options2 === 'function') {
            cb = options2;
            options2 = null;
          }
          function callback(er, stats) {
            if (stats) {
              if (stats.uid < 0) stats.uid += 4294967296;
              if (stats.gid < 0) stats.gid += 4294967296;
            }
            if (cb) cb.apply(this, arguments);
          }
          return options2
            ? orig.call(fs, target, options2, callback)
            : orig.call(fs, target, callback);
        };
      }
      function statFixSync(orig) {
        if (!orig) return orig;
        return function (target, options2) {
          var stats = options2 ? orig.call(fs, target, options2) : orig.call(fs, target);
          if (stats) {
            if (stats.uid < 0) stats.uid += 4294967296;
            if (stats.gid < 0) stats.gid += 4294967296;
          }
          return stats;
        };
      }
      function chownErOk(er) {
        if (!er) return true;
        if (er.code === 'ENOSYS') return true;
        var nonroot = !process.getuid || process.getuid() !== 0;
        if (nonroot) {
          if (er.code === 'EINVAL' || er.code === 'EPERM') return true;
        }
        return false;
      }
    }
  },
});

// node_modules/graceful-fs/legacy-streams.js
var require_legacy_streams = __commonJS({
  'node_modules/graceful-fs/legacy-streams.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var Stream = require('stream').Stream;
    module2.exports = legacy;
    function legacy(fs) {
      return {
        ReadStream,
        WriteStream,
      };
      function ReadStream(path, options2) {
        if (!(this instanceof ReadStream)) return new ReadStream(path, options2);
        Stream.call(this);
        var self = this;
        this.path = path;
        this.fd = null;
        this.readable = true;
        this.paused = false;
        this.flags = 'r';
        this.mode = 438;
        this.bufferSize = 64 * 1024;
        options2 = options2 || {};
        var keys = Object.keys(options2);
        for (var index = 0, length = keys.length; index < length; index++) {
          var key = keys[index];
          this[key] = options2[key];
        }
        if (this.encoding) this.setEncoding(this.encoding);
        if (this.start !== void 0) {
          if ('number' !== typeof this.start) {
            throw TypeError('start must be a Number');
          }
          if (this.end === void 0) {
            this.end = Infinity;
          } else if ('number' !== typeof this.end) {
            throw TypeError('end must be a Number');
          }
          if (this.start > this.end) {
            throw new Error('start must be <= end');
          }
          this.pos = this.start;
        }
        if (this.fd !== null) {
          process.nextTick(function () {
            self._read();
          });
          return;
        }
        fs.open(this.path, this.flags, this.mode, function (err, fd) {
          if (err) {
            self.emit('error', err);
            self.readable = false;
            return;
          }
          self.fd = fd;
          self.emit('open', fd);
          self._read();
        });
      }
      function WriteStream(path, options2) {
        if (!(this instanceof WriteStream)) return new WriteStream(path, options2);
        Stream.call(this);
        this.path = path;
        this.fd = null;
        this.writable = true;
        this.flags = 'w';
        this.encoding = 'binary';
        this.mode = 438;
        this.bytesWritten = 0;
        options2 = options2 || {};
        var keys = Object.keys(options2);
        for (var index = 0, length = keys.length; index < length; index++) {
          var key = keys[index];
          this[key] = options2[key];
        }
        if (this.start !== void 0) {
          if ('number' !== typeof this.start) {
            throw TypeError('start must be a Number');
          }
          if (this.start < 0) {
            throw new Error('start must be >= zero');
          }
          this.pos = this.start;
        }
        this.busy = false;
        this._queue = [];
        if (this.fd === null) {
          this._open = fs.open;
          this._queue.push([this._open, this.path, this.flags, this.mode, void 0]);
          this.flush();
        }
      }
    }
  },
});

// node_modules/graceful-fs/clone.js
var require_clone = __commonJS({
  'node_modules/graceful-fs/clone.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    module2.exports = clone;
    var getPrototypeOf =
      Object.getPrototypeOf ||
      function (obj) {
        return obj.__proto__;
      };
    function clone(obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      if (obj instanceof Object) var copy = { __proto__: getPrototypeOf(obj) };
      else var copy = /* @__PURE__ */ Object.create(null);
      Object.getOwnPropertyNames(obj).forEach(function (key) {
        Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(obj, key));
      });
      return copy;
    }
  },
});

// node_modules/graceful-fs/graceful-fs.js
var require_graceful_fs = __commonJS({
  'node_modules/graceful-fs/graceful-fs.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var fs = require('fs');
    var polyfills = require_polyfills();
    var legacy = require_legacy_streams();
    var clone = require_clone();
    var util2 = require('util');
    var gracefulQueue;
    var previousSymbol;
    if (typeof Symbol === 'function' && typeof Symbol.for === 'function') {
      gracefulQueue = /* @__PURE__ */ Symbol.for('graceful-fs.queue');
      previousSymbol = /* @__PURE__ */ Symbol.for('graceful-fs.previous');
    } else {
      gracefulQueue = '___graceful-fs.queue';
      previousSymbol = '___graceful-fs.previous';
    }
    function noop() {}
    function publishQueue(context, queue2) {
      Object.defineProperty(context, gracefulQueue, {
        get: function () {
          return queue2;
        },
      });
    }
    var debug = noop;
    if (util2.debuglog) debug = util2.debuglog('gfs4');
    else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || ''))
      debug = function () {
        var m = util2.format.apply(util2, arguments);
        m = 'GFS4: ' + m.split(/\n/).join('\nGFS4: ');
        console.error(m);
      };
    if (!fs[gracefulQueue]) {
      queue = global[gracefulQueue] || [];
      publishQueue(fs, queue);
      fs.close = (function (fs$close) {
        function close(fd, cb) {
          return fs$close.call(fs, fd, function (err) {
            if (!err) {
              resetQueue();
            }
            if (typeof cb === 'function') cb.apply(this, arguments);
          });
        }
        Object.defineProperty(close, previousSymbol, {
          value: fs$close,
        });
        return close;
      })(fs.close);
      fs.closeSync = (function (fs$closeSync) {
        function closeSync(fd) {
          fs$closeSync.apply(fs, arguments);
          resetQueue();
        }
        Object.defineProperty(closeSync, previousSymbol, {
          value: fs$closeSync,
        });
        return closeSync;
      })(fs.closeSync);
      if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || '')) {
        process.on('exit', function () {
          debug(fs[gracefulQueue]);
          require('assert').equal(fs[gracefulQueue].length, 0);
        });
      }
    }
    var queue;
    if (!global[gracefulQueue]) {
      publishQueue(global, fs[gracefulQueue]);
    }
    module2.exports = patch(clone(fs));
    if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs.__patched) {
      module2.exports = patch(fs);
      fs.__patched = true;
    }
    function patch(fs2) {
      polyfills(fs2);
      fs2.gracefulify = patch;
      fs2.createReadStream = createReadStream;
      fs2.createWriteStream = createWriteStream;
      var fs$readFile = fs2.readFile;
      fs2.readFile = readFile;
      function readFile(path, options2, cb) {
        if (typeof options2 === 'function') ((cb = options2), (options2 = null));
        return go$readFile(path, options2, cb);
        function go$readFile(path2, options3, cb2, startTime) {
          return fs$readFile(path2, options3, function (err) {
            if (err && (err.code === 'EMFILE' || err.code === 'ENFILE'))
              enqueue([
                go$readFile,
                [path2, options3, cb2],
                err,
                startTime || Date.now(),
                Date.now(),
              ]);
            else {
              if (typeof cb2 === 'function') cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$writeFile = fs2.writeFile;
      fs2.writeFile = writeFile;
      function writeFile(path, data, options2, cb) {
        if (typeof options2 === 'function') ((cb = options2), (options2 = null));
        return go$writeFile(path, data, options2, cb);
        function go$writeFile(path2, data2, options3, cb2, startTime) {
          return fs$writeFile(path2, data2, options3, function (err) {
            if (err && (err.code === 'EMFILE' || err.code === 'ENFILE'))
              enqueue([
                go$writeFile,
                [path2, data2, options3, cb2],
                err,
                startTime || Date.now(),
                Date.now(),
              ]);
            else {
              if (typeof cb2 === 'function') cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$appendFile = fs2.appendFile;
      if (fs$appendFile) fs2.appendFile = appendFile;
      function appendFile(path, data, options2, cb) {
        if (typeof options2 === 'function') ((cb = options2), (options2 = null));
        return go$appendFile(path, data, options2, cb);
        function go$appendFile(path2, data2, options3, cb2, startTime) {
          return fs$appendFile(path2, data2, options3, function (err) {
            if (err && (err.code === 'EMFILE' || err.code === 'ENFILE'))
              enqueue([
                go$appendFile,
                [path2, data2, options3, cb2],
                err,
                startTime || Date.now(),
                Date.now(),
              ]);
            else {
              if (typeof cb2 === 'function') cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$copyFile = fs2.copyFile;
      if (fs$copyFile) fs2.copyFile = copyFile;
      function copyFile(src, dest, flags, cb) {
        if (typeof flags === 'function') {
          cb = flags;
          flags = 0;
        }
        return go$copyFile(src, dest, flags, cb);
        function go$copyFile(src2, dest2, flags2, cb2, startTime) {
          return fs$copyFile(src2, dest2, flags2, function (err) {
            if (err && (err.code === 'EMFILE' || err.code === 'ENFILE'))
              enqueue([
                go$copyFile,
                [src2, dest2, flags2, cb2],
                err,
                startTime || Date.now(),
                Date.now(),
              ]);
            else {
              if (typeof cb2 === 'function') cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$readdir = fs2.readdir;
      fs2.readdir = readdir;
      var noReaddirOptionVersions = /^v[0-5]\./;
      function readdir(path, options2, cb) {
        if (typeof options2 === 'function') ((cb = options2), (options2 = null));
        var go$readdir = noReaddirOptionVersions.test(process.version)
          ? function go$readdir2(path2, options3, cb2, startTime) {
              return fs$readdir(path2, fs$readdirCallback(path2, options3, cb2, startTime));
            }
          : function go$readdir2(path2, options3, cb2, startTime) {
              return fs$readdir(
                path2,
                options3,
                fs$readdirCallback(path2, options3, cb2, startTime)
              );
            };
        return go$readdir(path, options2, cb);
        function fs$readdirCallback(path2, options3, cb2, startTime) {
          return function (err, files) {
            if (err && (err.code === 'EMFILE' || err.code === 'ENFILE'))
              enqueue([
                go$readdir,
                [path2, options3, cb2],
                err,
                startTime || Date.now(),
                Date.now(),
              ]);
            else {
              if (files && files.sort) files.sort();
              if (typeof cb2 === 'function') cb2.call(this, err, files);
            }
          };
        }
      }
      if (process.version.substr(0, 4) === 'v0.8') {
        var legStreams = legacy(fs2);
        ReadStream = legStreams.ReadStream;
        WriteStream = legStreams.WriteStream;
      }
      var fs$ReadStream = fs2.ReadStream;
      if (fs$ReadStream) {
        ReadStream.prototype = Object.create(fs$ReadStream.prototype);
        ReadStream.prototype.open = ReadStream$open;
      }
      var fs$WriteStream = fs2.WriteStream;
      if (fs$WriteStream) {
        WriteStream.prototype = Object.create(fs$WriteStream.prototype);
        WriteStream.prototype.open = WriteStream$open;
      }
      Object.defineProperty(fs2, 'ReadStream', {
        get: function () {
          return ReadStream;
        },
        set: function (val) {
          ReadStream = val;
        },
        enumerable: true,
        configurable: true,
      });
      Object.defineProperty(fs2, 'WriteStream', {
        get: function () {
          return WriteStream;
        },
        set: function (val) {
          WriteStream = val;
        },
        enumerable: true,
        configurable: true,
      });
      var FileReadStream = ReadStream;
      Object.defineProperty(fs2, 'FileReadStream', {
        get: function () {
          return FileReadStream;
        },
        set: function (val) {
          FileReadStream = val;
        },
        enumerable: true,
        configurable: true,
      });
      var FileWriteStream = WriteStream;
      Object.defineProperty(fs2, 'FileWriteStream', {
        get: function () {
          return FileWriteStream;
        },
        set: function (val) {
          FileWriteStream = val;
        },
        enumerable: true,
        configurable: true,
      });
      function ReadStream(path, options2) {
        if (this instanceof ReadStream) return (fs$ReadStream.apply(this, arguments), this);
        else return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
      }
      function ReadStream$open() {
        var that = this;
        open(that.path, that.flags, that.mode, function (err, fd) {
          if (err) {
            if (that.autoClose) that.destroy();
            that.emit('error', err);
          } else {
            that.fd = fd;
            that.emit('open', fd);
            that.read();
          }
        });
      }
      function WriteStream(path, options2) {
        if (this instanceof WriteStream) return (fs$WriteStream.apply(this, arguments), this);
        else return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
      }
      function WriteStream$open() {
        var that = this;
        open(that.path, that.flags, that.mode, function (err, fd) {
          if (err) {
            that.destroy();
            that.emit('error', err);
          } else {
            that.fd = fd;
            that.emit('open', fd);
          }
        });
      }
      function createReadStream(path, options2) {
        return new fs2.ReadStream(path, options2);
      }
      function createWriteStream(path, options2) {
        return new fs2.WriteStream(path, options2);
      }
      var fs$open = fs2.open;
      fs2.open = open;
      function open(path, flags, mode, cb) {
        if (typeof mode === 'function') ((cb = mode), (mode = null));
        return go$open(path, flags, mode, cb);
        function go$open(path2, flags2, mode2, cb2, startTime) {
          return fs$open(path2, flags2, mode2, function (err, fd) {
            if (err && (err.code === 'EMFILE' || err.code === 'ENFILE'))
              enqueue([
                go$open,
                [path2, flags2, mode2, cb2],
                err,
                startTime || Date.now(),
                Date.now(),
              ]);
            else {
              if (typeof cb2 === 'function') cb2.apply(this, arguments);
            }
          });
        }
      }
      return fs2;
    }
    function enqueue(elem) {
      debug('ENQUEUE', elem[0].name, elem[1]);
      fs[gracefulQueue].push(elem);
      retry();
    }
    var retryTimer;
    function resetQueue() {
      var now = Date.now();
      for (var i = 0; i < fs[gracefulQueue].length; ++i) {
        if (fs[gracefulQueue][i].length > 2) {
          fs[gracefulQueue][i][3] = now;
          fs[gracefulQueue][i][4] = now;
        }
      }
      retry();
    }
    function retry() {
      clearTimeout(retryTimer);
      retryTimer = void 0;
      if (fs[gracefulQueue].length === 0) return;
      var elem = fs[gracefulQueue].shift();
      var fn = elem[0];
      var args = elem[1];
      var err = elem[2];
      var startTime = elem[3];
      var lastTime = elem[4];
      if (startTime === void 0) {
        debug('RETRY', fn.name, args);
        fn.apply(null, args);
      } else if (Date.now() - startTime >= 6e4) {
        debug('TIMEOUT', fn.name, args);
        var cb = args.pop();
        if (typeof cb === 'function') cb.call(null, err);
      } else {
        var sinceAttempt = Date.now() - lastTime;
        var sinceStart = Math.max(lastTime - startTime, 1);
        var desiredDelay = Math.min(sinceStart * 1.2, 100);
        if (sinceAttempt >= desiredDelay) {
          debug('RETRY', fn.name, args);
          fn.apply(null, args.concat([startTime]));
        } else {
          fs[gracefulQueue].push(elem);
        }
      }
      if (retryTimer === void 0) {
        retryTimer = setTimeout(retry, 0);
      }
    }
  },
});

// node_modules/retry/lib/retry_operation.js
var require_retry_operation = __commonJS({
  'node_modules/retry/lib/retry_operation.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    function RetryOperation(timeouts, options2) {
      if (typeof options2 === 'boolean') {
        options2 = { forever: options2 };
      }
      this._originalTimeouts = JSON.parse(JSON.stringify(timeouts));
      this._timeouts = timeouts;
      this._options = options2 || {};
      this._maxRetryTime = (options2 && options2.maxRetryTime) || Infinity;
      this._fn = null;
      this._errors = [];
      this._attempts = 1;
      this._operationTimeout = null;
      this._operationTimeoutCb = null;
      this._timeout = null;
      this._operationStart = null;
      if (this._options.forever) {
        this._cachedTimeouts = this._timeouts.slice(0);
      }
    }
    module2.exports = RetryOperation;
    RetryOperation.prototype.reset = function () {
      this._attempts = 1;
      this._timeouts = this._originalTimeouts;
    };
    RetryOperation.prototype.stop = function () {
      if (this._timeout) {
        clearTimeout(this._timeout);
      }
      this._timeouts = [];
      this._cachedTimeouts = null;
    };
    RetryOperation.prototype.retry = function (err) {
      if (this._timeout) {
        clearTimeout(this._timeout);
      }
      if (!err) {
        return false;
      }
      var currentTime = /* @__PURE__ */ new Date().getTime();
      if (err && currentTime - this._operationStart >= this._maxRetryTime) {
        this._errors.unshift(new Error('RetryOperation timeout occurred'));
        return false;
      }
      this._errors.push(err);
      var timeout = this._timeouts.shift();
      if (timeout === void 0) {
        if (this._cachedTimeouts) {
          this._errors.splice(this._errors.length - 1, this._errors.length);
          this._timeouts = this._cachedTimeouts.slice(0);
          timeout = this._timeouts.shift();
        } else {
          return false;
        }
      }
      var self = this;
      var timer = setTimeout(function () {
        self._attempts++;
        if (self._operationTimeoutCb) {
          self._timeout = setTimeout(function () {
            self._operationTimeoutCb(self._attempts);
          }, self._operationTimeout);
          if (self._options.unref) {
            self._timeout.unref();
          }
        }
        self._fn(self._attempts);
      }, timeout);
      if (this._options.unref) {
        timer.unref();
      }
      return true;
    };
    RetryOperation.prototype.attempt = function (fn, timeoutOps) {
      this._fn = fn;
      if (timeoutOps) {
        if (timeoutOps.timeout) {
          this._operationTimeout = timeoutOps.timeout;
        }
        if (timeoutOps.cb) {
          this._operationTimeoutCb = timeoutOps.cb;
        }
      }
      var self = this;
      if (this._operationTimeoutCb) {
        this._timeout = setTimeout(function () {
          self._operationTimeoutCb();
        }, self._operationTimeout);
      }
      this._operationStart = /* @__PURE__ */ new Date().getTime();
      this._fn(this._attempts);
    };
    RetryOperation.prototype.try = function (fn) {
      console.log('Using RetryOperation.try() is deprecated');
      this.attempt(fn);
    };
    RetryOperation.prototype.start = function (fn) {
      console.log('Using RetryOperation.start() is deprecated');
      this.attempt(fn);
    };
    RetryOperation.prototype.start = RetryOperation.prototype.try;
    RetryOperation.prototype.errors = function () {
      return this._errors;
    };
    RetryOperation.prototype.attempts = function () {
      return this._attempts;
    };
    RetryOperation.prototype.mainError = function () {
      if (this._errors.length === 0) {
        return null;
      }
      var counts = {};
      var mainError = null;
      var mainErrorCount = 0;
      for (var i = 0; i < this._errors.length; i++) {
        var error = this._errors[i];
        var message = error.message;
        var count = (counts[message] || 0) + 1;
        counts[message] = count;
        if (count >= mainErrorCount) {
          mainError = error;
          mainErrorCount = count;
        }
      }
      return mainError;
    };
  },
});

// node_modules/retry/lib/retry.js
var require_retry = __commonJS({
  'node_modules/retry/lib/retry.js'(exports2) {
    'use strict';
    init_cjs_shims();
    var RetryOperation = require_retry_operation();
    exports2.operation = function (options2) {
      var timeouts = exports2.timeouts(options2);
      return new RetryOperation(timeouts, {
        forever: options2 && options2.forever,
        unref: options2 && options2.unref,
        maxRetryTime: options2 && options2.maxRetryTime,
      });
    };
    exports2.timeouts = function (options2) {
      if (options2 instanceof Array) {
        return [].concat(options2);
      }
      var opts = {
        retries: 10,
        factor: 2,
        minTimeout: 1 * 1e3,
        maxTimeout: Infinity,
        randomize: false,
      };
      for (var key in options2) {
        opts[key] = options2[key];
      }
      if (opts.minTimeout > opts.maxTimeout) {
        throw new Error('minTimeout is greater than maxTimeout');
      }
      var timeouts = [];
      for (var i = 0; i < opts.retries; i++) {
        timeouts.push(this.createTimeout(i, opts));
      }
      if (options2 && options2.forever && !timeouts.length) {
        timeouts.push(this.createTimeout(i, opts));
      }
      timeouts.sort(function (a, b) {
        return a - b;
      });
      return timeouts;
    };
    exports2.createTimeout = function (attempt, opts) {
      var random = opts.randomize ? Math.random() + 1 : 1;
      var timeout = Math.round(random * opts.minTimeout * Math.pow(opts.factor, attempt));
      timeout = Math.min(timeout, opts.maxTimeout);
      return timeout;
    };
    exports2.wrap = function (obj, options2, methods) {
      if (options2 instanceof Array) {
        methods = options2;
        options2 = null;
      }
      if (!methods) {
        methods = [];
        for (var key in obj) {
          if (typeof obj[key] === 'function') {
            methods.push(key);
          }
        }
      }
      for (var i = 0; i < methods.length; i++) {
        var method = methods[i];
        var original = obj[method];
        obj[method] = function retryWrapper(original2) {
          var op = exports2.operation(options2);
          var args = Array.prototype.slice.call(arguments, 1);
          var callback = args.pop();
          args.push(function (err) {
            if (op.retry(err)) {
              return;
            }
            if (err) {
              arguments[0] = op.mainError();
            }
            callback.apply(this, arguments);
          });
          op.attempt(function () {
            original2.apply(obj, args);
          });
        }.bind(obj, original);
        obj[method].options = options2;
      }
    };
  },
});

// node_modules/retry/index.js
var require_retry2 = __commonJS({
  'node_modules/retry/index.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    module2.exports = require_retry();
  },
});

// node_modules/proper-lockfile/node_modules/signal-exit/signals.js
var require_signals = __commonJS({
  'node_modules/proper-lockfile/node_modules/signal-exit/signals.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    module2.exports = ['SIGABRT', 'SIGALRM', 'SIGHUP', 'SIGINT', 'SIGTERM'];
    if (process.platform !== 'win32') {
      module2.exports.push(
        'SIGVTALRM',
        'SIGXCPU',
        'SIGXFSZ',
        'SIGUSR2',
        'SIGTRAP',
        'SIGSYS',
        'SIGQUIT',
        'SIGIOT'
        // should detect profiler and enable/disable accordingly.
        // see #21
        // 'SIGPROF'
      );
    }
    if (process.platform === 'linux') {
      module2.exports.push('SIGIO', 'SIGPOLL', 'SIGPWR', 'SIGSTKFLT', 'SIGUNUSED');
    }
  },
});

// node_modules/proper-lockfile/node_modules/signal-exit/index.js
var require_signal_exit = __commonJS({
  'node_modules/proper-lockfile/node_modules/signal-exit/index.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var process2 = global.process;
    var processOk = function (process3) {
      return (
        process3 &&
        typeof process3 === 'object' &&
        typeof process3.removeListener === 'function' &&
        typeof process3.emit === 'function' &&
        typeof process3.reallyExit === 'function' &&
        typeof process3.listeners === 'function' &&
        typeof process3.kill === 'function' &&
        typeof process3.pid === 'number' &&
        typeof process3.on === 'function'
      );
    };
    if (!processOk(process2)) {
      module2.exports = function () {
        return function () {};
      };
    } else {
      assert = require('assert');
      signals = require_signals();
      isWin = /^win/i.test(process2.platform);
      EE = require('events');
      if (typeof EE !== 'function') {
        EE = EE.EventEmitter;
      }
      if (process2.__signal_exit_emitter__) {
        emitter = process2.__signal_exit_emitter__;
      } else {
        emitter = process2.__signal_exit_emitter__ = new EE();
        emitter.count = 0;
        emitter.emitted = {};
      }
      if (!emitter.infinite) {
        emitter.setMaxListeners(Infinity);
        emitter.infinite = true;
      }
      module2.exports = function (cb, opts) {
        if (!processOk(global.process)) {
          return function () {};
        }
        assert.equal(typeof cb, 'function', 'a callback must be provided for exit handler');
        if (loaded === false) {
          load2();
        }
        var ev = 'exit';
        if (opts && opts.alwaysLast) {
          ev = 'afterexit';
        }
        var remove = function () {
          emitter.removeListener(ev, cb);
          if (
            emitter.listeners('exit').length === 0 &&
            emitter.listeners('afterexit').length === 0
          ) {
            unload();
          }
        };
        emitter.on(ev, cb);
        return remove;
      };
      unload = function unload2() {
        if (!loaded || !processOk(global.process)) {
          return;
        }
        loaded = false;
        signals.forEach(function (sig) {
          try {
            process2.removeListener(sig, sigListeners[sig]);
          } catch (er) {}
        });
        process2.emit = originalProcessEmit;
        process2.reallyExit = originalProcessReallyExit;
        emitter.count -= 1;
      };
      module2.exports.unload = unload;
      emit = function emit2(event, code, signal) {
        if (emitter.emitted[event]) {
          return;
        }
        emitter.emitted[event] = true;
        emitter.emit(event, code, signal);
      };
      sigListeners = {};
      signals.forEach(function (sig) {
        sigListeners[sig] = function listener() {
          if (!processOk(global.process)) {
            return;
          }
          var listeners = process2.listeners(sig);
          if (listeners.length === emitter.count) {
            unload();
            emit('exit', null, sig);
            emit('afterexit', null, sig);
            if (isWin && sig === 'SIGHUP') {
              sig = 'SIGINT';
            }
            process2.kill(process2.pid, sig);
          }
        };
      });
      module2.exports.signals = function () {
        return signals;
      };
      loaded = false;
      load2 = function load3() {
        if (loaded || !processOk(global.process)) {
          return;
        }
        loaded = true;
        emitter.count += 1;
        signals = signals.filter(function (sig) {
          try {
            process2.on(sig, sigListeners[sig]);
            return true;
          } catch (er) {
            return false;
          }
        });
        process2.emit = processEmit;
        process2.reallyExit = processReallyExit;
      };
      module2.exports.load = load2;
      originalProcessReallyExit = process2.reallyExit;
      processReallyExit = function processReallyExit2(code) {
        if (!processOk(global.process)) {
          return;
        }
        process2.exitCode = code /* istanbul ignore next */ || 0;
        emit('exit', process2.exitCode, null);
        emit('afterexit', process2.exitCode, null);
        originalProcessReallyExit.call(process2, process2.exitCode);
      };
      originalProcessEmit = process2.emit;
      processEmit = function processEmit2(ev, arg) {
        if (ev === 'exit' && processOk(global.process)) {
          if (arg !== void 0) {
            process2.exitCode = arg;
          }
          var ret = originalProcessEmit.apply(this, arguments);
          emit('exit', process2.exitCode, null);
          emit('afterexit', process2.exitCode, null);
          return ret;
        } else {
          return originalProcessEmit.apply(this, arguments);
        }
      };
    }
    var assert;
    var signals;
    var isWin;
    var EE;
    var emitter;
    var unload;
    var emit;
    var sigListeners;
    var loaded;
    var load2;
    var originalProcessReallyExit;
    var processReallyExit;
    var originalProcessEmit;
    var processEmit;
  },
});

// node_modules/proper-lockfile/lib/mtime-precision.js
var require_mtime_precision = __commonJS({
  'node_modules/proper-lockfile/lib/mtime-precision.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var cacheSymbol = /* @__PURE__ */ Symbol();
    function probe(file, fs, callback) {
      const cachedPrecision = fs[cacheSymbol];
      if (cachedPrecision) {
        return fs.stat(file, (err, stat) => {
          if (err) {
            return callback(err);
          }
          callback(null, stat.mtime, cachedPrecision);
        });
      }
      const mtime = new Date(Math.ceil(Date.now() / 1e3) * 1e3 + 5);
      fs.utimes(file, mtime, mtime, err => {
        if (err) {
          return callback(err);
        }
        fs.stat(file, (err2, stat) => {
          if (err2) {
            return callback(err2);
          }
          const precision = stat.mtime.getTime() % 1e3 === 0 ? 's' : 'ms';
          Object.defineProperty(fs, cacheSymbol, { value: precision });
          callback(null, stat.mtime, precision);
        });
      });
    }
    function getMtime(precision) {
      let now = Date.now();
      if (precision === 's') {
        now = Math.ceil(now / 1e3) * 1e3;
      }
      return new Date(now);
    }
    module2.exports.probe = probe;
    module2.exports.getMtime = getMtime;
  },
});

// node_modules/proper-lockfile/lib/lockfile.js
var require_lockfile = __commonJS({
  'node_modules/proper-lockfile/lib/lockfile.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var path = require('path');
    var fs = require_graceful_fs();
    var retry = require_retry2();
    var onExit = require_signal_exit();
    var mtimePrecision = require_mtime_precision();
    var locks = {};
    function getLockFile(file, options2) {
      return options2.lockfilePath || `${file}.lock`;
    }
    function resolveCanonicalPath(file, options2, callback) {
      if (!options2.realpath) {
        return callback(null, path.resolve(file));
      }
      options2.fs.realpath(file, callback);
    }
    function acquireLock(file, options2, callback) {
      const lockfilePath = getLockFile(file, options2);
      options2.fs.mkdir(lockfilePath, err => {
        if (!err) {
          return mtimePrecision.probe(lockfilePath, options2.fs, (err2, mtime, mtimePrecision2) => {
            if (err2) {
              options2.fs.rmdir(lockfilePath, () => {});
              return callback(err2);
            }
            callback(null, mtime, mtimePrecision2);
          });
        }
        if (err.code !== 'EEXIST') {
          return callback(err);
        }
        if (options2.stale <= 0) {
          return callback(
            Object.assign(new Error('Lock file is already being held'), { code: 'ELOCKED', file })
          );
        }
        options2.fs.stat(lockfilePath, (err2, stat) => {
          if (err2) {
            if (err2.code === 'ENOENT') {
              return acquireLock(file, { ...options2, stale: 0 }, callback);
            }
            return callback(err2);
          }
          if (!isLockStale(stat, options2)) {
            return callback(
              Object.assign(new Error('Lock file is already being held'), { code: 'ELOCKED', file })
            );
          }
          removeLock(file, options2, err3 => {
            if (err3) {
              return callback(err3);
            }
            acquireLock(file, { ...options2, stale: 0 }, callback);
          });
        });
      });
    }
    function isLockStale(stat, options2) {
      return stat.mtime.getTime() < Date.now() - options2.stale;
    }
    function removeLock(file, options2, callback) {
      options2.fs.rmdir(getLockFile(file, options2), err => {
        if (err && err.code !== 'ENOENT') {
          return callback(err);
        }
        callback();
      });
    }
    function updateLock(file, options2) {
      const lock2 = locks[file];
      if (lock2.updateTimeout) {
        return;
      }
      lock2.updateDelay = lock2.updateDelay || options2.update;
      lock2.updateTimeout = setTimeout(() => {
        lock2.updateTimeout = null;
        options2.fs.stat(lock2.lockfilePath, (err, stat) => {
          const isOverThreshold = lock2.lastUpdate + options2.stale < Date.now();
          if (err) {
            if (err.code === 'ENOENT' || isOverThreshold) {
              return setLockAsCompromised(
                file,
                lock2,
                Object.assign(err, { code: 'ECOMPROMISED' })
              );
            }
            lock2.updateDelay = 1e3;
            return updateLock(file, options2);
          }
          const isMtimeOurs = lock2.mtime.getTime() === stat.mtime.getTime();
          if (!isMtimeOurs) {
            return setLockAsCompromised(
              file,
              lock2,
              Object.assign(new Error('Unable to update lock within the stale threshold'), {
                code: 'ECOMPROMISED',
              })
            );
          }
          const mtime = mtimePrecision.getMtime(lock2.mtimePrecision);
          options2.fs.utimes(lock2.lockfilePath, mtime, mtime, err2 => {
            const isOverThreshold2 = lock2.lastUpdate + options2.stale < Date.now();
            if (lock2.released) {
              return;
            }
            if (err2) {
              if (err2.code === 'ENOENT' || isOverThreshold2) {
                return setLockAsCompromised(
                  file,
                  lock2,
                  Object.assign(err2, { code: 'ECOMPROMISED' })
                );
              }
              lock2.updateDelay = 1e3;
              return updateLock(file, options2);
            }
            lock2.mtime = mtime;
            lock2.lastUpdate = Date.now();
            lock2.updateDelay = null;
            updateLock(file, options2);
          });
        });
      }, lock2.updateDelay);
      if (lock2.updateTimeout.unref) {
        lock2.updateTimeout.unref();
      }
    }
    function setLockAsCompromised(file, lock2, err) {
      lock2.released = true;
      if (lock2.updateTimeout) {
        clearTimeout(lock2.updateTimeout);
      }
      if (locks[file] === lock2) {
        delete locks[file];
      }
      lock2.options.onCompromised(err);
    }
    function lock(file, options2, callback) {
      options2 = {
        stale: 1e4,
        update: null,
        realpath: true,
        retries: 0,
        fs,
        onCompromised: err => {
          throw err;
        },
        ...options2,
      };
      options2.retries = options2.retries || 0;
      options2.retries =
        typeof options2.retries === 'number' ? { retries: options2.retries } : options2.retries;
      options2.stale = Math.max(options2.stale || 0, 2e3);
      options2.update = options2.update == null ? options2.stale / 2 : options2.update || 0;
      options2.update = Math.max(Math.min(options2.update, options2.stale / 2), 1e3);
      resolveCanonicalPath(file, options2, (err, file2) => {
        if (err) {
          return callback(err);
        }
        const operation = retry.operation(options2.retries);
        operation.attempt(() => {
          acquireLock(file2, options2, (err2, mtime, mtimePrecision2) => {
            if (operation.retry(err2)) {
              return;
            }
            if (err2) {
              return callback(operation.mainError());
            }
            const lock2 = (locks[file2] = {
              lockfilePath: getLockFile(file2, options2),
              mtime,
              mtimePrecision: mtimePrecision2,
              options: options2,
              lastUpdate: Date.now(),
            });
            updateLock(file2, options2);
            callback(null, releasedCallback => {
              if (lock2.released) {
                return (
                  releasedCallback &&
                  releasedCallback(
                    Object.assign(new Error('Lock is already released'), { code: 'ERELEASED' })
                  )
                );
              }
              unlock(file2, { ...options2, realpath: false }, releasedCallback);
            });
          });
        });
      });
    }
    function unlock(file, options2, callback) {
      options2 = {
        fs,
        realpath: true,
        ...options2,
      };
      resolveCanonicalPath(file, options2, (err, file2) => {
        if (err) {
          return callback(err);
        }
        const lock2 = locks[file2];
        if (!lock2) {
          return callback(
            Object.assign(new Error('Lock is not acquired/owned by you'), { code: 'ENOTACQUIRED' })
          );
        }
        lock2.updateTimeout && clearTimeout(lock2.updateTimeout);
        lock2.released = true;
        delete locks[file2];
        removeLock(file2, options2, callback);
      });
    }
    function check(file, options2, callback) {
      options2 = {
        stale: 1e4,
        realpath: true,
        fs,
        ...options2,
      };
      options2.stale = Math.max(options2.stale || 0, 2e3);
      resolveCanonicalPath(file, options2, (err, file2) => {
        if (err) {
          return callback(err);
        }
        options2.fs.stat(getLockFile(file2, options2), (err2, stat) => {
          if (err2) {
            return err2.code === 'ENOENT' ? callback(null, false) : callback(err2);
          }
          return callback(null, !isLockStale(stat, options2));
        });
      });
    }
    function getLocks() {
      return locks;
    }
    onExit(() => {
      for (const file in locks) {
        const options2 = locks[file].options;
        try {
          options2.fs.rmdirSync(getLockFile(file, options2));
        } catch (e) {}
      }
    });
    module2.exports.lock = lock;
    module2.exports.unlock = unlock;
    module2.exports.check = check;
    module2.exports.getLocks = getLocks;
  },
});

// node_modules/proper-lockfile/lib/adapter.js
var require_adapter = __commonJS({
  'node_modules/proper-lockfile/lib/adapter.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var fs = require_graceful_fs();
    function createSyncFs(fs2) {
      const methods = ['mkdir', 'realpath', 'stat', 'rmdir', 'utimes'];
      const newFs = { ...fs2 };
      methods.forEach(method => {
        newFs[method] = (...args) => {
          const callback = args.pop();
          let ret;
          try {
            ret = fs2[`${method}Sync`](...args);
          } catch (err) {
            return callback(err);
          }
          callback(null, ret);
        };
      });
      return newFs;
    }
    function toPromise(method) {
      return (...args) =>
        new Promise((resolve3, reject) => {
          args.push((err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve3(result);
            }
          });
          method(...args);
        });
    }
    function toSync(method) {
      return (...args) => {
        let err;
        let result;
        args.push((_err, _result) => {
          err = _err;
          result = _result;
        });
        method(...args);
        if (err) {
          throw err;
        }
        return result;
      };
    }
    function toSyncOptions(options2) {
      options2 = { ...options2 };
      options2.fs = createSyncFs(options2.fs || fs);
      if (
        (typeof options2.retries === 'number' && options2.retries > 0) ||
        (options2.retries &&
          typeof options2.retries.retries === 'number' &&
          options2.retries.retries > 0)
      ) {
        throw Object.assign(new Error('Cannot use retries with the sync api'), { code: 'ESYNC' });
      }
      return options2;
    }
    module2.exports = {
      toPromise,
      toSync,
      toSyncOptions,
    };
  },
});

// node_modules/proper-lockfile/index.js
var require_proper_lockfile = __commonJS({
  'node_modules/proper-lockfile/index.js'(exports2, module2) {
    'use strict';
    init_cjs_shims();
    var lockfile2 = require_lockfile();
    var { toPromise, toSync, toSyncOptions } = require_adapter();
    async function lock(file, options2) {
      const release = await toPromise(lockfile2.lock)(file, options2);
      return toPromise(release);
    }
    function lockSync(file, options2) {
      const release = toSync(lockfile2.lock)(file, toSyncOptions(options2));
      return toSync(release);
    }
    function unlock(file, options2) {
      return toPromise(lockfile2.unlock)(file, options2);
    }
    function unlockSync(file, options2) {
      return toSync(lockfile2.unlock)(file, toSyncOptions(options2));
    }
    function check(file, options2) {
      return toPromise(lockfile2.check)(file, options2);
    }
    function checkSync(file, options2) {
      return toSync(lockfile2.check)(file, toSyncOptions(options2));
    }
    module2.exports = lock;
    module2.exports.lock = lock;
    module2.exports.unlock = unlock;
    module2.exports.lockSync = lockSync;
    module2.exports.unlockSync = unlockSync;
    module2.exports.check = check;
    module2.exports.checkSync = checkSync;
  },
});

// src/harnesses/codex/hooks/kk-capture.ts
var kk_capture_exports = {};
__export(kk_capture_exports, {
  CODEX_EVENT_TO_TRIGGER: () => CODEX_EVENT_TO_TRIGGER,
});
module.exports = __toCommonJS(kk_capture_exports);
init_cjs_shims();
var import_node_fs8 = require('fs');
var import_node_os = require('os');
var import_node_path8 = require('path');

// src/lib/capture.ts
init_cjs_shims();
var import_node_crypto = require('crypto');
var import_node_fs5 = require('fs');
var import_node_path5 = require('path');
var import_gray_matter = __toESM(require_gray_matter(), 1);

// src/lib/session-log.ts
init_cjs_shims();
var import_node_fs = require('fs');
var import_node_path = require('path');

// node_modules/js-yaml/dist/js-yaml.mjs
init_cjs_shims();
var __create2 = Object.create;
var __defProp2 = Object.defineProperty;
var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
var __getOwnPropNames2 = Object.getOwnPropertyNames;
var __getProtoOf2 = Object.getPrototypeOf;
var __hasOwnProp2 = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (
  mod || (cb((mod = { exports: {} }).exports, mod), (cb = null)),
  mod.exports
);
var __copyProps2 = (to, from, except, desc) => {
  if ((from && typeof from === 'object') || typeof from === 'function')
    for (var keys = __getOwnPropNames2(from), i = 0, n = keys.length, key; i < n; i++) {
      key = keys[i];
      if (!__hasOwnProp2.call(to, key) && key !== except)
        __defProp2(to, key, {
          get: (k => from[k]).bind(null, key),
          enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable,
        });
    }
  return to;
};
var __toESM2 = (mod, isNodeMode, target) => (
  (target = mod != null ? __create2(__getProtoOf2(mod)) : {}),
  __copyProps2(
    isNodeMode || !mod || !mod.__esModule
      ? __defProp2(target, 'default', {
          value: mod,
          enumerable: true,
        })
      : target,
    mod
  )
);
var require_common2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  function isNothing(subject) {
    return typeof subject === 'undefined' || subject === null;
  }
  function isObject(subject) {
    return typeof subject === 'object' && subject !== null;
  }
  function toArray(sequence) {
    if (Array.isArray(sequence)) return sequence;
    else if (isNothing(sequence)) return [];
    return [sequence];
  }
  function extend(target, source) {
    if (source) {
      const sourceKeys = Object.keys(source);
      for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
        const key = sourceKeys[index];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    let result = '';
    for (let cycle = 0; cycle < count; cycle += 1) result += string;
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  module2.exports.isNothing = isNothing;
  module2.exports.isObject = isObject;
  module2.exports.toArray = toArray;
  module2.exports.repeat = repeat;
  module2.exports.isNegativeZero = isNegativeZero;
  module2.exports.extend = extend;
});
var require_exception2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  function formatError(exception, compact) {
    let where = '';
    const message = exception.reason || '(unknown reason)';
    if (!exception.mark) return message;
    if (exception.mark.name) where += 'in "' + exception.mark.name + '" ';
    where += '(' + (exception.mark.line + 1) + ':' + (exception.mark.column + 1) + ')';
    if (!compact && exception.mark.snippet) where += '\n\n' + exception.mark.snippet;
    return message + ' ' + where;
  }
  function YAMLException2(reason, mark) {
    Error.call(this);
    this.name = 'YAMLException';
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
    else this.stack = /* @__PURE__ */ new Error().stack || '';
  }
  YAMLException2.prototype = Object.create(Error.prototype);
  YAMLException2.prototype.constructor = YAMLException2;
  YAMLException2.prototype.toString = function toString(compact) {
    return this.name + ': ' + formatError(this, compact);
  };
  module2.exports = YAMLException2;
});
var require_snippet = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var common = require_common2();
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    let head = '';
    let tail = '';
    const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = ' ... ';
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = ' ...';
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, '\u2192') + tail,
      pos: position - lineStart + head.length,
    };
  }
  function padStart(string, max) {
    return common.repeat(' ', max - string.length) + string;
  }
  function makeSnippet(mark, options2) {
    options2 = Object.create(options2 || null);
    if (!mark.buffer) return null;
    if (!options2.maxLength) options2.maxLength = 79;
    if (typeof options2.indent !== 'number') options2.indent = 1;
    if (typeof options2.linesBefore !== 'number') options2.linesBefore = 3;
    if (typeof options2.linesAfter !== 'number') options2.linesAfter = 2;
    const re = /\r?\n|\r|\0/g;
    const lineStarts = [0];
    const lineEnds = [];
    let match;
    let foundLineNo = -1;
    while ((match = re.exec(mark.buffer))) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark.position <= match.index && foundLineNo < 0) foundLineNo = lineStarts.length - 2;
    }
    if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
    let result = '';
    const lineNoLength = Math.min(mark.line + options2.linesAfter, lineEnds.length).toString()
      .length;
    const maxLineLength = options2.maxLength - (options2.indent + lineNoLength + 3);
    for (let i = 1; i <= options2.linesBefore; i++) {
      if (foundLineNo - i < 0) break;
      const line2 = getLine(
        mark.buffer,
        lineStarts[foundLineNo - i],
        lineEnds[foundLineNo - i],
        mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
        maxLineLength
      );
      result =
        common.repeat(' ', options2.indent) +
        padStart((mark.line - i + 1).toString(), lineNoLength) +
        ' | ' +
        line2.str +
        '\n' +
        result;
    }
    const line = getLine(
      mark.buffer,
      lineStarts[foundLineNo],
      lineEnds[foundLineNo],
      mark.position,
      maxLineLength
    );
    result +=
      common.repeat(' ', options2.indent) +
      padStart((mark.line + 1).toString(), lineNoLength) +
      ' | ' +
      line.str +
      '\n';
    result += common.repeat('-', options2.indent + lineNoLength + 3 + line.pos) + '^\n';
    for (let i = 1; i <= options2.linesAfter; i++) {
      if (foundLineNo + i >= lineEnds.length) break;
      const line2 = getLine(
        mark.buffer,
        lineStarts[foundLineNo + i],
        lineEnds[foundLineNo + i],
        mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
        maxLineLength
      );
      result +=
        common.repeat(' ', options2.indent) +
        padStart((mark.line + i + 1).toString(), lineNoLength) +
        ' | ' +
        line2.str +
        '\n';
    }
    return result.replace(/\n$/, '');
  }
  module2.exports = makeSnippet;
});
var require_type2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var YAMLException2 = require_exception2();
  var TYPE_CONSTRUCTOR_OPTIONS = [
    'kind',
    'multi',
    'resolve',
    'construct',
    'instanceOf',
    'predicate',
    'represent',
    'representName',
    'defaultStyle',
    'styleAliases',
  ];
  var YAML_NODE_KINDS = ['scalar', 'sequence', 'mapping'];
  function compileStyleAliases(map) {
    const result = {};
    if (map !== null)
      Object.keys(map).forEach(function (style) {
        map[style].forEach(function (alias) {
          result[String(alias)] = style;
        });
      });
    return result;
  }
  function Type2(tag, options2) {
    options2 = options2 || {};
    Object.keys(options2).forEach(function (name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1)
        throw new YAMLException2(
          'Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.'
        );
    });
    this.options = options2;
    this.tag = tag;
    this.kind = options2['kind'] || null;
    this.resolve =
      options2['resolve'] ||
      function () {
        return true;
      };
    this.construct =
      options2['construct'] ||
      function (data) {
        return data;
      };
    this.instanceOf = options2['instanceOf'] || null;
    this.predicate = options2['predicate'] || null;
    this.represent = options2['represent'] || null;
    this.representName = options2['representName'] || null;
    this.defaultStyle = options2['defaultStyle'] || null;
    this.multi = options2['multi'] || false;
    this.styleAliases = compileStyleAliases(options2['styleAliases'] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1)
      throw new YAMLException2(
        'Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.'
      );
  }
  module2.exports = Type2;
});
var require_schema2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var YAMLException2 = require_exception2();
  var Type2 = require_type2();
  function compileList(schema, name) {
    const result = [];
    schema[name].forEach(function (currentType) {
      let newIndex = result.length;
      result.forEach(function (previousType, previousIndex) {
        if (
          previousType.tag === currentType.tag &&
          previousType.kind === currentType.kind &&
          previousType.multi === currentType.multi
        )
          newIndex = previousIndex;
      });
      result[newIndex] = currentType;
    });
    return result;
  }
  function compileMap() {
    const result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: [],
      },
    };
    function collectType(type) {
      if (type.multi) {
        result.multi[type.kind].push(type);
        result.multi['fallback'].push(type);
      } else result[type.kind][type.tag] = result['fallback'][type.tag] = type;
    }
    for (let index = 0, length = arguments.length; index < length; index += 1)
      arguments[index].forEach(collectType);
    return result;
  }
  function Schema2(definition) {
    return this.extend(definition);
  }
  Schema2.prototype.extend = function extend(definition) {
    let implicit = [];
    let explicit = [];
    if (definition instanceof Type2) explicit.push(definition);
    else if (Array.isArray(definition)) explicit = explicit.concat(definition);
    else if (
      definition &&
      (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))
    ) {
      if (definition.implicit) implicit = implicit.concat(definition.implicit);
      if (definition.explicit) explicit = explicit.concat(definition.explicit);
    } else
      throw new YAMLException2(
        'Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })'
      );
    implicit.forEach(function (type) {
      if (!(type instanceof Type2))
        throw new YAMLException2(
          'Specified list of YAML types (or a single Type object) contains a non-Type object.'
        );
      if (type.loadKind && type.loadKind !== 'scalar')
        throw new YAMLException2(
          'There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.'
        );
      if (type.multi)
        throw new YAMLException2(
          'There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.'
        );
    });
    explicit.forEach(function (type) {
      if (!(type instanceof Type2))
        throw new YAMLException2(
          'Specified list of YAML types (or a single Type object) contains a non-Type object.'
        );
    });
    const result = Object.create(Schema2.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, 'implicit');
    result.compiledExplicit = compileList(result, 'explicit');
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  module2.exports = Schema2;
});
var require_str2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  module2.exports = new (require_type2())('tag:yaml.org,2002:str', {
    kind: 'scalar',
    construct: function (data) {
      return data !== null ? data : '';
    },
  });
});
var require_seq2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  module2.exports = new (require_type2())('tag:yaml.org,2002:seq', {
    kind: 'sequence',
    construct: function (data) {
      return data !== null ? data : [];
    },
  });
});
var require_map2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  module2.exports = new (require_type2())('tag:yaml.org,2002:map', {
    kind: 'mapping',
    construct: function (data) {
      return data !== null ? data : {};
    },
  });
});
var require_failsafe2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  module2.exports = new (require_schema2())({
    explicit: [require_str2(), require_seq2(), require_map2()],
  });
});
var require_null2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var Type2 = require_type2();
  function resolveYamlNull(data) {
    if (data === null) return true;
    const max = data.length;
    return (
      (max === 1 && data === '~') ||
      (max === 4 && (data === 'null' || data === 'Null' || data === 'NULL'))
    );
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  module2.exports = new Type2('tag:yaml.org,2002:null', {
    kind: 'scalar',
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function () {
        return '~';
      },
      lowercase: function () {
        return 'null';
      },
      uppercase: function () {
        return 'NULL';
      },
      camelcase: function () {
        return 'Null';
      },
      empty: function () {
        return '';
      },
    },
    defaultStyle: 'lowercase',
  });
});
var require_bool2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var Type2 = require_type2();
  function resolveYamlBoolean(data) {
    if (data === null) return false;
    const max = data.length;
    return (
      (max === 4 && (data === 'true' || data === 'True' || data === 'TRUE')) ||
      (max === 5 && (data === 'false' || data === 'False' || data === 'FALSE'))
    );
  }
  function constructYamlBoolean(data) {
    return data === 'true' || data === 'True' || data === 'TRUE';
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === '[object Boolean]';
  }
  module2.exports = new Type2('tag:yaml.org,2002:bool', {
    kind: 'scalar',
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function (object) {
        return object ? 'true' : 'false';
      },
      uppercase: function (object) {
        return object ? 'TRUE' : 'FALSE';
      },
      camelcase: function (object) {
        return object ? 'True' : 'False';
      },
    },
    defaultStyle: 'lowercase',
  });
});
var require_int2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var common = require_common2();
  var Type2 = require_type2();
  function isHexCode(c) {
    return (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
  }
  function isOctCode(c) {
    return c >= 48 && c <= 55;
  }
  function isDecCode(c) {
    return c >= 48 && c <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null) return false;
    const max = data.length;
    let index = 0;
    let hasDigits = false;
    if (!max) return false;
    let ch = data[index];
    if (ch === '-' || ch === '+') ch = data[++index];
    if (ch === '0') {
      if (index + 1 === max) return true;
      ch = data[++index];
      if (ch === 'b') {
        index++;
        for (; index < max; index++) {
          ch = data[index];
          if (ch !== '0' && ch !== '1') return false;
          hasDigits = true;
        }
        return hasDigits && Number.isFinite(parseYamlInteger(data));
      }
      if (ch === 'x') {
        index++;
        for (; index < max; index++) {
          if (!isHexCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && Number.isFinite(parseYamlInteger(data));
      }
      if (ch === 'o') {
        index++;
        for (; index < max; index++) {
          if (!isOctCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && Number.isFinite(parseYamlInteger(data));
      }
    }
    for (; index < max; index++) {
      if (!isDecCode(data.charCodeAt(index))) return false;
      hasDigits = true;
    }
    if (!hasDigits) return false;
    return Number.isFinite(parseYamlInteger(data));
  }
  function parseYamlInteger(data) {
    let value = data;
    let sign = 1;
    let ch = value[0];
    if (ch === '-' || ch === '+') {
      if (ch === '-') sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === '0') return 0;
    if (ch === '0') {
      if (value[1] === 'b') return sign * parseInt(value.slice(2), 2);
      if (value[1] === 'x') return sign * parseInt(value.slice(2), 16);
      if (value[1] === 'o') return sign * parseInt(value.slice(2), 8);
    }
    return sign * parseInt(value, 10);
  }
  function constructYamlInteger(data) {
    return parseYamlInteger(data);
  }
  function isInteger(object) {
    return (
      Object.prototype.toString.call(object) === '[object Number]' &&
      object % 1 === 0 &&
      !common.isNegativeZero(object)
    );
  }
  module2.exports = new Type2('tag:yaml.org,2002:int', {
    kind: 'scalar',
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function (obj) {
        return obj >= 0 ? '0b' + obj.toString(2) : '-0b' + obj.toString(2).slice(1);
      },
      octal: function (obj) {
        return obj >= 0 ? '0o' + obj.toString(8) : '-0o' + obj.toString(8).slice(1);
      },
      decimal: function (obj) {
        return obj.toString(10);
      },
      hexadecimal: function (obj) {
        return obj >= 0
          ? '0x' + obj.toString(16).toUpperCase()
          : '-0x' + obj.toString(16).toUpperCase().slice(1);
      },
    },
    defaultStyle: 'decimal',
    styleAliases: {
      binary: [2, 'bin'],
      octal: [8, 'oct'],
      decimal: [10, 'dec'],
      hexadecimal: [16, 'hex'],
    },
  });
});
var require_float2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var common = require_common2();
  var Type2 = require_type2();
  var YAML_FLOAT_PATTERN = /* @__PURE__ */ new RegExp(
    '^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$'
  );
  var YAML_FLOAT_SPECIAL_PATTERN = /* @__PURE__ */ new RegExp(
    '^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$'
  );
  function resolveYamlFloat(data) {
    if (data === null) return false;
    if (!YAML_FLOAT_PATTERN.test(data)) return false;
    if (Number.isFinite(parseFloat(data, 10))) return true;
    return YAML_FLOAT_SPECIAL_PATTERN.test(data);
  }
  function constructYamlFloat(data) {
    let value = data.toLowerCase();
    const sign = value[0] === '-' ? -1 : 1;
    if ('+-'.indexOf(value[0]) >= 0) value = value.slice(1);
    if (value === '.inf') return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    else if (value === '.nan') return NaN;
    return sign * parseFloat(value, 10);
  }
  var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    if (isNaN(object))
      switch (style) {
        case 'lowercase':
          return '.nan';
        case 'uppercase':
          return '.NAN';
        case 'camelcase':
          return '.NaN';
      }
    else if (Number.POSITIVE_INFINITY === object)
      switch (style) {
        case 'lowercase':
          return '.inf';
        case 'uppercase':
          return '.INF';
        case 'camelcase':
          return '.Inf';
      }
    else if (Number.NEGATIVE_INFINITY === object)
      switch (style) {
        case 'lowercase':
          return '-.inf';
        case 'uppercase':
          return '-.INF';
        case 'camelcase':
          return '-.Inf';
      }
    else if (common.isNegativeZero(object)) return '-0.0';
    const res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace('e', '.e') : res;
  }
  function isFloat(object) {
    return (
      Object.prototype.toString.call(object) === '[object Number]' &&
      (object % 1 !== 0 || common.isNegativeZero(object))
    );
  }
  module2.exports = new Type2('tag:yaml.org,2002:float', {
    kind: 'scalar',
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: 'lowercase',
  });
});
var require_json2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  module2.exports = require_failsafe2().extend({
    implicit: [require_null2(), require_bool2(), require_int2(), require_float2()],
  });
});
var require_core2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  module2.exports = require_json2();
});
var require_timestamp2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var Type2 = require_type2();
  var YAML_DATE_REGEXP = /* @__PURE__ */ new RegExp(
    '^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$'
  );
  var YAML_TIMESTAMP_REGEXP = /* @__PURE__ */ new RegExp(
    '^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$'
  );
  function resolveYamlTimestamp(data) {
    if (data === null) return false;
    if (YAML_DATE_REGEXP.exec(data) !== null) return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    let fraction = 0;
    let delta = null;
    let match = YAML_DATE_REGEXP.exec(data);
    if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null) throw new Error('Date resolve error');
    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    if (!match[4]) return new Date(Date.UTC(year, month, day));
    const hour = +match[4];
    const minute = +match[5];
    const second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) fraction += '0';
      fraction = +fraction;
    }
    if (match[9]) {
      const tzHour = +match[10];
      const tzMinute = +(match[11] || 0);
      delta = (tzHour * 60 + tzMinute) * 6e4;
      if (match[9] === '-') delta = -delta;
    }
    const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta) date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  module2.exports = new Type2('tag:yaml.org,2002:timestamp', {
    kind: 'scalar',
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp,
  });
});
var require_merge2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var Type2 = require_type2();
  function resolveYamlMerge(data) {
    return data === '<<' || data === null;
  }
  module2.exports = new Type2('tag:yaml.org,2002:merge', {
    kind: 'scalar',
    resolve: resolveYamlMerge,
  });
});
var require_binary2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var Type2 = require_type2();
  var BASE64_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r';
  function resolveYamlBinary(data) {
    if (data === null) return false;
    let bitlen = 0;
    const max = data.length;
    const map = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      const code = map.indexOf(data.charAt(idx));
      if (code > 64) continue;
      if (code < 0) return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    const input = data.replace(/[\r\n=]/g, '');
    const max = input.length;
    const map = BASE64_MAP;
    let bits = 0;
    const result = [];
    for (let idx = 0; idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push((bits >> 16) & 255);
        result.push((bits >> 8) & 255);
        result.push(bits & 255);
      }
      bits = (bits << 6) | map.indexOf(input.charAt(idx));
    }
    const tailbits = (max % 4) * 6;
    if (tailbits === 0) {
      result.push((bits >> 16) & 255);
      result.push((bits >> 8) & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push((bits >> 10) & 255);
      result.push((bits >> 2) & 255);
    } else if (tailbits === 12) result.push((bits >> 4) & 255);
    return new Uint8Array(result);
  }
  function representYamlBinary(object) {
    let result = '';
    let bits = 0;
    const max = object.length;
    const map = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map[(bits >> 18) & 63];
        result += map[(bits >> 12) & 63];
        result += map[(bits >> 6) & 63];
        result += map[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    const tail = max % 3;
    if (tail === 0) {
      result += map[(bits >> 18) & 63];
      result += map[(bits >> 12) & 63];
      result += map[(bits >> 6) & 63];
      result += map[bits & 63];
    } else if (tail === 2) {
      result += map[(bits >> 10) & 63];
      result += map[(bits >> 4) & 63];
      result += map[(bits << 2) & 63];
      result += map[64];
    } else if (tail === 1) {
      result += map[(bits >> 2) & 63];
      result += map[(bits << 4) & 63];
      result += map[64];
      result += map[64];
    }
    return result;
  }
  function isBinary(obj) {
    return Object.prototype.toString.call(obj) === '[object Uint8Array]';
  }
  module2.exports = new Type2('tag:yaml.org,2002:binary', {
    kind: 'scalar',
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary,
  });
});
var require_omap2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var Type2 = require_type2();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null) return true;
    const objectKeys = [];
    const object = data;
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      let pairHasKey = false;
      if (_toString.call(pair) !== '[object Object]') return false;
      let pairKey;
      for (pairKey in pair)
        if (_hasOwnProperty.call(pair, pairKey))
          if (!pairHasKey) pairHasKey = true;
          else return false;
      if (!pairHasKey) return false;
      if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
      else return false;
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  module2.exports = new Type2('tag:yaml.org,2002:omap', {
    kind: 'sequence',
    resolve: resolveYamlOmap,
    construct: constructYamlOmap,
  });
});
var require_pairs2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var Type2 = require_type2();
  var _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null) return true;
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      if (_toString.call(pair) !== '[object Object]') return false;
      const keys = Object.keys(pair);
      if (keys.length !== 1) return false;
      result[index] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null) return [];
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      const keys = Object.keys(pair);
      result[index] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  module2.exports = new Type2('tag:yaml.org,2002:pairs', {
    kind: 'sequence',
    resolve: resolveYamlPairs,
    construct: constructYamlPairs,
  });
});
var require_set2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var Type2 = require_type2();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null) return true;
    const object = data;
    for (const key in object)
      if (_hasOwnProperty.call(object, key)) {
        if (object[key] !== null) return false;
      }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  module2.exports = new Type2('tag:yaml.org,2002:set', {
    kind: 'mapping',
    resolve: resolveYamlSet,
    construct: constructYamlSet,
  });
});
var require_default = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  module2.exports = require_core2().extend({
    implicit: [require_timestamp2(), require_merge2()],
    explicit: [require_binary2(), require_omap2(), require_pairs2(), require_set2()],
  });
});
var require_loader2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var common = require_common2();
  var YAMLException2 = require_exception2();
  var makeSnippet = require_snippet();
  var DEFAULT_SCHEMA2 = require_default();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CONTEXT_FLOW_IN = 1;
  var CONTEXT_FLOW_OUT = 2;
  var CONTEXT_BLOCK_IN = 3;
  var CONTEXT_BLOCK_OUT = 4;
  var CHOMPING_CLIP = 1;
  var CHOMPING_STRIP = 2;
  var CHOMPING_KEEP = 3;
  var PATTERN_NON_PRINTABLE =
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  var PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
  var PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
  var PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function isEol(c) {
    return c === 10 || c === 13;
  }
  function isWhiteSpace(c) {
    return c === 9 || c === 32;
  }
  function isWsOrEol(c) {
    return c === 9 || c === 32 || c === 10 || c === 13;
  }
  function isFlowIndicator(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromHexCode(c) {
    if (c >= 48 && c <= 57) return c - 48;
    const lc = c | 32;
    if (lc >= 97 && lc <= 102) return lc - 97 + 10;
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) return 2;
    if (c === 117) return 4;
    if (c === 85) return 8;
    return 0;
  }
  function fromDecimalCode(c) {
    if (c >= 48 && c <= 57) return c - 48;
    return -1;
  }
  function simpleEscapeSequence(c) {
    switch (c) {
      case 48:
        return '\0';
      case 97:
        return '\x07';
      case 98:
        return '\b';
      case 116:
        return '	';
      case 9:
        return '	';
      case 110:
        return '\n';
      case 118:
        return '\v';
      case 102:
        return '\f';
      case 114:
        return '\r';
      case 101:
        return '\x1B';
      case 32:
        return ' ';
      case 34:
        return '"';
      case 47:
        return '/';
      case 92:
        return '\\';
      case 78:
        return '\x85';
      case 95:
        return '\xA0';
      case 76:
        return '\u2028';
      case 80:
        return '\u2029';
      default:
        return '';
    }
  }
  function charFromCodepoint(c) {
    if (c <= 65535) return String.fromCharCode(c);
    return String.fromCharCode(((c - 65536) >> 10) + 55296, ((c - 65536) & 1023) + 56320);
  }
  function setProperty(object, key, value) {
    if (key === '__proto__')
      Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
      });
    else object[key] = value;
  }
  var simpleEscapeCheck = new Array(256);
  var simpleEscapeMap = new Array(256);
  for (let i = 0; i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  function State(input, options2) {
    this.input = input;
    this.filename = options2['filename'] || null;
    this.schema = options2['schema'] || DEFAULT_SCHEMA2;
    this.onWarning = options2['onWarning'] || null;
    this.legacy = options2['legacy'] || false;
    this.json = options2['json'] || false;
    this.listener = options2['listener'] || null;
    this.maxDepth = typeof options2['maxDepth'] === 'number' ? options2['maxDepth'] : 100;
    this.maxMergeSeqLength =
      typeof options2['maxMergeSeqLength'] === 'number' ? options2['maxMergeSeqLength'] : 20;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.depth = 0;
    this.firstTabInLine = -1;
    this.documents = [];
    this.anchorMapTransactions = [];
  }
  function generateError(state, message) {
    const mark = {
      name: state.filename,
      buffer: state.input.slice(0, -1),
      position: state.position,
      line: state.line,
      column: state.position - state.lineStart,
    };
    mark.snippet = makeSnippet(mark);
    return new YAMLException2(message, mark);
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) state.onWarning.call(null, generateError(state, message));
  }
  function storeAnchor(state, name, value) {
    const transactions = state.anchorMapTransactions;
    if (transactions.length !== 0) {
      const transaction = transactions[transactions.length - 1];
      if (!_hasOwnProperty.call(transaction, name))
        transaction[name] = {
          existed: _hasOwnProperty.call(state.anchorMap, name),
          value: state.anchorMap[name],
        };
    }
    state.anchorMap[name] = value;
  }
  function beginAnchorTransaction(state) {
    state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
  }
  function commitAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const transactions = state.anchorMapTransactions;
    if (transactions.length === 0) return;
    const parent = transactions[transactions.length - 1];
    const names = Object.keys(transaction);
    for (let index = 0, length = names.length; index < length; index += 1) {
      const name = names[index];
      if (!_hasOwnProperty.call(parent, name)) parent[name] = transaction[name];
    }
  }
  function rollbackAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const names = Object.keys(transaction);
    for (let index = names.length - 1; index >= 0; index -= 1) {
      const entry = transaction[names[index]];
      if (entry.existed) state.anchorMap[names[index]] = entry.value;
      else delete state.anchorMap[names[index]];
    }
  }
  function snapshotState(state) {
    return {
      position: state.position,
      line: state.line,
      lineStart: state.lineStart,
      lineIndent: state.lineIndent,
      firstTabInLine: state.firstTabInLine,
      tag: state.tag,
      anchor: state.anchor,
      kind: state.kind,
      result: state.result,
    };
  }
  function restoreState(state, snapshot) {
    state.position = snapshot.position;
    state.line = snapshot.line;
    state.lineStart = snapshot.lineStart;
    state.lineIndent = snapshot.lineIndent;
    state.firstTabInLine = snapshot.firstTabInLine;
    state.tag = snapshot.tag;
    state.anchor = snapshot.anchor;
    state.kind = snapshot.kind;
    state.result = snapshot.result;
  }
  var directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      if (state.version !== null) throwError(state, 'duplication of %YAML directive');
      if (args.length !== 1) throwError(state, 'YAML directive accepts exactly one argument');
      const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) throwError(state, 'ill-formed argument of the YAML directive');
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major !== 1) throwError(state, 'unacceptable YAML version of the document');
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2)
        throwWarning(state, 'unsupported YAML version of the document');
    },
    TAG: function handleTagDirective(state, name, args) {
      let prefix;
      if (args.length !== 2) throwError(state, 'TAG directive accepts exactly two arguments');
      const handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle))
        throwError(state, 'ill-formed tag handle (first argument) of the TAG directive');
      if (_hasOwnProperty.call(state.tagMap, handle))
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      if (!PATTERN_TAG_URI.test(prefix))
        throwError(state, 'ill-formed tag prefix (second argument) of the TAG directive');
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, 'tag prefix is malformed: ' + prefix);
      }
      state.tagMap[handle] = prefix;
    },
  };
  function captureSegment(state, start, end, checkJson) {
    if (start < end) {
      const _result = state.input.slice(start, end);
      if (checkJson)
        for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
          const _character = _result.charCodeAt(_position);
          if (!(_character === 9 || (_character >= 32 && _character <= 1114111)))
            throwError(state, 'expected valid JSON character');
        }
      else if (PATTERN_NON_PRINTABLE.test(_result))
        throwError(state, 'the stream contains non-printable characters');
      state.result += _result;
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    if (!common.isObject(source))
      throwError(state, 'cannot merge mappings; the provided source object is unacceptable');
    const sourceKeys = Object.keys(source);
    for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
      const key = sourceKeys[index];
      if (!_hasOwnProperty.call(destination, key)) {
        setProperty(destination, key, source[key]);
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(
    state,
    _result,
    overridableKeys,
    keyTag,
    keyNode,
    valueNode,
    startLine,
    startLineStart,
    startPos
  ) {
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
        if (Array.isArray(keyNode[index]))
          throwError(state, 'nested arrays are not supported inside keys');
        if (typeof keyNode === 'object' && _class(keyNode[index]) === '[object Object]')
          keyNode[index] = '[object Object]';
      }
    }
    if (typeof keyNode === 'object' && _class(keyNode) === '[object Object]')
      keyNode = '[object Object]';
    keyNode = String(keyNode);
    if (_result === null) _result = {};
    if (keyTag === 'tag:yaml.org,2002:merge')
      if (Array.isArray(valueNode)) {
        if (valueNode.length > state.maxMergeSeqLength)
          throwError(
            state,
            'merge sequence length exceeded maxMergeSeqLength (' + state.maxMergeSeqLength + ')'
          );
        const seen = /* @__PURE__ */ new Set();
        for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) {
          const src = valueNode[index];
          if (seen.has(src)) continue;
          seen.add(src);
          mergeMappings(state, _result, src, overridableKeys);
        }
      } else mergeMappings(state, _result, valueNode, overridableKeys);
    else {
      if (
        !state.json &&
        !_hasOwnProperty.call(overridableKeys, keyNode) &&
        _hasOwnProperty.call(_result, keyNode)
      ) {
        state.line = startLine || state.line;
        state.lineStart = startLineStart || state.lineStart;
        state.position = startPos || state.position;
        throwError(state, 'duplicated mapping key');
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 10) state.position++;
    else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) state.position++;
    } else throwError(state, 'a line break is expected');
    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    let lineBreaks = 0;
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (isWhiteSpace(ch)) {
        if (ch === 9 && state.firstTabInLine === -1) state.firstTabInLine = state.position;
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35)
        do ch = state.input.charCodeAt(++state.position);
        while (ch !== 10 && ch !== 13 && ch !== 0);
      if (isEol(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else break;
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent)
      throwWarning(state, 'deficient indentation');
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    let _position = state.position;
    let ch = state.input.charCodeAt(_position);
    if (
      (ch === 45 || ch === 46) &&
      ch === state.input.charCodeAt(_position + 1) &&
      ch === state.input.charCodeAt(_position + 2)
    ) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || isWsOrEol(ch)) return true;
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) state.result += ' ';
    else if (count > 1) state.result += common.repeat('\n', count - 1);
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    let captureStart;
    let captureEnd;
    let hasPendingContent;
    let _line;
    let _lineStart;
    let _lineIndent;
    const _kind = state.kind;
    const _result = state.result;
    let ch = state.input.charCodeAt(state.position);
    if (
      isWsOrEol(ch) ||
      isFlowIndicator(ch) ||
      ch === 35 ||
      ch === 38 ||
      ch === 42 ||
      ch === 33 ||
      ch === 124 ||
      ch === 62 ||
      ch === 39 ||
      ch === 34 ||
      ch === 37 ||
      ch === 64 ||
      ch === 96
    )
      return false;
    if (ch === 63 || ch === 45) {
      const following = state.input.charCodeAt(state.position + 1);
      if (isWsOrEol(following) || (withinFlowCollection && isFlowIndicator(following)))
        return false;
    }
    state.kind = 'scalar';
    state.result = '';
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following) || (withinFlowCollection && isFlowIndicator(following))) break;
      } else if (ch === 35) {
        if (isWsOrEol(state.input.charCodeAt(state.position - 1))) break;
      } else if (
        (state.position === state.lineStart && testDocumentSeparator(state)) ||
        (withinFlowCollection && isFlowIndicator(ch))
      )
        break;
      else if (isEol(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!isWhiteSpace(ch)) captureEnd = state.position + 1;
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) return true;
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 39) return false;
    state.kind = 'scalar';
    state.result = '';
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0)
      if (ch === 39) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (ch === 39) {
          captureStart = state.position;
          state.position++;
          captureEnd = state.position;
        } else return true;
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state))
        throwError(state, 'unexpected end of the document within a single quoted scalar');
      else {
        state.position++;
        if (!isWhiteSpace(ch)) captureEnd = state.position;
      }
    throwError(state, 'unexpected end of the stream within a single quoted scalar');
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 34) return false;
    state.kind = 'scalar';
    state.result = '';
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0)
      if (ch === 34) {
        captureSegment(state, captureStart, state.position, true);
        state.position++;
        return true;
      } else if (ch === 92) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (isEol(ch)) skipSeparationSpace(state, false, nodeIndent);
        else if (ch < 256 && simpleEscapeCheck[ch]) {
          state.result += simpleEscapeMap[ch];
          state.position++;
        } else if ((tmp = escapedHexLen(ch)) > 0) {
          let hexLength = tmp;
          let hexResult = 0;
          for (; hexLength > 0; hexLength--) {
            ch = state.input.charCodeAt(++state.position);
            if ((tmp = fromHexCode(ch)) >= 0) hexResult = (hexResult << 4) + tmp;
            else throwError(state, 'expected hexadecimal character');
          }
          state.result += charFromCodepoint(hexResult);
          state.position++;
        } else throwError(state, 'unknown escape sequence');
        captureStart = captureEnd = state.position;
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state))
        throwError(state, 'unexpected end of the document within a double quoted scalar');
      else {
        state.position++;
        if (!isWhiteSpace(ch)) captureEnd = state.position;
      }
    throwError(state, 'unexpected end of the stream within a double quoted scalar');
  }
  function readFlowCollection(state, nodeIndent) {
    let readNext = true;
    let _line;
    let _lineStart;
    let _pos;
    const _tag = state.tag;
    let _result;
    const _anchor = state.anchor;
    let terminator;
    let isPair;
    let isExplicitPair;
    let isMapping;
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyNode;
    let keyTag;
    let valueNode;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else return false;
    if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? 'mapping' : 'sequence';
        state.result = _result;
        return true;
      } else if (!readNext) throwError(state, 'missed comma between flow collection entries');
      else if (ch === 44) throwError(state, "expected the node content, but found ','");
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        if (isWsOrEol(state.input.charCodeAt(state.position + 1))) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      _lineStart = state.lineStart;
      _pos = state.position;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping)
        storeMappingPair(
          state,
          _result,
          overridableKeys,
          keyTag,
          keyNode,
          valueNode,
          _line,
          _lineStart,
          _pos
        );
      else if (isPair)
        _result.push(
          storeMappingPair(
            state,
            null,
            overridableKeys,
            keyTag,
            keyNode,
            valueNode,
            _line,
            _lineStart,
            _pos
          )
        );
      else _result.push(keyNode);
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else readNext = false;
    }
    throwError(state, 'unexpected end of the stream within a flow collection');
  }
  function readBlockScalar(state, nodeIndent) {
    let folding;
    let chomping = CHOMPING_CLIP;
    let didReadContent = false;
    let detectedIndent = false;
    let textIndent = nodeIndent;
    let emptyLines = 0;
    let atMoreIndented = false;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 124) folding = false;
    else if (ch === 62) folding = true;
    else return false;
    state.kind = 'scalar';
    state.result = '';
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45)
        if (CHOMPING_CLIP === chomping) chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
        else throwError(state, 'repeat of a chomping mode identifier');
      else if ((tmp = fromDecimalCode(ch)) >= 0)
        if (tmp === 0)
          throwError(
            state,
            'bad explicit indentation width of a block scalar; it cannot be less than one'
          );
        else if (!detectedIndent) {
          textIndent = nodeIndent + tmp - 1;
          detectedIndent = true;
        } else throwError(state, 'repeat of an indentation width identifier');
      else break;
    }
    if (isWhiteSpace(ch)) {
      do ch = state.input.charCodeAt(++state.position);
      while (isWhiteSpace(ch));
      if (ch === 35)
        do ch = state.input.charCodeAt(++state.position);
        while (!isEol(ch) && ch !== 0);
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) textIndent = state.lineIndent;
      if (isEol(ch)) {
        emptyLines++;
        continue;
      }
      if (!detectedIndent && textIndent === 0)
        throwError(state, 'missing indentation for block scalar');
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP)
          state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
        else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) state.result += '\n';
        }
        break;
      }
      if (folding)
        if (isWhiteSpace(ch)) {
          atMoreIndented = true;
          state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
        } else if (atMoreIndented) {
          atMoreIndented = false;
          state.result += common.repeat('\n', emptyLines + 1);
        } else if (emptyLines === 0) {
          if (didReadContent) state.result += ' ';
        } else state.result += common.repeat('\n', emptyLines);
      else state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      const captureStart = state.position;
      while (!isEol(ch) && ch !== 0) ch = state.input.charCodeAt(++state.position);
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = [];
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, 'tab characters must not be used in indentation');
      }
      if (ch !== 45) break;
      if (!isWsOrEol(state.input.charCodeAt(state.position + 1))) break;
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      const _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0)
        throwError(state, 'bad indentation of a sequence entry');
      else if (state.lineIndent < nodeIndent) break;
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = 'sequence';
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    let allowCompact;
    let _keyLine;
    let _keyLineStart;
    let _keyPos;
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = {};
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyTag = null;
    let keyNode = null;
    let valueNode = null;
    let atExplicitKey = false;
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, 'tab characters must not be used in indentation');
      }
      const following = state.input.charCodeAt(state.position + 1);
      const _line = state.line;
      if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(
              state,
              _result,
              overridableKeys,
              keyTag,
              keyNode,
              null,
              _keyLine,
              _keyLineStart,
              _keyPos
            );
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else
          throwError(
            state,
            'incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line'
          );
        state.position += 1;
        ch = following;
      } else {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
        if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) break;
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!isWsOrEol(ch))
              throwError(
                state,
                'a whitespace character is expected after the key-value separator within a block mapping'
              );
            if (atExplicitKey) {
              storeMappingPair(
                state,
                _result,
                overridableKeys,
                keyTag,
                keyNode,
                null,
                _keyLine,
                _keyLineStart,
                _keyPos
              );
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected)
            throwError(state, 'can not read an implicit mapping pair; a colon is missed');
          else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected)
          throwError(
            state,
            'can not read a block mapping entry; a multiline key may not be an implicit key'
          );
        else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (atExplicitKey) {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
        }
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact))
          if (atExplicitKey) keyNode = state.result;
          else valueNode = state.result;
        if (!atExplicitKey) {
          storeMappingPair(
            state,
            _result,
            overridableKeys,
            keyTag,
            keyNode,
            valueNode,
            _keyLine,
            _keyLineStart,
            _keyPos
          );
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0)
        throwError(state, 'bad indentation of a mapping entry');
      else if (state.lineIndent < nodeIndent) break;
    }
    if (atExplicitKey)
      storeMappingPair(
        state,
        _result,
        overridableKeys,
        keyTag,
        keyNode,
        null,
        _keyLine,
        _keyLineStart,
        _keyPos
      );
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = 'mapping';
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    let isVerbatim = false;
    let isNamed = false;
    let tagHandle;
    let tagName;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 33) return false;
    if (state.tag !== null) throwError(state, 'duplication of a tag property');
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = '!!';
      ch = state.input.charCodeAt(++state.position);
    } else tagHandle = '!';
    let _position = state.position;
    if (isVerbatim) {
      do ch = state.input.charCodeAt(++state.position);
      while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else throwError(state, 'unexpected end of the stream within a verbatim tag');
    } else {
      while (ch !== 0 && !isWsOrEol(ch)) {
        if (ch === 33)
          if (!isNamed) {
            tagHandle = state.input.slice(_position - 1, state.position + 1);
            if (!PATTERN_TAG_HANDLE.test(tagHandle))
              throwError(state, 'named tag handle cannot contain such characters');
            isNamed = true;
            _position = state.position + 1;
          } else throwError(state, 'tag suffix cannot contain exclamation marks');
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName))
        throwError(state, 'tag suffix cannot contain flow indicator characters');
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName))
      throwError(state, 'tag name cannot contain such characters: ' + tagName);
    try {
      tagName = decodeURIComponent(tagName);
    } catch (err) {
      throwError(state, 'tag name is malformed: ' + tagName);
    }
    if (isVerbatim) state.tag = tagName;
    else if (_hasOwnProperty.call(state.tagMap, tagHandle))
      state.tag = state.tagMap[tagHandle] + tagName;
    else if (tagHandle === '!') state.tag = '!' + tagName;
    else if (tagHandle === '!!') state.tag = 'tag:yaml.org,2002:' + tagName;
    else throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    return true;
  }
  function readAnchorProperty(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 38) return false;
    if (state.anchor !== null) throwError(state, 'duplication of an anchor property');
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch))
      ch = state.input.charCodeAt(++state.position);
    if (state.position === _position)
      throwError(state, 'name of an anchor node must contain at least one character');
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 42) return false;
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch))
      ch = state.input.charCodeAt(++state.position);
    if (state.position === _position)
      throwError(state, 'name of an alias node must contain at least one character');
    const alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias))
      throwError(state, 'unidentified alias "' + alias + '"');
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
    const fallbackState = snapshotState(state);
    beginAnchorTransaction(state);
    restoreState(state, propertyStart);
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === 'mapping') {
      commitAnchorTransaction(state);
      return true;
    }
    rollbackAnchorTransaction(state);
    restoreState(state, fallbackState);
    return false;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    let allowBlockScalars;
    let allowBlockCollections;
    let indentStatus = 1;
    let atNewLine = false;
    let hasContent = false;
    let propertyStart = null;
    let type;
    let flowIndent;
    let blockIndent;
    if (state.depth >= state.maxDepth)
      throwError(state, 'nesting exceeded maxDepth (' + state.maxDepth + ')');
    state.depth += 1;
    if (state.listener !== null) state.listener('open', state);
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    const allowBlockStyles =
      (allowBlockScalars =
      allowBlockCollections =
        CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext);
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) indentStatus = 1;
        else if (state.lineIndent === parentIndent) indentStatus = 0;
        else if (state.lineIndent < parentIndent) indentStatus = -1;
      }
    }
    if (indentStatus === 1)
      while (true) {
        const ch = state.input.charCodeAt(state.position);
        const propertyState = snapshotState(state);
        if (
          atNewLine &&
          ((ch === 33 && state.tag !== null) || (ch === 38 && state.anchor !== null))
        )
          break;
        if (!readTagProperty(state) && !readAnchorProperty(state)) break;
        if (propertyStart === null) propertyStart = propertyState;
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          allowBlockCollections = allowBlockStyles;
          if (state.lineIndent > parentIndent) indentStatus = 1;
          else if (state.lineIndent === parentIndent) indentStatus = 0;
          else if (state.lineIndent < parentIndent) indentStatus = -1;
        } else allowBlockCollections = false;
      }
    if (allowBlockCollections) allowBlockCollections = atNewLine || allowCompact;
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext)
        flowIndent = parentIndent;
      else flowIndent = parentIndent + 1;
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1)
        if (
          (allowBlockCollections &&
            (readBlockSequence(state, blockIndent) ||
              readBlockMapping(state, blockIndent, flowIndent))) ||
          readFlowCollection(state, flowIndent)
        )
          hasContent = true;
        else {
          const ch = state.input.charCodeAt(state.position);
          if (
            propertyStart !== null &&
            allowBlockStyles &&
            !allowBlockCollections &&
            ch !== 124 &&
            ch !== 62 &&
            tryReadBlockMappingFromProperty(
              state,
              propertyStart,
              propertyStart.position - propertyStart.lineStart,
              flowIndent
            )
          )
            hasContent = true;
          else if (
            (allowBlockScalars && readBlockScalar(state, flowIndent)) ||
            readSingleQuotedScalar(state, flowIndent) ||
            readDoubleQuotedScalar(state, flowIndent)
          )
            hasContent = true;
          else if (readAlias(state)) {
            hasContent = true;
            if (state.tag !== null || state.anchor !== null)
              throwError(state, 'alias node should not have any properties');
          } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
            hasContent = true;
            if (state.tag === null) state.tag = '?';
          }
          if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
        }
      else if (indentStatus === 0)
        hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
    if (state.tag === null) {
      if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
    } else if (state.tag === '?') {
      if (state.result !== null && state.kind !== 'scalar')
        throwError(
          state,
          'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"'
        );
      for (
        let typeIndex = 0, typeQuantity = state.implicitTypes.length;
        typeIndex < typeQuantity;
        typeIndex += 1
      ) {
        type = state.implicitTypes[typeIndex];
        if (type.resolve(state.result)) {
          state.result = type.construct(state.result);
          state.tag = type.tag;
          if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
          break;
        }
      }
    } else if (state.tag !== '!') {
      if (_hasOwnProperty.call(state.typeMap[state.kind || 'fallback'], state.tag))
        type = state.typeMap[state.kind || 'fallback'][state.tag];
      else {
        type = null;
        const typeList = state.typeMap.multi[state.kind || 'fallback'];
        for (
          let typeIndex = 0, typeQuantity = typeList.length;
          typeIndex < typeQuantity;
          typeIndex += 1
        )
          if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
            type = typeList[typeIndex];
            break;
          }
      }
      if (!type) throwError(state, 'unknown tag !<' + state.tag + '>');
      if (state.result !== null && type.kind !== state.kind)
        throwError(
          state,
          'unacceptable node kind for !<' +
            state.tag +
            '> tag; it should be "' +
            type.kind +
            '", not "' +
            state.kind +
            '"'
        );
      if (!type.resolve(state.result, state.tag))
        throwError(state, 'cannot resolve a node with !<' + state.tag + '> explicit tag');
      else {
        state.result = type.construct(state.result, state.tag);
        if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
      }
    }
    if (state.listener !== null) state.listener('close', state);
    state.depth -= 1;
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    const documentStart = state.position;
    let hasDirectives = false;
    let ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = /* @__PURE__ */ Object.create(null);
    state.anchorMap = /* @__PURE__ */ Object.create(null);
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) break;
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      let _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch)) ch = state.input.charCodeAt(++state.position);
      const directiveName = state.input.slice(_position, state.position);
      const directiveArgs = [];
      if (directiveName.length < 1)
        throwError(state, 'directive name must not be less than one character in length');
      while (ch !== 0) {
        while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
        if (ch === 35) {
          do ch = state.input.charCodeAt(++state.position);
          while (ch !== 0 && !isEol(ch));
          break;
        }
        if (isEol(ch)) break;
        _position = state.position;
        while (ch !== 0 && !isWsOrEol(ch)) ch = state.input.charCodeAt(++state.position);
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0) readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName))
        directiveHandlers[directiveName](state, directiveName, directiveArgs);
      else throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
    skipSeparationSpace(state, true, -1);
    if (
      state.lineIndent === 0 &&
      state.input.charCodeAt(state.position) === 45 &&
      state.input.charCodeAt(state.position + 1) === 45 &&
      state.input.charCodeAt(state.position + 2) === 45
    ) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) throwError(state, 'directives end mark is expected');
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (
      state.checkLineBreaks &&
      PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))
    )
      throwWarning(state, 'non-ASCII line breaks are interpreted as content');
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1)
      throwError(state, 'end of the stream or a document separator is expected');
  }
  function loadDocuments(input, options2) {
    input = String(input);
    options2 = options2 || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13)
        input += '\n';
      if (input.charCodeAt(0) === 65279) input = input.slice(1);
    }
    const state = new State(input, options2);
    const nullpos = input.indexOf('\0');
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, 'null byte is not allowed in input');
    }
    state.input += '\0';
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) readDocument(state);
    return state.documents;
  }
  function loadAll2(input, iterator, options2) {
    if (iterator !== null && typeof iterator === 'object' && typeof options2 === 'undefined') {
      options2 = iterator;
      iterator = null;
    }
    const documents = loadDocuments(input, options2);
    if (typeof iterator !== 'function') return documents;
    for (let index = 0, length = documents.length; index < length; index += 1)
      iterator(documents[index]);
  }
  function load2(input, options2) {
    const documents = loadDocuments(input, options2);
    if (documents.length === 0) return;
    else if (documents.length === 1) return documents[0];
    throw new YAMLException2('expected a single document in the stream, but found more');
  }
  module2.exports.loadAll = loadAll2;
  module2.exports.load = load2;
});
var require_dumper2 = /* @__PURE__ */ __commonJSMin((exports2, module2) => {
  var common = require_common2();
  var YAMLException2 = require_exception2();
  var DEFAULT_SCHEMA2 = require_default();
  var _toString = Object.prototype.toString;
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CHAR_BOM = 65279;
  var CHAR_TAB = 9;
  var CHAR_LINE_FEED = 10;
  var CHAR_CARRIAGE_RETURN = 13;
  var CHAR_SPACE = 32;
  var CHAR_EXCLAMATION = 33;
  var CHAR_DOUBLE_QUOTE = 34;
  var CHAR_SHARP = 35;
  var CHAR_PERCENT = 37;
  var CHAR_AMPERSAND = 38;
  var CHAR_SINGLE_QUOTE = 39;
  var CHAR_ASTERISK = 42;
  var CHAR_COMMA = 44;
  var CHAR_MINUS = 45;
  var CHAR_COLON = 58;
  var CHAR_EQUALS = 61;
  var CHAR_GREATER_THAN = 62;
  var CHAR_QUESTION = 63;
  var CHAR_COMMERCIAL_AT = 64;
  var CHAR_LEFT_SQUARE_BRACKET = 91;
  var CHAR_RIGHT_SQUARE_BRACKET = 93;
  var CHAR_GRAVE_ACCENT = 96;
  var CHAR_LEFT_CURLY_BRACKET = 123;
  var CHAR_VERTICAL_LINE = 124;
  var CHAR_RIGHT_CURLY_BRACKET = 125;
  var ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = '\\0';
  ESCAPE_SEQUENCES[7] = '\\a';
  ESCAPE_SEQUENCES[8] = '\\b';
  ESCAPE_SEQUENCES[9] = '\\t';
  ESCAPE_SEQUENCES[10] = '\\n';
  ESCAPE_SEQUENCES[11] = '\\v';
  ESCAPE_SEQUENCES[12] = '\\f';
  ESCAPE_SEQUENCES[13] = '\\r';
  ESCAPE_SEQUENCES[27] = '\\e';
  ESCAPE_SEQUENCES[34] = '\\"';
  ESCAPE_SEQUENCES[92] = '\\\\';
  ESCAPE_SEQUENCES[133] = '\\N';
  ESCAPE_SEQUENCES[160] = '\\_';
  ESCAPE_SEQUENCES[8232] = '\\L';
  ESCAPE_SEQUENCES[8233] = '\\P';
  var DEPRECATED_BOOLEANS_SYNTAX = [
    'y',
    'Y',
    'yes',
    'Yes',
    'YES',
    'on',
    'On',
    'ON',
    'n',
    'N',
    'no',
    'No',
    'NO',
    'off',
    'Off',
    'OFF',
  ];
  var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function compileStyleMap(schema, map) {
    if (map === null) return {};
    const result = {};
    const keys = Object.keys(map);
    for (let index = 0, length = keys.length; index < length; index += 1) {
      let tag = keys[index];
      let style = String(map[tag]);
      if (tag.slice(0, 2) === '!!') tag = 'tag:yaml.org,2002:' + tag.slice(2);
      const type = schema.compiledTypeMap['fallback'][tag];
      if (type && _hasOwnProperty.call(type.styleAliases, style)) style = type.styleAliases[style];
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    let handle;
    let length;
    const string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = 'x';
      length = 2;
    } else if (character <= 65535) {
      handle = 'u';
      length = 4;
    } else if (character <= 4294967295) {
      handle = 'U';
      length = 8;
    } else
      throw new YAMLException2('code point within a string may not be greater than 0xFFFFFFFF');
    return '\\' + handle + common.repeat('0', length - string.length) + string;
  }
  var QUOTING_TYPE_SINGLE = 1;
  var QUOTING_TYPE_DOUBLE = 2;
  function State(options2) {
    this.schema = options2['schema'] || DEFAULT_SCHEMA2;
    this.indent = Math.max(1, options2['indent'] || 2);
    this.noArrayIndent = options2['noArrayIndent'] || false;
    this.skipInvalid = options2['skipInvalid'] || false;
    this.flowLevel = common.isNothing(options2['flowLevel']) ? -1 : options2['flowLevel'];
    this.styleMap = compileStyleMap(this.schema, options2['styles'] || null);
    this.sortKeys = options2['sortKeys'] || false;
    this.lineWidth = options2['lineWidth'] || 80;
    this.noRefs = options2['noRefs'] || false;
    this.noCompatMode = options2['noCompatMode'] || false;
    this.condenseFlow = options2['condenseFlow'] || false;
    this.quotingType = options2['quotingType'] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
    this.forceQuotes = options2['forceQuotes'] || false;
    this.replacer = typeof options2['replacer'] === 'function' ? options2['replacer'] : null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = '';
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    const ind = common.repeat(' ', spaces);
    let position = 0;
    let result = '';
    const length = string.length;
    while (position < length) {
      let line;
      const next = string.indexOf('\n', position);
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (line.length && line !== '\n') result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return '\n' + common.repeat(' ', state.indent * level);
  }
  function testImplicitResolving(state, str2) {
    for (let index = 0, length = state.implicitTypes.length; index < length; index += 1)
      if (state.implicitTypes[index].resolve(str2)) return true;
    return false;
  }
  function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
  }
  function isPrintable(c) {
    return (
      (c >= 32 && c <= 126) ||
      (c >= 161 && c <= 55295 && c !== 8232 && c !== 8233) ||
      (c >= 57344 && c <= 65533 && c !== CHAR_BOM) ||
      (c >= 65536 && c <= 1114111)
    );
  }
  function isNsCharOrWhitespace(c) {
    return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c, prev, inblock) {
    const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
    const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
    return (
      ((inblock
        ? cIsNsCharOrWhitespace
        : cIsNsCharOrWhitespace &&
          c !== CHAR_COMMA &&
          c !== CHAR_LEFT_SQUARE_BRACKET &&
          c !== CHAR_RIGHT_SQUARE_BRACKET &&
          c !== CHAR_LEFT_CURLY_BRACKET &&
          c !== CHAR_RIGHT_CURLY_BRACKET) &&
        c !== CHAR_SHARP &&
        !(prev === CHAR_COLON && !cIsNsChar)) ||
      (isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP) ||
      (prev === CHAR_COLON && cIsNsChar)
    );
  }
  function isPlainSafeFirst(c) {
    return (
      isPrintable(c) &&
      c !== CHAR_BOM &&
      !isWhitespace(c) &&
      c !== CHAR_MINUS &&
      c !== CHAR_QUESTION &&
      c !== CHAR_COLON &&
      c !== CHAR_COMMA &&
      c !== CHAR_LEFT_SQUARE_BRACKET &&
      c !== CHAR_RIGHT_SQUARE_BRACKET &&
      c !== CHAR_LEFT_CURLY_BRACKET &&
      c !== CHAR_RIGHT_CURLY_BRACKET &&
      c !== CHAR_SHARP &&
      c !== CHAR_AMPERSAND &&
      c !== CHAR_ASTERISK &&
      c !== CHAR_EXCLAMATION &&
      c !== CHAR_VERTICAL_LINE &&
      c !== CHAR_EQUALS &&
      c !== CHAR_GREATER_THAN &&
      c !== CHAR_SINGLE_QUOTE &&
      c !== CHAR_DOUBLE_QUOTE &&
      c !== CHAR_PERCENT &&
      c !== CHAR_COMMERCIAL_AT &&
      c !== CHAR_GRAVE_ACCENT
    );
  }
  function isPlainSafeLast(c) {
    return !isWhitespace(c) && c !== CHAR_COLON;
  }
  function codePointAt(string, pos) {
    const first = string.charCodeAt(pos);
    let second;
    if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
      second = string.charCodeAt(pos + 1);
      if (second >= 56320 && second <= 57343)
        return (first - 55296) * 1024 + second - 56320 + 65536;
    }
    return first;
  }
  function needIndentIndicator(string) {
    return /^\n* /.test(string);
  }
  var STYLE_PLAIN = 1;
  var STYLE_SINGLE = 2;
  var STYLE_LITERAL = 3;
  var STYLE_FOLDED = 4;
  var STYLE_DOUBLE = 5;
  function chooseScalarStyle(
    string,
    singleLineOnly,
    indentPerLevel,
    lineWidth,
    testAmbiguousType,
    quotingType,
    forceQuotes,
    inblock
  ) {
    let i;
    let char = 0;
    let prevChar = null;
    let hasLineBreak = false;
    let hasFoldableLine = false;
    const shouldTrackWidth = lineWidth !== -1;
    let previousLineBreak = -1;
    let plain =
      isPlainSafeFirst(codePointAt(string, 0)) &&
      isPlainSafeLast(codePointAt(string, string.length - 1));
    if (singleLineOnly || forceQuotes)
      for (i = 0; i < string.length; char >= 65536 ? (i += 2) : i++) {
        char = codePointAt(string, i);
        if (!isPrintable(char)) return STYLE_DOUBLE;
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
    else {
      for (i = 0; i < string.length; char >= 65536 ? (i += 2) : i++) {
        char = codePointAt(string, i);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine =
              hasFoldableLine ||
              (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== ' ');
            previousLineBreak = i;
          }
        } else if (!isPrintable(char)) return STYLE_DOUBLE;
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
      hasFoldableLine =
        hasFoldableLine ||
        (shouldTrackWidth &&
          i - previousLineBreak - 1 > lineWidth &&
          string[previousLineBreak + 1] !== ' ');
    }
    if (!hasLineBreak && !hasFoldableLine) {
      if (plain && !forceQuotes && !testAmbiguousType(string)) return STYLE_PLAIN;
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) return STYLE_DOUBLE;
    if (!forceQuotes) return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  function writeScalar(state, string, level, iskey, inblock) {
    state.dump = (function () {
      if (string.length === 0) return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
      if (!state.noCompatMode) {
        if (
          DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 ||
          DEPRECATED_BASE60_SYNTAX.test(string)
        )
          return state.quotingType === QUOTING_TYPE_DOUBLE
            ? '"' + string + '"'
            : "'" + string + "'";
      }
      const indent = state.indent * Math.max(1, level);
      const lineWidth =
        state.lineWidth === -1
          ? -1
          : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      const singleLineOnly = iskey || (state.flowLevel > -1 && level >= state.flowLevel);
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (
        chooseScalarStyle(
          string,
          singleLineOnly,
          state.indent,
          lineWidth,
          testAmbiguity,
          state.quotingType,
          state.forceQuotes && !iskey,
          inblock
        )
      ) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return (
            '|' +
            blockHeader(string, state.indent) +
            dropEndingNewline(indentString(string, indent))
          );
        case STYLE_FOLDED:
          return (
            '>' +
            blockHeader(string, state.indent) +
            dropEndingNewline(indentString(foldString(string, lineWidth), indent))
          );
        case STYLE_DOUBLE:
          return '"' + escapeString(string, lineWidth) + '"';
        default:
          throw new YAMLException2('impossible error: invalid scalar style');
      }
    })();
  }
  function blockHeader(string, indentPerLevel) {
    const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : '';
    const clip = string[string.length - 1] === '\n';
    return (
      indentIndicator +
      (clip && (string[string.length - 2] === '\n' || string === '\n') ? '+' : clip ? '' : '-') +
      '\n'
    );
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === '\n' ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    const lineRe = /(\n+)([^\n]*)/g;
    let result = (function () {
      let nextLF = string.indexOf('\n');
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    })();
    let prevMoreIndented = string[0] === '\n' || string[0] === ' ';
    let moreIndented;
    let match;
    while ((match = lineRe.exec(string))) {
      const prefix = match[1];
      const line = match[2];
      moreIndented = line[0] === ' ';
      result +=
        prefix +
        (!prevMoreIndented && !moreIndented && line !== '' ? '\n' : '') +
        foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === '' || line[0] === ' ') return line;
    const breakRe = / [^ ]/g;
    let match;
    let start = 0;
    let end;
    let curr = 0;
    let next = 0;
    let result = '';
    while ((match = breakRe.exec(line))) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result += '\n' + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += '\n';
    if (line.length - start > width && curr > start)
      result += line.slice(start, curr) + '\n' + line.slice(curr + 1);
    else result += line.slice(start);
    return result.slice(1);
  }
  function escapeString(string) {
    let result = '';
    let char = 0;
    for (let i = 0; i < string.length; char >= 65536 ? (i += 2) : i++) {
      char = codePointAt(string, i);
      const escapeSeq = ESCAPE_SEQUENCES[char];
      if (!escapeSeq && isPrintable(char)) {
        result += string[i];
        if (char >= 65536) result += string[i + 1];
      } else result += escapeSeq || encodeHex(char);
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    let _result = '';
    const _tag = state.tag;
    for (let index = 0, length = object.length; index < length; index += 1) {
      let value = object[index];
      if (state.replacer) value = state.replacer.call(object, String(index), value);
      if (
        writeNode(state, level, value, false, false) ||
        (typeof value === 'undefined' && writeNode(state, level, null, false, false))
      ) {
        if (_result !== '') _result += ',' + (!state.condenseFlow ? ' ' : '');
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = '[' + _result + ']';
  }
  function writeBlockSequence(state, level, object, compact) {
    let _result = '';
    const _tag = state.tag;
    for (let index = 0, length = object.length; index < length; index += 1) {
      let value = object[index];
      if (state.replacer) value = state.replacer.call(object, String(index), value);
      if (
        writeNode(state, level + 1, value, true, true, false, true) ||
        (typeof value === 'undefined' && writeNode(state, level + 1, null, true, true, false, true))
      ) {
        if (!compact || _result !== '') _result += generateNextLine(state, level);
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) _result += '-';
        else _result += '- ';
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || '[]';
  }
  function writeFlowMapping(state, level, object) {
    let _result = '';
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
      let pairBuffer = '';
      if (_result !== '') pairBuffer += ', ';
      if (state.condenseFlow) pairBuffer += '"';
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
      if (!writeNode(state, level, objectKey, false, false)) continue;
      if (state.dump.length > 1024) pairBuffer += '? ';
      pairBuffer +=
        state.dump + (state.condenseFlow ? '"' : '') + ':' + (state.condenseFlow ? '' : ' ');
      if (!writeNode(state, level, objectValue, false, false)) continue;
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = '{' + _result + '}';
  }
  function writeBlockMapping(state, level, object, compact) {
    let _result = '';
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    if (state.sortKeys === true) objectKeyList.sort();
    else if (typeof state.sortKeys === 'function') objectKeyList.sort(state.sortKeys);
    else if (state.sortKeys) throw new YAMLException2('sortKeys must be a boolean or a function');
    for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
      let pairBuffer = '';
      if (!compact || _result !== '') pairBuffer += generateNextLine(state, level);
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
      if (!writeNode(state, level + 1, objectKey, true, true, true)) continue;
      const explicitPair =
        (state.tag !== null && state.tag !== '?') || (state.dump && state.dump.length > 1024);
      if (explicitPair)
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += '?';
        else pairBuffer += '? ';
      pairBuffer += state.dump;
      if (explicitPair) pairBuffer += generateNextLine(state, level);
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) continue;
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += ':';
      else pairBuffer += ': ';
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || '{}';
  }
  function detectType(state, object, explicit) {
    const typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (let index = 0, length = typeList.length; index < length; index += 1) {
      const type = typeList[index];
      if (
        (type.instanceOf || type.predicate) &&
        (!type.instanceOf || (typeof object === 'object' && object instanceof type.instanceOf)) &&
        (!type.predicate || type.predicate(object))
      ) {
        if (explicit)
          if (type.multi && type.representName) state.tag = type.representName(object);
          else state.tag = type.tag;
        else state.tag = '?';
        if (type.represent) {
          const style = state.styleMap[type.tag] || type.defaultStyle;
          let _result;
          if (_toString.call(type.represent) === '[object Function]')
            _result = type.represent(object, style);
          else if (_hasOwnProperty.call(type.represent, style))
            _result = type.represent[style](object, style);
          else
            throw new YAMLException2(
              '!<' + type.tag + '> tag resolver accepts not "' + style + '" style'
            );
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey, isblockseq) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) detectType(state, object, true);
    const type = _toString.call(state.dump);
    const inblock = block;
    if (block) block = state.flowLevel < 0 || state.flowLevel > level;
    const objectOrArray = type === '[object Object]' || type === '[object Array]';
    let duplicateIndex;
    let duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if ((state.tag !== null && state.tag !== '?') || duplicate || (state.indent !== 2 && level > 0))
      compact = false;
    if (duplicate && state.usedDuplicates[duplicateIndex]) state.dump = '*ref_' + duplicateIndex;
    else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex])
        state.usedDuplicates[duplicateIndex] = true;
      if (type === '[object Object]')
        if (block && Object.keys(state.dump).length !== 0) {
          writeBlockMapping(state, level, state.dump, compact);
          if (duplicate) state.dump = '&ref_' + duplicateIndex + state.dump;
        } else {
          writeFlowMapping(state, level, state.dump);
          if (duplicate) state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
        }
      else if (type === '[object Array]')
        if (block && state.dump.length !== 0) {
          if (state.noArrayIndent && !isblockseq && level > 0)
            writeBlockSequence(state, level - 1, state.dump, compact);
          else writeBlockSequence(state, level, state.dump, compact);
          if (duplicate) state.dump = '&ref_' + duplicateIndex + state.dump;
        } else {
          writeFlowSequence(state, level, state.dump);
          if (duplicate) state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
        }
      else if (type === '[object String]') {
        if (state.tag !== '?') writeScalar(state, state.dump, level, iskey, inblock);
      } else if (type === '[object Undefined]') return false;
      else {
        if (state.skipInvalid) return false;
        throw new YAMLException2('unacceptable kind of an object to dump ' + type);
      }
      if (state.tag !== null && state.tag !== '?') {
        let tagStr = encodeURI(state.tag[0] === '!' ? state.tag.slice(1) : state.tag).replace(
          /!/g,
          '%21'
        );
        if (state.tag[0] === '!') tagStr = '!' + tagStr;
        else if (tagStr.slice(0, 18) === 'tag:yaml.org,2002:') tagStr = '!!' + tagStr.slice(18);
        else tagStr = '!<' + tagStr + '>';
        state.dump = tagStr + ' ' + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    const objects = [];
    const duplicatesIndexes = [];
    inspectNode(object, objects, duplicatesIndexes);
    const length = duplicatesIndexes.length;
    for (let index = 0; index < length; index += 1)
      state.duplicates.push(objects[duplicatesIndexes[index]]);
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    if (object !== null && typeof object === 'object') {
      const index = objects.indexOf(object);
      if (index !== -1) {
        if (duplicatesIndexes.indexOf(index) === -1) duplicatesIndexes.push(index);
      } else {
        objects.push(object);
        if (Array.isArray(object))
          for (let i = 0, length = object.length; i < length; i += 1)
            inspectNode(object[i], objects, duplicatesIndexes);
        else {
          const objectKeyList = Object.keys(object);
          for (let i = 0, length = objectKeyList.length; i < length; i += 1)
            inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
        }
      }
    }
  }
  function dump2(input, options2) {
    options2 = options2 || {};
    const state = new State(options2);
    if (!state.noRefs) getDuplicateReferences(input, state);
    let value = input;
    if (state.replacer) value = state.replacer.call({ '': value }, '', value);
    if (writeNode(state, 0, value, true, true)) return state.dump + '\n';
    return '';
  }
  module2.exports.dump = dump2;
});
var import_js_yaml = /* @__PURE__ */ __toESM2(
  /* @__PURE__ */ __commonJSMin((exports2, module2) => {
    var loader = require_loader2();
    var dumper = require_dumper2();
    function renamed(from, to) {
      return function () {
        throw new Error(
          'Function yaml.' +
            from +
            ' is removed in js-yaml 4. Use yaml.' +
            to +
            ' instead, which is now safe by default.'
        );
      };
    }
    module2.exports.Type = require_type2();
    module2.exports.Schema = require_schema2();
    module2.exports.FAILSAFE_SCHEMA = require_failsafe2();
    module2.exports.JSON_SCHEMA = require_json2();
    module2.exports.CORE_SCHEMA = require_core2();
    module2.exports.DEFAULT_SCHEMA = require_default();
    module2.exports.load = loader.load;
    module2.exports.loadAll = loader.loadAll;
    module2.exports.dump = dumper.dump;
    module2.exports.YAMLException = require_exception2();
    module2.exports.types = {
      binary: require_binary2(),
      float: require_float2(),
      map: require_map2(),
      null: require_null2(),
      pairs: require_pairs2(),
      set: require_set2(),
      timestamp: require_timestamp2(),
      bool: require_bool2(),
      int: require_int2(),
      merge: require_merge2(),
      omap: require_omap2(),
      seq: require_seq2(),
      str: require_str2(),
    };
    module2.exports.safeLoad = renamed('safeLoad', 'load');
    module2.exports.safeLoadAll = renamed('safeLoadAll', 'loadAll');
    module2.exports.safeDump = renamed('safeDump', 'dump');
  })(),
  1
);
var {
  Type,
  Schema,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  load,
  loadAll,
  dump,
  YAMLException,
  types,
  safeLoad,
  safeLoadAll,
  safeDump,
} = import_js_yaml.default;
var index_vite_proxy_tmp_default = import_js_yaml.default;

// src/lib/session-log.ts
function renderSessionLog(input) {
  const proposalStatus = input.proposalStatus ?? 'pending';
  const proposalError = input.proposalError ?? null;
  const proposalCompletedAt = input.proposalCompletedAt ?? null;
  const frontmatter = {
    schema_version: 1,
    session_id: input.sessionId,
    captured_by: input.capturedBy,
    captured_at: input.capturedAt,
    transcript_hash: input.transcriptHash,
    proposal_status: proposalStatus,
    proposal_completed_at: proposalCompletedAt,
    proposal_error: proposalError,
    proposal_log: null,
    proposals: input.proposals ?? { practice: [], map: [] },
  };
  if (input.curatorProcessedAt) {
    frontmatter['curator_processed_at'] = input.curatorProcessedAt;
  }
  if (input.curatorRunId) {
    frontmatter['curator_run_id'] = input.curatorRunId;
  }
  if (input.topics && input.topics.length > 0) {
    frontmatter['topics'] = input.topics;
  }
  const yaml2 = dump(frontmatter, { lineWidth: -1, noRefs: true, sortKeys: false });
  const proposalSection =
    proposalStatus === 'done'
      ? '_Extraction complete; see proposals in frontmatter._'
      : '(populated by proposal worker)';
  const bodyLines = [
    '## Transcript',
    '',
    input.body.trimEnd(),
    '',
    '## Proposal',
    '',
    proposalSection,
    '',
  ];
  return `---
${yaml2}---
${bodyLines.join('\n')}`;
}
function writeSessionLog(sessionsDir, filename, contents) {
  (0, import_node_fs.mkdirSync)(sessionsDir, { recursive: true });
  const path = (0, import_node_path.join)(sessionsDir, filename);
  (0, import_node_fs.writeFileSync)(path, contents);
  return path;
}
function buildSessionLogFilename(capturedAt, sessionId) {
  const d = new Date(capturedAt);
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  return `${stamp}-${sessionId}.md`;
}
function findSessionLogBySessionId(sessionsDir, sessionId) {
  if (!(0, import_node_fs.existsSync)(sessionsDir)) return null;
  const suffix = `-${sessionId}.md`;
  const matches = (0, import_node_fs.readdirSync)(sessionsDir)
    .filter(f => f.endsWith(suffix))
    .sort();
  return matches[0] ?? null;
}
var UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertValidSessionId(sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('session_id must be a non-empty string');
  }
  if (!UUID_V4_RE.test(sessionId)) {
    throw new Error(`session_id "${sessionId}" is not a UUID v4`);
  }
  return sessionId.toLowerCase();
}
function pad(n) {
  return n.toString().padStart(2, '0');
}

// src/lib/settings.ts
init_cjs_shims();
var import_node_fs2 = require('fs');
var import_node_path2 = require('path');

// src/lib/schemas.ts
init_cjs_shims();

// node_modules/zod/index.js
init_cjs_shims();

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType,
});
init_cjs_shims();

// node_modules/zod/v3/errors.js
init_cjs_shims();

// node_modules/zod/v3/locales/en.js
init_cjs_shims();

// node_modules/zod/v3/ZodError.js
init_cjs_shims();

// node_modules/zod/v3/helpers/util.js
init_cjs_shims();
var util;
(function (util2) {
  util2.assertEqual = _ => {};
  function assertIs(_arg) {}
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = items => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = obj => {
    const validKeys = util2.objectKeys(obj).filter(k => typeof obj[obj[k]] !== 'number');
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = obj => {
    return util2.objectKeys(obj).map(function (e) {
      return obj[e];
    });
  };
  util2.objectKeys =
    typeof Object.keys === 'function'
      ? obj => Object.keys(obj)
      : object => {
          const keys = [];
          for (const key in object) {
            if (Object.prototype.hasOwnProperty.call(object, key)) {
              keys.push(key);
            }
          }
          return keys;
        };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item)) return item;
    }
    return void 0;
  };
  util2.isInteger =
    typeof Number.isInteger === 'function'
      ? val => Number.isInteger(val)
      : val => typeof val === 'number' && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = ' | ') {
    return array.map(val => (typeof val === 'string' ? `'${val}'` : val)).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function (objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second,
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  'string',
  'nan',
  'number',
  'integer',
  'float',
  'boolean',
  'date',
  'bigint',
  'symbol',
  'function',
  'undefined',
  'null',
  'array',
  'object',
  'unknown',
  'promise',
  'void',
  'never',
  'map',
  'set',
]);
var getParsedType = data => {
  const t = typeof data;
  switch (t) {
    case 'undefined':
      return ZodParsedType.undefined;
    case 'string':
      return ZodParsedType.string;
    case 'number':
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case 'boolean':
      return ZodParsedType.boolean;
    case 'function':
      return ZodParsedType.function;
    case 'bigint':
      return ZodParsedType.bigint;
    case 'symbol':
      return ZodParsedType.symbol;
    case 'object':
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (
        data.then &&
        typeof data.then === 'function' &&
        data.catch &&
        typeof data.catch === 'function'
      ) {
        return ZodParsedType.promise;
      }
      if (typeof Map !== 'undefined' && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== 'undefined' && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== 'undefined' && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  'invalid_type',
  'invalid_literal',
  'custom',
  'invalid_union',
  'invalid_union_discriminator',
  'invalid_enum_value',
  'unrecognized_keys',
  'invalid_arguments',
  'invalid_return_type',
  'invalid_date',
  'invalid_string',
  'too_small',
  'too_big',
  'invalid_intersection_types',
  'not_multiple_of',
  'not_finite',
]);
var quotelessJson = obj => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, '$1:');
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = sub => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = 'ZodError';
    this.issues = issues;
  }
  format(_mapper) {
    const mapper =
      _mapper ||
      function (issue) {
        return issue.message;
      };
    const fieldErrors = { _errors: [] };
    const processError = error => {
      for (const issue of error.issues) {
        if (issue.code === 'invalid_union') {
          issue.unionErrors.map(processError);
        } else if (issue.code === 'invalid_return_type') {
          processError(issue.returnTypeError);
        } else if (issue.code === 'invalid_arguments') {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = issue => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = issues => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = 'Required';
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ', ')}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === 'object') {
        if ('includes' in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === 'number') {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ('startsWith' in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ('endsWith' in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== 'regex') {
        message = `Invalid ${issue.validation}`;
      } else {
        message = 'Invalid';
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === 'array')
        message = `Array must contain ${issue.exact ? 'exactly' : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === 'string')
        message = `String must contain ${issue.exact ? 'exactly' : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === 'number')
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === 'bigint')
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === 'date')
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else message = 'Invalid input';
      break;
    case ZodIssueCode.too_big:
      if (issue.type === 'array')
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === 'string')
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === 'number')
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === 'bigint')
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === 'date')
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else message = 'Invalid input';
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = 'Number must be finite';
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
init_cjs_shims();
var makeIssue = params => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...(issueData.path || [])];
  const fullIssue = {
    ...issueData,
    path: fullPath,
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message,
    };
  }
  let errorMessage = '';
  const maps = errorMaps
    .filter(m => !!m)
    .slice()
    .reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage,
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default,
      // then global default map
    ].filter(x => !!x),
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = 'valid';
  }
  dirty() {
    if (this.value === 'valid') this.value = 'dirty';
  }
  abort() {
    if (this.value !== 'aborted') this.value = 'aborted';
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === 'aborted') return INVALID;
      if (s.status === 'dirty') status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value,
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === 'aborted') return INVALID;
      if (value.status === 'aborted') return INVALID;
      if (key.status === 'dirty') status.dirty();
      if (value.status === 'dirty') status.dirty();
      if (key.value !== '__proto__' && (typeof value.value !== 'undefined' || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: 'aborted',
});
var DIRTY = value => ({ status: 'dirty', value });
var OK = value => ({ status: 'valid', value });
var isAborted = x => x.status === 'aborted';
var isDirty = x => x.status === 'dirty';
var isValid = x => x.status === 'valid';
var isAsync = x => typeof Promise !== 'undefined' && x instanceof Promise;

// node_modules/zod/v3/types.js
init_cjs_shims();

// node_modules/zod/v3/helpers/errorUtil.js
init_cjs_shims();
var errorUtil;
(function (errorUtil2) {
  errorUtil2.errToObj = message => (typeof message === 'string' ? { message } : message || {});
  errorUtil2.toString = message => (typeof message === 'string' ? message : message?.message);
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error('Validation failed but no issues detected.');
    }
    return {
      success: false,
      get error() {
        if (this._error) return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      },
    };
  }
};
function processCreateParams(params) {
  if (!params) return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(
      `Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`
    );
  }
  if (errorMap2) return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === 'invalid_enum_value') {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === 'undefined') {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== 'invalid_type') return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return (
      ctx || {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent,
      }
    );
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent,
      },
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error('Synchronous parse encountered promise.');
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success) return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap,
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data),
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  '~validate'(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this['~standard'].async,
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data),
    };
    if (!this['~standard'].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result)
          ? {
              value: result.value,
            }
          : {
              issues: ctx.common.issues,
            };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes('encountered')) {
          this['~standard'].async = true;
        }
        ctx.common = {
          issues: [],
          async: true,
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then(result =>
      isValid(result)
        ? {
            value: result.value,
          }
        : {
            issues: ctx.common.issues,
          }
    );
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success) return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true,
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data),
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult)
      ? maybeAsyncResult
      : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = val => {
      if (typeof message === 'string' || typeof message === 'undefined') {
        return { message };
      } else if (typeof message === 'function') {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () =>
        ctx.addIssue({
          code: ZodIssueCode.custom,
          ...getIssueProperties(val),
        });
      if (typeof Promise !== 'undefined' && result instanceof Promise) {
        return result.then(data => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(
          typeof refinementData === 'function' ? refinementData(val, ctx) : refinementData
        );
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: 'refinement', refinement },
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this['~standard'] = {
      version: 1,
      vendor: 'zod',
      validate: data => this['~validate'](data),
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: 'transform', transform },
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === 'function' ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault,
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def),
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === 'function' ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch,
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description,
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex =
  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex =
  /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex =
  /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex =
  /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex =
  /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex =
  /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex =
  /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? '+' : '?';
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset) opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join('|')})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === 'v4' || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === 'v6' || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt)) return false;
  try {
    const [header] = jwt.split('.');
    if (!header) return false;
    const base64 = header
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(header.length + ((4 - (header.length % 4)) % 4), '=');
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== 'object' || decoded === null) return false;
    if ('typ' in decoded && decoded?.typ !== 'JWT') return false;
    if (!decoded.alg) return false;
    if (alg && decoded.alg !== alg) return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === 'v4' || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === 'v6' || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType,
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === 'min') {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: 'string',
            inclusive: true,
            exact: false,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'max') {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: 'string',
            inclusive: true,
            exact: false,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'length') {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: 'string',
              inclusive: true,
              exact: true,
              message: check.message,
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: 'string',
              inclusive: true,
              exact: true,
              message: check.message,
            });
          }
          status.dirty();
        }
      } else if (check.kind === 'email') {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'email',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'emoji') {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, 'u');
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'emoji',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'uuid') {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'uuid',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'nanoid') {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'nanoid',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'cuid') {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'cuid',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'cuid2') {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'cuid2',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'ulid') {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'ulid',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'url') {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'url',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'regex') {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'regex',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'trim') {
        input.data = input.data.trim();
      } else if (check.kind === 'includes') {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'toLowerCase') {
        input.data = input.data.toLowerCase();
      } else if (check.kind === 'toUpperCase') {
        input.data = input.data.toUpperCase();
      } else if (check.kind === 'startsWith') {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'endsWith') {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'datetime') {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: 'datetime',
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'date') {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: 'date',
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'time') {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: 'time',
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'duration') {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'duration',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'ip') {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'ip',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'jwt') {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'jwt',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'cidr') {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'cidr',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'base64') {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'base64',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'base64url') {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: 'base64url',
            code: ZodIssueCode.invalid_string,
            message: check.message,
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement(data => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message),
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check],
    });
  }
  email(message) {
    return this._addCheck({ kind: 'email', ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: 'url', ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: 'emoji', ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: 'uuid', ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: 'nanoid', ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: 'cuid', ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: 'cuid2', ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: 'ulid', ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: 'base64', ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: 'base64url',
      ...errorUtil.errToObj(message),
    });
  }
  jwt(options2) {
    return this._addCheck({ kind: 'jwt', ...errorUtil.errToObj(options2) });
  }
  ip(options2) {
    return this._addCheck({ kind: 'ip', ...errorUtil.errToObj(options2) });
  }
  cidr(options2) {
    return this._addCheck({ kind: 'cidr', ...errorUtil.errToObj(options2) });
  }
  datetime(options2) {
    if (typeof options2 === 'string') {
      return this._addCheck({
        kind: 'datetime',
        precision: null,
        offset: false,
        local: false,
        message: options2,
      });
    }
    return this._addCheck({
      kind: 'datetime',
      precision: typeof options2?.precision === 'undefined' ? null : options2?.precision,
      offset: options2?.offset ?? false,
      local: options2?.local ?? false,
      ...errorUtil.errToObj(options2?.message),
    });
  }
  date(message) {
    return this._addCheck({ kind: 'date', message });
  }
  time(options2) {
    if (typeof options2 === 'string') {
      return this._addCheck({
        kind: 'time',
        precision: null,
        message: options2,
      });
    }
    return this._addCheck({
      kind: 'time',
      precision: typeof options2?.precision === 'undefined' ? null : options2?.precision,
      ...errorUtil.errToObj(options2?.message),
    });
  }
  duration(message) {
    return this._addCheck({ kind: 'duration', ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: 'regex',
      regex,
      ...errorUtil.errToObj(message),
    });
  }
  includes(value, options2) {
    return this._addCheck({
      kind: 'includes',
      value,
      position: options2?.position,
      ...errorUtil.errToObj(options2?.message),
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: 'startsWith',
      value,
      ...errorUtil.errToObj(message),
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: 'endsWith',
      value,
      ...errorUtil.errToObj(message),
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: 'min',
      value: minLength,
      ...errorUtil.errToObj(message),
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: 'max',
      value: maxLength,
      ...errorUtil.errToObj(message),
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: 'length',
      value: len,
      ...errorUtil.errToObj(message),
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: 'trim' }],
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: 'toLowerCase' }],
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: 'toUpperCase' }],
    });
  }
  get isDatetime() {
    return !!this._def.checks.find(ch => ch.kind === 'datetime');
  }
  get isDate() {
    return !!this._def.checks.find(ch => ch.kind === 'date');
  }
  get isTime() {
    return !!this._def.checks.find(ch => ch.kind === 'time');
  }
  get isDuration() {
    return !!this._def.checks.find(ch => ch.kind === 'duration');
  }
  get isEmail() {
    return !!this._def.checks.find(ch => ch.kind === 'email');
  }
  get isURL() {
    return !!this._def.checks.find(ch => ch.kind === 'url');
  }
  get isEmoji() {
    return !!this._def.checks.find(ch => ch.kind === 'emoji');
  }
  get isUUID() {
    return !!this._def.checks.find(ch => ch.kind === 'uuid');
  }
  get isNANOID() {
    return !!this._def.checks.find(ch => ch.kind === 'nanoid');
  }
  get isCUID() {
    return !!this._def.checks.find(ch => ch.kind === 'cuid');
  }
  get isCUID2() {
    return !!this._def.checks.find(ch => ch.kind === 'cuid2');
  }
  get isULID() {
    return !!this._def.checks.find(ch => ch.kind === 'ulid');
  }
  get isIP() {
    return !!this._def.checks.find(ch => ch.kind === 'ip');
  }
  get isCIDR() {
    return !!this._def.checks.find(ch => ch.kind === 'cidr');
  }
  get isBase64() {
    return !!this._def.checks.find(ch => ch.kind === 'base64');
  }
  get isBase64url() {
    return !!this._def.checks.find(ch => ch.kind === 'base64url');
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === 'min') {
        if (min === null || ch.value > min) min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === 'max') {
        if (max === null || ch.value < max) max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = params => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params),
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split('.')[1] || '').length;
  const stepDecCount = (step.toString().split('.')[1] || '').length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace('.', ''));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace('.', ''));
  return (valInt % stepInt) / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType,
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === 'int') {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: 'integer',
            received: 'float',
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'min') {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: 'number',
            inclusive: check.inclusive,
            exact: false,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'max') {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: 'number',
            inclusive: check.inclusive,
            exact: false,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'multipleOf') {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'finite') {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message,
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit('min', value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit('min', value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit('max', value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit('max', value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message),
        },
      ],
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check],
    });
  }
  int(message) {
    return this._addCheck({
      kind: 'int',
      message: errorUtil.toString(message),
    });
  }
  positive(message) {
    return this._addCheck({
      kind: 'min',
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message),
    });
  }
  negative(message) {
    return this._addCheck({
      kind: 'max',
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message),
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: 'max',
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message),
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: 'min',
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message),
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: 'multipleOf',
      value,
      message: errorUtil.toString(message),
    });
  }
  finite(message) {
    return this._addCheck({
      kind: 'finite',
      message: errorUtil.toString(message),
    });
  }
  safe(message) {
    return this._addCheck({
      kind: 'min',
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message),
    })._addCheck({
      kind: 'max',
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message),
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === 'min') {
        if (min === null || ch.value > min) min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === 'max') {
        if (max === null || ch.value < max) max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find(
      ch => ch.kind === 'int' || (ch.kind === 'multipleOf' && util.isInteger(ch.value))
    );
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === 'finite' || ch.kind === 'int' || ch.kind === 'multipleOf') {
        return true;
      } else if (ch.kind === 'min') {
        if (min === null || ch.value > min) min = ch.value;
      } else if (ch.kind === 'max') {
        if (max === null || ch.value < max) max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = params => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params),
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === 'min') {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: 'bigint',
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'max') {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: 'bigint',
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message,
          });
          status.dirty();
        }
      } else if (check.kind === 'multipleOf') {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message,
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType,
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit('min', value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit('min', value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit('max', value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit('max', value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message),
        },
      ],
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check],
    });
  }
  positive(message) {
    return this._addCheck({
      kind: 'min',
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message),
    });
  }
  negative(message) {
    return this._addCheck({
      kind: 'max',
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message),
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: 'max',
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message),
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: 'min',
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message),
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: 'multipleOf',
      value,
      message: errorUtil.toString(message),
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === 'min') {
        if (min === null || ch.value > min) min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === 'max') {
        if (max === null || ch.value < max) max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = params => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params),
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = params => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params),
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType,
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date,
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === 'min') {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: 'date',
          });
          status.dirty();
        }
      } else if (check.kind === 'max') {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: 'date',
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime()),
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check],
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: 'min',
      value: minDate.getTime(),
      message: errorUtil.toString(message),
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: 'max',
      value: maxDate.getTime(),
      message: errorUtil.toString(message),
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === 'min') {
        if (min === null || ch.value > min) min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === 'max') {
        if (max === null || ch.value < max) max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = params => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params),
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = params => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params),
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = params => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params),
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = params => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params),
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = params => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params),
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = params => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params),
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType,
    });
    return INVALID;
  }
};
ZodNever.create = params => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params),
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = params => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params),
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: 'array',
          inclusive: true,
          exact: true,
          message: def.exactLength.message,
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: 'array',
          inclusive: true,
          exact: false,
          message: def.minLength.message,
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: 'array',
          inclusive: true,
          exact: false,
          message: def.maxLength.message,
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all(
        [...ctx.data].map((item, i) => {
          return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        })
      ).then(result2 => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) },
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) },
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) },
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params),
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape,
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element),
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map(item => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null) return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType,
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === 'strip')) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: 'valid', value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data,
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === 'passthrough') {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: 'valid', value: key },
            value: { status: 'valid', value: ctx.data[key] },
          });
        }
      } else if (unknownKeys === 'strict') {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys,
          });
          status.dirty();
        }
      } else if (unknownKeys === 'strip') {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: 'valid', value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data,
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve()
        .then(async () => {
          const syncPairs = [];
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
              key,
              value,
              alwaysSet: pair.alwaysSet,
            });
          }
          return syncPairs;
        })
        .then(syncPairs => {
          return ParseStatus.mergeObjectSync(status, syncPairs);
        });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: 'strict',
      ...(message !== void 0
        ? {
            errorMap: (issue, ctx) => {
              const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
              if (issue.code === 'unrecognized_keys')
                return {
                  message: errorUtil.errToObj(message).message ?? defaultError,
                };
              return {
                message: defaultError,
              };
            },
          }
        : {}),
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: 'strip',
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: 'passthrough',
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation,
      }),
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape(),
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject,
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index,
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape,
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape,
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape,
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape,
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: 'strip',
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params),
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: 'strict',
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params),
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: 'strip',
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params),
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options2 = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === 'valid') {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === 'dirty') {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map(result => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors,
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(
        options2.map(async option => {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: [],
            },
            parent: null,
          };
          return {
            result: await option._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx,
            }),
            ctx: childCtx,
          };
        })
      ).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options2) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: [],
          },
          parent: null,
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx,
        });
        if (result.status === 'valid') {
          return result;
        } else if (result.status === 'dirty' && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map(issues2 => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors,
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types2, params) => {
  return new ZodUnion({
    options: types2,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params),
  });
};
var getDiscriminator = type => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator],
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx,
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx,
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options2, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options2) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(
          `A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`
        );
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(
            `Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`
          );
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options: options2,
      optionsMap,
      ...processCreateParams(params),
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter(key => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types,
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        }),
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(
        this._def.left._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        }),
        this._def.right._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        })
      );
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params),
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: 'array',
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: 'array',
      });
      status.dirty();
    }
    const items = [...ctx.data]
      .map((item, itemIndex) => {
        const schema = this._def.items[itemIndex] || this._def.rest;
        if (!schema) return null;
        return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
      })
      .filter(x => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then(results => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest,
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error('You must pass an array of schemas to z.tuple([ ... ])');
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params),
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data,
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third),
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second),
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, 'key'])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, 'value'])),
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === 'aborted' || value.status === 'aborted') {
            return INVALID;
          }
          if (key.status === 'dirty' || value.status === 'dirty') {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === 'aborted' || value.status === 'aborted') {
          return INVALID;
        }
        if (key.status === 'dirty' || value.status === 'dirty') {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params),
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: 'set',
          inclusive: true,
          exact: false,
          message: def.minSize.message,
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: 'set',
          inclusive: true,
          exact: false,
          message: def.maxSize.message,
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === 'aborted') return INVALID;
        if (element.status === 'dirty') status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) =>
      valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i))
    );
    if (ctx.common.async) {
      return Promise.all(elements).then(elements2 => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) },
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) },
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params),
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          en_default,
        ].filter(x => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error,
        },
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          en_default,
        ].filter(x => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error,
        },
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function (...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch(e => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type
          .parseAsync(result, params)
          .catch(e => {
            error.addIssue(makeReturnsIssue(result, e));
            throw error;
          });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function (...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create()),
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType,
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params),
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params),
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value,
      });
      return INVALID;
    }
    return { status: 'valid', value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params),
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params),
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== 'string') {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type,
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues,
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef,
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(
      this.options.filter(opt => !values.includes(opt)),
      {
        ...this._def,
        ...newDef,
      }
    );
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type,
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues,
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params),
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    const promisified =
      ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(
      promisified.then(data => {
        return this._def.type.parseAsync(data, {
          path: ctx.path,
          errorMap: ctx.common.contextualErrorMap,
        });
      })
    );
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params),
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects
      ? this._def.schema.sourceType()
      : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: arg => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      },
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === 'preprocess') {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async processed2 => {
          if (status.value === 'aborted') return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx,
          });
          if (result.status === 'aborted') return INVALID;
          if (result.status === 'dirty') return DIRTY(result.value);
          if (status.value === 'dirty') return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === 'aborted') return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx,
        });
        if (result.status === 'aborted') return INVALID;
        if (result.status === 'dirty') return DIRTY(result.value);
        if (status.value === 'dirty') return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === 'refinement') {
      const executeRefinement = acc => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error(
            'Async refinement encountered during synchronous parse operation. Use .parseAsync instead.'
          );
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        });
        if (inner.status === 'aborted') return INVALID;
        if (inner.status === 'dirty') status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema
          ._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx })
          .then(inner => {
            if (inner.status === 'aborted') return INVALID;
            if (inner.status === 'dirty') status.dirty();
            return executeRefinement(inner.value).then(() => {
              return { status: status.value, value: inner.value };
            });
          });
      }
    }
    if (effect.type === 'transform') {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        });
        if (!isValid(base)) return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(
            `Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`
          );
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema
          ._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx })
          .then(base => {
            if (!isValid(base)) return INVALID;
            return Promise.resolve(effect.transform(base.value, checkCtx)).then(result => ({
              status: status.value,
              value: result,
            }));
          });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params),
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: 'preprocess', transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params),
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params),
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params),
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx,
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === 'function' ? params.default : () => params.default,
    ...processCreateParams(params),
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: [],
      },
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx,
      },
    });
    if (isAsync(result)) {
      return result.then(result2 => {
        return {
          status: 'valid',
          value:
            result2.status === 'valid'
              ? result2.value
              : this._def.catchValue({
                  get error() {
                    return new ZodError(newCtx.common.issues);
                  },
                  input: newCtx.data,
                }),
        };
      });
    } else {
      return {
        status: 'valid',
        value:
          result.status === 'valid'
            ? result.value
            : this._def.catchValue({
                get error() {
                  return new ZodError(newCtx.common.issues);
                },
                input: newCtx.data,
              }),
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === 'function' ? params.catch : () => params.catch,
    ...processCreateParams(params),
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType,
      });
      return INVALID;
    }
    return { status: 'valid', value: input.data };
  }
};
ZodNaN.create = params => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params),
  });
};
var BRAND = /* @__PURE__ */ Symbol('zod_brand');
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx,
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx,
        });
        if (inResult.status === 'aborted') return INVALID;
        if (inResult.status === 'dirty') {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx,
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx,
      });
      if (inResult.status === 'aborted') return INVALID;
      if (inResult.status === 'dirty') {
        status.dirty();
        return {
          status: 'dirty',
          value: inResult.value,
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx,
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline,
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = data => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then(data => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params),
  });
};
function cleanParams(params, data) {
  const p =
    typeof params === 'function'
      ? params(data)
      : typeof params === 'string'
        ? { message: params }
        : params;
  const p2 = typeof p === 'string' ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then(r2 => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: 'custom', ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: 'custom', ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate,
};
var ZodFirstPartyTypeKind;
(function (ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2['ZodString'] = 'ZodString';
  ZodFirstPartyTypeKind2['ZodNumber'] = 'ZodNumber';
  ZodFirstPartyTypeKind2['ZodNaN'] = 'ZodNaN';
  ZodFirstPartyTypeKind2['ZodBigInt'] = 'ZodBigInt';
  ZodFirstPartyTypeKind2['ZodBoolean'] = 'ZodBoolean';
  ZodFirstPartyTypeKind2['ZodDate'] = 'ZodDate';
  ZodFirstPartyTypeKind2['ZodSymbol'] = 'ZodSymbol';
  ZodFirstPartyTypeKind2['ZodUndefined'] = 'ZodUndefined';
  ZodFirstPartyTypeKind2['ZodNull'] = 'ZodNull';
  ZodFirstPartyTypeKind2['ZodAny'] = 'ZodAny';
  ZodFirstPartyTypeKind2['ZodUnknown'] = 'ZodUnknown';
  ZodFirstPartyTypeKind2['ZodNever'] = 'ZodNever';
  ZodFirstPartyTypeKind2['ZodVoid'] = 'ZodVoid';
  ZodFirstPartyTypeKind2['ZodArray'] = 'ZodArray';
  ZodFirstPartyTypeKind2['ZodObject'] = 'ZodObject';
  ZodFirstPartyTypeKind2['ZodUnion'] = 'ZodUnion';
  ZodFirstPartyTypeKind2['ZodDiscriminatedUnion'] = 'ZodDiscriminatedUnion';
  ZodFirstPartyTypeKind2['ZodIntersection'] = 'ZodIntersection';
  ZodFirstPartyTypeKind2['ZodTuple'] = 'ZodTuple';
  ZodFirstPartyTypeKind2['ZodRecord'] = 'ZodRecord';
  ZodFirstPartyTypeKind2['ZodMap'] = 'ZodMap';
  ZodFirstPartyTypeKind2['ZodSet'] = 'ZodSet';
  ZodFirstPartyTypeKind2['ZodFunction'] = 'ZodFunction';
  ZodFirstPartyTypeKind2['ZodLazy'] = 'ZodLazy';
  ZodFirstPartyTypeKind2['ZodLiteral'] = 'ZodLiteral';
  ZodFirstPartyTypeKind2['ZodEnum'] = 'ZodEnum';
  ZodFirstPartyTypeKind2['ZodEffects'] = 'ZodEffects';
  ZodFirstPartyTypeKind2['ZodNativeEnum'] = 'ZodNativeEnum';
  ZodFirstPartyTypeKind2['ZodOptional'] = 'ZodOptional';
  ZodFirstPartyTypeKind2['ZodNullable'] = 'ZodNullable';
  ZodFirstPartyTypeKind2['ZodDefault'] = 'ZodDefault';
  ZodFirstPartyTypeKind2['ZodCatch'] = 'ZodCatch';
  ZodFirstPartyTypeKind2['ZodPromise'] = 'ZodPromise';
  ZodFirstPartyTypeKind2['ZodBranded'] = 'ZodBranded';
  ZodFirstPartyTypeKind2['ZodPipeline'] = 'ZodPipeline';
  ZodFirstPartyTypeKind2['ZodReadonly'] = 'ZodReadonly';
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (
  cls,
  params = {
    message: `Input not instance of ${cls.name}`,
  }
) => custom(data => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: arg => ZodString.create({ ...arg, coerce: true }),
  number: arg => ZodNumber.create({ ...arg, coerce: true }),
  boolean: arg =>
    ZodBoolean.create({
      ...arg,
      coerce: true,
    }),
  bigint: arg => ZodBigInt.create({ ...arg, coerce: true }),
  date: arg => ZodDate.create({ ...arg, coerce: true }),
};
var NEVER = INVALID;

// src/lib/schemas.ts
var NODE_SCHEMA_VERSION = 2;
var CaptureTriggerSchema = external_exports.enum(['stop', 'session_end', 'pre_compact', 'manual']);
var ProposalStatusSchema = external_exports.enum(['pending', 'done', 'failed', 'skipped']);
var SessionLogFrontmatterSchema = external_exports.object({
  schema_version: external_exports.literal(1),
  session_id: external_exports.string(),
  captured_by: CaptureTriggerSchema,
  captured_at: external_exports.string(),
  transcript_hash: external_exports.string(),
  proposal_status: ProposalStatusSchema,
  proposal_completed_at: external_exports.string().nullable(),
  proposal_error: external_exports.string().nullable(),
  proposal_log: external_exports.string().nullable(),
  proposals: external_exports.object({
    practice: external_exports.array(external_exports.unknown()),
    map: external_exports.array(external_exports.unknown()),
  }),
});
var ConfidenceSchema = external_exports.enum(['low', 'medium', 'high']);
var ModelFamilySchema = external_exports.enum(['haiku', 'sonnet', 'opus']);
var EffortLevelSchema = external_exports.enum(['low', 'medium', 'high', 'xhigh', 'max']);
var ClaudeModelChoiceSchema = external_exports
  .object({
    harness: external_exports.literal('claude'),
    name: ModelFamilySchema,
    effort: EffortLevelSchema,
  })
  .strict();
var CodexModelChoiceSchema = external_exports
  .object({
    harness: external_exports.literal('codex'),
    model: external_exports.string().min(1),
    reasoningEffort: external_exports.string().min(1).optional(),
  })
  .strict();
var OpenCodeModelChoiceSchema = external_exports
  .object({
    harness: external_exports.literal('opencode'),
    model: external_exports.string().min(1),
    agent: external_exports.string().min(1).optional(),
  })
  .strict();
var CursorModelChoiceSchema = external_exports
  .object({
    harness: external_exports.literal('cursor'),
    model: external_exports.string().min(1),
  })
  .strict();
var CopilotModelChoiceSchema = external_exports
  .object({
    harness: external_exports.literal('copilot'),
    model: external_exports.string().min(1),
  })
  .strict();
var ModelChoiceSchema = external_exports.discriminatedUnion('harness', [
  ClaudeModelChoiceSchema,
  CodexModelChoiceSchema,
  OpenCodeModelChoiceSchema,
  CursorModelChoiceSchema,
  CopilotModelChoiceSchema,
]);
var ProposalCandidateSchema = external_exports
  .object({
    kind: external_exports.enum(['practice', 'map']),
    tags: external_exports.array(external_exports.string()),
    title: external_exports.string(),
    summary: external_exports.string(),
    body: external_exports.string(),
    confidence: ConfidenceSchema,
  })
  .strict();
var ProposalOutputSchema = external_exports.object({
  practice: external_exports.array(ProposalCandidateSchema),
  map: external_exports.array(ProposalCandidateSchema),
});
var StateFileSchema = external_exports.object({
  schema_version: external_exports.literal(1),
  last_nudged_at: external_exports.string().nullable().optional(),
});
var LintStateFileSchema = external_exports.object({
  schema_version: external_exports.literal(1),
  sessions_since_last_lint: external_exports.number().int().nonnegative(),
  last_lint_at: external_exports.string().nullable(),
  last_errors: external_exports.number().int().nonnegative(),
  last_findings: external_exports.number().int().nonnegative(),
});
var UsageRecordSchema = external_exports.object({
  document: external_exports.string(),
  type: external_exports.enum(['leaf', 'index']),
  session_id: external_exports.string(),
  used_at: external_exports.string(),
});
var NodeKindSchema = external_exports.enum(['practice', 'map']);
var NodeFrontmatterSchema = external_exports.object({
  schema_version: external_exports.literal(NODE_SCHEMA_VERSION),
  id: external_exports.string(),
  title: external_exports.string(),
  kind: NodeKindSchema,
  tags: external_exports.array(external_exports.string()),
  derived_from: external_exports.array(external_exports.string()),
  relates_to: external_exports.array(external_exports.string()),
  // Cross-tree edges resolved by id. `relates_to` is a loose association;
  // `depends_on` records that this node genuinely depends on another. Both are
  // rendered in GRAPH.md and dangling-checked by lint. Defaulted so nodes
  // written before the field existed still parse.
  depends_on: external_exports.array(external_exports.string()).default([]),
  confidence: ConfidenceSchema,
  summary: external_exports.string(),
});
var CuratorProposedNodeSchema = external_exports
  .object({
    title: external_exports.string(),
    kind: NodeKindSchema,
    tags: external_exports.array(external_exports.string()),
    summary: external_exports.string(),
    body: external_exports.string(),
    confidence: ConfidenceSchema,
    relates_to: external_exports.array(external_exports.string()),
    depends_on: external_exports.array(external_exports.string()).default([]),
  })
  .strict();
var CuratorActionSchema = external_exports.object({
  action: external_exports.enum(['add', 'modify', 'contradict', 'drop']),
  candidate_origin: external_exports.string(),
  target_node_id: external_exports.string().nullable(),
  proposed_node: CuratorProposedNodeSchema.nullable(),
  rationale: external_exports.string(),
  /**
   * Chosen existing folder relative to `nodes/` for a new-leaf `add` (the home
   * branch picked by the relate ranking). Absent, null, or empty selects the
   * `nodes/` root fallback. Placement is presentation only and never changes the
   * node id; `modify`, `contradict`, and `drop` actions never set it. The
   * writer's `--folder` guard owns traversal rejection, so this field only
   * carries the value through dedup.
   */
  home_folder: external_exports.string().nullable().optional(),
});
var CuratorOutputSchema = external_exports.array(CuratorActionSchema);
var IndexFrontmatterSchema = external_exports.object({
  schema_version: external_exports.literal(NODE_SCHEMA_VERSION),
  nodes_hash: external_exports.string(),
  node_count: external_exports.number().int().nonnegative(),
  /**
   * One-line, self-preserved folder description. The single non-deterministic
   * field on a generated index: `generateIndex` harvests the prior on-disk value
   * before regenerating and re-stamps it, so a folder's summary survives the
   * otherwise-total rebuild. It is authored only at the two quarantined LLM
   * clustering moments (v1->v2 migrate, rebalance split/create) or by hand;
   * deterministic code never invents or mutates it. Optional so a brand-new or
   * un-summarized folder (and any transitional file) still parses.
   */
  summary: external_exports.string().optional(),
});
var GraphFrontmatterSchema = external_exports.object({
  schema_version: external_exports.literal(NODE_SCHEMA_VERSION),
  nodes_hash: external_exports.string(),
  node_count: external_exports.number().int().nonnegative(),
});
var BootstrapCandidateSchema = external_exports
  .object({
    kind: external_exports.enum(['practice', 'map']),
    tags: external_exports.array(external_exports.string()),
    title: external_exports.string(),
    summary: external_exports.string(),
    body: external_exports.string(),
    confidence: ConfidenceSchema,
  })
  .strict();
var BootstrapOutputSchema = external_exports.object({
  practice: external_exports.array(BootstrapCandidateSchema),
  map: external_exports.array(BootstrapCandidateSchema),
});
var BootstrapDocEntrySchema = external_exports.object({
  content_sha256: external_exports.string(),
  last_processed_at: external_exports.string(),
  produced_nodes: external_exports.array(external_exports.string()),
});
var SettingsSchema = external_exports
  .object({
    schema_version: external_exports.literal(1),
    curationThreshold: external_exports.number().int().positive().optional(),
    logsRetentionDays: external_exports.number().int().positive().optional(),
    lintEveryNSessions: external_exports.number().int().positive().optional(),
    proposalModel: ModelChoiceSchema.optional(),
    curatorModel: ModelChoiceSchema.optional(),
    bootstrapModel: ModelChoiceSchema.optional(),
    /**
     * Default harness for plain-shell CLI invocations (e.g.
     * `npx kenkeep curate` from a terminal that is not inside
     * any assistant session). Skills and hooks always auto-resolve via
     * env detection (`CLAUDECODE=1`, `CLAUDE_PROJECT_DIR`, …) and do
     * NOT consult this setting — only the bare CLI fallback path does.
     *
     * Must match a registered harness adapter; the registry validates
     * this at use time. Omitted from `defaultProjectConfigBody` so
     * existing repos continue to default to the first registered
     * harness (`claude`).
     */
    cliDefaultHarness: external_exports.string().min(1).optional(),
  })
  .strict();
var BootstrapStateSchema = external_exports.object({
  schema_version: external_exports.literal(1),
  last_full_bootstrap_at: external_exports.string().nullable().optional(),
  last_incremental_at: external_exports.string().nullable().optional(),
  docs: external_exports.record(BootstrapDocEntrySchema),
});
var MemoryLedgerSchema = external_exports.object({
  schema_version: external_exports.literal(1),
  entries: external_exports.record(
    external_exports.string(),
    external_exports.object({
      sha256: external_exports.string(),
      lastSeenRunId: external_exports.string(),
      lastSeenAt: external_exports.string(),
    })
  ),
});

// src/lib/settings.ts
var CURSORY_MAX_USER_TURNS = 1;
var CURSORY_MAX_USER_CHARS = 200;
var CURSORY_MAX_AGENT_CHARS = 500;

// src/lib/transcript-render.ts
init_cjs_shims();
var SELF_REVIEW_APPLY_TRIGGER = /^\s*\/self-review-apply\s+(\S+\.xml)\s*$/;
function renderRoleTagged(t) {
  const segs = t.interleaved;
  const lines = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg) continue;
    if (seg.role === 'user') {
      const match = SELF_REVIEW_APPLY_TRIGGER.exec(seg.text);
      if (match) {
        const path = match[1];
        lines.push(`[USER /self-review-apply ${path}]: ${seg.text}`);
        const next = segs[i + 1];
        if (next && next.role === 'agent') {
          lines.push(`[AGENT NARRATION OF SELF-REVIEW ${path}]: ${next.text}`);
          i += 1;
        }
        continue;
      }
      lines.push(`[USER]: ${seg.text}`);
    } else {
      lines.push(`[AGENT]: ${seg.text}`);
    }
  }
  return lines.join('\n\n');
}

// src/lib/usage.ts
init_cjs_shims();
var import_node_fs4 = require('fs');
var import_node_path4 = require('path');
var import_proper_lockfile = __toESM(require_proper_lockfile(), 1);

// src/lib/fs-atomic.ts
init_cjs_shims();
var import_node_fs3 = require('fs');
var import_node_path3 = require('path');
function atomicWriteFile(file, content) {
  (0, import_node_fs3.mkdirSync)((0, import_node_path3.dirname)(file), { recursive: true });
  const tmp = `${file}.tmp`;
  (0, import_node_fs3.writeFileSync)(tmp, content);
  (0, import_node_fs3.renameSync)(tmp, file);
}

// src/lib/usage.ts
var USAGE_LOCK_OPTIONS = {
  stale: 30 * 1e3,
  realpath: false,
  retries: { retries: 15, factor: 1.4, minTimeout: 25, maxTimeout: 250 },
};
function safeResolve(p) {
  try {
    return (0, import_node_fs4.realpathSync)((0, import_node_path4.resolve)(p));
  } catch {
    return (0, import_node_path4.resolve)(p);
  }
}
function resolveCandidatePath(readPath, kkDir) {
  if ((0, import_node_path4.isAbsolute)(readPath)) return readPath;
  const normalized = readPath.split(import_node_path4.sep).join('/');
  if (normalized === 'nodes' || normalized.startsWith('nodes/')) {
    return (0, import_node_path4.resolve)(kkDir, readPath);
  }
  if (normalized === '.ai/kenkeep/nodes' || normalized.startsWith('.ai/kenkeep/nodes/')) {
    return (0, import_node_path4.resolve)(
      (0, import_node_path4.dirname)((0, import_node_path4.dirname)(kkDir)),
      readPath
    );
  }
  return readPath;
}
function classifyRead(readPath, nodesDir, kkDir) {
  if (!readPath) return null;
  const node = safeResolve(resolveCandidatePath(readPath, kkDir));
  const root = safeResolve(nodesDir);
  if (node !== root && !node.startsWith(root + import_node_path4.sep)) return null;
  if (!node.endsWith('.md')) return null;
  if ((0, import_node_path4.basename)(node) === 'index.md') {
    const rel = (0, import_node_path4.relative)(safeResolve(kkDir), node)
      .split(import_node_path4.sep)
      .join('/');
    return { document: rel, type: 'index' };
  }
  return { document: (0, import_node_path4.basename)(node).slice(0, -'.md'.length), type: 'leaf' };
}
async function reconcileUsage(usageFile, sessionId, usedAt, reads) {
  if (reads.length === 0) return;
  const observed = /* @__PURE__ */ new Map();
  for (const r of reads) {
    const entry = observed.get(r.document);
    if (entry) entry.count += 1;
    else observed.set(r.document, { type: r.type, count: 1 });
  }
  (0, import_node_fs4.mkdirSync)((0, import_node_path4.dirname)(usageFile), { recursive: true });
  (0, import_node_fs4.writeFileSync)(usageFile, '', { flag: 'a' });
  const release = await import_proper_lockfile.default.lock(usageFile, USAGE_LOCK_OPTIONS);
  try {
    const raw = (0, import_node_fs4.existsSync)(usageFile)
      ? (0, import_node_fs4.readFileSync)(usageFile, 'utf8')
      : '';
    const lines = raw.split('\n').filter(line => line.trim().length > 0);
    const existing = /* @__PURE__ */ new Map();
    for (const line of lines) {
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      if (rec.session_id === sessionId && typeof rec.document === 'string') {
        existing.set(rec.document, (existing.get(rec.document) ?? 0) + 1);
      }
    }
    const appended = [];
    for (const [document2, { type, count }] of observed) {
      const delta = Math.max(0, count - (existing.get(document2) ?? 0));
      for (let i = 0; i < delta; i += 1) {
        appended.push(
          JSON.stringify({ document: document2, type, session_id: sessionId, used_at: usedAt })
        );
      }
    }
    if (appended.length === 0) return;
    atomicWriteFile(
      usageFile,
      `${[...lines, ...appended].join('\n')}
`
    );
  } finally {
    await release();
  }
}
async function recordUsage(opts) {
  const reads = opts.readPaths
    .map(p => classifyRead(p, opts.nodesDir, opts.kkDir))
    .filter(r => r !== null);
  await reconcileUsage(opts.usageFile, opts.sessionId, opts.usedAt, reads);
}

// src/lib/capture.ts
var PRIVATE_SPAN_PLACEHOLDER = '[kk-private removed]';
function stripPrivateSpans(text) {
  return text
    .replace(/<kk-private>[\s\S]*?<\/kk-private>/g, PRIVATE_SPAN_PLACEHOLDER)
    .replace(/<kk-private>[\s\S]*$/, PRIVATE_SPAN_PLACEHOLDER);
}
async function captureSession(input, ctx) {
  const trigger = input.trigger ?? 'stop';
  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !(0, import_node_fs5.existsSync)(transcriptPath)) {
    return {
      status: 'no-transcript',
      error: `transcript_path missing or absent: ${transcriptPath ?? '(none)'}`,
    };
  }
  const transcriptText = (0, import_node_fs5.readFileSync)(transcriptPath, 'utf8');
  const parsed = ctx.parseTranscript(transcriptText);
  for (const seg of parsed.interleaved) {
    seg.text = stripPrivateSpans(seg.text);
  }
  const slice = renderRoleTagged(parsed);
  if (!slice.trim()) {
    return { status: 'no-content' };
  }
  const hash = `sha256:${(0, import_node_crypto.createHash)('sha256').update(slice).digest('hex')}`;
  const capturedAt = (ctx.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
  const sessionId = input.session_id;
  const existingFilename = findSessionLogBySessionId(ctx.sessionsDir, sessionId);
  const filename = existingFilename ?? buildSessionLogFilename(capturedAt, sessionId);
  let userTurns = 0;
  let userChars = 0;
  let agentChars = 0;
  for (const seg of parsed.interleaved) {
    if (seg.role === 'user') {
      userTurns += 1;
      userChars += seg.text.length;
    } else if (seg.role === 'agent') {
      agentChars += seg.text.length;
    }
  }
  const isCursory =
    userTurns <= CURSORY_MAX_USER_TURNS &&
    userChars <= CURSORY_MAX_USER_CHARS &&
    agentChars <= CURSORY_MAX_AGENT_CHARS;
  let curatedPreserve;
  if (existingFilename) {
    const existingPath = (0, import_node_path5.join)(ctx.sessionsDir, existingFilename);
    try {
      const parsed2 = (0, import_gray_matter.default)(
        (0, import_node_fs5.readFileSync)(existingPath, 'utf8')
      );
      const data = parsed2.data;
      if (
        typeof data['curator_processed_at'] === 'string' &&
        data['curator_processed_at'].length > 0
      ) {
        const preserve = {
          curatorProcessedAt: data['curator_processed_at'],
        };
        if (typeof data['curator_run_id'] === 'string') {
          preserve.curatorRunId = data['curator_run_id'];
        }
        if (typeof data['proposal_status'] === 'string') {
          preserve.proposalStatus = data['proposal_status'];
        }
        if (data['proposal_completed_at'] !== void 0) {
          preserve.proposalCompletedAt = data['proposal_completed_at'];
        }
        if (data['proposal_error'] !== void 0) {
          preserve.proposalError = data['proposal_error'];
        }
        if (data['proposals'] && typeof data['proposals'] === 'object') {
          const proposals = data['proposals'];
          preserve.proposals = {
            practice: Array.isArray(proposals.practice) ? proposals.practice : [],
            map: Array.isArray(proposals.map) ? proposals.map : [],
          };
        }
        if (Array.isArray(data['topics'])) {
          preserve.topics = data['topics'];
        }
        curatedPreserve = preserve;
      }
    } catch {}
  }
  const curatedInput = curatedPreserve
    ? {
        ...(curatedPreserve.proposalStatus !== void 0
          ? { proposalStatus: curatedPreserve.proposalStatus }
          : {}),
        ...(curatedPreserve.proposalCompletedAt !== void 0
          ? { proposalCompletedAt: curatedPreserve.proposalCompletedAt }
          : {}),
        ...(curatedPreserve.proposalError !== void 0
          ? { proposalError: curatedPreserve.proposalError }
          : {}),
        ...(curatedPreserve.proposals !== void 0 ? { proposals: curatedPreserve.proposals } : {}),
        curatorProcessedAt: curatedPreserve.curatorProcessedAt,
        ...(curatedPreserve.curatorRunId !== void 0
          ? { curatorRunId: curatedPreserve.curatorRunId }
          : {}),
        ...(curatedPreserve.topics !== void 0 ? { topics: curatedPreserve.topics } : {}),
      }
    : isCursory
      ? {
          proposalStatus: 'skipped',
          proposalError: 'cursory_session',
          proposalCompletedAt: capturedAt,
        }
      : {};
  const body = renderSessionLog({
    sessionId,
    capturedBy: trigger,
    capturedAt,
    transcriptHash: hash,
    body: slice,
    ...curatedInput,
  });
  const sessionLogPath = writeSessionLog(ctx.sessionsDir, filename, body);
  if (ctx.usage) {
    try {
      const readPaths =
        ctx.usage.readPaths ??
        (ctx.usage.extractReads ? ctx.usage.extractReads(transcriptText) : []);
      if (readPaths.length > 0) {
        await recordUsage({
          usageFile: ctx.usage.usageFile,
          nodesDir: ctx.usage.nodesDir,
          kkDir: ctx.usage.kkDir,
          sessionId,
          usedAt: capturedAt,
          readPaths,
        });
      }
    } catch (err) {
      process.stderr.write(
        `[kenkeep] usage tracking skipped: ${err instanceof Error ? err.message : String(err)}
`
      );
    }
  }
  return {
    status: 'written',
    sessionLogPath,
  };
}

// src/lib/hook-entry.ts
init_cjs_shims();

// src/lib/async-launcher.ts
init_cjs_shims();
var import_node_child_process = require('child_process');
var LAUNCHER_CHILD_ENV = 'KENKEEP_ASYNC_LAUNCHER_CHILD';
var LAUNCHER_PAYLOAD_ENV = 'KENKEEP_HOOK_PAYLOAD';
var LAUNCHER_STDIN_DEADLINE_MS = 250;
function isLauncherChild(env = process.env) {
  return env[LAUNCHER_CHILD_ENV] === '1';
}
function launcherPayload(env = process.env) {
  return env[LAUNCHER_PAYLOAD_ENV] ?? '';
}
function launchDetachedWorker(rawPayload) {
  const script = process.argv[1];
  if (!script) return false;
  const child = (0, import_node_child_process.spawn)(process.execPath, [script], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, [LAUNCHER_CHILD_ENV]: '1', [LAUNCHER_PAYLOAD_ENV]: rawPayload },
  });
  child.unref();
  return true;
}

// src/lib/hook-diagnostic.ts
init_cjs_shims();
var import_node_fs6 = require('fs');
var import_node_path6 = require('path');
function appendHookDiagnostic(hook, phase, error, logsDir) {
  try {
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const ts = now.toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const line = JSON.stringify({ ts, hook, phase, error: errorMessage }) + '\n';
    (0, import_node_fs6.mkdirSync)(logsDir, { recursive: true });
    (0, import_node_fs6.appendFileSync)(
      (0, import_node_path6.join)(logsDir, `hook-errors-${dateStr}.log`),
      line,
      'utf8'
    );
  } catch {}
}

// src/lib/paths.ts
init_cjs_shims();
var import_node_fs7 = require('fs');
var import_node_path7 = require('path');
var import_node_url = require('url');
function findRepoRoot(from = process.cwd()) {
  let cur = (0, import_node_path7.resolve)(from);
  while (true) {
    if (
      (0, import_node_fs7.existsSync)((0, import_node_path7.join)(cur, '.git')) ||
      (0, import_node_fs7.existsSync)(
        (0, import_node_path7.join)(cur, '.ai/kenkeep/.state/installed-version')
      )
    ) {
      return cur;
    }
    const parent = (0, import_node_path7.dirname)(cur);
    if (parent === cur) return (0, import_node_path7.resolve)(from);
    cur = parent;
  }
}
function repoPaths(root) {
  const aiDir = (0, import_node_path7.join)(root, '.ai');
  const kkDir = (0, import_node_path7.join)(aiDir, 'kenkeep');
  const stateDir = (0, import_node_path7.join)(kkDir, '.state');
  const configDir = (0, import_node_path7.join)(kkDir, '.config');
  const promptsDir = (0, import_node_path7.join)(configDir, 'prompts');
  return {
    root,
    aiDir,
    kkDir,
    stateDir,
    configDir,
    promptsDir,
    installedVersionFile: (0, import_node_path7.join)(stateDir, 'installed-version'),
    projectConfigFile: (0, import_node_path7.join)(kkDir, 'config.yaml'),
    sessionsDir: (0, import_node_path7.join)(kkDir, '_sessions'),
    logsDir: (0, import_node_path7.join)(kkDir, '_logs'),
    nodesDir: (0, import_node_path7.join)(kkDir, 'nodes'),
    conflictsDir: (0, import_node_path7.join)(kkDir, 'conflicts'),
    kkGitignoreFile: (0, import_node_path7.join)(kkDir, '.gitignore'),
    memoryLedgerFile: (0, import_node_path7.join)(stateDir, 'memory-ledger.json'),
    usageFile: (0, import_node_path7.join)(stateDir, 'usage.jsonl'),
  };
}

// src/lib/stdin.ts
init_cjs_shims();
function readStdin(options2 = {}) {
  return new Promise(resolve3 => {
    if (process.stdin.isTTY) {
      resolve3('');
      return;
    }
    let data = '';
    let settled = false;
    let timer;
    const finish = value => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      process.stdin.pause();
      resolve3(value);
    };
    if (options2.deadlineMs !== void 0) {
      timer = setTimeout(() => finish(data), options2.deadlineMs);
      timer.unref();
    }
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => finish(data));
    process.stdin.on('error', () => finish(''));
  });
}

// src/lib/hook-entry.ts
function runHookEntry(options2) {
  const { tag, deadlineMs, asyncLauncher = false, requirePayload = false, main } = options2;
  async function run() {
    if (process.env['KENKEEP_BUILDER_INTERNAL'] === '1') return;
    if (deadlineMs !== void 0) {
      const deadline = setTimeout(() => {
        try {
          const paths = repoPaths(findRepoRoot(process.cwd()));
          appendHookDiagnostic(
            tag,
            'deadline',
            new Error('hook hard deadline reached; work abandoned'),
            paths.logsDir
          );
        } catch {}
        process.exit(0);
      }, deadlineMs);
      deadline.unref();
    }
    let raw;
    if (asyncLauncher) {
      if (isLauncherChild()) {
        raw = launcherPayload();
      } else {
        const captured = await readStdin({ deadlineMs: LAUNCHER_STDIN_DEADLINE_MS });
        if (launchDetachedWorker(captured)) {
          process.exit(0);
        }
        raw = captured;
      }
    } else {
      raw = await readStdin();
    }
    if (requirePayload && raw.trim().length === 0) return;
    let payload = {};
    if (raw.trim().length > 0) {
      try {
        payload = JSON.parse(raw);
      } catch (err) {
        const paths = repoPaths(findRepoRoot(process.cwd()));
        appendHookDiagnostic(tag, 'parse', err, paths.logsDir);
        if (requirePayload) return;
      }
    }
    await main(payload, raw);
  }
  void run().catch(err => {
    try {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic(tag, 'uncaught', err, paths.logsDir);
    } catch {}
    process.exit(0);
  });
}

// src/harnesses/codex/transcript.ts
init_cjs_shims();
function extractMessageText(line) {
  const blocks = line.payload?.content;
  if (!Array.isArray(blocks)) return '';
  return blocks
    .filter(b => !!b && typeof b === 'object')
    .filter(b => typeof b.type === 'string' && b.type.endsWith('_text'))
    .map(b => (typeof b.text === 'string' ? b.text : ''))
    .filter(s => s.length > 0)
    .join('\n');
}
function parseCodexTranscript(text) {
  const out = { interleaved: [] };
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      console.warn(`parseCodexTranscript: skipping malformed JSONL line: ${err.message}`);
      continue;
    }
    const kind = parsed.type;
    const payloadType = parsed.payload?.type;
    if (kind === 'session_meta') continue;
    if (kind === 'response_item' && payloadType === 'message') {
      const role = parsed.payload?.role;
      const turnText = extractMessageText(parsed);
      if (!turnText) continue;
      if (role === 'user') {
        out.interleaved.push({ role: 'user', text: turnText });
      } else if (role === 'assistant') {
        out.interleaved.push({ role: 'agent', text: turnText });
      }
      continue;
    }
    if (kind === 'event_msg' && payloadType === 'user_message') {
      const message = parsed.payload?.message;
      if (typeof message === 'string' && message.length > 0) {
        out.interleaved.push({ role: 'user', text: message });
      }
      continue;
    }
    if (kind === 'event_msg' && payloadType === 'task_complete') {
      const message = parsed.payload?.last_agent_message;
      if (typeof message !== 'string' || message.length === 0) continue;
      const last = out.interleaved[out.interleaved.length - 1];
      if (last && last.role === 'agent' && last.text === message) continue;
      out.interleaved.push({ role: 'agent', text: message });
      continue;
    }
  }
  return out;
}

// src/harnesses/read-extract.ts
init_cjs_shims();
var COMMAND_MD_CANDIDATE = /[^\s'"`|&;<>(){}=,]+\.md\b/g;
function extractCommandMarkdownCandidates(command) {
  if (typeof command !== 'string' || command.length === 0) return [];
  const out = [];
  COMMAND_MD_CANDIDATE.lastIndex = 0;
  let match;
  while ((match = COMMAND_MD_CANDIDATE.exec(command)) !== null) {
    out.push(match[0]);
  }
  return out;
}
function readStringField(input, key) {
  if (!input || typeof input !== 'object') return null;
  const value = input[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function firstStringField(input, keys) {
  for (const key of keys) {
    const value = readStringField(input, key);
    if (value !== null) return value;
  }
  return null;
}
function commandText(value) {
  if (typeof value === 'string') return value.length > 0 ? value : null;
  if (Array.isArray(value)) {
    const parts = value.filter(v => typeof v === 'string');
    if (parts.length > 0) return parts.join(' ');
  }
  return null;
}
function firstCommandField(input, keys) {
  if (!input || typeof input !== 'object') return null;
  const record = input;
  for (const key of keys) {
    const cmd = commandText(record[key]);
    if (cmd !== null) return cmd;
  }
  return null;
}
var CODEX_READ_TOOLS = /* @__PURE__ */ new Set(['read', 'read_file', 'view', 'open_file']);
var CODEX_COMMAND_TOOLS = /* @__PURE__ */ new Set([
  'shell',
  'exec_command',
  'local_shell',
  'container.exec',
]);
function extractCodexReads(text) {
  const out = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const payload = parsed.payload;
    if (!payload) continue;
    if (payload.type !== 'function_call' && payload.type !== 'tool_call') continue;
    if (typeof payload.name !== 'string') continue;
    if (CODEX_READ_TOOLS.has(payload.name)) {
      const args = parseArgs(payload.arguments);
      const path = firstStringField(args, ['path', 'file_path', 'filePath']);
      if (path !== null) out.push(path);
    } else if (CODEX_COMMAND_TOOLS.has(payload.name)) {
      const args = parseArgs(payload.arguments);
      const command = firstCommandField(args, ['command', 'cmd']);
      if (command !== null) out.push(...extractCommandMarkdownCandidates(command));
    }
  }
  return out;
}
function parseArgs(arg) {
  if (arg && typeof arg === 'object') return arg;
  if (typeof arg === 'string') {
    try {
      return JSON.parse(arg);
    } catch {
      return void 0;
    }
  }
  return void 0;
}

// src/harnesses/codex/hooks/kk-capture.ts
var PACKAGE_TAG = '[kenkeep]';
var CODEX_EVENT_TO_TRIGGER = {
  Stop: 'stop',
  PreCompact: 'pre_compact',
};
function triggerFor(payload) {
  const event = payload['event'] ?? payload['hook_event_name'];
  if (typeof event === 'string' && event in CODEX_EVENT_TO_TRIGGER) {
    return CODEX_EVENT_TO_TRIGGER[event];
  }
  return 'stop';
}
runHookEntry({
  tag: 'codex:kk-capture',
  deadlineMs: 1e3,
  requirePayload: true,
  main: async payload => {
    const startCwd =
      typeof payload['cwd'] === 'string' && payload['cwd'].length > 0
        ? payload['cwd']
        : process.cwd();
    const root = findRepoRoot(startCwd);
    const paths = repoPaths(root);
    try {
      const sessionId = assertValidSessionId(payload['session_id']);
      const homeRoot =
        process.env['CODEX_HOME'] ??
        (0, import_node_path8.join)((0, import_node_os.homedir)(), '.codex');
      const rolloutPath = locateRollout(homeRoot, sessionId);
      if (rolloutPath === null) {
        return;
      }
      const input = {
        session_id: sessionId,
        transcript_path: rolloutPath,
        trigger: triggerFor(payload),
        ...(typeof payload['cwd'] === 'string' ? { cwd: payload['cwd'] } : {}),
      };
      process.stderr.write('\u{1F4F8} kenkeep Capture: Saving session transcript\u2026\n');
      await captureSession(input, {
        sessionsDir: paths.sessionsDir,
        parseTranscript: parseCodexTranscript,
        usage: {
          nodesDir: paths.nodesDir,
          kkDir: paths.kkDir,
          usageFile: paths.usageFile,
          extractReads: extractCodexReads,
        },
      });
      process.stderr.write('\u{1F4BE} kenkeep Capture: Session transcript saved.\n');
    } catch (err) {
      process.stderr.write(
        `${PACKAGE_TAG} capture error: ${err instanceof Error ? err.message : String(err)}
`
      );
    }
  },
});
function locateRollout(homeRoot, sessionId) {
  const sessionsRoot = (0, import_node_path8.join)(homeRoot, 'sessions');
  if (!(0, import_node_fs8.existsSync)(sessionsRoot)) return null;
  const today = /* @__PURE__ */ new Date();
  const todayDir = sessionsDirForDate(sessionsRoot, today);
  const direct = findByFilename(todayDir, sessionId);
  if (direct !== null) return direct;
  const yesterday = new Date(today.getTime() - 864e5);
  const yesterdayDir = sessionsDirForDate(sessionsRoot, yesterday);
  const fromYesterday = findByFilename(yesterdayDir, sessionId);
  if (fromYesterday !== null) return fromYesterday;
  return findBySessionMeta(todayDir, sessionId);
}
function sessionsDirForDate(sessionsRoot, when) {
  const y = when.getUTCFullYear().toString();
  const m = String(when.getUTCMonth() + 1).padStart(2, '0');
  const d = String(when.getUTCDate()).padStart(2, '0');
  return (0, import_node_path8.join)(sessionsRoot, y, m, d);
}
function findByFilename(dir, sessionId) {
  if (!(0, import_node_fs8.existsSync)(dir)) return null;
  let entries;
  try {
    entries = (0, import_node_fs8.readdirSync)(dir);
  } catch {
    return null;
  }
  const suffix = `-${sessionId}.jsonl`;
  for (const name of entries) {
    if (name.startsWith('rollout-') && name.endsWith(suffix)) {
      return (0, import_node_path8.join)(dir, name);
    }
  }
  return null;
}
function findBySessionMeta(dir, sessionId) {
  if (!(0, import_node_fs8.existsSync)(dir)) return null;
  let entries;
  try {
    entries = (0, import_node_fs8.readdirSync)(dir);
  } catch {
    return null;
  }
  for (const name of entries) {
    if (!name.startsWith('rollout-') || !name.endsWith('.jsonl')) continue;
    const full = (0, import_node_path8.join)(dir, name);
    let firstLine;
    try {
      const text = (0, import_node_fs8.readFileSync)(full, 'utf8');
      const nl = text.indexOf('\n');
      firstLine = nl === -1 ? text : text.slice(0, nl);
    } catch {
      continue;
    }
    if (firstLine.length === 0) continue;
    try {
      const parsed = JSON.parse(firstLine);
      if (parsed.type === 'session_meta' && parsed.payload?.id === sessionId) {
        return full;
      }
    } catch {
      continue;
    }
  }
  return null;
}
// Annotate the CommonJS export names for ESM import in node:
0 &&
  (module.exports = {
    CODEX_EVENT_TO_TRIGGER,
  });
/*! Bundled license information:

is-extendable/index.js:
  (*!
   * is-extendable <https://github.com/jonschlinkert/is-extendable>
   *
   * Copyright (c) 2015, Jon Schlinkert.
   * Licensed under the MIT License.
   *)

strip-bom-string/index.js:
  (*!
   * strip-bom-string <https://github.com/jonschlinkert/strip-bom-string>
   *
   * Copyright (c) 2015, 2017, Jon Schlinkert.
   * Released under the MIT License.
   *)

js-yaml/dist/js-yaml.mjs:
  (*! js-yaml 4.2.0 https://github.com/nodeca/js-yaml @license MIT *)
*/
