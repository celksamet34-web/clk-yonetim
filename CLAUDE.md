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

- Statik site, derleme yok: `index.html`, `app.css`, `core.js` (çekirdek, `CLK` nesnesi, yönlendirme, veri yükleme), `views-main.js`, `views-crm.js`, `editor.js` (ürün ekleme/düzenleme formu ve görsel işlemleri), `views-banner.js` (Banner stüdyosu), `_headers` (no-cache).
- Yayın: Netlify sitesi **celikcanta** → https://celikcanta.netlify.app, GitHub `celksamet34-web/clk-yonetim` deposundan.
- Oturum: Supabase (proje `prkzzaqinfeptmmbkqsd`), yalnızca yayınlanabilir anahtar kodda.
- Ürün listeleme/kaydetme/kategori çağrıları (`qukasoft-product-list`, `qukasoft-product-save`, `qukasoft-category-list`, `clk-data`) Supabase edge fonksiyonları üzerinden diğer Netlify sitesi **clkcanta**'daki fonksiyonlara gider (o sitenin kodu bu depoda değil; dokunma).
- Bu depodaki Netlify fonksiyonları (`netlify/functions/`):
  - `ai-product-image.js`: dekupe (Photoroom, yedek OpenAI), manken görseli (fal.ai Seedream 4.5 kuyrukla, yedek Gemini/OpenAI), ürün açıklaması yazma (`action: 'describe'`, OpenAI metin modeli).
  - `qukasoft.js`: Qukasoft ek işlemleri için izin listeli köprü (benzer ürün, kombin, uyumluluk, birim listesi, kombin listesi). İstekler panelde sıraya alınır; Qukasoft aynı anda gelen istekleri reddedebiliyor.
- celikcanta ortam değişkenleri (adlar): `OPENAI_API_KEY`, `FAL_KEY`, `PHOTOROOM_API_KEY`, `QUKASOFT_API_KEY`, `QUKASOFT_API_SECRET`; isteğe bağlı `GEMINI_API_KEY` (faturalandırma kapalı, kullanılmıyor), `FAL_IMAGE_MODEL`, `OPENAI_TEXT_MODEL`.

## Ürün formu (editor.js)

- Tüm ürün görselleri 1200×1600 (3:4) üretilir (`portrait()`, `PW`/`PH`): clkcanta.com teması görselleri 3:4 gösterir, kare görsele Qukasoft alt ve üste boş bant ekliyor (doğrulandı 25.10.2026). Manken çıktısı kare gelir, yanlardan kırpılır; çanta konumu (`pasteBag.last`, `trimBorder.last` → `modelImage.focus`) kadrajda tutulur.
- Fotoğraf kutuları (`SLOTS`): Ön, Manken, Arka, Yan, Detay, İç, Ek. Qukasoft yalnızca görsel sırasını tutar; ürün açılınca görseller sırayla kutulara dağılır.
- Dekupe: Photoroom (ürün piksellerine dokunmaz).
- Vitrin (celik 31.10.2026: 1. fotoğraf her zaman vitrin fotoğrafı, hepsi aynı dursun): ön fotoğraf dekupeden sonra `vitrin()` ile hazırlanır. Ürün beyaz zeminde bulunur (en küçük kanal <236, sağ alttaki eski filigran sayılmaz), ışık/doygunluk/keskinlik hafifçe ayarlanır (ürün yeniden çizilmez), 3:4 karede en çok %84 genişlik ve %76 yükseklikle ortalanır (dikey merkez %47), altına radyal gölge konur. Zemin beyaz değilse `portrait()`. Ön kutudaki "Vitrin" düğmesi kayıtlı görseli dekupesiz (ücretsiz) yeniden hazırlar.
- Manken: kullanıcı beğendiği yöntemi seçti — mankenler açık tenli (31.10.2026); Seedream'e ürün fotoğrafı + ölçek rehberi (çanta 0.6 oranında küçültülmüş, baştan uyluk ortasına kadraj) birlikte gider; çerçeve oluşursa panel kırpar. "Elde" seçilince orta mesafe çekim (celik isteği 31.10.2026, ne uzak ne yakın): kadraj göğüsten baldır ortasına (boyun %50'si), çanta sarkan elde uyluk yanında, rehberde gövdesinin üstü boyun %40'ı hizasında ve biraz sağda; eski yakın çekim el istemi kaldırıldı. Çok adımlı ölçülü yöntem denendi ve kaldırıldı. "Sırt" seçilince manken arkadan çekilir (logo kameraya bakar; önden istemde çanta göğse geliyordu), rehberde çanta daha yukarıda (0.45).
- Ölçü görseli kullanıcı isteğiyle tamamen kaldırıldı (25.10.2026; birkaç tasarım denendi, beğenilmedi). Daha önce yüklenmiş ölçü görselleri ürün açılınca `dropSizeShots` ile listeden çıkarılır, kaydedince Qukasoft'tan da kalkar. Tanıma yalnızca panelin çizdiği zeminlere bakar: üç köşe renksiz gri 107–137 ya da koyu 8–34.
- Açıklama: "Yapay zekâ ile yaz" (yalnızca verilen bilgiler, övgü sıfatı yok) ya da "Şablonla yaz"; Qukasoft'a HTML (p, h3, ul, li, strong) gider, panelde güvenli önizleme var.

## Görsel stüdyosu (views-banner.js, sayfa #banner)

- Biçimler (`FORMATS` / sunucuda `BANNER_FORMATS`): Anasayfa banner 1248×1664, Slider masaüstü 1920×850 (ürün sağda, sol yazıya), Slider mobil 1080×1440, Kategori kutusu 800×1000 (krem stüdyo, yuvarlak fon). Onaylananlar `localStorage` `clk-banner-approvals` listesinde.
- Qukasoft panelinde: Tasarım › Bannerlar (`/admin/store/banners`, grup 3 = anasayfa 2'li banner), Manşetler (`/admin/store/headlines`, slider; form alanları baslik, link, button_title, aciklama, buyuk_resim, mobile_image), Blok Yönetimi (`/admin/store/modules`: Manşet #4319 1920×850; Öne Çıkan Kategoriler #4317 T52 — demo kategori numaraları 380–391 kalmıştı; Yeni Ürünler #4315; En Çok Satanlar #4316). Kategori görseli: Kataloglar › Kategoriler formunda `resim`. Marka logosu: Kataloglar › Markalar `resim` (25.10.2026'da hiçbirinde logo yok).
- **Ürün modele çizdirilmez.** Seedream ürünü yeniden çizince logoyu değiştiriyor (DADA → DACA, YEFA → VIP), tek çantaya indiriyor ya da açısını bozuyordu (25.10.2026). Şimdi `mode: 'scene'` ile model yalnızca sahneyi üretir (ürün yerinde boş yüzey), panel `composeProduct` ile ürün fotoğrafını tuvaldeki yerine birebir koyar (kenardan dolgu ile kesme, temas gölgesi). Modelin çizdiği ürünü bulup düzeltme (eşleştirme) denendi, açı değişince işe yaramadı.
- Parla teması manşet (slider) yazılarını **kutusuz, düz beyaz** yazar: masaüstünde solda dikey ortada, **mobilde görselin tam ortasında** (doğrulandı 25.10.2026). Açık zeminli sahnede yazı okunmuyor, mobilde ortadaki ürünün üstüne biniyor. Manşet görsellerinde yazı tarafı koyulaştırılmalı, mobilde ürün ortada olmamalı.
- Anasayfada 3 manşet yayında (DADA → /dada-sirt, valiz → /valizler, evrak → /evrak-cantalari).
- Qukasoft'a görsel yüklerken dosya seçme penceresi kullanılamaz: banner'da sayfanın `lagBannerUploadSingleFile(file)` fonksiyonu, form dosya alanlarında `DataTransfer` ile dosya verilir. Kaydet'e öğe referansıyla basılır, ardından "Başarılı" uyarısı ve sitede HTML kontrol edilir (ilk koordinatla tıklama kaydetmeden kapatmıştı).

## Banner stüdyosu (eski not)

- Kullanıcı anasayfa banner ve manşetlerini Claude'un yönetmesini istedi (25.10.2026). Kural: **her görsel önce kullanıcıya gösterilir, onaysız yayına çıkmaz.**
- Anasayfa (clkcanta.com) banner'ları 3:4 (1248×1664). Qukasoft başlık, alt yazı ve düğmeyi görselin alt kısmına siyah kutularla kendisi yazar; panel önizlemesi bunu taklit eder.
- Görsel: `ai-product-image` `action: 'banner'` → Photoroom `v2/edit` AI arka plan (Plus planı, ~0,10 $/görsel). AI arka planda padding/hizalama yok sayılıyor (sandbox'ta denendi); panel ürünü 1248×1664 beyaz tuvalde üste yerleştirir (`placeBag`, genişlik ≤%62, alt kenar %68), `referenceBox=originalImage` ürünü yerinde bırakır, alt kısım sahneye kalır. `sandbox: true` anahtara `sandbox_` öneki ekler: ücretsiz, filigranlı; panelde düğmesi yok, `CLK.bannerTest()` ile çağrılır.
- Photoroom planının görsel hakkı bitti (25.10.2026, 402; dekupe de etkilenir). Banner'da varsayılan motor fal.ai Seedream (`engine: 'fal'`, ~0,04 $): aynı yerleştirilmiş girdi düzenlenir (`bannerEditPrompt`: ürün yerinde ve aynen, yalnızca beyaz zemin sahne olur), 1728×2304 istenir, panel 1248×1664'e küçültür; kuyruk `falResult` ile sorulur.
- Qukasoft API'sinde banner uç noktası yok (API notlarında geçmiyor). Onaylanan banner'ı kullanıcı Qukasoft yönetim paneline giriş yaptıktan sonra Claude tarayıcıdan yükler; kaydetmeden önce sorar. Onaylanan görsel Supabase'e kaydedilir (`banner-*.jpg`, 7 günlük bağlantı, `localStorage` `clk-banner-approved`).

## Qukasoft API notları (web servis dokümanı v2.3.1)

- Taban: `https://www.clkcanta.com/api/v2/`, başlıklar `apikey` ve `apisecret`. `product/save` kod varsa günceller; tek istekte en çok 5 ürün.
- Ölçüler nitelik olarak tutulur: **En**, **Yükseklik**, **Boy** (= derinlik). Malzeme ve Su Geçirmez de nitelik; Qukasoft tanımsız niteliği ürün kaydında kendisi oluşturur (doğrulandı).
- Formda olan ve doğrulanan alanlar: invoiceName, modelCode, mpn, brand + brandId, dealerPrice1–4, criticalStockQuantity, domestic, showcaseStatus, seq, specialCode1–3, seoTitle/Description/Keywords, slug, unitId, videoText, attributes, variants, images, groups.
- `groups`: `[{ code, name: grup adı, label: seçenek adı }]` (bu ürün dahil tüm üyeler); API geri okumaz, Qukasoft panelinde görünür (doğrulandı).
- Ayrı uç noktalar: `product/updateSimilars` (geri okunamaz), `product/updateCombines` + `product/combines` (okunur), `product/updateCompabilities` (mağazada uyumluluk tanımı yok), `unit/lists`.
- API'de olmayan alanlar (yalnızca Qukasoft panelinden): pazaryeri ürün yasakla, XML/muhasebe fiyat sabitle, depo yer kodu, GTİP, menşei, ek doküman, ziyaretçi/üye/bayi görünürlüğü, müşteri grupları, kargolanma süresi, markalara özel kodlar. Ürün etiketleri (`labelIds`) için etiket listesi uç noktası yok.
