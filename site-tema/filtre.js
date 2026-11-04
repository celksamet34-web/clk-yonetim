/* ===== CLK FİLTRE (Claude, 03.11.2026): kategori filtreleri – açılır başlıklar, cm, seçili filtre hapları, mobil alt sayfa ===== */
(function () {
    var DENEME = false; // true: yalnız localStorage clkYeni=1 olan görür
    try { if (DENEME && localStorage.getItem('clkYeni') !== '1') return; } catch (e) { if (DENEME) return; }
    function basla() {
        var sec = document.querySelector('.mobil-filtre');
        if (!sec || !sec.querySelector('.p-g-mod-t-cat-filter')) return;
        var col = sec.querySelector('.col-list:first-child');
        var sag = sec.querySelector('.p-g-b-c-1 .p-g-b-c-inner');
        if (!col || !sag) return;
        document.body.classList.add('clk-filtre');
        var OLCU = { 'en': 1, 'yükseklik': 1, 'yukseklik': 1, 'boy': 1, 'derinlik': 1, 'genişlik': 1 };
        var KAPALI = 'clkFiltreKapali';
        var kapali = {};
        try { kapali = JSON.parse(sessionStorage.getItem(KAPALI) || '{}') || {}; } catch (e) {}
        var mobil = function () { return window.innerWidth < 992; };

        function baslik(m) { var t = m.querySelector('.p-g-m-h-i-title'); return t ? t.textContent.replace(/\s+/g, ' ').trim() : ''; }
        function temizBaslik(m) { var t = m.querySelector('.p-g-m-h-i-title'); if (!t) return ''; var c = t.cloneNode(true); var s = c.querySelector('.clk-f-say'); if (s) s.remove(); return c.textContent.replace(/\s+/g, ' ').trim(); }
        function seciliInputlar() {
            return Array.prototype.filter.call(col.querySelectorAll('.p-g-mod-t-cat-filter input:checked'), function (i) { return i.type === 'checkbox' || i.type === 'radio'; });
        }
        function etiket(i) { var l = i.parentNode.querySelector('label'); return l ? l.textContent.replace(/\s+/g, ' ').trim() : ''; }
        function temizleLink() { return col.querySelector('.p-g-mod-t-26 .btn-secondary'); }

        var ciz = function () {
            obs.disconnect();
            try {
                // modüller: açılır başlık, cm ve seçim sayısı
                Array.prototype.forEach.call(col.querySelectorAll('.p-g-mod-t-cat-filter'), function (m) {
                    var ad = temizBaslik(m);
                    var h = m.querySelector('.p-g-mod-header');
                    if (!h || !ad) return;
                    if (!h.clkBag) {
                        h.clkBag = 1;
                        if (kapali[ad] === undefined && mobil() && !m.querySelector('input:checked') && m.querySelectorAll('li').length > 6) kapali[ad] = 1;
                        if (kapali[ad]) m.classList.add('clk-kapali');
                        h.addEventListener('click', function () {
                            var k = m.classList.toggle('clk-kapali');
                            kapali[temizBaslik(m)] = k ? 1 : 0;
                            try { sessionStorage.setItem(KAPALI, JSON.stringify(kapali)); } catch (e) {}
                        });
                    }
                    if (OLCU[ad.toLocaleLowerCase('tr')]) {
                        Array.prototype.forEach.call(m.querySelectorAll('.lag-checkbox label'), function (l) {
                            if (!/cm$/i.test(l.textContent.trim()) && /^[\d.,]+$/.test(l.textContent.trim())) l.textContent = l.textContent.trim() + ' cm';
                        });
                    }
                    var n = m.querySelectorAll('input:checked').length;
                    var t = m.querySelector('.p-g-m-h-i-title');
                    var s = t.querySelector('.clk-f-say');
                    if (n && !s) { s = document.createElement('span'); s.className = 'clk-f-say'; t.appendChild(s); }
                    if (s) { if (n) s.textContent = n; else s.remove(); }
                });

                // seçili filtreler
                var secili = seciliInputlar();
                sec.classList.toggle('clk-f-var', secili.length > 0);
                var kutu = sag.querySelector('.clk-secili');
                var cubuk = sag.querySelector('.category-filter-order');
                if (!kutu) { kutu = document.createElement('div'); kutu.className = 'clk-secili'; }
                if (cubuk && cubuk.parentNode !== sag && !cubuk.parentNode.classList.contains('clk-f-sar')) cubuk.parentNode.classList.add('clk-f-sar');
                if (cubuk && kutu.previousElementSibling !== cubuk) cubuk.parentNode.insertBefore(kutu, cubuk.nextSibling);
                else if (!cubuk && !kutu.parentNode) sag.insertBefore(kutu, sag.firstChild);
                var html = '';
                secili.forEach(function (i, k) {
                    var m = i.closest('.p-g-mod');
                    var ad = m ? temizBaslik(m) : ''; if (/^fiyat/i.test(ad)) ad = 'Fiyat';
                    html += '<button type="button" data-k="' + k + '"><small>' + ad + '</small>' + etiket(i).replace(/</g, '&lt;') + '<i>×</i></button>';
                });
                if (secili.length > 1 && temizleLink()) html += '<button type="button" class="clk-temizle">Tümünü temizle</button>';
                if (kutu.clkHtml !== html) { kutu.innerHTML = html; kutu.clkHtml = html; }
                kutu.clkSecili = secili;

                // mobil filtre düğmesi sayısı
                var fb = sec.querySelector('.category-filter-order .mobile-filter-btn');
                if (fb) {
                    var fs = fb.querySelector('.clk-f-say');
                    if (secili.length && !fs) { fs = document.createElement('span'); fs.className = 'clk-f-say'; fb.appendChild(fs); }
                    if (fs) { if (secili.length) fs.textContent = secili.length; else fs.remove(); }
                }

                // mobil alt düğmeler
                var alt = col.querySelector('.clk-f-alt');
                if (!alt) {
                    alt = document.createElement('div'); alt.className = 'clk-f-alt';
                    alt.innerHTML = '<button type="button" class="clk-f-temizle">Temizle</button><button type="button" class="clk-f-goster">Ürünleri göster</button>';
                    col.appendChild(alt);
                    alt.querySelector('.clk-f-temizle').addEventListener('click', function () { var a = temizleLink(); if (a) a.click(); });
                    alt.querySelector('.clk-f-goster').addEventListener('click', function () {
                        col.classList.remove('active'); document.body.classList.remove('hidden-scroll', 'clk-f-acik');
                        var y = sec.getBoundingClientRect().top + window.pageYOffset - 70; if (window.pageYOffset > y) window.scrollTo({ top: y, behavior: 'smooth' });
                    });
                }
                alt.querySelector('.clk-f-temizle').disabled = !secili.length;
                document.body.classList.toggle('clk-f-acik', col.classList.contains('active') && mobil());
            } finally {
                obs.observe(sec, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
            }
        };
        var bekle = null;
        var obs = new MutationObserver(function () { clearTimeout(bekle); bekle = setTimeout(ciz, 60); });
        sec.addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('.clk-secili button');
            if (!b) return;
            if (b.classList.contains('clk-temizle')) { var a = temizleLink(); if (a) a.click(); return; }
            var i = (b.parentNode.clkSecili || [])[+b.getAttribute('data-k')];
            if (i) { var l = i.parentNode.querySelector('label'); (l || i).click(); }
        });
        // telefonda her seçim sayfayı yeniler: pencere açıksa yenilenince yeniden aç
        var ACIK = 'clkFiltreAcik';
        var kaydir = function () { return col.querySelector('.p-g-b-c-wrapper'); };
        col.addEventListener('click', function (e) {
            if (!mobil() || !col.classList.contains('active')) return;
            if (e.target.closest && e.target.closest('.lag-checkbox, .category-price-inputs button')) {
                try { sessionStorage.setItem(ACIK, JSON.stringify({ t: Date.now(), y: kaydir() ? kaydir().scrollTop : 0 })); } catch (x) {}
            }
        }, true);
        try {
            var ac = JSON.parse(sessionStorage.getItem(ACIK) || 'null');
            sessionStorage.removeItem(ACIK);
            if (ac && Date.now() - ac.t < 30000 && mobil()) {
                col.classList.add('active', 'clk-f-anisiz');
                document.body.classList.add('hidden-scroll', 'clk-f-acik');
                setTimeout(function () { if (kaydir()) kaydir().scrollTop = ac.y || 0; }, 0);
            }
        } catch (x) {}
        // arka plana dokununca kapat
        document.addEventListener('click', function (e) {
            if (!document.body.classList.contains('clk-f-acik')) return;
            if (col.contains(e.target) || (e.target.closest && e.target.closest('.mobile-filter-btn'))) return;
            col.classList.remove('active'); document.body.classList.remove('hidden-scroll', 'clk-f-acik');
        });
        ciz();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla); else basla();
})();
