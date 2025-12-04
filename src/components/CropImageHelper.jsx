// cropImageHelper.js
export default function getCroppedImg(imageSrc, croppedAreaPixels) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Set canvas dimensions to match the cropped area
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

      // Create a circular mask (clip-path) for the image
      ctx.beginPath();
      ctx.arc(
        croppedAreaPixels.width / 2,
        croppedAreaPixels.height / 2,
        Math.min(croppedAreaPixels.width, croppedAreaPixels.height) / 2,
        0,
        2 * Math.PI
      );
      ctx.clip();

      // Draw the cropped portion of the image on the canvas
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // Convert canvas to a Blob
      canvas.toBlob((blob) => {
        if (blob) {
          // Convert blob to a File
          const file = new File([blob], "cropped_image.png", { type: "image/png" });
          // console.log(file);
          resolve(file);
        } else {
          reject(new Error("Failed to create Blob from canvas"));
        }
      }, "image/png");
    };

    image.onerror = (error) => reject(error);
  });
}
