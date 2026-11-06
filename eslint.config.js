const globals = require("globals");
const js = require("@eslint/js");

module.exports = [
    js.configs.recommended,
    {
        ignores: ["src/public/js/app-bundle.min.js", "src/public/vendor/**", "dist/**", "**/*.min.js"]
    },
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                firebase: "readonly",
                CONFIG: "readonly",
                DOMPurify: "readonly",
                window: "readonly",
                document: "readonly",
                console: "readonly"
            },
            ecmaVersion: "latest",
            sourceType: "module"
        },
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "AssignmentExpression[left.property.name='innerHTML']",
                    "message": "[OWASP V5.0.0-3.2.2] L'utilisation de 'innerHTML' est strictement interdite pour prévenir les failles XSS. Utilisez 'textContent' ou 'window.DOMSecurity.safeHTML()' pour injecter du HTML sécurisé."
                }
            ],
            "no-console": ["warn", { allow: ["warn", "error", "info", "log"] }],
            "no-var": "off", // Legacy code uses var heavily
            "prefer-const": "off", // Legacy code doesn't use const properly
            "no-undef": "off", // Legacy global scripts
            "no-unused-vars": "off", // Legacy functions
            "no-empty": "off", // Legacy empty catch blocks
            "no-case-declarations": "off", // Legacy switch cases
            "no-useless-assignment": "off",
            "no-irregular-whitespace": "off"
        }
    }
];
