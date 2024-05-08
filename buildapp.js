const builder = require("electron-builder");

builder.build({
  config: {
    appId: "electron.renderviet69",
    productName: "RenderViet69",
    win: {
      target: {
        target: "zip",
        arch: "x64",
      },
    },
    asar: true,
    asarUnpack: [
      "**/static/viet69watermark.png",
      "**/node_modules/ffmpeg-static-electron/**/*",
      "**/node_modules/ffprobe-static-electron/**/*"
    ]
  }
});
