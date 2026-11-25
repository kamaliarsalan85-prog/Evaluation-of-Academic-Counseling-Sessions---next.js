# سامانه ارزیابی جلسات مشاوره تحصیلی (PWA)

این پروژه با **Next.js 15 (App Router)**، **TypeScript**، **Prisma ORM** و پایگاه داده **PostgreSQL** پیاده‌سازی شده است.

> **نکته مهم درباره GitHub و GitHub Pages:**  
> شما می‌توانید کل سورس پروژه را بدون مشکل روی **GitHub** قرار دهید تا همیشه نسخه پشتیبان و CI خودکار (`.github/workflows/ci.yml`) داشته باشید؛ اما سرویس **GitHub Pages** فقط فایل‌های استاتیک HTML/JS را اجرا می‌کند و از سرور Node.js و دیتابیس PostgreSQL پشتیبانی نمی‌کند. بنابراین برای بالا آوردن سایت روی اینترنت، پروژه را از طریق GitHub به یک **هاست Node.js / Docker** متصل کنید.

---

## پیش‌نیازهای روی هاست
- **Node.js 20 یا 22** (یا پشتیبانی از **Docker**)
- یک پایگاه داده **PostgreSQL** (مثلاً دیتابیس ابری، Supabase، یا سرویس PostgreSQL کنار پروژه در هاست)

---

## متغیرهای محیطی (Environment Variables)
فایل `.env.example` را مبنا قرار دهید و مقادیر زیر را در پنل هاست یا فایل `.env` سرور تنظیم کنید:

- `DATABASE_URL`: رشته اتصال PostgreSQL
- `DIRECT_URL`: رشته اتصال مستقیم دیتابیس (اختیاری؛ اگر تنظیم نشود هنگام اجرا به‌صورت خودکار برابر `DATABASE_URL` در نظر گرفته می‌شود)
- `AUTH_SECRET`: یک رشته تصادفی امن (حداقل ۳۲ کاراکتر)
- `APP_URL`: آدرس کامل سایت روی هاست شما (مثال: `https://eval.yourdomain.ir`)
- `ADMIN_BOOTSTRAP_SECRET`: (توصیه‌شده) رمز یک‌بارمصرف امنیتی برای ساخت اولین مدیر ارشد در `/admin/setup`
- `NODE_ENV`: `production`
- `ALLOW_EMBEDDED_DEV_POSTGRES`: `false`

---

## روش ۱: استقرار روی هاست‌های متصل به GitHub (لیارا، Render، Railway، Coolify و ...)

### حالت Node.js
1. مخزن GitHub خود را در پنل هاست متصل کنید.
2. متغیرهای محیطی بالا را در تنظیمات هاست وارد نمایید.
3. دستور ساخت (Build Command):
   ```bash
   npm install && npm run build
   ```
4. دستور اجرا (Start Command):
   ```bash
   npm run start
   ```
   اسکریپت اجرایی (`scripts/start-production.mjs`) به‌طور خودکار:
   - در صورت نبود `DIRECT_URL` آن را از `DATABASE_URL` تنظیم می‌کند؛
   - جدول‌های دیتابیس (`prisma migrate deploy`) را هنگام بالا آمدن سرویس اعمال می‌کند؛
   - سرور را روی پورت `PORT` اختصاص‌یافته توسط هاست بالا می‌آورد.

### حالت Docker
فایل `Dockerfile` در ریشه پروژه آماده است و هر هاست مبتنی بر Docker به‌طور خودکار پروژه را ساخته و اجرا می‌کند.

---

## روش ۲: اجرا روی سرور شخصی (VPS) با Docker Compose

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd <REPO_FOLDER>
docker compose up -d --build
```
سرویس PostgreSQL و اپلیکیشن به‌طور خودکار بالا می‌آیند و سلامت سرویس از مسیر `/api/health` قابل بررسی است.

---

## راه‌اندازی اولین مدیر ارشد
پس از بالا آمدن سایت و اتصال دیتابیس، به آدرس زیر بروید و حساب مدیر ارشد (Super Admin) را بسازید:
```text
https://your-domain.com/admin/setup
```
به‌محض ایجاد اولین مدیر ارشد، ثبت‌نام عمومی به‌صورت خودکار قفل می‌شود و مدیریت از مسیر `/admin/login` انجام خواهد شد.
