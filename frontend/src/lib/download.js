import { api } from './api'

export async function download(path, params, fallback = 'download') {
  const response = await api.raw(path, params)
  const match = /filename="?([^"]+)"?/.exec(response.headers.get('content-disposition') ?? '')
  const href = URL.createObjectURL(await response.blob())
  const a = Object.assign(document.createElement('a'), { href, download: match?.[1] ?? fallback })
  a.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
