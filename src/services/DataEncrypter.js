import CryptoJS from "crypto-js";

// const secretKey = import.meta.env.VITE_SECRET_KEY; // 32 bytes for AES-256
const secretKey = CryptoJS.enc.Hex.parse(
  "a3b62319ba6e4b2fe1edccc65d62c743ed95b1a08332be9e8fcce7c3b6cbd4b9"
); // 32 bytes for AES-256
const iv = CryptoJS.enc.Hex.parse("28db47412fdd1de0210a1f445728605d"); // 16 bytes for AES

const generateKey = (len) => {
  return CryptoJS.lib.WordArray.random(len);
};

// console.log('Secret Key (Hex):', generateKey(32).toString(CryptoJS.enc.Hex));
// console.log('IV (Hex):', generateKey(16).toString(CryptoJS.enc.Hex));

// Encrypt Function
export const encryptData = (plainText) => {
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
