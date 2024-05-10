const { app, BrowserWindow } = require("electron");
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const { ipcMain, dialog } = require("electron");
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { shell } = require('electron');
const FormData = require('form-data');
const axios = require('axios');
const WPAPI = require('wpapi');
const Store = require('electron-store');
let ffmpegPath = require('ffmpeg-static-electron').path;
ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked')
let ffprobePath = require('ffprobe-static-electron').path;
ffprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked')
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
// Create fforobe promisified
const ffprobe = util.promisify(require('fluent-ffmpeg').ffprobe);
// Declare store
const store = new Store();
// let watermarkPath = (path.join(__dirname, 'static', 'viet69watermark.png'));
// watermarkPath = watermarkPath.replace('app.asar', 'app.asar.unpacked');


// Khai báo biến mainWin để lưu trữ Window
let mainWin;

/**
 * Hàm dùng để khởi tạo Window
 */
const createWindow = () => {
  // Tạo Window mới với
  mainWin = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 600,
    minHeight: 700,
    icon: "./static/viet69_ico_app.ico",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Không cần menu
  mainWin.removeMenu();

  // Tải file html và hiển thị
  mainWin.loadFile("./index.html");

  // Devtools cho debugs
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

//load config file if not exits first time
const userDataPath = app.getPath('userData');
const configPath = path.join(__dirname, "config.json");
const destinationConfigPath = path.join(userDataPath, 'config.json');
const dbPath = path.join(userDataPath, 'db.json');

// Check if the file exists at destinationConfigPath
if (!fs.existsSync(destinationConfigPath)) {
  // If the file doesn't exist, copy it
  fs.copyFile(configPath, destinationConfigPath, (err) => {
    if (err) throw err;
    console.log('config.json was copied to userDataPath');
  });
} else {
  console.log('config.json already exists at userDataPath');
}

// Xử lý khi app ở trạng thái active, ví dụ click vào icon
app.on("activate", () => {
  // Mở window mới khi không có window nào
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function loadConfig() {
  const jsonConfig = JSON.parse(fs.readFileSync(destinationConfigPath, 'utf-8'));
  return jsonConfig
}
//Loading database from db.json
function loadDb() {
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('An error occurred while loading the database:', error);
    return []; // Return an empty array if the data could not be loaded
  }
}
//save database to db.json
function saveDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db), 'utf-8');
};

//handle load config to config tab
ipcMain.handle('load-config', async () => {
  return loadConfig();
})


/**--------------------------------------------------------------------- */
/**----Handle ipcMain events--------------------------------------------**/
/**--------------------------------------------------------------------- */

// Handle select folder
ipcMain.handle("select-folder", async () => {
  const pathObj = await dialog.showOpenDialog(mainWin, {
    properties: ["openDirectory"],
  });
  return pathObj;
});

// Handle xử lý render lại videos với logo
ipcMain.handle("render", async (_, data) => {

  const originVideosDir = data.folder;
  const renderedVideosDir = path.join(data.folder, 'rendered_videos');
  const watermarkPath = data.logo;

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
  async function renderwithWTM2(vidname, index) {
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

      const promises = videoFiles.map(async (file, index) => {
        try {
          const orientation = await renderwithWTM2(file, index);
          console.log('Da xu ly xong video: ', file, ' orientation: ', orientation);
          await screenshot(file, orientation);
        } catch (err) {
          console.error('Error during renderwithWTM or screenshot:', err);
        }
      });

      await Promise.all(promises);

      return { status: 'success' };


    } catch (err) {
      console.error('Error during processing:', err);
      dialog.showMessageBoxSync(mainWin, {
        message: 'Có lỗi xảy ra, Vui lòng thử lại: ' + err,
        type: "info",
      });
      return { status: 'fail' };
    }
  }
  const res = await processFiles();
  if (res.status === 'success') {
    // shell.openPath(renderedVideosDir);
    dialog.showMessageBox(mainWin, {
      message: "Đã xử lý xong tất cả videos!",
      type: "info",
    }).then(() => {
      shell.openPath(path.join(renderedVideosDir, getFormattedDate()));
    });
  }
  return res;
});

// handle xử lý upload video lên helvid và getlink video
ipcMain.handle("getlink", async (_, data) => {

  // const originVideosDir = data.folder;
  // const renderedVideosDir = path.join(data.folder, 'rendered_videos');
  const inputDir = data.folder;
  const files = await fs.promises.readdir(inputDir);
  const config = loadConfig();

  // Check if the directory exists mp4 file
  const videoFiles = files.filter(file => {
    const extension = path.extname(file);
    return extension === '.mp4';
  });

  if (videoFiles.length === 0) {
    dialog.showMessageBoxSync(mainWin, {
      message: 'Không tìm thấy video mp4 nào',
      type: "info",
    });
    return { status: 'fail' };
  }

  const headers = { "Content-Type": "multipart/form-data" };

  const getAllVideos = async (apikey, page, per_page) => {
    try {
      const response = await axios.get(`${config.HELVID_URL}/api/myvideo?apikey=${apikey}&page=${page}&per_page=${per_page}`);
      console.log('Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('An error occurred:', error);
    }
  }

  console.log('Danh sách video cần upload:', videoFiles);
  // console.log(getAllVideos());
  // return { status: 'success' };

  const uploadFile = async (file, cid, fid, apikey, mycid) => {
    const formData = new FormData();
    formData.append('video', fs.createReadStream(file));
    formData.append('cid', cid);
    formData.append('fid', fid);
    formData.append('apikey', apikey);
    formData.append('mycid', mycid);

    try {
      const response = await axios.post(`${config.HELVID_URL}/api/upload`, formData, {
        headers: {
          ...formData.getHeaders(),
          ...headers
        },
        timeoutErrorMessage: 'Request timeout',
        timeout: 60000
      });
      //     console.log('Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('An error occurred:', error);
    }
  }

  async function uploadAllVideos() {
    let dids = [];
    // For each file, upload it and save the did to a file
    mainWin.webContents.send("getlink-progressbar", { length: videoFiles.length, files: videoFiles });

    try {
      //upload file lần lượt
      for (const [index, file] of videoFiles.entries()) {
        console.log('Đang upload file:', file);
        const res = await uploadFile(path.join(inputDir, file), '17', '18', config.HELVID_APIKEY, '1617');
        if (res) {
          console.log('Upload thanh cong');
          console.log('Response upload:', res);
          mainWin.webContents.send("got-getlink-progress", { file, index });
          const did = res.did;
          dids.push(did.toString());
        }
        else {
          console.log('Upload không thành công');
        }
      }
      //upload file song song
      // await Promise.all(videoFiles.map(async (file, index) => {
      //   console.log('Đang upload file:', file);
      //   const res = await uploadFile(path.join(inputDir, file), '17', '18', config.HELVID_APIKEY, '1617');
      //   if (res) {
      //     console.log('Upload thanh cong');
      //     mainWin.webContents.send("got-getlink-progress", { file, index });
      //     const did = res.did;
      //     dids.push(did.toString());
      //   }
      // }));



      // console.log("list ID videos la: ", dids);
      // Get all videos
      const res = await getAllVideos(config.HELVID_APIKEY, 1, 20);

      if (res && res.data) {
        const videosList = res.data;

        // Filter the videos to only include those with a did in the file
        const uploadedVideos = videosList.filter(video => dids.includes(video.id.toString()));
        const newUploadedVideos = uploadedVideos.map(video => {
          return {
            id: video.id,
            vid: video.vid,
            name: video.name,
            iframe: video.iframe,
          };
        });
        console.log(`Đã upload xong ${uploadedVideos.length} videos`);
        // fs.writeFileSync('uploaded_did.txt', JSON.stringify(newUploadedVideos, null, 2) + '\n');
        let db = loadDb();
        db = [...db, ...uploadedVideos];
        console.log('database la: ', db);
        saveDb(db);
        return db;
      }
    } catch (error) {
      console.error('An error occurred:', error);
    }
  }

  const res = await uploadAllVideos();

  return { status: 'success', allVideos: res };
});

/**--------------------------------------------------------------------- */
/**----Declaratation of function to process WPAPI-----------------------**/
/**--------------------------------------------------------------------- */
const userConfig = loadConfig();
const wp = new WPAPI({ endpoint: `${userConfig.WP_HOST}/wp-json` });

async function saveJWTToken(WP_HOST, username, password) {
  try {
    // Request a JWT token
    const response = await axios.post(`${WP_HOST}/wp-json/jwt-auth/v1/token`, {
      username,
      password
    });

    if (response.data.token) {
      store.set('jwt_token', response.data.token);
      return true;
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}
function setWpHeaders() {
  wp.setHeaders('Authorization', `Bearer ${store.get('jwt_token')}`);
}

async function checkValidJWTToken() {
  try {
    if (!store.has('jwt_token')) {
      return false;
    }
    const response = await axios.post(`${userConfig.HOST_API}/wp-json/jwt-auth/v1/token/validate`, {}, {
      headers: {
        Authorization: `Bearer ${store.get('jwt_token')}`
      }
    });

    if (response.data.data.status === 403) {
      return false;
    }
    return response.data.data.status === 200;
  } catch (error) {
    // console.error('An error occurred:', error);
  }

}


function getOrCreateTaxonomy(taxonomy, name) {
  return taxonomy.search(name).then(items => {
    if (items.length > 0) {
      // If the item exists, return its ID
      return items[0].id;
    } else {
      // If the item doesn't exist, create it and return its ID
      const slug = name.toLowerCase().replace(/ /g, '-');
      return taxonomy.create({ name, slug }).then(item => item.id);
    }
  });
}

//Get categories and tags
async function getAllItems(type) {
  let items = [];
  let pageNumber = 1;
  let areMoreItems = true;

  while (areMoreItems) {
    const newItems = await type.perPage(100).page(pageNumber).get();
    items = items.concat(newItems);
    if (newItems.length < 100) {
      areMoreItems = false;
    } else {
      pageNumber++;
    }
  }

  return items;
}

async function getCategoriesAndTags() {
  try {
    const categories = await getAllItems(wp.categories());
    const tags = await getAllItems(wp.tags());
    return { categories, tags };
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

async function handleUploadTabClicked() {
  try {
    if (!store.has('jwt_token')) {
      const tokenSaved = await saveJWTToken(userConfig.WP_HOST, userConfig.USERNAME, userConfig.PASSWORD);
      if (!tokenSaved) {
        throw new Error("Unable to save JWT token");
      }
      setWpHeaders();
    }

    if (!store.has('categories') || !store.has('tags')) {
      const { categories, tags } = await getCategoriesAndTags();
      store.set('categories', categories);
      store.set('tags', tags);
    }

    const message = store.has('jwt_token') ? "Đã tồn tại token" : "Đã get token";
    const jwtToken = store.get('jwt_token');
    const categories = store.get('categories');
    const tags = store.get('tags');

    return { message, jwtToken, status: 'success', categories, tags };
  } catch (error) {
    console.error('An error occurred:', error);
    return { message: "Có lỗi xảy ra, VUi lòng thử lại!", status: 'fail' };
  }
}

ipcMain.handle('upload-tab-clicked', handleUploadTabClicked);


async function createPost(title, content, categoryNames, tagNames, embed, imagePath, postViewsCount) {
  try {
    // Upload the image and get the media item
    const media = await wp.media().file(imagePath).create();

    // Get the image link
    const thumb = media.source_url;
    // Get the image ID
    const featured_media = media.id;
    console.log(thumb);
    // Get or create the categories and tags
    const categoryIds = await Promise.all(categoryNames.map(name => getOrCreateTaxonomy(wp.categories(), name)));
    const tagIds = await Promise.all(tagNames.map(name => getOrCreateTaxonomy(wp.tags(), name)));

    // Create the post with the category and tag IDs, the meta, and the image link
    const post = await wp.posts().create({
      title,
      content,
      // status: 'draft',
      status: 'publish',
      categories: categoryIds,
      tags: tagIds,
      featured_media,
      meta: {
        embed: embed,
        thumb: thumb,
        post_views_count: postViewsCount
      }
    });

    console.log('Đa post bai xong ID:', post.id);
  } catch (err) {
    console.error('An error occurred:', err);
  }
}
let allPosts = [];

function getAllPosts(page = 1) {
  return wp.posts().perPage(100).page(page).get()
    .then(posts => {
      allPosts = allPosts.concat(posts);
      console.log('Fetched page: ', page);
      if (posts.length === 100) {
        // If we received 100 posts, there might be more posts in the next page.
        return getAllPosts(page + 1);
      } else {
        // If we received less than 100 posts, we've fetched all posts.
        return allPosts;
      }
    });
}

async function createPostWithValidToken(title, content, categoryNames, tagNames, embed, thumb, postViewsCount) {
  const isValid = await checkValidJWTToken();
  if (!isValid) {
    await saveJWTToken(process.env.HOST_API, process.env.USERNAMEV, process.env.PASSWORD);
  }
  setWpHeaders();
  await createPost(title, content, categoryNames, tagNames, embed, thumb, postViewsCount);
}
