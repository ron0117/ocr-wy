param(
    [Parameter(Mandatory = $true)]
    [string]$Server,

    [string]$User = "root",
    [string]$RemoteDir = "/opt/ocr-wy",
    [int]$Port = 22,
    [string]$IdentityFile = ""
)

$ErrorActionPreference = "Stop"
if ($Server -notmatch '^[A-Za-z0-9.:-]+$') { throw "Server 格式不正确" }
if ($User -notmatch '^[A-Za-z0-9._-]+$') { throw "User 格式不正确" }
if ($RemoteDir -notmatch '^/[A-Za-z0-9._/-]+$') { throw "RemoteDir 必须是安全的绝对路径" }
$ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Archive = Join-Path ([System.IO.Path]::GetTempPath()) ("ocr-wy-{0}.tar.gz" -f [guid]::NewGuid().ToString("N"))
$RemoteArchive = "/tmp/ocr-wy-deploy.tar.gz"
$Target = "${User}@${Server}"

$SshArgs = @("-p", "$Port", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=120", "-o", "TCPKeepAlive=yes")
$ScpArgs = @("-P", "$Port", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=120", "-o", "TCPKeepAlive=yes")
if ($IdentityFile) {
    $KeyPath = (Resolve-Path $IdentityFile).Path
    $SshArgs += @("-i", $KeyPath)
    $ScpArgs += @("-i", $KeyPath)
}

try {
    Write-Host "正在打包项目..."
    $TarExcludeFile = Join-Path $ProjectDir "deploy/public-cos-excludes.txt"
    $TarArgs = @(
        "-czf", $Archive,
        "--exclude=.git",
        "--exclude=node_modules",
        "--exclude=*/node_modules",
        "--exclude=*/dist",
        "--exclude=.env",
        "--exclude=.env.production",
        "--exclude=/data",
        "--exclude=docs"
    )
    if (Test-Path -LiteralPath $TarExcludeFile) {
        Get-Content -LiteralPath $TarExcludeFile -Encoding UTF8 | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#")) {
                $TarArgs += "--exclude=$line"
            }
        }
    } else {
        Write-Warning "未找到 deploy/public-cos-excludes.txt，COS 媒体仍会打进部署包。可执行 pnpm upload:public-cos"
    }
    $TarArgs += "-C", $ProjectDir, "."
    & tar @TarArgs
    if ($LASTEXITCODE -ne 0) { throw "项目打包失败" }

    Write-Host "正在上传到 $Target ..."
    & scp @ScpArgs $Archive "${Target}:${RemoteArchive}"
    if ($LASTEXITCODE -ne 0) { throw "上传失败" }

    $RemoteCommand = "mkdir -p '$RemoteDir' && if [ -f '$RemoteDir/.env.production' ]; then cp '$RemoteDir/.env.production' /tmp/ocr-wy.env.production; fi && find '$RemoteDir' -mindepth 1 -maxdepth 1 -exec rm -rf {} + && if [ -f /tmp/ocr-wy.env.production ]; then mv /tmp/ocr-wy.env.production '$RemoteDir/.env.production'; fi && tar -xzf '$RemoteArchive' -C '$RemoteDir' && rm -f '$RemoteArchive' && cd '$RemoteDir' && bash deploy/bootstrap-centos.sh"
    Write-Host "正在远程部署..."
    & ssh @SshArgs $Target $RemoteCommand
    if ($LASTEXITCODE -ne 0) { throw "远程部署失败" }
} finally {
    Remove-Item -LiteralPath $Archive -Force -ErrorAction SilentlyContinue
}
