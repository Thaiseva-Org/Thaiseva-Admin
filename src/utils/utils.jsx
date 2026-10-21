import { Grid } from "@mui/material";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { storage } from "../firebase/firebase.config";

// calculating discount price
const calculateDiscountPrice = (price, percent) => {
  const discount = (parseFloat(percent) / 100) * parseFloat(price);
  const discountPrice = parseFloat(price) - discount;
  return discountPrice.toFixed(2);
};

// getting the ago time based on the booking time

function timeAgo(date) {
  const currentDate = new Date();
  const timestamp = new Date(date);
  const timeDifference = currentDate - timestamp;
  const minutes = Math.floor(timeDifference / 60000); // 1 minute = 60,000 milliseconds
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) {
    return "Just now";
  } else if (minutes === 1) {
    return "1 min ago";
  } else if (minutes < 60) {
    return minutes + " mins ago";
  } else if (hours === 1) {
    return "1 hour ago";
  } else if (hours < 24) {
    return hours + " hours ago";
  } else if (days === 1) {
    return "1 day ago";
  } else {
    return days + " days ago";
  }
}

function getDateAndTime(timestamp) {
  if (!timestamp) return "N/A";
  let date;
  if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) return "Invalid Date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getDate(timestamp) {
  if (!timestamp) return "N/A";
  let date;
  if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) return "Invalid Date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function updateDynamicTimeDisplay(initialDate) {
  const time = timeAgo(initialDate);

  return time;
}

const successNotification = (text) => {
  return alert(text);
  // return Swal.fire({
  //   position: "bottom-end",
  //   icon: "success",
  //   title: text,
  //   showConfirmButton: false,
  //   timer: 1500,
  // });
};

const errorNotification = (text) => {
  return alert(text);
};

const askingForDelete = () => {
  // if (confirm("Are you sure? You won't be able to revert this!")){
  //   return
  // }
  return new Promise((resolve) => {
    const isConfirmed = confirm(
      "Are you sure? You won't be able to revert this!"
    );
    resolve({ isConfirmed: isConfirmed });
  });
  // return Swal.fire({
  //   title: "Are you sure?",
  //   text: "You won't be able to revert this!",
  //   icon: "warning",
  //   showCancelButton: true,
  //   confirmButtonColor: "blue",
  //   cancelButtonColor: "#d33",
  //   confirmButtonText: "Yes, delete it!",
  // });
};

const askingForUpdate = (text) => {
  return new Promise((resolve) => {
    const isConfirmed = confirm(`Are you sure? ${text}`);
    resolve({ isConfirmed: isConfirmed });
  });
  // return Swal.fire({
  //   title: "Are you sure?",
  //   // text: "You are changing the logo!",
  //   text: text,
  //   icon: "warning",
  //   showCancelButton: true,
  //   confirmButtonColor: "blue",
  //   cancelButtonColor: "#d33",
  //   confirmButtonText: "Yes, Change it!",
  // });
};

const deleteNotification = (text) => {
  return alert(text);
  // return Swal.fire("Deleted!", text, "success");
};

const UpdateNotification = (text) => {
  return alert(text);
  // return Swal.fire("Updated!", text, "success");
};

const simpleNotification = (text) => {
  return alert(text);
  // return Swal.fire({
  //   title: text,
  //   showCancelButton: false, // Hide the cancel button
  //   confirmButtonText: "OK",
  //   confirmButtonColor: "blue",
  // });
};

// const formatPhoneNumber = (value) => {
//   // Remove all non-numeric characters
//   let cleaned = value.replace(/\D/g, "");

//   // Limit to 9 digits
//   cleaned = cleaned.slice(0, 9);

//   // Apply spacing format: XX XXX XXXX
//   let formatted = cleaned;
//   if (cleaned.length > 2)
//     formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
//   if (cleaned.length > 5)
//     formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(
//       5
//     )}`;

//   return formatted;
// };
const formatPhoneNumber = (value) => {
  // Remove all non-numeric characters
  let cleaned = value.replace(/\D/g, "");

  // Limit to 10 digits
  cleaned = cleaned.slice(0, 10);

  // Apply spacing format: XXX XXX XXXX
  let formatted = cleaned;
  if (cleaned.length > 3)
    formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  if (cleaned.length > 6)
    formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(
      6
    )}`;

  return formatted;
};

// custom text field for common data
const item = (label, value, is12) => {
  return (
    <Grid item xs={12} sm={is12 ? 12 : 6}>
      <p className="">
        <span className="font-bold">{label}: </span>
        <span className="text-slate-600"> {value}</span>
      </p>
    </Grid>
  );
};

// Public catalog images default to admin-managed media. Personal documents and
// partner profile images must select their owner-scoped folder explicitly.
function imageUploadPath(folder) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error("Sign in before uploading a file.");
  if (folder === "private") return `users/${uid}/files/${crypto.randomUUID()}`;
  if (folder === "partner") return `partners/${uid}/media/${crypto.randomUUID()}`;
  return `images/${crypto.randomUUID()}`;
}

const getFileUrl = async (files, folder = "catalog") => {
  const allowedExtensions = ["jpg", "jpeg", "png"];
  let err = "";
  let url = "";

  const file = files[0];
  const fileExt = file?.name?.split(".").pop();
  const isValidFile = allowedExtensions.includes(fileExt);

  if (!isValidFile) {
    err = "Allowed file extensions jpg, jpeg, png";
    return { error: true, message: err };
  }

  if (folder === "driver-licence") {
    if (file.size > 8 * 1024 * 1024) return {error: true, message: "Licence must be under 8 MB."};
    const contentBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("Unable to read the licence file."));
      reader.readAsDataURL(file);
    });
    const upload = httpsCallable(getFunctions(undefined, "asia-east2"), "uploadDriverDocument");
    const {data} = await upload({contentBase64, contentType: fileExt === "png" ? "image/png" : "image/jpeg"});
    return {error: false, url: data.path};
  }

  const fileRef = ref(storage, imageUploadPath(folder));
  //  // Uploading the file image to storage
  const fileTask = await uploadBytesResumable(fileRef, file);

  // Get the download URL
  const photoURL = await getDownloadURL(fileTask.ref);

  if (photoURL) {
    url = photoURL;
  }

  return { error: false, url };
};

const deleteFile = async (url) => {
  const pathMatch = url.match(/\/o\/(.*?)\?/);
  if (!pathMatch || pathMatch.length < 2) {
    console.error("Invalid URL");
    return;
  }

  const encodedPath = pathMatch[1];
  const filePath = decodeURIComponent(encodedPath);

  const fileRef = ref(storage, filePath);

  try {
    await deleteObject(fileRef);
    // console.log("File deleted successfully");
  } catch (error) {
    console.error("Error deleting file:", error);
  }
};

const uploadFileUrl = async (file, folder = "catalog") => {
  const allowedExtensions = ["jpg", "jpeg", "png"];
  let err = "";
  let url = "";

  // const file = files[0];
  const fileExt = file?.name?.split(".")[1];
  const isValidFile = allowedExtensions.includes(fileExt);

  if (!isValidFile) {
    err = "Allowed file extensions jpg, jpeg, png";
    return { error: true, message: err };
  }

  const fileRef = ref(storage, imageUploadPath(folder));
  //  // Uploading the file image to storage
  const fileTask = await uploadBytesResumable(fileRef, file);

  // Get the download URL
  const photoURL = await getDownloadURL(fileTask.ref);

  if (photoURL) {
    url = photoURL;
  }

  return { error: false, url };
};

function calculateTimeAgo(timestamp) {
  const currentTimestamp = new Date();
  const firestoreTimestamp = new Date(
    timestamp?.seconds * 1000 + timestamp?.nanoseconds / 1000000
  ); // Convert Firestore timestamp to JavaScript Date
  // console.log(currentTimestamp, firestoreTimestamp);
  const timeDifference = currentTimestamp - firestoreTimestamp;
  // console.log(timeDifference);
  const minutes = Math.floor(timeDifference / 60000); // 1 minute = 60,000 milliseconds
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) {
    return "Just now";
  } else if (minutes === 1) {
    return "1 min ago";
  } else if (minutes < 60) {
    return minutes + " mins ago";
  } else if (hours === 1) {
    return "1 hour ago";
  } else if (hours < 24) {
    return hours + " hours ago";
  } else if (days === 1) {
    return "1 day ago";
  } else {
    return days + " days ago";
  }
}

const handleRedirectWhatsApp = (phoneNumber) => {
  const stringNum = String(phoneNumber).replace(/\s+/g, "");
  let numWithCode = "";
  const haveCountryCode = stringNum.startsWith(66);
  if (!haveCountryCode) {
    numWithCode = stringNum;
  }

  const url = `https://wa.me/${numWithCode}?text=${encodeURIComponent(
    "Hello, I am contacting you via ThaiSeva."
  )}`;
  window.open(url, "_blank");
  // window.location.href = url;
};

const amountCalculator = (array) => {
  let total = array?.reduce((total, current) => total + current, 0);

  return total;
};

const dateCalculator = (timestamp) => {
  const seconds = new Date(timestamp?.seconds * 1000);
  const date = seconds.toLocaleDateString();

  return date;
};

const timeCalculator = (timestamp) => {
  const seconds = new Date(timestamp?.seconds * 1000);
  const time = seconds?.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return time;
};

export {
  formatPhoneNumber,
  calculateDiscountPrice,
  updateDynamicTimeDisplay,
  successNotification,
  errorNotification,
  askingForDelete,
  askingForUpdate,
  deleteNotification,
  UpdateNotification,
  simpleNotification,
  item,
  getFileUrl,
  deleteFile,
  calculateTimeAgo,
  amountCalculator,
  handleRedirectWhatsApp,
  dateCalculator,
  timeCalculator,
  uploadFileUrl,
  getDateAndTime,
  getDate,
};
