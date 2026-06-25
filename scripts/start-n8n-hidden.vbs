Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""C:\dev\n8n-local\scripts\start-n8n.ps1""", 0, False
