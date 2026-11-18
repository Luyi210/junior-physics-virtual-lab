/** Download an already reviewed local snapshot; this does not upload or mark it as saved. */
export function downloadRecordCopy(json: string, filename: string, canRead: () => boolean) {
  if (!canRead()) throw new Error('学生身份已变化，未导出旧预览，请重新打开本机副本。');
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
  try {
    if (!canRead()) throw new Error('学生身份已变化，未导出旧预览。');
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
