import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Cropper from 'react-easy-crop';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Slider, Stack, TextField, Typography } from '@mui/material';

const PRESETS = [
    { label: 'Hotel / tour card (16:10)', width: 1200, height: 750 },
    { label: 'Home slider (7:4)', width: 1260, height: 720 },
    { label: 'Wide banner', width: 1920, height: 1080 },
    { label: 'Square / logo', width: 800, height: 800 },
    { label: 'DMC portrait (3:4)', width: 900, height: 1200 },
    { label: 'Team portrait (2:3)', width: 600, height: 900 },
];

export function mediaCropSize(slot) {
    const match = slot?.recommendedSize?.match(/(\d+)\s*[x×]\s*(\d+)/i);
    return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: 1200, height: 800 };
}

// Scale the selected source rectangle into an exact pixel-sized output file.
export async function exportCrop(source, area, width, height, originalFile) {
    if (!area || area.width <= 0 || area.height <= 0) throw new Error('Please select a crop first.');
    if (![width, height].every(n => Number.isInteger(n) && n >= 16 && n <= 4096)) {
        throw new Error('Width and height must be whole numbers between 16 and 4096 pixels.');
    }
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the image.');
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height);
    const type = originalFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, 0.92));
    if (!blob) throw new Error('Could not export the cropped image. Please try another image.');
    if (blob.size > 20 * 1024 * 1024) throw new Error('Cropped image exceeds 20 MB. Choose smaller dimensions.');
    const base = originalFile.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}-${width}x${height}.${type === 'image/png' ? 'png' : 'jpg'}`, { type });
}

function CropImageDialog({ file, source, width: initialWidth, height: initialHeight, title, onDone }) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [width, setWidth] = useState(initialWidth);
    const [height, setHeight] = useState(initialHeight);
    const [area, setArea] = useState(null);
    const [media, setMedia] = useState(null);
    const [ready, setReady] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const validSize = [width, height].every(n => Number.isInteger(n) && n >= 16 && n <= 4096);
    const preset = width === initialWidth && height === initialHeight ? 'recommended' : PRESETS.findIndex(p => p.width === width && p.height === height);
    const resize = (w, h) => {
        setWidth(w); setHeight(h); setArea(null); setCrop({ x: 0, y: 0 }); setZoom(1); setError('');
    };
    const save = async () => {
        if (saving || !validSize || !area) return;
        setSaving(true); setError('');
        try {
            onDone(await exportCrop(source, area, width, height, file));
        } catch (err) {
            setError(err.message); setSaving(false);
        }
    };
    return (
        <Dialog open fullWidth maxWidth="md" transitionDuration={0} onClose={() => !saving && onDone(null)} aria-labelledby="crop-image-title">
            <DialogTitle id="crop-image-title">{title || 'Crop image before upload'}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Drag to position your image. Zoom to choose what appears in the frame.</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField select label="Size preset" value={preset === -1 ? 'custom' : preset} onChange={e => { if (e.target.value === 'custom') return; const p = e.target.value === 'recommended' ? { width: initialWidth, height: initialHeight } : PRESETS[Number(e.target.value)]; resize(p.width, p.height); }} sx={{ minWidth: 180 }} disabled={saving}>
                        <MenuItem value="custom" disabled>Custom size</MenuItem>
                        <MenuItem value="recommended">Recommended: {initialWidth} x {initialHeight}</MenuItem>
                        {PRESETS.map((p, i) => <MenuItem key={p.label} value={i}>{p.label}: {p.width} x {p.height}</MenuItem>)}
                    </TextField>
                    <TextField label="Width (px)" type="number" value={width} onChange={e => resize(Number(e.target.value), height)} inputProps={{ min: 16, max: 4096, step: 1 }} error={!validSize} disabled={saving} />
                    <TextField label="Height (px)" type="number" value={height} onChange={e => resize(width, Number(e.target.value))} inputProps={{ min: 16, max: 4096, step: 1 }} error={!validSize} disabled={saving} />
                </Stack>
                {!validSize && <Alert severity="error" sx={{ mb: 2 }}>Enter whole dimensions between 16 and 4096 pixels.</Alert>}
                <Box sx={{ position: 'relative', height: { xs: 280, sm: 380 }, background: '#0f172a', borderRadius: 2, overflow: 'hidden' }}>
                    <Cropper key={`${validSize ? width : 1}:${validSize ? height : 1}`} image={source} crop={crop} zoom={zoom} aspect={validSize ? width / height : 1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} onMediaLoaded={size => { setMedia(size); setReady(true); }} mediaProps={{ onError: () => { setReady(false); setError('This image cannot be opened. Please choose a JPG, PNG or WebP image.'); } }} style={saving ? { containerStyle: { pointerEvents: 'none' } } : undefined} />
                </Box>
                <Typography component="label" htmlFor="crop-zoom" variant="body2" sx={{ display: 'block', mt: 2 }}>Zoom</Typography>
                <Slider id="crop-zoom" aria-label="Image zoom" value={zoom} min={1} max={3} step={0.01} onChange={(_, value) => setZoom(value)} disabled={saving} />
                <Typography variant="body2">Output: {width || '-'} x {height || '-'} pixels{media ? ` | Original: ${media.naturalWidth} x ${media.naturalHeight} pixels` : ''}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Recommended dimensions match the website placement. Keep the main subject near the center: mobile cards and detail galleries may crop the same image differently. Avoid text near the edges.</Typography>
                {area && (width > area.width || height > area.height) && <Alert severity="info" sx={{ mt: 2 }}>The selected area is smaller than the output size. A larger source image will look sharper.</Alert>}
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={() => onDone(null)} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={save} disabled={saving || !validSize || !area || !ready}>{saving ? 'Preparing image...' : 'Use cropped image'}</Button>
            </DialogActions>
        </Dialog>
    );
}

// An awaited dialog lets existing upload handlers keep their storage and form logic.
// Cancelling returns null and never uploads or replaces an existing image.
export default function cropImageFile(file, { width = 1200, height = 750, title } = {}) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        return Promise.reject(new Error('Please choose a JPG, PNG or WebP image for cropping.'));
    }
    if (file.size > 20 * 1024 * 1024) return Promise.reject(new Error('Please choose an image smaller than 20 MB.'));
    const source = URL.createObjectURL(file);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    return new Promise(resolve => {
        let finished = false;
        const onDone = result => {
            if (finished) return;
            finished = true;
            queueMicrotask(() => { root.unmount(); container.remove(); URL.revokeObjectURL(source); });
            resolve(result);
        };
        root.render(<CropImageDialog file={file} source={source} width={width} height={height} title={title} onDone={onDone} />);
    });
}
