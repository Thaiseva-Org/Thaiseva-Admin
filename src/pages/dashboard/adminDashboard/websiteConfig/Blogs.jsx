import { useState, useEffect } from "react";
import {
    Button,
    Card,
    CardContent,
    CardMedia,
    CardActions,
    Grid,
    IconButton,
    Typography,
    Chip,
    Fade,
    Skeleton,
    TextField,
    InputAdornment,
    Tabs,
    Tab,
    Box
} from "@mui/material";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    query,
    orderBy
} from "firebase/firestore";
import { db } from "../../../../firebase/firebase.config";
import DragDropImageUploader from "../../../../components/websiteConfig/DragDropImageUploader";
import ConfigHeader from "../../../../components/websiteConfig/ConfigHeader";
import Swal from "sweetalert2";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ArticleIcon from "@mui/icons-material/Article";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PersonIcon from "@mui/icons-material/PersonOutline";

import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import MenuItem from "@mui/material/MenuItem";

const Blogs = () => {
    const [blogs, setBlogs] = useState([]);
    const [filteredBlogs, setFilteredBlogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [tabValue, setTabValue] = useState(0); // 0: All, 1: Published, 2: Draft

    const [openModal, setOpenModal] = useState(false);
    const [isUpdate, setIsUpdate] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [viewModal, setViewModal] = useState(false);
    const [viewBlog, setViewBlog] = useState(null);

    const [currentBlog, setCurrentBlog] = useState({
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        image: "",
        category: "Travel",
        author: "Admin",
        status: "Published",
        metaTitle: "",
        metaDescription: "",
        metaKeywords: "",
    });

    const fetchBlogs = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "BlogDB"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setBlogs(data);
            setFilteredBlogs(data);
        } catch (error) {
            console.error("Error fetching blogs:", error);
            // Fallback
            if (error.code === 'failed-precondition') {
                const querySnapshot = await getDocs(collection(db, "BlogDB"));
                const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                setBlogs(data);
                setFilteredBlogs(data);
            }
        } finally {
            setTimeout(() => setLoading(false), 600);
        }
    };

    useEffect(() => {
        fetchBlogs();
    }, []);

    // Filter Logic
    useEffect(() => {
        let result = blogs;

        // Tab Filter
        if (tabValue === 1) result = result.filter(b => b.status === 'Published');
        if (tabValue === 2) result = result.filter(b => b.status === 'Draft');

        // Search Filter
        if (searchTerm) {
            result = result.filter(b =>
                b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.category.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        setFilteredBlogs(result);
    }, [searchTerm, tabValue, blogs]);

    const handleOpenAdd = () => {
        setCurrentBlog({
            title: "",
            slug: "",
            excerpt: "",
            content: "",
            image: "",
            category: "Travel",
            author: "Admin",
            status: "Published",
            metaTitle: "",
            metaDescription: "",
            metaKeywords: "",
        });
        setIsUpdate(false);
        setSelectedId(null);
        setOpenModal(true);
    };

    const handleOpenEdit = (item) => {
        setCurrentBlog({
            title: item.title || "",
            slug: item.slug || "",
            excerpt: item.excerpt || "",
            content: item.content || "",
            image: item.image || "",
            category: item.category || "Travel",
            author: item.author || "Admin",
            status: item.status || "Draft",
            metaTitle: item.metaTitle || "",
            metaDescription: item.metaDescription || "",
            metaKeywords: item.metaKeywords || "",
        });
        setIsUpdate(true);
        setSelectedId(item.id);
        setOpenModal(true);
    };

    const handleCloseModal = () => setOpenModal(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCurrentBlog(prev => {
            const newState = { ...prev, [name]: value };
            if (name === "title" && !isUpdate) {
                newState.slug = value.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
            }
            return newState;
        });
    }

    const handleImageChange = (url) => setCurrentBlog(prev => ({ ...prev, image: url }));

    const stripHtml = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const calcReadTime = (html) => {
        const words = stripHtml(html).split(" ").filter(Boolean).length;
        const minutes = Math.max(1, Math.ceil(words / 200));
        return `${minutes} min read`;
    };

    const handleSave = async () => {
        if (!currentBlog.title || !currentBlog.content) {
            Swal.fire("Validation Error", "Title and content are required.", "warning");
            return;
        }

        try {
            const metaTitle = currentBlog.metaTitle?.trim() || currentBlog.title;
            const metaDescription =
                currentBlog.metaDescription?.trim() ||
                currentBlog.excerpt?.trim() ||
                stripHtml(currentBlog.content).slice(0, 160);
            const readTime = calcReadTime(currentBlog.content);

            if (isUpdate && selectedId) {
                const docRef = doc(db, "BlogDB", selectedId);
                await updateDoc(docRef, {
                    ...currentBlog,
                    metaTitle,
                    metaDescription,
                    readTime,
                    updatedAt: serverTimestamp(),
                });
                Swal.fire({ icon: 'success', title: 'Updated', timer: 1000, showConfirmButton: false });
            } else {
                const isDraft = currentBlog.status === "Draft";
                const blogPayload = {
                    ...currentBlog,
                    metaTitle,
                    metaDescription,
                    readTime,
                    createdAt: serverTimestamp(),
                };

                if (!isDraft) {
                    blogPayload.publishedDate = serverTimestamp();
                }

                await addDoc(collection(db, "BlogDB"), blogPayload);
                Swal.fire({
                    icon: "success",
                    title: isDraft ? "Draft Saved" : "Published",
                    timer: 1000,
                    showConfirmButton: false,
                });
            }
            setOpenModal(false);
            fetchBlogs();
        } catch (error) {
            Swal.fire("Error", "Action failed.", "error");
        }
    };

    const handleDelete = async (id) => {
        Swal.fire({
            title: "Confirm Delete",
            text: "Remove this article permenantly?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, "BlogDB", id));
                    fetchBlogs();
                    Swal.fire("Deleted", "", "success");
                } catch (error) {
                    Swal.fire("Error", "Could not delete.", "error");
                }
            }
        });
    };

    const handleView = (item) => {
        setViewBlog(item);
        setViewModal(true);
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <ConfigHeader
                title="Blog Articles"
                subtitle="Create, edit, and publish engaging content for your users."
                onAdd={handleOpenAdd}
                addLabel="Write New Article"
            />

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                {/* Tabs */}
                <Box sx={{ borderBottom: 0, width: { xs: '100%', md: 'auto' } }}>
                    <Tabs
                        value={tabValue}
                        onChange={(e, val) => setTabValue(val)}
                        textColor="inherit"
                        indicatorColor="primary"
                        sx={{
                            '& .MuiTabs-indicator': { height: '3px', borderRadius: '3px 3px 0 0', backgroundColor: 'var(--primary-500)' },
                            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, color: 'var(--secondary-text-color)', fontSize: '0.95rem' },
                            '& .Mui-selected': { color: 'var(--primary-600) !important' }
                        }}
                    >
                        <Tab label="All Posts" />
                        <Tab label="Published" />
                        <Tab label="Drafts" />
                    </Tabs>
                </Box>

                {/* Search */}
                <TextField
                    placeholder="Search articles..."
                    size="small"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'var(--primary-400)' }} /></InputAdornment>,
                        sx: {
                            borderRadius: '12px',
                            backgroundColor: '#f8fafc',
                            minWidth: { xs: '100%', md: '320px' },
                            '& fieldset': { borderColor: 'transparent' },
                            '&:hover fieldset': { borderColor: 'var(--primary-200) !important' },
                            '&.Mui-focused fieldset': { borderColor: 'var(--primary-500) !important', borderWidth: '2px' }
                        }
                    }}
                />
            </div>

            {loading ? (
                <Grid container spacing={4}>
                    {[1, 2, 3].map(i => (
                        <Grid item xs={12} md={4} key={i}>
                            <Skeleton variant="rectangular" height={240} sx={{ borderRadius: "16px", mb: 2 }} />
                            <Skeleton />
                            <Skeleton width="60%" />
                        </Grid>
                    ))}
                </Grid>
            ) : filteredBlogs.length === 0 ? (
                <div className="py-20 text-center">
                    <ArticleIcon sx={{ fontSize: 60, color: '#e2e8f0' }} />
                    <Typography className="text-gray-400 mt-4">No articles found matching your criteria.</Typography>
                </div>
            ) : (
                <Grid container spacing={4}>
                    {filteredBlogs.map((item) => (
                        <Grid item xs={12} sm={6} md={4} key={item.id}>
                            <Fade in={true} timeout={500}>
                                <Card className="modern-card h-full flex flex-col group cursor-pointer" onClick={() => handleView(item)}>
                                    <div className="relative aspect-video overflow-hidden">
                                        <CardMedia
                                            component="img"
                                            image={item.image || "https://placehold.co/600x400?text=No+Image"}
                                            alt={item.title}
                                            sx={{ height: '100%', width: '100%', objectFit: 'cover', transition: 'transform 0.5s', '.group:hover &': { transform: 'scale(1.1)' } }}
                                        />
                                        <div className="absolute top-4 right-4 z-10">
                                            <Chip
                                                label={item.status}
                                                size="small"
                                                className={`font-semibold shadow-sm ${item.status === 'Published' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}
                                            />
                                        </div>
                                        <div className="absolute bottom-4 left-4">
                                            <Chip
                                                label={item.category}
                                                size="small"
                                                className="bg-black/60 text-white backdrop-blur-md border-none"
                                            />
                                        </div>
                                    </div>

                                    <CardContent sx={{ flexGrow: 1, p: 3, pt: 4 }}>
                                        <Typography variant="h6" className="font-bold leading-snug mb-3 line-clamp-2 text-gray-900 group-hover:text-blue-600 transition-colors break-words overflow-hidden">
                                            {item.title}
                                        </Typography>
                                        <Typography variant="body2" className="line-clamp-3 mb-6 text-gray-500 leading-relaxed break-words overflow-hidden">
                                            {item.excerpt}
                                        </Typography>

                                        <div className="flex items-center gap-4 text-xs text-gray-400 mt-auto pt-4 border-t border-gray-100">
                                            <div className="flex items-center gap-1.5 font-medium text-gray-600">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                    <PersonIcon sx={{ fontSize: 14 }} />
                                                </div>
                                                {item.author}
                                            </div>
                                            <div className="flex items-center gap-1.5 ml-auto">
                                                <CalendarTodayIcon sx={{ fontSize: 14 }} />
                                                {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now'}
                                            </div>
                                        </div>
                                    </CardContent>

                                    <CardActions sx={{ px: 2, pb: 2, pt: 0, justifyContent: 'flex-end', gap: 1 }}>
                                        <IconButton onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }} size="small" className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors" title="Edit Article">
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} size="small" className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors" title="Delete Article">
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </CardActions>
                                </Card>
                            </Fade>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Main Filter/Add/Edit Dialog */}
            <Dialog
                open={openModal}
                onClose={handleCloseModal}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: { xs: '16px', sm: '24px' },
                        overflow: 'hidden',
                        maxHeight: 'calc(100vh - 32px)'
                    }
                }}
            >
                <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white relative">
                    <Typography variant="h5" className="font-bold flex items-center gap-2">
                        {isUpdate ? <EditIcon /> : <ArticleIcon />}
                        {isUpdate ? 'Edit Article' : 'Write New Article'}
                    </Typography>
                    <Typography variant="body2" className="text-blue-100 mt-1">
                        {isUpdate ? 'Update the details and content of this article.' : 'Craft a compelling story for your audience.'}
                    </Typography>
                </div>

                <DialogContent sx={{ px: { xs: 2, sm: 4 }, py: 4, overflowX: 'hidden' }}>
                    <Grid container spacing={4}>
                        <Grid item xs={12} md={8}>
                            <TextField
                                label="Article Title"
                                name="title"
                                value={currentBlog.title}
                                onChange={handleChange}
                                fullWidth
                                variant="outlined"
                                sx={{ mb: 4, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                            />

                            <TextField
                                label="Excerpt / Summary"
                                name="excerpt"
                                value={currentBlog.excerpt}
                                onChange={handleChange}
                                fullWidth
                                multiline
                                rows={3}
                                variant="outlined"
                                sx={{ mb: 4, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                                helperText="A short summary that appears on the blog listing page."
                            />

                            <div className="mb-8 md:mb-0">
                                <Typography variant="subtitle2" className="mb-3 text-gray-700 font-bold flex items-center gap-2">
                                    <ArticleIcon fontSize="small" color="primary" /> Main Content
                                </Typography>
                                <ReactQuill
                                    theme="snow"
                                    value={currentBlog.content}
                                    onChange={(value) => setCurrentBlog(prev => ({ ...prev, content: value }))}
                                    className="blog-content-editor bg-white rounded-xl border border-gray-200"
                                    modules={{
                                        toolbar: [
                                            [{ 'header': [1, 2, 3, false] }],
                                            ['bold', 'italic', 'underline', 'strike'],
                                            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                            ['link', 'image', 'video'],
                                            ['clean']
                                        ],
                                    }}
                                />
                            </div>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <Box className="space-y-5 md:border-l md:border-gray-200 md:pl-6">
                                <DragDropImageUploader
                                    label="Cover Image"
                                    image={currentBlog.image}
                                    onImageChange={handleImageChange}
                                    folder="blogs"
                                    height={200}
                                />

                                <div className="space-y-4 pt-2">
                                    <TextField
                                        select
                                        label="Status"
                                        name="status"
                                        value={currentBlog.status}
                                        onChange={handleChange}
                                        fullWidth
                                        helperText={
                                            !isUpdate
                                                ? "Choose Draft to save without publishing."
                                                : ""
                                        }
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                                    >
                                        <MenuItem value="Draft">Draft</MenuItem>
                                        <MenuItem value="Published">Published</MenuItem>
                                    </TextField>

                                    <TextField
                                        select
                                        label="Category"
                                        name="category"
                                        value={currentBlog.category}
                                        onChange={handleChange}
                                        fullWidth
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                                    >
                                        {['Travel', 'Food', 'News', 'Lifestyle', 'Updates', 'Tips & Tricks'].map(c => (
                                            <MenuItem key={c} value={c}>{c}</MenuItem>
                                        ))}
                                    </TextField>

                                    <TextField
                                        label="Author"
                                        name="author"
                                        value={currentBlog.author}
                                        onChange={handleChange}
                                        fullWidth
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                                    />

                                    <TextField
                                        label="URL Slug"
                                        name="slug"
                                        value={currentBlog.slug}
                                        onChange={handleChange}
                                        fullWidth
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                                        helperText="Auto-generated from title"
                                    />
                                </div>

                                <Box className="pt-4 border-t border-gray-200 mt-6 !mb-2">
                                    <Typography variant="subtitle2" className="mb-4 text-gray-700 font-bold flex items-center gap-2">
                                        SEO Metadata
                                    </Typography>
                                    <TextField
                                        label="Meta Title"
                                        name="metaTitle"
                                        value={currentBlog.metaTitle}
                                        onChange={handleChange}
                                        fullWidth
                                        size="small"
                                        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                                        helperText="Defaults to article title"
                                    />
                                    <TextField
                                        label="Meta Description"
                                        name="metaDescription"
                                        value={currentBlog.metaDescription}
                                        onChange={handleChange}
                                        fullWidth
                                        size="small"
                                        multiline
                                        rows={3}
                                        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                                        helperText="Best under 160 characters for search results"
                                    />
                                    <TextField
                                        label="Meta Keywords"
                                        name="metaKeywords"
                                        value={currentBlog.metaKeywords}
                                        onChange={handleChange}
                                        fullWidth
                                        size="small"
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                                        helperText="Comma-separated keywords"
                                    />
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: { xs: 2, sm: 4 }, pb: { xs: 2, sm: 4 }, pt: 2, bgcolor: '#fafafa', flexWrap: 'wrap', gap: 1 }}>
                    <Button onClick={handleCloseModal} sx={{ color: 'gray', borderRadius: '10px', px: 3, fontWeight: 600 }}>Cancel</Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        sx={{
                            borderRadius: '10px',
                            bgcolor: 'var(--primary-600)',
                            px: 4,
                            py: 1,
                            fontWeight: 600,
                            boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.39)',
                            "&:hover": { bgcolor: "var(--primary-700)", boxShadow: '0 6px 20px rgba(37, 99, 235, 0.23)' }
                        }}
                    >
                        {isUpdate
                            ? "Update Article"
                            : currentBlog.status === "Draft"
                              ? "Save Draft"
                              : "Publish Article"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Preview Modal */}
            <Dialog
                open={viewModal}
                onClose={() => setViewModal(false)}
                maxWidth="md"
                fullWidth
                scroll="paper"
                PaperProps={{ sx: { borderRadius: '20px' } }}
            >
                <DialogTitle sx={{ p: 0 }}>
                    <div className="flex justify-between items-center p-4 px-6 bg-gray-50 border-b border-gray-100">
                        <span className="font-bold text-gray-800 flex items-center gap-2"><VisibilityIcon color="primary" /> Article Preview</span>
                        <Button onClick={() => setViewModal(false)} variant="outlined" size="small" sx={{ borderRadius: '8px', textTransform: 'none' }}>Close Preview</Button>
                    </div>
                </DialogTitle>
                <DialogContent sx={{ py: 6, px: { xs: 3, md: 8 } }}>
                    {viewBlog && (
                        <article className="prose prose-blue max-w-none prose-headings:font-bold prose-img:rounded-xl break-words overflow-x-hidden">
                            {viewBlog.image && (
                                <img src={viewBlog.image} alt="" className="w-full h-auto max-h-[400px] object-cover rounded-2xl mb-8 shadow-sm" />
                            )}
                            <Chip label={viewBlog.category} size="small" className="mb-4 bg-blue-50 text-blue-700 font-semibold" />
                            <h1 className="text-4xl font-extrabold mb-4 text-gray-900 leading-tight">{viewBlog.title}</h1>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-10 pb-6 border-b border-gray-100">
                                <span className="flex items-center gap-1 font-medium bg-gray-50 px-3 py-1 rounded-full text-gray-700">
                                    <PersonIcon fontSize="small" className="text-gray-400" /> {viewBlog.author}
                                </span>
                                <span className="flex items-center gap-1">
                                    <CalendarTodayIcon fontSize="small" className="text-gray-400" />
                                    {viewBlog.createdAt?.seconds ? new Date(viewBlog.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </span>
                                {viewBlog.readTime && (
                                    <span className="flex items-center gap-1 text-gray-400">
                                        • {viewBlog.readTime}
                                    </span>
                                )}
                            </div>

                            <div className="text-gray-700 leading-relaxed text-lg break-words whitespace-pre-line" dangerouslySetInnerHTML={{ __html: viewBlog.content }} />
                        </article>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Blogs;
