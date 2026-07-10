'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import RequireAuth from '@/components/RequireAuth'

// user_metadata có kiểu index `any` từ supabase-js — đọc an toàn thành string (không dùng `any`).
function readStringMeta(
  meta: { [key: string]: unknown } | undefined,
  key: string,
): string {
  const v = meta?.[key]
  return typeof v === 'string' ? v : ''
}

function SettingsInner() {
  const { user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const initialized = useRef(false)

  // Prefill 1 lần khi user sẵn sàng (không ghi đè khi đang chỉnh dở).
  useEffect(() => {
    if (!user || initialized.current) return
    setFullName(readStringMeta(user.user_metadata, 'full_name'))
    setAvatarUrl(readStringMeta(user.user_metadata, 'avatar_url'))
    initialized.current = true
  }, [user])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setError(null)
    setSuccess(null)
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      // Path bắt buộc bắt đầu bằng `${user.id}/` để khớp RLS bucket avatars.
      const path = `${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // Cache-buster: path cố định (upsert) nên thêm ?t= để ảnh mới hiện ngay.
      setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải ảnh lên thất bại')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setSuccess(null)
    setSaving(true)
    try {
      const { error: updErr } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim(), avatar_url: avatarUrl },
      })
      if (updErr) throw updErr
      setSuccess('Đã lưu thay đổi.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  const initial = (fullName.trim() || user?.email || '?').charAt(0).toUpperCase()

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-indigo-950">Cài đặt</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cập nhật tên hiển thị và ảnh đại diện của bạn.
        </p>
      </div>

      <form onSubmit={handleSave} className="card flex flex-col gap-5 p-6">
        {/* Ảnh đại diện */}
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Ảnh đại diện"
              className="h-20 w-20 rounded-full object-cover ring-2 ring-indigo-100"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-2xl font-bold text-white shadow-sm">
              {initial}
            </span>
          )}
          <div>
            <label className="btn btn-ghost cursor-pointer">
              {uploading ? 'Đang tải…' : 'Chọn ảnh'}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <p className="mt-1.5 text-xs text-slate-400">PNG, JPG hoặc WEBP.</p>
          </div>
        </div>

        {/* Email (chỉ đọc) */}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600">Email</span>
          <input
            type="email"
            value={user?.email ?? ''}
            readOnly
            disabled
            className="input cursor-not-allowed bg-slate-50 text-slate-500"
          />
        </label>

        {/* Tên hiển thị */}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600">Tên hiển thị</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nhập tên hiển thị"
            className="input"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
        )}
        {success && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || uploading}
          className="btn btn-primary mt-1 self-start"
        >
          {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
      </form>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsInner />
    </RequireAuth>
  )
}
