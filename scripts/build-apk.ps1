# Builds the release APK.
#   powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
#
# Windows stops a path at 260 characters, and the native C++ build of
# react-native-reanimated repeats the project path twice in its object paths,
# so a build from a long folder (or one with spaces) fails. This script mirrors
# the project to a short scratch folder, builds there, and copies the APK to
# dist-apk\ssc-cgl-pyq.apk here.
#
# Needs JDK 17 and the Android SDK under C:\Users\<you>\Android (see README),
# and the signing properties in ~/.gradle/gradle.properties.
param([string]$Scratch = 'C:\a\p')
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$android = Join-Path $env:USERPROFILE 'Android'

$env:JAVA_HOME = (Get-ChildItem $android -Directory -Filter 'jdk-17*' | Select-Object -First 1).FullName
$env:ANDROID_HOME = Join-Path $android 'Sdk'
$env:NODE_ENV = 'production'

# /MIR keeps the scratch copy in step. Exclusions are full paths: a bare name
# like "dist" would also drop node_modules\*\dist, which the bundler needs.
$skip = '.git', 'dist', 'dist-apk', 'data\raw', '.expo', 'android\app\build', 'android\build', 'android\.gradle' |
  ForEach-Object { Join-Path $project $_ }
robocopy $project $Scratch /MIR /NFL /NDL /NJH /NJS /NP /XD @skip | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }

# Native build caches record absolute paths, so any copied from another
# folder would build against that folder. Start them fresh every time.
$caches = @('android\build', 'android\app\build', 'android\app\.cxx', 'android\.gradle') | ForEach-Object { Join-Path $Scratch $_ }
$caches += Get-ChildItem (Join-Path $Scratch 'node_modules') -Directory |
  ForEach-Object { Join-Path $_.FullName 'android\build'; Join-Path $_.FullName 'android\.cxx' }
$caches += Get-ChildItem (Join-Path $Scratch 'node_modules\@*') -Directory -ErrorAction SilentlyContinue |
  ForEach-Object { Get-ChildItem $_.FullName -Directory } |
  ForEach-Object { Join-Path $_.FullName 'android\build'; Join-Path $_.FullName 'android\.cxx' }
$caches | Where-Object { Test-Path $_ } | ForEach-Object { Remove-Item $_ -Recurse -Force }

# Some generated object paths pass 300 characters even from C:\a\p. They need
# Windows long paths switched on (LongPathsEnabled, see README) and the ninja
# shipped with CMake 3.31+, the first that is long-path aware.
$cmake = Get-ChildItem (Join-Path $env:ANDROID_HOME 'cmake') -Directory -Filter '3.31*' | Sort-Object Name | Select-Object -Last 1
if (-not $cmake) { throw 'Install CMake 3.31: sdkmanager "cmake;3.31.6"' }
$longPaths = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -ErrorAction SilentlyContinue).LongPathsEnabled
if ($longPaths -ne 1) { Write-Warning 'Windows long paths are off; the native build will fail on long object paths.' }
$props = "sdk.dir=$($env:ANDROID_HOME -replace '\\', '\\')`ncmake.dir=$($cmake.FullName -replace '\\', '\\')`n"
Set-Content (Join-Path $Scratch 'android\local.properties') $props -Encoding ascii

Push-Location (Join-Path $Scratch 'android')
try {
  .\gradlew.bat assembleRelease '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a' --console=plain
  if ($LASTEXITCODE -ne 0) { throw "gradle failed ($LASTEXITCODE)" }
} finally { Pop-Location }

$out = Join-Path $project 'dist-apk'
New-Item -ItemType Directory -Force $out | Out-Null
Copy-Item (Join-Path $Scratch 'android\app\build\outputs\apk\release\app-release.apk') (Join-Path $out 'ssc-cgl-pyq.apk') -Force
Get-Item (Join-Path $out 'ssc-cgl-pyq.apk') | Select-Object FullName, Length
