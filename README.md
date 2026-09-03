# Sıvı Cam — Ekran Uzayında Kırılma · WebGL2'ye Karşı CSS

"Bulanıklık Kırılma Değildir: WebGL2'de Sıvı Cam, IOR ve Kromatik Dispersiyon"
makalesinin çalışan kodu. Ham WebGL2 (GLSL ES 3.00), TypeScript, Vite, vitest.
Three.js yok, post-processing kütüphanesi yok; her satırın matematiği elle
yazılı.

Aynı sıvı cam paneli iki kez kuruluyor:

- **WebGL yolu** — arka plan bir FBO'ya çiziliyor, panel o dokuyu `refract()` ile
  bükerek örnekliyor. IOR gerçek bir malzeme sabiti, dispersiyon kanal başına
  ayrı `eta`, kenar parlaması Schlick–Fresnel.
- **CSS yolu** — aynı canvas'ın üzerine mutlak konumlu bir `<div>`,
  `backdrop-filter: blur(2px) url(#liquid-glass)` ve çalışma anında üretilen bir
  SVG `feDisplacementMap` haritası.

Arka plan **her iki modda da** aynı WebGL canvas'ında çiziliyor; değişen tek şey
panelin nasıl kurulduğu. Kıyas bu yüzden adil.

## Ne içerir

- **İki geçişli kare akışı** (`src/fbo.ts`, `src/renderer.ts`) — arka plan bir
  kez FBO'ya çiziliyor, `blitFramebuffer` ile ekrana kopyalanıyor, camın
  okuyacağı kopya istenirse ayrı bir ölçekte tutuluyor. `CLAMP_TO_EDGE` şart:
  kırılan örnek doku dışına taşıyor.
- **Cam shader'ı** (`src/shaders/glass.frag.glsl`) — 2B `sdRoundedBox`, çeyrek
  daire kesitli pah profili, gradyandan normal, `refract()` tabanlı ekran uzayı
  kayması, spektrum taramalı dispersiyon, Schlick–Fresnel, üç görüntü modu
  (cam / normal / saçak).
- **Panelin kendi quad'ı** (`src/shaders/panel.vert.glsl`) — attribute yok, dört
  köşe `gl_VertexID`'den. Fragment maliyeti ekranın değil **panelin** alanıyla
  orantılı.
- **CSS ikizi** (`src/displacement-map.ts`, `src/css-glass.ts`) — displacement
  haritası shader'la **aynı** `sdRoundedBox` / `glassNormal` fonksiyonlarının
  TypeScript ikizlerinden üretiliyor, PNG data URL olarak `feImage`'a bağlanıyor.
- **GPU saati** (`src/gpu-timer.ts`) — `EXT_disjoint_timer_query_webgl2`; sorgu
  kuyruğu, `GPU_DISJOINT_EXT` kontrolü, `gl.finish()` YOK. Uzantı yoksa HUD ve
  ölçüm çıktısı bunu açıkça söyler ve rAF delta medyanına düşer.
- **Saf mantık katmanı** (`src/optics.ts`, `src/sdf2d.ts`, `src/stats.ts`,
  `src/viewport.ts`, `src/vram.ts`, `src/coverage.ts`, `src/fringe.ts`) —
  GLSL'in TypeScript aynası; tarayıcısız, vitest ile test ediliyor.

## Kurulum

```bash
npm install
```

## Test (tarayıcısız, deterministik)

```bash
npm test
```

**84 test yeşil** (10 dosya): optik (15), 2B SDF ve normal (12), viewport
kelepçeleri (9), medyan/yüzdelik (8), kare istatistiği + ölçüm modu (9), shader
kaynağı (7), kapsama (7), displacement haritası (6), saçak kod çözme (6), VRAM
hesabı (5). Hiçbir test dosyası `document`, `window`, `navigator`,
`WebGL2RenderingContext` ya da `performance` referansı içermez.

## Tip kontrolü ve build

```bash
npx tsc --noEmit   # 0 hata
npm run build      # tsc && vite build -> dist/
```

GLSL derlenmez; shader'ın gerçekten derlendiğini yalnızca tarayıcı gösterir.

## Demo (`file://` DEĞİL)

```bash
npm run dev
# http://localhost:5173/
```

Varsayılan ayarlar mütevazı: sahne 960×540 CSS (tam ekran değil), çözünürlük
ölçeği 0.75, dispersiyon 3 örnek, arka plan doku ölçeği 1.0.

| Kontrol                 | Değerler                                        | Varsayılan |
| ----------------------- | ----------------------------------------------- | ---------- |
| Yol                     | panel yok / WebGL / CSS blur / displace / RGB   | WebGL      |
| Görüntü modu            | cam / normal / saçak                            | cam        |
| IOR                     | 1.0 – 2.5                                       | 1.52       |
| Yayılım (`spread`)      | 0 – 0.4                                         | 0.15       |
| Dispersiyon örneği      | 1 / 3 / 8                                       | 3          |
| Pah genişliği           | 4 – 80 px                                       | 34         |
| Kalınlık                | 1 – 20                                          | 6          |
| Kırılma derinliği       | 0 – 220 px                                      | 90         |
| Arka plan doku ölçeği   | 1.00 / 0.50 / 0.25                              | 1.00       |
| Çözünürlük ölçeği       | 0.5 / 0.75 / 1.0                                | 0.75       |
| Dur/Devam               | —                                               | çalışıyor  |

Ne göreceksiniz:

- **WebGL yolu:** panelin ortasındaki desen kıpırdamıyor (normal `(0,0,1)`,
  kırılma sıfır), kenara doğru kayma artıyor. Kenarda Fresnel parlaması var.
- **`normal` modu:** pahın nerede başlayıp bittiği renk olarak görünüyor;
  plato düz mavi (`(0,0,1)`), pah yana yatıyor.
- **`saçak` modu:** arka plan çizilmiyor, panel dışı siyah; pah bölgesi kırmızıya
  doğru artıyor. Kırmızı kanal kanallar arası ayrımı `32 px` tavanla kodluyor.
- **Yayılımı büyütünce** kenarda turuncu/mavi saçak; örnek sayısını 3'ten 8'e
  çıkarınca saçak yumuşuyor.
- **IOR = 1.0** yapınca kayma tamamen kayboluyor: kırılma yok, düz cam.
- **CSS yolları:** panel aynı yerde, aynı boyutta. `css-rgb`'de kenarda kanal
  ayrımı görünüyor.

### Isıtma korkulukları

`devicePixelRatio` 2'ye kelepçeli (`src/viewport.ts`), çözünürlük ölçeği
kullanıcıda, toplam arka tampon 2.1 Mpx ile sınırlı. Sekme arka plana geçince
döngü kendiliğinden duruyor; `Dur` düğmesi `requestAnimationFrame`'i gerçekten
iptal ediyor (kısmak değil, durdurmak).

## İki yolun ayarları nasıl eşitlendi

`feDisplacementMap`'in `scale`'i piksel cinsinden bir sayı; WebGL tarafındaki
`uDepth = 90` + `thickness = 6` ise fizikten geliyor. İkisi farklı birimlerde,
o yüzden sayısal olarak eşitlendi: pahın düz kısmında (panel merkezinden 180–208
px) `refractOffsetPx` ile CSS kaymasının oranı **62** çıkıyor. Filtredeki
`scale="62"` bu hesabın sonucu, göz kararı değil.

Aynı hesap dispersiyon için: `spread = 0.15`'te kırmızı ve mavi uçların kayması
merkezden ±%9 sapıyor, dolayısıyla üç dallı filtrede
`scale="56" / "62" / "68"`.

Haritanın kendisi normal haritası **değil**, doğrudan kayma haritası: kırılma
örneği normalin ters yönüne taşıdığı için iki kanal da eksili kodlanıyor
(`-n.x`, `-n.y`), koordinatlar da SVG'nin y-aşağı çerçevesinde hesaplanıyor.
İşaretlerden birini kaçırırsanız CSS paneli WebGL panelinin tam tersine büker ve
kıyas sessizce anlamsızlaşır.

## Deterministik ölçüm modu

```
http://localhost:5173/?measure=1
```

Bu modda demo interaktif olmaktan çıkar: arka tampon 960×540'a kilitlenir,
zaman adımı `frame / 60` sabitlenir, etkileşim kapanır. Her yapılandırma için
30 ısınma + 180 ölçüm karesi. Toplam 13 koşu, 2376 kare: 120 Hz'lik bir ekranda
~20 saniye, 60 Hz'de ~40. Bitince konsola **tek satır** düşer.

Aşağıdaki satır uydurulmuş bir biçim örneği değil, gerçek bir koşudan (headless
Chrome, Apple M2 Pro/ANGLE Metal, 960×540). `frameMsP95` dahil her alan burada
ham hâliyle duruyor. Makaledeki tablolar bunun gibi üç koşudan derlendi; son
hanelerde koşudan koşuya küçük oynamalar olur:

```
MEASURE {"version":1,"userAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36","dpr":1,"backing":{"w":960,"h":540},"vsyncMs":8.3,"timerExt":true,"cssFilterUrlSyntaxSupported":true,"panel":{"w":420,"h":260,"radius":40,"coveragePct":20.8},"dispersion":[{"samples":1,"texelFetches":1,"gpuMsMedian":0.131,"frameMsMedian":8.3,"vsyncBound":true},{"samples":3,"texelFetches":3,"gpuMsMedian":0.1635,"frameMsMedian":8.3,"vsyncBound":true},{"samples":8,"texelFetches":8,"gpuMsMedian":0.217,"frameMsMedian":8.3,"vsyncBound":true}],"msPerSample":0.01229,"msPerSampleMethod":"gpu","backdropScale":[{"scale":1,"gpuMsMedian":0.1642,"frameMsMedian":8.3,"vsyncBound":true,"vramBytes":2073600},{"scale":0.5,"gpuMsMedian":0.195,"frameMsMedian":8.3,"vsyncBound":true,"vramBytes":2592000},{"scale":0.25,"gpuMsMedian":0.201,"frameMsMedian":8.3,"vsyncBound":true,"vramBytes":2203200}],"fringe":[{"spread":0.00805,"maxSeparationPx":0.251},{"spread":0.15,"maxSeparationPx":5.5216}],"fringeQuantizationPx":0.1255,"paths":[{"label":"baseline","frameMsMedian":8.3,"frameMsP95":9.005,"droppedFrames":0,"gpuMsMedian":0.1085,"vsyncBound":true},{"label":"webgl-glass","frameMsMedian":8.3,"frameMsP95":9,"droppedFrames":0,"gpuMsMedian":0.1601,"vsyncBound":true},{"label":"css-blur","frameMsMedian":8.3,"frameMsP95":9.005,"droppedFrames":0,"gpuMsMedian":null,"vsyncBound":true,"gpuMsNote":"compositor — ölçülemez"},{"label":"css-displace","frameMsMedian":8.3,"frameMsP95":9.005,"droppedFrames":0,"gpuMsMedian":null,"vsyncBound":true,"gpuMsNote":"compositor — ölçülemez"},{"label":"css-rgb","frameMsMedian":8.3,"frameMsP95":9,"droppedFrames":0,"gpuMsMedian":null,"vsyncBound":true,"gpuMsNote":"compositor — ölçülemez"}]}
```

| Faz | Ne ölçülüyor                                                          |
| --- | --------------------------------------------------------------------- |
| A   | dispersiyon örneği 1 / 3 / 8 → GPU ms, kare ms, örnek başına ek maliyet |
| B   | arka plan doku ölçeği 1.0 / 0.5 / 0.25 → GPU ms, kare ms, VRAM         |
| C   | saçak: `spread` 0.00805 (fiziksel) ve 0.15 → `readPixels` ile max ayrım |
| D   | beş yol: baseline / webgl-glass / css-blur / css-displace / css-rgb     |

Sözleşmeler:

- **CSS satırlarında `gpuMsMedian` her zaman `null`** ve yanında
  `gpuMsNote: "compositor — ölçülemez"` yazar. `backdrop-filter` bizim çizim
  komutumuz değil; ona saat sokamıyoruz. Oraya sayı yazmak ölçmemekten kötüdür.
- **`timerExt: false`** gelirse bütün `gpuMs*` alanları `null` kalır ve
  `msPerSample` rAF delta'sından hesaplanır; `msPerSampleMethod: "frame"` bunu
  açıkça söyler.
- **Vsync tavanı 60 Hz varsayılmıyor.** Koşunun başında boş bir rAF penceresiyle
  ekranın gerçek kare periyodu ölçülüyor (`vsyncMs`), her satırın `vsyncBound`
  bayrağı ona göre işaretleniyor. 120 Hz'lik bir ekranda tavan 8,3 ms;
  sabit 16,7 ms eşiği bütün satırları yanlışlıkla "takılı değil" sayardı.
- **Sekme öne alınmalı.** `document.visibilityState !== "visible"` olursa koşu
  iptal edilir ve `MEASURE {"error":"hidden"}` basılır.
- Saçak kuantizasyonu `32 / 255 ≈ 0,125 px`; JSON'da `fringeQuantizationPx`
  olarak yazılıdır. Fiziksel yayılımın ölçümü bu adımın hemen üstünde çıkıyor —
  alet kaba ve öyle olduğu söyleniyor.

Sayılar makineye özeldir. Yazıdaki tablo tek bir makinenin hikâyesi.

## Dosya düzeni

```
index.html                     sahne + CSS panel + SVG filtre tanımları + kontroller
src/
  main.ts                      bootstrap, kontroller, döngü, ?measure=1 dalı
  renderer.ts                  WebGL2 kurulumu, FBO akışı, panel çizimi
  measure.ts                   deterministik koşu listesi, MEASURE {json}
  hud.ts                       FPS / kare ms / GPU ms / kapsama / VRAM
  gpu-timer.ts                 EXT_disjoint_timer_query_webgl2 sarmalayıcı
  gl.ts                        derleme/link + satır numaralı hata çıktısı
  fbo.ts                       RGBA8 render target + CLAMP_TO_EDGE
  optics.ts                    refract / IOR / Abbe / Schlick — GLSL'in ikizi
  sdf2d.ts                     sdRoundedBox / glassHeight / glassNormal ikizi
  displacement-map.ts          SVG feDisplacementMap haritası (saf üretim)
  css-glass.ts                 filtre bağlama + backdrop-filter modu + destek testi
  fringe.ts                    saçak kod çözme (R kanalı -> piksel)
  coverage.ts                  yuvarlatılmış dikdörtgen alanı, kapsama yüzdesi
  vram.ts                      arka plan hedeflerinin bayt hesabı
  viewport.ts                  dpr kelepçesi, ölçek, piksel bütçesi
  stats.ts                     medyan + yüzdelik
  style.css                    sahne, .glass kuralı, HUD, kontroller
  shaders/
    glass.frag.glsl            camın tamamı (SDF + refract + dispersiyon + Fresnel)
    panel.vert.glsl            gl_VertexID'den panel quad'ı
    backdrop.frag.glsl         keskin kenarlı arka plan deseni
    blit.vert.glsl             gl_VertexID'den tam ekran üçgeni
test/                          10 dosya, 84 test (tarayıcısız)
```

## Lisans

MIT — bkz. `LICENSE`.
