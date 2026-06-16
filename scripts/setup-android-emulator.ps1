# Configuration emulateur Android (AMD Ryzen) - lancer en administrateur
# Erreur 4294967201 = virtualisation BIOS desactivee OU conflit Hyper-V

$ErrorActionPreference = "Continue"
$SdkRoot = "$env:LOCALAPPDATA\Android\Sdk"
$Driver = Join-Path $SdkRoot "extras\google\Android_Emulator_Hypervisor_Driver\silent_install.bat"

Write-Host "=== Diagnostic ===" -ForegroundColor Cyan
systeminfo | Select-String "Virtualisation|Hyper-V"
Get-CimInstance Win32_Processor | Select-Object Name, VirtualizationFirmwareEnabled

$virtEnabled = (Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled
if (-not $virtEnabled) {
  Write-Host ""
  Write-Host "PROBLEME PRINCIPAL: SVM/AMD-V desactive dans le BIOS." -ForegroundColor Red
  Write-Host "Aucun pilote ne fonctionnera tant que ce n'est pas corrige."
  Write-Host ""
  Write-Host "Actions BIOS (Ryzen 5800X):" -ForegroundColor Yellow
  Write-Host "  1. Redemarrer > Del/F2 pour entrer dans le BIOS"
  Write-Host "  2. Chercher: CPU Configuration / Advanced > SVM Mode (ou AMD-V)"
  Write-Host "  3. Mettre sur Enabled"
  Write-Host "  4. Sauvegarder (F10) et redemarrer"
  Write-Host "  5. Relancer ce script en administrateur"
  Write-Host ""
  exit 1
}

Write-Host "`nVirtualisation BIOS: OK" -ForegroundColor Green

# Sur AMD, AEHD fonctionne mieux avec Hyper-V desactive
Write-Host "`n[1/3] Desactivation Hyper-V (recommande pour AMD + AEHD)..."
dism.exe /online /disable-feature /featurename:Microsoft-Hyper-V-All /norestart 2>$null
dism.exe /online /disable-feature /featurename:HypervisorPlatform /norestart 2>$null
dism.exe /online /disable-feature /featurename:VirtualMachinePlatform /norestart 2>$null
bcdedit /set hypervisorlaunchtype off 2>$null

if (Test-Path $Driver) {
  Write-Host "[2/3] Installation pilote AEHD (AMD)..."
  & cmd.exe /c "`"$Driver`""
} else {
  Write-Host "Pilote introuvable. Installez via Android Studio > SDK Manager > Android Emulator Hypervisor Driver" -ForegroundColor Yellow
}

Write-Host "[3/3] Verification..."
Start-Sleep -Seconds 2
sc.exe query aehd
& "$SdkRoot\emulator\emulator.exe" -accel-check 2>&1

Write-Host "`nRedemarrez le PC, puis lancez:" -ForegroundColor Cyan
Write-Host "  & `"$SdkRoot\emulator\emulator.exe`" -avd Expo_Pixel -no-metrics"
