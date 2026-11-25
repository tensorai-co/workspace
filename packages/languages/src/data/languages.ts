// Each language's files and editing rules: MIT (see NOTICE).

import type { LanguageDefinition } from '../definitions.js'

export const languageDefinitions: LanguageDefinition[] = [
 {
  "id": "bat",
  "aliases": [
   "Batch",
   "bat"
  ],
  "extensions": [
   ".bat",
   ".cmd"
  ],
  "rules": {
   "lineComment": "@REM ",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "%",
     "close": "%"
    },
    {
     "open": "\"",
     "close": "\""
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*(::|@?[Rr][Ee][Mm])\\s*#region"
    },
    "end": {
     "source": "^\\s*(::|@?[Rr][Ee][Mm])\\s*#endregion"
    }
   }
  }
 },
 {
  "id": "clojure",
  "aliases": [
   "Clojure",
   "clojure"
  ],
  "extensions": [
   ".clj",
   ".cljs",
   ".cljc",
   ".cljx",
   ".clojure",
   ".edn"
  ],
  "rules": {
   "lineComment": ";;",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    }
   ],
   "folding": {
    "offSide": true
   }
  }
 },
 {
  "id": "coffeescript",
  "aliases": [
   "CoffeeScript",
   "coffeescript",
   "coffee"
  ],
  "extensions": [
   ".coffee",
   ".cson",
   ".iced"
  ],
  "rules": {
   "lineComment": "#",
   "blockComment": {
    "open": "###",
    "close": "###"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": " ",
     "close": " "
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*#region\\b"
    },
    "end": {
     "source": "^\\s*#endregion\\b"
    },
    "offSide": true
   }
  }
 },
 {
  "id": "jsonc",
  "aliases": [
   "JSON with Comments"
  ],
  "extensions": [
   ".code-workspace",
   "language-configuration.json",
   "icon-theme.json",
   "color-theme.json",
   ".jsonc",
   ".eslintrc",
   ".eslintrc.json",
   ".jsfmtrc",
   ".jshintrc",
   ".swcrc",
   ".hintrc",
   ".babelrc",
   ".toolset.jsonc"
  ],
  "filenames": [
   "settings.json",
   "launch.json",
   "tasks.json",
   "mcp.json",
   "keybindings.json",
   "extensions.json",
   "argv.json",
   "profiles.json",
   "devcontainer.json",
   ".devcontainer.json",
   "babel.config.json",
   "bun.lock",
   ".babelrc.json",
   ".ember-cli",
   "typedoc.json",
   "tsconfig.json",
   "jsconfig.json"
  ],
  "filenamePatterns": [
   "**/.github/hooks/*.json",
   "tsconfig.*.json",
   "jsconfig.*.json",
   "tsconfig-*.json",
   "jsconfig-*.json"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "[",
     "close": "]",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "(",
     "close": ")",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "({+(?=((\\\\.|[^\"\\\\])*\"(\\\\.|[^\"\\\\])*\")*[^\"}]*)$)|(\\[+(?=((\\\\.|[^\"\\\\])*\"(\\\\.|[^\"\\\\])*\")*[^\"\\]]*)$)"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*[}\\]],?\\s*$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*//\\s*#?region\\b"
    },
    "end": {
     "source": "^\\s*//\\s*#?endregion\\b"
    }
   }
  }
 },
 {
  "id": "json",
  "aliases": [
   "JSON",
   "json"
  ],
  "extensions": [
   ".code-profile",
   ".json",
   ".bowerrc",
   ".jscsrc",
   ".webmanifest",
   ".js.map",
   ".css.map",
   ".ts.map",
   ".har",
   ".jslintrc",
   ".jsonld",
   ".geojson",
   ".ipynb",
   ".vuerc",
   ".tsbuildinfo"
  ],
  "filenames": [
   "composer.lock",
   ".watchmanconfig"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "[",
     "close": "]",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "(",
     "close": ")",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "({+(?=((\\\\.|[^\"\\\\])*\"(\\\\.|[^\"\\\\])*\")*[^\"}]*)$)|(\\[+(?=((\\\\.|[^\"\\\\])*\"(\\\\.|[^\"\\\\])*\")*[^\"\\]]*)$)"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*[}\\]],?\\s*$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*//\\s*#?region\\b"
    },
    "end": {
     "source": "^\\s*//\\s*#?endregion\\b"
    }
   }
  }
 },
 {
  "id": "ignore",
  "aliases": [
   "Ignore",
   "ignore"
  ],
  "extensions": [
   ".gitignore_global",
   ".gitignore",
   ".git-blame-ignore-revs",
   ".npmignore"
  ],
  "filenamePatterns": [
   ".copilotignore"
  ]
 },
 {
  "id": "markdown",
  "aliases": [
   "Markdown",
   "markdown"
  ],
  "extensions": [
   ".copilotmd",
   ".md",
   ".mkd",
   ".mkdn",
   ".mdwn",
   ".mdown",
   ".markdown",
   ".markdn",
   ".mdtxt",
   ".mdtext",
   ".litcoffee",
   ".ron",
   ".ronn",
   ".workbook"
  ],
  "filenamePatterns": [
   "**/.cursor/**/*.mdc"
  ],
  "rules": {
   "blockComment": {
    "open": "<!--",
    "close": "-->"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "_",
     "close": "_"
    },
    {
     "open": "*",
     "close": "*"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "~",
     "close": "~"
    },
    {
     "open": "$",
     "close": "$"
    }
   ],
   "wordPattern": {
    "source": "(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})(((\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})|[_])?(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark}))*",
    "flags": "ug"
   },
   "folding": {
    "start": {
     "source": "^\\s*<!--\\s*#?region\\b\\s*(?<label>.*?)\\s*-->"
    },
    "end": {
     "source": "^\\s*<!--\\s*#?endregion\\b.*-->"
    },
    "offSide": true
   }
  }
 },
 {
  "id": "c",
  "aliases": [
   "C",
   "c"
  ],
  "extensions": [
   ".c",
   ".i"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "/*",
     "close": "*/",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "/**",
     "close": " */",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\#\\%\\^\\&\\*\\(\\)\\-\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\?\\s]+)"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^.*(\\{[^}]*|\\([^)]*|\\[[^\\]]*)$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*[\\}\\]\\)].*$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s+([^{i\\s]|i(?!f\\b))"
     },
     "previousLineText": {
      "source": "^\\s*(((else ?)?if|for|while)\\s*\\(.*\\)\\s*|else\\s*)$"
     },
     "action": {
      "indent": "outdent"
     }
    },
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*#\\s*pragma\\s+region\\b"
    },
    "end": {
     "source": "^\\s*#\\s*pragma\\s+endregion\\b"
    }
   }
  }
 },
 {
  "id": "cpp",
  "aliases": [
   "C++",
   "Cpp",
   "cpp"
  ],
  "extensions": [
   ".cpp",
   ".cppm",
   ".cc",
   ".ccm",
   ".cxx",
   ".cxxm",
   ".c++",
   ".c++m",
   ".hpp",
   ".hh",
   ".hxx",
   ".h++",
   ".h",
   ".ii",
   ".ino",
   ".inl",
   ".ipp",
   ".ixx",
   ".mpp",
   ".mxx",
   ".tpp",
   ".txx",
   ".hpp.in",
   ".h.in"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "/*",
     "close": "*/",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "/**",
     "close": " */",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\#\\%\\^\\&\\*\\(\\)\\-\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\?\\s]+)"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^.*(\\{[^}]*|\\([^)]*|\\[[^\\]]*)$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*[\\}\\]\\)].*$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s+([^{i\\s]|i(?!f\\b))"
     },
     "previousLineText": {
      "source": "^\\s*(((else ?)?if|for|while)\\s*\\(.*\\)\\s*|else\\s*)$"
     },
     "action": {
      "indent": "outdent"
     }
    },
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*#\\s*pragma\\s+region\\b"
    },
    "end": {
     "source": "^\\s*#\\s*pragma\\s+endregion\\b"
    }
   }
  }
 },
 {
  "id": "cuda-cpp",
  "aliases": [
   "CUDA C++"
  ],
  "extensions": [
   ".cu",
   ".cuh"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "/*",
     "close": "*/",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "/**",
     "close": " */",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\#\\%\\^\\&\\*\\(\\)\\-\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\?\\s]+)"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^.*(\\{[^}]*|\\([^)]*|\\[[^\\]]*)$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*[\\}\\]\\)].*$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s+([^{i\\s]|i(?!f\\b))"
     },
     "previousLineText": {
      "source": "^\\s*(((else ?)?if|for|while)\\s*\\(.*\\)\\s*|else\\s*)$"
     },
     "action": {
      "indent": "outdent"
     }
    },
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*#\\s*pragma\\s+region\\b"
    },
    "end": {
     "source": "^\\s*#\\s*pragma\\s+endregion\\b"
    }
   }
  }
 },
 {
  "id": "csharp",
  "aliases": [
   "C#",
   "csharp"
  ],
  "extensions": [
   ".cs",
   ".csx",
   ".cake"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    }
   ],
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*///"
     },
     "action": {
      "indent": "none",
      "appendText": "/// "
     }
    },
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*#region\\b"
    },
    "end": {
     "source": "^\\s*#endregion\\b"
    }
   }
  }
 },
 {
  "id": "css",
  "aliases": [
   "CSS",
   "css"
  ],
  "extensions": [
   ".css"
  ],
  "rules": {
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "[",
     "close": "]",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "(",
     "close": ")",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "wordPattern": {
    "source": "(#?-?\\d*\\.\\d\\w*%?)|(::?[\\w-]*(?=[^,{;]*[,{]))|(([@#.!])?[\\w-?]+%?|[@#!.])"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "(^.*\\{[^}]*$)"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*\\}"
    }
   },
   "folding": {
    "start": {
     "source": "^\\s*\\/\\*\\s*#region\\b\\s*(?<label>.*?)\\s*\\*\\/"
    },
    "end": {
     "source": "^\\s*\\/\\*\\s*#endregion\\b.*\\*\\/"
    }
   }
  }
 },
 {
  "id": "dart",
  "aliases": [
   "Dart"
  ],
  "extensions": [
   ".dart"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "/**",
     "close": " */",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "`",
     "close": "`"
    }
   ]
  }
 },
 {
  "id": "diff",
  "aliases": [
   "Diff",
   "diff"
  ],
  "extensions": [
   ".diff",
   ".patch",
   ".rej"
  ],
  "rules": {
   "lineComment": "#",
   "blockComment": {
    "open": "#",
    "close": " "
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ]
  }
 },
 {
  "id": "dockerfile",
  "aliases": [
   "Docker",
   "Dockerfile",
   "Containerfile"
  ],
  "extensions": [
   ".dockerfile",
   ".containerfile"
  ],
  "filenames": [
   "Dockerfile",
   "Containerfile"
  ],
  "filenamePatterns": [
   "Dockerfile.*",
   "Containerfile.*"
  ],
  "rules": {
   "lineComment": "#",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^\\s*.*(:|-) ?(&amp;\\w+)?(\\{[^}\"']*|\\([^)\"']*)?$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s+\\}$"
    }
   }
  }
 },
 {
  "id": "dotenv",
  "aliases": [
   "Dotenv"
  ],
  "extensions": [
   ".env"
  ],
  "filenames": [
   ".env",
   ".flaskenv",
   "user-dirs.dirs"
  ],
  "filenamePatterns": [
   ".env.*"
  ],
  "rules": {
   "lineComment": "#",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ]
  }
 },
 {
  "id": "fsharp",
  "aliases": [
   "F#",
   "FSharp",
   "fsharp"
  ],
  "extensions": [
   ".fs",
   ".fsi",
   ".fsx",
   ".fsscript"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "(*",
    "close": "*)"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*//\\s*#region\\b|^\\s*\\(\\*\\s*#region\\s*(?<label>.*?)\\s*\\*\\)"
    },
    "end": {
     "source": "^\\s*//\\s*#endregion\\b|^\\s*\\(\\*\\s*#endregion\\s*\\*\\)"
    },
    "offSide": true
   }
  }
 },
 {
  "id": "git-commit",
  "aliases": [
   "Git Commit Message",
   "git-commit"
  ],
  "filenames": [
   "COMMIT_EDITMSG",
   "MERGE_MSG"
  ]
 },
 {
  "id": "git-rebase",
  "aliases": [
   "Git Rebase Message",
   "git-rebase"
  ],
  "filenames": [
   "git-rebase-todo"
  ],
  "filenamePatterns": [
   "**/rebase-merge/done"
  ]
 },
 {
  "id": "go",
  "aliases": [
   "Go"
  ],
  "extensions": [
   ".go"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "`",
     "close": "`"
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^.*(\\bcase\\b.*:|\\bdefault\\b:|(\\b(func|if|else|switch|select|for|struct)\\b.*)?{[^}\"'`]*|\\([^)\"'`]*)$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*(\\bcase\\b.*:|\\bdefault\\b:|}[)}]*[)]?|\\)[]?)$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*//\\s*#?region\\b"
    },
    "end": {
     "source": "^\\s*//\\s*#?endregion\\b"
    }
   }
  }
 },
 {
  "id": "groovy",
  "aliases": [
   "Groovy",
   "groovy"
  ],
  "extensions": [
   ".groovy",
   ".gvy",
   ".gradle",
   ".jenkinsfile",
   ".nf"
  ],
  "filenames": [
   "Jenkinsfile"
  ],
  "filenamePatterns": [
   "Jenkinsfile*"
  ],
  "firstLine": "^#!.*\\bgroovy\\b",
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ]
  }
 },
 {
  "id": "handlebars",
  "aliases": [
   "Handlebars",
   "handlebars"
  ],
  "extensions": [
   ".handlebars",
   ".hbs",
   ".hjs"
  ],
  "rules": {
   "blockComment": {
    "open": "{{!--",
    "close": "--}}"
   },
   "brackets": [
    {
     "open": "<!--",
     "close": "-->"
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "{{",
     "close": "}}"
    },
    {
     "open": "{{{",
     "close": "}}}"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    }
   ],
   "surroundingPairs": [
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "{",
     "close": "}"
    }
   ],
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\$\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\s]+)"
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "<(?!(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!\\/)>)[^<]*$",
      "flags": "i"
     },
     "afterText": {
      "source": "^<\\/([_:\\w][_:\\w-.\\d]*)\\s*>",
      "flags": "i"
     },
     "action": {
      "indent": "indentOutdent"
     }
    },
    {
     "beforeText": {
      "source": "<(?!(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr))(\\w[\\w\\d]*)([^/>]*(?!\\/)>)[^<]*$",
      "flags": "i"
     },
     "action": {
      "indent": "indent"
     }
    }
   ]
  }
 },
 {
  "id": "hlsl",
  "aliases": [
   "HLSL",
   "hlsl"
  ],
  "extensions": [
   ".hlsl",
   ".hlsli",
   ".fx",
   ".fxh",
   ".vsh",
   ".psh",
   ".cginc",
   ".compute"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    }
   ]
  }
 },
 {
  "id": "html",
  "aliases": [
   "HTML",
   "htm",
   "html",
   "xhtml"
  ],
  "extensions": [
   ".html",
   ".htm",
   ".shtml",
   ".xhtml",
   ".xht",
   ".mdoc",
   ".jsp",
   ".asp",
   ".aspx",
   ".jshtm",
   ".volt",
   ".ejs",
   ".rhtml"
  ],
  "rules": {
   "blockComment": {
    "open": "<!--",
    "close": "-->"
   },
   "brackets": [
    {
     "open": "<!--",
     "close": "-->"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "<!--",
     "close": "-->",
     "notIn": [
      "comment",
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\$\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\s]+)"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "<(?!\\?|(?:area|base|br|col|frame|hr|html|img|input|keygen|link|menuitem|meta|param|source|track|wbr)\\b|[^>]*\\/>)([-_\\.A-Za-z0-9]+)(?=\\s|>)\\b[^>]*>(?!.*<\\/\\1>)|<!--(?!.*-->)|\\{[^}\"']*$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*(<\\/(?!html)[-_\\.A-Za-z0-9]+\\b[^>]*>|-->|\\})"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "<(?!(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr))([_:\\w][_:\\w-.\\d]*)(?:(?:[^'\"/>]|\"[^\"]*\"|'[^']*')*?(?!\\/)>)[^<]*$",
      "flags": "i"
     },
     "afterText": {
      "source": "^<\\/([_:\\w][_:\\w-.\\d]*)\\s*>",
      "flags": "i"
     },
     "action": {
      "indent": "indentOutdent"
     }
    },
    {
     "beforeText": {
      "source": "<(?!(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr))([_:\\w][_:\\w-.\\d]*)(?:(?:[^'\"/>]|\"[^\"]*\"|'[^']*')*?(?!\\/)>)[^<]*$",
      "flags": "i"
     },
     "action": {
      "indent": "indent"
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*<!--\\s*#region\\b\\s*(?<label>.*?)\\s*-->"
    },
    "end": {
     "source": "^\\s*<!--\\s*#endregion\\b.*-->"
    }
   }
  }
 },
 {
  "id": "ini",
  "aliases": [
   "Ini",
   "ini"
  ],
  "extensions": [
   ".ini"
  ],
  "rules": {
   "lineComment": ";",
   "blockComment": {
    "open": ";",
    "close": " "
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ]
  }
 },
 {
  "id": "properties",
  "aliases": [
   "Properties",
   "properties"
  ],
  "extensions": [
   ".conf",
   ".properties",
   ".cfg",
   ".directory",
   ".gitattributes",
   ".gitconfig",
   ".gitmodules",
   ".editorconfig",
   ".repo",
   ".npmrc"
  ],
  "filenames": [
   "gitconfig"
  ],
  "filenamePatterns": [
   "**/.config/git/config",
   "**/.git/config"
  ],
  "rules": {
   "lineComment": "#",
   "blockComment": {
    "open": "#",
    "close": " "
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ]
  }
 },
 {
  "id": "java",
  "aliases": [
   "Java",
   "java"
  ],
  "extensions": [
   ".java",
   ".jav"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "/**",
     "close": " */",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*/\\*\\*(?!/)([^\\*]|\\*(?!/))*$"
     },
     "afterText": {
      "source": "^\\s*\\*/$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": " * "
     }
    },
    {
     "beforeText": {
      "source": "^\\s*/\\*\\*(?!/)([^\\*]|\\*(?!/))*$"
     },
     "action": {
      "indent": "none",
      "appendText": " * "
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*[ ]\\*([ ]([^\\*]|\\*(?!/))*)?$"
     },
     "previousLineText": {
      "source": "(?=^(\\s*(/\\*\\*|\\*)).*)(?=(?!(\\s*\\*/)))"
     },
     "action": {
      "indent": "none",
      "appendText": "* "
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*[ ]\\*/\\s*$"
     },
     "action": {
      "indent": "none",
      "removeText": 1
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*[ ]\\*[^/]*\\*/\\s*$"
     },
     "action": {
      "indent": "none",
      "removeText": 1
     }
    },
    {
     "beforeText": {
      "source": "^\\s*(\\bcase\\s.+:|\\bdefault:)$"
     },
     "afterText": {
      "source": "^(?!\\s*(\\bcase\\b|\\bdefault\\b))"
     },
     "action": {
      "indent": "indent"
     }
    },
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*//\\s*(?:(?:#?region\\b)|(?:<editor-fold\\b))"
    },
    "end": {
     "source": "^\\s*//\\s*(?:(?:#?endregion\\b)|(?:</editor-fold>))"
    }
   }
  }
 },
 {
  "id": "javascriptreact",
  "aliases": [
   "JavaScript JSX",
   "JavaScript React",
   "jsx"
  ],
  "extensions": [
   ".jsx"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "${",
     "close": "}"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "${",
     "close": "}"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "/**",
     "close": " */",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "${",
     "close": "}"
    },
    {
     "open": "$",
     "close": ""
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "autoCloseBefore": ";:.,=}])>` \n\t",
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\@\\~\\!\\%\\^\\&\\*\\(\\)\\-\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>/\\?\\s]+)"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^.*(\\{[^}]*|\\([^)]*|\\[[^\\]]*)$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*[\\}\\]\\)].*$"
    },
    "indentNextLinePattern": {
     "source": "^((.*=>\\s*)|((.*[^\\w]+|\\s*)((if|while|for)\\s*\\(.*\\)\\s*|else\\s*)))$"
    },
    "unIndentedLinePattern": {
     "source": "^(\\t|[ ])*[ ]\\*[^/]*\\*/\\s*$|^(\\t|[ ])*[ ]\\*/\\s*$|^(\\t|[ ])*\\*([ ]([^\\*]|\\*(?!/))*)?$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*/\\*\\*(?!/)([^\\*]|\\*(?!/))*$"
     },
     "afterText": {
      "source": "^\\s*\\*/$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": " * "
     }
    },
    {
     "beforeText": {
      "source": "^\\s*/\\*\\*(?!/)([^\\*]|\\*(?!/))*$"
     },
     "action": {
      "indent": "none",
      "appendText": " * "
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*\\*([ ]([^\\*]|\\*(?!/))*)?$"
     },
     "previousLineText": {
      "source": "(?=^(\\s*(/\\*\\*|\\*)).*)(?=(?!(\\s*\\*/)))"
     },
     "action": {
      "indent": "none",
      "appendText": "* "
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*[ ]\\*/\\s*$"
     },
     "action": {
      "indent": "none",
      "removeText": 1
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*[ ]\\*[^/]*\\*/\\s*$"
     },
     "action": {
      "indent": "none",
      "removeText": 1
     }
    },
    {
     "beforeText": {
      "source": "^\\s*(\\bcase\\s.+:|\\bdefault:)$"
     },
     "afterText": {
      "source": "^(?!\\s*(\\bcase\\b|\\bdefault\\b))"
     },
     "action": {
      "indent": "indent"
     }
    },
    {
     "beforeText": {
      "source": "^\\s+([^{i\\s]|i(?!f\\b))"
     },
     "previousLineText": {
      "source": "^\\s*(((else ?)?if|for|while)\\s*\\(.*\\)\\s*|else\\s*)$"
     },
     "action": {
      "indent": "outdent"
     }
    },
    {
     "beforeText": {
      "source": "^.*\\([^\\)]*$"
     },
     "afterText": {
      "source": "^\\s*\\).*$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": "\t"
     }
    },
    {
     "beforeText": {
      "source": "^.*\\{[^\\}]*$"
     },
     "afterText": {
      "source": "^\\s*\\}.*$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": "\t"
     }
    },
    {
     "beforeText": {
      "source": "^.*\\[[^\\]]*$"
     },
     "afterText": {
      "source": "^\\s*\\].*$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": "\t"
     }
    },
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*//\\s*#?region\\b"
    },
    "end": {
     "source": "^\\s*//\\s*#?endregion\\b"
    }
   }
  }
 },
 {
  "id": "javascript",
  "aliases": [
   "JavaScript",
   "javascript",
   "js"
  ],
  "extensions": [
   ".js",
   ".es6",
   ".mjs",
   ".cjs",
   ".pac"
  ],
  "filenames": [
   "jakefile"
  ],
  "firstLine": "^#!.*\\bnode",
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "${",
     "close": "}"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "${",
     "close": "}"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "/**",
     "close": " */",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "${",
     "close": "}"
    },
    {
     "open": "$",
     "close": ""
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "autoCloseBefore": ";:.,=}])>` \n\t",
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\@\\~\\!\\%\\^\\&\\*\\(\\)\\-\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>/\\?\\s]+)"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^.*(\\{[^}]*|\\([^)]*|\\[[^\\]]*)$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*[\\}\\]\\)].*$"
    },
    "indentNextLinePattern": {
     "source": "^((.*=>\\s*)|((.*[^\\w]+|\\s*)((if|while|for)\\s*\\(.*\\)\\s*|else\\s*)))$"
    },
    "unIndentedLinePattern": {
     "source": "^(\\t|[ ])*[ ]\\*[^/]*\\*/\\s*$|^(\\t|[ ])*[ ]\\*/\\s*$|^(\\t|[ ])*\\*([ ]([^\\*]|\\*(?!/))*)?$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*/\\*\\*(?!/)([^\\*]|\\*(?!/))*$"
     },
     "afterText": {
      "source": "^\\s*\\*/$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": " * "
     }
    },
    {
     "beforeText": {
      "source": "^\\s*/\\*\\*(?!/)([^\\*]|\\*(?!/))*$"
     },
     "action": {
      "indent": "none",
      "appendText": " * "
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*\\*([ ]([^\\*]|\\*(?!/))*)?$"
     },
     "previousLineText": {
      "source": "(?=^(\\s*(/\\*\\*|\\*)).*)(?=(?!(\\s*\\*/)))"
     },
     "action": {
      "indent": "none",
      "appendText": "* "
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*[ ]\\*/\\s*$"
     },
     "action": {
      "indent": "none",
      "removeText": 1
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*[ ]\\*[^/]*\\*/\\s*$"
     },
     "action": {
      "indent": "none",
      "removeText": 1
     }
    },
    {
     "beforeText": {
      "source": "^\\s*(\\bcase\\s.+:|\\bdefault:)$"
     },
     "afterText": {
      "source": "^(?!\\s*(\\bcase\\b|\\bdefault\\b))"
     },
     "action": {
      "indent": "indent"
     }
    },
    {
     "beforeText": {
      "source": "^\\s+([^{i\\s]|i(?!f\\b))"
     },
     "previousLineText": {
      "source": "^\\s*(((else ?)?if|for|while)\\s*\\(.*\\)\\s*|else\\s*)$"
     },
     "action": {
      "indent": "outdent"
     }
    },
    {
     "beforeText": {
      "source": "^.*\\([^\\)]*$"
     },
     "afterText": {
      "source": "^\\s*\\).*$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": "\t"
     }
    },
    {
     "beforeText": {
      "source": "^.*\\{[^\\}]*$"
     },
     "afterText": {
      "source": "^\\s*\\}.*$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": "\t"
     }
    },
    {
     "beforeText": {
      "source": "^.*\\[[^\\]]*$"
     },
     "afterText": {
      "source": "^\\s*\\].*$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": "\t"
     }
    },
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*//\\s*#?region\\b"
    },
    "end": {
     "source": "^\\s*//\\s*#?endregion\\b"
    }
   }
  }
 },
 {
  "id": "jsx-tags",
  "rules": {
   "blockComment": {
    "open": "{/*",
    "close": "*/}"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "/**",
     "close": " */",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    }
   ],
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\$\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:'\"\\,\\.\\<\\>\\/\\s]+)"
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "<(?!(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr))([_:\\w][_:\\w\\-.\\d]*)([^/>]*(?!/)>)[^<]*$",
      "flags": "i"
     },
     "afterText": {
      "source": "^<\\/([_:\\w][_:\\w-.\\d]*)\\s*>$",
      "flags": "i"
     },
     "action": {
      "indent": "indentOutdent"
     }
    },
    {
     "beforeText": {
      "source": "<(?!(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr))([_:\\w][_:\\w\\-.\\d]*)([^/>]*(?!/)>)[^<]*$",
      "flags": "i"
     },
     "action": {
      "indent": "indent"
     }
    },
    {
     "beforeText": {
      "source": "^>$"
     },
     "afterText": {
      "source": "^<\\/([_:\\w][_:\\w-.\\d]*)\\s*>$",
      "flags": "i"
     },
     "action": {
      "indent": "indentOutdent"
     }
    },
    {
     "beforeText": {
      "source": "^>$"
     },
     "action": {
      "indent": "indent"
     }
    }
   ]
  }
 },
 {
  "id": "jsonl",
  "aliases": [
   "JSON Lines"
  ],
  "extensions": [
   ".jsonl",
   ".ndjson"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "[",
     "close": "]",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "(",
     "close": ")",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "({+(?=((\\\\.|[^\"\\\\])*\"(\\\\.|[^\"\\\\])*\")*[^\"}]*)$)|(\\[+(?=((\\\\.|[^\"\\\\])*\"(\\\\.|[^\"\\\\])*\")*[^\"\\]]*)$)"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*[}\\]],?\\s*$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*//\\s*#?region\\b"
    },
    "end": {
     "source": "^\\s*//\\s*#?endregion\\b"
    }
   }
  }
 },
 {
  "id": "snippets",
  "aliases": [
   "Code Snippets"
  ],
  "extensions": [
   ".code-snippets"
  ],
  "filenamePatterns": [
   "**/User/snippets/*.json",
   "**/User/profiles/*/snippets/*.json",
   "**/snippets*.json"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "[",
     "close": "]",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "(",
     "close": ")",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "({+(?=((\\\\.|[^\"\\\\])*\"(\\\\.|[^\"\\\\])*\")*[^\"}]*)$)|(\\[+(?=((\\\\.|[^\"\\\\])*\"(\\\\.|[^\"\\\\])*\")*[^\"\\]]*)$)"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*[}\\]],?\\s*$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*//\\s*#?region\\b"
    },
    "end": {
     "source": "^\\s*//\\s*#?endregion\\b"
    }
   }
  }
 },
 {
  "id": "julia",
  "aliases": [
   "Julia",
   "julia"
  ],
  "extensions": [
   ".jl"
  ],
  "firstLine": "^#!\\s*/.*\\bjulia[0-9.-]*\\b",
  "rules": {
   "lineComment": "#",
   "blockComment": {
    "open": "#=",
    "close": "=#"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "`",
     "close": "`"
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^(\\s*|.*=\\s*|.*@\\w*\\s*)[\\w\\s]*(?:[\"'`][^\"'`]*[\"'`])*[\\w\\s]*\\b(if|while|for|function|macro|(mutable\\s+)?struct|abstract\\s+type|primitive\\s+type|let|quote|try|begin|.*\\)\\s*do|else|elseif|catch|finally)\\b(?!(?:.*\\bend\\b[^\\]]*)|(?:[^\\[]*\\].*)$).*$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*(end|else|elseif|catch|finally)\\b.*$"
    }
   },
   "folding": {
    "start": {
     "source": "^\\s*#region"
    },
    "end": {
     "source": "^\\s*#endregion"
    }
   }
  }
 },
 {
  "id": "juliamarkdown",
  "aliases": [
   "Julia Markdown",
   "juliamarkdown"
  ],
  "extensions": [
   ".jmd"
  ]
 },
 {
  "id": "tex",
  "aliases": [
   "TeX",
   "tex"
  ],
  "extensions": [
   ".sty",
   ".cls",
   ".bbx",
   ".cbx"
  ],
  "rules": {
   "lineComment": "%",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "[",
     "close": ")"
    },
    {
     "open": "(",
     "close": "]"
    },
    {
     "open": "\\{",
     "close": "\\}"
    },
    {
     "open": "\\left(",
     "close": "\\right)"
    },
    {
     "open": "\\left(",
     "close": "\\right]"
    },
    {
     "open": "\\left(",
     "close": "\\right."
    },
    {
     "open": "\\left.",
     "close": "\\right)"
    },
    {
     "open": "\\left[",
     "close": "\\right]"
    },
    {
     "open": "\\left[",
     "close": "\\right)"
    },
    {
     "open": "\\left[",
     "close": "\\right."
    },
    {
     "open": "\\left.",
     "close": "\\right]"
    },
    {
     "open": "\\left\\{",
     "close": "\\right\\}"
    },
    {
     "open": "\\left\\{",
     "close": "\\right."
    },
    {
     "open": "\\left.",
     "close": "\\right\\}"
    },
    {
     "open": "\\left<",
     "close": "\\right>"
    },
    {
     "open": "\\bigl(",
     "close": "\\bigr)"
    },
    {
     "open": "\\bigl[",
     "close": "\\bigr]"
    },
    {
     "open": "\\bigl\\{",
     "close": "\\bigr\\}"
    },
    {
     "open": "\\Bigl(",
     "close": "\\Bigr)"
    },
    {
     "open": "\\Bigl[",
     "close": "\\Bigr]"
    },
    {
     "open": "\\Bigl\\{",
     "close": "\\Bigr\\}"
    },
    {
     "open": "\\biggl(",
     "close": "\\biggr)"
    },
    {
     "open": "\\biggl[",
     "close": "\\biggr]"
    },
    {
     "open": "\\biggl\\{",
     "close": "\\biggr\\}"
    },
    {
     "open": "\\Biggl(",
     "close": "\\Biggr)"
    },
    {
     "open": "\\Biggl[",
     "close": "\\Biggr]"
    },
    {
     "open": "\\Biggl\\{",
     "close": "\\Biggr\\}"
    },
    {
     "open": "\\langle",
     "close": "\\rangle"
    },
    {
     "open": "\\lvert",
     "close": "\\rvert"
    },
    {
     "open": "\\lVert",
     "close": "\\rVert"
    },
    {
     "open": "\\left|",
     "close": "\\right|"
    },
    {
     "open": "\\left.",
     "close": "\\right|"
    },
    {
     "open": "\\left|",
     "close": "\\right."
    },
    {
     "open": "\\left\\vert",
     "close": "\\right\\vert"
    },
    {
     "open": "\\left\\|",
     "close": "\\right\\|"
    },
    {
     "open": "\\left\\Vert",
     "close": "\\right\\Vert"
    },
    {
     "open": "\\left\\langle",
     "close": "\\right\\rangle"
    },
    {
     "open": "\\left\\lvert",
     "close": "\\right\\rvert"
    },
    {
     "open": "\\left\\lVert",
     "close": "\\right\\rVert"
    },
    {
     "open": "\\bigl\\langle",
     "close": "\\bigr\\rangle"
    },
    {
     "open": "\\bigl|",
     "close": "\\bigr|"
    },
    {
     "open": "\\bigl\\vert",
     "close": "\\bigr\\vert"
    },
    {
     "open": "\\bigl\\lvert",
     "close": "\\bigr\\rvert"
    },
    {
     "open": "\\bigl\\|",
     "close": "\\bigr\\|"
    },
    {
     "open": "\\bigl\\lVert",
     "close": "\\bigr\\rVert"
    },
    {
     "open": "\\bigl\\Vert",
     "close": "\\bigr\\Vert"
    },
    {
     "open": "\\Bigl\\langle",
     "close": "\\Bigr\\rangle"
    },
    {
     "open": "\\Bigl|",
     "close": "\\Bigr|"
    },
    {
     "open": "\\Bigl\\lvert",
     "close": "\\Bigr\\rvert"
    },
    {
     "open": "\\Bigl\\vert",
     "close": "\\Bigr\\vert"
    },
    {
     "open": "\\Bigl\\|",
     "close": "\\Bigr\\|"
    },
    {
     "open": "\\Bigl\\lVert",
     "close": "\\Bigr\\rVert"
    },
    {
     "open": "\\Bigl\\Vert",
     "close": "\\Bigr\\Vert"
    },
    {
     "open": "\\biggl\\langle",
     "close": "\\biggr\\rangle"
    },
    {
     "open": "\\biggl|",
     "close": "\\biggr|"
    },
    {
     "open": "\\biggl\\lvert",
     "close": "\\biggr\\rvert"
    },
    {
     "open": "\\biggl\\vert",
     "close": "\\biggr\\vert"
    },
    {
     "open": "\\biggl\\|",
     "close": "\\biggr\\|"
    },
    {
     "open": "\\biggl\\lVert",
     "close": "\\biggr\\rVert"
    },
    {
     "open": "\\biggl\\Vert",
     "close": "\\biggr\\Vert"
    },
    {
     "open": "\\Biggl\\langle",
     "close": "\\Biggr\\rangle"
    },
    {
     "open": "\\Biggl|",
     "close": "\\Biggr|"
    },
    {
     "open": "\\Biggl\\lvert",
     "close": "\\Biggr\\rvert"
    },
    {
     "open": "\\Biggl\\vert",
     "close": "\\Biggr\\vert"
    },
    {
     "open": "\\Biggl\\|",
     "close": "\\Biggr\\|"
    },
    {
     "open": "\\Biggl\\lVert",
     "close": "\\Biggr\\rVert"
    },
    {
     "open": "\\Biggl\\Vert",
     "close": "\\Biggr\\Vert"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "\\left(",
     "close": "\\right)"
    },
    {
     "open": "\\left[",
     "close": "\\right]"
    },
    {
     "open": "\\left\\{",
     "close": "\\right\\}"
    },
    {
     "open": "\\bigl(",
     "close": "\\bigr)"
    },
    {
     "open": "\\bigl[",
     "close": "\\bigr]"
    },
    {
     "open": "\\bigl\\{",
     "close": "\\bigr\\}"
    },
    {
     "open": "\\Bigl(",
     "close": "\\Bigr)"
    },
    {
     "open": "\\Bigl[",
     "close": "\\Bigr]"
    },
    {
     "open": "\\Bigl\\{",
     "close": "\\Bigr\\}"
    },
    {
     "open": "\\biggl(",
     "close": "\\biggr)"
    },
    {
     "open": "\\biggl[",
     "close": "\\biggr]"
    },
    {
     "open": "\\biggl\\{",
     "close": "\\biggr\\}"
    },
    {
     "open": "\\Biggl(",
     "close": "\\Biggr)"
    },
    {
     "open": "\\Biggl[",
     "close": "\\Biggr]"
    },
    {
     "open": "\\Biggl\\{",
     "close": "\\Biggr\\}"
    },
    {
     "open": "\\(",
     "close": "\\)"
    },
    {
     "open": "\\[",
     "close": "\\]"
    },
    {
     "open": "\\{",
     "close": "\\}"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "`",
     "close": "'"
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "`",
     "close": "'"
    },
    {
     "open": "$",
     "close": "$"
    }
   ],
   "autoCloseBefore": ";:.,={}])>\\` \n\t$",
   "wordPattern": {
    "source": "(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark}){1}",
    "flags": "u"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "\\\\begin{(?!document)([^}]*)}(?!.*\\\\end{\\1})"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*\\\\end{(?!document)"
    }
   },
   "folding": {
    "start": {
     "source": "^\\s*(%\\s*region|%?\\s*\\\\begingroup)\\b"
    },
    "end": {
     "source": "^\\s*(%\\s*endregion|%?\\s*\\\\endgroup)\\b"
    }
   }
  }
 },
 {
  "id": "latex",
  "aliases": [
   "LaTeX",
   "latex"
  ],
  "extensions": [
   ".tex",
   ".ltx",
   ".ctx"
  ],
  "rules": {
   "lineComment": "%",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "[",
     "close": ")"
    },
    {
     "open": "(",
     "close": "]"
    },
    {
     "open": "\\{",
     "close": "\\}"
    },
    {
     "open": "\\left(",
     "close": "\\right)"
    },
    {
     "open": "\\left(",
     "close": "\\right]"
    },
    {
     "open": "\\left(",
     "close": "\\right."
    },
    {
     "open": "\\left.",
     "close": "\\right)"
    },
    {
     "open": "\\left[",
     "close": "\\right]"
    },
    {
     "open": "\\left[",
     "close": "\\right)"
    },
    {
     "open": "\\left[",
     "close": "\\right."
    },
    {
     "open": "\\left.",
     "close": "\\right]"
    },
    {
     "open": "\\left\\{",
     "close": "\\right\\}"
    },
    {
     "open": "\\left\\{",
     "close": "\\right."
    },
    {
     "open": "\\left.",
     "close": "\\right\\}"
    },
    {
     "open": "\\left<",
     "close": "\\right>"
    },
    {
     "open": "\\bigl(",
     "close": "\\bigr)"
    },
    {
     "open": "\\bigl[",
     "close": "\\bigr]"
    },
    {
     "open": "\\bigl\\{",
     "close": "\\bigr\\}"
    },
    {
     "open": "\\Bigl(",
     "close": "\\Bigr)"
    },
    {
     "open": "\\Bigl[",
     "close": "\\Bigr]"
    },
    {
     "open": "\\Bigl\\{",
     "close": "\\Bigr\\}"
    },
    {
     "open": "\\biggl(",
     "close": "\\biggr)"
    },
    {
     "open": "\\biggl[",
     "close": "\\biggr]"
    },
    {
     "open": "\\biggl\\{",
     "close": "\\biggr\\}"
    },
    {
     "open": "\\Biggl(",
     "close": "\\Biggr)"
    },
    {
     "open": "\\Biggl[",
     "close": "\\Biggr]"
    },
    {
     "open": "\\Biggl\\{",
     "close": "\\Biggr\\}"
    },
    {
     "open": "\\langle",
     "close": "\\rangle"
    },
    {
     "open": "\\lvert",
     "close": "\\rvert"
    },
    {
     "open": "\\lVert",
     "close": "\\rVert"
    },
    {
     "open": "\\left|",
     "close": "\\right|"
    },
    {
     "open": "\\left.",
     "close": "\\right|"
    },
    {
     "open": "\\left|",
     "close": "\\right."
    },
    {
     "open": "\\left\\vert",
     "close": "\\right\\vert"
    },
    {
     "open": "\\left\\|",
     "close": "\\right\\|"
    },
    {
     "open": "\\left\\Vert",
     "close": "\\right\\Vert"
    },
    {
     "open": "\\left\\langle",
     "close": "\\right\\rangle"
    },
    {
     "open": "\\left\\lvert",
     "close": "\\right\\rvert"
    },
    {
     "open": "\\left\\lVert",
     "close": "\\right\\rVert"
    },
    {
     "open": "\\bigl\\langle",
     "close": "\\bigr\\rangle"
    },
    {
     "open": "\\bigl|",
     "close": "\\bigr|"
    },
    {
     "open": "\\bigl\\vert",
     "close": "\\bigr\\vert"
    },
    {
     "open": "\\bigl\\lvert",
     "close": "\\bigr\\rvert"
    },
    {
     "open": "\\bigl\\|",
     "close": "\\bigr\\|"
    },
    {
     "open": "\\bigl\\lVert",
     "close": "\\bigr\\rVert"
    },
    {
     "open": "\\bigl\\Vert",
     "close": "\\bigr\\Vert"
    },
    {
     "open": "\\Bigl\\langle",
     "close": "\\Bigr\\rangle"
    },
    {
     "open": "\\Bigl|",
     "close": "\\Bigr|"
    },
    {
     "open": "\\Bigl\\lvert",
     "close": "\\Bigr\\rvert"
    },
    {
     "open": "\\Bigl\\vert",
     "close": "\\Bigr\\vert"
    },
    {
     "open": "\\Bigl\\|",
     "close": "\\Bigr\\|"
    },
    {
     "open": "\\Bigl\\lVert",
     "close": "\\Bigr\\rVert"
    },
    {
     "open": "\\Bigl\\Vert",
     "close": "\\Bigr\\Vert"
    },
    {
     "open": "\\biggl\\langle",
     "close": "\\biggr\\rangle"
    },
    {
     "open": "\\biggl|",
     "close": "\\biggr|"
    },
    {
     "open": "\\biggl\\lvert",
     "close": "\\biggr\\rvert"
    },
    {
     "open": "\\biggl\\vert",
     "close": "\\biggr\\vert"
    },
    {
     "open": "\\biggl\\|",
     "close": "\\biggr\\|"
    },
    {
     "open": "\\biggl\\lVert",
     "close": "\\biggr\\rVert"
    },
    {
     "open": "\\biggl\\Vert",
     "close": "\\biggr\\Vert"
    },
    {
     "open": "\\Biggl\\langle",
     "close": "\\Biggr\\rangle"
    },
    {
     "open": "\\Biggl|",
     "close": "\\Biggr|"
    },
    {
     "open": "\\Biggl\\lvert",
     "close": "\\Biggr\\rvert"
    },
    {
     "open": "\\Biggl\\vert",
     "close": "\\Biggr\\vert"
    },
    {
     "open": "\\Biggl\\|",
     "close": "\\Biggr\\|"
    },
    {
     "open": "\\Biggl\\lVert",
     "close": "\\Biggr\\rVert"
    },
    {
     "open": "\\Biggl\\Vert",
     "close": "\\Biggr\\Vert"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "\\left(",
     "close": "\\right)"
    },
    {
     "open": "\\left[",
     "close": "\\right]"
    },
    {
     "open": "\\left\\{",
     "close": "\\right\\}"
    },
    {
     "open": "\\bigl(",
     "close": "\\bigr)"
    },
    {
     "open": "\\bigl[",
     "close": "\\bigr]"
    },
    {
     "open": "\\bigl\\{",
     "close": "\\bigr\\}"
    },
    {
     "open": "\\Bigl(",
     "close": "\\Bigr)"
    },
    {
     "open": "\\Bigl[",
     "close": "\\Bigr]"
    },
    {
     "open": "\\Bigl\\{",
     "close": "\\Bigr\\}"
    },
    {
     "open": "\\biggl(",
     "close": "\\biggr)"
    },
    {
     "open": "\\biggl[",
     "close": "\\biggr]"
    },
    {
     "open": "\\biggl\\{",
     "close": "\\biggr\\}"
    },
    {
     "open": "\\Biggl(",
     "close": "\\Biggr)"
    },
    {
     "open": "\\Biggl[",
     "close": "\\Biggr]"
    },
    {
     "open": "\\Biggl\\{",
     "close": "\\Biggr\\}"
    },
    {
     "open": "\\(",
     "close": "\\)"
    },
    {
     "open": "\\[",
     "close": "\\]"
    },
    {
     "open": "\\{",
     "close": "\\}"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "`",
     "close": "'"
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "`",
     "close": "'"
    },
    {
     "open": "$",
     "close": "$"
    }
   ],
   "autoCloseBefore": ";:.,={}])>\\` \n\t$",
   "wordPattern": {
    "source": "(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark}){1}",
    "flags": "u"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "\\\\begin{(?!document)([^}]*)}(?!.*\\\\end{\\1})"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*\\\\end{(?!document)"
    }
   },
   "folding": {
    "start": {
     "source": "^\\s*(%\\s*region|%?\\s*\\\\begingroup)\\b"
    },
    "end": {
     "source": "^\\s*(%\\s*endregion|%?\\s*\\\\endgroup)\\b"
    }
   }
  }
 },
 {
  "id": "bibtex",
  "aliases": [
   "BibTeX",
   "bibtex"
  ],
  "extensions": [
   ".bib"
  ]
 },
 {
  "id": "cpp_embedded_latex",
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\#\\%\\^\\&\\*\\(\\)\\-\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\?\\s]+)"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^.*(\\{[^}]*|\\([^)]*|\\[[^\\]]*)$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*[\\}\\]\\)].*$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s+([^{i\\s]|i(?!f\\b))"
     },
     "previousLineText": {
      "source": "^\\s*(((else ?)?if|for|while)\\s*\\(.*\\)\\s*|else\\s*)$"
     },
     "action": {
      "indent": "outdent"
     }
    },
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*#\\s*pragma\\s+region\\b"
    },
    "end": {
     "source": "^\\s*#\\s*pragma\\s+endregion\\b"
    }
   }
  }
 },
 {
  "id": "markdown_latex_combined",
  "rules": {
   "blockComment": {
    "open": "<!--",
    "close": "-->"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "[",
     "close": ")"
    },
    {
     "open": "(",
     "close": "]"
    },
    {
     "open": "\\{",
     "close": "\\}"
    },
    {
     "open": "\\left(",
     "close": "\\right)"
    },
    {
     "open": "\\left(",
     "close": "\\right]"
    },
    {
     "open": "\\left(",
     "close": "\\right."
    },
    {
     "open": "\\left.",
     "close": "\\right)"
    },
    {
     "open": "\\left[",
     "close": "\\right]"
    },
    {
     "open": "\\left[",
     "close": "\\right)"
    },
    {
     "open": "\\left[",
     "close": "\\right."
    },
    {
     "open": "\\left.",
     "close": "\\right]"
    },
    {
     "open": "\\left\\{",
     "close": "\\right\\}"
    },
    {
     "open": "\\left\\{",
     "close": "\\right."
    },
    {
     "open": "\\left.",
     "close": "\\right\\}"
    },
    {
     "open": "\\left<",
     "close": "\\right>"
    },
    {
     "open": "\\bigl(",
     "close": "\\bigr)"
    },
    {
     "open": "\\bigl[",
     "close": "\\bigr]"
    },
    {
     "open": "\\bigl\\{",
     "close": "\\bigr\\}"
    },
    {
     "open": "\\Bigl(",
     "close": "\\Bigr)"
    },
    {
     "open": "\\Bigl[",
     "close": "\\Bigr]"
    },
    {
     "open": "\\Bigl\\{",
     "close": "\\Bigr\\}"
    },
    {
     "open": "\\biggl(",
     "close": "\\biggr)"
    },
    {
     "open": "\\biggl[",
     "close": "\\biggr]"
    },
    {
     "open": "\\biggl\\{",
     "close": "\\biggr\\}"
    },
    {
     "open": "\\Biggl(",
     "close": "\\Biggr)"
    },
    {
     "open": "\\Biggl[",
     "close": "\\Biggr]"
    },
    {
     "open": "\\Biggl\\{",
     "close": "\\Biggr\\}"
    },
    {
     "open": "\\langle",
     "close": "\\rangle"
    },
    {
     "open": "\\lvert",
     "close": "\\rvert"
    },
    {
     "open": "\\lVert",
     "close": "\\rVert"
    },
    {
     "open": "\\left|",
     "close": "\\right|"
    },
    {
     "open": "\\left.",
     "close": "\\right|"
    },
    {
     "open": "\\left|",
     "close": "\\right."
    },
    {
     "open": "\\left\\vert",
     "close": "\\right\\vert"
    },
    {
     "open": "\\left\\|",
     "close": "\\right\\|"
    },
    {
     "open": "\\left\\Vert",
     "close": "\\right\\Vert"
    },
    {
     "open": "\\left\\langle",
     "close": "\\right\\rangle"
    },
    {
     "open": "\\left\\lvert",
     "close": "\\right\\rvert"
    },
    {
     "open": "\\left\\lVert",
     "close": "\\right\\rVert"
    },
    {
     "open": "\\bigl\\langle",
     "close": "\\bigr\\rangle"
    },
    {
     "open": "\\bigl|",
     "close": "\\bigr|"
    },
    {
     "open": "\\bigl\\vert",
     "close": "\\bigr\\vert"
    },
    {
     "open": "\\bigl\\lvert",
     "close": "\\bigr\\rvert"
    },
    {
     "open": "\\bigl\\|",
     "close": "\\bigr\\|"
    },
    {
     "open": "\\bigl\\lVert",
     "close": "\\bigr\\rVert"
    },
    {
     "open": "\\bigl\\Vert",
     "close": "\\bigr\\Vert"
    },
    {
     "open": "\\Bigl\\langle",
     "close": "\\Bigr\\rangle"
    },
    {
     "open": "\\Bigl|",
     "close": "\\Bigr|"
    },
    {
     "open": "\\Bigl\\lvert",
     "close": "\\Bigr\\rvert"
    },
    {
     "open": "\\Bigl\\vert",
     "close": "\\Bigr\\vert"
    },
    {
     "open": "\\Bigl\\|",
     "close": "\\Bigr\\|"
    },
    {
     "open": "\\Bigl\\lVert",
     "close": "\\Bigr\\rVert"
    },
    {
     "open": "\\Bigl\\Vert",
     "close": "\\Bigr\\Vert"
    },
    {
     "open": "\\biggl\\langle",
     "close": "\\biggr\\rangle"
    },
    {
     "open": "\\biggl|",
     "close": "\\biggr|"
    },
    {
     "open": "\\biggl\\lvert",
     "close": "\\biggr\\rvert"
    },
    {
     "open": "\\biggl\\vert",
     "close": "\\biggr\\vert"
    },
    {
     "open": "\\biggl\\|",
     "close": "\\biggr\\|"
    },
    {
     "open": "\\biggl\\lVert",
     "close": "\\biggr\\rVert"
    },
    {
     "open": "\\biggl\\Vert",
     "close": "\\biggr\\Vert"
    },
    {
     "open": "\\Biggl\\langle",
     "close": "\\Biggr\\rangle"
    },
    {
     "open": "\\Biggl|",
     "close": "\\Biggr|"
    },
    {
     "open": "\\Biggl\\lvert",
     "close": "\\Biggr\\rvert"
    },
    {
     "open": "\\Biggl\\vert",
     "close": "\\Biggr\\vert"
    },
    {
     "open": "\\Biggl\\|",
     "close": "\\Biggr\\|"
    },
    {
     "open": "\\Biggl\\lVert",
     "close": "\\Biggr\\rVert"
    },
    {
     "open": "\\Biggl\\Vert",
     "close": "\\Biggr\\Vert"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "\\left(",
     "close": "\\right)"
    },
    {
     "open": "\\left[",
     "close": "\\right]"
    },
    {
     "open": "\\left\\{",
     "close": "\\right\\}"
    },
    {
     "open": "\\bigl(",
     "close": "\\bigr)"
    },
    {
     "open": "\\bigl[",
     "close": "\\bigr]"
    },
    {
     "open": "\\bigl\\{",
     "close": "\\bigr\\}"
    },
    {
     "open": "\\Bigl(",
     "close": "\\Bigr)"
    },
    {
     "open": "\\Bigl[",
     "close": "\\Bigr]"
    },
    {
     "open": "\\Bigl\\{",
     "close": "\\Bigr\\}"
    },
    {
     "open": "\\biggl(",
     "close": "\\biggr)"
    },
    {
     "open": "\\biggl[",
     "close": "\\biggr]"
    },
    {
     "open": "\\biggl\\{",
     "close": "\\biggr\\}"
    },
    {
     "open": "\\Biggl(",
     "close": "\\Biggr)"
    },
    {
     "open": "\\Biggl[",
     "close": "\\Biggr]"
    },
    {
     "open": "\\Biggl\\{",
     "close": "\\Biggr\\}"
    },
    {
     "open": "\\(",
     "close": "\\)"
    },
    {
     "open": "\\[",
     "close": "\\]"
    },
    {
     "open": "\\{",
     "close": "\\}"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "`",
     "close": "'"
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "$",
     "close": "$"
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "_",
     "close": "_"
    },
    {
     "open": "*",
     "close": "*"
    }
   ],
   "autoCloseBefore": ";:.,={}])>\\` \n\t$",
   "wordPattern": {
    "source": "([*_]{1,2})?(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})(((\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})|[_])?(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark}))*\\1",
    "flags": "u"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "\\\\begin{(?!document)([^}]*)}(?!.*\\\\end{\\1})"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*\\\\end{(?!document)"
    }
   },
   "folding": {
    "start": {
     "source": "^\\s*<!--\\s*#?region\\b\\s*(?<label>.*?)\\s*-->"
    },
    "end": {
     "source": "^\\s*<!--\\s*#?endregion\\b.*-->"
    },
    "offSide": true
   }
  }
 },
 {
  "id": "less",
  "aliases": [
   "Less",
   "less"
  ],
  "extensions": [
   ".less"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "[",
     "close": "]",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "(",
     "close": ")",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "wordPattern": {
    "source": "(#?-?\\d*\\.\\d\\w*%?)|(::?[\\w-]+(?=[^,{;]*[,{]))|(([@#.!])?[\\w-?]+%?|[@#!.])"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "(^.*\\{[^}]*$)"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*\\}"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*\\/\\*\\s*#region\\b\\s*(?<label>.*?)\\s*\\*\\/"
    },
    "end": {
     "source": "^\\s*\\/\\*\\s*#endregion\\b.*\\*\\/"
    }
   }
  }
 },
 {
  "id": "log",
  "aliases": [
   "Log"
  ],
  "extensions": [
   ".log",
   "*.log.?"
  ]
 },
 {
  "id": "lua",
  "aliases": [
   "Lua",
   "lua"
  ],
  "extensions": [
   ".lua"
  ],
  "rules": {
   "lineComment": "--",
   "blockComment": {
    "open": "--[[",
    "close": "]]"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^((?!(\\-\\-)).)*((\\b(else|function|then|do|repeat)\\b((?!\\b(end|until)\\b).)*)|(\\{\\s*))$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*((\\b(elseif|else|end|until)\\b)|(\\})|(\\)))"
    }
   }
  }
 },
 {
  "id": "makefile",
  "aliases": [
   "Makefile",
   "makefile"
  ],
  "extensions": [
   ".mak",
   ".mk"
  ],
  "filenames": [
   "Makefile",
   "makefile",
   "GNUmakefile",
   "OCamlMakefile"
  ],
  "firstLine": "^#!\\s*/usr/bin/make",
  "rules": {
   "lineComment": "#",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ]
  }
 },
 {
  "id": "markdown-math"
 },
 {
  "id": "objective-c",
  "aliases": [
   "Objective-C"
  ],
  "extensions": [
   ".m"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ]
  }
 },
 {
  "id": "objective-cpp",
  "aliases": [
   "Objective-C++"
  ],
  "extensions": [
   ".mm"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ]
  }
 },
 {
  "id": "perl",
  "aliases": [
   "Perl",
   "perl"
  ],
  "extensions": [
   ".pl",
   ".pm",
   ".pod",
   ".t",
   ".PL",
   ".psgi"
  ],
  "firstLine": "^#!.*\\bperl\\b",
  "rules": {
   "lineComment": "#",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "`",
     "close": "`"
    }
   ],
   "folding": {
    "start": {
     "source": "^(?:(?:=pod\\s*$)|(?:\\s*#region\\b))"
    },
    "end": {
     "source": "^(?:(?:=cut\\s*$)|(?:\\s*#endregion\\b))"
    }
   }
  }
 },
 {
  "id": "raku",
  "aliases": [
   "Raku",
   "Perl6",
   "perl6"
  ],
  "extensions": [
   ".raku",
   ".rakumod",
   ".rakutest",
   ".rakudoc",
   ".nqp",
   ".p6",
   ".pl6",
   ".pm6"
  ],
  "firstLine": "(^#!.*\\bperl6\\b)|use\\s+v6|raku|=begin\\spod|my\\sclass",
  "rules": {
   "lineComment": "#",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "`",
     "close": "`"
    }
   ]
  }
 },
 {
  "id": "php",
  "aliases": [
   "PHP",
   "php"
  ],
  "extensions": [
   ".php",
   ".php4",
   ".php5",
   ".phtml",
   ".ctp"
  ],
  "firstLine": "^#!\\s*/.*\\bphp\\b",
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "[",
     "close": "]",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "(",
     "close": ")",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "/**",
     "close": " */",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "`",
     "close": "`"
    }
   ],
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\-\\`\\~\\!\\@\\#\\%\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\?\\s]+)"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "((else\\s?)?if|else|for(each)?|while|switch|case).*:\\s*((/[/*].*|)?$|\\?>)"
    },
    "decreaseIndentPattern": {
     "source": "^(.*\\*\\/)?\\s*(\\b(else:)|\\bend(if|for(each)?|while|switch);)"
    },
    "indentNextLinePattern": {
     "source": "^\\s*(((if|else ?if|while|for|foreach)\\s*\\(.*\\)\\s*)|else\\s*)$"
    },
    "unIndentedLinePattern": {
     "source": "^(\\t|[ ])*[ ]\\*[^/]*\\*/\\s*$|^(\\t|[ ])*[ ]\\*/\\s*$|^(\\t|[ ])*\\*([ ]([^\\*]|\\*(?!/))*)?$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*\\/\\*\\*(?!\\/)([^\\*]|\\*(?!\\/))*$"
     },
     "afterText": {
      "source": "^\\s*\\*\\/$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": " * "
     }
    },
    {
     "beforeText": {
      "source": "^\\s*\\/\\*\\*(?!\\/)([^\\*]|\\*(?!\\/))*$"
     },
     "action": {
      "indent": "none",
      "appendText": " * "
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|(\\ \\ ))*\\ \\*(\\ ([^\\*]|\\*(?!\\/))*)?$"
     },
     "action": {
      "indent": "none",
      "appendText": "* "
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|(\\ \\ ))*\\ \\*\\/\\s*$"
     },
     "action": {
      "indent": "none",
      "removeText": 1
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|(\\ \\ ))*\\ \\*[^/]*\\*\\/\\s*$"
     },
     "action": {
      "indent": "none",
      "removeText": 1
     }
    },
    {
     "beforeText": {
      "source": "^\\s+([^{i\\s]|i(?!f\\b))"
     },
     "previousLineText": {
      "source": "^\\s*(((else ?)?if|for(each)?|while)\\s*\\(.*\\)\\s*|else\\s*)$"
     },
     "action": {
      "indent": "outdent"
     }
    },
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*(#|//|// #)region\\b"
    },
    "end": {
     "source": "^\\s*(#|//|// #)endregion\\b"
    }
   }
  }
 },
 {
  "id": "powershell",
  "aliases": [
   "PowerShell",
   "powershell",
   "ps",
   "ps1",
   "pwsh"
  ],
  "extensions": [
   ".ps1",
   ".psm1",
   ".psd1",
   ".pssc",
   ".psrc"
  ],
  "firstLine": "^#!\\s*/.*\\bpwsh\\b",
  "rules": {
   "lineComment": "#",
   "blockComment": {
    "open": "<#",
    "close": "#>"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "@'",
     "close": "\n'@",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "@\"",
     "close": "\n\"@",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "<#",
     "close": "#>"
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*#[rR]egion\\b"
    },
    "end": {
     "source": "^\\s*#[eE]nd[rR]egion\\b"
    }
   }
  }
 },
 {
  "id": "prompt",
  "aliases": [
   "Prompt",
   "prompt"
  ],
  "extensions": [
   ".prompt.md"
  ],
  "rules": {
   "blockComment": {
    "open": "<!--",
    "close": "-->"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "_",
     "close": "_"
    },
    {
     "open": "*",
     "close": "*"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "~",
     "close": "~"
    },
    {
     "open": "$",
     "close": "$"
    }
   ],
   "wordPattern": {
    "source": "(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})(((\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})|[_])?(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark}))*",
    "flags": "ug"
   },
   "folding": {
    "start": {
     "source": "^\\s*<!--\\s*#?region\\b\\s*(?<label>.*?)\\s*-->"
    },
    "end": {
     "source": "^\\s*<!--\\s*#?endregion\\b.*-->"
    },
    "offSide": true
   }
  }
 },
 {
  "id": "instructions",
  "aliases": [
   "Instructions",
   "instructions"
  ],
  "extensions": [
   ".instructions.md",
   "copilot-instructions.md"
  ],
  "filenamePatterns": [
   "**/.claude/rules/**/*.md"
  ],
  "rules": {
   "blockComment": {
    "open": "<!--",
    "close": "-->"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "_",
     "close": "_"
    },
    {
     "open": "*",
     "close": "*"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "~",
     "close": "~"
    },
    {
     "open": "$",
     "close": "$"
    }
   ],
   "wordPattern": {
    "source": "(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})(((\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})|[_])?(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark}))*",
    "flags": "ug"
   },
   "folding": {
    "start": {
     "source": "^\\s*<!--\\s*#?region\\b\\s*(?<label>.*?)\\s*-->"
    },
    "end": {
     "source": "^\\s*<!--\\s*#?endregion\\b.*-->"
    },
    "offSide": true
   }
  }
 },
 {
  "id": "chatagent",
  "aliases": [
   "Agent",
   "chat agent"
  ],
  "extensions": [
   ".agent.md",
   ".chatmode.md"
  ],
  "filenamePatterns": [
   "**/.github/agents/*.md",
   "**/.claude/agents/*.md"
  ],
  "rules": {
   "blockComment": {
    "open": "<!--",
    "close": "-->"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "_",
     "close": "_"
    },
    {
     "open": "*",
     "close": "*"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "~",
     "close": "~"
    },
    {
     "open": "$",
     "close": "$"
    }
   ],
   "wordPattern": {
    "source": "(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})(((\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})|[_])?(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark}))*",
    "flags": "ug"
   },
   "folding": {
    "start": {
     "source": "^\\s*<!--\\s*#?region\\b\\s*(?<label>.*?)\\s*-->"
    },
    "end": {
     "source": "^\\s*<!--\\s*#?endregion\\b.*-->"
    },
    "offSide": true
   }
  }
 },
 {
  "id": "skill",
  "aliases": [
   "Skill",
   "skill"
  ],
  "filenames": [
   "SKILL.md"
  ],
  "rules": {
   "blockComment": {
    "open": "<!--",
    "close": "-->"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "_",
     "close": "_"
    },
    {
     "open": "*",
     "close": "*"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "~",
     "close": "~"
    },
    {
     "open": "$",
     "close": "$"
    }
   ],
   "wordPattern": {
    "source": "(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})(((\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})|[_])?(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark}))*",
    "flags": "ug"
   },
   "folding": {
    "start": {
     "source": "^\\s*<!--\\s*#?region\\b\\s*(?<label>.*?)\\s*-->"
    },
    "end": {
     "source": "^\\s*<!--\\s*#?endregion\\b.*-->"
    },
    "offSide": true
   }
  }
 },
 {
  "id": "jade",
  "aliases": [
   "Pug",
   "Jade",
   "jade"
  ],
  "extensions": [
   ".pug",
   ".jade"
  ],
  "rules": {
   "lineComment": "//-",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    }
   ],
   "folding": {
    "offSide": true
   }
  }
 },
 {
  "id": "python",
  "aliases": [
   "Python",
   "py"
  ],
  "extensions": [
   ".py",
   ".rpy",
   ".pyw",
   ".cpy",
   ".gyp",
   ".gypi",
   ".pyi",
   ".ipy",
   ".pyt"
  ],
  "filenames": [
   "SConstruct",
   "SConscript"
  ],
  "firstLine": "^#!\\s*/?.*\\bpython[0-9.-]*\\b",
  "rules": {
   "lineComment": "#",
   "blockComment": {
    "open": "\"\"\"",
    "close": "\"\"\""
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "r\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "R\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "u\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "U\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "f\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "F\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "b\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "B\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "r'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "R'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "u'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "U'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "f'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "F'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "b'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "B'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "`",
     "close": "`"
    }
   ],
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async).*?:\\s*$"
     },
     "action": {
      "indent": "indent"
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*#\\s*region\\b"
    },
    "end": {
     "source": "^\\s*#\\s*endregion\\b"
    },
    "offSide": true
   }
  }
 },
 {
  "id": "r",
  "aliases": [
   "R",
   "r"
  ],
  "extensions": [
   ".R",
   ".Rhistory",
   ".Rprofile",
   ".rt"
  ],
  "rules": {
   "lineComment": "#",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "%",
     "close": "%",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ]
  }
 },
 {
  "id": "razor",
  "aliases": [
   "Razor",
   "razor"
  ],
  "extensions": [
   ".cshtml",
   ".razor"
  ],
  "rules": {
   "blockComment": {
    "open": "<!--",
    "close": "-->"
   },
   "brackets": [
    {
     "open": "<!--",
     "close": "-->"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    }
   ],
   "surroundingPairs": [
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "<",
     "close": ">"
    }
   ]
  }
 },
 {
  "id": "restructuredtext",
  "aliases": [
   "reStructuredText"
  ],
  "extensions": [
   ".rst"
  ],
  "rules": {
   "lineComment": "..",
   "brackets": [
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "[",
     "close": "]"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "[",
     "close": "]"
    }
   ],
   "surroundingPairs": [
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "*",
     "close": "*"
    },
    {
     "open": "|",
     "close": "|"
    },
    {
     "open": "[",
     "close": "]"
    }
   ],
   "autoCloseBefore": ":})>`\\n ",
   "wordPattern": {
    "source": "[\\w-]*\\w[\\w-]*"
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*\\.\\. *$|(?<!:)::(\\s|$)"
     },
     "action": {
      "indent": "indent"
     }
    }
   ]
  }
 },
 {
  "id": "ruby",
  "aliases": [
   "Ruby",
   "rb"
  ],
  "extensions": [
   ".rb",
   ".rbx",
   ".rjs",
   ".gemspec",
   ".rake",
   ".ru",
   ".erb",
   ".podspec",
   ".rbi"
  ],
  "filenames": [
   "rakefile",
   "gemfile",
   "guardfile",
   "podfile",
   "capfile",
   "cheffile",
   "hobofile",
   "vagrantfile",
   "appraisals",
   "rantfile",
   "berksfile",
   "berksfile.lock",
   "thorfile",
   "puppetfile",
   "dangerfile",
   "brewfile",
   "fastfile",
   "appfile",
   "deliverfile",
   "matchfile",
   "scanfile",
   "snapfile",
   "gymfile"
  ],
  "firstLine": "^#!\\s*/.*\\bruby\\b",
  "rules": {
   "lineComment": "#",
   "blockComment": {
    "open": "=begin",
    "close": "=end"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "`",
     "close": "`"
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^\\s*((begin|class|(private|protected)\\s+def|def|else|elsif|ensure|for|if|module|rescue|unless|until|when|in|while|case)|([^#]*\\sdo\\b)|([^#]*=\\s*(case|if|unless)))\\b([^#\\{;]|(\"|'|/).*\\4)*(#.*)?$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*([}\\]]([,)]?\\s*(#|$)|\\.[a-zA-Z_]\\w*\\b)|(end|rescue|ensure|else|elsif)\\b|(in|when)\\s)"
    }
   }
  }
 },
 {
  "id": "rust",
  "aliases": [
   "Rust",
   "rust"
  ],
  "extensions": [
   ".rs"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^.*\\{[^}\"']*$|^.*\\([^\\)\"']*$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*(\\s*\\/[*].*[*]\\/\\s*)*[})]"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*//\\s*#?region\\b"
    },
    "end": {
     "source": "^\\s*//\\s*#?endregion\\b"
    }
   }
  }
 },
 {
  "id": "scss",
  "aliases": [
   "SCSS",
   "scss"
  ],
  "extensions": [
   ".scss"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "[",
     "close": "]",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "(",
     "close": ")",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "wordPattern": {
    "source": "(#?-?\\d*\\.\\d\\w*%?)|(::?[\\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\\w-?]+%?|[@#!$.])"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "(^.*\\{[^}]*$)"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*\\}"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^[\\s]*///.*$"
     },
     "action": {
      "indent": "none",
      "appendText": "/// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*\\/\\*\\s*#region\\b\\s*(?<label>.*?)\\s*\\*\\/"
    },
    "end": {
     "source": "^\\s*\\/\\*\\s*#endregion\\b.*\\*\\/"
    }
   }
  }
 },
 {
  "id": "search-result",
  "aliases": [
   "Search Result"
  ],
  "extensions": [
   ".code-search"
  ]
 },
 {
  "id": "shaderlab",
  "aliases": [
   "ShaderLab",
   "shaderlab"
  ],
  "extensions": [
   ".shader"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    }
   ]
  }
 },
 {
  "id": "shellscript",
  "aliases": [
   "Shell Script",
   "shellscript",
   "bash",
   "fish",
   "sh",
   "zsh",
   "ksh",
   "csh"
  ],
  "extensions": [
   ".sh",
   ".bash",
   ".bashrc",
   ".bash_aliases",
   ".bash_profile",
   ".bash_login",
   ".ebuild",
   ".eclass",
   ".profile",
   ".bash_logout",
   ".xprofile",
   ".xsession",
   ".xsessionrc",
   ".Xsession",
   ".zsh",
   ".zshrc",
   ".zprofile",
   ".zlogin",
   ".zlogout",
   ".zshenv",
   ".zsh-theme",
   ".fish",
   ".ksh",
   ".csh",
   ".cshrc",
   ".tcshrc",
   ".yashrc",
   ".yash_profile"
  ],
  "filenames": [
   "APKBUILD",
   "PKGBUILD",
   ".envrc",
   ".hushlogin",
   "zshrc",
   "zshenv",
   "zlogin",
   "zprofile",
   "zlogout",
   "bashrc_Apple_Terminal",
   "zshrc_Apple_Terminal"
  ],
  "firstLine": "^#!.*\\b(bash|fish|zsh|sh|ksh|dtksh|pdksh|mksh|ash|dash|yash|sh|csh|jcsh|tcsh|itcsh).*|^#\\s*-\\*-[^*]*mode:\\s*shell-script[^*]*-\\*-",
  "rules": {
   "lineComment": "#",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "`",
     "close": "`"
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*#\\s*#?region\\b"
    },
    "end": {
     "source": "^\\s*#\\s*#?endregion\\b.*"
    }
   }
  }
 },
 {
  "id": "sql",
  "aliases": [
   "MS SQL",
   "T-SQL"
  ],
  "extensions": [
   ".sql",
   ".dsql"
  ],
  "rules": {
   "lineComment": "--",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "N'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "`",
     "close": "`"
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*--\\s*#region\\b"
    },
    "end": {
     "source": "^\\s*--\\s*#endregion\\b"
    },
    "offSide": true
   }
  }
 },
 {
  "id": "swift",
  "aliases": [
   "Swift",
   "swift"
  ],
  "extensions": [
   ".swift"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "`",
     "close": "`"
    }
   ],
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ]
  }
 },
 {
  "id": "typescript",
  "aliases": [
   "TypeScript",
   "ts",
   "typescript"
  ],
  "extensions": [
   ".ts",
   ".cts",
   ".mts"
  ],
  "firstLine": "^#!.*\\b(deno|bun|ts-node)\\b",
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "${",
     "close": "}"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "${",
     "close": "}"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "/**",
     "close": " */",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "${",
     "close": "}"
    },
    {
     "open": "$",
     "close": ""
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "autoCloseBefore": ";:.,=}])>` \n\t",
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\@\\~\\!\\%\\^\\&\\*\\(\\)\\-\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>/\\?\\s]+)"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^.*(\\{[^}]*|\\([^)]*|\\[[^\\]]*)$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*[\\}\\]\\)].*$"
    },
    "indentNextLinePattern": {
     "source": "^((.*=>\\s*)|((.*[^\\w]+|\\s*)((if|while|for)\\s*\\(.*\\)\\s*|else\\s*)))$"
    },
    "unIndentedLinePattern": {
     "source": "^(\\t|[ ])*[ ]\\*[^/]*\\*/\\s*$|^(\\t|[ ])*[ ]\\*/\\s*$|^(\\t|[ ])*\\*([ ]([^\\*]|\\*(?!/))*)?$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*/\\*\\*(?!/)([^\\*]|\\*(?!/))*$"
     },
     "afterText": {
      "source": "^\\s*\\*/$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": " * "
     }
    },
    {
     "beforeText": {
      "source": "^\\s*/\\*\\*(?!/)([^\\*]|\\*(?!/))*$"
     },
     "action": {
      "indent": "none",
      "appendText": " * "
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*\\*([ ]([^\\*]|\\*(?!/))*)?$"
     },
     "previousLineText": {
      "source": "(?=^(\\s*(/\\*\\*|\\*)).*)(?=(?!(\\s*\\*/)))"
     },
     "action": {
      "indent": "none",
      "appendText": "* "
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*[ ]\\*/\\s*$"
     },
     "action": {
      "indent": "none",
      "removeText": 1
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*[ ]\\*[^/]*\\*/\\s*$"
     },
     "action": {
      "indent": "none",
      "removeText": 1
     }
    },
    {
     "beforeText": {
      "source": "^\\s*(\\bcase\\s.+:|\\bdefault:)$"
     },
     "afterText": {
      "source": "^(?!\\s*(\\bcase\\b|\\bdefault\\b))"
     },
     "action": {
      "indent": "indent"
     }
    },
    {
     "beforeText": {
      "source": "^\\s+([^{i\\s]|i(?!f\\b))"
     },
     "previousLineText": {
      "source": "^\\s*(((else ?)?if|for|while)\\s*\\(.*\\)\\s*|else\\s*)$"
     },
     "action": {
      "indent": "outdent"
     }
    },
    {
     "beforeText": {
      "source": "^.*\\([^\\)]*$"
     },
     "afterText": {
      "source": "^\\s*\\).*$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": "\t"
     }
    },
    {
     "beforeText": {
      "source": "^.*\\{[^\\}]*$"
     },
     "afterText": {
      "source": "^\\s*\\}.*$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": "\t"
     }
    },
    {
     "beforeText": {
      "source": "^.*\\[[^\\]]*$"
     },
     "afterText": {
      "source": "^\\s*\\].*$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": "\t"
     }
    },
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*//\\s*#?region\\b"
    },
    "end": {
     "source": "^\\s*//\\s*#?endregion\\b"
    }
   }
  }
 },
 {
  "id": "typescriptreact",
  "aliases": [
   "TypeScript JSX",
   "TypeScript React",
   "tsx"
  ],
  "extensions": [
   ".tsx"
  ],
  "rules": {
   "lineComment": "//",
   "blockComment": {
    "open": "/*",
    "close": "*/"
   },
   "brackets": [
    {
     "open": "${",
     "close": "}"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "${",
     "close": "}"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "`",
     "close": "`",
     "notIn": [
      "string",
      "comment"
     ]
    },
    {
     "open": "/**",
     "close": " */",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "${",
     "close": "}"
    },
    {
     "open": "$",
     "close": ""
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "`",
     "close": "`"
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "autoCloseBefore": ";:.,=}])>` \n\t",
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\@\\~\\!\\%\\^\\&\\*\\(\\)\\-\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>/\\?\\s]+)"
   },
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^.*(\\{[^}]*|\\([^)]*|\\[[^\\]]*)$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*[\\}\\]\\)].*$"
    },
    "indentNextLinePattern": {
     "source": "^((.*=>\\s*)|((.*[^\\w]+|\\s*)((if|while|for)\\s*\\(.*\\)\\s*|else\\s*)))$"
    },
    "unIndentedLinePattern": {
     "source": "^(\\t|[ ])*[ ]\\*[^/]*\\*/\\s*$|^(\\t|[ ])*[ ]\\*/\\s*$|^(\\t|[ ])*\\*([ ]([^\\*]|\\*(?!/))*)?$"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*/\\*\\*(?!/)([^\\*]|\\*(?!/))*$"
     },
     "afterText": {
      "source": "^\\s*\\*/$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": " * "
     }
    },
    {
     "beforeText": {
      "source": "^\\s*/\\*\\*(?!/)([^\\*]|\\*(?!/))*$"
     },
     "action": {
      "indent": "none",
      "appendText": " * "
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*\\*([ ]([^\\*]|\\*(?!/))*)?$"
     },
     "previousLineText": {
      "source": "(?=^(\\s*(/\\*\\*|\\*)).*)(?=(?!(\\s*\\*/)))"
     },
     "action": {
      "indent": "none",
      "appendText": "* "
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*[ ]\\*/\\s*$"
     },
     "action": {
      "indent": "none",
      "removeText": 1
     }
    },
    {
     "beforeText": {
      "source": "^(\\t|[ ])*[ ]\\*[^/]*\\*/\\s*$"
     },
     "action": {
      "indent": "none",
      "removeText": 1
     }
    },
    {
     "beforeText": {
      "source": "^\\s*(\\bcase\\s.+:|\\bdefault:)$"
     },
     "afterText": {
      "source": "^(?!\\s*(\\bcase\\b|\\bdefault\\b))"
     },
     "action": {
      "indent": "indent"
     }
    },
    {
     "beforeText": {
      "source": "^\\s+([^{i\\s]|i(?!f\\b))"
     },
     "previousLineText": {
      "source": "^\\s*(((else ?)?if|for|while)\\s*\\(.*\\)\\s*|else\\s*)$"
     },
     "action": {
      "indent": "outdent"
     }
    },
    {
     "beforeText": {
      "source": "^.*\\([^\\)]*$"
     },
     "afterText": {
      "source": "^\\s*\\).*$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": "\t"
     }
    },
    {
     "beforeText": {
      "source": "^.*\\{[^\\}]*$"
     },
     "afterText": {
      "source": "^\\s*\\}.*$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": "\t"
     }
    },
    {
     "beforeText": {
      "source": "^.*\\[[^\\]]*$"
     },
     "afterText": {
      "source": "^\\s*\\].*$"
     },
     "action": {
      "indent": "indentOutdent",
      "appendText": "\t"
     }
    },
    {
     "beforeText": {
      "source": "^\\s*//\\s*\\S|\\s//\\s+\\S"
     },
     "afterText": {
      "source": "^(?!\\s*$)"
     },
     "action": {
      "indent": "none",
      "appendText": "// "
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*//\\s*#?region\\b"
    },
    "end": {
     "source": "^\\s*//\\s*#?endregion\\b"
    }
   }
  }
 },
 {
  "id": "vb",
  "aliases": [
   "Visual Basic",
   "vb"
  ],
  "extensions": [
   ".vb",
   ".brs",
   ".vbs",
   ".bas",
   ".vba"
  ],
  "rules": {
   "lineComment": "'",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^\\s*((If|ElseIf)\\b.*\\bThen\\s*(('|REM).*)?|(Else|While|For|Do|Select\\s+Case|Case|Sub|Function|Class|Module|Enum|Structure|Interface|Namespace|With|Try|Catch|Finally|SyncLock|Using|Property|Get|Set|AddHandler|RaiseEvent|RemoveHandler|Event|Operator)\\b(?!.*\\bEnd\\s+(If|Sub|Function|Class|Module|Enum|Structure|Interface|Namespace|With|Select|Try|While|For|Property|Get|Set|SyncLock|Using|AddHandler|RaiseEvent|RemoveHandler|Event|Operator)\\b).*(('|REM).*)?)$",
     "flags": "i"
    },
    "decreaseIndentPattern": {
     "source": "^\\s*((End\\s+(If|Sub|Function|Class|Module|Enum|Structure|Interface|Namespace|With|Select|Try|While|For|Property|Get|Set|SyncLock|Using|AddHandler|RaiseEvent|RemoveHandler|Event|Operator))|Else|ElseIf|Case|Catch|Finally|Loop|Next|Wend|Until)\\b",
     "flags": "i"
    }
   },
   "onEnterRules": [
    {
     "beforeText": {
      "source": "^\\s*((End\\s+(If|Sub|Function|Class|Module|Enum|Structure|Interface|Namespace|With|Select|Try|While|For|Property|Get|Set|SyncLock|Using|AddHandler|RaiseEvent|RemoveHandler|Event|Operator))|Loop|Next|Wend|Until)\\b.*$",
      "flags": "i"
     },
     "action": {
      "indent": "none"
     }
    },
    {
     "beforeText": {
      "source": "^\\s*$"
     },
     "previousLineText": {
      "source": "^\\s*((End\\s+(If|Sub|Function|Class|Module|Enum|Structure|Interface|Namespace|With|Select|Try|While|For|Property|Get|Set|SyncLock|Using|AddHandler|RaiseEvent|RemoveHandler|Event|Operator))|Loop|Next|Wend|Until)\\b.*$",
      "flags": "i"
     },
     "action": {
      "indent": "none"
     }
    }
   ],
   "folding": {
    "start": {
     "source": "^\\s*#Region\\b"
    },
    "end": {
     "source": "^\\s*#End Region\\b"
    }
   }
  }
 },
 {
  "id": "xml",
  "aliases": [
   "XML",
   "xml"
  ],
  "extensions": [
   ".xml",
   ".xsd",
   ".ascx",
   ".atom",
   ".axml",
   ".axaml",
   ".bpmn",
   ".cpt",
   ".csl",
   ".csproj",
   ".csproj.user",
   ".dita",
   ".ditamap",
   ".dtd",
   ".ent",
   ".mod",
   ".dtml",
   ".fsproj",
   ".fxml",
   ".iml",
   ".isml",
   ".jmx",
   ".launch",
   ".menu",
   ".mxml",
   ".nuspec",
   ".opml",
   ".owl",
   ".proj",
   ".props",
   ".pt",
   ".publishsettings",
   ".pubxml",
   ".pubxml.user",
   ".rbxlx",
   ".rbxmx",
   ".rdf",
   ".rng",
   ".rss",
   ".shproj",
   ".slnx",
   ".storyboard",
   ".svg",
   ".targets",
   ".tld",
   ".tmx",
   ".vbproj",
   ".vbproj.user",
   ".vcxproj",
   ".vcxproj.filters",
   ".wixproj",
   ".wsdl",
   ".wxi",
   ".wxl",
   ".wxs",
   ".xaml",
   ".xbl",
   ".xib",
   ".xlf",
   ".xliff",
   ".xpdl",
   ".xul",
   ".xoml"
  ],
  "firstLine": "(\\<\\?xml.*)|(\\<svg)|(\\<\\!doctype\\s+svg)",
  "rules": {
   "blockComment": {
    "open": "<!--",
    "close": "-->"
   },
   "brackets": [
    {
     "open": "<!--",
     "close": "-->"
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\"",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "'",
     "close": "'",
     "notIn": [
      "string"
     ]
    },
    {
     "open": "<!--",
     "close": "-->",
     "notIn": [
      "comment",
      "string"
     ]
    }
   ],
   "surroundingPairs": [
    {
     "open": "'",
     "close": "'"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "<",
     "close": ">"
    }
   ],
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\#\\$\\%\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\?\\s]+)"
   },
   "folding": {
    "start": {
     "source": "^\\s*<!--\\s*#region\\b\\s*(?<label>.*?)\\s*-->"
    },
    "end": {
     "source": "^\\s*<!--\\s*#endregion\\b.*-->"
    }
   }
  }
 },
 {
  "id": "xsl",
  "aliases": [
   "XSL",
   "xsl"
  ],
  "extensions": [
   ".xsl",
   ".xslt"
  ],
  "rules": {
   "lineComment": "",
   "blockComment": {
    "open": "<!--",
    "close": "-->"
   },
   "brackets": [
    {
     "open": "<!--",
     "close": "-->"
    },
    {
     "open": "<",
     "close": ">"
    },
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "[",
     "close": "]"
    }
   ],
   "wordPattern": {
    "source": "(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\@\\#\\$\\%\\^\\&\\*\\(\\)\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\?\\s]+)"
   }
  }
 },
 {
  "id": "dockercompose",
  "aliases": [
   "Compose",
   "compose"
  ],
  "filenamePatterns": [
   "compose.yml",
   "compose.yaml",
   "compose.*.yml",
   "compose.*.yaml",
   "*docker*compose*.yml",
   "*docker*compose*.yaml"
  ],
  "rules": {
   "lineComment": "#",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^\\s*.*(:|-) ?(&amp;\\w+)?(\\{[^}\"']*|\\([^)\"']*)?$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s+\\}$"
    }
   },
   "folding": {
    "start": {
     "source": "^\\s*#\\s*region\\b"
    },
    "end": {
     "source": "^\\s*#\\s*endregion\\b"
    },
    "offSide": true
   }
  }
 },
 {
  "id": "yaml",
  "aliases": [
   "YAML",
   "yaml"
  ],
  "extensions": [
   ".yaml",
   ".yml",
   ".eyaml",
   ".eyml",
   ".cff",
   ".yaml-tmlanguage",
   ".yaml-tmpreferences",
   ".yaml-tmtheme",
   ".winget"
  ],
  "firstLine": "^#cloud-config",
  "rules": {
   "lineComment": "#",
   "brackets": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    }
   ],
   "autoClosingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "surroundingPairs": [
    {
     "open": "{",
     "close": "}"
    },
    {
     "open": "[",
     "close": "]"
    },
    {
     "open": "(",
     "close": ")"
    },
    {
     "open": "\"",
     "close": "\""
    },
    {
     "open": "'",
     "close": "'"
    }
   ],
   "indentationRules": {
    "increaseIndentPattern": {
     "source": "^\\s*.*(:|-) ?(&amp;\\w+)?(\\{[^}\"']*|\\([^)\"']*)?$"
    },
    "decreaseIndentPattern": {
     "source": "^\\s+\\}$"
    }
   },
   "folding": {
    "start": {
     "source": "^\\s*#\\s*region\\b"
    },
    "end": {
     "source": "^\\s*#\\s*endregion\\b"
    },
    "offSide": true
   }
  }
 }
]
