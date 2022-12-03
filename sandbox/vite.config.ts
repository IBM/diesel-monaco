import { defineConfig } from 'vite';
// import path from 'path';

export default defineConfig({

    "optimizeDeps": {
        "include": ["@diesel-parsers/monaco"],
    },
    "build": {
        "commonjsOptions": {
            "include": [/@diesel-parsers\/monaco/, /node_modules/],
        },
    },
    server: {
        port: 8080
    }
});
