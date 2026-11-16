# Cuts the game screenshots (docs/screenshots, 1360x720, made by `npm run smoke`) into the pieces the deck uses.
# Usage: powershell -ExecutionPolicy Bypass -File docs/presentation/crop_shots.ps1
Add-Type -AssemblyName System.Drawing
$shots = Join-Path $PSScriptRoot '..\screenshots'
$out = Join-Path $PSScriptRoot 'img'
New-Item -ItemType Directory -Force $out | Out-Null
$crops = @(
  @('01_menu.png',           'menu.png',      170,  0,  810, 720),
  @('16_battle_effects.png', 'board.png',     436, 66,  366, 474),
  @('16_battle_effects.png', 'hand.png',      335, 543, 562, 167),
  @('16_battle_effects.png', 'ai_panel.png', 1008, 40,  338, 492),
  @('02_campaign_map.png',   'map.png',       359, 74,  642, 366),
  @('17_ai_explainer.png',   'explainer.png', 338, 43,  684, 633)
)
foreach ($c in $crops) {
  $src = [System.Drawing.Bitmap]::FromFile((Join-Path $shots $c[0]))
  $rect = New-Object System.Drawing.Rectangle($c[2], $c[3], $c[4], $c[5])
  $dst = $src.Clone($rect, $src.PixelFormat)
  $dst.Save((Join-Path $out $c[1]), [System.Drawing.Imaging.ImageFormat]::Png)
  $dst.Dispose(); $src.Dispose()
  Write-Output ("{0} -> img/{1} ({2}x{3})" -f $c[0], $c[1], $c[4], $c[5])
}
