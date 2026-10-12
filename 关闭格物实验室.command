#!/bin/zsh

PROJECT_DIR=${0:A:h}
cd "$PROJECT_DIR" || exit 1
node scripts/stop-platform.mjs

if (( $? != 0 )); then
  echo
  echo "关闭没有完整完成，请查看上面的提示。"
  echo "按任意键关闭窗口。"
  read -k 1
fi
