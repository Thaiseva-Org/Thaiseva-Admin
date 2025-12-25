import { useState, useRef } from "react";
import { IconButton } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";

const VoiceRecorder = ({ onRecordingComplete }) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                onRecordingComplete(blob);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            {!isRecording ? (
                <IconButton
                    onClick={startRecording}
                    color="primary"
                    sx={{
                        backgroundColor: "#eff6ff",
                        "&:hover": { backgroundColor: "#dbeafe" },
                    }}
                    title="Start Recording"
                >
                    <MicIcon />
                </IconButton>
            ) : (
                <IconButton
                    onClick={stopRecording}
                    color="error"
                    sx={{
                        backgroundColor: "#fef2f2",
                        "&:hover": { backgroundColor: "#fee2e2" },
                        animation: "pulse 1.5s infinite",
                    }}
                    title="Stop Recording"
                >
                    <StopIcon />
                </IconButton>
            )}
            {isRecording && (
                <span className="text-xs text-red-500 font-medium animate-pulse">
                    Recording...
                </span>
            )}
            <style>
                {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
            </style>
        </div>
    );
};

export default VoiceRecorder;
