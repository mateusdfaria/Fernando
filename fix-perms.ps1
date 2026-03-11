$path = "C:\Users\mateus.si\Downloads\Fernando-servidor.ppk"
$acl = Get-Acl $path
$acl.SetAccessRuleProtection($true, $false)
$acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) }
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule("mateus.si", "FullControl", "Allow")
$acl.AddAccessRule($rule)
Set-Acl -Path $path -AclObject $acl
Write-Host "Permissions fixed for $path"
