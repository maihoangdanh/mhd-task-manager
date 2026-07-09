# Báo cáo Deploy — deploy-engineer (Task #4)

Ngày: 2026-07-09
Nền tảng: AWS Amplify Hosting (Next.js SSR, free tier)
Trạng thái tổng: **Chuẩn bị local XONG — chờ người dùng thao tác GitHub + AWS Console (không tự động hóa được vì không có credentials/OAuth/network trong môi trường agent).**

---

## A. Phần deploy-engineer ĐÃ LÀM XONG (local)

| # | Việc | Trạng thái | Ghi chú |
|---|------|-----------|---------|
| A1 | Khởi tạo git repo | XONG | Repo đã có sẵn (`git init` trước đó). Nhánh: `master`. |
| A2 | `.gitignore` an toàn | XONG | Đã ignore `.env*`, `/node_modules`, `/.next/`, `*.tsbuildinfo`. Xác minh: `git check-ignore .env.local` → bị ignore. |
| A3 | Commit toàn bộ code | XONG | Commit `1a785e2` — toàn bộ app + `amplify.yml` + docs. **`.env.local` KHÔNG được commit** (đã verify `git diff --cached` không chứa env.local). |
| A4 | Viết `amplify.yml` | XONG | Build spec chuẩn Next.js SSR (xem mục D). |
| A5 | Verify build production local | XONG | `npm run build` PASS — 9 route (7 app route + `/_not-found`). `/tasks/[id]` là **ƒ Dynamic (SSR)** → xác nhận cần adapter SSR, KHÔNG static export. |

**Kết luận local:** code sẵn sàng deploy. `next.config.ts` không có `output: 'export'` → mặc định SSR, đúng cho Amplify.

---

## B. Phần NGƯỜI DÙNG PHẢI TỰ LÀM (checklist)

> Lý do: môi trường agent không có tài khoản GitHub/AWS, không có OAuth, không có mạng ra ngoài. Không thể tự tạo repo hay bấm trong AWS Console thay bạn.

### [ ] B0. (LÀM TRƯỚC TIÊN) Chạy migration SQL trên Supabase
Nếu chưa chạy, app sẽ deploy được nhưng KHÔNG đọc/ghi được dữ liệu (bảng chưa tồn tại).
1. Vào https://supabase.com/dashboard → chọn project `wvudgvdrgoiocalthbsi`.
2. Menu trái → **SQL Editor** → **New query**.
3. Mở file `supabase/migrations/20260709120000_init_schema.sql` trong repo, copy toàn bộ nội dung, dán vào editor.
4. Bấm **Run**. Kỳ vọng: tạo 3 bảng `projects`, `tasks`, `schedule_events` + RLS policy. Không báo lỗi đỏ.
5. Kiểm tra: **Table Editor** → thấy đủ 3 bảng.

### [ ] B1. Tạo repo GitHub và push code
1. Vào https://github.com/new.
2. Repository name: ví dụ `task-manager` (Private hoặc Public đều được).
3. **KHÔNG** tick "Add a README / .gitignore / license" (repo local đã có sẵn) → **Create repository**.
4. GitHub hiện lệnh "push an existing repository". Trong terminal tại `D:\Quan Lieu\Task Manager` chạy (thay `<USERNAME>`):
   ```bash
   git remote add origin https://github.com/<USERNAME>/task-manager.git
   git branch -M main
   git push -u origin main
   ```
   (Nhánh hiện tại là `master`; lệnh `git branch -M main` đổi tên sang `main` cho khớp mặc định GitHub. Nếu muốn giữ `master` thì bỏ dòng đó và push `master`.)
5. Refresh trang GitHub → thấy code. **Xác nhận KHÔNG có file `.env.local` trên GitHub** (phải vắng mặt).

### [ ] B2. Tạo app trên AWS Amplify Console → kết nối repo
1. Đăng nhập https://console.aws.amazon.com/amplify → chọn region gần bạn (ví dụ `ap-southeast-1` Singapore).
2. Bấm **Create new app** (hoặc **New app → Host web app**).
3. Chọn nguồn **GitHub** → **Continue** → ủy quyền (authorize) AWS Amplify truy cập GitHub (chỉ lần đầu, có thể giới hạn đúng repo `task-manager`).
4. Chọn **Repository**: `task-manager`. **Branch**: `main` (hoặc `master` nếu bạn giữ tên cũ) → **Next**.
5. Trang **App settings / Build settings**:
   - Amplify tự nhận diện Next.js. Nó sẽ dùng `amplify.yml` đã có trong repo (không cần dán tay).
   - App name để mặc định hoặc đặt `task-manager`.
   - **CHƯA bấm Save and deploy vội** — sang bước B3 thêm biến môi trường trước (hoặc thêm ngay ở màn "Advanced settings → Environment variables" nếu Console cho phép; nếu không, thêm sau ở App settings rồi Redeploy).

### [ ] B3. Cấu hình biến môi trường (Environment variables)
Vào **App settings → Environment variables → Manage variables → Add variable**, thêm CHÍNH XÁC (phân biệt hoa/thường, không thừa dấu cách):

| Variable (Key) | Value |
|----------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wvudgvdrgoiocalthbsi.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_KNW25n5ia06r411ZJvEFqw_5Z6Jzorc` |

Lưu ý bảo mật:
- Đây đều là `NEXT_PUBLIC_*` → được nhúng vào bundle client-side khi build. Chỉ đặt **anon/publishable key** ở đây (an toàn nhờ RLS). **TUYỆT ĐỐI KHÔNG** đặt `service_role` key vào biến `NEXT_PUBLIC_*`.
- Sau khi thêm biến, bấm **Save**.

### [ ] B4. Deploy
1. Bấm **Save and deploy** (lần đầu) hoặc **Redeploy this version** (nếu đã thêm env var sau khi tạo app).
2. Chờ Amplify chạy 4 giai đoạn: **Provision → Build → Deploy → Verify** (thường 3–7 phút).
3. Build xong → Amplify cấp URL dạng `https://main.<app-id>.amplifyapp.com`.

### [ ] B5. Kiểm tra sau deploy
1. Mở URL → app redirect về `/login` (đúng, vì chưa đăng nhập).
2. Đăng ký / đăng nhập bằng email + mật khẩu (Supabase Auth).
3. Vào `/dashboard`, `/tasks`, `/tasks/new`, `/schedule` → tạo thử 1 task, xác nhận lưu được (data phải load — nếu trắng/lỗi, xem mục C).

### [ ] B6. Điền lại URL production vào báo cáo này
Sau khi có URL, cập nhật ô dưới:

```
URL production: __________________________________ (điền sau khi Amplify deploy xong)
```

---

## C. Khắc phục lỗi thường gặp (nếu B5 lỗi)

| Triệu chứng | Nguyên nhân phổ biến nhất | Cách xử lý |
|-------------|---------------------------|------------|
| Build lỗi trên Amplify nhưng local OK | **Thiếu biến môi trường** (kiểm tra ĐẦU TIÊN) | App settings → Environment variables: xác nhận đủ 2 biến, đúng tên `NEXT_PUBLIC_*`, đúng giá trị. Sửa xong **Redeploy**. |
| Trang trắng / lỗi 500 sau deploy | Biến thiếu tiền tố `NEXT_PUBLIC_` nên không lộ ra client | Xác nhận đúng tên biến có tiền tố. |
| Deploy OK nhưng data không load / lỗi khi tạo task | Chưa chạy migration (B0), hoặc URL/anon key sai project | Chạy lại B0; đối chiếu URL/key khớp project `wvudgvdrgoiocalthbsi`. |
| Đăng nhập được nhưng list rỗng | Bình thường nếu chưa có data — RLS chỉ trả row của chính user | Tạo task mới để kiểm tra ghi. |

Nếu build vẫn lỗi sau khi đã sửa env var: mở tab **Build** trong Amplify, copy log lỗi cụ thể và gửi lại cho leader / deploy-engineer (không đoán mò).

---

## D. amplify.yml đã tạo (tham chiếu)

Đường dẫn: `D:\Quan Lieu\Task Manager\amplify.yml`

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

---

## E. Tóm tắt trạng thái biến môi trường

| Biến | Nơi khai báo | Đã set ở Amplify? |
|------|--------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Amplify env vars (bước build) | [ ] chờ B3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Amplify env vars (bước build) | [ ] chờ B3 |

- Local: cả 2 nằm trong `.env.local` (đã gitignore, dùng cho build local — đã verify build PASS).
- Production: phải nhập tay ở Amplify (B3) — code không chứa key nào.

## F. Kết quả build (local, đã verify)
```
✓ Compiled successfully
Route (app)
┌ ○ /              (Static)
├ ○ /_not-found    (Static)
├ ○ /dashboard     (Static)
├ ○ /login         (Static)
├ ○ /schedule      (Static)
├ ○ /tasks         (Static)
├ ƒ /tasks/[id]    (Dynamic, SSR)
└ ○ /tasks/new     (Static)
```
