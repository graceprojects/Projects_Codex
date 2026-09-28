#!/bin/zsh
cd "${0:A:h}" || exit 1
PYTHON="$(command -v python3)"
if [[ -z "$PYTHON" ]]; then
  echo "Не найден Python 3. Установите Python 3 и запустите снова."
  exit 1
fi
echo "Bashkent Heaven — локальная рабочая версия"
echo "Откройте http://localhost:8080"
echo "Для остановки нажмите Ctrl+C или закройте окно."
"$PYTHON" -m http.server 8080 --bind 127.0.0.1 --directory site
