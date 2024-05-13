const builder = require("electron-builder");

builder.build({
  config: {
    appId: "electron.V69Render",
    productName: "V69 Render Watermark",
    win: {
      target: {
        target: "nsis",
        arch: "x64",
      },
      icon: "./static/viet69_ico_app"
    },
    asar: true,
    asarUnpack: [
      "**/static/ffmpeg-static/ffmpeg.exe",
      "**/static/ffprobe-static/ffprobe.exe",
      "**/static/config_ex.json",
    ]
  }
});
