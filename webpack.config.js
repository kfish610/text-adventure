const path = require("path");

module.exports = {
    entry: "./src/index.ts",
    devtool: "inline-source-map",
    mode: "development",
    resolve: {
        extensions: [".cson", ".tsx", ".ts", ".js"],
    },
    module: {
        rules: [
            { test: /\.cson$/, use: "cson-loader" },
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    output: {
        filename: "main.js",
        path: path.resolve(__dirname, "dist"),
        clean: true,
    },
};
