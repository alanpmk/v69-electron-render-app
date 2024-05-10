const builder = require("electron-builder");

builder.build({
  config: {
    appId: "electron.V69Render",
    productName: "V69 Render Watermark",
    win: {
      target: {
        target: "zip",
        arch: "x64",
      },
      icon: "./static/viet69_ico_app"
    },
    asar: true,
    asarUnpack: [
      // "**/static/viet69watermark.png",
      // "**/node_modules/ffmpeg-static-electron/**/*",
      // "**/node_modules/ffprobe-static-electron/**/*"
    ]
  }
});
