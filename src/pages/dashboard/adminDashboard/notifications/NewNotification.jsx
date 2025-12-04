import {
  SendRounded,
  FileUploadRounded,
  ChangeCircleRounded,
} from "@mui/icons-material";
import NotificationCard from "../../../../components/NotificationCard";
import PageHeading from "../../../../components/PageHeading";
import {
  TextField,
  Button,
  DialogContentText,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import React, { useState, useCallback, useEffect } from "react";
import { uploadFileUrl } from "../../../../utils/utils";
import Cropper from "react-easy-crop";
import getCroppedImg from "../../../../components/CropImageHelper";
import {
  fetchNotifications,
  addNotification,
} from "../../../../services/Notification";

const NewNotficationsScreen = () => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [img, setImg] = useState(null);
  const [preview, setPreview] = useState(false);
  const [refetch, setRefetch] = useState(true);
  const [error, setError] = useState({ for: "", text: "" });
  const [loading, setLoading] = useState({ for: "", status: false });
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);

  useEffect(() => {
    fetchNotifications(setNotifications);
  }, [refetch]);

  const handleUploadImage = async (e) => {
    const file = e.target.files[0];

    var idxDot = file.name.lastIndexOf(".") + 1;
    var extFile = file.name.substr(idxDot, file.name.length).toLowerCase();
    if (extFile == "jpg" || extFile == "jpeg" || extFile == "png") {
      setError({ for: "", text: "" });
      setLoading({ for: "image", status: true });
      const objectUrl = URL.createObjectURL(file);
      setImg(objectUrl);
      setLoading({ for: "image", status: false });
    } else {
      alert("Only jpg/jpeg and png files are allowed!");
    }
  };

  const onCropChange = (crop) => {
    setCrop(crop);
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleExport = async () => {
    try {
      const croppedImgUrl = await getCroppedImg(img, croppedAreaPixels);
      const previewUrl = croppedImgUrl;
      // console.log(previewUrl);
      setCroppedImage(previewUrl);
    } catch (e) {
      console.error("Crop failed", e);
    }
  };

  const onZoomChange = (zoom) => {
    setZoom(zoom);
  };

  const onClosePreview = () => {
    setPreview(false);
  };

  const showPreview = async (e) => {
    e.preventDefault();
    if (title === null || title === "") {
      setError({ for: "title", text: "Title is required" });
      return;
    }
    if (message === null || message === "") {
      setError({ for: "message", text: "Message is required" });
      return;
    }
    await handleExport();
    setPreview(true);
    setError({ for: "", text: "" });
  };

  const sendNotification = async (e) => {
    e.preventDefault();
    setLoading({ for: "send", status: true });
    const imagefile = await uploadFileUrl(croppedImage);

    await addNotification(title, message, imagefile.url)
      .then(() => {
        setTitle("");
        setMessage("");
        setImg(null);
        setCroppedImage(null);
        setLoading({ for: "", status: false });
        setPreview(false);
        setRefetch((p) => p);
      })
      .catch((err) => {
        console.log(err);
        setLoading({ for: "send", status: false });
      });
  };

  return (
    <div className="">
      <Dialog
        open={preview || (loading.for === "send" && loading.status)}
        onClose={onClosePreview}
        fullWidth
      >
        <DialogTitle>Notification Preview</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <div className="flex items-center gap-4">
              <NotificationCard
                notification={{
                  title,
                  message,
                  imageUrl: croppedImage
                    ? URL.createObjectURL(croppedImage)
                    : "",
                  datetime: new Date().toISOString(),
                }}
                length={true}
              />
            </div>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClosePreview}>Cancel</Button>
          {loading.for === "send" && loading.status ? (
            <div>Sending...</div>
          ) : (
            <Button onClick={sendNotification}>Send</Button>
          )}
        </DialogActions>
      </Dialog>
      <PageHeading text="Manage Notifications" />
      <div>
        <div className="rounded p-2 flex flex-col gap-8 lg:gap-4">
          <div className="w-full banner-layout h-fit">
            <div className="banner-section-title">Send Notification</div>
            <div className=" rounded p-2">
              <form className="flex gap-4 max-lg:flex-col">
                <div className="w-full flex max-md:flex-col flex-col gap-4">
                  <TextField
                    value={title}
                    error={error.for === "title"}
                    helperText={error.for === "title" && error.text}
                    label="Primary Heading"
                    fullWidth
                    autoComplete="off"
                    onChange={(e) => setTitle(e.target.value)}
                    InputProps={{
                      sx: { fontWeight: "bold" },
                    }}
                  />
                  <TextField
                    value={message}
                    error={error.for === "message"}
                    helperText={error.for === "message" && error.text}
                    label="Informational Context"
                    fullWidth
                    autoComplete="off"
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div
                    className={`flex gap-4 justify-center items-center mt-2 max-lg:hidden flex-row w-full`}
                  >
                    {error && error.for === "image" && <div>{error.text}</div>}
                    {loading.for === "image" && loading.status ? (
                      <div>Uploading...</div>
                    ) : (
                      <label
                        htmlFor="imageUrl"
                        className="add-new-btn flex items-center"
                      >
                        {img !== null && img !== "" ? (
                          <ChangeCircleRounded fontSize="medium" />
                        ) : (
                          <FileUploadRounded fontSize="medium" />
                        )}
                        <span className="pl-1">
                          {img !== null && img !== ""
                            ? "Change Image"
                            : "Add Image"}
                        </span>
                      </label>
                    )}
                    <input
                      hidden
                      onChange={handleUploadImage}
                      accept="image/*"
                      type="file"
                      id="imageUrl"
                    />
                    <button
                      type="submit"
                      className="add-new-btn flex items-center"
                      onClick={showPreview}
                    >
                      <SendRounded fontSize="medium" />
                      <span className="pl-1">Send</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 justify-center w-full lg:w-[50%]">
                  <div className="flex flex-row w-full items-center max-md:flex-col gap-4">
                    <div className="relative w-full h-48 bg-gray-200 rounded-xl overflow-hidden">
                      {img && (
                        <Cropper
                          image={img}
                          crop={crop}
                          zoom={zoom}
                          aspect={1}
                          cropShape="round"
                          showGrid={false}
                          onCropChange={onCropChange}
                          onCropComplete={onCropComplete}
                          onZoomChange={onZoomChange}
                        />
                      )}
                    </div>
                    <div
                      className={`gap-4 justify-center items-center flex-col max-md:flex-row max-lg:flex hidden w-full`}
                    >
                      {error && error.for === "image" && (
                        <div>{error.text}</div>
                      )}
                      {loading.for === "image" && loading.status ? (
                        <div>Uploading...</div>
                      ) : (
                        <label
                          htmlFor="imageUrl"
                          className="add-new-btn flex items-center"
                        >
                          {img !== null && img !== "" ? (
                            <ChangeCircleRounded fontSize="medium" />
                          ) : (
                            <FileUploadRounded fontSize="medium" />
                          )}
                          <span className="pl-1">
                            {img !== null && img !== ""
                              ? "Change Image"
                              : "Add Image"}
                          </span>
                        </label>
                      )}
                      <input
                        hidden
                        onChange={handleUploadImage}
                        type="file"
                        id="imageUrl"
                      />
                      <button
                        type="submit"
                        className="add-new-btn flex items-center"
                        onClick={showPreview}
                      >
                        <SendRounded fontSize="medium" />
                        <span className="pl-1">Send</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
          <div className="w-full banner-layout">
            <div className="banner-section-title">
              Recent Sent Notifications
            </div>
            <div className="flex flex-wrap gap-8 justify-center mt-2">
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  setNotifications={setNotifications}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewNotficationsScreen;
