; Custom uninstaller step (included by electron-builder from build/installer.nsh).
; On a real uninstall (not an update), asks whether to also delete the user's data: CV, job postings, settings, API key
; and downloaded models (%APPDATA%\ReCV). "No" is the default, and the answer in silent mode.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Supprimer aussi vos données Re:CV ?$\r$\n$\r$\nVotre CV, vos annonces, vos réglages, votre clé personnelle et les modèles téléchargés (plusieurs Go) seront effacés de cet ordinateur.$\r$\n$\r$\nChoisissez Non pour les garder en vue d'une réinstallation. Les CV que vous avez téléchargés ne sont jamais touchés." /SD IDNO IDNO keepData
      RMDir /r "$APPDATA\ReCV"
    keepData:
  ${endIf}
!macroend
