/** @type {import("webpack").Configuration} */
module.exports = {
  externals: [
    "@prisma/client",
    "redis",
    "thread-stream",
    "swagger-ui-express",
    /^swagger-ui-dist/,
    "express",
  ],
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
