/* ===================================================================
   CDN FILES — Upload Engine
   Client-side unsigned upload to Cloudinary + short permanent link
   ===================================================================
   Short-link mechanics:
   Cloudinary delivery URLs are deterministic:
     https://res.cloudinary.com/<cloud>/<resource_type>/upload/<public_id>.<ext>
   vercel.json rewrites /img/*, /video/*, /audio/*, /doc/*, /sticker/*
   straight through to that pattern, so the URL this app prints
   (on your own domain) IS the real permanent file link — just short.
   =================================================================== */

const CLOUD_NAME = 'wdhnno7y';
const UPLOAD_PRESET = 'linkify_unsigned';

/**
 * Boots an uploader on a page.
 * @param {Object} cfg
 * @param {string} cfg.resourceType  'image' | 'video' | 'raw'
 * @param {string} cfg.prefix        short-link path prefix, e.g. 'img'
 * @param {string[]} cfg.accept      accepted file extensions, e.g. ['.jpg','.png']
 * @param {string} cfg.acceptAttr    value for <input accept="">
 * @param {number} cfg.maxSizeMB     max upload size in MB
 * @param {string} cfg.kind          'image' | 'video' | 'audio' | 'sticker' | 'doc'
 */
function initUploader(cfg){
  const dropzone   = document.getElementById('dropzone');
  const fileInput  = document.getElementById('fileInput');
  const preview    = document.getElementById('preview');
  const thumb      = document.getElementById('thumb');
  const fileName   = document.getElementById('fileName');
  const fileSize   = document.getElementById('fileSize');
  const clearBtn   = document.getElementById('clearBtn');
  const uploadBtn  = document.getElementById('uploadBtn');
  const progress   = document.getElementById('progress');
  const progressBar= document.getElementById('progressBar');
  const result     = document.getElementById('result');
  const linkText   = document.getElementById('linkText');
  const copyBtn    = document.getElementById('copyBtn');
  const openBtn    = document.getElementById('openBtn');
  const anotherBtn = document.getElementById('anotherBtn');
  const errorMsg   = document.getElementById('errorMsg');

  let selectedFile = null;
  let objectUrl = null;

  function fmtSize(bytes){
    if(bytes < 1024) return bytes + ' B';
    if(bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/(1024*1024)).toFixed(2) + ' MB';
  }

  function isAccepted(file){
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    return cfg.accept.includes(ext);
  }

  function showError(msg){
    errorMsg.textContent = msg;
    errorMsg.classList.add('show');
    setTimeout(()=> errorMsg.classList.remove('show'), 4200);
  }

  function resetResult(){
    result.classList.remove('show');
    progress.classList.remove('show');
    progressBar.style.width = '0%';
  }

  function handleFile(file){
    if(!file) return;
    if(!isAccepted(file)){
      showError(`Unsupported format. Accepted: ${cfg.accept.join(', ')}`);
      return;
    }
    if(file.size > cfg.maxSizeMB * 1024 * 1024){
      showError(`File is too large. Max size is ${cfg.maxSizeMB}MB.`);
      return;
    }
    selectedFile = file;
    resetResult();

    fileName.textContent = file.name;
    fileSize.textContent = fmtSize(file.size);

    if(objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    thumb.innerHTML = '';
    if(cfg.kind === 'image' || cfg.kind === 'sticker'){
      const img = document.createElement('img');
      img.src = objectUrl;
      thumb.appendChild(img);
    } else if(cfg.kind === 'video'){
      const vid = document.createElement('video');
      vid.src = objectUrl;
      vid.muted = true;
      thumb.appendChild(vid);
    } else if(cfg.kind === 'audio'){
      thumb.innerHTML = `<div class="wave"><span></span><span></span><span></span><span></span><span></span></div>`;
    } else {
      thumb.innerHTML = docIcon(file.name);
    }

    preview.classList.add('show');
    uploadBtn.disabled = false;
  }

  function docIcon(name){
    const ext = name.split('.').pop().toUpperCase();
    return `<span style="font-size:.62rem;font-weight:800;letter-spacing:.02em;">${ext}</span>`;
  }

  dropzone.addEventListener('click', (e) => {
    if(e.target === fileInput) return;
  });
  fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

  ['dragenter','dragover'].forEach(evt=>{
    dropzone.addEventListener(evt, (e)=>{
      e.preventDefault(); e.stopPropagation();
      dropzone.classList.add('drag');
    });
  });
  ['dragleave','drop'].forEach(evt=>{
    dropzone.addEventListener(evt, (e)=>{
      e.preventDefault(); e.stopPropagation();
      dropzone.classList.remove('drag');
    });
  });
  dropzone.addEventListener('drop', (e)=>{
    const file = e.dataTransfer.files[0];
    if(file) handleFile(file);
  });

  clearBtn.addEventListener('click', ()=>{
    selectedFile = null;
    fileInput.value = '';
    preview.classList.remove('show');
    uploadBtn.disabled = true;
    resetResult();
  });

  anotherBtn && anotherBtn.addEventListener('click', ()=>{
    selectedFile = null;
    fileInput.value = '';
    preview.classList.remove('show');
    uploadBtn.disabled = true;
    resetResult();
  });

  function buildShortLink(publicId, format){
    const origin = window.location.origin.includes('localhost') || window.location.origin.includes('null')
      ? 'https://cdn-files.vercel.app'
      : window.location.origin;
    return `${origin}/${cfg.prefix}/${publicId}.${format}`;
  }

  uploadBtn.addEventListener('click', ()=>{
    if(!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('upload_preset', UPLOAD_PRESET);

    uploadBtn.disabled = true;
    uploadBtn.classList.add('loading');
    progress.classList.add('show');
    progressBar.style.width = '6%';
    resetErrorOnly();

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${cfg.resourceType}/upload`);

    xhr.upload.onprogress = (e)=>{
      if(e.lengthComputable){
        const pct = Math.max(6, Math.round((e.loaded / e.total) * 100));
        progressBar.style.width = pct + '%';
      }
    };

    xhr.onload = ()=>{
      uploadBtn.classList.remove('loading');
      uploadBtn.disabled = false;

      if(xhr.status >= 200 && xhr.status < 300){
        const data = JSON.parse(xhr.responseText);
        progressBar.style.width = '100%';

        const format = data.format || selectedFile.name.split('.').pop().toLowerCase();
        const shortUrl = buildShortLink(data.public_id, format);

        linkText.textContent = shortUrl;
        linkText.dataset.url = shortUrl;
        openBtn.href = shortUrl;
        result.classList.add('show');

        setTimeout(()=> progress.classList.remove('show'), 500);
      } else {
        progress.classList.remove('show');
        let message = 'Upload failed. Please try again.';
        try{
          const err = JSON.parse(xhr.responseText);
          if(err && err.error && err.error.message) message = err.error.message;
        }catch(_e){}
        showError(message);
      }
    };

    xhr.onerror = ()=>{
      uploadBtn.classList.remove('loading');
      uploadBtn.disabled = false;
      progress.classList.remove('show');
      showError('Network error — check your connection and try again.');
    };

    xhr.send(formData);
  });

  function resetErrorOnly(){
    errorMsg.classList.remove('show');
  }

  copyBtn.addEventListener('click', ()=>{
    const url = linkText.dataset.url || linkText.textContent;
    navigator.clipboard.writeText(url).then(()=>{
      showToast('Link copied to clipboard');
    }).catch(()=>{
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Link copied to clipboard');
    });
  });
}

function showToast(message){
  let toast = document.getElementById('toast');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span id="toastMsg"></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector('#toastMsg').textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> toast.classList.remove('show'), 2600);
}
