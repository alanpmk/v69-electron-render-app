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
let ffmpegPath = path.join(__dirname, 'static', 'ffmpeg-static', 'ffmpeg.exe');
ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked')
let ffprobePath = path.join(__dirname, 'static', 'ffprobe-static', 'ffprobe.exe');
ffprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked')
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
// Create fforobe promisified
const ffprobe = util.promisify(require('fluent-ffmpeg').ffprobe);
// Declare store
const store = new Store();
// const https = require('https');
// const agent = new https.Agent({
//   rejectUnauthorized: false
// });
// axios.defaults.httpsAgent = agent;


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
const configPath = path.join(__dirname, 'static', "config_ex.json");
const destinationConfigPath = path.join(userDataPath, 'Uconfig.json');
const dbPath = path.join(userDataPath, 'db.json');



// Xử lý khi app ở trạng thái active, ví dụ click vào icon
app.on("activate", () => {
  // Mở window mới khi không có window nào
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('ready', () => {
  if (!fs.existsSync(destinationConfigPath)) {
    fs.copyFileSync(configPath, destinationConfigPath, (err) => {
      // if (err) throw err;
      console.log('config.json was copied to userDataPath');
    });
  } else {
    console.log('config.json already exists at userDataPath');
  }
});

function loadConfig() {
  if (!fs.existsSync(destinationConfigPath)) {
    fs.copyFileSync(configPath, destinationConfigPath);
    console.log('config.json was copied to userDataPath');
  }
  const jsonConfig = JSON.parse(fs.readFileSync(destinationConfigPath, 'utf-8'));
  return jsonConfig;
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
/**----Declaratation of function to process WPAPI-----------------------**/
/**--------------------------------------------------------------------- */
const userConfig = loadConfig();
const wp = new WPAPI({ endpoint: `${userConfig.WP_HOST}/wp-json` });

function setWpHeaders(jwt_token) {
  wp.setHeaders('Authorization', `Bearer ${jwt_token}`);
}

async function saveJWTToken(WP_HOST, username, password) {
  try {
    // Request a JWT token
    const response = await axios.post(`${WP_HOST}/wp-json/jwt-auth/v1/token`, {
      username,
      password
    });
    if (response.data.token) {
      store.set('jwt_token', response.data.token);
      return { message: 'Đã cập nhật token', status: "success" };
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}


async function checkValidJWTToken(WP_HOST, username, password) {
  try {
    if (store.has('jwt_token') === false) {
      return await saveJWTToken(WP_HOST, username, password);
    }
    const token = store.get('jwt_token');
    const response = await axios.post(`${WP_HOST}/wp-json/jwt-auth/v1/token/validate`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (response.status === 200) {
      return { message: 'Token hợp lệ', status: "success" };
    }
  } catch (error) {
    if (error.response.status === 403) {
      return await saveJWTToken(WP_HOST, username, password);
    }
    console.error('Có lỗi xảy ra trong quá trình lấy token:', error);
  }
}


async function getOrCreateTaxonomy(taxonomy, name) {
  const slug = name.toLowerCase().replace(/ /g, '-');

  // Check if the taxonomy with the given slug already exists
  const existingItems = await taxonomy.slug(slug);

  if (existingItems.length > 0) {
    // If the taxonomy already exists, return its ID
    return existingItems[0].id;
  } else {
    // If the taxonomy doesn't exist, create it and return its ID
    return await taxonomy.create({ name, slug }).then(item => item.id);
  }
}
// Get all items of a certain type
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

// Get categories and tags
async function getCategoriesAndTags() {
  try {
    // if (!store.has('categories') || !store.has('tags')) {
    // }
    const categories = await getAllItems(wp.categories());
    const tags = await getAllItems(wp.tags());
    // store.set('categories', categories);
    // store.set('tags', tags);
    // store.set('categories_total', categories.length);
    // store.set('tags_total', tags.length);
    return { categories, tags };
    // return { categories: store.get('categories'), tags: store.get('tags') };


  } catch (error) {
    console.error('An error occurred from getCategoriesAndTags():', error);
  }
}

async function createPost(title, content, categories, tags, embed, imagePath, postViewsCount) {
  try {
    // Upload the image and get the media item
    const media = await wp.media().file(imagePath).create();

    // Get the image link
    const thumb = media.source_url;
    // Get the image ID
    const featured_media = media.id;
    console.log(thumb);

    // Get or create the categories and tags
    const categoryIds = await Promise.all(categories.map(item => !isNaN(Number(item)) ? Number(item) : getOrCreateTaxonomy(wp.categories(), item)));
    const tagIds = await Promise.all(tags.map(item => !isNaN(Number(item)) ? Number(item) : getOrCreateTaxonomy(wp.tags(), item)));

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

    console.log('Post bai thanh cong:', title, ' ID la:', post.id);
    return { status: 'success', id: post.id, title: title };
  } catch (err) {
    console.error('Post bài #%s bị lỗi: #%s', title, err.message);
    return { status: 'fail', id: null, title: title };
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
    await saveJWTToken(process.env.HOST_API, process.env.USERNAME, process.env.PASSWORD);
  }
  setWpHeaders(store.get('jwt_token'));
  await createPost(title, content, categoryNames, tagNames, embed, thumb, postViewsCount);
}


/**--------------------------------------------------------------------- */
/**----Handle ipcMain events--------------------------------------------**/
/**--------------------------------------------------------------------- */
//Handle save config
ipcMain.handle('save-jsonconfig', async (_, data) => {
  console.log(data.config);
  fs.writeFileSync(destinationConfigPath, JSON.stringify(data.config), 'utf-8');
  dialog.showMessageBox(mainWin, {
    message: `Lưu cấu hình thành công!`,
    type: "info",
  })
  return { status: 'success' };
});
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
    return res;
  }
  return res;
});

// handle xử lý upload video lên helvid và getlink video
ipcMain.handle("getlink", async (_, data) => {
  const userConfig = loadConfig();

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
      const response = await axios.get(`${userConfig.HELVID_URL}/api/myvideo?apikey=${apikey}&page=${page}&per_page=${per_page}`);
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
      const response = await axios.post(`${userConfig.HELVID_URL}/api/upload`, formData, {
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
        const res = await uploadFile(path.join(inputDir, file), '17', '18', userConfig.HELVID_APIKEY, '1617');
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
      const res = await getAllVideos(userConfig.HELVID_APIKEY, 1, 20);

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

//Xử lý lấy thông tin video và ảnh từ folder load lên nội dung bài viết
ipcMain.handle('load-post-from-folder', async (_, data) => {
  const inputDir = data.folder;
  const files = await fs.promises.readdir(inputDir);


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
  // console.log('videoFiles:', videoFiles);

  //Filter Image that match video name
  function filterImages(videoFiles, inputDir) {
    const allImageFiles = fs.readdirSync(inputDir).filter(file => path.extname(file) === '.jpg');

    const imageFiles = videoFiles.map(videoName => {
      const videoBaseName = videoName.replace('_watermark.mp4', '');
      return allImageFiles.find(imageFile => imageFile.startsWith(videoBaseName));
    }).filter(Boolean); // remove undefined entries


    const imageObjects = imageFiles.map(imageFile => {
      const videoName = videoFiles.find(videoName => {
        const videoBaseName = videoName.replace('_watermark.mp4', '');
        return imageFile.startsWith(videoBaseName);
      });
      const pathVideo = path.join(inputDir, `${videoName}`);
      const imagePath = path.join(inputDir, imageFile);
      const title = videoName.replace('.mp4_watermark.mp4', '');
      const link = '';
      return { title, link, videoName, pathVideo, imagePath };
    });

    return imageObjects;
  }

  const postObjects = filterImages(videoFiles, inputDir);
  mainWin.webContents.send("disableButtonsPost", { status: 'success' });
  const { categories, tags } = await getCategoriesAndTags();
  // const categories = store.get('categories');
  // const tags = store.get('tags');
  mainWin.webContents.send("enableButtonsPost", { status: 'success' });
  return { postObjects, categories, tags };
});


async function handleUploadTabClicked() {
  try {
    const userConfig = loadConfig();
    const res = await checkValidJWTToken(userConfig.WP_HOST, userConfig.USERNAME, userConfig.PASSWORD);
    setWpHeaders(store.get('jwt_token'));
    return res;
  } catch (error) {
    console.error('Có lỗi :', error);
    return { message: "Có lỗi xảy ra, VUi lòng thử lại!", status: 'fail' };
  }
}
//Sự kiện click tab upload bài viết
ipcMain.handle('upload-tab-clicked', async (event, args) => {
  // Your logic here
  try {
    // Call your handleUploadTabClicked function
    const result = await handleUploadTabClicked();
    return result;
  } catch (error) {
    console.error('An error occurred:', error);
    return { message: "An error occurred, please try again!", status: 'fail' };
  }
});


//Xử lý post bài lên website
ipcMain.handle('post-to-website', async (_, data) => {
  try {

    const config = loadConfig();
    await checkValidJWTToken(config.WP_HOST, config.USERNAME, config.PASSWORD);
    setWpHeaders(store.get('jwt_token'));

    function getRandomPostViewsCount(min = 15000, max = 46000) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    const postObjects = data.postObjects;

    const results = await Promise.all(postObjects.map(async (post) => {
      console.log('Dang post bai viet: ', post.title);
      return await createPost(post.title, post.content, post.categories_select, post.tags_select, post.link, post.imagePath, getRandomPostViewsCount().toString());
    }));
    postCountSuccess = results.filter(result => result.status === 'success').length;
    postCountFails = results.filter(result => result.status === 'fail').length;
    dialog.showMessageBox(mainWin, {
      message: `Đã đăng thành công ${postCountSuccess} bài viết, ${postCountFails} bài viết lỗi!`,
      type: "info",
    })
    return { status: 'success', results };
  }
  catch (error) {
    dialog.showMessageBox(mainWin, {
      message: `Có lỗi xảy ra, vui lòng kiểm tra cấu hình và thử lại!`,
      type: "info",
    })
    return { status: 'fail' };
  }
});
