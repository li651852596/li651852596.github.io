(function () {
  // Keep the language switcher pinned top-right, above page content.
  var css = document.createElement('style');
  css.textContent =
    '#translate{position:fixed;top:14px;right:14px;z-index:99999;}' +
    '#translate select{font-size:13px;padding:5px 8px;border:1px solid #ccc;' +
    'border-radius:6px;background:#fff;color:#333;max-width:200px;' +
    'box-shadow:0 2px 8px rgba(0,0,0,.12);cursor:pointer;}';
  document.head.appendChild(css);

  if (typeof translate === 'undefined') {
    return;
  }

  // This site's original language is Chinese.
  translate.language.setLocal('chinese_simplified');

  // Do NOT restrict selectLanguageTag.languages - leave it unset so the
  // switcher shows every language supported by the translation service (100+).

  // Free community translation channel - no API key required.
  translate.service.use('client.edge');

  // Also translate text injected by JavaScript after load.
  translate.listener.start();

  // Never translate brand names.
  translate.ignore.text.push('KYHS', 'KEYUE HONGSHENG', 'AI Hub');

  translate.execute();
})();
