import { useState } from "react";
import UpdateButton from "../UpdateButton";
import DeleteButton from "../DeleteButton";

export default function AttractionCard({
  attraction,
  categories = [],
  onEdit,
  onDelete,
}) {
  const [loading, setLoading] = useState(false);

  // Find matching category for badge styling
  const matchedCategory = categories.find(
    (c) => c.id === attraction.categoryId || c.name === attraction.categoryName
  );

  const badgeColor = matchedCategory?.badgeColor || "#2563EB";
  const emoji = matchedCategory?.emoji || "📍";
  const categoryDisplayName =
    matchedCategory?.name || attraction.categoryName || "Attraction";

  const handleDelete = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete "${attraction.name}" from GoThai Prime Locations?`
      )
    ) {
      setLoading(true);
      try {
        await onDelete(attraction.id);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="text-black bg-white relative rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
      {/* Top-Right Action Buttons */}
      <div className="absolute right-3 top-3 flex items-center space-x-1 z-10 bg-white/80 backdrop-blur-sm rounded-lg p-1">
        <UpdateButton
          title="Update this attraction"
          handleEdit={() => onEdit(attraction)}
        />
        <DeleteButton
          title="Delete this attraction"
          handleDelete={handleDelete}
        />
      </div>

      {/* Image Thumbnail with Category Badge */}
      <div className="relative shrink-0 w-full md:w-44 h-40 rounded-lg overflow-hidden bg-gray-100">
        <img
          loading="lazy"
          src={attraction.imageUrl}
          alt={attraction.name}
          className="w-full h-full object-cover"
        />
        {/* Category Pill Tag on Image */}
        <div
          className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-sm flex items-center space-x-1"
          style={{ backgroundColor: badgeColor }}
        >
          <span>{emoji}</span>
          <span>{categoryDisplayName}</span>
        </div>
      </div>

      {/* Details Section */}
      <div className="flex-1 min-w-0 pr-16 md:pr-14 flex flex-col justify-between h-auto md:min-h-40 py-1">
        <div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1 mb-1">
            <h3 className="text-lg font-bold text-gray-900 truncate">
              {attraction.name}
            </h3>
            {attraction.city && (
              <span className="text-[11px] font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                📍 {attraction.city}
              </span>
            )}
            {attraction.openingHours && (
              <span className="text-[11px] font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                🕒 {attraction.openingHours}
              </span>
            )}
            {attraction.visitorInstructions && (
              <span
                title={attraction.visitorInstructions}
                className="text-[11px] font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-help"
              >
                📜 Space Guide
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed mb-2">
            {attraction.description}
          </p>
          {attraction.visitorInstructions && (
            <div
              className="mb-2 p-1.5 bg-slate-50 border border-slate-200/70 rounded-lg text-[11px] text-slate-700 flex items-start gap-1.5"
              title={attraction.visitorInstructions}
            >
              <span className="text-xs shrink-0">📜</span>
              <p className="line-clamp-1 italic text-slate-600">
                <span className="font-semibold not-italic text-slate-800">Guidelines:</span> {attraction.visitorInstructions}
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
          <p className="truncate max-w-[70%]" title={attraction.address}>
            📍 {attraction.address}
          </p>
          {attraction.latitude && attraction.longitude && (
            <span className="text-gray-400 font-mono shrink-0">
              {Number(attraction.latitude).toFixed(3)}, {Number(attraction.longitude).toFixed(3)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
