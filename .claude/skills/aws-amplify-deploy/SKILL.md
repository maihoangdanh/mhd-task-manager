---
name: aws-amplify-deploy
description: "Quy trình triển khai ứng dụng Next.js lên AWS Amplify Hosting: cấu hình build spec, biến môi trường, CI/CD tự động khi push code. Dùng khi cần deploy, cấu hình production, hoặc khắc phục lỗi build/deploy trên AWS cho ứng dụng Next.js."
---

# Deploy Next.js lên AWS Amplify Hosting

## Vì sao chọn Amplify Hosting thay vì tự dựng S3+CloudFront+Lambda

Next.js cần server-side rendering (SSR) và API routes, S3 chỉ phục vụ static file nên không chạy được SSR nếu không tự dựng thêm Lambda@Edge phức tạp. **AWS Amplify Hosting hỗ trợ Next.js SSR built-in**, tự động nhận diện framework, có free tier (1000 phút build + 15GB lưu trữ + 15GB truyền tải/tháng) — phù hợp nhất cho dự án cá nhân muốn deploy nhanh lên AWS mà không tự quản lý hạ tầng.

## Các bước triển khai

1. **Kết nối repository**: Trong AWS Amplify Console → "New app" → "Host web app" → kết nối GitHub/GitLab repo chứa project
2. **Build settings**: Amplify tự phát hiện Next.js và sinh `amplify.yml` mặc định. Nếu cần tùy chỉnh:

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
```

3. **Biến môi trường**: Vào App settings → Environment variables, thêm:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Biến bắt đầu bằng `NEXT_PUBLIC_` sẽ lộ ra bundle client-side — CHỈ đặt anon key (được thiết kế để public, an toàn nhờ RLS) vào đây, tuyệt đối không đặt `service_role` key.

4. **Deploy**: Amplify tự động build + deploy mỗi khi push lên nhánh đã kết nối (CI/CD có sẵn, không cần tự cấu hình GitHub Actions).

## Khắc phục lỗi thường gặp

| Triệu chứng | Nguyên nhân phổ biến nhất | Cách kiểm tra |
|------------|---------------------------|----------------|
| Build lỗi trên Amplify nhưng chạy local OK | Thiếu biến môi trường trên Amplify Console | Kiểm tra Environment variables trước, không đoán nguyên nhân khác |
| Trang trắng/lỗi 500 sau deploy | Biến env thiếu tiền tố `NEXT_PUBLIC_` nên không lộ ra client | Xác nhận đúng tên biến và tiền tố |
| Deploy thành công nhưng data không load | RLS chặn vì chưa đăng nhập, hoặc anon key sai project | Kiểm tra Supabase project URL/key khớp với project thật |

## Sau khi deploy thành công

Ghi URL production + danh sách biến môi trường đã cấu hình vào `_workspace/04_deploy-engineer_deploy-report.md`.
