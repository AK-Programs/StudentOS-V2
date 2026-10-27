/**
 * fix-apk.js - StudentOS APK WebView Download & AI Voice Compatibility Fix
 * Intercepts download links, converts blob URLs to base64 Data URLs,
 * and routes external downloads to Chrome Intent in WebView environments.
 */
(function () {
  // Detect if running inside Android APK WebView
  var ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
  var isAPK = /wv|webview/i.test(ua) || typeof window.Android !== 'undefined' || typeof window.AndroidInterface !== 'undefined';

  window.isAPKWebView = function () {
    return isAPK;
  };

  /**
   * Helper: Convert Blob or File object to Base64 Data URL using FileReader
   */
  window.blobToBase64 = function (blob) {
    return new Promise(function (resolve, reject) {
      if (!blob) {
        reject(new Error('No blob provided'));
        return;
      }
      var reader = new FileReader();
      reader.onloadend = function () {
        resolve(reader.result);
      };
      reader.onerror = function (err) {
        reject(err);
      };
      reader.readAsDataURL(blob);
    });
  };

  /**
   * Helper: Play AI Voice safely using Base64 Data URL instead of blob: URL
   */
  window.playAIVoice = async function (blobOrUrl) {
    try {
      var audioSrc = blobOrUrl;
      if (blobOrUrl instanceof Blob) {
        audioSrc = await window.blobToBase64(blobOrUrl);
      }
      var audio = new Audio();
      audio.src = audioSrc;
      await audio.play();
      return audio;
    } catch (e) {
      console.warn('[APK Fix] playAIVoice error:', e);
      throw e;
    }
  };

  /**
   * Helper: Download AI Voice or file safely across browsers & APK WebView
   */
  window.downloadAIVoice = async function (blobOrUrl, filename) {
    filename = filename || 'ai_voice_' + Date.now() + '.mp3';
    try {
      var dataUrl = blobOrUrl;
      if (blobOrUrl instanceof Blob) {
        dataUrl = await window.blobToBase64(blobOrUrl);
      }

      if (isAPK) {
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
          var win = window.open(dataUrl, '_blank');
          if (!win) {
            window.location.href = dataUrl;
          }
        } else {
          window.openExternalDownload(dataUrl, filename);
        }
      } else {
        var a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          if (a.parentNode) a.parentNode.removeChild(a);
        }, 500);
      }
    } catch (e) {
      console.warn('[APK Fix] downloadAIVoice error:', e);
    }
  };

  /**
   * Helper: Launch external Chrome intent or blank window for downloads
   */
  window.openExternalDownload = function (url, filename) {
    if (!url) return;
    try {
      var absUrl = url;
      if (!absUrl.startsWith('http://') && !absUrl.startsWith('https://') && !absUrl.startsWith('data:')) {
        absUrl = new URL(url, window.location.href).href;
      }

      if (isAPK && (absUrl.startsWith('https://') || absUrl.startsWith('http://'))) {
        var cleanUrl = absUrl.replace(/^https?:\/\//, '');
        var intentUrl = 'intent://' + cleanUrl + '#Intent;scheme=https;package=com.android.chrome;end;';
        
        var win = window.open(absUrl, '_blank');
        if (!win) {
          window.location.href = intentUrl;
        }
        return;
      }

      window.open(absUrl, '_blank');
    } catch (err) {
      console.warn('[APK Fix] openExternalDownload error:', err);
      window.open(url, '_blank');
    }
  };

  /**
   * Global Click Interceptor for <a> tags with download attribute or file extensions
   */
  document.addEventListener('click', function (e) {
    var target = e.target;
    while (target && target !== document.body && target.tagName !== 'A') {
      target = target.parentElement;
    }

    if (!target || target.tagName !== 'A') return;

    var href = target.getAttribute('href') || target.getAttribute('data-url') || '';
    var hasDownloadAttr = target.hasAttribute('download');
    var isDownloadPath = /\/download/i.test(href);
    var isDownloadExt = /\.(pdf|mp3|wav|ogg|zip|rar|mp4|docx|doc|xlsx|csv|png|jpg|jpeg)$/i.test(href.split('?')[0]);

    if (hasDownloadAttr || isDownloadPath || isDownloadExt) {
      if (isAPK) {
        e.preventDefault();
        e.stopPropagation();

        var filename = target.getAttribute('download') || 'download';
        if (href.startsWith('blob:') || href.startsWith('data:')) {
          window.openExternalDownload(href, filename);
        } else {
          var absoluteHref = href;
          if (!absoluteHref.startsWith('http://') && !absoluteHref.startsWith('https://') && !absoluteHref.startsWith('data:')) {
            absoluteHref = new URL(href, window.location.href).href;
          }
          window.openExternalDownload(absoluteHref, filename);
        }
      }
    }
  }, true);

})();
