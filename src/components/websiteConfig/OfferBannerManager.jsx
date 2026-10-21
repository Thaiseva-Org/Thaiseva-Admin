import {useEffect, useRef, useState} from 'react';
import {doc, onSnapshot, runTransaction, serverTimestamp} from 'firebase/firestore';
import {ref, uploadBytes, getDownloadURL, deleteObject} from 'firebase/storage';
import {Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch, FormControlLabel, Alert} from '@mui/material';
import {db, storage} from '../../firebase/firebase.config';
import {bannerItems, moveBanner, saveBanner, safeBannerDestination, MAX_OFFER_BANNERS} from '../../utils/offerBanners';

const empty = () => ({id: crypto.randomUUID(), title: '', description: '', image: '', active: true, actionUrl: ''});
const bannerDocument = () => doc(db, 'settings', 'websiteOfferBanners');

export default function OfferBannerManager() {
  const [items, setItems] = useState([]), [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState(null), [editing, setEditing] = useState(false), [error, setError] = useState('');
  const staged = useRef([]), operation = useRef(false), input = useRef(null);
  useEffect(() => onSnapshot(bannerDocument(), snapshot => {
    const data = snapshot.data() || {};
    setItems(bannerItems(data.banners)); setEnabled(data.popupEnabled !== false); setLoading(false);
  }, () => {setError('Unable to load banners. Reload to try again.'); setLoading(false);}), []);

  const mutate = async change => {
    if (operation.current) return false;
    operation.current = true; setBusy(true); setError('');
    try {
      await runTransaction(db, async tx => {
        const snapshot = await tx.get(bannerDocument()), data = snapshot.data() || {};
        tx.set(bannerDocument(), {...change(bannerItems(data.banners), data), updatedAt: serverTimestamp()}, {merge: true});
      });
      return true;
    } catch (err) {setError(err.message || 'Unable to save banners. Try again.'); return false;}
    finally {operation.current = false; setBusy(false);}
  };
  const discardUploads = async except => {
    const files = staged.current.filter(path => path !== except); staged.current = [];
    await Promise.allSettled(files.map(path => deleteObject(ref(storage, path))));
  };
  const close = async () => {if (busy || uploading) return; setDraft(null); await discardUploads();};
  const upload = async file => {
    if (!file || operation.current) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError('Choose a JPG, PNG or WebP image up to 8 MB.'); return;
    }
    operation.current = true; setUploading(true); setError('');
    try {
      const bitmap = await createImageBitmap(file); bitmap.close();
      const path = `site-media/offer-banners/${crypto.randomUUID()}`;
      staged.current.push(path);
      const result = await uploadBytes(ref(storage, path), file, {contentType: file.type, cacheControl: 'public, max-age=3600'});
      const image = await getDownloadURL(result.ref);
      setDraft(current => current ? {...current, image} : current);
    } catch {setError('Image upload failed. Choose a valid image and try again.');}
    finally {operation.current = false; setUploading(false);}
  };
  const submit = async () => {
    if (!draft?.image || busy || uploading) return;
    const actionUrl = safeBannerDestination(draft.actionUrl);
    if (actionUrl === null) {setError('Use a website path such as /tours or a full HTTPS link.'); return;}
    const banner = {...draft, title: draft.title.trim().slice(0, 120), description: draft.description.trim().slice(0, 500), actionUrl};
    if (await mutate(current => ({banners: saveBanner(current, banner, editing)}))) {
      const keep = staged.current.find(path => banner.image.includes(encodeURIComponent(path)));
      setDraft(null); await discardUploads(keep);
    }
  };
  return <section className="mb-10 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6" aria-labelledby="offer-banner-heading">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="offer-banner-heading" className="text-xl font-bold text-gray-900">Website Offer Banners</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Upload offer banners for the website Offers page and popup slider. Saved changes appear live. The popup is shown once per browsing session.</p></div>
      <Button variant="contained" disabled={loading || busy || items.length >= MAX_OFFER_BANNERS} onClick={() => {setError(''); setEditing(false); setDraft(empty());}}>Add New Banner</Button>
    </div>
    <FormControlLabel control={<Switch checked={enabled} disabled={loading || busy} onChange={(_, checked) => mutate(() => ({popupEnabled: checked}))} />} label="Show banner popup on website" />
    {error && !draft && <Alert severity="error" className="my-3">{error}</Alert>}
    {loading ? <p className="py-6 text-gray-500">Loading banners…</p> : !items.length ? <p className="rounded-xl bg-gray-50 p-6 text-center text-gray-500">No website banners yet. Add an image to start your popup slider.</p> :
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item, index) => <article key={item.id} className="overflow-hidden rounded-xl border border-gray-200">
        <div className="flex h-44 items-center justify-center bg-gray-100"><img src={item.image} alt={item.title || `Banner ${index + 1}`} className="h-full w-full object-contain" /></div>
        <div className="space-y-3 p-4"><div><h3 className="font-semibold text-gray-900">{item.title || `Banner ${index + 1}`}</h3>{item.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{item.description}</p>}</div>
          <FormControlLabel control={<Switch size="small" checked={item.active !== false} disabled={busy} onChange={(_, checked) => mutate(current => ({banners: current.map(row => row.id === item.id ? {...row, active: checked} : row)}))} />} label="Visible" />
          <div className="flex flex-wrap gap-2">
            <Button size="small" disabled={busy || index === 0} aria-label={`Move ${item.title || 'banner'} earlier`} onClick={() => mutate(current => ({banners: moveBanner(current, item.id, -1)}))}>Move left</Button>
            <Button size="small" disabled={busy || index === items.length - 1} aria-label={`Move ${item.title || 'banner'} later`} onClick={() => mutate(current => ({banners: moveBanner(current, item.id, 1)}))}>Move right</Button>
            <Button size="small" disabled={busy} onClick={() => {setError(''); setEditing(true); setDraft({...empty(), ...item});}}>Edit</Button>
            <Button size="small" color="error" disabled={busy} onClick={() => {if (window.confirm('Remove this banner from the slider?')) mutate(current => ({banners: current.filter(row => row.id !== item.id)}));}}>Remove</Button>
          </div>
        </div>
      </article>)}</div>}
    <Dialog open={!!draft} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? 'Edit website offer banner' : 'Add website offer banner'}</DialogTitle>
      <DialogContent dividers>{draft && <div className="space-y-5">
        {error && <Alert severity="error">{error}</Alert>}
        <div className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center" onDragOver={event => event.preventDefault()} onDrop={event => {event.preventDefault(); upload(event.dataTransfer.files?.[0]);}}>
          {draft.image && <img src={draft.image} alt="Banner preview" className="mb-3 max-h-64 w-full object-contain" />}
          <Button disabled={uploading || busy} onClick={() => input.current.click()}>{uploading ? 'Uploading…' : draft.image ? 'Replace image' : 'Choose or drop image'}</Button>
          <p className="mt-2 text-xs text-gray-500">JPG, PNG or WebP · up to 8 MB. Your full photo is shown without cropping.</p>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading || busy} onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; upload(file);}} />
        </div>
        <TextField label="Title (optional)" fullWidth value={draft.title} disabled={busy || uploading} inputProps={{maxLength: 120}} onChange={event => setDraft({...draft, title: event.target.value})} />
        <TextField label="Description (optional)" fullWidth multiline minRows={2} value={draft.description} disabled={busy || uploading} inputProps={{maxLength: 500}} onChange={event => setDraft({...draft, description: event.target.value})} />
        <TextField label="Banner link (optional)" fullWidth placeholder="/tours or https://example.com" value={draft.actionUrl} disabled={busy || uploading} onChange={event => setDraft({...draft, actionUrl: event.target.value})} helperText="Leave blank for a photo-only banner." />
        <FormControlLabel control={<Switch checked={draft.active !== false} disabled={busy || uploading} onChange={(_, active) => setDraft({...draft, active})} />} label="Visible in popup slider" />
      </div>}</DialogContent>
      <DialogActions><Button disabled={busy || uploading} onClick={close}>Cancel</Button><Button variant="contained" disabled={!draft?.image || busy || uploading} onClick={submit}>{busy ? 'Saving…' : 'Save banner'}</Button></DialogActions>
    </Dialog>
  </section>;
}
