const { ipcRenderer } = require("electron");
window.$ = window.jQuery = require('jquery');

document.onreadystatechange = (event) => {
  $('.menu .item').tab()
};

document.querySelector("#folder-btn").addEventListener("click", () => {
  ipcRenderer
    .invoke("select-folder")
    .then((data) => {
      if (!data.canceled) {
        document.querySelector("#folder").value = data.filePaths[0];
      }
    })
    .catch((err) => {
      console.log(err)
    });
});

document.querySelector("#action-btn").addEventListener("click", () => {
  const folder = document.querySelector("#folder").value;

  ipcRenderer.invoke("render", { folder: folder }).then((data) => {
    console.log('render xong');
  });
});
ipcRenderer.on("render-progressbar", (event, data) => {
  console.log(data.videoFiles);
  $('#progressDiv').empty();
  const videoFiles = data.videoFiles;
  if (Array.isArray(videoFiles)) {
    for (let i = 0; i < videoFiles.length; i++) {
      $('#progressDiv').append(`
        <div class="item mt-4">
          <div class="ui indicating progress tiny" id="progress-${i}">
            <div class="bar"></div>
            <div class="label truncate text-left">${videoFiles[i]}</div>
          </div>
        </div>
      `);
    }
  }

});
ipcRenderer.on("got-progress", (event, data) => {
  $('#progress-'+data.index).progress({
    percent: data.percent.toFixed(0),
    text: {
      active: `Đang xử lý: ${data.vidname}: ${data.percent.toFixed(0)}%`,
      success: `${data.vidname}: Xong!`
    }
  });
});
