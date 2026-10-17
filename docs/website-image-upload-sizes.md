# Website image upload sizes

Images are cropped before Firebase Storage upload. Drag to position, zoom, and confirm the output. Width and height are actual exported pixels, not just a preview size. Cancelling keeps the previous image.

| Placement | Default output | Website reference |
| --- | --- | --- |
| Hotel/tour listing photos and room photos | 1200 x 750 (16:10) | Public HotelCard.jsx and TourCard.jsx use aspect-[16/10] |
| Homepage carousel | 1260 x 720 (7:4) | PanoramicSwiper.jsx uses 420 x 240 slides |
| Homepage DMC image | 900 x 1200 (3:4) | Home.jsx uses aspect-[3/4] |
| About team portraits | 600 x 900 (2:3) | AboutClient.jsx uses tall cards, around 320 x 500 on desktop |
| Services visual cards | 1200 x 1000 (6:5) | ServicesClient.jsx has responsive near-square photo columns |
| Testimonial avatars | 600 x 600 (1:1) | Home.jsx displays circular avatars |
| Hotel logos | 800 x 800 (1:1) | Separate logo asset, not the hotel photo gallery |
| Blog/offer covers | 1200 x 750 (16:10) | Landscape listing imagery; offers use aspect-[16/10] |
| Other website media | Slot-specific recommended dimensions | src/data/websiteMediaSlots.js |

The same photo may appear in listing cards, portrait compact cards, and responsive detail mosaics. One crop cannot fill every frame without further clipping. Keep the important subject centered and avoid text at the edges. Backgrounds also change shape with viewport dimensions; their catalog sizes are source recommendations, not fixed display dimensions.

JPG and WebP export as JPEG; PNG preserves transparency. Output dimensions must be whole numbers from 16 to 4096, with a 20 MB file limit. The editor warns when the selected source region is smaller than the output.

Videos, SVG artwork, QR codes, and transport document images bypass cropping. QR quiet zones and the full content of identity documents must remain intact. Direct URL media assignments continue using the supplied URL and do not run the cropper.
