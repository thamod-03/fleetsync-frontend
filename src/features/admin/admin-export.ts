export function adminCsv(rows: readonly (readonly string[])[]) {
  return rows.map((row) => row.map((value) => `"${(/^[\s]*[=+@-]/.test(value) ? "'" : '') + value.replaceAll('"', '""')}"`).join(',')).join('\r\n')
}
export function downloadAdminCsv(rows: readonly (readonly string[])[], filename: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + adminCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
