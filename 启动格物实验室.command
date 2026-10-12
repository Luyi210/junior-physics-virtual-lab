#!/bin/zsh

PROJECT_DIR=${0:A:h}
cd "$PROJECT_DIR" || exit 1
clear
node scripts/start-platform.mjs
STATUS=$?

if (( STATUS != 0 )); then
  echo
  echo "启动没有完成，请保留这个窗口并查看上面的中文提示。"
  echo "按任意键关闭窗口。"
  read -k 1
fi

exit $STATUS
