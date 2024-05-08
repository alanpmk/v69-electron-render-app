const { app, BrowserWindow } = require("electron");
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const { ipcMain, dialog } = require("electron");
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { shell } = require('electron');

let ffmpegPath = require('ffmpeg-static-electron').path;
ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked')
let ffprobePath = require('ffprobe-static-electron').path;
ffprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked')
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
// Create fforobe promisified
const ffprobe = util.promisify(require('fluent-ffmpeg').ffprobe);


let watermarkPath = (path.join(__dirname, 'static', 'viet69watermark.png'));
watermarkPath = watermarkPath.replace('app.asar', 'app.asar.unpacked');

// Khai báo biến mainWin để lưu trữ Window
let mainWin;

/**
 * Hàm dùng để khởi tạo Window
 */
const createWindow = () => {
  // Tạo Window mới với
  mainWin = new BrowserWindow({
    width: 800,
    height: 650,
    minWidth:600,
    minHeight:600,
    icon: "",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Không cần menu
  mainWin.removeMenu();

  // Tải file html và hiển thị
  mainWin.loadFile("./index.html");

 let devTools = new BrowserWindow();
  devTools.removeMenu();
mainWin.webContents.setDevToolsWebContents(devTools.webContents);
mainWin.webContents.openDevTools({ mode: 'detach' });
};

// Sau khi khởi động thì mở Window
app.whenReady().then(createWindow);

// Xử lý sau khi Window được đóng
app.on("window-all-closed", () => {
  app.quit();
});

// Xử lý khi app ở trạng thái active, ví dụ click vào icon
app.on("activate", () => {
  // Mở window mới khi không có window nào
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("select-folder", async () => {
  const pathObj = await dialog.showOpenDialog(mainWin, {
    properties: ["openDirectory"],
  });
  return pathObj;
});


ipcMain.handle("render", (_, data) => {

  const originVideosDir = data.folder;
  const renderedVideosDir = path.join(data.folder, 'rendered_videos');

  // Check if the directory exists
  if (!fs.existsSync(renderedVideosDir)) {
    // If the directory doesn't exist, create it
    fs.mkdirSync(renderedVideosDir);
  }
  function getFormattedDate() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); //January is 0!
    return day + '-' + month;
  }

  //2nd function renderwithWTM using async/await syntax
  async function renderwithWTM2(vidname,index) {
    try {
      const data = await ffprobe(path.join(originVideosDir, vidname));
      const width = data.streams[0].width;
      const height = data.streams[0].height;
      const orientation = width > height ? 'landscape' : 'portrait';
      const outputDir = path.join(renderedVideosDir, getFormattedDate());
      fs.mkdirSync(outputDir, { recursive: true });

      // Create ffmpeg command
      const command = ffmpeg(path.join(originVideosDir, vidname))
        .input(watermarkPath) // Add watermark image as input
        .complexFilter([
          // Overlay watermark at bottom right
          '[0:v][1:v]overlay=W-w-10:H-h-10'
        ])
        .output(path.join(outputDir, vidname + '_watermark.mp4'))
        .on('progress', (progress) => {
          console.log('Processing: ' + progress.percent + '% done');
          mainWin.webContents.send("got-progress", { vidname, percent: progress.percent, index });
        })
        .on('error', (err) => {
          console.log('An error occurred: ' + err.message);
          throw err;
        });

      // Run ffmpeg command and wait for it to finish
      await new Promise((resolve, reject) => {
        command.on('end', () => {
          console.log('Processing finished!');
          resolve();
        }).run();
      });

      return orientation;
    } catch (err) {
      console.error('An error occurred:', err);
      throw err;
    }
  }

  function screenshot(vidname, orientation) {
    return new Promise((resolve, reject) => {
      const outputDir = path.join(renderedVideosDir, getFormattedDate());
      const proc = ffmpeg(path.join(renderedVideosDir, getFormattedDate(), vidname + '_watermark.mp4'));
      proc.ffprobe(function (err, data) {
        if (err) {
          console.log('An error occurred: ' + err.message);
          reject(err);
        } else {
          const duration = data.format.duration;
          const times = [];
          // Add your screenshot logic here
          for (let i = 0; i < 6; i++) {
            times.push((Math.random() * duration).toFixed(0));
          }

          proc
            .on('error', function (err) {
              console.log('An error occurred: ' + err.message);
            })
            .screenshots({
              timestamps: times,
              filename: vidname + `-screenshot-%s.jpg`,
              folder: outputDir,
              size: '?x480' // resize height to 720px and calculate width to keep aspect ratio
            })
            .on('end', function () {
              console.log('Screenshots taken');
              console.log(times);
              if (orientation === 'portrait') {
                for (let i = 0; i < times.length; i += 2) {
                  const imagePath1 = path.resolve(outputDir, vidname + '-screenshot-' + times[i] + '.jpg');
                  const imagePath2 = path.resolve(outputDir, vidname + '-screenshot-' + times[i + 1] + '.jpg');
                  const spacerPath = path.resolve(outputDir, 'spacer.png');
                  const outputPath = path.resolve(outputDir, vidname + '-combined-' + i / 2 + '.jpg');
                  const mergeImgRes = processImages(imagePath1, imagePath2, spacerPath, outputPath, watermarkPath);
                  if (mergeImgRes) {
                    resolve();
                  }
                }
              } else {
                times.forEach((time, index) => {
                  const imagePath = path.resolve(outputDir, vidname + '-screenshot-' + time + '.jpg');
                  const outputPath = path.resolve(outputDir, vidname + '-combined-' + index + '.jpg');
                  const mergeImgRes = processImages(imagePath, null, null, outputPath, watermarkPath);
                  if (mergeImgRes) {
                    resolve();
                  }
                });
              }
            })
        }
      });
    });
  }

  async function processImages(imagePath1, imagePath2, spacerPath, outputPath, watermarkPath) {
    try {
      if (!imagePath2 && !spacerPath) {
        const watermarkCommand = `magick convert "${imagePath1}" "${watermarkPath}"  -gravity center -composite "${outputPath}"`;
        await exec(watermarkCommand);
        console.log('process image done');
        return true;
      }
      const createSpacerCommand = `magick convert -size 20x480 xc:black "${spacerPath}"`;
      await exec(createSpacerCommand);

      const combineCommand = `magick convert "${imagePath1}" "${spacerPath}" "${imagePath2}" +append -resize 1024x768 -background black -gravity center -extent 1024x768 "${outputPath}"`;
      await exec(combineCommand);

      const watermarkCommand = `magick convert "${outputPath}" "${watermarkPath}"  -gravity center -composite "${outputPath}"`;
      await exec(watermarkCommand);

      console.log('process image done');
      if (fs.existsSync(imagePath1)) {
        fs.unlinkSync(imagePath1);
      }
      if (fs.existsSync(imagePath2)) {
        fs.unlinkSync(imagePath2);
      }

      return true;

    } catch (err) {
      console.error('An error occurred:', err);
    }
  }

  async function processFiles() {
    try {
      const files = await fs.promises.readdir(data.folder);

      const videoExtensions = ['.mp4', '.mov', '.avi', '.MP4', '.MOV'];

      const videoFiles = files.filter(file => {
        const extension = path.extname(file);
        return videoExtensions.includes(extension);
      });
      mainWin.webContents.send("render-progressbar", { videoFiles });

      const promises = videoFiles.map(async (file,index) => {
        try {
          const orientation = await renderwithWTM2(file,index);
          console.log('Da xu ly xong video: ', file, ' orientation: ', orientation);
          await screenshot(file, orientation);
        } catch (err) {
          console.error('Error during renderwithWTM or screenshot:', err);
        }
      });

      await Promise.all(promises);

      // dialog.showMessageBox(mainWin, {
      //   message: "Successfully rendered videos and took screenshots!",
      //   type: "info",
      // }).then(() => {
      //   shell.openPath(path.join(renderedVideosDir, getFormattedDate()));
      // });

    } catch (err) {
      console.error('Error during processing:', err);
      dialog.showMessageBoxSync(mainWin, {
        message: 'Error during processing, please try again: ' + err,
        type: "info",
      });
    }
  }

  processFiles();

});
