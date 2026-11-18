# ============================================================================
# Saisie des clés du VPS depuis Windows, sans terminal : une fenêtre avec une case par clé.
# Chaque clé reste masquée, part directement au serveur par SSH (entrée standard, jamais en
# argument ni dans un fichier) et n'est écrite que dans /opt/mon50cc/sovereign-core/.env par
# deploy/set-secret.sh. Rien n'est écrit sur le PC. Ne jamais coller ces clés ailleurs.
#
# Lancer par saisir-cles.cmd (double-clic ou ligne de commande), qui lit ce fichier en UTF-8 :
#   saisir-cles.cmd -Groupe stockage      (les 4 clés S3 : preuves + sauvegardes)
#   saisir-cles.cmd -Groupe sms           (les 3 valeurs de la clé d'API SMS)
#   saisir-cles.cmd -Groupe meteo         (clé Météo-France, à refaire avant son expiration)
#   saisir-cles.cmd -Groupe revolut       (secret du webhook Revolut)
#   saisir-cles.cmd -Noms OVH_SMS_SENDER  (n'importe quels noms acceptés par set-secret.sh)
# Prérequis : la clé SSH du PC (ssh ubuntu@… sans mot de passe), comme pour le reste du guide.
# ============================================================================
param(
    [ValidateSet('', 'stockage', 'sms', 'meteo', 'revolut')][string]$Groupe = '',
    [string[]]$Noms = @(),
    [string]$Serveur = 'ubuntu@api.mon50ccetmoi.com'
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$outil = '/opt/mon50cc/sovereign-core/deploy/set-secret.sh'

# Nom (dans .env) → titre, aide, secret (masqué) ou non. Mêmes noms que ALLOWED dans set-secret.sh.
$catalogue = [ordered]@{
    WORM_S3_ACCESS_KEY_ID       = @('PREUVES : clé d''accès (Access key)', 'OVHcloud › Object Storage › Utilisateurs › ligne mon50cc-preuves-serveur', $true)
    WORM_S3_SECRET_ACCESS_KEY   = @('PREUVES : clé secrète (Secret key)', 'même ligne › « … » au bout › « Voir la clé secrète »', $true)
    BACKUP_S3_ACCESS_KEY_ID     = @('SAUVEGARDES : clé d''accès (Access key)', 'OVHcloud › Object Storage › Utilisateurs › ligne mon50cc-sauvegardes-serveur', $true)
    BACKUP_S3_SECRET_ACCESS_KEY = @('SAUVEGARDES : clé secrète (Secret key)', 'même ligne › « … » au bout › « Voir la clé secrète »', $true)
    OVH_SMS_APP_KEY             = @('SMS : Application Key', 'clé créée sur eu.api.ovh.com/createToken (gestionnaire de mots de passe)', $true)
    OVH_SMS_APP_SECRET          = @('SMS : Application Secret', 'même clé d''API SMS', $true)
    OVH_SMS_CONSUMER_KEY        = @('SMS : Consumer Key', 'même clé d''API SMS', $true)
    OVH_SMS_SERVICE             = @('SMS : nom du compte SMS', 'de la forme sms-xx12345-1 (pas secret)', $false)
    OVH_SMS_SENDER              = @('SMS : expéditeur validé', 'seulement une fois validé par OVHcloud, ex. Mon50cc (pas secret)', $false)
    METEO_FRANCE_API_KEY        = @('Clé d''API Météo-France (API Key)', 'portail-api.meteofrance.fr › Vigilance › Utiliser › API Key › Générer Token : bouton Copier, pas de double-clic', $true)
    REVOLUT_WEBHOOK_SECRET      = @('Secret du webhook Revolut', 'Revolut Business › API › Webhooks', $true)
    ACME_EMAIL                  = @('Adresse e-mail du certificat HTTPS', 'une adresse qui reçoit vraiment le courrier (pas secret)', $false)
}
$groupes = @{
    stockage = @('WORM_S3_ACCESS_KEY_ID', 'WORM_S3_SECRET_ACCESS_KEY', 'BACKUP_S3_ACCESS_KEY_ID', 'BACKUP_S3_SECRET_ACCESS_KEY')
    sms      = @('OVH_SMS_APP_KEY', 'OVH_SMS_APP_SECRET', 'OVH_SMS_CONSUMER_KEY')
    meteo    = @('METEO_FRANCE_API_KEY')
    revolut  = @('REVOLUT_WEBHOOK_SECRET')
}

$liste = @()
if ($Groupe) { $liste += $groupes[$Groupe] }
foreach ($n in $Noms) { foreach ($m in ($n -split ',')) { if ($m.Trim()) { $liste += $m.Trim() } } }
$liste = @($liste | Select-Object -Unique)
$inconnus = @($liste | Where-Object { -not $catalogue.Contains($_) })
if ($liste.Count -eq 0 -or $inconnus.Count -gt 0) {
    $msg = if ($inconnus.Count) { "Nom inconnu : $($inconnus -join ', ')`n`n" } else { '' }
    [System.Windows.Forms.MessageBox]::Show("$($msg)Usage : saisir-cles.cmd -Groupe stockage|sms|meteo|revolut`nou : saisir-cles.cmd -Noms NOM1,NOM2`n`nNoms acceptés : $($catalogue.Keys -join ', ')", 'Saisie des clés', 'OK', 'Information') | Out-Null
    exit 1
}

# Garde seulement la valeur utile. Retourne '' (vide), la valeur, ou un message d'erreur commençant par « ✗ ».
function Test-Valeur([string]$nom, [string]$texte) {
    $t = ($texte -replace "[`r`n`t]", ' ' -replace "[﻿​‌‍⁠]", '').Trim()
    if (-not $t) { return '' }
    if ($t -match '\s') {
        # Toute une ligne de tableau copiée (OVHcloud) : on garde la seule clé de 32 caractères hexadécimaux.
        $hex = [regex]::Matches($t, '(?<![0-9A-Za-z])[0-9a-fA-F]{32}(?![0-9A-Za-z])')
        if ($hex.Count -eq 1) { $t = $hex[0].Value } else { return '✗ copiez seulement la clé (sans espace)' }
    }
    if ($t -match '[^\x21-\x7E]') { return '✗ caractère accentué ou invisible : recopiez' }
    if ($t -match '["''$#\\`]') { return '✗ caractère refusé (" '' $ # \ `)' }
    if ($t.StartsWith('eyJ') -and ([regex]::Matches($t, '\.').Count -ne 2)) { return '✗ clé INCOMPLÈTE : copiez-la en entier' }
    if ($nom -eq 'ACME_EMAIL' -and $t -notmatch '^[^@]+@[^@]+\.[^@]+$') { return '✗ ce n''est pas une adresse e-mail' }
    if ($nom -eq 'OVH_SMS_SERVICE' -and $t -notmatch '^sms-[a-z0-9]+-\d+$') { return '✗ attendu : sms-xx12345-1' }
    return $t
}

# Envoie une valeur à set-secret.sh par l'entrée standard de ssh, en octets ASCII bruts.
# .NET écrit d'office le BOM de Console.InputEncoding à l'ouverture de l'entrée du processus :
# on prend un encodage sans BOM (set-secret.sh le retirerait de toute façon).
function Send-Cle([string]$nom, [string]$valeur) {
    try { [Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false } catch { }
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'ssh.exe'
    $psi.Arguments = "-o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new $Serveur `"sudo $outil $nom`""
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
    try { $p = [System.Diagnostics.Process]::Start($psi) } catch { return @{ Code = 255; Texte = "ssh introuvable : $($_.Exception.Message)" } }
    $octets = [System.Text.Encoding]::ASCII.GetBytes($valeur + "`n")
    $p.StandardInput.BaseStream.Write($octets, 0, $octets.Length)
    $p.StandardInput.BaseStream.Flush()
    $p.StandardInput.Close()
    $sortie = $p.StandardOutput.ReadToEnd() + $p.StandardError.ReadToEnd()
    $p.WaitForExit()
    [Array]::Clear($octets, 0, $octets.Length)
    return @{ Code = $p.ExitCode; Texte = $sortie.Trim() }
}

$hauteur = 90 + 98 * $liste.Count + 60
$ecran = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Clés pour le serveur'
$form.StartPosition = 'Manual'
$form.TopMost = $true
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$form.ClientSize = New-Object System.Drawing.Size(640, $hauteur)
$form.Location = New-Object System.Drawing.Point($ecran.X, [Math]::Max($ecran.Y, $ecran.Bottom - $hauteur - 40))

$intro = New-Object System.Windows.Forms.Label
$intro.Location = New-Object System.Drawing.Point(16, 12)
$intro.Size = New-Object System.Drawing.Size(610, 66)
$intro.Text = "Pour chaque case : copiez la valeur (Ctrl+C), cliquez dans la case et faites Ctrl+V. Les clés secrètes restent cachées (des points), c'est normal. Un ✓ vert s'affiche quand la valeur est reconnue. Ne collez ces clés nulle part ailleurs."
$form.Controls.Add($intro)

$boites = @(); $etats = @()
$y = 86
for ($i = 0; $i -lt $liste.Count; $i++) {
    $info = $catalogue[$liste[$i]]
    $titre = New-Object System.Windows.Forms.Label
    $titre.Location = New-Object System.Drawing.Point(16, $y)
    $titre.Size = New-Object System.Drawing.Size(610, 22)
    $titre.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
    $titre.Text = "$($i + 1). $($info[0])"
    $form.Controls.Add($titre)
    $aide = New-Object System.Windows.Forms.Label
    $aide.Location = New-Object System.Drawing.Point(16, ($y + 22))
    $aide.Size = New-Object System.Drawing.Size(610, 20)
    $aide.ForeColor = [System.Drawing.Color]::DimGray
    $aide.Font = New-Object System.Drawing.Font('Segoe UI', 9)
    $aide.Text = $info[1]
    $form.Controls.Add($aide)
    $boite = New-Object System.Windows.Forms.TextBox
    $boite.Location = New-Object System.Drawing.Point(16, ($y + 44))
    $boite.Size = New-Object System.Drawing.Size(330, 26)
    $boite.MaxLength = 8000
    $boite.UseSystemPasswordChar = [bool]$info[2]
    $form.Controls.Add($boite); $boites += $boite
    $etat = New-Object System.Windows.Forms.Label
    $etat.Location = New-Object System.Drawing.Point(356, ($y + 47))
    $etat.Size = New-Object System.Drawing.Size(270, 22)
    $etat.Text = 'vide'; $etat.ForeColor = [System.Drawing.Color]::DimGray
    $form.Controls.Add($etat); $etats += $etat
    $y += 98
}

$bouton = New-Object System.Windows.Forms.Button
$bouton.Location = New-Object System.Drawing.Point(16, ($y + 4))
$bouton.Size = New-Object System.Drawing.Size(300, 36)
$bouton.Text = 'Enregistrer sur le serveur'
$bouton.Enabled = $false
$form.Controls.Add($bouton)

$valeurs = New-Object string[] $liste.Count
$verifier = {
    $tousOk = $true
    for ($i = 0; $i -lt $liste.Count; $i++) {
        $r = Test-Valeur $liste[$i] $boites[$i].Text
        if ($r -eq '') { $etats[$i].Text = 'vide'; $etats[$i].ForeColor = [System.Drawing.Color]::DimGray; $valeurs[$i] = ''; $tousOk = $false }
        elseif ($r.StartsWith('✗')) { $etats[$i].Text = $r; $etats[$i].ForeColor = [System.Drawing.Color]::Firebrick; $valeurs[$i] = ''; $tousOk = $false }
        else { $etats[$i].Text = "✓ reconnue ($($r.Length) caractères)"; $etats[$i].ForeColor = [System.Drawing.Color]::Green; $valeurs[$i] = $r }
    }
    # Une clé secrète identique à une clé d'accès : c'est la même valeur collée deux fois.
    for ($i = 0; $i -lt $liste.Count; $i++) {
        for ($j = 0; $j -lt $i; $j++) {
            if ($valeurs[$i] -and $valeurs[$i] -eq $valeurs[$j]) {
                $etats[$i].Text = "✗ identique à la case $($j + 1)"; $etats[$i].ForeColor = [System.Drawing.Color]::Firebrick; $tousOk = $false
            }
        }
    }
    $bouton.Enabled = $tousOk
}
foreach ($b in $boites) { $b.Add_TextChanged($verifier) }

$bouton.Add_Click({
    $bouton.Enabled = $false
    $form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor
    $erreurs = @()
    for ($i = 0; $i -lt $liste.Count; $i++) {
        $r = Send-Cle $liste[$i] $valeurs[$i]
        if ($r.Code -ne 0) { $erreurs += "$($i + 1). $($catalogue[$liste[$i]][0]) : $($r.Texte)" }
    }
    $form.Cursor = [System.Windows.Forms.Cursors]::Default
    if ($erreurs.Count -eq 0) {
        foreach ($b in $boites) { $b.Clear() }
        for ($i = 0; $i -lt $liste.Count; $i++) { $valeurs[$i] = '' }
        [System.Windows.Forms.MessageBox]::Show($form, "Enregistré sur le serveur ($($liste.Count) valeur(s)).`n`nPour que l'API les prenne en compte :`ncd /opt/mon50cc/sovereign-core && sudo docker compose -f docker-compose.vps.yml up -d", 'Terminé', 'OK', 'Information') | Out-Null
        $form.Close()
    } else {
        [System.Windows.Forms.MessageBox]::Show($form, "Pas enregistré :`n`n$($erreurs -join "`n")", 'Problème', 'OK', 'Warning') | Out-Null
        $bouton.Enabled = $true
    }
})

[void]$form.ShowDialog()
