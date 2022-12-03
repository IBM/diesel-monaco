import { defineConfig } from 'vite';
// import path from 'path';

export default defineConfig({

    "optimizeDeps": {
        "include": ["@diesel-parser/monaco"],
    },
    "build": {
        "commonjsOptions": {
            "include": [/@diesel-parser\/monaco/, /node_modules/],
        },
    },
    server: {
        port: 8080
    }
});
