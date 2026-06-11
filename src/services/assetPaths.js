const RAW_BASE_URL = import.meta.env.BASE_URL || '/'
const NORMALIZED_BASE_URL = RAW_BASE_URL.endsWith('/') ? RAW_BASE_URL : `${RAW_BASE_URL}/`

function normalizeAssetPath(path) {
  return String(path || '').replace(/^\/+/, '')
}

export function assetUrl(path) {
  return `${NORMALIZED_BASE_URL}${normalizeAssetPath(path)}`
}

export function gltfModelUrl(path) {
  return `url(${assetUrl(path)})`
}
