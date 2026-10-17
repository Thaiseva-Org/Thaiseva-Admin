import { getFunctions, httpsCallable } from "firebase/functions";

export async function uploadPrivateChatFile(file, chatId, contentType = file.type) {
  if (!file || file.size > 8 * 1024 * 1024) throw new Error("Choose a file up to 8 MiB.");
  const encoded = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const upload = httpsCallable(getFunctions(undefined, "asia-east2"), "uploadPrivateChatAttachment");
  const { data } = await upload({ collection: "chats", chatId, contentType: contentType || "audio/webm", contentBase64: encoded });
  return data.path;
}
