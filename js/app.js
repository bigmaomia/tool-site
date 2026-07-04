/**
 * 工具小铺 v1.0 — 主应用
 * Pure frontend SPA with hash routing
 */
(function () {
  'use strict';

  // ========== 全局状态 ==========
  const state = {
    currentRoute: '',
    currentPage: null,
  };

  // 活跃的 timer/interval 引用，切换路由时清理
  const _activeTimers = [];
  function trackTimer(id) { _activeTimers.push(id); return id; }
  function clearAllTimers() {
    _activeTimers.forEach(id => { clearTimeout(id); clearInterval(id); });
    _activeTimers.length = 0;
  }

  // ========== DOM 引用 ==========
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const sidebar = $('#sidebar');
  const sidebarOverlay = $('#sidebarOverlay');
  const menuToggle = $('#menuToggle');
  const content = $('#content');
  const toast = $('#toast');
  const breadcrumb = $('#breadcrumb');
  const sidebarSearch = $('#sidebarSearch');
  const topbarSearch = $('#topbarSearch');

  // ========== 工具注册表 ==========
  const tools = {
    'image/compress':   { cat: 'image', name: '图片压缩',    icon: '📉', desc: '上传图片，调整质量参数进行压缩' },
    'image/convert':    { cat: 'image', name: '格式转换',    icon: '🔄', desc: 'JPG / PNG / WebP / GIF 互转' },
    'image/watermark':  { cat: 'image', name: '图片加水印',  icon: '💧', desc: '上传图片，添加自定义文字水印' },
    'pdf/merge':        { cat: 'pdf',   name: 'PDF 合并',    icon: '📎', desc: '选择多个 PDF 文件合并为一个' },
    'pdf/split':        { cat: 'pdf',   name: 'PDF 拆分',    icon: '✂️', desc: '选择 PDF，按页码范围拆分' },
    'pdf/to-image':     { cat: 'pdf',   name: 'PDF 转图片',  icon: '🖼', desc: '将 PDF 每一页转为图片预览' },
    'pdf/compress':     { cat: 'pdf',   name: 'PDF 压缩',    icon: '📦', desc: '通过图片压缩方式减小 PDF 体积' },
    'dev/json':         { cat: 'dev',   name: 'JSON 格式化', icon: '{ }', desc: '格式化美化或压缩 JSON，带错误提示' },
    'dev/regex':        { cat: 'dev',   name: '正则测试器',  icon: '.*', desc: '在线正则表达式测试与匹配高亮' },
    'dev/base64':       { cat: 'dev',   name: 'Base64 编解码', icon: '🔐', desc: '文本/图片 Base64 互相转换' },
    'dev/diff':         { cat: 'dev',   name: '文本差异对比', icon: '📋', desc: '左右对比两段文本，高亮差异行' },
    'dev/uuid':         { cat: 'dev',   name: 'UUID 生成器', icon: '🆔', desc: '批量生成 UUID/GUID，一键复制' },
    'dev/timestamp':    { cat: 'dev',   name: '时间戳工具', icon: '⏰', desc: '时间戳与可读时间互转，支持多格式' },
  };

  // ========== 工具函数 ==========
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function showToast(msg, type = '') {
    toast.textContent = msg;
    toast.className = 'toast ' + type + ' show';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.className = 'toast'; }, 2500);
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function copyToClipboard(text) {
    function fallbackCopy() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showToast('已复制到剪贴板 ✅', 'success');
      } catch (e) {
        showToast('复制失败，请手动复制', 'error');
      }
      document.body.removeChild(ta);
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('已复制到剪贴板 ✅', 'success'))
        .catch(() => fallbackCopy());
    } else {
      fallbackCopy();
    }
  }

  // ========== 路由 ==========
  function parseRoute() {
    const hash = location.hash.replace(/^#\/?/, '') || '';
    return hash || '/';
  }

  function navigate(route) {
    if (route === '/' || route === '') location.hash = '#/';
    else location.hash = '#/' + route;
  }

  function getBreadcrumbParts(route) {
    if (route === '/' || route === '') return [{ label: '首页' }];
    const parts = route.split('/');
    const crumbs = [{ label: '首页', href: '#/' }];
    const catMap = { image: '图片工具', pdf: '文档工具', dev: '开发工具' };
    if (parts[0] && tools[route] && tools[route].cat === parts[0]) {
      crumbs.push({ label: catMap[parts[0]] || parts[0] });
      crumbs.push({ label: tools[route].name });
    }
    return crumbs;
  }

  function updateBreadcrumb(route) {
    const crumbs = getBreadcrumbParts(route);
    breadcrumb.innerHTML = crumbs.map((c, i) => {
      if (i < crumbs.length - 1) {
        return `<a href="${c.href || '#'}">${c.label}</a> <span>/</span> `;
      }
      return `<span>${c.label}</span>`;
    }).join('');
  }

  // ========== 导航高亮 ==========
  function updateNavActive(route) {
    $$('.nav-item').forEach(el => el.classList.remove('active'));
    if (route && route !== '/') {
      const link = $(`.nav-item[href="#/${route}"]`);
      if (link) link.classList.add('active');
    }
  }

  // ========== 搜索 ==========
  function searchTools(query) {
    const q = query.toLowerCase().trim();
    $$('.nav-item').forEach(el => {
      const text = el.textContent.toLowerCase();
      const parent = el.closest('.nav-section-items');
      const section = el.closest('.nav-section');
      if (!q) {
        el.style.display = '';
        if (section) section.classList.remove('collapsed');
        return;
      }
      if (text.includes(q)) {
        el.style.display = '';
        if (section) section.classList.remove('collapsed');
      } else {
        el.style.display = 'none';
      }
    });
    // Collapse sections where all items are hidden
    $$('.nav-section').forEach(section => {
      const items = section.querySelectorAll('.nav-item');
      const visible = Array.from(items).some(el => el.style.display !== 'none');
      if (q && !visible) section.classList.add('collapsed');
    });
  }

  // ========== 页面渲染 ==========
  function renderHome() {
    const cats = {
      image: { title: '🖼 图片工具', tools: ['image/compress', 'image/convert', 'image/watermark'] },
      pdf:   { title: '📄 文档工具', tools: ['pdf/merge', 'pdf/split', 'pdf/to-image', 'pdf/compress'] },
      dev:   { title: '🔧 开发工具', tools: ['dev/json', 'dev/regex', 'dev/base64', 'dev/diff', 'dev/uuid', 'dev/timestamp'] },
    };

    let html = `
      <div class="home-hero">
        <h1>工具小铺</h1>
        <p>纯前端在线工具集合，所有数据在浏览器本地处理，不上传服务器，安全可靠</p>
      </div>
    `;

    for (const [catKey, cat] of Object.entries(cats)) {
      html += `<div class="tool-category"><div class="tool-category-title">${cat.title}</div><div class="tool-grid">`;
      for (const tKey of cat.tools) {
        const t = tools[tKey];
        html += `
          <a href="#/${tKey}" class="tool-card">
            <div class="tool-card-icon">${t.icon}</div>
            <div class="tool-card-name">${t.name}</div>
            <div class="tool-card-desc">${t.desc}</div>
          </a>`;
      }
      html += `</div></div>`;
    }

    content.innerHTML = html;
  }

  function renderTool(route) {
    const t = tools[route];
    if (!t) return renderHome();

    const catMap = { image: '图片工具', pdf: '文档工具', dev: '开发工具' };
    const category = catMap[t.cat] || t.cat;

    let html = `
      <div class="tool-page">
        <div class="tool-header">
          <h2>${t.icon} ${t.name}</h2>
          <p>${t.desc} · ${category}</p>
        </div>
        <div class="tool-body" id="toolBody">
    `;

    switch (route) {
      case 'image/compress':   html += renderImageCompress(); break;
      case 'image/convert':    html += renderImageConvert(); break;
      case 'image/watermark':  html += renderImageWatermark(); break;
      case 'pdf/merge':        html += renderPdfMerge(); break;
      case 'pdf/split':        html += renderPdfSplit(); break;
      case 'pdf/to-image':     html += renderPdfToImage(); break;
      case 'pdf/compress':     html += renderPdfCompress(); break;
      case 'dev/json':         html += renderJsonTool(); break;
      case 'dev/regex':        html += renderRegexTool(); break;
      case 'dev/base64':       html += renderBase64Tool(); break;
      case 'dev/diff':         html += renderDiffTool(); break;
      case 'dev/uuid':         html += renderUuidTool(); break;
      case 'dev/timestamp':    html += renderTimestampTool(); break;
      default: html += '<p class="empty-state">工具开发中…</p>';
    }

    html += `</div></div>`;
    content.innerHTML = html;

    // Initialize tool-specific JS
    switch (route) {
      case 'image/compress':   initImageCompress(); break;
      case 'image/convert':    initImageConvert(); break;
      case 'image/watermark':  initImageWatermark(); break;
      case 'pdf/merge':        initPdfMerge(); break;
      case 'pdf/split':        initPdfSplit(); break;
      case 'pdf/to-image':     initPdfToImage(); break;
      case 'pdf/compress':     initPdfCompress(); break;
      case 'dev/json':         initJsonTool(); break;
      case 'dev/regex':        initRegexTool(); break;
      case 'dev/base64':       initBase64Tool(); break;
      case 'dev/diff':         initDiffTool(); break;
      case 'dev/uuid':         initUuidTool(); break;
      case 'dev/timestamp':    initTimestampTool(); break;
    }
  }

  // ========== 🖼 图片压缩 ==========
  function renderImageCompress() {
    return `
      <div class="tool-section">
        <div class="tool-section-title">📤 上传图片</div>
        <div class="upload-zone" id="compressUploadZone">
          <div class="upload-zone-icon">🖼</div>
          <div class="upload-zone-text">点击或拖拽上传图片<br><small>支持 JPG / PNG / WebP</small></div>
          <input type="file" id="compressFileInput" accept="image/*" hidden>
        </div>
        <div id="compressPreview"></div>
      </div>
      <div class="tool-section" id="compressSettings" style="display:none">
        <div class="tool-section-title">⚙️ 压缩设置</div>
        <div class="form-group">
          <label>压缩质量 <span class="hint">（数值越低文件越小）</span></label>
          <div class="range-group">
            <input type="range" id="compressQuality" min="1" max="100" value="70">
            <span class="range-value" id="compressQualityVal">70%</span>
          </div>
        </div>
        <div class="form-group">
          <label>输出格式</label>
          <select id="compressFormat">
            <option value="image/jpeg">JPG</option>
            <option value="image/webp">WebP</option>
            <option value="image/png">PNG</option>
          </select>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" id="compressBtn">🔧 开始压缩</button>
          <button class="btn btn-secondary" id="compressReset">重置</button>
        </div>
      </div>
      <div class="tool-section" id="compressResult" style="display:none">
        <div class="tool-section-title">📊 压缩结果</div>
        <div class="compare-container">
          <div class="compare-item">
            <div class="compare-label">原始图片</div>
            <div class="compare-value" id="compressOriginalInfo"></div>
            <img id="compressOriginalImg" style="max-height:200px;margin-top:8px;">
          </div>
          <div class="compare-item">
            <div class="compare-label">压缩后</div>
            <div class="compare-value" id="compressResultInfo"></div>
            <img id="compressResultImg" style="max-height:200px;margin-top:8px;">
          </div>
        </div>
        <div style="margin-top:12px;">
          <button class="btn btn-success" id="compressDownload">💾 下载压缩后的图片</button>
        </div>
      </div>`;
  }

  function initImageCompress() {
    let imgFile = null, imgDataUrl = null, resultBlob = null;

    const zone = $('#compressUploadZone');
    const input = $('#compressFileInput');
    const preview = $('#compressPreview');
    const settings = $('#compressSettings');
    const result = $('#compressResult');
    const qualitySlider = $('#compressQuality');
    const qualityVal = $('#compressQualityVal');
    const formatSelect = $('#compressFormat');

    // Hide quality slider for PNG (lossless format)
    const qualityGroup = qualitySlider.closest('.form-group');
    formatSelect.addEventListener('change', () => {
      if (formatSelect.value === 'image/png') {
        qualityGroup.style.display = 'none';
      } else {
        qualityGroup.style.display = '';
      }
    });

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });

    qualitySlider.addEventListener('input', () => { qualityVal.textContent = qualitySlider.value + '%'; });

    function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) { showToast('请选择图片文件', 'error'); return; }
      imgFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        imgDataUrl = reader.result;
        preview.innerHTML = `<div class="upload-preview"><div class="file-item"><span class="file-name">${file.name}</span><span class="file-size">${formatBytes(file.size)}</span></div></div>`;
        settings.style.display = '';
        result.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }

    $('#compressBtn').addEventListener('click', () => {
      if (!imgDataUrl) return showToast('请先上传图片', 'error');
      const quality = parseInt(qualitySlider.value) / 100;
      const format = $('#compressFormat').value;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(blob => {
          resultBlob = blob;
          const resultUrl = URL.createObjectURL(blob);

          $('#compressOriginalInfo').innerHTML = `<span class="block">文件名: ${imgFile.name}</span><span class="block">大小: ${formatBytes(imgFile.size)}</span><span class="block">尺寸: ${img.width}×${img.height}</span>`;
          $('#compressOriginalImg').src = imgDataUrl;
          $('#compressResultInfo').innerHTML = `<span class="block">格式: ${format.split('/')[1].toUpperCase()}</span><span class="block">大小: ${formatBytes(blob.size)}</span><span class="block">节省: ${((1 - blob.size / imgFile.size) * 100).toFixed(1)}%</span>`;
          $('#compressResultImg').src = resultUrl;
          result.style.display = '';

          showToast('压缩完成 ✅', 'success');
        }, format, quality);
      };
      img.src = imgDataUrl;
    });

    $('#compressReset').addEventListener('click', () => {
      imgFile = null; imgDataUrl = null; resultBlob = null;
      preview.innerHTML = '';
      settings.style.display = 'none';
      result.style.display = 'none';
      input.value = '';
    });

    $('#compressDownload').addEventListener('click', () => {
      if (!resultBlob) return;
      const ext = $('#compressFormat').value.split('/')[1] || 'jpg';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(resultBlob);
      a.download = `compressed.${ext}`;
      a.click();
    });
  }

  // ========== 🔄 图片格式转换 ==========
  function renderImageConvert() {
    return `
      <div class="tool-section">
        <div class="tool-section-title">📤 上传图片</div>
        <div class="upload-zone" id="convertUploadZone">
          <div class="upload-zone-icon">🔄</div>
          <div class="upload-zone-text">点击或拖拽上传图片<br><small>支持 JPG / PNG / WebP / GIF</small></div>
          <input type="file" id="convertFileInput" accept="image/*" hidden>
        </div>
        <div id="convertPreview"></div>
      </div>
      <div class="tool-section" id="convertSettings" style="display:none">
        <div class="tool-section-title">⚙️ 转换设置</div>
        <div class="form-group">
          <label>目标格式</label>
          <select id="convertTargetFormat">
            <option value="image/jpeg">JPG</option>
            <option value="image/png">PNG</option>
            <option value="image/webp">WebP</option>
          </select>
        </div>
        <div class="form-group">
          <label>质量 <span class="hint">（JPG/WebP适用，PNG可忽略）</span></label>
          <div class="range-group">
            <input type="range" id="convertQuality" min="1" max="100" value="90">
            <span class="range-value" id="convertQualityVal">90%</span>
          </div>
        </div>
        <button class="btn btn-primary" id="convertBtn">🔄 开始转换</button>
      </div>
      <div class="tool-section" id="convertResult" style="display:none">
        <div class="tool-section-title">✅ 转换结果</div>
        <div id="convertResultContent"></div>
        <button class="btn btn-success" id="convertDownload" style="margin-top:12px;">💾 下载</button>
      </div>`;
  }

  function initImageConvert() {
    let imgFile = null, imgDataUrl = null, resultBlob = null;

    const zone = $('#convertUploadZone');
    const input = $('#convertFileInput');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });

    $('#convertQuality').addEventListener('input', function() { $('#convertQualityVal').textContent = this.value + '%'; });

    function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) { showToast('请选择图片文件', 'error'); return; }
      imgFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        imgDataUrl = reader.result;
        $('#convertPreview').innerHTML = `<div class="upload-preview"><div class="file-item"><span class="file-name">${file.name}</span><span class="file-size">${formatBytes(file.size)}</span></div></div>`;
        $('#convertSettings').style.display = '';
        $('#convertResult').style.display = 'none';
      };
      reader.readAsDataURL(file);
    }

    $('#convertBtn').addEventListener('click', () => {
      if (!imgDataUrl) return showToast('请先上传图片', 'error');
      const format = $('#convertTargetFormat').value;
      const quality = parseInt($('#convertQuality').value) / 100;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          resultBlob = blob;
          const url = URL.createObjectURL(blob);
          $('#convertResultContent').innerHTML = `
            <div class="compare-container">
              <div class="compare-item">
                <div class="compare-label">原始 (${imgFile.type.split('/')[1].toUpperCase()})</div>
                <span>${formatBytes(imgFile.size)}</span>
              </div>
              <div class="compare-item">
                <div class="compare-label">转换后 (${format.split('/')[1].toUpperCase()})</div>
                <span>${formatBytes(blob.size)}</span>
              </div>
            </div>
            <img src="${url}" style="max-height:300px;margin-top:12px;display:block;">`;
          $('#convertResult').style.display = '';
          showToast('转换完成 ✅', 'success');
        }, format, quality);
      };
      img.src = imgDataUrl;
    });

    $('#convertDownload').addEventListener('click', () => {
      if (!resultBlob) return;
      const ext = $('#convertTargetFormat').value.split('/')[1] || 'png';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(resultBlob);
      a.download = `converted.${ext}`;
      a.click();
    });
  }

  // ========== 💧 图片加水印 ==========
  function renderImageWatermark() {
    return `
      <div class="tool-section">
        <div class="tool-section-title">📤 上传图片</div>
        <div class="upload-zone" id="watermarkUploadZone">
          <div class="upload-zone-icon">💧</div>
          <div class="upload-zone-text">点击或拖拽上传图片</div>
          <input type="file" id="watermarkFileInput" accept="image/*" hidden>
        </div>
        <div id="watermarkPreview"></div>
      </div>
      <div class="tool-section" id="watermarkSettings" style="display:none">
        <div class="tool-section-title">⚙️ 水印设置</div>
        <div class="form-group">
          <label>水印文字</label>
          <input type="text" id="wmText" value="Sample Watermark" maxlength="100">
        </div>
        <div class="form-group">
          <label>位置</label>
          <select id="wmPosition">
            <option value="center">居中</option>
            <option value="top-left">左上角</option>
            <option value="top-right">右上角</option>
            <option value="bottom-left">左下角</option>
            <option value="bottom-right">右下角</option>
            <option value="tile">平铺</option>
          </select>
        </div>
        <div class="form-group">
          <label>字体大小 <span class="hint">（px）</span></label>
          <input type="number" id="wmFontSize" value="32" min="8" max="200" class="compact">
        </div>
        <div class="form-group">
          <label>透明度</label>
          <div class="range-group">
            <input type="range" id="wmOpacity" min="1" max="100" value="30">
            <span class="range-value" id="wmOpacityVal">30%</span>
          </div>
        </div>
        <div class="form-group">
          <label>文字颜色</label>
          <input type="color" id="wmColor" value="#ffffff">
        </div>
        <button class="btn btn-primary" id="watermarkBtn">💧 添加水印</button>
      </div>
      <div class="tool-section" id="watermarkResult" style="display:none">
        <div class="tool-section-title">✅ 结果</div>
        <img id="watermarkResultImg" style="max-height:500px;display:block;">
        <button class="btn btn-success" id="watermarkDownload" style="margin-top:12px;">💾 下载</button>
      </div>`;
  }

  function initImageWatermark() {
    let imgFile = null, imgDataUrl = null, resultDataUrl = null;

    const zone = $('#watermarkUploadZone');
    const input = $('#watermarkFileInput');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });

    $('#wmOpacity').addEventListener('input', function() { $('#wmOpacityVal').textContent = this.value + '%'; });

    function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) { showToast('请选择图片文件', 'error'); return; }
      imgFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        imgDataUrl = reader.result;
        $('#watermarkPreview').innerHTML = `<div class="upload-preview"><div class="file-item"><span class="file-name">${file.name}</span><span class="file-size">${formatBytes(file.size)}</span></div></div>`;
        $('#watermarkSettings').style.display = '';
        $('#watermarkResult').style.display = 'none';
      };
      reader.readAsDataURL(file);
    }

    $('#watermarkBtn').addEventListener('click', () => {
      if (!imgDataUrl) return showToast('请先上传图片', 'error');
      const text = $('#wmText').value || 'Watermark';
      const position = $('#wmPosition').value;
      const fontSize = parseInt($('#wmFontSize').value) || 32;
      const opacity = parseInt($('#wmOpacity').value) / 100;
      const color = $('#wmColor').value;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        ctx.font = `bold ${fontSize}px -apple-system, "Noto Sans SC", sans-serif`;
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const metrics = ctx.measureText(text);
        const tw = metrics.width;
        const th = fontSize;

        if (position === 'tile') {
          ctx.textAlign = 'left';
          const spacing = Math.max(tw * 1.5, 100);
          for (let y = th; y < canvas.height + th; y += th * 2.5) {
            for (let x = 0; x < canvas.width + tw; x += spacing) {
              ctx.fillText(text, x, y);
            }
          }
        } else {
          let x, y;
          const pad = 30;
          switch (position) {
            case 'top-left':     x = pad + tw / 2; y = pad + th / 2; ctx.textAlign = 'center'; break;
            case 'top-right':    x = canvas.width - pad - tw / 2; y = pad + th / 2; ctx.textAlign = 'center'; break;
            case 'bottom-left':  x = pad + tw / 2; y = canvas.height - pad - th / 2; ctx.textAlign = 'center'; break;
            case 'bottom-right': x = canvas.width - pad - tw / 2; y = canvas.height - pad - th / 2; ctx.textAlign = 'center'; break;
            default:             x = canvas.width / 2; y = canvas.height / 2; ctx.textAlign = 'center'; break;
          }
          ctx.fillText(text, x, y);
        }

        resultDataUrl = canvas.toDataURL('image/png');
        $('#watermarkResultImg').src = resultDataUrl;
        $('#watermarkResult').style.display = '';
        showToast('水印添加完成 ✅', 'success');
      };
      img.src = imgDataUrl;
    });

    $('#watermarkDownload').addEventListener('click', () => {
      if (!resultDataUrl) return;
      const a = document.createElement('a');
      a.href = resultDataUrl;
      a.download = 'watermarked.png';
      a.click();
    });
  }

  // ========== 📎 PDF 合并 ==========
  function renderPdfMerge() {
    return `
      <div class="tool-section">
        <div class="tool-section-title">📤 选择 PDF 文件（可多选，按顺序合并）</div>
        <div class="upload-zone" id="mergeUploadZone">
          <div class="upload-zone-icon">📎</div>
          <div class="upload-zone-text">点击或拖拽上传 PDF<br><small>可选择多个文件</small></div>
          <input type="file" id="mergeFileInput" accept=".pdf,application/pdf" multiple hidden>
        </div>
        <div class="upload-preview" id="mergeFileList"></div>
      </div>
      <div class="tool-section" id="mergeActions" style="display:none">
        <button class="btn btn-primary" id="mergeBtn">📎 合并 PDF</button>
        <button class="btn btn-secondary" id="mergeReset">重置</button>
        <span id="mergeStatus" style="margin-left:12px;font-size:0.85rem;color:var(--text-secondary);"></span>
      </div>
      <div class="tool-section" id="mergeResult" style="display:none">
        <div class="tool-section-title">✅ 合并完成</div>
        <button class="btn btn-success" id="mergeDownload">💾 下载合并后的 PDF</button>
        <button class="btn btn-secondary" id="mergePreviewBtn" style="margin-left:8px;">👁 预览</button>
        <div id="mergePreview"></div>
      </div>`;
  }

  function initPdfMerge() {
    let pdfFiles = [];

    const zone = $('#mergeUploadZone');
    const input = $('#mergeFileInput');
    const fileList = $('#mergeFileList');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      addFiles(Array.from(e.dataTransfer.files));
    });
    input.addEventListener('change', () => { addFiles(Array.from(input.files)); });

    function addFiles(files) {
      const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (!pdfs.length) { showToast('请选择 PDF 文件', 'error'); return; }
      pdfFiles.push(...pdfs);
      renderFileList();
    }

    function renderFileList() {
      fileList.innerHTML = pdfFiles.map((f, i) => `
        <div class="file-item">
          <span class="file-name">📄 ${f.name}</span>
          <span class="file-size">${formatBytes(f.size)}</span>
          <span class="file-remove" data-idx="${i}">✕</span>
        </div>`).join('');
      fileList.querySelectorAll('.file-remove').forEach(el => {
        el.addEventListener('click', () => {
          pdfFiles.splice(parseInt(el.dataset.idx), 1);
          renderFileList();
          if (!pdfFiles.length) {
            $('#mergeActions').style.display = 'none';
            $('#mergeResult').style.display = 'none';
          }
        });
      });
      $('#mergeActions').style.display = pdfFiles.length ? '' : 'none';
      $('#mergeResult').style.display = 'none';
    }

    $('#mergeReset').addEventListener('click', () => {
      pdfFiles = [];
      fileList.innerHTML = '';
      $('#mergeActions').style.display = 'none';
      $('#mergeResult').style.display = 'none';
      input.value = '';
    });

    $('#mergeBtn').addEventListener('click', async () => {
      if (!pdfFiles.length) return showToast('请选择 PDF 文件', 'error');
      const status = $('#mergeStatus');
      status.innerHTML = '<span class="spinner"></span>正在合并...';

      try {
        const { PDFDocument } = PDFLib;
        const mergedDoc = await PDFDocument.create();

        for (const file of pdfFiles) {
          const bytes = await file.arrayBuffer();
          const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
          pages.forEach(p => mergedDoc.addPage(p));
        }

        const mergedBytes = await mergedDoc.save();
        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        $('#mergeResult').style.display = '';
        status.textContent = `已合并 ${pdfFiles.length} 个文件，共 ${mergedDoc.getPageCount()} 页`;

        $('#mergeDownload').onclick = () => {
          const a = document.createElement('a');
          a.href = url;
          a.download = 'merged.pdf';
          a.click();
        };

        $('#mergePreviewBtn').onclick = () => previewPdf(url, $('#mergePreview')[0]);
        showToast('PDF 合并完成 ✅', 'success');
      } catch (err) {
        showToast('合并失败: ' + err.message, 'error');
        status.textContent = '';
        console.error(err);
      }
    });
  }

  // ========== ✂️ PDF 拆分 ==========
  function renderPdfSplit() {
    return `
      <div class="tool-section">
        <div class="tool-section-title">📤 选择 PDF 文件</div>
        <div class="upload-zone" id="splitUploadZone">
          <div class="upload-zone-icon">✂️</div>
          <div class="upload-zone-text">点击或拖拽上传 PDF</div>
          <input type="file" id="splitFileInput" accept=".pdf,application/pdf" hidden>
        </div>
        <div class="upload-preview" id="splitFileInfo"></div>
      </div>
      <div class="tool-section" id="splitSettings" style="display:none">
        <div class="tool-section-title">📄 拆分设置 <span class="hint" id="splitPageInfo"></span></div>
        <div class="form-group">
          <label>页码范围 <span class="hint">（如: 1-3,5,7-9）</span></label>
          <input type="text" id="splitRange" placeholder="例如: 1-3 或 1,3,5">
        </div>
        <button class="btn btn-primary" id="splitBtn">✂️ 拆分</button>
        <button class="btn btn-secondary" id="splitReset" style="margin-left:8px;">重置</button>
      </div>
      <div class="tool-section" id="splitResult" style="display:none">
        <div class="tool-section-title">✅ 拆分结果</div>
        <div id="splitDownloads"></div>
      </div>`;
  }

  function initPdfSplit() {
    let pdfFile = null, pdfDoc = null;

    const zone = $('#splitUploadZone');
    const input = $('#splitFileInput');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });

    async function handleFile(file) {
      if (!file || (file.type !== 'application/pdf' && !file.name.endsWith('.pdf'))) {
        showToast('请选择 PDF 文件', 'error'); return;
      }
      pdfFile = file;
      $('#splitFileInfo').innerHTML = `<div class="upload-preview"><div class="file-item"><span class="file-name">📄 ${file.name}</span><span class="file-size">${formatBytes(file.size)}</span></div></div>`;

      try {
        const bytes = await file.arrayBuffer();
        pdfDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        const count = pdfDoc.getPageCount();
        $('#splitPageInfo').textContent = `（共 ${count} 页）`;
        $('#splitSettings').style.display = '';
        $('#splitResult').style.display = 'none';
      } catch (err) {
        showToast('PDF 读取失败: ' + err.message, 'error');
      }
    }

    function parseRange(str, max) {
      const pages = new Set();
      const parts = str.split(',').map(s => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (part.includes('-')) {
          const [a, b] = part.split('-').map(Number);
          if (isNaN(a) || isNaN(b)) continue;
          for (let i = Math.max(1, a); i <= Math.min(max, b); i++) pages.add(i);
        } else {
          const n = parseInt(part);
          if (!isNaN(n) && n >= 1 && n <= max) pages.add(n);
        }
      }
      return Array.from(pages).sort((a, b) => a - b);
    }

    $('#splitBtn').addEventListener('click', async () => {
      if (!pdfDoc) return showToast('请先选择 PDF', 'error');
      const rangeStr = $('#splitRange').value.trim();
      let pages;
      if (rangeStr) {
        pages = parseRange(rangeStr, pdfDoc.getPageCount());
        if (!pages.length) { showToast('页码范围无效', 'error'); return; }
      } else {
        pages = Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i + 1);
      }

      try {
        const { PDFDocument } = PDFLib;
        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(pdfDoc, pages.map(p => p - 1));
        copiedPages.forEach(p => newDoc.addPage(p));
        const bytes = await newDoc.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const name = pdfFile.name.replace(/\.pdf$/i, '') + '_split.pdf';

        $('#splitDownloads').innerHTML = `
          <div class="file-item">
            <span class="file-name">📄 ${name}</span>
            <span class="file-size">${formatBytes(blob.size)} · ${pages.length} 页</span>
            <button class="btn btn-sm btn-success" id="splitDownloadBtn">💾 下载</button>
          </div>`;
        $('#splitResult').style.display = '';

        $('#splitDownloadBtn').addEventListener('click', () => {
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          a.click();
        });

        showToast('PDF 拆分完成 ✅', 'success');
      } catch (err) {
        showToast('拆分失败: ' + err.message, 'error');
      }
    });

    $('#splitReset').addEventListener('click', () => {
      pdfFile = null; pdfDoc = null;
      $('#splitFileInfo').innerHTML = '';
      $('#splitSettings').style.display = 'none';
      $('#splitResult').style.display = 'none';
      input.value = '';
    });
  }

  // ========== 🖼 PDF 转图片 ==========
  function renderPdfToImage() {
    return `
      <div class="tool-section">
        <div class="tool-section-title">📤 选择 PDF 文件</div>
        <div class="upload-zone" id="toimgUploadZone">
          <div class="upload-zone-icon">🖼</div>
          <div class="upload-zone-text">点击或拖拽上传 PDF<br><small>将每一页转为图片</small></div>
          <input type="file" id="toimgFileInput" accept=".pdf,application/pdf" hidden>
        </div>
        <div class="upload-preview" id="toimgFileInfo"></div>
      </div>
      <div class="tool-section" id="toimgActions" style="display:none">
        <div class="form-group">
          <label>缩放比例 <span class="hint">（越大越清晰，处理越慢）</span></label>
          <div class="range-group">
            <input type="range" id="toimgScale" min="1" max="4" step="0.5" value="1.5">
            <span class="range-value" id="toimgScaleVal">1.5x</span>
          </div>
        </div>
        <div class="form-group">
          <label>图片格式</label>
          <select id="toimgFormat">
            <option value="png">PNG</option>
            <option value="jpeg">JPG</option>
            <option value="webp">WebP</option>
          </select>
        </div>
        <button class="btn btn-primary" id="toimgBtn">🖼 转换为图片</button>
        <span id="toimgStatus" style="margin-left:12px;font-size:0.85rem;color:var(--text-secondary);"></span>
      </div>
      <div class="tool-section" id="toimgResult" style="display:none">
        <div class="tool-section-title">✅ 转换结果</div>
        <div class="btn-group" style="margin-bottom:12px;">
          <button class="btn btn-sm btn-success" id="toimgDownloadAll">💾 下载全部</button>
          <span class="hint" style="align-self:center;">点击单张图片可下载</span>
        </div>
        <div class="pdf-pages-grid" id="toimgPages"></div>
      </div>`;
  }

  function initPdfToImage() {
    let pdfFile = null;
    let pageImages = [];

    // Set PDF.js worker
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const zone = $('#toimgUploadZone');
    const input = $('#toimgFileInput');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });

    $('#toimgScale').addEventListener('input', function() { $('#toimgScaleVal').textContent = this.value + 'x'; });

    function handleFile(file) {
      if (!file || (file.type !== 'application/pdf' && !file.name.endsWith('.pdf'))) {
        showToast('请选择 PDF 文件', 'error'); return;
      }
      pdfFile = file;
      $('#toimgFileInfo').innerHTML = `<div class="upload-preview"><div class="file-item"><span class="file-name">📄 ${file.name}</span><span class="file-size">${formatBytes(file.size)}</span></div></div>`;
      $('#toimgActions').style.display = '';
      $('#toimgResult').style.display = 'none';
      pageImages = [];
    }

    $('#toimgBtn').addEventListener('click', async () => {
      if (!pdfFile) return showToast('请先选择 PDF', 'error');
      if (typeof pdfjsLib === 'undefined') return showToast('PDF.js 加载失败，请刷新重试', 'error');

      const status = $('#toimgStatus');
      const scale = parseFloat($('#toimgScale').value);
      const format = $('#toimgFormat').value;
      pageImages = [];

      try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const total = pdf.numPages;

        for (let i = 1; i <= total; i++) {
          status.innerHTML = `<span class="spinner"></span>处理第 ${i}/${total} 页...`;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          const dataUrl = canvas.toDataURL('image/' + format, 0.9);
          pageImages.push({ pageNum: i, dataUrl, canvas });
        }

        renderPages();
        status.textContent = `完成，共 ${total} 页`;
        showToast('转换完成 ✅', 'success');
      } catch (err) {
        showToast('转换失败: ' + err.message, 'error');
        status.textContent = '';
        console.error(err);
      }
    });

    function renderPages() {
      const container = $('#toimgPages');
      container.innerHTML = pageImages.map(p => `
        <div class="pdf-page-item">
          <canvas data-idx="${p.pageNum - 1}" style="cursor:pointer;" title="点击下载"></canvas>
          <div class="page-label">第 ${p.pageNum} 页</div>
        </div>`).join('');

      pageImages.forEach((p, i) => {
        const c = container.querySelector(`canvas[data-idx="${i}"]`);
        if (c) {
          const srcCanvas = p.canvas;
          c.width = srcCanvas.width;
          c.height = srcCanvas.height;
          c.getContext('2d').drawImage(srcCanvas, 0, 0);
          c.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = p.dataUrl;
            a.download = `page_${p.pageNum}.${$('#toimgFormat').value}`;
            a.click();
          });
        }
      });

      $('#toimgResult').style.display = '';
    }

    // Download all as a ZIP-like experience (individual download)
    $('#toimgDownloadAll').addEventListener('click', () => {
      if (!pageImages.length) return;
      const format = $('#toimgFormat').value;
      pageImages.forEach((p, i) => {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = p.dataUrl;
          a.download = `page_${p.pageNum}.${format}`;
          a.click();
        }, i * 300);
      });
      showToast(`正在下载 ${pageImages.length} 张图片...`, 'success');
    });
  }

  // ========== 📦 PDF 压缩 ==========
  function renderPdfCompress() {
    return `
      <div class="tool-section">
        <div class="tool-section-title">📤 选择 PDF 文件</div>
        <div class="upload-zone" id="pdfCompressUploadZone">
          <div class="upload-zone-icon">📦</div>
          <div class="upload-zone-text">点击或拖拽上传 PDF<br><small>通过压缩内部图片减小体积</small></div>
          <input type="file" id="pdfCompressFileInput" accept=".pdf,application/pdf" hidden>
        </div>
        <div class="upload-preview" id="pdfCompressFileInfo"></div>
      </div>
      <div class="tool-section" id="pdfCompressSettings" style="display:none">
        <div class="tool-section-title">⚙️ 压缩设置</div>
        <div class="form-group">
          <label>图片质量</label>
          <div class="range-group">
            <input type="range" id="pdfCompressQuality" min="10" max="95" value="50">
            <span class="range-value" id="pdfCompressQualityVal">50%</span>
          </div>
        </div>
        <div class="form-group">
          <label>渲染分辨率 <span class="hint">（越小文件越小）</span></label>
          <div class="range-group">
            <input type="range" id="pdfCompressScale" min="0.5" max="2" step="0.1" value="1">
            <span class="range-value" id="pdfCompressScaleVal">1.0x</span>
          </div>
        </div>
        <button class="btn btn-primary" id="pdfCompressBtn">📦 开始压缩</button>
        <span id="pdfCompressStatus" style="margin-left:12px;font-size:0.85rem;color:var(--text-secondary);"></span>
      </div>
      <div class="tool-section" id="pdfCompressResult" style="display:none">
        <div class="tool-section-title">✅ 压缩完成</div>
        <div id="pdfCompressResultInfo"></div>
        <button class="btn btn-success" id="pdfCompressDownload">💾 下载压缩后的 PDF</button>
      </div>`;
  }

  function initPdfCompress() {
    let pdfFile = null;
    let resultUrl = null, resultSize = 0;

    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const zone = $('#pdfCompressUploadZone');
    const input = $('#pdfCompressFileInput');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });

    $('#pdfCompressQuality').addEventListener('input', function() { $('#pdfCompressQualityVal').textContent = this.value + '%'; });
    $('#pdfCompressScale').addEventListener('input', function() { $('#pdfCompressScaleVal').textContent = this.value.toFixed(1) + 'x'; });

    function handleFile(file) {
      if (!file || (file.type !== 'application/pdf' && !file.name.endsWith('.pdf'))) {
        showToast('请选择 PDF 文件', 'error'); return;
      }
      pdfFile = file;
      $('#pdfCompressFileInfo').innerHTML = `<div class="upload-preview"><div class="file-item"><span class="file-name">📄 ${file.name}</span><span class="file-size">${formatBytes(file.size)}</span></div></div>`;
      $('#pdfCompressSettings').style.display = '';
      $('#pdfCompressResult').style.display = 'none';
    }

    $('#pdfCompressBtn').addEventListener('click', async () => {
      if (!pdfFile) return showToast('请先选择 PDF', 'error');
      if (typeof pdfjsLib === 'undefined') return showToast('PDF.js 加载失败，请刷新重试', 'error');

      const status = $('#pdfCompressStatus');
      const quality = parseInt($('#pdfCompressQuality').value) / 100;
      const scale = parseFloat($('#pdfCompressScale').value);

      try {
        status.innerHTML = '<span class="spinner"></span>正在处理...';

        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const total = pdf.numPages;
        const { PDFDocument } = PDFLib;
        const newDoc = await PDFDocument.create();

        const imgFormat = 'image/jpeg';

        for (let i = 1; i <= total; i++) {
          status.innerHTML = `<span class="spinner"></span>压缩第 ${i}/${total} 页...`;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          // Convert canvas to JPEG blob with compression
          const imgDataUrl = canvas.toDataURL(imgFormat, quality);
          const imgBytes = await (await fetch(imgDataUrl)).arrayBuffer();

          // Embed as a full-page image
          let embeddedImg;
          if (imgFormat === 'image/jpeg') {
            embeddedImg = await newDoc.embedJpg(imgBytes);
          } else {
            embeddedImg = await newDoc.embedPng(imgBytes);
          }

          const pageW = viewport.width;
          const pageH = viewport.height;
          const newPage = newDoc.addPage([pageW, pageH]);
          newPage.drawImage(embeddedImg, { x: 0, y: 0, width: pageW, height: pageH });
        }

        const compressedBytes = await newDoc.save();
        const blob = new Blob([compressedBytes], { type: 'application/pdf' });
        resultUrl = URL.createObjectURL(blob);
        resultSize = blob.size;

        const reduction = ((1 - blob.size / pdfFile.size) * 100).toFixed(1);
        $('#pdfCompressResultInfo').innerHTML = `
          <div class="compare-container">
            <div class="compare-item">
              <div class="compare-label">原始</div>
              ${formatBytes(pdfFile.size)}
            </div>
            <div class="compare-item">
              <div class="compare-label">压缩后</div>
              ${formatBytes(blob.size)} <span style="color:${reduction > 0 ? 'var(--success)' : 'var(--error)'};">(${reduction > 0 ? '-' : '+'}${Math.abs(reduction)}%)</span>
            </div>
          </div>`;
        $('#pdfCompressResult').style.display = '';
        status.textContent = '完成';
        showToast('PDF 压缩完成 ✅', 'success');
      } catch (err) {
        showToast('压缩失败: ' + err.message, 'error');
        status.textContent = '';
        console.error(err);
      }
    });

    $('#pdfCompressDownload').addEventListener('click', () => {
      if (!resultUrl) return;
      const a = document.createElement('a');
      a.href = resultUrl;
      a.download = pdfFile.name.replace(/\.pdf$/i, '_compressed.pdf');
      a.click();
    });
  }

  // ========== { } JSON 格式化 ==========
  function renderJsonTool() {
    return `
      <div class="tool-section">
        <div class="tool-section-title">📝 输入 JSON</div>
        <textarea id="jsonInput" placeholder='{"hello": "world"}' rows="10"></textarea>
        <div class="btn-group" style="margin-top:12px;">
          <button class="btn btn-primary" id="jsonFormat">✨ 格式化</button>
          <button class="btn btn-secondary" id="jsonMinify">📦 压缩</button>
          <button class="btn btn-secondary" id="jsonClear">🗑 清空</button>
          <button class="btn btn-secondary" id="jsonCopy">📋 复制结果</button>
          <button class="btn btn-secondary" id="jsonSample">📄 加载示例</button>
        </div>
        <div id="jsonError" style="color:var(--error);font-size:0.85rem;margin-top:8px;"></div>
      </div>
      <div class="tool-section" id="jsonOutput" style="display:none;">
        <div class="tool-section-title">✅ 输出结果</div>
        <textarea id="jsonOutputText" rows="12" readonly></textarea>
      </div>`;
  }

  function initJsonTool() {
    const input = $('#jsonInput');
    const output = $('#jsonOutput');
    const outputText = $('#jsonOutputText');
    const error = $('#jsonError');

    function process(mode) {
      error.textContent = '';
      if (!input.value.trim()) {
        error.textContent = '⚠️ 请先输入 JSON 内容';
        output.style.display = 'none';
        return;
      }
      try {
        const obj = JSON.parse(input.value);
        const result = mode === 'pretty'
          ? JSON.stringify(obj, null, 2)
          : JSON.stringify(obj);
        outputText.value = result;
        output.style.display = '';
        showToast(mode === 'pretty' ? '格式化完成 ✅' : '压缩完成 ✅', 'success');
      } catch (e) {
        error.textContent = '❌ JSON 解析错误: ' + e.message;
        output.style.display = 'none';
      }
    }

    $('#jsonFormat').addEventListener('click', () => process('pretty'));
    $('#jsonMinify').addEventListener('click', () => process('minify'));
    $('#jsonClear').addEventListener('click', () => { input.value = ''; outputText.value = ''; output.style.display = 'none'; error.textContent = ''; });
    $('#jsonCopy').addEventListener('click', () => {
      if (outputText.value) copyToClipboard(outputText.value);
      else showToast('没有可复制的内容', 'error');
    });
    $('#jsonSample').addEventListener('click', () => {
      input.value = JSON.stringify({ name: "张三", age: 28, hobbies: ["编程", "阅读", "跑步"], address: { city: "北京", district: "朝阳区" }, active: true }, null, 2);
      error.textContent = '';
    });
  }

  // ========== .* 正则测试器 ==========
  function renderRegexTool() {
    return `
      <div class="tool-section">
        <div class="tool-section-title">🔍 正则表达式</div>
        <div class="form-group">
          <label>正则表达式</label>
          <input type="text" id="regexPattern" placeholder="例如: \\d{3}-\\d{4}">
        </div>
        <div class="form-group">
          <label>修饰符</label>
          <div class="btn-group">
            <label style="display:flex;align-items:center;gap:4px;font-weight:400;font-size:0.85rem;cursor:pointer;">
              <input type="checkbox" id="regexGlobal" checked> 全局 (g)
            </label>
            <label style="display:flex;align-items:center;gap:4px;font-weight:400;font-size:0.85rem;cursor:pointer;">
              <input type="checkbox" id="regexCase"> 忽略大小写 (i)
            </label>
            <label style="display:flex;align-items:center;gap:4px;font-weight:400;font-size:0.85rem;cursor:pointer;">
              <input type="checkbox" id="regexMultiline"> 多行 (m)
            </label>
          </div>
        </div>
      </div>
      <div class="tool-section">
        <div class="tool-section-title">📝 测试文本</div>
        <textarea id="regexText" placeholder="输入测试文本..." rows="6"></textarea>
      </div>
      <div class="tool-section" id="regexResult" style="display:none;">
        <div class="tool-section-title">✅ 匹配结果</div>
        <div class="regex-result" id="regexHighlight"></div>
        <div class="regex-info" id="regexInfo"></div>
      </div>`;
  }

  function initRegexTool() {
    const patternEl = $('#regexPattern');
    const textEl = $('#regexText');
    const highlightEl = $('#regexHighlight');
    const infoEl = $('#regexInfo');
    const resultEl = $('#regexResult');

    function update() {
      const pattern = patternEl.value;
      const text = textEl.value;
      if (!pattern) { resultEl.style.display = 'none'; return; }

      try {
        let flags = '';
        const isGlobal = $('#regexGlobal').checked;
        if (isGlobal) flags += 'g';
        if ($('#regexCase').checked) flags += 'i';
        if ($('#regexMultiline').checked) flags += 'm';

        // matchAll requires 'g' flag; force it for matching, then filter
        const regexForMatch = new RegExp(pattern, isGlobal ? flags : flags + 'g');
        let matches = [...text.matchAll(regexForMatch)];
        if (!isGlobal && matches.length > 0) matches = [matches[0]];

        if (matches.length === 0) {
          highlightEl.innerHTML = '<span style="color:var(--text-secondary);">无匹配结果</span>';
          infoEl.innerHTML = '<span class="info-item">匹配数: <strong>0</strong></span>';
        } else {
          // Highlight matches
          let lastIdx = 0;
          let html = '';
          for (const m of matches) {
            // Escape HTML for text between matches
            html += escHtml(text.slice(lastIdx, m.index));
            html += `<span class="regex-match">${escHtml(m[0])}</span>`;
            lastIdx = m.index + m[0].length;
          }
          html += escHtml(text.slice(lastIdx));
          highlightEl.innerHTML = html;

          infoEl.innerHTML = `<span class="info-item">匹配数: <strong>${matches.length}</strong></span>`;
          if (matches[0].length > 1) {
            infoEl.innerHTML += `<span class="info-item">捕获组: <strong>${matches[0].length - 1}</strong></span>`;
          }

          // Show first match groups
          const firstMatch = matches[0];
          if (firstMatch.length > 1) {
            let groupsHtml = '<div style="margin-top:8px;font-size:0.82rem;"><strong>第一个匹配的捕获组:</strong></div>';
            for (let i = 1; i < firstMatch.length; i++) {
              groupsHtml += `<span class="info-item" style="margin-top:4px;">$<strong>${i}</strong>: ${escHtml(firstMatch[i] || '(空)')}</span>`;
            }
            infoEl.innerHTML += groupsHtml;
          }
        }

        resultEl.style.display = '';
      } catch (e) {
        highlightEl.innerHTML = `<span style="color:var(--error);">正则表达式错误: ${escHtml(e.message)}</span>`;
        infoEl.innerHTML = '';
        resultEl.style.display = '';
      }
    }

    function escHtml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const debouncedUpdate = debounce(update, 300);
    patternEl.addEventListener('input', debouncedUpdate);
    textEl.addEventListener('input', debouncedUpdate);
    $('#regexGlobal').addEventListener('change', update);
    $('#regexCase').addEventListener('change', update);
    $('#regexMultiline').addEventListener('change', update);

    // Load sample
    patternEl.value = '\\d{3}-\\d{4}';
    textEl.value = '电话: 010-1234，还有一个是 021-5678，邮编 100-0001';
    update();
  }

  // ========== 🔐 Base64 编解码 ==========
  function renderBase64Tool() {
    return `
      <div class="tool-section">
        <div class="tool-section-title">📝 输入</div>
        <textarea id="b64Input" placeholder="输入文本或拖入图片..." rows="8"></textarea>
        <div class="btn-group" style="margin-top:12px;">
          <button class="btn btn-primary" id="b64Encode">🔒 编码 (文本 → Base64)</button>
          <button class="btn btn-primary" id="b64Decode">🔓 解码 (Base64 → 文本)</button>
          <button class="btn btn-secondary" id="b64Clear">清空</button>
          <button class="btn btn-secondary" id="b64Copy">复制结果</button>
        </div>
      </div>
      <div class="tool-section">
        <div class="tool-section-title">☁️ 快捷操作</div>
        <div class="btn-group">
          <button class="btn btn-secondary" id="b64ImageToB64">🖼 选择图片转 Base64</button>
          <span class="hint" style="align-self:center;">或拖拽图片到上方文本框</span>
        </div>
        <input type="file" id="b64ImageInput" accept="image/*" hidden>
      </div>
      <div class="tool-section" id="b64Output" style="display:none;">
        <div class="tool-section-title">✅ 结果</div>
        <textarea id="b64OutputText" rows="10" readonly></textarea>
        <div id="b64ImagePreview" style="margin-top:8px;"></div>
      </div>`;
  }

  function initBase64Tool() {
    const input = $('#b64Input');
    const output = $('#b64Output');
    const outputText = $('#b64OutputText');
    const preview = $('#b64ImagePreview');

    function utf8ToB64(str) {
      const bytes = new TextEncoder().encode(str);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    function b64ToUtf8(b64) {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }

    $('#b64Encode').addEventListener('click', () => {
      const text = input.value;
      if (!text) return showToast('请输入文本', 'error');
      try {
        const encoded = utf8ToB64(text);
        outputText.value = encoded;
        output.style.display = '';
        preview.innerHTML = '';
        showToast('编码完成 ✅', 'success');
      } catch (e) {
        showToast('编码失败: ' + e.message, 'error');
      }
    });

    $('#b64Decode').addEventListener('click', () => {
      let text = input.value.trim();
      if (!text) return showToast('请输入 Base64 文本', 'error');
      try {
        // Handle data: URLs - extract the Base64 part after the comma
        if (text.startsWith('data:image/')) {
          preview.innerHTML = `<img src="${text}" style="max-height:300px;display:block;border-radius:8px;margin-top:8px;">`;
          outputText.value = text;
          output.style.display = '';
          showToast('图片已显示 ✅', 'success');
          return;
        }
        if (text.startsWith('data:')) {
          // Extract base64 payload after comma for non-image data URLs
          const commaIdx = text.indexOf(',');
          if (commaIdx >= 0) text = text.slice(commaIdx + 1);
        }

        const decoded = b64ToUtf8(text);
        outputText.value = decoded;
        output.style.display = '';
        preview.innerHTML = '';
        showToast('解码完成 ✅', 'success');
      } catch (e) {
        showToast('解码失败: Base64 格式无效', 'error');
      }
    });

    $('#b64Clear').addEventListener('click', () => {
      input.value = '';
      outputText.value = '';
      output.style.display = 'none';
      preview.innerHTML = '';
    });

    $('#b64Copy').addEventListener('click', () => {
      if (outputText.value) copyToClipboard(outputText.value);
      else showToast('没有可复制的内容', 'error');
    });

    // Image to Base64
    const imgInput = $('#b64ImageInput');
    $('#b64ImageToB64').addEventListener('click', () => imgInput.click());
    imgInput.addEventListener('change', () => {
      if (imgInput.files[0]) imageToBase64(imgInput.files[0]);
    });

    // Drag & drop on textarea
    input.addEventListener('dragover', e => e.preventDefault());
    input.addEventListener('drop', e => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) imageToBase64(file);
    });

    function imageToBase64(file) {
      const reader = new FileReader();
      reader.onload = () => {
        input.value = reader.result;
        showToast('图片已转为 Base64 ✅', 'success');
      };
      reader.readAsDataURL(file);
    }
  }

  // ========== 📋 文本差异对比 ==========
  function renderDiffTool() {
    return `
      <div class="tool-section">
        <div class="tool-section-title">📝 对比文本</div>
        <div class="diff-container">
          <div>
            <div class="diff-pane">
              <div class="diff-pane-header">原始文本</div>
              <textarea id="diffLeft" placeholder="输入原始文本..." rows="10" style="border:none;border-radius:0;background:transparent;"></textarea>
            </div>
          </div>
          <div>
            <div class="diff-pane">
              <div class="diff-pane-header">修改后文本</div>
              <textarea id="diffRight" placeholder="输入修改后的文本..." rows="10" style="border:none;border-radius:0;background:transparent;"></textarea>
            </div>
          </div>
        </div>
        <div class="btn-group" style="margin-top:12px;">
          <button class="btn btn-primary" id="diffCompare">📋 对比差异</button>
          <button class="btn btn-secondary" id="diffClear">清空</button>
          <button class="btn btn-secondary" id="diffSample">加载示例</button>
        </div>
      </div>
      <div class="tool-section" id="diffResult" style="display:none;">
        <div class="tool-section-title">✅ 差异结果</div>
        <div class="diff-container" id="diffResultContainer"></div>
      </div>`;
  }

  function initDiffTool() {
    $('#diffCompare').addEventListener('click', () => {
      const left = $('#diffLeft').value;
      const right = $('#diffRight').value;
      const result = $('#diffResult');
      const container = $('#diffResultContainer');

      if (!left && !right) {
        result.style.display = 'none';
        showToast('请至少输入一边的文本内容', 'error');
        return;
      }

      const leftLines = left.split('\n');
      const rightLines = right.split('\n');
      const diff = computeDiff(leftLines, rightLines);

      container.innerHTML = `
        <div class="diff-pane">
          <div class="diff-pane-header">原始文本 (${leftLines.length} 行)</div>
          <div class="diff-pane-content">${diff.leftHtml}</div>
        </div>
        <div class="diff-pane">
          <div class="diff-pane-header">修改后 (${rightLines.length} 行)</div>
          <div class="diff-pane-content">${diff.rightHtml}</div>
        </div>`;
      result.style.display = '';
    });

    $('#diffClear').addEventListener('click', () => {
      $('#diffLeft').value = '';
      $('#diffRight').value = '';
      $('#diffResult').style.display = 'none';
    });

    $('#diffSample').addEventListener('click', () => {
      $('#diffLeft').value = `const name = "Alice";
const age = 25;
const city = "Beijing";

function greet() {
  console.log("Hello!");
  return "done";
}`;
      $('#diffRight').value = `const name = "Bob";
const age = 30;
const city = "Beijing";
const country = "China";

function greet(name) {
  console.log("Hello, " + name + "!");
  return "ok";
}`;
    });
  }

  function computeDiff(leftLines, rightLines) {
    // Simple LCS-based diff
    const m = leftLines.length;
    const n = rightLines.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (leftLines[i - 1] === rightLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack
    let i = m, j = n;
    const leftResult = [];
    const rightResult = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
        leftResult.unshift({ text: leftLines[i - 1], type: 'unchanged' });
        rightResult.unshift({ text: rightLines[j - 1], type: 'unchanged' });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        leftResult.unshift({ text: '', type: 'empty' });
        rightResult.unshift({ text: rightLines[j - 1], type: 'added' });
        j--;
      } else {
        leftResult.unshift({ text: leftLines[i - 1], type: 'removed' });
        rightResult.unshift({ text: '', type: 'empty' });
        i--;
      }
    }

    function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    const leftHtml = leftResult.map(l => {
      if (l.type === 'empty') return '<div class="diff-line">&nbsp;</div>';
      return `<div class="diff-line ${l.type}">${esc(l.text) || '&nbsp;'}</div>`;
    }).join('');

    const rightHtml = rightResult.map(l => {
      if (l.type === 'empty') return '<div class="diff-line">&nbsp;</div>';
      return `<div class="diff-line ${l.type}">${esc(l.text) || '&nbsp;'}</div>`;
    }).join('');

    return { leftHtml, rightHtml };
  }

  // ========== 🆔 UUID 生成器 ==========
  function renderUuidTool() {
    return `
      <div class="tool-section">
        <div class="tool-section-title">⚙️ 生成设置</div>
        <div class="form-group">
          <label>UUID 版本</label>
          <select id="uuidVersion">
            <option value="4">v4 — 随机（推荐）</option>
            <option value="1">v1 — 基于时间</option>
          </select>
        </div>
        <div class="form-group">
          <label>生成数量</label>
          <div class="range-group">
            <input type="range" id="uuidCount" min="1" max="50" value="5">
            <span class="range-value" id="uuidCountVal">5</span>
          </div>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" id="uuidGenerate">🆔 生成</button>
          <button class="btn btn-secondary" id="uuidCopyAll">📋 复制全部</button>
          <button class="btn btn-secondary" id="uuidClear">清空</button>
        </div>
      </div>
      <div class="tool-section" id="uuidResult" style="display:none;">
        <div class="tool-section-title">✅ 生成的 UUID</div>
        <div class="uuid-list" id="uuidList"></div>
      </div>`;
  }

  function initUuidTool() {
    const resultEl = $('#uuidResult');
    const listEl = $('#uuidList');

    $('#uuidCount').addEventListener('input', function() { $('#uuidCountVal').textContent = this.value; });

    function generateUUIDv4() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }

    function generateUUIDv1() {
      // Proper timestamp-based UUID v1
      const now = Date.now();
      // UUID v1: time_low - time_mid - version_time_hi - clock_seq_node
      // Gregorian epoch offset in 100ns intervals (Oct 15, 1582 to Jan 1, 1970)
      const epochOffset = 122192928000000000n;
      const timestamp = BigInt(now) * 10000n + epochOffset;

      // time_low (32 bits)
      const timeLow = Number(timestamp & 0xFFFFFFFFn);
      // time_mid (16 bits)
      const timeMid = Number((timestamp >> 32n) & 0xFFFFn);
      // time_hi_and_version (16 bits, version=1)
      const timeHi = Number((timestamp >> 48n) & 0x0FFFn) | 0x1000;

      // Clock sequence (14 bits, random)
      const clockSeq = (Math.random() * 0x4000) | 0x8000;
      // Node (48 bits, random with multicast bit set)
      const node = Array.from({length:6}, () => Math.floor(Math.random() * 256));
      node[0] |= 0x01;

      const pad = (n, len) => n.toString(16).padStart(len, '0');
      return `${pad(timeLow,8)}-${pad(timeMid,4)}-${pad(timeHi,4)}-${pad(clockSeq,4)}-${node.map(b => pad(b,2)).join('')}`;
    }

    $('#uuidGenerate').addEventListener('click', () => {
      const version = $('#uuidVersion').value;
      const count = parseInt($('#uuidCount').value);
      const gen = version === '1' ? generateUUIDv1 : generateUUIDv4;
      const uuids = Array.from({ length: count }, () => gen());

      listEl.innerHTML = uuids.map(u => `
        <div class="uuid-item">
          <span class="uuid-text">${u}</span>
          <span class="uuid-copy">复制</span>
        </div>`).join('');

      // Add click handlers
      listEl.querySelectorAll('.uuid-copy').forEach((el, i) => {
        el.addEventListener('click', () => copyToClipboard(uuids[i]));
      });

      resultEl.style.display = '';
    });

    $('#uuidCopyAll').addEventListener('click', () => {
      const items = listEl.querySelectorAll('.uuid-text');
      if (!items.length) return showToast('请先生成 UUID', 'error');
      const all = Array.from(items).map(el => el.textContent).join('\n');
      copyToClipboard(all);
    });

    $('#uuidClear').addEventListener('click', () => {
      listEl.innerHTML = '';
      resultEl.style.display = 'none';
    });

    // Generate some on load
    $('#uuidGenerate').click();
  }

  // ========== ⏰ 时间戳工具 ==========
  function renderTimestampTool() {
    const now = Date.now();
    const nowSec = Math.floor(now / 1000);
    return `
      <div class="tool-section">
        <div class="tool-section-title">🕐 当前时间</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;">
          <div style="background:var(--primary-light);padding:12px 20px;border-radius:var(--radius);">
            <div style="font-size:0.8rem;color:var(--text-secondary);">秒级时间戳</div>
            <div style="font-size:1.3rem;font-weight:700;color:var(--primary);font-family:monospace;" id="tsNowSec">${nowSec}</div>
          </div>
          <div style="background:var(--primary-light);padding:12px 20px;border-radius:var(--radius);">
            <div style="font-size:0.8rem;color:var(--text-secondary);">毫秒级时间戳</div>
            <div style="font-size:1.3rem;font-weight:700;color:var(--primary);font-family:monospace;" id="tsNowMs">${now}</div>
          </div>
          <div style="background:var(--bg);padding:12px 20px;border-radius:var(--radius);border:1px solid var(--border);">
            <div style="font-size:0.8rem;color:var(--text-secondary);">当前时间</div>
            <div style="font-size:1.1rem;font-weight:600;" id="tsNowReadable"></div>
          </div>
        </div>
        <div style="margin-top:8px;">
          <button class="btn btn-sm btn-secondary" id="tsCopyNowSec">📋 复制秒级</button>
          <button class="btn btn-sm btn-secondary" id="tsCopyNowMs" style="margin-left:6px;">📋 复制毫秒</button>
          <span style="font-size:0.78rem;color:var(--text-secondary);margin-left:8px;" id="tsLiveStatus">🟢 实时更新中</span>
        </div>
      </div>

      <div class="tool-section">
        <div class="tool-section-title">🔄 时间戳 → 日期时间</div>
        <div class="form-group">
          <label>输入时间戳</label>
          <input type="text" id="tsInput" placeholder="例如: ${nowSec} 或 ${now}">
        </div>
        <div class="form-group">
          <label>单位</label>
          <select id="tsUnit">
            <option value="auto">自动识别</option>
            <option value="s">秒级（10位）</option>
            <option value="ms">毫秒级（13位）</option>
          </select>
        </div>
        <button class="btn btn-primary" id="tsConvert">🔄 转换</button>
      </div>

      <div class="tool-section" id="tsResultSection" style="display:none;">
        <div class="tool-section-title">✅ 转换结果</div>
        <div id="tsResults"></div>
      </div>

      <div class="tool-section">
        <div class="tool-section-title">📅 日期时间 → 时间戳</div>
        <div class="form-group">
          <label>选择日期时间</label>
          <input type="datetime-local" id="tsDateTime" style="width:auto;min-width:250px;">
        </div>
        <div class="btn-group" style="margin-top:8px;">
          <button class="btn btn-primary" id="tsToTimestamp">→ 转为时间戳</button>
          <button class="btn btn-secondary" id="tsSetNow">设为当前时间</button>
        </div>
      </div>

      <div class="tool-section" id="tsReverseResult" style="display:none;">
        <div class="tool-section-title">✅ 时间戳结果</div>
        <div id="tsReverseResults"></div>
      </div>`;
  }

  function initTimestampTool() {
    const FORMATS = {
      'YYYY-MM-DD HH:mm:ss': (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      },
      'YYYY-MM-DD': (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      },
      'YYYY/MM/DD HH:mm:ss': (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      },
      'ISO 8601': (d) => d.toISOString(),
      'UTC String': (d) => d.toUTCString(),
      'Locale String': (d) => d.toLocaleString('zh-CN'),
      '中文格式': (d) => {
        return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      },
      '星期': (d) => ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getDay()],
    };

    // Live clock
    function updateLiveClock() {
      const nowMs = Date.now();
      const nowSec = Math.floor(nowMs / 1000);
      const d = new Date();
      const elSec = $('#tsNowSec');
      const elMs = $('#tsNowMs');
      const elRead = $('#tsNowReadable');
      if (elSec) elSec.textContent = nowSec;
      if (elMs) elMs.textContent = nowMs;
      if (elRead) {
        const pad = (n) => String(n).padStart(2, '0');
        elRead.textContent = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
    }

    updateLiveClock();
    trackTimer(setInterval(updateLiveClock, 1000));

    // Copy now buttons
    $('#tsCopyNowSec').addEventListener('click', () => {
      copyToClipboard(String(Math.floor(Date.now() / 1000)));
    });
    $('#tsCopyNowMs').addEventListener('click', () => {
      copyToClipboard(String(Date.now()));
    });

    // Set datetime-local default
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const localStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const dtInput = $('#tsDateTime');
    if (dtInput) dtInput.value = localStr;

    $('#tsSetNow').addEventListener('click', () => {
      const n = new Date();
      const s = `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`;
      if (dtInput) dtInput.value = s;
    });

    // Timestamp → Date
    $('#tsConvert').addEventListener('click', () => {
      let val = $('#tsInput').value.trim();
      if (!val) return showToast('请输入时间戳', 'error');

      // Remove non-numeric chars except maybe we have a float
      let ts = parseInt(val, 10);
      if (isNaN(ts)) return showToast('无效的时间戳', 'error');

      const unit = $('#tsUnit').value;
      if (unit === 's' || (unit === 'auto' && ts < 10000000000)) {
        // Seconds
      } else {
        ts = Math.floor(ts / 1000);
      }

      const d = new Date(ts * 1000);
      if (isNaN(d.getTime())) return showToast('无效的时间戳', 'error');

      const results = $('#tsResults');
      let html = `<div style="display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:0.88rem;">`;
      html += `<div style="font-weight:600;color:var(--text-secondary);">秒级时间戳</div><div style="font-family:monospace;">${ts}</div>`;
      html += `<div style="font-weight:600;color:var(--text-secondary);">毫秒时间戳</div><div style="font-family:monospace;">${ts * 1000}</div>`;

      for (const [label, fn] of Object.entries(FORMATS)) {
        html += `<div style="font-weight:600;color:var(--text-secondary);">${label}</div><div style="font-family:monospace;">${fn(d)}</div>`;
      }
      html += `</div>`;
      html += `<div style="margin-top:10px;"><button class="btn btn-sm btn-secondary" id="tsCopySec">📋 复制秒级</button>`;
      html += `<button class="btn btn-sm btn-secondary" id="tsCopyMs" style="margin-left:6px;">📋 复制毫秒</button>`;
      html += `<button class="btn btn-sm btn-secondary" id="tsCopyIso" style="margin-left:6px;">📋 复制ISO</button></div>`;

      results.innerHTML = html;
      $('#tsResultSection').style.display = '';

      document.getElementById('tsCopySec').addEventListener('click', () => copyToClipboard(String(ts)));
      document.getElementById('tsCopyMs').addEventListener('click', () => copyToClipboard(String(ts * 1000)));
      document.getElementById('tsCopyIso').addEventListener('click', () => copyToClipboard(d.toISOString()));
    });

    // Date → Timestamp
    $('#tsToTimestamp').addEventListener('click', () => {
      const val = dtInput ? dtInput.value : '';
      if (!val) return showToast('请选择日期时间', 'error');
      const d = new Date(val);
      if (isNaN(d.getTime())) return showToast('无效的日期时间', 'error');

      const tsMs = d.getTime();
      const tsSec = Math.floor(tsMs / 1000);

      const container = $('#tsReverseResults');
      let html = `<div style="display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:0.88rem;">`;
      html += `<div style="font-weight:600;color:var(--text-secondary);">秒级时间戳</div><div style="font-family:monospace;font-size:1rem;color:var(--primary);">${tsSec}</div>`;
      html += `<div style="font-weight:600;color:var(--text-secondary);">毫秒时间戳</div><div style="font-family:monospace;font-size:1rem;color:var(--primary);">${tsMs}</div>`;
      html += `</div>`;
      html += `<div style="margin-top:10px;"><button class="btn btn-sm btn-secondary" id="tsRevCopySec">📋 复制秒级</button>`;
      html += `<button class="btn btn-sm btn-secondary" id="tsRevCopyMs" style="margin-left:6px;">📋 复制毫秒</button></div>`;

      container.innerHTML = html;
      $('#tsReverseResult').style.display = '';

      document.getElementById('tsRevCopySec').addEventListener('click', () => copyToClipboard(String(tsSec)));
      document.getElementById('tsRevCopyMs').addEventListener('click', () => copyToClipboard(String(tsMs)));
    });

  }

  // ========== PDF 预览辅助 ==========
  async function previewPdf(url, container) {
    if (typeof pdfjsLib === 'undefined') {
      container.innerHTML = '<p style="color:var(--error);">PDF.js 加载失败</p>';
      return;
    }
    container.innerHTML = '<div class="loading-overlay"><span class="spinner"></span>加载预览...</div>';
    try {
      const pdf = await pdfjsLib.getDocument(url).promise;
      container.innerHTML = '<div class="pdf-pages-grid"></div>';
      const grid = container.querySelector('.pdf-pages-grid');
      const maxPreview = Math.min(pdf.numPages, 5);
      for (let i = 1; i <= maxPreview; i++) {
        const page = await pdf.getPage(i);
        const scale = 0.5;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        grid.innerHTML += `<div class="pdf-page-item"><canvas></canvas><div class="page-label">第 ${i} 页</div></div>`;
        const dest = grid.lastElementChild.querySelector('canvas');
        dest.width = canvas.width;
        dest.height = canvas.height;
        dest.getContext('2d').drawImage(canvas, 0, 0);
      }
      if (pdf.numPages > maxPreview) {
        container.innerHTML += `<p style="text-align:center;color:var(--text-secondary);font-size:0.85rem;margin-top:8px;">... 共 ${pdf.numPages} 页，仅显示前 ${maxPreview} 页</p>`;
      }
    } catch (err) {
      container.innerHTML = `<p style="color:var(--error);">预览失败: ${err.message}</p>`;
    }
  }

  // ========== 路由处理 ==========
  function handleRoute() {
    clearAllTimers();
    const route = parseRoute();
    updateNavActive(route);
    updateBreadcrumb(route);

    if (route === '/' || route === '') {
      renderHome();
    } else if (tools[route]) {
      renderTool(route);
    } else {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3>页面未找到</h3>
          <p>请从侧边栏选择一个工具</p>
          <a href="#/" class="btn btn-primary" style="margin-top:16px;">返回首页</a>
        </div>`;
    }

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('show');
    }
  }

  // ========== 事件绑定 ==========
  window.addEventListener('hashchange', handleRoute);

  // Menu toggle
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('show');
  });
  sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('show');
  });

  // Search
  sidebarSearch.addEventListener('input', debounce(() => searchTools(sidebarSearch.value), 200));
  topbarSearch.addEventListener('input', debounce(() => {
    searchTools(topbarSearch.value);
  }, 200));

  // Nav section collapse
  document.querySelectorAll('.nav-section-title').forEach(title => {
    title.addEventListener('click', () => {
      const section = title.closest('.nav-section');
      section.classList.toggle('collapsed');
    });
  });

  // Keyboard shortcut: Escape to close search
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      sidebarSearch.value = '';
      topbarSearch.value = '';
      searchTools('');
    }
  });

  // ========== 初始化 ==========
  handleRoute();

})();
