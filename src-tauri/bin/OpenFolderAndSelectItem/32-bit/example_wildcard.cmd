@echo off
title Example of using wildcard
echo.
echo. Calling:
echo. OpenFolderAndSelect "%windir%\system32\*.exe"
echo.
echo. Wildcard support is affected by WoW64 Redirection.
echo. Please don't use 32-bit version on 64-bit Windows.
echo.
start OpenFolderAndSelect "%windir%\system32\*.exe"
pause
exit/b
