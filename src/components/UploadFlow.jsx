export function makeUploadPreview(file) {
  if (!file) return "";
  try {
    return URL.createObjectURL(file);
  } catch (error) {
    return "";
  }
}

export function makePendingUploadMemory(file, index) {
  const id = "pending-" + Date.now() + "-" + index + "-" + Math.random().toString(36).slice(2);
  const url = makeUploadPreview(file);
  return {
    id,
    title: file && file.name ? file.name : "UPLOADING",
    name: file && file.name ? file.name : "UPLOADING",
    fileName: file && file.name ? file.name : "UPLOADING",
    kind: file && file.type && file.type.startsWith("video/") ? "video" : "photo",
    mimeType: file && file.type ? file.type : "",
    size: file && file.size ? file.size : 0,
    url,
    previewUrl: url,
    storageUrl: url,
    date: new Date().toISOString(),
    uploadPending: true,
  };
}
