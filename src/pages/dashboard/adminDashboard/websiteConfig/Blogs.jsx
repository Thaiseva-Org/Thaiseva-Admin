import React, { useState, useEffect } from "react";
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
    Box,
    Badge
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
        status: "Draft",
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
            status: "Draft",
        });
        setIsUpdate(false);
        setSelectedId(null);
        setOpenModal(true);
    };

    const handleOpenEdit = (item) => {
        setCurrentBlog({
            title: item.title,
            slug: item.slug,
            excerpt: item.excerpt,
            content: item.content,
            image: item.image,
            category: item.category,
            author: item.author,
            status: item.status,
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

    const handleSave = async () => {
        if (!currentBlog.title || !currentBlog.content) {
            Swal.fire("Validation Error", "Title and content are required.", "warning");
            return;
        }

        try {
            if (isUpdate && selectedId) {
                const docRef = doc(db, "BlogDB", selectedId);
                await updateDoc(docRef, {
                    ...currentBlog,
                    updatedAt: serverTimestamp(),
                });
                Swal.fire({ icon: 'success', title: 'Updated', timer: 1000, showConfirmButton: false });
            } else {
                await addDoc(collection(db, "BlogDB"), {
                    ...currentBlog,
                    publishedDate: currentBlog.status === 'Published' ? serverTimestamp() : null,
                    createdAt: serverTimestamp(),
                });
                Swal.fire({ icon: 'success', title: 'Published', timer: 1000, showConfirmButton: false });
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
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', width: { xs: '100%', md: 'auto' } }}>
                    <Tabs
                        value={tabValue}
                        onChange={(e, val) => setTabValue(val)}
                        textColor="primary"
                        indicatorColor="primary"
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
                        startAdornment: <InputAdornment position="start"><SearchIcon className="text-gray-400" /></InputAdornment>,
                        sx: { borderRadius: '20px', backgroundColor: 'white', minWidth: '300px' }
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
                        <Grid item xs={12} md={4} key={item.id}>
                            <Fade in={true} timeout={500}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        borderRadius: '16px',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                                        transition: 'transform 0.2s',
                                        '&:hover': { transform: 'translateY(-4px)' }
                                    }}
                                >
                                    <div className="relative">
                                        <CardMedia
                                            component="img"
                                            height="200"
                                            image={item.image || "https://placehold.co/600x400?text=No+Image"}
                                            alt={item.title}
                                            sx={{ height: 200, objectFit: 'cover' }}
                                        />
                                        <div className="absolute top-4 right-4">
                                            <Chip
                                                label={item.status}
                                                color={item.status === 'Published' ? 'success' : 'default'}
                                                size="small"
                                                sx={{ backdropFilter: 'blur(4px)', backgroundColor: item.status === 'Published' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}
                                            />
                                        </div>
                                        <div className="absolute bottom-4 left-4">
                                            <Chip
                                                label={item.category}
                                                size="small"
                                                sx={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(4px)' }}
                                            />
                                        </div>
                                    </div>

                                    <CardContent sx={{ flexGrow: 1, pt: 3 }}>
                                        <Typography variant="h6" className="font-bold leading-tight mb-2 line-clamp-2">
                                            {item.title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" className="line-clamp-3 mb-4">
                                            {item.excerpt}
                                        </Typography>

                                        <div className="flex items-center gap-4 text-xs text-gray-400 mt-auto pt-4 border-t border-gray-50">
                                            <div className="flex items-center gap-1">
                                                <PersonIcon fontSize="inherit" /> {item.author}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <CalendarTodayIcon fontSize="inherit" />
                                                {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                                            </div>
                                        </div>
                                    </CardContent>

                                    <CardActions sx={{ px: 2, pb: 2 }}>
                                        <Button
                                            size="small"
                                            startIcon={<VisibilityIcon />}
                                            onClick={() => handleView(item)}
                                            sx={{ color: 'gray' }}
                                        >
                                            Preview
                                        </Button>
                                        <Box sx={{ flexGrow: 1 }} />
                                        <IconButton onClick={() => handleOpenEdit(item)} size="small" className="bg-blue-50 text-blue-600 hover:bg-blue-100">
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton onClick={() => handleDelete(item.id)} size="small" className="ml-2 bg-red-50 text-red-600 hover:bg-red-100">
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
                maxWidth="md"
                fullWidth
                PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>{isUpdate ? 'Edit Article' : 'Write New Article'}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={3} sx={{ mt: 0 }}>
                        <Grid item xs={12} md={8}>
                            <TextField
                                label="Article Title"
                                name="title"
                                value={currentBlog.title}
                                onChange={handleChange}
                                fullWidth
                                variant="outlined"
                                sx={{ mb: 3 }}
                            />
                            <div className="mb-12">
                                <Typography variant="subtitle2" className="mb-2 text-gray-700 font-semibold">Content</Typography>
                                <ReactQuill
                                    theme="snow"
                                    value={currentBlog.content}
                                    onChange={(value) => setCurrentBlog(prev => ({ ...prev, content: value }))}
                                    style={{ height: '300px', borderRadius: '12px', overflow: 'hidden' }}
                                    className="bg-white rounded-xl"
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
                            <TextField
                                label="Excerpt / Summary"
                                name="excerpt"
                                value={currentBlog.excerpt}
                                onChange={handleChange}
                                fullWidth
                                multiline
                                rows={3}
                                variant="outlined"
                            />
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <Box className="bg-gray-50 p-4 rounded-xl space-y-4">
                                <DragDropImageUploader
                                    label="Cover Image"
                                    image={currentBlog.image}
                                    onImageChange={handleImageChange}
                                    folder="blogs"
                                    height={160}
                                />

                                <TextField
                                    select
                                    label="Status"
                                    name="status"
                                    value={currentBlog.status}
                                    onChange={handleChange}
                                    fullWidth
                                    size="small"
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
                                    size="small"
                                >
                                    {['Travel', 'Food', 'News', 'Lifestyle', 'Updates'].map(c => (
                                        <MenuItem key={c} value={c}>{c}</MenuItem>
                                    ))}
                                </TextField>

                                <TextField
                                    label="Author"
                                    name="author"
                                    value={currentBlog.author}
                                    onChange={handleChange}
                                    fullWidth
                                    size="small"
                                />
                                <TextField
                                    label="URL Slug"
                                    name="slug"
                                    value={currentBlog.slug}
                                    onChange={handleChange}
                                    fullWidth
                                    size="small"
                                    helperText="Auto-generated from title"
                                />
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={handleCloseModal} sx={{ color: 'gray', borderRadius: '8px' }}>Cancel</Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        sx={{
                            borderRadius: '8px',
                            bgcolor: 'var(--primary-500)',
                            px: 4,
                            "&:hover": { bgcolor: "var(--primary-600)" }
                        }}
                    >
                        {isUpdate ? 'Update Article' : 'Publish Article'}
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
            >
                <DialogTitle sx={{ borderBottom: '1px solid #eee' }}>
                    <div className="flex justify-between items-center">
                        <span>Preview</span>
                        <Button onClick={() => setViewModal(false)}>Close</Button>
                    </div>
                </DialogTitle>
                <DialogContent sx={{ py: 4 }}>
                    {viewBlog && (
                        <article className="prose max-w-none">
                            {viewBlog.image && (
                                <img src={viewBlog.image} alt="" className="w-full h-64 object-cover rounded-xl mb-8 shadow-md" />
                            )}
                            <h1 className="text-3xl font-bold mb-2 text-gray-800">{viewBlog.title}</h1>
                            <div className="flex items-center gap-3 text-sm text-gray-500 mb-8 pb-4 border-b">
                                <span className="font-medium text-blue-600">{viewBlog.category}</span>
                                <span>•</span>
                                <span>{viewBlog.author}</span>
                                <span>•</span>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>

                            <div dangerouslySetInnerHTML={{ __html: viewBlog.content }} />
                        </article>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Blogs;
