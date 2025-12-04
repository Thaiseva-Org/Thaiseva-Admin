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
import { clubCollection } from "../firebase/firebase.config";
import { Pagination } from "@mui/material";
import AddShopForm from "../components/AddShopForm";
import SearchBar from "../components/SearchBar";
import { AuthContext } from "../contextAPIs/AuthProvider";
import { getFileUrl } from "../utils/utils";

const Clubs = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const [clubs, setClubs] = useState([]);
  const [newClub, setNewClub] = useState({
    name: "",
    description: "",
    imageUrl: "",
    address: "",
    latitude: "",
    longitude: "",
  });
  const [filteredClubs, setFilteredClubs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);

  const [openModal, setOpenModal] = useState(false);
  const [isUpdate, setIsUpdate] = useState(false);
  const [error, setError] = useState({ for: "", text: "" });
  const [loading, setLoading] = useState({ for: "", status: false });
  const [refetch, setRefetch] = useState(true);

  const fetchTotalPages = async () => {
    let q = query(clubCollection);
    const pages = await getCountFromServer(q);
    setTotalPages(Math.ceil(pages.data().count / 10));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let q = query(clubCollection, limit(10));
      if (page > 0 && lastDocs[page - 1]) {
        q = query(clubCollection, startAfter(lastDocs[page - 1]), limit(10));
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
      setClubs(fetchedItems);
      setFilteredClubs(fetchedItems);
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
    const matchingObjects = clubs.filter(
      (shop) =>
        shop.name.toLowerCase().includes(text.toLowerCase()) ||
        shop.address.toLowerCase().includes(text.toLowerCase())
    );

    setFilteredClubs(matchingObjects);
  };

  const handleOpenModal = () => {
    setIsUpdate(false);
    setNewClub({});
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setNewClub({});
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
      setNewClub((p) => ({ ...p, imageUrl: result.url }));
      setLoading({ for: "image", status: false });
    }
  };

  const handleAddClub = async () => {
    if (confirm("Are you sure you want to add this new club?"))
      try {
        await addDoc(clubCollection, {
          ...newClub,
        });
        setNewClub({
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

  const handleUpdateClub = async () => {
    if (confirm(`Are you sure you want to update this ${newClub.name} club?`))
      try {
        await updateDoc(doc(clubCollection, newClub.id), {
          ...newClub,
        });
        setNewClub({
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
        text="Clubs & Entertainment"
        subtitle="Manage nightlife venues and entertainment spots"
        icon="🎉"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">
                Total Clubs
              </p>
              <p className="text-3xl font-bold">{filteredClubs.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">🎉</span>
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
                {new Set(filteredClubs.map((c) => c.address)).size}
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
        btnTitle="Add New Club"
      />

      {filteredClubs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <span className="text-6xl opacity-50">🎉</span>
            <p className="text-neutral-500 font-medium text-lg">
              No Clubs Added Yet
            </p>
            <p className="text-neutral-400 text-sm">
              Click "Add New Club" to create your first entertainment venue
              entry
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex mt-8 items-center justify-evenly gap-4 w-[100%] flex-wrap">
            {filteredClubs.map((club) => (
              <ShopsCard
                key={club.id}
                shop={club}
                type="club"
                setRefetch={setRefetch}
                setShop={setNewClub}
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
        type="Club"
        error={error}
        loading={loading}
        openModal={openModal}
        handleCloseModal={handleCloseModal}
        isUpdate={isUpdate}
        shop={newClub}
        setShop={setNewClub}
        handleUploadImage={handleUploadImage}
        handleAddBanner={handleAddClub}
        handleUpdateBanner={handleUpdateClub}
      />
    </div>
  );
};

export default Clubs;
