import {getFunctions, httpsCallable} from "firebase/functions";
import {getBlob, ref} from "firebase/storage";
import {app, storage} from "../firebase/firebase.config";

const invoke = httpsCallable(getFunctions(app, "asia-east2"), "customerChat");
export async function customerChatApi(action, data = {}) {
  const response = await invoke({...data, action});
  return response.data;
}

export async function uploadCustomerChatFile(customerId, file) {
  if (file.size > 8 * 1024 * 1024) throw new Error("Attachments must be 8 MiB or smaller.");
  const contentBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read attachment."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  });
  return customerChatApi("upload", {
    customerId,
    name: file.name,
    contentType: file.type,
    contentBase64,
  });
}

export async function downloadCustomerChatFile(customerId, attachmentId) {
  const result = await customerChatApi("download", {
    customerId,
    attachmentId,
  });
  const blob =
    result.downloadTransport === "firebase-authenticated"
      ? await getBlob(ref(storage, `gs://${result.bucket}/${result.storagePath}`))
      : new Blob([Uint8Array.from(atob(result.contentBase64), (char) => char.charCodeAt(0))], {
          type: result.contentType,
        });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
