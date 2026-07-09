<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Harness: Task Manager (Task & Schedule)

**Mục tiêu:** Xây và duy trì ứng dụng web quản lý công việc/lịch trình cá nhân — Next.js + Supabase (Postgres, free) + AWS Amplify Hosting.

**Trigger:** Khi có yêu cầu liên quan đến xây dựng, thêm tính năng, sửa schema, sửa UI, hoặc deploy ứng dụng task manager này, dùng skill `task-manager-build`. Câu hỏi đơn giản có thể trả lời trực tiếp.

**Lịch sử thay đổi:**
| Ngày | Nội dung thay đổi | Mục tiêu | Lý do |
|------|-----------------|----------|-------|
| 2026-07-09 | Cấu hình ban đầu — 4 agent (db-architect, frontend-developer, qa-inspector, deploy-engineer) + 4 skill + orchestrator | Toàn bộ | Xây harness cho dự án task manager mới, stack: Next.js + Supabase + AWS Amplify |

