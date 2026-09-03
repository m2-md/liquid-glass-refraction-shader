# Bulanıklık Kırılma Değildir: WebGL2'de Sıvı Cam, IOR ve Kromatik Dispersiyon

*Aynı sıvı cam panelini iki kez kurduk. Bir kez CSS `backdrop-filter` + SVG `feDisplacementMap` ile, bir kez arka planı FBO'ya alıp `refract()` ile büken bir WebGL2 shader'ıyla. Gerçek IOR, kanal kanal ayrılan dispersiyon, Fresnel kenarı ve iki yolun tarayıcıda ölçülmüş faturası.*

*Tahmini okuma süresi: 18 dakika*

---

Masamda cam bir kağıt ağırlığı duruyor. Onu telefonun ekranına koyup fotoğrafını çektim.

Camın altındaki yazı kaybolmamıştı. Yerinden oynamıştı. Harfler camın kenarına doğru kayıyor, ortada neredeyse hiç kıpırdamıyor, kenara yaklaştıkça bir yay çizip dışarı fırlıyordu. Camın tam sınırında ise "u" harfinin dikey çizgisi ikiye ayrılmıştı: solunda ince bir turuncu, sağında ince bir mavi çizgi.

Sonra aynı yazının üstüne CSS ile bir panel koydum. `backdrop-filter: blur(8px)`, yuvarlak köşe, hafif beyaz kenar. Ekran görüntüsünde ikisi uzaktan benziyor. Yakından baktığınızda ilkinde harfler *taşınmış*, ikincisinde harfler *karışmış*.

Yazı boyunca bu ayrımın peşinde olacağız. Bulanıklık komşu pikselleri birbirine karıştırır; bir ortalama alır ve bilgiyi geri dönülmez şekilde harcar. Kırılma hiçbir şeyi karıştırmaz; pikseli alır, başka bir adrese taşır. Bir bulanıklık filtresi harmanlayıcıdır, bir cam ise kurye.

Apple'ın OS 26 ile getirdiği "Liquid Glass" dili web tarafında hızla taklit edilmeye başlandı ve taklidin standart tarifi `backdrop-filter` ile SVG `feDisplacementMap`'i üst üste koymak. Tarif çalışıyor da. Bir yere kadar.

> Bu tekniğin ayrıntılı dökümü ve sınırları için iki birincil kaynak: [kube.io — Liquid Glass with CSS and SVG](https://kube.io/blog/liquid-glass-css-svg/) ve [CSS-Tricks — Getting Clarity on Apple's Liquid Glass](https://css-tricks.com/getting-clarity-on-apples-liquid-glass/). İkisinin de altını çizdiği nokta aynı: `backdrop-filter` içinde SVG filtre referansı yalnızca Chromium'da güvenilir çalışıyor, Safari bulanık glassmorphism'e düşüyor.

Yol haritası şöyle. Önce arka planı bir framebuffer'a alacağız; camın arkasını görebilmesi için arkasının bir doku olması gerekiyor. Panelin şeklini 2B bir mesafe fonksiyonundan türetip normalini oradan üreteceğiz. `refract()`'in içindeki üç satırlık Snell yasasını açıp `eta` parametresini IOR'a bağlayacağız. Kırılmayı kanal kanal ayırınca kromatik dispersiyon çıkıyor; onun fizikte ne kadar küçük, ekranda ne kadar abartılı olduğunu ölçeceğiz. Fresnel kenarı da geometriden gelecek. Sonra aynı paneli CSS ile baştan kurup net bir liste çıkaracağız: hangi tarafta ne mümkün, ne değil. Sonda iki yolun ölçüm tablosu var.

Sürüm notu: ham WebGL2 (GLSL ES 3.00), TypeScript, Vite, vitest. Three.js yok, post-processing kütüphanesi yok; her satırın matematiği elle yazılıyor.

Bir de peşinen kabul. `backdrop-filter` üretimdeki arayüzlerin çoğunda hâlâ doğru cevap. Bir satır CSS, GPU'da compositor tarafında koşuyor, kendi kendine erişilebilir, `prefers-reduced-transparency` ile kapatılabiliyor ve arkasındaki DOM ne olursa olsun çalışıyor. Bir nav çubuğu için shader yazmak neredeyse her zaman fazla iş. Bu yazının derdi CSS'i gömmek değil; sınırının tam olarak nerede olduğunu göstermek.

### Bulanıklık Karıştırır, Kırılma Taşır

Zihin modelini baştan kuralım; yazının geri kalanı bu ayrımın üstünde duruyor.

Gauss bulanıklığı her çıktı pikselini komşularının ağırlıklı ortalaması yapar. İki farklı arka plan aynı ortalamayı verebilir, dolayısıyla işlem geri döndürülemez. Bilgi harcanmıştır.

Kırılma bir ortalama almaz. Her çıktı pikseli için "bu ışın gerçekte hangi noktadan geliyor?" sorusunu sorar ve tek bir örnek alır. Kaynak adres değişmiştir, içerik değişmemiştir. Camın altındaki harf hâlâ okunabilir; sadece bulunduğu yer sizi yanıltıyor.

Bunun pratik sonucu şu: kırılmanın gücünü artırdığınızda görüntü bulanıklaşmaz, *bükülür*. Metin okunaklı kalır ama yeri kayar. Bunu ilk gördüğümde hafif bir rahatsızlık duymuştum, çünkü göz "cam" deyince bir miktar buğu bekliyor. Buğu camın kendisinden değil, yüzeyinin pürüzlülüğünden geliyor. Cilalı camda buğu yok.

Kurye mecazını yazı boyunca taşıyacağız. Bir kırılma shader'ı yazmak, her piksel için tek bir soruya cevap vermek demek: bu pikselin paketi hangi adresten alınacak?

### Arka Planı Bir Dokuya Almak

Kuryenin bir adres defteri lazım. Ekranın o an neye benzediğini bilmeden hangi pikseli taşıyacağını bilemez.

WebGL'de bir shader, o an üzerine yazdığı framebuffer'ı okuyamaz. Bu bir kısıt değil, tanımsız davranış: fragment'lar paralel çalışır ve komşunun güncel mi eski mi olduğunu kimse bilmez. O yüzden akış iki adımlı. Arka planı önce ayrı bir hedefe çiziyoruz, sonra o hedefi doku olarak bağlayıp cam panelini ekrana çiziyoruz.

```ts
// src/fbo.ts
export interface RenderTarget {
  readonly framebuffer: WebGLFramebuffer;
  readonly texture: WebGLTexture;
  readonly width: number;
  readonly height: number;
}

export function createRenderTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): RenderTarget {
  const texture = gl.createTexture();
  if (!texture) throw new Error("createTexture başarısız");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // CLAMP_TO_EDGE şart: kırılan örnek dokunun dışına taşarsa kenar rengi gelsin,
  // karşı kenardan sarkan bir görüntü değil.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) throw new Error("createFramebuffer başarısız");
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Framebuffer eksik: 0x${status.toString(16)}`);
  }

  return { framebuffer, texture, width, height };
}
```

`CLAMP_TO_EDGE` burada dekoratif bir seçim değil. Panelin kenarındaki kırılma, örneği doku sınırının dışına taşıyabiliyor. Sarma modu `REPEAT` kalırsa ekranın sol kenarında sağ kenarın görüntüsü belirir; bir kez gördüğünüzde bir daha unutamayacağınız türden bir hata.

Arka planı iki kez çizmiyoruz. Bir kez FBO'ya çiziyoruz, sonra WebGL2'nin `blitFramebuffer` çağrısıyla ekrana kopyalıyoruz. Bu kopya sürücü tarafında yapılıyor, ayrı bir tam ekran quad çizmeye göre daha kısa yol:

```ts
// src/renderer.ts (parça) — kare akışı
  /** Arka planı FBO'ya çizip ekrana ve (gerekiyorsa) örnek hedefine kopyalar. */
  captureBackdrop(time: number): void {
    const { gl, canvas, capture, sample, drawBackdrop } = this;

    gl.bindFramebuffer(gl.FRAMEBUFFER, capture.framebuffer);
    gl.viewport(0, 0, capture.width, capture.height);
    drawBackdrop(time); // arka plan yalnızca BİR kez çiziliyor

    // 1) yakalanan kareyi ekrana kopyala
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, capture.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    // prettier-ignore
    gl.blitFramebuffer(
      0, 0, capture.width, capture.height,
      0, 0, canvas.width, canvas.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    // 2) camın örnekleyeceği kopyayı (istenirse küçülterek) hazırla
    if (sample !== capture) {
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sample.framebuffer);
      // prettier-ignore
      gl.blitFramebuffer(
        0, 0, capture.width, capture.height,
        0, 0, sample.width, sample.height,
        gl.COLOR_BUFFER_BIT,
        gl.LINEAR,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
```

İki ayrı hedef olmasının sebebi ölçüm. Ekranda gördüğünüz arka plan her zaman tam çözünürlükte; camın *okuduğu* kopya ise ayrı bir ölçekte tutulabiliyor. Böylece "arka plan dokusunu yarıya indirince ne kazanıyoruz" sorusunun cevabı, görüntünün tamamını bulandırmadan ölçülebiliyor. Bütçe bölümündeki tablo tam olarak o üç ölçeğin tablosu.

VRAM hesabı doğrudan bu iki hedeften çıkıyor ve bir ölçüm değil, çarpma işlemi:

```ts
// src/vram.ts
export interface BackdropVram {
  capture: number;
  sample: number;
  total: number;
}

/** RGBA8 hedefler: piksel başına 4 bayt. */
export function backdropBytes(
  width: number,
  height: number,
  scale: number,
): BackdropVram {
  const capture = width * height * 4;
  if (scale >= 1) return { capture, sample: 0, total: capture };
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));
  const sample = sw * sh * 4;
  return { capture, sample, total: capture + sample };
}
```

### Camın Şekli: Yuvarlatılmış Kutu ve Bir Pah

Panel bir dikdörtgen değil, kenarları pahlanmış bir cam levha. O pah bu yazının en çok iş yapan parçası: kırılmanın da Fresnel parlamasının da kaynağı orada.

Şekli bir dokudan değil, bir fonksiyondan alıyoruz. 2B signed distance function (işaretli mesafe fonksiyonu) bir noktanın şeklin kenarına uzaklığını veriyor: içeride negatif, dışarıda pozitif.

```glsl
// src/shaders/glass.frag.glsl (parça)
// p: panel merkezine göre piksel koordinatı
// b: yarı boyut (piksel), r: köşe yarıçapı (piksel)
float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
```

Bu mesafeyi bir yükseklik profiline çeviriyoruz. Panelin ortası düz bir plato, kenara doğru inen kısım ise çeyrek daire kesitli bir pah:

```glsl
// d: kenara işaretli mesafe (içeride negatif), w: pah genişliği (piksel)
// Kenarda 0, pahın bittiği yerde 1 döner.
float glassHeight(float d, float w) {
  float x = clamp(-d / max(w, 1e-3), 0.0, 1.0);
  float t = 1.0 - x;
  return sqrt(max(1.0 - t * t, 0.0));
}
```

Normal, bu yükseklik alanının gradyanından geliyor. Merkezi farkla iki eksende birer örnek çifti alıyor, sonucu kalınlıkla ölçekliyoruz:

```glsl
vec3 glassNormal(
  vec2 p, vec2 halfSize, float radius, float bevel, float thickness, float eps
) {
  vec2 e = vec2(eps, 0.0);
  float hx =
      glassHeight(sdRoundedBox(p + e.xy, halfSize, radius), bevel)
    - glassHeight(sdRoundedBox(p - e.xy, halfSize, radius), bevel);
  float hy =
      glassHeight(sdRoundedBox(p + e.yx, halfSize, radius), bevel)
    - glassHeight(sdRoundedBox(p - e.yx, halfSize, radius), bevel);

  float k = thickness / (2.0 * eps);
  return normalize(vec3(-hx * k, -hy * k, 1.0));
}
```

Platoda gradyan sıfır, normal tam olarak `(0, 0, 1)`. Pahın içinde normal yana yatıyor. Kenara doğru profilin analitik eğimi ıraksıyor, ama biz o eğimi sonsuz çözünürlükte okumuyoruz: gradyan `eps = 1` pikselle alınan merkezi farktan geliyor ve bu, normali kendiliğinden sınırlıyor. Ölçtüğümde varsayılan kalınlıkta (6) en dik normal dikeyden 49,5 derece sapıyordu (`n.z = 0,6488`); kalınlığı sonuna, 20'ye çekince 75,7 dereceye çıkıyor. Yataya yaklaşan bir normal hiç çıkmadı. Bu eğim bir hata değil, efektin kendisi: kırılmayı da kenardaki parlamayı da o üretiyor.

`thickness` parametresinin fiziksel bir karşılığı yok, bir tasarım kolu. Büyüttükçe pah dikleşir, kırılma sertleşir. `bevel` ise gerçek bir uzunluk: kaç pikselde platodan kenara indiğiniz. Demoda ikisi de slider'da.

### refract(): Üç Satırlık Snell

GLSL'in `refract` fonksiyonu bir kara kutu değil, spesifikasyonda gövdesi yazılı bir formül. TypeScript ikizi birebir şu:

```ts
// src/optics.ts
export type Vec3 = readonly [number, number, number];

/**
 * GLSL refract(I, N, eta) ile birebir aynı davranış.
 * I: yüzeye gelen birim vektör, N: birim normal, eta: n1 / n2.
 * Tam iç yansımada sıfır vektör döner.
 */
export function refract(i: Vec3, n: Vec3, eta: number): Vec3 {
  const ni = i[0] * n[0] + i[1] * n[1] + i[2] * n[2];
  const k = 1 - eta * eta * (1 - ni * ni);
  if (k < 0) return [0, 0, 0];
  const s = eta * ni + Math.sqrt(k);
  return [eta * i[0] - s * n[0], eta * i[1] - s * n[1], eta * i[2] - s * n[2]];
}
```

`k < 0` dalı Snell yasasının çözümsüz kaldığı bölge: gelen açı kritik açıyı aşmış, ışık camdan çıkamıyor. Fonksiyon o durumda sıfır vektör döndürüyor ve kontrol etmezseniz `normalize(vec3(0))` NaN üretiyor.

Elimizde kırılan yön var; ihtiyacımız olan şey bir piksel kaymasıydı. Kamerayı ortografik varsayıp (panel ekrana paralel, göz sonsuzda) ışını cam kalınlığı boyunca yürütüyoruz:

```glsl
// src/shaders/glass.frag.glsl (parça)
// n: yüzey normali, eta: n1/n2, depth: cam kalınlığı (piksel)
// Dönen değer arka plan dokusunda kaç piksel yana kayacağımız.
vec2 refractOffset(vec3 n, float eta, float depth) {
  vec3 i = vec3(0.0, 0.0, -1.0); // ortografik bakış: ekrana dik giriyoruz
  vec3 r = refract(i, n, eta);
  if (dot(r, r) < 0.5) return vec2(0.0); // tam iç yansıma
  return r.xy * (depth / max(abs(r.z), 1e-3));
}
```

Formülün tamamı son satırda. Işın `depth` kadar derine iniyor; bu sürede yanal olarak `r.xy / |r.z|` oranında sapıyor. Kalın cam daha çok taşıyor, ince cam daha az. Ekran uzayında yaptığımız bu yaklaşım gerçek bir ışın takibi değil: derinlik tamponuna bakmıyoruz, arka planın kameraya uzaklığını bilmiyoruz, tek düzlemde duruyormuş gibi davranıyoruz. Arka planı bir duvar kabul eden her arayüz için yeterli; bir sahnenin içine gömülü cam için değil.

Aynı fonksiyonun TypeScript ikizi testlerde kullanılıyor; iki dosyayı yan yana tutmak dışında sürüklenmeyi engelleyen bir yöntem bulamadım:

```ts
// src/optics.ts (devamı)
export function refractOffsetPx(
  n: Vec3,
  eta: number,
  depthPx: number,
): readonly [number, number] {
  const r = refract([0, 0, -1], n, eta);
  if (r[0] === 0 && r[1] === 0 && r[2] === 0) return [0, 0];
  const rz = Math.max(Math.abs(r[2]), 1e-3);
  return [(r[0] * depthPx) / rz, (r[1] * depthPx) / rz];
}
```

Örnekleme tarafı da kısa. Kayma piksel cinsinden, doku koordinatı ise 0–1 aralığında:

```glsl
uniform sampler2D uBackdrop;
uniform vec2 uResolution;
uniform vec2 uHalfTexel;

vec3 sampleBackdrop(vec2 fragPx) {
  vec2 uv = fragPx / uResolution;
  // Yarım texel içeri kırp: kenarda LINEAR filtrenin doku dışına uzanmasını engeller.
  return texture(uBackdrop, clamp(uv, uHalfTexel, 1.0 - uHalfTexel)).rgb;
}
```

### IOR Sezgisi: Sayı Ne Kadar Büyükse Işık O Kadar İnatçı

`eta` bir malzeme değil, bir oran: geldiğiniz ortamın kırılma indisi bölü girdiğiniz ortamınki. Havadan cama girerken `1 / 1.52`, camdan havaya çıkarken `1.52`. Bu oranı ters yazmak, kırılma shader'larında yapılan en yaygın hata.

```ts
// src/optics.ts (devamı)
export const IOR = {
  air: 1.0,
  water: 1.333,
  acrylic: 1.49,
  crownGlass: 1.52,
  sapphire: 1.77,
  diamond: 2.417,
} as const;

export function iorToEta(from: number, to: number): number {
  return from / to;
}
```

Bu sayıların hepsi tasarım sabiti; ölçüm değil, tablo değeri. Ama aralarındaki fark ekranda doğrudan görünüyor. Suyun 1,333'ü ile elmasın 2,417'si arasında panelin altındaki yazının kaç piksel kaydığı ~2,3 kat değişiyor: aynı kalınlıkta, pahtan gelen tipik bir normalde su 16,06 piksel taşıyor, elmas 37,27.

Sezgiyi tek cümleye indirmek gerekirse: IOR ışığın o ortamda ne kadar yavaşladığını söyler, kırılma da yavaşlamanın yön değiştirmeye dönüşmüş hâlidir. Sayı büyüdükçe ışın yüzeyin normaline daha çok yapışır ve yandan gelen her şey daha çok bükülür.

Bir de küçük ama işe yarayan bir davranış: panelin ortasında normal `(0, 0, 1)` olduğu için gelen ışın normale paralel, ve paralel gelen ışın hiç kırılmaz. IOR'u ne yaparsanız yapın platonun ortasındaki piksel kıpırdamaz. Kırılma sadece pahın olduğu yerde iş yapar. Camın kenarını kalınlaştırmak, efektin tamamını kalınlaştırmak demek.

### Üç Kanal, Üç Cam: Kromatik Dispersiyon

Kağıt ağırlığının kenarındaki o turuncu ve mavi çizgiye geldik.

Kurye şu ana kadar tek paket taşıyordu. Bu bölümde eline üç ayrı adres veriyoruz.

Cam bütün renkleri aynı ölçüde yavaşlatmaz. Kırılma indisi dalga boyuna göre değişir; mavi uçta biraz daha yüksek, kırmızı uçta biraz daha düşüktür. Bunun büyüklüğünü optik sektörü Abbe sayısıyla veriyor:

```ts
// src/optics.ts (devamı)
/**
 * Abbe sayısı: V = (n_d - 1) / (n_F - n_C).
 * Dönen değer, mavi (486 nm) ile kırmızı (656 nm) arasındaki indis farkı.
 */
export function abbeSpread(nd: number, abbe: number): number {
  return (nd - 1) / abbe;
}

/** t: 0 = kırmızı ucu, 1 = mavi ucu. Uçlar arasında doğrusal tarama. */
export function dispersedIor(nd: number, spread: number, t: number): number {
  return nd + spread * (t - 0.5);
}
```

Sayıyı koyalım: BK7 kron camında `n_d = 1,5168` ve Abbe sayısı `64,17`. `abbeSpread` bu ikisinden `0,0081` üretiyor. Kırmızı ile mavinin kırılma indisi arasındaki gerçek fark binde sekiz.

Bu fark ekranda görünmüyor. Görünmediğini de tahminle değil ölçerek söylemek istiyorum, o yüzden demoya ayrı bir mod koyduk: shader, kırmızı ve mavi kanalın kayma vektörleri arasındaki farkı hesaplayıp piksel cinsinden yazıyor, `readPixels` ile geri okuyup en büyüğünü alıyoruz.

```glsl
// src/shaders/glass.frag.glsl (parça) — main() içinden, MODE_FRINGE dalı
  // Kanallar arası ayrımı piksel olarak FRINGE_SCALE'e göre kodla.
  if (uMode == MODE_FRINGE) {
    vec2 offR = refractOffset(n, 1.0 / (uIor - uSpread * 0.5), uDepth);
    vec2 offB = refractOffset(n, 1.0 / (uIor + uSpread * 0.5), uDepth);
    float sep = length(offR - offB);
    outColor = vec4(clamp(sep / FRINGE_SCALE, 0.0, 1.0), 0.0, 0.0, 1.0);
    return;
  }
```

```ts
// src/fringe.ts
export const FRINGE_SCALE_PX = 32;

/** Kırmızı kanaldaki en büyük kodlanmış ayrımı piksele çevirir. */
export function maxFringePx(
  pixels: Uint8Array,
  scalePx: number = FRINGE_SCALE_PX,
): number {
  let max = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > max) max = pixels[i];
  }
  return (max / 255) * scalePx;
}
```

Kodlama 8 bitlik olduğu için çözünürlük `32 / 255`, yani yaklaşık 0,125 piksel. Bu kaba bir alet ve öyle olduğunu söylemek gerekiyor; binde birlik farkları değil, "görünür mü görünmez mi" sorusunu ölçüyor.

| Yayılım (`spread`) | Nereden geliyor | Ölçülen en büyük R–B ayrımı |
|---|---|---|
| 0,0081 | BK7 camın gerçek Abbe farkı | 0,251 px |
| 0,15 | demonun varsayılanı | 5,522 px |

Yayılım değerleri arasındaki oran (0,15 / 0,0081) tasarım tarafında yaklaşık 18 kat — ama ölçülen piksel saçağı aynı oranda büyümüyor: 5,522 / 0,251 ≈ 22 kat, çünkü kırılma kayması `eta`'ya göre doğrusal değil. Bir arayüzde gördüğünüz her gökkuşağı kenarı fizikten değil, sanat yönetiminden geliyor. Bunu öğrendiğimde efekti "yanlış" saymak yerine adını değiştirdim: fiziksel dispersiyon değil, dispersiyonun karikatürü.

Kanalları ayırmanın shader tarafı bir döngü. Tek örnekte dispersiyon yok; çok örnekte spektrumu tarayıp her örneğin RGB'ye katkısını ağırlıklandırıyoruz:

```glsl
// src/shaders/glass.frag.glsl (parça)
// t: 0 kırmızı ucu, 1 mavi ucu. Üç tepeli kaba bir spektrum ağırlığı.
vec3 spectrumWeight(float t) {
  return vec3(
    exp(-16.0 * (t - 0.15) * (t - 0.15)),
    exp(-16.0 * (t - 0.50) * (t - 0.50)),
    exp(-16.0 * (t - 0.85) * (t - 0.85))
  );
}

vec3 refractBackdrop(vec2 fragPx, vec3 n, float ior, float spread, float depth) {
  if (uSamples <= 1) {
    return sampleBackdrop(fragPx + refractOffset(n, 1.0 / ior, depth));
  }

  vec3 sum = vec3(0.0);
  vec3 wsum = vec3(0.0);
  for (int i = 0; i < MAX_SAMPLES; i++) {
    if (i >= uSamples) break;
    float t = float(i) / float(uSamples - 1);
    float ni = ior + spread * (t - 0.5);      // mavi uç daha yüksek indis
    vec2 off = refractOffset(n, 1.0 / ni, depth);
    vec3 w = spectrumWeight(t);
    sum += sampleBackdrop(fragPx + off) * w;
    wsum += w;
  }
  // Her kanal kendi ağırlık toplamına bölünüyor: beyaz beyaz kalıyor.
  return sum / max(wsum, vec3(1e-4));
}
```

Her kanalı kendi ağırlık toplamına bölmek küçük ama kritik bir ayrıntı. Bölmezseniz örnek sayısını değiştirdiğinizde panelin genel parlaklığı da değişir ve ölçüm tablonuz iki farklı şeyi kıyaslar hâle gelir.

Örnek sayısı doğrudan doku okuma sayısı demek, doku okuma da bu shader'ın en pahalı işi. Tablosu şöyle çıkıyor:

| Dispersiyon örneği | Piksel başına doku okuma | Medyan GPU ms |
|---|---|---|
| 1 (kapalı) | 1 | 0,131 |
| 3 (varsayılan) | 3 | 0,163 |
| 8 | 8 | 0,217 |

Örnek başına ek maliyet: 0,0123 ms/örnek — GPU medyanları üzerinden, (0,217 − 0,131) / 7.

Doku okumaları birbirinden bağımsız adreslerden geliyor ve aralarındaki mesafe `spread` ile büyüyor. Cache (önbellek) dostu bir erişim deseni değil. Maliyetin örnek sayısıyla tam doğrusal gitmesini beklemiyorum; tablo hangi yöne çıkarsa çıksın, okunacak olan eğimin kendisi.

### Fresnel: Kenar Neden Parlıyor

Bir camın ne kadarının yansıdığı, ne kadarının içeri girdiği bakış açısına bağlı. Dik baktığınızda cam neredeyse tamamen saydam; sıyırarak baktığınızda neredeyse ayna. Ucuz yaklaşığı Schlick formülü:

```ts
// src/optics.ts (devamı)
/** Dik bakışta yansıma oranı: ((n1 - n2) / (n1 + n2))². */
export function schlickF0(n1: number, n2: number): number {
  const r = (n1 - n2) / (n1 + n2);
  return r * r;
}

export function fresnelSchlick(cosTheta: number, f0: number): number {
  const c = Math.min(Math.max(1 - cosTheta, 0), 1);
  return f0 + (1 - f0) * c ** 5;
}
```

Hava–cam çifti için `schlickF0(1, 1.52)` yaklaşık `0,043` veriyor. Dik baktığınızda camın yansıttığı ışığın oranı yüzde dört civarı. Normal yattıkça bu oran tırmanıyor; formülün limitinde, tam sıyırma açısında bire koşuyor.

Pahın neden bu kadar iş yaptığı burada netleşiyor. Panel ekrana paralel ve göz de dik bakıyor; platonun her yerinde `cos(theta) = 1` ve Fresnel sabit yüzde dört. Sıyırma açısı ancak normal yattığında oluşuyor, normal de yalnızca pahta yatıyor. Camın parlayan kenarı bir dekorasyon değil, geometrinin doğrudan sonucu.

Normalin dikeyden 49,5 dereceye kadar saptığını ölçmüştük. Klasik soru tam burada geliyor: bu açı bir yerde kritik açıyı aşıp tam iç yansımayı (total internal reflection) tetikliyor mu?

Hayır. Tetiklenmiyor, üstelik denk gelmediği için değil, matematik izin vermediği için.

Shader ışığı her seferinde havadan cama sokuyor: `refractOffset(n, 1.0 / ior, depth)`. IOR slider'ı da 1 ile 2,5 arasında kelepçeli. Yani `eta = 1/ior` hiçbir zaman 1'i geçmiyor ve `k = 1 − eta²(1 − ni²)` en kötü ihtimalle `1 − eta²` kadar düşüyor — sıfırın altına inemiyor. Tam iç yansıma yoğun ortamdan seyreğe *çıkarken* oluyor, camdan havaya. Seyrekten yoğuna girerken Snell'in her zaman bir çözümü var. Kurye bu kapıdan geri çevrilmiyor.

Bunu taramayla da mühürledik. Varsayılan kalınlıkta panelin her pikseli, IOR'un (1,0 / 1,52 / 2,5) ve yayılımın (0 / 0,15 / 0,4) uçlarıyla çarpılıp kırmızı ve mavi dalların ikisi için de hesaplandı: 7.781.778 örnek, sıfır vektör sayısı sıfır. En küçük `k` 0,0952; varsayılan ayarda 0,7203. Panel normal ayarındayken kritik açının yakınına bile gelmiyoruz.

Tek istisna, camın cam olmaktan çıktığı köşede. IOR'u tabana, 1,0'e indirip yayılımı 0,4'e açarsanız kırmızı dalın etkin indisi 0,8'e düşüyor; artık havadan cama değil, havadan *daha seyrek* bir şeye giriyorsunuz. Kalınlığı da varsayılanın az üstüne, 7'ye çekerseniz dal gerçekten çalışıyor. Fiziksel bir malzeme değil, slider'ın ucu.

Peki `refractOffset` içindeki `if (dot(r, r) < 0.5) return vec2(0.0);` satırı ne arıyor orada? Pratikte ulaşılamayan bir dal, ve kalması lazım. Shader'ı bir sahnenin içine gömüp ışını camdan havaya çıkardığınız gün `eta` 1'in üstüne geçiyor, dal gerçek oluyor ve o kontrol yoksa `normalize(vec3(0))` NaN üretip ekranda siyah lekeler bırakıyor. Ölü kod, ama ucuz sigorta.

Kenarı parlatan şey de bu yüzden tam iç yansıma değil, tek başına Fresnel. Normal yattıkça `cos(theta)` küçülüyor, Schlick'in beşinci kuvveti yansıma oranını yukarı çekiyor ve karışım kırılmadan yansımaya doğru kayıyor. Ölçüsünü de vereyim ki abartmayalım: varsayılan kalınlıkta en dik normalde bile Fresnel yüzde 4,8'de kalıyor, kalınlığı sonuna çektiğinizde yüzde 27'ye çıkıyor. Kenar parlıyor; ayna olmuyor.

Panelin tamamı şu:

```glsl
// src/shaders/glass.frag.glsl (parça)
void main() {
  vec2 p = gl_FragCoord.xy - uPanelCenter;
  float d = sdRoundedBox(p, uPanelHalf, uRadius);
  float alpha = 1.0 - smoothstep(-1.0, 1.0, d); // 2 piksellik yumuşak kenar
  if (alpha <= 0.0) discard;

  vec3 n = glassNormal(p, uPanelHalf, uRadius, uBevel, uThickness, uNormalEps);

  if (uMode == MODE_NORMAL) {
    outColor = vec4(n * 0.5 + 0.5, alpha);
    return;
  }

  // Kanallar arası ayrımı piksel olarak FRINGE_SCALE'e göre kodla.
  if (uMode == MODE_FRINGE) {
    vec2 offR = refractOffset(n, 1.0 / (uIor - uSpread * 0.5), uDepth);
    vec2 offB = refractOffset(n, 1.0 / (uIor + uSpread * 0.5), uDepth);
    float sep = length(offR - offB);
    outColor = vec4(clamp(sep / FRINGE_SCALE, 0.0, 1.0), 0.0, 0.0, 1.0);
    return;
  }

  vec3 refr = refractBackdrop(gl_FragCoord.xy, n, uIor, uSpread, uDepth);

  vec3 view = vec3(0.0, 0.0, 1.0);
  float f = fresnelSchlick(max(dot(n, view), 0.0), uF0);
  vec3 sky = uTint * (0.55 + 0.45 * n.y); // ucuz ortam: normalden gelen gradyan
  vec3 col = mix(refr, sky, f);

  vec3 l = normalize(vec3(-0.35, 0.72, 0.60));
  float spec = pow(max(dot(reflect(-view, n), l), 0.0), 48.0);
  col += vec3(1.0, 0.98, 0.94) * spec * uSpecular;

  outColor = vec4(col, alpha);
}
```

`MODE_NORMAL` gözle bakmak için: normalleri renk olarak basınca pahın nerede başlayıp bittiği bir bakışta görünüyor. Bu modu ilk açtığımda pah genişliğimin yarısının köşe yarıçapının içinde kaldığını fark ettim; köşelerde profil eziliyordu ve nedenini anlamak için yarım saat kırılma matematiğinde hata aramıştım.

Çizim tarafında panel tam ekran değil. Vertex shader dört köşeyi uniform'lardan üretiyor, bir `TRIANGLE_STRIP` yetiyor:

```glsl
// src/shaders/panel.vert.glsl
#version 300 es

uniform vec2 uResolution;
uniform vec2 uPanelCenter;
uniform vec2 uPanelHalf;
uniform float uPad; // yumuşak kenar için birkaç piksel taşma

void main() {
  // gl_VertexID: 0 -> (0,0), 1 -> (1,0), 2 -> (0,1), 3 -> (1,1)
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vec2 px = uPanelCenter + (c * 2.0 - 1.0) * (uPanelHalf + uPad);
  gl_Position = vec4((px / uResolution) * 2.0 - 1.0, 0.0, 1.0);
}
```

Fragment maliyeti panelin alanıyla orantılı, ekranın alanıyla değil. 420×260'lık bir panel 960×540'lık bir sahnenin yüzde 20,8'ini kaplıyor (köşe yuvarlaklıklarının kesip attığı alan dahil hesaplandı). Tam ekran bir shader'a göre beşte bir iş.

```ts
// src/coverage.ts
/** Yuvarlatılmış dikdörtgenin alanı: dört köşeden (4 - π)r² kadar eksiliyor. */
export function roundedRectArea(w: number, h: number, r: number): number {
  const rr = Math.min(Math.max(r, 0), Math.min(w, h) / 2);
  return w * h - (4 - Math.PI) * rr * rr;
}

export function coveragePct(
  panelW: number,
  panelH: number,
  radius: number,
  screenW: number,
  screenH: number,
): number {
  if (screenW <= 0 || screenH <= 0) return 0;
  return (roundedRectArea(panelW, panelH, radius) / (screenW * screenH)) * 100;
}
```

### Aynı Paneli CSS'le Kurmak

Şimdi kıyasın diğer yakası. Aynı panel, aynı arka plan, sıfır satır GLSL.

Kıyasın adil olması için iki yolun aynı arka planı görmesi lazım. Bunu şöyle çözdük: arka plan her iki modda da aynı WebGL canvas'ında çiziliyor. WebGL modunda cam paneli o canvas'ın içine çiziliyor; CSS modunda canvas'ın üzerine mutlak konumlu bir `<div>` bindiriliyor ve `backdrop-filter` canvas'ın piksellerini filtreliyor.

```html
<!-- index.html (parça) -->
      <div class="stage">
        <canvas id="scene"></canvas>
        <div id="cssGlass" class="glass" hidden></div>
        <div id="hud"></div>
      </div>
```

```css
/* src/style.css (parça) */
.glass {
  position: absolute;
  width: 420px;
  height: 260px;
  border-radius: 40px;
  backdrop-filter: blur(2px) url(#liquid-glass);
  -webkit-backdrop-filter: blur(2px);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.35),
    inset 0 -1px 0 rgb(0 0 0 / 0.25),
    0 12px 32px rgb(0 0 0 / 0.35);
}
```

Filtrenin kendisi bir SVG. Displacement map'i (yer değiştirme haritası) çalışma anında üretip `feImage` ile içeri veriyoruz:

```html
<!-- index.html (parça) — ekranda görünmeyen filtre tanımı -->
        <filter
          id="liquid-glass"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          color-interpolation-filters="sRGB"
        >
          <feImage result="map" preserveAspectRatio="none" x="0" y="0" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="62"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
```

`color-interpolation-filters="sRGB"` satırı pazarlık konusu değil. Varsayılan `linearRGB` ve o modda tarayıcı haritanızın kanal değerlerini filtreye vermeden önce dönüştürüyor; normal haritası gibi renk olmayan bir veriyi renk sanıp bozuyor. Sonuç sessizce yanlış: panel çalışıyor ama kayma miktarları merkezde simetrik değil.

Haritayı üreten kod saf ve test edilebilir. Shader'la aynı `sdRoundedBox` ve `glassNormal` fonksiyonlarının TypeScript ikizlerini kullanıyor, ki iki yolun *şekli* birebir aynı olsun:

```ts
// src/displacement-map.ts
import { glassNormal } from "./sdf2d";

export interface PanelShape {
  width: number;
  height: number;
  radius: number;
  bevel: number;
  thickness: number;
}

/**
 * feDisplacementMap kodlaması: R kanalı x sapması, G kanalı y sapması,
 * ikisi de 0.5 merkezli. Sapmanın büyüklüğünü filtredeki `scale` belirler.
 *
 * Harita normali DEĞİL, kaymayı kodluyor: kırılma örneği normalin ters yönüne
 * taşıdığı için iki kanal da eksili. Koordinatlar SVG'nin y-aşağı çerçevesinde
 * hesaplandığından ayrıca bir çevirmeye gerek kalmıyor.
 */
export function buildDisplacementRGBA(shape: PanelShape): Uint8ClampedArray {
  const { width, height, radius, bevel, thickness } = shape;
  const data = new Uint8ClampedArray(width * height * 4);
  const half = [width / 2, height / 2] as const;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = [x + 0.5 - half[0], y + 0.5 - half[1]] as const;
      const n = glassNormal(p, half, radius, bevel, thickness, 1);
      const i = (y * width + x) * 4;
      data[i] = Math.round((-n[0] * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((-n[1] * 0.5 + 0.5) * 255);
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  return data;
}

export function toPngDataUrl(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D bağlamı alınamadı");
  const image = new ImageData(width, height);
  image.data.set(data);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}
```

Bağlama tarafı üç satır, ama `feImage`'a boyut vermeyi unutursanız harita filtre bölgesine yayılmıyor:

```ts
// src/css-glass.ts (parça)
export function applyDisplacementMap(shape: PanelShape): void {
  const rgba = buildDisplacementRGBA(shape);
  const url = toPngDataUrl(rgba, shape.width, shape.height);

  for (const image of document.querySelectorAll("feImage")) {
    image.setAttribute("href", url);
    image.setAttribute("width", String(shape.width));
    image.setAttribute("height", String(shape.height));
  }
}
```

Bu fonksiyonu panel boyutu ya da `devicePixelRatio` değiştiğinde yeniden çağırmak gerekiyor. Shader tarafında böyle bir bakım borcu yok; orada harita diye bir şey yok, normal her karede fonksiyondan geliyor.

### CSS'in Yapamadıkları (ve Yapabildikleri)

Burada karşı tarafın hakkını teslim edelim, çünkü "CSS bunu yapamaz" cümlesinin çoğu abartı.

CSS dispersiyon *yapabiliyor*. Filtreyi üç dala bölüp her dalda farklı bir `scale` kullanır, sonra kanalları toplarsınız:

```html
<!-- index.html (parça) — üç dallı dispersiyon filtresi -->
        <filter
          id="liquid-glass-rgb"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          color-interpolation-filters="sRGB"
        >
          <feImage result="map" preserveAspectRatio="none" x="0" y="0" />

          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="56"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dR"
          />
          <feColorMatrix
            in="dR"
            type="matrix"
            result="cR"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="62"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dG"
          />
          <feColorMatrix
            in="dG"
            type="matrix"
            result="cG"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="68"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dB"
          />
          <feColorMatrix
            in="dB"
            type="matrix"
            result="cB"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
          />

          <feComposite
            in="cR"
            in2="cG"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
            result="cRG"
          />
          <feComposite
            in="cRG"
            in2="cB"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
          />
        </filter>
      </svg>
```

Çalışıyor. Arka planı üç kez filtreliyorsunuz ve tablodaki sayı bunu görüyor.

Peki gerçekten yapılamayan ne? Liste kısa ve net:

1. **Bakış açısına bağlı hiçbir terim.** `feDisplacementMap` sadece bir kaydırma tablosu; hangi açıdan bakıldığını bilmiyor. Fresnel yok, tam iç yansıma yok, sıyırma açısında yansımaya devir yok. Kenardaki parlaklığı `box-shadow` ve gradyanla taklit edebilirsiniz ama o taklit sabit; içeriğe ve açıya tepki vermiyor.
2. **Fiziksel parametre yok.** Filtrenin `scale` değeri piksel cinsinden bir sayı. IOR girip kayma miktarını hesaplatamıyorsunuz; kalınlık, indis ve açı üçlüsünü kendiniz kafadan bir `scale`'e çeviriyorsunuz. Malzeme değiştirmek bir sayıyı elle oynatmak demek.
3. **Örnek sayısı üçle sınırlı.** Spektrumu sekiz örnekle taramak için sekiz `feDisplacementMap` dalı yazmanız gerekir. Shader'da bu bir uniform.
4. **Filtre bölgesi bir duvar.** SVG filtre bölgesinin varsayılanı nesne kutusunun yüzde 110'u; dışarısı şeffaf siyah. Kenarda kaydırma bölgenin dışını göstermeye başladığında oradan boşluk geliyor. Bölgeyi büyütmek çözüyor ama filtrenin işlediği alanı da büyütüyor. Shader tarafında böyle bir sınır yok: kaynak doku ekranın tamamı.
5. **Taşınabilirlik.** Yukarıdaki kaynakların ikisinin de söylediği şey: `backdrop-filter` içinde `url(#filtre)` referansı pratikte Chromium'a bağlı. Safari filtreyi yok sayıp yalnızca `blur()` kısmını uyguluyor, yani sıvı cam bulanık cama düşüyor.

Beşincisini demoda bir rozete bağladık, çünkü tarayıcı sorgusu yapmak yerine tarayıcıya sormak daha dürüst:

```ts
// src/css-glass.ts (devamı)
/**
 * Dikkat: bu bir SÖZDİZİMİ kontrolü. Tarayıcı "evet, bu değeri ayrıştırabiliyorum"
 * diyor; "evet, bu filtreyi uyguluyorum" demiyor. Ölçüm çıktısında da böyle etiketli.
 */
export function backdropFilterUrlSyntaxSupported(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    (CSS.supports("backdrop-filter", "url(#x)") ||
      CSS.supports("-webkit-backdrop-filter", "url(#x)"))
  );
}
```

Ölçüm koşusunda bu alan `true` olarak raporlanıyor.

### Bütçe: Panelin Kapladığı Piksel

Bu serinin demoları kimsenin dizüstünü uğuldatmayacak şekilde kuruluyor. Cam paneli tam ekran bir raymarcher kadar aç gözlü değil, ama arka plan yakalama hedefi tam ekran ve `devicePixelRatio` orada doğrudan çarpan.

```ts
// src/viewport.ts
export const MAX_DPR = 2;
export const MAX_PIXELS = 2_100_000;

export function backingSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  scale: number,
) {
  const clampedDpr = Math.min(Math.max(dpr, 1), MAX_DPR);
  const clampedScale = Math.min(Math.max(scale, 0.25), 1);
  const width = Math.max(1, Math.round(cssWidth * clampedDpr * clampedScale));
  const height = Math.max(1, Math.round(cssHeight * clampedDpr * clampedScale));
  return fitPixelBudget(width, height);
}

/** En-boy oranını koruyarak toplam piksel sayısını bütçenin altına indirir. */
export function fitPixelBudget(
  width: number,
  height: number,
  budget: number = MAX_PIXELS,
) {
  const total = width * height;
  if (total <= budget) return { width, height };
  const factor = Math.sqrt(budget / total);
  return {
    width: Math.max(1, Math.floor(width * factor)),
    height: Math.max(1, Math.floor(height * factor)),
  };
}
```

Üstüne bir "Dur/Devam" düğmesi ve sekme gizlenince otomatik duraklatma var. Tarayıcı gizli sekmede `requestAnimationFrame`'i zaten kısıyor, ama kısmak durdurmak değil; ölçüm alırken arkada duran bir sekmenin sayıları kirletmesini istemiyoruz.

Camın okuduğu arka plan kopyasının ölçeği ayrı bir kol. Sezgi, dokuyu küçültünce örnek başına maliyetin düşeceği yönünde; ölçüm bunu doğrulamıyor — kenarlardaki ince detay eriyor ama GPU ms hafifçe *artıyor*:

| Arka plan doku ölçeği | Medyan GPU ms |
|---|---|
| 1,00 | 0,159 |
| 0,50 | 0,195 |
| 0,25 | 0,201 |

Bu üç satırın hikâyesi beklenenin tersi çıkıyor: ölçek düşünce GPU ms yükseliyor, çünkü `captureBackdrop`'taki ikinci `blitFramebuffer` çağrısı (yukarıda görülen `sample !== capture` dalı) yalnızca `scale < 1` iken devreye giriyor ve ek bir geçiş ekliyor. Bu çözünürlükte kazanılması beklenen cache avantajı, o ekstra geçişin maliyetini karşılamıyor. Ölçeği düşürmek burada bir hız optimizasyonu değil; VRAM ve bant genişliği kararı.

### Ölçüm: İki Yol, İki Farklı Saat

Asıl kıyas burada başlıyor ve peşinen söylemem gereken bir şey var.

WebGL tarafını GPU'nun kendi saatiyle ölçebiliyoruz: `EXT_disjoint_timer_query_webgl2` uzantısı çizim komutunun GPU'da ne kadar sürdüğünü nanosaniye olarak veriyor. Bu uzantı her yerde yok ve varlığını raporluyoruz: bu makinede `true`.

CSS tarafını aynı saatle ölçemiyoruz. `backdrop-filter`'ın işi bizim çizim komutumuz değil; tarayıcının compositor'ında, çoğu zaman ayrı bir süreçte oluyor. `performance.now()` ile bir şeyi sarma imkânı yok, çünkü sardığımız bir şey yok.

Elimizde kalan `requestAnimationFrame` delta'sı. Bu, ana thread'in kare temposunu ölçüyor: hattın bir sonraki kareyi ne zaman sunabildiğini. Filtrenin kaç milisaniye sürdüğünü söylemiyor. Compositor tıkanırsa rAF tik'leri aralanıyor; delta bu yüzden *dolaylı* bir sinyal. "CSS filtresi X ms sürüyor" cümlesini kuramayız; "CSS filtresi açıkken hat kareyi şu tempoda sunuyor" cümlesini kurabiliriz.

Bu yüzden tabloda iki farklı sütun var ve WebGL yolu her iki yöntemle de ölçülüyor. Ortak zeminde kıyaslanabilen sütun rAF sütunu; GPU ms sütunu yalnızca bir tarafta dolu ve öyle kalacak.

Ölçümün deterministik olması için `?measure=1` ile açıldığında demo bambaşka bir moda giriyor: sabit arka tampon boyutu, sabit zaman adımı, kapalı etkileşim, ısınma kareleri atılıyor, her yapılandırma için sayılı kare toplanıyor ve konsola tek satır JSON basılıyor.

```ts
// src/measure.ts (parça)
export interface FrameStats {
  frameMsMedian: number;
  frameMsP95: number;
  droppedFrames: number;
}

/** Vsync aralığının 1.5 katını aşan her kare "atlanmış" sayılır. */
export function frameStats(
  deltas: readonly number[],
  vsyncMs = 16.67,
): FrameStats {
  return {
    frameMsMedian: median(deltas),
    frameMsP95: percentile(deltas, 95),
    droppedFrames: deltas.filter((d) => d > vsyncMs * 1.5).length,
  };
}
```

```ts
// src/stats.ts
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (Math.min(Math.max(p, 0), 100) / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

export function median(values: readonly number[]): number {
  return percentile(values, 50);
}
```

Ortalama değil medyan alıyoruz, çünkü tek bir garbage collection duraklaması ortalamayı çekiştiriyor. p95'i de raporluyoruz: kötü kareler ortalamada saklanır, yüzdelikte saklanamaz.

Beş yapılandırma ölçülüyor. Hepsinde aynı arka plan, aynı panel boyutu, aynı süre:

| Yol | Medyan kare ms | p95 kare ms | Atlanan kare | Medyan GPU ms |
|---|---|---|---|---|
| Panel yok (referans) | 8,3 | ≈9,0 | 0 | 0,111 |
| WebGL cam (3 örnek) | 8,3 | ≈9,1 | 0 | 0,160 |
| CSS `blur(2px)` | 8,3 | ≈9,0–9,1 | 0 | ölçülemez |
| CSS blur + displacement | 8,3 | ≈9,0–9,1 | 0 | ölçülemez |
| CSS blur + üç dallı RGB | 8,3 | ≈9,0–9,1 | 0 | ölçülemez |

Son sütunun üç satırında "ölçülemez" yazması bir eksiklik değil, tablonun en dürüst hücresi. Oraya bir sayı yazmak için compositor'a saat sokmam gerekirdi ve tarayıcı bana o kapıyı açmıyor.

Bir uyarı daha: bütün satırlar vsync'e takılıyorsa medyan kare ms hepsinde vsync aralığına eşit çıkar (bu makinede 120 Hz, yani 8,3) ve tablo hiçbir şey söylemez. O yüzden ölçüm modunda arka plan deseninin frekansı ve panel boyutu, hattı doyuracak kadar yüklü seçiliyor. Sayılar tavana dayanırsa bunu da raporlayacağız; doyuma ulaşmamış bir ölçüm, ulaşmış gibi sunulmayacak.

Bu ölçüm makinesinde tam olarak tavana dayandı: beş yolun beşi de 120 Hz vsync'ine kilitlendi, medyan kare ms hepsinde 8,3, atlanan kare hepsinde sıfır. rAF sütunu bu yüzden aralarında bir hız farkı söylemiyor — hepsi aynı tavana çarpıyor. Buradaki fark performans değil, yetenek: CSS yolları gerçek bir IOR'dan piksel kayması üretemiyor, bakış açısına bağlı bir Fresnel terimi kuramıyor. Tablo bir hız kıyası olmaktan çıkıp bir yetenek kıyasına dönüşüyor.

### Saf Katman: Tarayıcısız Doğrulanan Kısım

Bu projede GPU'ya ve DOM'a dokunmayan her şey `vitest` ile test ediliyor. Optik matematiğin tamamı bu katmanda.

Snell yasasının doğru uygulandığını doğrudan çiviliyoruz:

```ts
// test/optics.test.ts (parça)
import { describe, expect, it } from "vitest";
import {
  IOR,
  abbeSpread,
  dispersedIor,
  fresnelSchlick,
  iorToEta,
  refract,
  refractOffsetPx,
  schlickF0,
  type Vec3,
} from "../src/optics";

const N: Vec3 = [0, 0, 1];

describe("refract", () => {
  it("normale paralel gelen ışın hiç kırılmaz", () => {
    const r = refract([0, 0, -1], N, iorToEta(IOR.air, IOR.crownGlass));
    expect(r[0]).toBeCloseTo(0, 12);
    expect(r[1]).toBeCloseTo(0, 12);
    expect(r[2]).toBeCloseTo(-1, 12);
  });

  it("Snell yasasını sağlar: sin(t) = eta * sin(i)", () => {
    const a = Math.PI / 6; // 30 derece
    const i: Vec3 = [Math.sin(a), 0, -Math.cos(a)];
    const eta = iorToEta(IOR.air, IOR.crownGlass);
    const r = refract(i, N, eta);
    const sinT = Math.hypot(r[0], r[1]);
    expect(sinT).toBeCloseTo(eta * Math.sin(a), 10);
  });

  it("kritik açının ötesinde sıfır vektör döndürür", () => {
    const a = Math.PI / 4;
    const i: Vec3 = [Math.sin(a), 0, -Math.cos(a)];
    const r = refract(i, N, iorToEta(IOR.crownGlass, IOR.air)); // cam -> hava
    expect(r).toEqual([0, 0, 0]);
  });
});
```

Üçüncü teste dikkat: `iorToEta(IOR.crownGlass, IOR.air)` yönü camdan havaya, yani renderer'ın hiç kullanmadığı yön. Bilerek öyle. Tam iç yansıma yalnızca o yönde yaşıyor ve panelde tetiklenmeyen dalın matematiğini burada, CPU'da çiviliyoruz. Kırılmanın öldüğü açı hesapla bulunuyor, gözle değil; shader'ı bir gün o yöne çevirirsek formülün doğru yerde teslim olduğunu bilerek çeviriyoruz.

IOR sezgisini de teste çeviriyoruz, çünkü "büyük IOR daha çok büker" cümlesi ancak sayıyla iddia olur:

```ts
// test/optics.test.ts (devamı)
describe("refractOffsetPx", () => {
  const tilted: Vec3 = [0.6, 0, 0.8]; // pahtan gelen tipik bir normal

  it("düz yüzeyde kayma sıfırdır", () => {
    const off = refractOffsetPx([0, 0, 1], iorToEta(1, IOR.crownGlass), 90);
    expect(Math.hypot(off[0], off[1])).toBeCloseTo(0, 10);
  });

  it("IOR büyüdükçe kayma büyür", () => {
    const water = refractOffsetPx(tilted, iorToEta(1, IOR.water), 90);
    const glass = refractOffsetPx(tilted, iorToEta(1, IOR.crownGlass), 90);
    const diamond = refractOffsetPx(tilted, iorToEta(1, IOR.diamond), 90);
    const mag = (v: readonly [number, number]) => Math.hypot(v[0], v[1]);
    expect(mag(water)).toBeLessThan(mag(glass));
    expect(mag(glass)).toBeLessThan(mag(diamond));
  });

  it("kayma cam kalınlığıyla doğrusal büyür", () => {
    const a = refractOffsetPx(tilted, iorToEta(1, IOR.crownGlass), 45);
    const b = refractOffsetPx(tilted, iorToEta(1, IOR.crownGlass), 90);
    expect(b[0]).toBeCloseTo(a[0] * 2, 10);
  });

  it("mavi kanal kırmızıdan daha çok bükülür", () => {
    const red = refractOffsetPx(tilted, iorToEta(1, 1.5168 - 0.0081 / 2), 90);
    const blue = refractOffsetPx(tilted, iorToEta(1, 1.5168 + 0.0081 / 2), 90);
    expect(Math.hypot(blue[0], blue[1])).toBeGreaterThan(
      Math.hypot(red[0], red[1]),
    );
  });
});

describe("malzeme sabitleri", () => {
  it("hava-cam arayüzünde dik yansıma yaklaşık %4", () => {
    expect(schlickF0(IOR.air, IOR.crownGlass)).toBeCloseTo(0.0426, 4);
  });

  it("BK7'nin Abbe yayılımı binde sekiz civarı", () => {
    expect(abbeSpread(1.5168, 64.17)).toBeCloseTo(0.00805, 5);
  });

  it("Fresnel sıyırma açısında bire koşar", () => {
    expect(fresnelSchlick(1, 0.04)).toBeCloseTo(0.04, 6);
    expect(fresnelSchlick(0, 0.04)).toBeCloseTo(1, 6);
  });
});
```

Şekil tarafında da mesafe fonksiyonunun bilinen noktalarını çiviliyoruz:

```ts
// test/sdf2d.test.ts (parça)
import { describe, expect, it } from "vitest";
import { glassHeight, glassNormal, sdRoundedBox } from "../src/sdf2d";

describe("sdRoundedBox", () => {
  const half = [100, 60] as const;

  it("merkezde en yakın kenara olan mesafeyi negatif verir", () => {
    expect(sdRoundedBox([0, 0], half, 20)).toBeCloseTo(-60, 10);
  });

  it("kenar üzerinde sıfırdır", () => {
    expect(sdRoundedBox([100, 0], half, 20)).toBeCloseTo(0, 10);
    expect(sdRoundedBox([0, 60], half, 20)).toBeCloseTo(0, 10);
  });

  it("köşe yarıçapı köşeyi içeri çeker", () => {
    expect(sdRoundedBox([100, 60], half, 20)).toBeCloseTo(
      20 * Math.SQRT2 - 20,
      10,
    );
  });
});

describe("glassHeight", () => {
  it("kenarda 0, pahın bittiği yerde 1", () => {
    expect(glassHeight(0, 34)).toBeCloseTo(0, 12);
    expect(glassHeight(-34, 34)).toBeCloseTo(1, 12);
    expect(glassHeight(-200, 34)).toBeCloseTo(1, 12);
  });

  it("panel dışında sıfır kalır", () => {
    expect(glassHeight(12, 34)).toBeCloseTo(0, 12);
  });

  it("içeri doğru monoton artar", () => {
    let previous = glassHeight(0, 34);
    for (let d = -1; d >= -34; d--) {
      const current = glassHeight(d, 34);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });
});

describe("glassNormal", () => {
  const half = [210, 130] as const;

  it("platonun ortasında düzdür", () => {
    const n = glassNormal([0, 0], half, 40, 34, 6, 1);
    expect(n[0]).toBeCloseTo(0, 8);
    expect(n[1]).toBeCloseTo(0, 8);
    expect(n[2]).toBeCloseTo(1, 8);
  });

  it("pahta dışarı doğru yatar ve simetriktir", () => {
    const right = glassNormal([200, 0], half, 40, 34, 6, 1);
    const left = glassNormal([-200, 0], half, 40, 34, 6, 1);
    expect(right[0]).toBeGreaterThan(0.15);
    expect(left[0]).toBeCloseTo(-right[0], 8);
  });

  it("kalınlık arttıkça daha çok yatar", () => {
    const thin = glassNormal([200, 0], half, 40, 34, 3, 1);
    const thick = glassNormal([200, 0], half, 40, 34, 12, 1);
    expect(thick[0]).toBeGreaterThan(thin[0]);
  });
});
```

Displacement map'in de testi var ve en çok işe yarayanı şu: haritanın merkezi tam olarak nötr olmalı, yoksa CSS paneli hiç kırmadan da içeriği kaydırır.

```ts
// test/displacement-map.test.ts (parça)
  it("merkez piksel nötr kodlanır (0.5, 0.5)", () => {
    const shape = { width: 64, height: 40, radius: 10, bevel: 8, thickness: 6 };
    const data = buildDisplacementRGBA(shape);
    const i = ((shape.height / 2) * shape.width + shape.width / 2) * 4;
    expect(data[i]).toBe(128);
    expect(data[i + 1]).toBe(128);
  });
```

Geri kalanı daha sıkıcı ama gerekli: `backingSize` kelepçe testleri, `percentile` kenar durumları, `roundedRectArea` (yarıçap sıfırken dikdörtgen, yarıçap yarım kenar iken daire), `backdropBytes` hesabı, `maxFringePx` kod çözme, `frameStats` atlanan kare sayımı. Hiçbir test dosyası `document`, `WebGL2RenderingContext` ya da `performance` referansı içermiyor.

Bu testlerin hiçbiri panelin cam gibi göründüğünü kanıtlamıyor. Onun için tarayıcıda açmak, normal moduna bakmak ve `?measure=1` ile konsoldaki tek satırı okumak gerekiyor.

### Özetle:

1. Bulanıklık komşuları ortalar ve bilgiyi harcar; kırılma tek bir örnek alır ve bilgiyi taşır. Kırılmayı güçlendirmek görüntüyü bulandırmaz, büker.
2. Camın arkasını görebilmesi için arka planın bir doku olması gerekir. Arka planı FBO'ya çizip `blitFramebuffer` ile ekrana kopyalayın; iki kez çizmeyin.
3. Arka plan dokusunda `CLAMP_TO_EDGE` şart. Kenarda kırılan örnek doku dışına taşar ve `REPEAT` modunda karşı kenarın görüntüsü sızar.
4. Panel şeklini dokudan değil `sdRoundedBox`'tan alın. Yükseklik profili mesafeden, normal de profilin gradyanından gelir; tek satır değişiklikle pah genişliği ve kalınlık ayarlanır.
5. Kırılma yalnızca normalin yattığı yerde iş yapar. Platonun ortasında ışın normale paralel geldiği için IOR ne olursa olsun hiçbir şey kaymaz. Efektin tamamı pahta yaşıyor.
6. `refract(I, N, eta)` içinde `eta = n1 / n2`. Havadan cama `1/1.52`, camdan havaya `1.52`. Ters yazmak en sık yapılan hata.
7. `k < 0` dalı tam iç yansımadır ve GLSL sıfır vektör döndürür. Kontrol etmezseniz `normalize(vec3(0))` NaN üretip ekranda siyah lekeler bırakır.
8. Ekran uzayı kırılması bir yaklaşımdır: derinlik tamponuna bakmaz, arka planı tek düzlem kabul eder. Arayüz panelleri için yeterli, sahne içi cam için değil.
9. Tam iç yansıma yalnızca yoğundan seyreğe geçerken vardır. Havadan cama girerken `eta ≤ 1` olduğu için `k` negatif olamaz: bu panelde koruma dalı 7,78 milyon örnekte bir kez bile tetiklenmedi. Kenardaki parlaklığı veren şey tam iç yansıma değil, tek başına Fresnel.
10. `schlickF0(1, 1.52)` yaklaşık 0,043. Dik bakışta camın yansıttığı ışık yüzde dört; kenardaki parlaklık geometriden, pahtan geliyor.
11. Gerçek kromatik dispersiyon çok küçük: BK7 için Abbe farkı 0,0081. Arayüzlerde gördüğünüz gökkuşağı kenar bunun onlarca katı; fiziksel değil, sanat yönü kararı.
12. Dispersiyon örneklerini kanal bazında kendi ağırlık toplamına bölün, yoksa örnek sayısını değiştirdiğinizde panelin parlaklığı da kayar ve iki ölçümü kıyaslayamazsınız.
13. SVG filtresinde `color-interpolation-filters="sRGB"` yazmayı unutmayın. Varsayılan `linearRGB`, normal haritasını renk sanıp dönüştürür ve kaymayı sessizce bozar.
14. CSS dispersiyon yapabilir, ama üç `feDisplacementMap` dalı ve üç `feColorMatrix` ile. Yapamadığı şey bakış açısına bağlı terimler: Fresnel, tam iç yansıma ve fiziksel parametreyle sürülen kayma.
15. GPU ms yalnızca `EXT_disjoint_timer_query_webgl2` ile ölçülür ve CSS yolunda karşılığı yoktur. rAF delta'sı filtrenin süresini değil hattın temposunu ölçer; iki sütunu aynı isimle etiketlemek ölçmemekten kötüdür.

Proje iki komutla çalışıyor: `npm test` optik matematiği tarayıcısız doğruluyor, `npm run dev` demoyu açıyor. Adrese `?measure=1` eklerseniz sayfa etkileşimi kapatıp 2376 kare koşuyor ve konsola tek satır JSON bırakıyor; ölçümü aldığım 120 Hz'lik makinede bu yaklaşık yirmi saniye, 60 Hz'lik bir ekranda iki katı. Tablolardaki sayılar tek bir makineden çıktı. Sizde mutlak değerler oynar; oynamaması gereken şey eğimlerin yönü.

Fotoğraftaki o turuncu ve mavi çizgi belki camdan değil, telefon kamerasının kendi yorumundan geliyordu. Emin değilim, olmama da gerek yok: hikâyeyi başlatan şey çizginin doğruluğu değildi. Harflerin kaybolmadığını, sadece yer değiştirdiğini fark ettiren şeydi.

Yazının başında `backdrop-filter`'ı gömmeyeceğimi söylemiştim; sözümü tutuyorum. Bir sonraki projemde nav çubuğu için büyük ihtimalle yine tek satır CSS yazacağım. Shader'a inmenin gerekçesi hız değil, tabloya bakarsanız o iddiayı kurmak zaten zor. Gerekçe kontrol: kayma miktarını bir malzeme sabitinden türetebilmek ve kenarda ne olacağını uydurmak yerine Fresnel'e sorabilmek. Bu, CSS'in eksikliği değil; CSS'in başka bir işi var. 🌈
