const { ipcRenderer } = require("electron");
const { type } = require("jquery");
window.$ = window.jQuery = require('jquery');

let logoPath = '';
let PostFolderPath = '';
let excelName = '';
document.onreadystatechange = (event) => {
  $('.menu .item').tab()
  $('.ui.dropdown')
    .dropdown({
      allowAdditions: true
    });
  $(document).on('click', '.removePost', function () {
    $(this).closest('.ui.segment').remove();
  });
  $('.button')
    .popup({
      delay: {
        show: 250,
        hide: 70
      }
    });

};

/*---------------------------------------*/
/* HANDLE ALL EVENTS CLICKER
/*---------------------------------------*/


/*----------------------------*/
/*---RENDER TAB HANDLE
/*----------------------------*/

//Click vào render tab
document.querySelector("#re-render").addEventListener("click", () => {
  // $('#progressDiv').empty();
});


// Chọn thư mục chứa video cần thêm logo
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
      console.log('Error uploading excel file', err);
    });
});

// Check logo is png or jpg
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


// Function to disable buttons
function disableButtons() {
  $("#action-btn,#actionfileinputlabel,#folder-btn,#actionfileinputwrap").addClass("loading disabled");
  $('.menutab:not(.active)').addClass('disabled');
}

// Function to enable buttons
function enableButtons() {
  $("#action-btn,#actionfileinputlabel,#folder-btn,#actionfileinputwrap").removeClass("loading disabled");
  $('.menutab:not(.active)').removeClass('disabled');
}

//Click xử lý render video
document.querySelector("#action-btn").addEventListener("click", () => {
  const folder = document.querySelector("#actionfolderinput").value;
  const logo = logoPath;
  if (!folder) {
    alert('Chưa chọn thư mục chứa video');
    return;
  }
  if (!logo) {
    alert('Chưa chọn logo');
    return;
  }
  $('#progressDiv').empty();
  disableButtons();

  ipcRenderer.invoke("render", { folder: folder, logo: logo }).then((data) => {
    try {
      if (data && data.status === "success") {
        console.log('Đã xử lý xong tất cả video');
      } else {
        console.log('Có lỗi xảy ra');
      }
    } catch (error) {
      console.log('Có lỗi xảy ra', error);
    } finally {
      enableButtons();
    }
  });
});


/*----------------------------*/
/*---GETLINK TAB HANDLE
/*----------------------------*/
//Click vào Lấy link phát
document.querySelector("#get-link").addEventListener("click", () => {
  $('#progressGetlinkDiv').empty();
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


//Xử lý sự kiện click nút getlink
document.querySelector("#action-getlink-btn").addEventListener("click", () => {
  const folder = document.querySelector("#actionFolderGetlinkInput").value;
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


/*----------------------------*/
/*---CONFIG TAB HANDLE
/*----------------------------*/
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

//Lưu config Form
document.querySelector("#jsonConfigForm").addEventListener("submit", (event) => {
  // Prevent the form from submitting normally
  event.preventDefault();
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
  ipcRenderer.invoke("save-jsonconfig", { config: inputValues }).then((data) => {
    if (data.status === 'success') {
      console.log('Lưu config thành công');
    }
  });
});

/*----------------------------*/
/*---UPLOAD TAB HANDLE
/*----------------------------*/
//function invoke load-post-from-folder
function invokeLoadPostFromFolder(folderPath) {
  ipcRenderer.invoke("load-post-from-folder", { folder: folderPath }).then((data) => {
    postObjects = data.postObjects;
    console.log(postObjects);
    let categoriesSelectOptionHTML = `<option value="">Chọn danh mục nội dung cho video</option>`;
    data.categories.forEach(element => {
      let optionsHTML = `<option value="${element.id}">${element.name}</option>`;
      categoriesSelectOptionHTML += optionsHTML;
    });
    let tagsSelectOptionHTML = `<option value="">Chọn tag nội dung cho video</option>`;
    data.tags.forEach(element => {
      let optionsHTML = `<option value="${element.id}">${element.name}</option>`;
      tagsSelectOptionHTML += optionsHTML;
    });
    $('#postContentsWrapper').empty();
    $('#postContentsWrapper').append(`<h5 style="margin-bottom:0px">Có ${postObjects.length} video được tìm thấy!</h5>`);
    postObjects.forEach((post, index) => {
      $('#postContentsWrapper').append(`
              <h5 class="ui horizontal divider header truncate">
                ${post.title}
            </h5>

          <form class="ui form segment relative" id="formPost-${index}">
            <div class="absolute right-1 top-1 cursor-pointer removePost">
                <i class="times circle icon red"></i>
             </div>
            <div class="fields">
              <div class="sixteen wide field">
                <label>Tiêu đề bài viết</label>
                <input type="text" placeholder="Chọn tiêu đề cho video, nhớ giống với tên video đã sửa.." value="${post.title}" name="title">
              </div>
            </div>
            <div class="fields">
              <div class="sixteen wide field">
                <label>Nội dung</label>
                <textarea rows="2" placeholder="Ghi nội dung cho bài viết, có thể để trống.." name="content">${post.title}</textarea>
              </div>
            </div>
            <div class="fields">
              <div class="sixteen wide field">
                <label>Link embed video</label>
                <input type="text" placeholder="Link embed video lấy từ web lấy link.." name="link" value="${post.link}">
              </div>
            </div>
            <div class="fields">
              <div class="sixteen wide field">
                <label>Chọn danh mục</label>
                    <select class="ui fluid search four column selection dropdown" multiple="" name="categories_select">
                    </select>
              </div>
            </div>
            <div class="fields">
              <div class="sixteen wide field">
                <label>Chọn tag</label>
                <select class="ui fluid search four column selection dropdown" multiple="" name="tags_select">
                </select>
              </div>
            </div>
            <div class="fields">
              <div class="sixteen wide field">
                <label>Ảnh đại diện</label>
                <img class="ui small image"
                  src="${post.imagePath}">
                  <input type="text" value="${post.imagePath}" name="imagePath" hidden>
              </div>
            </div>
          </form>
            `);
      // Append the options and initialize the dropdown for this form
      $(`#formPost-${index} select[name="categories_select"]`).append(categoriesSelectOptionHTML);
      $(`#formPost-${index} select[name="tags_select"]`).append(tagsSelectOptionHTML);
      $(`#formPost-${index} select[name="tags_select"]`).dropdown('set selected', ['194', '243']);
      $(`#formPost-${index} .ui.dropdown`).dropdown({ allowAdditions: true });
      $(`#formPost-${index} .ui.dropdown`).dropdown('refresh');
    });

  });
}

//Click vào upload bài viết tab - check và load token
document.querySelector("#upload-post").addEventListener("click", () => {
  $('#excel-link-path').text('Đã nhập thông tin link từ file: ' + excelName);
  ipcRenderer.invoke("upload-tab-clicked", {}).then((data) => {
    // console.log(data.message);
  });
});

// Click nút chọn folder chứa video và ảnh đã render
document.querySelector("#folder-upload-btn").addEventListener("click", () => {
  $('#postContentsWrapper').empty();
  $('#excel-link-path').text('Đã nhập thông tin link từ file: ' + excelName);
  ipcRenderer
    .invoke("select-folder")
    .then((data) => {
      if (!data.canceled) {
        document.querySelector("#actionFolderUpLoadInput").value = data.filePaths[0];
        PostFolderPath = data.filePaths[0];
        invokeLoadPostFromFolder(PostFolderPath);
        $('#upload-excel-btn').removeClass('disabled');
      }
    })
    .catch((err) => {
      console.log(err)
    });
});

// Function to disable buttons
function disableButtonsPost() {
  $("#folder-upload-btn,#PostContentsBtn").addClass("loading disabled");
  $('.menutab:not(.active)').addClass('disabled');
}

// Function to enable buttons
function enableButtonsPost() {
  $("#folder-upload-btn,#PostContentsBtn").removeClass("loading disabled");
  $('.menutab:not(.active)').removeClass('disabled');
}

//CLick nút Đăng bài viết
document.querySelector("#PostContentsBtn").addEventListener("click", () => {
  var allFormData = [];

  $('[id^=formPost-]').each(function () {
    var formData = $(this).serializeArray();
    var formDataObj = formData.reduce(function (acc, cur) {
      acc[cur.name] = cur.value;
      return acc;
    }, {});

    // Handle multiple select fields
    formDataObj['tags_select'] = $(this).find('select[name="tags_select"]').val();
    formDataObj['categories_select'] = $(this).find('select[name="categories_select"]').val();

    allFormData.push(formDataObj);
  });

  disableButtonsPost();
  ipcRenderer.invoke("post-to-website", { postObjects: allFormData }).then((data) => {
    try {
      if (data && data.status === 'success') {
        console.log('Đã đăng bài viết thành công');
      } else {
        console.log('Có lỗi xảy ra');
      }
    }
    catch (error) {
      console.log('Có lỗi xảy ra', error);
    } finally {
      enableButtonsPost();
    }

  });
})

//Click vào nút  upload file excel chứa thông tin links
document.querySelector("#upload-excel-inp").addEventListener("change", (e) => {
  const file = e.target.files[0];
  ipcRenderer
    .invoke("load-links-from-excel", { name: file.name, path: file.path })
    .then((data) => {
      if (data.status === 'success') {
        $('#excel-link-path').text('Đã nhập thông tin link từ file: ' + file.name);
        excelName = file.name;
        invokeLoadPostFromFolder(PostFolderPath);

        console.log('Đã upload file excel thành công');
      }

    })
    .catch((err) => {
      console.log('có lỗi trong quá trình upload file excel', err)
    });
});
/*---------------------------------------*/
/* HANDLE [ipcRenderer.on] EVENTS from main.js
/*---------------------------------------*/

//ipcRender render progressbar
ipcRenderer.on("render-progressbar", (event, data) => {
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

//ipcRender got progress
ipcRenderer.on("got-progress", (event, data) => {
  $('#progress-' + data.index).progress({
    percent: data.percent.toFixed(0),
    text: {
      active: `Đang xử lý: ${data.vidname}: ${data.percent.toFixed(0)}%`,
      success: `${data.vidname}: Xong!`
    }
  });
});
//ipcRender getlink-progressbar
ipcRenderer.on("getlink-progressbar", (event, data) => {
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

ipcRenderer.on("disableButtonsPost", (event, data) => {
  disableButtonsPost();
});

ipcRenderer.on("enableButtonsPost", (event, data) => {
  enableButtonsPost();
});

ipcRenderer.on("remove-loading-css", (event, data) => {
  data.elemlist.forEach(elementId => {
    $(`#${elementId}`).removeClass('loading disabled');
  });
});

ipcRenderer.on("clearDiv", (event, data) => {
  data.elemlist.forEach(elementId => {
    $(`#${elementId}`).empty()
  });
});

/*---------------------------------------*/
/* HANDLE update process when start app
/*---------------------------------------*/
function showDimmerWithText(text) {
  $('#dimmer1').dimmer({ closable: false }).dimmer('show');
  $('#dimmer_text').text(text);
}

ipcRenderer.on("checking_for_update", () => {
  console.log('checking_for_update');
  showDimmerWithText(`Kiểm tra cập nhật!`);
});

ipcRenderer.on("update-available", (event, data) => {
  console.log('update-available', data);
  showDimmerWithText(`Có bản cập nhật mới: ${data.info.releaseName}`);
});

ipcRenderer.on("update-not-available", (event, data) => {
  console.log('update-not-available', data);
  showDimmerWithText(`Không có cập nhật mới!`);
  setTimeout(() => {
    $('#dimmer1').dimmer('hide');
  }, 2000);
});

ipcRenderer.on("download-progress", (event, data) => {
  let percentDownload = data.percent.toFixed(0);
  showDimmerWithText(`Đang cập nhật : ${percentDownload}%`);
});

ipcRenderer.on("update_downloaded", () => {
  showDimmerWithText(`Đang cài đặt.. !`);
  setTimeout(() => {
    ipcRenderer.invoke("restart_app");
  }, 2000);
});

ipcRenderer.on("update-error", (event, data) => {
  console.log('update-error', data);
  showDimmerWithText(`Có lỗi khi tải phiên bản mới, Vui lòng thử lại sau!`);
  setTimeout(() => {
    $('#dimmer1').dimmer('hide');
  }, 2000);
});
