# PR İncelemesi — Teknik Tasarım Notu v0.1

İnceleyen: ürün · Tarih: 29 Eylül 2026 · Karar: **Değişiklik isteğiyle onay** (aşağıdaki maddeler işlenince birleştirilebilir)

Genel: Not, PRD'nin niyetini doğru okumuş; stack seçimi, Edge Function üzerinden Google çağrıları, gün bazlı rota matrisi ve anonim oturumla misafir üyeliği onaylandı. Aşağıda her T maddesi için ürün kararı var. "PRD'ye işlenir" denilen maddeler PRD v0.2'ye girecek.

## Onaylananlar (değişiklik yok)

- iOS'ta da `PROVIDER_GOOGLE`, EAS development build. Gerekçe (Google verisi Google haritasında) doğru.
- Tüm Places/Routes çağrıları Edge Function'dan; istemcide yalnızca Maps SDK ve Autocomplete.
- Route Matrix gün bazlı; 3.5 tempo paneli kestirimle (kuş uçuşu × 1,3 ÷ 4,5 km/sa). **PRD 3.5 KK5'e "kestirim" ibaresi eklenir.**
- Misafir = Supabase anonim oturum + `join_trip` RPC + RLS `is_member`. `linkIdentity` ile aynı cihazda birleştirme.
- `/r/{token}` haritasız, OG meta etiketli ilk açılış.
- Veri modeli eklemeleri: `trips.tz`, `stops.trip_id`, kesirli sıra anahtarı, `days.order_manual`, `changes` tetikleyiciyle. **PRD §8 buna göre güncellenir.**
- CI: PR'da tsc + ESLint + Jest; `schedule/` modülü birim testli.

## Kararlar (T1–T11)

**T1 · Google önbellek kuralı.** Geliştirici haklı: `place_id` süresiz, enlem/boylam ≤ 30 gün; ad, puan ve saatler için 30 gün izni yok. **Karar:** veritabanında yalnızca `place_id`, `lat`, `lng`, `primary_type` (kalınacak süre varsayılanı için) ve kullanıcının girdiği veriler tutulur. Ad, puan, saat ekranda canlı çekilir; hafif Details sonuçları istemci belleğinde 24 saat, sunucu tarafında (Edge Function) 24 saat önbelleklenir. Liste ekranları için tek istekte toplu hafif Details RPC'si yazılır. PRD §7 ve §8 düzeltilir; pg_cron tazeleme işi gerekmez.

**T2 · "Detay çağrısı yalnızca 3.8'de".** Kural şu şekilde değişir: seçimde ve listelerde **hafif Details** (`id,location,displayName,primaryType,timeZone,rating,userRatingCount,currentOpeningHours.openNow`); **tam Details** (yorumlar, fotoğraflar, tüm saatler) yalnızca 3.8'de. PRD 3.8 KK6 ve §7 güncellenir.

**T3 · Maliyet.** 0,05 $ hedefi gerçekçi değildi. **Karar:** v1 hedefi kullanıcı başına ayda ≤ 0,50 $; gün bazlı matris ve önbellekle ölçülür, Sprint 3 sonunda gerçek maliyetle yeniden değerlendirilir. Kapsam §6 düzeltilir.

**T4 · Saat dilimi ve tarihsiz seyahat.** `trips.tz` seyahat şehrinin dilimi; "bugün", mini-çubuk ve 08:00 bildirimi bu dilimde. Tarihsiz seyahatte açılış saati kontrolü **yapılmaz**; kart yalnızca "Pzt kapalı" gibi haftalık bilgi gösterir. Tarih girildiğinde kontrol devreye girer. PRD 3.7 KK5'e eklenir.

**T5 · Tempo formülü.** Otele dönüş yürüyüşü formüle dahildir: `Σ kalınacak süre + Σ yürüyüş (otel→ilk … son→otel)`. Son gün için `days.end_time` dönüş saatiyle elle düşürülür; ayrı "dönüş saati" alanı yok. PRD §5.3 düzeltilir.

**T6 · Mini-çubuk.** "Yürüyüş başladı" = önceki durakta *Vardık* işaretlendikten sonra o durağın süresi dolduğunda **ya da** kullanıcı *Yol tarifi*'ne bastığında. KK8 formülü: `now − arrived_at > minutes + 10 dk`. Görünürlük PRD'ye göre (3.1 ve 3.7); kanvasta başka ekranda görünüyorsa kanvas hatalı. PRD §5.4 netleştirilir.

**T7 · Otomatik sıra × elle sıralama.** `order_manual=false` iken her durak eklemede §5.1 yeniden çalışır; kullanıcı bir kez sürükledi mi `order_manual=true`, sonraki duraklar en ucuz ekleme noktasına girer. "En kısa rotaya diz" düğmesi `order_manual`'ı sıfırlar. PRD 3.7 KK2'ye eklenir.

**T8 · Link çözme ve çip tipleri.** Booking linki v2; v1 yalnızca Google Maps linkleri (`maps.app.goo.gl`, `google.com/maps/...`). Çip tipleri Places (New) tip listesine göre: Popüler `tourist_attraction`; Yemek `restaurant`; Sanat `museum, art_gallery`; Manzara `park, tourist_attraction` (`viewpoint`/`scenic_point` kaldırıldı, geçerli tip değilse). Geliştirici geçerli tip listesini doğrulayıp PRD 3.4 KK4'ü düzeltsin.

**T9 · Sprint planı.** 0.3 ve v1 Profil (ad, kullanıcı adı, çıkış, hesap silme) Sprint 1'e eklenir (+1,5 gün → ≈ 14 gün). Analitik olayları ilgili ekranın sprintinde. Sprint 1'de iskelet kalan KK'ler (3.1 KK1, KK4; 3.3 KK5) bağlı oldukları sprintte kabul edilir — bu kural PRD §12'ye yazılır.

**T10 · Açık sorular.** Ürün kararı bekliyor (aşağıda, Ece'nin onayına).

**T11 · "Vardık" kimin için?** v1'de **seyahat düzeyinde** (grup birlikte hareket eder): herhangi bir üye işaretler, herkeste görünür, `stops.arrived_at` + `arrived_by`. Kişi bazlı ilerleme v2. PRD 3.7 KK7 güncellenir.

## Ürün sahibinin karar vermesi gereken 3 madde (T10)

1. Giriş yöntemi: **öneri** v1'de Apple + Google; telefon OTP v2 (rehber eşleşmesi zaten v2).
2. Misafir birleştirme: **öneri** aynı cihazda `linkIdentity` yeterli; farklı cihaz v2.
3. Gün bitişi varsayılanı: **öneri** 20:00 (19:00 akşam yemeğini "Yoğun" gösteriyor, 21:00 günü fazla uzun sayıyor). Kullanıcı seyahat ayarından değiştirir.

## Birleştirme koşulu

- T1, T2, T5, T7, T8, T11 kararları notta güncellensin; PR'daki ilgili yorumlar "çözüldü" işaretlensin.
- PRD v0.2 ürün tarafından yazılır (bu kararlarla), aynı PR'a ya da ayrı PR'a girer.
- Sprint 1 tahmini 14 güne çekilsin.
