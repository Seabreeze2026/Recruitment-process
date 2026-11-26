# İşə qəbul platforması (Recruitment process)

İR əməkdaşları üçün vakansiya, namizəd, müsahibə və performans platforması.

- **Sayt (üz tərəfi):** GitHub Pages — bu repo.
- **Baza:** Google Sheet (`DB_` ilə başlayan vərəqlər).
- **Arxa tərəf:** Google Apps Script (`apps-script/Platforma.gs`). Sayt məlumatları bu API vasitəsilə Sheet-ə yazır.
- **Giriş:** istifadəçi adı və parolla (Google hesabı tələb olunmur).

## İmkanlar

| Bölmə | Nə edir |
|---|---|
| Panel | Bugünkü müsahibələr, nəticəsi yazılmayan müsahibələr, cavab gözləyən təkliflər, bitən sınaq müddətləri, son tarixi keçən vakansiyalar |
| Vakansiyalar | ID, şirkət, bölmə, rəhbər, say, ə/h aralığı, çətinlik, prioritet, son tarix; status: Açıq / Dayandırılıb / Bağlandı / Ləğv edildi (dayandırılmış günlər hesablamaya daxil edilmir) |
| Namizədlər | Ortaq baza, telefon və email ilə dublikat yoxlaması, CV linki, mənbə |
| Mərhələ lövhəsi | Müraciət → İlkin söhbət → Müsahibə → Tapşırıq → Final → Təklif → İşə qəbul / İmtina; hər mərhələdə keçən gün |
| Müsahibələr | Siyahı və həftəlik təqvim, eyni vaxtda iki müsahibə olanda xəbərdarlıq |
| Qiymətləndirmə kartı | 1–5 izahlı şkala, vakansiya üçün minimum bal. Struktur rəhbəri **linklə** qiymətləndirir (giriş tələb olunmur). Hamı təhvil verənə qədər digərlərinin qiymətləri gizlidir |
| Təklif və sınaq müddəti | Təklif tarixi, məbləğ, cavab, imtina səbəbi; 3 aylıq sınaq müddətinin nəticəsi |
| Rəhbər məmnuniyyəti | Vakansiya bağlananda rəhbərə 1 sualdan ibarət link göndərilir |
| Performans | P1–P8 göstəriciləri, çəkilər və hədəflər admin tərəfindən dəyişdirilə bilir; iş həcmi, namizəd axını, mənbələr, imtina səbəbləri, 6 aylıq dinamika |
| Admin | İstifadəçilər (müvəqqəti parol, sıfırlama), siyahılar, performans parametrləri, dəyişiklik tarixçəsi |
| Excel-ə ixrac | Vakansiyalar, namizədlər, müsahibələr, performans |

### Performans göstəriciləri

| # | Göstərici | Çəki |
|---|---|---|
| P1 | Vaxtında bağlanma faizi | 20% |
| P2 | Orta bağlanma müddəti (hədəf çətinliyə görə: 20 / 30 / 45 gün) | 15% |
| P3 | Təklifin qəbul faizi | 15% |
| P4 | Sınaq müddətini keçmə faizi | 15% |
| P5 | Rəhbər məmnuniyyəti | 10% |
| P6 | Gəlməmə faizi (az olsa yaxşıdır) | 10% |
| P7 | Məlumatın vaxtında daxil edilməsi | 10% |
| P8 | Bağlama faizi | 5% |

Dövrdə məlumatı olmayan göstəricinin çəkisi digərlərinə bölünür. Məlumat azdırsa, bal hesablanmır.

---

## Quraşdırma (bir dəfəlik, ~10 dəqiqə)

### 1. Apps Script kodunu Sheet-ə əlavə edin
1. `İşə_qəbul_qeydiyyat_sistemi` cədvəlini açın → **Extensions → Apps Script**.
2. Sol tərəfdə **+ → Script** basın, faylın adını `Platforma` qoyun.
3. Bu repodakı `apps-script/Platforma.gs` faylının bütün məzmununu ora yapışdırın və **Save** basın.
   > Köhnə menyu kodu olduğu kimi qalır, ona toxunmayın.
4. **Project Settings** (dişli çarx) → Time zone: **(GMT+04:00) Baku**.

### 2. Bazanı yaradın
1. Yuxarıdakı funksiya siyahısından **`platformaQur`** seçin → **Run**.
2. Google icazə istəyəcək: **Review permissions → hesabınız → Advanced → Go to … (unsafe) → Allow**. Bu sizin öz skriptinizdir.
3. **Execution log**-da admin üçün müvəqqəti parol göstəriləcək:
   ```
   Admin istifadəçi adı: admin
   Müvəqqəti parol: ••••••••••
   ```
   Parolu qeyd edin.
4. *(İstəyə bağlı)* Köhnə məlumatları köçürmək üçün **`kohneMelumatlariKocur`** funksiyasını işə salın.

### 3. API-ni yayımlayın
1. **Deploy → New deployment** → növ: **Web app**.
2. *Execute as:* **Me**, *Who has access:* **Anyone**.
3. **Deploy** → **Web app URL**-i kopyalayın (`https://script.google.com/macros/s/…/exec`).
4. Bu URL-i `assets/config.js` faylına yazın (və ya Claude-a göndərin):
   ```js
   window.APP_CONFIG = { API_URL: 'https://script.google.com/macros/s/…/exec' };
   ```

### 4. Saytı açın
1. GitHub-da bu repo → **Settings → Pages**.
2. *Source:* **Deploy from a branch**, *Branch:* **main**, qovluq: **/ (root)** → **Save**.
3. 1–2 dəqiqədən sonra sayt bu ünvanda açılacaq: **https://seabreeze2026.github.io/recruitment-process/**
4. `admin` və müvəqqəti parolla daxil olun, yeni parol təyin edin.
5. **Admin → İstifadəçilər** bölməsində recruiterləri əlavə edin. Hər biri üçün göstərilən müvəqqəti parolu onlara ötürün.

---

## Təhlükəsizlik

- Parollar Sheet-də açıq yazılmır, yalnız şifrələnmiş (salt + SHA-256) formada saxlanılır.
- 5 səhv cəhddən sonra hesab 15 dəqiqəlik bloklanır. Sessiya 6 saat davam edir.
- Recruiter yalnız öz vakansiyalarını görür və dəyişir. Admin hamısını görür.
- **Google Sheet-i recruiterlərlə paylaşmayın.** Sheet yalnız sahibində və adminlərdə qalmalıdır.
- Repoda heç bir parol və ya gizli açar yoxdur. API ünvanı açıq olsa da, girişsiz heç bir məlumat qaytarmır.
- Rəhbər linkləri təsadüfi uzun tokendir, 30 gün etibarlıdır və bir dəfə istifadə olunur.

## Yeniləmə

- **Arxa tərəf** (`Platforma.gs`) dəyişəndə: kodu Apps Script-də yeniləyin → **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. Bu halda URL dəyişmir.
- **Sayt** (HTML, JS, CSS) dəyişəndə: GitHub-a push etmək kifayətdir.
- Admin parolu unudulubsa: Apps Script-də `adminParolunuSifirla` funksiyasını işə salın.

## Testlər (developer üçün)

```bash
node tests/backend.test.js      # arxa tərəfin 45 avtomatik testi (Sheet simulyasiyası ilə)
node tests/server.js            # lokal sınaq: http://localhost:8080/?api=/api  (admin / Admin2026)
python3 tests/ui_test.py        # brauzer testi (Playwright)
```

## Struktur

```
index.html            əsas tətbiq
evaluate.html         rəhbərin linklə açdığı qiymətləndirmə səhifəsi
assets/config.js      API ünvanı
assets/api.js         API ilə əlaqə
assets/app.js         tətbiqin interfeysi
assets/evaluate.js    qiymətləndirmə səhifəsi
assets/style.css      dizayn
apps-script/          Google Apps Script kodu (Sheet-ə əlavə olunur)
tests/                avtomatik testlər və lokal server
```
