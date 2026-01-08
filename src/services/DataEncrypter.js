import CryptoJS from "crypto-js";

// Use environment variables for keys, falling back to empty string (or handle error) if missing
// Note: Client-side encryption keys are visible in the build, but this removes them from the source code.
const secretKey = CryptoJS.enc.Hex.parse(
  import.meta.env.VITE_SECRET_KEY || ""
);
const iv = CryptoJS.enc.Hex.parse(import.meta.env.VITE_IV_KEY || "");

const generateKey = (len) => {
  return CryptoJS.lib.WordArray.random(len);
};

// console.log('Secret Key (Hex):', generateKey(32).toString(CryptoJS.enc.Hex));
// console.log('IV (Hex):', generateKey(16).toString(CryptoJS.enc.Hex));

// Encrypt Function
export const encryptData = (plainText) => {
  if (!import.meta.env.VITE_SECRET_KEY || !import.meta.env.VITE_IV_KEY) {
    console.error("Encryption keys are missing!");
    return plainText;
  }
  const encrypted = CryptoJS.AES.encrypt(
    plainText,
    CryptoJS.enc.Utf8.parse(secretKey),
    {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  );
  return encrypted.toString();
};

// Decrypt Function
export const decryptData = (encryptedData) => {
  if (!import.meta.env.VITE_SECRET_KEY || !import.meta.env.VITE_IV_KEY) {
    console.error("Encryption keys are missing!");
    return "";
  }
  const decrypted = CryptoJS.AES.decrypt(
    encryptedData,
    CryptoJS.enc.Utf8.parse(secretKey),
    {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  );
  return decrypted.toString(CryptoJS.enc.Utf8);
};
