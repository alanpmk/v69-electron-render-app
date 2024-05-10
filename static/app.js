const { ipcRenderer } = require("electron");
const { event, each } = require("jquery");
window.$ = window.jQuery = require('jquery');
let logoPath = '';
document.onreadystatechange = (event) => {
  $('.menu .item').tab()
  $('.ui.dropdown')
    .dropdown({
      allowAdditions: true
    });
};
/*---------------------------------------*/
/* HANDLE ALL EVENTS CLICKER
/*---------------------------------------*/


// Handle select folder button click
document.querySelector("#folder-btn").addEventListener("click", () => {
  $('#progressDiv').empty();
  ipcRenderer
    .invoke("select-folder")
    .then((data) => {
      if (!data.canceled) {
        document.querySelector("#actionfolderinput").value = data.filePaths[0];
      }
    })
    .catch((err) => {
      console.log(err)
    });
});
// Handle select get link folder button click
document.querySelector("#folder-getlink-btn").addEventListener("click", () => {
  $('#progressGetlinkDiv').empty();
  ipcRenderer
    .invoke("select-folder")
    .then((data) => {
      if (!data.canceled) {
        document.querySelector("#actionFolderGetlinkInput").value = data.filePaths[0];
      }
    })
    .catch((err) => {
      console.log(err)
    });
});


document.getElementById('actionfileinput').addEventListener('change', function () {
  var file = this.files[0];
  var fileType = file.type;
  var fileSize = file.size;

  // Validate file type
  var allowedTypes = ['image/jpeg', 'image/png'];
  if (!allowedTypes.includes(fileType)) {
    alert('Chỉ chấp nhận file dạng jpg, png.');
    this.value = ''; // Clear the input
    return;
  }

  // Validate file size (max 2MB)
  var maxSize = 2 * 1024 * 1024; // 2MB in bytes
  if (fileSize > maxSize) {
    alert('Dung lượng file không được vượt quá 2MB.');
    this.value = ''; // Clear the input
    return;
  }

  // If the file passes the checks, you can proceed with the upload
  // console.log('File is valid. You can proceed with the upload.', file.path);
  logoPath = file.path;
});

document.querySelector("#action-btn").addEventListener("click", () => {
  const folder = document.querySelector("#actionfolderinput").value;
  const logo = logoPath;
  console.log('folder', folder, 'logo', logo);
  if (!folder) {
    alert('Chưa chọn thư mục chứa video');
    return;
  }
  if (!logo) {
    alert('Chưa chọn logo');
    return;
  }
  $('#progressDiv').empty();
  $("#action-btn").addClass("loading disabled");
  ipcRenderer.invoke("render", { folder: folder, logo: logo }).then((data) => {
    try {
      if (data && data.status === "success") {
        console.log('Đã xử lý xong tất cả video');
        $("#action-btn").removeClass("loading disabled");
      }
      else {
        console.log('Có lỗi xảy ra');
        $("#action-btn").removeClass("loading disabled");
      }
    } catch (error) {
      console.log('Có lỗi xảy ra', error);
    }
  });
});
//Xử lý sự kiện click nút getlink
document.querySelector("#action-getlink-btn").addEventListener("click", () => {
  const folder = document.querySelector("#actionFolderGetlinkInput").value;
  console.log('f', folder);
  if (!folder) {
    alert('Chưa chọn thư mục chứa video');
    return;
  }

  $('#progressGetlinkDiv').empty();
  $("#action-getlink-btn").addClass("loading disabled");
  ipcRenderer.invoke("getlink", { folder: folder }).then((data) => {
    try {
      if (data && data.status === "success") {
        console.log('Đã xử lý xong tất cả video');
        console.log('Tất cả video: ', data.allVideos);
        $("#action-getlink-btn").removeClass("loading disabled");
      }
      else {
        console.log('Có lỗi xảy ra');
        $("#action-getlink-btn").removeClass("loading disabled");
      }
    } catch (error) {
      console.log('Có lỗi xảy ra', error);
    }
  });
});

//Config tab submit clicked
document.querySelector("#jsonConfigForm").addEventListener("submit", (event) => {
  // Prevent the form from submitting normally
  event.preventDefault();
  console.log('submit config form click');
  const formInputs = document.querySelectorAll("#jsonConfigForm input");
  let inputValues = {};

  formInputs.forEach(input => {
    inputValues[input.name] = input.value;
  });

  console.log(inputValues);

  if (!inputValues) {
    alert('Chưa nhập json config');
    return;
  }
  ipcRenderer.invoke("save-jsonconfig", { jsonconfig: inputValues }).then((data) => { });
});

//Click vào config tab
document.querySelector("#config-tab").addEventListener("click", () => {
  ipcRenderer.invoke("load-config", {}).then((data) => {
    //insert data from data object to the inputs of jsonConfigForm form
    Object.keys(data).forEach(key => {
      const input = document.querySelector(`#jsonConfigForm input[name="${key}"]`);
      if (input) {
        input.value = data[key];
      }
    });
  });
})

//tab upload bai viet click #upload-post tab
document.querySelector("#upload-post").addEventListener("click", () => {
  ipcRenderer.invoke("upload-tab-clicked", {}).then((data) => {
    console.log(data.message);
    console.log('categories : ', data.categories);
    console.log('tags : ', data.tags);
    //write code fill data.categories to select with name="categories_select" , <option value=category.id>category.name</option>
    const categories = data.categories;
    const tags = data.tags;
    const selectCatElement = document.querySelector('select[name="categories_select"]');
    const selectTagElement = document.querySelector('select[name="tags_select"]');
    categories.forEach(category => {
      const optionElement = document.createElement('option');
      optionElement.value = category.id;
      optionElement.textContent = category.name;
      selectCatElement.appendChild(optionElement);
    });
    tags.forEach(tag => {
      const optionElement = document.createElement('option');
      optionElement.value = tag.id;
      optionElement.textContent = tag.name;
      selectTagElement.appendChild(optionElement);
    });
  });
});



/*---------------------------------------*/
/* HANDLE [ipcRenderer.on] EVENTS [from main.js
/*---------------------------------------*/


//ipcRender from main.js
ipcRenderer.on("render-progressbar", (event, data) => {
  console.log(data.videoFiles);
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
  $('#progress-' + data.index).progress({
    percent: data.percent.toFixed(0),
    text: {
      active: `Đang xử lý: ${data.vidname}: ${data.percent.toFixed(0)}%`,
      success: `${data.vidname}: Xong!`
    }
  });
});

ipcRenderer.on("getlink-progressbar", (event, data) => {
  console.log(data.videoFiles);
  const length = data.length;
  $('#progressGetlinkDiv').append(`
    <div class="ui indicating progress" data-value="0" data-total="${length}" id="progressGetlink">
      <div class="bar">
        <div class="progress"></div>
      </div>
      <div class="label">Đang xử lý video</div>
    </div>
      `);
  data.files.forEach((video, index) => {
    $(`<div class="w-full flex justify-between items-center space-x-2" id="video-${index}">
            <span>${video}</span>
            <p class="whitespace-nowrap"><i class="spinner blue icon animate-spin"></i></p>
          </div>
    `).appendTo('#progressGetlinkDiv');
  });
  $('#progressGetlink')
    .progress({
      text: {
        active: 'Đã upload {value} trên {total} videos'
      }
    })
});

ipcRenderer.on("got-getlink-progress", (event, data) => {
  $('#progressGetlink').progress('increment');
  $(`#video-${data.index} p`).html(`<i class="check green icon"></i>`);
});
