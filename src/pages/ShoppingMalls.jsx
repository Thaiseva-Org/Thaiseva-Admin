import {
  addDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  query,
  startAfter,
  updateDoc,
} from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import PageHeading from "../components/PageHeading";
import ShopsCard from "../components/ShopsCard";
import { shopCollection } from "../firebase/firebase.config";
import { Pagination } from "@mui/material";
import AddShopForm from "../components/AddShopForm";
import SearchBar from "../components/SearchBar";
import { AuthContext } from "../contextAPIs/AuthProvider";
import { getFileUrl } from "../utils/utils";

const ShoppingMalls = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const [shops, setShops] = useState([]);
  const [newShop, setNewShop] = useState({
    name: "",
    description: "",
    imageUrl: "",
    address: "",
    latitude: "",
    longitude: "",
  });
  const [filteredShops, setFilteredShops] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);

  const [openModal, setOpenModal] = useState(false);
  const [isUpdate, setIsUpdate] = useState(false);
  const [error, setError] = useState({ for: "", text: "" });
  const [loading, setLoading] = useState({ for: "", status: false });
  const [refetch, setRefetch] = useState(true);

  const fetchTotalPages = async () => {
    let q = query(shopCollection);
    const pages = await getCountFromServer(q);
    setTotalPages(Math.ceil(pages.data().count / 10));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let q = query(shopCollection, limit(10));
      if (page > 0 && lastDocs[page - 1]) {
        q = query(shopCollection, startAfter(lastDocs[page - 1]), limit(10));
      }

      const res = await getDocs(q);
      const fetchedItems = res.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const lastDoc =
        res.docs.length > 0 ? res.docs[res.docs.length - 1] : null;

      setLastDocs((prev) => {
        const updated = [...prev];
        updated[page] = lastDoc;
        return updated;
      });
      setShops(fetchedItems);
      setFilteredShops(fetchedItems);
    } catch (error) {
      console.error("Error fetching food items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  useEffect(() => {
    if (isAdmin || isSubAdmin) {
      fetchData();
      fetchTotalPages();
    }
  }, [isAdmin, isSubAdmin, refetch, page]);

  const handleSearch = (text) => {
    const matchingObjects = shops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(text.toLowerCase()) ||
        shop.address.toLowerCase().includes(text.toLowerCase())
    );

    setFilteredShops(matchingObjects);
  };

  const handleOpenModal = () => {
    setIsUpdate(false);
    setNewShop({});
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setNewShop({});
  };

  const handleUploadImage = async (e) => {
    const { files } = e.target;
    setError({ for: "", text: "" });
    setLoading({ for: "image", status: true });
    const result = await getFileUrl(files);
    if (result.error) {
      setError({ for: "image", text: result.message });
      setLoading({ for: "image", status: false });
    } else {
      setNewShop((p) => ({ ...p, imageUrl: result.url }));
      setLoading({ for: "image", status: false });
    }
  };

  const handleAddBanner = async () => {
    if (confirm("Are you sure you want to add this new shop?"))
      try {
        await addDoc(shopCollection, {
          ...newShop,
        });
        setNewShop({
          name: "",
          description: "",
          imageUrl: "",
          address: "",
          latitude: "",
          longitude: "",
        });
        setOpenModal(false);
        setRefetch((p) => !p);
      } catch (error) {
        console.error("Error adding shop: ", error);
      }
  };

  const handleUpdateshop = async () => {
    if (confirm(`Are you sure you want to update this ${newShop.name} club?`))
      try {
        await updateDoc(doc(shopCollection, newShop.id), {
          ...newShop,
        });
        setNewShop({
          name: "",
          description: "",
          imageUrl: "",
          address: "",
          latitude: "",
          longitude: "",
        });
        setOpenModal(false);
        setRefetch((p) => !p);
      } catch (error) {
        console.error("Error adding club: ", error);
      }
  };

  return (
    <div className="animate-fade-in">
      <PageHeading
        text="Shopping Malls"
        subtitle="Manage shopping destinations and retail locations"
        icon="🛍️"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">
                Total Shops
              </p>
              <p className="text-3xl font-bold">{filteredShops.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🛍️</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-100 text-sm font-medium mb-1">
                Total Pages
              </p>
              <p className="text-3xl font-bold">{totalPages}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">📄</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium mb-1">
                Locations
              </p>
              <p className="text-3xl font-bold">
                {new Set(filteredShops.map((s) => s.address)).size}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">📍</span>
            </div>
          </div>
        </div>
      </div>

      <SearchBar
        handleSearch={handleSearch}
        handleOpenModal={handleOpenModal}
        btnTitle="Add New Shop"
      />

      {filteredShops.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <span className="text-6xl opacity-50">🛍️</span>
            <p className="text-neutral-500 font-medium text-lg">
              No Shopping Malls Added Yet
            </p>
            <p className="text-neutral-400 text-sm">
              Click "Add New Shop" to create your first shopping mall entry
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex mt-8 items-center justify-evenly gap-4 w-[100%] flex-wrap">
            {filteredShops.map((shop) => (
              <ShopsCard
                key={shop.id}
                shop={shop}
                setRefetch={setRefetch}
                setShop={setNewShop}
                setIsUpdate={setIsUpdate}
                setOpenModal={setOpenModal}
              />
            ))}
          </div>
          {totalPages > 0 && (
            <div className="w-full flex justify-center bg-white rounded-xl shadow-md border border-neutral-200 p-4">
              <Pagination
                count={totalPages}
                page={page}
                onChange={handleChangePage}
                color="primary"
                siblingCount={0}
                boundaryCount={0}
                sx={{
                  "& .MuiPaginationItem-root": {
                    borderRadius: "8px",
                    fontWeight: 500,
                    "&:hover": {
                      backgroundColor: "#EFF6FF",
                    },
                  },
                  "& .Mui-selected": {
                    background: "linear-gradient(to right, #3B82F6, #2563EB)",
                    color: "white",
                    "&:hover": {
                      background: "linear-gradient(to right, #2563EB, #1D4ED8)",
                    },
                  },
                }}
              />
            </div>
          )}
        </div>
      )}
      <AddShopForm
        type="Shop"
        error={error}
        loading={loading}
        openModal={openModal}
        handleCloseModal={handleCloseModal}
        isUpdate={isUpdate}
        shop={newShop}
        setShop={setNewShop}
        handleUploadImage={handleUploadImage}
        handleAddBanner={handleAddBanner}
        handleUpdateBanner={handleUpdateshop}
      />
    </div>
  );
};

export default ShoppingMalls;
