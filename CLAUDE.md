# CLK Yönetim — proje notları

CLK Çanta'nın yönetim paneli: Qukasoft e-ticaret altyapısındaki ürünleri (clkcanta.com) ekleme ve düzenleme, sipariş, stok, müşteri ve cari görüntüleme. Kullanıcı Türkçe konuşur; arayüz metinleri, commit mesajları ve açıklamalar Türkçe.

## Çalışma kuralları

- **Her kod değişikliğinden sonra kullanıcıya sormadan** değişen dosyaları ekle, ne değiştiğini anlatan kısa Türkçe bir mesajla commit et ve `git push origin main` ile gönder. Kullanıcı bunu açıkça istedi (24.10.2026). Gönderim başarısız olursa hatayı olduğu gibi bildir; `--force` kullanma.
- Netlify `main`'e her gönderimde siteyi kendisi yayınlar (otomatik yayın açık, ~15–20 sn). Elle yayın yalnızca Netlify'a yeni ortam değişkeni eklenince gerekir.
- Büyük değişikliklerde göndermeden önce söz dizimini kontrol et: geçici `kontrol` dalına gönder, dosyayı `raw.githubusercontent.com/<sha>/...` adresinden alıp tarayıcıda `new Function(kaynak)` ile ayrıştır, sonra `main`'e gönderip geçici dalı sil.
- Kredi harcayan denemeleri (manken üretimi vb.) en aza indir; kullanıcı bu konuda hassas. Önce sahte (mock) `fetch` ile ücretsiz doğrula, gerçek denemeyi tek seferde yap.
- Gerçek Qukasoft kaydı denemeleri yalnızca **TEST ÜRÜN – SİLİNECEK** (kod `CLK-6AF8A8CCF01B`, id 463, pasif) ürününde yapılır; başka ürünlere dokunma.
- Gizli anahtarlar Netlify ortam değişkenlerindedir; asla koda, commit'e ya da sohbete yazma. Kart/anahtar girişini kullanıcı yapar.
- Windows'ta Git PATH'te görünmezse: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`

## Yapı

- Statik site, derleme yok: `index.html`, `app.css`, `core.js` (çekirdek, `CLK` nesnesi, yönlendirme, veri yükleme), `views-main.js`, `views-crm.js`, `editor.js` (ürün ekleme/düzenleme formu ve görsel işlemleri), `_headers` (no-cache).
- Yayın: Netlify sitesi **celikcanta** → https://celikcanta.netlify.app, GitHub `celksamet34-web/clk-yonetim` deposundan.
- Oturum: Supabase (proje `prkzzaqinfeptmmbkqsd`), yalnızca yayınlanabilir anahtar kodda.
- Ürün listeleme/kaydetme/kategori çağrıları (`qukasoft-product-list`, `qukasoft-product-save`, `qukasoft-category-list`, `clk-data`) Supabase edge fonksiyonları üzerinden diğer Netlify sitesi **clkcanta**'daki fonksiyonlara gider (o sitenin kodu bu depoda değil; dokunma).
- Bu depodaki Netlify fonksiyonları (`netlify/functions/`):
  - `ai-product-image.js`: dekupe (Photoroom, yedek OpenAI), manken görseli (fal.ai Seedream 4.5 kuyrukla, yedek Gemini/OpenAI), ürün açıklaması yazma (`action: 'describe'`, OpenAI metin modeli).
  - `qukasoft.js`: Qukasoft ek işlemleri için izin listeli köprü (benzer ürün, kombin, uyumluluk, birim listesi, kombin listesi). İstekler panelde sıraya alınır; Qukasoft aynı anda gelen istekleri reddedebiliyor.
- celikcanta ortam değişkenleri (adlar): `OPENAI_API_KEY`, `FAL_KEY`, `PHOTOROOM_API_KEY`, `QUKASOFT_API_KEY`, `QUKASOFT_API_SECRET`; isteğe bağlı `GEMINI_API_KEY` (faturalandırma kapalı, kullanılmıyor), `FAL_IMAGE_MODEL`, `OPENAI_TEXT_MODEL`.

## Ürün formu (editor.js)

- Tüm ürün görselleri 1200×1600 (3:4) üretilir (`portrait()`, `PW`/`PH`): clkcanta.com teması görselleri 3:4 gösterir, kare görsele Qukasoft alt ve üste boş bant ekliyor (doğrulandı 25.10.2026). Manken çıktısı kare gelir, yanlardan kırpılır; çanta konumu (`pasteBag.last`, `trimBorder.last` → `modelImage.focus`) kadrajda tutulur.
- Fotoğraf kutuları (`SLOTS`): Ön, Manken, Arka, Yan, Detay, İç, Ek, Ölçü. Qukasoft yalnızca görsel sırasını tutar; ürün açılınca görseller sırayla kutulara dağılır, köşeleri düz gri (ya da eski görsellerde koyu) olan görsel Ölçü kutusuna taşınır.
- Dekupe: Photoroom (ürün piksellerine dokunmaz).
- Manken: kullanıcı beğendiği yöntemi seçti — Seedream'e ürün fotoğrafı + ölçek rehberi (çanta 0.6 oranında küçültülmüş, baştan uyluk ortasına kadraj) birlikte gider; çerçeve oluşursa panel kırpar. "Elde (yakın çekim)" seçilince manken yerine el çekimi, ölçek el boyuna göre. Çok adımlı ölçülü yöntem denendi ve kaldırıldı.
- Ölçü görseli: kodla çizilir (gri zemin, köşeler düz `SIZE_GRAY` = 122; beyaz oklar ve yazılar), "Su geçirmez" seçiliyse rozet; yapay zekâ ve kredi yok.
- Açıklama: "Yapay zekâ ile yaz" (yalnızca verilen bilgiler, övgü sıfatı yok) ya da "Şablonla yaz"; Qukasoft'a HTML (p, h3, ul, li, strong) gider, panelde güvenli önizleme var.

## Qukasoft API notları (web servis dokümanı v2.3.1)

- Taban: `https://www.clkcanta.com/api/v2/`, başlıklar `apikey` ve `apisecret`. `product/save` kod varsa günceller; tek istekte en çok 5 ürün.
- Ölçüler nitelik olarak tutulur: **En**, **Yükseklik**, **Boy** (= derinlik). Malzeme ve Su Geçirmez de nitelik; Qukasoft tanımsız niteliği ürün kaydında kendisi oluşturur (doğrulandı).
- Formda olan ve doğrulanan alanlar: invoiceName, modelCode, mpn, brand + brandId, dealerPrice1–4, criticalStockQuantity, domestic, showcaseStatus, seq, specialCode1–3, seoTitle/Description/Keywords, slug, unitId, videoText, attributes, variants, images, groups.
- `groups`: `[{ code, name: grup adı, label: seçenek adı }]` (bu ürün dahil tüm üyeler); API geri okumaz, Qukasoft panelinde görünür (doğrulandı).
- Ayrı uç noktalar: `product/updateSimilars` (geri okunamaz), `product/updateCombines` + `product/combines` (okunur), `product/updateCompabilities` (mağazada uyumluluk tanımı yok), `unit/lists`.
- API'de olmayan alanlar (yalnızca Qukasoft panelinden): pazaryeri ürün yasakla, XML/muhasebe fiyat sabitle, depo yer kodu, GTİP, menşei, ek doküman, ziyaretçi/üye/bayi görünürlüğü, müşteri grupları, kargolanma süresi, markalara özel kodlar. Ürün etiketleri (`labelIds`) için etiket listesi uç noktası yok.
