/** @type {import("webpack").Configuration} */
module.exports = {
  externals: [],
  module: {
    rules: [
      {
        exclude: /node_modules/u,
        test: /\.ts$/u,
        use: {
          loader: "esbuild-loader",
          options: {
            loader: "ts",
            target: "es2023",
          },
        },
      },
    ],
  },
  output: {
    libraryTarget: "commonjs2",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
};
