(function () {
  // World's top 20 languages by native speakers, mapped to translate.js language codes.
  var top20 = [
    'chinese_simplified',   // 中文
    'english',              // English
    'hindi',                // हिन्दी
    'arabic',               // العربية
    'portuguese',           // Português
    'bengali',              // বাংলা
    'russian',              // Русский
    'japanese',             // 日本語
    'punjabi',              // ਪੰਜਾਬੀ
    'german',               // Deutsch
    'korean',               // 한국어
    'french',               // Français
    'spanish',              // Español
    'italian',              // Italiano
    'turkish',              // Türkçe
    'vietnamese',           // Tiếng Việt
    'thai',                 // ไทย
    'marathi',              // मराठी
    'tamil',                // தமிழ்
    'indonesian'            // Bahasa Indonesia
  ];

  // Keep the language switcher pinned top-right, above page content.
  var css = document.createElement('style');
  css.textContent =
    '#translate{position:fixed;top:14px;right:14px;z-index:99999;}' +
    '#translate select{font-size:13px;padding:5px 8px;border:1px solid #ccc;' +
    'border-radius:6px;background:#fff;color:#333;max-width:180px;' +
    'box-shadow:0 2px 8px rgba(0,0,0,.12);cursor:pointer;}';
  document.head.appendChild(css);

  if (typeof translate === 'undefined') {
    return;
  }

  // This site's original language is Chinese.
  translate.language.setLocal('chinese_simplified');

  // Keep the switcher to the 20 most spoken languages only.
  translate.selectLanguageTag.languages = top20.join(',');

  // Use the free community translation channel (no API key required).
  translate.service.use('client.edge');

  // Also translate text injected by JavaScript after load.
  translate.listener.start();

  // Never translate brand names.
  translate.ignore.text.push('KYHS', 'KEYUE HONGSHENG', 'AI Hub');

  translate.execute();
})();
