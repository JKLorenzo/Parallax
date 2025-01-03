export default [
  {
    "env": {
      "es2021": true,
      "node": true
    },
    "extends": [
      "eslint:recommended",
      "plugin:prettier/recommended",
      "plugin:@typescript-eslint/recommended"
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
      "ecmaVersion": "latest",
      "sourceType": "module"
    },
    "plugins": ["import", "prettier", "@typescript-eslint"],
    "rules": {
      "import/order": [
        "error",
        {
          "groups": ["builtin", "external", "internal", "index", "sibling", "parent"],
          "alphabetize": {
            "order": "asc"
          }
        }
      ],
      "import/no-cycle": [
        "error",
        {
          "maxDepth": "∞"
        }
      ],
      "prettier/prettier": [
        "error",
        {
          "printWidth": 100,
          "singleQuote": true,
          "quoteProps": "as-needed",
          "trailingComma": "all",
          "endOfLine": "lf",
          "arrowParens": "avoid",
          "max-statements-per-line": [
            "error",
            {
              "max": 2
            }
          ]
        }
      ],
      "@typescript-eslint/no-redeclare": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-shadow": ["error"],
      "strict": ["error", "global"],
      "no-compare-neg-zero": "error",
      "no-template-curly-in-string": "error",
      "no-unsafe-negation": "error",
      "accessor-pairs": "warn",
      "array-callback-return": "error",
      "curly": ["error", "multi-line"],
      "dot-location": ["error", "property"],
      "dot-notation": "error",
      "eqeqeq": "error",
      "no-floating-decimal": "error",
      "no-implied-eval": "error",
      "no-invalid-this": "error",
      "no-lone-blocks": "error",
      "no-multi-spaces": "error",
      "no-new-func": "error",
      "no-new-wrappers": "error",
      "no-new": "error",
      "no-octal-escape": "error",
      "no-return-assign": "error",
      "no-return-await": "error",
      "no-self-compare": "error",
      "no-sequences": "error",
      "no-throw-literal": "error",
      "no-unmodified-loop-condition": "error",
      "no-unused-expressions": "error",
      "no-useless-call": "error",
      "no-useless-concat": "error",
      "no-useless-escape": "error",
      "no-useless-return": "error",
      "no-void": "error",
      "no-warning-comments": "warn",
      "prefer-promise-reject-errors": "error",
      "require-await": "warn",
      "wrap-iife": "error",
      "yoda": "error",
      "no-label-var": "error",
      "no-shadow": "off",
      "no-undef-init": "error",
      "callback-return": "error",
      "getter-return": "off",
      "handle-callback-err": "error",
      "no-mixed-requires": "error",
      "no-new-require": "error",
      "no-path-concat": "error",
      "array-bracket-spacing": "error",
      "block-spacing": "error",
      "brace-style": [
        "error",
        "1tbs",
        {
          "allowSingleLine": true
        }
      ],
      "capitalized-comments": [
        "error",
        "always",
        {
          "ignoreConsecutiveComments": true
        }
      ],
      "comma-dangle": ["error", "always-multiline"],
      "comma-spacing": "error",
      "comma-style": "error",
      "computed-property-spacing": "error",
      "consistent-this": ["error", "$this"],
      "eol-last": "error",
      "func-names": "error",
      "func-name-matching": "error",
      "func-style": [
        "error",
        "declaration",
        {
          "allowArrowFunctions": true
        }
      ],
      "key-spacing": "error",
      "keyword-spacing": "error",
      "max-depth": "off",
      "max-len": [
        "error",
        {
          "code": 120,
          "tabWidth": 2,
          "ignoreComments": true
        }
      ],
      "max-nested-callbacks": [
        "error",
        {
          "max": 4
        }
      ],
      "max-statements-per-line": [
        "error",
        {
          "max": 2
        }
      ],
      "new-cap": "off",
      "no-array-constructor": "error",
      "no-inline-comments": "error",
      "no-lonely-if": "error",
      "no-multiple-empty-lines": [
        "error",
        {
          "max": 2,
          "maxEOF": 1,
          "maxBOF": 0
        }
      ],
      "no-new-object": "error",
      "no-spaced-func": "error",
      "no-trailing-spaces": "error",
      "no-unneeded-ternary": "error",
      "no-whitespace-before-property": "error",
      "nonblock-statement-body-position": "error",
      "object-curly-spacing": ["error", "always"],
      "operator-assignment": "error",
      "padded-blocks": ["error", "never"],
      "quote-props": ["error", "as-needed"],
      "quotes": [
        "error",
        "single",
        {
          "avoidEscape": true,
          "allowTemplateLiterals": true
        }
      ],
      "semi-spacing": "error",
      "semi": "error",
      "space-before-blocks": "error",
      "space-before-function-paren": [
        "error",
        {
          "anonymous": "never",
          "named": "never",
          "asyncArrow": "always"
        }
      ],
      "sort-imports": [
        "off",
        {
          "ignoreCase": false,
          "ignoreDeclarationSort": false,
          "ignoreMemberSort": false,
          "memberSyntaxSortOrder": ["none", "all", "multiple", "single"]
        }
      ],
      "space-in-parens": "error",
      "space-infix-ops": "error",
      "space-unary-ops": "error",
      "spaced-comment": "error",
      "template-tag-spacing": "error",
      "unicode-bom": "error",
      "arrow-body-style": "error",
      "arrow-parens": ["error", "as-needed"],
      "arrow-spacing": "error",
      "no-duplicate-imports": "error",
      "no-useless-computed-key": "error",
      "no-useless-constructor": "error",
      "prefer-arrow-callback": "error",
      "prefer-numeric-literals": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "prefer-template": "error",
      "rest-spread-spacing": "error",
      "template-curly-spacing": "error",
      "yield-star-spacing": "error"
    }
  }
]