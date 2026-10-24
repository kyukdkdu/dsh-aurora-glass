# dsh-aurora-glass 开关脚本
#
# 只开关 dsh-aurora-glass 这一个插件，不碰你其它的插件。
# 用法（在 PowerShell 里）：
#     .\tools\dsh-aurora-toggle.ps1 -Action disable
#     .\tools\dsh-aurora-toggle.ps1 -Action enable
#     .\tools\dsh-aurora-toggle.ps1 -Action status
#
# 原理：往 ~/.dsh/profiles/desktop/cordis.patch.yml 里写一条
# `- id: dsh-aurora-glass / disabled: true`，这是 DSH 官方的 loader 字段，
# 只停这一个条目，其它插件照常加载。

param(
  [ValidateSet('disable', 'enable', 'status')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$patchPath = Join-Path $env:USERPROFILE '.dsh\profiles\desktop\cordis.patch.yml'
$marker = '# >>> dsh-aurora-glass toggle >>>'
$block = @"
$marker
- id: dsh-aurora-glass
  disabled: true
# <<< dsh-aurora-glass toggle <<<
"@

if (-not (Test-Path $patchPath)) {
  throw "找不到 profile patch：$patchPath（DSH 没装好，或者 profile 名字不是 desktop）"
}

$text = Get-Content -Path $patchPath -Raw -Encoding UTF8
$hasBlock = $text.Contains($marker)

switch ($Action) {
  'status' {
    if ($hasBlock) { Write-Output 'dsh-aurora-glass 当前：已禁用' }
    else { Write-Output 'dsh-aurora-glass 当前：启用中（patch 里没有禁用块）' }
    Write-Output "patch 文件：$patchPath"
  }
  'disable' {
    if ($hasBlock) { Write-Output '已经是禁用状态，无需重复操作。' }
    else {
      $backup = "$patchPath.bak-$(Get-Date -Format yyyyMMddHHmmss)"
      Copy-Item $patchPath $backup
      Write-Output "已备份原 patch 到：$backup"
      Add-Content -Path $patchPath -Value "`r`n$block" -Encoding UTF8
      Write-Output '已禁用 dsh-aurora-glass。重启 DSH 生效。'
    }
  }
  'enable' {
    if (-not $hasBlock) { Write-Output '本来就是启用状态，无需操作。' }
    else {
      $backup = "$patchPath.bak-$(Get-Date -Format yyyyMMddHHmmss)"
      Copy-Item $patchPath $backup
      $lines = Get-Content -Path $patchPath -Encoding UTF8
      $out = New-Object System.Collections.Generic.List[string]
      $skip = $false
      foreach ($line in $lines) {
        if ($line.Trim() -eq $marker) { $skip = $true; continue }
        if ($line.Trim() -eq '# <<< dsh-aurora-glass toggle <<<') { $skip = $false; continue }
        if (-not $skip) { $out.Add($line) }
      }
      Set-Content -Path $patchPath -Value $out -Encoding UTF8
      Write-Output "已重新启用（原 patch 备份在 $backup）。重启 DSH 生效。"
    }
  }
}
