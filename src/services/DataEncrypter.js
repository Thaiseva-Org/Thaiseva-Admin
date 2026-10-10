// Service secrets must never be encrypted or decrypted in the browser.
export const encryptData = () => { throw new Error("Use server-managed credentials."); };
export const decryptData = () => { throw new Error("Use server-managed credentials."); };
