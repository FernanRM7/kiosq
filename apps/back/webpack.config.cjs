const nodeExternals = require("webpack-node-externals");

/** @type {import("webpack").Configuration} */
module.exports = {
  externals: [nodeExternals()],
  module: {
    rules: [
      {
        exclude: /node_modules/u,
        test: /\.ts$/u,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: true,
          },
        },
      },
    ],
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  output: {
    libraryTarget: "commonjs2",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
};
