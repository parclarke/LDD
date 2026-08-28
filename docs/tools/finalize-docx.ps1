# Opens each .docx in Word, refreshes the table of contents, saves and reports stats.
param([Parameter(Mandatory = $true)][string]$Dir)

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
  foreach ($f in Get-ChildItem -Path $Dir -Filter *.docx | Sort-Object Length) {
    try {
      $sw = [Diagnostics.Stopwatch]::StartNew()
      $doc = $word.Documents.Open($f.FullName)
      if ($doc.TablesOfContents.Count -gt 0) { $doc.TablesOfContents.Item(1).Update() | Out-Null }
      $doc.Save()
      $pages = $doc.ComputeStatistics(2)
      $words = $doc.ComputeStatistics(0)
      $tables = $doc.Tables.Count
      $tocEntries = if ($doc.TablesOfContents.Count -gt 0) {
        $doc.TablesOfContents.Item(1).Range.Paragraphs.Count
      } else { 0 }
      $doc.Close($false)
      $sw.Stop()
      "OK    {0,-44} {1,4} pages {2,7} words {3,4} tables {4,4} toc entries ({5:n0}s)" -f `
        $f.BaseName, $pages, $words, $tables, $tocEntries, $sw.Elapsed.TotalSeconds
    }
    catch {
      "FAIL  {0,-44} {1}" -f $f.BaseName, ($_.Exception.Message -replace "`r?`n", ' ')
    }
  }
}
finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
