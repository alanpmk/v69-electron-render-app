const { ipcRenderer } = require("electron");
window.$ = window.jQuery = require('jquery');

let logoPath = '';
document.onreadystatechange = (event) => {
  $('.menu .item').tab()
  $('.ui.dropdown')
    .dropdown({
      allowAdditions: true
    });
  $(document).on('click', '.removePost', function () {
    $(this).closest('.ui.segment').remove();
  });
};

/*---------------------------------------*/
/* HANDLE ALL EVENTS CLICKER
/*---------------------------------------*/


/*----------------------------*/
/*---RENDER TAB HANDLE
/*----------------------------*/

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
      console.log(err)
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

//Click xử lý render video
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


/*----------------------------*/
/*---GETLINK TAB HANDLE
/*----------------------------*/

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

/*----------------------------*/
/*---UPLOAD TAB HANDLE
/*----------------------------*/

//Click vào upload bài viết tab - check và load token
document.querySelector("#upload-post").addEventListener("click", () => {

  ipcRenderer.invoke("upload-tab-clicked", {}).then((data) => {
    console.log(data);
  });
});

// Click nút chọn folder chứa video và ảnh đã render
document.querySelector("#folder-upload-btn").addEventListener("click", () => {
  ipcRenderer
    .invoke("select-folder")
    .then((data) => {
      if (!data.canceled) {
        document.querySelector("#actionFolderUpLoadInput").value = data.filePaths[0];
        ipcRenderer.invoke("load-post-from-folder", { folder: data.filePaths[0] }).then((data) => {
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
                <input type="text" placeholder="Link embed video lấy từ web lấy link.." name="link">
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
    })
    .catch((err) => {
      console.log(err)
    });
});

//CLick nút Đăng bài viết
document.querySelector("#PostContentsBtn").addEventListener("click",()=>{
  console.log('dang bai viet');
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

  $('#PostContentsBtn').addClass('loading disabled');
  $('#folder-upload-btn').addClass('loading disabled');
  ipcRenderer.invoke("post-to-website", { postObjects: allFormData }).then((data) => {
    if(data && data.status === 'success'){
      $('#PostContentsBtn').removeClass('loading disabled');
      $('#folder-upload-btn').removeClass('loading disabled');
    }
  });
})

/*---------------------------------------*/
/* HANDLE [ipcRenderer.on] EVENTS from main.js
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
