import { useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Pagination } from "@mui/material";
import PageHeading from "../components/PageHeading";
import SearchBar from "../components/SearchBar";
import { AuthContext } from "../contextAPIs/AuthProvider";
import {
  deleteAttraction,
  getAttractionCategories,
  getAttractionsList,
  migrateLegacyShopsAndClubs,
  saveAttraction,
  seedDefaultCategoriesIfEmpty,
} from "../services/attractionsService";
import AttractionCard from "../components/attractions/AttractionCard";
import AddAttractionModal from "../components/attractions/AddAttractionModal";
import ManageCategoriesModal from "../components/attractions/ManageCategoriesModal";
import { AddIcon } from "@icons";

const ITEMS_PER_PAGE = 10;

const THAILAND_CITIES = [
  "All Cities",
  "Bangkok",
  "Phuket",
  "Pattaya",
  "Chiang Mai",
  "Krabi",
  "Koh Samui",
  "Hua Hin",
];

export default function Attractions() {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();

  // Category and attraction state
  const [categories, setCategories] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active filters
  const activeCategoryParam = searchParams.get("category") || "all";
  const [selectedCategory, setSelectedCategory] = useState(activeCategoryParam);
  const [selectedCity, setSelectedCity] = useState("All Cities");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  // Modals
  const [openAddModal, setOpenAddModal] = useState(false);
  const [isUpdate, setIsUpdate] = useState(false);
  const [selectedAttraction, setSelectedAttraction] = useState(null);
  const [openCategoryModal, setOpenCategoryModal] = useState(false);

  // Load categories and initial seed
  const loadCategories = async () => {
    try {
      await seedDefaultCategoriesIfEmpty();
      const cats = await getAttractionCategories();
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  // Load all attractions (auto-migrating legacy shops & clubs if empty)
  const loadAttractions = async () => {
    setLoading(true);
    try {
      let data = await getAttractionsList({ categoryId: "all" });
      if (data.length === 0) {
        try {
          const res = await migrateLegacyShopsAndClubs();
          if (res.totalMigrated > 0) {
            data = await getAttractionsList({ categoryId: "all" });
          }
        } catch (mErr) {
          console.warn("Auto-migration background notice:", mErr);
        }
      }
      setAttractions(data);
    } catch (err) {
      console.error("Failed to load attractions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadAttractions();
  }, [isAdmin, isSubAdmin]);

  // Sync category param
  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) {
      setSelectedCategory(cat);
    }
  }, [searchParams]);

  const handleCategorySelect = (catId) => {
    setSelectedCategory(catId);
    setPage(1);
    if (catId === "all") {
      searchParams.delete("category");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ category: catId });
    }
  };

  // Dynamic list of available cities (merging defaults with any custom cities in the database)
  const availableCities = useMemo(() => {
    const citySet = new Set(THAILAND_CITIES.filter((c) => c !== "All Cities"));
    attractions.forEach((a) => {
      if (a.city && a.city.trim()) {
        citySet.add(a.city.trim());
      }
    });
    return ["All Cities", ...Array.from(citySet).sort()];
  }, [attractions]);

  // Filtered attractions based on Category, City, and Search text
  const filteredAttractions = useMemo(() => {
    return attractions.filter((item) => {
      // Category filter
      if (selectedCategory !== "all") {
        const matchesCategory =
          item.categoryId === selectedCategory ||
          (selectedCategory === "shopping-malls" && item.categoryId === "shops") ||
          (selectedCategory === "clubs-nightlife" && item.categoryId === "clubs");
        if (!matchesCategory) return false;
      }

      // City filter
      if (selectedCity !== "All Cities") {
        if (item.city?.toLowerCase() !== selectedCity.toLowerCase()) {
          return false;
        }
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name?.toLowerCase().includes(q);
        const matchesAddress = item.address?.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        const matchesCity = item.city?.toLowerCase().includes(q);
        const matchesInstructions = item.visitorInstructions?.toLowerCase().includes(q);
        if (!matchesName && !matchesAddress && !matchesDesc && !matchesCity && !matchesInstructions) {
          return false;
        }
      }

      return true;
    });
  }, [attractions, selectedCategory, selectedCity, searchQuery]);

  // Paginated slice
  const paginatedAttractions = useMemo(() => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    return filteredAttractions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAttractions, page]);

  const totalPages = Math.ceil(filteredAttractions.length / ITEMS_PER_PAGE) || 1;

  // Handlers for Add / Edit
  const handleOpenAdd = () => {
    setIsUpdate(false);
    setSelectedAttraction(null);
    setOpenAddModal(true);
  };

  const handleOpenEdit = (attraction) => {
    setIsUpdate(true);
    setSelectedAttraction(attraction);
    setOpenAddModal(true);
  };

  const handleSaveAttraction = async (formData, id) => {
    await saveAttraction(formData, id);
    await loadAttractions();
  };

  const handleDeleteAttraction = async (id) => {
    await deleteAttraction(id);
    await loadAttractions();
  };


  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <PageHeading
          title="Prime Locations & Attractions"
          subtitle="Curate and manage dynamic destinations, shopping, nightlife, and cultural sites for GoThai."
        />

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setOpenCategoryModal(true)}
            className="px-4 py-2 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 text-sm font-semibold rounded-lg shadow-sm transition flex items-center space-x-2 cursor-pointer"
          >
            <span>⚙️</span>
            <span>Manage Categories</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-[var(--form-button-bg-color,#2563EB)] hover:opacity-90 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
          >
            <AddIcon fontSize="small" />
            <span>Add Attraction</span>
          </button>
        </div>
      </div>


      {/* Dynamic Category Navigation Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
        <button
          onClick={() => handleCategorySelect("all")}
          className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
            selectedCategory === "all"
              ? "bg-gray-900 text-white shadow-sm"
              : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          📍 All Locations ({attractions.length})
        </button>

        {categories.map((cat) => {
          const count = attractions.filter(
            (a) =>
              a.categoryId === cat.id ||
              (cat.id === "shopping-malls" && a.categoryId === "shops") ||
              (cat.id === "clubs-nightlife" && a.categoryId === "clubs")
          ).length;

          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition flex items-center space-x-1.5 cursor-pointer ${
                isSelected
                  ? "text-white shadow-sm"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
              style={{
                backgroundColor: isSelected ? cat.badgeColor || "#2563EB" : undefined,
              }}
            >
              <span>{cat.emoji || "📍"}</span>
              <span>{cat.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & City Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6">
        <div className="md:col-span-8">
          <SearchBar
            btn={false}
            placeholder="Search attractions by name, address, or details..."
            handleSearch={(text) => {
              setSearchQuery(text);
              setPage(1);
            }}
          />
        </div>
        <div className="md:col-span-4 flex items-center">
          <select
            value={selectedCity}
            onChange={(e) => {
              setSelectedCity(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city === "All Cities" ? "🌐 All Cities" : `📍 ${city}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Attractions Listings Grid */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-sm">Loading GoThai attractions...</p>
        </div>
      ) : paginatedAttractions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📍</div>
          <h3 className="text-base font-semibold text-gray-800">No attractions found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
            {searchQuery
              ? `No matching places found for "${searchQuery}".`
              : "No attractions have been added to this category yet."}
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow transition cursor-pointer flex items-center space-x-1.5 mx-auto"
          >
            <AddIcon fontSize="small" />
            <span>Add First Attraction</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {paginatedAttractions.map((item) => (
            <AttractionCard
              key={item.id}
              attraction={item}
              categories={categories}
              onEdit={handleOpenEdit}
              onDelete={handleDeleteAttraction}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, val) => setPage(val)}
            color="primary"
          />
        </div>
      )}

      {/* Add / Edit Modal */}
      <AddAttractionModal
        open={openAddModal}
        onClose={() => setOpenAddModal(false)}
        isUpdate={isUpdate}
        attraction={selectedAttraction}
        categories={categories}
        existingCities={availableCities.filter((c) => c !== "All Cities")}
        onSave={handleSaveAttraction}
      />

      {/* Category Management Modal */}
      <ManageCategoriesModal
        open={openCategoryModal}
        onClose={() => setOpenCategoryModal(false)}
        categories={categories}
        onCategoriesChanged={loadCategories}
      />
    </div>
  );
}
