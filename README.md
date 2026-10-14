# Kompass

Mühendislik yöneticileri için yerel çalışan masaüstü uygulaması. Uygulama artık
**Node.js + Electron + React/TypeScript** ile çalışır. Rust veya Cargo kurulumu gerekmez.

Kişiler, işler, konular, notlar ve görseller; etiketler, hatırlatıcılar, yapılacaklar,
arşiv, arama ve haftalık Markdown özetleri aynı yerel SQLite veritabanında saklanır.
Claude ve OpenAI bağlantıları isteğe bağlıdır.

## Geliştirme

Node.js **24.7 veya üstü** ve npm kurulu olmalıdır.

```bash
npm ci
npm run dev
```

Bu komut Vite ile birlikte Electron masaüstü penceresini açar. Arayüz değişiklikleri
anında yenilenir; `electron/` içindeki Node servislerini değiştirince komutu yeniden
başlatın. Electron ilk çalıştırmada kendi çalışma zamanını indirir.

Derlenmiş uygulamayı çalıştırmak için:

```bash
npm run build
npm start
```

`npm run dev:renderer` yalnızca arayüz geliştirme sunucusunu açar. Kalıcı veritabanı,
yedekleme ve LLM servisleri Electron içindeki Node sürecinde çalıştığı için uygulamayı
kullanmak için `npm run dev` veya `npm start` çalıştırın.

## Kısayollar

- `Cmd/Ctrl+N`: Hızlı Not.
- `Cmd/Ctrl+Shift+N`: Uygulama arka plandayken de Hızlı Not açar.
- `Cmd/Ctrl+K`: Komut paleti.
- `Cmd/Ctrl+F`: Arama.
- `Cmd/Ctrl+1…4`: Bugün, Notlar, Kişiler, İşler.
- Hızlı Not'ta `Enter` kaydeder, `Shift+Enter` yeni satır açar. `Vazgeç` dışındaki
  kapatmalar, pencere odağının kaybolması ve normal uygulama kapanışı notu kaydeder.
  Kayıt başarısızsa normal kapanış durdurulur ve taslak açık kalır.

## Veri ve yedek uyumluluğu

Önceki kurulumun uygulama kimliği ve `leadership.db` dosyası korunur. macOS'ta veri
klasörü `~/Library/Application Support/com.dailyleadership.tool` olarak kalır;
Linux'ta `$XDG_CONFIG_HOME/com.dailyleadership.tool` (varsayılan `~/.config`),
Windows'ta `%APPDATA%/com.dailyleadership.tool` kullanılır. Mevcut veritabanı ilk
başlatmada açılır ve gerekli şema geçişleri uygulanır.

Ayarlar ekranından dışa/içe aktarılan şifreli `.kompass` yedeklerinin KMPS v1 biçimi
korunmuştur. Arşiv kayıtları, görseller, LLM ayarları ve varsa API anahtarları da
yedeklenir. Yanlış parola veya bozuk bir yedek mevcut verileri değiştirmez. Geri
yükleme yarıda kesilirse sonraki başlatmada önceki dosyalar geri alınır.

Test veya ayrı bir veri klasörü için `KOMPASS_DATA_DIR` ortam değişkenini belirtin.
Normal kullanımda buna gerek yoktur. API anahtarları önceki sürümde olduğu gibi
uygulamanın yerel yapılandırma dosyalarında saklanır; yeni yazılan dosyalar yalnızca
kullanıcı erişimiyle oluşturulur.

LLM sağlayıcısı, model adı ve şirket içi API taban adresi Ayarlar'dan seçilir.
Taban adresindeki path prefix korunur; Claude için `/v1/messages`, OpenAI için
`/v1/chat/completions` sonuna eklenir. İstekler Node tarafından gönderilir;
API anahtarları arayüze geri verilmez. Kurumsal CA sertifikası gerektiğinde Node'un
`NODE_EXTRA_CA_CERTS` ortam değişkeni kullanılabilir.

## Test ve paketleme

```bash
npm test
npm run test:desktop
npm run dist:dir
npm run dist
```

`test:desktop`, geçici bir veri klasöründe gerçek Electron penceresi açarak IPC,
SQLite, şifreli yedek geri yükleme ve kapanırken not kaydetmeyi test eder. Masaüstü
oturumu gerektirir ve kullanıcı veritabanını kullanmaz.

`dist:dir` kurulabilir uygulama klasörünü; `dist` ise işletim sistemine uygun
kurulum paketini `release/` altında oluşturur. macOS için DMG/ZIP, Windows için
NSIS, Linux için AppImage/DEB hedefleri tanımlıdır. İmzalı macOS dağıtımı için
Apple Developer imzalama/notarizasyon yapılandırması ayrıca gerekir.

Node servisleri `electron/`, ortak veri işlemleri `src/db/`, React arayüzü `src/`
altındadır. Electron'un sandbox ve context isolation ayarları açıktır. Arayüz,
sınırlı IPC işlemleriyle Node servislerine erişir; SQL veya dosya sistemi erişimi
arayüze açılmaz.
