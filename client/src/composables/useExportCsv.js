export function useExportCsv() {
  function exportToCsv(filename, rows, columns) {
    // columns: array of { key, label }
    // rows: array of objects
    const header = columns.map(c => c.label).join(',')
    const body = rows.map(row =>
      columns.map(c => {
        const val = row[c.key] ?? ''
        // escape commas and quotes
        return typeof val === 'string' && (val.includes(',') || val.includes('"'))
          ? `"${val.replace(/"/g, '""')}"`
          : val
      }).join(',')
    ).join('\n')
    const csv = header + '\n' + body
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return { exportToCsv }
}
